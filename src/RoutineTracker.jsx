// src/RoutineTracker.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import { doc, getDoc, setDoc, getDocs, collection } from "firebase/firestore";
import { C, FONT, border } from "./constants/design.jsx";
import { IconChevronLeft, IconChevronRight } from "./constants/design.jsx";

// ── Task definitions ──────────────────────────────────────────────────────────
const ROUTINE_TASKS = [
  { id:"coffee",       name:"Coffee",              time:"07:30" },
  { id:"morning",      name:"Morning",             time:"10:00" },
  { id:"garden",       name:"Gardening / Chores",  time:"12:00" },
  { id:"lunch",        name:"Lunch",               time:"14:00" },
  { id:"post_lunch",   name:"Post-Lunch",          time:"17:00" },
  { id:"dinner",       name:"Dinner",              time:"20:00" },
  { id:"late_evening", name:"Late-Evening",        time:"22:00" },
];

const MEDS_TASKS = [
  { id:"thyronorm",    name:"Thyronorm",                   time:null    },
  { id:"esomeprazole", name:"Esomeprazole",                time:"11:45" },
  { id:"probiotic",    name:"Probiotic / Vits / Aspirin",  time:null    },
  { id:"pregastar",    name:"Pregastar",                   time:"19:00" },
  { id:"statin",       name:"Statin / Allergy Med",        time:"21:45" },
  { id:"vit_d",        name:"Vit D",                       time:null, sunday:true },
];

// Combined list — used for keyboard navigation, stats, and shared lookups.
const TASKS = [...ROUTINE_TASKS, ...MEDS_TASKS];

// ── Date helpers ──────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];

function getLast7Days(anchor) {
  const days = [];
  const end = new Date(anchor + "T12:00:00");
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

function fmtColHeader(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-GB", { weekday:"short", day:"numeric", month:"short" });
}

function isSunday(dateStr) {
  return new Date(dateStr + "T12:00:00").getDay() === 0;
}

// ── Calendar sidebar ──────────────────────────────────────────────────────────
function CalendarSidebar({ loggedDates, anchor, setAnchor, calYear, calMonth, setCalYear, setCalMonth }) {
  const today = todayStr();
  const dows = ["M","T","W","T","F","S","S"];
  const label = new Date(calYear, calMonth, 1).toLocaleString("default", { month:"long", year:"numeric" });
  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const prevMonth = () => { if (calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); };
  const nextMonth = () => { if (calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); };

  const cells = [];
  for (let i=0;i<firstDow;i++) cells.push(<div key={"b"+i}/>);
  for (let d=1;d<=daysInMonth;d++) {
    const mm=String(calMonth+1).padStart(2,"0"), dd=String(d).padStart(2,"0");
    const ds=`${calYear}-${mm}-${dd}`;
    const isAnchor=ds===anchor, isToday=ds===today, hasLog=loggedDates.has(ds);
    cells.push(
      <div key={ds} onClick={()=>setAnchor(ds)}
        style={{ textAlign:"center",fontSize:"11px",padding:"4px 1px",borderRadius:"4px",cursor:"pointer",
          fontFamily:FONT.mono,lineHeight:1.2,
          background:isAnchor?C.blue:hasLog?C.greenBg:"transparent",
          color:isAnchor?"#fff":hasLog?C.greenText:isToday?C.blue:C.muted,
          fontWeight:isAnchor||hasLog?"500":"400",
          outline:isToday&&!isAnchor?`1px solid ${C.blue}`:"none",outlineOffset:"-1px" }}>
        {d}
      </div>
    );
  }

  return (
    <div style={{ padding:"12px 10px" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"8px" }}>
        <button onClick={prevMonth} style={{ background:"transparent",border:"none",cursor:"pointer",color:C.muted,display:"flex",alignItems:"center" }}><IconChevronLeft size={12}/></button>
        <span style={{ fontSize:"11px",fontWeight:"500",color:C.text }}>{label}</span>
        <button onClick={nextMonth} style={{ background:"transparent",border:"none",cursor:"pointer",color:C.muted,display:"flex",alignItems:"center" }}><IconChevronRight size={12}/></button>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"1px",marginBottom:"3px" }}>
        {dows.map((d,i)=><div key={i} style={{ textAlign:"center",fontSize:"9px",fontWeight:"500",color:C.hint,paddingBottom:"3px" }}>{d}</div>)}
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:"1px" }}>{cells}</div>
    </div>
  );
}

