// tests/ui/day-summary.spec.mjs — the top of the Daily log (Fix 26 PR 28): the day header and
// its arrows, the calorie bar (net kcal, energy target, activity tier, macro pills, "Left",
// fat burned, progress bar), pinned in tests/ui/fixtures/day-summary.json.
// Re-record only for a deliberate visual change: UPDATE_GOLDEN=1 npx playwright test day-summary
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const GOLDEN_FILE = new URL("./fixtures/day-summary.json", import.meta.url);
const UPDATE = !!process.env.UPDATE_GOLDEN;
const golden = UPDATE ? {} : JSON.parse(readFileSync(GOLDEN_FILE, "utf8"));
test.afterAll(() => {
  if (UPDATE) writeFileSync(GOLDEN_FILE, JSON.stringify(golden, null, 2) + "\n");
});
const matchGolden = (name, value) => {
  if (UPDATE) golden[name] = value;
  else expect(value, name).toEqual(golden[name]);
};

test.use({ timezoneId: "Europe/London" });
const P = (x) => `users/u/${x}`;

const food = (id, kcal, m = {}) => ({ id, name: "Food " + id, kcal, ...m });
const day = (date, foods, burned = 0) => ({
  date,
  notes: "",
  meals: [
    { id: "b" + date, name: "☕ Breakfast", items: foods },
    {
      id: "x" + date,
      name: "🏋️ Morning Exercise",
      is_exercise: 1,
      items: burned ? [{ id: "w" + date, name: "Walk", kcal: -burned, is_exercise: 1 }] : [],
    },
  ],
});
// newest first, as loaded; each a different activity tier
const DAYS = [
  // over on everything: 3,000 kcal eaten, 400 burned (Very Active)
  day(
    "2026-10-04",
    [food("a", 3000, { protein: 140.26, fat: 150, carbs: 400, net_carbs: 380 })],
    400,
  ),
  // 200 burned (Moderately Active), under on everything
  day("2026-10-03", [food("b", 900, { protein: 60, fat: 20, carbs: 90, net_carbs: 70.04 })], 200),
  // 100 burned (Lightly Active); exactly on the protein target
  day("2026-10-02", [food("c", 1200, { protein: 118, fat: 0, carbs: 0, net_carbs: 0 })], 100),
  // nothing burned (Sedentary); nothing eaten
  day("2026-10-01", []),
];

const start = async (p, init = {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), { __days: DAYS, __docs: {}, ...init });
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await expect(p.getByText("net kcal of")).toBeVisible();
};
const watch = (p) => {
  const out = { errs: [] };
  p.on("pageerror", (e) => out.errs.push(e.message));
  return out;
};
const describe = (root) =>
  [root, ...root.querySelectorAll("*")].map((el) => {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue)
      .join("")
      .replace(
        /^((?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day|Mon|Tue|Wed|Thu|Fri|Sat|Sun), /,
        "$1 ",
      ); // CI's ICU adds a comma
    const style = (el.getAttribute("style") ?? "").replace(
      "border-width: medium; border-style: none; border-color: currentcolor; border-image: none;",
      "border: none;",
    );
    const attrs = ["width", "height", "viewBox", "d", "stroke", "fill"]
      .filter((a) => el.hasAttribute(a))
      .map((a) => `${a}=${el.getAttribute(a)}`);
    return [el.tagName, style, ...attrs, ...(own.trim() ? [`"${own}"`] : [])].join(" | ");
  });
// The day header and calorie bar: the first two blocks of the Daily log
const header = (p) =>
  p
    .locator("div")
    .filter({ has: p.getByRole("button") })
    .filter({ hasText: /^\w{3},? \d+ \w{3} \d{4}$/ })
    .last();
const bar = (p) => header(p).locator("xpath=following-sibling::div[1]");
const shapes = async (p) => ({
  header: await header(p).evaluate(describe),
  bar: await bar(p).evaluate(describe),
});
const title = (p) => header(p).locator("div").first().textContent();
const arrows = (p) => header(p).getByRole("button");
const pills = (p) =>
  bar(p)
    .locator(":scope > div:first-child > div:last-child > div")
    .evaluateAll((ds) => ds.map((d) => [...d.children].map((c) => c.textContent)));
const figure = async (p) => (await bar(p).locator("span").first().textContent()).trim();
const caption = (p) => bar(p).locator("span").nth(1).textContent();
const progress = (p) =>
  bar(p)
    .locator(":scope > div:last-child > div")
    .evaluate((d) => d.style.width);

test("day header: date, older / newer arrows, ends of the list", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  expect(await title(p)).toMatch(/^Sun,? 4 Oct 2026$/);
  matchGolden("over", await shapes(p));
  // right: a newer day — none
  await arrows(p).nth(1).click();
  expect(await title(p)).toMatch(/^Sun,? 4 Oct 2026$/);
  // left: older, down to the oldest, then nothing
  for (const want of [/^Sat,? 3 Oct/, /^Fri,? 2 Oct/, /^Thu,? 1 Oct/, /^Thu,? 1 Oct/]) {
    await arrows(p).nth(0).click();
    await expect.poll(() => title(p)).toMatch(want);
  }
  matchGolden("empty", await shapes(p));
  await arrows(p).nth(1).click();
  await expect.poll(() => title(p)).toMatch(/^Fri,? 2 Oct/);
  expect(w.errs).toEqual([]);
});

