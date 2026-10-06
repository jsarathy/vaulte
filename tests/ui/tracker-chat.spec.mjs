// tests/ui/tracker-chat.spec.mjs — the Claude chat on NutritionTracker (Fix 26 PR 20): asking
// questions (history kept, limited, saved), errors, clearing, logging food from the chat, and
// the page frame (tabs, header).
import { test, expect } from "@playwright/test";

const P = (x) => `users/u/${x}`;
const EGG = {
  name: "Egg",
  kcal: 70,
  fat: 5,
  sat_fat: 1,
  carbs: 0.4,
  sugar: 0,
  fibre: 0,
  net_carbs: 0.4,
  protein: 6,
};

const start = async (p, init = {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
};
const watch = (p) => {
  const out = { errs: [], logged: [] };
  p.on("pageerror", (e) => out.errs.push(e.message));
  p.on("console", (m) => m.type() === "error" && out.logged.push(m.text()));
  return out;
};
const openChat = (p) => p.getByTitle("Nutrition assistant").click();
const input = (p) => p.locator("textarea").last();
const ask = async (p, text) => {
  await input(p).fill(text);
  await input(p).press("Enter");
};
const ev = (p, f, a) => p.evaluate(f, a);
const chatSaves = (p) =>
  ev(p, () => window.__setDocs.filter((s) => s.path.endsWith("claude_chat/conversation")));
const mode = (p) => p.locator("select").filter({ has: p.locator('option[value="__chat__"]') });

test("chat: question, reply, history, errors, clear", async ({ page: p }) => {
  const w = watch(p);
  await start(p, {
    __recipes: [{ id: "r", name: "Stew", portion_g: 1, nutrition: { kcal: 1 } }],
    __noBackfill: true,
  });
  await openChat(p);
  await ev(p, () => {
    window.__chatReply = "sure thing";
    window.__chatDelay = 400;
  });
  await ask(p, "  hello  ");
  await expect(input(p)).toHaveValue("");
  await expect(p.getByText("hello", { exact: true })).toBeVisible();
  await expect(p.getByText("…", { exact: true })).toBeVisible(); // thinking
  // a second question while waiting is ignored (and stays in the box)
  await ask(p, "again");
  await expect(p.getByText("sure thing", { exact: true })).toBeVisible();
  await expect(p.getByText("…", { exact: true })).toHaveCount(0);
  await expect(input(p)).toHaveValue("again");
  expect(await ev(p, () => window.__chatCalls)).toEqual([[{ role: "user", content: "hello" }]]);
  expect(await ev(p, () => window.__chatRecipes[0])).toEqual(["Stew"]);
  const saves = await chatSaves(p);
  expect(saves.length).toBe(1);
  expect(saves[0].data).toEqual({
    history: [
      { role: "user", content: "hello" },
      { role: "assistant", content: "sure thing" },
    ],
    updatedAt: await ev(p, () => new Date().toISOString()),
  });
  // the next question carries the conversation
  await ev(p, () => (window.__chatDelay = 0));
  await ask(p, "and?");
  await expect.poll(() => ev(p, () => window.__chatCalls.length)).toBe(2);
  expect((await ev(p, () => window.__chatCalls[1])).map((h) => h.content)).toEqual([
    "hello",
    "sure thing",
    "and?",
  ]);
  // blank: nothing sent
  await ask(p, "   ");
  await p.waitForTimeout(200);
  expect(await ev(p, () => window.__chatCalls.length)).toBe(2);

  // errors: the reason in place of the reply; a failed save is logged
  await ev(p, () => (window.__failChat = true));
  await ask(p, "oops");
  await expect(p.getByText("Mock chat failure", { exact: true })).toBeVisible();
  await ev(p, () => {
    window.__failChat = false;
    window.__failSetDoc = true;
  });
  await ask(p, "save me");
  await expect
    .poll(() => w.logged.some((l) => l.startsWith("chat history save failed")))
    .toBe(true);
  await expect(p.getByText("sure thing")).toHaveCount(3);

  // Clear: messages and history gone (saved empty); a failed clear is logged
  await ev(p, () => (window.__failSetDoc = false));
  await p.getByTitle("Clear history").click();
  await expect(p.getByText("hello", { exact: true })).toHaveCount(0);
  const cleared = (await chatSaves(p)).at(-1).data;
  expect(cleared.history).toEqual([]);
  expect(cleared.updatedAt).toBeTruthy();
  await ask(p, "fresh");
  await expect.poll(() => ev(p, () => window.__chatCalls.at(-1).length)).toBe(1);
  await ev(p, () => (window.__failSetDoc = true));
  await p.getByTitle("Clear history").click();
  await expect
    .poll(() => w.logged.some((l) => l.startsWith("chat history clear failed")))
    .toBe(true);
  expect(w.errs).toEqual([]);
});

test("chat: not signed in — answered, nothing saved", async ({ page: p }) => {
  await start(p, { __userId: "" });
  await openChat(p);
  await ev(p, () => (window.__chatReply = "ok"));
  await ask(p, "hello");
  await expect(p.getByText("ok", { exact: true })).toBeVisible();
  await p.getByTitle("Clear history").click();
  await expect(p.getByText("ok", { exact: true })).toHaveCount(0);
  await p.waitForTimeout(200);
  expect(await chatSaves(p)).toEqual([]);
});

test("chat: only the last 30 messages are sent and kept", async ({ page: p }) => {
  const history = Array.from({ length: 30 }, (_, i) => ({
    role: i % 2 ? "assistant" : "user",
    content: "m" + i,
  }));
  await start(p, { __docs: { [P("claude_chat/conversation")]: { history } } });
  await openChat(p);
  await ev(p, () => (window.__chatReply = "r"));
  await ask(p, "q");
  await expect.poll(() => ev(p, () => window.__chatCalls?.length || 0)).toBe(1);
  const sent = await ev(p, () => window.__chatCalls[0]);
  expect(sent.length).toBe(30);
  expect([sent[0].content, sent.at(-1).content]).toEqual(["m1", "q"]);
  await expect.poll(async () => (await chatSaves(p)).length).toBe(1);
  const kept = (await chatSaves(p))[0].data.history;
  expect(kept.length).toBe(30);
  expect([kept[0].content, kept.at(-1).content]).toEqual(["m2", "r"]);
});

test("chat: log food to a meal", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  await openChat(p);
  // meal choices: the chat day's meals, exercise slots left out
  const opts = await mode(p)
    .locator("option")
    .evaluateAll((os) => os.map((o) => o.text));
  expect(opts[0]).toBe("Chat mode");
  expect(opts).toContain("Breakfast");
  expect(opts).not.toContain("🏋️ Morning Exercise");
  await mode(p).selectOption({ label: "Breakfast" });
  await ev(p, (e) => (window.__parseReply = [e, { ...e, name: "Toast", kcal: 80 }]), EGG);
  await ask(p, "  2 eggs and toast ");
  expect(await ev(p, () => window.__parseCalls)).toEqual(["2 eggs and toast"]);
  const logBtn = p.getByRole("button", { name: "Log to Breakfast" });
  await expect(logBtn).toBeVisible();
  expect(await ev(p, () => window.__chatCalls || [])).toEqual([]); // not a question
  await logBtn.click();
  await expect(p.getByText("Logged 2 items", { exact: true })).toBeVisible();
  const day = await ev(p, () => window.__savedDays.at(-1));
  expect(day.date).toBe("2026-10-01");
  const items = day.meals.find((m) => m.id === "m2026-10-01").items;
  expect(items.map((i) => i.name)).toEqual(["Apple", "Egg", "Toast"]);
  expect(items[1]).toMatchObject(EGG);
  expect(items[1].id).toBeTruthy();
  expect(items[1].id).not.toBe(items[2].id);

  // Discard drops a preview; a single item says "item"
  await ev(p, (e) => (window.__parseReply = [e]), EGG);
  await ask(p, "egg");
  await p.getByRole("button", { name: "Discard" }).click();
  await expect(p.getByRole("button", { name: "Log to Breakfast" })).toHaveCount(0);
  await ask(p, "egg");
  await p.getByRole("button", { name: "Log to Breakfast" }).click();
  await expect(p.getByText("Logged 1 item", { exact: true })).toBeVisible();

  // Another day: its stored copy is read (meal ids as stored); a day never stored gets the
  // default meals
  await p.locator('input[type="date"]').last().fill("2026-10-03");
  await mode(p).selectOption({ label: "Breakfast" });
  await ask(p, "egg");
  await p.getByRole("button", { name: "Log to Breakfast" }).click();
  await expect(p.getByText("Logged 1 item")).toHaveCount(2);
  const other = await ev(p, () => window.__savedDays.at(-1));
  expect(other.date).toBe("2026-10-03");
  expect(other.notes).toBe("Rest day");
  expect(other.meals.find((m) => m.id === "m2026-10-03").items.map((i) => i.name)).toEqual(["Egg"]);
  // a default slot that stored day doesn't have yet: added by name, the stored meals kept (Fix 30)
  await mode(p).selectOption({ label: "🌙 Dinner" });
  await ask(p, "egg");
  await p.getByRole("button", { name: "Log to 🌙 Dinner" }).click();
  await expect(p.getByText("Logged 1 item")).toHaveCount(3);
  const slotted = await ev(p, () => window.__savedDays.at(-1));
  expect(slotted.date).toBe("2026-10-03");
  expect(slotted.meals.find((m) => m.name === "🌙 Dinner").items.map((i) => i.name)).toEqual([
    "Egg",
  ]);
  expect(slotted.meals.some((m) => m.id === "m2026-10-03")).toBe(true);

  // a day never stored: its default meals are offered, and the food lands in the chosen one
  // (Fix 30)
  await p.locator('input[type="date"]').last().fill("2026-10-09");
  const newOpts = await mode(p)
    .locator("option")
    .evaluateAll((os) => os.map((o) => o.text));
  expect(newOpts).toEqual([
    "Chat mode",
    "☕ Breakfast",
    "🥤 Post-Workout",
    "🥗 Lunch",
    "🍎 Snack",
    "🌙 Dinner",
  ]);
  await mode(p).selectOption({ label: "🌙 Dinner" });
  await ask(p, "egg");
  await p.getByRole("button", { name: "Log to 🌙 Dinner" }).click();
  await expect(p.getByText("Logged 1 item")).toHaveCount(4);
  const added = await ev(p, () => window.__savedDays.at(-1));
  expect(added.date).toBe("2026-10-09");
  expect(added.notes).toBe("");
  expect(added.meals.find((m) => m.name === "🌙 Dinner").items.map((i) => i.name)).toEqual(["Egg"]);
  expect(added.meals.filter((m) => m.items.length).length).toBe(1);

  // a parse failure shows the reason
  await ev(p, () => (window.__failParse = true));
  await ask(p, "???");
  await expect(p.getByText("Mock parse failure", { exact: true })).toBeVisible();
  // back to chat mode: a question again
  await ev(p, () => (window.__failParse = false));
  await mode(p).selectOption("__chat__");
  await ask(p, "hi");
  await expect.poll(() => ev(p, () => window.__chatCalls?.length || 0)).toBe(1);
  expect(w.errs).toEqual([]);
});

