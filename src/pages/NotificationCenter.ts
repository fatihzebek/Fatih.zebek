import { notificationService, type Announcement } from '../services/NotificationService';
import { dataService } from '../services/DataService';

export const NotificationCenterPage = async () => {
  const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.email === 'fatih.zebek@demirerholding.com';

  if (!isAdmin) {
    return `
      <div class="glass-panel" style="padding: 3rem; text-align: center; max-width: 600px; margin: 4rem auto; border-radius: 20px;">
        <i class="fa-solid fa-shield-halved" style="font-size: 3.5rem; color: #ff5252; margin-bottom: 1.5rem;"></i>
        <h2 style="color: #fff; margin-bottom: 0.8rem; font-family: 'Rajdhani', sans-serif;">YETKİSİZ ERİŞİM</h2>
        <p style="color: var(--text-muted); font-size: 0.95rem; line-height: 1.6;">
          Bildirim & Duyuru Merkezi yalnızca <strong>Sistem Yöneticilerine (Admin)</strong> özeldir.
        </p>
        <button onclick="window.navigate('dashboard')" class="cyber-btn" style="margin-top: 1.5rem; padding: 10px 24px;">
          <i class="fa-solid fa-arrow-left" style="margin-right: 8px;"></i> Ana Sayfaya Dön
        </button>
      </div>
    `;
  }

  // Preset quick templates
  const templates = [
    {
      category: 'celebration',
      title: '🎉 Ramazan Bayramınız Kutlu Olsun!',
      message: 'Değerli Demirer Holding çalışanları ve saha ekiplerimiz; sevdiklerinizle birlikte sağlıklı, huzurlu ve neşe dolu bir bayram geçirmenizi dileriz.'
    },
    {
      category: 'celebration',
      title: '🎉 Kurban Bayramınız Mübarek Olsun!',
      message: 'Tüm saha ekiplerimizin ve ailelerinin Kurban Bayramı\'nı en içten dileklerimizle kutlar, kazasız ve bereketli çalışmalar dileriz.'
    },
    {
      category: 'urgent',
      title: '⚠️ Fırtına & Yıldırım Uyarısı',
      message: 'Bölgemizde şiddetli rüzgar ve yıldırım riski bulunmaktadır. Türbin tırmanışlarını durdurunuz ve İSG kurallarına azami dikkat ediniz.'
    },
    {
      category: 'info',
      title: '📢 Genel Şirket Duyurusu',
      message: 'Saha operasyonları ve bakım süreçlerine ilişkin yeni bilgilendirme yönergeleri sisteme yüklenmiştir.'
    },
    {
      category: 'test',
      title: '🧪 Bildirim Sistemi Testi',
      message: 'Bu bildirim, mobil PWA ve web bildirim sisteminin aktifliğini doğrulamak amacıyla gönderilmiştir.'
    }
  ];

  const allowedTeams: string[] = dataService.getAllowedTeams();

  return `
    <div class="notification-center-container" style="max-width: 1200px; margin: 0 auto; padding: 1.5rem 1rem;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 48px; height: 48px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(234, 88, 12, 0.2)); border-radius: 14px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(245, 158, 11, 0.35); box-shadow: 0 0 20px rgba(245, 158, 11, 0.2);">
            <i class="fa-solid fa-bullhorn" style="font-size: 1.3rem; color: #fbbf24;"></i>
          </div>
          <div>
            <h1 style="margin: 0; font-size: 1.45rem; font-weight: 800; color: #fff; letter-spacing: 0.5px; font-family: 'Rajdhani', sans-serif;">
              BİLDİRİM & DUYURU MERKEZİ
            </h1>
            <p style="margin: 3px 0 0 0; font-size: 0.78rem; color: var(--text-muted); font-weight: 600;">
              Saha Ekipleri Telefon Bildirimi (PWA Web Push) & Özel Gün / Bayram Tebrik Gönderici
            </p>
          </div>
        </div>

        <div style="display: flex; gap: 10px; align-items: center;">
          <button id="btn-test-sound" class="btn-cyber-outline" style="padding: 8px 16px; font-size: 0.78rem; display: flex; align-items: center; gap: 8px; border-radius: 10px; border-color: rgba(245, 158, 11, 0.35); color: #fbbf24;">
            <i class="fa-solid fa-volume-high"></i> Sesi Dene
          </button>
          <button id="btn-test-push" class="btn-cyber-outline" style="padding: 8px 16px; font-size: 0.78rem; display: flex; align-items: center; gap: 8px; border-radius: 10px; border-color: rgba(0, 243, 255, 0.35); color: #00f3ff;">
            <i class="fa-solid fa-mobile-screen-button"></i> Telefon Bildirimimi Test Et
          </button>
        </div>
      </div>

      <!-- Main Layout -->
      <div style="display: grid; grid-template-columns: 1.3fr 1fr; gap: 1.5rem; align-items: start;">
        
        <!-- Left: Compose Form -->
        <div class="glass-panel" style="padding: 1.8rem; border-radius: 18px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(13, 20, 36, 0.75);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.2rem;">
            <h3 style="margin: 0; font-size: 1rem; color: #fff; font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-paper-plane" style="color: #64ffda; font-size: 0.9rem;"></i> Yeni Bildirim Oluştur
            </h3>
            <span style="font-size: 0.7rem; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 6px;">Admin Yetkisi</span>
          </div>

          <!-- Quick Templates -->
          <div style="margin-bottom: 1.2rem;">
            <label style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
              ⚡ Hızlı Şablonlar
            </label>
            <div style="display: flex; flex-wrap: wrap; gap: 6px;">
              ${templates.map((tpl, i) => `
                <button type="button" class="quick-tpl-btn" data-index="${i}" style="background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.1); color: #c9d1d9; font-size: 0.72rem; padding: 5px 10px; border-radius: 8px; cursor: pointer; transition: all 0.2s; white-space: nowrap;">
                  ${tpl.title.split('!')[0]}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Form Fields -->
          <form id="notification-form" style="display: flex; flex-direction: column; gap: 1rem;">
            
            <!-- Category Selection -->
            <div>
              <label style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
                Bildirim Türü
              </label>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;" id="category-selector">
                <label class="category-radio active" data-cat="celebration" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.4); padding: 8px; border-radius: 8px; text-align: center; cursor: pointer; font-size: 0.75rem; color: #fbbf24; font-weight: 700;">
                  <i class="fa-solid fa-cake-candles" style="display: block; font-size: 1.1rem; margin-bottom: 4px;"></i> Bayram / Kutlama
                </label>
                <label class="category-radio" data-cat="urgent" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); padding: 8px; border-radius: 8px; text-align: center; cursor: pointer; font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">
                  <i class="fa-solid fa-triangle-exclamation" style="display: block; font-size: 1.1rem; margin-bottom: 4px;"></i> Acil / İSG
                </label>
                <label class="category-radio" data-cat="info" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); padding: 8px; border-radius: 8px; text-align: center; cursor: pointer; font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">
                  <i class="fa-solid fa-circle-info" style="display: block; font-size: 1.1rem; margin-bottom: 4px;"></i> Genel Duyuru
                </label>
                <label class="category-radio" data-cat="task" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); padding: 8px; border-radius: 8px; text-align: center; cursor: pointer; font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">
                  <i class="fa-solid fa-bolt" style="display: block; font-size: 1.1rem; margin-bottom: 4px;"></i> Görev / Arıza
                </label>
                <label class="category-radio" data-cat="test" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); padding: 8px; border-radius: 8px; text-align: center; cursor: pointer; font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">
                  <i class="fa-solid fa-flask" style="display: block; font-size: 1.1rem; margin-bottom: 4px;"></i> Test Gönderimi
                </label>
              </div>
            </div>

            <!-- Target Audience -->
            <div>
              <label style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
                Hedef Kitle (Kimin Telefonuna Gitsin?)
              </label>
              <select id="notif-target" style="width: 100%; padding: 10px 14px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; color: #fff; font-size: 0.85rem; font-family: 'Inter', sans-serif;">
                <option value="ALL">🌐 Tüm Saha Ekipleri (Herkesin Telefonuna)</option>
                <option value="TEAM">👥 Belirli Bir Ekip</option>
                <option value="REGION">📍 Belirli Bir Bölge</option>
                <option value="SELF">🧪 Sadece Kendime (Test Gönderimi)</option>
              </select>
            </div>

            <!-- Conditional Team Select -->
            <div id="target-team-group" style="display: none;">
              <label style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
                Ekip Seçiniz
              </label>
              <select id="notif-target-team" style="width: 100%; padding: 10px 14px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; color: #fff; font-size: 0.85rem;">
                ${allowedTeams.map((t: string) => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>

            <!-- Conditional Region Select -->
            <div id="target-region-group" style="display: none;">
              <label style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
                Bölge Seçiniz
              </label>
              <select id="notif-target-region" style="width: 100%; padding: 10px 14px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; color: #fff; font-size: 0.85rem;">
                <option value="Çanakkale (İntepe, Çamseki, Sarıkaya)">Çanakkale Bölgesi (İntepe, Çamseki, Sarıkaya)</option>
                <option value="Balıkesir / Tekirdağ (Şarköy, Sayalar)">Balıkesir & Şarköy Bölgesi</option>
                <option value="İzmir / Çeşme (Germiyan)">İzmir / Çeşme Bölgesi</option>
                <option value="Muğla (Datça)">Muğla / Datça Bölgesi</option>
              </select>
            </div>

            <!-- Title -->
            <div>
              <label style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
                Bildirim Başlığı
              </label>
              <input type="text" id="notif-title" placeholder="Örn: 🎉 Kurban Bayramınız Kutlu Olsun!" value="🎉 Kurban Bayramınız Kutlu Olsun!" required
                     style="width: 100%; padding: 10px 14px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; color: #fff; font-size: 0.9rem; box-sizing: border-box; font-weight: 700;">
            </div>

            <!-- Message -->
            <div>
              <label style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; display: block; margin-bottom: 6px;">
                Bildirim Metni / Açıklama
              </label>
              <textarea id="notif-message" rows="4" placeholder="Ekiplere iletmek istediğiniz tebrik, duyuru veya talimat mesajı..." required
                        style="width: 100%; padding: 10px 14px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 10px; color: #fff; font-size: 0.85rem; box-sizing: border-box; line-height: 1.5; resize: vertical; font-family: 'Inter', sans-serif;">Tüm Demirer Holding saha ekiplerimizin ve ailelerinin Kurban Bayramı'nı en içten dileklerimizle kutlar, kazasız ve neşeli çalışmalar dileriz.</textarea>
            </div>

            <!-- Submit Button -->
            <button type="submit" id="btn-submit-notif" class="cyber-btn" style="padding: 13px; font-size: 0.95rem; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 10px; margin-top: 0.5rem; background: linear-gradient(135deg, #f59e0b, #d97706); border: none; color: #000; border-radius: 12px; box-shadow: 0 4px 20px rgba(245, 158, 11, 0.35); cursor: pointer;">
              <i class="fa-solid fa-paper-plane"></i> BİLDİRİMİ GÖNDER
            </button>
          </form>
        </div>

        <!-- Right: Mobile Preview & Past Announcements -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Mobile Screen Preview -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 18px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(13, 20, 36, 0.75);">
            <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between;">
              <span><i class="fa-solid fa-mobile-screen" style="margin-right: 6px; color: #64ffda;"></i> Cep Telefonu Bildirim Önizlemesi</span>
              <span style="color: #64ffda; font-size: 0.65rem;">Canlı Görünüm</span>
            </div>

            <div style="background: #000; border: 1px solid #333; border-radius: 16px; padding: 14px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
              <!-- Top bar -->
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem; color: #888; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="width: 14px; height: 14px; background: #64ffda; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; color: #000; font-size: 0.55rem; font-weight: 900;">DH</span>
                  <span style="font-weight: 700; color: #aaa;">DH-SERVİS</span>
                  <span>• Şimdi</span>
                </div>
                <div><i class="fa-solid fa-bell" style="font-size: 0.6rem; color: #fbbf24;"></i></div>
              </div>

              <!-- Content -->
              <div id="preview-title" style="font-weight: 800; font-size: 0.85rem; color: #fff; margin-bottom: 4px;">
                🎉 Kurban Bayramınız Kutlu Olsun!
              </div>
              <div id="preview-message" style="font-size: 0.75rem; color: #bbb; line-height: 1.4;">
                Tüm Demirer Holding saha ekiplerimizin ve ailelerinin Kurban Bayramı'nı en içten dileklerimizle kutlar, kazasız ve neşeli çalışmalar dileriz.
              </div>
            </div>
          </div>

          <!-- Past Announcements List -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 18px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(13, 20, 36, 0.75);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h4 style="margin: 0; font-size: 0.9rem; color: #fff; font-weight: 700;">
                <i class="fa-solid fa-clock-rotate-left" style="color: #fbbf24; margin-right: 6px;"></i> Gönderilen Bildirimler
              </h4>
              <button id="btn-refresh-history" class="btn-cyber-outline" style="padding: 4px 10px; font-size: 0.7rem; border-radius: 6px;">
                <i class="fa-solid fa-rotate-right"></i> Yenile
              </button>
            </div>

            <div id="announcement-history-container" style="max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px;">
              <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.8rem;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.2rem; margin-bottom: 6px;"></i><br>
                Yükleniyor...
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;
};

export const initNotificationCenterEvents = () => {
  const form = document.getElementById('notification-form') as HTMLFormElement;
  const targetSelect = document.getElementById('notif-target') as HTMLSelectElement;
  const teamGroup = document.getElementById('target-team-group');
  const regionGroup = document.getElementById('target-region-group');
  const titleInput = document.getElementById('notif-title') as HTMLInputElement;
  const messageInput = document.getElementById('notif-message') as HTMLTextAreaElement;
  const previewTitle = document.getElementById('preview-title');
  const previewMessage = document.getElementById('preview-message');
  const submitBtn = document.getElementById('btn-submit-notif') as HTMLButtonElement;

  let selectedCategory: Announcement['category'] = 'celebration';

  // Category Selector
  document.querySelectorAll('.category-radio').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.category-radio').forEach(r => {
        (r as HTMLElement).style.background = 'rgba(255, 255, 255, 0.02)';
        (r as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.08)';
        (r as HTMLElement).style.color = 'var(--text-muted)';
      });
      const cat = el.getAttribute('data-cat') as Announcement['category'];
      selectedCategory = cat;
      const colorMap: Record<string, string> = {
        celebration: '#fbbf24',
        urgent: '#ff5252',
        info: '#64ffda',
        task: '#00f3ff',
        test: '#c084fc'
      };
      const color = colorMap[cat] || '#fbbf24';
      (el as HTMLElement).style.background = `${color}18`;
      (el as HTMLElement).style.borderColor = `${color}66`;
      (el as HTMLElement).style.color = color;

      // Play matching sound on category switch
      notificationService.playNotificationSound(cat);
    });
  });

  // Target Change Listener
  if (targetSelect) {
    targetSelect.addEventListener('change', () => {
      const val = targetSelect.value;
      if (teamGroup) teamGroup.style.display = val === 'TEAM' ? 'block' : 'none';
      if (regionGroup) regionGroup.style.display = val === 'REGION' ? 'block' : 'none';
    });
  }

  // Live Preview Updating
  const updatePreview = () => {
    if (previewTitle && titleInput) {
      previewTitle.textContent = titleInput.value || 'Başlık...';
    }
    if (previewMessage && messageInput) {
      previewMessage.textContent = messageInput.value || 'Mesaj içeriği...';
    }
  };
  titleInput?.addEventListener('input', updatePreview);
  messageInput?.addEventListener('input', updatePreview);

  // Quick Template Buttons
  document.querySelectorAll('.quick-tpl-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index') || '0', 10);
      const templates = [
        {
          category: 'celebration',
          title: '🎉 Ramazan Bayramınız Kutlu Olsun!',
          message: 'Değerli Demirer Holding çalışanları ve saha ekiplerimiz; sevdiklerinizle birlikte sağlıklı, huzurlu ve neşe dolu bir bayram geçirmenizi dileriz.'
        },
        {
          category: 'celebration',
          title: '🎉 Kurban Bayramınız Mübarek Olsun!',
          message: 'Tüm saha ekiplerimizin ve ailelerinin Kurban Bayramı\'nı en içten dileklerimizle kutlar, kazasız ve bereketli çalışmalar dileriz.'
        },
        {
          category: 'urgent',
          title: '⚠️ Fırtına & Yıldırım Uyarısı',
          message: 'Bölgemizde şiddetli rüzgar ve yıldırım riski bulunmaktadır. Türbin tırmanışlarını durdurunuz ve İSG kurallarına azami dikkat ediniz.'
        },
        {
          category: 'info',
          title: '📢 Genel Şirket Duyurusu',
          message: 'Saha operasyonları ve bakım süreçlerine ilişkin yeni bilgilendirme yönergeleri sisteme yüklenmiştir.'
        },
        {
          category: 'test',
          title: '🧪 Bildirim Sistemi Testi',
          message: 'Bu bildirim, mobil PWA ve web bildirim sisteminin aktifliğini doğrulamak amacıyla gönderilmiştir.'
        }
      ];
      const tpl = templates[idx];
      if (tpl) {
        if (titleInput) titleInput.value = tpl.title;
        if (messageInput) messageInput.value = tpl.message;
        updatePreview();
        const catBtn = document.querySelector(`.category-radio[data-cat="${tpl.category}"]`) as HTMLElement;
        catBtn?.click();
      }
    });
  });

  // Sound Test Button
  document.getElementById('btn-test-sound')?.addEventListener('click', () => {
    notificationService.playNotificationSound(selectedCategory);
  });

  // Mobile Push Test Button
  document.getElementById('btn-test-push')?.addEventListener('click', async () => {
    if (!notificationService.isPermissionGranted()) {
      const perm = await notificationService.requestPermission();
      if (perm !== 'granted') {
        alert('Lütfen tarayıcınızın bildirim iznini veriniz.');
        return;
      }
    }
    notificationService.playNotificationSound(selectedCategory);
    notificationService.notify(
      '🧪 Test Bildirimi Başarılı!',
      'DH-Servis telefon bildirim sistemi sorunsuz çalışıyor. Ses ve titreşim aktiftir.',
      'success'
    );
  });

  // Form Submit Handler
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
      const title = titleInput.value.trim();
      const message = messageInput.value.trim();
      const targetAudience = targetSelect.value as Announcement['targetAudience'];
      let targetValue = '';
      if (targetAudience === 'TEAM') {
        targetValue = (document.getElementById('notif-target-team') as HTMLSelectElement)?.value || '';
      } else if (targetAudience === 'REGION') {
        targetValue = (document.getElementById('notif-target-region') as HTMLSelectElement)?.value || '';
      }

      if (!title || !message) {
        alert('Lütfen başlık ve mesaj alanlarını doldurunuz.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Gönderiliyor...`;

      try {
        await notificationService.createAnnouncement({
          title,
          message,
          category: selectedCategory,
          targetAudience,
          targetValue,
          createdBy: currentUser?.email || 'admin',
          createdByName: currentUser?.displayName || currentUser?.name || 'Fatih Zebek (Admin)'
        });

        if ((window as any).showToast) {
          (window as any).showToast('BİLDİRİM GÖNDERİLDİ', 'Bildirim başarıyla oluşturuldu ve ekiplere iletildi.', 'success');
        } else {
          alert('Bildirim başarıyla oluşturuldu ve iletildi!');
        }

        renderHistory();
      } catch (err: any) {
        console.error('Bildirim gönderilirken hata:', err);
        alert('Bildirim gönderilirken hata oluştu: ' + (err.message || ''));
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> BİLDİRİMİ GÖNDER`;
      }
    });
  }

  // Refresh History
  const renderHistory = async () => {
    const container = document.getElementById('announcement-history-container');
    if (!container) return;

    try {
      const items = await notificationService.getAnnouncements();
      if (items.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.8rem;">
            Henüz gönderilmiş bir bildirim bulunmuyor.
          </div>
        `;
        return;
      }

      const iconMap: Record<string, string> = {
        celebration: 'fa-cake-candles" style="color: #fbbf24;',
        urgent: 'fa-triangle-exclamation" style="color: #ff5252;',
        info: 'fa-circle-info" style="color: #64ffda;',
        task: 'fa-bolt" style="color: #00f3ff;',
        test: 'fa-flask" style="color: #c084fc;'
      };

      container.innerHTML = items.map(item => {
        const dateStr = new Date(item.createdAt).toLocaleString('tr-TR', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        });
        const icon = iconMap[item.category] || 'fa-bell';

        return `
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 10px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
            <div style="display: flex; gap: 10px; align-items: flex-start;">
              <i class="fa-solid ${icon} font-size: 0.9rem; margin-top: 3px;"></i>
              <div>
                <div style="font-weight: 700; font-size: 0.8rem; color: #fff;">${item.title}</div>
                <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; line-height: 1.3;">${item.message}</div>
                <div style="font-size: 0.65rem; color: #64ffda; margin-top: 4px; display: flex; gap: 10px;">
                  <span><i class="fa-regular fa-clock"></i> ${dateStr}</span>
                  <span><i class="fa-solid fa-users"></i> ${item.targetAudience === 'ALL' ? 'Herkes' : (item.targetValue || item.targetAudience)}</span>
                </div>
              </div>
            </div>
            <button onclick="window.handleDeleteAnnouncement('${item.id}')" style="background: none; border: none; color: #ff6b6b; opacity: 0.6; cursor: pointer; padding: 4px; font-size: 0.8rem; transition: opacity 0.2s;" title="Sil">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `;
      }).join('');
    } catch (err) {
      container.innerHTML = `<div style="color: #ff5252; font-size: 0.75rem; text-align: center;">Yüklenirken hata oluştu.</div>`;
    }
  };

  (window as any).handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;
    try {
      await notificationService.deleteAnnouncement(id);
      renderHistory();
    } catch (err: any) {
      alert('Hata: ' + err.message);
    }
  };

  document.getElementById('btn-refresh-history')?.addEventListener('click', renderHistory);

  // Initial load
  renderHistory();
};
