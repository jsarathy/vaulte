// src/lib/authHistory.js — the browser-history side of the sign-in pages (Fix 53): each page
// (landing, Create Account, Sign In) gets its own history entry, so Back and Forward move between
// them instead of leaving the site.

const AUTH_PAGES = ["landing", "signup", "login"];

export const isAuthPage = (page) => AUTH_PAGES.includes(page);

/** The history entry (state) that stands for a sign-in page. */
export const entryFor = (page) => ({ vaultePage: page });

/** The sign-in page a history entry stands for; null for any entry the app didn't write. */
export const pageOfEntry = (state) => (isAuthPage(state?.vaultePage) ? state.vaultePage : null);

/** What a page change does to history: add an entry, replace a foreign one, or nothing. */
export function historyAction(state, page) {
  if (!isAuthPage(page)) return "none"; // the signed-in pages keep the browser's own history
  const here = pageOfEntry(state);
  if (here === page) return "none"; // Back / Forward just landed on this page's entry
  return here === null ? "replace" : "push";
}

/** The page Back / Forward lead to; null while loading or signed in (nothing to switch). */
export function backTarget(page, state) {
  return isAuthPage(page) ? (pageOfEntry(state) ?? "landing") : null;
}
