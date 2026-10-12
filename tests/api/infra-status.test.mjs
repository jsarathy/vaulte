// tests/api/infra-status.test.mjs — /api/infra-status (Fix 99): who may ask, what it gathers from the
// public sources, a source that fails not stopping the others, and the 5-minute memory. The outside
// calls (verifying the token, fetching) are replaced through `deps`.
import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { res } from "./setup.mjs";
import handler, { CACHE_MS, clearCache, deps, gather } from "../../api/infra-status.js";

const real = { ...deps };
let urls;
let headersSeen;
let fail;
let clock;

const ANSWERS = {
  "https://www.vercel-status.com/api/v2/status.json": {
    status: { indicator: "none", description: "All Systems Operational" },
  },
  "https://www.githubstatus.com/api/v2/status.json": {
    status: { indicator: "minor", description: "Minor Service Outage" },
  },
  "https://status.firebase.google.com/incidents.json": [
    { external_desc: "Old", end: "2026-10-09T02:06:00+00:00" },
    { external_desc: "Auth is failing" },
  ],
};
const GH = "https://api.github.com/repos/jsarathy/vaulte";

const answer = (url) => {
  if (ANSWERS[url]) return ANSWERS[url];
  if (url === `${GH}/actions/runs?branch=main&per_page=6`)
    return {
      workflow_runs: [
        {
          name: "ci",
          status: "completed",
          conclusion: "success",
          head_commit: { message: "Fix 99: live status\n\nbody" },
          updated_at: "2026-10-12T10:00:00Z",
        },
      ],
    };
  if (url === `${GH}/actions/workflows/ubuntu-26-canary.yml/runs?per_page=5`)
    return {
      workflow_runs: [
        { status: "completed", conclusion: "success", updated_at: "2026-10-12T15:34:00Z" },
      ],
    };
  if (url === `${GH}/deployments?environment=Production&per_page=1`)
    return [
      { id: 77, environment: "Production", ref: "abc123", created_at: "2026-10-12T09:00:00Z" },
    ];
  if (url === `${GH}/deployments/77/statuses?per_page=1`)
    return [
      {
        state: "success",
        created_at: "2026-10-12T09:05:00Z",
        description: "Deployment has completed",
      },
    ];
  if (url === `${GH}/issues?state=open&per_page=20`)
    return [
      { number: 161, title: "CI platform check" },
      { number: 3, title: "a pull request", pull_request: {} },
    ];
  throw new Error(`unexpected ${url}`);
};

const call = async (token = "good", method = "GET") => {
  const out = res();
  out.headers = {};
  out.setHeader = (k, v) => (out.headers[k] = v);
  await handler({ method, headers: token ? { authorization: `Bearer ${token}` } : {} }, out);
  return out;
};

beforeEach(() => {
  clearCache();
  urls = [];
  headersSeen = [];
  fail = new Set();
  clock = 1_000_000;
  deps.verify = async (t) => {
    if (t !== "good") throw new Error("bad token");
    return { uid: "u" };
  };
  deps.getJson = async (url, headers) => {
    urls.push(url);
    headersSeen.push(headers);
    if ([...fail].some((f) => url.startsWith(f))) throw new Error("down");
    return answer(url);
  };
  deps.now = () => clock;
});
afterEach(() => {
  Object.assign(deps, real);
  delete process.env.GITHUB_TOKEN;
  mock.restoreAll();
});

test("only GET or POST", async () => {
  const out = await call("good", "DELETE");
  assert.equal(out.statusCode, 405);
  assert.equal(out.body.error, "GET or POST only");
  assert.equal((await call("good", "POST")).statusCode, 200);
});

test("no token, or a token that does not verify: 401, and nothing is fetched", async () => {
  const none = await call("");
  assert.equal(none.statusCode, 401);
  assert.equal(none.body.error, "Sign in first");
  const bad = await call("forged");
  assert.equal(bad.statusCode, 401);
  assert.equal(bad.body.error, "Invalid sign-in");
  assert.deepEqual(urls, []);
  const out = res();
  await handler({ method: "GET" }, out); // no headers at all
  assert.equal(out.statusCode, 401);
});

