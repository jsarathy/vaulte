// src/lib/polarSessions.js — how Polar sessions are shown on Add Entry (labels, dates, filters).

/** "INDOOR_CYCLING" → "Indoor Cycling"; no sport → "Exercise". */
export const sportName = (session) =>
  session.sport
    ? session.sport
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Exercise";

/** Grams of fat burned (calories × fat % ÷ 9 kcal/g), or null without a fat %. */
export const fatBurnedGrams = (session) =>
  session.fat_pct != null ? Math.round((session.calories * session.fat_pct) / 100 / 9) : null;

const startOf = (session) => (session.start_time ? new Date(session.start_time) : null);
const time = (d) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

/** "4 Oct, 09:05" — when Polar was last synced. */
export const syncTimeText = (iso) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Unlogged list: "Sat, 3 Oct 08:00" (" " when the start time is unknown). */
export function pendingWhen(session) {
  const d = startOf(session);
  if (!d) return " ";
  return `${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} ${time(d)}`;
}

/** Recent list: "3 Oct". */
export function recentWhen(session) {
  const d = startOf(session);
  return d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
}

/** Browse list: "Sat, 3 Oct 2026 · 08:00", or the session's date when there is no start time. */
export function browseWhen(session) {
  const d = startOf(session);
  if (!d) return session.date || "";
  const date = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${date} · ${time(d)}`;
}

export const pendingCountText = (n) => `${n} unlogged session${n > 1 ? "s" : ""}`;

/** Up to 10 logged sessions to show once all are logged; null until sessions are loaded. */
export const recentLogged = (all) =>
  all.length > 0 ? all.filter((s) => s.logged).slice(0, 10) : null;

/** Browse filter: activity, "3 oct 2026" style date, or ISO date — case-insensitive ("" matches all). */
export function matchesSearch(session, text) {
  const q = text.toLowerCase();
  const sport = (session.sport || "").replace(/_/g, " ").toLowerCase();
  const d = startOf(session);
  const date = d
    ? d
        .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
        .toLowerCase()
    : "";
  const iso = (session.start_time || "").slice(0, 10);
  return sport.includes(q) || date.includes(q) || iso.includes(q);
}

export const browseCountsText = (all) => {
  const logged = all.filter((s) => s.logged).length;
  return `${all.length} total · ${logged} logged · ${all.length - logged} pending`;
};

/** [label, value] figures shown for a session in the browse list. */
export function browseStats(session) {
  const fat = fatBurnedGrams(session);
  return [
    ["Duration", `${Math.round(session.duration_min || 0)} min`],
    ["Calories", `${session.calories} kcal`],
    session.hr_avg ? ["Avg HR", `${session.hr_avg} bpm`] : null,
    session.hr_max ? ["Max HR", `${session.hr_max} bpm`] : null,
    fat != null ? ["Fat burned", `${fat}g`] : null,
    session.hr_samples ? ["HR data", "✓"] : null,
  ].filter(Boolean);
}
