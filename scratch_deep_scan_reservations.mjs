import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
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
  
  console.log("=== DEEP SEARCH FOR '116485' or 'Team 04' across all collections ===");
  
  const collectionsToScan = ["tasks", "transfers", "warehouse_transfers", "repair_requests", "service_reports"];
  for (const colName of collectionsToScan) {
    try {
      const snap = await getDocs(collection(db, colName));
      snap.docs.forEach(d => {
        const str = JSON.stringify(d.data());
        if (str.includes("116485") || str.includes("Team 04") || str.includes("team_Team_04")) {
          console.log(`Found in collection [${colName}] -> docId [${d.id}]:`);
          console.log(" ", str.substring(0, 300));
        }
      });
    } catch(e) {
      console.log(`Error reading ${colName}:`, e.message);
    }
  }

  // Also check all subcollections of warehouses/2688 and warehouses/team_Team_04
  const warehouses = ["2688", "team_Team_04", "MTA"];
  const subCols = ["inventory_v2", "active_audit", "logs", "inventory_logs", "reservations", "draft_reservations"];

  for (const wId of warehouses) {
    for (const sub of subCols) {
      try {
        const snap = await getDocs(collection(db, "warehouses", wId, sub));
        snap.docs.forEach(d => {
          const str = JSON.stringify(d.data());
          if (str.includes("116485") || str.includes("Team 04")) {
            console.log(`Found in [warehouses/${wId}/${sub}] -> docId [${d.id}]:`);
            console.log(" ", str);
          }
        });
      } catch(e) {}
    }
  }
}

run().catch(console.error);
