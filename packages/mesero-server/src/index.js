import http from "node:http";
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import multer from "multer";
import { WebSocketServer } from "ws";
import {
  fetchAiboxProfile,
  getAiboxLoginUrl,
  getAiboxRefreshTokenUrl,
  isAiboxAuthConfigured,
  isAccessTokenExpired,
  loginWithCredentials,
  refreshAiboxTokens,
} from "./aiboxAuth.js";
import { fetchCommercialOfferings, isCommercialOfferingsConfigured } from "./aiboxOfferings.js";
import { catalogSource, getResolvedCatalog, invalidateCatalogCache } from "./menuCatalog.js";
import { getOfferingImage } from "./offeringImageStore.js";
import { filterAmbiguousMenuLines } from "./orderAmbiguity.js";
import {
  buildConversationPhaseHint,
  buildWaiterHospitalityBlock,
  buildWelcomeReply,
  defaultWaiterFlow,
  DEFAULT_ASSISTANT_EXTRA_INSTRUCTIONS,
  isWakeOnlyOrShortGreeting,
} from "./waiterServicePrompt.js";
import {
  computeTableBills,
  markTablePaid,
  parseTableNumber,
  requestTablePayment,
  setTablePaymentRequest,
} from "./tableBills.js";
import {
  advancePaymentFlow,
  normalizePaymentRequest,
  paymentFlowPromptBlock,
  startPaymentFlow,
} from "./paymentFlow.js";
import * as billingClient from "./billingClient.js";
import { getPaymentHistoryEntry, listPaymentHistory, recordPaymentHistory } from "./paymentHistory.js";
import {
  analyticsFromPaymentHistory,
  computeDashboard,
  computeTopProducts,
} from "./salesAnalytics.js";
import { createCompanyStore } from "./companyStore.js";
import {
  bearerToken,
  companyContextMiddleware,
  companyStorage,
  getCompanyContext,
  resolveCompanyId,
} from "./companyContext.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Variables desde .env: raíz del monorepo y, si existe, packages/mesero-server/.env (manda este último si repite claves)
dotenv.config({ path: path.join(__dirname, "..", "..", "..", ".env") });
dotenv.config({ path: path.join(__dirname, "..", ".env"), override: true });

/** Clave sin espacios; vacío si no hay o solo hay espacios en .env */
function openAiApiKey() {
  const v = process.env.OPENAI_API_KEY;
  if (typeof v !== "string") return "";
  return v.trim();
}

const DATA_DIR = path.join(__dirname, "..", "data");
/** Origen legacy para migración única a SQLite (si existe y la BD está vacía). */
const STORE_FILE = path.join(DATA_DIR, "store.json");
const STORE_DB = process.env.MESERO_DB_PATH || path.join(DATA_DIR, "mesero.db");

/** Por defecto 3041: en algunos equipos el 3001 lo ocupa Cursor u otra herramienta. Sobreescribe con `PORT` en `.env`. */
const PORT = Number(process.env.PORT) || 3041;

const DEFAULT_WAKE_WORD = "karen";

function normalizeWakeWord(raw) {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFC");
  if (t.length < 2 || t.length > 24) return DEFAULT_WAKE_WORD;
  if (!/^[\p{L}\p{N}]+$/u.test(t)) return DEFAULT_WAKE_WORD;
  return t;
}

function resolveWakeWord(settings) {
  const fromStore = String(settings?.wakeWord ?? "").trim();
  if (fromStore) return normalizeWakeWord(fromStore);
  return normalizeWakeWord(process.env.MESERO_WAKE_WORD);
}

function displayWakeWord(wakeWord) {
  const w = normalizeWakeWord(wakeWord);
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Quita la palabra de activación del texto del cliente (p. ej. «karen hi» → «hi»). */
function stripWakeWordFromUtterance(text, wakeWord) {
  const w = normalizeWakeWord(wakeWord || DEFAULT_WAKE_WORD);
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  const re = new RegExp(`\\b${escapeRegExp(w)}\\b`, "gi");
  return raw.replace(re, " ").replace(/\s+/g, " ").trim();
}

const DEFAULT_TABLE_COUNT = 12;
const MIN_TABLE_COUNT = 1;
const MAX_TABLE_COUNT = 99;

function normalizeTableCount(raw) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_TABLE_COUNT;
  return Math.min(MAX_TABLE_COUNT, Math.max(MIN_TABLE_COUNT, Math.round(n)));
}

function resolveTableCount(settings) {
  const fromStore = settings?.tableCount;
  if (fromStore !== undefined && fromStore !== null && String(fromStore).trim() !== "") {
    return normalizeTableCount(fromStore);
  }
  const fromEnv = process.env.MESERO_TABLE_COUNT;
  if (fromEnv !== undefined && String(fromEnv).trim() !== "") {
    return normalizeTableCount(fromEnv);
  }
  return DEFAULT_TABLE_COUNT;
}

/** @param {unknown} raw @param {number} tableCount */
function normalizeSelectedTable(raw, tableCount) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < MIN_TABLE_COUNT || i > tableCount) return null;
  return i;
}

/** @param {number} n */
function formatTableLabel(n) {
  return `Mesa ${n}`;
}

/** Mesa del quiosco: cuerpo del chat o configuración guardada en settings.kioskTable */
function resolveKioskTable(selectedTable) {
  const tableCount = resolveTableCount(store.settings);
  return (
    normalizeSelectedTable(selectedTable, tableCount) ??
    normalizeSelectedTable(store.settings.kioskTable, tableCount)
  );
}

/** @param {unknown} rawTable @param {unknown} selectedTable */
function resolveOrderTable(rawTable, selectedTable) {
  const t = String(rawTable ?? "").trim();
  if (t) return t;
  const tableCount = resolveTableCount(store.settings);
  const sel = normalizeSelectedTable(selectedTable, tableCount);
  if (sel) return formatTableLabel(sel);
  return "";
}

/** @typedef {{ id: string; name: string; description: string; price: number; category: string; available?: boolean; imageUrl?: string }} MenuItem */
/** @typedef {{ id: string; table?: string; items: { menuItemId: string; name: string; qty: number; notes?: string }[]; status: string; createdAt: string; notes?: string }} Order */
/** @typedef {{ nodes: unknown[]; edges: unknown[] }} FlowState */

function defaultStore() {
  return {
    menu: /** @type {MenuItem[]} */ ([
      {
        id: "m1",
        name: "Ensalada César",
        description: "Lechuga romana, aderezo césar, crutones y parmesano.",
        price: 8.5,
        category: "Entradas",
        available: true,
        imageUrl: "https://picsum.photos/seed/mesero-ensalada/400/300",
      },
      {
        id: "m2",
        name: "Pasta Alfredo",
        description: "Fettuccine en salsa cremosa con pollo a la plancha.",
        price: 14.0,
        category: "Principales",
        available: true,
        imageUrl: "https://picsum.photos/seed/mesero-pasta/400/300",
      },
      {
        id: "m3",
        name: "Brownie con helado",
        description: "Brownie caliente de chocolate y helado de vainilla.",
        price: 6.0,
        category: "Postres",
        available: true,
        imageUrl: "https://picsum.photos/seed/mesero-postre/400/300",
      },
    ]),
    orders: /** @type {Order[]} */ ([]),
    flow: /** @type {FlowState} */ (defaultWaiterFlow()),
    settings: {
      restaurantName: "Mi restaurante",
      wakeWord: normalizeWakeWord(process.env.MESERO_WAKE_WORD),
      tableCount: resolveTableCount({ tableCount: process.env.MESERO_TABLE_COUNT }),
      /** Texto libre que el admin puede usar para tono, políticas, etc. */
      assistantExtraInstructions: DEFAULT_ASSISTANT_EXTRA_INSTRUCTIONS,
    },
    /** Nombres de categoría para el menú (elegibles al editar platos). */
    menuCategories: ["Entradas", "Principales", "Postres"],
    tablePaymentRequests: {},
    paymentHistory: [],
  };
}

const storeApi = createCompanyStore({
  filePath: STORE_FILE,
  dbPath: STORE_DB,
  defaultSlice: defaultStore,
});

/** Acceso al slice de la empresa activa (AsyncLocalStorage por petición). */
const store = new Proxy(
  {},
  {
    get(_t, prop) {
      const ctx = getCompanyContext();
      if (!ctx) throw new Error(`store.${String(prop)}: sin contexto de empresa (companyId)`);
      return ctx.store[prop];
    },
    set(_t, prop, val) {
      const ctx = getCompanyContext();
      if (!ctx) throw new Error(`store.${String(prop)}: sin contexto de empresa (companyId)`);
      ctx.store[prop] = val;
      return true;
    },
  },
);

function saveStore() {
  const ctx = getCompanyContext();
  if (ctx) ctx.save();
}

/** @param {string} plain */
function hashAdminExitPassword(plain) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(plain, salt, 32);
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

/**
 * @param {string} plain
 * @param {string | undefined} stored
 */
function verifyAdminExitPasswordPlain(plain, stored) {
  if (!stored || typeof stored !== "string" || !stored.startsWith("scrypt$")) return false;
  const parts = stored.split("$");
  if (parts.length !== 3) return false;
  const [, salt, expectedHex] = parts;
  let expected;
  try {
    expected = Buffer.from(expectedHex, "hex");
  } catch {
    return false;
  }
  let derived;
  try {
    derived = crypto.scryptSync(plain, salt, expected.length);
  } catch {
    return false;
  }
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(expected, derived);
}

function publicSettings() {
  const ctx = getCompanyContext();
  const s = { ...store.settings };
  delete s.adminExitPasswordHash;
  delete s.assistantLanguage;
  s.wakeWord = resolveWakeWord(store.settings);
  s.tableCount = resolveTableCount(store.settings);
  s.adminExitPasswordConfigured = Boolean(store.settings.adminExitPasswordHash);
  if (ctx?.companyId) s.companyId = ctx.companyId;
  if (ctx?.branchId) s.branchId = ctx.branchId;
  const tc = resolveTableCount(store.settings);
  const kt = normalizeSelectedTable(store.settings.kioskTable, tc);
  if (kt) s.kioskTable = kt;
  return s;
}

function orderWithCompanyFields(base) {
  const ctx = getCompanyContext();
  return {
    ...base,
    companyId: ctx?.companyId ?? null,
    branchId: ctx?.branchId ?? null,
  };
}

