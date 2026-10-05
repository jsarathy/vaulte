// src/components/HourlyStepsBody.jsx — the Steps-by-hour card's body: loading / empty notes, or the
// summary line (total, or the hovered hour; the peak hour) above the chart
import HourlyStepsChart from "./HourlyStepsChart";
import { hh, hoverLabel } from "../lib/hourlySteps";
import { summaryStyle, loadingStyle, emptyStyle, fullBoxStyle } from "../styles/hourlyStepsStyles";

function Summary({ s, vals, hover, full }) {
  return (
    <div style={summaryStyle(full)}>
      <span>{hover != null ? hoverLabel(hover, vals) : `${s.total.toLocaleString()} steps`}</span>
      <span>
        peak {hh(s.peak)} · {s.peakVal.toLocaleString()}
      </span>
    </div>
  );
}

export default function HourlyStepsBody({ s, vals, loading, c }) {
  if (loading) return <div style={loadingStyle}>loading…</div>;
  if (!s.total) return <div style={emptyStyle}>No hourly steps synced for this day yet</div>;
  const chart = <HourlyStepsChart vals={vals} peakVal={s.peakVal} {...c} />;
  return (
    <>
      <Summary s={s} vals={vals} hover={c.hover} full={c.full} />
      {c.full ? (
        <div ref={c.boxRef} style={fullBoxStyle}>
          {chart}
        </div>
      ) : (
        chart
      )}
    </>
  );
}
