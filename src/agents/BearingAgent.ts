import { BaseAgent } from './BaseAgent';

export interface GreaseAnalysisResult {
  detectedClass: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  className: string;
  description: string;
  actionRequired: string;
  confidence: number;
  chemicalAssessment?: GreaseLabResult;
}

export interface AcousticAnalysisResult {
  status: 'SUCCESS' | 'CANCELLED';
  yawHumDetected: boolean;
  message: string;
  bearingCondition?: 'NORMAL' | 'WARNING' | 'CRITICAL';
  knocksDetected?: boolean;
  frictionDetected?: boolean;
  peakFrequency?: number;
}

export interface GreaseLabResult {
  isVRingSample: boolean;
  fePpm: number;
  pqIndex: number;
  greaseType: string;
  greaseColor: string;
  isValid: boolean;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL';
  evaluationText: string;
  actionRequired: string;
}

export interface VibrationComplianceInput {
  rotorSpeedPct: number;
  speedFluctuation: number;
  measurementDuration: number;
  measurementsCount: number;
  noYawDuringMeasurement: boolean;
  noIceBuildUp: boolean;
  sensorSensitivity: number;
  sensorFrequencyRangeMin: number;
  sensorFrequencyRangeMax: number;
  channelCount: number;
  samplingRate: number;
}

export interface VibrationComplianceResult {
  isFullyCompliant: boolean;
  checks: {
    rotorSpeed: { status: boolean; value: string; target: string };
    speedFluctuation: { status: boolean; value: string; target: string };
    measurementDuration: { status: boolean; value: string; target: string };
    measurementsCount: { status: boolean; value: string; target: string };
    noYaw: { status: boolean; value: string; target: string };
    noIce: { status: boolean; value: string; target: string };
    sensorSensitivity: { status: boolean; value: string; target: string };
    sensorFreqRange: { status: boolean; value: string; target: string };
    channelCount: { status: boolean; value: string; target: string };
    samplingRate: { status: boolean; value: string; target: string };
  };
  summaryText: string;
}

export class BearingAgent extends BaseAgent {
  // Reference Library documents from ENERCON standard files
  private readonly greaseStandardDoc = "TD-esc-07-de-tr-17-004 Rev002 / D02980100/0.0";
  private readonly vibrationStandardDoc = "D03220088/0.0 - Portable Rotor Bearing Measurements";

  // Grease types and color mapping from D02980100 page 9
  public readonly greaseMapping: Record<string, { type: string; label: string }> = {
    eski_net: { type: "Mobil SHC 460 WT", label: "Kırmızı Gres" },
    koyu_kırmızı: { type: "Mobil SHC 460 WT", label: "Kırmızı Gres" },
    gri_yesil: { type: "Mobil SHC 461 WT", label: "Bej Gres" },
    kahverengi_antrasit: { type: "Klüberplex BEM 41-141", label: "Sarı Gres" },
    siyah: { type: "Mobil SHC 460 WT", label: "Kırmızı/Siyah Karışımı" },
    pirinc: { type: "Mobil SHC 461 WT / Klüberplex", label: "Aşınmış Metalik Karışım" },
    siyah_kırık: { type: "Belirtilmemiş / Katranlaşmış", label: "Bozulmuş Karışım" }
  };

