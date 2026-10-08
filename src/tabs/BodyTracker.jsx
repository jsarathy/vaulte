// src/tabs/BodyTracker.jsx — the Body tab: Renpho Smart Body Tape Measure readings (cm), one row
// per date in users/{uid}/body_log/{date}. Layout mirrors WeightTracker: the log on the left, the
// Trajectory chart and the measurement sites figure on the right. Render only.
import useTrajectoryChart from "../hooks/useTrajectoryChart.js";
import BodyLogPanel from "../components/BodyLogPanel.jsx";
import BodyTrajectory from "../components/BodyTrajectory.jsx";
import MeasurementSites from "../components/MeasurementSites.jsx";
import { useIsPhone } from "../hooks/useIsPhone.js";
import { columnStyle, pageStyle } from "../lib/phoneLayout.js";

const FRAME = {
  flex: 1,
  overflowY: "auto",
  display: "flex",
  gap: "14px",
  alignItems: "flex-start",
  padding: "16px",
};

export default function BodyTracker({ userId, bodyLog, setBodyLog, sex }) {
  const chart = useTrajectoryChart("waist"); // shared with the anatomy figure
  const phone = useIsPhone();
  return (
    <div style={pageStyle(phone, FRAME)}>
      {/* ── LEFT: Body Log Table (55%) ── */}
      <BodyLogPanel phone={phone} userId={userId} bodyLog={bodyLog} setBodyLog={setBodyLog} />
      {/* ── RIGHT: Chart + Specs (43%) ── */}
      <div style={columnStyle(phone, 43)}>
        <BodyTrajectory bodyLog={bodyLog} chart={chart} />
        <MeasurementSites bodyLog={bodyLog} sex={sex} chart={chart} />
      </div>
    </div>
  );
}
