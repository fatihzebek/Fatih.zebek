import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  projectId: "dh-servis-rapor",
  appId: "1:739343715104:web:f8a7042a9a4e320f77e69b",
  storageBucket: "dh-servis-rapor.appspot.com",
  apiKey: "AIzaSyBX6q4ed3OtahicugSVLRgtn81WF_avcxY",
  authDomain: "dh-servis-rapor.firebaseapp.com"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const uid = "uQpDmHp0kaeOEqOc5AUmKMyKp5h1";
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) {
    console.log(snap.data());
  } else {
    console.log("NOT FOUND");
  }
  process.exit(0);
}
check();