function deriveMenuCategoriesFromMenu(companyStore) {
  const u = [...new Set(companyStore.menu.map((m) => String(m.category || "").trim()).filter(Boolean))];
  return u.length ? u.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })) : ["General"];
}

async function tableBillsPayload() {
  let menu = store.menu;
  try {
    menu = await getResolvedCatalog(store.menu);
  } catch {
    /* menú local */
  }
  return computeTableBills(
    {
      orders: store.orders,
      tablePaymentRequests: store.tablePaymentRequests,
      tableCount: resolveTableCount(store.settings),
    },
    menu,
  );
}

function broadcastTableBills() {
  void tableBillsPayload().then((bills) => broadcast("tableBills", bills));
}

/** @type {Set<import('ws').WebSocket>} */
const clients = new Set();

function broadcast(type, payload) {
  const companyId = getCompanyContext()?.companyId ?? null;
  const msg = JSON.stringify({ type, payload, at: new Date().toISOString() });
  for (const ws of clients) {
    if (ws.readyState !== 1) continue;
    if (companyId && ws.companyId && ws.companyId !== companyId) continue;
    ws.send(msg);
  }
}

/** Nodos del flujo en orden topológico aproximado (misma lógica que el prompt para la IA). */
function orderedFlowNodes(flow) {
  const nodes = Array.isArray(flow?.nodes) ? flow.nodes : [];
  const edges = Array.isArray(flow?.edges) ? flow.edges : [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const outs = new Map();
  for (const e of edges) {
    if (!outs.has(e.source)) outs.set(e.source, []);
    outs.get(e.source).push(e.target);
  }
  const roots = nodes.filter(
    (n) => !edges.some((e) => e.target === n.id),
  );
  const ordered = [];
  const visit = (id, seen) => {
    if (seen.has(id)) return;
    seen.add(id);
    const n = byId.get(id);
    if (!n) return;
    ordered.push(n);
    for (const t of outs.get(id) || []) visit(t, seen);
  };
  const seen = new Set();
  for (const r of roots.length ? roots : nodes) visit(r.id, seen);
  for (const n of nodes) if (!seen.has(n.id)) visit(n.id, seen);
  return ordered;
}

function flowToPrompt(flow) {
  return orderedFlowNodes(flow)
    .map((n, i) => {
      const label = n?.data?.label || n.id;
      const hint = n?.data?.hint || "";
      return `${i + 1}. ${label}${hint ? ` — ${hint}` : ""}`;
    })
    .join("\n");
}

function currentFlowStepNode(flow, userTurnIndex0) {
  const ordered = orderedFlowNodes(flow);
  if (ordered.length === 0) return null;
  const idx = Math.min(Math.max(0, userTurnIndex0), ordered.length - 1);
  return ordered[idx];
}

function formatFlowStepForGuest(node, kioskTable = null) {
  if (!node) return "";
  const label = node?.data?.label || node.id || "Paso";
  const hint = sanitizeFlowHintForKiosk(String(node?.data?.hint || "").trim(), kioskTable);
  return hint ? `${label}: ${hint}` : `${label}.`;
}

/** @param {string} hint @param {number | null} kioskTable */
function sanitizeFlowHintForKiosk(hint, kioskTable) {
  if (!hint || !kioskTable) return hint;
  if (/pregunta.*mesa|en qué mesa|qué mesa|which table|what table|table are you/i.test(hint)) {
    return "Saluda y ofrece el menú o preguntan qué desean pedir.";
  }
  return hint;
}

/** Último mensaje del usuario parece inglés (turista / mezcla en local hispanohablante). */
function isLikelyEnglishUserMessage(text) {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (/[áéíóúñü¿¡]/i.test(t)) return false;
  const norm = t.replace(/\s+/g, " ");
  if (/\b(hola|gracias|menú|carta|quiero|mesa|por favor|buenas|adiós|chao)\b/i.test(norm)) return false;

  if (
    /^(hi|hey|hello|howdy)(\s+there)?\s*[!?.…,:)]*$/i.test(norm) ||
    /^(good\s+(morning|afternoon|evening)|morning)\s*[!?.…]*$/i.test(norm)
  ) {
    return true;
  }

  if (
    /\b(hello|hi|hey|please|thanks|thank you|english|in english|speak english|the menu|what do you|what's up|whats up|can i|could i|would like|i'd like|i will have|i'll have|i want|give me|can i get|i'?m\b|we'?re\b|table for|order|bill|check|water|beer|wine|dessert|excuse me|sorry|help me|show me|house drink|drink of the house|confirm|confirmation|yes|yeah|yep|okay|ok|sure)\b/i.test(
      norm,
    )
  ) {
    return true;
  }
  return false;
}

/** «yes», «ok», «confirm» tras varios turnos en inglés. */
function isShortEnglishAffirmation(text) {
  const norm = String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!norm || /[áéíóúñü¿¡]/i.test(norm)) return false;
  if (/\b(s[ií]|quiero|gracias|por favor|confirmo|vale|bueno|menú|carta)\b/i.test(norm)) return false;
  return (
    /^(yes|yeah|yep|ok|okay|sure|right|correct|please|confirmed?|confirm|go ahead|that'?s (it|right|correct|fine)|sounds good|perfect)[\s,!?.]*$/i.test(
      norm,
    ) ||
    /^(yes|yeah|yep|ok|okay|sure)\b/i.test(norm)
  );
}

/** Inglés en el hilo reciente (no solo el último turno — evita español al confirmar con «yes»). */
function conversationPrefersEnglish(messages) {
  const wake = resolveWakeWord(store.settings);
  const users = messages.filter((m) => m.role === "user").slice(-5);
  if (!users.length) return false;

  let englishTurns = 0;
  for (const m of users) {
    const t = stripWakeWordFromUtterance(String(m.content ?? ""), wake);
    if (isLikelyEnglishUserMessage(t)) englishTurns++;
  }

  const last = stripWakeWordFromUtterance(String(users[users.length - 1]?.content ?? ""), wake);
  if (isLikelyEnglishUserMessage(last)) return true;
  if (englishTurns >= 1 && isShortEnglishAffirmation(last)) return true;
  if (englishTurns >= 2) return true;
  return false;
}

/** Cliente pide explícitamente precios / importes (texto o voz). */
function userWantsPriceInfo(text) {
  const t = String(text ?? "").toLowerCase();
  if (!t.trim()) return false;
  return (
    /\b(precio|precios|cuánto cuesta|cuanto cuesta|cuánto vale|cuanto vale|cuestan|importe|importes|tarifa|coste|costos|pagar|total)\b/.test(
      t,
    ) ||
    /\b(price|prices|pricing|how much|cost of|bill|check please)\b/.test(t) ||
    /\b(menu|lista|carta)\b.*\b(precio|precios|price|prices)\b/.test(t) ||
    /\b(precio|precios|price|prices)\b.*\b(menu|lista|carta)\b/.test(t)
  );
}

/**
 * Respuesta local cuando no hay API de chat: tono de mesero y guía según el flujo guardado (sin mensajes técnicos al cliente).
 */
function buildOfflineAssistantReply(messages, store, menu, kioskTable = null, kitchenOrders = []) {
  const lastUser = lastUserMessageContent(messages);
  if (isShortEnglishGreeting(lastUser)) {
    return buildEnglishGreetingReply(store, kioskTable);
  }
  if (userAsksOrderStatus(lastUser, kitchenOrders)) {
    return buildOrderStatusReply(kitchenOrders, conversationPrefersEnglish(messages));
  }
  const lower = lastUser.toLowerCase();
  const en = conversationPrefersEnglish(messages);
  const userTurns = messages.filter((m) => m.role === "user").length;
  const turnIdx = Math.max(0, userTurns - 1);
  const stepNode = currentFlowStepNode(store.flow, turnIdx);
  const stepLine = formatFlowStepForGuest(stepNode, kioskTable);
  const wantPrices = userWantsPriceInfo(lastUser);
  const { items: menuSlice } = selectMenuItemsForPrompt(messages, menu);
  const menuBrief = wantPrices ? formatMenuBriefByCategory(menuSlice) : formatMenuBriefByCategoryNoPrices(menuSlice);
  const noPriceFootEn =
    "\n\n(Prices are shown on the kiosk screen; I’m listing only names and categories here.)";
  const noPriceFootEs =
    "\n\n(Los precios están en la pantalla del menú; aquí solo nombres y categorías.)";
  const menuFoot = wantPrices ? "" : en ? noPriceFootEn : noPriceFootEs;
  const name = String(store.settings.restaurantName || "el restaurante").trim() || "el restaurante";
  const extra = String(store.settings.assistantExtraInstructions || "").trim();
  const extraShort =
    extra.length > 0
      ? `${extra.slice(0, 420)}${extra.length > 420 ? "…" : ""}`
      : "";

  if (en) {
    if (/\b(menu|dishes?|cart|food|drinks?|price|prices)\b/i.test(lower)) {
      const tail = stepLine
        ? `\n\nAt this point in service we follow the house flow: ${stepLine}`
        : "";
      return `Here is a concise menu for ${name}:\n${menuBrief}${tail}${menuFoot}\n\nWould you like a suggestion, or shall we continue with your order?`;
    }
    if (/\b(hello|hi|hey|good (morning|afternoon|evening))\b/i.test(lower)) {
      const first = currentFlowStepNode(store.flow, 0);
      const intro = first ? ` We start with: ${formatFlowStepForGuest(first, kioskTable)}` : "";
      return `Hello! Welcome to ${name}.${intro} Would you like to hear menu options, or what do you need first?`;
    }
    if (/\b(thanks|thank you|bye|goodbye|see you)\b/i.test(lower)) {
      return `Thank you for choosing ${name}. Whenever you're ready, we're here.`;
    }
    const extraBlock =
      extraShort && !/\b(menu|dishes?|prices?)\b/i.test(lower)
        ? `\n\nThe venue also left these notes for staff (may be in Spanish): ${extraShort}`
        : "";
    if (stepLine) {
      return `I understood: "${lastUser}". Following the house flow, we're now at: ${stepLine}.${extraBlock}\n\nShall we continue with the menu or refine your order?`;
    }
    const tableQ = kioskTable
      ? ""
      : "\n\nWhat would you like, or which table are you at?";
    return `I understood: "${lastUser}". I can walk you through the menu by category or help you place an order.${extraBlock}${tableQ}`;
  }

  if (/men[uú]|carta|platos?|precios?/.test(lower)) {
    const tail = stepLine ? `\n\nEn esta fase del servicio nos guiamos por: ${stepLine}` : "";
    return `Aquí tienes el menú resumido de ${name}:\n${menuBrief}${tail}${menuFoot}\n\n¿Quieres que te sugiera algo concreto o seguimos con tu pedido?`;
  }
  if (/hola|buenas|qué tal/.test(lower) && !/\b(hi|hello|hey)\b/i.test(lower)) {
    return buildWelcomeReply(store.settings, { kioskTable });
  }
  if (/gracias|muchas gracias|hasta luego|adi[oó]s|chao|nos vemos/.test(lower)) {
    return `Gracias a ti por elegir ${name}. Cuando quieras, aquí seguimos.`;
  }

  const extraBlock =
    extraShort && !/men[uú]|carta|platos?|precios?/.test(lower)
      ? `\n\nRecuerda también lo que dejó configurado el local: ${extraShort}`
      : "";

  if (stepLine) {
    return `He entendido: «${lastUser}». Según el flujo del local, ahora toca: ${stepLine}.${extraBlock}\n\n¿Seguimos con el menú o afinamos tu pedido?`;
  }
  const tableQ = kioskTable ? "" : "\n\n¿Qué te apetece o qué mesa es?";
  return `He entendido: «${lastUser}». Te puedo contar el menú por categorías o ayudarte a cerrar el pedido.${extraBlock}${tableQ}`;
}

