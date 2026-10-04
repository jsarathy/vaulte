// tests/dayContent.test.mjs — calendar "logged" marking (Fix 7 follow-up)
import { test } from "node:test";
import assert from "node:assert/strict";
import { dayHasContent } from "../src/constants/helpers.js";

test("empty / missing days aren't logged", () => {
  assert.equal(dayHasContent(null), false);
  assert.equal(dayHasContent({ date:"2026-10-01" }), false);
  assert.equal(dayHasContent({ date:"2026-10-01", notes:"", meals:[{ name:"Breakfast", items:[] }, { name:"Lunch" }] }), false);
  assert.equal(dayHasContent({ date:"2026-10-01", notes:"   ", meals:[] }), false);
});
test("a food or exercise entry, or notes, makes it logged", () => {
  assert.equal(dayHasContent({ meals:[{ items:[] }, { items:[{ name:"Apple", kcal:52 }] }] }), true);
  assert.equal(dayHasContent({ meals:[{ items:[{ name:"Cycling (30 min)", kcal:-250, is_exercise:1 }] }] }), true);
  assert.equal(dayHasContent({ notes:"Felt bloated", meals:[{ items:[] }] }), true);
});
