import type { ServiceReport } from './ServiceReportService';
import type { Task } from './TaskService';
import personnelDetails from '../data/personnel_details.json';
import personnelList from '../data/personnel.json';
import faultCategories from '../data/fault_categories.json';
import { dataService } from './DataService';
import * as DateTimeUtils from '../utils/DateTimeUtils';

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
  const found = personnelList.find(p => p.toUpperCase() === upper);
  return found || name;
};

class AnalyticsService {
  private personnel = personnelList.map(name => {
    const detail = personnelDetails.find(d => d.name === name);
    return {
      name,
      expertise: name === "Fatih ZEBEK" ? [""] : ["Servis Bakım"],
      hourlyRate: detail?.hourlyRate || 100,
      baseSiteId: detail?.baseSiteId || "GENEL"
    };
  });
  private categories = faultCategories;

  // 1. ADAM-SAAT VE MESAİ HESAPLAMA
  calculateManHours(report: ServiceReport, estimatedHours: number = 4) {
    let totalManHours = 0;
    let overtimeManHours = 0;
    let overtimeSegments: { personnel: string[], startTime: string, endTime: string, hours: number }[] = [];
    let firstStart: any = null;
    let lastEnd: any = null;
    let totalRoadHours = 0;

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
            const sDate = session.date || report.date || new Date().toISOString().split('T')[0];
            const startDt = new Date(`${sDate}T${session.startTime}:00`);
            let endDt = new Date(`${sDate}T${session.endTime}:00`);
            if (!isNaN(startDt.getTime()) && !isNaN(endDt.getTime())) {
              if (endDt.getTime() < startDt.getTime()) {
                endDt = new Date(endDt.getTime() + 24 * 60 * 60 * 1000);
              }
              if (!firstStart || startDt < firstStart) {
                firstStart = startDt;
              }
              if (!lastEnd || endDt > lastEnd) {
                lastEnd = endDt;
              }
            }
          }

          // Road hours: only for type GİDİŞ YOLU, DÖNÜŞ YOLU, TRAVEL, EVDEN TÜRBİNE, or TÜRBİNDEN EVE
          if (session.type === 'GİDİŞ YOLU' || session.type === 'DÖNÜŞ YOLU' || session.type === 'TRAVEL' || session.type === 'EVDEN TÜRBİNE' || session.type === 'TÜRBİNDEN EVE' || session.type === 'YOL') {
            totalRoadHours += duration;
          }

          const otHours = DateTimeUtils.calculateOvertimeHours(
            session.date || report.date || new Date().toISOString().split('T')[0],
            session.startTime,
            session.endTime,
            session.isOffDay || false
          );
          
          const otTotal = otHours * pCount;
          overtimeManHours += otTotal;

          if (otHours > 0 && pCount > 0) {
            overtimeSegments.push({
              personnel: session.personnel,
              startTime: session.startTime,
              endTime: session.endTime,
              hours: Number(otHours.toFixed(2))
            });
          }
        } catch (e) {}
      });

      let totalTurbineHours = 0;
      if (firstStart && lastEnd) {
        totalTurbineHours = (lastEnd.getTime() - firstStart.getTime()) / (1000 * 60 * 60);
      }
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

          const otHours = DateTimeUtils.calculateOvertimeHours(
            report.date || new Date().toISOString().split('T')[0],
            onStr,
            offStr,
            false
          );
          
          overtimeManHours = otHours * personnelCount;

          if (otHours > 0) {
            overtimeSegments.push({
              personnel: report.personnel || [],
              startTime: onStr,
              endTime: offStr,
              hours: Number(otHours.toFixed(2))
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
    const materialCost = report.materials.reduce((sum, m) => sum + (m.used * 50), 0); // Assuming avg 50 unit price
    
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
      personnelMetrics: this.personnel.map(p => {
        const pNameUpper = p.name.toUpperCase();
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
                  if (ws.type === 'GİDİŞ YOLU' || ws.type === 'DÖNÜŞ YOLU' || ws.type === 'TRAVEL' || ws.type === 'EVDEN TÜRBİNE' || ws.type === 'TÜRBİNDEN EVE' || ws.type === 'YOL') {
                    pRoadSessionHours += dur;
                  }
                  
                  const ot = DateTimeUtils.calculateOvertimeHours(
                    ws.date || r.date || new Date().toISOString().split('T')[0],
                    ws.startTime || '00:00',
                    ws.endTime || '00:00',
                    ws.isOffDay || false
                  );
                  pOvertimeSessionHours += ot;
                }
              });
            } else {
              const [h, m] = (r.timeManagement?.interventionDuration || '00:00').split(':').map(Number);
              pTotalSessionHours = h + (m / 60);
              
              const ot = DateTimeUtils.calculateOvertimeHours(
                r.date || new Date().toISOString().split('T')[0],
                r.timeManagement?.maintenanceOn || '00:00',
                r.timeManagement?.maintenanceOff || '00:00',
                false
              );
              pOvertimeSessionHours = ot;
            }

            pOvertimeHours += pOvertimeSessionHours;
            pRoadHours += pRoadSessionHours;
            
            if (r.turbineSerial) pTurbines.add(r.turbineSerial);
            
            if (r.type === 'BAKIM') {
              pBakimHours += pTotalSessionHours;
              pBakimCount++;
            } else {
              pArizaHours += pTotalSessionHours;
              pArizaCount++;
              
              // REPEAT FAULT DETECTION
              const reportDate = new Date(r.date);
              const sevenDaysLater = new Date(reportDate.getTime() + (7 * 24 * 60 * 60 * 1000));
              
              const isRepeat = reports.some(otherR => 
                otherR.id !== r.id && 
                otherR.turbineSerial === r.turbineSerial && 
                otherR.type === 'ARIZA' &&
                new Date(otherR.date) > reportDate &&
                new Date(otherR.date) <= sevenDaysLater
              );
              
              if (isRepeat) pRepeatCount++;
            }
          }
        });

        const totalPWorkHours = pBakimHours + pArizaHours;
        const repeatRate = pArizaCount > 0 ? (pRepeatCount / pArizaCount) : 0;
        const avgEff = pValidCount > 0 ? (pEfficiencySum / pValidCount) : 0;

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
          turbines: Array.from(pTurbines)
        };
      }),
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
