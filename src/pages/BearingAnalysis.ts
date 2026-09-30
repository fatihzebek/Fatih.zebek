import { bearingAgent } from '../agents/BearingAgent';
import type { GreaseAnalysisResult, AcousticAnalysisResult } from '../agents/BearingAgent';
import { dataService } from '../services/DataService';
import { bearingService } from '../services/BearingService';
import type { BearingRecord, BearingConditionStatus, BearingInspection, BearingGreaseLog } from '../services/BearingService';
import { authService } from '../services/AuthService';
import { taskService } from '../services/TaskService';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const SITE_ID_TO_PLANT_ID: Record<string, string> = {
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

function parseTurbineTemps(turbineData: any) {
  if (!turbineData || !turbineData.ek) return null;
  
  let valStr = '';
  // Looks in turbineData.ek for keys containing T82a1 or T48a (T82a2 contains power cabinets only)
  for (const key of Object.keys(turbineData.ek)) {
    const k = key.toLowerCase();
    if (k.includes('t82a1') || k.includes('t48a')) {
      valStr = turbineData.ek[key]?.v || '';
      break;
    }
  }

  if (!valStr) return null;

  const tVal = valStr.split(',');
  if (tVal.length < 25) return null;

  const spinner = tVal[1] ? parseFloat(tVal[1]) : null;
  const frontBearing = tVal[2] ? parseFloat(tVal[2]) : null;
  const rearBearing = tVal[3] ? parseFloat(tVal[3]) : null;
  const rotor1 = tVal[13] ? parseFloat(tVal[13]) : null;
  const rotor2 = tVal[14] ? parseFloat(tVal[14]) : null;
  const stator1 = tVal[15] ? parseFloat(tVal[15]) : null;
  const stator2 = tVal[16] ? parseFloat(tVal[16]) : null;
  const nacelle = tVal[18] ? parseFloat(tVal[18]) : (tVal[17] ? parseFloat(tVal[17]) : null);
  const ambient = tVal[24] ? parseFloat(tVal[24]) : null;

  if (frontBearing === null || isNaN(frontBearing) || rearBearing === null || isNaN(rearBearing)) {
    return null;
  }

  const deltaT = Number((rearBearing - frontBearing).toFixed(1));

  // 1 tek stator üzerinde 2 sensör (Stator 1, Stator 2) ve 1 tek rotor üzerinde 2 sensör (Rotor 1, Rotor 2)
  const validStators = [stator1, stator2].filter((v): v is number => v !== null && !isNaN(v));
  const avgStator = validStators.length > 0 ? Number((validStators.reduce((a, b) => a + b, 0) / validStators.length).toFixed(1)) : null;

  const validRotors = [rotor1, rotor2].filter((v): v is number => v !== null && !isNaN(v));
  const avgRotor = validRotors.length > 0 ? Number((validRotors.reduce((a, b) => a + b, 0) / validRotors.length).toFixed(1)) : null;

  return {
    spinner: spinner !== null && !isNaN(spinner) ? Number(spinner.toFixed(1)) : null,
    frontBearing: Number(frontBearing.toFixed(1)),
    rearBearing: Number(rearBearing.toFixed(1)),
    deltaT,
    rotor1: rotor1 !== null && !isNaN(rotor1) ? Number(rotor1.toFixed(1)) : null,
    rotor2: rotor2 !== null && !isNaN(rotor2) ? Number(rotor2.toFixed(1)) : null,
    rotor: avgRotor,
    stator1: stator1 !== null && !isNaN(stator1) ? Number(stator1.toFixed(1)) : null,
    stator2: stator2 !== null && !isNaN(stator2) ? Number(stator2.toFixed(1)) : null,
    stator: avgStator,
    nacelle: nacelle !== null && !isNaN(nacelle) ? Number(nacelle.toFixed(1)) : null,
    ambient: ambient !== null && !isNaN(ambient) ? Number(ambient.toFixed(1)) : null
  };
}

export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
}

export interface PeerCohortResult {
  cohortCount: number;
  cohortDescription: string;
  cohortRearMedian: number;
  cohortFrontMedian: number;
  cohortDeltaMedian: number;
  cohortStatorMedian: number | null;
  cohortRpmMedian: number | null;
  cohortPowerMedian: number | null;
  peerRearDev: number;
  peerDeltaDev: number;
  statorDev: number;
  generatorSensorAlert?: {
    hasAlert: boolean;
    sensorName: string;
    detail: string;
    code: string;
  } | null;
  diagnostic: {
    code: 'CONFIRMED' | 'SUSPICIOUS' | 'LOAD' | 'HEALTHY' | 'SENSOR_FAULT';
    title: string;
    confidence: number;
    color: string;
    badgeBg: string;
    badgeBorder: string;
    explanation: string;
    actionTitle: string;
    actionText: string;
    targetBearing: 'FRONT' | 'REAR' | 'BOTH';
    targetBearingText: string;
    recommendedKg: number;
    requiresWorkOrder: boolean;
    flushingRecommended: boolean;
    statorIsolated: boolean;
    isolationNote: string;
  };
}

// Helper to classify Enercon turbines into matching drivetrain / speed families
export const getModelFamily = (rawModel?: string): string => {
  if (!rawModel) return 'ENERCON';
  const clean = rawModel.toUpperCase().replace(/\s+/g, '').replace(/-/g, '');
  if (clean.includes('E44') || clean.includes('E48') || clean.includes('CS48') || clean.includes('44') || clean.includes('48')) return 'E-44/E-48';
  if (clean.includes('E70') || clean.includes('70')) return 'E-70';
  if (clean.includes('E82') || clean.includes('82')) return 'E-82';
  if (clean.includes('E92') || clean.includes('92')) return 'E-92';
  if (clean.includes('E40') || clean.includes('40')) return 'E-40';
  return rawModel;
};

export function calculatePeerCohortAndXRay(
  targetTurbineId: string,
  allTurbines: any[],
  thermalDataMap: Record<string, any>
): PeerCohortResult {
  const targetTurb = allTurbines.find(t => t.id === targetTurbineId);
  const targetThermal = thermalDataMap[targetTurbineId];

  const defaultResult: PeerCohortResult = {
    cohortCount: 0,
    cohortDescription: 'Akran bulunamadı',
    cohortRearMedian: targetThermal?.rearBearing ?? 0,
    cohortFrontMedian: targetThermal?.frontBearing ?? 0,
    cohortDeltaMedian: targetThermal?.deltaT ?? 0,
    cohortStatorMedian: targetThermal?.stator ?? null,
    cohortRpmMedian: targetThermal?.rotorSpeed ?? null,
    cohortPowerMedian: targetThermal?.powerKw ?? null,
    peerRearDev: 0,
    peerDeltaDev: 0,
    statorDev: 0,
    generatorSensorAlert: null,
    diagnostic: {
      code: 'HEALTHY',
      title: '🟢 DENGELİ / SAĞLAM',
      confidence: 80,
      color: '#00ff66',
      badgeBg: 'rgba(0, 255, 102, 0.08)',
      badgeBorder: 'rgba(0, 255, 102, 0.25)',
      explanation: 'Yeterli akran verisi yok, dahili rulman sıcaklık farkı izleniyor.',
      actionTitle: 'Rutin İzleme',
      actionText: 'Rulman sıcaklıkları rutin toleranslar dahilindedir.',
      targetBearing: 'BOTH',
      targetBearingText: 'Ön ve Arka Rulman',
      recommendedKg: 0,
      requiresWorkOrder: false,
      flushingRecommended: false,
      statorIsolated: false,
      isolationNote: ''
    }
  };

  if (!targetThermal || targetThermal.frontBearing === null || targetThermal.rearBearing === null) {
    return defaultResult;
  }

  const targetRear = targetThermal.rearBearing;
  const targetFront = targetThermal.frontBearing;
  const targetDelta = targetThermal.deltaT ?? Number((targetRear - targetFront).toFixed(1));
  const targetStator = targetThermal.stator;
  const targetRpm = targetThermal.rotorSpeed;
  const targetPower = targetThermal.powerKw;
  const targetFamily = getModelFamily(targetTurb?.model);

  // 1. Identify peer cohort across fleet with valid thermal data
  const candidatePeers = allTurbines.filter(t => {
    if (t.id === targetTurbineId) return false;
    const th = thermalDataMap[t.id];
    return th && th.frontBearing !== null && th.rearBearing !== null;
  });

  // Step A: Priority 1 - Match peers in SAME SITE with the SAME MODEL FAMILY (e.g. E-44/E-48 with E-44/E-48, E-70 with E-70, E-82 with E-82)
  const sameSiteSameFamily = candidatePeers.filter(t => 
    t.siteId === targetTurb?.siteId && getModelFamily(t.model) === targetFamily
  );

  let cohort: any[] = [];
  let cohortDesc = '';

  if (sameSiteSameFamily.length >= 2) {
    cohort = sameSiteSameFamily;
    cohortDesc = `${targetTurb?.siteName || 'Saha'} (${targetFamily})`;

    // If target has RPM, refine within ±3.0 RPM
    if (targetRpm !== null && targetRpm > 0) {
      const rpmMatched = sameSiteSameFamily.filter(t => {
        const th = thermalDataMap[t.id];
        return th.rotorSpeed !== null && Math.abs(th.rotorSpeed - targetRpm) <= 3.0;
      });
      if (rpmMatched.length >= 2) {
        cohort = rpmMatched;
        cohortDesc = `${targetTurb?.siteName || 'Saha'} (~${Math.round(targetRpm)} RPM Akranları)`;
      }
    }
  } else {
    // Step B: Unique turbine model in site (e.g. Sarıkaya T-15 where only 1 E-48 exists, while others are E-70/E-82)
    // Expand to SAME MODEL FAMILY across the ENTIRE FLEET
    const fleetSameFamily = candidatePeers.filter(t => getModelFamily(t.model) === targetFamily);

    if (fleetSameFamily.length >= 2) {
      cohort = fleetSameFamily;
      cohortDesc = `Filo Geneli ${targetFamily} Akranları`;

      // If target has RPM, match similar speed class across fleet (±3.5 RPM)
      if (targetRpm !== null && targetRpm > 0) {
        const rpmMatchedFleet = fleetSameFamily.filter(t => {
          const th = thermalDataMap[t.id];
          return th.rotorSpeed !== null && Math.abs(th.rotorSpeed - targetRpm) <= 3.5;
        });
        if (rpmMatchedFleet.length >= 2) {
          cohort = rpmMatchedFleet;
          cohortDesc = `Filo Geneli ${targetFamily} (~${Math.round(targetRpm)} RPM Akranları)`;
        }
      }
    } else {
      // Step C: Fallback to entire candidate fleet
      cohort = candidatePeers.length >= 2 ? candidatePeers : (targetTurb ? [targetTurb] : []);
      cohortDesc = `Filo Geneli Akranlar`;
    }
  }

  const cohortRears: number[] = [];
  const cohortFronts: number[] = [];
  const cohortDeltas: number[] = [];
  const cohortStators: number[] = [];
  const cohortRpms: number[] = [];
  const cohortPowers: number[] = [];

  cohort.forEach(t => {
    const th = thermalDataMap[t.id];
    if (th.rearBearing !== null) cohortRears.push(th.rearBearing);
    if (th.frontBearing !== null) cohortFronts.push(th.frontBearing);
    if (th.deltaT !== null) cohortDeltas.push(th.deltaT);
    if (th.stator !== null) cohortStators.push(th.stator);
    if (th.rotorSpeed !== null) cohortRpms.push(th.rotorSpeed);
    if (th.powerKw !== null) cohortPowers.push(th.powerKw);
  });

  const cohortRearMedian = cohortRears.length > 0 ? calculateMedian(cohortRears) : targetRear;
  const cohortFrontMedian = cohortFronts.length > 0 ? calculateMedian(cohortFronts) : targetFront;
  const cohortDeltaMedian = cohortDeltas.length > 0 ? calculateMedian(cohortDeltas) : targetDelta;
  const cohortStatorMedian = cohortStators.length > 0 ? calculateMedian(cohortStators) : (targetStator ?? null);
  const cohortRpmMedian = cohortRpms.length > 0 ? calculateMedian(cohortRpms) : (targetRpm ?? null);
  const cohortPowerMedian = cohortPowers.length > 0 ? calculateMedian(cohortPowers) : (targetPower ?? null);

  const peerRearDev = Number((targetRear - cohortRearMedian).toFixed(1));
  const peerDeltaDev = Number((targetDelta - cohortDeltaMedian).toFixed(1));
  const statorDev = (targetStator !== null && cohortStatorMedian !== null) ? Number((targetStator - cohortStatorMedian).toFixed(1)) : 0;

  // Stator İzolasyon Kontrolü (Akran Kıyaslamalı Isı Ayrıştırması):
  // Jeneratör yüke bindiğinde statör sargıları doğal olarak 85-100°C'ye ulaşır.
  // Sahadaki akran türbinlerin de statörleri benzer sıcaklıkta (~95°C) çalışırken akran arka rulman medyanı normal (örn. 33°C) kalıyorsa,
  // hedef türbinin arka rulmanındaki aşırı sıcaklık statörden değil doğrudan rulmanın mekanik sürtünmesinden / yağ bozulmasından kaynaklanır.
  let statorIsolated = true;
  let isolationNote = '';

  if (targetStator !== null && cohortStatorMedian !== null) {
    if (Math.abs(statorDev) <= 12) {
      statorIsolated = true;
      isolationNote = `Sahamızdaki diğer türbinlerde de benzer jeneratör statör sıcaklığı (~${cohortStatorMedian}°C) varken sahamızdaki diğer arka rulman sıcaklıkları ortalama ${cohortRearMedian}°C'dir. Hedef türbin arka rulmanı ise ${targetRear}°C'ye (sıcaklık farkı diğer türbinlere kıyasla +${peerRearDev}°C tespit edilmiştir) ulaşmıştır. Bu akran kıyaslaması, ısının jeneratörden değil doğrudan rulmandaki mekanik sürtünme / yağ film bozulmasından kaynaklandığını kesin olarak ispatlamaktadır.`;
    } else if (statorDev > 12) {
      statorIsolated = false;
      isolationNote = `Jeneratör statör sıcaklığı (${targetStator}°C) akran medyanından (+${statorDev}°C) belirgin derecede yüksektir; arka rulmana jeneratörden ilave termal iletim payı mevcuttur.`;
    } else {
      statorIsolated = true;
      isolationNote = `Statör sıcaklığı (${targetStator}°C) normal akran seviyesindedir. Isı jeneratörden yayılmamakta, rulman yatağında üretilmektedir.`;
    }
  } else {
    isolationNote = `Yeterli akran statör verisi bulunamadı; rulmanlar arası termal fark (ΔT: +${targetDelta}°C) baz alındı.`;
  }

  // 0. SENSÖR SAĞLIK KONTROLÜ (PT100 KOPUK / KISA DEVRE / SİNYAL HATASI TESPİTİ)
  const isFrontSensorFault = targetFront < -20 || targetFront > 115;
  const isRearSensorFault = targetRear < -20 || targetRear > 115;
  const isBearingSensorFault = isFrontSensorFault || isRearSensorFault;

  const isStator1Fault = targetThermal.stator1 !== null && targetThermal.stator1 !== undefined && (targetThermal.stator1 < -20 || targetThermal.stator1 > 165);
  const isStator2Fault = targetThermal.stator2 !== null && targetThermal.stator2 !== undefined && (targetThermal.stator2 < -20 || targetThermal.stator2 > 165);
  const isStatorDivergence = targetThermal.stator1 !== null && targetThermal.stator2 !== null && targetThermal.stator1 > 10 && targetThermal.stator2 > 10 && Math.abs(targetThermal.stator1 - targetThermal.stator2) > 40;
  const isRotor1Fault = targetThermal.rotor1 !== null && targetThermal.rotor1 !== undefined && (targetThermal.rotor1 < -20 || targetThermal.rotor1 > 160);
  const isRotor2Fault = targetThermal.rotor2 !== null && targetThermal.rotor2 !== undefined && (targetThermal.rotor2 < -20 || targetThermal.rotor2 > 160);
  const isRotorDivergence = targetThermal.rotor1 !== null && targetThermal.rotor2 !== null && targetThermal.rotor1 > 10 && targetThermal.rotor2 > 10 && Math.abs(targetThermal.rotor1 - targetThermal.rotor2) > 35;
  const isGeneratorSensorFault = isStator1Fault || isStator2Fault || isStatorDivergence || isRotor1Fault || isRotor2Fault || isRotorDivergence;

  let generatorSensorAlert: PeerCohortResult['generatorSensorAlert'] = null;
  if (isGeneratorSensorFault) {
    let gDetail = '';
    let gSensor = '';
    if (isRotorDivergence) {
      gSensor = 'Jeneratör Rotor Sensör Hattı';
      gDetail = `Rotor sensörleri arasında aşırı ayrışma var (R1: ${targetThermal.rotor1}°C, R2: ${targetThermal.rotor2}°C, Fark: ${Math.abs(targetThermal.rotor1! - targetThermal.rotor2!)}°C). PT100 sensör probu veya klemens kontrolü gereklidir.`;
    } else if (isRotor1Fault || isRotor2Fault) {
      gSensor = 'Jeneratör Rotor PT100 Sensörü';
      gDetail = `Rotor sensörü limit dışı değer okumaktadır (R1: ${targetThermal.rotor1}°C, R2: ${targetThermal.rotor2}°C).`;
    } else if (isStatorDivergence) {
      gSensor = 'Jeneratör Statör Sensör Hattı';
      gDetail = `Statör sensörleri arasında aşırı ayrışma var (S1: ${targetThermal.stator1}°C, S2: ${targetThermal.stator2}°C, Fark: ${Math.abs(targetThermal.stator1! - targetThermal.stator2!)}°C).`;
    } else {
      gSensor = 'Jeneratör Statör PT100 Sensörü';
      gDetail = `Statör sensörü limit dışı değer okumaktadır (S1: ${targetThermal.stator1}°C, S2: ${targetThermal.stator2}°C).`;
    }

    generatorSensorAlert = {
      hasAlert: true,
      sensorName: gSensor,
      detail: gDetail,
      code: 'GEN_SENSOR_FAULT'
    };
  }

  // YALNIZCA ÖN VEYA ARKA RULMAN SENSÖRÜ BOZUKSA RULMAN TEŞHİSİNİ KİLİTLE
  if (isBearingSensorFault) {
    const faultDetail = isRearSensorFault
      ? `Arka Rulman PT100 sensörü anormal uç değer okumaktadır (${targetRear}°C). Sensör kablosu açık devre (kopuk), kısa devre veya prob bozulmuştur.`
      : `Ön Rulman PT100 sensörü anormal uç değer okumaktadır (${targetFront}°C). Sensör kablosu açık devre (kopuk), kısa devre veya prob bozulmuştur.`;
    const faultBearingTarget = isRearSensorFault ? 'REAR' : 'FRONT';
    const faultBearingText = isRearSensorFault ? 'Arka Rulman PT100 Sensörü' : 'Ön Rulman PT100 Sensörü';

    return {
      cohortCount: cohort.length,
      cohortDescription: cohortDesc ? `${cohortDesc} (${cohort.length} Türbin)` : 'Akran bulunamadı',
      cohortRearMedian,
      cohortFrontMedian,
      cohortDeltaMedian,
      cohortStatorMedian,
      cohortRpmMedian,
      cohortPowerMedian,
      peerRearDev,
      peerDeltaDev,
      statorDev,
      generatorSensorAlert,
      diagnostic: {
        code: 'SENSOR_FAULT',
        title: '🔧 RULMAN SENSÖR ARIZASI (PT100 HATASI)',
        confidence: 99,
        color: '#d946ef',
        badgeBg: 'rgba(217, 70, 239, 0.12)',
        badgeBorder: 'rgba(217, 70, 239, 0.4)',
        explanation: `${faultDetail} Bu bir mekanik rulman hasarı değil, elektriksel sensör/kablo arızasıdır. Yanlış gres basılmamalı, doğrudan sensör değişim ve klemens kontrol görevi açılmalıdır.`,
        actionTitle: `${faultBearingText} Kontrolü & Sensör Değişimi Gerekli (0 kg Gres)`,
        actionText: `${faultDetail} Yanlış gres müdahalesini önlemek için gres önerisi 0 kg olarak kilitlenmiştir. Sensör değişim görevi açılmalıdır.`,
        targetBearing: faultBearingTarget,
        targetBearingText: faultBearingText,
        recommendedKg: 0,
        requiresWorkOrder: true,
        flushingRecommended: false,
        statorIsolated: false,
        isolationNote: 'Sensör arızası nedeniyle termal ölçüm güvenilir değildir.'
      }
    };
  }

  // Autonomous Diagnostic Engine Decision Tree
  let diagnosticCode: 'CONFIRMED' | 'SUSPICIOUS' | 'LOAD' | 'HEALTHY' | 'SENSOR_FAULT' = 'HEALTHY';
  let diagnosticTitle = '🟢 DENGELİ / SAĞLAM';
  let confidence = 92;
  let color = '#00ff66';
  let badgeBg = 'rgba(0, 255, 102, 0.08)';
  let badgeBorder = 'rgba(0, 255, 102, 0.25)';
  let explanation = '';
  let actionTitle = 'Rutin Takipte Kalın';
  let actionText = 'Rulman çalışma sıcaklıkları ve akran sapmaları normal toleranslar dahilindedir.';
  let targetBearing: 'FRONT' | 'REAR' | 'BOTH' = 'BOTH';
  let targetBearingText = 'Ön ve Arka Rulman';
  let recommendedKg = 0;
  let requiresWorkOrder = false;
  let flushingRecommended = false;

  const isExtremeDelta = targetDelta >= 11.0;
  const isPeerAnomalous = targetDelta >= 8.0 && (peerRearDev >= 5.0 || peerDeltaDev >= 4.5);
  const isIdleHot = (targetRpm !== null && targetRpm < 8.0) && targetRear >= 38.0 && targetDelta >= 7.0;

  if (isExtremeDelta || isPeerAnomalous || isIdleHot) {
    diagnosticCode = 'CONFIRMED';
    diagnosticTitle = '🚨 KANITLANMIŞ RULMAN SİNYALİ';
    confidence = isExtremeDelta ? 98 : (isPeerAnomalous ? 95 : 91);
    color = '#ff3b30';
    badgeBg = 'rgba(255, 59, 48, 0.12)';
    badgeBorder = 'rgba(255, 59, 48, 0.35)';
    targetBearing = targetDelta > 0 ? 'REAR' : 'FRONT';
    targetBearingText = targetDelta > 0 ? 'Arka Rulman' : 'Ön Rulman';
    recommendedKg = isExtremeDelta ? 6.5 : 5.5;
    requiresWorkOrder = true;
    flushingRecommended = true;
    actionTitle = `${targetBearingText} Acil Rulman Flushing + ${recommendedKg} kg Taze Gres`;
    
    let reasonDetail = '';
    if (isPeerAnomalous) {
      reasonDetail = `Türbin sahadaki akranlarıyla benzer devirde (~${targetRpm || cohortRpmMedian || 12} RPM) çalışmasına rağmen arka rulman akran medyanından +${peerRearDev}°C daha sıcaktır. Rulmanlar arası fark (ΔT: +${targetDelta}°C) toleransın (>4°C) çok üzerindedir.`;
    } else if (isIdleHot) {
      reasonDetail = `Türbin düşük devirde / rölantide (~${targetRpm} RPM) çalışmasına rağmen arka rulman soğuyamamakta ve anormal sıcak (+${targetRear}°C, ΔT: +${targetDelta}°C) kalmaktadır.`;
    } else {
      reasonDetail = `Rulmanlar arası termal fark (ΔT: +${targetDelta}°C) aşırı mekanik sürtünme veya çapak birikimini kesinleştirmektedir.`;
    }
    
    explanation = `${reasonDetail} ${statorIsolated ? isolationNote : (isolationNote || '')} Enercon D02980100 standardı uyarınca acil flushing ve numune alımı gereklidir.`;
    actionText = explanation;
  } else if ((targetDelta >= 5.0 && targetDelta < 8.0) || (peerRearDev >= 3.0 && peerRearDev < 5.0)) {
    diagnosticCode = 'SUSPICIOUS';
    diagnosticTitle = '🟡 ŞÜPHELİ ISINMA / GRES İHTİYACI';
    confidence = 85;
    color = '#ffcc00';
    badgeBg = 'rgba(255, 204, 0, 0.08)';
    badgeBorder = 'rgba(255, 204, 0, 0.25)';
    targetBearing = targetDelta > 0 ? 'REAR' : 'FRONT';
    targetBearingText = targetDelta > 0 ? 'Arka Rulman' : 'Ön Rulman';
    recommendedKg = 2.5;
    requiresWorkOrder = false;
    flushingRecommended = false;
    actionTitle = `${targetBearingText} 2.5 - 3 kg Gres Takviyesi Önerilir`;
    explanation = `Rulman sıcaklık farkı (ΔT: +${targetDelta}°C) veya akran sapması (+${peerRearDev}°C) sürtünme başlangıcına veya viskozite kaybına işaret etmektedir. Arka rulmana 2.5 kg taze gres basılarak termal tepki izlenmelidir.`;
    actionText = explanation;
  } else if (targetRear >= 48.0 && targetDelta < 5.0 && peerRearDev < 3.0 && ((targetStator !== null && targetStator >= 55.0) || (targetPower !== null && targetPower > 1400))) {
    diagnosticCode = 'LOAD';
    diagnosticTitle = '⚡ YÜK KAYNAKLI ISINMA (SAĞLAM)';
    confidence = 90;
    color = '#00f2fe';
    badgeBg = 'rgba(0, 242, 254, 0.08)';
    badgeBorder = 'rgba(0, 242, 254, 0.25)';
    targetBearing = 'BOTH';
    targetBearingText = 'Ön ve Arka Rulman';
    recommendedKg = 0;
    requiresWorkOrder = false;
    flushingRecommended = false;
    actionTitle = 'Rutin İzleme (Yüksek Jeneratör Yükü)';
    explanation = `Rulman sıcaklığı (${targetRear}°C) yüksek olmakla birlikte ön/arka farkı (ΔT: ${targetDelta > 0 ? '+' : ''}${targetDelta}°C) ve akran sapması (+${peerRearDev}°C) dengelidir. Stator (${targetStator}°C) ve yüksek güç (${targetPower} kW) kaynaklı homojen ısınma mevcuttur.`;
    actionText = explanation;
  } else {
    diagnosticCode = 'HEALTHY';
    diagnosticTitle = '🟢 DENGELİ / SAĞLAM';
    confidence = 95;
    color = '#00ff66';
    badgeBg = 'rgba(0, 255, 102, 0.08)';
    badgeBorder = 'rgba(0, 255, 102, 0.25)';
    targetBearing = 'BOTH';
    targetBearingText = 'Ön ve Arka Rulman';
    recommendedKg = 0;
    requiresWorkOrder = false;
    flushingRecommended = false;
    actionTitle = 'Rutin Takip';
    explanation = `Rulman sıcaklık farkı (ΔT: ${targetDelta > 0 ? '+' : ''}${targetDelta}°C) ve akran sapması (+${peerRearDev}°C) normal limitler içindedir (ΔT ≤ 4°C). Rulman yağlanması stabildir.`;
    actionText = explanation;
  }

  return {
    cohortCount: cohort.length,
    cohortDescription: cohortDesc ? `${cohortDesc} (${cohort.length} Türbin)` : 'Akran bulunamadı',
    cohortRearMedian,
    cohortFrontMedian,
    cohortDeltaMedian,
    cohortStatorMedian,
    cohortRpmMedian,
    cohortPowerMedian,
    peerRearDev,
    peerDeltaDev,
    statorDev,
    generatorSensorAlert,
    diagnostic: {
      code: diagnosticCode,
      title: diagnosticTitle,
      confidence,
      color,
      badgeBg,
      badgeBorder,
      explanation,
      actionTitle,
      actionText,
      targetBearing,
      targetBearingText,
      recommendedKg,
      requiresWorkOrder,
      flushingRecommended,
      statorIsolated,
      isolationNote
    }
  };
}

