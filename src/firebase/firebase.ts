// src/firebase/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// ✅ نفس بياناتك من Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCZhk4MBHz5dCIe1AfPMz2SHtV84GMC6J4",
  authDomain: "exam-manager-frontend.firebaseapp.com",
  projectId: "exam-manager-frontend",
  storageBucket: "exam-manager-frontend.firebasestorage.app",
  messagingSenderId: "259733397203",
  appId: "1:259733397203:web:bc62407b5ff9a1c5213e26",
  measurementId: "G-FYG4ZJZBR2",
};

export const app = initializeApp(firebaseConfig);

// ✅ Auth + Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, "us-central1");

// ============================
// App Check (حماية متقدمة)
// ============================
// ضع مفتاح reCAPTCHA v3 في .env:
//   VITE_APP_CHECK_SITE_KEY=...
// للتطوير يمكن تفعيل Debug Token:
//   VITE_APP_CHECK_DEBUG=true

const appCheckKey = (import.meta as any).env?.VITE_APP_CHECK_SITE_KEY as string | undefined;

// You can fully disable App Check locally if you get blocked by enforcement while developing:
//   VITE_DISABLE_APPCHECK=true
const disableAppCheck = String((import.meta as any).env?.VITE_DISABLE_APPCHECK || "").toLowerCase() === "true";

// Debug mode (local dev). When enabled, the SDK prints a debug token in the browser console.
// Add that token in Firebase Console -> App Check -> Apps -> Manage debug tokens.
const appCheckDebug =
  String((import.meta as any).env?.VITE_APP_CHECK_DEBUG || "").toLowerCase() === "true" || Boolean((import.meta as any).env?.DEV);

try {
  if (!disableAppCheck && appCheckKey) {
    // Debug token for local development
    if (appCheckDebug && typeof window !== "undefined") {
      // @ts-ignore
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }

    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
} catch {
  // لا نكسر التطبيق في حال عدم تهيئة App Check
}