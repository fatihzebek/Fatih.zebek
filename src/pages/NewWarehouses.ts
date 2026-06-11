import { dataService } from '../services/DataService';
import { warehouseService } from '../services/WarehouseService';
import { warehouseAgent } from '../agents/WarehouseAgent';
import { fileService } from '../services/FileService';
import { excelService } from '../services/ExcelService';
import { serviceReportService } from '../services/ServiceReportService';
import { ImageCompressor } from '../utils/imageCompressor';
import type { IMalzeme } from '../types/depo';
import QRCode from 'qrcode';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

export const NewWarehousePage = async (warehouseId?: string | null) => {
  const allWarehouses = dataService.getWarehouses();
  const currentWarehouse = warehouseId 
    ? allWarehouses.find(w => w.id === warehouseId) 
    : allWarehouses[0];

  if (!currentWarehouse) {
    return `<div style="padding: 2rem; color: #94A3B8; text-align: center;">Kayıtlı depo bulunamadı.</div>`;
  }

  const currentTab = ((window as any).currentWarehouseTab || 'inventory').toUpperCase();
  const currentPeriod = localStorage.getItem('warehouse_analytics_period') || 'this-month';

  // Fetch and Process Service Reports for Turbine Material Consumption
  let reports = (await serviceReportService.getAllReports()).filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return !isNaN(d.getTime());
  });

  const now = new Date();
  reports = reports.filter(r => {
    const rDate = new Date(r.date);
    if (currentPeriod === 'this-week') {
      const monday = new Date(now);
      monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
      monday.setHours(0, 0, 0, 0);
      return rDate >= monday;
    } else if (currentPeriod === 'this-month') {
      return rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
    } else if (currentPeriod === 'last-month') {
      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return rDate.getMonth() === lastMonth.getMonth() && rDate.getFullYear() === lastMonth.getFullYear();
    } else if (currentPeriod === 'this-year') {
      return rDate.getFullYear() === now.getFullYear();
    } else if (currentPeriod === 'custom') {
      const startStr = localStorage.getItem('warehouse_analytics_start');
      const endStr = localStorage.getItem('warehouse_analytics_end');
      if (startStr && endStr) {
        const start = new Date(startStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endStr);
        end.setHours(23, 59, 59, 999);
        return rDate >= start && rDate <= end;
      }
      return true;
    }
    return true;
  });

  const turbineData: Record<string, { totalUsed: number; totalDefect: number; items: any[] }> = {};
  
  if (currentWarehouse) {
      // Filter reports by warehouse's associated site. (Warehouse name e.g. "Anemon İntepe Depo", site name e.g. "Anemon Intepe")
      const whNameBase = currentWarehouse.name.toLowerCase().replace('depo', '').trim();
      
      reports.forEach(report => {
         if (!report.materials || report.materials.length === 0) return;
         
         const reportSiteBase = (report.siteName || '').toLowerCase().trim();
         
         // Sadece bu depoya (sahaya) ait olanları al.
         // Eger depo genel depo ise (örn. Merkez) veya filtrelemek istemiyorsanız bu if blogunu kaldirabilirsiniz,
         // ancak her depo kendi sahasının verisini görsün istiyorsak eşleştirme yapıyoruz.
         const isMatch = whNameBase.includes(reportSiteBase) || reportSiteBase.includes(whNameBase) || whNameBase === 'merkez';
         
         if (!isMatch && reportSiteBase !== '') return;
         
         const turbineId = (report.siteName ? report.siteName + ' ' : '') + (report.turbineNo || report.turbineSerial || 'Bilinmeyen');
         const searchSAP = (localStorage.getItem('warehouse_analytics_sap') || '').toLowerCase().trim();
         
         report.materials.forEach(mat => {
            if (mat.used > 0 || mat.defectCount > 0) {
               // SAP / İsim Filtresi
               if (searchSAP) {
                 const sapMatch = (mat.sapNo || '').toLowerCase().includes(searchSAP);
                 const nameMatch = (mat.description || '').toLowerCase().includes(searchSAP);
                 if (!sapMatch && !nameMatch) return; // Filtreye uymazsa atla
               }

               if (!turbineData[turbineId]) {
                  turbineData[turbineId] = { totalUsed: 0, totalDefect: 0, items: [] };
               }
               
               turbineData[turbineId].items.push({
                  reportId: report.reportNo || report.id || '',
                  date: report.date,
                  matFormNo: report.matFormNo || '-',
                  sapNo: mat.sapNo || '-',
                  description: mat.description,
                  used: mat.used || 0,
                  defect: mat.defectCount || 0
               });
               turbineData[turbineId].totalUsed += (mat.used || 0);
               turbineData[turbineId].totalDefect += (mat.defectCount || 0);
            }
         });
      });
  }

  const sortedTurbines = Object.entries(turbineData).sort((a, b) => (b[1].totalUsed + b[1].totalDefect) - (a[1].totalUsed + a[1].totalDefect));

  // Store data globally for Excel export
  (window as any).currentTurbineData = turbineData;
  (window as any).currentWarehouseName = currentWarehouse ? currentWarehouse.name : '';

  const warehouseName = currentWarehouse ? currentWarehouse.name : 'Depo Seçilmedi';
  
  // Fetch live inventory items
  let inventoryItems: any[] = [];
  let inventoryWithQRs: any[] = [];
  if (currentWarehouse) {
    const rawItems = await warehouseService.getInventory(currentWarehouse.id);
    inventoryItems = rawItems.map(item => ({ ...item, name: (item as any).name || item.description || 'Bilinmeyen Malzeme' }));
    (window as any).currentInventoryData = inventoryItems;
    inventoryWithQRs = await Promise.all(inventoryItems.map(async (item) => {
      try {
        const qrData = JSON.stringify({ id: item.id, sapNo: item.sapNo });
        const qrDataUrl = await QRCode.toDataURL(qrData, { width: 64, margin: 1 });
        return { ...item, qrDataUrl };
      } catch (e) {
        return { ...item, qrDataUrl: '' };
      }
    }));
  }
  
  // Attach logic to window so it runs when rendered
  (window as any).initNewWarehouseLogic = () => {
    let html5QrcodeScanner: Html5QrcodeScanner | null = null;
    let auditMode: 'info' | 'audit' = 'info';
    let auditResults: any[] = [];

    (window as any).startQRScanner = () => {
       auditMode = 'info';
       document.getElementById('qr-modal')!.style.display = 'flex';
       startScanner();
    };

    (window as any).startFastAudit = () => {
       auditMode = 'audit';
       auditResults = [];
       document.getElementById('qr-modal')!.style.display = 'flex';
       startScanner();
    };

    (window as any).closeQRModal = () => {
       document.getElementById('qr-modal')!.style.display = 'none';
       if (html5QrcodeScanner) {
         html5QrcodeScanner.clear().catch(e => console.error(e));
       }
    };

    const startScanner = () => {
      document.getElementById('qr-reader-results')!.innerHTML = '';
      if (html5QrcodeScanner) html5QrcodeScanner.clear();
      html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
      html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    };

    const onScanSuccess = (decodedText: string) => {
      try {
        const data = JSON.parse(decodedText);
        const item = inventoryWithQRs.find(i => i.id === data.id || i.sapNo === data.sapNo);
        if (item) {
          if (html5QrcodeScanner) html5QrcodeScanner.clear(); // pause scanning
          if (auditMode === 'info') {
             showInfo(item);
          } else {
             showAuditInput(item);
          }
        }
      } catch (e) {
        console.error('Invalid QR code', decodedText);
      }
    };

    const onScanFailure = (error: any) => { /* ignore */ };

    const showInfo = (item: any) => {
       const resultsDiv = document.getElementById('qr-reader-results')!;
       resultsDiv.innerHTML = `
         <div style="background: #1E293B; border-radius: 8px; padding: 1rem; margin-top: 1rem; text-align: center;">
           ${item.imageUrl ? `<img src="${item.imageUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-bottom: 1rem;" />` : ''}
           <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0;">${item.name}</h4>
           <div style="color: #94A3B8; font-size: 0.9rem; margin-bottom: 1rem;">SAP No: ${item.sapNo}</div>
           <div style="background: #0A0E17; border-radius: 6px; padding: 1rem;">
             <div style="font-size: 0.8rem; color: #94A3B8; text-transform: uppercase;">Güncel Stok</div>
             <div style="font-size: 2rem; font-weight: 700; color: #14F195;">${item.quantity} ${item.unit && item.unit !== 'undefined' && item.unit !== 'null' ? item.unit : 'Adet'}</div>
           </div>
           <button onclick="window.closeQRModal()" style="width: 100%; margin-top: 1rem; padding: 0.75rem; border-radius: 8px; background: #3B82F6; border: none; color: white; font-weight: 600; cursor: pointer;">Kapat</button>
           <button onclick="window.startQRScanner()" style="width: 100%; margin-top: 0.5rem; padding: 0.75rem; border-radius: 8px; background: #1E293B; border: 1px solid #334155; color: white; font-weight: 600; cursor: pointer;">Yeni QR Tara</button>
         </div>
       `;
    };

    const showAuditInput = (item: any) => {
       const resultsDiv = document.getElementById('qr-reader-results')!;
       resultsDiv.innerHTML = `
         <div style="background: #1E293B; border-radius: 8px; padding: 1rem; margin-top: 1rem;">
           <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0;">${item.name}</h4>
           <div style="color: #94A3B8; font-size: 0.9rem; margin-bottom: 1rem;">Sistem Stoğu: <strong>${item.quantity}</strong></div>
           
           <div style="margin-bottom: 1rem;">
             <label style="display: block; font-size: 0.85rem; color: #94A3B8; margin-bottom: 0.5rem;">Fiziksel Sayım (Adet)</label>
             <input type="number" id="audit-qty-input" placeholder="Sayım miktarı..." style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #334155; border-radius: 8px; color: #FFFFFF; padding: 0 1rem; outline: none;" />
           </div>

           <div id="audit-note-container" style="display: none; margin-bottom: 1rem;">
             <label style="display: block; font-size: 0.85rem; color: #EF4444; margin-bottom: 0.5rem;">Fark Açıklaması (Zorunlu)</label>
             <input type="text" id="audit-note-input" placeholder="Neden eksik/fazla?" style="width: 100%; height: 42px; background-color: rgba(239, 68, 68, 0.1); border: 1px solid #EF4444; border-radius: 8px; color: #FFFFFF; padding: 0 1rem; outline: none;" />
           </div>

           <button id="save-audit-item-btn" style="width: 100%; padding: 0.75rem; border-radius: 8px; background: #14F195; border: none; color: #0A0E17; font-weight: 600; cursor: pointer;">Kaydet ve Devam Et</button>
           <button onclick="window.finishAudit()" style="width: 100%; margin-top: 0.5rem; padding: 0.75rem; border-radius: 8px; background: #3B82F6; border: none; color: white; font-weight: 600; cursor: pointer;">Sayımı Bitir</button>
         </div>
       `;

       const qtyInput = document.getElementById('audit-qty-input') as HTMLInputElement;
       const noteContainer = document.getElementById('audit-note-container')!;
       const noteInput = document.getElementById('audit-note-input') as HTMLInputElement;
       const saveBtn = document.getElementById('save-audit-item-btn')!;

       qtyInput.addEventListener('input', () => {
         const val = parseFloat(qtyInput.value);
         if (!isNaN(val) && val !== item.quantity) {
           noteContainer.style.display = 'block';
         } else {
           noteContainer.style.display = 'none';
         }
       });

       saveBtn.addEventListener('click', () => {
         const qty = parseFloat(qtyInput.value);
         if (isNaN(qty)) return alert('Geçerli bir miktar girin.');
         const diff = qty - item.quantity;
         if (diff !== 0 && !noteInput.value.trim()) {
           return alert('Lütfen fark açıklamasını girin!');
         }

         auditResults.push({
           itemId: item.id,
           sapNo: item.sapNo,
           description: item.name,
           systemQty: item.quantity,
           physicalQty: qty,
           diff: diff,
           note: diff !== 0 ? noteInput.value.trim() : ''
         });

         startScanner();
       });
    };

    (window as any).finishAudit = async () => {
       if (auditResults.length === 0) {
         (window as any).closeQRModal();
         return;
       }

       const confirmBtn = confirm('Sayımı tamamlamak ve stokları güncellemek istediğinize emin misiniz?');
       if (!confirmBtn) return;

       try {
         const totalDiff = auditResults.reduce((sum, r) => sum + r.diff, 0);
         const userStr = localStorage.getItem('user');
         const user = userStr ? JSON.parse(userStr).name || JSON.parse(userStr).email : 'Bilinmeyen Kullanıcı';
         
         await warehouseService.saveAudit(currentWarehouse.id, {
           user: user,
           totalItems: auditResults.length,
           totalDiff: totalDiff,
           results: auditResults
         });

         alert('Sayım başarıyla kaydedildi ve stoklar güncellendi!');
         (window as any).closeQRModal();
         if ((window as any).selectWarehouseAndNavigate) {
           (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
         }
       } catch (error) {
         console.error(error);
         alert('Sayım kaydedilirken bir hata oluştu.');
       }
    };

    (window as any).showBigQR = (qrUrl: string, name: string) => {
       document.getElementById('big-qr-img')!.setAttribute('src', qrUrl);
       document.getElementById('big-qr-title')!.innerText = name;
       document.getElementById('big-qr-modal')!.style.display = 'flex';
    };

    (window as any).closeBigQR = () => {
       document.getElementById('big-qr-modal')!.style.display = 'none';
    };

    (window as any).showBigImage = (url: string, title: string) => {
       document.getElementById('big-image-img')!.setAttribute('src', url);
       document.getElementById('big-image-title')!.innerText = title;
       document.getElementById('big-image-modal')!.style.display = 'flex';
    };

    (window as any).triggerImageUpload = (itemId: string, sapNo: string) => {
       const input = document.getElementById('item-image-upload') as HTMLInputElement;
       if (!input) return;
       input.onchange = async (e: any) => {
         const file = e.target.files?.[0];
         if (!file) return;
         
         const path = `inventory/${currentWarehouse.id}/${itemId}_${Date.now()}`;
         
         // Fire and forget compression and upload
         if (ImageCompressor) {
            const cell = document.getElementById(`img-cell-${itemId}`);
            if (cell) {
               // Show a loading indicator temporarily
               const nameText = cell.innerText.trim();
               cell.innerHTML = `<div style="width:36px; height:36px; border-radius:6px; background-color: rgba(20, 241, 149, 0.1); border: 1px solid #14F195; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#14F195;"><i class="fa-solid fa-spinner fa-spin"></i></div>${nameText}`;
            }
            
            ImageCompressor.compressImage(file, 800, 800, 0.7)
              .then((compressedFile: File) => fileService.uploadImage(compressedFile, path))
              .then((url: string) => warehouseService.updateMaterialImage(currentWarehouse.id, itemId, url, sapNo).then(() => url))
              .then((url: string) => {
                  const cell = document.getElementById(`img-cell-${itemId}`);
                  if (cell) {
                      const nameText = cell.innerText.trim();
                      const safeName = nameText.replace(/'/g, "");
                      cell.innerHTML = `<div onclick="window.showBigImage('${url}', '${safeName}')" style="width:36px; height:36px; border-radius:6px; background-color: rgba(59, 130, 246, 0.1); border: 1px solid #3B82F6; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#3B82F6; cursor: pointer; transition: all 0.2s;" title="Görseli Büyüt" onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'; this.style.color='#3B82F6'"><i class="fa-solid fa-image"></i></div>${nameText}`;
                  }
                  // Show success toast
                  const toast = document.createElement('div');
                  toast.innerText = "Görsel başarıyla yüklendi!";
                  toast.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #14F195; color: #000; padding: 12px 24px; border-radius: 8px; font-weight: bold; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: opacity 0.5s;";
                  document.body.appendChild(toast);
                  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
              })
              .catch((err: any) => {
                  console.error("Upload error: ", err);
                  alert("Görsel yüklenirken hata: " + (err.message || err.toString()));
                  // Show error toast
                  const toast = document.createElement('div');
                  toast.innerText = "Görsel yüklenirken hata oluştu!";
                  toast.style.cssText = "position: fixed; bottom: 20px; right: 20px; background: #EF4444; color: #FFF; padding: 12px 24px; border-radius: 8px; font-weight: bold; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: opacity 0.5s;";
                  document.body.appendChild(toast);
                  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 500); }, 3000);
                  
                  // Restore original icon
                  const cell = document.getElementById(`img-cell-${itemId}`);
                  if (cell) {
                      const nameText = cell.innerText.trim();
                      cell.innerHTML = `<div onclick="window.triggerImageUpload('${itemId}', '${sapNo}')" style="width:36px; height:36px; border-radius:6px; background-color: #1E293B; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#64748B; cursor: pointer; transition: all 0.2s;" title="Tekrar Dene" onmouseover="this.style.backgroundColor='#334155'" onmouseout="this.style.backgroundColor='#1E293B'"><i class="fa-solid fa-image"></i></div>${nameText}`;
                  }
              })
              .finally(() => {
                  input.value = ''; // Reset input ONLY after promise completes
              });
         } else {
             input.value = ''; // Reset input if compressImage is missing
         }
       };
       input.click();
    };

    const modal = document.getElementById('add-new-modal');
    const sapInput = document.getElementById('new-sap-input') as HTMLInputElement;
    const nameInput = document.getElementById('new-name-input') as HTMLInputElement;
    const quantityInput = document.getElementById('new-qty-input') as HTMLInputElement;
    const unitInput = document.getElementById('new-unit-input') as HTMLInputElement;
    const locationInput = document.getElementById('new-loc-input') as HTMLInputElement;

    (window as any).openAddNewModal = () => {
      if(modal) modal.style.display = 'flex';
      setTimeout(() => sapInput?.focus(), 100);
    };

    (window as any).closeAddNewModal = () => {
      if(modal) modal.style.display = 'none';
      if(sapInput) sapInput.value = '';
      if(nameInput) nameInput.value = '';
      if(quantityInput) quantityInput.value = '';
      if(locationInput) locationInput.value = '';
      const imgInput = document.getElementById('new-img-input') as HTMLInputElement;
      if (imgInput) imgInput.value = '';
      const imgLabel = document.getElementById('new-img-label');
      if (imgLabel) { imgLabel.innerText = 'Görsel Yükle'; imgLabel.style.color = '#94A3B8'; }
      // Soft-reload UI to show new items
      if ((window as any).selectWarehouseAndNavigate) {
        (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
      }
    };

    let sapTimeout: any;
    if(sapInput) {
      sapInput.addEventListener('input', (e) => {
        clearTimeout(sapTimeout);
        const val = (e.target as HTMLInputElement).value;
        if(val.length > 0) {
          nameInput.value = 'Aranıyor...';
          sapTimeout = setTimeout(async () => {
            try {
              const res = await warehouseAgent.resolveSapNumber(val);
              if (res.found) {
                nameInput.value = res.name || '';
              } else {
                nameInput.value = 'Sözlükte bulunamadı. Manuel giriniz.';
              }
            } catch(err) {
              nameInput.value = 'Hata oluştu';
            }
          }, 400); // 400ms debounce
        } else {
          nameInput.value = '';
        }
      });
    }

    (window as any).saveNewItem = async (btn: HTMLButtonElement) => {
      if(!sapInput.value || !nameInput.value || !quantityInput.value) {
        alert('Lütfen zorunlu alanları doldurun!');
        return;
      }
      
      const existingSap = inventoryItems.find(i => i.sapNo === sapInput.value);
      if (existingSap) {
        alert(`Hata: Bu SAP numarası depoda zaten kayıtlı! Lütfen yeni malzeme eklemek yerine mevcut "${existingSap.name}" malzemesini güncelleyin.`);
        return;
      }

      const originalText = btn.innerText;
      btn.innerText = 'Kaydediliyor...';
      btn.disabled = true;

      try {
        const imgInput = document.getElementById('new-img-input') as HTMLInputElement;
        const inputNameValue = nameInput.value;

        const result = await warehouseService.addMaterial(currentWarehouse.id, {
          sapNo: sapInput.value,
          name: nameInput.value,
          quantity: parseInt(quantityInput.value),
          unit: unitInput.value || 'Adet',
          location: locationInput.value || 'GİRİLMEMİŞ',
          minStock: 0,
          imageUrl: '', // Initial empty
          notes: ''
        } as any); // Type assertion until models are fully unified
        
        // Background fire and forget for image upload
        if (imgInput && imgInput.files && imgInput.files.length > 0) {
          const file = imgInput.files[0];
          const path = `materials/${sapInput.value}_${Date.now()}_${file.name}`;
          
          if (ImageCompressor) {
              ImageCompressor.compressImage(file, 800, 800, 0.7).then((compressedFile: File) => {
                  fileService.uploadImage(compressedFile, path).then(url => {
                    warehouseService.updateMaterialImage(currentWarehouse.id, result.id, url, sapInput.value).then(() => {
                      const cell = document.getElementById(`img-cell-${result.id}`);
                      if (cell) {
                        const safeName = inputNameValue.replace(/'/g, "");
                        cell.innerHTML = `<div onclick="window.showBigImage('${url}', '${safeName}')" style="width:36px; height:36px; border-radius:6px; background-color: rgba(59, 130, 246, 0.1); border: 1px solid #3B82F6; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#3B82F6; cursor: pointer; transition: all 0.2s;" title="Görseli Büyüt" onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'; this.style.color='#3B82F6'"><i class="fa-solid fa-image"></i></div>${inputNameValue}`;
                      }
                    });
                  }).catch(err => console.error('Arkaplan görsel yükleme hatası:', err))
                    .finally(() => {
                        imgInput.value = '';
                    });
              });
          } else {
              imgInput.value = '';
          }
        }
        
        // Reset form for next entry
        sapInput.value = '';
        nameInput.value = '';
        quantityInput.value = '';
        locationInput.value = '';
        if (imgInput) imgInput.value = '';
        const imgLabel = document.getElementById('new-img-label');
        if (imgLabel) { imgLabel.innerText = 'Görsel Yükle'; imgLabel.style.color = '#94A3B8'; }
        sapInput.focus();
        
        btn.innerText = 'Başarıyla Eklendi!';
        btn.style.backgroundColor = '#10B981'; // Success green
        
        setTimeout(() => {
          btn.innerText = originalText;
          btn.style.backgroundColor = '#14F195'; // Original green
          btn.disabled = false;
        }, 1500);

      } catch (err) {
        console.error(err);
        alert('Eklenirken hata oluştu.');
        btn.innerText = originalText;
        btn.disabled = false;
      }
    };

    (window as any).deleteItem = async (itemId: string, name: string) => {
      if(confirm(`"${name}" malzemesini silmek istediğinize emin misiniz?`)) {
        await warehouseService.deleteMaterial(currentWarehouse.id, itemId);
        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
        }
      }
    };
    
    (window as any).compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<File> => {
      return new Promise((resolve) => {
        // file.type kontrolünü kaldırdık çünkü mobilde bazen type boş ("") gelebiliyor.
        
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.onerror = () => {
           URL.revokeObjectURL(objectUrl);
           resolve(file);
        };
        
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if(ctx) ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
              } else {
                resolve(file); // fallback
              }
            }, 'image/jpeg', quality);
          };
          img.src = objectUrl;
      });
    };

    (window as any).openEditModal = (id: string, sap: string, name: string, qty: number, loc: string, imageUrl?: string, minStock?: number) => {
       const modal = document.getElementById('new-warehouse-edit-modal');
       if(modal) {
         (document.getElementById('edit-item-id') as HTMLInputElement).value = id;
         (document.getElementById('edit-sap-input') as HTMLInputElement).value = sap;
         (document.getElementById('edit-name-input') as HTMLInputElement).value = name;
         (document.getElementById('edit-qty-input') as HTMLInputElement).value = qty.toString();
         (document.getElementById('edit-loc-input') as HTMLInputElement).value = loc || '';
         
         const minStockInput = document.getElementById('edit-min-stock-input') as HTMLInputElement;
         if (minStockInput) minStockInput.value = minStock !== undefined ? minStock.toString() : '0';
         
         const imgPreview = document.getElementById('edit-img-preview') as HTMLImageElement;
         if (imgPreview) {
             if (imageUrl && imageUrl !== 'undefined' && imageUrl !== 'null') {
                 imgPreview.src = imageUrl;
                 imgPreview.style.display = 'block';
             } else {
                 imgPreview.src = '';
                 imgPreview.style.display = 'none';
             }
         }
         
         const imgInput = document.getElementById('edit-img-input') as HTMLInputElement;
         if (imgInput) imgInput.value = '';
         
         modal.style.display = 'flex';
       }
    };
    
    (window as any).closeEditModal = () => {
       const modal = document.getElementById('new-warehouse-edit-modal');
       if(modal) modal.style.display = 'none';
    };
    
    (window as any).saveEditItem = async (btn: HTMLButtonElement) => {
       const id = (document.getElementById('edit-item-id') as HTMLInputElement).value;
       const sap = (document.getElementById('edit-sap-input') as HTMLInputElement).value;
       const name = (document.getElementById('edit-name-input') as HTMLInputElement).value;
       const qty = parseInt((document.getElementById('edit-qty-input') as HTMLInputElement).value);
       const loc = (document.getElementById('edit-loc-input') as HTMLInputElement).value;
       const minStockInput = document.getElementById('edit-min-stock-input') as HTMLInputElement;
       const minStock = minStockInput && minStockInput.value ? parseInt(minStockInput.value) : 0;
       
       const originalText = btn.innerText;
       btn.innerText = 'Kaydediliyor...';
       btn.disabled = true;
       
       try {
         await warehouseService.updateMaterial(currentWarehouse.id, id, {
           sapNo: sap, name, quantity: qty, location: loc, minStock: minStock || 0
         } as any);

         const imgInput = document.getElementById('edit-img-input') as HTMLInputElement;
         if (imgInput && imgInput.files && imgInput.files.length > 0) {
            const file = imgInput.files[0];
            const path = `inventory/${currentWarehouse.id}/${id}_${Date.now()}`;
            
            // Arkaplanda yükleme işlemi yap, arayüzü kitleme
            ImageCompressor.compressImage(file, 800, 800, 0.7)
                .then((compressedFile: File) => fileService.uploadImage(compressedFile, path))
                .then((url: string) => {
                    return warehouseService.updateMaterialImage(currentWarehouse.id, id, url, sap).then(() => url);
                })
                .then((url: string) => {
                    console.log('Arkaplan görsel güncellemesi tamamlandı.');
                    // Kullanıcı hala aynı sayfadaysa ve resmi bekliyorsa DOM'u güncelleyebiliriz
                    const cell = document.getElementById(`img-cell-${id}`);
                    if (cell) {
                        const safeName = name.replace(/'/g, "");
                        // Sadece hücrenin içindeki resmi güncelle, ismini bozmadan
                        cell.innerHTML = `<div onclick="window.showBigImage('${url}', '${safeName}')" style="width:36px; height:36px; border-radius:6px; background-color: rgba(59, 130, 246, 0.1); border: 1px solid #3B82F6; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#3B82F6; cursor: pointer; transition: all 0.2s;" title="Görseli Büyüt" onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'; this.style.color='#3B82F6'"><i class="fa-solid fa-image"></i></div>${name}`;
                    }
                })
                .catch((err: any) => console.error('Arkaplan görsel yükleme hatası:', err))
                .finally(() => {
                    imgInput.value = '';
                });
         }

         (window as any).closeEditModal();
         // Update HTML instantly to reflect text changes (qty, name, etc)
         if ((window as any).selectWarehouseAndNavigate) {
           (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
         }
       } catch(e) { console.error(e); alert('Hata oluştu'); }
       finally { btn.innerText = originalText; btn.disabled = false; }
    };
    
    (window as any).openTransferModal = (id: string, sap: string, name: string, maxQty: number) => {
       const modal = document.getElementById('new-warehouse-transfer-modal');
       if(modal) {
         (document.getElementById('transfer-item-id') as HTMLInputElement).value = id;
         (document.getElementById('transfer-info') as HTMLElement).innerText = `${sap} - ${name} (Mevcut: ${maxQty})`;
         (document.getElementById('transfer-qty-input') as HTMLInputElement).max = maxQty.toString();
         (document.getElementById('transfer-qty-input') as HTMLInputElement).value = '1';
         modal.style.display = 'flex';
       }
    };
    
    (window as any).closeTransferModal = () => {
       const modal = document.getElementById('new-warehouse-transfer-modal');
       if(modal) modal.style.display = 'none';
    };
    
    (window as any).saveTransferItem = async (btn: HTMLButtonElement) => {
       const id = (document.getElementById('transfer-item-id') as HTMLInputElement).value;
       const targetId = (document.getElementById('transfer-target-input') as HTMLSelectElement).value;
       const qty = parseInt((document.getElementById('transfer-qty-input') as HTMLInputElement).value);
       
       if(!targetId || isNaN(qty) || qty <= 0) {
         alert('Lütfen geçerli bir hedef depo ve miktar girin.');
         return;
       }
       
       const originalText = btn.innerText;
       btn.innerText = 'Transfer Ediliyor...';
       btn.disabled = true;
       
       try {
         const userStr = localStorage.getItem('user');
         let user = 'Bilinmeyen Kullanıcı';
         if(userStr) {
            try { user = JSON.parse(userStr).name || user; } catch(e){}
         }
         await warehouseService.transferMaterial(currentWarehouse.id, targetId, id, qty, user);
         (window as any).closeTransferModal();
         if ((window as any).selectWarehouseAndNavigate) {
           (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
         }
       } catch(e) { console.error(e); alert('Transfer sırasında hata oluştu: ' + (e as Error).message); }
       finally { btn.innerText = originalText; btn.disabled = false; }
    };
    
    (window as any).openHistoryModal = async (id: string, name: string) => {
       const modal = document.getElementById('new-warehouse-history-modal');
       if(modal) {
         (document.getElementById('history-title') as HTMLElement).innerText = `Geçmiş: ${name}`;
         const list = document.getElementById('history-list');
         if(list) list.innerHTML = '<div style="text-align:center; padding:1rem;">Yükleniyor...</div>';
         modal.style.display = 'flex';
         
         try {
           const logs = await warehouseService.getLogs(currentWarehouse.id);
           const itemLogs = logs.filter(l => l.itemId === id).sort((a,b:any) => ((b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
           if(list) {
             if(itemLogs.length === 0) {
               list.innerHTML = '<div style="text-align:center; padding:1rem; color:#94A3B8;">Geçmiş kayıt bulunamadı.</div>';
             } else {
               list.innerHTML = itemLogs.map(l => {
                 const date = l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000).toLocaleString('tr-TR') : '-';
                 let typeColor = '#94A3B8';
                 let typeText: string = l.type;
                 if(l.type === 'ADD') { typeColor = '#10B981'; typeText = 'Ekleme'; }
                 if(l.type === 'REMOVE') { typeColor = '#EF4444'; typeText = 'Çıkarma'; }
                 if(l.type === 'TRANSFER') { typeColor = '#3B82F6'; typeText = 'Transfer'; }
                 if(l.type === 'UPDATE') { typeColor = '#F59E0B'; typeText = 'Güncelleme'; }
                 return `
                   <div style="padding:0.75rem; border-bottom:1px solid #1E293B; font-size:0.85rem;">
                     <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                       <span style="color:${typeColor}; font-weight:600;">${typeText} (${l.quantity > 0 ? '+'+l.quantity : l.quantity})</span>
                       <span style="color:#64748B;">${date}</span>
                     </div>
                     <div style="color:#E2E8F0; margin-bottom:0.25rem;">${l.user || 'Sistem'}</div>
                     <div style="color:#94A3B8; font-size:0.8rem;">${l.note || ''}</div>
                   </div>
                 `;
               }).join('');
             }
           }
         } catch(e) {
           console.error(e);
           if(list) list.innerHTML = '<div style="text-align:center; padding:1rem; color:#EF4444;">Yüklenirken hata oluştu.</div>';
         }
       }
    };
    
    (window as any).closeHistoryModal = () => {
       const modal = document.getElementById('new-warehouse-history-modal');
       if(modal) modal.style.display = 'none';
    };

    (window as any).filterInventory = () => {
      const searchInput = document.getElementById('inventory-search-input') as HTMLInputElement;
      if (!searchInput) return;
      const term = searchInput.value.toLowerCase().trim();
      
      const rows = document.querySelectorAll('.inventory-row');
      rows.forEach((row: any) => {
        const sap = row.getAttribute('data-sap') || '';
        const name = row.getAttribute('data-name') || '';
        
        if (term === '' || sap.includes(term) || name.includes(term)) {
          row.style.display = '';
        } else {
          row.style.display = 'none';
        }
      });
    };

    (window as any).switchTab = async (tabName: string, id: string) => {
      const tabs = ['tab-ENVANTER', 'tab-ANALİZ', 'tab-SAYIM', 'tab-SAYIM_GECMISI'];
      const views = ['view-ENVANTER', 'view-ANALİZ', 'view-SAYIM', 'view-SAYIM_GECMISI'];
      
      tabs.forEach(t => {
        const el = document.getElementById(t);
        if (el) {
          if (t === id) {
            el.dataset.active = 'true';
            el.style.color = '#14F195';
            el.style.border = '1px solid #14F195';
          } else {
            el.dataset.active = 'false';
            el.style.color = '#94A3B8';
            el.style.border = '1px solid transparent';
          }
        }
      });

      views.forEach(v => {
        const el = document.getElementById(v);
        if (el) {
          if (v === 'view-' + tabName) {
            el.style.display = 'block';
          } else {
            el.style.display = 'none';
          }
        }
      });
      
      const actionBar = document.getElementById('inventory-action-bar');
      if (actionBar) {
        actionBar.style.display = (tabName === 'ENVANTER') ? 'flex' : 'none';
      }

      (window as any).currentWarehouseTab = tabName === 'ENVANTER' ? 'INVENTORY' : tabName;

      // Fetch audit history if needed
      if (tabName === 'SAYIM_GECMISI') {
         const container = document.getElementById('audit-history-container');
         if (container) {
           container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Yükleniyor...</div>';
           try {
             const audits = await warehouseService.getAuditHistory(currentWarehouse.id);
             (window as any).__cachedAudits = audits;
             if (audits.length === 0) {
               container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Henüz sayım geçmişi bulunmuyor.</div>';
             } else {
               container.innerHTML = audits.map(audit => {
                 const date = audit.timestamp?.seconds ? new Date(audit.timestamp.seconds * 1000).toLocaleString('tr-TR') : audit.date;
                 const diffColor = audit.totalDiff < 0 ? '#EF4444' : (audit.totalDiff > 0 ? '#F59E0B' : '#14F195');
                 const totalDiffText = audit.totalDiff > 0 ? '+' + audit.totalDiff : audit.totalDiff;
                 
                 const resultsHtml = audit.results.map(r => {
                    const isDiff = r.diff !== 0;
                    const rColor = r.diff < 0 ? '#EF4444' : (r.diff > 0 ? '#F59E0B' : '#14F195');
                    return `
                      <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5); font-size: 0.85rem; align-items: center;">
                        <span style="color: #E2E8F0; width: 40%; display: flex; align-items: center; gap: 0.5rem;">
                           <span style="background-color: rgba(59, 130, 246, 0.15); color: #60A5FA; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; border: 1px solid rgba(59, 130, 246, 0.3);">SAP: ${r.sapNo || '-'}</span>
                           <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${r.description}">${r.description}</span>
                        </span>
                        <span style="color: #94A3B8; width: 15%;">Sys: ${r.systemQty}</span>
                        <span style="color: #94A3B8; width: 15%;">Fizik: ${r.physicalQty}</span>
                        <span style="color: ${rColor}; font-weight: 600; width: 15%;">Fark: ${r.diff > 0 ? '+'+r.diff : r.diff}</span>
                        <span style="color: #64748B; width: 15%; font-style: italic;">${r.note || 'Uyumlu'}</span>
                      </div>
                    `;
                 }).join('');

                 return `
                   <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 8px; margin-bottom: 1rem; overflow: hidden;">
                     <div onclick="const content = this.nextElementSibling; const icon = this.querySelector('.fa-chevron-down, .fa-chevron-up'); if(content.style.display === 'none') { content.style.display = 'block'; icon.classList.replace('fa-chevron-down', 'fa-chevron-up'); } else { content.style.display = 'none'; icon.classList.replace('fa-chevron-up', 'fa-chevron-down'); }" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; cursor: pointer; background-color: #0F172A; border-bottom: 1px solid #1E293B; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#1E293B'" onmouseout="this.style.backgroundColor='#0F172A'">
                       <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                         <span style="font-weight: 600; color: #FFFFFF; font-size: 0.95rem;"><i class="fa-solid fa-calendar-day" style="color: #3B82F6; margin-right: 0.5rem;"></i>${date}</span>
                         <span style="color: #94A3B8; font-size: 0.8rem;"><i class="fa-solid fa-user" style="margin-right: 0.3rem;"></i>${audit.user}</span>
                       </div>
                       <div style="display: flex; align-items: center; gap: 1.5rem;">
                         <div style="display: flex; flex-direction: column; text-align: right; gap: 0.2rem;">
                           <span style="font-weight: 600; color: #E2E8F0; font-size: 0.85rem;">Kalem: ${audit.totalItems}</span>
                           <span style="font-weight: 600; color: ${diffColor}; font-size: 0.85rem;">Fark: ${totalDiffText}</span>
                         </div>
                         <button onclick="event.stopPropagation(); window.importAuditToInventory('${audit.id}')" style="background-color: rgba(59, 130, 246, 0.1); border: 1px solid #3B82F6; color: #3B82F6; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'; this.style.color='#3B82F6'">
                           <i class="fa-solid fa-file-import"></i> Aktar
                         </button>
                         <button onclick="event.stopPropagation(); window.deleteAuditRecord('${audit.id}')" style="background-color: rgba(239, 68, 68, 0.1); border: 1px solid #EF4444; color: #EF4444; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#EF4444'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(239, 68, 68, 0.1)'; this.style.color='#EF4444'">
                           <i class="fa-solid fa-trash"></i> Sil
                         </button>
                         <div style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background-color: #1E293B; border-radius: 4px;">
                           <i class="fa-solid fa-chevron-down" style="color: #94A3B8; font-size: 0.8rem; transition: transform 0.2s;"></i>
                         </div>
                       </div>
                     </div>
                     <div style="display: none; padding: 1rem; max-height: 400px; overflow-y: auto; background-color: #0A0E17;">
                        ${resultsHtml}
                     </div>
                   </div>
                 `;
               }).join('');
             }
           } catch (e) {
             container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #EF4444;">Sayım geçmişi yüklenirken hata oluştu.</div>';
           }
         }
      }
    };

    (window as any).updateManualSummaryBar = () => {
      const inputs = document.querySelectorAll('.manual-audit-input');
      let totalCounted = 0;
      let matched = 0;
      let surplus = 0;
      let deficit = 0;

      inputs.forEach((input: any) => {
        if (input.value !== '') {
          totalCounted++;
          const physicalQty = parseFloat(input.value);
          const systemQty = parseFloat(input.dataset.sysqty);
          const diff = physicalQty - systemQty;
          
          if (diff === 0) matched++;
          else if (diff > 0) surplus++;
          else if (diff < 0) deficit++;
        }
      });

      const bar = document.getElementById('manual-summary-bar');
      if (bar) {
        if (totalCounted > 0) {
          bar.innerHTML = `
            <span style="color: #94A3B8; font-weight: 500; margin-right: 1rem;"><i class="fa-solid fa-list-check"></i> ${totalCounted} Ürün Sayıldı</span>
            <span style="color: #14F195; font-weight: 600; margin-right: 1rem;"><i class="fa-solid fa-check"></i> ${matched} Uyumlu</span>
            <span style="color: #F59E0B; font-weight: 600; margin-right: 1rem;"><i class="fa-solid fa-arrow-trend-up"></i> ${surplus} Fazla</span>
            <span style="color: #EF4444; font-weight: 600;"><i class="fa-solid fa-arrow-trend-down"></i> ${deficit} Eksik</span>
          `;
          bar.style.display = 'flex';
        } else {
          bar.style.display = 'none';
        }
      }
    };

    (window as any).saveManualAudit = async (btn: HTMLButtonElement) => {
      const inputs = document.querySelectorAll('.manual-audit-input');
      const manualResults: any[] = [];
      const shelfUpdates: any[] = [];
      let hasError = false;

      inputs.forEach((input: any) => {
        const itemId = input.dataset.id;
        const sapNo = input.dataset.sap;
        const name = input.dataset.name;
        const systemQty = parseFloat(input.dataset.sysqty);
        
        const shelfInput = document.getElementById('manual-shelf-' + itemId) as HTMLInputElement;
        const shelfVal = shelfInput ? shelfInput.value.trim() : '';
        const originalShelf = shelfInput ? (shelfInput.dataset.original || '').trim() : '';

        if (shelfVal !== originalShelf) {
           shelfUpdates.push({ itemId, shelfNo: shelfVal });
        }
        
        if (input.value !== '') {
          const physicalQty = parseFloat(input.value);
          const diff = physicalQty - systemQty;
          
          if (diff !== 0) {
            const noteInput = document.getElementById('manual-note-' + itemId) as HTMLInputElement;
            if (!noteInput.value.trim()) {
              noteInput.style.border = '1px solid #EF4444';
              hasError = true;
            } else {
              noteInput.style.border = '1px solid #334155';
              manualResults.push({
                itemId, sapNo, description: name, systemQty, physicalQty, diff, note: noteInput.value.trim()
              });
            }
          } else {
            manualResults.push({
               itemId, sapNo, description: name, systemQty, physicalQty, diff, note: 'Sayım Uyumlu'
            });
          }
        }
      });

      if (hasError) {
        alert('Lütfen stoğu değişen ürünler için zorunlu fark açıklamasını (not) doldurun.');
        return;
      }

      if (manualResults.length === 0 && shelfUpdates.length === 0) {
        alert('Herhangi bir sayım girişi veya konum değişikliği yapılmadı.');
        return;
      }

      let confirmMessage = '';
      if (manualResults.length > 0 && shelfUpdates.length > 0) {
          confirmMessage = `${manualResults.length} adet malzemenin sayım sonucunu ve ${shelfUpdates.length} adet konum değişikliğini kaydetmek istediğinize emin misiniz?`;
      } else if (manualResults.length > 0) {
          confirmMessage = `${manualResults.length} adet malzemenin sayım sonucunu kaydetmek istediğinize emin misiniz?`;
      } else {
          confirmMessage = `${shelfUpdates.length} adet konum değişikliğini kaydetmek istediğinize emin misiniz?`;
      }

      if (!confirm(confirmMessage)) return;

      const originalText = btn.innerText;
      btn.innerText = 'Kaydediliyor...';
      btn.disabled = true;

      try {
        if (manualResults.length > 0) {
            const totalDiff = manualResults.reduce((sum, r) => sum + r.diff, 0);
            const userStr = localStorage.getItem('user');
            const user = userStr ? JSON.parse(userStr).name || JSON.parse(userStr).email : 'Bilinmeyen Kullanıcı';
            
            await warehouseService.saveAudit(currentWarehouse.id, {
              user: user,
              totalItems: manualResults.length,
              totalDiff: totalDiff,
              results: manualResults
            });
        }

        for (const update of shelfUpdates) {
            await warehouseService.updateMaterial(currentWarehouse.id, update.itemId, { shelfNo: update.shelfNo });
        }

        localStorage.removeItem(`draft_audit_${currentWarehouse.id}`);

        alert('Değişiklikler başarıyla kaydedildi!');
        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
        }
      } catch (err) {
        console.error(err);
        alert('Kaydedilirken hata oluştu.');
        btn.innerText = originalText;
        btn.disabled = false;
      }
    };

    (window as any).importAuditToInventory = async (auditId: string) => {
      if(!confirm('Bu sayım geçmişindeki ürünleri mevcut envantere direkt eklemek istediğinize emin misiniz? (Envanterde varsa güncellenir, yoksa yeni eklenir)')) return;
      
      const audit = (window as any).__cachedAudits?.find((a: any) => a.id === auditId);
      if(!audit) return;
      
      try {
        let addedCount = 0;
        let updatedCount = 0;
        
        for (const res of audit.results) {
           const existingItem = inventoryItems.find((i: any) => i.sapNo === res.sapNo || (i.sapNo === '' && i.name === res.description));
           if (existingItem) {
              await warehouseService.updateMaterial(currentWarehouse.id, existingItem.id, { quantity: res.physicalQty });
              updatedCount++;
           } else {
              await warehouseService.addMaterial(currentWarehouse.id, {
                 sapNo: res.sapNo || '',
                 description: res.description || 'Bilinmeyen Malzeme',
                 quantity: res.physicalQty,
                 shelfNo: 'Tanımsız'
              });
              addedCount++;
           }
        }
        
        alert(`Aktarım başarılı! ${addedCount} yeni ürün eklendi, ${updatedCount} ürün güncellendi.`);
        if ((window as any).selectWarehouseAndNavigate) {
            (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
        }
      } catch (err) {
        console.error(err);
        alert('Aktarım sırasında hata oluştu.');
      }
    };

    (window as any).handleExcelUpload = async (event: any) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const wipeExisting = confirm('Excel yüklenmeden önce bu deponun mevcut envanteri TAMAMEN silinsin mi? (Bu işlem geri alınamaz!) \\n\\nİptal derseniz silinmeden üstüne eklenir.');
      
      try {
        const btn = document.getElementById('btn-upload-excel');
        if(btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...'; btn.style.pointerEvents = 'none'; }

        const items = await excelService.parseExcel(file);
        
        if (wipeExisting) {
            const deletePromises = inventoryItems.map(i => warehouseService.deleteMaterial(currentWarehouse.id, i.id));
            await Promise.all(deletePromises);
        }

        let addedCount = 0;
        const totalItems = items.length;
        for (let i = 0; i < totalItems; i++) {
           const item = items[i];
           if (!item.description && !item.sapNo) continue; // Skip empty rows
           await warehouseService.addMaterial(currentWarehouse.id, {
             sapNo: String(item.sapNo || '').trim(),
             description: String(item.description || '').trim() || 'Bilinmeyen Malzeme',
             quantity: Number(item.quantity) || 0,
             shelfNo: String(item.shelfNo || '').trim() || 'Tanımsız'
           });
           addedCount++;
           
           if (btn) {
               const percentage = Math.round(((i + 1) / totalItems) * 100);
               btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> %${percentage} Yükleniyor...`;
           }
        }

        alert(`Başarıyla ${addedCount} ürün yüklendi!`);
        if ((window as any).selectWarehouseAndNavigate) {
            (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
        }
      } catch (err) {
        console.error(err);
        alert('Excel yüklenirken hata oluştu. Lütfen Excel formatınızın doğru olduğundan emin olun (Sütunlar: SAP NO, AÇIKLAMA, ADET, RAF NO).');
        const btn = document.getElementById('btn-upload-excel');
        if(btn) { btn.innerHTML = '<i class="fa-solid fa-upload"></i> Yükle'; btn.style.pointerEvents = 'auto'; }
      }
      event.target.value = ''; // Reset file input
    };

    (window as any).deleteAuditRecord = async (auditId: string) => {
       if (!confirm('Bu sayım geçmişi kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
       try {
          await warehouseService.deleteAudit(currentWarehouse.id, auditId);
          alert('Sayım geçmişi başarıyla silindi.');
          if ((window as any).selectWarehouseAndNavigate) {
              (window as any).selectWarehouseAndNavigate(currentWarehouse.id, 'SAYIM_GECMISI');
          }
       } catch (err) {
          console.error(err);
          alert('Silinirken hata oluştu.');
       }
    };
    
    (window as any).saveDraftAudit = () => {
       const inputs = document.querySelectorAll('.manual-audit-input');
       const draft: any = {};
       inputs.forEach((input: any) => {
         const itemId = input.dataset.id;
         const shelfInput = document.getElementById('manual-shelf-' + itemId) as HTMLInputElement;
         const shelfVal = shelfInput ? shelfInput.value : '';
         const originalShelf = shelfInput ? shelfInput.dataset.original : '';
         
         if (input.value !== '' || (shelfVal !== originalShelf)) {
           const noteInput = document.getElementById('manual-note-' + itemId) as HTMLInputElement;
           draft[itemId] = { 
               qty: input.value, 
               note: noteInput ? noteInput.value : '', 
               shelf: shelfVal 
           };
         }
       });
       localStorage.setItem(`draft_audit_${currentWarehouse.id}`, JSON.stringify(draft));
    };

    (window as any).filterManualAudit = (query: string) => {
       const q = query.toLowerCase();
       const rows = document.querySelectorAll('.manual-audit-row');
       rows.forEach((row: any) => {
         const sap = row.dataset.sap || '';
         const name = row.dataset.name || '';
         if (sap.includes(q) || name.includes(q)) {
           row.style.display = '';
         } else {
           row.style.display = 'none';
         }
       });
    };

    (window as any).clearDraftAudit = () => {
       if(confirm('Mevcut sayım taslağını tamamen silip sıfırdan başlamak istediğinize emin misiniz?')) {
          localStorage.removeItem(`draft_audit_${currentWarehouse.id}`);
          if ((window as any).selectWarehouseAndNavigate) {
            (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
          }
       }
    };

    (window as any).onManualQtyChange = (inputId: string, noteId: string, sysQty: number) => {
      const input = document.getElementById(inputId) as HTMLInputElement;
      const noteInput = document.getElementById(noteId) as HTMLInputElement;
      if (!input || !noteInput) return;
      
      const val = parseFloat(input.value);
      if (!isNaN(val) && val !== sysQty) {
        noteInput.style.display = 'block';
      } else {
        noteInput.style.display = 'none';
        noteInput.value = '';
      }
      
      if ((window as any).updateManualSummaryBar) {
        (window as any).updateManualSummaryBar();
      }
      if ((window as any).saveDraftAudit) {
        (window as any).saveDraftAudit();
      }
    };
  };

  // Wait a tiny bit for DOM to render, then init logic
  setTimeout(() => { 
    if((window as any).initNewWarehouseLogic) (window as any).initNewWarehouseLogic();
    if((window as any).updateManualSummaryBar) (window as any).updateManualSummaryBar();
  }, 100);

  // Load draft data for manual audit
  const draftKey = `draft_audit_${currentWarehouse.id}`;
  const draftStr = localStorage.getItem(draftKey);
  const draftData = draftStr ? JSON.parse(draftStr) : {};

  return `
    <div style="background-color: #0A0E17; min-height: 100vh; color: #E2E8F0; font-family: 'Inter', sans-serif; padding: 2rem; box-sizing: border-box; position: relative;">
      
      <!-- Header Section -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <div>
          <h1 style="font-size: 1.5rem; font-weight: 600; color: #FFFFFF; margin: 0;">${warehouseName}</h1>
          <div style="font-size: 0.85rem; color: #64748B; margin-top: 0.25rem;">Stok ve Envanter Sistemi</div>
        </div>
        <div id="inventory-action-bar" style="display: ${currentTab === 'INVENTORY' ? 'flex' : 'none'}; gap: 0.75rem; align-items: center;">
          <input 
            id="inventory-search-input"
            oninput="window.filterInventory()"
            type="text" 
            placeholder="Parça adı veya SAP numarası..." 
            style="height: 42px; background-color: #111827; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; width: 280px; outline: none; transition: all 0.2s;"
          />
          <button onclick="window.startFastAudit()" style="height: 42px; padding: 0 1rem; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.9rem; font-weight: 600; cursor: pointer;">
            <i class="fa-solid fa-bolt"></i> Hızlı Sayım
          </button>
          <button onclick="window.startQRScanner()" style="height: 42px; padding: 0 1rem; border-radius: 8px; border: 1px solid #1E293B; background-color: #111827; color: #E2E8F0; font-size: 0.9rem; font-weight: 500; cursor: pointer;">
            <i class="fa-solid fa-qrcode"></i> QR Tara
          </button>
          <button onclick="window.downloadInventoryExcel()" style="height: 42px; padding: 0 1rem; border-radius: 8px; border: 1px solid #1E293B; background-color: #111827; color: #E2E8F0; font-size: 0.9rem; font-weight: 500; cursor: pointer;">
            <i class="fa-solid fa-download"></i> İndir
          </button>
          <input type="file" id="excel-upload-input" accept=".xlsx, .xls" style="display: none;" onchange="window.handleExcelUpload(event)" />
          <button id="btn-upload-excel" onclick="document.getElementById('excel-upload-input').click()" style="height: 42px; padding: 0 1rem; border-radius: 8px; border: 1px solid #1E293B; background-color: #111827; color: #E2E8F0; font-size: 0.9rem; font-weight: 500; cursor: pointer;">
            <i class="fa-solid fa-upload"></i> Yükle
          </button>
          <button onclick="window.openAddNewModal()" style="height: 42px; padding: 0 1rem; border-radius: 8px; border: none; background-color: #FFFFFF; color: #000000; font-size: 0.9rem; font-weight: 600; cursor: pointer;">
            + Yeni Ekle
          </button>
        </div>
      </div>

      <!-- Add New Modal -->
      <div id="add-new-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(10, 14, 23, 0.8); z-index: 1000; justify-content: center; align-items: center; backdrop-filter: blur(4px);">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; width: 500px; padding: 2rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h2 style="margin: 0; font-size: 1.25rem; color: #FFF;">Yeni Malzeme Ekle</h2>
            <i class="fa-solid fa-times" onclick="window.closeAddNewModal()" style="cursor: pointer; color: #64748B; font-size: 1.25rem;"></i>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">SAP Numarası (Otomatik Aranır)</label>
              <input id="new-sap-input" type="text" autocomplete="off" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #14F195; padding: 0 1rem; font-size: 1rem; outline: none; font-weight: 600;" placeholder="Örn: 32">
            </div>
            
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Malzeme Tanımı</label>
              <input id="new-name-input" type="text" style="width: 100%; height: 42px; background-color: rgba(10, 14, 23, 0.5); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;" placeholder="Sözlükten bulunacak...">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Miktar</label>
                <input id="new-qty-input" type="number" min="0" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;" placeholder="0">
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Birim</label>
                <select id="new-unit-input" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; appearance: none;">
                  <option value="Adet">Adet</option>
                  <option value="Kutu">Kutu</option>
                  <option value="Litre">Litre</option>
                  <option value="Set">Set</option>
                </select>
              </div>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Raf Konumu</label>
              <input id="new-loc-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;" placeholder="Örn: A-12">
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #14F195; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;"><i class="fa-solid fa-image" style="margin-right:0.25rem;"></i> Malzeme Görseli</label>
              <div 
                onclick="document.getElementById('new-img-input').click()" 
                style="width: 100%; height: 160px; background-color: #0A0E17; border: 1px dashed #334155; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;"
                onmouseover="this.style.borderColor='#14F195'; this.style.backgroundColor='#0d131f';"
                onmouseout="this.style.borderColor='#334155'; this.style.backgroundColor='#0A0E17';"
              >
                <i class="fa-solid fa-camera" style="font-size: 2.5rem; color: #475569; margin-bottom: 0.75rem; transition: color 0.2s;"></i>
                <div id="new-img-label" style="color: #94A3B8; font-size: 0.9rem; font-weight: 500;">Görsel Yükle</div>
                <input id="new-img-input" type="file" accept="image/*" style="display: none;" onchange="document.getElementById('new-img-label').innerText = this.files[0] ? this.files[0].name : 'Görsel Yükle'; document.getElementById('new-img-label').style.color = this.files[0] ? '#14F195' : '#94A3B8'; if(this.files[0]) this.previousElementSibling.previousElementSibling.style.color = '#14F195'; else this.previousElementSibling.previousElementSibling.style.color = '#475569';">
              </div>
            </div>

            <button onclick="window.saveNewItem(this)" style="height: 42px; margin-top: 0.5rem; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.95rem; font-weight: 600; cursor: pointer; width: 100%;">
              Malzemeyi Kaydet
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs Section -->
      <div style="display: flex; gap: 1rem; border-bottom: 1px solid #1E293B; margin-bottom: 2rem; padding-bottom: 0.5rem; overflow-x: auto;">
        <div onclick="window.switchTab('ENVANTER', 'tab-ENVANTER')" id="tab-ENVANTER" data-active="${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? 'true' : 'false'}" style="padding: 0.5rem 1rem; color: ${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? '#14F195' : 'transparent'}; border-radius: 8px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;">
          <i class="fa-solid fa-layer-group"></i> ENVANTER
        </div>
        <div onclick="window.switchTab('ANALİZ', 'tab-ANALİZ')" id="tab-ANALİZ" data-active="${currentTab === 'ANALİZ' ? 'true' : 'false'}" style="padding: 0.5rem 1rem; color: ${currentTab === 'ANALİZ' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'ANALİZ' ? '#14F195' : 'transparent'}; border-radius: 8px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
          <i class="fa-solid fa-chart-line"></i> ANALİZ
        </div>
        <div onclick="window.switchTab('SAYIM', 'tab-SAYIM')" id="tab-SAYIM" data-active="${currentTab === 'SAYIM' ? 'true' : 'false'}" style="padding: 0.5rem 1rem; color: ${currentTab === 'SAYIM' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'SAYIM' ? '#14F195' : 'transparent'}; border-radius: 8px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
          <i class="fa-solid fa-clipboard-check"></i> SAYIM
        </div>
        <div onclick="window.switchTab('SAYIM_GECMISI', 'tab-SAYIM_GECMISI')" id="tab-SAYIM_GECMISI" data-active="${currentTab === 'SAYIM_GECMISI' ? 'true' : 'false'}" style="padding: 0.5rem 1rem; color: ${currentTab === 'SAYIM_GECMISI' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'SAYIM_GECMISI' ? '#14F195' : 'transparent'}; border-radius: 8px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
          <i class="fa-solid fa-file-invoice"></i> SAYIM GEÇMİŞİ
        </div>
      </div>

      <div id="view-ENVANTER" style="display: ${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? 'block' : 'none'};">
      <!-- Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 2rem;">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;">
          <div style="font-size: 0.8rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em;">Toplam Kalem</div>
          <div style="font-size: 1.75rem; font-weight: 700; color: #FFFFFF;">${inventoryItems.length}</div>
        </div>
        <div style="background-color: #111827; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;">
          <div style="font-size: 0.8rem; color: #EF4444; text-transform: uppercase; letter-spacing: 0.05em;">Kritik Stok</div>
          <div style="font-size: 1.75rem; font-weight: 700; color: #EF4444;">${inventoryItems.filter(i => i.quantity <= (i.minStock || 0)).length}</div>
        </div>
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;">
          <div style="font-size: 0.8rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em;">Son İşlemler</div>
          <div style="font-size: 1.75rem; font-weight: 700; color: #FFFFFF;">45</div>
        </div>
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;">
          <div style="font-size: 0.8rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em;">Son Hareket</div>
          <div style="font-size: 1.75rem; font-weight: 700; color: #FFFFFF;">10 Dk Önce</div>
        </div>
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem;">
          <div style="font-size: 0.8rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em;">Depo Durumu</div>
          <div style="font-size: 1.75rem; font-weight: 700; color: #14F195;">Çevrimiçi</div>
        </div>
      </div>

      <!-- AI Analytics Banner -->
      <div style="background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 12px; padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <div style="color: #FCA5A5; font-size: 0.9rem; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-triangle-exclamation"></i>
          Envanter Analitiği (AI): Önümüzdeki 30 gün içinde 12 kalemde stok tükenme riski tespit edildi. <span style="color: #EF4444; font-weight: bold; margin-left: 10px;">(Bu modül şu an güncelleme aşamasındadır ve aktif değildir.)</span>
        </div>
        <button onclick="alert('Bu modül şu an güncelleme aşamasındadır ve aktif değildir.')" style="height: 42px; padding: 0 1rem; border-radius: 8px; border: none; background-color: #EF4444; color: #FFFFFF; font-size: 0.9rem; font-weight: 600; cursor: not-allowed; opacity: 0.7;">
          Sipariş Oluştur
        </button>
      </div>

      <!-- Inventory Table -->
      <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr>
              <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase; width: 40px;"><input type="checkbox" /></th>
              <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">SAP No</th>
              <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Malzeme Tanımı</th>
              <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Stok</th>
              <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Rezerve</th>
              <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Konum</th>
              <th style="padding: 1rem; text-align: right; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Aksiyonlar</th>
            </tr>
          </thead>
          <tbody>
            ${inventoryWithQRs.length === 0 ? `
              <tr><td colspan="7" style="padding: 2rem; text-align: center; color: #94A3B8;">Henüz malzeme eklenmemiş.</td></tr>
            ` : [...inventoryWithQRs].sort((a, b) => {
              const locA = String(a.shelfNo || '').trim().toUpperCase();
              const locB = String(b.shelfNo || '').trim().toUpperCase();
              if (!locA && locB) return 1;
              if (locA && !locB) return -1;
              let locCmp = 0;
              if (locA && locB) {
                  locCmp = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
              }
              if (locCmp !== 0) return locCmp;
              const sapA = String(a.sapNo || '').trim();
              const sapB = String(b.sapNo || '').trim();
              if (sapA && sapB) {
                  const sapCmp = sapA.localeCompare(sapB, undefined, { numeric: true });
                  if (sapCmp !== 0) return sapCmp;
              }
              return String(a.name || '').localeCompare(String(b.name || ''));
            }).map(item => {
              const kritik = (item.minStock || 0);
              const rezerve = (item.reserved || 0);
              const isKritik = item.quantity <= kritik;
              return `
              <tr class="inventory-row" data-sap="${item.sapNo}" data-name="${item.name.toLowerCase()}">
                <td style="padding: 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5);"><input type="checkbox" /></td>
                <td style="padding: 1rem; color: #94A3B8; border-bottom: 1px solid rgba(30, 41, 59, 0.5); font-weight: 600;">${item.sapNo}</td>
                <td id="img-cell-${item.id}" style="padding: 1rem; color: #E2E8F0; border-bottom: 1px solid rgba(30, 41, 59, 0.5); font-weight: 500; display: flex; align-items: center;">
                  ${item.qrDataUrl ? `<div onclick="window.showBigQR('${item.qrDataUrl}', '${item.name.replace(/'/g, "")}')" style="width:36px; height:36px; border-radius:6px; background-color: #111827; border: 1px solid #1E293B; margin-right:8px; display:flex; align-items:center; justify-content:center; color:#14F195; cursor: pointer; transition: all 0.2s;" title="Büyük QR Gör" onmouseover="this.style.backgroundColor='#1E293B'" onmouseout="this.style.backgroundColor='#111827'"><i class="fa-solid fa-qrcode"></i></div>` : ''}
                  ${item.imageUrl 
                    ? `<div onclick="window.showBigImage('${item.imageUrl}', '${item.name.replace(/'/g, "")}')" style="width:36px; height:36px; border-radius:6px; background-color: rgba(59, 130, 246, 0.1); border: 1px solid #3B82F6; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#3B82F6; cursor: pointer; transition: all 0.2s;" title="Görseli Büyüt" onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'; this.style.color='#3B82F6'"><i class="fa-solid fa-image"></i></div>` 
                    : `<div onclick="window.triggerImageUpload('${item.id}', '${item.sapNo}')" style="width:36px; height:36px; border-radius:6px; background-color: #1E293B; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#64748B; cursor: pointer; transition: all 0.2s;" title="Görsel Ekle" onmouseover="this.style.backgroundColor='#334155'" onmouseout="this.style.backgroundColor='#1E293B'"><i class="fa-solid fa-image"></i></div>`
                  }
                  ${item.name}
                </td>
                <td style="padding: 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
                  <span style="background-color: ${isKritik ? 'rgba(239, 68, 68, 0.1)' : 'rgba(20, 241, 149, 0.1)'}; color: ${isKritik ? '#EF4444' : '#14F195'}; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
                    ${item.quantity} Adet
                  </span>
                </td>
                <td style="padding: 1rem; color: ${rezerve > 0 ? '#F59E0B' : '#94A3B8'}; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
                  ${rezerve}
                </td>
                <td style="padding: 1rem; color: #94A3B8; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">${item.shelfNo || '-'}</td>
                <td style="padding: 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5); text-align: right; white-space: nowrap;">
                  <i onclick="window.openHistoryModal('${item.id}', '${item.name.replace(/'/g, '\\\'')}')" class="fa-solid fa-clock-rotate-left" style="cursor: pointer; opacity: 0.7; color: #3B82F6; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Geçmiş"></i>
                  <i onclick="window.openTransferModal('${item.id}', '${item.sapNo}', '${item.name.replace(/'/g, '\\\'')}', ${item.quantity})" class="fa-solid fa-truck-fast" style="cursor: pointer; opacity: 0.7; color: #F59E0B; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Transfer Et"></i>
                  <i onclick="window.openEditModal('${item.id}', '${item.sapNo}', '${item.name.replace(/'/g, '\\\'')}', ${item.quantity}, '${item.shelfNo || ''}', '${item.imageUrl || ''}', ${item.minStock || 0})" class="fa-solid fa-pen" style="cursor: pointer; opacity: 0.7; color: #E2E8F0; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Düzenle"></i>
                  <i onclick="window.deleteItem('${item.id}', '${item.name.replace(/'/g, '\\\'')}')" class="fa-solid fa-trash" style="cursor: pointer; opacity: 0.7; color: #EF4444; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Sil"></i>
                </td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </div>
      </div> <!-- End of view-ENVANTER -->

      <!-- ANALİZ View -->
      <div id="view-ANALİZ" style="display: ${currentTab === 'ANALİZ' ? 'block' : 'none'};">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <h2 style="color: #FFFFFF; margin: 0; font-size: 1.25rem;">Türbin Bazlı Malzeme Tüketim Analizi</h2>
              <div style="color: #94A3B8; font-size: 0.9rem;">Bu sahaya ait servis raporlarında takılan ve sökülen malzemeler türbin bazında listelenmektedir.</div>
              <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                <input type="text" id="warehouse-analytics-sap" class="cyber-input" style="padding: 8px 12px; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(20, 241, 149, 0.3); border-radius: 6px; color: #14F195; width: 250px; font-weight: 600; outline: none;" placeholder="SAP Kodu veya Malzeme Adı..." value="${localStorage.getItem('warehouse_analytics_sap') || ''}" onkeypress="if(event.key==='Enter') window.setWarehouseAnalyticsSap(this.value)">
                <button onclick="window.setWarehouseAnalyticsSap(document.getElementById('warehouse-analytics-sap').value)" style="padding: 8px 16px; border-radius: 6px; cursor: pointer; background: rgba(20, 241, 149, 0.1); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); font-weight: bold; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.background='rgba(20, 241, 149, 0.2)'" onmouseout="this.style.background='rgba(20, 241, 149, 0.1)'">
                  <i class="fa-solid fa-search"></i> Filtrele
                </button>
              </div>
            </div>
            
            <div class="filter-group" style="display: flex; align-items: center; flex-wrap: wrap; background: rgba(255,255,255,0.02); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); gap: 4px;">
              <button class="btn-filter ${currentPeriod === 'this-week' ? 'active' : ''}" onclick="window.setWarehouseAnalyticsPeriod('this-week')" style="padding: 0.5rem 1rem; border-radius: 6px; background: ${currentPeriod === 'this-week' ? '#3B82F6' : 'transparent'}; color: ${currentPeriod === 'this-week' ? '#FFF' : '#94A3B8'}; border: none; cursor: pointer;">BU HAFTA</button>
              <button class="btn-filter ${currentPeriod === 'this-month' ? 'active' : ''}" onclick="window.setWarehouseAnalyticsPeriod('this-month')" style="padding: 0.5rem 1rem; border-radius: 6px; background: ${currentPeriod === 'this-month' ? '#3B82F6' : 'transparent'}; color: ${currentPeriod === 'this-month' ? '#FFF' : '#94A3B8'}; border: none; cursor: pointer;">BU AY</button>
              <button class="btn-filter ${currentPeriod === 'last-month' ? 'active' : ''}" onclick="window.setWarehouseAnalyticsPeriod('last-month')" style="padding: 0.5rem 1rem; border-radius: 6px; background: ${currentPeriod === 'last-month' ? '#3B82F6' : 'transparent'}; color: ${currentPeriod === 'last-month' ? '#FFF' : '#94A3B8'}; border: none; cursor: pointer;">ÖNCEKİ AY</button>
              <button class="btn-filter ${currentPeriod === 'this-year' ? 'active' : ''}" onclick="window.setWarehouseAnalyticsPeriod('this-year')" style="padding: 0.5rem 1rem; border-radius: 6px; background: ${currentPeriod === 'this-year' ? '#3B82F6' : 'transparent'}; color: ${currentPeriod === 'this-year' ? '#FFF' : '#94A3B8'}; border: none; cursor: pointer;">BU YIL</button>
              <button class="btn-filter ${currentPeriod === 'all' ? 'active' : ''}" onclick="window.setWarehouseAnalyticsPeriod('all')" style="padding: 0.5rem 1rem; border-radius: 6px; background: ${currentPeriod === 'all' ? '#3B82F6' : 'transparent'}; color: ${currentPeriod === 'all' ? '#FFF' : '#94A3B8'}; border: none; cursor: pointer;">TÜMÜ</button>
              

              
              <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
              
              <input type="date" id="warehouse-analytics-start" class="cyber-input" style="padding: 4px 8px; font-size: 0.75rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #FFF;" value="${localStorage.getItem('warehouse_analytics_start') || ''}">
              <span style="color: #94A3B8; font-size: 0.8rem;">-</span>
              <input type="date" id="warehouse-analytics-end" class="cyber-input" style="padding: 4px 8px; font-size: 0.75rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #FFF;" value="${localStorage.getItem('warehouse_analytics_end') || ''}">
              <button onclick="window.setCustomWarehouseAnalyticsPeriod()" style="padding: 4px 12px; border-radius: 4px; background: ${currentPeriod === 'custom' ? '#3B82F6' : 'transparent'}; color: ${currentPeriod === 'custom' ? '#FFF' : '#94A3B8'}; border: none; cursor: pointer;" title="Tarih aralığına göre filtrele">
                <i class="fa-solid fa-filter"></i>
              </button>
              
              <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
              
              <button onclick="window.exportTurbineAnalytics()" style="padding: 0.5rem 1rem; border-radius: 6px; background: #10B981; color: #FFF; border: none; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 0.5rem;" title="Türbin Analizini Excel Olarak İndir">
                <i class="fa-solid fa-file-excel"></i> EXCEL İNDİR
              </button>
            </div>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${sortedTurbines.length > 0 ? sortedTurbines.map(([turbineId, data], index) => `
              <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden;">
                <!-- Accordion Header -->
                <div onclick="window.toggleTurbineAccordion('turbine-acc-${index}')" style="padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                  <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 700; color: #E2E8F0; display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-chevron-down" id="turbine-acc-icon-${index}" style="transition: transform 0.3s; font-size: 0.8rem; color: #94A3B8;"></i>
                    ${turbineId}
                  </div>
                  <div style="display: flex; gap: 1rem;">
                    ${data.totalUsed > 0 ? `<span style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #4ade80; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">${data.totalUsed} Takılan</span>` : ''}
                    ${data.totalDefect > 0 ? `<span style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">${data.totalDefect} Sökülen</span>` : ''}
                  </div>
                </div>
                
                <!-- Accordion Content -->
                <div id="turbine-acc-${index}" style="display: none; padding: 0; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);">
                  <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                      <thead>
                        <tr style="background: rgba(255,255,255,0.02); color: #94A3B8;">
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Tarih</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Rapor No</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">MÇF No</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">SAP No</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Malzeme Açıklaması</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center; color: #4ade80;">Takılan</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center; color: #f87171;">Sökülen</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${data.items.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(item => `
                          <tr style="border-bottom: 1px solid rgba(255,255,255,0.02); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                            <td style="padding: 0.75rem 1rem; color: #E2E8F0;">${new Date(item.date).toLocaleDateString('tr-TR')}</td>
                            <td style="padding: 0.75rem 1rem; color: #94A3B8; font-family: monospace;">${item.reportId}</td>
                            <td style="padding: 0.75rem 1rem; color: #F59E0B; font-weight: 600;">${item.matFormNo}</td>
                            <td style="padding: 0.75rem 1rem; color: #3B82F6; font-family: monospace;">${item.sapNo}</td>
                            <td style="padding: 0.75rem 1rem; font-weight: 500; color: #E2E8F0;">${item.description}</td>
                            <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 800; color: #4ade80;">${item.used > 0 ? `+${item.used}` : '-'}</td>
                            <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 800; color: #f87171;">${item.defect > 0 ? `-${item.defect}` : '-'}</td>
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            `).join('') : '<div style="text-align: center; padding: 3rem; color: #94A3B8; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">Seçili tarih aralığında bu sahada türbin bazlı malzeme tüketimi bulunamadı.</div>'}
          </div>
        </div>
      </div>

      <!-- Manual Audit View -->
      <div id="view-SAYIM" style="display: ${currentTab === 'SAYIM' ? 'block' : 'none'};">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
            <div>
              <h2 style="color: #FFFFFF; margin: 0 0 0.5rem 0; font-size: 1.25rem;">Manuel Sayım Ekranı</h2>
              <div style="color: #94A3B8; font-size: 0.9rem;">Listedeki ürünlerin fiziksel sayılarını girerek hızlıca stokları güncelleyebilirsiniz. Değişiklik olmayan sayımlar geçmişe uyumlu olarak kaydedilecektir.</div>
            </div>
            <div style="display: flex; align-items: center; gap: 1.5rem;">
              <div style="position: relative;">
                <i class="fa-solid fa-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748B;"></i>
                <input type="text" id="manual-audit-search" oninput="window.filterManualAudit(this.value)" placeholder="SAP No veya Tanım ara..." style="width: 250px; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #FFFFFF; padding: 0 1rem 0 2.5rem; outline: none; font-size: 0.9rem;" />
              </div>
              <div id="manual-summary-bar" style="display: none; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; padding: 0.5rem 1rem; font-size: 0.85rem; align-items: center;">
                <!-- Dynamically populated via updateManualSummaryBar -->
              </div>
              <button onclick="window.clearDraftAudit()" style="height: 42px; padding: 0 1rem; border-radius: 8px; border: 1px solid #1E293B; background-color: transparent; color: #EF4444; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.backgroundColor='rgba(239, 68, 68, 0.1)'" onmouseout="this.style.backgroundColor='transparent'">
                <i class="fa-solid fa-trash-can"></i> Taslağı Sil
              </button>
              <button onclick="window.saveManualAudit(this)" style="height: 42px; padding: 0 1.5rem; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.95rem; font-weight: 600; cursor: pointer;">
                <i class="fa-solid fa-save"></i> Tüm Sayımı Kaydet
              </button>
            </div>
          </div>
          
          <table id="manual-audit-table" style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
              <tr>
                <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">SAP No</th>
                <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Malzeme Tanımı</th>
                <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase; width: 150px;">Konum</th>
                <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Sistem Stoğu</th>
                <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase; width: 150px;">Fiziksel Sayım</th>
                <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase; width: 250px;">Fark Açıklaması</th>
              </tr>
            </thead>
            <tbody>
              ${inventoryItems.length === 0 ? '<tr><td colspan="6" style="padding: 2rem; text-align: center; color: #94A3B8;">Henüz malzeme eklenmemiş.</td></tr>' : ''}
              ${inventoryItems.sort((a,b) => {
                  const locA = String(a.shelfNo || '').trim().toUpperCase();
                  const locB = String(b.shelfNo || '').trim().toUpperCase();
                  if (!locA && locB) return 1;
                  if (locA && !locB) return -1;
                  let locCmp = 0;
                  if (locA && locB) {
                      locCmp = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
                  }
                  if (locCmp !== 0) return locCmp;
                  const sapA = String(a.sapNo || '').trim();
                  const sapB = String(b.sapNo || '').trim();
                  if (sapA && sapB) {
                      const sapCmp = sapA.localeCompare(sapB, undefined, { numeric: true });
                      if (sapCmp !== 0) return sapCmp;
                  }
                  return String(a.name || '').localeCompare(String(b.name || ''));
              }).map((item) => `
                <tr class="manual-audit-row" data-sap="${item.sapNo.toLowerCase()}" data-name="${item.name.toLowerCase()}">
                  <td style="padding: 1rem; color: #94A3B8; border-bottom: 1px solid rgba(30, 41, 59, 0.5); font-weight: 600;">${item.sapNo}</td>
                  <td style="padding: 1rem; color: #E2E8F0; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">${item.name}</td>
                  <td style="padding: 0.5rem 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
                    <input type="text" id="manual-shelf-${item.id}" class="manual-audit-shelf" data-id="${item.id}" data-original="${item.shelfNo || ''}" value="${draftData[item.id]?.shelf || item.shelfNo || ''}" oninput="window.saveDraftAudit()" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #334155; border-radius: 6px; color: #94A3B8; padding: 0 0.75rem; outline: none; font-size: 0.9rem;" placeholder="Raf No" />
                  </td>
                  <td style="padding: 1rem; color: #14F195; border-bottom: 1px solid rgba(30, 41, 59, 0.5); font-weight: 600;">${item.quantity} ${item.unit && item.unit !== 'undefined' && item.unit !== 'null' ? item.unit : 'Adet'}</td>
                  <td style="padding: 0.5rem 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
                    <input type="number" id="manual-qty-${item.id}" class="manual-audit-input" data-id="${item.id}" data-sap="${item.sapNo}" data-name="${item.name.replace(/"/g, '&quot;')}" data-sysqty="${item.quantity}" oninput="window.onManualQtyChange('manual-qty-${item.id}', 'manual-note-${item.id}', ${item.quantity})" value="${draftData[item.id]?.qty || ''}" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #334155; border-radius: 6px; color: #FFFFFF; padding: 0 0.75rem; outline: none; font-size: 0.9rem;" placeholder="Sayı..." />
                  </td>
                  <td style="padding: 0.5rem 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
                    <input type="text" id="manual-note-${item.id}" value="${draftData[item.id]?.note || ''}" oninput="window.saveDraftAudit()" style="display: ${draftData[item.id]?.qty && parseFloat(draftData[item.id].qty) !== item.quantity ? 'block' : 'none'}; width: 100%; height: 36px; background-color: rgba(239, 68, 68, 0.1); border: 1px solid #334155; border-radius: 6px; color: #FFFFFF; padding: 0 0.75rem; outline: none; font-size: 0.85rem;" placeholder="Zorunlu Not" />
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <!-- End of view-SAYIM -->

      <!-- Audit History View -->
      <div id="view-SAYIM_GECMISI" style="display: ${currentTab === 'SAYIM_GECMISI' ? 'block' : 'none'};">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; padding: 1.5rem;">
          <h2 style="color: #FFFFFF; margin: 0 0 0.5rem 0; font-size: 1.25rem;">Sayım Geçmişi</h2>
          <div style="color: #94A3B8; font-size: 0.9rem; margin-bottom: 1.5rem;">Geçmişte yapılan tüm QR ve Manuel sayım kayıtlarını burada inceleyebilirsiniz.</div>
          <div id="audit-history-container">
            <!-- Dynamically populated when tab is opened -->
          </div>
        </div>
      </div>
      <!-- End of view-SAYIM_GECMISI -->

      <!-- Edit Modal -->
      <div id="new-warehouse-edit-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 500px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;">Malzemeyi Düzenle</h3>
            <button onclick="window.closeEditModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="hidden" id="edit-item-id">
            
            <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="width: 100px; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                    <img id="edit-img-preview" src="" style="display: none; width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid #1E293B; background: #111827;">
                    <label for="edit-img-input" style="width: 100%; text-align: center; font-size: 0.75rem; color: #94A3B8; cursor: pointer; padding: 4px; border: 1px dashed #334155; border-radius: 6px; transition: color 0.2s;" onmouseover="this.style.color='#14F195'" onmouseout="this.style.color='#94A3B8'">
                        <i class="fa-solid fa-camera" style="margin-right: 4px;"></i> Resmi Değiştir
                    </label>
                    <input id="edit-img-input" type="file" accept="image/*" style="display: none;" onchange="
                        const file = this.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = e => {
                                const preview = document.getElementById('edit-img-preview');
                                preview.src = e.target.result;
                                preview.style.display = 'block';
                            };
                            reader.readAsDataURL(file);
                        }
                    ">
                </div>
                
                <div style="flex: 1; display: flex; flex-direction: column; gap: 1rem;">
                    <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">SAP Numarası</label>
              <input id="edit-sap-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Malzeme Tanımı</label>
              <input id="edit-name-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Miktar</label>
                <input id="edit-qty-input" type="number" min="0" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Raf Konumu</label>
                <input id="edit-loc-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
              </div>
            </div>
            
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Kritik Limit (Opsiyonel)</label>
              <input id="edit-min-stock-input" type="number" min="0" placeholder="Örn: 5" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
            </div>
            
            </div> <!-- End of inputs flex: 1 -->
            </div> <!-- End of main image+inputs flex container -->
            
            <button onclick="window.saveEditItem(this)" style="height: 42px; margin-top: 0.5rem; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.95rem; font-weight: 600; cursor: pointer; width: 100%;">Değişiklikleri Kaydet</button>
          </div>
        </div>
      </div>

      <!-- Transfer Modal -->
      <div id="new-warehouse-transfer-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 400px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;">Transfer Et</h3>
            <button onclick="window.closeTransferModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="hidden" id="transfer-item-id">
            <div id="transfer-info" style="color: #E2E8F0; font-size: 0.9rem; margin-bottom: 0.5rem;"></div>
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Hedef Depo</label>
              <select id="transfer-target-input" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; appearance: none;">
                ${allWarehouses.filter(w => w.id !== currentWarehouse.id).map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Transfer Miktarı</label>
              <input id="transfer-qty-input" type="number" min="1" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
            </div>
            <button onclick="window.saveTransferItem(this)" style="height: 42px; margin-top: 0.5rem; border-radius: 8px; border: none; background-color: #3B82F6; color: #FFFFFF; font-size: 0.95rem; font-weight: 600; cursor: pointer; width: 100%;">Transferi Başlat</button>
          </div>
        </div>
      </div>

      <!-- History Modal -->
      <div id="new-warehouse-history-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 500px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 id="history-title" style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;">Geçmiş</h3>
            <button onclick="window.closeHistoryModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div id="history-list" style="display: flex; flex-direction: column; max-height: 400px; overflow-y: auto;">
          </div>
        </div>
      </div>

      <!-- QR Scanner Modal -->
      <div id="qr-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 500px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;"><i class="fa-solid fa-qrcode" style="color: #14F195; margin-right: 8px;"></i> QR Barkod Okuyucu</h3>
            <button onclick="window.closeQRModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div id="qr-reader" style="width: 100%; margin-bottom: 1rem; border-radius: 12px; overflow: hidden; border: 2px solid #1E293B;"></div>
          <div id="qr-reader-results"></div>
        </div>
      </div>

      <!-- Big QR Display Modal -->
      <div id="big-qr-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 400px; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center;">
          <h3 id="big-qr-title" style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0 0 1.5rem 0;">Ürün QR Kodu</h3>
          <img id="big-qr-img" src="" style="width: 100%; max-width: 300px; border-radius: 8px; margin-bottom: 1.5rem; border: 4px solid #FFFFFF; background: #FFFFFF;" />
          <button onclick="window.closeBigQR()" style="width: 100%; padding: 0.75rem; border-radius: 8px; background: #3B82F6; border: none; color: white; font-weight: 600; cursor: pointer;">Kapat</button>
        </div>
      </div>

      <!-- Big Image Display Modal -->
      <div id="big-image-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.9); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 90%; max-width: 600px; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center; position: relative;">
          <button onclick="document.getElementById('big-image-modal').style.display='none'" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.5rem; transition: color 0.2s;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#64748B'"><i class="fa-solid fa-xmark"></i></button>
          <h3 id="big-image-title" style="font-size: 1.1rem; font-weight: 600; color: #E2E8F0; margin: 0 0 1.5rem 0; padding-right: 2rem; text-align: left;">Ürün Görseli</h3>
          <img id="big-image-img" src="" style="width: 100%; max-height: 60vh; object-fit: contain; border-radius: 8px; margin-bottom: 0;" />
        </div>
      </div>

      <input type="file" id="item-image-upload" accept="image/*" style="display:none;" />

    </div>
  `;
};

// Expose filter functions
(window as any).setWarehouseAnalyticsPeriod = (period: string) => {
  localStorage.setItem('warehouse_analytics_period', period);
  if ((window as any).updateWarehouseUI) {
      (window as any).updateWarehouseUI(undefined, undefined, undefined, undefined, 'ANALİZ');
  }
};

(window as any).setWarehouseAnalyticsSap = (sap: string) => {
  localStorage.setItem('warehouse_analytics_sap', sap);
  if ((window as any).updateWarehouseUI) {
      (window as any).updateWarehouseUI(undefined, undefined, undefined, undefined, 'ANALİZ');
  }
};

(window as any).setCustomWarehouseAnalyticsPeriod = () => {
  const start = (document.getElementById('warehouse-analytics-start') as HTMLInputElement)?.value;
  const end = (document.getElementById('warehouse-analytics-end') as HTMLInputElement)?.value;
  if (start && end) {
    localStorage.setItem('warehouse_analytics_start', start);
    localStorage.setItem('warehouse_analytics_end', end);
    (window as any).setWarehouseAnalyticsPeriod('custom');
  } else {
    alert('Lütfen başlangıç ve bitiş tarihlerini seçiniz.');
  }
};

(window as any).exportTurbineAnalytics = async () => {
   const data = (window as any).currentTurbineData;
   const name = (window as any).currentWarehouseName;
   const period = localStorage.getItem('warehouse_analytics_period') || 'this-month';
   if (!data || Object.keys(data).length === 0) {
      alert('Dışa aktarılacak analiz verisi bulunamadı.');
      return;
   }
   const { excelService } = await import('../services/ExcelService');
   await excelService.exportTurbineAnalytics(data, name, period);
};

(window as any).downloadInventoryExcel = async () => {
   const inventory = (window as any).currentInventoryData || [];
   const audits = (window as any).__cachedAudits || [];
   const name = (window as any).currentWarehouseName || 'Depo';
   
   if (inventory.length === 0) {
      alert('İndirilecek envanter verisi bulunamadı veya henüz yüklenmedi.');
      return;
   }
   
   const { excelService } = await import('../services/ExcelService');
   await excelService.exportToExcel(inventory, audits, name + ' Envanteri');
};

// Global toggle for UI
(window as any).toggleTurbineAccordion = (id: string) => {
  const content = document.getElementById(id);
  const icon = document.getElementById(id.replace('acc-', 'acc-icon-'));
  if (content && icon) {
    if (content.style.display === 'none') {
      content.style.display = 'block';
      icon.style.transform = 'rotate(180deg)';
    } else {
      content.style.display = 'none';
      icon.style.transform = 'rotate(0deg)';
    }
  }
};
