// tests/ui/harness/mocks.js — stands in for Firebase, src/api/firestore.js and
// src/api/claude.js in the UI test harness. No network, no real data.
// Tests read/drive it through window.__* (calls recorded, failures switchable).

// ── firebase / firebase/firestore ────────────────────────────────────────────
export const db = {};
export const auth = {};
export const doc = (...a) => ({ path: a.slice(1).join("/") });
// setDoc/getDoc: saves are recorded in window.__setDocs; reads come from window.__docs
// (keyed by path, e.g. "users/u/monthly_targets/2026-10"), which tests may seed first.
window.__docs = window.__docs || {};
window.__setDocs = [];
window.__failSetDoc = false;
// Like Firestore, an undefined field value is rejected
const hasUndefined = (v) =>
  v === undefined || (v !== null && typeof v === "object" && Object.values(v).some(hasUndefined));
export const setDoc = async (ref, data, opts) => {
  if (window.__failSetDoc) throw new Error("Mock setDoc failure");
  if (hasUndefined(data)) throw new Error("Unsupported field value: undefined");
  const saved = { path: ref.path, data: JSON.parse(JSON.stringify(data)) };
  window.__setDocs.push(opts?.merge ? { ...saved, merge: true } : saved);
};
// deleteDoc: paths recorded in window.__deletedDocs; window.__failDeleteDoc makes it throw
export const deleteDoc = async (ref) => {
  if (window.__failDeleteDoc) throw new Error("Mock deleteDoc failure");
  (window.__deletedDocs ||= []).push(ref.path);
};
// reads can be slowed per path (window.__getDocDelays) or made to fail (window.__failGetDoc)
export const getDoc = async (ref) => {
  (window.__getDocPaths ||= []).push(ref.path);
  const delay = window.__getDocDelays?.[ref.path];
  if (delay) await new Promise((res) => setTimeout(res, delay));
  if (window.__failGetDoc || window.__failPaths?.includes(ref.path))
    throw new Error("Mock getDoc failure");
  const d = window.__docs[ref.path];
  return { exists: () => d !== undefined, data: () => d ?? null };
};
// getDocs: window.__collections[path] (e.g. "users/u/weight_log") when a test sets it, else
// window.__polarDocs (Polar sessions); __polarDelay / __failGetDocs
export const getDocs = async (ref) => {
  await new Promise((res) => setTimeout(res, window.__polarDelay || 0));
  if (window.__failGetDocs) throw new Error("Mock getDocs failure");
  const own = window.__collections?.[ref?.path];
  const rows = own ?? (window.__polarDocs || []);
  // a collection's rows are stored as { id, ...fields }; data() gives the fields only
  const docs = rows.map(({ id, ...rest }) => ({ id, data: () => (own ? rest : { id, ...rest }) }));
  return { forEach: (f) => docs.forEach(f), docs, empty: docs.length === 0 };
};
export const collection = (...a) => ({ path: a.slice(1).join("/") });
export const orderBy = () => ({});
export const query = () => ({});
export const where = () => ({});
export const onSnapshot = (_r, cb) => {
  cb({ exists: () => false, data: () => null, forEach() {}, docs: [] });
  return () => {};
};

// ── src/api/firestore.js ─────────────────────────────────────────────────────
const day = (date, items, notes = "") => ({
  date,
  notes,
  meals: [{ id: "m" + date, name: "Breakfast", items }],
});
const DAYS = [
  day("2026-10-01", [{ id: "a", name: "Apple", kcal: 52, fat: 0, carbs: 14, protein: 0 }]), // food
  day("2026-10-02", []), // emptied
  day("2026-10-03", [], "Rest day"), // notes only
  day("2026-10-04", [{ id: "e", name: "Cycling (30 min)", kcal: -250, is_exercise: 1 }]), // exercise only
];
export const loadAllDays = async () => window.__days ?? DAYS; // __days: e.g. [] for a new user
export const seedInitialData = async () => window.__seedDays ?? window.__days ?? DAYS;
export const loadDay = async (_u, d) => DAYS.find((x) => x.date === d) || null;
// saveDay: days recorded in window.__savedDays; window.__saveDayDelay / __failSaveDay
export const saveDay = async (_u, day) => {
  if (window.__saveDayDelay) await new Promise((res) => setTimeout(res, window.__saveDayDelay));
  if (window.__failSaveDay) throw new Error("Mock saveDay failure");
  (window.__savedDays ||= []).push(JSON.parse(JSON.stringify(day)));
};
// loadAllRecipes: window.__recipes (the tracker harness); __failRecipes makes it throw
export const loadAllRecipes = async () => {
  if (window.__failRecipes) throw new Error("Mock recipes failure");
  return JSON.parse(JSON.stringify(window.__recipes || []));
};
window.__saved = [];
window.__deleted = [];
export const saveRecipe = async (_uid, r) => {
  window.__saved.push(JSON.parse(JSON.stringify(r)));
};
export const deleteRecipe = async (_u, id) => {
  window.__deleted.push(id);
};

