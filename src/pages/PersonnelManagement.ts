import { personnelService } from '../services/PersonnelService';
import { dataService } from '../services/DataService';

export const PersonnelManagementPage = async () => {
  setTimeout(() => {
    if (typeof (window as any).renderPersonnelManagementList === 'function') {
      (window as any).renderPersonnelManagementList();
    }
  }, 100);

  return `
    <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 2rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div>
          <h1 class="page-title" style="margin-bottom: 0; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.8rem; color: #fff; display: flex; align-items: center; gap: 12px;">
            <i class="fa-solid fa-people-group" style="color: var(--accent-cyan);"></i> Raporlama Form Personnel Listesi
          </h1>
          <p style="margin: 4px 0 0 0; color: var(--text-muted); font-size: 0.9rem;">
            Saha arıza ve bakım formlarında seçilebilecek personelleri ve onların sorumlu olduğu bölgeleri buradan yönetebilirsiniz.
          </p>
        </div>
      </div>

      <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
        <!-- Left panel: Add Personnel -->
        <div class="glass-panel" style="flex: 1; min-width: 300px; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; display: flex; flex-direction: column; gap: 1.25rem; height: fit-content; background: rgba(17, 24, 39, 0.6); backdrop-filter: blur(10px);">
          <h4 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1rem; color: white; font-weight: 700; letter-spacing: 1px;">YENİ PERSONEL EKLE</h4>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <input type="text" id="new-personnel-name" class="cyber-input" placeholder="Personel Adı Soyadı (Örn: Ahmet YILMAZ)..." style="width: 100%; height: 42px; border-radius: 8px;">
          </div>
          <button onclick="window.savePersonnelName()" class="btn-cyber" style="width: 100%; height: 42px; font-weight: bold; letter-spacing: 1px; justify-content: center; align-items: center; display: flex; gap: 8px; border-radius: 8px;">
            <i class="fa-solid fa-user-plus"></i> LİSTEYE EKLE
          </button>
        </div>
        
        <!-- Right panel: Personnel List -->
        <div class="glass-panel" style="flex: 2; min-width: 350px; padding: 1.5rem; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; display: flex; flex-direction: column; gap: 1.25rem; max-height: 700px; overflow-y: auto; background: rgba(17, 24, 39, 0.6); backdrop-filter: blur(10px);">
          <h4 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1rem; color: white; font-weight: 700; display: flex; justify-content: space-between; align-items: center; letter-spacing: 1px;">
            <span>MEVCUT PERSONELLER</span>
            <span id="personnel-count-badge" style="font-size: 0.8rem; background: rgba(0, 242, 254, 0.1); color: var(--accent-cyan); padding: 2px 10px; border-radius: 6px; font-family: monospace;">0 Personel</span>
          </h4>
          <div id="personnel-management-list" style="display: flex; flex-direction: column; gap: 0.6rem;">
            <div style="text-align: center; color: var(--text-muted); padding: 2rem;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>
          </div>
        </div>
      </div>
    </div>
  `;
};

// Global handlers registration
(window as any).togglePersonnelCard = (safeName: string) => {
  const panel = document.getElementById(`panel-${safeName}`);
  const chevron = document.getElementById(`chevron-${safeName}`);
  if (!panel || !chevron) return;
  
  if (panel.style.display === 'none') {
    panel.style.display = 'flex';
    chevron.style.transform = 'rotate(180deg)';
  } else {
    panel.style.display = 'none';
    chevron.style.transform = 'none';
  }
};

(window as any).savePersonnelDetails = async (name: string, safeName: string) => {
  const companySelect = document.getElementById(`company-${safeName}`) as HTMLSelectElement;
  const company = companySelect?.value || '';
  
  const teamSelect = document.getElementById(`team-${safeName}`) as HTMLSelectElement;
  const team = teamSelect?.value || '';
  
  const checkboxes = document.querySelectorAll(`.site-checkbox-${safeName}:checked`) as NodeListOf<HTMLInputElement>;
  const baseSites: string[] = [];
  checkboxes.forEach(cb => baseSites.push(cb.value));
  
  try {
    if ((window as any).showToast) (window as any).showToast('Bilgi', 'Detaylar kaydediliyor...', 'info');
    await personnelService.updatePersonnelDetails(name, company, baseSites, team);
    if ((window as any).showToast) (window as any).showToast('Başarılı', 'Personel bölgeleri, şirketi ve ekibi güncellendi.', 'success');
  } catch (err: any) {
    if ((window as any).showToast) (window as any).showToast('Hata', err.message || 'Güncelleme başarısız.', 'error');
  }
};

