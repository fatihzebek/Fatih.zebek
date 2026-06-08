import { db } from '../firebase';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';

export interface CustodyItem {
  id: string;
  productCode: string;       // Ürün Kodu
  productName: string;       // Ürün Adı (anahtar, pense, tornavida vb.)
  description: string;       // Açıklama
  category: string;          // Kategori: El Aleti, Ölçü Aleti, Güvenlik Ekipmanı, Diğer
  assignedTo: string;        // Kime zimmetli (kişi adı)
  assignedTeam: string;      // Hangi Team'e zimmetli
  location: 'team' | 'depo'; // Nerede: Team'de mi, Depoda mı
  warehouseId?: string;      // Eğer depodaysa hangi depo
  condition: 'saglam' | 'arizali' | 'hurda'; // Durum: Sağlam, Arızalı, Hurda
  conditionNote?: string;    // Arızalı ise not
  assignedDate: any;         // Zimmetlenme tarihi
  lastUpdated: any;          // Son güncelleme
  createdBy: string;         // Oluşturan kişi
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
}

export const assetCustodyService = new AssetCustodyService();
