import { personnelService } from '../services/PersonnelService';

export const TeamsPage = () => {
  const personnel = personnelService.getPersonnelList();
  
  return `
    <div class="fade-in-up content-area">
      <h1 class="page-title"><i class="fa-solid fa-users-gear" style="color: var(--accent-cyan);"></i> Saha Ekipleri ve Personel</h1>
      
      <div class="glass-panel" style="padding: 2rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
          <h3 style="font-family: 'Rajdhani', sans-serif; letter-spacing: 1px;">Sistem Kayıtlı Teknisyenler (${personnel.length})</h3>
          <button class="btn-cyber"><i class="fa-solid fa-user-plus"></i> Yeni Personel</button>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem;">
          ${personnel.map(p => `
            <div class="glass-card" style="display: flex; align-items: center; gap: 1rem; padding: 1rem;">
              <div style="width: 40px; height: 40px; background: rgba(0, 242, 254, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--accent-cyan);">
                <i class="fa-solid fa-user-gear"></i>
              </div>
              <div>
                <div style="font-weight: 700; font-size: 0.9rem;">${p}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted);">Saha Teknisyeni</div>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
                   <span style="width: 8px; height: 8px; background: var(--accent-green); border-radius: 50%;"></span>
                   <span style="font-size: 0.6rem; color: var(--accent-green); font-weight: 700;">MÜSAİT</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}
