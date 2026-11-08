import fs from "node:fs";
import { describe, expect, test } from "vitest";
import { answerQuestion, viewPlainText } from "../../src/engine/answer.js";
import { isView } from "../../src/engine/storage.js";
import { balanceSignature, transactionSignature } from "../../src/engine/ledger.js";
import { interpret } from "../../src/engine/parse.js";
import { getTransactions } from "../../src/data/fixture.js";

function textOf(result) {
  return viewPlainText(result.view);
}

function covered(trace) {
  return [...trace.includedIds, ...trace.excluded.map((item) => item.id)].sort();
}

function allTxnIds() {
  return getTransactions().map((tx) => tx.id).sort();
}

function tracesOf(result) {
  return result.view.blocks.filter((block) => block.type === "trace").map((block) => block.trace);
}

describe("pedidos sem número", () => {
  test("saldo não não executa saldo", () => {
    expect(interpret("saldo não").type).toBe("clarify");
    const result = answerQuestion("saldo não");
    expect(textOf(result)).not.toMatch(/US\$|110,00|5\.020,00/);
    expect(result.view.tone).toBe("clarify");
  });

  test("nega saldo e ainda lista contas sem valores", () => {
    const result = answerQuestion("não mostre o saldo, mostre as contas");
    expect(textOf(result)).toContain("Plaid Checking");
    expect(textOf(result)).not.toMatch(/US\$/);
  });

  test("fallback, cartão ambíguo, conta ausente, câmbio, conexão e previsão", () => {
    for (const phrase of ["quanto", "asdf", "previsão do saldo", "quanto em reais", "conecte na plaid"]) {
      expect(textOf(answerQuestion(phrase))).not.toMatch(/US\$|R\$/);
    }
    expect(textOf(answerQuestion("saldo do cartão"))).toContain("Plaid Business Credit Card");
    expect(textOf(answerQuestion("saldo do cartão"))).not.toMatch(/US\$/);
    expect(textOf(answerQuestion("saldo da conta investimento"))).not.toMatch(/US\$/);
  });

  test("transferir não altera a amostra", () => {
    const balances = balanceSignature();
    const txs = transactionSignature();
    const result = answerQuestion("transferir 50 dólares para a poupança");
    expect(result.view.tone).toBe("refuse");
    expect(textOf(result)).not.toMatch(/US\$/);
    expect(balanceSignature()).toBe(balances);
    expect(transactionSignature()).toBe(txs);
  });

  test("campo nulo não vira zero", () => {
    const result = answerQuestion("saldo não informado");
    expect(textOf(result)).toContain("Não informado");
    expect(textOf(result)).toContain("Plaid Credit Card");
    expect(textOf(result)).not.toMatch(/US\$|0,00/);
  });
});

