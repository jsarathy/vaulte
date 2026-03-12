// src/tabs/AddEntryTab.jsx
import { genId } from "../utils";
import { DEFAULT_MEAL_SLOTS } from "../constants/mealSlots";
import { EXERCISE_COMPENDIUM } from "../constants/exercises";
import { claudeCreateRecipe, claudeClassifyFood, claudeLookupIngredient } from "../api/claudeApi";
import { saveRecipe, deleteRecipe, loadDay } from "../api/firestore";

export default function AddEntryTab({ ctx }) {
  const {
    userId, allDays, currentDate, currentDayData, userRecipes, setUserRecipes,
    addDate, setAddDate, addMealId, setAddMealId, addMealName, setAddMealName,
    addItem, setAddItem, nameDropdown, setNameDropdown, showDropdown, setShowDropdown,
    addMsg, setAddMsg, nameInputRef,
    recipeBuilder, setRecipeBuilder, builderInput, setBuilderInput,
    builderLoading, setBuilderLoading, builderPreview, setBuilderPreview,
    builderError, setBuilderError, showRecipesModal, setShowRecipesModal,
    ingredientModal, setIngredientModal, ingredientWeight, setIngredientWeight,
    ingredientLoading, setIngredientLoading,
    showExModal, setShowExModal, exSearch, setExSearch, exSelected, setExSelected,
    exDuration, setExDuration, exHRavg, setExHRavg, exHRmax, setExHRmax,
    exResult, setExResult, exMsg, setExMsg,
    polarConnected, polarSessions, polarSyncing, polarLastSync, polarSyncMsg,
    syncPolar, setPolarLogModal, polarLogModal,
    calcAge, calcWeight, persistDay, setRecipeModal, S,
  } = ctx;

  // Helper: resolve meal id for a given day
  const resolveMealId = (day, mealId, mealName) => {
    let tid = mealId;
    if (tid?.startsWith("__slot__")) {
      const name = tid.replace("__slot__","");
      const m = day.meals.find(m => m.name === name);
      tid = m ? m.id : null;
    }
    if (!tid && mealName) {
      // caller needs to add meal first
      return null;
    }
    return tid;
  };

  const submitAddItem = async () => {
    if (!addItem.name) { setAddMsg({ ok:false, text:"Please enter a food name" }); return; }
    let day = allDays.find(d => d.date === addDate) || await loadDay(userId, addDate);
    if (!day) { day = { date:addDate, notes:"", meals:DEFAULT_MEAL_SLOTS.map(s=>({id:genId(),name:s.name,is_exercise:s.is_exercise,items:[]})) }; }

    let targetMealId = addMealId;
    if (targetMealId?.startsWith("__slot__")) {
      const slotName = targetMealId.replace("__slot__","");
      const match = day.meals.find(m => m.name === slotName);
      targetMealId = match ? match.id : null;
    }
    if (!targetMealId && addMealName) {
      const newMeal = { id:genId(), name:addMealName, is_exercise:0, items:[] };
      day = { ...day, meals:[...day.meals, newMeal] };
      targetMealId = newMeal.id;
    }
    if (!targetMealId) { setAddMsg({ ok:false, text:"Please select or create a meal" }); return; }

    const item = { id:genId(), name:addItem.name,
      kcal:parseFloat(addItem.kcal)||0, fat:parseFloat(addItem.fat)||0, sat_fat:parseFloat(addItem.sat_fat)||0,
      carbs:parseFloat(addItem.carbs)||0, sugar:parseFloat(addItem.sugar)||0, fibre:parseFloat(addItem.fibre)||0,
      net_carbs:parseFloat(addItem.net_carbs)||0, protein:parseFloat(addItem.protein)||0 };

    const updated = { ...day, meals:day.meals.map(m => m.id===targetMealId ? {...m, items:[...m.items, item]} : m) };
    await persistDay(updated);
    if (addDate === currentDate) ctx.setCurrentDayData(updated);
    setAddMsg({ ok:true, text:"Item added!" });
    setAddItem({ name:"", kcal:"", fat:"", sat_fat:"", carbs:"", sugar:"", fibre:"", net_carbs:"", protein:"" });
    setTimeout(() => setAddMsg(null), 3000);
  };

  const nutriFields = [
    ["kcal","Calories (kcal)"],["fat","Fat (g)"],["sat_fat","Sat Fat (g)"],
    ["carbs","Carbs (g)"],["sugar","Sugar (g)"],["fibre","Fibre (g)"],
    ["net_carbs","Net Carbs (g)"],["protein","Protein (g)"],
  ];

  const mealOptions = (date) => {
    const existing = allDays.find(d => d.date === date);
    const meals = existing ? existing.meals : DEFAULT_MEAL_SLOTS;
    return meals.map((m,i) => <option key={m.id||i} value={m.id||("__slot__"+m.name)}>{m.name}</option>);
  };

  return (
    <div style={{ ...S.main, display:"flex", gap:"14px", alignItems:"flex-start" }}>

      {/* ── LEFT: Food (65%) ── */}
      <div style={{ flex:"0 0 65%", minWidth:0 }}>
        <div style={{ fontSize:"16px", fontWeight:"bold", color:"#1F4E79", marginBottom:"12px" }}>Add Food Entry</div>
        <div style={{ background:"#fff", borderRadius:"8px", border:"1px solid #DDEAF6", padding:"14px", marginBottom:"12px" }}>
          <div style={{ fontWeight:"bold", color:"#1F4E79", marginBottom:"10px", fontSize:"13px" }}>Add Food Item</div>

          {/* Day + Meal row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"10px" }}>
            <div>
              <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"2px" }}>Day</div>
              <input type="date" value={addDate} onChange={e=>setAddDate(e.target.value)}
                style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}/>
            </div>
            <div>
              <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"2px" }}>Meal</div>
              <select value={addMealId} onChange={e=>setAddMealId(e.target.value)}
                style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}>
                <option value="">- select -</option>
                {mealOptions(addDate)}
              </select>
            </div>
          </div>

          {/* Food name + autocomplete */}
          <div style={{ marginBottom:"10px", position:"relative" }}>
            <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"2px" }}>Food Item Name</div>
            <input ref={nameInputRef} value={addItem.name}
              onChange={e => {
                const val = e.target.value;
                setAddItem({...addItem, name:val});
                if (val.length > 1) {
                  const matches = userRecipes.filter(r => r.name.toLowerCase().includes(val.toLowerCase()));
                  setNameDropdown(matches); setShowDropdown(matches.length > 0);
                } else { setShowDropdown(false); }
              }}
              onBlur={async () => {
                setTimeout(async () => {
                  setShowDropdown(false);
                  const name = addItem.name.trim();
                  if (!name) return;
                  const exact = userRecipes.find(r => r.name.toLowerCase() === name.toLowerCase());
                  if (exact) return;
                  const hasNutrition = addItem.kcal || addItem.fat || addItem.carbs || addItem.protein;
                  if (hasNutrition) return;
                  try {
                    const verdict = await claudeClassifyFood(name);
                    if (verdict === "INGREDIENT") {
                      setIngredientWeight("100"); setIngredientModal({ name });
                    } else {
                      setBuilderInput(name); setBuilderPreview(null); setBuilderError(""); setRecipeBuilder(true);
                    }
                  } catch {
                    setBuilderInput(name); setBuilderPreview(null); setBuilderError(""); setRecipeBuilder(true);
                  }
                }, 150);
              }}
              onFocus={() => { if (nameDropdown.length > 0) setShowDropdown(true); }}
              placeholder="e.g. Pinto bean stew (1 portion)"
              style={{ width:"100%", padding:"5px 9px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}/>
            {showDropdown && (
              <div style={{ position:"absolute", top:"100%", left:0, right:0, background:"#fff", border:"1px solid #DDEAF6", borderRadius:"0 0 6px 6px", boxShadow:"0 4px 12px rgba(0,0,0,0.1)", zIndex:100, maxHeight:"180px", overflowY:"auto" }}>
                {nameDropdown.map(r => (
                  <div key={r.id} onMouseDown={() => {
                    const n = r.nutrition || {};
                    setAddItem({ name:r.name, kcal:n.kcal||"", fat:n.fat||"", sat_fat:n.sat_fat||"",
                      carbs:n.carbs||"", sugar:n.sugar||"", fibre:n.fibre||"", net_carbs:n.net_carbs||"", protein:n.protein||"" });
                    setShowDropdown(false);
                  }} style={{ padding:"8px 12px", cursor:"pointer", borderBottom:"1px solid #F0F4F8", fontSize:"12px" }}
                    onMouseOver={e=>e.currentTarget.style.background="#F0F4F8"}
                    onMouseOut={e=>e.currentTarget.style.background="#fff"}>
                    <strong style={{ color:"#1F4E79" }}>{r.name}</strong>
                    {r.nutrition?.kcal && <span style={{ color:"#6B8CAE", marginLeft:"8px" }}>{r.nutrition.kcal} kcal/serving</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Nutrition fields */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"6px", marginBottom:"10px" }}>
            {nutriFields.map(([key, label]) => (
              <div key={key}>
                <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"2px" }}>{label}</div>
                <input type="number" step="0.1" value={addItem[key]}
                  onChange={e => setAddItem({...addItem, [key]:e.target.value})}
                  style={{ width:"100%", padding:"5px 7px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}/>
              </div>
            ))}
          </div>

          {addMsg && (
            <div style={{ padding:"7px 10px", borderRadius:"4px", fontSize:"12px", marginBottom:"8px",
              background:addMsg.ok?"#E8F5E9":"#FFEBEE", color:addMsg.ok?"#2E7D32":"#c62828" }}>
              {addMsg.text}
            </div>
          )}
          <button onClick={submitAddItem}
            style={{ width:"100%", background:"#2E75B6", color:"#fff", border:"none", borderRadius:"6px", padding:"9px", cursor:"pointer", fontSize:"13px", fontWeight:"bold" }}>
            + Add to Log
          </button>
        </div>

        {/* Recipe action buttons */}
        <div style={{ display:"flex", gap:"10px", marginBottom:"12px" }}>
          <button onClick={() => setShowRecipesModal(true)}
            style={{ flex:1, background:"#2E75B6", color:"#fff", border:"none", borderRadius:"8px", padding:"10px", fontSize:"13px", fontWeight:"bold", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
            Browse Saved Recipes
          </button>
          <button onClick={() => { setRecipeBuilder(true); setBuilderPreview(null); setBuilderInput(""); setBuilderError(""); }}
            style={{ flex:1, background:"#1F4E79", color:"#fff", border:"none", borderRadius:"8px", padding:"10px", fontSize:"13px", fontWeight:"bold", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
            Create with Claude
          </button>
        </div>

        {/* Ingredient weight modal */}
        {ingredientModal && (
          <div onClick={e => e.target===e.currentTarget && setIngredientModal(null)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ background:"#fff", borderRadius:"12px", width:"340px", padding:"20px", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
              <div style={{ fontWeight:"bold", fontSize:"15px", color:"#1F4E79", marginBottom:"4px" }}>{ingredientModal.name}</div>
              <div style={{ fontSize:"12px", color:"#6B8CAE", marginBottom:"14px" }}>How much did you have?</div>
              <div style={{ marginBottom:"14px" }}>
                <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"4px" }}>Weight (grams)</div>
                <input type="number" value={ingredientWeight} onChange={e=>setIngredientWeight(e.target.value)} autoFocus
                  style={{ width:"100%", padding:"8px 10px", border:"2px solid #2E75B6", borderRadius:"6px", fontSize:"14px", textAlign:"right" }}/>
              </div>
              {ingredientLoading && <div style={{ textAlign:"center", color:"#6B8CAE", marginBottom:"12px" }}>Looking up nutrition...</div>}
              <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end" }}>
                <button onClick={() => setIngredientModal(null)}
                  style={{ background:"transparent", color:"#2E75B6", border:"1px solid #2E75B6", borderRadius:"4px", padding:"8px 14px", cursor:"pointer", fontSize:"12px" }}>Cancel</button>
                <button disabled={ingredientLoading} onClick={async () => {
                  const wg = parseFloat(ingredientWeight) || 100;
                  setIngredientLoading(true);
                  try {
                    const n = await claudeLookupIngredient(ingredientModal.name, wg);
                    setAddItem({ name:`${ingredientModal.name} (${wg}g)`, kcal:n.kcal||"", fat:n.fat||"",
                      sat_fat:n.sat_fat||"", carbs:n.carbs||"", sugar:n.sugar||"", fibre:n.fibre||"",
                      net_carbs:n.net_carbs||"", protein:n.protein||"" });
                  } catch { /* leave fields empty, user fills manually */ }
                  setIngredientLoading(false);
                  setIngredientModal(null);
                }} style={{ background:"#2E75B6", color:"#fff", border:"none", borderRadius:"4px", padding:"8px 18px", cursor:"pointer", fontSize:"12px", fontWeight:"bold" }}>
                  Look Up
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Recipe Builder modal */}
        {recipeBuilder && (
          <div onClick={e => e.target===e.currentTarget && setRecipeBuilder(false)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ background:"#fff", borderRadius:"12px", width:"640px", maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
              <div style={{ background:"#1F4E79", color:"#fff", padding:"14px 18px", borderRadius:"12px 12px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ fontWeight:"bold", fontSize:"15px" }}>Create Recipe with Claude</div>
                <button onClick={() => setRecipeBuilder(false)} style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>x</button>
              </div>
              <div style={{ padding:"18px" }}>
                {!builderPreview ? (
                  <>
                    <p style={{ color:"#6B8CAE", fontSize:"13px", marginBottom:"12px", lineHeight:1.5 }}>
                      Describe your recipe - ingredients, quantities, method, servings. Claude will generate the full recipe with nutrition per serving.
                    </p>
                    <textarea value={builderInput} onChange={e=>setBuilderInput(e.target.value)}
                      placeholder="e.g. Pinto bean stew - 606g cooked pinto beans, 102g onion, 3 tbsp sesame oil, 200g chopped tomatoes, salt and hing. Makes 4 portions."
                      style={{ width:"100%", minHeight:"120px", padding:"10px", border:"1px solid #DDEAF6", borderRadius:"6px", fontSize:"13px", fontFamily:"inherit", resize:"vertical", background:"#F0F4F8", boxSizing:"border-box" }}/>
                    {builderError && <div style={{ color:"#c62828", fontSize:"12px", marginTop:"6px" }}>{builderError}</div>}
                    <div style={{ display:"flex", justifyContent:"flex-end", marginTop:"12px" }}>
                      <button disabled={builderLoading || !builderInput.trim()} onClick={async () => {
                        setBuilderLoading(true); setBuilderError("");
                        try {
                          const recipe = await claudeCreateRecipe(builderInput);
                          recipe.id = genId();
                          setBuilderPreview(recipe);
                        } catch { setBuilderError("Could not parse recipe. Try adding more detail."); }
                        setBuilderLoading(false);
                      }} style={{ background:builderLoading||!builderInput.trim()?"#ccc":"#2E75B6", color:"#fff", border:"none", borderRadius:"4px", padding:"9px 18px", cursor:builderLoading||!builderInput.trim()?"not-allowed":"pointer", fontSize:"13px", fontWeight:"bold" }}>
                        {builderLoading ? "Generating..." : "Generate Recipe"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ background:"#E8F5E9", border:"1px solid #A5D6A7", borderRadius:"6px", padding:"10px 14px", marginBottom:"14px", fontSize:"13px", color:"#2E7D32" }}>
                      Recipe generated - review and save below
                    </div>
                    <div style={{ marginBottom:"10px" }}>
                      <div style={{ fontWeight:"bold", fontSize:"16px", color:"#1F4E79", marginBottom:"2px" }}>{builderPreview.name}</div>
                      <div style={{ fontSize:"12px", color:"#6B8CAE", marginBottom:"8px" }}>{builderPreview.description}</div>
                      <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", marginBottom:"10px" }}>
                        {builderPreview.servings  && <span style={{ background:"#D6E4F0", color:"#1F4E79", borderRadius:"20px", padding:"2px 10px", fontSize:"11px", fontWeight:"bold" }}>Serves {builderPreview.servings}</span>}
                        {builderPreview.prep_time && <span style={{ background:"#D6E4F0", color:"#1F4E79", borderRadius:"20px", padding:"2px 10px", fontSize:"11px", fontWeight:"bold" }}>Prep: {builderPreview.prep_time}</span>}
                        {builderPreview.cook_time && <span style={{ background:"#D6E4F0", color:"#1F4E79", borderRadius:"20px", padding:"2px 10px", fontSize:"11px", fontWeight:"bold" }}>Cook: {builderPreview.cook_time}</span>}
                      </div>
                      {builderPreview.nutrition && (
                        <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:"4px", marginBottom:"12px" }}>
                          {[["kcal","kcal"],["fat","Fat"],["sat_fat","Sat F"],["carbs","Carbs"],["sugar","Sugar"],["fibre","Fibre"],["net_carbs","Net C"],["protein","Prot"]].map(([k,l]) => (
                            <div key={k} style={{ textAlign:"center", background:"#D6E4F0", borderRadius:"4px", padding:"4px 2px" }}>
                              <div style={{ fontWeight:"bold", color:"#1F4E79", fontSize:"13px" }}>{builderPreview.nutrition[k]||0}</div>
                              <div style={{ fontSize:"9px", color:"#6B8CAE" }}>{l}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ fontWeight:"bold", color:"#2E75B6", fontSize:"11px", textTransform:"uppercase", marginBottom:"4px" }}>Ingredients</div>
                      <ul style={{ listStyle:"none", padding:0, marginBottom:"10px" }}>
                        {builderPreview.ingredients?.map((ing,i) => (
                          <li key={i} style={{ padding:"3px 0", borderBottom:"1px solid #F0F4F8", display:"flex", gap:"10px", fontSize:"12px" }}>
                            <span style={{ fontWeight:"bold", color:"#1F4E79", minWidth:"60px" }}>{ing.amount}</span>
                            <span>{ing.item}</span>
                          </li>
                        ))}
                      </ul>
                      <div style={{ fontWeight:"bold", color:"#2E75B6", fontSize:"11px", textTransform:"uppercase", marginBottom:"4px" }}>Method</div>
                      <ol style={{ paddingLeft:"20px", marginBottom:"10px" }}>
                        {builderPreview.steps?.map((s,i) => <li key={i} style={{ fontSize:"12px", padding:"3px 0", lineHeight:1.5 }}>{s}</li>)}
                      </ol>
                      {builderPreview.notes && (
                        <div style={{ background:"#FFF8E1", borderLeft:"3px solid #F57F17", padding:"8px 12px", borderRadius:"0 4px 4px 0", fontSize:"12px", color:"#5D4037" }}>{builderPreview.notes}</div>
                      )}
                    </div>
                    <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end", marginTop:"14px", borderTop:"1px solid #DDEAF6", paddingTop:"14px" }}>
                      <button onClick={() => setBuilderPreview(null)}
                        style={{ background:"transparent", color:"#2E75B6", border:"1px solid #2E75B6", borderRadius:"4px", padding:"8px 14px", cursor:"pointer", fontSize:"12px", fontWeight:"bold" }}>
                        Regenerate
                      </button>
                      <button onClick={async () => {
                        await saveRecipe(userId, builderPreview);
                        setUserRecipes(prev => [...prev, builderPreview].sort((a,b)=>a.name.localeCompare(b.name)));
                        const n = builderPreview.nutrition || {};
                        setAddItem({ name:builderPreview.name, kcal:n.kcal||"", fat:n.fat||"", sat_fat:n.sat_fat||"",
                          carbs:n.carbs||"", sugar:n.sugar||"", fibre:n.fibre||"", net_carbs:n.net_carbs||"", protein:n.protein||"" });
                        setRecipeBuilder(false); setBuilderPreview(null); setBuilderInput("");
                      }} style={{ background:"#2E7D32", color:"#fff", border:"none", borderRadius:"4px", padding:"8px 18px", cursor:"pointer", fontSize:"13px", fontWeight:"bold" }}>
                        Save Recipe
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Browse Recipes modal */}
        {showRecipesModal && (
          <div onClick={e => e.target===e.currentTarget && setShowRecipesModal(false)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ background:"#fff", borderRadius:"12px", width:"520px", maxWidth:"95vw", maxHeight:"88vh", display:"flex", flexDirection:"column", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
              <div style={{ background:"#1F4E79", color:"#fff", padding:"14px 18px", borderRadius:"12px 12px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
                <div style={{ fontWeight:"bold", fontSize:"15px" }}>Saved Recipes</div>
                <button onClick={() => setShowRecipesModal(false)} style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>x</button>
              </div>
              <div style={{ flex:1, overflowY:"auto", padding:"8px" }}>
                {userRecipes.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"30px", color:"#6B8CAE", fontSize:"13px" }}>
                    No saved recipes yet. Use "Create with Claude" to build your first recipe.
                  </div>
                ) : userRecipes.map(r => (
                  <div key={r.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 12px", borderBottom:"1px solid #DDEAF6", borderRadius:"6px" }}
                    onMouseOver={e=>e.currentTarget.style.background="#F0F4F8"}
                    onMouseOut={e=>e.currentTarget.style.background="transparent"}>
                    <div style={{ flex:1, cursor:"pointer" }} onClick={() => {
                      const n = r.nutrition || {};
                      setAddItem({ name:r.name, kcal:n.kcal||"", fat:n.fat||"", sat_fat:n.sat_fat||"",
                        carbs:n.carbs||"", sugar:n.sugar||"", fibre:n.fibre||"", net_carbs:n.net_carbs||"", protein:n.protein||"" });
                      setShowRecipesModal(false);
                    }}>
                      <div style={{ fontWeight:"bold", fontSize:"13px", color:"#1F4E79" }}>{r.name}</div>
                      <div style={{ fontSize:"11px", color:"#6B8CAE" }}>{r.description}</div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:"10px", marginLeft:"12px" }}>
                      <div style={{ fontSize:"12px", color:"#2E75B6", fontWeight:"bold", whiteSpace:"nowrap" }}>{r.nutrition?.kcal} kcal</div>
                      <button onClick={e => { e.stopPropagation(); setRecipeModal(r); }}
                        style={{ background:"none", border:"none", color:"#2E75B6", cursor:"pointer", fontSize:"11px", padding:"0 3px" }}>view</button>
                      <button onClick={async e => {
                        e.stopPropagation();
                        if (!confirm("Delete this recipe?")) return;
                        await deleteRecipe(userId, r.id);
                        setUserRecipes(prev => prev.filter(ur => ur.id !== r.id));
                      }} style={{ background:"none", border:"none", color:"#c62828", cursor:"pointer", fontSize:"11px", opacity:0.5, padding:"0 3px" }}>del</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>{/* end left col */}

      {/* ── RIGHT: Exercise (35%) ── */}
      <div style={{ flex:"0 0 35%", minWidth:0 }}>
        <div style={{ fontSize:"16px", fontWeight:"bold", color:"#1F4E79", marginBottom:"12px" }}>Exercise</div>

        <button onClick={() => { setShowExModal(true); setExSearch(""); setExSelected(null); setExResult(null); setExMsg(null); }}
          style={{ width:"100%", background:"#2E75B6", color:"#fff", border:"none", borderRadius:"8px", padding:"10px", fontSize:"13px", fontWeight:"bold", cursor:"pointer", marginBottom:"14px", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
          Log Manual Exercise
        </button>

        {/* Polar Sessions panel */}
        <div style={{ background:"#fff", borderRadius:"8px", border:"1px solid #DDEAF6", overflow:"hidden" }}>
          <div style={{ background:"#1F4E79", padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
            <div style={{ color:"#fff", fontWeight:"bold", fontSize:"13px", display:"flex", alignItems:"center", gap:"6px" }}>
              Polar Sessions
            </div>
            {polarConnected && (
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <div style={{ fontSize:"10px", color:"#90CAF9", display:"flex", alignItems:"center", gap:"4px" }}>
                  <span style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#4CAF50", display:"inline-block" }}/>
                  Connected
                </div>
                <button onClick={syncPolar} disabled={polarSyncing}
                  style={{ background:polarSyncing?"rgba(255,255,255,0.1)":"rgba(255,255,255,0.2)", border:"1px solid rgba(255,255,255,0.3)", color:"#fff", borderRadius:"4px", padding:"2px 8px", fontSize:"10px", cursor:polarSyncing?"not-allowed":"pointer", fontWeight:"bold" }}>
                  {polarSyncing ? "Syncing..." : "Sync"}
                </button>
              </div>
            )}
          </div>
          {polarSyncMsg && (
            <div style={{ padding:"7px 12px", fontSize:"11px", fontWeight:"bold",
              background:polarSyncMsg.ok?"#E8F5E9":"#FFEBEE", color:polarSyncMsg.ok?"#2E7D32":"#c62828", borderBottom:"1px solid #DDEAF6" }}>
              {polarSyncMsg.text}
            </div>
          )}
          <div style={{ padding:"12px" }}>
            {!polarConnected ? (
              <div style={{ textAlign:"center", padding:"16px 8px" }}>
                <div style={{ fontSize:"32px", marginBottom:"8px" }}>⌚</div>
                <div style={{ fontSize:"13px", fontWeight:"bold", color:"#1F4E79", marginBottom:"6px" }}>Connect your Polar device</div>
                <div style={{ fontSize:"11px", color:"#6B8CAE", marginBottom:"14px", lineHeight:1.5 }}>
                  Authorise Vaulte to read your training sessions from Polar Flow. After connecting, use Sync to pull sessions.
                </div>
                <button onClick={() => { window.location.href = `/api/polar-auth?userId=${userId}`; }}
                  style={{ background:"#D94032", color:"#fff", border:"none", borderRadius:"6px", padding:"9px 18px", cursor:"pointer", fontSize:"12px", fontWeight:"bold" }}>
                  Connect Polar Account
                </button>
              </div>
            ) : polarSessions.length === 0 ? (
              <div style={{ textAlign:"center", padding:"16px 8px", color:"#6B8CAE" }}>
                <div style={{ fontSize:"28px", marginBottom:"6px" }}>✅</div>
                <div style={{ fontSize:"12px", marginBottom:"8px" }}>All sessions logged.</div>
                {polarLastSync && (
                  <div style={{ fontSize:"10px", color:"#A0B4C8" }}>
                    Last sync: {new Date(polarLastSync).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}
                  </div>
                )}
                <div style={{ fontSize:"11px", marginTop:"10px" }}>Sync your H10 to Polar Flow, then click Sync above.</div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"8px", display:"flex", justifyContent:"space-between" }}>
                  <span>{polarSessions.length} unlogged session{polarSessions.length>1?"s":""}</span>
                  {polarLastSync && <span>Synced {new Date(polarLastSync).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>}
                </div>
                {polarSessions.map(s => {
                  const sport = s.sport ? s.sport.replace(/_/g," ").toLowerCase().replace(/\b\w/g,c=>c.toUpperCase()) : "Exercise";
                  const d = s.start_time ? new Date(s.start_time) : null;
                  const dateStr = d ? d.toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"}) : "";
                  const timeStr = d ? d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "";
                  return (
                    <div key={s.id} onClick={() => setPolarLogModal(s)}
                      style={{ padding:"10px 12px", borderRadius:"6px", border:"1px solid #DDEAF6", marginBottom:"8px", cursor:"pointer" }}
                      onMouseOver={e=>e.currentTarget.style.background="#F0F4F8"}
                      onMouseOut={e=>e.currentTarget.style.background="#fff"}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"4px" }}>
                        <div style={{ fontWeight:"bold", fontSize:"12px", color:"#1F4E79" }}>{sport}</div>
                        <div style={{ fontSize:"10px", color:"#6B8CAE" }}>{dateStr} {timeStr}</div>
                      </div>
                      <div style={{ display:"flex", gap:"10px", fontSize:"11px", color:"#2E75B6", flexWrap:"wrap" }}>
                        <span>{Math.round(s.duration_min||0)} min</span>
                        <span>{s.calories} kcal</span>
                        {s.hr_avg && <span>{s.hr_avg} bpm avg</span>}
                        {s.fat_pct != null && <span>{s.fat_pct}% fat</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>{/* end right col */}

      {/* Exercise Modal */}
      {showExModal && (
        <div onClick={e => e.target===e.currentTarget && setShowExModal(false)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:"12px", width:"560px", maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ background:"#1F4E79", color:"#fff", padding:"14px 18px", borderRadius:"12px 12px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:"bold", fontSize:"15px" }}>Log Exercise</div>
              <button onClick={() => setShowExModal(false)} style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>x</button>
            </div>
            <div style={{ padding:"18px" }}>
              <input value={exSearch} onChange={e => setExSearch(e.target.value)} autoFocus
                placeholder="Search exercise... e.g. cycling, yoga, running"
                style={{ width:"100%", padding:"8px 12px", border:"2px solid #2E75B6", borderRadius:"6px", fontSize:"13px", boxSizing:"border-box", outline:"none", marginBottom:"10px" }}/>
              <div style={{ maxHeight:"200px", overflowY:"auto", border:"1px solid #DDEAF6", borderRadius:"6px", marginBottom:"12px" }}>
                {EXERCISE_COMPENDIUM
                  .filter(ex => !exSearch || ex.name.toLowerCase().includes(exSearch.toLowerCase()) || ex.cat.toLowerCase().includes(exSearch.toLowerCase()))
                  .map(ex => (
                    <div key={ex.name} onClick={() => { setExSelected(ex); setExResult(null); }}
                      style={{ padding:"8px 12px", borderBottom:"1px solid #F0F4F8", cursor:"pointer", fontSize:"12px", background:exSelected?.name===ex.name?"#D6E4F0":"transparent" }}>
                      <div style={{ fontWeight:"bold", color:"#1F4E79" }}>{ex.name}</div>
                      <div style={{ fontSize:"10px", color:"#6B8CAE" }}>{ex.cat} - MET {ex.met}</div>
                    </div>
                  ))}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px", marginBottom:"12px" }}>
                {[["Duration (min)", exDuration, setExDuration, "30"],
                  ["Avg HR (bpm)", exHRavg, setExHRavg, "optional"],
                  ["Max HR (bpm)", exHRmax, setExHRmax, `${220-calcAge}`]
                ].map(([label, val, setter, ph]) => (
                  <div key={label}>
                    <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"3px" }}>{label}</div>
                    <input type="number" value={val} onChange={e=>{ setter(e.target.value); setExResult(null); }} placeholder={String(ph)}
                      style={{ width:"100%", padding:"6px 8px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px", boxSizing:"border-box" }}/>
                  </div>
                ))}
              </div>
              <button disabled={!exSelected||!exDuration} onClick={() => {
                const met = exSelected.met, mins = parseFloat(exDuration)||0, weight = calcWeight||80;
                const kcal = Math.round(met * weight * mins / 60);
                const hrAvg = parseFloat(exHRavg), hrMax = parseFloat(exHRmax)||(220-(calcAge||40));
                let fatPct, zone;
                if (hrAvg && hrMax) {
                  const p = hrAvg/hrMax*100;
                  if(p<60){fatPct=82;zone="Recovery (<60%)";}
                  else if(p<65){fatPct=75;zone="Fat Burn (60-65%)";}
                  else if(p<70){fatPct=67;zone="Fat Burn (65-70%)";}
                  else if(p<75){fatPct=55;zone="Aerobic (70-75%)";}
                  else if(p<80){fatPct=43;zone="Aerobic (75-80%)";}
                  else if(p<85){fatPct=30;zone="Threshold (80-85%)";}
                  else if(p<90){fatPct=20;zone="Threshold (85-90%)";}
                  else{fatPct=8;zone="VO2 Max (>90%)";}
                } else {
                  if(met<=3){fatPct=75;zone="Light";}
                  else if(met<=5){fatPct=60;zone="Moderate";}
                  else if(met<=8){fatPct=40;zone="Vigorous";}
                  else{fatPct=20;zone="Very Vigorous";}
                }
                const fatKcal = Math.round(kcal*fatPct/100);
                setExResult({ kcal, fatPct, fatKcal, fatGrams:Math.round(fatKcal/9), zone, mins, weight, met });
              }} style={{ width:"100%", background:!exSelected||!exDuration?"#ccc":"#2E75B6", color:"#fff", border:"none", borderRadius:"6px", padding:"9px", cursor:!exSelected||!exDuration?"not-allowed":"pointer", fontSize:"13px", fontWeight:"bold", marginBottom:"12px" }}>
                Calculate
              </button>
              {exResult && (
                <div style={{ background:"#F0F4F8", borderRadius:"8px", padding:"12px" }}>
                  <div style={{ fontWeight:"bold", color:"#1F4E79", fontSize:"13px", marginBottom:"8px" }}>
                    {exSelected.name} - {exResult.mins} min
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"10px" }}>
                    {[["Kcal Burned",`${exResult.kcal} kcal`],["HR Zone",exResult.zone],
                      ["Fat Burn %",`${exResult.fatPct}%`],["Fat Burned",`${exResult.fatGrams}g (${exResult.fatKcal} kcal)`]
                    ].map(([label,val]) => (
                      <div key={label} style={{ background:"#fff", borderRadius:"6px", padding:"7px 10px", border:"1px solid #DDEAF6" }}>
                        <div style={{ fontSize:"10px", color:"#6B8CAE", marginBottom:"2px" }}>{label}</div>
                        <div style={{ fontWeight:"bold", fontSize:"12px", color:"#1F4E79" }}>{val}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
                    <select value={addMealId} onChange={e=>setAddMealId(e.target.value)}
                      style={{ flex:1, padding:"6px 8px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}>
                      <option value="">- select meal slot -</option>
                      {mealOptions(addDate)}
                    </select>
                    <button onClick={async () => {
                      let day = allDays.find(d=>d.date===addDate) || await loadDay(userId, addDate);
                      if (!day) day = { date:addDate, notes:"", meals:DEFAULT_MEAL_SLOTS.map(s=>({id:genId(),name:s.name,is_exercise:s.is_exercise,items:[]})) };
                      let tid = addMealId;
                      if (tid?.startsWith("__slot__")) { const m = day.meals.find(m=>m.name===tid.replace("__slot__","")); tid = m?.id||null; }
                      if (!tid) { setExMsg({ok:false,text:"Select a meal slot"}); return; }
                      const item = { id:genId(), name:`${exSelected.name} (${exResult.mins} min)`,
                        kcal:-exResult.kcal, fat:0, sat_fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0,
                        is_exercise:1, fat_burned_g:exResult.fatGrams, fat_burned_kcal:exResult.fatKcal };
                      const updated = {...day, meals:day.meals.map(m=>m.id===tid?{...m,items:[...m.items,item]}:m)};
                      await persistDay(updated);
                      if (addDate===currentDate) ctx.setCurrentDayData(updated);
                      setShowExModal(false); setExResult(null); setExSelected(null); setExSearch(""); setExDuration("30"); setExHRavg(""); setExHRmax("");
                    }} style={{ background:"#2E7D32", color:"#fff", border:"none", borderRadius:"6px", padding:"8px 16px", cursor:"pointer", fontSize:"13px", fontWeight:"bold", whiteSpace:"nowrap" }}>
                      Log It
                    </button>
                  </div>
                  {exMsg && <div style={{ marginTop:"8px", padding:"6px 10px", borderRadius:"4px", fontSize:"12px",
                    background:exMsg.ok?"#E8F5E9":"#FFEBEE", color:exMsg.ok?"#2E7D32":"#c62828" }}>{exMsg.text}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Polar Session Log Modal */}
      {polarLogModal && (
        <div onClick={e => e.target===e.currentTarget && setPolarLogModal(null)}
          style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#fff", borderRadius:"12px", width:"420px", maxWidth:"95vw", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ background:"#D94032", color:"#fff", padding:"14px 18px", borderRadius:"12px 12px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ fontWeight:"bold", fontSize:"15px" }}>Log Polar Session</div>
              <button onClick={() => setPolarLogModal(null)} style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>x</button>
            </div>
            <div style={{ padding:"18px" }}>
              {(() => {
                const s = polarLogModal;
                const sport = s.sport ? s.sport.replace(/_/g," ").toLowerCase().replace(/\w/g,c=>c.toUpperCase()) : "Exercise";
                const d = s.start_time ? new Date(s.start_time) : null;
                const dateStr = d ? d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"}) : s.date||"";
                const timeStr = d ? d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "";
                const sessionDate = s.start_time ? s.start_time.split("T")[0] : (s.date || addDate);
                return (
                  <>
                    <div style={{ fontWeight:"bold", fontSize:"16px", color:"#1F4E79", marginBottom:"4px" }}>{sport}</div>
                    <div style={{ fontSize:"12px", color:"#6B8CAE", marginBottom:"14px" }}>{dateStr}{timeStr?` at ${timeStr}`:""}</div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"16px" }}>
                      {[
                        ["Duration", `${Math.round(s.duration_min||0)} min`],
                        ["Calories", `${s.calories} kcal`],
                        s.hr_avg ? ["Avg HR", `${s.hr_avg} bpm`] : null,
                        s.hr_max ? ["Max HR", `${s.hr_max} bpm`] : null,
                        s.fat_pct != null ? ["Fat Burn", `${s.fat_pct}%`] : null,
                        s.fat_pct != null ? ["Fat Burned", `${Math.round(s.calories*s.fat_pct/100/9)}g`] : null,
                      ].filter(Boolean).map(([label,val]) => (
                        <div key={label} style={{ background:"#F0F4F8", borderRadius:"6px", padding:"8px 10px", border:"1px solid #DDEAF6" }}>
                          <div style={{ fontSize:"10px", color:"#6B8CAE", marginBottom:"2px" }}>{label}</div>
                          <div style={{ fontWeight:"bold", fontSize:"13px", color:"#1F4E79" }}>{val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom:"12px" }}>
                      <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"4px" }}>Log to meal slot on {sessionDate}</div>
                      <select defaultValue="" onChange={e=>ctx.setAddMealId(e.target.value)}
                        style={{ width:"100%", padding:"7px 8px", border:"1px solid #DDEAF6", borderRadius:"4px", fontSize:"12px" }}>
                        <option value="">- select meal slot -</option>
                        {mealOptions(sessionDate)}
                      </select>
                    </div>
                    <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end" }}>
                      <button onClick={() => setPolarLogModal(null)}
                        style={{ background:"transparent", color:"#6B8CAE", border:"1px solid #DDEAF6", borderRadius:"4px", padding:"8px 14px", cursor:"pointer", fontSize:"12px" }}>Cancel</button>
                      <button onClick={async () => {
                        let day = allDays.find(d=>d.date===sessionDate) || await loadDay(userId,sessionDate);
                        if (!day) day = { date:sessionDate, notes:"", meals:DEFAULT_MEAL_SLOTS.map(sl=>({id:genId(),name:sl.name,is_exercise:sl.is_exercise,items:[]})) };
                        let tid = addMealId;
                        if (tid?.startsWith("__slot__")) { const m = day.meals.find(m=>m.name===tid.replace("__slot__","")); tid = m?.id||null; }
                        if (!tid) { alert("Please select a meal slot"); return; }
                        const item = { id:genId(),
                          name:`${sport} (${Math.round(s.duration_min||0)} min) - Polar`,
                          kcal:-s.calories, fat:0, sat_fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0,
                          is_exercise:1, fat_burned_g:s.fat_pct!=null?Math.round(s.calories*s.fat_pct/100/9):0,
                          polar_session_id:s.id };
                        const updated = {...day, meals:day.meals.map(m=>m.id===tid?{...m,items:[...m.items,item]}:m)};
                        await persistDay(updated);
                        if (sessionDate===currentDate) ctx.setCurrentDayData(updated);
                        const { db } = await import("../firebase");
                        const { doc, setDoc } = await import("firebase/firestore");
                        await setDoc(doc(db,"users",userId,"polar_sessions",s.id),{...s,logged:true});
                        ctx.setPolarSessions(prev => prev.filter(ps => ps.id !== s.id));
                        setPolarLogModal(null);
                      }} style={{ background:"#D94032", color:"#fff", border:"none", borderRadius:"4px", padding:"8px 18px", cursor:"pointer", fontSize:"13px", fontWeight:"bold" }}>
                        Log Session
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
