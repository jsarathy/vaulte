// tests/adminUsers.test.mjs — who is an admin, and how a user row is built from Authentication and the
// profile (api/_admin/users.js, Fix 104). No Firebase calls: these are the pure functions.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  adminEmails,
  isAdmin,
  isAdminEmail,
  mergeUsers,
  restUserToAuth,
  userRow,
} from "../api/_admin/users.js";

test("adminEmails: a comma separated list, trimmed and lower-cased; empty or unset gives nobody", () => {
  assert.deepEqual(
    [...adminEmails({ ADMIN_EMAILS: "A@x.com, b@Y.org ,, " })],
    ["a@x.com", "b@y.org"],
  );
  assert.equal(adminEmails({ ADMIN_EMAILS: "" }).size, 0);
  assert.equal(adminEmails({}).size, 0);
  assert.equal(adminEmails({ ADMIN_EMAILS: "  " }).size, 0);
});

test("isAdmin: a verified email in the list, any case; nothing else", () => {
  const env = { ADMIN_EMAILS: "boss@example.com" };
  assert.equal(isAdmin({ email: "boss@example.com", email_verified: true }, env), true);
  assert.equal(isAdmin({ email: "BOSS@Example.com", email_verified: true }, env), true);
  assert.equal(isAdmin({ email: "boss@example.com", email_verified: false }, env), false);
  assert.equal(isAdmin({ email: "boss@example.com" }, env), false);
  assert.equal(isAdmin({ email: "other@example.com", email_verified: true }, env), false);
  assert.equal(isAdmin({ email_verified: true }, env), false);
  assert.equal(isAdmin({ email: 5, email_verified: true }, env), false);
  assert.equal(isAdmin(null, env), false);
  assert.equal(isAdmin(undefined, env), false);
  assert.equal(isAdmin({ email: "boss@example.com", email_verified: true }, {}), false); // not configured
});

const AUTH = {
  uid: "u1",
  email: "jane@example.com",
  displayName: "Jane From Google",
  disabled: false,
  metadata: {
    creationTime: "Thu, 01 Oct 2026 08:05:00 GMT",
    lastSignInTime: "Sun, 11 Oct 2026 14:32:00 GMT",
  },
  providerData: [{ providerId: "google.com" }, { providerId: "password" }],
};
const PROFILE = {
  firstName: "Jane",
  lastName: "Smith",
  email: "profile@example.com",
  phone: "+44 7700 000000",
  address: "1 High St",
  city: "London",
  postcode: "SW1A 1AA",
  uid: "USR-ABC123",
};

test("userRow: Authentication's email and dates, the profile's name, phone, address and member id", () => {
  assert.deepEqual(userRow("u1", AUTH, PROFILE), {
    uid: "u1",
    member_id: "USR-ABC123",
    name: "Jane Smith",
    email: "jane@example.com",
    phone: "+44 7700 000000",
    address: "1 High St, London, SW1A 1AA",
    created: "2026-10-01T08:05:00.000Z",
    last_sign_in: "2026-10-11T14:32:00.000Z",
    providers: ["google.com", "password"],
    disabled: false,
  });
});

test("userRow: a user with no profile, a profile with no sign-in record, and gaps", () => {
  const noProfile = userRow("u1", AUTH, undefined);
  assert.equal(noProfile.name, "Jane From Google"); // the display name stands in
  assert.deepEqual([noProfile.member_id, noProfile.phone, noProfile.address], ["", "", ""]);
  const noAuth = userRow("u2", undefined, PROFILE);
  assert.equal(noAuth.email, "profile@example.com");
  assert.deepEqual(
    [noAuth.created, noAuth.last_sign_in, noAuth.providers, noAuth.disabled],
    [null, null, [], false],
  );
  const bare = userRow("u3", { uid: "u3", metadata: { creationTime: "garbage" } }, {});
  assert.deepEqual([bare.name, bare.email, bare.created, bare.last_sign_in], ["", "", null, null]);
  assert.equal(userRow("u4", { uid: "u4", disabled: true }, {}).disabled, true);
  assert.equal(userRow("u5", { uid: "u5", disabled: "yes" }, {}).disabled, false); // only true counts
  assert.equal(userRow("u6", AUTH, { lastName: "Smith" }).name, "Smith"); // a part of the name
  assert.equal(userRow("u7", { uid: "u7", email: "a@b.c" }, { city: "Leeds" }).address, "Leeds");
});

