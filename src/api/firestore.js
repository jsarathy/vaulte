// src/api/firestore.js — all Firestore read/write helpers
import { db } from "../firebase";
import { doc, setDoc, getDoc, getDocs, deleteDoc, collection } from "firebase/firestore";
import { genId } from "../constants/helpers";
import { INITIAL_RECIPES } from "../constants/recipes";
import { seedDays } from "../constants/seedDays";

const dayRef = (uid, date) => doc(db, "users", uid, "nutrition_days", date);
const recipeRef = (uid, id) => doc(db, "users", uid, "recipes", id);

export async function loadAllRecipes(uid) {
  try {
    const snap = await getDocs(collection(db, "users", uid, "recipes"));
    const recipes = [];
    snap.forEach((d) => recipes.push(d.data()));
    return recipes.sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) {
    console.error("loadAllRecipes error:", err);
    return [];
  }
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
    snap.forEach((d) => days.push(d.data()));
    return days.sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    console.error("loadAllDays error:", err);
    return [];
  }
}

export async function saveDay(uid, dayData) {
  await setDoc(dayRef(uid, dayData.date), dayData);
}

export async function loadDay(uid, date) {
  const snap = await getDoc(dayRef(uid, date));
  return snap.exists() ? snap.data() : null;
}

/** Write the example days and the starter recipes for a new account; the days, newest first. */
export async function seedInitialData(uid) {
  const days = seedDays(genId);
  for (const day of days) {
    await setDoc(dayRef(uid, day.date), day);
  }
  for (const recipe of INITIAL_RECIPES) {
    await setDoc(recipeRef(uid, recipe.id), recipe);
  }
  return days.sort((a, b) => b.date.localeCompare(a.date));
}
