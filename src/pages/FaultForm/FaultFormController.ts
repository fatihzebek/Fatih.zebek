import { dataService } from '../../services/DataService';
import { statusService } from '../../services/StatusService';
import { inventoryService } from '../../services/InventoryService';
import { serviceReportService } from '../../services/ServiceReportService';
import { userService } from '../../services/UserService';
import { auditService } from '../../services/AuditService';
import { FaultFormUI } from './FaultFormUI';
import * as DateTimeUtils from '../../utils/DateTimeUtils';
import personnelList from '../../data/personnel.json';
import { warehouseService } from '../../services/WarehouseService';
import { maintenanceService } from '../../services/MaintenanceService';
import { formatTeamName } from '../../utils/formatters';
import { ImageCompressor } from '../../utils/imageCompressor';

export class FaultFormController {
    static init(initialData?: any) {
        this.registerGlobalHandlers();
        
        // Define deterministic hydration logic that runs once the DOM is rendered
        (window as any).initFaultFormLogic = () => {
            if (initialData) {
                this.initializeForm(initialData);
            }
        };
        
        // Safety fallback: if for some reason the page-specific initializer isn't triggered, run it anyway
        if (initialData) {
            setTimeout(() => {
                const container = document.getElementById('work-sessions-container');
                // Only run if not already hydrated/rendered
                if (container && (!container.innerHTML || container.innerHTML.includes('loading') || container.innerHTML.length < 100)) {
                    this.initializeForm(initialData);
                }
            }, 250);
        }
    }

