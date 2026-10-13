// tests/userTable.test.mjs — the Users table (src/lib/userTable.js, Fix 104): its columns, how a user
// fills a row, and the search.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  USER_COLUMNS,
  canDelete,
  deleteConfirmText,
  filterUsers,
  providersText,
  userCells,
  usersCount,
} from "../src/lib/userTable.js";

const JANE = {
  uid: "FbUid123abc",
  member_id: "USR-ABC123",
  name: "Jane Smith",
  email: "jane@example.com",
  phone: "+44 7700 000000",
  address: "1 High St, London, SW1A 1AA",
  created: "2026-10-01T08:05:00.000Z",
  last_sign_in: "2026-10-11T14:32:00.000Z",
  providers: ["google.com", "password"],
  disabled: false,
};
const BOB = {
  uid: "FbUid999xyz",
  member_id: "",
  name: "",
  email: "bob@test.org",
  phone: "",
  address: "",
  created: null,
  last_sign_in: null,
  providers: ["phone", "apple.com"],
  disabled: true,
};

test("the columns", () => {
  assert.deepEqual(USER_COLUMNS, [
    "Name",
    "Email",
    "Phone",
    "Member since",
    "Last sign-in",
    "Sign-in",
    "Member ID",
    "User ID",
  ]);
});

test("providersText: sign-in methods named for people; unknown ones as they are", () => {
  assert.equal(providersText(["google.com"]), "Google");
  assert.equal(providersText(["google.com", "password"]), "Google, Email and password");
  assert.equal(providersText(["phone"]), "Phone");
  assert.equal(providersText(["apple.com"]), "apple.com");
  assert.equal(providersText([]), "");
  assert.equal(providersText(undefined), "");
});

test("userCells: a row in column order, dates as dd-MMM-yyyy hh:mm, a disabled user marked", () => {
  process.env.TZ = "UTC";
  assert.deepEqual(userCells(JANE), [
    "Jane Smith",
    "jane@example.com",
    "+44 7700 000000",
    "01-Oct-2026 08:05",
    "11-Oct-2026 14:32",
    "Google, Email and password",
    "USR-ABC123",
    "FbUid123abc",
  ]);
  assert.deepEqual(userCells(BOB), [
    "",
    "bob@test.org",
    "",
    "",
    "",
    "Phone, apple.com (disabled)",
    "",
    "FbUid999xyz",
  ]);
  assert.equal(userCells(JANE).length, USER_COLUMNS.length);
  assert.deepEqual(userCells({}), ["", "", "", "", "", "", "", ""]);
});

test("filterUsers: every word must be somewhere in the row, in any case", () => {
  process.env.TZ = "UTC";
  const all = [JANE, BOB];
  const ids = (list) => list.map((u) => u.uid);
  assert.equal(filterUsers(all, ""), all);
  assert.equal(filterUsers(all, "   "), all);
  assert.equal(filterUsers(all, undefined), all);
  assert.deepEqual(ids(filterUsers(all, "JANE")), ["FbUid123abc"]); // name, in any case
  assert.deepEqual(ids(filterUsers(all, "test.org")), ["FbUid999xyz"]); // email
  assert.deepEqual(ids(filterUsers(all, "7700")), ["FbUid123abc"]); // phone
  assert.deepEqual(ids(filterUsers(all, "usr-abc")), ["FbUid123abc"]); // member id
  assert.deepEqual(ids(filterUsers(all, "xyz")), ["FbUid999xyz"]); // user id
  assert.deepEqual(ids(filterUsers(all, "london")), ["FbUid123abc"]); // address, not a column
  assert.deepEqual(ids(filterUsers(all, "oct-2026")), ["FbUid123abc"]); // a date as shown
  assert.deepEqual(ids(filterUsers(all, "google")), ["FbUid123abc"]); // sign-in method
  assert.deepEqual(ids(filterUsers(all, "disabled")), ["FbUid999xyz"]);
  assert.deepEqual(ids(filterUsers(all, "jane smith")), ["FbUid123abc"]);
  assert.deepEqual(ids(filterUsers(all, "  jane   example ")), ["FbUid123abc"]);
  assert.deepEqual(filterUsers(all, "jane bob"), []); // both words must match one row
  assert.deepEqual(filterUsers(all, "smithjane"), []); // a word cannot run across two cells
  assert.deepEqual(filterUsers([], "x"), []);
});

test("usersCount: singular and plural", () => {
  assert.equal(usersCount(0), "0 users");
  assert.equal(usersCount(1), "1 user");
  assert.equal(usersCount(2), "2 users");
});

test("canDelete: not an admin, and not the person looking", () => {
  assert.equal(canDelete({ uid: "u1" }, "me"), true);
  assert.equal(canDelete({ uid: "u1", admin: false }, "me"), true);
  assert.equal(canDelete({ uid: "u1", admin: true }, "me"), false);
  assert.equal(canDelete({ uid: "me" }, "me"), false);
  assert.equal(canDelete({ uid: "u1" }, undefined), true); // nobody signed in: the check is the server's
});

test("deleteConfirmText: names the user and says what goes and that it cannot be undone", () => {
  const text = deleteConfirmText({ uid: "u1", email: "bob@test.org", name: "Bob" });
  assert.match(text, /^Delete bob@test\.org\?/);
  assert.match(text, /login, their profile photo and everything they saved/);
  assert.match(text, /food log, weights, recipes, chat, Polar and Renpho data/);
  assert.match(text, /It cannot be undone\.$/);
  assert.match(deleteConfirmText({ uid: "u1", name: "Bob" }), /^Delete Bob\?/); // no email: the name
  assert.match(deleteConfirmText({ uid: "u1" }), /^Delete u1\?/); // neither: the id
});

test("filterUsers: a user with no address matches only what is really in the row", () => {
  const users = [{ uid: "u1", name: "Jane", email: "jane@example.com" }];
  assert.deepEqual(filterUsers(users, "stryker was here"), []);
  assert.deepEqual(filterUsers(users, "was here"), []);
  assert.deepEqual(filterUsers(users, "jane   example"), users); // extra spaces between words are fine
});
