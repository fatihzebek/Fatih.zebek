import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "dh-servis-rapor"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const colRef = collection(db, 'warehouses', 'team_Team_15', 'inventory_v2');
  const snap = await getDocs(colRef);
  console.log("--- Team 15 Deposu Inventory ---");
  snap.forEach(doc => {
    console.log(doc.id, doc.data());
  });
}

check().catch(console.error);
