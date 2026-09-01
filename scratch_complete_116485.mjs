import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, updateDoc, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
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
  
  console.log("=== Completing transfer 1-MSF-22072026 for Team 04 ===");
  const transferDocRef = doc(db, "transfers", "uM2a84Yedr6gRz9kYp2Q");
  await updateDoc(transferDocRef, {
    status: "COMPLETED",
    resolvedAt: serverTimestamp(),
    approvedBy: "hursit.akter@demirerholding.com"
  });
  console.log("Marked transfer uM2a84Yedr6gRz9kYp2Q as COMPLETED.");

  // Check if item 116485 exists in team_Team_04 inventory_v2
  const teamColRef = collection(db, "warehouses", "team_Team_04", "inventory_v2");
  const teamSnap = await getDocs(teamColRef);
  let existingItem = null;
  teamSnap.docs.forEach(d => {
    if (String(d.data().sapNo).trim() === "116485") {
      existingItem = { id: d.id, ...d.data() };
    }
  });

  if (existingItem) {
    const itemRef = doc(db, "warehouses", "team_Team_04", "inventory_v2", existingItem.id);
    await updateDoc(itemRef, {
      quantity: (existingItem.quantity || 0) + 1,
      lastUpdated: serverTimestamp()
    });
    console.log("Updated existing item in team_Team_04 inventory to qty:", (existingItem.quantity || 0) + 1);
  } else {
    await addDoc(teamColRef, {
      sapNo: "116485",
      name: "sru brush holder comp. COBHAM® E48",
      description: "sru brush holder comp. COBHAM® E48",
      quantity: 1,
      reservedQuantity: 0,
      reservations: {},
      condition: "NEW",
      shelfNo: "-",
      unit: "Adet",
      lastUpdated: serverTimestamp()
    });
    console.log("Created item 116485 in team_Team_04 inventory_v2 with quantity 1.");
  }
}

run().catch(console.error);
