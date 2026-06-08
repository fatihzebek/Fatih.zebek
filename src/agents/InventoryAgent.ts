import { BaseAgent } from './BaseAgent';

export interface InventoryInsight {
  sapNo: string;
  description: string;
  currentQty: number;
  monthlyConsumption: number;
  projectedNeed6Months: number;
  shortageAmount: number;
  isDeadStock: boolean;
  daysSinceLastUse: number;
}

export class InventoryAgent extends BaseAgent {
  constructor() {
    super(
      'Inventory-AI',
      'Akıllı Tedarik Ajanı',
      'Depo hareketlerini ve sarfiyatı analiz ederek gelecekteki malzeme ihtiyaçlarını öngörür ve ölü stokları tespit eder.'
    );
  }

  public analyze(inventory: any[], logs: any[]): { 
    insights: InventoryInsight[], 
    alerts: string[], 
    deadStockValue: number, 
    projectedCost6Months: number 
  } {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Filter consumption logs (REMOVE)
    const consumptions = logs.filter(l => l.type === 'REMOVE');
    
    // Map SAP -> last used date & total consumption in last year
    const usageMap: Record<string, { lastUsed: Date, qty1Year: number }> = {};
    
    consumptions.forEach(log => {
      const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
      const sap = log.sapNo || 'UNKNOWN';
      const qty = Math.abs(log.quantity || 0);

      if (!usageMap[sap]) {
        usageMap[sap] = { lastUsed: date, qty1Year: 0 };
      } else {
        if (date > usageMap[sap].lastUsed) usageMap[sap].lastUsed = date;
      }

      if (date >= oneYearAgo) {
        usageMap[sap].qty1Year += qty;
      }
    });

    const insights: InventoryInsight[] = [];
    const alerts: string[] = [];
    let deadStockValue = 0;
    let projectedCost6Months = 0;

    inventory.forEach(item => {
      const sap = item.sapNo || 'UNKNOWN';
      const qty = item.quantity || 0;
      const price = item.price || 0; // Assuming TRY for projection simplification or convert if needed
      
      const usage = usageMap[sap];
      let daysSinceLastUse = 9999;
      let monthlyConsumption = 0;

      if (usage) {
        daysSinceLastUse = Math.floor((now.getTime() - usage.lastUsed.getTime()) / (1000 * 60 * 60 * 24));
        monthlyConsumption = usage.qty1Year / 12;
      }

      const isDeadStock = daysSinceLastUse > 365 && qty > 0;
      
      if (isDeadStock && price > 0) {
        deadStockValue += (qty * price);
      }

      const projectedNeed6Months = monthlyConsumption * 6;
      const shortageAmount = Math.max(0, projectedNeed6Months - qty);

      if (projectedNeed6Months > 0 && price > 0) {
        projectedCost6Months += (projectedNeed6Months * price);
      }

      if (shortageAmount > 0) {
        alerts.push(`Dikkat: ${item.description} (${sap}) parçası için gelecek 6 ayda ${Math.ceil(projectedNeed6Months)} adet sarfiyat öngörülüyor. Güncel stok: ${qty}. En az ${Math.ceil(shortageAmount)} adet sipariş verilmesi önerilir.`);
      }

      insights.push({
        sapNo: sap,
        description: item.description,
        currentQty: qty,
        monthlyConsumption,
        projectedNeed6Months,
        shortageAmount,
        isDeadStock,
        daysSinceLastUse
      });
    });

    // Sort alerts by highest shortage impact
    insights.sort((a, b) => b.shortageAmount - a.shortageAmount);

    return { insights, alerts: alerts.slice(0, 10), deadStockValue, projectedCost6Months };
  }
}

export const inventoryAgent = new InventoryAgent();
