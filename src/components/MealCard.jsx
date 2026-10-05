// src/components/MealCard.jsx — one Daily log meal card: a header row with the meal's subtotals
// (click to open / close) and, when open, column headings and its entries. Render only.
import { C, FONT } from "../constants/design.jsx";
import { COLUMN_HEADS, mealSummary, subtotalText } from "../lib/mealCards.js";
import MealItemRow from "./MealItemRow.jsx";

// Column widths — shared between the header row and the entry rows
const COL_ITEM = "auto";
const COL_NUM = "58px";
const COL_DEL = "28px";
const NUM_COLS = 7; // kcal fat carbs sugar fibre netc prot

const S = {
  card: {
    background: "#fff",
    border: `0.5px solid ${C.border}`,
    borderRadius: "8px",
    marginBottom: "8px",
    overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse", tableLayout: "fixed", minWidth: "500px" },
  nameCell: {
    padding: "8px 10px 8px 8px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  head: (h) => ({
    color: C.hint,
    fontSize: "10px",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    padding: "5px 8px",
    textAlign: h === "Item" ? "left" : "right",
    fontFamily: FONT.sans,
    borderBottom: `0.5px solid ${C.border}`,
    borderTop: `0.5px solid ${C.border}`,
  }),
  empty: { padding: "10px 12px", fontSize: "12px", color: C.hint, fontStyle: "italic" },
};

function Columns() {
  return (
    <colgroup>
      <col style={{ width: COL_ITEM }} />
      {Array(NUM_COLS)
        .fill(0)
        .map((_, i) => (
          <col key={i} style={{ width: COL_NUM }} />
        ))}
      <col style={{ width: COL_DEL }} />
    </colgroup>
  );
}

function MealIcon({ isExercise }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke={isExercise ? C.blue : C.hint}
      strokeWidth="1.5"
      strokeLinecap="round"
      style={{ flexShrink: 0 }}
    >
      {isExercise ? (
        <>
          <path d="M3 8h10M8 3l3 5-3 5" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="5" />
          <path d="M5 8h6" />
          <path d="M8 5v6" />
        </>
      )}
    </svg>
  );
}

function Chevron({ closed }) {
  const turn = {
    flexShrink: 0,
    transition: "transform 0.18s",
    transform: closed ? "rotate(-90deg)" : "rotate(0deg)",
  };
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke={C.hint}
      strokeWidth="1.5"
      strokeLinecap="round"
      style={turn}
    >
      <path d="M2 3.5l3 3 3-3" />
    </svg>
  );
}

function MealName({ name, isExercise, closed }) {
  const text = { fontSize: "12px", fontWeight: "500", color: isExercise ? C.blueText : C.text };
  return (
    <td style={S.nameCell}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <Chevron closed={closed} />
        <MealIcon isExercise={isExercise} />
        <span style={text}>{name}</span>
      </div>
    </td>
  );
}

function HeaderRow({ meal, summary, closed, onToggle }) {
  const { hasItems, isExercise, subtotals } = summary;
  const row = {
    cursor: "pointer",
    background: closed ? "#fff" : C.bg,
    borderBottom: closed ? "none" : `0.5px solid ${C.border}`,
  };
  const cell = {
    padding: "8px",
    textAlign: "right",
    fontSize: "11px",
    fontFamily: FONT.mono,
    fontWeight: hasItems ? "500" : "400",
    color: hasItems ? (isExercise ? C.blueText : C.text) : C.border,
  };
  return (
    <tr onClick={onToggle} style={row}>
      <MealName name={meal.name} isExercise={isExercise} closed={closed} />
      {subtotals.map((v, i) => (
        <td key={i} style={cell}>
          {subtotalText(v, i, hasItems)}
        </td>
      ))}
      <td />
    </tr>
  );
}

function ColumnHeads() {
  return (
    <tr style={{ background: C.bg }}>
      {COLUMN_HEADS.map((h) => (
        <th key={h} style={S.head(h)}>
          {h}
        </th>
      ))}
    </tr>
  );
}

function NothingLogged() {
  return (
    <tr>
      <td colSpan={NUM_COLS + 2} style={S.empty}>
        No items logged yet
      </td>
    </tr>
  );
}

/** entry: { polar, userRecipes, setRecipeModal, deleteItem } for the entry rows. */
export default function MealCard({ meal, closed, onToggle, entry }) {
  const summary = mealSummary(meal);
  const open = !closed;
  return (
    <div style={S.card}>
      <div style={{ overflowX: "auto" }}>
        <table style={S.table}>
          <Columns />
          <tbody>
            <HeaderRow meal={meal} summary={summary} closed={closed} onToggle={onToggle} />
            {open && summary.hasItems && <ColumnHeads />}
            {open && !summary.hasItems && <NothingLogged />}
            {open &&
              summary.items.map((item) => (
                <MealItemRow key={item.id} item={item} mealId={meal.id} {...entry} />
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
