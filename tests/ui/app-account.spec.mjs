// tests/ui/app-account.spec.mjs — App.jsx's signed-in page (Fix 26 PR 35): the top bar and
// sidebar, the Home panel, the My Account panel (profile card, photo upload / removal, info
// cards, linked accounts), Edit Profile (fields, password change, failures, closing) and
// Delete Account. Firebase is mocked (tests/ui/harness/mocks.js).
import { test, expect } from "./cover.mjs";

const PROFILE = {
  firstName: "Jane",
  lastName: "Smith",
  email: "jane@example.com",
  phone: "+44 7700 000000",
  address: "1 High St",
  city: "London",
  postcode: "SW1A 1AA",
  uid: "USR-ABC123",
  firebaseUid: "u",
  createdAt: "1 October 2026",
};
const signedIn = (profile = PROFILE) => ({
  __authUser: { uid: "u", email: "jane@example.com" },
  __docs: { "users/u": profile },
});
const start = async (p, init = {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto("/app.html");
  await expect(p.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
};
const saved = (p) => p.evaluate(() => window.__setDocs);
const calls = (p) =>
  p.evaluate(() =>
    window.__authCalls.filter((c) => c.fn !== "isLink").map(({ fn, ...a }) => [fn, a]),
  );
const input = (p, label) => p.locator("label", { hasText: label }).locator("..").locator("input");
const button = (p, name) => p.getByRole("button", { name, exact: true });
const nav = (p, label) => p.locator(".app-sidebar button", { hasText: label });

test("top bar, sidebar navigation and the Home panel", async ({ page }) => {
  await start(page, signedIn({ ...PROFILE, photoURL: "https://cdn.test/p.jpg" }));
  await expect(page.locator(".app-topbar")).toContainText("VAULTE");
  await expect(page.locator(".app-topbar-name")).toHaveText("Jane Smith");
  await expect(page.locator(".app-sidebar")).toContainText("NAVIGATION");
  const labels = page.locator(".app-sidebar .sidebar-label");
  await expect(labels).toHaveText(["Home", "My Account", "Nutrition"]);
  const home = page.locator(".app-main .fade-up").first();
  await expect(home).toContainText(/Sunday,? 4 October 2026/); // CI's Chromium adds the comma
  await expect(home).toContainText("Good to have you back.");
  await expect(home.locator("div").first()).toHaveCSS(
    "background-image",
    'url("https://cdn.test/p.jpg")',
  );
  // the chosen item is highlighted
  const style = async (label) => nav(page, label).evaluate((b) => b.style.color);
  expect(await style("Home")).toBe("rgb(255, 207, 63)");
  expect(await style("My Account")).toBe("rgb(255, 255, 255)");
  await nav(page, "My Account").click();
  expect(await style("My Account")).toBe("rgb(255, 207, 63)");
  await expect(page.locator("h2")).toHaveText("My Account");
  await expect(page.locator("text=Good to have you back.")).toBeHidden();
  await expect(page.locator(".app-main")).toHaveCSS("padding", "48px"); // Home has none
  await nav(page, "Home").click();
  await expect(page.locator(".app-main")).toHaveCSS("padding", "0px");
  await nav(page, "Nutrition").click();
  await expect(page.locator("text=Daily log")).toBeVisible({ timeout: 10000 });
  await nav(page, "Home").click();
  await expect(page.locator("text=Good to have you back.")).toBeVisible();
});

test("My Account: the profile card, info cards and linked accounts", async ({ page }) => {
  await start(page, signedIn());
  await nav(page, "My Account").click();
  const main = page.locator(".app-main");
  await expect(main).toContainText("PROFILE");
  await expect(main.locator(".fade-up-2")).toContainText("JS");
  await expect(main.locator(".fade-up-2")).toContainText("Jane Smith");
  await expect(main.locator(".fade-up-2")).not.toContainText("USR-ABC123");
  await expect(main.locator(".fade-up-2")).toContainText("Member since 1 October 2026");
  await expect(main.locator(".fade-up-2")).toContainText("CLICK TOADD PHOTO");
  await expect(button(page, "Remove Photo")).toBeHidden();
  const cards = main.locator(".fade-up-3").first().locator(".info-card");
  await expect(cards).toHaveCount(3);
  await expect(cards.nth(0)).toContainText("Email Address");
  await expect(cards.nth(0)).toContainText("jane@example.com");
  await expect(cards.nth(1)).toContainText("Telephone");
  await expect(cards.nth(1)).toContainText("+44 7700 000000");
  await expect(cards.nth(2)).toContainText("Address");
  await expect(cards.nth(2)).toContainText("1 High St, London, SW1A 1AA");
  const linked = main.locator(".fade-up-3").nth(1);
  await expect(linked).toContainText("ACCOUNTS USED BY VAULTE");
  const links = linked.locator("a");
  await expect(links).toHaveText([
    "github.com/jsarathy/vaulte",
    "vercel.com/jsarathys-projects/vaulte",
    "console.firebase.google.com/project/vaulte-1ea20",
    "flow.polar.com/diary",
  ]);
  await expect(links.first()).toHaveAttribute("target", "_blank");
  await expect(links.first()).toHaveAttribute("rel", "noopener noreferrer");
  await expect(linked.locator(".info-card")).toHaveCount(7);
  await expect(linked).toContainText("Anthropic (Claude API)");
  await expect(linked).toContainText("Apple Health (iOS Shortcuts)");
});

test("My Account: missing details show 'Not provided'; the address joins what is there", async ({
  page,
}) => {
  await start(page, signedIn({ ...PROFILE, phone: "", address: "", city: "Leeds", postcode: "" }));
  await nav(page, "My Account").click();
  const cards = page.locator(".app-main .fade-up-3").first().locator(".info-card");
  await expect(cards.nth(1)).toContainText("Not provided");
  await expect(cards.nth(2).locator("div").last()).toHaveText("Leeds"); // blanks are left out
  await expect(cards.nth(2)).not.toContainText("Not provided");
});

test("photo upload: stored, saved to the profile, shown; removal clears it", async ({ page }) => {
  await start(page, signedIn());
  await nav(page, "My Account").click();
  await page.setInputFiles("#photo-upload", []); // a cancelled chooser: nothing happens
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__storageCalls)).toEqual([]);
  await page.setInputFiles("#photo-upload", {
    name: "me.png",
    mimeType: "image/png",
    buffer: Buffer.from("png-bytes"),
  });
  await expect(page.locator("text=PHOTO UPDATED")).toBeVisible();
  expect(await page.evaluate(() => window.__storageCalls)).toEqual([
    { fn: "upload", path: "profile-photos/u.jpg", name: "me.png", size: 9, type: "image/png" },
    { fn: "url", path: "profile-photos/u.jpg" },
  ]);
  const [doc] = await saved(page);
  expect(doc).toEqual({
    path: "users/u",
    merge: true,
    data: { ...PROFILE, photoURL: "https://cdn.test/profile-photos/u.jpg" },
  });
  await expect(page.locator("label[for=photo-upload] div")).toHaveCSS(
    "background-image",
    'url("https://cdn.test/profile-photos/u.jpg")',
  );
  await expect(page.locator("text=CLICK TO")).toBeHidden();
  await button(page, "Remove Photo").click();
  await expect(page.locator("text=PHOTO REMOVED")).toBeVisible();
  expect((await page.evaluate(() => window.__storageCalls)).at(-1)).toEqual({
    fn: "delete",
    path: "profile-photos/u.jpg",
  });
  expect((await saved(page))[1].data).toEqual(PROFILE); // photoURL gone, not null
  await expect(page.locator("text=CLICK TO")).toBeVisible();
  await expect(button(page, "Remove Photo")).toBeHidden();
});

