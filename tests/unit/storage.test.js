import { describe, expect, test } from "vitest";
import { answerQuestion } from "../../src/engine/answer.js";
import {
  SCHEMA,
  STORAGE_KEY,
  createMemoryStorage,
  isView,
  loadState,
  saveState,
} from "../../src/engine/storage.js";

describe("histórico local", () => {
  test("grava e relê só o esquema conhecido", () => {
    const storage = createMemoryStorage();
    const view = answerQuestion("Contas").view;
    expect(isView(view)).toBe(true);
    const state = {
      schema: SCHEMA,
      activeId: "c_1",
      conversations: [
        {
          id: "c_1",
          createdAt: "2026-11-08T12:00:00.000Z",
          title: "Contas",
          messages: [
            { id: "m_1", role: "user", text: "Contas", view: null },
            { id: "m_2", role: "assistant", view },
          ],
        },
      ],
    };
    expect(saveState(storage, state)).toBe(true);
    expect(loadState(storage).activeId).toBe("c_1");
    expect(storage.getItem(STORAGE_KEY)).toContain(SCHEMA);
  });

  test("descarta esquema errado, protótipo e texto inválido", () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ schema: "outro", conversations: [] }));
    const rejected = loadState(storage);
    expect(rejected.conversations).toEqual([]);
    expect(rejected.notice).toMatch(/descartado/i);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();

    const polluted = createMemoryStorage();
    polluted.setItem(
      STORAGE_KEY,
      '{"schema":"afs-diego-v1","activeId":null,"conversations":[],"__proto__":{"admin":true}}',
    );
    expect(loadState(polluted).notice).toMatch(/descartado/i);
    expect(Object.prototype.admin).toBeUndefined();

    const broken = createMemoryStorage({ [STORAGE_KEY]: "{não é json" });
    expect(loadState(broken).notice).toMatch(/ilegível|descartado/i);
  });

  test("não aceita view com marcação", () => {
    expect(isView({ kind: "local-rules-v1", tone: "answer", title: "<script>", blocks: [], suggestions: [] })).toBe(false);
  });
});
