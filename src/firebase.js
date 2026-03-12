// src/firebase.js
// Replace the placeholder values below with your real Firebase config
// Get them from: Firebase Console → Project Settings → Your Apps → vaulte-web

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:            "PASTE_YOUR_API_KEY_HERE",
  authDomain:        "PASTE_YOUR_AUTH_DOMAIN_HERE",
  projectId:         "PASTE_YOUR_PROJECT_ID_HERE",
  storageBucket:     "PASTE_YOUR_STORAGE_BUCKET_HERE",
  messagingSenderId: "PASTE_YOUR_MESSAGING_SENDER_ID_HERE",
  appId:             "PASTE_YOUR_APP_ID_HERE",
};

const app    = initializeApp(firebaseConfig);
export const auth    = getAuth(app);
export const db      = getFirestore(app);
// If photos show 404, explicitly set your bucket here:
// export const storage = getStorage(app, "vaulte-1ea20.firebasestorage.app");
export const storage = getStorage(app);
