// src/components/HourlyStepsCard.jsx — Apple Watch steps by hour for one day (from apple_activity.hourly)
import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function HourlyStepsCard({ userId, date: dateProp }) {
  // Own date, so any day can be browsed; follows the Add Entry date when that changes.
  const [date, setDate] = useState(dateProp);
  useEffect(() => { setDate(dateProp); }, [dateProp]);
  const pickerRef = useRef(null);
  const openPicker = () => {
    const el = pickerRef.current;
    if (!el) return;
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };
  const today = new Date().toLocaleDateString("en-CA");
  const fmtDate = d => d ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short", year:"numeric" }) : "";
  const [hourly, setHourly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState(null);

  useEffect(() => {
    if (!userId || !date) return;
    setLoading(true);
    const unsub = onSnapshot(doc(db, "users", userId, "apple_activity", date),
      s => { setHourly(s.exists() ? (s.data().hourly || null) : null); setLoading(false); },
      e => { console.error("hourly steps listen failed:", e); setHourly(null); setLoading(false); });
    return unsub;
  }, [userId, date]);

  const vals = Array.from({ length: 24 }, (_, h) => Number(hourly?.[String(h).padStart(2, "0")]) || 0);
  const total = vals.reduce((a, b) => a + b, 0);
  const max = Math.max(...vals, 1);
  const peak = vals.indexOf(Math.max(...vals));

  const W = 300, H = 110, PAD = { l: 4, r: 4, t: 8, b: 16 };
  const cW = W - PAD.l - PAD.r, cH = H - PAD.t - PAD.b, bw = cW / 24;
  const hh = h => `${String(h).padStart(2, "0")}:00`;

  return (
    <div style={{ background:"#fff", borderRadius:"8px", border:"0.5px solid #e5e7eb", overflow:"hidden", marginTop:"14px" }}>
      <div style={{ background:"#185FA5", padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ color:"#fff", fontWeight:"bold", fontSize:"13px", display:"flex", alignItems:"center", gap:"6px" }}>
          <span style={{ fontSize:"16px" }}>⌚</span> Steps by hour
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", position:"relative" }}>
          <span style={{ color:"rgba(255,255,255,0.8)", fontSize:"11px" }}>{fmtDate(date)}</span>
          <button onClick={openPicker} title="Pick a day"
            style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", borderRadius:"4px", padding:"3px 8px", fontSize:"11px", cursor:"pointer" }}>
            📅 Browse by date
          </button>
          {/* Native calendar, opened by the button */}
          <input ref={pickerRef} type="date" value={date || ""} max={today}
            onChange={e => e.target.value && setDate(e.target.value)}
            style={{ position:"absolute", right:0, bottom:0, width:"1px", height:"1px", opacity:0, pointerEvents:"none" }}/>
        </div>
      </div>
      <div style={{ padding:"10px 12px" }}>
        {loading ? (
          <div style={{ fontSize:"12px", color:"#9ca3af" }}>loading…</div>
        ) : !total ? (
          <div style={{ fontSize:"12px", color:"#9ca3af", fontStyle:"italic" }}>No hourly steps synced for this day yet</div>
        ) : (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:"11px", color:"#6b7280", marginBottom:"4px" }}>
              <span>{hover != null ? `${hh(hover)}–${hh((hover + 1) % 24)} · ${vals[hover].toLocaleString()} steps` : `${total.toLocaleString()} steps`}</span>
              <span>peak {hh(peak)}</span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display:"block" }} onMouseLeave={() => setHover(null)}>
              {[0.5, 1].map(f => (
                <line key={f} x1={PAD.l} x2={W - PAD.r} y1={PAD.t + cH * (1 - f)} y2={PAD.t + cH * (1 - f)} stroke="#f0f0f0" strokeWidth="0.5"/>
              ))}
              {vals.map((v, h) => {
                const bh = (v / max) * cH;
                return (
                  <g key={h} onMouseEnter={() => setHover(h)}>
                    <rect x={PAD.l + h * bw} y={PAD.t} width={bw} height={cH} fill="transparent"/>
                    <rect x={PAD.l + h * bw + bw * 0.15} y={PAD.t + cH - bh} width={bw * 0.7} height={Math.max(bh, v ? 1 : 0)}
                      rx="1" fill={hover === h ? "#185FA5" : "#378ADD"}/>
                  </g>
                );
              })}
              <line x1={PAD.l} x2={W - PAD.r} y1={PAD.t + cH} y2={PAD.t + cH} stroke="#9ca3af" strokeWidth="0.5"/>
              {[0, 6, 12, 18].map(h => (
                <text key={h} x={PAD.l + h * bw} y={H - 4} fontSize="8" fill="#6b7280">{String(h).padStart(2, "0")}</text>
              ))}
            </svg>
          </>
        )}
      </div>
    </div>
  );
}
