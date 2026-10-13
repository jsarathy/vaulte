// src/firebase.js
// Replace the placeholder values below with your real Firebase config
// Get them from: Firebase Console → Project Settings → Your Apps → vaulte-web

import { initializeApp } from "firebase/app";
import { getAuth, sendEmailVerification } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { setAuthTools, setTokenSource } from "./api/authToken.js";

const firebaseConfig = {
  apiKey: "AIzaSyC_L5NoFXe-WVZdy9NBqkb4YI8vmLQxe2M",
  authDomain: "vaulte-1ea20.firebaseapp.com",
  projectId: "vaulte-1ea20",
  storageBucket: "vaulte-1ea20.firebasestorage.app",
  messagingSenderId: "597290506759",
  appId: "1:597290506759:web:a5165ff8a43627f52be8a2",
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setTokenSource(() => auth.currentUser?.getIdToken()); // the sign-in proof for server functions
setAuthTools({
  // the person's latest details (is the email confirmed now?) and a token that says so
  refresh: async () => {
    await auth.currentUser?.reload();
    await auth.currentUser?.getIdToken(true);
  },
  resend: () => sendEmailVerification(auth.currentUser, { url: "https://vaulte-roan.vercel.app" }),
});
export const db = getFirestore(app);
// If photos show 404, explicitly set your bucket here:
// export const storage = getStorage(app, "vaulte-1ea20.firebasestorage.app");
export const storage = getStorage(app);
