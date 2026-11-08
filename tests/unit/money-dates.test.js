import { describe, expect, test } from "vitest";
import { addDays, formatBR, inRange, monthRange, parseFlexibleDate, weekRangeMonday } from "../../src/engine/dates.js";
import { formatPlaidAmount, formatUsd, sumCents } from "../../src/engine/money.js";
import { FIXTURE_META } from "../../src/data/fixture.js";

describe("centavos", () => {
  test("formata dólares e nulo sem float", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(formatUsd(null)).toBe("Não informado");
    expect(formatUsd(undefined)).toBe("Não informado");
    expect(formatUsd(0)).toBe("US$ 0,00");
    expect(formatUsd(1)).toBe("US$ 0,01");
    expect(formatUsd(100)).toBe("US$ 1,00");
    expect(formatUsd(11000)).toBe("US$ 110,00");
    expect(formatUsd(502000)).toBe("US$ 5.020,00");
    expect(formatUsd(498000)).toBe("US$ 4.980,00");
    expect(formatUsd(1000000)).toBe("US$ 10.000,00");
    expect(formatUsd(-75)).toBe("-US$ 0,75");
    expect(formatUsd(-250000)).toBe("-US$ 2.500,00");
  });

  test("rejeita valor que não é centavo inteiro", () => {
    expect(() => formatUsd(110.5)).toThrow(TypeError);
    expect(() => sumCents([10, 0.2])).toThrow(TypeError);
  });

  test("convenção Plaid: positivo sai, negativo entra", () => {
    expect(formatPlaidAmount(1860)).toBe("Saída US$ 18,60");
    expect(formatPlaidAmount(-250000)).toBe("Entrada US$ 2.500,00");
    expect(formatPlaidAmount(0)).toBe("Neutro US$ 0,00");
    expect(formatPlaidAmount(null)).toBe("Não informado");
  });

  test("soma inteira", () => {
    expect(sumCents([11000, 21000])).toBe(32000);
    expect(sumCents([41000, 502000])).toBe(543000);
    expect(sumCents([])).toBe(0);
  });
});

describe("datas civis", () => {
  test("não desloca o dia ao formatar ISO", () => {
    expect(formatBR("2026-10-01")).toBe("01/10/2026");
    expect(addDays("2026-10-01", 0)).toBe("2026-10-01");
    expect(parseFlexibleDate("31/02/2026")).toBeNull();
    expect(parseFlexibleDate("01/10/2026")).toBe("2026-10-01");
  });

  test("intervalo inclusivo e semana da data de referência", () => {
    expect(inRange("2026-10-01", "2026-10-01", "2026-10-05")).toBe(true);
    expect(inRange("2026-10-05", "2026-10-01", "2026-10-05")).toBe(true);
    expect(inRange("2026-10-06", "2026-10-01", "2026-10-05")).toBe(false);
    expect(weekRangeMonday(FIXTURE_META.referenceDate)).toEqual({
      start: "2026-10-26",
      end: "2026-11-01",
    });
    expect(monthRange(2026, 10)).toEqual({ start: "2026-10-01", end: "2026-10-31" });
    expect(addDays("2026-11-01", -6)).toBe("2026-10-26");
  });
});
