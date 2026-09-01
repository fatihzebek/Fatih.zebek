import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  where, 
  serverTimestamp,
  arrayUnion
} from 'firebase/firestore';

export interface WorkshopComponent {
  id?: string;
  code: string;
  name: string;
  category: string;
  value: string;
  package: string;
  quantity: number;
  minStock: number;
  shelfLocation: string;
  unitPrice?: number;
  notes?: string;
  createdAt?: any;
  lastUpdated?: any;
  lastUpdatedBy?: string;
}

export interface WorkshopComponentLog {
  id?: string;
  componentId: string;
  componentCode: string;
  componentName: string;
  type: 'IN' | 'OUT' | 'ADJUST';
  quantity: number;
  previousQuantity: number;
  newQuantity: number;
  repairId?: string;
  cardSapNo?: string;
  cardSerialNo?: string;
  cardDescription?: string;
  turbineNo?: string;
  siteName?: string;
  user: string;
  date: any;
  note?: string;
}

export const COMPONENT_CATEGORIES = [
  'KONDANSATÖR',
  'DİRENÇ',
  'TRANSİSTÖR / IGBT',
  'DİYOT / KÖPRÜ',
  'ENTEGRE (IC)',
  'RÖLE / SİGORTA',
  'TRAFO / İNDÜKTÖR',
  'OPTOKUPLÖR',
  'KONNEKTÖR / KABLO',
  'DİĞER'
] as const;

class WorkshopComponentService {
  private cachedComponents: WorkshopComponent[] | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds

  async getComponents(forceRefresh = false): Promise<WorkshopComponent[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedComponents && (now - this.lastFetchTime < this.CACHE_TTL)) {
      return this.cachedComponents;
    }

    try {
      const colRef = collection(db, 'workshopComponents');
      const q = query(colRef, orderBy('name', 'asc'));
      const snap = await getDocs(q);
      const items: WorkshopComponent[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as WorkshopComponent));

