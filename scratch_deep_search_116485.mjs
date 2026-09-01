import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, collectionGroup } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

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
  await signInWithEmailAndPassword(auth, "hursit.akter@demirerholding.com", "Password123!");
  
  console.log("=== Deep Searching for '116485' across all collections ===");
  
  const collectionsToTest = ["tasks", "transfers", "asset_custody", "service_reports", "serviceReports", "warehouses"];
  
  for (const colName of collectionsToTest) {
    try {
      const snap = await getDocs(collection(db, colName));
      snap.docs.forEach(d => {
        const str = JSON.stringify(d.data());
        if (str.includes("116485")) {
          console.log(`[Collection: ${colName}] Doc ID: ${d.id}`);
          console.log(JSON.stringify(d.data(), null, 2));
        }
      });
    } catch(e) {
      // Ignore if subcollection
    }
  }

  // Also query inventory_v2 collection group
  try {
    const invGroupSnap = await getDocs(collectionGroup(db, "inventory_v2"));
    invGroupSnap.docs.forEach(d => {
      const str = JSON.stringify(d.data());
      if (str.includes("116485")) {
        console.log(`[Group inventory_v2] Doc Path: ${d.ref.path}`);
        console.log(JSON.stringify(d.data(), null, 2));
      }
    });
  } catch(e) {
    console.error("inventory_v2 group error:", e.message);
  }
}

run().catch(console.error);
