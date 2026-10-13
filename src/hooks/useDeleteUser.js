// src/hooks/useDeleteUser.js — deleting a user from the Users table (Fix 127): asks first, calls the
// server, takes the row out of the table, and says what happened. `setState` is the table's state.
import { useState } from "react";
import { deleteUser } from "../api/adminUsers.js";
import { deleteConfirmText } from "../lib/userTable.js";

/** { busy, note, onDelete(user) }; `note` is the result in words ("" before anything is done). */
export function useDeleteUser(setState) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const onDelete = async (user) => {
    if (!window.confirm(deleteConfirmText(user))) return;
    setBusy(true);
    setNote("");
    try {
      await deleteUser(user.uid);
      setState((s) => ({ ...s, users: s.users.filter((x) => x.uid !== user.uid) }));
      setNote(`Deleted ${user.email || user.uid}.`);
    } catch (err) {
      setNote(`Could not delete: ${err.message}`);
    }
    setBusy(false);
  };
  return { busy, note, onDelete };
}
