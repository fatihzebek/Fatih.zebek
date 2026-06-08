import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import type { Gorev } from '../types';

/**
 * GorevService: 'Gorevler' koleksiyonu üzerindeki tüm veritabanı işlemlerini yönetir.
 * Enterprise standartlarda, hata toleranslı ve asenkron yapıdadır.
 */
class GorevService {
  private gorevlerCollection = collection(db, 'Gorevler');

  /**
   * Yeni bir iş emrini Firestore'a kaydeder.
   * Şemada 'priority' alanı kesinlikle yer almaz.
   */
  async saveGorev(data: Omit<Gorev, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(this.gorevlerCollection, {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    return docRef.id;
  }

  /**
   * Bir ekibin o anki meşguliyet durumunu kontrol eder.
   * 'Açık' veya 'Devam Ediyor' statüsünde görevi olan ekipler meşgul sayılır.
   */
  async isTeamAvailable(teamName: string): Promise<boolean> {
    const q = query(
      this.gorevlerCollection, 
      where('atananEkip', '==', teamName),
      where('durum', 'in', ['Açık', 'Devam Ediyor'])
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  }

  /**
   * Belirli bir türbin için aktif görevleri getirir.
   */
  async getActiveGorevByTurbine(turbinNo: string) {
    const q = query(
      this.gorevlerCollection,
      where('turbinNo', '==', turbinNo),
      where('durum', 'in', ['Açık', 'Devam Ediyor'])
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}

export const gorevService = new GorevService();
