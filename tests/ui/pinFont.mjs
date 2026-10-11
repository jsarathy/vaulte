// tests/ui/pinFont.mjs — one font for specs whose golden numbers depend on text height (Fix 71).
// The harness pages set no font, so each OS used its own default and the expanded Trajectory chart
// (its height is what is left under the heading) came out 1 px different on Windows. Arial and
// Liberation Sans (what Linux CI substitutes for Arial) have identical metrics.
const CSS = `* { font-family: Arial, "Liberation Sans", sans-serif !important; }`;

export const pinFont = (page) =>
  page.addInitScript((css) => {
    const add = () => {
      const s = document.createElement("style");
      s.textContent = css;
      document.head.append(s);
    };
    if (document.head) add();
    else document.addEventListener("DOMContentLoaded", add);
  }, CSS);