      this.cachedComponents = items;
      this.lastFetchTime = now;
      return items;
    } catch (err) {
      console.error("Error fetching workshop components:", err);
      return this.cachedComponents || [];
    }
  }

  async getComponentById(id: string): Promise<WorkshopComponent | null> {
    try {
      const docRef = doc(db, 'workshopComponents', id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as WorkshopComponent;
      }
      return null;
    } catch (err) {
      console.error("Error getting component by id:", err);
      return null;
    }
  }

  async addComponent(comp: Omit<WorkshopComponent, 'id'>, user: string): Promise<string> {
    const colRef = collection(db, 'workshopComponents');
    const docData = {
      code: comp.code.trim().toUpperCase(),
      name: comp.name.trim(),
      category: comp.category || 'DİĞER',
      value: comp.value?.trim() || '-',
      package: comp.package?.trim() || '-',
      quantity: Number(comp.quantity) || 0,
      minStock: Number(comp.minStock) || 0,
      shelfLocation: comp.shelfLocation?.trim() || 'Atölye Çekmecesi',
      unitPrice: Number(comp.unitPrice) || 0,
      notes: comp.notes?.trim() || '',
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp(),
      lastUpdatedBy: user
    };

    const docRef = await addDoc(colRef, docData);
    
    // Log initial stock creation if quantity > 0
    if (docData.quantity > 0) {
      await addDoc(collection(db, 'workshopComponentLogs'), {
        componentId: docRef.id,
        componentCode: docData.code,
        componentName: docData.name,
        type: 'IN',
        quantity: docData.quantity,
        previousQuantity: 0,
        newQuantity: docData.quantity,
        user,
        date: serverTimestamp(),
        note: 'İlk stok girişi (Parça tanımlama)'
      });
    }

    this.cachedComponents = null;
    return docRef.id;
  }

  async updateComponent(id: string, updates: Partial<WorkshopComponent>, user: string): Promise<void> {
    const docRef = doc(db, 'workshopComponents', id);
    const updateData: any = {
      ...updates,
      lastUpdated: serverTimestamp(),
      lastUpdatedBy: user
    };
    if (updates.code) updateData.code = updates.code.trim().toUpperCase();
    if (updates.quantity !== undefined) updateData.quantity = Number(updates.quantity);
    if (updates.minStock !== undefined) updateData.minStock = Number(updates.minStock);
    if (updates.unitPrice !== undefined) updateData.unitPrice = Number(updates.unitPrice);

    await updateDoc(docRef, updateData);
    this.cachedComponents = null;
  }

  async deleteComponent(id: string): Promise<void> {
    const docRef = doc(db, 'workshopComponents', id);
    await deleteDoc(docRef);
    this.cachedComponents = null;
  }

  async addStock(componentId: string, qtyToAdd: number, user: string, note?: string): Promise<void> {
    if (qtyToAdd <= 0) return;
    const comp = await this.getComponentById(componentId);
    if (!comp) throw new Error("Komponent bulunamadı.");

    const prevQty = Number(comp.quantity || 0);
    const newQty = prevQty + qtyToAdd;

    await this.updateComponent(componentId, { quantity: newQty }, user);

    await addDoc(collection(db, 'workshopComponentLogs'), {
      componentId,
      componentCode: comp.code,
      componentName: comp.name,
      type: 'IN',
      quantity: qtyToAdd,
      previousQuantity: prevQty,
      newQuantity: newQty,
      user,
      date: serverTimestamp(),
      note: note || 'Stok girişi (+)'
    });
  }

  async getComponentLogs(componentId?: string, limitCount = 100): Promise<WorkshopComponentLog[]> {
    try {
      const colRef = collection(db, 'workshopComponentLogs');
      let q;
      if (componentId) {
        q = query(colRef, where('componentId', '==', componentId), orderBy('date', 'desc'), limit(limitCount));
      } else {
        q = query(colRef, orderBy('date', 'desc'), limit(limitCount));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkshopComponentLog));
    } catch (err) {
      console.error("Error fetching component logs:", err);
      return [];
    }
  }

  /**
   * Consume components for a specific card repair record.
   * Verifies the repair record exists and is in workshop, deducts stock, records logs, and updates card notes.
   */
  async useComponentsForRepair(
    repairId: string,
    items: Array<{ componentId: string; quantity: number }>,
    user: string,
    customNote?: string
  ): Promise<{ success: boolean; message: string; usedSummary: string }> {
    if (!repairId) {
      throw new Error("Lütfen onarım kartını belirtin.");
    }
    if (!items || items.length === 0) {
      throw new Error("Lütfen kullanılacak en az bir komponent seçin.");
    }

    // 1. Fetch & Verify Repair Card
    const repDocRef = doc(db, 'repairs', repairId);
    const repSnap = await getDoc(repDocRef);
    if (!repSnap.exists()) {
      throw new Error("Kart atölye kayıtlarında bulunamadı. Lütfen geçerli bir atölye kartı seçin.");
    }
    const cardData = repSnap.data();

    // 2. Fetch components & verify stock availability
    const componentDetails: Array<{ comp: WorkshopComponent; useQty: number }> = [];
    for (const item of items) {
      const comp = await this.getComponentById(item.componentId);
      if (!comp) {
        throw new Error("Komponent ID " + item.componentId + " bulunamadı.");
      }
      const available = Number(comp.quantity || 0);
      if (item.quantity <= 0) {
        throw new Error('"' + comp.name + '" için geçerli bir miktar girin.');
      }
      if (item.quantity > available) {
        throw new Error('"' + comp.name + '" için yetersiz stok! Mevcut: ' + available + ' Adet, İstenen: ' + item.quantity + ' Adet.');
      }
      componentDetails.push({ comp, useQty: item.quantity });
    }

    const consumedRecords: Array<{
      componentId: string;
      code: string;
      name: string;
      value: string;
      quantity: number;
      date: any;
      user: string;
    }> = [];

    const summaryParts: string[] = [];

    // 3. Deduct stock & create logs
    for (const { comp, useQty } of componentDetails) {
      const prevQty = Number(comp.quantity || 0);
      const newQty = prevQty - useQty;

      await this.updateComponent(comp.id!, { quantity: newQty }, user);

      await addDoc(collection(db, 'workshopComponentLogs'), {
        componentId: comp.id!,
        componentCode: comp.code,
        componentName: comp.name,
        type: 'OUT',
        quantity: useQty,
        previousQuantity: prevQty,
        newQuantity: newQty,
        repairId,
        cardSapNo: cardData.sapNo || '-',
        cardSerialNo: cardData.serialNo || '-',
        cardDescription: cardData.description || '-',
        turbineNo: cardData.turbineNo || '-',
        siteName: cardData.sourceWarehouseId || '-',
        user,
        date: serverTimestamp(),
        note: "Kart Onarımı: " + cardData.description + " (SAP: " + cardData.sapNo + ", Seri: " + (cardData.serialNo || '-') + ")"
      });

      consumedRecords.push({
        componentId: comp.id!,
        code: comp.code,
        name: comp.name,
        value: comp.value,
        quantity: useQty,
        date: new Date(),
        user
      });

      summaryParts.push(useQty + "x " + comp.name + " (" + comp.code + ")");
    }

    const usedSummary = summaryParts.join(', ');

    // 4. Update Repair Record in Firestore
    const currentNotes = cardData.repairNotes || '';
    const componentNoteLine = "Onarımda Değişen Parçalar: " + usedSummary + (customNote ? " (" + customNote + ")" : "");
    const updatedNotes = currentNotes 
      ? currentNotes + "\n[" + new Date().toLocaleDateString('tr-TR') + "] " + componentNoteLine
      : "[" + new Date().toLocaleDateString('tr-TR') + "] " + componentNoteLine;

    const newNoteLog = {
      date: new Date(),
      user,
      stage: 'KOMPONENT_DEĞİŞİMİ',
      text: componentNoteLine
    };

    await updateDoc(repDocRef, {
      repairNotes: updatedNotes,
      usedComponents: arrayUnion(...consumedRecords),
      noteLogs: arrayUnion(newNoteLog),
      lastUpdated: serverTimestamp()
    });

    this.cachedComponents = null;

    return {
      success: true,
      message: "Başarıyla " + consumedRecords.length + " kalem komponent stoktan düşüldü ve karta işlendi.",
      usedSummary
    };
  }
}

export const workshopComponentService = new WorkshopComponentService();
