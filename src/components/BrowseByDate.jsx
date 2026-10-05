// src/components/BrowseByDate.jsx — the Steps-by-hour card's date and "Browse by date" button, with
// its hidden picker (dark = on the card's blue title bar; light = on the full-screen view)
import { fmtDate, todayISO } from "../lib/hourlySteps";
import {
  browseRowStyle,
  browseDateStyle,
  browseButtonStyle,
  hiddenPickerStyle,
} from "../styles/hourlyStepsStyles";

export default function BrowseByDate({ dark, date, setDate, pickerRef, openPicker }) {
  return (
    <div style={browseRowStyle}>
      <span style={browseDateStyle(dark)}>{fmtDate(date)}</span>
      <button
        onClick={openPicker}
        onDoubleClick={(e) => e.stopPropagation()}
        title="Pick a day"
        style={browseButtonStyle(dark)}
      >
        📅 Browse by date
      </button>
      <input
        ref={pickerRef}
        type="date"
        value={date || ""}
        max={todayISO()}
        onChange={(e) => e.target.value && setDate(e.target.value)}
        style={hiddenPickerStyle}
      />
    </div>
  );
}
