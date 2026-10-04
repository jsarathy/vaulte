// src/tabs/AddEntry.jsx
import HourlyStepsCard from "../components/HourlyStepsCard";
import RecipePortionModal from "../components/RecipePortionModal";
import { useRecipePortion } from "../hooks/useRecipePortion";
import RecipeBuilderModal from "../components/RecipeBuilderModal";
import RecipeEditorForm from "../components/RecipeEditorForm";
import FoodLookupModal from "../components/FoodLookupModal";
import SavedRecipesModal from "../components/SavedRecipesModal";
import { useSavedRecipes } from "../hooks/useSavedRecipes";
import PolarSessionsPanel from "../components/PolarSessionsPanel";
import PolarBrowseModal from "../components/PolarBrowseModal";
import { usePolarBrowse } from "../hooks/usePolarBrowse";
import AddFoodCard from "../components/AddFoodCard";
import { useAddFood } from "../hooks/useAddFood";
import PhotoLogCard from "../components/PhotoLogCard";
import { usePhotoLog } from "../hooks/usePhotoLog";
import ExerciseLogModal from "../components/ExerciseLogModal";
import { useExerciseLog } from "../hooks/useExerciseLog";
import { mealSlotOptions } from "../lib/exerciseLog.js";
import { useFoodLookup } from "../hooks/useFoodLookup";
import { useRecipeBuilder } from "../hooks/useRecipeBuilder";

// Local style shorthand
const S = {
  main: { flex: 1, overflowY: "auto", padding: "14px 16px", background: "#f9fafb" },
};