    private static registerGlobalHandlers() {
        const w = window as any;

        w.recordAuditClick = (index: number, status: string) => {
            if (!w.auditTracking) {
                w.auditTracking = {
                    formOpenedTime: Date.now(),
                    clicks: []
                };
            }
            w.auditTracking.clicks.push({
                index,
                status,
                timestamp: Date.now()
            });
        };

        w.handleFaultSearch = (term: string) => {
            w.searchFaultCodes(term);
        };

        w.handleSapLookup = async (input: HTMLInputElement) => {
            const sapNo = input.value.trim();
            const row = input.closest('tr');
            if (!row) return;

            const lookupId = Date.now().toString() + Math.random().toString();
            input.setAttribute('data-lookup-id', lookupId);

            const inputs = row.querySelectorAll('input');
            const rowType = row.getAttribute('data-type') || 'S';
            
            if (sapNo.length === 0) {
                if (inputs && inputs[2]) {
                    inputs[2].value = '';
                }
                const badge = row.querySelector('.stock-badge') as HTMLSpanElement;
                if (badge) badge.style.display = 'none';
                return;
            }

            try {
                const material = await inventoryService.getMaterialBySap(sapNo);
                
                if (input.getAttribute('data-lookup-id') !== lookupId) return;

                // 1. Update Description Input with clean description
                if (inputs && inputs[2]) {
                    const baseDesc = material ? (material.d || '') : (inputs[2].value || '');
                    const cleanDesc = baseDesc.replace(/\s*\(STOK:\s*\d+\)/gi, '');
                    inputs[2].value = cleanDesc;
                }

                // 2. Handle stock badge lookup only for Takılan (T) type
                const badge = row.querySelector('.stock-badge') as HTMLSpanElement;
                if (rowType === 'T') {
                    const siteIdEl = document.getElementById('form-site') as HTMLInputElement;
                    let siteId = siteIdEl?.value || '';
                    
                    if (!siteId) {
                        const turbineSerialEl = document.getElementById('turbin-seri') as HTMLInputElement;
                        if (turbineSerialEl && turbineSerialEl.value) {
                            const turbine = (window as any).dataService?.findTurbineBySerial(turbineSerialEl.value);
                            if (turbine) siteId = turbine.siteId;
                        }
                    }

                    if (!siteId && w.currentTaskContext?.task?.siteId) {
                        siteId = w.currentTaskContext.task.siteId;
                    }

                    let stockQty = 0;
                    if (siteId) {
                        try {
                            const stockItem = await warehouseService.getStockBySap(siteId, sapNo);
                            
                            if (input.getAttribute('data-lookup-id') !== lookupId) return;

                            if (stockItem) {
                                stockQty = stockItem.quantity || 0;
                                badge.setAttribute('data-debug', JSON.stringify({id: stockItem.id, q: stockItem.quantity}));
                            } else {
                                badge.setAttribute('data-debug', 'null_item');
                                
                                // O anki depoda malzeme yoksa, açıklamasını bulmak için diğer depoları tara
                                const allSites = (window as any).dataService?.getWarehouses() || [];
                                for (const site of allSites) {
                                    if (site.id !== siteId) {
                                        const otherItem = await warehouseService.getStockBySap(site.id, sapNo);
                                        if (otherItem && otherItem.description) {
                                            const descInput = inputs[2] as HTMLInputElement;
                                            if (descInput && !descInput.value) {
                                                descInput.value = otherItem.description;
                                            }
                                            break;
                                        }
                                    }
                                }
                            }
                        } catch (err: any) {
                            badge.setAttribute('data-debug', 'err_' + err.message);
                        }
                    } else {
                        badge.setAttribute('data-debug', 'no_siteId');
                    }
                    if (badge) {
                        const debugInfo = badge.getAttribute('data-debug') || '';
                        badge.textContent = `STOK: ${stockQty} ${stockQty === 0 ? '(' + debugInfo + ')' : ''}`;
                        badge.style.display = 'inline-block';
                        if (stockQty > 0) {
                            badge.style.backgroundColor = 'rgba(0, 230, 118, 0.15)';
                            badge.style.color = '#00e676';
                            badge.style.border = '1px solid #00e676';
                            badge.style.boxShadow = '0 0 10px rgba(0, 230, 118, 0.4)';
                        } else {
                            badge.style.backgroundColor = 'rgba(255, 0, 85, 0.15)';
                            badge.style.color = '#ff0055';
                            badge.style.border = '1px solid #ff0055';
                            badge.style.boxShadow = '0 0 10px rgba(255, 0, 85, 0.4)';
                        }
                    }
                } else {
                    // If type S, hide the badge if it exists
                    if (badge) {
                        badge.style.display = 'none';
                    }
                }
            } catch (err) {
                console.error("SAP Lookup Error:", err);
            }
        };

        // Inline tabular personnel auto-complete is used instead of old overlays.

        w.toggleAuditItem = (index: number, status: string) => {
            if (w.smartAuditItems && w.smartAuditItems[index]) {
                w.smartAuditItems[index].status = status;
                if (typeof w.recordAuditClick === 'function') {
                    w.recordAuditClick(index, status);
                }
                if (status === 'NOT_OK' && !w.smartAuditItems[index].comment) {
                    w.smartAuditItems[index].comment = '';
                }
                w.renderSmartAuditUI();
                if (typeof w.saveMaintenanceDraft === 'function') {
                    w.saveMaintenanceDraft(true);
                }
            }
        };

        w.updateAuditComment = (index: number, val: string) => {
            if (w.smartAuditItems && w.smartAuditItems[index]) {
                w.smartAuditItems[index].comment = val;
                const summaryCardText = document.querySelector(`.summary-comment-${index}`);
                if (summaryCardText) {
                    summaryCardText.innerHTML = val || '<span style="opacity: 0.3; font-style: italic;">Henüz açıklama girilmedi...</span>';
                }
                if (typeof w.saveMaintenanceDraft === 'function') {
                    w.saveMaintenanceDraft(true);
                }
            }
        };

        w.updateTemplateStep = (index: number, field: string, value: any) => {
            if (w.smartAuditItems && w.smartAuditItems[index]) {
                w.smartAuditItems[index][field] = value;
                
                if (field === 'status') {
                    if (typeof w.recordAuditClick === 'function') {
                        w.recordAuditClick(index, value);
                    }
                    if (value === 'NOT_OK' && !w.smartAuditItems[index].comment) {
                        w.smartAuditItems[index].comment = '';
                    }
                    w.renderSmartAuditUI();
                } else if (field === 'requiresMeasurement') {
                    // Re-render UI to show/hide the measurement input and update the toggle button state
                    w.renderSmartAuditUI();
                } else if (field === 'measurementValue') {
                    // Do nothing here, it's bound via oninput.
                    // Just update the internal state so it saves correctly.
                } else if (field === 'text') {
                    // Update bottom failed card title directly in the DOM to avoid focus loss
                    const titleSpan = document.querySelector(`.failed-title-${index}`);
                    if (titleSpan) {
                        titleSpan.textContent = `${index + 1}. ${value}`;
                    }
                } else if (field === 'comment') {
                    // Update bottom failed card comment directly in the DOM to avoid focus loss
                    const commentSpan = document.querySelector(`.summary-comment-${index}`);
                    if (commentSpan) {
                        commentSpan.innerHTML = value || '<span style="opacity: 0.3; font-style: italic;">Henüz açıklama girilmedi...</span>';
                    }
                }
            }
        };

        w.updateAdvMeasurement = (index: number, valIndex: number, value: any) => {
            if (w.smartAuditItems && w.smartAuditItems[index]) {
                const item = w.smartAuditItems[index];
                if (!item.measurementValues) item.measurementValues = [];
                item.measurementValues[valIndex] = value;
                // DO NOT re-render the whole UI to avoid losing focus, just let it be. 
                // The colors will update visually if we want, but since they are typed fast, 
                // we should re-render to get the colors/msg updated! But wait, if we re-render, 
                // the input loses focus. Let's just re-render and refocus.
                // Or wait, the user is typing, we can just save it. The oninput triggers this.
                // We shouldn't re-render everything on every keystroke. 
                // Let's re-render using a small debounce or not at all, because we already have oninput="window.updateAdvMeasurement...".
                // Actually, to get the color feedback, we MUST re-render.
                
                // Let's do a fast re-render and restore focus!
                const activeId = document.activeElement ? document.activeElement.id : null;
                w.renderSmartAuditUI();
                
                // Focus restoration is tricky with dynamic inputs, so let's let the user deal with it, 
                // OR we can change `oninput` to `onchange` in FaultFormUI.ts so it only fires when they leave the field!
                // Yes, onchange is better for measurements!
            }
        };

        w.addTemplateStep = () => {
            if (!w.smartAuditItems) w.smartAuditItems = [];
            const newItem = {
                id: 'step_' + Date.now(),
                text: '',
                category: 'Genel',
                status: 'PENDING'
            };
            w.smartAuditItems.push(newItem);
            
            if (w.currentEditingTemplate) {
                w.currentEditingTemplate.checklist = w.smartAuditItems;
            }
            
            w.renderSmartAuditUI();
            
            setTimeout(() => {
                const inputs = document.querySelectorAll('.template-items-list input, #audit-items-list input');
                if (inputs.length > 0) {
                    (inputs[inputs.length - 1] as HTMLInputElement).focus();
                }
            }, 100);
        };

        w.removeTemplateStep = (index: number) => {
            const items = w.smartAuditItems || [];
            if (index >= 0 && index < items.length) {
                items.splice(index, 1);
                if (w.currentEditingTemplate) {
                    w.currentEditingTemplate.checklist = items;
                }
                w.renderSmartAuditUI();
            }
        };

        w.openAdvancedMeasurementSettings = (index: number) => {
            const items = w.smartAuditItems || [];
            if (index < 0 || index >= items.length) return;
            const item = items[index];
            const config = item.measurementConfig || { type: 'standard', inputCount: 1 };
            w.currentAdvVersionItems = config.versionItems ? JSON.parse(JSON.stringify(config.versionItems)) : [];
            
            const modalId = 'measurement-settings-modal';
            let modal = document.getElementById(modalId);
            if (modal) modal.remove();

            setTimeout(() => {
                if (w.renderAdvVersionList) w.renderAdvVersionList();
            }, 50);

            const html = `
                <div id="${modalId}" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); z-index: 100000; display: flex; align-items: center; justify-content: center;">
                    <div class="glass-panel" style="width: 400px; padding: 2rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: #0f172a;">
                        <h3 style="color: var(--accent-cyan); margin-top: 0; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; font-size: 1rem;">
                            <i class="fa-solid fa-gear"></i> GELİŞMİŞ ÖLÇÜM AYARLARI
                        </h3>
                        <div style="font-size: 0.8rem; color: #8892b0; margin-bottom: 1.5rem;">Madde: ${item.text || 'İsimsiz Madde'}</div>
                        
                        <div style="display: flex; flex-direction: column; gap: 1rem;">
                            <div>
                                <label style="display: block; font-size: 0.7rem; color: #fff; margin-bottom: 0.3rem;">Giriş Tipi</label>
                                <select id="adv-type" class="cyber-select" style="width: 100%; height: 32px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; padding: 0 0.5rem;" onchange="window.updateAdvModalUI()">
                                    <option value="standard" ${config.type === 'standard' ? 'selected' : ''}>Standart (Ölçüm Yok)</option>
                                    <option value="numeric_multiple" ${config.type === 'numeric_multiple' ? 'selected' : ''}>Sayısal (Tekli/Çoklu)</option>
                                    <option value="dropdown" ${config.type === 'dropdown' ? 'selected' : ''}>Çoktan Seçmeli Liste</option>
                                    <option value="version_control" ${config.type === 'version_control' ? 'selected' : ''}>Yazılım Versiyon Kontrolü (Kart Bazlı)</option>
                                    <option value="transformer_control" ${config.type === 'transformer_control' ? 'selected' : ''}>Trafo İletişim ve Saat Formu</option>
                                    <option value="signature_control" ${config.type === 'signature_control' ? 'selected' : ''}>Personel Onay Formu (İsim/İmza)</option>
                                    <option value="crane_control" ${config.type === 'crane_control' ? 'selected' : ''}>Vinç Halat Kontrolü Formu</option>
                                    <option value="safety_equipment_control" ${config.type === 'safety_equipment_control' ? 'selected' : ''}>İş Güvenliği Ekipmanı (6 Ay Kuralı)</option>
                                    <option value="bearing_control" ${config.type === 'bearing_control' ? 'selected' : ''}>Rulman Gres Numunesi Kontrolü</option>
                                    <option value="final_checkout_control" ${config.type === 'final_checkout_control' ? 'selected' : ''}>Bakım Sonu Final Kontrolü</option>
                                </select>
                            </div>
                            
                            <div id="adv-numeric-section" style="${config.type === 'numeric_multiple' ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; color: #fff; margin-bottom: 0.3rem;">Kaç Adet Ölçüm Girilecek? (Örn: 6 Fırça için 6)</label>
                                    <input type="number" id="adv-count" class="cyber-input" value="${config.inputCount || 1}" min="1" style="width: 100%; height: 32px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; padding: 0 0.5rem;">
                                </div>
                                <div style="display: flex; gap: 1rem;">
                                    <div style="flex: 1;">
                                        <label style="display: block; font-size: 0.7rem; color: #fff; margin-bottom: 0.3rem;">Minimum Limit</label>
                                        <input type="number" step="any" id="adv-min" class="cyber-input" value="${config.minLimit ?? ''}" placeholder="Yok" style="width: 100%; height: 32px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; padding: 0 0.5rem;">
                                    </div>
                                    <div style="flex: 1;">
                                        <label style="display: block; font-size: 0.7rem; color: #fff; margin-bottom: 0.3rem;">Maksimum Limit</label>
                                        <input type="number" step="any" id="adv-max" class="cyber-input" value="${config.maxLimit ?? ''}" placeholder="Yok" style="width: 100%; height: 32px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; padding: 0 0.5rem;">
                                    </div>
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.7rem; color: #fff; margin-bottom: 0.3rem;">Birim (mm, bar, ohm vb.)</label>
                                    <input type="text" id="adv-unit" class="cyber-input" value="${config.unit || ''}" style="width: 100%; height: 32px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; padding: 0 0.5rem;">
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.7rem; color: #fff; margin-bottom: 0.3rem;">Özel İsimler (Virgülle Ayırın - İsteğe Bağlı)</label>
                                    <input type="text" id="adv-labels" class="cyber-input" value="${(config.measurementLabels || []).join(', ')}" placeholder="Örn: Akü 1, Akü 2, Akü 3 veya Fırça, Yıldırım Çubuğu" style="width: 100%; height: 32px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; padding: 0 0.5rem;">
                                </div>
                                <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; padding: 0.5rem; background: rgba(0, 230, 118, 0.05); border: 1px solid rgba(0, 230, 118, 0.1); border-radius: 4px;">
                                    <input type="checkbox" id="adv-numeric-sig" ${config.requireSignature ? 'checked' : ''} style="width: 16px; height: 16px; cursor: pointer;">
                                    <label for="adv-numeric-sig" style="font-size: 0.75rem; color: var(--accent-green); cursor: pointer; user-select: none;">Bu ölçümlerle birlikte personelin onay imzasını (İsim/Soyisim) iste</label>
                                </div>
                            </div>

                            <div id="adv-dropdown-section" style="${config.type === 'dropdown' ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 1rem;">
                                <div>
                                    <label style="display: block; font-size: 0.7rem; color: #fff; margin-bottom: 0.3rem;">Seçenekler (Virgülle Ayırın)</label>
                                    <input type="text" id="adv-options" class="cyber-input" value="${(config.dropdownOptions || []).join(',')}" placeholder="A Sınıfı, B Sınıfı, C Sınıfı" style="width: 100%; height: 32px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; padding: 0 0.5rem;">
                                </div>
                                <div>
                                    <label style="display: block; font-size: 0.7rem; color: var(--accent-red); margin-bottom: 0.3rem;">Kritik (Kırmızı) Seçenekler (Virgülle Ayırın)</label>
                                    <input type="text" id="adv-critical" class="cyber-input" value="${(config.criticalOptions || []).join(',')}" placeholder="C Sınıfı, D Sınıfı" style="width: 100%; height: 32px; background: rgba(255,51,102,0.1); border: 1px solid rgba(255,51,102,0.3); color: #fff; border-radius: 4px; padding: 0 0.5rem;">
                                </div>
                            </div>

                            <div id="adv-version-section" style="${config.type === 'version_control' ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 1rem;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <label style="font-size: 0.7rem; color: #fff;">Kartlar ve Beklenen Versiyonlar</label>
                                    <button type="button" class="btn-cyber-outline" onclick="window.addAdvVersionItem()" style="font-size: 0.6rem; padding: 0.2rem 0.5rem; height: auto;">
                                        <i class="fa-solid fa-plus"></i> KART EKLE
                                    </button>
                                </div>
                                <div id="adv-version-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto;">
                                    <!-- Dinamik liste buraya gelecek -->
                                </div>
                            </div>

                            <div id="adv-transformer-section" style="${config.type === 'transformer_control' ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 1rem;">
                                <div style="background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.2); padding: 1rem; border-radius: 8px;">
                                    <p style="font-size: 0.75rem; color: var(--accent-cyan); margin: 0; line-height: 1.4;">
                                        <i class="fa-solid fa-circle-info" style="margin-right: 0.3rem;"></i>
                                        Bu form seçeneği aktifleştirildiğinde, personelin karşısına aşağıdaki sabit bilgiler istenecektir:
                                        <ul style="margin: 0.5rem 0 0 0; padding-left: 1.2rem; color: #8892b0;">
                                            <li>İletişim Kurulan Trafo Sorumlusu</li>
                                            <li>Trafo Açma Saati</li>
                                            <li>Trafo Kapatma Saati</li>
                                        </ul>
                                    </p>
                                </div>
                            </div>

                            <div id="adv-signature-section" style="${config.type === 'signature_control' ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 1rem;">
                                <div style="background: rgba(0, 230, 118, 0.05); border: 1px solid rgba(0, 230, 118, 0.2); padding: 1rem; border-radius: 8px;">
                                    <p style="font-size: 0.75rem; color: var(--accent-green); margin: 0; line-height: 1.4;">
                                        <i class="fa-solid fa-signature" style="margin-right: 0.3rem;"></i>
                                        Bu form seçeneği aktifleştirildiğinde, işlem onay metni ile birlikte <strong>Personelin İsim ve Soyismi</strong> (Dijital İmza olarak) istenecektir.
                                    </p>
                                </div>
                            </div>

                            <div id="adv-crane-section" style="${config.type === 'crane_control' ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 1rem;">
                                <div style="background: rgba(147, 51, 234, 0.05); border: 1px solid rgba(147, 51, 234, 0.2); padding: 1rem; border-radius: 8px;">
                                    <p style="font-size: 0.75rem; color: #d8b4fe; margin: 0; line-height: 1.4;">
                                        <i class="fa-solid fa-truck-pickup" style="margin-right: 0.3rem;"></i>
                                        Bu form seçeneği aktifleştirildiğinde, teknisyene şu alanlar sorulacaktır:
                                        <ul style="margin: 0.5rem 0 0 0; padding-left: 1.2rem; color: #a78bfa;">
                                            <li>Vinç Tipi Seçimi (Limitler Otomatik Uygulanır)</li>
                                            <li>Ölçülen Halat Çapı (Asgari limit kontrolü yapılır)</li>
                                            <li>Tel Kopma Sayıları (30mm, 60mm, 300mm mesafelerde)</li>
                                            <li>Personel Dijital İmzası</li>
                                        </ul>
                                    </p>
                                </div>
                            </div>

                            <div id="adv-safety-section" style="${config.type === 'safety_equipment_control' ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 1rem;">
                                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                                    <label style="font-size: 0.7rem; color: #fff;">Ekipman Türü</label>
                                    <select id="adv-safety-type" class="cyber-select" style="width: 100%; height: 32px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; padding: 0 0.5rem;">
                                        <option value="first_aid" ${config.safetyEquipmentType === 'first_aid' ? 'selected' : ''}>İlk Yardım Çantası</option>
                                        <option value="fire_extinguisher" ${config.safetyEquipmentType === 'fire_extinguisher' ? 'selected' : ''}>Yangın Söndürücü</option>
                                    </select>
                                </div>
                                <div style="background: rgba(255, 170, 0, 0.05); border: 1px solid rgba(255, 170, 0, 0.2); padding: 1rem; border-radius: 8px;">
                                    <p style="font-size: 0.75rem; color: var(--accent-amber); margin: 0; line-height: 1.4;">
                                        <i class="fa-solid fa-shield-heart" style="margin-right: 0.3rem;"></i>
                                        Bu form, personelin girdiği tarihe göre otomatik olarak <strong>6 Ay Kuralı</strong> hesaplaması yapar ve kullanım ömrü 6 aydan az ise uyarı verir.
                                    </p>
                                </div>
                            </div>

                            <div id="adv-bearing-section" style="${config.type === 'bearing_control' ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 1rem;">
                                <div style="background: rgba(244, 63, 94, 0.05); border: 1px solid rgba(244, 63, 94, 0.2); padding: 1rem; border-radius: 8px;">
                                    <p style="font-size: 0.75rem; color: #fb7185; margin: 0; line-height: 1.4;">
                                        <i class="fa-solid fa-microscope" style="margin-right: 0.3rem;"></i>
                                        Bu form seçeneği aktifleştirildiğinde teknisyene şunlar sorulacaktır:
                                        <ul style="margin: 0.5rem 0 0 0; padding-left: 1.2rem; color: #f43f5e;">
                                            <li>Talimata göre (kablo bağıyla) numune alındığına dair onay</li>
                                            <li>Ön ve Arka Rulmanlar için ayrı Gres Hasar Sınıfı seçimi (A, B, C, D, E, F)</li>
                                            <li>Sınıfa göre otomatik renklendirme ve kritik durumlarda yetkili servis uyarısı</li>
                                        </ul>
                                    </p>
                                </div>
                            </div>

                            <div id="adv-checkout-section" style="${config.type === 'final_checkout_control' ? 'display: flex;' : 'display: none;'} flex-direction: column; gap: 1rem;">
                                <div style="background: rgba(14, 165, 233, 0.05); border: 1px solid rgba(14, 165, 233, 0.2); padding: 1rem; border-radius: 8px;">
                                    <p style="font-size: 0.75rem; color: #38bdf8; margin: 0; line-height: 1.4;">
                                        <i class="fa-solid fa-flag-checkered" style="margin-right: 0.3rem;"></i>
                                        Bu form, bakımın son maddesi olarak tasarlanmıştır. Teknisyene 5 maddelik kesin bir taahhüt listesi (Checklist) sunar ve tüm kurallara uyulduğunu beyan etmesini sağlar.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem;">
                            <button class="btn-cyber-outline" style="border-color: rgba(255,255,255,0.2); color: #fff;" onclick="document.getElementById('${modalId}').remove()">İPTAL</button>
                            <button class="btn-cyber" style="background: var(--accent-cyan); color: #000;" onclick="window.saveAdvSettings(${index}, '${modalId}')">KAYDET</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', html);
        };

        w.updateAdvModalUI = () => {
            const typeSelect = document.getElementById('adv-type') as HTMLSelectElement;
            const numSec = document.getElementById('adv-numeric-section');
            const dropSec = document.getElementById('adv-dropdown-section');
            const verSec = document.getElementById('adv-version-section');
            const trafoSec = document.getElementById('adv-transformer-section');
            const sigSec = document.getElementById('adv-signature-section');
            const craneSec = document.getElementById('adv-crane-section');
            const safetySec = document.getElementById('adv-safety-section');
            const bearingSec = document.getElementById('adv-bearing-section');
            const checkoutSec = document.getElementById('adv-checkout-section');
            
            if (typeSelect && numSec && dropSec && verSec && trafoSec && sigSec && craneSec && safetySec && bearingSec && checkoutSec) {
                numSec.style.display = typeSelect.value === 'numeric_multiple' ? 'flex' : 'none';
                dropSec.style.display = typeSelect.value === 'dropdown' ? 'flex' : 'none';
                verSec.style.display = typeSelect.value === 'version_control' ? 'flex' : 'none';
                trafoSec.style.display = typeSelect.value === 'transformer_control' ? 'flex' : 'none';
                sigSec.style.display = typeSelect.value === 'signature_control' ? 'flex' : 'none';
                craneSec.style.display = typeSelect.value === 'crane_control' ? 'flex' : 'none';
                safetySec.style.display = typeSelect.value === 'safety_equipment_control' ? 'flex' : 'none';
                bearingSec.style.display = typeSelect.value === 'bearing_control' ? 'flex' : 'none';
                checkoutSec.style.display = typeSelect.value === 'final_checkout_control' ? 'flex' : 'none';
            }
        };

        w.renderAdvVersionList = () => {
            const listContainer = document.getElementById('adv-version-list');
            if (!listContainer) return;
            const items = w.currentAdvVersionItems || [];
            if (items.length === 0) {
                listContainer.innerHTML = '<div style="font-size:0.7rem; color:#8892b0; font-style:italic;">Henüz kart eklenmedi.</div>';
                return;
            }
            listContainer.innerHTML = items.map((vi: any, i: number) => `
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <input type="text" class="cyber-input" value="${vi.label || ''}" placeholder="Kart (Örn: Display)" oninput="window.updateAdvVersionItem(${i}, 'label', this.value)" style="flex: 1; height: 32px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; padding: 0 0.5rem; font-size: 0.75rem;">
                    <input type="text" class="cyber-input" value="${vi.expected || ''}" placeholder="Versiyon (Örn: 1.85)" oninput="window.updateAdvVersionItem(${i}, 'expected', this.value)" style="flex: 1; height: 32px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; padding: 0 0.5rem; font-size: 0.75rem;">
                    <div style="display: flex; flex-direction: column; gap: 2px;">
                        <button type="button" onclick="window.moveAdvVersionItem(${i}, -1)" ${i === 0 ? 'disabled' : ''} style="background: transparent; border: none; color: ${i === 0 ? 'rgba(255,255,255,0.2)' : 'var(--accent-cyan)'}; cursor: ${i === 0 ? 'default' : 'pointer'}; padding: 0; height: 14px;">
                            <i class="fa-solid fa-caret-up" style="font-size: 0.8rem;"></i>
                        </button>
                        <button type="button" onclick="window.moveAdvVersionItem(${i}, 1)" ${i === items.length - 1 ? 'disabled' : ''} style="background: transparent; border: none; color: ${i === items.length - 1 ? 'rgba(255,255,255,0.2)' : 'var(--accent-cyan)'}; cursor: ${i === items.length - 1 ? 'default' : 'pointer'}; padding: 0; height: 14px;">
                            <i class="fa-solid fa-caret-down" style="font-size: 0.8rem;"></i>
                        </button>
                    </div>
                    <button type="button" class="btn-cyber secondary" onclick="window.removeAdvVersionItem(${i})" style="width: 32px; height: 32px; min-width: 32px; padding: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,51,102,0.1); color: var(--accent-red); border: 1px solid rgba(255,51,102,0.2); border-radius: 4px;">
                        <i class="fa-solid fa-trash" style="font-size: 0.75rem;"></i>
                    </button>
                </div>
            `).join('');
        };
        
        w.moveAdvVersionItem = (idx: number, dir: -1 | 1) => {
            if (w.currentAdvVersionItems) {
                const newIdx = idx + dir;
                if (newIdx >= 0 && newIdx < w.currentAdvVersionItems.length) {
                    const temp = w.currentAdvVersionItems[idx];
                    w.currentAdvVersionItems[idx] = w.currentAdvVersionItems[newIdx];
                    w.currentAdvVersionItems[newIdx] = temp;
                    w.renderAdvVersionList();
                }
            }
        };
        
        w.addAdvVersionItem = () => {
            if (!w.currentAdvVersionItems) w.currentAdvVersionItems = [];
            w.currentAdvVersionItems.push({ label: '', expected: '' });
            w.renderAdvVersionList();
        };

        w.removeAdvVersionItem = (idx: number) => {
            if (w.currentAdvVersionItems) {
                w.currentAdvVersionItems.splice(idx, 1);
                w.renderAdvVersionList();
            }
        };

        w.updateAdvVersionItem = (idx: number, field: string, val: string) => {
            if (w.currentAdvVersionItems && w.currentAdvVersionItems[idx]) {
                w.currentAdvVersionItems[idx][field] = val;
            }
        };

        w.saveAdvSettings = (index: number, modalId: string) => {
            const items = w.smartAuditItems || [];
            if (index < 0 || index >= items.length) return;
            const type = (document.getElementById('adv-type') as HTMLSelectElement)?.value as any;
            
            let config: any = { type };
            if (type === 'numeric_multiple') {
                const countStr = (document.getElementById('adv-count') as HTMLInputElement)?.value;
                const minStr = (document.getElementById('adv-min') as HTMLInputElement)?.value;
                const maxStr = (document.getElementById('adv-max') as HTMLInputElement)?.value;
                const labelsStr = (document.getElementById('adv-labels') as HTMLInputElement)?.value || '';
                const reqSig = (document.getElementById('adv-numeric-sig') as HTMLInputElement)?.checked || false;
                
                config.inputCount = parseInt(countStr) || 1;
                config.unit = (document.getElementById('adv-unit') as HTMLInputElement)?.value || '';
                if (minStr !== '') config.minLimit = parseFloat(minStr);
                if (maxStr !== '') config.maxLimit = parseFloat(maxStr);
                
                if (labelsStr.trim()) {
                    config.measurementLabels = labelsStr.split(',').map(s => s.trim()).filter(s => s);
                }
                config.requireSignature = reqSig;
            } else if (type === 'dropdown') {
                const optStr = (document.getElementById('adv-options') as HTMLInputElement)?.value || '';
                const critStr = (document.getElementById('adv-critical') as HTMLInputElement)?.value || '';
                config.dropdownOptions = optStr.split(',').map(s => s.trim()).filter(s => s);
                config.criticalOptions = critStr.split(',').map(s => s.trim()).filter(s => s);
            } else if (type === 'version_control') {
                config.versionItems = (w.currentAdvVersionItems || []).map((vi: any) => ({
                    label: vi.label?.trim() || '',
                    expected: vi.expected?.trim() || ''
                })).filter((vi: any) => vi.label && vi.expected);
            } else if (type === 'safety_equipment_control') {
                const safetyTypeStr = (document.getElementById('adv-safety-type') as HTMLSelectElement)?.value as 'first_aid' | 'fire_extinguisher';
                config.safetyEquipmentType = safetyTypeStr;
            }

            items[index].measurementConfig = config;
            if (type !== 'standard') {
                items[index].requiresMeasurement = false;
            }
            
            document.getElementById(modalId)?.remove();
            w.renderSmartAuditUI();
        };

        w.checkMcfValidation = () => {
            const matFormNo = document.getElementById('mat-form-no') as HTMLInputElement;
            if (!matFormNo) return;
            
            const materials = w.getMaterialData ? w.getMaterialData() : [];
            const hasDeduction = materials.some((mat: any) => mat.type?.toUpperCase() === 'T' && mat.used > 0);
            const isMcfEmpty = !matFormNo.value.trim();
            
            if (hasDeduction && isMcfEmpty) {
                matFormNo.classList.add('mcf-warning-pulse');
            } else {
                matFormNo.classList.remove('mcf-warning-pulse');
            }
        };

        w.renderSmartAuditUI = async () => {
            const container = document.getElementById('smart-audit-container');
            if (!container) return;
            
            const isTemplateEditor = localStorage.getItem('currentEditingTemplateId') !== null;
            const templateData = isTemplateEditor ? w.currentEditingTemplate : null;
            
            const checklistItems = w.smartAuditItems || [];
            container.innerHTML = FaultFormUI.renderSmartAuditLayout(checklistItems, isTemplateEditor, templateData);

            // Update tab counter if exists
            const countEl = document.getElementById('audit-tab-count');
            if (countEl && !isTemplateEditor && w.smartAuditItems) {
                const completed = w.smartAuditItems.filter((i: any) => i.status && i.status !== 'PENDING').length;
                countEl.textContent = `(${completed}/${w.smartAuditItems.length})`;
            }
        };

        w.applyTimeMasks = () => {
            const timeInputs = document.querySelectorAll('input[oninput*="handleTimeInput"]');
            timeInputs.forEach(input => {
                const el = input as HTMLInputElement;
                el.addEventListener('blur', () => {
                    let val = el.value;
                    if (val && !val.includes(':') && val.length === 4) {
                        el.value = val.substring(0, 2) + ':' + val.substring(2);
                    }
                });
            });
        };

        w.searchTeamMembers = async (term: string) => {
            const dropdown = document.getElementById('team-search-results');
            if (!dropdown) return;
            if (term.length < 1) { dropdown.classList.add('hidden'); return; }
            
            const dbUsers = await userService.getAllUsers();
            const dbNames = dbUsers.map(u => u.displayName?.toUpperCase() || u.email?.split('@')[0].toUpperCase());
            
            const combinedList = Array.from(new Set([
                ...personnelList.map(name => name.toUpperCase()),
                ...dbNames
            ]));

            const filtered = combinedList.filter(name => name.toLowerCase().includes(term.toLowerCase())).sort();
            
            if (filtered.length === 0) { dropdown.classList.add('hidden'); return; }
            
            dropdown.classList.remove('hidden');
            dropdown.innerHTML = filtered.map(name => `
                <div class="search-item" onclick="window.addTeamMember('${name}')" style="padding: 0.6rem 1rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.7rem;" onmouseover="this.style.background='rgba(0,242,254,0.1)'" onmouseout="this.style.background=''">
                    <i class="fa-solid fa-user" style="margin-right: 8px; color: var(--accent-cyan); font-size: 0.6rem;"></i> ${name}
                </div>
            `).join('');
        };

        w.addGlobalPersonnelInput = () => {
            w.teamPersonnel.push("");
            w.renderGlobalPersonnelInputs();
            w.renderWorkSessionsUI();
            if (typeof w.saveMaintenanceDraft === 'function') w.saveMaintenanceDraft(true);
        };

        w.updateGlobalPersonnelName = (index: number, name: string) => {
            w.teamPersonnel[index] = name;
        };

        w.removeGlobalPersonnel = (index: number) => {
            w.teamPersonnel.splice(index, 1);
            w.renderGlobalPersonnelInputs();
            w.renderWorkSessionsUI();
            if (typeof w.saveMaintenanceDraft === 'function') w.saveMaintenanceDraft(true);
        };

        w.showPersonnelSuggestions = (idx: number, query: string) => {
            const container = document.getElementById(`personnel-dropdown-${idx}`);
            if (!container) return;

            const lowerQuery = (query || '').toLocaleLowerCase('tr-TR').trim();
            if (!lowerQuery) {
                container.style.display = 'none';
                return;
            }

            const matches = (personnelList as string[]).filter(name => name.toLocaleLowerCase('tr-TR').includes(lowerQuery));

            if (matches.length === 0) {
                container.style.display = 'none';
                return;
            }

            container.style.display = 'block';
            container.innerHTML = matches.slice(0, 8).map(name => `
                <div class="search-item" style="padding: 0.5rem 0.75rem; font-size: 0.75rem; color: #ffffff; cursor: pointer; transition: background 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" 
                     onmouseover="this.style.background='rgba(0, 242, 254, 0.15)'" 
                     onmouseout="this.style.background='transparent'"
                     onmousedown="window.selectPersonnelSuggestion(${idx}, '${name.replace(/'/g, "\\'")}')">
                    ${name}
                </div>
            `).join('');
        };

        w.checkDuplicatePersonnel = (idx: number, val: string) => {
            const trimmed = (val || '').trim();
            if (!trimmed) return;
            const normalizedNew = trimmed.toLocaleLowerCase('tr-TR');
            const exists = w.teamPersonnel.some((p: string, i: number) => i !== idx && p.trim().toLocaleLowerCase('tr-TR') === normalizedNew);
            if (exists) {
                alert(`"${trimmed}" zaten eklenmiş durumda!`);
                w.teamPersonnel[idx] = "";
                w.renderGlobalPersonnelInputs();
                w.renderWorkSessionsUI();
                if (typeof w.saveMaintenanceDraft === 'function') {
                    w.saveMaintenanceDraft(true);
                }
            }
        };

        w.selectPersonnelSuggestion = (idx: number, name: string) => {
            const normalizedNew = name.trim().toLocaleLowerCase('tr-TR');
            const exists = w.teamPersonnel.some((p: string, i: number) => i !== idx && p.trim().toLocaleLowerCase('tr-TR') === normalizedNew);
            if (exists) {
                alert(`"${name}" zaten eklenmiş durumda!`);
                const el = document.getElementById(`personnel-dropdown-${idx}`);
                if (el) el.style.display = 'none';
                return;
            }
            w.teamPersonnel[idx] = name;
            w.renderGlobalPersonnelInputs();
            w.renderWorkSessionsUI();
            if (typeof w.saveMaintenanceDraft === 'function') {
                w.saveMaintenanceDraft(true);
            }
        };

        w.renderGlobalPersonnelInputs = () => {
            const container = document.getElementById('global-personnel-inputs-container');
            if (!container) return;
            container.innerHTML = w.teamPersonnel.map((p: string, idx: number) => `
                <div class="glass-panel" style="display: flex; align-items: center; gap: 0.4rem; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); padding: 0 6px 0 8px; border-radius: 4px; transition: border-color 0.2s; height: 28px !important; min-height: 28px !important; box-sizing: border-box; position: relative;" onmouseover="this.style.borderColor='rgba(0, 242, 254, 0.2)'" onmouseout="this.style.borderColor='rgba(255, 255, 255, 0.08)'">
                    <input type="text" style="width: 125px !important; height: 20px !important; font-size: 0.75rem !important; border: none !important; background: transparent !important; color: #ffffff !important; padding: 0 !important; outline: none !important; margin: 0 !important; font-weight: 500; font-family: inherit; box-shadow: none !important;" placeholder="İsim..." value="${p || ''}" 
                           onfocus="window.showPersonnelSuggestions(${idx}, this.value)"
                           oninput="window.updateGlobalPersonnelName(${idx}, this.value); window.showPersonnelSuggestions(${idx}, this.value)" 
                           onblur="setTimeout(() => { const el = document.getElementById('personnel-dropdown-${idx}'); if (el) el.style.display = 'none'; }, 200); window.checkDuplicatePersonnel(${idx}, this.value); if(typeof window.saveMaintenanceDraft === 'function') window.saveMaintenanceDraft(true); if(typeof window.renderWorkSessionsUI === 'function') window.renderWorkSessionsUI();">
                    <button type="button" style="background: transparent; border: none; color: var(--accent-red); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" onclick="window.removeGlobalPersonnel(${idx})" title="Personeli Kaldır">
                        <i class="fa-solid fa-xmark" style="font-size: 0.75rem;"></i>
                    </button>
                    <div id="personnel-dropdown-${idx}" class="search-results-dropdown" style="display: none; position: absolute; top: 100%; left: 0; width: 100%; max-height: 180px; overflow-y: auto; z-index: 1000; margin-top: 4px; background: rgba(10, 20, 30, 0.98); border: 1px solid var(--accent-cyan); border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.5); padding: 2px 0;"></div>
                </div>
            `).join('');
        };

        w.renderWorkSessionsUI = () => {
            const container = document.getElementById('work-sessions-container');
            if (container) {
                const sessions = w.workSessions || [];
                if (sessions.length === 0) {
                    container.innerHTML = `
                        <div style="text-align: center; color: var(--text-muted); padding: 1.5rem; font-size: 0.75rem; font-style: italic;">
                            Henüz çalışma zamanı eklenmedi.
                        </div>
                    `;
                } else {
                    let html = `
                    <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%; padding-bottom: 0.5rem; margin-bottom: 0.2rem;">
                        <div style="min-width: 850px; display: flex; flex-direction: column; gap: 0.35rem; width: 100%;">
                            <div style="display: flex; gap: 0.5rem; align-items: center; padding: 0.2rem 0.5rem; font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.03); width: 100%; min-width: 850px; box-sizing: border-box;">
                                <div style="flex: 1.5; min-width: 130px; padding-left: 2px;">Personel</div>
                                <div style="flex: 1.5; min-width: 120px;">Kayıt Türü</div>
                                <div style="flex: 1.2; min-width: 120px;">Tarih</div>
                                <div style="flex: 0.8; min-width: 85px; text-align: center;">Başlangıç</div>
                                <div style="flex: 0.8; min-width: 85px; text-align: center;">Bitiş</div>
                                <div style="flex: 2.5; min-width: 160px;">Açıklama</div>
                                <div style="width: 80px; text-align: center; flex-shrink: 0;">AKSİYON</div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 0.35rem; width: 100%; min-width: 850px;">
                                ${sessions.map((ws: any, index: number) => 
                                    FaultFormUI.renderWorkSessionRow(ws, index === sessions.length - 1)
                                ).join('')}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Saat Seçenekleri Datalist'i -->
                    <datalist id="time-options">
                        ${Array.from({ length: 48 }, (_, i) => {
                            const h = Math.floor(i / 2).toString().padStart(2, '0');
                            const m = (i % 2 === 0 ? '00' : '30');
                            return `<option value="${h}:${m}"></option>`;
                        }).join('')}
                    </datalist>
                    `;
                    container.innerHTML = html;
                }
            }

            if (typeof w.applyTimeMasks === 'function') w.applyTimeMasks();
            if (typeof w.calculateTotalManHours === 'function') w.calculateTotalManHours();
        };

        w.togglePersonnelInSession = (sessionId: string, name: string) => {
            const ws = w.workSessions.find((s: any) => s.id === sessionId);
            if (ws) {
                ws.personnel = [name];
                w.calculateTotalManHours();
                w.renderWorkSessionsUI();
                if (typeof w.saveMaintenanceDraft === 'function') {
                    w.saveMaintenanceDraft(true);
                }
            }
        };

        w.lockWorkSession = (sessionId: string) => {
            const ws = w.workSessions.find((s: any) => s.id === sessionId);
            if (ws) {
                const activeRoster = w.teamPersonnel ? [...w.teamPersonnel].filter(p => p && p.trim() !== '') : [];
                if (ws.locked !== true && activeRoster.length > 0) {
                    ws.personnel = activeRoster;
                }
                ws.locked = true;
                w.calculateTotalManHours();
                w.renderWorkSessionsUI();
                if (typeof w.saveMaintenanceDraft === 'function') {
                    w.saveMaintenanceDraft(true);
                }
            }
        };

        w.addWorkSession = (type: string = 'ÇALIŞMA') => {
            const activeRoster = w.teamPersonnel ? [...w.teamPersonnel].filter(p => p && p.trim() !== '') : [];
            if (activeRoster.length === 0) {
                alert("Lütfen önce yukarıdaki alandan en az bir personel ekleyiniz!");
                return;
            }

            if (!w.workSessions) w.workSessions = [];
            
            if (w.workSessions.length > 0) {
                const lastSession = w.workSessions[w.workSessions.length - 1];
                if (!lastSession.startTime || !lastSession.endTime || lastSession.startTime.trim() === '' || lastSession.endTime.trim() === '') {
                    alert("Lütfen bir sonraki satıra geçmeden önce mevcut satırın Başlangıç ve Bitiş saatlerini doldurunuz!");
                    return;
                }
                // FREEZE the previous last session's personnel list to the current active team and lock it!
                if (lastSession.locked !== true && activeRoster.length > 0) {
                    lastSession.personnel = activeRoster;
                }
                lastSession.locked = true;
            }

            const formDateEl = document.getElementById('form-date') as HTMLInputElement;
            let defaultDate = formDateEl ? formDateEl.value : new Date().toISOString().split('T')[0];
            let defaultStartTime = '';
            if (w.workSessions.length > 0) {
                const prev = w.workSessions[w.workSessions.length - 1];
                defaultDate = prev.date || defaultDate;
                defaultStartTime = prev.endTime || '';
            }

            w.workSessions.push({
                id: Date.now().toString(),
                date: defaultDate,
                startTime: defaultStartTime,
                endTime: '',
                personnel: activeRoster,
                duration: '00:00',
                type: type,
                isOffDay: false,
                comment: ''
            });
            w.renderWorkSessionsUI();
            
            if (typeof w.saveMaintenanceDraft === 'function') {
                w.saveMaintenanceDraft(true);
            }
        };

        w.quickAddSession = (type: string) => {
            w.addWorkSession(type);
        };

        w.syncSessionsPersonnelAndDate = () => {
            if (!w.workSessions || w.workSessions.length <= 1) return;
            const first = w.workSessions[0];
            const targetPersonnel = first.personnel ? [...first.personnel] : [];
            const targetDate = first.date || new Date().toISOString().split('T')[0];

            w.workSessions.forEach((ws: any, idx: number) => {
                if (idx > 0) {
                    ws.personnel = [...targetPersonnel];
                    ws.date = targetDate;
                }
            });

            w.renderWorkSessionsUI();
            if (typeof w.saveMaintenanceDraft === 'function') {
                w.saveMaintenanceDraft(true);
            }
            alert("Tüm çalışma zamanları 1. satırdaki tarih ve personel ile eşitlendi!");
        };

        w.removeWorkSession = (id: string) => {
            w.workSessions = w.workSessions.filter((s: any) => s.id !== id);
            w.renderWorkSessionsUI();
            if (typeof w.saveMaintenanceDraft === 'function') {
                w.saveMaintenanceDraft(true);
            }
        };

        w.updateSessionField = (id: string, field: string, value: any, silent = false) => {
            const ws = w.workSessions.find((s: any) => s.id === id);
            if (ws) {
                if ((field === 'startTime' || field === 'endTime') && value && typeof value === 'string') {
                    value = value.replace(/[.,]/g, ':');
                    if (/^\d{4}$/.test(value)) {
                        value = value.substring(0, 2) + ':' + value.substring(2);
                    }
                }

                ws[field] = value;
                
                if (field === 'startTime' || field === 'endTime') {
                    ws.duration = w.calculateSessionDuration(ws.startTime, ws.endTime);
                }

                w.calculateTotalManHours();
                
                // Do not re-render the entire table UI for date, startTime, or endTime to prevent losing input cursor focus while typing
                if (!silent && (field === 'type' || field === 'personnel')) {
                    w.renderWorkSessionsUI();
                }

                if (typeof w.saveMaintenanceDraft === 'function') {
                    w.saveMaintenanceDraft(true);
                }
            }
        };

        w.handleTimeInput = (input: HTMLInputElement, event: any) => {
            let val = input.value;
            val = val.replace(/[^0-9]/g, '');
            if (val.length >= 2) {
                val = val.substring(0, 2) + ':' + val.substring(2);
            }
            if (val.length > 5) {
                val = val.substring(0, 5);
            }
            input.value = val;
        };

        w.calculateSessionDuration = (start: string, end: string) => {
            if (!start || !end) return '00:00';
            const [h1, m1] = start.split(':').map(Number);
            const [h2, m2] = end.split(':').map(Number);
            let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (diff < 0) diff += 1440;
            const h = Math.floor(diff / 60);
            const m = diff % 60;
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        };
        
        w.addPersonnelToSession = (sessionId: string, name: string) => {
            const ws = w.workSessions.find((s: any) => s.id === sessionId);
            if (ws) {
                if (!ws.personnel) ws.personnel = [];
                if (!ws.personnel.includes(name)) {
                    ws.personnel.push(name);
                    w.calculateTotalManHours();
                    w.renderWorkSessionsUI();
                    if (typeof w.saveMaintenanceDraft === 'function') {
                        w.saveMaintenanceDraft(true);
                    }
                }
            }
        };

        w.removePersonnelFromSession = (sessionId: string, name: string) => {
            const ws = w.workSessions.find((s: any) => s.id === sessionId);
            if (ws) {
                ws.personnel = (ws.personnel || []).filter((p: string) => p !== name);
                w.calculateTotalManHours();
                w.renderWorkSessionsUI();
                if (typeof w.saveMaintenanceDraft === 'function') {
                    w.saveMaintenanceDraft(true);
                }
            }
        };

        w.updateSessionPersonnel = (sessionId: string, index: number, newName: string) => {
            const ws = w.workSessions.find((s: any) => s.id === sessionId);
            if (ws) {
                if (!ws.personnel) ws.personnel = [];
                ws.personnel[index] = newName;
                w.calculateTotalManHours();
                w.renderWorkSessionsUI();
                if (typeof w.saveMaintenanceDraft === 'function') {
                    w.saveMaintenanceDraft(true);
                }
            }
        };

        w.removeSessionPersonnelAtIndex = (sessionId: string, index: number) => {
            const ws = w.workSessions.find((s: any) => s.id === sessionId);
            if (ws) {
                if (ws.personnel) {
                    ws.personnel.splice(index, 1);
                    w.calculateTotalManHours();
                    w.renderWorkSessionsUI();
                    if (typeof w.saveMaintenanceDraft === 'function') {
                        w.saveMaintenanceDraft(true);
                    }
                }
            }
        };

        w.addBlankPersonnelToSession = (sessionId: string) => {
            const ws = w.workSessions.find((s: any) => s.id === sessionId);
            if (ws) {
                if (!ws.personnel) ws.personnel = [];
                
                const masterList = Array.from(new Set([
                    ...(w.teamPersonnel || []),
                    ...personnelList
                ])).sort();
                
                const defaultTech = masterList[0] || "Fatih ZEBEK";
                ws.personnel.push(defaultTech);
                
                w.calculateTotalManHours();
                w.renderWorkSessionsUI();
                if (typeof w.saveMaintenanceDraft === 'function') {
                    w.saveMaintenanceDraft(true);
                }
            }
        };

        w.calculateTotalManHours = () => {
            let firstStart: any = null;
            let lastEnd: any = null;
            let totalRoadHours = 0;
            let totalNormalManHours = 0;
            let totalOvertimeManHours = 0;
            let totalManHours = 0;

            (w.workSessions || []).forEach((ws: any) => {
                const [h, m] = (ws.duration || '00:00').split(':').map(Number);
                const durationH = h + (m / 60);
                
                const personnelCount = ws.personnel?.length || 0;
                
                // Turbine downtime boundaries: only for type ÇALIŞMA, WORK, or BEKLEME
                if (ws.type === 'ÇALIŞMA' || ws.type === 'WORK' || ws.type === 'BEKLEME') {
                    if (ws.date && ws.startTime && ws.endTime) {
                        const startDt = new Date(`${ws.date}T${ws.startTime}:00`);
                        let endDt = new Date(`${ws.date}T${ws.endTime}:00`);
                        if (!isNaN(startDt.getTime()) && !isNaN(endDt.getTime())) {
                            if (endDt.getTime() < startDt.getTime()) {
                                endDt = new Date(endDt.getTime() + 24 * 60 * 60 * 1000);
                            }
                            if (!firstStart || startDt < firstStart) {
                                firstStart = startDt;
                            }
                            if (!lastEnd || endDt > lastEnd) {
                                lastEnd = endDt;
                            }
                        }
                    }
                }
                
                // Road hours: only for type GİDİŞ YOLU, DÖNÜŞ YOLU, TRAVEL, EVDEN TÜRBİNE, or TÜRBİNDEN EVE
                if (ws.type === 'GİDİŞ YOLU' || ws.type === 'DÖNÜŞ YOLU' || ws.type === 'TRAVEL' || ws.type === 'EVDEN TÜRBİNE' || ws.type === 'TÜRBİNDEN EVE') {
                    totalRoadHours += durationH;
                }

                // Overtime calculation
                const ot = DateTimeUtils.calculateOvertimeHours(
                    ws.date || new Date().toISOString().split('T')[0],
                    ws.startTime || '00:00',
                    ws.endTime || '00:00',
                    ws.isOffDay || false
                );
                const overtimeH = Math.min(durationH, ot);
                const normalH = Math.max(0, durationH - overtimeH);

                totalNormalManHours += normalH * personnelCount;
                totalOvertimeManHours += overtimeH * personnelCount;
                totalManHours += durationH * personnelCount;
            });

            let totalTurbineHours = 0;
            if (firstStart && lastEnd) {
                totalTurbineHours = (lastEnd.getTime() - firstStart.getTime()) / (1000 * 60 * 60);
            }

            const formatHHMM = (decimalHours: number) => {
                if (isNaN(decimalHours) || decimalHours < 0) return '0 SA 00 DK';
                const totalMinutes = Math.round(decimalHours * 60);
                const h = Math.floor(totalMinutes / 60);
                const m = totalMinutes % 60;
                return `${h} SA ${m.toString().padStart(2, '0')} DK`;
            };

            const thEl = document.getElementById('total-turbine-hours-display');
            const rhEl = document.getElementById('total-road-hours-display');
            const nmEl = document.getElementById('total-normal-man-hours-display');
            const omEl = document.getElementById('total-overtime-man-hours-display');
            const tmEl = document.getElementById('total-man-hours-display');

            if (thEl) thEl.innerText = formatHHMM(totalTurbineHours);
            if (rhEl) rhEl.innerText = formatHHMM(totalRoadHours);
            if (nmEl) nmEl.innerText = formatHHMM(totalNormalManHours);
            if (omEl) omEl.innerText = formatHHMM(totalOvertimeManHours);
            if (tmEl) tmEl.innerText = formatHHMM(totalManHours);
        };

        w.searchFaultCodes = async (term: string) => {
            const dropdown = document.getElementById('form-fault-results');
            if (!dropdown) return;
            if (term.length < 1) { dropdown.classList.add('hidden'); return; }
            
            const exact = statusService.getCodeByKod(term);
            if (exact) {
                w.selectFormFault(exact.KOD);
                dropdown.classList.add('hidden');
                return;
            }

            const results = statusService.searchCodes(term);
            if (results.length === 0) { dropdown.classList.add('hidden'); return; }
            
            dropdown.classList.remove('hidden');
            dropdown.innerHTML = results.map((r: any) => `
                <div class="search-item" onclick="window.selectFormFault('${r.KOD}')" style="padding: 0.8rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.75rem;" onmouseover="this.style.background='rgba(0,242,254,0.1)'" onmouseout="this.style.background=''">
                    <span style="color: var(--accent-cyan); font-weight: 700;">${r.KOD}</span> - ${r.Aciklama}
                </div>
            `).join('');
        };

        w.selectFormFault = async (kod: string) => {
            const input = document.getElementById('form-fault-search') as HTMLInputElement;
            const desc = document.getElementById('ariza-tanimi') as HTMLTextAreaElement;
            const dropdown = document.getElementById('form-fault-results');
            const exact = statusService.getCodeByKod(kod);
            if (input && exact) {
                input.value = exact.KOD;
                if (desc) desc.value = exact.Aciklama;
                if (dropdown) dropdown.classList.add('hidden');
            }
        };

        w.handleSerialLookup = async (serial: string) => {
            if (!serial) return;
            const turbine = dataService.findTurbineBySerial(serial);
            
            const siteNameEl = document.getElementById('form-site-name') as HTMLInputElement;
            const turbineNoEl = document.getElementById('turbin-no') as HTMLInputElement;
            const siteIdEl = document.getElementById('form-site') as HTMLInputElement;
            
            if (turbine) {
                const oldSiteId = siteIdEl?.value;
                if (siteNameEl) siteNameEl.value = turbine.siteName || '';
                if (turbineNoEl) turbineNoEl.value = turbine.turbineNo || '';
                if (siteIdEl) siteIdEl.value = turbine.siteId || '';

                if (oldSiteId !== turbine.siteId) {
                    const sapInputs = document.querySelectorAll('#material-rows input[oninput*="handleSapLookup"]');
                    sapInputs.forEach(input => {
                        if (w.handleSapLookup) w.handleSapLookup(input as HTMLInputElement);
                    });
                }
            }
        };






        w.handleTemplateSave = async () => {
            const templateId = localStorage.getItem('currentEditingTemplateId');
            if (!templateId) {
                alert("Şablon ID bulunamadı!");
                return;
            }
            
            const nameInput = document.getElementById('template-name-input') as HTMLInputElement;
            const codeInput = document.getElementById('template-code-input') as HTMLInputElement;
            
            const saveBtn = document.querySelector('.btn-cyber[onclick="window.handleTemplateSave()"]') as HTMLButtonElement;
            const orgHtml = saveBtn ? saveBtn.innerHTML : 'ŞABLONU KAYDET';
            
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> KAYDEDİLİYOR...';
            }
            
            try {
                const finalName = nameInput ? nameInput.value.trim() : (w.currentEditingTemplate?.name || '');
                const finalCode = codeInput ? codeInput.value.trim() : (w.currentEditingTemplate?.instructionCode || '');
                
                await maintenanceService.updateTemplate(templateId, { 
                    name: finalName || 'Yeni Şablon',
                    instructionCode: finalCode || '',
                    checklist: w.smartAuditItems || []
                });
                
                alert("Şablon başarıyla güncellendi.");
                localStorage.removeItem('currentEditingTemplateId');
                w.navigate('templates');
            } catch (error: any) {
                console.error("Şablon kaydetme hatası:", error);
                alert("Hata: " + error.message);
            } finally {
                if (saveBtn) {
                    saveBtn.disabled = false;
                    saveBtn.innerHTML = orgHtml;
                }
            }
        };

        w.switchFormTab = (tab: string) => {
            const service = document.getElementById('tab-content-service');
            const audit = document.getElementById('tab-content-audit');
            const btnService = document.getElementById('tab-btn-service');
            const btnAudit = document.getElementById('tab-btn-audit');

            if (tab === 'service') {
                if (service) service.style.display = 'block';
                if (audit) audit.style.display = 'none';
                if (btnService) { btnService.classList.add('active'); btnService.style.background = 'rgba(0, 242, 254, 0.1)'; btnService.style.color = '#fff'; btnService.style.borderColor = 'rgba(0, 242, 254, 0.3)'; }
                if (btnAudit) { btnAudit.classList.remove('active'); btnAudit.style.background = 'rgba(255,255,255,0.02)'; btnAudit.style.color = 'var(--text-muted)'; btnAudit.style.borderColor = 'rgba(255,255,255,0.05)'; }
            } else {
                if (service) service.style.display = 'none';
                if (audit) audit.style.display = 'block';
                if (btnService) { btnService.classList.remove('active'); btnService.style.background = 'rgba(255,255,255,0.02)'; btnService.style.color = 'var(--text-muted)'; btnService.style.borderColor = 'rgba(255,255,255,0.05)'; }
                if (btnAudit) { btnAudit.classList.add('active'); btnAudit.style.background = 'rgba(0, 242, 254, 0.1)'; btnAudit.style.color = '#fff'; btnAudit.style.borderColor = 'rgba(0, 242, 254, 0.3)'; }
                if (typeof w.renderSmartAuditUI === 'function') w.renderSmartAuditUI();
            }
        };

        w.selectedFaultFiles = [];
        w.handleImagePreviews = async (input: HTMLInputElement) => {
            if (!input.files) return;
            const files = Array.from(input.files);
            const container = document.getElementById('image-previews');
            const noMsg = document.getElementById('no-photo-msg');
            
            if (files.length + w.selectedFaultFiles.length > 5) {
                alert("En fazla 5 fotoğraf yükleyebilirsiniz.");
                input.value = '';
                return;
            }
            
            if (files.length > 0 && noMsg) noMsg.style.display = 'none';

            // Find the photo add button to update its loading state
            const addBtn = document.querySelector('button[onclick*="fault-images"]') as HTMLButtonElement;
            const originalBtnHtml = addBtn ? addBtn.innerHTML : '';
            if (addBtn) {
                addBtn.disabled = true;
                addBtn.style.opacity = '0.7';
                addBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> SIKIŞTIRILIYOR...';
            }
            
            try {
                for (const file of files) {
                    // Compress client-side with 2400px max bounds and 92% quality
                    const compressedFile = await ImageCompressor.compressImage(file, 2400, 2400, 0.92);
                    w.selectedFaultFiles.push(compressedFile);

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const wrapper = document.createElement('div');
                        wrapper.style.position = 'relative';
                        wrapper.style.width = '60px';
                        wrapper.style.height = '60px';
                        wrapper.style.borderRadius = '8px';
                        wrapper.style.overflow = 'hidden';
                        wrapper.style.border = '1px solid rgba(255,255,255,0.1)';
                        
                        const img = document.createElement('img');
                        img.src = e.target?.result as string;
                        img.style.width = '100%';
                        img.style.height = '100%';
                        img.style.objectFit = 'cover';
                        
                        // Premium KB size indicator badge
                        const sizeBadge = document.createElement('div');
                        sizeBadge.style.cssText = 'position:absolute; bottom:0; left:0; width:100%; background:rgba(0,0,0,0.7); color:var(--accent-cyan); font-size:7px; text-align:center; font-weight:bold; padding:2px 0; border-top:1px solid rgba(255,255,255,0.1); font-family:var(--font-cyber); pointer-events:none;';
                        sizeBadge.textContent = `${Math.round(compressedFile.size / 1024)} KB`;
                        
                        const btn = document.createElement('button');
                        btn.innerHTML = '<i class="fa-solid fa-times"></i>';
                        btn.style.cssText = 'position:absolute; top:2px; right:2px; background:var(--accent-red); color:white; border:none; border-radius:50%; width:16px; height:16px; font-size:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; z-index:2;';
                        btn.onclick = () => {
                            wrapper.remove();
                            w.selectedFaultFiles = w.selectedFaultFiles.filter((f: File) => f !== compressedFile);
                            if (w.selectedFaultFiles.length === 0 && noMsg) noMsg.style.display = 'block';
                        };
                        
                        wrapper.appendChild(img);
                        wrapper.appendChild(sizeBadge);
                        wrapper.appendChild(btn);
                        if (container) container.appendChild(wrapper);
                    };
                    reader.readAsDataURL(compressedFile);
                }
            } catch (err) {
                console.error("Görsel sıkıştırma hatası:", err);
                alert("Fotoğraflar işlenirken bir hata oluştu.");
            } finally {
                if (addBtn) {
                    addBtn.disabled = false;
                    addBtn.style.opacity = '1';
                    addBtn.innerHTML = originalBtnHtml;
                }
                input.value = '';
            }
        };

        w.addMaterialRow = (sData?: any, tData?: any) => {
            const tbody = document.getElementById('material-rows');
            if (tbody) {
                const poz = Math.floor(tbody.children.length / 2) + 1;
                const trS = document.createElement('tbody');
                trS.innerHTML = FaultFormUI.renderMaterialRow(poz, 'S', sData);
                const trT = document.createElement('tbody');
                trT.innerHTML = FaultFormUI.renderMaterialRow(poz, 'T', tData);
                tbody.appendChild(trS.firstElementChild!);
                tbody.appendChild(trT.firstElementChild!);
                if (typeof w.checkMcfValidation === 'function') w.checkMcfValidation();
            }
        };

        w.removeSelectedMaterials = () => {
            const tbody = document.getElementById('material-rows');
            if (tbody && tbody.children.length > 2) {
                tbody.removeChild(tbody.lastElementChild!);
                tbody.removeChild(tbody.lastElementChild!);
                if (typeof w.checkMcfValidation === 'function') w.checkMcfValidation();
            } else {
                alert("En az bir malzeme satırı (Poz 1) bulunmalıdır.");
            }
        };

        w.getMaterialData = () => {
            return Array.from(document.querySelectorAll('#material-rows tr')).map(row => {
                const cells = (row as HTMLTableRowElement).cells;
                const inputs = row.querySelectorAll('input');
                if (inputs.length < 7) return null;
                const sapNo = inputs[0].value.trim();
                const type = (row as HTMLElement).getAttribute('data-type') || '';
                return {
                    poz: cells[0]?.textContent?.trim() || '',
                    type: type.toUpperCase(),
                    sapNo: sapNo,
                    serialNo: inputs[1].value.trim(),
                    description: inputs[2].value.trim(),
                    received: parseFloat(inputs[3].value) || 0,
                    returned: parseFloat(inputs[4].value) || 0,
                    used: parseFloat(inputs[5].value) || 0,
                    defectCount: parseFloat(inputs[6].value) || 0
                };
            }).filter(e => e !== null);
        };

        w.saveMaintenanceDraft = async (isSilent = false) => {
            const currentTask = w.currentTaskContext;
            if (!currentTask?.id) return;
            
            const btn = document.getElementById('save-draft-btn') as HTMLButtonElement;
            if (!isSilent && btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> KAYDEDİLİYOR...'; btn.disabled = true; }
            
            try {
                                const updatedSessions = (w.workSessions || []).map((s: any, idx: number) => {
                    const isSessionLocked = s.locked === true || !(idx === (w.workSessions.length - 1));
                    const activeRoster = (w.teamPersonnel || []).filter((p: string) => p && p.trim() !== '');
                    let rowPersonnel = activeRoster;
                    if (isSessionLocked) {
                        rowPersonnel = Array.isArray(s.personnel) && s.personnel.length > 0 ? s.personnel : [];
                        if (rowPersonnel.length === 0) rowPersonnel = typeof s.personnel === 'string' ? [s.personnel] : ['-- Personel Yok --'];
                    } else {
                        rowPersonnel = activeRoster.length > 0 ? activeRoster : (s.personnel && s.personnel.length > 0 ? s.personnel : []);
                    }
                    return {
                        ...s,
                        personnel: rowPersonnel
                    };
                });
                w.workSessions = updatedSessions;

                const data = {
                    checklist: w.smartAuditItems || [],
                    workSessions: updatedSessions,
                    teamPersonnel: w.teamPersonnel || [],
                    materials: w.getMaterialData ? w.getMaterialData() : [],
                    notes: (document.getElementById('form-notes') as HTMLTextAreaElement)?.value || '',
                    matFormNo: (document.getElementById('mat-form-no') as HTMLInputElement)?.value || ''
                };

                await auditService.saveMaintenanceDraft(currentTask, data, isSilent);
                if (!isSilent) alert("Bakım taslağı başarıyla kaydedildi.");
            } catch (err: any) {
                if (!isSilent) alert("Taslak kaydedilirken hata oluştu: " + err.message);
            } finally {
                if (!isSilent && btn) { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> TASLAĞI KAYDET'; btn.disabled = false; }
            }
        };

        w.submitFaultForm = async () => {
            const btn = document.getElementById('submit-form-btn') as HTMLButtonElement;
            if (!btn) return;
            const orgHtml = btn.innerHTML;
            btn.disabled = true;
            
            const setBtnStatus = (msg: string) => {
                btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${msg}`;
            };
            
