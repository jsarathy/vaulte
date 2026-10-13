// src/components/PolarZoneTable.jsx — the heart-rate zones of a session: the bpm range of each and
// what it means (in the "log a Polar session" box). `large` is the version for the expanded box.
// Render only; rows from lib/polarHeartRate.
import { C, FONT } from "../constants/design.jsx";
import { maxHrOf, zoneTable } from "../lib/polarHeartRate.js";

const S = {
  wrap: { marginBottom: "14px" },
  caption: { fontSize: "10px", color: C.hint, marginBottom: "5px" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: "10px", color: C.muted },
  cell: { padding: "3px 6px 3px 0", textAlign: "left", verticalAlign: "top" },
  head: { fontWeight: "500", color: C.hint, textTransform: "uppercase", letterSpacing: "0.4px" },
  zone: { whiteSpace: "nowrap", fontWeight: "500", color: C.text },
  bpm: { whiteSpace: "nowrap", fontFamily: FONT.mono, color: C.text },
  swatch: (color) => ({
    display: "inline-block",
    width: "8px",
    height: "8px",
    borderRadius: "2px",
    background: color,
    marginRight: "5px",
  }),
};
const LARGE = {
  table: { fontSize: "16px" },
  caption: { fontSize: "14px" },
  cell: { padding: "6px 14px 6px 0" },
};
const big = (large, base, extra) => (large ? { ...base, ...extra } : base);

const basis = (s) =>
  s.hr_max ? "this session's highest reading" : "a default: Polar gave no maximum";

function Row({ z, large }) {
  const cell = big(large, S.cell, LARGE.cell);
  return (
    <tr>
      <td style={{ ...cell, ...S.zone }}>
        <span style={S.swatch(z.color)} />
        {z.label} {z.name}
      </td>
      <td style={{ ...cell, ...S.bpm }}>{z.range}</td>
      <td style={cell}>{z.meaning}</td>
    </tr>
  );
}

export default function PolarZoneTable({ session, large = false }) {
  const maxHr = maxHrOf(session);
  const cell = { ...big(large, S.cell, LARGE.cell), ...S.head };
  return (
    <div style={S.wrap}>
      <div style={big(large, S.caption, LARGE.caption)}>
        Zones are shares of {maxHr} bpm ({basis(session)})
      </div>
      <table style={big(large, S.table, LARGE.table)}>
        <thead>
          <tr>
            <th style={cell}>Zone</th>
            <th style={cell}>bpm</th>
            <th style={cell}>What it means</th>
          </tr>
        </thead>
        <tbody>
          {zoneTable(maxHr).map((z) => (
            <Row key={z.label} z={z} large={large} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
