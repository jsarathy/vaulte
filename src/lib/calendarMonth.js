// src/lib/calendarMonth.js — the sidebar calendar's month: paging, label, and each day's marks.
import { dayHasContent, getDayTotals } from "../constants/helpers.js";

export const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

const pad = (n) => String(n).padStart(2, "0");
/** month is 0-based, as in Date. */
export const isoDate = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;

export const prevMonth = ({ year, month }) =>
  month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 };
export const nextMonth = ({ year, month }) =>
  month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 };

export const monthLabel = ({ year, month }) =>
  new Date(year, month, 1).toLocaleString("default", { month: "long", year: "numeric" });

/** Empty cells before the 1st, weeks starting on Monday. */
export const leadingBlanks = ({ year, month }) => (new Date(year, month, 1).getDay() + 6) % 7;

/**
 * Each day of the month: its date, the day's food kcal (when stored), and whether it is
 * logged (has content — emptied days aren't), open (currentDate) or today.
 */
export function monthDays(cal, allDays, { currentDate, today }) {
  const logged = new Set(allDays.filter(dayHasContent).map((d) => d.date));
  const kcal = Object.fromEntries(allDays.map((d) => [d.date, getDayTotals(d).foodKcal]));
  const count = new Date(cal.year, cal.month + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const date = isoDate(cal.year, cal.month, i + 1);
    const marks = { logged: logged.has(date), open: date === currentDate, today: date === today };
    return { day: i + 1, date, kcal: kcal[date], ...marks };
  });
}
