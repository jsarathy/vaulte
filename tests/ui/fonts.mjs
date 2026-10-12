// tests/ui/fonts.mjs — wait for the page's web font (Fix 107). The pages load Cormorant Garamond from
// Google Fonts with `display=swap`, so for a moment the text is in a wider fallback font. A spec that
// measures widths (a table that must fit the screen) has to wait, or it passes when the font is quick
// and fails when it is slow (seen on CI, 393 px against 373).
export const fontsReady = (page) =>
  page.evaluate(async () => {
    await document.fonts.ready;
    await document.fonts.load('16px "Cormorant Garamond"').catch(() => []);
    await document.fonts.ready;
  });
