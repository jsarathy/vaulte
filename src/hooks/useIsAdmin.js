// src/hooks/useIsAdmin.js — whether the signed-in person is an admin, from the server (Fix 104,
// shared in Fix 128). False until the server has said so, and for everyone else.
import { useEffect, useState } from "react";
import { checkAdmin } from "../api/adminUsers.js";

/** True once the server says the signed-in user is an admin. */
export function useIsAdmin(userId) {
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    let live = true;
    checkAdmin()
      .then((a) => live && setAdmin(a))
      .catch(() => live && setAdmin(false));
    return () => {
      live = false;
    };
  }, [userId]);
  return admin;
}
