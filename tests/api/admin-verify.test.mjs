// tests/api/admin-verify.test.mjs — checking a Firebase ID token with jose (api/_admin/verify.js,
// Fix 105): the signature, the issuer, the audience, the expiry. Real RS256 keys made here and a
// local key set stand in for Google's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { projectId, verifyIdToken } from "../../api/_admin/verify.js";

const PROJECT = "vaulte-test";
const { privateKey, publicKey } = await generateKeyPair("RS256");
const other = await generateKeyPair("RS256");
const jwk = { ...(await exportJWK(publicKey)), kid: "k1", alg: "RS256", use: "sig" };
const keys = createLocalJWKSet({ keys: [jwk] });

const sign = ({
  key = privateKey,
  iss,
  aud,
  sub = "user-1",
  exp = "1h",
  extra = {},
  alg = "RS256",
} = {}) =>
  new SignJWT({ email: "boss@example.com", email_verified: true, ...extra })
    .setProtectedHeader({ alg, kid: "k1" })
    .setIssuer(iss ?? `https://securetoken.google.com/${PROJECT}`)
    .setAudience(aud ?? PROJECT)
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key);

const verify = (token) => verifyIdToken(token, { keys, project: PROJECT });

test("a good token gives its claims, with the uid", async () => {
  const claims = await verify(await sign());
  assert.equal(claims.uid, "user-1");
  assert.equal(claims.sub, "user-1");
  assert.equal(claims.email, "boss@example.com");
  assert.equal(claims.email_verified, true);
});

test("a token for another project, or from another issuer, is refused", async () => {
  await assert.rejects(verify(await sign({ aud: "someone-else" })));
  await assert.rejects(verify(await sign({ iss: "https://securetoken.google.com/someone-else" })));
  await assert.rejects(verify(await sign({ iss: "https://evil.example.com" })));
});

test("an expired token, a token signed with another key, and garbage are refused", async () => {
  await assert.rejects(verify(await sign({ exp: Math.floor(Date.now() / 1000) - 3600 })));
  await assert.rejects(verify(await sign({ key: other.privateKey })));
  await assert.rejects(verify("not.a.token"));
  await assert.rejects(verify(""));
  const good = await sign();
  await assert.rejects(verify(good.slice(0, -4) + "AAAA")); // tampered signature
});

test("a token with no subject, or signed with a different algorithm, is refused", async () => {
  await assert.rejects(verify(await sign({ sub: "" })));
  const hmac = await new SignJWT({ email: "boss@example.com" })
    .setProtectedHeader({ alg: "HS256", kid: "k1" })
    .setIssuer(`https://securetoken.google.com/${PROJECT}`)
    .setAudience(PROJECT)
    .setSubject("user-1")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode("a-shared-secret-of-sufficient-length-32"));
  await assert.rejects(verify(hmac));
});

test("projectId: from the service account, else Vaulte's own; a broken value falls back too", () => {
  assert.equal(
    projectId({ FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ project_id: "mine" }) }),
    "mine",
  );
  assert.equal(projectId({ FIREBASE_SERVICE_ACCOUNT: "{}" }), "vaulte-1ea20");
  assert.equal(projectId({}), "vaulte-1ea20");
  assert.equal(projectId({ FIREBASE_SERVICE_ACCOUNT: "not json" }), "vaulte-1ea20");
});
