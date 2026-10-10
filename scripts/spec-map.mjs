// scripts/spec-map.mjs — Fix 40: rebuild tests/ui/spec-map.json (which source files each UI spec runs).
// Usage: npm run spec-map   (runs the whole UI suite once with coverage on; takes a full-suite run)
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { mergeRuns } from "./tier/specMap.mjs";

const DIR = ".ui-coverage";
const MAP = "tests/ui/spec-map.json";

function runSuite() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  const env = { ...process.env, UI_COVERAGE: "1" };
  const { status } = spawnSync("npx", ["playwright", "test"], {
    env,
    stdio: "inherit",
    shell: true,
  });
  if (status !== 0) throw new Error("The UI suite failed; the spec map was not rewritten.");
}

function main() {
  runSuite();
  const runs = readdirSync(DIR).map((f) => JSON.parse(readFileSync(`${DIR}/${f}`, "utf8")));
  writeFileSync(MAP, `${JSON.stringify(mergeRuns(runs), null, 2)}\n`);
  console.log(`Wrote ${MAP}: ${runs.length} tests recorded.`);
}

main();
