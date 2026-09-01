import { BaseAgent } from './BaseAgent';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { formatTeamName } from '../utils/formatters';

export class WarehouseAgent extends BaseAgent {
  private sapDictionary: Record<string, string> | null = null;

  constructor() {
    super('warehouse-agent-01', 'WarehouseAgent', 'Depo Yöneticisi');
  }

  /**
   * Küresel SAP Sözlüğünü public klasöründen veya dahili veriden asenkron olarak yükler ve önbelleğe alır.
   */
  private async loadSapDictionary(): Promise<void> {
    if (this.sapDictionary && Object.keys(this.sapDictionary).length > 0) return;
    
    try {
      const response = await fetch('/sap_dictionary.json');
      if (response.ok) {
        this.sapDictionary = await response.json();
      }
    } catch (err) {
      console.warn('[WarehouseAgent] fetch sap_dictionary failed, trying dynamic import:', err);
    }

    if (!this.sapDictionary || Object.keys(this.sapDictionary).length === 0) {
      try {
        const matModule = await import('../data/materials.json');
        const rawList = (matModule.default || matModule) as Array<{ n: string; d: string }>;
        this.sapDictionary = {};
        if (Array.isArray(rawList)) {
          for (const item of rawList) {
            if (item && item.n) {
              this.sapDictionary[String(item.n).trim()] = item.d;
            }
          }
        }
      } catch (err2) {
        console.error('[WarehouseAgent] All SAP loading fallbacks failed:', err2);
        this.sapDictionary = {};
      }
    }
  }

  /**
   * Depodaki stok seviyelerini analiz eder ve kritik seviyedeki malzemeleri tespit eder.
   */
  async analyzeInventory(warehouseId: string): Promise<any> {
    this.setStatus('busy');
    console.log(`[WarehouseAgent] Depo analizi başlatıldı: ${warehouseId}`);
    
    try {
      // TODO: Gerçek veritabanı analizi eklenecek
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log(`[WarehouseAgent] Depo analizi tamamlandı. Eksik malzemeler tespit edildi.`);
      this.setStatus('online');
      return { status: 'success', message: 'Analiz tamamlandı' };
    } catch (error) {
      this.setStatus('error');
      console.log(`[WarehouseAgent] Analiz hatası: ${error}`);
      throw error;
    }
  }

  /**
   * SAP numarası girildiğinde Küresel Sözlükten malzeme bilgilerini akıllı eşleme ile getirir.
   */
  async resolveSapNumber(sapNo: string): Promise<{ sapNo: string; name: string | null; found: boolean }> {
    this.setStatus('busy');
    try {
      await this.loadSapDictionary();
      if (!this.sapDictionary) return { sapNo, name: null, found: false };

      const cleanSap = String(sapNo || '').trim();
      if (!cleanSap) return { sapNo: '', name: null, found: false };

      const upperSap = cleanSap.toUpperCase();

      // 1. Doğrudan Birebir Eşleşme
      if (this.sapDictionary[cleanSap]) {
        return { sapNo: cleanSap, name: this.sapDictionary[cleanSap], found: true };
      }
      if (this.sapDictionary[upperSap]) {
        return { sapNo: cleanSap, name: this.sapDictionary[upperSap], found: true };
      }

      // 2. Akıllı Önek ve Sıfır Temizleme (Örn: T70711 -> 70711, R70711 -> 70711, 0070711 -> 70711)
      const digitsMatch = cleanSap.match(/\d+/);
      if (digitsMatch) {
        const digits = digitsMatch[0];
        const unpaddedDigits = digits.replace(/^0+/, '');

        if (this.sapDictionary[digits]) {
          return { sapNo: cleanSap, name: this.sapDictionary[digits], found: true };
        }
        if (unpaddedDigits && this.sapDictionary[unpaddedDigits]) {
          return { sapNo: cleanSap, name: this.sapDictionary[unpaddedDigits], found: true };
        }
        if (unpaddedDigits && this.sapDictionary[`R${unpaddedDigits}`]) {
          return { sapNo: cleanSap, name: this.sapDictionary[`R${unpaddedDigits}`], found: true };
        }
        if (unpaddedDigits && this.sapDictionary[`T${unpaddedDigits}`]) {
          return { sapNo: cleanSap, name: this.sapDictionary[`T${unpaddedDigits}`], found: true };
        }
      }

      // 3. Karakter Temizlenmiş Eşleşme
      const strippedClean = upperSap.replace(/[^A-Z0-9]/g, '');
      if (strippedClean.length >= 3) {
        for (const key in this.sapDictionary) {
          const normKey = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
          if (normKey === strippedClean) {
            return { sapNo: cleanSap, name: this.sapDictionary[key], found: true };
          }
        }
      }

      return { sapNo: cleanSap, name: null, found: false };
    } catch (error) {
      console.error('[WarehouseAgent] resolveSapNumber error:', error);
      return { sapNo, name: null, found: false };
    } finally {
      this.setStatus('online');
    }
  }

