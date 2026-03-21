// api/polar-sync.js
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { parseDurationMin } from "../src/constants/helpers.js";

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const db = getAdminDb();

    // ── Load stored Polar tokens ──────────────────────────────────────────────
    const connDoc = await db.doc(`users/${userId}/polar/connection`).get();
    if (!connDoc.exists || !connDoc.data().connected) {
      return res.status(401).json({ error: "Polar account not connected" });
    }
    const { access_token, polar_user_id } = connDoc.data();
    const AUTH = { "Authorization": `Bearer ${access_token}`, "Accept": "application/json" };
    const POLAR = "https://www.polaraccesslink.com";

    // ── Step 1: Create exercise transaction ───────────────────────────────────
    const txRes = await fetch(`${POLAR}/v3/users/${polar_user_id}/exercise-transactions`, {
      method: "POST", headers: AUTH,
    });
    if (txRes.status === 204) {
      await db.doc(`users/${userId}/polar/connection`).update({ last_sync_at: new Date().toISOString() });
      return res.json({ newSessions: 0, sessions: [] });
    }
    if (!txRes.ok) {
      const errText = await txRes.text();
      return res.status(502).json({ error: "Failed to create Polar transaction", detail: errText });
    }
    const txData = await txRes.json();
    const transactionId = txData["transaction-id"];

    // ── Step 2: List exercises in transaction ─────────────────────────────────
    const listRes = await fetch(
      `${POLAR}/v3/users/${polar_user_id}/exercise-transactions/${transactionId}`,
      { headers: AUTH }
    );
    if (!listRes.ok) return res.status(502).json({ error: "Failed to list exercises" });
    const listData = await listRes.json();
    const exerciseUrls = listData.exercises || [];

    // ── Step 3: Fetch each exercise + HR samples ──────────────────────────────
    // IMPORTANT: samples must be fetched before the PUT commit in Step 4
    const sessions = [];
    for (const url of exerciseUrls) {
      try {
        const exRes = await fetch(url, { headers: AUTH });
        if (!exRes.ok) continue;
        const ex = await exRes.json();

        // Fetch HR time series (sample-type "0" = heart rate in bpm)
        let hr_samples = null;
        let recording_rate_s = null;
        try {
          const samplesRes = await fetch(`${url}/samples`, { headers: AUTH });
          if (samplesRes.ok) {
            const samplesData = await samplesRes.json();
            const sampleSets = samplesData["samples"] || [];
            const hrSet = sampleSets.find(s => String(s["sample-type"]) === "0");
            if (hrSet?.data) {
              const raw = hrSet.data.split(",").map(v => parseInt(v.trim(), 10));
              // Strip leading zeros (pre-start padding) but keep internal zeros → null
              const firstNonZero = raw.findIndex(v => v > 0);
              hr_samples = firstNonZero >= 0
                ? raw.slice(firstNonZero).map(v => v > 0 ? v : null)
                : null;
              recording_rate_s = hrSet["recording-rate"] || 5;
            }
          }
        } catch (sErr) {
          console.warn("HR samples fetch failed for:", url, sErr.message);
        }

        sessions.push({
          id:               String(ex.id),
          sport:            ex["detailed-sport-info"] || ex.sport || "OTHER",
          start_time:       ex["start-time"],
          duration_min:     parseDurationMin(ex.duration),
          calories:         ex.calories || 0,
          hr_avg:           ex["heart-rate"]?.average || null,
          hr_max:           ex["heart-rate"]?.maximum || null,
          fat_pct:          ex["fat-percentage"] || null,
          has_route:        ex["has-route"] || false,
          device:           ex.device || null,
          hr_samples,         // int[] bpm at recording_rate_s intervals, null if unavailable
          recording_rate_s,   // seconds between samples, typically 5
          exercise_url:     url,  // stored so HR can be re-fetched on demand
          polar_user_id,
          fetched_at:       new Date().toISOString(),
          logged:           false,
        });
      } catch (exErr) {
        console.warn("Failed to fetch exercise:", url, exErr);
      }
    }

    // ── Step 4: Commit transaction ────────────────────────────────────────────
    await fetch(
      `${POLAR}/v3/users/${polar_user_id}/exercise-transactions/${transactionId}`,
      { method: "PUT", headers: AUTH }
    );

    // ── Step 5: Save to Firestore ─────────────────────────────────────────────
    const batch = db.batch();
    for (const s of sessions) {
      batch.set(db.doc(`users/${userId}/polar_sessions/${s.id}`), s);
    }
    batch.update(db.doc(`users/${userId}/polar/connection`), {
      last_sync_at: new Date().toISOString(),
    });
    await batch.commit();

    return res.json({ newSessions: sessions.length, sessions });

  } catch (err) {
    console.error("Polar sync error:", err);
    return res.status(500).json({ error: err.message });
  }
}
