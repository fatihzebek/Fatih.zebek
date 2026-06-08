const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');

const breakPoint = '<input type="text" id="modal-description"';
const breakIdx = text.indexOf(breakPoint);

// Let's find the table first
const tableIdx = text.indexOf('<table', breakIdx);
if (tableIdx === -1) {
    console.log('No table found after breakIdx');
    process.exit(1);
}

// Find the first \`; after the table
const endIdx = text.indexOf('\`;', tableIdx);

if (breakIdx === -1 || endIdx === -1 || breakIdx > endIdx) {
    console.log('Error finding indices', breakIdx, endIdx);
    process.exit(1);
}

let missingHtml = text.substring(breakIdx, endIdx);

missingHtml = missingHtml
    .replace(/\$\{e\}/g, '${selectedWarehouseId}')
    .replace(/\$\{o\|\|``\}/g, '${searchQuery || ``}')
    .replace(/\$\{t\?\.name\|\|`Depo`\}/g, '${warehouse?.name || `Depo`}')
    .replace(/\$\{t\?\.location\|\|`Stok ve Envanter Y\u00f6netim Sistemi`\}/g, '${warehouse?.location || `Stok ve Envanter Yönetim Sistemi`}')
    .replace(/\$\{f\?/g, '${hasAddMaterialPerm ?')
    .replace(/\$\{c\?/g, '${hasDeletePerm ?')
    .replace(/\$\{s===/g, '${activeTab === ')
    .replace(/\$\{h\.length\}/g, '${inventoryData.length}')
    .replace(/\$\{g\.length\}/g, '${logs.length}')
    .replace(/\$\{h\.filter\(e=>e\.criticalLimit&&e\.criticalLimit>0&&e\.quantity<=e\.criticalLimit\)\.length\}/g, '${criticalItems.length}')
    .replace(/\$\{g\.length>0\?x\(g\[0\]\.timestamp\)\.split\(` `\)\[1\]:`-`\}/g, '${logs.length > 0 ? formatTimestamp(logs[0].timestamp).split(` `)[1] : `-`}')
    .replace(/\$\{m\.length===0\?/g, '${allWarehouses.length === 0 ?')
    .replace(/m\.map\(e=>/g, 'allWarehouses.map(warehouse =>')
    .replace(/\$\{r\.length===0\?/g, '${inventoryData.length === 0 ?')
    .replace(/r\.map\(t=>/g, 'inventoryData.map(item =>')
    .replace(/\$\{t\./g, '${item.')
    .replace(/\$\{window\.lastSortBy===/g, '${sortKey === ')
    .replace(/\$\{window\.lastSortDir===/g, '${sortDir === ')
    .replace(/onclick="window\.navigate\(/g, 'onclick="(window as any).navigate(')
    .replace(/onclick="window\.updateWarehouseUI\(/g, 'onclick="(window as any).updateWarehouseUI(')
    .replace(/onclick="window\.changeTab\(/g, 'onclick="(window as any).changeTab(')
    .replace(/onclick="window\.startQuickAudit\(/g, 'onclick="(window as any).startQuickAudit(')
    .replace(/onclick="window\.startQRScanner\(/g, 'onclick="(window as any).startQRScanner(')
    .replace(/onclick="window\.downloadExcel\(/g, 'onclick="(window as any).downloadExcel(')
    .replace(/onclick="window\.triggerExcelUpload\(/g, 'onclick="(window as any).triggerExcelUpload(')
    .replace(/onchange="window\.toggleAllBatch\(/g, 'onchange="(window as any).toggleAllBatch(')
    .replace(/onchange="window\.updateBatchCount\(/g, 'onchange="(window as any).updateBatchCount(')
    .replace(/onclick="window\.deleteMaterial\(/g, 'onclick="(window as any).deleteMaterial(');

const TS_CODE = `                    <input type="text" id="modal-description" required placeholder="Malzeme adını girin..." 
                           style="width: 100%; height: 50px; background: #161b22; border: 1px solid #30363d; border-radius: 12px; color: white; padding: 0 18px; font-size: 1rem; outline: none; transition: all 0.2s; box-sizing: border-box;"
                           onfocus="this.style.borderColor='#64ffda'; this.style.background='#1c2128'" onblur="this.style.borderColor='#30363d'; this.style.background='#161b22'">
                  </div>

${missingHtml.substring(missingHtml.indexOf('</div>') + 6)}
\`;

(window as any).handleWarehouseFormSubmit = async (e: Event) => {
  e.preventDefault();
  const warehouseId = (document.getElementById('modal-warehouse-id') as HTMLInputElement).value;
  const itemId = (document.getElementById('modal-item-id') as HTMLInputElement).value;
  const sapNo = (document.getElementById('modal-sap-no') as HTMLInputElement).value;
  const description = (document.getElementById('modal-description') as HTMLInputElement).value;
  const quantity = parseInt((document.getElementById('modal-quantity') as HTMLInputElement).value || '0', 10);
  const criticalLimitVal = (document.getElementById('modal-critical-limit') as HTMLInputElement).value;
  const criticalLimit = criticalLimitVal ? parseInt(criticalLimitVal, 10) : null;
  const shelfNo = (document.getElementById('modal-shelf') as HTMLInputElement).value;
  
  let imageUrl = null;
  const submitBtn = document.getElementById('modal-submit-btn') as HTMLButtonElement;
  const originalBtnText = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> KAYDEDİLİYOR...';

    if ((window as any).pendingMaterialImage) {
      const { inventoryService } = await import('../services/InventoryService');
      const { warehouseService } = await import('../services/WarehouseService');
      const resolvedWarehouseId = warehouseService.resolveWarehouseId(warehouseId);
      imageUrl = await inventoryService.uploadMaterialImage(resolvedWarehouseId, itemId || 'temp_' + Date.now(), (window as any).pendingMaterialImage);
      (window as any).pendingMaterialImage = null;
    }
`;

fs.writeFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/replacement_block.ts', TS_CODE);
console.log('Replacement block generated! length:', TS_CODE.length);
