import { FIXTURE_META } from "../data/fixture.js";
import { answerQuestion, errorView } from "../engine/answer.js";
import { formatBR } from "../engine/dates.js";
import { shouldDropUserText } from "../engine/parse.js";
import { SCHEMA, STORAGE_KEY, createMemoryStorage, isView, loadState, saveState } from "../engine/storage.js";
import { el, fillTranscript } from "./render.js";

const CHIPS = ["Contas", "Saldos", "Últimas transações", "Alimentação", "Resumo"];

function greetingView() {
  return {
    kind: "local-rules-v1",
    tone: "answer",
    title: "Laboratório local",
    blocks: [
      {
        type: "paragraph",
        text: "Olá. Eu sou o assistente de estudos do Diego. Calculo só com regras deste navegador, sobre uma amostra fictícia em dólares.",
      },
      {
        type: "paragraph",
        text: "Não há banco, Plaid, Pluggy, MCP nem modelo generativo ligado a esta página.",
      },
      {
        type: "paragraph",
        text: `A data de referência da amostra é ${formatBR(FIXTURE_META.referenceDate)} (${FIXTURE_META.timeZone}). Ela não acompanha o relógio deste computador.`,
      },
    ],
    suggestions: CHIPS,
  };
}

function browserStorage() {
  try {
    const probe = `${STORAGE_KEY}-probe`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return { storage: window.localStorage, persistent: true };
  } catch {
    return { storage: createMemoryStorage(), persistent: false };
  }
}

function formatOpened(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "horário não informado";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: FIXTURE_META.timeZone,
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "horário não informado";
  }
}

function statusFor(view) {
  if (!view) return "Não consegui calcular. A amostra não foi alterada.";
  if (view.tone === "empty") return "Nenhum registro da amostra nesse filtro.";
  if (view.tone === "error") return "Não consegui calcular. A amostra não foi alterada.";
  if (view.tone === "answer") return "Resposta pronta. Cálculo local, sem rede.";
  return "Não calculei um valor.";
}

