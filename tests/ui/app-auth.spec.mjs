// tests/ui/app-auth.spec.mjs — App.jsx's sign-in pages (Fix 26 PR 35): the loading state,
// landing, Create Account (checks, errors, the saved profile), Sign In (password, magic link,
// Google), the sign-in link return, and the signed-in start-up. Firebase is mocked
// (tests/ui/harness/mocks.js; calls in window.__authCalls / __setDocs).
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
};
const calls = (p) =>
  p.evaluate(() =>
    window.__authCalls.filter((c) => c.fn !== "isLink").map(({ fn, ...a }) => [fn, a]),
  );
const saved = (p) => p.evaluate(() => window.__setDocs);
const fill = (p, label, value) => input(p, label).fill(value);
const input = (p, label) => p.locator("label", { hasText: label }).locator("..").locator("input");
const button = (p, name) => p.getByRole("button", { name, exact: true });

test("loading, then the landing page; its two buttons lead to the two forms", async ({ page }) => {
  await start(page, { __authDelay: 1500 });
  await expect(page.locator("text=VAULTE")).toBeVisible();
  await expect(page.locator(".spinner-gold")).toBeVisible();
  await expect(page.locator("text=WELCOME TO")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("h1")).toHaveText("VAULTE");
  await expect(page.locator("text=Your personal account, secured.")).toBeVisible();
  await page.click("text=Create Account");
  await expect(page.locator("h2")).toHaveText("Create Account");
  await page.click("text=Sign In Instead");
  await expect(page.locator("h2")).toHaveText("Welcome Back");
  await page.click("text=Create an Account");
  await expect(page.locator("h2")).toHaveText("Create Account");
});

