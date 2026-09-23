import { notificationService, type Announcement } from '../services/NotificationService';
import { dataService } from '../services/DataService';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { formatDisplayName } from '../utils/formatters';

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

      <!-- Ekip & Kullanıcı Cihaz Bildirim Durumları (Push Subscribers) -->
      <div class="glass-panel" style="margin-top: 1.5rem; padding: 1.8rem; border-radius: 18px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(13, 20, 36, 0.75);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 38px; height: 38px; background: rgba(0, 243, 255, 0.15); border: 1px solid rgba(0, 243, 255, 0.3); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #00f3ff;">
              <i class="fa-solid fa-mobile-screen-button"></i>
            </div>
            <div>
              <h3 style="margin: 0; font-size: 1.05rem; color: #fff; font-weight: 700; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
                SAHA EKİPLERİ & KULLANICI CİHAZ BİLDİRİM DURUMLARI (WEB PUSH)
              </h3>
              <p style="margin: 2px 0 0 0; font-size: 0.74rem; color: var(--text-muted);">
                Kimin bildirimlerinin açık, hangi ekiplerin henüz bildirim izni vermediğini (kapalı olduğunu) anlık takip edin.
              </p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <input type="text" id="subscriber-search-input" placeholder="Ekip veya kullanıcı ara..." style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #fff; font-size: 0.75rem; padding: 6px 12px; border-radius: 8px; width: 180px; outline: none;">
            <button id="btn-refresh-subscribers" class="btn-cyber-outline" style="padding: 6px 14px; font-size: 0.74rem; border-radius: 8px; border-color: rgba(0, 243, 255, 0.35); color: #00f3ff; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-rotate-right"></i> Yenile
            </button>
          </div>
        </div>

        <!-- Summary Stats Badges -->
        <div id="subscribers-summary-bar" style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 1.2rem;">
          <div style="padding: 8px 14px; background: rgba(0, 243, 255, 0.08); border: 1px solid rgba(0, 243, 255, 0.2); border-radius: 10px; font-size: 0.75rem; color: #00f3ff; font-weight: 700;">
            <i class="fa-solid fa-circle-notch fa-spin"></i> Yükleniyor...
          </div>
        </div>

        <!-- Subscribers Table -->
        <div id="subscribers-table-container" style="overflow-x: auto; max-height: 480px;">
          <div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.8rem;">
            <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.2rem; margin-bottom: 6px;"></i><br>
            Cihaz abonelikleri taranıyor...
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

  // --- Push Subscribers Tracker ---
  let cachedSubscribersList: any[] = [];

  const renderSubscribers = async () => {
    const tableContainer = document.getElementById('subscribers-table-container');
    if (!tableContainer) return;

    try {
      const [subsSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'push_subscriptions')),
        getDocs(collection(db, 'users'))
      ]);

      // Map push subscriptions by email / user
      const subMap: Record<string, { count: number; latest: number; latestFormatted: string; role: string; team: string; platforms: string[] }> = {};
      subsSnap.forEach(d => {
        const data = d.data();
        const userEmail = (data.user || '').toLowerCase().trim();
        const updatedAt = data.updatedAt || 0;
        const endpoint = data.endpoint || '';
        let platform = 'Web Tarayıcı';
        if (endpoint.includes('apple')) platform = 'Apple iOS / Safari';
        else if (endpoint.includes('fcm.googleapis.com')) platform = 'Android / Chrome';
        else if (endpoint.includes('windows') || endpoint.includes('notify.windows.com')) platform = 'Windows Edge';

        if (!subMap[userEmail]) {
          subMap[userEmail] = {
            count: 1,
            latest: updatedAt,
            latestFormatted: updatedAt ? new Date(updatedAt).toLocaleString('tr-TR') : '-',
            role: data.role || '',
            team: data.team || '',
            platforms: [platform]
          };
        } else {
          subMap[userEmail].count++;
          if (updatedAt > subMap[userEmail].latest) {
            subMap[userEmail].latest = updatedAt;
            subMap[userEmail].latestFormatted = new Date(updatedAt).toLocaleString('tr-TR');
          }
          if (!subMap[userEmail].platforms.includes(platform)) {
            subMap[userEmail].platforms.push(platform);
          }
        }
      });

      // Prepare standard list of all 15 field teams
      const allUsersMap = new Map<string, { displayName: string; email: string; role: string }>();

      // 1. All standard teams Team 01 to Team 15
      for (let i = 1; i <= 15; i++) {
        const teamNum = String(i).padStart(2, '0');
        const teamEmail = `dh-tm${teamNum}@demirerholding.com`;
        allUsersMap.set(teamEmail, {
          displayName: `Team ${teamNum}`,
          email: teamEmail,
          role: 'TECHNICIAN'
        });
      }

      // 2. All registered users from Firestore
      usersSnap.forEach(d => {
        const u = d.data();
        const email = (u.email || '').toLowerCase().trim();
        if (email && !email.includes('fallback')) {
          allUsersMap.set(email, {
            displayName: u.displayName || u.name || formatDisplayName(email),
            email: email,
            role: u.role || 'USER'
          });
        }
      });

      // Merge into subscribersList
      const list = Array.from(allUsersMap.values()).map(u => {
        const email = u.email.toLowerCase();
        const sub = subMap[email];
        const isTeam = email.startsWith('dh-tm');
        const isActive = !!sub && sub.count > 0;

        return {
          displayName: u.displayName,
          email: u.email,
          role: u.role,
          isTeam,
          isActive,
          deviceCount: sub ? sub.count : 0,
          latest: sub ? sub.latest : 0,
          latestFormatted: sub ? sub.latestFormatted : 'Kayıt Yok',
          platforms: sub ? sub.platforms.join(', ') : '-'
        };
      });

      // Sort: Teams first, then by active status
      list.sort((a, b) => {
        if (a.isTeam && !b.isTeam) return -1;
        if (!a.isTeam && b.isTeam) return 1;
        return a.displayName.localeCompare(b.displayName);
      });

      cachedSubscribersList = list;
      renderSubscribersTable();
    } catch (err: any) {
      console.error('Failed to load push subscribers:', err);
      if (tableContainer) {
        tableContainer.innerHTML = `<div style="color: #ff5252; font-size: 0.8rem; text-align: center; padding: 1.5rem;">Cihaz listesi yüklenemedi: ${err.message}</div>`;
      }
    }
  };

  const renderSubscribersTable = () => {
    const summaryBar = document.getElementById('subscribers-summary-bar');
    const tableContainer = document.getElementById('subscribers-table-container');
    const searchInput = document.getElementById('subscriber-search-input') as HTMLInputElement;
    const query = (searchInput?.value || '').toLowerCase().trim();

    if (!tableContainer) return;

    const filtered = cachedSubscribersList.filter(item => {
      if (!query) return true;
      return item.displayName.toLowerCase().includes(query) || 
             item.email.toLowerCase().includes(query) || 
             item.role.toLowerCase().includes(query);
    });

    // Summary calculation
    const teamItems = cachedSubscribersList.filter(i => i.isTeam);
    const activeTeams = teamItems.filter(i => i.isActive).length;
    const inactiveTeams = teamItems.filter(i => !i.isActive).length;
    const totalDevices = cachedSubscribersList.reduce((acc, curr) => acc + curr.deviceCount, 0);

    if (summaryBar) {
      summaryBar.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; padding: 6px 14px; background: rgba(0, 230, 118, 0.1); border: 1px solid rgba(0, 230, 118, 0.3); border-radius: 10px; font-size: 0.76rem; color: #00e676; font-weight: 700;">
          <i class="fa-solid fa-circle-check"></i> Bildirimi Açık Ekipler: ${activeTeams} / ${teamItems.length}
        </div>
        ${inactiveTeams > 0 ? `
          <div style="display: flex; align-items: center; gap: 8px; padding: 6px 14px; background: rgba(255, 82, 82, 0.12); border: 1px solid rgba(255, 82, 82, 0.35); border-radius: 10px; font-size: 0.76rem; color: #ff5252; font-weight: 700;">
            <i class="fa-solid fa-triangle-exclamation fa-fade"></i> Bildirimi Kapalı Ekipler: ${inactiveTeams}
          </div>
        ` : ''}
        <div style="display: flex; align-items: center; gap: 8px; padding: 6px 14px; background: rgba(0, 243, 255, 0.08); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 10px; font-size: 0.76rem; color: #00f3ff; font-weight: 700;">
          <i class="fa-solid fa-mobile-screen"></i> Aktif Kayıtlı Cihaz: ${totalDevices}
        </div>
      `;
    }

    if (filtered.length === 0) {
      tableContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-size: 0.8rem;">Kayıt bulunamadı.</div>`;
      return;
    }

    tableContainer.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 0.76rem; text-align: left; min-width: 650px;">
        <thead>
          <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.1); color: var(--text-muted); text-transform: uppercase; font-size: 0.68rem; letter-spacing: 0.5px;">
            <th style="padding: 10px 12px;">Ekip / Kullanıcı</th>
            <th style="padding: 10px 12px;">E-Posta</th>
            <th style="padding: 10px 12px;">Rol / Yetki</th>
            <th style="padding: 10px 12px; text-align: center;">Cihaz Sayısı</th>
            <th style="padding: 10px 12px;">Son Cihaz Kaydı</th>
            <th style="padding: 10px 12px; text-align: right;">Bildirim Durumu</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map(item => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04); background: ${item.isTeam ? 'rgba(255, 255, 255, 0.015)' : 'transparent'};">
              <td style="padding: 10px 12px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid ${item.isTeam ? 'fa-people-group' : 'fa-user'}" style="color: ${item.isActive ? '#00e676' : '#ff5252'}; font-size: 0.85rem;"></i>
                ${item.displayName}
              </td>
              <td style="padding: 10px 12px; color: var(--text-muted); font-family: monospace; font-size: 0.73rem;">
                ${item.email}
              </td>
              <td style="padding: 10px 12px;">
                <span style="background: rgba(255, 255, 255, 0.05); padding: 2px 8px; border-radius: 6px; font-size: 0.68rem; color: #94a3b8;">
                  ${item.role}
                </span>
              </td>
              <td style="padding: 10px 12px; text-align: center; font-weight: 700; color: ${item.deviceCount > 0 ? '#00f3ff' : 'var(--text-muted)'};">
                ${item.deviceCount > 0 ? `<i class="fa-solid fa-mobile-screen"></i> ${item.deviceCount}` : '—'}
              </td>
              <td style="padding: 10px 12px; color: var(--text-muted); font-size: 0.7rem;">
                ${item.latestFormatted}
                ${item.platforms !== '-' ? `<div style="font-size: 0.62rem; color: #64ffda; margin-top: 1px;">${item.platforms}</div>` : ''}
              </td>
              <td style="padding: 10px 12px; text-align: right;">
                ${item.isActive ? `
                  <span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 8px; background: rgba(0, 230, 118, 0.12); border: 1px solid rgba(0, 230, 118, 0.35); color: #00e676; font-weight: 700; font-size: 0.7rem;">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: #00e676; box-shadow: 0 0 6px #00e676;"></span>
                    AÇIK (AKTİF)
                  </span>
                ` : `
                  <span style="display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 8px; background: rgba(255, 82, 82, 0.12); border: 1px solid rgba(255, 82, 82, 0.35); color: #ff5252; font-weight: 700; font-size: 0.7rem;">
                    <span style="width: 6px; height: 6px; border-radius: 50%; background: #ff5252;"></span>
                    BİLDİRİM KAPALI
                  </span>
                `}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  document.getElementById('btn-refresh-subscribers')?.addEventListener('click', renderSubscribers);
  document.getElementById('subscriber-search-input')?.addEventListener('input', renderSubscribersTable);

  // Initial loads
  renderHistory();
  renderSubscribers();
};
