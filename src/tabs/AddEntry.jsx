// src/tabs/AddEntry.jsx — the Add Entry tab: food on the left (65%), exercise on the right (35%)
// and the boxes they open. Render only; the parts are wired together in useAddEntry.
import HourlyStepsCard from "../components/HourlyStepsCard";
import RecipePortionModal from "../components/RecipePortionModal";
import RecipeBuilderModal from "../components/RecipeBuilderModal";
import RecipeEditorForm from "../components/RecipeEditorForm";
import FoodLookupModal from "../components/FoodLookupModal";
import SavedRecipesModal from "../components/SavedRecipesModal";
import PolarCard from "../components/PolarCard";
import PolarBrowseModal from "../components/PolarBrowseModal";
import AddFoodCard from "../components/AddFoodCard";
import PhotoLogCard from "../components/PhotoLogCard";
import ExerciseLogModal from "../components/ExerciseLogModal";
import { mealSlotOptions } from "../lib/exerciseLog.js";
import { useAddEntry } from "../hooks/useAddEntry";
import { useIsPhone } from "../hooks/useIsPhone.js";

const BIG_BUTTON = {
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "10px",
  fontSize: "13px",
  fontWeight: "bold",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
};
const S = {
  page: {
    flex: 1,
    overflowY: "auto",
    padding: "14px 16px",
    background: "#f9fafb",
    display: "flex",
    gap: "14px",
    alignItems: "flex-start",
  },
  heading: { fontSize: "16px", fontWeight: "bold", color: "#185FA5", marginBottom: "12px" },
  recipeButton: (background) => ({ ...BIG_BUTTON, flex: 1, background }),
  exerciseButton: { ...BIG_BUTTON, width: "100%", background: "#378ADD", marginBottom: "14px" },
};

// Two columns on a desktop, stacked on a phone
const column = (phone, share) => ({ flex: phone ? "none" : `0 0 ${share}%`, minWidth: 0 });

function FoodColumn({ h, phone }) {
  return (
    <div style={column(phone, 65)}>
      <div style={S.heading}>🥗 Add Food Entry</div>
      <AddFoodCard food={h.food} />
      <PhotoLogCard photo={h.photo} />
      <div style={{ display: "flex", gap: "10px" }}>
        <button onClick={() => h.saved.setOpen(true)} style={S.recipeButton("#378ADD")}>
          📖 Browse Saved Recipes
        </button>
        <button onClick={() => h.builder.startNew()} style={S.recipeButton("#185FA5")}>
          🤖 Create with Claude
        </button>
      </div>
    </div>
  );
}

const polarOf = (p) => ({
  connected: p.polarConnected,
  sessions: p.polarSessions,
  lastSync: p.polarLastSync,
  syncing: p.polarSyncing,
  syncMsg: p.polarSyncMsg,
  sync: p.syncPolar,
});

function ExerciseColumn({ p, h, phone }) {
  return (
    <div style={column(phone, 35)}>
      <div style={S.heading}>🏋️ Exercise</div>
      <button onClick={h.exercise.show} style={S.exerciseButton}>
        🏋️ Log Manual Exercise
      </button>
      <PolarCard
        userId={p.userId}
        polar={polarOf(p)}
        browse={h.browse}
        onLog={p.setPolarLogModal}
      />
      {/* Apple Watch steps by hour, for the Add Entry date */}
      <HourlyStepsCard userId={p.userId} date={p.addDate} />
    </div>
  );
}

function Boxes({ p, h }) {
  const editor = h.builder.preview && (
    <RecipeEditorForm builder={h.builder} recipes={p.userRecipes} />
  );
  const on = { pick: h.portion.open, edit: h.builder.openEditor, view: p.setRecipeModal };
  return (
    <>
      {h.browse.open && <PolarBrowseModal browse={h.browse} onLog={p.setPolarLogModal} />}
      {h.lookup.box && <FoodLookupModal lookup={h.lookup} />}
      {h.builder.open && <RecipeBuilderModal builder={h.builder} form={editor} />}
      {h.saved.open && <SavedRecipesModal saved={h.saved} recipes={p.userRecipes} on={on} />}
      {h.portion.recipe && <RecipePortionModal box={h.portion} onLoad={h.loadPortion} />}
      {h.exercise.open && (
        <ExerciseLogModal log={h.exercise} slots={mealSlotOptions(p.allDays, p.addDate)} />
      )}
    </>
  );
}

/**
 * Props: userId, allDays, currentDate, setCurrentDayData, userRecipes, setUserRecipes, addDate,
 * setAddDate, addMealId, setAddMealId, addMealName, addItem, setAddItem, addMsg, setAddMsg,
 * polarConnected, polarSessions, polarSyncing, polarLastSync, polarSyncMsg, syncPolar,
 * setPolarLogModal, persistDay, setRecipeModal.
 */
export default function AddEntry(props) {
  const h = useAddEntry(props);
  const phone = useIsPhone();
  const page = phone
    ? { ...S.page, flexDirection: "column", alignItems: "stretch", padding: "10px" }
    : S.page;
  return (
    <div style={page}>
      <FoodColumn h={h} phone={phone} />
      <ExerciseColumn p={props} h={h} phone={phone} />
      <Boxes p={props} h={h} />
    </div>
  );
}
