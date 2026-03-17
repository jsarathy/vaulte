// src/RoutineTracker.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { db } from "./firebase";
import { doc, getDoc, setDoc, getDocs, collection } from "firebase/firestore";
import { C, FONT, border } from "./constants/design.jsx";
import { IconChevronLeft, IconChevronRight } from "./constants/design.jsx";

// ── Task definitions ──────────────────────────────────────────────────────────
const TASKS = [
  { id:"warm_water",   name:"Start with Warm Water",      time:"06:15" },
  { id:"thyronorm",    name:"Thyronorm",                   time:null    },
  { id:"coffee",       name:"Coffee",                      time:"07:00" },
  { id:"session1",     name:"Session 1: Theory (45 min)", time:"08:00" },
  { id:"exercise",     name:"Exercise @ Home (45 min)",   time:"09:00" },
  { id:"session2",     name:"Session 2: Theory (45 min)", time:"10:00" },
  { id:"garden",       name:"Garden / Chores",             time:"11:00" },
  { id:"esomeprazole", name:"Esomeprazole",                time:"11:45" },
  { id:"hygiene",      name:"Personal Hygiene",            time:"11:45" },
  { id:"lunch_prep",   name:"Lunch Prep",                  time:"12:30" },
  { id:"lunch",        name:"Lunch",                       time:"13:15" },
  { id:"probiotic",    name:"Probiotic / Vits / Aspirin",  time:null    },
  { id:"biz_check",    name:"Biz Check",                   time:"14:00" },
  { id:"session3",     name:"Session 3: Hands on",         time:"15:30" },
  { id:"session4",     name:"Session 4: Project + Tea",    time:"16:30" },
  { id:"walk_bike",    name:"Walk / Bike",                 time:"17:30" },
  { id:"dinner_prep",  name:"Dinner prep",                 time:"18:30" },
  { id:"pregastar",    name:"Pregastar",                   time:"19:00" },
  { id:"dinner",       name:"Dinner",                      time:"19:15" },
  { id:"art_reading",  name:"Art / Reading",               time:"19:45" },
  { id:"statin",       name:"Statin / Allergy Med",        time:"21:45" },
  { id:"wind_down",    name:"Wind down",                   time:"21:45" },
  { id:"bedtime",      name:"Bedtime",                     time:"22:15" },
  { id:"vit_d",        name:"Vit D",                       time:null, sunday:true },
];

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
  const [timePickerCell, setTimePickerCell] = useState(null);
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const gridRef = useRef(null);

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

  // ── Save entry ──
  const saveEntry = useCallback(async (date, taskId, value) => {
    const newLog = {
      ...log,
      [date]: { ...log[date], [taskId]: value }
    };
    setLog(newLog);
    try {
      await setDoc(doc(db, "users", userId, "routine_log", date), {
        entries: newLog[date],
        date,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) { console.error("Routine save error:", e); }
  }, [log, userId]);

  // ── Toggle cell (Enter) ──
  const toggleCell = useCallback(async (taskId, date) => {
    const task = TASKS.find(t => t.id === taskId);
    if (task?.sunday && !isSunday(date)) return; // skip non-Sundays for Vit D
    const current = log[date]?.[taskId];
    const next = current?.done ? null : { done: true };
    await saveEntry(date, taskId, next);
  }, [log, saveEntry]);

  // ── Set time ──
  const setTime = useCallback(async (taskId, date, time) => {
    await saveEntry(date, taskId, { done: true, time });
    setTimePickerCell(null);
  }, [saveEntry]);

  // ── Focus helpers ──
  const focusCell = (taskId, date) => {
    const el = gridRef.current?.querySelector(`[data-cell="${taskId}|${date}"]`);
    el?.focus();
  };

  // ── Keyboard on grid ──
  const handleGridKeyDown = (e) => {
    if (!focusedCell || timePickerCell) return;
    const [taskId, date] = focusedCell.split("|");
    const tIdx = TASKS.findIndex(t => t.id === taskId);
    const dIdx = days.indexOf(date);
    if (e.key === "Enter") {
      e.preventDefault();
      toggleCell(taskId, date);
    } else if (e.key === "t" || e.key === "T") {
      e.preventDefault();
      const task = TASKS.find(t => t.id === taskId);
      if (!task?.sunday || isSunday(date)) setTimePickerCell(focusedCell);
    } else if (e.key === "ArrowUp" && tIdx > 0) {
      e.preventDefault(); focusCell(TASKS[tIdx-1].id, date);
    } else if (e.key === "ArrowDown" && tIdx < TASKS.length - 1) {
      e.preventDefault(); focusCell(TASKS[tIdx+1].id, date);
    } else if (e.key === "ArrowLeft" && dIdx > 0) {
      e.preventDefault(); focusCell(taskId, days[dIdx-1]);
    } else if (e.key === "ArrowRight" && dIdx < days.length - 1) {
      e.preventDefault(); focusCell(taskId, days[dIdx+1]);
    }
  };

  // ── Cell renderer ──
  const renderCell = (task, date) => {
    const isSun = isSunday(date);
    if (task.sunday && !isSun) {
      return <span style={{ color:C.border, fontSize:"11px" }}>—</span>;
    }
    const entry = log[date]?.[task.id];
    if (!entry?.done) return null;
    if (entry.time) {
      return <span style={{ fontFamily:FONT.mono, fontSize:"11px", fontWeight:"500", color:C.blueText }}>{entry.time}</span>;
    }
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke={C.greenText} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="2.5 8.5 6 12 13.5 4.5"/>
      </svg>
    );
  };

  // ── Completion stats for today ──
  const todayLog = log[today] || {};
  const todayApplicable = TASKS.filter(t => !t.sunday || isSunday(today));
  const todayDone = todayApplicable.filter(t => todayLog[t.id]?.done).length;

  const loggedDates = new Set(
    Object.entries(log).filter(([_, entries]) => Object.values(entries).some(e => e?.done)).map(([d]) => d)
  );

  if (loading) return <div style={{ padding:"40px",textAlign:"center",color:C.muted,fontFamily:FONT.sans }}>Loading routine…</div>;

  const COL_TASK = "180px", COL_TIME = "52px", COL_DAY = "1fr";

  return (
    <div className="nt-root" style={{ background:C.bg,height:"calc(100vh - 110px)",display:"flex",flexDirection:"column",borderRadius:"10px",overflow:"hidden",border:`0.5px solid ${C.border}` }}>
      {timePickerCell && (() => {
        const [taskId, date] = timePickerCell.split("|");
        const task = TASKS.find(t => t.id === taskId);
        const existing = log[date]?.[taskId];
        return <TimePicker
          initialTime={existing?.time || task?.time || null}
          onConfirm={time => setTime(taskId, date, time)}
          onCancel={() => setTimePickerCell(null)}
        />;
      })()}

      {/* Header */}
      <div style={{ background:"#fff",borderBottom:`0.5px solid ${C.border}`,padding:"0 16px",height:"44px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:"7px" }}>
          <div style={{ width:"7px",height:"7px",borderRadius:"50%",background:C.greenText }}/>
          <span style={{ fontSize:"13px",fontWeight:"500",color:C.text,letterSpacing:"-0.2px" }}>routine</span>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:"12px" }}>
          <div style={{ fontSize:"11px",color:C.muted }}>
            Today: <span style={{ fontFamily:FONT.mono,fontWeight:"500",color:C.text }}>{todayDone}/{todayApplicable.length}</span> done
          </div>
          <div style={{ width:"100px",height:"4px",background:C.bg,borderRadius:"2px",overflow:"hidden" }}>
            <div style={{ height:"100%",width:`${(todayDone/todayApplicable.length)*100}%`,background:C.greenText,borderRadius:"2px",transition:"width 0.3s" }}/>
          </div>
          <div style={{ fontSize:"11px",color:C.hint }}>
            Enter = ✓ · T = set time · ↑↓←→ navigate
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

        {/* Grid */}
        <div ref={gridRef} onKeyDown={handleGridKeyDown}
          style={{ flex:1,overflowX:"auto",overflowY:"auto",background:"#fff" }}>
          <table style={{ borderCollapse:"collapse",minWidth:"700px",width:"100%",tableLayout:"fixed" }}>
            <colgroup>
              <col style={{ width:COL_TASK }}/>
              <col style={{ width:COL_TIME }}/>
              {days.map(d => <col key={d} style={{ width:COL_DAY }}/>)}
            </colgroup>
            <thead>
              <tr style={{ background:C.bg,position:"sticky",top:0,zIndex:10 }}>
                <th style={{ padding:"8px 12px",textAlign:"left",fontSize:"10px",fontWeight:"500",textTransform:"uppercase",letterSpacing:"0.5px",color:C.hint,borderBottom:`0.5px solid ${C.border}`,position:"sticky",left:0,background:C.bg,zIndex:11 }}>
                  Task
                </th>
                <th style={{ padding:"8px 6px",textAlign:"center",fontSize:"10px",fontWeight:"500",textTransform:"uppercase",letterSpacing:"0.5px",color:C.hint,borderBottom:`0.5px solid ${C.border}` }}>
                  Due
                </th>
                {days.map(date => {
                  const isToday = date === today;
                  const isAnchor = date === anchor;
                  return (
                    <th key={date} style={{
                      padding:"6px 4px",textAlign:"center",fontSize:"10px",fontWeight:"500",color:isToday?C.blueText:C.muted,
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
            <tbody>
              {TASKS.map((task, tIdx) => {
                const isSection = task.id === "session1" || task.id === "session2" || task.id === "session3" || task.id === "session4";
                return (
                  <tr key={task.id} style={{ background:"#fff" }}
                    onMouseEnter={e=>e.currentTarget.style.background=C.bg}
                    onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                    {/* Task name — sticky left */}
                    <td style={{ padding:"0 12px",height:"34px",fontSize:"12px",fontWeight:isSection?"500":"400",color:isSection?C.blueText:C.text,
                      borderBottom:`0.5px solid ${C.border}`,position:"sticky",left:0,background:"inherit",zIndex:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
                      {task.name}
                      {task.sunday && <span style={{ marginLeft:"5px",fontSize:"9px",color:C.hint,fontFamily:FONT.mono }}>SUN</span>}
                    </td>
                    {/* Scheduled time */}
                    <td style={{ padding:"0 6px",textAlign:"center",borderBottom:`0.5px solid ${C.border}` }}>
                      {task.time && <span style={{ fontFamily:FONT.mono,fontSize:"10px",color:C.hint }}>{task.time}</span>}
                    </td>
                    {/* Day cells */}
                    {days.map((date, dIdx) => {
                      const cellKey = `${task.id}|${date}`;
                      const isFocused = focusedCell === cellKey;
                      const isToday = date === today;
                      const entry = log[date]?.[task.id];
                      const isDone = !!entry?.done;
                      const isNA = task.sunday && !isSunday(date);
                      return (
                        <td key={date}
                          data-cell={cellKey}
                          tabIndex={isNA ? -1 : 0}
                          onFocus={() => setFocusedCell(cellKey)}
                          onBlur={() => setFocusedCell(prev => prev === cellKey ? null : prev)}
                          onClick={() => !isNA && toggleCell(task.id, date)}
                          style={{
                            height:"34px",textAlign:"center",verticalAlign:"middle",
                            borderBottom:`0.5px solid ${C.border}`,
                            background: isFocused ? C.blueBg : isToday ? "#fafcff" : "inherit",
                            outline: isFocused ? `1.5px solid ${C.blue}` : "none",
                            outlineOffset:"-1.5px",
                            cursor: isNA ? "default" : "pointer",
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
        </div>
      </div>
    </div>
  );
}
