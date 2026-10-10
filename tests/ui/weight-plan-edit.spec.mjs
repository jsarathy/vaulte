// tests/ui/weight-plan-edit.spec.mjs — editing the Weight tab's plan (Fix 26 PR 24): the Personal
// Stats and Projection Curve editors (every field reaches the saved plan; blank numbers save as 0),
// curve anchors (edit, add, remove, dates) and the tab's layout, pinned in
// tests/ui/fixtures/weight-plan-edit.json.
// Re-record only for a deliberate visual change: UPDATE_GOLDEN=1 npx playwright test weight-plan-edit
import { test, expect } from "./cover.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const GOLDEN_FILE = new URL("./fixtures/weight-plan-edit.json", import.meta.url);
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

const start = async (p, plan) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  const init = { __docs: plan ? { [P("weight_plan/settings")]: plan } : {} }; // init scripts pile up
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await p.getByRole("button", { name: "Weight", exact: true }).click();
  await p.getByRole("button", { name: "✏ Edit", exact: true }).click();
};
const errors = (p) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  return errs;
};

const card = (p) => p.getByText("📋 Plan Specifications").locator("xpath=../..");
const describe = (root) =>
  [root, ...root.querySelectorAll("*")].map((el) => {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue)
      .join("");
    const style = (el.getAttribute("style") ?? "").replace(
      "border-width: medium; border-style: none; border-color: currentcolor; border-image: none;",
      "border: none;",
    );
    const parts = [el.tagName, style];
    if (own.trim()) parts.push(`"${own}"`);
    if (["INPUT", "SELECT", "OPTION", "BUTTON"].includes(el.tagName))
      parts.push(
        ...["type", "step", "value", "title"].map((a) => `${a}=${el.getAttribute(a)}`),
        `now=${el.value}`,
      );
    return parts.join(" | ");
  });
const shape = (p) => card(p).evaluate(describe);
// The editor under a section heading
const editor = (p, title) => card(p).getByText(title).locator("xpath=following-sibling::div[1]");
const field = (p, label) => card(p).getByText(label, { exact: true }).locator("xpath=../*[2]");
const anchorRows = (p) =>
  editor(p, "📈 Projection Curve")
    .locator("xpath=div[2]/div[position()>1]")
    .evaluateAll((rows) =>
      rows
        .filter((r) => r.querySelector("input"))
        .map((r) =>
          [...r.querySelectorAll("input")]
            .map((i) => i.value)
            .concat(r.querySelector("span").textContent),
        ),
    );
const save = async (p) => {
  await card(p).getByRole("button", { name: "💾 Save Plan", exact: true }).click();
  const saved = await p.evaluate(() =>
    window.__setDocs.filter((s) => s.path === "users/u/weight_plan/settings").map((s) => s.data),
  );
  return saved.at(-1);
};

test("editors as shown, and the tab's layout", async ({ page: p }) => {
  const errs = errors(p);
  await start(p);
  matchGolden("default", await shape(p));
  expect(await anchorRows(p)).toEqual([
    ["4", "78.4", "13 Sept 26"],
    ["8", "74.5", "11 Oct 26"],
    ["12", "71.7", "08 Nov 26"],
    ["16", "69.7", "06 Dec 26"],
    ["20", "68.2", "03 Jan 27"],
    ["24", "67.1", "31 Jan 27"],
    ["28", "66.3", "28 Feb 27"],
    ["32", "65.8", "28 Mar 27"],
    ["36", "65.3", "25 Apr 27"],
    ["40", "65", "23 May 27"],
  ]);
  // the whole tab: two columns
  const layout = await card(p)
    .locator("xpath=ancestor::div[contains(@style, 'flex: 1')][1]")
    .evaluate((root) => [root, ...root.children].map((el) => el.getAttribute("style")));
  matchGolden("layout", layout);
  expect(errs).toEqual([]);
});

test("every field reaches the saved plan", async ({ page: p }) => {
  const errs = errors(p);
  await start(p);
  await field(p, "Age (yr)").fill("61");
  await field(p, "Sex").selectOption("f");
  await field(p, "Height (cm)").fill("166");
  await field(p, "Start Wt (kg)").fill("84.1");
  await field(p, "Start Date").fill("2026-08-09");
  await field(p, "VO₂ Max").fill("36.5");
  await field(p, "Target Min (kg)").fill("69.5");
  await field(p, "Target Max (kg)").fill("71.5");
  await field(p, "Cum-loss base (kg)").fill("86.12");
  await field(p, "Maint. kcal").fill("2200");
  await field(p, "Sync from (ignore earlier)").fill("2026-08-20");
  // anchor dates follow the start date
  expect((await anchorRows(p))[0]).toEqual(["4", "78.4", "06 Sept 26"]);
  matchGolden("filled", await shape(p));
  const saved = await save(p);
  expect(saved).toMatchObject({
    age: 61,
    sex: "f",
    heightCm: 166,
    startWeightKg: 84.1,
    startDate: "2026-08-09",
    vo2max: 36.5,
    targetWeightMinKg: 69.5,
    targetWeightMaxKg: 71.5,
    cumLossBaselineKg: 86.12,
    maintenanceCaloriesKcal: 2200,
    syncFromDate: "2026-08-20",
  });
  await expect(card(p).getByText("36.5 — Good", { exact: true })).toBeVisible();

  // blank numbers save as 0
  await card(p).getByRole("button", { name: "✏ Edit", exact: true }).click();
  await field(p, "Age (yr)").fill("");
  await expect(field(p, "Age (yr)")).toHaveValue("0");
  await field(p, "Maint. kcal").fill("");
  expect(await save(p)).toMatchObject({ age: 0, maintenanceCaloriesKcal: 0 });
  expect(errs).toEqual([]);
});

