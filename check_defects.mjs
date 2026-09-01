import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
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
  console.log("Signing in as Hursit...");
  await signInWithEmailAndPassword(auth, "hursit.akter@demirerholding.com", "Password123!");
  console.log("Signed in successfully!");

  const targetWh = "W01"; // Anemon İntepe Depo
  console.log(`Using Warehouse ID: ${targetWh}`);

  console.log("\n=== Querying DEFECT inventory items ===");
  const invSnap = await getDocs(collection(db, "warehouses", targetWh, "inventory_v2"));
  const defectItems = [];
  invSnap.forEach(d => {
    const data = d.data();
    if (data.condition === "DEFECT") {
      defectItems.push({ id: d.id, ...data });
      console.log(`Item: ${data.description}, SAP: ${data.sapNo}, Qty: ${data.quantity}`);
    }
  });

  console.log("\n=== Querying Reports ===");
  const reportsSnap = await getDocs(collection(db, "reports"));
  console.log(`Found ${reportsSnap.size} reports in total.`);
  let matchCount = 0;
  
  reportsSnap.forEach(d => {
    const data = d.data();
    const hasDefect = data.materials && data.materials.some(m => m.defectCount > 0);
    const siteName = data.siteName || '';
    
    // Normalize and log report site details if they might relate to Anemon/Intepe
    const isAnemonOrIntepe = siteName.toLowerCase().includes("anemon") || siteName.toLowerCase().includes("intepe") || siteName.toLowerCase().includes("i̇ntepe");
    
    if (hasDefect && isAnemonOrIntepe) {
      console.log(`Report No: ${data.reportNo || data.id}, Site: ${siteName}, Date: ${data.date}, Turbine: ${data.turbineNo}`);
      data.materials.forEach(m => {
        if (m.defectCount > 0) {
          console.log(`  - Defect Material: ${m.description}, SAP: ${m.sapNo}, DefectCount: ${m.defectCount}`);
        }
      });
      matchCount++;
    }
  });
  console.log(`\nFound ${matchCount} reports for Anemon/Intepe with defect materials.`);
}

run().catch(console.error);
