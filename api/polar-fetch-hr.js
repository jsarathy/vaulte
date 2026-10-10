// api/polar-fetch-hr.js — POST { userId, sessionId }: fetch a stored session's heart-rate samples
// from Polar, save them on the session and return them.
import { getAdminDb } from "./_polar/store.js";
import {
  authHeaders,
  candidateUrls,
  firstSamples,
  hrChannel,
  listRecentExercises,
  matchExercise,
  summariseList,
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

/** The v3 list's match for the session: { data: { samples }, attempt } or { data: null, attempt }. */
async function fromRecentList(session, headers) {
  const { attempt, list } = await listRecentExercises(headers);
  const match = list && matchExercise(list, session);
  const seen = match || !list ? {} : { seen: summariseList(list) };
  return {
    data: match ? { samples: match.samples } : null,
    attempt: { ...attempt, matched: !!match, ...seen },
  };
}

/** The samples reply and every attempt: the per-session URLs first, then the recent-exercises list. */
async function findSamples(session, urls, headers) {
  const first = await firstSamples(urls, headers);
  if (first.data) return first;
  const recent = await fromRecentList(session, headers);
  return { data: recent.data, attempts: [...first.attempts, recent.attempt] };
}

function rejection(req) {
  if (req.method !== "POST") return fail(405, { error: "Method not allowed" });
  const { userId, sessionId } = req.body;
  if (!userId || !sessionId) return fail(400, { error: "Missing userId or sessionId" });
  return null;
}

/** { status, body }: the samples saved on the session, or why not. */
async function fetchHr(db, { userId, sessionId }) {
  const ref = db.doc(`users/${userId}/polar_sessions/${sessionId}`);
  const sessionDoc = await ref.get();
  if (!sessionDoc.exists) return fail(404, { error: "Session not found" });
  const connDoc = await db.doc(`users/${userId}/polar/connection`).get();
  if (!connDoc.exists) return fail(401, { error: "Polar not connected" });
  const { access_token, polar_user_id } = connDoc.data();
  const urls = candidateUrls(sessionDoc.data(), sessionId, polar_user_id);
  const session = sessionDoc.data();
  const { data, attempts } = await findSamples(session, urls, authHeaders(access_token));
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
