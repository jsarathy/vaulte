// src/NutritionTracker.jsx — main shell: state, routing, Firestore orchestration
import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import { doc, setDoc, getDoc, getDocs, collection } from "firebase/firestore";

import { genId, makeMeals, getDayTotals } from "./constants/helpers";
import { DEFAULT_PLAN_CONFIG, generateWeightProjection } from "./constants/weightPlan";
import { loadAllDays, saveDay, loadDay, loadAllRecipes, seedInitialData } from "./api/firestore";
import { claudeParseFood, claudeChat } from "./api/claude";

import RecipeModal     from "./components/RecipeModal";
import ChatPopup       from "./components/ChatPopup";
import LogTab          from "./tabs/LogTab";
import CompareTab      from "./tabs/CompareTab";
import AddEntry        from "./tabs/AddEntry";
import WeightTracker   from "./tabs/WeightTracker";

// ── Calendar sidebar helper ─────────────────────────────────────────────────
function CalendarSidebar({ allDays, currentDate, calYear, calMonth, setCalYear, setCalMonth, switchDay }) {
  const todayStr = new Date().toISOString().split("T")[0];
  const loggedSet = new Set(allDays.map(d => d.date));
  const loggedKcal = {};
  allDays.forEach(d => { loggedKcal[d.date] = getDayTotals(d).foodKcal; });

  const dows = ["M","T","W","T","F","S","S"];
  let blocks = [];
  for (let offset = -6; offset <= 7; offset++) {
    let m = calMonth + offset, y = calYear;
    while (m < 0)  { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    const label = new Date(y, m, 1).toLocaleString("default", { month:"short", year:"numeric" });
    const firstDow = (new Date(y,m,1).getDay()+6)%7;
    const daysInMonth = new Date(y,m+1,0).getDate();
    let cells = dows.map((d,i) => (
      <div key={"dow"+i} style={{ textAlign:"center", fontSize:"8px", fontWeight:"bold", color:"#6B8CAE", paddingBottom:"2px" }}>{d}</div>
    ));
    for (let i=0;i<firstDow;i++) cells.push(<div key={"bl"+i}/>);
    for (let d=1;d<=daysInMonth;d++) {
      const mm=String(m+1).padStart(2,"0"), dd=String(d).padStart(2,"0");
      const dateStr=`${y}-${mm}-${dd}`;
      const isLogged=loggedSet.has(dateStr);
      const isActive=dateStr===currentDate;
      const isToday=dateStr===todayStr;
      const kcal=loggedKcal[dateStr];
      cells.push(
        <div key={dateStr} onClick={()=>switchDay(dateStr)}
          style={{ textAlign:"center", fontSize:"10px", padding:"3px 1px", borderRadius:"4px", cursor:"pointer", lineHeight:"1.2",
            background:isActive?"#1F4E79":isLogged?"#2E75B6":"transparent",
            color:isLogged||isActive?"#fff":isToday?"#2E75B6":"#1a2a3a",
            fontWeight:isLogged||isToday?"bold":"normal",
            outline:isActive?"2px solid #F57F17":"none", outlineOffset:"1px" }}>
          {d}
          {kcal?<span style={{ fontSize:"6px", display:"block", opacity:0.85 }}>{Math.round(kcal)}</span>:null}
        </div>
      );
    }
    blocks.push(
      <div key={`${y}-${m}`} style={{ padding:"4px 6px 2px" }}>
        <div style={{ fontSize:"10px", fontWeight:"bold", color:"#1F4E79", textAlign:"center",
          padding:"3px 0", borderBottom:"1px solid #D6E4F0", marginBottom:"2px",
          background:m===calMonth&&y===calYear?"#EBF3FB":"transparent", borderRadius:"3px 3px 0 0" }}>{label}</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"1px" }}>{cells}</div>
      </div>
    );
  }
  return <>{blocks}</>;
}

