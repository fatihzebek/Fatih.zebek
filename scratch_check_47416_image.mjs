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
  
  console.log("=== Checking global_image_pool for SAP 47416 ===");
  const poolSnap = await getDocs(collection(db, "global_image_pool"));
  poolSnap.docs.forEach(d => {
    const data = d.data();
    if (d.id.includes("47416") || JSON.stringify(data).includes("47416")) {
      console.log(`Global image pool doc [${d.id}]:`, JSON.stringify(data, null, 2));
    }
  });

  console.log("\n=== Checking warehouse 2688 inventory item for 47416 ===");
  const invSnap = await getDocs(collection(db, "warehouses", "2688", "inventory_v2"));
  invSnap.docs.forEach(d => {
    const data = d.data();
    if (String(data.sapNo).trim() === "47416") {
      console.log(`Warehouse 2688 item [${d.id}]:`, JSON.stringify(data, null, 2));
    }
  });
}

run().catch(console.error);
