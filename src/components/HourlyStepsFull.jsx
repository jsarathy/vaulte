// src/components/HourlyStepsFull.jsx — the Steps-by-hour chart expanded full screen
// (Esc or double-click to collapse), like the Weight/Body trajectory charts
import BrowseByDate from "./BrowseByDate";
import {
  fullStyle,
  fullHeadStyle,
  fullTitleRowStyle,
  fullTitleStyle,
  fullHintStyle,
} from "../styles/hourlyStepsStyles";

export default function HourlyStepsFull({ c, children }) {
  return (
    <div
      onDoubleClick={() => c.setFull(false)}
      title="Double-click or press Esc to collapse"
      style={fullStyle}
    >
      <div style={fullHeadStyle}>
        <div style={fullTitleRowStyle}>
          <span style={fullTitleStyle}>⌚ Steps by hour</span>
          <BrowseByDate dark={false} {...c} />
        </div>
        <span style={fullHintStyle}>Esc or double-click to collapse</span>
      </div>
      {children}
    </div>
  );
}