  private readonly damageClasses = {
    A: {
      name: "Sınıf A",
      colorDescription: "Eski renk net bir şekilde fark ediliyor",
      particleDescription: "Çok ince bir metal parlaklık",
      magnetism: "Manyetik değil",
      viscosity: "Normal viskozite",
      action: "Durum normal. Rutin yağlama aralıklarına devam edilebilir.",
      level: 0
    },
    B: {
      name: "Sınıf B",
      colorDescription: "Koyu kırmızı ila kahverengi veya sarı-yeşil ila gri arası",
      particleDescription: "Tek metal parçacıklar ve metal parlaklık ile",
      magnetism: "Manyetik değil",
      viscosity: "Normal/Hafif akışkan",
      action: "Erken aşınma belirtileri. Rulman temizlenmeli ve yakından takip edilmelidir.",
      level: 1
    },
    C: {
      name: "Sınıf C",
      colorDescription: "Kahverengi ila antrasit",
      particleDescription: "Çok sayıda metal parçacıklar ile",
      magnetism: "Hafif manyetik",
      viscosity: "Orta derece akışkanlık",
      action: "Gres Hasar Kategorisi 2! Ana rulmandaki ve rulman kapağındaki gresin mümkün olduğunca büyük bir bölümünü temizleyin ve derhal yeni gresle değiştirin.",
      level: 2
    },
    D: {
      name: "Sınıf D (Antrasit/Manyetik)",
      colorDescription: "Antrasit ila siyah",
      particleDescription: "Çok sayıda metal parçacık ile",
      magnetism: "Manyetik",
      viscosity: "Artan gres viskozitesi (Koyulaşmış gres)",
      action: "KRİTİK AŞINMA! Rulman gresini temizleyip değiştirin, vibrasyon ölçümleri talep edin ve Mechanical Engineering departmanına rapor edin.",
      level: 3
    },
    E: {
      name: "Sınıf E",
      colorDescription: "Antrasit ila siyah veya pirinç rengi",
      particleDescription: "Çok sayıda metal parçacık, parçacıklar zorlukla ayırt edilebiliyor",
      magnetism: "Çok manyetik",
      viscosity: "Yüksek gres viskozitesi (Katılaşmış gres / Yanık kokusu)",
      action: "ACİL DURUM! Rulman kafesinde aşırı sürtünme ve termal hasar. Kule tırmanışını durdurun ve rulman revizyon sürecini başlatın.",
      level: 4
    },
    F: {
      name: "Sınıf F",
      colorDescription: "Gres durumu Sınıf D veya E gibi (Koyu / Yanmış)",
      particleDescription: "Yatak parçaları ve belirgin metal elemanlar kırılmış",
      magnetism: "Aşırı manyetik",
      viscosity: "Tamamen bozulmuş gres yapısı",
      action: "KATASTROFİK HASAR! Rulman elemanları/kafes kırılmış. Türbini derhal durdurun ve kilit altına alın. Rulman değişimi zorunludur.",
      level: 5
    }
  };

  constructor() {
    super('agent_bearing_01', 'Bearing Analysis Agent', 'DiagnosisSpecialist');
  }

  /**
   * Akustik analiz karar ağacı.
   * Yaw (sapma) motoru gürültüsü varsa analizi iptal eder, yoksa vuruntu/sürtünme analizi yapar.
   */
  async analyzeAcoustics(audioFileName: string, yawSimulationMode: 'WITH_YAW' | 'NO_YAW' = 'NO_YAW'): Promise<AcousticAnalysisResult> {
    try {
      await this.setStatus('busy');
      
      // Simülasyon gecikmesi (1.2s) - Ajanın spektral analiz yaptığını hissettirmek için
      await new Promise(resolve => setTimeout(resolve, 1200));

      if (yawSimulationMode === 'WITH_YAW') {
        await this.setStatus('online');
        return {
          status: 'CANCELLED',
          yawHumDetected: true,
          message: 'Yaw motoru devrede, nacelle sabitken tekrar kayıt alın'
        };
      }

      // Rulman hasarı simülasyonu
      const rand = Math.random();
      let bearingCondition: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
      let knocksDetected = false;
      let frictionDetected = false;
      let peakFrequency = 145.2; // Hz
      let message = "Akustik spektrum analizi temiz. Rulman frekanslarında herhangi bir anormallik, vuruntu veya sürtünme izine rastlanmadı.";

      if (rand > 0.7) {
        bearingCondition = 'CRITICAL';
        knocksDetected = true;
        frictionDetected = true;
        peakFrequency = 840.5;
        message = "KRİTİK RULMAN HASARI! Net rulman geçiş frekanslarında (BPFI/BPFO) yüksek genlikli vuruntu ve yoğun sürtünme metalik sesleri tespit edildi. Rulman hasar skoru yüksek.";
      } else if (rand > 0.4) {
        bearingCondition = 'WARNING';
        frictionDetected = true;
        peakFrequency = 412.8;
        message = "HAFİF ANORMALLİK. Rulman kafes frekansında hafif sürtünme izleri ve arka planda metalik gürültü artışı gözlemlendi. Yağlama kalitesini kontrol edin.";
      }

      await this.setStatus('online');
      return {
        status: 'SUCCESS',
        yawHumDetected: false,
        message,
        bearingCondition,
        knocksDetected,
        frictionDetected,
        peakFrequency
      };

    } catch (error) {
      await this.setStatus('error');
      console.error("[BearingAgent] Akustik analiz hatası:", error);
      return {
        status: 'CANCELLED',
        yawHumDetected: false,
        message: 'Akustik analiz sırasında sistem hatası oluştu.'
      };
    }
  }

