// tests/addFood.test.mjs — the "Add Food Item" form's logic (Fix 26 PR 13)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_FOOD,
  MACRO_FIELDS,
  normName,
  findSavedRecipe,
  recipesMatching,
  hasNutrition,
  recipeHint,
  withMacro,
  foodEntry,
  foodMealOptions,
  mealForFood,
} from "../src/lib/addFood.js";
import { DEFAULT_MEAL_SLOTS } from "../src/constants/helpers.js";

const STEW = { id: "s", name: "Pinto  Bean Stew", nutrition: { kcal: 338, protein: 15 } };
const BARE = { id: "b", name: "Bean Salad", nutrition: { kcal: 0, protein: "0", fat: -1 } };
const CARBY = { id: "c", name: "Bread", nutrition: { carbs: "20" } };
const FATTY = { id: "f", name: "Butter", nutrition: { fat: 80 } };
const NONE = { id: "n", name: "Pot" };
const ALL = [STEW, BARE, CARBY, FATTY, NONE];

test("empty form and macro fields", () => {
  assert.deepEqual(EMPTY_FOOD, {
    name: "",
    kcal: "",
    fat: "",
    sat_fat: "",
    carbs: "",
    sugar: "",
    fibre: "",
    net_carbs: "",
    protein: "",
  });
  assert.deepEqual(
    MACRO_FIELDS.map((f) => f[1]),
    [
      "kcal",
      "Fat (g)",
      "Sat Fat (g)",
      "Carbs (g)",
      "Sugar (g)",
      "Fibre (g)",
      "Net Carbs (g)",
      "Protein (g)",
    ],
  );
  assert.deepEqual(
    MACRO_FIELDS.map((f) => f[0]),
    Object.keys(EMPTY_FOOD).slice(1),
  );
});

test("names compare lowercased, trimmed, spaces collapsed", () => {
  assert.equal(normName("  Pinto \t BEAN  stew "), "pinto bean stew");
  assert.equal(normName(null), "");
  assert.equal(normName(undefined), "");
  assert.equal(normName(12), "12");
});

test("saved recipe: exact name with some kcal/protein/fat/carbs only", () => {
  assert.equal(findSavedRecipe(ALL, " pinto bean STEW"), STEW);
  assert.equal(findSavedRecipe(ALL, "bread"), CARBY);
  assert.equal(findSavedRecipe(ALL, "butter"), FATTY);
  assert.equal(findSavedRecipe(ALL, "bean salad"), null);
  assert.equal(findSavedRecipe(ALL, "pot"), null);
  assert.equal(findSavedRecipe(ALL, "bean"), null);
  assert.equal(findSavedRecipe(ALL, "  "), null);
  assert.equal(findSavedRecipe([{ name: "", nutrition: { kcal: 1 } }], ""), null);
});

test("list: names containing the text", () => {
  assert.deepEqual(recipesMatching(ALL, "BEAN "), [STEW, BARE]);
  assert.deepEqual(recipesMatching(ALL, "bean  stew"), [STEW]);
  assert.deepEqual(recipesMatching(ALL, "zz"), []);
});

test("nutrition: any of kcal, fat, carbs, protein", () => {
  assert.ok(!hasNutrition(EMPTY_FOOD));
  for (const k of ["kcal", "fat", "carbs", "protein"]) assert.ok(hasNutrition({ [k]: "1" }), k);
  assert.ok(!hasNutrition({ sugar: "1", fibre: "1", sat_fat: "1", net_carbs: "1" }));
});

test("list hint; missing values blank", () => {
  assert.equal(
    recipeHint({ nutrition: { kcal: 338, protein: 15, fat: 9, carbs: 45 } }),
    "338 kcal · P:15g F:9g C:45g · tap to set portions",
  );
  assert.equal(recipeHint(NONE), " kcal · P:g F:g C:g · tap to set portions");
});

test("macros: net carbs = carbs − fibre, ≥ 0, 1 dp; only for carbs or fibre", () => {
  const item = { ...EMPTY_FOOD, carbs: "12.34", net_carbs: "9" };
  assert.deepEqual(withMacro(item, "fibre", "2"), { ...item, fibre: "2", net_carbs: "10.3" });
  assert.equal(withMacro(item, "carbs", "5").net_carbs, "5.0");
  assert.equal(withMacro({ ...item, fibre: "9" }, "carbs", "5").net_carbs, "0.0");
  assert.equal(withMacro(item, "carbs", "").net_carbs, "0.0");
  assert.deepEqual(withMacro(item, "sugar", "3"), { ...item, sugar: "3" });
  assert.equal(item.fibre, ""); // not mutated
});

test("entry: numbers, blanks 0", () => {
  assert.deepEqual(
    foodEntry({ ...EMPTY_FOOD, name: "Toast", kcal: "80.5", protein: "x", fat: 2 }, "i"),
    {
      id: "i",
      name: "Toast",
      kcal: 80.5,
      fat: 2,
      sat_fat: 0,
      carbs: 0,
      sugar: 0,
      fibre: 0,
      net_carbs: 0,
      protein: 0,
    },
  );
});

test("meal options: the day's own meals, else default slots", () => {
  const day = { date: "d", meals: [{ id: "a", name: "A" }, { name: "B" }] };
  assert.deepEqual(foodMealOptions([day], "d"), [
    { key: "a", value: "a", label: "A" },
    { key: 1, value: "__slot__B", label: "B" },
  ]);
  assert.deepEqual(
    foodMealOptions([day], "e").map((o) => o.label),
    DEFAULT_MEAL_SLOTS.map((m) => m.name),
  );
  assert.equal(foodMealOptions([], "e")[0].value, "__slot__" + DEFAULT_MEAL_SLOTS[0].name);
});

test("meal: id, slot by name, or a new meal when named", () => {
  const day = { date: "d", meals: [{ id: "a", name: "☕ Breakfast", items: [] }] };
  const id = () => "new";
  assert.deepEqual(mealForFood(day, { mealId: "a", mealName: "X" }, id), { day, mealId: "a" });
  assert.deepEqual(mealForFood(day, { mealId: "__slot__☕ Breakfast" }, id), { day, mealId: "a" });
  assert.deepEqual(mealForFood(day, { mealId: "__slot__Tea" }, id), { day, mealId: null });
  assert.deepEqual(mealForFood(day, { mealId: "", mealName: "" }, id), { day, mealId: "" });
  const made = mealForFood(day, { mealId: "__slot__Tea", mealName: "Late" }, id);
  assert.equal(made.mealId, "new");
  assert.deepEqual(made.day.meals, [
    day.meals[0],
    { id: "new", name: "Late", is_exercise: 0, items: [] },
  ]);
  assert.equal(made.day.date, "d");
  assert.equal(mealForFood(day, { mealId: "", mealName: "Late" }, id).mealId, "new");
});