function sortMenuByCategory(menu) {
  return [...menu].sort((a, b) => {
    const c = String(a.category || "").localeCompare(String(b.category || ""), "es", {
      sensitivity: "base",
    });
    if (c !== 0) return c;
    return String(a.name || "").localeCompare(String(b.name || ""), "es", { sensitivity: "base" });
  });
}

/** Menú agrupado por categoría para el prompt del sistema. */
function formatMenuForSystemPrompt(menu) {
  const sorted = sortMenuByCategory(menu);
  const lines = [];
  let lastCat = null;
  for (const m of sorted) {
    const cat = String(m.category || "General").trim() || "General";
    if (cat !== lastCat) {
      if (lines.length > 0) lines.push("");
      lines.push(`### ${cat}`);
      lastCat = cat;
    }
    const price =
      typeof m.price === "number" && !Number.isNaN(m.price) ? m.price.toFixed(2) : "0.00";
    const imgUrl =
      typeof m.imageUrl === "string" ? String(m.imageUrl).trim() : "";
    const img =
      imgUrl && /^https?:\/\//i.test(imgUrl) ? ` · foto: ${imgUrl}` : "";
    const base = `- [${m.id}] ${m.name}: ${m.description} — $${price}${img}`;
    lines.push(
      m.available === false
        ? `${base} — **AGOTADO / NO DISPONIBLE** (no lo ofrezcas ni lo incluyas en nuevos pedidos; si el cliente lo pide, explica con amabilidad que se terminó por hoy).`
        : base,
    );
  }
  return lines.join("\n");
}

function formatMenuBriefByCategory(menu) {
  const sorted = sortMenuByCategory(menu);
  const lines = [];
  let lastCat = null;
  for (const m of sorted) {
    const cat = String(m.category || "General").trim() || "General";
    if (cat !== lastCat) {
      if (lines.length > 0) lines.push("");
      lines.push(`${cat}:`);
      lastCat = cat;
    }
    const tag = m.available === false ? " (agotado — no disponible)" : "";
    const price =
      typeof m.price === "number" && !Number.isNaN(m.price) ? m.price.toFixed(2) : "0.00";
    lines.push(`  • ${m.name}${tag} — $${price}`);
  }
  return lines.join("\n");
}

/** Resumen de menú para respuestas locales sin importes (precios en pantalla). */
function formatMenuBriefByCategoryNoPrices(menu) {
  const sorted = sortMenuByCategory(menu);
  const lines = [];
  let lastCat = null;
  for (const m of sorted) {
    const cat = String(m.category || "General").trim() || "General";
    if (cat !== lastCat) {
      if (lines.length > 0) lines.push("");
      lines.push(`${cat}:`);
      lastCat = cat;
    }
    const tag = m.available === false ? " (agotado — no disponible)" : "";
    lines.push(`  • ${m.name}${tag}`);
  }
  return lines.join("\n");
}

function stripDiacritics(s) {
  return String(s).normalize("NFD").replace(/\p{M}+/gu, "");
}

/** Últimos turnos del usuario (texto unido) para inferir categoría sin depender solo del último mensaje. */
function recentUserTextForMenuScope(messages, maxTurns = 2) {
  const users = messages.filter((m) => m.role === "user").slice(-maxTurns);
  return users.map((m) => String(m.content ?? "")).join(" ");
}

function categoriesMentionedInText(text, categories) {
  const t = stripDiacritics(String(text ?? "").toLowerCase());
  const out = [];
  for (const cat of categories) {
    const c = stripDiacritics(cat.toLowerCase());
    if (!c.trim()) continue;
    if (t.includes(c)) {
      out.push(cat);
      continue;
    }
    if (c.length >= 4 && c.endsWith("s")) {
      const singular = c.slice(0, -1);
      if (t.includes(singular)) out.push(cat);
    } else if (c.length >= 3 && !c.endsWith("s")) {
      if (t.includes(`${c}s`)) out.push(cat);
    }
  }
  return [...new Set(out)];
}

/** Palabras habituales → categorías configuradas (por subcadena en el nombre de categoría). */
function categoriesFromKeywordHints(text, categories) {
  const t = stripDiacritics(String(text ?? "").toLowerCase());
  const hints = [
    [/\b(postres?|dulces?|desserts?|helados?|tartas?)\b/i, /(postre|producto)/i],
    [/\b(entradas?|starters?|ensaladas?|tapas?|aperitivos?)\b/i, /entrada/i],
    [/\b(principales?|fuertes?|segundos?|pastas?|carnes?|pescados?|mains?)\b/i, /principal/i],
    [/\b(bebidas?|drinks?|jugos?|cervezas?|vinos?|refrescos?)\b/i, /(bebida|producto)/i],
    [/\b(paquetes?|combos?|menú ejecutivo|menu ejecutivo)\b/i, /paquete/i],
    [/\b(servicios?|reservas?)\b/i, /servicio/i],
  ];
  const out = [];
  for (const [re, hint] of hints) {
    if (!re.test(t)) continue;
    const hit = categories.find((c) => hint.test(stripDiacritics(String(c).toLowerCase())));
    if (hit) out.push(hit);
  }
  return [...new Set(out)];
}

function categoriesFromMentionedDishNames(text, menu) {
  const t = stripDiacritics(String(text ?? "").toLowerCase());
  const cats = new Set();
  for (const m of menu) {
    const n = stripDiacritics(String(m.name ?? "").toLowerCase()).trim();
    if (n.length < 3) continue;
    if (t.includes(n)) cats.add(String(m.category || "General").trim() || "General");
  }
  return cats;
}

function userExplicitlyWantsFullMenuCatalog(scopeText, categories, menu) {
  const t = stripDiacritics(String(scopeText ?? "").toLowerCase());
  if (!t.trim()) return true;

  const hasSpecificHint =
    categoriesMentionedInText(scopeText, categories).length > 0 ||
    categoriesFromKeywordHints(scopeText, categories).length > 0 ||
    categoriesFromMentionedDishNames(scopeText, menu).size > 0;

  if (/\b(todo|toda|completo|completa|everything|whole menu|entire menu)\b/i.test(t) && /\b(carta|menu|menú|list)\b/i.test(t)) {
    return true;
  }
  if (/\b(carta|menu|menú)\b/i.test(t) && !hasSpecificHint) return true;
  return false;
}

/**
 * Reduce tokens: si el cliente se centra en categorías concretas, solo se envían esos platos al modelo.
 * Si el mensaje es genérico o pide carta completa, menú entero.
 */
function selectMenuItemsForPrompt(messages, menu) {
  const categories = categoriesForMenuInference(menu);
  const scopeText = recentUserTextForMenuScope(messages, 2);

  if (userExplicitlyWantsFullMenuCatalog(scopeText, categories, menu)) {
    return { items: menu, scopeNote: "" };
  }

  const catSet = new Set([
    ...categoriesMentionedInText(scopeText, categories),
    ...categoriesFromKeywordHints(scopeText, categories),
    ...categoriesFromMentionedDishNames(scopeText, menu),
  ]);

  if (catSet.size === 0) {
    return { items: menu, scopeNote: "" };
  }

  const cats = [...catSet];
  let items = menu.filter((m) => cats.includes(String(m.category || "").trim() || "General"));
  if (items.length === 0) items = menu;

  const others = categories.filter((c) => !catSet.has(c));
  const scopeNote =
    `\n\nALCANCE DEL CATÁLOGO (contexto acotado para ahorrar tokens): solo figuran platos de: ${cats.join(", ")}.` +
    (others.length
      ? ` Otras categorías del local no están listadas abajo: ${others.join(", ")}. Si el cliente pide otra sección, amplía según lo que diga.`
      : "") +
    ` No inventes platos fuera de esta lista.`;

  return { items, scopeNote };
}

function buildLanguageInstructionsForPrompt() {
  const stockNote =
    "\n\nNOTA: Si en este prompt hay reglas solo en español (p. ej. stock AGOTADO) y respondes en inglés, explica al cliente lo necesario en inglés.";
  return `IDIOMA (detección automática): Por defecto responde en español. Trata como inglés también saludos muy cortos típicos (p. ej. «hi», «hey», «hello», «good morning») aunque vayan tras la palabra de activación del micrófono. Si el último mensaje del cliente está claramente en inglés, responde en inglés en ese turno completo (sin mezclar español en la misma frase) y mantén el inglés mientras siga en inglés. Si mezcla idiomas en un mismo mensaje, usa el idioma predominante del último mensaje del usuario. Los nombres en catálogo pueden conservarse; explica en el idioma del cliente.${stockNote}`;
}

function lastUserMessageContent(messages) {
  const raw = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  return stripWakeWordFromUtterance(raw, resolveWakeWord(store.settings));
}

