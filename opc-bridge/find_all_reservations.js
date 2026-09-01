const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');

const firebaseConfig = {
  apiKey: "AIzaSyBX6q4ed3OtahicugSVLRgtn81WF_avcxY",
  authDomain: "dh-servis-rapor.firebaseapp.com",
  projectId: "dh-servis-rapor",
  storageBucket: "dh-servis-rapor.appspot.com",
  messagingSenderId: "220905699849",
  appId: "1:220905699849:web:1362783809b23ce6a316d8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  await signInWithEmailAndPassword(auth, "fatih.zebek@demirerholding.com", "21021986**");
  console.log("Logged in successfully!");

  const whSnap = await getDocs(collection(db, 'warehouses'));
  for (const whDoc of whSnap.docs) {
    const invSnap = await getDocs(collection(db, 'warehouses', whDoc.id, 'inventory_v2'));
    invSnap.forEach(itemDoc => {
      const item = itemDoc.data();
      if (item.reservations && Object.keys(item.reservations).length > 0) {
        console.log(`WH: ${whDoc.id} (${whDoc.data().name}) | Item: ${itemDoc.id} | SAP: ${item.sapNo} | Name: ${item.name} | Res:`, item.reservations);
      }
    });
  }
  process.exit(0);
}

run().catch(console.error);