// ── PolarLogModal ─────────────────────────────────────────────────────────
function PolarLogModal({ session, userId, allDays, addMealId, setAddMealId, persistDay, setCurrentDayData, currentDate, setPolarSessions, onClose }) {
  if (!session) return null;
  const s = session;
  const sport = s.sport?s.sport.replace(/_/g," ").toLowerCase().replace(/\w/g,c=>c.toUpperCase()):"Exercise";
  const d = s.start_time?new Date(s.start_time):null;
  const dateStr = d?d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"}):(s.date||"");
  const timeStr = d?d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):"";
  const sessionDate = s.start_time?s.start_time.split("T")[0]:(s.date||new Date().toISOString().split("T")[0]);
  const DEFAULT_MEAL_SLOTS = [
    { name:"☕ Breakfast",is_exercise:0 },{ name:"🏋️ Morning Exercise",is_exercise:1 },
    { name:"🥤 Post-Workout",is_exercise:0 },{ name:"🥗 Lunch",is_exercise:0 },
    { name:"🍎 Snack",is_exercise:0 },{ name:"🌙 Dinner",is_exercise:0 },
  ];
  return (
    <div onClick={e=>e.target===e.currentTarget&&onClose()}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:3000, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:"#fff", borderRadius:"12px", width:"420px", maxWidth:"95vw", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>
        <div style={{ background:"#D94032", color:"#fff", padding:"14px 18px", borderRadius:"12px 12px 0 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ fontWeight:"bold", fontSize:"15px" }}>📡 Log Polar Session</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"#fff", fontSize:"22px", cursor:"pointer", lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:"18px" }}>
          <div style={{ fontWeight:"bold", fontSize:"16px", color:"#1F4E79", marginBottom:"4px" }}>{sport}</div>
          <div style={{ fontSize:"12px", color:"#6B8CAE", marginBottom:"14px" }}>{dateStr}{timeStr?` at ${timeStr}`:""}</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px", marginBottom:"16px" }}>
            {[["⏱ Duration",`${Math.round(s.duration_min||0)} min`],["🔥 Calories",`${s.calories} kcal`],
              s.hr_avg?["❤️ Avg HR",`${s.hr_avg} bpm`]:null,
              s.hr_max?["❤️ Max HR",`${s.hr_max} bpm`]:null,
              s.fat_pct!=null?["🧈 Fat Burn",`${s.fat_pct}%`]:null,
              s.fat_pct!=null?["🧈 Fat Burned",`${Math.round(s.calories*s.fat_pct/100/9)}g`]:null,
            ].filter(Boolean).map(([label,val])=>(
              <div key={label} style={{ background:"#F0F4F8", borderRadius:"6px", padding:"8px 10px", border:"1px solid #DDEAF6" }}>
                <div style={{ fontSize:"10px", color:"#6B8CAE", marginBottom:"2px" }}>{label}</div>
                <div style={{ fontWeight:"bold", fontSize:"13px", color:"#1F4E79" }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ marginBottom:"12px" }}>
            <div style={{ fontSize:"10px", color:"#6B8CAE", textTransform:"uppercase", marginBottom:"4px" }}>Log to meal slot</div>
            <select value={addMealId} onChange={e=>setAddMealId(e.target.value)}
              style={{ width:"100%", padding:"7px 10px", border:"1px solid #DDEAF6", borderRadius:"6px", fontSize:"12px" }}>
              <option value="">— select slot —</option>
              {(()=>{
                const existing = allDays.find(d=>d.date===sessionDate);
                const meals = existing?existing.meals:DEFAULT_MEAL_SLOTS;
                return meals.map((m,i)=><option key={m.id||i} value={m.id||("__slot__"+m.name)}>{m.name}</option>);
              })()}
            </select>
          </div>
          <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end" }}>
            <button onClick={onClose}
              style={{ background:"transparent", border:"1px solid #DDEAF6", color:"#6B8CAE", borderRadius:"6px", padding:"8px 16px", cursor:"pointer", fontSize:"13px" }}>Cancel</button>
            <button onClick={async()=>{
              let day = allDays.find(d=>d.date===sessionDate)||await loadDay(userId,sessionDate);
              if (!day) day = {date:sessionDate,notes:"",meals:makeMeals()};
              let targetMealId = addMealId;
              if (targetMealId?.startsWith("__slot__")) {
                const match = day.meals.find(m=>m.name===targetMealId.replace("__slot__",""));
                targetMealId = match?.id||null;
              }
              if (!targetMealId) return;
              const fatGrams = s.fat_pct!=null?Math.round(s.calories*s.fat_pct/100/9):0;
              const fatKcal  = s.fat_pct!=null?Math.round(s.calories*s.fat_pct/100):0;
              const item = { id:genId(), name:`${sport} (${Math.round(s.duration_min||0)} min) · Polar`,
                kcal:-s.calories, fat:0, sat_fat:0, carbs:0, sugar:0, fibre:0, net_carbs:0, protein:0,
                is_exercise:1, fat_burned_g:fatGrams, fat_burned_kcal:fatKcal, polar_session_id:s.id };
              const updated = {...day, meals:day.meals.map(m=>m.id===targetMealId?{...m,items:[...m.items,item]}:m)};
              await persistDay(updated);
              if (sessionDate===currentDate) setCurrentDayData(updated);
              await setDoc(doc(db,"users",userId,"polar_sessions",s.id),{...s,logged:true});
              setPolarSessions(prev=>prev.filter(ps=>ps.id!==s.id));
              onClose();
            }} style={{ background:"#D94032", color:"#fff", border:"none", borderRadius:"6px", padding:"8px 20px", cursor:"pointer", fontSize:"13px", fontWeight:"bold" }}>
              ✓ Log Session
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function NutritionTracker({ userId }) {
  // ── Core state ──
  const [allDays, setAllDays] = useState([]);
  const [currentDate, setCurrentDate] = useState(null);
  const [currentDayData, setCurrentDayData] = useState(null);
  const [activeTab, setActiveTab] = useState("log");
  const [loading, setLoading] = useState(true);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  // ── Recipe state ──
  const [recipeModal, setRecipeModal] = useState(null);
  const [userRecipes, setUserRecipes] = useState([]);

  // ── Polar state ──
  const [polarConnected, setPolarConnected] = useState(false);
  const [polarSessions, setPolarSessions] = useState([]);
  const [polarSyncing, setPolarSyncing] = useState(false);
  const [polarLastSync, setPolarLastSync] = useState(null);
  const [polarSyncMsg, setPolarSyncMsg] = useState(null);
  const [polarLogModal, setPolarLogModal] = useState(null);

  // ── Weight state ──
  const [weightLog, setWeightLog] = useState([]);
  const [weightPlanConfig, setWeightPlanConfig] = useState(DEFAULT_PLAN_CONFIG);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editCfg, setEditCfg] = useState(DEFAULT_PLAN_CONFIG);

  // ── Chat state ──
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatMealId, setChatMealId] = useState("__chat__");
  const [chatDate, setChatDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [chatLoading, setChatLoading] = useState(false);
  const [justChatHistory, setJustChatHistory] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const CHAT_CONTEXT_LIMIT = 30;

  // ── Add entry state ──
  const [addDate, setAddDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [addMealId, setAddMealId] = useState("");
  const [addMealName, setAddMealName] = useState("");
  const [addItem, setAddItem] = useState({ name:"", kcal:"", fat:"", sat_fat:"", carbs:"", sugar:"", fibre:"", net_carbs:"", protein:"" });
  const [addMsg, setAddMsg] = useState(null);

  // ── Compare state ──
  const [compareSlots, setCompareSlots] = useState([null,null,null,null,null]);
  const [compareData, setCompareData] = useState([null,null,null,null,null]);

  // ── Calc state ──
  const [calcSex, setCalcSex] = useState("m");
  const [calcAge, setCalcAge] = useState(60);
  const [calcHeight, setCalcHeight] = useState(165);
  const [calcWeight, setCalcWeight] = useState(84);
  const [calcProtein, setCalcProtein] = useState(1.4);
  const [calcFatPct, setCalcFatPct] = useState(30);

  // ── Init load ──
  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    (async () => {
      try {
        setLoading(true);
        let days = await loadAllDays(userId);
        if (days.length === 0) days = await seedInitialData(userId);
        const recipes = await loadAllRecipes(userId);
        setUserRecipes(recipes);

        const cfgDoc = await getDoc(doc(db, "users", userId, "weight_plan", "settings"));
        const cfg = cfgDoc.exists() ? { ...DEFAULT_PLAN_CONFIG, ...cfgDoc.data() } : DEFAULT_PLAN_CONFIG;
        setWeightPlanConfig(cfg);
        setEditCfg(cfg);

        const proj = generateWeightProjection(cfg);
        const wSnap = await getDocs(collection(db, "users", userId, "weight_log"));
        if (wSnap.empty) {
          const seed = proj.map(r => ({ ...r, actual: r.week===1?cfg.startWeightKg:null }));
          await setDoc(doc(db,"users",userId,"weight_log","1"), seed[0]);
          setWeightLog(seed);
        } else {
          const actuals = {};
          wSnap.docs.forEach(d => { const data=d.data(); if(data.actual!=null) actuals[d.id]=data.actual; });
          setWeightLog(proj.map(r => ({ ...r, actual:actuals[String(r.week)]??null })));
        }

        try {
          const chatDoc = await getDoc(doc(db,"users",userId,"claude_chat","conversation"));
          if (chatDoc.exists()) {
            const { history } = chatDoc.data();
            if (Array.isArray(history)&&history.length>0) {
              setJustChatHistory(history);
              setChatMessages(history.map(h => ({ id:genId(), type:h.role==="user"?"user":"claude", text:h.content })));
            }
          }
        } catch(e) { console.warn("Chat history load failed:", e); }

        const polarDoc = await getDoc(doc(db,"users",userId,"polar","connection"));
        if (polarDoc.exists()) {
          const pd = polarDoc.data();
          setPolarConnected(pd.connected||false);
          setPolarLastSync(pd.last_sync_at||null);
        }
        const polarSnap = await getDocs(collection(db,"users",userId,"polar_sessions"));
        const sessions = polarSnap.docs.map(d=>({id:d.id,...d.data()}))
          .filter(s=>!s.logged)
          .sort((a,b)=>(b.start_time||"").localeCompare(a.start_time||""));
        setPolarSessions(sessions);

        setAllDays(days);
        if (days.length > 0) {
          const first = days[0];
          setCurrentDate(first.date);
          setCurrentDayData(first);
          setChatDate(first.date);
          const slots = days.slice(0,5).map(d=>d.date);
          setCompareSlots([...slots,...Array(5-slots.length).fill(null)].slice(0,5));
          setCompareData(days.slice(0,5).concat(Array(5).fill(null)).slice(0,5));
        }
      } catch(err) { console.error("Init error:", err); }
      finally { setLoading(false); }
    })();
  }, [userId]);

  // ── Polar OAuth redirect detection ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const polarParam = params.get("polar");
    if (polarParam === "connected") {
      (async () => {
        const polarDoc = await getDoc(doc(db,"users",userId,"polar","connection"));
        if (polarDoc.exists()) {
          const pd = polarDoc.data();
          setPolarConnected(pd.connected||false);
          setPolarLastSync(pd.last_sync_at||null);
        }
      })();
      window.history.replaceState({},""," window.location.pathname");
      setPolarSyncMsg({ok:true, text:"✅ Polar account connected! Click Sync to pull your sessions."});
      setTimeout(()=>setPolarSyncMsg(null), 6000);
    } else if (polarParam==="denied"||polarParam==="error") {
      window.history.replaceState({},"",window.location.pathname);
      if (polarParam==="error") { setPolarSyncMsg({ok:false,text:"❌ Polar connection failed."}); setTimeout(()=>setPolarSyncMsg(null),6000); }
    }
  }, [userId]);

  // ── Shared day helpers ──
  const switchDay = async (date) => {
    setCurrentDate(date);
    let data = allDays.find(d=>d.date===date)||null;
    if (!data) data = await loadDay(userId, date);
    setCurrentDayData(data);
    setChatDate(date);
    setChatMealId("__chat__");
  };

  const persistDay = async (dayData) => {
    await saveDay(userId, dayData);
    setAllDays(prev => {
      const filtered = prev.filter(d=>d.date!==dayData.date);
      return [dayData,...filtered].sort((a,b)=>b.date.localeCompare(a.date));
    });
    setCurrentDayData(dayData);
  };

  const deleteItem = async (mealId, itemId) => {
    if (!currentDayData) return;
    const updated = {...currentDayData, meals:currentDayData.meals.map(m=>
      m.id===mealId?{...m,items:m.items.filter(i=>i.id!==itemId)}:m
    )};
    await persistDay(updated);
  };

  const savePlanConfig = async (cfg) => {
    setWeightPlanConfig(cfg); setEditCfg(cfg); setEditingPlan(false);
    try { await setDoc(doc(db,"users",userId,"weight_plan","settings"), cfg); }
    catch(e) { console.warn("Plan config save failed:", e); }
    const proj = generateWeightProjection(cfg);
    const actuals = {};
    weightLog.forEach(r=>{ if(r.actual!=null) actuals[r.week]=r.actual; });
    setWeightLog(proj.map(r=>({...r,actual:actuals[r.week]??null})));
  };

  // ── Chat helpers ──
  const persistChatHistory = async (history) => {
    if (!userId) return;
    try { await setDoc(doc(db,"users",userId,"claude_chat","conversation"),{history,updatedAt:new Date().toISOString()}); }
    catch(e) { console.warn("Chat save failed:", e); }
  };

  const clearChat = async () => {
    setJustChatHistory([]); setChatMessages([]);
    if (userId) {
      try { await setDoc(doc(db,"users",userId,"claude_chat","conversation"),{history:[],updatedAt:new Date().toISOString()}); }
      catch(e) {}
    }
  };

  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text||chatLoading) return;
    setChatInput(""); setChatLoading(true);
    const userMsg = {id:genId(),type:"user",text};
    const thinkMsg = {id:genId(),type:"claude",text:"⏳ Thinking…"};
    setChatMessages(prev=>[...prev,userMsg,thinkMsg]);
    try {
      if (chatMealId==="__chat__") {
        const newHistory = [...justChatHistory,{role:"user",content:text}];
        const contextHistory = newHistory.slice(-CHAT_CONTEXT_LIMIT);
        const reply = await claudeChat(contextHistory);
        const updatedHistory = [...newHistory,{role:"assistant",content:reply}].slice(-CHAT_CONTEXT_LIMIT);
        setJustChatHistory(updatedHistory);
        await persistChatHistory(updatedHistory);
        setChatMessages(prev=>prev.map(m=>m.id===thinkMsg.id?{...m,text:reply}:m));
      } else {
        const items = await claudeParseFood(text);
        const mealName = (allDays.find(d=>d.date===chatDate)||currentDayData)?.meals?.find(m=>m.id===chatMealId)?.name||"Meal";
        setChatMessages(prev=>prev.map(m=>m.id===thinkMsg.id?{...m,type:"preview",items,mealId:chatMealId,mealName,confirmed:false}:m));
      }
    } catch(err) {
      setChatMessages(prev=>prev.map(m=>m.id===thinkMsg.id?{...m,type:"error",text:"❌ "+err.message}:m));
    }
    setChatLoading(false);
  };

  const confirmLog = async (msgId) => {
    const msg = chatMessages.find(m=>m.id===msgId);
    if (!msg) return;
    let day = currentDayData;
    if (!day||day.date!==chatDate) {
      day = await loadDay(userId, chatDate);
      if (!day) day = {date:chatDate,notes:"",meals:makeMeals()};
    }
    const newItems = msg.items.map(i=>({...i,id:genId()}));
    const updated = {...day, meals:day.meals.map(m=>m.id===msg.mealId?{...m,items:[...m.items,...newItems]}:m)};
    await persistDay(updated);
    setChatMessages(prev=>prev.map(m=>m.id===msgId?{...m,confirmed:true}:m));
  };

  // ── Polar sync ──
  const syncPolar = async () => {
    if (polarSyncing) return;
    setPolarSyncing(true); setPolarSyncMsg(null);
    try {
      const res = await fetch("/api/polar-sync",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId})});
      const data = await res.json();
      if (!res.ok) throw new Error(data.error||"Sync failed");
      if (data.newSessions===0) {
        setPolarSyncMsg({ok:true,text:"✓ All up to date — no new sessions from Polar."});
      } else {
        setPolarSessions(prev=>{
          const existingIds = new Set(prev.map(s=>s.id));
          const newOnes = data.sessions.filter(s=>!existingIds.has(s.id)&&!s.logged);
          return [...newOnes,...prev].sort((a,b)=>(b.start_time||"").localeCompare(a.start_time||""));
        });
        setPolarSyncMsg({ok:true,text:`✅ Synced ${data.newSessions} new session${data.newSessions!==1?"s":""}!`});
      }
      setPolarLastSync(new Date().toISOString());
      setTimeout(()=>setPolarSyncMsg(null),5000);
    } catch(err) {
      setPolarSyncMsg({ok:false,text:`❌ ${err.message}`});
      setTimeout(()=>setPolarSyncMsg(null),6000);
    }
    setPolarSyncing(false);
  };

  // ── Styles ──
  const S = {
    wrap:{ fontFamily:"Arial,sans-serif", background:"#F0F4F8", color:"#1a2a3a", fontSize:"14px", height:"calc(100vh - 110px)", display:"flex", flexDirection:"column", borderRadius:"12px", overflow:"hidden", boxShadow:"0 4px 24px rgba(0,0,0,0.2)" },
    header:{ background:"#1F4E79", color:"#fff", padding:"0 20px", display:"flex", alignItems:"center", justifyContent:"space-between", height:"48px", flexShrink:0 },
    body:{ display:"flex", flex:1, overflow:"hidden", position:"relative" },
    sidebar:{ width:"230px", flexShrink:0, background:"#fff", borderRight:"1px solid #DDEAF6", display:"flex", flexDirection:"column", overflow:"hidden" },
    sidebarHead:{ background:"#1F4E79", color:"#fff", padding:"10px 14px", fontWeight:"bold", fontSize:"12px" },
    main:{ flex:1, overflowY:"auto", padding:"16px", background:"#F0F4F8" },
    btn:(variant) => ({
      primary:{ background:"#2E75B6", color:"#fff", border:"none", borderRadius:"4px", padding:"7px 13px", cursor:"pointer", fontSize:"12px", fontWeight:"bold" },
      success:{ background:"#2E7D32", color:"#fff", border:"none", borderRadius:"4px", padding:"7px 13px", cursor:"pointer", fontSize:"12px", fontWeight:"bold" },
      outline:{ background:"transparent", color:"#2E75B6", border:"1px solid #2E75B6", borderRadius:"4px", padding:"7px 13px", cursor:"pointer", fontSize:"12px", fontWeight:"bold" },
      sm:{ padding:"3px 9px", fontSize:"11px" },
    }[variant]||{}),
  };

  if (loading) return <div style={{ padding:"40px", textAlign:"center", color:"#6B8CAE" }}>Loading your nutrition log…</div>;

  return (
    <div style={S.wrap}>
      <RecipeModal recipe={recipeModal} onClose={()=>setRecipeModal(null)}/>
      <PolarLogModal
        session={polarLogModal}
        userId={userId}
        allDays={allDays}
        addMealId={addMealId}
        setAddMealId={setAddMealId}
        persistDay={persistDay}
        setCurrentDayData={setCurrentDayData}
        currentDate={currentDate}
        setPolarSessions={setPolarSessions}
        onClose={()=>setPolarLogModal(null)}
      />

      {/* Header */}
      <div style={S.header}>
        <span style={{ fontSize:"16px", fontWeight:"bold" }}>🥗 Nutrition Tracker</span>
        <div style={{ display:"flex", gap:"4px" }}>
          {[["log","Daily Log"],["compare","Compare"],["add","Add Entry"],["weight","⚖️ Weight"]].map(([id,label]) => (
            <button key={id} onClick={()=>setActiveTab(id)}
              style={{ background:activeTab===id?"#2E75B6":"transparent", border:"1px solid rgba(255,255,255,0.3)", color:"#fff", padding:"5px 12px", borderRadius:"4px", cursor:"pointer", fontSize:"12px", transition:"background 0.2s" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={S.body}>
        {/* Sidebar */}
        <div style={S.sidebar}>
          <div style={S.sidebarHead}>📅 Calendar</div>
          <div style={{ flex:1, overflowY:"auto", padding:"0" }}>
            <CalendarSidebar
              allDays={allDays}
              currentDate={currentDate}
              calYear={calYear} calMonth={calMonth}
              setCalYear={setCalYear} setCalMonth={setCalMonth}
              switchDay={switchDay}
            />
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "log" && (
          <div style={S.main}>
            <LogTab
              currentDate={currentDate}
              currentDayData={currentDayData}
              allDays={allDays}
              switchDay={switchDay}
              userRecipes={userRecipes}
              setRecipeModal={setRecipeModal}
              deleteItem={deleteItem}
              calcSex={calcSex} calcAge={calcAge} calcHeight={calcHeight}
              calcWeight={calcWeight} calcProtein={calcProtein} calcFatPct={calcFatPct}
            />
          </div>
        )}

        {activeTab === "compare" && (
          <CompareTab
            compareSlots={compareSlots} setCompareSlots={setCompareSlots}
            compareData={compareData} setCompareData={setCompareData}
            allDays={allDays}
            calcSex={calcSex} calcAge={calcAge} calcHeight={calcHeight} calcWeight={calcWeight}
            setCalcSex={setCalcSex} setCalcAge={setCalcAge} setCalcHeight={setCalcHeight} setCalcWeight={setCalcWeight}
            calcProtein={calcProtein} setCalcProtein={setCalcProtein}
            calcFatPct={calcFatPct} setCalcFatPct={setCalcFatPct}
          />
        )}

        {activeTab === "add" && (
          <AddEntry
            userId={userId}
            allDays={allDays}
            currentDate={currentDate}
            currentDayData={currentDayData}
            setCurrentDayData={setCurrentDayData}
            userRecipes={userRecipes}
            setUserRecipes={setUserRecipes}
            addDate={addDate} setAddDate={setAddDate}
            addMealId={addMealId} setAddMealId={setAddMealId}
            addMealName={addMealName} setAddMealName={setAddMealName}
            addItem={addItem} setAddItem={setAddItem}
            addMsg={addMsg} setAddMsg={setAddMsg}
            polarConnected={polarConnected}
            polarSessions={polarSessions} setPolarSessions={setPolarSessions}
            polarSyncing={polarSyncing}
            polarLastSync={polarLastSync}
            polarSyncMsg={polarSyncMsg}
            syncPolar={syncPolar}
            setPolarLogModal={setPolarLogModal}
            persistDay={persistDay}
            setRecipeModal={setRecipeModal}
            S={S}
          />
        )}

        {activeTab === "weight" && (
          <WeightTracker
            userId={userId}
            weightLog={weightLog} setWeightLog={setWeightLog}
            weightPlanConfig={weightPlanConfig} setWeightPlanConfig={setWeightPlanConfig}
            editingPlan={editingPlan} setEditingPlan={setEditingPlan}
            editCfg={editCfg} setEditCfg={setEditCfg}
            savePlanConfig={savePlanConfig}
          />
        )}

        {/* Floating chat popup */}
        <ChatPopup
          chatOpen={chatOpen} setChatOpen={setChatOpen}
          chatMessages={chatMessages} setChatMessages={setChatMessages}
          chatInput={chatInput} setChatInput={setChatInput}
          chatMealId={chatMealId} setChatMealId={setChatMealId}
          chatDate={chatDate} setChatDate={setChatDate}
          chatLoading={chatLoading}
          justChatHistory={justChatHistory}
          CHAT_CONTEXT_LIMIT={CHAT_CONTEXT_LIMIT}
          clearChat={clearChat}
          sendChat={sendChat}
          confirmLog={confirmLog}
          allDays={allDays}
          currentDayData={currentDayData}
          S={S}
        />
      </div>
    </div>
  );
}
