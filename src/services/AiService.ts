import { GoogleGenerativeAI } from '@google/generative-ai';
import { serviceReportService, type ServiceReport } from './ServiceReportService';

class AiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor() {
    this.init();
  }

  private init() {
    // API anahtarını .env dosyasından çekiyoruz
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      // Zaman içinde model isimleri güncellendiği için her zaman en güncel olanı hedefliyoruz.
      this.model = this.genAI.getGenerativeModel({ model: "gemini-flash-latest" });
    }
  }

  public isConfigured(): boolean {
    return this.genAI !== null;
  }

  /**
   * Patron / Yönetici için geçmiş raporların özetini ve stratejik analizini çıkarır.
   */
  async generateExecutiveSummary(): Promise<string> {
    if (!this.model) {
      throw new Error("Yapay Zeka API anahtarı yapılandırılmamış. Lütfen sistem yöneticisiyle iletişime geçin.");
    }

    try {
      // Tüm raporları çek
      const allReports = await serviceReportService.getAllReports();
      
      // Sadece son 30 günün raporlarını filtrele
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentReports = allReports.filter(r => {
        if (!r.createdAt || !r.createdAt.toDate) return false;
        return r.createdAt.toDate() >= thirtyDaysAgo;
      });

      if (recentReports.length === 0) {
        return "Son 30 gün içinde analiz edilecek yeterli servis raporu bulunamadı.";
      }

      // Raporları AI'ın anlayacağı sıkıştırılmış metin formatına çevir
      const reportDataStr = recentReports.map(r => 
        `Türbin: ${r.turbineNo}, Arıza Kodu: ${r.faultCode}, Açıklama: ${r.faultDesc}, Harcanan Süre: ${r.timeManagement?.interventionDuration || 'Belirtilmemiş'}, Değişen Parçalar: ${r.materials?.map(m => m.description).join(', ') || 'Yok'}`
      ).join('\n');

      const prompt = `
      Sen rüzgar türbini servis istatistiklerini inceleyen kıdemli bir 'Yapay Zeka Bakım ve Strateji Uzmanı'sın.
      Sana son 30 günün saha servis raporu özetlerini veriyorum.
      
      Lütfen yönetici (patron) için aşağıdaki başlıklarda profesyonel, okuması kolay ve etkileyici bir stratejik özet hazırla:
      1. Genel Bakış (Bu ay en çok hangi türbinlerde, hangi arızalar yaşandı?)
      2. Kronik Sorunlar (Sürekli tekrarlayan veya en çok süre harcanan arızalar neler?)
      3. Yedek Parça Önerisi (Hangi parçalar sık değişti, stok yapılmalı mı?)
      4. Önleyici Bakım Önerisi (Hangi türbinlere acil bakım planlanmalı?)
      
      Yanıtı daktilo gibi ekrana basılacak akıcılıkta, güven veren, kurumsal ve vizyoner bir tonda Türkçe olarak yaz. Gereksiz tekrarlardan kaçın.
      Markdown formatı (kalın yazılar, maddeler) kullan.
      
      Servis Verisi:
      ${reportDataStr}
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();

    } catch (error: any) {
      console.error("AI Executive Summary Error:", error);
      throw new Error(`Yapay Zeka analizi sırasında bir hata oluştu: ${error.message}`);
    }
  }

  /**
   * Sahadaki teknisyen için anlık arıza teşhisi ve çözüm önerisi sunar.
   */
  async diagnoseFault(faultCode: string, faultDesc: string, turbineNo: string): Promise<string> {
    if (!this.model) {
      throw new Error("Yapay Zeka API anahtarı yapılandırılmamış.");
    }

    if (!faultCode && !faultDesc) {
      return "Lütfen analiz için arıza kodu veya açıklama girin.";
    }

    try {
      // Tüm raporları çek
      const allReports = await serviceReportService.getAllReports();
      
      // Benzer türbin veya arıza koduna sahip eski raporları bul
      const historicalData = allReports
        .filter(r => r.faultCode === faultCode || r.turbineNo === turbineNo)
        .slice(0, 20); // Son 20 benzer kaydı al

      let historyText = "Geçmiş kayıt bulunamadı.";
      if (historicalData.length > 0) {
        historyText = historicalData.map(r => 
          `Tarih: ${r.date}, Arıza: ${r.faultCode} - ${r.faultDesc}, Yapılan İşlem / Kullanılan Malzeme: ${r.materials?.map(m => m.description).join(', ') || 'Belirtilmemiş'}`
        ).join('\n');
      }

      const prompt = `
      Sen rüzgar türbini arızaları konusunda uzman bir 'Yapay Zeka Saha Asistanı'sın.
      Şu an sahada olan bir teknisyen aşağıdaki arızayla karşılaştı:
      - Türbin: ${turbineNo || 'Belirtilmemiş'}
      - Arıza Kodu: ${faultCode || 'Belirtilmemiş'}
      - Arıza Açıklaması: ${faultDesc || 'Belirtilmemiş'}
      
      Bu sistemin geçmiş bakım kayıtlarında şu benzer raporlar bulundu:
      ${historyText}
      
      Lütfen sahadaki teknisyene yardımcı olacak hızlı ve nokta atışı bir "Akıllı Teşhis" sun.
      1. Kök neden ne olabilir?
      2. Geçmiş raporlara dayanarak (eğer varsa) daha önce bu sorunun nasıl çözüldüğünü belirt.
      3. Teknisyene ilk olarak hangi parçaları veya sensörleri kontrol etmesini tavsiye edersin?
      
      Yanıtın kısa, net ve sahadaki bir mühendisin işine yarayacak teknik dilde (ama anlaşılır) olsun.
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();

    } catch (error: any) {
      console.error("AI Diagnosis Error:", error);
      throw new Error(`Yapay Zeka teşhisi sırasında bir hata oluştu: ${error.message}`);
    }
  }

  /**
   * Predictive Maintenance (Önleyici Bakım) Analizi
   */
  async runPredictiveMaintenanceAnalysis(siteId: string = 'all', months: number = 6): Promise<any[]> {
    if (!this.model) {
      throw new Error("Yapay Zeka API anahtarı yapılandırılmamış.");
    }

    try {
      // Tüm raporları (geçmiş arızalar) çek
      let allReports = await serviceReportService.getAllReports();
      
      // Santral filtresi
      if (siteId !== 'all') {
        allReports = allReports.filter(r => r.siteId === siteId);
      }
      
      // Tarih filtresi
      const dateLimit = new Date();
      dateLimit.setMonth(dateLimit.getMonth() - months);
      
      const recentReports = allReports.filter(r => {
        if (!r.createdAt || !r.createdAt.toDate) return false;
        return r.createdAt.toDate() >= dateLimit;
      });

      if (recentReports.length === 0) {
        return [];
      }

      const reportDataStr = recentReports.map(r => 
        `Türbin: ${r.turbineNo}, Kod: ${r.faultCode}, Açıklama: ${r.faultDesc}, Değişen Parçalar: ${r.materials?.map(m => m.description).join(', ') || 'Yok'}`
      ).join('\n');

      const prompt = `
      Sen rüzgar türbini bakım kayıtlarını inceleyip 'Önleyici Bakım' (Predictive Maintenance) tahmini yapan bir Yapay Zeka Uzmanısın.
      Aşağıda sana son 6 aylık arıza kayıtlarını veriyorum. 
      Lütfen bu verilerdeki kronik sorunları (sürekli tekrar eden hataları) ve mevsimsel/kullanıma bağlı olası arızaları analiz et.
      
      Önümüzdeki ay hangi türbinlerde hangi parçaların arıza yapma ihtimali yüksek?
      SADECE bir JSON dizisi (Array) döndür. Başka hiçbir açıklama yazma.
      JSON Formatı şöyle olmalı:
      [
        {
          "turbineNo": "T-01",
          "component": "Jeneratör Soğutma Fanı",
          "probability": 85,
          "reason": "Geçmiş 3 ayda 2 kez aşırı ısınma hatası kaydedildi.",
          "recommendedAction": "Fan motoru kontrolü ve değişimi"
        }
      ]

      İşte arıza kayıtları:
      ${reportDataStr}
      `;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response (in case AI adds markdown ```json)
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      
      try {
        return JSON.parse(jsonStr);
      } catch (parseError) {
        console.error("JSON Parse Error:", parseError, "Raw Response:", text);
        throw new Error("Yapay Zeka beklenen formatta yanıt vermedi.");
      }

    } catch (error: any) {
      console.error("AI Predictive Analysis Error:", error);
      throw new Error(`Tahmin analizi sırasında bir hata oluştu: ${error.message}`);
    }
  }
}

export const aiService = new AiService();
