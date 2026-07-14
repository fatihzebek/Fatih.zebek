import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, onSnapshot } from 'firebase/firestore';
import { dataService } from '../services/DataService';
import parameterDefs from './parameter_definitions.json';
import XLSX from 'xlsx-js-style';

export const ParameterAuditPage = async () => {
  const formatParameterValue = (val: any): string => {
    if (val === undefined || val === null) return '-';
    const num = Number(val);
    if (!isNaN(num)) {
      if (Number.isInteger(num)) {
        return String(num);
      }
      return parseFloat(num.toFixed(3)).toString();
    }
    return String(val);
  };

  const sites = dataService.getSites().map(s => ({ id: s.id, name: s.name }));

  // Default to Sarıkaya
  let selectedSiteId = (window as any).selectedAuditSiteId || '3439';
  (window as any).selectedAuditSiteId = selectedSiteId;

  const parametersToAudit = Object.keys(parameterDefs);

  // Load snapshots from Firestore
  let snapshots: any[] = [];
  try {
    const q = query(collection(db, 'turbineParameterSnapshots'), where('siteId', '==', selectedSiteId));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((docSnap) => {
      snapshots.push(docSnap.data());
    });
  } catch (err) {
    console.error("Error loading parameter snapshots:", err);
  }

  // Get dynamic turbine count for the selected site
  const siteInfo = dataService.getSites().find(s => s.id === selectedSiteId);
  const turbineCount = siteInfo ? siteInfo.turbineCount : 15;
  const columns = Array.from({ length: turbineCount }, (_, i) => i + 1); // T-01 to T-X

  // Map snapshot data for quick lookup: turbineNo -> parameterId -> value
  const dataMap: Record<number, Record<string, any>> = {};
  columns.forEach(no => {
    dataMap[no] = {};
  });

  snapshots.forEach(snap => {
    const tNo = snap.turbineNo;
    if (columns.includes(tNo) && snap.parameters) {
      dataMap[tNo] = snap.parameters;
    }
  });

  // Build matrix rows
  const rowsHtml = parametersToAudit.map(paramId => {
    // Collect formatted values across all columns for this parameter to find the majority
    const values: string[] = [];
    columns.forEach(no => {
      const val = dataMap[no][paramId];
      if (val !== undefined && val !== null) {
        values.push(formatParameterValue(val));
      }
    });

    // Determine majority value (except for parameter 2000)
    let majorityValue: string | null = null;
    if (paramId !== '2000' && values.length > 0) {
      const counts: Record<string, number> = {};
      values.forEach(v => {
        counts[v] = (counts[v] || 0) + 1;
      });

      let maxCount = 0;
      Object.keys(counts).forEach(v => {
        if (counts[v] > maxCount) {
          maxCount = counts[v];
          majorityValue = v;
        }
      });
    }

    // Render cells for T-01..T-X
    const cellsHtml = columns.map(no => {
      const val = dataMap[no][paramId];
      const valStr = formatParameterValue(val);
      
      let cellStyle = 'padding: 10px 8px; text-align: center; font-weight: bold; border-left: 1px solid rgba(255,255,255,0.02); min-width: 60px;';
      let titleAttr = '';

      if (paramId !== '2000' && val !== undefined && val !== null && majorityValue !== null) {
        if (valStr !== majorityValue) {
          // Highlight deviation in RED
          cellStyle += ' background: rgba(239, 68, 68, 0.2); color: var(--accent-red); border: 1px solid rgba(239, 68, 68, 0.4);';
          titleAttr = `title="Uyuşmazlık! Çoğunluk değeri: ${majorityValue}"`;
        } else {
          cellStyle += ' color: var(--accent-green);';
        }
      } else if (paramId === '2000') {
        cellStyle += ' color: var(--accent-cyan);'; // Sea level height is location dependent
      } else {
        cellStyle += ' color: var(--text-muted);';
      }

      return `<td style="${cellStyle}" ${titleAttr}>${valStr}</td>`;
    }).join('');

    const desc = (parameterDefs as Record<string, string>)[paramId] || '-';

    return `
      <tr class="param-row" data-param-id="${paramId}" data-desc="${desc.toLowerCase()}" style="border-bottom: 1px solid rgba(255,255,255,0.03); hover: background: rgba(255,255,255,0.01);">
        <td style="padding: 10px 8px; font-weight: bold; color: var(--accent-cyan); font-family: monospace;">${paramId}</td>
        <td style="padding: 10px 8px; color: var(--text-muted); font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 250px;" title="${desc}">${desc}</td>
        ${cellsHtml}
      </tr>
    `;
  }).join('');

  const selectedSiteName = sites.find(s => s.id === selectedSiteId)?.name || '';

  // Register Instant Search filtering function
  (window as any).filterParameterMatrix = (queryVal: string) => {
    const q = queryVal.trim().toLowerCase();
    const rows = document.querySelectorAll('.param-row');
    rows.forEach(row => {
      const paramId = row.getAttribute('data-param-id') || '';
      const desc = row.getAttribute('data-desc') || '';
      if (paramId.includes(q) || desc.includes(q)) {
        (row as HTMLElement).style.display = '';
      } else {
        (row as HTMLElement).style.display = 'none';
      }
    });
  };

  // Register Excel export function (using xlsx-js-style for native formatting)
  (window as any).exportParameterMatrixToExcel = () => {
    // 1. Prepare data rows
    const headerRow = ["Parametre ID", "Açıklama", ...columns.map(no => `T-${String(no).padStart(2, '0')}`)];
    const dataRows = parametersToAudit.map(paramId => {
      const desc = (parameterDefs as Record<string, string>)[paramId] || '-';
      
      const turbineValues = columns.map(no => {
        const val = dataMap[no][paramId];
        return formatParameterValue(val);
      });

      return [paramId, desc, ...turbineValues];
    });

    const aoa = [
      [`DEMİRER HOLDİNG — ${selectedSiteName} Parametre Matrisi`],
      ["Oluşturulma Tarihi:", new Date().toLocaleString('tr-TR')],
      [],
      headerRow,
      ...dataRows
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Set column widths
    const cols = [{ wch: 15 }, { wch: 45 }];
    columns.forEach(() => {
      cols.push({ wch: 10 });
    });
    ws['!cols'] = cols;

    // Apply styles
    // Row 1 Title (Merge A1 to last column)
    const lastColIndex = 1 + columns.length;
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIndex } }
    ];
    
    if (ws['A1']) {
      ws['A1'].s = {
        font: { name: "Arial", size: 16, bold: true, color: { rgb: "1F4E78" } },
        alignment: { vertical: "center" }
      };
    }

    // Style date row
    if (ws['A2']) ws['A2'].s = { font: { italic: true, color: { rgb: "555555" }, name: "Arial", size: 10 } };
    if (ws['B2']) ws['B2'].s = { font: { italic: true, color: { rgb: "555555" }, name: "Arial", size: 10 } };

    // Row 4 Headers (Row index 3)
    for (let c = 0; c <= lastColIndex; c++) {
      const ref = XLSX.utils.encode_cell({ r: 3, c });
      if (ws[ref]) {
        ws[ref].s = {
          fill: { fgColor: { rgb: "1F4E78" } },
          font: { color: { rgb: "FFFFFF" }, bold: true, name: "Arial", size: 10 },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "medium", color: { rgb: "111111" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } }
          }
        };
      }
    }

    // Body rows (Row index 4 onwards)
    parametersToAudit.forEach((paramId, rOffset) => {
      const r = 4 + rOffset;

      // Find majority value for this row
      const values: string[] = [];
      columns.forEach(no => {
        const val = dataMap[no][paramId];
        if (val !== undefined && val !== null) {
          values.push(formatParameterValue(val));
        }
      });

      let majorityValue: string | null = null;
      if (paramId !== '2000' && values.length > 0) {
        const counts: Record<string, number> = {};
        values.forEach(v => {
          counts[v] = (counts[v] || 0) + 1;
        });

        let maxCount = 0;
        Object.keys(counts).forEach(v => {
          if (counts[v] > maxCount) {
            maxCount = counts[v];
            majorityValue = v;
          }
        });
      }

      // Column 0: Param ID
      const cellRefId = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[cellRefId]) {
        ws[cellRefId].s = {
          font: { bold: true, color: { rgb: "1F4E78" }, name: "Courier New" },
          border: {
            bottom: { style: "thin", color: { rgb: "E8E8E8" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } }
          }
        };
      }

      // Column 1: Desc
      const cellRefDesc = XLSX.utils.encode_cell({ r, c: 1 });
      if (ws[cellRefDesc]) {
        ws[cellRefDesc].s = {
          font: { name: "Arial", size: 9 },
          border: {
            bottom: { style: "thin", color: { rgb: "E8E8E8" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } }
          }
        };
      }

      // Columns 2..N: Turbine values
      columns.forEach((no, cOffset) => {
        const c = 2 + cOffset;
        const ref = XLSX.utils.encode_cell({ r, c });
        if (ws[ref]) {
          const val = dataMap[no][paramId];
          const valStr = formatParameterValue(val);
          
          let cellStyle: any = {
            font: { name: "Arial", size: 10, bold: true },
            alignment: { horizontal: "center" },
            border: {
              bottom: { style: "thin", color: { rgb: "E8E8E8" } },
              right: { style: "thin", color: { rgb: "CCCCCC" } }
            }
          };

          if (paramId !== '2000' && val !== undefined && val !== null && majorityValue !== null) {
            if (valStr !== majorityValue) {
              // light red fill, dark red text
              cellStyle.fill = { fgColor: { rgb: "FFC7CE" } };
              cellStyle.font.color = { rgb: "9C0006" };
            } else {
              // light green fill, dark green text
              cellStyle.fill = { fgColor: { rgb: "C6EFCE" } };
              cellStyle.font.color = { rgb: "006100" };
            }
          } else if (paramId === '2000' && val !== undefined && val !== null) {
            cellStyle.font.color = { rgb: "0070C0" }; // blue
          } else {
            cellStyle.font.color = { rgb: "7F7F7F" }; // gray
          }

          ws[ref].s = cellStyle;
          // Force string cell type to prevent Excel date auto-conversions (e.g. 4.95 -> Nis.95)
          ws[ref].t = 's';
          ws[ref].v = valStr;
        }
      });
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Parametre Denetimi");
    
    // Save workbook
    XLSX.writeFile(wb, `${selectedSiteName.replace(/\s+/g, '_')}_Parametre_Denetim_Matrisi.xlsx`);
  };

  // Register dynamic scan function
  (window as any).triggerParameterAudit = async () => {
    const btn = document.getElementById('btn-start-audit') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> TARANIYOR...`;
    }

    try {
      const docRef = await addDoc(collection(db, 'parameterAuditRequests'), {
        siteId: selectedSiteId,
        parameters: parametersToAudit,
        turbines: columns, 
        status: 'pending',
        requestedAt: new Date().toISOString()
      });

      // Listen for snapshot change
      const unsubscribe = onSnapshot(doc(db, 'parameterAuditRequests', docRef.id), (snap) => {
        if (snap.exists()) {
          const status = snap.get('status');
          if (status === 'success') {
            unsubscribe();
            (window as any).showToast('Başarılı', 'Tüm sahanın parametre denetimi başarıyla tamamlandı.', 'success');
            (window as any).navigate('parameter-audit');
          } else if (status === 'failed') {
            unsubscribe();
            (window as any).showToast('Hata', 'Denetim başarısız: ' + snap.get('error'), 'error');
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> TARAMAYI TETİKLE`;
            }
          }
        }
      });
    } catch (err) {
      console.error(err);
      (window as any).showToast('Hata', 'İstek gönderilemedi: ' + err, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-magnifying-glass"></i> TARAMAYI TETİKLE`;
      }
    }
  };

  (window as any).changeAuditSite = (siteId: string) => {
    (window as any).selectedAuditSiteId = siteId;
    (window as any).navigate('parameter-audit');
  };

  return `
    <div class="fade-in-up content-area">
      
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(0, 243, 255, 0.15); padding-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 class="page-title" style="margin: 0 0 0.15rem 0; font-size: 1.3rem; display: flex; align-items: center;">
            <i class="fa-solid fa-magnifying-glass-chart" style="color: var(--accent-cyan); margin-right: 8px; font-size: 1.2rem;"></i> Türbin Parametre Denetimi
          </h1>
          <p style="margin: 0; font-size: 0.7rem; color: var(--text-muted);">
            Sahanın parametre sapmalarını ve yazılımsal uyuşmazlıkları tespit edin. (OPC'den ${parametersToAudit.length} parametre sorgulanır)
          </p>
        </div>

        <!-- Filters & Actions (Perfectly aligned & compact) -->
        <div style="display: flex; gap: 8px; align-items: center; justify-content: flex-end; flex-wrap: nowrap;">
          <input type="text" id="param-search-input" class="cyber-input" placeholder="🔍 Parametre No veya Açıklama..." oninput="window.filterParameterMatrix(this.value)" style="height: 32px; width: 200px; padding: 0 10px; background: rgba(10, 14, 23, 0.8); color: #fff; border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 4px; font-family: 'Rajdhani', sans-serif; font-weight: bold; font-size: 0.75rem;" />
          
          <select class="cyber-input" style="height: 32px; width: 140px; padding: 0 8px; font-size: 0.75rem;" onchange="window.changeAuditSite(this.value)">
            ${sites.map(s => `<option value="${s.id}" ${s.id === selectedSiteId ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
          
          <button id="btn-export-excel" class="btn-cyber" onclick="window.exportParameterMatrixToExcel()" style="background: rgba(16, 124, 65, 0.12); border-color: rgba(16, 124, 65, 0.3); color: #21a366; font-weight: bold; height: 32px; font-size: 0.7rem; padding: 0 10px; display: inline-flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-file-excel" style="font-size: 0.75rem;"></i> EXCEL RAPORU
          </button>
          
          <button id="btn-start-audit" class="btn-cyber" onclick="window.triggerParameterAudit()" style="background: rgba(0, 243, 255, 0.08); border-color: rgba(0, 243, 255, 0.25); color: var(--accent-cyan); font-weight: bold; height: 32px; font-size: 0.7rem; padding: 0 10px; display: inline-flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-magnifying-glass" style="font-size: 0.75rem;"></i> TARAMAYI TETİKLE
          </button>
        </div>
      </div>

      <!-- Matrix Card -->
      <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow-x: auto; box-shadow: 0 0 20px rgba(0,0,0,0.4); max-height: 75vh; overflow-y: auto;">
        <h4 style="margin: 0 0 1.25rem 0; font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; color: #fff; font-weight: 800; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-table-cells-large" style="color: var(--accent-cyan);"></i>
          ${selectedSiteName} Parametre Matrisi (T-01 - T-${String(turbineCount).padStart(2, '0')})
        </h4>

        <table class="cyber-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.82rem;">
          <thead style="position: sticky; top: 0; background: #0A0E17; z-index: 10;">
            <tr style="border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--text-muted); font-weight: bold; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
              <th style="padding: 12px 10px; width: 100px; background: #0A0E17;">Parametre ID</th>
              <th style="padding: 12px 10px; width: 250px; background: #0A0E17;">Açıklama</th>
              ${columns.map(no => `<th style="padding: 12px 10px; text-align: center; background: #0A0E17; border-left: 1px solid rgba(255,255,255,0.05); min-width: 60px;">T-${String(no).padStart(2, '0')}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Warning Card Info -->
      <div style="margin-top: 1.5rem; display: flex; gap: 12px; align-items: flex-start; padding: 12px 16px; border: 1px dashed rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05); border-radius: 8px; color: var(--accent-red); font-size: 0.8rem;">
        <i class="fa-solid fa-circle-info" style="font-size: 1rem; margin-top: 2px;"></i>
        <div>
          <strong>Nasıl Yorumlanır?</strong>
          <ul style="margin: 4px 0 0 0; padding-left: 16px; line-height: 1.4;">
            <li>Kırmızıyla vurgulanan değerler, o parametre satırında diğer türbinlerin çoğunluğundan farklı olan ayarları göstermektedir.</li>
            <li>Deniz Seviyesinden Yükseklik (2000) parametresi coğrafi konuma göre değiştiği için sapma kuralına tabi değildir.</li>
          </ul>
        </div>
      </div>

    </div>
  `;
};
