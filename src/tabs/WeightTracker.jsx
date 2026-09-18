// src/tabs/WeightTracker.jsx
import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { doc, setDoc } from "firebase/firestore";
import {
  buildProjectionSeries, projectedWeightAt, waistForWeight, deriveMilestones,
} from "../constants/weightPlan";

// Friendly names/units for Renpho's raw field names. Unknown keys fall back to a
// prettified version of the key, so new metrics still get a tab.
const RENPHO_METRICS = {
  bmi:{label:"BMI",unit:""}, bodyfat:{label:"Body fat",unit:"%"}, bodyFat:{label:"Body fat",unit:"%"},
  water:{label:"Body water",unit:"%"}, bodyWater:{label:"Body water",unit:"%"},
  muscle:{label:"Muscle mass",unit:"kg"}, muscleMass:{label:"Muscle mass",unit:"kg"},
  skeletalMuscle:{label:"Skeletal muscle",unit:"%"}, sinew:{label:"Skeletal muscle",unit:"%"},
  bone:{label:"Bone mass",unit:"kg"}, boneMass:{label:"Bone mass",unit:"kg"},
  bmr:{label:"BMR",unit:"kcal"}, visfat:{label:"Visceral fat",unit:""}, visceralFat:{label:"Visceral fat",unit:""},
  subfat:{label:"Subcutaneous fat",unit:"%"}, subcutaneousFat:{label:"Subcutaneous fat",unit:"%"},
  protein:{label:"Protein",unit:"%"}, bodyage:{label:"Metabolic age",unit:"yrs"}, bodyAge:{label:"Metabolic age",unit:"yrs"},
  fatFreeWeight:{label:"Fat-free weight",unit:"kg"}, lbm:{label:"Lean body mass",unit:"kg"},
  heartRate:{label:"Heart rate",unit:"bpm"}, cardiacIndex:{label:"Cardiac index",unit:""},
};
// Renpho fields that aren't useful metrics, so they get no tab.
const HIDDEN_METRICS = new Set(["weight","fc","isauto","tw","wc"]);

// Plain-English explanation shown when a metric tab is hovered.
const METRIC_INFO = {
  weight: "Total body weight, from the Renpho scale. The dashed line is your planned trajectory.",
  waist: "Waist circumference, measured with a tape. Tracks fat loss where the scale can stall.",
  bmi: "Body Mass Index: weight relative to height. A rough screening number — it can't tell fat from muscle.",
  bodyfat: "Share of your body weight that is fat. Renpho estimates it from bioelectrical impedance, so absolute values are approximate; the trend is what matters.",
  water: "Share of body weight that is water. Drops when dehydrated, so it swings day to day.",
  muscle: "Estimated weight of muscle, including the water held in it. Rising while weight falls is the ideal pattern.",
  skeletalMuscle: "The muscle attached to bone that you actually train, as a share of body weight.",
  bone: "Estimated weight of bone mineral. Changes very slowly; large day-to-day swings are measurement noise.",
  bmr: "Basal metabolic rate: the calories your body burns at complete rest, estimated from your composition.",
  visfat: "Visceral fat: the fat around your organs, on Renpho's 1-59 scale. Under 10 is considered healthy, and it's the fat most linked to metabolic risk.",
  subfat: "Subcutaneous fat: the fat just under your skin, as a share of body weight.",
  protein: "Share of body weight made up of protein, mostly in muscle and organs.",
  bodyage: "Metabolic age: the age your body composition resembles. Lower than your real age is the goal.",
  fatFreeWeight: "Everything you weigh that isn't fat: muscle, bone, organs and water.",
  lbm: "Lean body mass: total weight minus fat mass.",
  heartRate: "Resting heart rate, if your scale measures it during the reading.",
  cardiacIndex: "A measure of how hard your heart works relative to body size.",
};
const metricInfo = k => METRIC_INFO[k] ?? METRIC_INFO[k?.toLowerCase()]
  ?? `${metricLabel(k)}, as reported by your Renpho scale.`;

const metricLabel = k => RENPHO_METRICS[k]?.label
  ?? k.replace(/_/g," ").replace(/([a-z])([A-Z])/g,"$1 $2").replace(/^./, c=>c.toUpperCase());
