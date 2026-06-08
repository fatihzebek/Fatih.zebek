import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "dh-servis-rapor",
  appId: "1:220905699849:web:1362783809b23ce6a316d8",
  storageBucket: "dh-servis-rapor.firebasestorage.app",
  apiKey: "AIzaSyBX6q4ed3OtahicugSVLRgtn81WF_avcxY",
  authDomain: "dh-servis-rapor.firebaseapp.com",
  messagingSenderId: "220905699849"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function createNewUser() {
  const email = "hursit.akter@demirerholding.com";
  const password = "Password123!"; // Default password

  try {
    console.log("Creating user in Firebase Auth...");
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log("Created successfully with UID:", user.uid);

    console.log("Adding user profile to Firestore...");
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email: email,
      displayName: "Hurşit Akter",
      role: "MALZEME_YONETIMI",
      allowedTabs: ["dashboard", "warehouses", "transfers", "reports-archive", "global-history", "material-analytics", "asset-custody"],
      allowedSites: [],
      allowedWarehouses: []
    });

    console.log("Done! Password is:", password);
    process.exit(0);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      console.log("User already exists in Auth!");
      process.exit(0);
    } else {
      console.error("Error:", error);
      process.exit(1);
    }
  }
}

createNewUser();
