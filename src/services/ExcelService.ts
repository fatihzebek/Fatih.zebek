import XLSX from 'xlsx-js-style';
import type { InventoryItem, InventoryLog, AuditRecord } from './WarehouseService';
import { inventoryService } from './InventoryService';
import * as DateTimeUtils from '../utils/DateTimeUtils';

class ExcelService {
  async exportToExcel(inventory: InventoryItem[], logs: InventoryLog[], fileName: string) {
    // Sort inventory by shelf number (Raf No) first (natural numeric sorting), then SAP No, then description
    const sortedInventory = [...inventory].sort((a, b) => {
       const locA = String(a.shelfNo || '').trim().toUpperCase();
       const locB = String(b.shelfNo || '').trim().toUpperCase();
       
       // Put items with empty location at the bottom
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
       return String(a.description || '').localeCompare(String(b.description || ''));
    });

    // Sheet 1: Inventory
    const invData = sortedInventory.map(item => ({
      'SAP NO': item.sapNo,
      'AÇIKLAMA': item.description,
      'ADET': item.quantity,
      'RAF NO': item.shelfNo
    }));
    const invSheet = XLSX.utils.aoa_to_sheet([
      ['DEMİRER HOLDİNG - DEPO ENVANTER RAPORU'],
      ['Oluşturulma Tarihi:', new Date().toLocaleString('tr-TR')],
      [] // Boş satır
    ]);
    XLSX.utils.sheet_add_json(invSheet, invData, { origin: 'A4' });

    // Sütun genişlikleri ayarı
    invSheet['!cols'] = [{ wch: 15 }, { wch: 50 }, { wch: 10 }, { wch: 15 }];

    // Sheet 2: Logs
    const logData = await Promise.all(logs.map(async log => {
      // Fallback 1: Local inventory
      let sapNo = log.sapNo;
      if (!sapNo) {
        const item = inventory.find(i => i.description === log.materialName);
        if (item) sapNo = item.sapNo;
      }

      // Fallback 2: Global Master Inventory (54k items)
      if (!sapNo) {
        const results = await inventoryService.searchMaterials(log.materialName);
        const match = results.find(m => m.d === log.materialName);
        if (match) sapNo = match.n;
      }

      return {
        'TARİH': log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('tr-TR') : '',
        'SAP NO': sapNo || '---',
        'MALZEME': log.materialName,
        'İŞLEM': log.type === 'ADD' ? 'Giriş' : log.type === 'REMOVE' ? 'Çıkış' : 'Güncelleme',
        'KULLANICI': log.user,
        'MİKTAR': log.quantity,
        'TÜRBİN NO': log.turbineNo || '---',
        'SERİ NO': log.turbineSerial || '---',
        'MÇF / FORM NO': log.formNo || '---'
      };
    }));
    const logSheet = XLSX.utils.aoa_to_sheet([
      ['DEMİRER HOLDİNG - SON HAREKETLER RAPORU'],
      ['Oluşturulma Tarihi:', new Date().toLocaleString('tr-TR')],
      [] // Boş satır
    ]);
    XLSX.utils.sheet_add_json(logSheet, logData, { origin: 'A4' });
    
    // Sütun genişlikleri
    logSheet['!cols'] = [{ wch: 18 }, { wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 20 }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, invSheet, 'Mevcut Stok');
    XLSX.utils.book_append_sheet(workbook, logSheet, 'Son Hareketler');

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  }

  async exportCriticalStockToExcel(items: InventoryItem[], warehouseName: string) {
    const sortedItems = [...items].sort((a, b) => {
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
       return String(a.description || '').localeCompare(String(b.description || ''));
    });

    const rows = sortedItems.map(item => {
      const currentQty = item.quantity || 0;
      const minLimit = item.criticalLimit !== undefined ? item.criticalLimit : (item.minStock || 0);
      const needQty = Math.max(0, minLimit - currentQty);
      return {
        'SAP NO': item.sapNo || '-',
        'MALZEME TANIMI': item.description || '-',
        'MEVCUT STOK': currentQty,
        'BİRİM': item.unit || 'Adet',
        'KRİTİK LİMİT': minLimit,
        'SİPARİŞ İHTİYACI': needQty,
        'RAF NO': item.shelfNo || '-'
      };
    });

    const sheet = XLSX.utils.aoa_to_sheet([
      [`DEMİRER HOLDİNG - ${warehouseName.toUpperCase()} KRİTİK STOK & SİPARİŞ LİSTESİ`],
      ['Rapor Tarihi:', new Date().toLocaleString('tr-TR')],
      ['Toplam Kritik Kalem Sayısı:', sortedItems.length],
      [] // Empty line
    ]);

    XLSX.utils.sheet_add_json(sheet, rows, { origin: 'A5' });

    sheet['!cols'] = [
      { wch: 15 }, // SAP NO
      { wch: 45 }, // MALZEME TANIMI
      { wch: 14 }, // MEVCUT STOK
      { wch: 10 }, // BİRİM
      { wch: 14 }, // KRİTİK LİMİT
      { wch: 18 }, // SİPARİŞ İHTİYACI
      { wch: 14 }  // RAF NO
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Kritik Stok Sipariş');

    const cleanWhName = warehouseName.replace(/\s+/g, '_');
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `${cleanWhName}_Kritik_Stok_Siparis_Listesi_${dateStr}.xlsx`);
  }

