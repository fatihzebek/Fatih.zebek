const axios = require('axios');
const xml2js = require('xml2js');
const webpush = require('web-push');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, onSnapshot, getDocs, updateDoc, doc, setDoc } = require('firebase/firestore');
const turbinesMap = require('./turbines_map.json');
const statusCodesMapCS48 = require('./status_codes_map_cs48.json');
const statusCodesMapCS82 = require('./status_codes_map_cs82.json');

// Fast serial number lookup map
const serialsBySiteAndLabel = {};
Object.entries(turbinesMap).forEach(([serial, info]) => {
  const key = `${info.siteName}_${info.label}`;
  serialsBySiteAndLabel[key] = serial;
});

const PROJECT_ID = "dh-servis-rapor";
const API_KEY = "AIzaSyBX6q4ed3OtahicugSVLRgtn81WF_avcxY";
const OPC_URL = 'http://172.17.78.42:6010'; // Default Datça IP
const SITE_OPC_URLS = {
  '0752': 'http://172.17.86.170:6010', // Alize Germiyan
  '2678': 'http://172.17.72.123:6010', // Mare Manastır (E-48) / E-82 is .122
  '2688': 'http://172.17.75.50:6010',  // Anemon İntepe (E-48) / E-82 is .51
  '2990': 'http://172.17.67.42:6010',  // Doğal Sayalar
  '3213': 'http://172.17.78.42:6010',  // Dares Datça
  '3243': 'http://172.17.78.50:6010',  // Alize Çamseki (E-44) / E-82 is .51
  '3245': 'http://172.17.78.58:6010',  // Alize Keltepe
  '3439': 'http://172.17.6.202:6010',  // Alize Sarıkaya
  '3793': 'http://172.17.9.162:6010',  // Alize Kuyucak
  '3892': 'http://172.17.14.186:6010', // Alize Çataltepe
};
const SITE_USER_IDS = {
  '2688': 3532546021, // Anemon İntepe User ID
  '3439': 3226875369, // Alize Sarıkaya User ID
  '2990': 3226875369, // Doğal Sayalar User ID
  '3793': 3226875369, // Alize Kuyucak User ID
  '3213': 3226875369, // Dares Datça User ID
};
const TURBINE_COUNT = 36; // Sadece bizi ilgilendiren 36 türbin

const firebaseConfig = {
  apiKey: API_KEY,
  authDomain: `${PROJECT_ID}.firebaseapp.com`,
  projectId: PROJECT_ID,
  storageBucket: `${PROJECT_ID}.appspot.com`,
  messagingSenderId: "220905699849",
  appId: "1:220905699849:web:1362783809b23ce6a316d8"
};

const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Web Push VAPID Setup
webpush.setVapidDetails(
  'mailto:support@demirerholding.com',
  'BBRUMqEX4JSbeW-4hrlYVPkR0kyAprwYoZMPIqQZkso8mhF7IlsENJfhv9VeNwReKqPzNsJyjFT2-rH_h79_f0U',
  '8ybSNqDupGv2mDe_oUJCU-0BoPzQ7aSHzagVrmNGK2A'
);

const DATCA_SERIALS = [
    "481542", "450149", "450150", "450151", "450152", "450153", "450154", "481554",
    "481561", "481543", "481544", "481545", "481546", "481547", "481548", "481549",
    "481550", "481551", "481552", "481553", "450155", "481555", "481556", "481557",
    "481558", "481559", "481560", "450156", "481562", "481563", "481564", "481565",
    "481566", "481567", "481568", "481569"
];

