import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, doc, onSnapshot } from 'firebase/firestore';
import { dataService } from '../services/DataService';
import XLSX from 'xlsx-js-style';
import baselineDataRaw from '../data/turbine_baseline_parameters.json';
import missingTurbinesRaw from '../data/missing_turbine_parameters.json';
import parameterDefsJson from './parameter_definitions.json';

interface BaselineDef {
  desc: string;
  unit: string;
}

interface BaselineVal {
  val: string;
  raw: string;
  unit: string;
}

interface BaselineData {
  defs: Record<string, BaselineDef>;
  serials: Record<string, Record<string, BaselineVal>>;
}

interface MissingTurbine {
  siteId: string;
  siteName: string;
  turbineNo: number;
  serial: string;
  type: string;
}

const baselineData = baselineDataRaw as BaselineData;
const missingTurbines = missingTurbinesRaw as MissingTurbine[];
const parameterDefs = parameterDefsJson as Record<string, string>;

export const ParameterAuditPage = async () => {
  const formatParameterValue = (val: any): string => {
    if (val === undefined || val === null || val === '') return '-';
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

  // Default to Anemon İntepe (2688) or previously selected site
  let selectedSiteId = (window as any).selectedAuditSiteId || '2688';
  (window as any).selectedAuditSiteId = selectedSiteId;

  const siteInfo = dataService.getSites().find(s => s.id === selectedSiteId);
  const selectedSiteName = siteInfo?.name || selectedSiteId;

  // Retrieve turbines for selected site
  const siteTurbinesRaw = dataService.getTurbinesBySite(selectedSiteId);
  const turbineCount = siteInfo ? siteInfo.turbineCount : (siteTurbinesRaw.length || 15);

  const turbines = Array.from({ length: turbineCount }, (_, i) => {
    const tNo = i + 1;
    const found = siteTurbinesRaw.find(t => t.no === tNo);
    const serial = found ? String((found as any).serial || found.id || '').trim() : '';
    const hasBaseline = !!(serial && baselineData.serials[serial]);
    const label = `T-${String(tNo).padStart(2, '0')}`;
    const model = found ? String((found as any).type || (found as any).controlType || '') : '';
    return {
      no: tNo,
      serial,
      hasBaseline,
      label,
      model
    };
  });

  const columns = turbines.map(t => t.no);

  // Missing files for this specific site
  const siteMissing = missingTurbines.filter(m => m.siteId === selectedSiteId);

  // Load existing snapshots from Firestore
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

  // Map snapshot data: turbineNo -> parameterId -> value
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

  // Collect EVERY available parameter:
  // 1. From site's baseline files
  // 2. From SCADA snapshots
  // 3. From global baseline defs
  // 4. From parameter_definitions.json
  const allParamIdSet = new Set<string>();

  turbines.forEach(t => {
    if (t.serial && baselineData.serials[t.serial]) {
      Object.keys(baselineData.serials[t.serial]).forEach(pId => allParamIdSet.add(pId));
    }
  });

  snapshots.forEach(snap => {
    if (snap.parameters) {
      Object.keys(snap.parameters).forEach(pId => allParamIdSet.add(pId));
    }
  });

  Object.keys(baselineData.defs).forEach(pId => allParamIdSet.add(pId));
  Object.keys(parameterDefs).forEach(pId => allParamIdSet.add(pId));

  // Sort parameter IDs numerically
  const parametersToAudit = Array.from(allParamIdSet).sort((a, b) => Number(a) - Number(b));

  // Helper to get parameter description & unit
  const getParamInfo = (paramId: string) => {
    const baseDef = baselineData.defs[paramId];
    let desc = baseDef?.desc || parameterDefs[paramId] || `Parameter ${paramId}`;
    let unit = baseDef?.unit || '';

    // If unit is not set, extract from desc like "... [kW]" or "...: s"
    if (!unit) {
      const unitBracket = desc.match(/\[(.*?)\]/);
      if (unitBracket) {
        unit = unitBracket[1];
      } else {
        const unitColon = desc.match(/:\s*([a-zA-Z%°\/]+)$/);
        if (unitColon) unit = unitColon[1];
      }
    }

    return { desc, unit };
  };

  // Compare SCADA against Baseline & collect metrics
  let totalMatches = 0;
  let totalMismatches = 0;
  let totalScadaOnly = 0;
  let totalMissingScada = 0;

  interface DeviationItem {
    siteName: string;
    turbineNo: number;
    turbineLabel: string;
    serial: string;
    paramId: string;
    desc: string;
    unit: string;
    baselineRaw: string;
    scadaVal: string;
  }

  const deviationsList: DeviationItem[] = [];

  // Build matrix rows HTML
  const rowsHtml = parametersToAudit.map(paramId => {
    let rowHasMismatch = false;
    let rowHasScadaOnly = false;
    const { desc, unit } = getParamInfo(paramId);

    const cellsHtml = turbines.map(t => {
      const scadaVal = dataMap[t.no]?.[paramId];
      const hasScada = scadaVal !== undefined && scadaVal !== null && scadaVal !== '';
      const scadaFormatted = formatParameterValue(scadaVal);

      const baselineEntry = t.serial ? baselineData.serials[t.serial]?.[paramId] : undefined;
      const hasBaseline = !!baselineEntry;

      let cellStyle = 'padding: 8px 6px; text-align: center; font-weight: bold; border-left: 1px solid rgba(255,255,255,0.04); min-width: 72px; width: 72px; font-size: 0.76rem; font-family: monospace; box-sizing: border-box;';
      let titleAttr = '';
      let cellContent = scadaFormatted;

      if (!t.hasBaseline) {
        // Entire turbine baseline file is missing from Enercon
        cellStyle += ' color: #eab308; background: rgba(234, 179, 8, 0.04);';
        titleAttr = `title="Sabit Referans Dosyası Eksik (Enercon'dan Bekleniyor) | SCADA: ${scadaFormatted}"`;
        cellContent = `${scadaFormatted} <span style="font-size: 0.6rem; color: #ca8a04;">⚠️</span>`;
      } else if (hasScada && !hasBaseline) {
        // Parameter read from SCADA, but NOT in turbine's baseline CSV file!
        totalScadaOnly++;
        rowHasScadaOnly = true;
        cellStyle += ' color: #38bdf8; background: rgba(56, 189, 248, 0.05);';
        titleAttr = `title="SCADA'da Okundu ✓ (Enercon sabit dosyasında bu parametre yer almıyor) | SCADA: ${scadaFormatted} ${unit}"`;
        cellContent = `<span style="color: #38bdf8;">${scadaFormatted}</span>`;
      } else if (!hasScada) {
        // Not read from SCADA
        totalMissingScada++;
        cellStyle += ' color: #64748b;';
        titleAttr = `title="SCADA Verisi Henüz Okunmadı | Sabit: ${baselineEntry ? baselineEntry.raw : '-'} ${unit}"`;
      } else if (baselineEntry) {
        // Both SCADA and Baseline exist -> compare!
        const normBase = baselineEntry.val;
        const numBase = Number(normBase);
        const numScada = Number(scadaVal);

        let isMatch = false;
        if (!isNaN(numBase) && !isNaN(numScada)) {
          isMatch = Math.abs(numBase - numScada) < 0.001;
        } else {
          isMatch = String(scadaVal).trim().toLowerCase() === String(normBase).trim().toLowerCase();
        }

        if (isMatch) {
          totalMatches++;
          cellStyle += ' color: var(--accent-green);';
          titleAttr = `title="Uyumlu ✓ | Sabit: ${baselineEntry.raw} ${baselineEntry.unit || unit} = SCADA: ${scadaFormatted}"`;
        } else {
          // MISMATCH (HATA)
          totalMismatches++;
          rowHasMismatch = true;
          cellStyle += ' background: rgba(239, 68, 68, 0.22); color: #ff4d4f; border: 1px solid rgba(239, 68, 68, 0.5); font-weight: 800;';
          titleAttr = `title="UYUŞMAZLIK / HATA!&#10;Sabit Referans (Doğru): ${baselineEntry.raw} ${baselineEntry.unit || unit}&#10;SCADA Mevcut: ${scadaFormatted}&#10;Sahada Düzeltilmeli!"`;
          cellContent = `<span style="text-decoration: underline;">${scadaFormatted}</span>`;

          deviationsList.push({
            siteName: selectedSiteName,
            turbineNo: t.no,
            turbineLabel: t.label,
            serial: t.serial,
            paramId,
            desc,
            unit: baselineEntry.unit || unit,
            baselineRaw: baselineEntry.raw,
            scadaVal: scadaFormatted
          });
        }
      }

      return `<td style="${cellStyle}" ${titleAttr}>${cellContent}</td>`;
    }).join('');

    const unitTag = unit ? `<span style="color: var(--accent-cyan); margin-left: 4px; font-size: 0.68rem; font-family: monospace;">[${unit}]</span>` : '';

    return `
      <tr class="param-row" data-param-id="${paramId}" data-desc="${desc.toLowerCase()}" data-has-mismatch="${rowHasMismatch}" data-has-scada-only="${rowHasScadaOnly}" style="border-bottom: 1px solid rgba(255,255,255,0.03);">
        <td class="sticky-col-1" style="padding: 8px 10px; font-weight: bold; color: var(--accent-cyan); font-family: monospace; font-size: 0.8rem; position: sticky; left: 0; background: #0c121e; z-index: 6; width: 75px; min-width: 75px; max-width: 75px; box-sizing: border-box; text-align: center;">
          ${paramId}
        </td>
        <td class="sticky-col-2" style="padding: 8px 10px; color: #cbd5e1; font-size: 0.74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 230px; min-width: 230px; max-width: 230px; position: sticky; left: 75px; background: #0c121e; z-index: 6; box-sizing: border-box; border-right: 2px solid rgba(0, 243, 255, 0.25); box-shadow: 4px 0 8px rgba(0,0,0,0.5);" title="${desc} ${unit ? `[${unit}]` : ''}">
          ${desc}${unitTag}
        </td>
        ${cellsHtml}
      </tr>
    `;
  }).join('');

  // Register Instant Search & Filter Function
  (window as any).filterParameterMatrix = (queryVal?: string) => {
    const searchInput = document.getElementById('param-search-input') as HTMLInputElement;
    const q = (queryVal !== undefined ? queryVal : (searchInput ? searchInput.value : '')).trim().toLowerCase();
    const activeFilter = (window as any).auditCurrentFilterMode || 'all'; // 'all', 'mismatch', 'scada-only'

    const rows = document.querySelectorAll('.param-row');
    rows.forEach(row => {
      const paramId = row.getAttribute('data-param-id') || '';
      const desc = row.getAttribute('data-desc') || '';
      const hasMismatch = row.getAttribute('data-has-mismatch') === 'true';
      const hasScadaOnly = row.getAttribute('data-has-scada-only') === 'true';

      const matchesSearch = !q || paramId.includes(q) || desc.includes(q);
      let matchesFilter = true;

      if (activeFilter === 'mismatch') {
        matchesFilter = hasMismatch;
      } else if (activeFilter === 'scada-only') {
        matchesFilter = hasScadaOnly;
      }

      if (matchesSearch && matchesFilter) {
        (row as HTMLElement).style.display = '';
      } else {
        (row as HTMLElement).style.display = 'none';
      }
    });
  };

  // Set filter mode
  (window as any).setAuditFilterMode = (mode: 'all' | 'mismatch' | 'scada-only') => {
    (window as any).auditCurrentFilterMode = mode;

    const btnAll = document.getElementById('btn-filter-all');
    const btnMismatch = document.getElementById('btn-filter-mismatch');
    const btnScadaOnly = document.getElementById('btn-filter-scada-only');

    [btnAll, btnMismatch, btnScadaOnly].forEach(b => {
      if (b) {
        b.style.background = 'rgba(255, 255, 255, 0.05)';
        b.style.borderColor = 'rgba(255, 255, 255, 0.15)';
        b.style.color = 'var(--text-muted)';
      }
    });

    if (mode === 'all' && btnAll) {
      btnAll.style.background = 'rgba(0, 243, 255, 0.15)';
      btnAll.style.borderColor = 'var(--accent-cyan)';
      btnAll.style.color = '#fff';
    } else if (mode === 'mismatch' && btnMismatch) {
      btnMismatch.style.background = 'rgba(239, 68, 68, 0.25)';
      btnMismatch.style.borderColor = '#ff4d4f';
      btnMismatch.style.color = '#ff4d4f';
    } else if (mode === 'scada-only' && btnScadaOnly) {
      btnScadaOnly.style.background = 'rgba(56, 189, 248, 0.2)';
      btnScadaOnly.style.borderColor = '#38bdf8';
      btnScadaOnly.style.color = '#38bdf8';
    }

    (window as any).filterParameterMatrix();
  };

  // Toggle Description Column Sticky Pin
  (window as any).toggleStickyDescription = () => {
    const isUnpinned = (window as any).auditDescUnpinned === true;
    const nextState = !isUnpinned;
    (window as any).auditDescUnpinned = nextState;

    const col2Elements = document.querySelectorAll('.sticky-col-2');
    const labelEl = document.getElementById('sticky-desc-label');

    col2Elements.forEach(el => {
      if (nextState) {
        // Unpinned: scrolls naturally, releasing full horizontal space for turbines
        (el as HTMLElement).style.position = 'static';
        (el as HTMLElement).style.boxShadow = 'none';
        (el as HTMLElement).style.borderRight = '1px solid rgba(255,255,255,0.05)';
      } else {
        // Pinned: stays at left: 75px
        (el as HTMLElement).style.position = 'sticky';
        (el as HTMLElement).style.left = '75px';
        (el as HTMLElement).style.boxShadow = '4px 0 8px rgba(0,0,0,0.5)';
        (el as HTMLElement).style.borderRight = '2px solid rgba(0, 243, 255, 0.25)';
      }
    });

    if (labelEl) {
      labelEl.innerHTML = nextState ? '📌 Tanımı Sabitle' : '🔓 Tanımı Çöz (Tüm Ekranı Aç)';
    }

    // Scroll to left = 0 so T-01 is fully visible
    const tableContainer = document.getElementById('parameter-table-container');
    if (tableContainer) tableContainer.scrollLeft = 0;
  };

  // Register Excel export function (Sheet 1: Saha Düzeltme Listesi, Sheet 2: Parametre Matrisi)
  (window as any).exportParameterMatrixToExcel = () => {
    const wb = XLSX.utils.book_new();

    // ---------------------------------------------------------
    // SHEET 1: SAHA DÜZELTME & AKSİYON LİSTESİ (Hatalı Parametreler)
    // ---------------------------------------------------------
    const actionHeaderRow = [
      "Saha",
      "Türbin No",
      "Seri Numarası",
      "Parametre No",
      "Parametre Açıklaması (EN)",
      "Sabit Referans (Doğru Değer)",
      "SCADA Değeri (Mevcut)",
      "Birim",
      "Saha Aksiyon Durumu"
    ];

    const actionDataRows = deviationsList.map(item => [
      item.siteName,
      item.turbineLabel,
      item.serial,
      item.paramId,
      item.desc,
      item.baselineRaw,
      item.scadaVal,
      item.unit || '-',
      "DÜZELTİLMELİ"
    ]);

    const actionAoa = [
      [`DEMİRER HOLDİNG — ${selectedSiteName.toUpperCase()} SAHA PARAMETRE DÜZELTME LİSTESİ`],
      [`Rapor Tarihi: ${new Date().toLocaleString('tr-TR')} | Toplam Hatalı/Sapan Parametre: ${deviationsList.length} Adet`],
      [`Not: Bu listedeki parametreler SCADA ile Enercon sabit referans dosyası uyuşmayan parametrelerdir. Ekipler sahada türbin parametrelerini kontrol ederek sabit referans değerine güncellemelidir.`],
      [],
      actionHeaderRow,
      ...actionDataRows
    ];

    const wsAction = XLSX.utils.aoa_to_sheet(actionAoa);

    // Column widths for Action sheet
    wsAction['!cols'] = [
      { wch: 18 }, // Saha
      { wch: 12 }, // Türbin No
      { wch: 14 }, // Seri No
      { wch: 14 }, // Parametre No
      { wch: 45 }, // Parametre Açıklaması
      { wch: 22 }, // Sabit Doğru Değer
      { wch: 20 }, // SCADA Mevcut Değer
      { wch: 10 }, // Birim
      { wch: 18 }  // Aksiyon
    ];

    // Merge title row
    wsAction['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 8 } }
    ];

    if (wsAction['A1']) {
      wsAction['A1'].s = {
        font: { name: "Arial", size: 14, bold: true, color: { rgb: "9C0006" } },
        alignment: { vertical: "center" }
      };
    }
    if (wsAction['A2']) wsAction['A2'].s = { font: { italic: true, bold: true, color: { rgb: "333333" }, name: "Arial", size: 10 } };
    if (wsAction['A3']) wsAction['A3'].s = { font: { italic: true, color: { rgb: "666666" }, name: "Arial", size: 9 } };

    // Action Header
    for (let c = 0; c <= 8; c++) {
      const ref = XLSX.utils.encode_cell({ r: 4, c });
      if (wsAction[ref]) {
        wsAction[ref].s = {
          fill: { fgColor: { rgb: "C00000" } },
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

    actionDataRows.forEach((_, rOffset) => {
      const r = 5 + rOffset;
      for (let c = 0; c <= 8; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (wsAction[ref]) {
          const isActionCol = c === 8;
          const isBaseCol = c === 5;
          const isScadaCol = c === 6;

          let cellStyle: any = {
            font: { name: "Arial", size: 9 },
            border: { bottom: { style: "thin", color: { rgb: "E8E8E8" } }, right: { style: "thin", color: { rgb: "E8E8E8" } } },
            alignment: { vertical: "center" }
          };

          if (isActionCol) {
            cellStyle.fill = { fgColor: { rgb: "FFC7CE" } };
            cellStyle.font = { bold: true, color: { rgb: "9C0006" } };
            cellStyle.alignment = { horizontal: "center" };
          } else if (isBaseCol) {
            cellStyle.fill = { fgColor: { rgb: "E2EFDA" } };
            cellStyle.font = { bold: true, color: { rgb: "375623" } };
            cellStyle.alignment = { horizontal: "center" };
          } else if (isScadaCol) {
            cellStyle.fill = { fgColor: { rgb: "FFF2CC" } };
            cellStyle.font = { bold: true, color: { rgb: "C00000" } };
            cellStyle.alignment = { horizontal: "center" };
          } else if (c <= 3) {
            cellStyle.alignment = { horizontal: "center" };
          }

          wsAction[ref].s = cellStyle;
          wsAction[ref].t = 's';
        }
      }
    });

    XLSX.utils.book_append_sheet(wb, wsAction, "Saha Düzeltme Listesi");

    // ---------------------------------------------------------
    // SHEET 2: TÜM PARAMETRE MATRİSİ
    // ---------------------------------------------------------
    const matrixHeaderRow = [
      "Parametre No",
      "Parametre Açıklaması (EN)",
      ...turbines.map(t => `${t.label}${t.serial ? ` (${t.serial})` : ''}`)
    ];

    const matrixDataRows = parametersToAudit.map(paramId => {
      const { desc, unit } = getParamInfo(paramId);
      const turbineValues = turbines.map(t => {
        const scadaVal = dataMap[t.no]?.[paramId];
        return formatParameterValue(scadaVal);
      });
      return [paramId, `${desc}${unit ? ` [${unit}]` : ''}`, ...turbineValues];
    });

    const matrixAoa = [
      [`DEMİRER HOLDİNG — ${selectedSiteName.toUpperCase()} TÜM PARAMETRE DENETİM MATRİSİ`],
      [`Oluşturulma: ${new Date().toLocaleString('tr-TR')} | Toplam ${parametersToAudit.length} Parametre (SCADA & Sabit Referans)`],
      [],
      matrixHeaderRow,
      ...matrixDataRows
    ];

    const wsMatrix = XLSX.utils.aoa_to_sheet(matrixAoa);

    const matrixCols = [{ wch: 14 }, { wch: 45 }];
    turbines.forEach(() => matrixCols.push({ wch: 14 }));
    wsMatrix['!cols'] = matrixCols;

    const lastColIndex = 1 + turbines.length;
    wsMatrix['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIndex } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIndex } }
    ];

    if (wsMatrix['A1']) {
      wsMatrix['A1'].s = {
        font: { name: "Arial", size: 14, bold: true, color: { rgb: "1F4E78" } },
        alignment: { vertical: "center" }
      };
    }

    for (let c = 0; c <= lastColIndex; c++) {
      const ref = XLSX.utils.encode_cell({ r: 3, c });
      if (wsMatrix[ref]) {
        wsMatrix[ref].s = {
          fill: { fgColor: { rgb: "1F4E78" } },
          font: { color: { rgb: "FFFFFF" }, bold: true, name: "Arial", size: 9 },
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

    parametersToAudit.forEach((paramId, rOffset) => {
      const r = 4 + rOffset;

      turbines.forEach((t, cOffset) => {
        const c = 2 + cOffset;
        const ref = XLSX.utils.encode_cell({ r, c });
        if (wsMatrix[ref]) {
          const scadaVal = dataMap[t.no]?.[paramId];
          const hasScada = scadaVal !== undefined && scadaVal !== null && scadaVal !== '';
          const scadaFormatted = formatParameterValue(scadaVal);

          const baselineEntry = t.serial ? baselineData.serials[t.serial]?.[paramId] : undefined;
          const hasBaseline = !!baselineEntry;

          let cellStyle: any = {
            font: { name: "Arial", size: 9 },
            alignment: { horizontal: "center" },
            border: { bottom: { style: "thin", color: { rgb: "E8E8E8" } }, right: { style: "thin", color: { rgb: "E8E8E8" } } }
          };

          if (!t.hasBaseline) {
            cellStyle.fill = { fgColor: { rgb: "FFF2CC" } };
            cellStyle.font.color = { rgb: "7F6000" };
          } else if (hasScada && !hasBaseline) {
            // SCADA only
            cellStyle.fill = { fgColor: { rgb: "D9E1F2" } };
            cellStyle.font.color = { rgb: "2F5597" };
          } else if (hasScada && hasBaseline) {
            const normBase = baselineEntry.val;
            const numBase = Number(normBase);
            const numScada = Number(scadaVal);

            let isMatch = false;
            if (!isNaN(numBase) && !isNaN(numScada)) {
              isMatch = Math.abs(numBase - numScada) < 0.001;
            } else {
              isMatch = String(scadaVal).trim().toLowerCase() === String(normBase).trim().toLowerCase();
            }

            if (isMatch) {
              cellStyle.fill = { fgColor: { rgb: "C6EFCE" } };
              cellStyle.font.color = { rgb: "006100" };
            } else {
              cellStyle.fill = { fgColor: { rgb: "FFC7CE" } };
              cellStyle.font.color = { rgb: "9C0006" };
              cellStyle.font.bold = true;
            }
          }

          wsMatrix[ref].s = cellStyle;
          wsMatrix[ref].t = 's';
          wsMatrix[ref].v = scadaFormatted;
        }
      });
    });

    XLSX.utils.book_append_sheet(wb, wsMatrix, "Tüm Parametre Matrisi");

    const fileName = `${selectedSiteName.replace(/\s+/g, '_')}_Parametre_Denetim_Raporu.xlsx`;
    XLSX.writeFile(wb, fileName);
    (window as any).showToast?.('Başarılı', `${fileName} başarıyla indirildi.`, 'success');
  };

  // Register real-time dynamic scan function via OPC bridge
  (window as any).triggerParameterAudit = async (silent = false) => {
    const btn = document.getElementById('btn-start-audit') as HTMLButtonElement;
    const statusEl = document.getElementById('audit-sync-status');

    if (!silent && btn) {
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> KÖPRÜDEN TARANIYOR...`;
    }
    if (statusEl) {
      statusEl.innerHTML = `<span style="color: var(--accent-cyan); font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-circle-notch fa-spin"></i> SCADA köprüsünden okunuyor...</span>`;
    }

    try {
      const docRef = await addDoc(collection(db, 'parameterAuditRequests'), {
        siteId: selectedSiteId,
        parameters: parametersToAudit,
        turbines: columns,
        status: 'pending',
        requestedAt: new Date().toISOString()
      });

      const unsubscribe = onSnapshot(doc(db, 'parameterAuditRequests', docRef.id), (snap) => {
        if (snap.exists()) {
          const status = snap.get('status');
          if (status === 'success') {
            unsubscribe();
            if (statusEl) {
              statusEl.innerHTML = `<span style="color: var(--accent-green); font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-check"></i> Canlı Güncel</span>`;
            }
            if (!silent) {
              (window as any).showToast?.('Başarılı', `${selectedSiteName} parametreleri köprü üzerinden başarıyla güncellendi.`, 'success');
            }
            setTimeout(() => {
              (window as any).navigate('parameter-audit');
            }, 500);
          } else if (status === 'failed') {
            unsubscribe();
            if (statusEl) {
              statusEl.innerHTML = `<span style="color: var(--accent-red); font-size: 0.72rem;"><i class="fa-solid fa-triangle-exclamation"></i> Tarama Hatası</span>`;
            }
            if (!silent) {
              (window as any).showToast?.('Hata', 'Parametre taraması başarısız: ' + snap.get('error'), 'error');
            }
            if (btn) {
              btn.disabled = false;
              btn.innerHTML = `<i class="fa-solid fa-rotate"></i> CANLI YENİLE`;
            }
          }
        }
      });
    } catch (err) {
      console.error(err);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-rotate"></i> CANLI YENİLE`;
      }
    }
  };

  (window as any).changeAuditSite = (siteId: string) => {
    (window as any).selectedAuditSiteId = siteId;
    (window as any).navigate('parameter-audit');
  };

  (window as any).openMissingFilesModal = () => {
    const modalEl = document.getElementById('missing-files-modal');
    if (modalEl) modalEl.style.display = 'flex';
  };

  (window as any).closeMissingFilesModal = () => {
    const modalEl = document.getElementById('missing-files-modal');
    if (modalEl) modalEl.style.display = 'none';
  };

  (window as any).copyMissingSerialsToClipboard = () => {
    const serialList = missingTurbines.map(m => `${m.siteName} T-${String(m.turbineNo).padStart(2, '0')} (${m.serial} - ${m.type})`).join('\n');
    navigator.clipboard.writeText(serialList).then(() => {
      (window as any).showToast?.('Kopyalandı', 'Eksik türbin seri numaraları panoya kopyalandı. Enercon e-postasına yapıştırabilirsiniz.', 'success');
    }).catch(err => {
      console.error(err);
      (window as any).showToast?.('Hata', 'Panoya kopyalanamadı.', 'error');
    });
  };

  // AUTO-SYNC / AUTOMATIC SCAN TRIGGER:
  // If this site has no snapshot documents at all, automatically trigger a background scan!
  setTimeout(() => {
    // Reset scroll to 0 so T-01 is fully visible!
    const tableContainer = document.getElementById('parameter-table-container');
    if (tableContainer) tableContainer.scrollLeft = 0;

    if (snapshots.length === 0) {
      console.log(`[ParameterAudit] ${selectedSiteName} sahası için veri bulunamadı, köprüden otomatik taranıyor...`);
      (window as any).triggerParameterAudit(true);
    }
  }, 100);

  return `
    <div class="fade-in-up content-area">

      <!-- Header Section -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid rgba(0, 243, 255, 0.15); padding-bottom: 0.75rem; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h1 class="page-title" style="margin: 0 0 0.15rem 0; font-size: 1.2rem; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-sliders" style="color: var(--accent-cyan); font-size: 1.1rem;"></i>
            Türbin Parametre Denetimi &amp; Referans Karşılaştırma
            <span style="background: rgba(0, 243, 255, 0.1); border: 1px solid rgba(0, 243, 255, 0.3); color: var(--accent-cyan); font-size: 0.62rem; padding: 2px 7px; border-radius: 4px; font-weight: 800;">ADMIN</span>
          </h1>
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.7rem; color: var(--text-muted);">
            <span>SCADA ve Enercon sabit referans dosyaları (<code style="color: var(--accent-cyan);">*.csv</code>) birebir karşılaştırması</span>
            <span id="audit-sync-status">
              ${snapshots.length > 0 ? `<span style="color: var(--accent-green); display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-circle-check"></i> ${snapshots.length} Türbin Verisi Hazır</span>` : `<span style="color: #eab308; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-circle-notch fa-spin"></i> Veri Taranıyor...</span>`}
            </span>
          </div>
        </div>

        <!-- Filter & Action Controls -->
        <div style="display: flex; gap: 6px; align-items: center; justify-content: flex-end; flex-wrap: wrap;">
          <input type="text" id="param-search-input" class="cyber-input" placeholder="🔍 Param No veya Tanım..." oninput="window.filterParameterMatrix(this.value)" style="height: 32px; width: 175px; padding: 0 8px; background: rgba(10, 14, 23, 0.85); color: #fff; border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 4px; font-weight: bold; font-size: 0.73rem;" />

          <select class="cyber-input" style="height: 32px; width: 145px; padding: 0 8px; font-size: 0.74rem; font-weight: bold;" onchange="window.changeAuditSite(this.value)">
            ${sites.map(s => `<option value="${s.id}" ${s.id === selectedSiteId ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>

          <button id="btn-export-excel" class="btn-cyber" onclick="window.exportParameterMatrixToExcel()" style="background: rgba(16, 124, 65, 0.15); border-color: rgba(16, 124, 65, 0.4); color: #21a366; font-weight: bold; height: 32px; font-size: 0.7rem; padding: 0 9px; display: inline-flex; align-items: center; gap: 5px;">
            <i class="fa-solid fa-file-excel" style="font-size: 0.75rem;"></i> EXCEL RAPORU
          </button>

          <button id="btn-missing-files" class="btn-cyber" onclick="window.openMissingFilesModal()" style="background: rgba(234, 179, 8, 0.12); border-color: rgba(234, 179, 8, 0.35); color: #eab308; font-weight: bold; height: 32px; font-size: 0.7rem; padding: 0 9px; display: inline-flex; align-items: center; gap: 5px;">
            <i class="fa-solid fa-folder-open" style="font-size: 0.75rem;"></i> EKSİK DOSYALAR (${missingTurbines.length})
          </button>

          <button id="btn-start-audit" class="btn-cyber" onclick="window.triggerParameterAudit(false)" style="background: rgba(0, 243, 255, 0.08); border-color: rgba(0, 243, 255, 0.3); color: var(--accent-cyan); font-weight: bold; height: 32px; font-size: 0.7rem; padding: 0 9px; display: inline-flex; align-items: center; gap: 5px;" title="Köprü üzerinden SCADA parametrelerini tazeleyin">
            <i class="fa-solid fa-rotate" style="font-size: 0.75rem;"></i> CANLI YENİLE
          </button>
        </div>
      </div>

      <!-- Quick Filter Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 8px;">
        <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
          <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: bold; margin-right: 4px;">FİLTRE:</span>
          <button id="btn-filter-all" class="btn-cyber" onclick="window.setAuditFilterMode('all')" style="height: 28px; font-size: 0.68rem; padding: 0 10px; background: rgba(0, 243, 255, 0.15); border: 1px solid var(--accent-cyan); color: #fff; font-weight: bold;">
            Tümü (${parametersToAudit.length})
          </button>
          <button id="btn-filter-mismatch" class="btn-cyber" onclick="window.setAuditFilterMode('mismatch')" style="height: 28px; font-size: 0.68rem; padding: 0 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: var(--text-muted); font-weight: bold;">
            <i class="fa-solid fa-triangle-exclamation" style="color: #ff4d4f;"></i> Hatalı / Uyuşmazlık (${totalMismatches})
          </button>
          <button id="btn-filter-scada-only" class="btn-cyber" onclick="window.setAuditFilterMode('scada-only')" style="height: 28px; font-size: 0.68rem; padding: 0 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: var(--text-muted); font-weight: bold;">
            <i class="fa-solid fa-bolt" style="color: #38bdf8;"></i> Sadece SCADA'da Olanlar (${totalScadaOnly})
          </button>
        </div>

        <div>
          <button id="btn-toggle-sticky-desc" class="btn-cyber" onclick="window.toggleStickyDescription()" style="height: 28px; font-size: 0.68rem; padding: 0 10px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; display: inline-flex; align-items: center; gap: 5px;">
            <i class="fa-solid fa-thumbtack"></i> <span id="sticky-desc-label">🔓 Tanımı Çöz (Tüm Ekranı Aç)</span>
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px; margin-bottom: 0.85rem;">
        <div class="glass-panel" style="padding: 8px 12px; border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 8px;">
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: bold;">TOPLAM PARAMETRE</div>
          <div style="font-size: 1.2rem; font-weight: 800; color: #fff; font-family: monospace;">${parametersToAudit.length} <span style="font-size: 0.68rem; color: var(--accent-cyan); font-weight: normal;">(SCADA + Sabit)</span></div>
        </div>

        <div class="glass-panel" style="padding: 8px 12px; border: 1px solid rgba(0, 255, 102, 0.2); border-radius: 8px; background: rgba(0, 255, 102, 0.03);">
          <div style="font-size: 0.65rem; color: var(--accent-green); font-weight: bold;">UYUMLU DEĞERLER</div>
          <div style="font-size: 1.2rem; font-weight: 800; color: var(--accent-green); font-family: monospace;">${totalMatches}</div>
        </div>

        <div class="glass-panel" style="padding: 8px 12px; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; background: rgba(239, 68, 68, 0.05);">
          <div style="font-size: 0.65rem; color: var(--accent-red); font-weight: bold;">HATA / SAPMA (DÜZELTİLMELİ)</div>
          <div style="font-size: 1.2rem; font-weight: 800; color: #ff4d4f; font-family: monospace;">
            ${totalMismatches}
            ${totalMismatches > 0 ? `<span style="font-size: 0.68rem; color: #ff4d4f; margin-left: 6px; font-weight: bold;"><i class="fa-solid fa-triangle-exclamation"></i> Sahaya Bildir</span>` : ''}
          </div>
        </div>

        <div class="glass-panel" style="padding: 8px 12px; border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px; background: rgba(56, 189, 248, 0.03);">
          <div style="font-size: 0.65rem; color: #38bdf8; font-weight: bold;">SADECE SCADA'DA OKUNAN</div>
          <div style="font-size: 1.2rem; font-weight: 800; color: #38bdf8; font-family: monospace;">${totalScadaOnly}</div>
        </div>

        <div class="glass-panel" style="padding: 8px 12px; border: 1px solid rgba(234, 179, 8, 0.25); border-radius: 8px; background: rgba(234, 179, 8, 0.03);">
          <div style="font-size: 0.65rem; color: #eab308; font-weight: bold;">EKSİK DOSYALI TÜRBİN</div>
          <div style="font-size: 1.2rem; font-weight: 800; color: #eab308; font-family: monospace;">
            ${siteMissing.length} / ${turbines.length}
          </div>
        </div>
      </div>

      <!-- Missing Files Warning Banner if site has missing files -->
      ${siteMissing.length > 0 ? `
        <div style="margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1px dashed rgba(234, 179, 8, 0.4); background: rgba(234, 179, 8, 0.06); border-radius: 8px; color: #fde047; font-size: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 0.95rem; color: #eab308;"></i>
            <span>
              <strong>${selectedSiteName}</strong> sahasında <strong>${siteMissing.length} türbinin</strong> sabit referans dosyası eksik:
              <span style="color: #fff; font-weight: bold; margin-left: 4px;">${siteMissing.map(m => `T-${String(m.turbineNo).padStart(2, '0')} (${m.serial})`).join(', ')}</span>
            </span>
          </div>
          <button class="btn-cyber" onclick="window.openMissingFilesModal()" style="height: 24px; font-size: 0.65rem; padding: 0 8px; background: rgba(234, 179, 8, 0.15); border-color: rgba(234, 179, 8, 0.4); color: #fef08a;">
            Enercon Talep Listesi
          </button>
        </div>
      ` : ''}

      <!-- Parameter Matrix Card -->
      <div id="parameter-table-container" class="glass-panel" style="padding: 0.75rem; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; overflow-x: auto; box-shadow: 0 0 25px rgba(0,0,0,0.5); max-height: 72vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
          <h4 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: #fff; font-weight: 800; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-table-cells-large" style="color: var(--accent-cyan);"></i>
            ${selectedSiteName} Parametre Matrisi (${turbines[0]?.label || 'T-01'} - ${turbines[turbines.length - 1]?.label || ''})
          </h4>
          <div style="display: flex; align-items: center; gap: 10px; font-size: 0.68rem; color: var(--text-muted);">
            <span><span style="display: inline-block; width: 9px; height: 9px; background: rgba(0, 255, 102, 0.3); border: 1px solid var(--accent-green); border-radius: 2px; margin-right: 3px;"></span> Uyumlu</span>
            <span><span style="display: inline-block; width: 9px; height: 9px; background: rgba(239, 68, 68, 0.3); border: 1px solid #ff4d4f; border-radius: 2px; margin-right: 3px;"></span> Uyuşmazlık (Hata)</span>
            <span><span style="display: inline-block; width: 9px; height: 9px; background: rgba(56, 189, 248, 0.2); border: 1px solid #38bdf8; border-radius: 2px; margin-right: 3px;"></span> Sadece SCADA</span>
            <span><span style="display: inline-block; width: 9px; height: 9px; background: rgba(234, 179, 8, 0.25); border: 1px solid #eab308; border-radius: 2px; margin-right: 3px;"></span> Sabit Dosya Eksik</span>
          </div>
        </div>

        <table class="cyber-table" style="width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; font-size: 0.77rem;">
          <thead style="position: sticky; top: 0; background: #0A0E17; z-index: 10;">
            <tr style="border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--text-muted); font-weight: bold; font-family: 'Rajdhani', sans-serif;">
              <th class="sticky-col-1" style="padding: 10px 8px; width: 75px; min-width: 75px; max-width: 75px; background: #0c121e; position: sticky; left: 0; z-index: 12; border-bottom: 2px solid rgba(0, 243, 255, 0.2); box-sizing: border-box; text-align: center;">
                Param No
              </th>
              <th class="sticky-col-2" style="padding: 10px 8px; width: 230px; min-width: 230px; max-width: 230px; background: #0c121e; position: sticky; left: 75px; z-index: 12; border-right: 2px solid rgba(0, 243, 255, 0.25); border-bottom: 2px solid rgba(0, 243, 255, 0.2); box-sizing: border-box; box-shadow: 4px 0 8px rgba(0,0,0,0.5);">
                Parametre Tanımı (EN)
              </th>
              ${turbines.map(t => `
                <th style="padding: 8px 6px; text-align: center; background: #0A0E17; border-left: 1px solid rgba(255,255,255,0.05); min-width: 72px; width: 72px; box-sizing: border-box; border-bottom: 2px solid rgba(255,255,255,0.1);">
                  <div style="font-weight: 800; color: #fff; font-size: 0.8rem; letter-spacing: 0.5px;">${t.label}</div>
                  <div style="font-size: 0.64rem; font-weight: normal; color: ${t.hasBaseline ? 'var(--accent-cyan)' : '#eab308'}; font-family: monospace;">
                    ${t.serial || '-'}
                  </div>
                  ${!t.hasBaseline ? `<div style="font-size: 0.58rem; color: #ca8a04; font-weight: bold;">Eksik</div>` : ''}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Missing Files Modal -->
      <div id="missing-files-modal" style="display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(5px); z-index: 9999; justify-content: center; align-items: center; padding: 1.5rem;">
        <div class="glass-panel" style="background: #0d131f; border: 1px solid rgba(234, 179, 8, 0.4); border-radius: 12px; width: 100%; max-width: 700px; max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.8);">
          <div style="padding: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; font-size: 1.1rem; color: #eab308; font-weight: 800; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-folder-open"></i> Eksik Parametre Dosyaları (${missingTurbines.length} Türbin)
            </h3>
            <button onclick="window.closeMissingFilesModal()" style="background: transparent; border: none; color: var(--text-muted); font-size: 1.2rem; cursor: pointer;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div style="padding: 1.25rem; overflow-y: auto; flex: 1;">
            <p style="margin: 0 0 1rem 0; font-size: 0.8rem; color: #cbd5e1; line-height: 1.5;">
              Aşağıdaki türbinlerin Enercon sabit parametre dosyaları (<code style="color: #eab308;">&lt;seri_no&gt;_bes.csv</code>) henüz sistemde bulunmamaktadır. Bu türbinlerin seri numaralarını Enercon'dan talep edebilir, gelen dosyaları doğrudan <strong>Türbin parametreleri</strong> klasörüne attığınızda sistem otomatik olarak tanıyacaktır.
            </p>

            <table class="cyber-table" style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
              <thead>
                <tr style="border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--text-muted); text-align: left;">
                  <th style="padding: 8px;">Saha</th>
                  <th style="padding: 8px;">Türbin No</th>
                  <th style="padding: 8px;">Seri No</th>
                  <th style="padding: 8px;">Model</th>
                  <th style="padding: 8px; text-align: right;">Durum</th>
                </tr>
              </thead>
              <tbody>
                ${missingTurbines.map(m => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <td style="padding: 8px; font-weight: bold; color: #fff;">${m.siteName}</td>
                    <td style="padding: 8px; font-family: monospace; color: var(--accent-cyan);">T-${String(m.turbineNo).padStart(2, '0')}</td>
                    <td style="padding: 8px; font-family: monospace; font-weight: bold; color: #eab308;">${m.serial}</td>
                    <td style="padding: 8px; color: var(--text-muted);">${m.type}</td>
                    <td style="padding: 8px; text-align: right; color: #ef4444; font-weight: bold; font-size: 0.72rem;">DOSYA EKSİK</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="padding: 1rem 1.25rem; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: flex-end; gap: 10px;">
            <button class="btn-cyber" onclick="window.copyMissingSerialsToClipboard()" style="background: rgba(234, 179, 8, 0.15); border-color: rgba(234, 179, 8, 0.4); color: #fde047; font-weight: bold; padding: 0.5rem 1rem;">
              <i class="fa-solid fa-copy"></i> Seri Numaralarını Kopyala
            </button>
            <button class="btn-cyber" onclick="window.closeMissingFilesModal()" style="padding: 0.5rem 1.2rem;">
              Kapat
            </button>
          </div>
        </div>
      </div>

    </div>
  `;
};
