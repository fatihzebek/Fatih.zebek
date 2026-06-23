const fs = require('fs');
const dotenv = require('dotenv');

// Parse .env.local
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const firebaseConfig = {
  projectId: envConfig.VITE_FIREBASE_PROJECT_ID,
  appId: envConfig.VITE_FIREBASE_APP_ID,
  storageBucket: envConfig.VITE_FIREBASE_STORAGE_BUCKET,
  apiKey: envConfig.VITE_FIREBASE_API_KEY,
  authDomain: envConfig.VITE_FIREBASE_AUTH_DOMAIN,
  messagingSenderId: envConfig.VITE_FIREBASE_MESSAGING_SENDER_ID
};

// Initialize firebase admin or standard client
// Standard client requires node-fetch or similar on older node versions, but let's use firebase-admin with projectId.
// firebase-admin can run without credential cert if we set GOOGLE_APPLICATION_CREDENTIALS or just run in local auth,
// but actually firebase-admin cert is not strictly required if we use a mock/empty credential, or we can use standard client SDK.
// Let's use the client SDK:
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const colRef = collection(db, 'warehouses', 'W11', 'inventory_v2');
  const snap = await getDocs(colRef);
  console.log('Total documents:', snap.size);
  snap.forEach(doc => {
    console.log(doc.id, '=>', doc.data());
  });
  process.exit(0);
}

run().catch(console.error);
