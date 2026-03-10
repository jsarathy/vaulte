# Vaulte — Firebase Edition

A full-stack account management app with real cloud authentication and database storage via Firebase.

---

## Step 1 — Set Up Firebase (takes ~10 minutes)

### 1.1 Create a Firebase Project
1. Go to https://console.firebase.google.com
2. Click **"Add project"**
3. Name it `vaulte` → click Continue
4. Disable Google Analytics (not needed) → click **Create project**

### 1.2 Enable Email/Password Authentication
1. In the left sidebar click **"Build"** → **"Authentication"**
2. Click **"Get started"**
3. Click **"Email/Password"**
4. Toggle **Enable** on → click **Save**

### 1.3 Create a Firestore Database
1. In the left sidebar click **"Build"** → **"Firestore Database"**
2. Click **"Create database"**
3. Choose **"Start in test mode"** → click Next
4. Choose a location close to you → click **Enable**

### 1.4 Get Your Firebase Config
1. Click the **gear icon** (top left) → **Project settings**
2. Scroll down to **"Your apps"** → click the **</>** (Web) icon
3. Name the app `vaulte-web` → click **Register app**
4. You'll see a `firebaseConfig` object — copy all the values

---

## Step 2 — Add Your Firebase Config

Open `src/firebase.js` and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey:            "your-actual-api-key",
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123",
};
```

---

## Step 3 — Run Locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

---

## Step 4 — Deploy to Vercel

1. Push this folder to GitHub
2. Go to https://vercel.com → **Add New Project** → import your repo
3. Click **Deploy**
4. You'll get a live URL instantly ✓

---

## What's stored where?

| Data | Location |
|------|----------|
| Email & Password | Firebase Authentication |
| Name, Phone, Address etc. | Firebase Firestore (cloud database) |
| Session (stay logged in) | Browser (auto-managed by Firebase) |

Accounts now work from **any device, any browser** — your data lives in the cloud.