// ── src/api/claude.js ────────────────────────────────────────────────────────
export const claudeParseFood = async () => [];
// claudeChat: calls recorded in window.__chatCalls; replies window.__chatReply
export const claudeChat = async (history) => {
  (window.__chatCalls ||= []).push(JSON.parse(JSON.stringify(history)));
  return window.__chatReply ?? "";
};
window.__recalc = [];
window.__failRecalc = false;
export const claudeRecalculateNutrition = async (r) => {
  window.__recalc.push(
    JSON.parse(JSON.stringify({ servings: r.servings, ingredients: r.ingredients })),
  );
  await new Promise((res) => setTimeout(res, 300));
  if (window.__failRecalc)
    throw new Error(window.__failRecalc === "blank" ? "" : "Mock recalc failure");
  const k = Math.round(1200 / (Number(r.servings) || 1) + 10 * r.ingredients.length);
  return {
    kcal: k,
    fat: 10,
    sat_fat: 2,
    carbs: 40,
    sugar: 5,
    fibre: 12,
    net_carbs: 28,
    protein: 20,
  };
};
window.__createArgs = [];
export const claudeCreateRecipe = async (d, names) => {
  window.__createArgs.push({ d, names });
  await new Promise((res) => setTimeout(res, window.__createDelay || 0));
  if (window.__failCreate) throw new Error(""); // no message → the builder's own text
  if (window.__createResult) return JSON.parse(JSON.stringify(window.__createResult));
  if (/pinto/i.test(d))
    return {
      id: "x",
      name: "Pinto Rice Bowl",
      description: "",
      source: "Home recipe",
      servings: 2,
      prep_time: "",
      cook_time: "",
      ingredients: [
        { amount: "250g", item: "Pinto Bean Stew" },
        { amount: "350g", item: "Cooked basmati rice" },
      ],
      steps: ["Mix"],
      notes: "",
      portion_g: 999,
      nutrition: {
        kcal: 1,
        fat: 1,
        sat_fat: 1,
        carbs: 1,
        sugar: 1,
        fibre: 1,
        net_carbs: 1,
        protein: 1,
      },
    };
  return {
    id: "x",
    name: "Test Dal",
    description: "d",
    source: "Home recipe",
    servings: 2,
    prep_time: "5",
    cook_time: "20",
    portion_g: 180.4,
    ingredients: [{ amount: "200g", item: "Red lentils" }],
    steps: ["Cook"],
    notes: "",
    nutrition: {
      kcal: 350,
      fat: 3,
      sat_fat: 0.5,
      carbs: 60,
      sugar: 2,
      fibre: 11,
      net_carbs: 49,
      protein: 24,
    },
  };
};
window.__scale = [];
window.__failScale = false;
export const claudeScaleRecipeNutrition = async (r, qty, unit) => {
  window.__scale.push({ id: r.id, qty, unit, portion_g: r.portion_g ?? null });
  await new Promise((res) => setTimeout(res, 200));
  if (window.__failScale) throw new Error("Mock scale failure");
  return {
    kcal: 123.456,
    fat: 4,
    sat_fat: 1,
    carbs: 10,
    sugar: 2,
    fibre: 3,
    net_carbs: 7,
    protein: 9,
  };
};
window.__est = [];
window.__estDelay = window.__noBackfill || window.__fastEst ? {} : { "Paneer Bhurji": 2500 };
export const claudeEstimatePortionWeight = async (r) => {
  window.__est.push(r.name);
  await new Promise((res) => setTimeout(res, window.__estDelay[r.name] ?? 120));
  if (r.name === "Nimbu Pani") throw new Error("Mock estimate failure");
  const total = r.ingredients.reduce(
    (s, i) => s + (parseFloat(String(i.amount).match(/^(\d+(\.\d+)?)g$/)?.[1]) || 100),
    0,
  );
  return { total_g: total, portion_g: total / (Number(r.servings) || 1) + 0.4 };
};
