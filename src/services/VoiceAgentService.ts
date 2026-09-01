/**
 * src/services/VoiceAgentService.ts
 * Universal AI Voice Agent for DH-Servis using Web Speech API & Firestore Data Services.
 * Answers voice queries for Transfers, Inventory, Custody, Service Reports, Faults, and Task Creation.
 */

import { dataService } from './DataService';
import { taskService } from './TaskService';
import { transferService } from './TransferService';
import { assetCustodyService } from './AssetCustodyService';
import { serviceReportService } from './ServiceReportService';
import { warehouseService } from './WarehouseService';
import { aiService } from './AiService';

export type VoiceState = 'IDLE' | 'ASK_TURBINE' | 'ASK_TYPE' | 'ASK_DESCRIPTION' | 'ASK_TEAM' | 'CONFIRM' | 'COMPLETED' | 'CANCELLED';

export interface VoiceMessage {
  sender: 'ai' | 'user';
  text: string;
  timestamp: number;
}

export interface VoiceTaskDraft {
  siteId?: string;
  siteName?: string;
  turbineNo?: string;
  turbineSerial?: string;
  taskType?: 'Arıza' | 'Bakım' | 'Kontrol';
  description?: string;
  assignedTeam?: string;
}

export type VoiceStateCallback = (
  state: VoiceState, 
  draft: VoiceTaskDraft, 
  messages: VoiceMessage[], 
  isListening: boolean, 
  isSpeaking: boolean
) => void;

class VoiceAgentService {
  private recognition: any = null;
  private synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private state: VoiceState = 'IDLE';
  private draft: VoiceTaskDraft = {};
  private messages: VoiceMessage[] = [];
  private isListening = false;
  private isSpeaking = false;
  private callback: VoiceStateCallback | null = null;
  private isSupported = false;

  constructor() {
    this.initSpeechRecognition();
  }

  private initSpeechRecognition() {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      this.isSupported = true;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'tr-TR';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.notify();
      };

