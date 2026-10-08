// src/components/RecipePortionModal.jsx — "How much?" box for adding a saved recipe to the
// Add Food form. Render only: state lives in useRecipePortion, logic in lib/recipePortion.
import { C, FONT } from "../constants/design.jsx";
import { isEstimatedWeight } from "../api/recipeWeights";
import { useIsPhone } from "../hooks/useIsPhone.js";
import {
  PORTION_UNITS,
  portionView,
  portionWeight,
  baseHeading,
  claudeHint,
  formItemFor,
} from "../lib/recipePortion.js";

const BASE_TILES = [
  ["kcal", "Kcal"],
  ["protein", "Prot"],
  ["carbs", "Carbs"],
  ["fat", "Fat"],
];
const SCALED_TILES = [
  ...BASE_TILES,
  ["sat_fat", "Sat F"],
  ["sugar", "Sugar"],
  ["fibre", "Fibre"],
  ["net_carbs", "Net C"],
];
const smallCaps = { fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.4px" };
const grid = { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "4px" };
const tile = (border) => ({
  textAlign: "center",
  background: "#fff",
  borderRadius: "6px",
  padding: "5px 2px",
  border: `0.5px solid ${border}`,
});
const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.55)",
    zIndex: 4000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    background: "#fff",
    borderRadius: "12px",
    width: "440px",
    maxWidth: "95vw",
    boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
    fontFamily: FONT.sans,
    overflow: "hidden",
  },
  // on a phone: never taller than the visible screen; the middle scrolls if it has to
  boxPhone: { maxHeight: "94dvh", display: "flex", flexDirection: "column" },
  bodyPhone: { padding: "12px 14px", overflowY: "auto", minHeight: 0 },
  header: {
    background: "#185FA5",
    color: "#fff",
    padding: "14px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  close: {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: "22px",
    cursor: "pointer",
    lineHeight: 1,
  },
  base: {
    background: "#F0F4F8",
    borderRadius: "8px",
    padding: "10px 12px",
    marginBottom: "18px",
  },
  baseHeading: { ...smallCaps, color: "#6b7280", marginBottom: "7px" },
  howMuch: {
    ...smallCaps,
    fontSize: "11px",
    fontWeight: "500",
    color: "#6b7280",
    marginBottom: "6px",
  },
  qty: {
    flex: 1,
    padding: "10px",
    border: `1.5px solid ${C.blue}`,
    borderRadius: "6px",
    fontSize: "18px",
    fontFamily: FONT.mono,
    fontWeight: "500",
    outline: "none",
    textAlign: "center",
  },
  unit: {
    flex: 1.4,
    padding: "10px 8px",
    border: `0.5px solid ${C.borderMid}`,
    borderRadius: "6px",
    fontSize: "13px",
    fontFamily: FONT.sans,
    outline: "none",
    background: "#fff",
  },
  hint: {
    fontSize: "11px",
    color: "#8D6E00",
    background: "#FFF8E1",
    border: "1px solid #FFE082",
    borderRadius: "6px",
    padding: "6px 10px",
    marginTop: "-8px",
    marginBottom: "14px",
    lineHeight: 1.4,
  },
  scaled: {
    background: "#E8F5E9",
    borderRadius: "8px",
    padding: "10px 12px",
    marginBottom: "16px",
    border: "0.5px solid #A5D6A7",
  },
  scaledHeading: { ...smallCaps, color: "#2E7D32", marginBottom: "7px", fontWeight: "500" },
  error: { fontSize: "12px", color: "#c62828", marginBottom: "12px" },
  loading: { fontSize: "12px", color: "#6b7280", marginBottom: "12px", textAlign: "center" },
  cancel: {
    background: "transparent",
    border: `0.5px solid ${C.borderMid}`,
    color: "#6b7280",
    borderRadius: "6px",
    padding: "9px 16px",
    cursor: "pointer",
    fontSize: "12px",
    fontFamily: FONT.sans,
  },
  calculate: (loading) => ({
    background: loading ? C.hint : "#378ADD",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "9px 18px",
    cursor: loading ? "not-allowed" : "pointer",
    fontSize: "12px",
    fontWeight: "500",
    fontFamily: FONT.sans,
  }),
  load: {
    background: "#2E7D32",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "9px 20px",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: "500",
    fontFamily: FONT.sans,
  },
};

