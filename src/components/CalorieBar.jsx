// src/components/CalorieBar.jsx — the Daily log's net kcal against the day's energy target,
// the macro pills, fat burned, what's left, and a progress bar.
import { C, FONT } from "../constants/design.jsx";
import { macroPills, leftParts } from "../lib/dayBudget.js";
import { fmt } from "../constants/helpers.js";
import { useIsPhone } from "../hooks/useIsPhone.js";

const BOX = {
  background: "#fff",
  border: `0.5px solid ${C.border}`,
  borderRadius: "8px",
  padding: "12px 14px",
  marginBottom: "10px",
};
const TOP = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "8px",
};
const FIGURE = {
  fontFamily: FONT.mono,
  fontSize: "20px",
  fontWeight: "500",
  color: C.text,
  letterSpacing: "-0.5px",
};
// pill colours: [background, text, border] per tone, and when over the target
const TONES = {
  blue: [C.blueBg, C.blueText, `1px solid ${C.blueMid}`],
  amber: [C.amberBg, C.amberText, `1px solid ${C.amberBg}`],
  over: [C.dangerBg, C.danger, `1px solid ${C.danger}`],
  left: [C.greenBg, C.greenText, `1px solid ${C.greenBg}`],
  burn: [C.bg, C.muted, `1px solid ${C.border}`],
};

function Pill({ label, tone, children }) {
  const [bg, col, border] = TONES[tone];
  const box = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    background: bg,
    border: border,
    borderRadius: "8px",
    padding: "5px 10px",
    minWidth: "52px",
  };
  const name = {
    fontSize: "9px",
    fontWeight: "500",
    color: col,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    opacity: 0.8,
  };
  const figure = {
    fontFamily: FONT.mono,
    fontSize: "14px",
    fontWeight: "500",
    color: col,
    letterSpacing: "-0.3px",
    lineHeight: 1.2,
  };
  return (
    <div style={box}>
      <span style={name}>{label}</span>
      <span style={figure}>{children}</span>
    </div>
  );
}

function Progress({ pct }) {
  const fill = {
    height: "100%",
    width: `${pct}%`,
    background: C.blue,
    borderRadius: "2px",
    transition: "width 0.3s",
  };
  return (
    <div style={{ height: "4px", background: C.bg, borderRadius: "2px", overflow: "hidden" }}>
      <div style={fill} />
    </div>
  );
}

export default function CalorieBar({ budget, totals }) {
  const { net, tdee, tier, left, target, pct } = budget;
  const [sign, amount] = leftParts(left);
  const phone = useIsPhone();
  const wrap = phone ? { flexWrap: "wrap", gap: "8px" } : null; // pills drop under the figure
  const wrapPills = phone ? { flexWrap: "wrap" } : null;
  return (
    <div style={BOX}>
      <div style={{ ...TOP, ...wrap }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
          <span style={FIGURE}>{Math.round(net).toLocaleString()}</span>
          <span style={{ fontSize: "11px", color: C.muted }}>
            net kcal of {tdee.toLocaleString()} · {tier.label}
          </span>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", ...wrapPills }}>
          {macroPills(totals, target).map((m) => (
            <Pill key={m.label} label={m.label} tone={m.over ? "over" : m.tone}>
              {m.grams}g
            </Pill>
          ))}
          <Pill label="Fat burned" tone="burn">
            {fmt(totals.fatBurnedG)}g
          </Pill>
          <Pill label="Left" tone={left < 0 ? "over" : "left"}>
            {sign}‎{amount}
          </Pill>
        </div>
      </div>
      <Progress pct={pct} />
    </div>
  );
}
