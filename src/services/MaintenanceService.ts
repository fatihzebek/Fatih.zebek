import { db } from '../firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export interface MaintenanceTemplate {
  id: string;
  name: string;
  icon: string;
  category: 'YAĞLAMA' | 'ANA' | '4YIL' | 'OTHER';
  turbineModel: 'E44-E48' | 'E70' | 'E82' | 'E82/E2' | 'E92' | 'GLOBAL';
  materials: { sapNo: string; quantity: number; description?: string }[];
  checklist: { 
    id: string; 
    text: string; 
    category: string;
    isSubItem?: boolean;
    requiredPhoto?: boolean;
    photoUrl?: string;
    requiresMeasurement?: boolean;
    measurementValue?: string;
    measurementConfig?: {
      type: 'numeric_multiple' | 'dropdown' | 'version_control' | 'transformer_control' | 'signature_control' | 'crane_control' | 'safety_equipment_control' | 'bearing_control' | 'final_checkout_control' | 'standard';
      inputCount?: number;
      unit?: string;
      minLimit?: number;
      maxLimit?: number;
      dropdownOptions?: string[];
      criticalOptions?: string[];
      versionItems?: { label: string; expected: string }[];
      measurementLabels?: string[];
      requireSignature?: boolean;
      safetyEquipmentType?: 'first_aid' | 'fire_extinguisher';
    };
    measurementValues?: string[];
  }[];
  instructionCode?: string;
}

class MaintenanceService {
  private templates: MaintenanceTemplate[] = [];

