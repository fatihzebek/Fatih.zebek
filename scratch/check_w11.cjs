const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const envConfig = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    envConfig[key] = value.trim();
  }
});

const firebaseConfig = {
  projectId: envConfig.VITE_FIREBASE_PROJECT_ID,
  appId: envConfig.VITE_FIREBASE_APP_ID,
  storageBucket: envConfig.VITE_FIREBASE_STORAGE_BUCKET,
  apiKey: envConfig.VITE_FIREBASE_API_KEY,
  authDomain: envConfig.VITE_FIREBASE_AUTH_DOMAIN,
  messagingSenderId: envConfig.VITE_FIREBASE_MESSAGING_SENDER_ID
};

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
