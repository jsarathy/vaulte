// src/components/BrowseByDate.jsx — the Steps-by-hour card's date and "Browse by date" button, with
// its hidden picker (dark = on the card's blue title bar; light = on the full-screen view)
import { fmtDate, todayISO } from "../lib/hourlySteps";
import {
  browseRowStyle,
  browseDateStyle,
  browseButtonStyle,
  hiddenPickerStyle,
  browseWrapStyle,
} from "../styles/hourlyStepsStyles";

export default function BrowseByDate({ dark, date, setDate, pickerRef, openPicker }) {
  return (
    <div style={browseRowStyle}>
      <span style={browseDateStyle(dark)}>{fmtDate(date)}</span>
      <span style={browseWrapStyle}>
        <button tabIndex={-1} style={browseButtonStyle(dark)} aria-hidden="true">
          📅 Browse by date
        </button>
        <input
          ref={pickerRef}
          type="date"
          aria-label="📅 Browse by date"
          title="Pick a day"
          value={date || ""}
          max={todayISO()}
          onClick={openPicker}
          onDoubleClick={(e) => e.stopPropagation()}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          style={hiddenPickerStyle}
        />
      </span>
    </div>
  );
}
