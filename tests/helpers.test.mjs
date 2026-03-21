// src/constants/helpers.test.mjs
// Run with:  node --test src/constants/helpers.test.mjs
//
// Tests cover the four functions most likely to cause silent data bugs:
//   getDayTotals, calcMacros, ensureMealSlots, fmt
//
// No test framework needed — uses Node's built-in test runner (Node 18+).

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  fmt,
  getDayTotals,
  calcMacros,
  ensureMealSlots,
  makeMeals,
  DEFAULT_MEAL_SLOTS,
} from "../src/constants/helpers.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeItem(overrides = {}) {
  return { id:"x", name:"Test", kcal:0, fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0, ...overrides };
}

function makeDay(meals = []) {
  return { date:"2026-03-17", notes:"", meals };
}


// ── fmt ──────────────────────────────────────────────────────────────────────

describe("fmt", () => {
  test("zero returns string '0'", () => {
    assert.equal(fmt(0), "0");
  });
  test("rounds to 1 decimal", () => {
    assert.equal(fmt(10.55), 10.6);
    assert.equal(fmt(10.54), 10.5);
  });
  test("strips unnecessary decimals", () => {
    assert.equal(fmt(10.0), 10);
  });
  test("handles negative", () => {
    assert.equal(fmt(-5.25), -5.3);
  });
  test("handles null/undefined gracefully", () => {
    assert.doesNotThrow(() => fmt(null));
    assert.doesNotThrow(() => fmt(undefined));
  });
});


// ── getDayTotals ─────────────────────────────────────────────────────────────

describe("getDayTotals", () => {
  test("returns zeros for null input", () => {
    const t = getDayTotals(null);
    assert.equal(t.foodKcal, 0);
    assert.equal(t.exerciseBurned, 0);
    assert.equal(t.protein, 0);
  });

  test("returns zeros for day with no meals", () => {
    const t = getDayTotals(makeDay([]));
    assert.equal(t.foodKcal, 0);
  });

  test("returns zeros for meals with undefined items (old Firestore data)", () => {
    // This is the exact crash scenario — items field missing from Firestore doc
    const day = makeDay([
      { id:"a", name:"☕ Breakfast", is_exercise:0 },
      { id:"b", name:"🥗 Lunch",    is_exercise:0 },
    ]);
    assert.doesNotThrow(() => getDayTotals(day));
    const t = getDayTotals(day);
    assert.equal(t.foodKcal, 0);
  });

  test("sums food kcal correctly", () => {
    const day = makeDay([{
      id:"a", name:"Breakfast", is_exercise:0,
      items: [makeItem({ kcal:300, protein:20, fat:10, carbs:30 }),
              makeItem({ kcal:150, protein:5,  fat:5,  carbs:20 })],
    }]);
    const t = getDayTotals(day);
    assert.equal(t.foodKcal, 450);
    assert.equal(t.protein, 25);
    assert.equal(t.fat, 15);
    assert.equal(t.carbs, 50);
  });

  test("exercise kcal goes to exerciseBurned, not foodKcal", () => {
    const day = makeDay([
      { id:"a", name:"Breakfast", is_exercise:0,
        items:[makeItem({ kcal:500 })] },
      { id:"b", name:"Morning Exercise", is_exercise:1,
        items:[makeItem({ kcal:-300, is_exercise:1 })] },
    ]);
    const t = getDayTotals(day);
    assert.equal(t.foodKcal, 500);
    assert.equal(t.exerciseBurned, 300);   // stored as positive
    assert.equal(t.kcal, 200);             // net
  });

  test("multiple meals accumulate correctly", () => {
    const meals = makeMeals();
    meals[0].items = [makeItem({ kcal:300, protein:20 })];  // Breakfast
    meals[3].items = [makeItem({ kcal:500, protein:30 })];  // Lunch
    const t = getDayTotals(makeDay(meals));
    assert.equal(t.foodKcal, 800);
    assert.equal(t.protein, 50);
  });

  test("fat_burned_g is not counted in foodKcal", () => {
    const day = makeDay([{
      id:"a", name:"Exercise", is_exercise:1,
      items:[{ ...makeItem({ kcal:-200, is_exercise:1 }), fat_burned_g:22, fat_burned_kcal:200 }],
    }]);
    const t = getDayTotals(day);
    assert.equal(t.foodKcal, 0);
    assert.equal(t.exerciseBurned, 200);
  });
});


// ── calcMacros ───────────────────────────────────────────────────────────────

