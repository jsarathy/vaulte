// src/api/firestore.js — all Firestore read/write helpers
import { db } from "../firebase";
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection } from "firebase/firestore";
import { genId } from "../utils";
import { makeMeals } from "../constants/nutrition";
import { INITIAL_RECIPES } from "../constants/recipes";

const dayRef   = (uid, date) => doc(db, "users", uid, "nutrition_days", date);
const recipeRef = (uid, id)  => doc(db, "users", uid, "recipes", id);

export async function loadAllRecipes(uid) {
  try {
    const snap = await getDocs(collection(db, "users", uid, "recipes"));
    const recipes = [];
    snap.forEach(d => recipes.push(d.data()));
    return recipes.sort((a,b) => a.name.localeCompare(b.name));
  } catch(err) { console.error("loadAllRecipes error:", err); return []; }
}

export async function saveRecipe(uid, recipe) {
  await setDoc(recipeRef(uid, recipe.id), recipe);
}

export async function deleteRecipe(uid, id) {
  await deleteDoc(recipeRef(uid, id));
}

export async function loadAllDays(uid) {
  try {
    const snap = await getDocs(collection(db, "users", uid, "nutrition_days"));
    const days = [];
    snap.forEach(d => days.push(d.data()));
    return days.sort((a,b) => b.date.localeCompare(a.date));
  } catch (err) { console.error("loadAllDays error:", err); return []; }
}

export async function saveDay(uid, dayData) {
  await setDoc(dayRef(uid, dayData.date), dayData);
}

export async function loadDay(uid, date) {
  const snap = await getDoc(dayRef(uid, date));
  return snap.exists() ? snap.data() : null;
}

export async function seedInitialData(uid) {
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
        { id:g(), name:"Egg white omelet (100g egg white, 4g butter, 20g veg)", kcal:89, fat:3.6, sat_fat:2.1, carbs:1.5, sugar:0.8, fibre:0.5, net_carbs:1, protein:11.5 },
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
        { id:g(), name:"Nimbu pani (330ml soda, 0.5 lime, salt)", kcal:9, fat:0.1, sat_fat:0, carbs:2.6, sugar:0.8, fibre:0.7, net_carbs:1.9, protein:0.2 },
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
        { id:g(), name:"Huel RTD Strawberries & Cream 250ml", kcal:200, fat:9, sat_fat:2.5, carbs:17, sugar:0.75, fibre:3.6, net_carbs:13.4, protein:11 },
      ]},
      { id:g(), name:"🥗 Lunch", is_exercise:0, items:[
        { id:g(), name:"Egg white omelet (100g egg white, 4g butter, 20g veg)", kcal:89, fat:3.6, sat_fat:2.1, carbs:1.5, sugar:0.8, fibre:0.5, net_carbs:1, protein:11.5 },
        { id:g(), name:"Cucumber (85g)", kcal:13, fat:0.1, sat_fat:0, carbs:2.7, sugar:1.7, fibre:0.6, net_carbs:2.1, protein:0.7 },
        { id:g(), name:"Carrot (115g)", kcal:47, fat:0.2, sat_fat:0, carbs:11, sugar:5.4, fibre:3.2, net_carbs:7.8, protein:1 },
        { id:g(), name:"Strong Roots sweet potato hash brown x2", kcal:156, fat:7.8, sat_fat:0, carbs:18, sugar:1, fibre:2, net_carbs:16, protein:2.2 },
        { id:g(), name:"Jason's Ciabattin bread (1 slice)", kcal:111, fat:0.4, sat_fat:0.1, carbs:23, sugar:1.1, fibre:0.7, net_carbs:22.3, protein:5 },
        { id:g(), name:"Walnuts (30g)", kcal:196, fat:19.6, sat_fat:1.8, carbs:4, sugar:0.7, fibre:2, net_carbs:2, protein:4.6 },
      ]},
      { id:g(), name:"🍎 Snack", is_exercise:0, items:[] },
      { id:g(), name:"🌙 Dinner", is_exercise:0, items:[
        { id:g(), name:"El Paso flour tortillas x1.5", kcal:113, fat:2.6, sat_fat:0.9, carbs:20.3, sugar:1.2, fibre:1.2, net_carbs:19.1, protein:3.2 },
        { id:g(), name:"Pinto bean stew (1 portion)", kcal:338, fat:11, sat_fat:1.5, carbs:46, sugar:2, fibre:15, net_carbs:31, protein:15, recipe_name:"Pinto Bean Stew" },
        { id:g(), name:"Cotton candy grapes (125g)", kcal:77, fat:0.2, sat_fat:0, carbs:19, sugar:17, fibre:0.6, net_carbs:18.4, protein:0.8 },
      ]},
    ]},
  ];

  for (const day of days) {
    await setDoc(doc(db, "users", uid, "nutrition_days", day.date), day);
  }
  for (const recipe of INITIAL_RECIPES) {
    await setDoc(doc(db, "users", uid, "recipes", recipe.id), recipe);
  }
  return days.sort((a,b) => b.date.localeCompare(a.date));
}
