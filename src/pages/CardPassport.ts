import { db } from '../firebase';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { dataService } from '../services/DataService';

interface RepairRecord {
  id?: string;
  sapNo: string;
  serialNo?: string;
  description: string;
  quantity: number;
  sourceWarehouseId: string;
  targetWarehouseId?: string;
  workshopId: string;
  sentBy: string;
  sentAt: any;
  status: 'PENDING_ARRIVAL' | 'UNDER_REPAIR' | 'REPAIRED' | 'SENT_BACK' | 'COMPLETED' | 'SCRAPPED' | 'REJECTED';
  receivedAt?: any;
  receivedBy?: string;
  repairedAt?: any;
  repairedBy?: string;
  repairNotes?: string;
  dispatchedAt?: any;
  dispatchedBy?: string;
  completedAt?: any;
  scrappedAt?: any;
  scrappedBy?: string;
  scrapReason?: string;
  faultCode?: string;
  faultDesc?: string;
  shelfNo?: string;
  boxNo?: string;
  dispatchNo?: string;
  mctNo?: string;
  assignedTo?: string;
  assignedAt?: any;
  repairStage?: 'DIAGNOSIS' | 'WAITING_PARTS' | 'REPAIRING' | 'TESTING';
  testStatus?: 'TESTED' | 'UNTESTED';
  noteLogs?: Array<{ date: any; user: string; text: string; stage?: string }>;
  usedComponents?: Array<any>;
  turbineNo?: string;
  reportNo?: string;
}

const formatDateTime = (dateVal: any): string => {
  if (!dateVal) return '-';
  try {
    const date = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return '-';
  }
};

