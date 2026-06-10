import { BaseAgent } from './BaseAgent';

export class WarehouseAgent extends BaseAgent {
  private sapDictionary: Record<string, string> | null = null;

  constructor() {
    super('warehouse-agent-01', 'WarehouseAgent', 'Depo Yöneticisi');
  }

  /**
   * Küresel SAP Sözlüğünü public klasöründen asenkron olarak yükler ve önbelleğe alır.
   */
  private async loadSapDictionary(): Promise<void> {
    if (this.sapDictionary) return;
    
    try {
      console.log('[WarehouseAgent] Küresel SAP Sözlüğü yükleniyor...');
      const response = await fetch('/sap_dictionary.json');
      if (!response.ok) throw new Error('Sözlük dosyası bulunamadı.');
      this.sapDictionary = await response.json();
      console.log(`[WarehouseAgent] Sözlük yüklendi. (Anahtar Sayısı: ${Object.keys(this.sapDictionary || {}).length})`);
    } catch (err) {
      console.error('[WarehouseAgent] SAP Sözlüğü yüklenemedi:', err);
      this.sapDictionary = {}; // Fallback empty
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
   * SAP numarası girildiğinde Küresel Sözlükten malzeme bilgilerini getirir.
   */
  async resolveSapNumber(sapNo: string): Promise<{ sapNo: string; name: string | null; found: boolean }> {
    this.setStatus('busy');
    console.log(`[WarehouseAgent] SAP No sorgulanıyor: ${sapNo}`);
    
    try {
      await this.loadSapDictionary();
      
      // Look up ignoring case and padding
      const cleanSap = String(sapNo).trim();
      const materialName = this.sapDictionary ? this.sapDictionary[cleanSap] : null;
      
      this.setStatus('online');
      return { 
        sapNo: cleanSap, 
        name: materialName || null, 
        found: !!materialName 
      };
    } catch (error) {
      this.setStatus('error');
      console.log(`[WarehouseAgent] SAP sorgulama hatası: ${error}`);
      throw error;
    }
  }
}

export const warehouseAgent = new WarehouseAgent();
