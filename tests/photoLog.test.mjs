// tests/photoLog.test.mjs — "Log from Photo" reply parsing and builders (Fix 26 PR 12)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PHOTO_PROMPT,
  parsePhotoReply,
  identifiedText,
  itemSummary,
  formItemFromPhoto,
  photoRecipe,
} from "../src/lib/photoLog.js";

const reply = (text) => ({ content: [{ text }] });
const TOAST = { name: "Toast", kcal: 80.25, fat: 1, carbs: 15, sugar: 1, protein: 3, x: 9 };
const EGG = { name: "Egg", kcal: 70.1, fat: "5", carbs: 0.4, protein: 6.3 };

test("prompt asks for a bare JSON array with every macro", () => {
  assert.match(PHOTO_PROMPT, /^Identify every food item visible in this photo/);
  assert.match(PHOTO_PROMPT, /"net_carbs":0,"protein":0\}\]\nBe specific/);
  assert.match(PHOTO_PROMPT, /Round to 1 decimal place\.$/);
});

test("reply: plain, fenced (with or without json), padded; missing → []", () => {
  assert.deepEqual(parsePhotoReply(reply('  [{"name":"A"}] ')), [{ name: "A" }]);
  assert.deepEqual(parsePhotoReply(reply('```json\n[{"name":"A"}]\n```')), [{ name: "A" }]);
  assert.deepEqual(parsePhotoReply(reply("```\n[1]\n```")), [1]);
  assert.deepEqual(parsePhotoReply(reply(" \n```json\n[2]\n```")), [2]);
  assert.deepEqual(parsePhotoReply({}), []);
  assert.deepEqual(parsePhotoReply(reply("")), []);
  assert.throws(() => parsePhotoReply(reply("no idea")));
  assert.throws(() => parsePhotoReply(reply("```")));
});

test("identified text: singular only for one", () => {
  const tail = ". Tap to load into the form above, or log all at once.";
  assert.equal(identifiedText(1), "Claude identified 1 item" + tail);
  assert.equal(identifiedText(2), "Claude identified 2 items" + tail);
  assert.equal(identifiedText(0), "Claude identified 0 items" + tail);
});

test("item summary", () => {
  assert.equal(itemSummary(TOAST), "80.25 kcal · P:3g F:1g C:15g");
});

test("form item: name and the macros only", () => {
  assert.deepEqual(formItemFromPhoto(TOAST), {
    name: "Toast",
    kcal: 80.25,
    fat: 1,
    sat_fat: undefined,
    carbs: 15,
    sugar: 1,
    fibre: undefined,
    net_carbs: undefined,
    protein: 3,
  });
});

test("recipe: one food gives its name; totals to 1 dp, missing as 0", () => {
  const one = photoRecipe([TOAST], "r1");
  assert.deepEqual(one, {
    id: "r1",
    name: "Toast",
    description: "Saved from photo",
    servings: 1,
    nutrition: {
      kcal: 80.3,
      fat: 1,
      sat_fat: 0,
      carbs: 15,
      sugar: 1,
      fibre: 0,
      net_carbs: 0,
      protein: 3,
    },
    ingredients: [{ amount: "", item: "Toast" }],
    steps: [],
    notes: "",
  });
  const two = photoRecipe([TOAST, EGG], "r2");
  assert.equal(two.name, "");
  assert.deepEqual(
    [two.nutrition.kcal, two.nutrition.fat, two.nutrition.carbs, two.nutrition.protein],
    [150.4, 6, 15.4, 9.3],
  );
  assert.deepEqual(two.ingredients, [
    { amount: "", item: "Toast" },
    { amount: "", item: "Egg" },
  ]);
});
