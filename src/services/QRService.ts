import QRCode from 'qrcode';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { soundService } from './SoundService';

class QRService {
    async generateDataURL(text: string): Promise<string> {
        try {
            return await QRCode.toDataURL(text, {
                width: 300,
                margin: 4,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
        } catch (err) {
            console.error('QR Generate Error:', err);
            return '';
        }
    }

    printLabel(material: { sapNo: string, description: string, id: string }) {
        this.generateDataURL(material.id || material.sapNo).then(dataUrl => {
            const printWindow = window.open('', '_blank');
            if (!printWindow) return;

            printWindow.document.write(`
                <html>
                    <head>
                        <title>Malzeme Etiketi - ${material.sapNo}</title>
                        <style>
                            @page { size: 80mm 50mm; margin: 0; }
                            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 15px; display: flex; align-items: center; justify-content: center; height: 100vh; background: white; }
                            .label-card { border: 2px solid #000; width: 100%; height: 100%; display: flex; align-items: center; gap: 20px; padding: 10px; box-sizing: border-box; border-radius: 10px; }
                            .qr-code { width: 120px; height: 120px; }
                            .details { flex: 1; }
                            .sap { font-size: 24px; font-weight: 900; margin-bottom: 5px; }
                            .desc { font-size: 14px; color: #333; line-height: 1.2; font-weight: 600; }
                            .footer { margin-top: 10px; font-size: 10px; opacity: 0.5; font-weight: 700; text-transform: uppercase; }
                        </style>
                    </head>
                    <body>
                        <div class="label-card">
                            <img class="qr-code" src="${dataUrl}">
                            <div class="details">
                                <div class="sap">${material.sapNo}</div>
                                <div class="desc">${material.description}</div>
                            </div>
                        </div>
                        <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
                    </body>
                </html>
            `);
            printWindow.document.close();
        });
    }

    async printBulkLabels(items: Array<{id: string, sapNo: string, description: string}>) {
        // Open the window synchronously first to bypass popup blockers
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Açılır pencere engellendi. Lütfen tarayıcınızın üst kısmından bu site için açılır pencerelere izin verin.');
            return;
        }

        printWindow.document.write(`
            <html><head><title>Etiketler Hazırlanıyor...</title></head>
            <body style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
                <h2>QR Kodlar oluşturuluyor, lütfen bekleyin...</h2>
            </body></html>
        `);

        // Generate QR codes for all items
        const itemsWithQR = await Promise.all(items.map(async item => {
            const isTurbine = item.id?.startsWith('turbine:');
            const qrText = isTurbine 
                ? (item.id || item.sapNo) 
                : JSON.stringify({ id: item.id, sapNo: item.sapNo, warehouseId: (item as any).warehouseId });
            const dataUrl = await this.generateDataURL(qrText);
            return { ...item, dataUrl };
        }));

        // Group into pages of 14 labels
        const pages = [];
        for (let i = 0; i < itemsWithQR.length; i += 14) {
            pages.push(itemsWithQR.slice(i, i + 14));
        }

        const pagesHtml = pages.map(pageItems => `
            <div class="page">
                ${pageItems.map(item => {
                    const isTurbine = item.id?.startsWith('turbine:');
                    const sapLabel = isTurbine ? item.sapNo : `SAP: ${item.sapNo}`;
                    const descLabel = (item.description || '').toLocaleUpperCase('tr-TR');
                    
                    const turbineIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-top:-2px;"><path d="M10 22h4"/><path d="M12 22V10"/><path d="M12 10V2"/><path d="M12 10L4 14.6"/><path d="M12 10L20 14.6"/><circle cx="12" cy="10" r="1.5" fill="currentColor"/></svg>`;
                    
                    const boxIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-top:-2px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
                    
                    const iconSvg = isTurbine ? turbineIcon : boxIcon;

                    return `
                    <div class="label-box">
                        <div class="details">
                            <div class="sap">
                              ${iconSvg}
                              <span>${sapLabel}</span>
                            </div>
                            <div class="desc">${descLabel}</div>
                        </div>
                        <img class="qr-img" src="${item.dataUrl}">
                    </div>`;
                }).join('')}
            </div>
        `).join('');

        printWindow.document.open();
        printWindow.document.write(`
            <html>
                <head>
                    <title>Toplu Malzeme Etiketleri</title>
                    <style>
                        @page { size: A4; margin: 0; }
                        @media print {
                            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                        }
                        body { 
                            margin: 0; 
                            padding: 0; 
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                            background: white; 
                            box-sizing: border-box; 
                        }
                        .page {
                            width: 210mm;
                            height: 297mm;
                            padding-top: 15.15mm;
                            padding-left: 5.9mm;
                            padding-right: 5.9mm;
                            box-sizing: border-box;
                            display: grid;
                            grid-template-columns: 99.1mm 99.1mm;
                            grid-template-rows: repeat(7, 38.1mm);
                            page-break-after: always;
                            overflow: hidden;
                        }
                        .page:last-child {
                            page-break-after: auto;
                        }
                        .label-box {
                            width: 99.1mm;
                            height: 38.1mm;
                            box-sizing: border-box;
                            padding: 4mm;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            overflow: hidden;
                        }
                        .details { 
                            flex: 1; 
                            min-width: 0; 
                            display: flex; 
                            flex-direction: column; 
                            justify-content: center; 
                            text-align: left;
                            padding-right: 3mm;
                        }
                        .sap { 
                            font-size: 14pt; 
                            font-weight: 900; 
                            color: #000; 
                            margin-bottom: 2mm; 
                            display: flex; 
                            align-items: center; 
                            gap: 6px; 
                            line-height: 1.1; 
                        }
                        .desc { 
                            font-size: 9pt; 
                            font-weight: 700; 
                            color: #333; 
                            line-height: 1.2; 
                            width: 100%;
                            word-break: break-word;
                            display: -webkit-box; 
                            -webkit-line-clamp: 2; 
                            -webkit-box-orient: vertical; 
                            overflow: hidden; 
                            text-overflow: ellipsis; 
                        }
                        .qr-img { 
                            width: 30mm; 
                            height: 30mm; 
                            flex-shrink: 0; 
                            object-fit: contain; 
                        }
                    </style>
                </head>
                <body>
                    ${pagesHtml}
                    <script>
                        window.onload = () => { 
                            setTimeout(() => {
                                window.print();
                            }, 500);
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    }

