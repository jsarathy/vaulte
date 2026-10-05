// src/hooks/useAppleKcal.js — the Apple Watch kcal AppleActivityCard reports for the open day
// (counted towards the Daily log's exercise burned); back to 0 when the day changes.
import { useEffect, useState } from "react";

export function useAppleKcal(date) {
  const [appleKcal, setAppleKcal] = useState(0);
  useEffect(() => {
    setAppleKcal(0);
  }, [date]);
  return [appleKcal, setAppleKcal];
}
