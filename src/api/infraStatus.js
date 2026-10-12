// src/api/infraStatus.js — asks /api/infra-status for the INFRASTRUCTURE box (Dashboard, Fix 99).
// The signed-in user's Firebase ID token goes with the request.
import { auth } from "../firebase";

export async function loadInfraStatus() {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");
  const res = await fetch("/api/infra-status", { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
