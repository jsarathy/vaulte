// src/components/AddFoodCard.jsx — "Add Food Item" form on Add Entry. Render only; state and
// actions in useAddFood.
import { C, FONT } from "../constants/design.jsx";
import { MACRO_FIELDS, recipeHint } from "../lib/addFood.js";
import { usePhoneFold } from "../hooks/usePhoneFold.js";
import FoldTitle from "./FoldTitle.jsx";

const LABEL = {
  fontSize: "10px",
  color: "#6b7280",
  textTransform: "uppercase",
  marginBottom: "2px",
};
const FIELD = {
  width: "100%",
  padding: "5px 7px",
  border: "0.5px solid #e5e7eb",
  borderRadius: "4px",
  fontSize: "12px",
};
const BUTTON = {
  borderRadius: "5px",
  cursor: "pointer",
  fontFamily: FONT.sans,
};
const S = {
  card: {
    background: "#fff",
    borderRadius: "8px",
    border: "0.5px solid #e5e7eb",
    padding: "14px",
    marginBottom: "12px",
  },
  title: { fontWeight: "bold", color: "#185FA5", marginBottom: "10px", fontSize: "13px" },
  dayMeal: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" },
  dayMealPhone: { gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)" },
  // iPhone draws a date box taller and wider than a drop-down: make the two the same
  alike: { height: "40px", minWidth: 0, display: "block", boxSizing: "border-box" },
  date: { WebkitAppearance: "none", appearance: "none", textAlign: "left" },
  list: {
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
  },
  option: {
    padding: "8px 12px",
    cursor: "pointer",
    borderBottom: "1px solid #F0F4F8",
    fontSize: "12px",
  },
  macros: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill,minmax(100px,1fr))",
    gap: "8px",
    marginBottom: "10px",
  },
  actions: { display: "flex", gap: "8px", justifyContent: "flex-end", alignItems: "center" },
  clear: {
    ...BUTTON,
    background: "transparent",
    color: C.blueText,
    border: `0.5px solid ${C.blue}`,
    padding: "4px 9px",
    fontSize: "11px",
  },
  add: {
    ...BUTTON,
    background: "#3B6D11",
    color: "#fff",
    border: "none",
    padding: "7px 13px",
    fontSize: "12px",
    fontWeight: "500",
  },
  msg: (ok) => ({
    marginTop: "8px",
    padding: "7px 10px",
    borderRadius: "4px",
    fontSize: "12px",
    background: ok ? "#E8F5E9" : "#FFEBEE",
    color: ok ? "#2E7D32" : "#c62828",
  }),
};

function Labelled({ label, style, children }) {
  return (
    <div style={style}>
      <div style={LABEL}>{label}</div>
      {children}
    </div>
  );
}

function DayAndMeal({ food, phone }) {
  const alike = phone ? S.alike : null;
  return (
    <div style={phone ? { ...S.dayMeal, ...S.dayMealPhone } : S.dayMeal}>
      <Labelled label="Day">
        <input
          type="date"
          value={food.day.date}
          onChange={(e) => food.day.setDate(e.target.value)}
          style={{ ...FIELD, ...alike, ...(phone ? S.date : null) }}
        />
      </Labelled>
      <Labelled label="Meal">
        <select
          value={food.day.mealId}
          onChange={(e) => food.setMealId(e.target.value)}
          style={{ ...FIELD, ...alike }}
        >
          <option value="">— select —</option>
          {food.mealOptions.map((o) => (
            <option key={o.key} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Labelled>
    </div>
  );
}

function RecipeOption({ recipe, onPick }) {
  return (
    <div
      onMouseDown={() => onPick(recipe)}
      style={S.option}
      onMouseOver={(e) => (e.currentTarget.style.background = "#F0F4F8")}
      onMouseOut={(e) => (e.currentTarget.style.background = "#fff")}
    >
      <div style={{ fontWeight: "bold", color: "#185FA5" }}>{recipe.name}</div>
      <div style={{ fontSize: "11px", color: "#6b7280" }}>{recipeHint(recipe)}</div>
    </div>
  );
}

// Name with the matching saved recipes listed below it
function NameField({ food }) {
  return (
    <Labelled label="Food Item Name" style={{ marginBottom: "10px", position: "relative" }}>
      <input
        value={food.item.name}
        {...food.name}
        placeholder="e.g. Pinto bean stew (1 portion)"
        style={{ ...FIELD, padding: "5px 9px" }}
      />
      {food.names.shown && (
        <div style={S.list}>
          {food.names.list.map((r) => (
            <RecipeOption key={r.id} recipe={r} onPick={food.names.pick} />
          ))}
        </div>
      )}
    </Labelled>
  );
}

function MacroField({ field: [key, label], food }) {
  return (
    <Labelled label={label}>
      <input
        type="number"
        value={food.item[key]}
        onChange={(e) => food.setMacro(key, e.target.value)}
        placeholder="0"
        step="0.1"
        style={{ ...FIELD, background: key === "net_carbs" ? "#F0F4F8" : "#fff" }}
      />
    </Labelled>
  );
}

function FoodForm({ food, phone }) {
  return (
    <>
      <DayAndMeal food={food} phone={phone} />
      <NameField food={food} />
      <div style={S.macros}>
        {MACRO_FIELDS.map((f) => (
          <MacroField key={f[0]} field={f} food={food} />
        ))}
      </div>
      <div style={S.actions}>
        <button onClick={food.clear} style={S.clear}>
          ✕ Clear
        </button>
        <button onClick={food.submit} style={S.add}>
          Add Item
        </button>
      </div>
      {food.msg && <div style={S.msg(food.msg.ok)}>{food.msg.text}</div>}
    </>
  );
}

/** food: useAddFood(). A phone keeps it folded shut until the title is tapped. */
export default function AddFoodCard({ food }) {
  const fold = usePhoneFold();
  return (
    <div style={S.card}>
      <FoldTitle fold={fold} style={{ ...S.title, marginBottom: fold.open ? "10px" : 0 }}>
        Add Food Item
      </FoldTitle>
      {fold.open && <FoodForm food={food} phone={fold.phone} />}
    </div>
  );
}
