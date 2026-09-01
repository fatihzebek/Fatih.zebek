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
  getDoc 
} from 'firebase/firestore';
import { warehouseService } from './WarehouseService';

function sanitizeForFirestore(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForFirestore(item));
  }
  if (typeof obj === 'object') {
    // Keep serverTimestamp and Date instances intact
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

export interface OrderItem {
  itemId: string;
  description: string;
  sapNo?: string; // Optional or empty for non-SAP items
  enerconRef?: string; // Enercon drawing / part reference code
  quantity: number; // Requested quantity
  deliveredQuantity: number; // Sağlam teslim alınan (default 0)
  damagedQuantity?: number; // Hasarlı / İade edilen adet
  remainingQuantity: number; // quantity - deliveredQuantity (kalan parça)
  unit?: string;
  currentStock: number;
  limit: number;
  status: 'PENDING' | 'ORDERED' | 'PARTIAL' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
  price?: number; // Teklif birim fiyatı (€)
  invoicePrice?: number; // Fatura birim fiyatı (€)
  currency?: string;
  note?: string;
}

export interface OrderDeliveryRecord {
  id: string;
  deliveryNoteNo: string; // Enercon Delivery Note (DN) or Waybill
  invoiceNo?: string; // Fatura Numarası
  arrivalDate?: string; // Malzeme Geliş Tarihi (YYYY-MM-DD)
  stockEntryDate?: string; // Depoya Giriş Tarihi (YYYY-MM-DD)
  invoiceDate?: string; // Fatura Tarihi (YYYY-MM-DD)
  transitDays?: number; // Kaç günde geldi (Transit gün sayısı)
  deliveryDate?: string; // Legacy fallback
  receivedBy: string;
  note?: string;
  items: Array<{
    itemId: string;
    sapNo?: string;
    description: string;
    receivedQty: number; // Bu sevkiyatta gelen toplam adet
    acceptedQty?: number; // Sağlam teslim alınan adet (stoğa giren)
    damagedQty?: number; // Hasarlı / İade edilen adet
    returnReason?: string; // Hasar / İade açıklaması
    returnAction?: 'RETURNED' | 'EXCHANGE' | 'SCRAP' | 'NONE'; // İade / hasar aksiyonu
    shelfNo?: string;
    orderPrice?: number; // Sipariş/Teklif birim fiyatı (€)
    invoicePrice?: number; // Faturadaki birim fiyatı (Lojistik maliyet dahil €)
  }>;
  autoAddedToStock?: boolean;
  createdAt?: any;
}

export interface PurchaseRequest {
  id?: string;
  orderNo?: string; // e.g. SIP-2026-001
  warehouseId: string;
  warehouseName: string;
  siteId?: string;
  siteName?: string;
  items: OrderItem[];
  deliveries?: OrderDeliveryRecord[];
  requester: string;
  requesterName?: string;
  targetApprover?: string;
  requesterNote?: string;
  managerNote?: string;
  quotedLogisticsCost?: number; // Teklif aşamasında girilen tahmini lojistik bedeli (€)
  status: 'PENDING' | 'ORDERED' | 'PARTIAL' | 'COMPLETED' | 'CANCELLED' | 'APPROVED' | 'REJECTED';
  timestamp: any;
  updatedAt?: any;
}

class OrderService {
  private collectionRef = collection(db, 'purchaseRequests');
  private cachedRequests: PurchaseRequest[] | null = null;
  private lastFetchTime = 0;
  private CACHE_TTL = 15000; // 15 seconds

  async getRequests(forceRefresh = false): Promise<PurchaseRequest[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedRequests && (now - this.lastFetchTime < this.CACHE_TTL)) {
      return this.cachedRequests;
    }

    try {
      const q = query(this.collectionRef, orderBy('timestamp', 'desc'));
      const snapshot = await getDocs(q);
      const list: PurchaseRequest[] = snapshot.docs.map(docSnap => {
        const data = docSnap.data();
        
        // Normalize items with delivered / remaining calculations
        const rawItems = Array.isArray(data.items) ? data.items : [];
        const items: OrderItem[] = rawItems.map((item: any, idx: number) => {
          const qty = Number(item.quantity) || 1;
          const delivered = Number(item.deliveredQuantity) || (data.status === 'COMPLETED' ? qty : 0);
          const remaining = Math.max(0, qty - delivered);
          
          let itemStatus: OrderItem['status'] = item.status || 'PENDING';
          if (delivered >= qty) {
            itemStatus = 'COMPLETED';
          } else if (delivered > 0) {
            itemStatus = 'PARTIAL';
          }

          return {
            itemId: item.itemId || `item_${idx}_${Date.now()}`,
            description: String(item.description || item.name || 'Malzeme').trim(),
            sapNo: item.sapNo ? String(item.sapNo).trim() : '',
            enerconRef: item.enerconRef ? String(item.enerconRef).trim() : '',
            quantity: qty,
            deliveredQuantity: delivered,
            remainingQuantity: remaining,
            unit: item.unit || 'Adet',
            currentStock: Number(item.currentStock) || 0,
            limit: Number(item.limit) || 0,
            status: itemStatus,
            price: item.price !== undefined ? Number(item.price) : undefined,
            currency: item.currency || 'EUR',
            note: item.note || ''
          };
        });

        // Compute overall order status
        let calculatedStatus: PurchaseRequest['status'] = data.status || 'PENDING';
        if (items.length > 0) {
          const allCompleted = items.every(i => i.deliveredQuantity >= i.quantity);
          const anyDelivered = items.some(i => i.deliveredQuantity > 0);
          if (allCompleted) {
            calculatedStatus = 'COMPLETED';
          } else if (anyDelivered) {
            calculatedStatus = 'PARTIAL';
          }
        }

        return {
          id: docSnap.id,
          orderNo: data.orderNo || `SIP-${docSnap.id.substring(0, 6).toUpperCase()}`,
          warehouseId: data.warehouseId || '',
          warehouseName: data.warehouseName || 'Genel Depo',
          siteId: data.siteId || data.warehouseId || '',
          siteName: data.siteName || data.warehouseName || '',
          items,
          deliveries: Array.isArray(data.deliveries) ? data.deliveries : [],
          requester: data.requester || '',
          requesterName: data.requesterName || data.requester || '',
          targetApprover: data.targetApprover || '',
          requesterNote: data.requesterNote || '',
          managerNote: data.managerNote || '',
          quotedLogisticsCost: data.quotedLogisticsCost !== undefined ? Number(data.quotedLogisticsCost) : 0,
          status: calculatedStatus,
          timestamp: data.timestamp,
          updatedAt: data.updatedAt
        };
      });

      this.cachedRequests = list;
      this.lastFetchTime = now;
      return list;
    } catch (e) {
      console.error('[OrderService] Error fetching orders:', e);
      return this.cachedRequests || [];
    }
  }

  async createPurchaseRequest(
    warehouseId: string, 
    warehouseName: string, 
    items: any[], 
    requester: string, 
    requesterName: string = '',
    targetApprover: string = '',
    requesterNote: string = '',
    siteName: string = '',
    customOrderNo: string = '',
    quotedLogisticsCost: number = 0
  ) {
    const orderNo = customOrderNo?.trim() || `SIP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const processedItems: OrderItem[] = items.map((item, idx) => ({
      itemId: `item_${idx}_${Date.now()}`,
      description: String(item.description || item.d || 'Malzeme').trim(),
      sapNo: item.sapNo ? String(item.sapNo).trim() : '',
      enerconRef: item.enerconRef ? String(item.enerconRef).trim() : '',
      quantity: Number(item.quantity || item.qty || 1),
      deliveredQuantity: 0,
      remainingQuantity: Number(item.quantity || item.qty || 1),
      unit: item.unit || 'Adet',
      currentStock: Number(item.currentStock || 0),
      limit: Number(item.limit || 0),
      status: 'PENDING',
      price: (item.price !== undefined && !isNaN(Number(item.price))) ? Number(item.price) : 0,
      currency: item.currency || 'EUR',
      note: item.note || ''
    }));

    const payload: any = {
      orderNo,
      enerconOrderNo: customOrderNo?.trim() || '',
      warehouseId,
      warehouseName,
      siteId: warehouseId,
      siteName: siteName || warehouseName,
      items: processedItems,
      deliveries: [],
      requester,
      requesterName,
      targetApprover,
      requesterNote,
      quotedLogisticsCost: Number(quotedLogisticsCost) || 0,
      status: 'PENDING',
      timestamp: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const cleanPayload = sanitizeForFirestore(payload);
    const result = await addDoc(this.collectionRef, cleanPayload);
    this.cachedRequests = null; // Invalidate cache
    return result;
  }

  async updateRequest(id: string, data: Partial<PurchaseRequest>) {
    const docRef = doc(this.collectionRef, id);
    const cleanData = sanitizeForFirestore(data);
    await updateDoc(docRef, {
      ...cleanData,
      updatedAt: serverTimestamp()
    });
    this.cachedRequests = null;
  }

  async updateOrderItems(orderId: string, updatedItems: OrderItem[], requesterNote?: string, quotedLogisticsCost?: number) {
    const docRef = doc(this.collectionRef, orderId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error('Sipariş bulunamadı');

    const order = snap.data() as PurchaseRequest;
    const processedItems: OrderItem[] = updatedItems.map(item => {
      const delivered = Number(item.deliveredQuantity || 0);
      const qty = Number(item.quantity || 1);
      const remaining = Math.max(0, qty - delivered);
      let itemStatus: OrderItem['status'] = 'PENDING';
      if (delivered >= qty) {
        itemStatus = 'COMPLETED';
      } else if (delivered > 0) {
        itemStatus = 'PARTIAL';
      }
      return {
        ...item,
        quantity: qty,
        deliveredQuantity: delivered,
        remainingQuantity: remaining,
        status: itemStatus
      };
    });

    const allDone = processedItems.length > 0 && processedItems.every(i => (i.deliveredQuantity || 0) >= i.quantity);
    const anyDone = processedItems.some(i => (i.deliveredQuantity || 0) > 0);
    let orderStatus = order.status;
    if (allDone) {
      orderStatus = 'COMPLETED';
    } else if (anyDone) {
      orderStatus = 'PARTIAL';
    } else {
      orderStatus = 'PENDING';
    }

    const payload: any = {
      items: processedItems,
      status: orderStatus,
      updatedAt: serverTimestamp()
    };
    if (requesterNote !== undefined) {
      payload.requesterNote = requesterNote;
    }
    if (quotedLogisticsCost !== undefined) {
      payload.quotedLogisticsCost = Number(quotedLogisticsCost) || 0;
    }

    const cleanPayload = sanitizeForFirestore(payload);
    await updateDoc(docRef, cleanPayload);
    this.cachedRequests = null;
  }

  async deleteRequest(id: string) {
    if (!id) return;
    const docRef = doc(this.collectionRef, id);
    await deleteDoc(docRef);
    this.cachedRequests = null;
  }

  /**
   * Records a partial delivery batch (Delivery Note) and optionally updates warehouse inventory.
   */
  async recordPartialDelivery(
    orderId: string,
    deliveryData: {
      deliveryNoteNo: string;
      invoiceNo?: string;
      arrivalDate?: string;
      stockEntryDate?: string;
      invoiceDate?: string;
      deliveryDate?: string;
      receivedBy: string;
      note?: string;
      itemsReceived: Array<{
        itemId: string;
        receivedQty: number;
        acceptedQty?: number;
        damagedQty?: number;
        returnReason?: string;
        returnAction?: 'RETURNED' | 'EXCHANGE' | 'SCRAP' | 'NONE';
        shelfNo?: string;
      }>;
      autoAddToStock: boolean;
      warehouseId: string;
      warehouseName: string;
    }
  ) {
    const docRef = doc(this.collectionRef, orderId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Sipariş kaydı bulunamadı!');
    }

    const order = snap.data() as PurchaseRequest;
    const currentItems: OrderItem[] = Array.isArray(order.items) ? [...order.items] : [];
    const currentDeliveries: OrderDeliveryRecord[] = Array.isArray(order.deliveries) ? [...order.deliveries] : [];

    // Compute Transit Days (Kaç Günde Geldi)
    let transitDays = 0;
    try {
      if (order.timestamp) {
        const orderDate = order.timestamp.toDate ? order.timestamp.toDate() : new Date(order.timestamp);
        const arrivalDate = new Date(deliveryData.arrivalDate || deliveryData.deliveryDate || new Date());
        const diffMs = arrivalDate.getTime() - orderDate.getTime();
        transitDays = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      }
    } catch (e) {}

    const deliveryId = `DN_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const deliveredItemSummaries: Array<{
      itemId: string;
      sapNo?: string;
      description: string;
      receivedQty: number;
      acceptedQty: number;
      damagedQty: number;
      returnReason?: string;
      returnAction?: 'RETURNED' | 'EXCHANGE' | 'SCRAP' | 'NONE';
      shelfNo?: string;
      orderPrice?: number;
      invoicePrice?: number;
    }> = [];

    // Apply delivery quantities to each order item
    for (const rec of deliveryData.itemsReceived) {
      if (rec.receivedQty <= 0) continue;

      const targetItem = currentItems.find(i => i.itemId === rec.itemId);
      if (targetItem) {
        const damagedQty = Math.max(0, Number(rec.damagedQty) || 0);
        const acceptedQty = Math.max(0, rec.receivedQty - damagedQty);

        const prevDelivered = targetItem.deliveredQuantity || 0;
        const newDelivered = prevDelivered + acceptedQty;
        targetItem.deliveredQuantity = newDelivered;
        targetItem.damagedQuantity = (targetItem.damagedQuantity || 0) + damagedQty;
        targetItem.remainingQuantity = Math.max(0, targetItem.quantity - newDelivered);

        if (targetItem.deliveredQuantity >= targetItem.quantity) {
          targetItem.status = 'COMPLETED';
        } else {
          targetItem.status = 'PARTIAL';
        }

        deliveredItemSummaries.push({
          itemId: targetItem.itemId,
          sapNo: targetItem.sapNo,
          description: targetItem.description,
          receivedQty: rec.receivedQty,
          acceptedQty,
          damagedQty,
          returnReason: rec.returnReason || '',
          returnAction: rec.returnAction || 'NONE',
          shelfNo: rec.shelfNo || 'Tanımsız',
          orderPrice: targetItem.price !== undefined ? Number(targetItem.price) : 0,
          invoicePrice: targetItem.invoicePrice !== undefined ? Number(targetItem.invoicePrice) : 0
        });

        // If Auto Add to Warehouse Stock is enabled (ONLY add accepted/non-damaged items)
        if (deliveryData.autoAddToStock && deliveryData.warehouseId && acceptedQty > 0) {
          try {
            const sap = targetItem.sapNo ? targetItem.sapNo.trim() : `MANUEL_${Date.now()}`;
            const logNote = `Sipariş Teslimatı (${order.orderNo || ''}) - DN: ${deliveryData.deliveryNoteNo}` +
              (deliveryData.invoiceNo ? ` | Fatura: ${deliveryData.invoiceNo}` : '') +
              (deliveryData.arrivalDate ? ` | Geliş: ${deliveryData.arrivalDate}` : '') +
              (transitDays > 0 ? ` | Transit: ${transitDays} Gün` : '') +
              (damagedQty > 0 ? ` | Hasarlı/İade: ${damagedQty} Adet (${rec.returnReason || 'Kusurlu'})` : '');

            await warehouseService.updateStockBySap(
              deliveryData.warehouseId,
              sap,
              acceptedQty,
              {
                user: deliveryData.receivedBy || 'Sipariş Kabul',
                reason: 'INCOMING_ORDER',
                materialName: targetItem.description,
                formNo: deliveryData.deliveryNoteNo
              },
              'NEW',
              rec.shelfNo || 'Tanımsız',
              '',
              logNote
            );
          } catch (stockErr) {
            console.warn('[OrderService] Error adding delivered item to warehouse stock:', stockErr);
          }
        }
      }
    }

    // Append to deliveries history
    currentDeliveries.unshift({
      id: deliveryId,
      deliveryNoteNo: deliveryData.deliveryNoteNo.trim(),
      invoiceNo: deliveryData.invoiceNo?.trim() || '',
      arrivalDate: deliveryData.arrivalDate || deliveryData.deliveryDate || new Date().toISOString().split('T')[0],
      stockEntryDate: deliveryData.stockEntryDate || new Date().toISOString().split('T')[0],
      invoiceDate: deliveryData.invoiceDate || deliveryData.arrivalDate || new Date().toISOString().split('T')[0],
      transitDays,
      deliveryDate: deliveryData.arrivalDate || deliveryData.deliveryDate || new Date().toISOString().split('T')[0],
      receivedBy: deliveryData.receivedBy || 'Yetkili',
      note: deliveryData.note || '',
      items: deliveredItemSummaries,
      autoAddedToStock: deliveryData.autoAddToStock,
      createdAt: new Date().toISOString()
    });

    // Check overall completion
    const allDone = currentItems.every(i => (i.deliveredQuantity || 0) >= i.quantity);
    const anyDone = currentItems.some(i => (i.deliveredQuantity || 0) > 0);
    let newOrderStatus: PurchaseRequest['status'] = 'PENDING';
    if (allDone) {
      newOrderStatus = 'COMPLETED';
    } else if (anyDone) {
      newOrderStatus = 'PARTIAL';
    }

    const cleanUpdate = sanitizeForFirestore({
      items: currentItems,
      deliveries: currentDeliveries,
      status: newOrderStatus,
      updatedAt: serverTimestamp()
    });

    await updateDoc(docRef, cleanUpdate);

    this.cachedRequests = null;
    return { success: true, newStatus: newOrderStatus };
  }

  /**
   * Updates invoice number, date and item invoice unit prices for a delivery record.
   */
  async updateDeliveryInvoice(
    orderId: string,
    deliveryId: string,
    invoiceNo: string,
    invoiceDate?: string,
    itemPrices?: Array<{ itemId: string; invoicePrice: number }>
  ) {
    const docRef = doc(this.collectionRef, orderId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      throw new Error('Sipariş kaydı bulunamadı!');
    }

    const orderData = snap.data();
    const deliveries = Array.isArray(orderData.deliveries) ? orderData.deliveries : [];
    const items = Array.isArray(orderData.items) ? orderData.items : [];
    const targetDelivery = deliveries.find((d: any) => d.id === deliveryId);

    if (targetDelivery) {
      targetDelivery.invoiceNo = invoiceNo.trim();
      if (invoiceDate) {
        targetDelivery.invoiceDate = invoiceDate;
      }
      if (itemPrices && Array.isArray(itemPrices)) {
        itemPrices.forEach(ip => {
          const dItem = (targetDelivery.items || []).find((di: any) => di.itemId === ip.itemId);
          if (dItem) {
            dItem.invoicePrice = Number(ip.invoicePrice) || 0;
          }
          const oItem = items.find((oi: any) => oi.itemId === ip.itemId);
          if (oItem) {
            oItem.invoicePrice = Number(ip.invoicePrice) || 0;
          }
        });
      }
    }

    const cleanData = sanitizeForFirestore({
      deliveries,
      items,
      updatedAt: serverTimestamp()
    });

    await updateDoc(docRef, cleanData);
    this.cachedRequests = null;
  }
}

export const orderService = new OrderService();
