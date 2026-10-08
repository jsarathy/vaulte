// src/components/FoodLookupModal.jsx — "Get Nutrition" box: how much of a food, then Claude
// looks it up. Render only; state and actions in useFoodLookup.
import { C, FONT } from "../constants/design.jsx";
import { LOOKUP_UNITS } from "../lib/foodLookup.js";
import { useIsPhone } from "../hooks/useIsPhone.js";

const S = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    zIndex: 3000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  box: {
    background: "#fff",
    borderRadius: "12px",
    padding: "24px 28px",
    width: "380px",
    maxWidth: "95vw",
    border: `0.5px solid ${C.border}`,
    fontFamily: FONT.sans,
  },
  // phone: narrower padding, never taller than the visible screen
  boxPhone: { padding: "16px", maxHeight: "94dvh", overflowY: "auto" },
  label: {
    fontSize: "10px",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: "0.4px",
    color: C.hint,
    marginBottom: "4px",
  },
  qty: {
    width: "100%",
    padding: "9px 10px",
    border: `1.5px solid ${C.blue}`,
    borderRadius: "6px",
    fontSize: "16px",
    fontFamily: FONT.mono,
    fontWeight: "500",
    outline: "none",
    textAlign: "center",
  },
  unit: {
    width: "100%",
    padding: "9px 8px",
    border: `0.5px solid ${C.borderMid}`,
    borderRadius: "6px",
    fontSize: "13px",
    fontFamily: FONT.sans,
    outline: "none",
    background: "#fff",
    height: "40px",
  },
  save: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    color: C.muted,
    marginBottom: "14px",
    cursor: "pointer",
  },
  loading: { fontSize: "11px", color: C.muted, marginBottom: "10px", textAlign: "center" },
  cancel: {
    background: "transparent",
    border: `0.5px solid ${C.borderMid}`,
    color: C.muted,
    borderRadius: "6px",
    padding: "8px 16px",
    cursor: "pointer",
    fontSize: "12px",
    fontFamily: FONT.sans,
  },
  confirm: (busy) => ({
    background: busy ? C.hint : C.blue,
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "8px 20px",
    cursor: busy ? "not-allowed" : "pointer",
    fontSize: "12px",
    fontWeight: "500",
    fontFamily: FONT.sans,
  }),
};

function AmountInputs({ lookup }) {
  return (
    <div style={{ display: "flex", gap: "8px", marginBottom: "16px", alignItems: "flex-end" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.label}>Quantity</div>
        <input
          ref={lookup.inputRef}
          type="number"
          min="0.1"
          step="0.1"
          value={lookup.qtyText}
          onChange={(e) => lookup.setQty(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !lookup.loading && lookup.getNutrition()}
          style={S.qty}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.label}>Unit</div>
        <select value={lookup.unit} onChange={(e) => lookup.setUnit(e.target.value)} style={S.unit}>
          {LOOKUP_UNITS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function Actions({ lookup }) {
  return (
    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
      <button onClick={lookup.close} style={S.cancel}>
        Cancel
      </button>
      <button
        id="qty-confirm-btn"
        disabled={lookup.loading}
        onClick={lookup.getNutrition}
        style={S.confirm(lookup.loading)}
      >
        {lookup.loading ? "…" : "Get Nutrition"}
      </button>
    </div>
  );
}

/** lookup: useFoodLookup() while open. */
export default function FoodLookupModal({ lookup }) {
  const phone = useIsPhone();
  return (
    <div onClick={(e) => e.target === e.currentTarget && lookup.close()} style={S.backdrop}>
      <div style={phone ? { ...S.box, ...S.boxPhone } : S.box}>
        <div style={{ fontSize: "14px", fontWeight: "500", color: C.text, marginBottom: "4px" }}>
          {lookup.box.name}
        </div>
        <div style={{ fontSize: "11px", color: C.muted, marginBottom: "20px" }}>
          How much? Claude will calculate the nutrition.
        </div>
        <AmountInputs lookup={lookup} />
        <label style={S.save}>
          <input
            type="checkbox"
            checked={lookup.save}
            onChange={(e) => lookup.setSave(e.target.checked)}
          />
          Save to Saved recipes
        </label>
        {lookup.error && (
          <div style={{ fontSize: "11px", color: C.danger, marginBottom: "10px" }}>
            {lookup.error}
          </div>
        )}
        {lookup.loading && <div style={S.loading}>Looking up nutrition…</div>}
        <Actions lookup={lookup} />
      </div>
    </div>
  );
}