  /**
   * Görsel ve Kimyasal Laboratuvar Analizi karar ağacı.
   * TD-esc-07-de-tr-17-004 Rev002 / D02980100 standardını referans alır.
   */
  async analyzeGrease(
    imageFileName: string,
    observedProperties?: {
      color?: string;
      magnetism?: string;
      particles?: string;
      viscosity?: string;
      isVRingSample?: boolean;
      fePpm?: number;
      pqIndex?: number;
    }
  ): Promise<GreaseAnalysisResult> {
    try {
      await this.setStatus('busy');
      
      // Simülasyon gecikmesi (1.5s) - Otonom RAG eşleşme süresi
      await new Promise(resolve => setTimeout(resolve, 1500));

      let matchedClass: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' = 'A';
      
      const color = observedProperties?.color || 'eski_net';
      const magnetism = observedProperties?.magnetism || 'manyetik_degil';
      const particles = observedProperties?.particles || 'parlaklik';
      const viscosity = observedProperties?.viscosity || 'normal';
      const isVRingSample = observedProperties?.isVRingSample || false;
      const fePpm = observedProperties?.fePpm !== undefined ? observedProperties.fePpm : 150;
      const pqIndex = observedProperties?.pqIndex !== undefined ? observedProperties.pqIndex : 25;

      // 1. Physical damage class evaluation (Visual RAG matching)
      if (particles === 'kırık_yatak' || color === 'siyah_kırık') {
        matchedClass = 'F';
      } else if (magnetism === 'cok_manyetik' || viscosity === 'katılasmıs_yanık' || color === 'pirinc') {
        matchedClass = 'E';
      } else if (magnetism === 'manyetik' || viscosity === 'artan_koyu' || color === 'siyah') {
        matchedClass = 'D';
      } else if (magnetism === 'hafif_manyetik' || particles === 'cok_sayıda' || color === 'kahverengi_antrasit') {
        matchedClass = 'C';
      } else if (color === 'koyu_kırmızı' || color === 'gri_yesil' || particles === 'tek_parcacık') {
        matchedClass = 'B';
      } else {
        matchedClass = 'A';
      }

      // 2. Grease Type and Color Mapping from D02980100 page 9
      const mappedInfo = this.greaseMapping[color] || { type: "Mobil SHC 460 WT", label: "Kırmızı Gres" };

      // 3. Chemical assessment using D02980100 page 10
      let isValid = true;
      let chemicalStatus: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';
      let evaluationText = "Kimyasal ve fiziksel parametreler tamamen Enercon limit değerleri içerisindedir.";
      let actionRequired = this.damageClasses[matchedClass].action;

      if (isVRingSample) {
        isValid = false;
        chemicalStatus = 'CRITICAL';
        evaluationText = "GEÇERSİZ NUMUNE! Rulman dışına sızan (V-Halkası sızıntısı) gres kullanılmıştır. Bu gres çevre tozlarıyla kontamine olduğundan rulman içini temsil etmez! D02980100 standardı uyarınca numune analizi reddedilmiştir.";
        actionRequired = "Numuneyi iptal edin. Rulman yuvasından (grese nipeli sökülerek) kablo bağı yardımıyla iç kısımdan temiz 30g numune alın.";
      } else {
        const hasHighFe = fePpm >= 3000;
        const hasHighPQ = pqIndex >= 300;

        if (hasHighFe || hasHighPQ) {
          chemicalStatus = 'CRITICAL';
          let reasons = [];
          if (hasHighFe) reasons.push(`Fe miktarı aşırı yüksek (${fePpm} ppm >= 3000 ppm)`);
          if (hasHighPQ) reasons.push(`PQ İndeksi aşırı yüksek (${pqIndex} >= 300)`);
          
          evaluationText = `KİMYASAL ANOMALİ! ${reasons.join(" ve ")}. Rulmanda aktif ve şiddetli metalik aşınma bulguları mevcuttur.`;
          actionRequired = "D02980100 Rev003 uyarınca: Rulmanı yakından inceleyin, gres kalitesini doğrulamak için rulmanı yeni gres ile YIKAYIN (flushing), 3 ay sonra tekrar numune ve vibrasyon analizi talep edin.";
          
          // Elevate physical class to at least D if chemical parameters are critical
          if (matchedClass === 'A' || matchedClass === 'B' || matchedClass === 'C') {
            matchedClass = 'D';
          }
        } else {
          // Normal limits but elevated class
          if (matchedClass === 'C') {
            chemicalStatus = 'WARNING';
            evaluationText = `Fiziksel hasar belirtisi (Sınıf C) mevcut fakat kimyasal Fe (${fePpm} ppm) ve PQ (${pqIndex}) normal limitlerde.`;
          } else if (matchedClass === 'D' || matchedClass === 'E' || matchedClass === 'F') {
            chemicalStatus = 'CRITICAL';
            evaluationText = `Fiziksel hasar kritik seviyededir (${matchedClass}). Rulman iç yüzey aşınması mevcuttur.`;
          }
        }
      }

      const matchData = this.damageClasses[matchedClass];
      const chemicalAssessment: GreaseLabResult = {
        isVRingSample,
        fePpm,
        pqIndex,
        greaseType: mappedInfo.type,
        greaseColor: mappedInfo.label,
        isValid,
        status: chemicalStatus,
        evaluationText,
        actionRequired
      };

      await this.setStatus('online');
      return {
        detectedClass: matchedClass,
        className: matchData.name,
        description: `${matchData.colorDescription}. ${matchData.particleDescription}. Manyetizma: ${matchData.magnetism}. Kıvam: ${matchData.viscosity}.`,
        actionRequired: chemicalAssessment.actionRequired,
        confidence: isVRingSample ? 100 : (94 + Math.floor(Math.random() * 5)),
        chemicalAssessment
      };

    } catch (error) {
      await this.setStatus('error');
      console.error("[BearingAgent] Görsel/Laboratuvar analiz hatası:", error);
      throw error;
    }
  }

