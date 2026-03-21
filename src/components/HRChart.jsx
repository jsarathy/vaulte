// src/components/HRChart.jsx — shared HR sparkline + zone bar
import { C, FONT } from "../constants/design.jsx";

export default function HRChart({ session }) {
  const s = session;
  const samples = s?.hr_samples;
  if (!samples || samples.length < 2) return null;

  const W = 420, H = 90, PAD = 4;
  const valid = samples.filter(v => v != null);
  if (valid.length < 2) return null;

  const minHR = Math.min(...valid) - 5;
  const maxHR = Math.max(...valid) + 5;
  const rateS = s.recording_rate_s || 5;

  // Downsample to max 300 points
  const step = Math.max(1, Math.floor(samples.length / 300));
  const pts = [];
  for (let i = 0; i < samples.length; i += step) {
    const v = samples[i];
    if (v == null) continue;
    const x = PAD + ((i / (samples.length - 1)) * (W - PAD * 2));
    const y = PAD + ((1 - (v - minHR) / (maxHR - minHR)) * (H - PAD * 2));
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  // Avg HR line
  let avgY = null;
  if (s.hr_avg) {
    avgY = PAD + ((1 - (s.hr_avg - minHR) / (maxHR - minHR)) * (H - PAD * 2));
  }

  // Zone seconds
  const hrMaxVal = s.hr_max || 185;
  const zones = [0, 0, 0, 0, 0];
  samples.forEach(v => {
    if (v == null) return;
    const pct = v / hrMaxVal;
    if      (pct < 0.6) zones[0] += rateS;
    else if (pct < 0.7) zones[1] += rateS;
    else if (pct < 0.8) zones[2] += rateS;
    else if (pct < 0.9) zones[3] += rateS;
    else                zones[4] += rateS;
  });
  const totalS = zones.reduce((a, b) => a + b, 0) || 1;
  const zoneColors = ["#B5D4F4", "#C0DD97", "#FAC775", "#F0997B", "#E24B4A"];
  const zoneLabels = ["Z1 Easy", "Z2 Fat burn", "Z3 Aerobic", "Z4 Threshold", "Z5 Max"];

  const durationMin = Math.round(samples.length * rateS / 60);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:"6px" }}>
        <span style={{ fontSize:"10px", fontWeight:"500", textTransform:"uppercase", letterSpacing:"0.4px", color:C.hint }}>
          Heart rate · {durationMin} min recorded
        </span>
        <span style={{ fontFamily:FONT.mono, fontSize:"11px", color:C.muted }}>
          {Math.min(...valid)}–{Math.max(...valid)} bpm
        </span>
      </div>
      <div style={{ background:C.bg, borderRadius:"6px", border:`0.5px solid ${C.border}`, padding:"8px 10px" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:"80px", display:"block" }}>
          {avgY !== null && (
            <line x1={PAD} y1={avgY} x2={W-PAD} y2={avgY}
              stroke={C.blueMid} strokeWidth="0.8" strokeDasharray="4,3"/>
          )}
          <polyline points={pts.join(" ")} fill="none" stroke={C.blue}
            strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round"/>
          <text x={PAD+2} y={PAD+9} fontSize="8" fill={C.hint} fontFamily="DM Mono,monospace">{Math.round(maxHR+5)} bpm</text>
          <text x={PAD+2} y={H-PAD-2} fontSize="8" fill={C.hint} fontFamily="DM Mono,monospace">{Math.round(minHR+5)} bpm</text>
          {avgY !== null && (
            <text x={W-PAD-2} y={avgY-3} fontSize="8" fill={C.blue} fontFamily="DM Mono,monospace" textAnchor="end">
              avg {s.hr_avg}
            </text>
          )}
        </svg>

        {/* Zone bar */}
        <div style={{ display:"flex", height:"6px", borderRadius:"3px", overflow:"hidden", marginTop:"6px" }}>
          {zones.map((sec, i) => (
            <div key={i} style={{ flex:sec/totalS, background:zoneColors[i], minWidth:sec>0?"2px":"0" }}/>
          ))}
        </div>

        {/* Zone legend */}
        <div style={{ display:"flex", flexWrap:"wrap", gap:"10px", marginTop:"8px" }}>
          {zones.map((sec, i) => sec > 0 && (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:"4px", fontSize:"10px", color:C.muted }}>
              <div style={{ width:"8px", height:"8px", borderRadius:"2px", background:zoneColors[i], flexShrink:0 }}/>
              <span>{zoneLabels[i]}</span>
              <span style={{ fontFamily:FONT.mono, color:C.text, fontWeight:"500" }}>{Math.round(sec/60)}m</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
