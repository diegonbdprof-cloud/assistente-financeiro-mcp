import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/ui",
  timeout: 30000,
  fullyParallel: false,
  use: {
    baseURL: "http://127.0.0.1:4173/assistente-financeiro-mcp/",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
  },
  webServer: {
    command: "npm run build && node scripts/serve-subpath.mjs",
    url: "http://127.0.0.1:4173/assistente-financeiro-mcp/",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
