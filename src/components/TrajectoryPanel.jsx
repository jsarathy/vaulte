// src/components/TrajectoryPanel.jsx — the Weight tab's Trajectory panel: heading, metric tabs and
// the chart. Double-click fills the screen; Esc or double-click collapses. Render only.
import useTrajectoryChart from "../hooks/useTrajectoryChart.js";
import { metricHeading, metricInfo, metricTabs } from "../lib/weightMetrics.js";
import MetricMenu from "./MetricMenu.jsx";
import MetricTabs from "./MetricTabs.jsx";
import TrajectoryChart from "./TrajectoryChart.jsx";
import { useIsPhone } from "../hooks/useIsPhone.js";
import TrajectoryFrame from "./TrajectoryFrame.jsx";

const noteOf = (metric) => ({ title: metricHeading(metric), info: metricInfo(metric) });

export default function TrajectoryPanel({ weightLog, cfg }) {
  const chart = useTrajectoryChart();
  const phone = useIsPhone();
  const list = metricTabs(weightLog);
  const tabs = <MetricTabs tabs={list} chart={chart} noteOf={noteOf} />;
  const menu = phone ? <MetricMenu tabs={list} chart={chart} /> : null;
  return (
    <TrajectoryFrame chart={chart} tabs={tabs} touch={phone} menu={menu}>
      <TrajectoryChart weightLog={weightLog} cfg={cfg} chart={chart} />
    </TrajectoryFrame>
  );
}