test("Create Account: required fields, password length, duplicate email, success", async ({
  page,
}) => {
  await start(page, { __authFail: { createUser: "auth/email-already-in-use" } });
  await page.click("text=Create Account");
  await page.click("text=Create My Account");
  await expect(page.locator("text=Please fill in all required fields.")).toBeVisible();
  await fill(page, "First Name", "Jane");
  await fill(page, "Email Address", "jane@example.com");
  await fill(page, "Password", "12345");
  await page.click("text=Create My Account"); // the last name is required too
  await expect(page.locator("text=Please fill in all required fields.")).toBeVisible();
  await fill(page, "Last Name", "Smith");
  await page.click("text=Create My Account");
  await expect(page.locator("text=Password must be at least 6 characters.")).toBeVisible();
  // leaving the page clears the error
  await page.click("text=Sign In Instead");
  await expect(page.locator("text=Password must be at least 6 characters.")).toBeHidden();
  await page.click("text=Create an Account");
  await expect(page.locator("text=Password must be at least 6 characters.")).toBeHidden();
  await page.click("text=Create My Account"); // the form itself is kept
  await expect(page.locator("text=Password must be at least 6 characters.")).toBeVisible();
  await fill(page, "Password", "123456");
  await page.click("text=Create My Account");
  await expect(page.locator("text=An account with this email already exists.")).toBeVisible();
  expect(await calls(page)).toEqual([
    ["createUser", { email: "jane@example.com", password: "123456" }],
  ]);
  // a second failure: any other code shows Firebase's message
  await page.evaluate(() => {
    window.__authFail = { createUser: ["auth/weak-password", "Weak password."] };
  });
  await page.click("text=Create My Account");
  await expect(page.locator("text=Weak password.")).toBeVisible();
  await page.evaluate(() => {
    window.__authFail = {};
  });
  await fill(page, "Phone Number", "+44 1");
  await fill(page, "Street Address", "1 High St");
  await fill(page, "City", "London");
  await fill(page, "Postcode", "SW1");
  await page.click("text=Create My Account");
  await expect(page.locator("text=ACCOUNT CREATED")).toBeVisible();
  await expect(page.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  const [doc] = await saved(page);
  expect(doc.path).toBe("users/new-u");
  expect(doc.merge).toBe(true);
  expect(doc.data).toMatchObject({
    firstName: "Jane",
    lastName: "Smith",
    email: "jane@example.com",
    phone: "+44 1",
    address: "1 High St",
    city: "London",
    postcode: "SW1",
    firebaseUid: "new-u",
    createdAt: "4 October 2026",
  });
  expect(doc.data.uid).toMatch(/^USR-[A-Z0-9]{9}$/);
  expect(doc.data.password).toBeUndefined();
  await expect(page.locator("text=ACCOUNT CREATED")).toBeHidden({ timeout: 5000 });
});

test("while a sign-up or sign-in runs the button is disabled with a spinner", async ({ page }) => {
  await start(page, {
    __authDelays: { createUser: 1200, signIn: 1200 },
    __docs: { "users/u": PROFILE },
  });
  await page.click("text=Create Account");
  await fill(page, "First Name", "J");
  await fill(page, "Last Name", "S");
  await fill(page, "Email Address", "j@s.com");
  await fill(page, "Password", "123456");
  const create = button(page, "Create My Account");
  await create.click();
  await expect(create).toBeDisabled();
  await expect(create.locator(".spinner")).toBeVisible();
  await expect(button(page, "Continue with Google")).toBeDisabled();
  await expect(page.locator("text=Welcome, J.")).toBeVisible({ timeout: 15_000 });
  await page.click("text=Sign Out");
  await page.click("text=Sign In");
  await fill(page, "Email Address", "jane@example.com");
  await fill(page, "Password", "pw");
  const signIn = button(page, "Sign In");
  await signIn.click();
  await expect(signIn).toBeDisabled();
  await expect(signIn.locator(".spinner")).toBeVisible();
  await expect(page.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
});

test("Sign In with a password: checks, a wrong password, other errors, success", async ({
  page,
}) => {
  await start(page, {
    __authFail: { signIn: "auth/invalid-credential" },
    __docs: { "users/u": PROFILE },
  });
  await page.click("text=Sign In");
  await button(page, "Sign In").click();
  await expect(page.locator("text=Please enter your email and password.")).toBeVisible();
  await fill(page, "Email Address", "jane@example.com");
  await fill(page, "Password", "wrong");
  await button(page, "Sign In").click();
  await expect(page.locator("text=Invalid email or password.")).toBeVisible();
  await page.evaluate(() => {
    window.__authFail = { signIn: ["auth/too-many-requests", "Too many attempts."] };
  });
  await button(page, "Sign In").click();
  await expect(page.locator("text=Too many attempts.")).toBeVisible();
  await page.evaluate(() => {
    window.__authFail = {};
  });
  await button(page, "Sign In").click();
  await expect(page.locator("text=WELCOME BACK")).toBeVisible();
  await expect(page.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".app-topbar-name")).toHaveText("Jane Smith");
  expect((await calls(page)).filter(([fn]) => fn === "signIn")).toEqual([
    ["signIn", { email: "jane@example.com", password: "wrong" }],
    ["signIn", { email: "jane@example.com", password: "wrong" }],
    ["signIn", { email: "jane@example.com", password: "wrong" }],
  ]);
  expect(await saved(page)).toEqual([]);
});

test("Sign In with a magic link: tab switching clears state; send, sent, different email", async ({
  page,
}) => {
  await start(page, { __authFail: { sendLink: ["auth/x", "Mail failed."] } });
  await page.click("text=Sign In");
  await fill(page, "Email Address", "jane@example.com");
  await button(page, "Sign In").click();
  await expect(page.locator("text=Please enter your email and password.")).toBeVisible();
  await page.click("text=Magic Link");
  await expect(page.locator("text=Please enter your email and password.")).toBeHidden();
  await expect(page.locator("text=no password needed")).toBeVisible();
  await page.click("text=Send Me a Link");
  await expect(page.locator("text=Please enter your email address.")).toBeVisible();
  await fill(page, "Email Address", "jane@example.com");
  await page.click("text=Send Me a Link");
  await expect(page.locator("text=Mail failed.")).toBeVisible();
  await page.evaluate(() => {
    window.__authFail = {};
  });
  await page.click("text=Send Me a Link");
  await expect(page.locator("text=CHECK YOUR INBOX")).toBeVisible();
  await expect(page.locator("text=jane@example.com")).toBeVisible();
  await expect(page.locator("text=Create an Account")).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("vaulte:magicEmail"))).toBe(
    "jane@example.com",
  );
  expect((await calls(page)).filter(([fn]) => fn === "sendLink")).toEqual([
    [
      "sendLink",
      {
        email: "jane@example.com",
        settings: { url: "https://vaulte-roan.vercel.app", handleCodeInApp: true },
      },
    ],
    [
      "sendLink",
      {
        email: "jane@example.com",
        settings: { url: "https://vaulte-roan.vercel.app", handleCodeInApp: true },
      },
    ],
  ]);
  await page.click("text=Use a different email");
  await expect(page.locator("text=no password needed")).toBeVisible();
  await expect(input(page, "Email Address")).toHaveValue("");
  await expect(page.locator("text=Create an Account")).toBeVisible();
  // the Password tab clears the sent state too
  await fill(page, "Email Address", "x@y.z");
  await page.click("text=Send Me a Link");
  await expect(page.locator("text=CHECK YOUR INBOX")).toBeVisible();
  await page.click("text=Password");
  await expect(page.locator("text=CHECK YOUR INBOX")).toBeHidden();
  await expect(page.locator("text=Create an Account")).toBeVisible(); // the sent state is cleared
  await page.click("text=Magic Link");
  await expect(page.locator("text=no password needed")).toBeVisible();
});

