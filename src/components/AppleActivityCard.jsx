// src/components/AppleActivityCard.jsx — daily Apple Watch steps / active minutes / flights + kcal
import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { C, FONT } from "../constants/design.jsx";
import { calcAppleActivity } from "../constants/helpers";

export default function AppleActivityCard({ userId, date, dayData, weightKg, collapsed = false, onToggle, onKcal }) {
  const [activity, setActivity] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading]   = useState(true);

  const polarIds = (dayData?.meals || []).flatMap(m => (m.items || []).map(i => i.polar_session_id).filter(Boolean));
  const polarKey = polarIds.join(",");

  useEffect(() => {
    if (!userId || !date) return;
    let cancelled = false;
    setLoading(true);
    getDoc(doc(db, "users", userId, "apple_activity", date))
      .then(s => { if (!cancelled) setActivity(s.exists() ? s.data() : null); })
      .catch(e => { console.error("apple_activity load failed:", e); if (!cancelled) setActivity(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, date]);

  useEffect(() => {
    if (!userId || !polarKey) { setSessions([]); return; }
    let cancelled = false;
    Promise.all(polarKey.split(",").map(id => getDoc(doc(db, "users", userId, "polar_sessions", id))))
      .then(snaps => { if (!cancelled) setSessions(snaps.filter(s => s.exists()).map(s => s.data())); })
      .catch(e => console.error("polar sessions load failed:", e));
    return () => { cancelled = true; };
  }, [userId, polarKey]);

  const hasData = (!!activity?.slots && Object.keys(activity.slots).length > 0) || !!activity?.totals;
  const a = calcAppleActivity(activity?.slots, sessions, weightKg, activity?.totals);
  const ex = a.excluded;
  const hasExcluded = ex.steps || ex.activeMin || ex.flights;
  const synced = activity?.updated_at
    ? new Date(activity.updated_at).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" })
    : null;

  // Report Apple kcal up to the Daily log so it counts towards exercise burned
  const reportedKcal = !loading && hasData ? a.kcal.total : 0;
  useEffect(() => { onKcal?.(reportedKcal); }, [reportedKcal]); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = [
    ["Steps",          a.steps.toLocaleString(), a.kcal.steps],
    ["Active minutes", `${a.activeMin} min`,     a.kcal.active],
    ["Flights climbed", a.flights,               a.kcal.flights],
  ];
  const cell = { padding:"7px 10px", fontSize:"12px", borderBottom:`0.5px solid ${C.border}` };
  const num  = { ...cell, textAlign:"right", fontFamily:FONT.mono, fontSize:"11px" };

  return (
    <div style={{ background:"#fff", border:`0.5px solid ${C.border}`, borderRadius:"8px", marginBottom:"8px", overflow:"hidden" }}>
      <div onClick={onToggle}
        style={{ padding:"8px 10px 8px 8px", cursor:onToggle ? "pointer" : "default", background:collapsed ? "#fff" : C.bg,
          borderBottom:collapsed ? "none" : `0.5px solid ${C.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={C.hint} strokeWidth="1.5" strokeLinecap="round"
            style={{ flexShrink:0, transition:"transform 0.18s", transform:collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}>
            <path d="M2 3.5l3 3 3-3"/>
          </svg>
          <span style={{ fontSize:"12px", fontWeight:"500", color:C.blueText }}>⌚ Apple Watch Activity</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <span style={{ fontSize:"10px", color:C.hint, fontFamily:FONT.mono }}>
            {loading ? "loading…" : synced ? `synced ${synced}` : ""}
          </span>
          {collapsed && (
            <span style={{ fontSize:"11px", fontFamily:FONT.mono, fontWeight:hasData ? "500" : "400", color:hasData ? C.blueText : C.border }}>
              {hasData ? `${a.steps.toLocaleString()} steps · ${a.kcal.total} kcal` : "—"}
            </span>
          )}
        </div>
      </div>
      {collapsed ? null : !loading && !hasData ? (
        <div style={{ padding:"10px 12px", fontSize:"12px", color:C.hint, fontStyle:"italic" }}>No Apple Watch data synced for this day yet</div>
      ) : (
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr>
              {["", "Count", "kcal"].map((h, i) => (
                <th key={i} style={{ color:C.hint, fontSize:"10px", fontWeight:"500", textTransform:"uppercase", letterSpacing:"0.4px",
                  padding:"5px 10px", textAlign:i ? "right" : "left", borderBottom:`0.5px solid ${C.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([lbl, val, kcal]) => (
              <tr key={lbl}>
                <td style={{ ...cell, color:C.text }}>{lbl}</td>
                <td style={{ ...num, color:C.muted }}>{val}</td>
                <td style={{ ...num, color:C.blueText }}>{kcal}</td>
              </tr>
            ))}
            <tr style={{ background:C.bg }}>
              <td style={{ ...cell, fontWeight:"500", color:C.text, borderBottom:"none" }}>Total</td>
              <td style={{ ...num, borderBottom:"none" }}/>
              <td style={{ ...num, fontWeight:"500", color:C.blueText, borderBottom:"none" }}>{a.kcal.total}</td>
            </tr>
          </tbody>
        </table>
      )}
      {!collapsed && hasData && hasExcluded ? (
        <div style={{ padding:"6px 10px", fontSize:"10px", color:C.hint, borderTop:`0.5px solid ${C.border}`, fontFamily:FONT.mono }}>
          Excludes {ex.steps.toLocaleString()} steps · {ex.activeMin} min · {ex.flights} flights during Polar sessions{activity?.mode==="daily" ? " (estimated)" : ""}
        </div>
      ) : null}
    </div>
  );
}
