// src/components/CalendarSidebar.jsx

export default function CalendarSidebar({ calYear, calMonth, currentDate, todayStr, allDays, loggedKcal, switchDay }) {
  const dows = ["M","T","W","T","F","S","S"];
  const loggedSet = new Set(allDays.map(d => d.date));
  let blocks = [];

  for (let offset = -6; offset <= 7; offset++) {
    let m = calMonth + offset, y = calYear;
    while (m < 0)  { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    const label = new Date(y, m, 1).toLocaleString("default", { month:"short", year:"numeric" });
    const firstDow = (new Date(y,m,1).getDay()+6)%7;
    const daysInMonth = new Date(y,m+1,0).getDate();
    let cells = dows.map((dow,i) => (
      <div key={"dow"+i} style={{ textAlign:"center", fontSize:"8px", fontWeight:"bold", color:"#6B8CAE", paddingBottom:"2px" }}>{dow}</div>
    ));
    for (let i=0;i<firstDow;i++) cells.push(<div key={"bl"+i}/>);
    for (let day=1;day<=daysInMonth;day++) {
      const mm = String(m+1).padStart(2,"0"), dd = String(day).padStart(2,"0");
      const dateStr = `${y}-${mm}-${dd}`;
      const isLogged = loggedSet.has(dateStr);
      const isActive = dateStr === currentDate;
      const isToday  = dateStr === todayStr;
      const kcal = loggedKcal[dateStr];
      cells.push(
        <div key={dateStr} onClick={() => switchDay(dateStr)}
          style={{ textAlign:"center", fontSize:"10px", padding:"3px 1px", borderRadius:"4px", cursor:"pointer", lineHeight:"1.2",
            background: isActive ? "#1F4E79" : isLogged ? "#2E75B6" : "transparent",
            color: isLogged||isActive ? "#fff" : isToday ? "#2E75B6" : "#1a2a3a",
            fontWeight: isLogged||isToday ? "bold" : "normal",
            outline: isActive ? "2px solid #F57F17" : "none", outlineOffset:"1px" }}>
          {day}
          {kcal ? <span style={{ fontSize:"6px", display:"block", opacity:0.85 }}>{Math.round(kcal)}</span> : null}
        </div>
      );
    }
    blocks.push(
      <div key={`${y}-${m}`} style={{ padding:"4px 6px 2px" }}>
        <div style={{ fontSize:"10px", fontWeight:"bold", color:"#1F4E79", textAlign:"center",
          padding:"3px 0", borderBottom:"1px solid #D6E4F0", marginBottom:"2px",
          background: m === calMonth && y === calYear ? "#EBF3FB" : "transparent",
          borderRadius:"3px 3px 0 0" }}>{label}</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:"1px" }}>{cells}</div>
      </div>
    );
  }

  return (
    <div style={{ width:"230px", flexShrink:0, background:"#fff", borderRight:"1px solid #DDEAF6", display:"flex", flexDirection:"column", overflow:"hidden" }}>
      <div style={{ background:"#1F4E79", color:"#fff", padding:"10px 14px", fontWeight:"bold", fontSize:"12px" }}>
        📅 Calendar
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"0" }}>{blocks}</div>
    </div>
  );
}
