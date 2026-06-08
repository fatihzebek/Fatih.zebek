const fs = require('fs');

let code = fs.readFileSync('src/pages/ReportArchive.ts', 'utf8');

const excelBtn = `
          <button onclick="window.downloadReportExcel(event)" class="cyber-button" style="background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; color: #22c55e; padding: 8px 16px; cursor: pointer; margin-left: 0.5rem;">
            <i class="fa-solid fa-file-excel"></i> EXCEL İNDİR
          </button>`;

code = code.replace(
    '</button>\n          ` : \'\'}',
    '</button>' + excelBtn + '\n          ` : \'\'}'
);

const excelFunc = `
(window as any).downloadReportExcel = async (event: Event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    const reportNoEl = document.getElementById('preview-report-no');
    if (!reportNoEl) return;
    
    const reportNo = reportNoEl.innerText;
    
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> HAZIRLANIYOR...';
    btn.disabled = true;

    try {
        const { serviceReportService } = await import('../services/ServiceReportService');
        const report = await serviceReportService.getReportByNo(reportNo);
        if (!report) throw new Error("Rapor bulunamadı.");

        const xlsx = await import('xlsx');
        
        // --- 1. GENEL BİLGİLER ---
        const wsData = [];
        wsData.push(["BAKIM KONTROL LİSTESİ - GENEL BİLGİLER"]);
        wsData.push(["Rapor No", report.reportNo]);
        wsData.push(["Şablon", report.templateName]);
        wsData.push(["Türbin", report.turbineNo]);
        wsData.push(["Seri No", report.turbineSerial]);
        wsData.push(["Saha", report.siteName]);
        wsData.push(["Tarih", new Date(report.date).toLocaleDateString('tr-TR')]);
        wsData.push([]);
        
        // --- 2. KONTROL MADDELERİ ---
        if (report.checklist && report.checklist.length > 0) {
            wsData.push(["KONTROL MADDELERİ"]);
            wsData.push(["NO", "KONTROL MADDESİ", "DURUM", "AÇIKLAMA", "ALT DETAYLAR (ÖLÇÜM / İMZA / vs)"]);
            
            report.checklist.forEach((item: any, idx: number) => {
                const isOk = item.status === 'OK';
                const isNa = item.status === 'NA';
                const statusLabel = isOk ? 'TAMAMLANDI' : (isNa ? 'OPSİYON DIŞI' : 'TAMAMLANMADI');
                
                let details = '';
                if (item.measurementConfig && item.measurementConfig.type !== 'standard' && item.measurementValues && item.measurementValues.length > 0) {
                    const type = item.measurementConfig.type;
                    const vals = item.measurementValues;
                    
                    if (type === 'torque_control') details = \`Değer: \${vals[0] || '-'} | İmza: \${vals[1] || '-'}\`;
                    else if (type === 'oil_sample') details = \`Numune: \${vals[0] === 'true' ? 'Evet' : 'Hayır'} | Miktar: \${vals[1] || '-'} | İmza: \${vals[2] || '-'}\`;
                    else if (type === 'oil_level_control') details = \`Seviye: \${vals[0] || '-'} | Eklenen: \${vals[1] || '-'} | İmza: \${vals[2] || '-'}\`;
                    else if (type === 'filter_change') details = \`Değişti: \${vals[0] === 'true' ? 'Evet' : 'Hayır'} | Temizlendi: \${vals[1] === 'true' ? 'Evet' : 'Hayır'} | İmza: \${vals[2] || '-'}\`;
                    else if (type === 'signature_approval') details = \`İmza/Onay: \${vals[0] || '-'}\`;
                    else if (type === 'crane_control') details = \`Vinç: \${vals[0] || '-'} | Çap: \${vals[1] || '-'} | Kopuk: (30:\${vals[2]||'0'}, 60:\${vals[3]||'0'}, 300:\${vals[4]||'0'}) | İmza: \${vals[5] || '-'}\`;
                    else if (type === 'safety_equipment_control') details = \`Son Kontrol: \${vals[0] || '-'} | Eksiksiz/Hasarsız: \${vals[1] === 'true' ? 'Evet' : 'Hayır'} | İmza: \${vals[2] || '-'}\`;
                    else if (type === 'bearing_control') details = \`Numune: \${vals[0] === 'true' ? 'Evet' : 'Hayır'} | ÖN Gres: \${vals[1] || '-'} | ARKA Gres: \${vals[2] || '-'} | İmza: \${vals[3] || '-'}\`;
                    else if (type === 'final_checkout_control') {
                        details = \`1:\${vals[0]==='true'?'☑':'☐'} 2:\${vals[1]==='true'?'☑':'☐'} 3:\${vals[2]==='true'?'☑':'☐'} 4:\${vals[3]==='true'?'☑':'☐'} 5:\${vals[4]==='true'?'☑':'☐'} | İmza:\${vals[5]||'-'}\`;
                    }
                    else if (type === 'numeric_multiple') {
                        const labels = item.measurementConfig.measurementLabels || [];
                        details = vals.map((v: any, i: number) => {
                            if (item.measurementConfig.requireSignature && i === vals.length - 1 && vals.length > item.measurementConfig.inputCount) return \`İmza: \${v || '-'}\`;
                            return \`\${labels[i] || 'Ölçüm '+(i+1)}: \${v || '-'}\`;
                        }).join(' | ');
                    }
                    else if (type === 'version_control') {
                        const items = item.measurementConfig.versionItems || [];
                        details = vals.map((v: any, i: number) => \`\${items[i]?.label || 'Kart '+(i+1)}: \${v || '-'}\`).join(' | ');
                    }
                    else if (type === 'dropdown') {
                        details = \`Seçim: \${vals[0] || '-'}\`;
                    }
                }
                
                wsData.push([
                    (idx + 1).toString(),
                    item.text,
                    statusLabel,
                    item.comment || '',
                    details
                ]);
            });
            wsData.push([]);
        }
        
        // --- 3. İSG KONTROLLERİ ---
        if (report.ohsChecklist && report.ohsChecklist.length > 0) {
            wsData.push(["İSG KONTROLLERİ"]);
            wsData.push(["NO", "İSG MADDESİ", "DURUM", "AÇIKLAMA"]);
            
            report.ohsChecklist.forEach((item: any, idx: number) => {
                const isOk = item.status === 'OK';
                const isNa = item.status === 'NA';
                const statusLabel = isOk ? 'TAMAMLANDI' : (isNa ? 'OPSİYON DIŞI' : 'TAMAMLANMADI');
                
                wsData.push([
                    (idx + 1).toString(),
                    item.text,
                    statusLabel,
                    item.comment || ''
                ]);
            });
            wsData.push([]);
        }

        // --- 4. EXCEL DOSYASINI OLUŞTUR VE İNDİR ---
        const ws = xlsx.utils.aoa_to_sheet(wsData);
        
        // Basit Sütun Genişliği Ayarı
        ws['!cols'] = [
            { wch: 5 },   // NO
            { wch: 60 },  // KONTROL MADDESİ
            { wch: 15 },  // DURUM
            { wch: 40 },  // AÇIKLAMA
            { wch: 70 }   // ALT DETAYLAR
        ];

        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Rapor");
        
        xlsx.writeFile(wb, \`DH_Servis_Rapor_\${reportNo}.xlsx\`);

    } catch (err: any) {
        console.error("Excel Download error", err);
        alert("Excel indirilirken bir hata oluştu: " + err.message);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};
`;

code = code.replace(
    '(window as any).downloadReportPDF = async (event: Event) => {',
    excelFunc + '\n(window as any).downloadReportPDF = async (event: Event) => {'
);

fs.writeFileSync('src/pages/ReportArchive.ts', code, 'utf8');
console.log('Done!');
