import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection } from "firebase/firestore";

// ── Helpers ───────────────────────────────────────────────────────────────────
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const fmt = n => n === 0 ? "0" : parseFloat(parseFloat(n).toFixed(1));
const formatDate = d => { const dt = new Date(d + "T12:00:00"); return dt.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" }); };
const formatDateShort = d => { const dt = new Date(d + "T12:00:00"); return dt.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" }); };

const DEFAULT_MEAL_SLOTS = [
  { name:"☕ Breakfast",        is_exercise:0 },
  { name:"🏋️ Morning Exercise", is_exercise:1 },
  { name:"🥤 Post-Workout",     is_exercise:0 },
  { name:"🥗 Lunch",            is_exercise:0 },
  { name:"🍎 Snack",            is_exercise:0 },
  { name:"🌙 Dinner",           is_exercise:0 },
];

const EXERCISE_COMPENDIUM = [
  // Cardio
  { cat:"Cardio", name:"Walking, slow (2 mph)",             met:2.5  },
  { cat:"Cardio", name:"Walking, moderate (3 mph)",         met:3.5  },
  { cat:"Cardio", name:"Walking, brisk (3.5 mph)",          met:4.3  },
  { cat:"Cardio", name:"Walking, fast (4 mph)",             met:5.0  },
  { cat:"Cardio", name:"Jogging, light (5 mph)",            met:7.0  },
  { cat:"Cardio", name:"Running, moderate (6 mph)",         met:9.8  },
  { cat:"Cardio", name:"Running, fast (7.5 mph)",           met:12.3 },
  { cat:"Cardio", name:"Running, very fast (10 mph)",       met:16.0 },
  { cat:"Cardio", name:"Cycling, leisure (<10 mph)",        met:4.0  },
  { cat:"Cardio", name:"Cycling, moderate (12–14 mph)",     met:8.0  },
  { cat:"Cardio", name:"Cycling, vigorous (16–19 mph)",     met:12.0 },
  { cat:"Cardio", name:"Cycling, stationary, moderate",     met:6.8  },
  { cat:"Cardio", name:"Cycling, stationary, vigorous",     met:8.8  },
  { cat:"Cardio", name:"Elliptical trainer, moderate",      met:5.0  },
  { cat:"Cardio", name:"Elliptical trainer, vigorous",      met:8.5  },
  { cat:"Cardio", name:"Rowing machine, moderate",          met:7.0  },
  { cat:"Cardio", name:"Rowing machine, vigorous",          met:8.5  },
  { cat:"Cardio", name:"Jump rope, moderate",               met:10.0 },
  { cat:"Cardio", name:"Jump rope, fast",                   met:12.3 },
  { cat:"Cardio", name:"Stair climbing machine",            met:9.0  },
  { cat:"Cardio", name:"Hiking, moderate terrain",          met:5.3  },
  { cat:"Cardio", name:"Hiking, steep terrain",             met:7.8  },
  // Strength & HIIT
  { cat:"Strength", name:"Weight training, light effort",   met:3.0  },
  { cat:"Strength", name:"Weight training, vigorous",       met:6.0  },
  { cat:"Strength", name:"Bodyweight exercises (general)",  met:3.8  },
  { cat:"Strength", name:"Circuit training (minimal rest)", met:8.0  },
  { cat:"Strength", name:"HIIT, general",                   met:8.0  },
  { cat:"Strength", name:"HIIT, vigorous",                  met:10.3 },
  { cat:"Strength", name:"Kettlebell training",             met:8.2  },
  { cat:"Strength", name:"Calisthenics, light",             met:3.5  },
  { cat:"Strength", name:"Calisthenics, vigorous",          met:8.0  },
  { cat:"Strength", name:"CrossFit / functional training",  met:9.0  },
  // Flexibility & Mind-Body
  { cat:"Flexibility", name:"Yoga, Hatha",                  met:2.5  },
  { cat:"Flexibility", name:"Yoga, Power/Vinyasa",          met:4.0  },
  { cat:"Flexibility", name:"Pilates, general",             met:3.0  },
  { cat:"Flexibility", name:"Stretching, light",            met:2.3  },
  { cat:"Flexibility", name:"Tai Chi",                      met:3.0  },
  // Swimming & Water
  { cat:"Swimming", name:"Swimming, leisurely",             met:6.0  },
  { cat:"Swimming", name:"Swimming, moderate laps",         met:7.0  },
  { cat:"Swimming", name:"Swimming, vigorous laps",         met:9.8  },
  { cat:"Swimming", name:"Water aerobics",                  met:5.5  },
  // Sports
  { cat:"Sports", name:"Football / soccer, recreational",   met:7.0  },
  { cat:"Sports", name:"Football / soccer, competitive",    met:10.0 },
  { cat:"Sports", name:"Basketball, game",                  met:8.0  },
  { cat:"Sports", name:"Tennis, singles",                   met:8.0  },
  { cat:"Sports", name:"Tennis, doubles",                   met:6.0  },
  { cat:"Sports", name:"Badminton, recreational",           met:5.5  },
  { cat:"Sports", name:"Cricket, batting/fielding",         met:5.0  },
  { cat:"Sports", name:"Golf, carrying clubs",              met:5.3  },
  { cat:"Sports", name:"Squash",                            met:12.0 },
  { cat:"Sports", name:"Table tennis / ping pong",          met:4.0  },
  { cat:"Sports", name:"Volleyball, recreational",          met:3.0  },
  { cat:"Sports", name:"Dancing, aerobic/general",          met:6.5  },
  { cat:"Sports", name:"Dancing, ballroom, slow",           met:3.0  },
  // Daily activity
  { cat:"Daily", name:"Gardening, general",                 met:3.5  },
  { cat:"Daily", name:"House cleaning, vigorous",           met:3.5  },
  { cat:"Daily", name:"Carrying heavy loads",               met:7.5  },
];

const INITIAL_RECIPES = [
  { id:"r1", name:"Pinto Bean Stew", description:"A hearty, high-protein, high-fibre stew. Makes 4 portions.", source:"Home recipe", servings:4, prep_time:"10 minutes", cook_time:"30 minutes",
    ingredients:[{amount:"606g",item:"Cooked pinto beans"},{amount:"102g",item:"Onion, chopped"},{amount:"~60g",item:"Green chillies"},{amount:"3 tbsp",item:"Gingelly (sesame) oil"},{amount:"201g",item:"Mutti Polpa chopped tomatoes"},{amount:"1 tsp",item:"Salt"},{amount:"1 pinch",item:"Asafoetida (hing)"}],
    steps:["Heat gingelly oil over medium heat.","Add asafoetida, sizzle 10 seconds.","Add onion, sauté until translucent.","Add chillies, cook 2 min.","Add tomatoes, cook until oil separates.","Add pinto beans and salt. Mix well.","Simmer 10–15 min until thickened.","Serve hot with tortillas or bread."],
    notes:"~4 × 225g portions. Gingelly oil adds distinctive nutty flavour.", nutrition:{kcal:338,fat:11,carbs:46,fibre:15,net_carbs:31,protein:15}},
  { id:"r2", name:"Paneer Bhurji", description:"Ranveer Brar's soft scrambled paneer with onion, tomato and spices.", source:"Ranveer Brar", servings:2, prep_time:"5 minutes", cook_time:"20 minutes",
    ingredients:[{amount:"1L",item:"Whole milk"},{amount:"2 tsp",item:"Curd"},{amount:"2 tsp",item:"Ghee"},{amount:"1",item:"Onion"},{amount:"1",item:"Tomato"},{amount:"1",item:"Green chilli"},{amount:"½ tsp",item:"Turmeric"},{amount:"¼ tsp",item:"Red chilli powder"}],
    steps:["Boil milk, add curd to curdle.","Strain through muslin, crumble paneer.","Heat ghee, add cumin seeds.","Sauté onion, add ginger garlic paste.","Add tomato and spices, cook until soft.","Add paneer, mix well.","Turn off heat, stir in beaten curd and coriander."],
    notes:"1L milk yields ~110g paneer. Reserve whey for cooking.", nutrition:{kcal:278,fat:19.4,carbs:12.6,fibre:1.9,net_carbs:10.7,protein:13.2}},
  { id:"r3", name:"Nimbu Pani", description:"Simple Indian lime soda — refreshing and nearly calorie-free.", source:"Home recipe", servings:1, prep_time:"2 minutes", cook_time:"0 minutes",
    ingredients:[{amount:"330ml",item:"Chilled soda water"},{amount:"0.5",item:"Fresh lime (~30g), juiced"},{amount:"1 pinch",item:"Salt"},{amount:"optional",item:"Roasted cumin powder"}],
    steps:["Squeeze lime into glass.","Add salt.","Pour soda water, stir gently.","Serve over ice."],
    notes:"Add black salt (kala namak) for authentic flavour.", nutrition:{kcal:9,fat:0.1,carbs:2.6,fibre:0.7,net_carbs:1.9,protein:0.2}},
  { id:"r4", name:"Egg White Omelet", description:"High-protein, low-fat omelet with butter and mixed vegetables.", source:"Home recipe", servings:1, prep_time:"2 minutes", cook_time:"5 minutes",
    ingredients:[{amount:"100g",item:"Liquid egg whites"},{amount:"4g",item:"Butter"},{amount:"20g",item:"Mixed vegetables"},{amount:"to taste",item:"Salt and pepper"}],
    steps:["Heat butter in non-stick pan.","Add veg, cook 1 min.","Pour egg whites, season.","Cook until set, fold, serve."],
    notes:"100g egg white ≈ 3 large egg whites. Only 89 kcal.", nutrition:{kcal:89,fat:3.6,carbs:1.5,fibre:0.5,net_carbs:1,protein:11.5}},
  { id:"r5", name:"Huel RTD Strawberries & Cream", description:"Huel Ready to Drink — 500ml = 400kcal complete meal shake.", source:"Huel", servings:2, prep_time:"0 minutes", cook_time:"0 minutes",
    ingredients:[{amount:"500ml",item:"Huel RTD Strawberries & Cream"}],
    steps:["Shake well.","Serve chilled."],
    notes:"250ml = 200kcal. Gluten-free, no added sugar.", nutrition:{kcal:200,fat:9,carbs:17,fibre:3.6,net_carbs:13.4,protein:11}},
];

const makeMeals = () => DEFAULT_MEAL_SLOTS.map(s => ({ id:genId(), name:s.name, is_exercise:s.is_exercise, items:[] }));

// ── Firestore helpers ─────────────────────────────────────────────────────────
const dayRef = (uid, date) => doc(db, "users", uid, "nutrition_days", date);
const recipeRef = (uid, id) => doc(db, "users", uid, "recipes", id);

async function loadAllRecipes(uid) {
  try {
    const snap = await getDocs(collection(db, "users", uid, "recipes"));
    const recipes = [];
    snap.forEach(d => recipes.push(d.data()));
    return recipes.sort((a,b) => a.name.localeCompare(b.name));
  } catch(err) { console.error("loadAllRecipes error:", err); return []; }
}

async function saveRecipe(uid, recipe) {
  await setDoc(recipeRef(uid, recipe.id), recipe);
}

async function deleteRecipe(uid, id) {
  await deleteDoc(recipeRef(uid, id));
}

async function loadAllDays(uid) {
  try {
    const snap = await getDocs(collection(db, "users", uid, "nutrition_days"));
    const days = [];
    snap.forEach(d => days.push(d.data()));
    return days.sort((a,b) => b.date.localeCompare(a.date));
  } catch (err) {
    console.error("loadAllDays error:", err);
    return [];
  }
}

async function saveDay(uid, dayData) {
  await setDoc(dayRef(uid, dayData.date), dayData);
}

async function loadDay(uid, date) {
  const snap = await getDoc(dayRef(uid, date));
  return snap.exists() ? snap.data() : null;
}

// ── Claude API ────────────────────────────────────────────────────────────────
async function claudeParseFood(text) {
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:1000,
      system:`You are a precise nutrition analysis assistant. The user will describe food they ate.
Return ONLY a JSON array of food items — no other text, no markdown, no explanation whatsoever.
Each item must have exactly these fields:
- name (string): descriptive name including quantity/weight e.g. "Walnuts (30g)"
- kcal (number): calories
- fat (number): total fat in grams
- sat_fat (number): saturated fat in grams
- carbs (number): total carbohydrates in grams
- sugar (number): sugars in grams
- fibre (number): dietary fibre in grams
- net_carbs (number): carbs minus fibre
- protein (number): protein in grams
Use accurate nutritional database values. Round to 1 decimal place. Return ONLY valid JSON array.`,
      messages:[{role:"user", content:text}]
    })
  });
  const data = await res.json();
  let raw = data.content?.[0]?.text?.trim() || "";
  if (raw.startsWith("```")) raw = raw.split("```")[1]?.replace(/^json/,"").trim() || raw;
  return JSON.parse(raw);
}

async function claudeCreateRecipe(description) {
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:1000,
      system:`You are a recipe and nutrition expert. The user will describe a recipe.
Return ONLY a JSON object — no markdown, no explanation. The object must have exactly these fields:
{
  "name": string,
  "description": string (one sentence),
  "source": string (e.g. "Home recipe"),
  "servings": number,
  "prep_time": string (e.g. "10 minutes"),
  "cook_time": string (e.g. "25 minutes"),
  "ingredients": [ { "amount": string, "item": string } ],
  "steps": [ string ],
  "notes": string,
  "nutrition": { "kcal": number, "fat": number, "sat_fat": number, "carbs": number, "sugar": number, "fibre": number, "net_carbs": number, "protein": number }
}
nutrition is PER SERVING. Use accurate nutritional database values. Return ONLY valid JSON.`,
      messages:[{role:"user", content:description}]
    })
  });
  const data = await res.json();
  let raw = data.content?.[0]?.text?.trim() || "";
  if (raw.startsWith("```")) raw = raw.split("```")[1]?.replace(/^json/,"").trim() || raw;
  return JSON.parse(raw);
}

