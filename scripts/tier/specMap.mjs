// scripts/tier/specMap.mjs — Fix 40: which UI specs actually run which source files.
// A recorded run (tests/ui/cover.mjs) saves Chromium's JS coverage for every UI test; the map
// (tests/ui/spec-map.json) is spec -> source files it exercised. Used to pick specs for a change.
const SRC = /(?:^|\/)(src\/[^?#]+)/;

export function fileOfUrl(url) {
  if (url.includes("node_modules")) return null;
  return SRC.exec(url)?.[1] ?? null;
}

// A file is exercised when one of its own named functions ran (a component runs when it renders).
// Vite adds hot-reload helpers and anonymous wrappers that run on load, so they are skipped.
// A file with no functions at all (constants) counts once it is loaded.
const own = (f) => f.functionName && !f.functionName.startsWith("$Refresh");

function ran(script) {
  const inner = script.functions.slice(1).filter(own);
  return inner.length === 0 || inner.some((f) => f.ranges[0].count > 0);
}

export function exercised(scripts) {
  const files = scripts.filter((s) => fileOfUrl(s.url) && ran(s)).map((s) => fileOfUrl(s.url));
  return [...new Set(files)].sort();
}

export function mergeRuns(runs) {
  const merged = {};
  for (const { spec, files } of runs)
    merged[spec] = [...new Set([...(merged[spec] ?? []), ...files])];
  return Object.fromEntries(
    Object.keys(merged)
      .sort()
      .map((spec) => [spec, merged[spec].sort()]),
  );
}

const isSpec = (f) => /^tests\/ui\/.*\.spec\.mjs$/.test(f);

// Specs to run for the changed files, and the changed source files no spec exercises.
export function specsFor(changed, map) {
  const src = changed.filter((f) => f.startsWith("src/"));
  const hit = (files) => src.some((f) => files.includes(f));
  const picked = Object.keys(map).filter((spec) => hit(map[spec]));
  return {
    specs: [...new Set([...changed.filter(isSpec), ...picked])].sort(),
    unmapped: src.filter((f) => !Object.values(map).some((files) => files.includes(f))),
  };
}