(window as any).renderPersonnelManagementList = () => {
  const container = document.getElementById('personnel-management-list');
  const countBadge = document.getElementById('personnel-count-badge');
  if (!container) return;

  const list = personnelService.getPersonnelList();
  const details = personnelService.getPersonnelDetailsList();
  const allSites = dataService.getSites();

  if (countBadge) countBadge.innerText = `${list.length} Personel`;

  if (list.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Kayıtlı personel bulunamadı.</div>`;
    return;
  }

  container.innerHTML = list.map(name => {
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '_');
    const detail = details.find(d => d.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'));
    const company = detail?.company || '';
    const baseSites = detail?.baseSites || [];
    const team = detail?.team || '';

    const siteCountText = baseSites.length > 0 
      ? `${baseSites.length} Bölge` 
      : 'Bölge Belirtilmedi (Her sahada harcırah yazar)';

    return `
      <div class="personnel-card" id="personnel-card-${safeName}" style="display: flex; flex-direction: column; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden; transition: all 0.2s;">
        <!-- Header Row -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; cursor: pointer; user-select: none;" onclick="window.togglePersonnelCard('${safeName}')" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          <span style="font-size: 0.9rem; color: #fff; font-weight: 500; display: flex; align-items: center; flex-wrap: wrap; gap: 8px;">
            <i class="fa-solid fa-user-check" style="color: var(--accent-cyan); opacity: 0.8;"></i> 
            <span>${name}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 400;">
              (${company || 'Şirket Yok'}${team ? ` - ${team}` : ''} - ${siteCountText})
            </span>
          </span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-chevron-down" id="chevron-${safeName}" style="font-size: 0.8rem; color: var(--text-muted); transition: transform 0.2s;"></i>
            <button onclick="event.stopPropagation(); window.deletePersonnelName('${name.replace(/'/g, "\\'")}')" 
                    style="background: none; border: none; outline: none; box-shadow: none; color: rgba(255,255,255,0.25); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; transition: all 0.2s;" 
                    onmouseover="this.style.color='#ff4d4d'; this.style.background='rgba(255,77,77,0.1)';" 
                    onmouseout="this.style.color='rgba(255,255,255,0.25)'; this.style.background='none';"
                    title="Personeli Sil">
              <i class="fa-solid fa-trash-can" style="font-size: 0.8rem;"></i>
            </button>
          </div>
        </div>

        <!-- Expandable Content Panel -->
        <div id="panel-${safeName}" style="display: none; padding: 1.25rem; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0, 0, 0, 0.25); flex-direction: column; gap: 1rem;">
          <!-- Company & Team Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            <!-- Company Selection -->
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              <label class="input-label" style="margin: 0; font-size: 0.7rem; letter-spacing: 1px;">BAĞLI OLDUĞU ŞİRKET</label>
              <select class="cyber-input" id="company-${safeName}" style="height: 38px; width: 100%; border-radius: 6px;">
                <option value="" ${!company ? 'selected' : ''}>Şirket Seçin...</option>
                <option value="Demirer Enerji" ${company === 'Demirer Enerji' ? 'selected' : ''}>Demirer Enerji</option>
                <option value="Har Film Yapım" ${company === 'Har Film Yapım' ? 'selected' : ''}>Har Film Yapım</option>
                <option value="YEK" ${company === 'YEK' ? 'selected' : ''}>YEK</option>
              </select>
            </div>

            <!-- Team Selection -->
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              <label class="input-label" style="margin: 0; font-size: 0.7rem; letter-spacing: 1px;">ATANDIĞI EKİP (TEAM)</label>
              <select class="cyber-input" id="team-${safeName}" style="height: 38px; width: 100%; border-radius: 6px;">
                <option value="" ${!team ? 'selected' : ''}>Ekip Atanmadı...</option>
                ${Array.from({length: 15}, (_, i) => {
                  const tVal = `Team ${String(i + 1).padStart(2, '0')}`;
                  return `<option value="${tVal}" ${team === tVal ? 'selected' : ''}>${tVal}</option>`;
                }).join('')}
              </select>
            </div>
          </div>

          <!-- Base Sites Checkboxes -->
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label class="input-label" style="margin: 0; font-size: 0.7rem; letter-spacing: 1px;">SORUMLU OLDUĞU BÖLGELER (BUNLAR DIŞINDAKİ SAHALARA GİDİNCE HARCIRAH YAZILIR)</label>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 0.5rem; background: rgba(255,255,255,0.02); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
              ${allSites.map(s => {
                const checked = baseSites.includes(s.id);
                const shortName = s.name.replace('Alize ', '').replace('Anemon ', '').replace('Mare ', '').replace('Doğal ', '').replace('Dares ', '');
                return `
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--text-main); cursor: pointer; margin: 0;">
                    <input type="checkbox" class="site-checkbox-${safeName}" value="${s.id}" ${checked ? 'checked' : ''} style="accent-color: var(--accent-cyan); width: 15px; height: 15px; margin: 0;">
                    <span>${shortName}</span>
                  </label>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Save Button -->
          <button onclick="window.savePersonnelDetails('${name.replace(/'/g, "\\'")}', '${safeName}')" class="btn-cyber" style="height: 36px; font-size: 0.85rem; justify-content: center; align-items: center; display: flex; gap: 6px; width: 100%; max-width: 160px; align-self: flex-end; margin-top: 0.5rem; border-radius: 6px;">
            <i class="fa-solid fa-save"></i> DETAYLARI KAYDET
          </button>
        </div>
      </div>
    `;
  }).join('');
};

(window as any).savePersonnelName = async () => {
  const input = document.getElementById('new-personnel-name') as HTMLInputElement;
  const name = input?.value?.trim();
  if (!name) {
    if ((window as any).showToast) (window as any).showToast('Uyarı', 'Lütfen geçerli bir isim yazın.', 'warning');
    return;
  }

  try {
    if ((window as any).showToast) (window as any).showToast('Bilgi', 'Personel ekleniyor...', 'info');
    await personnelService.addPersonnel(name);
    input.value = '';
    if ((window as any).showToast) (window as any).showToast('Başarılı', 'Personel başarıyla eklendi.', 'success');
  } catch (err: any) {
    if ((window as any).showToast) (window as any).showToast('Hata', err.message || 'Ekleme başarısız.', 'error');
  }
};

(window as any).deletePersonnelName = async (name: string) => {
  if (!confirm(`${name} isimli personeli silmek istediğinize emin misiniz?`)) return;

  try {
    if ((window as any).showToast) (window as any).showToast('Bilgi', 'Personel siliniyor...', 'info');
    await personnelService.deletePersonnelByName(name);
    if ((window as any).showToast) (window as any).showToast('Başarılı', 'Personel listeden silindi.', 'success');
  } catch (err: any) {
    if ((window as any).showToast) (window as any).showToast('Hata', err.message || 'Silme başarısız.', 'error');
  }
};
