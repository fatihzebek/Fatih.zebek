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
  }[];
  instructionCode?: string;
}

class MaintenanceService {
  private templates: MaintenanceTemplate[] = [];

  async fetchTemplates() {
    try {
      const q = collection(db, 'maintenance_templates');
      const snapshot = await getDocs(q);
      this.templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MaintenanceTemplate));
      
      // Kritik şablonların varlığından emin ol
      await this.initializeDefaultTemplates();
      
      return this.templates;
    } catch (error) {
      console.error("Error fetching maintenance templates:", error);
      return [];
    }
  }

  private async initializeDefaultTemplates() {
    const existingIds = new Set(this.templates.map(t => t.id));

    const defaults: { name: string; icon: string; category: MaintenanceTemplate['category']; turbineModel: MaintenanceTemplate['turbineModel']; id: string; instructionCode?: string }[] = [
      { id: 'e44-e48-ya-lama-bak-m-', name: 'E44 - E48 Yağlama Bakımı', icon: '🛠️', category: 'YAĞLAMA', turbineModel: 'E44-E48', instructionCode: 'TD-esc-08-de-tr-11-017 Rev004 Yağlama bakımı E-44, E-48, E-53' },
      { id: 'e44-e48-ana-bak-m', name: 'E44 - E48 Ana Bakım', icon: '⚙️', category: 'ANA', turbineModel: 'E44-E48', instructionCode: 'TD-esc-08-de-tr-15-090 Rev011 Ana bakım E-44 - E48 (CS48a)' },
      { id: 'e44-e48-4-y-ll-k-bak-m', name: 'E44 - E48 4 Yıllık Bakım', icon: '📅', category: '4YIL', turbineModel: 'E44-E48' },
      
      { id: 'e82---ya-lama-bak-m-', name: 'E82 - Yağlama Bakımı', icon: '🛠️', category: 'YAĞLAMA', turbineModel: 'E82', instructionCode: 'TD-esc-08-de-tr-14-018 Rev003 Yağlama bakımı E-82' },
      { id: 'e82---ana-bak-m', name: 'E82 - Ana Bakım', icon: '⚙️', category: 'ANA', turbineModel: 'E82', instructionCode: 'D0847068_8.0_tr_Ana bakım E-82 (CS82a)' },
      { id: 'e82-4-y-ll-k-ana-bak-m', name: 'E82 4 Yıllık Ana Bakım', icon: '📅', category: '4YIL', turbineModel: 'E82' },

      { id: 'e70---ya-lama-bak-m-', name: 'E70 - Yağlama Bakımı', icon: '🛠️', category: 'YAĞLAMA', turbineModel: 'E70', instructionCode: 'TD-esc-08-de-tr-10-052 Rev005 Yağlama bakımı E-70 E4, E-70 E4-2, E-70 E4-3' },
      { id: 'e70---ana-bak-m', name: 'E70 - Ana Bakım', icon: '⚙️', category: 'ANA', turbineModel: 'E70', instructionCode: 'D0847062_8.0_tr_Ana bakım E-70 E4 (CS82a)' },
      { id: 'e70-4-y-ll-k-ana-bak-m', name: 'E70 - 4 Yıllık Ana Bakım', icon: '📅', category: '4YIL', turbineModel: 'E70' },

      { id: 'e82-e2-ya-lama-bak-m-', name: 'E82/E2 Yağlama Bakımı', icon: '🛠️', category: 'YAĞLAMA', turbineModel: 'E82/E2', instructionCode: 'TD-esc-08-de-tr-11-002 Rev004 Yağlama bakımı E-82 E2' },
      { id: 'e82-e2-ana-bak-m', name: 'E82/E2 Ana Bakım', icon: '⚙️', category: 'ANA', turbineModel: 'E82/E2', instructionCode: 'D0847069_8.0_tr_Ana bakım E-82 E2 (CS82a)' },
      { id: 'e82-e2-4-y-ll-k-ana-bak-m', name: 'E82/E2 4 Yıllık Ana Bakım', icon: '📅', category: '4YIL', turbineModel: 'E82/E2' },

      { id: 'e92-ya-lama-bak-m-', name: 'E92 Yağlama Bakımı', icon: '🛠️', category: 'YAĞLAMA', turbineModel: 'E92' },
      { id: 'e92-ana-bak-m', name: 'E92 Ana Bakım', icon: '⚙️', category: 'ANA', turbineModel: 'E92' },
      { id: 'e92-4-y-ll-k-ana-bak-m', name: 'E92 4 Yıllık Ana Bakım', icon: '📅', category: '4YIL', turbineModel: 'E92' },

      { id: 'r-zgar-bak-mlar-', name: 'Rüzgar Bakımları', icon: '🌬️', category: 'OTHER', turbineModel: 'GLOBAL' },
    ];

    let hasNew = false;

    // Cleanup unwanted Arıza templates
    const unwantedIds = ['e44-e48-ariza', 'e70-ariza', 'e82-ariza', 'e82-e2-ariza'];
    for (const uId of unwantedIds) {
      if (existingIds.has(uId)) {
        await deleteDoc(doc(db, 'maintenance_templates', uId));
        hasNew = true;
      }
    }
    
    // Özel Arıza Müdahale Formu İşlemi
    if (!existingIds.has('form-ariza')) {
      const arizaTemplate = {
        name: 'Arıza Müdahale Formu',
        icon: '🛠️',
        category: 'OTHER',
        turbineModel: 'GLOBAL',
        materials: [],
        checklist: [
          { id: 'step-1', text: 'İş Sağlığı ve Güvenliği Önlemlerinin Alınması', category: 'Güvenlik' },
          { id: 'step-2', text: 'Arıza Kodunun ve Scada Verilerinin İncelenmesi', category: 'Analiz' },
          { id: 'step-3', text: 'Saha/Türbin Görsel Kontrolleri (Sızıntı, Mekanik Hasar vb.)', category: 'Kontrol' },
          { id: 'step-4', text: 'Parametre ve Yazılım Kontrolleri', category: 'Teknik' },
          { id: 'step-5', text: 'Sistem Testi ve Resetleme İşlemi', category: 'Uygulama' },
          { id: 'step-6', text: 'Türbinin Devreye Alınması ve İzlenmesi', category: 'Sonuç' }
        ]
      };
      await setDoc(doc(db, 'maintenance_templates', 'form-ariza'), arizaTemplate);
      hasNew = true;
    }

    for (const t of defaults) {
      if (!existingIds.has(t.id)) {
        const { id, ...data } = t;
        await setDoc(doc(db, 'maintenance_templates', id), { ...data, materials: [], checklist: [] });
        hasNew = true;
      } else {
        // Ensure instructionCode is updated even for existing templates
        await updateDoc(doc(db, 'maintenance_templates', t.id), { instructionCode: t.instructionCode || '' });
      }
    }

    // --- FORCE UPDATES REMOVED TO ALLOW USER CUSTOMIZATION ---
    hasNew = true;

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
    await updateDoc(doc(db, 'maintenance_templates', id), data);
    await this.fetchTemplates();
  }
}

export const maintenanceService = new MaintenanceService();
