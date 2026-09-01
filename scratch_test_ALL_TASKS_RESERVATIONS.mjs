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
  
  console.log("=== Testing task-based reservations for site 2688 ===");
  const snap = await getDocs(collection(db, "tasks"));
  const bySap = {};
  const details = [];

  snap.docs.forEach(docSnap => {
    const data = docSnap.data();
    const siteId = data.taskInfo?.siteId;
    const siteName = data.taskInfo?.siteName;
    console.log(`Checking doc [${docSnap.id}]: siteId=${siteId}, siteName=${siteName}, durum=${data.workflow?.durum}`);

    const durumStr = String(data.workflow?.durum || data.workflow?.status || data.durum || data.status || '').toLowerCase().trim();
    if (durumStr.includes('tamam') || durumStr.includes('completed')) {
      console.log(`  -> Skipped because durumStr '${durumStr}' contains tamam/completed!`);
      return;
    }
    
    const materials = data.maintenanceData?.materials || [];
    const usedMaterials = [];
    
    materials.forEach((mat) => {
      const typeUpper = mat.type?.toUpperCase();
      const isTakilan = !mat.type || typeUpper === 'T';
      if (mat.sapNo && mat.used > 0 && isTakilan) {
        const sap = String(mat.sapNo).trim();
        bySap[sap] = (bySap[sap] || 0) + Number(mat.used);
        usedMaterials.push({
          sapNo: sap,
          description: mat.description || '',
          used: Number(mat.used)
        });
      }
    });

    if (usedMaterials.length > 0) {
      details.push({
        taskId: docSnap.id,
        team: data.assignment?.assignedTeam || '-',
        turbinNo: data.taskInfo?.turbinNo || '-',
        sablon: data.taskInfo?.secilenSablon || '-',
        durum: data.workflow?.durum || '-',
        createdBy: data.assignment?.createdBy || '-',
        materials: usedMaterials
      });
    }
  });

  console.log("Task details result:", JSON.stringify(details, null, 2));

  console.log("\n=== Testing transfer-based reservations for 2688 ===");
  const invSnap = await getDocs(collection(db, "warehouses", "2688", "inventory_v2"));
  const transferRows = [];
  invSnap.docs.forEach(docSnap => {
    const item = docSnap.data();
    if (item.reservations && (item.reservedQuantity || 0) > 0) {
      Object.entries(item.reservations).forEach(([tId, qty]) => {
        const numericQty = Number(qty);
        if (numericQty > 0) {
          const cleanTeam = tId.replace('team_', '').replace(/_/g, ' ');
          transferRows.push({
            team: cleanTeam,
            sapNo: item.sapNo,
            description: item.name || item.description || '-',
            qty: numericQty,
            shelf: item.shelfNo || '-'
          });
        }
      });
    }
  });

  console.log("Transfer rows result:", JSON.stringify(transferRows, null, 2));
}

run().catch(console.error);
