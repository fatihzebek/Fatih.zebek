import changelogData from '../data/changelog.json';

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  badge?: string;
  changes: string[];
}

export function showChangelogModal(autoOpen = false) {
  // If already open, do not duplicate
  if (document.getElementById('changelog-modal-backdrop')) return;

  const entries: ChangelogEntry[] = changelogData as ChangelogEntry[];
  const latestVersion = entries[0]?.version || 'v1.0.0';

  const modalHtml = `
    <div id="changelog-modal-backdrop" style="position: fixed; inset: 0; background: rgba(5, 8, 16, 0.85); backdrop-filter: blur(10px); z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 1.5rem; animation: fadeIn 0.25s ease;">
      <div class="glass-panel" style="width: 100%; max-width: 680px; max-height: 85vh; display: flex; flex-direction: column; background: #0d121e; border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 0 30px rgba(168, 85, 247, 0.15); overflow: hidden;">
        
        <!-- Header -->
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; background: rgba(168, 85, 247, 0.05);">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #a855f7, #6366f1); display: flex; align-items: center; justify-content: center; color: white; font-size: 1.1rem; box-shadow: 0 4px 15px rgba(168, 85, 247, 0.4);">
              <i class="fa-solid fa-rocket"></i>
            </div>
            <div>
              <h2 style="font-family: 'Rajdhani', sans-serif; margin: 0; font-size: 1.3rem; color: #FFFFFF; font-weight: 700; letter-spacing: 0.5px;">Sistem Sürüm Günlüğü & Yenilikler</h2>
              <div style="font-size: 0.75rem; color: #94A3B8;">DH-Servis Platformu Son Geliştirmeler</div>
            </div>
          </div>
          <button onclick="window.closeChangelogModal()" style="background: none; border: none; color: #94A3B8; cursor: pointer; font-size: 1.2rem; padding: 4px 8px; border-radius: 6px; transition: all 0.2s;" onmouseover="this.style.color='#FFFFFF'; this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.color='#94A3B8'; this.style.background='none'">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Body / Timeline -->
        <div style="padding: 1.5rem; overflow-y: auto; flex: 1;" class="custom-scrollbar">
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            ${entries.map((entry, idx) => `
              <div style="position: relative; padding-left: 24px; border-left: 2px solid ${idx === 0 ? '#a855f7' : 'rgba(255,255,255,0.1)'};">
                <!-- Timeline bullet -->
                <div style="position: absolute; left: -7px; top: 0; width: 12px; height: 12px; border-radius: 50%; background: ${idx === 0 ? '#a855f7' : '#475569'}; border: 2px solid #0d121e; box-shadow: ${idx === 0 ? '0 0 10px #a855f7' : 'none'};"></div>
                
                <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.4rem; flex-wrap: wrap;">
                  <span style="font-family: monospace; font-size: 0.85rem; font-weight: 800; background: ${idx === 0 ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${idx === 0 ? '#c084fc' : '#94A3B8'}; padding: 2px 8px; border-radius: 4px; border: 1px solid ${idx === 0 ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255,255,255,0.1)'};">
                    ${entry.version}
                  </span>
                  <span style="font-size: 0.75rem; color: #64748B;">${entry.date}</span>
                  ${entry.badge ? `<span style="font-size: 0.65rem; background: #10B981; color: #022c22; font-weight: 800; padding: 1px 6px; border-radius: 10px; text-transform: uppercase;">${entry.badge}</span>` : ''}
                </div>

                <h4 style="font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; margin: 0 0 0.6rem 0; color: #FFFFFF; font-weight: 600;">
                  ${entry.title}
                </h4>

                <ul style="margin: 0; padding-left: 1.2rem; display: flex; flex-direction: column; gap: 0.4rem; font-size: 0.82rem; color: #CBD5E1; line-height: 1.4;">
                  ${entry.changes.map(ch => `<li>${ch}</li>`).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 1rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2);">
          <div style="font-size: 0.75rem; color: #64748B;">
            Demirer Holding Servis Yönetim Sistemi
          </div>
          <button onclick="window.closeChangelogModal()" class="btn-cyber" style="padding: 0.5rem 1.25rem; font-size: 0.85rem; background: linear-gradient(135deg, #a855f7, #6366f1); border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: 700; font-family: 'Rajdhani', sans-serif;">
            Anladım / Kapat
          </button>
        </div>
      </div>
    </div>
  `;

  const container = document.createElement('div');
  container.innerHTML = modalHtml;
  document.body.appendChild(container.firstElementChild!);

  // Mark latest version as seen
  localStorage.setItem('last_seen_changelog_ver', latestVersion);
}

export function closeChangelogModal() {
  const modal = document.getElementById('changelog-modal-backdrop');
  if (modal) modal.remove();
}

export function checkAndShowChangelogNotice() {
  const user = (window as any).currentUser || (window as any).appState?.userProfile;
  const email = (user?.email || '').toLowerCase();
  const isLocal = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const isAdmin = user?.role === 'ADMIN' || email.includes('fatih.zebek') || email.includes('hursit.akter') || email.includes('emir.unver') || isLocal;
  if (!isAdmin) return;

  const entries: ChangelogEntry[] = changelogData as ChangelogEntry[];
  const latestVersion = entries[0]?.version;
  if (!latestVersion) return;

  const lastSeen = localStorage.getItem('last_seen_changelog_ver');
  if (!lastSeen || lastSeen !== latestVersion) {
    // Auto popup for Admin / Managers only
    setTimeout(() => {
      showChangelogModal(true);
    }, 1200);
  }
}

// Bind to window for global access
if (typeof window !== 'undefined') {
  (window as any).showChangelogModal = showChangelogModal;
  (window as any).closeChangelogModal = closeChangelogModal;
}
