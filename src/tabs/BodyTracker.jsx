// src/tabs/BodyTracker.jsx
// Body tab: Renpho Smart Body Tape Measure readings (cm), one row per date in
// users/{uid}/body_log/{date}. Layout mirrors WeightTracker: log table left,
// Trajectory chart + anatomy figure right.
import { useState } from "react";
import { MEASURE, BODY_MEASURES } from "../lib/bodyMeasures.js";
import useTrajectoryChart from "../hooks/useTrajectoryChart.js";
import BodyTrajectory from "../components/BodyTrajectory.jsx";
import { db } from "../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";

// ── Anatomy figure ───────────────────────────────────────────────────────────
// Front-view silhouette drawn from a few proportions, so male and female share
// one drawing. Each measurement site is a tape "ring"; the active one lights up.
// Anatomical convention: the person's left (L-) is on the viewer's right.
const BODY_SHAPE = {
  m: { head: [18, 22], neck: 10, shoulder: 50, chest: 40, waist: 33, hip: 36 },
  f: { head: [16, 21], neck: 8, shoulder: 42, chest: 36, waist: 27, hip: 40 },
};
const lerp = (a, b, t) => a + (b - a) * t;

function AnatomyFigure({ sex, active, latest }) {
  const P = BODY_SHAPE[sex === "f" ? "f" : "m"];
  const X = 100; // centre line
  const { neck: n, shoulder: S, chest: C, waist: Wa, hip: H } = P;
  const isF = sex === "f";

  // Left half of each part (viewer's left); mirrored for the other side.
  const torso = `M${X + 0.5},55 L${X - n},55 L${X - n},74 C${X - n},82 ${X - S + 8},82 ${X - S},92
    C${X - S - 2},100 ${X - C - 2},104 ${X - C},114
    C${X - C - (isF ? 3 : 0)},128 ${X - Wa},136 ${X - Wa},152
    C${X - Wa},170 ${X - H},180 ${X - H},200
    C${X - H},208 ${X - H + 2},214 ${X - H + 4},218 L${X + 0.5},224 Z`;
  const arm = `M${X - S + 2},88 C${X - S - 6},92 ${X - S - 8},110 ${X - S - 8},130
    L${X - S - 9},172 L${X - S - 12},215
    C${X - S - 14},228 ${X - S - 10},244 ${X - S - 5},244 C${X - S},244 ${X - S + 1},228 ${X - S + 1},215
    L${X - S + 4},172 L${X - C + 1},118 Z`;
  const leg = `M${X - H + 1},205 C${X - H},240 ${X - H + 6},270 ${X - H + 9},295
    C${X - H + 6},315 ${X - H + 7},340 ${X - H + 11},370 L${X - H + 12},392
    L${X - H + 4},402 L${X - 4},402 L${X - 5},392 L${X - 5},370
    C${X - 4},340 ${X - 6},315 ${X - 5},295 C${X - 4},270 ${X - 2},240 ${X + 0.5},220 Z`;

  // Arm / leg geometry at a given height (viewer's-left limb).
  const armAt = (y) => {
    const t = (y - 118) / (172 - 118);
    const inner = lerp(X - C + 1, X - S + 4, t),
      outer = lerp(X - S - 8, X - S - 9, (y - 130) / 42);
    return { cx: (inner + outer) / 2, hw: (inner - outer) / 2 };
  };
  const thigh = { cx: X - H / 2, hw: H / 2 - 1 };
  const calf = { cx: (X - H + 7 + X - 5) / 2, hw: (X - 5 - (X - H + 7)) / 2 };
  const arm135 = armAt(135);
  const mirror = (cx) => 2 * X - cx;

  // Person's left = viewer's right.
  const RINGS = {
    neck: { cx: X, y: 66, hw: n },
    shoulder: { cx: X, y: 94, hw: S + 8 },
    chest: { cx: X, y: 120, hw: C + (isF ? 2 : 0) },
    waist: { cx: X, y: 152, hw: Wa },
    abdomen: { cx: X, y: 168, hw: (Wa + H) / 2 },
    hip: { cx: X, y: 198, hw: H },
    bicepR: { cx: arm135.cx, y: 135, hw: arm135.hw },
    bicepL: { cx: mirror(arm135.cx), y: 135, hw: arm135.hw },
    thighR: { cx: thigh.cx, y: 238, hw: thigh.hw },
    thighL: { cx: mirror(thigh.cx), y: 238, hw: thigh.hw },
    calfR: { cx: calf.cx, y: 330, hw: calf.hw },
    calfL: { cx: mirror(calf.cx), y: 330, hw: calf.hw },
  };

  const body = "#C9D8EC",
    ring = "#90A4C0",
    hi = "#E8710A";
  const a = active && RINGS[active] ? active : null;
  const ar = a ? RINGS[a] : null;
  const labelRight = ar ? ar.cx >= X : true;
  const val = a ? latest[a] : null;

  return (
    <svg
      viewBox="0 0 200 410"
      style={{ display: "block", height: "360px", maxWidth: "100%", margin: "0 auto" }}
    >
      {isF && (
        <path
          d={`M${X - 19},34 C${X - 22},10 ${X + 22},10 ${X + 19},34 L${X + 20},72 L${X - 20},72 Z`}
          fill="#AFC2DD"
        />
      )}
      <g fill={body}>
        <ellipse cx={X} cy={38} rx={P.head[0]} ry={P.head[1]} />
        {[torso, arm, leg].map((d, i) => (
          <g key={i}>
            <path d={d} />
            <path d={d} transform={`translate(${2 * X},0) scale(-1,1)`} />
          </g>
        ))}
      </g>
      {Object.entries(RINGS).map(
        ([k, r2]) =>
          k !== a && (
            <ellipse
              key={k}
              cx={r2.cx}
              cy={r2.y}
              rx={r2.hw + 2}
              ry={2.6}
              fill="none"
              stroke={ring}
              strokeWidth="0.8"
              strokeDasharray="2,1.6"
              opacity="0.8"
            />
          ),
      )}
      {ar && (
        <g>
          <ellipse
            cx={ar.cx}
            cy={ar.y}
            rx={ar.hw + 3}
            ry={3.4}
            fill={hi}
            fillOpacity="0.15"
            stroke={hi}
            strokeWidth="2"
          />
          <line
            x1={labelRight ? ar.cx + ar.hw + 4 : ar.cx - ar.hw - 4}
            y1={ar.y}
            x2={labelRight ? 196 : 4}
            y2={ar.y}
            stroke={hi}
            strokeWidth="0.7"
          />
          <text
            x={labelRight ? 196 : 4}
            y={ar.y - 4}
            fontSize="9"
            fontWeight="bold"
            fill={hi}
            textAnchor={labelRight ? "end" : "start"}
          >
            {MEASURE[a].label}
          </text>
          {val != null && (
            <text
              x={labelRight ? 196 : 4}
              y={ar.y + 10}
              fontSize="8.5"
              fill="#6b7280"
              textAnchor={labelRight ? "end" : "start"}
            >
              {Number(val).toFixed(1)} cm
            </text>
          )}
        </g>
      )}
      <text x={14} y={404} fontSize="8" fill="#9ca3af">
        R
      </text>
      <text x={186} y={404} fontSize="8" fill="#9ca3af" textAnchor="end">
        L
      </text>
    </svg>
  );
}

