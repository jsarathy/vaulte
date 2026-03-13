// src/tabs/CompareTab.jsx
import { fmt, formatDateShort, ACTIVITY_LEVELS, calcMacros, getDayTotals } from "../constants/helpers";

export default function CompareTab({
  compareSlots, setCompareSlots,
  compareData, setCompareData,
  allDays,
  calcSex, setCalcSex,
  calcAge, setCalcAge,
  calcHeight, setCalcHeight,
  calcWeight, setCalcWeight,
  calcProtein, setCalcProtein,
  calcFatPct, setCalcFatPct,
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const BMR = calcSex==="m" ? 10*calcWeight+6.25*calcHeight-5*calcAge+5 : 10*calcWeight+6.25*calcHeight-5*calcAge-161;

  return (
    <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
      {/* Left: day comparison */}
      <div style={{ flex:1, overflowY:"auto", padding:"16px" }}>
        <div style={{ marginBottom:"12px" }}>
          <div style={{ fontSize:"18px", fontWeight:"bold", color:"#1F4E79", marginBottom:"3px" }}>Compare Days</div>
          <p style={{ color:"#6B8CAE", fontSize:"12px" }}>Last 5 logged days — click a date to swap it</p>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"8px" }}>
          {compareSlots.map((date,idx) => {
            const data = compareData[idx];
            const t = getDayTotals(data);
            return (
              <div key={idx} style={{ background:"#fff", borderRadius:"8px", border:"1px solid #DDEAF6", overflow:"hidden" }}>
                <div onClick={() => {
                  const newDate = prompt("Enter date (YYYY-MM-DD):", date||todayStr);
                  if (!newDate) return;
                  const found = allDays.find(d=>d.date===newDate);
                  const newSlots=[...compareSlots]; newSlots[idx]=newDate;
                  const newData=[...compareData]; newData[idx]=found||null;
                  setCompareSlots(newSlots); setCompareData(newData);
                }} style={{ background:"#1F4E79", padding:"7px 8px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"4px" }}>
                  <span style={{ fontSize:"11px", fontWeight:"bold", color:"#fff", textAlign:"center", lineHeight:1.3 }}>{date?formatDateShort(date):"— pick date —"}</span>
                  <span style={{ fontSize:"10px", color:"rgba(255,255,255,0.6)" }}>▾</span>
                </div>
                <div style={{ padding:"8px 10px" }}>
                  {!data
                    ? <div style={{ textAlign:"center", color:"#ddd", fontSize:"22px", fontWeight:"bold", padding:"8px 0 2px" }}>—</div>
                    : <>
                        <div style={{ fontSize:"22px", fontWeight:"bold", color:"#1F4E79", textAlign:"center", padding:"8px 0 2px", lineHeight:1 }}>{fmt(t.foodKcal)}</div>
                        <div style={{ fontSize:"10px", color:"#6B8CAE", textAlign:"center", marginBottom:"8px" }}>kcal</div>
                        {[["Fat",t.fat],["Carbs",t.carbs],["Net C",t.net_carbs],["Fibre",t.fibre],["Protein",t.protein],["Sugar",t.sugar]].map(([label,val]) => (
                          <div key={label} style={{ display:"flex", justifyContent:"space-between", padding:"3px 0", borderBottom:"1px solid #DDEAF6", fontSize:"11px" }}>
                            <span style={{ color:"#6B8CAE" }}>{label}</span>
                            <span style={{ fontWeight:"bold", color:"#1F4E79" }}>{fmt(val)}g</span>
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
      <div style={{ width:"280px", flexShrink:0, background:"#fff", borderLeft:"1px solid #DDEAF6", overflowY:"auto", padding:"14px" }}>
        <div style={{ fontSize:"13px", fontWeight:"bold", color:"#1F4E79", marginBottom:"10px", borderBottom:"2px solid #D6E4F0", paddingBottom:"6px" }}>🎯 Reference Diet Calculator</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"7px", marginBottom:"8px" }}>
          {[
            ["Sex", <select key="sex" value={calcSex} onChange={e=>setCalcSex(e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}><option value="m">Male</option><option value="f">Female</option></select>],
            ["Age (yrs)", <input key="age" type="number" value={calcAge} onChange={e=>setCalcAge(+e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}/>],
            ["Height (cm)", <input key="ht" type="number" value={calcHeight} onChange={e=>setCalcHeight(+e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}/>],
            ["Weight (kg)", <input key="wt" type="number" value={calcWeight} onChange={e=>setCalcWeight(+e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}/>],
          ].map(([label, input]) => (
            <div key={label}><div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:"2px" }}>{label}</div>{input}</div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr", gap:"7px", marginBottom:"10px" }}>
          <div>
            <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:"2px" }}>Protein target</div>
            <select value={calcProtein} onChange={e=>setCalcProtein(+e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}>
              <option value="0.8">0.8g/kg (standard)</option>
              <option value="1.2">1.2g/kg (active)</option>
              <option value="1.4">1.4g/kg (60+ preserve)</option>
              <option value="1.6">1.6g/kg (strength)</option>
              <option value="2.0">2.0g/kg (performance)</option>
            </select>
          </div>
          <div>
            <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:"2px" }}>Fat % of calories</div>
            <select value={calcFatPct} onChange={e=>setCalcFatPct(+e.target.value)} style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}>
              <option value="25">25%</option><option value="30">30%</option><option value="35">35%</option><option value="40">40%</option>
            </select>
          </div>
        </div>
        <div style={{ fontSize:"11px", color:"#6B8CAE", textAlign:"center", marginBottom:"8px" }}>BMR <strong>{Math.round(BMR).toLocaleString()} kcal</strong> · Mifflin-St Jeor</div>
        <div style={{ background:"#D6E4F0", border:"1px solid #DDEAF6", borderRadius:"8px", padding:"8px 10px" }}>
          {ACTIVITY_LEVELS.map((lvl,i) => {
            const td = Math.round(BMR * lvl.factor);
            const m = calcMacros(td, calcWeight, calcProtein, calcFatPct/100);
            return (
              <div key={i} style={{ background:i===0?"#E3F2FD":"#D6E4F0", border:"1px solid #DDEAF6", borderRadius:"6px", padding:"5px 8px", marginBottom:"4px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div>
                  <div style={{ fontSize:"12px", fontWeight:"bold", color:"#1F4E79" }}>{lvl.label}</div>
                  <div style={{ fontSize:"9px", color:"#6B8CAE" }}>{lvl.desc}</div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:"12px", fontWeight:"bold", color:"#2E75B6" }}>{td.toLocaleString()} kcal</div>
                  <div style={{ fontSize:"9px", color:"#6B8CAE" }}>P:{m.protein_g}g F:{m.fat_g}g C:{m.carbs_g}g</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