test("calorie bar, per activity tier", async ({ page: p }) => {
  const w = watch(p);
  await start(p);
  // BMR (m, 60 y, 165 cm, 84 kg) 1,576.25; protein target 118 g
  // 4 Oct: 400 burned → Very Active ×1.725 = 2,719
  expect(await figure(p)).toBe("2,600");
  expect(await caption(p)).toBe("net kcal of 2,719 · Very Active");
  expect(await pills(p)).toEqual([
    ["Protein", "140.3g"],
    ["Fat", "150g"],
    ["Carbs", "400g"],
    ["Fat burned", "0g"], // the walk has no fat burned recorded
    ["Left", "-‎119"],
  ]);
  expect(await progress(p)).toBe("96%");

  // 3 Oct: 200 burned → Moderately Active ×1.55 = 2,443; 700 net, 1,743 left
  await arrows(p).nth(0).click();
  await expect.poll(() => caption(p)).toBe("net kcal of 2,443 · Moderately Active");
  expect(await figure(p)).toBe("700");
  expect((await pills(p)).at(-1)).toEqual(["Left", "-‎1,743"]);
  expect(await progress(p)).toBe("29%");
  matchGolden("under", await shapes(p));

  // 2 Oct: 100 burned → Lightly Active ×1.375 = 2,167; exactly on target isn't over
  await arrows(p).nth(0).click();
  await expect.poll(() => caption(p)).toBe("net kcal of 2,167 · Lightly Active");
  matchGolden("onTarget", await shapes(p));

  // 1 Oct: nothing → Sedentary ×1.2 = 1,892
  await arrows(p).nth(0).click();
  await expect.poll(() => caption(p)).toBe("net kcal of 1,892 · Sedentary");
  expect(await figure(p)).toBe("0");
  expect(await progress(p)).toBe("0%");
  expect(w.errs).toEqual([]);
});

test("fat burned: the day's exercise entries added up (Fix 33)", async ({ page: p }) => {
  const w = watch(p);
  const ride = { id: "r", name: "Ride", kcal: -300, is_exercise: 1, fat_burned_g: 12 };
  const walk = { id: "w", name: "Walk", kcal: -100, is_exercise: 1, fat_burned_g: 6.44 };
  const d = day("2026-10-04", [food("a", 1000)]);
  d.meals[1].items = [ride, walk];
  await start(p, { __days: [d] });
  await expect.poll(() => pills(p).then((s) => s.at(-2))).toEqual(["Fat burned", "18.4g"]);
  expect(w.errs).toEqual([]);
});

test("tier boundaries, a woman's target, eating past the target", async ({ page: p }) => {
  const w = watch(p);
  const edge = (burned, kcal = 0, m) => [day("2026-10-04", [food("a", kcal, m)], burned)];
  // exactly 300 / 150 burned stay in the lower tier; 2,000 kcal (f: BMR 1,410.25 × 1.55) is over
  await start(p, {
    __days: edge(300, 2500),
    __docs: { [P("settings/calculator")]: { sex: "f" } },
  });
  await expect.poll(() => caption(p)).toBe("net kcal of 2,186 · Moderately Active");
  expect(await figure(p)).toBe("2,200");
  expect((await pills(p)).at(-1)).toEqual(["Left", "+‎14"]);
  expect(await progress(p)).toBe("100%");
  matchGolden("overTarget", await shapes(p));

  await start(p, { __days: edge(150) });
  await expect.poll(() => caption(p)).toBe("net kcal of 2,167 · Lightly Active");
  expect(await figure(p)).toBe("-150");
  expect(await progress(p)).toBe("0%"); // a negative net kcal: an empty bar (Fix 34)
  expect((await pills(p)).at(-1)).toEqual(["Left", "-‎2,317"]);

  // a fraction of a kcal burned already counts; "Left" exactly 0 is still under
  await start(p, { __days: edge(0.4, 1892.4) });
  await expect.poll(() => caption(p)).toBe("net kcal of 2,167 · Lightly Active");
  await start(p, { __days: edge(0, 1892, { net_carbs: 213 }) }); // the carbs target exactly
  await expect.poll(() => caption(p)).toBe("net kcal of 1,892 · Sedentary");
  expect((await pills(p)).at(-1)).toEqual(["Left", "-‎0"]);
  expect(await progress(p)).toBe("100%");
  matchGolden("zeroLeft", await shapes(p));
  expect(w.errs).toEqual([]);
});

test("Apple Watch activity counts towards the day's burn", async ({ page: p }) => {
  const w = watch(p);
  const apple = { totals: { steps: 6000, activeMin: 30, flights: 3 } };
  await start(p, {
    __days: [day("2026-10-04", [food("a", 1000)], 100), day("2026-10-03", [food("b", 500)])],
    __docs: { [P("apple_activity/2026-10-04")]: apple },
  });
  await expect.poll(figure.bind(null, p)).not.toBe("900"); // Apple's kcal came off the net
  matchGolden("apple", {
    caption: await caption(p),
    figure: await figure(p),
  });
  expect((await pills(p)).at(-2)).toEqual(["Fat burned", "0g"]); // workouts only
  // another day: Apple's share is dropped
  await arrows(p).nth(0).click();
  await expect.poll(() => caption(p)).toBe("net kcal of 1,892 · Sedentary");
  expect(await figure(p)).toBe("500");
  expect(w.errs).toEqual([]);
});
