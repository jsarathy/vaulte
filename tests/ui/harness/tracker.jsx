// The full NutritionTracker inside the real page structure (transformed .fade-up wrapper).
import { createRoot } from "react-dom/client";
import NutritionTracker from "../../../src/NutritionTracker.jsx";
createRoot(document.getElementById("root")).render(
  <div className="fade-up" style={{ transform: "translateY(0)", height: "100vh" }}>
    <NutritionTracker userId="u" />
  </div>,
);
