// src/tabs/WeightTracker.jsx
import TrajectoryPanel from "../components/TrajectoryPanel.jsx";
import WeightLogPanel from "../components/WeightLogPanel.jsx";
import { cumLossBaseline, syncFromOf } from "../lib/weightLogTable.js";
import { buildProjectionSeries, deriveMilestones } from "../constants/weightPlan";

export default function WeightTracker({
  userId,
  weightLog,
  setWeightLog,
  weightPlanConfig,
  editingPlan,
  setEditingPlan,
  editCfg,
  setEditCfg,
  savePlanConfig,
  renphoSyncing,
  renphoMsg,
  syncRenpho,
  purgeBefore,
}) {
  const cfg = weightPlanConfig;

  const cumBaseline = cumLossBaseline(cfg);

  const bmi = (cfg.startWeightKg / Math.pow(cfg.heightCm / 100, 2)).toFixed(1);
  const tBmiLo = (cfg.targetWeightMinKg / Math.pow(cfg.heightCm / 100, 2)).toFixed(1);
  const tBmiHi = (cfg.targetWeightMaxKg / Math.pow(cfg.heightCm / 100, 2)).toFixed(1);

  // ── Projection curve: anchor points interpolated in time ──
  const projSeries = buildProjectionSeries(cfg);
  const planOK = projSeries.length > 1;
  const syncFrom = syncFromOf(cfg);

  let milestones = [];
  try {
    milestones = deriveMilestones(cfg) || [];
  } catch (e) {
    milestones = [];
  }

  const inp = (extra = {}) => ({
    padding: "3px 6px",
    border: "0.5px solid #e5e7eb",
    borderRadius: "4px",
    fontSize: "11px",
    color: "#185FA5",
    background: "#F7FAFD",
    ...extra,
  });
  const lbl = { fontSize: "10px", color: "#6b7280", display: "block", marginBottom: "2px" };
  const setE = (key, val) => setEditCfg((prev) => ({ ...prev, [key]: val }));
  const num = (key, w = 60, step = 1) => (
    <input
      type="number"
      step={step}
      value={editCfg[key] ?? ""}
      onChange={(e) => setE(key, parseFloat(e.target.value) || 0)}
      style={inp({ width: `${w}px` })}
    />
  );

  // ── Anchor table editing ──
  const anchors = Array.isArray(editCfg.planAnchors) ? editCfg.planAnchors : [];
  const setAnchor = (i, key, val) =>
    setEditCfg((prev) => {
      const a = [...(Array.isArray(prev.planAnchors) ? prev.planAnchors : [])];
      a[i] = { ...a[i], [key]: val };
      return { ...prev, planAnchors: a };
    });
  const addAnchor = () =>
    setEditCfg((prev) => {
      const a = [...(Array.isArray(prev.planAnchors) ? prev.planAnchors : [])];
      const last = a[a.length - 1];
      a.push({
        week: (Number(last?.week) || 0) + 4,
        weightKg: Number(last?.weightKg) || Number(prev.startWeightKg) || 0,
      });
      return { ...prev, planAnchors: a };
    });
  const delAnchor = (i) =>
    setEditCfg((prev) => ({
      ...prev,
      planAnchors: (Array.isArray(prev.planAnchors) ? prev.planAnchors : []).filter(
        (_, j) => j !== i,
      ),
    }));
  const anchorDate = (wk) => {
    const t = Date.parse(`${String(editCfg.startDate).slice(0, 10)}T12:00:00`);
    if (!Number.isFinite(t) || !Number.isFinite(Number(wk))) return "—";
    return new Date(t + Number(wk) * 7 * 86400000).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
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
      <WeightLogPanel
        userId={userId}
        weightLog={weightLog}
        setWeightLog={setWeightLog}
        cfg={cfg}
        purgeBefore={purgeBefore}
        renpho={{ syncing: renphoSyncing, msg: renphoMsg, sync: syncRenpho }}
      />

      {/* ── RIGHT: Chart + Specs (43%) ── */}
      <div style={{ flex: "0 0 43%", minWidth: 0 }}>
        <TrajectoryPanel weightLog={weightLog} cfg={cfg} />

        {/* Plan Specifications */}
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
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>📋 Plan Specifications</span>
            <div style={{ display: "flex", gap: "6px" }}>
              {editingPlan ? (
                <>
                  <button
                    onClick={() => {
                      setEditCfg(cfg);
                      setEditingPlan(false);
                    }}
                    style={{
                      background: "rgba(255,255,255,0.15)",
                      border: "none",
                      color: "#fff",
                      borderRadius: "4px",
                      padding: "3px 10px",
                      fontSize: "11px",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => savePlanConfig(editCfg)}
                    style={{
                      background: "#2E7D32",
                      border: "none",
                      color: "#fff",
                      borderRadius: "4px",
                      padding: "3px 10px",
                      fontSize: "11px",
                      cursor: "pointer",
                      fontWeight: "bold",
                    }}
                  >
                    💾 Save Plan
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setEditCfg(cfg);
                    setEditingPlan(true);
                  }}
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "none",
                    color: "#fff",
                    borderRadius: "4px",
                    padding: "3px 10px",
                    fontSize: "11px",
                    cursor: "pointer",
                  }}
                >
                  ✏ Edit
                </button>
              )}
            </div>
          </div>
          <div style={{ padding: "10px 12px", fontSize: "11px" }}>
            {/* Personal Stats */}
            <div
              style={{
                fontSize: "10px",
                fontWeight: "bold",
                color: "#378ADD",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "6px",
              }}
            >
              👤 Personal Stats
            </div>
            {editingPlan ? (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "8px",
                  marginBottom: "10px",
                }}
              >
                <div>
                  <span style={lbl}>Age (yr)</span>
                  {num("age", 54)}
                </div>
                <div>
                  <span style={lbl}>Sex</span>
                  <select
                    value={editCfg.sex}
                    onChange={(e) => setE("sex", e.target.value)}
                    style={inp({ width: "70px" })}
                  >
                    <option value="m">Male</option>
                    <option value="f">Female</option>
                  </select>
                </div>
                <div>
                  <span style={lbl}>Height (cm)</span>
                  {num("heightCm", 54)}
                </div>
                <div>
                  <span style={lbl}>Start Wt (kg)</span>
                  {num("startWeightKg", 54, 0.1)}
                </div>
                <div>
                  <span style={lbl}>Start Date</span>
                  <input
                    type="date"
                    value={editCfg.startDate}
                    onChange={(e) => setE("startDate", e.target.value)}
                    style={inp({ width: "110px" })}
                  />
                </div>
                <div>
                  <span style={lbl}>VO₂ Max</span>
                  {num("vo2max", 54)}
                </div>
                <div>
                  <span style={lbl}>Target Min (kg)</span>
                  {num("targetWeightMinKg", 54, 0.1)}
                </div>
                <div>
                  <span style={lbl}>Target Max (kg)</span>
                  {num("targetWeightMaxKg", 54, 0.1)}
                </div>
                <div>
                  <span style={lbl}>Cum-loss base (kg)</span>
                  {num("cumLossBaselineKg", 54, 0.01)}
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "3px 12px",
                  marginBottom: "10px",
                }}
              >
                {[
                  ["Age", `${cfg.age} yr`],
                  ["Sex", cfg.sex === "m" ? "Male" : "Female"],
                  ["Height", `${cfg.heightCm} cm`],
                  ["Start Weight", `${cfg.startWeightKg.toFixed(1)} kg`],
                  ["Start BMI", bmi],
                  ["Target", `${cfg.targetWeightMinKg}–${cfg.targetWeightMaxKg} kg`],
                  ["Target BMI", `${tBmiLo}–${tBmiHi}`],
                  [
                    "VO₂ Max",
                    `${cfg.vo2max} — ${cfg.vo2max < 35 ? "Fair" : cfg.vo2max < 45 ? "Good" : "Excellent"}`,
                  ],
                  ["Cum-loss base", `${cumBaseline.toFixed(2)} kg`],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderBottom: "1px solid #F0F4F8",
                      padding: "2px 0",
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>{k}</span>
                    <span style={{ color: "#185FA5", fontWeight: "600" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Projection Curve */}
            <div
              style={{
                fontSize: "10px",
                fontWeight: "bold",
                color: "#378ADD",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "6px",
              }}
            >
              📈 Projection Curve
            </div>
            {editingPlan ? (
              <div style={{ marginBottom: "10px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(4,1fr)",
                    gap: "6px",
                    marginBottom: "8px",
                  }}
                >
                  <div>
                    <span style={lbl}>Maint. kcal</span>
                    {num("maintenanceCaloriesKcal", 60)}
                  </div>
                  <div style={{ gridColumn: "span 2" }}>
                    <span style={lbl}>Sync from (ignore earlier)</span>
                    <input
                      type="date"
                      value={editCfg.syncFromDate || editCfg.startDate || ""}
                      onChange={(e) => setE("syncFromDate", e.target.value)}
                      style={inp({ width: "110px" })}
                    />
                  </div>
                </div>

                <span style={lbl}>Anchor points (week 0 = Start Weight on Start Date)</span>
                <div
                  style={{
                    border: "0.5px solid #e5e7eb",
                    borderRadius: "4px",
                    padding: "6px",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "46px 66px 1fr 20px",
                      gap: "4px",
                      fontSize: "9px",
                      color: "#9ca3af",
                      marginBottom: "3px",
                    }}
                  >
                    <span>Week</span>
                    <span>Weight</span>
                    <span>Date</span>
                    <span />
                  </div>
                  {anchors.map((a, i) => (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "46px 66px 1fr 20px",
                        gap: "4px",
                        alignItems: "center",
                        marginBottom: "3px",
                      }}
                    >
                      <input
                        type="number"
                        step="1"
                        value={a.week ?? ""}
                        onChange={(e) => setAnchor(i, "week", parseFloat(e.target.value) || 0)}
                        style={inp({ width: "42px" })}
                      />
                      <input
                        type="number"
                        step="0.05"
                        value={a.weightKg ?? ""}
                        onChange={(e) => setAnchor(i, "weightKg", parseFloat(e.target.value) || 0)}
                        style={inp({ width: "62px" })}
                      />
                      <span style={{ fontSize: "10px", color: "#6b7280" }}>
                        {anchorDate(a.week)}
                      </span>
                      <button
                        onClick={() => delAnchor(i)}
                        title="Remove"
                        style={{
                          background: "none",
                          border: "none",
                          color: "#c62828",
                          cursor: "pointer",
                          fontSize: "12px",
                          padding: 0,
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addAnchor}
                    style={{
                      background: "#F7FAFD",
                      border: "0.5px solid #e5e7eb",
                      color: "#185FA5",
                      borderRadius: "4px",
                      padding: "2px 8px",
                      fontSize: "10px",
                      cursor: "pointer",
                      marginTop: "2px",
                    }}
                  >
                    + Add anchor
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "3px 12px",
                  marginBottom: "10px",
                }}
              >
                {[
                  ["Anchors", `${(cfg.planAnchors || []).length + 1} points`],
                  ["Plan length", planOK ? `${projSeries[projSeries.length - 1].week} weeks` : "—"],
                  [
                    "End weight",
                    planOK ? `${projSeries[projSeries.length - 1].projected.toFixed(1)} kg` : "—",
                  ],
                  ["Maintenance", `${(cfg.maintenanceCaloriesKcal || 0).toLocaleString()} kcal`],
                  ["Sync From", syncFrom || "—"],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      borderBottom: "1px solid #F0F4F8",
                      padding: "2px 0",
                    }}
                  >
                    <span style={{ color: "#6b7280" }}>{k}</span>
                    <span style={{ color: "#185FA5", fontWeight: "600" }}>{v}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Milestones */}
            <div
              style={{
                fontSize: "10px",
                fontWeight: "bold",
                color: "#378ADD",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: "6px",
              }}
            >
              🏁 Milestone Roadmap
            </div>
            <div style={{ marginBottom: "10px" }}>
              {milestones.map((m, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "75px 58px 1fr 34px",
                    gap: "4px",
                    padding: "3px 0",
                    borderBottom: "1px solid #F0F4F8",
                    alignItems: "center",
                  }}
                >
                  <span style={{ color: "#6b7280", fontSize: "10px" }}>{m.date}</span>
                  <span style={{ color: "#378ADD", fontWeight: "bold" }}>{m.weight}</span>
                  <span style={{ color: "#185FA5" }}>{m.note}</span>
                  <span
                    style={{
                      fontSize: "9px",
                      padding: "1px 4px",
                      borderRadius: "8px",
                      textAlign: "center",
                      background:
                        m.phase === "RESET"
                          ? "#FFF3CD"
                          : m.phase === "Phase 3"
                            ? "#E3F2FD"
                            : "#E8F5E9",
                      color:
                        m.phase === "RESET"
                          ? "#795548"
                          : m.phase === "Phase 3"
                            ? "#185FA5"
                            : "#2E7D32",
                    }}
                  >
                    {m.phase === "Phase 1" ? "P1" : m.phase === "Phase 3" ? "P3" : "RST"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
