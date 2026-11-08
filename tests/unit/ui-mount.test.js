/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, test } from "vitest";
import { mount } from "../../src/ui/app.js";
import { balanceSignature } from "../../src/engine/ledger.js";
import { STORAGE_KEY, createMemoryStorage } from "../../src/engine/storage.js";

function setup(initial) {
  document.body.innerHTML = `<div id="app"></div>`;
  const storage = createMemoryStorage(initial);
  const app = document.querySelector("#app");
  mount(app, { storage, persistent: true });
  return { app, storage };
}

function ask(app, text) {
  const textarea = app.querySelector("#pergunta");
  textarea.value = text;
  textarea.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("chat no DOM", () => {
  test("mostra os avisos permanentes e a data de referência", () => {
    const { app } = setup();
    expect(app.querySelector("#aviso-demonstracao").textContent).toBe("Demonstração · Dados fictícios locais");
    expect(app.querySelector("#aviso-regras").textContent).toBe(
      "Respostas por regras locais. Sem IA generativa ou MCP conectado.",
    );
    expect(app.textContent).toContain("01/11/2026");
    expect(app.querySelector("h1").textContent).toContain("Diego");
  });

  test("saldo não não imprime valor e o html do usuário não vira nó", () => {
    const { app } = setup();
    ask(app, "saldo não");
    expect(app.textContent).not.toContain("US$ 110,00");
    ask(app, `<img src="x" onerror="alert(1)"><script>alert(1)</script>`);
    expect(app.querySelector("img")).toBeNull();
    expect(app.querySelector("script")).toBeNull();
    expect(app.textContent).toContain("<img");
    expect(app.textContent).toContain("<script>");
  });

  test("vazio não envia e Shift+Enter não envia", () => {
    const { app } = setup();
    const before = app.querySelectorAll(".message-user").length;
    ask(app, "   ");
    expect(app.querySelector("#erro-pergunta").textContent).toMatch(/Escreva uma pergunta/);
    expect(app.querySelectorAll(".message-user")).toHaveLength(before);
    const textarea = app.querySelector("#pergunta");
    textarea.value = "Saldos";
    const event = new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true });
    textarea.dispatchEvent(event);
    expect(app.querySelectorAll(".message-user")).toHaveLength(before);
    expect(textarea.value).toBe("Saldos");
  });

  test("Enter em Saldos mostra separação e nova conversa guarda a anterior", () => {
    const { app, storage } = setup();
    ask(app, "Saldos");
    expect(app.textContent).toContain("US$ 320,00");
    expect(app.textContent).toContain("US$ 5.430,00");
    expect(app.textContent).not.toContain("US$ 5.750,00");
    app.querySelector("#nova-conversa").click();
    expect(app.querySelectorAll(".message-user")).toHaveLength(0);
    const buttons = [...app.querySelectorAll(".history-item")];
    expect(buttons.length).toBeGreaterThan(1);
    buttons.find((button) => button.textContent.includes("Saldos")).click();
    expect(app.textContent).toContain("US$ 110,00");
    expect(storage.getItem(STORAGE_KEY)).toContain("afs-diego-v1");
  });

  test("não grava senha nem número longo e não altera saldo", () => {
    const before = balanceSignature();
    const { app, storage } = setup();
    ask(app, "minha senha é secreta");
    ask(app, "0000000000000000");
    const saved = storage.getItem(STORAGE_KEY);
    expect(saved).not.toContain("minha senha é secreta");
    expect(saved).not.toContain("0000000000000000");
    expect(app.textContent).not.toContain("minha senha é secreta");
    expect(app.textContent).not.toContain("0000000000000000");
    expect(balanceSignature()).toBe(before);
    expect(app.querySelector("input[type='password']")).toBeNull();
  });

  test("histórico inválido é avisado", () => {
    const { app } = setup({ [STORAGE_KEY]: "{\"schema\":\"velho\"}" });
    expect(app.querySelector("#status").textContent).toMatch(/descartado/i);
  });
});
