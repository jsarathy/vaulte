// src/hooks/useIsAdmin.js — what the server says about the signed-in person (Fix 104, shared in
// Fix 128; approval added in Fix 134): whether they are an admin, and whether Claude is open to them.
// Admin is false until the server has said so, and for everyone else.
import { useEffect, useState } from "react";
import { checkAccess } from "../api/adminUsers.js";

const UNKNOWN = { admin: false, approved: undefined };

/** { admin, approved }: `approved` is false while the person waits for the owner to let them in. */
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
  return access;
}

/** True once the server says the signed-in user is an admin. */
export const useIsAdmin = (userId) => useAccess(userId).admin;
