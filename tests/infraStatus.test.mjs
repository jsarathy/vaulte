// tests/infraStatus.test.mjs — the INFRASTRUCTURE box's live status (Fix 99): reading the public
// sources (api/_infra/status.js) and turning the answer into markers and lines (src/lib/infraStatus.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canaryRuns,
  deploymentState,
  firebaseIncidents,
  latestRuns,
  openIssues,
  statuspage,
} from "../api/_infra/status.js";
import {
  canary,
  ci,
  deployment,
  firebase,
  infraStatusFor,
  issues,
  platform,
  worst,
} from "../src/lib/infraStatus.js";

const NOW = new Date(2026, 9, 12, 12, 0, 0);
const minus = (ms) => new Date(NOW.getTime() - ms).toISOString();
const HOUR = 3_600_000;

// ── the public sources ─────────────────────────────────────────────────────

test("statuspage: the indicator and description; anything else is unknown", () => {
  assert.deepEqual(
    statuspage({ status: { indicator: "none", description: "All Systems Operational" } }),
    {
      indicator: "none",
      description: "All Systems Operational",
    },
  );
  assert.deepEqual(statuspage({}), { indicator: "unknown", description: "" });
  assert.deepEqual(statuspage(null), { indicator: "unknown", description: "" });
});

test("firebaseIncidents: only the ones that have not ended, cut to 160 characters", () => {
  const list = [
    { external_desc: "Hosting is slow", end: "2026-10-09T02:06:00+00:00" },
    { external_desc: "Auth is failing" },
    { external_desc: "x".repeat(300) },
    null,
  ];
  assert.deepEqual(firebaseIncidents(list), { ongoing: ["Auth is failing", "x".repeat(160)] });
  assert.deepEqual(firebaseIncidents([]), { ongoing: [] });
  assert.deepEqual(firebaseIncidents({ not: "a list" }), { ongoing: [] });
  assert.deepEqual(firebaseIncidents([{}]), { ongoing: [""] });
});

test("latestRuns: the newest run of each workflow, with the first line of the commit message", () => {
  const run = (name, conclusion, message, at) => ({
    name,
    status: conclusion ? "completed" : "in_progress",
    conclusion,
    head_commit: { message },
    updated_at: at,
  });
  const out = latestRuns({
    workflow_runs: [
      run("ci", "success", "Fix 98: the error log\n\nlong body", "2026-10-12T10:00:00Z"),
      run("security", null, "Fix 98: the error log", "2026-10-12T10:01:00Z"),
      run("ci", "failure", "older", "2026-10-11T10:00:00Z"),
    ],
  });
  assert.deepEqual(out.runs, [
    {
      name: "ci",
      status: "completed",
      conclusion: "success",
      title: "Fix 98: the error log",
      at: "2026-10-12T10:00:00Z",
    },
    {
      name: "security",
      status: "in_progress",
      conclusion: null,
      title: "Fix 98: the error log",
      at: "2026-10-12T10:01:00Z",
    },
  ]);
  assert.equal(
    latestRuns({ workflow_runs: [{ name: "ci", head_commit: { message: "y".repeat(300) } }] })
      .runs[0].title.length,
    120,
  );
  assert.deepEqual(latestRuns({}), { runs: [] });
  assert.deepEqual(latestRuns(null), { runs: [] });
  assert.deepEqual(
    latestRuns({ workflow_runs: [{ name: "ci", created_at: "2026-01-01T00:00:00Z" }] }).runs[0],
    {
      name: "ci",
      status: "",
      conclusion: null,
      title: "",
      at: "2026-01-01T00:00:00Z",
    },
  );
});

test("deploymentState: the newest status; the deployment's own time when there is none", () => {
  const d = {
    environment: "Production",
    ref: "3ee94fc0a8a7761ba3a8".repeat(4),
    created_at: "2026-10-12T18:29:55Z",
  };
  assert.deepEqual(
    deploymentState(d, [
      {
        state: "success",
        created_at: "2026-10-12T18:36:24Z",
        description: "Deployment has completed",
      },
    ]),
    {
      environment: "Production",
      ref: "3ee94fc0a8a7761ba3a83ee94fc0a8a7761ba3a8",
      state: "success",
      at: "2026-10-12T18:36:24Z",
      description: "Deployment has completed",
    },
  );
  assert.deepEqual(deploymentState(d, []), {
    environment: "Production",
    ref: d.ref.slice(0, 40),
    state: "unknown",
    at: "2026-10-12T18:29:55Z",
    description: "",
  });
  assert.equal(deploymentState(d, [{ state: "pending" }]).description, ""); // a status with no description
  assert.deepEqual(deploymentState(null, null), {
    environment: "",
    ref: "",
    state: "unknown",
    at: null,
    description: "",
  });
});

