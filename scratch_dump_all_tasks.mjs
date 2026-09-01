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
  
  console.log("=== DUMP ALL TASKS ===");
  const snap = await getDocs(collection(db, "tasks"));
  console.log(`Total tasks found: ${snap.docs.length}`);
  
  snap.docs.forEach(docSnap => {
    const data = docSnap.data();
    console.log(`\nTask ID: ${docSnap.id}`);
    console.log(`  siteId: ${JSON.stringify(data.taskInfo?.siteId)} (${typeof data.taskInfo?.siteId})`);
    console.log(`  siteName: ${data.taskInfo?.siteName}`);
    console.log(`  durum: ${JSON.stringify(data.workflow?.durum)}`);
    console.log(`  assignedTeam: ${data.assignment?.assignedTeam}`);
    console.log(`  materials: ${JSON.stringify(data.maintenanceData?.materials)}`);
  });
}

run().catch(console.error);
