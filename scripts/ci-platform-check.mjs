// scripts/ci-platform-check.mjs — Fix 46: a weekly look at the moving parts CI runs on, so changes
// are heard about early and updated, not pinned. It reads the workflows and compares what they use
// (GitHub Actions, Node, Java, Playwright, firebase-tools) with the latest versions, and collects
// the warnings on the latest CI run on main (runner and Node deprecation notices).
// Usage: node scripts/ci-platform-check.mjs [--out report.md]
// Needs GITHUB_TOKEN and GITHUB_REPOSITORY for the notices; without them only versions are checked.
// With GITHUB_OUTPUT set it also writes `findings=<n>`. The workflow ci-check.yml posts the report.
import { appendFileSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const usesIn = (yaml) =>
  [...yaml.matchAll(/uses:\s*([\w.-]+\/[\w.-]+)@([\w.-]+)/g)].map(([, repo, ref]) => ({
    repo,
    ref,
  }));
const numbersAfter = (yaml, key) =>
  [...yaml.matchAll(new RegExp(`${key}:\\s*['"]?(\\d+)`, "g"))].map((m) => Number(m[1]));
export const nodeVersionsIn = (yaml) => numbersAfter(yaml, "node-version");
export const javaVersionsIn = (yaml) => numbersAfter(yaml, "java-version");
export const firebaseToolsIn = (text) =>
  [...text.matchAll(/firebase-tools@(\d+\.\d+\.\d+)/g)].map((m) => m[1]);

export const majorOf = (v) => {
  const m = /(\d+)/.exec(String(v ?? ""));
  return m ? Number(m[1]) : null;
};
/** True when `latest` has a higher major version than `current`; unknown versions are never behind. */
export const isBehind = (current, latest) => {
  const [c, l] = [majorOf(current), majorOf(latest)];
  return c != null && l != null && l > c;
};

const unique = (list) => [...new Set(list)];

/**
 * The findings, as one line each, from what is in use and what is current.
 * data = { actions: [{ repo, ref, latest }], node: { used: [n], latest }, java: { used: [n], latest },
 *          packages: [{ name, used, latest }], notices: [text], runners: [label] }
 */
export function findingsFrom(data) {
  return [
    ...(data.actions || [])
      .filter((a) => isBehind(a.ref, a.latest))
      .map((a) => `Action ${a.repo}@${a.ref} is behind: latest is ${a.latest}`),
    ...runtimeFindings("Node", data.node),
    ...runtimeFindings("Java", data.java),
    ...(data.packages || [])
      .filter((p) => p.used && p.latest && p.used !== p.latest)
      .map((p) => `${p.name} ${p.used} is not the latest (${p.latest})`),
    ...unique(data.notices || []).map((t) => `Notice on the latest CI run: ${t}`),
  ];
}

const runtimeFindings = (name, d) =>
  unique(d?.used || [])
    .filter((used) => isBehind(used, d.latest))
    .map((used) => `${name} ${used} is behind the latest LTS, ${d.latest}`);

/** The issue body. */
export function report(findings, date) {
  const head = `CI platform check, ${date}`;
  if (!findings.length) return `${head}\n\nNothing to update.\n`;
  const list = findings.map((f) => `- ${f}`).join("\n");
  return `${head}\n\n${list}\n\nRaise a Fix for each item that needs a change.\n`;
}

async function getJson(url, token) {
  const headers = {
    "User-Agent": "vaulte-ci-check",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

const latestRelease = async (repo, token) =>
  (await getJson(`https://api.github.com/repos/${repo}/releases/latest`, token)).tag_name;
const latestNpm = async (name) =>
  (await getJson(`https://registry.npmjs.org/${name}/latest`)).version;
const latestNodeLts = async () => {
  const lts = (await getJson("https://nodejs.org/dist/index.json")).find((r) => r.lts);
  return majorOf(lts?.version);
};
const latestJavaLts = async () =>
  (await getJson("https://api.adoptium.net/v3/info/available_releases")).most_recent_lts;

/** Warnings and notices on the latest CI run on main (the runner and Node deprecation notes). */
async function noticesOnLatestRun(repo, token) {
  const api = `https://api.github.com/repos/${repo}`;
  const { workflow_runs: runs } = await getJson(
    `${api}/actions/runs?branch=main&status=completed&per_page=5`,
    token,
  );
  const run = runs.find((r) => r.name === "ci");
  if (!run) return [];
  const { jobs } = await getJson(`${api}/actions/runs/${run.id}/jobs`, token);
  const notices = [];
  for (const job of jobs) {
    const notes = await getJson(`${api}/check-runs/${job.id}/annotations`, token);
    for (const n of notes)
      if (n.annotation_level !== "failure") notices.push(n.message.split("\n")[0]);
  }
  return notices;
}

const workflowText = () =>
  readdirSync(".github/workflows")
    .filter((f) => f.endsWith(".yml"))
    .map((f) => readFileSync(`.github/workflows/${f}`, "utf8"))
    .join("\n");

async function gather() {
  const yaml = workflowText();
  const [token, repo] = [process.env.GITHUB_TOKEN, process.env.GITHUB_REPOSITORY];
  const pkg = JSON.parse(readFileSync("package.json", "utf8"));
  const playwright = String(pkg.devDependencies?.["@playwright/test"] || "").replace(/^[\^~]/, "");
  const actionRepos = unique(usesIn(yaml).map((u) => u.repo));
  const latest = Object.fromEntries(
    await Promise.all(actionRepos.map(async (r) => [r, await latestRelease(r, token)])),
  );
  return {
    actions: unique(usesIn(yaml).map((u) => `${u.repo}@${u.ref}`)).map((k) => {
      const [r, ref] = k.split("@");
      return { repo: r, ref, latest: latest[r] };
    }),
    node: { used: nodeVersionsIn(yaml), latest: await latestNodeLts() },
    java: { used: javaVersionsIn(yaml), latest: await latestJavaLts() },
    packages: [
      { name: "@playwright/test", used: playwright, latest: await latestNpm("@playwright/test") },
      ...(await Promise.all(
        unique([
          ...firebaseToolsIn(yaml),
          ...firebaseToolsIn(JSON.stringify(pkg.scripts || {})),
        ]).map(async (used) => ({
          name: "firebase-tools",
          used,
          latest: await latestNpm("firebase-tools"),
        })),
      )),
    ],
    notices: token && repo ? await noticesOnLatestRun(repo, token) : [],
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const findings = findingsFrom(await gather());
  const body = report(findings, new Date().toISOString().slice(0, 10));
  const out = process.argv.indexOf("--out");
  if (out > 0) writeFileSync(process.argv[out + 1], body);
  else console.log(body);
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(process.env.GITHUB_OUTPUT, `findings=${findings.length}\n`);
}
