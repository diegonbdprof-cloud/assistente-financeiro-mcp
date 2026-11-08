import { CATEGORIES, FIXTURE_META } from "../data/fixture.js";
import {
  addDays,
  monthRange,
  parseFlexibleDate,
  previousMonth,
  weekRangeMonday,
} from "./dates.js";
import { lastDaysRange } from "./ledger.js";

const MONTHS = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

const NEGATION = new Set(["nao", "nunca", "jamais", "sem"]);
const FILLERS = new Set([
  "quero",
  "queria",
  "precisa",
  "preciso",
  "por",
  "favor",
  "mostrar",
  "mostra",
  "mostre",
  "exibir",
  "exibe",
  "ver",
  "veja",
  "calcular",
  "calcule",
  "trazer",
  "traga",
  "o",
  "a",
  "os",
  "as",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "um",
  "uma",
  "me",
  "meu",
  "minha",
  "lhe",
  "ai",
]);

const DATE_TOKEN = "\\d{2}/\\d{2}/\\d{4}|\\d{4}-\\d{2}-\\d{2}";

export function normalize(raw) {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9/\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function shouldDropUserText(raw) {
  const text = normalize(raw);
  if (/\b(senha|password|cvv|cpf)\b/.test(text)) return true;
  if (/\d(?:[ -]?\d){12,18}/.test(String(raw ?? ""))) return true;
  if (/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/.test(String(raw ?? ""))) return true;
  return false;
}

function categoryWords() {
  const words = new Set();
  for (const category of Object.values(CATEGORIES)) {
    for (const word of category.words) words.add(word);
  }
  return words;
}

const CATEGORY_WORD_SET = categoryWords();

function topicForToken(token) {
  if (/^saldos?$/.test(token)) return "saldo";
  if (/^contas?$/.test(token)) return "conta";
  if (/^(transacoes?|extrato|lancamentos?|movimentacoes?)$/.test(token)) return "transacao";
  if (token === "resumo") return "resumo";
  if (CATEGORY_WORD_SET.has(token)) return "categoria";
  return null;
}

function scanNegation(text) {
  const stripped = text.replace(/\bnao informad[oa]s?\b/g, " ").replace(/\s+/g, " ").trim();
  const words = stripped.split(" ").filter(Boolean);
  const topics = new Set();
  let unattached = false;
  for (let i = 0; i < words.length; i += 1) {
    if (!NEGATION.has(words[i])) continue;
    let attached = false;
    if (i > 0 && words[i] !== "sem") {
      const previous = topicForToken(words[i - 1]);
      if (previous) {
        topics.add(previous);
        attached = true;
      }
    }
    for (let j = i + 1; j < words.length && j <= i + 5; j += 1) {
      if (FILLERS.has(words[j])) continue;
      const next = topicForToken(words[j]);
      if (next) {
        topics.add(next);
        attached = true;
      }
      break;
    }
    if (!attached && words[i] !== "sem") unattached = true;
  }
  return { topics, unattached };
}

function findCategories(text) {
  const found = [];
  for (const [id, category] of Object.entries(CATEGORIES)) {
    for (const word of category.words) {
      const pattern = new RegExp(`(?:^|\\s)${word.replace(/ /g, "\\s+")}(?:\\s|$)`);
      if (pattern.test(` ${text} `)) {
        found.push(id);
        break;
      }
    }
  }
  return found;
}

function extractAccounts(text) {
  const business = /\b(business|empresarial)\b/.test(text) || /\bplaid business\b/.test(text);
  const saving = /\b(poupanca|saving|savings)\b/.test(text);
  const checking = /\b(checking|corrente)\b/.test(text);
  const personal =
    /\bpessoal\b/.test(text) || (/\bplaid credit card\b/.test(text) && !business);
  const hits = [];
  if (business) hits.push("acc_business_credit");
  if (saving) hits.push("acc_saving");
  if (checking) hits.push("acc_checking");
  if (personal) hits.push("acc_credit");
  if (hits.length > 0) return { status: "some", accountIds: hits };
  if (/\b(cartao|cartoes|credito|credit)\b/.test(text)) return { status: "ambiguous-card" };
  const named = text.match(/\bconta\s+([a-z]{4,})\b/);
  if (named && !["para", "corrente", "poupanca"].includes(named[1])) {
    return { status: "unknown", word: named[1] };
  }
  return { status: "all", accountIds: null };
}

function pushPeriod(bucket, period) {
  bucket.push(period);
}

function extractPeriod(text) {
  const ref = FIXTURE_META.referenceDate;
  const refParts = {
    y: Number(ref.slice(0, 4)),
    m: Number(ref.slice(5, 7)),
    d: Number(ref.slice(8, 10)),
  };
  const periods = [];
  let error = null;

  const range = text.match(
    new RegExp(`\\b(?:entre|de)\\s+(${DATE_TOKEN})\\s+(?:e|a|ate)\\s+(${DATE_TOKEN})\\b`),
  );
  if (range) {
    const start = parseFlexibleDate(range[1]);
    const end = parseFlexibleDate(range[2]);
    if (!start || !end) error = "bad-date";
    else if (start > end) error = "inverted";
    else pushPeriod(periods, { start, end, label: null });
  }

  const single = text.match(new RegExp(`\\b(?:no dia|dia)\\s+(${DATE_TOKEN})\\b`));
  const singleEm = text.match(new RegExp(`\\bem\\s+(${DATE_TOKEN})\\b`));
  const one = single || singleEm;
  if (one) {
    const day = parseFlexibleDate(one[1]);
    if (!day) error = "bad-date";
    else pushPeriod(periods, { start: day, end: day, label: `somente ${day.split("-").reverse().join("/")}` });
  }

  const days = text.match(/\bultimos\s+(\d+)\s+dias\b/);
  if (days) {
    const count = Number(days[1]);
    if (!Number.isInteger(count) || count < 1 || count > 3660) error = "bad-date";
    else pushPeriod(periods, lastDaysRange(ref, count));
  }

  if (/\bhoje\b/.test(text)) {
    pushPeriod(periods, {
      start: ref,
      end: ref,
      label: `data de referência ${ref.split("-").reverse().join("/")} (a palavra hoje não usa o relógio do computador)`,
    });
  }
  if (/\bontem\b/.test(text)) {
    const day = addDays(ref, -1);
    pushPeriod(periods, { start: day, end: day, label: null });
  }
  if (/\b(esta semana|nessa semana|semana atual)\b/.test(text)) {
    const week = weekRangeMonday(ref);
    pushPeriod(periods, { ...week, label: null });
  }
  if (/\bsemana passada\b/.test(text)) {
    const week = weekRangeMonday(ref);
    const end = addDays(week.start, -1);
    const start = addDays(end, -6);
    pushPeriod(periods, { start, end, label: null });
  }
  if (/\b(este mes|nesse mes|mes atual)\b/.test(text)) {
    pushPeriod(periods, { ...monthRange(refParts.y, refParts.m), label: null });
  }
  if (/\bmes passado\b/.test(text)) {
    const prev = previousMonth(refParts.y, refParts.m);
    pushPeriod(periods, { ...monthRange(prev.y, prev.m), label: null });
  }

  const monthPattern = new RegExp(
    `\\b(${Object.keys(MONTHS).join("|")})(?:\\s+de\\s+(\\d{4}))?\\b`,
    "g",
  );
  for (const match of text.matchAll(monthPattern)) {
    const month = MONTHS[match[1]];
    const year = match[2] ? Number(match[2]) : refParts.y;
    const rangeOfMonth = monthRange(year, month);
    if (!rangeOfMonth) error = "bad-date";
    else pushPeriod(periods, { ...rangeOfMonth, label: null });
  }

  if (error) return { error };
  if (periods.length > 1) return { error: "many-periods" };
  return { period: periods[0] || null };
}

function detectIntents(text, categories, negated) {
  const intents = [];
  if (/\bresumo\b/.test(text) || /\bvisao geral\b/.test(text)) intents.push("summary");
  const recentWords = /\b(ultimas|mais recentes)\b/.test(text);
  const txWords = /\b(transacoes?|extrato|lancamentos?|movimentacoes?)\b/.test(text);
  if (recentWords && (txWords || categories.length > 0 || /\b\d+\b/.test(text))) intents.push("recent");
  if (/\bsaldos?\b/.test(text) || /\bquanto (eu )?tenho\b/.test(text) || /\bdinheiro\b/.test(text) || /\bdivida\b/.test(text) || /\bquanto devo\b/.test(text)) {
    intents.push("balances");
  }
  const balanceStillAsked = /\bsaldos?\b/.test(text) && !negated.has("saldo");
  const listAccounts =
    /^(contas|minhas contas|quais contas|listar contas|liste as contas|mostrar contas)$/.test(text) ||
    (/\b(listar|liste|quais|mostrar|mostra|mostre)\b/.test(text) && /\bcontas\b/.test(text) && !balanceStillAsked);
  if (listAccounts) intents.push("accounts");
  if (/\bpendente?s?\b/.test(text) || /\bpendencia?s?\b/.test(text)) intents.push("pending");
  if (/\btransferencias?\b/.test(text)) intents.push("transfers");
  if (txWords) intents.push("transactions");
  if (categories.length === 1 && !intents.includes("transactions") && !intents.includes("recent") && !intents.includes("transfers")) {
    intents.push("transactions");
  }
  return [...new Set(intents)];
}

function extractLimit(text) {
  const digit = text.match(/\b(?:ultimas?\s+(\d+)|(\d+)\s+ultimas?)\b/);
  const words = { uma: 1, um: 1, duas: 2, dois: 2, tres: 3, quatro: 4, cinco: 5 };
  let count = null;
  if (digit) count = Number(digit[1] || digit[2]);
  else {
    for (const [word, value] of Object.entries(words)) {
      if (new RegExp(`\\b(?:ultimas?\\s+${word}|${word}\\s+ultimas?)\\b`).test(text)) count = value;
    }
  }
  if (count === null && /\bultimas\b/.test(text)) count = 5;
  return count;
}

function asksConnection(text) {
  if (/\b(pluggy|mcp|open finance)\b/.test(text)) return true;
  if (/\b(conectar|conecte|conexao|integrar|integracao)\b/.test(text)) return true;
  if (/\b(login|senha|token|password)\b/.test(text)) return true;
  if (/\btempo real\b/.test(text)) return true;
  if (/\b(inteligencia artificial|ia generativa|chatgpt|llm)\b/.test(text)) return true;
  if (/\bplaid\b/.test(text) && /\b(api|sandbox|de verdade|ao vivo|conect)\b/.test(text)) return true;
  if (/\bbanco\b/.test(text) && /\b(real|meu|minha|conectar|online)\b/.test(text)) return true;
  return false;
}

function asksFx(text) {
  return (
    /\b(reais|brl|cotacao|cambio|converter)\b/.test(text) ||
    /\bem real\b/.test(text) ||
    /\bpara real\b/.test(text)
  );
}

function asksForecast(text) {
  return /\b(previsao|prever|preveja|estimar|projecao|recomend|investir|meta)\b/.test(text);
}

function isMutation(text) {
  if (/\b(pagar|pague|quitar|quite)\b/.test(text)) return true;
  if (/\b(transferir|transfere|transfira)\b/.test(text)) return true;
  if (/\b(sacar|saque|deposite|depositar)\b/.test(text)) return true;
  if (/\b(alterar|mude|mudar|apague|apagar|excluir|adicionar|lancar|lance)\b/.test(text) && /\b(saldo|transac|conta)\b/.test(text)) {
    return true;
  }
  if (/\b(fazer|faz|realize|executar)\b/.test(text) && /\b(pix|pagamento|transferencia|saque)\b/.test(text)) {
    return true;
  }
  return false;
}

export function interpret(raw) {
  const text = normalize(raw);
  if (!text) return { type: "empty" };
  if (shouldDropUserText(raw)) return { type: "refuse", code: "sensitive" };
  if (isMutation(text)) return { type: "refuse", code: "mutation" };
  if (asksConnection(text)) return { type: "refuse", code: "connection" };
  if (asksFx(text)) return { type: "refuse", code: "fx" };
  if (asksForecast(text)) return { type: "refuse", code: "forecast" };
  if (/\bnao informad/.test(text) && !/\b(transac|aliment|resumo)\b/.test(text)) {
    return { type: "nulls" };
  }

  const negation = scanNegation(text);
  if (negation.unattached) return { type: "fallback", code: "unattached-negation" };

  const periodResult = extractPeriod(text);
  if (periodResult.error) return { type: "clarify", code: "period", reason: periodResult.error };

  const accounts = extractAccounts(text);
  if (accounts.status === "unknown") return { type: "clarify", code: "unknown-account", word: accounts.word };

  const categories = findCategories(text);
  if (categories.length > 1) return { type: "clarify", code: "many-categories" };
  if (/\btransferencias?\b/.test(text) && categories.some((id) => id !== "transferencia")) {
    return { type: "clarify", code: "mixed-category" };
  }

  let intents = detectIntents(text, categories, negation.topics);
  if (negation.topics.has("saldo")) intents = intents.filter((intent) => intent !== "balances");
  if (negation.topics.has("conta")) intents = intents.filter((intent) => intent !== "accounts");
  if (negation.topics.has("transacao")) {
    intents = intents.filter((intent) => !["transactions", "recent", "pending", "transfers"].includes(intent));
  }
  if (negation.topics.has("resumo")) intents = intents.filter((intent) => intent !== "summary");
  let categoryId = categories[0] && categories[0] !== "transferencia" ? categories[0] : null;
  if (categories[0] === "transferencia") categoryId = null;
  if (negation.topics.has("categoria")) {
    categoryId = null;
    if (!/\b(transacoes?|extrato|lancamentos?|movimentacoes?)\b/.test(text)) {
      intents = intents.filter((intent) => intent !== "transactions" && intent !== "recent");
    }
  }
  if (
    intents.includes("recent") ||
    intents.includes("pending") ||
    intents.includes("transfers") ||
    intents.includes("summary")
  ) {
    intents = intents.filter((intent) => intent !== "transactions");
  }

  if (intents.length === 0 && periodResult.period && negation.topics.size === 0) intents = ["transactions"];

  if (intents.length === 0 && negation.topics.size > 0) {
    return { type: "clarify", code: "negation", topic: [...negation.topics][0] };
  }
  if (intents.length === 0 && /\b(ultimas|recentes|mais recentes)\b/.test(text)) {
    return { type: "clarify", code: "recent-vague" };
  }
  if (intents.length === 0) return { type: "fallback", code: "unsupported" };

  const needsScope = intents.some((intent) =>
    ["balances", "transactions", "recent", "pending", "transfers", "summary"].includes(intent),
  );
  if (accounts.status === "ambiguous-card" && needsScope && !intents.every((intent) => intent === "accounts")) {
    return { type: "clarify", code: "ambiguous-card" };
  }

  if (intents.includes("summary")) {
    return command("summary", { accountIds: accounts.accountIds, categoryId, period: periodResult.period });
  }

  const limit = intents.includes("recent") ? extractLimit(text) : null;
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 50)) {
    return { type: "clarify", code: "bad-limit" };
  }

  if (intents.includes("recent") && intents.includes("balances") && intents.length === 2) {
    return {
      type: "combo",
      parts: ["balances", "recent"],
      accountIds: accounts.accountIds,
      categoryId,
      period: periodResult.period,
      limit: limit || 5,
      redactMoney: false,
    };
  }

  if (intents.length > 1) return { type: "clarify", code: "too-many" };

  const type = intents.includes("recent")
    ? "recent"
    : intents.includes("pending")
      ? "pending"
      : intents.includes("transfers")
        ? "transfers"
        : intents.includes("balances")
          ? "balances"
          : intents.includes("accounts")
            ? "accounts"
            : "transactions";

  return {
    type,
    accountIds: accounts.accountIds,
    categoryId: type === "transfers" ? null : categoryId,
    period: periodResult.period,
    limit: type === "recent" ? limit || 5 : null,
    redactMoney: negation.topics.has("saldo") && type === "accounts",
    kind: type === "transfers" ? "transfer" : type === "pending" ? null : null,
    pending: type === "pending" ? "only" : "any",
  };
}

function command(type, fields) {
  return {
    type,
    accountIds: fields.accountIds ?? null,
    categoryId: fields.categoryId ?? null,
    period: fields.period ?? null,
    limit: fields.limit ?? null,
    redactMoney: false,
    pending: "any",
    kind: null,
  };
}
