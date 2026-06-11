const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

// Minimal firebase config to just read data
const firebaseConfig = {
  projectId: "dh-servis-rapor"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDocs(collection(db, 'GlobalMaterialImages'));
  console.log(snap.docs.map(d => ({id: d.id, ...d.data()})));
}

run().catch(console.error);
