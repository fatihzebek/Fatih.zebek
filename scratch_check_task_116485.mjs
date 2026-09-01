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
  
  console.log("=== Querying tasks for SAP 116485 ===");
  const snap = await getDocs(collection(db, "tasks"));
  snap.docs.forEach(d => {
    const data = d.data();
    const str = JSON.stringify(data);
    if (str.includes("116485")) {
      console.log("Found task doc:", d.id);
      console.log("Task Info:", JSON.stringify(data.taskInfo, null, 2));
      console.log("Assignment:", JSON.stringify(data.assignment, null, 2));
      console.log("Workflow:", JSON.stringify(data.workflow, null, 2));
      console.log("Materials:", JSON.stringify(data.maintenanceData?.materials, null, 2));
    }
  });
}

run().catch(console.error);
