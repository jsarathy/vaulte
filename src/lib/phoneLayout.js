// src/lib/phoneLayout.js — style helpers for a two-column page that stacks on a phone (Fix 43.7).

/** A column taking `share` % of a desktop row; full width (auto height) when stacked. */
export const columnStyle = (phone, share) => ({
  flex: phone ? "none" : `0 0 ${share}%`,
  minWidth: 0,
});

/** The page's row style, turned into one stacked column on a phone. */
export const pageStyle = (phone, base) =>
  phone ? { ...base, flexDirection: "column", alignItems: "stretch", padding: "10px" } : base;
