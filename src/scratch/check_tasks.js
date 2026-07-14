import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "dh-servis-rapor"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function check() {
  const colRef = collection(db, 'tasks');
  const snap = await getDocs(colRef);
  console.log("--- Datça T-16 Tasks ---");
  snap.forEach(doc => {
    const data = doc.data();
    if (String(data.turbineId).includes('T-16') || String(data.turbinSeriNo).includes('481549')) {
      console.log(doc.id, {
        turbineId: data.turbineId,
        turbinSeriNo: data.turbinSeriNo,
        status: data.status,
        secilenSablon: data.secilenSablon,
        siteId: data.siteId
      });
    }
  });
}

check().catch(console.error);
