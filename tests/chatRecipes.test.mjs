// tests/chatRecipes.test.mjs — the chat's recipe lookup (src/lib/chatRecipes.js, Fix 88): which
// saved recipes the find_recipes tool returns for a query, and the tool's definition.
import { test } from "node:test";
import assert from "node:assert/strict";
import { FIND_RECIPES_TOOL, findRecipes } from "../src/lib/chatRecipes.js";

const recipe = (name, ingredients, extra = {}) => ({
  name,
  description: "d-" + name,
  servings: 2,
  ingredients,
  steps: ["s-" + name],
  nutrition: { kcal: 100 },
  id: "never-sent",
  portion_g: 123,
  ...extra,
});
const CURRY = recipe("Chicken Curry", [{ amount: "300 g", item: "chicken thigh" }]);
const SOUP = recipe("Tomato Soup", [{ amount: "4", item: "tomato" }]);
const STEW = recipe("Beef Stew", [{ amount: "1", item: "chicken stock cube" }]);
const ALL = [SOUP, STEW, CURRY];

test("the tool: named find_recipes, one required query", () => {
  assert.deepEqual(FIND_RECIPES_TOOL, {
    name: "find_recipes",
    description:
      "Look up the user's saved recipes by words from a recipe's name or ingredients. Returns up to 5 matching recipes (name, description, servings, ingredients, steps, nutrition per serving). If nothing matches it returns the names of all saved recipes so you can try again.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words from the recipe's name or ingredients" },
      },
      required: ["query"],
    },
  });
});

test("a recipe is returned with the fields the chat needs, and nothing else", () => {
  const { matches } = findRecipes(ALL, "tomato soup");
  assert.deepEqual(matches, [
    {
      name: "Tomato Soup",
      description: "d-Tomato Soup",
      servings: 2,
      ingredients: [{ amount: "4", item: "tomato" }],
      steps: ["s-Tomato Soup"],
      nutrition: { kcal: 100 },
    },
  ]);
});

test("a name hit outranks an ingredient hit; the case of the query does not matter", () => {
  const { matches } = findRecipes(ALL, "CHICKEN");
  assert.deepEqual(
    matches.map((m) => m.name),
    ["Chicken Curry", "Beef Stew"], // name hit (3 + 1 for the thigh) first, then the stock cube
  );
});

test("words add up across the name and the ingredients", () => {
  // Chicken Curry: chicken in the name (3) + in the ingredients (1) = 4; Beef Stew: chicken stock cube = 2
  const { matches } = findRecipes(ALL, "chicken stock");
  assert.deepEqual(
    matches.map((m) => m.name),
    ["Chicken Curry", "Beef Stew"],
  );
  assert.deepEqual(
    findRecipes([CURRY, STEW], "beef stew").matches.map((m) => m.name),
    ["Beef Stew"],
  );
});

test("filler words and punctuation are ignored", () => {
  const { matches } = findRecipes(ALL, "the recipe for, a soup!");
  assert.deepEqual(
    matches.map((m) => m.name),
    ["Tomato Soup"],
  );
});

test("at most 5 recipes come back, best first", () => {
  const many = Array.from({ length: 8 }, (_, i) => recipe("Soup " + i, []));
  const { matches } = findRecipes([...many, CURRY], "soup");
  assert.equal(matches.length, 5);
  assert.ok(matches.every((m) => m.name.startsWith("Soup")));
});

test("nothing matches: the names of all saved recipes, so Claude can try again", () => {
  assert.deepEqual(findRecipes(ALL, "pizza"), {
    matches: [],
    saved_recipe_names: ["Tomato Soup", "Beef Stew", "Chicken Curry"],
  });
  assert.deepEqual(findRecipes(ALL, "").saved_recipe_names.length, 3);
  assert.deepEqual(findRecipes(ALL, undefined).matches, []);
  assert.deepEqual(findRecipes(ALL, "a").matches, []); // one-letter words do not count
  assert.deepEqual(findRecipes([], "soup"), { matches: [], saved_recipe_names: [] });
});

test("a recipe with no name or no ingredients does not break the search", () => {
  const odd = [{ steps: [] }, { name: "Plain", ingredients: undefined }, SOUP];
  assert.deepEqual(
    findRecipes(odd, "soup").matches.map((m) => m.name),
    ["Tomato Soup"],
  );
  assert.deepEqual(
    findRecipes(odd, "plain").matches.map((m) => m.name),
    ["Plain"],
  );
});

test("each filler word is ignored on its own", () => {
  const salty = recipe("Plain", [{ item: "the and for with recipe recipes salt" }]);
  for (const w of ["the", "and", "for", "with", "recipe", "recipes"])
    assert.deepEqual(findRecipes([salty], w).matches, [], w);
  assert.equal(findRecipes([salty], "salt").matches.length, 1);
});

test("two-letter words count; the best of 6 equal matches are the first 5 in the list", () => {
  assert.equal(findRecipes([recipe("Dal", [{ item: "ghee" }])], "da").matches.length, 1);
  const six = Array.from({ length: 6 }, (_, i) => recipe("Rice " + i, []));
  assert.deepEqual(
    findRecipes(six, "rice").matches.map((m) => m.name),
    ["Rice 0", "Rice 1", "Rice 2", "Rice 3", "Rice 4"],
  );
});
