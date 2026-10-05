// src/api/authAccount.js — Firebase Auth and the users/{uid} profile document: creating,
// signing in (password, magic link, Google), signing out, changing the password and deleting.
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  deleteUser,
  updatePassword,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { doc, setDoc, getDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { profileFromGoogle, profileFromSignup } from "../lib/authProfile.js";

const VERCEL_URL = "https://vaulte-roan.vercel.app";
const actionCodeSettings = { url: VERCEL_URL, handleCodeInApp: true };
const MAGIC_EMAIL_KEY = "vaulte:magicEmail";

export const saveProfile = async (uid, data) => {
  await setDoc(doc(db, "users", uid), data, { merge: true });
};

export const fetchProfile = async (uid) => {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
};

/** Create the account and its profile; returns the profile. */
export async function createAccount(form) {
  const cred = await createUserWithEmailAndPassword(auth, form.email, form.password);
  const profile = profileFromSignup(form, cred.user.uid);
  await saveProfile(cred.user.uid, profile);
  return profile;
}

/** Password sign-in; returns the stored profile (null if none). */
export async function signInWithPassword({ email, password }) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return fetchProfile(cred.user.uid);
}

/** Email a sign-in link and remember the address for when it is opened. */
export async function sendMagicLink(email) {
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  window.localStorage.setItem(MAGIC_EMAIL_KEY, email);
}

/** Whether this page was opened from a sign-in link. */
export const openedFromMagicLink = () => isSignInWithEmailLink(auth, window.location.href);

/** The address the link was sent to, else one the person types in; null if they cancel. */
export const magicLinkEmail = () =>
  window.localStorage.getItem(MAGIC_EMAIL_KEY) ||
  window.prompt("Please enter your email to confirm sign in:");

/** Finish a sign-in link: returns the stored profile (null for a new account). */
export async function completeMagicLink(email) {
  const cred = await signInWithEmailLink(auth, email, window.location.href);
  window.localStorage.removeItem(MAGIC_EMAIL_KEY);
  window.history.replaceState({}, document.title, "/");
  return fetchProfile(cred.user.uid);
}

/** Google sign-in; a first visit gets a profile from the Google account. */
export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  const existing = await fetchProfile(cred.user.uid);
  if (existing) return { profile: existing, created: false };
  const profile = profileFromGoogle(cred.user);
  await saveProfile(cred.user.uid, profile);
  return { profile, created: true };
}

/** The current user's profile whenever Firebase reports who is signed in; null when nobody. */
export const watchSignedIn = (onChange) =>
  onAuthStateChanged(auth, async (user) => onChange(user ? await fetchProfile(user.uid) : null));

export const logOut = () => signOut(auth);

/** Save profile edits (never the password); a new password goes to the account itself. */
export async function updateAccount(profile, edits) {
  if (edits.password && edits.password !== profile.password)
    await updatePassword(auth.currentUser, edits.password);
  const { password: _password, ...safeProfile } = { ...profile, ...edits };
  await saveProfile(auth.currentUser.uid, safeProfile);
  return safeProfile;
}

/** Remove the profile document, then the account. */
export async function deleteAccount() {
  await deleteDoc(doc(db, "users", auth.currentUser.uid));
  await deleteUser(auth.currentUser);
}

export const currentUid = () => auth.currentUser?.uid;
