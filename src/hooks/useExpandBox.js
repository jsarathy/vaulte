// src/hooks/useExpandBox.js — a box that expands to fill the window on a double-click anywhere on
// it (not on a control) and collapses on a double-click anywhere on it or Esc.
import { useFullView } from "./useFullView.js";

const CONTROLS = "button, input, select, textarea, a";

/** { full, setFull, boxProps }: spread `boxProps` on the box; `full` says which size to draw. */
export function useExpandBox() {
  const [full, setFull] = useFullView();
  const boxProps = {
    onDoubleClick: (e) => {
      if (!e.target.closest(CONTROLS)) setFull(!full);
    },
    title: full ? "Double-click or press Esc to collapse" : "Double-click to expand",
  };
  return { full, setFull, boxProps };
}
