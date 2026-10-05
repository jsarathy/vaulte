// src/lib/weightMetrics.js — the Weight tab's metric tabs: Weight plus one per Renpho field that
// has data, with friendly names, units and a plain-English note for each.

// Friendly names/units for Renpho's raw field names. Unknown keys fall back to a
// prettified version of the key, so new metrics still get a tab.
const RENPHO_METRICS = {
  bmi: { label: "BMI", unit: "" },
  bodyfat: { label: "Body fat", unit: "%" },
  bodyFat: { label: "Body fat", unit: "%" },
  water: { label: "Body water", unit: "%" },
  bodyWater: { label: "Body water", unit: "%" },
  muscle: { label: "Muscle mass", unit: "kg" },
  muscleMass: { label: "Muscle mass", unit: "kg" },
  skeletalMuscle: { label: "Skeletal muscle", unit: "%" },
  sinew: { label: "Skeletal muscle", unit: "%" },
  bone: { label: "Bone mass", unit: "kg" },
  boneMass: { label: "Bone mass", unit: "kg" },
  bmr: { label: "BMR", unit: "kcal" },
  visfat: { label: "Visceral fat", unit: "" },
  visceralFat: { label: "Visceral fat", unit: "" },
  subfat: { label: "Subcutaneous fat", unit: "%" },
  subcutaneousFat: { label: "Subcutaneous fat", unit: "%" },
  protein: { label: "Protein", unit: "%" },
  bodyage: { label: "Metabolic age", unit: "yrs" },
  bodyAge: { label: "Metabolic age", unit: "yrs" },
  fatFreeWeight: { label: "Fat-free weight", unit: "kg" },
  lbm: { label: "Lean body mass", unit: "kg" },
  heartRate: { label: "Heart rate", unit: "bpm" },
  cardiacIndex: { label: "Cardiac index", unit: "" },
};
// Renpho fields that aren't useful metrics, so they get no tab.
const HIDDEN_METRICS = new Set(["weight", "fc", "isauto", "tw", "wc"]);

// Plain-English explanation shown when a metric tab is hovered.
const METRIC_INFO = {
  weight: "Total body weight, from the Renpho scale. The dashed line is your planned trajectory.",
  bmi: "Body Mass Index: weight relative to height. A rough screening number — it can't tell fat from muscle.",
  bodyfat:
    "Share of your body weight that is fat. Renpho estimates it from bioelectrical impedance, so absolute values are approximate; the trend is what matters.",
  water: "Share of body weight that is water. Drops when dehydrated, so it swings day to day.",
  muscle:
    "Estimated weight of muscle, including the water held in it. Rising while weight falls is the ideal pattern.",
  skeletalMuscle: "The muscle attached to bone that you actually train, as a share of body weight.",
  bone: "Estimated weight of bone mineral. Changes very slowly; large day-to-day swings are measurement noise.",
  bmr: "Basal metabolic rate: the calories your body burns at complete rest, estimated from your composition.",
  visfat:
    "Visceral fat: the fat around your organs, on Renpho's 1-59 scale. Under 10 is considered healthy, and it's the fat most linked to metabolic risk.",
  subfat: "Subcutaneous fat: the fat just under your skin, as a share of body weight.",
  protein: "Share of body weight made up of protein, mostly in muscle and organs.",
  bodyage:
    "Metabolic age: the age your body composition resembles. Lower than your real age is the goal.",
  fatFreeWeight: "Everything you weigh that isn't fat: muscle, bone, organs and water.",
  lbm: "Lean body mass: total weight minus fat mass.",
  heartRate: "Resting heart rate, if your scale measures it during the reading.",
  cardiacIndex: "A measure of how hard your heart works relative to body size.",
};

/** Display name: the friendly name, else the key split into words ("fat_mass" → "Fat mass"). */
export const metricLabel = (key) =>
  RENPHO_METRICS[key]?.label ??
  key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());

export const metricUnit = (key) => RENPHO_METRICS[key]?.unit ?? "";

/** The hover note's text: exact key, then lower-case key, then a generic line. */
export const metricInfo = (key) =>
  METRIC_INFO[key] ??
  METRIC_INFO[key?.toLowerCase()] ??
  `${metricLabel(key)}, as reported by your Renpho scale.`;

/** The hover note's heading: name and unit ("Body fat (%)"); weight is in kg. */
export function metricHeading(key) {
  const unit = metricUnit(key) || (key === "weight" ? "kg" : "");
  return unit ? `${metricLabel(key)} (${unit})` : metricLabel(key);
}

/** [key, name] per tab: Weight, then every Renpho field with data (not hidden), by name. */
export function metricTabs(weightLog) {
  const keys = [...new Set(weightLog.flatMap((row) => Object.keys(row.renpho || {})))]
    .filter((key) => !HIDDEN_METRICS.has(key.toLowerCase()))
    .sort((a, b) => metricLabel(a).localeCompare(metricLabel(b)));
  return [["weight", "Weight"], ...keys.map((key) => [key, metricLabel(key)])];
}
