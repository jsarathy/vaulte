// src/components/BodyTrajectory.jsx — the Body tab's Trajectory panel: site pills (notes only
// when expanded) and the chosen site's tape readings. Render only; chart =
// useTrajectoryChart("waist"), shared with the anatomy figure.
import { MEASURE, measureTabs } from "../lib/bodyMeasures.js";
import { bodySeries } from "../lib/trajectoryChart.js";
import { useIsPhone } from "../hooks/useIsPhone.js";
import MetricMenu from "./MetricMenu.jsx";
import MetricTabs from "./MetricTabs.jsx";
import TrajectoryFrame from "./TrajectoryFrame.jsx";
import { ChartBody, ChartEmpty, ChartLegend } from "./TrajectoryChart.jsx";

const noteOf = (site) => ({ title: <>{MEASURE[site].label} (cm)</>, info: MEASURE[site].info });

function BodyChart({ bodyLog, chart }) {
  const series = bodySeries(bodyLog, chart.metric);
  if (series.acts.length < 2)
    return (
      <ChartEmpty full={chart.full}>
        Needs at least two {MEASURE[chart.metric].label} readings
      </ChartEmpty>
    );
  const legend = <ChartLegend full={chart.full} projected={false} />;
  return <ChartBody series={series} cfg={{}} chart={chart} legend={legend} />;
}

export default function BodyTrajectory({ bodyLog, chart }) {
  const phone = useIsPhone();
  const tabs = <MetricTabs tabs={measureTabs} chart={chart} noteOf={chart.full ? noteOf : null} />;
  const menu = phone ? <MetricMenu tabs={measureTabs} chart={chart} /> : null;
  return (
    <TrajectoryFrame chart={chart} tabs={tabs} nowrap touch={phone} menu={menu}>
      <BodyChart bodyLog={bodyLog} chart={chart} />
    </TrajectoryFrame>
  );
}
