// src/hooks/useTrackerState.js — NutritionTracker's state, in groups. Each returns its values
// and setters under the names the tabs and hooks use.
import { useRef, useState } from "react";
import { DEFAULT_PLAN_CONFIG } from "../constants/weightPlan";
import { EMPTY_FOOD } from "../lib/addFood.js";

const today = () => new Date().toISOString().split("T")[0];
const EMPTY_COMPARE = [null, null, null, null, null];

export function useDayState() {
  const [allDays, setAllDays] = useState([]);
  const [currentDate, setCurrentDate] = useState(null);
  const [currentDayData, setCurrentDayData] = useState(null);
  const [compareSlots, setCompareSlots] = useState(EMPTY_COMPARE);
  const [compareData, setCompareData] = useState(EMPTY_COMPARE);
  return {
    ...{ allDays, setAllDays, currentDate, setCurrentDate, currentDayData, setCurrentDayData },
    ...{ compareSlots, setCompareSlots, compareData, setCompareData },
  };
}

export function useViewState() {
  const [activeTab, setActiveTab] = useState("log");
  const [loading, setLoading] = useState(true);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [recipeModal, setRecipeModal] = useState(null);
  return {
    ...{ activeTab, setActiveTab, loading, setLoading, calYear, setCalYear },
    ...{ calMonth, setCalMonth, recipeModal, setRecipeModal },
  };
}

// The ref always holds the latest list (read by the background Wt/portion estimates)
export function useRecipeState() {
  const [userRecipes, setUserRecipes] = useState([]);
  const userRecipesRef = useRef([]);
  userRecipesRef.current = userRecipes;
  return { userRecipes, setUserRecipes, userRecipesRef };
}

export function usePolarState() {
  const [polarConnected, setPolarConnected] = useState(false);
  const [polarSessions, setPolarSessions] = useState([]);
  const [polarLastSync, setPolarLastSync] = useState(null);
  const [polarSyncMsg, setPolarSyncMsg] = useState(null);
  const [polarLogModal, setPolarLogModal] = useState(null);
  return {
    ...{ polarConnected, setPolarConnected, polarSessions, setPolarSessions, polarLastSync },
    ...{ setPolarLastSync, polarSyncMsg, setPolarSyncMsg, polarLogModal, setPolarLogModal },
  };
}

export function useWeightState() {
  const [weightLog, setWeightLog] = useState([]);
  const [weightPlanConfig, setWeightPlanConfig] = useState(DEFAULT_PLAN_CONFIG);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editCfg, setEditCfg] = useState(DEFAULT_PLAN_CONFIG);
  const [bodyLog, setBodyLog] = useState([]);
  return {
    ...{ weightLog, setWeightLog, weightPlanConfig, setWeightPlanConfig, editingPlan },
    ...{ setEditingPlan, editCfg, setEditCfg, bodyLog, setBodyLog },
  };
}

export function useChatState() {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMealId, setChatMealId] = useState("__chat__");
  const [chatDate, setChatDate] = useState(today);
  return {
    ...{ chatMessages, setChatMessages, chatInput, setChatInput },
    ...{ chatMealId, setChatMealId, chatDate, setChatDate },
  };
}

export function useChatStatus() {
  const [chatLoading, setChatLoading] = useState(false);
  const [justChatHistory, setJustChatHistory] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  return {
    ...{ chatLoading, setChatLoading, justChatHistory, setJustChatHistory },
    ...{ chatOpen, setChatOpen },
  };
}

export function useAddEntryState() {
  const [addDate, setAddDate] = useState(today);
  const [addMealId, setAddMealId] = useState("");
  const [addMealName, setAddMealName] = useState("");
  const [addItem, setAddItem] = useState(EMPTY_FOOD);
  const [addMsg, setAddMsg] = useState(null);
  return {
    ...{ addDate, setAddDate, addMealId, setAddMealId, addMealName, setAddMealName },
    ...{ addItem, setAddItem, addMsg, setAddMsg },
  };
}