  async exportTransfersToExcel(transfers: any[], fileName: string) {
    const { dataService } = await import('./DataService');

    const getWhName = (id: string): string => {
      if (!id) return '-';
      if (id.startsWith('team_')) {
        const teamName = id.replace('team_', '').replace(/_/g, ' ');
        return `${teamName.toUpperCase()} (Ekip)`;
      }
      const wh = dataService.getWarehouses().find(w => w.id === id);
      return wh ? wh.name.replace(/\s*[Dd]epo(su)?\s*$/, '') : id;
    };

    const formatMsfNo = (msf: string): string => {
      if (!msf) return '';
      const parts = msf.split('-');
      if (parts.length === 3 && parts[0] === 'MSF') {
        return `${parts[2]}-MSF-${parts[1]}`;
      }
      return msf;
    };

    const getFormattedDate = (timestamp: any, normStatus: string) => {
      return timestamp?.toDate 
        ? timestamp.toDate().toLocaleString('tr-TR') 
        : (timestamp?.seconds ? new Date(timestamp.seconds * 1000).toLocaleString('tr-TR') : (normStatus === 'TAMAMLANDI' || normStatus === 'IPTAL_EDILDI' ? '---' : 'Yolda'));
    };

    const getStatusText = (normStatus: string, t: any) => {
      if (normStatus === 'TAMAMLANDI') {
        if (Array.isArray(t.receivedItemsDetails) && t.receivedItemsDetails.length > 0) {
          return t.receivedItemsDetails.map((it: any) => `${it.shelfNo || 'Belirtilmedi'}`).join(', ');
        } else {
          return 'KABUL EDİLDİ';
        }
      } else if (normStatus === 'IPTAL_EDILDI') {
        return 'İPTAL EDİLDİ';
      }
      return 'YOLDA';
    };

    // --- 1. SHEET: ALL TRANSFERS (SUMMARY - FLATTENED & SORTED BY MSF NO) ---
    const sortedTransfers = [...transfers].sort((a, b) => {
      const msfA = a.msfNo || '';
      const msfB = b.msfNo || '';
      const seqA = parseInt(msfA.split('-')[0]) || 0;
      const seqB = parseInt(msfB.split('-')[0]) || 0;
      if (seqA !== seqB) return seqA - seqB;
      return msfA.localeCompare(msfB);
    });

    const summaryData: any[] = [];
    for (const t of sortedTransfers) {
      const fromName = getWhName(t.fromSiteId);
      const toName = getWhName(t.toSiteId);
      
      const s = t.status || 'YOLDA';
      const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
      const statusText = getStatusText(normStatus, t);
      
      const createdDateStr = getFormattedDate(t.createdAt, normStatus);
      const resolvedDateStr = getFormattedDate(t.resolvedAt, normStatus);

      const itemsList = Array.isArray(t.items) ? t.items : [{ materialCode: t.materialCode, materialName: t.materialName, quantity: t.quantity }];

      for (const it of itemsList) {
        summaryData.push({
          'MSF NO': formatMsfNo(t.msfNo || `TRF-${t.id?.substring(0, 8).toUpperCase()}`),
          'GÖNDERİM TARİHİ': createdDateStr,
          'GÖNDEREN DEPO': fromName,
          'ALICI DEPO': toName,
          'SAP NO': it.materialCode || '',
          'MALZEME TANIMI': it.materialName || '',
          'ADET': it.quantity || 0,
          'SEVK EDEN': t.requestedBy || '',
          'SEVK YÖNTEMİ': t.deliveryMethod === 'PERSON' ? 'Personel' : t.deliveryMethod === 'CARGO' ? 'Kargo' : 'Klasik Transfer',
          'TAŞIYICI BİLGİSİ': t.deliveryMethod === 'PERSON' ? (t.shippedBy || '') : t.deliveryMethod === 'CARGO' ? `${t.cargoCarrier || ''} (${t.cargoTrackingNo || ''})` : '---',
          'TESLİM ALMA TARİHİ': resolvedDateStr,
          'DURUM': statusText,
          'İPTAL / RED GEREKÇESİ': t.rejectionReason || ''
        });
      }
    }

    const summarySheet = XLSX.utils.aoa_to_sheet([
      ['DEMİRER HOLDİNG - DEPO TRANSFER VE SEVK HAREKETLERİ ÖZETİ'],
      ['Oluşturulma Tarihi:', new Date().toLocaleString('tr-TR')],
      []
    ]);
    XLSX.utils.sheet_add_json(summarySheet, summaryData, { origin: 'A4' });

    summarySheet['!cols'] = [
      { wch: 20 }, // MSF NO
      { wch: 20 }, // GÖNDERİM TARİHİ
      { wch: 25 }, // GÖNDEREN DEPO
      { wch: 25 }, // ALICI DEPO
      { wch: 15 }, // SAP NO
      { wch: 45 }, // MALZEME TANIMI
      { wch: 10 }, // ADET
      { wch: 25 }, // SEVK EDEN
      { wch: 18 }, // SEVK YÖNTEMİ
      { wch: 30 }, // TAŞIYICI BİLGİSİ
      { wch: 22 }, // TESLİM ALMA TARİHİ
      { wch: 20 }, // DURUM
      { wch: 25 }  // İPTAL / RED GEREKÇESİ
    ];

    const styleTransfersWorksheet = (ws: any) => {
      if (!ws || !ws['!ref']) return;
      const range = XLSX.utils.decode_range(ws['!ref']);
      
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cellRef = XLSX.utils.encode_cell({ r, c });
          if (!ws[cellRef]) continue;
          
          const cell = ws[cellRef];
          const font: any = { name: "Arial", size: 10, color: { rgb: "334155" } };
          const alignment: any = { vertical: "center" };
          let border: any = {
            top: { style: "thin", color: { rgb: "E2E8F0" } },
            bottom: { style: "thin", color: { rgb: "E2E8F0" } },
            left: { style: "thin", color: { rgb: "E2E8F0" } },
            right: { style: "thin", color: { rgb: "E2E8F0" } }
          };
          let fill: any = null;
          
          if (r === 0) {
            font.size = 12;
            font.bold = true;
            font.color = { rgb: "1E3A8A" }; // Deep Blue
            border = null;
          } else if (r === 1) {
            font.size = 9;
            font.italic = true;
            font.color = { rgb: "64748B" };
            border = null;
          } else if (r === 2) {
            border = null;
            continue;
          } else if (r === 3) {
            fill = { fgColor: { rgb: "1E3A8A" } }; // Deep Blue Header
            font.color = { rgb: "FFFFFF" };
            font.bold = true;
            alignment.horizontal = "center";
            border = {
              top: { style: "medium", color: { rgb: "1E3A8A" } },
              bottom: { style: "medium", color: { rgb: "0F172A" } },
              left: { style: "thin", color: { rgb: "CBD5E1" } },
              right: { style: "thin", color: { rgb: "CBD5E1" } }
            };
          } else {
            if (r % 2 === 0) {
              fill = { fgColor: { rgb: "F8FAFC" } }; // Zebra
            } else {
              fill = { fgColor: { rgb: "FFFFFF" } };
            }
            
            const valStr = String(cell.v || '');
            if (valStr.includes('TAMAMLANDI') || valStr.includes('KABUL EDİLDİ')) {
              fill = { fgColor: { rgb: "DCFCE7" } };
              font.color = { rgb: "15803D" };
              font.bold = true;
              alignment.horizontal = "center";
            } else if (valStr.includes('YOLDA')) {
              fill = { fgColor: { rgb: "FEF3C7" } };
              font.color = { rgb: "B45309" };
              font.bold = true;
              alignment.horizontal = "center";
            } else if (valStr.includes('İPTAL EDİLDİ')) {
              fill = { fgColor: { rgb: "FEE2E2" } };
              font.color = { rgb: "B91C1C" };
              font.bold = true;
              alignment.horizontal = "center";
            } else {
              if ([0, 1, 4, 6, 8, 10, 11].includes(c)) {
                alignment.horizontal = "center";
              } else {
                alignment.horizontal = "left";
              }
            }
          }
          
          cell.s = { font, alignment, border };
          if (fill) cell.s.fill = fill;
        }
      }
      ws['!views'] = [{ showGridLines: true }];
    };

    styleTransfersWorksheet(summarySheet);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Ana Sayfa');

    // --- 2. SHEETS FOR EACH WAREHOUSE (FLATTENED & SORTED BY MSF NO) ---
    const warehouses = dataService.getWarehouses();
    for (const wh of warehouses) {
      const whTransfers = transfers.filter(t => t.fromSiteId === wh.id);
      if (whTransfers.length === 0) continue;

      whTransfers.sort((a, b) => {
        const msfA = a.msfNo || '';
        const msfB = b.msfNo || '';
        const seqA = parseInt(msfA.split('-')[0]) || 0;
        const seqB = parseInt(msfB.split('-')[0]) || 0;
        if (seqA !== seqB) return seqA - seqB;
        return msfA.localeCompare(msfB);
      });

      const flattenedData: any[] = [];
      for (const t of whTransfers) {
        const s = t.status || 'YOLDA';
        const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
        const statusText = getStatusText(normStatus, t);
        const createdDateStr = getFormattedDate(t.createdAt, normStatus);
        const resolvedDateStr = getFormattedDate(t.resolvedAt, normStatus);
        const toName = getWhName(t.toSiteId);

        const itemsList = Array.isArray(t.items) ? t.items : [{ materialCode: t.materialCode, materialName: t.materialName, quantity: t.quantity }];

        for (const it of itemsList) {
          flattenedData.push({
            'MSF NO': formatMsfNo(t.msfNo || `TRF-${t.id?.substring(0, 8).toUpperCase()}`),
            'SEVK TARİHİ': createdDateStr,
            'ALICI DEPO': toName,
            'SAP NO': it.materialCode || '',
            'MALZEME TANIMI': it.materialName || '',
            'ADET': it.quantity || 0,
            'SEVK EDEN': t.requestedBy || '',
            'SEVK YÖNTEMİ': t.deliveryMethod === 'PERSON' ? 'Personel' : t.deliveryMethod === 'CARGO' ? 'Kargo' : 'Klasik Transfer',
            'TAŞIYICI BİLGİSİ': t.deliveryMethod === 'PERSON' ? (t.shippedBy || '') : t.deliveryMethod === 'CARGO' ? `${t.cargoCarrier || ''} (${t.cargoTrackingNo || ''})` : '---',
            'TESLİM TARİHİ': resolvedDateStr,
            'DURUM': statusText
          });
        }
      }

      const whSheetTitle = wh.name.replace(/\s*[Dd]epo(su)?\s*$/, '').trim();
      const cleanSheetName = whSheetTitle.substring(0, 30);

      const whSheet = XLSX.utils.aoa_to_sheet([
        [`DEMİRER HOLDİNG - ${whSheetTitle.toUpperCase()} DEPOSU SEVK HAREKETLERİ`],
        ['Oluşturulma Tarihi:', new Date().toLocaleString('tr-TR')],
        []
      ]);
      XLSX.utils.sheet_add_json(whSheet, flattenedData, { origin: 'A4' });

      whSheet['!cols'] = [
        { wch: 20 }, // MSF NO
        { wch: 20 }, // SEVK TARİHİ
        { wch: 25 }, // ALICI DEPO
        { wch: 15 }, // SAP NO
        { wch: 45 }, // MALZEME TANIMI
        { wch: 10 }, // ADET
        { wch: 25 }, // SEVK EDEN
        { wch: 18 }, // YÖNTEM
        { wch: 30 }, // TAŞIYICI
        { wch: 22 }, // TESLİM TARİHİ
        { wch: 20 }  // DURUM
      ];

      styleTransfersWorksheet(whSheet);

      XLSX.utils.book_append_sheet(workbook, whSheet, cleanSheetName);
    }

    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  }

  async parseExcel(file: File): Promise<Omit<InventoryItem, 'id'>[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

          const items = jsonData.map(row => {
            const getVal = (possibleKeys: string[]) => {
              for (const key of Object.keys(row)) {
                if (possibleKeys.includes(key.trim().toUpperCase())) {
                  return row[key];
                }
              }
              return '';
            };

            return {
              sapNo: String(getVal(['SAP NO', 'SAPNO'])),
              description: String(getVal(['AÇIKLAMA', 'ACIKLAMA', 'DESCRIPTION'])),
              quantity: Number(getVal(['ADET', 'QUANTITY']) || 0),
              shelfNo: String(getVal(['RAF NO', 'RAFNO', 'SHELFNO', 'KONUM']))
            };
          });

          resolve(items);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }
  async exportRequestsToExcel(requests: any[], fileName: string) {
    const data = requests.map(req => {
      return (req.items || []).map((item: any) => ({
        'TALEP TARİHİ': req.timestamp?.toDate ? req.timestamp.toDate().toLocaleString('tr-TR') : '',
        'DEPO': req.warehouseName,
        'TALEP EDEN': req.requester,
        'SAP NO': item.sapNo,
        'MALZEME': item.description,
        'ADET': item.quantity,
        'MEVCUT STOK': item.currentStock,
        'DURUM': item.status === 'APPROVED' ? 'Onaylandı' : item.status === 'REJECTED' ? 'Reddedildi' : 'Beklemede',
        'MALZEME NOTU': item.note || '',
        'YÖNETİCİ NOTU': req.managerNote || '',
        'TALEP NOTU': req.requesterNote || ''
      }));
    }).flat();

    const worksheet = XLSX.utils.aoa_to_sheet([
      ['DEMİRER HOLDİNG - SATIN ALMA TALEPLERİ'],
      ['Oluşturulma Tarihi:', new Date().toLocaleString('tr-TR')],
      [] // Boş satır
    ]);
    XLSX.utils.sheet_add_json(worksheet, data, { origin: 'A4' });

    worksheet['!cols'] = [
      { wch: 18 }, { wch: 20 }, { wch: 25 }, { wch: 15 }, 
      { wch: 40 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, 
      { wch: 25 }, { wch: 25 }, { wch: 25 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Satın Alma Talepleri');
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
  }

  async exportTurbineAnalytics(turbineData: Record<string, { totalUsed: number; totalDefect: number; items: any[] }>, warehouseName: string, period: string) {
    const workbook = XLSX.utils.book_new();

    // Create a sheet for each turbine
    Object.keys(turbineData).sort().forEach(turbineId => {
      const data = turbineData[turbineId];
      if (data.items.length === 0) return;

      const sheetData = data.items.map(item => ({
        'TARİH': new Date(item.date).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        'RAPOR NO': item.reportId,
        'MÇF / FORM NO': item.matFormNo,
        'ARIZA KODU': item.faultCode || '-',
        'ARIZA TANIMI': item.faultDesc || '-',
        'SAP NO': item.sapNo,
        'SERİ NO': item.serialNo || '-',
        'MALZEME': item.description,
        'KULLANILAN (TAKILAN)': item.used,
        'DEFECT (SÖKÜLEN)': item.defect
      }));

      const worksheet = XLSX.utils.aoa_to_sheet([
        [`DEMİRER HOLDİNG - TÜRBİN BAZLI MALZEME TÜKETİMİ (${turbineId})`],
        ['Depo:', warehouseName],
        ['Dönem:', period === 'this-week' ? 'Bu Hafta' : period === 'this-month' ? 'Bu Ay' : period === 'last-month' ? 'Önceki Ay' : period === 'this-year' ? 'Bu Yıl' : 'Tümü'],
        ['Oluşturulma Tarihi:', new Date().toLocaleString('tr-TR')],
        ['Toplam Takılan:', data.totalUsed, 'Toplam Sökülen:', data.totalDefect],
        [] // Boş satır
      ]);

      XLSX.utils.sheet_add_json(worksheet, sheetData, { origin: 'A7' });

      // Column widths
      worksheet['!cols'] = [
        { wch: 15 }, // Tarih
        { wch: 15 }, // Rapor No
        { wch: 20 }, // MCF
        { wch: 25 }, // Arıza Kodu
        { wch: 40 }, // Arıza Tanımı
        { wch: 15 }, // SAP
        { wch: 20 }, // Seri No
        { wch: 40 }, // Malzeme
        { wch: 25 }, // Kullanılan
        { wch: 25 }  // Defect
      ];

      // Excel sheet names cannot exceed 31 characters and shouldn't contain certain characters like [], *, ?, :, \ 
      let safeSheetName = turbineId.replace(/[\[\]\*\?\:\/\\]/g, '').trim().substring(0, 31);
      if (!safeSheetName) safeSheetName = 'Turbine';

      XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
    });

    if (workbook.SheetNames.length === 0) {
        // If no data, just add an empty sheet
        const emptySheet = XLSX.utils.aoa_to_sheet([['Kayıt Bulunamadı']]);
        XLSX.utils.book_append_sheet(workbook, emptySheet, 'Veri Yok');
    }

    const safeDate = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Turbin_Analizi_${warehouseName.replace(/\s+/g, '_')}_${safeDate}.xlsx`);
  }

  exportSingleAuditToExcel(
    audit: AuditRecord, 
    warehouseName: string, 
    inventory: InventoryItem[] = [], 
    allAudits: AuditRecord[] = [],
    logs: InventoryLog[] = []
  ) {
    const date = audit.timestamp?.seconds ? new Date(audit.timestamp.seconds * 1000).toLocaleString('tr-TR') : (audit.date || '');
    
    // Sort allAudits descending by date/timestamp to find the previous audit
    const sortedAudits = [...allAudits].sort((a: any, b: any) => {
      const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.date || 0).getTime();
      const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.date || 0).getTime();
      return timeB - timeA;
    });

    const currentAuditIndex = sortedAudits.findIndex((a: any) => a.id === audit.id);
    let previousAudit: any = null;
    if (currentAuditIndex !== -1 && currentAuditIndex < sortedAudits.length - 1) {
      previousAudit = sortedAudits[currentAuditIndex + 1];
    }

    const currentAuditTime = audit.timestamp?.seconds ? audit.timestamp.seconds * 1000 : (audit.endTime ? new Date(audit.endTime).getTime() : new Date().getTime());
    const previousAuditTime = previousAudit 
      ? (previousAudit.timestamp?.seconds ? previousAudit.timestamp.seconds * 1000 : (previousAudit.endTime ? new Date(previousAudit.endTime).getTime() : 0))
      : 0;

    // Filter logs between previousAuditTime and currentAuditTime
    // Include REMOVE logs (consumption) and ADD logs representing sökülen defect parts
    const consumptionLogs = logs.filter((l: any) => {
      const logTime = l.timestamp?.seconds ? l.timestamp.seconds * 1000 : (l.timestamp?.toDate ? l.timestamp.toDate().getTime() : 0);
      const isInRange = logTime > previousAuditTime && logTime <= currentAuditTime;
      if (!isInRange) return false;
      
      const isRemove = l.type === 'REMOVE';
      const isDefectAdd = l.type === 'ADD' && (l.note || '').includes('[Durum: DEFECT]');
      if (!isRemove && !isDefectAdd) return false;

      // Fallback: Parse turbineNo from note if not explicitly set
      if (!l.turbineNo) {
        const text = l.note || l.reason || '';
        const match = text.match(/-\s*([a-zA-Z0-9-]+)\s*\)/);
        if (match) {
          l.turbineNo = match[1].trim().toUpperCase();
        }
      }
      return !!l.turbineNo;
    });

    const data = audit.results.map((r: any) => {
      let shelfNo = r.shelfNo || '';
      if (!shelfNo && inventory.length > 0) {
        const invItem = inventory.find((i: any) => i.sapNo === r.sapNo || (i.sapNo === '' && i.description === r.description));
        if (invItem) {
          shelfNo = invItem.shelfNo || '';
        }
      }
      return {
        'SAP NO': r.sapNo || '---',
        'MALZEME TANIMI': r.description,
        'SİSTEM STOĞU': r.systemQty,
        'FİZİKSEL SAYIM': r.physicalQty,
        'FARK': r.diff,
        'RAF NO': shelfNo || '---',
        'AÇIKLAMA': r.note || ''
      };
    });

    // Sort data by RAF NO (natural alphanumeric sorting), then SAP NO
    const sortedData = data.sort((a: any, b: any) => {
       const locA = String(a['RAF NO'] || '').trim().toUpperCase();
       const locB = String(b['RAF NO'] || '').trim().toUpperCase();
       
       // Put empty/undefined/Tanımsız/Girilmemiş locations at the bottom
       const isEmptyA = !locA || locA === '---' || locA === 'TANIMSIZ' || locA === 'GİRİLMEMİŞ';
       const isEmptyB = !locB || locB === '---' || locB === 'TANIMSIZ' || locB === 'GİRİLMEMİŞ';
       
       if (isEmptyA && !isEmptyB) return 1;
       if (!isEmptyA && isEmptyB) return -1;
       
       let locCmp = 0;
       if (!isEmptyA && !isEmptyB) {
           locCmp = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
       }
       if (locCmp !== 0) return locCmp;
       
       const sapA = String(a['SAP NO'] || '').trim();
       const sapB = String(b['SAP NO'] || '').trim();
       return sapA.localeCompare(sapB, undefined, { numeric: true });
    });

    // Create Sheet 1: Sayım Detayları
    const worksheet = XLSX.utils.aoa_to_sheet([
      [`DEMİRER HOLDİNG - DETAYLI DEPO SAYIM RAPORU`],
      ['Depo:', warehouseName],
      ['Sayım Tarihi:', date],
      ['Sayımı Yapan:', audit.user || 'Bilinmeyen Kullanıcı'],
      ['Sayıma Başlama Saati:', audit.startTime ? new Date(audit.startTime).toLocaleString('tr-TR') : '---'],
      ['Sayım Bitiş Saati:', audit.endTime ? new Date(audit.endTime).toLocaleString('tr-TR') : '---'],
      ['Toplam Kalem:', audit.totalItems, 'Toplam Fark:', audit.totalDiff],
      [] // Boş satır
    ]);

    XLSX.utils.sheet_add_json(worksheet, sortedData, { origin: 'A9' });

    worksheet['!cols'] = [
      { wch: 15 }, // SAP
      { wch: 50 }, // Tanım
      { wch: 15 }, // Sistem
      { wch: 15 }, // Sayılan
      { wch: 10 }, // Fark
      { wch: 15 }, // Raf No
      { wch: 25 }  // Açıklama
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sayım Detayları');

    // Create Sheet 2: 2 Sayım Arası Tüketim
    const consumptionData = consumptionLogs.map((l: any) => {
      let sapNo = l.sapNo || '';
      if (!sapNo && inventory.length > 0) {
        const invItem = inventory.find((i: any) => i.description === l.materialName);
        if (invItem) sapNo = invItem.sapNo;
      }
      
      const noteText = l.note || l.reason || '';
      
      // Extract full report code (e.g. AN_IN06072026919) from note text
      let fullReportNo = '---';
      const mcfMatch = noteText.match(/Rapor:\s*([a-zA-Z0-9_-]+)/);
      if (mcfMatch) {
        fullReportNo = mcfMatch[1];
      }

      // Extract MÇF No (the suffix, e.g. 919) from the full report code
      let mcfNo = '---';
      if (fullReportNo !== '---') {
        const suffixMatch = fullReportNo.match(/\d{8}(\d+)$/);
        if (suffixMatch) {
          mcfNo = suffixMatch[1];
        } else {
          const endDigits = fullReportNo.match(/(\d+)$/);
          if (endDigits) {
            mcfNo = endDigits[1];
          }
        }
      }

      // Form No should display the full report code (e.g. AN_IN06072026919)
      const formNo = fullReportNo;

      // Action Type
      let actionType = 'Kullanılan (Yeni)';
      if (noteText.includes('[Durum: DEFECT]')) {
        actionType = l.type === 'ADD' ? 'Sökülen (Arızalı)' : 'Hurda / Sevk (Arızalı)';
      } else if (noteText.includes('[Durum: REVISED]')) {
        actionType = 'Kullanılan (Revize)';
      }

      // Format User to clean team name (e.g. dh-tm15@demirerholding.com -> team15)
      let formattedUser = l.user || '---';
      if (formattedUser.includes('@')) {
        formattedUser = formattedUser.split('@')[0];
      }
      if (formattedUser.startsWith('dh-tm')) {
        formattedUser = formattedUser.replace('dh-tm', 'team');
      }

      return {
        'TARİH': l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000).toLocaleString('tr-TR') : (l.timestamp?.toDate ? l.timestamp.toDate().toLocaleString('tr-TR') : ''),
        'TÜRBİN NO': l.turbineNo || '---',
        'SAP NO': sapNo || '---',
        'SERİ NO': l.turbineSerial || '---',
        'MALZEME AÇIKLAMASI': l.materialName,
        'ADET': l.quantity,
        'MÇF NO': mcfNo,
        'FORM NO': formNo,
        'İŞLEM': actionType,
        'KULLANAN EKİP': formattedUser
      };
    });

    const worksheet2 = XLSX.utils.aoa_to_sheet([
      [`DEMİRER HOLDİNG - İKİ SAYIM ARASI TÜRBİN TÜKETİM DETAYLARI`],
      ['Depo:', warehouseName],
      ['Periyot Başlangıcı:', previousAudit ? new Date(previousAuditTime).toLocaleString('tr-TR') : 'İlk Sayım'],
      ['Periyot Bitişi (Bu Sayım):', new Date(currentAuditTime).toLocaleString('tr-TR')],
      ['Toplam Tüketim İşlemi:', consumptionData.length],
      [] // Boş satır
    ]);

    XLSX.utils.sheet_add_json(worksheet2, consumptionData, { origin: 'A7' });
    worksheet2['!cols'] = [
      { wch: 18 }, // Tarih
      { wch: 12 }, // Türbin No
      { wch: 12 }, // SAP No
      { wch: 15 }, // Seri No
      { wch: 45 }, // Malzeme Açıklaması
      { wch: 10 }, // Adet
      { wch: 20 }, // MCF No
      { wch: 15 }, // Form No
      { wch: 18 }, // İşlem
      { wch: 20 }  // Kullanan Ekip
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet2, 'Tüketim Detayları');

    const cleanDate = date.replace(/[\s\.\:\/]/g, '_');
    XLSX.writeFile(workbook, `Sayim_Raporu_${warehouseName.replace(/\s+/g, '_')}_${cleanDate}.xlsx`);
  }

  exportAllAuditsToExcel(audits: AuditRecord[], warehouseName: string, inventory: InventoryItem[] = []) {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Sayım Özetleri
    const summaryData = audits.map((audit: any) => {
      const date = audit.timestamp?.seconds ? new Date(audit.timestamp.seconds * 1000).toLocaleString('tr-TR') : (audit.date || '');
      return {
        'SAYIM TARİHİ': date,
        'SAYIMI YAPAN': audit.user || 'Bilinmeyen Kullanıcı',
        'TOPLAM FARKLI KALEM': audit.totalItems,
        'TOPLAM ADET FARKI': audit.totalDiff
      };
    });

    const summaryWorksheet = XLSX.utils.aoa_to_sheet([
      [`DEMİRER HOLDİNG - DEPO SAYIM GEÇMİŞİ ÖZETİ`],
      ['Depo:', warehouseName],
      ['Oluşturulma Tarihi:', new Date().toLocaleString('tr-TR')],
      [] // Boş satır
    ]);
    XLSX.utils.sheet_add_json(summaryWorksheet, summaryData, { origin: 'A5' });
    summaryWorksheet['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Sayım Özetleri');

    // Sheet 2: Sayım Detayları
    const detailData: any[] = [];
    audits.forEach((audit: any) => {
      const date = audit.timestamp?.seconds ? new Date(audit.timestamp.seconds * 1000).toLocaleString('tr-TR') : (audit.date || '');
      audit.results.forEach((r: any) => {
        let shelfNo = r.shelfNo || '';
        if (!shelfNo && inventory.length > 0) {
          const invItem = inventory.find((i: any) => i.sapNo === r.sapNo || (i.sapNo === '' && i.description === r.description));
          if (invItem) {
            shelfNo = invItem.shelfNo || '';
          }
        }
        detailData.push({
          'SAYIM TARİHİ': date,
          'SAYIMI YAPAN': audit.user || 'Bilinmeyen Kullanıcı',
          'SAP NO': r.sapNo || '---',
          'MALZEME TANIMI': r.description,
          'RAF KONUMU': shelfNo || '---',
          'SİSTEM STOĞU': r.systemQty,
          'FİZİKSEL SAYIM': r.physicalQty,
          'FARK': r.diff,
          'AÇIKLAMA': r.note || ''
        });
      });
    });

    const detailWorksheet = XLSX.utils.aoa_to_sheet([
      [`DEMİRER HOLDİNG - TÜM DEPO SAYIM DETAYLARI`],
      ['Depo:', warehouseName],
      ['Oluşturulma Tarihi:', new Date().toLocaleString('tr-TR')],
      [] // Boş satır
    ]);
    XLSX.utils.sheet_add_json(detailWorksheet, detailData, { origin: 'A5' });
    detailWorksheet['!cols'] = [
      { wch: 20 }, // Tarih
      { wch: 25 }, // Yapan
      { wch: 15 }, // SAP
      { wch: 50 }, // Tanım
      { wch: 15 }, // Raf Konumu
      { wch: 15 }, // Sistem
      { wch: 15 }, // Sayılan
      { wch: 10 }, // Fark
      { wch: 25 }  // Açıklama
    ];
    XLSX.utils.book_append_sheet(workbook, detailWorksheet, 'Tüm Sayım Detayları');

    const safeDate = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Toplu_Sayim_Gecmisi_${warehouseName.replace(/\s+/g, '_')}_${safeDate}.xlsx`);
  }

  private styleWorksheet(ws: any, isSummary = false) {
    if (!ws || !ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    
    // Explicitly enable gridlines in Excel views
    ws['!views'] = [{ showGridLines: true }];

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) continue;
        
        const cell = ws[cellRef];
        
        const font: any = { name: "Arial", size: 10 };
        const alignment: any = { vertical: "center" };
        const border: any = {
          top: { style: "thin", color: { rgb: "94A3B8" } },
          bottom: { style: "thin", color: { rgb: "94A3B8" } },
          left: { style: "thin", color: { rgb: "94A3B8" } },
          right: { style: "thin", color: { rgb: "94A3B8" } }
        };
        const isGrandTotalRow = isSummary && (r === range.e.r);
        let fill: any = null;
        
        if (r === 0) {
          fill = { fgColor: { rgb: "1F2937" } }; // Slate-800 background
          font.color = { rgb: "FFFFFF" };
          font.bold = true;
          alignment.horizontal = "center";
          border.bottom = { style: "medium", color: { rgb: "475569" } };
        } else if (isGrandTotalRow) {
          fill = { fgColor: { rgb: "E2E8F0" } }; // Slate-200 background
          font.bold = true;
          border.top = { style: "thin", color: { rgb: "475569" } };
          border.bottom = { style: "double", color: { rgb: "475569" } };
          if (c >= 2) {
            alignment.horizontal = "center";
          } else {
            alignment.horizontal = "left";
          }
        } else {
          if (r % 2 === 0) {
            fill = { fgColor: { rgb: "EAEAEA" } }; // Slate-50 background changed to darker gray (EAEAEA)
          }
          
          if (!isSummary && c === 15) { // DURUM (index 15)
            const statusVal = String(cell.v || '').toUpperCase();
            if (statusVal.includes('ONAYLANDI')) {
              fill = { fgColor: { rgb: "DCFCE7" } }; // light green
              font.color = { rgb: "15803D" }; // dark green
              font.bold = true;
            } else if (statusVal.includes('BEKLİYOR')) {
              fill = { fgColor: { rgb: "FEF3C7" } }; // light yellow
              font.color = { rgb: "B45309" }; // dark yellow
              font.bold = true;
            } else if (statusVal.includes('REDDEDİLDİ')) {
              fill = { fgColor: { rgb: "FEE2E2" } }; // light red
              font.color = { rgb: "B91C1C" }; // dark red
              font.bold = true;
            }
            alignment.horizontal = "center";
          }
          
          if (isSummary) {
            if (c >= 2) {
              alignment.horizontal = "center";
            } else {
              alignment.horizontal = "left";
            }
          } else {
            if ([2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(c)) {
              alignment.horizontal = "center";
            } else {
              alignment.horizontal = "left";
            }
          }
        }
        
        cell.s = { font, alignment, border };
        if (fill) cell.s.fill = fill;
      }
    }
  }

  exportOvertimeToExcel(data: any[], fileName: string) {
    // Helper to get short sheet names (max 31 chars)
    const getShortCompanyName = (fullName: string): string => {
      if (!fullName) return 'Diğer';
      const lower = fullName.toLocaleLowerCase('tr-TR');
      if (lower.includes('har film') || lower.includes('harfilm')) return 'Har Film';
      if (lower.includes('yek')) return 'YEK';
      if (lower.includes('demirer')) return 'Demirer';
      return fullName.substring(0, 15).trim();
    };

    // Helper to convert decimal hours (e.g. 1.25) to time string (e.g. 01:15)
    const decimalToTimeStr = (decimal: number): string => {
      if (isNaN(decimal) || decimal <= 0) return '00:00';
      const totalMinutes = Math.round(decimal * 60);
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    // Helper to format date from YYYY-MM-DD to DD.MM.YYYY
    const formatDateToTurkish = (dateStr: string): string => {
      if (!dateStr) return '';
      const trimmed = dateStr.trim();
      if (trimmed.includes('-')) {
        const [y, m, d] = trimmed.split('-');
        return `${d}.${m}.${y}`;
      }
      return trimmed;
    };

    // Helper to build details data array
    const buildDetailsData = (rows: any[]) => {
      const resultRows: any[] = [];
      
      rows.forEach(row => {
        const sessions = (row.sessions && row.sessions.length > 0) ? row.sessions : [row];
        
        // Calculate each session's overtime contribution
        const sessionOtList = sessions.map((s: any) => {
          const sDate = row.date || s.date;
          return DateTimeUtils.calculateOvertimeHours(
            sDate,
            s.startTime || row.startTime,
            s.endTime || row.endTime,
            s.isOffDay || false,
            row.personnel
          );
        });

        // Filter out daytime sessions that produce 0 overtime hours ONLY IF there are multiple sessions and some produce > 0
        const exportSessions = sessions.filter((s: any, idx: number) => {
          if (sessions.length === 1) return true;
          return sessionOtList[idx] > 0;
        });

        const finalSessions = exportSessions.length > 0 ? exportSessions : sessions;

        // Recalculate filtered total suggested
        const filteredOtList = finalSessions.map((s: any) => {
          const sDate = row.date || s.date;
          return DateTimeUtils.calculateOvertimeHours(
            sDate,
            s.startTime || row.startTime,
            s.endTime || row.endTime,
            s.isOffDay || false,
            row.personnel
          );
        });
        const filteredTotalSuggested = filteredOtList.reduce((sum: number, ot: number) => sum + ot, 0);

        finalSessions.forEach((s: any, sIdx: number) => {
          const sDate = row.date || s.date;
          const sType = (s.type || row.sessionType || 'ÇALIŞMA').toUpperCase();
          const sStart = s.startTime || row.startTime || '---';
          const sEnd = s.endTime || row.endTime || '---';
          const timeRange = (sStart !== '---' && sEnd !== '---') ? `${sStart} - ${sEnd}` : '---';

          const sOt = filteredOtList[sIdx];
          let sApprovedHours = 0;
          if (filteredTotalSuggested > 0) {
            sApprovedHours = (sOt / filteredTotalSuggested) * (row.approvedHours || 0);
          } else {
            sApprovedHours = (row.approvedHours || 0) / finalSessions.length;
          }

          resultRows.push({
            'ŞİRKET': row.company || 'Bilinmiyor',
            'PERSONEL': row.personnel,
            'TARİH': formatDateToTurkish(sDate),
            'KAYIT TÜRÜ': sType,
            'SAHA': row.siteName || '---',
            'TÜRBİN NO': row.turbineNo || '---',
            'SERİ NO': row.turbineSerial || '---',
            'ARIZA KODU': row.faultCode || '---',
            'ARIZA/BAKIM RAPOR NO': row.reportNo || '---',
            'BAŞLANGIÇ': sStart,
            'BİTİŞ': sEnd,
            'SÜRE': timeRange,
            'ONAYLANAN MESAİ': decimalToTimeStr(sApprovedHours),
            'SODEXO YEMEK': (sIdx === 0 && row.sodexo) ? '1 ADET YEMEK' : '---',
            'DIŞ GÖREV HARCIRAHI': (sIdx === 0 && row.harcirah) ? '1 GÜN HARCIRAH' : '---',
            'DURUM': row.status === 'approved' ? 'ONAYLANDI' : row.status === 'rejected' ? 'REDDEDİLDİ' : 'ONAY BEKLİYOR'
          });
        });
      });

      // Sort details alphabetically by Company, then by Personnel, and then by Date
      resultRows.sort((a, b) => {
        const compA = String(a['ŞİRKET'] || '').toLocaleLowerCase('tr-TR');
        const compB = String(b['ŞİRKET'] || '').toLocaleLowerCase('tr-TR');
        const compResult = compA.localeCompare(compB, 'tr-TR');
        if (compResult !== 0) return compResult;

        const nameA = String(a['PERSONEL'] || '').toLocaleLowerCase('tr-TR');
        const nameB = String(b['PERSONEL'] || '').toLocaleLowerCase('tr-TR');
        const nameResult = nameA.localeCompare(nameB, 'tr-TR');
        if (nameResult !== 0) return nameResult;

        const dateA = (a['TARİH'] || '').split('.').reverse().join('-');
        const dateB = (b['TARİH'] || '').split('.').reverse().join('-');
        return dateA.localeCompare(dateB);
      });

      return resultRows;
    };

    // Helper to build summary data array
    const buildSummaryData = (rows: any[]) => {
      const aggregated = rows.reduce((acc: { [name: string]: { company: string, standardHours: number, holidayHours: number, sodexo: number, harcirah: number } }, curr: any) => {
        const name = curr.personnel;
        if (!acc[name]) {
          acc[name] = { 
            company: curr.company || 'Bilinmiyor',
            standardHours: 0,
            holidayHours: 0,
            sodexo: 0,
            harcirah: 0
          };
        }

        const rDate = curr.date;
        const rHours = curr.approvedHours || 0;
        if (rDate && DateTimeUtils.isPublicHoliday(rDate)) {
          acc[name].holidayHours += rHours;
        } else {
          acc[name].standardHours += rHours;
        }

        if (curr.sodexo) acc[name].sodexo += 1;
        if (curr.harcirah) acc[name].harcirah += 1;
        return acc;
      }, {});

      const summaryList = Object.keys(aggregated).map(name => {
        const item = aggregated[name];
        return {
          'ŞİRKET': item.company,
          'PERSONEL': name,
          'FAZLA ÇALIŞMA MESAİSİ': decimalToTimeStr(item.standardHours),
          'RESMİ TATİL MESAİSİ': decimalToTimeStr(item.holidayHours),
          'TOPLAM DIŞ GÖREV HARCIRAHI (GÜN)': item.harcirah,
          'TOPLAM SODEXO YEMEK (ADET)': item.sodexo
        };
      });

      // Sort summary alphabetically by Company first, then by Personnel
      summaryList.sort((a, b) => {
        const compA = String(a['ŞİRKET'] || '').toLocaleLowerCase('tr-TR');
        const compB = String(b['ŞİRKET'] || '').toLocaleLowerCase('tr-TR');
        const compResult = compA.localeCompare(compB, 'tr-TR');
        if (compResult !== 0) return compResult;

        const nameA = String(a['PERSONEL'] || '').toLocaleLowerCase('tr-TR');
        const nameB = String(b['PERSONEL'] || '').toLocaleLowerCase('tr-TR');
        return nameA.localeCompare(nameB, 'tr-TR');
      });

      // Calculate Grand Totals
      let totalStandardHours = 0;
      let totalHolidayHours = 0;
      let totalSodexo = 0;
      let totalHarcirah = 0;
      
      Object.keys(aggregated).forEach(name => {
        const item = aggregated[name];
        totalStandardHours += item.standardHours || 0;
        totalHolidayHours += item.holidayHours || 0;
        totalSodexo += item.sodexo || 0;
        totalHarcirah += item.harcirah || 0;
      });

      // Add Grand Total row at the very end
      summaryList.push({
        'ŞİRKET': 'GENEL TOPLAM',
        'PERSONEL': '',
        'FAZLA ÇALIŞMA MESAİSİ': decimalToTimeStr(totalStandardHours) + ':00',
        'RESMİ TATİL MESAİSİ': decimalToTimeStr(totalHolidayHours) + ':00',
        'TOPLAM DIŞ GÖREV HARCIRAHI (GÜN)': totalHarcirah as any,
        'TOPLAM SODEXO YEMEK (ADET)': totalSodexo as any
      });

      return summaryList;
    };

    // Helper to get unique short sheet names (max 31 chars)
    const getUniqueSheetName = (wbInstance: any, rawName: string): string => {
      let clean = (rawName || 'Sayfa').replace(/[\:\\\/\?\*\[\]]/g, '').trim();
      clean = clean.substring(0, 30).trim();
      if (!wbInstance.SheetNames.includes(clean)) return clean;
      let idx = 2;
      while (wbInstance.SheetNames.includes(`${clean.substring(0, 26)} ${idx}`)) {
        idx++;
      }
      return `${clean.substring(0, 26)} ${idx}`;
    };

    const wb = XLSX.utils.book_new();

    // Column widths definition for details worksheets
    const detailsCols = [
      { wch: 25 }, // Şirket
      { wch: 25 }, // Personel
      { wch: 12 }, // Tarih
      { wch: 20 }, // Kayıt Türü
      { wch: 20 }, // Saha
      { wch: 12 }, // Türbin No
      { wch: 15 }, // Seri No
      { wch: 15 }, // Arıza Kodu
      { wch: 25 }, // Rapor No
      { wch: 10 }, // Başlangıç
      { wch: 10 }, // Bitiş
      { wch: 12 }, // Süre
      { wch: 25 }, // Onaylanan Mesai
      { wch: 18 }, // Sodexo
      { wch: 22 }, // Harcırah
      { wch: 15 }  // Durum
    ];

    // 1. Grand totals (All companies)
    const grandSummary = buildSummaryData(data);
    const grandDetails = buildDetailsData(data);

    const wsGrandSummary = XLSX.utils.json_to_sheet(grandSummary);
    this.styleWorksheet(wsGrandSummary, true);
    XLSX.utils.book_append_sheet(wb, wsGrandSummary, getUniqueSheetName(wb, 'Tüm Şirketler Özet'));
    wsGrandSummary['!cols'] = [
      { wch: 25 }, // Şirket
      { wch: 25 }, // Personel
      { wch: 20 }, // Fazla Çalışma Mesaisi
      { wch: 25 }, // Resmi Tatil Mesaisi
      { wch: 35 }, // Toplam Harcırah
      { wch: 30 }  // Toplam Sodexo
    ];

    const wsGrandDetails = XLSX.utils.json_to_sheet(grandDetails);
    this.styleWorksheet(wsGrandDetails, false);
    XLSX.utils.book_append_sheet(wb, wsGrandDetails, getUniqueSheetName(wb, 'Tüm Şirketler Detay'));
    wsGrandDetails['!cols'] = detailsCols;

    // 2. Separate sheets for each company present in data
    const companies = Array.from(new Set(data.map(r => r.company || 'Bilinmiyor')));

    companies.forEach(company => {
      const companyRows = data.filter(r => (r.company || 'Bilinmiyor') === company);
      if (companyRows.length === 0) return;

      const compSummary = buildSummaryData(companyRows);
      const compDetails = buildDetailsData(companyRows);

      // Create company summary sheet
      const wsCompSummary = XLSX.utils.json_to_sheet(compSummary);
      this.styleWorksheet(wsCompSummary, true);
      XLSX.utils.book_append_sheet(wb, wsCompSummary, getUniqueSheetName(wb, `${getShortCompanyName(company)} Özet`));
      wsCompSummary['!cols'] = [
        { wch: 25 }, // Şirket
        { wch: 25 }, // Personel
        { wch: 20 }, // Fazla Çalışma Mesaisi
        { wch: 25 }, // Resmi Tatil Mesaisi
        { wch: 35 }, // Toplam Harcırah
        { wch: 30 }  // Toplam Sodexo
      ];

      // Create company details sheet
      const wsCompDetails = XLSX.utils.json_to_sheet(compDetails);
      this.styleWorksheet(wsCompDetails, false);
      XLSX.utils.book_append_sheet(wb, wsCompDetails, getUniqueSheetName(wb, `${getShortCompanyName(company)} Detay`));
      wsCompDetails['!cols'] = detailsCols;
    });

    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }

  styleOfficeWorksheet(ws: any, hasTitle: boolean) {
    if (!ws['!ref']) return;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const headerRowIdx = hasTitle ? 1 : 0;

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellAddress]) {
          ws[cellAddress] = { t: 's', v: '' };
        }
        const cell = ws[cellAddress];

        const font: any = { name: "Arial", size: 10 };
        const alignment: any = { vertical: "center" };
        const border: any = {
          top: { style: "thin", color: { rgb: "94A3B8" } },
          bottom: { style: "thin", color: { rgb: "94A3B8" } },
          left: { style: "thin", color: { rgb: "94A3B8" } },
          right: { style: "thin", color: { rgb: "94A3B8" } }
        };
        let fill: any = null;

        if (hasTitle && r === 0) {
          // Title Row (e.g. 15 Temmuz - 14 Ağustos 2026)
          font.size = 14;
          font.bold = true;
          font.color = { rgb: "000000" };
          alignment.horizontal = "center";
        } else if (r === headerRowIdx) {
          // Table Headers
          fill = { fgColor: { rgb: "1F2937" } }; // Slate-800
          font.color = { rgb: "FFFFFF" };
          font.bold = true;
          alignment.horizontal = "center";
          border.bottom = { style: "medium", color: { rgb: "475569" } };
        } else if (r === range.e.r) {
          // Grand Total Row
          fill = { fgColor: { rgb: "E2E8F0" } }; // Slate-200
          font.bold = true;
          border.top = { style: "thin", color: { rgb: "475569" } };
          border.bottom = { style: "double", color: { rgb: "475569" } };
          alignment.horizontal = c >= 2 ? "center" : "left";
        } else {
          // Regular Data Rows
          if ((r - headerRowIdx) % 2 === 0) {
            fill = { fgColor: { rgb: "EAEAEA" } };
          }
          alignment.horizontal = c >= 2 ? "center" : "left";
        }

        cell.s = { font, alignment, border };
        if (fill) cell.s.fill = fill;
      }
    }
  }

  exportOfficeOvertimeToExcel(data: any[], fileName: string, periodTitle?: string, monthYearTitle?: string) {
    const getShortCompanyName = (fullName: string): string => {
      if (!fullName) return 'Diğer';
      const lower = fullName.toLocaleLowerCase('tr-TR');
      if (lower.includes('har film') || lower.includes('harfilm')) return 'Har Film';
      if (lower.includes('yek')) return 'YEK';
      if (lower.includes('demirer')) return 'Demirer';
      return fullName.substring(0, 20).trim();
    };

    const decimalToTimeStr = (decimal: number): string => {
      if (isNaN(decimal) || decimal <= 0) return '00:00';
      const totalMinutes = Math.round(decimal * 60);
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
    };

    const buildOfficeSummaryData = (rows: any[]) => {
      const aggregated = rows.reduce((acc: { [name: string]: { company: string, standardHours: number, holidayHours: number, sodexo: number, harcirah: number } }, curr: any) => {
        const name = curr.personnel;
        if (!acc[name]) {
          acc[name] = { 
            company: curr.company || 'Bilinmiyor',
            standardHours: 0,
            holidayHours: 0,
            sodexo: 0,
            harcirah: 0
          };
        }

        const rDate = curr.date;
        const rHours = curr.approvedHours || 0;
        if (rDate && DateTimeUtils.isPublicHoliday(rDate)) {
          acc[name].holidayHours += rHours;
        } else {
          acc[name].standardHours += rHours;
        }

        if (curr.sodexo) acc[name].sodexo += 1;
        if (curr.harcirah) acc[name].harcirah += 1;
        return acc;
      }, {});

      const summaryList = Object.keys(aggregated).map(name => {
        const item = aggregated[name];
        const totalHours = item.standardHours + item.holidayHours;
        return {
          'Şirket': item.company,
          'Personel': name,
          'Fazla Çalışma Mesaisi': decimalToTimeStr(item.standardHours),
          'Resmi Tatil': decimalToTimeStr(item.holidayHours),
          'Dış Görev Harcırahı': item.harcirah,
          'Toplam Mesai': decimalToTimeStr(totalHours)
        };
      });

      // Sort summary alphabetically by Company first, then by Personnel
      summaryList.sort((a, b) => {
        const compA = String(a['Şirket'] || '').toLocaleLowerCase('tr-TR');
        const compB = String(b['Şirket'] || '').toLocaleLowerCase('tr-TR');
        const compResult = compA.localeCompare(compB, 'tr-TR');
        if (compResult !== 0) return compResult;

        const nameA = String(a['Personel'] || '').toLocaleLowerCase('tr-TR');
        const nameB = String(b['Personel'] || '').toLocaleLowerCase('tr-TR');
        return nameA.localeCompare(nameB, 'tr-TR');
      });

      // Calculate Grand Totals
      let totalStandardHours = 0;
      let totalHolidayHours = 0;
      let totalHarcirah = 0;
      
      Object.keys(aggregated).forEach(name => {
        const item = aggregated[name];
        totalStandardHours += item.standardHours || 0;
        totalHolidayHours += item.holidayHours || 0;
        totalHarcirah += item.harcirah || 0;
      });

      const grandTotalHours = totalStandardHours + totalHolidayHours;

      // Add Grand Total row at the end
      summaryList.push({
        'Şirket': 'GENEL TOPLAM',
        'Personel': '',
        'Fazla Çalışma Mesaisi': decimalToTimeStr(totalStandardHours) + ':00',
        'Resmi Tatil': decimalToTimeStr(totalHolidayHours) + ':00',
        'Dış Görev Harcırahı': totalHarcirah as any,
        'Toplam Mesai': decimalToTimeStr(grandTotalHours)
      });

      return summaryList;
    };

    const buildOfficeWorksheet = (summaryList: any[], titleText?: string) => {
      const headers = ['Şirket', 'Personel', 'Fazla Çalışma Mesaisi', 'Resmi Tatil', 'Dış Görev Harcırahı', 'Toplam Mesai'];
      const dataRows = summaryList.map(item => [
        item['Şirket'],
        item['Personel'],
        item['Fazla Çalışma Mesaisi'],
        item['Resmi Tatil'],
        item['Dış Görev Harcırahı'],
        item['Toplam Mesai']
      ]);

      const aoa: any[][] = [];
      if (titleText) {
        aoa.push([titleText, '', '', '', '', '']);
      }
      aoa.push(headers);
      dataRows.forEach(r => aoa.push(r));

      const ws = XLSX.utils.aoa_to_sheet(aoa);

      if (titleText) {
        ws['!merges'] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }
        ];
        ws['!rows'] = [{ hpt: 28 }, { hpt: 22 }];
      }

      this.styleOfficeWorksheet(ws, !!titleText);

      // Sütun genişlikleri (A4 Yatay standartlarına tam uyumlu)
      ws['!cols'] = [
        { wch: 38 }, // Şirket
        { wch: 22 }, // Personel
        { wch: 20 }, // Fazla Çalışma Mesaisi
        { wch: 16 }, // Resmi Tatil Mesaisi
        { wch: 18 }, // Dış Görev Harcırahı
        { wch: 15 }  // Toplam mesai
      ];

      // Yazdırma Sayfa Yapısı: Otomatik Yatay (Landscape) ve 1 Sayfaya Sığdırma (Fit to Width)
      ws['!pageSetup'] = {
        orientation: 'landscape',
        paperSize: 9, // A4
        fitToWidth: 1,
        fitToHeight: 0,
        scale: 100
      };

      // Dar Kenar Boşlukları (Yazdırmada taşmayı engellemek için)
      ws['!margins'] = {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2
      };

      return ws;
    };

    const getUniqueSheetName = (wbInstance: any, rawName: string): string => {
      let clean = (rawName || 'Sayfa').replace(/[\:\\\/\?\*\[\]]/g, '').trim();
      clean = clean.substring(0, 30).trim();
      if (!wbInstance.SheetNames.includes(clean)) return clean;
      let idx = 2;
      while (wbInstance.SheetNames.includes(`${clean.substring(0, 26)} ${idx}`)) {
        idx++;
      }
      return `${clean.substring(0, 26)} ${idx}`;
    };

    const wb = XLSX.utils.book_new();

    // 1. Grand totals (All companies summary only)
    const grandSummary = buildOfficeSummaryData(data);
    const wsGrandSummary = buildOfficeWorksheet(grandSummary, periodTitle);
    XLSX.utils.book_append_sheet(wb, wsGrandSummary, getUniqueSheetName(wb, 'Tüm Şirketler'));

    // 2. Separate Summary sheets for each company
    const companies = Array.from(new Set(data.map(r => r.company || 'Bilinmiyor')));

    companies.forEach(company => {
      const companyRows = data.filter(r => (r.company || 'Bilinmiyor') === company);
      if (companyRows.length === 0) return;

      const compSummary = buildOfficeSummaryData(companyRows);
      const compTitle = monthYearTitle ? `${company} ${monthYearTitle}` : (periodTitle ? `${company} ${periodTitle}` : company);
      const wsCompSummary = buildOfficeWorksheet(compSummary, compTitle);
      XLSX.utils.book_append_sheet(wb, wsCompSummary, getUniqueSheetName(wb, getShortCompanyName(company)));
    });

    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }
}

export const excelService = new ExcelService();