export default function AddEntry({
  userId,
  allDays,
  currentDate,
  setCurrentDayData,
  userRecipes,
  setUserRecipes,
  addDate,
  setAddDate,
  addMealId,
  setAddMealId,
  addMealName,
  addItem,
  setAddItem,
  addMsg,
  setAddMsg,
  polarConnected,
  polarSessions,
  polarSyncing,
  polarLastSync,
  polarSyncMsg,
  syncPolar,
  setPolarLogModal,
  persistDay,
  setRecipeModal,
}) {
  const exercise = useExerciseLog({
    userId,
    allDays,
    addDate,
    currentDate,
    setCurrentDayData,
    persistDay,
  });
  const browse = usePolarBrowse(userId);
  const saved = useSavedRecipes({ userId, userRecipes, setUserRecipes });
  const builder = useRecipeBuilder({
    userId,
    userRecipes,
    setUserRecipes,
    setAddItem,
    setRecipeNotice: saved.setNotice,
    setShowRecipesModal: saved.setOpen,
  });
  // "Get Nutrition" box for a food that isn't a saved recipe
  const lookup = useFoodLookup({
    userId,
    userRecipes,
    setUserRecipes,
    setAddItem,
    addToDay: (item) => food.addToDay(item),
    startRecipe: (name) => builder.startNew({ input: name }),
  });
  // Recipe portion box — lets user scale macros before adding a saved recipe
  const portion = useRecipePortion();
  const loadPortion = (item) => {
    setAddItem(item);
    portion.close();
    saved.setOpen(false);
  };

  const photo = usePhotoLog({
    userId,
    allDays,
    addDate,
    addMealId,
    currentDate,
    setCurrentDayData,
    persistDay,
    setAddItem,
    setAddMsg,
    startRecipe: (preview) => builder.startNew({ preview }),
  });

  const food = useAddFood({
    userId,
    allDays,
    userRecipes,
    addDate,
    setAddDate,
    addMealId,
    setAddMealId,
    addMealName,
    currentDate,
    addItem,
    setAddItem,
    addMsg,
    setAddMsg,
    persistDay,
    setCurrentDayData,
    lookup,
    portion,
  });

  return (
    <div style={{ ...S.main, display: "flex", gap: "14px", alignItems: "flex-start" }}>
      {/* ── LEFT: Food (65%) ── */}
      <div style={{ flex: "0 0 65%", minWidth: 0 }}>
        <div
          style={{ fontSize: "16px", fontWeight: "bold", color: "#185FA5", marginBottom: "12px" }}
        >
          🥗 Add Food Entry
        </div>
        <AddFoodCard food={food} />

        {/* Photo Log */}
        <PhotoLogCard photo={photo} />

        {/* Recipe action buttons */}
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={() => saved.setOpen(true)}
            style={{
              flex: 1,
              background: "#378ADD",
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
            }}
          >
            📖 Browse Saved Recipes
          </button>
          <button
            onClick={() => builder.startNew()}
            style={{
              flex: 1,
              background: "#185FA5",
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
            }}
          >
            🤖 Create with Claude
          </button>
        </div>
      </div>

      {/* ── RIGHT: Exercise (35%) ── */}
      <div style={{ flex: "0 0 35%", minWidth: 0 }}>
        <div
          style={{ fontSize: "16px", fontWeight: "bold", color: "#185FA5", marginBottom: "12px" }}
        >
          🏋️ Exercise
        </div>
        <button
          onClick={exercise.show}
          style={{
            width: "100%",
            background: "#378ADD",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "10px",
            fontSize: "13px",
            fontWeight: "bold",
            cursor: "pointer",
            marginBottom: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          🏋️ Log Manual Exercise
        </button>

        {/* Polar Sessions panel */}
        <div
          style={{
            background: "#fff",
            borderRadius: "8px",
            border: "0.5px solid #e5e7eb",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              background: "#185FA5",
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                color: "#fff",
                fontWeight: "bold",
                fontSize: "13px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <span style={{ fontSize: "16px" }}>📡</span> Polar Sessions
            </div>
            {polarConnected && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    fontSize: "10px",
                    color: "#90CAF9",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: "#4CAF50",
                      display: "inline-block",
                    }}
                  />
                  Connected
                </div>
                <button
                  onClick={syncPolar}
                  disabled={polarSyncing}
                  style={{
                    background: polarSyncing ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.2)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "#fff",
                    borderRadius: "4px",
                    padding: "2px 8px",
                    fontSize: "10px",
                    cursor: polarSyncing ? "not-allowed" : "pointer",
                    fontWeight: "bold",
                  }}
                >
                  {polarSyncing ? "⏳ Syncing…" : "🔄 Sync"}
                </button>
                <button
                  onClick={async () => {
                    console.log("Reconnect clicked, userId:", userId);
                    if (!userId) {
                      alert("Not logged in — please refresh and try again.");
                      return;
                    }
                    if (
                      !confirm(
                        "This will re-authorise your Polar account with updated permissions (needed for HR data). Continue?",
                      )
                    )
                      return;
                    const btn = document.getElementById("polar-reconnect-btn");
                    if (btn) btn.textContent = "Working…";
                    try {
                      const r = await fetch("/api/polar-disconnect", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ userId }),
                      });
                      const d = await r.json();
                      console.log("Disconnect result:", d);
                    } catch (e) {
                      console.warn("Disconnect failed, continuing:", e);
                    }
                    window.location.href = `/api/polar-auth?userId=${userId}`;
                  }}
                  id="polar-reconnect-btn"
                  title="Re-authorise with updated permissions for HR data"
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "rgba(255,255,255,0.6)",
                    borderRadius: "4px",
                    padding: "2px 8px",
                    fontSize: "10px",
                    cursor: "pointer",
                  }}
                >
                  Reconnect
                </button>
              </div>
            )}
          </div>
          {polarSyncMsg && (
            <div
              style={{
                padding: "7px 12px",
                fontSize: "11px",
                fontWeight: "bold",
                background: polarSyncMsg.ok ? "#E8F5E9" : "#FFEBEE",
                color: polarSyncMsg.ok ? "#2E7D32" : "#c62828",
                borderBottom: "0.5px solid #e5e7eb",
              }}
            >
              {polarSyncMsg.text}
            </div>
          )}
          <div style={{ padding: "12px" }}>
            <PolarSessionsPanel
              userId={userId}
              polar={{
                connected: polarConnected,
                sessions: polarSessions,
                lastSync: polarLastSync,
              }}
              browse={browse}
              onLog={setPolarLogModal}
            />
          </div>
        </div>

        {/* Apple Watch steps by hour, for the Add Entry date */}
        <HourlyStepsCard userId={userId} date={addDate} />
      </div>

      {/* ── Browse All Polar Sessions Modal ── */}
      {browse.open && <PolarBrowseModal browse={browse} onLog={setPolarLogModal} />}

      {/* ── Get Nutrition (quantity) Modal ── */}
      {lookup.box && <FoodLookupModal lookup={lookup} />}

      {/* ── Recipe Builder Modal ── */}
      {builder.open && (
        <RecipeBuilderModal
          builder={builder}
          form={builder.preview && <RecipeEditorForm builder={builder} recipes={userRecipes} />}
        />
      )}

      {/* ── Saved Recipes Modal ── */}
      {saved.open && (
        <SavedRecipesModal
          saved={saved}
          recipes={userRecipes}
          on={{ pick: portion.open, edit: builder.openEditor, view: setRecipeModal }}
        />
      )}

      {/* ── Recipe Portion Modal ── */}
      {portion.recipe && <RecipePortionModal box={portion} onLoad={loadPortion} />}

      {/* ── Exercise Picker Modal ── */}
      {exercise.open && (
        <ExerciseLogModal log={exercise} slots={mealSlotOptions(allDays, addDate)} />
      )}
    </div>
  );
}
