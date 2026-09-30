// d:/Dh_Servis/src/pages/PowerElectronics.ts
// Kestirimci Sıcaklık & Güç Elektroniği Kontrolü (Power Electronics & Predictive Thermal Control)
// Enercon E-70, E-82, E-92, E-48 Güç Kabini, Doğrultucu (Rectifier) ve İkaz (Excitation) Fan Takip Modülü

import { db } from '../firebase';
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { dataService } from '../services/DataService';
import { taskService } from '../services/TaskService';
import { authService } from '../services/AuthService';

// Site ID to SCADA plant_id mapping
const SITE_ID_TO_PLANT_ID: { [key: string]: string } = {
  '0752': 'germiyan',
  '2678': 'mare',
  '2688': 'intepe',
  '2990': 'sayalar',
  '3213': 'datca',
  '3243': 'camseki',
  '3245': 'keltepe',
  '3439': 'sarikaya',
  '3793': 'kuyucak',
  '3892': 'cataltepe',
};

export interface CabinetDetail {
  index: number;
  label: string;
  temp: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'SENSOR_FAULT';
}

export interface TurbinePowerThermal {
  turbineId: string;
  turbineName: string;
  siteId: string;
  siteName: string;
  model: string;
  controlType: 'CS48' | 'CS82';
  expectedCabinetCount: number;
  windSpeed: number | null;
  rotorSpeed: number | null;
  activePower: number | null;
  statusText: string;
  timestamp: string;

  // Power Cabinets (Güç Kabinleri)
  cabinets: CabinetDetail[];
  activeCabinetCount: number;
  maxCabinetTemp: number | null;
  minCabinetTemp: number | null;
  avgCabinetTemp: number | null;
  cabinetAsymmetry: number | null; // Delta T = max - min
  hottestCabinetIndex: number | null;

  // Rectifier / Heatsink (Doğrultucu / Soğutucu Blok)
  rectifier1: number | null;
  rectifier2: number | null;
  maxRectifierTemp: number | null;

  // Excitation (İkaz Sistemi)
  excitation1: number | null;
  excitation2: number | null;
  maxExcitationTemp: number | null;

  // Transformer & Ambient
  transformer: number | null;
  ambient: number | null;
  nacelle: number | null;

  // Predictive Overall Diagnosis
  overallStatus: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'SENSOR_FAULT';
  diagnosticTitle: string;
  diagnosticDetail: string;
  recommendedAction: string;
  fanTripRisk: boolean;
}

// Global state for page
let powerThermalUnsub: Unsubscribe | null = null;
let currentFleetTurbines: any[] = [];
let telemetryDataMap: Record<string, TurbinePowerThermal> = {};
let selectedSiteFilter: string = 'ALL';
let selectedStatusFilter: string = 'ALL';
let selectedModelFilter: string = 'ALL';
let searchQuery: string = '';
let activeTab: 'matrix' | 'comparison' | 'alerts' = 'matrix';
let selectedModalTurbineId: string | null = null;

// Resolve model family, control type, and expected cabinet count
export function getTurbineModelDetails(serial: string, siteName: string, rawModel?: string, rawControlType?: string): {
  modelFamily: string;
  controlType: 'CS48' | 'CS82';
  expectedCabinets: number;
  cabinetPrefix: string;
} {
  const sNum = (serial || '').trim();
  const sName = (siteName || '').toLocaleLowerCase('tr-TR');
  const m = (rawModel || '').toUpperCase();
  const cType = (rawControlType || '').toUpperCase();

  // 1. CS48: E-44 / E-48 (Datça, Keltepe, Sayalar E-44/48, Anemon T01-T38)
  if (cType === 'CS48' || sNum.startsWith('48') || sNum.startsWith('45') || sNum.startsWith('41') || m.includes('E48') || m.includes('E-48') || m.includes('E44') || m.includes('E-44') || m.includes('E40')) {
    return {
      modelFamily: (m.includes('44') || sNum.startsWith('45')) ? 'E-44' : 'E-48',
      controlType: 'CS48',
      expectedCabinets: 3,
      cabinetPrefix: 'Converter '
    };
  }

  // 2. CS82: E-92 (Çataltepe T09-T13, Kuyucak)
  if (sNum.startsWith('92') || m.includes('E92') || m.includes('E-92')) {
    return {
      modelFamily: 'E-92',
      controlType: 'CS82',
      expectedCabinets: 8,
      cabinetPrefix: 'Kabin '
    };
  }

  // 3. CS82: E-70 (Kuyucak, Sarıkaya T12-T13, Keltepe, Sayalar)
  if (sNum.startsWith('78') || m.includes('E70') || m.includes('E-70')) {
    return {
      modelFamily: 'E-70',
      controlType: 'CS82',
      expectedCabinets: 8,
      cabinetPrefix: 'Kabin '
    };
  }

  // 4. CS82: E-82/E2
  // Serials starting with 8264, 8257, 8241 (Anemon İntepe T39-T49, Mare T50-T55, Germiyan, Kuyucak E2)
  const isE82E2 = m.includes('E2') || m.includes('E82/E2') || m.includes('E82-E2') || sNum.startsWith('8264') || sNum.startsWith('8257') || sNum.startsWith('8241');
  if (isE82E2) {
    return {
      modelFamily: 'E-82/E2',
      controlType: 'CS82',
      expectedCabinets: 8,
      cabinetPrefix: 'Kabin '
    };
  }

  // 5. CS82: E-82 in Sarıkaya (8215xx) or Çataltepe (8221xx) -> 7 cabinets
  const isSarikayaOrCataltepe = sName.includes('sarıkaya') || sName.includes('sarikaya') || sName.includes('çataltepe') || sName.includes('cataltepe');
  if (isSarikayaOrCataltepe) {
    return {
      modelFamily: 'E-82',
      controlType: 'CS82',
      expectedCabinets: 7,
      cabinetPrefix: 'Kabin '
    };
  }

  // 6. Default E-82
  return {
    modelFamily: 'E-82',
    controlType: 'CS82',
    expectedCabinets: 8,
    cabinetPrefix: 'Kabin '
  };
}