test("openIssues: not the pull requests; title cut to 120 characters", () => {
  assert.deepEqual(
    openIssues([
      { number: 161, title: "CI platform check" },
      { number: 7, title: "a pull request", pull_request: {} },
      { number: 9, title: "t".repeat(200) },
      null,
    ]),
    {
      issues: [
        { number: 161, title: "CI platform check" },
        { number: 9, title: "t".repeat(120) },
      ],
    },
  );
  assert.deepEqual(openIssues({}), { issues: [] });
  assert.deepEqual(openIssues([{ number: 1 }]), { issues: [{ number: 1, title: "" }] });
});

// ── markers and lines ──────────────────────────────────────────────────────

test("canaryRuns: the latest five runs, how each ended and when", () => {
  const runs = Array.from({ length: 7 }, (_, i) => ({
    status: "completed",
    conclusion: i === 1 ? "failure" : "success",
    updated_at: `2026-10-1${i}T06:00:00Z`,
  }));
  const out = canaryRuns({ workflow_runs: runs });
  assert.equal(out.runs.length, 5);
  assert.deepEqual(out.runs[1], {
    status: "completed",
    conclusion: "failure",
    at: "2026-10-11T06:00:00Z",
  });
  assert.deepEqual(canaryRuns({ workflow_runs: [{ created_at: "2026-10-12T01:00:00Z" }] }).runs, [
    { status: "", conclusion: null, at: "2026-10-12T01:00:00Z" },
  ]);
  assert.deepEqual(canaryRuns({}), { runs: [] });
  assert.deepEqual(canaryRuns(null), { runs: [] });
});

test("worst: an error, else amber, else fine, else nothing known", () => {
  assert.equal(worst(["ok", "error", "stale"]), "error");
  assert.equal(worst(["ok", "stale", "never"]), "stale");
  assert.equal(worst(["ok", "never"]), "ok");
  assert.equal(worst(["never", "never"]), "never");
  assert.equal(worst([]), "never");
});

test("platform: from a Statuspage answer", () => {
  assert.deepEqual(platform({ indicator: "none", description: "All Systems Operational" }), {
    state: "ok",
    line: "Platform: All Systems Operational",
  });
  assert.equal(
    platform({ indicator: "minor", description: "Minor Service Outage" }).state,
    "stale",
  );
  assert.equal(platform({ indicator: "major", description: "x" }).state, "error");
  assert.equal(platform({ indicator: "critical", description: "x" }).state, "error");
  assert.deepEqual(platform({ indicator: "weird", description: "" }), {
    state: "never",
    line: "Platform: weird",
  });
  assert.deepEqual(platform({ error: true }), {
    state: "never",
    line: "Platform status unavailable",
  });
  assert.deepEqual(platform(undefined), { state: "never", line: "Platform status unavailable" });
});

test("deployment: success is fine, failure an error, anything in between is amber", () => {
  const at = minus(3 * HOUR);
  assert.deepEqual(deployment({ state: "success", at }, NOW), {
    state: "ok",
    line: "Production: deployed 3 hours ago",
  });
  assert.deepEqual(deployment({ state: "inactive", at }, NOW), {
    state: "ok",
    line: "Production: deployed 3 hours ago",
  });
  assert.deepEqual(deployment({ state: "failure", at }, NOW), {
    state: "error",
    line: "Production: failed 3 hours ago",
  });
  assert.equal(deployment({ state: "error", at }, NOW).state, "error");
  assert.deepEqual(deployment({ state: "in_progress", at }, NOW), {
    state: "stale",
    line: "Production: deploying 3 hours ago",
  });
  assert.deepEqual(deployment({ state: "pending" }, NOW), {
    state: "stale",
    line: "Production: deploying",
  });
  assert.equal(deployment({ state: "unknown", at }, NOW).state, "never");
  assert.deepEqual(deployment({ error: true }, NOW), {
    state: "never",
    line: "Production deployment unavailable",
  });
});

