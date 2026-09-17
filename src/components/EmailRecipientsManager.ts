import { emailSettingsService, EMAIL_OPERATIONS_META, DEFAULT_EMAIL_RECIPIENTS } from '../services/EmailSettingsService';
import type { EmailRecipientsConfig, EmailOperationMeta } from '../services/EmailSettingsService';
import { authService } from '../services/AuthService';

interface PersonnelOption {
  name: string;
  email: string;
}

export class EmailRecipientsManager {
  private containerId: string;
  private users: PersonnelOption[] = [];
  private currentConfig: Partial<EmailRecipientsConfig> = {};
  private originalConfig: Partial<EmailRecipientsConfig> = {};
  private isDirty = false;
  private isSaving = false;

  constructor(containerId: string, users: any[] = []) {
    this.containerId = containerId;
    this.extractUsers(users);
  }

  private extractUsers(rawUsers: any[]) {
    const list: PersonnelOption[] = [];
    const seen = new Set<string>();

    if (Array.isArray(rawUsers)) {
      rawUsers.forEach(u => {
        const email = (u.email || '').trim().toLowerCase();
        if (email && email.includes('@') && !seen.has(email)) {
          seen.add(email);
          const name = u.displayName || u.name || email.split('@')[0];
          list.push({ name, email });
        }
      });
    }

    // Sort alphabetically by name
    list.sort((a, b) => a.name.localeCompare(b.name, 'tr'));
    this.users = list;
  }

  /**
   * Initializes data and renders the view inside container.
   */
  async init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    container.innerHTML = `
      <div style="padding: 2.5rem; text-align: center; color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; margin-bottom: 0.75rem;"></i>
        <div style="font-size: 1.1rem; letter-spacing: 1px;">E-Posta Dağıtım Ayarları Yükleniyor...</div>
      </div>
    `;

    try {
      const config = await emailSettingsService.getConfig(true);
      this.currentConfig = JSON.parse(JSON.stringify(config));
      this.originalConfig = JSON.parse(JSON.stringify(config));
      this.isDirty = false;
      this.render();
    } catch (err) {
      console.error('[EmailRecipientsManager] Yükleme hatası:', err);
      container.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #f43f5e; font-family: 'Rajdhani', sans-serif;">
          <i class="fa-solid fa-circle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
          <div>Ayarlar yüklenirken bir hata oluştu. Lütfen sayfayı yenileyin.</div>
        </div>
      `;
    }
  }

  /**
   * Renders the complete management UI.
   */
  render() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const categories = [
      { name: 'Servis & Saha Raporları', icon: 'fa-file-shield', color: '#00F2FE' },
      { name: 'Malzeme & Atölye Hareketleri', icon: 'fa-boxes-packing', color: '#A78BFA' },
      { name: 'Depo Sayım & Denetim', icon: 'fa-clipboard-check', color: '#10B981' }
    ] as const;

    const updatedByText = this.currentConfig.updatedBy ? `Son Güncelleyen: ${this.currentConfig.updatedBy}` : '';
    let updatedDateText = '';
    if (this.currentConfig.updatedAt) {
      try {
        const d = this.currentConfig.updatedAt.toDate ? this.currentConfig.updatedAt.toDate() : new Date(this.currentConfig.updatedAt);
        updatedDateText = d.toLocaleString('tr-TR');
      } catch {
        updatedDateText = '';
      }
    }

    container.innerHTML = `
      <div class="erm-container" style="display: flex; flex-direction: column; gap: 1.75rem; font-family: 'Rajdhani', sans-serif;">
        
        <!-- Header Banner -->
        <div style="background: linear-gradient(135deg, rgba(13, 18, 30, 0.95), rgba(18, 26, 43, 0.9)); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 16px; padding: 1.5rem 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.3); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="width: 52px; height: 52px; border-radius: 12px; background: rgba(0, 242, 254, 0.1); border: 1px solid rgba(0, 242, 254, 0.3); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; color: var(--accent-cyan); box-shadow: 0 0 20px rgba(0, 242, 254, 0.2);">
              <i class="fa-solid fa-envelope-open-text"></i>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <h2 style="font-size: 1.4rem; font-weight: 800; color: #fff; margin: 0; letter-spacing: 1.5px; text-transform: uppercase;">
                  E-Posta Dağıtım & Bildirim Merkezi
                </h2>
                ${this.isDirty ? `<span style="background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); color: #f59e0b; font-size: 0.7rem; padding: 2px 8px; border-radius: 6px; font-weight: 800; letter-spacing: 0.5px;">KAYDEDİLMEMİŞ DEĞİŞİKLİKLER</span>` : ''}
              </div>
              <div style="color: #94A3B8; font-size: 0.85rem; margin-top: 4px; font-weight: 500;">
                Sistemde otomatik üretilen resmi rapor, tutanak ve sevk irsaliyelerinin hangi alıcılara iletileceğini buradan yönetebilirsiniz.
              </div>
            </div>
          </div>

          <!-- Save Button (Header) -->
          <div style="display: flex; align-items: center; gap: 12px;">
            ${(updatedByText || updatedDateText) ? `
              <div style="text-align: right; color: #64748B; font-size: 0.75rem; font-weight: 600; line-height: 1.3;">
                ${updatedByText ? `<div>${updatedByText}</div>` : ''}
                ${updatedDateText ? `<div>${updatedDateText}</div>` : ''}
              </div>
            ` : ''}
            <button id="erm-save-top-btn" class="btn-cyber" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: 1px solid rgba(16, 185, 129, 0.5); padding: 0.65rem 1.4rem; border-radius: 8px; font-weight: 800; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);" onclick="window._emailRecipientsManager.save()">
              <i class="fa-solid fa-floppy-disk"></i>
              <span>DEĞİŞİKLİKLERİ KAYDET</span>
            </button>
          </div>
        </div>