const metricUnit = k => RENPHO_METRICS[k]?.unit ?? "";

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
  const [chartMetric, setChartMetric] = useState("weight"); // "weight" | "waist" | a Renpho metric key
  useEffect(() => {
    if (!chartFull) return;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setChartFull(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chartFull]);

  // Expanded chart scrolls horizontally; on open, bring the latest reading into view.
  const chartScrollRef = useRef(null);
  const lastActXRef = useRef(null);
  useEffect(() => {
    if (!chartFull) return;
    requestAnimationFrame(() => {
      const el = chartScrollRef.current;
      if (el && lastActXRef.current != null) el.scrollLeft = Math.max(0, lastActXRef.current - el.clientWidth * 0.75);
    });
  }, [chartFull, chartMetric]);

  // Measure the expanded chart area so the drawing fits its height exactly
  // (otherwise the date axis is clipped) and re-flows when the window is resized.
  const [chartBox, setChartBox] = useState({ w:0, h:0 });
  const [hoverPt, setHoverPt] = useState(null); // expanded view only: { t, v }
  const [hoverMetric, setHoverMetric] = useState(null); // metric tab being hovered
  useEffect(() => { if (!chartFull) setHoverPt(null); }, [chartFull, chartMetric]);
  useEffect(() => {
    if (!chartFull || !chartScrollRef.current || typeof ResizeObserver === "undefined") return;
    const el = chartScrollRef.current;
    const ro = new ResizeObserver(() => setChartBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
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

  // Metric tabs: Weight and Waist (with projections) plus one per Renpho metric that has data.
  const renphoKeys = [...new Set(weightLog.flatMap(r => Object.keys(r.renpho || {})))]
    .filter(k => !HIDDEN_METRICS.has(k.toLowerCase()))
    .sort((a,b) => metricLabel(a).localeCompare(metricLabel(b)));
  const metricTabs = [["weight","Weight"],["waist","Waist"], ...renphoKeys.map(k => [k, metricLabel(k)])];
  const metricPill = (
    <div onDoubleClick={e=>e.stopPropagation()} style={{ position:"relative" }}>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"4px" }}>
        {metricTabs.map(([v,label])=>(
          <span key={v} style={{ position:"relative", display:"inline-flex" }}>
            <button onClick={e=>{ e.stopPropagation(); setChartMetric(v); }}
              onMouseEnter={()=>setHoverMetric(v)} onMouseLeave={()=>setHoverMetric(null)}
              onFocus={()=>setHoverMetric(v)} onBlur={()=>setHoverMetric(null)}
              style={{ border:"0.5px solid #cfe0f0", borderRadius:"999px", cursor:"pointer", padding:"3px 12px", fontSize:"11px", fontWeight:"bold",
                background: chartMetric===v ? "#185FA5" : "#F7FAFD",
                color: chartMetric===v ? "#fff" : "#6b7280" }}>{label}</button>
            {hoverMetric===v && (
              <div style={{ position:"absolute", top:"calc(100% + 6px)", left:"50%", transform:"translateX(-50%)",
                zIndex:40, width:"260px", maxWidth:"80vw",
                background:"#1f2937", color:"#fff", borderRadius:"6px", padding:"8px 10px", textAlign:"left",
                fontSize:"11.5px", lineHeight:1.45, fontWeight:"normal", boxShadow:"0 4px 14px rgba(0,0,0,0.22)",
                pointerEvents:"none" }}>
                <div style={{ fontWeight:"bold", marginBottom:"3px" }}>
                  {metricLabel(v)}{metricUnit(v) ? ` (${metricUnit(v)})` : v==="weight" ? " (kg)" : v==="waist" ? " (cm)" : ""}
                </div>
                {metricInfo(v)}
              </div>
            )}
          </span>
        ))}
      </div>
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
            const isPlan = chartMetric === "weight" || isWaist; // only these have a projection
            const valOf = r => chartMetric === "weight" ? r.actual : isWaist ? r.waistActual : r.renpho?.[chartMetric];
            const unit = chartMetric === "weight" ? "kg" : isWaist ? "cm" : metricUnit(chartMetric);
            const acts = weightLog.filter(r => valOf(r) != null && Number.isFinite(Date.parse(r.date)))
                                  .map(r => ({ t: Date.parse(r.date), v: Number(valOf(r)), date: r.date }))
                                  .sort((a,b) => a.t - b.t);
            const projOf = p => (isWaist ? p.waist : p.projected);
            const projPts = isPlan ? projSeries.filter(p => projOf(p) != null) : [];
            if (projPts.length < 2 && acts.length < 2) {
              return <div style={{ height:chartFull?"70vh":"200px", display:"flex", alignItems:"center", justifyContent:"center", color:"#9ca3af", fontSize:"12px" }}>
                {!isPlan ? "Needs at least two readings — sync Renpho to fill this in"
                  : isWaist ? "Add waist measurements, or set the curve anchors and start waist" : "Set a start date, start weight and curve anchors to see the projection"}
              </div>;
            }

            const tMin = Math.min(...[...projPts.map(p=>p.t), ...acts.map(a=>a.t)]);
            const tMax = Math.max(...[...projPts.map(p=>p.t), ...acts.map(a=>a.t)]);
            const span = tMax - tMin || 1;
            const days = Math.max(1, span / 86400000);

            // Compact: fixed 380x200 drawing scaled to the panel.
            // Expanded: drawn in real pixels, at least MIN_DAY_PX per day, scrolling sideways,
            // so daily readings always get room to separate.
            const MIN_DAY_PX = 12;
            const k = chartFull ? 1.6 : 1;
            const PAD={top:12*k,right:16*k,bottom:50*k,left:40*k}; // bottom room for 45° dates
            const vw = chartBox.w || (typeof window !== "undefined" ? window.innerWidth - 48 : 1200);
            const vh = chartBox.h || (typeof window !== "undefined" ? window.innerHeight - 150 : 600);
            const W = chartFull ? Math.max(vw, PAD.left + PAD.right + days * MIN_DAY_PX) : 380;
            const H = chartFull ? Math.max(300, vh - 22) : 230; // 22px leaves room for the scrollbar
            const cW=W-PAD.left-PAD.right, cH=H-PAD.top-PAD.bottom;
            const fs = 8*k, sw = 1.5*k;

            // Dot size follows the gap between consecutive days, so dots shrink rather than overlap.
            const dayPx = cW / days;
            const r = Math.min(3*k, Math.max(0.6, dayPx * 0.4));
            const actSW = Math.min(2.5*k, Math.max(0.6, r * 0.7));

            const vals = [...projPts.map(projOf), ...acts.map(a=>a.v)];
            const vPad = isPlan ? 1 : Math.max((Math.max(...vals) - Math.min(...vals)) * 0.15, Math.abs(Math.max(...vals)) * 0.01, 0.1);
            let minW = Math.min(...vals) - vPad, maxW = Math.max(...vals) + vPad;
            if (chartMetric==="weight" && Number.isFinite(cfg.targetWeightMinKg)) minW = Math.min(minW, cfg.targetWeightMinKg - 1);
            if (isPlan && maxW - minW < 2) { minW -= 1; maxW += 1; }

            const xS = t => PAD.left + ((t - tMin) / span) * cW;
            const yS = v => PAD.top + cH - ((v - minW) / (maxW - minW)) * cH;

            const projPath = projPts.map((p,i)=>`${i===0?"M":"L"}${xS(p.t).toFixed(1)},${yS(projOf(p)).toFixed(1)}`).join(" ");

            const actPath  = acts.map((a,i)=>`${i===0?"M":"L"}${xS(a.t).toFixed(1)},${yS(a.v).toFixed(1)}`).join(" ");

            const tzHi = (chartMetric==="weight" && Number.isFinite(cfg.targetWeightMaxKg)) ? yS(cfg.targetWeightMaxKg) : null;
            const tzLo = (chartMetric==="weight" && Number.isFinite(cfg.targetWeightMinKg)) ? yS(cfg.targetWeightMinKg) : null;

            // "Nice" y step aiming for ~6–10 gridlines whatever the metric's scale (kg, %, kcal…).
            const rawStep = (maxW - minW) / (chartFull ? 10 : 6);
            const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
            const stepY = [1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=rawStep);
            const yDec = Math.max(0, -Math.floor(Math.log10(stepY) + 1e-9));
            const yTicks=[];
            for(let w=Math.ceil(minW/stepY)*stepY; w<=maxW+1e-9; w+=stepY) yTicks.push(+w.toFixed(yDec+1));

            // Date axis: dd/mm/yyyy. Pick the finest step whose labels still have room,
            // so more dates appear as the chart gets wider.
            const DAY = 86400000;
            const fmt = t => new Date(t).toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"});
            const minLabelGap = fs * 2.2;
            const step = [1,2,3,7,14,30,61,91,182,365].find(d => d * dayPx >= minLabelGap) || 365;
            const xTicks = [];
            for (let t = Math.ceil(tMin / DAY) * DAY; t <= tMax; t += step * DAY) xTicks.push(t);
            const axisY = PAD.top + cH;
            lastActXRef.current = acts.length ? xS(acts[acts.length-1].t) : null;

            return (
              <>
              <div style={{ display:"flex", gap:"14px", justifyContent:"flex-end", fontSize:chartFull?"12px":"10px", color:"#6b7280", marginBottom:"4px" }}>
                <span style={{ display:"flex", alignItems:"center", gap:"5px" }}><svg width="16" height="4"><line x1="0" y1="2" x2="16" y2="2" stroke="#90CAF9" strokeWidth="1.5" strokeDasharray="4,3"/></svg>Projected</span>
                <span style={{ display:"flex", alignItems:"center", gap:"5px" }}><svg width="16" height="6"><line x1="0" y1="3" x2="16" y2="3" stroke="#378ADD" strokeWidth="2"/><circle cx="8" cy="3" r="2.5" fill="#378ADD"/></svg>Actual</span>
              </div>
              <style>{`
                .vaulte-chart-scroll { scrollbar-width: auto; scrollbar-color: #9ca3af #f3f4f6; }
                .vaulte-chart-scroll::-webkit-scrollbar { height: 16px; }
                .vaulte-chart-scroll::-webkit-scrollbar-track { background: #f3f4f6; border-radius: 8px; }
                .vaulte-chart-scroll::-webkit-scrollbar-thumb { background: #9ca3af; border-radius: 8px; border: 3px solid #f3f4f6; }
                .vaulte-chart-scroll::-webkit-scrollbar-thumb:hover { background: #6b7280; }
              `}</style>
              <div ref={chartScrollRef} className={chartFull?"vaulte-chart-scroll":undefined}
                style={chartFull?{overflowX:"auto",overflowY:"hidden",flex:1,minHeight:0}:undefined}>
              <svg width={chartFull?W:"100%"} height={chartFull?H:undefined} viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="xMidYMid meet"
                style={{display:"block"}}>
                {tzHi!=null && tzLo!=null &&
                  <rect x={PAD.left} y={tzHi} width={cW} height={Math.max(0,tzLo-tzHi)} fill="#C8E6C9" opacity="0.4"/>}
                {tzHi!=null &&
                  <text x={PAD.left+3*k} y={tzHi-2*k} fontSize={fs} fill="#2E7D32">Target {cfg.targetWeightMinKg}–{cfg.targetWeightMaxKg} kg</text>}

                {yTicks.map(w=><line key={w} x1={PAD.left} x2={PAD.left+cW} y1={yS(w)} y2={yS(w)} stroke="#e5e7eb" strokeWidth={0.5*k}/>)}
                {yTicks.map(w=><text key={"y"+w} x={PAD.left-4*k} y={yS(w)+3*k} fontSize={fs} fill="#6b7280" textAnchor="end">{w.toFixed(yDec)}</text>)}
                <text x={PAD.left-4*k} y={PAD.top-3*k} fontSize={fs} fill="#9ca3af" textAnchor="end">{unit}</text>
                <line x1={PAD.left} x2={PAD.left+cW} y1={axisY} y2={axisY} stroke="#9ca3af" strokeWidth={0.75*k}/>
                {xTicks.map(t=>{ const x=xS(t), y=axisY+9*k; return (
                  <g key={"x"+t}>
                    <line x1={x} x2={x} y1={axisY} y2={axisY+4*k} stroke="#9ca3af" strokeWidth={0.75*k}/>
                    <text x={x} y={y} fontSize={fs} fill="#6b7280" textAnchor="end" transform={`rotate(-45 ${x} ${y})`}>{fmt(t)}</text>
                  </g>); })}

                {projPath && <path d={projPath} fill="none" stroke="#90CAF9" strokeWidth={sw} strokeDasharray={`${4*k},${3*k}`}/>}
                {actPath && <path d={actPath} fill="none" stroke="#378ADD" strokeWidth={actSW} opacity="0.6"/>}
                {acts.map(a=><circle key={a.date} cx={xS(a.t)} cy={yS(a.v)} r={hoverPt?.t===a.t ? r*1.6 : r} fill="#378ADD" stroke="#fff" strokeWidth={Math.max(0.3, r*0.3)} style={{pointerEvents:"none"}}/>)}

                {/* Expanded view: invisible, day-wide hit areas + tooltip */}
                {chartFull && acts.map(a=>(
                  <circle key={"h"+a.date} cx={xS(a.t)} cy={yS(a.v)} r={Math.max(r*2, Math.min(dayPx/2, 14))}
                    fill="transparent" style={{cursor:"pointer"}}
                    onMouseEnter={()=>setHoverPt({t:a.t, v:a.v})} onMouseLeave={()=>setHoverPt(null)}/>
                ))}
                {chartFull && hoverPt && (()=>{
                  const label = `${fmt(hoverPt.t)} · ${Number(hoverPt.v).toFixed(1)}${unit?` ${unit}`:""}`;
                  const bw = label.length * fs * 0.58 + 16, bh = fs * 2;
                  const px = xS(hoverPt.t), py = yS(hoverPt.v);
                  const bx = Math.min(Math.max(px - bw/2, PAD.left), PAD.left + cW - bw);
                  const above = py - bh - 12 >= PAD.top;
                  const by = above ? py - bh - 12 : py + 12;
                  return (
                    <g style={{pointerEvents:"none"}}>
                      <rect x={bx} y={by} width={bw} height={bh} rx={4} fill="#1f2937" opacity="0.92"/>
                      <text x={bx + bw/2} y={by + bh/2 + fs*0.35} fontSize={fs} fill="#fff" textAnchor="middle" fontWeight="500">{label}</text>
                    </g>
                  );
                })()}

              </svg>
              </div>
              </>
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
