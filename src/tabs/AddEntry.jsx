// src/tabs/AddEntry.jsx
import { useState, useRef } from "react";
import { genId, makeMeals, DEFAULT_MEAL_SLOTS, ensureMealSlots } from "../constants/helpers";
import { EXERCISE_COMPENDIUM } from "../constants/exercises";
import { loadDay, saveRecipe, deleteRecipe } from "../api/firestore";
import { claudeCreateRecipe } from "../api/claude";
import { normaliseImage, fileToBase64, fileToPreviewURL } from "../utils/imageUtils";
import { C, FONT } from "../constants/design.jsx";
import { db } from "../firebase";
import { doc, setDoc, getDocs, collection, orderBy, query } from "firebase/firestore";

// Local style shorthand
const S = {
  main: { flex:1, overflowY:"auto", padding:"14px 16px", background:"#f9fafb" },
  btn: (variant) => ({
    primary: { background:C.blue, color:"#fff", border:"none", borderRadius:"5px", padding:"7px 13px", cursor:"pointer", fontSize:"12px", fontWeight:"500", fontFamily:FONT.sans },
    success: { background:"#3B6D11", color:"#fff", border:"none", borderRadius:"5px", padding:"7px 13px", cursor:"pointer", fontSize:"12px", fontWeight:"500", fontFamily:FONT.sans },
    outline: { background:"transparent", color:C.blueText, border:`0.5px solid ${C.blue}`, borderRadius:"5px", padding:"7px 13px", cursor:"pointer", fontSize:"12px", fontFamily:FONT.sans },
    sm: { padding:"4px 9px", fontSize:"11px" },
  }[variant] || {}),
};

