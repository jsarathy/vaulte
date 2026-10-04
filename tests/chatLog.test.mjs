// tests/chatLog.test.mjs — the Claude chat's history and messages (Fix 26 PR 20)
import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAT_CONTEXT_LIMIT, lastMessages, withMessage, chatMealName } from "../src/lib/chatLog.js";

test("last 30 messages", () => {
  assert.equal(CHAT_CONTEXT_LIMIT, 30);
  const h = Array.from({ length: 32 }, (_, i) => i);
  assert.deepEqual(lastMessages(h), h.slice(2));
  assert.deepEqual(lastMessages([1, 2]), [1, 2]);
});

test("one message changed", () => {
  const list = [
    { id: "a", text: "x" },
    { id: "b", text: "…" },
  ];
  assert.deepEqual(withMessage(list, "b", { text: "hi", type: "claude" }), [
    { id: "a", text: "x" },
    { id: "b", text: "hi", type: "claude" },
  ]);
  assert.equal(list[1].text, "…"); // not mutated
});

test("meal name: chat day's meal, else the open day's, else Meal", () => {
  const day = (date, id, name) => ({ date, meals: [{ id, name }] });
  const ctx = {
    allDays: [day("d1", "m1", "Lunch")],
    chatDate: "d1",
    currentDayData: day("d2", "m2", "Tea"),
    chatMealId: "m1",
  };
  assert.equal(chatMealName(ctx), "Lunch");
  assert.equal(chatMealName({ ...ctx, chatDate: "d9", chatMealId: "m2" }), "Tea");
  assert.equal(chatMealName({ ...ctx, chatMealId: "zz" }), "Meal");
  assert.equal(chatMealName({ ...ctx, chatDate: "d9", currentDayData: null }), "Meal");
});
