import { FIXTURE_META, categoryLabel, getAccounts, getTransactions } from "../data/fixture.js";
import { formatBR } from "./dates.js";
import {
  accountById,
  accountScopeLabel,
  auditedSum,
  balanceSignature,
  categoryScopeLabel,
  directionLine,
  exclusionReason,
  groupConsumption,
  impliedLimitCents,
  kindLabel,
  moneyLine,
  periodLabel,
  positions,
  sampleSpan,
  selectTransactions,
  sliceLimit,
  splitRows,
  traceBase,
  transactionSignature,
} from "./ledger.js";
import { interpret } from "./parse.js";
import { sumCents } from "./money.js";

const SUGGESTIONS = ["Contas", "Saldos", "Últimas transações", "Alimentação", "Resumo"];

function paragraph(text) {
  return { type: "paragraph", text };
}

function makeView({ tone, title, blocks, suggestions = SUGGESTIONS }) {
  return { kind: "local-rules-v1", tone, title, blocks, suggestions };
}

function assertNoMoney(view) {
  const blob = JSON.stringify(view);
  if (/US\$|R\$/.test(blob)) {
    throw new Error("resposta sem cálculo não pode exibir valor");
  }
}

function finish(view, audit = null, options = {}) {
  if (options.noMoney) assertNoMoney(view);
  return {
    view,
    audit: options.noMoney ? null : audit,
    dropUserText: Boolean(options.dropUserText),
  };
}

function sourceLine() {
  return `Fonte: ${FIXTURE_META.sourceFile} · ${FIXTURE_META.id}. Data de referência: ${formatBR(FIXTURE_META.referenceDate)} (${FIXTURE_META.timeZone}).`;
}

export function errorView() {
  return makeView({
    tone: "error",
    title: "Não consegui calcular",
    blocks: [
      paragraph("Houve um erro ao organizar a resposta. A amostra local não foi alterada e nenhum valor foi estimado."),
    ],
  });
}

function accountCard(account, redact) {
  const lines = [
    { label: "Tipo", value: account.typeLabel },
    { label: "Moeda", value: account.currency },
    { label: "Papel", value: account.role === "asset" ? "Dinheiro em conta" : "Dívida de cartão" },
  ];
  if (redact) {
    lines.push({ label: "Valores", value: "Ocultos neste pedido" });
  } else if (account.role === "asset") {
    lines.push({ label: "Saldo atual", value: moneyLine(account.currentCents) });
    lines.push({ label: "Disponível", value: moneyLine(account.availableCents) });
  } else {
    lines.push({ label: "Dívida atual", value: moneyLine(account.currentCents) });
    lines.push({
      label: "Crédito disponível",
      value: account.availableCents === null ? "Não informado" : moneyLine(account.availableCents),
    });
    const limit = impliedLimitCents(account);
    lines.push({
      label: "Limite implícito",
      value: limit === null ? "Não informado" : `${moneyLine(limit)} (dívida + crédito disponível)`,
    });
  }
  lines.push({ label: "Registro", value: account.id });
  lines.push({ label: "Origem", value: "Guia, página 26" });
  return { title: account.name, badge: "Conta da amostra", lines };
}

function txCard(tx) {
  const account = accountById(tx.accountId);
  return {
    title: tx.description,
    badge: tx.pending ? "Pendente · fictício" : "Confirmada · fictício",
    lines: [
      { label: "Data civil", value: formatBR(tx.date) },
      { label: "Conta", value: account ? account.name : "Não informado" },
      { label: "Categoria", value: categoryLabel(tx.categoryId) },
      { label: "Natureza", value: kindLabel(tx.kind) },
      { label: "Valor", value: directionLine(tx.amountCents) },
      { label: "Sinal Plaid", value: `${tx.amountCents} centavos` },
      { label: "Registro", value: tx.id },
      { label: "Par", value: tx.pairId || "Não informado" },
    ],
  };
}

function selectedAccounts(accountIds) {
  const accounts = getAccounts();
  if (!accountIds) return accounts;
  return accounts.filter((account) => accountIds.includes(account.id));
}

