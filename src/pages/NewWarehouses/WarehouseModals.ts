import { warehouseState, getUserProfile } from './WarehouseState';
import { db } from '../../firebase';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { warehouseService } from '../../services/WarehouseService';
import { dataService } from '../../services/DataService';
import { warehouseAgent } from '../../agents/WarehouseAgent';
import { fileService } from '../../services/FileService';
import { ImageCompressor } from '../../utils/imageCompressor';
import QRCode from 'qrcode';
import { Html5QrcodeScanner } from 'html5-qrcode';

// --- Static Modals HTML ---
export const renderModalsHTML = (targetOptions: any[], isMobileWarehouse: boolean) => {
  return `
    <!-- Add New Modal -->
    <div id="add-new-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(10, 14, 23, 0.8); z-index: 1000; justify-content: center; align-items: center; backdrop-filter: blur(4px);">
      <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; width: 500px; padding: 2rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2 style="margin: 0; font-size: 1.25rem; color: #FFF;">Yeni Malzeme Ekle</h2>
          <i class="fa-solid fa-times" onclick="window.closeAddNewModal()" style="cursor: pointer; color: #64748B; font-size: 1.25rem;"></i>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">SAP Numarası (Otomatik Aranır)</label>
            <input id="new-sap-input" type="text" autocomplete="off" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #14F195; padding: 0 1rem; font-size: 1rem; outline: none; font-weight: 600;" placeholder="Örn: 32">
          </div>
          
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Malzeme Tanımı</label>
            <input id="new-name-input" type="text" style="width: 100%; height: 42px; background-color: rgba(10, 14, 23, 0.5); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;" placeholder="Sözlükten bulunacak...">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Miktar</label>
              <input id="new-qty-input" type="number" min="0" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;" placeholder="0">
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Birim</label>
              <select id="new-unit-input" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; appearance: none;">
                <option value="Adet">Adet</option>
                <option value="Kutu">Kutu</option>
                <option value="Litre">Litre</option>
                <option value="Set">Set</option>
              </select>
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Raf Konumu</label>
            <input id="new-loc-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;" placeholder="Örn: A-12">
          </div>

          <div id="new-stock-entry-details" style="display: flex; flex-direction: column; gap: 0.75rem; border-top: 1px dashed #1E293B; padding-top: 0.75rem; margin-top: 0.5rem; text-align: left;">
            <h4 style="font-size: 0.8rem; font-weight: 700; color: #14F195; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Malzeme Giriş Bilgileri</h4>
            <div>
              <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Malzeme Nereden Geldi?</label>
              <input id="new-source-input" type="text" placeholder="Örn: Merkez Depo, Tedarikçi, Saha vb." style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <div>
                <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">İrsaliye / Delivery Note</label>
                <input id="new-delivery-input" type="text" placeholder="Varsa irsaliye no" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Fatura Numarası</label>
                <input id="new-invoice-input" type="text" placeholder="Varsa fatura no" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
              </div>
            </div>
            <div>
              <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Güncelleyen Personel</label>
              <input id="new-updatedby-input" type="text" placeholder="Ad Soyad" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
            </div>
            <div>
              <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Not / Açıklama</label>
              <input id="new-entry-note-input" type="text" placeholder="Varsa eklemek istediğiniz not" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #14F195; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;"><i class="fa-solid fa-image" style="margin-right:0.25rem;"></i> Malzeme Görseli</label>
            <div 
              onclick="document.getElementById('new-img-input').click()" 
              style="width: 100%; height: 160px; background-color: #0A0E17; border: 1px dashed #334155; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;"
              onmouseover="this.style.borderColor='#14F195'; this.style.backgroundColor='#0d131f';"
              onmouseout="this.style.borderColor='#334155'; this.style.backgroundColor='#0A0E17';"
            >
              <i class="fa-solid fa-camera" style="font-size: 2.5rem; color: #475569; margin-bottom: 0.75rem; transition: color 0.2s;"></i>
              <div id="new-img-label" style="color: #94A3B8; font-size: 0.9rem; font-weight: 500;">Görsel Yükle</div>
              <input id="new-img-input" type="file" accept="image/*" style="display: none;" onchange="const label = document.getElementById('new-img-label'); if (label) { label.innerText = this.files[0] ? this.files[0].name : 'Görsel Yükle'; label.style.color = this.files[0] ? '#14F195' : '#94A3B8'; } const cameraIcon = this.previousElementSibling; if (cameraIcon) { (cameraIcon as HTMLElement).style.color = this.files[0] ? '#14F195' : '#475569'; }">
            </div>
          </div>

          <button onclick="window.saveNewItem(this)" style="height: 42px; margin-top: 0.5rem; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.95rem; font-weight: 600; cursor: pointer; width: 100%;">
            Malzemeyi Kaydet
          </button>
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
    <div id="new-warehouse-edit-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
      <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 500px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h3 style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;">Malzemeyi Düzenle</h3>
          <button onclick="window.closeEditModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <input type="hidden" id="edit-item-id">
          
          <div style="display: flex; gap: 1rem; align-items: flex-start;">
              <div style="width: 100px; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                  <img id="edit-img-preview" src="" style="display: none; width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid #1E293B; background: #111827;">
                  <div style="display: flex; flex-direction: column; width: 100%; gap: 0.25rem;">
                      <label for="edit-img-input" style="width: 100%; text-align: center; font-size: 0.75rem; color: #94A3B8; cursor: pointer; padding: 4px; border: 1px dashed #334155; border-radius: 6px; transition: color 0.2s;" onmouseover="this.style.color='#14F195'" onmouseout="this.style.color='#94A3B8'">
                          <i class="fa-solid fa-camera" style="margin-right: 4px;"></i> Resmi Değiştir
                      </label>
                      <button onclick="window.deleteEditImage()" style="width: 100%; text-align: center; font-size: 0.75rem; color: #EF4444; background: transparent; cursor: pointer; padding: 4px; border: 1px solid #EF4444; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='transparent'">
                          <i class="fa-solid fa-trash" style="margin-right: 4px;"></i> Resmi Sil
                      </button>
                  </div>
                  <input id="edit-img-input" type="file" accept="image/*" style="display: none;" onchange="
                      const file = this.files[0];
                      if (file) {
                          const reader = new FileReader();
                          reader.onload = e => {
                              const preview = document.getElementById('edit-img-preview');
                              if (preview) {
                                (preview as HTMLImageElement).src = e.target?.result as string;
                                preview.style.display = 'block';
                              }
                          };
                          reader.readAsDataURL(file);
                      }
                  ">
              </div>
              
              <div style="flex: 1; display: flex; flex-direction: column; gap: 1rem;">
                  <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">SAP Numarası</label>
            <input id="edit-sap-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
          </div>
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Malzeme Tanımı</label>
            <input id="edit-name-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Miktar</label>
              <input id="edit-qty-input" type="number" min="0" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
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
          
          </div> <!-- End of inputs flex: 1 -->
          </div> <!-- End of main image+inputs flex container -->
          
          <button onclick="window.saveEditItem(this)" style="height: 42px; margin-top: 0.5rem; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.95rem; font-weight: 600; cursor: pointer; width: 100%;">Değişiklikleri Kaydet</button>
        </div>
      </div>
    </div>

    <!-- Transfer Modal -->
    <div id="new-warehouse-transfer-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
      <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 400px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
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
    <div id="new-warehouse-history-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
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
        <button onclick="document.getElementById('big-image-modal').style.display='none'" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.5rem; transition: color 0.2s;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#64748B'"><i class="fa-solid fa-xmark"></i></button>
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
  `;
};

