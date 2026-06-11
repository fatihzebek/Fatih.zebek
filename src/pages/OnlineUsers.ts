import { presenceService } from '../services/PresenceService';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const OnlineUsersPage = async () => {
  return `
    <div class="page-container" style="padding: 2rem; max-width: 1200px; margin: 0 auto; padding-bottom: 120px;">
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem;">
        <div>
          <h1 style="font-size: 2rem; font-weight: 800; color: var(--text-main); margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 2px;">
            <i class="fa-solid fa-users-viewfinder" style="color: #14F195; margin-right: 12px;"></i>AKTİF KULLANICILAR
          </h1>
          <p style="color: var(--text-muted); font-size: 0.9rem;">Sistemde şu anda aktif olan kullanıcılar ve oturum (cihaz) detayları.</p>
        </div>
      </div>

      <div id="online-users-content">
         <div style="display: flex; align-items: center; justify-content: center; height: 200px; color: var(--accent-cyan);">
            <i class="fa-solid fa-circle-notch fa-spin fa-2x"></i>
         </div>
      </div>
    </div>
  `;
};

// Component logic attached after render
let unsubscribePresence: any = null;

(window as any).initOnlineUsersPage = () => {
   const container = document.getElementById('online-users-content');
   if (!container) return;

   if (unsubscribePresence) {
      unsubscribePresence();
   }

   unsubscribePresence = presenceService.subscribeToPresence(async (users) => {
      // Sort users: online first, then by last active
      const sortedUsers = users.sort((a, b) => {
         if (a.status === 'online' && b.status !== 'online') return -1;
         if (a.status !== 'online' && b.status === 'online') return 1;
         return (b.last_active || 0) - (a.last_active || 0);
      });

      let html = `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem;">`;

      // We will fetch sessions for online users manually once per update
      // Since this is an admin dashboard, a slight delay in device details is acceptable
      for (const user of sortedUsers) {
         const isOnline = user.status === 'online' && (Date.now() - (user.last_active || 0)) < 120000;
         const lastActiveDate = user.last_active ? new Date(user.last_active).toLocaleString('tr-TR') : 'Bilinmiyor';

         let sessionsHtml = '';
         if (isOnline) {
            try {
               const sessionsSnap = await getDocs(collection(db, 'users', user.id, 'sessions'));
               const activeSessions = sessionsSnap.docs
                  .map(doc => ({ id: doc.id, ...doc.data() as any }))
                  .filter(s => (Date.now() - s.last_active) < 120000);

               if (activeSessions.length > 0) {
                  sessionsHtml = `<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.1);">
                     <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.5rem; text-transform: uppercase;">Aktif Oturumlar (${activeSessions.length})</div>
                     ${activeSessions.map(s => {
                        const browser = getBrowserFromUserAgent(s.userAgent);
                        return `
                           <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 6px; margin-bottom: 4px; border: 1px solid rgba(255,255,255,0.02);">
                              <div style="display: flex; align-items: center; gap: 8px;">
                                 <i class="fa-solid fa-${getDeviceIcon(s.userAgent)}" style="color: #64748B;"></i>
                                 <span style="font-size: 0.75rem; color: #E2E8F0;">${browser}</span>
                              </div>
                              <div style="font-size: 0.65rem; color: #14F195;">Şimdi</div>
                           </div>
                        `;
                     }).join('')}
                  </div>`;
               }
            } catch (e) {
               console.error('Session fetch error', e);
            }
         }

         html += `
            <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 1.5rem; position: relative; overflow: hidden;">
               <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${isOnline ? '#14F195' : '#64748B'};"></div>
               
               <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
                  <div style="font-weight: bold; font-size: 1.1rem; color: var(--text-main);">${user.displayName || user.email || 'Bilinmeyen Kullanıcı'}</div>
                  <div style="padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: bold; background: ${isOnline ? 'rgba(20, 241, 149, 0.1)' : 'rgba(100, 116, 139, 0.1)'}; color: ${isOnline ? '#14F195' : '#94A3B8'}; border: 1px solid ${isOnline ? 'rgba(20, 241, 149, 0.2)' : 'rgba(100, 116, 139, 0.2)'};">
                     ${isOnline ? 'AKTİF' : 'ÇEVRİMDIŞI'}
                  </div>
               </div>
               
               <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem; color: var(--text-muted);">
                  <div style="display: flex; align-items: center; gap: 8px;">
                     <i class="fa-solid fa-envelope" style="width: 14px; text-align: center;"></i>
                     <span>${user.email || '-'}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                     <i class="fa-solid fa-clock-rotate-left" style="width: 14px; text-align: center;"></i>
                     <span>Son görülme: ${lastActiveDate}</span>
                  </div>
                  ${user.role ? `
                  <div style="display: flex; align-items: center; gap: 8px;">
                     <i class="fa-solid fa-id-badge" style="width: 14px; text-align: center;"></i>
                     <span>Yetki: <strong style="color: var(--accent-cyan);">${user.role}</strong></span>
                  </div>` : ''}
               </div>

               ${sessionsHtml}
            </div>
         `;
      }

      html += `</div>`;
      if (container) container.innerHTML = html;
   });
};

function getBrowserFromUserAgent(ua: string) {
   if (!ua) return 'Bilinmeyen Cihaz';
   if (ua.includes('Firefox')) return 'Firefox';
   if (ua.includes('SamsungBrowser')) return 'Samsung Internet';
   if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
   if (ua.includes('Trident') || ua.includes('MSIE')) return 'Internet Explorer';
   if (ua.includes('Edge') || ua.includes('Edg/')) return 'Edge';
   if (ua.includes('Chrome')) return 'Chrome';
   if (ua.includes('Safari')) return 'Safari';
   return 'Bilinmeyen Tarayıcı';
}

function getDeviceIcon(ua: string) {
   if (!ua) return 'desktop';
   if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) return 'mobile-screen-button';
   if (ua.includes('Tablet') || ua.includes('iPad')) return 'tablet-screen-button';
   return 'desktop';
}

// Ensure cleanup when navigating away
const originalNavigate = (window as any).navigate;
(window as any).navigate = function(page: string) {
   if (unsubscribePresence) {
      unsubscribePresence();
      unsubscribePresence = null;
   }
   if (originalNavigate) {
      originalNavigate(page);
   }
};

setTimeout(() => {
   if ((window as any).initOnlineUsersPage) {
      (window as any).initOnlineUsersPage();
   }
}, 100);
