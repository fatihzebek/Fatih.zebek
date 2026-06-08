const admin = require('firebase-admin');
const fs = require('fs');

if (!admin.apps.length) {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

const SAP_NAMES = {
    '112486': 'grease cartridge 5Kg SHC460 pump Hove',
    '136576': 'OPTALINE 2 Ltr grease',
    '111898': 'grease optimol optigear synthetic X320'
};

async function fixLogs() {
    console.log("Fetching logs to fix...");
    const logsQuery = await db.collectionGroup('logs').where('materialName', '==', 'Bilinmeyen Malzeme').get();
    
    let fixed = 0;
    for (const doc of logsQuery.docs) {
        const data = doc.data();
        if (data.sapNo && SAP_NAMES[data.sapNo]) {
            console.log(`Fixing log ${doc.id} for SAP ${data.sapNo}`);
            await doc.ref.update({
                materialName: SAP_NAMES[data.sapNo]
            });
            fixed++;
        }
    }
    console.log(`Fixed ${fixed} logs.`);
    
    console.log("Fetching inventory items to fix...");
    const invQuery = await db.collectionGroup('inventory').where('description', '==', 'Bilinmeyen Malzeme').get();
    
    let invFixed = 0;
    for (const doc of invQuery.docs) {
        const data = doc.data();
        if (data.sapNo && SAP_NAMES[data.sapNo]) {
            console.log(`Fixing inventory ${doc.id} for SAP ${data.sapNo}`);
            await doc.ref.update({
                description: SAP_NAMES[data.sapNo]
            });
            invFixed++;
        }
    }
    console.log(`Fixed ${invFixed} inventory items.`);
}

fixLogs().catch(console.error).then(() => process.exit(0));
