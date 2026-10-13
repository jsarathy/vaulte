// api/_admin/notify.js — tells the admins by email that someone is waiting to be let in (Fix 134),
// through Resend's REST API (no package). The admin addresses come from ADMIN_EMAILS and the key from
// RESEND_API_KEY, both server environment variables. Without a key nothing is sent; a failure is
// logged and never stops the person's request.
import { adminEmails } from "./users.js";

const RESEND_URL = "https://api.resend.com/emails";
const SITE = "https://vaulte-roan.vercel.app";

/** The email to the admins about one person waiting. */
export function waitingMail(person, env = process.env) {
  const who = person.email || "Someone";
  return {
    from: env.NOTIFY_FROM || "Vaulte <onboarding@resend.dev>",
    to: [...adminEmails(env)],
    subject: `Vaulte: ${who} is waiting for approval`,
    text:
      `${who} has confirmed their email address and is waiting to use Claude in Vaulte.\n\n` +
      `To let them in, sign in at ${SITE}, open the Dashboard, open USERS and press Approve on their row.`,
  };
}

/** Sends it; true when Resend accepted it. Never throws. */
export async function notifyAdmins(
  person,
  { env = process.env, fetchJson = (u, o) => fetch(u, o) } = {},
) {
  const mail = waitingMail(person, env);
  if (!env.RESEND_API_KEY || !mail.to.length) {
    console.warn("notify: no RESEND_API_KEY or no admin address; nobody was told");
    return false;
  }
  try {
    const res = await fetchJson(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mail),
    });
    if (!res.ok) console.error("notify: the email was refused", res.status);
    return res.ok === true;
  } catch (err) {
    console.error("notify: the email could not be sent:", err.message);
    return false;
  }
}
