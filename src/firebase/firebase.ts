// src/firebase/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Firebase project configuration
function yrFirebaseConfigValue(name: string, fallback: string) {
  const value =
    String((import.meta as any).env?.[name] ?? "").trim();

  return value || fallback;
}

const firebaseConfig = {
  apiKey: yrFirebaseConfigValue(
    "VITE_FIREBASE_API_KEY",
    "AIzaSyCZhk4MBHz5dCIe1AfPMz2SHtV84GMC6J4"
  ),
  authDomain: yrFirebaseConfigValue(
    "VITE_FIREBASE_AUTH_DOMAIN",
    "exam-manager-frontend.firebaseapp.com"
  ),
  projectId: yrFirebaseConfigValue(
    "VITE_FIREBASE_PROJECT_ID",
    "exam-manager-frontend"
  ),
  storageBucket: yrFirebaseConfigValue(
    "VITE_FIREBASE_STORAGE_BUCKET",
    "exam-manager-frontend.firebasestorage.app"
  ),
  messagingSenderId: yrFirebaseConfigValue(
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "259733397203"
  ),
  appId: yrFirebaseConfigValue(
    "VITE_FIREBASE_APP_ID",
    "1:259733397203:web:bc62407b5ff9a1c5213e26"
  ),
  measurementId: yrFirebaseConfigValue(
    "VITE_FIREBASE_MEASUREMENT_ID",
    "G-FYG4ZJZBR2"
  ),
};

function yrEnvBoolean(name: string) {
  return (
    String((import.meta as any).env?.[name] ?? "")
      .trim()
      .toLowerCase() === "true"
  );
}

function yrEnvText(name: string, fallback: string) {
  const value =
    String((import.meta as any).env?.[name] ?? "").trim();

  return value || fallback;
}

function yrEnvPort(name: string, fallback: number) {
  const value = Number(
    (import.meta as any).env?.[name] ?? fallback
  );

  return Number.isInteger(value) && value > 0
    ? value
    : fallback;
}

function yrLocalEmulatorRuntimeAllowed() {
  if (!Boolean((import.meta as any).env?.DEV)) return false;
  if (typeof window === "undefined") return false;

  return [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
  ].includes(window.location.hostname);
}

const yrLocalEmulatorRuntime =
  yrLocalEmulatorRuntimeAllowed();

const yrEmulatorConnectionState =
  globalThis as typeof globalThis & {
    __YR_AUTH_EMULATOR_CONNECTED__?: boolean;
    __YR_FIRESTORE_EMULATOR_CONNECTED__?: boolean;
  };

// HMR-safe initialization: prevents duplicate Firebase app errors in development.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Auth
export const auth = getAuth(app);

if (
  yrLocalEmulatorRuntime &&
  yrEnvBoolean("VITE_USE_AUTH_EMULATOR") &&
  !yrEmulatorConnectionState.__YR_AUTH_EMULATOR_CONNECTED__
) {
  const host =
    yrEnvText("VITE_AUTH_EMULATOR_HOST", "127.0.0.1");

  const port =
    yrEnvPort("VITE_AUTH_EMULATOR_PORT", 9099);

  connectAuthEmulator(
    auth,
    `http://${host}:${port}`,
    { disableWarnings: true }
  );

  yrEmulatorConnectionState.__YR_AUTH_EMULATOR_CONNECTED__ =
    true;

  console.info(
    `[firebase] Auth Emulator connected: ${host}:${port}`
  );
}

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

if (
  yrLocalEmulatorRuntime &&
  yrEnvBoolean("VITE_USE_FIRESTORE_EMULATOR") &&
  !yrEmulatorConnectionState.__YR_FIRESTORE_EMULATOR_CONNECTED__
) {
  const host =
    yrEnvText("VITE_FIRESTORE_EMULATOR_HOST", "127.0.0.1");

  const port =
    yrEnvPort("VITE_FIRESTORE_EMULATOR_PORT", 8080);

  connectFirestoreEmulator(db, host, port);

  yrEmulatorConnectionState.__YR_FIRESTORE_EMULATOR_CONNECTED__ =
    true;

  console.info(
    `[firebase] Firestore Emulator connected: ${host}:${port}`
  );
}

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