describe("calcMacros", () => {
  test("protein scales with weight", () => {
    const m = calcMacros(1800, 84, 1.4, 0.30);
    assert.equal(m.protein_g, 118);  // 84 * 1.4 = 117.6 → 118
  });

  test("fat scales with tdee and fat%", () => {
    const m = calcMacros(1800, 84, 1.4, 0.30);
    assert.equal(m.fat_g, 60);  // 1800 * 0.30 / 9 = 60
  });

  test("carbs fill remaining calories", () => {
    const m = calcMacros(1800, 84, 1.4, 0.30);
    // protein kcal: 118*4=472, fat kcal: 60*9=540, remaining: 1800-472-540=788, /4=197
    assert.equal(m.carbs_g, 197);
  });

  test("net_carbs is carbs minus fibre_g (30g)", () => {
    const m = calcMacros(1800, 84, 1.4, 0.30);
    assert.equal(m.net_carbs, Math.max(0, m.carbs_g - 30));
  });

  test("net_carbs never goes negative", () => {
    // Very low carb scenario
    const m = calcMacros(1200, 84, 2.0, 0.50);
    assert.ok(m.net_carbs >= 0);
  });

  test("fibre_g is always 30", () => {
    const m = calcMacros(2000, 70, 1.6, 0.25);
    assert.equal(m.fibre_g, 30);
  });

  test("macros are all integers", () => {
    const m = calcMacros(1750, 77, 1.2, 0.28);
    assert.equal(m.protein_g, Math.round(m.protein_g));
    assert.equal(m.fat_g,     Math.round(m.fat_g));
    assert.equal(m.carbs_g,   Math.round(m.carbs_g));
  });
});


// ── ensureMealSlots ──────────────────────────────────────────────────────────

describe("ensureMealSlots", () => {
  test("returns null/undefined unchanged", () => {
    assert.equal(ensureMealSlots(null), null);
    assert.equal(ensureMealSlots(undefined), undefined);
  });

  test("fully new day gets all DEFAULT slots", () => {
    const day = makeDay([]);
    const result = ensureMealSlots(day);
    assert.equal(result.meals.length, DEFAULT_MEAL_SLOTS.length);
  });

  test("all meals have items array after call", () => {
    // Old Firestore data — no items field
    const day = makeDay([
      { id:"a", name:"☕ Breakfast",        is_exercise:0 },
      { id:"b", name:"🏋️ Morning Exercise", is_exercise:1 },
      { id:"c", name:"🥤 Post-Workout",     is_exercise:0 },
      { id:"d", name:"🥗 Lunch",            is_exercise:0 },
      { id:"e", name:"🍎 Snack",            is_exercise:0 },
      { id:"f", name:"🌙 Dinner",           is_exercise:0 },
    ]);
    const result = ensureMealSlots(day);
    assert.ok(result.meals.every(m => Array.isArray(m.items)),
      "every meal must have an items array");
  });

  test("existing meal IDs are preserved", () => {
    const day = makeDay([
      { id:"my-id-123", name:"☕ Breakfast", is_exercise:0, items:[] },
    ]);
    const result = ensureMealSlots(day);
    const breakfast = result.meals.find(m => m.name === "☕ Breakfast");
    assert.equal(breakfast.id, "my-id-123");
  });

  test("existing items are preserved", () => {
    const item = makeItem({ kcal:300, name:"Oats" });
    const day = makeDay([
      { id:"a", name:"☕ Breakfast", is_exercise:0, items:[item] },
    ]);
    const result = ensureMealSlots(day);
    const breakfast = result.meals.find(m => m.name === "☕ Breakfast");
    assert.equal(breakfast.items.length, 1);
    assert.equal(breakfast.items[0].name, "Oats");
  });

  test("new slots are inserted in DEFAULT order", () => {
    // Old 6-slot day missing the two new exercise slots
    const day = makeDay([
      { id:"a", name:"☕ Breakfast",        is_exercise:0, items:[] },
      { id:"b", name:"🏋️ Morning Exercise", is_exercise:1, items:[] },
      { id:"c", name:"🥤 Post-Workout",     is_exercise:0, items:[] },
      { id:"d", name:"🥗 Lunch",            is_exercise:0, items:[] },
      { id:"e", name:"🍎 Snack",            is_exercise:0, items:[] },
      { id:"f", name:"🌙 Dinner",           is_exercise:0, items:[] },
    ]);
    const result = ensureMealSlots(day);
    const names = result.meals.map(m => m.name);
    const expectedOrder = DEFAULT_MEAL_SLOTS.map(s => s.name);
    assert.deepEqual(names, expectedOrder);
    assert.ok(names.includes("🚴 Afternoon Exercise"), "Afternoon Exercise slot present");
    assert.ok(names.includes("🌆 Evening Exercise"),  "Evening Exercise slot present");
    assert.equal(result.meals.length, 8, "total slot count is 8");
  });

  test("calling twice is idempotent", () => {
    const day = makeDay([
      { id:"a", name:"☕ Breakfast", is_exercise:0, items:[] },
    ]);
    const once  = ensureMealSlots(day);
    const twice = ensureMealSlots(once);
    assert.equal(once.meals.length, twice.meals.length);
  });

  test("__slot__ lookup works after ensureMealSlots on old day", () => {
    // Simulates the exact Polar log modal scenario:
    // day loaded from Firestore has no Afternoon Exercise slot,
    // user selects "__slot__🚴 Afternoon Exercise" from dropdown,
    // handler calls ensureMealSlots then does the name lookup
    const rawDay = makeDay([
      { id:"a", name:"☕ Breakfast",        is_exercise:0, items:[] },
      { id:"b", name:"🏋️ Morning Exercise", is_exercise:1, items:[] },
      { id:"c", name:"🥤 Post-Workout",     is_exercise:0, items:[] },
      { id:"d", name:"🥗 Lunch",            is_exercise:0, items:[] },
      { id:"e", name:"🍎 Snack",            is_exercise:0, items:[] },
      { id:"f", name:"🌙 Dinner",           is_exercise:0, items:[] },
    ]);
    const slotValue = "__slot__🚴 Afternoon Exercise";
    const day = ensureMealSlots(rawDay);
    const slotName = slotValue.replace("__slot__", "");
    const match = day.meals.find(m => m.name === slotName);
    assert.ok(match, "slot should be found after ensureMealSlots");
    assert.ok(match.id, "slot should have an id");
  });

  test("spreading items after ensureMealSlots never throws", () => {
    const day = makeDay([
      { id:"a", name:"☕ Breakfast", is_exercise:0 },  // no items
    ]);
    const fixed = ensureMealSlots(day);
    assert.doesNotThrow(() => {
      const item = makeItem({ kcal:300 });
      const _ = fixed.meals.map(m =>
        m.name === "☕ Breakfast" ? { ...m, items:[...(m.items||[]), item] } : m
      );
    });
  });
});


