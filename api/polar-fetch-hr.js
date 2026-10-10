// api/polar-fetch-hr.js — POST { userId, sessionId }: fetch a stored session's heart-rate samples
// from Polar, save them on the session and return them.
import { getAdminDb } from "./_polar/store.js";
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

function rejection(req) {
  if (req.method !== "POST") return fail(405, { error: "Method not allowed" });
  const { userId, sessionId } = req.body;
  if (!userId || !sessionId) return fail(400, { error: "Missing userId or sessionId" });
  return null;
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
  if (!data) return outsideWindow(session) ? TOO_OLD(attempts) : UNAVAILABLE(attempts);
  const hr = hrChannel(data);
  if (hr.status) return hr;
  await ref.update(hr); // so the next open shows the chart immediately
  return { status: 200, body: { ok: true, ...hr } };
}

export default async function handler(req, res) {
  const rejected = rejection(req);
  if (rejected) return res.status(rejected.status).json(rejected.body);
  try {
    const { status, body } = await fetchHr(getAdminDb(), req.body);
    return status === 200 ? res.json(body) : res.status(status).json(body);
  } catch (err) {
    console.error("polar-fetch-hr error:", err);
    return res.status(500).json({ error: err.message });
  }
}
