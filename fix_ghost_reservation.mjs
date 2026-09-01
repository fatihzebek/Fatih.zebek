import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, updateDoc } from "firebase/firestore";
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
  
  const targetWh = "W01"; // Anemon İntepe Depo
  const colRef = collection(db, "warehouses", targetWh, "inventory_v2");
  const snap = await getDocs(colRef);
  
  let targetDocId = null;
  snap.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (String(data.sapNo).trim() === "11978") {
      targetDocId = docSnap.id;
      console.log(`Found item 11978 document: ${docSnap.id}`);
      console.log("Current Reserved Qty:", data.reservedQuantity);
      console.log("Current Reservations:", data.reservations);
    }
  });
  
  if (targetDocId) {
    console.log("Fixing reservation...");
    const docRef = doc(db, "warehouses", targetWh, "inventory_v2", targetDocId);
    await updateDoc(docRef, {
      reservedQuantity: 0,
      reservations: {}
    });
    console.log("Ghost reservation fixed successfully!");
  } else {
    console.log("Item 11978 not found in W01 inventory.");
  }
}

run().catch(console.error);