async function updateFirestore(docId, power, windSpeed, status, isFault, isMaintenance, statusText) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/realtimeStatus/${docId}?key=${API_KEY}`;

    const data = {
      fields: {
        power: { doubleValue: power },
        windSpeed: { doubleValue: windSpeed },
        status: { stringValue: status },
        statusText: { stringValue: statusText || '' },
        isFault: { booleanValue: isFault },
        isMaintenance: { booleanValue: isMaintenance },
        updatedAt: { stringValue: new Date().toISOString() }
      }
    };

    try {
        await axios.patch(url, data, {
          headers: {
            'Referer': 'https://dh-servis-rapor.web.app/',
            'Content-Type': 'application/json'
          },
          timeout: 4000
        });
    } catch (error) {
        console.error(`❌ Firestore Yazma Hatası (${docId}):`, error.response ? error.response.data : error.message);
    }
}

async function syncOpcServer(siteName, siteId, opcUrl, startTurbine, endTurbine) {
    const tags = [];
    for (let i = startTurbine; i <= endTurbine; i++) {
        tags.push(`Loc/Wec/Plant${i}/P`);
        tags.push(`Loc/Wec/Plant${i}/Vwind`);
        tags.push(`Loc/Wec/Plant${i}/Status/St`);
    }

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
        const response = await axios.post(opcUrl, soapRequest, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Read'
            },
            timeout: 8000
        });

        return new Promise((resolve) => {
            xml2js.parseString(response.data, async (err, result) => {
                if (err) {
                    console.error(`❌ xml2js parsing error for ${siteName}:`, err.message);
                    return resolve(false);
                }
                try {
                    const envelopeKey = Object.keys(result || {}).find(k => k.toLowerCase().endsWith('envelope'));
                    if (!envelopeKey) return resolve(false);
                    const envelope = result[envelopeKey];
                    
                    const bodyKey = Object.keys(envelope || {}).find(k => k.toLowerCase().endsWith('body'));
                    if (!bodyKey) return resolve(false);
                    const body = envelope[bodyKey][0];
                    
                    const responseKey = Object.keys(body || {}).find(k => k.toLowerCase().endsWith('readresponse'));
                    if (!responseKey) return resolve(false);
                    const readResponse = body[responseKey][0];
                    
                    const itemListKey = Object.keys(readResponse || {}).find(k => k.toLowerCase().endsWith('ritemlist'));
                    if (!itemListKey || !readResponse[itemListKey][0]) return resolve(false);
                    const rItemList = readResponse[itemListKey][0];
                    
                    const itemsKey = Object.keys(rItemList || {}).find(k => k.toLowerCase().endsWith('items'));
                    const items = itemsKey ? (rItemList[itemsKey] || []) : [];

                    if (items.length === 0) return resolve(false);

                    const ignoredFaultCodes = ['60:18', '2:1', '0:0'];

                    for (let i = startTurbine; i <= endTurbine; i++) {
                        const turbineIndex = i - startTurbine;
                        const itemPower = items[turbineIndex * 3];
                        const itemWind = items[turbineIndex * 3 + 1];
                        const itemStatus = items[turbineIndex * 3 + 2];

                        if (!itemPower || !itemWind || !itemStatus) continue;

                        // Parse Power
                        const pKey = Object.keys(itemPower || {}).find(k => k.toLowerCase().endsWith('value'));
                        const pValObj = pKey ? itemPower[pKey][0] : null;
                        const power = parseFloat((pValObj && typeof pValObj === 'object' ? pValObj._ : pValObj) || 0);

                        // Parse Wind Speed
                        const wKey = Object.keys(itemWind || {}).find(k => k.toLowerCase().endsWith('value'));
                        const wValObj = wKey ? itemWind[wKey][0] : null;
                        const windSpeed = parseFloat((wValObj && typeof wValObj === 'object' ? wValObj._ : wValObj) || 0);

                        // Parse Status
                        const sKey = Object.keys(itemStatus || {}).find(k => k.toLowerCase().endsWith('value'));
                        const sValObj = sKey ? itemStatus[sKey][0] : null;
                        
                        let status = 'OK';
                        let isFault = false;
                        let isMaintenance = false;

                        const normalStates = ['OK', '0:0', '0:1', '0:2', '0:4', '0:5', '0', '1', 'Run', 'Turbine operational', 'Turbine in operation', 'Turbine starting'];
                        const maintenanceStates = ['8:0', '0:8', '8:1', '8:2', '8:3', '8:4', '8:5', '8:6', '8:7', '8:8'];

                        if (sValObj) {
                            if (sValObj.unsignedShort) {
                                const arr = sValObj.unsignedShort.map(v => parseInt(v));
                                status = `${arr[0]}:${arr[1]}`;
                            } else {
                                const value = typeof sValObj === 'object' ? sValObj._ : sValObj;
                                status = (value && value !== 'undefined') ? value : 'OK';
                            }
                        }

                        // Determine if it is a maintenance state
                        isMaintenance = maintenanceStates.includes(status) || status.startsWith('8:') || status === '0:8';

                        // Get Serial from Turbines Map
                        const label = `T-${String(i).padStart(2, '0')}`;
                        const lookupKey = `${siteName}_${label}`;
                        const serial = serialsBySiteAndLabel[lookupKey];

                        // Choose which status map to use based on serial prefix
                        let statusCodesMap = statusCodesMapCS82;
                        if (serial && (serial.startsWith('48') || serial.startsWith('45'))) {
                            statusCodesMap = statusCodesMapCS48;
                        }

                        // Temporary override for testing fault description
                        // if (serial === '48913') {
                        //     status = '90:51';
                        // }
                        // if (serial === '48914') {
                        //     status = '95:4';
                        // }

                        // Lookup in status codes map from CSV
                        const statusInfo = statusCodesMap[status];
                        if (statusInfo) {
                            if (statusInfo.type === 'T6') {
                                isFault = !isMaintenance;
                            } else {
                                isFault = false;
                            }
                        } else {
                            // Fallback if not found in CSV map
                            isFault = false;
                        }

                        let statusText = '';
                        if (statusInfo) {
                            const mainSubStr = status.replace(':', '-');
                            const catStr = statusInfo.category ? `${statusInfo.category} - ` : '';
                            statusText = `${mainSubStr} ${catStr}${statusInfo.description}`;
                        } else {
                            statusText = status === 'OK' ? 'OK' : `${status.replace(':', '-')} (SCADA State)`;
                        }

                        // Apply ignored fault codes (like 60:18, 2:1, 0:0)
                        if (ignoredFaultCodes.includes(status)) {
                            isFault = false;
                        }

                        if (serial) {
                            await updateFirestore(serial, power, windSpeed, status, isFault, isMaintenance, statusText);
                        }
                    }
                    resolve(true);
                } catch (parseErr) {
                    console.error(`❌ Parse error in syncOpcServer for ${siteName}:`, parseErr.message);
                    resolve(false);
                }
            });
        });

    } catch (err) {
        console.error(`❌ HTTP request error in syncOpcServer for ${siteName} (${opcUrl}):`, err.message);
        return false;
    }
}

async function syncTurbines() {
    console.log(`\n--- Canli Senkronizasyon Baslatiliyor (${new Date().toLocaleTimeString()}) ---`);

    // 1. Dares Datça
    await syncOpcServer('Dares Datça', '3213', 'http://172.17.78.42:6010', 1, 36);

    // 2. Anemon İntepe (E-48: 1-38, E-82: 39-49)
    await syncOpcServer('Anemon İntepe', '2688', 'http://172.17.75.50:6010', 1, 38);
    await syncOpcServer('Anemon İntepe', '2688', 'http://172.17.75.51:6010', 39, 49);

    // 3. Alize Sarıkaya
    await syncOpcServer('Alize Sarıkaya', '3439', 'http://172.17.6.202:6010', 1, 15);

    // 4. Doğal Sayalar
    await syncOpcServer('Doğal Sayalar', '2990', 'http://172.17.67.42:6010', 1, 48);

    // 5. Alize Kuyucak
    await syncOpcServer('Alize Kuyucak', '3793', 'http://172.17.9.162:6010', 1, 23);

    console.log(`✅ Canli Senkronizasyon Tamamlandi (${new Date().toLocaleTimeString()})`);
}

let scadaStatusCache = {};

async function fetchSubscriptionsRest() {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/push_subscriptions?key=${API_KEY}`;
    try {
        const response = await axios.get(url, { timeout: 4000 });
        const docs = response.data.documents || [];
        return docs.map(doc => {
            const fields = doc.fields || {};
            return {
                endpoint: fields.endpoint ? fields.endpoint.stringValue : '',
                keys: {
                    p256dh: fields.keys && fields.keys.mapValue && fields.keys.mapValue.fields && fields.keys.mapValue.fields.p256dh ? fields.keys.mapValue.fields.p256dh.stringValue : '',
                    auth: fields.keys && fields.keys.mapValue && fields.keys.mapValue.fields && fields.keys.mapValue.fields.auth ? fields.keys.mapValue.fields.auth.stringValue : ''
                },
                user: fields.user ? fields.user.stringValue : 'Bilinmeyen Kullanıcı'
            };
        }).filter(sub => sub.endpoint && sub.keys.p256dh && sub.keys.auth);
    } catch (error) {
        // If collection is empty or does not exist yet, REST API returns 404, we treat it as empty
        if (error.response && error.response.status === 404) {
            return [];
        }
        console.error("❌ Abonelikler REST ile okunurken hata oluştu:", error.message);
        return [];
    }
}

