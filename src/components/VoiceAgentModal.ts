/**
 * src/components/VoiceAgentModal.ts
 * Cyber-styled Voice Assistant Modal UI Component.
 */

import { voiceAgentService } from '../services/VoiceAgentService';
import type { VoiceState, VoiceTaskDraft, VoiceMessage } from '../services/VoiceAgentService';

let isModalOpen = false;

export function renderVoiceAgentModal() {
  let existing = document.getElementById('voice-agent-modal-root');
  if (!existing) {
    existing = document.createElement('div');
    existing.id = 'voice-agent-modal-root';
    document.body.appendChild(existing);
  }

  if (!isModalOpen) {
    existing.innerHTML = '';
    return;
  }

  existing.innerHTML = `
    <div style="position: fixed; inset: 0; z-index: 99999; background: rgba(10, 15, 25, 0.85); backdrop-filter: blur(16px); display: flex; align-items: center; justify-content: center; padding: 1rem; animation: fadeIn 0.25s ease-out;">
      <div style="position: relative; width: 100%; max-width: 540px; background: rgba(13, 18, 30, 0.95); border: 1px solid rgba(20, 241, 149, 0.3); box-shadow: 0 0 50px rgba(20, 241, 149, 0.2), inset 0 0 20px rgba(20, 241, 149, 0.05); border-radius: 24px; padding: 2rem; color: #fff; font-family: 'Rajdhani', sans-serif; overflow: hidden; display: flex; flex-direction: column; gap: 1.25rem;">
        
        <!-- Cyber Scanlines -->
        <div class="cyber-scanlines" style="position: absolute; inset: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.04), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.04)); background-size: 100% 4px, 6px 100%; pointer-events: none; opacity: 0.4;"></div>

        <!-- Header -->
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem; position: relative; z-index: 2;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #14F195, #00f2fe); display: flex; align-items: center; justify-content: center; color: #0d121e; font-size: 1.25rem; box-shadow: 0 0 15px rgba(20,241,149,0.4);">
              <i class="fa-solid fa-microphone-lines"></i>
            </div>
            <div>
              <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; letter-spacing: 1.5px; background: linear-gradient(90deg, #14F195, #00f2fe); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                DH-SERVİS AI SESLİ ASİSTAN
              </h3>
              <p style="margin: 0; font-size: 0.75rem; color: #94A3B8; font-weight: 600; font-family: 'Inter', sans-serif;">
                Sesli Müşteri Hizmetleri & Saha Görev Asistanı
              </p>
            </div>
          </div>
          <button onclick="window.closeVoiceAgentModal()" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94A3B8; width: 36px; height: 36px; border-radius: 10px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.color='#fff'; this.style.borderColor='rgba(255,255,255,0.3)';" onmouseout="this.style.color='#94A3B8'; this.style.borderColor='rgba(255,255,255,0.1)';">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Soundwave / Pulsing Mic Visualizer -->
        <div id="voice-soundwave-container" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 0.5rem 0; position: relative; z-index: 2;">
          <div id="voice-mic-circle" style="width: 64px; height: 64px; border-radius: 50%; background: rgba(20, 241, 149, 0.1); border: 2px solid #14F195; display: flex; align-items: center; justify-content: center; color: #14F195; font-size: 1.6rem; box-shadow: 0 0 25px rgba(20, 241, 149, 0.3); transition: all 0.3s; position: relative;">
            <i id="voice-mic-icon" class="fa-solid fa-microphone"></i>
          </div>
          <p id="voice-status-indicator" style="margin: 0.5rem 0 0 0; font-size: 0.8rem; color: #14F195; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
            HAZIR
          </p>
        </div>

        <!-- Quick Voice Question Chips -->
        <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; position: relative; z-index: 2;">
          <button onclick="window.askVoiceSample('42 ye 305 arızası nedir?')" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; white-space: nowrap; cursor: pointer;">
            ⚠️ 42 ye 305 Nedir?
          </button>
          <button onclick="window.askVoiceSample('bana 50 ye 14 arıza kaydı açarmısın')" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #F59E0B; font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; white-space: nowrap; cursor: pointer;">
            ⚡ 50 ye 14 Kayıt Aç
          </button>
          <button onclick="window.askVoiceSample('Mare\\'den en son nereye malzeme sevki yapıldı?')" style="background: rgba(0, 242, 254, 0.1); border: 1px solid rgba(0, 242, 254, 0.3); color: #00F2FE; font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; white-space: nowrap; cursor: pointer;">
            🚚 Mare Son Sevk?
          </button>
          <button onclick="window.askVoiceSample('Anemon deposunda CS82 var mı?')" style="background: rgba(20, 241, 149, 0.1); border: 1px solid rgba(20, 241, 149, 0.3); color: #14F195; font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; white-space: nowrap; cursor: pointer;">
            📦 Anemon Stok?
          </button>
          <button onclick="window.askVoiceSample('Team 04 ekibine zimmetli aletler neler?')" style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); color: #F59E0B; font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; white-space: nowrap; cursor: pointer;">
            🔧 Team 04 Zimmet?
          </button>
          <button onclick="window.askVoiceSample('İş emri oluşturmak istiyorum')" style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); color: #A855F7; font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; white-space: nowrap; cursor: pointer;">
            ➕ Yeni İş Emri
          </button>
        </div>

        <!-- Step Indicator Bar -->
        <div id="voice-step-bar" style="display: flex; gap: 6px; position: relative; z-index: 2;">
          <div class="voice-step-pill" id="step-pill-1" style="flex: 1; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; text-align: center; font-size: 0.7rem; font-weight: 700; color: #64748B;">1. Türbin</div>
          <div class="voice-step-pill" id="step-pill-2" style="flex: 1; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; text-align: center; font-size: 0.7rem; font-weight: 700; color: #64748B;">2. İş Tipi</div>
          <div class="voice-step-pill" id="step-pill-3" style="flex: 1; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; text-align: center; font-size: 0.7rem; font-weight: 700; color: #64748B;">3. Detay</div>
          <div class="voice-step-pill" id="step-pill-4" style="flex: 1; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; text-align: center; font-size: 0.7rem; font-weight: 700; color: #64748B;">4. Ekip</div>
          <div class="voice-step-pill" id="step-pill-5" style="flex: 1; padding: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; text-align: center; font-size: 0.7rem; font-weight: 700; color: #64748B;">5. Onay</div>
        </div>

        <!-- Chat Conversation Area -->
        <div id="voice-chat-box" style="height: 200px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; padding: 0.75rem; background: rgba(0,0,0,0.3); border-radius: 14px; border: 1px solid rgba(255,255,255,0.05); font-family: 'Inter', sans-serif; position: relative; z-index: 2;">
          <!-- Messages will be rendered here dynamically -->
        </div>

        <!-- Footer Action Buttons -->
        <div style="display: flex; gap: 0.75rem; position: relative; z-index: 2; margin-top: 0.5rem;">
          <button id="btn-toggle-mic" onclick="window.toggleVoiceMic()" class="btn-cyber" style="flex: 1; height: 42px; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.85rem;">
            <i class="fa-solid fa-microphone"></i> <span>DİNLEMEYİ BAŞLAT</span>
          </button>
          <button onclick="window.closeVoiceAgentModal()" style="height: 42px; padding: 0 1.25rem; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; border-radius: 10px; font-weight: 700; font-family: 'Rajdhani', sans-serif; cursor: pointer;">
            İPTAL
          </button>
        </div>

      </div>
    </div>
  `;

  // Subscribe to service updates
  voiceAgentService.subscribe((state, draft, messages, isListening, isSpeaking) => {
    updateModalUI(state, draft, messages, isListening, isSpeaking);
  });
}

