import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

export interface Vehicle {
  id: string;
  plate: string;                  // Örn: "34 DH 1923"
  brandModel: string;             // Örn: "Ford Ranger 2.0 TDCI"
  year?: number;                  // Örn: 2023
  vin?: string;                   // Şasi Numarası (VIN)
  company?: string;               // Ruhsat Sahibi Firma (Örn: "Anemon Enerji A.Ş.")
  type: 'PICKUP' | 'PANELVAN' | 'BINEK' | 'MINIBUS';
  siteId: string;                 // Örn: "2688"
  siteName: string;               // Örn: "Anemon İntepe"
  assignedTeamId?: string;        // Örn: "dh-tm01"
  assignedTeamName?: string;      // Örn: "Team 01"
  assignedDriverId?: string;
  assignedDriverName?: string;    // Örn: "Volkan VARDAR"
  currentKm: number;
  
  // Zorunlu Muayene & Sigorta Tarihleri
  inspectionDueDate: string;       // TÜVTÜRK Muayene Bitiş (YYYY-MM-DD)
  trafficInsuranceDueDate: string; // Zorunlu Trafik Sigortası Bitiş
  kaskoDueDate: string;            // Kasko Bitiş Tarihi
  exhaustDueDate: string;          // Egzoz Emisyon Muayenesi
  lastMaintenanceKm: number;      // Son Periyodik Bakım KM
  nextMaintenanceKm: number;      // Gelecek Periyodik Bakım KM
  
  // Ekipman & Yangın Tüpü & Lastik
  fireExtinguisherDueDate: string; // Yangın Söndürme Tüpü Dolum Tarihi
  hasEmergencyKit: boolean;        // İlk yardım çantası, takoz, çekme halatı
  hasSnowChains: boolean;          // Kar zinciri var mı
  tireSeason: 'WINTER' | 'SUMMER'; // Şu an araç üzerinde takılı olan lastik
  tireStorageLocation?: string;    // Depodaki boş lastiklerin raf yeri (Örn: "Anemon Depo A-04")
  lastTireChangeDate?: string;     // Son Lastik Değişim Tarihi (YYYY-MM-DD)
  lastTireChangeKm?: number;       // Son Lastik Değişim KM'si (Örn: 105.387 KM)
  lastTireChangeSeason?: 'WINTER' | 'SUMMER';
  lastTireChangeNotes?: string;    // Örn: "105.387 KM'de 4 Adet Yaz Lastiği Takıldı"
  
  status: 'ACTIVE' | 'MAINTENANCE' | 'INSPECTION_EXPIRED' | 'OUT_OF_SERVICE';
  notes?: string;
  createdBy?: string;             // Kaydı oluşturan kullanıcı (e-posta veya isim)
  createdAt: string;
  updatedAt: string;
}

export interface VehicleInspectionReport {
  id: string;
  vehicleId: string;
  plate: string;
  inspectionDate: string;
  inspectedBy: string;
  team: string;
  km: number;
  exteriorPhotoUrl?: string; // 1. Dış Görünüm
  interiorPhotoUrl?: string; // 2. İç Kabin & Torpido
  enginePhotoUrl?: string;   // 3. Kaput Açık Motor Bölmesi
  trunkPhotoUrl?: string;    // 4. Bagaj & Ekipman (Yangın tüpü, takoz, zincir, stepne)
  odometerPhotoUrl?: string; // 5. KM Göstergesi
  notes?: string;
  status: 'PASSED' | 'NEEDS_ATTENTION' | 'REJECTED';
  createdBy?: string;
  createdAt: string;
}

export interface DriverLicenseRecord {
  id: string;
  personnelId: string;
  personnelName: string;
  team: string;
  licenseNumber: string;          // T.C. / Ehliyet Belge No
  licenseClass: string;           // Örn: "B", "C", "CE"
  
  // Zorunlu Sertifikalar
  srcExpiryDate?: string;         // SRC Belgesi Bitiş Tarihi
  psychotechnicExpiryDate?: string; // Psikoteknik Belgesi Bitiş Tarihi
  
  // 3 Aylık Zorunlu Ehliyet Kontrolü
  last3MonthCheckDate: string;    // Son 3 Aylık Beyan Tarihi
  next3MonthCheckDate: string;    // Gelecek 3 Aylık Beyan Tarihi
  isLicenseActive: boolean;       // Ehliyete el konulma durumu (Aktif mi?)
  checkNotes?: string;            // Sürücü beyan notu
  createdBy?: string;
  updatedAt: string;
}

export interface TrafficFineRecord {
  id: string;
  vehicleId: string;
  plate: string;
  fineDate: string;               // Ceza Tarihi
  fineCode: string;               // Örn: "51/2-a (Yerleşim Yeri Hız İhlali)"
  amount: number;                 // Ceza Tutarı (TL)
  driverId?: string;
  driverName?: string;
  team?: string;
  discountDeadline: string;       // %25 Erken Ödeme İndirimi Son Gün (Ceza tarihinden 15 gün sonra)
  status: 'PENDING' | 'PAID' | 'DISCOUNT_EXPIRED';
  paidBy?: 'COMPANY' | 'PERSONNEL'; // Şirket mi ödedi, Personel mi?
  paidAmount?: number;            // Ödenen tutar (Erken İndirimli 4.500 TL veya Tam Tutar 6.000 TL)
  paymentDate?: string;           // Ödeme yapılan tarih
  paidByName?: string;            // Ödeyen personelin adı (Personel ödediyse)
  notes?: string;
  createdBy?: string;
}

export interface VehicleDamageReport {
  id: string;
  vehicleId: string;
  plate: string;
  reportDate: string;
  reportedBy: string;
  team: string;
  damageType: 'ACCIDENT' | 'SCRATCH' | 'MECHANICAL_FAULT' | 'TIRE' | 'OTHER';
  description: string;
  photoUrls: string[];
  accidentReportPhotoUrl?: string; // Anlaşmalı kaza tutanağı veya polis zaptı PDF/Görsel
  otherPartyPlate?: string;        // Karşı taraf plakası / sürücü bilgisi
  insuranceClaimNo?: string;       // Kasko/Sigorta hasar dosya no
  status: 'OPEN' | 'IN_REPAIR' | 'RESOLVED';
  resolvedNotes?: string;
  createdBy?: string;
}

