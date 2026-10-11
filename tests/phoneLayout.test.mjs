// tests/phoneLayout.test.mjs — src/lib/phoneLayout.js: two-column page styles that stack on a phone (Fix 77)
import { test } from "node:test";
import assert from "node:assert/strict";
import { columnStyle, pageStyle } from "../src/lib/phoneLayout.js";

test("columnStyle: a share of the row on desktop, natural size when stacked", () => {
  assert.deepEqual(columnStyle(false, 35), { flex: "0 0 35%", minWidth: 0 });
  assert.deepEqual(columnStyle(false, 65), { flex: "0 0 65%", minWidth: 0 });
  assert.deepEqual(columnStyle(true, 35), { flex: "none", minWidth: 0 });
});

test("pageStyle: unchanged on desktop, one stretched column on a phone", () => {
  const base = { display: "flex", gap: "16px", padding: "24px", alignItems: "flex-start" };
  assert.equal(pageStyle(false, base), base);
  assert.deepEqual(pageStyle(true, base), {
    display: "flex",
    gap: "16px",
    padding: "10px",
    alignItems: "stretch",
    flexDirection: "column",
  });
  assert.equal(base.padding, "24px"); // the base style is not changed
});
