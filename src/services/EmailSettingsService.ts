import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export interface EmailRecipientsConfig {
  reportEmails: string[];
  teamRepairEmails: string[];
  dispatchEmails: string[];
  damageReturnEmails: string[];
  auditReportEmails: string[];
  auditApprovalEmails: string[];
  auditRevisionEmails: string[];
  updatedAt?: any;
  updatedBy?: string;
}

export interface EmailOperationMeta {
  key: keyof Omit<EmailRecipientsConfig, 'updatedAt' | 'updatedBy'>;
  title: string;
  category: 'Servis & Saha Raporları' | 'Malzeme & Atölye Hareketleri' | 'Depo Sayım & Denetim';
  description: string;
  triggerDetail: string;
  icon: string;
  badgeColor: string;
  defaultRecipients: string[];
}

export const DEFAULT_EMAIL_RECIPIENTS: Omit<EmailRecipientsConfig, 'updatedAt' | 'updatedBy'> = {
  reportEmails: ['servis.rapor@demirerholding.com'],
  teamRepairEmails: [
    'fatih.zebek@demirerholding.com',
    'emir.unver@demirerholding.com',
    'hursit.akter@demirerholding.com'
  ],
  dispatchEmails: [
    'fatih.zebek@demirerholding.com',
    'emir.unver@demirerholding.com',
    'hursit.akter@demirerholding.com'
  ],
  damageReturnEmails: [
    'fatih.zebek@demirerholding.com',
    'emir.unver@demirerholding.com',
    'hursit.akter@demirerholding.com'
  ],
  auditReportEmails: [
    'fatih.zebek@demirerholding.com',
    'hursit.akter@demirerholding.com',
    'emir.unver@demirerholding.com'
  ],
  auditApprovalEmails: [
    'fatih.zebek@demirerholding.com',
    'hursit.akter@demirerholding.com',
    'emir.unver@demirerholding.com'
  ],
  auditRevisionEmails: [
    'fatih.zebek@demirerholding.com',
    'hursit.akter@demirerholding.com',
    'emir.unver@demirerholding.com'
  ]
};

