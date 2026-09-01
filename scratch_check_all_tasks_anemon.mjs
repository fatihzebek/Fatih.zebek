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
  
  console.log("=== Listing ALL tasks for site 2688 / Anemon İntepe ===");
  const snap = await getDocs(collection(db, "tasks"));
  snap.docs.forEach(d => {
    const data = d.data();
    const siteId = data.taskInfo?.siteId;
    const siteName = data.taskInfo?.siteName;
    if (siteId === "2688" || siteName?.includes("Anemon")) {
      console.log(`Task [${d.id}]: siteId=${siteId}, siteName=${siteName}, workflow=${JSON.stringify(data.workflow)}, materials=${JSON.stringify(data.maintenanceData?.materials)}`);
    }
  });
}

run().catch(console.error);
