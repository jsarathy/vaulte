// src/components/RecipeModal.jsx
import { C, FONT, border } from "../constants/design";

export default function RecipeModal({ recipe, onClose }) {
  if (!recipe) return null;
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:FONT.sans }}>
      <div style={{ background:"#fff", borderRadius:"10px", width:"580px", maxWidth:"95vw", maxHeight:"88vh", overflowY:"auto", border:`0.5px solid ${C.border}` }}>
        {/* Header */}
        <div style={{ padding:"14px 18px", borderBottom:border, display:"flex", justifyContent:"space-between", alignItems:"flex-start", position:"sticky", top:0, background:"#fff", zIndex:1, borderRadius:"10px 10px 0 0" }}>
          <div>
            <div style={{ fontSize:"14px", fontWeight:"500", color:C.text }}>{recipe.name}</div>
            {recipe.source&&<div style={{ fontSize:"11px", color:C.muted, marginTop:"2px" }}>{recipe.source}</div>}
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:"18px", lineHeight:1, marginLeft:"12px" }}>×</button>
        </div>

        <div style={{ padding:"16px 18px" }}>
          {recipe.description&&<p style={{ color:C.muted, fontSize:"12px", marginBottom:"12px", lineHeight:1.6 }}>{recipe.description}</p>}

          {/* Tags */}
          {(recipe.prep_time||recipe.cook_time||recipe.servings)&&(
            <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"12px" }}>
              {recipe.prep_time&&<span style={{ background:C.bg, border:`0.5px solid ${C.border}`, color:C.muted, borderRadius:"20px", padding:"3px 10px", fontSize:"11px" }}>Prep {recipe.prep_time}</span>}
              {recipe.cook_time&&<span style={{ background:C.bg, border:`0.5px solid ${C.border}`, color:C.muted, borderRadius:"20px", padding:"3px 10px", fontSize:"11px" }}>Cook {recipe.cook_time}</span>}
              {recipe.servings&&<span style={{ background:C.bg, border:`0.5px solid ${C.border}`, color:C.muted, borderRadius:"20px", padding:"3px 10px", fontSize:"11px" }}>Serves {recipe.servings}</span>}
            </div>
          )}

          {/* Nutrition */}
          {recipe.nutrition&&(
            <>
              <Sect>Nutrition per serving</Sect>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(6,minmax(0,1fr))", gap:"5px", marginBottom:"14px" }}>
                {[["kcal","kcal"],["fat","Fat g"],["carbs","Carbs g"],["fibre","Fibre g"],["net_carbs","Net C g"],["protein","Prot g"]].map(([k,l])=>(
                  <div key={k} style={{ textAlign:"center", background:C.bg, borderRadius:"5px", padding:"7px 4px", border:`0.5px solid ${C.border}` }}>
                    <div style={{ fontFamily:FONT.mono, fontWeight:"500", color:C.text, fontSize:"14px" }}>{recipe.nutrition[k]||0}</div>
                    <div style={{ fontSize:"9px", color:C.hint, marginTop:"2px", textTransform:"uppercase", letterSpacing:"0.3px" }}>{l}</div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Ingredients */}
          <Sect>Ingredients</Sect>
          <div style={{ marginBottom:"14px" }}>
            {recipe.ingredients?.map((ing,i)=>(
              <div key={i} style={{ padding:"6px 0", borderBottom:`0.5px solid ${C.border}`, display:"flex", gap:"12px", fontSize:"12px" }}>
                <span style={{ fontWeight:"500", color:C.blueText, minWidth:"65px", fontFamily:FONT.mono }}>{ing.amount}</span>
                <span style={{ color:C.text }}>{ing.item}</span>
              </div>
            ))}
          </div>

          {/* Method */}
          <Sect>Method</Sect>
          <div style={{ marginBottom:recipe.notes?"14px":"0" }}>
            {recipe.steps?.map((s,i)=>(
              <div key={i} style={{ padding:"7px 0 7px 32px", borderBottom:`0.5px solid ${C.border}`, fontSize:"12px", lineHeight:1.6, position:"relative", color:C.text }}>
                <span style={{ position:"absolute", left:0, top:7, background:C.blue, color:"#fff", width:"20px", height:"20px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"9px", fontWeight:"500" }}>{i+1}</span>
                {s}
              </div>
            ))}
          </div>

          {recipe.notes&&(
            <div style={{ background:C.amberBg, borderLeft:`2px solid ${C.amberText}`, padding:"9px 12px", borderRadius:"0 4px 4px 0", fontSize:"12px", lineHeight:1.5, color:C.amberText, marginTop:"14px" }}>
              {recipe.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Sect({ children }) {
  return <div style={{ fontSize:"10px", fontWeight:"500", textTransform:"uppercase", letterSpacing:"0.5px", color:C.hint, margin:"14px 0 7px", paddingBottom:"5px", borderBottom:`0.5px solid ${C.border}` }}>{children}</div>;
}
