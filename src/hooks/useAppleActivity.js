// src/hooks/useAppleActivity.js — the Apple Watch Activity card's data: a live listener on the
// day's apple_activity doc, the day's Polar sessions (to exclude), and the kcal reported up.
import { useState, useEffect } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { calcAppleActivity } from "../constants/helpers";
import { polarIdsOf, hasActivityData, syncedAt, anyExcluded } from "../lib/appleActivity";

/** Live listener: a Shortcut sync shows within a second, no page refresh needed. */
export function useActivityDoc(userId, date) {
  const [activity, setActivity] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!userId || !date) return;
    setLoading(true);
    const onDoc = (s) => {
      setActivity(s.exists() ? s.data() : null);
      setLoading(false);
    };
    const onError = (e) => {
      console.error("apple_activity listen failed:", e);
      onDoc({ exists: () => false });
    };
    return onSnapshot(doc(db, "users", userId, "apple_activity", date), onDoc, onError);
  }, [userId, date]);
  return { activity, loading };
}

const loadSessions = (userId, ids) =>
  Promise.all(ids.map((id) => getDoc(doc(db, "users", userId, "polar_sessions", id)))).then(
    (snaps) => snaps.filter((s) => s.exists()).map((s) => s.data()),
  );

/** The Polar sessions linked from the day's entries (none while they load). */
export function usePolarSessions(userId, dayData) {
  const [sessions, setSessions] = useState([]);
  const polarKey = polarIdsOf(dayData).join(",");
  useEffect(() => {
    if (!userId || !polarKey) {
      setSessions([]);
      return;
    }
    let cancelled = false;
    loadSessions(userId, polarKey.split(","))
      .then((loaded) => {
        if (!cancelled) setSessions(loaded);
      })
      .catch((e) => console.error("polar sessions load failed:", e));
    return () => {
      cancelled = true;
    };
  }, [userId, polarKey]);
  return sessions;
}

/** Report Apple kcal up to the Daily log so it counts towards exercise burned. */
const useReportedKcal = (onKcal, reportedKcal) =>
  useEffect(() => {
    onKcal?.(reportedKcal);
  }, [reportedKcal]); // eslint-disable-line react-hooks/exhaustive-deps

export function useAppleActivity({ userId, date, dayData, weightKg, onKcal }) {
  const { activity, loading } = useActivityDoc(userId, date);
  const sessions = usePolarSessions(userId, dayData);
  const hasData = hasActivityData(activity);
  const a = calcAppleActivity(activity, sessions, weightKg);
  useReportedKcal(onKcal, !loading && hasData ? a.kcal.total : 0);
  return {
    loading,
    hasData,
    a,
    synced: syncedAt(activity?.updated_at),
    hasExcluded: anyExcluded(a.excluded),
    estimated: activity?.mode === "daily",
  };
}
