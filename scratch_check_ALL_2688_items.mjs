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
  
  console.log("=== Dumping ALL inventory items in 2688 with reservations or sap 116485 ===");
  const snap = await getDocs(collection(db, "warehouses", "2688", "inventory_v2"));
  console.log(`Total items in 2688: ${snap.size}`);
  snap.docs.forEach(d => {
    const data = d.data();
    const sapStr = String(data.sapNo || '').trim();
    if (sapStr === "116485" || data.reservedQuantity > 0 || (data.reservations && Object.keys(data.reservations).length > 0)) {
      console.log(`Doc ID [${d.id}]: sapNo=${data.sapNo}, qty=${data.quantity}, reservedQuantity=${data.reservedQuantity}, reservations=${JSON.stringify(data.reservations)}`);
    }
  });
}

run().catch(console.error);