describe("cálculos com memória", () => {
  test("saldos separam dinheiro, dívida e limite", () => {
    const result = answerQuestion("Saldos");
    const body = textOf(result);
    expect(body).toContain("US$ 110,00");
    expect(body).toContain("US$ 100,00");
    expect(body).toContain("US$ 210,00");
    expect(body).toContain("US$ 200,00");
    expect(body).toContain("US$ 410,00");
    expect(body).toContain("US$ 5.020,00");
    expect(body).toContain("US$ 4.980,00");
    expect(body).toContain("Não informado");
    expect(body).toContain("US$ 320,00");
    expect(body).toContain("US$ 300,00");
    expect(body).toContain("US$ 5.430,00");
    expect(body).toContain("US$ 10.000,00");
    expect(body).not.toContain("US$ 5.750,00");
    expect(body).not.toContain("US$ 5.280,00");
    expect(result.audit.cashCurrentCents).toBe(32000);
    expect(result.audit.debtCents).toBe(543000);
    const trace = tracesOf(result)[0];
    expect(trace.formula).toContain("11000");
    expect(trace.formula).toContain("21000");
    expect(trace.formula).toContain("= 32000");
    expect(trace.formula).toContain("= 543000");
    expect(trace.includedIds).toEqual(["acc_checking", "acc_saving", "acc_credit", "acc_business_credit"]);
    expect(trace.sourceFile).toBe("src/data/fixture.js");
  });

  test("poupança e cartão empresarial não misturam papéis", () => {
    const saving = textOf(answerQuestion("saldo da poupança"));
    expect(saving).toContain("US$ 210,00");
    expect(saving).toContain("US$ 200,00");
    expect(saving).not.toContain("US$ 5.020,00");
    const card = textOf(answerQuestion("saldo do cartão empresarial"));
    expect(card).toContain("US$ 5.020,00");
    expect(card).toContain("US$ 4.980,00");
    expect(card).toContain("US$ 10.000,00");
    expect(card).toContain("não tem conta de depósito");
    expect(card).not.toContain("US$ 320,00");
  });

  test("alimentação confirma a soma e separa a pendência", () => {
    const result = answerQuestion("Alimentação");
    expect(result.audit.totalCents).toBe(16570);
    expect(result.audit.includedIds.sort()).toEqual(["txn_fx_02", "txn_fx_07", "txn_fx_12", "txn_fx_14"]);
    expect(result.audit.pendingIds).toEqual(["txn_fx_15"]);
    expect(result.audit.pendingCents).toBe(1590);
    expect(textOf(result)).toContain("US$ 165,70");
    expect(textOf(result)).toContain("US$ 15,90");
    expect(covered(tracesOf(result)[0])).toEqual(allTxnIds());
  });

  test("conta corrente, alimentação e outubro", () => {
    const result = answerQuestion("transações de alimentação da conta corrente em outubro de 2026");
    expect(result.audit.includedIds.sort()).toEqual(["txn_fx_02", "txn_fx_12"]);
    expect(result.audit.totalCents).toBe(9180);
    expect(textOf(result)).toContain("US$ 91,80");
    expect(result.audit.pendingIds).toEqual([]);
  });

  test("últimas cinco e a soma só desses registros", () => {
    const result = answerQuestion("Últimas transações");
    expect(result.audit.shownIds).toEqual(["txn_fx_16", "txn_fx_15", "txn_fx_12", "txn_fx_14", "txn_fx_11"]);
    expect(result.audit.includedIds.sort()).toEqual(["txn_fx_12", "txn_fx_14"]);
    expect(result.audit.totalCents).toBe(10420);
    expect(covered(tracesOf(result)[0])).toEqual(allTxnIds());
  });

  test("transferências, pendências, sete dias e mês vazio", () => {
    const transfers = answerQuestion("Transferências");
    expect(transfers.audit.totalCents).toBe(0);
    expect(transfers.audit.includedIds.sort()).toEqual(["txn_fx_05", "txn_fx_06"]);
    expect(textOf(transfers)).toContain("Não é consumo");
    const pending = answerQuestion("pendências");
    expect(pending.audit.includedIds.sort()).toEqual(["txn_fx_15", "txn_fx_16"]);
    expect(pending.audit.totalCents).toBe(3790);
    const week = answerQuestion("transações dos últimos 7 dias");
    expect(week.audit.shownIds.sort()).toEqual(["txn_fx_12", "txn_fx_15", "txn_fx_16"]);
    const december = answerQuestion("transações em dezembro de 2026");
    expect(december.audit.includedIds).toEqual([]);
    expect(december.audit.totalCents).toBe(0);
    expect(textOf(december)).toContain("Não criei lançamentos");
    expect(covered(tracesOf(december)[0])).toEqual(allTxnIds());
  });

  test("resumo agrupa o consumo inteiro e não o transforma em dinheiro", () => {
    const result = answerQuestion("Resumo");
    expect(result.audit.consumptionCents).toBe(38760);
    expect(result.audit.cashCurrentCents).toBe(32000);
    expect(result.audit.groups[0]).toMatchObject({ categoryId: "alimentacao", total: 16570 });
    expect(sumGroups(result.audit.groups)).toBe(38760);
    expect(result.audit.recentIds).toEqual(["txn_fx_16", "txn_fx_15", "txn_fx_12", "txn_fx_14", "txn_fx_11"]);
  });

  test("as respostas cabem no esquema salvo", () => {
    for (const phrase of ["Contas", "Saldos", "Últimas transações", "Alimentação", "Resumo", "Transferências", "pendências"]) {
      expect(isView(answerQuestion(phrase).view), phrase).toBe(true);
    }
  });

  test("intervalo invertido não inventa extrato", () => {
    const result = answerQuestion("transações entre 20/10/2026 e 01/10/2026");
    expect(result.view.tone).toBe("clarify");
    expect(textOf(result)).not.toMatch(/US\$/);
  });
});

function sumGroups(groups) {
  return groups.reduce((total, group) => total + group.total, 0);
}

describe("fontes sem rede no código da interface", () => {
  test("o app não chama fetch nem innerHTML", () => {
    const files = [
      "src/main.js",
      "src/ui/app.js",
      "src/ui/render.js",
      "src/engine/answer.js",
      "src/engine/parse.js",
      "src/engine/ledger.js",
      "src/data/fixture.js",
    ];
    const banned = ["innerHTML", "outerHTML", "insertAdjacentHTML", "document.write", "eval(", "new Function", "fetch(", "WebSocket"];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const token of banned) expect(source, file).not.toContain(token);
    }
    const parse = fs.readFileSync("src/engine/parse.js", "utf8");
    expect(parse).not.toContain("Date.now");
    expect(parse).not.toContain("new Date");
  });
});
