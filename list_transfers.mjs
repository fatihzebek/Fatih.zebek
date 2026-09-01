import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy, limit } from "firebase/firestore";
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
  
  console.log("=== Listing Recent Transfers ===");
  const transfersRef = collection(db, "transfers");
  const q = query(transfersRef, orderBy("createdAt", "desc"), limit(10));
  const snap = await getDocs(q);
  
  snap.docs.forEach(docSnap => {
    const data = docSnap.data();
    const createdStr = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : "no-date";
    console.log(`[Transfer ID: ${docSnap.id}] CreatedAt: ${createdStr}, From: ${data.fromSiteId}, To: ${data.toSiteId}, SAP: ${data.materialCode}, Qty: ${data.quantity}, Status: ${data.status}`);
  });
}

run().catch(console.error);
