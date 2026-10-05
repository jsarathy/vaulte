// src/api/claudeSchemas.js — the JSON schemas Claude's replies are constrained to (Structured
// Outputs): nutrition per serving, a recipe, a portion weight, and a list of food items.

export const NUTRITION_SCHEMA = {
  type: "object",
  properties: {
    kcal: { type: "number" },
    fat: { type: "number" },
    sat_fat: { type: "number" },
    carbs: { type: "number" },
    sugar: { type: "number" },
    fibre: { type: "number" },
    net_carbs: { type: "number" },
    protein: { type: "number" },
  },
  required: ["kcal", "fat", "sat_fat", "carbs", "sugar", "fibre", "net_carbs", "protein"],
  additionalProperties: false,
};

export const PORTION_SCHEMA = {
  type: "object",
  properties: { total_g: { type: "number" }, portion_g: { type: "number" } },
  required: ["total_g", "portion_g"],
  additionalProperties: false,
};

export const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    source: { type: "string" },
    servings: { type: "number" },
    prep_time: { type: "string" },
    cook_time: { type: "string" },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: { amount: { type: "string" }, item: { type: "string" } },
        required: ["amount", "item"],
        additionalProperties: false,
      },
    },
    steps: { type: "array", items: { type: "string" } },
    notes: { type: "string" },
    portion_g: { type: "number" },
    nutrition: NUTRITION_SCHEMA,
  },
  required: [
    "name",
    "description",
    "source",
    "servings",
    "prep_time",
    "cook_time",
    "ingredients",
    "steps",
    "notes",
    "portion_g",
    "nutrition",
  ],
  additionalProperties: false,
};

/** The reply to "what did I eat": a list of named food items with their nutrition. */
export const FOOD_ITEMS_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, ...NUTRITION_SCHEMA.properties },
        required: ["name", ...NUTRITION_SCHEMA.required],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
};
