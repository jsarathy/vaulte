// src/hooks/usePolarBrowse.js — all Polar sessions (loaded on request) and the Browse list.
import { useState } from "react";
import { loadPolarSessions } from "../api/polarSessions";

// A failed load is logged and leaves the last list in place
async function loadInto(userId, setAll, setLoading) {
  setLoading(true);
  try {
    setAll(await loadPolarSessions(userId));
  } catch (e) {
    console.error(e);
  } finally {
    setLoading(false);
  }
}

export function usePolarBrowse(userId) {
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const load = () => loadInto(userId, setAll, setLoading);
  const show = () => {
    setOpen(true);
    setSearch("");
    return load();
  };
  return { all, loading, open, search, setSearch, load, show, close: () => setOpen(false) };
}
