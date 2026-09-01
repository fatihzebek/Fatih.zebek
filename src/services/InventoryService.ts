import materialsData from '../data/materials.json';

export interface Material {
  n: string; // SAP Number
  d: string; // Description
}

class InventoryService {
  private materials: Material[] = materialsData as Material[];
  private searchIndex: { n: string; d: string; nLower: string; dLower: string }[] = [];

  constructor() {
    this.searchIndex = this.materials.map(m => ({
      n: m.n || '',
      d: m.d || '',
      nLower: String(m.n || '').toLowerCase(),
      dLower: String(m.d || '').toLowerCase()
    }));
  }

  searchMaterials(query: string): Material[] {
    if (!query || query.length < 2) return [];
    const lowerQuery = query.toLowerCase();
    const results: Material[] = [];
    const len = this.searchIndex.length;
    for (let i = 0; i < len; i++) {
      const item = this.searchIndex[i];
      if (item.nLower.includes(lowerQuery) || item.dLower.includes(lowerQuery)) {
        results.push({ n: item.n, d: item.d });
        if (results.length >= 100) break;
      }
    }
    return results;
  }

  getMaterialBySap(sap: string): Material | undefined {
    return this.materials.find(m => m.n === sap);
  }

  getAllMaterials(): Material[] {
    return this.materials;
  }

  /**
   * Compress and convert image to base64 data URL.
   * Stores directly in Firestore — no Firebase Storage CORS issues.
   */
  async uploadMaterialImage(_warehouseId: string, _itemId: string, file: File): Promise<string> {
    const MAX_SIZE = 800; // Artırılmış çözünürlük (800px)
    const QUALITY = 0.85; // Artırılmış kalite (%85)

    const loadingText = document.querySelector('#upload-loading-overlay div');

    return new Promise<string>((resolve, reject) => {
      if (loadingText) loadingText.innerHTML = 'RESİM HAZIRLANIYOR...';

      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Dosya okunamadı'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Geçersiz resim dosyası'));
        img.onload = () => {
          try {
            // Calculate new dimensions
            let w = img.width, h = img.height;
            if (w > h) { if (w > MAX_SIZE) { h = Math.round(h * MAX_SIZE / w); w = MAX_SIZE; } }
            else       { if (h > MAX_SIZE) { w = Math.round(w * MAX_SIZE / h); h = MAX_SIZE; } }

            // Draw to canvas
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, w, h);

            // Convert to base64
            const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
            
            if (loadingText) loadingText.innerHTML = 'RESİM KAYDEDİLİYOR...';
            console.log(`[Upload] Compressed: ${img.width}x${img.height} → ${w}x${h}, size: ${Math.round(dataUrl.length / 1024)}KB`);
            
            resolve(dataUrl);
          } catch (err) {
            reject(err);
          }
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }
}

export const inventoryService = new InventoryService();
