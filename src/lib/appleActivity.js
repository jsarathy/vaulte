// src/lib/appleActivity.js — what the Apple Watch Activity card shows for a day: the Polar
// sessions it must exclude, whether a sync has data, the synced time, the table rows, the note.

/** The Polar session ids logged on the day (workout entries linked to a Polar session). */
export const polarIdsOf = (dayData) =>
  (dayData?.meals || []).flatMap((m) =>
    (m.items || []).map((i) => i.polar_session_id).filter(Boolean),
  );

/** A synced doc with 5-min slots, or daily totals, counts as data. */
export const hasActivityData = (activity) =>
  (!!activity?.slots && Object.keys(activity.slots).length > 0) || !!activity?.totals;

/** "HH:MM" (local) of the last sync, or null. */
export const syncedAt = (updated_at) =>
  updated_at
    ? new Date(updated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

/** The table's rows: [label, count, kcal]. */
export const activityRows = (a) => [
  ["Steps", a.steps.toLocaleString(), a.kcal.steps],
  ["Active minutes", `${a.activeMin} min`, a.kcal.active],
  ["Flights climbed", a.flights, a.kcal.flights],
];

export const anyExcluded = (ex) => Boolean(ex.steps || ex.activeMin || ex.flights);

/** The header's status text: loading, the synced time, or nothing. */
export const statusText = (loading, synced) =>
  loading ? "loading…" : synced ? `synced ${synced}` : "";

/** The collapsed header's summary. */
export const summaryText = (hasData, a) =>
  hasData ? `${a.steps.toLocaleString()} steps · ${a.kcal.total} kcal` : "—";
