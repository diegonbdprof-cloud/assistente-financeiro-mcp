import fs from "node:fs";
import path from "node:path";

const htmlPath = path.resolve("dist/index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const assetRefs = [...html.matchAll(/\b(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
const localAssets = assetRefs.filter((ref) => !ref.startsWith("data:") && !ref.startsWith("#"));

if (localAssets.length === 0) {
  throw new Error("dist/index.html não referencia assets");
}
for (const ref of localAssets) {
  if (/^https?:\/\//i.test(ref) || ref.startsWith("//")) {
    throw new Error(`asset externo em ${ref}`);
  }
  if (ref.startsWith("/")) {
    throw new Error(`asset absoluto na raiz em ${ref}; use caminho relativo`);
  }
  const file = path.resolve("dist", ref.replace(/^\.\//, ""));
  if (!fs.existsSync(file)) throw new Error(`asset ausente: ${ref}`);
}
if (!html.includes("./assets/")) throw new Error("esperava ./assets/ no HTML gerado");

const bundled = fs.readdirSync(path.resolve("dist/assets")).map((name) => fs.readFileSync(path.resolve("dist/assets", name), "utf8")).join("\n");
for (const banned of ["mcp.pluggy.ai", "sandbox.plaid.com", "googletagmanager", "google-analytics", "fonts.googleapis"]) {
  if (html.includes(banned) || bundled.includes(banned)) {
    throw new Error(`referência indevida no build: ${banned}`);
  }
}

console.log(`dist ok: ${localAssets.length} referências relativas`);