function startPushNotificationListener() {
    console.log("📡 Push bildirim dinleyicisi başlatıldı...");
    
    onSnapshot(collection(db, 'realtimeStatus'), async (snapshot) => {
        // Cihaz aboneliklerini REST API ile oku
        const subscriptions = await fetchSubscriptionsRest();

        snapshot.docChanges().forEach(change => {
            const docId = change.doc.id;
            const data = change.doc.data();
            const prevStatus = scadaStatusCache[docId];
            
            if (change.type === 'modified' || change.type === 'added') {
                scadaStatusCache[docId] = data.status;
                
                const isNewFault = data.isFault === true;
                
                // Durum değiştiyse ve arıza ise push gönder
                if (prevStatus !== undefined && prevStatus !== data.status && isNewFault) {
                    console.log(`🔔 YENİ ARIZA PUSH TETİKLENDİ -> Türbin: ${docId}, Durum: ${data.status}, Önceki: ${prevStatus}`);
                    
                    const tMeta = turbinesMap[docId] || { siteName: '', label: '' };
                    const sitePart = tMeta.siteName ? `${tMeta.siteName} ` : '';
                    const labelPart = tMeta.label ? `${tMeta.label} ` : '';
                    
                    let faultDesc = data.status;
                    if (data.status === '66:51') faultDesc = '66:51 (Rectifier 1 Overtemperature)';
                    else if (data.status === '66:52') faultDesc = '66:52 (Rectifier 2 Overtemperature)';
                    else if (data.status === '62:43') faultDesc = '62:43 (Feeding fault - Earth contact - Fault)';
                    else faultDesc = `${data.status} (SCADA Fault)`;

                    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

                    const payload = JSON.stringify({
                        title: '⚠️ SCADA ARIZA BİLDİRİMİ',
                        body: `${sitePart}${labelPart}${docId} seri numaralı türbinde ${faultDesc} arızası saat ${timeStr} itibarıyla oluşmuştur.`,
                        url: '/turbines'
                    });

                    // Her bir cihaza gönder (Temporarily muted by user request)
                    console.log(`🔇 Push bildirim gönderimi geçici olarak askıya alındı (Kullanıcı talebi).`);
                    /*
                    subscriptions.forEach(sub => {
                        sendPushNotification(sub, payload);
                    });
                    */
                }
            }
        });
    });
}