// Parse telemetry from turbine ek object
export function parsePowerElectronicsTelemetry(turbData: any, siteInfo: { siteId: string; siteName: string; model: string }): TurbinePowerThermal | null {
  if (!turbData) return null;
  const ek = turbData.ek || {};

  const modelDetails = getTurbineModelDetails(turbData.serial_no || '', siteInfo.siteName, siteInfo.model);

  let t82a1Str = '';
  let t82a2Str = '';
  let t48aStr = '';

  for (const key of Object.keys(ek)) {
    const k = key.toLowerCase();
    if (k.includes('t82a2')) {
      t82a2Str = ek[key]?.v || '';
    } else if (k.includes('t82a1')) {
      t82a1Str = ek[key]?.v || '';
    } else if (k.includes('t48a')) {
      t48aStr = ek[key]?.v || '';
    }
  }

  const cabinets: CabinetDetail[] = [];
  let rectifier1: number | null = null;
  let rectifier2: number | null = null;
  let excitation1: number | null = null;
  let excitation2: number | null = null;
  let transformer: number | null = null;
  let ambient: number | null = null;
  let nacelle: number | null = null;

  // Case 1: CS82 turbines (E-70, E-82, E-82/E2, E-92)
  if (modelDetails.controlType === 'CS82' || t82a2Str || (t82a1Str && !t48aStr)) {
    if (t82a2Str) {
      const parts = t82a2Str.split(',');
      // Read up to expectedCabinets (7 for Sarikaya/Cataltepe E-82, 8 for others)
      for (let i = 1; i <= modelDetails.expectedCabinets; i++) {
        if (parts[i] !== undefined) {
          const val = parseFloat(parts[i]);
          // Ignore uninstalled or disconnected channels (typically -14 or -15 or negative)
          if (!isNaN(val) && val > -10 && val < 140) {
            cabinets.push({
              index: i,
              label: `Kabin ${i}`,
              temp: Number(val.toFixed(1)),
              status: val >= 55 ? 'CRITICAL' : (val >= 45 ? 'WARNING' : 'NORMAL')
            });
          }
        }
      }
    }

    if (t82a1Str) {
      const p1 = t82a1Str.split(',');
      if (p1.length >= 28) {
        nacelle = p1[17] ? parseFloat(p1[17]) : null;
        rectifier1 = p1[20] ? parseFloat(p1[20]) : null;
        rectifier2 = p1[21] ? parseFloat(p1[21]) : null;
        ambient = p1[24] ? parseFloat(p1[24]) : null;
        excitation1 = p1[25] ? parseFloat(p1[25]) : null;
        excitation2 = p1[26] ? parseFloat(p1[26]) : null;
        transformer = p1[27] ? parseFloat(p1[27]) : null;
      }
    }
  } else if (modelDetails.controlType === 'CS48' || t48aStr) {
    // Case 2: CS48 turbines (E-44, E-48) -> 3 Converter Cabinets at indices 28, 29, 30
    if (t48aStr) {
      const p = t48aStr.split(',');
      if (p.length >= 25) {
        nacelle = p[17] ? parseFloat(p[17]) : null;
        rectifier1 = p[20] ? parseFloat(p[20]) : null;
        rectifier2 = p[21] ? parseFloat(p[21]) : null;
        ambient = p[24] ? parseFloat(p[24]) : null;
        excitation1 = p[25] ? parseFloat(p[25]) : null;
        excitation2 = p[26] ? parseFloat(p[26]) : null;
        transformer = p[27] ? parseFloat(p[27]) : null;

        // Converter Control Cabinets 1, 2, 3 (indices 28, 29, 30)
        for (let j = 1; j <= 3; j++) {
          const idx = 27 + j; // 28, 29, 30
          if (p[idx] !== undefined) {
            const v = parseFloat(p[idx]);
            // Filter uninstalled (-15.0) and placeholders
            if (!isNaN(v) && v > -10 && v < 140) {
              cabinets.push({
                index: j,
                label: `Converter ${j}`,
                temp: Number(v.toFixed(1)),
                status: v >= 55 ? 'CRITICAL' : (v >= 45 ? 'WARNING' : 'NORMAL')
              });
            }
          }
        }
      }
    }
  }

  // If no cabinets and no rectifier, return null
  if (cabinets.length === 0 && rectifier1 === null && excitation1 === null) {
    return null;
  }

  // Calculate cabinet aggregations
  let maxCabinetTemp: number | null = null;
  let minCabinetTemp: number | null = null;
  let avgCabinetTemp: number | null = null;
  let cabinetAsymmetry: number | null = null;
  let hottestCabinetIndex: number | null = null;

  if (cabinets.length > 0) {
    const temps = cabinets.map(c => c.temp);
    maxCabinetTemp = Math.max(...temps);
    minCabinetTemp = Math.min(...temps);
    avgCabinetTemp = Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1));
    cabinetAsymmetry = Number((maxCabinetTemp - minCabinetTemp).toFixed(1));
    const hottest = cabinets.find(c => c.temp === maxCabinetTemp);
    if (hottest) hottestCabinetIndex = hottest.index;
  }

  // Calculate rectifier and excitation max
  const validRectifiers = [rectifier1, rectifier2].filter((v): v is number => v !== null && !isNaN(v) && v > -20);
  const maxRectifierTemp = validRectifiers.length > 0 ? Math.max(...validRectifiers) : null;

  const validExcitations = [excitation1, excitation2].filter((v): v is number => v !== null && !isNaN(v) && v > -20);
  const maxExcitationTemp = validExcitations.length > 0 ? Math.max(...validExcitations) : null;

  // Sensor fault detection
  let hasSensorFault = false;
  let sensorFaultDetail = '';
  cabinets.forEach(c => {
    if (c.temp < -20 || c.temp > 130) {
      hasSensorFault = true;
      c.status = 'SENSOR_FAULT';
      sensorFaultDetail = `${c.label} PT100/NTC sensör hatası (${c.temp}°C)`;
    }
  });
  if (maxExcitationTemp !== null && (maxExcitationTemp < -20 || maxExcitationTemp > 130)) {
    hasSensorFault = true;
    sensorFaultDetail = `İkaz sıcaklık sensör hatası (${maxExcitationTemp}°C)`;
  }
  if (maxRectifierTemp !== null && (maxRectifierTemp < -20 || maxRectifierTemp > 130)) {
    hasSensorFault = true;
    sensorFaultDetail = `Doğrultucu sıcaklık sensör hatası (${maxRectifierTemp}°C)`;
  }

  // Diagnostic logic for cooling fan degradation and trip risk
  let overallStatus: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'SENSOR_FAULT' = 'NORMAL';
  let diagnosticTitle = 'Normal / Dengeli Çalışma';
  let diagnosticDetail = 'Tüm güç kabinleri, doğrultucu bloklar ve ikaz ünitesi sıcaklıkları güvenli nominal aralıkta.';
  let recommendedAction = 'Rutin kontrol yeterli. Herhangi bir fan veya aşırı ısınma anomalisi tespit edilmedi.';
  let fanTripRisk = false;

  if (hasSensorFault) {
    overallStatus = 'SENSOR_FAULT';
    diagnosticTitle = 'Sensör / Kablo Hattı Arızası';
    diagnosticDetail = sensorFaultDetail;
    recommendedAction = 'Sensör klemens bağlantılarını ve sıcaklık probunu sahada multimetre/PT100 test cihazıyla ölçünüz.';
  } else if ((cabinetAsymmetry !== null && cabinetAsymmetry >= 12) || (maxCabinetTemp !== null && maxCabinetTemp >= 55) || (maxRectifierTemp !== null && maxRectifierTemp >= 68) || (maxExcitationTemp !== null && maxExcitationTemp >= 65)) {
    overallStatus = 'CRITICAL';
    fanTripRisk = true;
    if (cabinetAsymmetry !== null && cabinetAsymmetry >= 12) {
      diagnosticTitle = `Kritik Kabin Isıl Dengesizliği (ΔT: +${cabinetAsymmetry}°C)`;
      diagnosticDetail = `Kabin ${hottestCabinetIndex} (${maxCabinetTemp}°C), diğer kabinlerden çok daha sıcak. Soğutma fanı durmuş veya fan rulmanı kilitlenmiş olabilir. Dur-kalk ve aşırı ısı trip riski yüksek!`;
      recommendedAction = `Türbin inverter bölmesine ivedi tırmanış açılarak Kabin ${hottestCabinetIndex} altındaki fan ünitesi, hava filtreleri ve fan rulmanları kontrol edilmeli / değiştirilmelidir.`;
    } else if (maxRectifierTemp !== null && maxRectifierTemp >= 68) {
      diagnosticTitle = `Doğrultucu Aşırı Sıcak (${maxRectifierTemp}°C) - Trip Tehlikesi`;
      diagnosticDetail = `Doğrultucu (Rectifier) soğutucu blok sıcaklığı kritik eşiği aştı. Termik trip (aşırı ısı duruşu) kaçınılmaz.`;
      recommendedAction = `Doğrultucu soğutma fanı ve termal macun teması ivedi incelenmelidir.`;
    } else {
      diagnosticTitle = `İkaz Sistemi Fan / Aşırı Sıcak (${maxExcitationTemp}°C)`;
      diagnosticDetail = `Excitation (ikaz) sargı ve güç katı kritik ısı seviyesine ulaştı. İkaz fanı debi kaybetmiş olabilir.`;
      recommendedAction = `İkaz ünitesi cebri soğutma fanının devri ve rulman sesi incelenmelidir.`;
    }
  } else if ((cabinetAsymmetry !== null && cabinetAsymmetry >= 7) || (maxCabinetTemp !== null && maxCabinetTemp >= 46) || (maxRectifierTemp !== null && maxRectifierTemp >= 58) || (maxExcitationTemp !== null && maxExcitationTemp >= 50)) {
    overallStatus = 'WARNING';
    if (cabinetAsymmetry !== null && cabinetAsymmetry >= 7) {
      diagnosticTitle = `Erken Uyarı: Kabin Fan Yavaşlaması (ΔT: +${cabinetAsymmetry}°C)`;
      diagnosticDetail = `Kabin ${hottestCabinetIndex} (${maxCabinetTemp}°C) ile diğer kabinler arasında ${cabinetAsymmetry}°C asimetri var. Fan rulmanında sürtünme veya toz birikmesi başlamış.`;
      recommendedAction = `Bir sonraki servis bakımında Kabin ${hottestCabinetIndex} fanının rulman serbestliği ve emiş filtresi temizlenmelidir.`;
    } else if (maxRectifierTemp !== null && maxRectifierTemp >= 58) {
      diagnosticTitle = `Doğrultucu Isınma Eğilimi (${maxRectifierTemp}°C)`;
      diagnosticDetail = `Doğrultucu sıcaklığı çevre türbinlere göre yükseliyor.`;
      recommendedAction = `Soğutucu kanatçıkların tozluluk durumu ve fan dönüş yönü gözlemlenmelidir.`;
    } else {
      diagnosticTitle = `İkaz Fanı Performans Uyarısı (${maxExcitationTemp}°C)`;
      diagnosticDetail = `İkaz sıcaklığı yükseliş trendinde. Fan rulman sürtünmesi veya debi düşüşü olabilir.`;
      recommendedAction = `İkaz bölmesi fanının ses ve titreşim kontrolü yapılmalıdır.`;
    }
  }

  const rawWind = turbData.wind_speed_ms !== undefined ? parseFloat(turbData.wind_speed_ms) : (turbData.wind_speed !== undefined ? parseFloat(turbData.wind_speed) : null);
  const rawRpm = turbData.rotor_speed_rpm !== undefined ? parseFloat(turbData.rotor_speed_rpm) : (turbData.rotor_speed !== undefined ? parseFloat(turbData.rotor_speed) : (turbData.rpm !== undefined ? parseFloat(turbData.rpm) : null));
  const rawPower = turbData.active_power_kw !== undefined ? parseFloat(turbData.active_power_kw) : (turbData.power_kw !== undefined ? parseFloat(turbData.power_kw) : (turbData.power !== undefined ? parseFloat(turbData.power) : null));

  return {
    turbineId: turbData.serial_no || '',
    turbineName: turbData.turbine_name || turbData.name || turbData.serial_no || '',
    siteId: siteInfo.siteId,
    siteName: siteInfo.siteName,
    model: modelDetails.modelFamily,
    controlType: modelDetails.controlType,
    expectedCabinetCount: modelDetails.expectedCabinets,
    windSpeed: rawWind !== null && !isNaN(rawWind) ? Number(rawWind.toFixed(1)) : null,
    rotorSpeed: rawRpm !== null && !isNaN(rawRpm) ? Number(rawRpm.toFixed(1)) : null,
    activePower: rawPower !== null && !isNaN(rawPower) ? Number(rawPower.toFixed(0)) : null,
    statusText: turbData.status_text || turbData.enercon_status || turbData.status || 'Çalışıyor',
    timestamp: turbData.last_updated || new Date().toISOString(),

    cabinets,
    activeCabinetCount: cabinets.length,
    maxCabinetTemp,
    minCabinetTemp,
    avgCabinetTemp,
    cabinetAsymmetry,
    hottestCabinetIndex,

    rectifier1: rectifier1 !== null && !isNaN(rectifier1) ? Number(rectifier1.toFixed(1)) : null,
    rectifier2: rectifier2 !== null && !isNaN(rectifier2) ? Number(rectifier2.toFixed(1)) : null,
    maxRectifierTemp,

    excitation1: excitation1 !== null && !isNaN(excitation1) ? Number(excitation1.toFixed(1)) : null,
    excitation2: excitation2 !== null && !isNaN(excitation2) ? Number(excitation2.toFixed(1)) : null,
    maxExcitationTemp,

    transformer: transformer !== null && !isNaN(transformer) ? Number(transformer.toFixed(1)) : null,
    ambient: ambient !== null && !isNaN(ambient) ? Number(ambient.toFixed(1)) : null,
    nacelle: nacelle !== null && !isNaN(nacelle) ? Number(nacelle.toFixed(1)) : null,

    overallStatus,
    diagnosticTitle,
    diagnosticDetail,
    recommendedAction,
    fanTripRisk
  };
}

