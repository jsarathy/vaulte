// src/tabs/LogTab.jsx
import { fmt, formatDate, ACTIVITY_LEVELS, calcMacros, getDayTotals } from "../constants/helpers";
import { C, FONT, border, IconX, IconChevronLeft, IconChevronRight } from "../constants/design";

export default function LogTab({ currentDate, currentDayData, allDays, switchDay, userRecipes, setRecipeModal, deleteItem, calcSex, calcAge, calcHeight, calcWeight, calcProtein, calcFatPct }) {
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

  const inp = { padding:"0 8px", border:`0.5px solid ${C.borderMid}`, borderRadius:"4px", fontSize:"11px", fontFamily:FONT.sans, height:"28px", outline:"none", background:"#fff" };
  const macros = [["P",totals.protein,macroTgt.protein_g,"blue"],["F",totals.fat,macroTgt.fat_g,"amber"],["C",totals.carbs,macroTgt.carbs_g,"amber"]];

  return (
    <>
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

      {/* Calorie bar + macros */}
      <div style={{ background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:"8px",padding:"12px 14px",marginBottom:"10px" }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px" }}>
          <div style={{ display:"flex",alignItems:"baseline",gap:"6px" }}>
            <span style={{ fontFamily:FONT.mono,fontSize:"20px",fontWeight:"500",color:C.text,letterSpacing:"-0.5px" }}>{Math.round(totals.foodKcal).toLocaleString()}</span>
            <span style={{ fontSize:"11px",color:C.muted }}>of {tdee.toLocaleString()} kcal · {activeTier.label}</span>
          </div>
          <div style={{ display:"flex",gap:"5px",alignItems:"center" }}>
            {macros.map(([k,v,t,c])=>{
              const over=v>t;
              const bg=over?(c==="blue"?C.dangerBg:C.dangerBg):(c==="blue"?C.blueBg:c==="amber"?C.amberBg:C.greenBg);
              const col=over?C.danger:(c==="blue"?C.blueText:c==="amber"?C.amberText:C.greenText);
              return <span key={k} style={{ fontSize:"10px",fontWeight:"500",fontFamily:FONT.mono,padding:"2px 7px",borderRadius:"20px",background:bg,color:col,whiteSpace:"nowrap" }}>{k} {fmt(v)}g</span>;
            })}
            <span style={{ fontSize:"10px",fontFamily:FONT.mono,fontWeight:"500",padding:"2px 7px",borderRadius:"20px",background:remaining<0?C.dangerBg:C.greenBg,color:remaining<0?C.danger:C.greenText }}>
              {remaining>=0?"-":"+"}‎{Math.abs(Math.round(remaining)).toLocaleString()}
            </span>
          </div>
        </div>
        <div style={{ height:"4px",background:C.bg,borderRadius:"2px",overflow:"hidden" }}>
          <div style={{ height:"100%",width:`${pct}%`,background:pct>100?C.danger:C.blue,borderRadius:"2px",transition:"width 0.3s" }}/>
        </div>
      </div>

      {/* Summary metric row */}
      <div style={{ display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:"7px",marginBottom:"12px" }}>
        {[
          ["Calories",Math.round(totals.foodKcal).toLocaleString(),`target ${tdee.toLocaleString()}`,""],
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
      {currentDayData.meals?.map(meal=>{
        const mKcal=meal.items?.reduce((s,i)=>s+(i.kcal||0),0)||0;
        const isExercise=meal.is_exercise||meal.items?.some(i=>i.is_exercise);
        return (
          <div key={meal.id} style={{ background:"#fff",border:`0.5px solid ${C.border}`,borderRadius:"8px",marginBottom:"8px",overflow:"hidden" }}>
            {/* Meal header */}
            <div style={{ padding:"8px 12px",borderBottom:`0.5px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between" }}>
              <div style={{ display:"flex",alignItems:"center",gap:"7px" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={isExercise?C.blue:C.hint} strokeWidth="1.5" strokeLinecap="round">
                  {isExercise
                    ? <><path d="M3 8h10M8 3l3 5-3 5"/></>
                    : <><circle cx="8" cy="8" r="5"/><path d="M5 8h6"/><path d="M8 5v6"/></>
                  }
                </svg>
                <span style={{ fontSize:"12px",fontWeight:"500",color:isExercise?C.blueText:C.text }}>{meal.name}</span>
              </div>
              <span style={{ fontSize:"11px",color:C.muted,fontFamily:FONT.mono }}>{mKcal!==0?`${fmt(mKcal)} kcal`:""}</span>
            </div>

            {(!meal.items||meal.items.length===0)
              ? <div style={{ padding:"10px 12px",fontSize:"12px",color:C.hint,fontStyle:"italic" }}>No items logged yet</div>
              : <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%",borderCollapse:"collapse",tableLayout:"fixed",minWidth:"500px" }}>
                    <colgroup><col style={{ width:"auto" }}/>{Array(7).fill(0).map((_,i)=><col key={i} style={{ width:"58px" }}/>)}<col style={{ width:"28px" }}/></colgroup>
                    <thead>
                      <tr style={{ background:C.bg }}>
                        {["Item","kcal","Fat","Carbs","Sugar","Fibre","Net C","Prot",""].map(h=>(
                          <th key={h} style={{ color:C.hint,fontSize:"10px",fontWeight:"500",textTransform:"uppercase",letterSpacing:"0.4px",padding:"5px 8px",textAlign:h==="Item"?"left":"right",fontFamily:FONT.sans,borderBottom:`0.5px solid ${C.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {meal.items?.map(item=>{
                        const recipe=userRecipes.find(r=>r.name===item.recipe_name);
                        return (
                          <tr key={item.id} style={{ borderBottom:`0.5px solid ${C.border}` }}>
                            <td style={{ padding:"7px 8px",fontSize:"12px",color:item.is_exercise?C.blueText:C.text }}>
                              {recipe
                                ? <span onClick={()=>setRecipeModal(recipe)} style={{ color:C.blue,cursor:"pointer",borderBottom:`1px dashed ${C.blueMid}` }}>{item.name}</span>
                                : item.name}
                            </td>
                            {[item.kcal,item.fat,item.carbs,item.sugar,item.fibre,item.net_carbs,item.protein].map((v,i)=>(
                              <td key={i} style={{ padding:"7px 8px",textAlign:"right",fontSize:"11px",color:item.is_exercise?C.blueText:C.muted,fontFamily:FONT.mono }}>{fmt(v||0)}{i>0?"g":""}</td>
                            ))}
                            <td style={{ textAlign:"center",padding:"7px 4px" }}>
                              <button onClick={()=>{ if(confirm("Remove this item?")) deleteItem(meal.id,item.id); }}
                                style={{ background:"none",border:"none",cursor:"pointer",padding:"2px",color:C.hint,display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"3px" }}
                                onMouseEnter={e=>e.currentTarget.style.color=C.danger} onMouseLeave={e=>e.currentTarget.style.color=C.hint}>
                                <IconX size={11}/>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {/* Subtotal */}
                      <tr style={{ background:C.bg }}>
                        <td style={{ padding:"5px 8px",fontSize:"11px",color:C.muted,fontFamily:FONT.sans }}>subtotal</td>
                        {[mKcal,meal.items?.reduce((s,it)=>s+(it.fat||0),0),meal.items?.reduce((s,it)=>s+(it.carbs||0),0),meal.items?.reduce((s,it)=>s+(it.sugar||0),0),meal.items?.reduce((s,it)=>s+(it.fibre||0),0),meal.items?.reduce((s,it)=>s+(it.net_carbs||0),0),meal.items?.reduce((s,it)=>s+(it.protein||0),0)].map((v,i)=>(
                          <td key={i} style={{ padding:"5px 8px",textAlign:"right",fontSize:"11px",fontWeight:"500",color:C.text,fontFamily:FONT.mono }}>{fmt(v||0)}{i>0?"g":""}</td>
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
