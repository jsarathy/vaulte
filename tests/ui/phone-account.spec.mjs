// tests/ui/phone-account.spec.mjs — My Account on a phone (Fix 43.10): DETAILS and CONNECTED
// SERVICES start closed, open on tap and use the full width. Desktop shows everything as before.
import { test, expect } from "@playwright/test";

const user = {
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  phone: "+44 7700 000000",
};
const start = async (p) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.addInitScript((d) => {
    window.__authUser = { uid: "u", email: "jane@example.com" };
    window.__docs = { "users/u": d };
  }, user);
  await p.goto("/app.html");
  await expect(p.locator("text=Welcome, Jane.")).toBeVisible();
  await p.locator(".app-sidebar button").nth(1).click();
  await expect(p.getByRole("heading", { name: "My Account" })).toBeVisible();
};

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("DETAILS and CONNECTED SERVICES start closed and open on tap", async ({ page: p }) => {
    await start(p);
    const details = p.getByRole("button", { name: /DETAILS/ });
    const services = p.getByRole("button", { name: /CONNECTED SERVICES/ });
    await expect(details).toHaveAttribute("aria-expanded", "false");
    await expect(services).toHaveAttribute("aria-expanded", "false");
    await expect(p.getByText("jane@example.com")).toHaveCount(0);
    await expect(p.getByText("Email Address")).toHaveCount(0);
    await expect(p.getByText("ACCOUNTS USED BY VAULTE")).toHaveCount(0);
    await details.click();
    await expect(details).toHaveAttribute("aria-expanded", "true");
    const card = await details.evaluate((e) => e.getBoundingClientRect().toJSON());
    expect(card.right).toBeLessThanOrEqual(390);
    expect(card.width).toBeGreaterThan(340); // uses the full width
    await services.click();
    await expect(services).toHaveAttribute("aria-expanded", "true");
    expect(await p.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

test.describe("phone card", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the photo sits inside the card on the right; the text stacks on the left", async ({
    page: p,
  }) => {
    await start(p);
    const box = (l) => l.evaluate((e) => e.getBoundingClientRect().toJSON());
    const card = await box(p.locator(".fade-up-2"));
    const photo = await box(p.locator("label[for=photo-upload] > div"));
    const name = await box(p.locator(".fade-up-2").getByText("Jane Smith"));
    expect(photo.right).toBeLessThanOrEqual(card.right);
    expect(photo.left).toBeGreaterThan(name.left);
    expect(name.right).toBeLessThanOrEqual(photo.left);
    await expect(p.locator(".fade-up-2")).not.toContainText("USR-");
    const edit = p.getByRole("button", { name: "Edit Profile" });
    const title = await box(p.getByRole("heading", { name: "My Account" }));
    expect(Math.abs((await box(edit)).top + 20 - (title.top + title.height / 2))).toBeLessThan(8);
  });
});

test.describe("desktop", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("details and the accounts list are shown without a toggle", async ({ page: p }) => {
    await start(p);
    await expect(p.getByText("Email Address")).toBeVisible();
    await expect(p.getByText("ACCOUNTS USED BY VAULTE")).toBeVisible();
    await expect(p.getByRole("button", { name: /CONNECTED SERVICES/ })).toHaveCount(0);
  });
});