export const EMAIL_OPERATIONS_META: EmailOperationMeta[] = [
  {
    key: 'reportEmails',
    title: 'Servis Raporları (Arıza & Bakım)',
    category: 'Servis & Saha Raporları',
    description: 'Sahada tamamlanan arıza ve periyodik bakım raporlarının resmi A4 PDF ekiyle birlikte iletilmesi.',
    triggerDetail: 'Teknisyen raporu tamamlayıp kaydettiğinde veya arşivden tekrar gönderildiğinde tetiklenir.',
    icon: 'fa-file-lines',
    badgeColor: '#00F2FE',
    defaultRecipients: DEFAULT_EMAIL_RECIPIENTS.reportEmails
  },
  {
    key: 'teamRepairEmails',
    title: 'Saha İçi Onarım / Malzeme Bakım Formu',
    category: 'Servis & Saha Raporları',
    description: 'Sahada teknisyenler tarafından yerinde onarımı tamamlanan malzemelerin tutanağı ve A4 PDF formu.',
    triggerDetail: 'Depo ekranında saha içi onarım durumundaki malzeme "Onarımı Tamamla" ile bitirildiğinde tetiklenir.',
    icon: 'fa-screwdriver-wrench',
    badgeColor: '#14F195',
    defaultRecipients: DEFAULT_EMAIL_RECIPIENTS.teamRepairEmails
  },
  {
    key: 'dispatchEmails',
    title: 'Malzeme Sevk Formu (MSF) / Transferler',
    category: 'Malzeme & Atölye Hareketleri',
    description: 'Merkez Tamir Atölyesi (MTA) veya depolardan sahalara sevk edilen malzemelerin resmi sevk irsaliyesi.',
    triggerDetail: 'Malzeme sevk işlemi yapılıp resmi sevk formu oluşturulduğunda A4 PDF eki ile iletilir.',
    icon: 'fa-truck-fast',
    badgeColor: '#A78BFA',
    defaultRecipients: DEFAULT_EMAIL_RECIPIENTS.dispatchEmails
  },
  {
    key: 'damageReturnEmails',
    title: 'Malzeme Hasar & İade Tutanağı',
    category: 'Malzeme & Atölye Hareketleri',
    description: 'Sahaya ulaşan malzemelerde hasar tespit edilip MTA\'ya iade tutanağı düzenlendiğinde iletilir.',
    triggerDetail: 'Depo sorumlusu veya teknisyen hasar/uygunsuzluk gerekçesiyle iade başlattığında tetiklenir.',
    icon: 'fa-triangle-exclamation',
    badgeColor: '#F43F5E',
    defaultRecipients: DEFAULT_EMAIL_RECIPIENTS.damageReturnEmails
  },
  {
    key: 'auditReportEmails',
    title: 'Depo Sayım Raporu & Fark Detayları',
    category: 'Depo Sayım & Denetim',
    description: 'Depolarda fiziki sayım tamamlanıp raporlandığında tüm stok uyum, fazla ve eksik dökümü.',
    triggerDetail: 'Sayım personeli "Sayımı Tamamla ve Raporla" butonuna bastığında otomatik gönderilir.',
    icon: 'fa-clipboard-check',
    badgeColor: '#38BDF8',
    defaultRecipients: DEFAULT_EMAIL_RECIPIENTS.auditReportEmails
  },
  {
    key: 'auditApprovalEmails',
    title: 'Depo Sayım Onay Bildirimi',
    category: 'Depo Sayım & Denetim',
    description: 'Yönetici depo sayımını onayladığında sayımı yapan personele ve yöneticilere nihai sonuç bildirimi.',
    triggerDetail: 'Yönetici sayım ekranında "Sayımı Onayla" butonuna bastığında tetiklenir (+ sayımı yapan kişi).',
    icon: 'fa-circle-check',
    badgeColor: '#10B981',
    defaultRecipients: DEFAULT_EMAIL_RECIPIENTS.auditApprovalEmails
  },
  {
    key: 'auditRevisionEmails',
    title: 'Depo Sayım Düzeltme / Yeniden Kontrol Talebi',
    category: 'Depo Sayım & Denetim',
    description: 'Yönetici sayımda tutarsızlık görüp düzeltme ve yeniden kontrol talep ettiğinde iletilen yönerge.',
    triggerDetail: 'Yönetici "Düzeltme İste" dediğinde düzeltme notu ile birlikte gönderilir (+ sayımı yapan kişi).',
    icon: 'fa-rotate-left',
    badgeColor: '#F59E0B',
    defaultRecipients: DEFAULT_EMAIL_RECIPIENTS.auditRevisionEmails
  }
];

class EmailSettingsService {
  private readonly collectionName = 'system_settings';
  private readonly docId = 'email_recipients';
  private cachedConfig: EmailRecipientsConfig | null = null;
  private lastFetchTime = 0;
  private readonly CACHE_TTL = 30000; // 30 seconds memory cache

  /**
   * Loads current email recipients configuration from Firestore with in-memory caching and fallback defaults.
   */
  async getConfig(forceRefresh = false): Promise<EmailRecipientsConfig> {
    const now = Date.now();
    if (!forceRefresh && this.cachedConfig && (now - this.lastFetchTime < this.CACHE_TTL)) {
      return { ...this.cachedConfig };
    }

    try {
      const docRef = doc(db, this.collectionName, this.docId);
      const snapshot = await getDoc(docRef);

      if (snapshot.exists()) {
        const data = snapshot.data() as Partial<EmailRecipientsConfig>;
        this.cachedConfig = {
          reportEmails: this.normalizeList(data.reportEmails, DEFAULT_EMAIL_RECIPIENTS.reportEmails),
          teamRepairEmails: this.normalizeList(data.teamRepairEmails, DEFAULT_EMAIL_RECIPIENTS.teamRepairEmails),
          dispatchEmails: this.normalizeList(data.dispatchEmails, DEFAULT_EMAIL_RECIPIENTS.dispatchEmails),
          damageReturnEmails: this.normalizeList(data.damageReturnEmails, DEFAULT_EMAIL_RECIPIENTS.damageReturnEmails),
          auditReportEmails: this.normalizeList(data.auditReportEmails, DEFAULT_EMAIL_RECIPIENTS.auditReportEmails),
          auditApprovalEmails: this.normalizeList(data.auditApprovalEmails, DEFAULT_EMAIL_RECIPIENTS.auditApprovalEmails),
          auditRevisionEmails: this.normalizeList(data.auditRevisionEmails, DEFAULT_EMAIL_RECIPIENTS.auditRevisionEmails),
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy
        };
        this.lastFetchTime = now;
        return { ...this.cachedConfig };
      }
    } catch (err) {
      console.warn('[EmailSettingsService] Firestore alıcı listesi okunamadı, varsayılanlar devrede:', err);
    }

    // Fallback to default configuration
    return {
      ...DEFAULT_EMAIL_RECIPIENTS,
      updatedBy: 'Sistem Varsayılanları'
    };
  }

