# Görev Listesi

## iPad Tasarım İyileştirmeleri
- [x] `FaultFormUI.ts` içindeki Çalışma Zamanları hücre genişliklerini (`min-width`) güncelle
- [x] `FaultFormController.ts` içindeki Çalışma Zamanları başlıklarını güncelle ve yatay kaydırma kapsayıcısı (`overflow-x: auto`) ekle
- [x] `Warehouses.ts` envanter tablosuna yatay kaydırma sarmalayıcısı ve minimum tablo genişliği (`min-width: 980px`) ekle
- [x] `Warehouses.ts` geçmiş ve sayım tablolarına yatay kaydırma sarmalayıcısı ekle

## Adam Saat Analizleri ve Bakım Planları Hata Giderme
- [x] Hata teşhisi yap (Dynamic import hatası ve Firestore malformed data runtime çökmeleri)
- [x] `Analytics.ts` ve `MaintenancePlanning.ts` dosyalarındaki verileri filtrele ve tipleri koru
- [x] `AgentHealthService.ts` içindeki document reference id hatasını gider
- [x] `npm run build` ile yerel derlemeyi doğrula
- [x] Canlı sunucuya dağıt (`firebase deploy`) ve tüm sistemi test et

* **Sorun:** Saha çalışmasında çevrimdışı modda (offline) form doldururken "Taslağı Kaydet" butonuna basıldığında, Fir
23:32:16 [vite] (client) page reload src/pages/Tasks.ts
23:32:21 [vite] (client) page reload src/services/AuditService.ts
  * Firestore'a yapılan veritabanı kaydı, 1.5 saniyelik bir zaman aşımı (`OFFLINE_TIMEOUT`) ile yarıştırılır. 

### 2. Global Yetki Eşitlemesi (`main.ts` & `Tasks.ts`)
* **Sorun:** `(window as any).currentUser` bilgisi sadece `Warehouses.ts` sayfası yüklendiğinde ayarlanıyordu. Doğrudan "İş Emirleri" sayfasına tıklandığında bu değişken tanımsız (`undefined`) kalıyor ve kurucu/admin yetkileriniz okunmayarak aksiyon sütununda **"YETKİ YOK"** uyarısı veriyordu.
* **Çözüm:** `main.ts` profil yükleme bloğunda `(window as any).currentUser = state.userProfile;` ataması global düzeyde yapılarak tüm sayfaların yetki verisine anında erişmesi sağlandı.

---

### 3. Çevrimdışı Taslak Kaydetme Kilitlenmesi Düzeltmesi (`AuditService.ts`)
* **Sorun:** Saha çalışmasında çevrimdışı modda (offline) form doldururken "Taslağı Kaydet" butonuna basıldığında, Firebase Firestore güncelleme işlemi ağ erişimi olmadığı için askıda kalıyor ve butondaki "KAYDEDİLİYOR..." yükleme animasyonu sonsuz döngüye girerek arayüzü kilitliyordu.
* **Çözüm:** Firestore'a yapılan veritabanı kaydı, 1.5 saniyelik bir zaman aşımı (`OFFLINE_TIMEOUT`) ile yarıştırılır. Bağlantı yoksa yerel bellek başarılı kabul edilerek arayüz butonu anında serbest bırakılır. İnternet geri geldiğinde Firebase veriyi arka planda otomatik senkronize eder.

