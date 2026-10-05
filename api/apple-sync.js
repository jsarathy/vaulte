// api/apple-sync.js — receives Apple Health samples from an iOS Shortcut
// and stores them as 5-minute slots in users/{uid}/apple_activity/{date}.
// Parsing, bucketing and the record shapes live in api/_apple/ (not deployed as functions).
//
// POST /api/apple-sync
// Two body formats: daily totals { date, steps, active, flights } (numbers), or timestamped samples below.
// Daily-totals mode may also carry hourly steps (Find Health Samples, Group by Hour):
//   hourly_steps: [812, 1540, ...]   hourly_start: ["2026-09-27T07:00:00+01:00", ...]  (same order)
// Hours with no steps are simply absent (Fill Missing OFF), hence the start times.
// Stored as hourly: { "07": 812, "08": 1540, ... } alongside totals.
// Headers: Authorization: Bearer <APPLE_SYNC_TOKEN>
// Body: {
//   date:    "YYYY-MM-DD",                       // day being synced (whole day is replaced)
//   steps:   [{ s:"<start ISO>", e:"<end ISO>", v:<number>, src?:"<source name>" }, ...],
//   active:  [ ...same shape, v = exercise minutes ],
//   flights: [ ...same shape, v = flights climbed ]
// }
// Times are read as local wall-clock (the HH:MM in the string), matching Polar start_time.
import { parseBody, rejection, resolveDate } from "./_apple/request.js";
import { dailyRecord, isDailyMode, slotRecord, writeDay } from "./_apple/store.js";

export default async function handler(req, res) {
  const refused = rejection(req);
  if (refused) return res.status(refused.status).json({ error: refused.error });
  const body = parseBody(req.body);
  if (body === null) return res.status(400).json({ error: "Invalid JSON" });
  const date = resolveDate(body.date);
  if (!date) return res.status(400).json({ error: `Unrecognised date: ${body.date}` });

  const { record, reply } = isDailyMode(body) ? dailyRecord(body, date) : slotRecord(body, date);
  try {
    await writeDay(process.env.APPLE_SYNC_USER_ID, date, record);
    return res.json({ ok: true, date, ...reply });
  } catch (e) {
    console.error("apple-sync write failed:", e);
    return res.status(500).json({ error: "Firestore write failed" });
  }
}
