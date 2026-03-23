// src/tabs/LogTab.jsx
import { useState, useEffect } from "react";
import { getDoc, doc } from "firebase/firestore";
import { db } from "../firebase";
import { fmt, formatDate, ACTIVITY_LEVELS, calcMacros, getDayTotals, calcFatBurned } from "../constants/helpers";
import { C, FONT, border, IconX, IconChevronLeft, IconChevronRight } from "../constants/design.jsx";
import HRChart from "../components/HRChart.jsx";

const LS_KEY = "vaulte_collapsed_meals";

function loadCollapsed() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}
function saveCollapsed(state) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch {}
}

// ── Polar Detail Modal ────────────────────────────────────────────────────────
function PolarDetailModal({ session, onClose, userId, onHRLoaded }) {
  const [fetchingHR, setFetchingHR] = useState(false);
  const [hrError, setHrError] = useState("");

  if (!session) return null;
  const s = session;
  const sport = s.sport ? s.sport.replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()) : "Exercise";
  const d = s.start_time ? new Date(s.start_time) : null;
  const dateStr = d ? d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"}) : "";
  const timeStr = d ? d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "";

  // Compute fat burned from session data
  const fatBurned = calcFatBurned(s.calories, s.fat_pct);
  const fatBurnedKcal = fatBurned?.fatKcal ?? null;
  const fatBurnedG    = fatBurned?.fatGrams ?? null;

  const stats = [
    ["Duration",    `${Math.round(s.duration_min||0)} min`],
    ["Calories",    `${s.calories} kcal`],
    s.hr_avg      ? ["Avg HR",       `${s.hr_avg} bpm`]         : null,
    s.hr_max      ? ["Max HR",       `${s.hr_max} bpm`]         : null,
    s.fat_pct != null ? ["Fat burn %", `${s.fat_pct}%`]         : null,
    fatBurnedKcal != null ? ["Fat burned", `${fatBurnedG}g · ${fatBurnedKcal} kcal`] : null,
    s.device      ? ["Device",       s.device]                   : null,
  ].filter(Boolean);

  const fetchHR = async () => {
    setFetchingHR(true); setHrError("");
    try {
      const res = await fetch("/api/polar-fetch-hr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, sessionId: s.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setHrError(data.message || data.error || "Failed to fetch HR data.");
      } else {
        onHRLoaded({ ...s, hr_samples: data.hr_samples, recording_rate_s: data.recording_rate_s });
      }
    } catch (e) {
      setHrError("Network error — try again.");
    } finally {
      setFetchingHR(false);
    }
  };

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
      <div style={{ background:"#fff",borderRadius:"10px",width:"520px",maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",border:`0.5px solid ${C.border}`,fontFamily:FONT.sans }}>

        {/* Header */}
        <div style={{ padding:"14px 18px",borderBottom:border,display:"flex",justifyContent:"space-between",alignItems:"flex-start",position:"sticky",top:0,background:"#fff",zIndex:1 }}>
          <div>
            <div style={{ fontSize:"14px",fontWeight:"500",color:C.text }}>{sport}</div>
            <div style={{ fontSize:"11px",color:C.muted,marginTop:"2px" }}>{dateStr}{timeStr?` · ${timeStr}`:""}</div>
          </div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:"18px",lineHeight:1,marginLeft:"12px" }}>×</button>
        </div>

        <div style={{ padding:"16px 18px" }}>
          {/* Stats grid */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"7px",marginBottom:"16px" }}>
            {stats.map(([lbl,val])=>(
              <div key={lbl} style={{ background:C.bg,borderRadius:"6px",padding:"9px 11px",border:`0.5px solid ${C.border}` }}>
                <div style={{ fontSize:"10px",color:C.hint,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:"3px" }}>{lbl}</div>
                <div style={{ fontFamily:FONT.mono,fontWeight:"500",fontSize:"14px",color:C.text }}>{val}</div>
              </div>
            ))}
          </div>

          {/* HR chart or fetch button */}
          {s.hr_samples?.length > 1 ? (
            <HRChart session={s}/>
          ) : (
            <div style={{ background:C.bg,borderRadius:"6px",border:`0.5px solid ${C.border}`,padding:"16px",textAlign:"center" }}>
              <div style={{ fontSize:"12px",color:C.muted,marginBottom:"12px" }}>
                Heart rate data wasn't captured at sync time.
              </div>
              {(s.exercise_url || s.polar_user_id) && (
                <>
                  <button onClick={fetchHR} disabled={fetchingHR}
                    style={{ background:fetchingHR?C.hint:C.blue,color:"#fff",border:"none",borderRadius:"6px",
                      padding:"8px 18px",cursor:fetchingHR?"not-allowed":"pointer",fontSize:"12px",
                      fontWeight:"500",fontFamily:FONT.sans }}>
                    {fetchingHR ? "Fetching…" : "Fetch HR data"}
                  </button>
                  {hrError && <div style={{ fontSize:"11px",color:C.danger,marginTop:"8px" }}>{hrError}</div>}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LogTab({ userId, currentDate, currentDayData, allDays, switchDay, userRecipes, setRecipeModal, deleteItem, calcSex, calcAge, calcHeight, calcWeight, calcProtein, calcFatPct }) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [polarDetail, setPolarDetail] = useState(null); // loaded session object
  const [polarLoading, setPolarLoading] = useState(null); // item id being loaded

  useEffect(() => { saveCollapsed(collapsed); }, [collapsed]);

  const openPolarDetail = async (item) => {
    if (!item.polar_session_id || !userId) return;
    setPolarLoading(item.id);
    try {
      const snap = await getDoc(doc(db, "users", userId, "polar_sessions", item.polar_session_id));
      if (snap.exists()) setPolarDetail(snap.data());
    } catch (e) { console.error("Failed to load polar session:", e); }
    finally { setPolarLoading(null); }
  };

  if (!currentDayData) return <div style={{ padding:"40px", textAlign:"center", color:C.muted }}>Select a day to get started</div>;

  const totals = getDayTotals(currentDayData);
  const BMR = calcSex==="m" ? 10*calcWeight+6.25*calcHeight-5*calcAge+5 : 10*calcWeight+6.25*calcHeight-5*calcAge-161;
  let activeTierIdx = 0;
  if (totals.exerciseBurned>300) activeTierIdx=3;
  else if (totals.exerciseBurned>150) activeTierIdx=2;
  else if (totals.exerciseBurned>0) activeTierIdx=1;
  const activeTier = ACTIVITY_LEVELS[activeTierIdx];
  const tdee = Math.round(BMR * activeTier.factor);
  const macroTgt = calcMacros(tdee, calcWeight, calcProtein, calcFatPct/100);
  const pct = Math.min(100, Math.round((totals.foodKcal/tdee)*100));
  const remaining = tdee - totals.foodKcal;
  const netKcal = totals.foodKcal - totals.exerciseBurned;
  const netRemaining = tdee - netKcal;
  const netPct = Math.min(100, Math.round((netKcal/tdee)*100));
  const macros = [["P",totals.protein,macroTgt.protein_g,"blue"],["F",totals.fat,macroTgt.fat_g,"amber"],["C",totals.carbs,macroTgt.carbs_g,"amber"]];

  const toggle = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));

  // Column widths — shared between header row and item rows
  const COL_ITEM = "auto";
  const COL_NUM  = "58px";
  const COL_DEL  = "28px";
  const NUM_COLS = 7; // kcal fat carbs sugar fibre netc prot

  return (
    <>
      <PolarDetailModal
        session={polarDetail}
        onClose={()=>setPolarDetail(null)}
        userId={userId}
        onHRLoaded={(updated)=>setPolarDetail(updated)}
      />
      {/* Day header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
        <div style={{ fontSize:"14px", fontWeight:"500", color:C.text }}>{formatDate(currentDate)}</div>
        <div style={{ display:"flex", gap:"4px" }}>
          <button onClick={()=>{ const idx=allDays.findIndex(d=>d.date===currentDate); if(idx<allDays.length-1) switchDay(allDays[idx+1].date); }}
            style={{ width:"26px",height:"26px",border:`0.5px solid ${C.borderMid}`,borderRadius:"5px",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.muted }}><IconChevronLeft size={12}/></button>
          <button onClick={()=>{ const idx=allDays.findIndex(d=>d.date===currentDate); if(idx>0) switchDay(allDays[idx-1].date); }}
            style={{ width:"26px",height:"26px",border:`0.5px solid ${C.borderMid}`,borderRadius:"5px",background:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.muted }}><IconChevronRight size={12}/></button>
        </div>
      </div>

      {/* Calorie bar */}
      <div style={{ background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:"8px",padding:"12px 14px",marginBottom:"10px" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px" }}>
          <div style={{ display:"flex",alignItems:"baseline",gap:"6px" }}>
            <span style={{ fontFamily:FONT.mono,fontSize:"20px",fontWeight:"500",color:C.text,letterSpacing:"-0.5px" }}>{Math.round(netKcal).toLocaleString()}</span>
            <span style={{ fontSize:"11px",color:C.muted }}>net kcal of {tdee.toLocaleString()} · {activeTier.label}</span>
          </div>
          <div style={{ display:"flex",gap:"6px",alignItems:"center" }}>
            {macros.map(([k,v,t,c])=>{
              const over=v>t;
              const bg=over?C.dangerBg:(c==="blue"?C.blueBg:c==="amber"?C.amberBg:C.greenBg);
              const col=over?C.danger:(c==="blue"?C.blueText:c==="amber"?C.amberText:C.greenText);
              const border=over?`1px solid ${C.danger}`:(c==="blue"?`1px solid ${C.blueMid}`:`1px solid ${C.amberBg}`);
              return (
                <div key={k} style={{ display:"flex",flexDirection:"column",alignItems:"center",background:bg,border:border,borderRadius:"8px",padding:"5px 10px",minWidth:"52px" }}>
                  <span style={{ fontSize:"9px",fontWeight:"500",color:col,textTransform:"uppercase",letterSpacing:"0.5px",opacity:0.8 }}>{k==="P"?"Protein":k==="F"?"Fat":"Carbs"}</span>
                  <span style={{ fontFamily:FONT.mono,fontSize:"14px",fontWeight:"500",color:col,letterSpacing:"-0.3px",lineHeight:1.2 }}>{fmt(v)}g</span>
                </div>
              );
            })}
            <div style={{ display:"flex",flexDirection:"column",alignItems:"center",background:netRemaining<0?C.dangerBg:C.greenBg,border:netRemaining<0?`1px solid ${C.danger}`:`1px solid ${C.greenBg}`,borderRadius:"8px",padding:"5px 10px",minWidth:"52px" }}>
              <span style={{ fontSize:"9px",fontWeight:"500",color:netRemaining<0?C.danger:C.greenText,textTransform:"uppercase",letterSpacing:"0.5px",opacity:0.8 }}>Left</span>
              <span style={{ fontFamily:FONT.mono,fontSize:"14px",fontWeight:"500",color:netRemaining<0?C.danger:C.greenText,letterSpacing:"-0.3px",lineHeight:1.2 }}>{netRemaining>=0?"-":"+"}‎{Math.abs(Math.round(netRemaining)).toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div style={{ height:"4px",background:C.bg,borderRadius:"2px",overflow:"hidden" }}>
          <div style={{ height:"100%",width:`${netPct}%`,background:netPct>100?C.danger:C.blue,borderRadius:"2px",transition:"width 0.3s" }}/>
        </div>
      </div>

      {/* Summary metric row */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:"7px",marginBottom:"12px" }}>
        {[
          ["Consumed",Math.round(totals.foodKcal).toLocaleString(),`${Math.round(totals.exerciseBurned)} kcal exercise burned`,""],
          ["Protein",`${fmt(totals.protein)}g`,`target ${macroTgt.protein_g}g`,""],
          ["Net carbs",`${fmt(totals.net_carbs)}g`,totals.net_carbs>macroTgt.carbs_g?`+${fmt(totals.net_carbs-macroTgt.carbs_g)}g over`:`${fmt(macroTgt.carbs_g-totals.net_carbs)}g left`,"warn"],
          ["Fat burned",`${fmt(totals.fatBurnedG||0)}g`,totals.exerciseBurned?`${Math.round(totals.exerciseBurned)} kcal exercise`:"no exercise logged",""],
        ].map(([lbl,val,sub,variant])=>(
          <div key={lbl} style={{ background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:"8px",padding:"10px 12px" }}>
            <div style={{ fontSize:"10px",fontWeight:"500",textTransform:"uppercase",letterSpacing:"0.5px",color:C.hint,marginBottom:"4px" }}>{lbl}</div>
            <div style={{ fontFamily:FONT.mono,fontSize:"18px",fontWeight:"500",color:C.text,letterSpacing:"-0.5px" }}>{val}</div>
            <div style={{ fontSize:"10px",color:variant==="warn"&&sub.includes("over")?C.amberText:C.hint,marginTop:"2px",fontFamily:FONT.mono }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Meal cards */}
      {currentDayData.meals?.map(meal => {
        const isCollapsed = !!collapsed[meal.id];
        const items = meal.items || [];
        const mKcal  = items.reduce((s,i)=>s+(i.kcal||0),  0);
        const mFat   = items.reduce((s,i)=>s+(i.fat||0),   0);
        const mCarbs = items.reduce((s,i)=>s+(i.carbs||0), 0);
        const mSugar = items.reduce((s,i)=>s+(i.sugar||0), 0);
        const mFibre = items.reduce((s,i)=>s+(i.fibre||0), 0);
        const mNetC  = items.reduce((s,i)=>s+(i.net_carbs||0), 0);
        const mProt  = items.reduce((s,i)=>s+(i.protein||0), 0);
        const hasItems = items.length > 0;
        const isExercise = meal.is_exercise || items.some(i=>i.is_exercise);
        const subtotals = [mKcal, mFat, mCarbs, mSugar, mFibre, mNetC, mProt];

        return (
          <div key={meal.id} style={{ background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:"8px",marginBottom:"8px",overflow:"hidden" }}>
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%",borderCollapse:"collapse",tableLayout:"fixed",minWidth:"500px" }}>
                <colgroup>
                  <col style={{ width:COL_ITEM }}/>
                  {Array(NUM_COLS).fill(0).map((_,i)=><col key={i} style={{ width:COL_NUM }}/>)}
                  <col style={{ width:COL_DEL }}/>
                </colgroup>

                <tbody>
                  {/* ── Header row (always visible) ── */}
                  <tr
                    onClick={()=>toggle(meal.id)}
                    style={{ cursor:"pointer", background: isCollapsed ? "#fff" : C.bg, borderBottom: isCollapsed ? "none" : `0.5px solid ${C.border}` }}>
                    {/* Name cell */}
                    <td style={{ padding:"8px 10px 8px 8px", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      <div style={{ display:"flex",alignItems:"center",gap:"6px" }}>
                        {/* Chevron */}
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={C.hint} strokeWidth="1.5" strokeLinecap="round"
                          style={{ flexShrink:0,transition:"transform 0.18s",transform:isCollapsed?"rotate(-90deg)":"rotate(0deg)" }}>
                          <path d="M2 3.5l3 3 3-3"/>
                        </svg>
                        {/* Meal icon */}
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke={isExercise?C.blue:C.hint} strokeWidth="1.5" strokeLinecap="round" style={{ flexShrink:0 }}>
                          {isExercise
                            ? <><path d="M3 8h10M8 3l3 5-3 5"/></>
                            : <><circle cx="8" cy="8" r="5"/><path d="M5 8h6"/><path d="M8 5v6"/></>}
                        </svg>
                        <span style={{ fontSize:"12px",fontWeight:"500",color:isExercise?C.blueText:C.text }}>{meal.name}</span>
                      </div>
                    </td>
                    {/* Subtotal values — one per numeric column, aligned with item rows */}
                    {subtotals.map((v,i) => (
                      <td key={i} style={{ padding:"8px",textAlign:"right",fontSize:"11px",
                        fontFamily:FONT.mono,fontWeight:hasItems?"500":"400",
                        color:hasItems?(isExercise?C.blueText:C.text):C.border }}>
                        {hasItems ? `${fmt(v)}${i>0?"g":""}` : "—"}
                      </td>
                    ))}
                    <td/>
                  </tr>

                  {/* ── Column headers (shown when expanded and has items) ── */}
                  {!isCollapsed && hasItems && (
                    <tr style={{ background:C.bg }}>
                      {["Item","kcal","Fat","Carbs","Sugar","Fibre","Net C","Prot",""].map(h=>(
                        <th key={h} style={{ color:C.hint,fontSize:"10px",fontWeight:"500",textTransform:"uppercase",
                          letterSpacing:"0.4px",padding:"5px 8px",textAlign:h==="Item"?"left":"right",
                          fontFamily:FONT.sans,borderBottom:`0.5px solid ${C.border}`,
                          borderTop:`0.5px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  )}

                  {/* ── Item rows (shown when expanded) ── */}
                  {!isCollapsed && !hasItems && (
                    <tr><td colSpan={NUM_COLS+2} style={{ padding:"10px 12px",fontSize:"12px",color:C.hint,fontStyle:"italic" }}>No items logged yet</td></tr>
                  )}
                  {!isCollapsed && items.map(item => {
                    const recipe = userRecipes.find(r=>r.name===item.recipe_name);
                    return (
                      <tr key={item.id} style={{ borderBottom:`0.5px solid ${C.border}` }}>
                        <td style={{ padding:"7px 8px",fontSize:"12px",color:item.is_exercise?C.blueText:C.text }}>
                          {item.is_exercise && item.polar_session_id ? (
                            <span onClick={()=>openPolarDetail(item)}
                              style={{ cursor:"pointer",borderBottom:`1px dashed ${C.blueMid}`,display:"inline-flex",alignItems:"center",gap:"4px" }}>
                              {polarLoading===item.id ? "…" : item.name}
                              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke={C.blue} strokeWidth="1.5" strokeLinecap="round">
                                <path d="M4 8h8M9 5l3 3-3 3"/>
                              </svg>
                            </span>
                          ) : recipe ? (
                            <span onClick={()=>setRecipeModal(recipe)} style={{ color:C.blue,cursor:"pointer",borderBottom:`1px dashed ${C.blueMid}` }}>{item.name}</span>
                          ) : item.name}
                        </td>
                        {[item.kcal,item.fat,item.carbs,item.sugar,item.fibre,item.net_carbs,item.protein].map((v,i)=>(
                          <td key={i} style={{ padding:"7px 8px",textAlign:"right",fontSize:"11px",color:item.is_exercise?C.blueText:C.muted,fontFamily:FONT.mono }}>{fmt(v||0)}{i>0?"g":""}</td>
                        ))}
                        <td style={{ textAlign:"center",padding:"7px 4px" }}>
                          <button onClick={e=>{ e.stopPropagation(); if(confirm("Remove this item?")) deleteItem(meal.id,item.id); }}
                            style={{ background:"none",border:"none",cursor:"pointer",padding:"2px",color:C.hint,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"3px" }}
                            onMouseEnter={e=>e.currentTarget.style.color=C.danger}
                            onMouseLeave={e=>e.currentTarget.style.color=C.hint}>
                            <IconX size={11}/>
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </>
  );
}
