const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, collection, getDocs, collectionGroup } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "dh-servis-rapor",
  appId: "1:220905699849:web:1362783809b23ce6a316d8",
  storageBucket: "dh-servis-rapor.appspot.com",
  apiKey: "AIzaSyBX6q4ed3OtahicugSVLRgtn81WF_avcxY",
  authDomain: "dh-servis-rapor.firebaseapp.com",
  messagingSenderId: "220905699849"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function run() {
  console.log("Signing in...");
  const userCredential = await signInWithEmailAndPassword(auth, "fatih.zebek@demirerholding.com", "21021986**");
  console.log("Auth SUCCESS! Logged in as:", userCredential.user.email);

  console.log("\n--- GlobalMaterialImages ---");
  const globalSnap = await getDocs(collection(db, 'GlobalMaterialImages'));
  globalSnap.forEach(doc => {
     console.log(`SAP: ${doc.id}, URL: ${doc.data().imageUrl ? doc.data().imageUrl.substring(0, 100) : "empty"}`);
  });

  console.log("\n--- inventory_v2 (With Image URLs) ---");
  const invSnap = await getDocs(collectionGroup(db, 'inventory_v2'));
  let found = 0;
  invSnap.forEach(doc => {
     const data = doc.data();
     if (data.imageUrl) {
        console.log(`Warehouse: ${doc.ref.parent.parent.id}, Item ID: ${doc.id}, Name: ${data.name}, SAP: ${data.sapNo}, URL: ${data.imageUrl.substring(0, 100)}...`);
        found++;
     }
  });
  if (found === 0) {
     console.log("No items with image URLs found in inventory_v2.");
  }
}

run().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
