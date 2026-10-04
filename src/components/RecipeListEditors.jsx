// src/components/RecipeListEditors.jsx — the recipe builder's Ingredients and Method lists.
// Render only. edit(fn, ...args) applies a lib/recipeEdits function to the recipe.
import { linkInfo } from "../constants/recipeLinks";
import {
  withIngredient,
  withoutIngredient,
  withNewIngredient,
  withStep,
  withoutStep,
  withNewStep,
  linkableRecipes,
  linkBadgeText,
} from "../lib/recipeEdits.js";

const NAMES_LIST_ID = "vaulte-saved-recipe-names";
const S = {
  heading: {
    fontWeight: "bold",
    color: "#378ADD",
    fontSize: "11px",
    textTransform: "uppercase",
    marginBottom: "4px",
  },
  add: {
    background: "none",
    border: "1px dashed #378ADD",
    color: "#378ADD",
    borderRadius: "4px",
    padding: "4px 10px",
    fontSize: "11px",
    cursor: "pointer",
    marginTop: "6px",
    marginBottom: "14px",
  },
  remove: (padding) => ({
    background: "none",
    border: "none",
    color: "#c62828",
    cursor: "pointer",
    fontSize: "14px",
    padding,
  }),
  ingredientRow: (linked) => ({
    display: "flex",
    gap: "6px",
    alignItems: "center",
    padding: "3px 0",
    borderBottom: linked ? "none" : "1px solid #F0F4F8",
  }),
  amount: {
    width: "70px",
    fontWeight: "bold",
    color: "#185FA5",
    border: "0.5px solid #e5e7eb",
    borderRadius: "4px",
    padding: "3px 5px",
    fontSize: "12px",
  },
  item: (linked) => ({
    flex: 1,
    border: linked ? "1px solid #378ADD" : "0.5px solid #e5e7eb",
    borderRadius: "4px",
    padding: "3px 5px",
    fontSize: "12px",
  }),
  badge: (ok) => ({
    fontSize: "10px",
    padding: "0 0 4px 76px",
    borderBottom: "1px solid #F0F4F8",
    color: ok ? "#185FA5" : "#8D6E00",
  }),
  stepRow: { display: "flex", gap: "6px", alignItems: "flex-start", padding: "3px 0" },
  stepNumber: { fontSize: "11px", color: "#6b7280", padding: "7px 0" },
  step: {
    flex: 1,
    fontSize: "12px",
    lineHeight: 1.5,
    border: "0.5px solid #e5e7eb",
    borderRadius: "4px",
    padding: "5px 7px",
    resize: "vertical",
    minHeight: "32px",
    boxSizing: "border-box",
  },
};

function IngredientRow({ ing, index, link, edit }) {
  const set = (field) => (e) => edit(withIngredient, index, { field, value: e.target.value });
  return (
    <div>
      <div style={S.ingredientRow(link)}>
        <input
          value={ing.amount || ""}
          placeholder="amount"
          onChange={set("amount")}
          style={S.amount}
        />
        <input
          value={ing.item || ""}
          placeholder="ingredient"
          list={NAMES_LIST_ID}
          onChange={set("item")}
          style={S.item(link)}
        />
        <button onClick={() => edit(withoutIngredient, index)} style={S.remove("0 4px")}>
          ×
        </button>
      </div>
      {link && (
        <div data-link-badge style={S.badge(link.ok)}>
          {linkBadgeText(link)}
        </div>
      )}
    </div>
  );
}

/** recipes: the saved recipes (an ingredient named as one is linked to it). */
export function IngredientsEditor({ recipe, recipes, edit }) {
  return (
    <>
      <div style={S.heading}>Ingredients</div>
      <div style={{ fontSize: "11px", color: "#6b7280", marginBottom: "4px" }}>
        Tip: name an ingredient exactly as a saved recipe (pick from the list) with an amount in g
        or portions — its saved nutrition is used.
      </div>
      <datalist id={NAMES_LIST_ID}>
        {linkableRecipes(recipes, recipe.id).map((r) => (
          <option key={r.id} value={r.name} />
        ))}
      </datalist>
      {(recipe.ingredients || []).map((ing, i) => (
        <IngredientRow
          key={i}
          ing={ing}
          index={i}
          link={linkInfo(ing, recipes, recipe.id)}
          edit={edit}
        />
      ))}
      <button onClick={() => edit(withNewIngredient)} style={S.add}>
        + Add ingredient
      </button>
    </>
  );
}

function StepRow({ text, index, edit }) {
  return (
    <div style={S.stepRow}>
      <span style={S.stepNumber}>{index + 1}.</span>
      <textarea
        value={text}
        onChange={(e) => edit(withStep, index, e.target.value)}
        style={S.step}
      />
      <button onClick={() => edit(withoutStep, index)} style={S.remove("7px 4px")}>
        ×
      </button>
    </div>
  );
}

export function StepsEditor({ recipe, edit }) {
  return (
    <>
      <div style={S.heading}>Method</div>
      {(recipe.steps || []).map((text, i) => (
        <StepRow key={i} text={text} index={i} edit={edit} />
      ))}
      <button onClick={() => edit(withNewStep)} style={S.add}>
        + Add step
      </button>
    </>
  );
}

export const SectionHeading = ({ children }) => <div style={S.heading}>{children}</div>;
