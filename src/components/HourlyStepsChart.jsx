// src/components/HourlyStepsChart.jsx — the Steps-by-hour bar chart (compact or full screen):
// step-count gridlines, a bar per hour (with its value when expanded) and hour labels.
import { geometry, pad2 } from "../lib/hourlySteps";

function Gridline({ v, g }) {
  const y = g.yS(v);
  return (
    <g>
      <line
        x1={g.PAD.l}
        x2={g.W - g.PAD.r}
        y1={y}
        y2={y}
        stroke={v === 0 ? "#9ca3af" : "#eef0f3"}
        strokeWidth={0.6 * g.k}
      />
      <text x={g.PAD.l - 4 * g.k} y={y + 3 * g.k} fontSize={g.fs} fill="#6b7280" textAnchor="end">
        {v.toLocaleString()}
      </text>
    </g>
  );
}

function Bar({ h, v, g, hovered, onHover }) {
  const bh = (v / g.yMax) * g.cH;
  const x = g.PAD.l + h * g.bw;
  return (
    <g onMouseEnter={onHover}>
      <rect x={x} y={g.PAD.t} width={g.bw} height={g.cH} fill="transparent" />
      <rect
        x={x + g.bw * 0.15}
        y={g.PAD.t + g.cH - bh}
        width={g.bw * 0.7}
        height={Math.max(bh, v ? 1 : 0)}
        rx={1.5 * g.k}
        fill={hovered ? "#185FA5" : "#378ADD"}
      />
      {g.full && v > 0 && (
        <text
          x={x + g.bw / 2}
          y={g.PAD.t + g.cH - bh - 4 * g.k}
          fontSize={g.fs * 0.9}
          fill="#374151"
          textAnchor="middle"
        >
          {v.toLocaleString()}
        </text>
      )}
    </g>
  );
}

const HourLabel = ({ h, g }) => (
  <text
    x={g.PAD.l + h * g.bw + g.bw / 2}
    y={g.H - 5 * g.k}
    fontSize={g.fs}
    fill="#6b7280"
    textAnchor="middle"
  >
    {pad2(h)}
  </text>
);

export default function HourlyStepsChart({ vals, peakVal, full, box, hover, setHover }) {
  const g = geometry({ full, box, peakVal });
  return (
    <svg
      viewBox={`0 0 ${g.W} ${g.H}`}
      width={full ? g.W : "100%"}
      height={full ? g.H : undefined}
      style={{ display: "block" }}
      onMouseLeave={() => setHover(null)}
    >
      {g.ticks.map((v) => (
        <Gridline key={v} v={v} g={g} />
      ))}
      {vals.map((v, h) => (
        <Bar key={h} h={h} v={v} g={g} hovered={hover === h} onHover={() => setHover(h)} />
      ))}
      {g.xLabelHours.map((h) => (
        <HourLabel key={h} h={h} g={g} />
      ))}
    </svg>
  );
}
