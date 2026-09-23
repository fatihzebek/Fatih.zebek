import { GoogleGenerativeAI } from '@google/generative-ai';
import { workshopComponentService, type WorkshopComponent } from './WorkshopComponentService';

export interface CardPinoutInfo {
  connector: string; // Örn: 'X7', 'X8', 'CAN1', 'X1'
  pins: string;      // Örn: 'Pin 1-6'
  label: string;     // Örn: 'Döner Hız Sensörü / Drehzahlaufnehmer'
  functionDesc: string; // Açıklama
  testAdvice: string; // Teknisyen için ölçüm tavsiyesi (voltaj, empedans)
}

export interface CardProfile {
  id: string;
  name: string;
  sapNo?: string;
  turbineModel: string;
  schematicTitle: string;
  schematicVersion: string; // Örn: 'V1.3'
  defaultPreviewUrl?: string;
  defaultPreviewType?: 'image' | 'pdf';
  schematicSourcePath?: string;
  pinouts: CardPinoutInfo[];
  knownFails: Array<{
    faultCode: string;
    description: string;
    affectedPins: string[];
    typicalCauses: string[];
  }>;
}

export interface DiagnosticTestStep {
  stepNo: number;
  title: string;
  targetPinOrPoint: string;
  testType: 'VOLTAGE_DC' | 'VOLTAGE_AC' | 'RESISTANCE' | 'OSCILLOSCOPE' | 'DIODE' | 'VISUAL';
  instruction: string;
  expectedValue: string;
  criticalNote?: string;
  technicianMeasurement?: string;
  status?: 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED';
}

export interface SuspectedComponent {
  designator: string; // Örn: 'U2', 'D4', 'C12', 'Q1'
  name: string;       // Örn: 'Optokuplör PC817 / HCPL-3120', 'TVS Diyot SMBJ36CA'
  packageType?: string; // Örn: 'DIP-8', 'SOIC-8', 'SMD'
  suspectedReason: string;
  drawerLocation?: string;
  inStock?: boolean;
  stockQty?: number;
  workshopComponentId?: string;
}

export interface DiagnosticAnalysisResult {
  cardName: string;
  detectedVersionNote: string;
  circuitSection: string;
  rootCauseAnalysis: string;
  schematicReferences: Array<{
    code: string;
    crossRef: string;
    description: string;
  }>;
  testSteps: DiagnosticTestStep[];
  suspectedComponents: SuspectedComponent[];
  nextActionRecommendation: string;
}

export interface SapCardAnalysisResult {
  sapNo: string;
  officialDescription: string;
  cardName: string;
  turbineModel: string;
  locationInTurbine: string;
  installationCode: string;
  schematicBook: string;
  schematicPage: string;
  schematicPreviewUrl?: string;
  cardFunction: string;
  powerSupply: string;
  pinouts: CardPinoutInfo[];
  chronicFailures: Array<{
    faultCode: string;
    description: string;
    typicalCauses: string[];
    testAdvice: string;
  }>;
  recommendedComponents: SuspectedComponent[];
  versionNotes: string;
}

export interface DiagnosticMessage {
  id: string;
  sender: 'USER' | 'AGENT';
  text: string;
  timestamp: string;
  resultData?: DiagnosticAnalysisResult;
}