/** Texto reciente del cliente para validar DRAFT/ORDER (varios turnos del mismo pedido). */
function recentUserOrderCorpus(messages, maxTurns = 5) {
  const wake = resolveWakeWord(store.settings);
  return messages
    .filter((m) => m.role === "user")
    .slice(-maxTurns)
    .map((m) => stripWakeWordFromUtterance(String(m.content ?? ""), wake))
    .join(" ");
}

function isShortEnglishGreeting(text) {
  const norm = String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  if (!norm) return false;
  return /^(hi|hey|hello|howdy|yo)(\s+there)?[!?.…,:)]*$/.test(norm) ||
    /^(good\s+(morning|afternoon|evening)|morning)[!?.…]*$/.test(norm);
}

function buildEnglishGreetingReply(store, kioskTable) {
  return buildWelcomeReply(store.settings, { kioskTable, english: true });
}

const KITCHEN_STATUS_PHRASE_ES = {
  nuevo: "nuevo en cocina (recién enviado)",
  preparando: "en preparación",
  listo: "listo para servir",
  entregado: "entregado en mesa",
  pagado: "pagado",
};

const KITCHEN_STATUS_PHRASE_EN = {
  nuevo: "new in the kitchen (just sent)",
  preparando: "being prepared",
  listo: "ready to serve",
  entregado: "delivered to your table",
  pagado: "paid",
};

function kitchenStatusPhrase(status, en) {
  const key = String(status ?? "nuevo").trim() || "nuevo";
  const map = en ? KITCHEN_STATUS_PHRASE_EN : KITCHEN_STATUS_PHRASE_ES;
  return map[key] ?? key;
}

function shortenOrderId(id) {
  return String(id ?? "").slice(0, 6) || "—";
}

function summarizeOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return items.map((i) => `${i.name || i.menuItemId} x${Number(i.qty) || 1}`).join(", ");
}

/** Pedidos del quiosco con estado autoritativo desde el store (no el historial del chat). */
function resolveTrackedKitchenOrders(kitchenOrderIds, kioskTable, orders) {
  const ids = Array.isArray(kitchenOrderIds)
    ? [...new Set(kitchenOrderIds.map((x) => String(x ?? "").trim()).filter(Boolean))]
    : [];
  const byId = ids.map((id) => orders.find((o) => o.id === id)).filter(Boolean);
  if (byId.length) return byId;

  if (!kioskTable) return [];
  const tableCount = resolveTableCount(store.settings);
  return orders
    .filter((o) => {
      const n = parseTableNumber(o.table, tableCount);
      return n === kioskTable && o.status !== "pagado";
    })
    .slice(0, 8);
}

function mentionsTrackedDish(text, trackedOrders) {
  const t = stripDiacritics(String(text ?? "").toLowerCase());
  if (!t.trim() || !trackedOrders.length) return false;
  for (const o of trackedOrders) {
    for (const item of o.items || []) {
      const n = stripDiacritics(String(item.name ?? "").toLowerCase()).trim();
      if (n.length < 4) continue;
      const token = n.split(/\s+/).find((w) => w.length >= 4) || n;
      if (t.includes(token)) return true;
    }
  }
  return false;
}

function userAsksOrderStatus(text, trackedOrders = []) {
  const t = String(text ?? "").toLowerCase();
  if (!t.trim()) return false;
  if (mentionsTrackedDish(text, trackedOrders)) {
    if (
      /\b(c[oó]mo va|ya est[aá]|est[aá] listo|cu[aá]ndo|tardar[aá]|listo|preparaci[oó]n|status|ready|how)\b/i.test(t)
    ) {
      return true;
    }
  }
  if (
    /\b(order status|how('s| is) my order|is (it|my order) ready|where('s| is) my order)\b/i.test(t)
  ) {
    return true;
  }
  if (
    /\b(estado del pedido|estado de (mi |el )?pedido|c[oó]mo va (mi |el )?pedido|ya est[aá] (mi |el )?pedido|cu[aá]ndo (llega|est[aá]) (mi |el )?pedido)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  return (
    /\b(est[aá] listo|listo para servir|en preparaci[oó]n|sigue en cocina|todav[ií]a en|a[uú]n en|cu[aá]nto falta)\b/i.test(
      t,
    ) && /\b(pedido|orden|comida|bebida|platos?|order|food|drink)\b/i.test(t)
  );
}

function buildOrderStatusReply(trackedOrders, en) {
  if (!trackedOrders.length) {
    return en
      ? "I don't see an active order in the kitchen for your table right now. Would you like to place one or hear the menu?"
      : "No veo ningún pedido activo en cocina para tu mesa en este momento. ¿Quieres hacer un pedido o te cuento el menú?";
  }
  if (trackedOrders.length === 1) {
    const o = trackedOrders[0];
    const items = summarizeOrderItems(o.items);
    const st = kitchenStatusPhrase(o.status, en);
    const short = shortenOrderId(o.id);
    if (en) {
      return items
        ? `Your order #${short} (${items}) is ${st}. If you need anything else, I'm here.`
        : `Your order #${short} is ${st}. If you need anything else, I'm here.`;
    }
    return items
      ? `Tu pedido #${short} (${items}) está ${st}. Si necesitas algo más, aquí estoy.`
      : `Tu pedido #${short} está ${st}. Si necesitas algo más, aquí estoy.`;
  }
  const lines = trackedOrders.map((o) => {
    const items = summarizeOrderItems(o.items);
    const st = kitchenStatusPhrase(o.status, en);
    const short = shortenOrderId(o.id);
    return en
      ? `• Order #${short}${items ? ` (${items})` : ""}: ${st}`
      : `• Pedido #${short}${items ? ` (${items})` : ""}: ${st}`;
  });
  return en
    ? `Here's the kitchen status for your table:\n${lines.join("\n")}`
    : `Así están tus pedidos en cocina:\n${lines.join("\n")}`;
}

function formatKitchenOrdersForPrompt(trackedOrders) {
  if (!trackedOrders.length) {
    return "No hay pedidos activos registrados para esta mesa en cocina.";
  }
  return trackedOrders
    .map((o) => {
      const st = kitchenStatusPhrase(o.status, false);
      const items = summarizeOrderItems(o.items);
      return `- Pedido #${shortenOrderId(o.id)}: ${items || "(sin líneas)"} → estado oficial: ${st} (código: ${o.status})`;
    })
    .join("\n");
}

async function generateAssistantChatContent(messages, menu, { selectedTable, kitchenOrderIds, appMode } = {}) {
  const kioskTable = resolveKioskTable(selectedTable);
  const lastUser = lastUserMessageContent(messages);
  const tracked = resolveTrackedKitchenOrders(kitchenOrderIds, kioskTable, store.orders);
  const promptOpts = { selectedTable: kioskTable, kitchenOrders: tracked, appMode };

  if (appMode !== "reception" && userAsksOrderStatus(lastUser, tracked)) {
    return buildOrderStatusReply(tracked, conversationPrefersEnglish(messages));
  }

  const apiKey = openAiApiKey();
  if (!apiKey) {
    return buildOfflineAssistantReply(messages, store, menu, kioskTable, tracked);
  }
  if (isShortEnglishGreeting(lastUser)) {
    return buildEnglishGreetingReply(store, kioskTable);
  }

  const userTurnCount = messages.filter((m) => m.role === "user").length;
  const wakeWord = resolveWakeWord(store.settings);
  if (
    appMode !== "reception" &&
    userTurnCount <= 1 &&
    isWakeOnlyOrShortGreeting(lastUser, wakeWord)
  ) {
    return buildWelcomeReply(store.settings, {
      kioskTable,
      english: conversationPrefersEnglish(messages),
    });
  }

  const system = buildSystemPromptForMessages(messages, menu, promptOpts);
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: system }, ...messages],
      temperature: 0.7,
      max_tokens: 280,
    }),
  });
  if (!r.ok) {
    const errText = await r.text();
    const err = new Error(errText || "OpenAI error");
    err.status = 502;
    throw err;
  }
  const data = await r.json();
  return data?.choices?.[0]?.message?.content || "";
}

/** System prompt + refuerzo explícito cuando el último turno del cliente parece inglés (evita que el modelo ignore «hi»). */
function buildSystemPromptForMessages(messages, menu, opts = {}) {
  const last = lastUserMessageContent(messages);
  const forceEnglish = conversationPrefersEnglish(messages);
  const base = buildSystemPrompt(messages, menu, { ...opts, forceEnglish });
  if (forceEnglish) {
    if (process.env.MESERO_DEBUG_LANG === "1") {
      console.log(`[mesero-server] idioma=en último="${last}"`);
    }
    return `${base}\n\nCONTEXTO DE IDIOMA (este turno — OBLIGATORIO): El cliente está hablando en inglés en esta conversación (último mensaje: «${last}»). Responde ÚNICAMENTE en inglés de principio a fin, incluida la confirmación del pedido y cualquier texto visible antes o después del bloque ORDER_JSON. PROHIBIDO mezclar español (no uses «¡Gracias por confirmar!», «Tu pedido», «estará lista», «mesa», «menú»). Si las instrucciones del local piden español, no aplican mientras el cliente siga en inglés.\n\nCONTEXTO DE PRECIOS: Do not read out prices or totals unless the guest explicitly asks for prices or you are giving the brief final confirmation recap right before the ORDER_JSON block; they can read prices on the kiosk menu.`;
  }
  return base;
}

