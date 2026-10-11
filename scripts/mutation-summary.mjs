// scripts/mutation-summary.mjs — the mutation score as a Markdown block for the run summary (Fix 81).
// Usage: node scripts/mutation-summary.mjs <mutation.json> "<title>" >> "$GITHUB_STEP_SUMMARY"
// The score is Stryker's: (killed + timeout) / (killed + timeout + survived + not covered).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export function summarise(report) {
  const count = {};
  for (const file of Object.values(report.files))
    for (const m of file.mutants) count[m.status] = (count[m.status] || 0) + 1;
  const caught = (count.Killed || 0) + (count.Timeout || 0);
  const missed = (count.Survived || 0) + (count.NoCoverage || 0);
  return {
    score: caught + missed ? (100 * caught) / (caught + missed) : 100,
    killed: count.Killed || 0,
    timeout: count.Timeout || 0,
    survived: count.Survived || 0,
    noCoverage: count.NoCoverage || 0,
  };
}

export function markdown(title, s) {
  return (
    `## ${title}: mutation score ${s.score.toFixed(2)}%\n\n` +
    `Killed ${s.killed}, timeout ${s.timeout}, survived ${s.survived}, no coverage ${s.noCoverage}. ` +
    "Report: the mutation-report artifact.\n"
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [file, title = "Mutation testing"] = process.argv.slice(2);
  process.stdout.write(markdown(title, summarise(JSON.parse(readFileSync(file, "utf8")))));
}
