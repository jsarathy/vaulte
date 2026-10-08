// src/components/TrackerTabs.jsx — NutritionTracker's tab content. Render only; t = useTracker().
import { C } from "../constants/design.jsx";
import { useIsPhone } from "../hooks/useIsPhone.js";
import LogTab from "../tabs/LogTab";
import CompareTab from "../tabs/CompareTab";
import AddEntry from "../tabs/AddEntry";
import WeightTracker from "../tabs/WeightTracker";
import BodyTracker from "../tabs/BodyTracker";

const calc = (t) => ({
  calcSex: t.calcSex,
  calcAge: t.calcAge,
  calcHeight: t.calcHeight,
  calcWeight: t.calcWeight,
  calcProtein: t.calcProtein,
  calcFatPct: t.calcFatPct,
});

function DailyLog({ t }) {
  const padding = useIsPhone() ? "10px" : "14px 16px";
  return (
    <div style={{ flex: 1, overflowY: "auto", padding, background: C.bg }}>
      <LogTab
        userId={t.userId}
        currentDate={t.currentDate}
        currentDayData={t.currentDayData}
        allDays={t.allDays}
        switchDay={t.switchDay}
        userRecipes={t.userRecipes}
        setRecipeModal={t.setRecipeModal}
        deleteItem={t.deleteItem}
        {...calc(t)}
      />
    </div>
  );
}

function Compare({ t }) {
  return (
    <CompareTab
      compareSlots={t.compareSlots}
      setCompareSlots={t.setCompareSlots}
      compareData={t.compareData}
      setCompareData={t.setCompareData}
      allDays={t.allDays}
      {...calc(t)}
      setCalcSex={t.setCalcSex}
      setCalcAge={t.setCalcAge}
      setCalcHeight={t.setCalcHeight}
      setCalcWeight={t.setCalcWeight}
      setCalcProtein={t.setCalcProtein}
      setCalcFatPct={t.setCalcFatPct}
    />
  );
}

const ADD_ENTRY_PROPS = [
  ...["userId", "allDays", "currentDate", "currentDayData", "setCurrentDayData"],
  ...["userRecipes", "setUserRecipes", "addDate", "setAddDate", "addMealId", "setAddMealId"],
  ...["addMealName", "setAddMealName", "addItem", "setAddItem", "addMsg", "setAddMsg"],
  ...["polarConnected", "polarSessions", "setPolarSessions", "polarSyncing", "polarLastSync"],
  ...["polarSyncMsg", "syncPolar", "setPolarLogModal", "persistDay", "setRecipeModal"],
];
const pick = (t, keys) => Object.fromEntries(keys.map((k) => [k, t[k]]));

function Weight({ t }) {
  return (
    <WeightTracker
      userId={t.userId}
      weightLog={t.weightLog}
      setWeightLog={t.setWeightLog}
      renphoSyncing={t.renphoSyncing}
      renphoMsg={t.renphoMsg}
      syncRenpho={t.syncRenpho}
      purgeBefore={t.purgeBefore}
      weightPlanConfig={t.weightPlanConfig}
      setWeightPlanConfig={t.setWeightPlanConfig}
      editingPlan={t.editingPlan}
      setEditingPlan={t.setEditingPlan}
      editCfg={t.editCfg}
      setEditCfg={t.setEditCfg}
      savePlanConfig={t.savePlanConfig}
    />
  );
}

/** The open tab. */
export default function TrackerTabs({ t }) {
  return (
    <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      {t.activeTab === "log" && <DailyLog t={t} />}
      {t.activeTab === "compare" && <Compare t={t} />}
      {t.activeTab === "add" && <AddEntry {...pick(t, ADD_ENTRY_PROPS)} />}
      {t.activeTab === "weight" && <Weight t={t} />}
      {t.activeTab === "body" && (
        <BodyTracker
          userId={t.userId}
          bodyLog={t.bodyLog}
          setBodyLog={t.setBodyLog}
          sex={t.weightPlanConfig?.sex}
        />
      )}
    </div>
  );
}
