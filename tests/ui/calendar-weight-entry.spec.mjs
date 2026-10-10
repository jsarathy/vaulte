// tests/ui/calendar-weight-entry.spec.mjs — the sidebar calendar and the weight entry box
// (Fix 26 PR 16): month grid, day marks, month paging, and adding / editing / deleting a
// weight_log row from the Weight tab.
import { test, expect } from "./cover.mjs";

const start = async (p, init = {}) => {
  await p.route(
    (u) => new URL(u).pathname.startsWith("/api/"),
    (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }),
  );
  await p.clock.setFixedTime(new Date("2026-10-04T10:00:00"));
  await p.addInitScript((i) => Object.assign(window, i), init);
  await p.goto("/tracker.html");
  await p.getByText("October 2026").waitFor();
};
// Calendar day cells: { text, title, background, color, weight, outline } for each day shown
const cells = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll("div[title]")]
      .filter((el) => el.style.fontFamily && /^\d+$/.test(el.childNodes[0]?.nodeValue || ""))
      .map((el) => ({
        day: Number(el.childNodes[0].nodeValue),
        sub: el.querySelector("span")?.textContent ?? null,
        title: el.title,
        bg: el.style.background,
        color: el.style.color,
        weight: el.style.fontWeight,
        outline: el.style.outline,
      })),
  );
const blanks = (p) =>
  p.evaluate(() => {
    const first = [...document.querySelectorAll("div[title]")].find(
      (el) => el.style.fontFamily && el.childNodes[0]?.nodeValue === "1",
    );
    return [...first.parentElement.children].indexOf(first);
  });
const clickDay = (p, n) =>
  p.evaluate((d) => {
    [...document.querySelectorAll("div[title]")]
      .find((el) => el.style.fontFamily && el.childNodes[0]?.nodeValue === String(d))
      .click();
  }, n);

test("calendar: grid, marks and paging", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await start(p);
  const header = p
    .getByText(/^[A-Z][a-z]+ \d{4}$/)
    .first()
    .locator("..");
  const [prev, next] = [header.locator("button").first(), header.locator("button").last()];
  const dows = await header
    .locator("xpath=following-sibling::div[1]/div")
    .evaluateAll((es) => es.map((e) => e.textContent));
  expect(dows).toEqual(["M", "T", "W", "T", "F", "S", "S"]);

  let c = await cells(p);
  expect(c.map((x) => x.day)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1));
  expect(await blanks(p)).toBe(3); // 1 Oct 2026 is a Thursday
  const day = (n) => c.find((x) => x.day === n);
  // 1 Oct: the open day (first loaded), with food → kcal in the title and under the number
  expect(day(1)).toEqual({
    day: 1,
    sub: "52",
    title: "52 kcal",
    bg: "rgb(55, 138, 221)",
    color: "rgb(255, 255, 255)",
    weight: "500",
    outline: "none",
  });
  // 2 Oct emptied: not marked; 3 Oct notes only: marked; 4 Oct today, exercise only: marked + ring
  expect(day(2)).toMatchObject({ sub: null, title: "", bg: "transparent", weight: "400" });
  expect(day(2).color).toBe("rgb(107, 114, 128)");
  expect(day(3)).toMatchObject({
    bg: "rgb(230, 241, 251)",
    color: "rgb(24, 95, 165)",
    weight: "500",
  });
  expect(day(4)).toMatchObject({ bg: "rgb(230, 241, 251)", sub: "-250", title: "-250 kcal" });
  expect(day(4).outline).toBe("rgb(55, 138, 221) solid 1px");
  // the open day moves with a click; today stays ringed only while it isn't open
  await clickDay(p, 4);
  c = await cells(p);
  expect(day(4)).toMatchObject({ bg: "rgb(55, 138, 221)", outline: "none", weight: "500" });
  expect(day(1)).toMatchObject({ bg: "rgb(230, 241, 251)", color: "rgb(24, 95, 165)" });
  await clickDay(p, 5);
  c = await cells(p);
  expect(day(5)).toMatchObject({ bg: "rgb(55, 138, 221)", weight: "500" }); // open, not logged
  expect(day(4).outline).toBe("rgb(55, 138, 221) solid 1px");
  expect(day(4).color).toBe("rgb(24, 95, 165)");

  // Paging: across year ends both ways
  await prev.click();
  await expect(p.getByText("September 2026")).toBeVisible();
  expect((await cells(p)).length).toBe(30);
  expect(await blanks(p)).toBe(1);
  for (let i = 0; i < 9; i++) await prev.click();
  await expect(p.getByText("December 2025")).toBeVisible();
  await next.click();
  await expect(p.getByText("January 2026")).toBeVisible();
  expect(await blanks(p)).toBe(3);
  for (let i = 0; i < 11; i++) await next.click();
  await expect(p.getByText("December 2026")).toBeVisible();
  await next.click();
  await expect(p.getByText("January 2027")).toBeVisible();
  // a day in another month: today's ring only on today's date
  c = await cells(p);
  expect(c.every((x) => x.outline === "none")).toBe(true);
  for (let i = 0; i < 4; i++) await prev.click();
  await expect(p.getByText("September 2026")).toBeVisible();
  c = await cells(p);
  expect(c.filter((x) => x.outline !== "none")).toEqual([]);
  expect(errs).toEqual([]);
});

