// src/components/NavIcons.jsx — the navigation icons: home, person, plate. They take the button's
// colour (currentColor), so the selected item turns gold with its label.

const svg = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const HomeIcon = () => (
  <svg {...svg}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v10h13V10" />
    <path d="M10 20v-5.5h4V20" />
  </svg>
);

export const PersonIcon = () => (
  <svg {...svg}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4.5 20.5c.6-4 3.6-6.5 7.5-6.5s6.9 2.5 7.5 6.5" />
  </svg>
);

export const PlateIcon = () => (
  <svg {...svg}>
    <circle cx="12" cy="12" r="4.5" />
    <path d="M3.5 4v5.5a1.5 1.5 0 0 0 3 0V4M5 4v16" />
    <path d="M20.5 20V4c-1.7 1.4-2.5 3.6-2.5 6.5V14h2.5" />
  </svg>
);
