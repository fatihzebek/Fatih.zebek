import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where } from "firebase/firestore";
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
  
  const tasksRef = collection(db, "tasks");
  const snap = await getDocs(tasksRef);
  
  console.log("=== Searching for Task reserving SAP 11978 ===");
  let found = false;
  
  snap.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (data.workflow?.durum === 'Tamamlandı') return;
    
    const materials = data.maintenanceData?.materials || [];
    materials.forEach((mat) => {
      if (String(mat.sapNo).trim() === "11978" && Number(mat.used) > 0) {
        found = true;
        console.log(`\nFound Reserving Task!`);
        console.log(`Task ID: ${docSnap.id}`);
        console.log(`Task No/Serial: ${data.taskInfo?.taskNo || '-'}`);
        console.log(`Site ID: ${data.taskInfo?.siteId} (Site Name: ${data.taskInfo?.siteName || '-'})`);
        console.log(`Turbine No: ${data.taskInfo?.turbinNo || '-'}`);
        console.log(`Assigned Team: ${data.assignment?.assignedTeam || '-'}`);
        console.log(`Status: ${data.workflow?.durum || '-'}`);
        console.log(`Template: ${data.taskInfo?.secilenSablon || '-'}`);
        console.log(`Material: ${mat.description}, Used Qty: ${mat.used}`);
      }
    });
  });
  
  if (!found) {
    console.log("No reserving task found for SAP 11978.");
  }
}

run().catch(console.error);
