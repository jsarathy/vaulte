// src/tabs/BodyTracker.jsx
// Body tab: Renpho Smart Body Tape Measure readings (cm), one row per date in
// users/{uid}/body_log/{date}. Layout mirrors WeightTracker: log table left,
// Trajectory chart + anatomy figure right.
import { useState, useEffect, useRef } from "react";
import { db } from "../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";

// The 12 standard sites from the Renpho tape app, in app order.
export const BODY_MEASURES = [
  { key:"neck",     label:"Neck",     short:"Neck",
    info:"Wrap the tape around the neck just below the Adam's apple, level all the way round. Keep your head straight and neck relaxed." },
  { key:"shoulder", label:"Shoulder", short:"Shldr",
    info:"Stand upright with arms relaxed at your sides. Measure around the widest point of the shoulders, passing over the top of both arms." },
  { key:"bicepL",   label:"L-Bicep",  short:"L-Bicep",
    info:"Left upper arm at its thickest point, roughly midway between shoulder and elbow. Arm hanging relaxed — measure the same way (relaxed or flexed) every time." },
  { key:"bicepR",   label:"R-Bicep",  short:"R-Bicep",
    info:"Right upper arm at its thickest point, roughly midway between shoulder and elbow. Arm hanging relaxed — measure the same way (relaxed or flexed) every time." },
  { key:"chest",    label:"Chest",    short:"Chest",
    info:"Around the fullest part of the chest at nipple level, tape under the armpits and level across the back. Read it after a normal breath out." },
  { key:"waist",    label:"Waist",    short:"Waist",
    info:"At the narrowest point of the torso, usually just above the navel, between the lowest rib and the hip bone. Stand relaxed, breathe out normally, don't pull in." },
  { key:"abdomen",  label:"Abdomen",  short:"Abdo",
    info:"Level with the belly button, tape horizontal all the way round. Stand relaxed and read after a normal breath out." },
  { key:"hip",      label:"Hip",      short:"Hip",
    info:"Feet together. Measure around the widest part of the buttocks, keeping the tape level front to back." },
  { key:"thighL",   label:"L-Thigh",  short:"L-Thigh",
    info:"Left thigh at its widest point, just below the buttock crease. Stand with weight spread evenly on both feet." },
  { key:"thighR",   label:"R-Thigh",  short:"R-Thigh",
    info:"Right thigh at its widest point, just below the buttock crease. Stand with weight spread evenly on both feet." },
  { key:"calfL",    label:"L-Calf",   short:"L-Calf",
    info:"Left calf at its widest point, roughly a third of the way down from the knee. Stand with weight spread evenly, calf relaxed." },
  { key:"calfR",    label:"R-Calf",   short:"R-Calf",
    info:"Right calf at its widest point, roughly a third of the way down from the knee. Stand with weight spread evenly, calf relaxed." },
];
const MEASURE = Object.fromEntries(BODY_MEASURES.map(m => [m.key, m]));

// ── Anatomy figure ───────────────────────────────────────────────────────────
// Front-view silhouette drawn from a few proportions, so male and female share
// one drawing. Each measurement site is a tape "ring"; the active one lights up.
// Anatomical convention: the person's left (L-) is on the viewer's right.
const BODY_SHAPE = {
  m: { head:[18,22], neck:10, shoulder:50, chest:40, waist:33, hip:36 },
  f: { head:[16,21], neck:8,  shoulder:42, chest:36, waist:27, hip:40 },
};
const lerp = (a,b,t) => a + (b-a)*t;