function buildReceptionSystemPrompt(messages, menu, opts = {}) {
  const forceEnglish = Boolean(opts.forceEnglish);
  const orgName = store.settings.restaurantName || "el establecimiento";
  const stationCount = resolveTableCount(store.settings);
  const selected = normalizeSelectedTable(opts.selectedTable, stationCount);
  const wake = resolveWakeWord(store.settings);
  const wakeLabel = displayWakeWord(wake);

  const hasCatalog = Array.isArray(menu) && menu.length > 0;
  const { items: menuSlice, scopeNote } = hasCatalog
    ? selectMenuItemsForPrompt(messages, menu)
    : { items: [], scopeNote: "" };
  const catalogBlock = hasCatalog
    ? `\n\nCATÁLOGO DE TOURS Y PRODUCTOS DEL HOTEL (excursiones, spa, traslados, upgrades, experiencias — referencia con ids entre corchetes):
${formatMenuForSystemPrompt(menuSlice)}${scopeNote}
- Recomienda según intereses del huésped. Pregunta fecha, número de personas y habitación si aplica.
- Cuando confirmen explícitamente una reserva o compra, incluye al final:
<<<ORDER_JSON>>>{"table":"Habitación o Recepción","items":[{"menuItemId":"id","qty":1,"notes":"fecha, huésped, observaciones"}],"notes":"resumen"}<<<END_ORDER_JSON>>>
- En "table" usa habitación (ej. "Habitación 205"), "Recepción" o "Mostrador N" si conoces el puesto. En notes del ítem: fecha/hora deseada, adultos/niños.
- NO uses ORDER_JSON para comida de restaurante; solo tours y productos del catálogo anterior.`
    : "";

  const stationRule = selected
    ? `MOSTRADORES DE RECEPCIÓN:
- Hay ${stationCount} mostradores o pantallas en lobby/acceso, numerados del 1 al ${stationCount}.
- Mostrador de esta pantalla: ${selected}. Indícalo solo si hace falta (p. ej. derivar a un compañero en otro mostrador).`
    : `MOSTRADORES DE RECEPCIÓN:
- Hay ${stationCount} mostradores o pantallas numerados del 1 al ${stationCount} en el hotel o complejo.`;

  return `Eres la recepcionista virtual de "${orgName}" en la recepción de un HOTEL o COMPLEJO PRIVADO (urbanización, condominio, resort residencial con amenidades compartidas).
Te presentas como ${wakeLabel} (recepcionista virtual). El huésped, visitante o residente activa el micrófono diciendo «${wakeLabel}» antes de hablar.

Interpreta el contexto según las instrucciones del lugar y lo que diga la persona:
- Si es HOTEL: reservas, check-in y check-out, habitaciones, desayuno, Wi‑Fi, estacionamiento, late checkout, servicios del hotel (spa, room service si aplica), idioma y facturación.
- Si es COMPLEJO PRIVADO: acceso y visitas, unidad o torre de destino, autorización de ingreso, paquetería, reservas de áreas comunes (parrilla, salón, cancha), horarios de amenidades (piscina, gimnasio), reglas del complejo y contacto con administración o seguridad.

En ambos casos:
- Saluda con cortesía, pide nombre y motivo de la visita cuando haga falta.
- Confirma reservas o citas si el sistema o las instrucciones lo permiten; si no tienes datos, orienta a hablar con recepción humana.
- Da indicaciones claras (ubicación, horarios, normas) sin inventar políticas no indicadas en las instrucciones del local.
- Puedes gestionar TOURS Y PRODUCTOS del hotel (excursiones, spa, paquetes) usando el catálogo cuando exista.
- NO hables de restaurante, mesas de comedor, carta ni cocina salvo que el huésped lo pida aparte.

INSTRUCCIONES ADICIONALES DEL HOTEL O COMPLEJO:
${forceEnglish ? `(Nota: el visitante usa inglés en este turno; ignora indicaciones de responder solo en español.)\n` : ""}${store.settings.assistantExtraInstructions}

${buildLanguageInstructionsForPrompt()}

${stationRule}${catalogBlock}

REGLA DE PRECIOS: No verbalices importes salvo que pregunten explícitamente o confirmes una reserva de tour/producto.`;
}

function buildSystemPrompt(messages, menu, opts = {}) {
  if (opts.appMode === "reception") {
    return buildReceptionSystemPrompt(messages, menu, opts);
  }
  const forceEnglish = Boolean(opts.forceEnglish);
  const { items: menuSlice, scopeNote } = selectMenuItemsForPrompt(messages, menu);
  const anyUnavailable = menu.some((m) => m.available === false);
  const menuText = formatMenuForSystemPrompt(menuSlice);
  const flowText = flowToPrompt(store.flow);
  const tableCount = resolveTableCount(store.settings);
  const selected = normalizeSelectedTable(opts.selectedTable, tableCount);
  const stockRule = anyUnavailable
    ? "\n\nREGLA DE STOCK: Los platos marcados como AGOTADO están fuera de carta. No los sugieras ni los confirmes en pedidos; ofrece alternativas del menú disponible."
    : "";
  const tableRule = selected
    ? `MESAS DEL LOCAL:
- El restaurante tiene ${tableCount} mesas numeradas del 1 al ${tableCount}.
- MESA DEL QUIOSCO (ya configurada por el personal): ${formatTableLabel(selected)}. NO preguntes en qué mesa está el cliente ni repitas ese dato al inicio; asume esa mesa para el pedido.
- Si el flujo conversacional incluye «preguntar mesa» o bienvenida con mesa, omite esa pregunta y continúa con menú o pedido.
- En ORDER_JSON usa siempre "table":"${formatTableLabel(selected)}" salvo que el cliente pida explícitamente cambiar a otra mesa válida (1–${tableCount}).`
    : `MESAS DEL LOCAL:
- El restaurante tiene ${tableCount} mesas numeradas del 1 al ${tableCount}.
- El personal asigna la mesa del quiosco en Administración → Configuración IA; si no hay mesa asignada, pregunta en qué mesa está (solo números del 1 al ${tableCount}).
- En ORDER_JSON el campo table debe ser "Mesa N" con N entre 1 y ${tableCount} cuando la mesa esté clara; vacío solo si aún no se conoce.`;
  const priceRule = `REGLA DE PRECIOS (obligatoria con el cliente):
- No verbalices ni escribas importes monetarios concretos (cifras con decimales de dinero, "$", "cuesta X", totales) mientras el cliente explora u ordena, salvo que pregunte explícitamente por precios o por un desglose económico (p. ej. "cuánto cuesta", "precios", "how much", "prices", "what does it cost").
- En el quiosco el cliente ya ve foto, nombre y precio en la carta en pantalla: guía por categorías, ingredientes, alérgenos y recomendaciones sin repetir importes.
- Cuando el pedido esté totalmente confirmado y vayas a emitir el bloque ORDER_JSON, puedes cerrar con un resumen breve que incluya importes o total si encaja en la confirmación.`;

  const wake = resolveWakeWord(store.settings);
  const wakeLabel = displayWakeWord(wake);
  const kitchenOrders = Array.isArray(opts.kitchenOrders) ? opts.kitchenOrders : [];
  const kitchenBlock = kitchenOrders.length
    ? `\n\nESTADO EN COCINA (fuente oficial en tiempo real — prioridad absoluta):
${formatKitchenOrdersForPrompt(kitchenOrders)}
Si el cliente pregunta cómo va su pedido, si está listo, en preparación, etc., responde usando EXACTAMENTE estos estados. No contradigas este bloque ni inventes estados basados en mensajes anteriores del chat.`
    : "";

  return `Eres el mesero virtual de "${store.settings.restaurantName}".
Te presentas como ${wakeLabel} (mesero/a virtual). En el quiosco el cliente activa el micrófono diciendo la palabra «${wakeLabel}» antes de su pedido.

BIENVENIDA (primer turno o solo saludo): responde con calidez de restaurante — «¡Buenas! Bienvenidos a ${store.settings.restaurantName}», preséntate como ${wakeLabel}, di que es un gusto atenderles y pregunta si quieren recomendación o ya saben qué pedir. No uses «Bienvenido/a» ni barras; no uses frases frías como «¿en qué te puedo ayudar?».

MENÚ por categorías (usa los ids entre corchetes solo al registrar pedidos internamente; al hablar con el cliente usa nombres naturales):
${menuText}${scopeNote}${stockRule}

FLUJO CONVERSACIONAL (guía flexible — adapta al diálogo; no leas los pasos como guion literal):
${flowText}

${buildWaiterHospitalityBlock()}

${buildConversationPhaseHint(messages)}

INSTRUCCIONES ADICIONALES DEL LOCAL:
${forceEnglish ? `(Nota: el cliente usa inglés en este turno; ignora cualquier indicación de responder solo en español.)\n` : ""}${store.settings.assistantExtraInstructions}

${buildLanguageInstructionsForPrompt()}

${tableRule}

${priceRule}${kitchenBlock}

Mientras el cliente arma el pedido SIN confirmación final, incluye SIEMPRE al final (después de tu mensaje visible) un bloque:
<<<DRAFT_JSON>>>{"items":[{"menuItemId":"id-del-menu","qty":1,"notes":""}]}<<<END_DRAFT_JSON>>>
con TODOS los platos que el cliente pidió o aceptó en este pedido en construcción. Usa el menuItemId exacto del menú de arriba (el id entre corchetes) que corresponda al nombre del plato que mencionó el cliente — no inventes ids ni confundas platos (ej. si pidió habas/choclo, no pongas arroz). Si aún no hay plato concreto, {"items":[]}. No incluyas sugerencias que el cliente no aceptó.
IMPORTANTE — productos con variantes: si el cliente pide algo genérico (ej. «una coca cola», «una cerveza») y en el menú hay varias opciones (lata, zero, 500 ml, etc.), NO pongas todas en DRAFT_JSON. Deja {"items":[]} y pregunta en voz cuál prefiere (tamaño, sabor, presentación). Solo agrega UNA línea cuando el cliente ya especificó la variante o eligió una de tus opciones.

Para registrar un pedido confirmado, cuando el cliente confirme explícitamente, incluye al final un bloque JSON en una sola línea con este formato exacto:
<<<ORDER_JSON>>>{"table":"Mesa X o vacío","items":[{"menuItemId":"m1","qty":2,"notes":"sin cebolla"}],"notes":"notas generales"}<<<END_ORDER_JSON>>>
Solo incluye ese bloque cuando el pedido esté confirmado por el cliente. Tras confirmar, omite DRAFT_JSON o envía {"items":[]}. En ORDER_JSON tampoco incluyas todas las variantes de un producto genérico: solo la que el cliente confirmó.`;
}

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));
app.use(companyContextMiddleware(storeApi));

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    openAiConfigured: Boolean(openAiApiKey()),
    aiboxAuthConfigured: isAiboxAuthConfigured(),
    aiboxRefreshUrl: isAiboxAuthConfigured() ? getAiboxRefreshTokenUrl() : null,
    aiboxOfferingsConfigured: isCommercialOfferingsConfigured(),
    menuCatalogSource: catalogSource(),
  });
});

