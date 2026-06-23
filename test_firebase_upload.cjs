const { initializeApp } = require('firebase/app');
const { getStorage, ref, uploadString, getDownloadURL } = require('firebase/storage');

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

async function testUpload() {
  try {
    const testRef = ref(storage, 'test_upload_' + Date.now() + '.txt');
    console.log("Uploading file to " + testRef.fullPath);
    await uploadString(testRef, "Hello World test upload");
    const url = await getDownloadURL(testRef);
    console.log("Upload SUCCESS! URL:", url);
  } catch (error) {
    console.error("Upload FAILED:", error.message, error.code);
    process.exit(1);
  }
}

testUpload();