  /**
   * Returns active recipient list for a specific email trigger.
   */
  async getRecipients(key: keyof Omit<EmailRecipientsConfig, 'updatedAt' | 'updatedBy'>): Promise<string[]> {
    const config = await this.getConfig();
    const list = config[key];
    if (Array.isArray(list) && list.length > 0) {
      return list;
    }
    return DEFAULT_EMAIL_RECIPIENTS[key] || [];
  }

  /**
   * Saves updated email recipients configuration to Firestore.
   */
  async saveConfig(
    updatedConfig: Partial<Omit<EmailRecipientsConfig, 'updatedAt' | 'updatedBy'>>,
    userEmail: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const docRef = doc(db, this.collectionName, this.docId);
      const payload: EmailRecipientsConfig = {
        reportEmails: this.cleanList(updatedConfig.reportEmails ?? DEFAULT_EMAIL_RECIPIENTS.reportEmails),
        teamRepairEmails: this.cleanList(updatedConfig.teamRepairEmails ?? DEFAULT_EMAIL_RECIPIENTS.teamRepairEmails),
        dispatchEmails: this.cleanList(updatedConfig.dispatchEmails ?? DEFAULT_EMAIL_RECIPIENTS.dispatchEmails),
        damageReturnEmails: this.cleanList(updatedConfig.damageReturnEmails ?? DEFAULT_EMAIL_RECIPIENTS.damageReturnEmails),
        auditReportEmails: this.cleanList(updatedConfig.auditReportEmails ?? DEFAULT_EMAIL_RECIPIENTS.auditReportEmails),
        auditApprovalEmails: this.cleanList(updatedConfig.auditApprovalEmails ?? DEFAULT_EMAIL_RECIPIENTS.auditApprovalEmails),
        auditRevisionEmails: this.cleanList(updatedConfig.auditRevisionEmails ?? DEFAULT_EMAIL_RECIPIENTS.auditRevisionEmails),
        updatedAt: serverTimestamp(),
        updatedBy: userEmail || 'Admin'
      };

      await setDoc(docRef, payload, { merge: true });

      // Update in-memory cache
      this.cachedConfig = {
        ...payload,
        updatedAt: new Date()
      };
      this.lastFetchTime = Date.now();

      return {
        success: true,
        message: 'E-posta dağıtım listeleri başarıyla kaydedildi.'
      };
    } catch (err: any) {
      console.error('[EmailSettingsService] Kayıt hatası:', err);
      return {
        success: false,
        message: `Kayıt başarısız: ${err?.message || err}`
      };
    }
  }

  private normalizeList(val: any, fallback: string[]): string[] {
    if (Array.isArray(val) && val.length > 0) {
      return this.cleanList(val);
    }
    return [...fallback];
  }

  private cleanList(emails: string[]): string[] {
    if (!Array.isArray(emails)) return [];
    const unique = new Set<string>();
    emails.forEach(e => {
      if (typeof e === 'string') {
        const trimmed = e.trim().toLowerCase();
        if (trimmed && trimmed.includes('@') && trimmed.includes('.')) {
          unique.add(trimmed);
        }
      }
    });
    return Array.from(unique);
  }
}

export const emailSettingsService = new EmailSettingsService();
