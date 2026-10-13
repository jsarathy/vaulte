// api/polar-fetch-hr.js — POST { sessionId }: fetch a stored session's heart-rate samples
// from Polar, save them on the session and return them. Only a signed-in person may call it (their
// Firebase ID token, Fix 119); it reads that person's own session (the user id is the token's).
import { callerOf } from "./_admin/caller.js";
import { verifyIdToken } from "./_admin/verify.js";
import { getAdminDb, loadV4, saveV4 } from "./_polar/store.js";
import { fetchV4Hr } from "./_polar/v4.js";
import {
  authHeaders,
  candidateUrls,
  firstSamples,
  hrChannel,
  recentFinder,
  outsideWindow,
} from "./_polar/hrFetch.js";

const fail = (status, body) => ({ status, body });
const UNAVAILABLE = (attempts) =>
  fail(502, {
    error: "samples_unavailable",
    message:
      "Polar returned no HR sample data. Check that HR recording was enabled on your watch and that you have re-authorised Vaulte with the Reconnect button.",
    attempts,
  });

const TOO_OLD = (attempts) =>
  fail(404, {
    error: "too_old",
    message:
      "Polar only shares a session's heart-rate data for 30 days after it was uploaded to Polar Flow, and this session is older. It can't be fetched.",
    attempts,
  });

/** The samples reply and every attempt: the per-session URLs first, then the recent-exercises list. */
async function findSamples({ session, urls, headers, polarUserId }) {
  const first = await firstSamples(urls, headers);
  if (first.data) return first;
  const { match, attempts } = await recentFinder(headers, polarUserId).find(session);
  return {
    data: match ? { samples: match.samples } : null,
    attempts: [...first.attempts, ...attempts],
  };
}

/** The token check; a test replaces it. */
export const deps = { verify: verifyIdToken };

/** The { status, body } to send when the request cannot be served; otherwise { caller } (the user). */
async function checked(req) {
  if (req.method !== "POST") return { rejected: fail(405, { error: "Method not allowed" }) };
  const caller = await callerOf(req, deps.verify);
  if (caller.error) return { rejected: fail(caller.error.status, caller.error.body) };
  if (!req.body?.sessionId) return { rejected: fail(400, { error: "Missing sessionId" }) };
  return { caller };
}

/** The session and connection to fetch for, or the { status, body } reply that says why not. */
async function load(db, { userId, sessionId }) {
  const ref = db.doc(`users/${userId}/polar_sessions/${sessionId}`);
  const sessionDoc = await ref.get();
  if (!sessionDoc.exists) return { fail: fail(404, { error: "Session not found" }) };
  const connDoc = await db.doc(`users/${userId}/polar/connection`).get();
  if (!connDoc.exists) return { fail: fail(401, { error: "Polar not connected" }) };
  return { ref, session: sessionDoc.data(), conn: connDoc.data() };
}

/** { hr, attempts }: the heart rate from Polar's newer API (v4) when the person has signed in to
 *  it, with the refreshed tokens stored; hr null and no attempts when they have not. */
async function viaV4(db, { userId }, session) {
  const conn = await loadV4(db, userId);
  if (!conn) return { hr: null, attempts: [], signedIn: false };
  const deps = { env: process.env, fetcher: fetch, now: Date.now() };
  const out = await fetchV4Hr({ conn, session }, deps);
  if (out.saved) await saveV4(db, userId, out.saved);
  return { hr: out.hr, attempts: out.attempts, signedIn: true };
}

/** { status, body }: the samples saved on the session, or why not. */
async function fetchHr(db, ids) {
  const loaded = await load(db, ids);
  if (loaded.fail) return loaded.fail;
  const { ref, session, conn } = loaded;
  const urls = candidateUrls(session, ids.sessionId, conn.polar_user_id);
  const headers = authHeaders(conn.access_token);
  const { data, attempts } = await findSamples({
    session,
    urls,
    headers,
    polarUserId: conn.polar_user_id,
  });
  if (!data) return fromV4(db, { ids, ref, session, attempts });
  const hr = hrChannel(data);
  if (hr.status) return hr;
  await ref.update(hr); // so the next open shows the chart immediately
  return { status: 200, body: { ok: true, ...hr } };
}

/** The v4 route when v3 had nothing: the heart rate saved on the session, or why not. */
async function fromV4(db, { ids, ref, session, attempts }) {
  const v4 = await viaV4(db, ids, session);
  const all = [...attempts, ...v4.attempts];
  if (v4.hr) {
    await ref.update(v4.hr);
    return { status: 200, body: { ok: true, ...v4.hr } };
  }
  return outsideWindow(session) && !v4.signedIn ? TOO_OLD(all) : UNAVAILABLE(all);
}

export default async function handler(req, res) {
  const { rejected, caller } = await checked(req);
  if (rejected) return res.status(rejected.status).json(rejected.body);
  try {
    const { status, body } = await fetchHr(getAdminDb(), {
      userId: caller.uid,
      sessionId: req.body.sessionId,
    });
    return status === 200 ? res.json(body) : res.status(status).json(body);
  } catch (err) {
    console.error("polar-fetch-hr error:", err);
    return res.status(500).json({ error: err.message });
  }
}
