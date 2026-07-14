import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  addDoc, 
  deleteDoc, 
  query, 
  serverTimestamp, 
  onSnapshot, 
  writeBatch, 
  where, 
  updateDoc 
} from 'firebase/firestore';

export interface CalibrationDevice {
  id: string;
  type: 'OLCU' | 'TORK';           // Device type: Ölçü Aleti or Tork Aleti
  brandModel: string;              // Marka / Model
  serialNumber: string;            // Seri Numarası
  assignedPerson: string;          // Cihaz Kime Ait / Zimmetli Kişi
  siteId: string;                  // Bulunduğu Saha ID (e.g. Alize, Anemon...)
  siteName: string;                // Bulunduğu Saha Adı
  calibrationCompany: string;      // Kalibrasyon Gönderilen Firma
  calibrationDate: string;         // Kalibrasyon Tarihi (YYYY-MM-DD)
  nextCalibrationDate: string;     // Gelecek Kalibrasyon Tarihi (Exactly 1 year later)
  status: 'OK' | 'REJECT';         // Kalibrasyon Uygun (OK) / Uygun Değil (REJECT)
  notes?: string;                  // Notlar
  certificateUrl?: string;         // PDF Rapor (Base64 string)
  certificateName?: string;        // Yüklenen dosya adı
  deviceImage?: string;            // Cihaz Görseli (Base64 JPEG)
  createdAt?: any;
  updatedAt?: any;
}

export interface CalibrationHistoryLog {
  id: string;
  deviceId: string;
  deviceSerialNumber: string;
  calibrator: string;              // Kalibrasyonu yapan/onaylayan sistem kullanıcısı
  calibrationCompany: string;      // Kalibrasyon Gönderilen Firma
  calibrationDate: string;         // Kalibrasyon Tarihi
  nextCalibrationDate: string;     // Gelecek Kalibrasyon Tarihi
  status: 'OK' | 'REJECT';
  notes: string;
  certificateUrl?: string;
  certificateName?: string;
  createdAt?: any;
}

class DeviceCalibrationService {
  private devicesCol = collection(db, 'calibrated_devices');
  private historyCol = collection(db, 'device_calibrations_history');

  // Fetch all devices of a certain type (OLCU or TORK)
  async getDevices(type: 'OLCU' | 'TORK'): Promise<CalibrationDevice[]> {
    const q = query(this.devicesCol, where('type', '==', type));
    const snapshot = await getDocs(q);
    const devices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalibrationDevice));
    
    // Sort in memory by assignedPerson (Turkish locale), then by brandModel
    devices.sort((a, b) => {
      const personA = (a.assignedPerson || '').trim();
      const personB = (b.assignedPerson || '').trim();
      
      if (personA === '' && personB !== '') return 1;
      if (personB === '' && personA !== '') return -1;
      
      const personCompare = personA.localeCompare(personB, 'tr', { sensitivity: 'base' });
      if (personCompare !== 0) return personCompare;
      
      return (a.brandModel || '').localeCompare(b.brandModel || '', 'tr');
    });
    return devices;
  }

  // Subscribe to real-time updates for devices of a certain type
  subscribeDevices(type: 'OLCU' | 'TORK', callback: (devices: CalibrationDevice[]) => void): () => void {
    const q = query(this.devicesCol, where('type', '==', type));
    return onSnapshot(q, (snapshot) => {
      const devices = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalibrationDevice));
      devices.sort((a, b) => {
        const personA = (a.assignedPerson || '').trim();
        const personB = (b.assignedPerson || '').trim();
        
        if (personA === '' && personB !== '') return 1;
        if (personB === '' && personA !== '') return -1;
        
        const personCompare = personA.localeCompare(personB, 'tr', { sensitivity: 'base' });
        if (personCompare !== 0) return personCompare;
        
        return (a.brandModel || '').localeCompare(b.brandModel || '', 'tr');
      });
      callback(devices);
    });
  }

  // Add a new device
  async addDevice(device: Omit<CalibrationDevice, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(this.devicesCol, {
      ...device,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  }

  // Update device details
  async updateDevice(id: string, data: Partial<Omit<CalibrationDevice, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const docRef = doc(db, 'calibrated_devices', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  // Delete a device
  async deleteDevice(id: string): Promise<void> {
    await deleteDoc(doc(db, 'calibrated_devices', id));
  }

  // Perform a new calibration (updates device status and adds a history log in a batch)
  async performCalibration(
    deviceId: string,
    log: Omit<CalibrationHistoryLog, 'id' | 'deviceId' | 'createdAt'>,
    nextCalibrationDate: string
  ): Promise<void> {
    const batch = writeBatch(db);

    // 1. Create history log doc
    const historyRef = doc(collection(db, 'device_calibrations_history'));
    batch.set(historyRef, {
      ...log,
      deviceId,
      createdAt: serverTimestamp()
    });

    // 2. Update device doc
    const deviceRef = doc(db, 'calibrated_devices', deviceId);
    batch.update(deviceRef, {
      status: log.status,
      calibrationCompany: log.calibrationCompany,
      calibrationDate: log.calibrationDate,
      nextCalibrationDate: nextCalibrationDate,
      certificateUrl: log.certificateUrl || '',
      certificateName: log.certificateName || '',
      updatedAt: serverTimestamp()
    });

    await batch.commit();
  }

  // Fetch calibration history logs for a specific device
  async getCalibrationHistory(deviceId: string): Promise<CalibrationHistoryLog[]> {
    const q = query(this.historyCol, where('deviceId', '==', deviceId));
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalibrationHistoryLog));
    logs.sort((a, b) => b.calibrationDate.localeCompare(a.calibrationDate));
    return logs;
  }
}

export const deviceCalibrationService = new DeviceCalibrationService();
