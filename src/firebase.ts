import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
};

import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize App Check with reCAPTCHA v3 ONLY in production
// Geçici olarak iptal edildi: Şirket ağlarında reCAPTCHA engellendiği için yüklemeleri tamamen donduruyor.
/*
if (typeof window !== 'undefined' && !import.meta.env.DEV) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider('6LcR6ggtAAAAAGECggL-b3sI9AJqvC921v2knrEf'),
    isTokenAutoRefreshEnabled: true
  });
}
*/

// Initialize Services with Offline Persistence
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
