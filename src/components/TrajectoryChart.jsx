// src/components/TrajectoryChart.jsx — the Weight tab's Trajectory chart for the chosen metric:
// legend and drawing, or a hint when there's too little to draw; its parts are shared with the
// Body tab's chart. Render only; figures from lib/trajectoryChart, chart = useTrajectoryChart().
import { chartLayout, chartSeries, hasEnough, latestX } from "../lib/trajectoryChart.js";
import TrajectoryDrawing from "./TrajectoryDrawing.jsx";

const SCROLLBAR_CSS = `
  .vaulte-chart-scroll { scrollbar-width: auto; scrollbar-color: #9ca3af #f3f4f6; }
  .vaulte-chart-scroll::-webkit-scrollbar { height: 16px; }
  .vaulte-chart-scroll::-webkit-scrollbar-track { background: #f3f4f6; border-radius: 8px; }
  .vaulte-chart-scroll::-webkit-scrollbar-thumb { background: #9ca3af; border-radius: 8px; border: 3px solid #f3f4f6; }
  .vaulte-chart-scroll::-webkit-scrollbar-thumb:hover { background: #6b7280; }
`;
const S = {
  empty: (full) => ({
    height: full ? "70vh" : "200px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#9ca3af",
    fontSize: "12px",
  }),
  legend: (full) => ({
    display: "flex",
    gap: "14px",
    justifyContent: "flex-end",
    fontSize: full ? "12px" : "10px",
    color: "#6b7280",
    marginBottom: "4px",
  }),
  item: { display: "flex", alignItems: "center", gap: "5px" },
  scroll: { overflowX: "auto", overflowY: "hidden", flex: 1, minHeight: 0 },
};

/** The hint shown instead of a chart. */
export function ChartEmpty({ full, children }) {
  return <div style={S.empty(full)}>{children}</div>;
}

/** projected: list the plan curve (Weight tab); showAvg: list the 2-wk average. */
export function ChartLegend({ full, projected = true, showAvg }) {
  return (
    <div style={S.legend(full)}>
      {projected && (
        <span style={S.item}>
          <svg width="16" height="4">
            <line
              x1="0"
              y1="2"
              x2="16"
              y2="2"
              stroke="#90CAF9"
              strokeWidth="1.5"
              strokeDasharray="4,3"
            />
          </svg>
          Projected
        </span>
      )}
      <span style={S.item}>
        <svg width="16" height="6">
          <line x1="0" y1="3" x2="16" y2="3" stroke="#378ADD" strokeWidth="2" />
          <circle cx="8" cy="3" r="2.5" fill="#378ADD" />
        </svg>
        Actual
      </span>
      {showAvg && (
        <span style={S.item}>
          <svg width="16" height="4">
            <line x1="0" y1="2" x2="16" y2="2" stroke="#E65100" strokeWidth="2.5" />
          </svg>
          2-wk avg
        </span>
      )}
    </div>
  );
}

/** Legend, then the drawing in its scroller (expanded: scrolls sideways to the latest reading). */
export function ChartBody({ series, cfg, chart, legend }) {
  const L = chartLayout(series, cfg, { full: chart.full, box: chart.box });
  chart.latestXRef.current = latestX(series, L);
  return (
    <>
      {legend}
      <style>{SCROLLBAR_CSS}</style>
      <div
        ref={chart.scrollRef}
        className={chart.full ? "vaulte-chart-scroll" : undefined}
        style={chart.full ? S.scroll : undefined}
      >
        <TrajectoryDrawing series={series} cfg={cfg} L={L} chart={chart} />
      </div>
    </>
  );
}

export default function TrajectoryChart({ weightLog, cfg, chart }) {
  const series = chartSeries(weightLog, chart.metric, cfg);
  if (!hasEnough(series))
    return (
      <ChartEmpty full={chart.full}>
        {series.isPlan
          ? "Set a start date, start weight and curve anchors to see the projection"
          : "Needs at least two readings — sync Renpho to fill this in"}
      </ChartEmpty>
    );
  const showAvg = series.isPlan && series.avgPts.length > 1;
  const legend = <ChartLegend full={chart.full} showAvg={showAvg} />;
  return <ChartBody series={series} cfg={cfg} chart={chart} legend={legend} />;
}
