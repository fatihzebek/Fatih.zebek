import * as XLSX from 'xlsx';
import type { InventoryItem, InventoryLog, AuditRecord } from './WarehouseService';
import { inventoryService } from './InventoryService';

class ExcelService {
  async exportToExcel(inventory: InventoryItem[], logs: InventoryLog[], fileName: string) {
    // Sheet 1: Inventory
    const invData = inventory.map(item => ({
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

  exportSingleAuditToExcel(audit: AuditRecord, warehouseName: string, inventory: InventoryItem[] = []) {
    const date = audit.timestamp?.seconds ? new Date(audit.timestamp.seconds * 1000).toLocaleString('tr-TR') : (audit.date || '');
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
        'RAF KONUMU': shelfNo || '---',
        'SİSTEM STOĞU': r.systemQty,
        'FİZİKSEL SAYIM': r.physicalQty,
        'FARK': r.diff,
        'AÇIKLAMA': r.note || ''
      };
    });

    const worksheet = XLSX.utils.aoa_to_sheet([
      [`DEMİRER HOLDİNG - DETAYLI DEPO SAYIM RAPORU`],
      ['Depo:', warehouseName],
      ['Sayım Tarihi:', date],
      ['Sayımı Yapan:', audit.user || 'Bilinmeyen Kullanıcı'],
      ['Toplam Kalem:', audit.totalItems, 'Toplam Fark:', audit.totalDiff],
      [] // Boş satır
    ]);

    XLSX.utils.sheet_add_json(worksheet, data, { origin: 'A7' });

    worksheet['!cols'] = [
      { wch: 15 }, // SAP
      { wch: 50 }, // Tanım
      { wch: 15 }, // Raf Konumu
      { wch: 15 }, // Sistem
      { wch: 15 }, // Sayılan
      { wch: 10 }, // Fark
      { wch: 25 }  // Açıklama
    ];

    const workbook = XLSX.utils.book_new();
    const cleanDate = date.replace(/[\s\.\:\/]/g, '_');
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sayım Detayları');
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
}

export const excelService = new ExcelService();
