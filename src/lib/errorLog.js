// src/lib/errorLog.js — the app error log (Dashboard, Fix 98 part 2): what is recorded when something
// fails in the browser (an uncaught error, an unhandled promise rejection, or the app's own
// console.error), how repeats are held back, and how the log is shown. Messages only (cut short,
// never the data an error was about); nothing here touches Firebase.
import { whenText } from "./aiUsage.js";
import { ageMs } from "./dashboard.js";

export const MAX_MESSAGE = 300;
export const MAX_STACK = 500;
/** At most this many entries per page load, and the same message at most once per this many ms. */
export const MAX_PER_LOAD = 30;
export const REPEAT_MS = 60_000;

const NOISE = [/ResizeObserver loop/i];

/** True for a message that is empty or known harmless noise. */
export const isIgnored = (message) => !message || NOISE.some((re) => re.test(message));

const textOf = (a) => {
  if (typeof a === "string") return a;
  if (a && typeof a.message === "string") return a.message;
  return "[object]";
};

/** The arguments of a console.error (or an error) as one short line. */
export const messageOf = (args) =>
  args.map(textOf).join(" ").replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE);

/** The first lines of an error's stack, cut short; "" when no argument has one. */
export function stackOf(args) {
  const withStack = args.find((a) => a && typeof a.stack === "string");
  return withStack ? withStack.stack.split("\n").slice(0, 4).join("\n").slice(0, MAX_STACK) : "";
}

/** One log entry. source: "error" | "promise" | "console". */
export function entryFor(source, args, page, now = new Date()) {
  const stack = stackOf(args);
  return { at: now.toISOString(), source, page, message: messageOf(args), ...(stack && { stack }) };
}

/** A function that says whether a message may be logged now: not too many in all, and no repeat soon. */
export function makeLimiter() {
  const last = new Map();
  let total = 0;
  return (message, nowMs = Date.now()) => {
    if (total >= MAX_PER_LOAD) return false;
    if (nowMs - (last.get(message) ?? -Infinity) < REPEAT_MS) return false;
    last.set(message, nowMs);
    total += 1;
    return true;
  };
}

const SOURCES = { error: "Error", promise: "Promise", console: "Logged" };

/** An entry as the cells of a table row: when, what kind, which page, the message. */
export const errorCells = (e) => [
  whenText(e.at),
  SOURCES[e.source] || e.source || "",
  e.page || "",
  e.message || "",
];
export const ERROR_COLUMNS = ["Date", "Kind", "Page", "Message"];

/** The entries whose row contains every word typed, in any case. */
export function filterErrors(entries, query) {
  const words = String(query || "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return entries;
  return entries.filter((e) => {
    const text = errorCells(e).join(" ").toLowerCase();
    return words.every((w) => text.includes(w));
  });
}

/** How many entries are from the last `days` days. */
export const countSince = (entries, days, now = new Date()) =>
  entries.filter((e) => {
    const age = ageMs(e.at, now);
    return age != null && age <= days * 86_400_000;
  }).length;

/** "1 error" or "3 errors". */
export const errorsCount = (n) => `${n} error${n === 1 ? "" : "s"}`;