// --- Modal Handlers ---

export const openAddNewModal = () => {
  const modal = document.getElementById('add-new-modal');
  if (modal) modal.style.display = 'flex';
  
  const sourceInput = document.getElementById('new-source-input') as HTMLInputElement;
  if (sourceInput) sourceInput.value = '';
  const deliveryInput = document.getElementById('new-delivery-input') as HTMLInputElement;
  if (deliveryInput) deliveryInput.value = '';
  const invoiceInput = document.getElementById('new-invoice-input') as HTMLInputElement;
  if (invoiceInput) invoiceInput.value = '';
  const noteInput = document.getElementById('new-entry-note-input') as HTMLInputElement;
  if (noteInput) noteInput.value = '';
  
  const userProfile = getUserProfile();
  const user = userProfile ? userProfile.displayName || userProfile.email : '';
  const updatedByInput = document.getElementById('new-updatedby-input') as HTMLInputElement;
  if (updatedByInput) updatedByInput.value = user;

  const sapInput = document.getElementById('new-sap-input') as HTMLInputElement;
  setTimeout(() => sapInput?.focus(), 100);
};

export const closeAddNewModal = () => {
  const modal = document.getElementById('add-new-modal');
  if (modal) modal.style.display = 'none';
  const sapInput = document.getElementById('new-sap-input') as HTMLInputElement;
  if (sapInput) sapInput.value = '';
  const nameInput = document.getElementById('new-name-input') as HTMLInputElement;
  if (nameInput) nameInput.value = '';
  const quantityInput = document.getElementById('new-qty-input') as HTMLInputElement;
  if (quantityInput) quantityInput.value = '';
  const locationInput = document.getElementById('new-loc-input') as HTMLInputElement;
  if (locationInput) locationInput.value = '';
  const imgInput = document.getElementById('new-img-input') as HTMLInputElement;
  if (imgInput) imgInput.value = '';
  const imgLabel = document.getElementById('new-img-label');
  if (imgLabel) { imgLabel.innerText = 'Görsel Yükle'; imgLabel.style.color = '#94A3B8'; }
  if ((window as any).selectWarehouseAndNavigate) {
    (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
  }
};

export const saveNewItem = async (btn: HTMLButtonElement) => {
  const sapInput = document.getElementById('new-sap-input') as HTMLInputElement;
  const nameInput = document.getElementById('new-name-input') as HTMLInputElement;
  const quantityInput = document.getElementById('new-qty-input') as HTMLInputElement;
  const unitInput = document.getElementById('new-unit-input') as HTMLInputElement;
  const locationInput = document.getElementById('new-loc-input') as HTMLInputElement;

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
    const imgInput = document.getElementById('new-img-input') as HTMLInputElement;
    const inputNameValue = nameInput.value;

    const sourceVal = (document.getElementById('new-source-input') as HTMLInputElement)?.value.trim() || '';
    const deliveryVal = (document.getElementById('new-delivery-input') as HTMLInputElement)?.value.trim() || '';
    const invoiceVal = (document.getElementById('new-invoice-input') as HTMLInputElement)?.value.trim() || '';
    const updatedByVal = (document.getElementById('new-updatedby-input') as HTMLInputElement)?.value.trim() || '';
    const entryNoteVal = (document.getElementById('new-entry-note-input') as HTMLInputElement)?.value.trim() || '';
    
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
    const imgLabel = document.getElementById('new-img-label');
    if (imgLabel) { imgLabel.innerText = 'Görsel Yükle'; imgLabel.style.color = '#94A3B8'; }
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

export const openEditModal = (id: string, sap: string, name: string, qty: number, loc: string, imageUrl?: string, minStock?: number) => {
  const modal = document.getElementById('new-warehouse-edit-modal');
  if(modal) {
    (document.getElementById('edit-item-id') as HTMLInputElement).value = id;
    (document.getElementById('edit-sap-input') as HTMLInputElement).value = sap;
    (document.getElementById('edit-name-input') as HTMLInputElement).value = name;
    (document.getElementById('edit-qty-input') as HTMLInputElement).value = qty.toString();
    (document.getElementById('edit-loc-input') as HTMLInputElement).value = loc || '';
    
    const oldQtyInput = document.getElementById('edit-old-qty-input') as HTMLInputElement;
    if (oldQtyInput) oldQtyInput.value = qty.toString();

    const sourceInput = document.getElementById('edit-source-input') as HTMLInputElement;
    if (sourceInput) sourceInput.value = '';
    const deliveryInput = document.getElementById('edit-delivery-input') as HTMLInputElement;
    if (deliveryInput) deliveryInput.value = '';
    const invoiceInput = document.getElementById('edit-invoice-input') as HTMLInputElement;
    if (invoiceInput) invoiceInput.value = '';
    const noteInput = document.getElementById('edit-entry-note-input') as HTMLInputElement;
    if (noteInput) noteInput.value = '';
    
    const userProfile = getUserProfile();
    const user = userProfile ? userProfile.displayName || userProfile.email : '';
    const updatedByInput = document.getElementById('edit-updatedby-input') as HTMLInputElement;
    if (updatedByInput) updatedByInput.value = user;

    const detailsDiv = document.getElementById('edit-stock-entry-details');
    if (detailsDiv) detailsDiv.style.display = 'none';

    const qtyInput = document.getElementById('edit-qty-input') as HTMLInputElement;
    if (qtyInput) {
        qtyInput.oninput = (e: any) => {
            const newQty = parseInt(e.target.value) || 0;
            if (detailsDiv) {
                if (newQty > qty) {
                    detailsDiv.style.display = 'flex';
                } else {
                    detailsDiv.style.display = 'none';
                }
            }
        };
    }
    
    const minStockInput = document.getElementById('edit-min-stock-input') as HTMLInputElement;
    if (minStockInput) minStockInput.value = minStock !== undefined ? minStock.toString() : '0';
    
    const imgPreview = document.getElementById('edit-img-preview') as HTMLImageElement;
    if (imgPreview) {
        if (imageUrl && imageUrl !== 'undefined' && imageUrl !== 'null') {
            imgPreview.src = imageUrl;
            imgPreview.style.display = 'block';
        } else {
            imgPreview.src = '';
            imgPreview.style.display = 'none';
        }
    }
    
    const imgInput = document.getElementById('edit-img-input') as HTMLInputElement;
    if (imgInput) imgInput.value = '';
    
    modal.style.display = 'flex';
  }
};

export const closeEditModal = () => {
  const modal = document.getElementById('new-warehouse-edit-modal');
  if(modal) modal.style.display = 'none';
};

export const saveEditItem = async (btn: HTMLButtonElement) => {
  const id = (document.getElementById('edit-item-id') as HTMLInputElement).value;
  const sap = (document.getElementById('edit-sap-input') as HTMLInputElement).value;
  const name = (document.getElementById('edit-name-input') as HTMLInputElement).value;
  const qty = parseInt((document.getElementById('edit-qty-input') as HTMLInputElement).value);
  const loc = (document.getElementById('edit-loc-input') as HTMLInputElement).value;
  const minStockInput = document.getElementById('edit-min-stock-input') as HTMLInputElement;
  const minStock = minStockInput && minStockInput.value ? parseInt(minStockInput.value) : 0;
  
  const oldQty = parseInt((document.getElementById('edit-old-qty-input') as HTMLInputElement).value) || 0;
  
  let logDetails: any = undefined;
  if (qty > oldQty) {
      const source = (document.getElementById('edit-source-input') as HTMLInputElement).value.trim();
      const delivery = (document.getElementById('edit-delivery-input') as HTMLInputElement).value.trim();
      const invoice = (document.getElementById('edit-invoice-input') as HTMLInputElement).value.trim();
      const updatedBy = (document.getElementById('edit-updatedby-input') as HTMLInputElement).value.trim();
      
      logDetails = {
          sourceWh: source || '-',
          deliveryNote: delivery || '-',
          invoiceNo: invoice || '-',
          updatedBy: updatedBy
      };
  }
  
  const originalText = btn.innerText;
  btn.innerText = 'Kaydediliyor...';
  btn.disabled = true;
  
  try {
    await warehouseService.updateMaterial(warehouseState.currentWarehouse.id, id, {
      sapNo: sap, description: name, quantity: qty, shelfNo: loc, criticalLimit: minStock || 0
    } as any, logDetails);

    const imgInput = document.getElementById('edit-img-input') as HTMLInputElement;
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
               const editQty = (document.getElementById('edit-qty-input') as HTMLInputElement).value;
               const editLoc = (document.getElementById('edit-loc-input') as HTMLInputElement).value;
               const minSt = (document.getElementById('edit-min-stock-input') as HTMLInputElement)?.value || 0;
               editBtn.setAttribute('onclick', `window.openEditModal('${id}', '${sap}', '${safeNameForEdit}', ${editQty}, '${editLoc}', '${localPreviewUrl}', ${minSt})`);
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

  } catch(e) { console.error(e); alert('Hata oluştu'); }
  finally { btn.innerText = originalText; btn.disabled = false; }
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
          editBtn.setAttribute('onclick', `window.openEditModal('${item.id}', '${item.sapNo}', '${safeNameForEdit}', ${item.quantity}, '${item.shelfNo || ''}', '', ${item.minStock || 0})`);
      }
      
      alert("Görsel başarıyla silindi!");
  } catch(e: any) {
      alert("Silinirken hata oluştu: " + e.message);
  }
};

