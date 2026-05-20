import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

/**
 * Persistencia por empresa (companyId de AIBox) en SQLite.
 * Cada fila guarda el slice completo (menú, pedidos, settings, …) como JSON.
 */

function normalizeCompanySlice(slice, defaultSlice) {
  const def = defaultSlice();
  slice.settings = { ...def.settings, ...(slice.settings || {}) };
  if (!Array.isArray(slice.menu)) slice.menu = [];
  if (!Array.isArray(slice.orders)) slice.orders = [];
  if (!Array.isArray(slice.paymentHistory)) slice.paymentHistory = [];
  if (!slice.tablePaymentRequests || typeof slice.tablePaymentRequests !== "object") {
    slice.tablePaymentRequests = {};
  }
  if (!Array.isArray(slice.menuCategories) || slice.menuCategories.length === 0) {
    slice.menuCategories = def.menuCategories;
  }
  if (!slice.flow?.nodes) slice.flow = def.flow;
  return slice;
}

function readLegacyJson(jsonPath, defaultSlice) {
  if (!fs.existsSync(jsonPath)) return null;
  const parsed = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  if (parsed?.version === 2 && parsed.companies && typeof parsed.companies === "object") {
    return parsed.companies;
  }
  const legacy = { ...defaultSlice(), ...parsed };
  legacy.settings = { ...defaultSlice().settings, ...(parsed.settings || {}) };
  const migrateId = String(process.env.AIBOX_COMPANY_ID ?? "").trim() || "_migrated";
  return { [migrateId]: legacy };
}

function jsonImportCandidates(jsonPath) {
  const out = [];
  if (fs.existsSync(jsonPath)) out.push(jsonPath);
  const bak = `${jsonPath}.migrated.bak`;
  if (fs.existsSync(bak)) out.push(bak);
  return out;
}

function migrateJsonToDb(db, jsonPath, defaultSlice) {
  const count = db.prepare("SELECT COUNT(*) AS n FROM company_slices").get().n;
  if (count > 0) return 0;

  let companies = null;
  let importedFrom = "";
  for (const candidate of jsonImportCandidates(jsonPath)) {
    try {
      companies = readLegacyJson(candidate, defaultSlice);
      if (companies && Object.keys(companies).length > 0) {
        importedFrom = candidate;
        break;
      }
    } catch {
      /* siguiente candidato */
    }
  }
  if (!companies || Object.keys(companies).length === 0) return 0;

  const insert = db.prepare(
    `INSERT INTO company_slices (company_id, payload, updated_at)
     VALUES (?, ?, datetime('now'))`,
  );
  const tx = db.transaction((entries) => {
    for (const [id, slice] of entries) {
      insert.run(id, JSON.stringify(slice));
    }
  });
  tx(Object.entries(companies));

  if (importedFrom === jsonPath) {
    const backup = `${jsonPath}.migrated.bak`;
    try {
      if (fs.existsSync(backup)) fs.unlinkSync(backup);
      fs.renameSync(jsonPath, backup);
    } catch {
      /* conservar store.json si no se puede renombrar */
    }
  }
  return Object.keys(companies).length;
}

/** @param {() => object} defaultSlice */
export function createCompanyStore({ filePath, dbPath, defaultSlice }) {
  const jsonLegacyPath = filePath;
  const databasePath =
    dbPath ||
    process.env.MESERO_DB_PATH ||
    path.join(path.dirname(filePath), "mesero.db");

  const dir = path.dirname(databasePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS company_slices (
      company_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_company_slices_updated ON company_slices(updated_at);
  `);

  const migrated = migrateJsonToDb(db, jsonLegacyPath, defaultSlice);
  if (migrated > 0) {
    console.log(
      `[mesero-server] Migrados ${migrated} empresa(s) de store.json → SQLite (${databasePath})`,
    );
  }

  const selectStmt = db.prepare("SELECT payload FROM company_slices WHERE company_id = ?");
  const upsertStmt = db.prepare(
    `INSERT INTO company_slices (company_id, payload, updated_at)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(company_id) DO UPDATE SET
       payload = excluded.payload,
       updated_at = datetime('now')`,
  );
  const listStmt = db.prepare("SELECT company_id FROM company_slices ORDER BY company_id");

  function ensureCompany(companyId) {
    const id = String(companyId ?? "").trim();
    if (!id) return null;

    const row = selectStmt.get(id);
    if (!row) {
      const slice = defaultSlice();
      upsertStmt.run(id, JSON.stringify(slice));
      return slice;
    }

    try {
      const slice = normalizeCompanySlice(JSON.parse(row.payload), defaultSlice);
      return slice;
    } catch {
      const slice = defaultSlice();
      upsertStmt.run(id, JSON.stringify(slice));
      return slice;
    }
  }

  return {
    dbPath: databasePath,
    get(companyId) {
      return ensureCompany(companyId);
    },
    persist(companyId, slice) {
      const id = String(companyId ?? "").trim();
      if (!id) return;
      upsertStmt.run(id, JSON.stringify(slice));
    },
    listCompanyIds() {
      return listStmt.all().map((r) => r.company_id);
    },
    close() {
      db.close();
    },
  };
}
