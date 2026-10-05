// src/constants/seedDays.js — the two example days written for a brand-new account
// (seedInitialData). Meals are [name, is_exercise, rows]; each row is one item:
// [name, kcal, fat, sat_fat, carbs, sugar, fibre, net_carbs, protein, recipe_name?]

const item = (
  g,
  [name, kcal, fat, sat_fat, carbs, sugar, fibre, net_carbs, protein, recipe_name],
) => ({
  id: g(),
  name,
  kcal,
  fat,
  sat_fat,
  carbs,
  sugar,
  fibre,
  net_carbs,
  protein,
  ...(recipe_name === undefined ? {} : { recipe_name }),
});

const meal = (g, [name, is_exercise, rows = []]) => ({
  id: g(),
  name,
  is_exercise,
  items: rows.map((row) => item(g, row)),
});

const DAYS = [
  {
    date: "2026-03-04",
    notes: "First tracked day",
    meals: [
      [
        "☕ Breakfast",
        0,
        [
          [
            "Huel RTD Strawberries & Cream 250ml",
            200,
            9,
            2.5,
            17,
            0.75,
            3.6,
            13.4,
            11,
            "Huel RTD Strawberries & Cream",
          ],
          ["Black coffee (5oz)", 5, 0, 0, 0, 0, 0, 0, 0],
          ["Whole milk (1oz / 30ml)", 18, 1, 0.6, 1.4, 1.4, 0, 1.4, 0.9],
          ["White sugar (1 tsp / 4g)", 16, 0, 0, 4, 4, 0, 4, 0],
        ],
      ],
      ["🏋️ Morning Exercise", 1],
      ["🥤 Post-Workout", 0],
      [
        "🥗 Lunch",
        0,
        [
          [
            "Egg white omelet (100g egg white, 4g butter, 20g veg)",
            89,
            3.6,
            2.1,
            1.5,
            0.8,
            0.5,
            1,
            11.5,
          ],
          ["Carrot (100g)", 41, 0.2, 0, 9.6, 4.7, 2.8, 6.8, 0.9],
          ["Cucumber (75g)", 11, 0.1, 0, 2.4, 1.5, 0.5, 1.9, 0.6],
          ["Jason's Ciabattin bread (1 slice)", 111, 0.4, 0.1, 23, 1.1, 0.7, 22.3, 5],
          ["Butter for toast (0.5g)", 4, 0.4, 0.3, 0, 0, 0, 0, 0],
          ["M&S Potato & Onion Rosti x2", 140, 6.5, 2, 16, 1, 2.8, 13.2, 2],
        ],
      ],
      ["🍎 Snack", 0, [["Huel RTD Salted Caramel 250ml", 200, 9, 2.5, 17, 0.75, 3.6, 13.4, 11]]],
      [
        "🍹 Drinks",
        0,
        [
          ["Nimbu pani (330ml soda, 0.5 lime, salt)", 9, 0.1, 0, 2.6, 0.8, 0.7, 1.9, 0.2],
          ["Sencha matcha tea", 2, 0, 0, 0.4, 0, 0, 0.4, 0.2],
        ],
      ],
      [
        "🌙 Dinner",
        0,
        [
          ["Pinto bean stew (1 of 4 portions)", 338, 11, 0, 46, 0, 15, 31, 15, "Pinto Bean Stew"],
          ["Baby tomatoes (100g)", 18, 0.2, 0, 3.5, 3.5, 1, 2.5, 0.9],
          ["El Paso flour tortillas x1.5", 113, 3.4, 0.8, 18, 0, 0.8, 17.2, 2.3],
          ["M&S Grilled Turkish green olives x4", 40, 4, 0.6, 0.5, 0, 0.5, 0, 0.3],
          ["Scotch whisky (35ml)", 77, 0, 0, 0, 0, 0, 0, 0],
          ["Green grapes (150g)", 104, 0.2, 0, 27, 27, 0.9, 26.1, 1.1],
        ],
      ],
    ],
  },
  {
    date: "2026-03-05",
    notes: "Bike session day",
    meals: [
      [
        "☕ Breakfast",
        0,
        [
          ["Black coffee (5oz)", 5, 0, 0, 0, 0, 0, 0, 0],
          ["Whole milk (1oz / 30ml)", 18, 1, 0.6, 1.4, 1.4, 0, 1.4, 0.9],
          ["White sugar (1 tsp / 4g)", 16, 0, 0, 4, 4, 0, 4, 0],
        ],
      ],
      ["🏋️ Morning Exercise", 1, [["Stationary bike — calories burned", -85, 0, 0, 0, 0, 0, 0, 0]]],
      [
        "🥤 Post-Workout",
        0,
        [["Huel RTD Strawberries & Cream 250ml", 200, 9, 2.5, 17, 0.75, 3.6, 13.4, 11]],
      ],
      [
        "🥗 Lunch",
        0,
        [
          [
            "Egg white omelet (100g egg white, 4g butter, 20g veg)",
            89,
            3.6,
            2.1,
            1.5,
            0.8,
            0.5,
            1,
            11.5,
          ],
          ["Cucumber (85g)", 13, 0.1, 0, 2.7, 1.7, 0.6, 2.1, 0.7],
          ["Carrot (115g)", 47, 0.2, 0, 11, 5.4, 3.2, 7.8, 1],
          ["Strong Roots sweet potato hash brown x2", 156, 7.8, 0, 18, 1, 2, 16, 2.2],
          ["Jason's Ciabattin bread (1 slice)", 111, 0.4, 0.1, 23, 1.1, 0.7, 22.3, 5],
          ["Walnuts (30g)", 196, 19.6, 1.8, 4, 0.7, 2, 2, 4.6],
        ],
      ],
      ["🍎 Snack", 0],
      [
        "🌙 Dinner",
        0,
        [
          ["El Paso flour tortillas x1.5", 113, 2.6, 0.9, 20.3, 1.2, 1.2, 19.1, 3.2],
          ["Pinto bean stew (1 portion)", 338, 11, 1.5, 46, 2, 15, 31, 15, "Pinto Bean Stew"],
          ["Cotton candy grapes (125g)", 77, 0.2, 0, 19, 17, 0.6, 18.4, 0.8],
        ],
      ],
    ],
  },
];

/** The seed days, with ids from `g` (new ones each call). */
export const seedDays = (g) =>
  DAYS.map((day) => ({ ...day, meals: day.meals.map((m) => meal(g, m)) }));
