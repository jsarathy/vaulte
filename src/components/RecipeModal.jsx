// src/components/RecipeModal.jsx
export default function RecipeModal({ recipe, onClose }) {
  if (!recipe) return null;
  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:"10px", width:"600px", maxWidth:"95vw", maxHeight:"88vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.3)" }}>
        <div style={{ background:"#1F4E79", color:"#fff", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", position:"sticky", top:0, zIndex:1, borderRadius:"10px 10px 0 0" }}>
          <div>
            <div style={{ fontSize:"17px", fontWeight:"bold" }}>{recipe.name}</div>
            <div style={{ fontSize:"12px", opacity:0.7, marginTop:"3px" }}>{recipe.source}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#fff", fontSize:"24px", cursor:"pointer", lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:"18px 20px" }}>
          <p style={{ color:"#6B8CAE", fontSize:"13px", marginBottom:"10px", lineHeight:1.5 }}>{recipe.description}</p>
          <div style={{ display:"flex", gap:"7px", flexWrap:"wrap", marginBottom:"10px" }}>
            {recipe.prep_time && <span style={{ background:"#D6E4F0", color:"#1F4E79", borderRadius:"20px", padding:"3px 11px", fontSize:"12px", fontWeight:"bold" }}>⏱ Prep: {recipe.prep_time}</span>}
            {recipe.cook_time && <span style={{ background:"#D6E4F0", color:"#1F4E79", borderRadius:"20px", padding:"3px 11px", fontSize:"12px", fontWeight:"bold" }}>🍳 Cook: {recipe.cook_time}</span>}
            {recipe.servings  && <span style={{ background:"#D6E4F0", color:"#1F4E79", borderRadius:"20px", padding:"3px 11px", fontSize:"12px", fontWeight:"bold" }}>🍽 Serves: {recipe.servings}</span>}
          </div>
          {recipe.nutrition && (
            <>
              <SectionHead>Nutrition per Serving</SectionHead>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:"5px", marginBottom:"14px" }}>
                {[["kcal","kcal"],["fat","Fat g"],["carbs","Carbs g"],["fibre","Fibre g"],["net_carbs","Net C g"],["protein","Prot g"]].map(([k,l]) => (
                  <div key={k} style={{ textAlign:"center", background:"#D6E4F0", borderRadius:"5px", padding:"5px" }}>
                    <div style={{ fontWeight:"bold", color:"#1F4E79", fontSize:"14px" }}>{recipe.nutrition[k]||0}</div>
                    <div style={{ fontSize:"10px", color:"#6B8CAE" }}>{l}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <SectionHead>Ingredients</SectionHead>
          <ul style={{ listStyle:"none", padding:0 }}>
            {recipe.ingredients?.map((ing, i) => (
              <li key={i} style={{ padding:"4px 0", borderBottom:"1px solid #DDEAF6", display:"flex", gap:"10px", fontSize:"13px" }}>
                <span style={{ fontWeight:"bold", color:"#1F4E79", minWidth:"65px" }}>{ing.amount}</span>
                <span>{ing.item}</span>
              </li>
            ))}
          </ul>
          <SectionHead>Method</SectionHead>
          <ol style={{ paddingLeft:0, listStyle:"none", counterReset:"steps" }}>
            {recipe.steps?.map((s, i) => (
              <li key={i} style={{ counterIncrement:"steps", padding:"6px 0 6px 34px", borderBottom:"1px solid #DDEAF6", fontSize:"13px", lineHeight:1.5, position:"relative" }}>
                <span style={{ position:"absolute", left:0, top:6, background:"#2E75B6", color:"#fff", width:"20px", height:"20px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"10px", fontWeight:"bold" }}>{i+1}</span>
                {s}
              </li>
            ))}
          </ol>
          {recipe.notes && (
            <div style={{ background:"#FFF8E1", borderLeft:"3px solid #F57F17", padding:"9px 12px", borderRadius:"0 4px 4px 0", fontSize:"13px", lineHeight:1.5, color:"#5D4037", marginTop:"14px" }}>
              {recipe.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHead({ children }) {
  return (
    <div style={{ fontWeight:"bold", color:"#2E75B6", fontSize:"12px", textTransform:"uppercase", letterSpacing:"0.5px", margin:"14px 0 7px" }}>
      {children}
    </div>
  );
}
