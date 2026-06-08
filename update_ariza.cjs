const admin = require('firebase-admin');
const fs = require('fs');

if (!admin.apps.length) {
    admin.initializeApp({
        projectId: 'dh-servis-rapor'
    });
}

const db = admin.firestore();

async function updateArızaTemplate() {
    const data = {
        name: 'Arıza Formu',
        icon: '⚠️',
        category: 'OTHER',
        turbineModel: 'GLOBAL',
        instructionCode: 'DH-FRM-01-ARIZA',
        materials: [
            { sapNo: '', quantity: 0, description: '', type: 'S' },
            { sapNo: '', quantity: 0, description: '', type: 'T' }
        ],
        checklist: [
            { id: 'c1', text: 'SERVİS AYRINTILARI KONTROLÜ', category: 'GENEL' },
            { id: 'c2', text: 'ÇALIŞMA ZAMANLARI GİRİŞİ', category: 'GENEL' },
            { id: 'c3', text: 'YAPILAN İŞLEMLER VE FOTOĞRAFLAR', category: 'GENEL' },
            { id: 'c4', text: 'MALZEME YÖNETİMİ VE MÇF KAYDI', category: 'GENEL' }
        ]
    };

    try {
        await db.collection('maintenance_templates').doc('form-ariza').set(data, { merge: true });
        console.log('Arıza Formu şablonu başarıyla güncellendi!');
        process.exit(0);
    } catch (error) {
        console.error('Hata oluştu:', error);
        process.exit(1);
    }
}

updateArızaTemplate();