test("weight entry box", async ({ page: p }) => {
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  const logged = [];
  p.on("console", (m) => m.type() === "error" && logged.push(m.text()));
  await start(p, {
    __collections: {
      "users/u/weight_log": [
        {
          id: "2026-10-02",
          date: "2026-10-02",
          week: 3,
          dose: "2.5mg",
          projected: 85,
          actual: 84.2,
        },
        { id: "2026-10-03", date: "2026-10-03", projected: 0, actual: 84 },
      ],
    },
  });
  const ev = (f, a) => p.evaluate(f, a);
  await p.getByRole("button", { name: "Weight", exact: true }).click();
  const title = p.getByText(/^(New|Edit) Weight Entry$/);
  const field = (label) =>
    p.locator(`xpath=//div[div[normalize-space(.)="${label}"]]/input`).first();
  const values = async () =>
    Promise.all(
      ["Week", "Dose", "Projected (kg)", "Actual (kg)"].map((l) => field(l).inputValue()),
    );
  const saves = () => ev(() => window.__setDocs.filter((s) => s.path.includes("weight_log")));

  // An existing row opens for editing, with Delete
  await clickDay(p, 2);
  await expect(title).toHaveText("Edit Weight Entry");
  await expect(title.locator("..").getByText("2026-10-02", { exact: true })).toBeVisible();
  expect(await values()).toEqual(["3", "2.5mg", "85", "84.2"]);
  await expect(p.getByRole("button", { name: "Delete" })).toBeVisible();
  // a row with fields missing: blanks
  await p.getByRole("button", { name: "Cancel" }).click();
  await expect(title).toHaveCount(0);
  await clickDay(p, 3);
  expect(await values()).toEqual(["", "", "0", "84"]);
  await field("Dose").fill("x"); // typing into a blank field (no React warnings)
  // backdrop closes; a click inside doesn't
  await title.click();
  await expect(title).toBeVisible();
  await p.mouse.click(5, 5);
  await expect(title).toHaveCount(0);

  // A new date: empty fields, placeholders, no Delete; Save writes a cleaned row
  await clickDay(p, 5);
  await expect(title).toHaveText("New Weight Entry");
  expect(await values()).toEqual(["", "", "", ""]);
  expect(
    await Promise.all(
      ["Week", "Dose", "Projected (kg)", "Actual (kg)"].map((l) =>
        field(l).getAttribute("placeholder"),
      ),
    ),
  ).toEqual(["e.g. 1", "free text", "e.g. 84.0", "e.g. 83.4"]);
  await expect(p.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await field("Week").fill(" 4 ");
  await field("Dose").fill("  5mg ");
  await field("Projected (kg)").fill("abc");
  await field("Actual (kg)").fill("83.4");
  await p.getByRole("button", { name: "Save" }).click();
  await expect(title).toHaveCount(0);
  expect((await saves()).at(-1)).toEqual({
    path: "users/u/weight_log/2026-10-05",
    data: { date: "2026-10-05", week: 4, dose: "5mg", projected: null, actual: 83.4 },
  });
  // saved rows reopen as edits; saving again replaces the row (no duplicate)
  await clickDay(p, 5);
  await expect(title).toHaveText("Edit Weight Entry");
  expect(await values()).toEqual(["4", "5mg", "", "83.4"]);
  await field("Week").fill("  ");
  await field("Actual (kg)").fill("0");
  await p.getByRole("button", { name: "Save" }).click();
  await expect(title).toHaveCount(0);
  expect((await saves()).at(-1).data).toEqual({
    date: "2026-10-05",
    week: null,
    dose: "5mg",
    projected: null,
    actual: 0,
  });
  await clickDay(p, 5);
  expect(await values()).toEqual(["", "5mg", "", "0"]);

  // Delete removes it
  await p.getByRole("button", { name: "Delete" }).click();
  await expect(title).toHaveCount(0);
  expect(await ev(() => window.__deletedDocs)).toEqual(["users/u/weight_log/2026-10-05"]);
  await clickDay(p, 5);
  await expect(title).toHaveText("New Weight Entry");
  expect(await values()).toEqual(["", "", "", ""]);

  // Failures: logged, box stays open, nothing changes
  await field("Actual (kg)").fill("80");
  await ev(() => (window.__failSetDoc = true));
  await p.getByRole("button", { name: "Save" }).click();
  await expect.poll(() => logged.some((l) => l.startsWith("weight save failed"))).toBe(true);
  await expect(title).toHaveText("New Weight Entry");
  await p.getByRole("button", { name: "Cancel" }).click();
  await clickDay(p, 5);
  await expect(title).toHaveText("New Weight Entry");
  await p.getByRole("button", { name: "Cancel" }).click();
  await clickDay(p, 2);
  await ev(() => (window.__failDeleteDoc = true));
  await p.getByRole("button", { name: "Delete" }).click();
  await expect.poll(() => logged.some((l) => l.startsWith("weight delete failed"))).toBe(true);
  await expect(title).toHaveText("Edit Weight Entry");
  await p.getByRole("button", { name: "Cancel" }).click();
  await clickDay(p, 2);
  await expect(title).toHaveText("Edit Weight Entry");
  expect(logged.filter((l) => !l.startsWith("weight "))).toEqual([]);
  expect(errs).toEqual([]);
});

test("calendar: kcal rounded; today unlogged", async ({ page: p }) => {
  await start(p, {
    __days: [
      { date: "2026-10-01", notes: "", meals: [{ id: "m", name: "B", items: [{ kcal: 52.6 }] }] },
    ],
  });
  const c = await cells(p);
  expect(c[0]).toMatchObject({ sub: "53", title: "53 kcal" });
  expect(c[3]).toMatchObject({ color: "rgb(55, 138, 221)", weight: "400", bg: "transparent" });
});
