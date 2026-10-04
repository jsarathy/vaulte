// scripts/audit-check.mjs — dependency gate (Fix 11)
// Fails on: any critical advisory; any high advisory in runtime dependencies
// unless listed in security/audit-allowlist.json (and not past its review date).
// Dev-only dependencies (build tools) are reported but don't fail.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const run = (args) => {
  try {
    return JSON.parse(
      execFileSync("npm", args, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 64 << 20,
      }),
    );
  } catch (e) {
    if (e.stdout) return JSON.parse(e.stdout);
    throw e;
  } // npm audit exits non-zero when it finds anything
};
const advisories = (report) => {
  const out = new Map();
  for (const [pkg, v] of Object.entries(report.vulnerabilities || {}))
    for (const x of v.via)
      if (typeof x === "object")
        out.set(`${x.url}|${pkg}`, {
          pkg,
          severity: x.severity,
          id: x.url.split("/").pop(),
          title: x.title,
        });
  return [...out.values()];
};

const allow = JSON.parse(
  readFileSync(new URL("../security/audit-allowlist.json", import.meta.url), "utf8"),
).advisories;
const today = new Date().toISOString().slice(0, 10);
const runtime = advisories(run(["audit", "--json", "--omit=dev", "--package-lock-only"]));
const all = advisories(run(["audit", "--json", "--package-lock-only"]));
const runtimeKeys = new Set(runtime.map((a) => a.id + a.pkg));
const dev = all.filter((a) => !runtimeKeys.has(a.id + a.pkg));

const failures = [],
  notes = [];
for (const a of runtime) {
  const ok = allow.find((x) => x.id === a.id);
  if (a.severity === "critical") failures.push(`CRITICAL ${a.pkg} ${a.id} — ${a.title}`);
  else if (a.severity === "high" && !ok) failures.push(`HIGH ${a.pkg} ${a.id} — ${a.title}`);
  else if (a.severity === "high" && ok.review_by < today)
    failures.push(`HIGH ${a.pkg} ${a.id} — allowlist review date ${ok.review_by} has passed`);
  else notes.push(`${a.severity}${ok ? " (allowlisted)" : ""} ${a.pkg} ${a.id}`);
}
for (const a of dev) {
  if (a.severity === "critical") failures.push(`CRITICAL (dev) ${a.pkg} ${a.id} — ${a.title}`);
  else notes.push(`${a.severity} (dev only) ${a.pkg} ${a.id}`);
}
for (const n of notes) console.log("  note:", n);
if (failures.length) {
  console.error("Dependency audit FAILED:\n  " + failures.join("\n  "));
  process.exit(1);
}
console.log(
  `Dependency audit passed (${runtime.length} runtime / ${dev.length} dev advisories, none blocking).`,
);
