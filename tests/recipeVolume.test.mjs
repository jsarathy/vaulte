// tests/recipeVolume.test.mjs — a recipe's form (liquid or solid) and volume per portion, and the
// limit on the backfill's tries (src/lib/recipeVolume.js, Fix 91).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORMS,
  MAX_FILL_ATTEMPTS,
  attemptsLeft,
  contentKey,
  needsFill,
  portionVolume,
  volumeFields,
  withAttempt,
} from "../src/lib/recipeVolume.js";

const SOUP = { servings: 4, ingredients: [{ amount: "1 l", item: "stock" }] };

test("the forms and the number of tries", () => {
  assert.deepEqual(FORMS, ["liquid", "solid"]);
  assert.equal(MAX_FILL_ATTEMPTS, 2);
});

test("volumeFields: a liquid keeps its rounded ml, a solid has none, anything else gives nothing", () => {
  assert.deepEqual(volumeFields({ form: "liquid", portion_ml: 249.6 }), {
    form: "liquid",
    portion_ml: 250,
  });
  assert.deepEqual(volumeFields({ form: "liquid", portion_ml: "300" }), {
    form: "liquid",
    portion_ml: 300,
  });
  assert.deepEqual(volumeFields({ form: "liquid", portion_ml: 0 }), { form: "liquid" });
  assert.deepEqual(volumeFields({ form: "liquid", portion_ml: -5 }), { form: "liquid" });
  assert.deepEqual(volumeFields({ form: "liquid" }), { form: "liquid" });
  assert.deepEqual(volumeFields({ form: "solid", portion_ml: 250 }), { form: "solid" });
  assert.deepEqual(volumeFields({ form: "solid", portion_ml: 0 }), { form: "solid" });
  assert.deepEqual(volumeFields({ form: "gas", portion_ml: 250 }), {});
  assert.deepEqual(volumeFields({ portion_ml: 250 }), {});
  assert.deepEqual(volumeFields(undefined), {});
  assert.deepEqual(volumeFields(null), {});
});

test("portionVolume: a liquid's stored ml, else its weight (1 g ≈ 1 ml); never for a solid", () => {
  assert.equal(portionVolume({ form: "liquid", portion_ml: 250, portion_g: 300 }), 250);
  assert.equal(portionVolume({ form: "liquid", portion_g: 300 }), 300);
  assert.equal(portionVolume({ form: "liquid", portion_ml: 0, portion_g: 300 }), 300);
  assert.equal(portionVolume({ form: "liquid", portion_ml: "180" }), 180);
  assert.equal(portionVolume({ form: "liquid" }), null);
  assert.equal(portionVolume({ form: "liquid", portion_ml: 0, portion_g: 0 }), null);
  assert.equal(portionVolume({ form: "solid", portion_ml: 250, portion_g: 300 }), null);
  assert.equal(portionVolume({ portion_ml: 250, portion_g: 300 }), null);
  assert.equal(portionVolume(undefined), null);
});

test("contentKey: servings and ingredients only", () => {
  assert.equal(contentKey(SOUP), JSON.stringify([4, SOUP.ingredients]));
  assert.equal(contentKey({ servings: "4", ingredients: SOUP.ingredients }), contentKey(SOUP));
  assert.equal(contentKey({ ...SOUP, name: "Other", portion_g: 5 }), contentKey(SOUP));
  assert.notEqual(contentKey({ ...SOUP, servings: 5 }), contentKey(SOUP));
  assert.notEqual(contentKey({ ...SOUP, ingredients: [] }), contentKey(SOUP));
  assert.equal(contentKey({}), "[0,[]]");
  assert.equal(contentKey(undefined), "[0,[]]");
});

test("needsFill: a recipe lacks a weight or a form", () => {
  assert.equal(needsFill({ portion_g: 200, form: "solid" }), false);
  assert.equal(needsFill({ portion_g: 200, form: "liquid" }), false);
  assert.equal(needsFill({ portion_g: 200 }), true);
  assert.equal(needsFill({ form: "solid" }), true);
  assert.equal(needsFill({ portion_g: 0, form: "solid" }), true);
  assert.equal(needsFill({ portion_g: "250", form: "solid" }), false);
  assert.equal(needsFill({ portion_g: 200, form: "other" }), true);
  assert.equal(needsFill({}), true);
  assert.equal(needsFill(undefined), true);
});

test("withAttempt and attemptsLeft: two tries for the same servings and ingredients, then stop", () => {
  assert.equal(attemptsLeft(SOUP), true);
  const once = withAttempt(SOUP);
  assert.deepEqual(once.fill_attempts, { key: contentKey(SOUP), n: 1 });
  assert.equal(SOUP.fill_attempts, undefined); // the recipe given is not changed
  assert.equal(attemptsLeft(once), true);
  const twice = withAttempt(once);
  assert.equal(twice.fill_attempts.n, 2);
  assert.equal(attemptsLeft(twice), false);
  assert.equal(withAttempt(twice).fill_attempts.n, 3);
  assert.equal(attemptsLeft(withAttempt(twice)), false);
  // editing the servings or ingredients starts the count again
  const edited = { ...twice, servings: 6 };
  assert.equal(attemptsLeft(edited), true);
  assert.deepEqual(withAttempt(edited).fill_attempts, { key: contentKey(edited), n: 1 });
  // an attempt record with no count is one try short of nothing
  assert.equal(attemptsLeft({ ...SOUP, fill_attempts: { key: contentKey(SOUP) } }), true);
  assert.equal(
    withAttempt({ ...SOUP, fill_attempts: { key: contentKey(SOUP) } }).fill_attempts.n,
    1,
  );
  assert.equal(attemptsLeft(undefined), true);
});
