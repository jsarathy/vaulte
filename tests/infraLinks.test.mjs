// tests/infraLinks.test.mjs — the Dashboard's infrastructure links (src/constants/infraLinks.js, Fix 99).
import { test } from "node:test";
import assert from "node:assert/strict";
import { CLAUDE_LINK, INFRA_LINKS } from "../src/constants/infraLinks.js";

test("the infrastructure links: Vercel, Firebase, GitHub, GitHub Actions, GitHub issues", () => {
  assert.deepEqual(
    INFRA_LINKS.map((l) => l.name),
    ["Vercel", "Firebase", "GitHub", "GitHub Actions", "GitHub issues"],
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

test("the Anthropic Console link is the Claude box's, not an infrastructure link", () => {
  assert.deepEqual(CLAUDE_LINK, {
    name: "Anthropic Console",
    note: "Claude API usage and spend limits",
    url: "https://console.anthropic.com",
  });
  assert.equal(
    INFRA_LINKS.some((l) => l.url === CLAUDE_LINK.url),
    false,
  );
});