export function getBearingThermalRecommendation(front: number, rear: number) {
  const deltaT = Number((rear - front).toFixed(1));
  const absDelta = Math.abs(deltaT);

  if (absDelta < 5) {
    return {
      severity: 'NORMAL' as const,
      color: '#00ff66',
      badgeBg: 'rgba(0, 255, 102, 0.08)',
      badgeBorder: 'rgba(0, 255, 102, 0.25)',
      statusText: 'DENGELİ / SAĞLAM',
      targetBearing: 'BOTH' as const,
      targetBearingText: 'Ön ve Arka Rulman',
      recommendedKg: 0,
      actionTitle: 'Rutin Takipte Kalın',
      actionText: 'Rulman sıcaklık farkı normal tolerans içinde (ΔT < 5°C). Acil gres müdahalesi gerekmemektedir.',
      requiresWorkOrder: false,
      flushingRecommended: false
    };
  }

  if (deltaT >= 5 && deltaT < 10) {
    return {
      severity: 'WARNING' as const,
      color: '#ffcc00',
      badgeBg: 'rgba(255, 204, 0, 0.08)',
      badgeBorder: 'rgba(255, 204, 0, 0.25)',
      statusText: 'DİKKAT / GRES TAKVİYESİ',
      targetBearing: 'REAR' as const,
      targetBearingText: 'Arka Rulman',
      recommendedKg: 2.5,
      actionTitle: 'Arka Rulmana 2-3 kg Gres Basılması Önerilir',
      actionText: `Arka rulman ön rulmana göre +${deltaT}°C daha sıcak. Sürtünmeyi azaltmak için arka rulmana 2-3 kg taze gres basılması önerilir.`,
      requiresWorkOrder: false,
      flushingRecommended: false
    };
  }

  if (deltaT >= 10 && deltaT < 15) {
    return {
      severity: 'CRITICAL' as const,
      color: '#ff9f43',
      badgeBg: 'rgba(255, 159, 67, 0.1)',
      badgeBorder: 'rgba(255, 159, 67, 0.3)',
      statusText: 'KRİTİK / FLUSHING ÖNERİLİR',
      targetBearing: 'REAR' as const,
      targetBearingText: 'Arka Rulman',
      recommendedKg: 5.5,
      actionTitle: 'Arka Rulmana Flushing + 5-6 kg Gres',
      actionText: `Arka rulmanda anormal ısınma (ΔT: +${deltaT}°C). Enercon D02980100 standardı uyarınca Rulman Flushing ve 5-6 kg taze gres basılması önerilir.`,
      requiresWorkOrder: true,
      flushingRecommended: true
    };
  }

  if (deltaT >= 15) {
    return {
      severity: 'EMERGENCY' as const,
      color: '#ff3b30',
      badgeBg: 'rgba(255, 59, 48, 0.12)',
      badgeBorder: 'rgba(255, 59, 48, 0.4)',
      statusText: '🚨 ACİL FLUSHING & NUMUNE',
      targetBearing: 'REAR' as const,
      targetBearingText: 'Arka Rulman',
      recommendedKg: 7.0,
      actionTitle: 'Acil Flushing + Numune Alımı + 6-8 kg Gres',
      actionText: `Arka rulmanda aşırı termal stres (ΔT: +${deltaT}°C)! Çapak/hasar şüphesi. Acil flushing iş emri açılmalı, 6-8 kg gres basılmalı ve numune alınmalıdır.`,
      requiresWorkOrder: true,
      flushingRecommended: true
    };
  }

  // DeltaT is negative (Front bearing hotter than rear)
  if (deltaT <= -10) {
    return {
      severity: 'CRITICAL' as const,
      color: '#ff3b30',
      badgeBg: 'rgba(255, 59, 48, 0.12)',
      badgeBorder: 'rgba(255, 59, 48, 0.4)',
      statusText: 'ÖN RULMAN KRİTİK SICAK',
      targetBearing: 'FRONT' as const,
      targetBearingText: 'Ön Rulman',
      recommendedKg: 5.5,
      actionTitle: 'Ön Rulmana Flushing + 5-6 kg Gres',
      actionText: `Ön rulman arka rulmandan belirgin derecede sıcak (ΔT: ${deltaT}°C). Ön rulmana flushing uygulanmalı ve 5-6 kg gres basılmalıdır.`,
      requiresWorkOrder: true,
      flushingRecommended: true
    };
  }

  return {
    severity: 'WARNING' as const,
    color: '#ffcc00',
    badgeBg: 'rgba(255, 204, 0, 0.08)',
    badgeBorder: 'rgba(255, 204, 0, 0.25)',
    statusText: 'ÖN RULMAN ISINMA EĞİLİMİ',
    targetBearing: 'FRONT' as const,
    targetBearingText: 'Ön Rulman',
    recommendedKg: 2.5,
    actionTitle: 'Ön Rulmana 2-3 kg Gres Basılması Önerilir',
    actionText: `Ön rulman arka rulmana göre daha sıcak (ΔT: ${deltaT}°C). Ön rulmana 2-3 kg gres takviyesi yapılması önerilir.`,
    requiresWorkOrder: false,
    flushingRecommended: false
  };
}

export function compareTurbinesByNumber(
  a: { no?: number; turbineNo?: string; name: string; siteName?: string },
  b: { no?: number; turbineNo?: string; name: string; siteName?: string },
  groupBySite = false
): number {
  if (groupBySite && a.siteName && b.siteName && a.siteName !== b.siteName) {
    return a.siteName.localeCompare(b.siteName, 'tr');
  }
  const numA = (a.no !== undefined && a.no !== null && !isNaN(Number(a.no)))
    ? Number(a.no)
    : parseInt((a.turbineNo || a.name || '').replace(/\D/g, '') || '0', 10);
  const numB = (b.no !== undefined && b.no !== null && !isNaN(Number(b.no)))
    ? Number(b.no)
    : parseInt((b.turbineNo || b.name || '').replace(/\D/g, '') || '0', 10);

  if (numA !== 0 && numB !== 0 && numA !== numB) {
    return numA - numB;
  }
  return (a.turbineNo || a.name).localeCompare(b.turbineNo || b.name, 'tr', { numeric: true });
}

