// src/tabs/WeightTracker.jsx
import { useState, useEffect } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import {
  buildProjectionSeries, projectedWeightAt, waistForWeight, deriveMilestones,
} from "../constants/weightPlan";

export default function WeightTracker({
  userId,
  weightLog, setWeightLog,
  weightPlanConfig, setWeightPlanConfig,
  editingPlan, setEditingPlan,
  editCfg, setEditCfg,
  savePlanConfig,
  renphoSyncing, renphoMsg, syncRenpho, purgeBefore,
}) {
  const cfg = weightPlanConfig;

  // Trajectory panel: double-click to fill the screen, Esc to collapse.
  const [chartFull, setChartFull] = useState(false);
  const [chartMetric, setChartMetric] = useState("weight"); // "weight" | "waist"
  useEffect(() => {
    if (!chartFull) return;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setChartFull(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chartFull]);

  const cumBaseline = Number.isFinite(Number(cfg.cumLossBaselineKg)) ? Number(cfg.cumLossBaselineKg) : 86.45;

  // Persist one field of one row (date-keyed) and update local state.
  const saveField = async (i, key, val) => {
    const row = weightLog[i];
    if (!row?.date) return;
    const updatedRow = { ...row, [key]: val };
    setWeightLog(weightLog.map((r,j) => j===i ? updatedRow : r));
    try { await setDoc(doc(db,"users",userId,"weight_log",row.date), updatedRow); }
    catch (e) { console.error("weight row save failed", e); }
  };
  const toNum = v => { const t=String(v).trim(); if(t==="") return null; const n=Number(t); return Number.isFinite(n)?n:null; };
  const bmi = (cfg.startWeightKg / Math.pow(cfg.heightCm/100, 2)).toFixed(1);
  const tBmiLo = (cfg.targetWeightMinKg / Math.pow(cfg.heightCm/100, 2)).toFixed(1);
  const tBmiHi = (cfg.targetWeightMaxKg / Math.pow(cfg.heightCm/100, 2)).toFixed(1);

  // ── Projection curve: anchor points interpolated in time; waist derived ──
  const projSeries = buildProjectionSeries(cfg);
  const planOK = projSeries.length > 1;
  const projectedAt = (dateStr) => projectedWeightAt(cfg, dateStr);
  const waistAt = (kg) => (kg == null ? null : waistForWeight(cfg, kg));

  // Sync cutoff: measurements before this are rejected by the sync route and
  // can be purged from the log. Falls back to the plan start date.
  const syncFrom = cfg.syncFromDate || cfg.startDate || null;
  const stalePre = weightLog.filter(r => r.date && syncFrom && r.date < syncFrom).length;
  const handlePurge = async () => {
    if (!syncFrom) return;
    if (!window.confirm(`Delete ${stalePre} record${stalePre!==1?"s":""} dated before ${syncFrom}? This cannot be undone.`)) return;
    await purgeBefore(syncFrom);
  };

  let milestones = [];
  try { milestones = deriveMilestones(cfg) || []; } catch (e) { milestones = []; }

  const inp = (extra={}) => ({ padding:"3px 6px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"11px", color:"#185FA5", background:"#F7FAFD", ...extra });
  const lbl = { fontSize:"10px", color:"#6b7280", display:"block", marginBottom:"2px" };
  const setE = (key, val) => setEditCfg(prev => ({ ...prev, [key]: val }));
  const num = (key, w=60, step=1) => (
    <input type="number" step={step} value={editCfg[key]??""} onChange={e=>setE(key,parseFloat(e.target.value)||0)}
      style={inp({width:`${w}px`})} />
  );

  // ── Anchor table editing ──
  const anchors = Array.isArray(editCfg.planAnchors) ? editCfg.planAnchors : [];
  const setAnchor = (i, key, val) => setEditCfg(prev => {
    const a = [...(Array.isArray(prev.planAnchors)?prev.planAnchors:[])];
    a[i] = { ...a[i], [key]: val };
    return { ...prev, planAnchors: a };
  });
  const addAnchor = () => setEditCfg(prev => {
    const a = [...(Array.isArray(prev.planAnchors)?prev.planAnchors:[])];
    const last = a[a.length-1];
    a.push({ week: (Number(last?.week)||0) + 4,
             weightKg: Number(last?.weightKg) || Number(prev.startWeightKg) || 0 });
    return { ...prev, planAnchors: a };
  });
  const delAnchor = (i) => setEditCfg(prev => ({
    ...prev, planAnchors: (Array.isArray(prev.planAnchors)?prev.planAnchors:[]).filter((_,j)=>j!==i),
  }));
  const anchorDate = (wk) => {
    const t = Date.parse(`${String(editCfg.startDate).slice(0,10)}T12:00:00`);
    if (!Number.isFinite(t) || !Number.isFinite(Number(wk))) return "—";
    return new Date(t + Number(wk)*7*86400000).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"2-digit"});
  };

  // Weight / Waist toggle for the trajectory chart.
  const metricPill = (
    <div onDoubleClick={e=>e.stopPropagation()}
      style={{ display:"inline-flex", border:"0.5px solid #cfe0f0", borderRadius:"999px", overflow:"hidden", background:"#F7FAFD" }}>
      {[["weight","Weight"],["waist","Waist"]].map(([v,label])=>(
        <button key={v} onClick={e=>{ e.stopPropagation(); setChartMetric(v); }}
          style={{ border:"none", cursor:"pointer", padding:"3px 14px", fontSize:"11px", fontWeight:"bold",
            background: chartMetric===v ? "#185FA5" : "transparent",
            color: chartMetric===v ? "#fff" : "#6b7280" }}>{label}</button>
      ))}
    </div>
  );

  return (
    <div style={{ flex:1, overflowY:"auto", display:"flex", gap:"14px", alignItems:"flex-start", padding:"16px" }}>

      {/* ── LEFT: Weekly Log Table (55%) ── */}
      <div style={{ flex:"0 0 55%", minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
          <div style={{ fontSize:"15px", fontWeight:"bold", color:"#185FA5" }}>⚖️ Weight Log</div>
          <button onClick={syncRenpho} disabled={renphoSyncing}
            style={{ background:renphoSyncing?"#9ca3af":"#378ADD", border:"none", color:"#fff", borderRadius:"4px",
              padding:"4px 10px", fontSize:"11px", fontWeight:"bold", cursor:renphoSyncing?"default":"pointer" }}>
            {renphoSyncing?"Syncing…":"⟳ Sync Renpho"}
          </button>
          {stalePre > 0 && (
            <button onClick={handlePurge}
              style={{ background:"#fff", border:"0.5px solid #c62828", color:"#c62828", borderRadius:"4px",
                padding:"4px 10px", fontSize:"11px", fontWeight:"bold", cursor:"pointer" }}>
              🗑 Purge {stalePre} pre-{syncFrom}
            </button>
          )}
          {renphoMsg && (
            <span style={{ fontSize:"11px", color:renphoMsg.ok?"#2E7D32":"#c62828" }}>{renphoMsg.text}</span>
          )}
        </div>
        <div style={{ background:"#fff", borderRadius:"8px", border:"0.5px solid #e5e7eb", overflow:"auto", maxHeight:"calc(100vh - 220px)" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
            <thead>
              <tr style={{ background:"#185FA5", color:"#fff", position:"sticky", top:0 }}>
                {["Wk","Date","Dose","Proj (kg)","Actual (kg)","vs Proj","Proj Waist","Waist Act","Cum Loss"].map(h => (
                  <th key={h} style={{ padding:"7px 8px", textAlign:"center", fontWeight:"bold", fontSize:"11px", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weightLog.map((row,i) => {
                const planProj = projectedAt(row.date);
                const effProj = row.projected!=null ? row.projected : planProj;
                const projWaist = waistAt(effProj);
                const vsProj = (row.actual!=null && effProj!=null)?(row.actual-effProj).toFixed(1):null;
                const cumLoss = row.actual!=null?(cumBaseline-row.actual).toFixed(1):null;
                const rowBg = i%2===0?"#fff":"#F7FAFD";
                const rowDate = row.date?new Date(row.date):null;
                const isPast = (rowDate && !isNaN(rowDate))?rowDate<=new Date():false;
                const isCurrent = row.actual!=null&&(i===weightLog.length-1||weightLog[i+1]?.actual==null);
                return (
                  <tr key={row.date||i} style={{ background:isCurrent?"#E3F2FD":rowBg }}>
                    <td style={{ padding:"5px 8px", textAlign:"right" }}>
                      <input type="number"
                        value={row.week??""}
                        placeholder="—"
                        onChange={e => saveField(i,"week",toNum(e.target.value))}
                        style={{ width:"38px", padding:"2px 4px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"11px", textAlign:"right", background:"#fff", color:"#6b7280" }}/>
                    </td>
                    <td style={{ padding:"5px 8px", color:"#185FA5", whiteSpace:"nowrap", fontWeight:isPast?"600":"normal" }}>{row.date}</td>
                    <td style={{ padding:"5px 4px", width:"58px" }}>
                      <input type="text"
                        value={row.dose??""}
                        placeholder="—"
                        onChange={e => saveField(i,"dose",e.target.value)}
                        style={{ width:"52px", padding:"2px 4px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"11px", background:"#fff", color:"#1a2a3a", boxSizing:"border-box" }}/>
                    </td>
                    <td style={{ padding:"5px 8px", textAlign:"right" }}>
                      <input type="number" step="0.1"
                        value={row.projected??""}
                        placeholder={planProj!=null?planProj.toFixed(1):"—"}
                        onChange={e => saveField(i,"projected",toNum(e.target.value))}
                        style={{ width:"60px", padding:"2px 4px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"12px", textAlign:"right", background:"#fff", color:"#6b7280" }}/>
                    </td>
                    <td style={{ padding:"5px 8px", textAlign:"right" }}>
                      <input type="number" step="0.1" min="30" max="200"
                        value={row.actual??""}
                        placeholder={isPast?"—":""}
                        onChange={e => saveField(i,"actual",toNum(e.target.value))}
                        style={{ width:"60px", padding:"2px 4px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"12px", textAlign:"right",
                          background:row.actual!=null?"#E8F5E9":"#fff", fontWeight:row.actual!=null?"bold":"normal",
                          color:row.actual!=null?"#2E7D32":"#1a2a3a" }}/>
                    </td>
                    <td style={{ padding:"5px 8px", textAlign:"right", fontWeight:"bold",
                      color:vsProj==null?"#ccc":parseFloat(vsProj)>0?"#c62828":parseFloat(vsProj)<0?"#2E7D32":"#6b7280" }}>
                      {vsProj==null?"—":`${parseFloat(vsProj)>0?"+":""}${vsProj}`}
                    </td>
                    <td style={{ padding:"5px 8px", textAlign:"right", color:projWaist!=null?"#6b7280":"#ccc" }}>
                      {projWaist==null?"—":projWaist.toFixed(1)}
                    </td>
                    <td style={{ padding:"5px 8px", textAlign:"right" }}>
                      <input type="number" step="0.1" min="40" max="200"
                        value={row.waistActual??""}
                        placeholder={isPast?"—":""}
                        onChange={e => saveField(i,"waistActual",toNum(e.target.value))}
                        style={{ width:"56px", padding:"2px 4px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"12px", textAlign:"right",
                          background:row.waistActual!=null?"#FFF3E0":"#fff", fontWeight:row.waistActual!=null?"bold":"normal",
                          color:row.waistActual!=null?"#B26A00":"#1a2a3a" }}/>
                    </td>
                    <td style={{ padding:"5px 8px", textAlign:"right", color:cumLoss?"#378ADD":"#ccc", fontWeight:cumLoss?"bold":"normal" }}>
                      {cumLoss==null?"—":`-${cumLoss} kg`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── RIGHT: Chart + Specs (43%) ── */}
      <div style={{ flex:"0 0 43%", minWidth:0 }}>
        {!chartFull && (
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
            <div style={{ fontSize:"15px", fontWeight:"bold", color:"#185FA5" }}>📉 Trajectory</div>
            {metricPill}
          </div>
        )}
        <div
          onDoubleClick={()=>setChartFull(v=>!v)}
          title={chartFull?"Double-click or press Esc to collapse":"Double-click to expand"}
          style={chartFull
            ? { position:"fixed", inset:0, zIndex:1000, background:"#fff", padding:"20px 24px",
                display:"flex", flexDirection:"column", overflow:"auto", cursor:"zoom-out" }
            : { background:"#fff", borderRadius:"8px", border:"0.5px solid #e5e7eb",
                padding:"12px", marginBottom:"12px", cursor:"zoom-in" }}>
          {chartFull && (
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                <span style={{ fontSize:"16px", fontWeight:"bold", color:"#185FA5" }}>📉 Trajectory</span>
                {metricPill}
              </div>
              <span style={{ fontSize:"11px", color:"#9ca3af" }}>Esc or double-click to collapse</span>
            </div>
          )}
          {(()=>{
            const isWaist = chartMetric === "waist";
            const actKey = isWaist ? "waistActual" : "actual";
            const acts = weightLog.filter(r => r[actKey] != null && Number.isFinite(Date.parse(r.date)))
                                  .map(r => ({ t: Date.parse(r.date), v: r[actKey], date: r.date }))
                                  .sort((a,b) => a.t - b.t);
            const projOf = p => (isWaist ? p.waist : p.projected);
            const projPts = projSeries.filter(p => projOf(p) != null);
            if (projPts.length < 2 && acts.length < 2) {
              return <div style={{ height:chartFull?"70vh":"200px", display:"flex", alignItems:"center", justifyContent:"center", color:"#9ca3af", fontSize:"12px" }}>
                {chartMetric==="waist" ? "Add waist measurements, or set the curve anchors and start waist" : "Set a start date, start weight and curve anchors to see the projection"}
              </div>;
            }

            // k scales the whole drawing when the panel is expanded.
            const k = chartFull ? 3 : 1;
            const W=380*k, H=200*k, PAD={top:12*k,right:12*k,bottom:32*k,left:38*k};
            const cW=W-PAD.left-PAD.right, cH=H-PAD.top-PAD.bottom;
            const fs = 8*k, sw = 1.5*k;

            const tMin = Math.min(...[...projPts.map(p=>p.t), ...acts.map(a=>a.t)]);
            const tMax = Math.max(...[...projPts.map(p=>p.t), ...acts.map(a=>a.t)]);
            const span = tMax - tMin || 1;

            const vals = [...projPts.map(projOf), ...acts.map(a=>a.v)];
            let minW = Math.min(...vals) - 1, maxW = Math.max(...vals) + 1;
            if (!isWaist && Number.isFinite(cfg.targetWeightMinKg)) minW = Math.min(minW, cfg.targetWeightMinKg - 1);
            if (maxW - minW < 2) { minW -= 1; maxW += 1; }

            const xS = t => PAD.left + ((t - tMin) / span) * cW;
            const yS = v => PAD.top + cH - ((v - minW) / (maxW - minW)) * cH;

            const projPath = projPts.map((p,i)=>`${i===0?"M":"L"}${xS(p.t).toFixed(1)},${yS(projOf(p)).toFixed(1)}`).join(" ");

            const actPath  = acts.map((a,i)=>`${i===0?"M":"L"}${xS(a.t).toFixed(1)},${yS(a.v).toFixed(1)}`).join(" ");

            const tzHi = (!isWaist && Number.isFinite(cfg.targetWeightMaxKg)) ? yS(cfg.targetWeightMaxKg) : null;
            const tzLo = (!isWaist && Number.isFinite(cfg.targetWeightMinKg)) ? yS(cfg.targetWeightMinKg) : null;

            const yTicks=[]; const stepY = (maxW-minW)>12?2:1;
            for(let w=Math.ceil(minW); w<=Math.floor(maxW); w+=stepY) yTicks.push(w);

            const fmt = t => new Date(t).toLocaleDateString("en-GB",{day:"2-digit",month:"short"});
            const xTicks = projPts.filter((_,i)=> i % Math.max(1, Math.ceil(projPts.length/(chartFull?12:5))) === 0);

            return (
              <svg width="100%" viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="xMidYMid meet"
                style={chartFull?{display:"block",flex:1,minHeight:0,maxHeight:"calc(100vh - 90px)"}:{display:"block"}}>
                {tzHi!=null && tzLo!=null &&
                  <rect x={PAD.left} y={tzHi} width={cW} height={Math.max(0,tzLo-tzHi)} fill="#C8E6C9" opacity="0.4"/>}
                {tzHi!=null &&
                  <text x={PAD.left+3*k} y={tzHi-2*k} fontSize={fs} fill="#2E7D32">Target {cfg.targetWeightMinKg}–{cfg.targetWeightMaxKg} kg</text>}

                {yTicks.map(w=><line key={w} x1={PAD.left} x2={PAD.left+cW} y1={yS(w)} y2={yS(w)} stroke="#e5e7eb" strokeWidth={0.5*k}/>)}
                {yTicks.map(w=><text key={"y"+w} x={PAD.left-4*k} y={yS(w)+3*k} fontSize={fs} fill="#6b7280" textAnchor="end">{w}</text>)}
                <text x={PAD.left-4*k} y={PAD.top-3*k} fontSize={fs} fill="#9ca3af" textAnchor="end">{isWaist?"cm":"kg"}</text>
                {xTicks.map(p=><text key={"x"+p.t} x={xS(p.t)} y={H-PAD.bottom+12*k} fontSize={fs} fill="#6b7280" textAnchor="middle">{fmt(p.t)}</text>)}

                {projPath && <path d={projPath} fill="none" stroke="#90CAF9" strokeWidth={sw} strokeDasharray={`${4*k},${3*k}`}/>}
                {actPath && <path d={actPath} fill="none" stroke="#378ADD" strokeWidth={2.5*k}/>}
                {acts.map(a=><circle key={a.date} cx={xS(a.t)} cy={yS(a.v)} r={3*k} fill="#378ADD" stroke="#fff" strokeWidth={1*k}/>)}

                <line x1={W-90*k} y1={H-8*k} x2={W-75*k} y2={H-8*k} stroke="#90CAF9" strokeWidth={sw} strokeDasharray={`${4*k},${3*k}`}/>
                <text x={W-72*k} y={H-5*k} fontSize={fs} fill="#6b7280">Projected</text>
                <line x1={W-32*k} y1={H-8*k} x2={W-17*k} y2={H-8*k} stroke="#378ADD" strokeWidth={2.5*k}/>
                <text x={W-14*k} y={H-5*k} fontSize={fs} fill="#6b7280">Actual</text>
              </svg>
            );
          })()}
        </div>

        {/* Plan Specifications */}
        <div style={{ background:"#fff", borderRadius:"8px", border:"0.5px solid #e5e7eb", overflow:"hidden", marginBottom:"12px" }}>
          <div style={{ background:"#185FA5", color:"#fff", padding:"8px 12px", fontSize:"12px", fontWeight:"bold", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>📋 Plan Specifications</span>
            <div style={{ display:"flex", gap:"6px" }}>
              {editingPlan ? (
                <>
                  <button onClick={()=>{ setEditCfg(cfg); setEditingPlan(false); }}
                    style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", borderRadius:"4px", padding:"3px 10px", fontSize:"11px", cursor:"pointer" }}>Cancel</button>
                  <button onClick={()=>savePlanConfig(editCfg)}
                    style={{ background:"#2E7D32", border:"none", color:"#fff", borderRadius:"4px", padding:"3px 10px", fontSize:"11px", cursor:"pointer", fontWeight:"bold" }}>💾 Save Plan</button>
                </>
              ) : (
                <button onClick={()=>{ setEditCfg(cfg); setEditingPlan(true); }}
                  style={{ background:"rgba(255,255,255,0.15)", border:"none", color:"#fff", borderRadius:"4px", padding:"3px 10px", fontSize:"11px", cursor:"pointer" }}>✏ Edit</button>
              )}
            </div>
          </div>
          <div style={{ padding:"10px 12px", fontSize:"11px" }}>

            {/* Personal Stats */}
            <div style={{ fontSize:"10px", fontWeight:"bold", color:"#378ADD", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>👤 Personal Stats</div>
            {editingPlan ? (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px", marginBottom:"10px" }}>
                <div><span style={lbl}>Age (yr)</span>{num("age",54)}</div>
                <div><span style={lbl}>Sex</span>
                  <select value={editCfg.sex} onChange={e=>setE("sex",e.target.value)} style={inp({width:"70px"})}>
                    <option value="m">Male</option><option value="f">Female</option>
                  </select>
                </div>
                <div><span style={lbl}>Height (cm)</span>{num("heightCm",54)}</div>
                <div><span style={lbl}>Start Wt (kg)</span>{num("startWeightKg",54,0.1)}</div>
                <div><span style={lbl}>Start Date</span>
                  <input type="date" value={editCfg.startDate} onChange={e=>setE("startDate",e.target.value)} style={inp({width:"110px"})}/>
                </div>
                <div><span style={lbl}>VO₂ Max</span>{num("vo2max",54)}</div>
                <div><span style={lbl}>Target Min (kg)</span>{num("targetWeightMinKg",54,0.1)}</div>
                <div><span style={lbl}>Target Max (kg)</span>{num("targetWeightMaxKg",54,0.1)}</div>
                <div><span style={lbl}>Cum-loss base (kg)</span>{num("cumLossBaselineKg",54,0.01)}</div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 12px", marginBottom:"10px" }}>
                {[["Age",`${cfg.age} yr`],["Sex",cfg.sex==="m"?"Male":"Female"],["Height",`${cfg.heightCm} cm`],
                  ["Start Weight",`${cfg.startWeightKg.toFixed(1)} kg`],["Start BMI",bmi],
                  ["Target",`${cfg.targetWeightMinKg}–${cfg.targetWeightMaxKg} kg`],
                  ["Target BMI",`${tBmiLo}–${tBmiHi}`],["VO₂ Max",`${cfg.vo2max} — ${cfg.vo2max<35?"Fair":cfg.vo2max<45?"Good":"Excellent"}`],
                  ["Cum-loss base",`${cumBaseline.toFixed(2)} kg`]].map(([k,v])=>(
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #F0F4F8", padding:"2px 0" }}>
                    <span style={{ color:"#6b7280" }}>{k}</span>
                    <span style={{ color:"#185FA5", fontWeight:"600" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Projection Curve */}
            <div style={{ fontSize:"10px", fontWeight:"bold", color:"#378ADD", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>📈 Projection Curve</div>
            {editingPlan ? (
              <div style={{ marginBottom:"10px" }}>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"6px", marginBottom:"8px" }}>
                  <div><span style={lbl}>Start waist (cm)</span>{num("startWaistCm",56,0.1)}</div>
                  <div><span style={lbl}>cm/kg at start</span>{num("cmPerKgStart",56,0.01)}</div>
                  <div><span style={lbl}>cm/kg at end</span>{num("cmPerKgEnd",56,0.01)}</div>
                  <div><span style={lbl}>Maint. kcal</span>{num("maintenanceCaloriesKcal",60)}</div>
                  <div style={{ gridColumn:"span 2" }}><span style={lbl}>Sync from (ignore earlier)</span>
                    <input type="date" value={editCfg.syncFromDate||editCfg.startDate||""}
                      onChange={e=>setE("syncFromDate",e.target.value)} style={inp({width:"110px"})}/>
                  </div>
                </div>

                <span style={lbl}>Anchor points (week 0 = Start Weight on Start Date)</span>
                <div style={{ border:"0.5px solid #e5e7eb", borderRadius:"4px", padding:"6px", marginBottom:"6px" }}>
                  <div style={{ display:"grid", gridTemplateColumns:"46px 66px 1fr 20px", gap:"4px", fontSize:"9px", color:"#9ca3af", marginBottom:"3px" }}>
                    <span>Week</span><span>Weight</span><span>Date</span><span/>
                  </div>
                  {anchors.map((a,i)=>(
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"46px 66px 1fr 20px", gap:"4px", alignItems:"center", marginBottom:"3px" }}>
                      <input type="number" step="1" value={a.week??""}
                        onChange={e=>setAnchor(i,"week",parseFloat(e.target.value)||0)} style={inp({width:"42px"})}/>
                      <input type="number" step="0.05" value={a.weightKg??""}
                        onChange={e=>setAnchor(i,"weightKg",parseFloat(e.target.value)||0)} style={inp({width:"62px"})}/>
                      <span style={{ fontSize:"10px", color:"#6b7280" }}>{anchorDate(a.week)}</span>
                      <button onClick={()=>delAnchor(i)} title="Remove"
                        style={{ background:"none", border:"none", color:"#c62828", cursor:"pointer", fontSize:"12px", padding:0 }}>×</button>
                    </div>
                  ))}
                  <button onClick={addAnchor}
                    style={{ background:"#F7FAFD", border:"0.5px solid #e5e7eb", color:"#185FA5", borderRadius:"4px", padding:"2px 8px", fontSize:"10px", cursor:"pointer", marginTop:"2px" }}>
                    + Add anchor
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 12px", marginBottom:"10px" }}>
                {[["Anchors",`${(cfg.planAnchors||[]).length + 1} points`],
                  ["Plan length",planOK?`${projSeries[projSeries.length-1].week} weeks`:"—"],
                  ["End weight",planOK?`${projSeries[projSeries.length-1].projected.toFixed(1)} kg`:"—"],
                  ["End waist",planOK&&projSeries[projSeries.length-1].waist!=null?`${projSeries[projSeries.length-1].waist.toFixed(1)} cm`:"—"],
                  ["Start waist",`${cfg.startWaistCm} cm`],
                  ["Waist rate",`${cfg.cmPerKgStart} → ${cfg.cmPerKgEnd} cm/kg`],
                  ["Maintenance",`${(cfg.maintenanceCaloriesKcal||0).toLocaleString()} kcal`],
                  ["Sync From",syncFrom||"—"]].map(([k,v])=>(
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #F0F4F8", padding:"2px 0" }}>
                    <span style={{ color:"#6b7280" }}>{k}</span>
                    <span style={{ color:"#185FA5", fontWeight:"600" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Milestones */}
            <div style={{ fontSize:"10px", fontWeight:"bold", color:"#378ADD", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>🏁 Milestone Roadmap</div>
            <div style={{ marginBottom:"10px" }}>
              {milestones.map((m,i)=>(
                <div key={i} style={{ display:"grid", gridTemplateColumns:"75px 58px 1fr 34px", gap:"4px", padding:"3px 0", borderBottom:"1px solid #F0F4F8", alignItems:"center" }}>
                  <span style={{ color:"#6b7280", fontSize:"10px" }}>{m.date}</span>
                  <span style={{ color:"#378ADD", fontWeight:"bold" }}>{m.weight}</span>
                  <span style={{ color:"#185FA5" }}>{m.note}</span>
                  <span style={{ fontSize:"9px", padding:"1px 4px", borderRadius:"8px", textAlign:"center",
                    background:m.phase==="RESET"?"#FFF3CD":m.phase==="Phase 3"?"#E3F2FD":"#E8F5E9",
                    color:m.phase==="RESET"?"#795548":m.phase==="Phase 3"?"#185FA5":"#2E7D32" }}>
                    {m.phase==="Phase 1"?"P1":m.phase==="Phase 3"?"P3":"RST"}
                  </span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