function AnatomyFigure({ sex, active, latest }) {
  const P = BODY_SHAPE[sex==="f" ? "f" : "m"];
  const X = 100; // centre line
  const { neck:n, shoulder:S, chest:C, waist:Wa, hip:H } = P;
  const isF = sex === "f";

  // Left half of each part (viewer's left); mirrored for the other side.
  const torso = `M${X+0.5},55 L${X-n},55 L${X-n},74 C${X-n},82 ${X-S+8},82 ${X-S},92
    C${X-S-2},100 ${X-C-2},104 ${X-C},114
    C${X-C-(isF?3:0)},128 ${X-Wa},136 ${X-Wa},152
    C${X-Wa},170 ${X-H},180 ${X-H},200
    C${X-H},208 ${X-H+2},214 ${X-H+4},218 L${X+0.5},224 Z`;
  const arm = `M${X-S+2},88 C${X-S-6},92 ${X-S-8},110 ${X-S-8},130
    L${X-S-9},172 L${X-S-12},215
    C${X-S-14},228 ${X-S-10},244 ${X-S-5},244 C${X-S},244 ${X-S+1},228 ${X-S+1},215
    L${X-S+4},172 L${X-C+1},118 Z`;
  const leg = `M${X-H+1},205 C${X-H},240 ${X-H+6},270 ${X-H+9},295
    C${X-H+6},315 ${X-H+7},340 ${X-H+11},370 L${X-H+12},392
    L${X-H+4},402 L${X-4},402 L${X-5},392 L${X-5},370
    C${X-4},340 ${X-6},315 ${X-5},295 C${X-4},270 ${X-2},240 ${X+0.5},220 Z`;

  // Arm / leg geometry at a given height (viewer's-left limb).
  const armAt = (y) => { const t=(y-118)/(172-118); const inner=lerp(X-C+1, X-S+4, t), outer=lerp(X-S-8, X-S-9, (y-130)/42); return { cx:(inner+outer)/2, hw:(inner-outer)/2 }; };
  const thigh = { cx: X-H/2, hw: H/2-1 };
  const calf  = { cx: (X-H+7 + X-5)/2, hw: (X-5 - (X-H+7))/2 };
  const arm135 = armAt(135);
  const mirror = cx => 2*X - cx;

  // Person's left = viewer's right.
  const RINGS = {
    neck:     { cx:X, y:66,  hw:n },
    shoulder: { cx:X, y:94,  hw:S+8 },
    chest:    { cx:X, y:120, hw:C+(isF?2:0) },
    waist:    { cx:X, y:152, hw:Wa },
    abdomen:  { cx:X, y:168, hw:(Wa+H)/2 },
    hip:      { cx:X, y:198, hw:H },
    bicepR:   { cx:arm135.cx,          y:135, hw:arm135.hw },
    bicepL:   { cx:mirror(arm135.cx),  y:135, hw:arm135.hw },
    thighR:   { cx:thigh.cx,           y:238, hw:thigh.hw },
    thighL:   { cx:mirror(thigh.cx),   y:238, hw:thigh.hw },
    calfR:    { cx:calf.cx,            y:330, hw:calf.hw },
    calfL:    { cx:mirror(calf.cx),    y:330, hw:calf.hw },
  };

  const body = "#C9D8EC", ring = "#90A4C0", hi = "#E8710A";
  const a = active && RINGS[active] ? active : null;
  const ar = a ? RINGS[a] : null;
  const labelRight = ar ? ar.cx >= X : true;
  const val = a ? latest[a] : null;

  return (
    <svg viewBox="0 0 200 410" style={{ display:"block", height:"360px", maxWidth:"100%", margin:"0 auto" }}>
      {isF && <path d={`M${X-19},34 C${X-22},10 ${X+22},10 ${X+19},34 L${X+20},72 L${X-20},72 Z`} fill="#AFC2DD"/>}
      <g fill={body}>
        <ellipse cx={X} cy={38} rx={P.head[0]} ry={P.head[1]}/>
        {[torso, arm, leg].map((d,i)=>(
          <g key={i}><path d={d}/><path d={d} transform={`translate(${2*X},0) scale(-1,1)`}/></g>
        ))}
      </g>
      {Object.entries(RINGS).map(([k,r2]) => k!==a && (
        <ellipse key={k} cx={r2.cx} cy={r2.y} rx={r2.hw+2} ry={2.6} fill="none"
          stroke={ring} strokeWidth="0.8" strokeDasharray="2,1.6" opacity="0.8"/>
      ))}
      {ar && (
        <g>
          <ellipse cx={ar.cx} cy={ar.y} rx={ar.hw+3} ry={3.4} fill={hi} fillOpacity="0.15" stroke={hi} strokeWidth="2"/>
          <line x1={labelRight?ar.cx+ar.hw+4:ar.cx-ar.hw-4} y1={ar.y} x2={labelRight?196:4} y2={ar.y} stroke={hi} strokeWidth="0.7"/>
          <text x={labelRight?196:4} y={ar.y-4} fontSize="9" fontWeight="bold" fill={hi} textAnchor={labelRight?"end":"start"}>{MEASURE[a].label}</text>
          {val!=null && <text x={labelRight?196:4} y={ar.y+10} fontSize="8.5" fill="#6b7280" textAnchor={labelRight?"end":"start"}>{Number(val).toFixed(1)} cm</text>}
        </g>
      )}
      <text x={14} y={404} fontSize="8" fill="#9ca3af">R</text>
      <text x={186} y={404} fontSize="8" fill="#9ca3af" textAnchor="end">L</text>
    </svg>
  );
}