test("toasts: a newer toast is not cleared early by an older toast's timer", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await start(page, {
    ...signedIn({ ...PROFILE, photoURL: "https://cdn.test/old.jpg" }),
    __failStorage: { upload: "Bucket closed" },
  });
  await nav(page, "My Account").click();
  await page.setInputFiles("#photo-upload", {
    name: "me.png",
    mimeType: "image/png",
    buffer: Buffer.from("x"),
  });
  await expect(page.locator("text=UPLOADING...")).toBeVisible();
  await page.waitForTimeout(2000); // 2 s into UPLOADING...'s 3 s
  await button(page, "Remove Photo").click();
  await expect(page.locator("text=PHOTO REMOVED")).toBeVisible();
  await page.waitForTimeout(1500); // 3.5 s: past the first toast's timer, inside the second's
  await expect(page.locator("text=PHOTO REMOVED")).toBeVisible();
  await expect(page.locator("text=PHOTO REMOVED")).toBeHidden({ timeout: 4000 });
});

test("photo upload: a failed upload alerts and changes nothing; a failed delete still removes", async ({
  page,
}) => {
  const alerts = [];
  page.on("dialog", (d) => {
    alerts.push(d.message());
    d.accept();
  });
  await start(page, {
    ...signedIn({ ...PROFILE, photoURL: "https://cdn.test/old.jpg" }),
    __failStorage: { upload: "Bucket closed", delete: "Gone already" },
  });
  await nav(page, "My Account").click();
  await page.setInputFiles("#photo-upload", {
    name: "me.png",
    mimeType: "image/png",
    buffer: Buffer.from("x"),
  });
  await expect.poll(() => alerts).toEqual(["Could not upload photo: Bucket closed"]);
  expect(await saved(page)).toEqual([]);
  await expect(page.locator("label[for=photo-upload] div")).toHaveCSS(
    "background-image",
    'url("https://cdn.test/old.jpg")',
  );
  await button(page, "Remove Photo").click();
  await expect(page.locator("text=PHOTO REMOVED")).toBeVisible();
  expect((await saved(page))[0].data.photoURL).toBeUndefined();
});