export interface VehicleMaintenanceRecord {
  id: string;
  vehicleId?: string;
  plate: string;
  serviceType: 'PERIODIC_MAINTENANCE' | 'REPAIR' | 'TIRE_CHANGE' | 'BRAKE_SERVICE' | 'OTHER';
  serviceTypeLabel?: string;
  serviceDate: string;             // Bakım/Onarım Yapılan Tarih (YYYY-MM-DD)
  serviceKm: number;               // Bakıma Gittiği KM (Örn: 105.387 KM)
  nextMaintenanceKm?: number;      // Gelecek Bakım KM'si (Örn: 120.387 KM)
  serviceNameCompany?: string;     // Özel Servis / Yetkili Servis Adı
  costAmount: number;              // Bakım / Onarım Tutarı (TL)
  invoiceNumber?: string;          // Fatura / Fiş Numarası
  receiptPhotoUrl?: string;        // Bakım Fişi / Fatura Fotoğrafı veya Belge
  descriptionNotes: string;        // Yapılan İşlemler / Değişen Parçalar
  performedBy?: string;            // Kaydı oluşturan personel
  createdAt: string;
}

export interface VehicleAlert {
  id: string;
  type: 'INSPECTION' | 'TRAFFIC_INSURANCE' | 'KASKO' | 'TIRE_SEASON' | 'DRIVER_CHECK_3M' | 'MAINTENANCE_KM' | 'FIRE_EXTINGUISHER';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  vehicleId?: string;
  plate?: string;
  driverId?: string;
  driverName?: string;
  daysLeft?: number;
  targetDate?: string;
}

const STORAGE_KEYS = {
  VEHICLES: 'dh_servis_vehicles_v2',
  DRIVERS: 'dh_servis_driver_licenses_v2',
  FINES: 'dh_servis_traffic_fines_v2',
  DAMAGES: 'dh_servis_vehicle_damages_v2',
  INSPECTIONS: 'dh_servis_vehicle_inspections_v2',
  MAINTENANCE: 'dh_servis_vehicle_maintenance_v2'
};

function getRelativeDateStr(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().split('T')[0];
}

const INITIAL_VEHICLES: Vehicle[] = [];
const INITIAL_DRIVERS: DriverLicenseRecord[] = [];
const INITIAL_FINES: TrafficFineRecord[] = [];
const INITIAL_DAMAGES: VehicleDamageReport[] = [];
const INITIAL_INSPECTIONS: VehicleInspectionReport[] = [];

export function sanitizeCompanyString(str?: string): string {
  if (!str) return 'Demirer Kablo / Enerji';
  let cleanStr = str.trim();
  for (let i = 0; i < 5; i++) {
    const match = cleanStr.match(/^(.+?)\1+$/);
    if (match && match[1]) {
      cleanStr = match[1].trim();
    } else {
      break;
    }
  }
  return cleanStr;
}

export function normalizeTeamName(teamStr?: string): string {
  if (!teamStr) return 'Team01';
  const clean = teamStr.trim();
  const match = clean.match(/tm(\d+)/i) || clean.match(/team\s*(\d+)/i);
  if (match && match[1]) {
    const num = match[1].padStart(2, '0');
    return `Team${num}`;
  }
  return clean;
}

export class VehicleService {
  private static instance: VehicleService;

  constructor() {
    this.syncFromFirestore();
    this.initRealtimeSync();
  }

  public static getInstance(): VehicleService {
    if (!VehicleService.instance) {
      VehicleService.instance = new VehicleService();
    }
    return VehicleService.instance;
  }

  private mergeRemoteWithLocal<T extends { id: string; updatedAt?: string }>(storageKey: string, remoteItems: T[], getLocalItems: () => T[]): T[] {
    const localItems = getLocalItems();
    const map = new Map<string, T>();

    localItems.forEach(item => {
      if (item && item.id) map.set(item.id, item);
    });

    remoteItems.forEach(item => {
      if (item && item.id) {
        const local = map.get(item.id);
        if (!local || !local.updatedAt || (item.updatedAt && new Date(item.updatedAt) >= new Date(local.updatedAt))) {
          map.set(item.id, item);
        }
      }
    });

    const merged = Array.from(map.values());
    localStorage.setItem(storageKey, JSON.stringify(merged));
    return merged;
  }

