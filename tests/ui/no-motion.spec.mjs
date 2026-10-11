// tests/ui/no-motion.spec.mjs — UI tests run with animations jumped to their end state (Fix 80).
// A button that is still sliding in can be missed by a click and that made the sign-in specs fail
// now and then on a loaded CI runner. The rule is set once in tests/ui/cover.mjs.
import { test, expect } from "./cover.mjs";

test("the sign-in panels are in place and fully shown the moment they appear", async ({ page }) => {
  await page.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/app.html");
  await page.click("text=Sign In");
  await page.click("text=Magic Link");
  const panel = page.locator(".fade-up-2").first();
  await expect(panel).toBeVisible();
  const look = await panel.evaluate((el) => {
    const s = getComputedStyle(el);
    return {
      opacity: s.opacity,
      transform: s.transform,
      delay: s.animationDelay,
      running: el.getAnimations().filter((a) => a.playState === "running").length,
    };
  });
  expect(look.opacity).toBe("1");
  expect(look.transform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/); // not 24 px down
  expect(look.delay).toBe("0s");
  expect(look.running).toBe(0);
});
