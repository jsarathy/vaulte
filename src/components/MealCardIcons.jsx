// src/components/MealCardIcons.jsx — the small icons on a Daily log meal card.
import { C } from "../constants/design.jsx";

export function MealIcon({ isExercise }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke={isExercise ? C.blue : C.hint}
      strokeWidth="1.5"
      strokeLinecap="round"
      style={{ flexShrink: 0 }}
    >
      {isExercise ? (
        <>
          <path d="M3 8h10M8 3l3 5-3 5" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="5" />
          <path d="M5 8h6" />
          <path d="M8 5v6" />
        </>
      )}
    </svg>
  );
}

export function Chevron({ closed }) {
  const turn = {
    flexShrink: 0,
    transition: "transform 0.18s",
    transform: closed ? "rotate(-90deg)" : "rotate(0deg)",
  };
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      fill="none"
      stroke={C.hint}
      strokeWidth="1.5"
      strokeLinecap="round"
      style={turn}
    >
      <path d="M2 3.5l3 3 3-3" />
    </svg>
  );
}
