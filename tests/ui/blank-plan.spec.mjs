// tests/ui/blank-plan.spec.mjs — a new account's blank Plan Specifications (Fix 132): the card and
// the rest of the Weight tab work with no figures, and the person fills in their own plan.
import { test, expect } from "./cover.mjs";
import { BLANK_PLAN_CONFIG } from "../../src/constants/weightPlan.js";

test.use({ timezoneId: "Europe/London" });
const P = (x) => `users/u/${x}`;

const start = async (p, extra = {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  const init = { __docs: { [P("weight_plan/settings")]: BLANK_PLAN_CONFIG }, ...extra };
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await p.getByRole("button", { name: "Weight", exact: true }).click();
  await p.getByTestId("tab-loading").waitFor({ state: "detached" });
};
const card = (p) => p.getByText("📋 Plan Specifications").locator("xpath=../..");
const row = (p, label) => card(p).getByText(label, { exact: true }).locator("xpath=..");
const field = (p, label) =>
  card(p).locator("span", { hasText: label }).locator("xpath=..").locator("input,select");

test("a blank plan shows dashes, not the owner's figures, and nothing breaks", async ({
  page: p,
}) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await start(p);
  for (const label of [
    "Age",
    "Sex",
    "Height",
    "Start Weight",
    "Start BMI",
    "Target",
    "Target BMI",
    "VO₂ Max",
    "Cum-loss base",
    "Plan length",
    "End weight",
  ])
    await expect(row(p, label)).toHaveText(`${label}—`);
  await expect(card(p).getByText("83.8 kg")).toHaveCount(0);
  await expect(card(p).getByText("START", { exact: true })).toHaveCount(0); // no milestones without a curve
  expect(errs).toEqual([]);
});

test("the person enters a plan and it is saved over the blank one", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await start(p);
  await card(p).getByRole("button", { name: "✏ Edit", exact: true }).click();
  await expect(field(p, "Sex")).toHaveValue("");
  await field(p, "Age (yr)").fill("41");
  await field(p, "Sex").selectOption("f");
  await field(p, "Height (cm)").fill("170");
  await field(p, "Start Wt (kg)").fill("80");
  await card(p).getByRole("button", { name: "💾 Save Plan" }).click();
  await expect(row(p, "Age")).toHaveText(/41 yr/);
  await expect(row(p, "Sex")).toHaveText(/Female/);
  await expect(row(p, "Start BMI")).toHaveText(/27\.7/);
  await expect(row(p, "Target")).toHaveText(/—/);
  const saved = await p.evaluate(
    () => window.__setDocs.filter((s) => s.path === "users/u/weight_plan/settings").at(-1).data,
  );
  expect(saved).toMatchObject({ age: 41, sex: "f", heightCm: 170, startWeightKg: 80 });
  expect(errs).toEqual([]);
});

test("a weight reading on a blank plan has no Cum Loss figure", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await start(p, {
    __docs: {
      [P("weight_plan/settings")]: BLANK_PLAN_CONFIG,
      [P("weight_log/2026-10-03")]: { date: "2026-10-03", actual: 80 },
    },
  });
  await expect(p.getByText("-6.5 kg")).toHaveCount(0); // 86.45 - 80 would read as a loss
  expect(errs).toEqual([]);
});