const formatDateOnly = (dateVal: any): string => {
  if (!dateVal) return '-';
  try {
    const date = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch (e) {
    return '-';
  }
};

export const CardPassportPage = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const cardId = urlParams.get('id') || '';
  const sapNo = urlParams.get('sap') || '';
  const serialNo = urlParams.get('serial') || '';

  const warehouses = dataService.getWarehouses();

  let targetCard: RepairRecord | null = null;
  let historyCards: RepairRecord[] = [];

  try {
    // 1. Direct fetch by card ID
    if (cardId) {
      const docRef = doc(db, 'repairs', cardId);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        targetCard = { id: snap.id, ...snap.data() } as RepairRecord;
      }
    }

    // 2. Query by serial number and/or sap if not found by id
    const cleanSerial = (serialNo || '').trim();
    const cleanSap = (sapNo || '').trim();

    if (!targetCard && cleanSerial && cleanSerial !== '-') {
      const q = query(
        collection(db, 'repairs'),
        where('serialNo', '==', cleanSerial)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as RepairRecord));
        if (cleanSap) {
          targetCard = docs.find(d => d.sapNo === cleanSap) || docs[0];
        } else {
          targetCard = docs[0];
        }
      }
    }

    if (!targetCard && cleanSap) {
      const q = query(
        collection(db, 'repairs'),
        where('sapNo', '==', cleanSap),
        limit(5)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        targetCard = { id: snap.docs[0].id, ...snap.docs[0].data() } as RepairRecord;
      }
    }

    // 3. Fetch history for this card (all visits by serial number or SAP)
    const effectiveSerial = targetCard?.serialNo || cleanSerial;
    const effectiveSap = targetCard?.sapNo || cleanSap;

    if (effectiveSerial && effectiveSerial !== '-') {
      const histQ = query(
        collection(db, 'repairs'),
        where('serialNo', '==', effectiveSerial)
      );
      const histSnap = await getDocs(histQ);
      historyCards = histSnap.docs.map(d => ({ id: d.id, ...d.data() } as RepairRecord));
    } else if (effectiveSap) {
      const histQ = query(
        collection(db, 'repairs'),
        where('sapNo', '==', effectiveSap),
        limit(10)
      );
      const histSnap = await getDocs(histQ);
      historyCards = histSnap.docs.map(d => ({ id: d.id, ...d.data() } as RepairRecord));
    }

    // Sort history by date descending
    historyCards.sort((a, b) => {
      const timeA = a.sentAt?.toDate ? a.sentAt.toDate().getTime() : new Date(a.sentAt || 0).getTime();
      const timeB = b.sentAt?.toDate ? b.sentAt.toDate().getTime() : new Date(b.sentAt || 0).getTime();
      return timeB - timeA;
    });

  } catch (err) {
    console.error("CardPassportPage load error:", err);
  }

  if (!targetCard) {
    return `
      <div style="min-height: 100vh; background: #0A0E17; color: #FFF; display: flex; align-items: center; justify-content: center; padding: 1.5rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <div class="glass-panel" style="max-width: 480px; width: 100%; text-align: center; padding: 2.5rem 1.5rem; border-radius: 16px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
          <div style="width: 68px; height: 68px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); color: #EF4444; font-size: 2rem; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1.25rem;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 1.6rem; font-weight: 800; margin: 0 0 0.5rem 0; color: #FFF;">Kart Kaydı Bulunamadı</h2>
          <p style="color: #94A3B8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.75rem;">
            ${sapNo ? `<strong>SAP:</strong> ${sapNo}<br>` : ''}
            ${serialNo ? `<strong>Seri No:</strong> ${serialNo}<br>` : ''}
            Okutulan QR koda ait kart kaydı sistemde bulunamadı veya henüz atölye kaydı oluşturulmamış olabilir.
          </p>
          <button onclick="window.location.href='/'" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; border: none; padding: 0.75rem 1.75rem; border-radius: 8px; font-weight: 900; font-size: 0.9rem; cursor: pointer; box-shadow: 0 0 20px rgba(20,241,149,0.3);">
            <i class="fa-solid fa-house" style="margin-right: 6px;"></i> Ana Sayfaya Dön
          </button>
        </div>
      </div>
    `;
  }

  // Resolve warehouse names
  const sourceWhObj = warehouses.find(w => w.id === targetCard?.sourceWarehouseId || w.name === targetCard?.sourceWarehouseId);
  const sourceWhName = sourceWhObj?.name || targetCard.sourceWarehouseId || 'Belirtilmemiş';

  const isRepaired = targetCard.status === 'REPAIRED' || targetCard.status === 'SENT_BACK' || targetCard.status === 'COMPLETED';
  const isTested = targetCard.testStatus === 'TESTED' || (!targetCard.testStatus && isRepaired);

  const stageNames: Record<string, { label: string; color: string; icon: string }> = {
    'DIAGNOSIS': { label: 'Teşhis & Arıza Tespiti', color: '#f59e0b', icon: 'fa-microchip' },
    'WAITING_PARTS': { label: 'Komponent / Parça Bekliyor', color: '#ef4444', icon: 'fa-clock' },
    'REPAIRING': { label: 'Onarım & Lehimleme Yapılıyor', color: '#3b82f6', icon: 'fa-screwdriver-wrench' },
    'TESTING': { label: 'Test Masasında Doğrulanıyor', color: '#8b5cf6', icon: 'fa-vial-circle-check' }
  };

  const currentStageInfo = targetCard.repairStage ? stageNames[targetCard.repairStage] : null;

  return `
    <div style="min-height: 100vh; background: #070B12; color: #E2E8F0; padding: 1.25rem 0.75rem; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      
      <div style="max-width: 680px; margin: 0 auto;">
        
        <!-- Header Brand Badge -->
        <div style="background: linear-gradient(135deg, rgba(20, 241, 149, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%); border: 1px solid rgba(20, 241, 149, 0.35); border-radius: 14px; padding: 1.25rem; margin-bottom: 1.25rem; text-align: center; box-shadow: 0 0 30px rgba(20, 241, 149, 0.12);">
          <div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 4px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: #14F195; display: inline-flex; align-items: center; justify-content: center; color: #0A0E17; font-size: 1.1rem; font-weight: 900;">
              ⚡
            </div>
            <span style="font-family: 'Rajdhani', sans-serif; font-size: 1.35rem; font-weight: 900; color: #14F195; letter-spacing: 1.5px; text-transform: uppercase;">
              DEMİRER HOLDİNG
            </span>
          </div>
          <div style="font-size: 0.8rem; color: #94A3B8; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase;">
            MERKEZ TAMİR ATÖLYESİ — DİJİTAL KART KARNESİ
          </div>
        </div>

        <!-- 1. HERO IDENTITY CARD -->
        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 1.5rem; margin-bottom: 1.25rem; box-shadow: 0 15px 35px rgba(0,0,0,0.5);">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem;">
            <div>
              <div style="font-size: 1.35rem; font-weight: 900; color: #FFFFFF; font-family: 'Rajdhani', sans-serif; line-height: 1.3;">
                ${targetCard.description}
              </div>
              <div style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
                <span style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4); padding: 3px 10px; border-radius: 6px; font-size: 0.85rem; font-family: monospace; font-weight: 800;">
                  SAP: ${targetCard.sapNo}
                </span>
                <span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.4); padding: 3px 10px; border-radius: 6px; font-size: 0.85rem; font-family: monospace; font-weight: 800;">
                  SERİ: ${targetCard.serialNo || '-'}
                </span>
              </div>
            </div>
            
            <div style="text-align: right; flex-shrink: 0;">
              ${isRepaired ? `
                <div style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.4); padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 900; display: inline-flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-circle-check"></i> REVİZE SAĞLAM
                </div>
              ` : `
                <div style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 900; display: inline-flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-screwdriver-wrench"></i> ATÖLYEDE İŞLEMDE
                </div>
              `}
              
              <div style="margin-top: 6px;">
                ${isTested ? `
                  <span style="background: rgba(20, 241, 149, 0.1); color: #34d399; border: 1px solid rgba(20, 241, 149, 0.25); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; display: inline-block;">
                    ✓ Test Edildi
                  </span>
                ` : `
                  <span style="background: rgba(245, 158, 11, 0.1); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.25); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; display: inline-block;">
                    ⚠️ Türbinde Test Edilecek
                  </span>
                `}
              </div>
            </div>
          </div>

          <!-- Quick Metrics Grid -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem; font-size: 0.8rem;">
            <div style="background: rgba(0,0,0,0.35); padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
              <span style="color: #64748B; font-size: 0.7rem; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Sökülen Santral</span>
              <strong style="color: #FFF; font-size: 0.9rem;">${sourceWhName}</strong>
            </div>
            
            <div style="background: rgba(0,0,0,0.35); padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
              <span style="color: #64748B; font-size: 0.7rem; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Atölye Rafı</span>
              <strong style="color: #fbbf24; font-size: 0.9rem; font-family: monospace;">${targetCard.shelfNo && targetCard.shelfNo !== '-' ? targetCard.shelfNo : 'Atölye Masası'}</strong>
            </div>

            <div style="background: rgba(0,0,0,0.35); padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
              <span style="color: #64748B; font-size: 0.7rem; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Sevk / MÇT No</span>
              <strong style="color: #38bdf8; font-size: 0.9rem; font-family: monospace;">${targetCard.dispatchNo || targetCard.mctNo || '-'}</strong>
            </div>

            <div style="background: rgba(0,0,0,0.35); padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
              <span style="color: #64748B; font-size: 0.7rem; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 2px;">Atölyeye Geliş</span>
              <strong style="color: #FFF; font-size: 0.85rem;">${formatDateOnly(targetCard.sentAt)}</strong>
            </div>
          </div>

        </div>

        <!-- 2. SAHA & ARIZA KÖKENİ -->
        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 1rem; color: #F59E0B; font-size: 0.95rem; font-weight: 800; text-transform: uppercase;">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <span>Saha Söküm & Geliş Arıza Bilgisi</span>
          </div>

          <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 10px; padding: 1rem; margin-bottom: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: baseline; flex-wrap: wrap; gap: 6px;">
              <span style="color: #F59E0B; font-size: 0.75rem; font-weight: 800; text-transform: uppercase;">
                Arıza Kodu: ${targetCard.faultCode || 'Belirtilmedi'}
              </span>
              ${targetCard.turbineNo ? `
                <span style="background: rgba(255,255,255,0.06); padding: 2px 8px; border-radius: 4px; color: #E2E8F0; font-size: 0.75rem; font-weight: 700;">
                  Türbin: ${targetCard.turbineNo}
                </span>
              ` : ''}
            </div>
            
            <div style="color: #FFFFFF; font-weight: 700; font-size: 0.95rem; margin-top: 6px; line-height: 1.4;">
              ${targetCard.faultDesc || 'Saha raporu genel arıza kaydıyla sevk edildi.'}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; color: #94A3B8; font-size: 0.75rem; padding: 0 4px;">
            <span><strong>Sevk Eden:</strong> ${targetCard.sentBy || 'Saha Yönetimi'}</span>
            <span><strong>Sevk Tarihi:</strong> ${formatDateTime(targetCard.sentAt)}</span>
          </div>
        </div>

        <!-- 3. ATÖLYE MÜDAHALE & YAPILAN ONARIM İŞLEMLERİ -->
        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
            <div style="display: flex; align-items: center; gap: 8px; color: #14F195; font-size: 0.95rem; font-weight: 800; text-transform: uppercase;">
              <i class="fa-solid fa-screwdriver-wrench"></i>
              <span>Atölye Onarım & Müdahale Özeti</span>
            </div>
            ${currentStageInfo ? `
              <span style="background: rgba(255,255,255,0.05); color: ${currentStageInfo.color}; border: 1px solid ${currentStageInfo.color}40; padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700;">
                <i class="fa-solid ${currentStageInfo.icon}" style="margin-right: 4px;"></i> ${currentStageInfo.label}
              </span>
            ` : ''}
          </div>

          <div style="background: rgba(20, 241, 149, 0.05); border: 1px solid rgba(20, 241, 149, 0.25); border-radius: 10px; padding: 1rem; margin-bottom: 1rem;">
            <div style="font-size: 0.72rem; color: #14F195; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">
              Yapılan Komponent Değişimi & Lehim İşlemleri
            </div>
            <div style="font-size: 0.9rem; color: #FFF; font-weight: 600; line-height: 1.5;">
              ${targetCard.repairNotes || 'Kart üzerinde standart kompanzasyon, lehim yenileme ve komponent ölçüm testleri gerçekleştirildi.'}
            </div>
            
            ${targetCard.repairedAt ? `
              <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 8px; border-top: 1px dashed rgba(20, 241, 149, 0.2); font-size: 0.75rem; color: #94A3B8;">
                <span><strong>Tamir Eden:</strong> ${targetCard.repairedBy || 'Atölye Teknisyeni'}</span>
                <span><strong>Onarım Tarihi:</strong> ${formatDateTime(targetCard.repairedAt)}</span>
              </div>
            ` : ''}
          </div>

          <!-- Used Electronic Components (Devre Elemanları) -->
          ${(targetCard.usedComponents && targetCard.usedComponents.length > 0) ? `
            <div style="background: rgba(0, 242, 255, 0.04); border: 1px solid rgba(0, 242, 255, 0.25); border-radius: 10px; padding: 1rem; margin-bottom: 1rem;">
              <div style="font-size: 0.75rem; color: #00f2ff; font-weight: 800; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-microchip"></i>
                Kullanılan Orijinal Devre Elemanları (${targetCard.usedComponents.length} Kalem)
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px;">
                ${targetCard.usedComponents.map((c: any) => `
                  <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); padding: 8px 10px; border-radius: 6px;">
                    <div style="font-weight: 700; color: #FFF; font-size: 0.82rem;">${c.name}</div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #94A3B8; margin-top: 4px;">
                      <span style="font-family: monospace; color: #00f2ff;">${c.code}</span>
                      <span style="color: #14F195; font-weight: 800;">${c.quantity} Adet</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Chronological Stage Logs -->
          ${targetCard.noteLogs && targetCard.noteLogs.length > 0 ? `
            <div style="margin-top: 1rem;">
              <div style="font-size: 0.8rem; color: #94A3B8; font-weight: 800; text-transform: uppercase; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-timeline" style="color: #38bdf8;"></i>
                <span>Kronolojik Müdahale & Onarım Notları (${targetCard.noteLogs.length})</span>
              </div>
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${targetCard.noteLogs.map(log => `
                  <div style="background: rgba(0,0,0,0.3); border-left: 3px solid #14F195; padding: 8px 12px; border-radius: 6px; font-size: 0.8rem;">
                    <div style="display: flex; justify-content: space-between; color: #64748B; font-size: 0.72rem; margin-bottom: 4px;">
                      <span><strong style="color: #38bdf8;">${log.stage || 'İŞLEM'}</strong> — ${log.user}</span>
                      <span>${formatDateTime(log.date)}</span>
                    </div>
                    <div style="color: #E2E8F0; font-weight: 500; line-height: 1.4;">
                      ${log.text}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

        </div>

        <!-- 4. TÜM ATÖLYE YAŞAM DÖNGÜSÜ (ÖNCEKİ GELİŞLER) -->
        ${historyCards.length > 1 ? `
          <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
            <div style="font-size: 0.9rem; font-weight: 800; color: #38bdf8; text-transform: uppercase; margin-bottom: 1rem; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-rotate-right"></i>
              <span>Bu Kartın Toplam Atölye Geçmişi (${historyCards.length} Ziyaret)</span>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${historyCards.map((h, idx) => {
                const isCurrent = h.id === targetCard?.id;
                const hWh = warehouses.find(w => w.id === h.sourceWarehouseId)?.name || h.sourceWarehouseId || '-';
                return `
                  <div style="background: ${isCurrent ? 'rgba(20, 241, 149, 0.05)' : 'rgba(0,0,0,0.25)'}; border: 1px solid ${isCurrent ? 'rgba(20, 241, 149, 0.3)' : 'rgba(255,255,255,0.05)'}; padding: 10px 12px; border-radius: 10px; font-size: 0.8rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; color: #94A3B8; margin-bottom: 4px;">
                      <span>
                        <strong style="color: #FFF;">#${historyCards.length - idx}. Geliş</strong> — ${formatDateOnly(h.sentAt)} (${hWh})
                      </span>
                      <span style="color: ${h.status === 'REPAIRED' ? '#14F195' : '#60a5fa'}; font-weight: 800; font-size: 0.75rem;">
                        ${h.status === 'REPAIRED' ? 'REVİZE SAĞLAM' : h.status}
                      </span>
                    </div>
                    <div style="color: #E2E8F0; margin-top: 4px; line-height: 1.3;">
                      ${h.faultCode ? `<span style="color: #fbbf24; font-weight: 700;">[Arıza: ${h.faultCode}]</span> ` : ''}
                      ${h.repairNotes || 'Standart kontrol ve revizyon'}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <!-- 5. BOTTOM NAVIGATION -->
        <div style="text-align: center; margin-top: 1.5rem; margin-bottom: 2.5rem;">
          <button onclick="window.location.href='/'" style="background: rgba(255,255,255,0.08); color: #FFF; border: 1px solid rgba(255,255,255,0.15); padding: 0.75rem 1.75rem; border-radius: 10px; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
            <i class="fa-solid fa-arrow-left" style="margin-right: 8px;"></i> Servis Portalına Git
          </button>
        </div>

      </div>

    </div>
  `;
};
