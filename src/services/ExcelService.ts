import XLSX from 'xlsx-js-style';
import type { InventoryItem, InventoryLog, AuditRecord } from './WarehouseService';
import { inventoryService } from './InventoryService';

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

  async exportTransfersToExcel(transfers: any[], fileName: string) {
    const data = transfers.map(t => {
      const itemsStr = Array.isArray(t.items)
        ? t.items.map((it: any) => `${it.materialCode} (${it.materialName}): ${it.quantity} Adet`).join('\n')
        : `${t.materialCode} (${t.materialName}): ${t.quantity} Adet`;

      const fromName = (window as any)._warehousesMap[t.fromSiteId] || t.fromSiteId;
      const toName = (window as any)._warehousesMap[t.toSiteId] || t.toSiteId;
      
      const s = t.status || 'YOLDA';
      const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;

      let statusText = 'YOLDA';
      if (normStatus === 'TAMAMLANDI') {
        if (Array.isArray(t.receivedItemsDetails) && t.receivedItemsDetails.length > 0) {
          statusText = t.receivedItemsDetails.map((it: any) => `${it.shelfNo || 'Belirtilmedi'}`).join(', ');
        } else {
          statusText = 'KABUL EDİLDİ';
        }
      } else if (normStatus === 'IPTAL_EDILDI') {
        statusText = 'İPTAL EDİLDİ';
      }
      
      const createdDateStr = t.createdAt?.toDate 
        ? t.createdAt.toDate().toLocaleString('tr-TR') 
        : (t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleString('tr-TR') : '---');
        
      const resolvedDateStr = t.resolvedAt?.toDate 
        ? t.resolvedAt.toDate().toLocaleString('tr-TR') 
        : (t.resolvedAt?.seconds ? new Date(t.resolvedAt.seconds * 1000).toLocaleString('tr-TR') : (normStatus === 'TAMAMLANDI' || normStatus === 'IPTAL_EDILDI' ? '---' : 'Yolda'));

      return {
        'GÖNDERİM TARİHİ': createdDateStr,
        'MSF NO': t.msfNo || `TRF-${t.id?.substring(0, 8).toUpperCase()}`,
        'MALZEMELER': itemsStr,
        'GÖNDEREN DEPO': fromName,
        'ALICI DEPO': toName,
        'SEVK İŞLEMİNİ GERÇEKLEŞTİREN': t.requestedBy || '',
        'SEVK YÖNTEMİ': t.deliveryMethod === 'PERSON' ? 'Kurye / Personel' : t.deliveryMethod === 'CARGO' ? 'Kargo' : 'Klasik Transfer',
        'TAŞIYICI BİLGİSİ': t.deliveryMethod === 'PERSON' ? (t.shippedBy || '') : t.deliveryMethod === 'CARGO' ? `${t.cargoCarrier || ''} (${t.cargoTrackingNo || ''})` : '---',
        'TESLİM ALMA TARİHİ': resolvedDateStr,
        'İPTAL / RED GEREKÇESİ': t.rejectionReason || '',
        'DURUM': statusText
      };
    });

    const sheet = XLSX.utils.aoa_to_sheet([
      ['DEMİRER HOLDİNG - DEPO TRANSFER VE SEVK HAREKETLERİ RAPORU'],
      ['Oluşturulma Tarihi:', new Date().toLocaleString('tr-TR')],
      []
    ]);
    XLSX.utils.sheet_add_json(sheet, data, { origin: 'A4' });

    sheet['!cols'] = [
      { wch: 20 }, // GÖNDERİM TARİHİ
      { wch: 18 }, // MSF NO
      { wch: 50 }, // MALZEMELER
      { wch: 25 }, // GÖNDEREN
      { wch: 25 }, // ALICI
      { wch: 25 }, // SEVK İŞLEMİNİ GERÇEKLEŞTİREN
      { wch: 18 }, // YÖNTEM
      { wch: 30 }, // TAŞIYICI
      { wch: 22 }, // TESLİM ALMA TARİHİ
      { wch: 30 }, // GEREKÇE
      { wch: 15 }  // DURUM (RAF NO)
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Transfer Hareketleri');
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
    
    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (!ws[cellRef]) continue;
        
        const cell = ws[cellRef];
        
        const font: any = { name: "Arial", size: 10 };
        const alignment: any = { vertical: "center" };
        const border: any = {
          top: { style: "thin", color: { rgb: "CBD5E1" } },
          bottom: { style: "thin", color: { rgb: "CBD5E1" } },
          left: { style: "thin", color: { rgb: "CBD5E1" } },
          right: { style: "thin", color: { rgb: "CBD5E1" } }
        };
        let fill: any = null;
        
        if (r === 0) {
          fill = { fgColor: { rgb: "1F2937" } }; // Slate-800 background
          font.color = { rgb: "FFFFFF" };
          font.bold = true;
          alignment.horizontal = "center";
          border.bottom = { style: "medium", color: { rgb: "0F172A" } };
        } else {
          if (r % 2 === 0) {
            fill = { fgColor: { rgb: "F8FAFC" } }; // Slate-50 background
          }
          
          if (!isSummary && c === 14) { // DURUM (index 14)
            const statusVal = String(cell.v).toUpperCase();
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
            if ([2, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14].includes(c)) {
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
      return rows.map(row => ({
        'ŞİRKET': row.company || 'Bilinmiyor',
        'PERSONEL': row.personnel,
        'TARİH': formatDateToTurkish(row.date),
        'SAHA': row.siteName,
        'TÜRBİN NO': row.turbineNo || '---',
        'SERİ NO': row.turbineSerial || '---',
        'ARIZA KODU': row.faultCode || '---',
        'ARIZA/BAKIM RAPOR NO': row.reportNo,
        'BAŞLANGIÇ': row.startTime,
        'BİTİŞ': row.endTime,
        'SÜRE': row.duration,
        'ONAYLANAN MESAİ': decimalToTimeStr(row.approvedHours),
        'SODEXO YEMEK': row.sodexo ? '1 ADET YEMEK' : '---',
        'DIŞ GÖREV HARCIRAHI': row.harcirah ? '1 GÜN HARCIRAH' : '---',
        'DURUM': row.status === 'approved' ? 'ONAYLANDI' : row.status === 'rejected' ? 'REDDEDİLDİ' : 'ONAY BEKLİYOR'
      }));
    };

    // Helper to build summary data array
    const buildSummaryData = (rows: any[]) => {
      const aggregated = rows.reduce((acc: { [name: string]: { company: string, hours: number, sodexo: number, harcirah: number } }, curr: any) => {
        const name = curr.personnel;
        if (!acc[name]) {
          acc[name] = { 
            company: curr.company || 'Bilinmiyor',
            hours: 0,
            sodexo: 0,
            harcirah: 0
          };
        }
        acc[name].hours += curr.approvedHours || 0;
        if (curr.sodexo) acc[name].sodexo += 1;
        if (curr.harcirah) acc[name].harcirah += 1;
        return acc;
      }, {});

      return Object.keys(aggregated).map(name => {
        const item = aggregated[name];
        return {
          'ŞİRKET': item.company,
          'PERSONEL': name,
          'TOPLAM MESAİ': decimalToTimeStr(item.hours),
          'TOPLAM SODEXO YEMEK (ADET)': item.sodexo,
          'TOPLAM DIŞ GÖREV HARCIRAHI (GÜN)': item.harcirah
        };
      });
    };

    const wb = XLSX.utils.book_new();

    // Column widths definition for details worksheets
    const detailsCols = [
      { wch: 25 }, // Şirket
      { wch: 25 }, // Personel
      { wch: 12 }, // Tarih
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
    XLSX.utils.book_append_sheet(wb, wsGrandSummary, 'Tüm Şirketler Özet');
    wsGrandSummary['!cols'] = [
      { wch: 25 }, // Şirket
      { wch: 25 }, // Personel
      { wch: 30 }, // Toplam Mesai
      { wch: 30 }, // Toplam Sodexo
      { wch: 35 }  // Toplam Harcırah
    ];

    const wsGrandDetails = XLSX.utils.json_to_sheet(grandDetails);
    this.styleWorksheet(wsGrandDetails, false);
    XLSX.utils.book_append_sheet(wb, wsGrandDetails, 'Tüm Şirketler Detay');
    wsGrandDetails['!cols'] = detailsCols;

    // 2. Separate sheets for each company present in data
    const companies = Array.from(new Set(data.map(r => r.company || 'Bilinmiyor')));

    companies.forEach(company => {
      const companyRows = data.filter(r => (r.company || 'Bilinmiyor') === company);
      if (companyRows.length === 0) return;

      const compSummary = buildSummaryData(companyRows);
      const compDetails = buildDetailsData(companyRows);
      const shortName = getShortCompanyName(company);

      // Create company summary sheet
      const wsCompSummary = XLSX.utils.json_to_sheet(compSummary);
      this.styleWorksheet(wsCompSummary, true);
      XLSX.utils.book_append_sheet(wb, wsCompSummary, `${shortName} Özet`.substring(0, 31));
      wsCompSummary['!cols'] = [
        { wch: 25 }, // Şirket
        { wch: 25 }, // Personel
        { wch: 30 }, // Toplam Mesai
        { wch: 30 }, // Toplam Sodexo
        { wch: 35 }  // Toplam Harcırah
      ];

      // Create company details sheet
      const wsCompDetails = XLSX.utils.json_to_sheet(compDetails);
      this.styleWorksheet(wsCompDetails, false);
      XLSX.utils.book_append_sheet(wb, wsCompDetails, `${shortName} Detay`.substring(0, 31));
      wsCompDetails['!cols'] = detailsCols;
    });

    XLSX.writeFile(wb, `${fileName}.xlsx`);
  }
}

export const excelService = new ExcelService();
