import { describe, expect, test } from "vitest";
import { fixtureIsFrozen, getAccounts, getTransactions } from "../../src/data/fixture.js";
import {
  balanceSignature,
  groupConsumption,
  impliedLimitCents,
  positions,
  selectTransactions,
  sortRecent,
  transactionSignature,
} from "../../src/engine/ledger.js";
import { sumCents } from "../../src/engine/money.js";

describe("amostra e separação de dinheiro", () => {
  test("quatro contas do guia e dezesseis lançamentos autorais", () => {
    const accounts = getAccounts();
    expect(accounts.map((account) => [account.name, account.currentCents, account.availableCents])).toEqual([
      ["Plaid Checking", 11000, 10000],
      ["Plaid Saving", 21000, 20000],
      ["Plaid Credit Card", 41000, null],
      ["Plaid Business Credit Card", 502000, 498000],
    ]);
    expect(getTransactions()).toHaveLength(16);
    expect(getTransactions().every((tx) => tx.date >= "2026-10-01")).toBe(true);
    expect(fixtureIsFrozen()).toBe(true);
  });

  test("mutar a cópia não altera a fonte", () => {
    const before = balanceSignature();
    const copy = getAccounts();
    copy[2].availableCents = 0;
    copy[0].currentCents = 1;
    getTransactions()[0].amountCents = 1;
    expect(balanceSignature()).toBe(before);
    expect(getAccounts()[2].availableCents).toBeNull();
  });

  test("não soma dívida como dinheiro e não trata nulo como zero", () => {
    const pos = positions();
    expect(pos.cashCurrentCents).toBe(32000);
    expect(pos.cashAvailableCents).toBe(30000);
    expect(pos.debtCents).toBe(543000);
    expect(pos.knownAvailableCreditCents).toBe(498000);
    expect(pos.unknownCreditIds).toEqual(["acc_credit"]);
    expect(pos.cashCurrentCents + pos.debtCents).toBe(575000);
    const credit = getAccounts().find((account) => account.id === "acc_credit");
    const business = getAccounts().find((account) => account.id === "acc_business_credit");
    expect(impliedLimitCents(credit)).toBeNull();
    expect(impliedLimitCents(business)).toBe(1000000);
  });
});

describe("lançamentos", () => {
  test("cinco mais recentes, com desempate pelo id", () => {
    const ids = sortRecent(getTransactions()).slice(0, 5).map((tx) => tx.id);
    expect(ids).toEqual(["txn_fx_16", "txn_fx_15", "txn_fx_12", "txn_fx_14", "txn_fx_11"]);
    const sameDay = sortRecent(getTransactions().filter((tx) => tx.date === "2026-10-22")).map((tx) => tx.id);
    expect(sameDay).toEqual(["txn_fx_11", "txn_fx_10", "txn_fx_09"]);
  });

  test("pendência e transferência ficam fora do consumo", () => {
    const rows = selectTransactions({});
    const confirmedSpend = rows.filter((tx) => !tx.pending && tx.kind === "spend" && tx.amountCents > 0);
    expect(sumCents(confirmedSpend.map((tx) => tx.amountCents))).toBe(38760);
    const pending = rows.filter((tx) => tx.pending);
    expect(pending.map((tx) => tx.id).sort()).toEqual(["txn_fx_15", "txn_fx_16"]);
    expect(sumCents(pending.map((tx) => tx.amountCents))).toBe(3790);
    const transfers = rows.filter((tx) => tx.kind === "transfer");
    expect(sumCents(transfers.map((tx) => tx.amountCents))).toBe(0);
    const groups = groupConsumption(rows);
    expect(sumCents(groups.map((group) => group.total))).toBe(38760);
    expect(groups.map((group) => group.categoryId)).toEqual([
      "alimentacao",
      "escritorio",
      "saude",
      "lazer",
      "transporte",
    ]);
    expect(groups[0].total).toBe(16570);
  });

  test("filtro de conta, categoria e período inclusivo", () => {
    const rows = selectTransactions({
      accountIds: ["acc_checking"],
      categoryId: "alimentacao",
      period: { start: "2026-10-01", end: "2026-10-31" },
    });
    expect(rows.map((tx) => tx.id).sort()).toEqual(["txn_fx_02", "txn_fx_12"]);
    expect(sumCents(rows.map((tx) => tx.amountCents))).toBe(9180);
  });

  test("últimos 7 dias civis até a referência", () => {
    const rows = selectTransactions({ period: { start: "2026-10-26", end: "2026-11-01" } });
    expect(rows.map((tx) => tx.id).sort()).toEqual(["txn_fx_12", "txn_fx_15", "txn_fx_16"]);
  });

  test("assinatura estável depois de ler", () => {
    const before = transactionSignature();
    selectTransactions({ categoryId: "alimentacao" });
    expect(transactionSignature()).toBe(before);
  });
});
