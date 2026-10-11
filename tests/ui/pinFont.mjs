// tests/ui/pinFont.mjs — fixed text height for specs whose golden numbers depend on it (Fix 71).
// The expanded Trajectory chart is as tall as what is left under its heading, so its drawing
// follows the heading's line height. The harness pages set no font and every OS rounds a font's
// line height differently (Windows 706, Linux default 707, Linux Liberation Sans 708), so a font
// alone does not make it repeatable. An explicit line-height does: it no longer depends on the font.
const CSS = `* { font-family: Arial, "Liberation Sans", sans-serif !important; line-height: 1.25 !important; }`;

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