      this.recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript.trim()) {
          this.handleUserInput(finalTranscript.trim());
        }
      };

      this.recognition.onerror = (event: any) => {
        console.warn('[VoiceAgent] Speech recognition error:', event.error);
        this.isListening = false;
        this.notify();
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.notify();
      };
    }
  }

  public checkSupport(): boolean {
    return this.isSupported;
  }

  public subscribe(cb: VoiceStateCallback) {
    this.callback = cb;
    this.notify();
  }

  private notify() {
    if (this.callback) {
      this.callback(this.state, { ...this.draft }, [...this.messages], this.isListening, this.isSpeaking);
    }
  }

  public speak(text: string, onEnd?: () => void) {
    if (!this.synth) {
      if (onEnd) onEnd();
      return;
    }

    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const voices = this.synth.getVoices();
    const trVoice = voices.find(v => v.lang.includes('tr') || v.lang.includes('TR'));
    if (trVoice) {
      utterance.voice = trVoice;
    }

    this.isSpeaking = true;
    this.notify();

    utterance.onend = () => {
      this.isSpeaking = false;
      this.notify();
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.notify();
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  public startListening() {
    if (!this.recognition || this.isListening) return;
    try {
      this.recognition.start();
    } catch (e) {
      console.warn('[VoiceAgent] Could not start recognition:', e);
    }
  }

  public stopListening() {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch (e) {}
    }
  }

  public startSession() {
    this.state = 'IDLE';
    this.draft = {};
    this.messages = [];
    
    const welcomeText = "Demirer Holding Evrensel Sesli Asistanına hoş geldiniz! İş emri açabilir veya sevk, stok, zimmet ve arızalarla ilgili her şeyi sorabilirsiniz.";
    this.addMessage('ai', welcomeText);
    
    this.speak(welcomeText, () => {
      this.startListening();
    });
  }

  public stopSession() {
    if (this.synth) this.synth.cancel();
    this.stopListening();
    this.state = 'IDLE';
    this.isListening = false;
    this.isSpeaking = false;
    this.notify();
  }

  private addMessage(sender: 'ai' | 'user', text: string) {
    this.messages.push({ sender, text, timestamp: Date.now() });
    this.notify();
  }

  public async handleUserInput(text: string) {
    this.addMessage('user', text);
    this.stopListening();

    const lower = text.toLowerCase().trim();

    // Check for cancel / restart keywords
    if (lower.includes('iptal') || lower.includes('vazgeç') || lower.includes('kapat')) {
      const cancelText = "Sesli asistan oturumu sonlandırıldı.";
      this.state = 'CANCELLED';
      this.addMessage('ai', cancelText);
      this.speak(cancelText);
      return;
    }

    // Work order creation state machine overrides
    if (this.state !== 'IDLE') {
      switch (this.state) {
        case 'ASK_TURBINE':
          this.processTurbineState(lower);
          return;
        case 'ASK_TYPE':
          this.processTypeState(lower);
          return;
        case 'ASK_DESCRIPTION':
          this.processDescriptionState(text);
          return;
        case 'ASK_TEAM':
          this.processTeamState(lower);
          return;
        case 'CONFIRM':
          this.processConfirmState(lower);
          return;
        default:
          break;
      }
    }

    // IDLE State: Route Intent (Transfer, Stock, Custody, Report, Fault, Work Order, AI Chat)
    await this.routeGlobalQuery(text, lower);
  }

  private async routeGlobalQuery(originalText: string, lower: string) {
    // 0. Pending Transfer Confirmation Check
    if (this.pendingTransferOffer) {
      if (lower.includes('evet') || lower.includes('başlat') || lower.includes('oluştur') || lower.includes('tamam') || lower.includes('sevk') || lower.includes('olur')) {
        const offer = this.pendingTransferOffer;
        this.pendingTransferOffer = null;

        try {
          await transferService.createMultiItemTransfer({
            fromSiteId: offer.fromSiteId,
            toSiteId: offer.toSiteId,
            items: [{
              materialCode: offer.sapNo,
              materialName: offer.materialName,
              quantity: offer.qty,
              condition: 'NEW'
            }],
            deliveryMethod: 'CARGO',
            status: 'YOLDA',
            requestedBy: 'Sesli AI Asistan'
          });

          const reply = `Anlaşıldı! ${offer.fromSiteName} deposundan ${offer.toSiteName} deposuna 1 adet ${offer.sapNo} SAP kodlu ${offer.materialName} için MSF Sevk Talebi oluşturuldu ve onay yetkilisine iletildi!`;
          this.addMessage('ai', reply);
          this.speak(reply);
          return;
        } catch (err) {
          console.error('[VoiceAgent] Transfer creation failed:', err);
          const errReply = "MSF Sevk talebi oluşturulurken bir hata oluştu.";
          this.addMessage('ai', errReply);
          this.speak(errReply);
          return;
        }
      } else if (lower.includes('hayır') || lower.includes('iptal') || lower.includes('istemiyorum') || lower.includes('vazgeç')) {
        this.pendingTransferOffer = null;
        const reply = "Sevk talebi iptal edildi. Başka nasıl yardımcı olabilirim?";
        this.addMessage('ai', reply);
        this.speak(reply, () => this.startListening());
        return;
      }
    }

    // 1. SCADA Spoken Fault Code Pattern Recognition ('42 ye 305', '60 a 14', '50 ye 14')
    const scadaMatch = lower.match(/(\d+)\s*(?:ye|ya|e|a)\s*(\d+)/i);
    if (scadaMatch) {
      const code1 = scadaMatch[1];
      const code2 = scadaMatch[2];
      const fullFaultCode = `${code1}:${code2}`;

      if (lower.includes('aç') || lower.includes('kayıt') || lower.includes('oluştur') || lower.includes('görev')) {
        // Direct Work Order Creation for SCADA Fault Code
        this.draft.turbineSerial = code1;
        this.draft.turbineNo = code1;
        this.draft.siteName = 'Anemon İntepe';
        this.draft.siteId = '2688';
        this.draft.taskType = 'Arıza';
        this.draft.description = `SCADA ${fullFaultCode} arıza uyarısı`;
        
        this.state = 'ASK_TEAM';
        const prompt = `${code1} numaralı türbin için ${fullFaultCode} arıza kaydı başlatıldı. Görevi hangi ekibe atamak istersiniz? Örnegin Team 04.`;
        this.addMessage('ai', prompt);
        this.speak(prompt, () => this.startListening());
        return;
      } else {
        // Fault Code Inquiry ('42 ye 305 arızası nedir')
        await this.handleScadaFaultInquiry(fullFaultCode, code1, code2, originalText);
        return;
      }
    }

    // 2. Task Creation Intent
    if (lower.includes('iş emri') || lower.includes('görev aç') || lower.includes('görev oluştur') || lower.includes('arıza kaydı aç')) {
      this.state = 'ASK_TURBINE';
      const prompt = "Anlaşıldı, yeni bir iş emri oluşturuyoruz. İş emri hangi türbin için? Türbin numarasını veya seri numarasını söyler misiniz?";
      this.addMessage('ai', prompt);
      this.speak(prompt, () => this.startListening());
      return;
    }

    // 2. Transfer / Sevk Queries
    if (lower.includes('sevk') || lower.includes('transfer') || lower.includes('gönderil') || lower.includes('msf')) {
      await this.handleTransferQuery(lower);
      return;
    }

    // 3. Custody / Zimmet Queries
    if (lower.includes('zimmet') || lower.includes('üzerinde') || lower.includes('alet') || lower.includes('ekipte var mı')) {
      await this.handleCustodyQuery(lower);
      return;
    }

    // 4. Stock / Inventory Queries
    if (lower.includes('stok') || lower.includes('kaç tane') || lower.includes('var mı') || lower.includes('depo')) {
      await this.handleStockQuery(lower);
      return;
    }

    // 5. Service Report / Past Work Queries
    if (lower.includes('rapor') || lower.includes('son yapılan') || lower.includes('müdahale') || lower.includes('ne yapılmış')) {
      await this.handleReportQuery(lower);
      return;
    }

    // 6. General AI & Small Talk Fallback
    await this.handleGeneralAiQuery(originalText);
  }

  private async handleScadaFaultInquiry(fullFaultCode: string, code1: string, code2: string, originalText: string) {
    try {
      const prompt = `SCADA arıza kodu ${fullFaultCode} (yani ${code1} ye ${code2} arızası). Bu arıza kodu ne anlama geliyor, neyi kontrol etmek gerekir?`;
      const contextStr = `Türbin SCADA sistemi arıza kodu: ${fullFaultCode}. Ana modül: ${code1}, Alt hata kodu: ${code2}.`;
      
      const reply = await aiService.askHumanLikeAgent(prompt, contextStr);
      this.addMessage('ai', reply);
      this.speak(reply, () => this.startListening());
    } catch (e) {
      const fallback = `${fullFaultCode} arıza kodu: SCADA ve dönüştürücü haberleşme/sensör hatasıdır. Lütfen pano sigortalarını ve sensör hatlarını kontrol edin.`;
      this.addMessage('ai', fallback);
      this.speak(fallback, () => this.startListening());
    }
  }

  // --- QUERY HANDLERS ---

  private async handleTransferQuery(lower: string) {
    try {
      const transfers = await transferService.getTransfers();
      if (!transfers || transfers.length === 0) {
        const reply = "Sistemde henüz kaydedilmiş bir sevk veya transfer kaydı bulunmuyor.";
        this.addMessage('ai', reply);
        this.speak(reply);
        return;
      }

      // Filter transfers if user named a site (e.g. Mare, Anemon, Germiyan)
      const sites = dataService.getAllSites();
      let targetSite = sites.find(s => lower.includes(s.name.toLowerCase()) || lower.includes(s.name.toLowerCase().replace('alize', '').trim()));
      
      let matchedTransfers = transfers;
      if (targetSite) {
        matchedTransfers = transfers.filter((t: any) => t.fromSiteId === targetSite?.id || t.toSiteId === targetSite?.id);
      }

      const latest: any = matchedTransfers[0] || transfers[0];
      const fromSiteName = dataService.resolveName(latest.fromSiteId || latest.fromSite);
      const toSiteName = dataService.resolveName(latest.toSiteId || latest.toSite);
      const dateStr = latest.createdAt?.toDate ? latest.createdAt.toDate().toLocaleDateString('tr-TR') : 'yakın zamanda';
      const userStr = latest.shippedBy || latest.requestedBy || 'İlgili Personel';

      const itemCount = latest.items ? latest.items.length : 1;
      const itemName = latest.items && latest.items[0] ? latest.items[0].materialName : (latest.materialName || 'malzeme');

      const reply = `${fromSiteName} deposundan en son ${dateStr} tarihinde ${toSiteName} deposuna ${itemCount} kalem ${itemName} sevk edildi. İşlemi yapan: ${userStr}.`;
      this.addMessage('ai', reply);
      this.speak(reply, () => this.startListening());
    } catch (e) {
      const errReply = "Sevk kayıtları sorgulanırken bir hata oluştu.";
      this.addMessage('ai', errReply);
      this.speak(errReply);
    }
  }

  private pendingTransferOffer: {
    fromSiteId: string;
    fromSiteName: string;
    toSiteId: string;
    toSiteName: string;
    sapNo: string;
    materialName: string;
    qty: number;
  } | null = null;

  private async handleStockQuery(originalText: string) {
    try {
      const lower = originalText.toLowerCase();
      const warehouses = dataService.getWarehouses();
      
      let targetWh = warehouses.find(w => lower.includes(w.name.toLowerCase()) || lower.includes(w.name.toLowerCase().replace('depo', '').trim()));
      if (!targetWh && lower.includes('anemon')) targetWh = warehouses.find(w => w.id === '2688');
      
      const whId = targetWh ? targetWh.id : '2688';
      const whName = targetWh ? targetWh.name : 'Anemon İntepe Depo';

      // Extract search term (SAP number or description keyword)
      const digitsOnly = originalText.replace(/\D/g, '');
      const searchWord = digitsOnly.length >= 4 ? digitsOnly : originalText.replace(/nasılsın|şu an|arızadayım|bana|lazım|stok|var mı|kaç tane|depo|deposunda|malzeme/gi, '').trim();

      const targetInventory = await warehouseService.getInventory(whId);
      const matchedTarget = targetInventory.filter(i => 
        (i.sapNo && i.sapNo.includes(searchWord)) || 
        (i.description && i.description.toLowerCase().includes(searchWord.toLowerCase()))
      );

      const hasStockInTarget = matchedTarget.length > 0 && matchedTarget[0].quantity > 0;

      if (hasStockInTarget) {
        const item = matchedTarget[0];
        const contextStr = `${whName} deposunda ${item.sapNo} SAP kodlu ${item.description} malzemesinden ${item.quantity} adet sağlam stok bulunmaktadır.`;
        const reply = await aiService.askHumanLikeAgent(originalText, contextStr);
        this.addMessage('ai', reply);
        this.speak(reply, () => this.startListening());
        return;
      }

      // Stock is missing or 0 in target warehouse -> Perform Cross-Warehouse Scanning across all 11 warehouses!
      const availableOtherWhs: { id: string; name: string; qty: number; sapNo: string; desc: string }[] = [];

      for (const wh of warehouses) {
        if (wh.id === whId) continue;
        const inv = await warehouseService.getInventory(wh.id);
        const match = inv.find(i => 
          (i.sapNo && i.sapNo.includes(searchWord)) || 
          (i.description && i.description.toLowerCase().includes(searchWord.toLowerCase()))
        );
        if (match && match.quantity > 0) {
          availableOtherWhs.push({
            id: wh.id,
            name: wh.name,
            qty: match.quantity,
            sapNo: match.sapNo || '66583',
            desc: match.description || 'Malzeme'
          });
        }
      }

      if (availableOtherWhs.length > 0) {
        const topAvailable = availableOtherWhs.slice(0, 2);
        const bestSource = topAvailable[0];

        // Store pending transfer proposal
        this.pendingTransferOffer = {
          fromSiteId: bestSource.id,
          fromSiteName: bestSource.name,
          toSiteId: whId,
          toSiteName: whName,
          sapNo: bestSource.sapNo,
          materialName: bestSource.desc,
          qty: 1
        };

        const whListStr = topAvailable.map(a => `${a.name} deposunda ${a.qty} adet`).join(', ');
        const contextStr = `${whName} deposunda ${bestSource.sapNo} SAP kodlu ${bestSource.desc} malzemesi şu an tükenmiş durumda. Ancak yakın alternatif depolardan ${whListStr} stok bulunmaktadır. İsterseniz ${bestSource.name} deposundan ${whName} deposuna MSF sevk talebini hemen başlatabilirim.`;

        const reply = await aiService.askHumanLikeAgent(originalText, contextStr);
        this.addMessage('ai', reply);
        this.speak(reply, () => this.startListening());
      } else {
        const contextStr = `${whName} deposunda ve diğer 10 santral deposunda ${searchWord} malzemesinden stok bulunamadı. Satın alma talebi açmak ister misiniz?`;
        const reply = await aiService.askHumanLikeAgent(originalText, contextStr);
        this.addMessage('ai', reply);
        this.speak(reply, () => this.startListening());
      }
    } catch (e) {
      console.error('[VoiceAgent] Stock query error:', e);
      const reply = "Depo stokları kontrol edilirken bir hata oluştu.";
      this.addMessage('ai', reply);
      this.speak(reply);
    }
  }

  private async handleCustodyQuery(lower: string) {
    try {
      const items = await assetCustodyService.getAll();
      if (!items || items.length === 0) {
        const reply = "Sistemde kayıtlı zimmetli alet veya ekipman bulunamadı.";
        this.addMessage('ai', reply);
        this.speak(reply);
        return;
      }

      // Filter by team or person if mentioned
      const matched = items.filter(i => 
        (i.assignedTeam && lower.includes(i.assignedTeam.toLowerCase())) ||
        (i.assignedTo && lower.includes(i.assignedTo.toLowerCase())) ||
        (i.productName && lower.includes(i.productName.toLowerCase()))
      );

      if (matched.length > 0) {
        const first = matched[0];
        const assignee = first.assignedTo || first.assignedTeam || 'İlgili birim';
        const reply = `${assignee} üzerinde ${first.quantity || 1} adet ${first.productName} (${first.condition === 'saglam' ? 'Sağlam' : 'Arızalı'}) zimmetli görünmektedir.`;
        this.addMessage('ai', reply);
        this.speak(reply, () => this.startListening());
      } else {
        const first = items[0];
        const reply = `Sistemde ${items.length} adet zimmetli alet var. Örnek: ${first.assignedTeam || first.assignedTo} üzerinde ${first.productName} bulunuyor.`;
        this.addMessage('ai', reply);
        this.speak(reply, () => this.startListening());
      }
    } catch (e) {
      const reply = "Zimmet kayıtları sorgulanırken bir sorun oluştu.";
      this.addMessage('ai', reply);
      this.speak(reply);
    }
  }

  private async handleReportQuery(lower: string) {
    try {
      const reports = await serviceReportService.getAllReports();
      if (!reports || reports.length === 0) {
        const reply = "Sistemde henüz kayıtlı servis raporu bulunmuyor.";
        this.addMessage('ai', reply);
        this.speak(reply);
        return;
      }

      const latest = reports[0];
      const turbineStr = (latest as any).turbineNo || (latest as any).turbineName || '';
      const reply = `En son servis raporu: ${latest.siteName || ''} türbin ${turbineStr} için ${latest.type || 'Bakım'} raporudur. Rapor No: ${latest.reportNo || 'Bilinmiyor'}.`;
      this.addMessage('ai', reply);
      this.speak(reply, () => this.startListening());
    } catch (e) {
      const reply = "Servis raporları sorgulanırken hata oluştu.";
      this.addMessage('ai', reply);
      this.speak(reply);
    }
  }

  private async handleGeneralAiQuery(promptText: string) {
    try {
      const thinkingMsg = "Sorunuzu yapay zeka ile inceliyorum...";
      this.addMessage('ai', thinkingMsg);
      
      const aiReply = await aiService.askAgent(promptText, 'Sen DH-Servis rüzgar türbini teknik ve saha asistanısın. Teknisyene kısa, nazik, anlaşılır ve yardımsever Türkçe yanıt ver.');
      
      // Replace last thinking message with actual AI answer
      this.messages.pop();
      const cleanAnswer = aiReply || "Size nasıl yardımcı olabilirim? İş emri açabilir veya depo stoklarını sorgulayabilirim.";
      
      this.addMessage('ai', cleanAnswer);
      this.speak(cleanAnswer, () => this.startListening());
    } catch (e) {
      const fallback = "Ben DH-Servis Sesli Asistanıyım. 'İş emri oluştur', 'Mare sevkleri' veya 'Anemon stokları' şeklinde bana soru sorabilirsiniz.";
      this.addMessage('ai', fallback);
      this.speak(fallback, () => this.startListening());
    }
  }

  // --- WORK ORDER TASK CREATION HELPERS ---

  public parseTurbineInput(input: string): { siteId: string; siteName: string; serial: string; no: string } | null {
    const digitsOnly = input.replace(/\D/g, '');
    const sites = dataService.getAllSites();

    for (const site of sites) {
      const turbines = dataService.getTurbinesBySite(site.id);
      for (const t of turbines) {
        const serialStr = (t as any).serial || t.id || '';
        if (digitsOnly && serialStr.includes(digitsOnly)) {
          return { siteId: site.id, siteName: site.name, serial: serialStr, no: String(t.no) };
        }
        if (input.includes(serialStr) || input.includes(String(t.no))) {
          return { siteId: site.id, siteName: site.name, serial: serialStr, no: String(t.no) };
        }
      }
    }

    for (const site of sites) {
      const cleanSite = site.name.toLowerCase().replace('alize', '').replace('res', '').trim();
      if (input.includes(cleanSite) || input.includes(site.name.toLowerCase())) {
        const turbines = dataService.getTurbinesBySite(site.id);
        const targetTurbine = turbines[0] || { id: '41193', no: 1 };
        const targetSerial = (targetTurbine as any).serial || targetTurbine.id;
        return { siteId: site.id, siteName: site.name, serial: targetSerial, no: String(targetTurbine.no) };
      }
    }

    if (digitsOnly.length >= 2) {
      return { siteId: '2688', siteName: 'Anemon İntepe', serial: digitsOnly, no: digitsOnly };
    }

    return null;
  }

  private processTurbineState(lower: string) {
    const matched = this.parseTurbineInput(lower);
    if (matched) {
      this.draft.siteId = matched.siteId;
      this.draft.siteName = matched.siteName;
      this.draft.turbineSerial = matched.serial;
      this.draft.turbineNo = matched.no;

      this.state = 'ASK_TYPE';
      const prompt = `${matched.serial} numaralı ${matched.siteName} türbini seçildi. İşlem türü nedir? Arıza mı, Bakım mı, yoksa Kontrol mü?`;
      this.addMessage('ai', prompt);
      this.speak(prompt, () => this.startListening());
    } else {
      const prompt = "Türbin numarasını anlayamadım. Lütfen türbin seri numarasını tekrar söyler misiniz? Örnegin 41193.";
      this.addMessage('ai', prompt);
      this.speak(prompt, () => this.startListening());
    }
  }

  public parseTaskType(input: string): 'Arıza' | 'Bakım' | 'Kontrol' | null {
    const clean = input.toLowerCase();
    if (clean.includes('arıza') || clean.includes('ariza') || clean.includes('bozuk') || clean.includes('çalışmıyor')) {
      return 'Arıza';
    }
    if (clean.includes('bakım') || clean.includes('bakim') || clean.includes('periyodik')) {
      return 'Bakım';
    }
    if (clean.includes('kontrol') || clean.includes('inceleme') || clean.includes('test')) {
      return 'Kontrol';
    }
    return null;
  }

  private processTypeState(lower: string) {
    const type = this.parseTaskType(lower);
    if (type) {
      this.draft.taskType = type;
      this.state = 'ASK_DESCRIPTION';
      const prompt = `${type} kaydı seçildi. Lütfen kısaca arıza veya iş açıklamasını söyleyin.`;
      this.addMessage('ai', prompt);
      this.speak(prompt, () => this.startListening());
    } else {
      const prompt = "Lütfen işlem türünü 'Arıza', 'Bakım' veya 'Kontrol' olarak belirtin.";
      this.addMessage('ai', prompt);
      this.speak(prompt, () => this.startListening());
    }
  }

  private processDescriptionState(originalText: string) {
    if (originalText && originalText.trim().length > 2) {
      this.draft.description = originalText.trim();
      this.state = 'ASK_TEAM';
      const prompt = "Açıklama kaydedildi. Görevi hangi ekibe atamak istersiniz? Örnegin Team 04.";
      this.addMessage('ai', prompt);
      this.speak(prompt, () => this.startListening());
    } else {
      const prompt = "Açıklamayı tam anlayamadım, lütfen yapılacak işi kısaca tekrar söyleyin.";
      this.addMessage('ai', prompt);
      this.speak(prompt, () => this.startListening());
    }
  }

  public parseTeamInput(input: string): string {
    const clean = input.toLowerCase();
    const teamMatch = clean.match(/(?:takım|ekip|team|tm)?\s*(\d+)/i);
    if (teamMatch) {
      const num = parseInt(teamMatch[1]);
      return `Team ${String(num).padStart(2, '0')}`;
    }
    return 'Team 01';
  }

  private processTeamState(lower: string) {
    const teamName = this.parseTeamInput(lower);
    this.draft.assignedTeam = teamName;
    this.state = 'CONFIRM';

    const prompt = `Tüm bilgiler toplandı: ${this.draft.siteName} türbin ${this.draft.turbineSerial} için ${this.draft.taskType} görevi ${teamName} ekibine atanıyor. Oluşturmayı onaylıyor musunuz?`;
    this.addMessage('ai', prompt);
    this.speak(prompt, () => this.startListening());
  }

  public parseConfirmation(input: string): boolean | null {
    const clean = input.toLowerCase();
    if (clean.includes('evet') || clean.includes('onay') || clean.includes('tamam') || clean.includes('kaydet') || clean.includes('olur')) {
      return true;
    }
    if (clean.includes('hayır') || clean.includes('iptal') || clean.includes('vazgeç') || clean.includes('olmaz')) {
      return false;
    }
    return null;
  }

  private async processConfirmState(lower: string) {
    const isConfirmed = this.parseConfirmation(lower);
    if (isConfirmed === true) {
      try {
        await taskService.createNewTask({
          secilenSablon: this.draft.taskType || 'Arıza',
          sahaBilgisi: this.draft.siteName || 'Anemon İntepe',
          siteId: this.draft.siteId || '2688',
          turbinSeriNo: this.draft.turbineSerial || '41193',
          turbinNo: this.draft.turbineNo || '1',
          yoneticiNotu: this.draft.description || 'Sesli Asistan ile oluşturuldu.',
          assignedTeam: this.draft.assignedTeam || 'Team 01'
        });

        this.state = 'COMPLETED';
        const successText = `İş emri başarıyla oluşturuldu ve ${this.draft.assignedTeam} ekranına düşürüldü!`;
        this.addMessage('ai', successText);
        this.speak(successText);
      } catch (err: any) {
        console.error('[VoiceAgent] Task creation failed:', err);
        const errText = "İş emri kaydedilirken bir hata oluştu.";
        this.addMessage('ai', errText);
        this.speak(errText);
      }
    } else if (isConfirmed === false) {
      this.state = 'CANCELLED';
      const cancelText = "İş emri oluşturma işlemi iptal edildi.";
      this.addMessage('ai', cancelText);
      this.speak(cancelText);
    } else {
      const prompt = "Lütfen 'Evet onaylıyorum' veya 'İptal et' şeklinde yanıt verin.";
      this.addMessage('ai', prompt);
      this.speak(prompt, () => this.startListening());
    }
  }

  public updateDraft(partial: Partial<VoiceTaskDraft>) {
    this.draft = { ...this.draft, ...partial };
    this.notify();
  }

  public setState(newState: VoiceState) {
    this.state = newState;
    this.notify();
  }
}

export const voiceAgentService = new VoiceAgentService();
