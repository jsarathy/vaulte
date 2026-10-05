// src/api/profilePhoto.js — the profile photo in Firebase Storage (profile-photos/{uid}.jpg)
// and its URL on the users/{uid} profile.
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { storage } from "../firebase";
import { saveProfile } from "./authAccount.js";

const photoRef = (uid) => ref(storage, "profile-photos/" + uid + ".jpg");

/** Store the file and point the profile at it; returns the updated profile. */
export async function uploadProfilePhoto(uid, profile, file) {
  const storageRef = photoRef(uid);
  await uploadBytes(storageRef, file);
  const updated = { ...profile, photoURL: await getDownloadURL(storageRef) };
  await saveProfile(uid, updated);
  return updated;
}

/** Drop the file (if it is still there) and the profile's photoURL; returns the profile. */
export async function removeProfilePhoto(uid, profile) {
  await deleteObject(photoRef(uid)).catch(() => {});
  const updated = { ...profile };
  delete updated.photoURL;
  await saveProfile(uid, updated);
  return updated;
}
