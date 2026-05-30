import { useEffect, type Dispatch, type SetStateAction } from "react";
import type { MenuItem } from "../lib/types";
import { findAmbiguousProductGroups } from "../lib/orderDraftAmbiguity";
import { collapseVariantLines, dedupeAmbiguousGroups } from "../lib/variantCollapse";
import { buildOrderInferenceCorpusForDraft } from "../lib/orderDraftCorpus";
import { assistantConfirmsOrderItems, stripAssistantTags } from "../lib/orderDraftConfirm";
import { inferLineItemsFromCorpus } from "../lib/inferLineItems";
import { mergeDraftInputs, type DraftLineInput } from "../lib/orderDisplayLines";
import { stripWakeWordFromUtterance } from "../lib/speechLocale";
import type { MeseroMsg } from "../lib/meseroSessionStorage";

const REMOVE_RE =
  /\b(quita|quitar|elimina|eliminar|saca|sacar|cancela|cancelar|borra|borrar|no quiero|sin el|sin la|ya no)\b/i;

function applyRemovalsFromLastUser(
  draft: DraftLineInput[],
  messages: MeseroMsg[],
  menu: MenuItem[],
  wakeWord: string,
): DraftLineInput[] {
  const users = messages.filter((m) => m.role === "user");
  const last = stripWakeWordFromUtterance(users[users.length - 1]?.content ?? "", wakeWord);
  if (!last || !REMOVE_RE.test(last)) return draft;

  const hay = last
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return draft.filter((line) => {
    const m = menu.find((x) => x.id === line.menuItemId);
    const name = (m?.name ?? line.name).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
    const tokens = name.split(/\s+/).filter((w) => w.length >= 4);
    const hit = tokens.some((t) => hay.includes(t));
    return !hit;
  });
}

type SyncTarget = {
  messages: MeseroMsg[];
  draftEpochMs: number;
  wakeWord: string;
  setPendingDraft: Dispatch<SetStateAction<DraftLineInput[]>>;
  setPendingAmbiguous: Dispatch<SetStateAction<{ label: string; options: string[] }[]>>;
};

/**
 * Mantiene el borrador alineado con lo que dice el cliente entre turnos (antes y después de la API).
 */
export function useLocalOrderDraftSync(menu: MenuItem[], target: SyncTarget) {
  const { messages, draftEpochMs, wakeWord, setPendingDraft, setPendingAmbiguous } = target;

  useEffect(() => {
    if (!menu.length) return;

    const last = messages[messages.length - 1];
    let corpus = buildOrderInferenceCorpusForDraft(messages, draftEpochMs, wakeWord);
    if (last?.role === "assistant") {
      const assistVisible = stripAssistantTags(last.content);
      if (!assistantConfirmsOrderItems(assistVisible)) return;
      const userCorpus = buildOrderInferenceCorpusForDraft(
        messages.slice(0, -1),
        draftEpochMs,
        wakeWord,
      );
      corpus = `${userCorpus} ${assistVisible}`.replace(/\s+/g, " ").trim();
    }
    const inferred = collapseVariantLines(
      inferLineItemsFromCorpus(corpus, menu.filter((m) => m.available !== false)),
      menu,
      corpus,
    );
    const ambiguous = dedupeAmbiguousGroups(findAmbiguousProductGroups(corpus, menu));

    setPendingDraft((prev) => {
      const afterRemoval = applyRemovalsFromLastUser(prev, messages, menu, wakeWord);
      if (inferred.length === 0) return afterRemoval;
      const users = messages.filter((m) => m.role === "user");
      const lastUser = stripWakeWordFromUtterance(users[users.length - 1]?.content ?? "", wakeWord);
      const assistVisible =
        last?.role === "assistant" ? stripAssistantTags(last.content) : "";
      const repeatHay =
        last?.role === "assistant" && assistantConfirmsOrderItems(assistVisible)
          ? `${lastUser} ${assistVisible}`.trim()
          : lastUser;
      return mergeDraftInputs(afterRemoval, inferred, {
        lastUtterance: repeatHay,
        menu,
        userHay: corpus,
        lastUserHay: lastUser,
        assistantHay: assistantConfirmsOrderItems(assistVisible) ? assistVisible : "",
      });
    });

    setPendingAmbiguous((prev) => {
      if (ambiguous.length > 0) return ambiguous;
      if (inferred.length > 0 && prev.length > 0) return [];
      return prev;
    });
  }, [messages, draftEpochMs, wakeWord, menu, setPendingDraft, setPendingAmbiguous]);
}