function sendPushNotification(sub, payload) {
    if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return;
    
    const pushSubscription = {
        endpoint: sub.endpoint,
        keys: sub.keys
    };

    webpush.sendNotification(pushSubscription, payload)
        .then(() => {
            console.log(`✈️ Push bildirim gönderildi: ${sub.user}`);
        })
        .catch(err => {
            console.error(`❌ Push bildirim başarısız (${sub.user}):`, err.message);
        });
}

const notifiedTaskClaims = new Set();

function startTaskClaimListener() {
    console.log("📡 Görev sahiplenme dinleyicisi başlatıldı...");
    
    onSnapshot(collection(db, 'tasks'), async (snapshot) => {
        const subscriptions = await fetchSubscriptionsRest();
        
        snapshot.docChanges().forEach(change => {
            const docId = change.doc.id;
            const data = change.doc.data();
            
            if (change.type === 'modified' || change.type === 'added') {
                const isScadaTask = data.taskInfo && data.taskInfo.secilenSablon === 'Türbin Arıza Formu' && data.faultData && data.faultData.statuKodu;
                const isClaimed = data.assignment && data.assignment.assignedTeam && data.assignment.assignedTeam !== 'Atanmamış' && data.assignment.assignedTeam !== 'Atanmadı';
                const isActive = data.workflow && data.workflow.durum === 'İşlemde';
                
                if (isScadaTask && isClaimed && isActive && !notifiedTaskClaims.has(docId)) {
                    // Check age to prevent legacy notification storm on startup
                    const updatedAt = data.workflow.guncellenmeTarihi?.toDate ? data.workflow.guncellenmeTarihi.toDate() : new Date();
                    const ageInMs = Date.now() - updatedAt.getTime();
                    if (ageInMs < 120000) { // 2 minutes
                        notifiedTaskClaims.add(docId);
                        
                        const siteName = data.taskInfo.sahaBilgisi || '';
                        const tLabel = data.taskInfo.turbinNo || '';
                        const claimedTeam = data.assignment.assignedTeam;
                        const faultCode = data.faultData.statuKodu;

                        console.log(`🔔 GÖREV ÜSTLENİLDİ PUSH TETİKLENDİ -> Türbin: ${tLabel}, Ekip: ${claimedTeam}`);

                        const payload = JSON.stringify({
                            title: '🛠️ GÖREV ÜSTLENİLDİ',
                            body: `${siteName} ${tLabel} türbinindeki ${faultCode} arıza görevini ${claimedTeam} ekibi üstlendi ve müdahaleye gidiyor.`,
                            url: '/turbines'
                        });

                        subscriptions.forEach(sub => {
                            sendPushNotification(sub, payload);
                        });
                    } else {
                        // Mark older tasks as notified
                        notifiedTaskClaims.add(docId);
                    }
                }
            }
        });
    });
}