export const BearingAnalysisPage = async () => {
  const sites = dataService.getSortedSites();
  const allTurbines: { id: string; name: string; turbineNo: string; model: string; siteId: string; siteName: string; no?: number }[] = [];
  
  sites.forEach(site => {
    const siteTurbines = dataService.getTurbinesBySite(site.id) || [];
    siteTurbines.forEach(t => {
      // Exclude non-turbine communications / RTU units
      if (t.label === 'RTU' || t.label === 'FCU' || t.label === 'SAI') return;
      const tNoStr = (t.no !== undefined && t.no !== null && (t.no as any) !== '') ? `T-${String(t.no).padStart(2, '0')}` : '';
      const displayLabel = t.label ? t.label : (tNoStr || `T-${t.id}`);
      const modelName = t.type ? (t.type.startsWith('E') ? t.type : `E-${t.type}`) : 'Enercon';

      allTurbines.push({
        id: t.id,
        name: displayLabel,
        turbineNo: tNoStr || displayLabel,
        model: modelName,
        siteId: site.id,
        siteName: site.name,
        no: t.no
      });
    });
  });

  // Türbinleri santral ve türbin numarasına göre tertipli sırala
  allTurbines.sort((a, b) => compareTurbinesByNumber(a, b, true));

  // Global state for fleet filter
  (window as any).currentFleetTurbines = allTurbines;
  (window as any).currentFleetFilter = 'ALL';

  return `
    <div class="fade-in-up content-area" style="font-size: 0.9rem; color: #a0a5b0; max-width: 100% !important; width: 100% !important; padding: 1rem 1.5rem 4rem 1.5rem; box-sizing: border-box;">
      <!-- Premium Title Banner -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 class="page-title" style="margin: 0 0 0.5rem 0; font-size: 1.5rem; font-family: 'Rajdhani', sans-serif; font-weight: 800; letter-spacing: 1px;">
            <i class="fa-solid fa-microchip" style="color: var(--accent-cyan); margin-right: 10px;"></i> Rulman Filo Sağlığı & Karar Destek Ajanı
          </h1>
          <p style="color: #8a8f98; margin: 0; font-size: 0.9rem;">
            ENERCON standartlarına (TD-esc-07, D03220088/0.0 & D02980100) uyumlu ön rulman değişimi, metal çapak/aşınma izleme ve otonom teşhis merkezi.
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <button onclick="window.openBearingEditModal('')" class="cyber-button" style="background: rgba(0, 242, 254, 0.1); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); padding: 0.5rem 1rem; border-radius: 6px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-plus"></i> Durum Güncelle / Kayıt Ekle
          </button>
          <div style="background: rgba(0, 242, 254, 0.03); border: 1px solid rgba(0, 242, 254, 0.15); padding: 0.5rem 1rem; border-radius: 8px; display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #00ff66; box-shadow: 0 0 8px #00ff66;"></span>
            <span style="font-family: 'Rajdhani', sans-serif; font-weight: 700; color: var(--accent-cyan); font-size: 0.9rem; letter-spacing: 0.5px;">AJAN AKTİF / ONLINE</span>
          </div>
        </div>
      </div>

      <!-- Tab Navigation Menu -->
      <div style="display: flex; gap: 10px; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px; overflow-x: auto; white-space: nowrap;">
        <button id="tab-btn-thermal" class="tab-nav-btn active" onclick="window.switchBearingTab('thermal')">
          <i class="fa-solid fa-temperature-arrow-up" style="margin-right: 8px; color: #ff9f43;"></i> 1. Sıcaklık Analiz Merkezi & Gres Takip
        </button>
        <button id="tab-btn-acoustics" class="tab-nav-btn" onclick="window.switchBearingTab('acoustics')">
          <i class="fa-solid fa-microphone-lines" style="margin-right: 8px;"></i> 2. Akustik Ses Analizi
        </button>
        <button id="tab-btn-history" class="tab-nav-btn" onclick="window.switchBearingTab('history')">
          <i class="fa-solid fa-clipboard-list" style="margin-right: 8px;"></i> 3. Saha Analiz Kayıtları & Geçmiş (Tarihçe)
        </button>
        <button id="tab-btn-grease" class="tab-nav-btn" onclick="window.switchBearingTab('grease')">
          <i class="fa-solid fa-flask" style="margin-right: 8px;"></i> 4. Gres Laboratuvarı & RAG Eşleştirici
        </button>
        <button id="tab-btn-fleet" class="tab-nav-btn" onclick="window.switchBearingTab('fleet')">
          <i class="fa-solid fa-shield-halved" style="margin-right: 8px; color: var(--accent-cyan);"></i> 5. Rulman Filo Sağlığı & Takip Paneli
        </button>
      </div>

      <!-- ========================================== -->
      <!-- TAB 5: FLEET HEALTH & BEARING STATUS FILTER -->
      <!-- ========================================== -->
      <div id="bearing-tab-fleet" class="bearing-tab-content" style="display: none;">
        
        <!-- KPI Özet Sayaçları (4 Kart) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          
          <!-- Toplam Türbin -->
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 10px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(0, 242, 254, 0.15); display: flex; align-items: center; gap: 1rem;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(0, 242, 254, 0.1); display: flex; align-items: center; justify-content: center; color: var(--accent-cyan); font-size: 1.25rem;">
              <i class="fa-solid fa-wind"></i>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #8a8f98; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Toplam İzlenen</div>
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.6rem; font-weight: 800; color: #fff; line-height: 1.1;" id="kpi-count-total">${allTurbines.length}</div>
            </div>
          </div>

          <!-- Ön Rulmanı Değişenler -->
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 10px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(168, 85, 247, 0.25); display: flex; align-items: center; gap: 1rem; cursor: pointer; transition: transform 0.2s;" onclick="window.setFleetFilter('REPLACED')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(168, 85, 247, 0.12); display: flex; align-items: center; justify-content: center; color: #c084fc; font-size: 1.25rem;">
              <i class="fa-solid fa-arrows-rotate"></i>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #c084fc; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Ön Rulmanı Değişen</div>
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.6rem; font-weight: 800; color: #fff; line-height: 1.1;" id="kpi-count-replaced">0</div>
            </div>
          </div>

          <!-- Metal Çapak / Aşınma Takibinde -->
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 10px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(239, 68, 68, 0.25); display: flex; align-items: center; gap: 1rem; cursor: pointer; transition: transform 0.2s;" onclick="window.setFleetFilter('METAL')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(239, 68, 68, 0.12); display: flex; align-items: center; justify-content: center; color: #f87171; font-size: 1.25rem;">
              <i class="fa-solid fa-magnet"></i>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #f87171; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Çapak Takibinde</div>
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.6rem; font-weight: 800; color: #fff; line-height: 1.1;" id="kpi-count-metal">0</div>
            </div>
          </div>

          <!-- Sağlam / Temiz -->
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 10px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(0, 230, 118, 0.2); display: flex; align-items: center; gap: 1rem; cursor: pointer; transition: transform 0.2s;" onclick="window.setFleetFilter('HEALTHY')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(0, 230, 118, 0.1); display: flex; align-items: center; justify-content: center; color: #00e676; font-size: 1.25rem;">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #81c784; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Sağlam / Normal</div>
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.6rem; font-weight: 800; color: #fff; line-height: 1.1;" id="kpi-count-healthy">${allTurbines.length}</div>
            </div>
          </div>

        </div>

        <!-- Filtre ve Arama Çubuğu -->
        <div class="glass-panel" style="padding: 1rem 1.2rem; border-radius: 12px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(10px); margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
          
          <!-- Filtre Butonları Grubu -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="fleet-filter-btn-group">
            <button class="fleet-filter-btn active" data-filter="ALL" onclick="window.setFleetFilter('ALL')">
              <i class="fa-solid fa-globe"></i> TÜMÜ (<span id="btn-count-all">${allTurbines.length}</span>)
            </button>
            <button class="fleet-filter-btn" data-filter="REPLACED" onclick="window.setFleetFilter('REPLACED')">
              <i class="fa-solid fa-arrows-rotate" style="color: #c084fc;"></i> ÖN RULMANI DEĞİŞENLER (<span id="btn-count-replaced">0</span>)
            </button>
            <button class="fleet-filter-btn" data-filter="METAL" onclick="window.setFleetFilter('METAL')">
              <i class="fa-solid fa-magnet" style="color: #f87171;"></i> ÇAPAK TAKİBİNDE (<span id="btn-count-metal">0</span>)
            </button>
            <button class="fleet-filter-btn" data-filter="HEALTHY" onclick="window.setFleetFilter('HEALTHY')">
              <i class="fa-solid fa-circle-check" style="color: #00e676;"></i> SAĞLAM (<span id="btn-count-healthy">${allTurbines.length}</span>)
            </button>
          </div>

          <!-- Sağ Taraf: Santral Seçimi & Arama -->
          <div style="display: flex; align-items: center; gap: 10px; flex-grow: 1; justify-content: flex-end; min-width: 280px;">
            <select id="fleet-site-filter" onchange="window.handleFleetFilterChange()" style="height: 36px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none;">
              <option value="ALL" style="background: #0b0f19;">🌐 Tüm Sahalar (${sites.length} Santral)</option>
              ${sites.map(s => `<option value="${s.id}" style="background: #0b0f19;">${s.name} (${s.turbineCount} Türbin)</option>`).join('')}
            </select>

            <div style="position: relative; width: 220px;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #8a8f98; font-size: 0.8rem;"></i>
              <input id="fleet-search-input" oninput="window.handleFleetFilterChange()" type="text" placeholder="Türbin ara (T-01, Seri No...)" style="height: 36px; width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding-left: 30px; padding-right: 10px; font-size: 0.85rem; outline: none;">
            </div>
          </div>

        </div>

        <!-- Türbin Kartları Grid'i -->
        <div id="fleet-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 1rem;">
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #8a8f98;">
            <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color: var(--accent-cyan); margin-bottom: 0.5rem;"></i>
            <div>Rulman kayıtları yükleniyor...</div>
          </div>
        </div>

      </div>

      <!-- ========================================== -->
      <!-- TAB 2: ACOUSTICS & PORTABLE VIBRATION -->
      <!-- ========================================== -->
      <div id="bearing-tab-acoustics" class="bearing-tab-content" style="display: none;">
        
        <!-- Turbine Selection Banner -->
        <div class="glass-panel" style="padding: 1.2rem; border-radius: 12px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(10px); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-wind" style="color: var(--accent-cyan); font-size: 1.2rem;"></i>
            <span style="font-family: 'Rajdhani', sans-serif; font-weight: 700; color: #fff; font-size: 1rem;">HEDEF TÜRBİN SEÇİMİ:</span>
          </div>
          <div style="flex-grow: 1;">
            <select id="analysis-turbine-select" style="height: 38px; width: 100%; max-width: 450px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.9rem; outline: none; font-family: inherit;">
              ${allTurbines.map(t => `<option value="${t.id}" style="background: #0b0f19; color: #fff;">${t.siteName} - ${t.name} (Seri: ${t.id})</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Live Audio Recording Box (Centered / Max Width) -->
        <div class="glass-panel" style="max-width: 820px; margin: 0 auto; padding: 2rem; border-radius: 12px; background: rgba(10, 15, 24, 0.7); border: 1px solid rgba(0, 242, 254, 0.15); backdrop-filter: blur(10px);">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="margin: 0; font-size: 1.25rem; font-family: 'Rajdhani', sans-serif; color: #fff; font-weight: 800; border-left: 3px solid var(--accent-cyan); padding-left: 10px; letter-spacing: 0.5px;">
              AKUSTİK SES ANALİZİ (CANLI SAHA KAYDI)
            </h3>
            <i class="fa-solid fa-wave-square" style="color: var(--accent-cyan); font-size: 1.3rem;"></i>
          </div>
          
          <p style="color: #cbd0d8; margin: 0 0 1.2rem 0; font-size: 0.9rem; line-height: 1.5;">
            Telefon mikrofonu yardımıyla ana rulmandan ses kaydı alınır. Yapay zeka ve spektral algoritmalar rulman frekans anomalilerini, vuruntu (knocks) ve sürtünme izlerini otomatik teşhis eder.
          </p>

          <!-- Field Practical Advice Banner -->
          <div style="background: rgba(0, 242, 254, 0.04); border: 1px solid rgba(0, 242, 254, 0.18); border-radius: 8px; padding: 1rem 1.2rem; margin-bottom: 1.8rem; display: flex; align-items: flex-start; gap: 12px;">
            <i class="fa-solid fa-lightbulb" style="color: var(--accent-cyan); font-size: 1.2rem; margin-top: 2px;"></i>
            <div style="font-size: 0.85rem; color: #cbd0d8; line-height: 1.45;">
              <strong style="color: #fff;">Sahada En Temiz Ölçüm İçin:</strong>
              Telefonu axel pin / rulman kapağına <span style="color: var(--accent-cyan); font-weight: 700;">10-15 cm mesafede havada tutunuz</span> veya doğrudan bırakılacaksa altına bir <span style="color: var(--accent-cyan); font-weight: 700;">eldiven/bez</span> koyunuz. Türbin gövdesi sabitken (rüzgara dönmüyorken) kayıt alınız.
            </div>
          </div>

          <!-- Canlı Ses Kaydet Button -->
          <button id="live-audio-btn" onclick="window.startLiveAudioRecording()" style="height: 50px; width: 100%; background: rgba(0, 242, 254, 0.1); border: 1px solid var(--accent-cyan); border-radius: 8px; color: #fff; font-size: 1rem; font-weight: 800; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 10px; font-family: inherit; position: relative; outline: none; box-shadow: 0 0 15px rgba(0, 242, 254, 0.15);">
            <i class="fa-solid fa-microphone" id="mic-icon" style="color: var(--accent-cyan); font-size: 1.2rem;"></i>
            <span id="mic-text">Canlı Ses Kaydet (1 Dk)</span>
          </button>

          <!-- Acoustic Output Area -->
          <div id="acoustic-result-area" class="hidden-result" style="display: none; background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 1.2rem; animation: fadeIn 0.4s ease; margin-top: 1.5rem;">
            <div id="acoustic-loader" style="text-align: center; padding: 1.5rem 0;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.8rem; color: var(--accent-cyan); margin-bottom: 0.6rem;"></i>
              <div style="font-size: 0.85rem; color: #cbd0d8;">Akustik spektrum taranıyor, rulman hasar frekansları analiz ediliyor...</div>
            </div>
            <div id="acoustic-content" style="display: none;"></div>
          </div>

        </div>
      </div>

      <!-- ========================================== -->
      <!-- TAB 3: GREASE LAB & RAG DECISION CENTRE -->
      <!-- ========================================== -->
      <div id="bearing-tab-grease" class="bearing-tab-content" style="display: none;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
          
          <!-- Column 3.1: Input Parameters -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.8rem; margin-bottom: 0.5rem;">
              <h3 style="margin: 0; font-size: 1.1rem; font-family: 'Rajdhani', sans-serif; color: #fff; font-weight: 700; border-left: 3px solid var(--accent-magenta); padding-left: 10px;">
                GRES FİZİKSEL & KİMYASAL BULGULARI
              </h3>
              <i class="fa-solid fa-microscope" style="color: var(--accent-magenta); font-size: 1.1rem;"></i>
            </div>

            <!-- Chemical measurements -->
            <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.04); display: flex; flex-direction: column; gap: 0.8rem;">
              <div style="font-weight: 700; color: #fff; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">1. Laboratuvar Kimyasal Eşikleri</div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Fe (Demir) Miktarı (ppm)</label>
                  <input id="grease-fe-ppm" type="number" value="180" style="height: 36px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                  <span style="font-size: 0.7rem; color: #8a8f98;">Enercon Limiti: &lt; 3000 ppm</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">PQ İndeksi</label>
                  <input id="grease-pq-index" type="number" value="45" style="height: 36px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                  <span style="font-size: 0.7rem; color: #8a8f98;">Enercon Limiti: &lt; 300</span>
                </div>
              </div>

              <!-- VRing invalidation check -->
              <div style="display: flex; align-items: center; gap: 10px; background: rgba(255, 59, 48, 0.05); padding: 0.6rem 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 59, 48, 0.15); margin-top: 5px;">
                <input id="grease-is-vring" type="checkbox" style="width: 16px; height: 16px; accent-color: #ff3b30; cursor: pointer;">
                <div>
                  <label for="grease-is-vring" style="font-size: 0.8rem; color: #ff8e89; font-weight: 700; cursor: pointer; display: block;">Sızıntı gresi mi? (V-Halkası)</label>
                  <span style="font-size: 0.7rem; color: #ff8e89; opacity: 0.8;">V-Ring sızıntı alanından toplanan numuneler geçersiz sayılır!</span>
                </div>
              </div>
            </div>

            <!-- Visual damage descriptors -->
            <div style="background: rgba(255,255,255,0.01); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); display: flex; flex-direction: column; gap: 0.8rem;">
              <div style="font-weight: 700; color: #fff; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">2. Fiziksel / Görsel Bulgular (RAG Sınıfları)</div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Renk ve Görünüm</label>
                  <select id="grease-color" style="height: 38px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
                    <option value="eski_net">Kırmızı (Mobil SHC 460 WT) - Temiz</option>
                    <option value="koyu_kırmızı">Koyu kırmızı ila kahverengi - Hafif yıpranmış</option>
                    <option value="gri_yesil">Bej (Mobil SHC 461 WT) - Griye çalan</option>
                    <option value="kahverengi_antrasit">Sarı (Klüberplex BEM 41-141) - Antrasit çalan</option>
                    <option value="siyah">Antrasit ila siyah - Kirli</option>
                    <option value="pirinc">Pirinç rengi / Altın sarısı metalik</option>
                    <option value="siyah_kırık">Katran siyahı ve metalik kırıklar</option>
                  </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Manyetizma Kriteri (Mıknatıs Testi)</label>
                  <select id="grease-magnetism" style="height: 38px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
                    <option value="manyetik_degil">Manyetik Değil (Çekim Yok - Sağlam)</option>
                    <option value="hafif_manyetik">Hafif Manyetik</option>
                    <option value="manyetik">Manyetik (Belirgin Çekim ⚠️)</option>
                    <option value="cok_manyetik">Çok Manyetik (Ciddi Mıknatıslanma 🚨)</option>
                  </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Metal Parçacık Boyutu</label>
                  <select id="grease-particles" style="height: 38px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
                    <option value="parlaklik">Çok ince bir metalik parlaklık</option>
                    <option value="tek_parcacık">Tekil / İzole metal parçacıklar</option>
                    <option value="cok_sayıda">Çok sayıda küçük metal parçacık</option>
                    <option value="zorlukla_ayirt_edilen">Çok sayıda, zorlukla ayırt edilen mikro parçacık</option>
                    <option value="kırık_yatak">Yatak parçaları ve makro eleman kırılması</option>
                  </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Viskozite / Akışkanlık</label>
                  <select id="grease-viscosity" style="height: 38px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
                    <option value="normal">Normal Akışkanlık (Viskozite kaybı yok)</option>
                    <option value="hafif_akıskan">Hafif viskozite değişimi</option>
                    <option value="artan_koyu">Koyulaşmış gres (Artan viskozite)</option>
                    <option value="katılasmıs_yanık">Katılaşmış gres yapısı / Yanık kokusu</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Hidden File Input -->
            <input type="file" id="grease-photo-input" accept="image/*" style="display: none;" onchange="window.handleGreasePhotoUpload(event)">

            <!-- Upload Photo Box -->
            <div id="photo-upload-box" style="border: 2px dashed rgba(240, 18, 190, 0.25); background: rgba(240, 18, 190, 0.02); border-radius: 8px; padding: 1.5rem; text-align: center; cursor: pointer; transition: all 0.3s;" onclick="document.getElementById('grease-photo-input').click()">
              <i class="fa-solid fa-camera-retro" style="font-size: 1.8rem; color: var(--accent-magenta); margin-bottom: 0.5rem; opacity: 0.9;"></i>
              <div style="font-weight: 700; color: #fff; font-size: 0.85rem; margin-bottom: 2px;">Gres Fotoğrafı / Laboratuvar Raporunu Seç</div>
              <div style="font-size: 0.75rem; color: #8a8f98; margin-bottom: 8px;">Kameradan canlı çekin veya galeri/dosya seçin</div>
              <div id="uploaded-photo-preview-container" style="display: none; margin-top: 10px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); position: relative;">
                <img id="uploaded-photo-preview" src="" style="max-height: 120px; width: 100%; object-fit: cover;">
                <button type="button" onclick="event.stopPropagation(); window.removeUploadedGreasePhoto();" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 24px; height: 24px; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; outline: none;">
                  <i class="fa-solid fa-xmark" style="font-size: 0.8rem;"></i>
                </button>
              </div>
            </div>

            <!-- Run RAG Match / Analyze button -->
            <button id="grease-analyze-btn" onclick="window.triggerGreaseAnalysis()" style="height: 42px; width: 100%; background: rgba(240, 18, 190, 0.12); border: 1px solid rgba(240, 18, 190, 0.3); border-radius: 6px; color: #fff; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: inherit; margin-top: 5px; outline: none;">
              <i class="fa-solid fa-wand-magic-sparkles"></i> RAG Karar Motorunu Çalıştır
            </button>
          </div>

          <!-- Column 3.2: RAG Output -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); display: flex; flex-direction: column; justify-content: flex-start; min-height: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.8rem; margin-bottom: 1rem;">
              <h3 style="margin: 0; font-size: 1.1rem; font-family: 'Rajdhani', sans-serif; color: #fff; font-weight: 700; border-left: 3px solid var(--accent-cyan); padding-left: 10px;">
                OTONOM RAG TEŞHİS RAPORU
              </h3>
              <i class="fa-solid fa-clipboard-list" style="color: var(--accent-cyan); font-size: 1.1rem;"></i>
            </div>

            <!-- Grease Output Area -->
            <div id="grease-result-area" class="hidden-result" style="display: none; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 1.2rem; animation: fadeIn 0.4s ease; flex-grow: 1;">
              <div id="grease-loader" style="text-align: center; padding: 3rem 0;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-magenta); margin-bottom: 1rem;"></i>
                <div style="font-size: 0.9rem; color: #8a8f98;">Görsel katman taranıyor, TD-esc-07 RAG standart veri seti eşleştiriliyor...</div>
              </div>
              <div id="grease-content" style="display: none;"></div>
            </div>

            <!-- Empty Placeholder -->
            <div id="grease-placeholder" style="text-align: center; padding: 4rem 1.5rem; opacity: 0.4; flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">
              <i class="fa-solid fa-flask-vial" style="font-size: 2.5rem; color: #8a8f98;"></i>
              <div style="font-weight: 700; font-size: 0.95rem;">Henüz gres analizi yapılmadı</div>
              <div style="font-size: 0.8rem; max-width: 280px; margin: 0 auto;">Sol taraftaki fiziksel ve laboratuvar kimyasal bulgularını tamamlayıp raporu tetikleyin.</div>
            </div>

          </div>
        </div>
      </div>

      <!-- ========================================== -->
      <!-- MODAL: BEARING STATUS EDIT / UPDATE -->
      <!-- ========================================== -->
      <div id="bearing-edit-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; width: 100vw; height: 100vh; background: rgba(5, 8, 16, 0.88); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); z-index: 99999; align-items: center; justify-content: center; padding: 1.5rem; box-sizing: border-box;" onclick="if(event.target === this) window.closeBearingEditModal()">
        <div class="glass-panel" style="background: #0d131f; border: 1px solid rgba(0, 242, 254, 0.3); border-radius: 14px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; padding: 1.5rem; box-shadow: 0 10px 40px rgba(0,0,0,0.8); animation: fadeIn 0.3s ease;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.75rem; margin-bottom: 1.2rem;">
            <div>
              <h3 id="modal-bearing-title" style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; font-weight: 800; color: #fff;">
                <i class="fa-solid fa-arrows-rotate" style="color: var(--accent-cyan); margin-right: 8px;"></i> Rulman Durumunu Güncelle
              </h3>
              <div id="modal-bearing-subtitle" style="font-size: 0.8rem; color: #8a8f98; margin-top: 2px;"></div>
            </div>
            <button onclick="window.closeBearingEditModal()" style="background: none; border: none; color: #8a8f98; font-size: 1.2rem; cursor: pointer; padding: 4px;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <form id="bearing-edit-form" onsubmit="window.saveBearingEditModal(event)" style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="hidden" id="modal-turbine-id">
            <input type="hidden" id="modal-site-id">
            <input type="hidden" id="modal-site-name">
            <input type="hidden" id="modal-turbine-label">

            <!-- Türbin Seçimi (Eğer üstteki butondan açıldıysa) -->
            <div id="modal-turbine-select-container" style="display: none; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.8rem; color: #fff; font-weight: 700;">Hedef Türbin</label>
              <select id="modal-target-turbine" onchange="window.handleModalTurbineSelect(this.value)" style="height: 38px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none;">
                <option value="">-- Türbin Seçiniz --</option>
                ${allTurbines.map(t => `<option value="${t.id}" data-site="${t.siteId}" data-sitename="${t.siteName}" data-label="${t.name}">${t.siteName} - ${t.name} (${t.id})</option>`).join('')}
              </select>
            </div>

            <!-- Rulman Sağlık Durumu Seçimi -->
            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.85rem; color: #fff; font-weight: 700;">Rulman Durumu</label>
              <select id="modal-status-select" onchange="window.handleModalStatusChange(this.value)" style="height: 40px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.9rem; font-weight: 700; outline: none;">
                <option value="HEALTHY" style="background: #0b0f19; color: #00e676;">✅ SAĞLAM / TEMİZ (Rutin Yağlama)</option>
                <option value="FRONT_BEARING_REPLACED" style="background: #0b0f19; color: #c084fc;">🔄 ÖN RULMANI DEĞİŞTİRİLDİ</option>
                <option value="METAL_PARTICLE_DETECTED" style="background: #0b0f19; color: #f87171;">⚠️ METAL ÇAPAK TESPİT EDİLDİ (İzlemede / Riskli)</option>
              </select>
            </div>

            <!-- =============================== -->
            <!-- SECTION: ÖN RULMAN DEĞİŞİMİ -->
            <!-- =============================== -->
            <div id="modal-section-replaced" style="display: none; background: rgba(168, 85, 247, 0.05); border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 8px; padding: 1rem; flex-direction: column; gap: 0.8rem;">
              <div style="font-weight: 700; color: #c084fc; font-size: 0.85rem; border-bottom: 1px solid rgba(168,85,247,0.15); padding-bottom: 4px;">
                <i class="fa-solid fa-arrows-rotate" style="margin-right: 6px;"></i> Ön Rulman Değişim Detayları
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">Değişim Tarihi</label>
                  <input id="modal-repl-date" type="date" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">Takılan Rulman Marka/Model</label>
                  <input id="modal-repl-model" type="text" placeholder="Örn: FAG 241/600 veya SKF" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                <label style="font-size: 0.75rem; color: #cbd0d8;">Değişim Nedeni</label>
                <input id="modal-repl-reason" type="text" placeholder="Örn: İç bilezikte çatlak / yorulma hasarı" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                <label style="font-size: 0.75rem; color: #cbd0d8;">İşlemi Yapan Teknisyen / Ekip</label>
                <input id="modal-repl-tech" type="text" placeholder="Örn: Fatih Zebek / Saha Ekibi" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
              </div>
            </div>

            <!-- =============================== -->
            <!-- SECTION: METAL ÇAPAK TESPİTİ -->
            <!-- =============================== -->
            <div id="modal-section-metal" style="display: none; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 1rem; flex-direction: column; gap: 0.8rem;">
              <div style="font-weight: 700; color: #f87171; font-size: 0.85rem; border-bottom: 1px solid rgba(239, 68, 68, 0.15); padding-bottom: 4px;">
                <i class="fa-solid fa-magnet" style="margin-right: 6px;"></i> Metal Çapak & Aşınma Bulguları
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">İlk Tespit Tarihi</label>
                  <input id="modal-metal-date" type="date" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">Mıknatıs Testi</label>
                  <select id="modal-metal-magnet" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none;">
                    <option value="POSITIVE" style="background: #0b0f19; color: #f87171;">🧲 Pozitif (Mıknatıs Çekiyor ⚠️)</option>
                    <option value="NEGATIVE" style="background: #0b0f19; color: #00e676;">Temiz / Negatif</option>
                  </select>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">Fe (Demir) Miktarı (ppm)</label>
                  <input id="modal-metal-fe" type="number" placeholder="Örn: 3400" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">PQ İndeksi</label>
                  <input id="modal-metal-pq" type="number" placeholder="Örn: 350" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">Flushing (Yıkama) Yapıldı mı?</label>
                  <select id="modal-metal-flushing" onchange="document.getElementById('modal-flushing-date-box').style.display = this.value === 'YES' ? 'flex' : 'none'" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none;">
                    <option value="NO" style="background: #0b0f19;">Bekliyor / Henüz Yapılmadı</option>
                    <option value="YES" style="background: #0b0f19;">Evet (Taze gres ile yıkandı)</option>
                  </select>
                </div>
                <div id="modal-flushing-date-box" style="display: none; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">Flushing Tarihi</label>
                  <input id="modal-flushing-date" type="date" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                <label style="font-size: 0.75rem; color: #cbd0d8;">Bir Sonraki Kontrol Tarihi (3 Aylık Takvim)</label>
                <input id="modal-metal-next" type="date" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
              </div>
            </div>

            <!-- Genel Notlar -->
            <div style="display: flex; flex-direction: column; gap: 0.3rem;">
              <label style="font-size: 0.75rem; color: #cbd0d8;">Rulman Notları & Saha Açıklaması</label>
              <textarea id="modal-notes" rows="2" placeholder="Türbin rulman durumuyla ilgili özel notlar..." style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 8px 10px; font-size: 0.85rem; outline: none; font-family: inherit; resize: vertical;"></textarea>
            </div>

            <!-- Form Butonları -->
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem;">
              <button type="button" onclick="window.closeBearingEditModal()" style="padding: 0.5rem 1.2rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
                İptal
              </button>
              <button type="submit" class="cyber-button" style="padding: 0.5rem 1.4rem; background: rgba(0, 242, 254, 0.15); border: 1px solid var(--accent-cyan); border-radius: 6px; color: var(--accent-cyan); font-size: 0.85rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-floppy-disk"></i> Kaydet
              </button>
            </div>

          </form>

      </div>
    </div>

    <!-- ========================================== -->
    <!-- TAB 4: SAHA ANALİZ KAYITLARI & GEÇMİŞ (TARİHÇE) -->
    <!-- ========================================== -->
    <div id="bearing-tab-history" class="bearing-tab-content" style="display: none;">
      <!-- Filter Controls -->
      <div class="glass-panel" style="padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(255,255,255,0.06);">
        <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; flex: 1;">
          <!-- Saha Filtresi -->
          <select id="insp-site-filter" onchange="window.updateInspectionsUI()" style="height: 36px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
            <option value="ALL">Tüm Sahalar</option>
            ${sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>

          <!-- Analiz Türü Filtresi -->
          <select id="insp-type-filter" onchange="window.updateInspectionsUI()" style="height: 36px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
            <option value="ALL">Tüm Analiz Türleri</option>
            <option value="ACOUSTIC">Akustik Ses Analizi</option>
            <option value="GREASE">Gres & Hasar Sınıfı Analizi</option>
          </select>

          <!-- Durum Filtresi -->
          <select id="insp-status-filter" onchange="window.updateInspectionsUI()" style="height: 36px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
            <option value="ALL">Tüm Durumlar</option>
            <option value="NORMAL">Normal / Temiz</option>
            <option value="WARNING">Uyarı / İnceleme</option>
            <option value="CRITICAL">Kritik / Hasar</option>
          </select>

          <!-- Arama Kutusu -->
          <input type="text" id="insp-search-input" oninput="window.updateInspectionsUI()" placeholder="Türbin no, teknisyen veya not ara..." style="height: 36px; min-width: 200px; flex: 1; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;" />
        </div>

        <div style="font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; color: #8a8f98; font-weight: 700;">
          Kayıt Sayısı: <span id="insp-total-count" style="color: var(--accent-cyan); font-weight: 800; font-size: 1.1rem;">0</span>
        </div>
      </div>

      <!-- Inspections List Container -->
      <div id="bearing-inspections-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div style="text-align: center; padding: 3rem 0; color: #8a8f98;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--accent-cyan); margin-bottom: 0.5rem;"></i>
          <div>Kayıtlar yükleniyor...</div>
        </div>
      </div>
    </div>

    <!-- ========================================== -->
    <!-- TAB 1: SICAKLIK ANALİZ MERKEZİ & GRES TAKİP -->
    <!-- ========================================== -->
    <div id="bearing-tab-thermal" class="bearing-tab-content active-tab">
      
      <!-- Üst Kontrol & Filtre Barı -->
      <div class="glass-panel" style="padding: 1.2rem; border-radius: 12px; background: rgba(10, 15, 24, 0.7); border: 1px solid rgba(255, 159, 67, 0.2); backdrop-filter: blur(10px); margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
          <div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.3rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 10px;">
              <span style="width: 32px; height: 32px; border-radius: 8px; background: rgba(255, 159, 67, 0.15); display: flex; align-items: center; justify-content: center; color: #ff9f43; font-size: 1rem;">
                <i class="fa-solid fa-temperature-arrow-up"></i>
              </span>
              Rulman Sıcaklık Analiz & Otonom Gres Karar Destek Merkezi
            </div>
            <div style="font-size: 0.82rem; color: #8a8f98; margin-top: 3px;">
              SCADA canlı ön/arka rulman sıcaklık farkı (ΔT) analizi, aşırı ısınma tespiti, otomatik flushing/gres önerileri ve müdahale takip döngüsü.
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="background: rgba(0, 255, 102, 0.05); border: 1px solid rgba(0, 255, 102, 0.2); padding: 6px 12px; border-radius: 8px; display: flex; align-items: center; gap: 8px; font-size: 0.8rem;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #00ff66; box-shadow: 0 0 8px #00ff66;"></span>
              <span style="color: #00ff66; font-weight: 700; font-family: 'Rajdhani', sans-serif;" id="thermal-sync-status">SCADA CANLI AKIŞ: AKTİF</span>
            </div>
            <button onclick="window.updateThermalUI()" style="height: 36px; padding: 0 14px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 8px; color: #fff; font-size: 0.82rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s;">
              <i class="fa-solid fa-arrows-rotate"></i> Yenile
            </button>
          </div>
        </div>

        <!-- Filtreler -->
        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
          <!-- Saha Seçici -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.78rem; color: #8a8f98; font-weight: 700;">SAHA:</span>
            <select id="thermal-site-filter" onchange="window.handleThermalSiteChange()" style="height: 36px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.82rem; outline: none;">
              <option value="ALL">🌐 Tüm Sahalar (Filo)</option>
              ${sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>

          <!-- Durum / Sıralama Filtresi -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.78rem; color: #8a8f98; font-weight: 700;">SIRALAMA:</span>
            <select id="thermal-sort-filter" onchange="window.updateThermalUI()" style="height: 36px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.82rem; outline: none;">
              <option value="TURBINE_ASC" selected>🔢 Türbin Numarasına Göre (T-01, T-02...)</option>
              <option value="PEER_DEV_DESC">🚨 En Yüksek Akran Sapması (Röntgen Öncelikli)</option>
              <option value="DELTA_DESC">En Yüksek Sıcaklık Farkı (ΔT Öncelikli)</option>
              <option value="REAR_DESC">Arka Rulman Sıcaklığına Göre</option>
              <option value="FRONT_DESC">Ön Rulman Sıcaklığına Göre</option>
            </select>
          </div>

          <!-- Durum Seviyesi Filtresi -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.78rem; color: #8a8f98; font-weight: 700;">DURUM:</span>
            <select id="thermal-severity-filter" onchange="window.updateThermalUI()" style="height: 36px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.82rem; outline: none;">
              <option value="ALL">Tüm Durumlar</option>
              <option value="CONFIRMED">🚨 Kanıtlanmış Rulman Sinyali (Kritik)</option>
              <option value="SUSPICIOUS">🟡 Şüpheli Isınma / Gres Takviyesi</option>
              <option value="SENSOR_FAULT">🔧 Sensör Arızası (PT100 / Kablo)</option>
              <option value="LOAD">⚡ Yük Kaynaklı Isınma (Sağlam)</option>
              <option value="NORMAL">🟢 Dengeli / Normal</option>
            </select>
          </div>

          <!-- Arama Kutusu -->
          <div style="flex: 1; min-width: 180px;">
            <input type="text" id="thermal-search-input" oninput="window.updateThermalUI()" placeholder="Türbin adı (T15) veya Seri no ara..." style="width: 100%; height: 36px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.82rem; outline: none;" />
          </div>
        </div>
      </div>

      <!-- KPI Özet Sayaçları (5 Kart) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        
        <!-- Kritik / Flushing Gerekli -->
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 10px; background: rgba(255, 59, 48, 0.05); border: 1px solid rgba(255, 59, 48, 0.3); display: flex; align-items: center; gap: 1rem; cursor: pointer;" onclick="const el = document.getElementById('thermal-severity-filter'); if(el) { el.value='CONFIRMED'; window.updateThermalUI(); }">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(255, 59, 48, 0.15); display: flex; align-items: center; justify-content: center; color: #ff3b30; font-size: 1.3rem;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #ff3b30; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Kritik (Flushing)</div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.7rem; font-weight: 800; color: #fff; line-height: 1.1;" id="thermal-kpi-critical">0</div>
            <div style="font-size: 0.7rem; color: #8a8f98;">Hasar sinyali</div>
          </div>
        </div>

        <!-- Dikkat / Gres Takviyesi -->
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 10px; background: rgba(255, 204, 0, 0.05); border: 1px solid rgba(255, 204, 0, 0.3); display: flex; align-items: center; gap: 1rem; cursor: pointer;" onclick="const el = document.getElementById('thermal-severity-filter'); if(el) { el.value='SUSPICIOUS'; window.updateThermalUI(); }">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(255, 204, 0, 0.15); display: flex; align-items: center; justify-content: center; color: #ffcc00; font-size: 1.3rem;">
            <i class="fa-solid fa-oil-can"></i>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #ffcc00; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Dikkat (Gres)</div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.7rem; font-weight: 800; color: #fff; line-height: 1.1;" id="thermal-kpi-warning">0</div>
            <div style="font-size: 0.7rem; color: #8a8f98;">Şüpheli ısınma</div>
          </div>
        </div>

        <!-- Sensör Arızası (PT100 / Kablo) -->
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 10px; background: rgba(217, 70, 239, 0.05); border: 1px solid rgba(217, 70, 239, 0.35); display: flex; align-items: center; gap: 1rem; cursor: pointer;" onclick="const el = document.getElementById('thermal-severity-filter'); if(el) { el.value='SENSOR_FAULT'; window.updateThermalUI(); }">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(217, 70, 239, 0.15); display: flex; align-items: center; justify-content: center; color: #d946ef; font-size: 1.3rem;">
            <i class="fa-solid fa-screwdriver-wrench"></i>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #d946ef; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Sensör Arızası</div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.7rem; font-weight: 800; color: #fff; line-height: 1.1;" id="thermal-kpi-sensor-fault">0</div>
            <div style="font-size: 0.7rem; color: #8a8f98;">PT100 kopuk / şase</div>
          </div>
        </div>

        <!-- Normal / Dengeli -->
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 10px; background: rgba(0, 255, 102, 0.04); border: 1px solid rgba(0, 255, 102, 0.2); display: flex; align-items: center; gap: 1rem; cursor: pointer;" onclick="const el = document.getElementById('thermal-severity-filter'); if(el) { el.value='NORMAL'; window.updateThermalUI(); }">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(0, 255, 102, 0.1); display: flex; align-items: center; justify-content: center; color: #00ff66; font-size: 1.3rem;">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #00ff66; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Dengeli / Normal</div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.7rem; font-weight: 800; color: #fff; line-height: 1.1;" id="thermal-kpi-normal">0</div>
            <div style="font-size: 0.7rem; color: #8a8f98;">ΔT &lt; 5°C stabil</div>
          </div>
        </div>

        <!-- Canlı Okunan Türbinler -->
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 10px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(0, 242, 254, 0.15); display: flex; align-items: center; gap: 1rem; cursor: pointer;" onclick="const el = document.getElementById('thermal-severity-filter'); if(el) { el.value='ALL'; window.updateThermalUI(); }">
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(0, 242, 254, 0.1); display: flex; align-items: center; justify-content: center; color: var(--accent-cyan); font-size: 1.3rem;">
            <i class="fa-solid fa-satellite-dish"></i>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #8a8f98; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Canlı Veri Gelen</div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.7rem; font-weight: 800; color: #fff; line-height: 1.1;" id="thermal-kpi-reporting">0</div>
            <div style="font-size: 0.7rem; color: #8a8f98;">SCADA akışı</div>
          </div>
        </div>

      </div>

      <!-- SAHA RÖNTGENİ & AKRAN KIYASLAMA BENCHMARK BARI -->
      <div id="thermal-park-benchmark" class="glass-panel" style="padding: 1.1rem 1.4rem; border-radius: 12px; background: rgba(10, 15, 24, 0.7); border: 1px solid rgba(0, 242, 254, 0.25); backdrop-filter: blur(10px); margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.8rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.6rem;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; background: rgba(0, 242, 254, 0.15); color: var(--accent-cyan); font-size: 0.9rem;">
              <i class="fa-solid fa-microscope"></i>
            </span>
            <span style="font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 800; color: #fff;">
              Saha Röntgeni & Akran Türbin Benchmark Özeti
            </span>
            <span id="benchmark-site-name" style="font-size: 0.72rem; color: var(--accent-cyan); background: rgba(0,242,254,0.08); border: 1px solid rgba(0,242,254,0.25); padding: 2px 7px; border-radius: 4px; font-weight: 700;">
              Tüm Sahalar (Filo)
            </span>
          </div>
          <div id="benchmark-anomaly-badge" style="font-size: 0.75rem; font-weight: 700; color: #ff9f43; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-spinner fa-spin"></i> Canlı Röntgen Analizi Hesaplanıyor...
          </div>
        </div>

        <!-- Benchmark Grid Items -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 8px 12px;">
            <div style="font-size: 0.68rem; color: #8a8f98; text-transform: uppercase;">Ort. Rüzgar / Devir</div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: #fff;" id="benchmark-avg-wind-rpm">-- m/s • -- RPM</div>
            <div style="font-size: 0.68rem; color: #6b7280;">Saha çalışma noktası</div>
          </div>

          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 8px 12px;">
            <div style="font-size: 0.68rem; color: #8a8f98; text-transform: uppercase;">Toplam / Ort. Güç</div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: #00f2fe;" id="benchmark-power">-- kW</div>
            <div style="font-size: 0.68rem; color: #6b7280;">Aktif jeneratör yükü</div>
          </div>

          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 8px 12px;">
            <div style="font-size: 0.68rem; color: #8a8f98; text-transform: uppercase;">Akran Medyan Arka Rulman</div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: #fff;" id="benchmark-median-rear">--°C</div>
            <div style="font-size: 0.68rem; color: #6b7280;">Saha referans çizgisi</div>
          </div>

          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 8px 12px;">
            <div style="font-size: 0.68rem; color: #8a8f98; text-transform: uppercase;">Akran Medyan Fark (ΔT)</div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: #00ff66;" id="benchmark-median-delta">--°C</div>
            <div style="font-size: 0.68rem; color: #6b7280;">T_arka - T_ön medyanı</div>
          </div>

          <div style="background: rgba(255, 59, 48, 0.04); border: 1px solid rgba(255, 59, 48, 0.2); border-radius: 8px; padding: 8px 12px;">
            <div style="font-size: 0.68rem; color: #ff3b30; text-transform: uppercase;">Röntgen Kusur Tespiti</div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: #ff3b30;" id="benchmark-defect-count">0 Türbin</div>
            <div style="font-size: 0.68rem; color: #ff9f43;">Akrandan sapan arıza</div>
          </div>
        </div>
      </div>

      <!-- GÖRSEL SICAKLIK FARKI (ΔT) BAR GRAFİK BÖLÜMÜ -->
      <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; background: rgba(10, 15, 24, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-chart-simple" style="color: var(--accent-cyan);"></i> Türbin Bazlı Rulman Sıcaklık Farkı (ΔT) ve Akran Röntgen Grafiği
            </div>
            <div style="font-size: 0.75rem; color: #8a8f98;">
              Arka ve ön rulman arasındaki termal farkı (ΔT = T_arka - T_ön) ile sahadaki akran sapmasını gösterir.
            </div>
          </div>
          <div style="font-size: 0.75rem; display: flex; gap: 12px; align-items: center;">
            <span style="display: flex; align-items: center; gap: 4px; color: #00ff66;"><span style="width: 8px; height: 8px; background: #00ff66; border-radius: 2px;"></span> &lt;5°C Normal</span>
            <span style="display: flex; align-items: center; gap: 4px; color: #ffcc00;"><span style="width: 8px; height: 8px; background: #ffcc00; border-radius: 2px;"></span> 5-8°C Dikkat</span>
            <span style="display: flex; align-items: center; gap: 4px; color: #ff3b30;"><span style="width: 8px; height: 8px; background: #ff3b30; border-radius: 2px;"></span> ≥8°C Kritik</span>
          </div>
        </div>

        <!-- Dinamik Bar Grafiği Kutusu -->
        <div id="thermal-chart-container" style="display: flex; flex-direction: column; gap: 8px; max-height: 480px; overflow-y: auto; padding-right: 4px;">
          <div style="text-align: center; padding: 2rem 0; color: #8a8f98;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.2rem; color: var(--accent-cyan); margin-bottom: 0.5rem;"></i>
            <div>Sıcaklık grafiği hazırlanıyor...</div>
          </div>
        </div>
      </div>

      <!-- KAPSAMLI DETAYLI TABLO BÖLÜMÜ -->
      <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; background: rgba(10, 15, 24, 0.7); border: 1px solid rgba(255, 255, 255, 0.08);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-table-list" style="color: #ff9f43;"></i> Filo Sıcaklık, Saha Röntgeni & Otonom Karar Destek Tablosu
            </div>
            <div style="font-size: 0.75rem; color: #8a8f98;">
              Her türbinin anlık ölçümü, akran devir/yük karşılaştırması, Enercon D02980100 standardına göre gres kararı ve takip geçmişi.
            </div>
          </div>
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; color: #8a8f98; font-weight: 700;">
            Listelenen Türbin: <span id="thermal-table-count" style="color: var(--accent-cyan); font-weight: 800;">0</span>
          </div>
        </div>

        <!-- Tablo Container -->
        <div style="overflow-x: auto; border: 1px solid rgba(255,255,255,0.05); border-radius: 8px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
            <thead>
              <tr style="background: rgba(0, 0, 0, 0.4); border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: #8a8f98; font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.78rem; letter-spacing: 0.5px;">
                <th style="padding: 10px 12px;">TÜRBİN / SAHA</th>
                <th style="padding: 10px 12px; text-align: center;">ÇALIŞMA NOKTASI</th>
                <th style="padding: 10px 12px; text-align: center;">ÖN RULMAN</th>
                <th style="padding: 10px 12px; text-align: center;">ARKA RULMAN</th>
                <th style="padding: 10px 12px; text-align: center;">FARK (ΔT)</th>
                <th style="padding: 10px 12px;">RÖNTGEN TEŞHİSİ & ÖNERİ</th>
                <th style="padding: 10px 12px; text-align: center;">ÖNERİLEN GRES</th>
                <th style="padding: 10px 12px;">SON İŞLEM & TAKİP</th>
                <th style="padding: 10px 12px; text-align: right;">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody id="thermal-table-body">
              <tr>
                <td colspan="9" style="text-align: center; padding: 2rem; color: #8a8f98;">
                  Canlı veriler yükleniyor...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- ========================================== -->
    <!-- MODAL: GRES BASMA / FLUSHING KAYDI FORMU -->
    <!-- ========================================== -->
    <div id="thermal-grease-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; width: 100vw; height: 100vh; background: rgba(5, 8, 16, 0.88); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); z-index: 99999; align-items: center; justify-content: center; padding: 1.5rem; box-sizing: border-box;" onclick="if(event.target === this) window.closeGreaseModal()">
      <div class="glass-panel" style="background: #0d131f; border: 1px solid rgba(255, 159, 67, 0.35); border-radius: 14px; width: 100%; max-width: 580px; max-height: 88vh; overflow-y: auto; box-shadow: 0 16px 60px rgba(0,0,0,0.9); padding: 1.5rem;">
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.8rem;">
          <div>
            <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.3rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-oil-can" style="color: #ff9f43;"></i> Rulman Gres / Flushing Kaydı Ekle
            </h3>
            <p style="margin: 4px 0 0 0; font-size: 0.78rem; color: #8a8f98;">
              Sahada uygulanan gres basma veya flushing işlemini kaydedin. Sistem sıcaklık düşüşünü otomatik takip edecektir.
            </p>
          </div>
          <button type="button" onclick="window.closeGreaseModal()" style="background: none; border: none; color: #8a8f98; font-size: 1.2rem; cursor: pointer; padding: 4px 8px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="thermal-grease-form" onsubmit="window.saveGreaseModal(event)" style="display: flex; flex-direction: column; gap: 1rem;">
          
          <input type="hidden" id="grease-modal-turbine-id" />
          <input type="hidden" id="grease-modal-site-id" />
          <input type="hidden" id="grease-modal-site-name" />
          <input type="hidden" id="grease-modal-turbine-label" />

          <!-- Türbin Bilgi Kartı -->
          <div style="background: rgba(255, 159, 67, 0.06); border: 1px solid rgba(255, 159, 67, 0.2); border-radius: 8px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <div>
              <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.1rem; color: #fff;" id="grease-modal-display-name">
                --
              </div>
              <div style="font-size: 0.72rem; color: #8a8f98;" id="grease-modal-display-site">
                --
              </div>
            </div>
            <!-- Canlı Sıcaklık Özeti -->
            <div style="font-size: 0.78rem; text-align: right;" id="grease-modal-display-temps">
              --
            </div>
          </div>

          <!-- İşlem Türü & Hedef Rulman (2 Kolon) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 0.75rem; color: #cbd0d8; font-weight: 700;">İşlem Türü *</label>
              <select id="grease-modal-action-type" style="height: 38px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none;">
                <option value="FLUSHING">Rulman Flushing (Yıkama/Temizleme)</option>
                <option value="GREASE_ADD">Rutin / Takviye Gres Basma</option>
                <option value="SAMPLE_TAKEN">Gres Numunesi Alındı (Laboratuvar)</option>
              </select>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 0.75rem; color: #cbd0d8; font-weight: 700;">Hedef Rulman *</label>
              <select id="grease-modal-target" style="height: 38px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none;">
                <option value="REAR">Arka Rulman</option>
                <option value="FRONT">Ön Rulman</option>
                <option value="BOTH">Her İki Rulman (Ön + Arka)</option>
              </select>
            </div>
          </div>

          <!-- Basılan Gres Miktarı (kg) & Gres Tipi -->
          <div style="display: grid; grid-template-columns: 1fr 1.3fr; gap: 10px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 0.75rem; color: #ff9f43; font-weight: 800;">Basılan Miktar (kg) *</label>
              <input type="number" step="0.1" min="0" id="grease-modal-amount" placeholder="Örn: 5.5" required style="height: 38px; background: rgba(255,159,67,0.08); border: 1px solid rgba(255,159,67,0.4); border-radius: 6px; color: #fff; font-weight: 700; font-size: 1rem; padding: 0 10px; outline: none;" />
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 0.75rem; color: #cbd0d8; font-weight: 700;">Kullanılan Gres Tipi</label>
              <select id="grease-modal-type" style="height: 38px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.82rem; outline: none;">
                <option value="Fuchs Renolit CX-TOM 15">Fuchs Renolit CX-TOM 15 (Enercon)</option>
                <option value="Mobilith SHC 460">Mobilith SHC 460</option>
                <option value="Shell Gadus S3 V460D">Shell Gadus S3 V460D</option>
                <option value="Klüberplex BEM 41-141">Klüberplex BEM 41-141</option>
                <option value="Diğer">Diğer Gres</option>
              </select>
            </div>
          </div>

          <!-- Müdahale Eden Teknisyen -->
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 0.75rem; color: #cbd0d8; font-weight: 700;">Müdahale Eden Teknisyen / Ekip</label>
            <input type="text" id="grease-modal-tech" placeholder="İsim / Ekip" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none;" />
          </div>

          <!-- Açıklama / Not -->
          <div style="display: flex; flex-direction: column; gap: 4px;">
            <label style="font-size: 0.75rem; color: #cbd0d8; font-weight: 700;">Saha Notları / Gözlem</label>
            <textarea id="grease-modal-notes" rows="2" placeholder="Örn: Eski gres kararmış ve sertleşmişti. Flushing sonrası 5.5 kg temiz gres basıldı." style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 8px 10px; font-size: 0.82rem; outline: none; resize: vertical;"></textarea>
          </div>

          <!-- Butonlar -->
          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem;">
            <button type="button" onclick="window.closeGreaseModal()" style="padding: 0.5rem 1.2rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
              İptal
            </button>
            <button type="submit" class="cyber-button" style="padding: 0.5rem 1.4rem; background: rgba(255, 159, 67, 0.15); border: 1px solid #ff9f43; border-radius: 6px; color: #ff9f43; font-size: 0.85rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-floppy-disk"></i> Kaydet ve Takibe Al
            </button>
          </div>

        </form>

      </div>
    </div>

    <!-- ========================================== -->
    <!-- MODAL: TÜRBİN TERMAL RÖNTGENİ & AKRAN ANALİZİ -->
    <!-- ========================================== -->
    <div id="thermal-xray-modal" class="modal-backdrop" style="display: none; position: fixed; inset: 0; width: 100vw; height: 100vh; background: rgba(5, 8, 16, 0.88); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); z-index: 99999; align-items: center; justify-content: center; padding: 1.5rem; box-sizing: border-box;" onclick="if(event.target === this) window.closeThermalXRayModal()">
      <div class="glass-panel" style="background: #0b101b; border: 1px solid rgba(0, 242, 254, 0.35); border-radius: 14px; width: 100%; max-width: 860px; max-height: 88vh; overflow-y: auto; box-shadow: 0 16px 60px rgba(0,0,0,0.9); padding: 1.6rem; animation: fadeIn 0.25s ease;">
        <div id="thermal-xray-modal-content">
          <!-- Dynamically rendered by window.openThermalXRayModal -->
        </div>
      </div>
    </div>

    <!-- Quiet Luxury Interactive Styles -->
    <style>
      .hidden-result { display: none; }
      .tab-nav-btn {
        background: none;
        border: none;
        outline: none;
        cursor: pointer;
        padding: 12px 20px;
        color: #8a8f98;
        font-family: 'Rajdhani', sans-serif;
        font-weight: 700;
        font-size: 1rem;
        transition: all 0.3s ease;
        position: relative;
      }
      .tab-nav-btn.active {
        color: #fff;
      }
      .tab-nav-btn.active::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 0;
        width: 100%;
        height: 2px;
        background: var(--accent-cyan);
        box-shadow: 0 0 8px var(--accent-cyan);
      }
      .bearing-tab-content {
        display: none;
        animation: fadeIn 0.4s ease;
      }
      .bearing-tab-content.active-tab {
        display: block;
      }
      .fleet-filter-btn {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        color: #8a8f98;
        font-family: 'Rajdhani', sans-serif;
        font-weight: 700;
        font-size: 0.85rem;
        padding: 6px 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .fleet-filter-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
      }
      .fleet-filter-btn.active {
        background: rgba(0, 242, 254, 0.12);
        border-color: var(--accent-cyan);
        color: #fff;
        box-shadow: 0 0 10px rgba(0, 242, 254, 0.15);
      }
      .yaw-toggle-btn.active {
        background: var(--accent-blue) !important;
        border-color: var(--accent-blue) !important;
        color: #000 !important;
      }
      .yaw-toggle-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      #live-audio-btn:hover {
        background: rgba(0, 242, 254, 0.15) !important;
        border-color: var(--accent-cyan) !important;
        box-shadow: 0 0 10px rgba(0, 242, 254, 0.15);
      }
      #photo-upload-box:hover {
        border-color: var(--accent-magenta) !important;
        background: rgba(240, 18, 190, 0.05) !important;
        box-shadow: 0 0 15px rgba(240, 18, 190, 0.1);
      }
      @keyframes rosePulse {
        0% {
          box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.4);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(244, 63, 94, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(244, 63, 94, 0);
        }
      }
      .recording-pulse {
        animation: rosePulse 1.5s infinite;
        background: rgba(244, 63, 94, 0.15) !important;
        border-color: rgba(244, 63, 94, 0.5) !important;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
  `;
};

// Global state variables
let isYawActive = false;
let mediaRecorder: any = null;
let audioChunks: any[] = [];
let recordingInterval: any = null;
let isRecording = false;
let simulationTimeout: any = null;
let bearingFleetUnsub: any = null;
let bearingInspectionsUnsub: any = null;
let bearingThermalUnsub: any = null;
let bearingGreaseLogsUnsub: any = null;

// ========================================================
// FLEET MANAGEMENT LOGIC & SUBSCRIBER
// ========================================================

const initFleetSubscription = () => {
  if (bearingFleetUnsub) {
    bearingFleetUnsub();
    bearingFleetUnsub = null;
  }

  bearingFleetUnsub = bearingService.subscribeAllRecords((records) => {
    (window as any).bearingFleetRecords = records;
    updateFleetUI();
  });

  if (bearingInspectionsUnsub) {
    bearingInspectionsUnsub();
    bearingInspectionsUnsub = null;
  }

  bearingInspectionsUnsub = bearingService.subscribeInspections((list) => {
    (window as any).bearingInspectionsList = list;
    updateInspectionsUI();
  });

  if (bearingGreaseLogsUnsub) {
    bearingGreaseLogsUnsub();
    bearingGreaseLogsUnsub = null;
  }

  bearingGreaseLogsUnsub = bearingService.subscribeGreaseLogs((logs) => {
    (window as any).bearingGreaseLogs = logs;
    updateThermalUI();
  });

  if (bearingThermalUnsub) {
    bearingThermalUnsub();
    bearingThermalUnsub = null;
  }
  
  bearingThermalUnsub = onSnapshot(collection(db, 'scada_live'), (snapshot) => {
    const thermalData: Record<string, any> = {};
    snapshot.forEach(doc => {
      const data = doc.data();
      const plantId = doc.id;
      if (data.turbines && Array.isArray(data.turbines)) {
        data.turbines.forEach((turb: any) => {
          if (turb.serial_no) {
            const temps = parseTurbineTemps(turb);
            if (temps) {
              const rawWind = turb.wind_speed_ms !== undefined ? parseFloat(turb.wind_speed_ms) : (turb.wind_speed !== undefined ? parseFloat(turb.wind_speed) : null);
              const rawRpm = turb.rotor_speed_rpm !== undefined ? parseFloat(turb.rotor_speed_rpm) : (turb.rotor_speed !== undefined ? parseFloat(turb.rotor_speed) : (turb.rpm !== undefined ? parseFloat(turb.rpm) : null));
              const rawPower = turb.active_power_kw !== undefined ? parseFloat(turb.active_power_kw) : (turb.power_kw !== undefined ? parseFloat(turb.power_kw) : (turb.power !== undefined ? parseFloat(turb.power) : null));
              const statusText = turb.status_text || turb.enercon_status || turb.status || 'Çalışıyor';

              thermalData[turb.serial_no] = {
                ...temps,
                windSpeed: rawWind !== null && !isNaN(rawWind) ? Number(rawWind.toFixed(1)) : null,
                rotorSpeed: rawRpm !== null && !isNaN(rawRpm) ? Number(rawRpm.toFixed(1)) : null,
                powerKw: rawPower !== null && !isNaN(rawPower) ? Math.round(rawPower) : null,
                statusText,
                plantId,
                updatedAt: turb.timestamp || data.timestamp || null
              };

              // 7 Günlük Döngüsel Tampona (Kamera NVR Döngüsü) Besleme
              if (temps.frontBearing !== null && temps.rearBearing !== null) {
                bearingService.recordThermalSnapshot(turb.serial_no, {
                  timestamp: Date.now(),
                  frontBearing: temps.frontBearing,
                  rearBearing: temps.rearBearing,
                  deltaT: temps.deltaT !== null ? temps.deltaT : (temps.rearBearing - temps.frontBearing),
                  rotorSpeed: rawRpm !== null && !isNaN(rawRpm) ? Number(rawRpm.toFixed(1)) : null,
                  powerKw: rawPower !== null && !isNaN(rawPower) ? Math.round(rawPower) : null,
                  windSpeed: rawWind !== null && !isNaN(rawWind) ? Number(rawWind.toFixed(1)) : null,
                  stator: temps.stator,
                  ambient: temps.ambient
                });
              }
            }
          }
        });
      }
    });
    (window as any).bearingThermalData = thermalData;
    updateFleetUI();
    updateThermalUI();
  });
};

const updateFleetUI = () => {
  const records: Record<string, BearingRecord> = (window as any).bearingFleetRecords || bearingService.getCachedRecords();
  const allTurbines: any[] = (window as any).currentFleetTurbines || [];
  const currentFilter = (window as any).currentFleetFilter || 'ALL';

  const siteFilterEl = document.getElementById('fleet-site-filter') as HTMLSelectElement;
  const searchInputEl = document.getElementById('fleet-search-input') as HTMLInputElement;
  const siteFilter = siteFilterEl ? siteFilterEl.value : 'ALL';
  const searchTerm = searchInputEl ? searchInputEl.value.trim().toLowerCase() : '';

  // KPI Calculations
  let replacedCount = 0;
  let metalCount = 0;
  let healthyCount = 0;

  allTurbines.forEach(t => {
    const rec = records[t.id];
    if (rec?.status === 'FRONT_BEARING_REPLACED') {
      replacedCount++;
    } else if (rec?.status === 'METAL_PARTICLE_DETECTED') {
      metalCount++;
    } else {
      healthyCount++;
    }
  });

  // Update KPI counters
  const kpiReplaced = document.getElementById('kpi-count-replaced');
  const kpiMetal = document.getElementById('kpi-count-metal');
  const kpiHealthy = document.getElementById('kpi-count-healthy');
  const btnReplaced = document.getElementById('btn-count-replaced');
  const btnMetal = document.getElementById('btn-count-metal');
  const btnHealthy = document.getElementById('btn-count-healthy');

  if (kpiReplaced) kpiReplaced.textContent = replacedCount.toString();
  if (kpiMetal) kpiMetal.textContent = metalCount.toString();
  if (kpiHealthy) kpiHealthy.textContent = healthyCount.toString();
  if (btnReplaced) btnReplaced.textContent = replacedCount.toString();
  if (btnMetal) btnMetal.textContent = metalCount.toString();
  if (btnHealthy) btnHealthy.textContent = healthyCount.toString();

  // Filter turbines
  const filteredTurbines = allTurbines.filter(t => {
    // 1. Site Filter
    if (siteFilter !== 'ALL' && t.siteId !== siteFilter) return false;

    // 2. Search Filter
    if (searchTerm) {
      const matchName = (t.name || '').toLowerCase().includes(searchTerm);
      const matchNo = (t.turbineNo || '').toLowerCase().includes(searchTerm);
      const matchId = (t.id || '').toLowerCase().includes(searchTerm);
      const matchSite = (t.siteName || '').toLowerCase().includes(searchTerm);
      if (!matchName && !matchNo && !matchId && !matchSite) return false;
    }

    // 3. Status Filter
    const rec = records[t.id];
    const status = rec?.status || 'HEALTHY';
    if (currentFilter === 'REPLACED' && status !== 'FRONT_BEARING_REPLACED') return false;
    if (currentFilter === 'METAL' && status !== 'METAL_PARTICLE_DETECTED') return false;
    if (currentFilter === 'HEALTHY' && status !== 'HEALTHY') return false;

    return true;
  });

  // Türbinleri türbin numarasına göre tertipli sırala (T-01, T-02...)
  filteredTurbines.sort((a, b) => compareTurbinesByNumber(a, b, siteFilter === 'ALL'));

  // Render cards
  const grid = document.getElementById('fleet-cards-grid');
  if (!grid) return;

  if (filteredTurbines.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; opacity: 0.5;">
        <i class="fa-solid fa-filter fa-2x" style="color: #8a8f98; margin-bottom: 0.5rem;"></i>
        <div style="font-weight: 700; font-size: 1rem; color: #fff;">Bu filtre kriterine uygun türbin bulunamadı</div>
        <div style="font-size: 0.8rem; color: #8a8f98;">Farklı bir filtre seçebilir veya arama terimini temizleyebilirsiniz.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = filteredTurbines.map(t => {
    const rec = records[t.id];
    const status: BearingConditionStatus = rec?.status || 'HEALTHY';

    let badgeHtml = '';
    let detailsHtml = '';
    let cardBorder = 'rgba(255, 255, 255, 0.05)';
    let cardGlow = 'none';

    if (status === 'FRONT_BEARING_REPLACED') {
      cardBorder = 'rgba(168, 85, 247, 0.35)';
      cardGlow = '0 0 15px rgba(168, 85, 247, 0.08)';
      badgeHtml = `
        <span style="font-family: 'Rajdhani', sans-serif; font-size: 0.72rem; font-weight: 800; color: #c084fc; background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.4); padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px;">
          <i class="fa-solid fa-arrows-rotate"></i> ÖN RULMAN DEĞİŞTİRİLDİ
        </span>
      `;
      detailsHtml = `
        <div style="background: rgba(168, 85, 247, 0.04); border: 1px solid rgba(168, 85, 247, 0.15); border-radius: 6px; padding: 8px; font-size: 0.75rem; display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #8a8f98;">Değişim Tarihi:</span>
            <strong style="color: #fff;">${rec?.replacementDate || 'Kayıtlı'}</strong>
          </div>
          ${rec?.replacedBearingModel ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #8a8f98;">Takılan Model:</span>
            <span style="color: #c084fc; font-weight: 700;">${rec.replacedBearingModel}</span>
          </div>` : ''}
          ${rec?.replacementReason ? `
          <div style="color: #a0a5b0; font-size: 0.72rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-top: 2px;">
            <i class="fa-solid fa-info-circle" style="color: #c084fc;"></i> ${rec.replacementReason}
          </div>` : ''}
        </div>
      `;
    } else if (status === 'METAL_PARTICLE_DETECTED') {
      cardBorder = 'rgba(239, 68, 68, 0.4)';
      cardGlow = '0 0 15px rgba(239, 68, 68, 0.1)';
      badgeHtml = `
        <span style="font-family: 'Rajdhani', sans-serif; font-size: 0.72rem; font-weight: 800; color: #f87171; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px;">
          <i class="fa-solid fa-magnet"></i> ÇAPAK TAKİBİNDE
        </span>
      `;
      detailsHtml = `
        <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; padding: 8px; font-size: 0.75rem; display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #8a8f98;">Mıknatıs Testi:</span>
            <span style="color: #f87171; font-weight: 800;">${rec?.magnetTestResult === 'POSITIVE' ? '🧲 Metal Çekiyor ⚠️' : 'Negatif'}</span>
          </div>
          ${rec?.fePpm || rec?.pqIndex ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #8a8f98;">Kimyasal Limit:</span>
            <span style="color: #fff; font-weight: 700;">Fe: ${rec.fePpm || '-'} ppm | PQ: ${rec.pqIndex || '-'}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #8a8f98;">Flushing (Yıkama):</span>
            <span style="font-weight: 700; color: ${rec?.flushingDone ? '#00e676' : '#ff9800'};">
              ${rec?.flushingDone ? '✅ Yapıldı' : '⏳ BEKLİYOR'}
            </span>
          </div>
          ${rec?.nextInspectionDate ? `
          <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-top: 2px;">
            <span style="color: #8a8f98;">Sonraki Kontrol:</span>
            <strong style="color: var(--accent-cyan);">${rec.nextInspectionDate}</strong>
          </div>` : ''}
        </div>
      `;
    } else {
      cardBorder = 'rgba(255, 255, 255, 0.05)';
      badgeHtml = `
        <span style="font-family: 'Rajdhani', sans-serif; font-size: 0.72rem; font-weight: 800; color: #00e676; background: rgba(0, 230, 118, 0.08); border: 1px solid rgba(0, 230, 118, 0.25); padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px;">
          <i class="fa-solid fa-circle-check"></i> SAĞLAM / TEMİZ
        </span>
      `;
      detailsHtml = `
        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 6px; padding: 8px; font-size: 0.75rem; color: #8a8f98; margin-top: 8px;">
          Rutin yağlama yapıldı. Metalik talaş veya aşınma bulgusu yok.
        </div>
      `;
    }
    
    const thermalData = (window as any).bearingThermalData?.[t.id];
    let thermalHtml = '';
    if (thermalData && thermalData.frontBearing !== null && thermalData.rearBearing !== null) {
      const deltaT = thermalData.deltaT || 0;
      const deltaColor = Math.abs(deltaT) >= 10 ? '#ff3b30' : (Math.abs(deltaT) >= 5 ? '#ffcc00' : '#00ff66');
      const deltaBg = Math.abs(deltaT) >= 10 ? 'rgba(255, 59, 48, 0.08)' : (Math.abs(deltaT) >= 5 ? 'rgba(255, 204, 0, 0.08)' : 'rgba(0, 255, 102, 0.06)');
      const hasRotorFault = thermalData.rotor1 !== null && thermalData.rotor2 !== null && thermalData.rotor1 > 10 && thermalData.rotor2 > 10 && Math.abs(thermalData.rotor1 - thermalData.rotor2) > 35;
      thermalHtml = `
        <div style="display: flex; align-items: center; gap: 6px; margin-top: 8px; background: ${deltaBg}; border: 1px solid ${deltaColor}33; border-radius: 6px; padding: 5px 8px; font-size: 0.72rem; flex-wrap: wrap;">
          <i class="fa-solid fa-temperature-half" style="color: ${deltaColor}; font-size: 0.85rem;"></i>
          <span style="color: #8a8f98;">Ön:</span> <strong style="color: #fff;">${thermalData.frontBearing}°C</strong>
          <span style="color: #8a8f98; margin-left: 4px;">Arka:</span> <strong style="color: #fff;">${thermalData.rearBearing}°C</strong>
          <span style="color: ${deltaColor}; font-weight: 800; margin-left: 4px;">ΔT: ${deltaT > 0 ? '+' : ''}${deltaT}°C</span>
          ${thermalData.stator !== null ? `<span style="color: #00f2fe; margin-left: 4px;">Statör: <strong>${thermalData.stator}°C</strong></span>` : ''}
          ${thermalData.rotor1 !== null && thermalData.rotor2 !== null ? `
            <span style="color: ${hasRotorFault ? '#d946ef' : '#ff9f43'}; margin-left: 4px;" title="Rotor 1 & 2">
              Rotor: <strong>${thermalData.rotor1}° / ${thermalData.rotor2}°C</strong> ${hasRotorFault ? '<i class="fa-solid fa-triangle-exclamation" style="color: #d946ef;"></i>' : ''}
            </span>
          ` : ''}
          ${thermalData.ambient !== null ? `<span style="color: #8a8f98; margin-left: auto; font-size: 0.68rem;"><i class="fa-solid fa-cloud-sun" style="margin-right: 3px;"></i>${thermalData.ambient}°C</span>` : ''}
        </div>
      `;
    }

    return `
      <div class="glass-panel" style="background: rgba(10, 15, 24, 0.7); border: 1px solid ${cardBorder}; border-radius: 12px; padding: 1rem; box-shadow: ${cardGlow}; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s;">
        <div>
          <!-- Header: Turbine Name & Badge -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
            <div>
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: #fff; line-height: 1.2; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span>${t.siteName} - ${t.turbineNo || t.name}</span>
                ${t.model ? `<span style="font-size: 0.72rem; color: var(--accent-cyan); background: rgba(0,242,254,0.08); border: 1px solid rgba(0,242,254,0.2); padding: 1px 5px; border-radius: 4px; font-weight: 700;">${t.model}</span>` : ''}
              </div>
              <div style="font-size: 0.72rem; color: #8a8f98; font-family: monospace; margin-top: 2px;">
                Türbin: <strong style="color: #fff;">${t.turbineNo || t.name}</strong> • Seri No: <strong style="color: #cbd0d8;">${t.id}</strong>
              </div>
            </div>
            ${badgeHtml}
          </div>

          <!-- Dynamic Details -->
          ${detailsHtml}

          ${rec?.notes ? `
          <div style="font-size: 0.72rem; color: #cbd0d8; font-style: italic; margin-top: 6px; padding-left: 6px; border-left: 2px solid rgba(255,255,255,0.2);">
            "${rec.notes}"
          </div>` : ''}

          ${rec?.lastInspectionDate ? `
          <div style="font-size: 0.72rem; color: #8a8f98; margin-top: 8px; display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px;">
            <span><i class="fa-solid fa-clock-rotate-left" style="color: var(--accent-cyan); margin-right: 4px;"></i>Son Ölçüm:</span>
            <strong style="color: ${rec.lastAcousticStatus === 'CRITICAL' ? '#ff3b30' : (rec.lastAcousticStatus === 'WARNING' ? '#ffcc00' : '#00ff66')};">${rec.lastInspectionDate} (${rec.lastAcousticStatus || 'Kayıt'})</strong>
          </div>` : ''}
          
          ${thermalHtml}
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 8px; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
          <button onclick="window.openBearingEditModal('${t.id}')" style="flex: 1; height: 32px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 5px;">
            <i class="fa-solid fa-pen-to-square"></i> Düzenle
          </button>
          <button onclick="window.selectTurbineForAnalysis('${t.id}', 'acoustics')" style="height: 32px; padding: 0 10px; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 6px; color: var(--accent-cyan); font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 5px;" title="Akustik ve Gres Analizine Geç">
            <i class="fa-solid fa-microscope"></i> Analiz
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// Filter handlers
(window as any).setFleetFilter = (filterType: 'ALL' | 'REPLACED' | 'METAL' | 'HEALTHY') => {
  (window as any).currentFleetFilter = filterType;
  const btnGroup = document.getElementById('fleet-filter-btn-group');
  if (btnGroup) {
    const buttons = btnGroup.querySelectorAll('.fleet-filter-btn');
    buttons.forEach((btn: any) => {
      if (btn.dataset.filter === filterType) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  updateFleetUI();
};

(window as any).handleFleetFilterChange = () => {
  updateFleetUI();
};

(window as any).selectTurbineForAnalysis = (turbineId: string, tab: 'acoustics' | 'grease') => {
  const selectEl = document.getElementById('analysis-turbine-select') as HTMLSelectElement;
  if (selectEl) {
    selectEl.value = turbineId;
  }
  (window as any).switchBearingTab(tab);
};

// Modal handlers
(window as any).openBearingEditModal = (turbineId?: string) => {
  const modal = document.getElementById('bearing-edit-modal');
  if (!modal) return;

  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  document.body.style.overflow = 'hidden';

  const records: Record<string, BearingRecord> = (window as any).bearingFleetRecords || bearingService.getCachedRecords();
  const allTurbines: any[] = (window as any).currentFleetTurbines || [];

  const titleEl = document.getElementById('modal-bearing-title');
  const subtitleEl = document.getElementById('modal-bearing-subtitle');
  const targetTurbineContainer = document.getElementById('modal-turbine-select-container');
  const targetTurbineSelect = document.getElementById('modal-target-turbine') as HTMLSelectElement;
  const statusSelect = document.getElementById('modal-status-select') as HTMLSelectElement;

  const idInput = document.getElementById('modal-turbine-id') as HTMLInputElement;
  const siteIdInput = document.getElementById('modal-site-id') as HTMLInputElement;
  const siteNameInput = document.getElementById('modal-site-name') as HTMLInputElement;
  const labelInput = document.getElementById('modal-turbine-label') as HTMLInputElement;

  const replDate = document.getElementById('modal-repl-date') as HTMLInputElement;
  const replModel = document.getElementById('modal-repl-model') as HTMLInputElement;
  const replReason = document.getElementById('modal-repl-reason') as HTMLInputElement;
  const replTech = document.getElementById('modal-repl-tech') as HTMLInputElement;

  const metalDate = document.getElementById('modal-metal-date') as HTMLInputElement;
  const metalMagnet = document.getElementById('modal-metal-magnet') as HTMLSelectElement;
  const metalFe = document.getElementById('modal-metal-fe') as HTMLInputElement;
  const metalPq = document.getElementById('modal-metal-pq') as HTMLInputElement;
  const metalFlushing = document.getElementById('modal-metal-flushing') as HTMLSelectElement;
  const flushingDate = document.getElementById('modal-flushing-date') as HTMLInputElement;
  const metalNext = document.getElementById('modal-metal-next') as HTMLInputElement;
  const notesInput = document.getElementById('modal-notes') as HTMLTextAreaElement;

  if (turbineId) {
    const t = allTurbines.find(item => item.id === turbineId);
    const rec = records[turbineId];

    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-arrows-rotate" style="color: var(--accent-cyan); margin-right: 8px;"></i> ${t ? t.siteName + ' - ' + t.name : turbineId}`;
    if (subtitleEl) subtitleEl.textContent = `Seri No: ${turbineId} | Rulman Sağlık Durum Güncellemesi`;
    if (targetTurbineContainer) targetTurbineContainer.style.display = 'none';

    idInput.value = turbineId;
    siteIdInput.value = t?.siteId || rec?.siteId || '';
    siteNameInput.value = t?.siteName || rec?.siteName || '';
    labelInput.value = t?.name || rec?.turbineLabel || '';

    statusSelect.value = rec?.status || 'HEALTHY';
    replDate.value = rec?.replacementDate || '';
    replModel.value = rec?.replacedBearingModel || '';
    replReason.value = rec?.replacementReason || '';
    replTech.value = rec?.replacementTechnician || '';

    metalDate.value = rec?.metalDetectedDate || '';
    metalMagnet.value = rec?.magnetTestResult || 'POSITIVE';
    metalFe.value = rec?.fePpm ? rec.fePpm.toString() : '';
    metalPq.value = rec?.pqIndex ? rec.pqIndex.toString() : '';
    metalFlushing.value = rec?.flushingDone ? 'YES' : 'NO';
    flushingDate.value = rec?.flushingDate || '';
    metalNext.value = rec?.nextInspectionDate || '';
    notesInput.value = rec?.notes || '';
  } else {
    // Açık seçim
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-plus" style="color: var(--accent-cyan); margin-right: 8px;"></i> Yeni Rulman Durum Kaydı`;
    if (subtitleEl) subtitleEl.textContent = `Aşağıdan türbin seçip rulman durumunu güncelleyin.`;
    if (targetTurbineContainer) targetTurbineContainer.style.display = 'flex';
    if (targetTurbineSelect) targetTurbineSelect.value = '';

    idInput.value = '';
    siteIdInput.value = '';
    siteNameInput.value = '';
    labelInput.value = '';
    statusSelect.value = 'HEALTHY';
    replDate.value = '';
    replModel.value = '';
    replReason.value = '';
    replTech.value = '';
    metalDate.value = '';
    metalMagnet.value = 'POSITIVE';
    metalFe.value = '';
    metalPq.value = '';
    metalFlushing.value = 'NO';
    flushingDate.value = '';
    metalNext.value = '';
    notesInput.value = '';
  }

  (window as any).handleModalStatusChange(statusSelect.value);
  modal.style.display = 'flex';
};

