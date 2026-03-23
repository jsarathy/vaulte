// api/polar-fetch-hr.js
// Fetches HR samples for a specific already-synced session using the stored exercise URL.
// Called from the frontend when a session has no hr_samples (synced before HR feature).

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userId, sessionId } = req.body;
  if (!userId || !sessionId) return res.status(400).json({ error: "Missing userId or sessionId" });

  try {
    const db = getAdminDb();

    // Load the session doc
    const sessionDoc = await db.doc(`users/${userId}/polar_sessions/${sessionId}`).get();
    if (!sessionDoc.exists) return res.status(404).json({ error: "Session not found" });

    const session = sessionDoc.data();
    if (!session.polar_user_id && !session.exercise_url) {
      return res.status(422).json({ error: "no_url", message: "Cannot fetch HR for this session — missing Polar identifiers." });
    }

    // Load access token
    const connDoc = await db.doc(`users/${userId}/polar/connection`).get();
    if (!connDoc.exists) return res.status(401).json({ error: "Polar not connected" });

    const { access_token } = connDoc.data();
    const AUTH = { "Authorization": `Bearer ${access_token}`, "Accept": "application/json" };

    // Fetch samples via the permanent training data API (works after transaction commit)
    // Falls back to stored exercise_url if polar_user_id not available
    const baseUrl = session.polar_user_id
      ? `https://www.polaraccesslink.com/v3/users/${session.polar_user_id}/exercises/${sessionId}`
      : session.exercise_url;

    if (!baseUrl) {
      return res.status(422).json({ error: "no_url", message: "No exercise URL available. Re-sync a new session to capture HR data." });
    }

    // Try permanent training data endpoint first, fall back to transaction URL
    let samplesData = null;
    const urlsToTry = [
      `https://www.polaraccesslink.com/v3/users/${session.polar_user_id}/exercises/${sessionId}/samples`,
      session.exercise_url ? `${session.exercise_url}/samples` : null,
    ].filter(Boolean);

    for (const url of urlsToTry) {
      const samplesRes = await fetch(url, { headers: AUTH });
      if (samplesRes.ok) {
        samplesData = await samplesRes.json();
        break;
      }
      console.warn("Samples fetch failed at:", url, samplesRes.status);
    }

    if (!samplesData) {
      return res.status(502).json({ error: "Polar samples fetch failed on all URLs" });
    }
    const sampleSets = samplesData["samples"] || [];
    const hrSet = sampleSets.find(s => String(s["sample-type"]) === "0");

    if (!hrSet?.data) {
      return res.status(404).json({ error: "no_hr", message: "No heart rate data available for this session." });
    }

    const raw = hrSet.data.split(",").map(v => parseInt(v.trim(), 10));
    const firstNonZero = raw.findIndex(v => v > 0);
    const hr_samples = firstNonZero >= 0
      ? raw.slice(firstNonZero).map(v => v > 0 ? v : null)
      : null;
    const recording_rate_s = hrSet["recording-rate"] || 5;

    if (!hr_samples) {
      return res.status(404).json({ error: "no_hr", message: "No valid heart rate readings in this session." });
    }

    // Save back to Firestore
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