---

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
// MISSING LINE 95
// MISSING LINE 96
// MISSING LINE 97
// MISSING LINE 98
// MISSING LINE 99
// MISSING LINE 100
// MISSING LINE 101
// MISSING LINE 102
// MISSING LINE 103
// MISSING LINE 104
// MISSING LINE 105
// MISSING LINE 106
// MISSING LINE 107
// MISSING LINE 108
// MISSING LINE 109
// MISSING LINE 110
// MISSING LINE 111
// MISSING LINE 112
// MISSING LINE 113
// MISSING LINE 114
// MISSING LINE 115
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
// MISSING LINE 147
// MISSING LINE 148
// MISSING LINE 149
// MISSING LINE 150
// MISSING LINE 151
// MISSING LINE 152
// MISSING LINE 153
// MISSING LINE 154
// MISSING LINE 155
// MISSING LINE 156
// MISSING LINE 157
// MISSING LINE 158
// MISSING LINE 159
// MISSING LINE 160
// MISSING LINE 161
// MISSING LINE 162
// MISSING LINE 163
// MISSING LINE 164
// MISSING LINE 165
// MISSING LINE 166
// MISSING LINE 167
// MISSING LINE 168
// MISSING LINE 169
// MISSING LINE 170
// MISSING LINE 171
// MISSING LINE 172
// MISSING LINE 173
// MISSING LINE 174
// MISSING LINE 175
// MISSING LINE 176
// MISSING LINE 177
// MISSING LINE 178
// MISSING LINE 179
// MISSING LINE 180
// MISSING LINE 181
// MISSING LINE 182
// MISSING LINE 183
// MISSING LINE 184
// MISSING LINE 185
// MISSING LINE 186
// MISSING LINE 187
// MISSING LINE 188
// MISSING LINE 189
// MISSING LINE 190
// MISSING LINE 191
// MISSING LINE 192
// MISSING LINE 193
// MISSING LINE 194
// MISSING LINE 195
// MISSING LINE 196
// MISSING LINE 197
// MISSING LINE 198
// MISSING LINE 199
// MISSING LINE 200
// MISSING LINE 201
// MISSING LINE 202
// MISSING LINE 203
// MISSING LINE 204
// MISSING LINE 205
// MISSING LINE 206
// MISSING LINE 207
// MISSING LINE 208
// MISSING LINE 209
// MISSING LINE 210
// MISSING LINE 211
// MISSING LINE 212
// MISSING LINE 213
// MISSING LINE 214
// MISSING LINE 215
// MISSING LINE 216
// MISSING LINE 217
// MISSING LINE 218
// MISSING LINE 219
// MISSING LINE 220
// MISSING LINE 221
// MISSING LINE 222
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
// MISSING LINE 251
// MISSING LINE 252
// MISSING LINE 253
// MISSING LINE 254
// MISSING LINE 255
// MISSING LINE 256
// MISSING LINE 257
// MISSING LINE 258
// MISSING LINE 259
// MISSING LINE 260
// MISSING LINE 261
// MISSING LINE 262
// MISSING LINE 263
// MISSING LINE 264
// MISSING LINE 265
// MISSING LINE 266
// MISSING LINE 267
// MISSING LINE 268
// MISSING LINE 269
// MISSING LINE 270
// MISSING LINE 271
// MISSING LINE 272
// MISSING LINE 273
// MISSING LINE 274
// MISSING LINE 275
// MISSING LINE 276
// MISSING LINE 277
// MISSING LINE 278
// MISSING LINE 279
// MISSING LINE 280
// MISSING LINE 281
// MISSING LINE 282
// MISSING LINE 283
// MISSING LINE 284
// MISSING LINE 285
// MISSING LINE 286
// MISSING LINE 287
// MISSING LINE 288
// MISSING LINE 289
// MISSING LINE 290
// MISSING LINE 291
// MISSING LINE 292
// MISSING LINE 293
// MISSING LINE 294
// MISSING LINE 295
// MISSING LINE 296
// MISSING LINE 297
// MISSING LINE 298
// MISSING LINE 299
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
// MISSING LINE 363
// MISSING LINE 364
// MISSING LINE 365
// MISSING LINE 366
// MISSING LINE 367
// MISSING LINE 368
// MISSING LINE 369
// MISSING LINE 370
// MISSING LINE 371
// MISSING LINE 372
// MISSING LINE 373
// MISSING LINE 374
// MISSING LINE 375
// MISSING LINE 376
// MISSING LINE 377
// MISSING LINE 378
// MISSING LINE 379
// MISSING LINE 380
// MISSING LINE 381
// MISSING LINE 382
// MISSING LINE 383
// MISSING LINE 384
// MISSING LINE 385
// MISSING LINE 386
// MISSING LINE 387
// MISSING LINE 388
// MISSING LINE 389
// MISSING LINE 390
// MISSING LINE 391
// MISSING LINE 392
// MISSING LINE 393
// MISSING LINE 394
// MISSING LINE 395
// MISSING LINE 396
// MISSING LINE 397
// MISSING LINE 398
// MISSING LINE 399
// MISSING LINE 400
// MISSING LINE 401
// MISSING LINE 402
// MISSING LINE 403
// MISSING LINE 404
// MISSING LINE 405
// MISSING LINE 406
// MISSING LINE 407
// MISSING LINE 408
// MISSING LINE 409
// MISSING LINE 410
        <div class="premium-card modal-content" style="width: 90%; max-width: 900px; padding: 0; overflow: hidden; position: relative; background: #0a192f; border: 1px solid rgba(100,255,218,0.2); box-shadow: 0 30px 60px rgba(0,0,0,0.8); transform: scale(0.9); transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);">
          <div style="padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
            <h3 id="preview-title" style="margin: 0; color: var(--accent-blue); font-size: 1.1rem;">Malzeme Resmi</h3>
            <button onclick="document.getElementById('image-preview-modal').style.display='none'" class="action-icon-btn" style="background: rgba(255,255,255,0.05);">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div style="width: 100%; height: 600px; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <img id="preview-img" style="max-width: 100%; max-height: 100%; object-fit: contain;">
          </div>
          <div style="padding: 1.5rem; display: flex; justify-content: center; gap: 1rem; background: rgba(255,255,255,0.02);">
            <button onclick="document.getElementById('image-preview-modal').style.display='none'" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: var(--text-main); padding: 12px 30px; border-radius: 12px;">KAPAT</button>