(window as any).closeBearingEditModal = () => {
  const modal = document.getElementById('bearing-edit-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
};

(window as any).handleModalTurbineSelect = (turbineId: string) => {
  const select = document.getElementById('modal-target-turbine') as HTMLSelectElement;
  if (!select || !turbineId) return;

  const selectedOpt = select.selectedOptions[0];
  const idInput = document.getElementById('modal-turbine-id') as HTMLInputElement;
  const siteIdInput = document.getElementById('modal-site-id') as HTMLInputElement;
  const siteNameInput = document.getElementById('modal-site-name') as HTMLInputElement;
  const labelInput = document.getElementById('modal-turbine-label') as HTMLInputElement;

  if (idInput) idInput.value = turbineId;
  if (siteIdInput) siteIdInput.value = selectedOpt.dataset.site || '';
  if (siteNameInput) siteNameInput.value = selectedOpt.dataset.sitename || '';
  if (labelInput) labelInput.value = selectedOpt.dataset.label || '';
};

(window as any).handleModalStatusChange = (status: string) => {
  const replSection = document.getElementById('modal-section-replaced');
  const metalSection = document.getElementById('modal-section-metal');
  if (!replSection || !metalSection) return;

  if (status === 'FRONT_BEARING_REPLACED') {
    replSection.style.display = 'flex';
    metalSection.style.display = 'none';
  } else if (status === 'METAL_PARTICLE_DETECTED') {
    replSection.style.display = 'none';
    metalSection.style.display = 'flex';
  } else {
    replSection.style.display = 'none';
    metalSection.style.display = 'none';
  }
};

(window as any).saveBearingEditModal = async (e: Event) => {
  e.preventDefault();
  const turbineId = (document.getElementById('modal-turbine-id') as HTMLInputElement)?.value;
  if (!turbineId) {
    alert("Lütfen bir türbin seçiniz.");
    return;
  }

  const siteId = (document.getElementById('modal-site-id') as HTMLInputElement)?.value || '';
  const siteName = (document.getElementById('modal-site-name') as HTMLInputElement)?.value || '';
  const turbineLabel = (document.getElementById('modal-turbine-label') as HTMLInputElement)?.value || '';
  const status = (document.getElementById('modal-status-select') as HTMLSelectElement)?.value as BearingConditionStatus;

  const record: BearingRecord = {
    id: turbineId,
    turbineId,
    turbineLabel,
    siteId,
    siteName,
    status,
    notes: (document.getElementById('modal-notes') as HTMLTextAreaElement)?.value || ''
  };

  if (status === 'FRONT_BEARING_REPLACED') {
    record.replacementDate = (document.getElementById('modal-repl-date') as HTMLInputElement)?.value || '';
    record.replacedBearingModel = (document.getElementById('modal-repl-model') as HTMLInputElement)?.value || '';
    record.replacementReason = (document.getElementById('modal-repl-reason') as HTMLInputElement)?.value || '';
    record.replacementTechnician = (document.getElementById('modal-repl-tech') as HTMLInputElement)?.value || '';
  } else if (status === 'METAL_PARTICLE_DETECTED') {
    record.metalDetectedDate = (document.getElementById('modal-metal-date') as HTMLInputElement)?.value || '';
    record.magnetTestResult = (document.getElementById('modal-metal-magnet') as HTMLSelectElement)?.value as any;
    record.fePpm = parseFloat((document.getElementById('modal-metal-fe') as HTMLInputElement)?.value) || undefined;
    record.pqIndex = parseFloat((document.getElementById('modal-metal-pq') as HTMLInputElement)?.value) || undefined;
    record.flushingDone = (document.getElementById('modal-metal-flushing') as HTMLSelectElement)?.value === 'YES';
    record.flushingDate = (document.getElementById('modal-flushing-date') as HTMLInputElement)?.value || '';
    record.nextInspectionDate = (document.getElementById('modal-metal-next') as HTMLInputElement)?.value || '';
  }

  try {
    await bearingService.saveRecord(record);
    (window as any).closeBearingEditModal();
  } catch (error) {
    alert("Rulman kaydı kaydedilirken hata oluştu: " + error);
  }
};

// Automatic initialization when entering page
setTimeout(() => {
  initFleetSubscription();
  if (typeof (window as any).switchBearingTab === 'function') {
    (window as any).switchBearingTab('thermal');
  }
}, 50);

// Tab switcher binding
(window as any).switchBearingTab = (tabId: 'fleet' | 'acoustics' | 'grease' | 'history' | 'thermal') => {
  const fleetTab = document.getElementById('bearing-tab-fleet');
  const acousticTab = document.getElementById('bearing-tab-acoustics');
  const greaseTab = document.getElementById('bearing-tab-grease');
  const historyTab = document.getElementById('bearing-tab-history');
  const thermalTab = document.getElementById('bearing-tab-thermal');

  const fleetBtn = document.getElementById('tab-btn-fleet');
  const acousticBtn = document.getElementById('tab-btn-acoustics');
  const greaseBtn = document.getElementById('tab-btn-grease');
  const historyBtn = document.getElementById('tab-btn-history');
  const thermalBtn = document.getElementById('tab-btn-thermal');

  const tabs = [
    { id: 'fleet', tab: fleetTab, btn: fleetBtn },
    { id: 'acoustics', tab: acousticTab, btn: acousticBtn },
    { id: 'grease', tab: greaseTab, btn: greaseBtn },
    { id: 'history', tab: historyTab, btn: historyBtn },
    { id: 'thermal', tab: thermalTab, btn: thermalBtn }
  ];

  tabs.forEach(t => {
    if (t.tab && t.btn) {
      if (t.id === tabId) {
        t.tab.classList.add('active-tab');
        t.tab.style.display = 'block';
        t.btn.classList.add('active');
        t.btn.style.color = '#fff';
      } else {
        t.tab.classList.remove('active-tab');
        t.tab.style.display = 'none';
        t.btn.classList.remove('active');
        t.btn.style.color = '#8a8f98';
      }
    }
  });

  // Reset scroll lock and ensure modals close on tab switch
  document.body.style.overflow = '';
  const xrayModal = document.getElementById('thermal-xray-modal');
  if (xrayModal) xrayModal.style.display = 'none';
  const greaseModal = document.getElementById('thermal-grease-modal');
  if (greaseModal) greaseModal.style.display = 'none';
  const editModal = document.getElementById('bearing-edit-modal');
  if (editModal) editModal.style.display = 'none';

  if (tabId === 'fleet') {
    updateFleetUI();
  } else if (tabId === 'history') {
    updateInspectionsUI();
  } else if (tabId === 'thermal') {
    updateThermalUI();
  }
};

// Global Escape key listener to close active bearing modals and restore scroll
if (!(window as any)._bearingModalsEscListenerAttached) {
  (window as any)._bearingModalsEscListenerAttached = true;
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      const xrayModal = document.getElementById('thermal-xray-modal');
      const greaseModal = document.getElementById('thermal-grease-modal');
      const editModal = document.getElementById('bearing-edit-modal');
      let closed = false;
      if (xrayModal && xrayModal.style.display !== 'none') {
        xrayModal.style.display = 'none';
        closed = true;
      }
      if (greaseModal && greaseModal.style.display !== 'none') {
        greaseModal.style.display = 'none';
        closed = true;
      }
      if (editModal && editModal.style.display !== 'none') {
        editModal.style.display = 'none';
        closed = true;
      }
      if (closed) {
        document.body.style.overflow = '';
      }
    }
  });
}

