// tests/ui/app-auth-history.spec.mjs — the browser's Back / Forward buttons on the sign-in
// pages (Fix 53): each page has its own history entry, so Back returns to the page before
// instead of leaving the site; the signed-in pages are left alone.
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
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto("/app.html");
  await expect(p.locator("text=WELCOME TO")).toBeVisible({ timeout: 10_000 });
};
const heading = (p) => p.locator("h2");
const field = (p, label) => p.locator("label", { hasText: label }).locator("..").locator("input");

test("Back from Create Account and from Sign In returns to the landing page; Forward goes on", async ({
  page,
}) => {
  await start(page);
  await page.click("text=Create Account");
  await expect(heading(page)).toHaveText("Create Account");
  await page.goBack();
  await expect(page.locator("text=WELCOME TO")).toBeVisible();
  await page.goForward();
  await expect(heading(page)).toHaveText("Create Account");
  await page.goBack();
  await page.click("text=Sign In");
  await expect(heading(page)).toHaveText("Welcome Back");
  await page.goBack();
  await expect(page.locator("text=WELCOME TO")).toBeVisible();
});

test("Back steps through every sign-in page in the order they were opened", async ({ page }) => {
  await start(page);
  await page.click("text=Create Account");
  await page.click("text=Sign In Instead");
  await expect(heading(page)).toHaveText("Welcome Back");
  await page.click("text=Create an Account");
  await expect(heading(page)).toHaveText("Create Account");
  await page.goBack();
  await expect(heading(page)).toHaveText("Welcome Back");
  await page.goBack();
  await expect(heading(page)).toHaveText("Create Account");
  await page.goBack();
  await expect(page.locator("text=WELCOME TO")).toBeVisible();
});

test("a page's form is kept when Back returns to it", async ({ page }) => {
  await start(page);
  await page.click("text=Create Account");
  await field(page, "First Name").fill("Jane");
  await page.click("text=Sign In Instead");
  await page.goBack();
  await expect(heading(page)).toHaveText("Create Account");
  await expect(field(page, "First Name")).toHaveValue("Jane");
});

test("the first page does not add an entry; each later page adds exactly one", async ({ page }) => {
  await start(page);
  const len = () => page.evaluate(() => history.length);
  const first = await len();
  await page.click("text=Create Account");
  expect(await len()).toBe(first + 1);
  await page.click("text=Sign In Instead");
  expect(await len()).toBe(first + 2);
  await page.goBack(); // Back to a page already open adds nothing
  expect(await len()).toBe(first + 2);
});

test("signed in: Back does nothing to the account page; after Sign Out Back reaches the form", async ({
  page,
}) => {
  await start(page, { __docs: { "users/u": PROFILE } });
  await page.click("text=Sign In");
  await field(page, "Email Address").fill("jane@example.com");
  await field(page, "Password").fill("secret");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await page.goBack();
  await expect(page.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await page.goForward();
  await expect(page.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await page.click("text=Sign Out");
  await expect(page.locator("text=WELCOME TO")).toBeVisible();
  await page.goBack();
  await expect(heading(page)).toHaveText("Welcome Back");
});
