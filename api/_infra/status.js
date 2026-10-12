// api/_infra/status.js — reads what the Dashboard's INFRASTRUCTURE box shows (Fix 99), from public
// sources that need no token: the platforms' own status pages (Statuspage for Vercel and GitHub,
// Google's incident list for Firebase) and the public GitHub API for this repository (the latest CI
// runs on main, the latest Production deployment, open issues). No imports: the parsing is here and
// the fetching is in api/infra-status.js.

/** A Statuspage status.json as { indicator: "none" | "minor" | "major" | "critical", description }. */
export const statuspage = (json) => ({
  indicator: String(json?.status?.indicator || "unknown"),
  description: String(json?.status?.description || ""),
});

/** Google's incidents.json: the incidents that have begun and not ended, as short descriptions. */
export const firebaseIncidents = (list) => ({
  ongoing: (Array.isArray(list) ? list : [])
    .filter((i) => i && !i.end)
    .map((i) => String(i.external_desc || "").slice(0, 160)),
});

const firstLine = (text) =>
  String(text || "")
    .split("\n")[0]
    .slice(0, 120);

/** The newest run of each workflow on main (the list is newest first), as a small record. */
export function latestRuns(json) {
  const seen = new Set();
  const runs = [];
  for (const r of json?.workflow_runs || []) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    runs.push({
      name: String(r.name),
      status: String(r.status || ""),
      conclusion: r.conclusion ? String(r.conclusion) : null,
      title: firstLine(r.head_commit?.message),
      at: r.updated_at || r.created_at || null,
    });
  }
  return { runs };
}

/** The newest status of a deployment: { state, at, description, environment, ref }. */
export function deploymentState(deployment, statuses) {
  const s = Array.isArray(statuses) ? statuses[0] : null;
  return {
    environment: String(deployment?.environment || ""),
    ref: String(deployment?.ref || "").slice(0, 40),
    state: s ? String(s.state) : "unknown",
    at: s?.created_at || deployment?.created_at || null,
    description: s ? String(s.description || "") : "",
  };
}

/** Open issues (not pull requests): number and title. */
export const openIssues = (list) => ({
  issues: (Array.isArray(list) ? list : [])
    .filter((i) => i && !i.pull_request)
    .map((i) => ({ number: i.number, title: String(i.title || "").slice(0, 120) })),
});
