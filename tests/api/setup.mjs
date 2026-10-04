// tests/api/setup.mjs — shared helpers for API endpoint tests (Fix 12, part B).
// Run via `npm run test:api`, which starts the Firestore emulator for project
// "demo-vaulte" (demo- projects never touch a real Firebase project) and sets
// FIRESTORE_EMULATOR_HOST, so firebase-admin talks to the emulator only.
import { generateKeyPairSync } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";

export const PROJECT = "demo-vaulte";
if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("FIRESTORE_EMULATOR_HOST not set — run these with `npm run test:api`");

// The handlers build credentials from FIREBASE_SERVICE_ACCOUNT. A throwaway key
// is enough: with the emulator host set, nothing is ever signed or sent.
const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
process.env.FIREBASE_SERVICE_ACCOUNT = JSON.stringify({ type: "service_account", project_id: PROJECT, private_key: privateKey, client_email: `test@${PROJECT}.iam.gserviceaccount.com` });
process.env.GCLOUD_PROJECT = PROJECT;

export const db = () => getFirestore();

// Fake Vercel response object: records status and JSON body.
export function res() {
  const r = { statusCode: 200, body: undefined };
  r.status = c => { r.statusCode = c; return r; };
  r.json = b => { r.body = b; return r; };
  return r;
}

// Wipe all emulator data between tests.
export async function clearFirestore() {
  const url = `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/databases/(default)/documents`;
  const r = await fetch(url, { method: "DELETE" });
  if (!r.ok) throw new Error(`emulator clear failed: ${r.status}`);
}

export const read = async path => (await db().doc(path).get()).data();
