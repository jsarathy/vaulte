// src/lib/authProfile.js — the account profile stored at users/{uid}, built from a sign-up form
// or a Google account, and the checks and messages of the sign-in pages.

export const generateUID = () => "USR-" + Math.random().toString(36).substr(2, 9).toUpperCase();

/** Today as "4 October 2026" — the "Member since" date. */
export const memberSince = () =>
  new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const EMPTY_CONTACT = { phone: "", address: "", city: "", postcode: "" };

/** The profile for a new account from the Create Account form (the password is never stored). */
export function profileFromSignup(form, firebaseUid) {
  const { firstName, lastName, email, phone, address, city, postcode } = form;
  return {
    firstName,
    lastName,
    email,
    phone,
    address,
    city,
    postcode,
    uid: generateUID(),
    firebaseUid,
    createdAt: memberSince(),
  };
}

/** The profile for a new account from a Google sign-in: first word → first name, the rest → last. */
export function profileFromGoogle(user) {
  const words = user.displayName?.split(" ");
  return {
    firstName: words?.[0] || "",
    lastName: words?.slice(1).join(" ") || "",
    email: user.email,
    ...EMPTY_CONTACT,
    photoURL: user.photoURL || "",
    uid: generateUID(),
    firebaseUid: user.uid,
    createdAt: memberSince(),
  };
}

/** Why the Create Account form cannot be sent; null when it can. */
export function signupProblem({ firstName, lastName, email, password }) {
  if (!firstName || !lastName || !email || !password) return "Please fill in all required fields.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

/** The message for a failed sign-up. */
export const signupErrorMessage = (e) =>
  e.code === "auth/email-already-in-use" ? "An account with this email already exists." : e.message;

/** The message for a failed password sign-in. */
export const signInErrorMessage = (e) =>
  e.code === "auth/invalid-credential" ? "Invalid email or password." : e.message;

/** A closed Google popup is not an error worth showing. */
export const popupErrorMessage = (e) => (e.code === "auth/popup-closed-by-user" ? "" : e.message);

export const EMPTY_SIGNUP = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  ...EMPTY_CONTACT,
};
export const EMPTY_LOGIN = { email: "", password: "" };
