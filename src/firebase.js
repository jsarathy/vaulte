// src/firebase.js
// ─────────────────────────────────────────────────────────────
// STEP 1: Go to https://console.firebase.google.com
// STEP 2: Create a project → Add a Web App
// STEP 3: Copy your firebaseConfig values below
// ─────────────────────────────────────────────────────────────

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC_L5NoFXe-WVZdy9NBqkb4YI8vmLQxe2M",
  authDomain: "vaulte-1ea20.firebaseapp.com",
  projectId: "vaulte-1ea20",
  storageBucket: "vaulte-1ea20.firebasestorage.app",
  messagingSenderId: "597290506759",
  appId: "1:597290506759:web:a5165ff8a43627f52be8a2"
};

const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