        <!-- Privacy Alert Card -->
        <div style="background: rgba(0, 242, 254, 0.04); border-left: 4px solid var(--accent-cyan); border-radius: 8px; padding: 0.9rem 1.25rem; display: flex; align-items: center; gap: 12px; color: #cbd5e1; font-size: 0.85rem;">
          <i class="fa-solid fa-shield-halved" style="color: var(--accent-cyan); font-size: 1.2rem;"></i>
          <div>
            <strong style="color: #fff;">Gizlilik & Güvenlik Koruması Aktif:</strong>
            Sahada rapor veya sevk oluşturan teknisyenler e-postanın kimlere iletildiğini göremez. Ekranda yalnızca 
            <span style="color: var(--accent-cyan); font-weight: 700;">"Rapor ve resmi PDF eki Servis Merkezine iletildi."</span> 
            bilgisi gösterilir. Alıcı listelerini sadece siz bu ekrandan yönetebilirsiniz.
          </div>
        </div>

        <!-- Operations Grouped by Category -->
        <div style="display: flex; flex-direction: column; gap: 2rem;">
          ${categories.map(cat => {
            const items = EMAIL_OPERATIONS_META.filter(m => m.category === cat.name);
            if (items.length === 0) return '';

            return `
              <div class="erm-category-section" style="display: flex; flex-direction: column; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 10px; font-size: 1.15rem; font-weight: 800; color: ${cat.color}; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.5rem; letter-spacing: 1px;">
                  <i class="fa-solid ${cat.icon}"></i>
                  <span>${cat.name.toUpperCase()}</span>
                  <span style="font-size: 0.75rem; background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 12px; color: #94A3B8; font-weight: 600;">
                    ${items.length} İşlem
                  </span>
                </div>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.25rem;">
                  ${items.map(item => this.renderOperationCard(item)).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Bottom Actions Bar -->
        <div style="display: flex; justify-content: flex-end; align-items: center; padding: 1.5rem 0 2rem 0; border-top: 1px solid rgba(255,255,255,0.08); gap: 12px;">
          <button class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.15); padding: 0.65rem 1.2rem; border-radius: 8px; font-weight: 700; font-size: 0.9rem; cursor: pointer;" onclick="window._emailRecipientsManager.resetAllToDefault()">
            <i class="fa-solid fa-rotate-left"></i> Tümünü Varsayılanlara Sıfırla
          </button>
          <button id="erm-save-bottom-btn" class="btn-cyber" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; border: 1px solid rgba(16, 185, 129, 0.5); padding: 0.65rem 1.6rem; border-radius: 8px; font-weight: 800; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 0 20px rgba(16, 185, 129, 0.3);" onclick="window._emailRecipientsManager.save()">
            <i class="fa-solid fa-floppy-disk"></i>
            <span>TÜM DEĞİŞİKLİKLERİ KAYDET</span>
          </button>
        </div>

      </div>
    `;

    // Bind instance to window for click events
    (window as any)._emailRecipientsManager = this;
  }

  /**
   * Renders single operation card.
   */
  private renderOperationCard(item: EmailOperationMeta): string {
    const list: string[] = (this.currentConfig as any)[item.key] || [];

    return `
      <div class="erm-op-card" style="background: rgba(13, 18, 30, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; gap: 1rem; transition: border-color 0.2s, box-shadow 0.2s; box-shadow: 0 4px 15px rgba(0,0,0,0.2);" onmouseover="this.style.borderColor='rgba(0, 242, 254, 0.3)';" onmouseout="this.style.borderColor='rgba(255, 255, 255, 0.08)';">
        
        <!-- Top Info -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(255, 255, 255, 0.04); border: 1px solid ${item.badgeColor}40; display: flex; align-items: center; justify-content: center; color: ${item.badgeColor}; font-size: 1rem;">
                <i class="fa-solid ${item.icon}"></i>
              </div>
              <div>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: #fff; margin: 0; line-height: 1.2;">
                  ${item.title}
                </h3>
              </div>
            </div>
            <span style="font-size: 0.7rem; font-weight: 800; color: ${item.badgeColor}; background: ${item.badgeColor}15; border: 1px solid ${item.badgeColor}30; padding: 2px 8px; border-radius: 6px; white-space: nowrap;">
              ${list.length} Alıcı
            </span>
          </div>

          <div style="color: #94A3B8; font-size: 0.82rem; line-height: 1.4; margin-bottom: 0.4rem;">
            ${item.description}
          </div>

          <div style="color: #64748B; font-size: 0.75rem; display: flex; align-items: center; gap: 5px; font-weight: 600;">
            <i class="fa-solid fa-bolt" style="color: #f59e0b; font-size: 0.7rem;"></i>
            <span>${item.triggerDetail}</span>
          </div>
        </div>

        <!-- Recipients Tags / Chips -->
        <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px; padding: 0.75rem; min-height: 60px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px;">
          ${list.length === 0 ? `
            <div style="color: #64748B; font-size: 0.78rem; font-style: italic;">
              Alıcı tanımlanmamış. Varsayılan adresler geçerlidir.
            </div>
          ` : list.map(email => `
            <span class="erm-chip" style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15); color: #E2E8F0; padding: 3px 8px; border-radius: 6px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 6px; font-weight: 600; letter-spacing: 0.3px;">
              <i class="fa-solid fa-envelope" style="color: ${item.badgeColor}; font-size: 0.7rem;"></i>
              <span>${email}</span>
              <button style="background: transparent; border: none; color: #94A3B8; cursor: pointer; padding: 0 2px; font-size: 0.85rem; line-height: 1; transition: color 0.15s;" onmouseover="this.style.color='#f43f5e'" onmouseout="this.style.color='#94A3B8'" onclick="window._emailRecipientsManager.removeRecipient('${item.key}', '${email}')" title="Listeden Çıkar">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </span>
          `).join('')}
        </div>

        <!-- Add Recipient Controls -->
        <div style="display: flex; flex-direction: column; gap: 6px;">
          <!-- Quick Dropdown from Registered Personnel -->
          <div style="display: flex; gap: 6px;">
            <select id="erm-select-${item.key}" class="cyber-input" style="flex: 1; height: 34px; padding: 0 8px; font-size: 0.8rem; background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #cbd5e1; font-family: 'Rajdhani', sans-serif;" onchange="window._emailRecipientsManager.handleSelectChange('${item.key}', this.value)">
              <option value="">👤 Kayıtlı Personelden Seç...</option>
              ${this.users.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('')}
            </select>
            <button class="btn-cyber" style="height: 34px; padding: 0 10px; font-size: 0.75rem; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: #cbd5e1; border-radius: 6px; cursor: pointer; white-space: nowrap;" onclick="window._emailRecipientsManager.addFromSelect('${item.key}')">
              <i class="fa-solid fa-plus"></i> Ekle
            </button>
          </div>

          <!-- Custom Manual Email Input -->
          <div style="display: flex; gap: 6px;">
            <input type="email" id="erm-input-${item.key}" placeholder="Manuel e-posta yazın (ad@domain.com)..." class="cyber-input" style="flex: 1; height: 34px; padding: 0 10px; font-size: 0.8rem; background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; color: #fff; font-family: 'Rajdhani', sans-serif;" onkeydown="if(event.key==='Enter') window._emailRecipientsManager.addCustomEmail('${item.key}')">
            <button class="btn-cyber" style="height: 34px; padding: 0 12px; font-size: 0.75rem; background: rgba(0, 242, 254, 0.15); border: 1px solid rgba(0, 242, 254, 0.3); color: var(--accent-cyan); border-radius: 6px; cursor: pointer; font-weight: 700; white-space: nowrap;" onclick="window._emailRecipientsManager.addCustomEmail('${item.key}')">
              <i class="fa-solid fa-plus"></i> Ekle
            </button>
          </div>

          <!-- Reset this item to default button -->
          <div style="display: flex; justify-content: flex-end; margin-top: 2px;">
            <button style="background: transparent; border: none; color: #64748B; font-size: 0.72rem; cursor: pointer; font-family: 'Rajdhani', sans-serif; font-weight: 600; text-decoration: underline;" onmouseover="this.style.color='var(--accent-cyan)'" onmouseout="this.style.color='#64748B'" onclick="window._emailRecipientsManager.resetItemToDefault('${item.key}')">
              <i class="fa-solid fa-rotate-left"></i> Bu İşlemi Varsayılana Sıfırla
            </button>
          </div>
        </div>

      </div>
    `;
  }

  handleSelectChange(key: string, val: string) {
    const input = document.getElementById(`erm-input-${key}`) as HTMLInputElement;
    if (input && val) {
      input.value = val;
    }
  }

  addFromSelect(key: string) {
    const select = document.getElementById(`erm-select-${key}`) as HTMLSelectElement;
    if (select && select.value) {
      this.addEmailToKey(key, select.value);
      select.value = '';
    }
  }

  addCustomEmail(key: string) {
    const input = document.getElementById(`erm-input-${key}`) as HTMLInputElement;
    if (input && input.value) {
      const email = input.value.trim().toLowerCase();
      if (!this.isValidEmail(email)) {
        if ((window as any).showToast) {
          (window as any).showToast('GEÇERSİZ E-POSTA', 'Lütfen geçerli bir e-posta adresi yazın (örn: isim@demirerholding.com)', 'warning');
        } else {
          alert('Lütfen geçerli bir e-posta adresi yazın.');
        }
        return;
      }
      this.addEmailToKey(key, email);
      input.value = '';
    }
  }

  private addEmailToKey(key: string, email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const list: string[] = (this.currentConfig as any)[key] || [];

    if (list.includes(cleanEmail)) {
      if ((window as any).showToast) {
        (window as any).showToast('BİLGİ', `${cleanEmail} adresi zaten bu listede ekli.`, 'info');
      }
      return;
    }

    list.push(cleanEmail);
    (this.currentConfig as any)[key] = list;
    this.isDirty = true;
    this.render();
  }

  removeRecipient(key: string, email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const list: string[] = (this.currentConfig as any)[key] || [];
    (this.currentConfig as any)[key] = list.filter(e => e.toLowerCase() !== cleanEmail);
    this.isDirty = true;
    this.render();
  }

  resetItemToDefault(key: string) {
    const defaults = (DEFAULT_EMAIL_RECIPIENTS as any)[key] || [];
    (this.currentConfig as any)[key] = [...defaults];
    this.isDirty = true;
    this.render();
    if ((window as any).showToast) {
      (window as any).showToast('SIFIRLANDI', 'Bu işlem için varsayılan e-posta alıcıları geri yüklendi.', 'info');
    }
  }

  resetAllToDefault() {
    if (!confirm('Tüm işlemlerin e-posta alıcılarını sistem varsayılanlarına döndürmek istediğinize emin misiniz?')) {
      return;
    }
    this.currentConfig = {
      ...DEFAULT_EMAIL_RECIPIENTS,
      updatedBy: this.currentConfig.updatedBy,
      updatedAt: this.currentConfig.updatedAt
    };
    this.isDirty = true;
    this.render();
    if ((window as any).showToast) {
      (window as any).showToast('VARSAYILANLAR YÜKLENDİ', 'Tüm e-posta alıcıları sistem varsayılanlarına çekildi. Kaydetmek için butona basın.', 'info');
    }
  }

  async save() {
    if (this.isSaving) return;
    this.isSaving = true;

    const userProfile = authService.getCurrentUser();
    const userEmail = userProfile?.email || 'Fatih Zebek';

    // Show saving status
    const saveBtns = [
      document.getElementById('erm-save-top-btn'),
      document.getElementById('erm-save-bottom-btn')
    ];
    saveBtns.forEach(btn => {
      if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>KAYDEDİLİYOR...</span>`;
        (btn as HTMLButtonElement).disabled = true;
      }
    });

    try {
      const res = await emailSettingsService.saveConfig(this.currentConfig, userEmail);
      if (res.success) {
        this.isDirty = false;
        this.originalConfig = JSON.parse(JSON.stringify(this.currentConfig));
        if ((window as any).showToast) {
          (window as any).showToast('BAŞARILI', 'E-posta dağıtım listesi güncellendi ve kaydedildi.', 'success');
        }
        await this.init();
      } else {
        if ((window as any).showToast) {
          (window as any).showToast('HATA', res.message, 'error');
        } else {
          alert('Hata: ' + res.message);
        }
      }
    } catch (err: any) {
      console.error('[EmailRecipientsManager] Kayıt hatası:', err);
      if ((window as any).showToast) {
        (window as any).showToast('HATA', `Kayıt yapılamadı: ${err?.message || err}`, 'error');
      }
    } finally {
      this.isSaving = false;
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