test("gathers the platform statuses, Firebase's ongoing incidents, CI, the deployment and the open issues", async () => {
  const out = await call();
  assert.equal(out.statusCode, 200);
  assert.deepEqual(out.body.vercel, { indicator: "none", description: "All Systems Operational" });
  assert.deepEqual(out.body.github, { indicator: "minor", description: "Minor Service Outage" });
  assert.deepEqual(out.body.firebase, { ongoing: ["Auth is failing"] });
  assert.deepEqual(out.body.ci, {
    runs: [
      {
        name: "ci",
        status: "completed",
        conclusion: "success",
        title: "Fix 99: live status",
        at: "2026-10-12T10:00:00Z",
      },
    ],
  });
  assert.deepEqual(out.body.canary, {
    runs: [{ status: "completed", conclusion: "success", at: "2026-10-12T15:34:00Z" }],
  });
  assert.deepEqual(out.body.deployment, {
    environment: "Production",
    ref: "abc123",
    state: "success",
    at: "2026-10-12T09:05:00Z",
    description: "Deployment has completed",
  });
  assert.deepEqual(out.body.issues, { issues: [{ number: 161, title: "CI platform check" }] });
  assert.equal(out.body.checked_at, new Date(1_000_000).toISOString());
  assert.equal(out.headers["Cache-Control"], "private, max-age=60");
  assert.equal(urls.length, 8); // 3 status pages and feeds, runs, the canary, the deployment and its status, issues
});

test("a source that fails is { error: true } and the others still come back", async () => {
  fail.add("https://www.githubstatus.com");
  fail.add(`${GH}/actions/runs`); // the main branch runs, not the canary
  const out = await call();
  assert.equal(out.statusCode, 200);
  assert.deepEqual(out.body.github, { error: true });
  assert.deepEqual(out.body.ci, { error: true });
  assert.equal(out.body.canary.runs.length, 1); // the canary still came back
  assert.equal(out.body.vercel.indicator, "none");
  assert.equal(out.body.issues.issues.length, 1);
  assert.equal(out.body.deployment.state, "success");
});

test("the deployment is an error when its list or its status cannot be read; none yet is 'unknown'", async () => {
  fail.add(`${GH}/deployments/77`);
  assert.deepEqual((await call()).body.deployment, { error: true });
  clearCache();
  fail.clear();
  const base = deps.getJson;
  deps.getJson = async (url, headers) =>
    url.includes("deployments?environment") ? [] : base(url, headers);
  assert.deepEqual((await call()).body.deployment, {
    environment: "",
    ref: "",
    state: "unknown",
    at: null,
    description: "",
  });
});

test("answers are kept for 5 minutes: a second ask in that time fetches nothing", async () => {
  assert.equal(CACHE_MS, 300_000);
  const first = await call();
  const fetched = urls.length;
  clock += CACHE_MS - 1;
  const second = await call();
  assert.equal(urls.length, fetched); // nothing new fetched
  assert.deepEqual(second.body, first.body);
  clock += 1; // exactly 5 minutes after the first
  const third = await call();
  assert.equal(urls.length, fetched * 2);
  assert.equal(third.body.checked_at, new Date(clock).toISOString());
});

test("an optional GITHUB_TOKEN is sent to GitHub only", async () => {
  await call();
  assert.ok(headersSeen.every((h) => !h?.Authorization)); // none set: no header anywhere
  clearCache();
  urls = [];
  headersSeen = [];
  process.env.GITHUB_TOKEN = "gh-token";
  await call();
  const sent = urls.map((u, i) => [
    u.startsWith("https://api.github.com/"),
    headersSeen[i]?.Authorization,
  ]);
  assert.ok(sent.length > 0);
  for (const [isGithub, auth] of sent) assert.equal(auth, isGithub ? "Bearer gh-token" : undefined);
});

test("the real fetch: sends a User-Agent and the given headers, times out, reads JSON, throws on a bad answer", async () => {
  const realFetch = globalThis.fetch;
  const seen = [];
  globalThis.fetch = async (url, options) => {
    seen.push({ url, options });
    return url.endsWith("/bad")
      ? { ok: false, status: 503, json: async () => ({}) }
      : { ok: true, status: 200, json: async () => ({ fine: true }) };
  };
  try {
    assert.deepEqual(await real.getJson("https://x.test/good", { Authorization: "Bearer t" }), {
      fine: true,
    });
    assert.equal(seen[0].options.headers["User-Agent"], "vaulte-dashboard");
    assert.equal(seen[0].options.headers.Authorization, "Bearer t");
    assert.ok(seen[0].options.signal instanceof AbortSignal);
    await real.getJson("https://x.test/plain");
    assert.deepEqual(Object.keys(seen[1].options.headers), ["User-Agent"]);
    await assert.rejects(real.getJson("https://x.test/bad"), /https:\/\/x\.test\/bad: 503/);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("the default clock is the real time", () => {
  const before = Date.now();
  const t = real.now();
  assert.ok(typeof t === "number" && t >= before && t <= Date.now());
});

test("gather asks for the Production deployments, the main branch and the open issues of this repository", async () => {
  await gather();
  assert.ok(urls.includes(`${GH}/actions/runs?branch=main&per_page=6`));
  assert.ok(urls.includes(`${GH}/deployments?environment=Production&per_page=1`));
  assert.ok(urls.includes(`${GH}/issues?state=open&per_page=20`));
  assert.ok(urls.includes(`${GH}/actions/workflows/ubuntu-26-canary.yml/runs?per_page=5`));
});
