// src/components/MealCardPhone.jsx — a Daily log meal card on a phone (Fix 43.5): the name and
// kcal on the header; when open, each entry as its name over a wrapping row of labelled figures.
import { fmt } from "../constants/helpers.js";
import { C, FONT, IconX } from "../constants/design.jsx";
import { COLUMN_HEADS, itemFigures, subtotalText } from "../lib/mealCards.js";
import { ItemLabel } from "./MealItemRow.jsx";
import { MealIcon, Chevron } from "./MealCardIcons.jsx";

const S = {
  card: {
    background: "#fff",
    border: `0.5px solid ${C.border}`,
    borderRadius: "8px",
    marginBottom: "8px",
    overflow: "hidden",
  },
  head: (closed) => ({
    display: "flex",
    alignItems: "center",
    gap: "8px",
    minHeight: "48px",
    padding: "8px 12px",
    cursor: "pointer",
    background: closed ? "#fff" : C.bg,
  }),
  name: { flex: 1, minWidth: 0, fontSize: "14px", fontWeight: "500" },
  kcal: { fontFamily: FONT.mono, fontSize: "13px", flexShrink: 0 },
  entry: { padding: "10px 12px", borderTop: `0.5px solid ${C.border}` },
  entryTop: { display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" },
  figures: { display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: "6px" },
  figure: { fontFamily: FONT.mono, fontSize: "12px", color: C.muted },
  figureName: { fontFamily: FONT.sans, color: C.hint },
  remove: {
    width: "40px",
    height: "40px",
    background: "none",
    border: "none",
    color: C.hint,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  },
  empty: { padding: "10px 12px", fontSize: "13px", color: C.hint, fontStyle: "italic" },
};

function Header({ meal, summary, closed, onToggle }) {
  const { hasItems, isExercise, subtotals } = summary;
  const color = isExercise ? C.blueText : C.text;
  return (
    <div onClick={onToggle} style={S.head(closed)}>
      <Chevron closed={closed} />
      <MealIcon isExercise={isExercise} />
      <span style={{ ...S.name, color }}>{meal.name}</span>
      <span style={{ ...S.kcal, color: hasItems ? color : C.border }}>
        {subtotalText(subtotals[0], 0, hasItems)}
      </span>
    </div>
  );
}

function Figures({ item }) {
  return (
    <div style={S.figures}>
      {itemFigures(item).map((v, i) => (
        <span key={COLUMN_HEADS[i + 1]} style={S.figure}>
          <span style={S.figureName}>{COLUMN_HEADS[i + 1]} </span>
          {fmt(v)}
          {i > 0 ? "g" : ""}
        </span>
      ))}
    </div>
  );
}

function Remove({ onRemove }) {
  const click = () => confirm("Remove this item?") && onRemove();
  return (
    <button aria-label="Remove" onClick={click} style={S.remove}>
      <IconX size={14} />
    </button>
  );
}

function Entry({ item, mealId, entry }) {
  const { deleteItem, ...label } = entry;
  return (
    <div style={S.entry}>
      <div style={S.entryTop}>
        <span style={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
          <ItemLabel item={item} {...label} />
        </span>
        <Remove onRemove={() => deleteItem(mealId, item.id)} />
      </div>
      <Figures item={item} />
    </div>
  );
}

export default function MealCardPhone({ meal, summary, closed, onToggle, entry }) {
  return (
    <div style={S.card}>
      <Header meal={meal} summary={summary} closed={closed} onToggle={onToggle} />
      {!closed && !summary.hasItems && <div style={S.empty}>No items logged yet</div>}
      {!closed &&
        summary.items.map((item) => (
          <Entry key={item.id} item={item} mealId={meal.id} entry={entry} />
        ))}
    </div>
  );
}