  private initRealtimeSync(): void {
    if (typeof window === 'undefined') return;

    // 1. Live Vehicles Listener
    try {
      onSnapshot(collection(db, 'vehicles'), (snap) => {
        if (!snap.empty) {
          const list: Vehicle[] = [];
          snap.forEach(d => {
            const v = { id: d.id, ...d.data() } as Vehicle;
            if (v.company) v.company = sanitizeCompanyString(v.company);
            list.push(v);
          });
          this.mergeRemoteWithLocal(STORAGE_KEYS.VEHICLES, list, () => {
            try {
              const stored = localStorage.getItem(STORAGE_KEYS.VEHICLES);
              return stored ? JSON.parse(stored) : [];
            } catch { return []; }
          });
          window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
        }
      }, err => console.warn('[VehicleService] Vehicles realtime sync:', err));
    } catch (e) {}

    // 2. Live Drivers Listener
    try {
      onSnapshot(collection(db, 'drivers'), (snap) => {
        if (!snap.empty) {
          const list: DriverLicenseRecord[] = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() } as DriverLicenseRecord));
          this.mergeRemoteWithLocal(STORAGE_KEYS.DRIVERS, list, () => {
            try {
              const stored = localStorage.getItem(STORAGE_KEYS.DRIVERS);
              return stored ? JSON.parse(stored) : [];
            } catch { return []; }
          });
          window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
        }
      }, err => console.warn('[VehicleService] Drivers realtime sync:', err));
    } catch (e) {}

    // 3. Live Fines Listener
    try {
      onSnapshot(collection(db, 'trafficFines'), (snap) => {
        if (!snap.empty) {
          const list: TrafficFineRecord[] = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() } as TrafficFineRecord));
          this.mergeRemoteWithLocal(STORAGE_KEYS.FINES, list, () => {
            try {
              const stored = localStorage.getItem(STORAGE_KEYS.FINES);
              return stored ? JSON.parse(stored) : [];
            } catch { return []; }
          });
          window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
        }
      }, err => console.warn('[VehicleService] Fines realtime sync:', err));
    } catch (e) {}

    // 4. Live Maintenance Listener
    try {
      onSnapshot(collection(db, 'vehicleMaintenance'), (snap) => {
        if (!snap.empty) {
          const list: VehicleMaintenanceRecord[] = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() } as VehicleMaintenanceRecord));
          this.mergeRemoteWithLocal(STORAGE_KEYS.MAINTENANCE, list, () => {
            try {
              const stored = localStorage.getItem(STORAGE_KEYS.MAINTENANCE);
              return stored ? JSON.parse(stored) : [];
            } catch { return []; }
          });
          window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
        }
      }, err => console.warn('[VehicleService] Maintenance realtime sync:', err));
    } catch (e) {}

    // 5. Live Damages Listener
    try {
      onSnapshot(collection(db, 'vehicleDamages'), (snap) => {
        if (!snap.empty) {
          const list: VehicleDamageReport[] = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() } as VehicleDamageReport));
          this.mergeRemoteWithLocal(STORAGE_KEYS.DAMAGES, list, () => {
            try {
              const stored = localStorage.getItem(STORAGE_KEYS.DAMAGES);
              return stored ? JSON.parse(stored) : [];
            } catch { return []; }
          });
          window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
        }
      }, err => console.warn('[VehicleService] Damages realtime sync:', err));
    } catch (e) {}

    // 6. Live Inspections Listener
    try {
      onSnapshot(collection(db, 'vehicleInspections'), (snap) => {
        if (!snap.empty) {
          const list: VehicleInspectionReport[] = [];
          snap.forEach(d => list.push({ id: d.id, ...d.data() } as VehicleInspectionReport));
          this.mergeRemoteWithLocal(STORAGE_KEYS.INSPECTIONS, list, () => {
            try {
              const stored = localStorage.getItem(STORAGE_KEYS.INSPECTIONS);
              return stored ? JSON.parse(stored) : [];
            } catch { return []; }
          });
          window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
        }
      }, err => console.warn('[VehicleService] Inspections realtime sync:', err));
    } catch (e) {}
  }

  async syncFromFirestore(): Promise<void> {
    try {
      // 1. Sync Vehicles
      const snapVeh = await getDocs(collection(db, 'vehicles'));
      if (!snapVeh.empty) {
        const remoteVehicles: Vehicle[] = [];
        snapVeh.forEach(docSnap => {
          const v = { id: docSnap.id, ...docSnap.data() } as Vehicle;
          if (v.company) v.company = sanitizeCompanyString(v.company);
          remoteVehicles.push(v);
        });
        if (remoteVehicles.length > 0) {
          const local = this.getVehicles();
          const mergedMap = new Map<string, Vehicle>();
          local.forEach(v => mergedMap.set(v.id, v));
          remoteVehicles.forEach(v => mergedMap.set(v.id, v));
          localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(Array.from(mergedMap.values())));
        }
      }

      // 2. Sync Damages
      const snapDmg = await getDocs(collection(db, 'vehicleDamages'));
      if (!snapDmg.empty) {
        const list: VehicleDamageReport[] = [];
        snapDmg.forEach(d => list.push({ id: d.id, ...d.data() } as VehicleDamageReport));
        if (list.length > 0) {
          const local = this.getDamageReports();
          const map = new Map<string, VehicleDamageReport>();
          local.forEach(item => map.set(item.id, item));
          list.forEach(item => map.set(item.id, item));
          localStorage.setItem(STORAGE_KEYS.DAMAGES, JSON.stringify(Array.from(map.values())));
        }
      }

      // 3. Sync Maintenance
      const snapMaint = await getDocs(collection(db, 'vehicleMaintenance'));
      if (!snapMaint.empty) {
        const list: VehicleMaintenanceRecord[] = [];
        snapMaint.forEach(d => list.push({ id: d.id, ...d.data() } as VehicleMaintenanceRecord));
        if (list.length > 0) {
          const local = this.getMaintenanceRecords();
          const map = new Map<string, VehicleMaintenanceRecord>();
          local.forEach(item => map.set(item.id, item));
          list.forEach(item => map.set(item.id, item));
          localStorage.setItem(STORAGE_KEYS.MAINTENANCE, JSON.stringify(Array.from(map.values())));
        }
      }

      // 4. Sync Fines
      const snapFines = await getDocs(collection(db, 'trafficFines'));
      if (!snapFines.empty) {
        const list: TrafficFineRecord[] = [];
        snapFines.forEach(d => list.push({ id: d.id, ...d.data() } as TrafficFineRecord));
        if (list.length > 0) {
          const local = this.getTrafficFines();
          const map = new Map<string, TrafficFineRecord>();
          local.forEach(item => map.set(item.id, item));
          list.forEach(item => map.set(item.id, item));
          localStorage.setItem(STORAGE_KEYS.FINES, JSON.stringify(Array.from(map.values())));
        }
      }

      // 5. Sync Drivers
      const snapDrivers = await getDocs(collection(db, 'drivers'));
      if (!snapDrivers.empty) {
        const list: DriverLicenseRecord[] = [];
        snapDrivers.forEach(d => list.push({ id: d.id, ...d.data() } as DriverLicenseRecord));
        if (list.length > 0) {
          const local = this.getDriverLicenses();
          const map = new Map<string, DriverLicenseRecord>();
          local.forEach(item => map.set(item.id, item));
          list.forEach(item => map.set(item.id, item));
          localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(Array.from(map.values())));
        }
      }

      // 6. Sync Inspections
      const snapInsp = await getDocs(collection(db, 'vehicleInspections'));
      if (!snapInsp.empty) {
        const list: VehicleInspectionReport[] = [];
        snapInsp.forEach(d => list.push({ id: d.id, ...d.data() } as VehicleInspectionReport));
        if (list.length > 0) {
          const local = this.getInspectionReports();
          const map = new Map<string, VehicleInspectionReport>();
          local.forEach(item => map.set(item.id, item));
          list.forEach(item => map.set(item.id, item));
          localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(Array.from(map.values())));
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
      }
    } catch (e) {
      console.warn('[VehicleService] Firestore sync warning:', e);
    }
  }

  clearAllData(): void {
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.FINES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.DAMAGES, JSON.stringify([]));
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify([]));
  }

  // --- VEHICLES ---
  getVehicles(): Vehicle[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.VEHICLES);
      if (stored !== null) {
        const parsed: Vehicle[] = JSON.parse(stored);
        let modified = false;
        parsed.forEach(v => {
          if (v.company) {
            const clean = sanitizeCompanyString(v.company);
            if (clean !== v.company) {
              v.company = clean;
              modified = true;
            }
          }
        });
        if (modified) {
          localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(parsed));
        }
        return parsed;
      }
    } catch (e) {}
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(INITIAL_VEHICLES));
    return INITIAL_VEHICLES;
  }

  saveVehicle(vehicle: Partial<Vehicle> & { plate: string }): Vehicle {
    const vehicles = this.getVehicles();
    const normalizedInputPlate = vehicle.plate.trim().replace(/\s+/g, '').toUpperCase();
    
    // If vehicle.id is explicitly provided, match ONLY by id (editing mode).
    // If adding a new vehicle (vehicle.id is undefined), match ONLY by normalized plate.
    const existingIndex = vehicle.id
      ? vehicles.findIndex(v => v.id === vehicle.id)
      : vehicles.findIndex(v => v.plate.trim().replace(/\s+/g, '').toUpperCase() === normalizedInputPlate);
    
    let updatedVehicle: Vehicle;
    const now = new Date().toISOString();

    const cleanCompany = sanitizeCompanyString(vehicle.company);

    if (existingIndex >= 0) {
      updatedVehicle = {
        ...vehicles[existingIndex],
        ...vehicle,
        plate: vehicle.plate.trim().toUpperCase(),
        company: cleanCompany,
        inspectionDueDate: vehicle.inspectionDueDate !== undefined ? vehicle.inspectionDueDate : (vehicles[existingIndex].inspectionDueDate || ''),
        updatedAt: now
      };
      vehicles[existingIndex] = updatedVehicle;
    } else {
      updatedVehicle = {
        id: vehicle.id || `veh-${Date.now()}`,
        plate: vehicle.plate.trim().toUpperCase(),
        brandModel: vehicle.brandModel || 'Araç',
        year: vehicle.year || new Date().getFullYear(),
        vin: vehicle.vin || '',
        company: cleanCompany,
        type: vehicle.type || 'PICKUP',
        siteId: vehicle.siteId || '2688',
        siteName: vehicle.siteName || 'Anemon İntepe',
        assignedTeamId: vehicle.assignedTeamId || 'dh-tm01',
        assignedTeamName: vehicle.assignedTeamName || 'Team01',
        assignedDriverId: vehicle.assignedDriverId || '',
        assignedDriverName: vehicle.assignedDriverName || '',
        currentKm: vehicle.currentKm || 0,
        inspectionDueDate: vehicle.inspectionDueDate || '',
        trafficInsuranceDueDate: vehicle.trafficInsuranceDueDate || getRelativeDateStr(365),
        kaskoDueDate: vehicle.kaskoDueDate || getRelativeDateStr(365),
        exhaustDueDate: vehicle.exhaustDueDate || getRelativeDateStr(365),
        lastMaintenanceKm: vehicle.lastMaintenanceKm || 0,
        nextMaintenanceKm: vehicle.nextMaintenanceKm || (vehicle.currentKm ? vehicle.currentKm + 15000 : 15000),
        fireExtinguisherDueDate: vehicle.fireExtinguisherDueDate || getRelativeDateStr(365),
        hasEmergencyKit: vehicle.hasEmergencyKit ?? true,
        hasSnowChains: vehicle.hasSnowChains ?? true,
        tireSeason: vehicle.tireSeason || 'SUMMER',
        tireStorageLocation: vehicle.tireStorageLocation || 'Ana Depo',
        status: vehicle.status || 'ACTIVE',
        notes: vehicle.notes || '',
        createdBy: vehicle.createdBy || '',
        createdAt: now,
        updatedAt: now
      };
      vehicles.unshift(updatedVehicle);
    }

    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    }
    setDoc(doc(db, 'vehicles', updatedVehicle.id), updatedVehicle).catch(err => {
      console.warn('[VehicleService] Firestore saveVehicle error:', err);
    });
    return updatedVehicle;
  }

  deleteVehicle(id: string): void {
    const vehicles = this.getVehicles().filter(v => v.id !== id);
    localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    }
    deleteDoc(doc(db, 'vehicles', id)).catch(err => {
      console.warn('[VehicleService] Firestore deleteVehicle error:', err);
    });
  }

  deleteDriverLicense(id: string): void {
    const drivers = this.getDriverLicenses().filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    deleteDoc(doc(db, 'drivers', id)).catch(err => console.warn('[VehicleService] Firestore deleteDriver error:', err));
  }

  deleteTrafficFine(id: string): void {
    const fines = this.getTrafficFines().filter(f => f.id !== id);
    localStorage.setItem(STORAGE_KEYS.FINES, JSON.stringify(fines));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    deleteDoc(doc(db, 'trafficFines', id)).catch(err => console.warn('[VehicleService] Firestore deleteFine error:', err));
  }

  deleteDamageReport(id: string): void {
    const damages = this.getDamageReports().filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DAMAGES, JSON.stringify(damages));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    deleteDoc(doc(db, 'vehicleDamages', id)).catch(err => console.warn('[VehicleService] Firestore deleteDamage error:', err));
  }

  // --- INSPECTION REPORTS (FOTOĞRAFLI PERİYODİK DENETİM) ---
  getInspectionReports(vehicleId?: string): VehicleInspectionReport[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.INSPECTIONS);
      if (stored !== null) {
        const list: VehicleInspectionReport[] = JSON.parse(stored);
        return vehicleId ? list.filter(i => i.vehicleId === vehicleId) : list;
      }
    } catch (e) {}
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(INITIAL_INSPECTIONS));
    return vehicleId ? INITIAL_INSPECTIONS.filter(i => i.vehicleId === vehicleId) : INITIAL_INSPECTIONS;
  }

  saveInspectionReport(report: Partial<VehicleInspectionReport> & { plate: string; inspectedBy: string }): VehicleInspectionReport {
    const reports = this.getInspectionReports();
    const now = new Date().toISOString();
    const newReport: VehicleInspectionReport = {
      id: report.id || `insp-${Date.now()}`,
      vehicleId: report.vehicleId || '',
      plate: report.plate.toUpperCase(),
      inspectionDate: report.inspectionDate || now.split('T')[0],
      inspectedBy: report.inspectedBy,
      team: report.team || 'Team01',
      km: report.km || 0,
      exteriorPhotoUrl: report.exteriorPhotoUrl || '',
      interiorPhotoUrl: report.interiorPhotoUrl || '',
      enginePhotoUrl: report.enginePhotoUrl || '',
      trunkPhotoUrl: report.trunkPhotoUrl || '',
      odometerPhotoUrl: report.odometerPhotoUrl || '',
      notes: report.notes || '',
      status: report.status || 'PASSED',
      createdAt: now
    };

    reports.unshift(newReport);
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(reports));

    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    setDoc(doc(db, 'vehicleInspections', newReport.id), newReport).catch(err => console.warn('[VehicleService] Firestore saveInspection error:', err));

    // Update vehicle current KM if higher
    if (report.vehicleId && report.km) {
      const vehicles = this.getVehicles();
      const vIdx = vehicles.findIndex(v => v.id === report.vehicleId || v.plate === report.plate);
      if (vIdx >= 0 && report.km > vehicles[vIdx].currentKm) {
        vehicles[vIdx].currentKm = report.km;
        localStorage.setItem(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
      }
    }

    return newReport;
  }

  deleteInspectionReport(id: string): void {
    const reports = this.getInspectionReports().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(reports));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    deleteDoc(doc(db, 'vehicleInspections', id)).catch(err => console.warn('[VehicleService] Firestore deleteInspection error:', err));
  }

  // --- MAINTENANCE & SERVICE RECORDS ---
  getMaintenanceRecords(vehicleId?: string): VehicleMaintenanceRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MAINTENANCE);
      if (stored !== null) {
        const list: VehicleMaintenanceRecord[] = JSON.parse(stored);
        return vehicleId ? list.filter(m => m.vehicleId === vehicleId) : list;
      }
    } catch (e) {}
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE, JSON.stringify([]));
    return [];
  }

  saveMaintenanceRecord(record: Partial<VehicleMaintenanceRecord> & { plate: string; serviceKm: number; costAmount: number }): VehicleMaintenanceRecord {
    const records = this.getMaintenanceRecords();
    const now = new Date().toISOString();
    const plateUpper = record.plate.trim().toUpperCase();

    const newRecord: VehicleMaintenanceRecord = {
      id: record.id || `maint-${Date.now()}`,
      vehicleId: record.vehicleId || '',
      plate: plateUpper,
      serviceType: record.serviceType || 'PERIODIC_MAINTENANCE',
      serviceTypeLabel: record.serviceTypeLabel || 'Periyodik Yağ/Filtre Bakımı',
      serviceDate: record.serviceDate || now.split('T')[0],
      serviceKm: record.serviceKm || 0,
      nextMaintenanceKm: record.nextMaintenanceKm || (record.serviceKm ? record.serviceKm + 15000 : 15000),
      serviceNameCompany: record.serviceNameCompany || 'Özel/Yetkili Servis',
      costAmount: record.costAmount || 0,
      invoiceNumber: record.invoiceNumber || '',
      receiptPhotoUrl: record.receiptPhotoUrl || '',
      descriptionNotes: record.descriptionNotes || 'Bakım ve kontroller yapıldı.',
      performedBy: record.performedBy || '',
      createdAt: now
    };

    records.unshift(newRecord);
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE, JSON.stringify(records));

    // Update vehicle's current KM, lastMaintenanceKm, and nextMaintenanceKm automatically!
    const vehicles = this.getVehicles();
    const vIdx = vehicles.findIndex(v => v.id === record.vehicleId || v.plate.trim().toUpperCase() === plateUpper);
    if (vIdx >= 0) {
      const v = vehicles[vIdx];
      v.lastMaintenanceKm = record.serviceKm;
      v.nextMaintenanceKm = record.serviceKm + 15000;
      if (record.serviceKm > v.currentKm) {
        v.currentKm = record.serviceKm;
      }
      v.updatedAt = now;
      this.saveVehicle(v);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    }

    return newRecord;
  }

  deleteMaintenanceRecord(id: string): void {
    const records = this.getMaintenanceRecords().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.MAINTENANCE, JSON.stringify(records));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    }
  }

  changeTireSeason(params: {
    vehicleId?: string;
    plate: string;
    newSeason: 'WINTER' | 'SUMMER';
    changeKm: number;
    changeDate?: string;
    storageLocation?: string;
    costAmount?: number;
    notes?: string;
    performedBy?: string;
  }): Vehicle | null {
    const vehicles = this.getVehicles();
    const plateUpper = params.plate.trim().toUpperCase();
    const vIdx = vehicles.findIndex(v => v.id === params.vehicleId || v.plate.trim().toUpperCase() === plateUpper);
    if (vIdx < 0) return null;

    const v = vehicles[vIdx];
    const now = new Date().toISOString();
    const dateStr = params.changeDate || now.split('T')[0];
    const seasonLabel = params.newSeason === 'WINTER' ? 'Kış Lastiği' : 'Yaz Lastiği';

    v.tireSeason = params.newSeason;
    v.lastTireChangeDate = dateStr;
    v.lastTireChangeKm = params.changeKm;
    v.lastTireChangeSeason = params.newSeason;
    if (params.storageLocation) {
      v.tireStorageLocation = params.storageLocation;
    }
    const noteText = params.notes || `${params.changeKm.toLocaleString('tr-TR')} KM'de ${seasonLabel} Takıldı.`;
    v.lastTireChangeNotes = noteText;
    if (params.changeKm > v.currentKm) {
      v.currentKm = params.changeKm;
    }
    v.updatedAt = now;

    this.saveVehicle(v);

    // Save as maintenance record for audit trail & cost tracking
    this.saveMaintenanceRecord({
      plate: plateUpper,
      vehicleId: v.id,
      serviceType: 'TIRE_CHANGE',
      serviceTypeLabel: `${seasonLabel} Değişimi & Balans`,
      serviceDate: dateStr,
      serviceKm: params.changeKm,
      serviceNameCompany: 'Lastik Servisi',
      costAmount: params.costAmount || 0,
      descriptionNotes: `${params.changeKm.toLocaleString('tr-TR')} KM'de ${seasonLabel} Takıldı. Saklanan Depo: ${params.storageLocation || 'Ana Depo'}. ${params.notes || ''}`.trim(),
      performedBy: params.performedBy || ''
    });

    return v;
  }

  // --- FINE & DRIVER ANALYTICS ---
  getFineAnalytics() {
    const fines = this.getTrafficFines();
    
    const driverMap: Record<string, { driverName: string; team: string; count: number; totalAmount: number }> = {};
    const plateMap: Record<string, { plate: string; count: number; totalAmount: number }> = {};
    let totalFineAmount = 0;

    fines.forEach(f => {
      totalFineAmount += f.amount;

      const dName = f.driverName || 'Bilinmeyen Sürücü';
      if (!driverMap[dName]) {
        driverMap[dName] = { driverName: dName, team: f.team || 'Team', count: 0, totalAmount: 0 };
      }
      driverMap[dName].count += 1;
      driverMap[dName].totalAmount += f.amount;

      const p = f.plate.toUpperCase();
      if (!plateMap[p]) {
        plateMap[p] = { plate: p, count: 0, totalAmount: 0 };
      }
      plateMap[p].count += 1;
      plateMap[p].totalAmount += f.amount;
    });

    const topFinedDrivers = Object.values(driverMap).sort((a, b) => b.totalAmount - a.totalAmount);
    const topFinedPlates = Object.values(plateMap).sort((a, b) => b.totalAmount - a.totalAmount);

    return {
      totalFineAmount,
      totalSavingsWithDiscount: totalFineAmount * 0.25,
      topFinedDrivers,
      topFinedPlates
    };
  }

  // --- DRIVERS & EHLİYET BEYANI ---
  getDriverLicenses(): DriverLicenseRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DRIVERS);
      if (stored !== null) return JSON.parse(stored);
    } catch (e) {}
    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(INITIAL_DRIVERS));
    return INITIAL_DRIVERS;
  }

  saveDriverLicense(driver: Partial<DriverLicenseRecord> & { personnelName: string }): DriverLicenseRecord {
    const drivers = this.getDriverLicenses();
    const idx = drivers.findIndex(d => d.id === driver.id || d.personnelId === driver.personnelId);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nextCheckDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let updated: DriverLicenseRecord;
    if (idx >= 0) {
      updated = {
        ...drivers[idx],
        ...driver,
        last3MonthCheckDate: driver.last3MonthCheckDate || todayStr,
        next3MonthCheckDate: driver.next3MonthCheckDate || nextCheckDate,
        updatedAt: now.toISOString()
      };
      drivers[idx] = updated;
    } else {
      updated = {
        id: driver.id || `drv-${Date.now()}`,
        personnelId: driver.personnelId || `p-${Date.now()}`,
        personnelName: driver.personnelName,
        team: driver.team || 'Team01',
        licenseNumber: driver.licenseNumber || 'TR-000000',
        licenseClass: driver.licenseClass || 'B',
        srcExpiryDate: driver.srcExpiryDate || getRelativeDateStr(365),
        psychotechnicExpiryDate: driver.psychotechnicExpiryDate || getRelativeDateStr(365),
        last3MonthCheckDate: todayStr,
        next3MonthCheckDate: nextCheckDate,
        isLicenseActive: driver.isLicenseActive ?? true,
        checkNotes: driver.checkNotes || 'Ehliyet beyanı onaylandı.',
        updatedAt: now.toISOString()
      };
      drivers.unshift(updated);
    }

    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    setDoc(doc(db, 'drivers', updated.id), updated).catch(err => console.warn('[VehicleService] saveDriver error:', err));
    return updated;
  }

  verifyDriver3MonthCheck(driverId: string, notes?: string, isLicenseActive: boolean = true): DriverLicenseRecord | null {
    const drivers = this.getDriverLicenses();
    const idx = drivers.findIndex(d => d.id === driverId || d.personnelId === driverId);
    if (idx < 0) return null;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const nextCheckDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    drivers[idx].last3MonthCheckDate = todayStr;
    drivers[idx].next3MonthCheckDate = nextCheckDate;
    drivers[idx].isLicenseActive = isLicenseActive;
    if (notes) drivers[idx].checkNotes = notes;
    drivers[idx].updatedAt = now.toISOString();

    localStorage.setItem(STORAGE_KEYS.DRIVERS, JSON.stringify(drivers));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    setDoc(doc(db, 'drivers', drivers[idx].id), drivers[idx]).catch(err => console.warn('[VehicleService] verifyDriver error:', err));
    return drivers[idx];
  }

  // --- TRAFFIC FINES ---
  getTrafficFines(): TrafficFineRecord[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.FINES);
      if (stored !== null) return JSON.parse(stored);
    } catch (e) {}
    localStorage.setItem(STORAGE_KEYS.FINES, JSON.stringify(INITIAL_FINES));
    return INITIAL_FINES;
  }

  saveTrafficFine(fine: Partial<TrafficFineRecord> & { plate: string; amount: number }): TrafficFineRecord {
    const fines = this.getTrafficFines();
    const fineDateStr = fine.fineDate || new Date().toISOString().split('T')[0];
    const fDate = new Date(fineDateStr);
    const discDate = new Date(fDate.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const newFine: TrafficFineRecord = {
      id: fine.id || `fine-${Date.now()}`,
      vehicleId: fine.vehicleId || '',
      plate: fine.plate.toUpperCase(),
      fineDate: fineDateStr,
      fineCode: fine.fineCode || 'Trafik Cezası İhlali',
      amount: Number(fine.amount),
      driverId: fine.driverId || '',
      driverName: fine.driverName || 'Saha Sürücüsü',
      team: fine.team || 'Team01',
      discountDeadline: fine.discountDeadline || discDate,
      status: fine.status || 'PENDING',
      notes: fine.notes || ''
    };

    const idx = fines.findIndex(f => f.id === fine.id);
    if (idx >= 0) fines[idx] = newFine;
    else fines.unshift(newFine);

    localStorage.setItem(STORAGE_KEYS.FINES, JSON.stringify(fines));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    setDoc(doc(db, 'trafficFines', newFine.id), newFine).catch(err => console.warn('[VehicleService] saveFine error:', err));
    return newFine;
  }

  payTrafficFine(id: string, paidBy: 'COMPANY' | 'PERSONNEL', paidAmount: number, paidByName?: string): TrafficFineRecord | null {
    const fines = this.getTrafficFines();
    const idx = fines.findIndex(f => f.id === id);
    if (idx < 0) return null;

    fines[idx].status = 'PAID';
    fines[idx].paidBy = paidBy;
    fines[idx].paidAmount = paidAmount;
    fines[idx].paymentDate = new Date().toISOString().split('T')[0];
    if (paidByName) fines[idx].paidByName = paidByName;

    localStorage.setItem(STORAGE_KEYS.FINES, JSON.stringify(fines));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    setDoc(doc(db, 'trafficFines', fines[idx].id), fines[idx]).catch(err => console.warn('[VehicleService] payFine error:', err));
    return fines[idx];
  }

  // --- DAMAGE REPORTS ---
  getDamageReports(): VehicleDamageReport[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.DAMAGES);
      if (stored !== null) {
        const parsed: VehicleDamageReport[] = JSON.parse(stored);

        // Deduplicate by ID (prevents duplicates from multiple sync sources)
        const seen = new Map<string, VehicleDamageReport>();
        parsed.forEach(d => { if (d.id) seen.set(d.id, d); });
        const list = Array.from(seen.values());

        if (list.length !== parsed.length) {
          localStorage.setItem(STORAGE_KEYS.DAMAGES, JSON.stringify(list));
        }

        const vehicles = this.getVehicles();
        list.forEach(d => {
          if (d.team) d.team = normalizeTeamName(d.team);
          if (!d.team || d.team === 'Team01') {
            const v = vehicles.find(x => x.plate.toUpperCase().trim() === d.plate.toUpperCase().trim());
            if (v && v.assignedTeamName) {
              d.team = normalizeTeamName(v.assignedTeamName);
            }
          }
        });
        return list;
      }
    } catch (e) {}
    localStorage.setItem(STORAGE_KEYS.DAMAGES, JSON.stringify([]));
    return [];
  }

  saveDamageReport(report: Partial<VehicleDamageReport> & { plate: string; description: string }): VehicleDamageReport {
    const damages = this.getDamageReports();
    const plateUpper = report.plate.toUpperCase().trim();
    const targetVeh = this.getVehicles().find(v => v.plate.toUpperCase().trim() === plateUpper);
    const rawTeam = targetVeh?.assignedTeamName || targetVeh?.assignedTeamId || report.team || 'Team03';
    const vehTeam = normalizeTeamName(rawTeam);

    const newReport: VehicleDamageReport = {
      id: report.id || `dmg-${Date.now()}`,
      vehicleId: report.vehicleId || (targetVeh ? targetVeh.id : ''),
      plate: plateUpper,
      reportDate: report.reportDate || new Date().toISOString().split('T')[0],
      reportedBy: report.reportedBy || 'Saha Personeli',
      team: vehTeam,
      damageType: report.damageType || 'OTHER',
      description: report.description,
      photoUrls: report.photoUrls || [],
      accidentReportPhotoUrl: report.accidentReportPhotoUrl || '',
      otherPartyPlate: report.otherPartyPlate || '',
      insuranceClaimNo: report.insuranceClaimNo || '',
      status: report.status || 'OPEN',
      resolvedNotes: report.resolvedNotes || ''
    };

    const idx = damages.findIndex(d => d.id === report.id);
    if (idx >= 0) damages[idx] = newReport;
    else damages.unshift(newReport);

    localStorage.setItem(STORAGE_KEYS.DAMAGES, JSON.stringify(damages));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    setDoc(doc(db, 'vehicleDamages', newReport.id), newReport).catch(err => console.warn('[VehicleService] saveDamage error:', err));
    return newReport;
  }

  resolveDamageReport(id: string, notes?: string): VehicleDamageReport | null {
    const damages = this.getDamageReports();
    const idx = damages.findIndex(d => d.id === id);
    if (idx < 0) return null;

    damages[idx].status = 'RESOLVED';
    if (notes) damages[idx].resolvedNotes = notes;
    localStorage.setItem(STORAGE_KEYS.DAMAGES, JSON.stringify(damages));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('dh_vehicle_data_changed'));
    setDoc(doc(db, 'vehicleDamages', damages[idx].id), damages[idx]).catch(err => console.warn('[VehicleService] resolveDamage error:', err));
    return damages[idx];
  }

  // --- ALERTS ENGINE ---
  getVehicleAlerts(): VehicleAlert[] {
    const alerts: VehicleAlert[] = [];
    const vehicles = this.getVehicles();
    const drivers = this.getDriverLicenses();
    const today = new Date();

    const calcDaysLeft = (targetStr?: string): number => {
      if (!targetStr) return 999;
      const target = new Date(targetStr);
      const diffMs = target.getTime() - today.getTime();
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    };

    vehicles.forEach(v => {
      if (!v.inspectionDueDate) {
        alerts.push({
          id: `alert-insp-missing-${v.id}`,
          type: 'INSPECTION',
          severity: 'WARNING',
          title: `Muayene Tarihi Eksik! (${v.plate})`,
          description: `${v.plate} plakalı aracın TÜVTÜRK muayene tarihi girilmemiş. Lütfen düzenleyip güncel tarihi giriniz.`,
          vehicleId: v.id,
          plate: v.plate,
          daysLeft: 0,
          targetDate: ''
        });
      } else {
        const inspDays = calcDaysLeft(v.inspectionDueDate);
        if (inspDays <= 0) {
          alerts.push({
            id: `alert-insp-${v.id}`,
            type: 'INSPECTION',
            severity: 'CRITICAL',
            title: `TÜVTÜRK MUAYENE SÜRESİ GEÇTİ! (${v.plate})`,
            description: `${v.plate} plakalı aracın muayenesi ${Math.abs(inspDays)} gün önce bitti! Araç trafiğe çıkmamalı.`,
            vehicleId: v.id,
            plate: v.plate,
            daysLeft: inspDays,
            targetDate: v.inspectionDueDate
          });
        } else if (inspDays <= 15) {
          alerts.push({
            id: `alert-insp-${v.id}`,
            type: 'INSPECTION',
            severity: 'CRITICAL',
            title: `Muayeneye Son ${inspDays} Gün! (${v.plate})`,
            description: `${v.plate} plakalı aracın TÜVTÜRK muayenesi ${v.inspectionDueDate} tarihinde bitiyor. Acil randevu alınmalı!`,
            vehicleId: v.id,
            plate: v.plate,
            daysLeft: inspDays,
            targetDate: v.inspectionDueDate
          });
        } else if (inspDays <= 30) {
          alerts.push({
            id: `alert-insp-${v.id}`,
            type: 'INSPECTION',
            severity: 'WARNING',
            title: `Muayene Yaklaşıyor (${v.plate})`,
            description: `${v.plate} plakalı aracın muayenesine ${inspDays} gün kaldı.`,
            vehicleId: v.id,
            plate: v.plate,
            daysLeft: inspDays,
            targetDate: v.inspectionDueDate
          });
        }
      }

      const insDays = calcDaysLeft(v.trafficInsuranceDueDate);
      if (insDays <= 15) {
        alerts.push({
          id: `alert-ins-${v.id}`,
          type: 'TRAFFIC_INSURANCE',
          severity: insDays <= 0 ? 'CRITICAL' : 'WARNING',
          title: `Trafik Sigortası Uyarısı (${v.plate})`,
          description: `${v.plate} plakalı aracın zorunlu trafik sigortasına ${insDays <= 0 ? 'günü geçti' : `${insDays} gün kaldı`}.`,
          vehicleId: v.id,
          plate: v.plate,
          daysLeft: insDays,
          targetDate: v.trafficInsuranceDueDate
        });
      }

      const currentMonth = today.getMonth() + 1;
      if ((currentMonth === 11 || currentMonth === 12) && v.tireSeason === 'SUMMER') {
        alerts.push({
          id: `alert-tire-${v.id}`,
          type: 'TIRE_SEASON',
          severity: 'WARNING',
          title: `Kış Lastiği Değişim Zamanı! (${v.plate})`,
          description: `${v.plate} aracında halen YAZ lastiği takılı! 1 Aralık zorunlu kış lastiği geçişini yapınız.`,
          vehicleId: v.id,
          plate: v.plate
        });
      } else if ((currentMonth === 4 || currentMonth === 5) && v.tireSeason === 'WINTER') {
        alerts.push({
          id: `alert-tire-${v.id}`,
          type: 'TIRE_SEASON',
          severity: 'INFO',
          title: `Yaz Lastiğine Geçiş Dönemi (${v.plate})`,
          description: `1 Nisan itibarıyla kış lastiği dönemi sona erdi. ${v.plate} aracını yazlık lastiklere geçirebilirsiniz.`,
          vehicleId: v.id,
          plate: v.plate
        });
      }
    });

    drivers.forEach(d => {
      const checkDays = calcDaysLeft(d.next3MonthCheckDate);
      if (checkDays <= 0) {
        alerts.push({
          id: `alert-drv-3m-${d.id}`,
          type: 'DRIVER_CHECK_3M',
          severity: 'CRITICAL',
          title: `3 Aylık Ehliyet Kontrol Beyanı Gecikti! (${d.personnelName})`,
          description: `${d.personnelName} (${d.team}) için 3 aylık ehliyet ceza/aktiflik beyanı ${Math.abs(checkDays)} gün gecikti. Lütfen kontrol edip onaylayınız!`,
          driverId: d.id,
          driverName: d.personnelName,
          daysLeft: checkDays,
          targetDate: d.next3MonthCheckDate
        });
      } else if (checkDays <= 10) {
        alerts.push({
          id: `alert-drv-3m-${d.id}`,
          type: 'DRIVER_CHECK_3M',
          severity: 'WARNING',
          title: `3 Aylık Ehliyet Beyan Zamanı (${d.personnelName})`,
          description: `${d.personnelName} için ehliyet onayına ${checkDays} gün kaldı.`,
          driverId: d.id,
          driverName: d.personnelName,
          daysLeft: checkDays,
          targetDate: d.next3MonthCheckDate
        });
      }
    });

    return alerts;
  }
}

export const vehicleService = new VehicleService();