function updateModalUI(state: VoiceState, draft: VoiceTaskDraft, messages: VoiceMessage[], isListening: boolean, isSpeaking: boolean) {
  const chatBox = document.getElementById('voice-chat-box');
  const micCircle = document.getElementById('voice-mic-circle');
  const micIcon = document.getElementById('voice-mic-icon');
  const statusIndicator = document.getElementById('voice-status-indicator');
  const toggleBtn = document.getElementById('btn-toggle-mic');

  if (!chatBox) return;

  // Render messages
  chatBox.innerHTML = messages.map(msg => `
    <div style="display: flex; flex-direction: column; align-items: ${msg.sender === 'ai' ? 'flex-start' : 'flex-end'};">
      <div style="max-width: 85%; padding: 0.6rem 0.9rem; border-radius: ${msg.sender === 'ai' ? '12px 12px 12px 2px' : '12px 12px 2px 12px'}; background: ${msg.sender === 'ai' ? 'rgba(20, 241, 149, 0.12)' : 'rgba(0, 242, 254, 0.15)'}; border: 1px solid ${msg.sender === 'ai' ? 'rgba(20, 241, 149, 0.25)' : 'rgba(0, 242, 254, 0.3)'}; color: #E2E8F0; font-size: 0.85rem; line-height: 1.4;">
        ${msg.text}
      </div>
    </div>
  `).join('');

  chatBox.scrollTop = chatBox.scrollHeight;

  // Update Status & Microphone animation
  if (micCircle && statusIndicator && micIcon) {
    if (isSpeaking) {
      micCircle.style.borderColor = '#00F2FE';
      micCircle.style.boxShadow = '0 0 35px rgba(0, 242, 254, 0.6)';
      micIcon.className = 'fa-solid fa-volume-high';
      statusIndicator.style.color = '#00F2FE';
      statusIndicator.innerText = 'ASİSTAN KONUŞUYOR...';
    } else if (isListening) {
      micCircle.style.borderColor = '#14F195';
      micCircle.style.boxShadow = '0 0 35px rgba(20, 241, 149, 0.6)';
      micIcon.className = 'fa-solid fa-microphone-lines';
      statusIndicator.style.color = '#14F195';
      statusIndicator.innerText = 'SİZİ DİNLİYOR... (KONUŞUN)';
    } else {
      micCircle.style.borderColor = 'rgba(255,255,255,0.2)';
      micCircle.style.boxShadow = 'none';
      micIcon.className = 'fa-solid fa-microphone';
      statusIndicator.style.color = '#94A3B8';
      statusIndicator.innerText = state === 'COMPLETED' ? 'İŞ EMRİ OLUŞTURULDU ✅' : 'BEKLEMEDE';
    }
  }

  // Update step pills
  const stepMap: Record<VoiceState, number> = {
    'IDLE': 0,
    'ASK_TURBINE': 1,
    'ASK_TYPE': 2,
    'ASK_DESCRIPTION': 3,
    'ASK_TEAM': 4,
    'CONFIRM': 5,
    'COMPLETED': 5,
    'CANCELLED': 0
  };

  const activeStep = stepMap[state] || 0;
  for (let i = 1; i <= 5; i++) {
    const pill = document.getElementById(`step-pill-${i}`);
    if (pill) {
      if (i <= activeStep) {
        pill.style.background = 'rgba(20, 241, 149, 0.2)';
        pill.style.borderColor = '#14F195';
        pill.style.color = '#14F195';
      } else {
        pill.style.background = 'rgba(255,255,255,0.05)';
        pill.style.borderColor = 'rgba(255,255,255,0.1)';
        pill.style.color = '#64748B';
      }
    }
  }
}

// Global window actions
(window as any).openVoiceAgentModal = () => {
  isModalOpen = true;
  renderVoiceAgentModal();
  voiceAgentService.startSession();
};

(window as any).closeVoiceAgentModal = () => {
  isModalOpen = false;
  voiceAgentService.stopSession();
  renderVoiceAgentModal();
};

(window as any).toggleVoiceMic = () => {
  voiceAgentService.startListening();
};

(window as any).askVoiceSample = (sampleText: string) => {
  voiceAgentService.handleUserInput(sampleText);
};
