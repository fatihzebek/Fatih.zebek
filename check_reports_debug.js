import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, getDocs, query } from "firebase/firestore";

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
  await signInWithEmailAndPassword(auth, "fallback.login@demirerholding.com", "FallbackPassword123!");
  console.log("Logged in!");

  const snapshot = await getDocs(collection(db, 'serviceReports'));
  console.log(`Total reports in DB: ${snapshot.size}`);

  const siteSummary = {};
  snapshot.forEach(doc => {
    const data = doc.data();
    const key = `${data.siteId} - ${data.siteName}`;
    if (!siteSummary[key]) {
      siteSummary[key] = { total: 0, maintenance: 0, fault: 0 };
    }
    siteSummary[key].total++;
    if (data.type === 'BAKIM') {
      siteSummary[key].maintenance++;
    } else if (data.type === 'ARIZA') {
      siteSummary[key].fault++;
    }
  });

  console.log("Site Summary:", JSON.stringify(siteSummary, null, 2));
}

run().catch(console.error);