// Load fleet turbines helper
function loadFleetTurbines(): any[] {
  const sites = dataService.getSortedSites();
  const allTurbines: any[] = [];
  sites.forEach(site => {
    const siteTurbines = dataService.getTurbinesBySite(site.id) || [];
    siteTurbines.forEach(t => {
      const label = t.label || '';
      if (label.includes('RTU') || label.includes('FCU') || label.includes('Meteo') || label.includes('Merkez') || label.includes('TM')) {
        return;
      }
      allTurbines.push({
        id: t.id,
        name: t.label || `T-${String(t.no).padStart(2, '0')}`,
        siteId: site.id,
        siteName: site.name,
        model: t.type || 'E-82',
        no: t.no
      });
    });
  });
  return allTurbines;
}

// Main Page Render Function
export async function PowerElectronicsPage(): Promise<string> {
  // Load turbines from DataService
  try {
    currentFleetTurbines = loadFleetTurbines();
  } catch (e) {
    console.error("Turbines load error:", e);
  }

  // Setup real-time SCADA subscription
  setupSCADASubscription();

  // Return base container
  return `
    <div class="power-electronics-container" style="padding: 1.5rem; max-width: 1600px; margin: 0 auto; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      
      <!-- Top Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 42px; height: 42px; border-radius: 10px; background: linear-gradient(135deg, rgba(255, 159, 67, 0.2), rgba(255, 71, 87, 0.2)); border: 1px solid rgba(255, 159, 67, 0.4); display: flex; align-items: center; justify-content: center; font-size: 1.3rem; color: #ff9f43;">
              <i class="fa-solid fa-bolt-lightning"></i>
            </div>
            <div>
              <h1 style="font-size: 1.5rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
                Güç Elektroniği & Sıcaklık Kontrolü
                <span style="font-size: 0.72rem; padding: 3px 8px; border-radius: 20px; background: rgba(0, 210, 211, 0.15); color: #00d2d3; border: 1px solid rgba(0, 210, 211, 0.3); font-weight: 700; text-transform: uppercase;">
                  Kestirimci Bakım Ajanı
                </span>
              </h1>
              <p style="color: #8a8f98; font-size: 0.85rem; margin: 4px 0 0 0;">
                Enercon E-70 / E-82 / E-92 / E-48 Güç Kabinleri, Doğrultucu ve İkaz Soğutma Fanı Rulman Bozulması & Aşırı Isınma Erken Teşhisi
              </p>
            </div>
          </div>
        </div>

        <!-- Telemetry Status & Refresh -->
        <div style="display: flex; align-items: center; gap: 12px;">
          <div id="pe-live-badge" style="display: flex; align-items: center; gap: 6px; background: rgba(46, 213, 115, 0.1); border: 1px solid rgba(46, 213, 115, 0.3); padding: 6px 12px; border-radius: 20px; font-size: 0.75rem; color: #2ed573; font-weight: 700;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #2ed573; box-shadow: 0 0 8px #2ed573; animation: pulse 2s infinite;"></span>
            <span>Canlı SCADA Akışı Aktif</span>
          </div>
          <button onclick="window.refreshPowerElectronicsTelemetry()" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 7px 14px; color: #fff; font-size: 0.82rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-arrows-rotate"></i> Yenile
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards Row -->
      <div id="pe-kpi-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: rgba(20, 24, 33, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 1rem;">
          <div style="color: #8a8f98; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">İzlenen Türbin</div>
          <div id="pe-kpi-total" style="font-size: 1.8rem; font-weight: 900; color: #fff; margin-top: 4px;">--</div>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">Aktif güç elektroniği verisi olan</div>
        </div>

        <div style="background: rgba(46, 213, 115, 0.05); border: 1px solid rgba(46, 213, 115, 0.2); border-radius: 12px; padding: 1rem;">
          <div style="color: #2ed573; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Normal / Dengeli</div>
          <div id="pe-kpi-normal" style="font-size: 1.8rem; font-weight: 900; color: #2ed573; margin-top: 4px;">--</div>
          <div style="font-size: 0.72rem; color: #2ed573aa; margin-top: 2px;">ΔT asimetrisi &lt; 7°C</div>
        </div>

        <div style="background: rgba(255, 159, 67, 0.05); border: 1px solid rgba(255, 159, 67, 0.2); border-radius: 12px; padding: 1rem; cursor: pointer;" onclick="window.filterPowerStatus('WARNING')">
          <div style="color: #ff9f43; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Fan Yavaşlama Uyarısı</div>
          <div id="pe-kpi-warning" style="font-size: 1.8rem; font-weight: 900; color: #ff9f43; margin-top: 4px;">--</div>
          <div style="font-size: 0.72rem; color: #ff9f43aa; margin-top: 2px;">Fan rulmanı aşınması / toz</div>
        </div>

        <div style="background: rgba(255, 71, 87, 0.06); border: 1px solid rgba(255, 71, 87, 0.25); border-radius: 12px; padding: 1rem; cursor: pointer;" onclick="window.filterPowerStatus('CRITICAL')">
          <div style="color: #ff4757; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Kritik / Dur-Kalk Riski</div>
          <div id="pe-kpi-critical" style="font-size: 1.8rem; font-weight: 900; color: #ff4757; margin-top: 4px;">--</div>
          <div style="font-size: 0.72rem; color: #ff4757aa; margin-top: 2px;">Kilitli fan veya aşırı sıcaklık</div>
        </div>

        <div style="background: rgba(217, 70, 239, 0.05); border: 1px solid rgba(217, 70, 239, 0.2); border-radius: 12px; padding: 1rem; cursor: pointer;" onclick="window.filterPowerStatus('SENSOR_FAULT')">
          <div style="color: #d946ef; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Sensör Hatası</div>
          <div id="pe-kpi-sensor" style="font-size: 1.8rem; font-weight: 900; color: #d946ef; margin-top: 4px;">--</div>
          <div style="font-size: 0.72rem; color: #d946efaa; margin-top: 2px;">PT100 / kablo arızası</div>
        </div>
      </div>

      <!-- Filters & Tab Row -->
      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between;">
        
        <!-- Tab Buttons -->
        <div style="display: flex; gap: 8px; background: rgba(0, 0, 0, 0.3); padding: 4px; border-radius: 8px;">
          <button id="pe-tab-matrix" onclick="window.switchPowerElectronicsTab('matrix')" style="background: rgba(255, 159, 67, 0.2); border: 1px solid #ff9f43; color: #ff9f43; padding: 6px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-grip"></i> Filo Isıl Matrisi
          </button>
          <button id="pe-tab-comparison" onclick="window.switchPowerElectronicsTab('comparison')" style="background: transparent; border: 1px solid transparent; color: #8a8f98; padding: 6px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-chart-column"></i> Kabin & İkaz Kıyaslama
          </button>
          <button id="pe-tab-alerts" onclick="window.switchPowerElectronicsTab('alerts')" style="background: transparent; border: 1px solid transparent; color: #8a8f98; padding: 6px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-triangle-exclamation"></i> Teşhis ve Görev Havuzu
          </button>
        </div>

        <!-- Filter Controls -->
        <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center;">
          <!-- Search -->
          <div style="position: relative;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #64748b; font-size: 0.8rem;"></i>
            <input type="text" id="pe-search-input" placeholder="Türbin, Saha, Model..." oninput="window.handlePowerSearch(this.value)" style="background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 6px 10px 6px 30px; color: #fff; font-size: 0.82rem; width: 170px; outline: none;">
          </div>

          <!-- Site Filter -->
          <select id="pe-site-select" onchange="window.handlePowerSiteChange(this.value)" style="background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 6px 10px; color: #fff; font-size: 0.82rem; outline: none; cursor: pointer;">
            <option value="ALL">Tüm Sahalar (10 Saha)</option>
          </select>

          <!-- Model Filter -->
          <select id="pe-model-select" onchange="window.handlePowerModelChange(this.value)" style="background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 6px 10px; color: #fff; font-size: 0.82rem; outline: none; cursor: pointer;">
            <option value="ALL">Tüm Modeller (E-70/82/92/48)</option>
            <option value="E-82">Enercon E-82</option>
            <option value="E-92">Enercon E-92</option>
            <option value="E-70">Enercon E-70</option>
            <option value="E-48">Enercon E-48 / E-44</option>
          </select>

          <!-- Status Filter -->
          <select id="pe-status-select" onchange="window.filterPowerStatus(this.value)" style="background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 6px 10px; color: #fff; font-size: 0.82rem; outline: none; cursor: pointer;">
            <option value="ALL">Tüm Durumlar</option>
            <option value="CRITICAL">🔴 Kritik / Dur-Kalk Riski</option>
            <option value="WARNING">🟠 Fan Yavaşlama Uyarısı</option>
            <option value="NORMAL">🟢 Normal / Dengeli</option>
            <option value="SENSOR_FAULT">🟣 Sensör Hatası</option>
          </select>
        </div>
      </div>

      <!-- Main Dynamic View Area -->
      <div id="pe-content-area">
        <div style="text-align: center; padding: 3rem; color: #8a8f98;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: #ff9f43; margin-bottom: 1rem;"></i>
          <div>SCADA güç elektroniği ve sıcaklık telemetrisi yükleniyor...</div>
        </div>
      </div>

      <!-- Turbine X-Ray Detail Modal -->
      <div id="pe-xray-modal" style="display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.8); backdrop-filter: blur(8px); z-index: 99999; align-items: center; justify-content: center; padding: 1.5rem;">
        <div id="pe-xray-modal-content" style="background: #111827; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 16px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);">
          <!-- Modal content injected dynamically -->
        </div>
      </div>

    </div>
  `;
}

