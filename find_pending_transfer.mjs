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
  
  const transfersRef = collection(db, "transfers");
  const snap = await getDocs(transfersRef);
  
  console.log("=== Querying Pending Transfers (Raw) ===");
  snap.docs.forEach(docSnap => {
    const data = docSnap.data();
    if (data.status === 'PENDING') {
      console.log(`Document ID: ${docSnap.id}`);
      console.log(JSON.stringify(data, null, 2));
    }
  });
}

run().catch(console.error);
