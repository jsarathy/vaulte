// src/components/HourlyStepsCard.jsx — Apple Watch steps by hour for one day (from apple_activity.hourly)
// Double-click the chart to expand it full screen (Esc or double-click to collapse), like the Weight/Body trajectory charts.
import BrowseByDate from "./BrowseByDate";
import HourlyStepsBody from "./HourlyStepsBody";
import HourlyStepsFull from "./HourlyStepsFull";
import { useHourlyStepsCard } from "../hooks/useHourlySteps";
import { hourValues, summarise } from "../lib/hourlySteps";
import { cardStyle, cardHeadStyle, cardTitleStyle, paneStyle } from "../styles/hourlyStepsStyles";

export { niceAxis } from "../lib/hourlySteps";

export default function HourlyStepsCard(props) {
  const c = useHourlyStepsCard(props);
  const vals = hourValues(c.hourly);
  const s = summarise(vals);
  const body = <HourlyStepsBody s={s} vals={vals} loading={c.loading} c={c} />;
  if (c.full) return <HourlyStepsFull c={c}>{body}</HourlyStepsFull>;
  return (
    <div style={cardStyle}>
      <div style={cardHeadStyle}>
        <div style={cardTitleStyle}>
          <span style={{ fontSize: "16px" }}>⌚</span> Steps by hour
        </div>
        <BrowseByDate dark {...c} />
      </div>
      <div
        onDoubleClick={() => s.total && c.setFull(true)}
        title={s.total ? "Double-click to expand" : undefined}
        style={paneStyle(s.total)}
      >
        {body}
      </div>
    </div>
  );
}