async function writeOpcTag(opcUrl, tagName, arrayValues) {
    const itemValues = arrayValues.map(v => `<unsignedInt>${v}</unsignedInt>`).join('');
    
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="http://opcfoundation.org/webservices/XMLDA/1.0/">
      <soap:Body>
        <Write xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/">
          <Options ReturnErrorText="true" LocaleID="en-us" />
          <ItemList>
            <Items ItemName="${tagName}">
              <Value xsi:type="ns1:ArrayOfUnsignedInt">
                ${itemValues}
              </Value>
            </Items>
          </ItemList>
        </Write>
      </soap:Body>
    </soap:Envelope>`;

    const response = await axios.post(opcUrl, soapRequest, {
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Write'
        },
        timeout: 5000
    });

    return new Promise((resolve, reject) => {
        xml2js.parseString(response.data, (err, result) => {
            if (err) return reject(err);
            try {
                const body = result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0];
                const writeResponse = body.WriteResponse[0];
                const items = writeResponse.RItemList[0].Items || [];
                const errors = items[0] && items[0].Result ? items[0].Result[0] : null;
                if (errors && errors.$.ResultID) {
                    return reject(new Error(`OPC Write Error: ${errors.$.ResultID}`));
                }
                resolve(true);
            } catch (e) {
                resolve(true);
            }
        });
    });
}

async function readOpcTag(opcUrl, tagName) {
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <Read xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/">
          <Options ReturnErrorText="true" LocaleID="en-us" />
          <ItemList>
            <Items ItemName="${tagName}" />
          </ItemList>
        </Read>
      </soap:Body>
    </soap:Envelope>`;

    const response = await axios.post(opcUrl, soapRequest, {
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Read'
        },
        timeout: 5000
    });

    return new Promise((resolve, reject) => {
        xml2js.parseString(response.data, (err, result) => {
            if (err) return reject(err);
            try {
                const body = result['SOAP-ENV:Envelope']['SOAP-ENV:Body'][0];
                const readResponse = body.ReadResponse[0];
                const items = readResponse.RItemList[0].Items || [];
                const valueObj = items[0].Value ? items[0].Value[0] : null;
                const value = (valueObj && typeof valueObj === 'object') ? (valueObj._ || valueObj.unsignedInt || valueObj.unsignedShort || valueObj.string) : valueObj;
                resolve(value);
            } catch (e) {
                reject(e);
            }
        });
    });
}