export default function BodyTracker({ userId, bodyLog, setBodyLog, sex }) {
  // Trajectory panel: double-click to fill the screen, Esc to collapse.
  const [chartFull, setChartFull] = useState(false);
  const [chartMetric, setChartMetric] = useState("waist");
  useEffect(() => {
    if (!chartFull) return;
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); setChartFull(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chartFull]);

  const chartScrollRef = useRef(null);
  const lastActXRef = useRef(null);
  useEffect(() => {
    if (!chartFull) return;
    requestAnimationFrame(() => {
      const el = chartScrollRef.current;
      if (el && lastActXRef.current != null) el.scrollLeft = Math.max(0, lastActXRef.current - el.clientWidth * 0.75);
    });
  }, [chartFull, chartMetric]);

  const [chartBox, setChartBox] = useState({ w:0, h:0 });
  const [hoverPt, setHoverPt] = useState(null);
  const [hoverMetric, setHoverMetric] = useState(null);
  useEffect(() => { if (!chartFull) setHoverPt(null); }, [chartFull, chartMetric]);
  useEffect(() => {
    if (!chartFull || !chartScrollRef.current || typeof ResizeObserver === "undefined") return;
    const el = chartScrollRef.current;
    const ro = new ResizeObserver(() => setChartBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [chartFull]);

  // Persist one field of one row (date-keyed) and update local state.
  const saveField = async (i, key, val) => {
    const row = bodyLog[i];
    if (!row?.date) return;
    const updatedRow = { ...row, [key]: val };
    setBodyLog(bodyLog.map((r,j) => j===i ? updatedRow : r));
    try { await setDoc(doc(db,"users",userId,"body_log",row.date), updatedRow); }
    catch (e) { console.error("body row save failed", e); }
  };
  const deleteRow = async (row) => {
    if (!row?.date) return;
    if (!window.confirm(`Delete body measurements for ${row.date}?`)) return;
    try { await deleteDoc(doc(db,"users",userId,"body_log",row.date)); }
    catch (e) { console.error("body row delete failed", e); return; }
    setBodyLog(prev => prev.filter(r => r.date !== row.date));
  };
  // Most recent non-empty reading per measurement, for the anatomy label.
  const latest = Object.fromEntries(BODY_MEASURES.map(({key}) => {
    for (let i=bodyLog.length-1; i>=0; i--) if (bodyLog[i][key]!=null) return [key, bodyLog[i][key]];
    return [key, null];
  }));
  // Pull Smart Tape Measure readings from the Renpho cloud. Synced sites overwrite
  // that day's values; sites the tape didn't send keep any manual entry.
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const syncBody = async () => {
    if (syncing || !userId) return;
    setSyncing(true); setSyncMsg(null);
    try {
      const res = await fetch("/api/renpho-sync", { method:"POST", headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ userId, kind:"girth" }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Sync failed (HTTP ${res.status})`);
      const recs = data.records || [];
      if (!recs.length) setSyncMsg({ ok:true, text:"No tape measurements found." });
      else {
        const existing = new Map(bodyLog.map(r => [r.date, r]));
        const merged = recs.map(rec => ({ ...(existing.get(rec.date) || {}), date:rec.date, ...rec.values }));
        await Promise.all(merged.map(row => setDoc(doc(db,"users",userId,"body_log",row.date), row)));
        merged.forEach(row => existing.set(row.date, row));
        setBodyLog([...existing.values()].sort((a,b) => (a.date||"").localeCompare(b.date||"")));
        setSyncMsg({ ok:true, text:`Synced ${merged.length} day${merged.length!==1?"s":""}.` });
      }
    } catch (e) { setSyncMsg({ ok:false, text:e.message }); }
    setSyncing(false);
    setTimeout(() => setSyncMsg(null), 6000);
  };
  const toNum = v => { const t=String(v).trim(); if(t==="") return null; const n=Number(t); return Number.isFinite(n)?n:null; };

  const metricPill = (
    <div onDoubleClick={e=>e.stopPropagation()} style={{ position:"relative" }}>
      <div style={{ display:"flex", flexWrap:"wrap", gap:"4px" }}>
        {BODY_MEASURES.map(({ key:v, label })=>(
          <span key={v} style={{ position:"relative", display:"inline-flex" }}>
            <button onClick={e=>{ e.stopPropagation(); setChartMetric(v); }}
              onMouseEnter={()=>setHoverMetric(v)} onMouseLeave={()=>setHoverMetric(null)}
              onFocus={()=>setHoverMetric(v)} onBlur={()=>setHoverMetric(null)}
              style={{ border:"0.5px solid #cfe0f0", borderRadius:"999px", cursor:"pointer", padding:"3px 12px", fontSize:"11px", fontWeight:"bold",
                background: chartMetric===v ? "#185FA5" : "#F7FAFD",
                color: chartMetric===v ? "#fff" : "#6b7280" }}>{label}</button>
            {chartFull && hoverMetric===v && (
              <div style={{ position:"absolute", top:"calc(100% + 6px)", left:"50%", transform:"translateX(-50%)",
                zIndex:40, width:"260px", maxWidth:"80vw",
                background:"#1f2937", color:"#fff", borderRadius:"6px", padding:"8px 10px", textAlign:"left",
                fontSize:"11.5px", lineHeight:1.45, fontWeight:"normal", boxShadow:"0 4px 14px rgba(0,0,0,0.22)",
                pointerEvents:"none" }}>
                <div style={{ fontWeight:"bold", marginBottom:"3px" }}>{MEASURE[v].label} (cm)</div>
                {MEASURE[v].info}
              </div>
            )}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ flex:1, overflowY:"auto", display:"flex", gap:"14px", alignItems:"flex-start", padding:"16px" }}>

      {/* ── LEFT: Body Log Table (55%) ── */}
      <div style={{ flex:"0 0 55%", minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"10px" }}>
          <div style={{ fontSize:"15px", fontWeight:"bold", color:"#185FA5" }}>📏 Body Log</div>
          <button onClick={syncBody} disabled={syncing}
            style={{ background:syncing?"#9ca3af":"#378ADD", border:"none", color:"#fff", borderRadius:"4px",
              padding:"4px 10px", fontSize:"11px", fontWeight:"bold", cursor:syncing?"default":"pointer" }}>
            {syncing?"Syncing…":"⟳ Sync Renpho"}
          </button>
          {syncMsg
            ? <span style={{ fontSize:"11px", color:syncMsg.ok?"#2E7D32":"#c62828" }}>{syncMsg.text}</span>
            : <span style={{ fontSize:"11px", color:"#9ca3af" }}>cm · click a date in the calendar to add a row</span>}
        </div>
        <div style={{ background:"#fff", borderRadius:"8px", border:"0.5px solid #e5e7eb", overflow:"auto", maxHeight:"calc(100vh - 220px)" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:"12px" }}>
            <thead>
              <tr style={{ background:"#185FA5", color:"#fff", position:"sticky", top:0, zIndex:1 }}>
                {["Date", ...BODY_MEASURES.map(m=>m.short), ""].map((h,i) => (
                  <th key={h||`c${i}`} style={{ padding:"7px 6px", textAlign:"center", fontWeight:"bold", fontSize:"11px", whiteSpace:"nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyLog.length===0 && (
                <tr><td colSpan={BODY_MEASURES.length+2} style={{ padding:"18px", textAlign:"center", color:"#9ca3af", fontSize:"12px" }}>
                  No measurements yet — click a date in the calendar to start a row.
                </td></tr>
              )}
              {bodyLog.map((row,i) => {
                const rowBg = i%2===0?"#fff":"#F7FAFD";
                const isCurrent = i===bodyLog.length-1;
                return (
                  <tr key={row.date||i} style={{ background:isCurrent?"#E3F2FD":rowBg }}>
                    <td style={{ padding:"5px 8px", color:"#185FA5", whiteSpace:"nowrap", fontWeight:"600" }}>{row.date}</td>
                    {BODY_MEASURES.map(({ key }) => (
                      <td key={key} style={{ padding:"5px 3px", textAlign:"right" }}>
                        <input type="number" step="0.1" min="10" max="250"
                          value={row[key]??""}
                          placeholder="—"
                          onChange={e => saveField(i,key,toNum(e.target.value))}
                          style={{ width:"50px", padding:"2px 4px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"12px", textAlign:"right",
                            background:row[key]!=null?"#FFF3E0":"#fff", fontWeight:row[key]!=null?"bold":"normal",
                            color:row[key]!=null?"#B26A00":"#1a2a3a" }}/>
                      </td>
                    ))}
                    <td style={{ padding:"5px 6px", textAlign:"center" }}>
                      <button onClick={()=>deleteRow(row)} title="Delete row"
                        style={{ background:"none", border:"none", color:"#c62828", cursor:"pointer", fontSize:"13px", padding:0 }}>×</button>
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
            <div style={{ fontSize:"15px", fontWeight:"bold", color:"#185FA5", whiteSpace:"nowrap" }}>📉 Trajectory</div>
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
                <span style={{ fontSize:"16px", fontWeight:"bold", color:"#185FA5", whiteSpace:"nowrap" }}>📉 Trajectory</span>
                {metricPill}
              </div>
              <span style={{ fontSize:"11px", color:"#9ca3af" }}>Esc or double-click to collapse</span>
            </div>
          )}
          {(()=>{
            const unit = "cm";
            const acts = bodyLog.filter(r => r[chartMetric] != null && Number.isFinite(Date.parse(r.date)))
                                .map(r => ({ t: Date.parse(r.date), v: Number(r[chartMetric]), date: r.date }))
                                .sort((a,b) => a.t - b.t);
            if (acts.length < 2) {
              return <div style={{ height:chartFull?"70vh":"200px", display:"flex", alignItems:"center", justifyContent:"center", color:"#9ca3af", fontSize:"12px" }}>
                Needs at least two {MEASURE[chartMetric].label} readings
              </div>;
            }

            const tMin = acts[0].t, tMax = acts[acts.length-1].t;
            const span = tMax - tMin || 1;
            const days = Math.max(1, span / 86400000);

            const MIN_DAY_PX = 12;
            const k = chartFull ? 1.6 : 1;
            const PAD={top:12*k,right:16*k,bottom:50*k,left:40*k};
            const vw = chartBox.w || (typeof window !== "undefined" ? window.innerWidth - 48 : 1200);
            const vh = chartBox.h || (typeof window !== "undefined" ? window.innerHeight - 150 : 600);
            const W = chartFull ? Math.max(vw, PAD.left + PAD.right + days * MIN_DAY_PX) : 380;
            const H = chartFull ? Math.max(300, vh - 22) : 230;
            const cW=W-PAD.left-PAD.right, cH=H-PAD.top-PAD.bottom;
            const fs = 8*k;

            const dayPx = cW / days;
            const r = Math.min(3*k, Math.max(0.6, dayPx * 0.4));
            const actSW = Math.min(2.5*k, Math.max(0.6, r * 0.7));

            const vals = acts.map(a=>a.v);
            const vPad = Math.max((Math.max(...vals) - Math.min(...vals)) * 0.15, 0.5);
            const minW = Math.min(...vals) - vPad, maxW = Math.max(...vals) + vPad;

            const xS = t => PAD.left + ((t - tMin) / span) * cW;
            const yS = v => PAD.top + cH - ((v - minW) / (maxW - minW)) * cH;
            const actPath = acts.map((a,i)=>`${i===0?"M":"L"}${xS(a.t).toFixed(1)},${yS(a.v).toFixed(1)}`).join(" ");

            const rawStep = (maxW - minW) / (chartFull ? 10 : 6);
            const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
            const stepY = [1,2,2.5,5,10].map(m=>m*mag).find(s=>s>=rawStep);
            const yDec = Math.max(0, -Math.floor(Math.log10(stepY) + 1e-9));
            const yTicks=[];
            for(let w=Math.ceil(minW/stepY)*stepY; w<=maxW+1e-9; w+=stepY) yTicks.push(+w.toFixed(yDec+1));

            const DAY = 86400000;
            const fmt = t => new Date(t).toLocaleDateString("en-GB",{day:"2-digit",month:"2-digit",year:"numeric",timeZone:"UTC"});
            const minLabelGap = fs * 2.2;
            const step = [1,2,3,7,14,30,61,91,182,365].find(d => d * dayPx >= minLabelGap) || 365;
            const xTicks = [];
            for (let t = Math.ceil(tMin / DAY) * DAY; t <= tMax; t += step * DAY) xTicks.push(t);
            const axisY = PAD.top + cH;
            lastActXRef.current = xS(acts[acts.length-1].t);

            return (
              <>
              <div style={{ display:"flex", gap:"14px", justifyContent:"flex-end", fontSize:chartFull?"12px":"10px", color:"#6b7280", marginBottom:"4px" }}>
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
                preserveAspectRatio="xMidYMid meet" style={{display:"block"}}>
                {yTicks.map(w=><line key={w} x1={PAD.left} x2={PAD.left+cW} y1={yS(w)} y2={yS(w)} stroke="#e5e7eb" strokeWidth={0.5*k}/>)}
                {yTicks.map(w=><text key={"y"+w} x={PAD.left-4*k} y={yS(w)+3*k} fontSize={fs} fill="#6b7280" textAnchor="end">{w.toFixed(yDec)}</text>)}
                <text x={PAD.left-4*k} y={PAD.top-3*k} fontSize={fs} fill="#9ca3af" textAnchor="end">{unit}</text>
                <line x1={PAD.left} x2={PAD.left+cW} y1={axisY} y2={axisY} stroke="#9ca3af" strokeWidth={0.75*k}/>
                {xTicks.map(t=>{ const x=xS(t), y=axisY+9*k; return (
                  <g key={"x"+t}>
                    <line x1={x} x2={x} y1={axisY} y2={axisY+4*k} stroke="#9ca3af" strokeWidth={0.75*k}/>
                    <text x={x} y={y} fontSize={fs} fill="#6b7280" textAnchor="end" transform={`rotate(-45 ${x} ${y})`}>{fmt(t)}</text>
                  </g>); })}

                <path d={actPath} fill="none" stroke="#378ADD" strokeWidth={actSW} opacity="0.6"/>
                {acts.map(a=><circle key={a.date} cx={xS(a.t)} cy={yS(a.v)} r={hoverPt?.t===a.t ? r*1.6 : r} fill="#378ADD" stroke="#fff" strokeWidth={Math.max(0.3, r*0.3)} style={{pointerEvents:"none"}}/>)}

                {chartFull && acts.map(a=>(
                  <circle key={"h"+a.date} cx={xS(a.t)} cy={yS(a.v)} r={Math.max(r*2, Math.min(dayPx/2, 14))}
                    fill="transparent" style={{cursor:"pointer"}}
                    onMouseEnter={()=>setHoverPt({t:a.t, v:a.v})} onMouseLeave={()=>setHoverPt(null)}/>
                ))}
                {chartFull && hoverPt && (()=>{
                  const label = `${fmt(hoverPt.t)} · ${Number(hoverPt.v).toFixed(1)} ${unit}`;
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

        {/* Anatomy — highlights the site under the hovered (or selected) pill */}
        <div style={{ background:"#fff", borderRadius:"8px", border:"0.5px solid #e5e7eb", overflow:"hidden", marginBottom:"12px" }}>
          <div style={{ background:"#185FA5", color:"#fff", padding:"8px 12px", fontSize:"12px", fontWeight:"bold" }}>
            <span>🧍 Measurement Sites</span>
          </div>
          {(() => {
            const act = hoverMetric || chartMetric;
            const m = MEASURE[act];
            return (
              <div style={{ padding:"10px 12px", display:"flex", gap:"12px", alignItems:"stretch" }}>
                <div style={{ flex:"0 0 48%", minWidth:0 }}>
                  <AnatomyFigure sex={sex} active={act} latest={latest}/>
                </div>
                <div style={{ flex:1, minWidth:0, background:"#F7FAFD", border:"0.5px solid #cfe0f0", borderRadius:"6px", padding:"12px 14px" }}>
                  <div style={{ fontSize:"15px", fontWeight:"bold", color:"#378ADD", textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:"6px" }}>📏 How to measure</div>
                  <div style={{ fontSize:"22px", fontWeight:"bold", color:"#185FA5", marginBottom:"8px" }}>{m.label} <span style={{ fontSize:"16px", fontWeight:"normal", color:"#6b7280" }}>(cm)</span></div>
                  <div style={{ fontSize:"18px", lineHeight:1.5, color:"#1a2a3a" }}>{m.info}</div>
                  <div style={{ marginTop:"14px", paddingTop:"10px", borderTop:"1px solid #e5e7eb", display:"flex", justifyContent:"space-between", fontSize:"16px" }}>
                    <span style={{ color:"#6b7280" }}>Latest</span>
                    <span style={{ color:latest[act]!=null?"#B26A00":"#9ca3af", fontWeight:"bold" }}>{latest[act]!=null ? `${Number(latest[act]).toFixed(1)} cm` : "—"}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
