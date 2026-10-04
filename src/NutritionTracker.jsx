// src/NutritionTracker.jsx — the signed-in app: daily log, Compare, Add entry, Weight and Body
// tabs with the calendar sidebar and the Claude chat. Wiring in useTracker; page in TrackerFrame.
import { C, FONT } from "./constants/design.jsx";
import { useTracker } from "./hooks/useTracker";
import TrackerFrame from "./components/TrackerFrame";

export default function NutritionTracker({ userId }) {
  const t = useTracker(userId);
  if (t.loading)
    return (
      <div style={{ padding: "40px", textAlign: "center", color: C.muted, fontFamily: FONT.sans }}>
        Loading your log…
      </div>
    );
  return <TrackerFrame t={t} />;
}
