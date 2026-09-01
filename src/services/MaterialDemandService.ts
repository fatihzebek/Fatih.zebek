import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  onSnapshot
} from 'firebase/firestore';
import { warehouseService } from './WarehouseService';
import { dataService } from './DataService';

function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item));
  }
  if (typeof obj === 'object') {
    if (obj instanceof Date || (obj && typeof obj === 'object' && '_methodName' in obj)) {
      return obj;
    }
    const clean: Record<string, any> = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean;
  }
  return obj;
}

export interface CrossWarehouseStockSummary {
  siteQty: number;
  siteShelf: string;
  centralQty: number;
  centralShelf: string;
  otherSites: Array<{ siteId: string; siteName: string; qty: number; shelf: string }>;
}

export interface MaterialDemandItem {
  id?: string;
  sapNo?: string;
  description: string;
  enerconRef?: string;
  quantity: number;          // Talep edilen miktar
  approvedQuantity?: number;  // Yönetici onaylı satınalma miktarı
  deliveredQuantity?: number; // Sahaya teslim alınan miktar (parçalı takip)
  unit?: string;
  reason?: string;            // Personel talep gerekçesi
  itemDecision?: 'APPROVE_PURCHASE' | 'TRANSFER' | 'USE_LOCAL_STOCK' | 'REJECT'; // Kalem kararı
  managerItemNote?: string;   // Kalem bazlı yönetici talimatı / notu
  siteStockAtReview?: number;
  centralStockAtReview?: number;
  otherSitesStock?: string;
}

export type MaterialDemandStatus = 
  | 'PENDING_REVIEW'      // 🟡 Saha Sorumlusu / Yönetici Ön Kontrolü Bekliyor
  | 'REJECTED'            // 🔴 Ön Kontrolde Reddedildi (Gerekçeli)
  | 'APPROVED_FOR_ORDER'  // 🔵 Ön Kontrolden Geçti / Malzeme Yönetimi Sipariş Havuzunda
  | 'ORDERED'             // 🟢 Malzeme Yönetimi Tarafından Resmi Sipariş Açıldı
  | 'DELIVERED';          // 📦 Sahaya Geldi / Depoya Teslim Alındı

export interface MaterialDemand {
  id: string;
  demandNo: string;       // Örn: TLP-2678-001
  title: string;          // Örn: TLP-2678-001_2026-08-26
  demandCategory: 'TURBINE' | 'CONSUMABLE'; // ⚡ Türbin Malzemesi (SAP'lı) | 🏢 Genel Sarf & Piyasa
  siteId: string;
  siteName: string;
  turbineId?: string;     // Örn: T-14, T-02 veya GENEL
  urgency: 'ACIL_ARIZA' | 'PERIYODIK_BAKIM' | 'NORMAL';
  generalNote?: string;
  items: MaterialDemandItem[];
  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterTeam?: string;
  status: MaterialDemandStatus;
  
  // Review info (Ön Kontrol / Siz)
  reviewedBy?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  reviewNote?: string;
  
  // Order linkage (Malzeme Yönetimi Resmi Sipariş Bağlantısı)
  orderId?: string;
  orderNo?: string;       // Örn: ER02026000000500
  orderDate?: string;     // Örn: 2026-08-26
  
  createdAt: string;
  updatedAt?: string;
}

class MaterialDemandService {
  private collectionName = 'material_demands';

