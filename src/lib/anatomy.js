// src/lib/anatomy.js — the Body tab's anatomy figure: a front-view silhouette drawn from a few
// proportions (male and female share one drawing), a tape "ring" per measurement site, and the
// latest reading per site. Anatomical convention: the person's left (L-) is on the viewer's right.
import { BODY_MEASURES } from "./bodyMeasures.js";

export const X = 100; // centre line
const BODY_SHAPE = {
  m: { head: [18, 22], neck: 10, shoulder: 50, chest: 40, waist: 33, hip: 36 },
  f: { head: [16, 21], neck: 8, shoulder: 42, chest: 36, waist: 27, hip: 40 },
};
const lerp = (a, b, t) => a + (b - a) * t;

// Left half of each part (viewer's left); the figure mirrors them for the other side.
function outlines({ neck: n, shoulder: S, chest: C, waist: Wa, hip: H }, isF) {
  const torso = `M${X + 0.5},55 L${X - n},55 L${X - n},74 C${X - n},82 ${X - S + 8},82 ${X - S},92
    C${X - S - 2},100 ${X - C - 2},104 ${X - C},114
    C${X - C - (isF ? 3 : 0)},128 ${X - Wa},136 ${X - Wa},152
    C${X - Wa},170 ${X - H},180 ${X - H},200
    C${X - H},208 ${X - H + 2},214 ${X - H + 4},218 L${X + 0.5},224 Z`;
  const arm = `M${X - S + 2},88 C${X - S - 6},92 ${X - S - 8},110 ${X - S - 8},130
    L${X - S - 9},172 L${X - S - 12},215
    C${X - S - 14},228 ${X - S - 10},244 ${X - S - 5},244 C${X - S},244 ${X - S + 1},228 ${X - S + 1},215
    L${X - S + 4},172 L${X - C + 1},118 Z`;
  const leg = `M${X - H + 1},205 C${X - H},240 ${X - H + 6},270 ${X - H + 9},295
    C${X - H + 6},315 ${X - H + 7},340 ${X - H + 11},370 L${X - H + 12},392
    L${X - H + 4},402 L${X - 4},402 L${X - 5},392 L${X - 5},370
    C${X - 4},340 ${X - 6},315 ${X - 5},295 C${X - 4},270 ${X - 2},240 ${X + 0.5},220 Z`;
  return [torso, arm, leg];
}

// Limb centres and half-widths (viewer's-left limb): upper arm at y 135, thigh, calf.
function limbs({ shoulder: S, chest: C, hip: H }) {
  const t = (135 - 118) / (172 - 118);
  const inner = lerp(X - C + 1, X - S + 4, t);
  const outer = lerp(X - S - 8, X - S - 9, (135 - 130) / 42);
  return {
    arm: { cx: (inner + outer) / 2, hw: (inner - outer) / 2 },
    thigh: { cx: X - H / 2, hw: H / 2 - 1 },
    calf: { cx: (X - H + 7 + X - 5) / 2, hw: (X - 5 - (X - H + 7)) / 2 },
  };
}

const mirror = (cx) => 2 * X - cx;
const pair = (side, y, { cx, hw }) => ({
  [`${side}R`]: { cx, y, hw },
  [`${side}L`]: { cx: mirror(cx), y, hw },
});

// Tape rings per site: centre, height, half-width. Person's left = viewer's right.
function rings(P, isF) {
  const { neck: n, shoulder: S, chest: C, waist: Wa, hip: H } = P;
  const { arm, thigh, calf } = limbs(P);
  return {
    neck: { cx: X, y: 66, hw: n },
    shoulder: { cx: X, y: 94, hw: S + 8 },
    chest: { cx: X, y: 120, hw: C + (isF ? 2 : 0) },
    waist: { cx: X, y: 152, hw: Wa },
    abdomen: { cx: X, y: 168, hw: (Wa + H) / 2 },
    hip: { cx: X, y: 198, hw: H },
    ...pair("bicep", 135, arm),
    ...pair("thigh", 238, thigh),
    ...pair("calf", 330, calf),
  };
}

/** The figure for a sex ("f", else male): head radii, outlines, and a ring per site. */
export function figureShape(sex) {
  const isF = sex === "f";
  const P = BODY_SHAPE[isF ? "f" : "m"];
  return { isF, head: P.head, parts: outlines(P, isF), rings: rings(P, isF) };
}

/** The highlighted site's ring and which side its label goes (null when there's none). */
export function highlight(rings, active) {
  const ring = rings[active];
  return ring ? { site: active, ring, labelRight: ring.cx >= X } : null;
}

/** Most recent non-empty reading per site (null when there's none). */
export const latestReadings = (bodyLog) =>
  Object.fromEntries(
    BODY_MEASURES.map(({ key }) => {
      const row = bodyLog.findLast((r) => r[key] != null);
      return [key, row ? row[key] : null];
    }),
  );

/** "100.3 cm" */
export const cmText = (v) => `${Number(v).toFixed(1)} cm`;
