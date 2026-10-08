// src/components/RecipeEditorForm.jsx — the recipe builder's editable recipe: name, details,
// nutrition (+ Recalculate), ingredients, method, notes. Render only; edits come from
// lib/recipeEdits and go through builder.setPreview.
import { useIsPhone } from "../hooks/useIsPhone.js";
import { isEstimatedWeight } from "../api/recipeWeights";
import { withField, withServings, withWeighedPortion, withMacro } from "../lib/recipeEdits.js";
import { IngredientsEditor, StepsEditor, SectionHeading } from "./RecipeListEditors";

const MACRO_FIELDS = [
  ["kcal", "kcal"],
  ["fat", "Fat"],
  ["sat_fat", "Sat F"],
  ["carbs", "Carbs"],
  ["sugar", "Sugar"],
  ["fibre", "Fibre"],
  ["net_carbs", "Net C"],
  ["protein", "Prot"],
];
const box = { border: "0.5px solid #e5e7eb", borderRadius: "4px" };
const small = (width) => ({ ...box, width, padding: "3px 5px", fontSize: "11px" });
const S = {
  name: {
    ...box,
    width: "100%",
    fontWeight: "bold",
    fontSize: "16px",
    color: "#185FA5",
    padding: "6px 8px",
    marginBottom: "6px",
    boxSizing: "border-box",
  },
  description: {
    ...box,
    width: "100%",
    fontSize: "12px",
    color: "#6b7280",
    padding: "6px 8px",
    marginBottom: "8px",
    resize: "vertical",
    minHeight: "36px",
    boxSizing: "border-box",
  },
  metaRow: { display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "10px" },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "11px",
    color: "#185FA5",
    fontWeight: "bold",
  },
  macros: {
    display: "grid",
    gridTemplateColumns: "repeat(8,1fr)",
    gap: "4px",
    marginBottom: "6px",
  },
  macro: { textAlign: "center", background: "#E6F1FB", borderRadius: "4px", padding: "4px 2px" },
  macroInput: {
    width: "100%",
    textAlign: "center",
    fontWeight: "bold",
    color: "#185FA5",
    fontSize: "13px",
    border: "none",
    background: "transparent",
  },
  recalcRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
    flexWrap: "wrap",
  },
  recalc: (busy) => ({
    background: "none",
    border: "1px solid #185FA5",
    color: "#185FA5",
    borderRadius: "4px",
    padding: "4px 10px",
    fontSize: "11px",
    cursor: busy ? "not-allowed" : "pointer",
  }),
  notes: {
    ...box,
    width: "100%",
    fontSize: "12px",
    color: "#5D4037",
    padding: "6px 8px",
    resize: "vertical",
    minHeight: "40px",
    boxSizing: "border-box",
  },
};

function NameAndDescription({ recipe, edit }) {
  return (
    <>
      <input
        value={recipe.name || ""}
        placeholder="Recipe name"
        onChange={(e) => edit(withField, "name", e.target.value)}
        style={S.name}
      />
      <textarea
        value={recipe.description || ""}
        placeholder="One-line description"
        onChange={(e) => edit(withField, "description", e.target.value)}
        style={S.description}
      />
    </>
  );
}

function PortionWeight({ recipe, edit }) {
  return (
    <label
      title="Cooked weight of one portion — used to work out nutrition by weight"
      style={S.label}
    >
      ⚖ Wt/portion
      <input
        type="number"
        min="0"
        step="any"
        value={recipe.portion_g ?? ""}
        placeholder="225"
        onChange={(e) => edit(withWeighedPortion, e.target.value)}
        style={small("56px")}
      />
      g
      {isEstimatedWeight(recipe) && (
        <span
          title="Estimated from ingredient weights ÷ servings. Type your weighed value to replace it."
          style={{ color: "#8D6E00", fontWeight: "normal" }}
        >
          &nbsp;(est.)
        </span>
      )}
    </label>
  );
}

function TimeField({ recipe, edit, field }) {
  const [key, label, placeholder] = field;
  return (
    <label style={S.label}>
      {label}
      <input
        value={recipe[key] || ""}
        placeholder={placeholder}
        onChange={(e) => edit(withField, key, e.target.value)}
        style={small("80px")}
      />
    </label>
  );
}

function Details({ recipe, edit }) {
  return (
    <div style={S.metaRow}>
      <label style={S.label}>
        🍽 Serves
        <input
          type="number"
          min="1"
          value={recipe.servings ?? ""}
          onChange={(e) => edit(withServings, e.target.value)}
          style={small("48px")}
        />
      </label>
      <TimeField recipe={recipe} edit={edit} field={["prep_time", "⏱ Prep", "10 minutes"]} />
      <TimeField recipe={recipe} edit={edit} field={["cook_time", "🍳 Cook", "25 minutes"]} />
      <PortionWeight recipe={recipe} edit={edit} />
    </div>
  );
}

function Nutrition({ recipe, edit }) {
  const values = recipe.nutrition || {};
  const grid = useIsPhone() ? { ...S.macros, gridTemplateColumns: "repeat(4,1fr)" } : S.macros;
  return (
    <div style={grid}>
      {MACRO_FIELDS.map(([k, label]) => (
        <div key={k} style={S.macro}>
          <input
            type="number"
            value={values[k] ?? 0}
            onChange={(e) => edit(withMacro, k, e.target.value)}
            style={S.macroInput}
          />
          <div style={{ fontSize: "9px", color: "#6b7280" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function Recalculate({ builder }) {
  return (
    <div style={S.recalcRow}>
      <button
        disabled={builder.recalcLoading}
        onClick={builder.recalculate}
        style={S.recalc(builder.recalcLoading)}
      >
        {builder.recalcLoading
          ? "⏳ Recalculating…"
          : "↻ Recalculate nutrition from ingredients above"}
      </button>
      {builder.recalcError && (
        <div style={{ color: "#c62828", fontSize: "12px" }}>{builder.recalcError}</div>
      )}
    </div>
  );
}

/** builder: useRecipeBuilder() with a preview; recipes: the saved recipes. */
export default function RecipeEditorForm({ builder, recipes }) {
  const recipe = builder.preview;
  const edit = (fn, ...args) => builder.setPreview((p) => fn(p, ...args));
  return (
    <div style={{ marginBottom: "10px" }}>
      <NameAndDescription recipe={recipe} edit={edit} />
      <Details recipe={recipe} edit={edit} />
      <Nutrition recipe={recipe} edit={edit} />
      <Recalculate builder={builder} />
      <IngredientsEditor recipe={recipe} recipes={recipes} edit={edit} />
      <StepsEditor recipe={recipe} edit={edit} />
      <SectionHeading>Notes</SectionHeading>
      <textarea
        value={recipe.notes || ""}
        placeholder="Optional notes"
        onChange={(e) => edit(withField, "notes", e.target.value)}
        style={S.notes}
      />
    </div>
  );
}
