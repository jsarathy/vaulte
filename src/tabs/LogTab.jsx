// src/tabs/LogTab.jsx
import { fmt, formatDate, ACTIVITY_LEVELS, calcMacros, getDayTotals } from "../constants/helpers";

export default function LogTab({
  currentDate, currentDayData,
  allDays, switchDay,
  userRecipes, setRecipeModal,
  deleteItem,
  calcSex, calcAge, calcHeight, calcWeight, calcProtein, calcFatPct,
}) {
  if (!currentDayData) return (
    <div style={{ textAlign:"center", color:"#6B8CAE", padding:"40px" }}>Select or create a day to get started</div>
  );

  const totals = getDayTotals(currentDayData);
  const BMR = calcSex === "m" ? 10*calcWeight + 6.25*calcHeight - 5*calcAge + 5 : 10*calcWeight + 6.25*calcHeight - 5*calcAge - 161;
  let activeTierIdx = 0;
  if (totals.exerciseBurned > 300) activeTierIdx = 3;
  else if (totals.exerciseBurned > 150) activeTierIdx = 2;
  else if (totals.exerciseBurned > 0) activeTierIdx = 1;
  const activeTier = ACTIVITY_LEVELS[activeTierIdx];
  const tdee = Math.round(BMR * activeTier.factor);
  const macroTgt = calcMacros(tdee, calcWeight, calcProtein, calcFatPct / 100);

  return (
    <>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
        <div style={{ fontSize:"18px", fontWeight:"bold", color:"#1F4E79" }}>{formatDate(currentDate)}</div>
        <div style={{ display:"flex", gap:"4px" }}>
          <button onClick={() => { const idx=allDays.findIndex(d=>d.date===currentDate); if(idx<allDays.length-1) switchDay(allDays[idx+1].date); }}
            style={{ background:"#1F4E79", color:"#fff", border:"none", borderRadius:"4px", padding:"5px 10px", cursor:"pointer", fontSize:"14px" }}>‹</button>
          <button onClick={() => { const idx=allDays.findIndex(d=>d.date===currentDate); if(idx>0) switchDay(allDays[idx-1].date); }}
            style={{ background:"#1F4E79", color:"#fff", border:"none", borderRadius:"4px", padding:"5px 10px", cursor:"pointer", fontSize:"14px" }}>›</button>
        </div>
      </div>

      {/* Grand total */}
      <div style={{ background:"#1F4E79", color:"#fff", borderRadius:"8px", padding:"12px 14px", marginBottom:"14px", overflowX:"auto" }}>
        <div style={{ fontWeight:"bold", fontSize:"13px", marginBottom:"8px" }}>📊 Day Total</div>
        <table style={{ width:"100%", borderCollapse:"collapse", minWidth:"500px" }}>
          <tbody>
            <tr style={{ opacity:0.7, fontSize:"11px" }}>
              <td></td>
              {["Calories","Fat","Carbs","Sugar","Fibre","Net C","Protein"].map(h => <td key={h} style={{ textAlign:"right", padding:"2px 6px" }}>{h}</td>)}
            </tr>
            <tr>
              <td style={{ fontSize:"12px", opacity:0.8, whiteSpace:"nowrap" }}>🍽 Intake</td>
              <td style={{ textAlign:"right", padding:"3px 6px", fontWeight:"bold" }}>{fmt(totals.foodKcal)} kcal</td>
              {[totals.fat,totals.carbs,totals.sugar,totals.fibre,totals.net_carbs,totals.protein].map((v,i) => <td key={i} style={{ textAlign:"right", padding:"3px 6px" }}>{fmt(v)}g</td>)}
            </tr>
            <tr>
              <td style={{ fontSize:"12px", opacity:0.8, whiteSpace:"nowrap" }}>📉 vs {activeTier.label}</td>
              {[
                [tdee - totals.foodKcal, " kcal"],
                [macroTgt.fat_g - totals.fat,"g"],
                [macroTgt.carbs_g - totals.carbs,"g"],
                [null,""],
                [macroTgt.fibre_g - totals.fibre,"g"],
                [null,""],
                [macroTgt.protein_g - totals.protein,"g"],
              ].map(([v,unit],i) => v === null
                ? <td key={i} style={{ textAlign:"right", padding:"3px 6px", opacity:0.4 }}>—</td>
                : <td key={i} style={{ textAlign:"right", padding:"3px 6px", fontWeight:"600", color: v>=0?"#81C784":"#EF9A9A" }}>{v>=0?"+":""}{fmt(v)}{unit}</td>
              )}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Meal cards */}
      {currentDayData.meals?.map(meal => {
        const mKcal = meal.items?.reduce((s,i)=>s+(i.kcal||0),0)||0;
        const mFat  = meal.items?.reduce((s,i)=>s+(i.fat||0),0)||0;
        const mCarbs= meal.items?.reduce((s,i)=>s+(i.carbs||0),0)||0;
        const mFibre= meal.items?.reduce((s,i)=>s+(i.fibre||0),0)||0;
        const mProt = meal.items?.reduce((s,i)=>s+(i.protein||0),0)||0;
        return (
          <div key={meal.id} style={{ background:"#fff", borderRadius:"8px", border:"1px solid #DDEAF6", marginBottom:"10px", overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ padding:"8px 12px", fontWeight:"bold", fontSize:"12px", color:"#fff", background:meal.is_exercise?"#2E7D32":"#2E75B6", display:"flex", justifyContent:"space-between" }}>
              <span>{meal.name}</span>
              <span style={{ fontWeight:"normal", opacity:0.9, fontSize:"11px" }}>{mKcal!==0?fmt(mKcal)+" kcal":""}</span>
            </div>
            {(!meal.items||meal.items.length===0)
              ? <div style={{ padding:"10px 12px", fontSize:"12px", color:"#6B8CAE", fontStyle:"italic" }}>No items logged yet</div>
              : <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", tableLayout:"fixed", minWidth:"480px" }}>
                    <colgroup><col style={{ width:"auto" }}/>{Array(7).fill(0).map((_,i)=><col key={i} style={{ width:"62px" }}/>)}<col style={{ width:"28px" }}/></colgroup>
                    <thead>
                      <tr style={{ background:"#D6E4F0" }}>
                        {["Item","kcal","Fat","Carbs","Sugar","Fibre","Net C","Prot",""].map(h => (
                          <th key={h} style={{ color:"#1F4E79", fontSize:"10px", textTransform:"uppercase", letterSpacing:"0.3px", padding:"4px 8px", textAlign:h==="Item"?"left":"right" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {meal.items?.map(item => {
                        const recipe = userRecipes.find(r=>r.name===item.recipe_name);
                        return (
                          <tr key={item.id} style={{ background:meal.is_exercise?"#E8F5E9":"inherit" }}>
                            <td style={{ padding:"5px 8px", fontSize:"12px", color:meal.is_exercise?"#2E7D32":"inherit", fontWeight:meal.is_exercise?"bold":"normal" }}>
                              {recipe
                                ? <span onClick={()=>setRecipeModal(recipe)} style={{ color:"#2E75B6", cursor:"pointer", borderBottom:"1px dashed #2E75B6" }}>{item.name}</span>
                                : item.name}
                            </td>
                            {[item.kcal,item.fat,item.carbs,item.sugar,item.fibre,item.net_carbs,item.protein].map((v,i) => (
                              <td key={i} style={{ padding:"5px 8px", textAlign:"right", fontSize:"12px", color:meal.is_exercise?"#2E7D32":"inherit" }}>{fmt(v||0)}{i>0?"g":""}</td>
                            ))}
                            <td style={{ textAlign:"center" }}>
                              <button onClick={()=>{ if(confirm("Remove this item?")) deleteItem(meal.id,item.id); }}
                                style={{ background:"none", border:"none", color:"#c62828", cursor:"pointer", fontSize:"11px", padding:"0 3px", opacity:0.6 }}>✕</button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr style={{ background:"#D6E4F0", fontWeight:"bold", fontSize:"11px", color:"#1F4E79", borderTop:"2px solid #DDEAF6" }}>
                        <td style={{ padding:"4px 8px" }}>Subtotal</td>
                        {[mKcal,mFat,mCarbs,meal.items?.reduce((s,it)=>s+(it.sugar||0),0),mFibre,meal.items?.reduce((s,it)=>s+(it.net_carbs||0),0),mProt].map((v,i) => (
                          <td key={i} style={{ padding:"4px 8px", textAlign:"right" }}>{fmt(v||0)}{i>0?"g":""}</td>
                        ))}
                        <td/>
                      </tr>
                    </tbody>
                  </table>
                </div>
            }
          </div>
        );
      })}
    </>
  );
}
