var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/components/ReportTemplate.ts
var ReportTemplate_exports = {};
__export(ReportTemplate_exports, {
  renderReportPDF: () => renderReportPDF
});
module.exports = __toCommonJS(ReportTemplate_exports);

// src/utils/formatters.ts
var formatTeamName = (teamStr) => {
  if (!teamStr) return "S\u0130STEM";
  const clean = teamStr.toLowerCase().trim();
  const match = clean.match(/tm(\d+)|team\s*(\d+)/i);
  if (match) {
    const num = parseInt(match[1] || match[2]);
    return `TEAM ${num}`;
  }
  const directNum = parseInt(clean);
  if (!isNaN(directNum) && directNum > 0 && directNum <= 100) {
    return `TEAM ${directNum}`;
  }
  return teamStr.toUpperCase();
};

// src/utils/DateTimeUtils.ts
var TURKISH_HOLIDAYS_2026 = [
  "2026-01-01",
  // Yılbaşı
  "2026-03-19",
  // Ramazan Bayramı Arifesi (Yarım)
  "2026-03-20",
  "2026-03-21",
  "2026-03-22",
  // Ramazan Bayramı
  "2026-04-23",
  // Ulusal Egemenlik
  "2026-05-01",
  // Emek ve Dayanışma
  "2026-05-19",
  // Gençlik ve Spor
  "2026-05-26",
  // Kurban Bayramı Arifesi (Yarım)
  "2026-05-27",
  "2026-05-28",
  "2026-05-29",
  "2026-05-30",
  // Kurban Bayramı
  "2026-07-15",
  // Demokrasi ve Milli Birlik
  "2026-08-30",
  // Zafer Bayramı
  "2026-10-28",
  // Cumhuriyet Bayramı Arifesi (Yarım)
  "2026-10-29"
  // Cumhuriyet Bayramı
];
var HALF_DAY_HOLIDAYS_2026 = ["2026-03-19", "2026-05-26", "2026-10-28"];
var isPublicHoliday = (date) => TURKISH_HOLIDAYS_2026.includes(date);
var isSunday = (date) => new Date(date).getDay() === 0;
var calculateOvertimeHours = (date, start, end, isOffDay) => {
  if (!start || !end) return 0;
  const isHoliday = isPublicHoliday(date) || isSunday(date) || isOffDay;
  const isHalfDay = HALF_DAY_HOLIDAYS_2026.includes(date);
  const [h1, m1] = start.split(":").map(Number);
  const [h2, m2] = end.split(":").map(Number);
  let startMinutes = h1 * 60 + m1;
  let endMinutes = h2 * 60 + m2;
  if (endMinutes < startMinutes) endMinutes += 1440;
  const totalMinutes = endMinutes - startMinutes;
  if (isHoliday && !isHalfDay) {
    return totalMinutes / 60;
  }
  const normalStart = 8 * 60;
  const normalEnd = isHalfDay ? 13 * 60 : 18 * 60;
  const intersectionStart = Math.max(startMinutes, normalStart);
  const intersectionEnd = Math.min(endMinutes, normalEnd);
  let normalMinutes = 0;
  if (intersectionEnd > intersectionStart) {
    normalMinutes = intersectionEnd - intersectionStart;
  }
  const overtimeMinutes = Math.max(0, totalMinutes - normalMinutes);
  return overtimeMinutes / 60;
};

