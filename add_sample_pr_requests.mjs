import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';

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

const samples = [
  {
    orderNo: "4500998811",
    plantCode: "AN-IP",
    plantAbbreviation: "AN-IP",
    warehouseId: "W04",
    warehouseName: "Anemon Intepe Depo",
    orderDate: "2026-06-10",
    requestedQty: 50,
    arrivedQty: 30,
    sapNo: "1002345",
    description: "RULMAN FAG 22220-E1-K + H320",
    unitPriceQuote: 120.00,
    totalPriceQuote: 6000.00,
    unitPriceInvoice: 118.50,
    totalPriceInvoice: 5925.00,
    logisticCost: 350.00,
    arrivedProductsTotal: 3555.00,
    openOrderTotal: 2370.00,
    realOwner: "Hasan Kaya",
    status: "DELIVERED",
    requestedBy: "Excel İthalat",
    deliveries: [
      {
        invoiceNo: "INV20260001",
        deliveryDate: "2026-06-18",
        invoiceDate: "2026-06-20",
        quantity: 20
      },
      {
        invoiceNo: "INV20260002",
        deliveryDate: "2026-06-22",
        invoiceDate: "2026-06-24",
        quantity: 10
      }
    ]
  },
  {
    orderNo: "4500998812",
    plantCode: "MR-MN",
    plantAbbreviation: "MR-MN",
    warehouseId: "W11",
    warehouseName: "Merkez Tamir Atölyesi Depo",
    orderDate: "2026-06-12",
    requestedQty: 10,
    arrivedQty: 10,
    sapNo: "1005678",
    description: "SIEMENS PLC S7-1200 CPU 1214C",
    unitPriceQuote: 450.00,
    totalPriceQuote: 4500.00,
    unitPriceInvoice: 450.00,
    totalPriceInvoice: 4500.00,
    logisticCost: 120.00,
    arrivedProductsTotal: 4500.00,
    openOrderTotal: 0.00,
    realOwner: "Hurşit Akter",
    status: "COMPLETED",
    requestedBy: "Excel İthalat",
    deliveries: [
      {
        invoiceNo: "INV20260003",
        deliveryDate: "2026-06-20",
        invoiceDate: "2026-06-22",
        quantity: 10
      }
    ]
  },
  {
    orderNo: "4500998813",
    plantCode: "AL-SK",
    plantAbbreviation: "AL-SK",
    warehouseId: "W03",
    warehouseName: "Alasehir Jeotermal Depo",
    orderDate: "2026-06-20",
    requestedQty: 100,
    arrivedQty: 0,
    sapNo: "1009012",
    description: "ORING KITI NBR 70 (METRIK VE INCH)",
    unitPriceQuote: 3.50,
    totalPriceQuote: 350.00,
    unitPriceInvoice: 3.50,
    totalPriceInvoice: 350.00,
    logisticCost: 45.00,
    arrivedProductsTotal: 0.00,
    openOrderTotal: 350.00,
    realOwner: "Mehmet Demir",
    status: "ORDERED",
    requestedBy: "Excel İthalat",
    deliveries: []
  }
];

async function seed() {
  console.log("Authenticating as Hurşit...");
  await signInWithEmailAndPassword(auth, "hursit.akter@demirerholding.com", "Password123!");
  console.log("Authenticated successfully!");
  
  console.log("Adding sample purchase requests to Firestore...");
  const colRef = collection(db, "purchase_requests");
  for (const sample of samples) {
    const payload = {
      ...sample,
      requestedAt: serverTimestamp()
    };
    const docRef = await addDoc(colRef, payload);
    console.log(`Added sample order ${sample.orderNo} with ID: ${docRef.id}`);
  }
  console.log("Done seeding samples!");
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
