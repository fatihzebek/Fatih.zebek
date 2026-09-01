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
  
  console.log("=== LISTING ALL DOCUMENTS IN 'tasks' ===");
  const tasksSnap = await getDocs(collection(db, "tasks"));
  console.log(`Total tasks count: ${tasksSnap.size}`);
  tasksSnap.docs.forEach(d => {
    const data = d.data();
    console.log(`[Task: ${d.id}] siteId=${data.taskInfo?.siteId}, siteName=${data.taskInfo?.siteName}, durum=${data.workflow?.durum}, team=${data.assignment?.assignedTeam}, materials=${JSON.stringify(data.maintenanceData?.materials)}`);
  });

  console.log("\n=== LISTING ALL DOCUMENTS IN 'service_reports' ===");
  try {
    const srSnap = await getDocs(collection(db, "service_reports"));
    console.log(`Total service_reports count: ${srSnap.size}`);
    srSnap.docs.forEach(d => {
      const data = d.data();
      if (JSON.stringify(data).includes("116485") || JSON.stringify(data).includes("Team 04")) {
        console.log(`[SR: ${d.id}]`, JSON.stringify(data, null, 2));
      }
    });
  } catch(e) {}
}

run().catch(console.error);