async function readOpcTagsBatch(opcUrl, tagNames) {
    const itemsMarkup = tagNames.map(tagName => `<Items ItemName="${tagName}" />`).join('');
    
    const soapRequest = `<?xml version="1.0" encoding="utf-8"?>
    <soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
      <soap:Body>
        <Read xmlns="http://opcfoundation.org/webservices/XMLDA/1.0/">
          <Options ReturnErrorText="true" LocaleID="en-us" />
          <ItemList>
            ${itemsMarkup}
          </ItemList>
        </Read>
      </soap:Body>
    </soap:Envelope>`;

    try {
        const response = await axios.post(opcUrl, soapRequest, {
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'http://opcfoundation.org/webservices/XMLDA/1.0/Read'
            },
            timeout: 25000 // 25 seconds for large batches
        });

        return new Promise((resolve, reject) => {
            xml2js.parseString(response.data, (err, result) => {
                if (err) return reject(err);
                try {
                    const envelopeKey = Object.keys(result || {}).find(k => k.toLowerCase().endsWith('envelope'));
                    if (!envelopeKey) return reject(new Error("SOAP Envelope not found"));
                    const envelope = result[envelopeKey];
                    
                    const bodyKey = Object.keys(envelope || {}).find(k => k.toLowerCase().endsWith('body'));
                    if (!bodyKey) return reject(new Error("SOAP Body not found"));
                    const body = envelope[bodyKey][0];
                    
                    const responseKey = Object.keys(body || {}).find(k => k.toLowerCase().endsWith('readresponse'));
                    if (!responseKey) return resolve({});
                    const readResponse = body[responseKey][0];
                    
                    const itemListKey = Object.keys(readResponse || {}).find(k => k.toLowerCase().endsWith('ritemlist'));
                    if (!itemListKey || !readResponse[itemListKey][0]) {
                        return resolve({});
                    }
                    const rItemList = readResponse[itemListKey][0];
                    
                    const itemsKey = Object.keys(rItemList || {}).find(k => k.toLowerCase().endsWith('items'));
                    const items = itemsKey ? (rItemList[itemsKey] || []) : [];
                    const resultMap = {};
                    
                    items.forEach((item, index) => {
                        const name = tagNames[index];
                        const valueKey = Object.keys(item || {}).find(k => k.toLowerCase().endsWith('value'));
                        const valueObj = valueKey ? item[valueKey][0] : null;
                        let value = null;
                        if (valueObj !== null && valueObj !== undefined) {
                            if (typeof valueObj === 'object') {
                                if (valueObj._ !== undefined) {
                                    value = valueObj._;
                                } else {
                                    const valKey = Object.keys(valueObj).find(k => k !== '$');
                                    if (valKey) {
                                        value = valueObj[valKey][0];
                                    }
                                }
                            } else {
                                value = valueObj;
                            }
                        }
                        if (name) {
                            resultMap[name] = value;
                        }
                    });
                    
                    resolve(resultMap);
                } catch (e) {
                    reject(e);
                }
            });
        });
    } catch (postErr) {
        throw postErr;
    }
}

async function performOpcReset(opcUrl, turbineNo, userId) {
    const baseTag = `Loc/Wec/Plant${turbineNo}/Reset`;
    const privateKey = 12345;
    
    console.log(`[Reset Step 1] SessionRequest yazılıyor... Tag: ${baseTag}/SessionRequest`);
    await writeOpcTag(opcUrl, `${baseTag}/SessionRequest`, [1, userId, privateKey]);
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log(`[Reset Step 2] SessionPubKey okunuyor... Tag: ${baseTag}/SessionPubKey`);
    const pubKey = await readOpcTag(opcUrl, `${baseTag}/SessionPubKey`);
    if (!pubKey || pubKey === '0') throw new Error("SessionPubKey OPC sunucusundan okunamadı veya 0 döndü!");
    console.log(`[Reset Step 2] Alınan PubKey: ${pubKey}`);
    
    console.log(`[Reset Step 3] SetReset yazılıyor... Tag: ${baseTag}/SetReset, Değerler: [${turbineNo}, ${privateKey}, ${pubKey}]`);
    await writeOpcTag(opcUrl, `${baseTag}/SetReset`, [turbineNo, privateKey, parseInt(pubKey)]);
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log(`[Reset Step 4] SessionSubmit yazılıyor... Tag: ${baseTag}/SessionSubmit`);
    await writeOpcTag(opcUrl, `${baseTag}/SessionSubmit`, [privateKey, parseInt(pubKey)]);
}

