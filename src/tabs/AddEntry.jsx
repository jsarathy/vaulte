// src/tabs/AddEntry.jsx
import { useState, useRef } from "react";
import { genId, makeMeals, DEFAULT_MEAL_SLOTS } from "../constants/helpers";
import { loadDay } from "../api/firestore";
import { normaliseImage, fileToBase64, fileToPreviewURL } from "../utils/imageUtils";
import { C, FONT } from "../constants/design.jsx";
import HourlyStepsCard from "../components/HourlyStepsCard";
import RecipePortionModal from "../components/RecipePortionModal";
import { useRecipePortion } from "../hooks/useRecipePortion";
import RecipeBuilderModal from "../components/RecipeBuilderModal";
import RecipeEditorForm from "../components/RecipeEditorForm";
import FoodLookupModal from "../components/FoodLookupModal";
import SavedRecipesModal from "../components/SavedRecipesModal";
import { useSavedRecipes } from "../hooks/useSavedRecipes";
import PolarSessionsPanel from "../components/PolarSessionsPanel";
import PolarBrowseModal from "../components/PolarBrowseModal";
import { usePolarBrowse } from "../hooks/usePolarBrowse";
import ExerciseLogModal from "../components/ExerciseLogModal";
import { useExerciseLog } from "../hooks/useExerciseLog";
import { mealSlotOptions } from "../lib/exerciseLog.js";
import { useFoodLookup } from "../hooks/useFoodLookup";
import { useRecipeBuilder } from "../hooks/useRecipeBuilder";

// Local style shorthand
const S = {
  main: { flex: 1, overflowY: "auto", padding: "14px 16px", background: "#f9fafb" },
  btn: (variant) =>
    ({
      primary: {
        background: C.blue,
        color: "#fff",
        border: "none",
        borderRadius: "5px",
        padding: "7px 13px",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: "500",
        fontFamily: FONT.sans,
      },
      success: {
        background: "#3B6D11",
        color: "#fff",
        border: "none",
        borderRadius: "5px",
        padding: "7px 13px",
        cursor: "pointer",
        fontSize: "12px",
        fontWeight: "500",
        fontFamily: FONT.sans,
      },
      outline: {
        background: "transparent",
        color: C.blueText,
        border: `0.5px solid ${C.blue}`,
        borderRadius: "5px",
        padding: "7px 13px",
        cursor: "pointer",
        fontSize: "12px",
        fontFamily: FONT.sans,
      },
      sm: { padding: "4px 9px", fontSize: "11px" },
    })[variant] || {},
};

