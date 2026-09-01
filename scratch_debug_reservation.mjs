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
  
  console.log("=== 1. Checking tasks collection ===");
  const tasksSnap = await getDocs(collection(db, "tasks"));
  tasksSnap.docs.forEach(d => {
    const data = d.data();
    if (JSON.stringify(data).includes("116485")) {
      console.log(`Task doc [${d.id}]: siteId=${data.taskInfo?.siteId}, durum=${data.workflow?.durum}, team=${data.assignment?.assignedTeam}`);
    }
  });

  console.log("\n=== 2. Checking warehouses/2688/inventory_v2 items ===");
  const invSnap = await getDocs(collection(db, "warehouses", "2688", "inventory_v2"));
  invSnap.docs.forEach(d => {
    const data = d.data();
    if (String(data.sapNo).trim() === "116485" || JSON.stringify(data.reservations || {}).includes("Team")) {
      console.log(`Inv doc [${d.id}]: sapNo=${data.sapNo}, qty=${data.quantity}, reservedQty=${data.reservedQuantity}, reservations=${JSON.stringify(data.reservations)}`);
    }
  });
}

run().catch(console.error);
