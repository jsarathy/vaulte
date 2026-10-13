// tests/ui/non-admin.spec.mjs — what a person who is not an admin gets (Fix 128): the food tracker
// and the Claude chat, but no Dashboard and none of the owner's device integrations (Polar, Renpho,
// the Apple Watch). The same page for an admin shows all of them. The harness answers the admin
// check from window.__admin (true unless a spec says false).
import { test, expect } from "./cover.mjs";

const PROFILE = {
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  firebaseUid: "u",
};
const start = async (p, init = {}, beforeGoto = async () => {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await beforeGoto(); // routes that must come after the generic one, which would otherwise win
  await p.addInitScript((i) => Object.assign(window, i), {
    __authUser: { uid: "u", email: "jane@example.com" },
    __docs: { "users/u": PROFILE },
    ...init,
  });
  await p.goto("/app.html");
  await expect(p.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
};
const labels = (p) => p.locator(".app-sidebar .sidebar-label");
const tab = (p, name) => p.getByRole("button", { name, exact: true }).click();
const reads = (p) => p.evaluate(() => window.__getDocPaths ?? []);

test("an admin sees the Dashboard in the sidebar and the integrations in the tracker", async ({
  page: p,
}) => {
  await start(p);
  await expect(labels(p)).toHaveText(["Home", "My Account", "Nutrition", "Dashboard"]);
  await p.locator(".app-sidebar button", { hasText: "Nutrition" }).click();
  await expect(p.getByText("Daily log").first()).toBeVisible();
  await p.getByRole("button", { name: "Add entry", exact: true }).click();
  await expect(p.getByText("Polar Sessions")).toBeVisible();
  await expect(p.getByText("Steps by hour")).toBeVisible();
  await p.getByRole("button", { name: "Weight", exact: true }).click();
  await expect(p.getByRole("button", { name: /Sync Renpho/ })).toBeVisible();
  await p.getByRole("button", { name: "Body", exact: true }).click();
  await expect(p.getByRole("button", { name: /Sync Renpho/ })).toBeVisible();
});

test("a person who is not an admin has no Dashboard in the sidebar", async ({ page: p }) => {
  await start(p, { __admin: false });
  await expect(labels(p)).toHaveText(["Home", "My Account", "Nutrition"]);
  await expect(p.locator(".app-sidebar button", { hasText: "Dashboard" })).toHaveCount(0);
});

test("a person who is not an admin has the tracker without Polar, Renpho or the Apple Watch", async ({
  page: p,
}) => {
  await start(p, { __admin: false });
  await p.locator(".app-sidebar button", { hasText: "Nutrition" }).click();
  await expect(p.getByRole("button", { name: "Add entry", exact: true })).toBeVisible();
  // the Daily log: no Apple Watch card
  await expect(p.getByText("Apple Watch Activity")).toHaveCount(0);
  // Add entry: food and manual exercise stay; no Polar card, no steps by hour
  await tab(p, "Add entry");
  await expect(p.getByText("Add Food Entry")).toBeVisible();
  await expect(p.getByRole("button", { name: /Log Manual Exercise/ })).toBeVisible();
  await expect(p.getByText("Polar Sessions")).toHaveCount(0);
  await expect(p.getByText("Steps by hour")).toHaveCount(0);
  // Weight and Body: the tables stay, the Renpho sync does not
  await tab(p, "Weight");
  await expect(p.getByText(/Weight Log/).first()).toBeVisible();
  await expect(p.getByRole("button", { name: /Sync Renpho/ })).toHaveCount(0);
  await tab(p, "Body");
  await expect(p.getByText(/Body Log/).first()).toBeVisible();
  await expect(p.getByRole("button", { name: /Sync Renpho/ })).toHaveCount(0);
  // and Polar's records are not even read
  expect((await reads(p)).filter((path) => /polar|apple_activity/.test(path))).toEqual([]);
});

test("when the check fails the person is treated as not an admin", async ({ page: p }) => {
  const asked = [];
  await start(p, { __adminNetwork: true }, () =>
    p.route(
      (u) => new URL(u).pathname === "/api/admin-users",
      (r) => {
        asked.push(r.request().postDataJSON());
        r.fulfill({ status: 500, json: { error: "down" } });
      },
    ),
  );
  await expect.poll(() => asked.length).toBeGreaterThan(0); // it really was asked
  await expect(labels(p)).toHaveText(["Home", "My Account", "Nutrition"]);
});

test("the real check decides: an admin answer shows the Dashboard", async ({ page: p }) => {
  const asked = [];
  await start(p, { __adminNetwork: true }, () =>
    p.route(
      (u) => new URL(u).pathname === "/api/admin-users",
      (r) => {
        asked.push({ body: r.request().postDataJSON(), auth: r.request().headers().authorization });
        r.fulfill({ json: { admin: true } });
      },
    ),
  );
  await expect(labels(p)).toHaveText(["Home", "My Account", "Nutrition", "Dashboard"]);
  expect(asked[0]).toEqual({ body: { action: "check" }, auth: "Bearer mock-id-token" });
});

test("My Account lists the accounts Vaulte uses for an admin only, on desktop and phone", async ({
  page: p,
}) => {
  await start(p, { __admin: false });
  await p.locator(".app-sidebar button", { hasText: "My Account" }).click();
  await expect(p.getByText("jane@example.com").first()).toBeVisible();
  await expect(p.getByText("ACCOUNTS USED BY VAULTE")).toHaveCount(0);
  await expect(p.getByText("Renpho")).toHaveCount(0);
  await p.setViewportSize({ width: 390, height: 800 });
  await expect(p.getByRole("button", { name: /CONNECTED SERVICES/ })).toHaveCount(0);
  await expect(p.getByRole("button", { name: /DETAILS/ })).toBeVisible();
});
