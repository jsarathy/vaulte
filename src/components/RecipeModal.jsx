// src/components/RecipeModal.jsx — the recipe card: name and source, description, tags,
// nutrition per serving, ingredients, method and notes; closes on × or the backdrop
import { Tags, Nutrition, Ingredients, Method, Notes } from "./RecipeModalSections";
import {
  backdropStyle,
  cardStyle,
  headStyle,
  nameStyle,
  sourceStyle,
  closeStyle,
  bodyStyle,
  descriptionStyle,
} from "../styles/recipeModalStyles";

function Head({ recipe, onClose }) {
  return (
    <div style={headStyle}>
      <div>
        <div style={nameStyle}>{recipe.name}</div>
        {recipe.source && <div style={sourceStyle}>{recipe.source}</div>}
      </div>
      <button onClick={onClose} style={closeStyle}>
        ×
      </button>
    </div>
  );
}

export default function RecipeModal({ recipe, onClose }) {
  if (!recipe) return null;
  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={backdropStyle}>
      <div style={cardStyle}>
        <Head recipe={recipe} onClose={onClose} />
        <div style={bodyStyle}>
          {recipe.description && <p style={descriptionStyle}>{recipe.description}</p>}
          <Tags recipe={recipe} />
          <Nutrition nutrition={recipe.nutrition} />
          <Ingredients ingredients={recipe.ingredients} />
          <Method steps={recipe.steps} hasNotes={!!recipe.notes} />
          <Notes notes={recipe.notes} />
        </div>
      </div>
    </div>
  );
}
