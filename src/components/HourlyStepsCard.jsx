// src/components/HourlyStepsCard.jsx — Apple Watch steps by hour for one day (from apple_activity.hourly)
// Double-click the chart to expand it full screen (Esc or double-click to collapse), like the Weight/Body trajectory charts.
import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// "Nice" whole-number step for the step-count axis (1, 2, 5 × 10^n), aiming for ~`target` gridlines.
export function niceAxis(max, target) {
  const top = Math.max(max, 1);
  const raw = top / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw),
  );
  const yMax = Math.ceil(top / step) * step;
  const ticks = [];
  for (let v = 0; v <= yMax; v += step) ticks.push(v);
  return { yMax, ticks };
}

export default function HourlyStepsCard({ userId, date: dateProp }) {
  // Own date, so any day can be browsed; follows the Add Entry date when that changes.
  const [date, setDate] = useState(dateProp);
  useEffect(() => {
    setDate(dateProp);
  }, [dateProp]);
  const pickerRef = useRef(null);
  const openPicker = (e) => {
    e?.stopPropagation();
    const el = pickerRef.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      el.focus();
      el.click();
    }
  };
  const today = new Date().toLocaleDateString("en-CA");
  const fmtDate = (d) =>
    d
      ? new Date(d + "T12:00:00").toLocaleDateString("en-GB", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : "";

  const [hourly, setHourly] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hover, setHover] = useState(null);

  // Full-screen view
  const [full, setFull] = useState(false);
  const boxRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!full) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setFull(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full]);
  useEffect(() => {
    if (!full || !boxRef.current || typeof ResizeObserver === "undefined") return;
    const el = boxRef.current;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [full]);
  useEffect(() => {
    setHover(null);
  }, [full, date]);

  useEffect(() => {
    if (!userId || !date) return;
    setLoading(true);
    const unsub = onSnapshot(
      doc(db, "users", userId, "apple_activity", date),
      (s) => {
        setHourly(s.exists() ? s.data().hourly || null : null);
        setLoading(false);
      },
      (e) => {
        console.error("hourly steps listen failed:", e);
        setHourly(null);
        setLoading(false);
      },
    );
    return unsub;
  }, [userId, date]);

  const vals = Array.from(
    { length: 24 },
    (_, h) => Number(hourly?.[String(h).padStart(2, "0")]) || 0,
  );
  const total = vals.reduce((a, b) => a + b, 0);
  const peakVal = Math.max(...vals);
  const peak = vals.indexOf(peakVal);
  const hh = (h) => `${String(h).padStart(2, "0")}:00`;

  // Geometry: compact = fixed drawing scaled to the panel; full = real pixels of the measured area.
  const k = full ? 1.6 : 1;
  const W = full
    ? Math.max(600, box.w || (typeof window !== "undefined" ? window.innerWidth - 48 : 1200))
    : 300;
  const H = full
    ? Math.max(300, (box.h || (typeof window !== "undefined" ? window.innerHeight - 140 : 600)) - 4)
    : 130;
  const tk = full ? 1.5 : 1; // expanded view: all text 50% larger (Fix 8)
  const PAD = { l: 34 * k * tk, r: 8 * k, t: 10 * k * tk, b: 18 * k * tk };
  const cW = W - PAD.l - PAD.r,
    cH = H - PAD.t - PAD.b,
    bw = cW / 24;
  const { yMax, ticks } = niceAxis(peakVal, full ? 8 : 4);
  const yS = (v) => PAD.t + cH - (v / yMax) * cH;
  const fs = 8 * k * tk;
  const xLabelHours = full ? Array.from({ length: 24 }, (_, h) => h) : [0, 3, 6, 9, 12, 15, 18, 21];

  const chart = (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={full ? W : "100%"}
      height={full ? H : undefined}
      style={{ display: "block" }}
      onMouseLeave={() => setHover(null)}
    >
      {ticks.map((v) => (
        <g key={v}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={yS(v)}
            y2={yS(v)}
            stroke={v === 0 ? "#9ca3af" : "#eef0f3"}
            strokeWidth={0.6 * k}
          />
          <text x={PAD.l - 4 * k} y={yS(v) + 3 * k} fontSize={fs} fill="#6b7280" textAnchor="end">
            {v.toLocaleString()}
          </text>
        </g>
      ))}
      {vals.map((v, h) => {
        const bh = (v / yMax) * cH;
        const x = PAD.l + h * bw;
        return (
          <g key={h} onMouseEnter={() => setHover(h)}>
            <rect x={x} y={PAD.t} width={bw} height={cH} fill="transparent" />
            <rect
              x={x + bw * 0.15}
              y={PAD.t + cH - bh}
              width={bw * 0.7}
              height={Math.max(bh, v ? 1 : 0)}
              rx={1.5 * k}
              fill={hover === h ? "#185FA5" : "#378ADD"}
            />
            {full && v > 0 && (
              <text
                x={x + bw / 2}
                y={PAD.t + cH - bh - 4 * k}
                fontSize={fs * 0.9}
                fill="#374151"
                textAnchor="middle"
              >
                {v.toLocaleString()}
              </text>
            )}
          </g>
        );
      })}
      {xLabelHours.map((h) => (
        <text
          key={h}
          x={PAD.l + h * bw + bw / 2}
          y={H - 5 * k}
          fontSize={fs}
          fill="#6b7280"
          textAnchor="middle"
        >
          {String(h).padStart(2, "0")}
        </text>
      ))}
    </svg>
  );

  const summary = (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: full ? "20px" : "11px",
        color: "#6b7280",
        marginBottom: full ? "8px" : "4px",
      }}
    >
      <span>
        {hover != null
          ? `${hh(hover)}–${hh((hover + 1) % 24)} · ${vals[hover].toLocaleString()} steps`
          : `${total.toLocaleString()} steps`}
      </span>
      <span>
        peak {hh(peak)} · {peakVal.toLocaleString()}
      </span>
    </div>
  );

  const browseBtn = (dark) => (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", position: "relative" }}>
      <span
        style={{
          color: dark ? "rgba(255,255,255,0.8)" : "#6b7280",
          fontSize: dark ? "11px" : "20px",
        }}
      >
        {fmtDate(date)}
      </span>
      <button
        onClick={openPicker}
        onDoubleClick={(e) => e.stopPropagation()}
        title="Pick a day"
        style={{
          background: dark ? "rgba(255,255,255,0.15)" : "#185FA5",
          border: "none",
          color: "#fff",
          borderRadius: "4px",
          padding: dark ? "3px 8px" : "5px 12px",
          fontSize: dark ? "11px" : "16px",
          cursor: "pointer",
        }}
      >
        📅 Browse by date
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={date || ""}
        max={today}
        onChange={(e) => e.target.value && setDate(e.target.value)}
        style={{
          position: "absolute",
          right: 0,
          bottom: 0,
          width: "1px",
          height: "1px",
          opacity: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );

  const body = loading ? (
    <div style={{ fontSize: "12px", color: "#9ca3af" }}>loading…</div>
  ) : !total ? (
    <div style={{ fontSize: "12px", color: "#9ca3af", fontStyle: "italic" }}>
      No hourly steps synced for this day yet
    </div>
  ) : (
    <>
      {summary}
      {full ? (
        <div ref={boxRef} style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {chart}
        </div>
      ) : (
        chart
      )}
    </>
  );

  if (full) {
    return (
      <div
        onDoubleClick={() => setFull(false)}
        title="Double-click or press Esc to collapse"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "#fff",
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          cursor: "zoom-out",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontSize: "24px", fontWeight: "bold", color: "#185FA5" }}>
              ⌚ Steps by hour
            </span>
            {browseBtn(false)}
          </div>
          <span style={{ fontSize: "16px", color: "#9ca3af" }}>
            Esc or double-click to collapse
          </span>
        </div>
        {body}
      </div>
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: "8px",
        border: "0.5px solid #e5e7eb",
        overflow: "hidden",
        marginTop: "14px",
      }}
    >
      <div
        style={{
          background: "#185FA5",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            color: "#fff",
            fontWeight: "bold",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span style={{ fontSize: "16px" }}>⌚</span> Steps by hour
        </div>
        {browseBtn(true)}
      </div>
      <div
        onDoubleClick={() => total && setFull(true)}
        title={total ? "Double-click to expand" : undefined}
        style={{ padding: "10px 12px", cursor: total ? "zoom-in" : "default" }}
      >
        {body}
      </div>
    </div>
  );
}
