import { cardSchematicAgentService, PRELOADED_CARD_PROFILES, type SapCardAnalysisResult, type SuspectedComponent } from '../services/CardSchematicAgentService';
import { workshopComponentService } from '../services/WorkshopComponentService';
import { repairService, type RepairRecord } from '../services/RepairService';

// Module-level persistent state
let currentSearchQuery = 'Power Board Pitch';
let activeSapAnalysis: SapCardAnalysisResult | null = null;
let isSearching = false;
let isAskingChat = false;

// PCB Photo state for Gemini Vision analysis
let uploadedPcbPhotoBase64: string | null = null;
let uploadedPcbPhotoMimeType: string | null = null;
let uploadedPcbPhotoPreviewUrl: string | null = null;
let uploadedPcbPhotoFileName: string = '';

// Chat conversation stream
interface ChatMessage {
  id: string;
  sender: 'USER' | 'AGENT';
  text: string;
  timestamp: string;
  photoPreviewUrl?: string;
  photoFileName?: string;
}

let chatHistory: ChatMessage[] = [];
let allActiveRepairs: RepairRecord[] = [];

// Markdown formatter for AI responses
function formatMarkdown(text: string): string {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #38bdf8;">$1</strong>');
  // Italic
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(168, 85, 247, 0.15); color: #c084fc; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.85em;">$1</code>');
  // Headings
  html = html.replace(/^### (.*$)/gim, '<h4 style="color: #14F195; font-size: 0.98rem; font-weight: 700; margin: 0.8rem 0 0.35rem 0;">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 style="color: #38bdf8; font-size: 1.08rem; font-weight: 800; margin: 1rem 0 0.45rem 0;">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 style="color: #f8fafc; font-size: 1.2rem; font-weight: 800; margin: 1.2rem 0 0.6rem 0;">$1</h2>');
  // Unordered list items
  html = html.replace(/^\s*-\s+(.*$)/gim, '<li style="margin-bottom: 0.35rem; list-style-type: square;">$1</li>');
  // Numbered list items
  html = html.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li value="$1" style="margin-bottom: 0.35rem; font-weight: 500;">$2</li>');
  // Newlines to br
  html = html.replace(/\n/g, '<br/>');
  // Clean up excess breaks around lists
  html = html.replace(/(<br\/>)+(<li[^>]*>)/g, '$2');
  html = html.replace(/(<\/li>)(<br\/>)+/g, '$1');
  return html;
}

export const WorkshopCardAgentPage = async () => {
  // Load active repairs for job order assignment
  try {
    const all = await repairService.getRepairs();
    allActiveRepairs = all.filter(r => r.status === 'UNDER_REPAIR' || r.status === 'PENDING_ARRIVAL');
  } catch (e) {
    console.warn('Could not load active repairs:', e);
  }

  // Pre-load default Power Board Pitch if not loaded yet
  if (!activeSapAnalysis && currentSearchQuery) {
    try {
      activeSapAnalysis = await cardSchematicAgentService.analyzeCardBySapNumber(currentSearchQuery);
      if (chatHistory.length === 0) {
        chatHistory.push({
          id: 'welcome-1',
          sender: 'AGENT',
          text: `Merhaba Usta! **${activeSapAnalysis.cardName}** devre şeması ve klemens bağlantı haritası hazırlandı.\n\nMotorun ileri/geri sürülmesi, H-köprüsü IGBT'ler, X10/X11 klemensleri veya tetikleme optokuplörleri hakkında aklınıza takılan her şeyi sorabilirsiniz.\n\n💡 **Tavsiye:** Masanızdaki kartın fotoğrafını aşağıdan yüklerseniz, üzerindeki optokuplörleri ve bileşenleri doğrudan görsel olarak da analiz edebilirim.`,
          timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        });
      }
    } catch (e) {
      console.warn('Default card preload error:', e);
    }
  }

  return `
    <div class="workshop-agent-container" style="padding: 1.25rem; max-width: 1750px; margin: 0 auto; color: #f8fafc; font-family: 'Inter', sans-serif;">
      
      <!-- ========================================================================= -->
      <!-- TOP BANNER / HEADER -->
      <!-- ========================================================================= -->
      <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.9)); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 20px; padding: 1.25rem 1.75rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5), inset 0 0 20px rgba(168, 85, 247, 0.08); backdrop-filter: blur(16px);">
        <div style="display: flex; align-items: center; gap: 1.25rem;">
          <div style="width: 54px; height: 54px; border-radius: 16px; background: linear-gradient(135deg, #a855f7, #6366f1); display: flex; align-items: center; justify-content: center; font-size: 1.75rem; color: #fff; box-shadow: 0 0 25px rgba(168, 85, 247, 0.5);">
            <i class="fa-solid fa-microchip"></i>
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
              <h1 style="font-size: 1.5rem; font-weight: 800; margin: 0; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.8px; background: linear-gradient(90deg, #c084fc, #38bdf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                AI ELEKTRONİK KART & DEVRE ŞEMASI UZMANI
              </h1>
              <span style="background: rgba(168, 85, 247, 0.2); border: 1px solid rgba(168, 85, 247, 0.4); color: #c084fc; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700;">
                <i class="fa-solid fa-bolt"></i> ŞEMATİK + PCB FOTOĞRAF VİZYONU
              </span>
            </div>
            <p style="margin: 0.25rem 0 0 0; color: #94a3b8; font-size: 0.88rem;">
              Devre şeması klemens hatları, H-Bridge IGBT tetikleme mantığı ve masadaki kartın fotoğrafı üzerinden nokta atışı arıza teşhisi
            </p>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <button onclick="window.openEnerconGuideModal()" style="background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.4); color: #60a5fa; padding: 0.6rem 1.1rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;">
            <i class="fa-solid fa-book-bookmark"></i> Enercon Şema Okuma Kılavuzu
          </button>
          <button onclick="window.navigate('workshop-tasks')" style="background: rgba(20, 241, 149, 0.15); border: 1px solid rgba(20, 241, 149, 0.4); color: #14F195; padding: 0.6rem 1.1rem; border-radius: 12px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;">
            <i class="fa-solid fa-clipboard-list"></i> Kart İş Emirleri
          </button>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- 🔍 KART ARAMA VE HIZLI SEÇİM ÇUBUĞU (HERO SEARCH BAR) -->
      <!-- ========================================================================= -->
      <div style="background: linear-gradient(135deg, rgba(30, 27, 75, 0.95), rgba(15, 23, 42, 0.98)); border: 2px solid rgba(168, 85, 247, 0.45); border-radius: 20px; padding: 1.4rem 1.75rem; margin-bottom: 1.25rem; box-shadow: 0 10px 35px rgba(0,0,0,0.6), 0 0 25px rgba(168, 85, 247, 0.18); position: relative;">
        <div style="position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: linear-gradient(90deg, #a855f7, #38bdf8, #14F195);"></div>

        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <div style="width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, #a855f7, #6366f1); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.1rem; box-shadow: 0 0 12px rgba(168, 85, 247, 0.5);">
              <i class="fa-solid fa-magnifying-glass"></i>
            </div>
            <div>
              <span style="font-size: 1.15rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.8px; color: #f8fafc;">
                ANALİZ EDİLECEK KARTI SEÇİN VEYA ARAYIN
              </span>
              <span style="font-size: 0.8rem; color: #94a3b8; margin-left: 0.5rem;">
                (Kart adı yazabilir veya SAP numarasını girebilirsiniz)
              </span>
            </div>
          </div>
          <span style="background: rgba(20, 241, 149, 0.15); border: 1px solid rgba(20, 241, 149, 0.4); color: #14F195; padding: 3px 12px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">
            <i class="fa-solid fa-bolt"></i> ANINDA ŞEMA VE KLEMENS GETİRİR
          </span>
        </div>

        <!-- Search Input Bar -->
        <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 0.85rem;">
          <div style="flex: 1; position: relative;">
            <input 
              type="text" 
              id="agent-search-input" 
              placeholder="Örn: Power Board Pitch, Control Board Pitch, 72544, 59368, 54060, 11835 veya kart adı yazın..." 
              value="${activeSapAnalysis?.cardName || currentSearchQuery}"
              style="width: 100%; background: #0b0f19; border: 2px solid rgba(168, 85, 247, 0.5); color: #fff; padding: 0.85rem 1.25rem; border-radius: 12px; font-size: 1.05rem; font-weight: 700; outline: none; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5); font-family: 'Inter', monospace;" 
              onkeydown="if(event.key === 'Enter') window.executeCardSearch()" 
            />
            <i class="fa-solid fa-microchip" style="position: absolute; right: 15px; top: 50%; transform: translateY(-50%); color: #a855f7; font-size: 1.3rem;"></i>
          </div>
          <button 
            onclick="window.executeCardSearch()" 
            id="btn-search-card" 
            style="background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff; border: none; padding: 0.85rem 1.8rem; border-radius: 12px; font-size: 1rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 0.6rem; box-shadow: 0 0 20px rgba(168, 85, 247, 0.4); font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; white-space: nowrap; transition: all 0.2s;"
          >
            <i class="fa-solid fa-wand-magic-sparkles"></i> KARTI GETİR & ŞEMAYI AÇ
          </button>
        </div>

        <!-- Quick Select Chips -->
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">HIZLI KART SEÇİMİ:</span>
          <button onclick="window.quickSelectCard('Power Board Pitch')" style="background: rgba(168, 85, 247, 0.2); border: 1px solid rgba(168, 85, 247, 0.5); color: #e9d5ff; padding: 4px 11px; border-radius: 8px; font-size: 0.78rem; cursor: pointer; font-weight: 700; transition: all 0.2s;">
            ⚡ Power Board Pitch (Motor Güç & IGBT)
          </button>
          <button onclick="window.quickSelectCard('Control Board Pitch')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; cursor: pointer; font-weight: 600; transition: all 0.2s;">
            ⚡ Control Board Pitch (54060)
          </button>
          <button onclick="window.quickSelectCard('72544')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; cursor: pointer; font-weight: 600; transition: all 0.2s;">
            ⚡ Rectifier Driver (72544)
          </button>
          <button onclick="window.quickSelectCard('59368')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; cursor: pointer; font-weight: 600; transition: all 0.2s;">
            ⚡ Capacitor Board (59368)
          </button>
          <button onclick="window.quickSelectCard('11835')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; cursor: pointer; font-weight: 600; transition: all 0.2s;">
            ⚡ Chopper Pitch (11835)
          </button>
          <button onclick="window.quickSelectCard('48342')" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: #e2e8f0; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; cursor: pointer; font-weight: 600; transition: all 0.2s;">
            ⚡ Controlboard Rectifier E112 (48342)
          </button>
        </div>

        <!-- Search Loading Spinner -->
        <div id="card-search-loading" style="display: none; text-align: center; padding: 1.5rem 0;">
          <div style="width: 36px; height: 36px; border: 3px solid rgba(168, 85, 247, 0.2); border-top-color: #c084fc; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 0.5rem auto;"></div>
          <span style="font-size: 0.85rem; color: #cbd5e1;">Devre şeması ve klemens veritabanı taranıyor...</span>
        </div>
      </div>

      <!-- ========================================================================= -->
      <!-- 2-COLUMN MAIN WORKSPACE: LEFT (SCHEMATIC & KLEMENS) | RIGHT (CHAT & PHOTO) -->
      <!-- ========================================================================= -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; align-items: start;">
        
        <!-- ======================================================================= -->
        <!-- SOL PANEL: SEÇİLİ KARTIN DEVRE ŞEMASI VE KLEMENS BAĞLANTI REHBERİ -->
        <!-- ======================================================================= -->
        <div id="card-schematic-panel" style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 18px; padding: 1.25rem; box-shadow: 0 4px 25px rgba(0,0,0,0.4); display: flex; flex-direction: column; gap: 1.25rem;">
          ${activeSapAnalysis ? renderCardSchematicAndKlemensHtml(activeSapAnalysis) : `
            <div style="text-align: center; padding: 3rem 1rem; color: #94a3b8;">
              <i class="fa-solid fa-microchip" style="font-size: 3rem; color: #a855f7; margin-bottom: 1rem; display: block; opacity: 0.6;"></i>
              <h3 style="font-size: 1.1rem; color: #f8fafc; margin-bottom: 0.5rem;">İncelemek İstediğiniz Kartı Seçin</h3>
              <p style="font-size: 0.85rem; max-width: 400px; margin: 0 auto;">Yukarıdaki arama çubuğuna kart adı veya SAP numarası yazarak devre şemasını ve klemens dağılımını açabilirsiniz.</p>
            </div>
          `}
        </div>

        <!-- ======================================================================= -->
        <!-- SAĞ PANEL: MASADAKİ KARTIN FOTOĞRAFI + AKILLI ELEKTRONİK SOHBET UZMANI -->
        <!-- ======================================================================= -->
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- 📸 KARTIN FOTOĞRAFINI YÜKLEYİN DAVETİ & GEMINI VISION WIDGET -->
          <div style="background: linear-gradient(135deg, rgba(30, 27, 75, 0.95), rgba(15, 23, 42, 0.95)); border: 2px solid rgba(56, 189, 248, 0.4); border-radius: 18px; padding: 1.25rem; box-shadow: 0 4px 20px rgba(0,0,0,0.4); position: relative; overflow: hidden;">
            <div style="position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: linear-gradient(90deg, #38bdf8, #14F195, #a855f7);"></div>

            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.75rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <div style="width: 38px; height: 38px; border-radius: 12px; background: linear-gradient(135deg, #38bdf8, #0284c7); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.2rem; box-shadow: 0 0 15px rgba(56, 189, 248, 0.4);">
                  <i class="fa-solid fa-camera"></i>
                </div>
                <div>
                  <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; color: #f8fafc; letter-spacing: 0.5px;">
                    📸 MASANIZDAKİ KARTIN FOTOĞRAFINI YÜKLEYİN
                  </h3>
                  <div style="font-size: 0.78rem; color: #94a3b8;">
                    Optokuplörleri, IGBT sürücü hatlarını ve lehim noktalarını doğrudan görsel olarak inceleyelim
                  </div>
                </div>
              </div>
              <span style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); color: #38bdf8; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; white-space: nowrap;">
                <i class="fa-solid fa-eye"></i> GEMINI VISION
              </span>
            </div>

            <!-- Upload Area & Drag-Drop -->
            <input type="file" id="pcb-photo-input" accept="image/*" onchange="window.handlePcbPhotoUpload(event)" style="display: none;" />
            
            <div id="pcb-photo-upload-zone" onclick="document.getElementById('pcb-photo-input').click()" style="background: rgba(15, 23, 42, 0.7); border: 2px dashed ${uploadedPcbPhotoPreviewUrl ? 'rgba(20, 241, 149, 0.6)' : 'rgba(56, 189, 248, 0.4)'}; border-radius: 14px; padding: 1rem; text-align: center; cursor: pointer; transition: all 0.2s;">
              ${uploadedPcbPhotoPreviewUrl ? `
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                  <div style="display: flex; align-items: center; gap: 0.85rem;">
                    <img src="${uploadedPcbPhotoPreviewUrl}" alt="Yüklenen Kart" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 2px solid #14F195;" />
                    <div style="text-align: left;">
                      <div style="font-size: 0.85rem; font-weight: 700; color: #14F195; display: flex; align-items: center; gap: 0.4rem;">
                        <i class="fa-solid fa-circle-check"></i> Kart Fotoğrafı Hazır
                      </div>
                      <div style="font-size: 0.75rem; color: #cbd5e1; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                        ${uploadedPcbPhotoFileName || 'Kart_Fotografi.jpg'}
                      </div>
                      <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.2rem;">
                        Sorunuzla birlikte fotoğraftaki optokuplör ve parçalar taranacak
                      </div>
                    </div>
                  </div>
                  <button onclick="event.stopPropagation(); window.removeUploadedPcbPhoto()" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 0.4rem 0.75rem; border-radius: 8px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
                    <i class="fa-solid fa-trash-can"></i> Kaldır
                  </button>
                </div>
              ` : `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 0.4rem;">
                  <i class="fa-solid fa-camera-retro" style="font-size: 1.8rem; color: #38bdf8;"></i>
                  <div style="font-size: 0.88rem; font-weight: 700; color: #e2e8f0;">
                    Fotoğraf Seçin veya Buraya Sürükleyin
                  </div>
                  <div style="font-size: 0.75rem; color: #94a3b8;">
                    Masanızdaki kartın (Power Board vb.) net bir fotoğrafını yükleyin
                  </div>
                </div>
              `}
            </div>
          </div>

          <!-- 💬 AKILLI ELEKTRONİK SOHBET VE SORU-CEVAP KONSOLU -->
          <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(168, 85, 247, 0.35); border-radius: 18px; padding: 1.25rem; box-shadow: 0 4px 25px rgba(0,0,0,0.4); display: flex; flex-direction: column; gap: 1rem; flex: 1;">
            
            <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.75rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-comments" style="color: #c084fc; font-size: 1.1rem;"></i>
                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; color: #f8fafc; letter-spacing: 0.5px;">
                  ELEKTRONİK ARIZA DANIŞMANI (CANLI SOHBET)
                </h3>
              </div>
              <span style="font-size: 0.72rem; color: #94a3b8;">
                Doğal dilde Türkçe soru sorabilirsiniz
              </span>
            </div>

            <!-- Ready Quick Questions Chips (Tek tıkla sor) -->
            <div>
              <div style="font-size: 0.72rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
                <i class="fa-solid fa-lightbulb" style="color: #fbbf24;"></i> ÖRNEK ARIZA SORULARI (TIKLAYIP ANINDA SORUN):
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                <button onclick="window.askReadyQuestion('Motor ileri gidiyor ama geri gelmiyor, ne olabilir? Motoru ne kontrol ediyor, IGBT nereye bağlı?')" style="text-align: left; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); color: #cbd5e1; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.78rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#a855f7'; this.style.color='#fff';" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.color='#cbd5e1';">
                  💬 <strong>Motor ileri gidiyor ama geri gelmiyor:</strong> Motoru ne kontrol ediyor, IGBT nereye bağlı, hangi optokuplörden şüphelenmeliyim?
                </button>
                <button onclick="window.askReadyQuestion('Power Board Pitch üzerinde X10 klemensi hangi IGBT\'lere ve optokuplörlere bağlı?')" style="text-align: left; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); color: #cbd5e1; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.78rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#a855f7'; this.style.color='#fff';" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.color='#cbd5e1';">
                  💬 <strong>X10 Klemensi Analizi:</strong> Hangi IGBT modüllerine ve gate tetikleme optokuplörlerine bağlı?
                </button>
                <button onclick="window.askReadyQuestion('X11 fren klemensinde voltaj yok, freni hangi transistör veya röle açıyor?')" style="text-align: left; background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); color: #cbd5e1; padding: 0.5rem 0.75rem; border-radius: 8px; font-size: 0.78rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#a855f7'; this.style.color='#fff';" onmouseout="this.style.borderColor='rgba(255,255,255,0.08)'; this.style.color='#cbd5e1';">
                  💬 <strong>X11 Fren Açmıyor:</strong> Kanat mekanik fren bobinini süren parça nerede ve nasıl ölçülür?
                </button>
              </div>
            </div>

            <!-- Chat Messages Container -->
            <div id="agent-chat-flow" style="display: flex; flex-direction: column; gap: 0.85rem; max-height: 480px; min-height: 280px; overflow-y: auto; padding-right: 6px;">
              ${chatHistory.map(msg => renderChatMessageHtml(msg)).join('')}
            </div>

            <!-- Chat Input Box -->
            <div style="display: flex; gap: 0.6rem; align-items: flex-end; pt-2; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 0.75rem;">
              <div style="flex: 1; position: relative;">
                <textarea 
                  id="agent-chat-input" 
                  rows="2" 
                  placeholder="Sorunuzu yazın... (Örn: Motor ileri gidiyor ama geri gelmiyor, IGBT nereye bağlı?)" 
                  style="width: 100%; background: #0f172a; border: 1px solid rgba(168, 85, 247, 0.4); color: #f8fafc; padding: 0.65rem 0.85rem; border-radius: 10px; font-size: 0.85rem; outline: none; resize: none; line-height: 1.4;"
                  onkeydown="if(event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); window.sendChatMessage(); }"
                ></textarea>
              </div>
              <button 
                onclick="window.sendChatMessage()" 
                id="btn-send-chat" 
                style="background: linear-gradient(135deg, #a855f7, #6366f1); color: #fff; border: none; padding: 0.75rem 1.4rem; border-radius: 10px; font-size: 0.88rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; height: 50px; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; transition: all 0.2s;"
              >
                <i class="fa-solid fa-paper-plane"></i> GÖNDER
              </button>
            </div>

            <!-- Save Diagnosis to Job Order Widget -->
            <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 0.85rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
              <div style="flex: 1; min-width: 200px;">
                <span style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; display: block; margin-bottom: 0.2rem;">
                  <i class="fa-solid fa-link" style="color: #38bdf8;"></i> TEŞHİSİ İŞ EMRİNE / PASAPORTA BAĞLA:
                </span>
                <select id="chat-assign-repair-id" style="width: 100%; background: #0b1329; border: 1px solid rgba(255, 255, 255, 0.15); color: #f8fafc; padding: 0.45rem 0.65rem; border-radius: 8px; font-size: 0.78rem; outline: none;">
                  <option value="">-- Aktif Tamir Kartı Seçin --</option>
                  ${allActiveRepairs.map(r => `
                    <option value="${r.id}">${r.description || r.sapNo} (${r.serialNo || r.id}) - ${r.sourceWarehouseId || ''}</option>
                  `).join('')}
                </select>
              </div>
              <button onclick="window.saveChatDiagnosisToJobOrder()" style="background: rgba(20, 241, 149, 0.15); border: 1px solid rgba(20, 241, 149, 0.4); color: #14F195; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; white-space: nowrap; margin-top: 1rem;">
                <i class="fa-solid fa-floppy-disk"></i> İş Emrine Kaydet
              </button>
            </div>

          </div>

        </div>

      </div>

    </div>
  `;
};

// =========================================================================
// RENDER HELPER: SOL PANEL (DEVRE ŞEMASI & KLEMENS REHBERİ)
// =========================================================================
function renderCardSchematicAndKlemensHtml(data: SapCardAnalysisResult): string {
  const previewImgUrl = data.schematicPreviewUrl || '/enercon_pitch_control_board.png';

  return `
    <!-- Top Identity Tag -->
    <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 14px; padding: 1rem 1.25rem;">
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <span style="background: #a855f7; color: #fff; font-family: monospace; font-size: 0.85rem; font-weight: 900; padding: 2px 8px; border-radius: 6px;">
            SAP ${data.sapNo}
          </span>
          <h2 style="margin: 0; font-size: 1.2rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; color: #f8fafc;">
            ${data.cardName}
          </h2>
        </div>
        <div style="display: gap: 0.4rem;">
          <span style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); color: #38bdf8; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; margin-right: 0.4rem;">
            ${data.turbineModel}
          </span>
          <span style="background: rgba(20, 241, 149, 0.15); border: 1px solid rgba(20, 241, 149, 0.3); color: #14F195; padding: 2px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 700;">
            ${data.installationCode}
          </span>
        </div>
      </div>
      <div style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.4;">
        ${data.cardFunction}
      </div>
    </div>

    <!-- Devre Şeması Önizlemesi & Büyütme -->
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.4rem;">
        <span style="font-size: 0.78rem; font-weight: 700; color: #94a3b8; text-transform: uppercase;">
          <i class="fa-solid fa-file-waveform" style="color: #a855f7;"></i> DEVRE ŞEMASI DİYAGRAMI
        </span>
        <span style="font-size: 0.72rem; color: #38bdf8; font-weight: 600;">
          ${data.schematicPage}
        </span>
      </div>

      <div style="position: relative; background: #020617; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; overflow: hidden; height: 260px; display: flex; align-items: center; justify-content: center;">
        <img 
          src="${previewImgUrl}" 
          alt="Devre Şeması" 
          style="width: 100%; height: 100%; object-fit: contain; cursor: pointer;" 
          onclick="window.openSchematicLightbox('${previewImgUrl}')" 
        />
        <div 
          style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); border: 1px solid rgba(255,255,255,0.25); padding: 5px 10px; border-radius: 8px; font-size: 0.72rem; color: #38bdf8; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.4rem;" 
          onclick="window.openSchematicLightbox('${previewImgUrl}')"
        >
          <i class="fa-solid fa-up-right-and-down-left-from-center"></i> Şemayı Büyüt / İncele
        </div>
        <div style="position: absolute; top: 8px; left: 8px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.2); padding: 3px 8px; border-radius: 6px; font-size: 0.7rem; color: #f1f5f9; font-weight: 600;">
          ${data.schematicBook}
        </div>
      </div>
    </div>

    <!-- Klemensler ve Bağlantı Rehberi (Şu klemensler buralara gidiyor, bunları besliyor) -->
    <div>
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem;">
        <span style="font-size: 0.82rem; font-weight: 800; color: #14F195; text-transform: uppercase; letter-spacing: 0.5px;">
          <i class="fa-solid fa-diagram-project"></i> KLEMENSLER VE BAĞLANTI REHBERİ (NEREYE GİDİYOR?)
        </span>
        <span style="font-size: 0.72rem; color: #94a3b8;">${data.pinouts.length} Temel Klemens</span>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.55rem; max-height: 380px; overflow-y: auto; padding-right: 4px;">
        ${data.pinouts.map(pin => `
          <div style="background: rgba(30, 41, 59, 0.55); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 10px; padding: 0.75rem 0.9rem; transition: all 0.2s;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.25rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="background: ${pin.connector.includes('X10') ? '#ef4444' : (pin.connector.includes('X11') ? '#f59e0b' : '#a855f7')}; color: #fff; padding: 2px 7px; border-radius: 5px; font-size: 0.75rem; font-weight: 800; font-family: monospace;">
                  ${pin.connector}
                </span>
                <strong style="font-size: 0.84rem; color: #f8fafc;">${pin.label}</strong>
              </div>
              <span style="font-size: 0.72rem; color: #94a3b8; font-family: monospace;">${pin.pins}</span>
            </div>

            <div style="font-size: 0.76rem; color: #cbd5e1; line-height: 1.35; margin-bottom: 0.35rem;">
              ${pin.functionDesc}
            </div>

            <div style="background: rgba(56, 189, 248, 0.08); border-left: 2px solid #38bdf8; padding: 3px 7px; border-radius: 0 4px 4px 0; font-size: 0.72rem; color: #bae6fd;">
              <i class="fa-solid fa-gauge-simple-high"></i> <strong>Ölçüm / Test:</strong> ${pin.testAdvice}
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Atölye Şüpheli Komponentleri ve Çekmeceler -->
    ${data.recommendedComponents && data.recommendedComponents.length > 0 ? `
      <div style="background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(20, 241, 149, 0.25); border-radius: 12px; padding: 0.85rem;">
        <div style="font-size: 0.78rem; font-weight: 700; color: #14F195; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.4rem;">
          <i class="fa-solid fa-boxes-stacked"></i> Sık Değişen Parçalar ve Atölye Çekmeceleri:
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem;">
          ${data.recommendedComponents.slice(0, 4).map(c => `
            <div style="background: rgba(15, 23, 42, 0.6); padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.72rem; display: flex; align-items: center; justify-content: space-between;">
              <span style="color: #e2e8f0; font-weight: 600;">${c.designator}: ${c.name}</span>
              <span style="background: rgba(20, 241, 149, 0.15); color: #14F195; padding: 1px 5px; border-radius: 4px; font-weight: 700; font-family: monospace;">
                ${c.drawerLocation || 'Atölye'}
              </span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

// =========================================================================
// RENDER HELPER: SOHBET MESAJI (CHAT BUBBLE)
// =========================================================================
function renderChatMessageHtml(msg: ChatMessage): string {
  const isUser = msg.sender === 'USER';

  return `
    <div style="align-self: ${isUser ? 'flex-end' : 'flex-start'}; max-width: 90%; display: flex; flex-direction: column; gap: 0.25rem;">
      <div style="display: flex; align-items: center; gap: 0.5rem; justify-content: ${isUser ? 'flex-end' : 'flex-start'};">
        <span style="font-size: 0.7rem; font-weight: 700; color: ${isUser ? '#60a5fa' : '#c084fc'}; display: flex; align-items: center; gap: 0.3rem;">
          <i class="${isUser ? 'fa-solid fa-user-gear' : 'fa-solid fa-robot'}"></i>
          ${isUser ? 'Teknisyen' : 'AI Elektronik & Şematik Uzmanı'}
        </span>
        <span style="font-size: 0.68rem; color: #64748b;">${msg.timestamp}</span>
      </div>

      <div style="background: ${isUser ? 'linear-gradient(135deg, rgba(37, 99, 235, 0.25), rgba(30, 58, 138, 0.35))' : 'linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95))'}; border: 1px solid ${isUser ? 'rgba(59, 130, 246, 0.4)' : 'rgba(168, 85, 247, 0.3)'}; border-radius: 14px; padding: 0.85rem 1rem; color: #f1f5f9; font-size: 0.82rem; line-height: 1.5; box-shadow: 0 4px 15px rgba(0,0,0,0.25);">
        
        <!-- Eğer mesajla birlikte kart fotoğrafı gönderildiyse görsel önizleme -->
        ${msg.photoPreviewUrl ? `
          <div style="margin-bottom: 0.6rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 0.4rem; display: flex; align-items: center; gap: 0.6rem;">
            <img src="${msg.photoPreviewUrl}" alt="Masa Kartı" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px; cursor: pointer;" onclick="window.openSchematicLightbox('${msg.photoPreviewUrl}')" />
            <div>
              <div style="font-size: 0.72rem; color: #38bdf8; font-weight: 700;">📸 Masadaki Kart Fotoğrafı Eklendi</div>
              <div style="font-size: 0.68rem; color: #94a3b8;">${msg.photoFileName || 'PCB Fotoğrafı'} (Tıklayıp büyütün)</div>
            </div>
          </div>
        ` : ''}

        ${formatMarkdown(msg.text)}
      </div>
    </div>
  `;
}

// =========================================================================
// WINDOW ATTACHED FUNCTIONS FOR USER INTERACTIONS
// =========================================================================

(window as any).quickSelectCard = (cardQuery: string) => {
  const inputEl = document.getElementById('agent-search-input') as HTMLInputElement;
  if (inputEl) {
    inputEl.value = cardQuery;
    (window as any).executeCardSearch();
  }
};

(window as any).executeCardSearch = async () => {
  const inputEl = document.getElementById('agent-search-input') as HTMLInputElement;
  if (!inputEl || !inputEl.value.trim()) {
    alert('Lütfen aranacak kart adını veya SAP numarasını yazın.');
    return;
  }

  const query = inputEl.value.trim();
  currentSearchQuery = query;

  const loadingEl = document.getElementById('card-search-loading');
  const panelEl = document.getElementById('card-schematic-panel');
  const btnEl = document.getElementById('btn-search-card') as HTMLButtonElement;

  if (loadingEl) loadingEl.style.display = 'block';
  if (btnEl) btnEl.disabled = true;

  try {
    const res = await cardSchematicAgentService.analyzeCardBySapNumber(query);
    activeSapAnalysis = res;

    if (panelEl) {
      panelEl.innerHTML = renderCardSchematicAndKlemensHtml(res);
    }

    // Add notification / welcome message to chat
    const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    chatHistory.push({
      id: 'search-' + Date.now(),
      sender: 'AGENT',
      text: `**${res.cardName}** devre şeması ve klemens rehberi açıldı.\n\n- **Görevi:** ${res.cardFunction}\n- **Kritik Klemensler:** ${res.pinouts.map(p => `\`${p.connector}\` (${p.label})`).join(', ')}\n\nBu kartla ilgili motor ileri/geri sorunları, tetikleme alamama veya parça testleri hakkında ne öğrenmek istersiniz?`,
      timestamp: timeStr
    });

    const chatFlowEl = document.getElementById('agent-chat-flow');
    if (chatFlowEl) {
      chatFlowEl.innerHTML = chatHistory.map(msg => renderChatMessageHtml(msg)).join('');
      chatFlowEl.scrollTop = chatFlowEl.scrollHeight;
    }

    (window as any).showNotification?.(`${res.cardName} şeması ve klemensleri başarıyla getirildi!`, 'success');
  } catch (err: any) {
    console.error('Card search error:', err);
    alert('Kart analiz edilirken bir hata oluştu: ' + (err?.message || err));
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
    if (btnEl) btnEl.disabled = false;
  }
};

(window as any).handlePcbPhotoUpload = (event: any) => {
  const file = event.target?.files?.[0];
  if (!file) return;

  uploadedPcbPhotoFileName = file.name;
  uploadedPcbPhotoMimeType = file.type;

  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    uploadedPcbPhotoPreviewUrl = result;
    const base64Data = result.split(',')[1] || result;
    uploadedPcbPhotoBase64 = base64Data;

    // Refresh photo upload widget
    const uploadZone = document.getElementById('pcb-photo-upload-zone');
    if (uploadZone) {
      uploadZone.style.borderColor = 'rgba(20, 241, 149, 0.6)';
      uploadZone.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <img src="${uploadedPcbPhotoPreviewUrl}" alt="Yüklenen Kart" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 2px solid #14F195;" />
            <div style="text-align: left;">
              <div style="font-size: 0.85rem; font-weight: 700; color: #14F195; display: flex; align-items: center; gap: 0.4rem;">
                <i class="fa-solid fa-circle-check"></i> Kart Fotoğrafı Hazır
              </div>
              <div style="font-size: 0.75rem; color: #cbd5e1; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${uploadedPcbPhotoFileName}
              </div>
              <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 0.2rem;">
                Sorunuzla birlikte fotoğraftaki optokuplör ve parçalar taranacak
              </div>
            </div>
          </div>
          <button onclick="event.stopPropagation(); window.removeUploadedPcbPhoto()" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 0.4rem 0.75rem; border-radius: 8px; font-size: 0.75rem; font-weight: 700; cursor: pointer;">
            <i class="fa-solid fa-trash-can"></i> Kaldır
          </button>
        </div>
      `;
    }

    (window as any).showNotification?.(`Kart fotoğrafı yüklendi: ${file.name}`, 'success');
  };
  reader.readAsDataURL(file);
};

(window as any).removeUploadedPcbPhoto = () => {
  uploadedPcbPhotoBase64 = null;
  uploadedPcbPhotoMimeType = null;
  uploadedPcbPhotoPreviewUrl = null;
  uploadedPcbPhotoFileName = '';

  const fileInput = document.getElementById('pcb-photo-input') as HTMLInputElement;
  if (fileInput) fileInput.value = '';

  const uploadZone = document.getElementById('pcb-photo-upload-zone');
  if (uploadZone) {
    uploadZone.style.borderColor = 'rgba(56, 189, 248, 0.4)';
    uploadZone.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 0.4rem;">
        <i class="fa-solid fa-camera-retro" style="font-size: 1.8rem; color: #38bdf8;"></i>
        <div style="font-size: 0.88rem; font-weight: 700; color: #e2e8f0;">
          Fotoğraf Seçin veya Buraya Sürükleyin
        </div>
        <div style="font-size: 0.75rem; color: #94a3b8;">
          Masanızdaki kartın (Power Board vb.) net bir fotoğrafını yükleyin
        </div>
      </div>
    `;
  }
};

(window as any).askReadyQuestion = (question: string) => {
  const inputEl = document.getElementById('agent-chat-input') as HTMLTextAreaElement;
  if (inputEl) {
    inputEl.value = question;
    (window as any).sendChatMessage();
  }
};

(window as any).sendChatMessage = async () => {
  const inputEl = document.getElementById('agent-chat-input') as HTMLTextAreaElement;
  if (!inputEl || !inputEl.value.trim()) {
    alert('Lütfen arıza veya klemens hakkında bir soru yazın.');
    return;
  }

  const question = inputEl.value.trim();
  inputEl.value = '';

  const timeStr = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  // Add user message to stream
  const userMsg: ChatMessage = {
    id: 'user-' + Date.now(),
    sender: 'USER',
    text: question,
    timestamp: timeStr,
    photoPreviewUrl: uploadedPcbPhotoPreviewUrl || undefined,
    photoFileName: uploadedPcbPhotoFileName || undefined
  };
  chatHistory.push(userMsg);

  const chatFlowEl = document.getElementById('agent-chat-flow');
  if (chatFlowEl) {
    chatFlowEl.innerHTML = chatHistory.map(msg => renderChatMessageHtml(msg)).join('');
    // Loading placeholder bubble
    chatFlowEl.innerHTML += `
      <div id="ai-chat-typing-indicator" style="align-self: flex-start; max-width: 85%; background: rgba(30, 41, 59, 0.7); border: 1px dashed rgba(168, 85, 247, 0.4); border-radius: 12px; padding: 0.75rem 1rem; color: #c084fc; font-size: 0.8rem; display: flex; align-items: center; gap: 0.5rem;">
        <div style="width: 16px; height: 16px; border: 2px solid rgba(168, 85, 247, 0.3); border-top-color: #c084fc; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span>${uploadedPcbPhotoBase64 ? 'Kart fotoğrafı ve devre şeması optokuplör / IGBT hatları taranıyor...' : 'Devre şeması ve klemens hatları taranıyor...'}</span>
      </div>
    `;
    chatFlowEl.scrollTop = chatFlowEl.scrollHeight;
  }

  const sendBtn = document.getElementById('btn-send-chat') as HTMLButtonElement;
  if (sendBtn) sendBtn.disabled = true;

  try {
    const cardName = activeSapAnalysis ? activeSapAnalysis.cardName : currentSearchQuery;

    const answer = await cardSchematicAgentService.askElectronicAssistant({
      cardName,
      question,
      pcbPhotoBase64: uploadedPcbPhotoBase64 || undefined,
      pcbPhotoMimeType: uploadedPcbPhotoMimeType || undefined,
      conversationHistory: chatHistory.map(h => ({ sender: h.sender, text: h.text }))
    });

    // Remove typing indicator
    const typingIndicator = document.getElementById('ai-chat-typing-indicator');
    if (typingIndicator) typingIndicator.remove();

    // Add agent response
    const agentMsg: ChatMessage = {
      id: 'agent-' + Date.now(),
      sender: 'AGENT',
      text: answer,
      timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    };
    chatHistory.push(agentMsg);

    if (chatFlowEl) {
      chatFlowEl.innerHTML = chatHistory.map(msg => renderChatMessageHtml(msg)).join('');
      chatFlowEl.scrollTop = chatFlowEl.scrollHeight;
    }
  } catch (err: any) {
    console.error('Chat answer error:', err);
    alert('Danışman yanıt üretirken hata oluştu: ' + (err?.message || err));
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
};

(window as any).saveChatDiagnosisToJobOrder = async () => {
  const selectEl = document.getElementById('chat-assign-repair-id') as HTMLSelectElement;
  const repairId = selectEl ? selectEl.value : '';

  if (!repairId) {
    alert('Lütfen teşhisin kaydedileceği aktif bir tamir kartı seçin.');
    return;
  }

  if (chatHistory.length < 2) {
    alert('Kaydedilecek bir arıza analizi veya soru bulunamadı.');
    return;
  }

  const latestAiMsg = [...chatHistory].reverse().find(m => m.sender === 'AGENT');
  const cardTitle = activeSapAnalysis?.cardName || currentSearchQuery;
  const summary = `[AI Elektronik Şematik Teşhis]\nKart: ${cardTitle}\nÖzet Rapor: ${latestAiMsg?.text?.slice(0, 300)}...`;

  try {
    const { doc, updateDoc, arrayUnion } = await import('firebase/firestore');
    const { db } = await import('../firebase');
    await updateDoc(doc(db, 'repairs', repairId), {
      aiDiagnosisNote: summary,
      workshopNotes: arrayUnion(`[${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}] AI Şema Teşhisi: ${cardTitle} incelendi.`)
    });
    alert('Arıza teşhisi başarıyla seçilen iş emrine kaydedildi!');
  } catch (e: any) {
    console.error('Save to repair error:', e);
    alert('İş emrine kaydedilirken hata oluştu: ' + e.message);
  }
};

(window as any).openSchematicLightbox = (url: string) => {
  const modal = document.createElement('div');
  modal.id = 'schematic-lightbox-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.92)';
  modal.style.backdropFilter = 'blur(10px)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '999999';
  modal.style.padding = '1.5rem';

  modal.innerHTML = `
    <div style="position: relative; max-width: 95vw; max-height: 95vh; background: #0b1329; border: 1px solid rgba(168, 85, 247, 0.5); border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 0 50px rgba(0,0,0,0.8);">
      <div style="padding: 0.85rem 1.25rem; background: rgba(15, 23, 42, 0.95); border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between;">
        <span style="font-weight: 800; color: #f8fafc; font-size: 1rem; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
          <i class="fa-solid fa-magnifying-glass-plus" style="color: #38bdf8;"></i> DEVRE ŞEMASI YÜKSEK ÇÖZÜNÜRLÜKLÜ DETAY İNCELEME
        </span>
        <button onclick="document.getElementById('schematic-lightbox-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.3rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div style="overflow: auto; padding: 1.5rem; display: flex; justify-content: center; align-items: center;">
        <img src="${url}" style="max-width: 100%; max-height: 82vh; object-fit: contain; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);" />
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

(window as any).openEnerconGuideModal = () => {
  const modal = document.createElement('div');
  modal.id = 'enercon-guide-modal';
  modal.style.position = 'fixed';
  modal.style.inset = '0';
  modal.style.backgroundColor = 'rgba(0, 0, 0, 0.88)';
  modal.style.backdropFilter = 'blur(10px)';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '999999';
  modal.style.padding = '1.5rem';

  modal.innerHTML = `
    <div style="position: relative; width: 100%; max-width: 800px; max-height: 85vh; background: #0f172a; border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; color: #f8fafc; font-family: 'Inter', sans-serif;">
      <div style="padding: 1rem 1.5rem; background: rgba(30, 41, 59, 0.8); border-bottom: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 0.6rem;">
          <i class="fa-solid fa-book-open" style="color: #60a5fa; font-size: 1.2rem;"></i>
          <span style="font-weight: 800; font-size: 1.05rem; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
            ENERCON DEVRE ŞEMASI OKUMA KILAVUZU (SQA SERİSİ)
          </span>
        </div>
        <button onclick="document.getElementById('enercon-guide-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
        
        <div style="background: rgba(30, 41, 59, 0.5); border-radius: 12px; padding: 1rem;">
          <h4 style="margin: 0 0 0.5rem 0; color: #38bdf8; font-size: 0.9rem;">1. Genel Şema ve Bölge Kodları (DIN Standartları)</h4>
          <p style="font-size: 0.8rem; color: #cbd5e1; margin: 0 0 0.5rem 0;">
            Şemalar <strong>DIN 40900</strong> ve <strong>DIN 40719-1</strong> standartlarına göre çizilir.
          </p>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; font-size: 0.78rem;">
            <div style="background: #1e293b; padding: 0.5rem; border-radius: 6px;"><strong>T:</strong> Tower (Kule)</div>
            <div style="background: #1e293b; padding: 0.5rem; border-radius: 6px;"><strong>N:</strong> Nacelle (Gondol)</div>
            <div style="background: #1e293b; padding: 0.5rem; border-radius: 6px;"><strong>R:</strong> Rotor (Kanat/Göbek)</div>
          </div>
        </div>

        <div style="background: rgba(30, 41, 59, 0.5); border-radius: 12px; padding: 1rem;">
          <h4 style="margin: 0 0 0.5rem 0; color: #38bdf8; font-size: 0.9rem;">2. Parça ve Tesisat Kodlama Standardı</h4>
          <div style="font-family: monospace; font-size: 0.9rem; color: #14F195; background: #020617; padding: 0.6rem 0.85rem; border-radius: 8px; margin-bottom: 0.5rem;">
            =Tesisat +Konum -Komponent :Pin (Örn: =011+A-X10:1 veya =006-K01.2)
          </div>
          <ul style="font-size: 0.78rem; color: #cbd5e1; margin: 0; padding-left: 1.2rem; line-height: 1.5;">
            <li><strong>=011+A:</strong> Kanat Kontrol Panosu (Pitch Box)</li>
            <li><strong>-A02:</strong> Steuerkarte Pitch (Pitch Kontrol Kartı)</li>
            <li><strong>-A03:</strong> Power Modul Pitch (Motor Güç & IGBT Kartı)</li>
            <li><strong>-B01:</strong> Winkelcodierer (Açı Enkoderi)</li>
            <li><strong>-J04:</strong> Schleifring / Döner Hız Sensörü</li>
            <li><strong>-X10:</strong> Motor Güç Modülü Çıkış Klemensi</li>
            <li><strong>-X11:</strong> Kanat Mekanik Fren Klemensi</li>
          </ul>
        </div>

        <div style="background: rgba(30, 41, 59, 0.5); border-radius: 12px; padding: 1rem;">
          <h4 style="margin: 0 0 0.5rem 0; color: #38bdf8; font-size: 0.9rem;">3. 8 Kolon Düzeni ve Çapraz Referans (Cross-Reference)</h4>
          <p style="font-size: 0.8rem; color: #cbd5e1; margin: 0; line-height: 1.5;">
            Her şema sayfası 8 dikey kolona (1..8) ayrılmıştır. Bir sinyal hattı sayfanın kenarına ulaştığında 
            <code>/Sayfa.Kolon</code> ile referans verilir (Örn: <code>30.6</code> -> Sayfa 30, Kolon 6). 
            Eğer hat başka bir tesisata gidiyorsa sayfanın alt kısmında gösterilir (Örn: <code>=076/1.4</code>).
          </p>
        </div>

      </div>
    </div>
  `;
  document.body.appendChild(modal);
};
