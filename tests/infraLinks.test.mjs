// tests/infraLinks.test.mjs — the Dashboard's infrastructure links (src/constants/infraLinks.js, Fix 99).
import { test } from "node:test";
import assert from "node:assert/strict";
import { INFRA_LINKS } from "../src/constants/infraLinks.js";

test("the links: Vercel, Firebase, GitHub, GitHub Actions, GitHub issues and the Anthropic Console", () => {
  assert.deepEqual(
    INFRA_LINKS.map((l) => l.name),
    ["Vercel", "Firebase", "GitHub", "GitHub Actions", "GitHub issues", "Anthropic Console"],
  );
});

test("every link has a note and an https address, and none is repeated", () => {
  for (const l of INFRA_LINKS) {
    assert.ok(l.note.length > 0, l.name);
    assert.match(l.url, /^https:\/\/[a-z.-]+(\/|$)/i, l.name);
  }
  assert.equal(new Set(INFRA_LINKS.map((l) => l.url)).size, INFRA_LINKS.length);
  assert.equal(new Set(INFRA_LINKS.map((l) => l.name)).size, INFRA_LINKS.length);
});

test("nothing secret in an address: no token, key or password", () => {
  for (const l of INFRA_LINKS)
    assert.doesNotMatch(l.url, /token|key|secret|password|[?#]/i, l.name);
});
