// src/hooks/useAccountPage.js — the signed-in page's state: the open panel, Edit Profile, the
// profile photo and Delete Account.
import { useState } from "react";
import { currentUid, deleteAccount, updateAccount } from "../api/authAccount.js";
import { removeProfilePhoto, uploadProfilePhoto } from "../api/profilePhoto.js";

/** Save the edits (updateAccount) with the busy state and the error on the overlay. */
function useSaveEdit({ profile, setProfile, setError, showToast }, editData, setEditing) {
  const [savingEdit, setSavingEdit] = useState(false);
  const handleSaveEdit = async () => {
    setSavingEdit(true);
    try {
      setProfile(await updateAccount(profile, editData));
      showToast("PROFILE UPDATED");
      setEditing(false);
    } catch (e) {
      setError(e.message);
    }
    setSavingEdit(false);
  };
  return { savingEdit, handleSaveEdit };
}

/** The Edit Profile overlay: a copy of the profile to edit. */
function useProfileEdit(session) {
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const { savingEdit, handleSaveEdit } = useSaveEdit(session, editData, setEditing);
  const openEdit = () => {
    setEditData({ ...session.profile });
    setEditing(true);
  };
  const actions = { handleSaveEdit, close: () => setEditing(false) };
  return { edit: { editing, editData, setEditData, savingEdit, actions }, openEdit };
}

/** Upload the chosen file as the profile photo; failures are shown in an alert. */
async function changePhoto(file, { profile, setProfile, showToast }) {
  try {
    const uid = currentUid();
    if (!uid) return alert("Not logged in");
    showToast("UPLOADING...");
    setProfile(await uploadProfilePhoto(uid, profile, file));
    showToast("PHOTO UPDATED");
  } catch (err) {
    console.error("Photo upload error:", err);
    alert("Could not upload photo: " + err.message);
  }
}

/** Uploading and removing the profile photo. */
function usePhoto(session) {
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) return changePhoto(file, session);
  };
  const handleRemovePhoto = async () => {
    try {
      session.setProfile(await removeProfilePhoto(currentUid(), session.profile));
      session.showToast("PHOTO REMOVED");
    } catch (err) {
      console.error(err);
    }
  };
  return { handlePhotoChange, handleRemovePhoto };
}

/** Delete Account: confirm, then the profile document and the account go. */
const deleteAccountFor = (session) => async () => {
  if (!window.confirm("Are you sure? This cannot be undone.")) return;
  try {
    await deleteAccount();
    session.setProfile(null);
    session.go("landing");
  } catch (e) {
    alert("Error deleting account: " + e.message);
  }
};

/** Everything AccountPage needs; `session` is the profile / error / toast / go from useAuthPages. */
export function useAccountPage(session) {
  const [activePanel, setActivePanel] = useState("home");
  const { edit, openEdit } = useProfileEdit(session);
  const photo = usePhoto(session);
  const page = {
    handleLogout: session.handleLogout,
    handleDeleteAccount: deleteAccountFor(session),
    account: { photo, openEdit },
  };
  return { nav: { activePanel, setActivePanel }, edit: { ...edit, error: session.error }, page };
}
