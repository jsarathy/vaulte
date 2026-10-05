// src/components/AppleActivityHeader.jsx — the Apple Watch card's title bar: chevron, title,
// loading / synced status and (collapsed) the steps · kcal summary
import { C } from "../constants/design.jsx";
import { statusText, summaryText } from "../lib/appleActivity";
import {
  headStyle,
  titleRowStyle,
  chevronStyle,
  titleStyle,
  statusRowStyle,
  statusStyle,
  summaryStyle,
} from "../styles/appleActivityStyles";

const Chevron = ({ collapsed }) => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 10 10"
    fill="none"
    stroke={C.hint}
    strokeWidth="1.5"
    strokeLinecap="round"
    style={chevronStyle(collapsed)}
  >
    <path d="M2 3.5l3 3 3-3" />
  </svg>
);

export default function AppleActivityHeader({ collapsed, onToggle, s }) {
  return (
    <div onClick={onToggle} style={headStyle(collapsed, onToggle)}>
      <div style={titleRowStyle}>
        <Chevron collapsed={collapsed} />
        <span style={titleStyle}>⌚ Apple Watch Activity</span>
      </div>
      <div style={statusRowStyle}>
        <span style={statusStyle}>{statusText(s.loading, s.synced)}</span>
        {collapsed && <span style={summaryStyle(s.hasData)}>{summaryText(s.hasData, s.a)}</span>}
      </div>
    </div>
  );
}
