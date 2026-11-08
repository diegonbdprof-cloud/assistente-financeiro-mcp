/**
 * Amostra local e fictícia.
 * Saldos: transcrição das quatro contas do guia, página 26.
 * Transações: autoria deste repositório. Não são download Plaid,
 * não são os 48 registros históricos e não reconstituem agregados.
 */

export const FIXTURE_META = Object.freeze({
  id: "fixture-autoral-diego-v1",
  sourceFile: "src/data/fixture.js",
  referenceDate: "2026-11-01",
  timeZone: "America/Sao_Paulo",
  currency: "USD",
  accountsOrigin:
    "Guia do desafio, página 26. Quatro contas de exemplo, em dólares. Os nomes Plaid são rótulos da amostra, sem Item e sem API.",
  transactionsOrigin:
    "Fixture autoral pequena, escrita para este repositório e marcada como fictícia. O PDF não contém o extrato integral.",
  notAReconciliation:
    "Os lançamentos não fecham o saldo do guia e não explicam a diferença entre saldo atual e disponível.",
});

export const CATEGORIES = Object.freeze({
  alimentacao: Object.freeze({ label: "Alimentação", words: Object.freeze(["alimentacao", "comida"]) }),
  transporte: Object.freeze({ label: "Transporte", words: Object.freeze(["transporte"]) }),
  lazer: Object.freeze({ label: "Lazer", words: Object.freeze(["lazer"]) }),
  saude: Object.freeze({ label: "Saúde", words: Object.freeze(["saude"]) }),
  renda: Object.freeze({ label: "Renda", words: Object.freeze(["renda", "salario"]) }),
  transferencia: Object.freeze({
    label: "Transferência",
    words: Object.freeze(["transferencia", "transferencias"]),
  }),
  pagamento_cartao: Object.freeze({
    label: "Pagamento de cartão",
    words: Object.freeze(["pagamento de cartao", "pagamento da fatura", "pagamentos de cartao"]),
  }),
  escritorio: Object.freeze({ label: "Escritório", words: Object.freeze(["escritorio"]) }),
});

const ACCOUNTS = [
  {
    id: "acc_checking",
    name: "Plaid Checking",
    type: "depository",
    subtype: "checking",
    typeLabel: "Conta corrente",
    currency: "USD",
    role: "asset",
    currentCents: 11000,
    availableCents: 10000,
    availableMeaning: "cash",
    guidePage: 26,
    origin: "guia-p26",
  },
  {
    id: "acc_saving",
    name: "Plaid Saving",
    type: "depository",
    subtype: "savings",
    typeLabel: "Poupança",
    currency: "USD",
    role: "asset",
    currentCents: 21000,
    availableCents: 20000,
    availableMeaning: "cash",
    guidePage: 26,
    origin: "guia-p26",
  },
  {
    id: "acc_credit",
    name: "Plaid Credit Card",
    type: "credit",
    subtype: "credit card",
    typeLabel: "Cartão de crédito pessoal",
    currency: "USD",
    role: "debt",
    currentCents: 41000,
    availableCents: null,
    availableMeaning: "unknown",
    guidePage: 26,
    origin: "guia-p26",
  },
  {
    id: "acc_business_credit",
    name: "Plaid Business Credit Card",
    type: "credit",
    subtype: "credit card",
    typeLabel: "Cartão de crédito empresarial",
    currency: "USD",
    role: "debt",
    currentCents: 502000,
    availableCents: 498000,
    availableMeaning: "credit",
    guidePage: 26,
    origin: "guia-p26",
  },
];

const RAW_TRANSACTIONS = [
  ["txn_fx_01", "acc_checking", "2026-10-03", -250000, false, "income", "renda", "Depósito salarial fictício — Estúdio Aurora", null],
  ["txn_fx_02", "acc_checking", "2026-10-05", 1860, false, "spend", "alimentacao", "Padaria Solar — pão e café", null],
  ["txn_fx_03", "acc_checking", "2026-10-11", 2500, false, "spend", "lazer", "Livraria da Praça — caderno", null],
  ["txn_fx_04", "acc_checking", "2026-10-12", 450, false, "spend", "transporte", "Metrô Linha Verde — bilhete", null],
  ["txn_fx_05", "acc_checking", "2026-10-15", 5000, false, "transfer", "transferencia", "Transferência fictícia para Plaid Saving", "par_fx_01"],
  ["txn_fx_06", "acc_saving", "2026-10-15", -5000, false, "transfer", "transferencia", "Transferência fictícia recebida da conta corrente", "par_fx_01"],
  ["txn_fx_07", "acc_credit", "2026-10-18", 4290, false, "spend", "alimentacao", "Restaurante Vila Nova — almoço", null],
  ["txn_fx_08", "acc_saving", "2026-10-20", -75, false, "income", "renda", "Rendimento fictício da poupança", null],
  ["txn_fx_09", "acc_credit", "2026-10-22", 6400, false, "spend", "saude", "Farmácia Norte — item fictício", null],
  ["txn_fx_10", "acc_checking", "2026-10-22", 10000, false, "card_payment", "pagamento_cartao", "Pagamento fictício da fatura do cartão pessoal", "par_fx_02"],
  ["txn_fx_11", "acc_credit", "2026-10-22", -10000, false, "card_payment", "pagamento_cartao", "Pagamento fictício recebido da conta corrente", "par_fx_02"],
  ["txn_fx_12", "acc_checking", "2026-10-28", 7320, false, "spend", "alimentacao", "Mercado Limoeiro", null],
  ["txn_fx_13", "acc_business_credit", "2026-10-09", 12840, false, "spend", "escritorio", "Papelaria Oficina — material fictício", null],
  ["txn_fx_14", "acc_business_credit", "2026-10-25", 3100, false, "spend", "alimentacao", "Cantina do Porto — almoço de equipe fictício", null],
  ["txn_fx_15", "acc_checking", "2026-11-01", 1590, true, "spend", "alimentacao", "Lanchonete do Campus — autorização pendente", null],
  ["txn_fx_16", "acc_business_credit", "2026-11-01", 2200, true, "spend", "escritorio", "Revista de Estudos — assinatura ainda pendente", null],
];

function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

const TRANSACTIONS = RAW_TRANSACTIONS.map((row) =>
  deepFreeze({
    id: row[0],
    accountId: row[1],
    date: row[2],
    amountCents: row[3],
    pending: row[4],
    kind: row[5],
    categoryId: row[6],
    description: row[7],
    pairId: row[8],
    currency: "USD",
    origin: "fixture-autoral",
    fictional: true,
  }),
);

deepFreeze(ACCOUNTS);
deepFreeze(TRANSACTIONS);

export function getAccounts() {
  return ACCOUNTS.map((account) => ({ ...account }));
}

export function getTransactions() {
  return TRANSACTIONS.map((tx) => ({ ...tx }));
}

export function fixtureIsFrozen() {
  return (
    Object.isFrozen(ACCOUNTS) &&
    Object.isFrozen(TRANSACTIONS) &&
    Object.isFrozen(ACCOUNTS[0]) &&
    Object.isFrozen(TRANSACTIONS[0]) &&
    Object.isFrozen(FIXTURE_META)
  );
}

export function accountById(id) {
  return getAccounts().find((account) => account.id === id) || null;
}

export function categoryLabel(id) {
  return CATEGORIES[id]?.label || "Não informado";
}
