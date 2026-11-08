export const SCHEMA = "afs-diego-v1";
export const STORAGE_KEY = "afs-diego-v1";

const FORBIDDEN = new Set(["__proto__", "prototype", "constructor"]);

function badKeys(value) {
  if (!value || typeof value !== "object") return false;
  for (const key of Object.keys(value)) {
    if (FORBIDDEN.has(key)) return true;
    if (badKeys(value[key])) return true;
  }
  return false;
}

function safeString(value, max) {
  return typeof value === "string" && value.length <= max && !value.includes("\u0000") && !/[<>]/.test(value);
}

function isLine(value) {
  return value && safeString(value.label, 80) && safeString(value.value, 240);
}

function isCard(value) {
  return (
    value &&
    safeString(value.title, 180) &&
    safeString(value.badge, 80) &&
    Array.isArray(value.lines) &&
    value.lines.length <= 16 &&
    value.lines.every(isLine)
  );
}

function isTrace(value) {
  if (!value || typeof value !== "object") return false;
  const strings = ["sourceFile", "fixtureId", "referenceDate", "timeZone", "period", "formula", "result", "sampleCount", "matchedCount", "asideFormula", "asideResult"];
  for (const key of strings) {
    if (value[key] !== undefined && !safeString(value[key], 4000)) return false;
  }
  if (!Array.isArray(value.filters) || value.filters.some((item) => !safeString(item, 400))) return false;
  if (!Array.isArray(value.includedIds) || value.includedIds.some((id) => !/^[a-z0-9_]+$/.test(id))) return false;
  if (!Array.isArray(value.excluded)) return false;
  return value.excluded.every(
    (item) => item && /^[a-z0-9_]+$/.test(item.id) && safeString(item.reason, 160),
  );
}

export function isView(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || badKeys(value)) return false;
  if (value.kind !== "local-rules-v1") return false;
  if (!["answer", "clarify", "refuse", "fallback", "empty", "error"].includes(value.tone)) return false;
  if (!safeString(value.title, 180)) return false;
  if (!Array.isArray(value.blocks) || value.blocks.length > 40) return false;
  if (!Array.isArray(value.suggestions) || value.suggestions.length > 8) return false;
  if (value.suggestions.some((item) => !safeString(item, 80))) return false;
  return value.blocks.every((block) => {
    if (!block || typeof block !== "object") return false;
    if (block.type === "paragraph") return safeString(block.text, 2000);
    if (block.type === "cards") return Array.isArray(block.items) && block.items.length <= 20 && block.items.every(isCard);
    if (block.type === "groups") {
      return (
        Array.isArray(block.items) &&
        block.items.length <= 12 &&
        block.items.every((item) => safeString(item.label, 80) && safeString(item.value, 80) && safeString(item.note, 2000))
      );
    }
    if (block.type === "trace") return isTrace(block.trace);
    return false;
  });
}

function isUserText(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 4000 && !value.includes("\u0000");
}

function isMessage(value) {
  if (!value || typeof value !== "object" || badKeys(value)) return false;
  if (!/^m_[a-z0-9_-]+$/i.test(value.id)) return false;
  if (value.role === "user") return isUserText(value.text) && value.view == null;
  if (value.role === "assistant") return isView(value.view);
  return false;
}

function isConversation(value) {
  if (!value || typeof value !== "object" || badKeys(value)) return false;
  if (!/^c_[a-z0-9_-]+$/i.test(value.id)) return false;
  if (typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt))) return false;
  if (!safeString(value.title, 80)) return false;
  if (!Array.isArray(value.messages) || value.messages.length > 40) return false;
  return value.messages.every(isMessage);
}

export function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return map.has(key) ? map.get(key) : null;
    },
    setItem(key, value) {
      map.set(key, String(value));
    },
    removeItem(key) {
      map.delete(key);
    },
  };
}

export function freshState() {
  return { schema: SCHEMA, activeId: null, conversations: [], notice: "" };
}

export function sanitizeState(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) || badKeys(input)) {
    return { ok: false, reason: "tipo" };
  }
  if (input.schema !== SCHEMA) return { ok: false, reason: "schema" };
  if (!Array.isArray(input.conversations) || input.conversations.length > 20) {
    return { ok: false, reason: "conversas" };
  }
  if (!input.conversations.every(isConversation)) return { ok: false, reason: "mensagem" };
  if (input.activeId !== null && !input.conversations.some((item) => item.id === input.activeId)) {
    return { ok: false, reason: "ativa" };
  }
  return {
    ok: true,
    state: {
      schema: SCHEMA,
      activeId: input.activeId,
      conversations: input.conversations,
      notice: "",
    },
  };
}

export function loadState(storage) {
  const empty = freshState();
  let raw = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { ...empty, notice: "Não li o histórico deste navegador. A conversa fica só na memória desta visita." };
  }
  if (!raw) return empty;
  try {
    const parsed = JSON.parse(raw);
    const clean = sanitizeState(parsed);
    if (!clean.ok) {
      try {
        storage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      return {
        ...empty,
        notice: "O histórico local foi descartado porque não passou na validação. A amostra financeira não muda com isso.",
      };
    }
    return clean.state;
  } catch {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    return {
      ...empty,
      notice: "O histórico local estava ilegível e foi descartado. A amostra financeira não muda com isso.",
    };
  }
}

export function saveState(storage, state) {
  const clean = sanitizeState(state);
  if (!clean.ok) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(clean.state));
    return true;
  } catch {
    return false;
  }
}
