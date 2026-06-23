const { initializeApp } = require('firebase/app');
const { getStorage, ref, listAll } = require('firebase/storage');

const firebaseConfig = {
  projectId: "dh-servis-rapor",
  appId: "1:220905699849:web:1362783809b23ce6a316d8",
  storageBucket: "dh-servis-rapor.appspot.com",
  apiKey: "AIzaSyBX6q4ed3OtahicugSVLRgtn81WF_avcxY",
  authDomain: "dh-servis-rapor.firebaseapp.com",
  messagingSenderId: "220905699849"
};

const app = initializeApp(firebaseConfig);
const storage = getStorage(app);

async function run() {
  console.log("Listing files in bucket root...");
  const rootRef = ref(storage, '/');
  const result = await listAll(rootRef);
  console.log("Root Folders:");
  result.prefixes.forEach(folder => console.log(" - " + folder.fullPath));
  console.log("Root Files:");
  result.items.forEach(file => console.log(" - " + file.fullPath));

  // Let's also try to list inside inventory/
  console.log("\nListing files in 'inventory' folder recursively...");
  async function listRecursive(folderRef) {
    const listResult = await listAll(folderRef);
    for (const file of listResult.items) {
      console.log(" FILE: " + file.fullPath);
    }
    for (const folder of listResult.prefixes) {
      console.log(" FOLDER: " + folder.fullPath);
      await listRecursive(folder);
    }
  }

  const invRef = ref(storage, 'inventory');
  try {
     await listRecursive(invRef);
  } catch(e) {
     console.warn("Failed to list 'inventory':", e.message);
  }
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