function startTurbineResetListener() {
    console.log("📡 Türbin reset istek dinleyicisi başlatıldı...");
    
    onSnapshot(collection(db, 'turbineResetRequests'), async (snapshot) => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added' || change.type === 'modified') {
                const docId = change.doc.id;
                const data = change.doc.data();
                
                if (data.status === 'pending') {
                    console.log(`⚡ TÜRBİN RESET TALEBİ ALINDI -> ID: ${docId}, Saha: ${data.siteId}, Türbin No: ${data.no}`);
                    
                    // Safety validation for Dares Datça (siteId: '3213')
                    if (data.siteId === '3213') {
                        const isRtu = (data.no === 0 || data.turbineId === 'RTU');
                        const isValidTurbine = (typeof data.no === 'number' && data.no >= 1 && data.no <= 36);
                        
                        if (!isRtu && !isValidTurbine) {
                            console.error(`⚠️ BLOCKED: Datça reset attempt blocked for invalid turbine number ${data.no}`);
                            await updateDoc(doc(db, 'turbineResetRequests', docId), {
                                status: 'failed',
                                error: 'Bu türbin için reset yetkisi bulunmuyor (Sadece T01-T36 ve RTU izinli).',
                                updatedAt: new Date().toISOString()
                            });
                            return;
                        }
                    }
                    
                    // Determine which OPC URL to use based on siteId
                    let targetOpcUrl = SITE_OPC_URLS[data.siteId] || OPC_URL;
                    
                    // Special logic for sites with multiple OPC servers (E-48 vs E-82 divisions)
                    if (data.siteId === '2688') { // Anemon İntepe
                        if (data.no >= 39) {
                            targetOpcUrl = 'http://172.17.75.51:6010'; // E-82 turbines (39-49)
                        } else {
                            targetOpcUrl = 'http://172.17.75.50:6010'; // E-48 turbines (1-38)
                        }
                    } else if (data.siteId === '2678') { // Mare Manastır
                        if (data.no >= 39) {
                            targetOpcUrl = 'http://172.17.72.122:6010'; // E-82 turbines (39-55)
                        } else {
                            targetOpcUrl = 'http://172.17.72.123:6010'; // E-48 turbines (1-38)
                        }
                    } else if (data.siteId === '3243') { // Alize Çamseki
                        if (data.no >= 39) {
                            targetOpcUrl = 'http://172.17.78.51:6010'; // E-82 turbines (39-48)
                        } else {
                            targetOpcUrl = 'http://172.17.78.50:6010'; // E-44 turbines (1-38)
                        }
                    }
                    console.log(`Hedef OPC Sunucu Adresi: ${targetOpcUrl}`);
                    
                    const userId = SITE_USER_IDS[data.siteId] || 3532546021;
                    
                    try {
                        await updateDoc(doc(db, 'turbineResetRequests', docId), {
                            status: 'processing',
                            updatedAt: new Date().toISOString()
                        });
                        
                        await performOpcReset(targetOpcUrl, data.no, userId);
                        
                        await updateDoc(doc(db, 'turbineResetRequests', docId), {
                            status: 'success',
                            updatedAt: new Date().toISOString()
                        });
                        console.log(`✅ TÜRBİN RESET BAŞARILI -> Türbin No: ${data.no}`);
                    } catch (err) {
                        await updateDoc(doc(db, 'turbineResetRequests', docId), {
                            status: 'failed',
                            error: err.message,
                            updatedAt: new Date().toISOString()
                        });
                        console.error(`❌ TÜRBİN RESET HATASI -> Türbin No: ${data.no}, Hata:`, err.message);
                    }
                }
            }
        });
    });
}

