// tests/ui/error-log.spec.mjs — recording the signed-in user's errors (src/hooks/useErrorLog.js,
// Fix 98 part 2): the app's own console.error, uncaught errors and unhandled rejections go to
// users/{uid}/app_errors; repeats and noise are held back; a failing write is harmless. Firebase is
// mocked; the writes are in window.__setDocs.
import { test, expect } from "./cover.mjs";

const start = async (p, init = {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.addInitScript((i) => Object.assign(window, i), {
    __authUser: { uid: "u", email: "jane@example.com" },
    __docs: { "users/u": { firstName: "Jane", lastName: "Smith" } },
    ...init,
  });
  await p.goto("/app.html");
  await expect(p.locator("text=Welcome, Jane.")).toBeVisible({ timeout: 15_000 });
};
const logged = (p) =>
  p.evaluate(() => window.__setDocs.filter((d) => d.path.startsWith("users/u/app_errors/")));

test("the app's own console.error is recorded, and still reaches the console", async ({
  page: p,
}) => {
  const seen = [];
  p.on("console", (m) => m.type() === "error" && seen.push(m.text()));
  await start(p);
  await p.evaluate(() => console.error("Weight save failed", new Error("Mock setDoc failure")));
  await expect.poll(async () => (await logged(p)).length).toBe(1);
  const [entry] = await logged(p);
  expect(entry.path).toMatch(/^users\/u\/app_errors\/\d+-[a-z0-9]+$/);
  expect(entry.data).toMatchObject({
    source: "console",
    page: "/app.html",
    message: "Weight save failed Mock setDoc failure",
  });
  expect(entry.data.at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  expect(entry.data.stack).toContain("Mock setDoc failure");
  expect(seen.some((t) => t.startsWith("Weight save failed Error: Mock setDoc failure"))).toBe(
    true,
  ); // the original still logs
});

test("an uncaught error and an unhandled rejection are recorded with their kind", async ({
  page: p,
}) => {
  await start(p);
  await p.evaluate(() => {
    setTimeout(() => {
      throw new Error("Uncaught thing");
    }, 0);
    Promise.reject(new Error("Rejected thing"));
  });
  await expect.poll(async () => (await logged(p)).length).toBe(2);
  const kinds = Object.fromEntries((await logged(p)).map((e) => [e.data.source, e.data.message]));
  expect(kinds).toEqual({ error: "Uncaught thing", promise: "Rejected thing" });
});

test("the same message is recorded once a minute; different ones are all recorded", async ({
  page: p,
}) => {
  await start(p);
  await p.evaluate(() => {
    for (let i = 0; i < 5; i++) console.error("Same failure");
    console.error("Another failure");
  });
  await expect.poll(async () => (await logged(p)).length).toBe(2);
  expect((await logged(p)).map((e) => e.data.message).sort()).toEqual([
    "Another failure",
    "Same failure",
  ]);
});

test("at most 30 messages are recorded in a page load", async ({ page: p }) => {
  await start(p);
  await p.evaluate(() => {
    for (let i = 0; i < 45; i++) console.error(`Failure number ${i}`);
  });
  await expect.poll(async () => (await logged(p)).length).toBe(30);
  await p.waitForTimeout(300);
  expect((await logged(p)).length).toBe(30);
});

test("ResizeObserver noise and empty messages are not recorded", async ({ page: p }) => {
  await start(p);
  await p.evaluate(() => {
    console.error("ResizeObserver loop completed with undelivered notifications.");
    console.error("");
    console.error("A real failure");
  });
  await expect.poll(async () => (await logged(p)).length).toBe(1);
  expect((await logged(p))[0].data.message).toBe("A real failure");
});

test("a message is cut to 300 characters and an object's contents are not written", async ({
  page: p,
}) => {
  await start(p);
  await p.evaluate(() =>
    console.error("Save failed", { weight: 83.4, notes: "private note" }, "y".repeat(400)),
  );
  await expect.poll(async () => (await logged(p)).length).toBe(1);
  const { message } = (await logged(p))[0].data;
  expect(message.length).toBe(300);
  expect(message).toContain("Save failed [object]");
  expect(message).not.toMatch(/83\.4|private note/);
});

test("a failing write is dropped quietly: no crash, no loop, the app keeps working", async ({
  page: p,
}) => {
  await start(p);
  await p.evaluate(() => (window.__failSetDoc = true)); // every write fails from now on
  await p.evaluate(() => {
    console.error("First failure");
    console.error("Second failure");
  });
  await p.waitForTimeout(400);
  expect(await logged(p)).toEqual([]);
  await expect(p.locator("text=Welcome, Jane.")).toBeVisible();
});

test("nothing is recorded when nobody is signed in", async ({ page: p }) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.goto("/app.html");
  await expect(p.getByText("CREATE ACCOUNT", { exact: false }).first()).toBeVisible({
    timeout: 15_000,
  });
  await p.evaluate(() => console.error("Failure with nobody signed in"));
  await p.waitForTimeout(300);
  expect(await p.evaluate(() => window.__setDocs.length)).toBe(0);
});