test("chat: meal name falls back to 'Meal'; switching day resets the mode", async ({ page: p }) => {
  await start(p);
  await openChat(p);
  await mode(p).selectOption({ label: "Breakfast" });
  // the chat day changes to one whose meals don't include the chosen meal
  await p.locator('input[type="date"]').last().fill("2026-10-02");
  await ev(p, (e) => (window.__parseReply = [e]), EGG);
  await ask(p, "egg");
  await expect(p.getByRole("button", { name: "Log to Meal" })).toBeVisible();
  // logging it: an error, nothing saved (Fix 30)
  const saved = await ev(p, () => window.__savedDays?.length || 0);
  await p.getByRole("button", { name: "Log to Meal" }).click();
  await expect(
    p.getByText("Couldn't find that meal on 2026-10-02 — nothing was logged.", { exact: true }),
  ).toBeVisible();
  expect(await ev(p, () => window.__savedDays?.length || 0)).toBe(saved);
  // opening a day on the calendar: chat mode and that day again
  await p.getByTitle("Nutrition assistant").click();
  await p.evaluate(() =>
    [...document.querySelectorAll("div[title]")]
      .find((el) => el.style.fontFamily && el.childNodes[0]?.nodeValue === "4")
      .click(),
  );
  await openChat(p);
  await expect(mode(p)).toHaveValue("__chat__");
  await expect(p.locator('input[type="date"]').last()).toHaveValue("2026-10-04");
});

