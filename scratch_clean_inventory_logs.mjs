import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc, doc } from "firebase/firestore";
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
  
  const snap1 = await getDocs(collection(db, "warehouses", "2688", "inventory_logs"));
  for (const d of snap1.docs) {
    if (JSON.stringify(d.data()).includes("116485")) {
      console.log("Deleting 2688 inventory_logs doc:", d.id);
      await deleteDoc(doc(db, "warehouses", "2688", "inventory_logs", d.id));
    }
  }

  const snap2 = await getDocs(collection(db, "warehouses", "team_Team_04", "inventory_logs"));
  for (const d of snap2.docs) {
    if (JSON.stringify(d.data()).includes("116485")) {
      console.log("Deleting team_Team_04 inventory_logs doc:", d.id);
      await deleteDoc(doc(db, "warehouses", "team_Team_04", "inventory_logs", d.id));
    }
  }
}

run().catch(console.error);