// Setup real-time SCADA subscription
function setupSCADASubscription() {
  if (powerThermalUnsub) {
    powerThermalUnsub();
    powerThermalUnsub = null;
  }

  // Populate site select filter options
  setTimeout(() => {
    populateSiteSelect();
  }, 100);

  powerThermalUnsub = onSnapshot(collection(db, 'scada_live'), (snapshot) => {
    snapshot.forEach(docSnap => {
      const plantId = docSnap.id;
      const data = docSnap.data();
      if (!data || !Array.isArray(data.turbines)) return;

      data.turbines.forEach((tData: any) => {
        const serialNo = tData.serial_no;
        if (!serialNo) return;

        // Find turbine metadata from fleet list
        const turbMeta = currentFleetTurbines.find(t => t.id === serialNo || t.serialNumber === serialNo);
        const siteName = turbMeta?.siteName || plantId.toUpperCase();
        const siteId = turbMeta?.siteId || Object.keys(SITE_ID_TO_PLANT_ID).find(k => SITE_ID_TO_PLANT_ID[k] === plantId) || '';
        const model = turbMeta?.model || (tData.model ? tData.model : (serialNo.startsWith('82') ? 'E-82' : (serialNo.startsWith('92') ? 'E-92' : (serialNo.startsWith('78') ? 'E-70' : (plantId === 'datca' || plantId === 'intepe' ? 'E-48' : 'E-82')))));

        const parsed = parsePowerElectronicsTelemetry(tData, { siteId, siteName, model });
        if (parsed) {
          telemetryDataMap[serialNo] = parsed;
        }
      });
    });

    // Update UI components
    updatePowerElectronicsUI();
  }, (err) => {
    console.error("SCADA subscription error in PowerElectronics:", err);
  });
}

// Populate Site Dropdown
function populateSiteSelect() {
  const sel = document.getElementById('pe-site-select') as HTMLSelectElement | null;
  if (!sel) return;

  const sitesMap = new Map<string, string>();
  currentFleetTurbines.forEach(t => {
    if (t.siteId && t.siteName) {
      sitesMap.set(t.siteId, t.siteName);
    }
  });

  let optionsHtml = '<option value="ALL">Tüm Sahalar (10 Saha)</option>';
  Array.from(sitesMap.entries()).sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, name]) => {
    optionsHtml += `<option value="${id}">${name}</option>`;
  });
  sel.innerHTML = optionsHtml;
  sel.value = selectedSiteFilter;
}

