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
  
  const usersRef = collection(db, "users");
  const snap = await getDocs(usersRef);
  
  console.log("=== Listing Users ===");
  snap.docs.forEach(docSnap => {
    const data = docSnap.data();
    console.log(`Email: ${data.email}, Role: ${data.role}, AllowedTabsKeys: ${Object.keys(data.allowedTabs || {})}`);
    console.log(`AllowedTabs:`, JSON.stringify(data.allowedTabs));
  });
}

run().catch(console.error);
