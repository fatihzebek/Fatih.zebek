import QRCode from 'qrcode';
import { Html5QrcodeScanner } from 'html5-qrcode';

class QRService {
    async generateDataURL(text: string): Promise<string> {
        try {
            return await QRCode.toDataURL(text, {
                width: 300,
                margin: 2,
                color: {
                    dark: '#0a192f',
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
                            body { font-family: 'Inter', sans-serif; margin: 0; padding: 15px; display: flex; align-items: center; justify-content: center; height: 100vh; background: white; }
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
            const dataUrl = await this.generateDataURL(item.id || item.sapNo);
            return { ...item, dataUrl };
        }));

        // Group into pages of 14 labels
        const pages = [];
        for (let i = 0; i < itemsWithQR.length; i += 14) {
            pages.push(itemsWithQR.slice(i, i + 14));
        }

        const pagesHtml = pages.map(pageItems => `
            <div class="page">
                ${pageItems.map(item => `
                    <div class="label-box">
                        <img class="qr-img" src="${item.dataUrl}">
                        <div class="details">
                            <div class="sap" style="display: flex; align-items: center; gap: 6px;">
                              ${item.id?.startsWith('turbine:') ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-top:-2px; opacity:0.9;"><path d="M10 22h4"/><path d="M12 22V10"/><path d="M12 10V2"/><path d="M12 10L4 14.6"/><path d="M12 10L20 14.6"/><circle cx="12" cy="10" r="1.5" fill="currentColor"/></svg>` : ''}
                              ${item.sapNo}
                            </div>
                            <div class="desc">${item.description}</div>
                        </div>
                    </div>
                `).join('')}
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
                            font-family: 'Inter', system-ui, sans-serif; 
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
                            gap: 4mm;
                            overflow: hidden;
                        }
                        .qr-img { width: 30mm; height: 30mm; flex-shrink: 0; object-fit: contain; }
                        .details { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; }
                        .sap { font-size: 14pt; font-weight: 900; color: #000; margin-bottom: 2mm; word-break: break-all; line-height: 1.1; }
                        .desc { 
                            font-size: 9pt; 
                            font-weight: 600; 
                            color: #333; 
                            line-height: 1.2; 
                            display: -webkit-box; 
                            -webkit-line-clamp: 3; 
                            -webkit-box-orient: vertical; 
                            overflow: hidden; 
                            text-overflow: ellipsis; 
                        }
                        .footer { margin-top: 2mm; font-size: 6pt; font-weight: 800; color: #666; text-transform: uppercase; }
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
        const scanner = new Html5QrcodeScanner(elementId, {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        }, false);

        scanner.render(onScan, (_err) => {
            // Silence errors as they happen every frame if no QR is found
        });

        return scanner;
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

            const scanner = new Html5QrcodeScanner('temp-qr-reader', { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, false);
            scanner.render((decodedText) => {
                scanner.clear();
                modal.remove();
                resolve(decodedText);
            }, () => {});
        });
    }
}

export const qrService = new QRService();
