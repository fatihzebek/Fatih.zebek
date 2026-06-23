import faultCodes from '../data/fault_codes.json';

export interface FaultCode {
  KOD: string;
  Aciklama: string;
}

class StatusService {
  private codes: FaultCode[] = faultCodes;

  getAllCodes(): FaultCode[] {
    return this.codes;
  }

  searchCodes(query: string): FaultCode[] {
    if (!query) return [];
    const lowerQuery = query.toLowerCase();
    return this.codes.filter(c => 
      c.KOD.toLowerCase().includes(lowerQuery) || 
      c.Aciklama.toLowerCase().includes(lowerQuery)
    ).slice(0, 50); // Limit to 50 results for performance
  }

  getCodeByKod(kod: string): FaultCode | undefined {
    if (!kod) return undefined;
    const normalized = kod.trim().toLowerCase();
    return this.codes.find(c => c.KOD.trim().toLowerCase() === normalized);
  }
}

export const statusService = new StatusService();
