import * as XLSX from 'xlsx';
import type { InventoryItem, InventoryLog } from './WarehouseService';
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
}

export const excelService = new ExcelService();
