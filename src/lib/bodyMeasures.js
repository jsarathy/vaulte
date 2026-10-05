// src/lib/bodyMeasures.js — the Body tab's tape-measure sites (Renpho Smart Body Tape Measure,
// cm): name, short name and how to measure each.

// The 12 standard sites from the Renpho tape app, in app order.
export const BODY_MEASURES = [
  {
    key: "neck",
    label: "Neck",
    short: "Neck",
    info: "Wrap the tape around the neck just below the Adam's apple, level all the way round. Keep your head straight and neck relaxed.",
  },
  {
    key: "shoulder",
    label: "Shoulder",
    short: "Shldr",
    info: "Stand upright with arms relaxed at your sides. Measure around the widest point of the shoulders, passing over the top of both arms.",
  },
  {
    key: "bicepL",
    label: "L-Bicep",
    short: "L-Bicep",
    info: "Left upper arm at its thickest point, roughly midway between shoulder and elbow. Arm hanging relaxed — measure the same way (relaxed or flexed) every time.",
  },
  {
    key: "bicepR",
    label: "R-Bicep",
    short: "R-Bicep",
    info: "Right upper arm at its thickest point, roughly midway between shoulder and elbow. Arm hanging relaxed — measure the same way (relaxed or flexed) every time.",
  },
  {
    key: "chest",
    label: "Chest",
    short: "Chest",
    info: "Around the fullest part of the chest at nipple level, tape under the armpits and level across the back. Read it after a normal breath out.",
  },
  {
    key: "waist",
    label: "Waist",
    short: "Waist",
    info: "At the narrowest point of the torso, usually just above the navel, between the lowest rib and the hip bone. Stand relaxed, breathe out normally, don't pull in.",
  },
  {
    key: "abdomen",
    label: "Abdomen",
    short: "Abdo",
    info: "Level with the belly button, tape horizontal all the way round. Stand relaxed and read after a normal breath out.",
  },
  {
    key: "hip",
    label: "Hip",
    short: "Hip",
    info: "Feet together. Measure around the widest part of the buttocks, keeping the tape level front to back.",
  },
  {
    key: "thighL",
    label: "L-Thigh",
    short: "L-Thigh",
    info: "Left thigh at its widest point, just below the buttock crease. Stand with weight spread evenly on both feet.",
  },
  {
    key: "thighR",
    label: "R-Thigh",
    short: "R-Thigh",
    info: "Right thigh at its widest point, just below the buttock crease. Stand with weight spread evenly on both feet.",
  },
  {
    key: "calfL",
    label: "L-Calf",
    short: "L-Calf",
    info: "Left calf at its widest point, roughly a third of the way down from the knee. Stand with weight spread evenly, calf relaxed.",
  },
  {
    key: "calfR",
    label: "R-Calf",
    short: "R-Calf",
    info: "Right calf at its widest point, roughly a third of the way down from the knee. Stand with weight spread evenly, calf relaxed.",
  },
];
export const MEASURE = Object.fromEntries(BODY_MEASURES.map((m) => [m.key, m]));

/** The pills: [key, label] per site, in app order. */
export const measureTabs = BODY_MEASURES.map((m) => [m.key, m.label]);