test("Edit Profile: prefilled, every field saved, password left blank keeps the current one", async ({
  page,
}) => {
  await start(page, signedIn());
  await nav(page, "My Account").click();
  await button(page, "Edit Profile").click();
  await expect(page.locator(".overlay h2")).toHaveText("Edit Profile");
  await expect(input(page, "First Name")).toHaveValue("Jane");
  await expect(input(page, "Postcode")).toHaveValue("SW1A 1AA");
  await expect(input(page, "New Password")).toHaveValue("");
  await input(page, "First Name").fill("Janet");
  await input(page, "Last Name").fill("Jones");
  await input(page, "Phone Number").fill("+44 1");
  await input(page, "Street Address").fill("2 Low St");
  await input(page, "City").fill("Leeds");
  await input(page, "Postcode").fill("LS1");
  await input(page, "New Password").fill("x");
  await input(page, "New Password").fill(""); // typed, then cleared: no password change
  await button(page, "Save Changes").click();
  await expect(page.locator("text=PROFILE UPDATED")).toBeVisible();
  await expect(page.locator(".overlay")).toBeHidden();
  expect(await calls(page)).toEqual([]); // no password change
  const [doc] = await saved(page);
  expect(doc.data).toEqual({
    ...PROFILE,
    firstName: "Janet",
    lastName: "Jones",
    phone: "+44 1",
    address: "2 Low St",
    city: "Leeds",
    postcode: "LS1",
  });
  await expect(page.locator(".app-topbar-name")).toHaveText("Janet Jones");
  await expect(page.locator(".app-main")).toContainText("JJ");
  await expect(page.locator(".app-main")).toContainText("2 Low St, Leeds, LS1");
});

test("Edit Profile: a new password is set on the account and never stored", async ({ page }) => {
  await start(page, signedIn());
  await nav(page, "My Account").click();
  await button(page, "Edit Profile").click();
  await input(page, "New Password").fill("newpass1");
  await button(page, "Save Changes").click();
  await expect(page.locator("text=PROFILE UPDATED")).toBeVisible();
  expect(await calls(page)).toEqual([["updatePassword", { uid: "u", password: "newpass1" }]]);
  const [doc] = await saved(page);
  expect(doc.data.password).toBeUndefined();
  expect(doc.data).toEqual(PROFILE);
});

test("Edit Profile: a failed save shows the error and stays open; Cancel and the backdrop close", async ({
  page,
}) => {
  await start(page, {
    ...signedIn(),
    __authFail: { updatePassword: ["auth/requires-recent-login", "Sign in again first."] },
  });
  await nav(page, "My Account").click();
  await button(page, "Edit Profile").click();
  await input(page, "First Name").fill("Janet");
  await input(page, "New Password").fill("newpass1");
  const save = button(page, "Save Changes");
  await save.click();
  await expect(page.locator(".overlay")).toContainText("Sign in again first.");
  await expect(page.locator(".overlay")).toBeVisible();
  await expect(save).toBeEnabled();
  expect(await saved(page)).toEqual([]);
  await expect(page.locator(".app-topbar-name")).toHaveText("Jane Smith");
  await button(page, "Cancel").click();
  await expect(page.locator(".overlay")).toBeHidden();
  await button(page, "Edit Profile").click();
  await expect(input(page, "First Name")).toHaveValue("Jane"); // reopened from the profile
  await page.locator(".overlay").click({ position: { x: 5, y: 5 } });
  await expect(page.locator(".overlay")).toBeHidden();
  await button(page, "Edit Profile").click();
  await page.locator(".overlay h2").click(); // inside the card: stays open
  await expect(page.locator(".overlay")).toBeVisible();
});

test("Edit Profile: the Save button is busy while saving", async ({ page }) => {
  await start(page, { ...signedIn(), __authDelays: { updatePassword: 1200 } });
  await nav(page, "My Account").click();
  await button(page, "Edit Profile").click();
  await input(page, "New Password").fill("newpass1");
  const save = button(page, "Save Changes");
  await save.click();
  await expect(save).toBeDisabled();
  await expect(save.locator(".spinner")).toBeVisible();
  await expect(page.locator("text=PROFILE UPDATED")).toBeVisible({ timeout: 5000 });
});

test("Delete Account: confirm, then the profile and the user go; cancel keeps everything", async ({
  page,
}) => {
  let ok = false;
  const dialogs = [];
  page.on("dialog", (d) => {
    dialogs.push([d.type(), d.message()]);
    return ok ? d.accept() : d.dismiss();
  });
  await start(page, { ...signedIn(), __authFail: { deleteUser: ["auth/x", "Not now."] } });
  await button(page, "Delete Account").click();
  await expect.poll(() => dialogs).toEqual([["confirm", "Are you sure? This cannot be undone."]]);
  await expect(page.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => window.__deletedDocs ?? [])).toEqual([]);
  ok = true;
  await button(page, "Delete Account").click();
  await expect.poll(() => dialogs.at(-1)).toEqual(["alert", "Error deleting account: Not now."]);
  expect(await page.evaluate(() => window.__deletedDocs)).toEqual(["users/u"]);
  await expect(page.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await page.evaluate(() => {
    window.__authFail = {};
  });
  await button(page, "Delete Account").click();
  await expect(page.locator("text=WELCOME TO")).toBeVisible();
  expect((await calls(page)).at(-1)).toEqual(["deleteUser", { uid: "u" }]);
});
