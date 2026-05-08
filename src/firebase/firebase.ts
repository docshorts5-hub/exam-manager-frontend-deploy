// src/firebase/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyCZhk4MBHz5dCIe1AfPMz2SHtV84GMC6J4",
  authDomain: "exam-manager-frontend.firebaseapp.com",
  projectId: "exam-manager-frontend",
  storageBucket: "exam-manager-frontend.firebasestorage.app",
  messagingSenderId: "259733397203",
  appId: "1:259733397203:web:bc62407b5ff9a1c5213e26",
  measurementId: "G-FYG4ZJZBR2",
};

// HMR-safe initialization: prevents duplicate Firebase app errors in development.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);

// Firestore
// Use memoryLocalCache to avoid corrupted IndexedDB/local persistence states in development
// and to prevent Firestore INTERNAL ASSERTION FAILED errors caused by a stale browser cache.
let firestoreDb: Firestore;

try {
  firestoreDb = initializeFirestore(app, {
    localCache: memoryLocalCache(),
  });
} catch {
  // If Firestore was already initialized during Vite HMR, reuse the existing instance.
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;

// Functions
export const functions = getFunctions(app, "us-central1");

// ============================
// App Check
// ============================
// Put reCAPTCHA v3 site key in .env if App Check is needed:
//   VITE_APP_CHECK_SITE_KEY=...
//
// Local development options:
//   VITE_DISABLE_APPCHECK=true
//   VITE_APP_CHECK_DEBUG=true

const appCheckKey = (import.meta as any).env?.VITE_APP_CHECK_SITE_KEY as string | undefined;

const disableAppCheck =
  String((import.meta as any).env?.VITE_DISABLE_APPCHECK || "").toLowerCase() === "true";

const appCheckDebug =
  String((import.meta as any).env?.VITE_APP_CHECK_DEBUG || "").toLowerCase() === "true" ||
  Boolean((import.meta as any).env?.DEV);

try {
  if (!disableAppCheck && appCheckKey && typeof window !== "undefined") {
    const alreadyInitialized = Boolean((window as any).__EXAM_MANAGER_APPCHECK_INITIALIZED__);

    if (!alreadyInitialized) {
      if (appCheckDebug) {
        // Firebase App Check debug token for local development.
        // Add the generated token in Firebase Console -> App Check -> Manage debug tokens.
        // @ts-ignore
        self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
      }

      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckKey),
        isTokenAutoRefreshEnabled: true,
      });

      (window as any).__EXAM_MANAGER_APPCHECK_INITIALIZED__ = true;
    }
  }
} catch {
  // Do not break the application if App Check initialization fails.
}