test("ci: the latest runs on main; any failure is an error, any running is amber", () => {
  const run = (name, status, conclusion, at = minus(5 * 60_000)) => ({
    name,
    status,
    conclusion,
    title: "Fix 98",
    at,
  });
  assert.deepEqual(
    ci({ runs: [run("ci", "completed", "success"), run("security", "completed", "success")] }, NOW),
    {
      state: "ok",
      line: "Latest on main: passed 5 minutes ago · Fix 98",
    },
  );
  assert.equal(
    ci({ runs: [run("ci", "completed", "success"), run("security", "completed", "failure")] }, NOW)
      .state,
    "error",
  );
  assert.deepEqual(ci({ runs: [run("ci", "completed", "failure")] }, NOW), {
    state: "error",
    line: "Latest on main: failed 5 minutes ago · Fix 98",
  });
  assert.equal(
    ci({ runs: [run("ci", "completed", "cancelled")] }, NOW).line,
    "Latest on main: cancelled 5 minutes ago · Fix 98",
  );
  assert.equal(
    ci({ runs: [run("ci", "completed", "timed_out")] }, NOW).line,
    "Latest on main: timed out 5 minutes ago · Fix 98",
  );
  assert.deepEqual(ci({ runs: [run("ci", "in_progress", null)] }, NOW), {
    state: "stale",
    line: "Latest on main: running 5 minutes ago · Fix 98",
  });
  assert.equal(ci({ runs: [run("ci", "completed", "neutral")] }, NOW).state, "stale"); // not a clear pass
  assert.equal(
    ci({ runs: [run("other", "completed", "success")] }, NOW).line,
    "Latest on main: passed 5 minutes ago · Fix 98",
  ); // no run named ci: the first
  assert.equal(
    ci({ runs: [{ name: "ci", status: "completed", conclusion: "success", at: minus(HOUR) }] }, NOW)
      .line,
    "Latest on main: passed 1 hour ago",
  ); // no title
  // a cancelled or timed-out run is an error, not only a word
  assert.equal(ci({ runs: [run("ci", "completed", "cancelled")] }, NOW).state, "error");
  assert.equal(ci({ runs: [run("ci", "completed", "timed_out")] }, NOW).state, "error");
  // the run named ci gives the line even when another workflow is listed first; the state is the worst of all
  const mixed = ci(
    {
      runs: [
        { ...run("security", "completed", "failure"), title: "S" },
        { ...run("ci", "completed", "success"), title: "C" },
      ],
    },
    NOW,
  );
  assert.deepEqual(mixed, { state: "error", line: "Latest on main: passed 5 minutes ago · C" });
  assert.deepEqual(ci({}, NOW), { state: "never", line: "No CI runs found" }); // an answer with no runs list
  assert.deepEqual(ci({ runs: [] }, NOW), { state: "never", line: "No CI runs found" });
  assert.deepEqual(ci({ error: true }, NOW), { state: "never", line: "No CI runs found" });
});

test("canary: how many of the last runs passed and when the latest was; the latest decides the marker", () => {
  const run = (conclusion, hoursAgo, status = "completed") => ({
    status,
    conclusion,
    at: minus(hoursAgo * HOUR),
  });
  const five = [
    run("success", 3),
    run("success", 27),
    run("success", 51),
    run("success", 75),
    run("success", 99),
  ];
  assert.deepEqual(canary({ runs: five }, NOW), {
    state: "ok",
    line: "Ubuntu 26.04 canary: 5 of the last 5 runs passed · latest 3 hours ago",
  });
  assert.equal(canary({ runs: [run("failure", 3), ...five.slice(1)] }, NOW).state, "error");
  assert.equal(
    canary({ runs: [run("failure", 3), ...five.slice(1)] }, NOW).line,
    "Ubuntu 26.04 canary: 4 of the last 5 runs passed · latest 3 hours ago",
  );
  assert.equal(canary({ runs: [run("success", 3), run("failure", 27)] }, NOW).state, "ok"); // an old failure
  assert.equal(canary({ runs: [run("cancelled", 3)] }, NOW).state, "error");
  assert.equal(canary({ runs: [run("neutral", 3)] }, NOW).state, "stale");
  assert.deepEqual(canary({ runs: [run(null, 1, "in_progress"), run("success", 25)] }, NOW), {
    state: "stale",
    line: "Ubuntu 26.04 canary: 1 of the last 1 runs passed · latest 1 hour ago",
  });
  const none = { state: "never", line: "Ubuntu 26.04 canary: no runs found" };
  assert.deepEqual(canary({ runs: [] }, NOW), none);
  assert.deepEqual(canary({ error: true }, NOW), none);
  assert.deepEqual(canary({}, NOW), none);
  assert.deepEqual(canary(undefined, NOW), none);
});