  async fetchTemplates(forceRefresh = false) {
    const cacheKey = 'maintenance_templates_cache';
    
    // Quick offline fallback
    if (!navigator.onLine) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          console.log("Offline mode: loaded templates from localStorage.");
          this.templates = JSON.parse(cached);
          return this.templates;
        } catch (e) {
          console.error("Error parsing cached templates:", e);
        }
      }
    }

    if (this.templates.length > 0 && !forceRefresh) return this.templates;
    try {
      const q = collection(db, 'maintenance_templates');
      const snapshot = await getDocs(q);
      this.templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceTemplate));
      
      // Update cache
      localStorage.setItem(cacheKey, JSON.stringify(this.templates));

      // Only attempt default initialization/sync if we are online!
      if (navigator.onLine) {
        try {
          await this.initializeDefaultTemplates();
          // Update cache again after default templates are initialized
          localStorage.setItem(cacheKey, JSON.stringify(this.templates));
        } catch (initError) {
          console.error("Error initializing default templates:", initError);
        }
      }
      
      return this.templates;
    } catch (error) {
      console.error("Error fetching maintenance templates from Firestore:", error);
      // Try to load from localStorage cache as a second fallback if Firestore failed
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          this.templates = JSON.parse(cached);
          return this.templates;
        } catch (e) {
          // ignore
        }
      }
      return [];
    }
  }

  private async initializeDefaultTemplates() {
    const existingIds = new Set(this.templates.map(t => t.id));

    const defaults: { name: string; icon: string; category: MaintenanceTemplate['category']; turbineModel: MaintenanceTemplate['turbineModel']; id: string; instructionCode?: string; materials?: any[]; checklist?: any[]; }[] = [
      // User Request: E44-E48 Yağlama bakımı
      { id: 'e44-e48-ya-lama', name: 'E44-E48 Yağlama bakımı', icon: '🛠️', category: 'YAĞLAMA', turbineModel: 'E44-E48', instructionCode: 'TD-esc-08-de-tr-11-017 Rev004 Yağlama bakımı E-44, E-48, E-53' },
      // User Request: E44-E48 Ana bakım
      { id: 'e44-e48-ana-bakim', name: 'E44-E48 Ana bakım', icon: '📋', category: 'ANA', turbineModel: 'E44-E48', instructionCode: 'TD-esc-08-de-tr-15-090 Rev011 Ana bakım E-44 - E48 (CS48a)' },
      // User Request: E44-E48 4 yıllık ana bakım
      { id: 'e44-e48-4-yillik', name: 'E44-E48 4 Yıllık Ana Bakım', icon: '⏳', category: '4YIL', turbineModel: 'E44-E48', instructionCode: '' },
      // User Request: E70 Serisi
      { id: 'e70-ya-lama', name: 'E70 Yağlama bakımı', icon: '🛠️', category: 'YAĞLAMA', turbineModel: 'E70', instructionCode: '' },
      { id: 'e70-ana-bakim', name: 'E70 Ana Bakım', icon: '📋', category: 'ANA', turbineModel: 'E70', instructionCode: '' },
      { id: 'e70-4-yillik', name: 'E70 4 Yıllık Bakım', icon: '⏳', category: '4YIL', turbineModel: 'E70', instructionCode: '' },
      // User Request: E82 Serisi
      { id: 'e82-ya-lama', name: 'E82 Yağlama bakımı', icon: '🛠️', category: 'YAĞLAMA', turbineModel: 'E82', instructionCode: '' },
      { id: 'e82-ana-bakim', name: 'E82 Ana Bakım', icon: '📋', category: 'ANA', turbineModel: 'E82', instructionCode: '' },
      { id: 'e82-4-yillik', name: 'E82 4 Yıllık Bakım', icon: '⏳', category: '4YIL', turbineModel: 'E82', instructionCode: '' },
      // User Request: E82/E2 Serisi
      { id: 'e82-e2-ya-lama', name: 'E82/E2 Yağlama bakımı', icon: '🛠️', category: 'YAĞLAMA', turbineModel: 'E82/E2', instructionCode: '' },
      { id: 'e82-e2-ana-bakim', name: 'E82/E2 Ana Bakım', icon: '📋', category: 'ANA', turbineModel: 'E82/E2', instructionCode: '' },
      { id: 'e82-e2-4-yillik', name: 'E82/E2 4 Yıllık Bakım', icon: '⏳', category: '4YIL', turbineModel: 'E82/E2', instructionCode: '' },
      // User Request: E92 Serisi
      { id: 'e92-ya-lama', name: 'E92 Yağlama bakımı', icon: '🛠️', category: 'YAĞLAMA', turbineModel: 'E92', instructionCode: '' },
      { id: 'e92-ana-bakim', name: 'E92 Ana Bakım', icon: '📋', category: 'ANA', turbineModel: 'E92', instructionCode: '' },
      { id: 'e92-4-yillik', name: 'E92 4 Yıllık Bakım', icon: '⏳', category: '4YIL', turbineModel: 'E92', instructionCode: '' },
      // User Request: Global Bakımlar
      { id: 'global-ruzgar-bakimi', name: 'Rüzgar Bakımı', icon: '🌬️', category: 'OTHER', turbineModel: 'GLOBAL', instructionCode: '' },
      { 
        id: 'generator-kontrol', 
        name: 'Jeneratör Genel Durum Tespiti', 
        icon: '⚡', 
        category: 'OTHER', 
        turbineModel: 'GLOBAL', 
        instructionCode: 'TD-esc-03-de-tr-15-009 Rev001',
        materials: [],
        checklist: [
          // 3 Jeneratör verileri
          { id: 'gen1', text: 'Jeneratör versiyonu / Jeneratör tipi', category: '3. Jeneratör Verileri', requiresMeasurement: false },
          { id: 'gen2', text: 'Rotor / Stator Numarası ve Üretim Yılı', category: '3. Jeneratör Verileri', requiresMeasurement: false },
          { id: 'gen3', text: 'Stator sıcaklığı ve Rotor sıcaklığı (°C)', category: '3. Jeneratör Verileri', requiresMeasurement: true, measurementConfig: { type: 'numeric_multiple', unit: '°C', inputCount: 2, measurementLabels: ['Stator Sıcaklığı', 'Rotor Sıcaklığı'] } },
          { id: 'gen4', text: 'Soğutma konsepti veya fan varyantı / Fan adedi', category: '3. Jeneratör Verileri', requiresMeasurement: false },
          // 4 İki sistemli bir jeneratörde polarizasyon indeksi (PI) ölçümü
          { id: 'gen5', text: 'Sistem 1 toprağa (PE) karşı PI Ölçümü', category: '4. İki Sistemli PI Ölçümü', requiresMeasurement: true, measurementConfig: { type: 'numeric_multiple', unit: 'MΩ / PI', inputCount: 3, measurementLabels: ['Direnç 1 dakika (MΩ)', 'Direnç 10 dakika (MΩ)', 'PI-değeri'] } },
          { id: 'gen6', text: 'Sistem 2 toprağa (PE) karşı PI Ölçümü', category: '4. İki Sistemli PI Ölçümü', requiresMeasurement: true, measurementConfig: { type: 'numeric_multiple', unit: 'MΩ / PI', inputCount: 3, measurementLabels: ['Direnç 1 dakika (MΩ)', 'Direnç 10 dakika (MΩ)', 'PI-değeri'] } },
          { id: 'gen7', text: 'Sistem 1 Sistem 2\'ye karşı PI Ölçümü', category: '4. İki Sistemli PI Ölçümü', requiresMeasurement: true, measurementConfig: { type: 'numeric_multiple', unit: 'MΩ / PI', inputCount: 3, measurementLabels: ['Direnç 1 dakika (MΩ)', 'Direnç 10 dakika (MΩ)', 'PI-değeri'] } },
          // 8 Stator genel durum tespiti
          { id: 'gen8', text: 'Köprülenmiş bobin(ler) (Varsa adet yazın)', category: '8. Stator Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Evet'], criticalOptions: ['Evet'] } },
          { id: 'gen9', text: 'Değiştirilen bobin(ler) (Varsa adet yazın)', category: '8. Stator Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Evet'], criticalOptions: ['Evet'] } },
          { id: 'gen10', text: 'Toprak arızası / Kısa devre / Fazdan faza kısa devre (Varsa etkilenen bobin sayısı)', category: '8. Stator Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Evet'], criticalOptions: ['Evet'] } },
          { id: 'gen11', text: 'Sac paketi hasarlı', category: '8. Stator Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Deforme olmuş', 'Taşlanmış', 'Saclar çözülmüş', 'Diğer'], criticalOptions: ['Deforme olmuş', 'Taşlanmış', 'Saclar çözülmüş', 'Diğer'] } },
          { id: 'gen12', text: 'Çift kaplamalı tel', category: '8. Stator Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Evet', 'Kesit hasarlı', 'Bölünmüş', 'Erimiş'], criticalOptions: ['Kesit hasarlı', 'Bölünmüş', 'Erimiş'] } },
          // 9 Rotor genel durum tespiti
          { id: 'gen13', text: 'Köprülenmiş kutup pabuçları (Varsa adet yazın)', category: '9. Rotor Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Evet'], criticalOptions: ['Evet'] } },
          { id: 'gen14', text: 'Toprak arızası (Varsa etkilenen kutup pabucu sayısı)', category: '9. Rotor Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Evet'], criticalOptions: ['Evet'] } },
          { id: 'gen15', text: 'Kutup pabucu taşlanmış (Varsa etkilenen kutup pabucu sayısı)', category: '9. Rotor Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Evet'], criticalOptions: ['Evet'] } },
          // 10 Stator/rotor genel durum tespiti
          { id: 'gen16', text: 'Hava aralığında (gap) sorunlar', category: '10. Stator/Rotor Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Evet'], criticalOptions: ['Evet'] } },
          { id: 'gen17', text: 'Jeneratör muhafazası hasarlı', category: '10. Stator/Rotor Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Evet'], criticalOptions: ['Evet'] } },
          { id: 'gen18', text: 'Hava dolaşım sistemi / Su soğutma sistemi hatalı', category: '10. Stator/Rotor Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Evet'], criticalOptions: ['Evet'] } },
          { id: 'gen19', text: 'Kirlenmeler', category: '10. Stator/Rotor Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Düşük', 'Orta', 'Şiddetli'], criticalOptions: ['Orta', 'Şiddetli'] } },
          { id: 'gen20', text: 'Pas / Korozyon', category: '10. Stator/Rotor Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Düşük', 'Orta', 'Şiddetli'], criticalOptions: ['Orta', 'Şiddetli'] } },
          { id: 'gen21', text: 'Boyanma / Termik arızalar', category: '10. Stator/Rotor Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Evet'], criticalOptions: ['Evet'] } },
          { id: 'gen22', text: 'Boya hasarları', category: '10. Stator/Rotor Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Düşük', 'Orta', 'Şiddetli'], criticalOptions: ['Orta', 'Şiddetli'] } },
          { id: 'gen23', text: 'Jeneratör daha önce temizlendi ve boyandı (Evet ise tarih belirtin)', category: '10. Stator/Rotor Genel Durum Tespiti', requiresMeasurement: true, measurementConfig: { type: 'dropdown', dropdownOptions: ['Hayır', 'Evet'] } },
          // 11 Diğer eksiklikler ve 12 Resimler
          { id: 'gen24', text: 'Diğer eksiklikler ve Saptanan arızaların resimleri (Zorunlu Fotoğraf)', category: '11. Diğer Eksiklikler', requiredPhoto: true }
        ]
      },
      { 
        id: 'form-ariza', 
        name: 'Arıza Formu', 
        icon: '⚠️', 
        category: 'OTHER', 
        turbineModel: 'GLOBAL', 
        instructionCode: 'DH-FRM-01-ARIZA',
        materials: [
          { sapNo: '', quantity: 0, description: '', type: 'S' },
          { sapNo: '', quantity: 0, description: '', type: 'T' }
        ],
        checklist: [
          { id: 'c1', text: 'SERVİS AYRINTILARI KONTROLÜ', category: 'GENEL' },
          { id: 'c2', text: 'ÇALIŞMA ZAMANLARI GİRİŞİ', category: 'GENEL' },
          { id: 'c3', text: 'YAPILAN İŞLEMLER VE FOTOĞRAFLAR', category: 'GENEL' },
          { id: 'c4', text: 'MALZEME YÖNETİMİ VE MÇF KAYDI', category: 'GENEL' }
        ]
      }
    ];

    let hasNew = false;

    for (const t of defaults) {
      if (!existingIds.has(t.id)) {
        const { id, ...data } = t;
        // Arıza formu için boş ama hazır bir yapı kur
        if (id === 'form-ariza') {
          await setDoc(doc(db, 'maintenance_templates', id), { ...data, materials: t.materials || [], checklist: t.checklist || [] });
        } else {
          await setDoc(doc(db, 'maintenance_templates', id), { ...data, materials: t.materials || [], checklist: t.checklist || [] });
        }
        hasNew = true;
      } else if (t.id !== 'form-ariza') {
        const existing = this.templates.find(temp => temp.id === t.id);
        const needsUpdate = existing && (
          existing.turbineModel !== t.turbineModel ||
          existing.name === 'E44-E48 Ana bakım Talimatı' ||
          (t.id === 'generator-kontrol' && existing.instructionCode !== 'TD-esc-03-de-tr-15-009 Rev001')
        );
        if (needsUpdate) {
          // Mevcut şablonların sadece model bilgisini güncelle
          // Eğer generator-kontrol ise ve checklist boşsa checklist'i de güncelle
          const updatePayload: any = { 
            turbineModel: t.turbineModel,
            name: t.name
          };
          if (t.id === 'generator-kontrol') {
            updatePayload.checklist = t.checklist;
          }
          await updateDoc(doc(db, 'maintenance_templates', t.id), updatePayload);
          hasNew = true;
        }
      }
    }
    // --- FORCE UPDATES REMOVED TO ALLOW USER CUSTOMIZATION ---


    if (hasNew) {
      const q = collection(db, 'maintenance_templates');
      const snapshot = await getDocs(q);
      this.templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceTemplate));
    }
  }

  async getTemplate(id: string) {
    if (this.templates.length === 0) await this.fetchTemplates();
    return this.templates.find(t => t.id === id);
  }

  async updateTemplate(id: string, data: Partial<MaintenanceTemplate>) {
    const cleanData = JSON.parse(JSON.stringify(data));
    await updateDoc(doc(db, 'maintenance_templates', id), cleanData);
    await this.fetchTemplates(true);
  }

  async duplicateTemplate(sourceId: string) {
    const source = await this.getTemplate(sourceId);
    if (!source) throw new Error("Kaynak şablon bulunamadı");

    const newId = `${sourceId}-copy-${Date.now()}`;
    const newData = {
      ...source,
      name: `${source.name} (KOPYA)`,
      id: newId
    };

    const { id, ...dataToSave } = newData;
    await setDoc(doc(db, 'maintenance_templates', newId), dataToSave);
    await this.fetchTemplates(true);
    return newId;
  }

  async createEmptyTemplate() {
    const newId = `custom-template-${Date.now()}`;
    const newTemplate: Omit<MaintenanceTemplate, 'id'> = {
      name: 'YENİ ŞABLON',
      icon: '📄',
      category: 'OTHER',
      turbineModel: 'GLOBAL',
      materials: [],
      checklist: [],
      instructionCode: ''
    };

    await setDoc(doc(db, 'maintenance_templates', newId), newTemplate);
    await this.fetchTemplates(true);
    return newId;
  }

  async deleteTemplate(id: string) {
    await deleteDoc(doc(db, 'maintenance_templates', id));
    await this.fetchTemplates(true);
  }
}

export const maintenanceService = new MaintenanceService();