function MacroTiles({ tiles, values, color, border }) {
  return (
    <div style={grid}>
      {tiles.map(([k, label]) => (
        <div key={k} style={tile(border)}>
          <div style={{ fontWeight: "bold", color, fontSize: "13px" }}>{values[k] ?? "—"}</div>
          <div style={{ fontSize: "9px", color: "#6b7280" }}>{label}</div>
        </div>
      ))}
    </div>
  );
}

function Header({ recipe, onClose }) {
  return (
    <div style={S.header}>
      <div>
        <div style={{ fontWeight: "bold", fontSize: "14px" }}>{recipe.name}</div>
        <div style={{ fontSize: "11px", opacity: 0.8, marginTop: "2px" }}>
          {recipe.servings
            ? `Recipe makes ${recipe.servings} servings`
            : "Adjust quantity before adding"}
        </div>
      </div>
      <button onClick={onClose} style={S.close}>
        ×
      </button>
    </div>
  );
}

function BaseNutrition({ recipe }) {
  const values = recipe.nutrition || {};
  return (
    <div style={S.base}>
      <div style={S.baseHeading}>
        {baseHeading(portionWeight(recipe), isEstimatedWeight(recipe))}
      </div>
      <MacroTiles tiles={BASE_TILES} values={values} color="#185FA5" border="#e5e7eb" />
    </div>
  );
}

// phone: the drop-down's own width must not push the row past the box
const SHRINK = { minWidth: 0 };

function AmountInputs({ box, phone }) {
  return (
    <>
      <div style={S.howMuch}>How much?</div>
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <input
          type="number"
          min="0.1"
          step="0.1"
          value={box.qtyText}
          onChange={(e) => box.setQty(e.target.value)}
          style={phone ? { ...S.qty, ...SHRINK } : S.qty}
        />
        <select
          value={box.unit}
          onChange={(e) => box.setUnit(e.target.value)}
          style={phone ? { ...S.unit, ...SHRINK } : S.unit}
        >
          {PORTION_UNITS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </>
  );
}

function ScaledPreview({ heading, name, scaled }) {
  return (
    <div style={S.scaled}>
      <div style={S.scaledHeading}>
        ✓ {heading} {name}
      </div>
      <MacroTiles tiles={SCALED_TILES} values={scaled} color="#2E7D32" border="#C8E6C9" />
    </div>
  );
}

// g / ml / oz without a local result: "Calculate" (Claude) first, then "Load into Form"
function Actions({ box, view, onLoad }) {
  return (
    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
      <button onClick={box.close} style={S.cancel}>
        Cancel
      </button>
      {!view.scaled && (
        <button disabled={box.loading} onClick={box.calculate} style={S.calculate(box.loading)}>
          {box.loading ? "…" : "Calculate"}
        </button>
      )}
      {view.scaled && (
        <button
          onClick={() => onLoad(formItemFor(box.recipe, view.scaled, view.suffix))}
          style={S.load}
        >
          ✓ Load into Form
        </button>
      )}
    </div>
  );
}

/** box: useRecipePortion(); onLoad(formItem) fills the Add Food form. */
export default function RecipePortionModal({ box, onLoad }) {
  const view = portionView(box.recipe, box);
  const phone = useIsPhone();
  return (
    <div onClick={(e) => e.target === e.currentTarget && box.close()} style={S.backdrop}>
      <div style={phone ? { ...S.box, ...S.boxPhone } : S.box}>
        <Header recipe={box.recipe} onClose={box.close} />
        <div style={phone ? S.bodyPhone : { padding: "20px" }}>
          <BaseNutrition recipe={box.recipe} />
          <AmountInputs box={box} phone={phone} />
          {!view.isLocal && (
            <div style={S.hint}>
              {claudeHint(box.unit)} Add a Wt/portion with ✏️ in Saved Recipes for instant results
              in g / oz.
            </div>
          )}
          {view.scaled && (
            <ScaledPreview heading={view.heading} name={box.recipe.name} scaled={view.scaled} />
          )}
          {box.error && <div style={S.error}>{box.error}</div>}
          {box.loading && <div style={S.loading}>Calculating nutrition…</div>}
          <Actions box={box} view={view} onLoad={onLoad} />
        </div>
      </div>
    </div>
  );
}