// ========================================================
// THERMAL ANALYSIS & GREASE RECOMMENDATION LOGIC
// ========================================================

const updateThermalUI = () => {
  const chartContainer = document.getElementById('thermal-chart-container');
  const tableBody = document.getElementById('thermal-table-body');
  if (!chartContainer && !tableBody) return;

  const allTurbines: any[] = (window as any).currentFleetTurbines || [];
  const thermalDataMap: Record<string, any> = (window as any).bearingThermalData || {};
  const greaseLogs: BearingGreaseLog[] = (window as any).bearingGreaseLogs || bearingService.getCachedGreaseLogs() || [];

  const siteFilterEl = document.getElementById('thermal-site-filter') as HTMLSelectElement;
  const sortFilterEl = document.getElementById('thermal-sort-filter') as HTMLSelectElement;
  const severityFilterEl = document.getElementById('thermal-severity-filter') as HTMLSelectElement;
  const searchInputEl = document.getElementById('thermal-search-input') as HTMLInputElement;

  const siteFilter = siteFilterEl ? siteFilterEl.value : 'ALL';
  const sortFilter = sortFilterEl ? sortFilterEl.value : 'TURBINE_ASC';
  const severityFilter = severityFilterEl ? severityFilterEl.value : 'ALL';
  const searchTerm = searchInputEl ? searchInputEl.value.trim().toLowerCase() : '';

  let criticalCount = 0;
  let warningCount = 0;
  let sensorFaultCount = 0;
  let normalCount = 0;
  let reportingCount = 0;

  // 1. Process each turbine and calculate Peer Cohort & Röntgen Diagnostic
  const processedTurbines = allTurbines.map(t => {
    const thermal = thermalDataMap[t.id] || null;
    const hasData = thermal && thermal.frontBearing !== null && thermal.rearBearing !== null;
    if (hasData) reportingCount++;

    const deltaT = hasData ? (thermal.deltaT || 0) : null;
    const absDelta = deltaT !== null ? Math.abs(deltaT) : -1;

    let peerResult: PeerCohortResult | null = null;
    let rec: any = null;

    if (hasData) {
      peerResult = calculatePeerCohortAndXRay(t.id, allTurbines, thermalDataMap);
      rec = peerResult.diagnostic;

      if (rec.code === 'SENSOR_FAULT' || peerResult.generatorSensorAlert?.hasAlert) {
        sensorFaultCount++;
      }

      if (rec.code === 'CONFIRMED') {
        criticalCount++;
      } else if (rec.code === 'SUSPICIOUS') {
        warningCount++;
      } else if (rec.code === 'HEALTHY' || rec.code === 'LOAD') {
        normalCount++;
      }
    }

    const turbGreaseLogs = greaseLogs.filter(g => g.turbineId === t.id);
    const latestGreaseLog = turbGreaseLogs.length > 0 ? turbGreaseLogs[0] : null;

    return {
      turbine: t,
      thermal,
      hasData,
      deltaT,
      absDelta,
      peerResult,
      rec,
      latestGreaseLog
    };
  });

  // 2. Compute Benchmark Metrics for the active site / fleet
  const benchmarkTurbines = processedTurbines.filter(item => {
    if (!item.hasData) return false;
    if (siteFilter !== 'ALL' && item.turbine.siteId !== siteFilter) return false;
    return true;
  });

  const winds: number[] = [];
  const rpms: number[] = [];
  const powers: number[] = [];
  const rears: number[] = [];
  const deltas: number[] = [];
  let confirmedDefects = 0;

  benchmarkTurbines.forEach(item => {
    if (item.thermal.windSpeed !== null && item.thermal.windSpeed !== undefined) winds.push(item.thermal.windSpeed);
    if (item.thermal.rotorSpeed !== null && item.thermal.rotorSpeed !== undefined) rpms.push(item.thermal.rotorSpeed);
    if (item.thermal.powerKw !== null && item.thermal.powerKw !== undefined) powers.push(item.thermal.powerKw);
    if (item.thermal.rearBearing !== null && item.thermal.rearBearing !== undefined) rears.push(item.thermal.rearBearing);
    if (item.deltaT !== null && item.deltaT !== undefined) deltas.push(item.deltaT);
    if (item.rec && item.rec.code === 'CONFIRMED') confirmedDefects++;
  });

  const siteAvgWind = winds.length > 0 ? (winds.reduce((a, b) => a + b, 0) / winds.length).toFixed(1) : '--';
  const siteAvgRpm = rpms.length > 0 ? (rpms.reduce((a, b) => a + b, 0) / rpms.length).toFixed(1) : '--';
  const siteTotalPower = powers.reduce((a, b) => a + b, 0);
  const siteAvgPower = powers.length > 0 ? Math.round(siteTotalPower / powers.length) : '--';
  const siteMedianRear = rears.length > 0 ? calculateMedian(rears) : '--';
  const siteMedianDelta = deltas.length > 0 ? calculateMedian(deltas) : '--';

  // Update Benchmark Bar DOM
  const bSiteName = document.getElementById('benchmark-site-name');
  const bAnomalyBadge = document.getElementById('benchmark-anomaly-badge');
  const bAvgWindRpm = document.getElementById('benchmark-avg-wind-rpm');
  const bPower = document.getElementById('benchmark-power');
  const bMedianRear = document.getElementById('benchmark-median-rear');
  const bMedianDelta = document.getElementById('benchmark-median-delta');
  const bDefectCount = document.getElementById('benchmark-defect-count');

  if (bSiteName) {
    if (siteFilter === 'ALL') {
      bSiteName.textContent = 'Tüm Sahalar (Filo)';
    } else {
      const selectedSite = allTurbines.find(t => t.siteId === siteFilter);
      bSiteName.textContent = selectedSite?.siteName || siteFilter;
    }
  }

  if (bAnomalyBadge) {
    if (confirmedDefects > 0) {
      bAnomalyBadge.innerHTML = `<span style="background: rgba(255, 59, 48, 0.15); border: 1px solid rgba(255, 59, 48, 0.35); padding: 3px 8px; border-radius: 4px; color: #ff3b30; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-triangle-exclamation"></i> <strong>${confirmedDefects} Türbinde</strong> Kesin Rulman Sinyali Tespit Edildi</span>`;
    } else {
      bAnomalyBadge.innerHTML = `<span style="background: rgba(0, 255, 102, 0.1); border: 1px solid rgba(0, 255, 102, 0.3); padding: 3px 8px; border-radius: 4px; color: #00ff66; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-check"></i> Rulman Termal Röntgeni Stabil</span>`;
    }
  }

  if (bAvgWindRpm) bAvgWindRpm.textContent = `${siteAvgWind} m/s • ${siteAvgRpm} RPM`;
  if (bPower) bPower.textContent = powers.length > 0 ? `${siteTotalPower.toLocaleString('tr-TR')} kW (Ort: ${siteAvgPower} kW)` : '-- kW';
  if (bMedianRear) bMedianRear.textContent = `${siteMedianRear}°C`;
  if (bMedianDelta) bMedianDelta.textContent = `${typeof siteMedianDelta === 'number' && siteMedianDelta > 0 ? '+' : ''}${siteMedianDelta}°C`;
  if (bDefectCount) {
    bDefectCount.textContent = `${confirmedDefects} Türbin`;
    bDefectCount.style.color = confirmedDefects > 0 ? '#ff3b30' : '#00ff66';
  }

  // Update KPI counters
  const kpiCritical = document.getElementById('thermal-kpi-critical');
  const kpiWarning = document.getElementById('thermal-kpi-warning');
  const kpiSensorFault = document.getElementById('thermal-kpi-sensor-fault');
  const kpiNormal = document.getElementById('thermal-kpi-normal');
  const kpiReporting = document.getElementById('thermal-kpi-reporting');

  if (kpiCritical) kpiCritical.textContent = criticalCount.toString();
  if (kpiWarning) kpiWarning.textContent = warningCount.toString();
  if (kpiSensorFault) kpiSensorFault.textContent = sensorFaultCount.toString();
  if (kpiNormal) kpiNormal.textContent = normalCount.toString();
  if (kpiReporting) kpiReporting.textContent = reportingCount.toString();

  // Filter list
  const filtered = processedTurbines.filter(item => {
    // 1. Site Filter
    if (siteFilter !== 'ALL' && item.turbine.siteId !== siteFilter) return false;

    // 2. Search Filter
    if (searchTerm) {
      const matchName = (item.turbine.name || '').toLowerCase().includes(searchTerm);
      const matchNo = (item.turbine.turbineNo || '').toLowerCase().includes(searchTerm);
      const matchId = (item.turbine.id || '').toLowerCase().includes(searchTerm);
      const matchSite = (item.turbine.siteName || '').toLowerCase().includes(searchTerm);
      if (!matchName && !matchNo && !matchId && !matchSite) return false;
    }

    // 3. Severity Filter
    if (severityFilter !== 'ALL') {
      if (!item.hasData || !item.rec) return false;
      if (severityFilter === 'SENSOR_FAULT') {
        if (item.rec.code !== 'SENSOR_FAULT' && !item.peerResult?.generatorSensorAlert?.hasAlert) return false;
      } else if (severityFilter === 'CONFIRMED' || severityFilter === 'CRITICAL') {
        if (item.rec.code !== 'CONFIRMED') return false;
      } else if (severityFilter === 'SUSPICIOUS' || severityFilter === 'WARNING') {
        if (item.rec.code !== 'SUSPICIOUS') return false;
      } else if (severityFilter === 'LOAD') {
        if (item.rec.code !== 'LOAD') return false;
      } else if (severityFilter === 'NORMAL') {
        if (item.rec.code !== 'HEALTHY' && item.rec.code !== 'LOAD') return false;
      }
    }

    return true;
  });

  // Sort list
  filtered.sort((a, b) => {
    // Show turbines with data first
    if (a.hasData && !b.hasData) return -1;
    if (!a.hasData && b.hasData) return 1;
    if (!a.hasData && !b.hasData) return compareTurbinesByNumber(a.turbine, b.turbine, siteFilter === 'ALL');

    if (sortFilter === 'TURBINE_ASC') {
      return compareTurbinesByNumber(a.turbine, b.turbine, siteFilter === 'ALL');
    }
    if (sortFilter === 'PEER_DEV_DESC') {
      const aDev = a.peerResult?.peerRearDev ?? -999;
      const bDev = b.peerResult?.peerRearDev ?? -999;
      if (bDev !== aDev) return bDev - aDev;
      return compareTurbinesByNumber(a.turbine, b.turbine, siteFilter === 'ALL');
    }
    if (sortFilter === 'DELTA_DESC') {
      const diff = (b.absDelta || 0) - (a.absDelta || 0);
      if (diff !== 0) return diff;
      return compareTurbinesByNumber(a.turbine, b.turbine, siteFilter === 'ALL');
    }
    if (sortFilter === 'REAR_DESC') {
      const diff = (b.thermal?.rearBearing || 0) - (a.thermal?.rearBearing || 0);
      if (diff !== 0) return diff;
      return compareTurbinesByNumber(a.turbine, b.turbine, siteFilter === 'ALL');
    }
    if (sortFilter === 'FRONT_DESC') {
      const diff = (b.thermal?.frontBearing || 0) - (a.thermal?.frontBearing || 0);
      if (diff !== 0) return diff;
      return compareTurbinesByNumber(a.turbine, b.turbine, siteFilter === 'ALL');
    }
    return compareTurbinesByNumber(a.turbine, b.turbine, siteFilter === 'ALL');
  });

  const countEl = document.getElementById('thermal-table-count');
  if (countEl) countEl.textContent = filtered.length.toString();

  // 1. Render Visual Bar Chart (Only turbines with SCADA data)
  if (chartContainer) {
    const chartTurbines = filtered.filter(f => f.hasData);
    if (chartTurbines.length === 0) {
      chartContainer.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #8a8f98; font-size: 0.85rem;">
          <i class="fa-solid fa-circle-info" style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--accent-cyan);"></i>
          <div>Seçili filtrelere uygun canlı sıcaklık verisi bulunan türbin bulunamadı.</div>
        </div>
      `;
    } else {
      chartContainer.innerHTML = chartTurbines.map((item, idx) => {
        const t = item.turbine;
        const thermal = item.thermal;
        const delta = item.deltaT || 0;
        const absDelta = Math.abs(delta);
        const peer = item.peerResult;
        const rec = item.rec;

        // Bar percentage: scale 0 to 20°C diff -> 0% to 100%
        const barPct = Math.min(100, Math.max(8, (absDelta / 20) * 100));
        const deltaSign = delta > 0 ? '+' : '';
        const peerDev = peer ? peer.peerRearDev : 0;
        const peerDevSign = peerDev > 0 ? '+' : '';

        return `
          <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; transition: background 0.2s;">
            <!-- Top Line: Turbine & Values & Buttons -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span style="font-size: 0.72rem; color: #8a8f98; font-family: monospace; font-weight: 700; width: 22px;">#${idx + 1}</span>
                <span style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: #fff;">
                  ${t.turbineNo || t.name}
                </span>
                ${t.model ? `<span style="font-size: 0.7rem; color: var(--accent-cyan); background: rgba(0,242,254,0.08); border: 1px solid rgba(0,242,254,0.2); padding: 1px 5px; border-radius: 4px; font-weight: 700;">${t.model}</span>` : ''}
                <span style="font-size: 0.75rem; color: #8a8f98; font-family: monospace;">(SN: <strong style="color: #cbd0d8;">${t.id}</strong>)</span>
                <span style="font-size: 0.72rem; color: #cbd0d8; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px;">
                  ${t.siteName}
                </span>
                ${thermal.rotorSpeed !== null ? `
                  <span style="font-size: 0.7rem; color: #cbd0d8; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px;">
                    <i class="fa-solid fa-arrows-spin" style="color: #ffcc00; margin-right: 3px;"></i>${thermal.rotorSpeed} RPM • ${thermal.powerKw !== null ? `${thermal.powerKw} kW` : ''}
                  </span>
                ` : ''}
              </div>

              <!-- Action buttons -->
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="font-size: 0.78rem; display: flex; gap: 8px; margin-right: 6px; flex-wrap: wrap; align-items: center;">
                  <span>Ön: <strong style="color: #fff;">${thermal.frontBearing}°C</strong></span>
                  ${thermal.stator !== null ? `<span style="color: #00f2fe;">Stator: <strong>${thermal.stator}°C</strong></span>` : ''}
                  ${thermal.rotor1 !== null && thermal.rotor2 !== null ? `
                    <span style="color: ${peer?.generatorSensorAlert ? '#d946ef' : '#ff9f43'};" title="Rotor 1 & Rotor 2">
                      Rotor: <strong>${thermal.rotor1}° / ${thermal.rotor2}°C</strong> ${peer?.generatorSensorAlert ? '<i class="fa-solid fa-triangle-exclamation" style="color: #d946ef;"></i>' : ''}
                    </span>
                  ` : ''}
                  <span>Arka: <strong style="color: #fff;">${thermal.rearBearing}°C</strong></span>
                  <span style="color: ${peerDev >= 5.0 ? '#ff3b30' : (peerDev >= 3.0 ? '#ffcc00' : '#00ff66')}; font-weight: 700;">
                    Akran Farkı: ${peerDevSign}${peerDev}°C
                  </span>
                </div>
                <button onclick="window.openThermalXRayModal('${t.id}')" style="height: 28px; padding: 0 10px; background: rgba(0, 242, 254, 0.12); border: 1px solid rgba(0, 242, 254, 0.35); border-radius: 5px; color: var(--accent-cyan); font-size: 0.72rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                  <i class="fa-solid fa-microscope"></i> Röntgen
                </button>
                <button onclick="window.openGreaseModal('${t.id}')" style="height: 28px; padding: 0 10px; background: rgba(255, 159, 67, 0.12); border: 1px solid rgba(255, 159, 67, 0.3); border-radius: 5px; color: #ff9f43; font-size: 0.72rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                  <i class="fa-solid fa-oil-can"></i> Gres Kaydı
                </button>
                ${(rec.code === 'SENSOR_FAULT' || peer?.generatorSensorAlert) ? `
                  <button onclick="window.createSensorFaultTask('${t.id}')" style="height: 28px; padding: 0 10px; background: rgba(217, 70, 239, 0.15); border: 1px solid #d946ef; border-radius: 5px; color: #d946ef; font-size: 0.72rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-screwdriver-wrench"></i> Sensör Görevi
                  </button>
                ` : `
                  <button onclick="window.createThermalWorkOrder('${t.id}')" style="height: 28px; padding: 0 10px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 5px; color: #fff; font-size: 0.72rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-wrench"></i> İş Emri
                  </button>
                `}
              </div>
            </div>

            <!-- Bar Line -->
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="flex: 1; height: 16px; background: rgba(255,255,255,0.04); border-radius: 4px; overflow: hidden; position: relative;">
                <div style="width: ${barPct}%; height: 100%; background: ${rec.color}; opacity: 0.85; border-radius: 4px; transition: width 0.3s; display: flex; align-items: center; justify-content: flex-end; padding-right: 6px;">
                </div>
              </div>
              <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.95rem; color: ${rec.color}; min-width: 80px; text-align: right;">
                ΔT: ${deltaSign}${delta}°C
              </div>
              <div style="font-size: 0.72rem; color: ${rec.color}; font-weight: 800; min-width: 170px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span>${rec.title}</span>
                ${peer?.generatorSensorAlert ? `
                  <span style="font-size: 0.68rem; color: #d946ef; background: rgba(217, 70, 239, 0.12); border: 1px solid rgba(217, 70, 239, 0.35); padding: 1px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;" title="${peer.generatorSensorAlert.detail}">
                    <i class="fa-solid fa-screwdriver-wrench"></i> ${peer.generatorSensorAlert.sensorName} Hatası
                  </span>
                ` : ''}
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // 2. Render Full Detailed Table (11 Columns)
  if (tableBody) {
    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 2.5rem; color: #8a8f98;">
            Eşleşen türbin bulunamadı.
          </td>
        </tr>
      `;
    } else {
      tableBody.innerHTML = filtered.map(item => {
        const t = item.turbine;
        const thermal = item.thermal;
        const peer = item.peerResult;
        const rec = item.rec;
        const latestGrease = item.latestGreaseLog;

        if (!item.hasData) {
          return `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04); background: rgba(0,0,0,0.1); opacity: 0.6;">
              <td style="padding: 10px 12px;">
                <span style="font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; font-weight: 800; color: #fff;">
                  ${t.siteName} ${t.turbineNo || t.name}
                </span>
                <span style="font-size: 0.78rem; color: #8a8f98; font-family: monospace; font-weight: 600; margin-left: 6px;">
                  ${t.id}
                </span>
              </td>
              <td style="padding: 10px 12px; text-align: center; color: #6b7280;">--</td>
              <td style="padding: 10px 12px; text-align: center; color: #6b7280;">--</td>
              <td style="padding: 10px 12px; text-align: center; color: #6b7280;">--</td>
              <td style="padding: 10px 12px; text-align: center; color: #6b7280;">--</td>
              <td style="padding: 10px 12px; color: #8a8f98; font-size: 0.75rem;">
                <i class="fa-solid fa-cloud-slash" style="margin-right: 4px;"></i> SCADA verisi yok
              </td>
              <td style="padding: 10px 12px; text-align: center; color: #6b7280;">--</td>
              <td style="padding: 10px 12px; font-size: 0.72rem; color: #8a8f98;">
                ${latestGrease ? `${latestGrease.dateFormatted}: ${latestGrease.greaseAmountKg} kg (${latestGrease.actionType === 'FLUSHING' ? 'Flushing' : 'Gres'})` : 'Kayıt yok'}
              </td>
              <td style="padding: 10px 12px; text-align: right;">
                <button onclick="window.openGreaseModal('${t.id}')" style="height: 26px; padding: 0 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #cbd0d8; font-size: 0.72rem; cursor: pointer;">
                  <i class="fa-solid fa-plus"></i> Kayıt
                </button>
              </td>
            </tr>
          `;
        }

        const delta = item.deltaT || 0;
        const deltaSign = delta > 0 ? '+' : '';
        const peerDev = peer ? peer.peerRearDev : 0;
        const peerDevSign = peerDev > 0 ? '+' : '';

        // Follow-up comparison with previous grease log
        let followUpHtml = '<span style="color: #6b7280;">Kayıt yok</span>';
        if (latestGrease) {
          let diffHtml = '';
          if (latestGrease.deltaTAtTime !== undefined && latestGrease.deltaTAtTime !== null) {
            const tempDiff = Number((latestGrease.deltaTAtTime - delta).toFixed(1));
            if (tempDiff > 0) {
              diffHtml = `<div style="color: #00ff66; font-size: 0.68rem; font-weight: 700;">✅ Müdahale sonrası ${tempDiff}°C düşüş sağlandı</div>`;
            } else if (tempDiff < 0) {
              diffHtml = `<div style="color: #ff3b30; font-size: 0.68rem; font-weight: 700;">⚠️ Sıcaklık +${Math.abs(tempDiff)}°C arttı</div>`;
            } else {
              diffHtml = `<div style="color: #8a8f98; font-size: 0.68rem;">Değişim yok (aynı)</div>`;
            }
          }
          followUpHtml = `
            <div>
              <div style="font-weight: 700; color: #cbd0d8; font-size: 0.75rem;">
                ${latestGrease.dateFormatted} • ${latestGrease.greaseAmountKg} kg
              </div>
              <div style="font-size: 0.7rem; color: #8a8f98;">
                ${latestGrease.actionType === 'FLUSHING' ? 'Flushing' : 'Gres'} (${latestGrease.targetBearing === 'REAR' ? 'Arka' : (latestGrease.targetBearing === 'FRONT' ? 'Ön' : 'İki Rulman')})
              </div>
              ${diffHtml}
            </div>
          `;
        }

        return `
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06); background: rgba(0,0,0,0.15); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='rgba(0,0,0,0.15)'">
            <!-- 1. Türbin / Saha -->
            <td style="padding: 10px 12px;">
              <span style="font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; font-weight: 800; color: #fff;">
                ${t.siteName} ${t.turbineNo || t.name}
              </span>
              <span style="font-size: 0.78rem; color: #8a8f98; font-family: monospace; font-weight: 600; margin-left: 6px;">
                ${t.id}
              </span>
            </td>

            <!-- 2. Çalışma Noktası (RPM / kW) -->
            <td style="padding: 10px 12px; text-align: center;">
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; font-weight: 800; color: #fff;">
                ${thermal.rotorSpeed !== null ? `${thermal.rotorSpeed} RPM` : '--'}
              </div>
              <div style="font-size: 0.7rem; color: #8a8f98;">
                ${thermal.powerKw !== null ? `${thermal.powerKw} kW` : ''} ${thermal.windSpeed !== null ? `• ${thermal.windSpeed} m/s` : ''}
              </div>
            </td>

            <!-- 3. Ön Rulman -->
            <td style="padding: 10px 12px; text-align: center;">
              <span style="font-family: 'Rajdhani', sans-serif; font-size: 1rem; font-weight: 700; color: #fff;">
                ${thermal.frontBearing}°C
              </span>
            </td>

            <!-- 4. Arka Rulman -->
            <td style="padding: 10px 12px; text-align: center;">
              <span style="font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; font-weight: 800; color: #fff;">
                ${thermal.rearBearing}°C
              </span>
            </td>

            <!-- 5. Fark (ΔT) & 7 Günlük Eğilim -->
            <td style="padding: 10px 12px; text-align: center;">
              <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; background: ${rec.badgeBg}; border: 1px solid ${rec.badgeBorder}; font-family: 'Rajdhani', sans-serif; font-size: 1rem; font-weight: 800; color: ${rec.color};">
                ${deltaSign}${delta}°C
              </span>
              ${(() => {
                const weekly = bearingService.getWeeklyEvaluation(t.id, thermal);
                const trendColor = weekly.trendDirection === 'RISING' ? '#ff3b30' : (weekly.trendDirection === 'COOLING' ? '#00f2fe' : '#8a8f98');
                const trendIcon = weekly.trendDirection === 'RISING' ? 'fa-arrow-trend-up' : (weekly.trendDirection === 'COOLING' ? 'fa-arrow-trend-down' : 'fa-minus');
                const trendText = weekly.trendDirection === 'RISING' ? `+${weekly.driftPerDay}°/g` : (weekly.trendDirection === 'COOLING' ? `${weekly.driftPerDay}°/g` : '7G Stabil');
                return `
                  <div style="font-size: 0.68rem; margin-top: 3px; font-weight: 700; color: ${trendColor};" title="7 Günlük Isıl Eğilim: ${weekly.trendDirection === 'RISING' ? 'Isınma Eğiliminde' : (weekly.trendDirection === 'COOLING' ? 'Soğuma Eğiliminde' : 'Kararlı / Stabil')}">
                    <i class="fa-solid ${trendIcon}" style="margin-right: 3px;"></i>${trendText}
                  </div>
                `;
              })()}
            </td>

            <!-- 8. Röntgen Teşhisi & Öneri -->
            <td style="padding: 10px 12px; max-width: 280px;">
              <div style="font-weight: 800; color: ${rec.color}; font-size: 0.8rem; margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
                <span>${rec.title}</span>
                <span style="font-size: 0.68rem; opacity: 0.8;">(%${rec.confidence})</span>
              </div>
              <div style="font-size: 0.72rem; color: #cbd0d8; line-height: 1.25;">
                ${rec.actionTitle}
              </div>
              ${peer?.generatorSensorAlert ? `
                <div style="margin-top: 5px; background: rgba(217, 70, 239, 0.1); border: 1px solid rgba(217, 70, 239, 0.3); border-radius: 4px; padding: 4px 7px; font-size: 0.7rem; color: #f5d0fe; display: flex; align-items: center; justify-content: space-between; gap: 6px;">
                  <span><i class="fa-solid fa-triangle-exclamation" style="color: #d946ef; margin-right: 4px;"></i><strong>${peer.generatorSensorAlert.sensorName}:</strong> ${peer.generatorSensorAlert.detail}</span>
                  <button onclick="window.createSensorFaultTask('${t.id}')" style="background: rgba(217,70,239,0.25); border: 1px solid #d946ef; border-radius: 3px; color: #fff; font-size: 0.65rem; padding: 2px 6px; cursor: pointer; white-space: nowrap;">
                    Görev Aç
                  </button>
                </div>
              ` : ''}
            </td>

            <!-- 9. Önerilen Gres -->
            <td style="padding: 10px 12px; text-align: center;">
              ${rec.code === 'SENSOR_FAULT' ? `
                <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: #d946ef;">
                  0 kg
                </div>
                <div style="font-size: 0.65rem; color: #d946ef; font-weight: 800;">
                  Gres Basma!
                </div>
                <div style="font-size: 0.62rem; color: #8a8f98;">
                  Sensör Arızalı
                </div>
              ` : (rec.recommendedKg > 0 ? `
                <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: ${rec.color};">
                  ${rec.recommendedKg} kg
                </div>
                <div style="font-size: 0.68rem; color: #8a8f98;">
                  ${rec.targetBearingText}
                </div>
                ${rec.flushingRecommended ? `<span style="font-size: 0.65rem; color: #ff3b30; font-weight: 800;">Flushing</span>` : ''}
              ` : `
                <div style="color: #00ff66; font-size: 0.75rem; font-weight: 700;">Gerek Yok</div>
              `)}
            </td>

            <!-- 10. Son İşlem & Takip -->
            <td style="padding: 10px 12px; min-width: 130px;">
              ${followUpHtml}
            </td>

            <!-- 11. İşlemler Butonları -->
            <td style="padding: 10px 12px; text-align: right; white-space: nowrap;">
              <div style="display: flex; gap: 5px; justify-content: flex-end;">
                <button onclick="window.openThermalXRayModal('${t.id}')" title="Saha Akran Karşılaştırmalı Röntgen Aç" style="height: 30px; padding: 0 8px; background: rgba(0, 242, 254, 0.12); border: 1px solid rgba(0, 242, 254, 0.35); border-radius: 6px; color: var(--accent-cyan); font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                  <i class="fa-solid fa-microscope"></i> Röntgen
                </button>
                ${rec.code === 'SENSOR_FAULT' ? `
                  <button onclick="window.createSensorFaultTask('${t.id}')" title="Sensör Değişim Görevi Aç" style="height: 30px; padding: 0 8px; background: rgba(217, 70, 239, 0.15); border: 1px solid #d946ef; border-radius: 6px; color: #d946ef; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-screwdriver-wrench"></i> Sensör Görevi
                  </button>
                ` : `
                  ${peer?.generatorSensorAlert ? `
                    <button onclick="window.createSensorFaultTask('${t.id}')" title="Jeneratör Sensör Değişim Görevi Aç" style="height: 30px; padding: 0 8px; background: rgba(217, 70, 239, 0.15); border: 1px solid #d946ef; border-radius: 6px; color: #d946ef; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                      <i class="fa-solid fa-screwdriver-wrench"></i> Sensör Görevi
                    </button>
                  ` : ''}
                  <button onclick="window.openGreaseModal('${t.id}')" title="Gres Kaydı Gir" style="height: 30px; padding: 0 8px; background: rgba(255, 159, 67, 0.1); border: 1px solid rgba(255, 159, 67, 0.3); border-radius: 6px; color: #ff9f43; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-oil-can"></i> Gres
                  </button>
                  <button onclick="window.createThermalWorkOrder('${t.id}')" title="İş Emri Aç" style="height: 30px; padding: 0 8px; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 6px; color: #fff; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-wrench"></i> İş Emri
                  </button>
                `}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
};

