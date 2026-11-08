/** Datas civis YYYY-MM-DD. O calendário usa UTC só como aritmética, sem fuso do computador. */

function partsOf(iso) {
  if (typeof iso !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!isValidCivil(y, m, d)) return null;
  return { y, m, d };
}

function isValidCivil(y, m, d) {
  if (m < 1 || m > 12 || d < 1) return false;
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

export function isISODate(iso) {
  return partsOf(iso) !== null;
}

export function formatISO(parts) {
  return `${String(parts.y).padStart(4, "0")}-${String(parts.m).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}

export function formatBR(iso) {
  const parts = partsOf(iso);
  if (!parts) return "Não informado";
  return `${String(parts.d).padStart(2, "0")}/${String(parts.m).padStart(2, "0")}/${parts.y}`;
}

export function addDays(iso, delta) {
  const parts = partsOf(iso);
  if (!parts || !Number.isInteger(delta)) throw new TypeError("Data civil inválida");
  const shifted = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + delta));
  return formatISO({
    y: shifted.getUTCFullYear(),
    m: shifted.getUTCMonth() + 1,
    d: shifted.getUTCDate(),
  });
}

export function daysInMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function monthRange(y, m) {
  if (!isValidCivil(y, m, 1)) return null;
  return {
    start: formatISO({ y, m, d: 1 }),
    end: formatISO({ y, m, d: daysInMonth(y, m) }),
  };
}

export function weekRangeMonday(iso) {
  const parts = partsOf(iso);
  if (!parts) return null;
  const weekday = new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).getUTCDay();
  const mondayOffset = weekday === 0 ? -6 : 1 - weekday;
  const start = addDays(iso, mondayOffset);
  return { start, end: addDays(start, 6) };
}

export function inRange(iso, start, end) {
  return isISODate(iso) && isISODate(start) && isISODate(end) && iso >= start && iso <= end;
}

export function parseFlexibleDate(token) {
  if (typeof token !== "string") return null;
  let match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(token);
  if (match) {
    const iso = formatISO({ y: Number(match[3]), m: Number(match[2]), d: Number(match[1]) });
    return isISODate(iso) ? iso : null;
  }
  match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(token);
  if (match) {
    const iso = `${match[1]}-${match[2]}-${match[3]}`;
    return isISODate(iso) ? iso : null;
  }
  return null;
}

export function previousMonth(y, m) {
  return m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
}
