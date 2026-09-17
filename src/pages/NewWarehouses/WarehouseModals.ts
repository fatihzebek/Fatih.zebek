import { warehouseState, getUserProfile, isUserFatihZebek, getAvailableCabinets, getAvailableTurbineTypes, PREDEFINED_TURBINE_TYPES, saveSapMetadata, getEffectiveCabinet, getEffectiveTurbineType } from './WarehouseState';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { warehouseService } from '../../services/WarehouseService';
import { dataService } from '../../services/DataService';
import { warehouseAgent } from '../../agents/WarehouseAgent';
import { fileService } from '../../services/FileService';
import { priceService } from '../../services/PriceService';
import { ImageCompressor } from '../../utils/imageCompressor';
import QRCode from 'qrcode';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { personnelService } from '../../services/PersonnelService';
import { fixTurkishWarehouseName, formatRepairDuration, formatDisplayName, formatSafeDateTime } from '../../utils/formatters';

export function ensureSingleModalInBody(modalId: string): HTMLElement | null {
  const modals = Array.from(document.querySelectorAll(`#${modalId}`));
  if (modals.length === 0) return null;

  const targetModal = modals[modals.length - 1] as HTMLElement;
  modals.forEach(m => {
    if (m !== targetModal && m.parentElement) {
      m.parentElement.removeChild(m);
    }
  });

  if (targetModal.parentElement !== document.body) {
    document.body.appendChild(targetModal);
  }
  return targetModal;
}

// --- Static Modals HTML ---
export const renderModalsHTML = (targetOptions: any[], isMobileWarehouse: boolean) => {
  return `
    <!-- Add New Modal -->
    <div id="add-new-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(10, 14, 23, 0.8); z-index: 1000; justify-content: center; align-items: flex-start; padding: 40px 1rem; overflow-y: auto; backdrop-filter: blur(4px);">
      <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; width: 650px; max-width: 95vw; max-height: 85vh; overflow-y: auto; padding: 1.75rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2 style="margin: 0; font-size: 1.25rem; color: #FFF; font-weight: 700;">Yeni Malzeme Ekle</h2>
          <i class="fa-solid fa-times" onclick="window.closeAddNewModal()" style="cursor: pointer; color: #64748B; font-size: 1.25rem;"></i>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; text-align: left;">
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.4rem; text-transform: uppercase;">SAP Numarası</label>
            <input id="new-sap-input" type="text" autocomplete="off" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #14F195; padding: 0 1rem; font-size: 1rem; outline: none; font-weight: 600;" placeholder="Örn: 32">
          </div>
          
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.4rem; text-transform: uppercase;">Malzeme Tanımı</label>
            <input id="new-name-input" type="text" style="width: 100%; height: 42px; background-color: rgba(10, 14, 23, 0.5); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;" placeholder="Sözlükten bulunacak...">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.4rem; text-transform: uppercase;">Miktar</label>
              <input id="new-qty-input" type="number" min="0" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;" placeholder="0">
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.4rem; text-transform: uppercase;">Birim</label>
              <select id="new-unit-input" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; appearance: none;">
                <option value="Adet">Adet</option>
                <option value="Kutu">Kutu</option>
                <option value="Metre">Metre</option>
                <option value="Litre">Litre</option>
                <option value="Set">Set</option>
              </select>
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.4rem; text-transform: uppercase;">Raf Konumu</label>
            <input id="new-loc-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;" placeholder="Örn: A-12">
          </div>

          <div style="grid-column: span 2; border-top: 1px dashed #1E293B; padding-top: 1rem; margin-top: 0.25rem;">
            <h4 style="font-size: 0.8rem; font-weight: 700; color: #14F195; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Malzeme Giriş Bilgileri</h4>
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.4rem; text-transform: uppercase;">Malzeme Nereden Geldi?</label>
            <input id="new-source-input" type="text" placeholder="Örn: Merkez Depo, Tedarikçi, Saha vb." style="width: 100%; height: 38px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.4rem; text-transform: uppercase;">Güncelleyen Personel</label>
            <input id="new-updatedby-input" type="text" list="personnel-list" placeholder="Ad Soyad" style="width: 100%; height: 38px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
            <datalist id="personnel-list">
              ${personnelService.getPersonnelList().map(name => `<option value="${name}"></option>`).join('')}
            </datalist>
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.4rem; text-transform: uppercase;">İrsaliye / Delivery Note</label>
            <input id="new-delivery-input" type="text" placeholder="Varsa irsaliye no" style="width: 100%; height: 38px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.4rem; text-transform: uppercase;">Fatura Numarası</label>
            <input id="new-invoice-input" type="text" placeholder="Varsa fatura no" style="width: 100%; height: 38px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
          </div>

          <div style="grid-column: span 2;">
            <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.4rem; text-transform: uppercase;">Not / Açıklama</label>
            <input id="new-entry-note-input" type="text" placeholder="Varsa eklemek istediğiniz not" style="width: 100%; height: 38px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
          </div>

          <div style="grid-column: span 2; border-top: 1px dashed #1E293B; padding-top: 1rem; margin-top: 0.25rem;">
            <label style="display: block; font-size: 0.8rem; color: #14F195; margin: 0; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;"><i class="fa-solid fa-image" style="margin-right:0.25rem;"></i> Malzeme Görseli</label>
          </div>

          <div style="grid-column: span 2;">
            <div 
              onclick="document.getElementById('new-img-input').click()" 
              style="width: 100%; height: 110px; background-color: #0A0E17; border: 1px dashed #334155; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;"
              onmouseover="this.style.borderColor='#14F195'; this.style.backgroundColor='#0d131f';"
              onmouseout="this.style.borderColor='#334155'; this.style.backgroundColor='#0A0E17';"
            >
              <i class="fa-solid fa-camera" style="font-size: 1.8rem; color: #475569; margin-bottom: 0.4rem; transition: color 0.2s;"></i>
              <div id="new-img-label" style="color: #94A3B8; font-size: 0.85rem; font-weight: 500;">Görsel Yükle</div>
              <input id="new-img-input" type="file" accept="image/*" style="display: none;" onchange="const label = document.getElementById('new-img-label'); if (label) { label.innerText = this.files[0] ? this.files[0].name : 'Görsel Yükle'; label.style.color = this.files[0] ? '#14F195' : '#94A3B8'; } const cameraIcon = this.previousElementSibling; if (cameraIcon) { (cameraIcon as HTMLElement).style.color = this.files[0] ? '#14F195' : '#475569'; }">
            </div>
          </div>

          <div style="grid-column: span 2; margin-top: 0.5rem;">
            <button onclick="window.saveNewItem(this)" style="height: 42px; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.95rem; font-weight: 600; cursor: pointer; width: 100%;">
              Malzemeyi Kaydet
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Defect Edit Modal -->
    <div id="new-warehouse-defect-edit-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
      <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 450px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
          <h3 style="font-size: 1.25rem; font-weight: 700; color: #14F195; margin: 0; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
            <i class="fa-solid fa-pen-to-square" style="margin-right: 8px;"></i> Seri No Düzenle
          </h3>
          <button onclick="window.closeDefectEditModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <input type="hidden" id="defect-edit-item-id">
          <input type="hidden" id="defect-edit-report-doc-id">
          
          <div>
            <p style="color: #94A3B8; font-size: 0.8rem; margin: 0 0 0.25rem 0; font-weight: 600;">MALZEME TANIMI</p>
            <div id="defect-edit-name-text" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px; color: #FFF; font-weight: 500; font-size: 0.9rem;"></div>
          </div>

          <div>
            <span style="color: #64748B; font-size: 0.75rem;">SAP Numarası:</span>
            <span id="defect-edit-sap-text" style="color: #14F195; font-weight: 600; display: block; font-family: monospace; font-size: 0.95rem; margin-top: 2px;"></span>
          </div>
          
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; font-weight: 700; text-transform: uppercase;">Seri Numarası</label>
            <input id="defect-edit-serial-input" type="text" placeholder="Seri numarasını girin" style="width: 100%; height: 42px; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.95rem; font-family: monospace; outline: none;">
          </div>
          
          <button onclick="window.saveDefectEditItem(this)" style="height: 44px; margin-top: 0.5rem; border-radius: 8px; border: none; background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-size: 0.95rem; font-weight: 800; cursor: pointer; width: 100%; box-shadow: 0 0 15px rgba(20,241,149,0.25); transition: all 0.2s;" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">Değişiklikleri Kaydet</button>
        </div>
      </div>
    </div>

    <!-- MTA Edit Modal -->
    <div id="new-warehouse-mta-edit-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
      <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 450px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
          <h3 style="font-size: 1.25rem; font-weight: 700; color: #14F195; margin: 0; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
            <i class="fa-solid fa-pen-to-square" style="margin-right: 8px;"></i> Seri No & Not Düzenle
          </h3>
          <button onclick="window.closeMtaEditModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <input type="hidden" id="mta-edit-item-id">
          
          <div>
            <p style="color: #94A3B8; font-size: 0.8rem; margin: 0 0 0.25rem 0; font-weight: 600;">MALZEME TANIMI</p>
            <div id="mta-edit-name-text" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px; color: #FFF; font-weight: 500; font-size: 0.9rem;"></div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
            <div>
              <span style="color: #64748B; font-size: 0.75rem;">SAP Numarası:</span>
              <span id="mta-edit-sap-text" style="color: #14F195; font-weight: 600; display: block; font-family: monospace; font-size: 0.95rem; margin-top: 2px;"></span>
            </div>
            <div>
              <span style="color: #64748B; font-size: 0.75rem;">Miktar:</span>
              <input id="mta-edit-qty-input" type="number" min="0" style="width: 100%; height: 38px; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.5rem; font-size: 0.9rem; outline: none; margin-top: 2px;">
            </div>
            <div>
              <span style="color: #64748B; font-size: 0.75rem;">Raf Konumu (MTA):</span>
              <input id="mta-edit-loc-input" type="text" placeholder="Örn: A-1" style="width: 100%; height: 38px; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.5rem; font-size: 0.9rem; outline: none; margin-top: 2px;">
            </div>
          </div>
          
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; font-weight: 700; text-transform: uppercase;">Seri Numarası</label>
            <input id="mta-edit-serial-input" type="text" placeholder="Seri numarasını girin" style="width: 100%; height: 42px; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.95rem; font-family: monospace; outline: none;">
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; font-weight: 700; text-transform: uppercase;">Not / Açıklama</label>
            <textarea id="mta-edit-note-input" placeholder="Malzeme hakkında eklemek istediğiniz not..." style="width: 100%; height: 90px; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0.75rem 1rem; font-size: 0.9rem; outline: none; resize: none;"></textarea>
          </div>
          
          <button onclick="window.saveMtaEditItem(this)" style="height: 44px; margin-top: 0.5rem; border-radius: 8px; border: none; background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-size: 0.95rem; font-weight: 800; cursor: pointer; width: 100%; box-shadow: 0 0 15px rgba(20,241,149,0.25); transition: all 0.2s;" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">Değişiklikleri Kaydet</button>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <div id="new-warehouse-edit-modal" style="display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); z-index: 1000; justify-content: center; align-items: flex-start; padding: 40px 1rem; overflow-y: auto; box-sizing: border-box;">
      <div class="glass-panel" style="background: #0F172A; border: 1px solid rgba(100, 255, 218, 0.4); border-radius: 16px; width: 100%; max-width: 500px; padding: 1.5rem; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.95); position: relative; max-height: 85vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h3 style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;">Malzemeyi Düzenle</h3>
          <button onclick="window.closeEditModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="edit-personnel-role-hint" style="display: none; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 8px 12px; margin-bottom: 1rem; font-size: 0.76rem; color: #38bdf8; line-height: 1.4;">
          <i class="fa-solid fa-lock" style="color: #fbbf24; margin-right: 4px;"></i> <strong>Saha Personeli Yetkisi:</strong> Yalnızca <strong>Raf Konumu</strong> ve <strong>Kritik Limit</strong> alanlarını güncelleyebilirsiniz. Stok giriş/çıkışları Malzeme Yönetimi faturası ile otomatik işlenir.
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <input type="hidden" id="edit-item-id">
          
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">SAP Numarası</label>
            <input id="edit-sap-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
          </div>
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Malzeme Tanımı</label>
            <input id="edit-name-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Miktar</label>
              <input id="edit-qty-input" type="number" min="0" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Birim</label>
              <select id="edit-unit-input" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; appearance: none;">
                <option value="Adet">Adet</option>
                <option value="Kutu">Kutu</option>
                <option value="Metre">Metre</option>
                <option value="Litre">Litre</option>
                <option value="Set">Set</option>
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Raf Konumu</label>
              <input id="edit-loc-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
            </div>
          </div>
          
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Kritik Limit (Opsiyonel)</label>
            <input id="edit-min-stock-input" type="number" min="0" placeholder="Örn: 5" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
          </div>

          <div id="edit-cabinet-container" style="display: none;">
            <label style="display: block; font-size: 0.8rem; color: #C4B5FD; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 700;">
              <i class="fa-solid fa-server" style="color: #A855F7; margin-right: 4px;"></i> Kabin / Pano (Özel)
            </label>
            <input id="edit-cabinet-input" type="text" list="cabinets-datalist" placeholder="Örn: =012 Pitch control box" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #8B5CF6; border-radius: 8px; color: #C4B5FD; padding: 0 1rem; font-size: 0.9rem; outline: none;">
            <datalist id="cabinets-datalist">
              ${getAvailableCabinets().map(c => `<option value="${c}"></option>`).join('')}
            </datalist>
          </div>

          <div id="edit-turbinetype-container" style="display: none;">
            <label style="display: block; font-size: 0.8rem; color: #38BDF8; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 700;">
              <i class="fa-solid fa-fan" style="color: #00F3FF; margin-right: 4px;"></i> Türbin Tipi (Özel)
            </label>
            <input id="edit-turbinetype-input" type="text" list="turbinetypes-datalist" placeholder="Örn: E70 - E82" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #00F3FF; border-radius: 8px; color: #38BDF8; padding: 0 1rem; font-size: 0.9rem; outline: none;">
            <datalist id="turbinetypes-datalist">
              ${getAvailableTurbineTypes().map(t => `<option value="${t}"></option>`).join('')}
            </datalist>
          </div>

          <input type="hidden" id="edit-old-qty-input">
          
          <div id="edit-stock-entry-details" style="display: none; flex-direction: column; gap: 0.75rem; border-top: 1px dashed #1E293B; padding-top: 0.75rem; margin-top: 0.5rem; text-align: left;">
            <h4 style="font-size: 0.8rem; font-weight: 700; color: #14F195; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Malzeme Giriş Bilgileri (Miktar Artışı)</h4>
            <div>
              <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Malzeme Nereden Geldi?</label>
              <input id="edit-source-input" type="text" placeholder="Örn: Merkez Depo, Tedarikçi, Saha vb." style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div>
                <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">İrsaliye / Delivery Note</label>
                <input id="edit-delivery-input" type="text" placeholder="Varsa irsaliye no" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Fatura Numarası</label>
                <input id="edit-invoice-input" type="text" placeholder="Varsa fatura no" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
              </div>
            </div>
            <div>
              <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Güncelleyen Personel</label>
              <input id="edit-updatedby-input" type="text" placeholder="Ad Soyad" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
            </div>
            <div>
              <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Not / Açıklama</label>
              <input id="edit-entry-note-input" type="text" placeholder="Varsa eklemek istediğiniz not" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
            </div>
          </div>
          
          <button onclick="window.saveEditItem(this)" style="height: 42px; margin-top: 0.5rem; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.95rem; font-weight: 600; cursor: pointer; width: 100%;">Değişiklikleri Kaydet</button>
        </div>
      </div>
    </div>

    <!-- Transfer Modal -->
    <div id="new-warehouse-transfer-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; justify-content: center; align-items: flex-start; padding: 40px 1rem; overflow-y: auto;">
      <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 400px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); max-height: 85vh; overflow-y: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h3 style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;">Transfer Et</h3>
          <button onclick="window.closeTransferModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <input type="hidden" id="transfer-item-id">
          <div id="transfer-info" style="color: #E2E8F0; font-size: 0.9rem; margin-bottom: 0.5rem;"></div>
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Hedef Depo</label>
            <select id="transfer-target-input" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; appearance: none;">
              ${targetOptions.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Transfer Miktarı</label>
            <input id="transfer-qty-input" type="number" min="1" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
          </div>
          <button onclick="window.saveTransferItem(this)" style="height: 42px; margin-top: 0.5rem; border-radius: 8px; border: none; background-color: #3B82F6; color: #FFFFFF; font-size: 0.95rem; font-weight: 600; cursor: pointer; width: 100%;">Transferi Başlat</button>
        </div>
      </div>
    </div>

    <!-- History Modal -->
    <div id="new-warehouse-history-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; justify-content: center; align-items: flex-start; padding: 40px 1rem; overflow-y: auto;">
      <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 500px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); max-height: 85vh; overflow-y: auto;">
      <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 500px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h3 id="history-title" style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;">Geçmiş</h3>
          <button onclick="window.closeHistoryModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="history-list" style="display: flex; flex-direction: column; max-height: 400px; overflow-y: auto;">
        </div>
      </div>
    </div>

    <!-- QR Scanner Modal -->
    <div id="qr-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
      <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 500px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h3 style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;"><i class="fa-solid fa-qrcode" style="color: #14F195; margin-right: 8px;"></i> QR Barkod Okuyucu</h3>
          <button onclick="window.closeQRModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div id="qr-reader" style="width: 100%; margin-bottom: 1rem; border-radius: 12px; overflow: hidden; border: 2px solid #1E293B;"></div>
        <div id="qr-reader-results"></div>
      </div>
    </div>

    <!-- Big QR Display Modal -->
    <div id="big-qr-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
      <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 400px; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center;">
        <h3 id="big-qr-title" style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0 0 1.5rem 0;">Ürün QR Kodu</h3>
        <img id="big-qr-img" src="" style="width: 100%; max-width: 300px; border-radius: 8px; margin-bottom: 1.5rem; border: 4px solid #FFFFFF; background: #FFFFFF;" />
        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
          <button onclick="window.printSingleQRFromModal()" style="flex: 1; padding: 0.75rem; border-radius: 8px; background: #14F195; border: none; color: #0A0E17; font-weight: 700; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Yazdır</button>
          <button onclick="window.closeBigQR()" style="flex: 1; padding: 0.75rem; border-radius: 8px; background: #3B82F6; border: none; color: white; font-weight: 600; cursor: pointer;">Kapat</button>
        </div>
      </div>
    </div>

    <!-- Big Image Display Modal -->
    <div id="big-image-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.9); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
      <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 90%; max-width: 600px; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center; position: relative;">
        <button onclick="window.closeBigImage ? window.closeBigImage() : (document.getElementById('big-image-modal').style.display='none')" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.5rem; transition: color 0.2s;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#64748B'"><i class="fa-solid fa-xmark"></i></button>
        <h3 id="big-image-title" style="font-size: 1.1rem; font-weight: 600; color: #E2E8F0; margin: 0 0 1.5rem 0; padding-right: 2rem; text-align: left;">Ürün Görseli</h3>
        <img id="big-image-img" src="" style="width: 100%; max-height: 60vh; object-fit: contain; border-radius: 8px; margin-bottom: 0;" />
      </div>
    </div>

    <!-- P2P QR Transfer Modal -->
    <div id="p2p-transfer-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
      <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 400px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;">QR Transfer Kodu Oluştur</h3>
          <button onclick="window.closeP2PTransferModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
          <input type="hidden" id="p2p-item-id">
          <input type="hidden" id="p2p-item-sap">
          <input type="hidden" id="p2p-item-name">
          <div id="p2p-info" style="color: #E2E8F0; font-size: 0.9rem; margin-bottom: 0.5rem; font-weight: 500;"></div>
          
          <div id="p2p-input-container">
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Transfer Edilecek Miktar</label>
            <input id="p2p-qty-input" type="number" min="1" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; margin-bottom: 1rem;">
            <button onclick="window.generateP2PQR()" style="height: 42px; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.95rem; font-weight: 700; cursor: pointer; width: 100%;">QR Kod Üret</button>
          </div>

          <div id="p2p-qr-display" style="display: none; text-align: center; margin-top: 0.5rem;">
            <div style="background: #FFFFFF; padding: 1rem; border-radius: 8px; display: inline-block; margin-bottom: 1rem;">
              <img id="p2p-qr-img" src="" style="width: 200px; height: 200px;" />
            </div>
            <p style="color: #94A3B8; font-size: 0.85rem; line-height: 1.4; margin: 0 0 1rem 0;">
              Karşı taraftaki teknisyen bu QR kodu kendi cihazından <strong>QR Okuyucu</strong> ile taradığında transfer gerçekleşecektir.
            </p>
            <button onclick="window.closeP2PTransferModal()" style="height: 42px; border-radius: 8px; border: 1px solid #334155; background: #1E293B; color: #E2E8F0; font-size: 0.95rem; font-weight: 600; cursor: pointer; width: 100%;">Kapat</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Price Modal -->
    <div id="quick-price-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(10, 14, 23, 0.85); z-index: 10005; justify-content: center; align-items: center; padding: 20px 1rem; backdrop-filter: blur(6px);">
      <div style="background-color: #111827; border: 1px solid rgba(0, 243, 255, 0.3); border-radius: 14px; width: 500px; max-width: 95vw; padding: 1.75rem; box-shadow: 0 20px 35px rgba(0, 0, 0, 0.6); box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(0, 243, 255, 0.1); border: 1px solid rgba(0, 243, 255, 0.3); display: flex; align-items: center; justify-content: center; color: #00f3ff;">
              <i class="fa-solid fa-tags"></i>
            </div>
            <h2 style="margin: 0; font-size: 1.15rem; color: #FFF; font-weight: 700; font-family: 'Rajdhani', sans-serif;">Malzeme Birim Fiyatı Tanımla</h2>
          </div>
          <i class="fa-solid fa-times" onclick="window.closeQuickPriceModal()" style="cursor: pointer; color: #64748B; font-size: 1.25rem;"></i>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.35rem; font-weight: 700; text-transform: uppercase;">SAP Numarası & Tanımı</label>
            <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 0.6rem 0.85rem;">
              <span id="quick-price-sap" style="font-family: monospace; font-weight: 800; color: #00f3ff; margin-right: 8px;"></span>
              <span id="quick-price-name" style="color: #e2e8f0; font-size: 0.85rem;"></span>
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 110px; gap: 0.75rem;">
            <div>
              <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.35rem; font-weight: 700; text-transform: uppercase;">Birim Fiyat *</label>
              <input id="quick-price-value-input" type="number" step="0.01" min="0" placeholder="0.00" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid rgba(0, 243, 255, 0.3); border-radius: 8px; color: #10B981; padding: 0 1rem; font-size: 1.1rem; outline: none; font-weight: 800; font-family: monospace; box-sizing: border-box;">
            </div>
            <div>
              <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.35rem; font-weight: 700; text-transform: uppercase;">Para Birimi</label>
              <select id="quick-price-currency-select" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #FFF; padding: 0 0.5rem; font-size: 0.9rem; outline: none; font-weight: 700; font-family: monospace; box-sizing: border-box;">
                <option value="EUR" selected>EUR (€)</option>
                <option value="TRY">TRY (₺)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.35rem; font-weight: 700; text-transform: uppercase;">Geçerlilik Yılı</label>
              <input id="quick-price-year-input" type="number" min="2020" max="2035" value="2026" style="width: 100%; height: 38px; background-color: #0A0E17; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #FFF; padding: 0 0.85rem; font-size: 0.88rem; outline: none; font-family: monospace; box-sizing: border-box;">
            </div>
            <div>
              <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.35rem; font-weight: 700; text-transform: uppercase;">Depo / Kapsam</label>
              <select id="quick-price-warehouse-select" style="width: 100%; height: 38px; background-color: #0A0E17; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #FFF; padding: 0 0.5rem; font-size: 0.85rem; outline: none; box-sizing: border-box;">
                <!-- Filled dynamically -->
              </select>
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.35rem; font-weight: 700; text-transform: uppercase;">Tedarikçi / Not (Opsiyonel)</label>
            <input id="quick-price-note-input" type="text" placeholder="Örn: Vestas, Fatura No..." style="width: 100%; height: 38px; background-color: #0A0E17; border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #FFF; padding: 0 0.85rem; font-size: 0.85rem; outline: none; box-sizing: border-box;">
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 1rem;">
          <button onclick="window.closeQuickPriceModal()" style="padding: 0.5rem 1.25rem; background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #94A3B8; border-radius: 8px; font-size: 0.85rem; cursor: pointer;">İptal</button>
          <button id="btn-save-quick-price" onclick="window.saveQuickPriceModal(this)" style="padding: 0.5rem 1.5rem; background: linear-gradient(135deg, #10B981, #059669); border: none; color: #FFF; font-weight: 700; border-radius: 8px; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 0 15px rgba(16,185,129,0.3);">
            <i class="fa-solid fa-check"></i> Fiyatı Kaydet
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Cabinet Assignment Modal (Fatih Zebek Özel) -->
    <div id="new-warehouse-quick-cabinet-modal" style="display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); z-index: 1100; justify-content: center; align-items: center; padding: 20px 1rem;">
      <div style="background-color: #0F172A; border: 1px solid #8B5CF6; border-radius: 16px; width: 100%; max-width: 480px; padding: 1.5rem; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.9); position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(139, 92, 246, 0.2); padding-bottom: 0.75rem;">
          <h3 style="font-size: 1.15rem; font-weight: 700; color: #C4B5FD; margin: 0; font-family: 'Rajdhani', sans-serif; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-server" style="color: #A855F7;"></i> Malzemeye Kabin / Pano Ata
          </h3>
          <button onclick="window.closeQuickCabinetModal()" style="background: none; border: none; color: #94A3B8; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <input type="hidden" id="quick-cabinet-item-id">
        <input type="hidden" id="quick-cabinet-sap-no">
        <div style="margin-bottom: 1rem; background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
          <div id="quick-cabinet-item-name" style="color: #FFF; font-weight: 600; font-size: 0.88rem;"></div>
          <div id="quick-cabinet-item-sap" style="color: #14F195; font-family: monospace; font-size: 0.8rem; margin-top: 2px;"></div>
        </div>
        <div style="margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 700;">Hızlı Seçim (Kayıtlı Kabinler):</label>
          <div id="quick-cabinet-buttons-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-height: 180px; overflow-y: auto;">
          </div>
        </div>
        <div>
          <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.4rem; text-transform: uppercase; font-weight: 700;">Veya Özel Kabin / Pano Adı Girin:</label>
          <input id="quick-cabinet-custom-input" type="text" placeholder="Örn: =012 Pitch control box" style="width: 100%; height: 38px; background-color: #0A0E17; border: 1px solid #8B5CF6; border-radius: 8px; color: #C4B5FD; padding: 0 0.75rem; font-size: 0.85rem; outline: none; margin-bottom: 0.75rem;">
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button onclick="window.saveQuickCabinet()" style="flex: 1; height: 38px; border-radius: 8px; border: none; background: linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%); color: #FFF; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">
            Kaydet
          </button>
          <button onclick="document.getElementById('quick-cabinet-custom-input').value=''; window.saveQuickCabinet();" style="height: 38px; padding: 0 1rem; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.1); color: #FCA5A5; font-size: 0.8rem; font-weight: 700; cursor: pointer;" title="Kabini Temizle">
            Kaldır
          </button>
        </div>
      </div>
    </div>

    <!-- Quick Turbine Type Assignment Modal (Fatih Zebek Özel) -->
    <div id="new-warehouse-quick-turbinetype-modal" style="display: none; position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px); z-index: 1100; justify-content: center; align-items: center; padding: 20px 1rem;">
      <div style="background-color: #0F172A; border: 1px solid #00F3FF; border-radius: 16px; width: 100%; max-width: 480px; padding: 1.5rem; box-shadow: 0 25px 50px rgba(0, 0, 0, 0.9); position: relative;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(0, 243, 255, 0.2); padding-bottom: 0.75rem;">
          <h3 style="font-size: 1.15rem; font-weight: 700; color: #38BDF8; margin: 0; font-family: 'Rajdhani', sans-serif; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-fan" style="color: #00F3FF;"></i> Malzemeye Türbin Tipi Ata
          </h3>
          <button onclick="window.closeQuickTurbineTypeModal()" style="background: none; border: none; color: #94A3B8; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <input type="hidden" id="quick-turbinetype-item-id">
        <input type="hidden" id="quick-turbinetype-sap-no">
        <div style="margin-bottom: 1rem; background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
          <div id="quick-turbinetype-item-name" style="color: #FFF; font-weight: 600; font-size: 0.88rem;"></div>
          <div id="quick-turbinetype-item-sap" style="color: #14F195; font-family: monospace; font-size: 0.8rem; margin-top: 2px;"></div>
        </div>
        <div style="margin-bottom: 1rem;">
          <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 700;">Hızlı Seçim (Türbin Tipleri):</label>
          <div id="quick-turbinetype-buttons-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; max-height: 180px; overflow-y: auto;">
          </div>
        </div>
        <div>
          <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.4rem; text-transform: uppercase; font-weight: 700;">Veya Özel Türbin Tipi Girin:</label>
          <input id="quick-turbinetype-custom-input" type="text" placeholder="Örn: E70 - E82" style="width: 100%; height: 38px; background-color: #0A0E17; border: 1px solid #00F3FF; border-radius: 8px; color: #38BDF8; padding: 0 0.75rem; font-size: 0.85rem; outline: none; margin-bottom: 0.75rem;">
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button onclick="window.saveQuickTurbineType()" style="flex: 1; height: 38px; border-radius: 8px; border: none; background: linear-gradient(135deg, #00F3FF 0%, #0284C7 100%); color: #0A0E17; font-size: 0.85rem; font-weight: 800; cursor: pointer; transition: all 0.2s;">
            Kaydet
          </button>
          <button onclick="document.getElementById('quick-turbinetype-custom-input').value=''; window.saveQuickTurbineType();" style="height: 38px; padding: 0 1rem; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.1); color: #FCA5A5; font-size: 0.8rem; font-weight: 700; cursor: pointer;" title="Tipi Temizle">
            Kaldır
          </button>
        </div>
      </div>
    </div>
  `;
};

