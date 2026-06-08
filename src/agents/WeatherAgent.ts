import { BaseAgent } from './BaseAgent';
import { dataService } from '../services/DataService';

/**
 * Weather & Environment Agent: Türbin konumu bazlı hava durumu ve yıldırım aktivitesi İSG kontrolü yapan ajan.
 * Kesin İSG Kuralı: Türbine 50 km veya daha yakın yıldırım varsa kuleye çıkış yasaklanır (HOLD_WEATHER).
 */
export class WeatherAgent extends BaseAgent {
  constructor() {
    super('agent_weather_01', 'Weather & Environment Agent', 'SafetyAudit');
  }

  /**
   * Türbin konumuna göre yıldırım mesafesini simüle eder ve karar mekanizmasını çalıştırır.
   * @param serialNumber Türbin seri numarası
   */
  async checkLightningSafety(serialNumber: string): Promise<{
    distance: number;
    safe: boolean;
    status: 'HOLD_WEATHER' | 'APPROVED';
    message: string;
    latitude?: number;
    longitude?: number;
    turbineNo?: string;
    siteName?: string;
  }> {
    try {
      await this.setStatus('busy');
      const turbineInfo = dataService.findTurbineBySerial(serialNumber);
      const nameTag = turbineInfo 
        ? `${turbineInfo.siteName} ${turbineInfo.turbineNo}`
        : `Seri No: ${serialNumber}`;

      const coordTag = turbineInfo && turbineInfo.latitude && turbineInfo.longitude
        ? ` (${turbineInfo.latitude}, ${turbineInfo.longitude})`
        : '';

      console.log(`[WeatherAgent] Yıldırım mesafe taraması başlatıldı. ${nameTag}${coordTag}`);

      // Simülasyon gecikmesi (0.8s) - Ajanın çalıştığını hissettirmek için
      await new Promise((resolve) => setTimeout(resolve, 800));

      let distance = 75; // Varsayılan güvenli mesafe
      
      if (turbineInfo && turbineInfo.latitude && turbineInfo.longitude) {
        // Koordinatlara göre deterministik simülasyon (her zaman aynı sonuç döner)
        const latLongSeed = Math.floor((turbineInfo.latitude + turbineInfo.longitude) * 1000000);
        if (latLongSeed % 2 === 0) {
          // Çift tohum için tehlikeli yakınlık (< 50 km)
          distance = 12 + (latLongSeed % 38); // 12 - 49 km
        } else {
          // Tek tohum için güvenli uzaklık (>= 50 km)
          distance = 51 + (latLongSeed % 44); // 51 - 94 km
        }
      } else {
        // fallback to parity check if coordinates are not available
        if (serialNumber) {
          const digits = serialNumber.replace(/\D/g, '');
          if (digits.length > 0) {
            const lastDigit = parseInt(digits[digits.length - 1]) || 0;
            if (lastDigit % 2 === 0) {
              const unsafeDistances = [12, 28, 35, 42, 48];
              distance = unsafeDistances[lastDigit / 2] || 25;
            } else {
              const safeDistances = [55, 68, 72, 85, 95];
              distance = safeDistances[Math.floor((lastDigit - 1) / 2)] || 75;
            }
          }
        }
      }

      const safe = distance > 50;
      const status = safe ? 'APPROVED' : 'HOLD_WEATHER';
      
      const message = safe
        ? `Hava koşulları İSG sınırları dahilinde. ${nameTag}${coordTag} için en yakın yıldırım aktivitesi: ${distance} km.`
        : `KRİTİK İSG İHLALİ: ${nameTag}${coordTag} konumuna yakın aktif yıldırım düşmesi tespit edildi! Mesafe: ${distance} km. Kuleye tırmanış yasaktır!`;

      await this.setStatus('online');

      return {
        distance,
        safe,
        status,
        message,
        latitude: turbineInfo?.latitude,
        longitude: turbineInfo?.longitude,
        turbineNo: turbineInfo?.turbineNo,
        siteName: turbineInfo?.siteName
      };
    } catch (error) {
      await this.setStatus('error');
      console.error(`[WeatherAgent] İSG kontrolünde hata:`, error);
      return {
        distance: 0,
        safe: false,
        status: 'HOLD_WEATHER',
        message: 'Hava durumu telemetri bağlantı hatası! Güvenlik nedeniyle tırmanış yasaklandı.'
      };
    }
  }
}

export const weatherAgent = new WeatherAgent();
weatherAgent.start();
