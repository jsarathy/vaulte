// src/hooks/useIsPhone.js — true while the window is phone-sized (Fix 43.4). The same 768 px the
// sign-in / account pages already use in CSS (authStyles.js); inline styles can't use @media,
// so components ask this and choose their phone or desktop styles.
import { useEffect, useState } from "react";

export const PHONE_QUERY = "(max-width: 768px)";

const matches = () => typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches;

export function useIsPhone() {
  const [phone, setPhone] = useState(matches);
  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return phone;
}