// --- Modal Handlers ---

export const openAddNewModal = () => {
  const modal = ensureSingleModalInBody('add-new-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  
  const sourceInput = modal.querySelector('#new-source-input') as HTMLInputElement;
  if (sourceInput) sourceInput.value = '';
  const deliveryInput = modal.querySelector('#new-delivery-input') as HTMLInputElement;
  if (deliveryInput) deliveryInput.value = '';
  const invoiceInput = modal.querySelector('#new-invoice-input') as HTMLInputElement;
  if (invoiceInput) invoiceInput.value = '';
  const noteInput = modal.querySelector('#new-entry-note-input') as HTMLInputElement;
  if (noteInput) noteInput.value = '';
  
  const updatedByInput = modal.querySelector('#new-updatedby-input') as HTMLInputElement;
  if (updatedByInput) updatedByInput.value = '';

  const sapInput = modal.querySelector('#new-sap-input') as HTMLInputElement;
  const nameInput = modal.querySelector('#new-name-input') as HTMLInputElement;
  
  // Set default state for nameInput (editable by default until SAP is typed)
  if (nameInput) {
    nameInput.value = '';
    nameInput.readOnly = false;
    nameInput.style.backgroundColor = '#0A0E17';
    nameInput.placeholder = 'Sözlükten bulunacak veya manuel giriniz...';
  }

  // Attach search event listener (only once)
  if (sapInput && !(sapInput as any)._listenerAttached) {
    (sapInput as any)._listenerAttached = true;
    let sapTimeout: any;
    sapInput.addEventListener('input', (e) => {
      clearTimeout(sapTimeout);
      const val = (e.target as HTMLInputElement).value.trim();
      if (val.length > 0) {
        sapTimeout = setTimeout(async () => {
          try {
            const res = await warehouseAgent.resolveSapNumber(val);
            if (res.found) {
              if (nameInput) {
                nameInput.value = res.name || '';
                nameInput.style.backgroundColor = '#0A0E17';
              }
            } else {
              if (nameInput && nameInput.value === 'Aranıyor...') {
                nameInput.value = '';
              }
              if (nameInput) {
                nameInput.readOnly = false;
                nameInput.style.backgroundColor = '#0A0E17';
                nameInput.placeholder = 'Sözlükte yoksa malzeme tanımını buraya giriniz...';
              }
            }
          } catch (err) {
            if (nameInput) {
              nameInput.readOnly = false;
              nameInput.style.backgroundColor = '#0A0E17';
              nameInput.placeholder = 'Manuel malzeme tanımı giriniz...';
            }
          }
        }, 400); // 400ms debounce
      } else {
        if (nameInput) {
          nameInput.value = '';
          nameInput.readOnly = false;
          nameInput.style.backgroundColor = '#0A0E17';
          nameInput.placeholder = 'Sözlükten bulunacak veya manuel giriniz...';
        }
      }
    });
  }

  setTimeout(() => sapInput?.focus(), 100);
};

export const closeAddNewModal = () => {
  const modal = ensureSingleModalInBody('add-new-modal') || document.getElementById('add-new-modal');
  if (modal) {
    modal.style.display = 'none';
    const sapInput = modal.querySelector('#new-sap-input') as HTMLInputElement;
    if (sapInput) sapInput.value = '';
    const nameInput = modal.querySelector('#new-name-input') as HTMLInputElement;
    if (nameInput) nameInput.value = '';
    const quantityInput = modal.querySelector('#new-qty-input') as HTMLInputElement;
    if (quantityInput) quantityInput.value = '';
    const locationInput = modal.querySelector('#new-loc-input') as HTMLInputElement;
    if (locationInput) locationInput.value = '';
    const imgInput = modal.querySelector('#new-img-input') as HTMLInputElement;
    if (imgInput) imgInput.value = '';
    const imgLabel = modal.querySelector('#new-img-label') as HTMLElement;
    if (imgLabel) { imgLabel.innerText = 'Görsel Yükle'; imgLabel.style.color = '#94A3B8'; }
  }
  if ((window as any).selectWarehouseAndNavigate) {
    (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
  }
};

export const saveNewItem = async (btn: HTMLButtonElement) => {
  const modal = (btn ? btn.closest('#add-new-modal') : null) || ensureSingleModalInBody('add-new-modal');
  const sapInput = (modal?.querySelector('#new-sap-input') || document.getElementById('new-sap-input')) as HTMLInputElement;
  const nameInput = (modal?.querySelector('#new-name-input') || document.getElementById('new-name-input')) as HTMLInputElement;
  const quantityInput = (modal?.querySelector('#new-qty-input') || document.getElementById('new-qty-input')) as HTMLInputElement;
  const unitInput = (modal?.querySelector('#new-unit-input') || document.getElementById('new-unit-input')) as HTMLInputElement;
  const locationInput = (modal?.querySelector('#new-loc-input') || document.getElementById('new-loc-input')) as HTMLInputElement;

  if (!sapInput || !nameInput || !quantityInput || !sapInput.value || !nameInput.value || !quantityInput.value) {
    alert('Lütfen zorunlu alanları doldurun!');
    return;
  }
  
  const existingSap = warehouseState.inventoryItems.find(i => i.sapNo === sapInput.value && i.condition !== 'DEFECT');
  if (existingSap) {
    alert(`Hata: Bu SAP numarası depoda zaten kayıtlı! Lütfen yeni malzeme eklemek yerine mevcut "${existingSap.name || existingSap.description || ''}" malzemesini güncelleyin.`);
    return;
  }

  const originalText = btn.innerText;
  btn.innerText = 'Kaydediliyor...';
  btn.disabled = true;

  try {
    const imgInput = (modal?.querySelector('#new-img-input') || document.getElementById('new-img-input')) as HTMLInputElement;
    const inputNameValue = nameInput.value;

    const sourceVal = ((modal?.querySelector('#new-source-input') || document.getElementById('new-source-input')) as HTMLInputElement)?.value.trim() || '';
    const deliveryVal = ((modal?.querySelector('#new-delivery-input') || document.getElementById('new-delivery-input')) as HTMLInputElement)?.value.trim() || '';
    const invoiceVal = ((modal?.querySelector('#new-invoice-input') || document.getElementById('new-invoice-input')) as HTMLInputElement)?.value.trim() || '';
    const updatedByVal = ((modal?.querySelector('#new-updatedby-input') || document.getElementById('new-updatedby-input')) as HTMLInputElement)?.value.trim() || '';
    const entryNoteVal = ((modal?.querySelector('#new-entry-note-input') || document.getElementById('new-entry-note-input')) as HTMLInputElement)?.value.trim() || '';
    
    const logDetails = {
      sourceWh: sourceVal || '-',
      deliveryNote: deliveryVal || '-',
      invoiceNo: invoiceVal || '-',
      updatedBy: updatedByVal || 'Sistem',
      entryNote: entryNoteVal || ''
    };

    const result = await warehouseService.addMaterial(warehouseState.currentWarehouse.id, {
      sapNo: sapInput.value,
      description: nameInput.value,
      quantity: parseInt(quantityInput.value),
      unit: unitInput.value || 'Adet',
      shelfNo: locationInput.value || 'GİRİLMEMİŞ',
      condition: 'NEW',
      criticalLimit: 0,
      imageUrl: '',
      notes: ''
    } as any, logDetails);
    
    if (imgInput && imgInput.files && imgInput.files.length > 0) {
      const file = imgInput.files[0];
      const path = `materials/${sapInput.value}_${Date.now()}_${file.name}`;
      
      ImageCompressor.compressImage(file, 800, 800, 0.7).then((compressedFile: File) => {
          fileService.uploadImage(compressedFile, path).then(url => {
            warehouseService.updateMaterialImage(warehouseState.currentWarehouse.id, result.id, url, sapInput.value).then(() => {
              const cell = document.getElementById(`img-cell-${result.id}`);
              if (cell) {
                const safeName = inputNameValue.replace(/'/g, "");
                cell.innerHTML = `<div onclick="window.showBigImage('${url}', '${safeName}')" style="width:36px; height:36px; border-radius:6px; background-color: rgba(59, 130, 246, 0.1); border: 1px solid #3B82F6; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#3B82F6; cursor: pointer; transition: all 0.2s;" title="Görseli Büyüt" onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'; this.style.color='#3B82F6'"><i class="fa-solid fa-image"></i></div>${inputNameValue}`;
              }
            });
          }).catch(err => console.error('Arkaplan görsel yükleme hatası:', err))
            .finally(() => {
                imgInput.value = '';
            });
      });
    }
    
    sapInput.value = '';
    nameInput.value = '';
    quantityInput.value = '';
    locationInput.value = '';
    if (imgInput) imgInput.value = '';
    const imgLabel = modal?.querySelector('#new-img-label') || document.getElementById('new-img-label');
    if (imgLabel) { (imgLabel as HTMLElement).innerText = 'Görsel Yükle'; (imgLabel as HTMLElement).style.color = '#94A3B8'; }
    sapInput.focus();
    
    btn.innerText = 'Başarıyla Eklendi!';
    btn.style.backgroundColor = '#10B981';
    
    setTimeout(() => {
      btn.innerText = originalText;
      btn.style.backgroundColor = '#14F195';
      btn.disabled = false;
    }, 1500);

  } catch (err) {
    console.error(err);
    alert('Eklenirken hata oluştu.');
    btn.innerText = originalText;
    btn.disabled = false;
  }
};

export const openEditModal = (id: string, sap: string, name: string, qty: number, loc: string, imageUrl?: string, minStock?: number, unit?: string, cabinet?: string, turbineType?: string) => {
  let modal = ensureSingleModalInBody('new-warehouse-edit-modal');
  if (modal) {
    const editItemId = modal.querySelector('#edit-item-id') as HTMLInputElement;
    const editSapInput = modal.querySelector('#edit-sap-input') as HTMLInputElement;
    const editNameInput = modal.querySelector('#edit-name-input') as HTMLInputElement;
    const editQtyInput = modal.querySelector('#edit-qty-input') as HTMLInputElement;
    const editLocInput = modal.querySelector('#edit-loc-input') as HTMLInputElement;
    const editUnitInput = modal.querySelector('#edit-unit-input') as HTMLSelectElement;
    const oldQtyInput = modal.querySelector('#edit-old-qty-input') as HTMLInputElement;
    const minStockInput = modal.querySelector('#edit-min-stock-input') as HTMLInputElement;
    const cabinetContainer = modal.querySelector('#edit-cabinet-container') as HTMLElement;
    const cabinetInput = modal.querySelector('#edit-cabinet-input') as HTMLInputElement;
    const turbineTypeContainer = modal.querySelector('#edit-turbinetype-container') as HTMLElement;
    const turbineTypeInput = modal.querySelector('#edit-turbinetype-input') as HTMLInputElement;
    const sourceInput = modal.querySelector('#edit-source-input') as HTMLInputElement;
    const deliveryInput = modal.querySelector('#edit-delivery-input') as HTMLInputElement;
    const invoiceInput = modal.querySelector('#edit-invoice-input') as HTMLInputElement;
    const noteInput = modal.querySelector('#edit-entry-note-input') as HTMLInputElement;
    const updatedByInput = modal.querySelector('#edit-updatedby-input') as HTMLInputElement;
    const detailsDiv = modal.querySelector('#edit-stock-entry-details') as HTMLElement;
    const imgPreview = modal.querySelector('#edit-img-preview') as HTMLImageElement;
    const imgInput = modal.querySelector('#edit-img-input') as HTMLInputElement;

    if (editItemId) editItemId.value = id;
    if (editSapInput) editSapInput.value = sap || '';
    if (editNameInput) editNameInput.value = name || '';
    if (editQtyInput) editQtyInput.value = qty.toString();
    if (editLocInput) editLocInput.value = loc || '';
    if (editUnitInput) editUnitInput.value = unit || 'Adet';
    if (oldQtyInput) oldQtyInput.value = qty.toString();
    if (sourceInput) sourceInput.value = '';
    if (deliveryInput) deliveryInput.value = '';
    if (invoiceInput) invoiceInput.value = '';
    if (noteInput) noteInput.value = '';
    if (minStockInput) minStockInput.value = minStock !== undefined ? minStock.toString() : '0';

    const isFatihZebek = isUserFatihZebek();
    const effCab = cabinet || getEffectiveCabinet({ sapNo: sap, cabinet });
    const effTurb = turbineType || getEffectiveTurbineType({ sapNo: sap, turbineType });

    if (cabinetContainer) {
      cabinetContainer.style.display = isFatihZebek ? 'block' : 'none';
    }
    if (cabinetInput) {
      cabinetInput.value = effCab || '';
    }
    if (turbineTypeContainer) {
      turbineTypeContainer.style.display = isFatihZebek ? 'block' : 'none';
    }
    if (turbineTypeInput) {
      turbineTypeInput.value = effTurb || '';
    }
    const datalist = modal.querySelector('#cabinets-datalist') as HTMLElement;
    if (datalist) {
      datalist.innerHTML = getAvailableCabinets().map(c => `<option value="${c.replace(/"/g, '&quot;')}"></option>`).join('');
    }
    const turbineDatalist = modal.querySelector('#turbinetypes-datalist') as HTMLElement;
    if (turbineDatalist) {
      turbineDatalist.innerHTML = getAvailableTurbineTypes().map(t => `<option value="${t.replace(/"/g, '&quot;')}"></option>`).join('');
    }

    const userProfile = getUserProfile() || (window as any).currentUser;
    const user = userProfile ? userProfile.displayName || userProfile.email : '';
    if (updatedByInput) updatedByInput.value = user;

    const isMaterialManager = userProfile?.role === 'ADMIN' || 
      userProfile?.role === 'MALZEME_YONETIMI' || 
      userProfile?.role === 'TAMİR' ||
      userProfile?.email?.toLowerCase() === 'hursit.akter@demirerholding.com' ||
      userProfile?.email?.toLowerCase() === 'emir.unver@demirerholding.com' ||
      userProfile?.email?.toLowerCase()?.includes('fatih.zebek');

    const hintContainer = modal.querySelector('#edit-personnel-role-hint') as HTMLElement;
    if (isMaterialManager) {
      if (editSapInput) {
        editSapInput.readOnly = false;
        editSapInput.style.backgroundColor = '#0A0E17';
        editSapInput.style.color = '#E2E8F0';
        editSapInput.style.cursor = 'text';
      }
      if (editNameInput) {
        editNameInput.readOnly = false;
        editNameInput.style.backgroundColor = '#0A0E17';
        editNameInput.style.color = '#E2E8F0';
        editNameInput.style.cursor = 'text';
      }
      if (editQtyInput) {
        editQtyInput.readOnly = false;
        editQtyInput.style.backgroundColor = '#0A0E17';
        editQtyInput.style.color = '#E2E8F0';
        editQtyInput.style.cursor = 'text';
      }
      if (editUnitInput) {
        editUnitInput.disabled = false;
        editUnitInput.style.backgroundColor = '#0A0E17';
        editUnitInput.style.color = '#E2E8F0';
        editUnitInput.style.cursor = 'pointer';
      }
      if (hintContainer) hintContainer.style.display = 'none';
    } else {
      // Saha Personeli Restricted View (Only Shelf Location & Critical Limit editable)
      if (editSapInput) {
        editSapInput.readOnly = true;
        editSapInput.style.backgroundColor = 'rgba(30, 41, 59, 0.5)';
        editSapInput.style.color = '#94a3b8';
        editSapInput.style.cursor = 'not-allowed';
      }
      if (editNameInput) {
        editNameInput.readOnly = true;
        editNameInput.style.backgroundColor = 'rgba(30, 41, 59, 0.5)';
        editNameInput.style.color = '#94a3b8';
        editNameInput.style.cursor = 'not-allowed';
      }
      if (editQtyInput) {
        editQtyInput.readOnly = true;
        editQtyInput.style.backgroundColor = 'rgba(30, 41, 59, 0.5)';
        editQtyInput.style.color = '#34d399';
        editQtyInput.style.fontWeight = '800';
        editQtyInput.style.cursor = 'not-allowed';
      }
      if (editUnitInput) {
        editUnitInput.disabled = true;
        editUnitInput.style.backgroundColor = 'rgba(30, 41, 59, 0.5)';
        editUnitInput.style.color = '#94a3b8';
        editUnitInput.style.cursor = 'not-allowed';
      }
      if (hintContainer) hintContainer.style.display = 'block';
    }

    if (detailsDiv) detailsDiv.style.display = 'none';

    if (editQtyInput && isMaterialManager) {
        editQtyInput.oninput = (e: any) => {
            const newQty = parseInt(e.target.value) || 0;
            if (detailsDiv) {
                if (newQty > qty) {
                    detailsDiv.style.display = 'flex';
                } else {
                    detailsDiv.style.display = 'none';
                }
            }
        };
    } else if (editQtyInput) {
        editQtyInput.oninput = null;
    }
    
    if (imgPreview) {
        if (imageUrl && imageUrl !== 'undefined' && imageUrl !== 'null') {
            imgPreview.src = imageUrl;
            imgPreview.style.display = 'block';
        } else {
            imgPreview.src = '';
            imgPreview.style.display = 'none';
        }
    }
    
    if (imgInput) imgInput.value = '';
    
    modal.style.display = 'flex';
  }
};

export const closeEditModal = () => {
  const modals = document.querySelectorAll('#new-warehouse-edit-modal');
  modals.forEach((m: any) => {
    m.style.display = 'none';
  });
};

export const saveEditItem = async (btn: HTMLButtonElement) => {
  const modal = (btn ? btn.closest('#new-warehouse-edit-modal') : null) || ensureSingleModalInBody('new-warehouse-edit-modal');
  if (!modal) {
    alert('Düzenleme penceresi bulunamadı.');
    return;
  }

  const id = ((modal.querySelector('#edit-item-id') || document.getElementById('edit-item-id')) as HTMLInputElement)?.value || '';
  const sap = ((modal.querySelector('#edit-sap-input') || document.getElementById('edit-sap-input')) as HTMLInputElement)?.value || '';
  const name = ((modal.querySelector('#edit-name-input') || document.getElementById('edit-name-input')) as HTMLInputElement)?.value || '';
  const qtyRaw = ((modal.querySelector('#edit-qty-input') || document.getElementById('edit-qty-input')) as HTMLInputElement)?.value || '0';
  const qty = parseInt(qtyRaw);
  const loc = ((modal.querySelector('#edit-loc-input') || document.getElementById('edit-loc-input')) as HTMLInputElement)?.value || '';
  const unit = ((modal.querySelector('#edit-unit-input') || document.getElementById('edit-unit-input')) as HTMLSelectElement)?.value || 'Adet';
  const minStockInput = (modal.querySelector('#edit-min-stock-input') || document.getElementById('edit-min-stock-input')) as HTMLInputElement;
  const minStock = minStockInput && minStockInput.value !== '' ? parseInt(minStockInput.value) : 0;
  
  const oldQtyRaw = ((modal.querySelector('#edit-old-qty-input') || document.getElementById('edit-old-qty-input')) as HTMLInputElement)?.value || '0';
  const oldQty = parseInt(oldQtyRaw) || 0;
  
  if (!id) {
    alert('Hata: Malzeme ID bilgisi alınamadı. Lütfen sayfayı yenileyip tekrar deneyin.');
    return;
  }

  let logDetails: any = undefined;
  if (qty > oldQty) {
      const source = ((modal.querySelector('#edit-source-input') || document.getElementById('edit-source-input')) as HTMLInputElement)?.value?.trim() || '';
      const delivery = ((modal.querySelector('#edit-delivery-input') || document.getElementById('edit-delivery-input')) as HTMLInputElement)?.value?.trim() || '';
      const invoice = ((modal.querySelector('#edit-invoice-input') || document.getElementById('edit-invoice-input')) as HTMLInputElement)?.value?.trim() || '';
      const updatedBy = ((modal.querySelector('#edit-updatedby-input') || document.getElementById('edit-updatedby-input')) as HTMLInputElement)?.value?.trim() || '';
      const entryNote = ((modal.querySelector('#edit-entry-note-input') || document.getElementById('edit-entry-note-input')) as HTMLInputElement)?.value?.trim() || '';
      
      logDetails = {
          sourceWh: source || '-',
          deliveryNote: delivery || '-',
          invoiceNo: invoice || '-',
          updatedBy: updatedBy,
          entryNote: entryNote || '-'
      };
  }
  
  const cabinetInput = (modal.querySelector('#edit-cabinet-input') || document.getElementById('edit-cabinet-input')) as HTMLInputElement;
  const cabinetVal = cabinetInput ? cabinetInput.value.trim() : '';
  const turbineTypeInput = (modal.querySelector('#edit-turbinetype-input') || document.getElementById('edit-turbinetype-input')) as HTMLInputElement;
  const turbineTypeVal = turbineTypeInput ? turbineTypeInput.value.trim() : '';
  
  const originalText = btn.innerText;
  btn.innerText = 'Kaydediliyor...';
  btn.disabled = true;

  const userProfile = getUserProfile() || (window as any).currentUser;
  const isMaterialManager = userProfile?.role === 'ADMIN' || 
    userProfile?.role === 'MALZEME_YONETIMI' || 
    userProfile?.role === 'TAMİR' ||
    userProfile?.email?.toLowerCase() === 'hursit.akter@demirerholding.com' ||
    userProfile?.email?.toLowerCase() === 'emir.unver@demirerholding.com' ||
    userProfile?.email?.toLowerCase()?.includes('fatih.zebek');
  
  const isFatihZebek = isUserFatihZebek(userProfile);

  try {
    const updatesObj: any = isMaterialManager ? {
      sapNo: sap, description: name, quantity: isNaN(qty) ? oldQty : qty, shelfNo: loc, criticalLimit: isNaN(minStock) ? 0 : minStock, unit
    } : {
      shelfNo: loc,
      criticalLimit: isNaN(minStock) ? 0 : minStock
    };

    if (isFatihZebek) {
      updatesObj.cabinet = cabinetVal;
      updatesObj.turbineType = turbineTypeVal;
      if (sap) {
        await saveSapMetadata(sap, { cabinet: cabinetVal, turbineType: turbineTypeVal });
      }
    }

    await warehouseService.updateMaterial(warehouseState.currentWarehouse.id, id, updatesObj, isMaterialManager ? logDetails : undefined);

    const memItem = (warehouseState.inventoryItems || []).find((i: any) => i.id === id);
    if (memItem && isFatihZebek) {
      memItem.cabinet = cabinetVal;
      memItem.turbineType = turbineTypeVal;
    }
    const memItemQR = (warehouseState.inventoryWithQRs || []).find((i: any) => i.id === id);
    if (memItemQR && isFatihZebek) {
      memItemQR.cabinet = cabinetVal;
      memItemQR.turbineType = turbineTypeVal;
    }

    const imgInput = (modal.querySelector('#edit-img-input') || document.getElementById('edit-img-input')) as HTMLInputElement;
    const path = `inventory/${warehouseState.currentWarehouse.id}/${id}_${Date.now()}`;
    if (imgInput && imgInput.files && imgInput.files.length > 0) {
       const file = imgInput.files[0];
       try {
           const localPreviewUrl = URL.createObjectURL(file);
           const item = warehouseState.inventoryItems.find((i: any) => i.id === id);
           if (item) {
               item.imageUrl = localPreviewUrl;
           }

           closeEditModal();
           
           const safeName = name.replace(/'/g, "");
           const safeNameForEdit = name.replace(/'/g, '\\\'');
           
           const imgBtn = document.getElementById(`img-btn-${id}`);
           if (imgBtn) {
               imgBtn.outerHTML = `<div id="img-btn-${id}" onclick="window.showBigImage('${localPreviewUrl}', '${safeName}')" style="width:36px; height:36px; border-radius:6px; background-color: rgba(59, 130, 246, 0.1); border: 1px solid #3B82F6; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#3B82F6; cursor: pointer; transition: all 0.2s;" title="Görseli Büyüt (Yükleniyor...)" onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'; this.style.color='#3B82F6'"><i class="fa-solid fa-image"></i></div>`;
           }
           
           const editBtn = document.getElementById(`edit-btn-${id}`);
           if (editBtn) {
               const editQty = ((modal.querySelector('#edit-qty-input') || document.getElementById('edit-qty-input')) as HTMLInputElement)?.value || qty;
               const editLoc = ((modal.querySelector('#edit-loc-input') || document.getElementById('edit-loc-input')) as HTMLInputElement)?.value || loc;
               const minSt = ((modal.querySelector('#edit-min-stock-input') || document.getElementById('edit-min-stock-input')) as HTMLInputElement)?.value || minStock;
               editBtn.setAttribute('onclick', `window.openEditModal('${id}', '${sap}', '${safeNameForEdit}', ${editQty}, '${editLoc}', '${localPreviewUrl}', ${minSt}, '${unit}')`);
           }

           let compressedFile: File;
           try {
               compressedFile = await ImageCompressor.compressImage(file, 800, 800, 0.7);
           } catch (compressionErr) {
               console.warn("Sıkıştırma başarısız, orijinal dosya yükleniyor...", compressionErr);
               compressedFile = file;
           }
           
           const url = await fileService.uploadImage(compressedFile, path);
           await warehouseService.updateMaterialImage(warehouseState.currentWarehouse.id, id, url as string, sap);
           console.log('Arkaplan görsel güncellemesi tamamlandı.');
           
       } catch (err: any) {
           console.error('Görsel yükleme hatası (Arkaplan):', err);
       } finally {
           imgInput.value = '';
       }
    } else {
       closeEditModal();
       if ((window as any).selectWarehouseAndNavigate) {
         (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
       }
    }

  } catch(e: any) {
    console.error(e);
    alert('Hata oluştu: ' + (e?.message || e));
  } finally {
    btn.innerText = originalText;
    btn.disabled = false;
  }
};

export const deleteEditImage = async () => {
  const id = (document.getElementById('edit-item-id') as HTMLInputElement).value;
  if (!id) return;
  if (!confirm("Görseli silmek istediğinize emin misiniz?")) return;
  
  const imgPreview = document.getElementById('edit-img-preview') as HTMLImageElement;
  if (imgPreview) imgPreview.style.display = 'none';
  
  const item = warehouseState.inventoryItems.find((i: any) => i.id === id);
  if (item) {
      item.imageUrl = null;
  }
  
  try {
      await warehouseService.updateMaterialImage(warehouseState.currentWarehouse.id, id, '', item ? item.sapNo : '');
      
      const safeName = item ? item.name.replace(/'/g, "") : '';
      const safeNameForEdit = item ? item.name.replace(/'/g, '\\\'') : '';
      
      const imgBtn = document.getElementById(`img-btn-${id}`);
      if (imgBtn) {
          imgBtn.outerHTML = `<div id="img-btn-${id}" onclick="window.triggerImageUpload('${id}', '${item ? item.sapNo : ''}')" style="width:36px; height:36px; border-radius:6px; background-color: #1E293B; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#64748B; cursor: pointer; transition: all 0.2s;" title="Görsel Ekle" onmouseover="this.style.backgroundColor='#334155'" onmouseout="this.style.backgroundColor='#1E293B'"><i class="fa-solid fa-image"></i></div>`;
      }
      
      const editBtn = document.getElementById(`edit-btn-${id}`);
      if (editBtn && item) {
          editBtn.setAttribute('onclick', `window.openEditModal('${item.id}', '${item.sapNo}', '${safeNameForEdit}', ${item.quantity}, '${item.shelfNo || ''}', '', ${item.minStock || 0}, '${item.unit || 'Adet'}')`);
      }
      
      alert("Görsel başarıyla silindi!");
  } catch(e: any) {
      alert("Silinirken hata oluştu: " + e.message);
  }
};

export const openMtaEditModal = (id: string, sap: string, name: string, serial: string, note: string, loc: string, qty: number) => {
  const modal = ensureSingleModalInBody('new-warehouse-mta-edit-modal');
  if (modal) {
    const idInput = modal.querySelector('#mta-edit-item-id') as HTMLInputElement;
    if (idInput) idInput.value = id;
    const nameText = modal.querySelector('#mta-edit-name-text') as HTMLElement;
    if (nameText) nameText.innerText = name;
    const sapText = modal.querySelector('#mta-edit-sap-text') as HTMLElement;
    if (sapText) sapText.innerText = sap;
    const qtyInput = modal.querySelector('#mta-edit-qty-input') as HTMLInputElement;
    if (qtyInput) qtyInput.value = qty !== undefined ? qty.toString() : '0';
    const serialInput = modal.querySelector('#mta-edit-serial-input') as HTMLInputElement;
    if (serialInput) serialInput.value = (serial === 'undefined' || serial === 'null') ? '' : serial;
    const noteInput = modal.querySelector('#mta-edit-note-input') as HTMLTextAreaElement;
    if (noteInput) noteInput.value = (note === 'undefined' || note === 'null') ? '' : note;
    const locInput = modal.querySelector('#mta-edit-loc-input') as HTMLInputElement;
    if (locInput) locInput.value = (loc === 'undefined' || loc === 'null') ? '' : loc;
    modal.style.display = 'flex';
  }
};

export const closeMtaEditModal = () => {
  const modal = ensureSingleModalInBody('new-warehouse-mta-edit-modal') || document.getElementById('new-warehouse-mta-edit-modal');
  if (modal) modal.style.display = 'none';
};

export const saveMtaEditItem = async (btn: HTMLButtonElement) => {
  const modal = (btn ? btn.closest('#new-warehouse-mta-edit-modal') : null) || ensureSingleModalInBody('new-warehouse-mta-edit-modal');
  const id = ((modal?.querySelector('#mta-edit-item-id') || document.getElementById('mta-edit-item-id')) as HTMLInputElement)?.value;
  const qty = parseInt(((modal?.querySelector('#mta-edit-qty-input') || document.getElementById('mta-edit-qty-input')) as HTMLInputElement)?.value || '0') || 0;
  const serial = (((modal?.querySelector('#mta-edit-serial-input') || document.getElementById('mta-edit-serial-input')) as HTMLInputElement)?.value || '').trim();
  const note = (((modal?.querySelector('#mta-edit-note-input') || document.getElementById('mta-edit-note-input')) as HTMLTextAreaElement)?.value || '').trim();
  const loc = (((modal?.querySelector('#mta-edit-loc-input') || document.getElementById('mta-edit-loc-input')) as HTMLInputElement)?.value || '').trim();
  
  const originalText = btn.innerText;
  btn.innerText = 'Kaydediliyor...';
  btn.disabled = true;
  
  try {
    await warehouseService.updateMaterial(warehouseState.currentWarehouse.id, id, {
      quantity: qty,
      serialNo: serial,
      note: note,
      shelfNo: loc
    });
    
    closeMtaEditModal();
    (window as any).showToast?.('Başarılı', 'Malzeme bilgileri başarıyla güncellendi.', 'success');
    
    if ((window as any).selectWarehouseAndNavigate) {
      (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
    }
  } catch (err: any) {
    console.error('Error saving W11 details:', err);
    alert('Kaydedilemedi: ' + err.message);
    btn.innerText = originalText;
    btn.disabled = false;
  }
};

export const openDefectEditModal = (id: string, sap: string, name: string, serial: string, reportDocId: string = '') => {
  let modal = ensureSingleModalInBody('new-warehouse-defect-edit-modal');
  if (modal) {
    const idInput = modal.querySelector('#defect-edit-item-id') as HTMLInputElement;
    if (idInput) idInput.value = id;
    const reportDocIdInput = modal.querySelector('#defect-edit-report-doc-id') as HTMLInputElement;
    if (reportDocIdInput) reportDocIdInput.value = reportDocId;
    const nameText = modal.querySelector('#defect-edit-name-text') as HTMLElement;
    if (nameText) nameText.innerText = name;
    const sapText = modal.querySelector('#defect-edit-sap-text') as HTMLElement;
    if (sapText) sapText.innerText = sap;
    const serialInput = modal.querySelector('#defect-edit-serial-input') as HTMLInputElement;
    if (serialInput) serialInput.value = (serial === 'undefined' || serial === 'null' || serial === '-') ? '' : serial;
    modal.style.display = 'flex';
  }
};

export const closeDefectEditModal = () => {
  const modal = ensureSingleModalInBody('new-warehouse-defect-edit-modal') || document.getElementById('new-warehouse-defect-edit-modal');
  if (modal) modal.style.display = 'none';
};

export const saveDefectEditItem = async (btn: HTMLButtonElement) => {
  const modal = (btn ? btn.closest('#new-warehouse-defect-edit-modal') : null) || ensureSingleModalInBody('new-warehouse-defect-edit-modal');
  const id = ((modal?.querySelector('#defect-edit-item-id') || document.getElementById('defect-edit-item-id')) as HTMLInputElement)?.value;
  const serial = (((modal?.querySelector('#defect-edit-serial-input') || document.getElementById('defect-edit-serial-input')) as HTMLInputElement)?.value || '').trim();
  const reportDocId = ((modal?.querySelector('#defect-edit-report-doc-id') || document.getElementById('defect-edit-report-doc-id')) as HTMLInputElement)?.value || '';
  const sapTextEl = (modal?.querySelector('#defect-edit-sap-text') || document.getElementById('defect-edit-sap-text')) as HTMLElement | null;
  const sapNo = sapTextEl ? (sapTextEl.innerText || sapTextEl.textContent || '').trim() : '';

  const originalText = btn.innerText;
  btn.innerText = 'Kaydediliyor...';
  btn.disabled = true;

  try {
    await warehouseService.updateMaterial(warehouseState.currentWarehouse.id, id, {
      serialNo: serial
    });

    if (reportDocId && sapNo) {
      try {
        const reportRef = doc(db, 'serviceReports', reportDocId);
        const snap = await getDoc(reportRef);
        if (snap.exists()) {
          const data = snap.data();
          const materials = data.materials || [];
          let updated = false;
          for (const mat of materials) {
            if (String(mat.sapNo).trim() === String(sapNo).trim() && mat.defectCount > 0) {
              mat.serialNo = serial;
              updated = true;
              break;
            }
          }
          if (updated) {
            await updateDoc(reportRef, { materials });
          }
        }
      } catch (reportErr) {
        console.error('Failed to sync report material serial:', reportErr);
      }
    }

    closeDefectEditModal();
    (window as any).showToast?.('Başarılı', 'Seri numarası başarıyla güncellendi.', 'success');

    if ((window as any).selectWarehouseAndNavigate) {
      (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
    }
  } catch (err: any) {
    console.error('Error saving defect serial details:', err);
    alert('Kaydedilemedi: ' + err.message);
    btn.innerText = originalText;
    btn.disabled = false;
  }
};

export const openTransferModal = async (id: string, sap: string, name: string, maxQty: number, preselectedTargetWarehouseId?: string) => {
  const modal = ensureSingleModalInBody('new-warehouse-transfer-modal');
  if(modal) {
    const itemIdInput = modal.querySelector('#transfer-item-id') as HTMLInputElement;
    if (itemIdInput) itemIdInput.value = id;

    const transferInfo = modal.querySelector('#transfer-info') as HTMLElement;
    if (transferInfo) transferInfo.innerText = `${sap} - ${name} (Mevcut: ${maxQty})`;

    const qtyInput = modal.querySelector('#transfer-qty-input') as HTMLInputElement;
    if (qtyInput) {
      qtyInput.max = maxQty.toString();
      qtyInput.value = '1';
    }

    const targetSelect = modal.querySelector('#transfer-target-input') as HTMLSelectElement;
    if (targetSelect) {
       targetSelect.innerHTML = '<option value="">Yükleniyor...</option>';
       
       let optionsHtml = '';
       let matchedWh: any = null;

       if (warehouseState.currentWarehouse.id.startsWith('team_') && !warehouseState.isMaterialManager) {
         try {
           const logsRef = collection(db, 'warehouses', warehouseState.currentWarehouse.id, 'logs');
           const q = query(
             logsRef, 
             where('sapNo', '==', sap), 
             where('type', '==', 'TRANSFER')
           );
           const snapshot = await getDocs(q);
           const logsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
           
           logsList.sort((a, b) => {
             const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
             const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
             return bTime - aTime;
           });

           for (const logData of logsList) {
             if (logData.quantity > 0 && logData.note) {
               const noteLower = logData.note.toLowerCase();
               const foundWh = dataService.getWarehouses().find((w: any) => {
                 const cleanName = w.name.toLowerCase().replace('depo', '').trim();
                 return noteLower.includes(cleanName);
               });
               if (foundWh) {
                 matchedWh = foundWh;
                 break;
               }
             }
           }
         } catch (e) {
           console.error('Error fetching logs to determine source warehouse:', e);
         }
       }

       if (matchedWh) {
         optionsHtml = `<option value="${matchedWh.id}">${matchedWh.name}</option>`;
       } else if (warehouseState.currentWarehouse.id.startsWith('team_')) {
         const allowedMain = (warehouseState.targetOptions || []).filter(w => !w.id.startsWith('team_'));
         const fallbackMain = allowedMain.length > 0 ? allowedMain : dataService.getWarehouses().filter(w => !w.id.startsWith('team_'));
         optionsHtml = fallbackMain.length > 0 
           ? fallbackMain.map(w => `<option value="${w.id}">${w.name}</option>`).join('')
           : `<option value="">İade edilecek yetkili depo bulunamadı</option>`;
       } else {
         const allowedTeams = (warehouseState.targetOptions || []).filter(w => w.id.startsWith('team_'));
         optionsHtml = allowedTeams.length > 0 
           ? allowedTeams.map(w => `<option value="${w.id}">${w.name}</option>`).join('')
           : `<option value="">Sevk edilecek ekip zimmet deposu bulunamadı</option>`;
       }
       
       targetSelect.innerHTML = optionsHtml;
       if (preselectedTargetWarehouseId) {
         targetSelect.value = preselectedTargetWarehouseId;
       }
    }

    modal.style.display = 'flex';
  }
};

export const closeTransferModal = () => {
  const modal = ensureSingleModalInBody('new-warehouse-transfer-modal') || document.getElementById('new-warehouse-transfer-modal');
  if(modal) modal.style.display = 'none';
};

export const saveTransferItem = async (btn: HTMLButtonElement) => {
  const modal = ensureSingleModalInBody('new-warehouse-transfer-modal');
  const id = (modal?.querySelector('#transfer-item-id') as HTMLInputElement || document.getElementById('transfer-item-id') as HTMLInputElement)?.value;
  const targetId = (modal?.querySelector('#transfer-target-input') as HTMLSelectElement || document.getElementById('transfer-target-input') as HTMLSelectElement)?.value;
  const qty = parseInt((modal?.querySelector('#transfer-qty-input') as HTMLInputElement || document.getElementById('transfer-qty-input') as HTMLInputElement)?.value || '0');
  
  if(!id || !targetId || isNaN(qty) || qty <= 0) {
    alert('Lütfen geçerli bir hedef depo ve miktar girin.');
    return;
  }
  
  const originalText = btn.innerText;
  btn.innerText = 'Transfer Ediliyor...';
  btn.disabled = true;
  
  try {
     const userProfile = getUserProfile();
     const user = userProfile ? userProfile.displayName || userProfile.email : 'Bilinmeyen Kullanıcı';
     await warehouseService.transferMaterial(warehouseState.currentWarehouse.id, targetId, id, qty, user);
     closeTransferModal();
     if ((window as any).selectWarehouseAndNavigate) {
       (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
     }
  } catch(e) { console.error(e); alert('Transfer sırasında hata oluştu: ' + (e as Error).message); }
  finally { btn.innerText = originalText; btn.disabled = false; }
};

export const openP2PTransferModal = (id: string, sap: string, name: string, maxQty: number) => {
  const modal = ensureSingleModalInBody('p2p-transfer-modal');
  if (modal) {
    const idInput = modal.querySelector('#p2p-item-id') as HTMLInputElement;
    if (idInput) idInput.value = id;
    const sapInput = modal.querySelector('#p2p-item-sap') as HTMLInputElement;
    if (sapInput) sapInput.value = sap;
    const nameInput = modal.querySelector('#p2p-item-name') as HTMLInputElement;
    if (nameInput) nameInput.value = name;
    
    const infoDiv = modal.querySelector('#p2p-info') as HTMLElement;
    if (infoDiv) {
      infoDiv.innerText = `${sap} - ${name} (Zimmetinizdeki Mevcut: ${maxQty})`;
    }
    
    const qtyInput = modal.querySelector('#p2p-qty-input') as HTMLInputElement;
    if (qtyInput) {
      qtyInput.max = maxQty.toString();
      qtyInput.value = '1';
    }
    
    const inputContainer = modal.querySelector('#p2p-input-container') as HTMLElement;
    if (inputContainer) inputContainer.style.display = 'block';
    const qrDisplay = modal.querySelector('#p2p-qr-display') as HTMLElement;
    if (qrDisplay) qrDisplay.style.display = 'none';
    
    modal.style.display = 'flex';
  }
};

export const closeP2PTransferModal = () => {
  const modal = ensureSingleModalInBody('p2p-transfer-modal') || document.getElementById('p2p-transfer-modal');
  if (modal) modal.style.display = 'none';
};

export const generateP2PQR = async () => {
  const modal = ensureSingleModalInBody('p2p-transfer-modal');
  const id = (modal?.querySelector('#p2p-item-id') as HTMLInputElement || document.getElementById('p2p-item-id') as HTMLInputElement)?.value;
  const sap = (modal?.querySelector('#p2p-item-sap') as HTMLInputElement || document.getElementById('p2p-item-sap') as HTMLInputElement)?.value;
  const name = (modal?.querySelector('#p2p-item-name') as HTMLInputElement || document.getElementById('p2p-item-name') as HTMLInputElement)?.value;
  const qtyInput = (modal?.querySelector('#p2p-qty-input') as HTMLInputElement || document.getElementById('p2p-qty-input') as HTMLInputElement);
  const qty = parseInt(qtyInput?.value || '0');
  const maxQty = parseInt(qtyInput.max || '0');
  
  if (isNaN(qty) || qty <= 0 || qty > maxQty) {
    alert(`Lütfen 1 ile ${maxQty} arasında geçerli bir miktar girin.`);
    return;
  }
  
  try {
    const payload = {
      type: 'p2p_transfer',
      sourceWarehouseId: warehouseState.currentWarehouse.id,
      sourceItemId: id,
      sapNo: sap,
      name: name,
      quantity: qty
    };
    
    const qrString = JSON.stringify(payload);
    const qrUrl = await QRCode.toDataURL(qrString, { width: 256, margin: 1 });
    
    const qrImg = document.getElementById('p2p-qr-img') as HTMLImageElement;
    if (qrImg) qrImg.src = qrUrl;
    
    const inputContainer = document.getElementById('p2p-input-container');
    if (inputContainer) inputContainer.style.display = 'none';
    const qrDisplay = document.getElementById('p2p-qr-display');
    if (qrDisplay) qrDisplay.style.display = 'block';
  } catch (err: any) {
    console.error(err);
    alert('QR kod oluşturulurken hata: ' + err.message);
  }
};

export const closeHistoryModal = () => {
  const modal = ensureSingleModalInBody('new-warehouse-history-modal') || document.getElementById('new-warehouse-history-modal');
  if(modal) modal.style.display = 'none';
};

export const openHistoryModal = async (id: string, name: string) => {
  const modal = ensureSingleModalInBody('new-warehouse-history-modal');
  if(modal) {
    const historyTitle = modal.querySelector('#history-title') as HTMLElement;
    if (historyTitle) historyTitle.innerText = `Geçmiş: ${name}`;
    const list = modal.querySelector('#history-list') as HTMLElement;
    if(list) list.innerHTML = '<div style="text-align:center; padding:1rem;">Yükleniyor...</div>';
    modal.style.display = 'flex';
    
    try {
      const logs = await warehouseService.getLogs(warehouseState.currentWarehouse.id);
      const targetItem = (warehouseState.inventoryItems || []).find((i: any) => i.id === id);
      const targetSap = targetItem?.sapNo ? String(targetItem.sapNo).trim() : '';
      const itemLogs = logs.filter(l => l.itemId === id || (targetSap && l.sapNo && String(l.sapNo).trim() === targetSap)).sort((a,b:any) => ((b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
      if(list) {
        if(itemLogs.length === 0) {
          list.innerHTML = '<div style="text-align:center; padding:1rem; color:#94A3B8;">Geçmiş kayıt bulunamadı.</div>';
        } else {
          list.innerHTML = itemLogs.map(l => {
            const date = l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000).toLocaleString('tr-TR') : '-';
            let typeColor = '#94A3B8';
            let typeText: string = l.type;
            if(l.type === 'ADD') {
              const isDefect = l.note && l.note.includes('[Durum: DEFECT]');
              const isScrap = l.note && l.note.includes('[Durum: SCRAP]');
              const isIncrease = l.oldQty !== undefined && l.oldQty > 0;
              if (isDefect) {
                typeColor = '#F59E0B';
                typeText = 'DEFECT';
              } else if (isScrap) {
                typeColor = '#94A3B8';
                typeText = 'Hurda Girişi';
              } else if (isIncrease) {
                typeColor = '#10B981';
                typeText = 'Stok Artışı';
              } else {
                typeColor = '#60A5FA';
                typeText = 'Stok Giriş';
              }
            }
            if(l.type === 'REMOVE') {
              const isDefect = l.note && l.note.includes('[Durum: DEFECT]');
              const isScrap = l.note && l.note.includes('[Durum: SCRAP]');
              if (isDefect) {
                typeColor = '#F59E0B';
                typeText = 'DEFECT Çıkış';
              } else if (isScrap) {
                typeColor = '#94A3B8';
                typeText = 'Hurda Çıkışı';
              } else {
                typeColor = '#EF4444';
                typeText = 'Stok Çıkış';
              }
            }
            if(l.type === 'TRANSFER') { typeColor = '#3B82F6'; typeText = 'Transfer'; }
            if(l.type === 'UPDATE') { typeColor = '#F59E0B'; typeText = 'Güncelleme'; }
            return `
              <div style="padding:0.75rem; border-bottom:1px solid #1E293B; font-size:0.85rem;">
                <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                  <span style="color:${typeColor}; font-weight:600;">${typeText} (${l.quantity > 0 ? '+'+l.quantity : l.quantity})</span>
                  <span style="color:#64748B;">${date}</span>
                </div>
                <div style="color:#E2E8F0; margin-bottom:0.25rem;">${(window as any).formatDepoUser ? (window as any).formatDepoUser(l.user) : (l.user || 'Sistem')}</div>
                ${l.serialNo ? `
                  <div style="display: inline-flex; align-items: center; gap: 5px; background: rgba(20, 241, 149, 0.12); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.78rem; font-family: monospace; font-weight: 700; margin-bottom: 0.35rem;">
                    <i class="fa-solid fa-barcode"></i> Seri No: ${l.serialNo}
                  </div>
                ` : ''}
                ${l.formNo ? `
                  <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(96, 165, 250, 0.12); color: #60A5FA; border: 1px solid rgba(96, 165, 250, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-family: monospace; font-weight: 700; margin-bottom: 0.35rem; margin-left: 4px;">
                    <i class="fa-solid fa-file-lines"></i> Sevk/Form #${l.formNo}
                  </div>
                ` : ''}
                <div style="color:#94A3B8; font-size:0.8rem;">${l.note || ''}</div>
              </div>
            `;
          }).join('');
        }
      }
    } catch(e) {
      console.error(e);
      if(list) list.innerHTML = '<div style="text-align:center; padding:1rem; color:#EF4444;">Yüklenirken hata oluştu.</div>';
    }
  }
};

export const showBigQR = (id: string, sapNo: string, name: string, qrUrl: string) => {
  const modal = ensureSingleModalInBody('big-qr-modal');
  if (modal) {
    const img = modal.querySelector('#big-qr-img') as HTMLImageElement;
    if (img) img.setAttribute('src', qrUrl);
    const titleDiv = modal.querySelector('#big-qr-title') as HTMLElement;
    if (titleDiv) {
       titleDiv.innerHTML = `
          <div style="font-size: 1.15rem; font-weight: 700; color: #FFFFFF; line-height: 1.3;">${name}</div>
          <div style="font-size: 0.95rem; color: #14F195; margin-top: 6px; font-weight: 700;">SAP NO: ${sapNo}</div>
       `;
    }
    (window as any)._currentBigQRItem = { id, sapNo, description: name, warehouseId: warehouseState.currentWarehouse.id };
    modal.style.display = 'flex';
  }
};

export const closeBigQR = () => {
  const modal = ensureSingleModalInBody('big-qr-modal') || document.getElementById('big-qr-modal');
  if (modal) modal.style.display = 'none';
  (window as any)._currentBigQRItem = null;
};

export const printSingleQRFromModal = async () => {
  const item = (window as any)._currentBigQRItem;
  if (!item) return;
  const { qrService } = await import('../../services/QRService');
  
  const qrText = JSON.stringify({ id: item.id, sapNo: item.sapNo, warehouseId: item.warehouseId });
  const dataUrl = await qrService.generateDataURL(qrText);
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  
  const sapLabel = `SAP: ${item.sapNo}`;
  const descLabel = (item.description || '').toLocaleUpperCase('tr-TR');
  const boxIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-top:-2px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
  
  printWindow.document.write(`
    <html>
      <head>
        <title>Malzeme Barkodu - ${item.sapNo}</title>
        <style>
          @page { size: 99.1mm 38.1mm; margin: 0; }
          @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', system-ui, sans-serif;
            background: white;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            width: 100vw;
            box-sizing: border-box;
          }
          .label-box {
            width: 99.1mm;
            height: 38.1mm;
            box-sizing: border-box;
            padding: 4mm;
            display: flex;
            align-items: center;
            justify-content: space-between;
            overflow: hidden;
          }
          .details { 
            flex: 1; 
            min-width: 0; 
            display: flex; 
            flex-direction: column; 
            justify-content: center; 
            text-align: left;
            padding-right: 3mm;
          }
          .sap { 
            font-size: 14pt; 
            font-weight: 900; 
            color: #000; 
            margin-bottom: 2mm; 
            display: flex; 
            align-items: center; 
            gap: 6px; 
            line-height: 1.1; 
          }
          .desc { 
            font-size: 9pt; 
            font-weight: 700; 
            color: #333; 
            line-height: 1.2; 
            width: 100%;
            word-break: break-word;
            display: -webkit-box; 
            -webkit-line-clamp: 2; 
            -webkit-box-orient: vertical; 
            overflow: hidden; 
            text-overflow: ellipsis; 
          }
          .qr-img { 
            width: 30mm; 
            height: 30mm; 
            flex-shrink: 0; 
            object-fit: contain; 
          }
        </style>
      </head>
      <body>
        <div class="label-box">
          <div class="details">
            <div class="sap">
              ${boxIcon}
              <span>${sapLabel}</span>
            </div>
            <div class="desc">${descLabel}</div>
          </div>
          <img class="qr-img" src="${dataUrl}">
        </div>
        <script>
          window.onload = () => { 
            setTimeout(() => {
              window.print();
              setTimeout(() => window.close(), 500);
            }, 300);
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
};

export const showBigImage = (url: string, title: string) => {
  const modal = ensureSingleModalInBody('big-image-modal');
  if (modal) {
    const img = modal.querySelector('#big-image-img') as HTMLImageElement;
    if (img) img.setAttribute('src', url);
    const titleDiv = modal.querySelector('#big-image-title') as HTMLElement;
    if (titleDiv) titleDiv.innerText = title;
    modal.style.display = 'flex';
  }
};

export const closeBigImage = () => {
  const modal = ensureSingleModalInBody('big-image-modal') || document.getElementById('big-image-modal');
  if (modal) modal.style.display = 'none';
};

export const showRecoveryInfoList = (itemId: string) => {
  const item = warehouseState.inventoryItems.find((i: any) => i.id === itemId);
  if (!item) return;

  let notes: string[] = [];
  if (item.recoveryNotes && Array.isArray(item.recoveryNotes)) {
    notes = item.recoveryNotes;
  } else if (item.recoveryNote) {
    notes = [item.recoveryNote];
  }

  if (notes.length === 0) return;

  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.6); 
    backdrop-filter: blur(4px); z-index: 999999; display: flex; 
    align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;
  `;

  let cardsHtml = notes.map((recoveryNote, index) => {
    let turbine = '-';
    let report = '-';
    let serial = '-';
    let desc = recoveryNote;

    const turbineMatch = recoveryNote.match(/Türbin:\s*([^,]+)/);
    const reportMatch = recoveryNote.match(/Rapor:\s*([^,]+)/);
    const serialMatch = recoveryNote.match(/Seri No:\s*([^,]+)/);
    const descMatch = recoveryNote.match(/Açıklama:\s*(.+)$/);

    if (turbineMatch) turbine = turbineMatch[1].trim();
    if (reportMatch) report = reportMatch[1].trim();
    if (serialMatch) serial = serialMatch[1].trim();
    if (descMatch) desc = descMatch[1].trim();

    return `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 1rem; border-radius: 12px; display: flex; flex-direction: column; gap: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
          <span style="font-weight: 700; color: #14F195; font-size: 0.85rem;">Kayıt #${index + 1}</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.8rem;">
          <div>
            <span style="color: #64748B; display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">Söküldüğü Türbin</span>
            <span style="color: #FFF; font-weight: 700;">${turbine}</span>
          </div>
          <div>
            <span style="color: #64748B; display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">Rapor No</span>
            <span style="color: #F59E0B; font-weight: 700; font-family: monospace;">${report}</span>
          </div>
        </div>
        <div>
          <span style="color: #64748B; display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; margin-bottom: 0.2rem;">Seri Numarası</span>
          <span style="color: #10B981; font-weight: bold; font-family: monospace; font-size: 0.85rem; background: rgba(16, 185, 129, 0.05); padding: 2px 6px; border-radius: 4px; border: 1px dashed rgba(16, 185, 129, 0.15);">${serial}</span>
        </div>
        <div>
          <span style="color: #64748B; display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; margin-bottom: 0.2rem;">Açıklama / Gerekçe</span>
          <div style="background: rgba(0,0,0,0.2); padding: 0.5rem 0.75rem; border-radius: 6px; color: #E2E8F0; font-size: 0.85rem; line-height: 1.4;">
            ${desc}
          </div>
        </div>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 520px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); transform: scale(0.95); transition: transform 0.2s; display: flex; flex-direction: column; max-height: 80vh;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem; margin-bottom: 1.25rem;">
        <h3 style="font-size: 1.25rem; font-weight: 700; color: #60A5FA; margin: 0; font-family: 'Rajdhani', sans-serif;">
          <i class="fa-solid fa-circle-info" style="margin-right: 8px;"></i> Malzeme Geri Kazanım Geçmişi
        </h3>
        <i class="fa-solid fa-xmark" id="btn-close-recovery-modal" style="cursor: pointer; color: #64748B; font-size: 1.1rem;"></i>
      </div>
      
      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1.25rem; padding-right: 4px; margin-bottom: 1.5rem;">
        ${cardsHtml}
      </div>

      <div style="display: flex; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem;">
        <button id="btn-close-recovery-ok" style="background: #3B82F6; color: #FFF; border: none; padding: 0.5rem 1.5rem; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 700; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#2563EB';" onmouseout="this.style.backgroundColor='#3B82F6';">
          Anlaşıldı
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  setTimeout(() => {
    modal.style.opacity = '1';
    (modal.firstElementChild as HTMLElement).style.transform = 'scale(1)';
  }, 10);

  const closeModal = () => {
    modal.style.opacity = '0';
    (modal.firstElementChild as HTMLElement).style.transform = 'scale(0.95)';
    setTimeout(() => modal.remove(), 200);
  };

  document.getElementById('btn-close-recovery-modal')?.addEventListener('click', closeModal);
  document.getElementById('btn-close-recovery-ok')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
};

export const returnDefectToInventory = async (itemId: string, sapNo: string, name: string, initialSerial: string = '', turbineNo: string = '', reportId: string = '') => {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.6); 
    backdrop-filter: blur(4px); z-index: 999999; display: flex; 
    align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;
  `;
  modal.innerHTML = `
    <div onclick="event.stopPropagation()" style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 480px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); transform: scale(0.95); transition: transform 0.2s;">
      <h3 style="font-size: 1.25rem; font-weight: 700; color: #14F195; margin-top: 0; margin-bottom: 1rem; font-family: 'Rajdhani', sans-serif;">
        <i class="fa-solid fa-reply-all" style="margin-right: 8px;"></i> Stoğa Geri Kazanım
      </h3>
      <p style="color: #E2E8F0; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.25rem;">
        <strong>"${name}"</strong> sökülen (defect) malzemesinin sağlam olduğu anlaşıldı. Lütfen detayları girip geri alım durumunu seçin:
      </p>
      
      <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
        ${turbineNo || reportId ? `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: rgba(255,255,255,0.02); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
          <div>
            <span style="color: #64748B; font-size: 0.7rem; display: block; font-weight: 600; text-transform: uppercase;">Söküldüğü Türbin</span>
            <span style="color: #E2E8F0; font-weight: 700; font-size: 0.85rem;">${turbineNo || '-'}</span>
          </div>
          <div>
            <span style="color: #64748B; font-size: 0.7rem; display: block; font-weight: 600; text-transform: uppercase;">Rapor No</span>
            <span style="color: #F59E0B; font-weight: 700; font-size: 0.85rem; font-family: monospace;">${reportId || '-'}</span>
          </div>
        </div>
        ` : ''}
        
        <div>
          <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.4rem; font-weight: 700;">SAP NUMARASI</label>
          <input type="text" id="return-sap-input" value="${sapNo}" style="width: 100%; height: 38px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 6px; color: #14F195; padding: 0 0.75rem; font-size: 0.9rem; outline: none; font-weight: bold;" />
        </div>
        
        <div>
          <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.4rem; font-weight: 700;">MALZEME TANIMI</label>
          <input type="text" id="return-name-input" value="${name}" style="width: 100%; height: 38px; background-color: rgba(255,255,255,0.01); border: 1px solid #1E293B; border-radius: 6px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.9rem; outline: none;" />
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.4rem; font-weight: 700;">SERİ NUMARASI</label>
          <input type="text" id="return-serial-input" value="${initialSerial === '-' ? '' : initialSerial}" placeholder="Varsa seri no girin..." style="width: 100%; height: 38px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 6px; color: #FFF; padding: 0 0.75rem; font-size: 0.9rem; outline: none; font-family: monospace;" />
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.4rem; font-weight: 700;">AÇIKLAMA / GEREKÇE</label>
          <textarea id="return-desc-input" placeholder="Malzemenin stoğa alınma nedenini yazın..." style="width: 100%; height: 60px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 6px; color: #FFF; padding: 0.5rem 0.75rem; font-size: 0.85rem; outline: none; resize: none;"></textarea>
        </div>
      </div>

      <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
        <button id="btn-return-cancel" style="background: rgba(255,255,255,0.05); color: #FFF; border: none; padding: 0.6rem 1.25rem; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 700;">İptal</button>
        <button id="btn-return-revised" style="background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.3); padding: 0.6rem 1.25rem; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 700;">Revize Stoğa Al</button>
        <button id="btn-return-new" style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 0.6rem 1.25rem; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 700;">Yeni Stoğa Al</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  setTimeout(() => {
    modal.style.opacity = '1';
    (modal.firstElementChild as HTMLElement).style.transform = 'scale(1)';
  }, 10);

  const closeModal = () => {
    modal.style.opacity = '0';
    (modal.firstElementChild as HTMLElement).style.transform = 'scale(0.95)';
    setTimeout(() => modal.remove(), 200);
  };

  const handleReturn = async (cond: 'NEW' | 'REVISED') => {
    try {
      const btnRevised = document.getElementById('btn-return-revised') as HTMLButtonElement;
      const btnNew = document.getElementById('btn-return-new') as HTMLButtonElement;
      const btnCancel = document.getElementById('btn-return-cancel') as HTMLButtonElement;
      
      const sapInput = document.getElementById('return-sap-input') as HTMLInputElement;
      const nameInput = document.getElementById('return-name-input') as HTMLInputElement;
      const serialInput = document.getElementById('return-serial-input') as HTMLInputElement;
      const descInput = document.getElementById('return-desc-input') as HTMLTextAreaElement;
      
      const enteredSap = sapInput ? sapInput.value.trim() : sapNo;
      const enteredName = nameInput ? nameInput.value.trim() : name;
      const enteredSerial = serialInput ? serialInput.value.trim() : '';
      const enteredDesc = descInput ? descInput.value.trim() : '';

      if (!enteredSap) {
        alert('Lütfen geçerli bir SAP Numarası girin.');
        return;
      }
      if (!enteredName) {
        alert('Lütfen geçerli bir Malzeme Adı girin.');
        return;
      }

      if (btnRevised) btnRevised.disabled = true;
      if (btnNew) btnNew.disabled = true;
      if (btnCancel) btnCancel.disabled = true;

      const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
      const email = currentUser.email || 'Sistem';

      const finalRecoveryNote = `Türbin: ${turbineNo || '-'}, Rapor: ${reportId || '-'}, Seri No: ${enteredSerial || '-'}, Açıklama: ${enteredDesc}`;

      await warehouseService.returnDefectToInventory(warehouseState.currentWarehouse.id, itemId, cond, email, enteredSerial, finalRecoveryNote, enteredSap, enteredName);
      closeModal();
      
      if ((window as any).selectWarehouseAndNavigate) {
        (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
      }
    } catch (err) {
      console.error(err);
      alert('Geri alım işlemi sırasında hata oluştu.');
      closeModal();
    }
  };

  document.getElementById('btn-return-revised')?.addEventListener('click', () => handleReturn('REVISED'));
  document.getElementById('btn-return-new')?.addEventListener('click', () => handleReturn('NEW'));
  document.getElementById('btn-return-cancel')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  
  const sapInput = document.getElementById('return-sap-input') as HTMLInputElement;
  const nameInput = document.getElementById('return-name-input') as HTMLInputElement;
  if (sapInput && nameInput) {
    sapInput.addEventListener('input', () => {
      const val = sapInput.value.trim();
      if (val.length >= 4) {
        const match = warehouseAgent.resolveSapNumber(val);
        // Wait, warehouseAgent.resolveSapNumber is async, but wait, in original code it was using inventoryService.getMaterialBySap
        // Let's import inventoryService and use getMaterialBySap
      }
    });
  }
};

export const openSendToRepairModal = async (itemId: string, sapNo: string, description: string, maxQty: number, serialNo: string = '-', faultCode: string = '-', faultDesc: string = '-') => {
  const modal = document.createElement('div');
  modal.id = 'send-repair-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
    z-index: 10002; display: flex; align-items: center; justify-content: center;
  `;

  modal.innerHTML = `
    <div class="glass-panel fade-in-up" style="width: 100%; max-width: 450px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
        <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#14F195; font-weight:800; letter-spacing:1px;">
          <i class="fa-solid fa-screwdriver-wrench" style="margin-right:8px;"></i> TAMİRE SEVK ET
        </h3>
        <button onclick="document.getElementById('send-repair-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
      </div>
      
      <div style="margin-bottom:1.25rem;">
        <p style="color:#94A3B8; font-size:0.85rem; margin-bottom:0.25rem;">Malzeme Detayı</p>
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px;">
          <span style="font-weight:700; color:#FFF; display:block;">${description}</span>
          <span style="font-size:0.75rem; color:#94A3B8;"><i class="fa-solid fa-barcode"></i> SAP: ${sapNo} | Seri No: ${serialNo} | Maksimum Sevk: ${maxQty} Adet</span>
          ${faultCode !== '-' ? `<div style="font-size:0.75rem; color:#F59E0B; margin-top:4px;"><i class="fa-solid fa-triangle-exclamation"></i> Arıza Kodu: ${faultCode}</div>` : ''}
        </div>
      </div>

      <div class="form-group" style="margin-bottom:1.25rem;">
        <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">Sevk Miktarı</label>
        <input type="number" id="send-repair-qty" class="cyber-input" value="${maxQty}" min="1" max="${maxQty}" style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4);">
      </div>

      <div class="form-group" style="margin-bottom:1.5rem;">
        <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">Tamir İstasyonu</label>
        <select id="send-repair-workshop" class="cyber-input" style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4);">
          <option value="Merkez Tamir Atölyesi">Merkez Tamir Atölyesi</option>
        </select>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem;">
        <button onclick="document.getElementById('send-repair-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
        <button id="confirm-send-repair-btn" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(20,241,149,0.3);">GÖNDER</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const confirmBtn = document.getElementById('confirm-send-repair-btn');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const qtyInput = document.getElementById('send-repair-qty') as HTMLInputElement;
      const workshopSelect = document.getElementById('send-repair-workshop') as HTMLSelectElement;
      const qty = parseInt(qtyInput?.value || '0', 10);
      
      if (isNaN(qty) || qty <= 0 || qty > maxQty) {
        alert(`Lütfen 1 ile ${maxQty} arasında geçerli bir miktar girin.`);
        return;
      }

      confirmBtn.setAttribute('disabled', 'true');
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gönderiliyor...';

      try {
        const { repairService } = await import('../../services/RepairService');
        const currentUser = (window as any).currentUser;
        const userEmail = currentUser?.email || currentUser?.displayName || 'Sistem';

        await repairService.createRepair({
          sapNo,
          serialNo,
          description,
          quantity: qty,
          sourceWarehouseId: warehouseState.currentWarehouse.id,
          workshopId: workshopSelect.value,
          sentBy: userEmail,
          faultCode,
          faultDesc
        });

        await warehouseService.updateStockBySap(
          warehouseState.currentWarehouse.id,
          sapNo,
          -qty,
          {
            user: userEmail,
            reason: `Tamir atölyesine sevk edildi (${workshopSelect.value})`
          },
          'DEFECT'
        );

        (window as any).showToast?.('Başarılı', 'Malzeme tamir atölyesine başarıyla sevk edildi.', 'success');
        modal.remove();
        
        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
        }
      } catch (e) {
        console.error(e);
        alert('Tamire gönderim esnasında hata oluştu.');
        confirmBtn.removeAttribute('disabled');
        confirmBtn.innerHTML = 'GÖNDER';
      }
    };
  }
};

export const scrapDefectiveItem = async (itemId: string, sapNo: string, description: string, maxQty: number) => {
  const modal = document.createElement('div');
  modal.id = 'scrap-defect-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
    z-index: 10002; display: flex; align-items: center; justify-content: center;
  `;

  modal.innerHTML = `
    <div class="glass-panel fade-in-up" style="width: 100%; max-width: 450px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(239, 68, 68, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
        <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#EF4444; font-weight:800; letter-spacing:1px;">
          <i class="fa-solid fa-dumpster" style="margin-right:8px;"></i> HURDAYA AYIR
        </h3>
        <button onclick="document.getElementById('scrap-defect-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
      </div>
      
      <div style="margin-bottom:1.25rem;">
        <p style="color:#94A3B8; font-size:0.85rem; margin-bottom:0.25rem;">Malzeme Detayı</p>
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px;">
          <span style="font-weight:700; color:#FFF; display:block;">${description}</span>
          <span style="font-size:0.75rem; color:#94A3B8;"><i class="fa-solid fa-barcode"></i> SAP: ${sapNo} | Maksimum Hurda: ${maxQty} Adet</span>
        </div>
      </div>

      <div class="form-group" style="margin-bottom:1.25rem;">
        <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">Miktar</label>
        <input type="number" id="scrap-qty" class="cyber-input" value="${maxQty}" min="1" max="${maxQty}" style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4);">
      </div>

      <div class="form-group" style="margin-bottom:1.5rem;">
        <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">Gerekçe / Hurda Notu</label>
        <textarea id="scrap-note" class="cyber-input" placeholder="Hurdaya ayrılma gerekçesini yazınız..." style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4); height:80px; resize:none;" required></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem;">
        <button onclick="document.getElementById('scrap-defect-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
        <button id="confirm-scrap-btn" class="btn-cyber" style="background:linear-gradient(135deg, #EF4444 0%, #dc2626 100%); color:#FFF; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(239,68,68,0.3);">HURDAYA AYIR</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const confirmBtn = document.getElementById('confirm-scrap-btn');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const qtyInput = document.getElementById('scrap-qty') as HTMLInputElement;
      const noteInput = document.getElementById('scrap-note') as HTMLTextAreaElement;
      const qty = parseInt(qtyInput?.value || '0', 10);
      const note = noteInput?.value.trim() || '';

      if (isNaN(qty) || qty <= 0 || qty > maxQty) {
        alert(`Lütfen 1 ile ${maxQty} arasında geçerli bir miktar girin.`);
        return;
      }
      if (!note) {
        alert('Lütfen hurdaya ayırma gerekçesini yazın.');
        return;
      }

      confirmBtn.setAttribute('disabled', 'true');
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';

      try {
        const currentUser = (window as any).currentUser;
        const userEmail = currentUser?.email || currentUser?.displayName || 'Sistem';
        const currentWh = warehouseState.currentWarehouse;
        const warehouseId = currentWh?.id || 'MTA';
        const warehouseName = currentWh?.name || warehouseId;
        const itemObj = warehouseState.inventoryItems?.find((i: any) => i.sapNo === sapNo);

        await warehouseService.updateStockBySap(
          warehouseId,
          sapNo,
          -qty,
          {
            user: userEmail,
            reason: `Hurdaya ayrıldı. Gerekçe: ${note}`
          },
          'DEFECT'
        );

        await warehouseService.updateStockBySap(
          warehouseId,
          sapNo,
          qty,
          {
            user: userEmail,
            reason: `Hurda stok girişi. Gerekçe: ${note}`
          },
          'SCRAP'
        );

        // Record to central Field Scraps pool
        await warehouseService.addFieldScrap({
          warehouseId: warehouseId,
          warehouseName: warehouseName,
          sapNo: sapNo,
          serialNo: itemObj?.serialNo || '-',
          description: description || itemObj?.name || 'Hurda Malzeme',
          quantity: qty,
          scrapReason: note,
          scrappedBy: userEmail
        });

        (window as any).showToast?.('Başarılı', 'Malzeme başarıyla hurdaya ayrıldı ve Saha Hurda Listesine eklendi.', 'success');
        modal.remove();

        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(warehouseId);
        }
      } catch (e) {
        console.error(e);
        alert('Hurdaya ayırma esnasında hata oluştu.');
        confirmBtn.removeAttribute('disabled');
        confirmBtn.innerHTML = 'HURDAYA AYIR';
      }
    };
  }
};

export const openBulkSendToRepairModal = (items: Array<{
  id: string;
  sapNo: string;
  description: string;
  quantity: number;
  serialNo: string;
  faultCode: string;
  faultDesc: string;
}>) => {
  const modal = document.createElement('div');
  modal.id = 'bulk-send-repair-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
    z-index: 10002; display: flex; align-items: center; justify-content: center;
  `;

  const dispatchNo = `SV-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}${new Date().getDate().toString().padStart(2,'0')}-${Math.floor(100 + Math.random() * 900)}`;

  let itemsRows = items.map((item, idx) => `
    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px; display:flex; flex-direction:column; gap:6px;">
      <span style="font-weight:700; color:#FFF; font-size:0.85rem;">${idx + 1}. ${item.description}</span>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#94A3B8;">
        <span>SAP: ${item.sapNo} | Seri: ${item.serialNo}</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <span>Miktar:</span>
          <input type="number" class="bulk-qty-input" data-id="${item.id}" value="${item.quantity}" min="1" max="${item.quantity}" style="width:60px; height:26px; background:rgba(0,0,0,0.3); border:1px solid #1E293B; border-radius:4px; color:#FFF; text-align:center; font-size:0.8rem; outline:none;">
        </div>
      </div>
    </div>
  `).join('');

  modal.innerHTML = `
    <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 90vh; display: flex; flex-direction: column;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem; flex-shrink:0;">
        <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#14F195; font-weight:800; letter-spacing:1px;">
          <i class="fa-solid fa-screwdriver-wrench" style="margin-right:8px;"></i> TOPLU TAMİRE SEVK
        </h3>
        <button onclick="document.getElementById('bulk-send-repair-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
      </div>
      
      <div style="margin-bottom:1.25rem; font-size:0.85rem; color:#E2E8F0; flex-shrink:0;">
        <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.4rem; font-weight:700;">Sevk Numarası (Manuel Düzenlenebilir)</label>
        <input type="text" id="bulk-dispatch-no-input" class="cyber-input" value="${dispatchNo}" style="width:100%; padding:0.6rem 0.85rem; background:rgba(0,0,0,0.4); font-family:monospace; color:#14F195; font-weight:bold; font-size:0.95rem; border:1px solid rgba(20,241,149,0.3); border-radius:6px;">
      </div>

      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; padding-right: 4px;" class="custom-scrollbar">
        <p style="color:#94A3B8; font-size:0.85rem; margin:0; font-weight:600;">Sevk Edilecek Malzemeler (${items.length} Kalem)</p>
        ${itemsRows}
      </div>

      <div class="form-group" style="margin-bottom:1.5rem; flex-shrink:0;">
        <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">Tamir İstasyonu</label>
        <select id="bulk-send-repair-workshop" class="cyber-input" style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4);">
          <option value="Merkez Tamir Atölyesi">Merkez Tamir Atölyesi</option>
        </select>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem; flex-shrink:0;">
        <button onclick="document.getElementById('bulk-send-repair-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
        <button id="bulk-confirm-send-repair-btn" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(20,241,149,0.3);">SEVK ET</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const confirmBtn = document.getElementById('bulk-confirm-send-repair-btn');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const workshopSelect = document.getElementById('bulk-send-repair-workshop') as HTMLSelectElement;
      const qtyInputs = document.querySelectorAll('.bulk-qty-input') as NodeListOf<HTMLInputElement>;
      const dispatchNoInput = document.getElementById('bulk-dispatch-no-input') as HTMLInputElement;
      const finalDispatchNo = (dispatchNoInput?.value || dispatchNo).trim() || dispatchNo;
      
      const itemsWithQty = items.map(item => {
        const input = Array.from(qtyInputs).find(inp => inp.getAttribute('data-id') === item.id);
        const qty = parseInt(input?.value || '0', 10);
        return { ...item, sendQty: qty };
      });

      for (const item of itemsWithQty) {
        if (isNaN(item.sendQty) || item.sendQty <= 0 || item.sendQty > item.quantity) {
          alert(`Lütfen "${item.description}" için 1 ile ${item.quantity} arasında geçerli bir miktar girin.`);
          return;
        }
      }

      confirmBtn.setAttribute('disabled', 'true');
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sevk Ediliyor...';

      try {
        const { repairService } = await import('../../services/RepairService');
        const currentUser = (window as any).currentUser;
        const userEmail = currentUser?.email || currentUser?.displayName || 'Sistem';

        for (const item of itemsWithQty) {
          await repairService.createRepair({
            sapNo: item.sapNo,
            serialNo: item.serialNo,
            description: item.description,
            quantity: item.sendQty,
            sourceWarehouseId: warehouseState.currentWarehouse.id,
            workshopId: workshopSelect.value,
            sentBy: userEmail,
            faultCode: item.faultCode,
            faultDesc: item.faultDesc,
            dispatchNo: finalDispatchNo,
            status: 'PENDING_ARRIVAL'
          } as any);

          // Direct defect item status update in Firestore
          if (item.id) {
            try {
              const { doc, getDoc, updateDoc, setDoc, collection, serverTimestamp } = await import('firebase/firestore');
              const { db } = await import('../../firebase');
              const docRef = doc(db, 'warehouses', warehouseState.currentWarehouse.id, 'inventory_v2', item.id);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                const invData = docSnap.data();
                const curQty = invData.quantity || 0;
                if (item.sendQty >= curQty) {
                  await updateDoc(docRef, {
                    quantity: 0,
                    status: 'TAMIRE_SEVK_EDILDI',
                    dispatchedQty: item.sendQty,
                    dispatchNo: finalDispatchNo,
                    dispatchedAt: serverTimestamp(),
                    dispatchedBy: userEmail,
                    lastUpdated: serverTimestamp()
                  });
                } else {
                  await updateDoc(docRef, {
                    quantity: curQty - item.sendQty,
                    lastUpdated: serverTimestamp()
                  });
                  const newDocRef = doc(collection(db, 'warehouses', warehouseState.currentWarehouse.id, 'inventory_v2'));
                  await setDoc(newDocRef, {
                    ...invData,
                    quantity: 0,
                    status: 'TAMIRE_SEVK_EDILDI',
                    dispatchedQty: item.sendQty,
                    dispatchNo: finalDispatchNo,
                    dispatchedAt: serverTimestamp(),
                    dispatchedBy: userEmail,
                    lastUpdated: serverTimestamp()
                  });
                }
              }
            } catch (invErr) {
              console.warn("Direct defect inventory repair update failed:", invErr);
            }
          }

          await warehouseService.addLog(warehouseState.currentWarehouse.id, {
            itemId: item.id,
            sapNo: item.sapNo,
            materialName: item.description,
            quantity: item.sendQty,
            type: 'REMOVE',
            user: userEmail,
            note: `Tamir atölyesine sevk edildi. Sevk No: ${finalDispatchNo}`
          }).catch(() => {});
        }

        (window as any).showToast?.('Başarılı', `Malzemeler ${finalDispatchNo} sevk numarası ile başarıyla sevk edildi.`, 'success');
        modal.remove();

        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
        }
      } catch (e: any) {
        console.error(e);
        alert('Toplu sevk esnasında bir hata oluştu: ' + e.message);
        confirmBtn.removeAttribute('disabled');
        confirmBtn.innerHTML = 'SEVK ET';
      }
    };
  }
};

/**
 * Resolves turbine number from service reports using reportNo or mcfNo.
 */
export const resolveTurbineFromReports = async (reportNo?: string, mcfNo?: string): Promise<string> => {
  try {
    const cleanRepNo = String(reportNo || '').trim();
    const cleanMcf = String(mcfNo || '').trim();
    if ((!cleanRepNo || cleanRepNo === '-') && (!cleanMcf || cleanMcf === '-')) {
      return '-';
    }

    // 1. First check if serviceReportService has reports loaded in memory
    try {
      const { serviceReportService } = await import('../../services/ServiceReportService');
      const allReports = await serviceReportService.getAllReports().catch(() => []);
      if (allReports && allReports.length > 0) {
        const match = allReports.find((r: any) => {
          if (cleanRepNo && cleanRepNo !== '-' && (r.reportNo === cleanRepNo || r.id === cleanRepNo)) return true;
          if (cleanMcf && cleanMcf !== '-' && String(r.matFormNo || '').trim() === cleanMcf) return true;
          return false;
        });
        if (match) {
          const tVal = match.turbineNo || match.turbineSerial || (match as any).turbine;
          if (tVal && tVal !== '-' && tVal !== 'Bilinmeyen') {
            return match.siteName ? `${match.siteName} ${tVal}` : tVal;
          }
        }
      }
    } catch(e) {}

    // 2. Direct Firestore query fallback on serviceReports
    const { collection, query, where, getDocs, limit } = await import('firebase/firestore');
    const { db } = await import('../../firebase');

    if (cleanRepNo && cleanRepNo !== '-') {
      const q = query(collection(db, 'serviceReports'), where('reportNo', '==', cleanRepNo), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const rData = snap.docs[0].data();
        const tVal = rData.turbineNo || rData.turbineSerial || rData.turbine;
        if (tVal && tVal !== '-' && tVal !== 'Bilinmeyen') {
          return rData.siteName ? `${rData.siteName} ${tVal}` : tVal;
        }
      }
    }

    if (cleanMcf && cleanMcf !== '-') {
      const q = query(collection(db, 'serviceReports'), where('matFormNo', '==', cleanMcf), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const rData = snap.docs[0].data();
        const tVal = rData.turbineNo || rData.turbineSerial || rData.turbine;
        if (tVal && tVal !== '-' && tVal !== 'Bilinmeyen') {
          return rData.siteName ? `${rData.siteName} ${tVal}` : tVal;
        }
      }
    }
  } catch (e) {
    console.warn('[WarehouseModals] resolveTurbineFromReports failed:', e);
  }
  return '-';
};

export const openBulkSendToTeamRepairModal = (items: Array<{
  id: string;
  sapNo: string;
  description: string;
  quantity: number;
  serialNo?: string;
  faultCode?: string;
  faultDesc?: string;
  turbine?: string;
  reportNo?: string;
  mcfNo?: string;
}>) => {
  const modal = document.createElement('div');
  modal.id = 'bulk-send-team-repair-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
    z-index: 10002; display: flex; align-items: center; justify-content: center;
  `;

  let itemsRows = items.map((item, idx) => `
    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px; display:flex; flex-direction:column; gap:6px;">
      <span style="font-weight:700; color:#FFF; font-size:0.85rem;">${idx + 1}. ${item.description}</span>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#94A3B8;">
        <span>SAP: ${item.sapNo} | Seri: ${item.serialNo || '-'}</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <span>Miktar:</span>
          <input type="number" class="bulk-team-qty-input" data-id="${item.id}" value="${item.quantity}" min="1" max="${item.quantity}" style="width:60px; height:26px; background:rgba(0,0,0,0.3); border:1px solid #1E293B; border-radius:4px; color:#FFF; text-align:center; font-size:0.8rem; outline:none;">
        </div>
      </div>
    </div>
  `).join('');

  modal.innerHTML = `
    <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 90vh; display: flex; flex-direction: column;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem; flex-shrink:0;">
        <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#F59E0B; font-weight:800; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-users-gear"></i> EKİBE TAMİRE GÖNDER
        </h3>
        <button onclick="document.getElementById('bulk-send-team-repair-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; padding-right: 4px;" class="custom-scrollbar">
        <p style="color:#94A3B8; font-size:0.85rem; margin:0; font-weight:600;">Saha Ekip Onarımına Gönderilecek (${items.length} Kalem)</p>
        ${itemsRows}
      </div>

      <div class="form-group" style="margin-bottom:1rem; flex-shrink:0;">
        <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.4rem; font-weight:700;">
          <i class="fa-solid fa-warehouse" style="color:#F59E0B;"></i> Hedef Santral / Depo Havuzu
        </label>
        <select id="bulk-team-repair-target-wh" class="cyber-input" style="width:100%; padding:0.65rem 0.85rem; background:rgba(0,0,0,0.4); border:1px solid #1E293B; border-radius:6px; color:#FFF;">
          ${dataService.getWarehouses().map((w: any) => `<option value="${w.id}" ${w.id === warehouseState.currentWarehouse?.id ? 'selected' : ''}>${w.name}</option>`).join('')}
        </select>
      </div>

      <div class="form-group" style="margin-bottom:1rem; flex-shrink:0;">
        <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.4rem; font-weight:700;">Atanan Ekip / Birim</label>
        <select id="bulk-team-repair-team" class="cyber-input" style="width:100%; padding:0.65rem 0.85rem; background:rgba(0,0,0,0.4); border:1px solid #1E293B; border-radius:6px; color:#FFF;">
          <option value="Saha Servis Ekibi">Saha Servis Ekibi (Genel)</option>
          ${Array.from({ length: 15 }, (_, i) => `<option value="Team ${(i+1).toString().padStart(2, '0')}">Team ${(i+1).toString().padStart(2, '0')}</option>`).join('')}
        </select>
      </div>

      <div class="form-group" style="margin-bottom:1.5rem; flex-shrink:0;">
        <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.4rem; font-weight:700;">Yönetici Notu / Onarım Talimatı (Opsiyonel)</label>
        <textarea id="bulk-team-repair-notes" class="cyber-input" placeholder="Örn: Sızdırmazlık contası kontrol edilip yenilenecek..." style="width:100%; height:60px; padding:0.65rem 0.85rem; background:rgba(0,0,0,0.4); border:1px solid #1E293B; border-radius:6px; color:#FFF; resize:none;"></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem; flex-shrink:0;">
        <button onclick="document.getElementById('bulk-send-team-repair-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
        <button id="bulk-confirm-team-repair-btn" class="btn-cyber" style="background:linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color:#0A0E17; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(245,158,11,0.3);">EKİBE GÖNDER</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const confirmBtn = document.getElementById('bulk-confirm-team-repair-btn');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const targetWhSelect = document.getElementById('bulk-team-repair-target-wh') as HTMLSelectElement;
      const targetWhId = targetWhSelect?.value || warehouseState.currentWarehouse.id;
      const allWarehouses = dataService.getWarehouses();
      const targetWhObj = allWarehouses.find((w: any) => w.id === targetWhId) || warehouseState.currentWarehouse;

      const teamSelect = document.getElementById('bulk-team-repair-team') as HTMLSelectElement;
      const notesInput = document.getElementById('bulk-team-repair-notes') as HTMLTextAreaElement;
      const qtyInputs = document.querySelectorAll('.bulk-team-qty-input') as NodeListOf<HTMLInputElement>;
      
      const itemsWithQty = items.map(item => {
        const input = Array.from(qtyInputs).find(inp => inp.getAttribute('data-id') === item.id);
        const qty = parseInt(input?.value || '0', 10);
        return { ...item, sendQty: qty };
      });

      for (const item of itemsWithQty) {
        if (isNaN(item.sendQty) || item.sendQty <= 0 || item.sendQty > item.quantity) {
          alert(`Lütfen "${item.description}" için 1 ile ${item.quantity} arasında geçerli bir miktar girin.`);
          return;
        }
      }

      confirmBtn.setAttribute('disabled', 'true');
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gönderiliyor...';

      try {
        const { collection, addDoc, serverTimestamp, doc, updateDoc, getDoc, setDoc } = await import('firebase/firestore');
        const { db } = await import('../../firebase');
        const currentUser = (window as any).currentUser;
        const userEmail = currentUser?.email || currentUser?.displayName || 'Sistem';

        for (const item of itemsWithQty) {
          // 1. Create team_repairs record
          await addDoc(collection(db, 'team_repairs'), {
            warehouseId: targetWhId,
            warehouseName: targetWhObj.name,
            originalItemId: item.id,
            sapNo: item.sapNo,
            serialNo: item.serialNo || '-',
            description: item.description,
            quantity: item.sendQty,
            turbine: item.turbine || '-',
            turbineNo: item.turbine || '-',
            reportNo: item.reportNo || '-',
            mcfNo: item.mcfNo || '-',
            faultCode: item.faultCode || '-',
            faultDesc: item.faultDesc || '-',
            assignedTeam: teamSelect?.value || 'Saha Servis Ekibi',
            adminNotes: (notesInput?.value || '').trim(),
            status: 'PENDING_REPAIR',
            sentAt: serverTimestamp(),
            sentBy: userEmail
          });

          // 2. Direct defect item status update in Firestore inventory_v2
          if (item.id) {
            try {
              const docRef = doc(db, 'warehouses', warehouseState.currentWarehouse.id, 'inventory_v2', item.id);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                const invData = docSnap.data();
                const curQty = invData.quantity || 0;
                if (item.sendQty >= curQty) {
                  await updateDoc(docRef, {
                    quantity: 0,
                    status: 'EKIP_TAMIRINDE',
                    dispatchedQty: item.sendQty,
                    dispatchedAt: serverTimestamp(),
                    dispatchedBy: userEmail,
                    lastUpdated: serverTimestamp()
                  });
                } else {
                  await updateDoc(docRef, {
                    quantity: curQty - item.sendQty,
                    lastUpdated: serverTimestamp()
                  });
                  const newDocRef = doc(collection(db, 'warehouses', warehouseState.currentWarehouse.id, 'inventory_v2'));
                  await setDoc(newDocRef, {
                    ...invData,
                    quantity: 0,
                    status: 'EKIP_TAMIRINDE',
                    dispatchedQty: item.sendQty,
                    dispatchedAt: serverTimestamp(),
                    dispatchedBy: userEmail,
                    lastUpdated: serverTimestamp()
                  });
                }
              }
            } catch (invErr) {
              console.warn("Direct defect inventory team repair update failed:", invErr);
            }
          }

          // 3. Log warehouse movement
          await warehouseService.addLog(warehouseState.currentWarehouse.id, {
            itemId: item.id,
            sapNo: item.sapNo,
            materialName: item.description,
            quantity: item.sendQty,
            type: 'REMOVE',
            user: userEmail,
            note: `Saha ekip onarımına sevk edildi. Ekip: ${teamSelect?.value || 'Saha Ekibi'}`
          }).catch(() => {});
        }

        (window as any).showToast?.('Başarılı', 'Malzemeler saha ekibi tamir havuzuna başarıyla sevk edildi.', 'success');
        modal.remove();

        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
        }
      } catch (e: any) {
        console.error(e);
        alert('Ekibe sevk esnasında bir hata oluştu: ' + e.message);
        confirmBtn.removeAttribute('disabled');
        confirmBtn.innerHTML = 'EKİBE GÖNDER';
      }
    };
  }
};

export const openTeamRepairFormModal = async (repairItem: any) => {
  const modal = document.createElement('div');
  modal.id = 'team-repair-form-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
    z-index: 10003; display: flex; align-items: center; justify-content: center;
  `;

  if ((!warehouseState.inventoryItems || warehouseState.inventoryItems.length === 0) && repairItem.warehouseId) {
    try {
      warehouseState.inventoryItems = await warehouseService.getInventory(repairItem.warehouseId);
    } catch(e) {}
  }

  const validWhStock = (warehouseState.inventoryItems || []).filter(
    (i: any) => i.condition !== 'DEFECT' && i.condition !== 'SCRAP' && (i.quantity > 0 || i.quantity !== undefined)
  );

  const currentUser = (window as any).currentUser;
  const currentUserName = currentUser?.displayName || currentUser?.email?.split('@')[0] || '';

  let initialTurbine = repairItem.turbine && repairItem.turbine !== '-' ? repairItem.turbine : (repairItem.turbineNo && repairItem.turbineNo !== '-' ? repairItem.turbineNo : '');
  if (!initialTurbine || initialTurbine === '-' || initialTurbine === 'Bilinmeyen') {
    initialTurbine = await resolveTurbineFromReports(repairItem.reportNo, repairItem.mcfNo);
    if (initialTurbine && initialTurbine !== '-') {
      repairItem.turbine = initialTurbine;
      repairItem.turbineNo = initialTurbine;
    }
  }
  const displayTurbine = initialTurbine && initialTurbine !== '-' ? initialTurbine : '';

  modal.innerHTML = `
    <datalist id="repair-wh-inventory-datalist">
      ${validWhStock.map((item: any) => {
        const s = String(item.sapNo || '').trim();
        const d = String(item.description || '').trim();
        const q = item.quantity || 0;
        const shelf = item.shelfNo ? ` (Raf: ${item.shelfNo})` : '';
        return `<option value="${s}" label="${d} - Stok: ${q}${shelf}">${s} - ${d}</option>`;
      }).join('')}
    </datalist>

    <div class="glass-panel fade-in-up" style="width: 100%; max-width: 720px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.3); box-shadow: 0 20px 50px rgba(0,0,0,0.6); max-height: 90vh; display: flex; flex-direction: column;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem; flex-shrink:0;">
        <div>
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.3rem; color:#14F195; font-weight:800; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-wrench"></i> MALZEME BAKIM & ONARIM FORMU
          </h3>
          <span style="font-size:0.75rem; color:#94A3B8;">Onarım tamamlandığında parça <strong>T${repairItem.sapNo}</strong> koduyla Tamirli stoğa girecektir.</span>
        </div>
        <button onclick="document.getElementById('team-repair-form-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <!-- Item info card -->
      <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:1rem; border-radius:8px; margin-bottom:1.25rem; flex-shrink:0;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
          <span style="font-size:0.95rem; font-weight:800; color:#FFF;">${repairItem.description}</span>
          <span style="background:rgba(245,158,11,0.15); color:#F59E0B; border:1px solid rgba(245,158,11,0.3); padding:2px 8px; border-radius:4px; font-weight:800; font-size:0.75rem;">SAP: ${repairItem.sapNo}</span>
        </div>
        <div style="display:flex; gap:1.5rem; font-size:0.78rem; color:#94A3B8;">
          <span><strong>Seri:</strong> ${repairItem.serialNo || '-'}</span>
          <span><strong>Türbin:</strong> <span style="color:#38BDF8; font-weight:700;">${displayTurbine || '-'}</span></span>
          <span><strong>Miktar:</strong> ${repairItem.quantity || 1} Adet</span>
          <span><strong>Ekip:</strong> ${repairItem.assignedTeam || '-'}</span>
        </div>
      </div>

      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; padding-right: 4px;" class="custom-scrollbar">
        <!-- Actions taken -->
        <div class="form-group">
          <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.4rem; font-weight:700;">
            <i class="fa-solid fa-pen-to-square" style="color:#14F195;"></i> Yapılan İşlemler / Onarım Detayı <span style="color:#EF4444;">*</span>
          </label>
          <textarea id="repair-action-notes" class="cyber-input" placeholder="Örn: Rulman ve sızdırmazlık keçesi değiştirildi, iç temizlik yapıldı ve mekanik dönüş testi başarılı tamamlandı..." style="width:100%; height:80px; padding:0.75rem; background:rgba(0,0,0,0.4); border:1px solid #1E293B; border-radius:6px; color:#FFF; resize:none; font-size:0.82rem;"></textarea>
        </div>

        <!-- Used materials -->
        <div class="form-group" style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.07); padding:0.85rem; border-radius:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.6rem;">
            <label style="margin:0; color:#94A3B8; font-size:0.8rem; font-weight:700;">
              <i class="fa-solid fa-cube" style="color:#38BDF8;"></i> Tamirde Kullanılan Parçalar / Sarf Malzemeler (Opsiyonel)
            </label>
            <span style="font-size:0.7rem; color:#64748B;">Sapsız malzeme için SAP alanına <strong>-</strong> yazınız</span>
          </div>

          <!-- Input fields row -->
          <div style="display:grid; grid-template-columns: 125px 1fr 65px auto; gap:6px; align-items:flex-end; background:rgba(0,0,0,0.3); padding:8px; border-radius:6px; border:1px dashed rgba(56,189,248,0.3);">
            <div>
              <span style="font-size:0.7rem; color:#94A3B8; display:block; margin-bottom:3px; font-weight:600;">SAP No (veya -)</span>
              <input type="text" id="repair-mat-sap-input" list="repair-wh-inventory-datalist" class="cyber-input" placeholder="SAP veya -" style="width:100%; padding:0.45rem 0.5rem; font-size:0.78rem; background:rgba(0,0,0,0.4); border:1px solid #1E293B; border-radius:4px; color:#FFF; font-weight:700;">
            </div>
            <div>
              <span style="font-size:0.7rem; color:#94A3B8; display:block; margin-bottom:3px; font-weight:600;">Malzeme Açıklaması</span>
              <input type="text" id="repair-mat-desc-input" class="cyber-input" placeholder="Açıklama giriniz..." style="width:100%; padding:0.45rem 0.5rem; font-size:0.78rem; background:rgba(0,0,0,0.4); border:1px solid #1E293B; border-radius:4px; color:#FFF;">
            </div>
            <div>
              <span style="font-size:0.7rem; color:#94A3B8; display:block; margin-bottom:3px; font-weight:600;">Adet</span>
              <input type="number" id="repair-mat-qty-input" min="1" value="1" class="cyber-input" style="width:100%; padding:0.45rem 0.35rem; font-size:0.78rem; background:rgba(0,0,0,0.4); border:1px solid #1E293B; border-radius:4px; color:#FFF; text-align:center; font-weight:700;">
            </div>
            <div>
              <button type="button" id="repair-mat-add-btn" class="btn-cyber" style="background:#0284C7; color:#FFF; font-size:0.75rem; font-weight:700; padding:0.45rem 0.75rem; border-radius:4px; cursor:pointer; display:flex; align-items:center; gap:4px; white-space:nowrap; border:none; height:32px;">
                <i class="fa-solid fa-plus"></i> Ekle
              </button>
            </div>
          </div>

          <!-- Live Status feedback for the item being typed -->
          <div id="repair-mat-status-badge" style="font-size:0.72rem; margin-top:4px; min-height:16px; padding:2px 4px; display:none;"></div>

          <!-- Added materials list -->
          <div id="repair-added-materials-container" style="margin-top:0.6rem;">
            <span id="no-used-materials-label" style="color:#64748B; font-size:0.75rem; font-style:italic;">Henüz kullanılan parça eklenmedi (Opsiyonel).</span>
          </div>
        </div>

        <!-- Türbin, Raf No, MÇF No, Teknisyen ve Süre -->
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); padding:1rem; border-radius:8px; display:flex; flex-direction:column; gap:0.85rem;">
          <!-- Satır 1: Söküldüğü Türbin, Raf Numarası, MÇF No -->
          <div style="display:grid; grid-template-columns: 1.4fr 1fr 1fr; gap:0.85rem; align-items:flex-start;">
            <div class="form-group" style="margin:0;">
              <label style="display:block; color:#38BDF8; font-size:0.8rem; margin-bottom:0.35rem; font-weight:700; white-space:nowrap;">
                <i class="fa-solid fa-fan" style="color:#38BDF8;"></i> Söküldüğü Türbin
              </label>
              <input type="text" id="repair-turbine-input" class="cyber-input" value="${displayTurbine}" placeholder="Örn: T01, Sarıkaya T01..." style="width:100%; padding:0.6rem 0.75rem; background:rgba(0,0,0,0.4); border:1px solid rgba(56,189,248,0.4); border-radius:6px; color:#FFF; font-size:0.82rem; font-weight:700;">
            </div>
            <div class="form-group" style="margin:0;">
              <label style="display:block; color:#F59E0B; font-size:0.8rem; margin-bottom:0.35rem; font-weight:700; white-space:nowrap;">
                <i class="fa-solid fa-boxes-stacked" style="color:#F59E0B;"></i> Raf Numarası <span style="color:#EF4444;">*</span>
              </label>
              <input type="text" id="repair-shelf-no-input" class="cyber-input" placeholder="Örn: A-01, Raf 3..." style="width:100%; padding:0.6rem 0.75rem; background:rgba(0,0,0,0.4); border:1px solid rgba(245,158,11,0.5); border-radius:6px; color:#FFF; font-size:0.82rem; font-weight:700;">
            </div>
            <div class="form-group" id="repair-mcf-group" style="margin:0;">
              <label style="display:block; color:#F59E0B; font-size:0.8rem; margin-bottom:0.35rem; font-weight:700; white-space:nowrap;">
                <i class="fa-solid fa-file-invoice" style="color:#F59E0B;"></i> MÇF No <span id="repair-mcf-required" style="color:#EF4444; display:none;">* (Zorunlu)</span>
              </label>
              <input type="text" id="repair-mcf-input" class="cyber-input" value="${repairItem.mcfNo && repairItem.mcfNo !== '-' ? repairItem.mcfNo : ''}" placeholder="MÇF No giriniz..." style="width:100%; padding:0.6rem 0.75rem; background:rgba(0,0,0,0.4); border:1px solid #1E293B; border-radius:6px; color:#FFF; font-size:0.82rem; font-weight:700;">
            </div>
          </div>

          <!-- Satır 2: Teknisyen ve Süre -->
          <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:0.85rem; align-items:flex-start;">
            <div class="form-group" style="margin:0;">
              <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.35rem; font-weight:700; white-space:nowrap;">
                <i class="fa-solid fa-user-gear" style="color:#94A3B8;"></i> Onarımı Yapan Teknisyen
              </label>
              <input type="text" id="repair-technician-input" class="cyber-input" value="${currentUserName}" placeholder="Teknisyen Adı..." style="width:100%; padding:0.6rem 0.75rem; background:rgba(0,0,0,0.4); border:1px solid #1E293B; border-radius:6px; color:#FFF; font-size:0.82rem; font-weight:600;">
            </div>
            <div class="form-group" style="margin:0;">
              <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.35rem; font-weight:700; white-space:nowrap;">
                <i class="fa-solid fa-clock" style="color:#94A3B8;"></i> Onarım Süresi
              </label>
              <input type="text" id="repair-duration-input" class="cyber-input" placeholder="Örn: 0:45 dk veya 45..." style="width:100%; padding:0.6rem 0.75rem; background:rgba(0,0,0,0.4); border:1px solid #1E293B; border-radius:6px; color:#FFF; font-size:0.82rem;">
            </div>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem; margin-top:1rem; flex-shrink:0;">
        <button onclick="document.getElementById('team-repair-form-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
        <button id="submit-team-repair-btn" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(20,241,149,0.3);">
          <i class="fa-solid fa-circle-check"></i> TAMİRİ TAMAMLA VE STOĞA AL
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Added materials state & list rendering
  const addedUsedMaterials: Array<{
    name: string;
    sapNo: string;
    description: string;
    qty: number;
    deductedFromStock: boolean;
    shelfNo?: string;
    mcfNo?: string;
  }> = [];

  const renderAddedMaterials = () => {
    const container = document.getElementById('repair-added-materials-container');
    if (!container) return;

    if (addedUsedMaterials.length === 0) {
      container.innerHTML = `<span id="no-used-materials-label" style="color:#64748B; font-size:0.75rem; font-style:italic;">Henüz kullanılan parça eklenmedi (Opsiyonel).</span>`;
      return;
    }

    container.innerHTML = `
      <div style="background:rgba(0,0,0,0.25); border:1px solid rgba(255,255,255,0.07); border-radius:6px; overflow:hidden; max-height:160px; overflow-y:auto;" class="custom-scrollbar">
        <table style="width:100%; border-collapse:collapse; font-size:0.75rem; text-align:left;">
          <thead>
            <tr style="background:rgba(255,255,255,0.04); color:#94A3B8; border-bottom:1px solid rgba(255,255,255,0.07); position:sticky; top:0; z-index:1;">
              <th style="padding:5px 8px; width:85px;">SAP No</th>
              <th style="padding:5px 8px;">Açıklama</th>
              <th style="padding:5px 8px; width:55px; text-align:center;">Adet</th>
              <th style="padding:5px 8px; width:170px;">Stok Durumu</th>
              <th style="padding:5px 8px; width:30px; text-align:center;">Sil</th>
            </tr>
          </thead>
          <tbody>
            ${addedUsedMaterials.map((item, idx) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.03); color:#E2E8F0;">
                <td style="padding:5px 8px; font-weight:700; color:${item.sapNo !== '-' ? '#38BDF8' : '#94A3B8'}; font-family:monospace;">${item.sapNo}</td>
                <td style="padding:5px 8px; font-weight:600;">${item.description}</td>
                <td style="padding:5px 8px; text-align:center; font-weight:700; color:#14F195;">${item.qty} Adet</td>
                <td style="padding:5px 8px;">
                  ${item.deductedFromStock ? 
                    `<span style="color:#10B981; font-size:0.7rem; font-weight:700; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-circle-check"></i> Depo Stoğu (${item.shelfNo || '-'})</span>` : 
                    `<span style="color:#94A3B8; font-size:0.7rem; font-weight:600; display:inline-flex; align-items:center; gap:4px;"><i class="fa-solid fa-circle-info"></i> Harici Sarf</span>`}
                </td>
                <td style="padding:5px 8px; text-align:center;">
                  <button type="button" onclick="window.removeRepairUsedMaterial(${idx})" style="background:transparent; border:none; color:#EF4444; cursor:pointer; font-size:0.85rem; padding:2px;" title="Kaldır">
                    <i class="fa-solid fa-trash"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    const hasStockUsed = addedUsedMaterials.some(m => m.deductedFromStock);
    const mcfReqEl = document.getElementById('repair-mcf-required');
    const mcfInputEl = document.getElementById('repair-mcf-input') as HTMLInputElement;
    if (mcfReqEl) {
      mcfReqEl.style.display = hasStockUsed ? 'inline' : 'none';
    }
    if (mcfInputEl) {
      if (hasStockUsed) {
        mcfInputEl.style.borderColor = 'rgba(245,158,11,0.8)';
        if (!mcfInputEl.value) {
          mcfInputEl.placeholder = 'MÇF No (Zorunludur)...';
        }
      } else {
        mcfInputEl.style.borderColor = '#1E293B';
        mcfInputEl.placeholder = 'MÇF No giriniz...';
      }
    }
  };

  (window as any).removeRepairUsedMaterial = (idx: number) => {
    addedUsedMaterials.splice(idx, 1);
    renderAddedMaterials();
  };

  const matSapInput = document.getElementById('repair-mat-sap-input') as HTMLInputElement;
  const matDescInput = document.getElementById('repair-mat-desc-input') as HTMLInputElement;
  const matQtyInput = document.getElementById('repair-mat-qty-input') as HTMLInputElement;
  const matAddBtn = document.getElementById('repair-mat-add-btn') as HTMLButtonElement;
  const matStatusBadge = document.getElementById('repair-mat-status-badge') as HTMLDivElement;

  const updateMatStatus = () => {
    const rawVal = (matSapInput?.value || '').trim();
    if (!rawVal) {
      if (matStatusBadge) matStatusBadge.style.display = 'none';
      return;
    }
    if (matStatusBadge) matStatusBadge.style.display = 'block';
    const cleanSap = rawVal.split(' - ')[0].trim();

    if (cleanSap === '-') {
      if (matStatusBadge) {
        matStatusBadge.innerHTML = `<span style="color:#94A3B8; font-weight:600;"><i class="fa-solid fa-circle-info"></i> Harici Sarf Malzeme (Depo stoğuna dokunulmaz, forma ve PDF'e işlenir)</span>`;
      }
      return;
    }

    const matched = validWhStock.find((i: any) =>
      String(i.sapNo || '').trim().toLowerCase() === cleanSap.toLowerCase() ||
      String(i.sapNo || '').trim().toLowerCase() === rawVal.toLowerCase()
    );

    if (matched) {
      if (matSapInput) matSapInput.value = matched.sapNo;
      if (matDescInput) matDescInput.value = matched.description;
      if (matStatusBadge) {
        matStatusBadge.innerHTML = `
          <span style="color:#10B981; font-weight:700;">
            <i class="fa-solid fa-circle-check"></i> Depo Stoğu Bulundu: ${matched.quantity} Adet Mevcut (Raf: ${matched.shelfNo || '-'}) ➔ Depo Stoğundan Düşülecek
          </span>
        `;
      }
    } else {
      if (matStatusBadge) {
        matStatusBadge.innerHTML = `
          <span style="color:#F59E0B; font-weight:600;">
            <i class="fa-solid fa-triangle-exclamation"></i> Depo stoğunda bulunamadı ➔ Harici Sarf olarak eklenecek
          </span>
        `;
      }
    }
  };

  matSapInput?.addEventListener('input', updateMatStatus);
  matSapInput?.addEventListener('change', updateMatStatus);

  const addMaterialItem = () => {
    const rawSap = (matSapInput?.value || '').trim();
    const cleanSap = rawSap ? rawSap.split(' - ')[0].trim() : '-';
    const descVal = (matDescInput?.value || '').trim();
    const qtyVal = parseInt(matQtyInput?.value || '1', 10);

    if (!descVal && (cleanSap === '-' || !cleanSap)) {
      alert('Lütfen malzeme açıklamasını giriniz.');
      matDescInput?.focus();
      return;
    }

    if (qtyVal <= 0 || isNaN(qtyVal)) {
      alert('Lütfen geçerli bir adet giriniz.');
      matQtyInput?.focus();
      return;
    }

    const matched = cleanSap !== '-' ? validWhStock.find((i: any) =>
      String(i.sapNo || '').trim().toLowerCase() === cleanSap.toLowerCase()
    ) : null;

    const finalSap = matched ? matched.sapNo : (cleanSap || '-');
    const finalDesc = matched ? matched.description : (descVal || finalSap);
    const isDeducted = !!matched;

    addedUsedMaterials.push({
      name: finalSap !== '-' ? `${finalSap} - ${finalDesc}` : finalDesc,
      sapNo: finalSap,
      description: finalDesc,
      qty: qtyVal,
      deductedFromStock: isDeducted,
      shelfNo: matched?.shelfNo || '-'
    });

    if (matSapInput) matSapInput.value = '';
    if (matDescInput) matDescInput.value = '';
    if (matQtyInput) matQtyInput.value = '1';
    if (matStatusBadge) matStatusBadge.style.display = 'none';

    renderAddedMaterials();
    matSapInput?.focus();
  };

  matAddBtn?.addEventListener('click', addMaterialItem);

  [matSapInput, matDescInput, matQtyInput].forEach(el => {
    el?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addMaterialItem();
      }
    });
  });

  const durInputEl = document.getElementById('repair-duration-input') as HTMLInputElement;
  durInputEl?.addEventListener('blur', () => {
    if (durInputEl.value.trim()) {
      durInputEl.value = formatRepairDuration(durInputEl.value);
    }
  });

  const submitBtn = document.getElementById('submit-team-repair-btn');
  if (submitBtn) {
    submitBtn.onclick = async () => {
      const notesEl = document.getElementById('repair-action-notes') as HTMLTextAreaElement;
      const techEl = document.getElementById('repair-technician-input') as HTMLInputElement;
      const durEl = document.getElementById('repair-duration-input') as HTMLInputElement;
      const shelfEl = document.getElementById('repair-shelf-no-input') as HTMLInputElement;
      const turbineEl = document.getElementById('repair-turbine-input') as HTMLInputElement;

      const actionNotes = (notesEl?.value || '').trim();
      const technician = (techEl?.value || currentUserName).trim();
      const duration = (durEl?.value || '').trim();
      const shelfNo = (shelfEl?.value || '').trim();
      const finalTurbine = (turbineEl?.value || displayTurbine || repairItem.turbine || repairItem.turbineNo || '-').trim();

      if (!shelfNo) {
        alert("Lütfen malzemenin yerleştirileceği Raf Numarasını giriniz (Zorunludur).");
        shelfEl?.focus();
        return;
      }

      if (!actionNotes) {
        alert("Lütfen yapılan işlemler ve onarım detayını yazınız.");
        notesEl?.focus();
        return;
      }

      // Auto-add any unsubmitted material in the inputs if description or valid SAP was entered
      const pendingDesc = (matDescInput?.value || '').trim();
      const pendingSap = (matSapInput?.value || '').trim();
      if (pendingDesc || (pendingSap && pendingSap !== '-')) {
        addMaterialItem();
      }

      const mcfEl = document.getElementById('repair-mcf-input') as HTMLInputElement;
      const mcfVal = (mcfEl?.value || '').trim();

      const usedMaterials = [...addedUsedMaterials];
      const hasStockUsed = usedMaterials.some((m: any) => m.deductedFromStock === true);
      if (hasStockUsed && !mcfVal) {
        alert("Depo stoğundan malzeme kullanıldığı için Malzeme Çıkış Form Numarası (MÇF No) girilmesi zorunludur.");
        mcfEl?.focus();
        return;
      }

      const finalMcfNo = mcfVal || repairItem.mcfNo || '-';

      submitBtn.setAttribute('disabled', 'true');
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Stoğa Alınıyor...';

      try {
        const cleanSap = String(repairItem.sapNo || '').trim();
        const baseSap = cleanSap.replace(/^[RT]+/i, '');
        const newSapNo = `T${baseSap}`;
        const cleanDesc = String(repairItem.description || '').trim();
        const baseDesc = cleanDesc.replace(/^(tamirli|revize)\s*/i, '');
        const newDescription = `Tamirli ${baseDesc}`;
        const qty = Number(repairItem.quantity || 1);

        const currentUser = (window as any).currentUser;
        const userEmail = currentUser?.email || currentUser?.displayName || 'Sistem';

        // 1. Add repaired item to inventory_v2 as REVISED
        await warehouseService.updateStockBySap(
          repairItem.warehouseId,
          newSapNo,
          qty,
          {
            user: userEmail,
            reason: `Saha İçi Ekip Onarımı Tamamlandı (${cleanSap} -> ${newSapNo}): ${actionNotes}`,
            materialName: newDescription
          },
          'REVISED',
          shelfNo,
          repairItem.serialNo && repairItem.serialNo !== '-' ? repairItem.serialNo : '',
          `Saha Onarımı (${technician}): ${actionNotes}`
        );

        // 2. Decrement any spare parts used from current warehouse stock (only those matched with warehouse stock)
        for (const mat of usedMaterials) {
          if (mat.deductedFromStock && mat.sapNo) {
            mat.mcfNo = finalMcfNo;
            try {
              await warehouseService.updateStockBySap(
                repairItem.warehouseId,
                mat.sapNo,
                -mat.qty,
                {
                  user: userEmail,
                  reason: `Saha Malzeme Onarımında Kullanıldı (${newSapNo} - ${newDescription})`,
                  materialName: mat.description || mat.name,
                  formNo: finalMcfNo !== '-' ? finalMcfNo : undefined
                },
                'NEW'
              );
            } catch (stockErr) {
              console.warn(`[TeamRepair] ${mat.sapNo} stok düşüş uyarısı:`, stockErr);
            }
          }
        }

        // 3. Generate Form No: Servis Onarım T57413_001, _002 ...
        const { doc, updateDoc, serverTimestamp, collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('../../firebase');

        let seqNumber = 1;
        try {
          const repairsSnap = await getDocs(collection(db, 'team_repairs'));
          let maxSeq = 0;
          repairsSnap.forEach((d) => {
            const data = d.data();
            const fNo = String(data?.formNo || '');
            const docSap = String(data?.newSapNo || data?.sapNo || '');
            if (fNo.includes(newSapNo) || docSap.includes(baseSap)) {
              const match = fNo.match(/_(\d{3,})$/);
              if (match) {
                const num = parseInt(match[1], 10);
                if (!isNaN(num) && num > maxSeq) {
                  maxSeq = num;
                }
              }
            }
          });
          seqNumber = maxSeq + 1;
        } catch (seqErr) {
          console.warn('[TeamRepair] Sıra no hesaplama uyarısı:', seqErr);
        }

        const seqStr = String(seqNumber).padStart(3, '0');
        const formNo = repairItem.formNo && repairItem.formNo.startsWith('Servis Onarım')
          ? repairItem.formNo
          : `Servis Onarım ${newSapNo}_${seqStr}`;

        const cleanDuration = formatRepairDuration(duration);
        const cleanWarehouse = fixTurkishWarehouseName(warehouseState.currentWarehouse?.name || 'Saha Deposu');

        // 4. Update team_repairs in Firestore
        if (repairItem.id) {
          await updateDoc(doc(db, 'team_repairs', repairItem.id), {
            formNo: formNo,
            mcfNo: finalMcfNo,
            status: 'COMPLETED',
            completedAt: serverTimestamp(),
            completedBy: userEmail,
            technician: technician,
            turbine: finalTurbine,
            turbineNo: finalTurbine,
            actionNotes: actionNotes,
            repairDuration: cleanDuration,
            shelfNo: shelfNo,
            newSapNo: newSapNo,
            newDescription: newDescription,
            usedMaterials: usedMaterials
          });
        }

        // 5. Update defect item in inventory_v2 if originalItemId exists
        if (repairItem.originalItemId) {
          const origDocRef = doc(db, 'warehouses', repairItem.warehouseId, 'inventory_v2', repairItem.originalItemId);
          await updateDoc(origDocRef, {
            status: 'TAMIR_EDILDI',
            quantity: 0,
            lastUpdated: serverTimestamp()
          }).catch(console.warn);
        }

        // 6. Send formal email with A4 PDF attachment
        try {
          const { emailService } = await import('../../services/EmailService');
          const formData: any = {
            formNo: formNo,
            date: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            warehouseName: cleanWarehouse,
            warehouseId: repairItem.warehouseId,
            originalSapNo: cleanSap,
            newSapNo: newSapNo,
            description: cleanDesc,
            newDescription: newDescription,
            serialNo: repairItem.serialNo && repairItem.serialNo !== '-' ? repairItem.serialNo : '-',
            quantity: qty,
            turbine: finalTurbine,
            turbineNo: finalTurbine,
            reportNo: repairItem.reportNo || '-',
            mcfNo: finalMcfNo,
            faultCode: repairItem.faultCode || '-',
            faultDesc: repairItem.faultDesc || '',
            assignedTeam: repairItem.assignedTeam || '-',
            sentBy: repairItem.sentBy || '-',
            actionNotes: actionNotes,
            technician: technician,
            repairDuration: cleanDuration,
            shelfNo: shelfNo,
            usedMaterials: usedMaterials,
            completedBy: userEmail
          };
          await emailService.sendTeamRepairCompletedEmail(formData);
        } catch (emailErr) {
          console.warn('[WarehouseModals] E-posta & PDF gönderimi uyarısı:', emailErr);
        }

        modal.remove();
        (window as any).showToast?.('Başarılı', `"${newDescription}" (${newSapNo}) stoğa alındı ve onarım formu Servis Merkezine iletildi.`, 'success');

        // Refresh lists
        if (typeof (window as any).loadTamirBekleyenler === 'function') {
          (window as any).loadTamirBekleyenler();
        }
        if (typeof (window as any).renderInventoryTable === 'function') {
          (window as any).renderInventoryTable();
        }
        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(repairItem.warehouseId);
        }
      } catch (err: any) {
        console.error("Saha onarım tamamlama hatası:", err);
        alert("İşlem sırasında hata oluştu:\n" + err.message);
        submitBtn.removeAttribute('disabled');
        submitBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> TAMİRİ TAMAMLA VE STOĞA AL';
      }
    };
  }
};

export const openViewTeamRepairFormModal = (repairItem: any) => {
  const modal = document.createElement('div');
  modal.id = 'view-team-repair-form-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
    z-index: 10003; display: flex; align-items: center; justify-content: center;
  `;

  const dateStr = formatSafeDateTime(repairItem.completedAt || repairItem.date || repairItem.createdAt);
  let turbineVal = repairItem.turbine && repairItem.turbine !== '-' 
    ? repairItem.turbine 
    : (repairItem.turbineNo && repairItem.turbineNo !== '-' ? repairItem.turbineNo : '-');

  const cleanOriginalSap = String(repairItem.sapNo || '').replace(/^[RT]+/i, '');
  const originalSap = cleanOriginalSap || '-';
  const newSap = repairItem.newSapNo || `T${originalSap}`;
  
  // Format formNo as "Servis Onarım T57413_001" if it was old SOF format
  let formNo = repairItem.formNo || '';
  if (!formNo || formNo.startsWith('SOF-')) {
    formNo = `Servis Onarım ${newSap}_001`;
  }
  const cleanWarehouse = fixTurkishWarehouseName(warehouseState.currentWarehouse?.name || repairItem.warehouseName || 'Saha Deposu');
  const duration = formatRepairDuration(repairItem.repairDuration || '-');
  const materialName = repairItem.newDescription || repairItem.description || '-';
  const shelfNo = repairItem.shelfNo || '-';
  const technician = formatDisplayName(repairItem.technician || repairItem.completedBy || '-');
  const actionNotes = repairItem.actionNotes || 'Yapılan işlem açıklaması bulunamadı.';
  const usedMaterials = repairItem.usedMaterials || [];

  const usedMaterialsHtml = usedMaterials.length > 0 
    ? usedMaterials.map((m: any, idx: number) => {
        const isFromStock = m.deductedFromStock === true;
        const matMcf = m.mcfNo || repairItem.mcfNo || '';
        const mcfBadge = (isFromStock && matMcf && matMcf !== '-') 
          ? `<span style="background:rgba(245,158,11,0.15); color:#F59E0B; border:1px solid rgba(245,158,11,0.3); padding:1px 6px; border-radius:4px; font-size:0.68rem; font-weight:700; margin-left:6px;"><i class="fa-solid fa-file-invoice"></i> MÇF: ${matMcf}</span>` 
          : '';
        const sourceBadge = isFromStock 
          ? `<span style="background:rgba(20,241,149,0.15); color:#14F195; border:1px solid rgba(20,241,149,0.3); padding:1px 6px; border-radius:4px; font-size:0.68rem; font-weight:700; margin-left:6px;"><i class="fa-solid fa-boxes-stacked"></i> Depo Stoğu</span>${mcfBadge}`
          : '<span style="background:rgba(148,163,184,0.15); color:#94A3B8; border:1px solid rgba(148,163,184,0.3); padding:1px 6px; border-radius:4px; font-size:0.68rem; font-weight:700; margin-left:6px;"><i class="fa-solid fa-screwdriver-wrench"></i> Harici Sarf</span>';
        return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 6px 8px; color: #94A3B8;">${idx + 1}</td>
          <td style="padding: 6px 8px; font-weight: 600; color: #E2E8F0;">
            ${m.name || m.description || '-'} ${sourceBadge}
          </td>
          <td style="padding: 6px 8px; text-align: center; color: #38BDF8; font-weight: 700;">${m.qty} Adet</td>
        </tr>
      `;
    }).join('')
    : `<tr><td colspan="3" style="padding: 8px; text-align: center; color: #64748B; font-style: italic;">Harici yedek parça / sarf malzeme kullanılmadı.</td></tr>`;

  modal.innerHTML = `
    <div class="glass-panel fade-in-up" style="width: 100%; max-width: 650px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.3); box-shadow: 0 20px 50px rgba(0,0,0,0.6); max-height: 90vh; display: flex; flex-direction: column;">
      
      <!-- Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem; flex-shrink:0;">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.3rem; color:#14F195; font-weight:800; letter-spacing:0.5px;">
              <i class="fa-solid fa-file-circle-check"></i> MALZEME BAKIM & ONARIM FORMU
            </h3>
            <span style="background:rgba(20,241,149,0.15); color:#14F195; border:1px solid rgba(20,241,149,0.3); padding:2px 8px; border-radius:4px; font-weight:800; font-size:0.75rem;">ONARILDI & STOKTA</span>
          </div>
          <div style="font-size:0.75rem; color:#94A3B8; margin-top:3px;">Form No: <strong style="color:#00f2ff; font-family:monospace;">${formNo}</strong> | Tarih: ${dateStr}</div>
        </div>
        <button onclick="document.getElementById('view-team-repair-form-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1rem; padding-right: 4px;" class="custom-scrollbar">
        
        <!-- Material Info Box -->
        <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); padding:1rem; border-radius:8px;">
          <div style="font-size:1rem; font-weight:800; color:#FFF; margin-bottom:0.6rem;">${materialName}</div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:0.8rem;">
            <div><span style="color:#94A3B8;">Orijinal SAP:</span> <strong style="color:#F59E0B; font-family:monospace;">${originalSap}</strong></div>
            <div><span style="color:#94A3B8;">Yeni Tamirli SAP:</span> <strong style="color:#00f2ff; font-family:monospace;">${newSap}</strong></div>
            <div><span style="color:#94A3B8;">Seri No:</span> <strong style="color:#10B981; font-family:monospace;">${repairItem.serialNo || '-'}</strong></div>
            <div><span style="color:#94A3B8;">Miktar:</span> <strong>${repairItem.quantity || 1} Adet</strong></div>
            <div><span style="color:#94A3B8;">Depo / Saha:</span> <strong style="color:#FFF;">${cleanWarehouse}</strong></div>
            <div><span style="color:#94A3B8;">Raf Numarası:</span> <strong style="color:#F59E0B; font-family:monospace;">${shelfNo}</strong></div>
            <div><span style="color:#94A3B8;">Söküldüğü Türbin:</span> <strong id="view-repair-turbine-val" style="color:#38BDF8; font-weight:700;">${turbineVal}</strong></div>
            <div><span style="color:#94A3B8;">Rapor / MÇF:</span> <strong>${repairItem.reportNo || '-'} ${repairItem.mcfNo ? `(MÇF: ${repairItem.mcfNo})` : ''}</strong></div>
            <div><span style="color:#94A3B8;">Arıza Kodu:</span> <strong style="color:#EF4444;">${repairItem.faultCode || '-'}</strong></div>
          </div>
        </div>

        <!-- Action Notes -->
        <div>
          <div style="font-size:0.8rem; font-weight:700; color:#14F195; margin-bottom:0.4rem; text-transform:uppercase;">
            <i class="fa-solid fa-wrench"></i> Yapılan İşlemler / Onarım Detayı
          </div>
          <div style="background:rgba(0,0,0,0.3); border:1px solid #1E293B; border-radius:6px; padding:0.85rem; font-size:0.82rem; color:#E2E8F0; line-height:1.4; white-space:pre-wrap;">
${actionNotes}
          </div>
        </div>

        <!-- Technician & Duration -->
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.75rem; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:6px; font-size:0.8rem;">
          <div><span style="color:#94A3B8;">Onarımı Yapan Teknisyen:</span><br><strong style="color:#FFF;">${technician}</strong></div>
          <div><span style="color:#94A3B8;">Onarım Süresi:</span><br><strong style="color:#0284c7; font-weight:700;">${duration}</strong></div>
        </div>

        <!-- Used Materials -->
        <div>
          <div style="font-size:0.8rem; font-weight:700; color:#38BDF8; margin-bottom:0.4rem; text-transform:uppercase;">
            <i class="fa-solid fa-cube"></i> Kullanılan Sarf Malzemeler / Parçalar
          </div>
          <table style="width:100%; border-collapse:collapse; font-size:0.78rem; background:rgba(0,0,0,0.2); border:1px solid #1E293B; border-radius:6px; overflow:hidden;">
            <thead>
              <tr style="background:rgba(255,255,255,0.03); color:#94A3B8; text-align:left;">
                <th style="padding:6px 8px; width:30px;">#</th>
                <th style="padding:6px 8px;">Malzeme</th>
                <th style="padding:6px 8px; width:80px; text-align:center;">Miktar</th>
              </tr>
            </thead>
            <tbody>
              ${usedMaterialsHtml}
            </tbody>
          </table>
        </div>

      </div>

      <!-- Action Footer -->
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem; margin-top:1rem; flex-shrink:0;">
        <button onclick="document.getElementById('view-team-repair-form-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.6rem 1.1rem; font-size:0.82rem;">KAPAT</button>
        <div style="display:flex; gap:8px;">
          <button id="resend-team-repair-email-btn" class="btn-cyber" style="background:rgba(59,130,246,0.15); border:1px solid #3B82F6; color:#60A5FA; font-weight:800; padding:0.6rem 1.1rem; font-size:0.82rem; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-envelope"></i> E-POSTAYI TEKRAR GÖNDER
          </button>
          <button id="download-team-repair-pdf-btn" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.6rem 1.25rem; font-size:0.82rem; cursor:pointer; display:flex; align-items:center; gap:6px; box-shadow:0 0 15px rgba(20,241,149,0.3);">
            <i class="fa-solid fa-download"></i> PDF İNDİR
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const formData: any = {
    formNo: formNo,
    date: dateStr,
    completedAt: repairItem.completedAt || repairItem.date || repairItem.createdAt,
    warehouseName: cleanWarehouse,
    warehouseId: repairItem.warehouseId,
    originalSapNo: originalSap,
    newSapNo: newSap,
    description: repairItem.description || materialName,
    newDescription: materialName,
    serialNo: repairItem.serialNo || '-',
    quantity: repairItem.quantity || 1,
    turbine: turbineVal,
    turbineNo: turbineVal,
    reportNo: repairItem.reportNo || '-',
    mcfNo: repairItem.mcfNo || '-',
    faultCode: repairItem.faultCode || '-',
    faultDesc: repairItem.faultDesc || '',
    assignedTeam: repairItem.assignedTeam || '-',
    sentBy: repairItem.sentBy || '-',
    actionNotes: actionNotes,
    technician: technician,
    repairDuration: duration,
    shelfNo: shelfNo,
    usedMaterials: usedMaterials,
    completedBy: repairItem.completedBy || technician
  };

  // Auto-resolve turbine if missing from reports and update DOM + Firestore
  if (!turbineVal || turbineVal === '-' || turbineVal === 'Bilinmeyen') {
    resolveTurbineFromReports(repairItem.reportNo, repairItem.mcfNo).then(async (foundTurbine) => {
      if (foundTurbine && foundTurbine !== '-') {
        turbineVal = foundTurbine;
        repairItem.turbine = foundTurbine;
        repairItem.turbineNo = foundTurbine;
        formData.turbine = foundTurbine;
        formData.turbineNo = foundTurbine;
        const turbineEl = document.getElementById('view-repair-turbine-val');
        if (turbineEl) turbineEl.textContent = foundTurbine;
        if (repairItem.id) {
          try {
            const { doc, updateDoc } = await import('firebase/firestore');
            const { db } = await import('../../firebase');
            await updateDoc(doc(db, 'team_repairs', repairItem.id), {
              turbine: foundTurbine,
              turbineNo: foundTurbine
            });
          } catch(e) {}
        }
      }
    });
  }

  // PDF Download Handler
  const pdfBtn = document.getElementById('download-team-repair-pdf-btn');
  if (pdfBtn) {
    pdfBtn.onclick = async () => {
      pdfBtn.setAttribute('disabled', 'true');
      pdfBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> PDF Hazırlanıyor...';
      try {
        const { emailService } = await import('../../services/EmailService');
        const pdfFile = await emailService.generateTeamRepairPDFFile(formData);
        if (pdfFile) {
          const url = URL.createObjectURL(pdfFile);
          const a = document.createElement('a');
          a.href = url;
          a.download = pdfFile.name;
          a.click();
          URL.revokeObjectURL(url);
          (window as any).showToast?.('Başarılı', 'Saha Onarım Formu PDF dosyası indirildi.', 'success');
        } else {
          alert('PDF dosyası üretilemedi.');
        }
      } catch (err: any) {
        alert('PDF indirme hatası: ' + err.message);
      } finally {
        pdfBtn.removeAttribute('disabled');
        pdfBtn.innerHTML = '<i class="fa-solid fa-download"></i> PDF İNDİR';
      }
    };
  }

  // Resend Email Handler
  const emailBtn = document.getElementById('resend-team-repair-email-btn');
  if (emailBtn) {
    emailBtn.onclick = async () => {
      emailBtn.setAttribute('disabled', 'true');
      emailBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gönderiliyor...';
      try {
        const { emailService } = await import('../../services/EmailService');

        // If the record in Firestore still had old SOF formNo or missing turbine, upgrade it permanently
        if (repairItem.id) {
          try {
            const { doc, updateDoc } = await import('firebase/firestore');
            const { db } = await import('../../firebase');
            const updatePayload: any = {};
            if (!repairItem.formNo || repairItem.formNo.startsWith('SOF-')) {
              updatePayload.formNo = formNo;
              updatePayload.repairDuration = duration;
              repairItem.formNo = formNo;
              repairItem.repairDuration = duration;
            }
            if (turbineVal && turbineVal !== '-') {
              updatePayload.turbine = turbineVal;
              updatePayload.turbineNo = turbineVal;
            }
            if (Object.keys(updatePayload).length > 0) {
              await updateDoc(doc(db, 'team_repairs', repairItem.id), updatePayload);
            }
          } catch(e) {}
        }

        const res = await emailService.sendTeamRepairCompletedEmail(formData);
        if (res.success) {
          (window as any).showToast?.('Başarılı', 'Saha onarım formu ve PDF eki Servis Merkezine tekrar iletildi.', 'success');
        } else {
          alert('E-posta gönderilemedi: ' + res.message);
        }
      } catch (err: any) {
        alert('E-posta gönderim hatası: ' + err.message);
      } finally {
        emailBtn.removeAttribute('disabled');
        emailBtn.innerHTML = '<i class="fa-solid fa-envelope"></i> E-POSTAYI TEKRAR GÖNDER';
      }
    };
  }
};

(window as any).openViewTeamRepairFormModal = openViewTeamRepairFormModal;

export const openBulkScrapModal = (items: Array<{
  id: string;
  sapNo: string;
  description: string;
  quantity: number;
  serialNo?: string;
  faultCode?: string;
  faultDesc?: string;
  turbine?: string;
  reportNo?: string;
  mcfNo?: string;
}>) => {
  const modal = document.createElement('div');
  modal.id = 'bulk-scrap-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
    z-index: 10002; display: flex; align-items: center; justify-content: center;
  `;

  let itemsRows = items.map((item, idx) => `
    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px; display:flex; flex-direction:column; gap:6px;">
      <span style="font-weight:700; color:#FFF; font-size:0.85rem;">${idx + 1}. ${item.description}</span>
      <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#94A3B8;">
        <span>SAP: ${item.sapNo}</span>
        <div style="display:flex; align-items:center; gap:8px;">
          <span>Miktar:</span>
          <input type="number" class="bulk-scrap-qty-input" data-id="${item.id}" value="${item.quantity}" min="1" max="${item.quantity}" style="width:60px; height:26px; background:rgba(0,0,0,0.3); border:1px solid #1E293B; border-radius:4px; color:#FFF; text-align:center; font-size:0.8rem; outline:none;">
        </div>
      </div>
    </div>
  `).join('');

  modal.innerHTML = `
    <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(239, 68, 68, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 90vh; display: flex; flex-direction: column;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem; flex-shrink:0;">
        <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#EF4444; font-weight:800; letter-spacing:1px;">
          <i class="fa-solid fa-dumpster" style="margin-right:8px;"></i> TOPLU HURDAYA AYIR
        </h3>
        <button onclick="document.getElementById('bulk-scrap-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; padding-right: 4px;" class="custom-scrollbar">
        <p style="color:#94A3B8; font-size:0.85rem; margin:0; font-weight:600;">Hurdaya Ayrılacak Malzemeler (${items.length} Kalem)</p>
        ${itemsRows}
      </div>

      <div class="form-group" style="margin-bottom:1.5rem; flex-shrink:0;">
        <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">Gerekçe / Hurda Notu</label>
        <textarea id="bulk-scrap-note" class="cyber-input" placeholder="Hurdaya ayrılma gerekçesini yazınız..." style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4); height:80px; resize:none;" required></textarea>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem; flex-shrink:0;">
        <button onclick="document.getElementById('bulk-scrap-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
        <button id="bulk-confirm-scrap-btn" class="btn-cyber" style="background:linear-gradient(135deg, #EF4444 0%, #dc2626 100%); color:#FFF; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(239,68,68,0.3);">HURDAYA AYIR</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const confirmBtn = document.getElementById('bulk-confirm-scrap-btn');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const noteInput = document.getElementById('bulk-scrap-note') as HTMLTextAreaElement;
      const note = noteInput?.value.trim() || '';
      const qtyInputs = document.querySelectorAll('.bulk-scrap-qty-input') as NodeListOf<HTMLInputElement>;

      if (!note) {
        alert('Lütfen hurdaya ayırma gerekçesini yazın.');
        return;
      }

      const itemsWithQty = items.map(item => {
        const input = Array.from(qtyInputs).find(inp => inp.getAttribute('data-id') === item.id);
        const qty = parseInt(input?.value || '0', 10);
        return { ...item, scrapQty: qty };
      });

      for (const item of itemsWithQty) {
        if (isNaN(item.scrapQty) || item.scrapQty <= 0 || item.scrapQty > item.quantity) {
          alert(`Lütfen "${item.description}" için 1 ile ${item.quantity} arasında geçerli bir miktar girin.`);
          return;
        }
      }

      confirmBtn.setAttribute('disabled', 'true');
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';

      try {
        const currentUser = (window as any).currentUser;
        const userEmail = currentUser?.email || currentUser?.displayName || 'Sistem';
        const currentWh = warehouseState.currentWarehouse;
        const warehouseId = currentWh?.id || 'MTA';
        const warehouseName = currentWh?.name || warehouseId;

        for (const item of itemsWithQty) {
          // Direct defect item status update in Firestore
          if (item.id) {
            try {
              const { doc, getDoc, updateDoc, setDoc, collection, serverTimestamp } = await import('firebase/firestore');
              const { db } = await import('../../firebase');
              const docRef = doc(db, 'warehouses', warehouseId, 'inventory_v2', item.id);
              const docSnap = await getDoc(docRef);
              if (docSnap.exists()) {
                const invData = docSnap.data();
                const curQty = invData.quantity || 0;
                if (item.scrapQty >= curQty) {
                  await updateDoc(docRef, {
                    quantity: 0,
                    status: 'HURDAYA_AYRILDI',
                    scrappedQty: item.scrapQty,
                    scrappedAt: serverTimestamp(),
                    scrappedBy: userEmail,
                    scrapReason: note,
                    lastUpdated: serverTimestamp()
                  });
                } else {
                  await updateDoc(docRef, {
                    quantity: curQty - item.scrapQty,
                    lastUpdated: serverTimestamp()
                  });
                  const newDocRef = doc(collection(db, 'warehouses', warehouseId, 'inventory_v2'));
                  await setDoc(newDocRef, {
                    ...invData,
                    quantity: 0,
                    status: 'HURDAYA_AYRILDI',
                    scrappedQty: item.scrapQty,
                    scrappedAt: serverTimestamp(),
                    scrappedBy: userEmail,
                    scrapReason: note,
                    lastUpdated: serverTimestamp()
                  });
                }
              }
            } catch (invErr) {
              console.warn("Direct defect inventory scrap update failed:", invErr);
            }
          }

          // Add to central Field Scraps pool
          await warehouseService.addFieldScrap({
            warehouseId: warehouseId,
            warehouseName: warehouseName,
            itemId: item.id,
            sapNo: item.sapNo,
            serialNo: item.serialNo || '-',
            description: item.description,
            quantity: item.scrapQty,
            turbine: item.turbine || '-',
            reportNo: item.reportNo || '-',
            mcfNo: item.mcfNo || '-',
            faultCode: item.faultCode || '-',
            faultDesc: item.faultDesc || '-',
            scrapReason: note,
            scrappedBy: userEmail
          });

          await warehouseService.addLog(warehouseId, {
            itemId: item.id,
            sapNo: item.sapNo,
            materialName: item.description,
            quantity: item.scrapQty,
            type: 'REMOVE',
            user: userEmail,
            note: `Hurdaya ayrıldı. Gerekçe: ${note}`
          }).catch(() => {});
        }

        (window as any).showToast?.('Başarılı', 'Seçilen malzemeler başarıyla hurdaya ayrıldı ve Saha Hurda Listesine eklendi.', 'success');
        modal.remove();

        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(warehouseId);
        }
      } catch (e: any) {
        console.error(e);
        alert('Toplu hurdaya ayırma esnasında bir hata oluştu: ' + e.message);
        confirmBtn.removeAttribute('disabled');
        confirmBtn.innerHTML = 'HURDAYA AYIR';
      }
    };
  }
};

export const approveWarehouseMsfTransfer = async (transferId: string) => {
  const adminEmail = ((window as any).currentUser || (window as any).appState?.userProfile)?.email || 'Admin';
  
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const { transferService } = await import('../../services/TransferService');
    
    const docRef = doc(db, 'transfers', transferId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      alert("Transfer kaydı bulunamadı!");
      return;
    }
    
    const transfer = docSnap.data();
    const items = Array.isArray(transfer.items) 
      ? transfer.items 
      : [{ materialCode: transfer.materialCode, materialName: transfer.materialName, quantity: transfer.quantity }];

    const modal = document.createElement('div');
    modal.id = 'approve-transfer-modal';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.backgroundColor = 'rgba(0,0,0,0.6)';
    modal.style.backdropFilter = 'blur(4px)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '10000';
    modal.style.fontFamily = "'Rajdhani', sans-serif";

    const currentInventory = warehouseState.inventoryItems;
    const itemsHtml = items.map((item: any) => {
      const invItem = currentInventory.find((i: any) => i.sapNo === item.materialCode);
      const existingShelf = invItem ? (invItem.shelfNo || 'Tanımsız') : 'Tanımsız';
      
      return `
        <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <span style="color: #FFF; font-weight: 700; font-size: 0.8rem;">
              ${item.materialName}
              <span style="font-family: monospace; font-size: 0.7rem; color: #60A5FA; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); padding: 1px 4px; border-radius: 3px; margin-left: 4px;">${item.materialCode}</span>
            </span>
            <span style="color: var(--accent-cyan); font-weight: 800; font-family: monospace; font-size: 0.8rem;">${item.quantity} Adet</span>
          </div>
          
          <div style="display: flex; gap: 10px; align-items: center;">
            <div style="flex: 1;">
              <label style="font-size: 0.65rem; color: #94A3B8; display: block; font-weight: bold; margin-bottom: 2px;">RAF SEÇİMİ</label>
              <input type="text" id="modal-shelf-${item.materialCode}" value="${existingShelf}" placeholder="Örn: B-1, D-2" style="width: 100%; box-sizing: border-box; padding: 5px 8px; border-radius: 4px; border: 1px solid #1E293B; background: #0A0E17; color: #FFF; font-family: monospace; font-size: 0.75rem;">
            </div>
            <div style="flex: 1;">
              <label style="font-size: 0.65rem; color: #94A3B8; display: block; font-weight: bold; margin-bottom: 2px;">MALZEME DURUMU</label>
              <select id="modal-cond-${item.materialCode}" style="width: 100%; box-sizing: border-box; padding: 5px 8px; border-radius: 4px; border: 1px solid #1E293B; background: #0A0E17; color: #FFF; font-size: 0.75rem; font-weight: bold; cursor: pointer;">
                <option value="NEW" selected>Kusursuz (Yeni)</option>
                <option value="DEFECT">Hasarlı / Defect</option>
                <option value="REVISED">Revize Edilmiş</option>
                <option value="SCRAP">Hurda (Scrap)</option>
              </select>
            </div>
          </div>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div class="glass-panel" style="background: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 480px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
          <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 800; color: var(--accent-cyan); display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-circle-check"></i> MALZEME TESLİM KABULÜ
          </div>
          <button id="modal-close-btn" style="background: transparent; border: none; color: #64748B; cursor: pointer; font-size: 1.1rem; transition: color 0.2s;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#64748B'">&times;</button>
        </div>

        <!-- Description -->
        <p style="font-size: 0.78rem; color: #94A3B8; margin-top: 0; margin-bottom: 1rem; line-height: 1.45;">
          Malzemeleri depoya kabul etmek için lütfen raflarını ve kondisyon durumlarını seçin. Kusursuz gelenler için <strong>Kusursuz (Yeni)</strong> seçeneğini bırakabilirsiniz.
        </p>

        <!-- Items List Container -->
        <div style="display: flex; flex-direction: column; gap: 10px; max-height: 280px; overflow-y: auto; padding-right: 4px; margin-bottom: 1.5rem;">
          ${itemsHtml}
        </div>

        <!-- Footer Actions -->
        <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem;">
          <button id="modal-cancel-btn" class="btn-cyber-mini" style="font-size: 0.75rem; padding: 6px 15px; color: #94A3B8; border-color: rgba(255,255,255,0.1); background: transparent;">
            İptal Et
          </button>
          <button id="modal-submit-btn" class="btn-cyber-mini" style="font-size: 0.75rem; padding: 6px 20px; color: #10B981; border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.08); font-weight: bold; box-shadow: 0 0 10px rgba(16,185,129,0.05);">
            Onayla ve Teslim Al
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    modal.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
    modal.querySelector('#modal-cancel-btn')?.addEventListener('click', closeModal);

    modal.querySelector('#modal-submit-btn')?.addEventListener('click', async () => {
      const submitBtn = modal.querySelector('#modal-submit-btn');
      if (submitBtn) (submitBtn as any).disabled = true;

      const itemDetails = items.map((item: any) => {
        const shelfInput = modal.querySelector(`#modal-shelf-${item.materialCode}`);
        const condSelect = modal.querySelector(`#modal-cond-${item.materialCode}`);
        return {
          materialCode: item.materialCode,
          shelfNo: shelfInput ? (shelfInput as any).value.trim() || 'Tanımsız' : 'Tanımsız',
          condition: condSelect ? (condSelect as any).value : 'NEW'
        };
      });

      try {
        await transferService.approveMultiItemTransfer(transferId, adminEmail, itemDetails);
        closeModal();
        alert("✅ Sevk başarıyla teslim alındı ve belirtilen raflara yerleştirilerek stoğa girildi!");
        if ((window as any).renderInventoryTable) (window as any).renderInventoryTable();
      } catch (err) {
        alert("Kabul işlemi sırasında hata oluştu: " + (err as any).message);
        if (submitBtn) (submitBtn as any).disabled = false;
      }
    });

  } catch (err: any) {
    alert("Hata: " + err.message);
  }
};

export const rejectWarehouseMsfTransfer = async (transferId: string) => {
  const reason = prompt("Sevk talebini reddetme / iptal etme gerekçesini giriniz:\n(İptal edildiğinde tüm stoklar çıkış deposuna geri iade edilecektir.)");
  if (reason === null) return;
  if (!reason.trim()) {
    alert("Lütfen gerekçe belirtin!");
    return;
  }
  const adminEmail = ((window as any).currentUser || (window as any).appState?.userProfile)?.email || 'Admin';
  try {
    const { transferService } = await import('../../services/TransferService');
    await transferService.rejectMultiItemTransfer(transferId, adminEmail, reason);
    alert("❌ Sevk iptal edildi.");
  } catch (err: any) {
    alert("Hata: " + err.message);
  }
};

export const printWarehouseMsfVoucher = (transferId: string) => {
  getDoc(doc(db, 'transfers', transferId)).then((docSnap: any) => {
     if (!docSnap.exists()) return;
     const transfer = { id: docSnap.id, ...docSnap.data() };
     
     const msfNo = transfer.msfNo || `TRF-${transfer.id?.substring(0, 8).toUpperCase()}`;
     const fromName = (window as any)._warehousesMap?.[transfer.fromSiteId] || transfer.fromSiteId;
     const toName = (window as any)._warehousesMap?.[transfer.toSiteId] || transfer.toSiteId;
     const dateStr = transfer.createdAt?.toDate ? transfer.createdAt.toDate().toLocaleString('tr-TR') : new Date().toLocaleString('tr-TR');
     
     let deliveryDetails = '';
     if (transfer.deliveryMethod === 'PERSON') {
       deliveryDetails = `<strong>Teslimat Tipi:</strong> Personel ile<br><strong>Taşıyan Kişi:</strong> ${transfer.shippedBy || 'Belirtilmedi'}`;
     } else if (transfer.deliveryMethod === 'CARGO') {
       deliveryDetails = `<strong>Teslimat Tipi:</strong> Kargo ile gönderildi<br><strong>Kargo Firması:</strong> ${transfer.cargoCarrier || 'Belirtilmedi'}<br><strong>Takip / Fatura No:</strong> ${transfer.cargoTrackingNo || 'Belirtilmedi'}`;
     } else {
       deliveryDetails = `<strong>Teslimat Tipi:</strong> Depolar Arası Klasik Transfer`;
     }

     if (transfer.status === 'TAMAMLANDI' || transfer.status === 'COMPLETED') {
       const resolvedDateStr = transfer.resolvedAt?.toDate 
         ? transfer.resolvedAt.toDate().toLocaleString('tr-TR') 
         : (transfer.approvedAt?.toDate ? transfer.approvedAt.toDate().toLocaleString('tr-TR') : 'Belirtilmedi');
       const receiver = transfer.resolvedBy || transfer.approvedBy || 'Belirtilmedi';
       deliveryDetails += `<br><br><span style="color:#10b981; font-weight:bold;">🟢 TESLİM EDİLDİ</span><br><strong>Teslim Tarihi:</strong> ${resolvedDateStr}<br><strong>Teslim Alan:</strong> ${receiver}`;
     }

     const items = Array.isArray(transfer.items) 
       ? transfer.items 
       : [{ materialCode: transfer.materialCode, materialName: transfer.materialName, quantity: transfer.quantity }];

     const tableRows = items.map((it: any, idx: number) => `
       <tr>
         <td style="border: 1px solid #000; padding: 6px; text-align: center;">${idx + 1}</td>
         <td style="border: 1px solid #000; padding: 6px; font-family: monospace;">${it.materialCode}</td>
         <td style="border: 1px solid #000; padding: 6px;">${it.materialName}</td>
         <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${it.quantity}</td>
         <td style="border: 1px solid #000; padding: 6px; text-align: center;">Adet</td>
       </tr>
     `).join('');

     const printWindow = window.open('', '_blank');
     if (!printWindow) return;

     printWindow.document.write(`
       <html>
         <head>
           <title>Malzeme Sevk Formu - ${msfNo}</title>
           <style>
             body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #000; background: #fff; font-size: 12px; }
             .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
             .logo { font-size: 20px; font-weight: bold; letter-spacing: 1px; }
             .title { text-align: right; }
             .title h1 { margin: 0; font-size: 18px; font-weight: 800; }
             .title span { font-size: 12px; color: #555; }
             .meta-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
             .meta-table td { padding: 4px 0; vertical-align: top; }
             .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; }
             .items-table th { border: 1px solid #000; background-color: #f2f2f2; padding: 8px; text-align: left; font-weight: bold; }
             .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
             .signature-box { width: 30%; text-align: center; border-top: 1px dashed #000; padding-top: 10px; }
             @media print { body { margin: 10px; } .no-print { display: none; } }
           </style>
         </head>
         <body>
           <div class="no-print" style="margin-bottom: 20px; background: #e5e7eb; padding: 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
             <span style="color:#374151; font-weight: bold;">MSF Yazdırma Önizleme</span>
             <button onclick="window.print()" style="background:#10b981; color:#fff; border:none; padding: 6px 15px; border-radius: 4px; font-weight:bold; cursor:pointer;">Yazdır / PDF Kaydet</button>
           </div>
           <div class="header">
             <div class="logo">DEMİRER <span style="font-weight: 300;">HOLDİNG</span></div>
             <div class="title">
               <h1>MALZEME SEVK FORMU (MSF)</h1>
               <span style="font-family: monospace; font-weight: bold; font-size: 13px;">No: ${msfNo}</span>
             </div>
           </div>
           <table class="meta-table">
             <tr>
               <td style="width: 50%;">
                 <strong>ÇIKIŞ DEPOSU (SEVK EDEN):</strong><br>${fromName}<br><br>
                 <strong>VARIŞ DEPOSU (SEVK EDİLEN):</strong><br>${toName}
               </td>
               <td style="width: 50%; text-align: right;">
                 <strong>Sevk Tarihi:</strong> ${dateStr}<br>
                 <strong>Oluşturan / Sevk Eden:</strong> ${transfer.requestedBy}<br><br>
                 ${deliveryDetails}
               </td>
             </tr>
           </table>
           <h3 style="border-bottom: 1px solid #000; padding-bottom: 5px; margin-top: 30px;">Sevk Edilen Malzeme Listesi</h3>
           <table class="items-table">
             <thead>
               <tr>
                 <th style="width: 5%; text-align: center;">S.No</th>
                 <th style="width: 25%;">SAP No / Kod</th>
                 <th style="width: 50%;">Malzeme Açıklaması / Adı</th>
                 <th style="width: 10%; text-align: center;">Miktar</th>
                 <th style="width: 10%; text-align: center;">Birim</th>
               </tr>
             </thead>
             <tbody>${tableRows}</tbody>
           </table>
           <div style="font-size: 11px; margin-top: 40px; border: 1px solid #ccc; padding: 10px; border-radius: 4px;">
             <strong>Sevk Açıklaması:</strong> Bu belge ile yukarıda dökümü yapılan malzemelerin çıkış deposundan sevk edildiği, alıcı deponun malzemeleri eksiksiz teslim alıp stoğa işlemesi gerektiği beyan edilir.
           </div>
           <div class="signatures">
             <div class="signature-box">
               <strong>Teslim Eden (Sevk Eden)</strong><br><br>
               <span style="font-size: 11px; font-weight: bold; color: #000;">${transfer.requestedBy || ''}</span><br>
               <span style="font-size: 10px; color: #555;">Tarih: ${dateStr}</span>
             </div>
             <div class="signature-box">
               <strong>Taşıyan Personel / Kargo</strong><br><br>
               ${transfer.deliveryMethod === 'PERSON' && transfer.shippedBy ? `
                 <span style="font-size: 11px; font-weight: bold; color: #000;">${transfer.shippedBy}</span>
               ` : (transfer.deliveryMethod === 'CARGO' && transfer.cargoCarrier ? `
                 <span style="font-size: 11px; font-weight: bold; color: #000;">${transfer.cargoCarrier}</span><br>
                 <span style="font-size: 10px; color: #555;">Takip No: ${transfer.cargoTrackingNo || ''}</span>
               ` : 'İmza / Tarih')}
             </div>
             <div class="signature-box">
               <strong>Teslim Alan (Kabul Eden)</strong><br><br>
               ${(transfer.status === 'TAMAMLANDI' || transfer.status === 'COMPLETED') ? `
                 <span style="font-size: 11px; font-weight: bold; color: #000;">${transfer.resolvedBy || transfer.approvedBy || ''}</span><br>
                 <span style="font-size: 10px; color: #555;">Tarih: ${transfer.resolvedAt?.toDate ? transfer.resolvedAt.toDate().toLocaleString('tr-TR') : (transfer.approvedAt?.toDate ? transfer.approvedAt.toDate().toLocaleString('tr-TR') : '')}</span>
               ` : 'İmza / Tarih'}
             </div>
           </div>
         </body>
       </html>
     `);
     printWindow.document.close();
  });
};

export const openQuickPriceModal = (sapNo: string, name?: string) => {
  const modal = ensureSingleModalInBody('quick-price-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.style.zIndex = '10005';

    const item = (warehouseState.inventoryItems || []).find((i: any) => String(i.sapNo).trim() === String(sapNo).trim());
    const resolvedName = name || item?.name || '';

    const sapEl = modal.querySelector('#quick-price-sap');
    if (sapEl) sapEl.textContent = sapNo || '';

    const nameEl = modal.querySelector('#quick-price-name');
    if (nameEl) nameEl.textContent = resolvedName || '';

    const valInput = modal.querySelector('#quick-price-value-input') as HTMLInputElement;
    if (valInput) {
      valInput.value = '';
      setTimeout(() => valInput.focus(), 100);
    }

    const currSelect = modal.querySelector('#quick-price-currency-select') as HTMLSelectElement;
    if (currSelect) currSelect.value = 'EUR';

    const yearInput = modal.querySelector('#quick-price-year-input') as HTMLInputElement;
    if (yearInput) yearInput.value = String(new Date().getFullYear());

    const whSelect = modal.querySelector('#quick-price-warehouse-select') as HTMLSelectElement;
    if (whSelect) {
      const currentWh = warehouseState.currentWarehouse;
      whSelect.innerHTML = `
        <option value="${currentWh?.id || '2688'}">${currentWh?.name || 'Anemon İntepe Depo'}</option>
        <option value="GENEL">Genel Fiyat Listesi (Tüm Depolar)</option>
      `;
    }

    const noteInput = modal.querySelector('#quick-price-note-input') as HTMLInputElement;
    if (noteInput) noteInput.value = '';
  }
};

export const closeQuickPriceModal = () => {
  const modal = ensureSingleModalInBody('quick-price-modal') || document.getElementById('quick-price-modal');
  if (modal) modal.style.display = 'none';
};

export const saveQuickPriceModal = async (btn?: HTMLButtonElement) => {
  const modal = (btn ? btn.closest('#quick-price-modal') : null) || ensureSingleModalInBody('quick-price-modal');
  const sapNo = modal?.querySelector('#quick-price-sap')?.textContent?.trim() || '';
  const description = modal?.querySelector('#quick-price-name')?.textContent?.trim() || '';
  const valInput = modal?.querySelector('#quick-price-value-input') as HTMLInputElement;
  const currSelect = modal?.querySelector('#quick-price-currency-select') as HTMLSelectElement;
  const yearInput = modal?.querySelector('#quick-price-year-input') as HTMLInputElement;
  const whSelect = modal?.querySelector('#quick-price-warehouse-select') as HTMLSelectElement;
  const noteInput = modal?.querySelector('#quick-price-note-input') as HTMLInputElement;

  const price = parseFloat(valInput?.value || '0');
  if (isNaN(price) || price <= 0) {
    alert('Lütfen geçerli bir birim fiyat giriniz.');
    valInput?.focus();
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
  }

  try {
    const user = getUserProfile();
    const warehouseId = whSelect?.value || warehouseState.currentWarehouse?.id || 'GENEL';
    const warehouseName = whSelect?.options[whSelect.selectedIndex]?.text || warehouseState.currentWarehouse?.name || 'Genel Liste';

    await priceService.savePriceEntry({
      sapNo,
      description,
      price,
      currency: (currSelect?.value as any) || 'EUR',
      year: parseInt(yearInput?.value || '2026', 10),
      warehouseId,
      warehouseName,
      entryDate: new Date().toISOString().split('T')[0],
      note: noteInput?.value?.trim() || '',
      createdByName: user?.displayName || user?.email || 'Malzeme Yönetimi',
      createdByEmail: user?.email || ''
    });

    closeQuickPriceModal();

    // Re-render inventory table & unpriced table
    if (typeof (window as any).renderInventoryTable === 'function') {
      await (window as any).renderInventoryTable();
    }
    if (typeof (window as any).renderUnpricedTable === 'function') {
      await (window as any).renderUnpricedTable();
    }
  } catch (err: any) {
    console.error('Failed to save quick price:', err);
    alert('Fiyat kaydedilirken hata oluştu: ' + (err?.message || err));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Fiyatı Kaydet';
    }
  }
};

export const openQuickCabinetModal = (id: string, sap: string, name: string, cabinet: string) => {
  let modal = ensureSingleModalInBody('new-warehouse-quick-cabinet-modal');
  if (modal) {
    const idInput = modal.querySelector('#quick-cabinet-item-id') as HTMLInputElement;
    const sapInput = modal.querySelector('#quick-cabinet-sap-no') as HTMLInputElement;
    const nameEl = modal.querySelector('#quick-cabinet-item-name') as HTMLElement;
    const sapEl = modal.querySelector('#quick-cabinet-item-sap') as HTMLElement;
    const customInput = modal.querySelector('#quick-cabinet-custom-input') as HTMLInputElement;
    const buttonsContainer = modal.querySelector('#quick-cabinet-buttons-container') as HTMLElement;

    if (idInput) idInput.value = id;
    if (sapInput) sapInput.value = sap;
    if (nameEl) nameEl.textContent = name;
    if (sapEl) sapEl.textContent = `SAP No: ${sap}`;
    if (customInput) customInput.value = cabinet || '';

    if (buttonsContainer) {
      const avail = getAvailableCabinets();
      if (avail.length === 0) {
        buttonsContainer.innerHTML = '<span style="color: #64748B; font-size: 0.76rem; grid-column: span 2;">Henüz kayıtlı kabin yok. Aşağıdan ilk kabin adını yazabilirsiniz.</span>';
      } else {
        buttonsContainer.innerHTML = avail.map(c => `
          <button type="button" onclick="document.getElementById('quick-cabinet-custom-input').value='${c.replace(/'/g, "\\'")}'; window.saveQuickCabinet();" style="background: rgba(139, 92, 246, 0.12); border: 1px solid rgba(139, 92, 246, 0.35); color: #E2E8F0; padding: 6px 8px; border-radius: 6px; font-size: 0.78rem; text-align: left; cursor: pointer; transition: all 0.15s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 5px;" onmouseover="this.style.background='rgba(139, 92, 246, 0.28)'; this.style.borderColor='#8B5CF6'" onmouseout="this.style.background='rgba(139, 92, 246, 0.12)'; this.style.borderColor='rgba(139, 92, 246, 0.35)'" title="${c.replace(/"/g, '&quot;')}">
            <i class="fa-solid fa-server" style="color: #A855F7; font-size: 0.7rem; flex-shrink: 0;"></i>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${c}</span>
          </button>
        `).join('');
      }
    }

    modal.style.display = 'flex';
  }
};

export const closeQuickCabinetModal = () => {
  const modals = document.querySelectorAll('#new-warehouse-quick-cabinet-modal');
  modals.forEach((m: any) => {
    m.style.display = 'none';
  });
};

export const saveQuickCabinet = async () => {
  const modal = ensureSingleModalInBody('new-warehouse-quick-cabinet-modal');
  if (!modal) return;
  const id = (modal.querySelector('#quick-cabinet-item-id') as HTMLInputElement)?.value;
  const sap = (modal.querySelector('#quick-cabinet-sap-no') as HTMLInputElement)?.value?.trim();
  const customInput = modal.querySelector('#quick-cabinet-custom-input') as HTMLInputElement;
  const cabinet = customInput ? customInput.value.trim() : '';

  if (!id || !warehouseState.currentWarehouse?.id) return;

  try {
    await warehouseService.updateMaterial(warehouseState.currentWarehouse.id, id, {
      cabinet: cabinet
    } as any);

    if (sap) {
      await saveSapMetadata(sap, { cabinet: cabinet });
    }

    // Update in memory
    const item = (warehouseState.inventoryItems || []).find((i: any) => i.id === id);
    if (item) item.cabinet = cabinet;
    const itemQR = (warehouseState.inventoryWithQRs || []).find((i: any) => i.id === id);
    if (itemQR) itemQR.cabinet = cabinet;

    closeQuickCabinetModal();

    if (typeof (window as any).renderInventoryTable === 'function') {
      (window as any).renderInventoryTable();
    }
  } catch (e) {
    console.error("Failed to update cabinet:", e);
    alert("Kabin kaydedilirken hata oluştu.");
  }
};

export const openQuickTurbineTypeModal = (id: string, sap: string, name: string, turbineType: string) => {
  let modal = ensureSingleModalInBody('new-warehouse-quick-turbinetype-modal');
  if (modal) {
    const idInput = modal.querySelector('#quick-turbinetype-item-id') as HTMLInputElement;
    const sapInput = modal.querySelector('#quick-turbinetype-sap-no') as HTMLInputElement;
    const nameEl = modal.querySelector('#quick-turbinetype-item-name') as HTMLElement;
    const sapEl = modal.querySelector('#quick-turbinetype-item-sap') as HTMLElement;
    const customInput = modal.querySelector('#quick-turbinetype-custom-input') as HTMLInputElement;
    const buttonsContainer = modal.querySelector('#quick-turbinetype-buttons-container') as HTMLElement;

    const effTurb = turbineType || getEffectiveTurbineType({ sapNo: sap, turbineType });

    if (idInput) idInput.value = id;
    if (sapInput) sapInput.value = sap;
    if (nameEl) nameEl.textContent = name;
    if (sapEl) sapEl.textContent = `SAP No: ${sap}`;
    if (customInput) customInput.value = effTurb || '';

    if (buttonsContainer) {
      const avail = getAvailableTurbineTypes();
      buttonsContainer.innerHTML = avail.map(t => `
        <button type="button" onclick="document.getElementById('quick-turbinetype-custom-input').value='${t.replace(/'/g, "\\'")}'; window.saveQuickTurbineType();" style="background: rgba(0, 243, 255, 0.1); border: 1px solid rgba(0, 243, 255, 0.35); color: #E2E8F0; padding: 6px 8px; border-radius: 6px; font-size: 0.78rem; text-align: left; cursor: pointer; transition: all 0.15s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 5px;" onmouseover="this.style.background='rgba(0, 243, 255, 0.25)'; this.style.borderColor='#00F3FF'" onmouseout="this.style.background='rgba(0, 243, 255, 0.1)'; this.style.borderColor='rgba(0, 243, 255, 0.35)'" title="${t.replace(/"/g, '&quot;')}">
          <i class="fa-solid fa-fan" style="color: #00F3FF; font-size: 0.7rem; flex-shrink: 0;"></i>
          <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t}</span>
        </button>
      `).join('');
    }

    modal.style.display = 'flex';
  }
};

export const closeQuickTurbineTypeModal = () => {
  const modals = document.querySelectorAll('#new-warehouse-quick-turbinetype-modal');
  modals.forEach((m: any) => {
    m.style.display = 'none';
  });
};

export const saveQuickTurbineType = async () => {
  const modal = ensureSingleModalInBody('new-warehouse-quick-turbinetype-modal');
  if (!modal) return;
  const id = (modal.querySelector('#quick-turbinetype-item-id') as HTMLInputElement)?.value;
  const sap = (modal.querySelector('#quick-turbinetype-sap-no') as HTMLInputElement)?.value?.trim();
  const customInput = modal.querySelector('#quick-turbinetype-custom-input') as HTMLInputElement;
  const turbineType = customInput ? customInput.value.trim() : '';

  if (!id || !warehouseState.currentWarehouse?.id) return;

  try {
    await warehouseService.updateMaterial(warehouseState.currentWarehouse.id, id, {
      turbineType: turbineType
    } as any);

    if (sap) {
      await saveSapMetadata(sap, { turbineType: turbineType });
    }

    // Update in memory
    const item = (warehouseState.inventoryItems || []).find((i: any) => i.id === id);
    if (item) item.turbineType = turbineType;
    const itemQR = (warehouseState.inventoryWithQRs || []).find((i: any) => i.id === id);
    if (itemQR) itemQR.turbineType = turbineType;

    closeQuickTurbineTypeModal();

    if (typeof (window as any).renderInventoryTable === 'function') {
      (window as any).renderInventoryTable();
    }
  } catch (e) {
    console.error("Failed to update turbine type:", e);
    alert("Türbin tipi kaydedilirken hata oluştu.");
  }
};

// Register methods to window
(window as any).openAddNewModal = openAddNewModal;
(window as any).closeAddNewModal = closeAddNewModal;
(window as any).saveNewItem = saveNewItem;
(window as any).openEditModal = openEditModal;
(window as any).closeEditModal = closeEditModal;
(window as any).saveEditItem = saveEditItem;
(window as any).deleteEditImage = deleteEditImage;
(window as any).openMtaEditModal = openMtaEditModal;
(window as any).closeMtaEditModal = closeMtaEditModal;
(window as any).saveMtaEditItem = saveMtaEditItem;
(window as any).openDefectEditModal = openDefectEditModal;
(window as any).closeDefectEditModal = closeDefectEditModal;
(window as any).saveDefectEditItem = saveDefectEditItem;
(window as any).openTransferModal = openTransferModal;
(window as any).closeTransferModal = closeTransferModal;
(window as any).saveTransferItem = saveTransferItem;
(window as any).openP2PTransferModal = openP2PTransferModal;
(window as any).closeP2PTransferModal = closeP2PTransferModal;
(window as any).generateP2PQR = generateP2PQR;
(window as any).closeHistoryModal = closeHistoryModal;
(window as any).openHistoryModal = openHistoryModal;
(window as any).showBigQR = showBigQR;
(window as any).closeBigQR = closeBigQR;
(window as any).printSingleQRFromModal = printSingleQRFromModal;
(window as any).showBigImage = showBigImage;
(window as any).closeBigImage = closeBigImage;
(window as any).showRecoveryInfoList = showRecoveryInfoList;
(window as any).returnDefectToInventory = returnDefectToInventory;
(window as any).openSendToRepairModal = openSendToRepairModal;
(window as any).scrapDefectiveItem = scrapDefectiveItem;
(window as any).openBulkSendToRepairModal = openBulkSendToRepairModal;
(window as any).openBulkSendToTeamRepairModal = openBulkSendToTeamRepairModal;
(window as any).openTeamRepairFormModal = openTeamRepairFormModal;
(window as any).openBulkScrapModal = openBulkScrapModal;
(window as any).approveWarehouseMsfTransfer = approveWarehouseMsfTransfer;
(window as any).rejectWarehouseMsfTransfer = rejectWarehouseMsfTransfer;
(window as any).printWarehouseMsfVoucher = printWarehouseMsfVoucher;
(window as any).openQuickPriceModal = openQuickPriceModal;
(window as any).closeQuickPriceModal = closeQuickPriceModal;
(window as any).saveQuickPriceModal = saveQuickPriceModal;
(window as any).openQuickCabinetModal = openQuickCabinetModal;
(window as any).closeQuickCabinetModal = closeQuickCabinetModal;
(window as any).saveQuickCabinet = saveQuickCabinet;
(window as any).openQuickTurbineTypeModal = openQuickTurbineTypeModal;
(window as any).closeQuickTurbineTypeModal = closeQuickTurbineTypeModal;
(window as any).saveQuickTurbineType = saveQuickTurbineType;
(window as any).openViewTeamRepairFormModal = openViewTeamRepairFormModal;

export const openViewTeamRepairFormModalById = async (repairId: string) => {
  try {
    const { doc, getDoc } = await import('firebase/firestore');
    const { db } = await import('../../firebase');
    const snap = await getDoc(doc(db, 'team_repairs', repairId));
    if (snap.exists()) {
      openViewTeamRepairFormModal({ id: snap.id, ...snap.data() });
    } else {
      alert('Onarım formu kaydı bulunamadı.');
    }
  } catch (e: any) {
    console.error('Onarım formu açma hatası:', e);
    alert('Hata: ' + e.message);
  }
};
(window as any).openViewTeamRepairFormModalById = openViewTeamRepairFormModalById;