/** Catálogo comercial AIBox (Bearer en servidor; no expone el token al cliente). */
app.get("/api/aibox/offerings", async (req, res) => {
  if (!isCommercialOfferingsConfigured()) {
    res.status(503).json({
      error:
        "Falta configuración AIBox: AIBOX_AUTH_EMAIL, AIBOX_AUTH_PASSWORD y AIBOX_COMPANY_ID (y opcionalmente AIBOX_API_ORIGIN).",
    });
    return;
  }
  const qCompany = typeof req.query.companyId === "string" ? req.query.companyId.trim() : "";
  const companyId = qCompany || String(process.env.AIBOX_COMPANY_ID ?? "").trim();
  if (!companyId) {
    res.status(400).json({ error: "Falta companyId (query ?companyId= o AIBOX_COMPANY_ID en .env)." });
    return;
  }
  const admin = req.query.admin !== "false";
  try {
    const body = await fetchCommercialOfferings({ companyId, admin });
    res.json(body);
  } catch (e) {
    res.status(502).json({ error: String(e?.message ?? e) });
  }
});

/** Login de usuario (proxy a AIBox security/auth/login). */
app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  try {
    const result = await loginWithCredentials(email, password, { updateServerCache: false });
    let profile = null;
    try {
      profile = await fetchAiboxProfile(result.accessToken);
    } catch (profileErr) {
      console.warn("[auth] Perfil no disponible tras login:", String(profileErr?.message ?? profileErr));
    }
    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      profile,
    });
  } catch (e) {
    const msg = String(e?.message ?? e);
    const status = /obligatorios/i.test(msg) ? 400 : 401;
    res.status(status).json({ error: msg });
  }
});

/** Renueva access token con refresh token del login AIBox. */
app.post("/api/auth/refresh", async (req, res) => {
  const refreshToken = req.body?.refreshToken ?? req.body?.refresh_token;
  if (!refreshToken || typeof refreshToken !== "string") {
    res.status(400).json({ error: "refreshToken requerido en el cuerpo JSON." });
    return;
  }
  try {
    const result = await refreshAiboxTokens(refreshToken);
    let profile = null;
    try {
      profile = await fetchAiboxProfile(result.accessToken);
    } catch (profileErr) {
      console.warn("[auth] Perfil no disponible tras refresh:", String(profileErr?.message ?? profileErr));
    }
    res.json({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      profile,
    });
  } catch (e) {
    const msg = String(e?.message ?? e);
    res.status(401).json({ error: msg });
  }
});

/** Perfil del usuario autenticado (proxy a AIBox security/profile). */
app.get("/api/auth/profile", async (req, res) => {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "No autenticado." });
    return;
  }
  if (isAccessTokenExpired(token)) {
    res.status(401).json({ error: "Sesión expirada. Vuelve a iniciar sesión." });
    return;
  }
  try {
    const profile = await fetchAiboxProfile(token);
    res.json({ profile });
  } catch (e) {
    res.status(502).json({ error: String(e?.message ?? e) });
  }
});

/** Valida Bearer JWT del login AIBox (solo expiración; sin verificar firma). */
app.get("/api/auth/session", async (req, res) => {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ error: "No autenticado." });
    return;
  }
  if (isAccessTokenExpired(token)) {
    res.status(401).json({ error: "Sesión expirada. Vuelve a iniciar sesión.", needsRefresh: true });
    return;
  }
  let profile = null;
  try {
    profile = await fetchAiboxProfile(token);
  } catch {
    /* perfil opcional en verificación de sesión */
  }
  res.json({ ok: true, loginUrl: getAiboxLoginUrl(), profile });
});

/** Valida o renueva sesión: si el access expiró, envía refreshToken en el cuerpo. */
app.post("/api/auth/session", async (req, res) => {
  const refreshFromBody =
    typeof req.body?.refreshToken === "string" ? req.body.refreshToken.trim() : "";
  let token = bearerToken(req);

  if ((!token || isAccessTokenExpired(token)) && refreshFromBody) {
    try {
      const renewed = await refreshAiboxTokens(refreshFromBody);
      token = renewed.accessToken;
      let profile = null;
      try {
        profile = await fetchAiboxProfile(token);
      } catch {
        /* */
      }
      return res.json({
        ok: true,
        loginUrl: getAiboxLoginUrl(),
        accessToken: renewed.accessToken,
        refreshToken: renewed.refreshToken,
        profile,
      });
    } catch (e) {
      return res.status(401).json({ error: String(e?.message ?? e) });
    }
  }

  if (!token) {
    return res.status(401).json({ error: "No autenticado." });
  }
  if (isAccessTokenExpired(token)) {
    return res.status(401).json({ error: "Sesión expirada. Vuelve a iniciar sesión.", needsRefresh: true });
  }

  let profile = null;
  try {
    profile = await fetchAiboxProfile(token);
  } catch {
    /* */
  }
  return res.json({ ok: true, loginUrl: getAiboxLoginUrl(), profile });
});

/** Comprueba la contraseña del candado (hash guardado en configuración, no se expone por GET). */
app.post("/api/auth/verify-admin-exit", (req, res) => {
  const stored = store.settings.adminExitPasswordHash;
  const { password } = req.body || {};
  if (!stored) {
    res.status(503).json({
      error:
        "Aún no hay contraseña del candado. Configúrala en Administración → Configuración IA (sección Candado del mesero).",
    });
    return;
  }
  if (typeof password !== "string" || !verifyAdminExitPasswordPlain(password, stored)) {
    res.status(403).json({ error: "Contraseña incorrecta." });
    return;
  }
  res.json({ ok: true });
});

