// src/hooks/usePolarLog.js — the "log a Polar session" box: meal slot, logging, errors.
// ctx = { session, userId, allDays, persistDay, setCurrentDayData, currentDate,
//         setPolarSessions, onClose }
// PolarLogModal mounts the box only while a session is open, so this state (slot, message,
// "Logging…") never carries over to the next session.
import { useState } from "react";
import { genId, ensureMealSlots, DEFAULT_MEAL_SLOTS } from "../constants/helpers";
import { dayForEdit } from "../api/dayForEdit";
import { markSessionLogged } from "../api/polarLog";
import { mealIdIn, withItemsInMeal } from "../lib/dayMeals.js";
import { polarExerciseItem, sessionDate } from "../lib/polarLog.js";

async function writeLog(ctx, { date, chosen }, set) {
  const day = ensureMealSlots(await dayForEdit(ctx.userId, ctx.allDays, date));
  const mealId = mealIdIn(day, chosen);
  if (!mealId) {
    set.err("Meal slot not found — try again");
    return set.logging(false);
  }
  const updated = withItemsInMeal(day, mealId, [polarExerciseItem(ctx.session, genId())]);
  await ctx.persistDay(updated);
  if (date === ctx.currentDate) ctx.setCurrentDayData(updated);
  await markSessionLogged(ctx.userId, ctx.session);
  ctx.setPolarSessions((prev) => prev.filter((ps) => ps.id !== ctx.session.id));
  ctx.onClose();
}

async function logSession(ctx, target, set) {
  if (!target.chosen) return set.err("Please select a meal slot");
  set.logging(true);
  try {
    await writeLog(ctx, target, set);
  } catch (e) {
    set.err("Failed to log session: " + e.message);
    set.logging(false);
  }
}

/** Slots for the day: its stored meals (default slots filled in), else the default slots. */
function slotsFor(allDays, date) {
  const existing = allDays.find((d) => d.date === date);
  return existing ? ensureMealSlots(existing).meals : DEFAULT_MEAL_SLOTS;
}

export function usePolarLog(ctx) {
  const [mealId, setMealId] = useState("");
  const [logging, setLogging] = useState(false);
  const [err, setErr] = useState("");
  const set = { err: setErr, logging: setLogging };
  const date = ctx.session && sessionDate(ctx.session, new Date());
  return {
    mealId,
    logging,
    err,
    slots: ctx.session ? slotsFor(ctx.allDays, date) : [],
    pick: (id) => {
      setMealId(id);
      setErr("");
    },
    log: () => logSession(ctx, { date, chosen: mealId }, set),
  };
}
