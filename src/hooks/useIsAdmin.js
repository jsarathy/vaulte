// src/hooks/useIsAdmin.js — what the server says about the signed-in person (Fix 104, shared in
// Fix 128; approval added in Fix 134): whether they are an admin, and whether Claude is open to them.
// Admin is false until the server has said so, and for everyone else.
import { useEffect, useState } from "react";
import { checkAccess } from "../api/adminUsers.js";

const UNKNOWN = { admin: false, approved: undefined };

/** How often a person who is waiting for approval is checked again (also when the window gets focus). */
export const WAITING_POLL_MS = 30_000;

/** While `waiting`, asks again every WAITING_POLL_MS and when the window gets focus. */
function useRecheck(waiting, setAccess) {
  useEffect(() => {
    if (!waiting) return;
    let live = true;
    const again = () =>
      checkAccess()
        .then((a) => live && setAccess(a))
        .catch(() => {}); // keep the notice if the question fails
    const timer = setInterval(again, WAITING_POLL_MS);
    window.addEventListener("focus", again);
    return () => {
      live = false;
      clearInterval(timer);
      window.removeEventListener("focus", again);
    };
  }, [waiting, setAccess]);
}

/** { admin, approved }: `approved` is false while the person waits for the owner to let them in; while it
 *  is, the answer is asked again (useRecheck) so the notice goes as soon as they are approved (Fix 136). */
export function useAccess(userId) {
  const [access, setAccess] = useState(UNKNOWN);
  useEffect(() => {
    let live = true;
    checkAccess()
      .then((a) => live && setAccess(a))
      .catch(() => live && setAccess(UNKNOWN));
    return () => {
      live = false;
    };
  }, [userId]);
  useRecheck(access.approved === false, setAccess);
  return access;
}

/** True once the server says the signed-in user is an admin. */
export const useIsAdmin = (userId) => useAccess(userId).admin;
