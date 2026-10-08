// src/components/MealItemRow.jsx — one entry in a Daily log meal card: its name (a link to its
// Polar session or saved recipe, if it has one), figures, and a remove button. Render only.
import { fmt } from "../constants/helpers.js";
import { C, FONT, IconX } from "../constants/design.jsx";
import { itemFigures, itemLink } from "../lib/mealCards.js";

const S = {
  polar: {
    cursor: "pointer",
    borderBottom: `1px dashed ${C.blueMid}`,
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
  },
  recipe: { color: C.blue, cursor: "pointer", borderBottom: `1px dashed ${C.blueMid}` },
  remove: {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "2px",
    color: C.hint,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "3px",
  },
};

function PolarLink({ item, polar }) {
  return (
    <span onClick={() => polar.open(item)} style={S.polar}>
      {polar.loadingId === item.id ? "…" : item.name}
      <svg
        width="10"
        height="10"
        viewBox="0 0 16 16"
        fill="none"
        stroke={C.blue}
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M4 8h8M9 5l3 3-3 3" />
      </svg>
    </span>
  );
}

export function ItemLabel({ item, polar, userRecipes, setRecipeModal }) {
  const link = itemLink(item, userRecipes);
  if (link?.polar) return <PolarLink item={item} polar={polar} />;
  if (!link?.recipe) return item.name;
  return (
    <span onClick={() => setRecipeModal(link.recipe)} style={S.recipe}>
      {item.name}
    </span>
  );
}

function ItemName(props) {
  const { item } = props;
  const cell = {
    padding: "7px 8px",
    fontSize: "12px",
    color: item.is_exercise ? C.blueText : C.text,
  };
  return (
    <td style={cell}>
      <ItemLabel {...props} />
    </td>
  );
}

function RemoveButton({ onRemove }) {
  const click = (e) => {
    e.stopPropagation();
    if (confirm("Remove this item?")) onRemove();
  };
  return (
    <td style={{ textAlign: "center", padding: "7px 4px" }}>
      <button
        onClick={click}
        style={S.remove}
        onMouseEnter={(e) => (e.currentTarget.style.color = C.danger)}
        onMouseLeave={(e) => (e.currentTarget.style.color = C.hint)}
      >
        <IconX size={11} />
      </button>
    </td>
  );
}

export default function MealItemRow({
  item,
  mealId,
  polar,
  userRecipes,
  setRecipeModal,
  deleteItem,
}) {
  const figure = {
    padding: "7px 8px",
    textAlign: "right",
    fontSize: "11px",
    color: item.is_exercise ? C.blueText : C.muted,
    fontFamily: FONT.mono,
  };
  return (
    <tr style={{ borderBottom: `0.5px solid ${C.border}` }}>
      <ItemName
        item={item}
        polar={polar}
        userRecipes={userRecipes}
        setRecipeModal={setRecipeModal}
      />
      {itemFigures(item).map((v, i) => (
        <td key={i} style={figure}>
          {fmt(v)}
          {i > 0 ? "g" : ""}
        </td>
      ))}
      <RemoveButton onRemove={() => deleteItem(mealId, item.id)} />
    </tr>
  );
}