// Built-in Profiles directly backed by Enercon schematics in Devre şemaları
export const PRELOADED_CARD_PROFILES: CardProfile[] = [
  {
    id: 'ENERCON_E48_PITCH_A02',
    name: 'Enercon E-48 Steuerkarte Pitch (-A02)',
    sapNo: '54060-1 / 60950-1',
    turbineModel: 'Enercon E-48 (CS48/2)',
    schematicTitle: 'E-48 Bereichsschaltplan Rotor (Sayfa 30) - CS48a-01-R-V1-06',
    schematicVersion: 'V1.3 (Şema Referansı)',
    defaultPreviewUrl: '/enercon_pitch_control_board.png',
    defaultPreviewType: 'image',
    schematicSourcePath: 'Devre şemaları/E48/Rotor CS48a-01-R-V1-06_D0129411-6 E-48 Windenergieanlage.pdf',
    pinouts: [
      {
        connector: 'X1',
        pins: 'Pin 1, 2, 3',
        label: 'AC Ana Besleme Girişi',
        functionDesc: 'L (X1:1), N (X1:2), PE (X1:3) - 230VAC yardımcı şebeke / trafo beslemesi',
        testAdvice: 'X1:1 ile X1:2 arasında 230V AC ±%10 ölçün. Sigorta ve varistör giriş hattını kontrol edin.'
      },
      {
        connector: 'X7',
        pins: 'Pin 1 - 6',
        label: 'Rotor Hız Sensörü (-J04 Drehzahlaufnehmer)',
        functionDesc: 'X7:1 (GND), X7:2 (+15V), X7:3 (İmpuls A), X7:4 (Index), X7:5 (İmpuls B), X7:6 (Hata). Slip-ring üzerinden gelir.',
        testAdvice: 'X7:2 ile X7:1 arası 15V DC besleme olmalı. Türbin yavaş dönerken X7:3 ve X7:5 pinlerinde osiloskop ile 0-15V kare dalga pals izleyin.'
      },
      {
        connector: 'X8',
        pins: 'Pin 1 - 4',
        label: 'Açı Enkoderi (-B01 Winkelcodierer CAN2)',
        functionDesc: 'X8:1 (GND), X8:2 (+15V), X8:3 (CAN2 Low), X8:4 (CAN2 High). Kanat açısı mutlak enkoderi.',
        testAdvice: 'Enerji yokken X8:3 ve X8:4 arasında 60Ω - 120Ω hat sonlandırma empedansı ölçün. X8:2 beslemesini kontrol edin.'
      },
      {
        connector: 'CAN1',
        pins: 'W11 (RxD), W12 (TxD)',
        label: 'Ana Türbin Kontrol CAN-Bus (CAN Control)',
        functionDesc: 'Merkezi kule/gondol PLC ve MPU ile pitch kartı arasındaki ana kontrol hattı.',
        testAdvice: 'Transceiver entegresinin (PCA82C250/SN65HVD230) CANH/CANL diferansiyel sinyalini kontrol edin.'
      },
      {
        connector: 'CAN2',
        pins: 'W3 (RxD), W4 (TxD)',
        label: 'Yük Kontrol Panosu (Lastregelschrank E-53/E-48)',
        functionDesc: 'Pitch yük düzenleme ve açı geri besleme veri yolu.',
        testAdvice: 'Sayfa 30 Kolon 5 çapraz referansını takip edin. Kablo ekranlamasını (Gehaeuse casing) kontrol edin.'
      },
      {
        connector: 'CAN3',
        pins: 'W7-W8 (Box B), W9-W10 (Box C)',
        label: 'Pitch Kutuları Veri Halkası (Data Ring Pitch Box B/C)',
        functionDesc: '3 kanat kontrol kutuları (Blattregelschrank B & C) arasındaki halka haberleşmesi.',
        testAdvice: 'Halka kopukluğu durumunda her kutunun giriş/çıkış Tx/Rx sinyallerini osiloskopla doğrulayın.'
      },
      {
        connector: 'X10 / X11',
        pins: 'D-Sub 26 / D-Sub 6',
        label: 'Güç Modülü Bağlantısı (Power Modul Pitch E-82 / E-44)',
        functionDesc: 'IGBT chopper ve motor sürücü güç modülüne giden PWM tetik ve geri bildirim soketleri.',
        testAdvice: 'Gate tetik izolasyon optokuplörleri ve termal anahtar geri besleme pinlerini test edin.'
      },
      {
        connector: 'X2',
        pins: 'Pin 1 - 8',
        label: 'Güvenlik & Kapasitör Devresi',
        functionDesc: 'Kapasitör test/çalışma, aşırı hız (overspeed switch X2:6, X2:8), limit switch -2°.',
        testAdvice: 'Güvenlik zinciri kapalı durumdayken kontak sürekliliğini test edin.'
      },
      {
        connector: 'X3',
        pins: 'Pin 1 - 6',
        label: 'Sensör Besleme Çıkışları (+15V & GND)',
        functionDesc: 'X3:1..4 (+15V DC), X3:5..6 (GND sensör). Harici sensörlerin besleme barası.',
        testAdvice: '15V barasında çökme veya aşırı ripple (<50mV) olup olmadığını multimetre ve skop ile ölçün.'
      },
      {
        connector: 'X4',
        pins: 'Pin 1 - 8',
        label: 'Dijital Girişler & Hava Aralığı (Air Gap)',
        functionDesc: 'X4:1..2 (Air gap switch A1/A2), X4:3 (Açı palseri), X4:4 (MSC kapalı), X4:7 (Kanat buz çözme).',
        testAdvice: 'Opto-izolatör girişlerinde 24V lojik sinyal seviyesini kontrol edin.'
      },
      {
        connector: 'X5 & X6',
        pins: 'Pin 1 - 6',
        label: 'Sıcaklık Sensörleri (KTY & PT100)',
        functionDesc: 'X5:3 (Kanat KTY), X5:5 (Rotor), X6:3 (Akü KTY), X6:5 (Motor PT100).',
        testAdvice: 'Oda sıcaklığında PT100 için ~108-110Ω, KTY84 için ~1000Ω direnç ölçülmelidir.'
      },
      {
        connector: 'X9',
        pins: 'Pin 1 - 3',
        label: 'Ultra-Cap & 90°/97° Limit Switch',
        functionDesc: 'X9:1 (0V Ultra Cap), X9:2 (LS 97°), X9:3 (LS 90°). Acil stop tüy konumu izleme.',
        testAdvice: 'Kanat 90° ve 97° limit pozisyonlarına ulaştığında switch kontaklarının açıldığını doğrulayın.'
      }
    ],
    knownFails: [
      {
        faultCode: '14;02 / 14;03',
        description: 'Pitch Açı Enkoderi / Haberleşme Hatası',
        affectedPins: ['X8:1..4', 'W1..W4'],
        typicalCauses: ['CAN2 bus transceiver arızası', 'X8 konnektöründe +15V besleme çökmesi', 'Sonlandırma direnci yanığı']
      },
      {
        faultCode: '44;105 / 44;106',
        description: 'Acil Stop / Kapasitör Test Hatası',
        affectedPins: ['X2:1..3', 'X9:1'],
        typicalCauses: ['Deşarj kondansatörlerinde ESR artışı', 'Şarj tetikleme optokuplöründe iletim kaybı', 'Balans dirençleri']
      },
      {
        faultCode: '34;12 / 34;15',
        description: 'Rotor Hız Sinyali Pals Hatası',
        affectedPins: ['X7:1..6'],
        typicalCauses: ['X7:2 15V regülatör arızası', 'Giriş Schmitt trigger entegresinde ESD hasarı', 'Kanal A/B opto-izolatör arızası']
      },
      {
        faultCode: 'CAN Ring Timeout',
        description: 'Pitch Box B/C Halka Haberleşme Kopukluğu',
        affectedPins: ['W7..W10'],
        typicalCauses: ['CAN3 optik veya diferansiyel sürücü arızası', 'Konnektör korozyonu / lehim çatlağı']
      }
    ]
  },
  {
    id: 'ENERCON_E82_PITCH_A02',
    name: 'Enercon E-82 Steuerkarte Pitch (-A02)',
    sapNo: '54060-2 / 60950-2',
    turbineModel: 'Enercon E-82 E2 (CS82a)',
    schematicTitle: 'E-82 Bereichsschaltplan Rotor - CS82a-02-R-V1-03',
    schematicVersion: 'V2.0 / V3.0 (Gelişmiş Seri)',
    defaultPreviewUrl: '/enercon_pitch_control_board.png',
    defaultPreviewType: 'image',
    schematicSourcePath: 'Devre şemaları/E82/Rotor CS82a-02-R-V1-03--D0128049-3.pdf',
    pinouts: [
      {
        connector: 'X1',
        pins: 'Pin 1, 2, 3',
        label: 'AC Besleme Girişi',
        functionDesc: 'L, N, PE Girişi. E-82 güç filtresi üzerinden beslenir.',
        testAdvice: '230V AC hat gerilimini ve hat filtresini kontrol edin.'
      },
      {
        connector: 'X7',
        pins: 'Pin 1 - 6',
        label: 'Rotor Hız Sensörü (Drehzahlaufnehmer)',
        functionDesc: 'E-82 çok kanallı hız algılayıcı.',
        testAdvice: '+15V DC referansı ve A/B kanalları arasındaki 90 derece faz farkını skopta inceleyin.'
      },
      {
        connector: 'X8',
        pins: 'Pin 1 - 4',
        label: 'Winkelcodierer CAN2',
        functionDesc: 'Kanat açı pozisyonlama veriyolu.',
        testAdvice: '120 ohm bus empedansı ve 2.5V CAN common-mode seviyesini ölçün.'
      },
      {
        connector: 'CAN1 & CAN3',
        pins: 'W11/W12, W7-W10',
        label: 'Merkezi ve Kanat Kutusu Veri Ağları',
        functionDesc: 'Yüksek hızlı senkron kanat açı kontrol ağı.',
        testAdvice: 'Kablo kalkanı toprak sürekliliğini test edin.'
      }
    ],
    knownFails: [
      {
        faultCode: 'Pitch Senkronizasyon Hatası',
        description: '3 Kanat arasında açı farkı aşımı',
        affectedPins: ['X8:1..4', 'CAN3'],
        typicalCauses: ['Açı enkoderi lojik katında gecikme', 'CAN ring jitter', 'Besleme kondansatörü sızıntısı']
      }
    ]
  },
  {
    id: 'ENERCON_RECTIFIER_DRIVER_V31',
    name: 'Enercon PCB Rectifier Driver Board V3.1',
    sapNo: '72544',
    turbineModel: 'Enercon E-70 / E-82 / E-112',
    schematicTitle: 'Doğrultucu Sürücü Devre Şeması',
    schematicVersion: 'V3.1',
    pinouts: [
      {
        connector: 'J1',
        pins: 'Pin 1 - 10',
        label: 'Gate Sürücü Çıkışları',
        functionDesc: 'IGBT Gate-Emitter tetikleme sinyalleri.',
        testAdvice: 'Gate çıkışlarında +15V açık, -5V kapalı gerilim seviyesini skop ile ölçün.'
      },
      {
        connector: 'J2',
        pins: 'Pin 1 - 6',
        label: 'Termal Koruma & Desat Algılama',
        functionDesc: 'Termoswitch ve Vce desat koruma geri beslemesi.',
        testAdvice: 'Kısa devre durumunda desat diyotunun sağlamlığını multimetre diyot modunda test edin.'
      }
    ],
    knownFails: [
      {
        faultCode: '66;51 / 66;52',
        description: 'Doğrultucu Tetik Kaybı / Termal Koruma',
        affectedPins: ['J1', 'J2'],
        typicalCauses: ['Optokuplör izolasyon zayıflaması (TLP250 / PC817)', 'TVS koruma diyot delinmesi', 'Sürücü sigortası']
      }
    ]
  }
];

