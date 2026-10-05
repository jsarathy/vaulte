// src/hooks/useCollapsedMeals.js — which Daily log cards are open, remembered in localStorage.
import { useEffect, useState } from "react";
import { isClosed, parseCollapsed, toggled } from "../lib/mealCards.js";

const LS_KEY = "vaulte_collapsed_meals";

function loadCollapsed() {
  try {
    return parseCollapsed(localStorage.getItem(LS_KEY));
  } catch {
    return {}; // storage unavailable
  }
}

export function useCollapsedMeals() {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(collapsed));
    } catch {
      /* storage unavailable — not remembered */
    }
  }, [collapsed]);
  return {
    isClosed: (id) => isClosed(collapsed, id),
    toggle: (id) => setCollapsed((prev) => toggled(prev, id)),
  };
}
