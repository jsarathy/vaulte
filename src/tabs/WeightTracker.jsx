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
}) {
  const cfg = weightPlanConfig;
  const proj = weightLog;
  const bmi = (cfg.startWeightKg / Math.pow(cfg.heightCm/100, 2)).toFixed(1);
  const tBmiLo = (cfg.targetWeightMinKg / Math.pow(cfg.heightCm/100, 2)).toFixed(1);
  const tBmiHi = (cfg.targetWeightMaxKg / Math.pow(cfg.heightCm/100, 2)).toFixed(1);
  const dailyDeficit = Math.round(cfg.weeklyLossKg * 7700 / 7);
  const milestones = deriveMilestones(cfg, proj);

  const inp = (extra={}) => ({ padding:"3px 6px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"11px", color:"#1F4E79", background:"#F7FAFD", ...extra });
  const lbl = { fontSize:"10px", color:"#6B8CAE", display:"block", marginBottom:"2px" };
  const setE = (key, val) => setEditCfg(prev => ({ ...prev, [key]: val }));
  const num = (key, w=60, step=1) => (
    <input type="number" step={step} value={editCfg[key]??""} onChange={e=>setE(key,parseFloat(e.target.value)||0)}
      style={inp({width:`${w}px`})} />
  );

  return (
    <div style={{ flex:1, overflowY:"auto", display:"flex", gap:"14px", alignItems:"flex-start", padding:"16px" }}>

      {/* ── LEFT: Weekly Log Table (55%) ── */}
      <div style={{ flex:"0 0 55%", minWidth:0 }}>
        <div style={{ fontSize:"15px", fontWeight:"bold", color:"#1F4E79", marginBottom:"10px" }}>⚖️ Weekly Weight Log</div>
        <div style={{ background:"#fff", borderRadius:"8px", border:"1px solid #DDEAF6", overflow:"auto", maxHeight:"calc(100vh - 220px)" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
            <thead>
              <tr style={{ background:"#1F4E79", color:"#fff", position:"sticky", top:0 }}>
                {["Wk","Date","Phase","Proj (kg)","Actual (kg)","vs Proj","Cum Loss"].map(h => (
                  <th key={h} style={{ padding:"7px 8px", textAlign:["Wk","Proj (kg)","Actual (kg)","vs Proj","Cum Loss"].includes(h)?"right":"left", fontWeight:"bold", fontSize:"11px", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weightLog.map((row,i) => {
                const vsProj = row.actual!=null?(row.actual-row.projected).toFixed(1):null;
                const cumLoss = row.actual!=null?(cfg.startWeightKg-row.actual).toFixed(1):null;
                const isReset = row.phase==="RESET";
                const isP3 = row.phase==="Phase 3 — Resume";
                const rowBg = isReset?"#FFF8E1":isP3?"#F3F8FF":i%2===0?"#fff":"#F7FAFD";
                const rowDateParts = row.date.split(" ");
                const rowDate = rowDateParts.length>=3?new Date(`${rowDateParts[1]} ${rowDateParts[0]}, ${rowDateParts[2]}`):null;
                const isPast = rowDate?rowDate<=new Date():false;
                const isCurrent = row.actual!=null&&(i===weightLog.length-1||weightLog[i+1]?.actual==null);
                return (
                  <tr key={row.week} style={{ background:isCurrent?"#E3F2FD":rowBg }}>
                    <td style={{ padding:"5px 8px", textAlign:"right", color:"#6B8CAE", fontSize:"11px" }}>{row.week}</td>
                    <td style={{ padding:"5px 8px", color:"#1F4E79", whiteSpace:"nowrap", fontWeight:isPast?"600":"normal" }}>{row.date}</td>
                    <td style={{ padding:"5px 8px" }}>
                      <span style={{ fontSize:"10px", padding:"1px 6px", borderRadius:"10px", fontWeight:"bold",
                        background:isReset?"#FFF3CD":isP3?"#E3F2FD":"#E8F5E9",
                        color:isReset?"#795548":isP3?"#1F4E79":"#2E7D32" }}>
                        {isReset?"RESET":isP3?"P3":"P1"}
                      </span>
                    </td>
                    <td style={{ padding:"5px 8px", textAlign:"right", color:"#6B8CAE" }}>{row.projected.toFixed(1)}</td>
                    <td style={{ padding:"5px 8px", textAlign:"right" }}>
                      <input type="number" step="0.1" min="30" max="200"
                        value={row.actual??""}
                        placeholder={isPast?"—":""}
                        onChange={async e => {
                          const val = e.target.value===""?null:parseFloat(e.target.value);
                          const updated = weightLog.map((r,j)=>j===i?{...r,actual:val}:r);
                          setWeightLog(updated);
                          await setDoc(doc(db,"users",userId,"weight_log",String(row.week)),{...row,actual:val});
                        }}
                        style={{ width:"60px", padding:"2px 4px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px", textAlign:"right",
                          background:row.actual!=null?"#E8F5E9":"#fff", fontWeight:row.actual!=null?"bold":"normal",
                          color:row.actual!=null?"#2E7D32":"#1a2a3a" }}/>
                    </td>
                    <td style={{ padding:"5px 8px", textAlign:"right", fontWeight:"bold",
                      color:vsProj==null?"#ccc":parseFloat(vsProj)>0?"#c62828":parseFloat(vsProj)<0?"#2E7D32":"#6B8CAE" }}>
                      {vsProj==null?"—":`${parseFloat(vsProj)>0?"+":""}${vsProj}`}
                    </td>
                    <td style={{ padding:"5px 8px", textAlign:"right", color:cumLoss?"#2E75B6":"#ccc", fontWeight:cumLoss?"bold":"normal" }}>
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
        <div style={{ fontSize:"15px", fontWeight:"bold", color:"#1F4E79", marginBottom:"10px" }}>📉 Trajectory</div>
        <div style={{ background:"#fff", borderRadius:"8px", border:"1px solid #DDEAF6", padding:"12px", marginBottom:"12px" }}>
          {(()=>{
            const W=380, H=200, PAD={top:12,right:12,bottom:32,left:38};
            const cW=W-PAD.left-PAD.right, cH=H-PAD.top-PAD.bottom;
            const allProj=weightLog.map(r=>r.projected);
            const allActual=weightLog.filter(r=>r.actual!=null).map(r=>r.actual);
            const minW=Math.min(...allProj,...allActual,cfg.targetWeightMinKg)-1;
            const maxW=Math.max(...allProj,...allActual)+1;
            const n=weightLog.length;
            const xS=i=>PAD.left+(i/(n-1))*cW;
            const yS=v=>PAD.top+cH-((v-minW)/(maxW-minW))*cH;
            const resetStart=weightLog.findIndex(r=>r.phase==="RESET");
            const p3Start=weightLog.findIndex(r=>r.phase==="Phase 3 — Resume");
            const projPath=weightLog.map((r,i)=>`${i===0?"M":"L"}${xS(i).toFixed(1)},${yS(r.projected).toFixed(1)}`).join(" ");
            const actualPts=weightLog.reduce((acc,r,i)=>r.actual!=null?[...acc,[i,r.actual]]:acc,[]);
            const actualPath=actualPts.map(([i,v],j)=>`${j===0?"M":"L"}${xS(i).toFixed(1)},${yS(v).toFixed(1)}`).join(" ");
            const tZoneY1=yS(cfg.targetWeightMaxKg), tZoneY2=yS(cfg.targetWeightMinKg);
            const yTicks=[]; for(let w=Math.ceil(minW);w<=Math.floor(maxW);w+=2) yTicks.push(w);
            const months=[];
            weightLog.forEach((r,i)=>{ const p=r.date.split(" "); if(p[0]==="01"||p[0]==="09") months.push({i,label:p[1]?.slice(0,3)||""}); });
            return (
              <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{display:"block"}}>
                {resetStart>0&&p3Start>resetStart&&<rect x={xS(resetStart)} y={PAD.top} width={xS(p3Start)-xS(resetStart)} height={cH} fill="#FFF8E1" opacity="0.7"/>}
                {p3Start>0&&<rect x={xS(p3Start)} y={PAD.top} width={xS(n-1)-xS(p3Start)} height={cH} fill="#EBF3FB" opacity="0.5"/>}
                <rect x={PAD.left} y={tZoneY1} width={cW} height={tZoneY2-tZoneY1} fill="#C8E6C9" opacity="0.4"/>
                <text x={PAD.left+3} y={tZoneY1-2} fontSize="8" fill="#2E7D32">Target {cfg.targetWeightMinKg}–{cfg.targetWeightMaxKg} kg</text>
                {yTicks.map(w=><line key={w} x1={PAD.left} x2={PAD.left+cW} y1={yS(w)} y2={yS(w)} stroke="#DDEAF6" strokeWidth="0.5"/>)}
                {yTicks.map(w=><text key={w} x={PAD.left-4} y={yS(w)+3} fontSize="8" fill="#6B8CAE" textAnchor="end">{w}</text>)}
                {months.map(({i,label})=><text key={i} x={xS(i)} y={H-PAD.bottom+12} fontSize="8" fill="#6B8CAE" textAnchor="middle">{label}</text>)}
                <path d={projPath} fill="none" stroke="#90CAF9" strokeWidth="1.5" strokeDasharray="4,3"/>
                {actualPath&&<path d={actualPath} fill="none" stroke="#2E75B6" strokeWidth="2.5"/>}
                {actualPts.map(([i,v])=><circle key={i} cx={xS(i)} cy={yS(v)} r="3" fill="#2E75B6" stroke="#fff" strokeWidth="1"/>)}
                <text x={xS(2)} y={PAD.top+10} fontSize="8" fill="#2E7D32" fontWeight="bold">P1</text>
                {resetStart>0&&<text x={xS(resetStart+0.3)} y={PAD.top+10} fontSize="8" fill="#795548" fontWeight="bold">RST</text>}
                {p3Start>0&&<text x={xS(p3Start+0.5)} y={PAD.top+10} fontSize="8" fill="#1F4E79" fontWeight="bold">P3</text>}
                <line x1={W-90} y1={H-8} x2={W-75} y2={H-8} stroke="#90CAF9" strokeWidth="1.5" strokeDasharray="4,3"/>
                <text x={W-72} y={H-5} fontSize="8" fill="#6B8CAE">Projected</text>
                <line x1={W-32} y1={H-8} x2={W-17} y2={H-8} stroke="#2E75B6" strokeWidth="2.5"/>
                <text x={W-14} y={H-5} fontSize="8" fill="#6B8CAE">Actual</text>
              </svg>
            );
          })()}
        </div>

        {/* Plan Specifications */}
        <div style={{ background:"#fff", borderRadius:"8px", border:"1px solid #DDEAF6", overflow:"hidden", marginBottom:"12px" }}>
          <div style={{ background:"#1F4E79", color:"#fff", padding:"8px 12px", fontSize:"12px", fontWeight:"bold", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
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
            <div style={{ fontSize:"10px", fontWeight:"bold", color:"#2E75B6", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>👤 Personal Stats</div>
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
                    <span style={{ color:"#6B8CAE" }}>{k}</span>
                    <span style={{ color:"#1F4E79", fontWeight:"600" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Daily Exercise Plan */}
            <div style={{ fontSize:"10px", fontWeight:"bold", color:"#2E75B6", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>🚴 Daily Exercise Plan</div>
            {editingPlan ? (
              <div style={{ marginBottom:"10px" }}>
                <div style={{ marginBottom:"6px" }}>
                  <span style={{ ...lbl, fontWeight:"bold", color:"#1F4E79" }}>🌅 AM Session</span>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"6px" }}>
                    <div><span style={lbl}>Dur (min)</span>{num("amDurationMin",46)}</div>
                    <div><span style={lbl}>HR Low</span>{num("amHRMin",46)}</div>
                    <div><span style={lbl}>HR High</span>{num("amHRMax",46)}</div>
                    <div><span style={lbl}>kcal Min</span>{num("amKcalMin",46)}</div>
                    <div><span style={lbl}>kcal Max</span>{num("amKcalMax",46)}</div>
                  </div>
                </div>
                <div style={{ marginBottom:"6px" }}>
                  <span style={{ ...lbl, fontWeight:"bold", color:"#1F4E79" }}>🌆 PM Session</span>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"6px" }}>
                    <div><span style={lbl}>Dur (min)</span>{num("pmDurationMin",46)}</div>
                    <div><span style={lbl}>HR Low</span>{num("pmHRMin",46)}</div>
                    <div><span style={lbl}>HR High</span>{num("pmHRMax",46)}</div>
                    <div><span style={lbl}>kcal Min</span>{num("pmKcalMin",46)}</div>
                    <div><span style={lbl}>kcal Max</span>{num("pmKcalMax",46)}</div>
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"6px" }}>
                  <div><span style={lbl}>Daily kcal</span>{num("dailyCaloriesKcal",56)}</div>
                  <div><span style={lbl}>Protein Min g</span>{num("proteinMinG",56)}</div>
                  <div><span style={lbl}>Protein Max g</span>{num("proteinMaxG",56)}</div>
                  <div><span style={lbl}>Active days/wk</span>{num("activeDaysPerWeek",56,0.5)}</div>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom:"10px" }}>
                {[
                  ["🌅 AM Cycling",`${cfg.amDurationMin} min · HR ${cfg.amHRMin}–${cfg.amHRMax} bpm · ~${cfg.amKcalMin}–${cfg.amKcalMax} kcal`],
                  ["🌆 PM Cycling",`${cfg.pmDurationMin} min · HR ${cfg.pmHRMin}–${cfg.pmHRMax} bpm · ~${cfg.pmKcalMin}–${cfg.pmKcalMax} kcal`],
                  ["🍽 Calories",`${cfg.dailyCaloriesKcal.toLocaleString()} kcal/day · Protein ${cfg.proteinMinG}–${cfg.proteinMaxG} g`],
                  ["📅 Active Days",`${cfg.activeDaysPerWeek} days/week · ~${dailyDeficit} kcal/day deficit`],
                ].map(([k,v])=>(
                  <div key={k} style={{ display:"flex", gap:"6px", padding:"3px 0", borderBottom:"1px solid #F0F4F8" }}>
                    <span style={{ color:"#1F4E79", fontWeight:"600", whiteSpace:"nowrap", minWidth:"88px" }}>{k}</span>
                    <span style={{ color:"#6B8CAE" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Plan Structure */}
            <div style={{ fontSize:"10px", fontWeight:"bold", color:"#2E75B6", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>📊 Plan Structure</div>
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
                    <span style={{ color:"#6B8CAE" }}>{k}</span>
                    <span style={{ color:"#1F4E79", fontWeight:"600" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Milestones */}
            <div style={{ fontSize:"10px", fontWeight:"bold", color:"#2E75B6", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>🏁 Milestone Roadmap</div>
            <div style={{ marginBottom:"10px" }}>
              {milestones.map((m,i)=>(
                <div key={i} style={{ display:"grid", gridTemplateColumns:"75px 58px 1fr 34px", gap:"4px", padding:"3px 0", borderBottom:"1px solid #F0F4F8", alignItems:"center" }}>
                  <span style={{ color:"#6B8CAE", fontSize:"10px" }}>{m.date}</span>
                  <span style={{ color:"#2E75B6", fontWeight:"bold" }}>{m.weight}</span>
                  <span style={{ color:"#1F4E79" }}>{m.note}</span>
                  <span style={{ fontSize:"9px", padding:"1px 4px", borderRadius:"8px", textAlign:"center",
                    background:m.phase==="RESET"?"#FFF3CD":m.phase==="Phase 3"?"#E3F2FD":"#E8F5E9",
                    color:m.phase==="RESET"?"#795548":m.phase==="Phase 3"?"#1F4E79":"#2E7D32" }}>
                    {m.phase==="Phase 1"?"P1":m.phase==="Phase 3"?"P3":"RST"}
                  </span>
                </div>
              ))}
            </div>

            {/* Plateau Levers */}
            <div style={{ fontSize:"10px", fontWeight:"bold", color:"#2E75B6", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>⚡ Plateau Levers — pull one at a time</div>
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
                      <span style={{ fontWeight:"bold", color:"#1F4E79", minWidth:"46px" }}>{lbl2}</span>
                      <span style={{ color:"#1F4E79" }}>{action}</span>
                    </div>
                    <div style={{ color:"#6B8CAE", paddingLeft:"52px", marginTop:"1px" }}>{note}</div>
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
