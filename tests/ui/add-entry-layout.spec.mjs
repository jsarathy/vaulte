// tests/ui/add-entry-layout.spec.mjs — Add Entry's frame (Fix 26 PR 14): the column buttons, the
// Polar card header (Connected, Sync, Reconnect, sync message) and the steps card's date.
import { test, expect } from "@playwright/test";

const CONFIRM =
  "This will re-authorise your Polar account with updated permissions (needed for HR data). Continue?";

const start = async (p, init) => {
  await p.addInitScript((i) => {
    window.__noBackfill = true;
    Object.assign(window, i);
  }, init);
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
};
const style = (loc, prop) => loc.evaluate((e, k) => getComputedStyle(e)[k], prop);

test("columns: headings and buttons", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await start(p, {});
  await expect(p.getByText("🥗 Add Food Entry")).toBeVisible();
  await expect(p.getByText("🏋️ Exercise", { exact: true })).toBeVisible();
  await p.getByText("📖 Browse Saved Recipes").click();
  await expect(p.getByText("📖 Saved Recipes", { exact: true })).toBeVisible();
  await p.getByRole("button", { name: "×" }).first().click();
  await expect(p.getByText("📖 Saved Recipes", { exact: true })).toHaveCount(0);
  await p.getByRole("button", { name: "🤖 Create with Claude" }).click();
  await expect(p.getByText("Generate Recipe →")).toBeVisible();
  await p.getByRole("button", { name: "×" }).first().click();
  await expect(p.getByText("Generate Recipe →")).toHaveCount(0);
  await p.getByRole("button", { name: "🏋️ Log Manual Exercise" }).click();
  await expect(p.getByPlaceholder("Search exercise… e.g. cycling, yoga, running")).toBeVisible();

  // Steps by hour follows the Add Entry date
  await p.goto("/addentry.html");
  await p.waitForFunction(() => window.__setRecipes);
  const steps = p.getByText("Steps by hour").locator("../../..");
  await expect(steps).toContainText(/3 Oct 2026/);
  await p.locator('input[type="date"]').first().fill("2026-10-05");
  await expect(steps).toContainText(/5 Oct 2026/);
  expect(errs).toEqual([]);
});

test("Polar header: not connected, connected, syncing, messages", async ({ page: p }) => {
  const sync = () => p.getByRole("button", { name: /Sync/ });
  await start(p, {});
  await expect(p.getByText("📡 Polar Sessions", { exact: true })).toBeVisible();
  await expect(p.getByText("Connected", { exact: true })).toHaveCount(0);
  await expect(sync()).toHaveCount(0);
  await expect(p.getByRole("button", { name: "Reconnect" })).toHaveCount(0);

  await start(p, { __polar: { connected: true, sessions: [] } });
  await expect(p.getByText("Connected", { exact: true })).toBeVisible();
  await expect(sync()).toHaveText("🔄 Sync");
  await expect(sync()).toBeEnabled();
  expect(await style(sync(), "cursor")).toBe("pointer");
  expect(await style(sync(), "backgroundColor")).toBe("rgba(255, 255, 255, 0.2)");
  await sync().click();
  await sync().click();
  expect(await p.evaluate(() => window.__synced)).toBe(2);
  await expect(p.getByRole("button", { name: "Reconnect" })).toHaveAttribute(
    "title",
    "Re-authorise with updated permissions for HR data",
  );

  await start(p, { __polar: { connected: true, sessions: [], syncing: true } });
  await expect(sync()).toHaveText("⏳ Syncing…");
  await expect(sync()).toBeDisabled();
  expect(await style(sync(), "cursor")).toBe("not-allowed");
  expect(await style(sync(), "backgroundColor")).toBe("rgba(255, 255, 255, 0.1)");

  const msg = p.getByText("Synced 2 sessions", { exact: true });
  await start(p, {
    __polar: { connected: true, sessions: [], syncMsg: { ok: true, text: "Synced 2 sessions" } },
  });
  await expect(msg).toBeVisible();
  expect([await style(msg, "backgroundColor"), await style(msg, "color")]).toEqual([
    "rgb(232, 245, 233)",
    "rgb(46, 125, 50)",
  ]);
  await start(p, {
    __polar: { connected: false, syncMsg: { ok: false, text: "Synced 2 sessions" } },
  });
  await expect(msg).toBeVisible(); // shown even when not connected
  expect([await style(msg, "backgroundColor"), await style(msg, "color")]).toEqual([
    "rgb(255, 235, 238)",
    "rgb(198, 40, 40)",
  ]);
});

test("Polar Reconnect", async ({ page: p }) => {
  const dialogs = [];
  let answer = false;
  p.on("dialog", (d) => {
    dialogs.push([d.type(), d.message()]);
    if (d.type() === "confirm" && answer) d.accept();
    else d.dismiss();
  });
  const logs = [];
  p.on("console", (m) => logs.push(m.text()));
  const posted = [];
  let fail = false;
  await p.route("**/api/polar-disconnect", async (r) => {
    posted.push([
      r.request().method(),
      r.request().headers()["content-type"],
      r.request().postData(),
    ]);
    await new Promise((res) => setTimeout(res, 400));
    if (fail) return r.abort();
    r.fulfill({ json: { ok: true } });
  });
  await p.route("**/api/polar-auth**", (r) =>
    r.fulfill({ contentType: "text/html", body: "auth" }),
  );
  const reconnect = () => p.getByRole("button", { name: /Reconnect|Working/ });

  // Not confirmed: nothing happens
  await start(p, { __polar: { connected: true, sessions: [] } });
  await reconnect().click();
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toEqual(["confirm", CONFIRM]);
  await p.waitForTimeout(300);
  expect(posted).toEqual([]);
  await expect(reconnect()).toHaveText("Reconnect");
  expect(logs).toContain("Reconnect clicked, userId: u");

  // Confirmed: "Working…", disconnect, then off to Polar's sign-in
  answer = true;
  await reconnect().click();
  await expect(reconnect()).toHaveText("Working…");
  await p.waitForURL("**/api/polar-auth?userId=u");
  expect(posted).toEqual([["POST", "application/json", JSON.stringify({ userId: "u" })]]);
  expect(logs.some((l) => l.startsWith("Disconnect result:"))).toBe(true);

  // Disconnect failing doesn't stop the re-authorisation
  fail = true;
  await start(p, { __polar: { connected: true, sessions: [] } });
  await reconnect().click();
  await p.waitForURL("**/api/polar-auth?userId=u");
  expect(posted.length).toBe(2);
  expect(logs.some((l) => l.startsWith("Disconnect failed, continuing:"))).toBe(true);

  // Not signed in: a message, no confirm, no calls
  dialogs.length = 0;
  await start(p, { __polar: { connected: true, sessions: [] }, __userId: "" });
  await reconnect().click();
  await expect.poll(() => dialogs.length).toBe(1);
  expect(dialogs[0]).toEqual(["alert", "Not logged in — please refresh and try again."]);
  await p.waitForTimeout(300);
  expect(posted.length).toBe(2);
  expect(p.url()).toMatch(/addentry\.html$/);
});