function startParameterAuditListener() {
    console.log("📡 Parametre denetim istek dinleyicisi başlatıldı...");
    
    onSnapshot(collection(db, 'parameterAuditRequests'), async (snapshot) => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added' || change.type === 'modified') {
                const docId = change.doc.id;
                const data = change.doc.data();
                
                if (data.status === 'pending') {
                    console.log(`🔎 PARAMETRE DENETİM TALEBİ ALINDI -> ID: ${docId}, Saha: ${data.siteId}`);
                    
                    try {
                        // Mark request as processing
                        await updateDoc(doc(db, 'parameterAuditRequests', docId), {
                            status: 'processing',
                            updatedAt: new Date().toISOString()
                        });

                        // Determine target OPC URL
                        let targetOpcUrl = SITE_OPC_URLS[data.siteId] || OPC_URL;
                        
                        // Scanned parameter values map
                        // Format to fetch: for each turbine, query the requested parameters
                        for (const turbineNo of data.turbines) {
                            let turbineOpcUrl = targetOpcUrl;
                            
                            // Special logic for sites with multiple OPC servers (E-48 vs E-82 divisions)
                            if (data.siteId === '2688') { // Anemon İntepe
                                if (turbineNo >= 39) {
                                    turbineOpcUrl = 'http://172.17.75.51:6010'; // E-82 turbines (39-49)
                                } else {
                                    turbineOpcUrl = 'http://172.17.75.50:6010'; // E-48 turbines (1-38)
                                }
                            } else if (data.siteId === '2678') { // Mare Manastır
                                if (turbineNo >= 39) {
                                    turbineOpcUrl = 'http://172.17.72.122:6010'; // E-82 turbines (39-55)
                                } else {
                                    turbineOpcUrl = 'http://172.17.72.123:6010'; // E-48 turbines (1-38)
                                }
                            } else if (data.siteId === '3243') { // Alize Çamseki
                                if (turbineNo >= 39) {
                                    turbineOpcUrl = 'http://172.17.78.51:6010'; // E-82 turbines (39-48)
                                } else {
                                    turbineOpcUrl = 'http://172.17.78.50:6010'; // E-44 turbines (1-38)
                                }
                            }
                            
                            const parameterValues = {};
                            
                            console.log(`🔎 Plant${turbineNo} parametreleri toplu olarak okunuyor...`);
                            const tagPaths = data.parameters.map(paramId => `Loc/Wec/Plant${turbineNo}/Para/${paramId}`);
                            
                            try {
                                const batchResults = await readOpcTagsBatch(turbineOpcUrl, tagPaths);
                                data.parameters.forEach(paramId => {
                                    const tagPath = `Loc/Wec/Plant${turbineNo}/Para/${paramId}`;
                                    const val = batchResults[tagPath];
                                    if (val !== undefined && val !== null) {
                                        parameterValues[paramId] = val;
                                    }
                                });
                            } catch (batchErr) {
                                console.error(`  Plant${turbineNo} toplu okuma hatası:`, batchErr.message);
                            }
                            
                            // Save to Firestore snap doc: turbineParameterSnapshots/${siteId}_Plant${turbineNo}
                            const snapshotDocId = `${data.siteId}_Plant${turbineNo}`;
                            await setDoc(doc(db, 'turbineParameterSnapshots', snapshotDocId), {
                                siteId: data.siteId,
                                turbineNo: turbineNo,
                                parameters: parameterValues,
                                updatedAt: new Date().toISOString()
                            });
                        }

                        // Mark request as success
                        await updateDoc(doc(db, 'parameterAuditRequests', docId), {
                            status: 'success',
                            updatedAt: new Date().toISOString()
                        });
                        console.log(`✅ PARAMETRE DENETİMİ TAMAMLANDI -> ID: ${docId}`);

                    } catch (err) {
                        await updateDoc(doc(db, 'parameterAuditRequests', docId), {
                            status: 'failed',
                            error: err.message,
                            updatedAt: new Date().toISOString()
                        });
                        console.error(`❌ PARAMETRE DENETİM HATASI -> ID: ${docId}, Hata:`, err.message);
                    }
                }
            }
        });
    });
}

async function start() {
    console.log("Firebase girişi yapılıyor...");
    await signInWithEmailAndPassword(auth, "fatih.zebek@demirerholding.com", "21021986**");
    console.log("✅ Giriş başarılı!");

    console.log("✅ Canlı senkronizasyon başlıyor (Dares Datça)...");
    
    // Dinleyicileri başlat
    startPushNotificationListener();
    startTaskClaimListener();
    startTurbineResetListener();
    startParameterAuditListener();
    
    // 30 saniyede bir tum sahayı tara
    setInterval(syncTurbines, 30000);
    await syncTurbines();
}

start().catch(err => {
    console.error("❌ Başlatma hatası:", err);
});