// ── parseDurationMin ──────────────────────────────────────────────────────────

import { parseDurationMin, calcFatBurned } from "../src/constants/helpers.js";

describe("parseDurationMin", () => {
  test("null/empty returns 0", () => {
    assert.equal(parseDurationMin(null), 0);
    assert.equal(parseDurationMin(""), 0);
    assert.equal(parseDurationMin(undefined), 0);
  });

  test("hours only", () => {
    assert.equal(parseDurationMin("PT1H"), 60);
    assert.equal(parseDurationMin("PT2H"), 120);
  });

  test("minutes only", () => {
    assert.equal(parseDurationMin("PT30M"), 30);
    assert.equal(parseDurationMin("PT45M"), 45);
  });

  test("seconds only", () => {
    assert.equal(parseDurationMin("PT30S"), 0.5);
    assert.equal(parseDurationMin("PT90S"), 1.5);
  });

  test("hours + minutes", () => {
    assert.equal(parseDurationMin("PT1H30M"), 90);
  });

  test("hours + minutes + seconds", () => {
    assert.equal(parseDurationMin("PT1H30M45S"), 90.75);
  });

  test("typical cycling session", () => {
    // 45 min session as Polar emits it
    assert.equal(parseDurationMin("PT45M0S"), 45);
  });

  test("unrecognised string returns 0", () => {
    assert.equal(parseDurationMin("garbage"), 0);
  });
});


// ── calcFatBurned ─────────────────────────────────────────────────────────────

describe("calcFatBurned", () => {
  test("returns null when fat_pct is null", () => {
    assert.equal(calcFatBurned(400, null), null);
  });

  test("returns null when calories is null", () => {
    assert.equal(calcFatBurned(null, 60), null);
  });

  test("both null returns null", () => {
    assert.equal(calcFatBurned(null, null), null);
  });

  test("correct kcal calculation", () => {
    // 400 kcal, 60% fat burn → 240 kcal from fat
    const r = calcFatBurned(400, 60);
    assert.equal(r.fatKcal, 240);
  });

  test("correct grams calculation", () => {
    // 240 kcal / 9 = 26.67 → 27g
    const r = calcFatBurned(400, 60);
    assert.equal(r.fatGrams, 27);
  });

  test("realistic Polar session values", () => {
    // 350 kcal, 55% fat → 192.5 kcal → 193 kcal, 21g
    const r = calcFatBurned(350, 55);
    assert.equal(r.fatKcal, 193);
    assert.equal(r.fatGrams, 21);
  });

  test("zero fat_pct returns zeros not null", () => {
    const r = calcFatBurned(400, 0);
    assert.ok(r !== null);
    assert.equal(r.fatKcal, 0);
    assert.equal(r.fatGrams, 0);
  });

  test("returns integer values", () => {
    const r = calcFatBurned(333, 47);
    assert.equal(r.fatKcal, Math.round(r.fatKcal));
    assert.equal(r.fatGrams, Math.round(r.fatGrams));
  });
});
