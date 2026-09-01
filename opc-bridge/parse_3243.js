const fs = require('fs');
const path = 'C:\\Users\\FatihZebek\\.gemini\\antigravity\\brain\\c1831559-58c4-47eb-9131-b9e1df037177\\.system_generated\\steps\\4122\\output.txt';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

data.documents.forEach(doc => {
    const fields = doc.fields;
    const sap = fields.sapNo?.stringValue;
    if (sap === '514482') {
        const cond = fields.condition?.stringValue || 'N/A';
        const qty = fields.quantity?.integerValue || 'N/A';
        const serial = fields.serialNo?.stringValue || 'N/A';
        console.log(`Doc: ${doc.name.split('/').pop()} | Cond: ${cond} | Qty: ${qty} | Serial: ${serial}`);
    }
});