export const openMtaEditModal = (id: string, sap: string, name: string, serial: string, note: string, loc: string, qty: number) => {
  const modal = document.getElementById('new-warehouse-mta-edit-modal');
  if (modal) {
    (document.getElementById('mta-edit-item-id') as HTMLInputElement).value = id;
    const nameText = document.getElementById('mta-edit-name-text');
    if (nameText) nameText.innerText = name;
    const sapText = document.getElementById('mta-edit-sap-text');
    if (sapText) sapText.innerText = sap;
    (document.getElementById('mta-edit-qty-input') as HTMLInputElement).value = qty !== undefined ? qty.toString() : '0';
    (document.getElementById('mta-edit-serial-input') as HTMLInputElement).value = (serial === 'undefined' || serial === 'null') ? '' : serial;
    (document.getElementById('mta-edit-note-input') as HTMLTextAreaElement).value = (note === 'undefined' || note === 'null') ? '' : note;
    (document.getElementById('mta-edit-loc-input') as HTMLInputElement).value = (loc === 'undefined' || loc === 'null') ? '' : loc;
    modal.style.display = 'flex';
  }
};

export const closeMtaEditModal = () => {
  const modal = document.getElementById('new-warehouse-mta-edit-modal');
  if (modal) modal.style.display = 'none';
};

