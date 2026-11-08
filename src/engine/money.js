/** Centavos inteiros. Nulo permanece nulo. Sem ponto flutuante. */

export function sumCents(values) {
  let total = 0;
  for (const value of values) {
    if (!Number.isInteger(value)) {
      throw new TypeError("A soma exige centavos inteiros");
    }
    total += value;
  }
  return total;
}

export function formatUsd(cents) {
  if (cents === null || cents === undefined) return "Não informado";
  if (!Number.isInteger(cents)) {
    throw new TypeError("Valor monetário precisa ser centavos inteiros ou nulo");
  }
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${negative ? "-" : ""}US$ ${grouped},${frac}`;
}

export function plaidDirection(cents) {
  if (!Number.isInteger(cents)) return null;
  if (cents > 0) return "saida";
  if (cents < 0) return "entrada";
  return "neutro";
}

export function formatPlaidAmount(cents) {
  if (cents === null || cents === undefined) return "Não informado";
  if (!Number.isInteger(cents)) {
    throw new TypeError("Valor monetário precisa ser centavos inteiros ou nulo");
  }
  const direction = plaidDirection(cents);
  const word = direction === "saida" ? "Saída" : direction === "entrada" ? "Entrada" : "Neutro";
  return `${word} ${formatUsd(Math.abs(cents))}`;
}

export function auditedSum(rows, pick = (row) => row.amountCents) {
  const amounts = rows.map((row) => pick(row));
  const total = sumCents(amounts);
  const formula =
    rows.length === 0
      ? `0 = ${total}`
      : `${rows.map((row, index) => `${row.id}(${amounts[index]})`).join(" + ")} = ${total}`;
  return { total, formula, ids: rows.map((row) => row.id) };
}
