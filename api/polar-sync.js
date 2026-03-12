// api/polar-sync.js
// Called from the frontend when the user clicks "Sync Sessions".
// Uses Polar's exercise transaction model — fetches all sessions not yet pulled,
// commits the transaction (so they won't appear again), and writes to Firestore.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminDb() {
  if (!getApps().length) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

// Parse ISO 8601 duration → minutes  e.g. "PT1H30M45S" → 90.75
function parseDurationMin(iso) {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?/);
  if (!m) return 0;
  return (parseFloat(m[1] || 0) * 60) + parseFloat(m[2] || 0) + (parseFloat(m[3] || 0) / 60);
}

// Format sport string: "CYCLING_SPORT" → "Cycling Sport"
function formatSport(raw) {
  if (!raw) return "Exercise";
  return raw.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const db = getAdminDb();

    // ── Load stored Polar tokens ───────────────────────────────────────────────
    const connDoc = await db.doc(`users/${userId}/polar/connection`).get();
    if (!connDoc.exists || !connDoc.data().connected) {
      return res.status(401).json({ error: "Polar account not connected" });
    }

    const { access_token, polar_user_id } = connDoc.data();
    const AUTH = { "Authorization": `Bearer ${access_token}`, "Accept": "application/json" };
    const POLAR = "https://www.polaraccesslink.com";

    // ── Step 1: Create exercise transaction ───────────────────────────────────
    const txRes = await fetch(`${POLAR}/v3/users/${polar_user_id}/exercise-transactions`, {
      method: "POST",
      headers: AUTH,
    });

    if (txRes.status === 204) {
      // No new sessions available
      await db.doc(`users/${userId}/polar/connection`).update({
        last_sync_at: new Date().toISOString(),
      });
      return res.json({ newSessions: 0, sessions: [] });
    }

    if (!txRes.ok) {
      const errText = await txRes.text();
      console.error("Transaction creation failed:", txRes.status, errText);
      return res.status(502).json({ error: "Failed to create Polar transaction", detail: errText });
    }

    const txData = await txRes.json();
    const transactionId = txData["transaction-id"];

    // ── Step 2: Get list of exercise URLs in this transaction ─────────────────
    const listRes = await fetch(
      `${POLAR}/v3/users/${polar_user_id}/exercise-transactions/${transactionId}`,
      { headers: AUTH }
    );

    if (!listRes.ok) {
      return res.status(502).json({ error: "Failed to list exercises in transaction" });
    }

    const listData = await listRes.json();
    const exerciseUrls = listData.exercises || [];

    // ── Step 3: Fetch each exercise ───────────────────────────────────────────
    const sessions = [];
    for (const url of exerciseUrls) {
      try {
        const exRes = await fetch(url, { headers: AUTH });
        if (!exRes.ok) continue;
        const ex = await exRes.json();

        // Map to our internal session format
        const session = {
          id:           String(ex.id),
          sport:        ex["detailed-sport-info"] || ex.sport || "OTHER",
          start_time:   ex["start-time"],
          duration_min: parseDurationMin(ex.duration),
          calories:     ex.calories || 0,
          hr_avg:       ex["heart-rate"]?.average || null,
          hr_max:       ex["heart-rate"]?.maximum || null,
          fat_pct:      ex["fat-percentage"] || null,
          has_route:    ex["has-route"] || false,
          device:       ex.device || null,
          polar_user_id,
          fetched_at:   new Date().toISOString(),
          logged:       false,
        };

        sessions.push(session);
      } catch (exErr) {
        console.warn("Failed to fetch exercise:", url, exErr);
      }
    }

    // ── Step 4: Commit transaction (marks these exercises as delivered) ────────
    await fetch(
      `${POLAR}/v3/users/${polar_user_id}/exercise-transactions/${transactionId}`,
      { method: "PUT", headers: AUTH }
    );

    // ── Step 5: Save sessions to Firestore ────────────────────────────────────
    const batch = db.batch();
    for (const s of sessions) {
      const ref = db.doc(`users/${userId}/polar_sessions/${s.id}`);
      batch.set(ref, s);
    }
    // Update last sync timestamp
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
