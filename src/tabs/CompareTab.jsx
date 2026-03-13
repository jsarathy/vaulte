// src/tabs/CompareTab.jsx
import { fmt, formatDateShort, ACTIVITY_LEVELS, calcMacros, getDayTotals } from "../constants/helpers";
import { C, FONT, border } from "../constants/design";

export default function CompareTab({ compareSlots, setCompareSlots, compareData, setCompareData, allDays, calcSex, setCalcSex, calcAge, setCalcAge, calcHeight, setCalcHeight, calcWeight, setCalcWeight, calcProtein, setCalcProtein, calcFatPct, setCalcFatPct }) {
  const todayStr = new Date().toISOString().split("T")[0];
  const BMR = calcSex==="m" ? 10*calcWeight+6.25*calcHeight-5*calcAge+5 : 10*calcWeight+6.25*calcHeight-5*calcAge-161;

  const inp = { width:"100%", padding:"5px 8px", border:`0.5px solid ${C.borderMid}`, borderRadius:"5px", fontSize:"12px", fontFamily:FONT.sans, outline:"none", background:"#fff", height:"30px" };
  const lbl = { fontSize:"10px", fontWeight:"500", textTransform:"uppercase", letterSpacing:"0.4px", color:C.hint, marginBottom:"4px", display:"block" };

  return (
    <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
      {/* Left: day comparison */}
      <div style={{ flex:1, overflowY:"auto", padding:"14px 16px" }}>
        <div style={{ marginBottom:"12px" }}>
          <div style={{ fontSize:"14px",fontWeight:"500",color:C.text,marginBottom:"2px" }}>Compare days</div>
          <div style={{ fontSize:"11px",color:C.muted }}>Click a date to swap it out</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,minmax(0,1fr))", gap:"7px" }}>
          {compareSlots.map((date,idx)=>{
            const data=compareData[idx];
            const t=getDayTotals(data);
            return (
              <div key={idx} style={{ background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:"8px",overflow:"hidden" }}>
                <div onClick={()=>{ const nd=prompt("Date (YYYY-MM-DD):",date||todayStr); if(!nd)return; const found=allDays.find(d=>d.date===nd); const ns=[...compareSlots];ns[idx]=nd;const nd2=[...compareData];nd2[idx]=found||null;setCompareSlots(ns);setCompareData(nd2); }}
                  style={{ padding:"7px 8px",cursor:"pointer",background:C.bg,borderBottom:`0.5px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                  <span style={{ fontSize:"11px",fontWeight:"500",color:C.text }}>{date?formatDateShort(date):"— pick —"}</span>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={C.hint} strokeWidth="1.5"><path d="M2 3.5l3 3 3-3"/></svg>
                </div>
                <div style={{ padding:"8px 10px" }}>
                  {!data
                    ? <div style={{ textAlign:"center",color:C.border,fontSize:"18px",fontWeight:"500",padding:"8px 0 2px",fontFamily:FONT.mono }}>—</div>
                    : <>
                        <div style={{ fontFamily:FONT.mono,fontSize:"20px",fontWeight:"500",color:C.text,textAlign:"center",padding:"6px 0 1px",letterSpacing:"-0.5px" }}>{fmt(t.foodKcal)}</div>
                        <div style={{ fontSize:"10px",color:C.hint,textAlign:"center",marginBottom:"8px" }}>kcal</div>
                        {[["Fat",t.fat],["Carbs",t.carbs],["Net C",t.net_carbs],["Fibre",t.fibre],["Protein",t.protein],["Sugar",t.sugar]].map(([label,val])=>(
                          <div key={label} style={{ display:"flex",justifyContent:"space-between",padding:"3px 0",borderBottom:`0.5px solid ${C.border}`,fontSize:"11px" }}>
                            <span style={{ color:C.hint }}>{label}</span>
                            <span style={{ fontWeight:"500",color:C.text,fontFamily:FONT.mono }}>{fmt(val)}g</span>
                          </div>
                        ))}
                      </>
                  }
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: Reference Diet Calculator */}
      <div style={{ width:"260px",flexShrink:0,background:"#fff",borderLeft:`0.5px solid ${C.border}`,overflowY:"auto",padding:"14px" }}>
        <div style={{ fontSize:"12px",fontWeight:"500",color:C.text,marginBottom:"12px",paddingBottom:"8px",borderBottom:`0.5px solid ${C.border}` }}>Reference calculator</div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"7px",marginBottom:"8px" }}>
          {[
            ["Sex",<select key="sex" value={calcSex} onChange={e=>setCalcSex(e.target.value)} style={inp}><option value="m">Male</option><option value="f">Female</option></select>],
            ["Age",<input key="age" type="number" value={calcAge} onChange={e=>setCalcAge(+e.target.value)} style={inp}/>],
            ["Height cm",<input key="ht" type="number" value={calcHeight} onChange={e=>setCalcHeight(+e.target.value)} style={inp}/>],
            ["Weight kg",<input key="wt" type="number" value={calcWeight} onChange={e=>setCalcWeight(+e.target.value)} style={inp}/>],
          ].map(([l,input])=>(
            <div key={l}><span style={lbl}>{l}</span>{input}</div>
          ))}
        </div>
        <div style={{ marginBottom:"8px" }}><span style={lbl}>Protein target</span>
          <select value={calcProtein} onChange={e=>setCalcProtein(+e.target.value)} style={inp}>
            <option value="0.8">0.8g/kg standard</option><option value="1.2">1.2g/kg active</option>
            <option value="1.4">1.4g/kg 60+ preserve</option><option value="1.6">1.6g/kg strength</option><option value="2.0">2.0g/kg performance</option>
          </select>
        </div>
        <div style={{ marginBottom:"12px" }}><span style={lbl}>Fat % of calories</span>
          <select value={calcFatPct} onChange={e=>setCalcFatPct(+e.target.value)} style={inp}>
            <option value="25">25%</option><option value="30">30%</option><option value="35">35%</option><option value="40">40%</option>
          </select>
        </div>
        <div style={{ textAlign:"center",fontSize:"11px",color:C.muted,marginBottom:"10px" }}>
          BMR <span style={{ fontFamily:FONT.mono,fontWeight:"500",color:C.text }}>{Math.round(BMR).toLocaleString()}</span> kcal · Mifflin-St Jeor
        </div>
        <div style={{ display:"flex",flexDirection:"column",gap:"5px" }}>
          {ACTIVITY_LEVELS.map((lvl,i)=>{
            const td=Math.round(BMR*lvl.factor);
            const m=calcMacros(td,calcWeight,calcProtein,calcFatPct/100);
            return (
              <div key={i} style={{ border:`0.5px solid ${i===0?C.blue:C.border}`,borderRadius:"6px",padding:"7px 9px",background:i===0?C.blueBg:"#fff" }}>
                <div style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:"2px" }}>
                  <span style={{ fontSize:"11px",fontWeight:"500",color:i===0?C.blueText:C.text }}>{lvl.label}</span>
                  <span style={{ fontFamily:FONT.mono,fontSize:"12px",fontWeight:"500",color:i===0?C.blue:C.text }}>{td.toLocaleString()}</span>
                </div>
                <div style={{ fontSize:"10px",color:C.hint }}>{lvl.desc}</div>
                <div style={{ fontSize:"10px",color:C.muted,fontFamily:FONT.mono,marginTop:"2px" }}>P:{m.protein_g}g F:{m.fat_g}g C:{m.carbs_g}g</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
