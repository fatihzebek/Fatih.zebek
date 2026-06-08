export interface Site {
  id: string;
  name: string;
  turbineCount: number;
}

export interface Turbine {
  id: string; // Serial Number
  no: number; // Site-specific number
  siteId: string;
  status: 'online' | 'fault' | 'maintenance' | 'warning';
  currentFaultCode?: string;
  label?: string; // For RTU, FCU, etc.
  latitude?: number;
  longitude?: number;
  controlType?: string;
  commissioningDate?: string;
  type?: string;
}

export interface StatusCode {
  KOD: string;
  Aciklama: string;
  severity: 'info' | 'warning' | 'fault';
}

export interface WorkOrder {
  id: string;
  type: 'Arıza' | 'Bakım' | 'Kontrol';
  turbineId: string;
  siteId: string;
  status: 'open' | 'in_progress' | 'completed';
  technicianId: string;
  details: {
    faultCode?: string;
    description: string;
    durations?: {
      arrival: string;
      maintOn: string;
      maintOff: string;
    };
  };
  materials: MaterialEntry[];
  createdAt: number;
}

export interface MaterialEntry {
  sap: string;
  serial: string;
  desc: string;
  qty: number;
  type: 'S' | 'T'; // Sökülen | Takılan
}

export type AgentStatus = 'online' | 'offline' | 'busy' | 'error';

export interface AgentRegistry {
  id: string;
  name: string;
  type: string;
  status: AgentStatus;
  lastSeen: number;
  startTime: number;
  latency?: number;
  metadata?: Record<string, any>;
}

export interface Gorev {
  id?: string;
  baslik: string;
  aciklama: string;
  turbinNo: string;
  atananEkip: string; // Team 01 - Team 15
  durum: 'Açık' | 'Devam Ediyor' | 'Tamamlandı' | 'İptal' | 'HOLD_WEATHER';
  secilenSablon?: string;
  maintenanceData?: any;
  createdAt: number;
  updatedAt: number;
}