    initScanner(elementId: string, onScan: (decodedText: string) => void) {
        const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const edge = Math.max(220, Math.floor(minEdge * 0.75));
            return { width: edge, height: edge };
        };

        const scanner = new Html5QrcodeScanner(elementId, {
            fps: 20,
            qrbox: qrboxFunction,
            aspectRatio: 1.0,
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            }
        }, false);

        scanner.render((decodedText) => {
            soundService.playScannerBeep();
            onScan(decodedText);
        }, (_err) => {
            // Silence errors as they happen every frame if no QR is found
        });

        return scanner;
    }

    async printWorkshopCardLabel(card: {
        id?: string;
        sapNo: string;
        serialNo?: string;
        description: string;
        testStatus?: 'TESTED' | 'UNTESTED';
        repairDate?: string;
        repairNotes?: string;
        shelfNo?: string;
    }) {
        return this.printBulkWorkshopCardLabels([card]);
    }

    async printBulkWorkshopCardLabels(cards: Array<{
        id?: string;
        sapNo: string;
        serialNo?: string;
        description: string;
        testStatus?: 'TESTED' | 'UNTESTED';
        repairDate?: string;
        repairNotes?: string;
        shelfNo?: string;
    }>) {
        if (!cards || cards.length === 0) {
            alert('Yazdırılacak kart seçilmedi.');
            return;
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Açılır pencere engellendi. Lütfen tarayıcınızın üst kısmından bu site için açılır pencerelere izin verin.');
            return;
        }

        printWindow.document.write(`
            <html><head><title>Etiketler Hazırlanıyor...</title></head>
            <body style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
                <h3>Xprinter XP-470B Etiketleri Hazırlanıyor, Lütfen Bekleyin...</h3>
            </body></html>
        `);

        const cardsWithQR = await Promise.all(cards.map(async card => {
            const qrUrl = `${window.location.origin}/?page=card-passport&id=${card.id || ''}&sap=${card.sapNo}&serial=${encodeURIComponent(card.serialNo || '')}`;
            let qrDataUrl = '';
            try {
                qrDataUrl = await QRCode.toDataURL(qrUrl, {
                    width: 350,
                    margin: 0,
                    color: {
                        dark: '#000000',
                        light: '#ffffff'
                    }
                });
            } catch(e) {
                qrDataUrl = await this.generateDataURL(qrUrl);
            }
            return { ...card, qrDataUrl };
        }));

        const labelsHtml = cardsWithQR.map(c => {
            const testBadge = c.testStatus === 'UNTESTED'
                ? `<span class="test-badge untested">⚠️ ONARILDI - TÜRBİNDE TEST EDİLECEK</span>`
                : `<span class="test-badge tested">✓ ONARILDI & TEST EDİLDİ</span>`;

            const dateStr = c.repairDate || new Date().toLocaleDateString('tr-TR');
            const cleanDesc = (c.description || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            return `
                <div class="label-page">
                    <div class="label-box">
                        <div class="header">
                            <span>DEMİRER HOLDİNG</span>
                            <span>MERKEZ TAMİR ATÖLYESİ</span>
                        </div>
                        <div class="body-content">
                            <div class="details">
                                <div class="sap-num">SAP: ${c.sapNo}</div>
                                <div class="serial-num">SERİ: ${c.serialNo && c.serialNo !== '-' ? c.serialNo : '-'}</div>
                                <div class="desc-text" title="${cleanDesc}">
                                    ${cleanDesc}
                                </div>
                                <div style="margin-top: 2px;">
                                    ${testBadge}
                                </div>
                            </div>
                            <div class="qr-container">
                                <img class="qr-img" src="${c.qrDataUrl}" alt="QR Code" />
                                <div class="qr-label">DİJİTAL KARNE</div>
                            </div>
                        </div>
                        <div class="footer">
                            <span>TARİH: ${dateStr}</span>
                            ${c.shelfNo ? `<span>RAF: ${c.shelfNo}</span>` : '<span></span>'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        printWindow.document.open();
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Etiket</title>
                <style>
                    @page {
                        size: 80mm 40mm;
                        margin: 0 !important;
                    }
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }
                    html, body {
                        width: 80mm;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #fff;
                        color: #000;
                        font-family: Arial, Helvetica, sans-serif;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .label-page {
                        width: 80mm;
                        height: 40mm;
                        box-sizing: border-box;
                        page-break-after: always;
                        break-after: page;
                        page-break-inside: avoid;
                        break-inside: avoid;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        padding: 1mm;
                    }
                    .label-page:last-child {
                        page-break-after: auto;
                        break-after: auto;
                    }
                    .label-box {
                        width: 78mm;
                        height: 38mm;
                        padding: 1.5mm 2mm;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        border: 1.5px solid #000;
                        border-radius: 2mm;
                        overflow: hidden;
                        box-sizing: border-box;
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 1.2px solid #000;
                        padding-bottom: 1px;
                        font-size: 7pt;
                        font-weight: 900;
                        letter-spacing: 0.2px;
                    }
                    .body-content {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 1.5mm;
                        flex: 1;
                        padding: 1px 0;
                        overflow: hidden;
                    }
                    .details {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        gap: 1px;
                        overflow: hidden;
                    }
                    .sap-serial-row {
                        display: flex;
                        align-items: baseline;
                        gap: 2mm;
                        white-space: nowrap;
                    }
                    .sap-num {
                        font-size: 11pt;
                        font-weight: 900;
                        letter-spacing: 0.3px;
                        line-height: 1.1;
                    }
                    .serial-num {
                        font-size: 9.5pt;
                        font-weight: 900;
                        line-height: 1.1;
                    }
                    .desc-text {
                        font-size: 7pt;
                        font-weight: 700;
                        line-height: 1.1;
                        max-height: 2.2em;
                        overflow: hidden;
                        display: -webkit-box;
                        -webkit-line-clamp: 2;
                        -webkit-box-orient: vertical;
                        margin-top: 1px;
                    }
                    .test-badge {
                        display: inline-block;
                        font-size: 5.6pt;
                        font-weight: 900;
                        padding: 1px 3px;
                        border-radius: 2px;
                        margin-top: 1px;
                        white-space: nowrap;
                        background: #fff;
                        color: #000;
                        letter-spacing: -0.15px;
                    }
                    .test-badge.tested {
                        font-size: 6.2pt;
                        background: #fff;
                        color: #000;
                        border: 1.2px solid #000;
                    }
                    .test-badge.untested {
                        font-size: 5.4pt;
                        background: #fff;
                        color: #000;
                        border: 1.2px dashed #000;
                    }
                    .note-text {
                        font-size: 6pt;
                        font-weight: 700;
                        color: #000;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        max-width: 52mm;
                    }
                    .qr-container {
                        width: 25mm;
                        height: 26mm;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }
                    .qr-img {
                        width: 23mm;
                        height: 23mm;
                        display: block;
                    }
                    .qr-label {
                        font-size: 5pt;
                        font-weight: 900;
                        letter-spacing: 0.3px;
                        margin-top: 1px;
                        text-align: center;
                    }
                    .footer {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-top: 1px solid #000;
                        padding-top: 1px;
                        font-size: 6pt;
                        font-weight: 800;
                    }
                </style>
            </head>
            <body>
                ${labelsHtml}
                <script>
                    window.onload = () => {
                        window.print();
                    };
                </script>
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    scanQRCode(): Promise<string> {
        return new Promise((resolve, reject) => {
            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: #000; z-index: 30000; display: flex; flex-direction: column; align-items: center; justify-content: center;';
            
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = 'İPTAL';
            closeBtn.style.cssText = 'position: absolute; top: 20px; right: 20px; background: rgba(255,255,255,0.1); color: white; border: none; padding: 10px 20px; border-radius: 8px; font-weight: bold; z-index: 30001;';
            closeBtn.onclick = () => {
                scanner.clear();
                modal.remove();
                reject(new Error("Canceled"));
            };
            modal.appendChild(closeBtn);

            const readerContainer = document.createElement('div');
            readerContainer.id = 'temp-qr-reader';
            readerContainer.style.width = '100%';
            readerContainer.style.maxWidth = '500px';
            modal.appendChild(readerContainer);
            
            document.body.appendChild(modal);

            const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
                const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
                const edge = Math.max(220, Math.floor(minEdge * 0.75));
                return { width: edge, height: edge };
            };

            const scanner = new Html5QrcodeScanner('temp-qr-reader', { 
                fps: 20, 
                qrbox: qrboxFunction, 
                aspectRatio: 1.0,
                experimentalFeatures: {
                    useBarCodeDetectorIfSupported: true
                }
            }, false);

            scanner.render((decodedText) => {
                soundService.playScannerBeep();
                scanner.clear();
                modal.remove();
                resolve(decodedText);
            }, () => {});
        });
    }
}

export const qrService = new QRService();
