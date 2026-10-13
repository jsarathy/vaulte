// api/_polar/v4sync.js — heart rate from Polar's newer API (v4) during a sync (Fix 125). The old
// sync (v3) hands each exercise over once and deletes it after the commit, and often without its
// heart rate. When the person has signed in to v4 (the History button), a sync reads the heart rate
// of the new sessions that came without it, and quietly fills a few older stored sessions that have
// none: newest first, each tried once (hr_v4_checked_at), within a time budget. Without a v4 sign-in
// nothing here does anything.
import { loadV4, saveV4, sessionDoc, sessionsWithoutHr } from "./store.js";
import { fetchV4Hr } from "./v4.js";

const BACKFILL_MAX = 3; // older sessions per sync
const BUDGET_MS = 8000; // time the v4 lookups may take in one sync

const hasHr = (s) => Array.isArray(s.hr_samples) && s.hr_samples.length > 0;
const newestFirst = (a, b) => String(b.start_time).localeCompare(String(a.start_time));

const NO_HISTORY = {
  fill: async (sessions) => sessions,
  backfill: async () => 0,
  close: async () => {},
};

/** The v4 lookup for one session: its { hr_samples, recording_rate_s }, null when v4 answered but
 *  has none, and undefined when it was not asked (out of time, every request failed, or the lookup
 *  threw: logged), so that it is asked again next time. */
function lookupWith(state, deadline) {
  return async (session) => {
    if (Date.now() > deadline) return undefined;
    try {
      const found = await fetchV4Hr({ conn: state.conn, session }, state.deps);
      if (found.saved) state.conn = found.saved; // refreshed tokens, stored at the end
      if (found.hr) return found.hr;
      return found.attempts.some((a) => a.ok) ? null : undefined;
    } catch (err) {
      console.warn("Polar v4 lookup failed:", err.message);
      return undefined;
    }
  };
}

/** The new sessions with their heart rate filled in from v4 where they came without it. */
async function fillNew(sessions, lookup) {
  const out = [];
  for (const s of sessions) {
    const hr = hasHr(s) ? null : await lookup(s);
    out.push(hr ? { ...s, ...hr } : s);
  }
  return out;
}

/** Fills up to BACKFILL_MAX stored sessions without heart rate that v4 has not been asked about;
 *  returns how many got it. A session v4 answered for (with or without) is marked as asked. */
async function backfillOld(db, userId, lookup) {
  const stored = await sessionsWithoutHr(db, userId);
  const todo = stored.filter((s) => s.start_time && !s.hr_v4_checked_at).sort(newestFirst);
  let filled = 0;
  for (const s of todo.slice(0, BACKFILL_MAX)) {
    const hr = await lookup(s);
    if (hr === undefined) continue; // not tried: ask again next time
    const checked = { hr_v4_checked_at: new Date().toISOString() };
    await sessionDoc(db, userId, s.id).update(hr ? { ...hr, ...checked } : checked);
    if (hr) filled += 1;
  }
  return filled;
}

/** { fill(sessions), backfill(), close() } for the person; all do nothing without a v4 sign-in. */
export async function openHistory(db, userId) {
  const conn = await loadV4(db, userId);
  if (!conn) return NO_HISTORY;
  const state = { conn, deps: { env: process.env, fetcher: fetch, now: Date.now() } };
  const lookup = lookupWith(state, Date.now() + BUDGET_MS);
  return {
    fill: (sessions) => fillNew(sessions, lookup),
    backfill: () => backfillOld(db, userId, lookup),
    close: async () => {
      if (state.conn !== conn) await saveV4(db, userId, state.conn);
    },
  };
}
