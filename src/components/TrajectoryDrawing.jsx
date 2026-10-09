// src/components/TrajectoryDrawing.jsx — the Trajectory chart's SVG: target zone, gridlines and
// axes, plan / reading / 2-wk avg lines, reading dots and (expanded) the hover label. Render only;
// L = lib/trajectoryChart chartLayout().
import {
  dateLabel,
  hitRadius,
  hoverBox,
  hoverLabel,
  linePath,
  targetZone,
  xTicks,
  yAxis,
} from "../lib/trajectoryChart.js";

const GRID = "#e5e7eb";
const AXIS = "#9ca3af";
const LABEL = "#6b7280";
const DOT = "#378ADD";

function TargetZone({ cfg, isPlan, L }) {
  const { hi, lo } = targetZone(cfg, isPlan, L);
  return (
    <>
      {hi != null && lo != null && (
        <rect
          x={L.PAD.left}
          y={hi}
          width={L.cW}
          height={Math.max(0, lo - hi)}
          fill="#C8E6C9"
          opacity="0.4"
        />
      )}
      {hi != null && (
        <text x={L.PAD.left + 3 * L.k} y={hi - 2 * L.k} fontSize={L.fs} fill="#2E7D32">
          Target {cfg.targetWeightMinKg}–{cfg.targetWeightMaxKg} kg
        </text>
      )}
    </>
  );
}

function YAxis({ L, unit }) {
  const { ticks, dec } = yAxis(L);
  const x = L.PAD.left - 4 * L.k;
  return (
    <>
      {ticks.map((w) => (
        <line
          key={w}
          x1={L.PAD.left}
          x2={L.PAD.left + L.cW}
          y1={L.yS(w)}
          y2={L.yS(w)}
          stroke={GRID}
          strokeWidth={0.5 * L.k}
        />
      ))}
      {ticks.map((w) => (
        <text
          key={"y" + w}
          x={x}
          y={L.yS(w) + 3 * L.k}
          fontSize={L.fs}
          fill={LABEL}
          textAnchor="end"
        >
          {w.toFixed(dec)}
        </text>
      ))}
      <text x={x} y={L.PAD.top - 3 * L.k} fontSize={L.fs} fill={AXIS} textAnchor="end">
        {unit}
      </text>
    </>
  );
}

function DateTick({ t, L, axisY }) {
  const x = L.xS(t);
  const y = axisY + 9 * L.k;
  return (
    <g>
      <line x1={x} x2={x} y1={axisY} y2={axisY + 4 * L.k} stroke={AXIS} strokeWidth={0.75 * L.k} />
      <text
        x={x}
        y={y}
        fontSize={L.fs}
        fill={LABEL}
        textAnchor="end"
        transform={`rotate(-45 ${x} ${y})`}
      >
        {dateLabel(t)}
      </text>
    </g>
  );
}

function XAxis({ L }) {
  const axisY = L.PAD.top + L.cH;
  return (
    <>
      <line
        x1={L.PAD.left}
        x2={L.PAD.left + L.cW}
        y1={axisY}
        y2={axisY}
        stroke={AXIS}
        strokeWidth={0.75 * L.k}
      />
      {xTicks(L).map((t) => (
        <DateTick key={"x" + t} t={t} L={L} axisY={axisY} />
      ))}
    </>
  );
}

function Lines({ series, L }) {
  const plan = linePath(series.projPts, L);
  const actual = linePath(series.acts, L);
  return (
    <>
      {plan && (
        <path
          d={plan}
          fill="none"
          stroke="#90CAF9"
          strokeWidth={L.sw}
          strokeDasharray={`${4 * L.k},${3 * L.k}`}
        />
      )}
      {actual && <path d={actual} fill="none" stroke={DOT} strokeWidth={L.actSW} opacity="0.6" />}
      {series.avgPts.length > 1 && (
        <path
          d={linePath(series.avgPts, L)}
          fill="none"
          stroke="#E65100"
          strokeWidth={2 * L.k}
          strokeLinejoin="round"
          style={{ pointerEvents: "none" }}
        />
      )}
    </>
  );
}

function Dots({ acts, L, hoverPt }) {
  return acts.map((a) => {
    const r = hoverPt?.t === a.t ? L.r * 1.6 : L.r;
    return (
      <circle
        key={a.date}
        cx={L.xS(a.t)}
        cy={L.yS(a.v)}
        r={r}
        fill={DOT}
        stroke="#fff"
        strokeWidth={Math.max(0.3, L.r * 0.3)}
        style={{ pointerEvents: "none" }}
      />
    );
  });
}

// Expanded view: invisible, day-wide hover areas over the readings
function HoverAreas({ acts, L, setHoverPt }) {
  return acts.map((a) => (
    <circle
      key={"h" + a.date}
      cx={L.xS(a.t)}
      cy={L.yS(a.v)}
      r={hitRadius(L)}
      fill="transparent"
      style={{ cursor: "pointer" }}
      onClick={() => setHoverPt({ t: a.t, v: a.v })} // a tap on a phone
      onMouseEnter={() => setHoverPt({ t: a.t, v: a.v })}
      onMouseLeave={() => setHoverPt(null)}
    />
  ));
}

function HoverLabel({ point, series, L }) {
  const label = hoverLabel(point, series);
  const { bx, by, bw, bh } = hoverBox(point, label, L);
  return (
    <g style={{ pointerEvents: "none" }}>
      <rect x={bx} y={by} width={bw} height={bh} rx={4} fill="#1f2937" opacity="0.92" />
      <text
        x={bx + bw / 2}
        y={by + bh / 2 + L.fs * 0.35}
        fontSize={L.fs}
        fill="#fff"
        textAnchor="middle"
        fontWeight="500"
      >
        {label}
      </text>
    </g>
  );
}

export default function TrajectoryDrawing({ series, cfg, L, chart }) {
  return (
    <svg
      width={L.full ? L.W : "100%"}
      height={L.full ? L.H : undefined}
      viewBox={`0 0 ${L.W} ${L.H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      <TargetZone cfg={cfg} isPlan={series.isPlan} L={L} />
      <YAxis L={L} unit={series.unit} />
      <XAxis L={L} />
      <Lines series={series} L={L} />
      <Dots acts={series.acts} L={L} hoverPt={chart.hoverPt} />
      {L.full && <HoverAreas acts={series.acts} L={L} setHoverPt={chart.setHoverPt} />}
      {L.full && chart.hoverPt && <HoverLabel point={chart.hoverPt} series={series} L={L} />}
    </svg>
  );
}
