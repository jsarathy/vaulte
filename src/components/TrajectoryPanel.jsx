// src/components/TrajectoryPanel.jsx — the Weight tab's Trajectory panel: heading, metric tabs and
// the chart. Double-click fills the screen; Esc or double-click collapses. Render only.
import useTrajectoryChart from "../hooks/useTrajectoryChart.js";
import { metricHeading, metricInfo, metricTabs } from "../lib/weightMetrics.js";
import MetricTabs from "./MetricTabs.jsx";
import TrajectoryChart from "./TrajectoryChart.jsx";
import { useIsPhone } from "../hooks/useIsPhone.js";
import TrajectoryFrame from "./TrajectoryFrame.jsx";

const noteOf = (metric) => ({ title: metricHeading(metric), info: metricInfo(metric) });

export default function TrajectoryPanel({ weightLog, cfg }) {
  const chart = useTrajectoryChart();
  const phone = useIsPhone();
  const tabs = <MetricTabs tabs={metricTabs(weightLog)} chart={chart} noteOf={noteOf} />;
  return (
    <TrajectoryFrame chart={chart} tabs={tabs} tapToClose={phone}>
      <TrajectoryChart weightLog={weightLog} cfg={cfg} chart={chart} />
    </TrajectoryFrame>
  );
}
