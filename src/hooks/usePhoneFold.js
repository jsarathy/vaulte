// src/hooks/usePhoneFold.js — a card that folds shut on a phone (closed to begin with) and is
// always open on a desktop.
import { useState } from "react";
import { useIsPhone } from "./useIsPhone.js";

export function usePhoneFold() {
  const phone = useIsPhone();
  const [opened, setOpened] = useState(false);
  return { phone, open: !phone || opened, toggle: () => setOpened((o) => !o) };
}
