// src/hooks/usePolarDetail.js — the Daily log's Polar session box: which session is open (loaded
// when a logged Polar workout is clicked; a failed load is logged), which one is loading, and
// fetching its heart rate from Polar.
import { useState } from "react";
import { fetchHeartRate, loadPolarSession } from "../api/polarDetail.js";
import { fetchError } from "../lib/polarDetail.js";

export function usePolarDetail(userId) {
  const [session, setSession] = useState(null);
  const [loadingId, setLoadingId] = useState(null); // item being loaded
  const open = async (item) => {
    if (!item.polar_session_id || !userId) return;
    setLoadingId(item.id);
    try {
      const found = await loadPolarSession(userId, item.polar_session_id);
      if (found) setSession(found);
    } catch (e) {
      console.error("Failed to load polar session:", e);
    } finally {
      setLoadingId(null);
    }
  };
  return { session, loadingId, open, close: () => setSession(null), setSession };
}

async function requestHeartRate(session, userId) {
  try {
    const { ok, data } = await fetchHeartRate(userId, session.id);
    if (!ok) return { error: fetchError(data) };
    const loaded = { hr_samples: data.hr_samples, recording_rate_s: data.recording_rate_s };
    return { session: { ...session, ...loaded } };
  } catch {
    return { error: "Network error — try again." };
  }
}

/** Fetching heart rate for the open session; onLoaded gets the session with its samples. */
export function useHeartRateFetch(session, userId, onLoaded) {
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState("");
  const fetchNow = async () => {
    setFetching(true);
    setError("");
    const result = await requestHeartRate(session, userId);
    if (result.error) setError(result.error);
    else onLoaded(result.session);
    setFetching(false);
  };
  return { fetching, error, fetchNow };
}
