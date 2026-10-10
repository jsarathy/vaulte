// tests/ui/calendar-logged-days.spec.mjs — Fix 7 follow-up — calendar marks only days with content
// Converted from the one-off browser check used when the fix shipped; kept so it re-runs on every PR.
import { test, expect } from "./cover.mjs";

test("Fix 7 follow-up — calendar marks only days with content", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  // Serverless endpoints only (/api/...), not the app's own src/api/ modules served by Vite
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  // Calendar opens on the current month — pin "today" to 4 Oct 2026 so the test never goes stale
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  const cellStyle = (d) =>
    p.evaluate((day) => {
      const c = [...document.querySelectorAll("div")].find(
        (el) =>
          el.onclick !== undefined &&
          el.title !== undefined &&
          el.childNodes[0]?.nodeValue === String(day) &&
          el.style.fontFamily,
      );
      return c ? { bg: c.style.background, w: c.style.fontWeight } : null;
    }, d);
  const ok = (n, c, x = "") => expect.soft(!!c, `${n} ${x}`.trim()).toBe(true);
  const s = {};
  for (const d of [1, 2, 3, 4, 5]) s[d] = await cellStyle(d);
  const marked = (d) => s[d] && s[d].w === "500";
  ok("Oct 1 (food) marked", marked(1));
  ok("Oct 2 (emptied) NOT marked", s[2] && !marked(2));
  ok("Oct 3 (notes only) marked", marked(3));
  ok("Oct 4 (exercise only) marked", marked(4));
  ok("Oct 5 (no record) not marked", s[5] && !marked(5));

  ok("no page errors", errs.length === 0, errs.join(" | "));
});
