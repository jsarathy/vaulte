// src/hooks/useAuthHistory.js — keeps the sign-in pages and the browser's history in step
// (Fix 53): a page change writes a history entry, and Back / Forward switch the page.
import { useEffect, useRef } from "react";
import { backTarget, entryFor, historyAction } from "../lib/authHistory.js";

const WRITE = {
  push: (page) => window.history.pushState(entryFor(page), ""),
  replace: (page) => window.history.replaceState(entryFor(page), ""),
};

/** `go(page)` is the page switch that also clears the error shown on the old page. */
export function useAuthHistory(page, go) {
  const latest = useRef({ page, go });
  useEffect(() => {
    latest.current = { page, go };
  });
  useEffect(() => {
    const onPop = (e) => {
      const to = backTarget(latest.current.page, e.state);
      if (to) latest.current.go(to);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const action = historyAction(window.history.state, page);
    if (action !== "none") WRITE[action](page);
  }, [page]);
}
