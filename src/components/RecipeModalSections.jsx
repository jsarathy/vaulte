// src/components/RecipeModalSections.jsx — the recipe card's parts: tag row, nutrition per
// serving, ingredients, the numbered method, notes
import {
  tagRowStyle,
  tagStyle,
  sectionStyle,
  nutritionGridStyle,
  nutritionCellStyle,
  nutritionValueStyle,
  nutritionLabelStyle,
  listStyle,
  ingredientStyle,
  amountStyle,
  itemStyle,
  stepsStyle,
  stepStyle,
  stepBadgeStyle,
  notesStyle,
} from "../styles/recipeModalStyles";

export const Sect = ({ children }) => <div style={sectionStyle}>{children}</div>;

const NUTRITION = [
  ["kcal", "kcal"],
  ["fat", "Fat g"],
  ["carbs", "Carbs g"],
  ["fibre", "Fibre g"],
  ["net_carbs", "Net C g"],
  ["protein", "Prot g"],
];

/** The tag texts for a recipe: prep, cook, weight per portion (with "(est.)"), serves. */
export function recipeTags(recipe) {
  const tags = [];
  if (recipe.prep_time) tags.push(`Prep ${recipe.prep_time}`);
  if (recipe.cook_time) tags.push(`Cook ${recipe.cook_time}`);
  if (recipe.portion_g > 0) {
    const est = recipe.portion_g_source === "estimated" ? " (est.)" : "";
    tags.push(`Wt/portion ${recipe.portion_g} g${est}`);
  }
  if (recipe.servings) tags.push(`Serves ${recipe.servings}`);
  return tags;
}

export function Tags({ recipe }) {
  const { prep_time, cook_time, servings, portion_g } = recipe;
  if (!(prep_time || cook_time || servings || portion_g)) return null;
  return (
    <div style={tagRowStyle}>
      {recipeTags(recipe).map((t) => (
        <span key={t} style={tagStyle}>
          {t}
        </span>
      ))}
    </div>
  );
}

export function Nutrition({ nutrition }) {
  if (!nutrition) return null;
  return (
    <>
      <Sect>Nutrition per serving</Sect>
      <div style={nutritionGridStyle}>
        {NUTRITION.map(([k, l]) => (
          <div key={k} style={nutritionCellStyle}>
            <div style={nutritionValueStyle}>{nutrition[k] || 0}</div>
            <div style={nutritionLabelStyle}>{l}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export const Ingredients = ({ ingredients }) => (
  <>
    <Sect>Ingredients</Sect>
    <div style={listStyle}>
      {ingredients?.map((ing, i) => (
        <div key={i} style={ingredientStyle}>
          <span style={amountStyle}>{ing.amount}</span>
          <span style={itemStyle}>{ing.item}</span>
        </div>
      ))}
    </div>
  </>
);

export const Method = ({ steps, hasNotes }) => (
  <>
    <Sect>Method</Sect>
    <div style={stepsStyle(hasNotes)}>
      {steps?.map((s, i) => (
        <div key={i} style={stepStyle}>
          <span style={stepBadgeStyle}>{i + 1}</span>
          {s}
        </div>
      ))}
    </div>
  </>
);

export const Notes = ({ notes }) => (notes ? <div style={notesStyle}>{notes}</div> : null);
