const fs = require('fs');

async function test() {
  const code = fs.readFileSync('./src/components/ReportTemplate.ts', 'utf-8');
  // strip TS types and export
  let jsCode = code.replace(/export const/g, 'const');
  jsCode = jsCode.replace(/import .*;/g, '');
  jsCode = jsCode.replace(/: any/g, '');
  jsCode = jsCode.replace(/: number/g, '');
  jsCode = jsCode.replace(/: ServiceReport/g, '');
  jsCode = jsCode.replace(/<any>/g, '');
  jsCode = jsCode.replace(/import type .*;/g, '');
  
  // mock formatTeamName
  jsCode = `
    const formatTeamName = (t) => t;
    const DateTimeUtils = { calculateOvertimeHours: () => 0 };
  ` + jsCode;
  
  // write to tmp file
  fs.writeFileSync('./scratch/test_report.js', jsCode + `
    const report = {
      type: 'ARIZA',
      reportNo: 'AR-012937',
      date: '2026-06-16T12:00:00Z',
      siteName: 'Alize Sarıkaya',
      turbineSerial: '782466',
      turbineNo: 'T12',
      faultCode: '1-18',
      team: 'TEAM 13',
      faultDesc: 'Turbine stopped - SCADA (bird and bat protection external)',
      workSessions: [],
      materials: [],
      checklist: []
    };
    try {
      const html = renderReportPDF(report);
      fs.writeFileSync('./scratch/test_out.html', html);
      console.log("Success! Length: " + html.length);
    } catch(e) {
      console.error("Error:", e);
    }
  `);
}

test();
