import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
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
  
  console.log("=== Checking 116485 in 2688 (Anemon İntepe) ===");
  const inv2688 = await getDocs(collection(db, "warehouses", "2688", "inventory_v2"));
  inv2688.docs.forEach(d => {
    const data = d.data();
    if (String(data.sapNo).trim() === "116485") {
      console.log("Found in 2688:", d.id, JSON.stringify(data, null, 2));
    }
  });

  console.log("\n=== Checking 116485 in Team 04 warehouses ===");
  const t04Inv = await getDocs(collection(db, "warehouses", "team_Team_04", "inventory_v2"));
  console.log("team_Team_04 items count:", t04Inv.docs.length);
  t04Inv.docs.forEach(d => {
    const data = d.data();
    if (String(data.sapNo).trim() === "116485") {
      console.log("Found in team_Team_04:", d.id, JSON.stringify(data, null, 2));
    }
  });

  const t04Alt = await getDocs(collection(db, "warehouses", "team_Team04", "inventory_v2"));
  console.log("team_Team04 items count:", t04Alt.docs.length);
  t04Alt.docs.forEach(d => {
    const data = d.data();
    if (String(data.sapNo).trim() === "116485") {
      console.log("Found in team_Team04:", d.id, JSON.stringify(data, null, 2));
    }
  });

  console.log("\n=== Checking asset_custody for 116485 ===");
  const custodySnap = await getDocs(collection(db, "asset_custody"));
  custodySnap.docs.forEach(d => {
    const data = d.data();
    if (String(data.productCode).trim() === "116485") {
      console.log("Found in asset_custody:", d.id, JSON.stringify(data, null, 2));
    }
  });
}

run().catch(console.error);
