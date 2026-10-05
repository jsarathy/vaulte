// tests/anatomy.test.mjs — the Body tab's anatomy figure (src/lib/anatomy.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { X, figureShape, highlight, latestReadings, cmText } from "../src/lib/anatomy.js";

test("figure shapes: male (default) and female", () => {
  const m = figureShape("m");
  assert.equal(X, 100);
  assert.equal(m.isF, false);
  assert.deepEqual(m.head, [18, 22]);
  assert.deepEqual(figureShape(undefined), m);
  assert.equal(m.parts.length, 3);
  assert.match(m.parts[0], /^M100\.5,55 L90,55 L90,74 C90,82 58,82 50,92/);
  assert.match(m.parts[0], /C60,128 67,136 67,152/);
  assert.equal(
    Object.keys(m.rings).join(),
    "neck,shoulder,chest,waist,abdomen,hip,bicepR,bicepL,thighR,thighL,calfR,calfL",
  );
  assert.deepEqual(m.rings.neck, { cx: 100, y: 66, hw: 10 });
  assert.deepEqual(m.rings.shoulder, { cx: 100, y: 94, hw: 58 });
  assert.deepEqual(m.rings.chest, { cx: 100, y: 120, hw: 40 });
  assert.deepEqual(m.rings.abdomen, { cx: 100, y: 168, hw: 34.5 });
  assert.deepEqual(m.rings.thighR, { cx: 82, y: 238, hw: 17 });
  assert.deepEqual(m.rings.thighL, { cx: 118, y: 238, hw: 17 });
  assert.deepEqual(m.rings.calfR, { cx: 83, y: 330, hw: 12 });
  const arm = m.rings.bicepR;
  assert.equal(arm.y, 135);
  assert.ok(
    Math.abs(arm.cx - 50.3386) < 1e-4 && Math.abs(arm.hw - 8.4577) < 1e-4,
    JSON.stringify(arm),
  );
  assert.equal(m.rings.bicepL.cx, 200 - arm.cx);
  const f = figureShape("f");
  assert.equal(f.isF, true);
  assert.deepEqual(f.head, [16, 21]);
  assert.deepEqual(f.rings.chest, { cx: 100, y: 120, hw: 38 });
  assert.match(f.parts[0], /C61,128 73,136 73,152/);
});

test("highlight: ring and label side", () => {
  const { rings } = figureShape("m");
  assert.deepEqual(highlight(rings, "waist"), {
    site: "waist",
    ring: rings.waist,
    labelRight: true,
  });
  assert.equal(highlight(rings, "bicepR").labelRight, false);
  assert.equal(highlight(rings, "bicepL").labelRight, true);
  assert.equal(highlight(rings, "nope"), null);
  assert.equal(highlight(rings, null), null);
});

test("latest readings", () => {
  const latest = latestReadings([
    { waist: 101, neck: 41, chest: 110 },
    { waist: 100, neck: null, chest: 0 },
  ]);
  assert.equal(latest.waist, 100);
  assert.equal(latest.neck, 41);
  assert.equal(latest.chest, 0);
  assert.equal(latest.hip, null);
  assert.equal(Object.keys(latest).length, 12);
  assert.equal(cmText(100.26), "100.3 cm");
  assert.equal(cmText("99"), "99.0 cm");
});
