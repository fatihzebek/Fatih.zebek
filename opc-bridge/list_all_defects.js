const fs = require('fs');

function check(whId, filePath) {
    console.log(`=== Warehouse: ${whId} ===`);
    try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        data.documents.forEach(doc => {
            const fields = doc.fields;
            const cond = fields.condition?.stringValue;
            if (cond === 'DEFECT') {
                const sap = fields.sapNo?.stringValue || 'N/A';
                const qty = fields.quantity?.integerValue || 'N/A';
                const serial = fields.serialNo?.stringValue || 'N/A';
                console.log(`Doc: ${doc.name.split('/').pop()} | SAP: ${sap} | Qty: ${qty} | Serial: ${serial}`);
            }
        });
    } catch (e) {
        console.error(e.message);
    }
}

check('3243', 'C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\c1831559-58c4-47eb-9131-b9e1df037177\\.system_generated\\steps\\4122\\output.txt');
