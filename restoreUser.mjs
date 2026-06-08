import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "dh-servis-rapor",
  appId: "1:739343715104:web:f8a7042a9a4e320f77e69b",
  storageBucket: "dh-servis-rapor.appspot.com",
  apiKey: "AIzaSyBX6q4ed3OtahicugSVLRgtn81WF_avcxY",
  authDomain: "dh-servis-rapor.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function restore() {
  try {
    const uid = "uQpDmHp0kaeOEqOc5AUmKMyKp5h1";
    const userProfile = {
      uid: uid,
      email: "fatih.zebek@demirerholding.com",
      displayName: "Fatih Zebek",
      role: "ADMIN",
      allowedTabs: {},
      allowedSites: [],
      allowedWarehouses: []
    };
    
    await setDoc(doc(db, 'users', uid), userProfile);
    console.log("SUCCESS! User profile restored.");
    process.exit(0);
  } catch (error) {
    console.error("Error restoring user:", error);
    process.exit(1);
  }
}

restore();
