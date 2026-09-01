import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { personnelService } from '../services/PersonnelService';

export async function renderLeavePublicVerifyPage(requestId: string): Promise<string> {
  const styleId = 'leave-verify-public-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .public-body {
        background: #050a10;
        color: #f8fafc;
        font-family: 'Inter', system-ui, sans-serif;
        min-height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 1rem;
        box-sizing: border-box;
      }
      .public-card {
        width: 100%;
        max-width: 480px;
        background: rgba(13, 25, 41, 0.75);
        border: 1px solid rgba(0, 243, 255, 0.15);
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 243, 255, 0.05);
        backdrop-filter: blur(12px);
        padding: 2rem;
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
      }
      .public-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #00f3ff, #10b981);
      }
      .badge-verified {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.25);
        color: #10b981;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 800;
        font-size: 0.85rem;
        letter-spacing: 1px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        text-transform: uppercase;
        margin-bottom: 1.5rem;
        text-shadow: 0 0 8px rgba(16, 185, 129, 0.3);
      }
      .badge-pending {
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.25);
        color: #f59e0b;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: 800;
        font-size: 0.85rem;
        letter-spacing: 1px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        text-transform: uppercase;
        margin-bottom: 1.5rem;
        text-shadow: 0 0 8px rgba(245, 158, 11, 0.3);
      }
      .field-row {
        display: flex;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        font-size: 0.85rem;
      }
      .field-label {
        color: #94a3b8;
        font-weight: 600;
      }
      .field-value {
        color: #ffffff;
        font-weight: 700;
        text-align: right;
      }
      .stamp-box {
        border-radius: 8px;
        padding: 10px;
        margin-top: 1rem;
        font-size: 0.75rem;
        font-family: monospace;
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);
  }

  try {
    const docRef = doc(db, 'leaveRequests', requestId);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return `
        <div class="public-body">
          <div class="public-card" style="text-align: center;">
            <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444; font-size: 3rem; margin-bottom: 1rem;"></i>
            <h2 style="font-family: 'Rajdhani', sans-serif; font-weight: 800; color: #fff; margin-bottom: 0.5rem;">GEÇERSİZ BARKOD</h2>
            <p style="color: #94a3b8; font-size: 0.9rem;">Sistemde bu referans numarasına ait bir izin kaydı bulunamadı.</p>
          </div>
        </div>
      `;
    }

    const data = snap.data();
    const isApproved = data.status === 'APPROVED';
    
    // Resolve company from data or fall back to personnel service details
    let rawCompany = data.company || '';
    if (!rawCompany) {
      const pDetails = personnelService.getPersonnelDetailsList().find(
        p => p.name.toLowerCase().trim() === data.userName.toLowerCase().trim()
      );
      if (pDetails?.company) {
        rawCompany = pDetails.company;
      }
    }

    // Resolve full company name
    const companyMapping: Record<string, string> = {
      'yek': 'YEK Demirer Enerji Yatırım Danışmanlık A.Ş.',
      'har film': 'Har Film Yapım Enerji Yatırım Danışmanlık ve Tic. A.Ş.',
      'demirer enerji': 'Demirer Enerji Elektrik Üretim A.Ş.',
      'demirer holding': 'DEMİRER HOLDİNG A.Ş.'
    };
    const cleanCo = rawCompany.toLowerCase().trim();
    let company = rawCompany;
    for (const [key, full] of Object.entries(companyMapping)) {
      if (cleanCo === key || cleanCo.includes(key)) {
        company = full;
        break;
      }
    }
    if (!company) company = 'Demirer Enerji Elektrik Üretim A.Ş.';

    const typeMap: Record<string, string> = {
      'YILLIK_IZIN': 'Yıllık İzin',
      'RAPOR': 'Sağlık Raporu',
      'MAZERET': 'Mazeret İzni',
      'UCRETSIZ': 'Ücretsiz İzin',
      'MESAI_IZNI': 'Mesai İzni',
      'EVLILIK_IZNI': 'Evlilik İzni',
      'DOGUM_IZNI': 'Doğum İzni'
    };

    const requestedDateStr = data.requestedAt?.seconds 
      ? new Date(data.requestedAt.seconds * 1000).toLocaleString('tr-TR')
      : '---';

    const startDateStr = new Date(data.startDate).toLocaleDateString('tr-TR');
    const endDateStr = new Date(data.endDate).toLocaleDateString('tr-TR');

    return `
      <div class="public-body">
        <div class="public-card">
          <div style="text-align: center; margin-bottom: 1.5rem;">
            ${isApproved 
              ? `<div class="badge-verified"><i class="fa-solid fa-circle-check"></i> Doğrulanmış İzin Belgesi</div>`
              : `<div class="badge-pending"><i class="fa-solid fa-clock"></i> Onay Sürecinde</div>`
            }
            <h2 style="margin: 0; color: #fff; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.4rem; letter-spacing: 0.5px; text-transform: uppercase;">
              DİJİTAL İZİN DOĞRULAMA
            </h2>
            <p style="margin: 4px 0 0 0; color: var(--accent-cyan); font-size: 0.75rem; font-weight: 800; font-family: monospace;">
              REF NO: ${requestId}
            </p>
          </div>

          <div style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 1.5rem;">
            <div class="field-row">
              <span class="field-label">Şirket</span>
              <span class="field-value" style="font-size: 0.75rem; max-width: 250px;">${company}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Personel</span>
              <span class="field-value">${data.userName}</span>
            </div>
            <div class="field-row">
              <span class="field-label">İzin Türü</span>
              <span class="field-value">${typeMap[data.type] || data.type}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Başlangıç Tarihi</span>
              <span class="field-value">${startDateStr}</span>
            </div>
            <div class="field-row">
              <span class="field-label">Bitiş Tarihi</span>
              <span class="field-value">${endDateStr}</span>
            </div>
            <div class="field-row">
              <span class="field-label">İzin Süresi</span>
              <span class="field-value">${data.duration} Gün</span>
            </div>
            <div class="field-row">
              <span class="field-label">Talep Tarihi</span>
              <span class="field-value">${requestedDateStr}</span>
            </div>
          </div>

          <!-- Digital Stamps section -->
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <div class="stamp-box" style="border: 1px solid rgba(22, 163, 74, 0.25); background: rgba(22, 163, 74, 0.05); color: #22c55e;">
              <strong>[DİJİTAL TALEP EDİLDİ]</strong><br>
              Talep Sahibi: ${data.userName}<br>
              Tarih: ${requestedDateStr}
            </div>

            ${data.firstApprovedBy ? `
              <div class="stamp-box" style="border: 1px solid rgba(2, 132, 199, 0.25); background: rgba(2, 132, 199, 0.05); color: #38bdf8;">
                <strong>[DİJİTAL ÖN ONAY]</strong><br>
                Onaylayan: ${data.firstApprovedBy}<br>
                Tarih: ${data.firstApprovedAt?.seconds ? new Date(data.firstApprovedAt.seconds * 1000).toLocaleString('tr-TR') : '---'}
              </div>
            ` : ''}

            ${data.finalApprovedBy ? `
              <div class="stamp-box" style="border: 1px solid rgba(22, 163, 74, 0.25); background: rgba(22, 163, 74, 0.05); color: #22c55e;">
                <strong>[DİJİTAL SON ONAY]</strong><br>
                Onaylayan: ${data.finalApprovedBy}<br>
                Tarih: ${data.finalApprovedAt?.seconds ? new Date(data.finalApprovedAt.seconds * 1000).toLocaleString('tr-TR') : '---'}
              </div>
            ` : ''}
          </div>

          <div style="text-align: center; margin-top: 1.5rem; font-size: 0.7rem; color: #64748b;">
            Bu belge güvenli dijital kimlik doğrulama sistemleri aracılığıyla onaylanmış resmi bir izin belgesidir.
          </div>
        </div>
      </div>
    `;
  } catch (err: any) {
    console.error(err);
    return `
      <div class="public-body">
        <div class="public-card" style="text-align: center;">
          <i class="fa-solid fa-circle-exclamation" style="color: #ef4444; font-size: 3rem; margin-bottom: 1rem;"></i>
          <h2 style="color: #fff;">Sorgu Başarısız</h2>
          <p style="color: #94a3b8;">Veriler alınırken bir hata oluştu: ${err.message}</p>
        </div>
      </div>
    `;
  }
}