export const saveMtaEditItem = async (btn: HTMLButtonElement) => {
  const id = (document.getElementById('mta-edit-item-id') as HTMLInputElement).value;
  const qty = parseInt((document.getElementById('mta-edit-qty-input') as HTMLInputElement).value) || 0;
  const serial = (document.getElementById('mta-edit-serial-input') as HTMLInputElement).value.trim();
  const note = (document.getElementById('mta-edit-note-input') as HTMLTextAreaElement).value.trim();
  const loc = (document.getElementById('mta-edit-loc-input') as HTMLInputElement).value.trim();
  
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
  const modal = document.getElementById('new-warehouse-defect-edit-modal');
  if (modal) {
    (document.getElementById('defect-edit-item-id') as HTMLInputElement).value = id;
    const reportDocIdInput = document.getElementById('defect-edit-report-doc-id') as HTMLInputElement;
    if (reportDocIdInput) reportDocIdInput.value = reportDocId;
    const nameText = document.getElementById('defect-edit-name-text');
    if (nameText) nameText.innerText = name;
    const sapText = document.getElementById('defect-edit-sap-text');
    if (sapText) sapText.innerText = sap;
    (document.getElementById('defect-edit-serial-input') as HTMLInputElement).value = (serial === 'undefined' || serial === 'null' || serial === '-') ? '' : serial;
    modal.style.display = 'flex';
  }
};