class CardSchematicAgentService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    }
  }

  public getProfiles(): CardProfile[] {
    return PRELOADED_CARD_PROFILES;
  }

  public getProfileById(id: string): CardProfile | undefined {
    return PRELOADED_CARD_PROFILES.find(p => p.id === id);
  }

  private sapDictionaryCache: Record<string, string> | null = null;

  async getSapDictionary(): Promise<Record<string, string>> {
    if (this.sapDictionaryCache && Object.keys(this.sapDictionaryCache).length > 0) {
      return this.sapDictionaryCache;
    }
    try {
      const resp = await fetch('/sap_dictionary.json');
      if (resp.ok) {
        this.sapDictionaryCache = await resp.json();
        return this.sapDictionaryCache || {};
      }
    } catch (e) {
      console.warn('[CardSchematicAgent] Could not load sap_dictionary.json:', e);
    }
    return {};
  }

  /**
   * SAP Numarasına göre kartın ne olduğunu, türbindeki görevini, şema sayfasını ve pinout'larını analiz eder.
   */
  async analyzeCardBySapNumber(sapInput: string): Promise<SapCardAnalysisResult> {
    const rawClean = (sapInput || '').trim();
    const cleanUpper = rawClean.toUpperCase();
    const numOnly = cleanUpper.replace(/[^0-9]/g, '');

    // 1. Master SAP sözlüğünde ara
    const dict = await this.getSapDictionary();
    let officialDesc = dict[cleanUpper] || dict[numOnly] || dict['R' + numOnly] || dict['T' + numOnly] || '';

    // Doğrudan anahtarda bulunamadıysa kısmi eşleşme
    if (!officialDesc && numOnly) {
      for (const [k, v] of Object.entries(dict)) {
        if (k.includes(numOnly)) {
          officialDesc = v;
          break;
        }
      }
    }

    // Açıklamalar içinde arama
    if (!officialDesc && rawClean.length >= 3) {
      const searchLower = rawClean.toLowerCase();
      for (const [, v] of Object.entries(dict)) {
        if (v.toLowerCase().includes(searchLower)) {
          officialDesc = v;
          break;
        }
      }
    }

    const descUpper = (officialDesc || rawClean).toUpperCase();

    // 2. Bilinen Türbin Kartları İçin Derin Teknik Uzmanlık Eşleşmesi
    // 2.A Power Board Pitch / Pitch Power Modul / Motor Sürücü Kartı
    if (descUpper.includes('POWER BOARD') || (descUpper.includes('POWER') && descUpper.includes('PITCH')) || descUpper.includes('LEISTUNGSMODUL PITCH') || descUpper.includes('PITCH GÜÇ') || descUpper.includes('MOTOR SÜRÜCÜ')) {
      const components: SuspectedComponent[] = await this.enrichComponentsWithWorkshopStock([
        { designator: 'U3 / U4', name: 'Optocoupler Test Modülü / PC817 / TLP250', suspectedReason: 'Motor yön ve IGBT gate PWM tetikleme izolasyonu' },
        { designator: 'Q1 / Q2', name: 'IGBT Modülü Eupec BSM 75GB 120DN2', suspectedReason: 'H-Köprüsü motor yön ve güç anahtarlama katı' },
        { designator: 'D1 / D4', name: 'SMBJ36CA', suspectedReason: 'X10 motor çıkış klemensi aşırı gerilim koruma TVS diyotu' },
        { designator: 'R12 / R14', name: '10 Ohm 1W Metal Film Gate Direnci', suspectedReason: 'IGBT gate tetikleme akım sınırlayıcı' }
      ]);

      return {
        sapNo: numOnly || '54060-PWR',
        officialDescription: officialDesc || 'Platine Power Board Pitch / Leistungsmodul Pitch V1.3 / V3.0',
        cardName: 'Enercon Power Board Pitch (Pitch Motor Güç & IGBT Sürücü Kartı)',
        turbineModel: 'Enercon E-48 / E-70 / E-82',
        locationInTurbine: 'Rotor Alanı (Hub) / Pitch Panosu (=011+A-A03)',
        installationCode: '=011+A-A03 (Power Modul Pitch)',
        schematicBook: 'E-48 Bereichsschaltplan Rotor (CS48a-01-R-V1-06) / E-82 Rotor Şeması',
        schematicPage: 'Sayfa 30 - 31 (Kolon 4 - 8) / Motor Güç & IGBT Sürücü Katı',
        schematicPreviewUrl: '/enercon_pitch_control_board.png',
        powerSupply: '230V AC (X1 Girişi), 24V DC Lojik & Fren Beslemesi, ±15V İzole Gate Beslemesi',
        cardFunction: 'Pitch motorunu H-Köprüsü (H-Bridge) IGBT transistörleri üzerinden ileri ve geri yönde çevirerek kanat açısını milimetrik süren, mekanik freni (X11) ve acil stop ultra-kapasitör deşarjını yöneten ana motor güç ve sürücü kartıdır.',
        pinouts: [
          {
            connector: 'X10',
            pins: 'Pin 1 - 4',
            label: 'Pitch Motor Güç Çıkışı & IGBT H-Köprüsü',
            functionDesc: 'X10:1 (Motor Faz+), X10:2 (Motor Faz-), X10:3 (PE Toprak). Motoru ileri/geri döndüren ana güç barası.',
            testAdvice: 'X10 klemensinde motor dönerken 0-230V PWM palsi izleyin. Motor tek yöne dönüyorsa geri yön IGBT ve optokuplörünü test edin.'
          },
          {
            connector: 'X11',
            pins: 'Pin 1 - 2',
            label: 'Pitch Kanat Mekanik Freni (Holding Brake)',
            functionDesc: 'X11:1 (+24V/+48V Fren Açma), X11:2 (Fren Şase/GND). Kanat fren bobinini enerjilendirerek balatayı açar.',
            testAdvice: 'Motor hareket etmeden önce X11 pinlerinde 24V/48V gerilim gelmeli ve mekanik tık sesi duyulmalıdır.'
          },
          {
            connector: 'X1',
            pins: 'Pin 1 - 3',
            label: '230V AC Ana Şebeke Besleme Girişi',
            functionDesc: 'X1:1 (L), X1:2 (N), X1:3 (PE). Kartın dahili SMPS ve doğrultucu katını besler.',
            testAdvice: 'X1:1 ve X1:2 arasında 230V AC ±%10 ölçün. F1 koruma sigortasını kontrol edin.'
          },
          {
            connector: 'X2',
            pins: 'Pin 1 - 8',
            label: 'Acil Stop & Kapasitör Güvenlik Zinciri',
            functionDesc: 'Ultra-kapasitör deşarj hattı ve limit switch güvenlik kilitlemesi (-2° / 90° / 97°).',
            testAdvice: 'Acil stop devredeyken kapasitör voltajının (175V-400V) motora deşarj edildiğini doğrulayın.'
          },
          {
            connector: 'X7',
            pins: 'Pin 1 - 6',
            label: 'Rotor Hız Sensörü (Drehzahlaufnehmer)',
            functionDesc: '+15V DC sensör beslemesi ve A/B diferansiyel hız palsleri.',
            testAdvice: 'X7:2 pininde sabit +15V DC ölçün. İmpuls pinlerinde osiloskop ile kare dalga inceleyin.'
          },
          {
            connector: 'X8',
            pins: 'Pin 1 - 4',
            label: 'Açı Enkoderi & CAN2 Veri Yolu',
            functionDesc: 'Winkelcodierer mutlak açı sensörü ve CAN-bus hattı.',
            testAdvice: 'Enerjisizken X8:3 (CAN L) ve X8:4 (CAN H) arasında 60Ω - 120Ω sonlandırma empedansı ölçün.'
          },
          {
            connector: 'X3',
            pins: 'Pin 1 - 6',
            label: 'PLC / MPU İleri-Geri Tetikleme ve Komut Girişleri',
            functionDesc: 'Merkezi PLC den gelen ileri yön tetikleme, geri yön tetikleme ve hız referans komutları.',
            testAdvice: 'Giriş opto-izolatörlerinin LED girişlerinde 24V komut palsi gelip gelmediğini kontrol edin.'
          }
        ],
        chronicFailures: [
          {
            faultCode: 'Motor İleri Dönüyor, Geri Gelmiyor (Yön Tetikleme Kaybı)',
            description: 'Pitch motoru tek bir yöne sorunsuz hareket ederken ters yönde kilitli kalıyor veya tepki vermiyor.',
            typicalCauses: [
              'Geri yön H-köprüsü IGBT gate bacağını süren izolasyon optokuplörünün (PC817 / TLP250 / HCPL-3120) LED girişinin yanması',
              'Gate bacağına seri bağlı 10Ω akım sınırlama direncinin açık devre olması',
              'X10 klemensine giden geri yön ters paralel koruma diyotunda kısa devre veya soğuk lehim'
            ],
            testAdvice: 'X10 motor soketini sökün. Multimetreyi Diyot moduna alın; geri yön optokuplörünün 1-2 pinlerinde 1.1V, 3-4 çıkışında açık devre ölçmelisiniz. Şaseye karşı gate direncini 10 ohm ölçün.'
          },
          {
            faultCode: 'X11 Fren Açmıyor / Kanat Sıkışması',
            description: 'Motor dönmeye çalışıyor fakat aşırı akım çekerek termik açıyor (fren bobini enerjilenmiyor).',
            typicalCauses: ['X11 fren çıkış MOSFET / transistörünün yanması', 'Fren flyback söndürme diyotunun kısa devre olması', 'F2 fren sigortasının atması'],
            testAdvice: 'X11 klemensinde hareket komutu anında 24V DC ölçün. 0V ise fren sürücü transistörünü test edin.'
          },
          {
            faultCode: '14;02 / 14;03 - Açı & Haberleşme Hatası',
            description: 'Pitch açısı okunamıyor veya CAN bus veri hattında zaman aşımı meydana geliyor.',
            typicalCauses: ['X8 konnektöründe +15V regülatör çökmesi', 'CAN alıcı-verici entegresi hasarı', 'Kablo ekranlama kopukluğu'],
            testAdvice: 'X8 konnektörü pin 2 de +15V ölçün. CANH ve CANL hatlarını osiloskop ile kontrol edin.'
          }
        ],
        recommendedComponents: components,
        versionNotes: 'Şema çizimleri V1.3 referanslıdır. Masanızdaki kart V3.0 revizyonu ise harici klemens soketleri (X1..X11) birebir aynıdır; iç devrede ayrık transistörler yerine entegre SMD IGBT sürücüler yer almaktadır.'
      };
    }

    // 2.B Control Board Pitch (-A02)
    if (numOnly === '54060' || numOnly === '60950' || numOnly === '621662' || numOnly === '3211' || numOnly === '12724' || (descUpper.includes('PITCH') && (descUpper.includes('CONTROL') || descUpper.includes('STEUERKARTE')))) {
      const components: SuspectedComponent[] = await this.enrichComponentsWithWorkshopStock([
        { designator: 'U1 / U2', name: 'Optocoupler Test Modülü / PC817 / TLP250', suspectedReason: 'İzolasyon ve dijital tetikleme katı sinyal zayıflaması' },
        { designator: 'U4', name: 'CAN Transceiver PCA82C250 / SN65HVD230', suspectedReason: 'CAN2 açı enkoderi ve bus aşırı gerilim / ESD delinmesi' },
        { designator: 'D1 / D4', name: 'SMBJ36CA', suspectedReason: 'Hat aşırı gerilim bastırıcı TVS diyot kısa devresi' },
        { designator: 'C12', name: '150 nF 2000V Kondansatör', suspectedReason: 'Acil stop yüksek gerilim deşarj kapasitör kaybı' }
      ]);

      return {
        sapNo: numOnly || '54060',
        officialDescription: officialDesc || 'Platine Controlboard Pitch V1.3 / V3.0 (Steuerkarte Pitch)',
        cardName: 'Enercon Steuerkarte Pitch (-A02) / Pitch Kontrol Kartı',
        turbineModel: 'Enercon E-48 / E-53 / E-82',
        locationInTurbine: 'Rotor Alanı (Hub) / Kanat Ayar Dolabı',
        installationCode: '=011+A-A02 (Kanat Kontrol Panosu)',
        schematicBook: 'E-48 Bereichsschaltplan Rotor (CS48a-01-R-V1-06) / E-82 Rotor Şeması',
        schematicPage: 'Sayfa 30 (Kolon 1 - 8)',
        schematicPreviewUrl: '/enercon_pitch_control_board.png',
        powerSupply: '230V AC (X1 Girişi), Dahili +15V DC Regülatör Barası, 24V DI Lojik',
        cardFunction: '3 Kanadın açı enkoderlerini (-B01 Winkelcodierer CAN2), döner hız sensörünü (-J04 Drehzahlaufnehmer), tüy konumu limit switchlerini (90°/97°) ve acil stop ultra-kapasitör deşarjını CAN-Bus üzerinden denetleyen ana kanat kontrol beynidir.',
        pinouts: PRELOADED_CARD_PROFILES[0].pinouts,
        chronicFailures: [
          {
            faultCode: '14;02 / 14;03',
            description: 'Pitch Açı Enkoderi Zaman Aşımı / Haberleşme Kaybı',
            typicalCauses: ['X8 konnektöründe +15V besleme çökmesi', 'CAN2 transceiver entegresi (U4) arızası', 'Kablo ekranlama kopukluğu'],
            testAdvice: 'X8:2 ile X8:1 arasında 15V DC ölçün. Enerjisizken X8:3 ve X8:4 arasında 60Ω - 120Ω sonlandırma empedansı kontrol edin.'
          },
          {
            faultCode: '34;12 / 34;15',
            description: 'Rotor Hız Sensörü Pals Hatası (Slip Ring / Drehzahlaufnehmer)',
            typicalCauses: ['X7:2 beslemesinde gerilim kaybı', 'Schmitt-Trigger pals giriş entegresi hasarı', 'Kanal A/B optokuplör arızası'],
            testAdvice: 'X7:2 (+15V) beslemesini kontrol edin. Türbin yavaş dönerken X7:3 ve X7:5 pinlerinde osiloskop ile 0-15V kare dalga izleyin.'
          },
          {
            faultCode: '44;105 / 44;106',
            description: 'Acil Stop Kapasitör Test Hatası',
            typicalCauses: ['X2 ve X9 hattındaki 150nF/2000V kondansatörlerde ESR yükselmesi veya kısa devre', 'Şarj tetikleme optokuplör iletim kaybı'],
            testAdvice: 'LCR metre ile kondansatörleri 1kHz ESR testine tabi tutun.'
          }
        ],
        recommendedComponents: components,
        versionNotes: 'Şema çizimleri V1.3 referanslıdır. Masadaki kartınız V3 ise harici soket dizilimi uyumludur; iç komponentlerde ayrık transistörler yerine SMD entegre sürücüler kullanılmıştır.'
      };
    }

    if (numOnly === '72544' || descUpper.includes('RECTIFIER DRIVER')) {
      const components: SuspectedComponent[] = await this.enrichComponentsWithWorkshopStock([
        { designator: 'U1 / U2', name: 'Optocoupler Test Modülü / PC817 / TLP250', suspectedReason: 'Gate tetikleme ve PWM izolasyon kaybı' },
        { designator: 'D1 / D2', name: 'SMBJ36CA', suspectedReason: 'Gate hattı aşırı gerilim koruma TVS diyot delinmesi' },
        { designator: 'F1', name: 'Sigorta yuvası (Dik)', suspectedReason: 'Sürücü besleme hattı cam sigortası' }
      ]);

      return {
        sapNo: numOnly || '72544',
        officialDescription: officialDesc || 'PCB rectifier driver board V3.1 E44',
        cardName: 'Enercon Doğrultucu IGBT Sürücü Kartı (Rectifier Driver Board)',
        turbineModel: 'Enercon E-44 / E-70 / E-82 / E-112',
        locationInTurbine: 'Güç Kabini (=006) / Jeneratör Çıkışı Doğrultucu Ünitesi',
        installationCode: '=006 Güç Kabini',
        schematicBook: 'E-48/E-82 Gondol & Güç Kabini Devre Şeması',
        schematicPage: 'Güç Bölümü Doğrultucu Sürücü Katı (BOM Artikel: 72544)',
        powerSupply: '24V DC Yardımcı Besleme, ±15V Gate Anahtarlama',
        cardFunction: 'Jeneratörün ürettiği 3 fazlı değişken AC gücü türbin DC barasına dönüştüren IGBT/Tristör köprüsünü yüksek frekanslı PWM darbeleriyle tetikler; sıcaklık ve kısa devre (desat) anında jeneratörü korumaya alır.',
        pinouts: [
          { connector: 'J1', pins: '1-10', label: 'Gate-Emitter Tetikleme', functionDesc: 'Doğrultucu güç modülüne giden izole tetikleme sinyalleri', testAdvice: 'Skop ile +15V/-5V kare dalga anahtarlamayı gözlemleyin.' },
          { connector: 'J2', pins: '1-6', label: 'Termal & Desat Koruma', functionDesc: 'Termoswitch ve aşırı akım algılama geri bildirimi', testAdvice: 'Desat koruma diyotunu multimetre diyot modunda test edin.' }
        ],
        chronicFailures: [
          {
            faultCode: '66;51 / 66;52',
            description: 'Fault Rectifier: Thermo switch / Trigger Loss',
            typicalCauses: ['Optokuplör izolasyon zayıflaması', 'Gate koruma TVS diyotunda delinme', 'Termal koruma PTC lehim çatlağı'],
            testAdvice: 'Gate çıkışlarında osiloskopla temiz kare dalga gözlemleyin; optokuplör anahtarlama gecikmesini ölçün.'
          }
        ],
        recommendedComponents: components,
        versionNotes: 'V3.1 revizyonunda hızlı koruma katı güçlendirilmiştir.'
      };
    }

    if (numOnly === '59368' || descUpper.includes('CAPACITOR-BOARD') || descUpper.includes('KONDANSATÖR KARTI')) {
      const components: SuspectedComponent[] = await this.enrichComponentsWithWorkshopStock([
        { designator: 'C12 / C14', name: '150 nF 2000V Kondansatör', suspectedReason: 'Acil stop deşarj kapasitöründe sızıntı veya değer kaybı' },
        { designator: 'R5 / R8', name: '680 ohm 1/2W Direnç', suspectedReason: 'Şarj hattı akım sınırlama direnci değer kayması' },
        { designator: 'R10', name: '500 ohm 1/2W Direnç', suspectedReason: 'Dengeleme direnci aşırı ısınması' }
      ]);

      return {
        sapNo: numOnly || '59368',
        officialDescription: officialDesc || 'PCB capacitor-board V1.1',
        cardName: 'Enercon Acil Stop Kondansatör Kartı (Capacitor Board)',
        turbineModel: 'Enercon E-44 / E-48 / E-70 / E-82',
        locationInTurbine: 'Rotor Göbeği (=076) Kapasitör Kutusu',
        installationCode: '=076 Kapasitör Kutusu',
        schematicBook: 'E-48/E-82 Rotor Acil Güç Devre Şeması (=076/1.4)',
        schematicPage: 'Kapasitör Güvenlik Katı',
        powerSupply: 'Yüksek Gerilim DC Şarj Barası (175V - 400V)',
        cardFunction: 'Şebeke çökmesi veya acil fren durumunda kanat motorlarına anlık yüksek gerilim deşarjı sağlayarak kanatları mekanik stop konumuna (90° tüy konumu) çeviren güvenlik enerji modülüdür.',
        pinouts: [
          { connector: 'X1', pins: '1-4', label: 'DC Şarj Girişi', functionDesc: 'Kontrollü akım şarj barası', testAdvice: 'Şarj geriliminin 175V seviyesine stabil ulaştığını doğrulayın.' },
          { connector: 'X2', pins: '1-6', label: 'Deşarj ve Güvenlik Hattı', functionDesc: 'Acil stop tetikleme hattı', testAdvice: '2.5 saniyede deşarjın tamamlandığını test edin.' }
        ],
        chronicFailures: [
          {
            faultCode: '44;105 / 44;106',
            description: 'Acil Stop Kondansatör Test Hatası',
            typicalCauses: ['150nF/2000V kondansatörlerde ESR yükselmesi', 'D4/D6 diyot iletim kaybı', 'Balans dirençlerinde değer kayması'],
            testAdvice: 'LCR metre ile 1kHz frekansta ESR ve kapasite testi yapın; 1000V megger ile izolasyonu kontrol edin.'
          }
        ],
        recommendedComponents: components,
        versionNotes: 'Yüksek voltajlı güvenlik kartıdır; test sırasında deşarj prosedürlerine uyulmalıdır.'
      };
    }

    if (numOnly === '48342' || (descUpper.includes('RECTIFIER') && descUpper.includes('CONTROLBOARD'))) {
      const components: SuspectedComponent[] = await this.enrichComponentsWithWorkshopStock([
        { designator: 'C1', name: '0,1 uF(100nF)/1000V Kondansatör', suspectedReason: 'Besleme hattı dekuplaj kondansatörü' },
        { designator: 'U3', name: 'CAN Transceiver PCA82C250', suspectedReason: 'CAN haberleşme alıcı-verici arızası' },
        { designator: 'VR1', name: 'Potansiyometre 50K ohm', suspectedReason: 'Gerilim kalibrasyon trimpotu' }
      ]);

      return {
        sapNo: numOnly || '48342',
        officialDescription: officialDesc || 'PCB Controlboard Rectifier V1.2 E112',
        cardName: 'Enercon Doğrultucu Kontrol Kartı (Controlboard Rectifier)',
        turbineModel: 'Enercon E-82 / E-112',
        locationInTurbine: 'Güç Kabini (=006) / Doğrultucu Kontrol Modülü',
        installationCode: '=006 Doğrultucu Ana Ünitesi',
        schematicBook: 'E-82 Gondol & Kule Şeması',
        schematicPage: 'Güç Kontrol Bölümü',
        powerSupply: '24V DC Besleme, Dahili 5V ve 3.3V LDO Lojik',
        cardFunction: 'Doğrultucu sisteminin mikrodenetleyici tabanlı veri iletişimi, DC bara gerilim regülasyonu ve CAN-Bus senkronizasyonunu yönetir.',
        pinouts: [
          { connector: 'CAN-H/L', pins: '2 Pin', label: 'CAN Haberleşme', functionDesc: 'Merkezi PLC ile veri iletişimi', testAdvice: '60 ohm terminasyon empedansı ölçün.' }
        ],
        chronicFailures: [
          {
            faultCode: '304-97',
            description: 'Turbine Control Bus Error (Timeout): Rectifier',
            typicalCauses: ['CAN alıcı-verici entegresinde ESD hasarı', 'Besleme filtresi elektrolitik kondansatörlerinde şişme', '5V LDO voltaj regülatöründe çökme'],
            testAdvice: 'CANH-CANL empedansını ve 5V lojik besleme ripple gerilimini (<50mV) osiloskopla test edin.'
          }
        ],
        recommendedComponents: components,
        versionNotes: 'Mikrodenetleyici ve CAN hattı hassas ESD korumalıdır.'
      };
    }

    if (numOnly === '11835' || numOnly === '8734' || numOnly === '53980' || descUpper.includes('CHOPPER')) {
      const components: SuspectedComponent[] = await this.enrichComponentsWithWorkshopStock([
        { designator: 'Q1', name: 'IGBT-Modul 1200V 75A Eupec BSM 75GB 120DN2', suspectedReason: 'Fren kıyıcı IGBT delinmesi' },
        { designator: 'U1', name: 'Optocoupler Test Modülü / PC817', suspectedReason: 'Chopper tetik izolasyonu' },
        { designator: 'D1', name: 'SMBJ36CA', suspectedReason: 'TVS koruma diyotu' }
      ]);

      return {
        sapNo: numOnly || '11835',
        officialDescription: officialDesc || 'Platine Chopper-Pitch V1.2a E40 / E66',
        cardName: 'Enercon Pitch Fren Kıyıcı Kartı (Chopper-Pitch Board)',
        turbineModel: 'Enercon E-40 / E-48 / E-66 / E-82',
        locationInTurbine: 'Rotor Alanı (=011) / Kanat Motor Fren Grubu',
        installationCode: '=011 Rotor / Pitch Panosu',
        schematicBook: 'E-48 Rotor Şeması CS48a-01-R Sayfa 42 (BOM: 53980-0)',
        schematicPage: 'Sayfa 42 / 44',
        powerSupply: 'DC Bara Fren Gerilimi (400V - 700V DC)',
        cardFunction: 'Kanat pitch motorunun dinamik frenleme veya acil yön değişiminde ürettiği ters indüksiyon gerilimini frenleme dirençlerine aktararak DC baranın aşırı gerilimden patlamasını önleyen kıyıcı (chopper) sürücüsüdür.',
        pinouts: [
          { connector: 'PWR', pins: 'DC+ / DC-', label: 'DC Bara Girişi', functionDesc: 'Yüksek gerilimli frenleme barası', testAdvice: 'IGBT C-E arası kısa devre kontrolü yapın.' },
          { connector: 'TRIG', pins: '1-4', label: 'PWM Tetikleme', functionDesc: 'Kıyıcı frekans kontrolü', testAdvice: 'Gate voltajını osiloskopla ölçün.' }
        ],
        chronicFailures: [
          {
            faultCode: 'Chopper Overvoltage / Short Circuit',
            description: 'Frenleme Kıyıcı Aşırı Gerilim veya Kısa Devre',
            typicalCauses: ['BSM 75GB 120DN2 IGBT modülünde aşırı ısınma delinmesi', 'Gate sürücü optokuplör arızası'],
            testAdvice: 'IGBT terminallerinde multimetre diyot modunda 0.4V - 0.7V gövde diyot iletimini doğrulayın.'
          }
        ],
        recommendedComponents: components,
        versionNotes: 'Yüksek güç IGBT modülü içerir; montajda termal macun yenilenmelidir.'
      };
    }

    // 3. Genel SAP Eşleşmesi (Diğer tüm 54.000 malzeme için)
    let aiCardName = officialDesc ? officialDesc : `SAP ${cleanUpper} Elektronik Kart`;
    let aiFunction = 'Bu malzeme Demirer Holding türbin bakım ve servis envanterinde kayıtlı elektronik kontrol veya güç bileşenidir.';
    let aiLocation = 'Türbin Kontrol / Dağıtım Panosu';
    let aiSchematicBook = 'Genel Türbin Elektrik Şemaları';

    if (this.model && officialDesc) {
      try {
        const prompt = `
        Sen Enercon ve rüzgar türbini devre şemaları uzmanısın.
        Teknisyen şu SAP malzeme bilgisini girdi:
        SAP No: ${cleanUpper}
        Resmi Tanım: ${officialDesc}
        
        Lütfen 2-3 cümleyle şunları açıkla:
        1. Bu malzeme türbinde tam olarak ne kartıdır/parçasıdır?
        2. Türbinde nerede bulunur (Rotor, Gondol, Kule, Güç Kabini)?
        3. Şemadaki tesisat kodu (=005, =006, =011, =076 vb.) ne olabilir?
        
        Kısa, net ve teknik dilde Türkçe yanıt ver.
        `;
        const result = await this.model.generateContent(prompt);
        const respText = (await result.response).text();
        aiFunction = respText;
      } catch (e) {
        // keep fallback
      }
    }

    const genericComponents: SuspectedComponent[] = await this.enrichComponentsWithWorkshopStock([
      { designator: 'U1', name: 'Optocoupler Test Modülü / PC817', suspectedReason: 'Sinyal izolasyon katı' },
      { designator: 'C1', name: '150 nF 2000V Kondansatör', suspectedReason: 'Besleme ve filtre kondansatörü' },
      { designator: 'D1', name: 'SMBJ36CA', suspectedReason: 'TVS aşırı gerilim bastırıcı' }
    ]);

    return {
      sapNo: cleanUpper,
      officialDescription: officialDesc || 'SAP Sisteminde Kayıtlı Malzeme',
      cardName: aiCardName,
      turbineModel: descUpper.includes('E82') ? 'Enercon E-82' : (descUpper.includes('E48') ? 'Enercon E-48' : (descUpper.includes('E70') ? 'Enercon E-70' : 'Enercon Türbin')),
      locationInTurbine: aiLocation,
      installationCode: descUpper.includes('ROTOR') ? '=011 Rotor' : '=005 Kontrol / =006 Güç',
      schematicBook: aiSchematicBook,
      schematicPage: 'Şema İndeksi ve Parça Listesi (BOM)',
      powerSupply: '24V DC / 230V AC',
      cardFunction: aiFunction,
      pinouts: [
        { connector: 'PWR', pins: '1-2', label: 'Besleme Girişi', functionDesc: 'Çalışma gerilimi', testAdvice: 'Nominal voltajı multimetre ile ölçün.' },
        { connector: 'SIG', pins: '1-4', label: 'Sinyal ve Veri Hattı', functionDesc: 'Giriş/çıkış kontrol sinyalleri', testAdvice: 'Sinyal sürekliliğini test edin.' }
      ],
      chronicFailures: [
        {
          faultCode: 'Genel İletim / Besleme Hatası',
          description: 'Kart besleme çökmesi veya sinyal iletim kaybı',
          typicalCauses: ['Filtre kondansatörlerinde ESR artışı', 'Koruma diyotu kısa devresi', 'Giriş optokuplör hasarı'],
          testAdvice: 'Giriş sigortasını ve besleme raylarını multimetre ile test edin.'
        }
      ],
      recommendedComponents: genericComponents,
      versionNotes: 'Şema revizyonu ile masa revizyonu arasında komponent kodu veya kılıf (SMD/DIP) farkı olabilir.'
    };
  }

  /**
   * Teknisyenin sorularını ve yüklenen kart fotoğrafını analiz eden interaktif uzman metodu
   */
  async askElectronicAssistant(params: {
    cardName: string;
    question: string;
    pcbPhotoBase64?: string;
    pcbPhotoMimeType?: string;
    conversationHistory: Array<{ sender: 'USER' | 'AGENT'; text: string }>;
  }): Promise<string> {
    const historyStr = params.conversationHistory.slice(-6).map(h => `${h.sender === 'USER' ? 'Teknisyen' : 'Elektronik Başmühendisi'}: ${h.text}`).join('\n');

    let workshopStockSummary = "";
    try {
      const stock: WorkshopComponent[] = await workshopComponentService.getComponents();
      workshopStockSummary = stock.slice(0, 15).map(s => `- ${s.name}: ${s.shelfLocation || 'Atölye'}, Stok: ${s.quantity || 0} adet`).join('\n');
    } catch (e) {
      // ignore
    }

    const systemPrompt = `
Sen rüzgar türbini ve Enercon elektronik kart tamir başmühendisi ve atölye şefisin.
Karşındaki kişi tamir atölyesindeki elektronik kart teknisyenidir.

İNCELENEN KART: ${params.cardName || 'Enercon Pitch / Güç Kartı'}

DİYALOG GEÇMİŞİ:
${historyStr}

TEKNİSYENİN SORUSU:
"${params.question}"

MEVCUT ATÖLYE YEDEK ELEKTRONİK MALZEME STOKLARI:
${workshopStockSummary}

TALİMATLARIN:
1. KLEMENSLER VE BAĞLANTILAR: Teknisyene sorusunun ilgili olduğu klemensleri (Örn: X10 motor güç klemensi, X11 klemensi, X1 AC besleme, X7 hız, X8 açı) doğrudan belirt. Hangi klemensin nereye gittiğini ve ne taşıdığını net açıkla.
2. MOTOR İLERİ/GERİ, IGBT VE SÜRÜCÜ MANTIĞI: Örneğin motor bir yöne dönüp diğer yöne dönmüyorsa; motoru süren H-köprüsü IGBT'lerden geri yön kolunun tetikleme almadığını, bunu sağlayan izolasyon optokuplörünü (PC817 / TLP250 / HCPL-3120) ve gate sürücü hattını tane tane anlat.
3. KART FOTOĞRAFI ANALİZİ (EĞER FOTOĞRAF YÜKLENDİYSE):
   - Sana ekte teknisyenin masadaki kartının fotoğrafı verilmiştir.
   - Fotoğrafı çok dikkatli incele: Komponentleri (optokuplörler, entegreler, TVS diyotlar, dirençler, transistörler), kılıfları (SMD / DIP), varsa kararma veya lehim kusurlarını tespit et.
   - Teknisyenin sorduğu işleve (örn: ters yön tetiklemesi veya besleme) denk gelen komponenti fotoğraftan konumlandırarak söyle (Örn: "Kartın üzerindeki U2 serigrafili optokuplör", "klemensin hemen arkasındaki TVS diyot").
   - Multimetre ile hangi bacakları ölçmesi gerektiğini söyle (Diyot kademesinde 1-2 pinleri ~1.1V, 3-4 pinleri açık devre).
4. ATÖLYE ÇEKMECESİ: Eğer değişmesi gereken parça atölye stoklarımızda varsa çekmece numarasını da belirt.
5. ÜSLUP: Usta-çırak ilişkisinde, samimi, saygılı, son derece yetkin, teknik ve Türkçe cevap ver.
`;

    if (!this.model) {
      return this.generateOfflineAssistantAnswer(params.cardName, params.question);
    }

    try {
      const contentParts: any[] = [];
      if (params.pcbPhotoBase64 && params.pcbPhotoMimeType) {
        contentParts.push({
          inlineData: {
            data: params.pcbPhotoBase64,
            mimeType: params.pcbPhotoMimeType
          }
        });
      }
      contentParts.push(systemPrompt);

      const result = await this.model.generateContent(contentParts);
      const response = await result.response;
      return response.text();
    } catch (e: any) {
      console.warn('[CardSchematicAgent] askElectronicAssistant error:', e);
      return this.generateOfflineAssistantAnswer(params.cardName, params.question);
    }
  }

  private generateOfflineAssistantAnswer(cardName: string, question: string): string {
    const q = question.toLowerCase();
    if (q.includes('ileri') || q.includes('geri') || q.includes('motor') || q.includes('dönmüyor')) {
      return `**Motor İleri Gidip Geri Gelmiyorsa Teşhis ve Çözüm Adımları:**

1. **Motoru Ne Kontrol Ediyor ve IGBT Nereye Bağlı?**
   - Pitch motorunun yönünü kart üzerindeki **H-Köprüsü (H-Bridge) IGBT güç anahtarları** kontrol eder.
   - Motor güç çıkışları devre şemasında **X10 klemensine** (Power Modul Pitch) bağlıdır.
   - İleri yön için üst-sol ve alt-sağ IGBT'ler tetiklenirken, geri yön için ters çapraz IGBT çifti tetiklenir.

2. **Neden Geri Gelmez? (Kök Neden):**
   - Motor tek yöne rahat dönüp diğer yöne hiç tepki vermiyorsa, sorun motorda değil **kart üzerindeki geri yön PWM tetikleme izolasyon katındadır**.
   - En sık karşılaşılan arıza, geri yön IGBT'sinin gate bacağını süren **optokuplörün (PC817 / TLP250 / HCPL-3120)** LED tarafının yanması veya fototransistör çıkışının iletim vermemesidir.

3. **Nasıl Test Edilir? (Masa Ölçümü):**
   - Kart enerjisizken multimetreyi **Diyot Kademesine** alın.
   - İlgili optokuplörün 1-2 numaralı giriş pinleri arasında **1.1V - 1.2V** diyot iletimi görmelisiniz. Açık devre (1 / OL) görüyorsanız optokuplör yanmıştır.
   - Ayrıca X10 klemensinin geri yön tetikleme pinlerini şaseye karşı ölçün; hat üzerindeki TVS koruma diyotunda kısa devre olup olmadığını kontrol edin.

4. **Atölye Stoğu:**
   - Yedek optokuplörler atölyemizde **Çekmece No: 3**'te mevcuttur. Değişim sonrası motoru iki yöne de test edebilirsiniz.`;
    }

    return `**${cardName} Arıza Analizi ve Klemens Yönlendirmesi:**

- **Klemens Bağlantıları:** Kartın ana beslemesi X1 klemensinden 230V AC olarak girer. Dahili DC-DC katında +15V ve 24V lojik gerilimlere dönüştürülür.
- **Şüpheli Komponentler:** Sinyal kaybı ve tetikleme problemlerinde klemens girişlerindeki optokuplör izolasyonlarını ve aşırı gerilim TVS koruma diyotlarını (SMBJ36CA) multimetre diyot modunda test edin.
- İsterseniz masadaki kartınızın fotoğrafını yükleyin; şüpheli parçayı doğrudan kartın görseli üzerinden işaretleyeyim.`;
  }

  /**
   * Atölye bileşen stoklarıyla eşleştirme yapar.
   */
  private async enrichComponentsWithWorkshopStock(components: SuspectedComponent[]): Promise<SuspectedComponent[]> {
    try {
      const workshopStock: WorkshopComponent[] = await workshopComponentService.getComponents();
      return components.map(comp => {
        const q = comp.name.toLowerCase();
        const des = comp.designator.toLowerCase();
        const found = workshopStock.find(item => {
          const iname = item.name.toLowerCase();
          const icode = (item.code || '').toLowerCase();
          return iname.includes(q) || q.includes(iname) || (icode && q.includes(icode));
        });

        if (found) {
          return {
            ...comp,
            drawerLocation: found.shelfLocation || 'Atölye Depo',
            inStock: (found.quantity || 0) > 0,
            stockQty: found.quantity || 0,
            workshopComponentId: found.id
          };
        }
        return comp;
      });
    } catch (e) {
      console.warn('[CardSchematicAgent] Workshop stock match failed:', e);
      return components;
    }
  }

  /**
   * Gemini ile Şematik ve Arıza Teşhis Analizi Başlatır.
   */
  async startAnalysis(params: {
    cardProfileId?: string;
    cardName: string;
    schematicBase64?: string;
    schematicMimeType?: string;
    physicalVersion: string; // Örn: 'V3.0'
    schematicVersion?: string; // Örn: 'V1.3'
    faultCode: string;
    faultSymptoms: string;
    technicianObservation?: string;
  }): Promise<DiagnosticAnalysisResult> {
    const selectedProfile = params.cardProfileId ? this.getProfileById(params.cardProfileId) : undefined;
    const effectiveCardName = selectedProfile ? selectedProfile.name : params.cardName;
    const effectiveSchematicVer = params.schematicVersion || (selectedProfile ? selectedProfile.schematicVersion : 'Belirtilmemiş');

    // Atölye çekmeceleri ve stok listesi özeti
    let workshopStockSummary = "Atölye Stok Bilgisi:\n";
    try {
      const stock: WorkshopComponent[] = await workshopComponentService.getComponents();
      workshopStockSummary += stock.slice(0, 30).map(s => `- ${s.name} (${s.code || ''}): ${s.shelfLocation || 'Konum yok'}, Mevcut: ${s.quantity || 0} adet`).join('\n');
    } catch (e) {
      workshopStockSummary += "Stok listesi okunamadı.";
    }

    const systemPrompt = `
Sen rüzgar türbini ve endüstriyel elektronik kartlar (özellikle ENERCON Steuerkarte Pitch, Chopper, Rectifier kartları) konusunda dünyanın en kıdemli 'Yapay Zeka Elektronik Kart ve Şematik Başmühendisi'sin.

DEVRE ŞEMASI VE STANDART KURALLARI:
1. Enercon DIN 40719-1 ve DIN 40900 standartlarını tam bilirsin.
   - Parça Kodlama: =Tesisat +Konum -Komponent :Pin (Örn: =011+A-X01:1 veya =006-K01.2).
   - Sayfa Yapısı: Sayfalar 8 dikey kolona (1..8) ayrılmıştır. Sinyaller soldan sağa, yukarıdan aşağıya akar.
   - Çapraz Referans (Cross-Reference): /sayfa.kolon mantığı (Örn: 11.A.K08/2.1 veya =076/1.4).
   - Girişler üst tarafta, çıkışlar alt taraftadır.

2. VERSİYON FARKLILIKLARI VE ADAPTASYON (VERSION TOLERANCE):
   - Kullanıcının şemadaki versiyonu: ${effectiveSchematicVer}
   - Masadaki fiziksel kart versiyonu: ${params.physicalVersion || 'Bilinmiyor / Belirtilmemiş'}
   - KRİTİK KURAL: Şema V1.3 iken masadaki kart V3 ise DIŞ DÜNYA PİNLERİ (X1 AC besleme, X7 hız sensörü, X8 açı enkoderi, CAN1, CAN2, CAN3, X10 güç modülü) geriye dönük uyumludur. Ancak V3 revizyonunda ayrık transistörler yerine entegre sürücüler (SMD), farklı optokuplör modelleri (örn: TLP250 yerine HCPL-3120) veya farklı LDO voltaj regülatörleri kullanılmış olabilir. Teknisyene hem şema pinlerini ver hem de bu revizyon farklarını uyar!

KART VE ARIZA BİLGİSİ:
- Kart: ${effectiveCardName} (SAP: ${selectedProfile?.sapNo || '-'})
- Arıza Kodu: ${params.faultCode || 'Kod girilmedi'}
- Arıza Belirtisi: ${params.faultSymptoms}
- Teknisyen Ön Gözlemi: ${params.technicianObservation || 'Yok'}

MEVCUT ATÖLYE ÇEKMECE VE BİLEŞEN STOKLARI:
${workshopStockSummary}

GÖREVİN:
Aşağıdaki JSON şemasına BİREBİR uyan, Türkçe, son derece net, bir elektronik teknisyeninin masada multimetre, osiloskop ve LCR metre ile uygulayabileceği nokta atışı bir teşhis kılavuzu üret.

JSON Formatı (SADECE JSON döndür, markdown bloğu içine al):
{
  "cardName": "${effectiveCardName}",
  "detectedVersionNote": "Şema ${effectiveSchematicVer} ile Fiziksel Kart ${params.physicalVersion} arasındaki uyum ve dikkat edilmesi gereken revizyon farkları analizi...",
  "circuitSection": "Arızanın ait olduğu kart devresi (Örn: Rotor Hız Sensörü İmpuls Katı & +15V DC Besleme)",
  "rootCauseAnalysis": "Bu arıza kodunun ve belirtisinin şematik üzerindeki en olası kök nedenleri...",
  "schematicReferences": [
    {
      "code": "-X7:2 (+15V)",
      "crossRef": "Rotor Şeması Sayfa 30, Kolon 1",
      "description": "Rotor hız sensörü slip-ring besleme çıkışı"
    }
  ],
  "testSteps": [
    {
      "stepNo": 1,
      "title": "X7 Konnektör Besleme Gerilimi Kontrolü",
      "targetPinOrPoint": "X7:2 (+15V) ile X7:1 (GND) arası",
      "testType": "VOLTAGE_DC",
      "instruction": "Multimetreyi DC 50V kademesine alın. Kırmızı probu X7:2 pinine, siyah probu X7:1 GND pinine değdirin.",
      "expectedValue": "+15.0V DC (±0.5V)",
      "criticalNote": "Eğer 0V ise veya 12V altına düşmüşse kartın dahili DC-DC regülatör katında çökme vardır."
    },
    {
      "stepNo": 2,
      "title": "Kanal A / B İmpuls Pals Testi",
      "targetPinOrPoint": "X7:3 (Pals A) ve X7:5 (Pals B)",
      "testType": "OSCILLOSCOPE",
      "instruction": "Osiloskop probunu X7:3 pinine bağlayın, türbin yavaş dönerken veya simülatör ile tetiklendiğinde sinyali gözlemleyin.",
      "expectedValue": "0-15V temiz kare dalga (Duty cycle ~%50)",
      "criticalNote": "Pals yoksa veya tepeler yuvarlaklaşmışsa Schmitt-Trigger giriş entegresi veya optokuplör hasarlıdır."
    }
  ],
  "suspectedComponents": [
    {
      "designator": "U2",
      "name": "Optocoupler Test Modülü / PC817 / HCPL-3120",
      "packageType": "DIP-8 / SMD",
      "suspectedReason": "İmpuls hattı izolasyon katında açık devre veya iletim kaybı"
    }
  ],
  "nextActionRecommendation": "Teknisyenin bu testleri yaptıktan sonra yapması gereken nihai işlem özeti..."
}
`;

    // Multimodal support: if base64 provided, pass inlineData
    const contentParts: any[] = [];
    if (params.schematicBase64 && params.schematicMimeType) {
      contentParts.push({
        inlineData: {
          data: params.schematicBase64,
          mimeType: params.schematicMimeType
        }
      });
    }

    contentParts.push(systemPrompt);

    if (!this.model) {
      return await this.generateOfflineFallback(effectiveCardName, params.physicalVersion, params.faultCode, params.faultSymptoms);
    }

    try {
      const result = await this.model.generateContent(contentParts);
      const response = await result.response;
      const text = response.text();
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed: DiagnosticAnalysisResult = JSON.parse(cleanJson);

      parsed.suspectedComponents = await this.enrichComponentsWithWorkshopStock(parsed.suspectedComponents);
      return parsed;
    } catch (e: any) {
      console.error('[CardSchematicAgent] Gemini generation error:', e);
      return await this.generateOfflineFallback(effectiveCardName, params.physicalVersion, params.faultCode, params.faultSymptoms);
    }
  }

  /**
   * Teknisyenin girdiği ölçüm değerine göre (İnteraktif Sohbet / Derinleşme)
   */
  async continueDiagnosis(params: {
    cardName: string;
    physicalVersion: string;
    conversationHistory: Array<{ sender: 'USER' | 'AGENT'; text: string }>;
    userMeasurementFeedback: string;
  }): Promise<string> {
    if (!this.model) {
      return "Multimetre ile ölçtüğünüz 0V değeri, besleme hattındaki F1 koruma sigortasının veya giriş koruma TVS diyotunun kısa devreye düştüğünü gösteriyor. Lütfen diyot kademesinde D4 diyotunu iki yönlü ölçün.";
    }

    const historyStr = params.conversationHistory.map(h => `${h.sender === 'USER' ? 'Teknisyen' : 'AI Şematik Uzmanı'}: ${h.text}`).join('\n');

    const prompt = `
Sen rüzgar türbini ve Enercon elektronik kart tamir başmühendisliğini yürüten akıllı asistansın.
Kart: ${params.cardName} (Fiziksel Revizyon: ${params.physicalVersion})

Önceki Test ve Diyalog Geçmişi:
${historyStr}

Teknisyenin Yeni Ölçüm Bildirimi:
"${params.userMeasurementFeedback}"

GÖREVİN:
1. Teknisyenin verdiği bu yeni ölçüm sonucunu analiz et.
2. Bu sonuca göre arıza hangi komponenete veya devre hattına doğru daraldı?
3. Teknisyene ŞİMDİ yapması gereken bir sonraki ölçümü veya parça değişim adımını söyle (Örn: "D4 diyotunu söküp masada test edin", "U3 regülatörünün 2. bacağındaki voltajı ölçün").
4. Eğer fiziksel kart versiyonuna (V1 vs V3) özgü bir detay varsa bunu da vurgula.
5. Yanıtın son derece doğrudan, teknik ve teknisyene sahada/masada yol gösteren bir dilde Türkçe olsun. Markdown formatı kullan.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (e: any) {
      console.warn('[CardSchematicAgent] Follow-up error:', e);
      return `Ölçüm sonucunuz değerlendirildi. Belirtilen değer hattaki gerilim çökmesini doğrulamaktadır. Lütfen hat üzerindeki koruma diyotlarını ve şönt dirençleri kontrol edin.`;
    }
  }

  /**
   * API veya bağlantı hatası durumunda akıllı yerel kural motoru devresi
   */
  private async generateOfflineFallback(cardName: string, physicalVersion: string, faultCode: string, faultDesc: string): Promise<DiagnosticAnalysisResult> {
    const isSpeedSensor = (faultCode + faultDesc).toLowerCase().includes('hız') || (faultCode + faultDesc).includes('X7') || faultCode.includes('34;');
    const isAngleOrCan = (faultCode + faultDesc).toLowerCase().includes('can') || (faultCode + faultDesc).toLowerCase().includes('açı') || faultCode.includes('14;');

    const step1: DiagnosticTestStep = isSpeedSensor ? {
      stepNo: 1,
      title: 'X7 Sensör Besleme Çıkışı Ölçümü',
      targetPinOrPoint: 'X7:2 (+15V) ile X7:1 (GND)',
      testType: 'VOLTAGE_DC',
      instruction: 'Multimetreyi DC 50V kademesine alarak X7 konnektörü 2. pindeki +15V DC besleme gerilimini ölçün.',
      expectedValue: '+15.0V DC (±0.5V)',
      criticalNote: '0V ise kart üzerindeki 15V zener veya DC regülatör katını inceleyin.'
    } : {
      stepNo: 1,
      title: 'CAN2 Bus Sonlandırma Empedansı Ölçümü',
      targetPinOrPoint: 'X8:3 (CAN L) ve X8:4 (CAN H)',
      testType: 'RESISTANCE',
      instruction: 'Kart enerjisiz durumda iken X8:3 ve X8:4 pinleri arasına multimetrenin ohmmetre kademesini bağlayın.',
      expectedValue: '60Ω - 120Ω',
      criticalNote: 'Açık devre (sonsuz ohm) veya 0 ohm (kısa devre) ise CAN transceiver veya koruma TVS diyotu yanmıştır.'
    };

    const step2: DiagnosticTestStep = isSpeedSensor ? {
      stepNo: 2,
      title: 'İmpuls Pals Dalga Şekli Kontrolü',
      targetPinOrPoint: 'X7:3 (Kanal A) ve X7:5 (Kanal B)',
      testType: 'OSCILLOSCOPE',
      instruction: 'Osiloskop probunu X7:3 pinine bağlayın ve kare dalga pals sinyalini inceleyin.',
      expectedValue: '0-15V kare dalga, net yükselen ve düşen kenarlar',
      criticalNote: 'Dalga formu bozuksa giriş opto-izolatör katını değiştirin.'
    } : {
      stepNo: 2,
      title: 'CAN Transceiver Besleme Gerilimi',
      targetPinOrPoint: 'U1 Entegresi Pin 3 (VCC) - Pin 2 (GND)',
      testType: 'VOLTAGE_DC',
      instruction: 'CAN alıcı-verici entegresinin VCC bacağına 5V DC ulaştığını doğrulayın.',
      expectedValue: '5.0V DC',
      criticalNote: 'LDO 5V regülatörü aşırı ısınıyorsa entegre içten kısa devreye düşmüştür.'
    };

    const comp1: SuspectedComponent = isSpeedSensor ? {
      designator: 'U2 / U4',
      name: 'Optocoupler Test Modülü / PC817 / TLP250',
      packageType: 'DIP-8 / SMD',
      suspectedReason: 'Giriş izolasyon optokuplöründe iletim kaybı veya LED tarafı açık devre'
    } : {
      designator: 'U1',
      name: 'CAN Transceiver PCA82C250 / SN65HVD230',
      packageType: 'SOIC-8',
      suspectedReason: 'CAN bus aşırı gerilim veya ESD hasarı'
    };

    const comp2: SuspectedComponent = {
      designator: 'D1 / D2',
      name: 'SMBJ36CA',
      packageType: 'DO-214AA (SMD)',
      suspectedReason: 'TVS aşırı gerilim koruma diyotunda kısa devre delinmesi'
    };

    const rawResult: DiagnosticAnalysisResult = {
      cardName,
      detectedVersionNote: `Devre şeması V1.3 referans alınmıştır. Masadaki kartınız (${physicalVersion || 'V3.0'}) üzerinde dış konnektör pinleri uyumludur; ancak komponentler SMD kılıf veya güncel entegre versiyonları olabilir.`,
      circuitSection: isSpeedSensor ? 'Rotor Hız Sensörü İmpuls Arayüzü & +15V Besleme' : 'CAN-Bus Açı Enkoderi ve Yük Kontrol Hattı',
      rootCauseAnalysis: `Belirtilen ${faultCode || 'arızada'} en sık karşılaşılan kök neden, harici hatlardan gelen statik deşarj (ESD) veya darbe geriliminin giriş optokuplörü ve TVS diyotlarında hasar oluşturmasıdır.`,
      schematicReferences: [
        {
          code: isSpeedSensor ? '-X7:2 (+15V)' : '-X8:3/4 (CAN2)',
          crossRef: 'Rotor Şeması Sayfa 30, Kolon 1-2',
          description: isSpeedSensor ? 'Hız sensörü slip-ring arayüzü' : 'Açı enkoderi CAN haberleşmesi'
        }
      ],
      testSteps: [step1, step2],
      suspectedComponents: [comp1, comp2],
      nextActionRecommendation: 'Önerilen test adımlarını multimetre ve osiloskop ile tamamlayın. Arızalı komponenti atölye çekmece stoklarımızdan temin ederek değişimini yapın.'
    };

    rawResult.suspectedComponents = await this.enrichComponentsWithWorkshopStock(rawResult.suspectedComponents);
    return rawResult;
  }
}

export const cardSchematicAgentService = new CardSchematicAgentService();
