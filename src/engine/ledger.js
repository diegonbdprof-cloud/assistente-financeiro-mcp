import {
  FIXTURE_META,
  CATEGORIES,
  accountById,
  categoryLabel,
  getAccounts,
  getTransactions,
} from "../data/fixture.js";
import { addDays, formatBR, inRange } from "./dates.js";
import { auditedSum, formatPlaidAmount, formatUsd, sumCents } from "./money.js";

export function balanceSignature() {
  return getAccounts()
    .map((account) => `${account.id}:${String(account.currentCents)}:${String(account.availableCents)}`)
    .join("|");
}

export function transactionSignature() {
  return getTransactions()
    .map((tx) => `${tx.id}:${tx.amountCents}:${tx.pending}`)
    .join("|");
}

export function positions(accounts = getAccounts()) {
  const assets = accounts.filter((account) => account.role === "asset");
  const debts = accounts.filter((account) => account.role === "debt");
  const knownCredit = debts.filter((account) => Number.isInteger(account.availableCents));
  const unknownCredit = debts.filter((account) => account.availableCents === null);
  return {
    cashCurrentCents: sumCents(assets.map((account) => account.currentCents)),
    cashAvailableCents: sumCents(assets.map((account) => account.availableCents)),
    debtCents: sumCents(debts.map((account) => account.currentCents)),
    knownAvailableCreditCents: sumCents(knownCredit.map((account) => account.availableCents)),
    knownCreditIds: knownCredit.map((account) => account.id),
    unknownCreditIds: unknownCredit.map((account) => account.id),
    assetIds: assets.map((account) => account.id),
    debtIds: debts.map((account) => account.id),
  };
}

export function impliedLimitCents(account) {
  if (!account || account.role !== "debt") return null;
  if (!Number.isInteger(account.currentCents) || !Number.isInteger(account.availableCents)) return null;
  return account.currentCents + account.availableCents;
}

export function sampleSpan(rows = getTransactions()) {
  const dates = rows.map((row) => row.date).sort();
  return { start: dates[0], end: dates[dates.length - 1], count: rows.length };
}

export function sortRecent(rows) {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    if (a.id !== b.id) return a.id < b.id ? 1 : -1;
    return 0;
  });
}

export function matches(row, spec) {
  if (spec.accountIds && !spec.accountIds.includes(row.accountId)) return false;
  if (spec.categoryId && row.categoryId !== spec.categoryId) return false;
  if (spec.kind && row.kind !== spec.kind) return false;
  if (spec.pending === "only" && !row.pending) return false;
  if (spec.pending === "posted" && row.pending) return false;
  if (spec.period && !inRange(row.date, spec.period.start, spec.period.end)) return false;
  return true;
}

export function exclusionReason(row, spec) {
  if (spec.accountIds && !spec.accountIds.includes(row.accountId)) return "outra conta";
  if (spec.categoryId && row.categoryId !== spec.categoryId) return "outra categoria";
  if (spec.kind && row.kind !== spec.kind) return "outra natureza";
  if (spec.pending === "only" && !row.pending) return "não é pendente";
  if (spec.pending === "posted" && row.pending) return "pendente";
  if (spec.period && !inRange(row.date, spec.period.start, spec.period.end)) return "fora do período";
  return null;
}

export function selectTransactions(spec, rows = getTransactions()) {
  return sortRecent(rows.filter((row) => matches(row, spec)));
}

export function sliceLimit(rows, limit) {
  if (!Number.isInteger(limit)) return rows;
  return rows.slice(0, limit);
}

export function splitRows(rows) {
  const pending = rows.filter((row) => row.pending);
  const confirmed = rows.filter((row) => !row.pending);
  const consumption = confirmed.filter((row) => row.kind === "spend" && row.amountCents > 0);
  const income = confirmed.filter((row) => row.kind === "income");
  const transfers = confirmed.filter((row) => row.kind === "transfer");
  const cardPayments = confirmed.filter((row) => row.kind === "card_payment");
  return { pending, confirmed, consumption, income, transfers, cardPayments };
}

export function groupConsumption(rows) {
  const buckets = new Map();
  for (const row of rows) {
    if (row.pending || row.kind !== "spend" || row.amountCents <= 0) continue;
    const list = buckets.get(row.categoryId) || [];
    list.push(row);
    buckets.set(row.categoryId, list);
  }
  return [...buckets.entries()]
    .map(([categoryId, list]) => {
      const sorted = [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      return { categoryId, label: categoryLabel(categoryId), ...auditedSum(sorted) };
    })
    .sort((a, b) => b.total - a.total || (a.categoryId < b.categoryId ? -1 : 1));
}

export function periodLabel(period) {
  if (!period) {
    const span = sampleSpan();
    return `toda a amostra, de ${formatBR(span.start)} a ${formatBR(span.end)} (datas civis, inclusive)`;
  }
  return period.label || `${formatBR(period.start)} a ${formatBR(period.end)} (inclusive)`;
}

export function accountScopeLabel(accountIds) {
  if (!accountIds) return "todas as contas da amostra";
  return accountIds.map((id) => accountById(id)?.name || id).join(", ");
}

export function categoryScopeLabel(categoryId) {
  if (!categoryId) return "todas as categorias";
  return CATEGORIES[categoryId]?.label || "Não informado";
}

export function lastDaysRange(referenceDate, count) {
  return {
    start: addDays(referenceDate, -(count - 1)),
    end: referenceDate,
    label: `últimos ${count} dias civis até ${formatBR(referenceDate)}, inclusive (data de referência, não o relógio)`,
  };
}

export function traceBase(extra) {
  return {
    sourceFile: FIXTURE_META.sourceFile,
    fixtureId: FIXTURE_META.id,
    referenceDate: formatBR(FIXTURE_META.referenceDate),
    timeZone: FIXTURE_META.timeZone,
    ...extra,
  };
}

export function kindLabel(kind) {
  if (kind === "spend") return "Consumo";
  if (kind === "income") return "Renda";
  if (kind === "transfer") return "Transferência";
  if (kind === "card_payment") return "Pagamento de cartão";
  return "Não informado";
}

export function moneyLine(cents) {
  return formatUsd(cents);
}

export function directionLine(cents) {
  return formatPlaidAmount(cents);
}

export { formatBR, formatUsd, auditedSum, categoryLabel, accountById };
