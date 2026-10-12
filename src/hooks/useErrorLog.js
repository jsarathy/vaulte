// src/hooks/useErrorLog.js — records the signed-in user's app errors (Fix 98 part 2): uncaught errors,
// unhandled promise rejections, and the app's own console.error calls. Each goes to
// users/{uid}/app_errors; a failed write is dropped quietly (it must never cause another error).
import { useEffect } from "react";
import { saveError } from "../api/errorLog.js";
import { entryFor, isIgnored, makeLimiter, messageOf } from "../lib/errorLog.js";

export function useErrorLog(userId) {
  useEffect(() => {
    if (!userId) return undefined;
    const allowed = makeLimiter();
    let writing = false; // an error raised while writing is not logged again
    const record = (source, args) => {
      const message = messageOf(args);
      if (writing || isIgnored(message) || !allowed(message)) return;
      writing = true;
      try {
        saveError(userId, entryFor(source, args, window.location.pathname)).catch(() => {});
      } catch {
        // the logger never throws into the app
      } finally {
        writing = false;
      }
    };
    const onError = (e) => record("error", [e.error || e.message]);
    const onRejection = (e) => record("promise", [e.reason]);
    const original = console.error;
    console.error = (...args) => {
      original.apply(console, args);
      record("console", args);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      console.error = original;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [userId]);
}
