// src/NutritionTracker.jsx — the signed-in app: daily log, Compare, Add entry, Weight and Body
// tabs with the calendar sidebar and the Claude chat. Wiring in useTracker; page in TrackerFrame.
import { useTracker } from "./hooks/useTracker";
import TrackerFrame from "./components/TrackerFrame";
import StartSkeleton from "./components/StartSkeleton";

export default function NutritionTracker({ userId }) {
  const t = useTracker(userId);
  if (t.loading) return <StartSkeleton />;
  return <TrackerFrame t={t} />;
}
