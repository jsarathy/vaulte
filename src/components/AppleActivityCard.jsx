// src/components/AppleActivityCard.jsx — daily Apple Watch steps / active minutes / flights + kcal
import AppleActivityHeader from "./AppleActivityHeader";
import AppleActivityTable from "./AppleActivityTable";
import { useAppleActivity } from "../hooks/useAppleActivity";
import { cardStyle, noteStyle } from "../styles/appleActivityStyles";

function ExcludedNote({ s }) {
  const ex = s.a.excluded;
  return (
    <div style={noteStyle}>
      Excludes {ex.steps.toLocaleString()} steps · {ex.activeMin} min · {ex.flights} flights during
      Polar sessions{s.estimated ? " (estimated)" : ""}
    </div>
  );
}

export default function AppleActivityCard({ collapsed = false, onToggle, ...props }) {
  const s = useAppleActivity(props);
  return (
    <div style={cardStyle}>
      <AppleActivityHeader collapsed={collapsed} onToggle={onToggle} s={s} />
      {collapsed ? null : <AppleActivityTable loading={s.loading} hasData={s.hasData} a={s.a} />}
      {!collapsed && s.hasData && s.hasExcluded ? <ExcludedNote s={s} /> : null}
    </div>
  );
}