// src/components/ReportTemplate.ts
function calculateManHours(workSessions, dateStr) {
  let firstStart = null;
  let lastEnd = null;
  let totalRoadHours = 0;
  let totalNormalManHours = 0;
  let totalOvertimeManHours = 0;
  let totalManHours = 0;
  (workSessions || []).forEach((ws) => {
    if (!ws.startTime || !ws.endTime) return;
    const [sh, sm] = ws.startTime.split(":").map(Number);
    let [eh, em] = ws.endTime.split(":").map(Number);
    let durationH = eh + em / 60 - (sh + sm / 60);
    if (durationH < 0) durationH += 24;
    const personnelCount = ws.personnel?.length || 0;
    const sDate = ws.date || dateStr || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    if (ws.type === "\xC7ALI\u015EMA" || ws.type === "WORK" || ws.type === "BEKLEME") {
      const startDt = /* @__PURE__ */ new Date(`${sDate}T${ws.startTime}:00`);
      let endDt = /* @__PURE__ */ new Date(`${sDate}T${ws.endTime}:00`);
      if (!isNaN(startDt.getTime()) && !isNaN(endDt.getTime())) {
        if (endDt.getTime() < startDt.getTime()) {
          endDt = new Date(endDt.getTime() + 24 * 60 * 60 * 1e3);
        }
        if (!firstStart || startDt < firstStart) {
          firstStart = startDt;
        }
        if (!lastEnd || endDt > lastEnd) {
          lastEnd = endDt;
        }
      }
    }
    if (ws.type === "EVDEN T\xDCRB\u0130NE" || ws.type === "T\xDCRB\u0130NDEN EVE" || ws.type === "G\u0130D\u0130\u015E YOLU" || ws.type === "D\xD6N\xDC\u015E YOLU" || ws.type === "TRAVEL" || ws.type === "YOL") {
      totalRoadHours += durationH;
    }
    const ot = calculateOvertimeHours(
      sDate,
      ws.startTime,
      ws.endTime,
      ws.isOffDay || false
    );
    const overtimeH = Math.min(durationH, ot);
    const normalH = Math.max(0, durationH - overtimeH);
    totalNormalManHours += normalH * personnelCount;
    totalOvertimeManHours += overtimeH * personnelCount;
    totalManHours += durationH * personnelCount;
  });
  let totalTurbineHours = 0;
  if (firstStart && lastEnd) {
    totalTurbineHours = (lastEnd.getTime() - firstStart.getTime()) / (1e3 * 60 * 60);
  }
  return {
    turbine: `${totalTurbineHours.toFixed(2)} SAAT`,
    travel: `${totalRoadHours.toFixed(2)} SAAT`,
    normal: `${totalNormalManHours.toFixed(2)} SAAT`,
    overtime: `${totalOvertimeManHours.toFixed(2)} SAAT`,
    total: `${totalManHours.toFixed(2)} SAAT`
  };
}
var renderReportPDF = (report) => {
  const sessions = report.workSessions || [];
  const manHours = calculateManHours(sessions, report.date);
  const checklist = report.checklist || [];
  const hasChecklist = checklist.length > 0;
  const okCount = checklist.filter((i) => i.status === "OK").length;
  const notOkCount = checklist.filter((i) => i.status === "NOT_OK").length;
  const naCount = checklist.filter((i) => i.status === "NA").length;
  const totalChecklist = checklist.length;
  const isMaintenance = report.type !== "ARIZA" || hasChecklist;
  const reportTitle = isMaintenance ? `${report.templateName || "BAKIM RAPORU"}` : "ARIZA RAPORU";
  let checklistHtml = "";
  if (hasChecklist) {
    const renderRow = (item, idx) => {
      const isOk = item.status === "OK";
      const isNa = item.status === "NA";
      const statusLabel = isOk ? "TAMAMLANDI" : isNa ? "OPS\u0130YON DI\u015EI" : "TAMAMLANMADI";
      const statusColor = isOk ? "#16a34a" : isNa ? "#666666" : "#dc2626";
      const statusBg = isOk ? "#e6f9e8" : isNa ? "#f5f5f5" : "#fef2f2";
      const rowBg = idx % 2 === 0 ? "#ffffff" : "#fcfcfc";
      let advHtml = "";
      if (item.measurementConfig && item.measurementConfig.type !== "standard" && item.measurementValues && item.measurementValues.length > 0) {
        const type = item.measurementConfig?.type;
        const vals = item.measurementValues;
        let details = "";
        if (type === "torque_control") details = `<strong>De\u011Fer:</strong> ${vals[0] || "-"} | <strong>\u0130mza:</strong> ${vals[1] || "-"}`;
        else if (type === "oil_sample") details = `<strong>Numune Al\u0131nd\u0131:</strong> ${vals[0] === "true" ? "Evet" : "Hay\u0131r"} | <strong>Miktar:</strong> ${vals[1] || "-"} | <strong>\u0130mza:</strong> ${vals[2] || "-"}`;
        else if (type === "oil_level_control") details = `<strong>Seviye:</strong> ${vals[0] || "-"} | <strong>Eklenen:</strong> ${vals[1] || "-"} | <strong>\u0130mza:</strong> ${vals[2] || "-"}`;
        else if (type === "filter_change") details = `<strong>De\u011Fi\u015Fti:</strong> ${vals[0] === "true" ? "Evet" : "Hay\u0131r"} | <strong>Temizlendi:</strong> ${vals[1] === "true" ? "Evet" : "Hay\u0131r"} | <strong>\u0130mza:</strong> ${vals[2] || "-"}`;
        else if (type === "signature_approval") details = `<strong>\u0130mza/Onay:</strong> ${vals[0] || "-"}`;
        else if (type === "crane_control") details = `<strong>Vin\xE7 Tipi:</strong> ${vals[0] || "-"} | <strong>Halat \xC7ap\u0131:</strong> ${vals[1] || "-"} mm | <strong>Kopuk:</strong> (30:${vals[2] || "0"}, 60:${vals[3] || "0"}, 300:${vals[4] || "0"}) | <strong>\u0130mza:</strong> ${vals[5] || "-"}`;
        else if (type === "safety_equipment_control") details = `<strong>Son Kontrol (Ay/Y\u0131l):</strong> ${vals[0] || "-"} | <strong>Eksiksiz/Hasars\u0131z:</strong> ${vals[1] === "true" ? "Evet" : "Hay\u0131r"} | <strong>\u0130mza:</strong> ${vals[2] || "-"}`;
        else if (type === "bearing_control") details = `<strong>Numune Al\u0131nd\u0131:</strong> ${vals[0] === "true" ? "Evet" : "Hay\u0131r"} | <strong>\xD6N Gres:</strong> ${vals[1] || "-"} | <strong>ARKA Gres:</strong> ${vals[2] || "-"} | <strong>\u0130mza:</strong> ${vals[3] || "-"}`;
        else if (type === "final_checkout_control") {
          details = `
                <div style="font-weight: 700; margin-bottom: 2px;">Bak\u0131m Sonu Final Kontrol\xFC:</div>
                <div style="margin-left: 8px;">
                    <div>${vals[0] === "true" ? "\u2611" : "\u2610"} T\xFCrbin i\xE7inde, kulede veya \xE7evresinde hi\xE7bir el aleti, malzeme, at\u0131k bez veya \xE7\xF6p b\u0131rak\u0131lmam\u0131\u015Ft\u0131r.</div>
                    <div>${vals[1] === "true" ? "\u2611" : "\u2610"} Tespit edilen t\xFCm hasarlar, ar\u0131zalar ve eksiklikler servis raporuna eksiksiz olarak i\u015Flenmi\u015Ftir.</div>
                    <div>${vals[2] === "true" ? "\u2611" : "\u2610"} Makine dairesinde ve kule taban\u0131ndaki t\xFCm elektrik panolar\u0131/kapaklar\u0131 g\xFCvenli bir \u015Fekilde kapat\u0131lm\u0131\u015Ft\u0131r.</div>
                    <div>${vals[3] === "true" ? "\u2611" : "\u2610"} T\xFCrbin \xE7al\u0131\u015Ft\u0131r\u0131l\u0131p dinleme testi yap\u0131lm\u0131\u015F olup ola\u011Fand\u0131\u015F\u0131 bir ses veya titre\u015Fim olmadan tamamlanm\u0131\u015Ft\u0131r.</div>
                    <div>${vals[4] === "true" ? "\u2611" : "\u2610"} T\xFCrbin devreye al\u0131nm\u0131\u015Ft\u0131r ve t\xFCrbin defterine ilgili bak\u0131m talimat\u0131 ve a\xE7\u0131klamalar yaz\u0131lm\u0131\u015Ft\u0131r.</div>
                </div>
                <div style="margin-top: 4px;"><strong>Sorumlu \u0130mza:</strong> ${vals[5] || "-"}</div>
            `;
        } else if (type === "numeric_multiple") {
          const labels = item.measurementConfig.measurementLabels || [];
          details = vals.map((v, i) => {
            if (item.measurementConfig.requireSignature && i === vals.length - 1 && vals.length > item.measurementConfig.inputCount) return `<strong>\u0130mza:</strong> ${v || "-"}`;
            return `<strong>${labels[i] || "\xD6l\xE7\xFCm " + (i + 1)}:</strong> ${v || "-"}`;
          }).join(" | ");
        } else if (type === "version_control") {
          const items = item.measurementConfig.versionItems || [];
          details = vals.map((v, i) => `<strong>${items[i]?.label || "Kart " + (i + 1)}:</strong> ${v || "-"}`).join("<br>");
        } else if (type === "dropdown") {
          details = `<strong>Se\xE7im:</strong> ${vals[0] || "-"}`;
        }
        if (details) advHtml = `<div style="margin-top: 4px; padding: 4px 6px; background: rgba(0,85,170,0.06); border: 1px solid rgba(0,85,170,0.1); border-radius: 4px; font-size: 0.96rem; color: #004488;">${details}</div>`;
      }
      return `
        <tr style="background: ${rowBg}; page-break-inside: avoid;">
          <td style="border: 1px solid #bbb; padding: 3px; text-align: center; font-weight: 700; color: #555;">${(idx + 1).toString().padStart(2, "0")}</td>
          <td style="border: 1px solid #bbb; padding: 3px 6px; font-weight: ${item.status === "NOT_OK" ? "700" : "400"};${item.status === "NOT_OK" ? " color: #b91c1c;" : ""}">
            ${item.text}
            ${advHtml}
          </td>
          <td style="border: 1px solid #bbb; padding: 3px; text-align: center;">
            <span style="background: ${statusBg}; color: ${statusColor}; padding: 1px 6px; border-radius: 3px; font-weight: 800; font-size: 0.96rem; border: 1px solid ${statusColor}33;">${statusLabel}</span>
          </td>
          <td style="border: 1px solid #bbb; padding: 3px 6px; font-size: 1.02rem; color: ${item.status === "NOT_OK" ? "#b91c1c" : "#666"}; font-style: ${item.comment ? "normal" : "italic"};">
            ${item.comment || "-"}
          </td>
        </tr>`;
    };
    checklistHtml += `<div class="html2pdf__page-break"></div>`;
    checklistHtml += `<div style="padding-top: 5px;">`;
    checklistHtml += `
        <div style="page-break-before: always; break-before: page; text-align: center; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 8px;">
        <h1 style="font-size: 1.32rem; margin: 0 0 2px; font-weight: 900; letter-spacing: 1px;">BAKIM KONTROL L\u0130STES\u0130</h1>
        <div style="font-size: 1.02rem; color: #555;">${report.templateName || ""} | Rapor No: <strong>${report.reportNo}</strong> | T\xFCrbin: <strong>${report.turbineNo}</strong> (${report.turbineSerial}) | Saha: <strong>${report.siteName}</strong> | Tarih: <strong>${new Date(report.date).toLocaleDateString("tr-TR")}</strong></div>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 1.08rem;">
        <tr>
          <td style="width: 33.3%; padding: 0 3px 0 0;">
            <div style="background: #e6f9e8; border: 1px solid #22c55e; border-radius: 4px; padding: 4px 8px; text-align: center;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #16a34a; text-transform: uppercase;">Tamamland\u0131: </span>
              <span style="font-size: 1.2rem; font-weight: 900; color: #15803d;">${okCount} / ${totalChecklist}</span>
            </div>
          </td>
          <td style="width: 33.3%; padding: 0 2px;">
            <div style="background: #fef2f2; border: 1px solid #ef4444; border-radius: 4px; padding: 4px 8px; text-align: center;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #dc2626; text-transform: uppercase;">Tamamlanmad\u0131: </span>
              <span style="font-size: 1.2rem; font-weight: 900; color: #b91c1c;">${notOkCount}</span>
            </div>
          </td>
          <td style="width: 33.3%; padding: 0 0 0 3px;">
            <div style="background: #f5f5f5; border: 1px solid #aaa; border-radius: 4px; padding: 4px 8px; text-align: center;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #666; text-transform: uppercase;">Opsiyon D\u0131\u015F\u0131: </span>
              <span style="font-size: 1.2rem; font-weight: 900; color: #555;">${naCount}</span>
            </div>
          </td>
        </tr>
      </table>
      <div style="margin-bottom: 8px;">
        <div style="background: #e8ecf1; padding: 4px 12px; font-weight: 800; font-size: 1.14rem; border: 1px solid #bbb; border-bottom: none;">
          BAKIM DENET\u0130M L\u0130STES\u0130
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 1.08rem;">
          <tr style="background: #f5f7fa;">
            <th style="border: 1px solid #bbb; padding: 4px; width: 30px; font-weight: 700; text-align: center;">NO</th>
            <th style="border: 1px solid #bbb; padding: 4px; text-align: left; font-weight: 700;">KONTROL MADDES\u0130</th>
            <th style="border: 1px solid #bbb; padding: 4px; width: 110px; font-weight: 700; text-align: center;">DURUM</th>
            <th style="border: 1px solid #bbb; padding: 4px; width: 180px; font-weight: 700; text-align: left;">A\xC7IKLAMA</th>
          </tr>`;
    checklist.forEach((item, i) => {
      checklistHtml += renderRow(item, i);
    });
    checklistHtml += `</table></div>`;
    if (notOkCount > 0) {
      checklistHtml += `
        <div style="margin-bottom: 12px; page-break-inside: avoid;">
          <div style="background: #fef2f2; padding: 4px 12px; font-weight: 800; font-size: 1.14rem; border: 1px solid #ef4444; border-bottom: none; color: #b91c1c;">
            \u{1F6A8} ANAL\u0130Z VE BULGULAR (${notOkCount})
          </div>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ef4444; font-size: 1.08rem;">
            <tr style="background: #fef2f2;">
              <th style="border: 1px solid #ef4444; padding: 4px; width: 30px; font-weight: 700; text-align: center;">NO</th>
              <th style="border: 1px solid #ef4444; padding: 4px; text-align: left; font-weight: 700;">Kontrol Maddesi</th>
              <th style="border: 1px solid #ef4444; padding: 4px; text-align: left; font-weight: 700;">Tamamlanamama Nedeni / Ar\u0131za Bulgusu</th>
            </tr>
            ${checklist.filter((item) => item.status === "NOT_OK").map((item) => {
        const originalIndex = checklist.indexOf(item);
        return `
                <tr style="background: #fff; page-break-inside: avoid;">
                  <td style="border: 1px solid #ef4444; padding: 4px; text-align: center; font-weight: 800; color: #b91c1c;">${(originalIndex + 1).toString().padStart(2, "0")}</td>
                  <td style="border: 1px solid #ef4444; padding: 4px; font-weight: 600;">${item.text}</td>
                  <td style="border: 1px solid #ef4444; padding: 4px; color: #b91c1c; font-weight: 500;">${item.comment || "A\xE7\u0131klama girilmemi\u015F"}</td>
                </tr>`;
      }).join("")}
          </table>
        </div>`;
    } else {
      checklistHtml += `
        <div style="background: #e6f9e8; border: 1px solid #22c55e; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 12px; page-break-inside: avoid;">
          <div style="font-size: 1.56rem; margin-bottom: 4px;">\u2705</div>
          <div style="font-weight: 700; color: #15803d; font-size: 1.2rem;">T\xFCm maddeler ba\u015Far\u0131yla tamamland\u0131.</div>
          <div style="font-size: 1.02rem; color: #16a34a;">Olumsuz bir bulguya rastlanmad\u0131.</div>
        </div>`;
    }
    checklistHtml += `</div>`;
  }
  let ohsHtml = "";
  if (report.ohsData) {
    const ohsList = Array.isArray(report.ohsData) ? report.ohsData : report.ohsData?.q1 ? [report.ohsData] : [];
    if (ohsList.length > 0) {
      ohsHtml = ohsList.map((ohs, dayIndex) => {
        const questions = [
          "T\xFCrbinde yapaca\u011F\u0131m bak\u0131m/ar\u0131za \xE7al\u0131\u015Fmas\u0131 \xF6ncesinde kullanmam gereken temel ki\u015Fisel koruyucu donan\u0131mlar\u0131m\u0131 (Baret, \u0130\u015F ayakkab\u0131s\u0131, emniyet kemeri, Lanyard, runner) kontrol ettim.",
          "Bak\u0131m/ar\u0131za \xF6ncesinde yan\u0131mda bulundurmam gereken ilave ekipmanlar\u0131 (G\xF6z du\u015Fu, koruyucu g\xF6zl\xFCk, kulak koruyucu, toz maskesi, tam y\xFCz maske, yang\u0131n s\xF6nd\xFCrme cihaz\u0131, ilkyard\u0131m \xE7antas\u0131, \u201CDikkat bak\u0131m var\u201D levhas\u0131) yan\u0131ma ald\u0131m.",
          "Adam kurtarma seti kullan\u0131ma haz\u0131r \u015Fekilde t\xFCrbine \xE7\u0131kar\u0131lacakt\u0131r.",
          "Bak\u0131m/ar\u0131za \xF6ncesinde Acil duruma y\xF6nelik di\u011Fer ileti\u015Fim ara\xE7lar\u0131 (telsiz) kontrol ettim, yan\u0131ma ald\u0131m.",
          "T\xFCrbinde yapaca\u011F\u0131m faaliyet s\xFCresince, ald\u0131\u011F\u0131m \u0130SG e\u011Fitimleri ve taraf\u0131ma tebli\u011F edilmi\u015F talimatlarda (DH-TA-005, BA_bl_1001 ve di\u011Fer Enercon talimatlar\u0131) bahsedilen konulara azami dikkat g\xF6stererek \xE7al\u0131\u015F\u0131lmas\u0131 konusunda ekip arkada\u015Flar\u0131m\u0131 bilgilendirdim."
        ];
        let itemsHtml = "";
        questions.forEach((q, index) => {
          const i = index + 1;
          const name = ohs[`q${i}Name`] || "";
          const note = ohs[`q${i}Note`] || "";
          itemsHtml += `
            <tr style="background: ${index % 2 === 0 ? "#fff" : "#fafbfd"};">
              <td style="border: 1px solid #bbb; padding: 6px; font-weight: 700; text-align: center; color: #555;">${i}</td>
              <td style="border: 1px solid #bbb; padding: 6px 10px; font-size: 1.08rem;">${q}</td>
              <td style="border: 1px solid #bbb; padding: 6px 10px; font-weight: 700; text-align: center; color: #16a34a;">${name} <br><span style="font-size: 0.75rem; color:#555;">(Onayland\u0131)</span></td>
              <td style="border: 1px solid #bbb; padding: 6px 10px; font-size: 1.08rem; color: #cc0000; font-style: ${note ? "normal" : "italic"};">${note || "-"}</td>
            </tr>
          `;
        });
        let dateStr = ohs.date;
        if (dateStr) {
          const parts = dateStr.split("-");
          if (parts.length === 3) dateStr = `${parts[2]}.${parts[1]}.${parts[0]}`;
        }
        return `
            
            <table class="ohs-table-block" style="page-break-before: always; break-before: page; width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 1.08rem; margin-top: 5px; margin-bottom: 20px;">
              <tr>
                <td colspan="4" style="background: #e8ecf1; padding: 6px 12px; font-weight: 800; font-size: 1.2rem; border: 1px solid #bbb;">${dayIndex + 1}. G\xDCN \u0130SG VE SAHA G\xDCVENL\u0130K ONAYLARI</td>
              </tr>
              <tr>
                <td colspan="4" style="background: #e8ecf1; padding: 0; border: 1px solid #bbb; text-align: right; font-weight: 800; font-size: 1.2rem;">
                  <div style="padding: 0 12px 6px; text-align: right;">${dateStr || ""}</div>
                </td>
              </tr>
              <tr style="background: #f5f7fa;">
                <th style="border: 1px solid #bbb; padding: 6px; width: 30px; font-weight: 700; text-align: center;">NO</th>
                <th style="border: 1px solid #bbb; padding: 6px; font-weight: 700; text-align: left;">\u0130SG KONTROL MADDES\u0130</th>
                <th style="border: 1px solid #bbb; padding: 6px; width: 140px; font-weight: 700; text-align: center;">ONAYLAYAN PERSONEL</th>
                <th style="border: 1px solid #bbb; padding: 6px; width: 160px; font-weight: 700; text-align: left;">EKLENEN NOT / SORUN</th>
              </tr>
              ${itemsHtml}
            </table>
          `;
      }).join("");
    }
  }
  return `
    <div id="pdf-container" style="background: #fff; color: #000; padding: 40px 60px; width: 100%; max-width: none; min-height: 1123px; box-sizing: border-box; margin: 0 auto; font-family: Arial, sans-serif; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); font-size: 1.1rem;">
      
      <!-- CSS Isolation directly injected to guarantee it works even with caching -->
      <style>
        @media print {
          .no-print, button, .btn-cyber, .cyber-button, nav, .menu, #sidebar {
            display: none !important;
          }

          body, html {
            width: 100%;
            margin: 0;
            padding: 0;
          }

          #pdf-container {
            width: 100%;
            margin: 0 auto;
            padding: 0;
          }

          tr, td, th, img, .info-card, .chart-container, .scada-data, .pdf-no-break, .report-section {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          table {
            display: table;
            width: 100%;
            border-collapse: collapse;
          }

          .section-break {
            page-break-before: always;
            break-before: page;
          }
        }

        #pdf-container table { display: table; width: 100%; border-collapse: collapse; }
        #pdf-container table tr { page-break-inside: avoid; break-inside: avoid; }
        #pdf-container table th, #pdf-container table td { word-wrap: break-word; }
        #pdf-container .pdf-no-break { page-break-inside: avoid; break-inside: avoid; }
        #pdf-container .report-section { page-break-inside: avoid; break-inside: avoid; }
      </style>

      <!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->
      <!-- SAYFA 1: GENEL B\u0130LG\u0130LER                    -->
      <!-- \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550 -->

      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 3px solid #002d6b; padding-bottom: 15px;">
        <div style="display: flex; gap: 15px; align-items: center;">
          <div style="flex-shrink: 0;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" style="width: 70px; height: 70px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
              <rect width="120" height="120" fill="#002d6b"/>
              <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="75" fill="#ffffff" letter-spacing="-2">dh</text>
            </svg>
          </div>
          <div>
            <h1 style="font-size: 1.6rem; margin: 0 0 4px; font-weight: 900; letter-spacing: 0.5px; color: #002d6b;">DEM\u0130RER HOLD\u0130NG</h1>
            <div style="font-size: 1.1rem; color: #555; font-weight: 700;">TEKN\u0130K SERV\u0130S ${isMaintenance ? "BAKIM" : "ARIZA"} RAPORU</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.2rem; font-weight: 800; color: #cc0000; margin-bottom: 4px;">Rapor No: ${report.reportNo}</div>
          <div style="font-size: 0.95rem; color: #666; font-weight: 600;">Tarih: ${new Date(report.date).toLocaleDateString("tr-TR")}</div>
          ${report.templateName ? `<div style="font-size: 0.85rem; color: #888; margin-top: 4px; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${report.templateName}</div>` : ""}
        </div>
      </div>

      <!-- SERV\u0130S AYRINTILARI -->
      <div class="report-section" style="margin-bottom: 20px;">
        <div style="background: #e8ecf1; padding: 6px 12px; font-weight: 800; font-size: 1.2rem; border: 1px solid #bbb; border-bottom: none;">
          SERV\u0130S AYRINTILARI
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 0.98rem;">
          <tr>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; width: 15%; background: #f5f7fa; font-weight: 700;">Tarih</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px; width: 35%;">${new Date(report.date).toLocaleDateString("tr-TR")}</td>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; width: 15%; background: #f5f7fa; font-weight: 700;">B\xF6lge / Saha</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px; width: 35%;">${report.siteName}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; background: #f5f7fa; font-weight: 700;">T\xFCrbin Seri No</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px;">${report.turbineSerial}</td>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; background: #f5f7fa; font-weight: 700;">T\xFCrbin No</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px;">${report.turbineNo}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; background: #f5f7fa; font-weight: 700;">Ar\u0131za Kodu</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px; font-weight: 700;">${report.faultCode || "-"}</td>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; background: #f5f7fa; font-weight: 700;">Personel / Ekip</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px; font-weight: 700;">${formatTeamName(report.team)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; background: #f5f7fa; font-weight: 700;">Ar\u0131za Tan\u0131m\u0131</th>
            <td colspan="3" style="border: 1px solid #bbb; padding: 7px 10px; font-size: 1.14rem;">${report.faultDesc || "-"}</td>
          </tr>
        </table>
      </div>

      <!-- \xC7ALI\u015EMA ZAMANLARI -->
      <div class="report-section" style="margin-bottom: 20px;">
        <div style="background: #e8ecf1; padding: 6px 12px; font-weight: 800; font-size: 1.2rem; border: 1px solid #bbb; border-bottom: none;">
          \xC7ALI\u015EMA ZAMANLARI
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 1.14rem; text-align: center;">
          <tr style="background: #f5f7fa;">
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">Kay\u0131t T\xFCr\xFC</th>
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">Personel</th>
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">Tarih</th>
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">Ba\u015Flang\u0131\xE7</th>
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">Biti\u015F</th>
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">S\xFCre</th>
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">A\xE7\u0131klama / Not</th>
          </tr>
          ${sessions && sessions.length > 0 ? sessions.filter((s) => s.startTime && s.endTime).map((session) => {
    const personnelList = Array.isArray(session.personnel) ? session.personnel.join(", ") : session.personnel || "-";
    const typeLabel = session.type === "TRAVEL" || session.type === "YOL" ? "YOL" : "\xC7ALI\u015EMA";
    return `
              <tr>
                <td style="border: 1px solid #bbb; padding: 6px; font-weight: 600;">${typeLabel}</td>
                <td style="border: 1px solid #bbb; padding: 6px;">${personnelList}</td>
                <td style="border: 1px solid #bbb; padding: 6px;">${session.date ? new Date(session.date).toLocaleDateString("tr-TR") : "-"}</td>
                <td style="border: 1px solid #bbb; padding: 6px; font-weight: 600;">${session.startTime || "-"}</td>
                <td style="border: 1px solid #bbb; padding: 6px; font-weight: 600;">${session.endTime || "-"}</td>
                <td style="border: 1px solid #bbb; padding: 6px; font-weight: 700; color: #0055aa;">${session.duration || "-"}</td>
                <td style="border: 1px solid #bbb; padding: 6px; text-align: left; font-size: 1.08rem;">${session.note || session.comment || "-"}</td>
              </tr>
            `;
  }).join("") : `
            <tr><td colspan="7" style="border: 1px solid #bbb; padding: 15px; color: #999;">\xC7al\u0131\u015Fma kayd\u0131 bulunmamaktad\u0131r.</td></tr>
          `}
        </table>

        <!-- Adam-Saat \xD6zeti -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; border-top: none; font-size: 1.14rem; text-align: center;">
          <tr style="background: #eaeff5;">
            <th style="border: 1px solid #bbb; padding: 8px; font-weight: 700;">T\xFCrbin S\xFCresi</th>
            <th style="border: 1px solid #bbb; padding: 8px; font-weight: 700;">Yol S\xFCresi</th>
            <th style="border: 1px solid #bbb; padding: 8px; font-weight: 700;">Normal Adam-Saat</th>
            <th style="border: 1px solid #bbb; padding: 8px; font-weight: 700;">Mesai Adam-Saat</th>
            <th style="border: 1px solid #bbb; padding: 8px; font-weight: 700;">Toplam Adam-Saat</th>
          </tr>
          <tr>
            <td style="border: 1px solid #bbb; padding: 8px; font-weight: 800; color: #0055aa;">${manHours.turbine}</td>
            <td style="border: 1px solid #bbb; padding: 8px; font-weight: 800; color: #0055aa;">${manHours.travel}</td>
            <td style="border: 1px solid #bbb; padding: 8px; font-weight: 800; color: #0055aa;">${manHours.normal}</td>
            <td style="border: 1px solid #bbb; padding: 8px; font-weight: 800; color: #cc6600;">${manHours.overtime}</td>
            <td style="border: 1px solid #bbb; padding: 8px; font-weight: 900; color: #006633;">${manHours.total}</td>
          </tr>
        </table>
      </div>

      <!-- YAPILAN \u0130\u015ELEMLER VE FOTO\u011ERAFLAR -->
      <div class="report-section" style="margin-bottom: 20px;">
        <div style="background: #e8ecf1; padding: 6px 12px; font-weight: 800; font-size: 1.2rem; border: 1px solid #bbb; border-bottom: none;">
          YAPILAN \u0130\u015ELEMLER VE FOTO\u011ERAFLAR
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 0.98rem;">
          <tr>
            <td style="border: 1px solid #bbb; padding: 15px; vertical-align: top; width: 50%; min-height: 100px;">
              <div style="font-weight: 700; font-size: 1.08rem; color: #555; margin-bottom: 6px;">YAPILAN \u0130\u015ELEMLER / NOTLAR</div>
              <div style="white-space: pre-wrap;">${report.notes || '<span style="color: #999;">Not girilmemi\u015Ftir.</span>'}</div>
            </td>
            <td style="border: 1px solid #bbb; padding: 15px; vertical-align: top; width: 50%;">
              <div style="font-weight: 700; font-size: 1.08rem; color: #555; margin-bottom: 6px;">FOTO\u011ERAFLAR</div>
              ${report.imageUrls && report.imageUrls.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                  ${report.imageUrls.map((url) => `
                    <img src="${url}" style="width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" crossorigin="anonymous">
                  `).join("")}
                </div>
              ` : '<span style="color: #999;">Foto\u011Fraf eklenmemi\u015Ftir.</span>'}
            </td>
          </tr>
        </table>
      </div>

      <!-- MALZEME Y\xD6NET\u0130M\u0130 -->
      <div class="report-section" style="margin-bottom: 20px;">
        <div style="background: #e8ecf1; padding: 6px 12px; font-weight: 800; font-size: 1.2rem; border: 1px solid #bbb; border-bottom: none; display: flex; justify-content: space-between; align-items: center;">
          <span>MALZEME Y\xD6NET\u0130M\u0130</span>
          <span style="font-weight: 600; font-size: 1.14rem;">M\xC7F No: <strong style="color: #cc0000;">${report.matFormNo || "-"}</strong></span>
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 1.08rem; text-align: center;">
          <tr style="background: #f5f7fa;">
            <th style="border: 1px solid #bbb; padding: 6px; width: 35px; font-weight: 700;">POZ</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 30px; font-weight: 700;">S/T</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 70px; font-weight: 700;">SAP NO</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 70px; font-weight: 700;">SER\u0130 NO</th>
            <th style="border: 1px solid #bbb; padding: 6px; text-align: left; font-weight: 700;">MALZEME A\xC7IKLAMASI</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 70px; font-weight: 700;">DEPODAN ALINAN</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 60px; font-weight: 700;">DEPOYA \u0130ADE</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 70px; font-weight: 700;">KULLANILAN</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 55px; font-weight: 700;">DEFECT</th>
          </tr>
          ${report.materials && report.materials.length > 0 ? report.materials.map((mat) => `
            <tr>
              <td style="border: 1px solid #bbb; padding: 5px; font-weight: 700;">${mat.poz}</td>
              <td style="border: 1px solid #bbb; padding: 5px; font-weight: 700; color: ${mat.type === "S" ? "#cc0000" : "#006633"};">${mat.type}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.sapNo}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.serialNo || "-"}</td>
              <td style="border: 1px solid #bbb; padding: 5px; text-align: left;">${mat.description}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.received || 0}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.returned || 0}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.used || 0}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.defectCount || 0}</td>
            </tr>
          `).join("") : `
            <tr><td colspan="9" style="border: 1px solid #bbb; padding: 15px; color: #999;">Malzeme kayd\u0131 bulunmamaktad\u0131r.</td></tr>
          `}
        </table>
      </div>

      ${ohsHtml}
      ${checklistHtml}

      <!-- Footer -->
      <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #bbb; display: flex; justify-content: space-between; font-size: 1.02rem; color: #999;">
        <span>DH Servis | Demirer Holding</span>
        <span>Olu\u015Fturulma: ${new Date(report.date).toLocaleDateString("tr-TR")} ${hasChecklist ? "| Sayfa 1-2" : ""}</span>
      </div>

    </div>
  `;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  renderReportPDF
});