// MISSING LINE 424
// MISSING LINE 425
// MISSING LINE 426
// MISSING LINE 427
// MISSING LINE 428
// MISSING LINE 429
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
// MISSING LINE 451
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
// MISSING LINE 515
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
// MISSING LINE 576
// MISSING LINE 577
// MISSING LINE 578
// MISSING LINE 579
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
              <button onclick="window.updateWarehouseUI(undefined, undefined, undefined, (document.getElementById('inventory-search') as HTMLInputElement).value)" 
                      style="position: absolute; right: 6px; width: 36px; height: 36px; background: var(--accent-blue); border: none; color: #0a1118; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; transition: all 0.2s;"
                      onmouseover="this.style.filter='brightness(1.1)';" 
                      onmouseout="this.style.filter='none';">
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
            </div>
            
            <button onclick="window.startQuickAudit('${selectedWarehouseId}')" class="btn-cyber" style="background: linear-gradient(135deg, #64ffda 0%, #48bb78 100%); color: #000; padding: 10px 18px; border-radius: 10px; font-size: 0.75rem; font-weight: 900; border: none; cursor: pointer; box-shadow: 0 4px 15px rgba(100, 255, 218, 0.2); flex-shrink: 0;">
              <i class="fa-solid fa-bolt" style="margin-right: 8px;"></i> HIZLI SAYIM
            </button>

            <button onclick="window.startQRScanner('${selectedWarehouseId}')" class="btn-cyber" style="background: rgba(100, 255, 218, 0.1); color: var(--accent-blue); padding: 10px 18px; border-radius: 10px; font-size: 0.75rem; font-weight: 800; border: 1px solid rgba(100, 255, 218, 0.2); cursor: pointer; flex-shrink: 0;">
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
// MISSING LINE 651
// MISSING LINE 652
// MISSING LINE 653
// MISSING LINE 654
// MISSING LINE 655
// MISSING LINE 656
// MISSING LINE 657
// MISSING LINE 658
// MISSING LINE 659
// MISSING LINE 660
// MISSING LINE 661
// MISSING LINE 662
// MISSING LINE 663
// MISSING LINE 664
// MISSING LINE 665
// MISSING LINE 666
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
// MISSING LINE 700
// MISSING LINE 701
// MISSING LINE 702
// MISSING LINE 703
// MISSING LINE 704
// MISSING LINE 705
// MISSING LINE 706
// MISSING LINE 707
// MISSING LINE 708
// MISSING LINE 709
// MISSING LINE 710
// MISSING LINE 711
// MISSING LINE 712
// MISSING LINE 713
// MISSING LINE 714
// MISSING LINE 715
// MISSING LINE 716
// MISSING LINE 717
// MISSING LINE 718
// MISSING LINE 719
// MISSING LINE 720
// MISSING LINE 721
// MISSING LINE 722
// MISSING LINE 723
// MISSING LINE 724
// MISSING LINE 725

            ${draftReservations.details.length > 0 ? `
            <!-- Aktif Rezervasyonlar Kartı -->
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
                      <span style="background: ${d.durum === 'Görev Teslim Edildi' ? 'rgba(100, 255, 218, 0.1)' : 'rgba(255, 152, 0, 0.1)'}; color: ${d.durum === 'Görev Teslim Edildi' ? 'var(--accent-blue)' : '#ff9800'}; padding: 3px 10px; border-radius: 8px; font-size: 0.6rem; font-weight: 800;">${d.durum}</span>
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
// MISSING LINE 766
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
// MISSING LINE 785
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
                      </td>
                    </tr>
                  ` : inventoryData.map(item => `
                    <tr class="material-row" style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                      <td style="padding: 1rem; text-align: center;">
                        <input type="checkbox" class="item-checkbox" data-id="${item.id}" onchange="window.updateBatchCount()" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-blue);">
                      </td>
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
// MISSING LINE 830
// MISSING LINE 831
// MISSING LINE 832
// MISSING LINE 833
// MISSING LINE 834
// MISSING LINE 835
// MISSING LINE 836
// MISSING LINE 837
// MISSING LINE 838
// MISSING LINE 839
// MISSING LINE 840
// MISSING LINE 841
// MISSING LINE 842
// MISSING LINE 843
// MISSING LINE 844
// MISSING LINE 845
// MISSING LINE 846
// MISSING LINE 847
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
// MISSING LINE 859
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
                    <tr class="material-row" style="border-bottom: 1px s
// MISSING LINE 957
// MISSING LINE 958
// MISSING LINE 959
// MISSING LINE 960
// MISSING LINE 961
// MISSING LINE 962
// MISSING LINE 963
// MISSING LINE 964
// MISSING LINE 965
// MISSING LINE 966
// MISSING LINE 967
// MISSING LINE 968
// MISSING LINE 969
// MISSING LINE 970
// MISSING LINE 971
// MISSING LINE 972
// MISSING LINE 973
// MISSING LINE 974
// MISSING LINE 975
// MISSING LINE 976
// MISSING LINE 977
// MISSING LINE 978
// MISSING LINE 979
// MISSING LINE 980
// MISSING LINE 981
// MISSING LINE 982
// MISSING LINE 983
// MISSING LINE 984
// MISSING LINE 985
// MISSING LINE 986
// MISSING LINE 987
// MISSING LINE 988
// MISSING LINE 989
// MISSING LINE 990
// MISSING LINE 991
// MISSING LINE 992
// MISSING LINE 993
// MISSING LINE 994
// MISSING LINE 995
// MISSING LINE 996
// MISSING LINE 997
// MISSING LINE 998
// MISSING LINE 999
// MISSING LINE 1000
// MISSING LINE 1001
// MISSING LINE 1002
// MISSING LINE 1003
// MISSING LINE 1004
// MISSING LINE 1005
// MISSING LINE 1006
// MISSING LINE 1007
// MISSING LINE 1008
// MISSING LINE 1009
// MISSING LINE 1010
// MISSING LINE 1011
// MISSING LINE 1012
// MISSING LINE 1013
// MISSING LINE 1014
// MISSING LINE 1015
// MISSING LINE 1016
// MISSING LINE 1017
// MISSING LINE 1018
// MISSING LINE 1019
// MISSING LINE 1020
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
                        <div style="padding: 1.5rem; border-radius: 20px; background: rgba(255,77,77,0.05); border: 1px solid rgba(255,77,77,0.1);">
                            <div style="font-size: 0.7rem; color: #ff4d4d; margin-bottom: 8px;">KRİTİK STOK</div>
                            <div style="font-size: 2rem; font-weight: 900;">${criticalItems.length}</div>
                        </div>
                    </div>
                </div>
              </div>
            </div>
          ` : activeTab === 'audit_history' ? `
            <div class="premium-card" style="padding: 0; overflow: hidden; border-radius: 20px;">
              <table style="width: 100%; border-collapse: collapse;">
                <thead>
                  <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <th style="padding: 1.2rem 1.5rem; text-align: left; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Tarih</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: left; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Kullanıcı</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: center; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Toplam Kalem</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: center; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Hatalı Kalem</th>
                    <th style="padding: 1.2rem 1.5rem; text-align: right; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase;">Aksiyon</th>
                  </tr>
                </thead>
// MISSING LINE 1101
// MISSING LINE 1102
// MISSING LINE 1103
// MISSING LINE 1104
// MISSING LINE 1105
// MISSING LINE 1106
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
// MISSING LINE 1136
// MISSING LINE 1137
// MISSING LINE 1138
// MISSING LINE 1139
// MISSING LINE 1140
// MISSING LINE 1141
// MISSING LINE 1142
// MISSING LINE 1143
// MISSING LINE 1144
// MISSING LINE 1145
// MISSING LINE 1146
// MISSING LINE 1147
// MISSING LINE 1148
// MISSING LINE 1149
// MISSING LINE 1150
// MISSING LINE 1151
// MISSING LINE 1152
// MISSING LINE 1153
// MISSING LINE 1154
// MISSING LINE 1155
// MISSING LINE 1156
// MISSING LINE 1157
// MISSING LINE 1158
// MISSING LINE 1159
// MISSING LINE 1160
// MISSING LINE 1161
// MISSING LINE 1162
// MISSING LINE 1163
// MISSING LINE 1164
// MISSING LINE 1165
// MISSING LINE 1166
// MISSING LINE 1167
// MISSING LINE 1168
// MISSING LINE 1169
// MISSING LINE 1170
// MISSING LINE 1171
// MISSING LINE 1172
// MISSING LINE 1173
// MISSING LINE 1174
// MISSING LINE 1175
// MISSING LINE 1176
// MISSING LINE 1177
// MISSING LINE 1178
// MISSING LINE 1179
// MISSING LINE 1180
// MISSING LINE 1181
// MISSING LINE 1182
// MISSING LINE 1183
// MISSING LINE 1184
// MISSING LINE 1185
// MISSING LINE 1186
// MISSING LINE 1187
// MISSING LINE 1188
// MISSING LINE 1189
// MISSING LINE 1190
// MISSING LINE 1191
// MISSING LINE 1192
// MISSING LINE 1193
// MISSING LINE 1194
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
// MISSING LINE 1216
// MISSING LINE 1217
// MISSING LINE 1218
// MISSING LINE 1219
// MISSING LINE 1220
// MISSING LINE 1221
// MISSING LINE 1222
// MISSING LINE 1223
// MISSING LINE 1224
// MISSING LINE 1225
// MISSING LINE 1226
// MISSING LINE 1227
// MISSING LINE 1228
// MISSING LINE 1229
// MISSING LINE 1230
// MISSING LINE 1231
// MISSING LINE 1232
// MISSING LINE 1233
// MISSING LINE 1234
// MISSING LINE 1235
// MISSING LINE 1236
// MISSING LINE 1237
// MISSING LINE 1238
// MISSING LINE 1239
// MISSING LINE 1240
// MISSING LINE 1241
// MISSING LINE 1242
// MISSING LINE 1243
// MISSING LINE 1244
// MISSING LINE 1245
// MISSING LINE 1246
// MISSING LINE 1247
// MISSING LINE 1248
// MISSING LINE 1249
// MISSING LINE 1250
// MISSING LINE 1251
// MISSING LINE 1252
// MISSING LINE 1253
// MISSING LINE 1254
// MISSING LINE 1255
// MISSING LINE 1256
// MISSING LINE 1257
// MISSING LINE 1258
// MISSING LINE 1259
// MISSING LINE 1260
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
      
