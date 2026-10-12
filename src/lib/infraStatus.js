// src/lib/infraStatus.js — the INFRASTRUCTURE box's live status (Dashboard, Fix 99): turns what
// /api/infra-status returns into, for each link, a marker (up to date, stale, no data, error) and
// the lines to show under it.
import { ago } from "./dashboard.js";

const failed = (x) => !x || x.error === true;

/** The worst of several states: an error, else amber, else fine, else nothing known. */
export function worst(states) {
  if (states.includes("error")) return "error";
  if (states.includes("stale")) return "stale";
  return states.includes("ok") ? "ok" : "never";
}

const PLATFORM = { none: "ok", minor: "stale", major: "error", critical: "error" };

/** A Statuspage answer as a state and a line. */
export function platform(p) {
  if (failed(p)) return { state: "never", line: "Platform status unavailable" };
  return {
    state: PLATFORM[p.indicator] || "never",
    line: `Platform: ${p.description || p.indicator}`,
  };
}

const DEPLOY = { success: "ok", inactive: "ok", failure: "error", error: "error" };

/** The latest Production deployment as a state and a line. */
export function deployment(d, now) {
  if (failed(d)) return { state: "never", line: "Production deployment unavailable" };
  const when = d.at ? ` ${ago(d.at, now)}` : "";
  const label = { ok: "deployed", error: "failed" }[DEPLOY[d.state]] || "deploying";
  return {
    state: DEPLOY[d.state] || (d.state === "unknown" ? "never" : "stale"),
    line: `Production: ${label}${when}`,
  };
}

const RUN_DONE = { success: "ok", failure: "error", cancelled: "error", timed_out: "error" };
const RUN_WORDS = {
  success: "passed",
  failure: "failed",
  cancelled: "cancelled",
  timed_out: "timed out",
};

/** The latest CI runs on main as a state and a line. */
export function ci(c, now) {
  if (failed(c) || !c.runs?.length) return { state: "never", line: "No CI runs found" };
  const states = c.runs.map((r) =>
    r.status === "completed" ? RUN_DONE[r.conclusion] || "stale" : "stale",
  );
  const state = worst(states);
  const run = c.runs.find((r) => r.name === "ci") || c.runs[0];
  const word = run.status === "completed" ? RUN_WORDS[run.conclusion] || run.conclusion : "running";
  return {
    state,
    line: `Latest on main: ${word} ${ago(run.at, now)}${run.title ? ` · ${run.title}` : ""}`,
  };
}

/** The open issues as a state and a line. */
export function issues(i) {
  if (failed(i)) return { state: "never", line: "Issues unavailable" };
  if (!i.issues.length) return { state: "ok", line: "No open issues" };
  const first = i.issues[0];
  const more = i.issues.length > 1 ? ` (+${i.issues.length - 1} more)` : "";
  return { state: "stale", line: `${i.issues.length} open: ${first.title}${more}` };
}

/** Firebase: ongoing incidents from Google's list. */
export function firebase(f) {
  if (failed(f)) return { state: "never", line: "Platform status unavailable" };
  if (!f.ongoing.length) return { state: "ok", line: "Platform: no ongoing incidents" };
  return { state: "stale", line: `Platform: ${f.ongoing.length} ongoing — ${f.ongoing[0]}` };
}

const merged = (parts) => ({
  state: worst(parts.map((p) => p.state)),
  lines: parts.map((p) => p.line),
});

/** For each INFRA link name, { state, lines }; null when nothing has been loaded yet. */
export function infraStatusFor(data, now = new Date()) {
  if (!data) return null;
  return {
    Vercel: merged([platform(data.vercel), deployment(data.deployment, now)]),
    Firebase: merged([firebase(data.firebase)]),
    GitHub: merged([platform(data.github)]),
    "GitHub Actions": merged([ci(data.ci, now)]),
    "GitHub issues": merged([issues(data.issues)]),
  };
}
