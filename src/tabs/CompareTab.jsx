// src/tabs/CompareTab.jsx — Compare days (left) beside the Reference Diet Calculator (right)
import CompareDays from "../components/CompareDays";
import ReferenceCalculator from "../components/ReferenceCalculator";
import { frameStyle } from "../styles/compareStyles";

export default function CompareTab(p) {
  return (
    <div style={frameStyle}>
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
