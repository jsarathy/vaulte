// tests/ui/app-lazy-load.spec.mjs — the app downloads in pieces (Fix 43.2.2, 43.2.3): the sign-in
// pages do not fetch the signed-in app, and a tab's code is fetched only when it is opened.
import { test, expect } from "@playwright/test";

const PROFILE = {
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  phone: "",
  address: "",
  city: "",
  postcode: "",
  uid: "USR-ABC",
  firebaseUid: "u",
  createdAt: "1 October 2026",
};
const start = async (p, init = {}) => {
  const files = [];
  p.on("request", (r) => files.push(new URL(r.url()).pathname));
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto("/app.html");
  return (name) => files.some((f) => f.includes(name));
};
const signedIn = {
  __authUser: { uid: "u", email: "jane@example.com" },
  __docs: { "users/u": PROFILE },
};

test("the landing page does not download the signed-in app", async ({ page }) => {
  const fetched = await start(page);
  await expect(page.locator("text=WELCOME TO")).toBeVisible({ timeout: 10_000 });
  expect(fetched("components/AccountPage")).toBe(false);
});

test("signing in downloads the signed-in app", async ({ page }) => {
  const fetched = await start(page, signedIn);
  await expect(page.locator("text=Welcome, Jane.")).toBeVisible();
  expect(fetched("components/AccountPage")).toBe(true);
});

test("a tab is downloaded only when it is opened", async ({ page }) => {
  const fetched = await start(page, signedIn);
  await page.locator(".app-sidebar button", { hasText: "Nutrition" }).click();
  await expect(page.locator(".nt-root nav")).toBeVisible();
  expect(fetched("tabs/CompareTab")).toBe(false);
  await page.locator(".nt-root nav").getByRole("button", { name: "Compare", exact: true }).click();
  await expect.poll(() => fetched("tabs/CompareTab")).toBe(true);
});