// ── Time Picker Modal ─────────────────────────────────────────────────────────
function TimePicker({ initialTime, onConfirm, onCancel }) {
  const [h, setH] = useState(() => {
    if (initialTime) return parseInt(initialTime.split(":")[0], 10);
    return new Date().getHours();
  });
  const [m, setM] = useState(() => {
    if (initialTime) return parseInt(initialTime.split(":")[1], 10);
    return 0;
  });
  const [activeField, setActiveField] = useState("h");
  const hourRef = useRef(null);
  const minRef = useRef(null);

  useEffect(() => { hourRef.current?.focus(); }, []);

  const clampH = v => Math.max(0, Math.min(23, v));
  const clampM = v => Math.max(0, Math.min(59, v));

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Escape") { onCancel(); return; }
    if (e.key === "Enter") { onConfirm(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`); return; }
    if (activeField === "h") {
      if (e.key === "ArrowUp")   { e.preventDefault(); setH(v => clampH(v+1)); }
      if (e.key === "ArrowDown") { e.preventDefault(); setH(v => clampH(v-1)); }
      if (e.key === "ArrowRight" || e.key === "Tab") { e.preventDefault(); setActiveField("m"); minRef.current?.focus(); }
    } else {
      if (e.key === "ArrowUp")   { e.preventDefault(); setM(v => clampM(v+1)); }
      if (e.key === "ArrowDown") { e.preventDefault(); setM(v => clampM(v-1)); }
      if (e.key === "ArrowLeft") { e.preventDefault(); setActiveField("h"); hourRef.current?.focus(); }
    }
  };

  const digitStyle = (active) => ({
    fontFamily: FONT.mono, fontSize:"36px", fontWeight:"500", letterSpacing:"-1px",
    color: active ? C.blue : C.text,
    background: active ? C.blueBg : C.bg,
    border: `1.5px solid ${active ? C.blue : C.border}`,
    borderRadius:"8px", padding:"10px 14px", minWidth:"64px", textAlign:"center",
    cursor:"pointer", outline:"none",
    userSelect:"none",
  });

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:4000,display:"flex",alignItems:"center",justifyContent:"center" }}
      onClick={e=>e.target===e.currentTarget&&onCancel()}>
      <div style={{ background:"#fff",borderRadius:"12px",padding:"24px 28px",border:`0.5px solid ${C.border}`,boxShadow:"0 8px 32px rgba(0,0,0,0.12)",fontFamily:FONT.sans }} onKeyDown={handleKeyDown}>
        <div style={{ fontSize:"11px",color:C.hint,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:"16px",textAlign:"center" }}>
          Enter time · ↑↓ adjust · → next · Enter confirm
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:"8px",justifyContent:"center",marginBottom:"20px" }}>
          <div ref={hourRef} tabIndex={0} style={digitStyle(activeField==="h")}
            onClick={()=>{setActiveField("h");hourRef.current?.focus();}}>
            {String(h).padStart(2,"0")}
          </div>
          <span style={{ fontFamily:FONT.mono,fontSize:"32px",fontWeight:"500",color:C.muted,lineHeight:1 }}>:</span>
          <div ref={minRef} tabIndex={0} style={digitStyle(activeField==="m")}
            onClick={()=>{setActiveField("m");minRef.current?.focus();}}>
            {String(m).padStart(2,"0")}
          </div>
        </div>
        <div style={{ display:"flex",gap:"6px",justifyContent:"center" }}>
          <button onClick={onCancel}
            style={{ background:"transparent",border:`0.5px solid ${C.borderMid}`,color:C.muted,borderRadius:"6px",padding:"7px 16px",cursor:"pointer",fontSize:"12px",fontFamily:FONT.sans }}>
            Cancel
          </button>
          <button onClick={()=>onConfirm(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`)}
            style={{ background:C.blue,color:"#fff",border:"none",borderRadius:"6px",padding:"7px 18px",cursor:"pointer",fontSize:"12px",fontWeight:"500",fontFamily:FONT.sans }}>
            Set time
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RoutineTracker({ userId }) {
  const today = todayStr();
  const [anchor, setAnchor] = useState(today);
  const [log, setLog] = useState({});       // { date: { taskId: { done, time? } } }
  const [loading, setLoading] = useState(true);
  const [focusedCell, setFocusedCell] = useState(null); // "taskId|date"
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const gridRef = useRef(null);
  const logRef = useRef({});

  const days = getLast7Days(anchor);

  // ── Load log for visible 7 days ──
  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    Promise.all(
      days.map(date =>
        getDoc(doc(db, "users", userId, "routine_log", date))
          .then(snap => ({ date, entries: snap.exists() ? snap.data().entries || {} : {} }))
      )
    ).then(results => {
      const merged = {};
      results.forEach(({ date, entries }) => { merged[date] = entries; });
      setLog(prev => ({ ...prev, ...merged }));
      setLoading(false);
    }).catch(e => { console.error("Routine load error:", e); setLoading(false); });
  }, [anchor, userId]);

  // ── Keep a live mirror of log for blur-time saves ──
  useEffect(() => { logRef.current = log; }, [log]);

  // ── Persist a day's entries to Firestore (called on blur) ──
  const persistDay = useCallback(async (date) => {
    try {
      await setDoc(doc(db, "users", userId, "routine_log", date), {
        entries: logRef.current[date] || {},
        date,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) { console.error("Routine save error:", e); }
  }, [userId]);

  // ── Update a cell's text locally (persisted on blur) ──
  const updateCellText = (date, taskId, text) => {
    setLog(prev => ({ ...prev, [date]: { ...prev[date], [taskId]: { text } } }));
  };

  // A slot counts as filled if it has text (or a legacy "done" check).
  const hasText = (e) => !!(e && ((typeof e.text === "string" && e.text.trim()) || e.done));

  // ── Cell renderer — free-text box for what you actually did ──
  const renderCell = (task, date) => {
    if (task.sunday && !isSunday(date)) {
      return <div style={{ display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:C.border,fontSize:"14px" }}>—</div>;
    }
    const cellKey = `${task.id}|${date}`;
    const value = log[date]?.[task.id]?.text || "";
    return (
      <textarea
        data-cell={cellKey}
        value={value}
        onChange={(e) => updateCellText(date, task.id, e.target.value)}
        onFocus={() => setFocusedCell(cellKey)}
        onBlur={() => { setFocusedCell(prev => prev === cellKey ? null : prev); persistDay(date); }}
        style={{
          width:"100%", height:"100%", minHeight:"56px", boxSizing:"border-box",
          border:"none", outline:"none", resize:"none", background:"transparent",
          padding:"8px 10px", fontFamily:FONT.sans, fontSize:"14px", lineHeight:"1.45",
          color:C.text, display:"block",
        }}
      />
    );
  };

  // ── Completion stats for today ──
  const todayLog = log[today] || {};
  const todayApplicable = TASKS.filter(t => !t.sunday || isSunday(today));
  const todayDone = todayApplicable.filter(t => hasText(todayLog[t.id])).length;

  const loggedDates = new Set(
    Object.entries(log).filter(([_, entries]) => Object.values(entries).some(e => hasText(e))).map(([d]) => d)
  );

  if (loading) return <div style={{ padding:"40px",textAlign:"center",color:C.muted,fontFamily:FONT.sans }}>Loading routine…</div>;

  const COL_TASK = "180px", COL_TIME = "52px", COL_DAY = "1fr";

  const renderTable = (taskList, showHead = true) => {
    const rowH = `${(100 / taskList.length).toFixed(4)}%`;
    return (
    <table style={{ borderCollapse:"collapse",minWidth:"700px",width:"100%",height:"100%",tableLayout:"fixed" }}>
      <colgroup>
        <col style={{ width:COL_TASK }}/>
        <col style={{ width:COL_TIME }}/>
        {days.map(d => <col key={d} style={{ width:COL_DAY }}/>)}
      </colgroup>
      {showHead && (
        <thead>
          <tr style={{ background:C.bg,position:"sticky",top:0,zIndex:10 }}>
            <th style={{ padding:"8px 12px",textAlign:"left",fontSize:"13px",fontWeight:"500",textTransform:"uppercase",letterSpacing:"0.5px",color:C.hint,borderBottom:`0.5px solid ${C.border}`,position:"sticky",left:0,background:C.bg,zIndex:11 }}>
              Task
            </th>
            <th style={{ padding:"8px 6px",textAlign:"center",fontSize:"13px",fontWeight:"500",textTransform:"uppercase",letterSpacing:"0.5px",color:C.hint,borderBottom:`0.5px solid ${C.border}` }}>
              Due
            </th>
            {days.map(date => {
              const isToday = date === today;
              return (
                <th key={date} style={{
                  padding:"6px 4px",textAlign:"center",fontSize:"13px",fontWeight:"500",color:isToday?C.blueText:C.muted,
                  borderBottom:`0.5px solid ${C.border}`,
                  background:isToday?C.blueBg:C.bg,
                  whiteSpace:"nowrap",
                }}>
                  {fmtColHeader(date)}
                </th>
              );
            })}
          </tr>
        </thead>
      )}
      <tbody>
        {taskList.map((task) => {
          const isSection = task.id === "session1" || task.id === "session2" || task.id === "session3" || task.id === "session4";
          return (
            <tr key={task.id} style={{ background:"#fff" }}
              onMouseEnter={e=>e.currentTarget.style.background=C.bg}
              onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
              {/* Task name — sticky left */}
              <td style={{ padding:"0 12px",height:rowH,fontSize:"15px",fontWeight:isSection?"500":"400",color:isSection?C.blueText:C.text,
                borderBottom:`0.5px solid ${C.border}`,position:"sticky",left:0,background:"inherit",zIndex:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
                {task.name}
                {task.sunday && <span style={{ marginLeft:"5px",fontSize:"11px",color:C.hint,fontFamily:FONT.mono }}>SUN</span>}
              </td>
              {/* Scheduled time */}
              <td style={{ padding:"0 6px",textAlign:"center",borderBottom:`0.5px solid ${C.border}` }}>
                {task.time && <span style={{ fontFamily:FONT.mono,fontSize:"13px",color:C.hint }}>{task.time}</span>}
              </td>
              {/* Day cells — free-text boxes */}
              {days.map((date) => {
                const cellKey = `${task.id}|${date}`;
                const isFocused = focusedCell === cellKey;
                const isToday = date === today;
                return (
                  <td key={date}
                    style={{
                      height:rowH, padding:0, verticalAlign:"top",
                      borderBottom:`0.5px solid ${C.border}`,
                      borderLeft:`0.5px solid ${C.border}`,
                      background: isFocused ? C.blueBg : isToday ? "#fafcff" : "inherit",
                      outline: isFocused ? `1.5px solid ${C.blue}` : "none",
                      outlineOffset:"-1.5px",
                      transition:"background 0.1s",
                    }}>
                    {renderCell(task, date)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
    );
  };

  return (
    <div className="nt-root" style={{ background:C.bg,height:"calc(100vh - 110px)",display:"flex",flexDirection:"column",borderRadius:"10px",overflow:"hidden",border:`0.5px solid ${C.border}` }}>

      {/* Header */}
      <div style={{ background:"#fff",borderBottom:`0.5px solid ${C.border}`,padding:"0 16px",height:"44px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:"7px" }}>
          <div style={{ width:"7px",height:"7px",borderRadius:"50%",background:C.greenText }}/>
          <span style={{ fontSize:"13px",fontWeight:"500",color:C.text,letterSpacing:"-0.2px" }}>routine</span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
          <div style={{ fontSize:"11px",color:C.muted }}>
            Today: <span style={{ fontFamily:FONT.mono,fontWeight:"500",color:C.text }}>{todayDone}/{todayApplicable.length}</span> filled
          </div>
          <div style={{ width:"100px",height:"4px",background:C.bg,borderRadius:"2px",overflow:"hidden" }}>
            <div style={{ height:"100%",width:`${(todayDone/todayApplicable.length)*100}%`,background:C.greenText,borderRadius:"2px",transition:"width 0.3s" }}/>
          </div>
          <div style={{ fontSize:"11px",color:C.hint }}>
            Type what you did — saves when you click away
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ display:"flex",flex:1,overflow:"hidden" }}>
        {/* Sidebar */}
        <div style={{ width:"190px",flexShrink:0,background:"#fff",borderRight:`0.5px solid ${C.border}`,overflowY:"auto" }}>
          <CalendarSidebar
            loggedDates={loggedDates}
            anchor={anchor} setAnchor={date => { setAnchor(date); setCalYear(+date.slice(0,4)); setCalMonth(+date.slice(5,7)-1); }}
            calYear={calYear} calMonth={calMonth} setCalYear={setCalYear} setCalMonth={setCalMonth}
          />
          <div style={{ borderTop:`0.5px solid ${C.border}`,padding:"10px 12px" }}>
            <div style={{ fontSize:"10px",fontWeight:"500",textTransform:"uppercase",letterSpacing:"0.4px",color:C.hint,marginBottom:"6px" }}>Week ending</div>
            <div style={{ fontFamily:FONT.mono,fontSize:"12px",fontWeight:"500",color:C.text }}>{anchor}</div>
            <button onClick={()=>setAnchor(today)} style={{ marginTop:"8px",width:"100%",background:"transparent",border:`0.5px solid ${C.borderMid}`,borderRadius:"4px",padding:"4px",fontSize:"11px",color:C.muted,cursor:"pointer",fontFamily:FONT.sans }}>
              Go to today
            </button>
          </div>
        </div>

        {/* Grid — routine (top) + meds (bottom 25%) */}
        <div ref={gridRef}
          style={{ flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:"#fff" }}>
          {/* Routine — top ~75% */}
          <div style={{ flex:3,minHeight:0,overflowX:"auto",overflowY:"auto" }}>
            {renderTable(ROUTINE_TASKS, true)}
          </div>
          {/* Meds — bottom ~25% */}
          <div style={{ flex:1,minHeight:0,display:"flex",flexDirection:"column",borderTop:`0.5px solid ${C.borderMid}` }}>
            <div style={{ flexShrink:0,height:"28px",padding:"0 12px",background:C.bg,borderBottom:`0.5px solid ${C.border}`,display:"flex",alignItems:"center",gap:"7px" }}>
              <div style={{ width:"7px",height:"7px",borderRadius:"50%",background:C.blueText }}/>
              <span style={{ fontSize:"10px",fontWeight:"500",textTransform:"uppercase",letterSpacing:"0.5px",color:C.muted }}>Meds</span>
            </div>
            <div style={{ flex:1,minHeight:0,overflowX:"auto",overflowY:"auto" }}>
              {renderTable(MEDS_TASKS, false)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
