import { serviceReportService } from './src/services/ServiceReportService';
import { renderReportPDF } from './src/components/ReportTemplate';
import * as fs from 'fs';

async function run() {
  try {
    const report = await serviceReportService.getReportByNo('AR-012937');
    if (!report) {
      console.log('Report not found');
      process.exit(1);
    }
    const html = renderReportPDF(report);
    fs.writeFileSync('scratch/out.html', html);
    console.log('WROTE TO scratch/out.html, length:', html.length);
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
