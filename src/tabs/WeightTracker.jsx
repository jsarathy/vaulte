// src/tabs/WeightTracker.jsx
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import { DEFAULT_PLAN_CONFIG, generateWeightProjection, deriveMilestones } from "../constants/weightPlan";

export default function WeightTracker({
  userId,
  weightLog, setWeightLog,
  weightPlanConfig, setWeightPlanConfig,
  editingPlan, setEditingPlan,
  editCfg, setEditCfg,
  savePlanConfig,
  renphoSyncing, renphoMsg, syncRenpho,
}) {
  const cfg = weightPlanConfig;
  const proj = weightLog;
  const CUM_LOSS_BASELINE_KG = 86.45;

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
  // ── Phase 1 projection, derived from Plan Structure + Start Date ──
  const DAY = 86400000;
  const p1Start  = Number.isFinite(Date.parse(cfg.startDate)) ? new Date(Date.parse(cfg.startDate)) : null;
  const p1Weeks  = Number(cfg.phase1Weeks) || 0;
  const wkLoss   = Number(cfg.weeklyLossKg) || 0;
  const startKg  = Number(cfg.startWeightKg);
  const planOK   = !!p1Start && p1Weeks > 0 && Number.isFinite(startKg);
  const projSeries = planOK
    ? Array.from({ length: p1Weeks + 1 }, (_, w) => {
        const d = new Date(p1Start.getTime() + w * 7 * DAY);
        return { week:w, t:d.getTime(), date:d.toISOString().split("T")[0],
                 projected:+(startKg - wkLoss * w).toFixed(2) };
      })
    : [];
  // Interpolated plan weight for any date inside Phase 1; null outside it.
  const projectedAt = (dateStr) => {
    if (!planOK) return null;
    const t = Date.parse(dateStr);
    if (!Number.isFinite(t)) return null;
    const t0 = projSeries[0].t, tEnd = projSeries[projSeries.length-1].t;
    if (t < t0 || t > tEnd) return null;
    return +(startKg - wkLoss * ((t - t0) / (7 * DAY))).toFixed(2);
  };

  let milestones = [];
  try { milestones = deriveMilestones(cfg, proj) || []; } catch (e) { milestones = []; }

  const inp = (extra={}) => ({ padding:"3px 6px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"11px", color:"#185FA5", background:"#F7FAFD", ...extra });
  const lbl = { fontSize:"10px", color:"#6b7280", display:"block", marginBottom:"2px" };
  const setE = (key, val) => setEditCfg(prev => ({ ...prev, [key]: val }));
  const num = (key, w=60, step=1) => (
    <input type="number" step={step} value={editCfg[key]??""} onChange={e=>setE(key,parseFloat(e.target.value)||0)}
      style={inp({width:`${w}px`})} />
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
          {renphoMsg && (
            <span style={{ fontSize:"11px", color:renphoMsg.ok?"#2E7D32":"#c62828" }}>{renphoMsg.text}</span>
          )}
        </div>
        <div style={{ background:"#fff", borderRadius:"8px", border:"0.5px solid #e5e7eb", overflow:"auto", maxHeight:"calc(100vh - 220px)" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
            <thead>
              <tr style={{ background:"#185FA5", color:"#fff", position:"sticky", top:0 }}>
                {["Wk","Date","Dose","Proj (kg)","Actual (kg)","vs Proj","Cum Loss"].map(h => (
                  <th key={h} style={{ padding:"7px 8px", textAlign:"center", fontWeight:"bold", fontSize:"11px", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weightLog.map((row,i) => {
                const planProj = projectedAt(row.date);
                const effProj = row.projected!=null ? row.projected : planProj;
                const vsProj = (row.actual!=null && effProj!=null)?(row.actual-effProj).toFixed(1):null;
                const cumLoss = row.actual!=null?(CUM_LOSS_BASELINE_KG-row.actual).toFixed(1):null;
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
                    <td style={{ padding:"5px 8px" }}>
                      <input type="text"
                        value={row.dose??""}
                        placeholder="—"
                        onChange={e => saveField(i,"dose",e.target.value)}
                        style={{ width:"100%", padding:"2px 4px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"12px", background:"#fff", color:"#1a2a3a", boxSizing:"border-box" }}/>
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
        <div style={{ fontSize:"15px", fontWeight:"bold", color:"#185FA5", marginBottom:"10px" }}>📉 Trajectory</div>
        <div style={{ background:"#fff", borderRadius:"8px", border:"0.5px solid #e5e7eb", padding:"12px", marginBottom:"12px" }}>
          {(()=>{
            const acts = weightLog.filter(r => r.actual != null && Number.isFinite(Date.parse(r.date)))
                                  .map(r => ({ t: Date.parse(r.date), v: r.actual, date: r.date }))
                                  .sort((a,b) => a.t - b.t);
            if (!planOK && acts.length < 2) {
              return <div style={{ height:"200px", display:"flex", alignItems:"center", justifyContent:"center", color:"#9ca3af", fontSize:"12px" }}>
                Set a start date and Phase 1 plan to see the projection
              </div>;
            }

            const W=380, H=200, PAD={top:12,right:12,bottom:32,left:38};
            const cW=W-PAD.left-PAD.right, cH=H-PAD.top-PAD.bottom;

            const tMin = Math.min(...[...projSeries.map(p=>p.t), ...acts.map(a=>a.t)]);
            const tMax = Math.max(...[...projSeries.map(p=>p.t), ...acts.map(a=>a.t)]);
            const span = tMax - tMin || 1;

            const vals = [...projSeries.map(p=>p.projected), ...acts.map(a=>a.v)];
            let minW = Math.min(...vals) - 1, maxW = Math.max(...vals) + 1;
            if (Number.isFinite(cfg.targetWeightMinKg)) minW = Math.min(minW, cfg.targetWeightMinKg - 1);
            if (maxW - minW < 2) { minW -= 1; maxW += 1; }

            const xS = t => PAD.left + ((t - tMin) / span) * cW;
            const yS = v => PAD.top + cH - ((v - minW) / (maxW - minW)) * cH;

            const projPath = projSeries.map((p,i)=>`${i===0?"M":"L"}${xS(p.t).toFixed(1)},${yS(p.projected).toFixed(1)}`).join(" ");
            const actPath  = acts.map((a,i)=>`${i===0?"M":"L"}${xS(a.t).toFixed(1)},${yS(a.v).toFixed(1)}`).join(" ");

            const tzHi = Number.isFinite(cfg.targetWeightMaxKg) ? yS(cfg.targetWeightMaxKg) : null;
            const tzLo = Number.isFinite(cfg.targetWeightMinKg) ? yS(cfg.targetWeightMinKg) : null;

            const yTicks=[]; const stepY = (maxW-minW)>12?2:1;
            for(let w=Math.ceil(minW); w<=Math.floor(maxW); w+=stepY) yTicks.push(w);

            const fmt = t => new Date(t).toLocaleDateString("en-GB",{day:"2-digit",month:"short"});
            const xTicks = projSeries.filter((_,i)=> i % Math.max(1, Math.ceil(projSeries.length/5)) === 0);

            return (
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block"}}>
                {tzHi!=null && tzLo!=null &&
                  <rect x={PAD.left} y={tzHi} width={cW} height={Math.max(0,tzLo-tzHi)} fill="#C8E6C9" opacity="0.4"/>}
                {tzHi!=null &&
                  <text x={PAD.left+3} y={tzHi-2} fontSize="8" fill="#2E7D32">Target {cfg.targetWeightMinKg}–{cfg.targetWeightMaxKg} kg</text>}

                {yTicks.map(w=><line key={w} x1={PAD.left} x2={PAD.left+cW} y1={yS(w)} y2={yS(w)} stroke="#e5e7eb" strokeWidth="0.5"/>)}
                {yTicks.map(w=><text key={"y"+w} x={PAD.left-4} y={yS(w)+3} fontSize="8" fill="#6b7280" textAnchor="end">{w}</text>)}
                {xTicks.map(p=><text key={"x"+p.t} x={xS(p.t)} y={H-PAD.bottom+12} fontSize="8" fill="#6b7280" textAnchor="middle">{fmt(p.t)}</text>)}

                {projPath && <path d={projPath} fill="none" stroke="#90CAF9" strokeWidth="1.5" strokeDasharray="4,3"/>}
                {actPath && <path d={actPath} fill="none" stroke="#378ADD" strokeWidth="2.5"/>}
                {acts.map(a=><circle key={a.date} cx={xS(a.t)} cy={yS(a.v)} r="3" fill="#378ADD" stroke="#fff" strokeWidth="1"/>)}

                {planOK && <text x={xS(projSeries[0].t)+2} y={PAD.top+9} fontSize="8" fill="#2E7D32" fontWeight="bold">Phase 1</text>}
                <line x1={W-90} y1={H-8} x2={W-75} y2={H-8} stroke="#90CAF9" strokeWidth="1.5" strokeDasharray="4,3"/>
                <text x={W-72} y={H-5} fontSize="8" fill="#6b7280">Projected</text>
                <line x1={W-32} y1={H-8} x2={W-17} y2={H-8} stroke="#378ADD" strokeWidth="2.5"/>
                <text x={W-14} y={H-5} fontSize="8" fill="#6b7280">Actual</text>
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
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 12px", marginBottom:"10px" }}>
                {[["Age",`${cfg.age} yr`],["Sex",cfg.sex==="m"?"Male":"Female"],["Height",`${cfg.heightCm} cm`],
                  ["Start Weight",`${cfg.startWeightKg.toFixed(1)} kg`],["Start BMI",bmi],
                  ["Target",`${cfg.targetWeightMinKg}–${cfg.targetWeightMaxKg} kg`],
                  ["Target BMI",`${tBmiLo}–${tBmiHi}`],["VO₂ Max",`${cfg.vo2max} — ${cfg.vo2max<35?"Fair":cfg.vo2max<45?"Good":"Excellent"}`]].map(([k,v])=>(
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", borderBottom:"1px solid #F0F4F8", padding:"2px 0" }}>
                    <span style={{ color:"#6b7280" }}>{k}</span>
                    <span style={{ color:"#185FA5", fontWeight:"600" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Plan Structure */}
            <div style={{ fontSize:"10px", fontWeight:"bold", color:"#378ADD", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>📊 Plan Structure</div>
            {editingPlan ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"6px", marginBottom:"10px" }}>
                <div><span style={lbl}>Phase 1 (wks)</span>{num("phase1Weeks",56)}</div>
                <div><span style={lbl}>Reset (wks)</span>{num("resetWeeks",56)}</div>
                <div><span style={lbl}>Loss (kg/wk)</span>{num("weeklyLossKg",56,0.05)}</div>
                <div><span style={lbl}>Maint. kcal</span>{num("maintenanceCaloriesKcal",60)}</div>
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3px 12px", marginBottom:"10px" }}>
                {[["Phase 1",`${cfg.phase1Weeks} weeks`],["Reset Phase",`${cfg.resetWeeks} weeks`],
                  ["Weekly Loss",`${cfg.weeklyLossKg} kg/week`],["Maintenance",`${cfg.maintenanceCaloriesKcal.toLocaleString()} kcal`]].map(([k,v])=>(
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

            {/* Plateau Levers */}
            <div style={{ fontSize:"10px", fontWeight:"bold", color:"#378ADD", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>⚡ Plateau Levers — pull one at a time</div>
            {editingPlan ? (
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px" }}>
                <div><span style={lbl}>Lever 1 — Extend PM to (min)</span>{num("lever1PmMin",60)}</div>
                <div><span style={lbl}>Lever 2 — Drop calories to (kcal)</span>{num("lever2CaloriesKcal",70)}</div>
              </div>
            ) : (
              <div>
                {[
                  ["Lever 1",`Extend PM to ${cfg.lever1PmMin} min`,"Easiest — no intensity change needed"],
                  ["Lever 2",`Drop to ${cfg.lever2CaloriesKcal.toLocaleString()} kcal/day`,"Recalculate at new bodyweight first"],
                  ["Lever 3","2-week diet break at maintenance","Resets leptin & adaptive thermogenesis"],
                ].map(([lbl2,action,note])=>(
                  <div key={lbl2} style={{ padding:"4px 0", borderBottom:"1px solid #F0F4F8" }}>
                    <div style={{ display:"flex", gap:"6px" }}>
                      <span style={{ fontWeight:"bold", color:"#185FA5", minWidth:"46px" }}>{lbl2}</span>
                      <span style={{ color:"#185FA5" }}>{action}</span>
                    </div>
                    <div style={{ color:"#6b7280", paddingLeft:"52px", marginTop:"1px" }}>{note}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
