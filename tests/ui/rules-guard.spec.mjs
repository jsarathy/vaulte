// tests/ui/rules-guard.spec.mjs — the UI harness checks every Firestore and Storage call against the
// real firestore.rules and storage.rules (Fix 124). This spec makes calls the rules allow and calls
// they do not, straight at the harness's data layer, and shows that each refusal throws and is
// reported to the test (which would otherwise fail it; see tests/ui/cover.mjs).
import { test, expect } from "./cover.mjs";

const attempts = (p) =>
  p.evaluate(async () => {
    const m = await import("/mocks.js");
    const out = {};
    const attempt = async (label, fn) => {
      try {
        await fn();
        out[label] = "ok";
      } catch (e) {
        out[label] = e.message;
      }
    };
    const d = (...parts) => m.doc({}, ...parts);
    const photo = (size, type) => ({ size, type });
    window.__docs = { ...window.__docs, "users/u/app_errors/seen": { x: 1 } };

    // what the rules allow
    await attempt("save a recipe", () => m.setDoc(d("users", "u", "recipes", "r"), { a: 1 }));
    await attempt("read the profile", () => m.getDoc(d("users", "u")));
    await attempt("add an error entry", () =>
      m.setDoc(d("users", "u", "app_errors", "new"), { a: 1 }),
    );
    await attempt("list sessions", () =>
      m.getDocs(m.collection({}, "users", "u", "polar_sessions")),
    );
    await attempt("read the Polar link", () => m.getDoc(d("users", "u", "polar", "connection")));
    await attempt("read Apple activity", () =>
      m.getDoc(d("users", "u", "apple_activity", "2026-10-01")),
    );
    await attempt("upload a photo", () =>
      m.uploadBytes(m.ref({}, "profile-photos/u.jpg"), photo(1000, "image/jpeg")),
    );
    await attempt("upload a big phone photo", () =>
      m.uploadBytes(m.ref({}, "profile-photos/u.jpg"), photo(15 * 1024 * 1024, "image/heic")),
    );

    // what they do not
    await attempt("write Apple activity", () =>
      m.setDoc(d("users", "u", "apple_activity", "x"), { a: 1 }),
    );
    await attempt("write Claude usage", () => m.setDoc(d("users", "u", "ai_usage", "x"), { a: 1 }));
    await attempt("write the Polar link", () =>
      m.setDoc(d("users", "u", "polar", "connection"), { a: 1 }),
    );
    await attempt("read the v4 tokens", () => m.getDoc(d("users", "u", "polar", "connection_v4")));
    await attempt("list the Polar folder", () =>
      m.getDocs(m.collection({}, "users", "u", "polar")),
    );
    await attempt("change an error entry", () =>
      m.setDoc(d("users", "u", "app_errors", "seen"), { a: 2 }),
    );
    await attempt("delete an error entry", () =>
      m.deleteDoc(d("users", "u", "app_errors", "seen")),
    );
    await attempt("a new collection", () => m.setDoc(d("users", "u", "surprise", "x"), { a: 1 }));
    await attempt("read a new collection", () => m.getDoc(d("users", "u", "surprise", "x")));
    await attempt("outside users", () => m.getDoc(d("somewhere", "else")));
    await attempt("unattributed usage", () => m.getDoc(d("ai_usage_unattributed", "a1")));
    await attempt(
      "listen to a new collection",
      () =>
        new Promise((res, rej) =>
          m.onSnapshot(m.collection({}, "users", "u", "surprise"), res, rej),
        ),
    );
    await attempt("photo in another folder", () =>
      m.uploadBytes(m.ref({}, "videos/u.mp4"), photo(1000, "image/jpeg")),
    );
    await attempt("photo too big", () =>
      m.uploadBytes(m.ref({}, "profile-photos/u.jpg"), photo(25 * 1024 * 1024, "image/jpeg")),
    );
    await attempt("a file that is not an image", () =>
      m.uploadBytes(m.ref({}, "profile-photos/u.jpg"), photo(1000, "application/pdf")),
    );
    await attempt("another folder's address", () => m.getDownloadURL(m.ref({}, "videos/u.mp4")));
    await attempt("another folder's delete", () => m.deleteObject(m.ref({}, "videos/u.mp4")));
    return out;
  });

test("the harness allows what the rules allow and refuses the rest, reporting each refusal to the test", async ({
  page: p,
}) => {
  await p.goto("/tracker.html");
  const out = await attempts(p);
  const allowed = [
    "save a recipe",
    "read the profile",
    "add an error entry",
    "list sessions",
    "read the Polar link",
    "read Apple activity",
    "upload a photo",
    "upload a big phone photo",
  ];
  for (const label of allowed) expect(out[label], label).toBe("ok");

  expect(out["write Apple activity"]).toBe(
    'firestore.rules: create users/u/apple_activity/x: the rules do not allow this on "apple_activity"',
  );
  expect(out["write Claude usage"]).toMatch(/^firestore\.rules: create .*"ai_usage"/);
  expect(out["write the Polar link"]).toMatch(
    /^firestore\.rules: create users\/u\/polar\/connection: .*"polar"/,
  );
  expect(out["read the v4 tokens"]).toMatch(
    /^firestore\.rules: get users\/u\/polar\/connection_v4/,
  );
  expect(out["list the Polar folder"]).toMatch(/^firestore\.rules: list users\/u\/polar:/);
  expect(out["change an error entry"]).toMatch(
    /^firestore\.rules: update users\/u\/app_errors\/seen/,
  );
  expect(out["delete an error entry"]).toMatch(
    /^firestore\.rules: delete users\/u\/app_errors\/seen/,
  );
  expect(out["a new collection"]).toBe(
    'firestore.rules: create users/u/surprise/x: no rule for "surprise"',
  );
  expect(out["read a new collection"]).toMatch(/no rule for "surprise"/);
  expect(out["outside users"]).toMatch(/not under users\/\{uid\}/);
  expect(out["unattributed usage"]).toMatch(/not under users\/\{uid\}/);
  expect(out["listen to a new collection"]).toMatch(/^firestore\.rules: list users\/u\/surprise/);
  expect(out["photo in another folder"]).toBe(
    'storage.rules: videos/u.mp4: no Storage rule for "videos/u.mp4"',
  );
  expect(out["photo too big"]).toBe(
    "storage.rules: profile-photos/u.jpg: larger than the rules allow",
  );
  expect(out["a file that is not an image"]).toBe(
    "storage.rules: profile-photos/u.jpg: not an image",
  );
  expect(out["another folder's address"]).toMatch(/^storage\.rules: videos\/u\.mp4/);
  expect(out["another folder's delete"]).toMatch(/^storage\.rules: videos\/u\.mp4/);

  // every refusal was reported to the test, in order, and nothing allowed was
  const refused = Object.entries(out)
    .filter(([, v]) => v !== "ok")
    .map(([, v]) => v);
  expect(p.rulesViolations).toEqual(refused);
  expect(p.rulesViolations.length).toBe(17);
  p.rulesViolations.length = 0; // these were on purpose: the test must not fail on them
});
