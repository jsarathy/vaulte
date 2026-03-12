// src/constants/weightPlan.js

export const DEFAULT_PLAN_CONFIG = {
  // Personal
  age:60, sex:"m", heightCm:165, startWeightKg:84.0, startDate:"2026-03-09",
  targetWeightMinKg:70, targetWeightMaxKg:72, vo2max:33,
  // AM session
  amDurationMin:20, amHRMin:128, amHRMax:140, amKcalMin:180, amKcalMax:200,
  // PM session
  pmDurationMin:30, pmHRMin:100, pmHRMax:110, pmKcalMin:150, pmKcalMax:180,
  // Nutrition
  dailyCaloriesKcal:1800, proteinMinG:80, proteinMaxG:100, activeDaysPerWeek:5.5,
  // Plan structure
  phase1Weeks:24, resetWeeks:2, weeklyLossKg:0.55, maintenanceCaloriesKcal:2136,
  // Plateau levers
  lever1PmMin:40, lever2CaloriesKcal:1675,
};

export function generateWeightProjection(cfg) {
  const rows = [];
  let d = new Date(cfg.startDate + "T12:00:00");
  const phase1EndWeight = parseFloat((cfg.startWeightKg - (cfg.phase1Weeks - 1) * cfg.weeklyLossKg).toFixed(1));

  for (let week = 1; week <= 60; week++) {
    const dateStr = `${String(d.getDate()).padStart(2,"0")} ${d.toLocaleString("en-GB",{month:"short"})} ${d.getFullYear()}`;
    let phase, projected;
    if (week <= cfg.phase1Weeks) {
      phase = "Phase 1 — Active";
      projected = parseFloat((cfg.startWeightKg - (week - 1) * cfg.weeklyLossKg).toFixed(1));
    } else if (week <= cfg.phase1Weeks + cfg.resetWeeks) {
      phase = "RESET";
      projected = phase1EndWeight;
    } else {
      const p3Week = week - cfg.phase1Weeks - cfg.resetWeeks;
      phase = "Phase 3 — Resume";
      projected = parseFloat((phase1EndWeight - p3Week * cfg.weeklyLossKg).toFixed(1));
    }
    projected = Math.max(projected, parseFloat((cfg.targetWeightMinKg - 0.5).toFixed(1)));
    rows.push({ week, date: dateStr, projected, phase });
    d = new Date(d.getTime() + 7 * 24 * 60 * 60 * 1000);
    if (phase === "Phase 3 — Resume" && projected <= cfg.targetWeightMinKg) {
      for (let e = 1; e <= 2; e++) {
        const ed = new Date(d.getTime() + (e - 1) * 7 * 24 * 60 * 60 * 1000);
        rows.push({
          week: week + e,
          date: `${String(ed.getDate()).padStart(2,"0")} ${ed.toLocaleString("en-GB",{month:"short"})} ${ed.getFullYear()}`,
          projected: cfg.targetWeightMinKg,
          phase: "Phase 3 — Resume"
        });
      }
      break;
    }
    if (week >= 52) break;
  }
  return rows;
}

export function deriveMilestones(cfg, proj) {
  const toMY = ds => { if (!ds) return ""; const p = ds.split(" "); return p.length >= 3 ? `${p[1]} ${p[2]}` : ds; };
  const p1rows   = proj.filter(r => r.phase === "Phase 1 — Active");
  const loss4    = p1rows.find(r => r.projected <= cfg.startWeightKg - 4);
  const loss8    = p1rows.find(r => r.projected <= cfg.startWeightKg - 8);
  const resetRow = proj.find(r => r.phase === "RESET");
  const p3rows   = proj.filter(r => r.phase === "Phase 3 — Resume");
  const p3Start  = p3rows[0];
  const p3mid    = p3rows[Math.floor(p3rows.length / 2)];
  const targetRow = p3rows.find(r => r.projected <= cfg.targetWeightMaxKg);
  return [
    { date:proj[0]?.date||"", weight:`${cfg.startWeightKg.toFixed(1)} kg`, note:"START — Plan begins", phase:"Phase 1" },
    loss4    && { date:toMY(loss4.date),    weight:`~${loss4.projected.toFixed(0)} kg`,    note:"Clothes noticeably looser",                              phase:"Phase 1" },
    loss8    && { date:toMY(loss8.date),    weight:`~${loss8.projected.toFixed(0)} kg`,    note:"Mirror change visible",                                  phase:"Phase 1" },
    resetRow && { date:resetRow.date,       weight:`~${resetRow.projected.toFixed(0)} kg`, note:`Maintenance at ${cfg.maintenanceCaloriesKcal} kcal`,     phase:"RESET"   },
    p3Start  && { date:toMY(p3Start.date),  weight:`~${p3Start.projected.toFixed(0)} kg`,  note:"Recalibrated plan restarts",                            phase:"Phase 3" },
    p3mid && p3mid !== p3Start && { date:toMY(p3mid.date), weight:`~${p3mid.projected.toFixed(0)} kg`,
      note:`PM +${cfg.lever1PmMin - cfg.pmDurationMin} min / ${cfg.lever2CaloriesKcal} kcal option`, phase:"Phase 3" },
    targetRow && { date:toMY(targetRow.date), weight:`${cfg.targetWeightMinKg}-${cfg.targetWeightMaxKg} kg`, note:"TARGET ZONE", phase:"Phase 3" },
  ].filter(Boolean);
}
