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

          const items = jsonData.map(row => ({
            sapNo: String(row['SAP NO'] || row['sapNo'] || ''),
            description: String(row['AÇIKLAMA'] || row['description'] || ''),
            quantity: Number(row['ADET'] || row['quantity'] || 0),
            shelfNo: String(row['RAF NO'] || row['shelfNo'] || '')
          }));

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
}

export const excelService = new ExcelService();