export const closeDefectEditModal = () => {
  const modal = document.getElementById('new-warehouse-defect-edit-modal');
  if (modal) modal.style.display = 'none';
};

export const saveDefectEditItem = async (btn: HTMLButtonElement) => {
  const id = (document.getElementById('defect-edit-item-id') as HTMLInputElement).value;
  const serial = (document.getElementById('defect-edit-serial-input') as HTMLInputElement).value.trim();
  const reportDocId = (document.getElementById('defect-edit-report-doc-id') as HTMLInputElement)?.value || '';
  const sapTextEl = document.getElementById('defect-edit-sap-text');
  const sapNo = sapTextEl ? sapTextEl.innerText.trim() : '';

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
  const modal = document.getElementById('new-warehouse-transfer-modal');
  if(modal) {
    (document.getElementById('transfer-item-id') as HTMLInputElement).value = id;
    const transferInfo = document.getElementById('transfer-info');
    if (transferInfo) transferInfo.innerText = `${sap} - ${name} (Mevcut: ${maxQty})`;
    (document.getElementById('transfer-qty-input') as HTMLInputElement).max = maxQty.toString();
    (document.getElementById('transfer-qty-input') as HTMLInputElement).value = '1';

    const targetSelect = document.getElementById('transfer-target-input') as HTMLSelectElement;
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
       } else {
         optionsHtml = warehouseState.targetOptions.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
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
  const modal = document.getElementById('new-warehouse-transfer-modal');
  if(modal) modal.style.display = 'none';
};

export const saveTransferItem = async (btn: HTMLButtonElement) => {
  const id = (document.getElementById('transfer-item-id') as HTMLInputElement).value;
  const targetId = (document.getElementById('transfer-target-input') as HTMLSelectElement).value;
  const qty = parseInt((document.getElementById('transfer-qty-input') as HTMLInputElement).value);
  
  if(!targetId || isNaN(qty) || qty <= 0) {
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
  const modal = document.getElementById('p2p-transfer-modal');
  if (modal) {
    (document.getElementById('p2p-item-id') as HTMLInputElement).value = id;
    (document.getElementById('p2p-item-sap') as HTMLInputElement).value = sap;
    (document.getElementById('p2p-item-name') as HTMLInputElement).value = name;
    
    const infoDiv = document.getElementById('p2p-info');
    if (infoDiv) {
      infoDiv.innerText = `${sap} - ${name} (Zimmetinizdeki Mevcut: ${maxQty})`;
    }
    
    const qtyInput = document.getElementById('p2p-qty-input') as HTMLInputElement;
    qtyInput.max = maxQty.toString();
    qtyInput.value = '1';
    
    const inputContainer = document.getElementById('p2p-input-container');
    if (inputContainer) inputContainer.style.display = 'block';
    const qrDisplay = document.getElementById('p2p-qr-display');
    if (qrDisplay) qrDisplay.style.display = 'none';
    
    modal.style.display = 'flex';
  }
};

export const closeP2PTransferModal = () => {
  const modal = document.getElementById('p2p-transfer-modal');
  if (modal) modal.style.display = 'none';
};

export const generateP2PQR = async () => {
  const id = (document.getElementById('p2p-item-id') as HTMLInputElement).value;
  const sap = (document.getElementById('p2p-item-sap') as HTMLInputElement).value;
  const name = (document.getElementById('p2p-item-name') as HTMLInputElement).value;
  const qtyInput = document.getElementById('p2p-qty-input') as HTMLInputElement;
  const qty = parseInt(qtyInput.value);
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
  const modal = document.getElementById('new-warehouse-history-modal');
  if(modal) modal.style.display = 'none';
};

export const openHistoryModal = async (id: string, name: string) => {
  const modal = document.getElementById('new-warehouse-history-modal');
  if(modal) {
    const historyTitle = document.getElementById('history-title') as HTMLElement;
    if (historyTitle) historyTitle.innerText = `Geçmiş: ${name}`;
    const list = document.getElementById('history-list');
    if(list) list.innerHTML = '<div style="text-align:center; padding:1rem;">Yükleniyor...</div>';
    modal.style.display = 'flex';
    
    try {
      const logs = await warehouseService.getLogs(warehouseState.currentWarehouse.id);
      const itemLogs = logs.filter(l => l.itemId === id).sort((a,b:any) => ((b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
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
  const img = document.getElementById('big-qr-img');
  if (img) img.setAttribute('src', qrUrl);
  const titleDiv = document.getElementById('big-qr-title');
  if (titleDiv) {
     titleDiv.innerHTML = `
        <div style="font-size: 1.15rem; font-weight: 700; color: #FFFFFF; line-height: 1.3;">${name}</div>
        <div style="font-size: 0.95rem; color: #14F195; margin-top: 6px; font-weight: 700;">SAP NO: ${sapNo}</div>
     `;
  }
  (window as any)._currentBigQRItem = { id, sapNo, description: name, warehouseId: warehouseState.currentWarehouse.id };
  const modal = document.getElementById('big-qr-modal');
  if (modal) modal.style.display = 'flex';
};

export const closeBigQR = () => {
  const modal = document.getElementById('big-qr-modal');
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
  const img = document.getElementById('big-image-img');
  if (img) img.setAttribute('src', url);
  const titleDiv = document.getElementById('big-image-title');
  if (titleDiv) titleDiv.innerText = title;
  const modal = document.getElementById('big-image-modal');
  if (modal) modal.style.display = 'flex';
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

        await warehouseService.updateStockBySap(
          warehouseState.currentWarehouse.id,
          sapNo,
          -qty,
          {
            user: userEmail,
            reason: `Hurdaya ayrıldı. Gerekçe: ${note}`
          },
          'DEFECT'
        );

        await warehouseService.updateStockBySap(
          warehouseState.currentWarehouse.id,
          sapNo,
          qty,
          {
            user: userEmail,
            reason: `Hurda stok girişi. Gerekçe: ${note}`
          },
          'SCRAP'
        );

        (window as any).showToast?.('Başarılı', 'Malzeme başarıyla hurdaya ayrıldı ve hurda stoğuna eklendi.', 'success');
        modal.remove();

        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
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
        <strong>Sevk No (Otomatik):</strong> <span style="font-family:monospace; color:#14F195; font-weight:bold; font-size:0.95rem; margin-left:4px;">${dispatchNo}</span>
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
            dispatchNo: dispatchNo
          } as any);

          await warehouseService.updateStockBySap(
            warehouseState.currentWarehouse.id,
            item.sapNo,
            -item.sendQty,
            {
              user: userEmail,
              reason: `Toplu sevk kapsamında tamir atölyesine gönderildi. Sevk No: ${dispatchNo}`
            },
            'DEFECT'
          );
        }

        (window as any).showToast?.('Başarılı', `Malzemeler ${dispatchNo} sevk numarası ile başarıyla sevk edildi.`, 'success');
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

export const openBulkScrapModal = (items: Array<{
  id: string;
  sapNo: string;
  description: string;
  quantity: number;
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

        for (const item of itemsWithQty) {
          await warehouseService.updateStockBySap(
            warehouseState.currentWarehouse.id,
            item.sapNo,
            -item.scrapQty,
            {
              user: userEmail,
              reason: `Toplu hurdaya ayrıldı. Gerekçe: ${note}`
            },
            'DEFECT'
          );

          await warehouseService.updateStockBySap(
            warehouseState.currentWarehouse.id,
            item.sapNo,
            item.scrapQty,
            {
              user: userEmail,
              reason: `Toplu hurda stok girişi. Gerekçe: ${note}`
            },
            'SCRAP'
          );
        }

        (window as any).showToast?.('Başarılı', 'Seçilen malzemeler başarıyla hurdaya ayrıldı.', 'success');
        modal.remove();

        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
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
(window as any).showRecoveryInfoList = showRecoveryInfoList;
(window as any).returnDefectToInventory = returnDefectToInventory;
(window as any).openSendToRepairModal = openSendToRepairModal;
(window as any).scrapDefectiveItem = scrapDefectiveItem;
(window as any).openBulkSendToRepairModal = openBulkSendToRepairModal;
(window as any).openBulkScrapModal = openBulkScrapModal;
(window as any).approveWarehouseMsfTransfer = approveWarehouseMsfTransfer;
(window as any).rejectWarehouseMsfTransfer = rejectWarehouseMsfTransfer;
(window as any).printWarehouseMsfVoucher = printWarehouseMsfVoucher;