test("issues: none is fine; any open is amber, the first named, the rest counted", () => {
  assert.deepEqual(issues({ issues: [] }), { state: "ok", line: "No open issues" });
  assert.deepEqual(issues({ issues: [{ number: 161, title: "CI platform check" }] }), {
    state: "stale",
    line: "1 open: CI platform check",
  });
  assert.deepEqual(issues({ issues: [{ title: "A" }, { title: "B" }, { title: "C" }] }), {
    state: "stale",
    line: "3 open: A (+2 more)",
  });
  assert.deepEqual(issues({ error: true }), { state: "never", line: "Issues unavailable" });
});

test("firebase: no ongoing incidents is fine; one or more is amber and names the first", () => {
  assert.deepEqual(firebase({ ongoing: [] }), {
    state: "ok",
    line: "Platform: no ongoing incidents",
  });
  assert.deepEqual(firebase({ ongoing: ["Auth is failing", "Hosting is slow"] }), {
    state: "stale",
    line: "Platform: 2 ongoing — Auth is failing",
  });
  assert.deepEqual(firebase({ error: true }), {
    state: "never",
    line: "Platform status unavailable",
  });
});

test("infraStatusFor: a state and lines for each link; Vercel joins its platform and its deployment", () => {
  assert.equal(infraStatusFor(null, NOW), null);
  const all = infraStatusFor(
    {
      vercel: { indicator: "minor", description: "Minor Service Outage" },
      github: { indicator: "none", description: "All Systems Operational" },
      firebase: { ongoing: [] },
      ci: {
        runs: [
          {
            name: "ci",
            status: "completed",
            conclusion: "success",
            title: "Fix 98",
            at: minus(HOUR),
          },
        ],
      },
      canary: { runs: [{ status: "completed", conclusion: "success", at: minus(3 * HOUR) }] },
      deployment: { state: "success", at: minus(2 * HOUR) },
      issues: { issues: [{ number: 161, title: "CI platform check" }] },
    },
    NOW,
  );
  assert.deepEqual(Object.keys(all), [
    "Vercel",
    "Firebase",
    "GitHub",
    "GitHub Actions",
    "GitHub issues",
  ]);
  assert.deepEqual(all.Vercel, {
    state: "stale",
    lines: ["Platform: Minor Service Outage", "Production: deployed 2 hours ago"],
  });
  assert.deepEqual(all.Firebase, { state: "ok", lines: ["Platform: no ongoing incidents"] });
  assert.deepEqual(all.GitHub, { state: "ok", lines: ["Platform: All Systems Operational"] });
  assert.deepEqual(all["GitHub Actions"], {
    state: "ok",
    lines: [
      "Latest on main: passed 1 hour ago · Fix 98",
      "Ubuntu 26.04 canary: 1 of the last 1 runs passed · latest 3 hours ago",
    ],
  });
  assert.deepEqual(all["GitHub issues"], { state: "stale", lines: ["1 open: CI platform check"] });
  // a failed deployment makes Vercel an error even while the platform is fine
  const failed = infraStatusFor(
    { vercel: { indicator: "none", description: "ok" }, deployment: { state: "failure" } },
    NOW,
  );
  assert.equal(failed.Vercel.state, "error");
  // nothing could be read: every link says so
  const none = infraStatusFor({}, NOW);
  assert.ok(Object.values(none).every((v) => v.state === "never"));
  assert.ok(infraStatusFor({ vercel: { error: true } }).Vercel.lines.length === 2); // no 'now' given
});