// Update UI
export function updatePowerElectronicsUI() {
  const allItems = Object.values(telemetryDataMap);

  // Update KPI counters
  const total = allItems.length;
  const normal = allItems.filter(i => i.overallStatus === 'NORMAL').length;
  const warning = allItems.filter(i => i.overallStatus === 'WARNING').length;
  const critical = allItems.filter(i => i.overallStatus === 'CRITICAL').length;
  const sensor = allItems.filter(i => i.overallStatus === 'SENSOR_FAULT').length;

  const totalEl = document.getElementById('pe-kpi-total');
  const normalEl = document.getElementById('pe-kpi-normal');
  const warningEl = document.getElementById('pe-kpi-warning');
  const criticalEl = document.getElementById('pe-kpi-critical');
  const sensorEl = document.getElementById('pe-kpi-sensor');

  if (totalEl) totalEl.innerText = total.toString();
  if (normalEl) normalEl.innerText = normal.toString();
  if (warningEl) warningEl.innerText = warning.toString();
  if (criticalEl) criticalEl.innerText = critical.toString();
  if (sensorEl) sensorEl.innerText = sensor.toString();

  // Filter items
  let filtered = allItems.filter(item => {
    if (selectedSiteFilter !== 'ALL' && item.siteId !== selectedSiteFilter) return false;
    if (selectedStatusFilter !== 'ALL' && item.overallStatus !== selectedStatusFilter) return false;
    if (selectedModelFilter !== 'ALL' && !item.model.toLowerCase().includes(selectedModelFilter.toLowerCase())) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = item.turbineName.toLowerCase().includes(q);
      const matchId = item.turbineId.toLowerCase().includes(q);
      const matchSite = item.siteName.toLowerCase().includes(q);
      const matchModel = item.model.toLowerCase().includes(q);
      if (!matchName && !matchId && !matchSite && !matchModel) return false;
    }
    return true;
  });

  // Sort: CRITICAL first, then WARNING, then by Asymmetry descending
  filtered.sort((a, b) => {
    const score = (st: string) => st === 'CRITICAL' ? 4 : (st === 'WARNING' ? 3 : (st === 'SENSOR_FAULT' ? 2 : 1));
    if (score(b.overallStatus) !== score(a.overallStatus)) {
      return score(b.overallStatus) - score(a.overallStatus);
    }
    return (b.cabinetAsymmetry || 0) - (a.cabinetAsymmetry || 0);
  });

  const contentArea = document.getElementById('pe-content-area');
  if (!contentArea) return;

  if (filtered.length === 0) {
    contentArea.innerHTML = `
      <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 3rem; text-align: center; color: #8a8f98;">
        <i class="fa-solid fa-filter-circle-xmark" style="font-size: 2.5rem; color: #64748b; margin-bottom: 1rem;"></i>
        <div style="font-size: 1.1rem; font-weight: 700; color: #fff;">Filtreye Uygun Türbin Bulunamadı</div>
        <p style="font-size: 0.85rem; margin-top: 6px;">Seçilen kriterleri değiştirerek tekrar deneyebilirsiniz.</p>
        <button onclick="window.resetPowerFilters()" style="margin-top: 1rem; background: rgba(255, 159, 67, 0.2); border: 1px solid #ff9f43; color: #ff9f43; padding: 6px 14px; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer;">
          Filtreleri Sıfırla
        </button>
      </div>
    `;
    return;
  }

  if (activeTab === 'matrix') {
    contentArea.innerHTML = renderMatrixView(filtered);
  } else if (activeTab === 'comparison') {
    contentArea.innerHTML = renderComparisonView(filtered);
  } else {
    contentArea.innerHTML = renderAlertsView(filtered);
  }
}

