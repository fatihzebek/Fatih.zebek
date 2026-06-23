import { serviceReportService } from '../src/services/ServiceReportService';
async function run() {
  try {
    const anemon = await serviceReportService.getReportByNo('AR-247652');
    const alize = await serviceReportService.getReportByNo('AR-012937');
    console.log('ANEMON KEYS:', Object.keys(anemon || {}));
    console.log('ALIZE KEYS:', Object.keys(alize || {}));
    console.log('ALIZE SESSIONS:', alize?.workSessions);
    console.log('ALIZE MATERIALS:', alize?.materials);
    console.log('ALIZE CHECKLIST:', alize?.checklist);
    console.log('ALIZE PHOTOS:', alize?.photos);
  } catch(e) {
    console.error(e);
  }
  process.exit(0);
}
run();
