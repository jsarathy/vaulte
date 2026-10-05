// src/components/AnatomyFigure.jsx — the Body tab's front-view figure with a dashed tape ring per
// site; the active site's ring is highlighted, with its name and latest reading beside it.
// Render only; shapes from lib/anatomy.
import { MEASURE } from "../lib/bodyMeasures.js";
import { X, figureShape, highlight } from "../lib/anatomy.js";

const BODY = "#C9D8EC";
const RING = "#90A4C0";
const HI = "#E8710A";

function Silhouette({ shape }) {
  return (
    <>
      {shape.isF && (
        <path
          d={`M${X - 19},34 C${X - 22},10 ${X + 22},10 ${X + 19},34 L${X + 20},72 L${X - 20},72 Z`}
          fill="#AFC2DD"
        />
      )}
      <g fill={BODY}>
        <ellipse cx={X} cy={38} rx={shape.head[0]} ry={shape.head[1]} />
        {shape.parts.map((d, i) => (
          <g key={i}>
            <path d={d} />
            <path d={d} transform={`translate(${2 * X},0) scale(-1,1)`} />
          </g>
        ))}
      </g>
    </>
  );
}

function Rings({ rings, active }) {
  return Object.entries(rings).map(
    ([k, r2]) =>
      k !== active && (
        <ellipse
          key={k}
          cx={r2.cx}
          cy={r2.y}
          rx={r2.hw + 2}
          ry={2.6}
          fill="none"
          stroke={RING}
          strokeWidth="0.8"
          strokeDasharray="2,1.6"
          opacity="0.8"
        />
      ),
  );
}

function Highlight({ hl, value }) {
  const { ring: ar, labelRight } = hl;
  const x = labelRight ? 196 : 4;
  const anchor = labelRight ? "end" : "start";
  return (
    <g>
      <ellipse
        cx={ar.cx}
        cy={ar.y}
        rx={ar.hw + 3}
        ry={3.4}
        fill={HI}
        fillOpacity="0.15"
        stroke={HI}
        strokeWidth="2"
      />
      <line
        x1={labelRight ? ar.cx + ar.hw + 4 : ar.cx - ar.hw - 4}
        y1={ar.y}
        x2={x}
        y2={ar.y}
        stroke={HI}
        strokeWidth="0.7"
      />
      <text x={x} y={ar.y - 4} fontSize="9" fontWeight="bold" fill={HI} textAnchor={anchor}>
        {MEASURE[hl.site].label}
      </text>
      {value != null && (
        <text x={x} y={ar.y + 10} fontSize="8.5" fill="#6b7280" textAnchor={anchor}>
          {Number(value).toFixed(1)} cm
        </text>
      )}
    </g>
  );
}

/** active: the site to highlight; latest: { site: reading } from latestReadings. */
export default function AnatomyFigure({ sex, active, latest }) {
  const shape = figureShape(sex);
  const hl = highlight(shape.rings, active);
  return (
    <svg
      viewBox="0 0 200 410"
      style={{ display: "block", height: "360px", maxWidth: "100%", margin: "0 auto" }}
    >
      <Silhouette shape={shape} />
      <Rings rings={shape.rings} active={hl?.site ?? null} />
      {hl && <Highlight hl={hl} value={latest[hl.site]} />}
      <text x={14} y={404} fontSize="8" fill="#9ca3af">
        R
      </text>
      <text x={186} y={404} fontSize="8" fill="#9ca3af" textAnchor="end">
        L
      </text>
    </svg>
  );
}
