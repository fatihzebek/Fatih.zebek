import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';

export interface CustodyItem {
  id: string;
  productCode: string;       // Ürün Kodu / SAP Kodu (İsteğe bağlı)
  productName: string;       // Ürün Adı / Tanım (pense, tork anahtarı vb. - Zorunlu)
  serialNo?: string;         // Seri Numarası (İsteğe bağlı)
  description: string;       // Açıklama
  category: string;          // Kategori: El Aleti, Ölçü Aleti, Elektrik Aleti, Güvenlik Ekipmanı, Hidrolik Ekipman, Diğer
  assignedTo: string;        // Kime zimmetli (kişi adı)
  assignedTeam: string;      // Hangi Team'e zimmetli
  location: 'team' | 'depo' | 'person'; // Nerede: Team'de mi, Depoda mı, Kişide mi
  warehouseId?: string;      // Eğer depodaysa hangi depo
  condition: 'saglam' | 'arizali' | 'hurda' | 'kayip'; // Durum: Sağlam, Arızalı, Hurda, Kayıp
  conditionNote?: string;    // Durum notu / Arıza detayı
  assignedDate: any;         // Zimmetlenme tarihi
  lastUpdated: any;          // Son güncelleme
  createdBy: string;         // Oluşturan kişi
  imageUrl?: string;         // Ürün Fotoğrafı (Base64 URL)
  quantity: number;          // Adet / Miktar
}

export interface CustodyHistoryEntry {
  id: string;
  itemId: string;
  productCode: string;
  productName: string;
  serialNo?: string;
  timestamp: any;
  action: string;            // 'Oluşturuldu', 'Zimmet Değiştirildi', 'Durum Güncellendi', 'Silindi'
  oldAssignee?: string;
  oldTeam?: string;
  newAssignee?: string;
  newTeam?: string;
  oldCondition?: string;
  newCondition?: string;
  note?: string;
  by: string;
  quantity?: number;
}

class AssetCustodyService {
  private collectionName = 'asset_custody';

  async getAll(): Promise<CustodyItem[]> {
    try {
      const q = query(collection(db, this.collectionName), orderBy('productName', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustodyItem));
    } catch (error) {
      console.error('Zimmet verileri alınamadı:', error);
      return [];
    }
  }

  async add(item: Omit<CustodyItem, 'id' | 'assignedDate' | 'lastUpdated'>): Promise<string> {
    const docRef = await addDoc(collection(db, this.collectionName), {
      ...item,
      assignedDate: serverTimestamp(),
      lastUpdated: serverTimestamp()
    });
    return docRef.id;
  }

  async update(id: string, data: Partial<CustodyItem>): Promise<void> {
    const ref = doc(db, this.collectionName, id);
    await updateDoc(ref, { ...data, lastUpdated: serverTimestamp() });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, this.collectionName, id));
  }

  async getHistory(itemId: string): Promise<CustodyHistoryEntry[]> {
    try {
      const q = query(
        collection(db, 'asset_custody_history'),
        where('itemId', '==', itemId),
        orderBy('timestamp', 'desc')
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustodyHistoryEntry));
    } catch (e) {
      // Fallback to in-memory filter to avoid index errors on startup
      try {
        const snapshot = await getDocs(collection(db, 'asset_custody_history'));
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustodyHistoryEntry));
        return list
          .filter(x => x.itemId === itemId)
          .sort((a, b) => {
            const timeA = a.timestamp?.seconds || 0;
            const timeB = b.timestamp?.seconds || 0;
            return timeB - timeA;
          });
      } catch (err) {
        console.error('Zimmet geçmişi alınamadı:', err);
        return [];
      }
    }
  }

  async getGlobalHistory(): Promise<CustodyHistoryEntry[]> {
    try {
      const snapshot = await getDocs(collection(db, 'asset_custody_history'));
      return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as CustodyHistoryEntry));
    } catch (error) {
      console.error('Genel zimmet geçmişi alınamadı:', error);
      return [];
    }
  }

  async addHistoryLog(log: Omit<CustodyHistoryEntry, 'id' | 'timestamp'>): Promise<void> {
    try {
      await addDoc(collection(db, 'asset_custody_history'), {
        ...log,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error('Zimmet logu yazılamadı:', error);
    }
  }

  async clearAllHistory(): Promise<void> {
    const q = collection(db, 'asset_custody_history');
    const snapshot = await getDocs(q);
    const promises = snapshot.docs.map(d => deleteDoc(doc(db, 'asset_custody_history', d.id)));
    await Promise.all(promises);
  }

  async clearAllCustodyItems(): Promise<void> {
    const q = collection(db, this.collectionName);
    const snapshot = await getDocs(q);
    const promises = snapshot.docs.map(d => deleteDoc(doc(db, this.collectionName, d.id)));
    await Promise.all(promises);
  }

  async removeHistoryOfItem(itemId: string): Promise<void> {
    const q = query(collection(db, 'asset_custody_history'), where('itemId', '==', itemId));
    const snapshot = await getDocs(q);
    const promises = snapshot.docs.map(d => deleteDoc(doc(db, 'asset_custody_history', d.id)));
    await Promise.all(promises);
  }
}

export const assetCustodyService = new AssetCustodyService();