            setBtnStatus('KONTROLLER YAPILIYOR...');

            try {
                const currentTask = w.currentTaskContext;
                const turbineSerial = (document.getElementById('turbin-seri') as HTMLInputElement).value.trim();
                const siteId = (document.getElementById('form-site') as HTMLInputElement).value.trim();
                const siteName = (document.getElementById('form-site-name') as HTMLInputElement).value.trim();
                const faultCodeInput = document.getElementById('form-fault-search') as HTMLInputElement;
                const faultCode = faultCodeInput ? faultCodeInput.value.trim() : '';
                const faultDescEl = document.getElementById('ariza-tanimi') as HTMLTextAreaElement;
                const faultDesc = faultDescEl ? faultDescEl.value.trim() : '';
                
                const isMaintenance = (w.smartAuditItems && w.smartAuditItems.length > 0) || (currentTask?.type === 'BAKIM') || (currentTask?.type === 'EKSİKLİK');
                const isDeficiency = currentTask?.type === 'EKSİKLİK';
                
                if (!isMaintenance && !isDeficiency && !faultCode) throw new Error("Lütfen bir Arıza Kodu seçiniz.");
                
                const materials = w.getMaterialData();
                const matFormNoEl = document.getElementById('mat-form-no') as HTMLInputElement;
                const matFormNo = matFormNoEl ? matFormNoEl.value.trim() : '';
                
                const hasDeduction = materials.some((mat: any) => mat.type?.toUpperCase() === 'T' && mat.used > 0);
                if (hasDeduction && !matFormNo) throw new Error("Malzeme sarfiyatı mevcut (Takılan > 0). Lütfen MÇF NO (Malzeme Çıkış Form No) giriniz.");

                                const activeTeam = (w.teamPersonnel || []).filter((p: string) => p && p.trim() !== '');
                
                const workSessions = (w.workSessions || []).map((ws: any, idx: number) => {
                    const isSessionLocked = ws.locked === true || !(idx === (w.workSessions.length - 1));
                    let rowPersonnel = activeTeam;
                    if (isSessionLocked) {
                        rowPersonnel = Array.isArray(ws.personnel) && ws.personnel.length > 0 ? ws.personnel : [];
                        if (rowPersonnel.length === 0) rowPersonnel = typeof ws.personnel === 'string' ? [ws.personnel] : ['-- Personel Yok --'];
                    } else {
                        rowPersonnel = activeTeam.length > 0 ? activeTeam : (ws.personnel && ws.personnel.length > 0 ? ws.personnel : []);
                    }
                    return {
                        ...ws,
                        personnel: rowPersonnel
                    };
                });
                w.workSessions = workSessions;
                
                const personnel = Array.from(new Set(workSessions.flatMap((ws: any) => ws.personnel || []))).filter((p: any) => p && typeof p === 'string' && p.trim() !== '');
                if (personnel.length === 0) throw new Error("Lütfen en az bir personel ismi giriniz.");

                const auditItems = w.smartAuditItems || [];
                
                // Check if all checklist items have been evaluated (not left as default SEÇİNİZ)
                if (isMaintenance && auditItems.length > 0) {
                    const unselectedItems = auditItems.filter((i: any) => !i.status || i.status === '' || i.status === 'PENDING');
                    if (unselectedItems.length > 0) {
                        throw new Error(`Eksik madde var! ${auditItems.length} bakım kontrol maddesinden ${unselectedItems.length} tanesi henüz değerlendirilmemiş (SEÇİNİZ olarak kalmış). Tüm maddeleri "Tamamlandı", "Tamamlanmadı" veya "Opsiyon Dışı" olarak işaretlemeniz gerekmektedir.`);
                    }
                }
                
                const missingComments = auditItems.filter((i: any) => i.status === 'NOT_OK' && (!i.comment || i.comment.trim().length < 5));
                if (missingComments.length > 0) {
                    throw new Error(`Tamamlanamayan ${missingComments.length} adet madde için açıklama girilmesi zorunludur (En az 5 karakter).`);
                }

                const currentUser = (window as any).currentUser;

                // Calculate checklist accuracy / anti-cheat metrics if it is a maintenance report
                let auditMetrics: any = null;
                if (isMaintenance && auditItems.length > 0) {
                    const tracking = w.auditTracking || { formOpenedTime: Date.now(), clicks: [] };
                    const clicks = tracking.clicks || [];
                    
                    // Sort clicks by timestamp just in case
                    clicks.sort((a: any, b: any) => a.timestamp - b.timestamp);
                    
                    const clickCount = clicks.length;
                    const intervals: number[] = [];
                    
                    for (let i = 1; i < clicks.length; i++) {
                        const diff = clicks[i].timestamp - clicks[i - 1].timestamp;
                        intervals.push(diff);
                    }
                    
                    const totalFillTimeSeconds = Math.round((Date.now() - tracking.formOpenedTime) / 1000);
                    
                    // Calculate click speed statistics
                    let averageClickIntervalMs = 0;
                    let fastestClickIntervalMs = 0;
                    let slowestClickIntervalMs = 0;
                    
                    if (intervals.length > 0) {
                        const sum = intervals.reduce((acc: number, val: number) => acc + val, 0);
                        averageClickIntervalMs = Math.round(sum / intervals.length);
                        fastestClickIntervalMs = Math.min(...intervals);
                        slowestClickIntervalMs = Math.max(...intervals);
                    }
                    
                    // Detect consecutive identical statuses clicked very fast (bulk-clicking signature)
                    let maxConsecutiveFastSameStatus = 0;
                    let currentConsecutiveFastSameStatus = 1;
                    for (let i = 1; i < clicks.length; i++) {
                        const interval = clicks[i].timestamp - clicks[i - 1].timestamp;
                        if (clicks[i].status === clicks[i - 1].status && interval < 2500) {
                            currentConsecutiveFastSameStatus++;
                        } else {
                            if (currentConsecutiveFastSameStatus > maxConsecutiveFastSameStatus) {
                                maxConsecutiveFastSameStatus = currentConsecutiveFastSameStatus;
                            }
                            currentConsecutiveFastSameStatus = 1;
                        }
                    }
                    if (currentConsecutiveFastSameStatus > maxConsecutiveFastSameStatus) {
                        maxConsecutiveFastSameStatus = currentConsecutiveFastSameStatus;
                    }
                    
                    // Heuristics:
                    // 1. Ortalama seçim hızı 1.8 saniyenin altındaysa
                    // 2. Ardışık 8 veya daha fazla madde aynı durumla < 2.5s ile işaretlendiyse
                    // 3. Maddelerin hepsi için toplam tıklama süresi aşırı derecede kısaysa (tıklama başına < 1.2 sn)
                    let isSuspiciouslyFast = false;
                    let suspicionReason = '';
                    
                    const totalInteractionTimeMs = clicks.length > 0 ? (clicks[clicks.length - 1].timestamp - clicks[0].timestamp) : 0;
                    
                    if (clickCount >= 5) {
                        if (averageClickIntervalMs > 0 && averageClickIntervalMs < 1800) {
                            isSuspiciouslyFast = true;
                            suspicionReason = `Maddeler arası ortalama seçim süresi çok kısa (${(averageClickIntervalMs/1000).toFixed(1)} sn).`;
                        } else if (maxConsecutiveFastSameStatus >= 8) {
                            isSuspiciouslyFast = true;
                            suspicionReason = `Ardışık ${maxConsecutiveFastSameStatus} madde aynı durumla çok hızlı şekilde işaretlendi (Toplu seçim şüphesi).`;
                        } else if (clickCount >= 10 && totalInteractionTimeMs > 0 && totalInteractionTimeMs < clickCount * 1200) {
                            isSuspiciouslyFast = true;
                            suspicionReason = `Toplam kontrol süresi tüm maddeler için aşırı derecede kısa (${(totalInteractionTimeMs/1000).toFixed(1)} sn).`;
                        }
                    }
                    
                    auditMetrics = {
                        formOpenedTime: tracking.formOpenedTime,
                        firstClickTime: clicks[0]?.timestamp || null,
                        lastClickTime: clicks[clicks.length - 1]?.timestamp || null,
                        totalFillTimeSeconds,
                        clickCount,
                        averageClickIntervalMs,
                        fastestClickIntervalMs,
                        slowestClickIntervalMs,
                        maxConsecutiveFastSameStatus: maxConsecutiveFastSameStatus > 1 ? maxConsecutiveFastSameStatus : 0,
                        isSuspiciouslyFast,
                        suspicionReason
                    };
                }

                const reportData: any = {
                    type: isMaintenance || isDeficiency ? 'BAKIM' : 'ARIZA',
                    reportNo: (isMaintenance || isDeficiency ? 'BK-' : 'AR-') + Date.now().toString().slice(-6),
                    turbineSerial: turbineSerial,
                    turbineNo: (document.getElementById('turbin-no') as HTMLInputElement).value,
                    siteId: siteId,
                    siteName: siteName,
                    date: (document.getElementById('form-date') as HTMLInputElement).value,
                    team: currentUser?.displayName || currentUser?.email || 'SİSTEM',
                    templateName: currentTask?.secilenSablon || currentTask?.templateName || '',
                    faultCode: faultCode || currentTask?.rawFaultCode || currentTask?.secilenSablon || '---',
                    faultDesc: faultDesc || currentTask?.secilenSablon || 'Genel Görev',
                    workSessions: workSessions,
                    personnel: personnel,
                    matFormNo: matFormNo,
                    notes: (document.getElementById('form-notes') as HTMLTextAreaElement)?.value || '',
                    materials: materials.filter((mat: any) => mat.sapNo && mat.sapNo.trim() !== ''),
                    checklist: isMaintenance ? (w.smartAuditItems || []) : [],
                    auditMetrics: auditMetrics,
                    createdBy: currentUser?.email || 'Admin',
                    resolvedDeficiencyId: currentTask?.resolvedDeficiencyId || null,
                    ohsData: currentTask?.ohsData || null
                };

                const files = w.selectedFaultFiles || [];
                const isEditMode = w.isEditMode;
                const reportId = w.currentEditReportId;

                if (isEditMode && reportId) {
                    setBtnStatus('RAPOR GÜNCELLENİYOR...');
                    await serviceReportService.updateReport(reportId, reportData, files);
                    alert("Rapor başarıyla güncellendi!");
                    w.navigate('reports-archive');
                } else {
                    setBtnStatus('RAPOR KAYDEDİLİYOR...');
                    await serviceReportService.saveReport(reportData, files);
                    
                    // Stock update
                    if (siteId && reportData.materials && reportData.materials.length > 0) {
                        setBtnStatus('STOK DÜŞÜLÜYOR...');
                        for (const mat of reportData.materials) {
                            const typeUpper = mat.type?.toUpperCase();
                            const isTakilan = !mat.type || typeUpper === 'T';
                            if (mat.sapNo && mat.used > 0 && isTakilan) {
                                await warehouseService.updateStockBySap(siteId, mat.sapNo, -mat.used, {
                                    user: currentUser?.email || 'Sistem',
                                    reason: 'Saha Raporu ile Malzeme Kullanımı',
                                    reportNo: reportData.reportNo,
                                    materialName: mat.description
                                });
                            }
                        }
                    }

                    if (currentTask && currentTask.id) {
                        setBtnStatus('GÖREV KAPATILIYOR...');
                        const { taskService } = await import('../../services/TaskService');
                        await taskService.updateTaskStatus(currentTask.id, 'Tamamlandı');
                        localStorage.removeItem('activeTaskContext');
                        delete w.currentTaskContext;
                    }

                    setBtnStatus('BİTİRİLİYOR...');
                    alert("Rapor başarıyla kaydedildi!");
                    w.navigate('tasks');
                }
            } catch (err: any) {
                console.error("Submit Error:", err);
                if (err && err.message && err.message.toLowerCase().includes('dynamically imported module')) {
                    alert("Sistem güncellendi. Yeni versiyon yükleniyor, lütfen bekleyin...");
                    window.location.reload();
                } else {
                    alert("Form gönderilirken bir hata oluştu: " + err.message);
                }
            } finally {
                btn.disabled = false;
                btn.innerHTML = orgHtml;
            }
        };

        w.updateTemplateMetadata = (field: string, val: string) => {
            if (w.currentEditingTemplate) {
                w.currentEditingTemplate[field] = val;
                if (field === 'name') {
                    const titleEl = document.getElementById('header-title');
                    if (titleEl) titleEl.textContent = val.toUpperCase();
                }
                if (field === 'instructionCode') {
                    const subtitleEl = document.getElementById('header-subtitle');
                    if (subtitleEl) subtitleEl.textContent = val;
                }
            }
        };

        // Deleted duplicate handleTemplateSave

        // Attach listener to submit button after it's rendered
        setTimeout(() => {
            const submitBtn = document.getElementById('submit-form-btn');
            if (submitBtn) {
                submitBtn.onclick = (e) => {
                    e.preventDefault();
                    w.submitFaultForm();
                };
            }
        }, 100);
    }

    static async initializeForm(initialData: any) {
        console.log("Initializing Fault Form Data Hydration...");
        const w = window as any;
        w.auditTracking = {
            formOpenedTime: Date.now(),
            clicks: []
        };
        const { maintenanceService } = await import('../../services/MaintenanceService');
        const isSmartEditor = localStorage.getItem('currentEditingTemplateId') !== null;
        const isEditMode = initialData?.isEditMode;

        if (isSmartEditor) {
            const templateId = localStorage.getItem('currentEditingTemplateId');
            if (templateId) {
                const tpl = await maintenanceService.getTemplate(templateId);
                if (tpl) {
                    w.currentEditingTemplate = tpl;
                    w.smartAuditItems = tpl.checklist || [];
                    
                    // Update header titles immediately
                    const titleEl = document.getElementById('header-title');
                    if (titleEl) titleEl.textContent = tpl.name.toUpperCase();
                    const subtitleEl = document.getElementById('header-subtitle');
                    if (subtitleEl) subtitleEl.textContent = tpl.instructionCode || '';
                    
                    w.renderSmartAuditUI();
                }
            }
            return;
        }

        // Hydrate Team Personnel
        const rawTeam = isEditMode 
            ? (initialData.personnel || []) 
            : (initialData?.maintenanceData?.teamPersonnel || []);
        w.teamPersonnel = Array.isArray(rawTeam) 
            ? [...rawTeam] 
            : (typeof rawTeam === 'string' && rawTeam.trim() ? [rawTeam.trim()] : []);
        w.renderGlobalPersonnelInputs();

        // Hydrate Turbine Info
        const serialInput = document.getElementById('turbin-seri') as HTMLInputElement;
        if (serialInput) {
            // In edit mode, the serial might be stored as turbineSerial or turbinSeriNo
            const serialValue = serialInput.value || initialData?.turbinSeriNo || initialData?.turbineSerial || '';
            if (serialValue) {
                serialInput.value = serialValue;
                w.handleSerialLookup(serialValue);
            }
        }
        // Also hydrate turbine number directly if available
        const turbineNoInput = document.getElementById('turbin-no') as HTMLInputElement;
        if (turbineNoInput && !turbineNoInput.value) {
            turbineNoInput.value = initialData?.turbineId || initialData?.turbineNo || '';
        }

        // Hydrate Materials
        const materials = isEditMode ? initialData.materials : (initialData.maintenanceData?.materials || []);
        if (materials.length > 0) {
            const grouped: { [poz: string]: { S?: any; T?: any } } = {};
            materials.forEach((mat: any) => {
                if (!mat) return;
                const poz = String(mat.poz || 1);
                if (!grouped[poz]) grouped[poz] = {};
                const type = (mat.type || 'S').toUpperCase();
                if (type === 'S') grouped[poz].S = mat;
                else grouped[poz].T = mat;
            });
            
            const sortedPozs = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));
            if (sortedPozs.length > 0) {
                sortedPozs.forEach((poz) => {
                    const pair = grouped[poz];
                    w.addMaterialRow(pair.S, pair.T);
                });
            } else {
                w.addMaterialRow();
            }
        } else {
            w.addMaterialRow();
        }

        // Trigger SAP lookups on load so badges populate
        setTimeout(() => {
            const sapInputs = document.querySelectorAll('#material-rows input[oninput*="handleSapLookup"]');
            sapInputs.forEach(input => {
                if (w.handleSapLookup) w.handleSapLookup(input as HTMLInputElement);
            });
        }, 300);

        // Hydrate Sessions
        const sessions = isEditMode ? initialData.workSessions : (initialData.maintenanceData?.workSessions || []);
        if (sessions.length > 0) {
            w.workSessions = JSON.parse(JSON.stringify(sessions));
        } else {
            w.workSessions = [{
                id: Date.now().toString(),
                date: (document.getElementById('form-date') as HTMLInputElement)?.value || new Date().toISOString().split('T')[0],
                startTime: '',
                endTime: '',
                personnel: [],
                duration: '00:00',
                type: 'ÇALIŞMA',
                isOffDay: false,
                comment: ''
            }];
        }
        w.renderWorkSessionsUI();

        // Hydrate Notes & MCF Form No from draft or initialData
        const notesEl = document.getElementById('form-notes') as HTMLTextAreaElement;
        if (notesEl) {
            notesEl.value = isEditMode ? (initialData.notes || '') : (initialData?.maintenanceData?.notes || '');
        }
        const matFormNoEl = document.getElementById('mat-form-no') as HTMLInputElement;
        if (matFormNoEl) {
            matFormNoEl.value = isEditMode ? (initialData.matFormNo || '') : (initialData?.maintenanceData?.matFormNo || '');
            if (typeof w.checkMcfValidation === 'function') w.checkMcfValidation();
        }

        // Hydrate Audit Items
        const sablonName = initialData?.secilenSablon || initialData?.templateName || '';
        
        if (isEditMode) {
            w.smartAuditItems = initialData.checklist || [];
            if (typeof w.renderSmartAuditUI === 'function') w.renderSmartAuditUI();
        } else if (sablonName) {
            const templates = await maintenanceService.fetchTemplates();
            const tpl = templates.find(t => t.name === sablonName);
            if (tpl) {
                const draftChecklist = initialData?.maintenanceData?.checklist;
                if (draftChecklist && draftChecklist.length > 0) {
                    w.smartAuditItems = JSON.parse(JSON.stringify(draftChecklist));
                } else {
                    w.smartAuditItems = (tpl.checklist || []).map((item: any) => ({ ...item, status: '' }));
                }
                if (typeof w.renderSmartAuditUI === 'function') w.renderSmartAuditUI();
            }
        }

        // Photos
        if (isEditMode && initialData.photos) {
            const container = document.getElementById('image-previews');
            if (container) {
                const noMsg = document.getElementById('no-photo-msg');
                if (noMsg) noMsg.style.display = 'none';
                initialData.photos.forEach((url: string) => {
                    const wrapper = document.createElement('div');
                    wrapper.innerHTML = `<img src="${url}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">`;
                    container.appendChild(wrapper);
                });
            }
        }

        const imgInput = document.getElementById('fault-images');
        if (imgInput) {
            imgInput.onchange = (e: any) => w.handleImagePreviews(e.target);
        }

        // Pre-populate Fault Description if fault code is present
        const faultDescEl = document.getElementById('ariza-tanimi') as HTMLTextAreaElement;
        if (faultDescEl) {
            const faultCodeInput = document.getElementById('form-fault-search') as HTMLInputElement;
            const faultCode = faultCodeInput?.value || initialData?.faultCode || initialData?.rawFaultCode || '';
            if (faultCode) {
                const exact = statusService.getCodeByKod(faultCode);
                if (exact) {
                    faultDescEl.value = exact.Aciklama;
                } else if (initialData?.faultDesc) {
                    faultDescEl.value = initialData.faultDesc;
                }
            }
        }
    }
}




