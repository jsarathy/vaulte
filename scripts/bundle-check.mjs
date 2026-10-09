// scripts/bundle-check.mjs — fails when the first download (the entry script) grows past its budget.
// Fix 43.2.5. Run after `npm run build`: node scripts/bundle-check.mjs
import { readFileSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

export const BUDGET_BYTES = 800 * 1024;

export function entryScript(html) {
  const match = /<script[^>]*type="module"[^>]*src="([^"]+)"/.exec(html);
  return match ? match[1] : null;
}

export function verdict(size, budget = BUDGET_BYTES) {
  return { ok: size <= budget, size, budget };
}

const kb = (n) => `${(n / 1024).toFixed(1)} kB`;

function main() {
  const html = readFileSync("dist/index.html", "utf8");
  const src = entryScript(html);
  if (!src) throw new Error("No entry script found in dist/index.html");
  const file = `dist${src}`;
  const { size } = statSync(file);
  const gz = gzipSync(readFileSync(file)).length;
  const result = verdict(size);
  console.log(`Entry script ${src}: ${kb(size)} (gzip ${kb(gz)}), budget ${kb(result.budget)}`);
  if (!result.ok) {
    console.error("Entry script is over budget — load more of the app on demand.");
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
