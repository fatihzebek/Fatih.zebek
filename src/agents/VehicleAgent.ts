import { BaseAgent } from './BaseAgent';
import { vehicleService } from '../services/VehicleService';

export interface FleetAgentInsight {
  id: string;
  type: 'INSPECTION_WARNING' | 'DRIVER_VERIFY_WARNING' | 'FINE_DISCOUNT_OPPORTUNITY' | 'TIRE_SEASON_WARNING' | 'OLD_INSPECTION_WARNING';
  severity: 'HIGH' | 'MEDIUM' | 'INFO';
  title: string;
  message: string;
  badgeText: string;
  badgeColor: string;
  actionText?: string;
  actionTab?: string;
  targetId?: string;
}

export class VehicleAgent extends BaseAgent {
  constructor() {
    super('vehicle-agent-01', 'VehicleAgent', 'Filo & Araç Denetim Ajanı');
  }

  /**
   * Tüm filoyu, sürücüleri, cezaları ve denetimleri analiz edip Admin için akıllı uyarı ve fırsat raporu üretir.
   */
  runFleetAudit(): {
    insights: FleetAgentInsight[];
    summary: {
      totalVehicles: number;
      highRiskCount: number;
      potentialSavings: number;
      pendingDriverVerifications: number;
    };
  } {
    const vehicles = vehicleService.getVehicles();
    const drivers = vehicleService.getDriverLicenses();
    const fines = vehicleService.getTrafficFines();
    const inspections = vehicleService.getInspectionReports();

    const insights: FleetAgentInsight[] = [];
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    let potentialSavings = 0;
    let highRiskCount = 0;
    let pendingDriverVerifications = 0;

    // 1. CEZA ÖDEME %25 İNDİRİM FIRSATI TARAMASI (PENDING statusundaki ödenmemiş cezalar)
    fines.filter(f => f.status === 'PENDING').forEach(fine => {
      const fineDate = new Date(fine.fineDate);
      const daysDiff = Math.floor((today.getTime() - fineDate.getTime()) / (1000 * 3600 * 24));
      const discountDeadlineDays = 15 - daysDiff;

      if (discountDeadlineDays > 0) {
        const discountAmount = Math.round(fine.amount * 0.75);
        const savings = Math.round(fine.amount * 0.25);
        potentialSavings += savings;

        insights.push({
          id: `fine-disc-${fine.id}`,
          type: 'FINE_DISCOUNT_OPPORTUNITY',
          severity: discountDeadlineDays <= 3 ? 'HIGH' : 'MEDIUM',
          title: `💰 Trafik Cezasında %25 Erken Ödeme İndirimi Fırsatı (${savings.toLocaleString('tr-TR')} ₺ Tasarruf)`,
          message: `${fine.plate} plakalı araca yazılan ${fine.fineCode} cezasında %25 indirimli ödeme (${discountAmount.toLocaleString('tr-TR')} ₺) yapmak için son ${discountDeadlineDays} gün! Sürücü: ${fine.driverName || 'Belirtilmedi'}.`,
          badgeText: `${discountDeadlineDays} Gün Kaldı`,
          badgeColor: discountDeadlineDays <= 3 ? '#EF4444' : '#F59E0B',
          actionText: '💳 Ödeme Yap',
          actionTab: 'tab-fines',
          targetId: fine.id
        });
      }
    });

    // 2. TÜVTÜRK MUAYENE & SİGORTA GEÇME / YAKLAŞMA UYARILARI
    vehicles.forEach(v => {
      if (v.inspectionDueDate) {
        const inspDate = new Date(v.inspectionDueDate);
        const diffDays = Math.ceil((inspDate.getTime() - today.getTime()) / (1000 * 3600 * 24));

        if (diffDays < 0) {
          highRiskCount++;
          insights.push({
            id: `insp-exp-${v.id}`,
            type: 'INSPECTION_WARNING',
            severity: 'HIGH',
            title: `🔴 TÜVTÜRK Muayenesi Geçti! (${v.plate})`,
            message: `${v.plate} (${v.brandModel}) aracının muayene tarihi ${Math.abs(diffDays)} gün önce (${v.inspectionDueDate}) dolmuştur. Trafiğe çıkması cezai risk taşır!`,
            badgeText: 'ACİL RİSK',
            badgeColor: '#EF4444',
            actionText: '🚘 Araç Detayı',
            actionTab: 'tab-vehicles',
            targetId: v.id
          });
        } else if (diffDays <= 30) {
          insights.push({
            id: `insp-due-${v.id}`,
            type: 'INSPECTION_WARNING',
            severity: 'MEDIUM',
            title: `⏳ TÜVTÜRK Muayenesi Yaklaşıyor (${v.plate})`,
            message: `${v.plate} (${v.brandModel}) aracının muayenesine ${diffDays} gün kaldı (Son Tarih: ${v.inspectionDueDate}). Randevu alınması tavsiye edilir.`,
            badgeText: `${diffDays} Gün Kaldı`,
            badgeColor: '#F59E0B',
            actionText: '🚘 Araç Detayı',
            actionTab: 'tab-vehicles',
            targetId: v.id
          });
        }
      }

      // 3. SEZONLUK LASTİK ZORUNLULUĞU DENETİMİ (1 Aralık - 1 Nisan)
      const currentMonth = today.getMonth() + 1; // 1-12
      const isWinterPeriod = currentMonth === 12 || currentMonth <= 4;
      if (isWinterPeriod && v.tireSeason === 'SUMMER') {
        insights.push({
          id: `tire-win-${v.id}`,
          type: 'TIRE_SEASON_WARNING',
          severity: 'MEDIUM',
          title: `❄️ Zorunlu Kış Lastiği Değişim Uyarısı (${v.plate})`,
          message: `1 Aralık - 1 Nisan yasal kış lastiği döneminde olunmasına rağmen ${v.plate} (${v.assignedTeamName || 'Atanmadı'}) aracında hala 'Yaz Lastiği' kayıtlıdır.`,
          badgeText: 'YAZ LASTİĞİ',
          badgeColor: '#3B82F6',
          actionText: '🚘 Düzenle',
          actionTab: 'tab-vehicles',
          targetId: v.id
        });
      }

      // 4. FOTOĞRAFLI DENETİM EKSİKLİĞİ UYARISI (Son 30 günde denetim yapılmadıysa)
      const vehicleInsps = inspections.filter(i => i.vehicleId === v.id || i.plate === v.plate);
      if (vehicleInsps.length === 0) {
        insights.push({
          id: `no-insp-${v.id}`,
          type: 'OLD_INSPECTION_WARNING',
          severity: 'INFO',
          title: `📸 Hiç Fotoğraflı Periyodik Denetim Yapılmadı (${v.plate})`,
          message: `${v.plate} (${v.assignedTeamName || 'Team01'}) aracı için henüz 5 açılı fotoğraflı periyodik denetim yapılmamıştır.`,
          badgeText: 'DENETİM EKSİK',
          badgeColor: '#94a3b8',
          actionText: '📷 Denetim Yap',
          actionTab: 'tab-inspections',
          targetId: v.id
        });
      }
    });

    // 5. SÜRÜCÜ 3 AYLIK EHLİYET BEYAN SÜRESİ DOLANLAR
    drivers.forEach(d => {
      if (d.next3MonthCheckDate && d.next3MonthCheckDate <= todayStr) {
        pendingDriverVerifications++;
        insights.push({
          id: `drv-chk-${d.id}`,
          type: 'DRIVER_VERIFY_WARNING',
          severity: 'HIGH',
          title: `📋 3 Aylık Ehliyet Beyan Süresi Doldu (${d.personnelName})`,
          message: `${d.personnelName} (${d.team}) kullanıcısının 3 aylık ehliyet ceza puanı beyan süresi dolmuştur. Lütfen beyanını alıp onaylayınız.`,
          badgeText: 'BEYAN BEKLİYOR',
          badgeColor: '#EF4444',
          actionText: '📜 Sürücüye Git',
          actionTab: 'tab-drivers',
          targetId: d.id
        });
      }
    });

    return {
      insights,
      summary: {
        totalVehicles: vehicles.length,
        highRiskCount,
        potentialSavings,
        pendingDriverVerifications
      }
    };
  }
}

export const vehicleAgent = new VehicleAgent();
