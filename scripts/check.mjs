// scripts/check.mjs — Fix 40: run the checks the tier calls for, stopping at the first failure.
// Usage: npm run check            (changes since origin/main)
//        npm run check -- --dry   (list the steps without running them)
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { rateChange } from "./tier.mjs";
import { stepsFor, uiPlan } from "./tier/plan.mjs";

function run(step) {
  console.log(`\n== ${step.label}`);
  if (step.cmds.length === 0) console.log("   (do this by hand)");
  for (const cmd of step.cmds) {
    if (spawnSync(cmd, { shell: true, stdio: "inherit" }).status !== 0) return false;
  }
  return true;
}

async function main() {
  const dry = process.argv.includes("--dry");
  const { tier, reasons, changed, map } = await rateChange(
    process.argv.slice(2).filter((a) => !a.startsWith("--")),
  );
  const steps = stepsFor(tier, uiPlan(tier, changed, map));
  console.log(`Tier ${tier}\n${reasons.map((r) => `  why: ${r}`).join("\n")}`);
  if (dry) return steps.forEach((s) => console.log(`  run: ${s.label}`));
  const failed = steps.find((s) => !run(s));
  if (failed) process.exit(1);
  console.log("\nAll checks for this tier passed. CI still runs the full suite.");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
