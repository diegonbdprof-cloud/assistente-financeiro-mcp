function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = String(value);
    else if (key === "text") node.textContent = String(value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function lines(card) {
  const list = el("dl", { class: "kv" });
  for (const line of card.lines) {
    list.append(el("dt", { text: line.label }), el("dd", { text: line.value }));
  }
  return list;
}

function renderBlock(block, onSuggestion) {
  if (block.type === "paragraph") return el("p", { text: block.text });
  if (block.type === "cards") {
    return el(
      "div",
      { class: "cards" },
      block.items.map((card) =>
        el(
          "section",
          { class: "card" },
          el("div", { class: "card-top" }, el("h3", { text: card.title }), el("p", { class: "badge", text: card.badge })),
          lines(card),
        ),
      ),
    );
  }
  if (block.type === "groups") {
    return el(
      "ul",
      { class: "groups" },
      block.items.map((item) =>
        el(
          "li",
          {},
          el("div", { class: "group-label" }, el("span", { text: item.label }), el("strong", { text: item.value })),
          el("span", { class: "bar", "aria-hidden": "true" }, el("span", { class: "bar-fill", style: `width:${barWidth(block.items, item)}` })),
          el("p", { class: "group-note", text: item.note }),
        ),
      ),
    );
  }
  if (block.type === "trace") return renderTrace(block.trace);
  return el("p", { text: "" });
}

function barWidth(items, item) {
  const amounts = items.map((entry) => {
    const digits = String(entry.note).match(/=\s(-?\d+)\s*$/);
    return digits ? Math.abs(Number(digits[1])) : 0;
  });
  const max = Math.max(...amounts, 1);
  const own = String(item.note).match(/=\s(-?\d+)\s*$/);
  const value = own ? Math.abs(Number(own[1])) : 0;
  return `${Math.max(6, Math.round((value / max) * 100))}%`;
}

function renderTrace(trace) {
  const rows = [
    ["Arquivo", trace.sourceFile],
    ["Identificador", trace.fixtureId],
    ["Data de referência", trace.referenceDate],
    ["Fuso civil", trace.timeZone],
    ["Período", trace.period],
    ["Amostra", trace.sampleCount],
    ["Após o filtro", trace.matchedCount],
    ["Resultado", trace.result],
  ];
  if (trace.asideResult) rows.push(["À parte", trace.asideResult]);
  const body = el("div", { class: "trace-body" });
  const meta = el("dl", { class: "kv" });
  for (const [label, value] of rows) {
    if (!value) continue;
    meta.append(el("dt", { text: label }), el("dd", { text: value }));
  }
  body.append(meta);
  if (trace.filters?.length) {
    body.append(el("ul", { class: "plain" }, trace.filters.map((item) => el("li", { text: item }))));
  }
  body.append(el("p", { class: "formula-label", text: "Fórmula em centavos inteiros" }), el("code", { class: "formula", text: trace.formula }));
  if (trace.asideFormula) {
    body.append(el("p", { class: "formula-label", text: "Fórmula à parte" }), el("code", { class: "formula", text: trace.asideFormula }));
  }
  body.append(
    el("p", { class: "formula-label", text: "Registros nesta soma" }),
    el("p", { text: trace.includedIds.length ? trace.includedIds.join(", ") : "nenhum" }),
  );
  if (trace.excluded?.length) {
    body.append(
      el("p", { class: "formula-label", text: "Fora desta soma" }),
      el(
        "ul",
        { class: "plain" },
        trace.excluded.map((item) => el("li", { text: `${item.id}: ${item.reason}` })),
      ),
    );
  }
  return el("details", { class: "trace", open: "open" }, el("summary", { text: "Memória de cálculo" }), body);
}

export function renderMessage(message, onSuggestion) {
  const article = el("article", {
    "aria-label": message.role === "user" ? "Sua pergunta" : "Resposta do laboratório",
  });
  if (message.role === "user") {
    article.append(el("p", { class: "who", text: "Você" }), el("p", { class: "user-text", text: message.text }));
  } else if (message.view) {
    article.append(el("p", { class: "who", text: "Laboratório" }), el("h2", { text: message.view.title }));
    for (const block of message.view.blocks) article.append(renderBlock(block, onSuggestion));
    if (message.view.suggestions?.length) {
      article.append(
        el(
          "div",
          { class: "inline-suggestions", role: "group", "aria-label": "Sugestões desta resposta" },
          message.view.suggestions.map((label) =>
            el("button", { type: "button", class: "chip", text: label }, ),
          ),
        ),
      );
      for (const button of article.querySelectorAll(".inline-suggestions button")) {
        button.addEventListener("click", () => onSuggestion(button.textContent));
      }
    }
  }
  return el("li", { class: `message message-${message.role}`, "data-tone": message.view?.tone || "user" }, article);
}

export function fillTranscript(list, messages, onSuggestion) {
  list.replaceChildren(...messages.map((message) => renderMessage(message, onSuggestion)));
}

export { el };
