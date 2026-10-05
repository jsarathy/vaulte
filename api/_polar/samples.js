// api/_polar/samples.js — a session's heart-rate time series from Polar's samples endpoint
// (sample-type "0" = heart rate in bpm, one value per recording interval).

const NO_HR = { hr_samples: null, recording_rate_s: null };
const DEFAULT_RATE_S = 5;

/** bpm per sample with the pre-start zero padding dropped and later zeros as null; null if none. */
export function parseHrSamples(data) {
  const raw = data.split(",").map((v) => parseInt(v, 10));
  const firstNonZero = raw.findIndex((v) => v > 0);
  if (firstNonZero < 0) return null;
  return raw.slice(firstNonZero).map((v) => (v > 0 ? v : null));
}

/** { hr_samples, recording_rate_s } from the sample sets in a samples reply. */
export function hrFromSampleSets(sampleSets) {
  const hrSet = (sampleSets || []).find((s) => String(s["sample-type"]) === "0");
  if (!hrSet?.data) return NO_HR;
  return {
    hr_samples: parseHrSamples(hrSet.data),
    recording_rate_s: hrSet["recording-rate"] || DEFAULT_RATE_S,
  };
}

/** The HR series for an exercise URL; a failed or unreadable fetch gives none (logged). */
export async function fetchHrSamples(url, headers) {
  try {
    const r = await fetch(`${url}/samples`, { headers });
    if (!r.ok) return NO_HR;
    return hrFromSampleSets((await r.json())["samples"]);
  } catch (err) {
    console.warn("HR samples fetch failed for:", url, err.message);
    return NO_HR;
  }
}