export default function AddEntry({
  userId,
  allDays, currentDate, currentDayData, setCurrentDayData,
  userRecipes, setUserRecipes,
  addDate, setAddDate,
  addMealId, setAddMealId,
  addMealName, setAddMealName,
  addItem, setAddItem,
  addMsg, setAddMsg,
  polarConnected, polarSessions, setPolarSessions,
  polarSyncing, polarLastSync, polarSyncMsg,
  syncPolar, setPolarLogModal,
  persistDay,
  setRecipeModal,
}) {
  const [exSearch, setExSearch] = useState("");
  const [exSelected, setExSelected] = useState(null);
  const [exDuration, setExDuration] = useState("30");
  const [exHRavg, setExHRavg] = useState("");
  const [exHRmax, setExHRmax] = useState("");
  const [exResult, setExResult] = useState(null);
  const [exMsg, setExMsg] = useState(null);
  const [showExModal, setShowExModal] = useState(false);
  const [exMealId, setExMealId] = useState("");
  const [showBrowseModal, setShowBrowseModal] = useState(false);
  const [browseAll, setBrowseAll] = useState([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseSearch, setBrowseSearch] = useState("");
  const [showRecipesModal, setShowRecipesModal] = useState(false);
  const [recipeBuilder, setRecipeBuilder] = useState(false);
  const [builderInput, setBuilderInput] = useState("");
  const [builderLoading, setBuilderLoading] = useState(false);
  const [builderPreview, setBuilderPreview] = useState(null);
  const [builderError, setBuilderError] = useState("");
  // Unified quantity modal — replaces old ingredientModal
  const [qtyModal, setQtyModal] = useState(null); // { name, defaultUnit }
  const [qtyValue, setQtyValue] = useState("1");
  const [qtyUnit, setQtyUnit] = useState("portion");
  const [qtyLoading, setQtyLoading] = useState(false);
  const [qtyError, setQtyError] = useState("");
  // Recipe portion modal — lets user scale macros before adding a saved recipe
  const [recipePortionModal, setRecipePortionModal] = useState(null); // { recipe }
  const [recipePortionQty, setRecipePortionQty] = useState("1");
  const [recipePortionUnit, setRecipePortionUnit] = useState("portion");
  const [recipePortionScaled, setRecipePortionScaled] = useState(null);
  const [recipePortionLoading, setRecipePortionLoading] = useState(false);
  const [recipePortionError, setRecipePortionError] = useState("");

  const [nameDropdown, setNameDropdown] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const nameInputRef = useRef(null);
  const qtyInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoItems, setPhotoItems] = useState([]);
  const [photoError, setPhotoError] = useState("");

  const handlePhotoLog = async (e) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setPhotoLoading(true); setPhotoError(""); setPhotoItems([]);
    // Show immediate preview from original file while processing
    const previewURL = fileToPreviewURL(raw);
    setPhotoPreview(previewURL);
    try {
      const file = await normaliseImage(raw);
      const b64  = await fileToBase64(file);
      // Update preview to compressed version
      URL.revokeObjectURL(previewURL);
      setPhotoPreview(fileToPreviewURL(file));
      const res = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: b64 } },
              { type: "text", text: `Identify every food item visible in this photo and estimate realistic nutrition values.
Reply with ONLY a JSON array, no markdown, no explanation:
[{"name":"...","kcal":0,"fat":0,"sat_fat":0,"carbs":0,"sugar":0,"fibre":0,"net_carbs":0,"protein":0}]
Be specific with names (e.g. "Grilled chicken breast ~150g"). Round to 1 decimal place.` }
            ]
          }]
        })
      });
      const data = await res.json();
      let raw2 = (data.content?.[0]?.text || "[]").trim();
      if (raw2.startsWith("```")) raw2 = raw2.split("```")[1]?.replace(/^json/,"").trim() || raw2;
      const items = JSON.parse(raw2);
      setPhotoItems(items);
    } catch(err) {
      setPhotoError("Could not analyse photo. Try a clearer image or add items manually.");
    } finally {
      setPhotoLoading(false);
      e.target.value = "";
    }
  };

  const submitAddItem = async () => {
    if (!addItem.name) { setAddMsg({ ok:false, text:"Please enter a food name" }); return; }
    const hasNutrition = addItem.kcal || addItem.fat || addItem.carbs || addItem.protein;
    if (!hasNutrition) {
      // Open qty modal (user can switch to recipe builder from there if needed)
      setQtyValue("1"); setQtyUnit("portion"); setQtyError("");
      setQtyModal({ name: addItem.name, autoSubmit: true });
      setTimeout(() => qtyInputRef.current?.focus(), 50);
      return;
    }
    await doSubmit(addItem);
  };

  const doSubmit = async (item) => {
    let day = allDays.find(d=>d.date===addDate) || await loadDay(userId, addDate);
    if (!day) { day = { date:addDate, notes:"", meals:makeMeals() }; }
    let targetMealId = addMealId;
    if (targetMealId?.startsWith("__slot__")) {
      const match = day.meals.find(m=>m.name===targetMealId.replace("__slot__",""));
      targetMealId = match?.id || null;
    }
    if (!targetMealId && addMealName) {
      const newMeal = { id:genId(), name:addMealName, is_exercise:0, items:[] };
      day = { ...day, meals:[...day.meals, newMeal] };
      targetMealId = newMeal.id;
    }
    if (!targetMealId) { setAddMsg({ ok:false, text:"Please select or create a meal" }); return; }
    const newItem = { id:genId(), name:item.name,
      kcal:parseFloat(item.kcal)||0, fat:parseFloat(item.fat)||0, sat_fat:parseFloat(item.sat_fat)||0,
      carbs:parseFloat(item.carbs)||0, sugar:parseFloat(item.sugar)||0, fibre:parseFloat(item.fibre)||0,
      net_carbs:parseFloat(item.net_carbs)||0, protein:parseFloat(item.protein)||0 };
    const updated = { ...day, meals: day.meals.map(m=>m.id===targetMealId?{...m,items:[...(m.items||[]),newItem]}:m) };
    await persistDay(updated);
    if (addDate===currentDate) setCurrentDayData(updated);
    setAddMsg({ ok:true, text:"✅ Item added!" });
    setAddItem({ name:"", kcal:"", fat:"", sat_fat:"", carbs:"", sugar:"", fibre:"", net_carbs:"", protein:"" });
    setTimeout(()=>setAddMsg(null),3000);
  };

  return (
    <div style={{ ...S.main, display:"flex", gap:"14px", alignItems:"flex-start" }}>

      {/* ── LEFT: Food (65%) ── */}
      <div style={{ flex:"0 0 65%", minWidth:0 }}>
        <div style={{ fontSize:"16px", fontWeight:"bold", color:"#185FA5", marginBottom:"12px" }}>🥗 Add Food Entry</div>
        <div style={{ background:"#fff", borderRadius:"8px", border:"0.5px solid #e5e7eb", padding:"14px", marginBottom:"12px" }}>
          <div style={{ fontWeight:"bold", color:"#185FA5", marginBottom:"10px", fontSize:"13px" }}>Add Food Item</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"10px" }}>
            <div>
              <div style={{ fontSize:"10px", color:"#6b7280", textTransform:"uppercase", marginBottom:"2px" }}>Day</div>
              <input type="date" value={addDate} onChange={e=>setAddDate(e.target.value)}
                style={{ width:"100%", padding:"5px 7px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"12px" }}/>
            </div>
            <div>
              <div style={{ fontSize:"10px", color:"#6b7280", textTransform:"uppercase", marginBottom:"2px" }}>Meal</div>
              <select value={addMealId} onChange={e=>setAddMealId(e.target.value)}
                style={{ width:"100%", padding:"5px 7px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"12px" }}>
                <option value="">— select —</option>
                {(()=>{
                  const existing = allDays.find(d=>d.date===addDate);
                  const meals = existing ? existing.meals : DEFAULT_MEAL_SLOTS;
                  return meals.map((m,i)=><option key={m.id||i} value={m.id||("__slot__"+m.name)}>{m.name}</option>);
                })()}
              </select>
            </div>
          </div>

          {/* Food name with autocomplete */}
          <div style={{ marginBottom:"10px", position:"relative" }}>
            <div style={{ fontSize:"10px", color:"#6b7280", textTransform:"uppercase", marginBottom:"2px" }}>Food Item Name</div>
            <input
              ref={nameInputRef}
              value={addItem.name}
              onChange={e => {
                const val = e.target.value;
                setAddItem({...addItem, name:val});
                if (val.length > 1) {
                  const q = val.toLowerCase();
                  const matches = userRecipes.filter(r=>r.name.toLowerCase().includes(q));
                  setNameDropdown(matches);
                  setShowDropdown(matches.length > 0);
                } else setShowDropdown(false);
              }}
              onBlur={async () => {
                setTimeout(async () => {
                  setShowDropdown(false);
                  if (qtyModal) return; // already open, skip
                  const name = addItem.name.trim();
                  if (!name) return;
                  // If already has nutrition (filled from recipe dropdown), skip
                  const hasNutrition = addItem.kcal || addItem.fat || addItem.carbs || addItem.protein;
                  if (hasNutrition) return;
                  // Classify: ingredient → qty modal (grams), dish → recipe builder
                  try {
                    const res = await fetch("/api/claude", {
                      method:"POST", headers:{"Content-Type":"application/json"},
                      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:10,
                        messages:[{role:"user", content:`Is "${name}" a single whole-food ingredient (apple, milk, chicken breast) or a cooked/prepared dish (stew, curry, pasta)? Reply with exactly one word: INGREDIENT or DISH`}] })
                    });
                    const data = await res.json();
                    const verdict = (data.content?.[0]?.text||"DISH").trim().toUpperCase();
                    if (verdict.includes("INGREDIENT")) {
                      setQtyValue("100"); setQtyUnit("g"); setQtyError("");
                      setQtyModal({ name });
                      setTimeout(() => qtyInputRef.current?.focus(), 50);
                    } else {
                      setBuilderInput(name); setBuilderPreview(null); setBuilderError(""); setRecipeBuilder(true);
                    }
                  } catch {
                    // On error, fall back to recipe builder for dishes
                    setBuilderInput(name); setBuilderPreview(null); setBuilderError(""); setRecipeBuilder(true);
                  }
                }, 150);
              }}
              onKeyDown={e => {
                if (e.key !== "Enter") return;
                const name = addItem.name.trim();
                if (!name) return;
                // Exact or best match in saved recipes → open portion modal
                const q = name.toLowerCase();
                const exact = userRecipes.find(r => r.name.toLowerCase() === q)
                           || userRecipes.find(r => r.name.toLowerCase().includes(q));
                if (exact) {
                  e.preventDefault();
                  setShowDropdown(false);
                  setRecipePortionModal({ recipe: exact });
                  setRecipePortionQty("1");
                  setRecipePortionUnit("portion");
                  setRecipePortionScaled(null);
                  setRecipePortionError("");
                }
                // If no match, let onBlur handle ingredient/dish classification as before
              }}
              onFocus={() => { if (nameDropdown.length>0) setShowDropdown(true); }}
              placeholder="e.g. Pinto bean stew (1 portion)"
              style={{ width:"100%", padding:"5px 9px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"12px" }}
            />
            {showDropdown && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:"0.5px solid #e5e7eb", borderRadius:"0 0 6px 6px", boxShadow:"0 4px 12px rgba(0,0,0,0.1)", zIndex:100, maxHeight:"180px", overflowY:"auto" }}>
                {nameDropdown.map(r => (
                  <div key={r.id}
                    onMouseDown={() => {
                      setShowDropdown(false);
                      setRecipePortionModal({ recipe: r });
                      setRecipePortionQty("1");
                      setRecipePortionUnit("portion");
                      setRecipePortionScaled(null);
                      setRecipePortionError("");
                    }}
                    style={{ padding:"8px 12px", cursor:"pointer", borderBottom:"1px solid #F0F4F8", fontSize:"12px" }}
                    onMouseOver={e=>e.currentTarget.style.background="#F0F4F8"}
                    onMouseOut={e=>e.currentTarget.style.background="#fff"}>
                    <div style={{ fontWeight:"bold", color:"#185FA5" }}>{r.name}</div>
                    <div style={{ fontSize:"11px", color:"#6b7280" }}>{r.nutrition?.kcal} kcal · P:{r.nutrition?.protein}g F:{r.nutrition?.fat}g C:{r.nutrition?.carbs}g · tap to set portions</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Macro inputs */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))", gap:"8px", marginBottom:"10px" }}>
            {[["kcal","kcal"],["fat","Fat (g)"],["sat_fat","Sat Fat (g)"],["carbs","Carbs (g)"],["sugar","Sugar (g)"],["fibre","Fibre (g)"],["net_carbs","Net Carbs (g)"],["protein","Protein (g)"]].map(([key,label]) => (
              <div key={key}>
                <div style={{ fontSize:"10px", color:"#6b7280", textTransform:"uppercase", marginBottom:"2px" }}>{label}</div>
                <input type="number" value={addItem[key]}
                  onChange={e => {
                    const updated = {...addItem, [key]:e.target.value};
                    if (key==="carbs"||key==="fibre") {
                      const c = key==="carbs"?parseFloat(e.target.value)||0:parseFloat(addItem.carbs)||0;
                      const f = key==="fibre"?parseFloat(e.target.value)||0:parseFloat(addItem.fibre)||0;
                      updated.net_carbs = Math.max(0,c-f).toFixed(1);
                    }
                    setAddItem(updated);
                  }}
                  placeholder="0" step="0.1"
                  style={{ width:"100%", padding:"5px 7px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"12px", background:key==="net_carbs"?"#F0F4F8":"#fff" }}/>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end", alignItems:"center" }}>
            <button onClick={()=>setAddItem({name:"",kcal:"",fat:"",sat_fat:"",carbs:"",sugar:"",fibre:"",net_carbs:"",protein:""})}
              style={{ ...S.btn("outline"), ...S.btn("sm") }}>✕ Clear</button>
            <button onClick={submitAddItem} style={S.btn("success")}>Add Item</button>
          </div>
          {addMsg && <div style={{ marginTop:"8px", padding:"7px 10px", borderRadius:"4px", fontSize:"12px", background:addMsg.ok?"#E8F5E9":"#FFEBEE", color:addMsg.ok?"#2E7D32":"#c62828" }}>{addMsg.text}</div>}
        </div>

        {/* Photo Log */}
        <div style={{ background:"#fff", borderRadius:"8px", border:"0.5px solid #e5e7eb", padding:"14px", marginBottom:"12px" }}>
          <div style={{ fontWeight:"bold", color:"#185FA5", marginBottom:"10px", fontSize:"13px" }}>📸 Log from Photo</div>
          <input ref={photoInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handlePhotoLog}/>
          <button onClick={()=>photoInputRef.current?.click()} disabled={photoLoading}
            style={{ width:"100%", background:photoLoading?"#ccc":"#378ADD", color:"#fff", border:"none", borderRadius:"6px",
              padding:"9px", fontSize:"13px", fontWeight:"bold", cursor:photoLoading?"not-allowed":"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
            {photoLoading ? "⏳ Analysing…" : "📷 Take / Choose Photo"}
          </button>
          {photoError && <div style={{ marginTop:"8px", color:"#c62828", fontSize:"12px" }}>{photoError}</div>}
          {photoPreview && photoItems.length > 0 && (
            <div style={{ marginTop:"12px" }}>
              <img src={photoPreview} alt="food" style={{ width:"100%", maxHeight:"160px", objectFit:"cover", borderRadius:"6px", marginBottom:"10px" }}/>
              <div style={{ fontSize:"11px", color:"#6b7280", marginBottom:"6px" }}>Claude identified {photoItems.length} item{photoItems.length!==1?"s":""}. Tap to load into the form above, or log all at once.</div>
              {photoItems.map((item, i) => (
                <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"6px 8px", borderBottom:"1px solid #F0F4F8", fontSize:"12px" }}>
                  <div>
                    <div style={{ fontWeight:"bold", color:"#185FA5" }}>{item.name}</div>
                    <div style={{ fontSize:"10px", color:"#6b7280" }}>{item.kcal} kcal · P:{item.protein}g F:{item.fat}g C:{item.carbs}g</div>
                  </div>
                  <button onClick={()=>setAddItem({ name:item.name, kcal:item.kcal, fat:item.fat,
                    sat_fat:item.sat_fat, carbs:item.carbs, sugar:item.sugar, fibre:item.fibre,
                    net_carbs:item.net_carbs, protein:item.protein })}
                    style={{ background:"#E6F1FB", border:"none", color:"#185FA5", borderRadius:"4px",
                      padding:"3px 8px", fontSize:"11px", cursor:"pointer", whiteSpace:"nowrap" }}>
                    ↑ Load
                  </button>
                </div>
              ))}
              <button onClick={async () => {
                let day = allDays.find(d=>d.date===addDate) || await loadDay(userId, addDate);
                if (!day) day = { date:addDate, notes:"", meals:makeMeals() };
                let targetMealId = addMealId;
                if (targetMealId?.startsWith("__slot__")) {
                  const match = day.meals.find(m=>m.name===targetMealId.replace("__slot__",""));
                  targetMealId = match?.id || null;
                }
                if (!targetMealId) { setAddMsg({ok:false,text:"Select a meal slot first"}); return; }
                const newItems = photoItems.map(i=>({...i, id:genId()}));
                const updated = {...day, meals:day.meals.map(m=>m.id===targetMealId?{...m,items:[...(m.items||[]),...newItems]}:m)};
                await persistDay(updated);
                if (addDate===currentDate) setCurrentDayData(updated);
                setPhotoItems([]); setPhotoPreview(null);
                setAddMsg({ok:true, text:`✅ ${newItems.length} items logged from photo!`});
                setTimeout(()=>setAddMsg(null),3000);
              }} style={{ marginTop:"10px", width:"100%", background:"#2E7D32", color:"#fff", border:"none",
                borderRadius:"6px", padding:"8px", fontSize:"13px", fontWeight:"bold", cursor:"pointer" }}>
                ✓ Log All {photoItems.length} Items
              </button>
            </div>
          )}
        </div>

        {/* Recipe action buttons */}
        <div style={{ display:"flex", gap:"10px" }}>
          <button onClick={()=>setShowRecipesModal(true)}
            style={{ flex:1, background:"#378ADD", color:"#fff", border:"none", borderRadius:"8px", padding:"10px", fontSize:"13px", fontWeight:"bold", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
            📖 Browse Saved Recipes
          </button>
          <button onClick={()=>{ setRecipeBuilder(true); setBuilderPreview(null); setBuilderInput(""); setBuilderError(""); }}
            style={{ flex:1, background:"#185FA5", color:"#fff", border:"none", borderRadius:"8px", padding:"10px", fontSize:"13px", fontWeight:"bold", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
            🤖 Create with Claude
          </button>
        </div>
      </div>

      {/* ── RIGHT: Exercise (35%) ── */}
      <div style={{ flex:"0 0 35%", minWidth:0 }}>
        <div style={{ fontSize:"16px", fontWeight:"bold", color:"#185FA5", marginBottom:"12px" }}>🏋️ Exercise</div>
        <button onClick={()=>{ setShowExModal(true); setExSearch(""); setExSelected(null); setExResult(null); setExMsg(null); }}
          style={{ width:"100%", background:"#378ADD", color:"#fff", border:"none", borderRadius:"8px", padding:"10px", fontSize:"13px", fontWeight:"bold", cursor:"pointer", marginBottom:"14px", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
          🏋️ Log Manual Exercise
        </button>

        {/* Polar Sessions panel */}
        <div style={{ background:"#fff", borderRadius:"8px", border:"0.5px solid #e5e7eb", overflow:"hidden" }}>
          <div style={{ background:"#185FA5", padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ color:"#fff", fontWeight:"bold", fontSize:"13px", display:"flex", alignItems:"center", gap:"6px" }}>
              <span style={{ fontSize:"16px" }}>📡</span> Polar Sessions
            </div>
            {polarConnected && (
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <div style={{ fontSize:"10px", color:"#90CAF9", display:"flex", alignItems:"center", gap:"4px" }}>
                  <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#4CAF50", display:"inline-block" }}/>
                  Connected
                </div>
                <button onClick={syncPolar} disabled={polarSyncing}
                  style={{ background:polarSyncing?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.3)", color:"#fff", borderRadius:"4px", padding:"2px 8px", fontSize:"10px", cursor:polarSyncing?"not-allowed":"pointer", fontWeight:"bold" }}>
                  {polarSyncing?"⏳ Syncing…":"🔄 Sync"}
                </button>
                <button onClick={async()=>{
                  console.log("Reconnect clicked, userId:", userId);
                  if (!userId) { alert("Not logged in — please refresh and try again."); return; }
                  if (!confirm("This will re-authorise your Polar account with updated permissions (needed for HR data). Continue?")) return;
                  const btn = document.getElementById("polar-reconnect-btn");
                  if (btn) btn.textContent = "Working…";
                  try {
                    const r = await fetch("/api/polar-disconnect", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({userId}) });
                    const d = await r.json();
                    console.log("Disconnect result:", d);
                  } catch(e) { console.warn("Disconnect failed, continuing:", e); }
                  window.location.href=`/api/polar-auth?userId=${userId}`;
                }}
                  id="polar-reconnect-btn"
                  title="Re-authorise with updated permissions for HR data"
                  style={{ background:"transparent", border:"1px solid rgba(255,255,255,0.2)", color:"rgba(255,255,255,0.6)", borderRadius:"4px", padding:"2px 8px", fontSize:"10px", cursor:"pointer" }}>
                  Reconnect
                </button>
              </div>
            )}
          </div>
          {polarSyncMsg && (
            <div style={{ padding:"7px 12px", fontSize:"11px", fontWeight:"bold", background:polarSyncMsg.ok?"#E8F5E9":"#FFEBEE", color:polarSyncMsg.ok?"#2E7D32":"#c62828", borderBottom:"0.5px solid #e5e7eb" }}>
              {polarSyncMsg.text}
            </div>
          )}
          <div style={{ padding:"12px" }}>
            {!polarConnected ? (
              <div style={{ textAlign:"center", padding:"16px 8px" }}>
                <div style={{ fontSize:"32px", marginBottom:"8px" }}>⌚</div>
                <div style={{ fontSize:"13px", fontWeight:"bold", color:"#185FA5", marginBottom:"6px" }}>Connect your Polar device</div>
                <div style={{ fontSize:"11px", color:"#6b7280", marginBottom:"14px", lineHeight:1.5 }}>
                  Authorise Vaulte to read your training sessions from Polar Flow. After connecting, use Sync to pull sessions.
                </div>
                <button onClick={()=>{
                  if (!userId) { alert("Not logged in — please refresh and try again."); return; }
                  window.location.href=`/api/polar-auth?userId=${userId}`;
                }}
                  style={{ background:"#D94032", color:"#fff", border:"none", borderRadius:"6px", padding:"9px 18px", cursor:"pointer", fontSize:"12px", fontWeight:"bold" }}>
                  Connect Polar Account
                </button>
              </div>
            ) : polarSessions.length===0 ? (
              <div style={{ color:"#6b7280" }}>
                {/* Header */}
                <div style={{ textAlign:"center", padding:"12px 8px 8px" }}>
                  <div style={{ fontSize:"28px", marginBottom:"4px" }}>✅</div>
                  <div style={{ fontSize:"12px", marginBottom:"4px" }}>All sessions logged.</div>
                  {polarLastSync && (
                    <div style={{ fontSize:"10px", color:"#A0B4C8", marginBottom:"8px" }}>
                      Last sync: {new Date(polarLastSync).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
                    </div>
                  )}
                  <div style={{ fontSize:"11px", marginBottom:"10px" }}>Sync your H10 to Polar Flow, then click 🔄 Sync above.</div>
                  <button onClick={async()=>{
                    setShowBrowseModal(true); setBrowseSearch(""); setBrowseLoading(true);
                    try {
                      const q = query(collection(db,"users",userId,"polar_sessions"), orderBy("start_time","desc"));
                      const snap = await getDocs(q);
                      setBrowseAll(snap.docs.map(d=>({id:d.id,...d.data()})));
                    } catch(e) { console.error(e); }
                    finally { setBrowseLoading(false); }
                  }} style={{ background:C.blueBg, color:C.blueText, border:`0.5px solid ${C.blueMid}`, borderRadius:"6px", padding:"6px 14px", fontSize:"11px", fontWeight:"500", cursor:"pointer", fontFamily:FONT.sans }}>
                    Browse all sessions
                  </button>
                </div>
                {/* Last 10 logged sessions inline */}
                {(() => {
                  if (browseLoading) return null;
                  // Eagerly load last 10 if not already loaded
                  const recent = browseAll.length > 0
                    ? browseAll.filter(s=>s.logged).slice(0,10)
                    : null;
                  if (!recent) return (
                    <div style={{ borderTop:`0.5px solid ${C.border}`,marginTop:"8px",paddingTop:"8px" }}>
                      <button onClick={async()=>{
                        setBrowseLoading(true);
                        try {
                          const q = query(collection(db,"users",userId,"polar_sessions"), orderBy("start_time","desc"));
                          const snap = await getDocs(q);
                          setBrowseAll(snap.docs.map(d=>({id:d.id,...d.data()})));
                        } catch(e) { console.error(e); }
                        finally { setBrowseLoading(false); }
                      }} style={{ width:"100%", background:"transparent", border:"none", color:C.hint, fontSize:"11px", cursor:"pointer", padding:"4px" }}>
                        Load recent sessions ↓
                      </button>
                    </div>
                  );
                  if (recent.length === 0) return null;
                  return (
                    <div style={{ borderTop:`0.5px solid ${C.border}`,marginTop:"8px" }}>
                      <div style={{ fontSize:"10px",color:C.hint,textTransform:"uppercase",letterSpacing:"0.4px",padding:"8px 12px 4px" }}>
                        Recent sessions
                      </div>
                      {recent.map(s => {
                        const sport = s.sport?s.sport.replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()):"Exercise";
                        const d = s.start_time?new Date(s.start_time):null;
                        const fatBurned = s.fat_pct!=null?Math.round(s.calories*s.fat_pct/100/9):null;
                        return (
                          <div key={s.id} onClick={()=>setPolarLogModal(s)}
                            style={{ padding:"8px 12px", borderBottom:`0.5px solid ${C.border}`, cursor:"pointer", fontSize:"11px" }}
                            onMouseEnter={e=>e.currentTarget.style.background=C.blueBg}
                            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"3px" }}>
                              <span style={{ fontWeight:"500", color:C.blueText, fontSize:"12px" }}>{sport}</span>
                              <span style={{ color:C.muted, fontFamily:FONT.mono, fontSize:"10px" }}>
                                {d?d.toLocaleDateString("en-GB",{day:"numeric",month:"short"}):""}
                              </span>
                            </div>
                            <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", color:C.muted }}>
                              <span>{Math.round(s.duration_min||0)} min</span>
                              <span>{s.calories} kcal</span>
                              {s.hr_avg&&<span>❤ {s.hr_avg} bpm</span>}
                              {fatBurned!=null&&<span>🧈 {fatBurned}g fat</span>}
                              {s.hr_samples&&<span style={{ color:C.greenText }}>HR ✓</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div>
                <div style={{ fontSize:"10px", color:"#6b7280", textTransform:"uppercase", marginBottom:"8px", display:"flex", justifyContent:"space-between" }}>
                  <span>{polarSessions.length} unlogged session{polarSessions.length>1?"s":""}</span>
                  {polarLastSync && <span>Synced {new Date(polarLastSync).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>}
                </div>
                {polarSessions.map(s => {
                  const sport = s.sport?s.sport.replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()):"Exercise";
                  const d = s.start_time?new Date(s.start_time):null;
                  return (
                    <div key={s.id} onClick={()=>setPolarLogModal(s)}
                      style={{ padding:"10px 12px", borderRadius:"6px", border:"0.5px solid #e5e7eb", marginBottom:"8px", cursor:"pointer", transition:"background 0.15s" }}
                      onMouseOver={e=>e.currentTarget.style.background="#F0F4F8"}
                      onMouseOut={e=>e.currentTarget.style.background="#fff"}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"4px" }}>
                        <div style={{ fontWeight:"bold", fontSize:"12px", color:"#185FA5" }}>{sport}</div>
                        <div style={{ fontSize:"10px", color:"#6b7280" }}>{d?d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}):""} {d?d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):""}</div>
                      </div>
                      <div style={{ display:"flex", gap:"10px", fontSize:"11px", color:"#378ADD", flexWrap:"wrap" }}>
                        <span>⏱ {Math.round(s.duration_min||0)} min</span>
                        <span>🔥 {s.calories} kcal</span>
                        {s.hr_avg&&<span>❤️ {s.hr_avg} bpm avg</span>}
                        {s.hr_max&&<span>↑{s.hr_max} max</span>}
                        {s.fat_pct!=null&&<span>🧈 {s.fat_pct}% fat</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Browse All Polar Sessions Modal ── */}
      {showBrowseModal && (
        <div onClick={e=>e.target===e.currentTarget&&setShowBrowseModal(false)}
          style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px" }}>
          <div style={{ background:"#fff",borderRadius:"10px",width:"580px",maxWidth:"100%",maxHeight:"88vh",display:"flex",flexDirection:"column",border:`0.5px solid ${C.border}`,fontFamily:FONT.sans }}>

            {/* Header */}
            <div style={{ padding:"14px 18px",borderBottom:`0.5px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
              <div style={{ fontSize:"13px",fontWeight:"500",color:C.text }}>All Polar sessions</div>
              <button onClick={()=>setShowBrowseModal(false)} style={{ background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:"18px",lineHeight:1 }}>×</button>
            </div>

            {/* Search bar */}
            <div style={{ padding:"10px 18px",borderBottom:`0.5px solid ${C.border}`,flexShrink:0 }}>
              <input
                type="text"
                value={browseSearch}
                onChange={e=>setBrowseSearch(e.target.value)}
                placeholder="Filter by date (e.g. 17 Mar, 2026-03) or activity (cycling, running…)"
                autoFocus
                style={{ width:"100%",padding:"7px 10px",border:`0.5px solid ${C.borderMid}`,borderRadius:"6px",fontSize:"12px",fontFamily:FONT.sans,outline:"none",boxSizing:"border-box" }}
              />
            </div>

            {/* Session list */}
            <div style={{ flex:1,overflowY:"auto",padding:"8px 18px" }}>
              {browseLoading && <div style={{ textAlign:"center",padding:"32px",color:C.muted,fontSize:"12px" }}>Loading sessions…</div>}
              {!browseLoading && (() => {
                const q = browseSearch.toLowerCase();
                const filtered = browseAll.filter(s => {
                  if (!q) return true;
                  const sport = (s.sport||"").replace(/_/g," ").toLowerCase();
                  const dateStr = s.start_time ? new Date(s.start_time).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}).toLowerCase() : "";
                  const isoDate = (s.start_time||"").slice(0,10);
                  return sport.includes(q) || dateStr.includes(q) || isoDate.includes(q);
                });
                if (filtered.length === 0) return <div style={{ textAlign:"center",padding:"32px",color:C.hint,fontSize:"12px" }}>No sessions match</div>;
                return filtered.map(s => {
                  const sport = s.sport ? s.sport.replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()) : "Exercise";
                  const d = s.start_time ? new Date(s.start_time) : null;
                  const dateStr = d ? d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"}) : (s.date||"");
                  const timeStr = d ? d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "";
                  const fatBurned = s.fat_pct != null ? Math.round(s.calories * s.fat_pct / 100 / 9) : null;
                  return (
                    <div key={s.id}
                      onClick={()=>{ setShowBrowseModal(false); setPolarLogModal(s); }}
                      style={{ padding:"10px 12px",borderRadius:"7px",border:`0.5px solid ${C.border}`,marginBottom:"7px",cursor:s.logged?"default":"pointer",
                        background:s.logged?"#fafafa":"#fff",opacity:s.logged?0.7:1,transition:"background 0.12s" }}
                      onMouseEnter={e=>{ if(!s.logged) e.currentTarget.style.background=C.blueBg; }}
                      onMouseLeave={e=>{ e.currentTarget.style.background=s.logged?"#fafafa":"#fff"; }}>
                      <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"5px" }}>
                        <div style={{ display:"flex",alignItems:"center",gap:"7px" }}>
                          <span style={{ fontSize:"12px",fontWeight:"500",color:s.logged?C.muted:C.blueText }}>{sport}</span>
                          {s.logged && <span style={{ fontSize:"9px",background:C.greenBg,color:C.greenText,borderRadius:"20px",padding:"1px 6px",fontWeight:"500" }}>logged</span>}
                        </div>
                        <span style={{ fontSize:"11px",color:C.muted,fontFamily:FONT.mono }}>{dateStr}{timeStr?` · ${timeStr}`:""}</span>
                      </div>
                      <div style={{ display:"flex",gap:"12px",flexWrap:"wrap" }}>
                        {[
                          ["Duration", `${Math.round(s.duration_min||0)} min`],
                          ["Calories",  `${s.calories} kcal`],
                          s.hr_avg ? ["Avg HR", `${s.hr_avg} bpm`] : null,
                          s.hr_max ? ["Max HR", `${s.hr_max} bpm`] : null,
                          fatBurned != null ? ["Fat burned", `${fatBurned}g`] : null,
                          s.hr_samples ? ["HR data", "✓"] : null,
                        ].filter(Boolean).map(([lbl,val])=>(
                          <div key={lbl} style={{ fontSize:"10px",color:C.muted }}>
                            <span style={{ color:C.hint }}>{lbl} </span>
                            <span style={{ fontFamily:FONT.mono,fontWeight:"500",color:lbl==="HR data"?C.greenText:C.text }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Footer */}
            {!browseLoading && (
              <div style={{ padding:"10px 18px",borderTop:`0.5px solid ${C.border}`,fontSize:"11px",color:C.hint,flexShrink:0,display:"flex",justifyContent:"space-between" }}>
                <span>{browseAll.length} total · {browseAll.filter(s=>s.logged).length} logged · {browseAll.filter(s=>!s.logged).length} pending</span>
                <span>Click any unlogged session to log it</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Quantity Modal ── */}
      {qtyModal && (
        <div onClick={e=>e.target===e.currentTarget&&setQtyModal(null)}
          style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <div style={{ background:"#fff",borderRadius:"12px",padding:"24px 28px",width:"380px",maxWidth:"95vw",border:`0.5px solid ${C.border}`,fontFamily:FONT.sans }}>
            <div style={{ fontSize:"14px",fontWeight:"500",color:C.text,marginBottom:"4px" }}>{qtyModal.name}</div>
            <div style={{ fontSize:"11px",color:C.muted,marginBottom:"20px" }}>How much? Claude will calculate the nutrition.</div>

            {/* Quantity + unit row */}
            <div style={{ display:"flex",gap:"8px",marginBottom:"16px",alignItems:"flex-end" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"10px",fontWeight:"500",textTransform:"uppercase",letterSpacing:"0.4px",color:C.hint,marginBottom:"4px" }}>Quantity</div>
                <input ref={qtyInputRef} type="number" min="0.1" step="0.1" value={qtyValue}
                  onChange={e=>setQtyValue(e.target.value)}
                  onKeyDown={e=>{ if(e.key==="Enter") document.getElementById("qty-confirm-btn").click(); }}
                  style={{ width:"100%",padding:"9px 10px",border:`1.5px solid ${C.blue}`,borderRadius:"6px",fontSize:"16px",fontFamily:FONT.mono,fontWeight:"500",outline:"none",textAlign:"center" }}/>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:"10px",fontWeight:"500",textTransform:"uppercase",letterSpacing:"0.4px",color:C.hint,marginBottom:"4px" }}>Unit</div>
                <select value={qtyUnit} onChange={e=>setQtyUnit(e.target.value)}
                  style={{ width:"100%",padding:"9px 8px",border:`0.5px solid ${C.borderMid}`,borderRadius:"6px",fontSize:"13px",fontFamily:FONT.sans,outline:"none",background:"#fff",height:"40px" }}>
                  <option value="portion">portion(s)</option>
                  <option value="g">grams (g)</option>
                  <option value="ml">millilitres (ml)</option>
                  <option value="oz">ounces (oz)</option>
                  <option value="cup">cup(s)</option>
                  <option value="tbsp">tablespoon(s)</option>
                  <option value="tsp">teaspoon(s)</option>
                </select>
              </div>
            </div>

            {qtyError && <div style={{ fontSize:"11px",color:C.danger,marginBottom:"10px" }}>{qtyError}</div>}
            {qtyLoading && <div style={{ fontSize:"11px",color:C.muted,marginBottom:"10px",textAlign:"center" }}>Looking up nutrition…</div>}

            <div style={{ display:"flex",gap:"8px",justifyContent:"flex-end" }}>
              <button onClick={()=>setQtyModal(null)}
                style={{ background:"transparent",border:`0.5px solid ${C.borderMid}`,color:C.muted,borderRadius:"6px",padding:"8px 16px",cursor:"pointer",fontSize:"12px",fontFamily:FONT.sans }}>
                Cancel
              </button>
              <button id="qty-confirm-btn" disabled={qtyLoading}
                onClick={async()=>{
                  const qty = parseFloat(qtyValue) || 1;
                  const unit = qtyUnit;
                  const name = qtyModal.name;
                  setQtyLoading(true); setQtyError("");
                  try {
                    const prompt = `Give me the nutrition for ${qty} ${unit === "portion" ? `portion${qty !== 1 ? "s" : ""}` : unit} of "${name}".
Reply with ONLY a JSON object, no markdown, no explanation:
{"display_name":"${name} (${qty} ${unit === "portion" ? "portion" : unit})","kcal":0,"fat":0,"sat_fat":0,"carbs":0,"sugar":0,"fibre":0,"net_carbs":0,"protein":0}
Use realistic values. For portions use a typical serving size.`;
                    const res = await fetch("/api/claude", {
                      method:"POST", headers:{"Content-Type":"application/json"},
                      body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:200,
                        messages:[{role:"user", content:prompt}] })
                    });
                    const data = await res.json();
                    const text = (data.content?.[0]?.text||"{}").replace(/```json|```/g,"").trim();
                    const n = JSON.parse(text);
                    const filledItem = {
                      name: n.display_name || `${name} (${qty} ${unit})`,
                      kcal: n.kcal ?? "", fat: n.fat ?? "", sat_fat: n.sat_fat ?? "",
                      carbs: n.carbs ?? "", sugar: n.sugar ?? "", fibre: n.fibre ?? "",
                      net_carbs: n.net_carbs ?? "", protein: n.protein ?? ""
                    };
                    const wasAutoSubmit = qtyModal.autoSubmit;
                    setAddItem(filledItem);
                    setQtyModal(null);
                    if (wasAutoSubmit) await doSubmit(filledItem);
                  } catch(e) {
                    setQtyError("Could not fetch nutrition — fill in manually or try again.");
                  } finally {
                    setQtyLoading(false);
                  }
                }}
                style={{ background:qtyLoading?C.hint:C.blue,color:"#fff",border:"none",borderRadius:"6px",padding:"8px 20px",cursor:qtyLoading?"not-allowed":"pointer",fontSize:"12px",fontWeight:"500",fontFamily:FONT.sans }}>
                {qtyLoading ? "…" : "Get Nutrition"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Recipe Builder Modal ── */}
      {recipeBuilder && (
        <div onClick={e=>e.target===e.currentTarget&&setRecipeBuilder(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:"10px", width:"640px", maxWidth:"95vw", maxHeight:"88vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.3)" }}>
            <div style={{ background:"#185FA5", color:"#fff", padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", borderRadius:"10px 10px 0 0" }}>
              <div style={{ fontSize:"15px", fontWeight:"bold" }}>🤖 Create Recipe with Claude</div>
              <button onClick={()=>{ setRecipeBuilder(false); setBuilderPreview(null); setBuilderInput(""); setBuilderError(""); }}
                style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>×</button>
            </div>
            <div style={{ padding:"18px" }}>
              {!builderPreview ? (
                <>
                  <p style={{ color:"#6b7280", fontSize:"13px", marginBottom:"12px", lineHeight:1.5 }}>
                    Describe your recipe — a full ingredient list, or just a dish name if you want Claude to look one up for you. Claude will generate the full recipe with nutrition per serving, which you can then edit before saving.
                  </p>
                  <textarea value={builderInput} onChange={e=>setBuilderInput(e.target.value)}
                    placeholder="e.g. Pinto bean stew — 606g cooked pinto beans, 102g onion, 6 green chillies, 3 tbsp sesame oil, 200g chopped tomatoes, salt and hing. Sauté onion and chillies, add tomatoes, add beans, simmer 15 min. Makes 4 portions of ~225g each."
                    style={{ width:"100%", minHeight:"120px", padding:"10px", border:"0.5px solid #e5e7eb", borderRadius:"6px", fontSize:"13px", fontFamily:"inherit", resize:"vertical", background:"#F0F4F8", boxSizing:"border-box" }}/>
                  {builderError && <div style={{ color:"#c62828", fontSize:"12px", marginTop:"6px" }}>{builderError}</div>}
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:"12px" }}>
                    <button disabled={builderLoading||!builderInput.trim()} onClick={async()=>{
                      setBuilderLoading(true); setBuilderError("");
                      try {
                        const recipe = await claudeCreateRecipe(builderInput);
                        recipe.id = genId();
                        setBuilderPreview(recipe);
                      } catch { setBuilderError("Could not parse recipe. Try adding more detail about ingredients and quantities."); }
                      setBuilderLoading(false);
                    }} style={{ background:builderLoading||!builderInput.trim()?"#ccc":"#378ADD", color:"#fff", border:"none", borderRadius:"4px", padding:"9px 18px", cursor:builderLoading||!builderInput.trim()?"not-allowed":"pointer", fontSize:"13px", fontWeight:"bold" }}>
                      {builderLoading?"⏳ Generating…":"Generate Recipe →"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ background:"#E8F5E9", border:"1px solid #A5D6A7", borderRadius:"6px", padding:"10px 14px", marginBottom:"14px", fontSize:"13px", color:"#2E7D32" }}>
                    ✓ Recipe found — edit anything below, then save
                  </div>
                  <div style={{ marginBottom:"10px" }}>
                    <input value={builderPreview.name||""} placeholder="Recipe name"
                      onChange={e=>setBuilderPreview(p=>({...p,name:e.target.value}))}
                      style={{ width:"100%", fontWeight:"bold", fontSize:"16px", color:"#185FA5", border:"0.5px solid #e5e7eb", borderRadius:"4px", padding:"6px 8px", marginBottom:"6px", boxSizing:"border-box" }}/>
                    <textarea value={builderPreview.description||""} placeholder="One-line description"
                      onChange={e=>setBuilderPreview(p=>({...p,description:e.target.value}))}
                      style={{ width:"100%", fontSize:"12px", color:"#6b7280", border:"0.5px solid #e5e7eb", borderRadius:"4px", padding:"6px 8px", marginBottom:"8px", resize:"vertical", minHeight:"36px", boxSizing:"border-box" }}/>
                    <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", marginBottom:"10px" }}>
                      <label style={{ display:"flex", alignItems:"center", gap:"4px", fontSize:"11px", color:"#185FA5", fontWeight:"bold" }}>
                        🍽 Serves
                        <input type="number" min="1" value={builderPreview.servings??""}
                          onChange={e=>setBuilderPreview(p=>({...p,servings:Number(e.target.value)||""}))}
                          style={{ width:"48px", border:"0.5px solid #e5e7eb", borderRadius:"4px", padding:"3px 5px", fontSize:"11px" }}/>
                      </label>
                      <label style={{ display:"flex", alignItems:"center", gap:"4px", fontSize:"11px", color:"#185FA5", fontWeight:"bold" }}>
                        ⏱ Prep
                        <input value={builderPreview.prep_time||""} placeholder="10 minutes"
                          onChange={e=>setBuilderPreview(p=>({...p,prep_time:e.target.value}))}
                          style={{ width:"80px", border:"0.5px solid #e5e7eb", borderRadius:"4px", padding:"3px 5px", fontSize:"11px" }}/>
                      </label>
                      <label style={{ display:"flex", alignItems:"center", gap:"4px", fontSize:"11px", color:"#185FA5", fontWeight:"bold" }}>
                        🍳 Cook
                        <input value={builderPreview.cook_time||""} placeholder="25 minutes"
                          onChange={e=>setBuilderPreview(p=>({...p,cook_time:e.target.value}))}
                          style={{ width:"80px", border:"0.5px solid #e5e7eb", borderRadius:"4px", padding:"3px 5px", fontSize:"11px" }}/>
                      </label>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:"4px", marginBottom:"12px" }}>
                      {[["kcal","kcal"],["fat","Fat"],["sat_fat","Sat F"],["carbs","Carbs"],["sugar","Sugar"],["fibre","Fibre"],["net_carbs","Net C"],["protein","Prot"]].map(([k,l]) => (
                        <div key={k} style={{ textAlign:"center", background:"#E6F1FB", borderRadius:"4px", padding:"4px 2px" }}>
                          <input type="number" value={(builderPreview.nutrition||{})[k]??0}
                            onChange={e=>setBuilderPreview(p=>({...p,nutrition:{...(p.nutrition||{}),[k]:Number(e.target.value)||0}}))}
                            style={{ width:"100%", textAlign:"center", fontWeight:"bold", color:"#185FA5", fontSize:"13px", border:"none", background:"transparent" }}/>
                          <div style={{ fontSize:"9px", color:"#6b7280" }}>{l}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ fontWeight:"bold", color:"#378ADD", fontSize:"11px", textTransform:"uppercase", marginBottom:"4px" }}>Ingredients</div>
                    {(builderPreview.ingredients||[]).map((ing,i) => (
                      <div key={i} style={{ display:"flex", gap:"6px", alignItems:"center", padding:"3px 0", borderBottom:"1px solid #F0F4F8" }}>
                        <input value={ing.amount||""} placeholder="amount"
                          onChange={e=>setBuilderPreview(p=>({...p,ingredients:p.ingredients.map((x,j)=>j===i?{...x,amount:e.target.value}:x)}))}
                          style={{ width:"70px", fontWeight:"bold", color:"#185FA5", border:"0.5px solid #e5e7eb", borderRadius:"4px", padding:"3px 5px", fontSize:"12px" }}/>
                        <input value={ing.item||""} placeholder="ingredient"
                          onChange={e=>setBuilderPreview(p=>({...p,ingredients:p.ingredients.map((x,j)=>j===i?{...x,item:e.target.value}:x)}))}
                          style={{ flex:1, border:"0.5px solid #e5e7eb", borderRadius:"4px", padding:"3px 5px", fontSize:"12px" }}/>
                        <button onClick={()=>setBuilderPreview(p=>({...p,ingredients:p.ingredients.filter((_,j)=>j!==i)}))}
                          style={{ background:"none", border:"none", color:"#c62828", cursor:"pointer", fontSize:"14px", padding:"0 4px" }}>×</button>
                      </div>
                    ))}
                    <button onClick={()=>setBuilderPreview(p=>({...p,ingredients:[...(p.ingredients||[]),{amount:"",item:""}]}))}
                      style={{ background:"none", border:"1px dashed #378ADD", color:"#378ADD", borderRadius:"4px", padding:"4px 10px", fontSize:"11px", cursor:"pointer", marginTop:"6px", marginBottom:"14px" }}>+ Add ingredient</button>

                    <div style={{ fontWeight:"bold", color:"#378ADD", fontSize:"11px", textTransform:"uppercase", marginBottom:"4px" }}>Method</div>
                    {(builderPreview.steps||[]).map((s,i) => (
                      <div key={i} style={{ display:"flex", gap:"6px", alignItems:"flex-start", padding:"3px 0" }}>
                        <span style={{ fontSize:"11px", color:"#6b7280", padding:"7px 0" }}>{i+1}.</span>
                        <textarea value={s}
                          onChange={e=>setBuilderPreview(p=>({...p,steps:p.steps.map((x,j)=>j===i?e.target.value:x)}))}
                          style={{ flex:1, fontSize:"12px", lineHeight:1.5, border:"0.5px solid #e5e7eb", borderRadius:"4px", padding:"5px 7px", resize:"vertical", minHeight:"32px", boxSizing:"border-box" }}/>
                        <button onClick={()=>setBuilderPreview(p=>({...p,steps:p.steps.filter((_,j)=>j!==i)}))}
                          style={{ background:"none", border:"none", color:"#c62828", cursor:"pointer", fontSize:"14px", padding:"7px 4px" }}>×</button>
                      </div>
                    ))}
                    <button onClick={()=>setBuilderPreview(p=>({...p,steps:[...(p.steps||[]),""]}))}
                      style={{ background:"none", border:"1px dashed #378ADD", color:"#378ADD", borderRadius:"4px", padding:"4px 10px", fontSize:"11px", cursor:"pointer", marginTop:"6px", marginBottom:"14px" }}>+ Add step</button>

                    <div style={{ fontWeight:"bold", color:"#378ADD", fontSize:"11px", textTransform:"uppercase", marginBottom:"4px" }}>Notes</div>
                    <textarea value={builderPreview.notes||""} placeholder="Optional notes"
                      onChange={e=>setBuilderPreview(p=>({...p,notes:e.target.value}))}
                      style={{ width:"100%", fontSize:"12px", color:"#5D4037", border:"0.5px solid #e5e7eb", borderRadius:"4px", padding:"6px 8px", resize:"vertical", minHeight:"40px", boxSizing:"border-box" }}/>
                  </div>
                  <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end", marginTop:"14px", borderTop:"0.5px solid #e5e7eb", paddingTop:"14px" }}>
                    <button onClick={()=>setBuilderPreview(null)} style={{ background:"transparent", color:"#378ADD", border:"1px solid #378ADD", borderRadius:"4px", padding:"8px 14px", cursor:"pointer", fontSize:"12px", fontWeight:"bold" }}>← Regenerate</button>
                    <button onClick={async()=>{
                      await saveRecipe(userId, builderPreview);
                      setUserRecipes(prev=>[...prev,builderPreview].sort((a,b)=>a.name.localeCompare(b.name)));
                      const n = builderPreview.nutrition||{};
                      setAddItem({ name:builderPreview.name, kcal:n.kcal||"", fat:n.fat||"", sat_fat:n.sat_fat||"",
                        carbs:n.carbs||"", sugar:n.sugar||"", fibre:n.fibre||"", net_carbs:n.net_carbs||"", protein:n.protein||"" });
                      setRecipeBuilder(false); setBuilderPreview(null); setBuilderInput("");
                    }} style={{ background:"#2E7D32", color:"#fff", border:"none", borderRadius:"4px", padding:"8px 18px", cursor:"pointer", fontSize:"13px", fontWeight:"bold" }}>
                      ✓ Save Recipe
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Saved Recipes Modal ── */}
      {showRecipesModal && (
        <div onClick={e=>e.target===e.currentTarget&&setShowRecipesModal(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:"12px", width:"520px", maxWidth:"95vw", maxHeight:"88vh", display:"flex", flexDirection:"column", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ background:"#185FA5", color:"#fff", padding:"14px 18px", borderRadius:"12px 12px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
              <div style={{ fontWeight:"bold", fontSize:"15px" }}>📖 Saved Recipes</div>
              <button onClick={()=>setShowRecipesModal(false)} style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>×</button>
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
              {userRecipes.length===0
                ? <div style={{ textAlign:"center", padding:"30px", color:"#6b7280", fontSize:"13px" }}>No saved recipes yet. Use "Create with Claude" to build your first recipe.</div>
                : userRecipes.map(r => (
                  <div key={r.id}
                    style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", borderBottom:"0.5px solid #e5e7eb", borderRadius:"6px", transition:"background 0.15s" }}
                    onMouseOver={e=>e.currentTarget.style.background="#F0F4F8"}
                    onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{ flex:1, cursor:"pointer" }} onClick={()=>{
                      setRecipePortionModal({ recipe: r });
                      setRecipePortionQty("1");
                      setRecipePortionUnit("portion");
                      setRecipePortionScaled(null);
                      setRecipePortionError("");
                    }}>
                      <div style={{ fontWeight:"bold", fontSize:"13px", color:"#185FA5" }}>{r.name}</div>
                      <div style={{ fontSize:"11px", color:"#6b7280" }}>{r.description}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:"10px", marginLeft:"12px" }}>
                      <div style={{ fontSize:"12px", color:"#378ADD", fontWeight:"bold", whiteSpace:"nowrap" }}>{r.nutrition?.kcal} kcal</div>
                      <button onClick={e=>{e.stopPropagation();setRecipeModal(r);}} style={{ background:"none", border:"none", color:"#378ADD", cursor:"pointer", fontSize:"11px", padding:"0 3px" }}>👁</button>
                      <button onClick={async e=>{
                        e.stopPropagation();
                        if(!confirm("Delete this recipe?")) return;
                        await deleteRecipe(userId,r.id);
                        setUserRecipes(prev=>prev.filter(ur=>ur.id!==r.id));
                      }} style={{ background:"none", border:"none", color:"#c62828", cursor:"pointer", fontSize:"11px", opacity:0.5, padding:"0 3px" }}>✕</button>
                    </div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Recipe Portion Modal ── */}
      {recipePortionModal && (() => {
        const r = recipePortionModal.recipe;
        const base = r.nutrition || {};
        const servings = parseFloat(r.servings) || 1;
        const qty = parseFloat(recipePortionQty) || 1;
        const isPortion = recipePortionUnit === "portion";

        // Live-scaled macros for portion unit (no API call needed)
        const liveScaled = isPortion ? {
          kcal:    +(base.kcal    * qty).toFixed(1),
          fat:     +(base.fat     * qty).toFixed(1),
          sat_fat: +(base.sat_fat * qty).toFixed(1),
          carbs:   +(base.carbs   * qty).toFixed(1),
          sugar:   +(base.sugar   * qty).toFixed(1),
          fibre:   +(base.fibre   * qty).toFixed(1),
          net_carbs:+(base.net_carbs * qty).toFixed(1),
          protein: +(base.protein * qty).toFixed(1),
        } : recipePortionScaled;

        const macroDisplay = liveScaled || base;
        const macroLabel = liveScaled
          ? `${qty} ${isPortion ? `portion${qty !== 1 ? "s" : ""}` : recipePortionUnit} of`
          : "Per serving of";

        const loadItem = (macros, label) => {
          const suffix = label || `(${qty} ${recipePortionUnit})`;
          setAddItem({
            name: `${r.name} ${suffix}`,
            kcal: macros.kcal ?? "", fat: macros.fat ?? "",
            sat_fat: macros.sat_fat ?? "", carbs: macros.carbs ?? "",
            sugar: macros.sugar ?? "", fibre: macros.fibre ?? "",
            net_carbs: macros.net_carbs ?? "", protein: macros.protein ?? "",
          });
          setRecipePortionModal(null);
          setShowRecipesModal(false);
        };

        return (
          <div onClick={e => e.target === e.currentTarget && setRecipePortionModal(null)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:4000, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ background:"#fff", borderRadius:"12px", width:"440px", maxWidth:"95vw", boxShadow:"0 8px 40px rgba(0,0,0,0.3)", fontFamily:FONT.sans, overflow:"hidden" }}>

              {/* Header */}
              <div style={{ background:"#185FA5", color:"#fff", padding:"14px 18px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div>
                  <div style={{ fontWeight:"bold", fontSize:"14px" }}>{r.name}</div>
                  <div style={{ fontSize:"11px", opacity:0.8, marginTop:"2px" }}>
                    {r.servings ? `Recipe makes ${r.servings} servings` : "Adjust quantity before adding"}
                  </div>
                </div>
                <button onClick={() => setRecipePortionModal(null)}
                  style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>×</button>
              </div>

              <div style={{ padding:"20px" }}>
                {/* Base nutrition reference */}
                <div style={{ background:"#F0F4F8", borderRadius:"8px", padding:"10px 12px", marginBottom:"18px" }}>
                  <div style={{ fontSize:"10px", color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:"7px" }}>Per serving (base)</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"4px" }}>
                    {[["kcal","Kcal"],["protein","Prot"],["carbs","Carbs"],["fat","Fat"]].map(([k,l]) => (
                      <div key={k} style={{ textAlign:"center", background:"#fff", borderRadius:"6px", padding:"5px 2px", border:"0.5px solid #e5e7eb" }}>
                        <div style={{ fontWeight:"bold", color:"#185FA5", fontSize:"13px" }}>{base[k] ?? "—"}</div>
                        <div style={{ fontSize:"9px", color:"#6b7280" }}>{l}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Quantity + unit */}
                <div style={{ fontSize:"11px", fontWeight:"500", textTransform:"uppercase", letterSpacing:"0.4px", color:"#6b7280", marginBottom:"6px" }}>How much?</div>
                <div style={{ display:"flex", gap:"8px", marginBottom:"16px" }}>
                  <input
                    type="number" min="0.1" step="0.1"
                    value={recipePortionQty}
                    onChange={e => {
                      setRecipePortionQty(e.target.value);
                      setRecipePortionScaled(null); // clear any Claude result when qty changes
                      setRecipePortionError("");
                    }}
                    style={{ flex:1, padding:"10px", border:`1.5px solid ${C.blue}`, borderRadius:"6px",
                      fontSize:"18px", fontFamily:FONT.mono, fontWeight:"500", outline:"none", textAlign:"center" }}
                  />
                  <select
                    value={recipePortionUnit}
                    onChange={e => {
                      setRecipePortionUnit(e.target.value);
                      setRecipePortionScaled(null);
                      setRecipePortionError("");
                    }}
                    style={{ flex:1.4, padding:"10px 8px", border:`0.5px solid ${C.borderMid}`, borderRadius:"6px",
                      fontSize:"13px", fontFamily:FONT.sans, outline:"none", background:"#fff" }}>
                    <option value="portion">portion(s)</option>
                    <option value="g">grams (g)</option>
                    <option value="ml">millilitres (ml)</option>
                    <option value="oz">ounces (oz)</option>
                  </select>
                </div>

                {/* Scaled macro preview */}
                {(liveScaled || recipePortionScaled) && (
                  <div style={{ background:"#E8F5E9", borderRadius:"8px", padding:"10px 12px", marginBottom:"16px", border:"0.5px solid #A5D6A7" }}>
                    <div style={{ fontSize:"10px", color:"#2E7D32", textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:"7px", fontWeight:"500" }}>
                      ✓ {macroLabel} {r.name}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"4px" }}>
                      {[["kcal","Kcal"],["protein","Prot"],["carbs","Carbs"],["fat","Fat"],
                        ["sat_fat","Sat F"],["sugar","Sugar"],["fibre","Fibre"],["net_carbs","Net C"]].map(([k,l]) => (
                        <div key={k} style={{ textAlign:"center", background:"#fff", borderRadius:"6px", padding:"5px 2px", border:"0.5px solid #C8E6C9" }}>
                          <div style={{ fontWeight:"bold", color:"#2E7D32", fontSize:"13px" }}>{macroDisplay[k] ?? "—"}</div>
                          <div style={{ fontSize:"9px", color:"#6b7280" }}>{l}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {recipePortionError && (
                  <div style={{ fontSize:"12px", color:"#c62828", marginBottom:"12px" }}>{recipePortionError}</div>
                )}
                {recipePortionLoading && (
                  <div style={{ fontSize:"12px", color:"#6b7280", marginBottom:"12px", textAlign:"center" }}>Calculating nutrition…</div>
                )}

                {/* Actions */}
                <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end" }}>
                  <button onClick={() => setRecipePortionModal(null)}
                    style={{ background:"transparent", border:`0.5px solid ${C.borderMid}`, color:"#6b7280",
                      borderRadius:"6px", padding:"9px 16px", cursor:"pointer", fontSize:"12px", fontFamily:FONT.sans }}>
                    Cancel
                  </button>

                  {/* For non-portion units: "Calculate" first, then "Add" */}
                  {!isPortion && !recipePortionScaled && (
                    <button disabled={recipePortionLoading}
                      onClick={async () => {
                        const qtyNum = parseFloat(recipePortionQty) || 1;
                        setRecipePortionLoading(true); setRecipePortionError("");
                        try {
                          const ingredientsList = r.ingredients?.map(i => `${i.amount} ${i.item}`).join(", ") || "not available";
                          const prompt = `I have a recipe called "${r.name}" that makes ${servings} serving${servings!==1?"s":""}.
Per serving nutrition: ${base.kcal} kcal, protein ${base.protein}g, fat ${base.fat}g, sat_fat ${base.sat_fat}g, carbs ${base.carbs}g, sugar ${base.sugar}g, fibre ${base.fibre}g, net_carbs ${base.net_carbs}g.
Ingredients: ${ingredientsList}.
Calculate nutrition for ${qtyNum} ${recipePortionUnit} of this recipe.
Reply with ONLY a JSON object, no markdown:
{"kcal":0,"fat":0,"sat_fat":0,"carbs":0,"sugar":0,"fibre":0,"net_carbs":0,"protein":0}`;
                          const res = await fetch("/api/claude", {
                            method:"POST", headers:{"Content-Type":"application/json"},
                            body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:200,
                              messages:[{role:"user", content:prompt}] })
                          });
                          const data = await res.json();
                          const text = (data.content?.[0]?.text||"{}").replace(/```json|```/g,"").trim();
                          const n = JSON.parse(text);
                          setRecipePortionScaled({
                            kcal: +(n.kcal||0).toFixed(1), fat: +(n.fat||0).toFixed(1),
                            sat_fat: +(n.sat_fat||0).toFixed(1), carbs: +(n.carbs||0).toFixed(1),
                            sugar: +(n.sugar||0).toFixed(1), fibre: +(n.fibre||0).toFixed(1),
                            net_carbs: +(n.net_carbs||0).toFixed(1), protein: +(n.protein||0).toFixed(1),
                          });
                        } catch {
                          setRecipePortionError("Could not calculate — try portions instead, or adjust manually.");
                        } finally {
                          setRecipePortionLoading(false);
                        }
                      }}
                      style={{ background: recipePortionLoading ? C.hint : "#378ADD", color:"#fff", border:"none",
                        borderRadius:"6px", padding:"9px 18px", cursor: recipePortionLoading ? "not-allowed" : "pointer",
                        fontSize:"12px", fontWeight:"500", fontFamily:FONT.sans }}>
                      {recipePortionLoading ? "…" : "Calculate"}
                    </button>
                  )}

                  {/* Add button — always shown for portions (live calc), shown after Calculate for g/ml */}
                  {(isPortion || recipePortionScaled) && (
                    <button
                      onClick={() => {
                        const macros = isPortion ? liveScaled : recipePortionScaled;
                        const unitLabel = isPortion
                          ? `(${qty} portion${qty !== 1 ? "s" : ""})`
                          : `(${qty}${recipePortionUnit})`;
                        loadItem(macros, unitLabel);
                      }}
                      style={{ background:"#2E7D32", color:"#fff", border:"none", borderRadius:"6px",
                        padding:"9px 20px", cursor:"pointer", fontSize:"13px", fontWeight:"500", fontFamily:FONT.sans }}>
                      ✓ Load into Form
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Exercise Picker Modal ── */}
      {showExModal && (
        <div onClick={e=>e.target===e.currentTarget&&setShowExModal(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:"12px", width:"560px", maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ background:"#185FA5", color:"#fff", padding:"14px 18px", borderRadius:"12px 12px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:"bold", fontSize:"15px" }}>🏋️ Log Exercise</div>
              <button onClick={()=>setShowExModal(false)} style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>×</button>
            </div>
            <div style={{ padding:"18px" }}>
              <input value={exSearch} onChange={e=>setExSearch(e.target.value)} autoFocus
                placeholder="Search exercise… e.g. cycling, yoga, running"
                style={{ width:"100%", padding:"8px 12px", border:"2px solid #378ADD", borderRadius:"6px", fontSize:"13px", boxSizing:"border-box", outline:"none", marginBottom:"10px" }}/>
              <div style={{ maxHeight:"200px", overflowY:"auto", border:"0.5px solid #e5e7eb", borderRadius:"6px", marginBottom:"12px" }}>
                {EXERCISE_COMPENDIUM
                  .filter(ex=>!exSearch||ex.name.toLowerCase().includes(exSearch.toLowerCase())||ex.cat.toLowerCase().includes(exSearch.toLowerCase()))
                  .map(ex => (
                    <div key={ex.name} onClick={()=>{setExSelected(ex);setExResult(null);}}
                      style={{ padding:"8px 12px", borderBottom:"1px solid #F0F4F8", cursor:"pointer", fontSize:"12px", background:exSelected?.name===ex.name?"#E6F1FB":"transparent" }}>
                      <div style={{ fontWeight:"bold", color:"#185FA5" }}>{ex.name}</div>
                      <div style={{ fontSize:"10px", color:"#6b7280" }}>{ex.cat} · MET {ex.met}</div>
                    </div>
                  ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px", marginBottom:"12px" }}>
                {[["Duration (min)","number",exDuration,setExDuration],["Avg HR (opt)","number",exHRavg,setExHRavg],["Weight (kg)","number","84",null]].map(([label,type,val,setter],i)=>(
                  <div key={label}>
                    <div style={{ fontSize:"10px", color:"#6b7280", textTransform:"uppercase", marginBottom:"2px" }}>{label}</div>
                    <input type={type} value={i===2?"84":val} onChange={setter?e=>setter(e.target.value):undefined}
                      style={{ width:"100%", padding:"6px 8px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"12px" }}/>
                  </div>
                ))}
              </div>
              <button onClick={()=>{
                if (!exSelected||!exDuration) return;
                const mins = parseFloat(exDuration)||0;
                const weight = 84;
                const met = exSelected.met;
                const kcal = Math.round(met*weight*mins/60);
                const hrAvg = parseFloat(exHRavg)||null;
                const hrMax = hrAvg ? Math.round(hrAvg*1.12) : null;
                const hrPct = hrMax ? (hrAvg/hrMax*100) : 70;
                const fatPct = hrPct<70?70:hrPct<80?60:hrPct<90?40:20;
                const fatKcal = Math.round(kcal*fatPct/100);
                const zone = hrPct<60?"Zone 1":hrPct<70?"Zone 2":hrPct<80?"Zone 3":hrPct<90?"Zone 4":"Zone 5";
                setExResult({ kcal, fatPct, fatKcal, fatGrams:Math.round(fatKcal/9), zone, mins, weight, met });
              }} style={{ width:"100%", background:!exSelected||!exDuration?"#ccc":"#378ADD", color:"#fff", border:"none", borderRadius:"6px", padding:"9px", cursor:!exSelected||!exDuration?"not-allowed":"pointer", fontSize:"13px", fontWeight:"bold", marginBottom:"12px" }}>
                Calculate
              </button>
              {exResult && (
                <div style={{ background:"#F0F4F8", borderRadius:"8px", padding:"12px" }}>
                  <div style={{ fontWeight:"bold", color:"#185FA5", fontSize:"13px", marginBottom:"8px" }}>{exSelected.name} · {exResult.mins} min</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"10px" }}>
                    {[["🔥 Kcal Burned",`${exResult.kcal} kcal`],["❤️ HR Zone",exResult.zone],["🧈 Fat Burn %",`${exResult.fatPct}%`],["🧈 Fat Burned",`${exResult.fatGrams}g (${exResult.fatKcal} kcal)`]].map(([label,val])=>(
                      <div key={label} style={{ background:"#fff", borderRadius:"6px", padding:"7px 10px", border:"0.5px solid #e5e7eb" }}>
                        <div style={{ fontSize:"10px", color:"#6b7280", marginBottom:"2px" }}>{label}</div>
                        <div style={{ fontWeight:"bold", fontSize:"12px", color:"#185FA5" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                    <select value={exMealId} onChange={e=>setExMealId(e.target.value)}
                      style={{ flex:1, padding:"6px 8px", border:"0.5px solid #e5e7eb", borderRadius:"4px", fontSize:"12px" }}>
                      <option value="">— select meal slot —</option>
                      {(()=>{
                        const existing = allDays.find(d=>d.date===addDate);
                        const meals = existing ? ensureMealSlots(existing).meals : DEFAULT_MEAL_SLOTS;
                        return meals.map((m,i)=><option key={m.id||i} value={m.id||("__slot__"+m.name)}>{m.name}</option>);
                      })()}
                    </select>
                    <button onClick={async()=>{
                      if (!exMealId) { setExMsg({ok:false,text:"Select a meal slot"}); return; }
                      try {
                        let raw = allDays.find(d=>d.date===addDate)||await loadDay(userId,addDate);
                        let day = ensureMealSlots(raw || {date:addDate,notes:"",meals:makeMeals()});
                        let targetMealId = exMealId;
                        if (targetMealId.startsWith("__slot__")) {
                          const match = day.meals.find(m=>m.name===targetMealId.replace("__slot__",""));
                          targetMealId = match?.id||null;
                        }
                        if (!targetMealId) { setExMsg({ok:false,text:"Meal slot not found — try again"}); return; }
                        const item = { id:genId(), name:`${exSelected.name} (${exResult.mins} min)`,
                          kcal:-exResult.kcal, fat:0, sat_fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0,
                          is_exercise:1, fat_burned_g:exResult.fatGrams, fat_burned_kcal:exResult.fatKcal };
                        const updated = {...day, meals:day.meals.map(m=>m.id===targetMealId?{...m,items:[...(m.items||[]),item]}:m)};
                        await persistDay(updated);
                        if (addDate===currentDate) setCurrentDayData(updated);
                        setShowExModal(false); setExResult(null); setExSelected(null); setExSearch("");
                        setExDuration("30"); setExHRavg(""); setExHRmax(""); setExMealId("");
                      } catch(e) {
                        setExMsg({ok:false,text:"Failed to log: "+e.message});
                      }
                    }} style={{ background:"#2E7D32", color:"#fff", border:"none", borderRadius:"6px", padding:"8px 16px", cursor:"pointer", fontSize:"13px", fontWeight:"bold", whiteSpace:"nowrap" }}>
                      ✓ Log It
                    </button>
                  </div>
                  {exMsg && <div style={{ marginTop:"8px", padding:"6px 10px", borderRadius:"4px", fontSize:"12px", background:exMsg.ok?"#E8F5E9":"#FFEBEE", color:exMsg.ok?"#2E7D32":"#c62828" }}>{exMsg.text}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
