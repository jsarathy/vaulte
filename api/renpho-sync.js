// api/renpho-sync.js
// Pulls weight measurements from the Renpho Health cloud (cloud.renpho.com).
// With { kind: "girth" } in the body it instead pulls Smart Tape Measure
// (body girth) readings for the Body tab.
//
// There is no official Renpho API. The endpoints, the AES-128-ECB envelope and
// the payload shapes (api/_renpho/) come from reverse-engineered clients and can
// break without notice. Credentials stay server-side: never call this from the
// client with the email/password in the body.
//
// Required Vercel env vars:
//   RENPHO_EMAIL
//   RENPHO_PASSWORD

import { login } from "./_renpho/client.js";
import { fetchGirths, girthRecords } from "./_renpho/girth.js";
import { fetchMeasurements, fetchScales, weightRecords } from "./_renpho/weight.js";

const NO_SCALE = {
  records: [],
  count: 0,
  warning: "No scale found on the account. Open the Renpho Health app and let it sync.",
};

/** The cutoff date from the request: only "YYYY-MM-DD", else none. */
const cutoffOf = (body) =>
  typeof body?.fromDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.fromDate)
    ? body.fromDate
    : null;

async function girthSync(auth) {
  const raw = await fetchGirths(auth);
  const records = girthRecords(raw);
  return { records, count: records.length, rawCount: raw.length };
}

async function weightSync(auth, fromDate) {
  const scales = await fetchScales(auth);
  if (!scales.length) return NO_SCALE;
  const raw = await fetchMeasurements(scales, auth);
  const { records, rejected, metricKeys } = weightRecords(raw, fromDate);
  return { records, count: records.length, rawCount: raw.length, rejected, fromDate, metricKeys };
}

async function sync(body) {
  const auth = await login(process.env.RENPHO_EMAIL, process.env.RENPHO_PASSWORD);
  return body?.kind === "girth" ? girthSync(auth) : weightSync(auth, cutoffOf(body));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!process.env.RENPHO_EMAIL || !process.env.RENPHO_PASSWORD)
    return res.status(500).json({ error: "RENPHO_EMAIL / RENPHO_PASSWORD not configured" });
  try {
    return res.status(200).json(await sync(req.body));
  } catch (err) {
    console.error("renpho-sync error:", err);
    return res.status(502).json({ error: err.message || "Renpho sync failed" });
  }
}