function balancesBlocks(accountIds, redact) {
  const accounts = selectedAccounts(accountIds);
  const pos = positions(accounts);
  const blocks = [
    paragraph(
      "Saldos transcritos do guia, página 26, em dólares. Dinheiro em conta, dívida de cartão e crédito disponível ficam separados. Dívida não entra no dinheiro.",
    ),
    paragraph("A diferença entre saldo atual e disponível faz parte dessa transcrição. Os lançamentos fictícios não explicam essa diferença."),
    paragraph(sourceLine()),
  ];
  if (redact) {
    blocks.push(paragraph("Você pediu as contas sem os valores. Os números ficam de fora."));
  }
  blocks.push({ type: "cards", items: accounts.map((account) => accountCard(account, redact)) });
  if (!redact) {
    blocks.push(...positionParagraphs(accounts, pos));
    blocks.push({ type: "trace", trace: balanceTrace(accounts, pos) });
  }
  return { blocks, audit: redact ? null : pos };
}

function positionParagraphs(accounts, pos) {
  const lines = [];
  const assets = accounts.filter((account) => account.role === "asset");
  const debts = accounts.filter((account) => account.role === "debt");
  if (assets.length === 0) {
    lines.push("Este recorte não tem conta de depósito. Não há dinheiro para somar.");
  } else {
    lines.push(`Dinheiro, saldo atual das contas de depósito: ${moneyLine(pos.cashCurrentCents)}.`);
    lines.push(`Dinheiro disponível para uso: ${moneyLine(pos.cashAvailableCents)}.`);
  }
  if (debts.length === 0) {
    lines.push("Este recorte não tem cartão. Não há dívida para somar.");
  } else {
    lines.push(`Dívida atual dos cartões: ${moneyLine(pos.debtCents)}.`);
    if (pos.unknownCreditIds.length > 0) {
      const names = pos.unknownCreditIds.map((id) => accountById(id).name).join(", ");
      lines.push(
        `Crédito disponível informado: ${moneyLine(pos.knownAvailableCreditCents)}. ${names}: Não informado. Não completei o limite ausente com zero, então não existe soma fechada de todos os limites.`,
      );
    } else {
      lines.push(`Crédito disponível informado: ${moneyLine(pos.knownAvailableCreditCents)}.`);
    }
  }
  return lines.map((text) => paragraph(text));
}

function balanceTrace(accounts, pos) {
  const assets = accounts.filter((account) => account.role === "asset");
  const debts = accounts.filter((account) => account.role === "debt");
  const cash = auditedSum(assets, (account) => account.currentCents);
  const available = auditedSum(assets, (account) => account.availableCents);
  const debt = auditedSum(debts, (account) => account.currentCents);
  const known = debts.filter((account) => Number.isInteger(account.availableCents));
  const credit = auditedSum(known, (account) => account.availableCents);
  const implied = debts
    .map((account) => {
      const limit = impliedLimitCents(account);
      return limit === null ? `${account.id}(disponivel)=nulo` : `${account.id} limite_implicito ${account.currentCents}+${account.availableCents}=${limit}`;
    })
    .join("; ");
  const formulaParts = [];
  if (assets.length === 0) formulaParts.push("dinheiro = sem conta de deposito neste recorte");
  else {
    formulaParts.push(`dinheiro_atual ${cash.formula}`);
    formulaParts.push(`dinheiro_disponivel ${available.formula}`);
  }
  if (debts.length === 0) formulaParts.push("divida = sem cartao neste recorte");
  else {
    formulaParts.push(`divida ${debt.formula}`);
    formulaParts.push(`credito_disponivel_informado ${credit.formula}`);
    formulaParts.push(implied);
  }
  const formula = formulaParts.join(" | ");
  const outside = getAccounts().filter((account) => !accounts.some((item) => item.id === account.id));
  return traceBase({
    period: "não se aplica (saldo informado, não é soma de lançamentos)",
    filters: [
      `Contas: ${accountScopeLabel(accounts.map((account) => account.id))}`,
      "Lançamentos incluídos no saldo: nenhum",
      `Lançamentos na fixture: ${sampleSpan().count}`,
    ],
    sampleCount: String(getAccounts().length),
    matchedCount: String(accounts.length),
    includedIds: accounts.map((account) => account.id),
    excluded: outside.map((account) => ({ id: account.id, reason: "fora do recorte de contas" })),
    formula,
    result: `dinheiro ${moneyLine(pos.cashCurrentCents)}; dívida ${moneyLine(pos.debtCents)}`,
  });
}

