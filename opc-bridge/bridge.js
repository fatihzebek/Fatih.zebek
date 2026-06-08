const axios = require('axios');
const xml2js = require('xml2js');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, serverTimestamp } = require('firebase/firestore');

// Firebase Configuration
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
const TURBINE_COUNT = 38; // Sahadaki turbin sayisi

async function syncTurbines() {
    console.log(`\n--- Canli Senkronizasyon Baslatiliyor (${new Date().toLocaleTimeString()}) ---`);

    for (let i = 1; i <= TURBINE_COUNT; i++) {
        const plantId = `Plant${i}`;
        const tags = [
            `Loc/Wec/${plantId}/P`,
            `Loc/Wec/${plantId}/Vwind`,
            `Loc/Wec/${plantId}/Status/St`
        ];

        const itemElements = tags.map(tag => `<Items ItemName="${tag}" />`).join('');
        const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
        <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
          <soap:Body>
            <Read xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/">
              <Options ReturnErrorText="true" LocaleID="en-us" />
              <ItemList>${itemElements}</ItemList>
            </Read>
          </soap:Body>
        </soap:Envelope>`;

        try {
            const response = await axios.post(OPC_URL, soapRequest, {
                headers: {
                    'Content-Type': 'text/xml; charset=utf-8',
                    'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Read'
                },
                timeout: 5000
            });

            xml2js.parseString(response.data, async (err, result) => {
                if (err) return;
                
                const body = result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0];
                const readResponse = body.ReadResponse[0];
                const items = readResponse.RItemList[0].Items || [];

                const data = {
                    updatedAt: serverTimestamp(),
                    power: 0,
                    windSpeed: 0,
                    status: 'Unknown'
                };

                items.forEach((item, index) => {
                    const valueObj = item.Value ? item.Value[0] : null;
                    const value = (valueObj && typeof valueObj === 'object') ? valueObj._ : valueObj;
                    
                    if (index === 0) data.power = parseFloat(value || 0);
                    if (index === 1) data.windSpeed = parseFloat(value || 0);
                    if (index === 2) data.status = value || 'OK';
                    
                    if (plantId === 'Plant1') console.log(`   [DEBUG] Tag ${index}: ${value}`);
                });

                await setDoc(doc(db, "realtimeStatus", plantId), data);
                if (i % 10 === 0 || i === 1) {
                    console.log(`✅ ${plantId} -> Güç: ${data.power} kW | Rüzgar: ${data.windSpeed} m/s | Durum: ${data.status}`);
                }
            });

        } catch (error) {
            console.error(`❌ ${plantId} Okuma Hatasi`);
        }
        
        // Sunucuyu yormamak icin kisa bekleme
        await new Promise(r => setTimeout(r, 100));
    }
}

// 30 saniyede bir tum sahayı tara
setInterval(syncTurbines, 30000);
syncTurbines();