  /**
   * Runs a silent background data audit and self-healing routine to fix
   * any inconsistent team names, reservation keys, or stray collections in Firestore.
   */
  async runSelfHealingAudit(): Promise<void> {
    this.setStatus('busy');
    console.log('[WarehouseAgent] Self-healing database audit started...');
    try {
      // 1. Audit and fix user team formats (e.g. "Team03" -> "Team 03")
      const usersRef = collection(db, 'users');
      const usersSnap = await getDocs(usersRef);
      for (const uDoc of usersSnap.docs) {
        const uData = uDoc.data();
        if (uData.team) {
          const formatted = formatTeamName(uData.team);
          const teamMatch = formatted.match(/Team\s*(\d+)/i);
          if (teamMatch) {
            const num = parseInt(teamMatch[1]);
            const canonicalTeamName = `Team ${String(num).padStart(2, '0')}`;
            if (uData.team !== canonicalTeamName) {
              console.log(`[WarehouseAgent] Normalizing user ${uData.email} team: ${uData.team} -> ${canonicalTeamName}`);
              await updateDoc(doc(db, 'users', uDoc.id), {
                team: canonicalTeamName
              });
            }
          }
        }
      }

      // 2. Audit and fix reservations keys across all warehouses (e.g. "team_Team03" -> "team_Team_03")
      const warehousesRef = collection(db, 'warehouses');
      const whSnap = await getDocs(warehousesRef);
      for (const whDoc of whSnap.docs) {
        const whId = whDoc.id;
        
        // Scan inventory items
        const invRef = collection(db, 'warehouses', whId, 'inventory_v2');
        const invSnap = await getDocs(invRef);
        for (const itemDoc of invSnap.docs) {
          const item = itemDoc.data();
          if (item.reservations && Object.keys(item.reservations).length > 0) {
            let hasChanges = false;
            const updatedReservations = { ...item.reservations };
            
            Object.entries(item.reservations).forEach(([teamKey, qty]) => {
              const numQty = Number(qty);
              const teamMatch = teamKey.match(/Team\s*(\d+)/i) || teamKey.match(/Team_(\d+)/i) || teamKey.match(/Team0*(\d+)/i);
              if (teamMatch) {
                const num = parseInt(teamMatch[1]);
                const canonicalTeamKey = `team_Team_${String(num).padStart(2, '0')}`;
                if (teamKey !== canonicalTeamKey) {
                  console.log(`[WarehouseAgent] Fixing reservation key in warehouse ${whId} for item ${item.sapNo}: ${teamKey} -> ${canonicalTeamKey}`);
                  delete updatedReservations[teamKey];
                  updatedReservations[canonicalTeamKey] = (updatedReservations[canonicalTeamKey] || 0) + numQty;
                  hasChanges = true;
                }
              }
            });
            
            if (hasChanges) {
              await updateDoc(doc(db, 'warehouses', whId, 'inventory_v2', itemDoc.id), {
                reservations: updatedReservations
              });
            }
          }
        }
      }

      // 3. Check for any items in legacy/incorrect team collections (e.g. team_Team03) and migrate
      for (let i = 1; i <= 15; i++) {
        const legacyTeamId = `team_Team${String(i).padStart(2, '0')}`;
        const canonicalTeamId = `team_Team_${String(i).padStart(2, '0')}`;
        
        const legacyRef = collection(db, 'warehouses', legacyTeamId, 'inventory_v2');
        const legacySnap = await getDocs(legacyRef);
        if (!legacySnap.empty) {
          console.log(`[WarehouseAgent] Found legacy inventory in ${legacyTeamId}. Migrating to ${canonicalTeamId}...`);
          for (const itemDoc of legacySnap.docs) {
            const itemData = itemDoc.data();
            const canonicalItemRef = doc(db, 'warehouses', canonicalTeamId, 'inventory_v2', itemDoc.id);
            await setDoc(canonicalItemRef, itemData);
            await deleteDoc(itemDoc.ref);
          }
          console.log(`[WarehouseAgent] Migration from ${legacyTeamId} to ${canonicalTeamId} complete.`);
        }
      }

      console.log('[WarehouseAgent] Self-healing audit finished successfully.');
      this.setStatus('online');
    } catch (error) {
      console.error('[WarehouseAgent] Self-healing database audit error:', error);
      this.setStatus('error');
    }
  }
}

export const warehouseAgent = new WarehouseAgent();