function specFrom(command, pending = "any") {
  return {
    accountIds: command.accountIds,
    categoryId: command.categoryId,
    period: command.period,
    kind: command.type === "transfers" ? "transfer" : null,
    pending: command.type === "pending" ? "only" : pending,
  };
}

function chooseHeadline(command, shown) {
  const parts = splitRows(shown);
  if (command.type === "transfers") {
    return {
      rows: parts.transfers,
      label: "Soma assinada das transferências confirmadas. Não é consumo.",
    };
  }
  if (command.type === "pending") {
    return { rows: parts.pending, label: "Soma das pendências. Elas ficam fora de qualquer total confirmado." };
  }
  const leftover = parts.transfers.length + parts.cardPayments.length + parts.income.length;
  if (parts.consumption.length === 0 && parts.pending.length === 0 && leftover > 0) {
    if (parts.cardPayments.length > 0 && parts.transfers.length === 0 && parts.income.length === 0) {
      return { rows: parts.cardPayments, label: "Soma assinada dos pagamentos de cartão. Não é consumo." };
    }
    if (parts.transfers.length > 0 && parts.cardPayments.length === 0 && parts.income.length === 0) {
      return { rows: parts.transfers, label: "Soma assinada das transferências deste filtro. Não é consumo." };
    }
    if (parts.income.length > 0 && parts.transfers.length === 0 && parts.cardPayments.length === 0) {
      return {
        rows: parts.income,
        label: "Soma assinada da renda confirmada, na convenção Plaid (entrada é negativa). Não é consumo.",
      };
    }
  }
  return {
    rows: parts.consumption,
    label: "Soma do consumo confirmado: saídas de consumo, sem pendência, sem transferência e sem pagamento de cartão.",
  };
}