  // Realtime subscription
  subscribeDemands(callback: (demands: MaterialDemand[]) => void, onError?: (err: any) => void) {
    const q = query(collection(db, this.collectionName), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const list: MaterialDemand[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        let createdAtStr = new Date().toISOString();
        if (d.createdAt && typeof d.createdAt.toDate === 'function') {
          createdAtStr = d.createdAt.toDate().toISOString();
        } else if (typeof d.createdAt === 'string') {
          createdAtStr = d.createdAt;
        }

        list.push({
          id: docSnap.id,
          demandNo: d.demandNo || `TLP-${docSnap.id.substring(0, 5).toUpperCase()}`,
          title: d.title || `${d.demandNo || 'TLP'}_${createdAtStr.split('T')[0]}`,
          demandCategory: d.demandCategory || (d.items && d.items.some((i: any) => i.sapNo) ? 'TURBINE' : 'CONSUMABLE'),
          siteId: d.siteId || '',
          siteName: d.siteName || 'Genel',
          turbineId: d.turbineId || '',
          urgency: d.urgency || 'NORMAL',
          generalNote: d.generalNote || '',
          items: d.items || [],
          requesterId: d.requesterId || '',
          requesterName: d.requesterName || 'Saha Personeli',
          requesterEmail: d.requesterEmail || '',
          requesterTeam: d.requesterTeam || '',
          status: d.status || 'PENDING_REVIEW',
          reviewedBy: d.reviewedBy,
          reviewedByName: d.reviewedByName,
          reviewedAt: d.reviewedAt,
          reviewNote: d.reviewNote,
          orderId: d.orderId,
          orderNo: d.orderNo,
          orderDate: d.orderDate,
          createdAt: createdAtStr,
          updatedAt: d.updatedAt
        });
      });
      callback(list);
    }, (err) => {
      console.error("subscribeDemands error:", err);
      if (onError) onError(err);
    });
  }

  // Get all demands
  async getDemands(): Promise<MaterialDemand[]> {
    try {
      const q = query(collection(db, this.collectionName), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const list: MaterialDemand[] = [];
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        let createdAtStr = new Date().toISOString();
        if (d.createdAt && typeof d.createdAt.toDate === 'function') {
          createdAtStr = d.createdAt.toDate().toISOString();
        } else if (typeof d.createdAt === 'string') {
          createdAtStr = d.createdAt;
        }
        list.push({
          id: docSnap.id,
          demandNo: d.demandNo || `TLP-${docSnap.id.substring(0, 5).toUpperCase()}`,
          title: d.title || `${d.demandNo || 'TLP'}_${createdAtStr.split('T')[0]}`,
          demandCategory: d.demandCategory || (d.items && d.items.some((i: any) => i.sapNo) ? 'TURBINE' : 'CONSUMABLE'),
          siteId: d.siteId || '',
          siteName: d.siteName || 'Genel',
          turbineId: d.turbineId || '',
          urgency: d.urgency || 'NORMAL',
          generalNote: d.generalNote || '',
          items: d.items || [],
          requesterId: d.requesterId || '',
          requesterName: d.requesterName || 'Saha Personeli',
          requesterEmail: d.requesterEmail || '',
          requesterTeam: d.requesterTeam || '',
          status: d.status || 'PENDING_REVIEW',
          reviewedBy: d.reviewedBy,
          reviewedByName: d.reviewedByName,
          reviewedAt: d.reviewedAt,
          reviewNote: d.reviewNote,
          orderId: d.orderId,
          orderNo: d.orderNo,
          orderDate: d.orderDate,
          createdAt: createdAtStr,
          updatedAt: d.updatedAt
        });
      });
      return list;
    } catch (err) {
      console.error("getDemands error:", err);
      return [];
    }
  }

  // Generate Demand Number: e.g. TLP-2678-001
  private async generateDemandNumber(siteId: string): Promise<string> {
    try {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      const dateKey = `${yyyy}${mm}${dd}`;
      const prefix = siteId ? siteId.replace(/[^0-9A-Za-z]/g, '').substring(0, 4) : 'SAHA';
      
      const q = query(collection(db, this.collectionName));
      const snap = await getDocs(q);
      const siteDemands = snap.docs.filter(d => (d.data().siteId === siteId));
      const nextSeq = String(siteDemands.length + 1).padStart(3, '0');
      
      return `TLP-${prefix}-${dateKey.substring(2)}-${nextSeq}`;
    } catch (e) {
      return `TLP-${Date.now().toString().slice(-6)}`;
    }
  }

  // Create a new material demand from field
  async createDemand(data: {
    demandCategory: 'TURBINE' | 'CONSUMABLE';
    siteId: string;
    siteName: string;
    turbineId?: string;
    urgency: 'ACIL_ARIZA' | 'PERIYODIK_BAKIM' | 'NORMAL';
    generalNote?: string;
    items: MaterialDemandItem[];
    requesterId: string;
    requesterName: string;
    requesterEmail: string;
    requesterTeam?: string;
  }): Promise<string> {
    const demandNo = await this.generateDemandNumber(data.siteId);
    const todayStr = new Date().toISOString().split('T')[0];
    const title = `${demandNo}_${todayStr}`;

    const docData = sanitizeForFirestore({
      demandNo,
      title,
      demandCategory: data.demandCategory || 'TURBINE',
      siteId: data.siteId,
      siteName: data.siteName,
      turbineId: data.turbineId || '',
      urgency: data.urgency || 'NORMAL',
      generalNote: data.generalNote || '',
      items: data.items.map(i => ({
        id: i.id || `ITEM_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sapNo: i.sapNo ? i.sapNo.trim() : '',
        description: i.description ? i.description.trim() : 'Malzeme',
        enerconRef: i.enerconRef ? i.enerconRef.trim() : '',
        quantity: Number(i.quantity) || 1,
        unit: i.unit || 'Adet',
        reason: i.reason || ''
      })),
      requesterId: data.requesterId,
      requesterName: data.requesterName,
      requesterEmail: data.requesterEmail,
      requesterTeam: data.requesterTeam || '',
      status: 'PENDING_REVIEW',
      createdAt: serverTimestamp(),
      updatedAt: new Date().toISOString()
    });

    const ref = await addDoc(collection(db, this.collectionName), docData);
    return ref.id;
  }

  // Update existing demand (e.g. adding items or editing details)
  async updateDemand(
    demandId: string,
    data: {
      siteId?: string;
      siteName?: string;
      turbineId?: string;
      urgency?: 'ACIL_ARIZA' | 'PERIYODIK_BAKIM' | 'NORMAL';
      demandCategory?: 'TURBINE' | 'CONSUMABLE';
      generalNote?: string;
      items: MaterialDemandItem[];
    }
  ): Promise<void> {
    const docRef = doc(db, this.collectionName, demandId);
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      throw new Error("Talep bulunamadı!");
    }
    const existing = existingSnap.data() as MaterialDemand;
    if (existing.status === 'ORDERED' || existing.status === 'DELIVERED') {
      throw new Error("Resmi siparişi açılmış veya teslim edilmiş talepler düzenlenemez!");
    }

    const docData: any = {
      items: data.items.map(i => ({
        id: i.id || `ITEM_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sapNo: i.sapNo ? i.sapNo.trim() : '',
        description: i.description ? i.description.trim() : 'Malzeme',
        enerconRef: i.enerconRef ? i.enerconRef.trim() : '',
        quantity: Number(i.quantity) || 1,
        unit: i.unit || 'Adet',
        reason: i.reason || '',
        itemDecision: i.itemDecision || undefined,
        approvedQuantity: i.approvedQuantity !== undefined ? i.approvedQuantity : undefined,
        managerItemNote: i.managerItemNote || undefined
      })),
      generalNote: data.generalNote !== undefined ? data.generalNote : (existing.generalNote || ''),
      updatedAt: new Date().toISOString()
    };

    if (data.siteId) docData.siteId = data.siteId;
    if (data.siteName) docData.siteName = data.siteName;
    if (data.turbineId !== undefined) docData.turbineId = data.turbineId;
    if (data.urgency) docData.urgency = data.urgency;
    if (data.demandCategory) docData.demandCategory = data.demandCategory;

    if (existing.status === 'REJECTED') {
      docData.status = 'PENDING_REVIEW';
      docData.reviewNote = '';
    }

    await updateDoc(docRef, sanitizeForFirestore(docData));
  }

  // Review demand (Saha Sorumlusu / Yönetici Onayı veya Reddi + Miktar Düzeltme)
  async reviewDemand(
    demandId: string, 
    action: 'APPROVE' | 'REJECT', 
    reviewNote: string, 
    reviewerId: string, 
    reviewerName: string,
    updatedItems?: MaterialDemandItem[]
  ): Promise<void> {
    const docRef = doc(db, this.collectionName, demandId);
    const newStatus: MaterialDemandStatus = action === 'APPROVE' ? 'APPROVED_FOR_ORDER' : 'REJECTED';
    
    const updateData: any = {
      status: newStatus,
      reviewedBy: reviewerId,
      reviewedByName: reviewerName,
      reviewedAt: new Date().toISOString(),
      reviewNote: reviewNote || (action === 'APPROVE' ? 'Sipariş için uygun görüldü.' : 'Talep onaylanmadı.'),
      updatedAt: new Date().toISOString()
    };

    if (updatedItems && updatedItems.length > 0) {
      updateData.items = updatedItems;
    }

    await updateDoc(docRef, sanitizeForFirestore(updateData));
  }

  // Cross-warehouse stock scanner for SAP materials (Parallel fetching for super-fast performance)
  async getStockSummaryForSap(sapNo: string, currentSiteId: string): Promise<CrossWarehouseStockSummary> {
    const cleanSap = (sapNo || '').trim().toLowerCase();
    const result: CrossWarehouseStockSummary = {
      siteQty: 0,
      siteShelf: '',
      centralQty: 0,
      centralShelf: '',
      otherSites: []
    };

    if (!cleanSap) return result;

    const warehouses = dataService.getWarehouses();
    const currentWhId = dataService.getWarehouseIdBySiteId(currentSiteId) || currentSiteId;

    await Promise.all(warehouses.map(async (wh) => {
      try {
        const items = await warehouseService.getInventory(wh.id);
        const match = items.find(i => (i.sapNo || '').trim().toLowerCase() === cleanSap);
        if (match && match.quantity > 0) {
          const qty = Number(match.quantity) || 0;
          const shelf = match.shelfNo || '';

          const isCurrentSite = wh.id === currentWhId || 
            (currentSiteId && wh.name.toLowerCase().includes(currentSiteId.toLowerCase())) ||
            (currentSiteId && currentSiteId.toLowerCase().includes(wh.name.toLowerCase()));

          const isCentral = wh.id === '2688' || wh.name.toLowerCase().includes('merkez');

          if (isCurrentSite) {
            result.siteQty += qty;
            if (shelf && !result.siteShelf) result.siteShelf = shelf;
          } else if (isCentral) {
            result.centralQty += qty;
            if (shelf && !result.centralShelf) result.centralShelf = shelf;
          } else {
            result.otherSites.push({
              siteId: wh.id,
              siteName: wh.name,
              qty,
              shelf
            });
          }
        }
      } catch (e) {
        // continue
      }
    }));

    return result;
  }

  // Link demand to an official order created by Malzeme Yönetimi
  async linkDemandToOrder(
    demandId: string, 
    orderId: string, 
    orderNo: string, 
    orderDate: string
  ): Promise<void> {
    const docRef = doc(db, this.collectionName, demandId);
    await updateDoc(docRef, sanitizeForFirestore({
      status: 'ORDERED' as MaterialDemandStatus,
      orderId,
      orderNo,
      orderDate: orderDate || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString()
    }));
  }

  // Sync received quantities from Order delivery records into linked demands
  async syncDemandDeliveriesFromOrder(orderId: string, orderNo: string, orderItems: any[]): Promise<void> {
    try {
      const demands = await this.getDemands();
      const linked = demands.filter(d => (orderId && d.orderId === orderId) || (orderNo && d.orderNo === orderNo));
      
      for (const demand of linked) {
        let anyChanged = false;
        const updatedItems = (demand.items || []).map(dItem => {
          const match = (orderItems || []).find(oi => {
            if (oi.sapNo && dItem.sapNo && String(oi.sapNo).trim().toLowerCase() === String(dItem.sapNo).trim().toLowerCase()) {
              return true;
            }
            if (oi.description && dItem.description && String(oi.description).trim().toLowerCase() === String(dItem.description).trim().toLowerCase()) {
              return true;
            }
            return false;
          });

          if (match) {
            const delivered = Number(match.deliveredQuantity || 0);
            if (dItem.deliveredQuantity !== delivered) {
              anyChanged = true;
              return {
                ...dItem,
                deliveredQuantity: delivered
              };
            }
          }
          return dItem;
        });

        if (anyChanged) {
          const allCompleted = updatedItems.length > 0 && updatedItems.every(i => {
            if (i.itemDecision && i.itemDecision !== 'APPROVE_PURCHASE') return true;
            const target = i.approvedQuantity !== undefined ? i.approvedQuantity : i.quantity;
            return (i.deliveredQuantity || 0) >= target;
          });

          const newStatus: MaterialDemandStatus = allCompleted ? 'DELIVERED' : 'ORDERED';
          const docRef = doc(db, this.collectionName, demand.id);
          await updateDoc(docRef, sanitizeForFirestore({
            items: updatedItems,
            status: newStatus,
            updatedAt: new Date().toISOString()
          }));
        }
      }
    } catch (err) {
      console.warn("syncDemandDeliveriesFromOrder error:", err);
    }
  }

  // Delete demand
  async deleteDemand(demandId: string): Promise<void> {
    const docRef = doc(db, this.collectionName, demandId);
    await deleteDoc(docRef);
  }
}

export const materialDemandService = new MaterialDemandService();
