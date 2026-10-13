// src/hooks/useFullView.js — a view that can be expanded to fill the screen and collapsed again
// (double-click, or Esc while it is expanded).
import { useEffect, useState } from "react";

/** [full, setFull]; Esc collapses while `full`. */
export function useFullView() {
  const [full, setFull] = useState(false);
  useEffect(() => {
    if (!full) return undefined;
    const onKey = (e) => e.key === "Escape" && setFull(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);
  return [full, setFull];
}
