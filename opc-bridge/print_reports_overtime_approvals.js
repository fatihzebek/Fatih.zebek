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

  const snap = await getDocs(collection(db, 'serviceReports'));
  snap.forEach(d => {
    const data = d.data();
    if (data.date === '2026-07-08') {
      console.log(`ReportNo: ${data.reportNo} | overtimeApprovals:`, JSON.stringify(data.overtimeApprovals, null, 2));
    }
  });
  process.exit(0);
}

run().catch(console.error);
