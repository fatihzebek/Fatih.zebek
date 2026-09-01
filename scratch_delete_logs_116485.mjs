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
  
  console.log("=== Checking logs in warehouses/2688/logs ===");
  const snap2688 = await getDocs(collection(db, "warehouses", "2688", "logs"));
  let deletedCount = 0;
  for (const d of snap2688.docs) {
    const data = d.data();
    if (String(data.sapNo).trim() === "116485" || data.itemId === "qL9Wc5tP6H4Q8jF10x7k" || JSON.stringify(data).includes("116485")) {
      console.log("Deleting 2688 log doc:", d.id, JSON.stringify(data, null, 2));
      await deleteDoc(doc(db, "warehouses", "2688", "logs", d.id));
      deletedCount++;
    }
  }

  console.log("\n=== Checking logs in warehouses/team_Team_04/logs ===");
  const snapT04 = await getDocs(collection(db, "warehouses", "team_Team_04", "logs"));
  for (const d of snapT04.docs) {
    const data = d.data();
    if (String(data.sapNo).trim() === "116485" || JSON.stringify(data).includes("116485")) {
      console.log("Deleting team_Team_04 log doc:", d.id, JSON.stringify(data, null, 2));
      await deleteDoc(doc(db, "warehouses", "team_Team_04", "logs", d.id));
      deletedCount++;
    }
  }

  console.log(`\nFinished! Total logs deleted for 116485: ${deletedCount}`);
}

run().catch(console.error);