export default function BodyTracker({ userId, bodyLog, setBodyLog, sex }) {
  const chart = useTrajectoryChart("waist"); // shared with the anatomy figure

  // Persist one field of one row (date-keyed) and update local state.
  const saveField = async (i, key, val) => {
    const row = bodyLog[i];
    if (!row?.date) return;
    const updatedRow = { ...row, [key]: val };
    setBodyLog(bodyLog.map((r, j) => (j === i ? updatedRow : r)));
    try {
      await setDoc(doc(db, "users", userId, "body_log", row.date), updatedRow);
    } catch (e) {
      console.error("body row save failed", e);
    }
  };
  const deleteRow = async (row) => {
    if (!row?.date) return;
    if (!window.confirm(`Delete body measurements for ${row.date}?`)) return;
    try {
      await deleteDoc(doc(db, "users", userId, "body_log", row.date));
    } catch (e) {
      console.error("body row delete failed", e);
      return;
    }
    setBodyLog((prev) => prev.filter((r) => r.date !== row.date));
  };
  // Most recent non-empty reading per measurement, for the anatomy label.
  const latest = Object.fromEntries(
    BODY_MEASURES.map(({ key }) => {
      for (let i = bodyLog.length - 1; i >= 0; i--)
        if (bodyLog[i][key] != null) return [key, bodyLog[i][key]];
      return [key, null];
    }),
  );
  // Pull Smart Tape Measure readings from the Renpho cloud. Synced sites overwrite
  // that day's values; sites the tape didn't send keep any manual entry.
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const syncBody = async () => {
    if (syncing || !userId) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await fetch("/api/renpho-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, kind: "girth" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Sync failed (HTTP ${res.status})`);
      const recs = data.records || [];
      if (!recs.length) setSyncMsg({ ok: true, text: "No tape measurements found." });
      else {
        const existing = new Map(bodyLog.map((r) => [r.date, r]));
        const merged = recs.map((rec) => ({
          ...(existing.get(rec.date) || {}),
          date: rec.date,
          ...rec.values,
        }));
        await Promise.all(
          merged.map((row) => setDoc(doc(db, "users", userId, "body_log", row.date), row)),
        );
        merged.forEach((row) => existing.set(row.date, row));
        setBodyLog(
          [...existing.values()].sort((a, b) => (a.date || "").localeCompare(b.date || "")),
        );
        setSyncMsg({
          ok: true,
          text: `Synced ${merged.length} day${merged.length !== 1 ? "s" : ""}.`,
        });
      }
    } catch (e) {
      setSyncMsg({ ok: false, text: e.message });
    }
    setSyncing(false);
    setTimeout(() => setSyncMsg(null), 6000);
  };
  const toNum = (v) => {
    const t = String(v).trim();
    if (t === "") return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        gap: "14px",
        alignItems: "flex-start",
        padding: "16px",
      }}
    >
      {/* ── LEFT: Body Log Table (55%) ── */}
      <div style={{ flex: "0 0 55%", minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
          <div style={{ fontSize: "15px", fontWeight: "bold", color: "#185FA5" }}>📏 Body Log</div>
          <button
            onClick={syncBody}
            disabled={syncing}
            style={{
              background: syncing ? "#9ca3af" : "#378ADD",
              border: "none",
              color: "#fff",
              borderRadius: "4px",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: "bold",
              cursor: syncing ? "default" : "pointer",
            }}
          >
            {syncing ? "Syncing…" : "⟳ Sync Renpho"}
          </button>
          {syncMsg ? (
            <span style={{ fontSize: "11px", color: syncMsg.ok ? "#2E7D32" : "#c62828" }}>
              {syncMsg.text}
            </span>
          ) : (
            <span style={{ fontSize: "11px", color: "#9ca3af" }}>
              cm · click a date in the calendar to add a row
            </span>
          )}
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: "8px",
            border: "0.5px solid #e5e7eb",
            overflow: "auto",
            maxHeight: "calc(100vh - 220px)",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr
                style={{
                  background: "#185FA5",
                  color: "#fff",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                {["Date", ...BODY_MEASURES.map((m) => m.short), ""].map((h, i) => (
                  <th
                    key={h || `c${i}`}
                    style={{
                      padding: "7px 6px",
                      textAlign: "center",
                      fontWeight: "bold",
                      fontSize: "11px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyLog.length === 0 && (
                <tr>
                  <td
                    colSpan={BODY_MEASURES.length + 2}
                    style={{
                      padding: "18px",
                      textAlign: "center",
                      color: "#9ca3af",
                      fontSize: "12px",
                    }}
                  >
                    No measurements yet — click a date in the calendar to start a row.
                  </td>
                </tr>
              )}
              {/* Latest first; i stays the index into bodyLog (used by saveField) */}
              {bodyLog
                .map((row, i) => ({ row, i }))
                .reverse()
                .map(({ row, i }) => {
                  const rowBg = i % 2 === 0 ? "#fff" : "#F7FAFD";
                  const isCurrent = i === bodyLog.length - 1;
                  return (
                    <tr key={row.date || i} style={{ background: isCurrent ? "#E3F2FD" : rowBg }}>
                      <td
                        style={{
                          padding: "5px 8px",
                          color: "#185FA5",
                          whiteSpace: "nowrap",
                          fontWeight: "600",
                        }}
                      >
                        {row.date}
                      </td>
                      {BODY_MEASURES.map(({ key }) => (
                        <td key={key} style={{ padding: "5px 3px", textAlign: "right" }}>
                          <input
                            type="number"
                            step="0.1"
                            min="10"
                            max="250"
                            value={row[key] ?? ""}
                            placeholder="—"
                            onChange={(e) => saveField(i, key, toNum(e.target.value))}
                            style={{
                              width: "50px",
                              padding: "2px 4px",
                              border: "0.5px solid #e5e7eb",
                              borderRadius: "4px",
                              fontSize: "12px",
                              textAlign: "right",
                              background: row[key] != null ? "#FFF3E0" : "#fff",
                              fontWeight: row[key] != null ? "bold" : "normal",
                              color: row[key] != null ? "#B26A00" : "#1a2a3a",
                            }}
                          />
                        </td>
                      ))}
                      <td style={{ padding: "5px 6px", textAlign: "center" }}>
                        <button
                          onClick={() => deleteRow(row)}
                          title="Delete row"
                          style={{
                            background: "none",
                            border: "none",
                            color: "#c62828",
                            cursor: "pointer",
                            fontSize: "13px",
                            padding: 0,
                          }}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── RIGHT: Chart + Specs (43%) ── */}
      <div style={{ flex: "0 0 43%", minWidth: 0 }}>
        <BodyTrajectory bodyLog={bodyLog} chart={chart} />

        {/* Anatomy — highlights the site under the hovered (or selected) pill */}
        <div
          style={{
            background: "#fff",
            borderRadius: "8px",
            border: "0.5px solid #e5e7eb",
            overflow: "hidden",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              background: "#185FA5",
              color: "#fff",
              padding: "8px 12px",
              fontSize: "12px",
              fontWeight: "bold",
            }}
          >
            <span>🧍 Measurement Sites</span>
          </div>
          {(() => {
            const act = chart.hoverMetric || chart.metric;
            const m = MEASURE[act];
            return (
              <div
                style={{
                  padding: "10px 12px",
                  display: "flex",
                  gap: "12px",
                  alignItems: "stretch",
                }}
              >
                <div style={{ flex: "0 0 48%", minWidth: 0 }}>
                  <AnatomyFigure sex={sex} active={act} latest={latest} />
                </div>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: "#F7FAFD",
                    border: "0.5px solid #cfe0f0",
                    borderRadius: "6px",
                    padding: "12px 14px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: "bold",
                      color: "#378ADD",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      marginBottom: "6px",
                    }}
                  >
                    📏 How to measure
                  </div>
                  <div
                    style={{
                      fontSize: "22px",
                      fontWeight: "bold",
                      color: "#185FA5",
                      marginBottom: "8px",
                    }}
                  >
                    {m.label}{" "}
                    <span style={{ fontSize: "16px", fontWeight: "normal", color: "#6b7280" }}>
                      (cm)
                    </span>
                  </div>
                  <div style={{ fontSize: "18px", lineHeight: 1.5, color: "#1a2a3a" }}>
                    {m.info}
                  </div>
                  <div
                    style={{
                      marginTop: "14px",
                      paddingTop: "10px",
                      borderTop: "1px solid #e5e7eb",
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "16px",
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>Latest</span>
                    <span
                      style={{
                        color: latest[act] != null ? "#B26A00" : "#9ca3af",
                        fontWeight: "bold",
                      }}
                    >
                      {latest[act] != null ? `${Number(latest[act]).toFixed(1)} cm` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