// 1. Matrix View: Cards with Power Cabinets mini-bars and fan status
function renderMatrixView(items: TurbinePowerThermal[]): string {
  return `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(360px, 1fr)); gap: 1.2rem;">
      ${items.map(item => {
        const statusColors = {
          NORMAL: { bg: 'rgba(46, 213, 115, 0.08)', border: 'rgba(46, 213, 115, 0.25)', badge: '#2ed573', text: '🟢 Normal' },
          WARNING: { bg: 'rgba(255, 159, 67, 0.08)', border: 'rgba(255, 159, 67, 0.35)', badge: '#ff9f43', text: '🟠 Fan Uyarısı' },
          CRITICAL: { bg: 'rgba(255, 71, 87, 0.1)', border: 'rgba(255, 71, 87, 0.45)', badge: '#ff4757', text: '🔴 Kritik / Trip Riski' },
          SENSOR_FAULT: { bg: 'rgba(217, 70, 239, 0.08)', border: 'rgba(217, 70, 239, 0.35)', badge: '#d946ef', text: '🟣 Sensör Arızası' }
        };
        const cfg = statusColors[item.overallStatus];

        return `
          <div style="background: ${cfg.bg}; border: 1px solid ${cfg.border}; border-radius: 12px; padding: 1.1rem; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.15s ease;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            
            <!-- Card Header -->
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
                <div>
                  <div style="font-size: 0.75rem; color: #8a8f98; font-weight: 600;">${item.siteName}</div>
                  <div style="font-size: 1.15rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                    ${item.turbineName}
                    <span style="font-size: 0.7rem; color: #64748b; font-weight: 500;">(SN: ${item.turbineId})</span>
                  </div>
                  <div style="font-size: 0.72rem; color: #00d2d3; margin-top: 2px;">
                    <i class="fa-solid fa-wind"></i> ${item.model} • ${item.activePower !== null ? `${item.activePower} kW` : '-- kW'}
                  </div>
                </div>

                <div style="text-align: right;">
                  <span style="background: ${cfg.badge}22; color: ${cfg.badge}; border: 1px solid ${cfg.badge}55; padding: 3px 8px; border-radius: 20px; font-size: 0.72rem; font-weight: 800;">
                    ${cfg.text}
                  </span>
                  ${item.cabinetAsymmetry !== null ? `
                    <div style="font-size: 0.72rem; font-weight: 800; color: ${item.cabinetAsymmetry >= 10 ? '#ff4757' : (item.cabinetAsymmetry >= 6 ? '#ff9f43' : '#2ed573')}; margin-top: 4px;">
                      ΔT: +${item.cabinetAsymmetry}°C
                    </div>
                  ` : ''}
                </div>
              </div>

              <!-- Power Cabinets Temperature Bars Grid -->
              <div style="background: rgba(0, 0, 0, 0.35); border-radius: 8px; padding: 0.8rem; margin: 0.8rem 0;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="font-size: 0.72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase;">
                    <i class="fa-solid fa-server" style="color: #ff9f43; margin-right: 4px;"></i> Güç Kabinleri (${item.activeCabinetCount} Adet)
                  </span>
                  <span style="font-size: 0.7rem; color: #64748b;">
                    Ort: <strong style="color: #fff;">${item.avgCabinetTemp ?? '--'}°C</strong> | En Sıcak: <strong style="color: #ff9f43;">${item.maxCabinetTemp ?? '--'}°C</strong>
                  </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(${item.cabinets.length > 4 ? 4 : (item.cabinets.length || 1)}, 1fr); gap: 6px;">
                  ${item.cabinets.map(cab => {
                    const cabColor = cab.temp >= 55 ? '#ff4757' : (cab.temp >= 45 ? '#ff9f43' : '#2ed573');
                    return `
                      <div style="background: rgba(255, 255, 255, 0.04); border: 1px solid ${cabColor}33; border-radius: 6px; padding: 4px; text-align: center;" title="${cab.label}: ${cab.temp}°C">
                        <div style="font-size: 0.65rem; color: #8a8f98;">K${cab.index}</div>
                        <div style="font-size: 0.85rem; font-weight: 800; color: ${cabColor}; margin: 1px 0;">${cab.temp}°</div>
                        <!-- Mini bar -->
                        <div style="height: 3px; background: rgba(255, 255, 255, 0.1); border-radius: 2px; overflow: hidden;">
                          <div style="width: ${Math.min(100, Math.max(10, (cab.temp / 70) * 100))}%; height: 100%; background: ${cabColor};"></div>
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Auxiliary Modules: Rectifier, Excitation, Transformer -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.75rem; margin-bottom: 0.8rem;">
                <div style="background: rgba(0, 0, 0, 0.25); border-radius: 6px; padding: 6px 8px; display: flex; align-items: center; justify-content: space-between;">
                  <span style="color: #8a8f98;"><i class="fa-solid fa-microchip" style="color: #00d2d3; margin-right: 4px;"></i> Doğrultucu:</span>
                  <strong style="color: ${item.maxRectifierTemp && item.maxRectifierTemp >= 60 ? '#ff4757' : '#fff'};">
                    ${item.maxRectifierTemp !== null ? `${item.maxRectifierTemp}°C` : '--'}
                  </strong>
                </div>

                <div style="background: rgba(0, 0, 0, 0.25); border-radius: 6px; padding: 6px 8px; display: flex; align-items: center; justify-content: space-between;">
                  <span style="color: #8a8f98;"><i class="fa-solid fa-fan" style="color: #a855f7; margin-right: 4px;"></i> İkaz (İkaz Fanı):</span>
                  <strong style="color: ${item.maxExcitationTemp && item.maxExcitationTemp >= 55 ? '#ff4757' : '#fff'};">
                    ${item.maxExcitationTemp !== null ? `${item.maxExcitationTemp}°C` : '--'}
                  </strong>
                </div>
              </div>

              <!-- Teşhis Özeti -->
              <div style="font-size: 0.73rem; color: #cbd5e1; line-height: 1.3; background: rgba(0,0,0,0.2); padding: 6px 8px; border-radius: 6px; border-left: 3px solid ${cfg.badge};">
                <strong>${item.diagnosticTitle}:</strong> ${item.diagnosticDetail.substring(0, 95)}...
              </div>
            </div>

            <!-- Card Action Footer -->
            <div style="display: flex; gap: 8px; margin-top: 1rem; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 0.8rem;">
              <button onclick="window.openPowerXRayModal('${item.turbineId}')" style="flex: 1; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 6px 10px; color: #fff; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;">
                <i class="fa-solid fa-magnifying-glass-chart"></i> Isıl Röntgen
              </button>

              ${item.overallStatus !== 'NORMAL' ? `
                <button onclick="window.createPowerElectronicsTask('${item.turbineId}')" style="background: ${item.overallStatus === 'SENSOR_FAULT' ? 'rgba(217, 70, 239, 0.2)' : 'rgba(255, 71, 87, 0.2)'}; border: 1px solid ${item.overallStatus === 'SENSOR_FAULT' ? '#d946ef' : '#ff4757'}; border-radius: 6px; padding: 6px 12px; color: ${item.overallStatus === 'SENSOR_FAULT' ? '#d946ef' : '#ff4757'}; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                  <i class="fa-solid fa-screwdriver-wrench"></i> Görev Aç
                </button>
              ` : ''}
            </div>

          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 2. Comparison View: Tabular breakdown with direct comparison
function renderComparisonView(items: TurbinePowerThermal[]): string {
  return `
    <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
        <thead>
          <tr style="background: rgba(0, 0, 0, 0.4); border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #94a3b8; font-size: 0.72rem; text-transform: uppercase;">
            <th style="padding: 10px 14px;">Türbin & Saha</th>
            <th style="padding: 10px 14px;">Model & Güç</th>
            <th style="padding: 10px 14px;">Kabin Sayısı</th>
            <th style="padding: 10px 14px;">Kabin Sıcaklıkları (°C)</th>
            <th style="padding: 10px 14px;">Kabin Asimetrisi (ΔT)</th>
            <th style="padding: 10px 14px;">Doğrultucu</th>
            <th style="padding: 10px 14px;">İkaz (Fan)</th>
            <th style="padding: 10px 14px;">Durum & Teşhis</th>
            <th style="padding: 10px 14px; text-align: right;">Aksiyon</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(item => {
            const statusBadgeColors = {
              NORMAL: '#2ed573',
              WARNING: '#ff9f43',
              CRITICAL: '#ff4757',
              SENSOR_FAULT: '#d946ef'
            };
            const col = statusBadgeColors[item.overallStatus];

            return `
              <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); transition: background 0.1s ease;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 10px 14px;">
                  <strong style="color: #fff; font-size: 0.88rem;">${item.turbineName}</strong>
                  <div style="color: #8a8f98; font-size: 0.7rem;">${item.siteName} (SN: ${item.turbineId})</div>
                </td>
                <td style="padding: 10px 14px;">
                  <span style="color: #00d2d3; font-weight: 600;">${item.model}</span>
                  <div style="color: #8a8f98; font-size: 0.7rem;">${item.activePower !== null ? `${item.activePower} kW` : '-- kW'}</div>
                </td>
                <td style="padding: 10px 14px; font-weight: 700; color: #fff;">
                  ${item.activeCabinetCount} Kabin
                </td>
                <td style="padding: 10px 14px;">
                  <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                    ${item.cabinets.map(c => `
                      <span style="padding: 2px 5px; border-radius: 4px; background: rgba(255,255,255,0.05); font-size: 0.72rem; font-weight: 700; color: ${c.temp >= 55 ? '#ff4757' : (c.temp >= 45 ? '#ff9f43' : '#fff')};" title="${c.label}">
                        K${c.index}:${c.temp}°
                      </span>
                    `).join('')}
                  </div>
                </td>
                <td style="padding: 10px 14px;">
                  ${item.cabinetAsymmetry !== null ? `
                    <span style="font-weight: 800; color: ${item.cabinetAsymmetry >= 10 ? '#ff4757' : (item.cabinetAsymmetry >= 6 ? '#ff9f43' : '#2ed573')};">
                      +${item.cabinetAsymmetry}°C
                    </span>
                  ` : '--'}
                </td>
                <td style="padding: 10px 14px; font-weight: 700; color: ${item.maxRectifierTemp && item.maxRectifierTemp >= 60 ? '#ff4757' : '#fff'};">
                  ${item.maxRectifierTemp !== null ? `${item.maxRectifierTemp}°C` : '--'}
                </td>
                <td style="padding: 10px 14px; font-weight: 700; color: ${item.maxExcitationTemp && item.maxExcitationTemp >= 55 ? '#ff4757' : '#fff'};">
                  ${item.maxExcitationTemp !== null ? `${item.maxExcitationTemp}°C` : '--'}
                </td>
                <td style="padding: 10px 14px;">
                  <span style="background: ${col}22; color: ${col}; border: 1px solid ${col}55; padding: 2px 7px; border-radius: 12px; font-size: 0.7rem; font-weight: 800;">
                    ${item.diagnosticTitle}
                  </span>
                </td>
                <td style="padding: 10px 14px; text-align: right; white-space: nowrap;">
                  <button onclick="window.openPowerXRayModal('${item.turbineId}')" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 5px; color: #fff; padding: 4px 8px; font-size: 0.72rem; cursor: pointer; margin-right: 4px;">
                    Detay
                  </button>
                  ${item.overallStatus !== 'NORMAL' ? `
                    <button onclick="window.createPowerElectronicsTask('${item.turbineId}')" style="background: ${item.overallStatus === 'SENSOR_FAULT' ? 'rgba(217, 70, 239, 0.25)' : 'rgba(255, 71, 87, 0.25)'}; border: 1px solid ${col}; border-radius: 5px; color: ${col}; padding: 4px 8px; font-size: 0.72rem; font-weight: 700; cursor: pointer;">
                      Görev Aç
                    </button>
                  ` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// 3. Alerts View: Filter only abnormal turbines and show detailed actionable recommendations
function renderAlertsView(items: TurbinePowerThermal[]): string {
  const alertItems = items.filter(i => i.overallStatus !== 'NORMAL');

  if (alertItems.length === 0) {
    return `
      <div style="background: rgba(46, 213, 115, 0.05); border: 1px solid rgba(46, 213, 115, 0.2); border-radius: 12px; padding: 3rem; text-align: center;">
        <i class="fa-solid fa-circle-check" style="font-size: 3rem; color: #2ed573; margin-bottom: 1rem;"></i>
        <h2 style="color: #fff; font-size: 1.3rem; margin: 0 0 6px 0;">Mükemmel! Aktif Isıl Uyarı Yok</h2>
        <p style="color: #8a8f98; font-size: 0.85rem; max-width: 500px; margin: 0 auto;">
          Filodaki tüm güç kabinleri, doğrultucu bloklar ve ikaz soğutma fanları nominal sıcaklık aralıklarında dengeli çalışıyor.
        </p>
      </div>
    `;
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 1rem;">
      ${alertItems.map(item => {
        const isCritical = item.overallStatus === 'CRITICAL';
        const isSensor = item.overallStatus === 'SENSOR_FAULT';
        const color = isCritical ? '#ff4757' : (isSensor ? '#d946ef' : '#ff9f43');

        return `
          <div style="background: ${color}11; border: 1px solid ${color}44; border-radius: 12px; padding: 1.2rem; display: flex; flex-direction: column; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
              <div>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="background: ${color}; color: #000; font-size: 0.72rem; font-weight: 800; padding: 2px 7px; border-radius: 4px; text-transform: uppercase;">
                    ${isCritical ? 'ACİL MÜDAHALE' : (isSensor ? 'SENSÖR HATASI' : 'ERKEN UYARI')}
                  </span>
                  <strong style="color: #fff; font-size: 1.1rem;">${item.siteName} - ${item.turbineName}</strong>
                  <span style="color: #64748b; font-size: 0.8rem;">(SN: ${item.turbineId}) • ${item.model}</span>
                </div>
                <div style="color: ${color}; font-weight: 700; font-size: 0.95rem; margin-top: 6px;">
                  ${item.diagnosticTitle}
                </div>
              </div>

              <div style="display: flex; gap: 8px;">
                <button onclick="window.openPowerXRayModal('${item.turbineId}')" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 6px; padding: 6px 12px; color: #fff; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
                  <i class="fa-solid fa-chart-line"></i> Röntgen
                </button>
                <button onclick="window.createPowerElectronicsTask('${item.turbineId}')" style="background: ${color}22; border: 1px solid ${color}; border-radius: 6px; padding: 6px 14px; color: ${color}; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-screwdriver-wrench"></i> Saha Görevi Oluştur
                </button>
              </div>
            </div>

            <!-- Detail Breakdown -->
            <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 0.8rem; font-size: 0.82rem; line-height: 1.4; color: #cbd5e1;">
              <div><strong>Teşhis & Gözlem:</strong> ${item.diagnosticDetail}</div>
              <div style="margin-top: 4px; color: #64ffda;"><strong>Önerilen Saha Talimatı:</strong> ${item.recommendedAction}</div>
            </div>

            <!-- Mini Telemetry Strip -->
            <div style="display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.75rem; color: #8a8f98; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;">
              <span>Kabin Asimetrisi: <strong style="color: #fff;">+${item.cabinetAsymmetry ?? '--'}°C</strong></span>
              <span>En Sıcak Kabin: <strong style="color: #ff9f43;">K${item.hottestCabinetIndex} (${item.maxCabinetTemp}°C)</strong></span>
              <span>Doğrultucu: <strong style="color: #fff;">${item.maxRectifierTemp ?? '--'}°C</strong></span>
              <span>İkaz (Fan): <strong style="color: #fff;">${item.maxExcitationTemp ?? '--'}°C</strong></span>
              <span>Dış Ortam: <strong style="color: #fff;">${item.ambient ?? '--'}°C</strong></span>
              <span>Aktif Güç: <strong style="color: #00d2d3;">${item.activePower ?? '--'} kW</strong></span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// 4. Turbine X-Ray Modal
(window as any).openPowerXRayModal = (turbineId: string) => {
  const item = telemetryDataMap[turbineId];
  if (!item) return;
  selectedModalTurbineId = turbineId;

  const modal = document.getElementById('pe-xray-modal');
  const modalContent = document.getElementById('pe-xray-modal-content');
  if (!modal || !modalContent) return;

  const isCritical = item.overallStatus === 'CRITICAL';
  const isSensor = item.overallStatus === 'SENSOR_FAULT';
  const statusColor = isCritical ? '#ff4757' : (isSensor ? '#d946ef' : (item.overallStatus === 'WARNING' ? '#ff9f43' : '#2ed573'));

  modalContent.innerHTML = `
    <!-- Modal Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 1rem; margin-bottom: 1.2rem;">
      <div>
        <div style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">${item.siteName} • ${item.model}</div>
        <h2 style="margin: 2px 0 0 0; font-size: 1.4rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px;">
          ${item.turbineName} (SN: ${item.turbineId})
          <span style="font-size: 0.75rem; padding: 3px 9px; border-radius: 20px; background: ${statusColor}22; color: ${statusColor}; border: 1px solid ${statusColor}55;">
            ${item.overallStatus}
          </span>
        </h2>
      </div>

      <button onclick="window.closePowerXRayModal()" style="background: rgba(255, 255, 255, 0.08); border: none; border-radius: 50%; width: 34px; height: 34px; color: #fff; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <!-- Live Parameters Strip -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-bottom: 1.2rem;">
      <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 8px 10px;">
        <div style="font-size: 0.68rem; color: #8a8f98;">Aktif Güç</div>
        <div style="font-size: 1.1rem; font-weight: 800; color: #00d2d3;">${item.activePower !== null ? `${item.activePower} kW` : '--'}</div>
      </div>
      <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 8px 10px;">
        <div style="font-size: 0.68rem; color: #8a8f98;">Rüzgar Hızı</div>
        <div style="font-size: 1.1rem; font-weight: 800; color: #fff;">${item.windSpeed !== null ? `${item.windSpeed} m/s` : '--'}</div>
      </div>
      <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 8px 10px;">
        <div style="font-size: 0.68rem; color: #8a8f98;">Rotor Devri</div>
        <div style="font-size: 1.1rem; font-weight: 800; color: #fff;">${item.rotorSpeed !== null ? `${item.rotorSpeed} rpm` : '--'}</div>
      </div>
      <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 8px 10px;">
        <div style="font-size: 0.68rem; color: #8a8f98;">Dış Ortam</div>
        <div style="font-size: 1.1rem; font-weight: 800; color: #fff;">${item.ambient !== null ? `${item.ambient}°C` : '--'}</div>
      </div>
      <div style="background: rgba(0, 0, 0, 0.3); border-radius: 8px; padding: 8px 10px;">
        <div style="font-size: 0.68rem; color: #8a8f98;">Kabin Asimetrisi</div>
        <div style="font-size: 1.1rem; font-weight: 800; color: ${item.cabinetAsymmetry && item.cabinetAsymmetry >= 8 ? '#ff4757' : '#2ed573'};">
          ${item.cabinetAsymmetry !== null ? `+${item.cabinetAsymmetry}°C` : '--'}
        </div>
      </div>
    </div>

    <!-- Power Cabinets Visual Layout -->
    <div style="background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 1.2rem; margin-bottom: 1.2rem;">
      <div style="font-size: 0.85rem; font-weight: 700; color: #fff; margin-bottom: 0.8rem; display: flex; align-items: center; justify-content: space-between;">
        <span><i class="fa-solid fa-server" style="color: #ff9f43; margin-right: 6px;"></i> Güç Kabinleri Isı Dağılımı (${item.cabinets.length} Kabin)</span>
        <span style="font-size: 0.75rem; color: #8a8f98;">Nominal Eşik: &lt; 45°C</span>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 10px;">
        ${item.cabinets.map(cab => {
          const isHot = cab.index === item.hottestCabinetIndex && (item.cabinetAsymmetry || 0) >= 6;
          const barColor = cab.temp >= 55 ? '#ff4757' : (cab.temp >= 45 ? '#ff9f43' : '#2ed573');
          return `
            <div style="background: ${isHot ? 'rgba(255, 71, 87, 0.15)' : 'rgba(255, 255, 255, 0.04)'}; border: 1px solid ${isHot ? '#ff4757' : barColor + '44'}; border-radius: 8px; padding: 8px; text-align: center; position: relative;">
              ${isHot ? `
                <div style="position: absolute; top: -6px; right: -6px; background: #ff4757; color: #fff; border-radius: 50%; width: 16px; height: 16px; font-size: 0.6rem; display: flex; align-items: center; justify-content: center;" title="En Sıcak Kabin">!</div>
              ` : ''}
              <div style="font-size: 0.7rem; color: #8a8f98;">${cab.label}</div>
              <div style="font-size: 1.2rem; font-weight: 800; color: ${barColor}; margin: 4px 0;">${cab.temp}°C</div>
              
              <!-- Fan status indicator -->
              <div style="font-size: 0.65rem; color: ${isHot ? '#ff4757' : '#2ed573'}; margin-top: 4px; display: flex; align-items: center; justify-content: center; gap: 3px;">
                <i class="fa-solid fa-fan ${isHot ? '' : 'fa-spin'}" style="font-size: 0.65rem; animation-duration: 4s;"></i>
                <span>${isHot ? 'Yavaş Fan' : 'Aktif'}</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Secondary Systems Grid: Rectifier, Excitation, Transformer -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; margin-bottom: 1.2rem;">
      
      <!-- Rectifier Box -->
      <div style="background: rgba(0, 0, 0, 0.35); border-radius: 10px; padding: 1rem; border: 1px solid rgba(255, 255, 255, 0.06);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-size: 0.8rem; font-weight: 700; color: #00d2d3;">
            <i class="fa-solid fa-microchip"></i> Doğrultucu Blokları
          </span>
          <span style="font-size: 0.72rem; color: #8a8f98;">Heatsink</span>
        </div>
        <div style="display: flex; gap: 12px; margin-top: 6px;">
          <div>Blok 1: <strong style="color: #fff;">${item.rectifier1 !== null ? `${item.rectifier1}°C` : '--'}</strong></div>
          <div>Blok 2: <strong style="color: #fff;">${item.rectifier2 !== null ? `${item.rectifier2}°C` : '--'}</strong></div>
        </div>
      </div>

      <!-- Excitation Box -->
      <div style="background: rgba(0, 0, 0, 0.35); border-radius: 10px; padding: 1rem; border: 1px solid rgba(255, 255, 255, 0.06);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-size: 0.8rem; font-weight: 700; color: #a855f7;">
            <i class="fa-solid fa-fan"></i> İkaz (Excitation) Ünitesi
          </span>
          <span style="font-size: 0.72rem; color: #8a8f98;">Cebri Fan</span>
        </div>
        <div style="display: flex; gap: 12px; margin-top: 6px;">
          <div>İkaz 1: <strong style="color: #fff;">${item.excitation1 !== null ? `${item.excitation1}°C` : '--'}</strong></div>
          <div>İkaz 2: <strong style="color: #fff;">${item.excitation2 !== null ? `${item.excitation2}°C` : '--'}</strong></div>
        </div>
      </div>

      <!-- Transformer Box -->
      <div style="background: rgba(0, 0, 0, 0.35); border-radius: 10px; padding: 1rem; border: 1px solid rgba(255, 255, 255, 0.06);">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <span style="font-size: 0.8rem; font-weight: 700; color: #ff9f43;">
            <i class="fa-solid fa-plug"></i> Trafo Sıcaklığı
          </span>
          <span style="font-size: 0.72rem; color: #8a8f98;">Medium Voltage</span>
        </div>
        <div style="margin-top: 6px;">
          Trafo: <strong style="color: #fff;">${item.transformer !== null ? `${item.transformer}°C` : '--'}</strong>
        </div>
      </div>

    </div>

    <!-- Diagnostic & Recommendation Box -->
    <div style="background: ${statusColor}15; border: 1px solid ${statusColor}44; border-radius: 10px; padding: 1rem; margin-bottom: 1.2rem;">
      <div style="font-size: 0.95rem; font-weight: 800; color: ${statusColor}; margin-bottom: 4px;">
        <i class="fa-solid fa-stethoscope"></i> ${item.diagnosticTitle}
      </div>
      <p style="font-size: 0.85rem; color: #cbd5e1; margin: 4px 0 8px 0; line-height: 1.4;">
        ${item.diagnosticDetail}
      </p>
      <div style="font-size: 0.82rem; color: #64ffda; background: rgba(0,0,0,0.25); padding: 8px 10px; border-radius: 6px;">
        <strong>📋 Saha Aksiyonu:</strong> ${item.recommendedAction}
      </div>
    </div>

    <!-- Modal Footer Actions -->
    <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 1rem;">
      <button onclick="window.closePowerXRayModal()" style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; padding: 8px 16px; color: #fff; font-size: 0.82rem; font-weight: 600; cursor: pointer;">
        Kapat
      </button>

      <button onclick="window.closePowerXRayModal(); window.createPowerElectronicsTask('${item.turbineId}');" style="background: ${statusColor}22; border: 1px solid ${statusColor}; border-radius: 6px; padding: 8px 18px; color: ${statusColor}; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-screwdriver-wrench"></i> Saha Görevi / İş Emri Oluştur
      </button>
    </div>
  `;

  modal.style.display = 'flex';
};

(window as any).closePowerXRayModal = () => {
  const modal = document.getElementById('pe-xray-modal');
  if (modal) modal.style.display = 'none';
  selectedModalTurbineId = null;
};

// Create Maintenance Task in Pool
(window as any).createPowerElectronicsTask = async (turbineId: string) => {
  const item = telemetryDataMap[turbineId];
  if (!item) {
    alert("Bu türbin için güç elektroniği verisi bulunamadı.");
    return;
  }

  const isSensor = item.overallStatus === 'SENSOR_FAULT';
  const taskCategory = isSensor ? 'Sensör Arızası' : 'Güç Elektroniği Fan Kontrolü';
  const hotKab = item.hottestCabinetIndex ? `Kabin ${item.hottestCabinetIndex}` : 'Güç Kabinleri';

  const confirmMsg = `${item.siteName} - ${item.turbineName} (SN: ${item.turbineId}) için kestirimci görev oluşturulacak:\n\n` +
    `• Teşhis: ${item.diagnosticTitle}\n` +
    `• İlgili Ünite: ${hotKab} (Maks Sıcaklık: ${item.maxCabinetTemp}°C, Asimetri: +${item.cabinetAsymmetry}°C)\n` +
    `• Doğrultucu: ${item.maxRectifierTemp ?? '--'}°C | İkaz: ${item.maxExcitationTemp ?? '--'}°C\n` +
    `• Talimat: ${item.recommendedAction}\n\n` +
    `Görev ${item.siteName} bölge havuzuna aktarılsın mı?`;

  if (!confirm(confirmMsg)) return;

  try {
    const adminNote = `[OTONOM GÜÇ ELEKTRONİĞİ & TERMAL DANIŞMAN]\n` +
      `Türbin: ${item.siteName} ${item.turbineName} (Seri No: ${item.turbineId}) - Model: ${item.model}\n` +
      `Teşhis: ${item.diagnosticTitle}\n\n` +
      `ÖLÇÜLEN DEĞERLER:\n` +
      `- Kabin Asimetrisi (ΔT): +${item.cabinetAsymmetry ?? '--'}°C\n` +
      `- En Sıcak Kabin: ${hotKab} (${item.maxCabinetTemp ?? '--'}°C)\n` +
      `- Kabin Sıcaklıkları: ${item.cabinets.map(c => `K${c.index}: ${c.temp}°C`).join(', ')}\n` +
      `- Doğrultucu (Rectifier 1 / 2): ${item.rectifier1 ?? '--'}°C / ${item.rectifier2 ?? '--'}°C\n` +
      `- İkaz (Excitation 1 / 2): ${item.excitation1 ?? '--'}°C / ${item.excitation2 ?? '--'}°C\n` +
      `- Trafo: ${item.transformer ?? '--'}°C\n` +
      `- Aktif Güç / Rüzgar: ${item.activePower ?? '--'} kW / ${item.windSpeed ?? '--'} m/s\n\n` +
      `TALİMAT & SAHA AKSİYONU:\n` +
      `${item.recommendedAction}\n\n` +
      `DİKKAT: Fan rulmanında sürtünme veya filtre tıkanıklığı nedeniyle debi düşmüş olabilir. Dur-kalk (trip) oluşmadan müdahale edilmelidir.`;

    const currentUser = authService.getCurrentUser();
    await taskService.createNewTask({
      secilenSablon: taskCategory,
      sahaBilgisi: item.siteName,
      siteId: item.siteId,
      turbinSeriNo: item.turbineId,
      turbinNo: item.turbineName,
      statuKodu: isSensor ? 'Sensör Arızası' : 'Önleyici Bakım',
      statuAciklamasi: `Güç Elektroniği Soğutma Fanı & Sıcaklık Kontrolü (${hotKab})`,
      yoneticiNotu: adminNote,
      assignedTeam: 'Atanmadı',
      isPoolTask: true,
      createdBy: (currentUser as any)?.displayName || (currentUser as any)?.name || currentUser?.email || 'Güç Elektroniği Termal Ajanı'
    });

    alert(`✅ ${item.siteName} ${item.turbineName} için Önleyici Fan Kontrol Görevi başarıyla oluşturuldu!\n\nGörev ${item.siteName} bölge havuzuna aktarılmıştır.`);
    updatePowerElectronicsUI();
  } catch (err) {
    console.error("Görev oluşturma hatası:", err);
    alert("Görev oluşturulamadı: " + err);
  }
};

// UI Handlers attached to window
(window as any).switchPowerElectronicsTab = (tab: 'matrix' | 'comparison' | 'alerts') => {
  activeTab = tab;
  ['matrix', 'comparison', 'alerts'].forEach(t => {
    const btn = document.getElementById(`pe-tab-${t}`);
    if (btn) {
      if (t === tab) {
        btn.style.background = 'rgba(255, 159, 67, 0.2)';
        btn.style.borderColor = '#ff9f43';
        btn.style.color = '#ff9f43';
      } else {
        btn.style.background = 'transparent';
        btn.style.borderColor = 'transparent';
        btn.style.color = '#8a8f98';
      }
    }
  });
  updatePowerElectronicsUI();
};

(window as any).handlePowerSearch = (val: string) => {
  searchQuery = val.trim();
  updatePowerElectronicsUI();
};

(window as any).handlePowerSiteChange = (val: string) => {
  selectedSiteFilter = val;
  updatePowerElectronicsUI();
};

(window as any).handlePowerModelChange = (val: string) => {
  selectedModelFilter = val;
  updatePowerElectronicsUI();
};

(window as any).filterPowerStatus = (val: string) => {
  selectedStatusFilter = val;
  const sel = document.getElementById('pe-status-select') as HTMLSelectElement | null;
  if (sel) sel.value = val;
  updatePowerElectronicsUI();
};

(window as any).resetPowerFilters = () => {
  selectedSiteFilter = 'ALL';
  selectedStatusFilter = 'ALL';
  selectedModelFilter = 'ALL';
  searchQuery = '';
  const sInput = document.getElementById('pe-search-input') as HTMLInputElement | null;
  const sSite = document.getElementById('pe-site-select') as HTMLSelectElement | null;
  const sModel = document.getElementById('pe-model-select') as HTMLSelectElement | null;
  const sStatus = document.getElementById('pe-status-select') as HTMLSelectElement | null;
  if (sInput) sInput.value = '';
  if (sSite) sSite.value = 'ALL';
  if (sModel) sModel.value = 'ALL';
  if (sStatus) sStatus.value = 'ALL';
  updatePowerElectronicsUI();
};

(window as any).refreshPowerElectronicsTelemetry = () => {
  setupSCADASubscription();
};
