// api/polar-fetch-hr.js
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

async function safeFetchJSON(url, headers) {
  const r = await fetch(url, { headers });
  const text = await r.text();
  console.log(`polar-fetch-hr: GET ${url} → ${r.status}, body length ${text.length}`);
  if (!r.ok) return { ok: false, status: r.status, body: text };
  if (!text.trim()) return { ok: false, status: r.status, body: "(empty body)" };
  try {
    return { ok: true, status: r.status, data: JSON.parse(text) };
  } catch (e) {
    return { ok: false, status: r.status, body: text.slice(0, 200) };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userId, sessionId } = req.body;
  if (!userId || !sessionId) return res.status(400).json({ error: "Missing userId or sessionId" });

  try {
    const db = getAdminDb();

    const sessionDoc = await db.doc(`users/${userId}/polar_sessions/${sessionId}`).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: "Session not found" });
    const session = sessionDoc.data();

    const connDoc = await db.doc(`users/${userId}/polar/connection`).get();
    if (!connDoc.exists) return res.status(401).json({ error: "Polar not connected" });
    const { access_token, polar_user_id: connPolarUserId } = connDoc.data();

    const AUTH = { "Authorization": `Bearer ${access_token}`, "Accept": "application/json" };

    // Build candidate URLs — permanent training data API is primary
    const polarUserId = session.polar_user_id || connPolarUserId;
    const urlsToTry = [
      polarUserId
        ? `https://www.polaraccesslink.com/v3/users/${polarUserId}/exercises/${sessionId}/samples`
        : null,
      session.exercise_url ? `${session.exercise_url}/samples` : null,
    ].filter(Boolean);

    if (urlsToTry.length === 0) {
      return res.status(422).json({ error: "no_url", message: "No Polar identifiers found for this session. Re-sync a fresh session." });
    }

    // Try each URL, collect diagnostic info
    let samplesData = null;
    const attempts = [];
    for (const url of urlsToTry) {
      const result = await safeFetchJSON(url, AUTH);
      attempts.push({ url, status: result.status, ok: result.ok });
      if (result.ok) { samplesData = result.data; break; }
    }

    if (!samplesData) {
      return res.status(502).json({
        error: "samples_unavailable",
        message: "Polar returned no HR sample data. Check that HR recording was enabled on your watch and that you have re-authorised Vaulte with the Reconnect button.",
        attempts,
      });
    }

    // Parse HR samples (sample-type "0" = heart rate)
    const sampleSets = samplesData["samples"] || [];
    const hrSet = sampleSets.find(s => String(s["sample-type"]) === "0");

    if (!hrSet?.data) {
      return res.status(404).json({
        error: "no_hr",
        message: `No heart rate channel in samples. Available types: [${sampleSets.map(s=>s["sample-type"]).join(", ")}]`,
      });
    }

    const raw = hrSet.data.split(",").map(v => parseInt(v.trim(), 10));
    const firstNonZero = raw.findIndex(v => v > 0);
    const hr_samples = firstNonZero >= 0
      ? raw.slice(firstNonZero).map(v => v > 0 ? v : null)
      : null;
    const recording_rate_s = hrSet["recording-rate"] || 5;

    if (!hr_samples) {
      return res.status(404).json({ error: "no_hr", message: "All HR values were zero — watch may not have had a lock." });
    }

    // Persist back to Firestore so next open shows chart immediately
    await db.doc(`users/${userId}/polar_sessions/${sessionId}`).update({
      hr_samples,
      recording_rate_s,
    });

    return res.json({ ok: true, hr_samples, recording_rate_s });

  } catch (err) {
    console.error("polar-fetch-hr error:", err);
    return res.status(500).json({ error: err.message });
  }
}