test("userRow: with neither a profile name nor a sign-in record, no error and no name; no email anywhere is blank", () => {
  assert.equal(userRow("u8", undefined, {}).name, "");
  assert.equal(userRow("u9", { uid: "u9" }, undefined).email, "");
  assert.equal(userRow("u9", undefined, undefined).email, "");
});

test("mergeUsers: everyone from either source once, the oldest account first", () => {
  const a = (uid, email, created) => ({
    uid,
    email,
    metadata: { creationTime: created },
    providerData: [],
  });
  const users = mergeUsers(
    [
      a("late", "z@x.com", "Fri, 09 Oct 2026 08:00:00 GMT"),
      a("early", "b@x.com", "Thu, 01 Oct 2026 08:00:00 GMT"),
      a("tie1", "d@x.com", "Fri, 02 Oct 2026 08:00:00 GMT"),
      a("tie2", "c@x.com", "Fri, 02 Oct 2026 08:00:00 GMT"),
    ],
    { early: { firstName: "E" }, orphan: { firstName: "O", email: "o@x.com" } },
  );
  assert.deepEqual(
    users.map((u) => u.uid),
    ["early", "tie2", "tie1", "late", "orphan"], // no creation date sorts last; same date by email
  );
  assert.equal(users[0].name, "E");
  assert.equal(users.at(-1).name, "O");
  // a user with no creation date, listed first, still goes after one that has a date
  const undated = { uid: "undated", email: "a@x.com", metadata: {}, providerData: [] };
  const dated = a("dated", "z@x.com", "Fri, 09 Oct 2026 08:00:00 GMT");
  assert.deepEqual(
    mergeUsers([undated, dated], {}).map((u) => u.uid),
    ["dated", "undated"],
  );
  assert.deepEqual(
    mergeUsers([dated, undated], {}).map((u) => u.uid),
    ["dated", "undated"],
  );
  assert.deepEqual(mergeUsers([], {}), []);
});

test("restUserToAuth: an Identity Toolkit user as the shape userRow reads (times from milliseconds)", () => {
  const ms = String(Date.parse("2026-10-01T08:05:00Z"));
  assert.deepEqual(
    restUserToAuth({
      localId: "u1",
      email: "jane@example.com",
      displayName: "Jane",
      disabled: true,
      createdAt: ms,
      lastLoginAt: String(Date.parse("2026-10-11T14:32:00Z")),
      providerUserInfo: [{ providerId: "google.com", rawId: "1" }, { providerId: "password" }],
    }),
    {
      uid: "u1",
      email: "jane@example.com",
      displayName: "Jane",
      disabled: true,
      metadata: {
        creationTime: "2026-10-01T08:05:00.000Z",
        lastSignInTime: "2026-10-11T14:32:00.000Z",
      },
      providerData: [{ providerId: "google.com" }, { providerId: "password" }],
    },
  );
  const bare = restUserToAuth({ localId: "u2" });
  assert.deepEqual(bare.metadata, { creationTime: undefined, lastSignInTime: undefined });
  assert.deepEqual(bare.providerData, []);
  assert.equal(bare.disabled, false);
  assert.equal(restUserToAuth({ localId: "u3", disabled: "yes" }).disabled, false); // only true counts
  assert.equal(
    restUserToAuth({ localId: "u4", createdAt: "garbage" }).metadata.creationTime,
    undefined,
  );
  // and it goes straight into a row
  const row = userRow(
    "u1",
    restUserToAuth({ localId: "u1", email: "a@b.c", createdAt: ms }),
    undefined,
  );
  assert.equal(row.created, "2026-10-01T08:05:00.000Z");
  assert.equal(row.email, "a@b.c");
});

test("isAdminEmail: an address in ADMIN_EMAILS, any case, whoever holds it; nothing else", () => {
  const env = { ADMIN_EMAILS: "Boss@Example.com, second@example.com" };
  assert.equal(isAdminEmail("boss@example.com", env), true);
  assert.equal(isAdminEmail("BOSS@EXAMPLE.COM", env), true);
  assert.equal(isAdminEmail("second@example.com", env), true);
  assert.equal(isAdminEmail("jane@example.com", env), false);
  for (const none of [undefined, null, "", 0]) assert.equal(isAdminEmail(none, env), false);
  assert.equal(isAdminEmail("boss@example.com", {}), false); // no list: nobody
  assert.equal(isAdminEmail("boss@example.com", { ADMIN_EMAILS: "" }), false);
});
