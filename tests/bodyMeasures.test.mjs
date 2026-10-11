// tests/bodyMeasures.test.mjs — src/lib/bodyMeasures.js: the 12 tape-measure sites (Fix 77)
import { test } from "node:test";
import assert from "node:assert/strict";
import { BODY_MEASURES, MEASURE, measureTabs } from "../src/lib/bodyMeasures.js";

// key, label, short name — in the Renpho app's order
const SITES = [
  ["neck", "Neck", "Neck"],
  ["shoulder", "Shoulder", "Shldr"],
  ["bicepL", "L-Bicep", "L-Bicep"],
  ["bicepR", "R-Bicep", "R-Bicep"],
  ["chest", "Chest", "Chest"],
  ["waist", "Waist", "Waist"],
  ["abdomen", "Abdomen", "Abdo"],
  ["hip", "Hip", "Hip"],
  ["thighL", "L-Thigh", "L-Thigh"],
  ["thighR", "R-Thigh", "R-Thigh"],
  ["calfL", "L-Calf", "L-Calf"],
  ["calfR", "R-Calf", "R-Calf"],
];

test("the 12 sites: key, label and short name, in app order", () => {
  assert.deepEqual(
    BODY_MEASURES.map((m) => [m.key, m.label, m.short]),
    SITES,
  );
});

test("every site says how to measure it, in a sentence", () => {
  for (const m of BODY_MEASURES) {
    assert.ok(m.info.length > 60, `${m.key}: info is too short`);
    assert.match(m.info, /^[A-Z].*[.]$/s, `${m.key}: info is not a sentence`);
  }
  assert.match(MEASURE.neck.info, /Adam's apple/);
  assert.match(MEASURE.waist.info, /narrowest point of the torso/);
  assert.match(MEASURE.hip.info, /buttocks/);
  assert.match(MEASURE.shoulder.info, /shoulders/);
  assert.match(MEASURE.abdomen.info, /belly button/);
  assert.match(MEASURE.chest.info, /chest/);
});

test("left and right sites are described as the side they name", () => {
  for (const k of ["bicepL", "thighL", "calfL"]) assert.match(MEASURE[k].info, /^Left /);
  for (const k of ["bicepR", "thighR", "calfR"]) assert.match(MEASURE[k].info, /^Right /);
});

test("MEASURE finds a site by key; measureTabs lists [key, label] for the pills", () => {
  for (const m of BODY_MEASURES) assert.equal(MEASURE[m.key], m);
  assert.equal(Object.keys(MEASURE).length, 12);
  assert.deepEqual(
    measureTabs,
    SITES.map(([key, label]) => [key, label]),
  );
});
