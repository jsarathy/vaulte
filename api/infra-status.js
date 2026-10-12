// api/infra-status.js — the Dashboard's INFRASTRUCTURE status (Fix 99): is Vercel, Firebase and GitHub
// up, what the latest CI run on main did, the state of the latest Production deployment, and the open
// issues. All from public sources (see _infra/status.js), so there is no token to keep. Any signed-in
// user may ask (the Firebase ID token is checked); answers are kept for 5 minutes so the public
// APIs are not hammered. An optional GITHUB_TOKEN environment variable raises GitHub's rate limit.
import { verifyIdToken } from "./_admin/verify.js";
import {
  canaryRuns,
  deploymentState,
  firebaseIncidents,
  latestRuns,
  openIssues,
  statuspage,
} from "./_infra/status.js";

const REPO = "jsarathy/vaulte";
const GITHUB = `https://api.github.com/repos/${REPO}`;
export const CACHE_MS = 5 * 60 * 1000;

async function getJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: { "User-Agent": "vaulte-dashboard", ...headers },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

/** What the handler calls out to; tests replace these. */
export const deps = { verify: verifyIdToken, getJson, now: () => Date.now() };

const githubHeaders = () =>
  process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {};

async function productionDeployment() {
  const list = await deps.getJson(
    `${GITHUB}/deployments?environment=Production&per_page=1`,
    githubHeaders(),
  );
  const latest = list[0];
  if (!latest) return deploymentState(null, []);
  const statuses = await deps.getJson(
    `${GITHUB}/deployments/${latest.id}/statuses?per_page=1`,
    githubHeaders(),
  );
  return deploymentState(latest, statuses);
}

/** One source: its result, or { error: true } when it could not be read (the others still show). */
const safe = (promise) => promise.catch(() => ({ error: true }));

export async function gather() {
  const gh = githubHeaders();
  const [vercel, github, firebase, ci, canary, deployment, issues] = await Promise.all([
    safe(deps.getJson("https://www.vercel-status.com/api/v2/status.json").then(statuspage)),
    safe(deps.getJson("https://www.githubstatus.com/api/v2/status.json").then(statuspage)),
    safe(deps.getJson("https://status.firebase.google.com/incidents.json").then(firebaseIncidents)),
    safe(deps.getJson(`${GITHUB}/actions/runs?branch=main&per_page=6`, gh).then(latestRuns)),
    safe(
      deps
        .getJson(`${GITHUB}/actions/workflows/ubuntu-26-canary.yml/runs?per_page=5`, gh)
        .then(canaryRuns),
    ),
    safe(productionDeployment()),
    safe(deps.getJson(`${GITHUB}/issues?state=open&per_page=20`, gh).then(openIssues)),
  ]);
  return { vercel, github, firebase, ci, canary, deployment, issues };
}

let cache = null;

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST")
    return res.status(405).json({ error: "GET or POST only" });
  const token = String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Sign in first" });
  try {
    await deps.verify(token);
  } catch {
    return res.status(401).json({ error: "Invalid sign-in" });
  }
  const now = deps.now();
  if (!cache || now - cache.at >= CACHE_MS) cache = { at: now, data: await gather() };
  res.setHeader?.("Cache-Control", "private, max-age=60");
  return res.status(200).json({ ...cache.data, checked_at: new Date(cache.at).toISOString() });
}

/** Forget the kept answer (tests). */
export const clearCache = () => {
  cache = null;
};
