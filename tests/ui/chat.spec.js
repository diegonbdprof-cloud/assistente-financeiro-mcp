import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";

test.beforeEach(async ({ page }) => {
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    expect(host).toBe("127.0.0.1");
  });
  await page.goto("./");
});

async function noHorizontalOverflow(page) {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra).toBeLessThanOrEqual(1);
}

test("avisos, saldos e separação no chat", async ({ page }) => {
  await expect(page.getByText("Demonstração · Dados fictícios locais")).toBeVisible();
  await expect(page.getByText("Respostas por regras locais. Sem IA generativa ou MCP conectado.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Assistente financeiro de estudos — Diego" })).toBeVisible();
  await page.getByRole("button", { name: "Saldos", exact: true }).first().click();
  await expect(page.getByText("US$ 110,00").first()).toBeVisible();
  await expect(page.getByText("US$ 5.430,00").first()).toBeVisible();
  await expect(page.getByText("Não informado").first()).toBeVisible();
  await expect(page.getByText("US$ 5.750,00")).toHaveCount(0);
  const order = await page.evaluate(() => {
    const top = (selector) => {
      const node = document.querySelector(selector);
      return node.getBoundingClientRect().top + window.scrollY;
    };
    const composer = document.querySelector("#composer");
    const previous = composer.style.position;
    composer.style.position = "static";
    const flow = { user: top(".message-user"), card: top(".card"), form: top("#composer") };
    composer.style.position = previous;
    return flow;
  });
  expect(order.user).toBeLessThan(order.card);
  expect(order.card).toBeLessThan(order.form);
  await expect(page.getByRole("button", { name: /Pagar|Transferir|Entrar/ })).toHaveCount(0);
});

test("teclado, vazio, alimentação e nova conversa", async ({ page }) => {
  const box = page.getByLabel("Sua pergunta");
  await box.focus();
  await box.press("Enter");
  await expect(page.getByRole("alert")).toHaveText("Escreva uma pergunta antes de enviar.");
  await box.fill("Alimentação");
  await box.press("Shift+Enter");
  await expect(box).toHaveValue("Alimentação\n");
  await expect(page.getByText("US$ 165,70")).toHaveCount(0);
  await box.fill("Alimentação");
  await box.press("Enter");
  await expect(page.getByText("US$ 165,70").first()).toBeVisible();
  await expect(page.getByText("US$ 15,90").first()).toBeVisible();
  await expect(page.getByText("Memória de cálculo").first()).toBeVisible();
  await page.getByRole("button", { name: "Nova conversa" }).click();
  await expect(page.getByText("US$ 165,70")).toHaveCount(0);
  await page.getByRole("button", { name: /Alimentação/ }).first().click();
  await expect(page.getByText("US$ 165,70").first()).toBeVisible();
});

test("html da pergunta permanece texto", async ({ page }) => {
  const box = page.getByLabel("Sua pergunta");
  const payload = `<img src=x onerror=alert(1)>`;
  await box.fill(payload);
  await box.press("Enter");
  expect(await page.locator("img").count()).toBe(0);
  await expect(page.getByText(payload, { exact: false })).toBeVisible();
});

test("viewports sem overflow horizontal", async ({ page }) => {
  await page.getByRole("button", { name: "Resumo", exact: true }).first().click();
  await expect(page.getByText("US$ 387,60").first()).toBeVisible();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width === 1440 ? 900 : 800 });
    if (width < 900) {
      await page.getByRole("button", { name: "Conversas" }).click();
    }
    await noHorizontalOverflow(page);
    await expect(page.getByText("Demonstração · Dados fictícios locais")).toBeVisible();
  }
});

test("fuso do navegador não muda a referência", async ({ browser }) => {
  const context = await browser.newContext({ locale: "pt-BR", timezoneId: "Pacific/Kiritimati" });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4173/assistente-financeiro-mcp/");
  await expect(page.locator("time")).toHaveText("01/11/2026");
  await page.getByRole("button", { name: "Saldos", exact: true }).first().click();
  await expect(page.getByText("US$ 110,00").first()).toBeVisible();
  await context.close();
});

test("axe sem violação crítica ou grave", async ({ page }) => {
  await page.getByRole("button", { name: "Contas", exact: true }).first().click();
  await expect(page.getByText("Plaid Checking").first()).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  const serious = results.violations.filter((item) => item.impact === "serious" || item.impact === "critical");
  expect(serious.map((item) => item.id)).toEqual([]);
});

test("captura telas do chat", async ({ page }) => {
  fs.mkdirSync("docs/imagens", { recursive: true });
  await page.addStyleTag({ content: "#composer { position: static !important; }" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("button", { name: "Saldos", exact: true }).first().click();
  await expect(page.getByText("US$ 320,00").first()).toBeVisible();
  await page.screenshot({ path: "docs/imagens/desktop-saldos.png", fullPage: true });
  await page.getByRole("button", { name: "Últimas transações", exact: true }).first().click();
  await expect(page.getByText("Lanchonete do Campus")).toBeVisible();
  await page.screenshot({ path: "docs/imagens/desktop-transacoes.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "docs/imagens/mobile-chat.png", fullPage: true });
});
