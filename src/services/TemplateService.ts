export interface TemplateField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'textarea';
  required: boolean;
  options?: string[];
  placeholder?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  category: 'ARIZA' | 'BAKIM';
  description: string;
  fields: TemplateField[];
}

class TemplateService {
  private templates: ReportTemplate[] = [
    {
      id: 'fault-standard',
      name: 'Türbin Arıza Formu',
      category: 'ARIZA',
      description: 'Depo entegrasyonu, stok düşüm algoritması ve detaylı zaman yönetimi içeren gelişmiş servis formu.',
      fields: [
        { id: 'advanced_logic', label: 'Gelişmiş Servis Algoritması', type: 'text', required: true },
        { id: 'warehouse_sync', label: 'Depo & Stok Senkronizasyonu', type: 'text', required: true },
        { id: 'time_management', label: 'Zaman Yönetimi & Downtime', type: 'text', required: true },
        { id: 'personnel_tracking', label: 'Personel & Ekip Takibi', type: 'text', required: true },
        { id: 'image_upload', label: 'Görsel Raporlama', type: 'text', required: true }
      ]
    },
    {
      id: 'maintenance-6m',
      name: '6 Aylık Periyodik Bakım',
      category: 'BAKIM',
      description: 'Yarım yıllık rutin kontrol ve yağlama prosedürü.',
      fields: [
        { id: 'visual_check', label: 'Görsel Kontrol Tamam mı?', type: 'checkbox', required: true },
        { id: 'gearbox_oil', label: 'Gearbox Yağ Seviyesi', type: 'select', required: true, options: ['Normal', 'Eksik', 'Değişim Gerekli'] },
        { id: 'brake_pads', label: 'Fren Balata Durumu', type: 'text', required: true },
        { id: 'generator_temp', label: 'Jeneratör Sıcaklığı (C°)', type: 'number', required: true }
      ]
    },
    {
      id: 'oil-change',
      name: 'Yağ Değişim Prosedürü',
      category: 'BAKIM',
      description: 'Şanzıman ve hidrolik ünite yağ değişim formu.',
      fields: [
        { id: 'oil_type', label: 'Kullanılan Yağ Tipi', type: 'text', required: true },
        { id: 'amount', label: 'Miktar (Litre)', type: 'number', required: true },
        { id: 'filter_changed', label: 'Filtre Değiştirildi mi?', type: 'checkbox', required: true }
      ]
    }
  ];

  getTemplates(): ReportTemplate[] {
    return this.templates;
  }

  getTemplateById(id: string): ReportTemplate | undefined {
    return this.templates.find(t => t.id === id);
  }
}

export const templateService = new TemplateService();