export default function AddEntry({
  userId,
  allDays,
  currentDate,
  setCurrentDayData,
  userRecipes,
  setUserRecipes,
  addDate,
  setAddDate,
  addMealId,
  setAddMealId,
  addMealName,
  addItem,
  setAddItem,
  addMsg,
  setAddMsg,
  polarConnected,
  polarSessions,
  polarSyncing,
  polarLastSync,
  polarSyncMsg,
  syncPolar,
  setPolarLogModal,
  persistDay,
  setRecipeModal,
}) {
  const exercise = useExerciseLog({
    userId,
    allDays,
    addDate,
    currentDate,
    setCurrentDayData,
    persistDay,
  });
  const browse = usePolarBrowse(userId);
  const saved = useSavedRecipes({ userId, userRecipes, setUserRecipes });
  const builder = useRecipeBuilder({
    userId,
    userRecipes,
    setUserRecipes,
    setAddItem,
    setRecipeNotice: saved.setNotice,
    setShowRecipesModal: saved.setOpen,
  });
  // "Get Nutrition" box for a food that isn't a saved recipe
  const lookup = useFoodLookup({
    userId,
    userRecipes,
    setUserRecipes,
    setAddItem,
    addToDay: (item) => doSubmit(item),
    startRecipe: (name) => builder.startNew({ input: name }),
  });
  // ── Saved-recipe matching ──────────────────────────────────────────────────
  // Normalised exact match only: lowercase, trim, collapse internal whitespace.
  // Substring matching is deliberately NOT used here — "chicken curry" must not
  // silently resolve to "Thai Chicken Curry" and attach the wrong macros.
  // Partial names are served by the dropdown, where the user picks explicitly.
  const normName = (v) =>
    String(v ?? "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  const hasUsableMacros = (r) => {
    const n = r?.nutrition;
    if (!n) return false;
    return ["kcal", "protein", "fat", "carbs"].some((k) => Number(n[k]) > 0);
  };
  // Returns a saved recipe only if it matches exactly AND carries real macros;
  // a macro-less recipe falls through so generation can still fill the gap.
  const findSavedRecipe = (name) => {
    const q = normName(name);
    if (!q) return null;
    const hit = userRecipes.find((r) => normName(r.name) === q);
    return hit && hasUsableMacros(hit) ? hit : null;
  };
  // Recipe portion box — lets user scale macros before adding a saved recipe
  const portion = useRecipePortion();
  const openPortionModal = (recipe) => {
    setShowDropdown(false);
    portion.open(recipe);
  };
  const loadPortion = (item) => {
    setAddItem(item);
    portion.close();
    saved.setOpen(false);
  };

  const [nameDropdown, setNameDropdown] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const nameInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoItems, setPhotoItems] = useState([]);
  const [photoError, setPhotoError] = useState("");

  const handlePhotoLog = async (e) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setPhotoLoading(true);
    setPhotoError("");
    setPhotoItems([]);
    // Show immediate preview from original file while processing
    const previewURL = fileToPreviewURL(raw);
    setPhotoPreview(previewURL);
    try {
      const file = await normaliseImage(raw);
      const b64 = await fileToBase64(file);
      // Update preview to compressed version
      URL.revokeObjectURL(previewURL);
      setPhotoPreview(fileToPreviewURL(file));
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
                {
                  type: "text",
                  text: `Identify every food item visible in this photo and estimate realistic nutrition values.
Reply with ONLY a JSON array, no markdown, no explanation:
[{"name":"...","kcal":0,"fat":0,"sat_fat":0,"carbs":0,"sugar":0,"fibre":0,"net_carbs":0,"protein":0}]
Be specific with names (e.g. "Grilled chicken breast ~150g"). Round to 1 decimal place.`,
                },
              ],
            },
          ],
        }),
      });
      const data = await res.json();
      let raw2 = (data.content?.[0]?.text || "[]").trim();
      if (raw2.startsWith("```")) raw2 = raw2.split("```")[1]?.replace(/^json/, "").trim() || raw2;
      const items = JSON.parse(raw2);
      setPhotoItems(items);
    } catch (err) {
      setPhotoError("Could not analyse photo. Try a clearer image or add items manually.");
    } finally {
      setPhotoLoading(false);
      e.target.value = "";
    }
  };

  const submitAddItem = async () => {
    if (!addItem.name) {
      setAddMsg({ ok: false, text: "Please enter a food name" });
      return;
    }
    const hasNutrition = addItem.kcal || addItem.fat || addItem.carbs || addItem.protein;
    if (!hasNutrition) {
      // Open qty modal (user can switch to recipe builder from there if needed)
      const saved = findSavedRecipe(addItem.name);
      if (saved) {
        openPortionModal(saved);
        return;
      }
      lookup.open(addItem.name, { autoSubmit: true });
      return;
    }
    await doSubmit(addItem);
  };

  const doSubmit = async (item) => {
    let day = allDays.find((d) => d.date === addDate) || (await loadDay(userId, addDate));
    if (!day) {
      day = { date: addDate, notes: "", meals: makeMeals() };
    }
    let targetMealId = addMealId;
    if (targetMealId?.startsWith("__slot__")) {
      const match = day.meals.find((m) => m.name === targetMealId.replace("__slot__", ""));
      targetMealId = match?.id || null;
    }
    if (!targetMealId && addMealName) {
      const newMeal = { id: genId(), name: addMealName, is_exercise: 0, items: [] };
      day = { ...day, meals: [...day.meals, newMeal] };
      targetMealId = newMeal.id;
    }
    if (!targetMealId) {
      setAddMsg({ ok: false, text: "Please select or create a meal" });
      return;
    }
    const newItem = {
      id: genId(),
      name: item.name,
      kcal: parseFloat(item.kcal) || 0,
      fat: parseFloat(item.fat) || 0,
      sat_fat: parseFloat(item.sat_fat) || 0,
      carbs: parseFloat(item.carbs) || 0,
      sugar: parseFloat(item.sugar) || 0,
      fibre: parseFloat(item.fibre) || 0,
      net_carbs: parseFloat(item.net_carbs) || 0,
      protein: parseFloat(item.protein) || 0,
    };
    const updated = {
      ...day,
      meals: day.meals.map((m) =>
        m.id === targetMealId ? { ...m, items: [...(m.items || []), newItem] } : m,
      ),
    };
    await persistDay(updated);
    if (addDate === currentDate) setCurrentDayData(updated);
    setAddMsg({ ok: true, text: "✅ Item added!" });
    setAddItem({
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
    setTimeout(() => setAddMsg(null), 3000);
  };

  return (
    <div style={{ ...S.main, display: "flex", gap: "14px", alignItems: "flex-start" }}>
      {/* ── LEFT: Food (65%) ── */}
      <div style={{ flex: "0 0 65%", minWidth: 0 }}>
        <div
          style={{ fontSize: "16px", fontWeight: "bold", color: "#185FA5", marginBottom: "12px" }}
        >
          🥗 Add Food Entry
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: "8px",
            border: "0.5px solid #e5e7eb",
            padding: "14px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{ fontWeight: "bold", color: "#185FA5", marginBottom: "10px", fontSize: "13px" }}
          >
            Add Food Item
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "10px",
                  color: "#6b7280",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                Day
              </div>
              <input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "5px 7px",
                  border: "0.5px solid #e5e7eb",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              />
            </div>
            <div>
              <div
                style={{
                  fontSize: "10px",
                  color: "#6b7280",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                Meal
              </div>
              <select
                value={addMealId}
                onChange={(e) => setAddMealId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "5px 7px",
                  border: "0.5px solid #e5e7eb",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                <option value="">— select —</option>
                {(() => {
                  const existing = allDays.find((d) => d.date === addDate);
                  const meals = existing ? existing.meals : DEFAULT_MEAL_SLOTS;
                  return meals.map((m, i) => (
                    <option key={m.id || i} value={m.id || "__slot__" + m.name}>
                      {m.name}
                    </option>
                  ));
                })()}
              </select>
            </div>
          </div>

          {/* Food name with autocomplete */}
          <div style={{ marginBottom: "10px", position: "relative" }}>
            <div
              style={{
                fontSize: "10px",
                color: "#6b7280",
                textTransform: "uppercase",
                marginBottom: "2px",
              }}
            >
              Food Item Name
            </div>
            <input
              ref={nameInputRef}
              value={addItem.name}
              onChange={(e) => {
                const val = e.target.value;
                setAddItem({ ...addItem, name: val });
                if (val.length > 1) {
                  const q = normName(val);
                  const matches = userRecipes.filter((r) => normName(r.name).includes(q));
                  setNameDropdown(matches);
                  setShowDropdown(matches.length > 0);
                } else setShowDropdown(false);
              }}
              onBlur={() => {
                setTimeout(() => {
                  setShowDropdown(false);
                  // Skip if a box is already open — incl. a recipe just picked from the dropdown
                  if (lookup.isOpenRef.current || portion.isOpenRef.current) return;
                  const name = addItem.name.trim();
                  if (!name) return;
                  // If already has nutrition (filled from recipe dropdown), skip
                  const hasNutrition =
                    addItem.kcal || addItem.fat || addItem.carbs || addItem.protein;
                  if (hasNutrition) return;
                  // Already saved? Use it — no Claude call.
                  const saved = findSavedRecipe(name);
                  if (saved) {
                    openPortionModal(saved);
                    return;
                  }
                  // Otherwise open Get Nutrition at 1 portion. Ingredient/dish is decided on click.
                  lookup.open(name);
                }, 150);
              }}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const name = addItem.name.trim();
                if (!name) return;
                // Normalised exact match in saved recipes → open portion modal
                const saved = findSavedRecipe(name);
                if (saved) {
                  e.preventDefault();
                  openPortionModal(saved);
                }
                // If no match, onBlur opens the Get Nutrition box
              }}
              onFocus={() => {
                if (nameDropdown.length > 0) setShowDropdown(true);
              }}
              placeholder="e.g. Pinto bean stew (1 portion)"
              style={{
                width: "100%",
                padding: "5px 9px",
                border: "0.5px solid #e5e7eb",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            />
            {showDropdown && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  background: "#fff",
                  border: "0.5px solid #e5e7eb",
                  borderRadius: "0 0 6px 6px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  zIndex: 100,
                  maxHeight: "180px",
                  overflowY: "auto",
                }}
              >
                {nameDropdown.map((r) => (
                  <div
                    key={r.id}
                    onMouseDown={() => openPortionModal(r)}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid #F0F4F8",
                      fontSize: "12px",
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = "#F0F4F8")}
                    onMouseOut={(e) => (e.currentTarget.style.background = "#fff")}
                  >
                    <div style={{ fontWeight: "bold", color: "#185FA5" }}>{r.name}</div>
                    <div style={{ fontSize: "11px", color: "#6b7280" }}>
                      {r.nutrition?.kcal} kcal · P:{r.nutrition?.protein}g F:{r.nutrition?.fat}g C:
                      {r.nutrition?.carbs}g · tap to set portions
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Macro inputs */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))",
              gap: "8px",
              marginBottom: "10px",
            }}
          >
            {[
              ["kcal", "kcal"],
              ["fat", "Fat (g)"],
              ["sat_fat", "Sat Fat (g)"],
              ["carbs", "Carbs (g)"],
              ["sugar", "Sugar (g)"],
              ["fibre", "Fibre (g)"],
              ["net_carbs", "Net Carbs (g)"],
              ["protein", "Protein (g)"],
            ].map(([key, label]) => (
              <div key={key}>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#6b7280",
                    textTransform: "uppercase",
                    marginBottom: "2px",
                  }}
                >
                  {label}
                </div>
                <input
                  type="number"
                  value={addItem[key]}
                  onChange={(e) => {
                    const updated = { ...addItem, [key]: e.target.value };
                    if (key === "carbs" || key === "fibre") {
                      const c =
                        key === "carbs"
                          ? parseFloat(e.target.value) || 0
                          : parseFloat(addItem.carbs) || 0;
                      const f =
                        key === "fibre"
                          ? parseFloat(e.target.value) || 0
                          : parseFloat(addItem.fibre) || 0;
                      updated.net_carbs = Math.max(0, c - f).toFixed(1);
                    }
                    setAddItem(updated);
                  }}
                  placeholder="0"
                  step="0.1"
                  style={{
                    width: "100%",
                    padding: "5px 7px",
                    border: "0.5px solid #e5e7eb",
                    borderRadius: "4px",
                    fontSize: "12px",
                    background: key === "net_carbs" ? "#F0F4F8" : "#fff",
                  }}
                />
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "flex-end",
              alignItems: "center",
            }}
          >
            <button
              onClick={() =>
                setAddItem({
                  name: "",
                  kcal: "",
                  fat: "",
                  sat_fat: "",
                  carbs: "",
                  sugar: "",
                  fibre: "",
                  net_carbs: "",
                  protein: "",
                })
              }
              style={{ ...S.btn("outline"), ...S.btn("sm") }}
            >
              ✕ Clear
            </button>
            <button onClick={submitAddItem} style={S.btn("success")}>
              Add Item
            </button>
          </div>
          {addMsg && (
            <div
              style={{
                marginTop: "8px",
                padding: "7px 10px",
                borderRadius: "4px",
                fontSize: "12px",
                background: addMsg.ok ? "#E8F5E9" : "#FFEBEE",
                color: addMsg.ok ? "#2E7D32" : "#c62828",
              }}
            >
              {addMsg.text}
            </div>
          )}
        </div>

        {/* Photo Log */}
        <div
          style={{
            background: "#fff",
            borderRadius: "8px",
            border: "0.5px solid #e5e7eb",
            padding: "14px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{ fontWeight: "bold", color: "#185FA5", marginBottom: "10px", fontSize: "13px" }}
          >
            📸 Log from Photo
          </div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handlePhotoLog}
          />
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={photoLoading}
            style={{
              width: "100%",
              background: photoLoading ? "#ccc" : "#378ADD",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              padding: "9px",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: photoLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {photoLoading ? "⏳ Analysing…" : "📷 Take / Choose Photo"}
          </button>
          {photoError && (
            <div style={{ marginTop: "8px", color: "#c62828", fontSize: "12px" }}>{photoError}</div>
          )}
          {photoPreview && photoItems.length > 0 && (
            <div style={{ marginTop: "12px" }}>
              <img
                src={photoPreview}
                alt="food"
                style={{
                  width: "100%",
                  maxHeight: "160px",
                  objectFit: "cover",
                  borderRadius: "6px",
                  marginBottom: "10px",
                }}
              />
              <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "6px" }}>
                Claude identified {photoItems.length} item{photoItems.length !== 1 ? "s" : ""}. Tap
                to load into the form above, or log all at once.
              </div>
              {photoItems.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "6px 8px",
                    borderBottom: "1px solid #F0F4F8",
                    fontSize: "12px",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: "bold", color: "#185FA5" }}>{item.name}</div>
                    <div style={{ fontSize: "10px", color: "#6b7280" }}>
                      {item.kcal} kcal · P:{item.protein}g F:{item.fat}g C:{item.carbs}g
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setAddItem({
                        name: item.name,
                        kcal: item.kcal,
                        fat: item.fat,
                        sat_fat: item.sat_fat,
                        carbs: item.carbs,
                        sugar: item.sugar,
                        fibre: item.fibre,
                        net_carbs: item.net_carbs,
                        protein: item.protein,
                      })
                    }
                    style={{
                      background: "#E6F1FB",
                      border: "none",
                      color: "#185FA5",
                      borderRadius: "4px",
                      padding: "3px 8px",
                      fontSize: "11px",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    ↑ Load
                  </button>
                </div>
              ))}
              <button
                onClick={async () => {
                  let day =
                    allDays.find((d) => d.date === addDate) || (await loadDay(userId, addDate));
                  if (!day) day = { date: addDate, notes: "", meals: makeMeals() };
                  let targetMealId = addMealId;
                  if (targetMealId?.startsWith("__slot__")) {
                    const match = day.meals.find(
                      (m) => m.name === targetMealId.replace("__slot__", ""),
                    );
                    targetMealId = match?.id || null;
                  }
                  if (!targetMealId) {
                    setAddMsg({ ok: false, text: "Select a meal slot first" });
                    return;
                  }
                  const newItems = photoItems.map((i) => ({ ...i, id: genId() }));
                  const updated = {
                    ...day,
                    meals: day.meals.map((m) =>
                      m.id === targetMealId
                        ? { ...m, items: [...(m.items || []), ...newItems] }
                        : m,
                    ),
                  };
                  await persistDay(updated);
                  if (addDate === currentDate) setCurrentDayData(updated);
                  setPhotoItems([]);
                  setPhotoPreview(null);
                  setAddMsg({ ok: true, text: `✅ ${newItems.length} items logged from photo!` });
                  setTimeout(() => setAddMsg(null), 3000);
                }}
                style={{
                  marginTop: "10px",
                  width: "100%",
                  background: "#2E7D32",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                ✓ Log All {photoItems.length} Items
              </button>
              <button
                onClick={() => {
                  const keys = [
                    "kcal",
                    "fat",
                    "sat_fat",
                    "carbs",
                    "sugar",
                    "fibre",
                    "net_carbs",
                    "protein",
                  ];
                  const nutrition = Object.fromEntries(
                    keys.map((k) => [
                      k,
                      Math.round(photoItems.reduce((t, i) => t + (Number(i[k]) || 0), 0) * 10) / 10,
                    ]),
                  );
                  builder.startNew({
                    preview: {
                      id: genId(),
                      name: photoItems.length === 1 ? photoItems[0].name : "",
                      description: "Saved from photo",
                      servings: 1,
                      nutrition,
                      ingredients: photoItems.map((i) => ({ amount: "", item: i.name })),
                      steps: [],
                      notes: "",
                    },
                  });
                  setPhotoItems([]);
                  setPhotoPreview(null);
                }}
                style={{
                  marginTop: "6px",
                  width: "100%",
                  background: "transparent",
                  color: "#185FA5",
                  border: "1px solid #185FA5",
                  borderRadius: "6px",
                  padding: "8px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: "pointer",
                }}
              >
                📖 Save as Recipe
              </button>
            </div>
          )}
        </div>

        {/* Recipe action buttons */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => saved.setOpen(true)}
            style={{
              flex: 1,
              background: "#378ADD",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            📖 Browse Saved Recipes
          </button>
          <button
            onClick={() => builder.startNew()}
            style={{
              flex: 1,
              background: "#185FA5",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px",
              fontSize: "13px",
              fontWeight: "bold",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            🤖 Create with Claude
          </button>
        </div>
      </div>

      {/* ── RIGHT: Exercise (35%) ── */}
      <div style={{ flex: "0 0 35%", minWidth: 0 }}>
        <div
          style={{ fontSize: "16px", fontWeight: "bold", color: "#185FA5", marginBottom: "12px" }}
        >
          🏋️ Exercise
        </div>
        <button
          onClick={exercise.show}
          style={{
            width: "100%",
            background: "#378ADD",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "10px",
            fontSize: "13px",
            fontWeight: "bold",
            cursor: "pointer",
            marginBottom: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          🏋️ Log Manual Exercise
        </button>

        {/* Polar Sessions panel */}
        <div
          style={{
            background: "#fff",
            borderRadius: "8px",
            border: "0.5px solid #e5e7eb",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "#185FA5",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                color: "#fff",
                fontWeight: "bold",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "16px" }}>📡</span> Polar Sessions
            </div>
            {polarConnected && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#90CAF9",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#4CAF50",
                      display: "inline-block",
                    }}
                  />
                  Connected
                </div>
                <button
                  onClick={syncPolar}
                  disabled={polarSyncing}
                  style={{
                    background: polarSyncing ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "#fff",
                    borderRadius: "4px",
                    padding: "2px 8px",
                    fontSize: "10px",
                    cursor: polarSyncing ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                  }}
                >
                  {polarSyncing ? "⏳ Syncing…" : "🔄 Sync"}
                </button>
                <button
                  onClick={async () => {
                    console.log("Reconnect clicked, userId:", userId);
                    if (!userId) {
                      alert("Not logged in — please refresh and try again.");
                      return;
                    }
                    if (
                      !confirm(
                        "This will re-authorise your Polar account with updated permissions (needed for HR data). Continue?",
                      )
                    )
                      return;
                    const btn = document.getElementById("polar-reconnect-btn");
                    if (btn) btn.textContent = "Working…";
                    try {
                      const r = await fetch("/api/polar-disconnect", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId }),
                      });
                      const d = await r.json();
                      console.log("Disconnect result:", d);
                    } catch (e) {
                      console.warn("Disconnect failed, continuing:", e);
                    }
                    window.location.href = `/api/polar-auth?userId=${userId}`;
                  }}
                  id="polar-reconnect-btn"
                  title="Re-authorise with updated permissions for HR data"
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "rgba(255,255,255,0.6)",
                    borderRadius: "4px",
                    padding: "2px 8px",
                    fontSize: "10px",
                    cursor: "pointer",
                  }}
                >
                  Reconnect
                </button>
              </div>
            )}
          </div>
          {polarSyncMsg && (
            <div
              style={{
                padding: "7px 12px",
                fontSize: "11px",
                fontWeight: "bold",
                background: polarSyncMsg.ok ? "#E8F5E9" : "#FFEBEE",
                color: polarSyncMsg.ok ? "#2E7D32" : "#c62828",
                borderBottom: "0.5px solid #e5e7eb",
              }}
            >
              {polarSyncMsg.text}
            </div>
          )}
          <div style={{ padding: "12px" }}>
            <PolarSessionsPanel
              userId={userId}
              polar={{
                connected: polarConnected,
                sessions: polarSessions,
                lastSync: polarLastSync,
              }}
              browse={browse}
              onLog={setPolarLogModal}
            />
          </div>
        </div>

        {/* Apple Watch steps by hour, for the Add Entry date */}
        <HourlyStepsCard userId={userId} date={addDate} />
      </div>

      {/* ── Browse All Polar Sessions Modal ── */}
      {browse.open && <PolarBrowseModal browse={browse} onLog={setPolarLogModal} />}

      {/* ── Get Nutrition (quantity) Modal ── */}
      {lookup.box && <FoodLookupModal lookup={lookup} />}

      {/* ── Recipe Builder Modal ── */}
      {builder.open && (
        <RecipeBuilderModal
          builder={builder}
          form={builder.preview && <RecipeEditorForm builder={builder} recipes={userRecipes} />}
        />
      )}

      {/* ── Saved Recipes Modal ── */}
      {saved.open && (
        <SavedRecipesModal
          saved={saved}
          recipes={userRecipes}
          on={{ pick: portion.open, edit: builder.openEditor, view: setRecipeModal }}
        />
      )}

      {/* ── Recipe Portion Modal ── */}
      {portion.recipe && <RecipePortionModal box={portion} onLoad={loadPortion} />}

      {/* ── Exercise Picker Modal ── */}
      {exercise.open && (
        <ExerciseLogModal log={exercise} slots={mealSlotOptions(allDays, addDate)} />
      )}
    </div>
  );
}
