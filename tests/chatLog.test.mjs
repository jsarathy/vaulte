// tests/chatLog.test.mjs — the Claude chat's history and messages (Fix 26 PR 20)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_CONTEXT_LIMIT,
  lastMessages,
  withMessage,
  chatMealName,
  chatMealIn,
} from "../src/lib/chatLog.js";

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
  assert.equal(chatMealName({ ...ctx, chatMealId: "__slot__🌙 Dinner" }), "🌙 Dinner");
});

test("the chosen meal in the day logged to: by id, a slot by name, else null (Fix 30)", () => {
  const day = {
    meals: [
      { id: "m1", name: "☕ Breakfast" },
      { id: "m2", name: "Tea" },
    ],
  };
  assert.equal(chatMealIn(day, "m2"), "m2");
  assert.equal(chatMealIn(day, "__slot__☕ Breakfast"), "m1");
  assert.equal(chatMealIn(day, "__slot__🌙 Dinner"), null);
  assert.equal(chatMealIn(day, "zz"), null); // another day's meal
});
