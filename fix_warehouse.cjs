const fs = require('fs');
let c = fs.readFileSync('src/pages/Warehouses.ts', 'utf8');

const regex = /let imageUrl = \(document\.getElementById\('modal-image-preview'\) as HTMLImageElement\)\?\.src \|\| '';(\r?\n)+    let imageUrl = \(document\.getElementById\('modal-image-preview'\) as HTMLImageElement\)\?\.getAttribute\('src'\) \|\| '';[\s\S]*?return;\r?\n        \}\r?\n    \}/;

const replacement = `    let imageUrl = (document.getElementById('modal-image-preview') as HTMLImageElement)?.getAttribute('src') || '';
    if (imageUrl && (imageUrl === window.location.href || imageUrl === window.location.origin + '/')) { imageUrl = ''; }
    
    // Prevent duplicate SAP
    if (!itemId) {
        const currentInventory = await warehouseService.getInventory(warehouseId);
        const exists = currentInventory.some(i => String(i.sapNo).trim() === String(sapNo).trim());
        if (exists) {
            alert(\`Hata: \${sapNo} SAP numarasına sahip malzeme bu depoda zaten mevcut! Lütfen listedeki mevcut malzemeyi düzenleyin.\`);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
            return;
        }
    }`;

c = c.replace(regex, replacement);
fs.writeFileSync('src/pages/Warehouses.ts', c);
