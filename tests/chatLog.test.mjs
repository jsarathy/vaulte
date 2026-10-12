// tests/chatLog.test.mjs — the Claude chat's history and messages (Fix 26 PR 20)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_CONTEXT_LIMIT,
  CHAT_MAX_BYTES,
  CHAT_WARN_BYTES,
  chatCostText,
  chatSize,
  historyBytes,
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

test("the chat's size: bytes of the messages, a warning at 15 KB, full at 20 KB", () => {
  assert.equal(CHAT_WARN_BYTES, 15_000);
  assert.equal(CHAT_MAX_BYTES, 20_000);
  assert.equal(historyBytes([]), 0);
  assert.equal(historyBytes([{ content: "abc" }, { content: "de" }]), 5);
  assert.equal(historyBytes([{ content: "é" }]), 2); // bytes, not characters
  assert.equal(historyBytes([{ role: "user" }, { content: null }]), 0);
  assert.equal(chatSize(0), "ok");
  assert.equal(chatSize(14_999), "ok");
  assert.equal(chatSize(15_000), "warn");
  assert.equal(chatSize(19_999), "warn");
  assert.equal(chatSize(20_000), "full");
});

test("chatCostText: input cost per message, 4 bytes a token at $3 per million", () => {
  assert.equal(chatCostText(0), "$0.000");
  assert.equal(chatCostText(15_000), "$0.011");
  assert.equal(chatCostText(20_000), "$0.015");
  assert.equal(chatCostText(1_000_000), "$0.750");
});