test("opened from a sign-in link: the stored email signs in; a new user goes to Create Account", async ({
  page,
}) => {
  await start(page, { __magicLink: true, __docs: { "users/magic-u": PROFILE } });
  await page.evaluate(() => localStorage.setItem("vaulte:magicEmail", "jane@example.com"));
  await page.goto("/app.html");
  // a cold page load on a busy CI runner can take longer than the default 5 s
  await expect(page.locator("text=WELCOME BACK")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  expect(await page.evaluate(() => localStorage.getItem("vaulte:magicEmail"))).toBeNull();
  expect((await calls(page)).filter(([fn]) => fn === "signInWithLink")).toEqual([
    ["signInWithLink", { email: "jane@example.com", href: expect.stringContaining("/app.html") }],
  ]);
  expect(await page.evaluate(() => location.pathname)).toBe("/");
});

test("opened from a sign-in link with no stored email: asks; a cancelled prompt stays loading", async ({
  page,
}) => {
  let answer = "new@example.com";
  page.on("dialog", (d) => (answer === null ? d.dismiss() : d.accept(answer)));
  await start(page, { __magicLink: true, __signInUid: "new-u" });
  await expect(page.locator("h2")).toHaveText("Create Account");
  await expect(input(page, "Email Address")).toHaveValue("new@example.com");
  // a failed link sign-in shows the error on Sign In
  await page.addInitScript(() => {
    window.__authFail = { signInWithLink: ["auth/invalid-action-code", "Link expired."] };
  });
  await page.goto("/app.html");
  await expect(page.locator("h2")).toHaveText("Welcome Back");
  await expect(page.locator("text=Link expired.")).toBeVisible();
  answer = null;
  await page.goto("/app.html");
  await expect(page.locator(".spinner-gold")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.locator(".spinner-gold")).toBeVisible(); // nothing else happens
});

test("Google: a new user gets a profile from the Google account; a known one is welcomed back", async ({
  page,
}) => {
  await start(page);
  await page.click("text=Sign In");
  await button(page, "Continue with Google").click();
  await expect(page.locator("text=ACCOUNT CREATED")).toBeVisible();
  await expect(page.locator("text=Welcome, Gina.")).toBeVisible();
  const [doc] = await saved(page);
  expect(doc.path).toBe("users/g-u");
  expect(doc.data).toMatchObject({
    firstName: "Gina",
    lastName: "Marie Google",
    email: "gina@example.com",
    phone: "",
    address: "",
    city: "",
    postcode: "",
    photoURL: "https://photos.test/gina.jpg",
    firebaseUid: "g-u",
    createdAt: "4 October 2026",
  });
  expect(doc.data.uid).toMatch(/^USR-/);
  await page.click("text=Sign Out");
  await expect(page.locator("text=WELCOME TO")).toBeVisible();
  await page.evaluate(() => {
    window.__docs["users/g-u"] = { firstName: "Gina", lastName: "G", uid: "USR-G" };
  });
  await page.click("text=Create Account");
  await button(page, "Continue with Google").click();
  await expect(page.locator("text=WELCOME BACK")).toBeVisible();
  await expect(page.locator("text=Welcome, Gina.")).toBeVisible();
  expect((await saved(page)).length).toBe(1); // nothing saved the second time
});

test("Google: a closed popup is silent, another failure shows; a nameless account", async ({
  page,
}) => {
  await start(page, {
    __authFail: { popup: "auth/popup-closed-by-user" },
    __googleUser: { uid: "g2", email: "g2@example.com", displayName: null, photoURL: null },
  });
  await page.click("text=Sign In");
  await button(page, "Continue with Google").click();
  await page.waitForTimeout(300);
  await expect(page.locator("text=Mock auth/popup-closed-by-user")).toBeHidden();
  await expect(page.locator("h2")).toHaveText("Welcome Back");
  await page.evaluate(() => {
    window.__authFail = { popup: ["auth/network-request-failed", "No network."] };
  });
  await button(page, "Continue with Google").click();
  await expect(page.locator("text=No network.")).toBeVisible();
  await page.evaluate(() => {
    window.__authFail = {};
  });
  await button(page, "Continue with Google").click();
  await expect(page.locator("text=Welcome, .")).toBeVisible();
  const [doc] = await saved(page);
  expect(doc.data).toMatchObject({ firstName: "", lastName: "", photoURL: "" });
});

test("already signed in: a stored profile opens the account; none goes to the landing page", async ({
  page,
}) => {
  await start(page, {
    __authUser: { uid: "u", email: "jane@example.com" },
    __docs: { "users/u": PROFILE },
  });
  await expect(page.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("text=WELCOME BACK")).toBeHidden(); // no toast on a quiet return
  await page.addInitScript(() => {
    window.__docs = {}; // runs after the first init script: no profile this time
  });
  await page.goto("/app.html");
  await expect(page.locator("text=WELCOME TO")).toBeVisible();
});

test("Sign Out returns to the landing page and clears the sign-in form", async ({ page }) => {
  await start(page, { __docs: { "users/u": PROFILE } });
  await page.click("text=Sign In");
  await fill(page, "Email Address", "jane@example.com");
  await fill(page, "Password", "secret");
  await button(page, "Sign In").click();
  await expect(page.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
  await page.click("text=Sign Out");
  await expect(page.locator("text=WELCOME TO")).toBeVisible();
  expect((await calls(page)).at(-1)).toEqual(["signOut", {}]);
  await page.click("text=Sign In");
  await expect(input(page, "Email Address")).toHaveValue("");
});