function byId(rows) {
  return [...rows].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function coverage(spec, shown, includedRows, command) {
  const shownIds = new Set(shown.map((row) => row.id));
  const includedIds = new Set(includedRows.map((row) => row.id));
  const excluded = [];
  for (const row of byId(getTransactions())) {
    if (includedIds.has(row.id)) continue;
    const filteredOut = exclusionReason(row, spec);
    let reason = filteredOut;
    if (!reason && !shownIds.has(row.id)) reason = "fora das mais recentes exibidas";
    if (!reason && row.pending && command.type !== "pending") reason = "pendente, fora da soma confirmada";
    if (!reason && row.kind === "transfer") reason = "transferência, fora do consumo";
    if (!reason && row.kind === "card_payment") reason = "pagamento de cartão, fora do consumo";
    if (!reason && row.kind === "income") reason = "renda, fora do consumo";
    if (!reason) reason = "fora desta soma";
    excluded.push({ id: row.id, reason });
  }
  return excluded;
}

function movementBlocks(command, title) {
  const spec = specFrom(command);
  const matched = selectTransactions(spec);
  const shown = command.limit ? sliceLimit(matched, command.limit) : matched;
  const headline = chooseHeadline(command, shown);
  const summed = auditedSum(byId(headline.rows));
  const pending = splitRows(shown).pending.filter((row) => !headline.rows.some((item) => item.id === row.id));
  const pendingSum = auditedSum(byId(pending));
  const filters = [
    `Conta: ${accountScopeLabel(command.accountIds)}`,
    `Categoria: ${categoryScopeLabel(command.categoryId)}`,
    `Período: ${periodLabel(command.period)}`,
    command.limit ? `Lista limitada às ${command.limit} mais recentes do filtro` : "Lista sem corte de quantidade",
    `Registros após o filtro: ${matched.length}`,
    `Registros exibidos: ${shown.length}`,
  ];
  const blocks = [
    paragraph(title),
    paragraph(headline.label),
    paragraph(
      shown.length === 0
        ? "Nenhuma transação da amostra cai nesse filtro. Não criei lançamentos para preenchê-lo."
        : `Exibo ${shown.length} lançamento(s). A soma abaixo usa somente os registros da fórmula, não a amostra inteira.`,
    ),
    paragraph(sourceLine()),
    paragraph(FIXTURE_META.transactionsOrigin),
  ];
  if (shown.length > 0) blocks.push({ type: "cards", items: shown.map((tx) => txCard(tx)) });
  if (pending.length > 0) {
    blocks.push(
      paragraph(
        `Pendências à parte: ${pendingSum.formula} centavos, ${moneyLine(pendingSum.total)}. Não entram na soma confirmada.`,
      ),
    );
  }
  const trace = traceBase({
    period: periodLabel(command.period),
    filters,
    sampleCount: String(getTransactions().length),
    matchedCount: String(matched.length),
    includedIds: summed.ids,
    excluded: coverage(spec, shown, headline.rows, command),
    formula: summed.formula,
    result: moneyLine(summed.total),
    asideFormula: pending.length > 0 ? pendingSum.formula : "",
    asideResult: pending.length > 0 ? moneyLine(pendingSum.total) : "",
  });
  blocks.push({ type: "trace", trace });
  const audit = {
    includedIds: summed.ids,
    totalCents: summed.total,
    pendingIds: pendingSum.ids,
    pendingCents: pendingSum.total,
    shownIds: shown.map((row) => row.id),
    matchedCount: matched.length,
  };
  const reconciled = sumCents(getTransactions().filter((row) => summed.ids.includes(row.id)).map((row) => row.amountCents));
  if (reconciled !== summed.total) throw new Error("memória divergente da soma");
  return { blocks, audit, tone: shown.length === 0 ? "empty" : "answer" };
}

function summaryAnswer(command) {
  const spec = specFrom({ ...command, type: "transactions" });
  const matched = selectTransactions(spec);
  const parts = splitRows(matched);
  const grouped = groupConsumption(matched);
  const consumption = auditedSum(byId(parts.consumption));
  const groupTotal = sumCents(grouped.map((group) => group.total));
  if (groupTotal !== consumption.total) throw new Error("agrupamento divergente");
  const recentCommand = { ...command, type: "recent", limit: 5, kind: null, pending: "any" };
  const recent = movementBlocks(recentCommand, "Cinco mais recentes deste mesmo recorte. A soma delas não substitui o total do período.");
  const balance = balancesBlocks(command.accountIds, false);
  const blocks = [
    paragraph("Resumo da amostra local. Os totais de consumo usam o recorte inteiro; a lista de cinco é só a ponta mais recente."),
    paragraph(sourceLine()),
    ...balance.blocks.filter((block) => block.type !== "trace"),
    paragraph("Consumo confirmado por categoria, no recorte. Transferência, pagamento de cartão, renda e pendência ficam de fora."),
  ];
  if (grouped.length === 0) {
    blocks.push(paragraph("Não há consumo confirmado neste recorte."));
  } else {
    blocks.push({
      type: "groups",
      items: grouped.map((group) => ({
        label: group.label,
        value: moneyLine(group.total),
        note: `${group.ids.length} lançamentos · ${group.formula}`,
      })),
    });
  }
  blocks.push(paragraph(`${consumption.formula} centavos = ${moneyLine(consumption.total)}.`));
  blocks.push({
    type: "trace",
    trace: traceBase({
      period: periodLabel(command.period),
      filters: [
        `Conta: ${accountScopeLabel(command.accountIds)}`,
        `Categoria: ${categoryScopeLabel(command.categoryId)}`,
        "Soma: consumo confirmado do recorte inteiro",
      ],
      sampleCount: String(getTransactions().length),
      matchedCount: String(matched.length),
      includedIds: consumption.ids,
      excluded: coverage(spec, matched, parts.consumption, { type: "transactions" }),
      formula: consumption.formula,
      result: moneyLine(consumption.total),
    }),
  });
  blocks.push(...recent.blocks);
  return finish(
    makeView({ tone: "answer", title: "Resumo da amostra", blocks, suggestions: [] }),
    {
      ...balance.audit,
      consumptionCents: consumption.total,
      groups: grouped.map((group) => ({ categoryId: group.categoryId, total: group.total, ids: group.ids })),
      recentIds: recent.audit.shownIds,
    },
  );
}

function refuse(code) {
  const copy = {
    mutation: [
      "Este laboratório só lê a amostra",
      "Não há pagamento, transferência, saque ou alteração de saldo. Os números continuam os da fixture local.",
    ],
    connection: [
      "Nada está conectado",
      "Esta página não fala com banco, Plaid, Pluggy, MCP nem com um serviço online. Os números, quando existem, vêm do arquivo local.",
    ],
    fx: [
      "Sem conversão para real",
      "A amostra está em dólares, como no guia. Este laboratório não calcula câmbio e não informa valor em reais.",
    ],
    forecast: [
      "Sem projeção",
      "Não estimo mês futuro, meta ou recomendação. Se quiser os números atuais da amostra, peça Saldos ou Resumo.",
    ],
    sensitive: [
      "Não guardei esse texto",
      "Não cole documento, cartão ou senha. A frase não entrou no histórico. Este laboratório não pede esses dados.",
    ],
  }[code];
  return finish(
    makeView({
      tone: "refuse",
      title: copy[0],
      blocks: [paragraph(copy[1]), paragraph("Nenhum saldo foi alterado.")],
    }),
    null,
    { noMoney: true, dropUserText: code === "sensitive" },
  );
}

function clarify(command) {
  const messages = {
    negation: [
      "Não calculei",
      "A frase nega ou interrompe o pedido. Não vou listar números a partir dela. Se quiser um cálculo, use uma pergunta afirmativa, por exemplo Saldos.",
    ],
    "ambiguous-card": [
      "Há dois cartões na amostra",
      "Plaid Credit Card e Plaid Business Credit Card são contas diferentes. Diga qual delas. Não escolhi uma no seu lugar.",
    ],
    "unknown-account": [
      "Essa conta não está na amostra",
      "Não vou inventar saldo para uma conta ausente. As contas existentes são Plaid Checking, Plaid Saving, Plaid Credit Card e Plaid Business Credit Card.",
    ],
    period: [
      "Não entendi o período",
      "Use um mês, um intervalo com começo e fim, ou uma expressão como últimos 7 dias. Não chutei datas.",
    ],
    "many-categories": [
      "Escolha uma categoria",
      "Consigo filtrar uma categoria por vez: alimentação, transporte, lazer, saúde, renda ou escritório.",
    ],
    "mixed-category": [
      "São pedidos diferentes",
      "Transferência não é categoria de consumo. Peça Transferências ou uma categoria, por exemplo Alimentação.",
    ],
    "bad-limit": [
      "Não entendi a quantidade",
      "Peça as últimas transações, ou um número de 1 a 50. A amostra tem 16 lançamentos; não crio outros.",
    ],
    "recent-vague": [
      "Falta dizer o quê",
      "Se quiser a lista, peça Últimas transações. Não vou adivinhar o recorte.",
    ],
    "too-many": [
      "Um pedido de cada vez",
      "Entendi mais de um assunto e não vou misturar as contas. Escolha saldos, transações ou um resumo.",
    ],
  }[command.code] || ["Preciso de um pedido mais claro", "Não vou estimar um número."];
  const suggestions =
    command.code === "ambiguous-card"
      ? ["Saldo do cartão pessoal", "Saldo do cartão empresarial", "Saldos"]
      : SUGGESTIONS;
  return finish(
    makeView({
      tone: "clarify",
      title: messages[0],
      blocks: [paragraph(messages[1])],
      suggestions,
    }),
    null,
    { noMoney: true },
  );
}

function fallback() {
  return finish(
    makeView({
      tone: "fallback",
      title: "Não sei responder com as regras deste laboratório",
      blocks: [
        paragraph(
          "Não vou inventar saldo, data ou categoria. Esta página não consulta banco, Plaid, Pluggy nem um modelo de linguagem.",
        ),
        paragraph(
          "Dá para pedir contas, saldos, últimas transações, alimentação, transporte, lazer, saúde, renda, escritório, transferências, pendências ou um resumo. Também dá para indicar a conta e o período.",
        ),
      ],
    }),
    null,
    { noMoney: true },
  );
}

function nullsAnswer() {
  const missing = getAccounts().filter((account) => account.availableCents === null);
  return finish(
    makeView({
      tone: "answer",
      title: "Campos não informados",
      blocks: [
        paragraph("Na transcrição da página 26, o campo ausente permanece ausente. Não virei isso em zero."),
        {
          type: "cards",
          items: missing.map((account) => ({
            title: account.name,
            badge: "Campo vazio na amostra",
            lines: [
              { label: "Campo", value: "Crédito disponível" },
              { label: "Valor", value: "Não informado" },
              { label: "Registro", value: account.id },
            ],
          })),
        },
        paragraph(sourceLine()),
      ],
    }),
    null,
    { noMoney: true },
  );
}

export function answerQuestion(raw) {
  const balancesBefore = balanceSignature();
  const transactionsBefore = transactionSignature();
  const command = interpret(raw);
  let result;
  if (command.type === "empty") {
    result = fallback();
  } else if (command.type === "refuse") {
    result = refuse(command.code);
  } else if (command.type === "clarify") {
    result = clarify(command);
  } else if (command.type === "fallback") {
    result = fallback();
  } else if (command.type === "nulls") {
    result = nullsAnswer();
  } else if (command.type === "balances") {
    const built = balancesBlocks(command.accountIds, false);
    result = finish(
      makeView({ tone: "answer", title: "Saldos da amostra", blocks: built.blocks, suggestions: [] }),
      built.audit,
    );
  } else if (command.type === "accounts") {
    const built = balancesBlocks(command.accountIds, command.redactMoney);
    result = finish(
      makeView({
        tone: "answer",
        title: "Contas da amostra",
        suggestions: command.redactMoney ? SUGGESTIONS : [],
        blocks: [
          paragraph("Quatro contas do exemplo do guia, página 26. Os nomes Plaid são rótulos didáticos, sem conexão."),
          ...built.blocks,
        ],
      }),
      built.audit,
      { noMoney: command.redactMoney },
    );
  } else if (command.type === "summary") {
    result = summaryAnswer(command);
  } else if (command.type === "combo") {
    const balances = balancesBlocks(command.accountIds, false);
    const recent = movementBlocks({ ...command, type: "recent" }, "Últimas transações, em seguida.");
    result = finish(
      makeView({
        tone: "answer",
        title: "Saldos e últimas transações",
        suggestions: [],
        blocks: [...balances.blocks, ...recent.blocks],
      }),
      { balances: balances.audit, recent: recent.audit },
    );
  } else {
    const titles = {
      recent: "Últimas transações da amostra",
      pending: "Pendências da amostra",
      transfers: "Transferências da amostra",
      transactions: "Transações da amostra",
    };
    const built = movementBlocks(command, titles[command.type] || "Transações da amostra");
    result = finish(
      makeView({
        tone: built.tone,
        title: titles[command.type],
        blocks: built.blocks,
        suggestions: built.tone === "empty" ? SUGGESTIONS : [],
      }),
      built.audit,
    );
  }
  if (balanceSignature() !== balancesBefore || transactionSignature() !== transactionsBefore) {
    throw new Error("a amostra foi alterada");
  }
  return result;
}

export function viewPlainText(view) {
  const parts = [view?.title || ""];
  for (const block of view?.blocks || []) {
    if (block.type === "paragraph") parts.push(block.text);
    if (block.type === "cards") {
      for (const card of block.items) {
        parts.push(card.title, card.badge);
        for (const line of card.lines) parts.push(`${line.label} ${line.value}`);
      }
    }
    if (block.type === "groups") {
      for (const item of block.items) parts.push(item.label, item.value, item.note);
    }
    if (block.type === "trace") parts.push(JSON.stringify(block.trace));
  }
  return parts.filter(Boolean).join("\n");
}
