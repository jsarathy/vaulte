// scripts/tier/graph.mjs — Fix 40: import-graph helpers over dependency-cruiser's module list.
// A module is { source, dependencies: [{ resolved, module }] }.
const SCREEN = /^src\/tabs\/[^/]+\.jsx$|^src\/components\/AccountPage\.jsx$/;
const SHELL = /^src\/(main|App|NutritionTracker)\.jsx$|^src\/components\/Tracker(Frame|Tabs)\.jsx$/;

export const isScreen = (file) => SCREEN.test(file);

// Map of file -> the files that import it.
export function dependents(modules) {
  const map = new Map();
  const edges = modules.flatMap((m) => m.dependencies.map((d) => [d.resolved, m.source]));
  for (const [dep, src] of edges) map.set(dep, (map.get(dep) ?? new Set()).add(src));
  return map;
}

// The given files plus everything that imports them, directly or through others.
// Files for which stop() is true are included but not expanded further.
export function reachedFrom(modules, files, stop = () => false) {
  const up = dependents(modules);
  const seen = new Set(files);
  const queue = [...files];
  while (queue.length) {
    const node = queue.pop();
    const above = stop(node) ? [] : [...(up.get(node) ?? [])];
    const fresh = above.filter((p) => !seen.has(p));
    fresh.forEach((p) => seen.add(p));
    queue.push(...fresh);
  }
  return seen;
}

export function screensIn(files) {
  return [...files].filter(isScreen);
}

export function reachesShell(files) {
  return [...files].some((f) => SHELL.test(f));
}

export function importsFirebase(modules, file) {
  const mod = modules.find((m) => m.source === file);
  return Boolean(mod?.dependencies.some((d) => /^firebase(-admin)?(\/|$)/.test(d.module)));
}
