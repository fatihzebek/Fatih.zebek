import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "dh-servis-rapor",
  appId: "1:739343715104:web:f8a7042a9a4e320f77e69b",
  storageBucket: "dh-servis-rapor.appspot.com",
  apiKey: "AIzaSyBX6q4ed3OtahicugSVLRgtn81WF_avcxY",
  authDomain: "dh-servis-rapor.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function check() {
  try {
    console.log("Signing in as Hursit...");
    await signInWithEmailAndPassword(auth, "hursit.akter@demirerholding.com", "Password123!");
    console.log("Signed in! Fetching Fatih's user profile...");
    
    const uid = "uQpDmHp0kaeOEqOc5AUmKMyKp5h1";
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists()) {
      console.log("USER DATA:", JSON.stringify(snap.data(), null, 2));
    } else {
      console.log("USER PROFILE NOT FOUND!");
    }
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}

check();