test("curve anchors: edit, add, remove", async ({ page: p }) => {
  const errs = errors(p);
  await start(p, {
    startDate: "2026-08-16",
    startWeightKg: 84,
    planAnchors: [
      { week: 4, weightKg: 80 },
      { week: 8, weightKg: 77.5 },
    ],
  });
  const curve = editor(p, "📈 Projection Curve");
  const row = (i) => curve.locator("xpath=div[2]/div[position()>1]").nth(i);
  await row(1).locator("input").nth(0).fill("10");
  await row(1).locator("input").nth(1).fill("76.25");
  expect(await anchorRows(p)).toEqual([
    ["4", "80", "13 Sept 26"],
    ["10", "76.25", "25 Oct 26"],
  ]);
  // Add: four weeks after the last, at its weight
  await curve.getByRole("button", { name: "+ Add anchor" }).click();
  expect((await anchorRows(p))[2]).toEqual(["14", "76.25", "22 Nov 26"]);
  // blank week / weight become 0
  await row(2).locator("input").nth(0).fill("");
  await row(2).locator("input").nth(1).fill("");
  expect((await anchorRows(p))[2]).toEqual(["0", "0", "16 Aug 26"]);
  // Add after a 0 kg anchor: falls back to the start weight
  await curve.getByRole("button", { name: "+ Add anchor" }).click();
  expect((await anchorRows(p))[3]).toEqual(["4", "84", "13 Sept 26"]);
  // remove the second
  await row(1).getByTitle("Remove").click();
  expect(await anchorRows(p)).toEqual([
    ["4", "80", "13 Sept 26"],
    ["0", "0", "16 Aug 26"],
    ["4", "84", "13 Sept 26"],
  ]);
  matchGolden("anchors", await shape(p));
  expect((await save(p)).planAnchors).toEqual([
    { week: 4, weightKg: 80 },
    { week: 0, weightKg: 0 },
    { week: 4, weightKg: 84 },
  ]);
  // remove them all, then add: week 4 at the start weight
  await card(p).getByRole("button", { name: "✏ Edit", exact: true }).click();
  for (let i = 0; i < 3; i++) await row(0).getByTitle("Remove").click();
  expect(await anchorRows(p)).toEqual([]);
  await curve.getByRole("button", { name: "+ Add anchor" }).click();
  expect(await anchorRows(p)).toEqual([["4", "84", "13 Sept 26"]]);
  expect(errs).toEqual([]);
});

test("odd plans: no anchors list, no start date, 0 kg start weight", async ({ page: p }) => {
  const errs = errors(p);
  await start(p, { planAnchors: "none", startDate: "", startWeightKg: 0, syncFromDate: "" });
  expect(await anchorRows(p)).toEqual([]);
  await expect(field(p, "Sync from (ignore earlier)")).toHaveValue("");
  const curve = editor(p, "📈 Projection Curve");
  await curve.getByRole("button", { name: "+ Add anchor" }).click();
  expect(await anchorRows(p)).toEqual([["4", "0", "—"]]); // no start date: no anchor date
  await curve.locator("xpath=div[2]/div[2]").locator("input").nth(0).fill("");
  expect(await anchorRows(p)).toEqual([["0", "0", "—"]]);
  matchGolden("odd", await shape(p));
  // an anchor without a week has no date; a missing number shows blank
  await start(p, { planAnchors: [{ weightKg: 80 }], cumLossBaselineKg: null });
  expect(await anchorRows(p)).toEqual([["", "80", "—"]]);
  await expect(field(p, "Cum-loss base (kg)")).toHaveValue("");
  // a missing anchors list is edited as an empty one
  await start(p, { planAnchors: null, startDate: "2026-08-16" });
  await editor(p, "📈 Projection Curve").getByRole("button", { name: "+ Add anchor" }).click();
  expect(await anchorRows(p)).toEqual([["4", "83.75", "13 Sept 26"]]);
  expect((await save(p)).planAnchors).toEqual([{ week: 4, weightKg: 83.75 }]);
  expect(errs).toEqual([]);
});
