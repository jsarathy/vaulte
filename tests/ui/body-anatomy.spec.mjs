// tests/ui/body-anatomy.spec.mjs — the Body tab's measurement sites panel (Fix 26 PR 32): the
// anatomy figure (male / female, every site highlighted, label side), how-to-measure text and
// latest reading, following the chosen or hovered pill; and the tab's two-column frame. Pinned in
// tests/ui/fixtures/body-anatomy.json.
// Re-record only for a deliberate visual change: UPDATE_GOLDEN=1 npx playwright test
// body-anatomy --workers=1 (then review the JSON diff).
import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";

const GOLDEN_FILE = new URL("./fixtures/body-anatomy.json", import.meta.url);
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

// latest per site: waist from the newest row; hip only on the oldest; chest 0 still counts;
// neck null on the newest row falls back to the one before
const ROWS = [
  { id: "2026-09-20", waist: 101.54, hip: 108, neck: 41.25, chest: 110 },
  { id: "2026-09-27", waist: 100.9, neck: 40.5, chest: 0 },
  { id: "2026-10-01", waist: 100.26, neck: null },
];
const SITES = ["Neck", "Shoulder", "L-Bicep", "R-Bicep", "Chest", "Waist", "Abdomen", "Hip"].concat(
  ["L-Thigh", "R-Thigh", "L-Calf", "R-Calf"],
);

const start = async (p, { rows = ROWS, sex } = {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), {
    __collections: { [P("body_log")]: rows },
    __docs: sex ? { [P("weight_plan/settings")]: { sex } } : {},
  });
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
  await p.getByRole("button", { name: "Body", exact: true }).click();
  await p.getByText("🧍 Measurement Sites").waitFor();
};
const errors = (p) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  return errs;
};
const describe = (root) =>
  [root, ...root.querySelectorAll("*")].map((el) => {
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.nodeValue)
      .join("");
    const attrs = [...el.attributes]
      .filter((a) => a.name !== "class")
      .map((a) => `${a.name}=${a.value.replace(/\s+/g, " ")}`);
    return [el.tagName, ...attrs, ...(own.trim() ? [`"${own}"`] : [])].join(" | ");
  });
const panel = (p) => p.getByText("🧍 Measurement Sites").locator("xpath=../..");
const figure = (p) => panel(p).locator("svg");
const pill = (p, name) =>
  p
    .getByText("📉 Trajectory")
    .locator("xpath=following-sibling::div[1]")
    .getByRole("button", { name, exact: true });
// how-to text: site, method, latest
const howTo = (p) =>
  panel(p)
    .locator("svg")
    .locator("xpath=../following-sibling::div[1]")
    .evaluate((d) => [...d.children].map((c) => c.textContent));
const figureText = (p) => figure(p).locator("text").allTextContents();

test("male figure: every site in turn, label side, latest reading", async ({ page: p }) => {
  const errs = errors(p);
  await start(p);
  // Waist is chosen at first
  expect(await howTo(p)).toEqual([
    "📏 How to measure",
    "Waist (cm)",
    "At the narrowest point of the torso, usually just above the navel, between the lowest rib and the hip bone. Stand relaxed, breathe out normally, don't pull in.",
    "Latest100.3 cm",
  ]);
  expect(await figureText(p)).toEqual(["Waist", "100.3 cm", "R", "L"]);
  matchGolden("panel-waist", await panel(p).evaluate(describe));
  const latest = {};
  for (const site of SITES) {
    await pill(p, site).click();
    await p.mouse.move(5, 5);
    latest[site] = (await howTo(p))[3];
    matchGolden(`m-${site}`, await figure(p).evaluate(describe));
  }
  expect(latest).toEqual({
    Neck: "Latest40.5 cm",
    Shoulder: "Latest—",
    "L-Bicep": "Latest—",
    "R-Bicep": "Latest—",
    Chest: "Latest0.0 cm",
    Waist: "Latest100.3 cm",
    Abdomen: "Latest—",
    Hip: "Latest108.0 cm",
    "L-Thigh": "Latest—",
    "R-Thigh": "Latest—",
    "L-Calf": "Latest—",
    "R-Calf": "Latest—",
  });
  // no reading: the figure shows the name only, the panel a grey dash
  await pill(p, "R-Calf").click();
  await p.mouse.move(5, 5);
  expect(await figureText(p)).toEqual(["R-Calf", "R", "L"]);
  matchGolden("panel-none", await panel(p).evaluate(describe));
  expect(errs).toEqual([]);
});

test("female figure", async ({ page: p }) => {
  const errs = errors(p);
  await start(p, { sex: "f" });
  matchGolden("f-Waist", await figure(p).evaluate(describe));
  for (const site of ["Chest", "Hip", "L-Bicep", "R-Thigh", "Neck"]) {
    await pill(p, site).click();
    await p.mouse.move(5, 5);
    matchGolden(`f-${site}`, await figure(p).evaluate(describe));
  }
  expect(errs).toEqual([]);
});

test("hovering a pill shows that site until the pointer leaves", async ({ page: p }) => {
  const errs = errors(p);
  await start(p);
  await pill(p, "Hip").hover();
  await expect.poll(async () => (await howTo(p))[1]).toBe("Hip (cm)");
  expect(await figureText(p)).toEqual(["Hip", "108.0 cm", "R", "L"]);
  await p.mouse.move(5, 5);
  await expect.poll(async () => (await howTo(p))[1]).toBe("Waist (cm)");
  await pill(p, "Neck").focus();
  await expect.poll(async () => (await howTo(p))[1]).toBe("Neck (cm)");
  await pill(p, "Neck").blur();
  await expect.poll(async () => (await howTo(p))[1]).toBe("Waist (cm)");
  expect(errs).toEqual([]);
});

test("the tab's frame: two columns; empty log", async ({ page: p }) => {
  const errs = errors(p);
  await start(p, { rows: [] });
  const frame = p.getByText("📏 Body Log").locator("xpath=../../..");
  const cols = await frame.evaluate((d) => ({
    style: d.getAttribute("style"),
    cols: [...d.children].map((c) => c.getAttribute("style")),
  }));
  matchGolden("frame", cols);
  expect(await howTo(p)).toEqual([
    "📏 How to measure",
    "Waist (cm)",
    "At the narrowest point of the torso, usually just above the navel, between the lowest rib and the hip bone. Stand relaxed, breathe out normally, don't pull in.",
    "Latest—",
  ]);
  expect(errs).toEqual([]);
});
