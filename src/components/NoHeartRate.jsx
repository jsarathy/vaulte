// src/components/NoHeartRate.jsx — "Heart rate data wasn't captured at sync time" with a button to
// fetch it from Polar and any error. Shared by the Daily log's session box and the Add entry log
// box. Render only; hr = useHeartRateFetch().
import { C, FONT } from "../constants/design.jsx";

const S = {
  box: {
    background: C.bg,
    borderRadius: "6px",
    border: `0.5px solid ${C.border}`,
    padding: "16px",
    textAlign: "center",
  },
  note: { fontSize: "12px", color: C.muted, marginBottom: "12px" },
  fetch: (busy) => ({
    background: busy ? C.hint : C.blue,
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "8px 18px",
    cursor: busy ? "not-allowed" : "pointer",
    fontSize: "12px",
    fontWeight: "500",
    fontFamily: FONT.sans,
  }),
  error: { fontSize: "11px", color: C.danger, marginTop: "8px" },
};

/** canFetch: show the button (Polar knows the session). */
export default function NoHeartRate({ hr, canFetch }) {
  return (
    <div style={S.box}>
      <div style={S.note}>Heart rate data wasn't captured at sync time.</div>
      {canFetch && (
        <>
          <button onClick={hr.fetchNow} disabled={hr.fetching} style={S.fetch(hr.fetching)}>
            {hr.fetching ? "Fetching…" : "Fetch HR data"}
          </button>
          {hr.error && <div style={S.error}>{hr.error}</div>}
        </>
      )}
    </div>
  );
}
