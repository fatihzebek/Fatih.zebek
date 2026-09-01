import type { ServiceReport } from './ServiceReportService';
import type { Task } from './TaskService';
import { personnelService } from './PersonnelService';
import faultCategories from '../data/fault_categories.json';
import { dataService } from './DataService';
import * as DateTimeUtils from '../utils/DateTimeUtils';
import { statusService } from './StatusService';

export const getFaultMainCategory = (kodOrDesc: string): string => {
  if (!kodOrDesc || kodOrDesc === '---') return '';
  const item = statusService.getCodeByKod(kodOrDesc);
  if (item && item.Aciklama) {
    const parts = item.Aciklama.split('-');
    if (parts.length > 0 && parts[0].trim()) {
      return parts[0].trim().toLowerCase();
    }
  }
  return kodOrDesc.split('-')[0]?.trim().toLowerCase() || kodOrDesc.trim().toLowerCase();
};

export interface PerformanceMetric {
  name: string;
  expertise: string[];
  avgEfficiency: number;
  bakimHours: number;
  arizaHours: number;
  bakimCount: number;
  arizaCount: number;
  repeatFaultCount: number;
  totalHours: number;
  overtimeHours: number;
  roadHours: number;
  repeatErrorRate: number;
  specialization: string;
  turbines: string[];
  sites: string[];
  team?: string;
  company?: string;
  speedScore: number;
  qualityScore: number;
  mobilityScore: number;
  sacrificeScore: number;
  masteryScore: number;
  masteryGrade: 'A+' | 'A' | 'B' | 'C';
  masteryLabel: string;
}

export interface OvertimeDetail {
  personnelName: string;
  date: string;
  startTime: string;
  endTime: string;
  overtimeHours: number;
  turbineSerial: string;
  turbineNo?: string;
  siteName?: string;
  reportId: string;
}

export interface AnalyticsSummary {
  operationSummary: {
    totalManHours: number;
    totalOvertimeHours: number;
    efficiencyScore: number;
    monthlyTotal: number;
    bakimRatio: number;
    arizaRatio: number;
    totalTurbineHours: number;
    totalRoadHours: number;
    opexTotal: number;
  };
  personnelMetrics: PerformanceMetric[];
  overtimeDetails: OvertimeDetail[];
  backlogRecommendations: {
    taskId: string;
    recommendedPersonnel: string;
    reason: string;
  }[];
}

const getCanonicalName = (name: string) => {
  const upper = name.trim().toUpperCase();
  const found = personnelService.getPersonnelList().find(p => p.toUpperCase() === upper);
  return found || name;
};

