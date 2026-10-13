// tests/api/admin-notify.test.mjs — the email to the admins about a person waiting (Fix 134):
// api/_admin/notify.js, with Resend's REST API replaced.
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { notifyAdmins, waitingMail } from "../../api/_admin/notify.js";

const ENV = { ADMIN_EMAILS: "Boss@Example.com, second@example.com", RESEND_API_KEY: "re_test" };

test("the mail: to every admin, from Resend's sender unless one is set, and says who and what to do", () => {
  const mail = waitingMail({ email: "jane@example.com" }, ENV);
  assert.deepEqual(mail.to, ["boss@example.com", "second@example.com"]);
  assert.equal(mail.from, "Vaulte <onboarding@resend.dev>");
  assert.equal(mail.subject, "Vaulte: jane@example.com is waiting for approval");
  assert.match(mail.text, /jane@example\.com has confirmed their email address/);
  assert.match(mail.text, /Dashboard.*USERS.*Approve/s);
  assert.equal(
    waitingMail({ email: "x@y.z" }, { ...ENV, NOTIFY_FROM: "Me <me@example.com>" }).from,
    "Me <me@example.com>",
  );
  assert.equal(waitingMail({}, ENV).subject, "Vaulte: Someone is waiting for approval");
});

test("it posts the mail to Resend with the key", async () => {
  const seen = [];
  const fetchJson = async (url, opts) => (seen.push([url, opts]), { ok: true });
  assert.equal(await notifyAdmins({ email: "jane@example.com" }, { env: ENV, fetchJson }), true);
  const [url, opts] = seen[0];
  assert.equal(url, "https://api.resend.com/emails");
  assert.equal(opts.method, "POST");
  assert.equal(opts.headers.Authorization, "Bearer re_test");
  assert.equal(opts.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(opts.body), waitingMail({ email: "jane@example.com" }, ENV));
});

test("no key, or no admin address: nothing is sent, and it says so", async () => {
  const warn = mock.method(console, "warn", () => {});
  const fetchJson = async () => assert.fail("must not send");
  assert.equal(
    await notifyAdmins(
      { email: "a@b.c" },
      { env: { ADMIN_EMAILS: "boss@example.com" }, fetchJson },
    ),
    false,
  );
  assert.equal(
    await notifyAdmins({ email: "a@b.c" }, { env: { RESEND_API_KEY: "k" }, fetchJson }),
    false,
  );
  assert.equal(warn.mock.calls.length, 2);
  warn.mock.restore();
});

test("a refused or failed send is logged and returns false, never throws", async () => {
  const err = mock.method(console, "error", () => {});
  assert.equal(
    await notifyAdmins(
      { email: "a@b.c" },
      { env: ENV, fetchJson: async () => ({ ok: false, status: 403 }) },
    ),
    false,
  );
  assert.equal(
    await notifyAdmins(
      { email: "a@b.c" },
      {
        env: ENV,
        fetchJson: async () => {
          throw new Error("network down");
        },
      },
    ),
    false,
  );
  assert.deepEqual(
    err.mock.calls.map((c) => c.arguments.join(" ")),
    ["notify: the email was refused 403", "notify: the email could not be sent: network down"],
  );
  err.mock.restore();
});
