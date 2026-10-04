// src/components/RecipeBuilderModal.jsx — the recipe builder's frame: header, "Describe your
// recipe" step, intro notes and Save bar. Render only; state and actions in useRecipeBuilder.
// form: the editable recipe, drawn once there is a preview.
import { saveLabel } from "../lib/recipeBuilder.js";

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
    borderRadius: "10px",
    width: "640px",
    maxWidth: "95vw",
    maxHeight: "88vh",
    overflowY: "auto",
    boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
  },
  header: {
    background: "#185FA5",
    color: "#fff",
    padding: "14px 18px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: "10px 10px 0 0",
  },
  close: {
    background: "none",
    border: "none",
    color: "#fff",
    fontSize: "22px",
    cursor: "pointer",
    lineHeight: 1,
  },
  describe: { color: "#6b7280", fontSize: "13px", marginBottom: "12px", lineHeight: 1.5 },
  input: {
    width: "100%",
    minHeight: "120px",
    padding: "10px",
    border: "0.5px solid #e5e7eb",
    borderRadius: "6px",
    fontSize: "13px",
    fontFamily: "inherit",
    resize: "vertical",
    background: "#F0F4F8",
    boxSizing: "border-box",
  },
  generate: (off) => ({
    background: off ? "#ccc" : "#378ADD",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    padding: "9px 18px",
    cursor: off ? "not-allowed" : "pointer",
    fontSize: "13px",
    fontWeight: "bold",
  }),
  found: {
    background: "#E8F5E9",
    border: "1px solid #A5D6A7",
    borderRadius: "6px",
    padding: "10px 14px",
    marginBottom: "14px",
    fontSize: "13px",
    color: "#2E7D32",
  },
  stale: {
    background: "#FFF8E1",
    border: "1px solid #FFE082",
    borderRadius: "6px",
    padding: "8px 12px",
    marginBottom: "12px",
    fontSize: "12px",
    color: "#8D6E00",
  },
  footer: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
    marginTop: "14px",
    borderTop: "0.5px solid #e5e7eb",
    paddingTop: "14px",
  },
  footerError: { color: "#c62828", fontSize: "12px", alignSelf: "center", marginRight: "auto" },
  secondary: {
    background: "transparent",
    color: "#378ADD",
    border: "1px solid #378ADD",
    borderRadius: "4px",
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: "bold",
  },
  save: (off) => ({
    background: off ? "#ccc" : "#2E7D32",
    color: "#fff",
    border: "none",
    borderRadius: "4px",
    padding: "8px 18px",
    cursor: off ? "not-allowed" : "pointer",
    fontSize: "13px",
    fontWeight: "bold",
  }),
};

const EXAMPLE =
  "e.g. Pinto bean stew — 606g cooked pinto beans, 102g onion, 6 green chillies, 3 tbsp sesame oil, 200g chopped tomatoes, salt and hing. Sauté onion and chillies, add tomatoes, add beans, simmer 15 min. Makes 4 portions of ~225g each.";

function Header({ builder }) {
  return (
    <div style={S.header}>
      <div style={{ fontSize: "15px", fontWeight: "bold" }}>
        {builder.editId ? "✏️ Edit Recipe" : "🤖 Create Recipe with Claude"}
      </div>
      <button onClick={builder.requestClose} style={S.close}>
        ×
      </button>
    </div>
  );
}

function DescribeStep({ builder }) {
  const off = builder.loading || !builder.input.trim();
  return (
    <>
      <p style={S.describe}>
        Describe your recipe — a full ingredient list, or just a dish name if you want Claude to
        look one up for you. Claude will generate the full recipe with nutrition per serving, which
        you can then edit before saving.
      </p>
      <textarea
        value={builder.input}
        onChange={(e) => builder.setInput(e.target.value)}
        placeholder={EXAMPLE}
        style={S.input}
      />
      {builder.error && (
        <div style={{ color: "#c62828", fontSize: "12px", marginTop: "6px" }}>{builder.error}</div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
        <button disabled={off} onClick={builder.generate} style={S.generate(off)}>
          {builder.loading ? "⏳ Generating…" : "Generate Recipe →"}
        </button>
      </div>
    </>
  );
}

function PreviewIntro({ builder }) {
  return (
    <>
      <div style={S.found}>
        {builder.editId
          ? "✏️ Edit anything below, then save"
          : "✓ Recipe found — edit anything below, then save"}
      </div>
      {builder.stale && (
        <div style={S.stale}>
          Ingredients or servings changed — nutrition will be recalculated when you save.
        </div>
      )}
    </>
  );
}

// Editing: Cancel (back to Saved Recipes). New recipe: Start over (back to Describe).
function Footer({ builder }) {
  const off = builder.saving || builder.recalcLoading;
  return (
    <div style={S.footer}>
      {builder.error && <div style={S.footerError}>{builder.error}</div>}
      {builder.editId ? (
        <button onClick={builder.requestClose} disabled={builder.saving} style={S.secondary}>
          Cancel
        </button>
      ) : (
        <button onClick={() => builder.setPreview(null)} style={S.secondary}>
          ← Start over
        </button>
      )}
      <button disabled={off} onClick={builder.save} style={S.save(off)}>
        {saveLabel({ saving: builder.saving, stale: builder.stale, editing: builder.editId })}
      </button>
    </div>
  );
}

/** builder: useRecipeBuilder(). */
export default function RecipeBuilderModal({ builder, form }) {
  return (
    <div onClick={(e) => e.target === e.currentTarget && builder.requestClose()} style={S.backdrop}>
      <div style={S.box}>
        <Header builder={builder} />
        <div style={{ padding: "18px" }}>
          {!builder.preview ? (
            <DescribeStep builder={builder} />
          ) : (
            <>
              <PreviewIntro builder={builder} />
              {form}
              <Footer builder={builder} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
