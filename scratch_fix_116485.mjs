import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc } from "firebase/firestore";
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
  
  console.log("=== Explicitly clearing reservations field on item qL9Wc5tP6H4Q8jF10x7k ===");
  const itemRef = doc(db, "warehouses", "2688", "inventory_v2", "qL9Wc5tP6H4Q8jF10x7k");
  await updateDoc(itemRef, {
    reservations: {},
    reservedQuantity: 0
  });
  console.log("Successfully set reservations: {} and reservedQuantity: 0!");
}

run().catch(console.error);
