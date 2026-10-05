// api/_apple/time.js — wall-clock times from the strings an iOS Shortcut sends: ISO-ish
// timestamps, Shortcuts' default date text, and lists that arrive as arrays or newline text.

const pad2 = (n) => String(n).padStart(2, "0");

/** "2026-09-24T09:32:10+01:00" or "2026-09-24 09:32" → { date: "2026-09-24", min: 572.17 }. */
export function parseLocal(str) {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(String(str || "").trim());
  if (!m) return null;
  return { date: m[1], min: +m[2] * 60 + +m[3] + (+m[4] || 0) / 60 };
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const month = (name) => MONTHS.indexOf(name.toLowerCase()) + 1;

const DMY = /(\d{1,2})\/(\d{1,2})\/(\d{4})/; // 27/09/2026 (UK order)
const D_MON_Y = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/; // 27 Sep 2026
const MON_D_Y = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})/; // Sep 27, 2026
const TIME = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?/;

/** { y, mo, d } from Shortcuts' date text, in any of the three orders; null if none matches. */
function looseDate(s) {
  const dmy = DMY.exec(s);
  if (dmy) return { y: +dmy[3], mo: +dmy[2], d: +dmy[1] };
  const dmon = D_MON_Y.exec(s);
  if (dmon) return { y: +dmon[3], mo: month(dmon[2]), d: +dmon[1] };
  const mond = MON_D_Y.exec(s);
  return mond ? { y: +mond[3], mo: month(mond[1]), d: +mond[2] } : null;
}

/** 24-hour hour from a clock hour and an optional "AM" / "PM". */
function hour24(h, ampm) {
  if (!ampm) return h;
  const pm = /p/i.test(ampm);
  if (h === 12) return pm ? 12 : 0;
  return pm ? h + 12 : h;
}

/** Minutes since midnight from the first HH:MM in the text (the year is skipped); null if none. */
function looseTime(s) {
  const t = TIME.exec(s.replace(/\d{4}/, ""));
  return t ? hour24(+t[1], t[3]) * 60 + +t[2] : null;
}

/**
 * Shortcuts' default date text, e.g. "27 Sep 2026 at 07:00", "27/09/2026, 07:00",
 * "Sep 27, 2026 at 7:00 AM" → { date: "2026-09-27", min: 420 }; null without a date and a time.
 */
export function parseLoose(str) {
  const s = String(str || "");
  const d = looseDate(s);
  const min = looseTime(s);
  if (!d || !d.y || !d.mo || !d.d || min === null) return null;
  return { date: `${d.y}-${pad2(d.mo)}-${pad2(d.d)}`, min };
}

/** Shortcut lists arrive as JSON arrays or newline-separated text (blank lines dropped). */
export function toList(x) {
  if (Array.isArray(x)) return x;
  if (x == null || x === "") return [];
  return String(x)
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Today's "YYYY-MM-DD" in UK time — the fallback when a sync names no date. */
export const todayUK = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/London" });
