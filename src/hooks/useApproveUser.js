// src/hooks/useApproveUser.js — letting a waiting person use Claude from the Users table (Fix 134):
// calls the server, marks the row approved, and says what happened. `setState` is the table's state.
import { useState } from "react";
import { approveUser } from "../api/adminUsers.js";

/** { busy, note, onApprove(user) }; `note` is the result in words ("" before anything is done). */
export function useApproveUser(setState) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const onApprove = async (user) => {
    setBusy(true);
    setNote("");
    try {
      await approveUser(user.uid);
      setState((s) => ({
        ...s,
        users: s.users.map((x) => (x.uid === user.uid ? { ...x, approval: "approved" } : x)),
      }));
      setNote(`Approved ${user.email || user.uid}.`);
    } catch (err) {
      setNote(`Could not approve: ${err.message}`);
    }
    setBusy(false);
  };
  return { busy, note, onApprove };
}
