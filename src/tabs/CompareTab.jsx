// src/tabs/CompareTab.jsx — Compare days (left) beside the Reference Diet Calculator (right)
import CompareDays from "../components/CompareDays";
import ReferenceCalculator from "../components/ReferenceCalculator";
import { frameStyle } from "../styles/compareStyles";
import { useIsPhone } from "../hooks/useIsPhone.js";

// Phone: the days, then the calculator, in one scrolling column
const PHONE_FRAME = { ...frameStyle, flexDirection: "column", overflowY: "auto" };

export default function CompareTab(p) {
  return (
    <div style={useIsPhone() ? PHONE_FRAME : frameStyle}>
      <CompareDays
        slots={p.compareSlots}
        data={p.compareData}
        allDays={p.allDays}
        setSlots={p.setCompareSlots}
        setData={p.setCompareData}
      />
      <ReferenceCalculator p={p} />
    </div>
  );
}
