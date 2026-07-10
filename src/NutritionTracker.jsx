// src/NutritionTracker.jsx
import { useState, useEffect } from "react";
import { db } from "./firebase";
import { doc, setDoc, getDoc, getDocs, collection } from "firebase/firestore";
import { genId, makeMeals, getDayTotals, ensureMealSlots, DEFAULT_MEAL_SLOTS } from "./constants/helpers";
import { DEFAULT_PLAN_CONFIG, generateWeightProjection } from "./constants/weightPlan";
import { loadAllDays, saveDay, loadDay, loadAllRecipes, seedInitialData } from "./api/firestore";
import { claudeParseFood, claudeChat } from "./api/claude";
import { C, FONT, border, IconChevronLeft, IconChevronRight } from "./constants/design.jsx";

import RecipeModal   from "./components/RecipeModal";
import ChatPopup     from "./components/ChatPopup";
import LogTab        from "./tabs/LogTab";
import CompareTab    from "./tabs/CompareTab";
import AddEntry      from "./tabs/AddEntry";
import WeightTracker from "./tabs/WeightTracker";

// ── Calendar Sidebar ─────────────────────────────────────────────────────────
function CalendarSidebar({ allDays, currentDate, calYear, calMonth, setCalYear, setCalMonth, switchDay }) {
  const todayStr = new Date().toISOString().split("T")[0];
  const loggedSet = new Set(allDays.map(d => d.date));
  const loggedKcal = {};
  allDays.forEach(d => { loggedKcal[d.date] = getDayTotals(d).foodKcal; });
  const dows = ["M","T","W","T","F","S","S"];
  const prevMonth = () => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); };
  const nextMonth = () => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); };
  const label = new Date(calYear, calMonth, 1).toLocaleString("default", { month:"long", year:"numeric" });
  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(<div key={"bl"+i} />);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(calMonth+1).padStart(2,"0"), dd = String(d).padStart(2,"0");
    const ds = `${calYear}-${mm}-${dd}`;
    const isLogged = loggedSet.has(ds), isActive = ds === currentDate, isToday = ds === todayStr;
    const kcal = loggedKcal[ds];
    cells.push(
      <div key={ds} onClick={() => switchDay(ds)} title={kcal ? `${Math.round(kcal)} kcal` : ""}
        style={{ textAlign:"center", fontSize:"11px", padding:"4px 1px", borderRadius:"4px", cursor:"pointer", lineHeight:1.2, fontFamily:FONT.mono,
          background: isActive ? C.blue : isLogged ? C.blueBg : "transparent",
          color: isActive ? "#fff" : isLogged ? C.blueText : isToday ? C.blue : C.muted,
          fontWeight: isActive || isLogged ? "500" : "400",
          outline: isToday && !isActive ? `1px solid ${C.blue}` : "none", outlineOffset:"-1px" }}>
        {d}
        {kcal ? <span style={{ fontSize:"7px", display:"block", opacity:0.8 }}>{Math.round(kcal)}</span> : null}
      </div>
    );
  }
  return (
    <div style={{ padding:"12px 10px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"8px" }}>
        <button onClick={prevMonth} style={{ background:"transparent", border:"none", cursor:"pointer", color:C.muted, display:"flex", alignItems:"center", padding:"2px" }}><IconChevronLeft size={12}/></button>
        <span style={{ fontSize:"11px", fontWeight:"500", color:C.text }}>{label}</span>
        <button onClick={nextMonth} style={{ background:"transparent", border:"none", cursor:"pointer", color:C.muted, display:"flex", alignItems:"center", padding:"2px" }}><IconChevronRight size={12}/></button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"1px", marginBottom:"2px" }}>
        {dows.map((d,i) => <div key={i} style={{ textAlign:"center", fontSize:"9px", fontWeight:"500", color:C.hint, paddingBottom:"3px" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"1px" }}>{cells}</div>
    </div>
  );
}

// ── Polar Log Modal ──────────────────────────────────────────────────────────
function PolarLogModal({ session, userId, allDays, persistDay, setCurrentDayData, currentDate, setPolarSessions, onClose }) {
  const [localMealId, setLocalMealId] = useState("");
  const [logging, setLogging] = useState(false);
  const [err, setErr] = useState("");

  if (!session) return null;
  const s = session;
  const sport = s.sport ? s.sport.replace(/_/g," ").toLowerCase().replace(/\w/g,c=>c.toUpperCase()) : "Exercise";
  const d = s.start_time ? new Date(s.start_time) : null;
  const dateStr = d ? d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"}) : (s.date||"");
  const timeStr = d ? d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "";
  const sessionDate = s.start_time ? s.start_time.split("T")[0] : (s.date||new Date().toISOString().split("T")[0]);
  const SLOTS = DEFAULT_MEAL_SLOTS;
  const stats = [["Duration",`${Math.round(s.duration_min||0)} min`],["Calories",`${s.calories} kcal`],s.hr_avg?["Avg HR",`${s.hr_avg} bpm`]:null,s.hr_max?["Max HR",`${s.hr_max} bpm`]:null,s.fat_pct!=null?["Fat burn",`${s.fat_pct}%`]:null,s.fat_pct!=null?["Fat burned",`${Math.round(s.calories*s.fat_pct/100/9)}g`]:null].filter(Boolean);
  const existing = allDays.find(d=>d.date===sessionDate);
  const mealOptions = existing ? ensureMealSlots(existing).meals : DEFAULT_MEAL_SLOTS;

  // Build SVG sparkline from hr_samples
  const HRChart = () => {
    const samples = s.hr_samples;
    if (!samples || samples.length < 2) return null;
    const W = 368, H = 80, PAD = 4;
    const valid = samples.filter(v => v != null);
    const minHR = Math.min(...valid) - 5;
    const maxHR = Math.max(...valid) + 5;
    // Downsample to max 200 points for rendering
    const step = Math.max(1, Math.floor(samples.length / 200));
    const pts = [];
    for (let i = 0; i < samples.length; i += step) {
      const v = samples[i];
      if (v == null) continue;
      const x = PAD + ((i / (samples.length - 1)) * (W - PAD * 2));
      const y = PAD + ((1 - (v - minHR) / (maxHR - minHR)) * (H - PAD * 2));
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    const polyline = pts.join(" ");
    // HR zones (rough): <60% = blue, 60-70% = green, 70-80% = yellow, 80-90% = orange, >90% = red
    const totalMin = Math.round(s.duration_min || 0);
    const rateS = s.recording_rate_s || 5;
    const zones = { z1:0, z2:0, z3:0, z4:0, z5:0 };
    const hrMax = s.hr_max || 180;
    samples.forEach(v => {
      if (v == null) return;
      const pct = v / hrMax;
      if (pct < 0.6) zones.z1 += rateS;
      else if (pct < 0.7) zones.z2 += rateS;
      else if (pct < 0.8) zones.z3 += rateS;
      else if (pct < 0.9) zones.z4 += rateS;
      else zones.z5 += rateS;
    });
    const totalS = Object.values(zones).reduce((a,b)=>a+b,0) || 1;
    const zoneColors = ["#B5D4F4","#C0DD97","#FAC775","#F0997B","#E24B4A"];
    const zoneLabels = ["Z1","Z2","Z3","Z4","Z5"];
    const zoneSecs = [zones.z1,zones.z2,zones.z3,zones.z4,zones.z5];

    return (
      <div style={{ marginBottom:"14px" }}>
        <div style={{ fontSize:"10px",color:C.hint,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:"6px",display:"flex",justifyContent:"space-between",alignItems:"baseline" }}>
          <span>Heart rate · {samples.length * rateS / 60 | 0} min recorded</span>
          <span style={{ fontFamily:FONT.mono }}>{Math.min(...valid)}–{Math.max(...valid)} bpm</span>
        </div>
        <div style={{ background:C.bg,borderRadius:"6px",border:`0.5px solid ${C.border}`,padding:"6px 8px" }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%",height:"70px",display:"block" }}>
            {/* zero-line at avg */}
            {s.hr_avg && (() => {
              const y = PAD + ((1 - (s.hr_avg - minHR) / (maxHR - minHR)) * (H - PAD*2));
              return <line x1={PAD} y1={y} x2={W-PAD} y2={y} stroke={C.blueMid} strokeWidth="0.5" strokeDasharray="3,3"/>;
            })()}
            <polyline points={polyline} fill="none" stroke={C.blue} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
            {/* min/max labels */}
            <text x={PAD+2} y={PAD+8} fontSize="8" fill={C.hint} fontFamily="DM Mono, monospace">{Math.round(maxHR)} bpm</text>
            <text x={PAD+2} y={H-PAD-2} fontSize="8" fill={C.hint} fontFamily="DM Mono, monospace">{Math.round(minHR)} bpm</text>
          </svg>
          {/* Zone bar */}
          <div style={{ display:"flex",height:"6px",borderRadius:"3px",overflow:"hidden",marginTop:"4px" }}>
            {zoneSecs.map((sec,i) => (
              <div key={i} style={{ flex:sec/totalS,background:zoneColors[i],minWidth:sec>0?"1px":"0" }}/>
            ))}
          </div>
          <div style={{ display:"flex",gap:"8px",marginTop:"5px" }}>
            {zoneSecs.map((sec,i) => sec > 0 && (
              <div key={i} style={{ display:"flex",alignItems:"center",gap:"3px",fontSize:"9px",color:C.muted }}>
                <div style={{ width:"7px",height:"7px",borderRadius:"1px",background:zoneColors[i],flexShrink:0 }}/>
                <span>{zoneLabels[i]} {Math.round(sec/60)}m</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()} style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center" }}>
      <div style={{ background:"#fff",borderRadius:"10px",width:"440px",maxWidth:"95vw",border:`0.5px solid ${C.border}`,fontFamily:FONT.sans }}>
        <div style={{ padding:"14px 16px",borderBottom:border,display:"flex",justifyContent:"space-between",alignItems:"center" }}>
          <div><div style={{ fontWeight:"500",fontSize:"13px",color:C.text }}>{sport}</div><div style={{ fontSize:"11px",color:C.muted,marginTop:"2px" }}>{dateStr}{timeStr?` · ${timeStr}`:""}</div></div>
          <button onClick={onClose} style={{ background:"none",border:"none",cursor:"pointer",color:C.muted,fontSize:"18px",lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:"14px 16px" }}>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:"7px",marginBottom:"14px" }}>
            {stats.map(([lbl,val])=>(<div key={lbl} style={{ background:C.bg,borderRadius:"6px",padding:"8px 10px",border:`0.5px solid ${C.border}` }}><div style={{ fontSize:"10px",color:C.hint,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:"2px" }}>{lbl}</div><div style={{ fontWeight:"500",fontSize:"13px",color:C.text,fontFamily:FONT.mono }}>{val}</div></div>))}
          </div>
          <HRChart />
          <div style={{ marginBottom:"14px" }}>
            <div style={{ fontSize:"10px",color:C.hint,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:"5px" }}>Log to meal slot</div>
            <select value={localMealId} onChange={e=>{ setLocalMealId(e.target.value); setErr(""); }}
              style={{ width:"100%",padding:"7px 10px",border:`0.5px solid ${localMealId?"#d1d5db":C.danger}`,borderRadius:"6px",fontSize:"12px",fontFamily:FONT.sans }}>
              <option value="">— select slot —</option>
              {mealOptions.map((m,i)=><option key={m.id||i} value={m.id||("__slot__"+m.name)}>{m.name}</option>)}
            </select>
            {err && <div style={{ fontSize:"11px",color:C.danger,marginTop:"4px" }}>{err}</div>}
          </div>
          <div style={{ display:"flex",gap:"8px",justifyContent:"flex-end" }}>
            <button onClick={onClose} style={{ background:"transparent",border:`0.5px solid ${C.borderMid}`,color:C.muted,borderRadius:"6px",padding:"7px 14px",cursor:"pointer",fontSize:"12px",fontFamily:FONT.sans }}>Cancel</button>
            <button disabled={logging} onClick={async()=>{
              if (!localMealId) { setErr("Please select a meal slot"); return; }
              setLogging(true);
              try {
                let day=ensureMealSlots(allDays.find(d=>d.date===sessionDate)||await loadDay(userId,sessionDate)||{date:sessionDate,notes:"",meals:makeMeals()});
                let targetMealId=localMealId;
                if(targetMealId.startsWith("__slot__")){
                  const match=day.meals.find(m=>m.name===targetMealId.replace("__slot__",""));
                  targetMealId=match?.id||null;
                }
                if(!targetMealId) { setErr("Meal slot not found — try again"); setLogging(false); return; }
                const fatGrams=s.fat_pct!=null?Math.round(s.calories*s.fat_pct/100/9):0;
                const fatKcal=s.fat_pct!=null?Math.round(s.calories*s.fat_pct/100):0;
                const item={id:genId(),name:`${sport} (${Math.round(s.duration_min||0)} min) · Polar`,kcal:-s.calories,fat:0,sat_fat:0,carbs:0,sugar:0,fibre:0,net_carbs:0,protein:0,is_exercise:1,fat_burned_g:fatGrams,fat_burned_kcal:fatKcal,polar_session_id:s.id};
                const updated={...day,meals:day.meals.map(m=>m.id===targetMealId?{...m,items:[...(m.items||[]),item]}:m)};
                await persistDay(updated);
                if(sessionDate===currentDate) setCurrentDayData(updated);
                await setDoc(doc(db,"users",userId,"polar_sessions",s.id),{...s,logged:true});
                setPolarSessions(prev=>prev.filter(ps=>ps.id!==s.id));
                onClose();
              } catch(e) {
                setErr("Failed to log session: "+e.message);
                setLogging(false);
              }
            }} style={{ background:logging?C.muted:C.blue,color:"#fff",border:"none",borderRadius:"6px",padding:"7px 16px",cursor:logging?"not-allowed":"pointer",fontSize:"12px",fontWeight:"500",fontFamily:FONT.sans }}>
              {logging ? "Logging…" : "Log session"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function NutritionTracker({ userId }) {
  const [allDays,setAllDays]=useState([]);const [currentDate,setCurrentDate]=useState(null);const [currentDayData,setCurrentDayData]=useState(null);
  const [activeTab,setActiveTab]=useState("log");const [loading,setLoading]=useState(true);
  const [calYear,setCalYear]=useState(()=>new Date().getFullYear());const [calMonth,setCalMonth]=useState(()=>new Date().getMonth());
  const [recipeModal,setRecipeModal]=useState(null);const [userRecipes,setUserRecipes]=useState([]);
  const [polarConnected,setPolarConnected]=useState(false);const [polarSessions,setPolarSessions]=useState([]);
  const [polarSyncing,setPolarSyncing]=useState(false);const [polarLastSync,setPolarLastSync]=useState(null);
  const [polarSyncMsg,setPolarSyncMsg]=useState(null);const [polarLogModal,setPolarLogModal]=useState(null);
  const [weightLog,setWeightLog]=useState([]);const [weightPlanConfig,setWeightPlanConfig]=useState(DEFAULT_PLAN_CONFIG);
  const [editingPlan,setEditingPlan]=useState(false);const [editCfg,setEditCfg]=useState(DEFAULT_PLAN_CONFIG);
  const [chatMessages,setChatMessages]=useState([]);const [chatInput,setChatInput]=useState("");
  const [chatMealId,setChatMealId]=useState("__chat__");const [chatDate,setChatDate]=useState(()=>new Date().toISOString().split("T")[0]);
  const [chatLoading,setChatLoading]=useState(false);const [justChatHistory,setJustChatHistory]=useState([]);const [chatOpen,setChatOpen]=useState(false);
  const CHAT_CONTEXT_LIMIT=30;
  const [addDate,setAddDate]=useState(()=>new Date().toISOString().split("T")[0]);const [addMealId,setAddMealId]=useState("");const [addMealName,setAddMealName]=useState("");
  const [addItem,setAddItem]=useState({name:"",kcal:"",fat:"",sat_fat:"",carbs:"",sugar:"",fibre:"",net_carbs:"",protein:""});const [addMsg,setAddMsg]=useState(null);
  const [compareSlots,setCompareSlots]=useState([null,null,null,null,null]);const [compareData,setCompareData]=useState([null,null,null,null,null]);
  const [calcSex,setCalcSex]=useState("m");const [calcAge,setCalcAge]=useState(60);const [calcHeight,setCalcHeight]=useState(165);const [calcWeight,setCalcWeight]=useState(84);const [calcProtein,setCalcProtein]=useState(1.4);const [calcFatPct,setCalcFatPct]=useState(30);

  useEffect(()=>{
    if(!userId){setLoading(false);return;}
    (async()=>{
      try{
        setLoading(true);
        let days=await loadAllDays(userId);if(days.length===0)days=await seedInitialData(userId);
        const recipes=await loadAllRecipes(userId);setUserRecipes(recipes);
        const cfgDoc=await getDoc(doc(db,"users",userId,"weight_plan","settings"));
        const cfg=cfgDoc.exists()?{...DEFAULT_PLAN_CONFIG,...cfgDoc.data()}:DEFAULT_PLAN_CONFIG;
        setWeightPlanConfig(cfg);setEditCfg(cfg);
        const proj=generateWeightProjection(cfg);
        const wSnap=await getDocs(collection(db,"users",userId,"weight_log"));
        if(wSnap.empty){const seed=proj.map(r=>({...r,actual:r.week===1?cfg.startWeightKg:null}));await setDoc(doc(db,"users",userId,"weight_log","1"),seed[0]);setWeightLog(seed);}
        else{const actuals={};wSnap.docs.forEach(d=>{const data=d.data();if(data.actual!=null)actuals[d.id]=data.actual;});setWeightLog(proj.map(r=>({...r,actual:actuals[String(r.week)]??null})));}
        try{const chatDoc=await getDoc(doc(db,"users",userId,"claude_chat","conversation"));if(chatDoc.exists()){const{history}=chatDoc.data();if(Array.isArray(history)&&history.length>0){setJustChatHistory(history);setChatMessages(history.map(h=>({id:genId(),type:h.role==="user"?"user":"claude",text:h.content})));}}}catch(e){}
        const polarDoc=await getDoc(doc(db,"users",userId,"polar","connection"));if(polarDoc.exists()){const pd=polarDoc.data();setPolarConnected(pd.connected||false);setPolarLastSync(pd.last_sync_at||null);}
        const polarSnap=await getDocs(collection(db,"users",userId,"polar_sessions"));
        setPolarSessions(polarSnap.docs.map(d=>({id:d.id,...d.data()})).filter(s=>!s.logged).sort((a,b)=>(b.start_time||"").localeCompare(a.start_time||"")));
        const mergedDays = days.map(ensureMealSlots); setAllDays(mergedDays);
        if(mergedDays.length>0){const first=mergedDays[0];setCurrentDate(first.date);setCurrentDayData(first);setChatDate(first.date);const slots=mergedDays.slice(0,5).map(d=>d.date);setCompareSlots([...slots,...Array(5-slots.length).fill(null)].slice(0,5));setCompareData(mergedDays.slice(0,5).concat(Array(5).fill(null)).slice(0,5));}
      }catch(err){console.error("Init error:",err);}finally{setLoading(false);}
    })();
  },[userId]);

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);const pp=params.get("polar");
    if(pp==="connected"){(async()=>{const polarDoc=await getDoc(doc(db,"users",userId,"polar","connection"));if(polarDoc.exists()){const pd=polarDoc.data();setPolarConnected(pd.connected||false);setPolarLastSync(pd.last_sync_at||null);}})();window.history.replaceState({},"",window.location.pathname);setPolarSyncMsg({ok:true,text:"Polar connected — click Sync to pull sessions."});setTimeout(()=>setPolarSyncMsg(null),6000);}
    else if(pp==="error"){window.history.replaceState({},"",window.location.pathname);setPolarSyncMsg({ok:false,text:"Polar connection failed."});setTimeout(()=>setPolarSyncMsg(null),6000);}
  },[userId]);

  const switchDay=async(date)=>{setCurrentDate(date);let data=allDays.find(d=>d.date===date)||null;if(!data)data=await loadDay(userId,date);setCurrentDayData(ensureMealSlots(data));setChatDate(date);setChatMealId("__chat__");};
  const persistDay=async(dayData)=>{await saveDay(userId,dayData);setAllDays(prev=>[dayData,...prev.filter(d=>d.date!==dayData.date)].sort((a,b)=>b.date.localeCompare(a.date)));setCurrentDayData(dayData);};
  const deleteItem=async(mealId,itemId)=>{if(!currentDayData)return;const updated={...currentDayData,meals:currentDayData.meals.map(m=>m.id===mealId?{...m,items:m.items.filter(i=>i.id!==itemId)}:m)};await persistDay(updated);};
  const savePlanConfig=async(cfg)=>{setWeightPlanConfig(cfg);setEditCfg(cfg);setEditingPlan(false);try{await setDoc(doc(db,"users",userId,"weight_plan","settings"),cfg);}catch(e){}const proj=generateWeightProjection(cfg);const actuals={};weightLog.forEach(r=>{if(r.actual!=null)actuals[r.week]=r.actual;});setWeightLog(proj.map(r=>({...r,actual:actuals[r.week]??null})));};
  const persistChatHistory=async(history)=>{if(!userId)return;try{await setDoc(doc(db,"users",userId,"claude_chat","conversation"),{history,updatedAt:new Date().toISOString()});}catch(e){}};
  const clearChat=async()=>{setJustChatHistory([]);setChatMessages([]);if(userId)try{await setDoc(doc(db,"users",userId,"claude_chat","conversation"),{history:[],updatedAt:new Date().toISOString()});}catch(e){}};
  const sendChat=async()=>{const text=chatInput.trim();if(!text||chatLoading)return;setChatInput("");setChatLoading(true);const userMsg={id:genId(),type:"user",text};const thinkMsg={id:genId(),type:"claude",text:"…"};setChatMessages(prev=>[...prev,userMsg,thinkMsg]);try{if(chatMealId==="__chat__"){const newHistory=[...justChatHistory,{role:"user",content:text}];const reply=await claudeChat(newHistory.slice(-CHAT_CONTEXT_LIMIT),userRecipes);const updatedHistory=[...newHistory,{role:"assistant",content:reply}].slice(-CHAT_CONTEXT_LIMIT);setJustChatHistory(updatedHistory);await persistChatHistory(updatedHistory);setChatMessages(prev=>prev.map(m=>m.id===thinkMsg.id?{...m,text:reply}:m));}else{const items=await claudeParseFood(text);const mealName=(allDays.find(d=>d.date===chatDate)||currentDayData)?.meals?.find(m=>m.id===chatMealId)?.name||"Meal";setChatMessages(prev=>prev.map(m=>m.id===thinkMsg.id?{...m,type:"preview",items,mealId:chatMealId,mealName,confirmed:false}:m));}}catch(err){setChatMessages(prev=>prev.map(m=>m.id===thinkMsg.id?{...m,type:"error",text:err.message}:m));}setChatLoading(false);};
  const confirmLog=async(msgId)=>{const msg=chatMessages.find(m=>m.id===msgId);if(!msg)return;let day=currentDayData;if(!day||day.date!==chatDate){day=await loadDay(userId,chatDate);if(!day)day={date:chatDate,notes:"",meals:makeMeals()};}const newItems=msg.items.map(i=>({...i,id:genId()}));const updated={...day,meals:day.meals.map(m=>m.id===msg.mealId?{...m,items:[...m.items,...newItems]}:m)};await persistDay(updated);setChatMessages(prev=>prev.map(m=>m.id===msgId?{...m,confirmed:true}:m));};
  const syncPolar=async()=>{if(polarSyncing)return;setPolarSyncing(true);setPolarSyncMsg(null);try{const res=await fetch("/api/polar-sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId})});const data=await res.json();if(!res.ok)throw new Error(data.error||"Sync failed");if(data.newSessions===0){setPolarSyncMsg({ok:true,text:"All up to date."});}else{setPolarSessions(prev=>{const ids=new Set(prev.map(s=>s.id));return[...data.sessions.filter(s=>!ids.has(s.id)&&!s.logged),...prev].sort((a,b)=>(b.start_time||"").localeCompare(a.start_time||""));});setPolarSyncMsg({ok:true,text:`Synced ${data.newSessions} session${data.newSessions!==1?"s":""}.`});}setPolarLastSync(new Date().toISOString());setTimeout(()=>setPolarSyncMsg(null),5000);}catch(err){setPolarSyncMsg({ok:false,text:err.message});setTimeout(()=>setPolarSyncMsg(null),6000);}setPolarSyncing(false);};

  if(loading) return <div style={{ padding:"40px",textAlign:"center",color:C.muted,fontFamily:FONT.sans }}>Loading your log…</div>;

  const TABS=[["log","Daily log"],["compare","Compare"],["add","Add entry"],["weight","Weight"]];

  return (
    <div className="nt-root" style={{ background:C.bg,color:C.text,height:"calc(100vh - 110px)",display:"flex",flexDirection:"column",borderRadius:"10px",overflow:"hidden",border:`0.5px solid ${C.border}` }}>
      <RecipeModal recipe={recipeModal} onClose={()=>setRecipeModal(null)}/>
      <PolarLogModal session={polarLogModal} userId={userId} allDays={allDays} persistDay={persistDay} setCurrentDayData={setCurrentDayData} currentDate={currentDate} setPolarSessions={setPolarSessions} onClose={()=>setPolarLogModal(null)}/>

      {/* Header */}
      <div style={{ background:C.surface,borderBottom:`0.5px solid ${C.border}`,padding:"0 16px",height:"44px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:"7px" }}>
          <div style={{ width:"7px",height:"7px",borderRadius:"50%",background:C.blue }}/>
          <span style={{ fontSize:"13px",fontWeight:"500",color:C.text,letterSpacing:"-0.2px" }}>vaulte</span>
        </div>
        <nav style={{ display:"flex",gap:"2px" }}>
          {TABS.map(([id,label])=>(
            <button key={id} onClick={()=>setActiveTab(id)} style={{ background:activeTab===id?C.bg:"transparent",border:"none",borderRadius:"5px",padding:"5px 10px",cursor:"pointer",fontSize:"12px",fontFamily:FONT.sans,fontWeight:activeTab===id?"500":"400",color:activeTab===id?C.text:C.muted,transition:"all 0.15s" }}>{label}</button>
          ))}
        </nav>
        <div style={{ width:"60px" }}/>
      </div>

      {/* Body */}
      <div style={{ display:"flex",flex:1,overflow:"hidden",position:"relative" }}>
        {/* Sidebar */}
        <div style={{ width:"190px",flexShrink:0,background:C.surface,borderRight:`0.5px solid ${C.border}`,display:"flex",flexDirection:"column",overflow:"hidden" }}>
          <div style={{ flex:1,overflowY:"auto" }}>
            <CalendarSidebar allDays={allDays} currentDate={currentDate} calYear={calYear} calMonth={calMonth} setCalYear={setCalYear} setCalMonth={setCalMonth} switchDay={switchDay}/>
          </div>
          {allDays.length>0&&(()=>{
            const last7=allDays.slice(0,7);
            const avg=Math.round(last7.reduce((s,d)=>s+getDayTotals(d).foodKcal,0)/last7.length);
            const streak=(()=>{let s=0;const today=new Date();for(let i=0;i<30;i++){const dt=new Date(today);dt.setDate(today.getDate()-i);const ds=dt.toISOString().split("T")[0];if(allDays.find(d=>d.date===ds))s++;else break;}return s;})();
            return(
              <div style={{ borderTop:`0.5px solid ${C.border}`,padding:"10px 12px" }}>
                {[["7-day avg",avg?avg.toLocaleString()+" kcal":"—"],["Streak",streak+" days"]].map(([k,v])=>(
                  <div key={k} style={{ display:"flex",justifyContent:"space-between",alignItems:"baseline",padding:"3px 0",fontSize:"11px" }}>
                    <span style={{ color:C.hint }}>{k}</span>
                    <span style={{ fontFamily:FONT.mono,fontWeight:"500",color:C.text }}>{v}</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Tab content */}
        <div style={{ flex:1,overflow:"hidden",display:"flex",flexDirection:"column" }}>
          {activeTab==="log"&&<div style={{ flex:1,overflowY:"auto",padding:"14px 16px",background:C.bg }}><LogTab userId={userId} currentDate={currentDate} currentDayData={currentDayData} allDays={allDays} switchDay={switchDay} userRecipes={userRecipes} setRecipeModal={setRecipeModal} deleteItem={deleteItem} calcSex={calcSex} calcAge={calcAge} calcHeight={calcHeight} calcWeight={calcWeight} calcProtein={calcProtein} calcFatPct={calcFatPct}/></div>}
          {activeTab==="compare"&&<CompareTab compareSlots={compareSlots} setCompareSlots={setCompareSlots} compareData={compareData} setCompareData={setCompareData} allDays={allDays} calcSex={calcSex} calcAge={calcAge} calcHeight={calcHeight} calcWeight={calcWeight} setCalcSex={setCalcSex} setCalcAge={setCalcAge} setCalcHeight={setCalcHeight} setCalcWeight={setCalcWeight} calcProtein={calcProtein} setCalcProtein={setCalcProtein} calcFatPct={calcFatPct} setCalcFatPct={setCalcFatPct}/>}
          {activeTab==="add"&&<AddEntry userId={userId} allDays={allDays} currentDate={currentDate} currentDayData={currentDayData} setCurrentDayData={setCurrentDayData} userRecipes={userRecipes} setUserRecipes={setUserRecipes} addDate={addDate} setAddDate={setAddDate} addMealId={addMealId} setAddMealId={setAddMealId} addMealName={addMealName} setAddMealName={setAddMealName} addItem={addItem} setAddItem={setAddItem} addMsg={addMsg} setAddMsg={setAddMsg} polarConnected={polarConnected} polarSessions={polarSessions} setPolarSessions={setPolarSessions} polarSyncing={polarSyncing} polarLastSync={polarLastSync} polarSyncMsg={polarSyncMsg} syncPolar={syncPolar} setPolarLogModal={setPolarLogModal} persistDay={persistDay} setRecipeModal={setRecipeModal}/>}
          {activeTab==="weight"&&<WeightTracker userId={userId} weightLog={weightLog} setWeightLog={setWeightLog} weightPlanConfig={weightPlanConfig} setWeightPlanConfig={setWeightPlanConfig} editingPlan={editingPlan} setEditingPlan={setEditingPlan} editCfg={editCfg} setEditCfg={setEditCfg} savePlanConfig={savePlanConfig}/>}
        </div>

        <ChatPopup chatOpen={chatOpen} setChatOpen={setChatOpen} chatMessages={chatMessages} setChatMessages={setChatMessages} chatInput={chatInput} setChatInput={setChatInput} chatMealId={chatMealId} setChatMealId={setChatMealId} chatDate={chatDate} setChatDate={setChatDate} chatLoading={chatLoading} justChatHistory={justChatHistory} CHAT_CONTEXT_LIMIT={CHAT_CONTEXT_LIMIT} clearChat={clearChat} sendChat={sendChat} confirmLog={confirmLog} allDays={allDays} currentDayData={currentDayData}/>
      </div>
    </div>
  );
}