export function mount(container, options = {}) {
  const provided = options.storage ? { storage: options.storage, persistent: options.persistent !== false } : browserStorage();
  const storage = provided.storage;
  let persistent = provided.persistent;
  let state = loadState(storage);
  let seq = 0;
  const createId =
    options.createId ||
    ((prefix) => {
      seq += 1;
      const rand = Math.random().toString(36).slice(2, 8);
      return `${prefix}_${seq.toString(36)}_${rand}`;
    });

  container.replaceChildren();
  const skip = el("a", { class: "skip", href: "#conversa", text: "Ir para a conversa" });
  const header = el(
    "header",
    { class: "site-header" },
    el(
      "div",
      { class: "brand" },
      el("span", { class: "mono", "aria-hidden": "true", text: "D" }),
      el(
        "div",
        {},
        el("p", { class: "eyebrow", text: "Laboratório acadêmico · sem vínculo bancário" }),
        el("h1", { text: "Assistente financeiro de estudos — Diego" }),
      ),
    ),
    el("button", { type: "button", class: "ghost", id: "nova-conversa", text: "Nova conversa" }),
  );
  const banner = el(
    "div",
    { class: "banner", role: "note" },
    el("p", { id: "aviso-demonstracao", text: "Demonstração · Dados fictícios locais" }),
    el(
      "p",
      {},
      "Data de referência: ",
      el("time", { datetime: FIXTURE_META.referenceDate, text: formatBR(FIXTURE_META.referenceDate) }),
      ` (${FIXTURE_META.timeZone}). Os cálculos não usam o relógio deste computador.`,
    ),
    el("p", { id: "aviso-regras", text: "Respostas por regras locais. Sem IA generativa ou MCP conectado." }),
  );
  const historyButton = el("button", {
    type: "button",
    id: "abrir-historico",
    class: "history-toggle",
    "aria-expanded": "false",
    "aria-controls": "lista-conversas",
    text: "Conversas",
  });
  const historyList = el("ol", { id: "lista-conversas", class: "history-list" });
  const clearButton = el("button", { type: "button", class: "text-button", id: "apagar-historico", text: "Apagar histórico local" });
  const aside = el(
    "aside",
    { id: "historico", "aria-label": "Conversas anteriores" },
    historyButton,
    el("h2", { class: "aside-title", text: "Neste navegador" }),
    historyList,
    clearButton,
  );
  const status = el("div", { id: "status", role: "status", "aria-live": "polite" });
  const transcript = el("ol", { id: "conversa", "aria-label": "Mensagens da conversa", "aria-live": "polite", "aria-relevant": "additions" });
  const error = el("p", { id: "erro-pergunta", class: "input-error", role: "alert" });
  const textarea = el("textarea", {
    id: "pergunta",
    name: "pergunta",
    rows: "3",
    maxlength: "4000",
    required: "required",
    "aria-describedby": "ajuda-pergunta erro-pergunta",
  });
  textarea.placeholder = "Pergunte sobre contas, saldos ou transações da amostra";
  const form = el(
    "form",
    { id: "composer", class: "composer" },
    el("div", { class: "chips", role: "group", "aria-label": "Sugestões" }, CHIPS.map((label) => el("button", { type: "button", class: "chip", text: label }))),
    el("label", { for: "pergunta", text: "Sua pergunta" }),
    textarea,
    el("p", {
      id: "ajuda-pergunta",
      class: "help",
      text: "Enter envia. Shift+Enter quebra a linha. Uma pergunta vazia não é enviada.",
    }),
    error,
    el("button", { type: "submit", class: "send", text: "Enviar" }),
  );
  const storageNote = el("p", {
    id: "aviso-armazenamento",
    class: "storage-note",
    text: persistent
      ? `O histórico, se gravado, fica só neste navegador (localStorage, esquema ${SCHEMA}). Nenhuma pergunta é enviada a um servidor.`
      : "Não gravei histórico: o armazenamento deste navegador não está disponível. A conversa dura até recarregar a página.",
  });
  const main = el("main", { id: "conteudo" }, status, el("div", { class: "thread" }, transcript), form, storageNote);
  const footer = el(
    "footer",
    { class: "site-footer" },
    el(
      "p",
      {
        text: "Marca autoral deste repositório. O monograma D identifica o laboratório do Diego e não é o de uma instituição financeira.",
      },
    ),
    el(
      "p",
      {
        text: "Saldos: transcrição do guia, página 26. Transações: fixture autoral em src/data/fixture.js. Publicação da página: pendente.",
      },
    ),
  );
  container.append(skip, header, banner, el("div", { class: "layout" }, aside, main), footer);

  function current() {
    return state.conversations.find((item) => item.id === state.activeId) || null;
  }

  function persist() {
    const ok = saveState(storage, {
      schema: SCHEMA,
      activeId: state.activeId,
      conversations: state.conversations,
    });
    if (!ok) persistent = false;
    return ok;
  }

  function assistantMessage(view) {
    const safe = isView(view) ? view : errorView();
    return { id: createId("m"), role: "assistant", view: safe };
  }

  function startConversation() {
    const conversation = {
      id: createId("c"),
      createdAt: new Date().toISOString(),
      title: "Conversa nova",
      messages: [assistantMessage(greetingView())],
    };
    state.conversations = [conversation, ...state.conversations].slice(0, 20);
    state.activeId = conversation.id;
    persist();
    paint();
    textarea.focus();
  }

  function paint() {
    const conversation = current();
    fillTranscript(transcript, conversation ? conversation.messages : [], ask);
    historyList.replaceChildren();
    if (state.conversations.length === 0) {
      historyList.append(el("li", {}, el("p", { text: "Nenhuma conversa arquivada ainda." })));
    } else {
      for (const item of state.conversations) {
        const button = el("button", {
          type: "button",
          class: "history-item",
          "aria-current": item.id === state.activeId ? "true" : "false",
        });
        button.append(
          el("span", { class: "history-title", text: item.title }),
          el("span", { class: "history-time", text: `Aberta neste navegador · ${formatOpened(item.createdAt)}` }),
        );
        button.addEventListener("click", () => {
          state.activeId = item.id;
          persist();
          paint();
        });
        historyList.append(el("li", {}, button));
      }
    }
    if (state.notice) status.textContent = state.notice;
  }

  function showInputError(message) {
    error.textContent = message;
    textarea.setAttribute("aria-invalid", "true");
    status.textContent = message;
    textarea.focus();
  }

  function clearInputError() {
    error.textContent = "";
    textarea.removeAttribute("aria-invalid");
  }

  function ask(text) {
    const trimmed = String(text ?? "").trim();
    if (!trimmed) {
      showInputError("Escreva uma pergunta antes de enviar.");
      return;
    }
    clearInputError();
    const conversation = current();
    if (!conversation) startConversation();
    const active = current();
    state.notice = "";
    const drop = shouldDropUserText(trimmed);
    let result;
    try {
      result = answerQuestion(trimmed);
    } catch {
      result = { view: errorView(), dropUserText: drop };
    }
    if (!isView(result.view)) result = { view: errorView(), dropUserText: drop || result.dropUserText };
    if (!(drop || result.dropUserText)) {
      if (active.title === "Conversa nova") {
        const cleaned = trimmed.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
        active.title = (cleaned || "Pergunta").slice(0, 48);
      }
      active.messages.push({ id: createId("m"), role: "user", text: trimmed, view: null });
    }
    active.messages.push(assistantMessage(result.view));
    if (active.messages.length > 40) active.messages = active.messages.slice(-40);
    persist();
    paint();
    status.textContent = statusFor(result.view);
    textarea.value = "";
  }

  header.querySelector("#nova-conversa").addEventListener("click", () => {
    startConversation();
    if (!state.notice) status.textContent = "Nova conversa. A amostra é a mesma.";
  });
  clearButton.addEventListener("click", () => {
    try {
      storage.removeItem(STORAGE_KEY);
    } catch {
      /* memória apenas */
    }
    state = { schema: SCHEMA, activeId: null, conversations: [], notice: "" };
    startConversation();
    status.textContent = "Histórico local apagado. A amostra financeira não foi alterada.";
  });
  historyButton.addEventListener("click", () => {
    const open = aside.classList.toggle("is-open");
    historyButton.setAttribute("aria-expanded", open ? "true" : "false");
  });
  for (const chip of form.querySelectorAll(".chips .chip")) {
    chip.addEventListener("click", () => ask(chip.textContent));
  }
  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      ask(textarea.value);
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    ask(textarea.value);
  });

  if (!state.activeId || !current()) startConversation();
  else paint();
  if (state.notice) status.textContent = state.notice;

  return { ask, storageKey: STORAGE_KEY };
}
