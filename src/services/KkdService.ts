import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp, 
  onSnapshot, 
  writeBatch, 
  where, 
  updateDoc 
} from 'firebase/firestore';

export interface KkdItem {
  id: string;
  name: string; // e.g. "Emniyet Kemeri", "Lanyard", "Runner", "Kurtarma Kiti", "Diğer"
  brandModel: string; // e.g. "SKYLOTEC IGNITE PROTON"
  serialNumber: string; // e.g. "69849-043"
  assignedPerson: string; // e.g. "Ahmet Yılmaz" or "Saha-1"
  manufactureDate: string; // YYYY-MM-DD or YYYY-MM
  firstUseDate: string; // YYYY-MM-DD
  lastInspectionDate: string; // YYYY-MM-DD
  nextInspectionDate: string; // YYYY-MM-DD
  status: 'OK' | 'REJECT' | 'RETIRED' | 'PENDING'; // OK: Uygun, REJECT: Red, RETIRED: Hurda/Emekli, PENDING: Bekliyor
  lifespanYears?: number; // default 10 years
  notes?: string;
  bypassLock?: boolean; // bypass the periodic lock
  order?: number; // custom sort order
  createdAt?: any;
  updatedAt?: any;
}

export interface KkdInspection {
  id: string;
  itemId: string;
  itemName: string;
  itemSerialNumber: string;
  inspector: string; // name or email of the admin doing inspection
  inspectionDate: string; // YYYY-MM-DD
  status: 'OK' | 'REJECT' | 'RETIRED';
  notes: string;
  // checklist values
  checklist?: {
    webbingCheck?: boolean; // Dokuma kolon/halat kontrolü
    stitchingCheck?: boolean; // Dikiş kontrolü
    metalCheck?: boolean; // Metal aksam korozyon/deformasyon
    bucklesCheck?: boolean; // Tokalar/kilit mekanizması
    labelCheck?: boolean; // Etiket okunabilirliği
    shockAbsorberCheck?: boolean; // Şok emici kontrolü (lanyard için)
    sealCheck?: boolean; // Çanta/mühür kontrolü (kurtarma kiti için)
  };
  images?: string[];
  createdAt?: any;
}

class KkdService {
  private inventoryCol = collection(db, 'kkd_inventory');
  private inspectionsCol = collection(db, 'kkd_inspections');

  // Fetch all KKD items
  async getInventory(): Promise<KkdItem[]> {
    const q = query(this.inventoryCol);
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KkdItem));
    // Sort in memory by assignedPerson (Turkish locale), then by order
    items.sort((a, b) => {
      const nameA = (a.assignedPerson || '').trim();
      const nameB = (b.assignedPerson || '').trim();
      
      if (nameA === '' && nameB !== '') return 1;
      if (nameB === '' && nameA !== '') return -1;
      
      const nameCompare = nameA.localeCompare(nameB, 'tr', { sensitivity: 'base' });
      if (nameCompare !== 0) return nameCompare;
      
      const orderA = a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
      const orderB = b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
      return orderA - orderB;
    });
    return items;
  }

  // Subscribe to real-time KKD inventory updates
  subscribeInventory(callback: (items: KkdItem[]) => void): () => void {
    const q = query(this.inventoryCol);
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KkdItem));
      // Sort in memory by assignedPerson (Turkish locale), then by order
      items.sort((a, b) => {
        const nameA = (a.assignedPerson || '').trim();
        const nameB = (b.assignedPerson || '').trim();
        
        if (nameA === '' && nameB !== '') return 1;
        if (nameB === '' && nameA !== '') return -1;
        
        const nameCompare = nameA.localeCompare(nameB, 'tr', { sensitivity: 'base' });
        if (nameCompare !== 0) return nameCompare;
        
        const orderA = a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
        const orderB = b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
        return orderA - orderB;
      });
      callback(items);
    });
  }

  // Add new KKD item
  async addKkdItem(item: Omit<KkdItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(this.inventoryCol, {
      ...item,
      lifespanYears: item.lifespanYears || 10, // Default 10 years lifespan
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  }

  // Update existing KKD item
  async updateKkdItem(id: string, data: Partial<Omit<KkdItem, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const docRef = doc(db, 'kkd_inventory', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }

  // Update order of a KKD item
  async updateKkdItemOrder(id: string, order: number): Promise<void> {
    const docRef = doc(db, 'kkd_inventory', id);
    await updateDoc(docRef, {
      order,
      updatedAt: serverTimestamp()
    });
  }

  // Delete KKD item
  async deleteKkdItem(id: string): Promise<void> {
    await deleteDoc(doc(db, 'kkd_inventory', id));
  }

  // Log a new periodic inspection and update item status in a transaction/batch
  async performInspection(
    itemId: string,
    inspection: Omit<KkdInspection, 'id' | 'itemId' | 'createdAt'>,
    nextInspectionDate: string
  ): Promise<void> {
    const batch = writeBatch(db);

    // 1. Create inspection log
    const inspectionRef = doc(collection(db, 'kkd_inspections'));
    batch.set(inspectionRef, {
      ...inspection,
      itemId,
      createdAt: serverTimestamp()
    });

    // 2. Update equipment item in inventory
    const itemRef = doc(db, 'kkd_inventory', itemId);
    batch.update(itemRef, {
      status: inspection.status,
      lastInspectionDate: inspection.inspectionDate,
      nextInspectionDate: nextInspectionDate,
      bypassLock: false, // Reset lock bypass on new inspection
      updatedAt: serverTimestamp()
    });

    // Commit batch transaction
    await batch.commit();
  }

  // Fetch inspection history for a specific item
  async getInspectionHistory(itemId: string): Promise<KkdInspection[]> {
    const q = query(
      this.inspectionsCol, 
      where('itemId', '==', itemId)
    );
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as KkdInspection));
    // Sort in memory descending by inspectionDate
    logs.sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate));
    return logs;
  }

  // Fetch a single inspection by its ID
  async getInspection(id: string): Promise<KkdInspection | null> {
    const docRef = doc(db, 'kkd_inspections', id);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as KkdInspection;
    }
    return null;
  }
}

export const kkdService = new KkdService();
