import { db } from '../firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp, 
  writeBatch 
} from 'firebase/firestore';

export interface MaterialPriceEntry {
  id?: string;
  sapNo: string;
  description: string;
  year: number;
  entryDate: string; // YYYY-MM-DD
  price: number;
  currency: 'EUR' | 'USD' | 'TRY';
  quantity?: number;
  invoiceNo?: string;
  supplier?: string;
  note?: string;
  createdByName?: string;
  createdByEmail?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface GroupedMaterialPrice {
  sapNo: string;
  description: string;
  pricesByYear: Record<number, MaterialPriceEntry>;
  allEntries: MaterialPriceEntry[];
  latestEntry?: MaterialPriceEntry;
  averagePrice?: number;
  primaryCurrency?: 'EUR' | 'USD' | 'TRY';
}

class PriceService {
  private collectionName = 'material_prices';
  private cachedPrices: MaterialPriceEntry[] | null = null;
  private lastFetchTime = 0;
  private CACHE_TTL = 30000; // 30 seconds

  /**
   * Retrieves all material price records sorted by year descending, then date descending.
   */
  async getAllPrices(forceRefresh = false): Promise<MaterialPriceEntry[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedPrices && (now - this.lastFetchTime < this.CACHE_TTL)) {
      return this.cachedPrices;
    }

    try {
      const q = query(collection(db, this.collectionName), orderBy('year', 'desc'));
      const snapshot = await getDocs(q);
      const list: MaterialPriceEntry[] = [];

      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          sapNo: String(data.sapNo || '').trim(),
          description: String(data.description || '').trim(),
          year: Number(data.year) || new Date().getFullYear(),
          entryDate: data.entryDate || '',
          price: Number(data.price) || 0,
          currency: data.currency || 'EUR',
          quantity: data.quantity !== undefined ? Number(data.quantity) : undefined,
          invoiceNo: data.invoiceNo || '',
          supplier: data.supplier || '',
          note: data.note || '',
          createdByName: data.createdByName || '',
          createdByEmail: data.createdByEmail || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        });
      });

      this.cachedPrices = list;
      this.lastFetchTime = now;
      return list;
    } catch (error) {
      console.error('[PriceService] Error fetching material prices:', error);
      return this.cachedPrices || [];
    }
  }

  /**
   * Returns price entries grouped by SAP Number for cross-year comparison tables.
   */
  async getGroupedPrices(forceRefresh = false): Promise<GroupedMaterialPrice[]> {
    const all = await this.getAllPrices(forceRefresh);
    const map: Record<string, GroupedMaterialPrice> = {};

    all.forEach(entry => {
      const sap = entry.sapNo.toUpperCase();
      if (!map[sap]) {
        map[sap] = {
          sapNo: entry.sapNo,
          description: entry.description,
          pricesByYear: {},
          allEntries: []
        };
      }

      // Update description if missing
      if (!map[sap].description && entry.description) {
        map[sap].description = entry.description;
      }

      map[sap].allEntries.push(entry);

      // Keep latest price entry per year
      const existingYearEntry = map[sap].pricesByYear[entry.year];
      if (!existingYearEntry || (entry.entryDate && entry.entryDate > (existingYearEntry.entryDate || ''))) {
        map[sap].pricesByYear[entry.year] = entry;
      }
    });

    // Compute latest & averages
    const result: GroupedMaterialPrice[] = Object.values(map).map(item => {
      // Sort entries by year descending, then date descending
      item.allEntries.sort((a, b) => {
        if (b.year !== a.year) return b.year - a.year;
        return (b.entryDate || '').localeCompare(a.entryDate || '');
      });

      item.latestEntry = item.allEntries[0];
      item.primaryCurrency = item.latestEntry?.currency || 'EUR';

      // Compute average price for items in the same currency
      const sameCurrencyEntries = item.allEntries.filter(e => e.currency === item.primaryCurrency && e.price > 0);
      if (sameCurrencyEntries.length > 0) {
        const sum = sameCurrencyEntries.reduce((acc, curr) => acc + curr.price, 0);
        item.averagePrice = Number((sum / sameCurrencyEntries.length).toFixed(2));
      } else {
        item.averagePrice = item.latestEntry?.price || 0;
      }

      return item;
    });

    return result.sort((a, b) => a.sapNo.localeCompare(b.sapNo));
  }

  /**
   * Saves or updates a single price record.
   */
  async savePriceEntry(entry: Omit<MaterialPriceEntry, 'id'>, id?: string): Promise<string> {
    const docId = id || (entry.sapNo ? `${entry.sapNo.trim()}_${entry.year}_${Date.now()}` : doc(collection(db, this.collectionName)).id);
    const docRef = doc(db, this.collectionName, docId);

    const payload: any = {
      sapNo: String(entry.sapNo || '').trim(),
      description: String(entry.description || '').trim(),
      year: Number(entry.year) || new Date().getFullYear(),
      entryDate: entry.entryDate || new Date().toISOString().split('T')[0],
      price: Number(entry.price) || 0,
      currency: entry.currency || 'EUR',
      quantity: entry.quantity !== undefined ? Number(entry.quantity) : 1,
      invoiceNo: String(entry.invoiceNo || '').trim(),
      supplier: String(entry.supplier || '').trim(),
      note: String(entry.note || '').trim(),
      updatedAt: serverTimestamp()
    };

    if (entry.createdByName) payload.createdByName = entry.createdByName;
    if (entry.createdByEmail) payload.createdByEmail = entry.createdByEmail;
    if (!id) payload.createdAt = serverTimestamp();

    await setDoc(docRef, payload, { merge: true });
    this.cachedPrices = null; // Invalidate cache
    return docId;
  }

  /**
   * Deletes a price record by ID.
   */
  async deletePriceEntry(id: string): Promise<void> {
    if (!id) return;
    const docRef = doc(db, this.collectionName, id);
    await deleteDoc(docRef);
    this.cachedPrices = null;
  }

  /**
   * Bulk import multiple prices in batches.
   */
  async batchSavePrices(entries: Omit<MaterialPriceEntry, 'id'>[]): Promise<number> {
    if (!entries || entries.length === 0) return 0;

    let savedCount = 0;
    const chunkSize = 450; // Firestore batch max limit is 500

    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      const batch = writeBatch(db);

      chunk.forEach(entry => {
        const docId = `${entry.sapNo.trim()}_${entry.year}_${Math.random().toString(36).substring(2, 9)}`;
        const docRef = doc(db, this.collectionName, docId);
        batch.set(docRef, {
          sapNo: String(entry.sapNo || '').trim(),
          description: String(entry.description || '').trim(),
          year: Number(entry.year) || new Date().getFullYear(),
          entryDate: entry.entryDate || new Date().toISOString().split('T')[0],
          price: Number(entry.price) || 0,
          currency: entry.currency || 'EUR',
          quantity: entry.quantity !== undefined ? Number(entry.quantity) : 1,
          invoiceNo: String(entry.invoiceNo || '').trim(),
          supplier: String(entry.supplier || '').trim(),
          note: String(entry.note || '').trim(),
          createdByName: entry.createdByName || '',
          createdByEmail: entry.createdByEmail || '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      });

      await batch.commit();
      savedCount += chunk.length;
    }

    this.cachedPrices = null;
    return savedCount;
  }
}

export const priceService = new PriceService();