async function claudeChat(messages) {
  const res = await fetch("/api/claude", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:1000,
      system:"You are a helpful nutrition and health assistant. Answer naturally and conversationally.",
      messages
    })
  });
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ── Macro calculator ──────────────────────────────────────────────────────────
const ACTIVITY_LEVELS = [
  { label:"Sedentary",         desc:"Desk job, little/no exercise",   factor:1.2   },
  { label:"Lightly Active",    desc:"Light exercise 1–3×/week",       factor:1.375 },
  { label:"Moderately Active", desc:"Moderate exercise 3–5×/week",    factor:1.55  },
  { label:"Very Active",       desc:"Hard exercise 6–7×/week",        factor:1.725 },
  { label:"Extremely Active",  desc:"Physical job + hard training",   factor:1.9   },
];
function calcMacros(tdee, weight, proteinPerKg, fatPct) {
  const protein_g = Math.round(weight * proteinPerKg);
  const fat_g = Math.round(tdee * fatPct / 9);
  const carbs_g = Math.round((tdee - protein_g*4 - fat_g*9) / 4);
  return { protein_g, fat_g, carbs_g, fibre_g:30, net_carbs:Math.max(0,carbs_g-30) };
}


async function seedInitialData(uid) {
  const g = genId;
  const days = [
    { date:"2026-03-04", notes:"First tracked day", meals:[
      { id:g(), name:"☕ Breakfast", is_exercise:0, items:[
        { id:g(), name:"Huel RTD Strawberries & Cream 250ml", kcal:200, fat:9, sat_fat:2.5, carbs:17, sugar:0.75, fibre:3.6, net_carbs:13.4, protein:11, recipe_name:"Huel RTD Strawberries & Cream" },
        { id:g(), name:"Black coffee (5oz)", kcal:5, fat:0, sat_fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0 },
        { id:g(), name:"Whole milk (1oz / 30ml)", kcal:18, fat:1, sat_fat:0.6, carbs:1.4, sugar:1.4, fibre:0, net_carbs:1.4, protein:0.9 },
        { id:g(), name:"White sugar (1 tsp / 4g)", kcal:16, fat:0, sat_fat:0, carbs:4, sugar:4, fibre:0, net_carbs:4, protein:0 },
      ]},
      { id:g(), name:"🏋️ Morning Exercise", is_exercise:1, items:[] },
      { id:g(), name:"🥤 Post-Workout", is_exercise:0, items:[] },
      { id:g(), name:"🥗 Lunch", is_exercise:0, items:[
        { id:g(), name:"Egg white omelet (100g egg white, 4g butter, 20g veg)", kcal:89, fat:3.6, sat_fat:2.1, carbs:1.5, sugar:0.8, fibre:0.5, net_carbs:1, protein:11.5, recipe_name:"Egg White Omelet" },
        { id:g(), name:"Carrot (100g)", kcal:41, fat:0.2, sat_fat:0, carbs:9.6, sugar:4.7, fibre:2.8, net_carbs:6.8, protein:0.9 },
        { id:g(), name:"Cucumber (75g)", kcal:11, fat:0.1, sat_fat:0, carbs:2.4, sugar:1.5, fibre:0.5, net_carbs:1.9, protein:0.6 },
        { id:g(), name:"Jason's Ciabattin bread (1 slice)", kcal:111, fat:0.4, sat_fat:0.1, carbs:23, sugar:1.1, fibre:0.7, net_carbs:22.3, protein:5 },
        { id:g(), name:"Butter for toast (0.5g)", kcal:4, fat:0.4, sat_fat:0.3, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0 },
        { id:g(), name:"M&S Potato & Onion Rosti x2", kcal:140, fat:6.5, sat_fat:2, carbs:16, sugar:1, fibre:2.8, net_carbs:13.2, protein:2 },
      ]},
      { id:g(), name:"🍎 Snack", is_exercise:0, items:[
        { id:g(), name:"Huel RTD Salted Caramel 250ml", kcal:200, fat:9, sat_fat:2.5, carbs:17, sugar:0.75, fibre:3.6, net_carbs:13.4, protein:11 },
      ]},
      { id:g(), name:"🍹 Drinks", is_exercise:0, items:[
        { id:g(), name:"Nimbu pani (330ml soda, 0.5 lime, salt)", kcal:9, fat:0.1, sat_fat:0, carbs:2.6, sugar:0.8, fibre:0.7, net_carbs:1.9, protein:0.2, recipe_name:"Nimbu Pani" },
        { id:g(), name:"Sencha matcha tea", kcal:2, fat:0, sat_fat:0, carbs:0.4, sugar:0, fibre:0, net_carbs:0.4, protein:0.2 },
      ]},
      { id:g(), name:"🌙 Dinner", is_exercise:0, items:[
        { id:g(), name:"Pinto bean stew (1 of 4 portions)", kcal:338, fat:11, sat_fat:0, carbs:46, sugar:0, fibre:15, net_carbs:31, protein:15, recipe_name:"Pinto Bean Stew" },
        { id:g(), name:"Baby tomatoes (100g)", kcal:18, fat:0.2, sat_fat:0, carbs:3.5, sugar:3.5, fibre:1, net_carbs:2.5, protein:0.9 },
        { id:g(), name:"El Paso flour tortillas x1.5", kcal:113, fat:3.4, sat_fat:0.8, carbs:18, sugar:0, fibre:0.8, net_carbs:17.2, protein:2.3 },
        { id:g(), name:"M&S Grilled Turkish green olives x4", kcal:40, fat:4, sat_fat:0.6, carbs:0.5, sugar:0, fibre:0.5, net_carbs:0, protein:0.3 },
        { id:g(), name:"Scotch whisky (35ml)", kcal:77, fat:0, sat_fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0 },
        { id:g(), name:"Green grapes (150g)", kcal:104, fat:0.2, sat_fat:0, carbs:27, sugar:27, fibre:0.9, net_carbs:26.1, protein:1.1 },
      ]},
    ]},
    { date:"2026-03-05", notes:"Bike session day", meals:[
      { id:g(), name:"☕ Breakfast", is_exercise:0, items:[
        { id:g(), name:"Black coffee (5oz)", kcal:5, fat:0, sat_fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0 },
        { id:g(), name:"Whole milk (1oz / 30ml)", kcal:18, fat:1, sat_fat:0.6, carbs:1.4, sugar:1.4, fibre:0, net_carbs:1.4, protein:0.9 },
        { id:g(), name:"White sugar (1 tsp / 4g)", kcal:16, fat:0, sat_fat:0, carbs:4, sugar:4, fibre:0, net_carbs:4, protein:0 },
      ]},
      { id:g(), name:"🏋️ Morning Exercise", is_exercise:1, items:[
        { id:g(), name:"Stationary bike — calories burned", kcal:-85, fat:0, sat_fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0 },
      ]},
      { id:g(), name:"🥤 Post-Workout", is_exercise:0, items:[
        { id:g(), name:"Huel RTD Strawberries & Cream 250ml", kcal:200, fat:9, sat_fat:2.5, carbs:17, sugar:0.75, fibre:3.6, net_carbs:13.4, protein:11, recipe_name:"Huel RTD Strawberries & Cream" },
      ]},
      { id:g(), name:"🥗 Lunch", is_exercise:0, items:[
        { id:g(), name:"Egg white omelet (100g egg white, 4g butter, 20g veg)", kcal:89, fat:3.6, sat_fat:2.1, carbs:1.5, sugar:0.8, fibre:0.5, net_carbs:1, protein:11.5, recipe_name:"Egg White Omelet" },
        { id:g(), name:"Cucumber (85g)", kcal:13, fat:0.1, sat_fat:0, carbs:2.7, sugar:1.7, fibre:0.6, net_carbs:2.1, protein:0.7 },
        { id:g(), name:"Carrot (115g)", kcal:47, fat:0.2, sat_fat:0, carbs:11, sugar:5.4, fibre:3.2, net_carbs:7.8, protein:1 },
        { id:g(), name:"Strong Roots sweet potato hash brown x2", kcal:156, fat:7.8, sat_fat:0, carbs:18, sugar:1, fibre:2, net_carbs:16, protein:2.2 },
        { id:g(), name:"Jason's Ciabattin bread (1 slice)", kcal:111, fat:0.4, sat_fat:0.1, carbs:23, sugar:1.1, fibre:0.7, net_carbs:22.3, protein:5 },
        { id:g(), name:"Butter for toast (2g)", kcal:14, fat:1.6, sat_fat:1, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0 },
        { id:g(), name:"Nimbu pani (330ml soda, 0.5 lime, salt)", kcal:9, fat:0.1, sat_fat:0, carbs:2.6, sugar:0.8, fibre:0.7, net_carbs:1.9, protein:0.2, recipe_name:"Nimbu Pani" },
        { id:g(), name:"Walnuts (30g)", kcal:196, fat:19.6, sat_fat:1.8, carbs:4, sugar:0.7, fibre:2, net_carbs:2, protein:4.6 },
      ]},
      { id:g(), name:"🍎 Snack", is_exercise:0, items:[] },
      { id:g(), name:"🌆 Evening Workout", is_exercise:1, items:[] },
      { id:g(), name:"🌙 Dinner", is_exercise:0, items:[
        { id:g(), name:"El Paso flour tortillas x1.5", kcal:113, fat:2.6, sat_fat:0.9, carbs:20.3, sugar:1.2, fibre:1.2, net_carbs:19.1, protein:3.2 },
        { id:g(), name:"Pinto bean stew (1 portion)", kcal:338, fat:11, sat_fat:1.5, carbs:46, sugar:2, fibre:15, net_carbs:31, protein:15, recipe_name:"Pinto Bean Stew" },
        { id:g(), name:"Grilled Spanish olives x6", kcal:60, fat:6, sat_fat:0.9, carbs:0.6, sugar:0, fibre:0.5, net_carbs:0.1, protein:0.4 },
        { id:g(), name:"Dry sherry (30ml)", kcal:32, fat:0, sat_fat:0, carbs:0.2, sugar:0.2, fibre:0, net_carbs:0.2, protein:0 },
        { id:g(), name:"Cotton candy grapes (125g)", kcal:77, fat:0.2, sat_fat:0, carbs:19, sugar:17, fibre:0.6, net_carbs:18.4, protein:0.8 },
      ]},
    ]},
    { date:"2026-03-06", notes:"Today", meals:[
      { id:g(), name:"☕ Breakfast", is_exercise:0, items:[
        { id:g(), name:"Black coffee (5oz)", kcal:5, fat:0, sat_fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0 },
        { id:g(), name:"Whole milk (1oz / 30ml)", kcal:18, fat:1, sat_fat:0.6, carbs:1.4, sugar:1.4, fibre:0, net_carbs:1.4, protein:0.9 },
        { id:g(), name:"White sugar (1 tsp / 4g)", kcal:16, fat:0, sat_fat:0, carbs:4, sugar:4, fibre:0, net_carbs:4, protein:0 },
      ]},
      { id:g(), name:"🏋️ Morning Exercise", is_exercise:1, items:[
        { id:g(), name:"Stationary bike — calories burned", kcal:-100, fat:0, sat_fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0 },
      ]},
      { id:g(), name:"🥤 Post-Workout", is_exercise:0, items:[] },
      { id:g(), name:"🥗 Lunch", is_exercise:0, items:[
        { id:g(), name:"Egg white omelet", kcal:51, fat:0, sat_fat:0, carbs:1, sugar:0, fibre:0, net_carbs:1, protein:11, recipe_name:"Egg White Omelet" },
        { id:g(), name:"Jason's Ciabattin bread (1 slice)", kcal:83, fat:0.9, sat_fat:0.1, carbs:16, sugar:0.8, fibre:0.7, net_carbs:15.3, protein:3 },
        { id:g(), name:"Strong Roots sweet potato hash brown x2", kcal:156, fat:7.8, sat_fat:0, carbs:18, sugar:1, fibre:2, net_carbs:16, protein:2.2 },
        { id:g(), name:"Nimbu pani", kcal:45, fat:0, sat_fat:0, carbs:11, sugar:10, fibre:0, net_carbs:11, protein:0.2, recipe_name:"Nimbu Pani" },
        { id:g(), name:"Cucumber (115g)", kcal:17, fat:0.1, sat_fat:0, carbs:3.6, sugar:2, fibre:0.7, net_carbs:2.9, protein:0.7 },
        { id:g(), name:"Carrot (125g)", kcal:51, fat:0.2, sat_fat:0, carbs:11.9, sugar:5.9, fibre:3.5, net_carbs:8.4, protein:1.1 },
        { id:g(), name:"Walnuts (30g)", kcal:196, fat:19.6, sat_fat:1.8, carbs:4, sugar:0.7, fibre:2, net_carbs:2, protein:4.6 },
      ]},
      { id:g(), name:"🍎 Snack", is_exercise:0, items:[] },
      { id:g(), name:"🌆 Evening Workout", is_exercise:1, items:[] },
      { id:g(), name:"🌙 Dinner", is_exercise:0, items:[] },
    ]},
  ];
  for (const day of days) {
    await saveDay(uid, day);
  }
  // Also seed built-in recipes
  for (const r of INITIAL_RECIPES) {
    await saveRecipe(uid, r);
  }
  return days.sort((a,b) => b.date.localeCompare(a.date));
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function NutritionTracker({ userId }) {
  const [allDays, setAllDays] = useState([]);
  const [currentDate, setCurrentDate] = useState(null);
  const [currentDayData, setCurrentDayData] = useState(null);
  const [activeTab, setActiveTab] = useState("log");
  const [loading, setLoading] = useState(true);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [recipeModal, setRecipeModal] = useState(null);
  const [userRecipes, setUserRecipes] = useState([]);
  const [recipeBuilder, setRecipeBuilder] = useState(false);
  const [builderInput, setBuilderInput] = useState("");
  const [builderLoading, setBuilderLoading] = useState(false);
  const [builderPreview, setBuilderPreview] = useState(null);
  const [builderError, setBuilderError] = useState("");
  const [ingredientModal, setIngredientModal] = useState(null); // { name }
  const [ingredientWeight, setIngredientWeight] = useState("100");
  const [ingredientLoading, setIngredientLoading] = useState(false);
  // ── Exercise tracker state ──
  const [exSearch, setExSearch] = useState("");
  const [exSelected, setExSelected] = useState(null);
  const [exDuration, setExDuration] = useState("30");
  const [exHRavg, setExHRavg] = useState("");
  const [exHRmax, setExHRmax] = useState("");
  const [exResult, setExResult] = useState(null);
  const [exMsg, setExMsg] = useState(null);
  const [showExModal, setShowExModal] = useState(false);
  const [showRecipesModal, setShowRecipesModal] = useState(false);
  // Polar integration state
  const [polarConnected, setPolarConnected] = useState(false);
  const [polarSessions, setPolarSessions] = useState([]);
  const [polarLoading, setPolarLoading] = useState(false);
  const [polarLogModal, setPolarLogModal] = useState(null); // session being logged

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMealId, setChatMealId] = useState("__chat__");
  const [chatDate, setChatDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [chatLoading, setChatLoading] = useState(false);
  const [justChatHistory, setJustChatHistory] = useState([]);
  const chatBottomRef = useRef(null);

  // Add entry state
  const [addDate, setAddDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [addMealId, setAddMealId] = useState("");
  const [addMealName, setAddMealName] = useState("");
  const [addItem, setAddItem] = useState({ name:"", kcal:"", fat:"", sat_fat:"", carbs:"", sugar:"", fibre:"", net_carbs:"", protein:"" });
  const [nameDropdown, setNameDropdown] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const nameInputRef = useRef(null);
  const [addMsg, setAddMsg] = useState(null);

  // Compare state
  const [compareSlots, setCompareSlots] = useState([null,null,null,null,null]);
  const [compareData, setCompareData] = useState([null,null,null,null,null]);

  // Calc state
  const [calcSex, setCalcSex] = useState("m");
  const [calcAge, setCalcAge] = useState(60);
  const [calcHeight, setCalcHeight] = useState(165);
  const [calcWeight, setCalcWeight] = useState(84);
  const [calcProtein, setCalcProtein] = useState(1.4);
  const [calcFatPct, setCalcFatPct] = useState(30);

  // ── Load data ──
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      try {
        setLoading(true);
        let days = await loadAllDays(userId);
        if (days.length === 0) {
          days = await seedInitialData(userId);
        }
        const recipes = await loadAllRecipes(userId);
        setUserRecipes(recipes);
        // Load Polar connection status + pending sessions
        const polarDoc = await getDoc(doc(db, "users", userId, "polar", "connection"));
        if (polarDoc.exists()) {
          setPolarConnected(polarDoc.data().connected || false);
        }
        const polarSnap = await getDocs(collection(db, "users", userId, "polar_sessions"));
        const sessions = polarSnap.docs.map(d => ({ id:d.id, ...d.data() }))
          .filter(s => !s.logged)
          .sort((a,b) => (b.start_time||"").localeCompare(a.start_time||""));
        setPolarSessions(sessions);
        setAllDays(days);
        if (days.length > 0) {
          const first = days[0];
          setCurrentDate(first.date);
          setCurrentDayData(first);
          setChatDate(first.date);
          const slots = days.slice(0,5).map(d => d.date);
          setCompareSlots([...slots, ...Array(5-slots.length).fill(null)].slice(0,5));
          setCompareData(days.slice(0,5).map(d => d).concat(Array(5).fill(null)).slice(0,5));
        }
      } catch(err) {
        console.error("Init error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  useEffect(() => { chatBottomRef.current?.scrollIntoView({ behavior:"smooth" }); }, [chatMessages]);

  // ── Day totals ──
  const getDayTotals = (dayData) => {
    if (!dayData) return { kcal:0, fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0, foodKcal:0, exerciseBurned:0 };
    let kcal=0, fat=0, carbs=0, sugar=0, fibre=0, net_carbs=0, protein=0, foodKcal=0, exerciseBurned=0;
    dayData.meals?.forEach(meal => {
      meal.items?.forEach(i => {
        kcal+=i.kcal||0; fat+=i.fat||0; carbs+=i.carbs||0; sugar+=i.sugar||0;
        fibre+=i.fibre||0; net_carbs+=i.net_carbs||0; protein+=i.protein||0;
        if (meal.is_exercise) exerciseBurned += Math.abs(i.kcal||0);
        else foodKcal += i.kcal||0;
      });
    });
    return { kcal, fat, carbs, sugar, fibre, net_carbs, protein, foodKcal, exerciseBurned };
  };

  // ── Load/switch day ──
  const switchDay = async (date) => {
    setCurrentDate(date);
    let data = allDays.find(d => d.date === date) || null;
    if (!data) data = await loadDay(userId, date);
    setCurrentDayData(data);
    setChatDate(date);
    setChatMealId("__chat__");
  };

  // ── Create new day ──
  const createDay = async (date) => {
    if (allDays.find(d => d.date === date)) return;
    const newDay = { date, notes:"", meals:makeMeals() };
    await saveDay(userId, newDay);
    const updated = [newDay, ...allDays].sort((a,b) => b.date.localeCompare(a.date));
    setAllDays(updated);
    setCurrentDate(date);
    setCurrentDayData(newDay);
    setChatDate(date);
  };

  // ── Save updated day ──
  const persistDay = async (dayData) => {
    await saveDay(userId, dayData);
    setAllDays(prev => {
      const filtered = prev.filter(d => d.date !== dayData.date);
      return [dayData, ...filtered].sort((a,b) => b.date.localeCompare(a.date));
    });
    setCurrentDayData(dayData);
  };

  // ── Delete item ──
  const deleteItem = async (mealId, itemId) => {
    if (!currentDayData) return;
    const updated = { ...currentDayData, meals: currentDayData.meals.map(m =>
      m.id === mealId ? { ...m, items: m.items.filter(i => i.id !== itemId) } : m
    )};
    await persistDay(updated);
  };

  // ── Chat ──
  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setChatLoading(true);

    const userMsg = { id:genId(), type:"user", text };
    const thinkMsg = { id:genId(), type:"claude", text:"⏳ Thinking…" };
    setChatMessages(prev => [...prev, userMsg, thinkMsg]);

    try {
      if (chatMealId === "__chat__") {
        const history = [...justChatHistory, { role:"user", content:text }];
        const reply = await claudeChat(history);
        setJustChatHistory([...history, { role:"assistant", content:reply }]);
        setChatMessages(prev => prev.map(m => m.id === thinkMsg.id ? { ...m, text:reply } : m));
      } else {
        const items = await claudeParseFood(text);
        const mealName = currentDayData?.meals?.find(m => m.id === chatMealId)?.name || "Meal";
        setChatMessages(prev => prev.map(m => m.id === thinkMsg.id
          ? { ...m, type:"preview", items, mealId:chatMealId, mealName, confirmed:false }
          : m
        ));
      }
    } catch (err) {
      setChatMessages(prev => prev.map(m => m.id === thinkMsg.id ? { ...m, type:"error", text:"❌ " + err.message } : m));
    }
    setChatLoading(false);
  };

  const confirmLog = async (msgId) => {
    const msg = chatMessages.find(m => m.id === msgId);
    if (!msg) return;
    let day = currentDayData;
    if (!day || day.date !== chatDate) {
      day = await loadDay(userId, chatDate);
      if (!day) { day = { date:chatDate, notes:"", meals:makeMeals() }; }
    }
    const newItems = msg.items.map(i => ({ ...i, id:genId() }));
    const updated = { ...day, meals: day.meals.map(m =>
      m.id === msg.mealId ? { ...m, items:[...m.items, ...newItems] } : m
    )};
    await persistDay(updated);
    setChatMessages(prev => prev.map(m => m.id === msgId ? { ...m, confirmed:true } : m));
  };

  // ── Add item manually ──
  const submitAddItem = async () => {
    if (!addItem.name) { setAddMsg({ ok:false, text:"Please enter a food name" }); return; }
    let day = allDays.find(d => d.date === addDate) || await loadDay(userId, addDate);
    if (!day) { day = { date:addDate, notes:"", meals:makeMeals() }; }

    let targetMealId = addMealId;
    // Handle slot sentinel (date had no day yet, dropdown used __slot__+name)
    if (targetMealId && targetMealId.startsWith("__slot__")) {
      const slotName = targetMealId.replace("__slot__", "");
      const match = day.meals.find(m => m.name === slotName);
      targetMealId = match ? match.id : null;
    }
    if (!targetMealId && addMealName) {
      const newMeal = { id:genId(), name:addMealName, is_exercise:0, items:[] };
      day = { ...day, meals:[...day.meals, newMeal] };
      targetMealId = newMeal.id;
    }
    if (!targetMealId) { setAddMsg({ ok:false, text:"Please select or create a meal" }); return; }

    const item = { id:genId(), name:addItem.name,
      kcal:parseFloat(addItem.kcal)||0, fat:parseFloat(addItem.fat)||0, sat_fat:parseFloat(addItem.sat_fat)||0,
      carbs:parseFloat(addItem.carbs)||0, sugar:parseFloat(addItem.sugar)||0, fibre:parseFloat(addItem.fibre)||0,
      net_carbs:parseFloat(addItem.net_carbs)||0, protein:parseFloat(addItem.protein)||0 };

    const updated = { ...day, meals: day.meals.map(m =>
      m.id === targetMealId ? { ...m, items:[...m.items, item] } : m
    )};
    await persistDay(updated);
    if (addDate === currentDate) setCurrentDayData(updated);
    setAddMsg({ ok:true, text:"✅ Item added!" });
    setAddItem({ name:"", kcal:"", fat:"", sat_fat:"", carbs:"", sugar:"", fibre:"", net_carbs:"", protein:"" });
    setTimeout(() => setAddMsg(null), 3000);
  };

  // ── Calendar navigation ──
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const loggedSet = new Set(allDays.map(d => d.date));
  const loggedKcal = {};
  allDays.forEach(d => { loggedKcal[d.date] = getDayTotals(d).foodKcal; });

  const renderCalendar = () => {
    const dows = ["M","T","W","T","F","S","S"];
    let blocks = [];
    // Render 14 months: 6 before calMonth through 7 ahead
    for (let offset = -6; offset <= 7; offset++) {
      let m = calMonth + offset, y = calYear;
      while (m < 0)  { m += 12; y--; }
      while (m > 11) { m -= 12; y++; }
      const label = new Date(y, m, 1).toLocaleString("default", { month:"short", year:"numeric" });
      const firstDow = (new Date(y,m,1).getDay()+6)%7;
      const daysInMonth = new Date(y,m+1,0).getDate();
      let cells = dows.map((d,i) => (
        <div key={"dow"+i} style={{ textAlign:"center", fontSize:"8px", fontWeight:"bold", color:"#6B8CAE", paddingBottom:"2px" }}>{d}</div>
      ));
      for (let i=0;i<firstDow;i++) cells.push(<div key={"bl"+i}/>);
      for (let d=1;d<=daysInMonth;d++) {
        const mm = String(m+1).padStart(2,"0"), dd = String(d).padStart(2,"0");
        const dateStr = `${y}-${mm}-${dd}`;
        const isLogged = loggedSet.has(dateStr);
        const isActive = dateStr === currentDate;
        const isToday = dateStr === todayStr;
        const kcal = loggedKcal[dateStr];
        cells.push(
          <div key={dateStr} onClick={() => switchDay(dateStr)}
            style={{ textAlign:"center", fontSize:"10px", padding:"3px 1px", borderRadius:"4px", cursor:"pointer", lineHeight:"1.2",
              background: isActive ? "#1F4E79" : isLogged ? "#2E75B6" : "transparent",
              color: isLogged||isActive ? "#fff" : isToday ? "#2E75B6" : "#1a2a3a",
              fontWeight: isLogged||isToday ? "bold" : "normal",
              outline: isActive ? "2px solid #F57F17" : "none", outlineOffset:"1px" }}>
            {d}
            {kcal ? <span style={{ fontSize:"6px", display:"block", opacity:0.85 }}>{Math.round(kcal)}</span> : null}
          </div>
        );
      }
      blocks.push(
        <div key={`${y}-${m}`} style={{ padding:"4px 6px 2px" }}>
          <div style={{ fontSize:"10px", fontWeight:"bold", color:"#1F4E79", textAlign:"center",
            padding:"3px 0", borderBottom:"1px solid #D6E4F0", marginBottom:"2px",
            background: m === calMonth && y === calYear ? "#EBF3FB" : "transparent",
            borderRadius:"3px 3px 0 0" }}>{label}</div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"1px" }}>{cells}</div>
        </div>
      );
    }
    return blocks;
  };

  // ── Day totals for current day ──
  const totals = getDayTotals(currentDayData);
  const BMR = calcSex === "m" ? 10*calcWeight + 6.25*calcHeight - 5*calcAge + 5 : 10*calcWeight + 6.25*calcHeight - 5*calcAge - 161;
  let activeTierIdx = 0;
  if (totals.exerciseBurned > 300) activeTierIdx = 3;
  else if (totals.exerciseBurned > 150) activeTierIdx = 2;
  else if (totals.exerciseBurned > 0) activeTierIdx = 1;
  const activeTier = ACTIVITY_LEVELS[activeTierIdx];
  const tdee = Math.round(BMR * activeTier.factor);
  const macroTgt = calcMacros(tdee, calcWeight, calcProtein, calcFatPct/100);

  // ── Recipe modal ──
  const RecipeModal = ({ recipe, onClose }) => recipe ? (
    <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:"10px", width:"600px", maxWidth:"95vw", maxHeight:"88vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ background:"#1F4E79", color:"#fff", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", position:"sticky", top:0, zIndex:1, borderRadius:"10px 10px 0 0" }}>
          <div><div style={{ fontSize:"17px", fontWeight:"bold" }}>{recipe.name}</div><div style={{ fontSize:"12px", opacity:0.7, marginTop:"3px" }}>{recipe.source}</div></div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#fff", fontSize:"24px", cursor:"pointer", lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:"18px 20px" }}>
          <p style={{ color:"#6B8CAE", fontSize:"13px", marginBottom:"10px", lineHeight:1.5 }}>{recipe.description}</p>
          <div style={{ display:"flex", gap:"7px", flexWrap:"wrap", marginBottom:"10px" }}>
            {recipe.prep_time && <span style={{ background:"#D6E4F0", color:"#1F4E79", borderRadius:"20px", padding:"3px 11px", fontSize:"12px", fontWeight:"bold" }}>⏱ Prep: {recipe.prep_time}</span>}
            {recipe.cook_time && <span style={{ background:"#D6E4F0", color:"#1F4E79", borderRadius:"20px", padding:"3px 11px", fontSize:"12px", fontWeight:"bold" }}>🍳 Cook: {recipe.cook_time}</span>}
            {recipe.servings && <span style={{ background:"#D6E4F0", color:"#1F4E79", borderRadius:"20px", padding:"3px 11px", fontSize:"12px", fontWeight:"bold" }}>🍽 Serves: {recipe.servings}</span>}
          </div>
          {recipe.nutrition && (
            <>
              <div style={{ fontWeight:"bold", color:"#2E75B6", fontSize:"12px", textTransform:"uppercase", letterSpacing:"0.5px", margin:"14px 0 7px" }}>Nutrition per Serving</div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:"5px", marginBottom:"14px" }}>
                {[["kcal","kcal"],["fat","Fat g"],["carbs","Carbs g"],["fibre","Fibre g"],["net_carbs","Net C g"],["protein","Prot g"]].map(([k,l]) => (
                  <div key={k} style={{ textAlign:"center", background:"#D6E4F0", borderRadius:"5px", padding:"5px" }}>
                    <div style={{ fontWeight:"bold", color:"#1F4E79", fontSize:"14px" }}>{recipe.nutrition[k]||0}</div>
                    <div style={{ fontSize:"10px", color:"#6B8CAE" }}>{l}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ fontWeight:"bold", color:"#2E75B6", fontSize:"12px", textTransform:"uppercase", letterSpacing:"0.5px", margin:"14px 0 7px" }}>Ingredients</div>
          <ul style={{ listStyle:"none", padding:0 }}>
            {recipe.ingredients?.map((ing,i) => (
              <li key={i} style={{ padding:"4px 0", borderBottom:"1px solid #DDEAF6", display:"flex", gap:"10px", fontSize:"13px" }}>
                <span style={{ fontWeight:"bold", color:"#1F4E79", minWidth:"65px" }}>{ing.amount}</span>
                <span>{ing.item}</span>
              </li>
            ))}
          </ul>
          <div style={{ fontWeight:"bold", color:"#2E75B6", fontSize:"12px", textTransform:"uppercase", letterSpacing:"0.5px", margin:"14px 0 7px" }}>Method</div>
          <ol style={{ paddingLeft:0, listStyle:"none", counterReset:"steps" }}>
            {recipe.steps?.map((s,i) => (
              <li key={i} style={{ counterIncrement:"steps", padding:"6px 0 6px 34px", borderBottom:"1px solid #DDEAF6", fontSize:"13px", lineHeight:1.5, position:"relative" }}>
                <span style={{ position:"absolute", left:0, top:6, background:"#2E75B6", color:"#fff", width:"20px", height:"20px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px", fontWeight:"bold" }}>{i+1}</span>
                {s}
              </li>
            ))}
          </ol>
          {recipe.notes && <div style={{ background:"#FFF8E1", borderLeft:"3px solid #F57F17", padding:"9px 12px", borderRadius:"0 4px 4px 0", fontSize:"13px", lineHeight:1.5, color:"#5D4037", marginTop:"14px" }}>{recipe.notes}</div>}
        </div>
      </div>
    </div>
  ) : null;

  // ── Styles ──
  const S = {
    wrap:{ fontFamily:"Arial,sans-serif", background:"#F0F4F8", color:"#1a2a3a", fontSize:"14px", height:"calc(100vh - 110px)", display:"flex", flexDirection:"column", borderRadius:"12px", overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,0.2)" },
    header:{ background:"#1F4E79", color:"#fff", padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between", height:"48px", flexShrink:0 },
    body:{ display:"flex", flex:1, overflow:"hidden" },
    sidebar:{ width:"230px", flexShrink:0, background:"#fff", borderRight:"1px solid #DDEAF6", display:"flex", flexDirection:"column", overflow:"hidden" },
    sidebarHead:{ background:"#1F4E79", color:"#fff", padding:"10px 14px", fontWeight:"bold", fontSize:"12px" },
    main:{ flex:1, overflowY:"auto", padding:"16px", background:"#F0F4F8" },
    tab:(active) => ({ flex:1, padding:"8px", textAlign:"center", cursor:"pointer", fontSize:"12px", fontWeight:"bold", color:active?"#1F4E79":"#6B8CAE", borderBottom:active?"2px solid #2E75B6":"2px solid transparent", background:active?"rgba(214,228,240,0.3)":"none", border:"none", transition:"all 0.2s" }),
    btn:(variant) => ({
      primary:{ background:"#2E75B6", color:"#fff", border:"none", borderRadius:"4px", padding:"7px 13px", cursor:"pointer", fontSize:"12px", fontWeight:"bold" },
      success:{ background:"#2E7D32", color:"#fff", border:"none", borderRadius:"4px", padding:"7px 13px", cursor:"pointer", fontSize:"12px", fontWeight:"bold" },
      outline:{ background:"transparent", color:"#2E75B6", border:"1px solid #2E75B6", borderRadius:"4px", padding:"7px 13px", cursor:"pointer", fontSize:"12px", fontWeight:"bold" },
      sm:{ padding:"3px 9px", fontSize:"11px" },
    }[variant] || {}),
  };

  if (loading) return <div style={{ padding:"40px", textAlign:"center", color:"#6B8CAE" }}>Loading your nutrition log…</div>;

  return (
    <div style={S.wrap}>
      <RecipeModal recipe={recipeModal} onClose={() => setRecipeModal(null)} />

      {/* Header */}
      <div style={S.header}>
        <span style={{ fontSize:"16px", fontWeight:"bold" }}>🥗 Nutrition Tracker</span>
        <div style={{ display:"flex", gap:"4px" }}>
          {[["log","Daily Log"],["compare","Compare"],["add","Add Entry"],["chat","🤖 Claude"]].map(([id,label]) => (
            <button key={id} onClick={() => setActiveTab(id)}
              style={{ background: activeTab===id?"#2E75B6":"transparent", border:"1px solid rgba(255,255,255,0.3)", color:"#fff", padding:"5px 12px", borderRadius:"4px", cursor:"pointer", fontSize:"12px", transition:"background 0.2s" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={S.body}>
        {/* Sidebar — only for log, compare, add tabs */}
        {activeTab !== "chat" && (
          <div style={S.sidebar}>
            <div style={S.sidebarHead}>📅 Calendar</div>
            <div style={{ flex:1, overflowY:"auto", padding:"0" }}>{renderCalendar()}</div>
          </div>
        )}

        {/* ── LOG TAB ── */}
        {activeTab === "log" && (
          <div style={S.main}>
            {!currentDayData ? (
              <div style={{ textAlign:"center", color:"#6B8CAE", padding:"40px" }}>Select or create a day to get started</div>
            ) : (
              <>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
                  <div style={{ fontSize:"18px", fontWeight:"bold", color:"#1F4E79" }}>{formatDate(currentDate)}</div>
                  <div style={{ display:"flex", gap:"4px" }}>
                    <button onClick={() => { const idx=allDays.findIndex(d=>d.date===currentDate); if(idx<allDays.length-1) switchDay(allDays[idx+1].date); }} style={{ background:"#1F4E79", color:"#fff", border:"none", borderRadius:"4px", padding:"5px 10px", cursor:"pointer", fontSize:"14px" }}>‹</button>
                    <button onClick={() => { const idx=allDays.findIndex(d=>d.date===currentDate); if(idx>0) switchDay(allDays[idx-1].date); }} style={{ background:"#1F4E79", color:"#fff", border:"none", borderRadius:"4px", padding:"5px 10px", cursor:"pointer", fontSize:"14px" }}>›</button>
                  </div>
                </div>

                {/* Grand total */}
                <div style={{ background:"#1F4E79", color:"#fff", borderRadius:"8px", padding:"12px 14px", marginBottom:"14px", overflowX:"auto" }}>
                  <div style={{ fontWeight:"bold", fontSize:"13px", marginBottom:"8px" }}>📊 Day Total</div>
                  <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"500px" }}>
                    <tbody>
                      <tr style={{ opacity:0.7, fontSize:"11px" }}>
                        <td></td>
                        {["Calories","Fat","Carbs","Sugar","Fibre","Net C","Protein"].map(h => <td key={h} style={{ textAlign:"right", padding:"2px 6px" }}>{h}</td>)}
                      </tr>
                      <tr>
                        <td style={{ fontSize:"12px", opacity:0.8, whiteSpace:"nowrap" }}>🍽 Intake</td>
                        <td style={{ textAlign:"right", padding:"3px 6px", fontWeight:"bold" }}>{fmt(totals.foodKcal)} kcal</td>
                        {[totals.fat,totals.carbs,totals.sugar,totals.fibre,totals.net_carbs,totals.protein].map((v,i) => <td key={i} style={{ textAlign:"right", padding:"3px 6px" }}>{fmt(v)}g</td>)}
                      </tr>
                      <tr>
                        <td style={{ fontSize:"12px", opacity:0.8, whiteSpace:"nowrap" }}>📉 vs {activeTier.label}</td>
                        {[
                          [tdee - totals.foodKcal, " kcal"],
                          [macroTgt.fat_g - totals.fat,"g"],
                          [macroTgt.carbs_g - totals.carbs,"g"],
                          [null,""],
                          [macroTgt.fibre_g - totals.fibre,"g"],
                          [null,""],
                          [macroTgt.protein_g - totals.protein,"g"],
                        ].map(([v,unit],i) => v === null
                          ? <td key={i} style={{ textAlign:"right", padding:"3px 6px", opacity:0.4 }}>—</td>
                          : <td key={i} style={{ textAlign:"right", padding:"3px 6px", fontWeight:"600", color: v>=0?"#81C784":"#EF9A9A" }}>{v>=0?"+":""}{fmt(v)}{unit}</td>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Meal cards */}
                {currentDayData.meals?.map(meal => {
                  const mKcal = meal.items?.reduce((s,i) => s+(i.kcal||0), 0) || 0;
                  const mFat = meal.items?.reduce((s,i) => s+(i.fat||0), 0) || 0;
                  const mCarbs = meal.items?.reduce((s,i) => s+(i.carbs||0), 0) || 0;
                  const mFibre = meal.items?.reduce((s,i) => s+(i.fibre||0), 0) || 0;
                  const mProtein = meal.items?.reduce((s,i) => s+(i.protein||0), 0) || 0;
                  return (
                    <div key={meal.id} style={{ background:"#fff", borderRadius:"8px", border:"1px solid #DDEAF6", marginBottom:"10px", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
                      <div style={{ padding:"8px 12px", fontWeight:"bold", fontSize:"12px", color:"#fff", background: meal.is_exercise?"#2E7D32":"#2E75B6", display:"flex", justifyContent:"space-between" }}>
                        <span>{meal.name}</span>
                        <span style={{ fontWeight:"normal", opacity:0.9, fontSize:"11px" }}>{mKcal !== 0 ? fmt(mKcal)+" kcal" : ""}</span>
                      </div>
                      {(!meal.items || meal.items.length === 0)
                        ? <div style={{ padding:"10px 12px", fontSize:"12px", color:"#6B8CAE", fontStyle:"italic" }}>No items logged yet</div>
                        : <div style={{ overflowX:"auto" }}>
                          <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed", minWidth:"480px" }}>
                            <colgroup><col style={{ width:"auto" }}/>{Array(7).fill(0).map((_,i)=><col key={i} style={{ width:"62px" }}/>)}<col style={{ width:"28px" }}/></colgroup>
                            <thead>
                              <tr style={{ background:"#D6E4F0" }}>
                                {["Item","kcal","Fat","Carbs","Sugar","Fibre","Net C","Prot",""].map(h => (
                                  <th key={h} style={{ color:"#1F4E79", fontSize:"10px", textTransform:"uppercase", letterSpacing:"0.3px", padding:"4px 8px", textAlign: h==="Item"?"left":"right" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {meal.items?.map(item => {
                                const recipe = userRecipes.find(r => r.name === item.recipe_name);
                                return (
                                  <tr key={item.id} style={{ background: meal.is_exercise?"#E8F5E9":"inherit" }}>
                                    <td style={{ padding:"5px 8px", fontSize:"12px", color: meal.is_exercise?"#2E7D32":"inherit", fontWeight: meal.is_exercise?"bold":"normal" }}>
                                      {recipe
                                        ? <span onClick={() => setRecipeModal(recipe)} style={{ color:"#2E75B6", cursor:"pointer", borderBottom:"1px dashed #2E75B6" }}>{item.name}</span>
                                        : item.name}
                                    </td>
                                    {[item.kcal,item.fat,item.carbs,item.sugar,item.fibre,item.net_carbs,item.protein].map((v,i) => (
                                      <td key={i} style={{ padding:"5px 8px", textAlign:"right", fontSize:"12px", color: meal.is_exercise?"#2E7D32":"inherit" }}>{fmt(v||0)}{i>0?"g":""}</td>
                                    ))}
                                    <td style={{ textAlign:"center" }}>
                                      <button onClick={() => { if(confirm("Remove this item?")) deleteItem(meal.id, item.id); }}
                                        style={{ background:"none", border:"none", color:"#c62828", cursor:"pointer", fontSize:"11px", padding:"0 3px", opacity:0.6 }}>✕</button>
                                    </td>
                                  </tr>
                                );
                              })}
                              <tr style={{ background:"#D6E4F0", fontWeight:"bold", fontSize:"11px", color:"#1F4E79", borderTop:"2px solid #DDEAF6" }}>
                                <td style={{ padding:"4px 8px" }}>Subtotal</td>
                                {[mKcal,mFat,mCarbs,mCarbs,mFibre,mCarbs,mProtein].map((_,i) => {
                                  const vals = [mKcal,mFat,mCarbs,meal.items?.reduce((s,it)=>s+(it.sugar||0),0),mFibre,meal.items?.reduce((s,it)=>s+(it.net_carbs||0),0),mProtein];
                                  return <td key={i} style={{ padding:"4px 8px", textAlign:"right" }}>{fmt(vals[i]||0)}{i>0?"g":""}</td>;
                                })}
                                <td/>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      }
                    </div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {/* ── COMPARE TAB ── */}
        {activeTab === "compare" && (
          <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
            <div style={{ flex:1, overflowY:"auto", padding:"16px" }}>
              <div style={{ marginBottom:"12px" }}>
                <div style={{ fontSize:"18px", fontWeight:"bold", color:"#1F4E79", marginBottom:"3px" }}>Compare Days</div>
                <p style={{ color:"#6B8CAE", fontSize:"12px" }}>Last 5 logged days — click a date to swap it</p>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"8px" }}>
                {compareSlots.map((date,idx) => {
                  const data = compareData[idx];
                  const t = getDayTotals(data);
                  return (
                    <div key={idx} style={{ background:"#fff", borderRadius:"8px", border:"1px solid #DDEAF6", overflow:"hidden" }}>
                      <div onClick={() => {
                        const newDate = prompt("Enter date (YYYY-MM-DD):", date || todayStr);
                        if (!newDate) return;
                        const found = allDays.find(d => d.date === newDate);
                        const newSlots = [...compareSlots]; newSlots[idx] = newDate;
                        const newData = [...compareData]; newData[idx] = found || null;
                        setCompareSlots(newSlots); setCompareData(newData);
                      }} style={{ background:"#1F4E79", padding:"7px 8px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"4px" }}>
                        <span style={{ fontSize:"11px", fontWeight:"bold", color:"#fff", textAlign:"center", lineHeight:1.3 }}>{date ? formatDateShort(date) : "— pick date —"}</span>
                        <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.6)" }}>▾</span>
                      </div>
                      <div style={{ padding:"8px 10px" }}>
                        {!data ? (
                          <div style={{ textAlign:"center", color:"#ddd", fontSize:"22px", fontWeight:"bold", padding:"8px 0 2px" }}>—</div>
                        ) : (
                          <>
                            <div style={{ fontSize:"22px", fontWeight:"bold", color:"#1F4E79", textAlign:"center", padding:"8px 0 2px", lineHeight:1 }}>{fmt(t.foodKcal)}</div>
                            <div style={{ fontSize:"10px", color:"#6B8CAE", textAlign:"center", marginBottom:"8px" }}>kcal</div>
                            {[["Fat",t.fat],["Carbs",t.carbs],["Net C",t.net_carbs],["Fibre",t.fibre],["Protein",t.protein],["Sugar",t.sugar]].map(([label,val]) => (
                              <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", borderBottom:"1px solid #DDEAF6", fontSize:"11px" }}>
                                <span style={{ color:"#6B8CAE" }}>{label}</span>
                                <span style={{ fontWeight:"bold", color:"#1F4E79" }}>{fmt(val)}g</span>
                              </div>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Reference Diet Calculator */}
            <div style={{ width:"280px", flexShrink:0, background:"#fff", borderLeft:"1px solid #DDEAF6", overflowY:"auto", padding:"14px" }}>
              <div style={{ fontSize:"13px", fontWeight:"bold", color:"#1F4E79", marginBottom:"10px", borderBottom:"2px solid #D6E4F0", paddingBottom:"6px" }}>🎯 Reference Diet Calculator</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"7px", marginBottom:"8px" }}>
                {[
                  ["Sex", <select value={calcSex} onChange={e=>setCalcSex(e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}><option value="m">Male</option><option value="f">Female</option></select>],
                  ["Age (yrs)", <input type="number" value={calcAge} onChange={e=>setCalcAge(+e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}/>],
                  ["Height (cm)", <input type="number" value={calcHeight} onChange={e=>setCalcHeight(+e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}/>],
                  ["Weight (kg)", <input type="number" value={calcWeight} onChange={e=>setCalcWeight(+e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}/>],
                ].map(([label, input]) => (
                  <div key={label}><div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:"2px" }}>{label}</div>{input}</div>
                ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:"7px", marginBottom:"10px" }}>
                <div>
                  <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:"2px" }}>Protein target</div>
                  <select value={calcProtein} onChange={e=>setCalcProtein(+e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}>
                    <option value="0.8">0.8g/kg (standard)</option><option value="1.2">1.2g/kg (active)</option>
                    <option value="1.4">1.4g/kg (60+ preserve)</option><option value="1.6">1.6g/kg (strength)</option>
                    <option value="2.0">2.0g/kg (performance)</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:"2px" }}>Fat % of calories</div>
                  <select value={calcFatPct} onChange={e=>setCalcFatPct(+e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}>
                    <option value="25">25%</option><option value="30">30%</option><option value="35">35%</option><option value="40">40%</option>
                  </select>
                </div>
              </div>
              <div style={{ fontSize:"11px", color:"#6B8CAE", textAlign:"center", marginBottom:"8px" }}>BMR <strong>{Math.round(BMR).toLocaleString()} kcal</strong> · Mifflin-St Jeor</div>
              <div style={{ background:"#D6E4F0", border:"1px solid #DDEAF6", borderRadius:"8px", padding:"8px 10px" }}>
                {ACTIVITY_LEVELS.map((lvl,i) => {
                  const td = Math.round(BMR * lvl.factor);
                  const m = calcMacros(td, calcWeight, calcProtein, calcFatPct/100);
                  return (
                    <div key={i} style={{ background: i===0?"#E3F2FD":"#D6E4F0", border:"1px solid #DDEAF6", borderRadius:"6px", padding:"5px 8px", marginBottom:"4px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div>
                        <div style={{ fontSize:"12px", fontWeight:"bold", color:"#1F4E79" }}>{lvl.label}</div>
                        <div style={{ fontSize:"9px", color:"#6B8CAE" }}>{lvl.desc}</div>
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:"12px", fontWeight:"bold", color:"#2E75B6" }}>{td.toLocaleString()} kcal</div>
                        <div style={{ fontSize:"9px", color:"#6B8CAE" }}>P:{m.protein_g}g F:{m.fat_g}g C:{m.carbs_g}g</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── ADD ENTRY TAB ── */}
        {activeTab === "add" && (
          <div style={{ ...S.main, display:"flex", gap:"14px", alignItems:"flex-start" }}>
            {/* ── LEFT: Food (65%) ── */}
            <div style={{ flex:"0 0 65%", minWidth:0 }}>
            <div style={{ fontSize:"16px", fontWeight:"bold", color:"#1F4E79", marginBottom:"12px" }}>🥗 Add Food Entry</div>
            <div style={{ background:"#fff", borderRadius:"8px", border:"1px solid #DDEAF6", padding:"14px", marginBottom:"12px" }}>
              <div style={{ fontWeight:"bold", color:"#1F4E79", marginBottom:"10px", fontSize:"13px" }}>Add Food Item</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"10px" }}>
                <div>
                  <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"2px" }}>Day</div>
                  <input type="date" value={addDate} onChange={e=>setAddDate(e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}/>
                </div>
                <div>
                  <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"2px" }}>Meal</div>
                  <select value={addMealId} onChange={e=>setAddMealId(e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}>
                    <option value="">— select —</option>
                    {(() => {
                      const existing = allDays.find(d=>d.date===addDate);
                      const meals = existing ? existing.meals : DEFAULT_MEAL_SLOTS;
                      return meals.map((m,i) => (
                        <option key={m.id||i} value={m.id || ("__slot__"+m.name)}>{m.name}</option>
                      ));
                    })()}
                  </select>
                </div>
              </div>
              <div style={{ marginBottom:"10px", position:"relative" }}>
                <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"2px" }}>Food Item Name</div>
                <input
                  ref={nameInputRef}
                  value={addItem.name}
                  onChange={e => {
                    const val = e.target.value;
                    setAddItem({...addItem, name:val});
                    if (val.length > 1) {
                      const q = val.toLowerCase();
                      const matches = userRecipes.filter(r => r.name.toLowerCase().includes(q));
                      setNameDropdown(matches);
                      setShowDropdown(matches.length > 0);
                    } else {
                      setShowDropdown(false);
                    }
                  }}
                  onBlur={async () => {
                    setTimeout(async () => {
                      setShowDropdown(false);
                      const name = addItem.name.trim();
                      if (!name) return;
                      const exact = userRecipes.find(r => r.name.toLowerCase() === name.toLowerCase());
                      if (exact) return;
                      const hasNutrition = addItem.kcal || addItem.fat || addItem.carbs || addItem.protein;
                      if (hasNutrition) return;

                      // Ask Claude to classify: single ingredient vs cooked dish
                      try {
                        const res = await fetch("/api/claude", {
                          method:"POST",
                          headers:{"Content-Type":"application/json"},
                          body: JSON.stringify({
                            model:"claude-sonnet-4-20250514", max_tokens:60,
                            messages:[{ role:"user", content:
                              `Is "${name}" a single whole-food ingredient (like an apple, grapes, chicken breast, milk) or a cooked/prepared dish (like baingan bharta, pasta carbonara, pinto bean stew)? Reply with exactly one word: INGREDIENT or DISH` }]
                          })
                        });
                        const data = await res.json();
                        const verdict = (data.content?.[0]?.text || "DISH").trim().toUpperCase();

                        if (verdict.includes("INGREDIENT")) {
                          // Show weight modal for single ingredient
                          setIngredientWeight("100");
                          setIngredientModal({ name });
                        } else {
                          // Cooked dish — open recipe builder
                          setBuilderInput(name);
                          setBuilderPreview(null);
                          setBuilderError("");
                          setRecipeBuilder(true);
                        }
                      } catch(e) {
                        // Fallback: open recipe builder
                        setBuilderInput(name);
                        setBuilderPreview(null);
                        setBuilderError("");
                        setRecipeBuilder(true);
                      }
                    }, 150);
                  }}
                  onFocus={() => {
                    if (nameDropdown.length > 0) setShowDropdown(true);
                  }}
                  placeholder="e.g. Pinto bean stew (1 portion)"
                  style={{ width:"100%", padding:"5px 9px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}
                />
                {/* Autocomplete dropdown */}
                {showDropdown && (
                  <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:"1px solid #DDEAF6", borderRadius:"0 0 6px 6px", boxShadow:"0 4px 12px rgba(0,0,0,0.1)", zIndex:100, maxHeight:"180px", overflowY:"auto" }}>
                    {nameDropdown.map(r => (
                      <div key={r.id}
                        onMouseDown={() => {
                          // Use nutrition from recipe (per serving)
                          const n = r.nutrition || {};
                          setAddItem({
                            name: r.name,
                            kcal: n.kcal || "", fat: n.fat || "", sat_fat: n.sat_fat || "",
                            carbs: n.carbs || "", sugar: n.sugar || "", fibre: n.fibre || "",
                            net_carbs: n.net_carbs || "", protein: n.protein || ""
                          });
                          setShowDropdown(false);
                        }}
                        style={{ padding:"8px 12px", cursor:"pointer", borderBottom:"1px solid #F0F4F8", fontSize:"12px" }}
                        onMouseOver={e=>e.currentTarget.style.background="#F0F4F8"}
                        onMouseOut={e=>e.currentTarget.style.background="#fff"}>
                        <div style={{ fontWeight:"bold", color:"#1F4E79" }}>{r.name}</div>
                        <div style={{ fontSize:"11px", color:"#6B8CAE" }}>{r.nutrition?.kcal} kcal · P:{r.nutrition?.protein}g F:{r.nutrition?.fat}g C:{r.nutrition?.carbs}g · per serving</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))", gap:"8px", marginBottom:"10px" }}>
                {[["kcal","kcal"],["fat","Fat (g)"],["sat_fat","Sat Fat (g)"],["carbs","Carbs (g)"],["sugar","Sugar (g)"],["fibre","Fibre (g)"],["net_carbs","Net Carbs (g)"],["protein","Protein (g)"]].map(([key,label]) => (
                  <div key={key}>
                    <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"2px" }}>{label}</div>
                    <input type="number" value={addItem[key]}
                      onChange={e => {
                        const updated = {...addItem, [key]: e.target.value};
                        if (key === "carbs" || key === "fibre") {
                          const c = key === "carbs" ? parseFloat(e.target.value)||0 : parseFloat(addItem.carbs)||0;
                          const f = key === "fibre" ? parseFloat(e.target.value)||0 : parseFloat(addItem.fibre)||0;
                          updated.net_carbs = Math.max(0, c - f).toFixed(1);
                        }
                        setAddItem(updated);
                      }}
                      placeholder="0" step="0.1"
                      style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px",
                        background: key==="net_carbs" ? "#F0F4F8" : "#fff" }}/>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end", alignItems:"center" }}>
                <button onClick={() => setAddItem({ name:"", kcal:"", fat:"", sat_fat:"", carbs:"", sugar:"", fibre:"", net_carbs:"", protein:"" })}
                  style={{ ...S.btn("outline"), ...S.btn("sm") }}>✕ Clear</button>
                <button onClick={submitAddItem} style={{ ...S.btn("success") }}>Add Item</button>
              </div>
              {addMsg && <div style={{ marginTop:"8px", padding:"7px 10px", borderRadius:"4px", fontSize:"12px", background:addMsg.ok?"#E8F5E9":"#FFEBEE", color:addMsg.ok?"#2E7D32":"#c62828" }}>{addMsg.text}</div>}
            </div>

            {/* Ingredient Weight Modal */}
            {ingredientModal && (
              <div onClick={e => e.target === e.currentTarget && setIngredientModal(null)}
                style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div style={{ background:"#fff", borderRadius:"12px", padding:"28px 32px", width:"340px", boxShadow:"0 8px 32px rgba(0,0,0,0.2)" }}>
                  <div style={{ fontSize:"16px", fontWeight:"bold", color:"#1F4E79", marginBottom:"6px" }}>🥗 {ingredientModal.name}</div>
                  <div style={{ fontSize:"12px", color:"#6B8CAE", marginBottom:"18px" }}>Looks like a single ingredient. Enter the weight and Claude will fill in the nutrition.</div>
                  <div style={{ marginBottom:"16px" }}>
                    <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"4px" }}>Weight (grams)</div>
                    <input
                      type="number" min="1" value={ingredientWeight}
                      onChange={e => setIngredientWeight(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") document.getElementById("ing-lookup-btn").click(); }}
                      autoFocus
                      style={{ width:"100%", padding:"8px 10px", border:"2px solid #2E75B6", borderRadius:"6px", fontSize:"14px", outline:"none" }}
                    />
                  </div>
                  {ingredientLoading && <div style={{ textAlign:"center", color:"#2E75B6", fontSize:"13px", marginBottom:"10px" }}>🤖 Looking up nutrition…</div>}
                  <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end" }}>
                    <button onClick={() => setIngredientModal(null)}
                      style={{ background:"transparent", color:"#6B8CAE", border:"1px solid #DDEAF6", borderRadius:"6px", padding:"8px 16px", cursor:"pointer", fontSize:"13px" }}>
                      Cancel
                    </button>
                    <button id="ing-lookup-btn"
                      disabled={ingredientLoading}
                      onClick={async () => {
                        const weight = parseFloat(ingredientWeight) || 100;
                        setIngredientLoading(true);
                        try {
                          const res = await fetch("/api/claude", {
                            method:"POST",
                            headers:{"Content-Type":"application/json"},
                            body: JSON.stringify({
                              model:"claude-sonnet-4-20250514", max_tokens:300,
                              messages:[{ role:"user", content:
                                `Give me the nutrition for ${weight}g of "${ingredientModal.name}". Reply with ONLY a JSON object, no markdown, no explanation:
{"kcal":0,"fat":0,"sat_fat":0,"carbs":0,"sugar":0,"fibre":0,"net_carbs":0,"protein":0}
Use realistic values per ${weight}g.` }]
                            })
                          });
                          const data = await res.json();
                          const text = (data.content?.[0]?.text || "{}").replace(/\`\`\`json|\`\`\`/g,"").trim();
                          const n = JSON.parse(text);
                          setAddItem({
                            name: `${ingredientModal.name} (${weight}g)`,
                            kcal: n.kcal ?? "", fat: n.fat ?? "", sat_fat: n.sat_fat ?? "",
                            carbs: n.carbs ?? "", sugar: n.sugar ?? "", fibre: n.fibre ?? "",
                            net_carbs: n.net_carbs ?? "", protein: n.protein ?? ""
                          });
                          setIngredientModal(null);
                        } catch(e) {
                          alert("Could not fetch nutrition. Please fill in manually.");
                          setIngredientModal(null);
                        } finally {
                          setIngredientLoading(false);
                        }
                      }}
                      style={{ background: ingredientLoading ? "#ccc" : "#2E75B6", color:"#fff", border:"none", borderRadius:"6px", padding:"8px 20px", cursor: ingredientLoading ? "not-allowed" : "pointer", fontSize:"13px", fontWeight:"bold" }}>
                      {ingredientLoading ? "…" : "Get Nutrition"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Recipe Builder Modal */}
            {recipeBuilder && (
              <div onClick={e => e.target === e.currentTarget && setRecipeBuilder(false)}
                style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div style={{ background:"#fff", borderRadius:"10px", width:"640px", maxWidth:"95vw", maxHeight:"88vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.3)" }}>
                  <div style={{ background:"#1F4E79", color:"#fff", padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", borderRadius:"10px 10px 0 0" }}>
                    <div style={{ fontSize:"15px", fontWeight:"bold" }}>🤖 Create Recipe with Claude</div>
                    <button onClick={() => { setRecipeBuilder(false); setBuilderPreview(null); setBuilderInput(""); setBuilderError(""); }}
                      style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>×</button>
                  </div>
                  <div style={{ padding:"18px" }}>
                    {!builderPreview ? (
                      <>
                        <p style={{ color:"#6B8CAE", fontSize:"13px", marginBottom:"12px", lineHeight:1.5 }}>
                          Describe your recipe in natural language — ingredients, quantities, cooking method, how many servings. Claude will generate the full recipe with nutrition per serving.
                        </p>
                        <textarea value={builderInput} onChange={e=>setBuilderInput(e.target.value)}
                          placeholder={"e.g. Pinto bean stew — 606g cooked pinto beans, 102g onion, 6 green chillies, 3 tbsp sesame oil, 200g chopped tomatoes, salt and hing. Sauté onion and chillies, add tomatoes, add beans, simmer 15 min. Makes 4 portions of ~225g each."}
                          style={{ width:"100%", minHeight:"120px", padding:"10px", border:"1px solid #DDEAF6", borderRadius:"6px", fontSize:"13px", fontFamily:"inherit", resize:"vertical", background:"#F0F4F8", boxSizing:"border-box" }}/>
                        {builderError && <div style={{ color:"#c62828", fontSize:"12px", marginTop:"6px" }}>{builderError}</div>}
                        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:"12px" }}>
                          <button disabled={builderLoading || !builderInput.trim()} onClick={async () => {
                            setBuilderLoading(true); setBuilderError("");
                            try {
                              const recipe = await claudeCreateRecipe(builderInput);
                              recipe.id = genId();
                              setBuilderPreview(recipe);
                            } catch(err) {
                              setBuilderError("Could not parse recipe. Try adding more detail about ingredients and quantities.");
                            }
                            setBuilderLoading(false);
                          }} style={{ background: builderLoading||!builderInput.trim() ? "#ccc":"#2E75B6", color:"#fff", border:"none", borderRadius:"4px", padding:"9px 18px", cursor: builderLoading||!builderInput.trim()?"not-allowed":"pointer", fontSize:"13px", fontWeight:"bold" }}>
                            {builderLoading ? "⏳ Generating…" : "Generate Recipe →"}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ background:"#E8F5E9", border:"1px solid #A5D6A7", borderRadius:"6px", padding:"10px 14px", marginBottom:"14px", fontSize:"13px", color:"#2E7D32" }}>
                          ✓ Recipe generated — review and save below
                        </div>
                        {/* Preview */}
                        <div style={{ marginBottom:"10px" }}>
                          <div style={{ fontWeight:"bold", fontSize:"16px", color:"#1F4E79", marginBottom:"2px" }}>{builderPreview.name}</div>
                          <div style={{ fontSize:"12px", color:"#6B8CAE", marginBottom:"8px" }}>{builderPreview.description}</div>
                          <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"10px" }}>
                            {builderPreview.servings && <span style={{ background:"#D6E4F0", color:"#1F4E79", borderRadius:"20px", padding:"2px 10px", fontSize:"11px", fontWeight:"bold" }}>🍽 Serves {builderPreview.servings}</span>}
                            {builderPreview.prep_time && <span style={{ background:"#D6E4F0", color:"#1F4E79", borderRadius:"20px", padding:"2px 10px", fontSize:"11px", fontWeight:"bold" }}>⏱ Prep: {builderPreview.prep_time}</span>}
                            {builderPreview.cook_time && <span style={{ background:"#D6E4F0", color:"#1F4E79", borderRadius:"20px", padding:"2px 10px", fontSize:"11px", fontWeight:"bold" }}>🍳 Cook: {builderPreview.cook_time}</span>}
                          </div>
                          {builderPreview.nutrition && (
                            <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:"4px", marginBottom:"12px" }}>
                              {[["kcal","kcal"],["fat","Fat"],["sat_fat","Sat F"],["carbs","Carbs"],["sugar","Sugar"],["fibre","Fibre"],["net_carbs","Net C"],["protein","Prot"]].map(([k,l]) => (
                                <div key={k} style={{ textAlign:"center", background:"#D6E4F0", borderRadius:"4px", padding:"4px 2px" }}>
                                  <div style={{ fontWeight:"bold", color:"#1F4E79", fontSize:"13px" }}>{builderPreview.nutrition[k]||0}</div>
                                  <div style={{ fontSize:"9px", color:"#6B8CAE" }}>{l}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{ fontWeight:"bold", color:"#2E75B6", fontSize:"11px", textTransform:"uppercase", marginBottom:"4px" }}>Ingredients</div>
                          <ul style={{ listStyle:"none", padding:0, marginBottom:"10px" }}>
                            {builderPreview.ingredients?.map((ing,i) => (
                              <li key={i} style={{ padding:"3px 0", borderBottom:"1px solid #F0F4F8", display:"flex", gap:"10px", fontSize:"12px" }}>
                                <span style={{ fontWeight:"bold", color:"#1F4E79", minWidth:"60px" }}>{ing.amount}</span>
                                <span>{ing.item}</span>
                              </li>
                            ))}
                          </ul>
                          <div style={{ fontWeight:"bold", color:"#2E75B6", fontSize:"11px", textTransform:"uppercase", marginBottom:"4px" }}>Method</div>
                          <ol style={{ paddingLeft:"20px", marginBottom:"10px" }}>
                            {builderPreview.steps?.map((s,i) => <li key={i} style={{ fontSize:"12px", padding:"3px 0", lineHeight:1.5 }}>{s}</li>)}
                          </ol>
                          {builderPreview.notes && <div style={{ background:"#FFF8E1", borderLeft:"3px solid #F57F17", padding:"8px 12px", borderRadius:"0 4px 4px 0", fontSize:"12px", color:"#5D4037" }}>{builderPreview.notes}</div>}
                        </div>
                        <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end", marginTop:"14px", borderTop:"1px solid #DDEAF6", paddingTop:"14px" }}>
                          <button onClick={() => setBuilderPreview(null)} style={{ background:"transparent", color:"#2E75B6", border:"1px solid #2E75B6", borderRadius:"4px", padding:"8px 14px", cursor:"pointer", fontSize:"12px", fontWeight:"bold" }}>
                            ← Regenerate
                          </button>
                          <button onClick={async () => {
                            await saveRecipe(userId, builderPreview);
                            setUserRecipes(prev => [...prev, builderPreview].sort((a,b)=>a.name.localeCompare(b.name)));
                            // Auto-fill the add item form with the saved recipe nutrition
                            const n = builderPreview.nutrition || {};
                            setAddItem({
                              name: builderPreview.name,
                              kcal: n.kcal || "", fat: n.fat || "", sat_fat: n.sat_fat || "",
                              carbs: n.carbs || "", sugar: n.sugar || "", fibre: n.fibre || "",
                              net_carbs: n.net_carbs || "", protein: n.protein || ""
                            });
                            setRecipeBuilder(false);
                            setBuilderPreview(null);
                            setBuilderInput("");
                          }} style={{ background:"#2E7D32", color:"#fff", border:"none", borderRadius:"4px", padding:"8px 18px", cursor:"pointer", fontSize:"13px", fontWeight:"bold" }}>
                            ✓ Save Recipe
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Recipe action buttons */}
            <div style={{ display:"flex", gap:"10px", marginBottom:"0" }}>
              <button onClick={() => setShowRecipesModal(true)}
                style={{ flex:1, background:"#2E75B6", color:"#fff", border:"none", borderRadius:"8px",
                  padding:"10px", fontSize:"13px", fontWeight:"bold", cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                📖 Browse Saved Recipes
              </button>
              <button onClick={() => { setRecipeBuilder(true); setBuilderPreview(null); setBuilderInput(""); setBuilderError(""); }}
                style={{ flex:1, background:"#1F4E79", color:"#fff", border:"none", borderRadius:"8px",
                  padding:"10px", fontSize:"13px", fontWeight:"bold", cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                🤖 Create with Claude
              </button>
            </div>

            {/* Recipes picker modal */}
            {showRecipesModal && (
              <div onClick={e => e.target===e.currentTarget && setShowRecipesModal(false)}
                style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div style={{ background:"#fff", borderRadius:"12px", width:"520px", maxWidth:"95vw", maxHeight:"88vh", display:"flex", flexDirection:"column", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
                  <div style={{ background:"#1F4E79", color:"#fff", padding:"14px 18px", borderRadius:"12px 12px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
                    <div style={{ fontWeight:"bold", fontSize:"15px" }}>📖 Saved Recipes</div>
                    <button onClick={() => setShowRecipesModal(false)}
                      style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>×</button>
                  </div>
                  <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
                    {userRecipes.length === 0 ? (
                      <div style={{ textAlign:"center", padding:"30px", color:"#6B8CAE", fontSize:"13px" }}>
                        No saved recipes yet. Use "Create with Claude" to build your first recipe.
                      </div>
                    ) : userRecipes.map(r => (
                      <div key={r.id}
                        style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                          padding:"10px 12px", borderBottom:"1px solid #DDEAF6", borderRadius:"6px", transition:"background 0.15s" }}
                        onMouseOver={e=>e.currentTarget.style.background="#F0F4F8"}
                        onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{ flex:1, cursor:"pointer" }} onClick={() => {
                          const n = r.nutrition || {};
                          setAddItem({ name:r.name, kcal:n.kcal||"", fat:n.fat||"", sat_fat:n.sat_fat||"",
                            carbs:n.carbs||"", sugar:n.sugar||"", fibre:n.fibre||"",
                            net_carbs:n.net_carbs||"", protein:n.protein||"" });
                          setShowRecipesModal(false);
                        }}>
                          <div style={{ fontWeight:"bold", fontSize:"13px", color:"#1F4E79" }}>{r.name}</div>
                          <div style={{ fontSize:"11px", color:"#6B8CAE" }}>{r.description}</div>
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginLeft:"12px" }}>
                          <div style={{ fontSize:"12px", color:"#2E75B6", fontWeight:"bold", whiteSpace:"nowrap" }}>{r.nutrition?.kcal} kcal</div>
                          <button onClick={e => { e.stopPropagation(); setRecipeModal(r); }}
                            style={{ background:"none", border:"none", color:"#2E75B6", cursor:"pointer", fontSize:"11px", padding:"0 3px" }}>👁</button>
                          <button onClick={async e => {
                              e.stopPropagation();
                              if (!confirm("Delete this recipe?")) return;
                              await deleteRecipe(userId, r.id);
                              setUserRecipes(prev => prev.filter(ur => ur.id !== r.id));
                            }} style={{ background:"none", border:"none", color:"#c62828", cursor:"pointer", fontSize:"11px", opacity:0.5, padding:"0 3px" }}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            </div>{/* end left col */}

            {/* ── RIGHT: Exercise (35%) ── */}
            <div style={{ flex:"0 0 35%", minWidth:0 }}>
              <div style={{ fontSize:"16px", fontWeight:"bold", color:"#1F4E79", marginBottom:"12px" }}>🏋️ Exercise</div>

              {/* Manual log button */}
              <button onClick={() => { setShowExModal(true); setExSearch(""); setExSelected(null); setExResult(null); setExMsg(null); }}
                style={{ width:"100%", background:"#2E75B6", color:"#fff", border:"none", borderRadius:"8px",
                  padding:"10px", fontSize:"13px", fontWeight:"bold", cursor:"pointer", marginBottom:"14px",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
                🏋️ Log Manual Exercise
              </button>

              {/* ── Polar Sessions panel ── */}
              <div style={{ background:"#fff", borderRadius:"8px", border:"1px solid #DDEAF6", overflow:"hidden" }}>
                <div style={{ background:"#1F4E79", padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ color:"#fff", fontWeight:"bold", fontSize:"13px", display:"flex", alignItems:"center", gap:"6px" }}>
                    <span style={{ fontSize:"16px" }}>📡</span> Polar Sessions
                  </div>
                  {polarConnected && (
                    <div style={{ fontSize:"10px", color:"#90CAF9", display:"flex", alignItems:"center", gap:"4px" }}>
                      <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#4CAF50", display:"inline-block" }}/>
                      Connected
                    </div>
                  )}
                </div>

                <div style={{ padding:"12px" }}>
                  {!polarConnected ? (
                    /* ── Not connected ── */
                    <div style={{ textAlign:"center", padding:"16px 8px" }}>
                      <div style={{ fontSize:"32px", marginBottom:"8px" }}>⌚</div>
                      <div style={{ fontSize:"13px", fontWeight:"bold", color:"#1F4E79", marginBottom:"6px" }}>Connect your Polar device</div>
                      <div style={{ fontSize:"11px", color:"#6B8CAE", marginBottom:"14px", lineHeight:1.5 }}>
                        Sync sessions automatically once your Polar device uploads to Polar Flow. Sessions appear here ready to log.
                      </div>
                      <button
                        onClick={() => alert("Polar OAuth integration coming soon! You'll be redirected to Polar Flow to authorise Vaulte.")}
                        style={{ background:"#D94032", color:"#fff", border:"none", borderRadius:"6px",
                          padding:"9px 18px", cursor:"pointer", fontSize:"12px", fontWeight:"bold" }}>
                        Connect Polar Account
                      </button>
                    </div>
                  ) : polarSessions.length === 0 ? (
                    /* ── Connected, no pending sessions ── */
                    <div style={{ textAlign:"center", padding:"16px 8px", color:"#6B8CAE" }}>
                      <div style={{ fontSize:"28px", marginBottom:"6px" }}>✅</div>
                      <div style={{ fontSize:"12px" }}>All sessions logged. New sessions will appear here after your next workout syncs.</div>
                    </div>
                  ) : (
                    /* ── Pending sessions list ── */
                    <div>
                      <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"8px" }}>
                        {polarSessions.length} unlogged session{polarSessions.length > 1 ? "s" : ""}
                      </div>
                      {polarSessions.map(s => {
                        const sport = s.sport ? s.sport.replace(/_/g," ").toLowerCase().replace(/\w/g,c=>c.toUpperCase()) : "Exercise";
                        const d = s.start_time ? new Date(s.start_time) : null;
                        const dateStr = d ? d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}) : s.date || "";
                        const timeStr = d ? d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "";
                        return (
                          <div key={s.id}
                            onClick={() => setPolarLogModal(s)}
                            style={{ padding:"10px 12px", borderRadius:"6px", border:"1px solid #DDEAF6",
                              marginBottom:"8px", cursor:"pointer", transition:"background 0.15s" }}
                            onMouseOver={e=>e.currentTarget.style.background="#F0F4F8"}
                            onMouseOut={e=>e.currentTarget.style.background="#fff"}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"4px" }}>
                              <div style={{ fontWeight:"bold", fontSize:"12px", color:"#1F4E79" }}>{sport}</div>
                              <div style={{ fontSize:"10px", color:"#6B8CAE" }}>{dateStr} {timeStr}</div>
                            </div>
                            <div style={{ display:"flex", gap:"10px", fontSize:"11px", color:"#2E75B6" }}>
                              <span>⏱ {Math.round((s.duration_min||0))} min</span>
                              <span>🔥 {s.calories} kcal</span>
                              {s.hr_avg && <span>❤️ {s.hr_avg} bpm avg</span>}
                              {s.fat_pct != null && <span>🧈 {s.fat_pct}% fat</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>{/* end right col */}

            {/* ── Exercise Picker Modal ── */}
            {showExModal && (
              <div onClick={e => e.target===e.currentTarget && setShowExModal(false)}
                style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div style={{ background:"#fff", borderRadius:"12px", width:"560px", maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
                  {/* Header */}
                  <div style={{ background:"#1F4E79", color:"#fff", padding:"14px 18px", borderRadius:"12px 12px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ fontWeight:"bold", fontSize:"15px" }}>🏋️ Log Exercise</div>
                    <button onClick={() => setShowExModal(false)}
                      style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>×</button>
                  </div>
                  <div style={{ padding:"18px" }}>
                    {/* Search */}
                    <div style={{ marginBottom:"10px" }}>
                      <input value={exSearch} onChange={e => setExSearch(e.target.value)} autoFocus
                        placeholder="Search exercise… e.g. cycling, yoga, running"
                        style={{ width:"100%", padding:"8px 12px", border:"2px solid #2E75B6", borderRadius:"6px", fontSize:"13px", boxSizing:"border-box", outline:"none" }}/>
                    </div>
                    {/* Exercise list */}
                    <div style={{ maxHeight:"200px", overflowY:"auto", border:"1px solid #DDEAF6", borderRadius:"6px", marginBottom:"12px" }}>
                      {EXERCISE_COMPENDIUM
                        .filter(ex => !exSearch || ex.name.toLowerCase().includes(exSearch.toLowerCase()) || ex.cat.toLowerCase().includes(exSearch.toLowerCase()))
                        .map(ex => (
                          <div key={ex.name} onClick={() => { setExSelected(ex); setExResult(null); }}
                            style={{ padding:"8px 12px", borderBottom:"1px solid #F0F4F8", cursor:"pointer", fontSize:"12px",
                              background: exSelected?.name === ex.name ? "#D6E4F0" : "transparent" }}>
                            <div style={{ fontWeight:"bold", color:"#1F4E79" }}>{ex.name}</div>
                            <div style={{ fontSize:"10px", color:"#6B8CAE" }}>{ex.cat} · MET {ex.met}</div>
                          </div>
                        ))}
                    </div>
                    {/* Inputs */}
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px", marginBottom:"12px" }}>
                      {[
                        ["Duration (min)", exDuration, setExDuration, "30"],
                        ["Avg HR (bpm)", exHRavg, setExHRavg, "optional"],
                        ["Max HR (bpm)", exHRmax, setExHRmax, `${220 - calcAge}`],
                      ].map(([label, val, setter, ph]) => (
                        <div key={label}>
                          <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"3px" }}>{label}</div>
                          <input type="number" value={val} onChange={e => { setter(e.target.value); setExResult(null); }}
                            placeholder={String(ph)}
                            style={{ width:"100%", padding:"6px 8px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px", boxSizing:"border-box" }}/>
                        </div>
                      ))}
                    </div>
                    {/* Calculate */}
                    <button disabled={!exSelected || !exDuration}
                      onClick={() => {
                        const met = exSelected.met;
                        const mins = parseFloat(exDuration) || 0;
                        const weight = calcWeight || 80;
                        const kcal = Math.round(met * weight * mins / 60);
                        const hrAvg = parseFloat(exHRavg);
                        const hrMax = parseFloat(exHRmax) || (220 - (calcAge || 40));
                        let fatPct, zone;
                        if (hrAvg && hrMax) {
                          const p = hrAvg / hrMax * 100;
                          if (p < 60) { fatPct=82; zone="Recovery (<60%)"; }
                          else if (p < 65) { fatPct=75; zone="Fat Burn (60–65%)"; }
                          else if (p < 70) { fatPct=67; zone="Fat Burn (65–70%)"; }
                          else if (p < 75) { fatPct=55; zone="Aerobic (70–75%)"; }
                          else if (p < 80) { fatPct=43; zone="Aerobic (75–80%)"; }
                          else if (p < 85) { fatPct=30; zone="Threshold (80–85%)"; }
                          else if (p < 90) { fatPct=20; zone="Threshold (85–90%)"; }
                          else { fatPct=8; zone="VO₂ Max (>90%)"; }
                        } else {
                          if (met<=3){fatPct=75;zone="Light";}
                          else if (met<=5){fatPct=60;zone="Moderate";}
                          else if (met<=8){fatPct=40;zone="Vigorous";}
                          else {fatPct=20;zone="Very Vigorous";}
                        }
                        const fatKcal = Math.round(kcal * fatPct / 100);
                        setExResult({ kcal, fatPct, fatKcal, fatGrams:Math.round(fatKcal/9), zone, mins, weight, met });
                      }}
                      style={{ width:"100%", background:!exSelected||!exDuration?"#ccc":"#2E75B6",
                        color:"#fff", border:"none", borderRadius:"6px", padding:"9px",
                        cursor:!exSelected||!exDuration?"not-allowed":"pointer", fontSize:"13px", fontWeight:"bold", marginBottom:"12px" }}>
                      Calculate
                    </button>
                    {/* Result */}
                    {exResult && (
                      <div style={{ background:"#F0F4F8", borderRadius:"8px", padding:"12px" }}>
                        <div style={{ fontWeight:"bold", color:"#1F4E79", fontSize:"13px", marginBottom:"8px" }}>
                          {exSelected.name} · {exResult.mins} min
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"10px" }}>
                          {[["🔥 Kcal Burned",`${exResult.kcal} kcal`],["❤️ HR Zone",exResult.zone],
                            ["🧈 Fat Burn %",`${exResult.fatPct}%`],["🧈 Fat Burned",`${exResult.fatGrams}g (${exResult.fatKcal} kcal)`]
                          ].map(([label,val]) => (
                            <div key={label} style={{ background:"#fff", borderRadius:"6px", padding:"7px 10px", border:"1px solid #DDEAF6" }}>
                              <div style={{ fontSize:"10px", color:"#6B8CAE", marginBottom:"2px" }}>{label}</div>
                              <div style={{ fontWeight:"bold", fontSize:"12px", color:"#1F4E79" }}>{val}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                          <select value={addMealId} onChange={e=>setAddMealId(e.target.value)}
                            style={{ flex:1, padding:"6px 8px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}>
                            <option value="">— select meal slot —</option>
                            {(() => {
                              const existing = allDays.find(d=>d.date===addDate);
                              const meals = existing ? existing.meals : DEFAULT_MEAL_SLOTS;
                              return meals.map((m,i) => (
                                <option key={m.id||i} value={m.id||("__slot__"+m.name)}>{m.name}</option>
                              ));
                            })()}
                          </select>
                          <button onClick={async () => {
                            let day = allDays.find(d=>d.date===addDate) || await loadDay(userId,addDate);
                            if (!day) day = { date:addDate, notes:"", meals:makeMeals() };
                            let targetMealId = addMealId;
                            if (targetMealId?.startsWith("__slot__")) {
                              const match = day.meals.find(m=>m.name===targetMealId.replace("__slot__",""));
                              targetMealId = match?.id || null;
                            }
                            if (!targetMealId) { setExMsg({ok:false,text:"Select a meal slot"}); return; }
                            const item = {
                              id:genId(), name:`${exSelected.name} (${exResult.mins} min)`,
                              kcal:-exResult.kcal, fat:0, sat_fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0,
                              is_exercise:1, fat_burned_g:exResult.fatGrams, fat_burned_kcal:exResult.fatKcal
                            };
                            const updated = {...day, meals:day.meals.map(m=>
                              m.id===targetMealId?{...m,items:[...m.items,item]}:m
                            )};
                            await persistDay(updated);
                            if (addDate===currentDate) setCurrentDayData(updated);
                            setShowExModal(false);
                            setExResult(null); setExSelected(null); setExSearch("");
                            setExDuration("30"); setExHRavg(""); setExHRmax("");
                          }} style={{ background:"#2E7D32", color:"#fff", border:"none", borderRadius:"6px",
                            padding:"8px 16px", cursor:"pointer", fontSize:"13px", fontWeight:"bold", whiteSpace:"nowrap" }}>
                            ✓ Log It
                          </button>
                        </div>
                        {exMsg && <div style={{ marginTop:"8px", padding:"6px 10px", borderRadius:"4px", fontSize:"12px",
                          background:exMsg.ok?"#E8F5E9":"#FFEBEE", color:exMsg.ok?"#2E7D32":"#c62828" }}>{exMsg.text}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Polar Session Log Modal ── */}
            {polarLogModal && (
              <div onClick={e => e.target===e.currentTarget && setPolarLogModal(null)}
                style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <div style={{ background:"#fff", borderRadius:"12px", width:"420px", maxWidth:"95vw", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
                  <div style={{ background:"#D94032", color:"#fff", padding:"14px 18px", borderRadius:"12px 12px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div style={{ fontWeight:"bold", fontSize:"15px" }}>📡 Log Polar Session</div>
                    <button onClick={() => setPolarLogModal(null)}
                      style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>×</button>
                  </div>
                  <div style={{ padding:"18px" }}>
                    {(() => {
                      const s = polarLogModal;
                      const sport = s.sport ? s.sport.replace(/_/g," ").toLowerCase().replace(/\w/g,c=>c.toUpperCase()) : "Exercise";
                      const d = s.start_time ? new Date(s.start_time) : null;
                      const dateStr = d ? d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"}) : s.date||"";
                      const timeStr = d ? d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "";
                      const sessionDate = s.start_time ? s.start_time.split("T")[0] : (s.date || addDate);
                      return (
                        <>
                          <div style={{ fontWeight:"bold", fontSize:"16px", color:"#1F4E79", marginBottom:"4px" }}>{sport}</div>
                          <div style={{ fontSize:"12px", color:"#6B8CAE", marginBottom:"14px" }}>{dateStr}{timeStr ? ` at ${timeStr}` : ""}</div>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"16px" }}>
                            {[
                              ["⏱ Duration", `${Math.round(s.duration_min||0)} min`],
                              ["🔥 Calories", `${s.calories} kcal`],
                              s.hr_avg ? ["❤️ Avg HR", `${s.hr_avg} bpm`] : null,
                              s.hr_max ? ["❤️ Max HR", `${s.hr_max} bpm`] : null,
                              s.fat_pct != null ? ["🧈 Fat Burn", `${s.fat_pct}%`] : null,
                              s.fat_pct != null ? ["🧈 Fat Burned", `${Math.round(s.calories * s.fat_pct / 100 / 9)}g`] : null,
                            ].filter(Boolean).map(([label,val]) => (
                              <div key={label} style={{ background:"#F0F4F8", borderRadius:"6px", padding:"8px 10px", border:"1px solid #DDEAF6" }}>
                                <div style={{ fontSize:"10px", color:"#6B8CAE", marginBottom:"2px" }}>{label}</div>
                                <div style={{ fontWeight:"bold", fontSize:"13px", color:"#1F4E79" }}>{val}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ marginBottom:"12px" }}>
                            <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"4px" }}>Log to meal slot</div>
                            <select value={addMealId} onChange={e=>setAddMealId(e.target.value)}
                              style={{ width:"100%", padding:"7px 10px", border:"1px solid #DDEAF6", borderRadius:"6px", fontSize:"12px" }}>
                              <option value="">— select slot —</option>
                              {(() => {
                                const existing = allDays.find(d=>d.date===sessionDate);
                                const meals = existing ? existing.meals : DEFAULT_MEAL_SLOTS;
                                return meals.map((m,i) => (
                                  <option key={m.id||i} value={m.id||("__slot__"+m.name)}>{m.name}</option>
                                ));
                              })()}
                            </select>
                          </div>
                          <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end" }}>
                            <button onClick={() => setPolarLogModal(null)}
                              style={{ background:"transparent", border:"1px solid #DDEAF6", color:"#6B8CAE", borderRadius:"6px", padding:"8px 16px", cursor:"pointer", fontSize:"13px" }}>
                              Cancel
                            </button>
                            <button onClick={async () => {
                              let day = allDays.find(d=>d.date===sessionDate) || await loadDay(userId,sessionDate);
                              if (!day) day = { date:sessionDate, notes:"", meals:makeMeals() };
                              let targetMealId = addMealId;
                              if (targetMealId?.startsWith("__slot__")) {
                                const match = day.meals.find(m=>m.name===targetMealId.replace("__slot__",""));
                                targetMealId = match?.id || null;
                              }
                              if (!targetMealId) return;
                              const fatGrams = s.fat_pct != null ? Math.round(s.calories * s.fat_pct / 100 / 9) : 0;
                              const fatKcal = s.fat_pct != null ? Math.round(s.calories * s.fat_pct / 100) : 0;
                              const item = {
                                id:genId(),
                                name:`${sport} (${Math.round(s.duration_min||0)} min) · Polar`,
                                kcal:-s.calories, fat:0, sat_fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0,
                                is_exercise:1, fat_burned_g:fatGrams, fat_burned_kcal:fatKcal,
                                polar_session_id:s.id
                              };
                              const updated = {...day, meals:day.meals.map(m=>
                                m.id===targetMealId?{...m,items:[...m.items,item]}:m
                              )};
                              await persistDay(updated);
                              if (sessionDate===currentDate) setCurrentDayData(updated);
                              // Mark session as logged in Firestore
                              await setDoc(doc(db,"users",userId,"polar_sessions",s.id), {...s, logged:true});
                              setPolarSessions(prev => prev.filter(ps => ps.id !== s.id));
                              setPolarLogModal(null);
                            }} style={{ background:"#D94032", color:"#fff", border:"none", borderRadius:"6px",
                              padding:"8px 20px", cursor:"pointer", fontSize:"13px", fontWeight:"bold" }}>
                              ✓ Log Session
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CHAT TAB ── */}
        {activeTab === "chat" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:"#F7FAFD" }}>
            {/* Meal bar */}
            <div style={{ padding:"8px 12px", background:"#D6E4F0", borderBottom:"1px solid #DDEAF6", display:"flex", alignItems:"center", gap:"8px", fontSize:"12px", flexShrink:0 }}>
              <input type="date" value={chatDate} onChange={e=>setChatDate(e.target.value)} style={{ fontSize:"12px", fontWeight:"600", color:"#1F4E79", border:"1px solid #DDEAF6", borderRadius:"6px", padding:"3px 7px", cursor:"pointer" }}/>
              <label style={{ color:"#1F4E79", fontWeight:"bold", whiteSpace:"nowrap" }}>Log to:</label>
              <select value={chatMealId} onChange={e=>setChatMealId(e.target.value)} style={{ flex:1, padding:"4px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px", background:"#fff" }}>
                <option value="__chat__">💬 Just Chat</option>
                {(allDays.find(d=>d.date===chatDate) || currentDayData)?.meals?.filter(m=>!m.is_exercise).map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            {/* Messages */}
            <div style={{ flex:1, overflowY:"auto", padding:"12px", display:"flex", flexDirection:"column", gap:"10px" }}>
              {chatMessages.length === 0 && (
                <div style={{ background:"#FFF8E1", color:"#5D4037", alignSelf:"center", border:"1px solid #FFE082", fontSize:"12px", borderRadius:"6px", padding:"10px 14px", textAlign:"center", maxWidth:"95%" }}>
                  👋 Select a mode above:<br/><br/>
                  <strong>💬 Just Chat</strong> — ask me anything about nutrition, recipes, or health<br/><br/>
                  <strong>Meal slots</strong> — describe what you ate and I'll calculate nutrition and log it
                </div>
              )}
              {chatMessages.map(msg => {
                if (msg.type === "user") return (
                  <div key={msg.id} style={{ background:"#2E75B6", color:"#fff", alignSelf:"flex-end", borderRadius:"10px 10px 3px 10px", padding:"9px 12px", fontSize:"13px", lineHeight:1.5, maxWidth:"80%" }}>{msg.text}</div>
                );
                if (msg.type === "error") return (
                  <div key={msg.id} style={{ background:"#FFEBEE", color:"#c62828", alignSelf:"center", border:"1px solid #FFCDD2", fontSize:"12px", borderRadius:"6px", padding:"8px 12px" }}>{msg.text}</div>
                );
                if (msg.type === "preview" && !msg.confirmed) {
                  const tKcal = msg.items.reduce((s,i)=>s+i.kcal,0);
                  const tFat = msg.items.reduce((s,i)=>s+i.fat,0);
                  const tCarbs = msg.items.reduce((s,i)=>s+i.carbs,0);
                  const tFibre = msg.items.reduce((s,i)=>s+i.fibre,0);
                  const tProt = msg.items.reduce((s,i)=>s+i.protein,0);
                  return (
                    <div key={msg.id} style={{ background:"#fff", border:"1px solid #DDEAF6", alignSelf:"flex-start", borderRadius:"10px 10px 10px 3px", padding:"10px 12px", fontSize:"13px", maxWidth:"90%", boxShadow:"0 1px 3px rgba(0,0,0,0.07)" }}>
                      <div style={{ fontSize:"11px", color:"#6B8CAE", marginBottom:"6px" }}>Adding to <strong>{msg.mealName}</strong>:</div>
                      <div style={{ overflowX:"auto" }}>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"11px", minWidth:"320px" }}>
                          <thead><tr style={{ background:"#D6E4F0" }}>
                            {["Item","kcal","Fat","Carbs","Fibre","Prot"].map(h => <th key={h} style={{ color:"#1F4E79", padding:"3px 6px", textAlign:h==="Item"?"left":"right", fontWeight:"bold" }}>{h}</th>)}
                          </tr></thead>
                          <tbody>
                            {msg.items.map((item,i) => (
                              <tr key={i} style={{ borderBottom:"1px solid #EEF4FA" }}>
                                <td style={{ padding:"3px 6px", maxWidth:"160px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.name}</td>
                                {[item.kcal,item.fat,item.carbs,item.fibre,item.protein].map((v,j) => <td key={j} style={{ padding:"3px 6px", textAlign:"right" }}>{fmt(v)}{j>0?"g":""}</td>)}
                              </tr>
                            ))}
                            <tr style={{ background:"#D6E4F0", fontWeight:"bold" }}>
                              <td style={{ padding:"3px 6px" }}>Total</td>
                              {[tKcal,tFat,tCarbs,tFibre,tProt].map((v,i) => <td key={i} style={{ padding:"3px 6px", textAlign:"right" }}>{fmt(v)}{i>0?"g":""}</td>)}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      <div style={{ display:"flex", gap:"6px", marginTop:"10px", justifyContent:"flex-end" }}>
                        <button onClick={() => setChatMessages(prev => prev.filter(m => m.id !== msg.id))} style={{ ...S.btn("outline"), ...S.btn("sm") }}>✕ Discard</button>
                        <button onClick={() => confirmLog(msg.id)} style={{ ...S.btn("success"), ...S.btn("sm") }}>✓ Log to {msg.mealName}</button>
                      </div>
                    </div>
                  );
                }
                if (msg.type === "preview" && msg.confirmed) return (
                  <div key={msg.id} style={{ alignSelf:"flex-start", fontSize:"12px", color:"#2E7D32", fontWeight:"bold" }}>✓ Logged {msg.items.length} item{msg.items.length!==1?"s":""}</div>
                );
                // claude text
                return (
                  <div key={msg.id} style={{ background:"#fff", color:"#1a2a3a", alignSelf:"flex-start", border:"1px solid #DDEAF6", borderRadius:"10px 10px 10px 3px", padding:"9px 12px", fontSize:"13px", lineHeight:1.5, maxWidth:"85%", boxShadow:"0 1px 3px rgba(0,0,0,0.07)" }}
                    dangerouslySetInnerHTML={{ __html: msg.text.replace(/\n/g,"<br/>") }} />
                );
              })}
              <div ref={chatBottomRef}/>
            </div>

            <div style={{ fontSize:"11px", color:"#6B8CAE", textAlign:"center", padding:"4px 12px", flexShrink:0 }}>
              {chatMealId === "__chat__" ? "General chat — ask about nutrition, recipes, or health" : "Describe food naturally — weights, quantities, brand names all work"}
            </div>
            <div style={{ padding:"10px", borderTop:"1px solid #DDEAF6", display:"flex", gap:"6px", flexShrink:0, background:"#fff" }}>
              <textarea value={chatInput} onChange={e=>setChatInput(e.target.value)}
                onKeyDown={e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendChat();} }}
                placeholder={chatMealId==="__chat__" ? "Ask me anything…" : "e.g. 30g walnuts, a slice of sourdough, 200ml Huel…"}
                style={{ flex:1, padding:"7px 10px", border:"1px solid #DDEAF6", borderRadius:"6px", fontSize:"13px", resize:"none", height:"56px", background:"#F0F4F8", fontFamily:"inherit" }}/>
              <button onClick={sendChat} disabled={chatLoading}
                style={{ background: chatLoading?"#ccc":"#2E75B6", color:"#fff", border:"none", borderRadius:"6px", padding:"0 14px", cursor:chatLoading?"not-allowed":"pointer", fontSize:"18px", fontWeight:"bold", transition:"opacity 0.2s", alignSelf:"stretch" }}>
                ➤
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