class AnalyticsService {
  get personnel() {
    const details = personnelService.getPersonnelDetailsList();
    const officeStaff = [
      'fatih zebek',
      'sercan yetki',
      'furkan yıldırım',
      'furkan yildirim',
      'necat öztürk',
      'necat ozturk'
    ];
    return personnelService.getPersonnelList()
      .filter(name => {
        const clean = name.toLocaleLowerCase('tr-TR').trim();
        return !officeStaff.some(os => clean.includes(os) || os.includes(clean));
      })
      .map(name => {
        const detail = details.find(d => d.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'));
        return {
          name,
          expertise: ["Servis Bakım"],
          hourlyRate: 100,
          baseSiteId: detail?.baseSites?.[0] || "GENEL"
        };
      });
  }
  private categories = faultCategories;

  // 1. ADAM-SAAT VE MESAİ HESAPLAMA
  calculateManHours(report: ServiceReport, estimatedHours: number = 4) {
    let totalManHours = 0;
    let overtimeManHours = 0;
    let overtimeSegments: { personnel: string[], startTime: string, endTime: string, hours: number }[] = [];
    let totalRoadHours = 0;
    let totalTurbineHours = 0;

    if (report.workSessions && report.workSessions.length > 0) {
      report.workSessions.forEach(session => {
        try {
          const [startH, startM] = session.startTime.split(':').map(Number);
          const [endH, endM] = session.endTime.split(':').map(Number);
          
          const on = new Date(2000, 0, 1, startH, startM);
          let off = new Date(2000, 0, 1, endH, endM);
          if (off < on) off = new Date(2000, 0, 2, endH, endM);
          
          const pCount = session.personnel?.length || 0;
          let duration = (off.getTime() - on.getTime()) / (1000 * 60 * 60);
          
          totalManHours += duration * pCount;

          // Turbine downtime boundaries: only for type ÇALIŞMA, WORK, or BEKLEME
          if (session.type === 'ÇALIŞMA' || session.type === 'WORK' || session.type === 'BEKLEME') {
            totalTurbineHours += duration;
          }

          // Road hours: only for type GİDİŞ YOLU, DÖNÜŞ YOLU, TRAVEL, EVDEN TÜRBİNE, TÜRBİNDEN EVE, TÜRBİNDEN TÜRBİNE, or YOL
          if (session.type === 'GİDİŞ YOLU' || session.type === 'DÖNÜŞ YOLU' || session.type === 'TRAVEL' || session.type === 'EVDEN TÜRBİNE' || session.type === 'TÜRBİNDEN EVE' || session.type === 'TÜRBİNDEN TÜRBİNE' || session.type === 'YOL') {
            totalRoadHours += duration;
          }

          let otTotal = 0;
          const pList = session.personnel || [];
          pList.forEach((name: string) => {
            let otHours = DateTimeUtils.calculateOvertimeHours(
              session.date || report.date || new Date().toISOString().split('T')[0],
              session.startTime,
              session.endTime,
              session.isOffDay || false,
              name
            );
            
            // Onaylanmış mesai kontrolü (Yönetici onayı varsa onaylanan saat baz alınır)
            const normName = name.toLocaleLowerCase('tr-TR').trim();
            const approvalsForSession = report.overtimeApprovals?.[session.id];
            if (approvalsForSession) {
              const matchedKey = Object.keys(approvalsForSession).find(k => k.toLocaleLowerCase('tr-TR').trim() === normName);
              if (matchedKey) {
                const app = approvalsForSession[matchedKey];
                if (app.status === 'approved') {
                  otHours = app.approvedHours !== undefined ? app.approvedHours : otHours;
                } else if (app.status === 'rejected') {
                  otHours = 0;
                }
              }
            }

            otTotal += otHours;
          });
          
          overtimeManHours += otTotal;

          const representativeOt = pCount > 0 ? (otTotal / pCount) : 0;
          if (otTotal > 0 && pCount > 0) {
            overtimeSegments.push({
              personnel: session.personnel,
              startTime: session.startTime,
              endTime: session.endTime,
              hours: Number(representativeOt.toFixed(2))
            });
          }
        } catch (e) {}
      });

      (this as any).lastTurbineDuration = totalTurbineHours;
    } else {
      const onStr = report.timeManagement?.maintenanceOn;
      const offStr = report.timeManagement?.maintenanceOff;
      const personnelCount = report.personnel?.length || 0;

      if (onStr && offStr && personnelCount > 0) {
        try {
          const [startH, startM] = onStr.split(':').map(Number);
          const [endH, endM] = offStr.split(':').map(Number);
          const on = new Date(2000, 0, 1, startH, startM);
          let off = new Date(2000, 0, 1, endH, endM);
          if (off < on) off = new Date(2000, 0, 2, endH, endM);

          let durationHours = (off.getTime() - on.getTime()) / (1000 * 60 * 60);
          totalManHours = Math.max(0, durationHours * personnelCount);
          (this as any).lastTurbineDuration = durationHours;

          let otTotal = 0;
          const pList = report.personnel || [];
          pList.forEach((name: string) => {
            const otHours = DateTimeUtils.calculateOvertimeHours(
              report.date || new Date().toISOString().split('T')[0],
              onStr,
              offStr,
              false,
              name
            );
            otTotal += otHours;
          });
          
          overtimeManHours = otTotal;

          const representativeOt = personnelCount > 0 ? (otTotal / personnelCount) : 0;
          if (otTotal > 0) {
            overtimeSegments.push({
              personnel: report.personnel || [],
              startTime: onStr,
              endTime: offStr,
              hours: Number(representativeOt.toFixed(2))
            });
          }
        } catch (e) {}
      }
    }

    const personnelCount = Math.max(1, report.personnel?.length || 1);
    const expectedHours = estimatedHours * personnelCount;
    const deviation = expectedHours > 0 ? (totalManHours - expectedHours) / expectedHours : 0;
    
    return {
      totalManHours: Number(totalManHours.toFixed(2)),
      overtimeManHours: Number(overtimeManHours.toFixed(2)),
      overtimeSegments,
      totalTurbineHours: Number(((this as any).lastTurbineDuration || 0).toFixed(2)),
      totalRoadHours: Number(totalRoadHours.toFixed(2)),
      deviation: Math.round(deviation * 100),
      isAlert: Math.abs(deviation) > 0.20
    };
  }

  // 2. PERSONEL YETKİNLİK ANALİZİ (Basit model)
  getCategoryForFault(faultCode: string): string {
    for (const [category, prefixes] of Object.entries(this.categories)) {
      if (prefixes.some(p => faultCode.startsWith(p))) {
        return category;
      }
    }
    return "Genel";
  }

  // 3. EKSİK İŞ VE PERSONEL ATAMA
  recommendPersonnelForBacklog(task: Task): { name: string; reason: string } {
    const category = task.secilenSablon?.includes('Yağlama') ? 'Mekanik' : 'Genel';
    
    // Find personnel with matching expertise
    const candidates = this.personnel.filter(p => 
      p.expertise.includes(category as any) || p.expertise.includes('Genel')
    );

    if (candidates.length === 0) return { name: this.personnel[0].name, reason: "Varsayılan atama (uzmanlık eşleşmedi)." };

    // Recommendation logic: Simplistic "best match"
    const best = candidates[0];
    return {
      name: best.name,
      reason: `${category} uzmanlığı ve uygun lokasyon bazlı öneri.`
    };
  }

  // 4. MALİYET ANALİZİ
  calculateOPEX(report: ServiceReport, manHours: number): number {
    const avgRate = 130; // Default hourly rate
    const personnelCost = manHours * avgRate;
    
    // Simple material cost calculation
    const materialCost = (report.materials || []).reduce((sum, m) => sum + ((m.used || 0) * 50), 0); // Assuming avg 50 unit price
    
    return personnelCost + materialCost;
  }

  generateUnifiedAnalysis(reports: ServiceReport[], tasks: Task[]): AnalyticsSummary {
    let totalManHours = 0;
    let totalOvertimeHours = 0;
    let totalRoadHours = 0;
    let bakimHoursTotal = 0;
    let arizaHoursTotal = 0;
    let totalOpex = 0;
    let totalTurbineHours = 0;
    let efficiencySum = 0;
    let validReportCount = 0;
    let monthlyTotal = 0;
    let overtimeDetails: OvertimeDetail[] = [];

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    reports.forEach(r => {
      (this as any).lastTurbineDuration = 0; // Reset for each report
      const stats = this.calculateManHours(r, r.type === 'BAKIM' ? 8 : 4);
      if (stats.totalManHours > 0) {
        totalManHours += stats.totalManHours;
        totalOvertimeHours += stats.overtimeManHours;
        totalTurbineHours += stats.totalTurbineHours;
        totalRoadHours += stats.totalRoadHours || 0;
        totalOpex += this.calculateOPEX(r, stats.totalManHours);
        
        const reportEfficiency = Math.max(0, 1 - Math.abs(stats.deviation / 100));
        efficiencySum += reportEfficiency;
        validReportCount++;

        // Mesai Detaylarını Topla
        if (stats.overtimeSegments && stats.overtimeSegments.length > 0) {
          stats.overtimeSegments.forEach(seg => {
            seg.personnel.forEach(pName => {
              if (r.voidedOvertimes && r.voidedOvertimes.includes(pName)) return;
              overtimeDetails.push({
                personnelName: getCanonicalName(pName),
                date: r.date,
                startTime: seg.startTime,
                endTime: seg.endTime,
                overtimeHours: seg.hours,
                turbineSerial: r.turbineSerial || 'Bilinmiyor',
                turbineNo: r.turbineNo || (r.turbineSerial ? dataService.findTurbineBySerial(r.turbineSerial)?.turbineNo : undefined),
                siteName: r.siteName || (r.turbineSerial ? dataService.findTurbineBySerial(r.turbineSerial)?.siteName : undefined),
                reportId: r.id || 'N/A'
              });
            });
          });
        }

        // Type breakdown
        if (r.type === 'BAKIM') bakimHoursTotal += stats.totalManHours;
        else arizaHoursTotal += stats.totalManHours;

        // Monthly total
        const rDate = r.date ? new Date(r.date) : null;
        if (rDate && rDate.getMonth() === currentMonth && rDate.getFullYear() === currentYear) {
          monthlyTotal += stats.totalManHours;
        }
      }
    });

    return {
      operationSummary: {
        totalManHours: Math.round(totalManHours),
        totalOvertimeHours: Math.round(totalOvertimeHours),
        efficiencyScore: validReportCount > 0 ? Number((efficiencySum / validReportCount).toFixed(2)) : 0,
        opexTotal: Math.round(totalOpex),
        monthlyTotal: Math.round(monthlyTotal),
        bakimRatio: totalManHours > 0 ? Math.round((bakimHoursTotal / totalManHours) * 100) : 0,
        arizaRatio: totalManHours > 0 ? Math.round((arizaHoursTotal / totalManHours) * 100) : 0,
        totalTurbineHours: Math.round(totalTurbineHours),
        totalRoadHours: Math.round(totalRoadHours)
      },
      personnelMetrics: (() => {
        const personnelDetails = personnelService.getPersonnelDetailsList();
        const allSitesList = dataService.getSites();
        const norm = (s: string) => (s || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]/g, '');

        return this.personnel.map(p => {
          const pNameUpper = p.name.toUpperCase();
          const pDetail = personnelDetails.find(d => norm(d.name) === norm(p.name));
          
          let officialSites: string[] = [];
          if (pDetail && pDetail.baseSites && pDetail.baseSites.length > 0) {
            pDetail.baseSites.forEach(siteId => {
              const matchedSite = allSitesList.find(s => s.id === siteId || s.name.toLowerCase() === siteId.toLowerCase());
              if (matchedSite) {
                officialSites.push(matchedSite.name);
              } else {
                officialSites.push(siteId);
              }
            });
          }

          const assignedTeam = pDetail?.team || '';
          const assignedCompany = pDetail?.company || '';

          const personnelReports = reports.filter(r => 
            r.personnel && r.personnel.some((name: string) => name.toUpperCase() === pNameUpper)
          );
          let pEfficiencySum = 0;
          let pValidCount = 0;
          let pBakimHours = 0;
          let pArizaHours = 0;
          let pOvertimeHours = 0;
          let pRoadHours = 0;
          let pBakimCount = 0;
          let pArizaCount = 0;
          let pRepeatCount = 0;
          let pTurbines = new Set<string>();
          let pSites = new Set<string>();
          
          personnelReports.forEach(r => {
            (this as any).lastTurbineDuration = 0;
            const stats = this.calculateManHours(r, r.type === 'BAKIM' ? 8 : 4);
          if (stats.totalManHours > 0) {
            const reportEfficiency = Math.max(0, 1 - Math.abs(stats.deviation / 100));
            pEfficiencySum += reportEfficiency;
            pValidCount++;
            
            let pTotalSessionHours = 0;
            let pOvertimeSessionHours = 0;
            let pRoadSessionHours = 0;
            
            if (r.workSessions && r.workSessions.length > 0) {
              r.workSessions.forEach((ws: any) => {
                if (ws.personnel && ws.personnel.some((name: string) => name.toUpperCase() === pNameUpper)) {
                  const [h, m] = (ws.duration || '00:00').split(':').map(Number);
                  const dur = h + (m / 60);
                  pTotalSessionHours += dur;

                  // Check if it is a road session
                  if (ws.type === 'GİDİŞ YOLU' || ws.type === 'DÖNÜŞ YOLU' || ws.type === 'TRAVEL' || ws.type === 'EVDEN TÜRBİNE' || ws.type === 'TÜRBİNDEN EVE' || ws.type === 'TÜRBİNDEN TÜRBİNE' || ws.type === 'YOL') {
                    pRoadSessionHours += dur;
                  }
                  
                  let ot = DateTimeUtils.calculateOvertimeHours(
                    ws.date || r.date || new Date().toISOString().split('T')[0],
                    ws.startTime || '00:00',
                    ws.endTime || '00:00',
                    ws.isOffDay || false,
                    p.name
                  );

                  // Onaylı mesai kontrolü
                  const normPName = p.name.toLocaleLowerCase('tr-TR').trim();
                  const approvalsForSession = r.overtimeApprovals?.[ws.id];
                  if (approvalsForSession) {
                    const matchedKey = Object.keys(approvalsForSession).find(k => k.toLocaleLowerCase('tr-TR').trim() === normPName);
                    if (matchedKey) {
                      const app = approvalsForSession[matchedKey];
                      if (app.status === 'approved') {
                        ot = app.approvedHours !== undefined ? app.approvedHours : ot;
                      } else if (app.status === 'rejected') {
                        ot = 0;
                      }
                    }
                  }

                  pOvertimeSessionHours += ot;
                }
              });
            } else {
              const [h, m] = (r.timeManagement?.interventionDuration || '00:00').split(':').map(Number);
              pTotalSessionHours = h + (m / 60);
              
              let ot = DateTimeUtils.calculateOvertimeHours(
                r.date || new Date().toISOString().split('T')[0],
                r.timeManagement?.maintenanceOn || '00:00',
                r.timeManagement?.maintenanceOff || '00:00',
                false,
                p.name
              );

              const normPName = p.name.toLocaleLowerCase('tr-TR').trim();
              if (r.overtimeApprovals) {
                Object.values(r.overtimeApprovals).forEach((sessionApps: any) => {
                  if (sessionApps && typeof sessionApps === 'object') {
                    const matchedKey = Object.keys(sessionApps).find(k => k.toLocaleLowerCase('tr-TR').trim() === normPName);
                    if (matchedKey) {
                      const app = sessionApps[matchedKey];
                      if (app.status === 'approved') {
                        ot = app.approvedHours !== undefined ? app.approvedHours : ot;
                      } else if (app.status === 'rejected') {
                        ot = 0;
                      }
                    }
                  }
                });
              }

              pOvertimeSessionHours += ot;
            }

            pOvertimeHours += pOvertimeSessionHours;
            pRoadHours += pRoadSessionHours;
            
            const site = r.siteName || (r.turbineSerial ? dataService.findTurbineBySerial(r.turbineSerial)?.siteName : '') || '';
            const tNo = r.turbineNo || (r.turbineSerial ? dataService.findTurbineBySerial(r.turbineSerial)?.turbineNo : '') || r.turbineSerial || '';
            const fullTurbineLabel = (site && tNo) ? (tNo.startsWith(site) ? tNo : `${site} ${tNo}`) : (site || tNo);
            if (fullTurbineLabel) pTurbines.add(fullTurbineLabel.trim());
            if (site) pSites.add(site);
            
            if (r.type === 'BAKIM') {
              pBakimHours += pTotalSessionHours;
              pBakimCount++;
            } else {
              pArizaHours += pTotalSessionHours;
              pArizaCount++;
              
              // REPEAT FAULT DETECTION (Birebir Kod veya Resmi Sözlükteki Ana Sistem Eşleşmesi)
              const reportDate = new Date(r.date);
              const sevenDaysLater = new Date(reportDate.getTime() + (7 * 24 * 60 * 60 * 1000));
              const faultKey = (r.faultCode && r.faultCode !== '---') ? r.faultCode : (r.faultDesc || '');
              const faultCat = getFaultMainCategory(faultKey);
              
              const isRepeat = !!faultKey && reports.some(otherR => {
                if (otherR.id === r.id || otherR.type !== 'ARIZA' || otherR.turbineSerial !== r.turbineSerial) return false;
                const otherDate = new Date(otherR.date);
                if (otherDate <= reportDate || otherDate > sevenDaysLater) return false;

                const otherKey = (otherR.faultCode && otherR.faultCode !== '---') ? otherR.faultCode : (otherR.faultDesc || '');
                if (!otherKey) return false;

                // 1. Birebir Aynı Arıza Kodu
                if (otherKey.trim().toLowerCase() === faultKey.trim().toLowerCase()) return true;

                // 2. Resmi Sözlükteki (fault_codes.json) Ana Sistem Eşleşmesi
                const otherCat = getFaultMainCategory(otherKey);
                return !!(faultCat && otherCat && faultCat === otherCat);
              });
              
              if (isRepeat) pRepeatCount++;
            }
          }
        });

        const totalPWorkHours = pBakimHours + pArizaHours;
        const totalJobs = pBakimCount + pArizaCount;
        const repeatRate = pArizaCount > 0 ? (pRepeatCount / pArizaCount) : 0;
        const avgEff = pValidCount > 0 ? (pEfficiencySum / pValidCount) : 0;

        const finalSites = officialSites.length > 0 ? officialSites : (pSites.size > 0 ? Array.from(pSites) : ['Belirtilmedi']);
        const siteCount = officialSites.length > 0 ? officialSites.length : pSites.size;
        const turbineCount = pTurbines.size;

        // 1. Çoklu Saha & Türbin Portföyü / Sorumluluk Skoru (0 - 25 Puan)
        let mobilityScore = 0;
        if (siteCount >= 3) mobilityScore += 15;
        else if (siteCount === 2) mobilityScore += 10;
        else if (siteCount === 1) mobilityScore += 5;

        if (turbineCount >= 15) mobilityScore += 10;
        else if (turbineCount >= 10) mobilityScore += 8;
        else if (turbineCount >= 5) mobilityScore += 6;
        else if (turbineCount >= 1) mobilityScore += 4;

        mobilityScore = Math.min(25, mobilityScore);

        // 2. Mesai & Fedakarlık Skoru (0 - 25 Puan)
        let sacrificeScore = 0;
        if (pOvertimeHours >= 35) sacrificeScore = 25;
        else if (pOvertimeHours >= 20) sacrificeScore = 20;
        else if (pOvertimeHours >= 10) sacrificeScore = 15;
        else if (pOvertimeHours >= 4) sacrificeScore = 10;
        else if (pOvertimeHours > 0) sacrificeScore = 5;

        // 3. Hız & Çözüm Verimliliği Skoru (0 - 25 Puan)
        let speedScore = 0;
        if (totalJobs > 0) {
          const avgDurationPerJob = totalPWorkHours / totalJobs;
          if (avgEff >= 0.8 || (avgDurationPerJob >= 1.0 && avgDurationPerJob <= 4.0)) {
            speedScore = 25;
          } else if (avgEff >= 0.6 || avgDurationPerJob <= 5.5) {
            speedScore = 20;
          } else if (avgEff >= 0.4 || avgDurationPerJob <= 7.5) {
            speedScore = 15;
          } else {
            speedScore = 10;
          }
        }

        // 4. İşçilik Kalitesi & Tekrarsız Başarı Skoru (0 - 25 Puan)
        let qualityScore = 25;
        if (pArizaCount > 0) {
          const successRate = (pArizaCount - pRepeatCount) / pArizaCount;
          if (successRate >= 0.95) qualityScore = 25;
          else if (successRate >= 0.85) qualityScore = 22;
          else if (successRate >= 0.75) qualityScore = 18;
          else if (successRate >= 0.60) qualityScore = 14;
          else qualityScore = 8;
        }

        // Toplam Performans & Uzmanlık Skoru (100 Üzerinden)
        const rawScore = mobilityScore + sacrificeScore + speedScore + qualityScore;
        const masteryScore = totalJobs === 0 ? 0 : Math.min(100, Math.max(0, rawScore));

        let masteryGrade: 'A+' | 'A' | 'B' | 'C' = 'C';
        let masteryLabel = 'Gelişime Açık';
        if (masteryScore >= 80) {
          masteryGrade = 'A+';
          masteryLabel = 'Yıldız Teknisyen (Yüksek Zam & Prim)';
        } else if (masteryScore >= 65) {
          masteryGrade = 'A';
          masteryLabel = 'Üstün Performans (Yüksek Zam)';
        } else if (masteryScore >= 50) {
          masteryGrade = 'B';
          masteryLabel = 'Başarılı (Standart Zam)';
        } else {
          masteryGrade = 'C';
          masteryLabel = 'Gelişime Açık (Eğitim Gerekli)';
        }

        return {
          name: p.name,
          expertise: p.expertise,
          avgEfficiency: Number(avgEff.toFixed(2)),
          bakimHours: Number(pBakimHours.toFixed(1)),
          arizaHours: Number(pArizaHours.toFixed(1)),
          bakimCount: pBakimCount,
          arizaCount: pArizaCount,
          repeatFaultCount: pRepeatCount,
          totalHours: Number(totalPWorkHours.toFixed(1)),
          overtimeHours: Number(pOvertimeHours.toFixed(1)),
          roadHours: Number(pRoadHours.toFixed(1)),
          repeatErrorRate: Number(repeatRate.toFixed(2)),
          specialization: p.expertise[0],
          turbines: Array.from(pTurbines),
          sites: finalSites,
          team: assignedTeam,
          company: assignedCompany,
          speedScore,
          qualityScore,
          mobilityScore,
          sacrificeScore,
          masteryScore,
          masteryGrade,
          masteryLabel
        };
      })})(),
      overtimeDetails,
      backlogRecommendations: tasks
        .filter(t => t.status === 'WAITING')
        .map(t => {
          const rec = this.recommendPersonnelForBacklog(t);
          return {
            taskId: t.id,
            recommendedPersonnel: rec.name,
            reason: rec.reason
          };
        })
    };
  }
}

export const analyticsService = new AnalyticsService();
