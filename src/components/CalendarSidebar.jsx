// src/components/CalendarSidebar.jsx — unified calendar sidebar for Nutrition and Routine trackers
import { C, FONT, IconChevronLeft, IconChevronRight } from "../constants/design.jsx";

export default function CalendarSidebar({
  calYear, calMonth, setCalYear, setCalMonth,
  selectedDate,
  onSelectDate,
  loggedSet = new Set(),
  loggedKcal,         // optional map { "YYYY-MM-DD": number } — shown as subtitle on each cell
  loggedColor = { bg: C.blueBg, text: C.blueText },
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const dows = ["M","T","W","T","F","S","S"];
  const prevMonth = () => { if (calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1); };
  const nextMonth = () => { if (calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1); };
  const label = new Date(calYear, calMonth, 1).toLocaleString("default", { month:"long", year:"numeric" });
  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();

  const cells = [];
  for (let i=0; i<firstDow; i++) cells.push(<div key={"bl"+i}/>);
  for (let d=1; d<=daysInMonth; d++) {
    const mm = String(calMonth+1).padStart(2,"0"), dd = String(d).padStart(2,"0");
    const ds = `${calYear}-${mm}-${dd}`;
    const isSelected = ds === selectedDate;
    const isLogged   = loggedSet.has(ds);
    const isToday    = ds === todayStr;
    const kcal       = loggedKcal?.[ds];
    cells.push(
      <div key={ds} onClick={() => onSelectDate(ds)} title={kcal ? `${Math.round(kcal)} kcal` : ""}
        style={{ textAlign:"center", fontSize:"11px", padding:"4px 1px", borderRadius:"4px",
          cursor:"pointer", lineHeight:1.2, fontFamily:FONT.mono,
          background: isSelected ? C.blue : isLogged ? loggedColor.bg : "transparent",
          color: isSelected ? "#fff" : isLogged ? loggedColor.text : isToday ? C.blue : C.muted,
          fontWeight: isSelected || isLogged ? "500" : "400",
          outline: isToday && !isSelected ? `1px solid ${C.blue}` : "none", outlineOffset:"-1px" }}>
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