test("page frame: recipe card from Saved Recipes", async ({ page: p }) => {
  const stew = { id: "r", name: "Stew", servings: 1, portion_g: 300, nutrition: { kcal: 300 } };
  await start(p, { __recipes: [stew], __noBackfill: true });
  await p.locator("nav").getByRole("button", { name: "Add entry", exact: true }).click();
  await p.getByText("📖 Browse Saved Recipes").click();
  await p.getByRole("button", { name: "👁" }).click();
  await expect(p.getByText("Wt/portion 300 g")).toBeVisible();
});

test("page frame: header and tabs", async ({ page: p }) => {
  await start(p);
  await expect(p.getByText("vaulte", { exact: true })).toBeVisible();
  const tabs = ["Daily log", "Compare", "Add entry", "Weight", "Body"];
  const style = (name) =>
    p
      .locator("nav")
      .getByRole("button", { name, exact: true })
      .evaluate((e) => [e.style.fontWeight, e.style.background, e.style.color]);
  expect(await style("Daily log")).toEqual(["600", "rgb(249, 250, 251)", "rgb(17, 24, 39)"]);
  expect(await style("Compare")).toEqual(["450", "transparent", "rgb(107, 114, 128)"]);
  const shown = {
    "Daily log": () => p.getByText(/net kcal of/),
    Compare: () => p.getByText("Reference calculator"),
    "Add entry": () => p.getByText("🥗 Add Food Entry"),
    Weight: () => p.getByText("📋 Plan Specifications"),
    Body: () => p.getByText("Neck", { exact: true }).first(),
  };
  for (const t of tabs) {
    await p.locator("nav").getByRole("button", { name: t, exact: true }).click();
    expect(await style(t)).toEqual(["600", "rgb(249, 250, 251)", "rgb(17, 24, 39)"]);
    await expect(shown[t]()).toBeVisible();
    for (const o of tabs.filter((x) => x !== t)) await expect(shown[o]()).toHaveCount(0);
  }
  // Meds only on the Daily log; the steps and stats stay in the sidebar
  await expect(p.getByText("Meds", { exact: true })).toHaveCount(0);
  await p.locator("nav").getByRole("button", { name: "Daily log", exact: true }).click();
  await expect(p.getByText("Meds", { exact: true })).toBeVisible();
  await expect(p.getByText("Targets · Oct 2026")).toBeVisible();
});