(window as any).updateThermalUI = updateThermalUI;

(window as any).handleThermalSiteChange = () => {
  const siteFilterEl = document.getElementById('thermal-site-filter') as HTMLSelectElement;
  const sortFilterEl = document.getElementById('thermal-sort-filter') as HTMLSelectElement;
  if (siteFilterEl && sortFilterEl && siteFilterEl.value !== 'ALL') {
    sortFilterEl.value = 'TURBINE_ASC';
  }
  updateThermalUI();
};

(window as any).openThermalXRayModal = (turbineId: string) => {
  const modal = document.getElementById('thermal-xray-modal');
  const container = document.getElementById('thermal-xray-modal-content');
  if (!modal || !container) return;

  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  document.body.style.overflow = 'hidden';

  const allTurbines: any[] = (window as any).currentFleetTurbines || [];
  const turb = allTurbines.find(t => t.id === turbineId);
  if (!turb) return;

  const thermalDataMap: Record<string, any> = (window as any).bearingThermalData || {};
  const thermal = thermalDataMap[turbineId];
  if (!thermal) {
    alert("Bu türbin için canlı SCADA verisi bulunamadı.");
    document.body.style.overflow = '';
    return;
  }

  const peer = calculatePeerCohortAndXRay(turbineId, allTurbines, thermalDataMap);
  const rec = peer.diagnostic;
  const weekly = bearingService.getWeeklyEvaluation(turbineId, thermal);
  const deltaSign = thermal.deltaT > 0 ? '+' : '';

  const allGreaseLogs: BearingGreaseLog[] = (window as any).bearingGreaseLogs || bearingService.getCachedGreaseLogs() || [];
  const turbineGreaseLogs = allGreaseLogs.filter(g => g.turbineId === turbineId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const latestLog = turbineGreaseLogs.length > 0 ? turbineGreaseLogs[0] : null;

  let tempDiffText = '';
  let tempDiffColor = '#8a8f98';
  let tempDiffBadge = '';
  let dropAmount = 0;
  if (latestLog && latestLog.rearTempAtTime !== undefined && thermal.rearBearing !== null) {
    dropAmount = Number((latestLog.rearTempAtTime - thermal.rearBearing).toFixed(1));
    if (dropAmount >= 2.0) {
      tempDiffColor = '#00ff66';
      tempDiffBadge = '🟢 YAĞLAMA BAŞARILI / SOĞUMA SAĞLANDI';
      tempDiffText = `Müdahaleden sonra arka rulmanda ${dropAmount}°C net düşüş sağlandı. Termal seviye güvenli aralığa çekildi.`;
    } else if (dropAmount <= -2.0) {
      tempDiffColor = '#ff3b30';
      tempDiffBadge = '🚨 SICAKLIK DÜŞMEDİ / YÜKSELMEYE DEVAM EDİYOR';
      tempDiffText = `${latestLog.greaseAmountKg} kg yağ basılmasına rağmen arka rulman sıcaklığı +${Math.abs(dropAmount)}°C arttı! Mekanik yatak aşınması veya sürtünme riski.`;
    } else {
      tempDiffColor = '#ffcc00';
      tempDiffBadge = '▬ SICAKLIK STABİL / TAKİPTE';
      tempDiffText = `Sıcaklık seviyesi müdahale anı ile benzer aralıkta (±${Math.abs(dropAmount)}°C) stabil seyrediyor.`;
    }
  }

  const getNodeColor = (temp: number | null, isBearing = false) => {
    if (temp === null) return '#8a8f98';
    if (isBearing) {
      if (temp >= 55) return '#ff3b30';
      if (temp >= 48) return '#ff9f43';
      if (temp >= 42) return '#ffcc00';
      return '#00ff66';
    }
    if (temp >= 65) return '#ff3b30';
    if (temp >= 50) return '#ffcc00';
    return '#00f2fe';
  };

  const spinnerColor = getNodeColor(thermal.spinner);
  const frontColor = getNodeColor(thermal.frontBearing, true);
  const statorColor = getNodeColor(thermal.stator);
  const rearColor = getNodeColor(thermal.rearBearing, true);
  const nacelleColor = getNodeColor(thermal.nacelle || thermal.ambient);

  container.innerHTML = `
    <!-- Modal Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem; margin-bottom: 1.2rem;">
      <div>
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <span style="display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 8px; background: rgba(0, 242, 254, 0.15); color: var(--accent-cyan); font-size: 1.1rem;">
            <i class="fa-solid fa-microscope"></i>
          </span>
          <h2 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; font-weight: 800; color: #fff;">
            ${turb.siteName} • ${turb.turbineNo || turb.name}
          </h2>
          ${turb.model ? `<span style="font-size: 0.75rem; color: var(--accent-cyan); background: rgba(0,242,254,0.1); border: 1px solid rgba(0,242,254,0.3); padding: 2px 8px; border-radius: 4px; font-weight: 800;">${turb.model}</span>` : ''}
          <span style="font-size: 0.8rem; color: #8a8f98; font-family: monospace;">(Seri No: <strong style="color: #fff;">${turb.id}</strong>)</span>
        </div>
        <p style="margin: 6px 0 0 0; font-size: 0.8rem; color: #8a8f98;">
          Aktif Çalışma Noktası Röntgeni & Akran Türbin Karşılaştırmalı Termal Arıza Teşhis Raporu
        </p>
      </div>
      <button type="button" onclick="window.closeThermalXRayModal()" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; width: 32px; height: 32px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem;">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>

    <!-- Operating Point Badges Strip -->
    <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 14px; margin-bottom: 1.2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
      <div style="display: flex; gap: 14px; flex-wrap: wrap; font-size: 0.82rem;">
        <div><i class="fa-solid fa-wind" style="color: #00f2fe; margin-right: 4px;"></i> Rüzgar: <strong style="color: #fff;">${thermal.windSpeed !== null ? `${thermal.windSpeed} m/s` : '--'}</strong></div>
        <div><i class="fa-solid fa-arrows-spin" style="color: #ffcc00; margin-right: 4px;"></i> Rotor Devri: <strong style="color: #fff;">${thermal.rotorSpeed !== null ? `${thermal.rotorSpeed} RPM` : '--'}</strong></div>
        ${thermal.rotor !== null ? `<div><i class="fa-solid fa-fire" style="color: #ff9f43; margin-right: 4px;"></i> Rotor: <strong style="color: #fff;">${thermal.rotor}°C</strong> ${thermal.rotor1 !== null && thermal.rotor2 !== null ? `<span style="color: #8a8f98; font-size: 0.72rem;">(R1: ${thermal.rotor1}° / R2: ${thermal.rotor2}°)</span>` : ''}</div>` : ''}
        <div><i class="fa-solid fa-bolt" style="color: #ff9f43; margin-right: 4px;"></i> Aktif Güç: <strong style="color: #fff;">${thermal.powerKw !== null ? `${thermal.powerKw.toLocaleString('tr-TR')} kW` : '--'}</strong></div>
        <div><i class="fa-solid fa-circle-dot" style="color: #00ff66; margin-right: 4px;"></i> Durum: <strong style="color: #cbd0d8;">${thermal.statusText || 'Normal Üretimde'}</strong></div>
      </div>
      <div style="font-size: 0.72rem; color: #8a8f98; font-family: monospace;">
        SCADA Canlı Telemetri
      </div>
    </div>

    <!-- DRIVETRAIN THERMAL RÖNTGEN FLOW SCHEMATIC -->
    <div style="background: rgba(10, 15, 24, 0.85); border: 1px solid rgba(0, 242, 254, 0.25); border-radius: 12px; padding: 1.2rem; margin-bottom: 1.2rem;">
      <div style="font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; font-weight: 800; color: #fff; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
        <span><i class="fa-solid fa-diagram-project" style="color: var(--accent-cyan); margin-right: 6px;"></i> Güç Aktarım Hattı (Drivetrain) Termal Röntgen Akış Şeması</span>
        <span style="font-size: 0.72rem; color: #8a8f98; font-family: sans-serif; font-weight: normal;">Rüzgar Yönü ➔ Spinner ➔ Jeneratör ➔ Gondol</span>
      </div>

      <!-- Flow Nodes Grid -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
        <!-- Node 1: Spinner -->
        <div style="flex: 1; min-width: 105px; background: rgba(0,0,0,0.4); border: 1px solid ${spinnerColor}44; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 0.7rem; color: #8a8f98; font-weight: 700;">SPINNER / GÖBEK</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.35rem; font-weight: 800; color: ${spinnerColor}; margin: 2px 0;">
            ${thermal.spinner !== null ? `${thermal.spinner}°C` : '--'}
          </div>
          <div style="font-size: 0.65rem; color: #6b7280;">Kanat Kökü</div>
        </div>

        <div style="color: rgba(255,255,255,0.3); font-size: 1.1rem;"><i class="fa-solid fa-arrow-right"></i></div>

        <!-- Node 2: Ön Rulman -->
        <div style="flex: 1; min-width: 115px; background: rgba(0,0,0,0.4); border: 1px solid ${frontColor}55; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 0.7rem; color: #cbd0d8; font-weight: 700;">ÖN RULMAN</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.35rem; font-weight: 800; color: ${frontColor}; margin: 2px 0;">
            ${thermal.frontBearing}°C
          </div>
          <div style="font-size: 0.65rem; color: #6b7280;">Yatak Ön Taraf</div>
        </div>

        <div style="color: rgba(255,255,255,0.3); font-size: 1.1rem;"><i class="fa-solid fa-arrow-right"></i></div>

        <!-- Node 3: Jeneratör Stator -->
        <div style="flex: 1; min-width: 125px; background: rgba(0,0,0,0.4); border: 1px solid ${statorColor}44; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 0.7rem; color: #00f2fe; font-weight: 700;">JENERATÖR STATOR</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.35rem; font-weight: 800; color: ${statorColor}; margin: 2px 0;">
            ${thermal.stator !== null ? `${thermal.stator}°C` : '--'}
          </div>
          ${thermal.stator1 !== null && thermal.stator2 !== null ? `
            <div style="font-size: 0.65rem; color: #cbd0d8;">S1: ${thermal.stator1}°C • S2: ${thermal.stator2}°C</div>
          ` : `<div style="font-size: 0.65rem; color: #6b7280;">Elektriksel Yük</div>`}
        </div>

        <div style="color: rgba(255,255,255,0.3); font-size: 1.1rem;"><i class="fa-solid fa-arrow-right"></i></div>

        <!-- Node 4: Arka Rulman -->
        <div style="flex: 1.1; min-width: 125px; background: ${rec.code === 'CONFIRMED' ? 'rgba(255, 59, 48, 0.12)' : 'rgba(0,0,0,0.4)'}; border: 2px solid ${rearColor}; border-radius: 8px; padding: 10px; text-align: center; box-shadow: 0 0 15px ${rearColor}33;">
          <div style="font-size: 0.72rem; color: #fff; font-weight: 800; letter-spacing: 0.5px;">ARKA RULMAN</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.45rem; font-weight: 900; color: ${rearColor}; margin: 2px 0;">
            ${thermal.rearBearing}°C
          </div>
          <div style="font-size: 0.68rem; font-weight: 700; color: ${rec.color};">ΔT: ${deltaSign}${thermal.deltaT}°C</div>
        </div>

        <div style="color: rgba(255,255,255,0.3); font-size: 1.1rem;"><i class="fa-solid fa-arrow-right"></i></div>

        <!-- Node 5: Gondol / Dış -->
        <div style="flex: 1; min-width: 105px; background: rgba(0,0,0,0.4); border: 1px solid ${nacelleColor}44; border-radius: 8px; padding: 10px; text-align: center;">
          <div style="font-size: 0.7rem; color: #8a8f98; font-weight: 700;">GONDOL / DIŞ</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.35rem; font-weight: 800; color: ${nacelleColor}; margin: 2px 0;">
            ${thermal.nacelle !== null ? `${thermal.nacelle}°C` : (thermal.ambient !== null ? `${thermal.ambient}°C` : '--')}
          </div>
          <div style="font-size: 0.65rem; color: #6b7280;">Ortam Sıcaklığı</div>
        </div>
      </div>

      <!-- Stator Isolation Proof Box -->
      ${peer.diagnostic.statorIsolated ? `
        <div style="background: rgba(255, 59, 48, 0.08); border: 1px solid rgba(255, 59, 48, 0.3); border-radius: 8px; padding: 10px 14px; margin-top: 12px; font-size: 0.78rem; color: #ffb4b4; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-shield-halved" style="color: #ff3b30; font-size: 1.2rem;"></i>
          <div>
            <strong style="color: #fff;">Stator İzolasyon Kanıtı:</strong> ${peer.diagnostic.isolationNote}
            Isınma jeneratörden arka rulmana yayılmamakta, <strong>doğrudan yatak içi mekanik sürtünme ve metal temasından</strong> kaynaklanmaktadır.
          </div>
        </div>
      ` : `
        <div style="background: rgba(0, 242, 254, 0.06); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 8px; padding: 10px 14px; margin-top: 12px; font-size: 0.78rem; color: #cbd0d8; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-circle-info" style="color: var(--accent-cyan); font-size: 1.1rem;"></i>
          <div>
            <strong>Termal Etki Durumu:</strong> ${peer.diagnostic.isolationNote}
          </div>
        </div>
      `}
    </div>

    <!-- PEER COHORT BENCHMARK COMPARISON TABLE -->
    <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; overflow: hidden; margin-bottom: 1.2rem;">
      <div style="background: rgba(255,255,255,0.03); padding: 8px 14px; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.95rem; color: #fff; display: flex; justify-content: space-between; align-items: center;">
        <span><i class="fa-solid fa-scale-balanced" style="color: #ffcc00; margin-right: 6px;"></i> Akran Karşılaştırma Matrisi (Aynı Çalışma Noktası)</span>
        <span style="font-size: 0.72rem; color: #8a8f98; font-family: sans-serif; font-weight: normal;">Akran Grubu: <strong>${peer.cohortDescription}</strong> (${peer.cohortCount} Türbin)</span>
      </div>
      <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
        <thead>
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: #8a8f98; font-size: 0.75rem;">
            <th style="padding: 8px 12px;">METRİK</th>
            <th style="padding: 8px 12px; text-align: center;">BU TÜRBİN</th>
            <th style="padding: 8px 12px; text-align: center;">AKRAN MEDYANI</th>
            <th style="padding: 8px 12px; text-align: center;">SAPMA (Δ)</th>
            <th style="padding: 8px 12px;">RÖNTGEN DEĞERLENDİRMESİ</th>
          </tr>
        </thead>
        <tbody>
          <!-- Arka Rulman -->
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
            <td style="padding: 8px 12px; font-weight: 700; color: #fff;">Arka Rulman Sıcaklığı</td>
            <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: ${rearColor}; font-size: 0.95rem;">${thermal.rearBearing}°C</td>
            <td style="padding: 8px 12px; text-align: center; color: #cbd0d8;">${peer.cohortRearMedian}°C</td>
            <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: ${peer.peerRearDev >= 5.0 ? '#ff3b30' : (peer.peerRearDev >= 3.0 ? '#ffcc00' : '#00ff66')};">
              ${peer.peerRearDev > 0 ? `+${peer.peerRearDev}` : peer.peerRearDev}°C
            </td>
            <td style="padding: 8px 12px; font-size: 0.75rem;">
              ${peer.peerRearDev >= 5.0 ? `<span style="color: #ff3b30; font-weight: 700;">🚨 Akranlarından belirgin derecede aşırı sıcak!</span>` : (peer.peerRearDev >= 3.0 ? `<span style="color: #ffcc00; font-weight: 700;">⚠️ Dikkat: Akran ortalamasının üzerinde</span>` : `<span style="color: #00ff66;">🟢 Akran değerleriyle dengeli</span>`)}
            </td>
          </tr>

          <!-- Ön Rulman -->
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
            <td style="padding: 8px 12px; font-weight: 700; color: #fff;">Ön Rulman Sıcaklığı</td>
            <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: ${frontColor}; font-size: 0.95rem;">${thermal.frontBearing}°C</td>
            <td style="padding: 8px 12px; text-align: center; color: #cbd0d8;">${peer.cohortFrontMedian}°C</td>
            <td style="padding: 8px 12px; text-align: center; color: #cbd0d8;">
              ${(thermal.frontBearing - peer.cohortFrontMedian) > 0 ? '+' : ''}${(thermal.frontBearing - peer.cohortFrontMedian).toFixed(1)}°C
            </td>
            <td style="padding: 8px 12px; font-size: 0.75rem; color: #00ff66;">
              🟢 Normal termal seviye
            </td>
          </tr>

          <!-- Rulman Farkı (ΔT) -->
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
            <td style="padding: 8px 12px; font-weight: 700; color: #fff;">Rulmanlar Arası Fark (ΔT)</td>
            <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: ${rec.color}; font-size: 0.95rem;">${deltaSign}${thermal.deltaT}°C</td>
            <td style="padding: 8px 12px; text-align: center; color: #cbd0d8;">${peer.cohortDeltaMedian > 0 ? '+' : ''}${peer.cohortDeltaMedian}°C</td>
            <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: ${peer.peerDeltaDev >= 5.0 ? '#ff3b30' : (peer.peerDeltaDev >= 3.0 ? '#ffcc00' : '#00ff66')};">
              ${peer.peerDeltaDev > 0 ? `+${peer.peerDeltaDev}` : peer.peerDeltaDev}°C
            </td>
            <td style="padding: 8px 12px; font-size: 0.75rem;">
              ${Math.abs(thermal.deltaT) >= 8 ? `<span style="color: #ff3b30; font-weight: 700;">🚨 Enercon limit aşımı (Tavsiye: ΔT ≤ 4°C)</span>` : (Math.abs(thermal.deltaT) >= 5 ? `<span style="color: #ffcc00; font-weight: 700;">⚠️ Sınır bölge</span>` : `<span style="color: #00ff66;">🟢 Sağlam / Dengeli</span>`)}
            </td>
          </tr>

          <!-- Jeneratör Stator (2 Sensör) -->
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
            <td style="padding: 8px 12px; font-weight: 700; color: #fff;">Jeneratör Stator (S1 / S2)</td>
            <td style="padding: 8px 12px; text-align: center; font-weight: 700; color: #00f2fe; font-size: 0.95rem;">
              ${thermal.stator !== null ? `${thermal.stator}°C` : '--'}
              ${thermal.stator1 !== null && thermal.stator2 !== null ? `<div style="font-size: 0.68rem; color: #8a8f98;">S1: ${thermal.stator1}°C | S2: ${thermal.stator2}°C</div>` : ''}
            </td>
            <td style="padding: 8px 12px; text-align: center; color: #cbd0d8;">
              ${peer.cohortStatorMedian !== null ? `${peer.cohortStatorMedian}°C` : '--'}
            </td>
            <td style="padding: 8px 12px; text-align: center; font-weight: 700; color: ${Math.abs(peer.statorDev ?? 0) > 12 ? '#ffcc00' : '#00ff66'};">
              ${(peer.statorDev ?? 0) > 0 ? `+${peer.statorDev}` : (peer.statorDev ?? 0)}°C
            </td>
            <td style="padding: 8px 12px; font-size: 0.75rem;">
              ${Math.abs(peer.statorDev ?? 0) <= 12
                ? `<span style="color: #00ff66;">🟢 Akran statör yüküyle homojen (Arka rulmandaki +${peer.peerRearDev}°C fark statörden değil, mekanik yatak sürtünmesindendir)</span>`
                : `<span style="color: #ffcc00;">⚠️ Statör akran medyanından farklı (+${peer.statorDev}°C)</span>`}
            </td>
          </tr>

          <!-- Rotor Devri & Güç -->
          <tr>
            <td style="padding: 8px 12px; font-weight: 700; color: #fff;">Çalışma Devri & Yük</td>
            <td style="padding: 8px 12px; text-align: center; color: #fff; font-weight: 700;">${thermal.rotorSpeed ?? '--'} RPM • ${thermal.powerKw ?? '--'} kW</td>
            <td style="padding: 8px 12px; text-align: center; color: #cbd0d8;">${peer.cohortRpmMedian ?? '--'} RPM • ${peer.cohortPowerMedian ?? '--'} kW</td>
            <td style="padding: 8px 12px; text-align: center; color: #00f2fe;">Eşit Yük</td>
            <td style="padding: 8px 12px; font-size: 0.75rem; color: #8a8f98;">
              Aynı rüzgar ve mekanik yük altında kıyaslandı
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- GENERATOR SENSOR ALERT BANNER (IF ANY) -->
    ${peer.generatorSensorAlert ? `
      <div style="background: rgba(217, 70, 239, 0.1); border: 1px solid rgba(217, 70, 239, 0.35); border-radius: 12px; padding: 1rem 1.2rem; margin-bottom: 1.2rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(217, 70, 239, 0.2); color: #d946ef; display: flex; align-items: center; justify-content: center; font-size: 1.1rem;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; font-weight: 800; color: #fff;">
              ${peer.generatorSensorAlert.sensorName} Hatası Tespit Edildi
            </div>
            <div style="font-size: 0.78rem; color: #f5d0fe; margin-top: 2px;">
              ${peer.generatorSensorAlert.detail}
            </div>
          </div>
        </div>
        <button type="button" onclick="window.closeThermalXRayModal(); window.createSensorFaultTask('${turb.id}');" style="padding: 0.45rem 1rem; background: rgba(217, 70, 239, 0.2); border: 1px solid #d946ef; border-radius: 6px; color: #d946ef; font-size: 0.78rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-screwdriver-wrench"></i> Sensör Görevi Aç
        </button>
      </div>
    ` : ''}

    <!-- AUTONOMOUS AGENT DIAGNOSTIC & ACTION DECISION -->
    <div style="background: ${rec.badgeBg}; border: 1px solid ${rec.badgeBorder}; border-radius: 12px; padding: 1.2rem; margin-bottom: 1.2rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: ${rec.color}; display: flex; align-items: center; gap: 8px;">
          ${rec.title}
        </div>
        <div style="background: rgba(0,0,0,0.4); border: 1px solid ${rec.color}44; border-radius: 6px; padding: 2px 10px; font-size: 0.78rem; font-weight: 800; color: ${rec.color};">
          Güven Oranı: %${rec.confidence}
        </div>
      </div>

      <div style="font-size: 0.82rem; color: #e2e8f0; line-height: 1.5; margin-bottom: 12px;">
        ${rec.explanation}
      </div>

      <!-- Prescribed Maintenance Action Box -->
      <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
        <div>
          <div style="font-size: 0.72rem; color: #8a8f98; text-transform: uppercase;">Önerilen Müdahale & Bakım Standardı:</div>
          <div style="font-size: 0.88rem; font-weight: 800; color: #fff;">
            ${rec.actionTitle}
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          ${rec.recommendedKg > 0 ? `
            <div style="text-align: right;">
              <div style="font-size: 0.7rem; color: #8a8f98;">Önerilen Gres Miktarı:</div>
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.35rem; font-weight: 900; color: ${rec.color};">
                ${rec.recommendedKg} kg
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>

    <!-- 7 GÜNLÜK DÖNGÜSEL ISIL EĞİLİM & HAFTALIK RÖNTGEN RAPORU -->
    <div style="background: rgba(13, 20, 35, 0.9); border: 1px solid rgba(0, 242, 254, 0.25); border-radius: 12px; padding: 1.2rem; margin-bottom: 1.2rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
        <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-chart-line" style="color: var(--accent-cyan);"></i> 7 Günlük Isıl Eğilim & Döngüsel Takip (Kamera NVR Döngüsü)
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.72rem; color: #8a8f98; font-family: monospace;">
          <span style="background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.2); padding: 2px 8px; border-radius: 4px; color: var(--accent-cyan);">
            <i class="fa-solid fa-rotate" style="margin-right: 4px;"></i> 7 Günlük FIFO Tampon
          </span>
          <span>${weekly.oldestDateFormatted} → ${weekly.newestDateFormatted}</span>
        </div>
      </div>

      <!-- Haftalık KPI Sayaç Şeridi (4 Kart) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 14px;">
        <!-- Haftalık Ortalama Fark -->
        <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 10px; text-align: center;">
          <div style="font-size: 0.68rem; color: #8a8f98; text-transform: uppercase;">Haftalık Ort. ΔT</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.35rem; font-weight: 800; color: ${weekly.avgDeltaT >= 8 ? '#ff3b30' : (weekly.avgDeltaT >= 5 ? '#ffcc00' : '#00ff66')}; margin: 2px 0;">
            ${weekly.avgDeltaT > 0 ? '+' : ''}${weekly.avgDeltaT}°C
          </div>
          <div style="font-size: 0.65rem; color: #6b7280;">Normal Eşik: &le; 4°C</div>
        </div>

        <!-- Haftalık Zirve Sıcaklık -->
        <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 10px; text-align: center;">
          <div style="font-size: 0.68rem; color: #8a8f98; text-transform: uppercase;">Zirve Arka Rulman</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.35rem; font-weight: 800; color: ${weekly.maxRear >= 55 ? '#ff3b30' : (weekly.maxRear >= 45 ? '#ff9f43' : '#00ff66')}; margin: 2px 0;">
            ${weekly.maxRear}°C
          </div>
          <div style="font-size: 0.65rem; color: #6b7280;">Haftalık Tepe Değer</div>
        </div>

        <!-- Isıl Eğilim / Drift -->
        <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 10px; text-align: center;">
          <div style="font-size: 0.68rem; color: #8a8f98; text-transform: uppercase;">Isıl Eğilim (Trend)</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: ${weekly.trendDirection === 'RISING' ? '#ff3b30' : (weekly.trendDirection === 'COOLING' ? '#00f2fe' : '#00ff66')}; margin: 4px 0;">
            ${weekly.trendDirection === 'RISING' ? '▲ YÜKSELEN' : (weekly.trendDirection === 'COOLING' ? '▼ SOĞUYAN' : '▬ KARARLI')}
          </div>
          <div style="font-size: 0.65rem; color: #8a8f98;">${weekly.driftPerDay > 0 ? '+' : ''}${weekly.driftPerDay}°C / gün</div>
        </div>

        <!-- Kritik Eşik Maruziyeti -->
        <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px 10px; text-align: center;">
          <div style="font-size: 0.68rem; color: #8a8f98; text-transform: uppercase;">Kritik Maruziyet</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.35rem; font-weight: 800; color: ${weekly.hoursAboveThreshold > 10 ? '#ff3b30' : (weekly.hoursAboveThreshold > 0 ? '#ffcc00' : '#00ff66')}; margin: 2px 0;">
            ${weekly.hoursAboveThreshold} Saat
          </div>
          <div style="font-size: 0.65rem; color: #6b7280;">ΔT &ge; 8°C Süresi</div>
        </div>
      </div>

      <!-- 7 Günlük Isıl Çubuk Histogramı -->
      <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
        <div style="font-size: 0.72rem; color: #8a8f98; margin-bottom: 8px; display: flex; justify-content: space-between;">
          <span><strong>7 Günlük Ortalama ΔT Dağılımı:</strong> (Günlük Rulman Isı Farkları)</span>
          <span style="font-size: 0.68rem; color: #00ff66;">Yeşil &le; 4°C • <span style="color: #ffcc00;">Sarı 5-7°C</span> • <span style="color: #ff3b30;">Kırmızı &ge; 8°C</span></span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; align-items: flex-end; height: 85px; padding-top: 10px;">
          ${weekly.dailyBars.map(bar => {
            const barHeightPct = Math.min(100, Math.max(15, (bar.avgDeltaT / 14) * 100));
            const barColor = bar.avgDeltaT >= 8 ? '#ff3b30' : (bar.avgDeltaT >= 5 ? '#ffcc00' : '#00ff66');
            return `
              <div style="display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end;" title="${bar.dateLabel}: Ort ΔT ${bar.avgDeltaT}°C | Zirve Arka: ${bar.maxRear}°C">
                <span style="font-family: 'Rajdhani', sans-serif; font-size: 0.72rem; font-weight: 800; color: ${barColor}; margin-bottom: 2px;">
                  ${bar.avgDeltaT > 0 ? '+' : ''}${bar.avgDeltaT}°
                </span>
                <div style="width: 100%; max-width: 32px; height: ${barHeightPct}%; background: ${barColor}; border-radius: 3px 3px 0 0; opacity: 0.85; transition: height 0.3s;"></div>
                <div style="border-top: 1px solid rgba(255,255,255,0.1); width: 100%; text-align: center; padding-top: 3px; margin-top: 2px;">
                  <div style="font-size: 0.68rem; font-weight: 700; color: #fff;">${bar.dayLabel}</div>
                  <div style="font-size: 0.6rem; color: #6b7280;">${bar.dateLabel.split(' ')[0]}</div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Bilgi Dipnotu: NVR Döngüsü -->
      <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.72rem; color: #8a8f98; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 8px;">
        <div>
          <i class="fa-solid fa-video" style="color: var(--accent-cyan); margin-right: 4px;"></i>
          <strong>Kamera NVR Döngü Prensibi:</strong> 7 günlük tampon dolduğunda, en eski gün (1. gün) otomatik olarak serbest bırakılır. Hem anlık teşhis hem de kronik yatak yorulması haftalık izlenir.
        </div>
      </div>
    </div>

    <!-- SAHA MÜDAHALE & ISIL DOĞRULAMA (ÖNCESİ / SONRASI KIYASI) -->
    <div style="background: rgba(10, 15, 24, 0.9); border: 1px solid ${latestLog ? (dropAmount >= 2 ? 'rgba(0, 255, 102, 0.3)' : (dropAmount <= -2 ? 'rgba(255, 59, 48, 0.3)' : 'rgba(255, 159, 67, 0.3)')) : 'rgba(255,255,255,0.08)'}; border-radius: 12px; padding: 1.2rem; margin-bottom: 1.2rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
        <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-wrench" style="color: #ff9f43;"></i> Sahada Yapılan Son Müdahale & Isıl Doğrulama (Öncesi / Sonrası Kıyası)
        </div>
        ${latestLog ? `
          <div style="background: rgba(255, 159, 67, 0.1); border: 1px solid rgba(255, 159, 67, 0.25); padding: 2px 10px; border-radius: 4px; font-size: 0.72rem; color: #ff9f43; font-weight: 700;">
            <i class="fa-solid fa-clock-rotate-left" style="margin-right: 4px;"></i> ${latestLog.dateFormatted}
          </div>
        ` : ''}
      </div>

      ${latestLog ? `
        <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; margin-bottom: 12px;">
          <!-- Left: Intervention Details -->
          <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 12px; font-size: 0.78rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="color: #8a8f98;">İşlem Türü:</span>
              <strong style="color: #fff;">${latestLog.actionType === 'FLUSHING' ? 'Flushing (İç Yıkama)' : 'Gres Yağlama Basımı'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="color: #8a8f98;">Basılan Miktar & Tip:</span>
              <strong style="color: #ff9f43; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem;">${latestLog.greaseAmountKg} kg <span style="font-size: 0.75rem; color: #8a8f98;">(${latestLog.greaseType || 'Mobil SHC 460 WT'})</span></strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="color: #8a8f98;">Hedef Yatak:</span>
              <strong style="color: #cbd0d8;">${latestLog.targetBearing === 'REAR' ? 'Arka Rulman' : (latestLog.targetBearing === 'FRONT' ? 'Ön Rulman' : 'Ön ve Arka Rulman')}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #8a8f98;">Uygulayan Teknisyen:</span>
              <strong style="color: #cbd0d8;"><i class="fa-solid fa-user-check" style="color: var(--accent-cyan); margin-right: 4px;"></i>${latestLog.technician}</strong>
            </div>
            ${latestLog.notes ? `
              <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.05); color: #cbd0d8; font-style: italic;">
                "${latestLog.notes}"
              </div>
            ` : ''}
          </div>

          <!-- Right: Before & After Verification -->
          <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="display: flex; justify-content: space-around; align-items: center; text-align: center; margin-bottom: 6px;">
              <div>
                <div style="font-size: 0.68rem; color: #8a8f98; text-transform: uppercase;">İşlem Öncesi</div>
                <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; font-weight: 800; color: #ff9f43;">
                  ${latestLog.rearTempAtTime !== undefined ? `${latestLog.rearTempAtTime}°C` : '--'}
                </div>
                <div style="font-size: 0.65rem; color: #6b7280;">ΔT: ${latestLog.deltaTAtTime !== undefined ? `${latestLog.deltaTAtTime > 0 ? '+' : ''}${latestLog.deltaTAtTime}°C` : '--'}</div>
              </div>
              <div style="color: rgba(255,255,255,0.3); font-size: 1rem;"><i class="fa-solid fa-arrow-right"></i></div>
              <div>
                <div style="font-size: 0.68rem; color: #8a8f98; text-transform: uppercase;">Şu Anki Durum</div>
                <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; font-weight: 800; color: #fff;">
                  ${thermal.rearBearing}°C
                </div>
                <div style="font-size: 0.65rem; color: ${rec.color}; font-weight: 700;">ΔT: ${deltaSign}${thermal.deltaT}°C</div>
              </div>
            </div>

            <!-- Conclusion Verdict -->
            <div style="background: rgba(0,0,0,0.4); border: 1px solid ${tempDiffColor}44; border-radius: 6px; padding: 6px 10px; text-align: center;">
              <div style="font-weight: 800; font-size: 0.75rem; color: ${tempDiffColor};">${tempDiffBadge}</div>
              <div style="font-size: 0.72rem; color: #cbd0d8; margin-top: 2px;">${tempDiffText}</div>
            </div>
          </div>
        </div>
      ` : `
        <div style="text-align: center; padding: 1rem; color: #8a8f98; font-size: 0.8rem; background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px dashed rgba(255,255,255,0.06);">
          <i class="fa-solid fa-oil-can" style="margin-right: 6px; color: #ff9f43;"></i> Bu türbin için henüz sistemde kayıtlı bir gres veya flushing müdahalesi bulunmuyor. Müdahale yapıldığında öncesi/sonrası sıcaklık kıyası burada anlık raporlanacaktır.
        </div>
      `}
    </div>

    <!-- Modal Footer Actions -->
    <div style="display: flex; justify-content: flex-end; align-items: center; gap: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem;">
      <button type="button" onclick="window.closeThermalXRayModal()" style="padding: 0.5rem 1.2rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 0.85rem; cursor: pointer;">
        Kapat
      </button>

      ${rec.code === 'SENSOR_FAULT' ? `
        <button type="button" onclick="window.closeThermalXRayModal(); window.createSensorFaultTask('${turb.id}');" style="padding: 0.5rem 1.4rem; background: rgba(217, 70, 239, 0.2); border: 1px solid #d946ef; border-radius: 6px; color: #d946ef; font-size: 0.85rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-screwdriver-wrench"></i> 🔧 Sensör Arıza Görevi Oluştur
        </button>
      ` : `
        ${peer.generatorSensorAlert ? `
          <button type="button" onclick="window.closeThermalXRayModal(); window.createSensorFaultTask('${turb.id}');" style="padding: 0.5rem 1.2rem; background: rgba(217, 70, 239, 0.2); border: 1px solid #d946ef; border-radius: 6px; color: #d946ef; font-size: 0.85rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-screwdriver-wrench"></i> 🔧 Jeneratör Sensör Görevi
          </button>
        ` : ''}
        <button type="button" onclick="window.closeThermalXRayModal(); window.openGreaseModal('${turb.id}');" style="padding: 0.5rem 1.2rem; background: rgba(255, 159, 67, 0.15); border: 1px solid #ff9f43; border-radius: 6px; color: #ff9f43; font-size: 0.85rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-oil-can"></i> Gres / Flushing Kaydı Aç
        </button>

        <button type="button" onclick="window.closeThermalXRayModal(); window.createThermalWorkOrder('${turb.id}');" style="padding: 0.5rem 1.4rem; background: rgba(0, 242, 254, 0.15); border: 1px solid var(--accent-cyan); border-radius: 6px; color: var(--accent-cyan); font-size: 0.85rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-wrench"></i> ${rec.requiresWorkOrder ? '🚨 Acil İş Emri Oluştur' : 'İş Emri Aç'}
        </button>
      `}
    </div>
  `;

  modal.style.display = 'flex';
};

(window as any).closeThermalXRayModal = () => {
  const modal = document.getElementById('thermal-xray-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
};

(window as any).updateThermalUI = updateThermalUI;

(window as any).openGreaseModal = (turbineId: string) => {
  const modal = document.getElementById('thermal-grease-modal');
  if (!modal) return;

  if (modal.parentElement !== document.body) {
    document.body.appendChild(modal);
  }
  document.body.style.overflow = 'hidden';

  const allTurbines: any[] = (window as any).currentFleetTurbines || [];
  const turb = allTurbines.find(t => t.id === turbineId);
  if (!turb) return;

  const thermalData = (window as any).bearingThermalData?.[turbineId];

  // Set hidden inputs
  const idInput = document.getElementById('grease-modal-turbine-id') as HTMLInputElement;
  const siteIdInput = document.getElementById('grease-modal-site-id') as HTMLInputElement;
  const siteNameInput = document.getElementById('grease-modal-site-name') as HTMLInputElement;
  const labelInput = document.getElementById('grease-modal-turbine-label') as HTMLInputElement;

  if (idInput) idInput.value = turb.id;
  if (siteIdInput) siteIdInput.value = turb.siteId;
  if (siteNameInput) siteNameInput.value = turb.siteName;
  if (labelInput) labelInput.value = turb.name;

  // Display texts
  const nameEl = document.getElementById('grease-modal-display-name');
  const siteEl = document.getElementById('grease-modal-display-site');
  const tempsEl = document.getElementById('grease-modal-display-temps');

  if (nameEl) nameEl.textContent = `${turb.siteName} - ${turb.name}`;
  if (siteEl) siteEl.textContent = `Seri No: ${turb.id}`;

  if (tempsEl) {
    if (thermalData && thermalData.frontBearing !== null && thermalData.rearBearing !== null) {
      const deltaSign = thermalData.deltaT > 0 ? '+' : '';
      const peer = calculatePeerCohortAndXRay(turbineId, allTurbines, (window as any).bearingThermalData || {});
      const rec = peer.diagnostic;
      tempsEl.innerHTML = `
        <div>Ön: <strong style="color: #fff;">${thermalData.frontBearing}°C</strong> | Arka: <strong style="color: #fff;">${thermalData.rearBearing}°C</strong></div>
        <div style="color: ${rec.color}; font-weight: 800; font-size: 0.85rem;">ΔT: ${deltaSign}${thermalData.deltaT}°C (${rec.title})</div>
        ${peer.peerRearDev !== 0 ? `<div style="font-size: 0.72rem; color: #8a8f98;">Akran Sapması: <strong style="color: ${peer.peerRearDev >= 5 ? '#ff3b30' : '#ffcc00'};">${peer.peerRearDev > 0 ? '+' : ''}${peer.peerRearDev}°C</strong></div>` : ''}
      `;

      // Auto-preselect action and amount based on recommendation
      const actionSelect = document.getElementById('grease-modal-action-type') as HTMLSelectElement;
      const targetSelect = document.getElementById('grease-modal-target') as HTMLSelectElement;
      const amountInput = document.getElementById('grease-modal-amount') as HTMLInputElement;

      if (actionSelect && rec.flushingRecommended) actionSelect.value = 'FLUSHING';
      if (targetSelect) targetSelect.value = rec.targetBearing;
      if (amountInput && rec.recommendedKg > 0) amountInput.value = rec.recommendedKg.toString();
    } else {
      tempsEl.innerHTML = `<span style="color: #8a8f98;">Canlı SCADA sıcaklık verisi yok</span>`;
    }
  }

  // Pre-fill technician
  const currentUser = authService.getCurrentUser();
  const techInput = document.getElementById('grease-modal-tech') as HTMLInputElement;
  if (techInput) techInput.value = (currentUser as any)?.displayName || (currentUser as any)?.name || currentUser?.email || '';

  modal.style.display = 'flex';
};

(window as any).closeGreaseModal = () => {
  const modal = document.getElementById('thermal-grease-modal');
  if (modal) modal.style.display = 'none';
  document.body.style.overflow = '';
};

(window as any).saveGreaseModal = async (e: Event) => {
  e.preventDefault();
  const turbineId = (document.getElementById('grease-modal-turbine-id') as HTMLInputElement)?.value;
  if (!turbineId) return;

  const allTurbines: any[] = (window as any).currentFleetTurbines || [];
  const turb = allTurbines.find(t => t.id === turbineId);
  const thermalData = (window as any).bearingThermalData?.[turbineId];

  const actionType = (document.getElementById('grease-modal-action-type') as HTMLSelectElement)?.value as any;
  const targetBearing = (document.getElementById('grease-modal-target') as HTMLSelectElement)?.value as any;
  const amountKg = parseFloat((document.getElementById('grease-modal-amount') as HTMLInputElement)?.value) || 0;
  const greaseType = (document.getElementById('grease-modal-type') as HTMLSelectElement)?.value || '';
  const technician = (document.getElementById('grease-modal-tech') as HTMLInputElement)?.value || '';
  const notes = (document.getElementById('grease-modal-notes') as HTMLTextAreaElement)?.value || '';

  if (amountKg <= 0 && actionType !== 'SAMPLE_TAKEN') {
    alert("Lütfen basılan gres miktarını (kg) giriniz.");
    return;
  }

  const currentUser = authService.getCurrentUser();
  try {
    await bearingService.saveGreaseLog({
      turbineId,
      turbineLabel: turb?.name || turbineId,
      siteId: turb?.siteId || '',
      siteName: turb?.siteName || '',
      actionType,
      targetBearing,
      greaseAmountKg: amountKg,
      greaseType,
      technician: technician || (currentUser as any)?.displayName || (currentUser as any)?.name || currentUser?.email || 'Saha Teknisyeni',
      createdAt: new Date().toISOString(),
      dateFormatted: '',
      deltaTAtTime: thermalData?.deltaT ?? undefined,
      frontTempAtTime: thermalData?.frontBearing ?? undefined,
      rearTempAtTime: thermalData?.rearBearing ?? undefined,
      notes
    });

    (window as any).closeGreaseModal();
    alert(`✅ ${turb?.name || turbineId} için ${amountKg} kg gres kaydı başarıyla kaydedildi!`);
    updateThermalUI();
  } catch (err) {
    console.error("Gres kaydı hatası:", err);
    alert("Kayıt kaydedilemedi: " + err);
  }
};

(window as any).createThermalWorkOrder = async (turbineId: string) => {
  const allTurbines: any[] = (window as any).currentFleetTurbines || [];
  const turb = allTurbines.find(t => t.id === turbineId);
  if (!turb) return;

  const thermalData = (window as any).bearingThermalData?.[turbineId];
  if (!thermalData || thermalData.frontBearing === null || thermalData.rearBearing === null) {
    alert("Bu türbin için canlı sıcaklık verisi bulunamadı.");
    return;
  }

  const peer = calculatePeerCohortAndXRay(turbineId, allTurbines, (window as any).bearingThermalData || {});
  const rec = peer.diagnostic;
  const deltaSign = thermalData.deltaT > 0 ? '+' : '';
  const peerSign = peer.peerRearDev > 0 ? '+' : '';
  const confirmMsg = `${turb.siteName} - ${turb.name} (SN: ${turb.id}) için Rulman İş Emri oluşturulacak:\n\n` +
    `• Ön Rulman: ${thermalData.frontBearing}°C\n` +
    `• Arka Rulman: ${thermalData.rearBearing}°C\n` +
    `• Fark (ΔT): ${deltaSign}${thermalData.deltaT}°C\n` +
    `• Akran Sapması: ${peerSign}${peer.peerRearDev}°C\n` +
    `• Akran Grubu: ${peer.cohortDescription}\n` +
    `• Röntgen Teşhisi: ${rec.title} (Güven: %${rec.confidence})\n` +
    `• Talimat: ${rec.actionTitle}\n` +
    `• Önerilen Gres: ${rec.recommendedKg} kg\n\n` +
    `Görev ${turb.siteName} bölge havuzuna aktarılacak. İş emri oluşturulsun mu?`;

  if (!confirm(confirmMsg)) return;

  try {
    const adminNote = `[OTONOM RULMAN ANALİZ AJANI] Saha Röntgeni & Sıcaklık Anomalisi:\n` +
      `Ön Rulman: ${thermalData.frontBearing}°C | Arka Rulman: ${thermalData.rearBearing}°C | ΔT: ${deltaSign}${thermalData.deltaT}°C\n` +
      `Akran Sapması: ${peerSign}${peer.peerRearDev}°C (Akran: ${peer.cohortRearMedian}°C, ~${thermalData.rotorSpeed ?? '--'} RPM)\n` +
      `Akran Grubu: ${peer.cohortDescription}\n` +
      `Röntgen Teşhisi: ${rec.title} (Güven Oranı: %${rec.confidence})\n` +
      `Analiz Detayı: ${rec.explanation}\n` +
      `Talimat: ${rec.actionText}\n` +
      `Önerilen Gres Miktarı: ${rec.recommendedKg} kg (${rec.targetBearingText})\n` +
      `İşlem tamamlandıktan sonra DH Servis Rulman Analiz sekmesinden basılan kesin kg miktarını giriniz.`;

    const weekly = bearingService.getWeeklyEvaluation(turb.id, thermalData);
    const currentDelta = Math.round(Math.abs(thermalData.deltaT ?? (thermalData.rearBearing - thermalData.frontBearing)));
    const maxWeeklyDelta = Math.round(Math.abs(weekly?.maxDeltaT || currentDelta));
    const effectiveDelta = Math.max(currentDelta, maxWeeklyDelta);
    const actionSuffix = rec.flushingRecommended ? 'Rulman Kontrolü & Flushing Görevi' : 'Rulman Kontrolü Görevi';
    const taskTitle = `Tespit Edilen +${effectiveDelta}°C Fark ${actionSuffix}`;

    const currentUser = authService.getCurrentUser();
    await taskService.createNewTask({
      secilenSablon: 'Rulman Analizi',
      sahaBilgisi: turb.siteName,
      siteId: turb.siteId,
      turbinSeriNo: turb.id,
      turbinNo: turb.name,
      statuKodu: 'Rulman Analizi',
      statuAciklamasi: taskTitle,
      yoneticiNotu: adminNote,
      assignedTeam: 'Atanmadı',
      isPoolTask: true,
      createdBy: (currentUser as any)?.displayName || (currentUser as any)?.name || currentUser?.email || 'Rulman Analiz Ajanı'
    });

    alert(`✅ İş Emri başarıyla oluşturuldu!\n\n${turb.siteName} bölge havuzuna aktarıldı. İlgili bölge ekipleri görevi "BÖLGE GÖREVLERİ" veya "${turb.siteName}" sekmesinden üstlenip tamamlayabilir.`);
  } catch (err) {
    console.error("İş emri oluşturma hatası:", err);
    alert("İş emri oluşturulurken bir hata oluştu: " + err);
  }
};

(window as any).createSensorFaultTask = async (turbineId: string) => {
  const allTurbines: any[] = (window as any).currentFleetTurbines || [];
  const turb = allTurbines.find(t => t.id === turbineId);
  if (!turb) return;

  const thermalData = (window as any).bearingThermalData?.[turbineId];
  if (!thermalData) {
    alert("Bu türbin için telemetri verisi bulunamadı.");
    return;
  }

  const peer = calculatePeerCohortAndXRay(turbineId, allTurbines, (window as any).bearingThermalData || {});
  const rec = peer.diagnostic;
  const isGenAlertOnly = peer.generatorSensorAlert && rec.code !== 'SENSOR_FAULT';
  const taskMainTitle = isGenAlertOnly ? `${peer.generatorSensorAlert!.sensorName} Kontrolü` : rec.title;
  const taskMainDetail = isGenAlertOnly ? peer.generatorSensorAlert!.detail : rec.actionText;

  const confirmMsg = `${turb.siteName} - ${turb.name} (SN: ${turb.id}) için Sensör Değişim & Kontrol Görevi oluşturulacak:\n\n` +
    `• Teşhis: ${taskMainTitle}\n` +
    `• Detay: ${taskMainDetail}\n` +
    `• Ön Rulman Ölçümü: ${thermalData.frontBearing !== null ? `${thermalData.frontBearing}°C` : '--'}\n` +
    `• Arka Rulman Ölçümü: ${thermalData.rearBearing !== null ? `${thermalData.rearBearing}°C` : '--'}\n` +
    `• Stator Sensörleri: S1: ${thermalData.stator1 ?? '--'}°C | S2: ${thermalData.stator2 ?? '--'}°C\n` +
    `• Rotor Sensörleri: R1: ${thermalData.rotor1 ?? '--'}°C | R2: ${thermalData.rotor2 ?? '--'}°C\n\n` +
    `⚠️ UYARI: Bu arıza mekanik rulman arızası değil, elektriksel sensör/kablo arızasıdır.\n\n` +
    `Görev ${turb.siteName} bölge havuzuna aktarılsın mı?`;

  if (!confirm(confirmMsg)) return;

  try {
    const adminNote = `[OTONOM SENSÖR VE TERMAL DANIŞMAN]\n` +
      `Türbin: ${turb.siteName} ${turb.name} (Seri No: ${turb.id})\n` +
      `Arıza Türü: ${taskMainTitle}\n\n` +
      `ÖLÇÜLEN DEĞERLER:\n` +
      `- Ön Rulman: ${thermalData.frontBearing ?? '--'}°C\n` +
      `- Arka Rulman: ${thermalData.rearBearing ?? '--'}°C\n` +
      `- Stator (S1 / S2): ${thermalData.stator1 ?? '--'}°C / ${thermalData.stator2 ?? '--'}°C\n` +
      `- Rotor (R1 / R2): ${thermalData.rotor1 ?? '--'}°C / ${thermalData.rotor2 ?? '--'}°C\n\n` +
      `TALİMAT & SAHA AKSİYONU:\n` +
      `${taskMainDetail}\n\n` +
      `DİKKAT: Rulman mekanik durumu: ${rec.title}. Sensör hattı ve klemensler kontrol edilip gerekiyorsa PT100 sensör probu yenisiyle değiştirilmelidir.`;

    const currentUser = authService.getCurrentUser();
    await taskService.createNewTask({
      secilenSablon: 'Sensör Arızası',
      sahaBilgisi: turb.siteName,
      siteId: turb.siteId,
      turbinSeriNo: turb.id,
      turbinNo: turb.name,
      statuKodu: 'Sensör Arızası',
      statuAciklamasi: `PT100 Sıcaklık Sensörü Kontrol & Değişim Görevi (${rec.targetBearingText})`,
      yoneticiNotu: adminNote,
      assignedTeam: 'Atanmadı',
      isPoolTask: true,
      createdBy: (currentUser as any)?.displayName || (currentUser as any)?.name || currentUser?.email || 'Sensör Teşhis Ajanı'
    });

    alert(`✅ ${turb.siteName} ${turb.name} için Sensör Kontrol Görevi başarıyla oluşturuldu!\n\nGörev ${turb.siteName} bölge havuzuna aktarılmıştır.`);
    updateThermalUI();
  } catch (err) {
    console.error("Sensör görevi oluşturma hatası:", err);
    alert("Görev oluşturulamadı: " + err);
  }
};

const updateInspectionsUI = () => {
  const container = document.getElementById('bearing-inspections-list');
  if (!container) return;

  const list: BearingInspection[] = (window as any).bearingInspectionsList || bearingService.getCachedInspections() || [];

  const siteFilterEl = document.getElementById('insp-site-filter') as HTMLSelectElement;
  const typeFilterEl = document.getElementById('insp-type-filter') as HTMLSelectElement;
  const statusFilterEl = document.getElementById('insp-status-filter') as HTMLSelectElement;
  const searchInputEl = document.getElementById('insp-search-input') as HTMLInputElement;

  const siteFilter = siteFilterEl ? siteFilterEl.value : 'ALL';
  const typeFilter = typeFilterEl ? typeFilterEl.value : 'ALL';
  const statusFilter = statusFilterEl ? statusFilterEl.value : 'ALL';
  const searchTerm = searchInputEl ? searchInputEl.value.trim().toLowerCase() : '';

  const filtered = list.filter(insp => {
    if (siteFilter !== 'ALL' && insp.siteId !== siteFilter) return false;
    if (typeFilter !== 'ALL' && insp.type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && insp.condition !== statusFilter) return false;
    if (searchTerm) {
      const matchLabel = (insp.turbineLabel || '').toLowerCase().includes(searchTerm);
      const matchId = (insp.turbineId || '').toLowerCase().includes(searchTerm);
      const matchTech = (insp.inspector || '').toLowerCase().includes(searchTerm);
      const matchNotes = (insp.notes || '').toLowerCase().includes(searchTerm);
      const matchSite = (insp.siteName || '').toLowerCase().includes(searchTerm);
      if (!matchLabel && !matchId && !matchTech && !matchNotes && !matchSite) return false;
    }
    return true;
  });

  const countEl = document.getElementById('insp-total-count');
  if (countEl) countEl.innerText = String(filtered.length);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="glass-panel" style="text-align: center; padding: 3rem 1rem; border-radius: 8px; color: #8a8f98; background: rgba(10, 15, 24, 0.4); border: 1px dashed rgba(255,255,255,0.08);">
        <i class="fa-solid fa-clipboard-question" style="font-size: 2.2rem; color: #5a6070; margin-bottom: 0.8rem;"></i>
        <div style="font-weight: 700; color: #cbd0d8; font-size: 1rem; margin-bottom: 4px;">Kayıtlı Analiz Raporu Bulunamadı</div>
        <div style="font-size: 0.85rem; max-width: 450px; margin: 0 auto;">
          Akustik veya Gres modülünden analiz tamamlandıktan sonra "Analiz Raporunu Kaydet" butonuna basarak saha testlerini buraya arşivleyebilirsiniz.
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(insp => {
    const isCritical = insp.condition === 'CRITICAL';
    const isWarning = insp.condition === 'WARNING';
    const borderColor = isCritical ? '#ff3b30' : (isWarning ? '#ffcc00' : '#00ff66');
    const badgeBg = isCritical ? 'rgba(255, 59, 48, 0.12)' : (isWarning ? 'rgba(255, 204, 0, 0.12)' : 'rgba(0, 255, 102, 0.12)');
    const badgeColor = isCritical ? '#ff3b30' : (isWarning ? '#ffcc00' : '#00ff66');

    const isAcoustic = insp.type === 'ACOUSTIC';
    const typeBadge = isAcoustic
      ? `<span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(0, 242, 254, 0.1); color: var(--accent-cyan); border: 1px solid rgba(0, 242, 254, 0.3); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;"><i class="fa-solid fa-microphone-lines"></i> Akustik Ses</span>`
      : `<span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(168, 85, 247, 0.1); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;"><i class="fa-solid fa-flask"></i> Gres RAG</span>`;

    return `
      <div class="glass-panel" style="border-radius: 8px; background: rgba(10, 15, 24, 0.7); border: 1px solid rgba(255,255,255,0.06); border-left: 4px solid ${borderColor}; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; transition: background 0.2s;">
        <!-- Top Row -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 800; color: #fff; font-size: 1rem; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
              ${insp.siteName || ''} - ${insp.turbineLabel || insp.turbineId}
            </span>
            <span style="font-size: 0.72rem; color: #8a8f98; font-family: monospace;">(Seri: ${insp.turbineId})</span>
            ${typeBadge}
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 0.78rem; color: #8a8f98;"><i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${insp.dateFormatted || insp.createdAt}</span>
            <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}; padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 0.78rem; font-family: 'Rajdhani', sans-serif;">
              ${insp.condition}
            </span>
            <button onclick="window.deleteInspectionRecord('${insp.id}')" style="background: none; border: none; color: #8a8f98; cursor: pointer; padding: 4px; font-size: 0.85rem;" title="Raporu Sil">
              <i class="fa-solid fa-trash-can" onmouseover="this.style.color='#ff3b30'" onmouseout="this.style.color='#8a8f98'"></i>
            </button>
          </div>
        </div>

        <!-- Metrics Row -->
        <div style="display: flex; flex-wrap: wrap; gap: 12px; background: rgba(255,255,255,0.02); padding: 0.6rem 0.8rem; border-radius: 6px; font-size: 0.8rem;">
          ${isAcoustic ? `
            <div><span style="color: #8a8f98;">Pik Frekans:</span> <strong style="color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif; font-size: 0.95rem;">${insp.peakFrequency || '--'} Hz</strong></div>
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
            <div><span style="color: #8a8f98;">Vuruntu:</span> ${insp.knocksDetected ? '<strong style="color: #ff3b30;">MEVCUT</strong>' : '<strong style="color: #00ff66;">TEMİZ</strong>'}</div>
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
            <div><span style="color: #8a8f98;">Sürtünme:</span> ${insp.frictionDetected ? '<strong style="color: #ffcc00;">TESPİT EDİLDİ</strong>' : '<strong style="color: #00ff66;">TEMİZ</strong>'}</div>
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
            <div><span style="color: #8a8f98;">Yaw:</span> <strong style="color: #cbd0d8;">${insp.yawSimulationMode === 'WITH_YAW' ? 'Devrede' : 'Sabit'}</strong></div>
          ` : `
            <div><span style="color: #8a8f98;">Hasar Sınıfı:</span> <strong style="color: ${badgeColor}; font-weight: 800;">Sınıf ${insp.greaseClass || '--'}</strong></div>
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
            <div><span style="color: #8a8f98;">Fe:</span> <strong style="color: #cbd0d8;">${insp.fePpm !== undefined ? insp.fePpm + ' ppm' : '--'}</strong></div>
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
            <div><span style="color: #8a8f98;">PQ:</span> <strong style="color: #cbd0d8;">${insp.pqIndex !== undefined ? insp.pqIndex : '--'}</strong></div>
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
            <div><span style="color: #8a8f98;">Renk:</span> <strong style="color: #cbd0d8;">${insp.greaseColor || '--'}</strong></div>
          `}
          <div style="margin-left: auto; color: #8a8f98;">
            <i class="fa-solid fa-user-check" style="margin-right: 4px; color: var(--accent-cyan);"></i>${insp.inspector || 'Teknisyen'}
          </div>
        </div>

        <!-- Message / Notes -->
        ${insp.message ? `<div style="font-size: 0.82rem; color: #cbd0d8; line-height: 1.35;"><strong style="color: #8a8f98;">Ajan Teşhisi:</strong> ${insp.message}</div>` : ''}
        ${insp.notes ? `<div style="font-size: 0.82rem; color: #ffeb3b; background: rgba(255, 235, 59, 0.05); border: 1px solid rgba(255, 235, 59, 0.15); border-radius: 4px; padding: 4px 8px; line-height: 1.35;"><i class="fa-regular fa-comment-dots" style="margin-right: 5px;"></i><strong>Teknisyen Notu:</strong> ${insp.notes}</div>` : ''}

        <!-- Audio Player if audioUrl is present -->
        ${insp.audioUrl ? `
          <div style="display: flex; align-items: center; gap: 10px; margin-top: 4px; background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 6px; padding: 6px 12px;">
            <div style="display: flex; align-items: center; gap: 6px; color: var(--accent-cyan); font-size: 0.8rem; font-weight: 700; white-space: nowrap;">
              <i class="fa-solid fa-headphones"></i> Rulman Sesini Dinle:
            </div>
            <audio controls src="${insp.audioUrl}" style="height: 32px; flex: 1; outline: none; border-radius: 4px;" preload="none"></audio>
          </div>
        ` : ''}

        ${isCritical ? `
          <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
            <button onclick="window.selectTurbineForAnalysis('${insp.turbineId}', 'acoustics'); window.createFlushingWorkOrder();" style="height: 30px; padding: 0 10px; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 4px; color: #fff; font-weight: 700; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i> Flushing İş Emri Aç
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
};

(window as any).updateInspectionsUI = updateInspectionsUI;

(window as any).deleteInspectionRecord = async (id: string) => {
  if (!confirm("Bu analiz raporunu silmek istediğinizden emin misiniz?")) return;
  try {
    await bearingService.deleteInspection(id);
    if ((window as any).showToast) {
      (window as any).showToast('Silindi', 'Analiz raporu başarıyla silindi.', 'info');
    }
  } catch (err: any) {
    alert("Rapor silinirken hata oluştu: " + err.message);
  }
};

// Vibration setup handler
(window as any).handleVibSetupChange = (value: string) => {
  const inputsContainer = document.getElementById('vib-inputs-container');
  const bypassBanner = document.getElementById('vib-bypass-banner');
  const calcBtn = document.getElementById('vib-calc-btn');
  const resultArea = document.getElementById('vibration-result-area');

  if (inputsContainer && bypassBanner && calcBtn) {
    if (value === 'cihaz_yok') {
      inputsContainer.style.display = 'none';
      bypassBanner.style.display = 'block';
      calcBtn.style.display = 'none';
      if (resultArea) resultArea.style.display = 'none';
    } else {
      inputsContainer.style.display = 'block';
      bypassBanner.style.display = 'none';
      calcBtn.style.display = 'flex';
    }
  }
};

// Grease photo upload helper
(window as any).handleGreasePhotoUpload = (event: any) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e: any) => {
    const previewImg = document.getElementById('uploaded-photo-preview') as HTMLImageElement;
    const previewContainer = document.getElementById('uploaded-photo-preview-container');
    if (previewImg && previewContainer) {
      previewImg.src = e.target.result;
      previewContainer.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
};

// Remove grease photo
(window as any).removeUploadedGreasePhoto = () => {
  const fileInput = document.getElementById('grease-photo-input') as HTMLInputElement;
  const previewImg = document.getElementById('uploaded-photo-preview') as HTMLImageElement;
  const previewContainer = document.getElementById('uploaded-photo-preview-container');

  if (fileInput) fileInput.value = '';
  if (previewImg) previewImg.src = '';
  if (previewContainer) previewContainer.style.display = 'none';
};

(window as any).setYawSimulation = (active: boolean) => {
  isYawActive = active;
  const offBtn = document.getElementById('yaw-off-btn');
  const onBtn = document.getElementById('yaw-on-btn');
  if (offBtn && onBtn) {
    if (active) {
      onBtn.classList.add('active');
      offBtn.classList.remove('active');
    } else {
      offBtn.classList.add('active');
      onBtn.classList.remove('active');
    }
  }
};

(window as any).startLiveAudioRecording = async () => {
  const btn = document.getElementById('live-audio-btn');
  const micIcon = document.getElementById('mic-icon');
  const micText = document.getElementById('mic-text');
  const resultArea = document.getElementById('acoustic-result-area');
  const loader = document.getElementById('acoustic-loader');
  const content = document.getElementById('acoustic-content');

  if (!btn || !micIcon || !micText || !resultArea || !loader || !content) return;

  const stopAndProcess = async (blob?: Blob) => {
    isRecording = false;
    clearInterval(recordingInterval);
    btn.classList.remove('recording-pulse');
    micIcon.className = 'fa-solid fa-microphone';
    micIcon.style.color = 'var(--accent-cyan)';
    micText.innerText = 'Canlı Ses Kaydet (1 Dk)';

    resultArea.style.display = 'block';
    loader.style.display = 'block';
    content.style.display = 'none';

    const previewUrl = blob ? URL.createObjectURL(blob) : null;

    const result: AcousticAnalysisResult = await bearingAgent.analyzeAcoustics(
      blob ? 'live_recording.wav' : 'technician_audio_upload.wav',
      isYawActive ? 'WITH_YAW' : 'NO_YAW'
    );

    loader.style.display = 'none';
    content.style.display = 'block';

    if (result.status === 'CANCELLED') {
      content.innerHTML = `
        <div style="background: rgba(255, 59, 48, 0.08); border: 1px solid rgba(255, 59, 48, 0.2); border-radius: 6px; padding: 1rem; display: flex; align-items: flex-start; gap: 12px;">
          <i class="fa-solid fa-triangle-exclamation" style="color: #ff3b30; font-size: 1.2rem; margin-top: 2px;"></i>
          <div>
            <div style="font-weight: 700; color: #ff3b30; font-size: 0.9rem; margin-bottom: 4px;">ANALİZ İPTAL EDİLDİ</div>
            <div style="color: #ff8e89; font-weight: 600; font-size: 0.9rem;">"${result.message}"</div>
          </div>
        </div>
      `;
    } else {
      const isCritical = result.bearingCondition === 'CRITICAL';
      const isWarning = result.bearingCondition === 'WARNING';
      const badgeColor = isCritical ? '#ff3b30' : (isWarning ? '#ffcc00' : '#00ff66');
      const badgeBg = isCritical ? 'rgba(255, 59, 48, 0.1)' : (isWarning ? 'rgba(255, 204, 0, 0.1)' : 'rgba(0, 255, 102, 0.1)');

      content.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; color: #fff;">Spektrum Analiz Sonucu:</span>
            <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}; padding: 3px 10px; border-radius: 4px; font-weight: 800; font-size: 0.85rem; font-family: 'Rajdhani', sans-serif;">
              ${result.bearingCondition}
            </span>
          </div>

          <p style="margin: 0; color: #e0e4ec; line-height: 1.4; font-size: 0.9rem;">${result.message}</p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: rgba(255,255,255,0.02); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03);">
            <div>
              <div style="font-size: 0.8rem; color: #8a8f98;">Vuruntu Algılama</div>
              <div style="font-weight: 700; color: #fff; font-size: 0.9rem;">
                ${result.knocksDetected ? '<span style="color: #ff3b30;">MEVCUT (VURUNTU VAR)</span>' : '<span style="color: #00ff66;">TEMİZ</span>'}
              </div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: #8a8f98;">Sürtünme Metalik Ses</div>
              <div style="font-weight: 700; color: #fff; font-size: 0.9rem;">
                ${result.frictionDetected ? '<span style="color: #ffcc00;">TESPİT EDİLDİ</span>' : '<span style="color: #00ff66;">TEMİZ</span>'}
              </div>
            </div>
            <div style="grid-column: span 2; margin-top: 5px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 5px;">
              <div style="font-size: 0.8rem; color: #8a8f98;">Pik Spektral Frekans</div>
              <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; color: var(--accent-cyan); font-size: 1.1rem;">
                ${result.peakFrequency} Hz <span style="font-size: 0.8rem; font-weight: 500; color: #8a8f98;">(Normal Limit: &lt; 200 Hz)</span>
              </div>
            </div>
          </div>

          ${previewUrl ? `
          <!-- Audio Playback Preview -->
          <div style="margin-top: 5px; background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 6px; padding: 6px 12px; display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-volume-high" style="color: var(--accent-cyan); font-size: 0.9rem;"></i>
            <span style="font-size: 0.8rem; color: #cbd0d8; font-weight: 700; white-space: nowrap;">Alınan Ses Kaydı:</span>
            <audio controls src="${previewUrl}" style="height: 32px; flex: 1; outline: none;"></audio>
          </div>
          ` : ''}

          <!-- Save Acoustic Analysis Action Block -->
          <div style="margin-top: 5px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <input type="text" id="acoustic-technician-note" placeholder="Saha teknisyeni gözlem notu (Opsiyonel)..." style="flex: 1; min-width: 200px; height: 38px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;" />
              <button id="save-acoustic-analysis-btn" onclick="window.saveCurrentAcousticAnalysis()" style="height: 38px; padding: 0 16px; background: rgba(0, 255, 102, 0.15); border: 1px solid #00ff66; border-radius: 6px; color: #00ff66; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: all 0.2s;">
                <i class="fa-solid fa-floppy-disk"></i> Analiz Raporunu Kaydet
              </button>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #8a8f98;">
              <span><i class="fa-solid fa-circle-info" style="color: var(--accent-cyan); margin-right: 4px;"></i>Kaydettiğinizde türbin geçmişine ve 'Saha Analiz Kayıtları' sekmesine işlenir.</span>
              <button onclick="window.switchBearingTab('history')" style="background: none; border: none; color: var(--accent-cyan); font-size: 0.75rem; cursor: pointer; text-decoration: underline;">
                Geçmiş Kayıtları Gör &rarr;
              </button>
            </div>
          </div>
        </div>
      `;

      (window as any).lastAcousticResult = { result, isYawActive };
      (window as any).lastAcousticBlob = blob;
    }
  };

  if (isRecording) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      if (simulationTimeout) clearTimeout(simulationTimeout);
      stopAndProcess();
    }
    return;
  }

  resultArea.style.display = 'none';
  content.style.display = 'none';

  isRecording = true;
  btn.classList.add('recording-pulse');
  micIcon.className = 'fa-solid fa-circle fa-beat';
  micIcon.style.color = '#f43f5e';
  
  let seconds = 0;
  micText.innerText = `Kaydı Durdur ve Analiz Et (00:00 / 01:00)`;

  recordingInterval = setInterval(() => {
    seconds++;
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    micText.innerText = `Kaydı Durdur ve Analiz Et (${mm}:${ss} / 01:00)`;
    if (seconds >= 60) {
      clearInterval(recordingInterval);
    }
  }, 1000);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    
    let options = { mimeType: 'audio/webm' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/ogg' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: '' };
    }

    mediaRecorder = new MediaRecorder(stream, options);
    
    mediaRecorder.ondataavailable = (event: any) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      stream.getTracks().forEach(track => track.stop());
      stopAndProcess(audioBlob);
    };

    mediaRecorder.start();

    simulationTimeout = setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }, 60000);

  } catch (error) {
    console.warn('Microphone access not available or denied, running simulation mode.', error);
    simulationTimeout = setTimeout(() => {
      stopAndProcess();
    }, 60000);
  }
};

// Portable vibration requirements checker
(window as any).triggerVibrationCompliance = () => {
  const resultArea = document.getElementById('vibration-result-area');
  const content = document.getElementById('vibration-content');

  if (!resultArea || !content) return;

  const rotorSpeedPct = parseFloat((document.getElementById('vib-rotor-speed') as HTMLInputElement)?.value) || 0;
  const speedFluctuation = parseFloat((document.getElementById('vib-fluctuation') as HTMLInputElement)?.value) || 0;
  const measurementDuration = parseFloat((document.getElementById('vib-duration') as HTMLInputElement)?.value) || 0;
  const measurementsCount = parseInt((document.getElementById('vib-count') as HTMLInputElement)?.value) || 0;
  const sensorSensitivity = parseFloat((document.getElementById('vib-sensitivity') as HTMLInputElement)?.value) || 0;
  const sensorFrequencyRangeMin = parseFloat((document.getElementById('vib-freq-min') as HTMLInputElement)?.value) || 0.33;
  
  const noYawDuringMeasurement = (document.getElementById('vib-noyaw') as HTMLInputElement)?.checked;
  const noIceBuildUp = (document.getElementById('vib-noice') as HTMLInputElement)?.checked;

  const complianceInput = {
    rotorSpeedPct,
    speedFluctuation,
    measurementDuration,
    measurementsCount,
    noYawDuringMeasurement,
    noIceBuildUp,
    sensorSensitivity,
    sensorFrequencyRangeMin,
    sensorFrequencyRangeMax: 450, // standard value from checklist
    channelCount: 2, // standard value
    samplingRate: 4800 // standard value (>4000 Hz)
  };

  const result = bearingAgent.validateVibrationCompliance(complianceInput);

  resultArea.style.display = 'block';
  
  const headerColor = result.isFullyCompliant ? '#00ff66' : '#ffcc00';
  const headerBg = result.isFullyCompliant ? 'rgba(0, 255, 102, 0.08)' : 'rgba(255, 204, 0, 0.08)';

  let checksHtml = '';
  for (const [key, check] of Object.entries(result.checks)) {
    const icon = check.status ? 'fa-solid fa-circle-check text-success' : 'fa-solid fa-circle-xmark text-danger';
    const color = check.status ? '#00ff66' : '#ff3b30';
    
    // Friendly name map for UI display
    const labelMap: Record<string, string> = {
      rotorSpeed: "Nominal Rotor Hızı oranı",
      speedFluctuation: "Hız Dalgalanması",
      measurementDuration: "Kayıt/Ölçüm Süresi",
      measurementsCount: "Periyodik Ölçüm Sayısı",
      noYaw: "Nacelle (Sapma) Kararlılığı",
      noIce: "Rotor Kanat Temizliği (Buz)",
      sensorSensitivity: "Sensör Duyarlılığı",
      sensorFreqRange: "Frekans Doğrusallık Aralığı",
      channelCount: "Sistem Kanal Sayısı",
      samplingRate: "Örnekleme Hızı (Sampling)"
    };
    const friendlyName = labelMap[key] || key;

    checksHtml += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
        <td style="padding: 6px 0; color: #e0e4ec; font-size: 0.85rem; font-weight: 600;">${friendlyName}</td>
        <td style="padding: 6px 0; color: #a0a5b0; font-size: 0.8rem;">${check.value}</td>
        <td style="padding: 6px 0; color: #8a8f98; font-size: 0.8rem; font-style: italic;">${check.target}</td>
        <td style="padding: 6px 0; text-align: right; color: ${color}; font-size: 0.9rem;">
          <i class="${icon}"></i>
        </td>
      </tr>
    `;
  }

  content.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
      <div style="background: ${headerBg}; border: 1px solid ${headerColor}; padding: 0.8rem; border-radius: 6px; display: flex; align-items: flex-start; gap: 10px;">
        <i class="${result.isFullyCompliant ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation'}" style="color: ${headerColor}; font-size: 1.1rem; margin-top: 2px;"></i>
        <div>
          <div style="font-weight: 700; color: ${headerColor}; font-size: 0.85rem;">ENERCON D03220088/0.0 UYUMLULUK DENETİMİ</div>
          <div style="font-size: 0.8rem; color: #e0e4ec; margin-top: 2px; font-weight: 600; line-height: 1.3;">${result.summaryText}</div>
        </div>
      </div>

      <div style="max-height: 250px; overflow-y: auto; margin-top: 5px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 0.75rem; color: #8a8f98;">
              <th style="padding-bottom: 6px;">Denetlenen Kriter</th>
              <th style="padding-bottom: 6px;">Ölçülen Değer</th>
              <th style="padding-bottom: 6px;">Asgari Hedef</th>
              <th style="padding-bottom: 6px; text-align: right;">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${checksHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

// RAG visual and chemical grease analysis
(window as any).triggerGreaseAnalysis = async () => {
  const resultArea = document.getElementById('grease-result-area');
  const placeholder = document.getElementById('grease-placeholder');
  const loader = document.getElementById('grease-loader');
  const content = document.getElementById('grease-content');

  if (!resultArea || !loader || !content || !placeholder) return;

  placeholder.style.display = 'none';
  resultArea.style.display = 'block';
  loader.style.display = 'block';
  content.style.display = 'none';

  const color = (document.getElementById('grease-color') as HTMLSelectElement)?.value;
  const magnetism = (document.getElementById('grease-magnetism') as HTMLSelectElement)?.value;
  const particles = (document.getElementById('grease-particles') as HTMLSelectElement)?.value;
  const viscosity = (document.getElementById('grease-viscosity') as HTMLSelectElement)?.value;
  
  const isVRingSample = (document.getElementById('grease-is-vring') as HTMLInputElement)?.checked;
  const fePpm = parseFloat((document.getElementById('grease-fe-ppm') as HTMLInputElement)?.value) || 0;
  const pqIndex = parseFloat((document.getElementById('grease-pq-index') as HTMLInputElement)?.value) || 0;

  const result: GreaseAnalysisResult = await bearingAgent.analyzeGrease(
    'technician_grease_upload.jpg',
    { color, magnetism, particles, viscosity, isVRingSample, fePpm, pqIndex }
  );

  loader.style.display = 'none';
  content.style.display = 'block';

  (window as any).lastGreaseResult = {
    result,
    color,
    magnetism,
    particles,
    viscosity,
    isVRingSample,
    fePpm,
    pqIndex
  };

  const isSevere = ['D', 'E', 'F'].includes(result.detectedClass);
  const isModerate = result.detectedClass === 'C';
  const themeColor = isSevere ? '#ff3b30' : (isModerate ? '#ff9900' : '#00ff66');
  const themeBg = isSevere ? 'rgba(255, 59, 48, 0.1)' : (isModerate ? 'rgba(255, 153, 0, 0.1)' : 'rgba(0, 255, 102, 0.1)');

  const lab = result.chemicalAssessment;
  let labStatusHtml = '';

  if (lab) {
    const labColor = lab.status === 'CRITICAL' ? '#ff3b30' : (lab.status === 'WARNING' ? '#ffcc00' : '#00ff66');
    const labBg = lab.status === 'CRITICAL' ? 'rgba(255, 59, 48, 0.08)' : (lab.status === 'WARNING' ? 'rgba(255, 204, 0, 0.08)' : 'rgba(0, 255, 102, 0.08)');
    
    labStatusHtml = `
      <div style="background: ${labBg}; border: 1px solid ${labColor}; padding: 0.8rem; border-radius: 6px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px; margin-bottom: 4px;">
          <span style="font-weight: 700; color: #fff; font-size: 0.8rem;">KİMYASAL & LABORATUVAR DURUMU:</span>
          <span style="color: ${labColor}; font-weight: 800; font-size: 0.8rem;">${lab.status}</span>
        </div>
        <div style="font-size: 0.8rem; color: #e0e4ec; line-height: 1.3;">${lab.evaluationText}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; font-size: 0.75rem;">
          <div style="color: #8a8f98;">Numune Tipi: <strong style="color: #fff;">${lab.greaseType}</strong></div>
          <div style="color: #8a8f98;">Renk Karşılığı: <strong style="color: #fff;">${lab.greaseColor}</strong></div>
        </div>
      </div>
    `;
  }

  // Flushing CTA button if critical
  const showFlushingBtn = (lab && lab.status === 'CRITICAL' && !lab.isVRingSample) || isSevere;

  content.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.4rem;">
        <div>
          <div style="font-size: 0.75rem; color: #8a8f98;">HEDEF REFERANS TALİMATNAMESİ</div>
          <div style="font-weight: 700; color: #fff; font-size: 0.85rem;">TD-esc-07-de-tr-17-004 Rev002 / D02980100</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.75rem; color: #8a8f98;">RAG Eşleşme Skoru</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; color: var(--accent-cyan); font-size: 1.1rem;">%${result.confidence}</div>
        </div>
      </div>

      <!-- Chemical Assessment Badge -->
      ${labStatusHtml}

      <!-- Detected Class Display -->
      <div style="display: flex; align-items: center; gap: 0.8rem; background: ${themeBg}; border: 1px solid ${themeColor}; padding: 0.8rem; border-radius: 8px;">
        <div style="width: 42px; height: 42px; border-radius: 8px; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-family: 'Rajdhani', sans-serif; font-weight: 900; font-size: 1.5rem; color: ${themeColor}; border: 1px solid ${themeColor}40;">
          ${result.detectedClass}
        </div>
        <div>
          <div style="font-weight: 800; color: #fff; font-size: 0.95rem;">${result.className}</div>
          <div style="font-size: 0.8rem; color: #cbd0d8; margin-top: 1px;">Hasar Kategorisi Tespiti</div>
        </div>
      </div>

      <!-- Match Description -->
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <span style="font-weight: 700; color: #fff; font-size: 0.8rem;">Görsel / Fiziksel Spektral Bulgular:</span>
        <p style="margin: 0; color: #a0a5b0; font-size: 0.85rem; line-height: 1.35;">${result.description}</p>
      </div>

      <!-- Action Required -->
      <div style="background: rgba(255, 255, 255, 0.02); border-left: 3px solid ${themeColor}; padding: 0.7rem; border-radius: 0 6px 6px 0;">
        <div style="font-weight: 700; color: #fff; font-size: 0.8rem; margin-bottom: 2px;">TALİMATNAME GEREĞİ AKSİYON:</div>
        <p style="margin: 0; color: #cbd0d8; font-size: 0.85rem; line-height: 1.35; font-weight: 600;">${result.actionRequired}</p>
      </div>

      ${showFlushingBtn ? `
      <!-- Flushing Action Button -->
      <button onclick="window.createFlushingWorkOrder()" style="height: 40px; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 6px; color: #fff; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 5px; box-shadow: 0 0 12px rgba(239, 68, 68, 0.25);">
        <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i> 🚨 ENERCON FLUSHING (YIKAMA) İŞ EMRİ OLUŞTUR
      </button>
      ` : ''}

      <!-- Save Grease Analysis Action Block -->
      <div style="margin-top: 5px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <input type="text" id="grease-technician-note" placeholder="Numune / saha teknisyen notu (Opsiyonel)..." style="flex: 1; min-width: 200px; height: 38px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;" />
          <button id="save-grease-analysis-btn" onclick="window.saveCurrentGreaseAnalysis()" style="height: 38px; padding: 0 16px; background: rgba(0, 255, 102, 0.15); border: 1px solid #00ff66; border-radius: 6px; color: #00ff66; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: all 0.2s;">
            <i class="fa-solid fa-floppy-disk"></i> Gres Analizini Kaydet
          </button>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #8a8f98;">
          <span><i class="fa-solid fa-circle-info" style="color: var(--accent-cyan); margin-right: 4px;"></i>Kaydettiğinizde türbin geçmişine ve 'Saha Analiz Kayıtları' sekmesine işlenir.</span>
          <button onclick="window.switchBearingTab('history')" style="background: none; border: none; color: var(--accent-cyan); font-size: 0.75rem; cursor: pointer; text-decoration: underline;">
            Geçmiş Kayıtları Gör &rarr;
          </button>
        </div>
      </div>
    </div>
  `;
};

(window as any).createFlushingWorkOrder = () => {
  const selectEl = document.getElementById('analysis-turbine-select') as HTMLSelectElement;
  const turbineId = selectEl ? selectEl.value : '';
  alert(`Seçilen türbin (${turbineId}) için Enercon D02980100 standardı uyarınca Rulman Gres Flushing (Yıkama) iş emri oluşturuluyor...`);
  if (typeof (window as any).navigate === 'function') {
    (window as any).navigate('task-create');
  }
};

(window as any).saveCurrentAcousticAnalysis = async () => {
  const last = (window as any).lastAcousticResult;
  if (!last || !last.result) {
    alert("Kaydedilecek analiz sonucu bulunamadı.");
    return;
  }
  const selectEl = document.getElementById('analysis-turbine-select') as HTMLSelectElement;
  if (!selectEl || !selectEl.value) {
    alert("Lütfen bir türbin seçiniz.");
    return;
  }
  const turbineId = selectEl.value;
  const allTurbines: any[] = (window as any).currentFleetTurbines || [];
  const turbineObj = allTurbines.find(t => t.id === turbineId);
  const siteId = turbineObj?.siteId || '';
  const siteName = turbineObj?.siteName || '';
  const turbineLabel = turbineObj?.name || turbineId;

  const noteInput = document.getElementById('acoustic-technician-note') as HTMLInputElement;
  const notes = noteInput ? noteInput.value.trim() : '';
  const audioBlob = (window as any).lastAcousticBlob as Blob | undefined;

  const saveBtn = document.getElementById('save-acoustic-analysis-btn');
  if (saveBtn) {
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${audioBlob ? 'Ses Yükleniyor ve Kaydediliyor...' : 'Kaydediliyor...'}`;
    (saveBtn as HTMLButtonElement).disabled = true;
  }

  const currentUser = authService.getCurrentUser();
  const inspector = (currentUser as any)?.displayName || (currentUser as any)?.name || currentUser?.email || 'Saha Teknisyeni';

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateFormatted = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const inspection: Omit<BearingInspection, 'id'> = {
    turbineId,
    turbineLabel,
    siteId,
    siteName,
    type: 'ACOUSTIC',
    createdAt: now.toISOString(),
    dateFormatted,
    inspector,
    condition: last.result.bearingCondition || 'NORMAL',
    peakFrequency: last.result.peakFrequency,
    knocksDetected: last.result.knocksDetected,
    frictionDetected: last.result.frictionDetected,
    yawSimulationMode: last.isYawActive ? 'WITH_YAW' : 'NO_YAW',
    message: last.result.message,
    notes
  };

  try {
    await bearingService.saveInspection(inspection, audioBlob);
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Kaydedildi!`;
      saveBtn.style.background = 'rgba(0, 255, 102, 0.25)';
      saveBtn.style.borderColor = '#00ff66';
      (saveBtn as HTMLButtonElement).disabled = true;
    }
    if ((window as any).showToast) {
      (window as any).showToast('Başarılı', `${turbineLabel} için akustik analiz kaydı oluşturuldu.`, 'success');
    } else {
      alert(`${turbineLabel} için akustik analiz kaydı başarıyla oluşturuldu.`);
    }
  } catch (err: any) {
    console.error("Analiz kaydetme hatası:", err);
    alert("Analiz kaydedilemedi: " + err.message);
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Tekrar Dene`;
      (saveBtn as HTMLButtonElement).disabled = false;
    }
  }
};

(window as any).saveCurrentGreaseAnalysis = async () => {
  const last = (window as any).lastGreaseResult;
  if (!last || !last.result) {
    alert("Kaydedilecek gres analiz sonucu bulunamadı.");
    return;
  }
  const selectEl = document.getElementById('analysis-turbine-select') as HTMLSelectElement;
  if (!selectEl || !selectEl.value) {
    alert("Lütfen bir türbin seçiniz.");
    return;
  }
  const turbineId = selectEl.value;
  const allTurbines: any[] = (window as any).currentFleetTurbines || [];
  const turbineObj = allTurbines.find(t => t.id === turbineId);
  const siteId = turbineObj?.siteId || '';
  const siteName = turbineObj?.siteName || '';
  const turbineLabel = turbineObj?.name || turbineId;

  const noteInput = document.getElementById('grease-technician-note') as HTMLInputElement;
  const notes = noteInput ? noteInput.value.trim() : '';

  const saveBtn = document.getElementById('save-grease-analysis-btn');
  if (saveBtn) {
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...`;
    (saveBtn as HTMLButtonElement).disabled = true;
  }

  const currentUser = authService.getCurrentUser();
  const inspector = (currentUser as any)?.displayName || (currentUser as any)?.name || currentUser?.email || 'Saha Teknisyeni';

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateFormatted = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const isCritical = ['D', 'E', 'F'].includes(last.result.detectedClass);
  const isWarning = last.result.detectedClass === 'C';
  const condition: 'NORMAL' | 'WARNING' | 'CRITICAL' = isCritical ? 'CRITICAL' : (isWarning ? 'WARNING' : 'NORMAL');

  const inspection: Omit<BearingInspection, 'id'> = {
    turbineId,
    turbineLabel,
    siteId,
    siteName,
    type: 'GREASE',
    createdAt: now.toISOString(),
    dateFormatted,
    inspector,
    condition,
    greaseClass: last.result.detectedClass,
    greaseClassName: last.result.className,
    greaseColor: last.color,
    fePpm: last.fePpm,
    pqIndex: last.pqIndex,
    message: `${last.result.description} (RAG Güven: %${last.result.confidence})`,
    actionRequired: last.result.actionRequired,
    notes
  };

  try {
    await bearingService.saveInspection(inspection);
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Kaydedildi!`;
      saveBtn.style.background = 'rgba(0, 255, 102, 0.25)';
      saveBtn.style.borderColor = '#00ff66';
      (saveBtn as HTMLButtonElement).disabled = true;
    }
    if ((window as any).showToast) {
      (window as any).showToast('Başarılı', `${turbineLabel} için gres analiz kaydı oluşturuldu.`, 'success');
    } else {
      alert(`${turbineLabel} için gres analiz kaydı başarıyla oluşturuldu.`);
    }
  } catch (err: any) {
    console.error("Gres analiz kaydetme hatası:", err);
    alert("Gres analizi kaydedilemedi: " + err.message);
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Tekrar Dene`;
      (saveBtn as HTMLButtonElement).disabled = false;
    }
  }
};