function allowedMenuCategories() {
  if (!Array.isArray(store.menuCategories) || store.menuCategories.length === 0) {
    return deriveMenuCategoriesFromMenu(store);
  }
  return [...new Set(store.menuCategories.map((s) => String(s).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" }),
  );
}

/** Categorías usadas para filtrar el menú en el prompt (AIBox: derivadas del catálogo activo). */
function categoriesForMenuInference(menu) {
  if (Array.isArray(menu) && menu.length > 0) {
    const fromMenu = [
      ...new Set(menu.map((m) => String(m.category || "").trim()).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
    if (fromMenu.length > 0) return fromMenu;
  }
  return allowedMenuCategories();
}

app.get("/api/menu-categories", async (_req, res) => {
  try {
    const menu = await getResolvedCatalog(store.menu);
    res.json(categoriesForMenuInference(menu));
  } catch (e) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

app.put("/api/menu-categories", (req, res) => {
  if (isCommercialOfferingsConfigured()) {
    res.status(409).json({
      error:
        "El catálogo activo viene de AIBox (commercial/offerings). No se editan categorías locales mientras existan AIBOX_COMPANY_ID y credenciales AIBox.",
    });
    return;
  }
  const body = req.body;
  if (!Array.isArray(body) || !body.every((x) => typeof x === "string")) {
    res.status(400).json({ error: "Se espera un array de nombres (strings)" });
    return;
  }
  const next = [...new Set(body.map((s) => String(s).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" }),
  );
  if (next.length === 0) {
    res.status(400).json({ error: "Debe existir al menos una categoría" });
    return;
  }
  const allowed = new Set(next);
  for (const m of store.menu) {
    const c = String(m.category || "").trim();
    if (!allowed.has(c)) m.category = next[0];
  }
  store.menuCategories = next;
  saveStore();
  broadcast("menuCategories", store.menuCategories);
  broadcast("menu", store.menu);
  res.json(store.menuCategories);
});

/** Imagen de un offering AIBox (JPEG/PNG en base64 guardado al sincronizar el menú). */
app.get("/api/menu/items/:id/image", (req, res) => {
  const img = getOfferingImage(req.params.id);
  if (!img) {
    res.status(404).end();
    return;
  }
  res.setHeader("Content-Type", img.mime);
  res.setHeader("Cache-Control", "no-store, must-revalidate");
  res.setHeader("ETag", `"${img.version}"`);
  res.send(img.buffer);
});

app.get("/api/menu", async (req, res) => {
  try {
    const refresh = req.query.refresh === "1";
    if (refresh) invalidateCatalogCache();
    const menu = await getResolvedCatalog(store.menu, { refresh });
    res.json(sortMenuByCategory(menu));
  } catch (e) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

app.put("/api/menu", (req, res) => {
  if (isCommercialOfferingsConfigured()) {
    res.status(409).json({
      error:
        "El catálogo activo viene de AIBox (productos y precios). No se puede guardar menú local mientras existan AIBOX_COMPANY_ID y credenciales AIBox. Quita esas variables o usa GET /api/menu?refresh=1 para refrescar caché.",
    });
    return;
  }
  const body = req.body;
  if (!Array.isArray(body)) {
    res.status(400).json({ error: "Se espera un array de platos" });
    return;
  }
  for (const m of body) {
    const cat = String(m.category ?? "").trim();
    if (!cat) {
      res.status(400).json({
        error: `Cada plato debe tener categoría (vacía en "${String(m.name || "").trim() || m.id}").`,
      });
      return;
    }
  }
  store.menu = sortMenuByCategory(
    body.map((m) => {
      const row = { ...m, available: m.available !== false };
      if (typeof m.imageUrl === "string") {
        const u = m.imageUrl.trim();
        if (u) row.imageUrl = u;
        else delete row.imageUrl;
      } else {
        delete row.imageUrl;
      }
      return row;
    }),
  );
  store.menuCategories = [
    ...new Set(store.menu.map((m) => String(m.category || "").trim()).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  if (!store.menuCategories.length) store.menuCategories = ["General"];
  saveStore();
  broadcast("menu", store.menu);
  broadcast("menuCategories", store.menuCategories);
  res.json(store.menu);
});

app.get("/api/tables/bills", async (_req, res) => {
  try {
    res.json(await tableBillsPayload());
  } catch (e) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

app.get("/api/tables/:num/bill", async (req, res) => {
  const tableCount = resolveTableCount(store.settings);
  const num = parseTableNumber(req.params.num, tableCount);
  if (!num) {
    res.status(400).json({ error: "Número de mesa no válido" });
    return;
  }
  try {
    const bills = await tableBillsPayload();
    const bill = bills.find((b) => b.tableNumber === num);
    if (!bill) {
      res.json({
        tableNumber: num,
        tableLabel: `Mesa ${num}`,
        lines: [],
        total: 0,
        orderIds: [],
        paymentRequested: false,
        paymentRequestedAt: null,
        itemCount: 0,
      });
      return;
    }
    res.json(bill);
  } catch (e) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

app.post("/api/tables/:num/request-payment", (req, res) => {
  const tableCount = resolveTableCount(store.settings);
  const num = parseTableNumber(req.params.num, tableCount);
  if (!num) {
    res.status(400).json({ error: "Número de mesa no válido" });
    return;
  }
  const body = req.body || {};
  const flow = startPaymentFlow(num, store.tablePaymentRequests?.[String(num)]);
  if (body.billingType || body.customer) {
    Object.assign(flow, {
      phase: body.phase || (body.billingType ? "ready" : flow.phase),
      billingType: body.billingType ?? flow.billingType,
      customer: body.customer ?? flow.customer,
    });
  }
  setTablePaymentRequest(store, num, flow);
  saveStore();
  broadcastTableBills();
  res.json({ ok: true, tableNumber: num, paymentRequest: store.tablePaymentRequests[String(num)] });
});

app.patch("/api/tables/:num/payment-request", (req, res) => {
  const tableCount = resolveTableCount(store.settings);
  const num = parseTableNumber(req.params.num, tableCount);
  if (!num) {
    res.status(400).json({ error: "Número de mesa no válido" });
    return;
  }
  const patch = req.body?.paymentRequest ?? req.body ?? {};
  const prev = normalizePaymentRequest(store.tablePaymentRequests?.[String(num)]);
  const next = {
    ...prev,
    ...patch,
    requestedAt: patch.requestedAt ?? prev.requestedAt ?? new Date().toISOString(),
  };
  if (next.phase === "idle") {
    delete store.tablePaymentRequests[String(num)];
  } else {
    setTablePaymentRequest(store, num, next);
  }
  saveStore();
  broadcastTableBills();
  res.json({ ok: true, tableNumber: num, paymentRequest: store.tablePaymentRequests[String(num)] ?? null });
});

app.post("/api/tables/:num/mark-paid", async (req, res) => {
  const tableCount = resolveTableCount(store.settings);
  const num = parseTableNumber(req.params.num, tableCount);
  if (!num) {
    res.status(400).json({ error: "Número de mesa no válido" });
    return;
  }
  try {
    const bills = await tableBillsPayload();
    const bill = bills.find((b) => b.tableNumber === num);
    const payReq = normalizePaymentRequest(store.tablePaymentRequests?.[String(num)]);
    let paymentRecord = null;
    let invoice = null;
    if (bill && (bill.lines.length > 0 || (bill.total ?? 0) > 0)) {
      const ctx = getCompanyContext();
      bill.companyId = ctx?.companyId ?? null;
      bill.branchId = ctx?.branchId ?? null;
      paymentRecord = recordPaymentHistory(store, bill);
      if (paymentRecord?.id) {
        payReq.paymentId = paymentRecord.id;
      }
      if (billingClient.isBillingConfigured() && payReq.phase === "ready") {
        try {
          const billingType = payReq.billingType || "consumidor_final";
          const emitNow =
            req.body?.emitInvoice !== false && billingType === "consumidor_final";
          const lines = bill.lines.map((l) => ({
            code: l.menuItemId,
            description: l.name,
            quantity: l.qty,
            unitPrice: l.unitPrice ?? 0,
            lineTotal: l.lineTotal,
          }));
          const result = await billingClient.emitInvoiceComplete(
            {
              externalId: paymentRecord?.id ?? `mesa-${num}-${Date.now()}`,
              companyId: bill.companyId,
              branchId: bill.branchId,
              tableNumber: num,
              tableLabel: bill.tableLabel,
              billingType,
              customer: payReq.customer,
              lines,
              totals: { total: bill.total },
              metadata: { source: "mesero-server", tableNumber: num },
            },
            { draftOnly: !emitNow },
          );
          invoice = result.invoice;
          payReq.invoiceId = result.invoice?.id ?? null;
        } catch (e) {
          console.warn("[mark-paid] facturación:", e.message);
        }
      }
    }
    markTablePaid(store, num, tableCount);
    saveStore();
    broadcast("orders", store.orders);
    broadcastTableBills();
    if (paymentRecord) broadcast("paymentHistory", listPaymentHistory(store, { limit: 50 }).items);
    res.json({ ok: true, tableNumber: num, payment: paymentRecord, invoice });
  } catch (e) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

app.get("/api/billing/config", async (_req, res) => {
  try {
    if (!billingClient.isBillingConfigured()) {
      res.json({ configured: false, config: null });
      return;
    }
    const data = await billingClient.getBillingConfig();
    res.json({ configured: true, ...data });
  } catch (e) {
    res.status(502).json({ error: String(e?.message ?? e) });
  }
});

app.put("/api/billing/config", async (req, res) => {
  try {
    const data = await billingClient.saveBillingConfig(req.body?.config ?? req.body ?? {});
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: String(e?.message ?? e) });
  }
});

const billingCertUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.post(
  "/api/billing/config/certificate",
  billingCertUpload.single("certificate"),
  async (req, res) => {
    try {
      if (!billingClient.isBillingConfigured()) {
        res.status(503).json({ error: "Módulo de facturación no configurado" });
        return;
      }
      if (!req.file) {
        res.status(400).json({ error: "Seleccione un archivo .p12 o .pfx" });
        return;
      }
      const data = await billingClient.uploadBillingCertificate(
        req.file.buffer,
        req.file.originalname,
        req.body?.certificatePassword,
      );
      res.json(data);
    } catch (e) {
      res.status(e.status || 502).json({ error: String(e?.message ?? e) });
    }
  },
);

app.get("/api/billing/invoices", async (req, res) => {
  try {
    const data = await billingClient.listInvoices({
      status: req.query.status ? String(req.query.status) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 50,
    });
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: String(e?.message ?? e) });
  }
});

app.post("/api/billing/invoices/:id/emit", async (req, res) => {
  try {
    const data = await billingClient.emitInvoice(req.params.id);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: String(e?.message ?? e) });
  }
});

/** Proxy genérico: cualquier cliente con sesión AIBox puede emitir vía mesero-server. */
app.post("/api/billing/invoices/emit", async (req, res) => {
  try {
    if (!billingClient.isBillingConfigured()) {
      res.status(503).json({ error: "Módulo de facturación no configurado (BILLING_URL)" });
      return;
    }
    const data = await billingClient.emitInvoiceComplete(req.body ?? {});
    res.status(data.emitted ? 201 : 202).json(data);
  } catch (e) {
    res.status(e.status || 502).json({
      error: String(e?.message ?? e),
      details: e.details,
    });
  }
});

app.get("/api/billing/schema/emit", async (_req, res) => {
  try {
    const base = (process.env.BILLING_URL || "http://localhost:3042").replace(/\/$/, "");
    const r = await fetch(`${base}/api/v1/schema/emit`);
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (e) {
    res.status(502).json({ error: String(e?.message ?? e) });
  }
});

app.get("/api/payments/history", (req, res) => {
  const limit = req.query.limit;
  const offset = req.query.offset;
  const from = typeof req.query.from === "string" ? req.query.from : undefined;
  const to = typeof req.query.to === "string" ? req.query.to : undefined;
  res.json(listPaymentHistory(store, { limit, offset, from, to }));
});

app.get("/api/payments/history/:id", (req, res) => {
  const entry = getPaymentHistoryEntry(store, req.params.id);
  if (!entry) {
    res.status(404).json({ error: "Cuenta no encontrada" });
    return;
  }
  res.json(entry);
});

app.get("/api/analytics/top-products", async (req, res) => {
  try {
    let menu = store.menu;
    try {
      menu = await getResolvedCatalog(store.menu);
    } catch {
      /* menú local */
    }
    const limit = req.query.limit;
    const products = computeTopProducts(store.orders, menu, { limit });
    const payments = analyticsFromPaymentHistory(store.paymentHistory);
    res.json({ ...products, payments });
  } catch (e) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

app.get("/api/analytics/dashboard", async (req, res) => {
  try {
    let menu = store.menu;
    try {
      menu = await getResolvedCatalog(store.menu);
    } catch {
      /* menú local */
    }
    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const dateFrom = typeof req.query.from === "string" ? req.query.from : undefined;
    const dateTo = typeof req.query.to === "string" ? req.query.to : undefined;
    const dashboard = computeDashboard(store.orders, store.paymentHistory, menu, {
      date,
      dateFrom,
      dateTo,
    });
    res.json({
      ...dashboard,
      restaurantName: store.settings?.restaurantName?.trim() || "Mi restaurante",
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message ?? e) });
  }
});

app.get("/api/flow", (_req, res) => {
  res.json(store.flow);
});

app.put("/api/flow", (req, res) => {
  const { nodes, edges } = req.body || {};
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    res.status(400).json({ error: "nodes y edges deben ser arrays" });
    return;
  }
  store.flow = { nodes, edges };
  saveStore();
  broadcast("flow", store.flow);
  res.json(store.flow);
});

app.get("/api/settings", (_req, res) => {
  res.json(publicSettings());
});

app.put("/api/settings", (req, res) => {
  const body = req.body && typeof req.body === "object" ? { ...req.body } : {};
  const incomingPass = body.adminExitPassword;
  const clearPass = body.adminExitPasswordClear === true;
  delete body.adminExitPassword;
  delete body.adminExitPasswordHash;
  delete body.adminExitPasswordConfigured;
  delete body.adminExitPasswordClear;

  if (typeof incomingPass === "string" && incomingPass.length > 0) {
    store.settings.adminExitPasswordHash = hashAdminExitPassword(incomingPass);
  } else if (clearPass) {
    delete store.settings.adminExitPasswordHash;
  }

  if (body.wakeWord !== undefined) {
    body.wakeWord = normalizeWakeWord(body.wakeWord);
  }

  if (body.tableCount !== undefined) {
    body.tableCount = normalizeTableCount(body.tableCount);
  }
  if (body.kioskTable !== undefined) {
    const tc = resolveTableCount({ ...store.settings, tableCount: body.tableCount ?? store.settings.tableCount });
    body.kioskTable = normalizeSelectedTable(body.kioskTable, tc);
  }

  store.settings = { ...store.settings, ...body };
  store.settings.wakeWord = resolveWakeWord(store.settings);
  store.settings.tableCount = resolveTableCount(store.settings);
  saveStore();
  broadcast("settings", publicSettings());
  res.json(publicSettings());
});

app.get("/api/orders", (_req, res) => {
  res.json(store.orders);
});

app.post("/api/orders", (req, res) => {
  const { table, items, notes, source } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "items requerido" });
    return;
  }
  const order = orderWithCompanyFields({
    id: crypto.randomUUID(),
    table: table || "",
    items,
    notes: notes || "",
    status: "nuevo",
    source: source || "mesero",
    createdAt: new Date().toISOString(),
  });
  store.orders.unshift(order);
  saveStore();
  broadcast("orders", store.orders);
  broadcastTableBills();
  res.json(order);
});

app.patch("/api/orders/:id", (req, res) => {
  const { id } = req.params;
  const idx = store.orders.findIndex((o) => o.id === id);
  if (idx === -1) {
    res.status(404).json({ error: "Pedido no encontrado" });
    return;
  }
  const patch = req.body || {};
  const prev = store.orders[idx];
  const next = { ...prev, ...patch, id };
  if (patch.status !== undefined && patch.status !== prev.status) {
    next.statusChangedAt = new Date().toISOString();
  }
  store.orders[idx] = next;
  saveStore();
  broadcast("orders", store.orders);
  broadcastTableBills();
  res.json(store.orders[idx]);
});

app.delete("/api/orders/:id", (req, res) => {
  const { id } = req.params;
  store.orders = store.orders.filter((o) => o.id !== id);
  saveStore();
  broadcast("orders", store.orders);
  broadcastTableBills();
  res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  const { messages, selectedTable, kitchenOrderIds, appMode } = req.body || {};
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: "messages debe ser un array" });
    return;
  }
  let menu = store.menu;
  try {
    menu = await getResolvedCatalog(store.menu);
  } catch {
    /* menú local */
  }

  try {
    const content = await generateAssistantChatContent(messages, menu, { selectedTable, kitchenOrderIds, appMode });
    res.json({ role: "assistant", content });
  } catch (e) {
    const status = e?.status === 502 ? 502 : 500;
    res.status(status).json({ error: String(e?.message ?? e), detail: e?.message });
  }
});

function resolveStructuredMenuLines(rawItems, menu) {
  const items = Array.isArray(rawItems) ? rawItems : [];
  return items
    .map((it) => {
      const mi = menu.find((m) => m.id === it.menuItemId);
      return {
        menuItemId: String(it.menuItemId ?? "").trim(),
        name: mi?.name || String(it.menuItemId ?? "").trim(),
        qty: Math.max(1, Math.min(99, Math.floor(Number(it.qty)) || 1)),
        notes: it.notes || "",
      };
    })
    .filter((line) => {
      const mi = menu.find((m) => m.id === line.menuItemId);
      return line.menuItemId && mi && mi.available !== false;
    });
}

function extractTaggedJsonBlock(content, tag) {
  const re = new RegExp(`<<<${tag}_JSON>>>([\\s\\S]*?)<<<END_${tag}_JSON>>>`);
  const match = String(content ?? "").match(re);
  if (!match) return { body: null, content: String(content ?? "") };
  return {
    body: match[1],
    content: String(content ?? "").replace(match[0], ""),
  };
}

/** Parse ORDER_JSON from assistant message and persist */
app.post("/api/chat/complete", async (req, res) => {
  const { messages, selectedTable, kitchenOrderIds, appMode } = req.body || {};
  if (!Array.isArray(messages)) {
    res.status(400).json({ error: "messages debe ser un array" });
    return;
  }
  const kioskTable = resolveKioskTable(selectedTable);

  let menu = store.menu;
  try {
    menu = await getResolvedCatalog(store.menu);
  } catch {
    /* menú local */
  }

  const lastUser = lastUserMessageContent(messages);
  const orderCorpus = recentUserOrderCorpus(messages);
  let content = "";
  try {
    content = await generateAssistantChatContent(messages, menu, { selectedTable, kitchenOrderIds, appMode });
  } catch (e) {
    const status = e?.status === 502 ? 502 : 500;
    res.status(status).json({ error: String(e?.message ?? e), detail: e?.message });
    return;
  }

  let draftItems = [];
  if (appMode !== "reception") {
    const draftExtract = extractTaggedJsonBlock(content, "DRAFT");
    content = draftExtract.content;
    if (draftExtract.body != null) {
      try {
        const raw = JSON.parse(draftExtract.body.trim());
        draftItems = filterAmbiguousMenuLines(
          resolveStructuredMenuLines(raw.items, menu).map((line) => ({
            menuItemId: line.menuItemId,
            name: line.name,
            qty: line.qty,
          })),
          menu,
          orderCorpus,
          { mode: "draft" },
        );
      } catch {
        draftItems = [];
      }
    }
  }

  let order = null;
  const match =
    appMode === "reception"
      ? null
      : content.match(/<<<ORDER_JSON>>>([\s\S]*?)<<<END_ORDER_JSON>>>/);
  if (match) {
    try {
      const raw = JSON.parse(match[1].trim());
      let resolved = resolveStructuredMenuLines(raw.items, menu);
      resolved = filterAmbiguousMenuLines(resolved, menu, orderCorpus, { mode: "order" });
      if (resolved.length === 0) {
        order = null;
      } else {
        const table =
          appMode === "reception"
            ? String(raw.table ?? "").trim() ||
              (kioskTable ? `Mostrador ${kioskTable}` : "Recepción")
            : resolveOrderTable(raw.table, kioskTable);
        order = orderWithCompanyFields({
          id: crypto.randomUUID(),
          table,
          items: resolved,
          notes: raw.notes || "",
          status: "nuevo",
          source: appMode === "reception" ? "recepcion" : "ia",
          createdAt: new Date().toISOString(),
        });
        store.orders.unshift(order);
        saveStore();
        broadcast("orders", store.orders);
        broadcastTableBills();
      }
    } catch {
      order = null;
    }
  }

  let paymentFlow = null;
  const tableCount = resolveTableCount(store.settings);
  let paymentTableNum = kioskTable;
  if (!paymentTableNum) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role !== "assistant") continue;
      const om = String(m.content ?? "").match(/<<<ORDER_JSON>>>([\s\S]*?)<<<END_ORDER_JSON>>>/);
      if (om) {
        try {
          const raw = JSON.parse(om[1].trim());
          paymentTableNum = parseTableNumber(raw.table, tableCount);
          if (paymentTableNum) break;
        } catch {
          /* */
        }
      }
    }
  }

  const activePayReq =
    paymentTableNum != null
      ? normalizePaymentRequest(store.tablePaymentRequests?.[String(paymentTableNum)])
      : null;

  if (appMode !== "reception" && paymentTableNum) {
    const wantsPay = /\b(quiero pagar|la cuenta|pedir la cuenta|cuenta por favor|traer la cuenta)\b/i.test(
      lastUser,
    );
    const inFlow = activePayReq?.phase && activePayReq.phase !== "idle" && activePayReq.phase !== "invoiced";

    if (wantsPay && (!activePayReq?.phase || activePayReq.phase === "idle")) {
      const flow = startPaymentFlow(paymentTableNum, activePayReq);
      setTablePaymentRequest(store, paymentTableNum, flow);
      saveStore();
      broadcastTableBills();
      paymentFlow = { tableNumber: paymentTableNum, ...flow };
      content =
        `Claro, preparo el cierre de cuenta. ¿Desea **consumidor final** o **factura** con sus datos (RUC/cédula, razón social y correo)?`;
    } else if (inFlow) {
      const { request: nextReq, assistantReply, done } = advancePaymentFlow({
        userText: lastUser,
        request: activePayReq,
      });
      setTablePaymentRequest(store, paymentTableNum, nextReq);
      if (done && nextReq.phase === "ready") {
        requestTablePayment(store, paymentTableNum, nextReq);
      }
      saveStore();
      broadcastTableBills();
      paymentFlow = { tableNumber: paymentTableNum, ...nextReq };
      if (assistantReply) content = assistantReply;
    }
  }

  const visible = content
    .replace(/<<<ORDER_JSON>>>[\s\S]*?<<<END_ORDER_JSON>>>/, "")
    .replace(/<<<DRAFT_JSON>>>[\s\S]*?<<<END_DRAFT_JSON>>>/, "")
    .trim();
  res.json({
    role: "assistant",
    content: visible,
    draftItems,
    order,
    paymentFlow: paymentFlow
      ? {
          tableNumber: paymentFlow.tableNumber ?? paymentTableNum,
          phase: paymentFlow.phase,
          billingType: paymentFlow.billingType,
          customer: paymentFlow.customer,
          invoiceId: paymentFlow.invoiceId ?? null,
        }
      : null,
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (ws, req) => {
  clients.add(ws);
  void (async () => {
    const url = new URL(req.url || "/ws", "http://127.0.0.1");
    const qCompany = url.searchParams.get("companyId")?.trim() || "";
    const companyId = qCompany || String(process.env.AIBOX_COMPANY_ID ?? "").trim();
    if (!companyId) {
      ws.close(4400, "Falta companyId en ?companyId=");
      clients.delete(ws);
      return;
    }
    ws.companyId = companyId;
    const slice = storeApi.get(companyId);
    companyStorage.run(
      {
        companyId,
        branchId: null,
        accessToken: null,
        store: slice,
        save: () => storeApi.persist(companyId, slice),
      },
      async () => {
        let menu = store.menu;
        try {
          menu = await getResolvedCatalog(store.menu);
        } catch {
          /* menú local */
        }
        const menuCategories = categoriesForMenuInference(menu);
        const tableBills = computeTableBills(
          {
            orders: store.orders,
            tablePaymentRequests: store.tablePaymentRequests,
            tableCount: resolveTableCount(store.settings),
          },
          menu,
        );
        const paymentHistory = listPaymentHistory(store, { limit: 50 }).items;
        ws.send(
          JSON.stringify({
            type: "snapshot",
            payload: {
              companyId,
              menu,
              menuCategories,
              flow: store.flow,
              orders: store.orders,
              tableBills,
              paymentHistory,
              settings: publicSettings(),
            },
            at: new Date().toISOString(),
          }),
        );
      },
    );
  })();
  ws.on("close", () => clients.delete(ws));
});

server.listen(PORT, () => {
  console.log(`mesero-server http://localhost:${PORT}`);
  console.log(`SQLite: ${storeApi.dbPath}`);
  if (openAiApiKey()) {
    console.log("OpenAI: OPENAI_API_KEY cargada (chat con modelo completo).");
  } else {
    console.log(
      "OpenAI: no hay OPENAI_API_KEY usable en .env (solo espacios o ausente). Colócala en la raíz del monorepo y reinicia el servidor.",
    );
  }
});
