// src/hooks/useTracker.js — everything NutritionTracker shows and does, wired together: state,
// start-up loading, calculator, days, weight / body actions, Polar sync, weight box, chat.
import * as state from "./useTrackerState";
import { useCalculatorSettings } from "./useCalculatorSettings";
import { useTrackerLoad } from "./useTrackerLoad";
import { useTrackerDays } from "./useTrackerDays";
import { useWeightActions } from "./useWeightActions";
import { usePolarSync } from "./usePolarSync";
import { useWeightEntry } from "./useWeightEntry";
import { useChat } from "./useChat";

function useAllState() {
  return {
    ...state.useDayState(),
    ...state.useViewState(),
    ...state.useRecipeState(),
    ...state.usePolarState(),
    ...state.useWeightState(),
    ...state.useChatState(),
    ...state.useChatStatus(),
    ...state.useAddEntryState(),
  };
}

// The setters the start-up load fills in (see useTrackerLoad)
const loadSetters = (s, calc) => ({
  ...{ loading: s.setLoading, userRecipes: s.setUserRecipes, userRecipesRef: s.userRecipesRef },
  ...{ calc, weightPlanConfig: s.setWeightPlanConfig, editCfg: s.setEditCfg },
  ...{ weightLog: s.setWeightLog, bodyLog: s.setBodyLog, justChatHistory: s.setJustChatHistory },
  ...{ chatMessages: s.setChatMessages, polarConnected: s.setPolarConnected },
  ...{ polarLastSync: s.setPolarLastSync, polarSessions: s.setPolarSessions },
  ...{ polarSyncMsg: s.setPolarSyncMsg, allDays: s.setAllDays, currentDate: s.setCurrentDate },
  ...{ currentDayData: s.setCurrentDayData, chatDate: s.setChatDate },
  ...{ compareSlots: s.setCompareSlots, compareData: s.setCompareData },
  ...{ daysComplete: s.setDaysComplete },
});

/** The reference calculator's values and setters under the tabs' prop names. */
const calcProps = ({ values: v, setters }) => ({
  ...{ calcSex: v.sex, calcAge: v.age, calcHeight: v.height, calcWeight: v.weight },
  ...{ calcProtein: v.protein, calcFatPct: v.fatPct, ...setters },
});

export function useTracker(userId) {
  const s = { userId, ...useAllState() };
  const calc = useCalculatorSettings(userId);
  useTrackerLoad(userId, loadSetters(s, calc));
  const compare = { slots: s.compareSlots, data: s.compareData };
  const days = useTrackerDays({ ...s, compare });
  const actions = { ...useWeightActions(s), ...usePolarSync(s) };
  const weight = useWeightEntry(s);
  const t = { ...s, ...calcProps(calc), ...days, ...actions, weight };
  // Calendar clicks: weight box on Weight, a body row on Body, otherwise open the day
  t.onCalendarClick = (date) => {
    if (s.activeTab === "weight") weight.open(date);
    else if (s.activeTab === "body") actions.addBodyRow(date);
    else days.switchDay(date);
  };
  return { ...t, ...useChat(t) };
}
