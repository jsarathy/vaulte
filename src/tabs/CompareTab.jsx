// src/tabs/CompareTab.jsx — Compare days (left) beside the Reference Diet Calculator (right)
import CompareDays from "../components/CompareDays";
import ReferenceCalculator from "../components/ReferenceCalculator";
import { frameStyle } from "../styles/compareStyles";
import { useIsPhone } from "../hooks/useIsPhone.js";

// Phone: the calculator pill, then the days, in one scrolling column
const PHONE_FRAME = { ...frameStyle, flexDirection: "column", overflowY: "auto" };

export default function CompareTab(p) {
  const phone = useIsPhone();
  const calc = <ReferenceCalculator p={p} />;
  return (
    <div style={phone ? PHONE_FRAME : frameStyle}>
      {phone && calc}
      <CompareDays
        slots={p.compareSlots}
        data={p.compareData}
        allDays={p.allDays}
        setSlots={p.setCompareSlots}
        setData={p.setCompareData}
      />
      {!phone && calc}
    </div>
  );
}
