// AddEntry inside the real page structure (header + transformed .fade-up wrapper), with saved-recipe state and the Wt/portion backfill wired as in NutritionTracker.
import { useState, useRef, useEffect } from "react";
import { backfillPortionWeights } from "../../../src/api/recipeWeights";
import { createRoot } from "react-dom/client";
import AddEntry from "../../../src/tabs/AddEntry.jsx";
import RecipeModal from "../../../src/components/RecipeModal.jsx";
import { INITIAL_RECIPES } from "../../../src/constants/recipes";
function H() {
  const [userRecipes, setUserRecipes] = useState(
    [...INITIAL_RECIPES].sort((a, b) => a.name.localeCompare(b.name)),
  );
  const [addItem, setAddItem] = useState({
    name: "",
    kcal: "",
    fat: "",
    sat_fat: "",
    carbs: "",
    sugar: "",
    fibre: "",
    net_carbs: "",
    protein: "",
  });
  const [addDate, setAddDate] = useState("2026-10-03");
  const [addMealId, setAddMealId] = useState("");
  const [addMealName, setAddMealName] = useState("");
  const [addMsg, setAddMsg] = useState(null);
  const [recipeModal, setRecipeModal] = useState(null);
  window.__state = { userRecipes, addItem };
  window.__setRecipes = setUserRecipes;
  const userRecipesRef = useRef([]);
  userRecipesRef.current = userRecipes;
  useEffect(() => {
    const go = () => backfillPortionWeights("u", () => userRecipesRef.current, setUserRecipes);
    window.__backfill = go;
    if (!window.__noBackfill) go();
  }, []);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ height: 60, background: "#185FA5" }} />
      <div
        className="fade-up"
        style={{ transform: "translateY(0)", flex: 1, display: "flex", overflow: "hidden" }}
      >
        <AddEntry
          userId="u"
          allDays={[]}
          currentDate="2026-10-03"
          currentDayData={null}
          setCurrentDayData={() => {}}
          userRecipes={userRecipes}
          setUserRecipes={setUserRecipes}
          addDate={addDate}
          setAddDate={setAddDate}
          addMealId={addMealId}
          setAddMealId={setAddMealId}
          addMealName={addMealName}
          setAddMealName={setAddMealName}
          addItem={addItem}
          setAddItem={setAddItem}
          addMsg={addMsg}
          setAddMsg={setAddMsg}
          polarConnected={!!window.__polar?.connected}
          polarSessions={window.__polar?.sessions || []}
          setPolarSessions={() => {}}
          polarSyncing={false}
          polarLastSync={window.__polar?.lastSync || null}
          polarSyncMsg={null}
          syncPolar={() => {}}
          setPolarLogModal={(s) => (window.__polarLog = s)}
          persistDay={async () => {}}
          setRecipeModal={setRecipeModal}
        />
      </div>
      <RecipeModal recipe={recipeModal} onClose={() => setRecipeModal(null)} />
    </div>
  );
}
createRoot(document.getElementById("root")).render(<H />);