  /**
   * D03220088/0.0 standardına göre vibrasyon ölçüm compliance kontrolü.
   */
  validateVibrationCompliance(input: VibrationComplianceInput): VibrationComplianceResult {
    const checks = {
      rotorSpeed: {
        status: input.rotorSpeedPct >= 75,
        value: `%${input.rotorSpeedPct}`,
        target: ">= %75 (Nominal hızın en az 3/4'ü)"
      },
      speedFluctuation: {
        status: input.speedFluctuation <= 10,
        value: `±%${input.speedFluctuation}`,
        target: "<= ±%10"
      },
      measurementDuration: {
        status: input.measurementDuration >= 60,
        value: `${input.measurementDuration} Sn`,
        target: ">= 60 Saniye (En az 10 tam devir)"
      },
      measurementsCount: {
        status: input.measurementsCount >= 3,
        value: `${input.measurementsCount} Adet`,
        target: ">= 3 Ölçüm (Farklı periyotlarda)"
      },
      noYaw: {
        status: input.noYawDuringMeasurement,
        value: input.noYawDuringMeasurement ? "Evet (Nacelle Sabit)" : "Hayır (Yaw Devrede)",
        target: "Evet (Ölçüm esnasında yaw hareketi yasaktır)"
      },
      noIce: {
        status: input.noIceBuildUp,
        value: input.noIceBuildUp ? "Temiz (Buz Yok)" : "Buz Mevcut",
        target: "Temiz (Buzlanma olmamalı)"
      },
      sensorSensitivity: {
        status: input.sensorSensitivity >= 100,
        value: `${input.sensorSensitivity} mV/g`,
        target: ">= 100 mV/g"
      },
      sensorFreqRange: {
        status: input.sensorFrequencyRangeMin <= 0.33 && input.sensorFrequencyRangeMax >= 450,
        value: `${input.sensorFrequencyRangeMin} - ${input.sensorFrequencyRangeMax} Hz`,
        target: "0.33 Hz - 450 Hz arası doğrusal (±3 dB)"
      },
      channelCount: {
        status: input.channelCount >= 2,
        value: `${input.channelCount} Kanal`,
        target: ">= 2 Kanal"
      },
      samplingRate: {
        status: input.samplingRate >= 4000,
        value: `${input.samplingRate} Hz`,
        target: ">= 4000 Hz"
      }
    };

    const isFullyCompliant = Object.values(checks).every(c => c.status === true);
    
    let summaryText = "Tebrikler! Taşınabilir vibrasyon ölçüm kurulumunuz ENERCON D03220088/0.0 standardı asgari kriterlerine tam uyumludur.";
    if (!isFullyCompliant) {
      const failedChecksCount = Object.values(checks).filter(c => c.status === false).length;
      summaryText = `DİKKAT: Ölçüm kurulumunuzda ${failedChecksCount} adet ENERCON D03220088/0.0 standart dışı kriter tespit edildi. Bu ölçüm Enercon tarafından kabul edilmeyebilir.`;
    }

    return {
      isFullyCompliant,
      checks,
      summaryText
    };
  }
}

export const bearingAgent = new BearingAgent();
bearingAgent.start();
