const axios = require('axios');
const xml2js = require('xml2js');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, serverTimestamp } = require('firebase/firestore');

// Firebase Configuration (Same as your web app)
const firebaseConfig = {
  projectId: "dh-servis-rapor",
  appId: "1:220905699849:web:1362783809b23ce6a316d8",
  storageBucket: "dh-servis-rapor.appspot.com",
  apiKey: "AIzaSyBX6q4ed3OtahicugSVLRgtn81WF_avcxY",
  authDomain: "dh-servis-rapor.firebaseapp.com",
  messagingSenderId: "220905699849"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const OPC_URL = 'http://172.17.75.50:6010';

async function testConnection() {
    console.log(`\n--- OPC XML-DA Baglanti Testi Baslatiliyor ---`);
    console.log(`Hedef: ${OPC_URL}`);

    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <GetStatus xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/" />
      </soap:Body>
    </soap:Envelope>`;

    try {
        const response = await axios.post(OPC_URL, soapRequest, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/GetStatus'
            },
            timeout: 5000
        });

        console.log("✅ Sunucuya erisildi! Cevap alindi.");
        
        xml2js.parseString(response.data, (err, result) => {
            if (err) {
                console.error("❌ XML cozulemedi:", err);
                return;
            }
            console.log("\n--- Sunucu Bilgileri ---");
            console.log(JSON.stringify(result, null, 2));
        });

    } catch (error) {
        console.error("❌ Baglanti Hatasi!");
        if (error.code === 'ECONNABORTED') console.log("Hata: Zaman asimi (Timeout). VPN baglantinizi kontrol edin.");
        else console.log("Hata Detayi:", error.message);
    }
}

testConnection();
