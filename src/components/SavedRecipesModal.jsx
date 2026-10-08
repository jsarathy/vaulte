// src/components/SavedRecipesModal.jsx — the Saved Recipes list. Render only; state and
// deleting in useSavedRecipes. onPick (row) adds it, onEdit ✏️, onView 👁.
import { isEstimatedWeight } from "../api/recipeWeights";
import { weightLabel } from "../lib/savedRecipes.js";

const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 3000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    background: "#fff",
    borderRadius: "12px",
    width: "520px",
    maxWidth: "95vw",
    maxHeight: "88dvh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
  },
  header: {
    background: "#185FA5",
    color: "#fff",
    padding: "14px 18px",
    borderRadius: "12px 12px 0 0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexShrink: 0,
  },
  close: {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: "22px",
    cursor: "pointer",
    lineHeight: 1,
  },
  notice: (ok) => ({
    margin: "8px 8px 0",
    padding: "7px 10px",
    borderRadius: "6px",
    fontSize: "12px",
    background: ok ? "#E8F5E9" : "#FFF8E1",
    color: ok ? "#2E7D32" : "#8D6E00",
  }),
  empty: { textAlign: "center", padding: "30px", color: "#6b7280", fontSize: "13px" },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "0.5px solid #e5e7eb",
    borderRadius: "6px",
    transition: "background 0.15s",
  },
  side: { display: "flex", alignItems: "center", gap: "10px", marginLeft: "12px" },
  icon: (color) => ({
    background: "none",
    border: "none",
    color,
    cursor: "pointer",
    fontSize: "11px",
    padding: "0 3px",
  }),
};

// Row buttons: the click mustn't also pick the row
const stop = (fn) => (e) => {
  e.stopPropagation();
  fn();
};

function RowActions({ recipe, saved, on }) {
  return (
    <>
      <button
        className="tap-target"
        onClick={stop(() => on.edit(recipe))}
        title="Edit recipe"
        style={S.icon("#378ADD")}
      >
        ✏️
      </button>
      <button
        className="tap-target"
        onClick={stop(() => on.view(recipe))}
        style={S.icon("#378ADD")}
      >
        👁
      </button>
      <button
        className="tap-target"
        onClick={stop(() => saved.remove(recipe))}
        style={{ ...S.icon("#c62828"), opacity: 0.5 }}
      >
        ✕
      </button>
    </>
  );
}

function RecipeRow({ recipe, saved, on }) {
  const weight = weightLabel(recipe, isEstimatedWeight(recipe));
  return (
    <div
      style={S.row}
      onMouseOver={(e) => (e.currentTarget.style.background = "#F0F4F8")}
      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ flex: 1, cursor: "pointer" }} onClick={() => on.pick(recipe)}>
        <div style={{ fontWeight: "bold", fontSize: "13px", color: "#185FA5" }}>{recipe.name}</div>
        <div style={{ fontSize: "11px", color: "#6b7280" }}>{recipe.description}</div>
      </div>
      <div style={S.side}>
        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          <div style={{ fontSize: "12px", color: "#378ADD", fontWeight: "bold" }}>
            {recipe.nutrition?.kcal} kcal
          </div>
          {weight && <div style={{ fontSize: "11px", color: "#6b7280" }}>{weight}</div>}
        </div>
        <RowActions recipe={recipe} saved={saved} on={on} />
      </div>
    </div>
  );
}

function RecipeList({ recipes, saved, on }) {
  if (recipes.length === 0)
    return (
      <div style={S.empty}>
        No saved recipes yet. Use "Create with Claude" to build your first recipe.
      </div>
    );
  return recipes.map((r) => <RecipeRow key={r.id} recipe={r} saved={saved} on={on} />);
}

/** saved: useSavedRecipes(); on: { pick, edit, view } for a recipe. */
export default function SavedRecipesModal({ saved, recipes, on }) {
  return (
    <div onClick={(e) => e.target === e.currentTarget && saved.setOpen(false)} style={S.backdrop}>
      <div style={S.box}>
        <div style={S.header}>
          <div style={{ fontWeight: "bold", fontSize: "15px" }}>📖 Saved Recipes</div>
          <button onClick={saved.close} style={S.close}>
            ×
          </button>
        </div>
        {saved.notice && (
          <div data-recipe-notice style={S.notice(saved.notice.ok)}>
            {saved.notice.text}
          </div>
        )}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          <RecipeList recipes={recipes} saved={saved} on={on} />
        </div>
      </div>
    </div>
  );
}
