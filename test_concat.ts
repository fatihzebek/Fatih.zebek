# Değişiklik Özeti (Walkthrough)

Bu güncellemede, Depo ve Santral sayfalarının mobil dikey ve yatay ekranlarda kusursuz görüntülenmesini sağlamak amacıyla kritik tasarım ve responsive düzenlemeleri gerçekleştirilmiştir.

## Yapılan Değişiklikler

### 1. Yatay Ekrandaki Siyah Boşluk Düzeltmesi (Landscape Glitch)
- **Dosya**: [style.css](file:///c:/Users/FatihZebek/Desktop/Dh_Servis/src/style.css)
- **Detay**: `@media (max-width: 1024px)` medya sorgusu altındaki `.sidebar` ve `.sidebar.mobile-active` sınıflarının tüm konumlandırma ve ekran yerleşimi kuralları `!important` ifadesiyle güçlendirildi.
- **Sonuç**: Telefon yatay konuma getirildiğinde sol menünün (`.sidebar`) grid akışında `relative` kalarak ana içeriği aşağı itmesi ve ekranın üstünde 100vh boyutunda devasa bir siyah boşluk yaratması sorunu kökten çözüldü. Artık yatay modda da menü akış dışı (`fixed`) kalarak sayfanın en üstten başlamasını sağlıyor.

### 2. Dikey Ekrandaki Sola Kayma ve Kesilme Düzeltmesi (Portrait Left-Shift Cutoff)
- **Dosya**: [Warehouses.ts](file:///c:/Users/FatihZebek/Desktop/Dh_Servis/src/pages/Warehouses.ts)
- **Sekme Çubuğu (Tab Switcher)**:
  - Sekme değiştirici kapsayıcısı `width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;` olacak şekilde güncellendi.
  - `.premium-tab` sınıfına `flex-shrink: 0;` eklendi.
  - **Sonuç**: 5 adet geniş sekme dikey mobil ekranda büzüşmeden veya sayfayı taşırmadan pürüzsüzce yatayda kaydırılabilir hale getirildi.
- **Tablolar (Envanter, Geçmiş, Sayım, Sayım Geçmişi)**:
  - **Geçmiş (History)**, **Sayım Geçmişi (Audit History)** ve aktif **Sayım (Audit)** tabloları `overflow-x: auto;` özellikli kaydırma kapları (`div`) içerisine alındı.
  - Tablolara `min-width: 800px;` verilerek dar ekranlarda kolonların üst üste binmesi veya sayfayı genişleterek sola kaydırması (kesilmesi) engellendi.
- **Görsel Düzenleme**:
  - Dikey mobilde (`max-width: 768px`) premium kartların aşırı geniş iç boşlukları (`padding: 1rem !important`) daraltıldı.
  - **AI Analiz Banner'ı** mobilde dikey akışa alınarak (`flex-direction: column`) butonların ve metinlerin tam sığması sağlandı.

## Doğrulama ve Derleme
1. Proje TypeScript ve Vite derleyicisi ile başarılı bir şekilde derlendi (`npm run build`).
2. Firebase Hosting aracılığıyla tüm değişiklikler canlı ortama aktarıldı.

  (window as any).cachedInventory = null;
  (window as any).cachedReservations = null;
  (window as any).cachedTrends = null;
  (window as any).cachedOc
## 🚀 Canlıya Dağıtım ve Derleme Sonuçları

### 1. Derleme Testi (Build)
Uygulama yerel olarak başarıyla paketlendi ve sıfır hata ile tamamlandı:
```bash
vite v8.0.10 building client environment for production...
transforming...✓ 139 modules transformed.
✓ built in 715ms
```

### 2. Canlı Sunucu Dağıtımı (Deploy Hosting)
Değişiklikler Firebase Hosting sunucusuna başarıyla yüklendi:
* **Canlı Yayın Adresi:** [dh-servis-rapor.web.app](https://dh-servis-rapor.web.app)
* **Durum:** Aktif, Kararlı ve Kullanıma Hazır.

---

## 🧪 Doğrulama ve Test Adımları
// MISSING LINE 51
// MISSING LINE 52
// MISSING LINE 53
// MISSING LINE 54
// MISSING LINE 55
// MISSING LINE 56
// MISSING LINE 57
// MISSING LINE 58
// MISSING LINE 59
// MISSING LINE 60
// MISSING LINE 61
// MISSING LINE 62
// MISSING LINE 63
// MISSING LINE 64
// MISSING LINE 65
// MISSING LINE 66
// MISSING LINE 67
// MISSING LINE 68
// MISSING LINE 69
// MISSING LINE 70
// MISSING LINE 71
// MISSING LINE 72
// MISSING LINE 73
// MISSING LINE 74
// MISSING LINE 75
// MISSING LINE 76
// MISSING LINE 77
// MISSING LINE 78
// MISSING LINE 79
// MISSING LINE 80
// MISSING LINE 81
// MISSING LINE 82
// MISSING LINE 83
// MISSING LINE 84
// MISSING LINE 85
// MISSING LINE 86
// MISSING LINE 87
// MISSING LINE 88
// MISSING LINE 89
// MISSING LINE 90
// MISSING LINE 91
// MISSING LINE 92
// MISSING LINE 93
// MISSING LINE 94


export const WarehousePage = async (selectedWarehouseId: string | null = null, userProfile: UserProfile | null = null, sortKey: string = 'sapNo', sortDir: 'asc' | 'desc' = 'asc', searchQuery: string = '', activeTab: 'inventory' | 'history' | 'analytics' | 'audit' | 'audit_history' = 'inventory') => {
  if (selectedWarehouseId) (window as any).currentWarehouseId = selectedWarehouseId;
  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';
  const warehousePerms = userProfile?.allowedTabs?.warehouses || {};
  const hasAddMaterialPerm = isAdmin || (typeof warehousePerms === 'object' && !!(warehousePerms as any).addMaterial);
  const hasEditMaterialPerm = isAdmin || (typeof warehousePerms === 'object' && !!(warehousePerms as any).editMaterial);
  const hasDeleteMaterialPerm = isAdmin || (typeof warehousePerms === 'object' && !!(warehousePerms as any).deleteMaterial);
  const hasUploadImagePerm = isAdmin || (typeof warehousePerms === 'object' && !!(warehousePerms as any).uploadImage);
  const hasCountStockPerm = isAdmin || (typeof warehousePerms === 'object' && !!(warehousePerms as any).countStock);
  const hasUploadExcelPerm = isAdmin || (typeof warehousePerms === 'object' && !!(warehousePerms as any).uploadExcel);
  const allWarehouses = dataService.getWarehouses() || [];
  const filteredWarehouses = (isAdmin 
    ? allWarehouses 
    : allWarehouses.filter(w => userProfile?.allowedWarehouses?.includes(w.id)))
    .sort((a, b) => {
      const cleanA = a.name.replace(' Depo', '').trim(
      const indexB = DataService.customOrder.findIndex(o => o.toLowerCase() === cleanB.toLowerCase());
      if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
      if (indexA === -1) return 1;
// MISSING LINE 116
// MISSING LINE 117
// MISSING LINE 118
// MISSING LINE 119
// MISSING LINE 120
// MISSING LINE 121
// MISSING LINE 122
// MISSING LINE 123
// MISSING LINE 124
// MISSING LINE 125
// MISSING LINE 126
// MISSING LINE 127
// MISSING LINE 128
// MISSING LINE 129
// MISSING LINE 130
// MISSING LINE 131
// MISSING LINE 132
// MISSING LINE 133
// MISSING LINE 134
// MISSING LINE 135
// MISSING LINE 136
// MISSING LINE 137
// MISSING LINE 138
// MISSING LINE 139
// MISSING LINE 140
// MISSING LINE 141
// MISSING LINE 142
// MISSING LINE 143
// MISSING LINE 144
// MISSING LINE 145
// MISSING LINE 146
      } else {
        audits = (window as any).cachedAudits;
      }
    }
    console.log('[WarehousePage] Serving all data from client-side local cache.');
  } else {
    console.log('[WarehousePage] Cache missing or stale. Fetching fresh data from Firestore...');
    try {
      inventory = selectedWarehouseId ? await warehouseService.getInventory(selectedWarehouseId) : [];
      draftReservations = selectedWarehouseId ? await warehouseService.getReservationsFromDrafts(selectedWarehouseId) : { bySap: {}, details: [] };
      trends = selectedWarehouseId ? await warehouseService.calculateConsumptionTrends(selectedWarehouseId) : {};
      occupancy = selectedWarehouseId ? await warehouseService.getShelfOccupancy(selectedWarehouseId) : {};
      logs = selectedWarehouseId ? await warehouseService.getLogs(selectedWarehouseId) : [];
      if (selectedWarehouseId && activeTab === 'audit_history') {
        audits = await warehouseService.getAuditHistory(selectedWarehouseId);
      }
      
      // Cache the newly loaded values
      (window as any).cachedWarehouseId = selectedWarehouseId;
      (window as any).cachedInventory = inventory;
      (window as any).cachedReservations = draftReservations;
      (window as any).cachedTrends = trends;
      (window as any).cachedOccupancy = occupancy;
      (window as any).cachedLogs = logs;
      (window as any).cachedAudits = audits;
    } catch (e) {
      console.error('[WarehousePage] Firestore fetch error:', e);
    }
  }

  (window as any).currentTrends = trends;
  (window as any).currentOccupancy = occupancy;
  (window as any).currentInventoryData = inventory;
  (window as any).currentUser = userProfile;
// MISSING LINE 181
// MISSING LINE 182
// MISSING LINE 183
// MISSING LINE 184
// MISSING LINE 185
      return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return '-'; }
  };

  if (selectedWarehouseId) {
    const warehouse = allWarehouses.find(w => w.id === selectedWarehouseId);
    if (!warehouse) return 'Depo bulunamadı';

    let inventoryData = [...inventory];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      inventoryData = inventoryData.filter(item => 
        String(item.sapNo || '').toLowerCase().includes(q) || 
        String(item.description || '').toLowerCase().includes(q) ||
        String(item.shelfNo || '').toLowerCase().includes(q)
      );
    }

    console.log(`[WarehousePage] Sorting inventory by ${sortKey} (${sortDir})`);
    inventoryData.sort((a, b) => {
      let valA = (a as any)[sortKey];
      let valB = (b as any)[sortKey];
      
      // Fallback for shelf/shelfNo naming inconsistency
      if (sortKey === 'shelf' || sortKey === 'shelfNo') {
        valA = (a as any).shelf || a.shelfNo || '';
        valB = (b as any).shelf || b.shelfNo || '';
      }
      
      if (valA === undefined || valA === null) valA = '';
      if (valB === undefined || valB === null) valB = '';

      if (typeof valA === 'number' && typeof valB === 'number') {
        return (valA - valB) * (sortDir === 'asc' ? 1 : -1);
      }
      
      return valA.t
// MISSING LINE 223
// MISSING LINE 224
// MISSING LINE 225
// MISSING LINE 226
// MISSING LINE 227
// MISSING LINE 228
// MISSING LINE 229
// MISSING LINE 230
// MISSING LINE 231
// MISSING LINE 232
// MISSING LINE 233
// MISSING LINE 234
// MISSING LINE 235
// MISSING LINE 236
// MISSING LINE 237
// MISSING LINE 238
// MISSING LINE 239
// MISSING LINE 240
// MISSING LINE 241
// MISSING LINE 242
// MISSING LINE 243
// MISSING LINE 244
// MISSING LINE 245
// MISSING LINE 246
// MISSING LINE 247
// MISSING LINE 248
// MISSING LINE 249
// MISSING LINE 250
      <style>
        :root {
          --bg-dark: #0a1118;
          --card-bg: #111a24;
          --accent-blue: #64ffda;
          --accent-glow: rgba(100, 255, 218, 0.1);
          --text-main: #e6f1ff;
          --text-dim: #8892b0;
          --danger: #ff4d4d;
        }

        .premium-card {
          background: var(--card-bg);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }

        .stats-card {
          flex: 1;
          padding: 1.2rem;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 16px;
          min-width: 150px;
        }

        .stats-label {
          font-size: 0.65rem;
          font-weight: 800;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }

        .stats-value {
          font-size: 1.8rem;
          font-weight: 900;
          color: var(--text-main);
          font-family: 'Outfit', sans-serif;
        }

        .cyber-input-premium {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          color: var(--text-main);
          padding: 10px 15px;
// MISSING LINE 300
// MISSING LINE 301
// MISSING LINE 302
// MISSING LINE 303
// MISSING LINE 304
// MISSING LINE 305
// MISSING LINE 306
// MISSING LINE 307
// MISSING LINE 308
// MISSING LINE 309
// MISSING LINE 310
// MISSING LINE 311
// MISSING LINE 312
// MISSING LINE 313
// MISSING LINE 314
// MISSING LINE 315
// MISSING LINE 316
// MISSING LINE 317
// MISSING LINE 318
// MISSING LINE 319
// MISSING LINE 320
// MISSING LINE 321
// MISSING LINE 322
// MISSING LINE 323
// MISSING LINE 324
// MISSING LINE 325
// MISSING LINE 326
// MISSING LINE 327
// MISSING LINE 328
// MISSING LINE 329
// MISSING LINE 330
// MISSING LINE 331
// MISSING LINE 332
// MISSING LINE 333
// MISSING LINE 334
// MISSING LINE 335
// MISSING LINE 336
// MISSING LINE 337
// MISSING LINE 338
// MISSING LINE 339
// MISSING LINE 340
// MISSING LINE 341
// MISSING LINE 342
// MISSING LINE 343
// MISSING LINE 344
// MISSING LINE 345
// MISSING LINE 346
// MISSING LINE 347
// MISSING LINE 348
// MISSING LINE 349
// MISSING LINE 350
// MISSING LINE 351
// MISSING LINE 352
// MISSING LINE 353
// MISSING LINE 354
// MISSING LINE 355
// MISSING LINE 356
// MISSING LINE 357
// MISSING LINE 358
// MISSING LINE 359
// MISSING LINE 360
// MISSING LINE 361
// MISSING LINE 362
        }

        .zoom-tablet {
          /* Page zoom reverted to normal */
          zoom: 1;
        }

        .modal-content {
          zoom: 0.8;
          transform-origin: center center;
        }

        .audit-badge {
          font-size: 0.55rem;
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .audit-fresh { background: rgba(100, 255, 218, 0.1); color: var(--accent-blue); border: 1px solid rgba(100, 255, 218, 0.2); }
        .audit-stale { background: rgba(255, 152, 0, 0.1); color: #ff9800; border: 1px solid rgba(255, 152, 0, 0.2); }
        .audit-expired { background: rgba(255, 77, 77, 0.1); color: #ff4d4d; border: 1px solid rgba(255, 77, 77, 0.2); }

        .batch-bar {
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          background: #111a24;
          border: 1px solid var(--accent-blue);
          padding: 1rem 2rem;
          border-radius: 20px;
          display: flex;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.02);
          color: var(--text-dim);
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-icon-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.2);
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
        }

        .material-row:hover {
          background: rgba(255,255,255,0.01);
        }

        .shelf-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent-blue);
        }

// MISSING LINE 430
// MISSING LINE 431
// MISSING LINE 432
// MISSING LINE 433
// MISSING LINE 434
// MISSING LINE 435
// MISSING LINE 436
// MISSING LINE 437
// MISSING LINE 438
// MISSING LINE 439
// MISSING LINE 440
// MISSING LINE 441
// MISSING LINE 442
// MISSING LINE 443
// MISSING LINE 444
// MISSING LINE 445
// MISSING LINE 446
// MISSING LINE 447
// MISSING LINE 448
// MISSING LINE 449
// MISSING LINE 450
        .audit-fresh { backgro
// MISSING LINE 452
// MISSING LINE 453
// MISSING LINE 454
// MISSING LINE 455
// MISSING LINE 456
// MISSING LINE 457
// MISSING LINE 458
// MISSING LINE 459
// MISSING LINE 460
// MISSING LINE 461
// MISSING LINE 462
// MISSING LINE 463
// MISSING LINE 464
// MISSING LINE 465
// MISSING LINE 466
// MISSING LINE 467
// MISSING LINE 468
// MISSING LINE 469
// MISSING LINE 470
// MISSING LINE 471
// MISSING LINE 472
// MISSING LINE 473
// MISSING LINE 474
// MISSING LINE 475
// MISSING LINE 476
// MISSING LINE 477
// MISSING LINE 478
// MISSING LINE 479
// MISSING LINE 480
// MISSING LINE 481
// MISSING LINE 482
// MISSING LINE 483
// MISSING LINE 484
// MISSING LINE 485
// MISSING LINE 486
// MISSING LINE 487
// MISSING LINE 488
// MISSING LINE 489
// MISSING LINE 490
// MISSING LINE 491
// MISSING LINE 492
// MISSING LINE 493
// MISSING LINE 494
// MISSING LINE 495
// MISSING LINE 496
// MISSING LINE 497
// MISSING LINE 498
// MISSING LINE 499
// MISSING LINE 500
// MISSING LINE 501
// MISSING LINE 502
// MISSING LINE 503
// MISSING LINE 504
// MISSING LINE 505
// MISSING LINE 506
// MISSING LINE 507
// MISSING LINE 508
// MISSING LINE 509
// MISSING LINE 510
// MISSING LINE 511
// MISSING LINE 512
// MISSING LINE 513
// MISSING LINE 514
        <div class="premium-card modal-content" style="max-width: 720px; width: 95%; max-height: 90vh; overflow-y: auto; overflow-x: hidden; padding: 0; border: 1px solid rgba(100, 255, 218, 0.1); background: #0d1117; box-shadow: 0 30px 60px rgba(0,0,0,0.5); b
// MISSING LINE 516
// MISSING LINE 517
// MISSING LINE 518
// MISSING LINE 519
// MISSING LINE 520
// MISSING LINE 521
// MISSING LINE 522
// MISSING LINE 523
// MISSING LINE 524
// MISSING LINE 525
// MISSING LINE 526
// MISSING LINE 527
// MISSING LINE 528
// MISSING LINE 529
// MISSING LINE 530
// MISSING LINE 531
// MISSING LINE 532
// MISSING LINE 533
// MISSING LINE 534
// MISSING LINE 535
// MISSING LINE 536
// MISSING LINE 537
// MISSING LINE 538
// MISSING LINE 539
// MISSING LINE 540
// MISSING LINE 541
// MISSING LINE 542
// MISSING LINE 543
// MISSING LINE 544
// MISSING LINE 545
// MISSING LINE 546
// MISSING LINE 547
// MISSING LINE 548
// MISSING LINE 549
// MISSING LINE 550
// MISSING LINE 551
// MISSING LINE 552
// MISSING LINE 553
// MISSING LINE 554
// MISSING LINE 555
// MISSING LINE 556
// MISSING LINE 557
// MISSING LINE 558
// MISSING LINE 559
// MISSING LINE 560
// MISSING LINE 561
// MISSING LINE 562
// MISSING LINE 563
// MISSING LINE 564
// MISSING LINE 565
// MISSING LINE 566
// MISSING LINE 567
// MISSING LINE 568
// MISSING LINE 569
// MISSING LINE 570
// MISSING LINE 571
// MISSING LINE 572
// MISSING LINE 573
// MISSING LINE 574
// MISSING LINE 575
            <!-- Content will be injected by JS -->
          </div>
        </div>
      </div>

      <!-- Main Container with Zoom -->
      <div class="zoom-tablet" style="max-width: 1600px; margin: 0 auto; padding: 1.5rem; animation: fadeIn 0.4s ease-out;">
        
        <!-- Dashboard Header -->
        <header style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
          <div style="display: flex; align-items: center; gap: 1.5rem;">
            <button onclick="window.navigate('warehouses')" class="action-icon-btn" style="width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div>
              <h1 style="margin: 0; font-size: clamp(1.5rem, 2.5vw, 2.2rem); font-weight: 900; letter-spacing: -1px; color: var(--text-main);">${warehouse?.name || 'Depo'}</h1>
              <p style="margin: 4px 0 0 0; color: var(--text-dim); font-size: 0.85rem; font-weight: 500;">${warehouse?.location || 'Stok ve Envanter Yönetim Sistemi'}</p>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; flex: 1; justify-content: flex-end;">
            <div style="position: relative; flex: 1 1 250px; max-width: 350px; min-width: 200px; display: flex; align-items: center;">
              <input type="text" id="inventory-search" placeholder="Parça veya SAP no ara..." 
                     value="${searchQuery || ''}"
                     class="cyber-input-premium search-box-mini"
                     style="width: 100%; padding-right: 50px;"
                     onkeypress="if(event.key==='Enter') window.updateWarehouseUI(undefined, undefined, undefined, this.value)"
                     autofocus
                     onfocus="this.setSelectionRange(this.value.length, this.value.length)">
              <button onclick="window.updateWarehouseUI(undefined, undefined, undefined, document.getElementById('inventory-search').value)" 
                      style="position: absolute; right: 6px; width: 36px; height: 36px; background: var(--accent-blue); border: none; color: #0a1118; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; transition: all 0.2s;"
                      onmouseover="this.style.filter='brightness(1.1)';" 
                      onmouseout="this.style.filter='none';">
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
            </div>
            
            <button onclick="window.startQuickAudit('${selectedWarehouseId}')" class="btn-cyber" style="background: linear-gradient(135deg, #64ffda 0%, #48bb78 100%); color: #000; padding: 10px 18px; border-radius: 10px; font-size: 0.75rem; font-weight: 900; border: none; cursor: pointer; box-shadow: 0 4px 15px rgba(100, 255, 218, 0.2); flex-shrink: 0;">
              <i class="fa-solid fa-bolt" style="margin-right: 8px;"></i> HIZLI SAYIM
   
              <i class="fa-solid fa-qrcode" style="margin-right: 8px;"></i> QR TARA
            </button>

            <button onclick="window.downloadExcel('${selectedWarehouseId}')" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: var(--text-main); padding: 10px 18px; border-radius: 10px; font-size: 0.75rem; font-weight: 800; border: none; cursor: pointer; flex-shrink: 0;">
              <i class="fa-solid fa-file-export" style="color: #2ecc71; margin-right: 8px;"></i> İNDİR
// MISSING LINE 621
// MISSING LINE 622
// MISSING LINE 623
// MISSING LINE 624
// MISSING LINE 625
// MISSING LINE 626
// MISSING LINE 627
// MISSING LINE 628
// MISSING LINE 629
// MISSING LINE 630
// MISSING LINE 631
// MISSING LINE 632
// MISSING LINE 633
// MISSING LINE 634
// MISSING LINE 635
// MISSING LINE 636
// MISSING LINE 637
// MISSING LINE 638
// MISSING LINE 639
// MISSING LINE 640
// MISSING LINE 641
// MISSING LINE 642
// MISSING LINE 643
// MISSING LINE 644
// MISSING LINE 645
// MISSING LINE 646
// MISSING LINE 647
// MISSING LINE 648
// MISSING LINE 649
// MISSING LINE 650
              <input type="text" id="inventory-search" placeholder="Parça veya SAP no ara..." 
                     value="${searchQuery || ''}"
                     class="cyber-input-premium search-box-mini"
                     style="width: 100%; padding-right: 50px;"
                     onkeypress="if(event.key==='Enter') window.updateWarehouseUI(undefined, undefined, undefined, this.value)"
                     autofocus
                     onfocus="this.setSelectionRange(this.value.length, this.value.length)">
              <button onclick="window.updateWarehouseUI(undefined, undefined, undefined, document.getElementById('inventory-search').value)" 
                      style="position: absolute; right: 6px; width: 36px; height: 36px; background: var(--accent-blue); border: none; color: #0a1118; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; transition: all 0.2s;"
                      onmouseover="this.style.filter='brightness(1.1)';" 
                      onmouseout="this.style.filter='none';">
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
            </div>
            
            <button onclick="window.startQuickAudit('${selectedWarehouseId}')" class="btn-cyber" style="background: linear-gradient(135deg, #64ffda 0%, #48bb78 100%); color: #000; padding: 10px 18px; border-radius: 10px; font-size: 0.75rem; font-weight: 900; border: none; cursor: pointer; box-shado
// MISSING LINE 667
// MISSING LINE 668
// MISSING LINE 669
// MISSING LINE 670
// MISSING LINE 671
// MISSING LINE 672
// MISSING LINE 673
// MISSING LINE 674
// MISSING LINE 675
// MISSING LINE 676
// MISSING LINE 677
// MISSING LINE 678
// MISSING LINE 679
// MISSING LINE 680
// MISSING LINE 681
// MISSING LINE 682
// MISSING LINE 683
// MISSING LINE 684
// MISSING LINE 685
// MISSING LINE 686
// MISSING LINE 687
// MISSING LINE 688
// MISSING LINE 689
// MISSING LINE 690
// MISSING LINE 691
// MISSING LINE 692
// MISSING LINE 693
// MISSING LINE 694
// MISSING LINE 695
// MISSING LINE 696
// MISSING LINE 697
// MISSING LINE 698
// MISSING LINE 699
            <div class="stats-value">${logs.length}</div>
          </div>
          <div class="stats-card">
            <div class="stats-label">Son Hareket</div>
            <div class="stats-value" style="font-size: 1.2rem;">${logs.length > 0 ? formatTimestamp(logs[0].timestamp).split(' ')[1] : '-'}</div>
          </div>
          <div class="stats-card" style="background: rgba(100, 255, 218, 0.05); border-color: rgba(100, 255, 218, 0.1);">
            <div class="stats-label" style="color: var(--accent-blue);">Depo Durumu</div>
            <div class="stats-value" style="color: var(--accent-blue); font-size: 1.2rem;">AKTİF</div>
          </div>
        </div>

        <!-- Tab Switcher (Always Visible) -->
        <div style="display: flex; background: rgba(255,255,255,0.03); padding: 4px; border-radius: 12px; width: fit-content; margin-bottom: 2rem; border: 1px solid rgba(255,255,255,0.05);">
          <button onclick="window.changeTab('${selectedWarehouseId}', 'inventory')" class="premium-tab ${activeTab === 'inventory' ? 'active' : ''}">
            <i class="fa-solid fa-layer-group"></i> ENVANTER
          </button>
          <button onclick="window.changeTab('${selectedWarehouseId}', 'history')" class="premium-tab ${activeTab === 'history' ? 'active' : ''}">
            <i class="fa-solid fa-history"></i> GEÇMİŞ
          </button>
          <button onclick="window.changeTab('${selectedWarehouseId}', 'analytics')" class="premium-tab ${activeTab === 'analytics' ? 'active' : ''}">
            <i class="fa-solid fa-chart-line"></i> ANALİZ
          </button>
          <button onclick="window.changeTab('${selectedWarehouseId}', 'audit')" class="premium-tab ${activeTab === 'audit' ? 'active' : ''}">
            <i class="fa-solid fa-clipboard-check"></i> SAYIM
          </button>
          <button onclick="window.changeTab('${selectedWarehouseId}', 'audit_history')" class="premium-tab ${activeTab === 'audit_history' ? 'active' : ''}">
            <i class="fa-solid fa-file-invoice"></i> SAYIM GEÇMİŞİ
          </button>
        </div>

            <div class="premium-card" style="padding: 1.5rem; margin-bottom: 1.5rem; border-radius: 20px; border-left: 4px solid #ff9800;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 40px; height: 40px; background: rgba(255, 152, 0, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #ff9800;">
                    <i class="fa-solid fa-bookmark"></i>
                  </div>
                  <div>
                    <h4 style="margin: 0; color: #ff9800; font-weight: 900; font-size: 0.85rem; letter-spacing: 1px;">AKTİF REZERVASYONLAR</h4>
                    <p style="margin: 2px 0 0 0; color: var(--text-dim); font-size: 0.75rem;">${draftReservations.details.length} görevde toplam ${Object.values(draftReservations.bySap).reduce((a, b) => a + b, 0)} adet malzeme rezerve edildi</p>
                  </div>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${draftReservations.details.map(d => `
                  <div style="background: rgba(255, 152, 0, 0.04); border: 1px solid rgba(255, 152, 0, 0.1); border-radius: 14px; padding: 1rem 1.2rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: rgba(255, 152, 0, 0.15); color: #ff9800; padding: 3px 10px; border-radius: 8px; font-size: 0.65rem; font-weight: 900;">${d.team}</span>
                        <span style="color: var(--text-main); font-weight: 800; font-size: 0.8rem;"><i class="fa-solid fa-wind" style="color: var(--accent-blue); margin-right: 5px; font-size: 0.7rem;"></i>${d.turbinNo}</span>
                        <span style="color: var(--text-dim); font-size: 0.7rem; font-weight: 600;">${d.sablon}</span>
                    </div>
                    ${d.personnel.length > 0 ? `
                      <div style="display: flex; align-it
// MISSING LINE 754
// MISSING LINE 755
// MISSING LINE 756
// MISSING LINE 757
// MISSING LINE 758
// MISSING LINE 759
// MISSING LINE 760
// MISSING LINE 761
// MISSING LINE 762
// MISSING LINE 763
// MISSING LINE 764
// MISSING LINE 765
  
// MISSING LINE 767
// MISSING LINE 768
// MISSING LINE 769
            </div>
            ` : ''}

            <div class="premium-card" style="padding: 0; overflow: hidden; border-radius: 20px;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <th style="padding: 1.2rem 1rem; width: 50px; text-align: center;">
                      <input type="checkbox" id="master-checkbox" onchange="window.toggleAllBatch(this.checked)" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-blue);">
                    </th>
                    <th style="padding: 1.2rem 1.5rem; text-align: left; font-size: 0.65rem; color: ${(window as any).lastSortBy === 'description' ? 'var(--accent-blue)' : 'var(--text-dim)'}; text-transform: uppercase; letter-spacing: 1px; cursor: pointer;" onclick="window.updateWarehouseUI('${selectedWarehouseId}', 'description')">
// MISSING LINE 781
// MISSING LINE 782
// MISSING LINE 783
// MISSING LINE 784
                  <p style="margin: 4px 0 0 0; color: var(--text-dim); font-size: 0.85rem;">Şu an ${inventory.filter(i => i.criticalLimit && i.criticalLimit > 0 && i.quantity <= i.cri
// MISSING LINE 786
// MISSING LINE 787
// MISSING LINE 788
// MISSING LINE 789
// MISSING LINE 790
// MISSING LINE 791
// MISSING LINE 792
// MISSING LINE 793
// MISSING LINE 794
// MISSING LINE 795
// MISSING LINE 796
// MISSING LINE 797
// MISSING LINE 798
// MISSING LINE 799
                    ${inventoryData.length === 0 ? `
                      <tr>
                        <td colspan="7" style="padding: 4rem 1.5rem; text-align: center;">
                          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.2rem; animation: fadeIn 0.3s ease-out;">
                            <div style="width: 56px; height: 56px; background: rgba(255, 77, 77, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--danger); font-size: 1.5rem; border: 1px solid rgba(255, 77, 77, 0.2);">
                              <i class="fa-solid fa-triangle-exclamation"></i>
                            </div>
                            <div>
                              <h4 style="margin: 0; color: #ff4d4d; font-weight: 800; font-size: 1.1rem; letter-spacing: 0.5px;">BU ÜRÜN STOKTA YOK</h4>
                              <p style="margin: 6px 0 0 0; color: var(--text-dim); font-size: 0.85rem; font-weight: 500;">Aradığınız kriterlere uyan hiçbir malzeme bu depoda bulunamadı.</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ` : inventoryData.map(item => `
                      <tr class="material-row" style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                        <td style="padding: 1rem; text-align: center;">
                          <input typ
                      <td style="padding: 1rem 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 1.2rem;">
                          <div onclick="${item.imageUrl ? `window.viewMaterialImage('${item.imageUrl}', '${item.description.replace(/'/g, "\\'")}')` : `window.openImageUploadModal('${selectedWarehouseId}', '${item.id}')`}" 
                               style="width: 42px; height: 42px; border-radius: 10px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid rgba(255,255,255,0.05); overflow: hidden; position: relative;">
                            ${item.imageUrl ? 
                                `<img src="${item.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">` : 
                                `<i class="fa-solid fa-camera" style="color: var(--accent-blue); opacity: 0.5; font-size: 0.9rem;"></i>`
        
// MISSING LINE 826
// MISSING LINE 827
// MISSING LINE 828
// MISSING LINE 829
                              <i class="fa-solid fa-triangle-exclamation"></i>
                            </div>
                            <div>
                              <h4 style="margin: 0; color: #ff4d4d; font-weight: 800; font-size: 1.1rem; letter-spacing: 0.5px;">BU ÜRÜN STOKTA YOK</h4>
                              <p style="margin: 6px 0 0 0; color: var(--text-dim); font-size: 0.85rem; font-weight: 500;">Aradığınız kriterlere uyan hiçbir malzeme bu depoda bulunamadı.</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ` : inventoryData.map(item => `
                      <tr class="material-row" style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                        <td style="padding: 1rem; text-align: center;">
                          <input type="checkbox" class="item-checkbox" data-id="${item.id}" data-sap="${item.sapNo}" data-desc="${(item.description || '').replace(/"/g, '&quot;')}" onchange="window.updateBatchCount()" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-blue);">
                        </td>
                        <td style="padding: 1rem 1.5rem;">
                          <div style="display: flex; align-items: center; gap: 1.2rem;">
                            <div onclick="${item.imageUrl ? `window.viewMaterialImage('${item.imageUrl}', '${item.description.replace(/'/g, "\\'")}')` : `window.openImageUploadModal('${selectedWarehouseId}', '${item.id}')`}" 
                                 style="width: 42px; height: 42px; border-radius: 10px; background: rgba(255,255,255,
// MISSING LINE 848
// MISSING LINE 849
// MISSING LINE 850
// MISSING LINE 851
// MISSING LINE 852
// MISSING LINE 853
// MISSING LINE 854
// MISSING LINE 855
// MISSING LINE 856
// MISSING LINE 857
// MISSING LINE 858
                      <th style="padding: 1.2rem 1.5
// MISSING LINE 860
// MISSING LINE 861
// MISSING LINE 862
// MISSING LINE 863
// MISSING LINE 864
// MISSING LINE 865
// MISSING LINE 866
// MISSING LINE 867
// MISSING LINE 868
// MISSING LINE 869
// MISSING LINE 870
// MISSING LINE 871
// MISSING LINE 872
// MISSING LINE 873
// MISSING LINE 874
// MISSING LINE 875
// MISSING LINE 876
// MISSING LINE 877
// MISSING LINE 878
// MISSING LINE 879
// MISSING LINE 880
// MISSING LINE 881
                                  <span style="font-size: 0.5rem; opacity: 0.7; letter-spacing: 0.5px; margin-bottom: 2px;">KULLANILABİLİR</span>
                                  <span style="font-size: 0.9rem;">${net}</span>
                                </div>
                              `;
                            }
                            return '';
                          })()}
                        </div>
                      </td>
                      <td style="padding: 1rem 1.5rem; text-align: center;">
                        <div onclick="window.showReserveDetails('${String(item.sapNo).trim()}')" style="font-size: 1rem; font-weight: 800; color: #ff9800; cursor: pointer; padding: 10px; border-radius: 12px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255, 152, 0, 0.05)'" onmouseout="this.style.background='none'">
                          ${(() => {
                            const manual = item.reservedQuantity || 0;
                            const draft = draftReservations.bySap[String(item.sapNo).trim()] || 0;
                            const total = manual + draft;
                            return `
                              <div style="display: flex; flex-direction: column; align-items: center;">
                                <div style="font-size: 1.1rem;">${total}</div>
                                ${draft > 0 ? `<div style="font-size: 0.5rem; opacity: 0.7; color: #ff9800;">(+${draft} TASLAK)</div>` : ''}
                                <div style="font-size: 0.55rem; color: var(--text-dim); font-weight: 600; margin-top: 2px;">ADET <i class="fa-solid fa-circle-info" style="margin-left: 2px; font-size: 0.5rem; opacity: 0.5;"></i></div>
                              </div>
                            `;
                          })()}
                        </div>
                      </td>
                      <td style="padding: 1rem 1.5rem;">
                        <div style="display: flex; align-items: center; gap: 8px; color: var(--text-dim); font-size: 0.8rem; font-weight: 700;">
                          <div class="shelf-dot" style="background: ${item.shelfNo ? 'var(--accent-blue)' : 'rgba(255,255,255,0.2)'};"></div>
                          ${item.shelfNo || '-'}
                        </div>
                      </td>
                      <td style="padding: 1rem 1.5rem; text-align: right;">
                        <div style="display: flex; gap: 8px; justify-content: flex-end;">
                          <button class="action-icon-btn" onclick="window.requestTransferPrompt('${selectedWarehouseId}', '${item.id}', '${item.description.replace(/'/g, "\\'")}', '${String(item.sapNo || '').replace(/'/g, "\\'")}')" style="color: #64ffda; background: rgba(100, 255, 218, 0.05); border-color: rgba(100, 255, 218, 0.1);" title="Transfer Talep Et
                            <i class="fa-solid fa-truck-ramp-box"></i>
                          </button>
                          <button class="action-icon-btn" onclick="window.reserveMaterialPrompt('${selectedWarehouseId}', '${item.id}', '${item.description.replace(/'/g, "\\'")}', ${item.quantity})" style="color: #ff9800; background: rgba(255, 152, 0, 0.05); border-color: rgba(255, 152, 0, 0.1);" title="Rezerve Et">
                            <i class="fa-solid fa-bookmark"></i>
                          </button>
                          <button class="action-icon-btn" onclick="window.showItemHistory('${item.id}', '${item.description.replace(/'/g, "\\'")}')" style="color: var(--text-dim); background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1);" title="Malzeme Geçmişi">
                            <i class="fa-solid fa-clock-rotate-left"></i>
                          </button>
                          ${hasAddMaterialPerm ? `
<button class="action-icon-btn" onclick="window.editMaterial('${selectedWarehouseId}', '${item.id}')" style="color: var(--accent-blue); background: rgba(100, 255, 218, 0.05); border-color: rgba(100, 255, 218, 0.1);" title="Düzenle">
                            <i class="fa-solid fa-pen-to-square"></i>
                          </button>
                           ` : ''}
                           ${hasDeleteMaterialPerm ? `
<button class="action-icon-btn" onclick="window.deleteMaterial('${selectedWarehouseId}', '${item.id}', '${item.description}', '${item.sapNo}')" style="color: var(--danger); background: rgba(255, 77, 77, 0.05); border-color: rgba(255, 77, 77, 0.1);" title="Sil">
                            <i class="fa-solid fa-trash-can"></i>
                          </button>
                           ` : ''}
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : activeTab === 'history' ? `
            <div class="premium-card" style="padding: 0; overflow: hidden; border-radius: 20px;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <th style="padding: 1.2rem 1.5rem; text-align: left; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Tarih</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: left; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Malzeme</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: center; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">İşlem</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: center; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Miktar</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: left; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Referans</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: left; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Kullanıcı</th>
                  </tr>
                </thead>
                <tbody>
                  ${logs.map(log => `
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : activeTab === 'history' ? `
            <div class="premium-card" style="padding: 0; overflow: hidden; border-radius: 20px;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <th style="padding: 1.2rem 1.5rem; text-align: left; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Tarih</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: left; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Malzeme</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: center; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">İşlem</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: center; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Miktar</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: left; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Referans</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: left; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Kullanıcı</th>
                  </tr>
                </thead>
                <tbody>
                  ${logs.map(log => `
                    <tr class="material-row" style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                      <td style="padding: 1rem 1.5rem; font-size: 0.75rem; color: var(--text-dim);">${formatTimestamp(log.timestamp)}</td>
                      <td style="padding: 1rem 1.5rem; font-weight: 700; font-size: 0.9rem; color: var(--text-main);">${log.materialName || '-'}</td>
                      <td style="padding: 1rem 1.5rem; text-align: center;">
                        <span style="font-size: 0.65rem; font-weight: 900; padding: 4px 10px; border-radius: 6px; background: ${log.type === 'ADD' ? 'rgba(0, 255, 127, 0.05)' : 'rgba(255, 77, 77, 0.05)'}; color: ${log.type === 'ADD' ? '#00ff7f' : '#ff4d4d'}; border: 1px solid ${log.type === 'ADD' ? 'rgba(0, 255, 127, 0.1)' : 'rgba(255, 77, 77, 0.1)'};">
                          ${log.type === 'ADD' ? 'GİRİŞ' : 'ÇIKIŞ'}
                        </span>
                      </td>
                      <td style="padding: 1rem 1.5rem; text-align: center; font-weight: 900; color: var(--text-main);">${log.quantity || 0}</td>
                      <td style="padding: 1rem 1.5rem; font-size: 0.75rem; color: var(--text-dim);">
                        ${log.turbineNo ? `<span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">T-${log.turbineNo}</span>` : ''} 
                        ${log.formNo ? `<div style="font-size: 0.6rem; opacity: 0.5; margin-top: 2px;">#${log.formNo}</div>` : ''}
                      </td>
                      <td style="padding: 1rem 1.5rem; font-size: 0.75rem; color: var(--text-dim);">${String(log.user || '').split('@')[0] || 'Sistem'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : activeTab === 'analytics' ? `
            <div style="display: grid; grid-template-columns: 1.5fr 1fr; gap: 2rem;">
              <div class="premium-card" style="padding: 2rem;">
                <h4 style="margin-bottom: 1.5rem; color: var(--accent-blue); letter-spacing: 1px;">HAREKET TRENDİ</h4>
                <div style="height: 300px;"><canvas id="trendChart"></canvas></div>
              </div>
              <div class="premium-card" style="padding: 2rem;">
                <h4 style="margin-bottom: 1.5rem; color: var(--accent-blue); letter-spacing: 1px;">EN ÇOK KULLANILANLAR</h4>
                <div style="height: 300px;"><canvas id="usageChart"></canvas></div>
              </div>
              
              <div class="premium-card" style="padding: 2rem;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
                  <h4 style="margin: 0; color: #ff9800; letter-spacing: 1px;">ÖLÜ STOK (6 AY+ HARERETSİZ)</h4>
                  <span style="background: rgba(255, 152, 0, 0.1); color: #ff9800; padding: 4px 10px; border-radius: 8px; font-size: 0.7rem; font-weight: 900;">${obsoleteStock.length} KALEM</span>
                </div>
                <div style="max-height: 300px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px;">
                  ${obsoleteStock.length === 0 ? '<p style="color: var(--text-dim); text-align: center; padding: 2rem;">Hareketsiz stok bulunamadı.</p>' : obsoleteStock.map(i => `
                    <div style="background: rgba(0,0,0,0.2); padding: 12px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.03);">
                      <div>
                        <div style="font-weight: 700; color: var(--text-main); font-size: 0.8rem;">${i.description}</div>
                        <div style="font-size: 0.65rem; color: var(--text-dim); margin-top: 2px;">SAP: ${i.sapNo}</div>
// MISSING LINE 1021
// MISSING LINE 1022
// MISSING LINE 1023
// MISSING LINE 1024
// MISSING LINE 1025
// MISSING LINE 1026
// MISSING LINE 1027
// MISSING LINE 1028
// MISSING LINE 1029
// MISSING LINE 1030
// MISSING LINE 1031
// MISSING LINE 1032
// MISSING LINE 1033
// MISSING LINE 1034
// MISSING LINE 1035
// MISSING LINE 1036
// MISSING LINE 1037
// MISSING LINE 1038
// MISSING LINE 1039
// MISSING LINE 1040
// MISSING LINE 1041
// MISSING LINE 1042
// MISSING LINE 1043
// MISSING LINE 1044
// MISSING LINE 1045
// MISSING LINE 1046
// MISSING LINE 1047
// MISSING LINE 1048
// MISSING LINE 1049
// MISSING LINE 1050
// MISSING LINE 1051
// MISSING LINE 1052
// MISSING LINE 1053
// MISSING LINE 1054
// MISSING LINE 1055
// MISSING LINE 1056
// MISSING LINE 1057
// MISSING LINE 1058
// MISSING LINE 1059
// MISSING LINE 1060
// MISSING LINE 1061
// MISSING LINE 1062
// MISSING LINE 1063
// MISSING LINE 1064
// MISSING LINE 1065
// MISSING LINE 1066
// MISSING LINE 1067
// MISSING LINE 1068
// MISSING LINE 1069
// MISSING LINE 1070
// MISSING LINE 1071
// MISSING LINE 1072
// MISSING LINE 1073
// MISSING LINE 1074
// MISSING LINE 1075
// MISSING LINE 1076
// MISSING LINE 1077
// MISSING LINE 1078
// MISSING LINE 1079
                        </div>
                        <div style="padding: 1.5rem; border-radius: 20px; background: rgba(255,152,0,0.05); border: 1px solid rgba(255,152,0,0.1);">
                            <div style="font-size: 0.7rem; color: #ff9800; margin-bottom: 8px;">SAYIM BEKLEYEN</div>
                            <div style="font-size: 2rem; font-weight: 900;">${inventory.length - auditedCount}</div>
                        </div>
                        <div style="padding: 1.5rem; border-radius: 20px; background: rgba(255,77,77,0.05); border: 1px solid rgba(255,77,77,0.1);">
                            <div style="font-size: 0.7rem; color: #ff4d4d; margin-bottom: 8px;">KRİTİK STOK</div>
                            <div style="font-size: 2rem; font-weight: 900;">${criticalItems.length}</div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                      <div style="font-size: 0.65rem; color: var(--text-dim);">SAYIM DOĞRULUĞU</div>
                      <div style="font-size: 1.4rem; font-weight: 900; color: ${integrityScore > 80 ? 'var(--accent-blue)' : '#ff9800'};">${integrityScore}%</div>
                    </div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 4rem;">
                    <div style="width: 250px; height: 250px;"><canvas id="healthChart"></canvas></div>
                    <div style="flex: 1; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;">
                        <div style="padding: 1.5rem; border-radius: 20px; background: rgba(100,255,218,0.05); border: 1px solid rgba(100,255,218,0.1);">
                            <div style="font-size: 0.7rem; color: var(--accent-blue); margin-bottom: 8px;">SAĞLIKLI (SAYILMIŞ)</div>
                            <div style="font-size: 2rem; font-weight: 900;">${auditedCount}</div>
                        </div>
                        <div style="padding: 1.5rem; border-radius: 20px; background: rgba(255,152,0,0.05); border: 1px solid rgba(255,152,0,0.1);">
                            <div style="font-size: 0.7rem; color: #ff9800; margin-bottom: 8px;">SAYIM BEKLEYEN</div>
                            <div style="font-size: 2rem; font-weight: 900;">${inventory.length - auditedCount}</div>
    
// MISSING LINE 1107
// MISSING LINE 1108
// MISSING LINE 1109
// MISSING LINE 1110
// MISSING LINE 1111
// MISSING LINE 1112
// MISSING LINE 1113
// MISSING LINE 1114
// MISSING LINE 1115
// MISSING LINE 1116
// MISSING LINE 1117
// MISSING LINE 1118
// MISSING LINE 1119
// MISSING LINE 1120
// MISSING LINE 1121
// MISSING LINE 1122
// MISSING LINE 1123
// MISSING LINE 1124
// MISSING LINE 1125
// MISSING LINE 1126
// MISSING LINE 1127
// MISSING LINE 1128
// MISSING LINE 1129
// MISSING LINE 1130
// MISSING LINE 1131
// MISSING LINE 1132
// MISSING LINE 1133
// MISSING LINE 1134
// MISSING LINE 1135
                      <td style="padding: 1.2rem 1.5rem; font-weight: 700; color: var(--text-main);">${auditDate} <span style="font-weight: 400; font-size: 0.7rem; opacity: 0.5; margin-left: 10px;">${auditTime}</span></td>
                      <td style="padding: 1.2rem 1.5rem; color: var(--text-main); font-weight: 600; font-size: 0.85rem;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <div style="width: 24px; height: 24px; border-radius: 50%; background: rgba(100, 255, 218, 0.1); display: flex; align-items: center; justify-content: center; border: 1px solid rgba(100, 255, 218, 0.2);">
                            <i class="fa-solid fa-user" style="font-size: 0.7rem; color: var(--accent-blue);"></i>
                          </div>
                          ${audit.user?.split('@')[0]?.toUpperCase() || 'SİSTEM'}
                        </div>
                      </td>
                      <td style="padding: 1.2rem 1.5rem; text-align: center; font-weight: 800; color: var(--text-main);">${audit.totalItems || audit.results?.length || 0}</td>
                      <td style="padding: 1.2rem 1.5rem; text-align: center; font-weight: 800; color: ${discrepantItems > 0 ? '#ff4d4d' : 'var(--text-main)'};">${discrepantItems}</td>
                      <td style="padding: 1.2rem 1.5rem; text-align: right;">
                        <div style="display: flex; gap: 10px; justify-content: flex-end;">
                          <button class="action-icon-btn" onclick="window.viewAuditDetails('${audit.id}')" title="Detayları Gör" style="color: var(--accent-blue);">
                            <i class="fa-solid fa-eye"></i>
                          </button>
                          <button class="action-icon-btn" onclick="window.downloadAuditExcel('${audit.id}')" title="Excel İndir" style="color: #2ecc71;">
                            <i class="fa-solid fa-file-excel"></i>
                          </button>
                        </div>
                      <th style="padding: 1.2rem 1.5rem; text-align: center; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Toplam Kalem</th>
                      <th style="padding: 1.2rem 1.5rem; text-align: center; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Hatalı Kalem</th>
                      <th style="padding: 1.2rem 1.5rem; text-align: right; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${audits.length === 0 ? `
                      <tr><td colspan="6" style="padding: 4rem; text-align: center; color: var(--text-dim);">Henüz bir sayım kaydı bulunmuyor.</td></tr>
                    ` : audits.map(audit => {
                      const auditDate = audit.date || (audit.timestamp ? new Date(audit.timestamp.seconds * 1000).toLocaleDateString('tr-TR') : 'Bilinmiyor');
                      const auditTime = audit.timestamp ? formatTimestamp(audit.timestamp).split(' ')[1] : '--:--';
                      const discrepantItems = (audit as any).discrepantItems ?? 0;
                      return `
                      <tr class="material-row" style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                        <td style="padding: 1.2rem 1.5rem; font-weight: 700; color: var(--text-main);">${auditDate} <span style="font-weight: 400; font-size: 0.7rem; opacity: 0.5; margin-left: 10px;">${auditTime}</span></td>
                        <td style="padding: 1.2rem 1.5rem; color: var(--text-main); font-weight: 600; font-size: 0.85rem;">
                          <div style="display: flex; align-items: center; gap: 
                      <div id="audit-total-count" style="font-weight: 800; color: var(--accent-blue);">${inventoryData.length}</div>
                    </div>
                      <div id="audit-total-count" style="font-weight: 800; color: var(--accent-blue);">${inventoryData.length}</div>
                    </div>
                    <div style="text-align: center; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 20px;">
                      <div style="font-size: 0.6rem; color: var(--text-dim); text-transform: uppercase;">Hatalı Kalem</div>
                      <div id="audit-error-count" style="font-weight: 800; color: var(--text-main);">0</div>
                      <div style="font-size: 0.55rem; color: var(--text-dim); margin-top: 2px;">
                        <span id="audit-surplus-count" style="color: #00ff7f;">↑ 0</span> | 
                        <span id="audit-deficit-count" style="color: #ff4d4d;">↓ 0</span>
                      </div>
                    </div>
                  </div>
                  <button onclick="window.finishAudit('${selectedWarehouseId}')" class="btn-cyber" style="padding: 12px 25px;">
                    <i class="fa-solid fa-check-double"></i> SAYIMI TAMAMLA
                  </button>
                </div>
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: rgba(255,255,255,0.02);">
                    <th onclick="window.updateWarehouseUI('${selectedWarehouseId}', 'name')" style="padding: 1rem; text-align: left; font-size: 0.7rem; co
// MISSING LINE 1195
// MISSING LINE 1196
// MISSING LINE 1197
// MISSING LINE 1198
// MISSING LINE 1199
// MISSING LINE 1200
// MISSING LINE 1201
// MISSING LINE 1202
// MISSING LINE 1203
// MISSING LINE 1204
// MISSING LINE 1205
// MISSING LINE 1206
// MISSING LINE 1207
// MISSING LINE 1208
// MISSING LINE 1209
// MISSING LINE 1210
// MISSING LINE 1211
// MISSING LINE 1212
// MISSING LINE 1213
// MISSING LINE 1214
// MISSING LINE 1215
                          ${item.shelfNo || '-'}
                        </span>
                      </td>
                      <td style="padding: 1rem; text-align: center; font-weight: 800; color: var(--text-main);">${item.quantity}</td>
                      <td style="padding: 1rem; text-align: center;">
                        <input type="number" class="audit-input" data-item-id="${item.id}" data-system-qty="${item.quantity}" value="${item.quantity}" oninput="window.updateAuditSummary()" style="width: 80px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 8px; border-radius: 8px; text-align: center; font-weight: 700; font-family: 'JetBrains Mono', monospace;">
                      </td>
                      <td style="padding: 1rem; text-align: right; font-weight: 900; color: var(--text-main);" id="diff-${item.id}">0</td>
                    </tr>
                    <tr id="note-row-${item.id}" style="display: none; background: rgba(255, 77, 77, 0.03);">
                      <td colspan="5" style="padding: 0.5rem 1rem 1rem 1rem;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                          <i class="fa-solid fa-message" style="color: #ff4d4d; font-size: 0.8rem; opacity: 0.7;"></i>
                          <input type="text" class="audit-note" data-item-id="${item.id}" placeholder="Farkın nedeni hakkında kısa bir açıklama yazın..." 
                                 style="flex: 1; background: rgba(0,0,0,0.2); border: 1px solid rgba(255, 77, 77, 0.2); color: var(--text-main); padding: 8px 12px; border-radius: 6px; font-size: 0.75rem; outline: none;">
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <input type="file" id="material-image-input" style="display: none;" accept="image/*">
        <input type="file" id="excel-upload-input" style="display: none;" accept=".xlsx, .xls" onchange="window.handleExcelUpload(event, '${selectedWarehouseId}')">
        <input type="hidden" id="upload-warehouse-id">
        <input type="hidden" id="upload-item-id">
        <!-- Antigravity Agent Status Bar -->
        <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; opacity: 0.8;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 8px; background: rgba(100, 255, 218, 0.05); padding: 6px 14px; border-radius: 100px; border: 1px solid rgba(100, 255, 218, 0.1);">
              <div style="width: 6px; height: 6px; border-radius: 50%; background: #64ffda; box-shadow: 0 0 10px #64ffda; animation: pulse 2s infinite;"></div>
              <span style="font-size: 0.6rem; font-weight: 900; color: var(--accent-blue); letter-spacing: 1px; text-transform: uppercase;">System Secure</span>
            </div>
            <div style="font-size: 0.65rem; color: var(--text-dim); font-weight: 500;">Antigravity OS v4.2.0 • All Systems Nominal</div>
          </div>
          
          <div style="display: flex; gap: 1.5rem; align-items: center;">
            <div style="display: flex; gap: 12px; padding: 4px 12px; background: rgba(0,0,0,0.2); border-radius: 10px; border: 1px solid rgba(255,255,255,0.03);">
              <div title="Frontend Architect" style="display: flex; align-items: center; gap: 5px;">
                <div style="width: 4px; height: 4px; border-radius: 50%; background: #64ffda;"></div>
                <span style="font-size: 0.55rem; color: var(--text-dim); font-weight: 800; letter-spacing: 0.5px;">FE</span>
              </div>
// MISSING LINE 1261
// MISSING LINE 1262
// MISSING LINE 1263
// MISSING LINE 1264
// MISSING LINE 1265
// MISSING LINE 1266
// MISSING LINE 1267
// MISSING LINE 1268
// MISSING LINE 1269
// MISSING LINE 1270
// MISSING LINE 1271
// MISSING LINE 1272
// MISSING LINE 1273
// MISSING LINE 1274
// MISSING LINE 1275
// MISSING LINE 1276
// MISSING LINE 1277
// MISSING LINE 1278
// MISSING LINE 1279
// MISSING LINE 1280
// MISSING LINE 1281
// MISSING LINE 1282
// MISSING LINE 1283
// MISSING LINE 1284
// MISSING LINE 1285
// MISSING LINE 1286
// MISSING LINE 1287
// MISSING LINE 1288
// MISSING LINE 1289
// MISSING LINE 1290
// MISSING LINE 1291
// MISSING LINE 1292
// MISSING LINE 1293
// MISSING LINE 1294
// MISSING LINE 1295
// MISSING LINE 1296
// MISSING LINE 1297
// MISSING LINE 1298
// MISSING LINE 1299
// MISSING LINE 1300
// MISSING LINE 1301
// MISSING LINE 1302
// MISSING LINE 1303
// MISSING LINE 1304
// MISSING LINE 1305
// MISSING LINE 1306
// MISSING LINE 1307
// MISSING LINE 1308
// MISSING LINE 1309
// MISSING LINE 1310
// MISSING LINE 1311
// MISSING LINE 1312
// MISSING LINE 1313
// MISSING LINE 1314
// MISSING LINE 1315
// MISSING LINE 1316
// MISSING LINE 1317
// MISSING LINE 1318
// MISSING LINE 1319
// MISSING LINE 1320
// MISSING LINE 1321
// MISSING LINE 1322
// MISSING LINE 1323
// MISSING LINE 1324
// MISSING LINE 1325
// MISSING LINE 1326
// MISSING LINE 1327
// MISSING LINE 1328
// MISSING LINE 1329
// MISSING LINE 1330
// MISSING LINE 1331
// MISSING LINE 1332
// MISSING LINE 1333
// MISSING LINE 1334
// MISSING LINE 1335
// MISSING LINE 1336
// MISSING LINE 1337
// MISSING LINE 1338
// MISSING LINE 1339
// MISSING LINE 1340
// MISSING LINE 1341
// MISSING LINE 1342
// MISSING LINE 1343
// MISSING LINE 1344
// MISSING LINE 1345
// MISSING LINE 1346
// MISSING LINE 1347
// MISSING LINE 1348
// MISSING LINE 1349
// MISSING LINE 1350
// MISSING LINE 1351
// MISSING LINE 1352
// MISSING LINE 1353
// MISSING LINE 1354
// MISSING LINE 1355
// MISSING LINE 1356
// MISSING LINE 1357
// MISSING LINE 1358
// MISSING LINE 1359
// MISSING LINE 1360
// MISSING LINE 1361
// MISSING LINE 1362
// MISSING LINE 1363
// MISSING LINE 1364
// MISSING LINE 1365
// MISSING LINE 1366
// MISSING LINE 1367
// MISSING LINE 1368
// MISSING LINE 1369
// MISSING LINE 1370
// MISSING LINE 1371
// MISSING LINE 1372
// MISSING LINE 1373
// MISSING LINE 1374
// MISSING LINE 1375
// MISSING LINE 1376
// MISSING LINE 1377
// MISSING LINE 1378
// MISSING LINE 1379
// MISSING LINE 1380
// MISSING LINE 1381
// MISSING LINE 1382
// MISSING LINE 1383
// MISSING LINE 1384
// MISSING LINE 1385
// MISSING LINE 1386
// MISSING LINE 1387
// MISSING LINE 1388
// MISSING LINE 1389
// MISSING LINE 1390
// MISSING LINE 1391
// MISSING LINE 1392
// MISSING LINE 1393
// MISSING LINE 1394
// MISSING LINE 1395
// MISSING LINE 1396
// MISSING LINE 1397
// MISSING LINE 1398
        background: radial-gradient(ellipse at center, var(--wh-accent-dim) 0%, transparent 60%);
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.5s;
        z-index: 0;
      }

      .wh-card:hover::after,
      .wh-card:active::after {
        opacity: 1;
      }

      /* Desktop hover effects */
      @media (hover: hover) {
        .wh-card:hover {
          background: var(--wh-bg-card-hover);
          border-color: var(--wh-border-hover);
          transform: translateY(-6px);
          box-shadow: 
            0 20px 40px rgba(0, 0, 0, 0.35),
            0 0 30px var(--wh-accent-glow);
        }
        .wh-card:hover .wh-card-icon {
          background: var(--wh-accent);
          color: #0a192f;
          transform: scale(1.08);
          box-shadow: 0 8px 30px var(--wh-accent-glow);
        }
        .wh-card:hover .wh-card-cta i {
          transform: translateX(4px);
        }
      }

      /* Touch active state */
      @media (hover: none) {
        .wh-card:active {
          background: var(--wh-bg-card-hover);
          border-color: var(--wh-border-hover);
          transform: scale(0.98);
        }
        .wh-card:active .wh-card-icon {
          background: var(--wh-accent);
          color: #0a192f;
        }
      }

      .wh-card-icon {
        position: relative;
        z-index: 1;
        width: 72px;
        height: 72px;
        background: var(--wh-accent-dim);
        border-radius: 20px;
        display: flex;
        align-items: center;
      
// MISSING LINE 1455
// MISSING LINE 1456
// MISSING LINE 1457
// MISSING LINE 1458
// MISSING LINE 1459
// MISSING LINE 1460
// MISSING LINE 1461
// MISSING LINE 1462
// MISSING LINE 1463
// MISSING LINE 1464
// MISSING LINE 1465
// MISSING LINE 1466
// MISSING LINE 1467
// MISSING LINE 1468
// MISSING LINE 1469
// MISSING LINE 1470
// MISSING LINE 1471
// MISSING LINE 1472
// MISSING LINE 1473
// MISSING LINE 1474
// MISSING LINE 1475
// MISSING LINE 1476
// MISSING LINE 1477
// MISSING LINE 1478
// MISSING LINE 1479
// MISSING LINE 1480
// MISSING LINE 1481
// MISSING LINE 1482
// MISSING LINE 1483
// MISSING LINE 1484
// MISSING LINE 1485
// MISSING LINE 1486
// MISSING LINE 1487
// MISSING LINE 1488
// MISSING LINE 1489
// MISSING LINE 1490
// MISSING LINE 1491
// MISSING LINE 1492
// MISSING LINE 1493
// MISSING LINE 1494
// MISSING LINE 1495
// MISSING LINE 1496
// MISSING LINE 1497
// MISSING LINE 1498
// MISSING LINE 1499
// MISSING LINE 1500
// MISSING LINE 1501
// MISSING LINE 1502
// MISSING LINE 1503
// MISSING LINE 1504
// MISSING LINE 1505
// MISSING LINE 1506
// MISSING LINE 1507
// MISSING LINE 1508
// MISSING LINE 1509
// MISSING LINE 1510
// MISSING LINE 1511
// MISSING LINE 1512
// MISSING LINE 1513
// MISSING LINE 1514
// MISSING LINE 1515
// MISSING LINE 1516
// MISSING LINE 1517
// MISSING LINE 1518
// MISSING LINE 1519
// MISSING LINE 1520
// MISSING LINE 1521
// MISSING LINE 1522
// MISSING LINE 1523
// MISSING LINE 1524
// MISSING LINE 1525
// MISSING LINE 1526
// MISSING LINE 1527
// MISSING LINE 1528
// MISSING LINE 1529
// MISSING LINE 1530
// MISSING LINE 1531
// MISSING LINE 1532
// MISSING LINE 1533
// MISSING LINE 1534
// MISSING LINE 1535
// MISSING LINE 1536
// MISSING LINE 1537
// MISSING LINE 1538
// MISSING LINE 1539
// MISSING LINE 1540
// MISSING LINE 1541
// MISSING LINE 1542
// MISSING LINE 1543
// MISSING LINE 1544
// MISSING LINE 1545
// MISSING LINE 1546
// MISSING LINE 1547
// MISSING LINE 1548
// MISSING LINE 1549
// MISSING LINE 1550
// MISSING LINE 1551
// MISSING LINE 1552
// MISSING LINE 1553
// MISSING LINE 1554
// MISSING LINE 1555
// MISSING LINE 1556
// MISSING LINE 1557
// MISSING LINE 1558
// MISSING LINE 1559
// MISSING LINE 1560
// MISSING LINE 1561
// MISSING LINE 1562
// MISSING LINE 1563
// MISSING LINE 1564
// MISSING LINE 1565
// MISSING LINE 1566
// MISSING LINE 1567
// MISSING LINE 1568
// MISSING LINE 1569
// MISSING LINE 1570
// MISSING LINE 1571
// MISSING LINE 1572
// MISSING LINE 1573
// MISSING LINE 1574
// MISSING LINE 1575
// MISSING LINE 1576
// MISSING LINE 1577
// MISSING LINE 1578
// MISSING LINE 1579
// MISSING LINE 1580
// MISSING LINE 1581
// MISSING LINE 1582
// MISSING LINE 1583
// MISSING LINE 1584
// MISSING LINE 1585
// MISSING LINE 1586
// MISSING LINE 1587
// MISSING LINE 1588
// MISSING LINE 1589
// MISSING LINE 1590
// MISSING LINE 1591
// MISSING LINE 1592
// MISSING LINE 1593
// MISSING LINE 1594
// MISSING LINE 1595
// MISSING LINE 1596
// MISSING LINE 1597
// MISSING LINE 1598
// MISSING LINE 1599
// MISSING LINE 1600
// MISSING LINE 1601
// MISSING LINE 1602
// MISSING LINE 1603
// MISSING LINE 1604
// MISSING LINE 1605
// MISSING LINE 1606
// MISSING LINE 1607
// MISSING LINE 1608
// MISSING LINE 1609
// MISSING LINE 1610
// MISSING LINE 1611
// MISSING LINE 1612
// MISSING LINE 1613
// MISSING LINE 1614
// MISSING LINE 1615
// MISSING LINE 1616
// MISSING LINE 1617
// MISSING LINE 1618
// MISSING LINE 1619
// MISSING LINE 1620
// MISSING LINE 1621
// MISSING LINE 1622
// MISSING LINE 1623
// MISSING LINE 1624
// MISSING LINE 1625
// MISSING LINE 1626
// MISSING LINE 1627
// MISSING LINE 1628
// MISSING LINE 1629
// MISSING LINE 1630
// MISSING LINE 1631
// MISSING LINE 1632
// MISSING LINE 1633
// MISSING LINE 1634
// MISSING LINE 1635
// MISSING LINE 1636
// MISSING LINE 1637
// MISSING LINE 1638
// MISSING LINE 1639
// MISSING LINE 1640
// MISSING LINE 1641
// MISSING LINE 1642
// MISSING LINE 1643
// MISSING LINE 1644
// MISSING LINE 1645
// MISSING LINE 1646
// MISSING LINE 1647
// MISSING LINE 1648
// MISSING LINE 1649
// MISSING LINE 1650
// MISSING LINE 1651
// MISSING LINE 1652
// MISSING LINE 1653
// MISSING LINE 1654
// MISSING LINE 1655
// MISSING LINE 1656
// MISSING LINE 1657
// MISSING LINE 1658
// MISSING LINE 1659
// MISSING LINE 1660
// MISSING LINE 1661
// MISSING LINE 1662
// MISSING LINE 1663
// MISSING LINE 1664
// MISSING LINE 1665
// MISSING LINE 1666
// MISSING LINE 1667
// MISSING LINE 1668
// MISSING LINE 1669
// MISSING LINE 1670
// MISSING LINE 1671
// MISSING LINE 1672
// MISSING LINE 1673
// MISSING LINE 1674
// MISSING LINE 1675
// MISSING LINE 1676
// MISSING LINE 1677
// MISSING LINE 1678
// MISSING LINE 1679
// MISSING LINE 1680
// MISSING LINE 1681
// MISSING LINE 1682
// MISSING LINE 1683
// MISSING LINE 1684
// MISSING LINE 1685
// MISSING LINE 1686
// MISSING LINE 1687
// MISSING LINE 1688
// MISSING LINE 1689
// MISSING LINE 1690
// MISSING LINE 1691
// MISSING LINE 1692
// MISSING LINE 1693
// MISSING LINE 1694
// MISSING LINE 1695
// MISSING LINE 1696
// MISSING LINE 1697
// MISSING LINE 1698
// MISSING LINE 1699
// MISSING LINE 1700
// MISSING LINE 1701
// MISSING LINE 1702
// MISSING LINE 1703
// MISSING LINE 1704
// MISSING LINE 1705
// MISSING LINE 1706
// MISSING LINE 1707
// MISSING LINE 1708
// MISSING LINE 1709
// MISSING LINE 1710
// MISSING LINE 1711
// MISSING LINE 1712
// MISSING LINE 1713
// MISSING LINE 1714
// MISSING LINE 1715
// MISSING LINE 1716
// MISSING LINE 1717
// MISSING LINE 1718
// MISSING LINE 1719
// MISSING LINE 1720
// MISSING LINE 1721
// MISSING LINE 1722
// MISSING LINE 1723
// MISSING LINE 1724
// MISSING LINE 1725
// MISSING LINE 1726
// MISSING LINE 1727
// MISSING LINE 1728
// MISSING LINE 1729
  const form = document.getElementById('add-material-form') as HTMLFormElement;
  const title = document.getElementById('modal-title');
  const sapStatus = document.getElementById('sap-status-icon');

  if (modal && whInput && itemInput) {
    form.reset();
    (window as any).pendingMaterialImage = null;
    if (sapStatus) sapStatus.innerHTML = '';
    whInput.value = warehouseId;
    itemInput.value = '';
    
    // Reset image UI
    const imgContainer = document.getElementById('modal-image-preview-container');
    const noImgArea = document.getElementById('modal-no-image');
    if (imgContainer) imgContainer.style.display = 'none';
    if (noImgArea) noImgArea.style.display = 'flex';

    if (title) title.textContent = 'Yeni Malzeme Kaydı';
    modal.style.display = 'flex';
    setTimeout(() => {
        const content = modal.querySelector('.modal-content') as HTMLElement;
        if (content) content.style.transform = 'scale(1)';
    }, 10);
  }
};

(window as any).editMaterial = async (warehouseId: string, itemId: string) => {
  const currentUser = (window as any).currentUser;
  const isUserAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const warehousePerms = currentUser?.allowedTabs?.warehouses || {};
  const hasAddPerm = isUserAdmin || (typeof warehousePerms === 'object' && !!(warehousePerms as any).addMaterial);
  if (!hasAddPerm) {
    alert('❌ Malzeme düzenleme yetkiniz bulunmamaktadır.');
    return;
  }

  const btn = event?.currentTarget as HTMLButtonElement;
  const originalIcon = btn ? btn.innerHTML : '';
  
  try {
    if (btn) {
// MISSING LINE 1771
// MISSING LINE 1772
// MISSING LINE 1773
// MISSING LINE 1774
// MISSING LINE 1775
// MISSING LINE 1776
// MISSING LINE 1777
// MISSING LINE 1778
// MISSING LINE 1779
// MISSING LINE 1780
// MISSING LINE 1781
// MISSING LINE 1782
// MISSING LINE 1783
// MISSING LINE 1784
// MISSING LINE 1785
// MISSING LINE 1786
// MISSING LINE 1787
// MISSING LINE 1788
// MISSING LINE 1789
// MISSING LINE 1790
// MISSING LINE 1791
// MISSING LINE 1792
// MISSING LINE 1793
// MISSING LINE 1794
// MISSING LINE 1795
// MISSING LINE 1796
// MISSING LINE 1797
// MISSING LINE 1798
// MISSING LINE 1799
// MISSING LINE 1800
// MISSING LINE 1801
// MISSING LINE 1802
// MISSING LINE 1803
// MISSING LINE 1804
// MISSING LINE 1805
// MISSING LINE 1806
// MISSING LINE 1807
// MISSING LINE 1808
// MISSING LINE 1809
// MISSING LINE 1810
// MISSING LINE 1811
// MISSING LINE 1812
// MISSING LINE 1813
// MISSING LINE 1814
// MISSING LINE 1815
// MISSING LINE 1816
// MISSING LINE 1817
// MISSING LINE 1818
// MISSING LINE 1819
// MISSING LINE 1820
// MISSING LINE 1821
// MISSING LINE 1822
// MISSING LINE 1823
// MISSING LINE 1824
// MISSING LINE 1825
// MISSING LINE 1826
// MISSING LINE 1827
// MISSING LINE 1828
// MISSING LINE 1829
// MISSING LINE 1830
// MISSING LINE 1831
// MISSING LINE 1832
// MISSING LINE 1833
// MISSING LINE 1834
// MISSING LINE 1835
// MISSING LINE 1836
// MISSING LINE 1837
// MISSING LINE 1838
// MISSING LINE 1839
// MISSING LINE 1840
// MISSING LINE 1841
// MISSING LINE 1842
// MISSING LINE 1843
// MISSING LINE 1844
// MISSING LINE 1845
// MISSING LINE 1846
// MISSING LINE 1847
// MISSING LINE 1848
// MISSING LINE 1849
// MISSING LINE 1850
// MISSING LINE 1851
// MISSING LINE 1852
// MISSING LINE 1853
// MISSING LINE 1854
// MISSING LINE 1855
// MISSING LINE 1856
// MISSING LINE 1857
// MISSING LINE 1858
// MISSING LINE 1859
// MISSING LINE 1860
// MISSING LINE 1861
// MISSING LINE 1862
// MISSING LINE 1863
// MISSING LINE 1864
// MISSING LINE 1865
// MISSING LINE 1866
// MISSING LINE 1867
// MISSING LINE 1868
// MISSING LINE 1869
// MISSING LINE 1870
// MISSING LINE 1871
// MISSING LINE 1872
// MISSING LINE 1873
// MISSING LINE 1874
// MISSING LINE 1875
// MISSING LINE 1876
// MISSING LINE 1877
// MISSING LINE 1878
// MISSING LINE 1879
// MISSING LINE 1880
// MISSING LINE 1881
// MISSING LINE 1882
// MISSING LINE 1883
// MISSING LINE 1884
// MISSING LINE 1885
// MISSING LINE 1886
// MISSING LINE 1887
// MISSING LINE 1888
// MISSING LINE 1889
// MISSING LINE 1890
// MISSING LINE 1891
// MISSING LINE 1892
// MISSING LINE 1893
// MISSING LINE 1894
// MISSING LINE 1895
// MISSING LINE 1896
// MISSING LINE 1897
// MISSING LINE 1898
// MISSING LINE 1899
// MISSING LINE 1900
// MISSING LINE 1901
// MISSING LINE 1902
// MISSING LINE 1903
// MISSING LINE 1904
// MISSING LINE 1905
// MISSING LINE 1906
// MISSING LINE 1907
// MISSING LINE 1908
// MISSING LINE 1909
// MISSING LINE 1910
// MISSING LINE 1911
// MISSING LINE 1912
// MISSING LINE 1913
// MISSING LINE 1914
// MISSING LINE 1915
// MISSING LINE 1916
// MISSING LINE 1917
// MISSING LINE 1918
// MISSING LINE 1919
// MISSING LINE 1920
// MISSING LINE 1921
// MISSING LINE 1922
// MISSING LINE 1923
// MISSING LINE 1924
// MISSING LINE 1925
// MISSING LINE 1926
// MISSING LINE 1927
// MISSING LINE 1928
// MISSING LINE 1929
      console.error('[EditMaterial] Modal or required inputs 
// MISSING LINE 1931
// MISSING LINE 1932
// MISSING LINE 1933
// MISSING LINE 1934
// MISSING LINE 1935
// MISSING LINE 1936
// MISSING LINE 1937
// MISSING LINE 1938
// MISSING LINE 1939
// MISSING LINE 1940
// MISSING LINE 1941
// MISSING LINE 1942
// MISSING LINE 1943
// MISSING LINE 1944
// MISSING LINE 1945
// MISSING LINE 1946
// MISSING LINE 1947
// MISSING LINE 1948
// MISSING LINE 1949
// MISSING LINE 1950
// MISSING LINE 1951
// MISSING LINE 1952
// MISSING LINE 1953
// MISSING LINE 1954
// MISSING LINE 1955
// MISSING LINE 1956
// MISSING LINE 1957
// MISSING LINE 1958
// MISSING LINE 1959
// MISSING LINE 1960
// MISSING LINE 1961
// MISSING LINE 1962
// MISSING LINE 1963
// MISSING LINE 1964
// MISSING LINE 1965
// MISSING LINE 1966
// MISSING LINE 1967
// MISSING LINE 1968
// MISSING LINE 1969
// MISSING LINE 1970
// MISSING LINE 1971
// MISSING LINE 1972
// MISSING LINE 1973
// MISSING LINE 1974
// MISSING LINE 1975
// MISSING LINE 1976
// MISSING LINE 1977
// MISSING LINE 1978
// MISSING LINE 1979
// MISSING LINE 1980
// MISSING LINE 1981
// MISSING LINE 1982
// MISSING LINE 1983
// MISSING LINE 1984
// MISSING LINE 1985
// MISSING LINE 1986
// MISSING LINE 1987
// MISSING LINE 1988
// MISSING LINE 1989
// MISSING LINE 1990
// MISSING LINE 1991
// MISSING LINE 1992
// MISSING LINE 1993
// MISSING LINE 1994
// MISSING LINE 1995
// MISSING LINE 1996
// MISSING LINE 1997
// MISSING LINE 1998
// MISSING LINE 1999
// MISSING LINE 2000
// MISSING LINE 2001
// MISSING LINE 2002
// MISSING LINE 2003
// MISSING LINE 2004
// MISSING LINE 2005
// MISSING LINE 2006
// MISSING LINE 2007
// MISSING LINE 2008
// MISSING LINE 2009
// MISSING LINE 2010
// MISSING LINE 2011
// MISSING LINE 2012
// MISSING LINE 2013
// MISSING LINE 2014
// MISSING LINE 2015
// MISSING LINE 2016
// MISSING LINE 2017
// MISSING LINE 2018
// MISSING LINE 2019
// MISSING LINE 2020
// MISSING LINE 2021
// MISSING LINE 2022
// MISSING LINE 2023
// MISSING LINE 2024
// MISSING LINE 2025
            if (itemId) setTimeout(() => { (window as a
// MISSING LINE 2027
// MISSING LINE 2028
// MISSING LINE 2029
// MISSING LINE 2030
// MISSING LINE 2031
// MISSING LINE 2032
// MISSING LINE 2033
// MISSING LINE 2034
// MISSING LINE 2035
// MISSING LINE 2036
// MISSING LINE 2037
// MISSING LINE 2038
// MISSING LINE 2039
// MISSING LINE 2040
// MISSING LINE 2041
// MISSING LINE 2042
// MISSING LINE 2043
// MISSING LINE 2044
// MISSING LINE 2045
// MISSING LINE 2046
// MISSING LINE 2047
// MISSING LINE 2048
// MISSING LINE 2049
// MISSING LINE 2050
// MISSING LINE 2051
// MISSING LINE 2052
// MISSING LINE 2053
// MISSING LINE 2054
// MISSING LINE 2055
// MISSING LINE 2056
// MISSING LINE 2057
// MISSING LINE 2058
// MISSING LINE 2059
// MISSING LINE 2060
// MISSING LINE 2061
// MISSING LINE 2062
// MISSING LINE 2063
// MISSING LINE 2064
// MISSING LINE 2065
// MISSING LINE 2066
// MISSING LINE 2067
// MISSING LINE 2068
// MISSING LINE 2069
// MISSING LINE 2070
// MISSING LINE 2071
// MISSING LINE 2072
// MISSING LINE 2073
// MISSING LINE 2074
// MISSING LINE 2075
// MISSING LINE 2076
// MISSING LINE 2077
// MISSING LINE 2078
// MISSING LINE 2079
// MISSING LINE 2080
// MISSING LINE 2081
// MISSING LINE 2082
// MISSING LINE 2083
// MISSING LINE 2084
// MISSING LINE 2085
// MISSING LINE 2086
// MISSING LINE 2087
// MISSING LINE 2088
// MISSING LINE 2089
// MISSING LINE 2090
// MISSING LINE 2091
// MISSING LINE 2092
// MISSING LINE 2093
// MISSING LINE 2094
// MISSING LINE 2095
// MISSING LINE 2096
// MISSING LINE 2097
// MISSING LINE 2098
// MISSING LINE 2099
// MISSING LINE 2100
// MISSING LINE 2101
// MISSING LINE 2102
// MISSING LINE 2103
// MISSING LINE 2104
// MISSING LINE 2105
// MISSING LINE 2106
// MISSING LINE 2107
// MISSING LINE 2108
// MISSING LINE 2109
// MISSING LINE 2110
// MISSING LINE 2111
// MISSING LINE 2112
// MISSING LINE 2113
// MISSING LINE 2114
// MISSING LINE 2115
// MISSING LINE 2116
// MISSING LINE 2117
// MISSING LINE 2118
// MISSING LINE 2119
// MISSING LINE 2120
// MISSING LINE 2121
// MISSING LINE 2122
// MISSING LINE 2123
// MISSING LINE 2124
// MISSING LINE 2125
// MISSING LINE 2126
// MISSING LINE 2127
// MISSING LINE 2128
// MISSING LINE 2129
// MISSING LINE 2130
// MISSING LINE 2131
// MISSING LINE 2132
// MISSING LINE 2133
// MISSING LINE 2134
// MISSING LINE 2135
// MISSING LINE 2136
// MISSING LINE 2137
// MISSING LINE 2138
// MISSING LINE 2139
// MISSING LINE 2140
// MISSING LINE 2141
// MISSING LINE 2142
// MISSING LINE 2143
// MISSING LINE 2144
// MISSING LINE 2145
// MISSING LINE 2146
// MISSING LINE 2147
// MISSING LINE 2148
// MISSING LINE 2149
// MISSING LINE 2150
// MISSING LINE 2151
// MISSING LINE 2152
// MISSING LINE 2153
// MISSING LINE 2154
// MISSING LINE 2155
// MISSING LINE 2156
// MISSING LINE 2157
// MISSING LINE 2158
// MISSING LINE 2159
// MISSING LINE 2160
// MISSING LINE 2161
// MISSING LINE 2162
// MISSING LINE 2163
// MISSING LINE 2164
// MISSING LINE 2165
// MISSING LINE 2166
// MISSING LINE 2167
// MISSING LINE 2168
// MISSING LINE 2169
// MISSING LINE 2170
// MISSING LINE 2171
// MISSING LINE 2172
// MISSING LINE 2173
// MISSING LINE 2174
// MISSING LINE 2175
// MISSING LINE 2176
// MISSING LINE 2177
// MISSING LINE 2178
// MISSING LINE 2179
// MISSING LINE 2180
// MISSING LINE 2181
// MISSING LINE 2182
// MISSING LINE 2183
// MISSING LINE 2184
// MISSING LINE 2185
// MISSING LINE 2186
// MISSING LINE 2187
// MISSING LINE 2188
// MISSING LINE 2189
// MISSING LINE 2190
// MISSING LINE 2191
// MISSING LINE 2192
// MISSING LINE 2193
// MISSING LINE 2194
// MISSING LINE 2195
// MISSING LINE 2196
// MISSING LINE 2197
// MISSING LINE 2198
// MISSING LINE 2199
// MISSING LINE 2200
// MISSING LINE 2201
// MISSING LINE 2202
// MISSING LINE 2203
// MISSING LINE 2204
// MISSING LINE 2205
// MISSING LINE 2206
// MISSING LINE 2207
// MISSING LINE 2208
// MISSING LINE 2209
// MISSING LINE 2210
// MISSING LINE 2211
// MISSING LINE 2212
// MISSING LINE 2213
// MISSING LINE 2214
// MISSING LINE 2215
// MISSING LINE 2216
// MISSING LINE 2217
// MISSING LINE 2218
// MISSING LINE 2219
// MISSING LINE 2220
// MISSING LINE 2221
// MISSING LINE 2222
// MISSING LINE 2223
// MISSING LINE 2224
// MISSING LINE 2225
// MISSING LINE 2226
// MISSING LINE 2227
// MISSING LINE 2228
// MISSING LINE 2229
// MISSING LINE 2230
// MISSING LINE 2231
// MISSING LINE 2232
// MISSING LINE 2233
// MISSING LINE 2234
// MISSING LINE 2235
// MISSING LINE 2236
                    `<img src="${item.imageUrl}" class="materia
// MISSING LINE 2238
// MISSING LINE 2239
// MISSING LINE 2240
// MISSING LINE 2241
// MISSING LINE 2242
// MISSING LINE 2243
// MISSING LINE 2244
// MISSING LINE 2245
// MISSING LINE 2246
// MISSING LINE 2247
// MISSING LINE 2248
// MISSING LINE 2249
// MISSING LINE 2250
// MISSING LINE 2251
// MISSING LINE 2252
// MISSING LINE 2253
// MISSING LINE 2254
// MISSING LINE 2255
// MISSING LINE 2256
// MISSING LINE 2257
// MISSING LINE 2258
// MISSING LINE 2259
// MISSING LINE 2260
// MISSING LINE 2261
// MISSING LINE 2262
// MISSING LINE 2263
// MISSING LINE 2264
// MISSING LINE 2265
// MISSING LINE 2266
// MISSING LINE 2267
// MISSING LINE 2268
// MISSING LINE 2269
// MISSING LINE 2270
// MISSING LINE 2271
// MISSING LINE 2272
// MISSING LINE 2273
// MISSING LINE 2274
// MISSING LINE 2275
// MISSING LINE 2276
// MISSING LINE 2277
// MISSING LINE 2278
// MISSING LINE 2279
// MISSING LINE 2280
// MISSING LINE 2281
// MISSING LINE 2282
// MISSING LINE 2283
// MISSING LINE 2284
// MISSING LINE 2285
// MISSING LINE 2286
// MISSING LINE 2287
// MISSING LINE 2288
// MISSING LINE 2289
// MISSING LINE 2290
// MISSING LINE 2291
// MISSING LINE 2292
// MISSING LINE 2293
// MISSING LINE 2294
// MISSING LINE 2295
// MISSING LINE 2296
// MISSING LINE 2297
// MISSING LINE 2298
// MISSING LINE 2299
// MISSING LINE 2300
// MISSING LINE 2301
// MISSING LINE 2302
// MISSING LINE 2303
// MISSING LINE 2304
// MISSING LINE 2305
// MISSING LINE 2306
// MISSING LINE 2307
// MISSING LINE 2308
// MISSING LINE 2309
// MISSING LINE 2310
// MISSING LINE 2311
// MISSING LINE 2312
// MISSING LINE 2313
// MISSING LINE 2314
// MISSING LINE 2315
// MISSING LINE 2316
// MISSING LINE 2317
// MISSING LINE 2318
// MISSING LINE 2319
// MISSING LINE 2320
// MISSING LINE 2321
// MISSING LINE 2322
// MISSING LINE 2323
// MISSING LINE 2324
// MISSING LINE 2325
// MISSING LINE 2326
// MISSING LINE 2327
// MISSING LINE 2328
    s
// MISSING LINE 2330
// MISSING LINE 2331
// MISSING LINE 2332
// MISSING LINE 2333
// MISSING LINE 2334
// MISSING LINE 2335
// MISSING LINE 2336
// MISSING LINE 2337
// MISSING LINE 2338
// MISSING LINE 2339
// MISSING LINE 2340
// MISSING LINE 2341
// MISSING LINE 2342
// MISSING LINE 2343
// MISSING LINE 2344
// MISSING LINE 2345
// MISSING LINE 2346
// MISSING LINE 2347
// MISSING LINE 2348
// MISSING LINE 2349
// MISSING LINE 2350
// MISSING LINE 2351
// MISSING LINE 2352
// MISSING LINE 2353
// MISSING LINE 2354
// MISSING LINE 2355
// MISSING LINE 2356
// MISSING LINE 2357
// MISSING LINE 2358
// MISSING LINE 2359
// MISSING LINE 2360
// MISSING LINE 2361
// MISSING LINE 2362
// MISSING LINE 2363
// MISSING LINE 2364
// MISSING LINE 2365
// MISSING LINE 2366
// MISSING LINE 2367
// MISSING LINE 2368
// MISSING LINE 2369
// MISSING LINE 2370
// MISSING LINE 2371
// MISSING LINE 2372
// MISSING LINE 2373
// MISSING LINE 2374
// MISSING LINE 2375
// MISSING LINE 2376
// MISSING LINE 2377
// MISSING LINE 2378
// MISSING LINE 2379
// MISSING LINE 2380
// MISSING LINE 2381
// MISSING LINE 2382
// MISSING LINE 2383
// MISSING LINE 2384
// MISSING LINE 2385
// MISSING LINE 2386
// MISSING LINE 2387
// MISSING LINE 2388
// MISSING LINE 2389
// MISSING LINE 2390
// MISSING LINE 2391
// MISSING LINE 2392
// MISSING LINE 2393
// MISSING LINE 2394
// MISSING LINE 2395
// MISSING LINE 2396
// MISSING LINE 2397
// MISSING LINE 2398
// MISSING LINE 2399
// MISSING LINE 2400
// MISSING LINE 2401
// MISSING LINE 2402
// MISSING LINE 2403
// MISSING LINE 2404
// MISSING LINE 2405
// MISSING LINE 2406
// MISSING LINE 2407
// MISSING LINE 2408
// MISSING LINE 2409
// MISSING LINE 2410
// MISSING LINE 2411
// MISSING LINE 2412
// MISSING LINE 2413
// MISSING LINE 2414
// MISSING LINE 2415
// MISSING LINE 2416
// MISSING LINE 2417
// MISSING LINE 2418
// MISSING LINE 2419
// MISSING LINE 2420
// MISSING LINE 2421
// MISSING LINE 2422
// MISSING LINE 2423
// MISSING LINE 2424
// MISSING LINE 2425
// MISSING LINE 2426
// MISSING LINE 2427
// MISSING LINE 2428
// MISSING LINE 2429
// MISSING LINE 2430
// MISSING LINE 2431
// MISSING LINE 2432
// MISSING LINE 2433
// MISSING LINE 2434
// MISSING LINE 2435
// MISSING LINE 2436
// MISSING LINE 2437
// MISSING LINE 2438
// MISSING LINE 2439
};

(window as any).initWarehouseLogic = () => {
    const activeTab = document.querySelector('.premium-tab.active')?.textContent?.trim().toLowerCase();
    console.log('[Warehouse] Initializing Logic for tab:', activeTab);
    if (activeTab?.includes('analiz')) {
        setTimeout(() => {
            (window as any).initCharts((window as any).currentWarehouseId);
        }, 100);
    }
};

(window as any).startQRScanner = (warehouseId: string) => {
    document.getElementById('qr-scanner-modal')!.style.display = 'flex';
    qrScanner = qrService.initScanner('reader', async (decodedText) => {
        (window as any).stopQRScanner();
        // Check if decodedText is a material ID or SAP No
        const material = await warehouseService.getStockBySap(warehouseId, decodedText);
        if (material) {
            (window as any).editMaterial(warehouseId, material.id!);
        } else {
// MISSING LINE 2461
// MISSING LINE 2462
// MISSING LINE 2463
// MISSING LINE 2464
// MISSING LINE 2465
// MISSING LINE 2466
// MISSING LINE 2467
// MISSING LINE 2468
// MISSING LINE 2469
// MISSING LINE 2470
// MISSING LINE 2471
// MISSING LINE 2472
// MISSING LINE 2473
// MISSING LINE 2474
// MISSING LINE 2475
// MISSING LINE 2476
// MISSING LINE 2477
// MISSING LINE 2478
// MISSING LINE 2479
// MISSING LINE 2480
// MISSING LINE 2481
// MISSING LINE 2482
// MISSING LINE 2483
// MISSING LINE 2484
// MISSING LINE 2485
// MISSING LINE 2486
// MISSING LINE 2487
// MISSING LINE 2488
// MISSING LINE 2489
// MISSING LINE 2490
// MISSING LINE 2491
// MISSING LINE 2492
// MISSING LINE 2493
// MISSING LINE 2494
// MISSING LINE 2495
// MISSING LINE 2496
// MISSING LINE 2497
// MISSING LINE 2498
// MISSING LINE 2499
// MISSING LINE 2500
// MISSING LINE 2501
// MISSING LINE 2502
// MISSING LINE 2503
// MISSING LINE 2504
// MISSING LINE 2505
// MISSING LINE 2506
// MISSING LINE 2507
// MISSING LINE 2508
// MISSING LINE 2509
// MISSING LINE 2510
// MISSING LINE 2511
// MISSING LINE 2512
// MISSING LINE 2513
// MISSING LINE 2514
// MISSING LINE 2515
                
// MISSING LINE 2517
// MISSING LINE 2518
// MISSING LINE 2519
// MISSING LINE 2520
// MISSING LINE 2521
// MISSING LINE 2522
// MISSING LINE 2523
// MISSING LINE 2524
// MISSING LINE 2525
// MISSING LINE 2526
// MISSING LINE 2527
// MISSING LINE 2528
// MISSING LINE 2529
// MISSING LINE 2530
// MISSING LINE 2531
// MISSING LINE 2532
// MISSING LINE 2533
// MISSING LINE 2534
// MISSING LINE 2535
// MISSING LINE 2536
// MISSING LINE 2537
// MISSING LINE 2538
// MISSING LINE 2539
// MISSING LINE 2540
// MISSING LINE 2541
// MISSING LINE 2542
// MISSING LINE 2543
// MISSING LINE 2544
// MISSING LINE 2545
// MISSING LINE 2546
// MISSING LINE 2547
// MISSING LINE 2548
// MISSING LINE 2549
// MISSING LINE 2550
// MISSING LINE 2551
// MISSING LINE 2552
// MISSING LINE 2553
// MISSING LINE 2554
// MISSING LINE 2555
// MISSING LINE 2556
// MISSING LINE 2557
// MISSING LINE 2558
// MISSING LINE 2559
// MISSING LINE 2560
// MISSING LINE 2561
// MISSING LINE 2562
// MISSING LINE 2563
// MISSING LINE 2564
// MISSING LINE 2565
// MISSING LINE 2566
// MISSING LINE 2567
// MISSING LINE 2568
// MISSING LINE 2569
// MISSING LINE 2570
// MISSING LINE 2571
// MISSING LINE 2572
// MISSING LINE 2573
// MISSING LINE 2574
// MISSING LINE 2575
// MISSING LINE 2576
// MISSING LINE 2577
// MISSING LINE 2578
// MISSING LINE 2579
// MISSING LINE 2580
// MISSING LINE 2581
// MISSING LINE 2582
// MISSING LINE 2583
// MISSING LINE 2584
// MISSING LINE 2585
// MISSING LINE 2586
// MISSING LINE 2587
// MISSING LINE 2588
// MISSING LINE 2589
// MISSING LINE 2590
// MISSING LINE 2591
// MISSING LINE 2592
// MISSING LINE 2593
// MISSING LINE 2594
// MISSING LINE 2595
// MISSING LINE 2596
// MISSING LINE 2597
// MISSING LINE 2598
// MISSING LINE 2599
// MISSING LINE 2600
// MISSING LINE 2601
// MISSING LINE 2602
// MISSING LINE 2603
// MISSING LINE 2604
// MISSING LINE 2605
// MISSING LINE 2606
// MISSING LINE 2607
// MISSING LINE 2608
// MISSING LINE 2609
// MISSING LINE 2610
// MISSING LINE 2611
// MISSING LINE 2612
// MISSING LINE 2613
// MISSING LINE 2614
// MISSING LINE 2615
// MISSING LINE 2616
// MISSING LINE 2617
// MISSING LINE 2618
// MISSING LINE 2619
// MISSING LINE 2620
// MISSING LINE 2621
// MISSING LINE 2622
// MISSING LINE 2623
// MISSING LINE 2624
// MISSING LINE 2625
// MISSING LINE 2626
// MISSING LINE 2627
// MISSING LINE 2628
// MISSING LINE 2629
// MISSING LINE 2630
// MISSING LINE 2631
// MISSING LINE 2632
// MISSING LINE 2633
// MISSING LINE 2634
// MISSING LINE 2635
// MISSING LINE 2636
// MISSING LINE 2637
// MISSING LINE 2638
// MISSING LINE 2639
// MISSING LINE 2640
// MISSING LINE 2641
// MISSING LINE 2642
// MISSING LINE 2643
// MISSING LINE 2644
// MISSING LINE 2645
// MISSING LINE 2646
// MISSING LINE 2647
// MISSING LINE 2648
// MISSING LINE 2649
// MISSING LINE 2650
// MISSING LINE 2651
// MISSING LINE 2652
// MISSING LINE 2653
// MISSING LINE 2654
// MISSING LINE 2655
// MISSING LINE 2656
// MISSING LINE 2657
// MISSING LINE 2658
// MISSING LINE 2659
// MISSING LINE 2660
// MISSING LINE 2661
// MISSING LINE 2662
// MISSING LINE 2663
// MISSING LINE 2664
// MISSING LINE 2665
// MISSING LINE 2666
// MISSING LINE 2667
// MISSING LINE 2668
// MISSING LINE 2669
// MISSING LINE 2670
// MISSING LINE 2671
// MISSING LINE 2672
// MISSING LINE 2673
// MISSING LINE 2674
// MISSING LINE 2675
// MISSING LINE 2676
// MISSING LINE 2677
// MISSING LINE 2678
// MISSING LINE 2679
// MISSING LINE 2680
// MISSING LINE 2681
// MISSING LINE 2682
// MISSING LINE 2683
// MISSING LINE 2684
// MISSING LINE 2685
// MISSING LINE 2686
// MISSING LINE 2687
// MISSING LINE 2688
// MISSING LINE 2689
// MISSING LINE 2690
// MISSING LINE 2691
// MISSING LINE 2692
// MISSING LINE 2693
// MISSING LINE 2694
// MISSING LINE 2695
// MISSING LINE 2696
// MISSING LINE 2697
// MISSING LINE 2698
// MISSING LINE 2699
// MISSING LINE 2700
// MISSING LINE 2701
// MISSING LINE 2702
// MISSING LINE 2703
// MISSING LINE 2704
// MISSING LINE 2705
// MISSING LINE 2706
// MISSING LINE 2707
// MISSING LINE 2708
// MISSING LINE 2709
// MISSING LINE 2710
// MISSING LINE 2711
// MISSING LINE 2712
// MISSING LINE 2713
// MISSING LINE 2714
// MISSING LINE 2715
// MISSING LINE 2716
// MISSING LINE 2717
// MISSING LINE 2718
// MISSING LINE 2719
// MISSING LINE 2720
// MISSING LINE 2721
// MISSING LINE 2722
// MISSING LINE 2723
// MISSING LINE 2724
// MISSING LINE 2725
// MISSING LINE 2726
// MISSING LINE 2727
// MISSING LINE 2728
// MISSING LINE 2729
// MISSING LINE 2730
// MISSING LINE 2731
// MISSING LINE 2732
// MISSING LINE 2733
// MISSING LINE 2734
// MISSING LINE 2735
// MISSING LINE 2736
// MISSING LINE 2737
// MISSING LINE 2738
// MISSING LINE 2739
// MISSING LINE 2740
// MISSING LINE 2741
// MISSING LINE 2742
// MISSING LINE 2743
// MISSING LINE 2744
// MISSING LINE 2745
// MISSING LINE 2746
// MISSING LINE 2747
// MISSING LINE 2748
// MISSING LINE 2749
// MISSING LINE 2750
// MISSING LINE 2751
// MISSING LINE 2752
// MISSING LINE 2753
// MISSING LINE 2754
// MISSING LINE 2755
// MISSING LINE 2756
// MISSING LINE 2757
// MISSING LINE 2758
// MISSING LINE 2759
// MISSING LINE 2760
// MISSING LINE 2761
// MISSING LINE 2762
// MISSING LINE 2763
// MISSING LINE 2764
// MISSING LINE 2765
// MISSING LINE 2766
// MISSING LINE 2767
// MISSING LINE 2768
// MISSING LINE 2769
// MISSING LINE 2770
// MISSING LINE 2771
// MISSING LINE 2772
// MISSING LINE 2773
// MISSING LINE 2774
// MISSING LINE 2775
// MISSING LINE 2776
// MISSING LINE 2777
// MISSING LINE 2778
// MISSING LINE 2779
// MISSING LINE 2780
// MISSING LINE 2781
// MISSING LINE 2782
// MISSING LINE 2783
// MISSING LINE 2784
// MISSING LINE 2785
// MISSING LINE 2786
// MISSING LINE 2787
// MISSING LINE 2788
// MISSING LINE 2789
// MISSING LINE 2790
// MISSING LINE 2791
// MISSING LINE 2792
// MISSING LINE 2793
// MISSING LINE 2794
// MISSING LINE 2795
// MISSING LINE 2796
// MISSING LINE 2797
// MISSING LINE 2798
// MISSING LINE 2799
// MISSING LINE 2800
// MISSING LINE 2801
// MISSING LINE 2802
// MISSING LINE 2803
// MISSING LINE 2804
// MISSING LINE 2805
// MISSING LINE 2806
// MISSING LINE 2807
// MISSING LINE 2808
// MISSING LINE 2809
// MISSING LINE 2810
// MISSING LINE 2811
// MISSING LINE 2812
// MISSING LINE 2813
// MISSING LINE 2814
// MISSING LINE 2815
// MISSING LINE 2816
// MISSING LINE 2817
// MISSING LINE 2818
// MISSING LINE 2819
// MISSING LINE 2820
// MISSING LINE 2821
// MISSING LINE 2822
// MISSING LINE 2823
// MISSING LINE 2824
// MISSING LINE 2825
// MISSING LINE 2826
// MISSING LINE 2827
// MISSING LINE 2828
// MISSING LINE 2829
// MISSING LINE 2830
// MISSING LINE 2831
// MISSING LINE 2832
// MISSING LINE 2833
// MISSING LINE 2834
// MISSING LINE 2835
// MISSING LINE 2836
// MISSING LINE 2837
// MISSING LINE 2838
// MISSING LINE 2839
// MISSING LINE 2840
// MISSING LINE 2841
// MISSING LINE 2842
// MISSING LINE 2843
// MISSING LINE 2844
// MISSING LINE 2845
// MISSING LINE 2846
// MISSING LINE 2847
// MISSING LINE 2848
// MISSING LINE 2849
// MISSING LINE 2850
// MISSING LINE 2851
// MISSING LINE 2852
// MISSING LINE 2853
// MISSING LINE 2854
// MISSING LINE 2855
// MISSING LINE 2856
// MISSING LINE 2857
// MISSING LINE 2858
// MISSING LINE 2859
// MISSING LINE 2860
// MISSING LINE 2861
// MISSING LINE 2862
// MISSING LINE 2863
// MISSING LINE 2864
// MISSING LINE 2865
// MISSING LINE 2866
// MISSING LINE 2867
// MISSING LINE 2868
// MISSING LINE 2869
// MISSING LINE 2870
// MISSING LINE 2871
// MISSING LINE 2872
// MISSING LINE 2873
// MISSING LINE 2874
// MISSING LINE 2875
// MISSING LINE 2876
// MISSING LINE 2877
// MISSING LINE 2878
// MISSING LINE 2879
// MISSING LINE 2880
// MISSING LINE 2881
// MISSING LINE 2882
// MISSING LINE 2883
// MISSING LINE 2884
// MISSING LINE 2885
// MISSING LINE 2886
// MISSING LINE 2887
// MISSING LINE 2888
// MISSING LINE 2889
// MISSING LINE 2890
// MISSING LINE 2891
// MISSING LINE 2892
// MISSING LINE 2893
// MISSING LINE 2894
// MISSING LINE 2895
// MISSING LINE 2896
// MISSING LINE 2897
// MISSING LINE 2898
// MISSING LINE 2899
// MISSING LINE 2900
// MISSING LINE 2901
// MISSING LINE 2902
// MISSING LINE 2903
// MISSING LINE 2904
// MISSING LINE 2905
// MISSING LINE 2906
// MISSING LINE 2907
// MISSING LINE 2908
// MISSING LINE 2909
// MISSING LINE 2910
// MISSING LINE 2911
// MISSING LINE 2912
// MISSING LINE 2913
// MISSING LINE 2914
// MISSING LINE 2915
// MISSING LINE 2916
// MISSING LINE 2917
// MISSING LINE 2918
// MISSING LINE 2919
// MISSING LINE 2920
// MISSING LINE 2921
// MISSING LINE 2922
// MISSING LINE 2923
// MISSING LINE 2924
// MISSING LINE 2925
// MISSING LINE 2926
// MISSING LINE 2927
// MISSING LINE 2928
// MISSING LINE 2929
// MISSING LINE 2930
// MISSING LINE 2931
// MISSING LINE 2932
// MISSING LINE 2933
// MISSING LINE 2934
// MISSING LINE 2935
// MISSING LINE 2936
// MISSING LINE 2937
// MISSING LINE 2938
// MISSING LINE 2939
// MISSING LINE 2940
// MISSING LINE 2941
// MISSING LINE 2942
// MISSING LINE 2943
// MISSING LINE 2944
// MISSING LINE 2945
// MISSING LINE 2946
// MISSING LINE 2947
// MISSING LINE 2948
// MISSING LINE 2949
// MISSING LINE 2950
// MISSING LINE 2951
// MISSING LINE 2952
// MISSING LINE 2953
// MISSING LINE 2954
// MISSING LINE 2955
// MISSING LINE 2956
// MISSING LINE 2957
// MISSING LINE 2958
// MISSING LINE 2959
// MISSING LINE 2960
// MISSING LINE 2961
// MISSING LINE 2962
// MISSING LINE 2963
// MISSING LINE 2964
// MISSING LINE 2965
// MISSING LINE 2966
// MISSING LINE 2967
// MISSING LINE 2968
// MISSING LINE 2969
// MISSING LINE 2970
// MISSING LINE 2971
// MISSING LINE 2972
// MISSING LINE 2973
// MISSING LINE 2974
// MISSING LINE 2975
// MISSING LINE 2976
// MISSING LINE 2977
// MISSING LINE 2978
// MISSING LINE 2979
// MISSING LINE 2980
// MISSING LINE 2981
// MISSING LINE 2982
// MISSING LINE 2983
// MISSING LINE 2984
// MISSING LINE 2985
// MISSING LINE 2986
// MISSING LINE 2987
// MISSING LINE 2988
// MISSING LINE 2989
// MISSING LINE 2990
// MISSING LINE 2991
// MISSING LINE 2992
// MISSING LINE 2993
// MISSING LINE 2994
// MISSING LINE 2995
// MISSING LINE 2996
// MISSING LINE 2997
// MISSING LINE 2998
// MISSING LINE 2999
// MISSING LINE 3000
// MISSING LINE 3001
// MISSING LINE 3002
// MISSING LINE 3003
// MISSING LINE 3004
// MISSING LINE 3005
// MISSING LINE 3006
// MISSING LINE 3007
// MISSING LINE 3008
// MISSING LINE 3009
// MISSING LINE 3010
// MISSING LINE 3011
// MISSING LINE 3012
// MISSING LINE 3013
// MISSING LINE 3014
// MISSING LINE 3015
// MISSING LINE 3016
// MISSING LINE 3017
// MISSING LINE 3018
// MISSING LINE 3019
// MISSING LINE 3020
// MISSING LINE 3021
// MISSING LINE 3022
// MISSING LINE 3023
// MISSING LINE 3024
// MISSING LINE 3025
// MISSING LINE 3026
// MISSING LINE 3027
// MISSING LINE 3028
// MISSING LINE 3029
// MISSING LINE 3030
// MISSING LINE 3031
// MISSING LINE 3032
// MISSING LINE 3033
// MISSING LINE 3034
// MISSING LINE 3035
// MISSING LINE 3036
// MISSING LINE 3037
// MISSING LINE 3038
// MISSING LINE 3039
// MISSING LINE 3040
// MISSING LINE 3041
// MISSING LINE 3042
// MISSING LINE 3043
// MISSING LINE 3044
// MISSING LINE 3045
// MISSING LINE 3046
// MISSING LINE 3047
// MISSING LINE 3048
// MISSING LINE 3049
// MISSING LINE 3050
// MISSING LINE 3051
// MISSING LINE 3052
// MISSING LINE 3053
// MISSING LINE 3054
// MISSING LINE 3055
// MISSING LINE 3056
// MISSING LINE 3057
// MISSING LINE 3058
// MISSING LINE 3059
// MISSING LINE 3060
// MISSING LINE 3061
// MISSING LINE 3062
// MISSING LINE 3063
// MISSING LINE 3064
// MISSING LINE 3065
// MISSING LINE 3066
// MISSING LINE 3067
// MISSING LINE 3068
// MISSING LINE 3069
// MISSING LINE 3070
// MISSING LINE 3071
// MISSING LINE 3072
// MISSING LINE 3073
// MISSING LINE 3074
// MISSING LINE 3075
// MISSING LINE 3076
// MISSING LINE 3077
// MISSING LINE 3078
// MISSING LINE 3079
// MISSING LINE 3080
// MISSING LINE 3081
// MISSING LINE 3082
// MISSING LINE 3083
// MISSING LINE 3084
// MISSING LINE 3085
// MISSING LINE 3086
// MISSING LINE 3087
// MISSING LINE 3088
// MISSING LINE 3089
// MISSING LINE 3090
// MISSING LINE 3091
// MISSING LINE 3092
// MISSING LINE 3093
// MISSING LINE 3094
// MISSING LINE 3095
// MISSING LINE 3096
// MISSING LINE 3097
// MISSING LINE 3098
// MISSING LINE 3099
// MISSING LINE 3100
// MISSING LINE 3101
// MISSING LINE 3102
// MISSING LINE 3103
// MISSING LINE 3104
// MISSING LINE 3105
// MISSING LINE 3106
// MISSING LINE 3107
// MISSING LINE 3108
// MISSING LINE 3109
// MISSING LINE 3110
// MISSING LINE 3111
// MISSING LINE 3112
// MISSING LINE 3113
// MISSING LINE 3114
// MISSING LINE 3115
// MISSING LINE 3116
// MISSING LINE 3117
// MISSING LINE 3118
// MISSING LINE 3119
// MISSING LINE 3120
// MISSING LINE 3121
// MISSING LINE 3122
// MISSING LINE 3123
// MISSING LINE 3124
// MISSING LINE 3125
// MISSING LINE 3126
// MISSING LINE 3127
// MISSING LINE 3128
// MISSING LINE 3129
// MISSING LINE 3130
// MISSING LINE 3131
// MISSING LINE 3132
// MISSING LINE 3133
// MISSING LINE 3134
// MISSING LINE 3135
// MISSING LINE 3136
// MISSING LINE 3137
// MISSING LINE 3138
// MISSING LINE 3139
// MISSING LINE 3140
// MISSING LINE 3141
// MISSING LINE 3142
// MISSING LINE 3143
// MISSING LINE 3144
// MISSING LINE 3145
// MISSING LINE 3146
// MISSING LINE 3147
// MISSING LINE 3148
// MISSING LINE 3149
// MISSING LINE 3150
// MISSING LINE 3151
// MISSING LINE 3152
// MISSING LINE 3153
// MISSING LINE 3154
// MISSING LINE 3155
// MISSING LINE 3156
// MISSING LINE 3157
// MISSING LINE 3158
// MISSING LINE 3159
// MISSING LINE 3160
// MISSING LINE 3161
// MISSING LINE 3162
// MISSING LINE 3163
// MISSING LINE 3164
// MISSING LINE 3165
// MISSING LINE 3166
// MISSING LINE 3167
// MISSING LINE 3168
// MISSING LINE 3169
// MISSING LINE 3170
// MISSING LINE 3171
// MISSING LINE 3172
// MISSING LINE 3173
// MISSING LINE 3174
// MISSING LINE 3175
// MISSING LINE 3176
// MISSING LINE 3177
// MISSING LINE 3178
// MISSING LINE 3179
// MISSING LINE 3180
// MISSING LINE 3181
// MISSING LINE 3182
// MISSING LINE 3183
// MISSING LINE 3184
// MISSING LINE 3185
// MISSING LINE 3186
// MISSING LINE 3187
// MISSING LINE 3188
// MISSING LINE 3189
// MISSING LINE 3190
// MISSING LINE 3191
// MISSING LINE 3192
// MISSING LINE 3193
// MISSING LINE 3194
// MISSING LINE 3195
// MISSING LINE 3196
// MISSING LINE 3197
// MISSING LINE 3198
// MISSING LINE 3199
// MISSING LINE 3200
// MISSING LINE 3201
// MISSING LINE 3202
// MISSING LINE 3203
// MISSING LINE 3204
// MISSING LINE 3205
// MISSING LINE 3206
// MISSING LINE 3207
// MISSING LINE 3208
// MISSING LINE 3209
// MISSING LINE 3210
// MISSING LINE 3211
// MISSING LINE 3212
// MISSING LINE 3213
// MISSING LINE 3214
// MISSING LINE 3215
// MISSING LINE 3216
// MISSING LINE 3217
// MISSING LINE 3218
// MISSING LINE 3219
// MISSING LINE 3220
// MISSING LINE 3221
// MISSING LINE 3222
// MISSING LINE 3223
// MISSING LINE 3224
    }
};

(window as any).clearBatchSelection = () => {
    const checkboxes = document.querySelectorAll('.item-checkbox') as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(cb => cb.checked = false);
    const selectAll = document.getElementById('select-all-batch') as HTMLInputElement;
    if (selectAll) selectAll.checked = false;
    (window as any).updateBatchCount();
};

(window as any).openBatchShelfModal = () => {
    const selectedIds = Array.from(document.querySelectorAll('.item-checkbox:checked')).map(cb => (cb as HTMLInputElement).dataset.id);
    if (selectedIds.length === 0) return;

    const shelf = prompt(`${selectedIds.length} kalem için yeni raf numarası girin:`, "R-");
// MISSING LINE 3241
// MISSING LINE 3242
// MISSING LINE 3243
// MISSING LINE 3244
// MISSING LINE 3245
// MISSING LINE 3246
// MISSING LINE 3247
// MISSING LINE 3248
// MISSING LINE 3249
// MISSING LINE 3250
// MISSING LINE 3251
// MISSING LINE 3252
// MISSING LINE 3253
// MISSING LINE 3254
// MISSING LINE 3255
// MISSING LINE 3256
// MISSING LINE 3257
// MISSING LINE 3258
// MISSING LINE 3259
// MISSING LINE 3260
// MISSING LINE 3261
// MISSING LINE 3262
// MISSING LINE 3263
// MISSING LINE 3264
// MISSING LINE 3265
// MISSING LINE 3266
// MISSING LINE 3267
// MISSING LINE 3268
// MISSING LINE 3269
// MISSING LINE 3270
// MISSING LINE 3271
// MISSING LINE 3272
// MISSING LINE 3273
// MISSING LINE 3274
// MISSING LINE 3275
// MISSING LINE 3276
// MISSING LINE 3277
// MISSING LINE 3278
// MISSING LINE 3279
// MISSING LINE 3280
// MISSING LINE 3281
// MISSING LINE 3282
// MISSING LINE 3283
// MISSING LINE 3284
// MISSING LINE 3285
// MISSING LINE 3286
// MISSING LINE 3287
// MISSING LINE 3288
// MISSING LINE 3289
// MISSING LINE 3290
// MISSING LINE 3291
// MISSING LINE 3292
// MISSING LINE 3293
// MISSING LINE 3294
// MISSING LINE 3295
// MISSING LINE 3296
// MISSING LINE 3297
// MISSING LINE 3298
// MISSING LINE 3299
// MISSING LINE 3300
// MISSING LINE 3301
// MISSING LINE 3302
// MISSING LINE 3303
// MISSING LINE 3304
// MISSING LINE 3305
// MISSING LINE 3306
// MISSING LINE 3307
// MISSING LINE 3308
// MISSING LINE 3309
// MISSING LINE 3310
// MISSING LINE 3311
// MISSING LINE 3312
// MISSING LINE 3313
// MISSING LINE 3314
// MISSING LINE 3315
// MISSING LINE 3316
// MISSING LINE 3317
// MISSING LINE 3318
// MISSING LINE 3319
// MISSING LINE 3320
// MISSING LINE 3321
// MISSING LINE 3322
// MISSING LINE 3323
// MISSING LINE 3324
// MISSING LINE 3325
// MISSING LINE 3326
// MISSING LINE 3327
// MISSING LINE 3328
// MISSING LINE 3329
// MISSING LINE 3330
// MISSING LINE 3331
// MISSING LINE 3332
// MISSING LINE 3333
// MISSING LINE 3334
// MISSING LINE 3335
// MISSING LINE 3336
// MISSING LINE 3337
// MISSING LINE 3338
// MISSING LINE 3339
// MISSING LINE 3340
// MISSING LINE 3341
// MISSING LINE 3342
// MISSING LINE 3343
// MISSING LINE 3344
// MISSING LINE 3345
// MISSING LINE 3346
// MISSING LINE 3347
// MISSING LINE 3348
// MISSING LINE 3349
// MISSING LINE 3350
// MISSING LINE 3351
// MISSING LINE 3352
// MISSING LINE 3353
// MISSING LINE 3354
// MISSING LINE 3355
// MISSING LINE 3356
// MISSING LINE 3357
// MISSING LINE 3358
// MISSING LINE 3359
// MISSING LINE 3360
// MISSING LINE 3361
// MISSING LINE 3362
// MISSING LINE 3363
// MISSING LINE 3364
// MISSING LINE 3365
// MISSING LINE 3366
// MISSING LINE 3367
// MISSING LINE 3368
// MISSING LINE 3369
// MISSING LINE 3370
// MISSING LINE 3371
// MISSING LINE 3372
// MISSING LINE 3373
// MISSING LINE 3374
// MISSING LINE 3375
// MISSING LINE 3376
// MISSING LINE 3377
// MISSING LINE 3378
// MISSING LINE 3379
// MISSING LINE 3380
// MISSING LINE 3381
// MISSING LINE 3382
// MISSING LINE 3383
// MISSING LINE 3384
// MISSING LINE 3385
// MISSING LINE 3386
// MISSING LINE 3387
// MISSING LINE 3388
// MISSING LINE 3389
// MISSING LINE 3390
// MISSING LINE 3391
// MISSING LINE 3392
// MISSING LINE 3393
// MISSING LINE 3394
// MISSING LINE 3395
// MISSING LINE 3396
// MISSING LINE 3397
// MISSING LINE 3398
// MISSING LINE 3399
// MISSING LINE 3400
// MISSING LINE 3401
// MISSING LINE 3402
// MISSING LINE 3403
// MISSING LINE 3404
// MISSING LINE 3405
// MISSING LINE 3406
// MISSING LINE 3407
// MISSING LINE 3408
// MISSING LINE 3409
// MISSING LINE 3410
// MISSING LINE 3411
// MISSING LINE 3412
// MISSING LINE 3413
// MISSING LINE 3414
// MISSING LINE 3415
// MISSING LINE 3416
// MISSING LINE 3417
// MISSING LINE 3418
// MISSING LINE 3419
// MISSING LINE 3420
// MISSING LINE 3421
// MISSING LINE 3422
// MISSING LINE 3423
// MISSING LINE 3424
// MISSING LINE 3425
// MISSING LINE 3426
// MISSING LINE 3427
// MISSING LINE 3428
// MISSING LINE 3429
// MISSING LINE 3430
// MISSING LINE 3431
// MISSING LINE 3432
// MISSING LINE 3433
// MISSING LINE 3434
// MISSING LINE 3435
// MISSING LINE 3436
// MISSING LINE 3437
// MISSING LINE 3438
// MISSING LINE 3439

            <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                    <span style="font-size: 0.75rem; color: #888; font-weight: 800; letter-spacing: 1px;">BU OTURUMDA SAYILANLAR</span>
                    <span id="quick-audit-session-count" style="background: rgba(100,255,218,0.1); color: #64ffda; padding: 2px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 900;">0 KALEM</span>
                </div>
                <div id="quick-audit-session-list" style="display: flex; flex-direction: column; gap: 10px;">
                    <div style="padding: 3rem; text-align: center; color: #333; font-weight: 600;">Henüz tarama yapılmadı.</div>
                </div>
            </div>
        </div>

        <div style="padding: 1.5rem; background: #0a1118; border-top: 1px solid rgba(255,255,255,0.05);">
            <button id="quick-audit-finish-btn" onclick="window.submitQuickAudit('${warehouseId}')" class="btn-cyber" style="width: 100%; padding: 18px; background: linear-gradient(135deg, #64ffda 0%, #48bb78 100%); color: #000; font-weight: 900; font-size: 1.1rem; border-radius: 16px; box-shadow: 0 10px 30px rgba(100, 255, 218, 0.2);">
                SAYIMI TAMAMLA VE KAYDET
            </button>
        </div>
    `;

    document.body.appendChild(modal);
};

(window as any).scanForQuickAudit = async (warehouseId: string) => {
    try {
        const sapNo = await qrService.scanQRCode();
        if (!sapNo) return;

        const inventory = (window as any).currentInventoryData || [];
        const item = inventory.find((i: any) => String(i.sapNo).trim() === String(sapNo).trim());

        if (!item) {
            alert(`Hata: ${sapNo} numaralı malzeme bu depoda bulunamadı.`);
            return;
        }

        const container = document.getElementById('quick-audit-scanned-container');
        if (container) {
            container.innerHTML = `
                <div style="background: #111; border: 2px solid #64ffda; padding: 1.5rem; border-radius: 20px; animation: slideInUp 0.3s ease-out;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
                        <div>
                            <div style="font-size: 0.7rem; color: #64ffda; font-weight: 800; margin-bottom: 4px;">OKUTULAN MALZEME</div>
                            <div style="font-weight: 900; font-size: 1.1rem;">${item.description}</div>
                            <div style="font-size: 0.8rem; color: #888; margin-top: 2px;">SAP: ${item.sapNo} | Raf: ${item.shelfNo || '-'}</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.7rem; color: #888;">SİSTEM STOK</div>
                            <div style="font-size: 1.4rem; font-weight: 900; color: #64ffda;">${item.quantity}</div>
                        </div>
                    </div>
                        <div style="text-align: right;">
                            <div style="font-size: 0.7rem; color: #888;">SİSTEM STOK</div>
                            <div style="font-size: 1.4rem; font-weight: 900; color: #64ffda;">${item.quantity}</div>
                        </div>
                    </div>
                    
                    <div style="display: flex; gap: 1rem; align-items: flex-end;">
                        <div style="flex: 1;">
                            <label style="display: block; font-size: 0.7rem; color: #888; margin-bottom: 8px;">FİZİKSEL MİKTAR</label>
                            <input type="number" id="quick-audit-qty-input" class="cyber-input-premium" value="${item.quantity}" style="width: 100%; height: 50px; font-size: 1.5rem; font-weight: 900; text-align: center; background: #000;">
                        </div>
                        <button onclick="window.addQuickAuditResult('${item.id}', '${item.sapNo}', '${item.description.replace(/'/g, "\\'")}', ${item.quantity})" class="btn-cyber" style="height: 50px; padding: 0 30px; background: #64ffda; color: #000; font-weight: 900; border-radius: 12px;">EKLE</button>
                    </div>
                </div>
            `;
            setTimeout(() => document.getElementById('quick-audit-qty-input')?.focus(), 100);
        }
    } catch (e) {
        console.error("Scanning error:", e);
    }
};

(window as any).addQ
// MISSING LINE 3513
// MISSING LINE 3514
// MISSING LINE 3515
    
    if (isNaN(physicalQty)) return;

    const session = (window as any).quickAuditSession;
    const existingIdx = session.results.findIndex((r: any) => r.id === id);
    
    const result = {
        id, sapNo, description, systemQty, physicalQty,
        diff: physicalQty - systemQty,
        timestamp: new Date()
    };

    if (existingIdx >= 0) session.results[existingIdx] = result;
    else session.results.unshift(result);

    const list = document.getElementById('quick-audit-session-list');
    const countLabel = document.getElementById('quick-audit-session-count');
    
    if (list && countLabel) {
        countLabel.textContent = `${session.results.length} KALEM`;
        list.innerHTML = session.results.map((r: any) => `
            <div style="background: rgba(255,255,255,0.03); padding: 12px 15px; border-radius: 14px; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.05);">
                <div>
                    <div style="font-size: 0.8rem; font-weight: 700;">${r.description}</div>
                    <div style="font-size: 0.65rem; color: #888;">SAP: ${r.sapNo}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 0.9rem; font-weight: 900; color: ${r.diff === 0 ? '#64ffda' : '#ff4d4d'}">${r.physicalQty} AD.</div>
                    <div style="font-size: 0.6rem; color: #888;">Fark: ${r.diff > 0 ? '+' : ''}${r.diff}</div>
                </div>
            </div>
        `).join('');
    }

    const container = document.getElementById('quick-audit-scanned-container');
    if (container) container.innerHTML = '';
};

(window as any).submitQuickAudit = async (warehouseId: string) => {
    const session = (window as any).quickAuditSession;
    if (!session || session.results.length === 0) {
        alert("Henüz bir sayım yapmadınız.");
        return;
    }

    if (!confirm(`${session.results.length} kalem sayım verisi kaydedilecek ve stoklar güncellenecektir. Onaylıyor musunuz?`)) return;

    const btn = document.getElementById('quick-audit-finish-btn') as HTMLButtonElement;
    try {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> KAYDEDİLİYOR...';

        const user = (window as any).currentUser?.email || 'Bilinmeyen';
        const mappedResults = session.results.map((r: any) => ({
            itemId: r.id,
            sapNo: r.sapNo,
            description: r.description,
            systemQty: r.systemQty,
            physicalQty: r.physicalQty,
            diff: r.diff,
            note: 'Hızlı Mobil Sayım'
        }));

        await warehouseService.saveAudit(warehouseId, { 
            user, 
            totalItems: mappedResults.length,
            totalDiff: mappedResults.reduce((acc: number, curr: any) => acc + curr.diff, 0),
            results: mappedResults
        });

        btn.style.background = '#28a745';
        btn.innerHTML = 'BAŞARIYLA KAYDEDİLDİ';
        
        setTimeout(() => {
            document.getElementById('quick-audit-modal')?.remove();
            (window as any).updateWarehouseUI(warehouseId);
        }, 1500);

    } catch (e) {
        console.error("Submit error:", e);
        btn.disabled = false;
        btn.innerHTML = 'HATA OLUŞTU!';
    }
};



﻿(window as any).openAddMaterialModal = (warehouseId: string) => {
  const modal = document.getElementById('add-material-modal');
  const whInput = document.getElementById('modal-warehouse-id') as HTMLInputElement;
  const form = document.getElementById('add-material-form') as HTMLFormElement;
  if (modal && whInput) {
    if (form) form.reset();
    const title = document.getElementById('modal-title');
    if (title) title.innerText = 'YENİ MALZEME EKLE';
    whInput.value = warehouseId;
    const itemInput = document.getElementById('modal-item-id') as HTMLInputElement;
    if (itemInput) itemInput.value = '';
    
    const sapNoInput = document.getElementById('modal-sap-no') as HTMLInputElement;
    if (sapNoInput) sapNoInput.value = '';
    
    const descInput = document.getElementById('modal-description') as HTMLInputElement;
    if (descInput) descInput.value = '';
    
    const qtyInput = document.getElementById('modal-quantity') as HTMLInputElement;
    if (qtyInput) qtyInput.value = '0';
    
    const limitInput = document.getElementById('modal-critical-limit') as HTMLInputElement;
    if (limitInput) limitInput.value = '';
    
    const unitInput = document.getElementById('modal-unit') as HTMLInputElement;
    if (unitInput) unitInput.value = 'Adet';
    
    const shelfInput = document.getElementById('modal-shelf-no') as HTMLInputElement;
    if (shelfInput) shelfInput.value = '';
    
    const imgPreview = document.getElementById('modal-image-preview') as HTMLImageElement;
    if (imgPreview) imgPreview.src = '';
    const imgContainer = document.getElementById('modal-image-preview-container');
    if (imgContainer) imgContainer.style.display = 'none';
    const noImg = document.getElementById('modal-no-image-placeholder');
    if (noImg) noImg.style.display = 'flex';
    
    modal.style.display = 'flex';
    const content = modal.querySelector('.modal-content') as HTMLElement;
    if (content) {
      content.style.transform = 'scale(0.9)';
      setTimeout(() => content.style.transform = 'scale(1)', 10);
    }
  }
};

(window as any).editMaterial = (warehouseId: string, itemId: string) => {
  const cachedInventory = (window as any).cachedInventory || [];
  const material = cachedInventory.find((i: any) => i.id === itemId);
  if (!material) {
      alert('Malzeme bilgisi bulunamadı.');
      return;
  }
  const modal = document.getElementById('add-material-modal');
  const whInput = document.getElementById('modal-warehouse-id') as HTMLInputElement;
  const form = document.getElementById('add-material-form') as HTMLFormElement;
  if (modal && whInput) {
    if (form) form.reset();
    const title = document.getElementById('modal-title');
    if (title) title.innerText = 'MALZEME DÜZENLE';
    whInput.value = warehouseId;
    const itemInput = document.getElementById('modal-item-id') as HTMLInputElement;
    if (itemInput) itemInput.value = itemId;
    
    const sapNoInput = document.getElementById('modal-sap-no') as HTMLInputElement;
    if (sapNoInput) sapNoInput.value = material.sapNo || '';
    
    const descInput = document.getElementById('modal-description') as HTMLInputElement;
    if (descInput) descInput.value = material.description || '';
    
    const qtyInput = document.getElementById('modal-quantity') as HTMLInputElement;
    if (qtyInput) qtyInput.value = material.quantity || 0;
    
    const limitInput = document.getElementById('modal-critical-limit') as HTMLInputElement;
    if (limitInput) limitInput.value = material.criticalLimit || '';
    
    const unitInput = document.getElementById('modal-unit') as HTMLInputElement;
    if (unitInput) unitInput.value = material.unit || 'Adet';
    
    const shelfInput = document.getElementById('modal-shelf-no') as HTMLInputElement;
    if (shelfInput) shelfInput.value = material.shelfNo || '';
    
    const imgPreview = document.getElementById('modal-image-preview') as HTMLImageElement;
    const imgContainer = document.getElementById('modal-image-preview-container');
    const noImg = document.getElementById('modal-no-image-placeholder');
    
    if (material.imageUrl && imgPreview && imgContainer && noImg) {
        imgPreview.src = material.imageUrl;
        imgContainer.style.display = 'block';
        noImg.style.display = 'none';
    } else if (imgPreview && imgContainer && noImg) {
        imgPreview.src = '';
        imgContainer.style.display = 'none';
        noImg.style.display = 'flex';
    }
    
    modal.style.display = 'flex';
    const content = modal.querySelector('.modal-content') as HTMLElement;
    if (content) {
      content.style.transform = 'scale(0.9)';
      setTimeout(() => content.style.transform = 'scale(1)', 10);
    }
  }
};