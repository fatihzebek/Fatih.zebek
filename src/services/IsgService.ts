import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  serverTimestamp, 
  updateDoc,
  onSnapshot 
} from 'firebase/firestore';

export interface KkdDemandItem {
  type: string; // 'Baret' | 'Ayakkabı' | 'Maske' | 'Pantolon' | 'Eldiven' | 'Gözlük' | 'Kıyafet' | 'Kışlık' | 'Düşme Kor' | 'Diğer'
  customName?: string;
  qty: number;
  size?: string; // Beden veya Ayakkabı no (örn: 42, L, XL vb.)
}

export interface PreviousReceipt {
  lastReceivedDate: string;
  qty: number;
  reason: string;
}

export interface KkdDemandRequest {
  id?: string;
  docNo: string; // 'DH-FR-019'
  revisionDate: string; // '04.12.2024'
  revisionNo: string; // '001'
  tlpNo: string; // Örn: 'TLPNO-2026-001'
  personnelName: string;
  role: string;
  siteName: string; // Görev Yeri (Santral)
  requestDate: string; // YYYY-MM-DD
  requestedItems: KkdDemandItem[];
  previousReceipts: PreviousReceipt[];
  reasonDescription: string;
  photos: string[]; // Resim DataURL'leri (kusurlu alan fotoğrafları)
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DELIVERED';
  approvalInfo?: {
    decision: 'ONAYLANDI' | 'REDDEDİLDİ' | 'KISMİ_ONAY';
    note?: string;
    decisionDate?: string;
    deliveryDate?: string;
    evaluatorName?: string;
    evaluatorRole?: string;
  };
  createdBy: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface NearMissIncident {
  id?: string;
  incidentNo: string; // Örn: 'RMK-2026-001'
  siteName: string;
  turbineNo?: string;
  locationDetail: string; // 'Kule İçi', 'Şalt Sahası', 'Yol', 'Trafo', 'Atölye' vb.
  incidentDate: string; // YYYY-MM-DD
  incidentTime: string; // HH:mm
  category: string; // 'YÜKSEKTE ÇALIŞMA' | 'ELEKTRİK' | 'MEKANİK' | 'AĞIR YÜK / VİNÇ' | 'HAVA ŞARTLARI' | 'ULAŞIM / ARAÇ' | 'KKD EKSİKLİĞİ' | 'DİĞER'
  description: string;
  immediateAction: string;
  photos: string[];
  reportedBy: string;
  isAnonymous?: boolean;
  status: 'REPORTED' | 'INVESTIGATING' | 'ACTION_TAKEN' | 'CLOSED';
  investigationNotes?: string;
  dofOpened?: boolean;
  dofNo?: string;
  closedAt?: string;
  closedBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface MsdsRecord {
  id?: string;
  productName: string;
  brand: string;
  category: string; // 'YAG' | 'GRES' | 'SOLVENT' | 'YAPISTIRICI' | 'BOYA' | 'DIGER'
  pictograms: string[]; // 'flammable', 'toxic', 'corrosive', 'environment', 'health_hazard', 'irritant'
  usageArea: string; // 'Dişli Kutusu', 'Hidrolik Ünite', 'Rulman Yağlama', 'Kanat Tamiri', 'Genel Temizlik'
  firstAidSkin?: string;
  firstAidEyes?: string;
  firstAidInhalation?: string;
  firstAidIngestion?: string;
  fileUrl?: string; // PDF link or base64
  fileName?: string;
  uploadedBy?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface IsgDocument {
  id?: string;
  docCode: string; // 'DH-TL-ISG-001'
  title: string;
  category: string; // 'YUKSEKTE_CALISMA' | 'KAPALI_ALAN' | 'ELEKTRIK' | 'ACIL_DURUM' | 'GENEL_ISG'
  revisionNo: string;
  revisionDate: string;
  fileUrl?: string;
  fileName?: string;
  description?: string;
  uploadedBy?: string;
  createdAt?: any;
}

export interface PersonnelCertRecord {
  id?: string;
  personnelName: string;
  teamName: string;
  certType: string; // 'GWO_BST' | 'SAGLIK_EK2' | 'ILKYARDIM' | 'YUKSEKTE_CALISMA' | 'EKAT' | 'MYK' | 'DIGER'
  certNo: string;
  issueDate: string;
  expiryDate: string;
  fileUrl?: string;
  fileName?: string;
  notes?: string;
  uploadedBy?: string;
  createdAt?: any;
}

export interface IsgAuditRecord {
  id?: string;
  auditNo: string;
  siteName: string;
  auditorName: string;
  auditDate: string;
  score: number;
  findingsCount: number;
  status: 'COMPLETED' | 'ACTION_REQUIRED';
  notes?: string;
  createdAt?: any;
}

export interface ContractorChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  note?: string;
}

export interface ContractorIsgRecord {
  id?: string;
  companyName: string;
  siteName: string;
  locationDetail?: string; // Örn: 'T04 Türbini' veya 'Şalt Sahası'
  workDescription: string;
  contactPerson?: string;
  contactPhone?: string;
  startDate: string;
  endDate: string;
  status: 'APPROVED' | 'PENDING_DOCS' | 'REJECTED' | 'EXPIRED';
  checklist: ContractorChecklistItem[];
  missingDocsNote?: string;
  approvedBy?: string;
  approvalDate?: string;
  fileUrl?: string;
  fileName?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface FireSafetyRecord {
  id?: string;
  equipmentType: 'YANGIN_TUPU' | 'ARAZOZ' | 'YANGIN_DOLABI' | 'HIDRANT' | 'ORMAN_RISK';
  siteName: string;
  locationDetail: string; // 'T03 Kule İçi', 'Şalt Trafo', 'Ambar' vb.
  serialOrPlateNo: string;
  capacity: string; // '6 kg KKT', '5 kg CO2', '10 Ton Su' vb.
  lastInspectionDate: string; // DD.MM.YYYY
  nextInspectionDate: string; // DD.MM.YYYY
  status: 'OPERATIONAL' | 'NEEDS_INSPECTION' | 'OUT_OF_SERVICE';
  pressureOk: boolean;
  notes?: string;
  checkedBy?: string;
  createdAt?: any;
}

export interface TemporaryDispatchRecord {
  id?: string;
  docNo: string; // 'GG-2026-001'
  personnelName: string;
  originSite: string; // 'Alize Keltepe'
  targetSite: string; // 'Şamlı RES'
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string; // 'Büyük Bakım & Kanat Onarımı'
  isgBriefingDone: boolean;
  status: 'ACTIVE' | 'PLANNED' | 'COMPLETED';
  notes?: string;
  createdAt?: any;
}

export interface IsgProcurementRecord {
  id?: string;
  orderNo: string; // 'ISG-SIP-2026-001'
  siteName: string;
  supplierName?: string;
  items: Array<{ name: string; qty: number; unit: string; size?: string }>;
  requestDate: string;
  status: 'REQUESTED' | 'ORDERED' | 'SHIPPED' | 'DELIVERED';
  fromKkdRequestId?: string;
  notes?: string;
  createdBy?: string;
  createdAt?: any;
}

export interface RiskAssessmentRecord {
  id?: string;
  riskNo: string; // 'RA-2026-001'
  title: string;
  siteOrCategory: string; // 'Rüzgar Türbinleri / Yüksekte Çalışma'
  hazard: string;
  consequence: string;
  probability: number; // 1-5
  severity: number; // 1-5
  riskScore: number; // 1-25
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  existingControls: string;
  residualProbability: number;
  residualSeverity: number;
  residualRiskScore: number;
  responsiblePerson: string;
  revisionDate: string;
  status: 'ACTIVE' | 'UNDER_REVIEW';
  createdAt?: any;
}

export interface IsgScorecardRecord {
  id?: string;
  evaluationType: 'SITE' | 'TEAM';
  targetName: string; // 'Alize Keltepe RES' veya 'Team 01 (Keltepe)'
  auditorName: string;
  evaluationDate: string;
  totalScore: number; // 0-100
  kkdScore: number; // max 20
  safetyLineScore: number; // max 20
  chemicalScore: number; // max 20
  riskProcedureScore: number; // max 20
  housekeepingScore: number; // max 20
  badge?: string;
  findingsCount: number;
  notes?: string;
  createdAt?: any;
}

export interface IsgInventoryItem {
  id?: string;
  name: string; // Örn: 'S3 Emniyet Ayakkabısı', 'Kışlık İş Montu', 'Baret EN 397'
  category: 'AYAKKABI' | 'KIYAFET' | 'YUKSEKTE_CALISMA' | 'BARET' | 'GOZLUK_MASKE' | 'ELDIVEN' | 'ILKYARDIM_CEVRE' | 'DIGER';
  size?: string; // Beden / Numara: '42', '43', 'L', 'XL', 'Standart'
  currentStock: number; // Mevcut Stok Miktarı
  minThreshold: number; // Kritik Eşik (Bu sayının altına düşerse Kırmızı Alarm verir)
  unit: 'Adet' | 'Çift' | 'Takım' | 'Kutu';
  storageLocation: string; // Örn: 'Merkez İSG Deposu - Dolap A1', 'Keltepe İSG Odası'
  notes?: string;
  lastUpdated?: any;
}

export interface IsgStockMovement {
  id?: string;
  itemId: string;
  itemName: string;
  type: 'IN' | 'OUT'; // Giriş (Tedarik/Sipariş) veya Çıkış (Personele Teslim/Zimmet)
  qty: number;
  personnelName?: string; // Çıkış yapıldıysa kime verildiği
  siteName?: string;
  reason?: string;
  date: string;
  recordedBy: string;
  createdAt?: any;
}

class IsgService {
  private kkdRequestsCol = collection(db, 'isg_kkd_requests');
  private nearMissCol = collection(db, 'isg_near_miss');
  private msdsCol = collection(db, 'isg_msds_library');
  private documentsCol = collection(db, 'isg_documents');
  private certsCol = collection(db, 'isg_personnel_certs');
  private auditsCol = collection(db, 'isg_audits');
  private contractorsCol = collection(db, 'isg_contractors');
  private fireSafetyCol = collection(db, 'isg_fire_safety');
  private dispatchesCol = collection(db, 'isg_temporary_dispatches');
  private procurementsCol = collection(db, 'isg_procurements');
  private riskCol = collection(db, 'isg_risk_assessments');
  private scorecardsCol = collection(db, 'isg_scorecards');
  private inventoryCol = collection(db, 'isg_inventory');
  private stockMovementsCol = collection(db, 'isg_stock_movements');

  // KKD TALEPLERİ (DH-FR-019)
  async getKkdRequests(): Promise<KkdDemandRequest[]> {
    try {
      const q = query(this.kkdRequestsCol, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as KkdDemandRequest[];
    } catch (err) {
      console.warn('IsgService: Falling back without orderBy createdAt:', err);
      const snap = await getDocs(this.kkdRequestsCol);
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as KkdDemandRequest[];
      return list.sort((a, b) => (b.requestDate || '').localeCompare(a.requestDate || ''));
    }
  }

  async createKkdRequest(data: Omit<KkdDemandRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(this.kkdRequestsCol, {
      ...data,
      docNo: 'DH-FR-019',
      revisionDate: '04.12.2024',
      revisionNo: '001',
      status: data.status || 'PENDING',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  }

  async updateKkdRequest(id: string, updates: Partial<KkdDemandRequest>): Promise<void> {
    const ref = doc(db, 'isg_kkd_requests', id);
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  async deleteKkdRequest(id: string): Promise<void> {
    const ref = doc(db, 'isg_kkd_requests', id);
    await deleteDoc(ref);
  }

  // RAMAK KALA / TEHLİKE BİLDİRİMLERİ
  async getNearMissIncidents(): Promise<NearMissIncident[]> {
    try {
      const q = query(this.nearMissCol, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as NearMissIncident[];
    } catch (err) {
      console.warn('IsgService: Falling back without orderBy createdAt for near-miss:', err);
      const snap = await getDocs(this.nearMissCol);
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as NearMissIncident[];
      return list.sort((a, b) => (b.incidentDate || '').localeCompare(a.incidentDate || ''));
    }
  }

  async createNearMissIncident(data: Omit<NearMissIncident, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(this.nearMissCol, {
      ...data,
      status: data.status || 'REPORTED',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  }

  async updateNearMissIncident(id: string, updates: Partial<NearMissIncident>): Promise<void> {
    const ref = doc(db, 'isg_near_miss', id);
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  async deleteNearMissIncident(id: string): Promise<void> {
    const ref = doc(db, 'isg_near_miss', id);
    await deleteDoc(ref);
  }

  // Otomatik Ardışık Numara Üretici (Örn: TLPNO-2026-001)
  generateNextTlpNo(existingRequests: KkdDemandRequest[]): string {
    const year = new Date().getFullYear();
    const prefix = `TLPNO-${year}-`;
    let maxSeq = 0;

    existingRequests.forEach(r => {
      if (r.tlpNo && r.tlpNo.startsWith(prefix)) {
        const numPart = r.tlpNo.replace(prefix, '').trim();
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }

  // Otomatik Ramak Kala Numara Üretici (Örn: RMK-2026-001)
  generateNextIncidentNo(existingIncidents: NearMissIncident[]): string {
    const year = new Date().getFullYear();
    const prefix = `RMK-${year}-`;
    let maxSeq = 0;

    existingIncidents.forEach(inc => {
      if (inc.incidentNo && inc.incidentNo.startsWith(prefix)) {
        const numPart = inc.incidentNo.replace(prefix, '').trim();
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
    });

    const nextSeq = String(maxSeq + 1).padStart(3, '0');
    return `${prefix}${nextSeq}`;
  }

  // --- KİMYASAL & MSDS KÜTÜPHANESİ ---
  async getMsdsList(): Promise<MsdsRecord[]> {
    try {
      const snap = await getDocs(this.msdsCol);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as MsdsRecord[];
    } catch (err) {
      console.error('getMsdsList error:', err);
      return [];
    }
  }

  async createMsds(data: Omit<MsdsRecord, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(this.msdsCol, {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  async deleteMsds(id: string): Promise<void> {
    await deleteDoc(doc(db, 'isg_msds_library', id));
  }

  // --- İSG TALİMATLARI & PROSEDÜRLER ---
  async getDocuments(): Promise<IsgDocument[]> {
    try {
      const snap = await getDocs(this.documentsCol);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as IsgDocument[];
    } catch (err) {
      console.error('getDocuments error:', err);
      return [];
    }
  }

  async createDocument(data: Omit<IsgDocument, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(this.documentsCol, {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  async deleteDocument(id: string): Promise<void> {
    await deleteDoc(doc(db, 'isg_documents', id));
  }

  // --- PERSONEL SERTİFİKA & SAĞLIK TAKİBİ ---
  async getCerts(): Promise<PersonnelCertRecord[]> {
    try {
      const snap = await getDocs(this.certsCol);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as PersonnelCertRecord[];
    } catch (err) {
      console.error('getCerts error:', err);
      return [];
    }
  }

  async createCert(data: Omit<PersonnelCertRecord, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(this.certsCol, {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  async deleteCert(id: string): Promise<void> {
    await deleteDoc(doc(db, 'isg_personnel_certs', id));
  }

  // --- SAHA İSG DENETİMLERİ (AUDITS) ---
  async getAudits(): Promise<IsgAuditRecord[]> {
    try {
      const snap = await getDocs(this.auditsCol);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as IsgAuditRecord[];
    } catch (err) {
      console.error('getAudits error:', err);
      return [];
    }
  }

  async createAudit(data: Omit<IsgAuditRecord, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(this.auditsCol, {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  async deleteAudit(id: string): Promise<void> {
    await deleteDoc(doc(db, 'isg_audits', id));
  }

  // --- TAŞERON İSG & SAHA GİRİŞ YÖNETİMİ ---
  async getContractors(): Promise<ContractorIsgRecord[]> {
    try {
      const snap = await getDocs(this.contractorsCol);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as ContractorIsgRecord[];
    } catch (err) {
      console.error('getContractors error:', err);
      return [];
    }
  }

  async createContractor(data: Omit<ContractorIsgRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docRef = await addDoc(this.contractorsCol, {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return docRef.id;
  }

  async updateContractor(id: string, updates: Partial<ContractorIsgRecord>): Promise<void> {
    const ref = doc(db, 'isg_contractors', id);
    await updateDoc(ref, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  async deleteContractor(id: string): Promise<void> {
    await deleteDoc(doc(db, 'isg_contractors', id));
  }

  // --- YANGIN GÜVENLİĞİ & ORMAN ANALİZLERİ ---
  async getFireSafetyList(): Promise<FireSafetyRecord[]> {
    try {
      const snap = await getDocs(this.fireSafetyCol);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as FireSafetyRecord[];
    } catch (err) {
      console.error('getFireSafetyList error:', err);
      return [];
    }
  }

  async createFireSafety(data: Omit<FireSafetyRecord, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(this.fireSafetyCol, {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  async updateFireSafety(id: string, updates: Partial<FireSafetyRecord>): Promise<void> {
    await updateDoc(doc(db, 'isg_fire_safety', id), updates);
  }

  async deleteFireSafety(id: string): Promise<void> {
    await deleteDoc(doc(db, 'isg_fire_safety', id));
  }

  // --- GEÇİCİ GÖREVLENDİRME TAKİBİ ---
  async getDispatches(): Promise<TemporaryDispatchRecord[]> {
    try {
      const snap = await getDocs(this.dispatchesCol);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as TemporaryDispatchRecord[];
    } catch (err) {
      console.error('getDispatches error:', err);
      return [];
    }
  }

  async createDispatch(data: Omit<TemporaryDispatchRecord, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(this.dispatchesCol, {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  async updateDispatch(id: string, updates: Partial<TemporaryDispatchRecord>): Promise<void> {
    await updateDoc(doc(db, 'isg_temporary_dispatches', id), updates);
  }

  async deleteDispatch(id: string): Promise<void> {
    await deleteDoc(doc(db, 'isg_temporary_dispatches', id));
  }

  // --- İSG SATIN ALMA & SİPARİŞ ---
  async getProcurements(): Promise<IsgProcurementRecord[]> {
    try {
      const snap = await getDocs(this.procurementsCol);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as IsgProcurementRecord[];
    } catch (err) {
      console.error('getProcurements error:', err);
      return [];
    }
  }

  async createProcurement(data: Omit<IsgProcurementRecord, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(this.procurementsCol, {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  async updateProcurement(id: string, updates: Partial<IsgProcurementRecord>): Promise<void> {
    await updateDoc(doc(db, 'isg_procurements', id), updates);
  }

  async deleteProcurement(id: string): Promise<void> {
    await deleteDoc(doc(db, 'isg_procurements', id));
  }

  // --- RİSK ANALİZLERİ (5x5 MATRİS) ---
  async getRiskAssessments(): Promise<RiskAssessmentRecord[]> {
    try {
      const snap = await getDocs(this.riskCol);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as RiskAssessmentRecord[];
    } catch (err) {
      console.error('getRiskAssessments error:', err);
      return [];
    }
  }

  async createRiskAssessment(data: Omit<RiskAssessmentRecord, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(this.riskCol, {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  async updateRiskAssessment(id: string, updates: Partial<RiskAssessmentRecord>): Promise<void> {
    await updateDoc(doc(db, 'isg_risk_assessments', id), updates);
  }

  async deleteRiskAssessment(id: string): Promise<void> {
    await deleteDoc(doc(db, 'isg_risk_assessments', id));
  }

  // --- SAHA & EKİP İSG SKOR KARTLARI (SCORECARD) ---
  async getScorecards(): Promise<IsgScorecardRecord[]> {
    try {
      const snap = await getDocs(this.scorecardsCol);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as IsgScorecardRecord[];
    } catch (err) {
      console.error('getScorecards error:', err);
      return [];
    }
  }

  async createScorecard(data: Omit<IsgScorecardRecord, 'id' | 'createdAt'>): Promise<string> {
    const docRef = await addDoc(this.scorecardsCol, {
      ...data,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  async deleteScorecard(id: string): Promise<void> {
    await deleteDoc(doc(db, 'isg_scorecards', id));
  }

  // --- İSG & KKD YEDEK DEPO STOK YÖNETİMİ ---
  async getInventory(): Promise<IsgInventoryItem[]> {
    try {
      const snap = await getDocs(this.inventoryCol);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as IsgInventoryItem[];
    } catch (err) {
      console.error('getInventory error:', err);
      return [];
    }
  }

  async createInventoryItem(data: Omit<IsgInventoryItem, 'id' | 'lastUpdated'>): Promise<string> {
    const docRef = await addDoc(this.inventoryCol, {
      ...data,
      lastUpdated: serverTimestamp()
    });
    return docRef.id;
  }

  async updateInventoryItem(id: string, updates: Partial<IsgInventoryItem>): Promise<void> {
    await updateDoc(doc(db, 'isg_inventory', id), {
      ...updates,
      lastUpdated: serverTimestamp()
    });
  }

  async deleteInventoryItem(id: string): Promise<void> {
    await deleteDoc(doc(db, 'isg_inventory', id));
  }

  async adjustStock(
    itemId: string, 
    delta: number, 
    movement: Omit<IsgStockMovement, 'id' | 'createdAt'>
  ): Promise<void> {
    await addDoc(this.stockMovementsCol, {
      ...movement,
      createdAt: serverTimestamp()
    });

    const itemRef = doc(db, 'isg_inventory', itemId);
    const items = await this.getInventory();
    const currentItem = items.find(i => i.id === itemId);
    const newStock = Math.max(0, (currentItem?.currentStock || 0) + delta);
    await updateDoc(itemRef, {
      currentStock: newStock,
      lastUpdated: serverTimestamp()
    });
  }

  async getStockMovements(itemId?: string): Promise<IsgStockMovement[]> {
    try {
      const snap = await getDocs(this.stockMovementsCol);
      let list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as IsgStockMovement[];
      if (itemId) {
        list = list.filter(m => m.itemId === itemId);
      }
      return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    } catch (err) {
      console.error('getStockMovements error:', err);
      return [];
    }
  }

  // Canlı İSG Uyarı & Bildirim Dinleyicisi (Sercan Yetgin ve Admin için)
  subscribeToIsgAlerts(callback: (stats: { kkdPending: number; nearMissOpen: number; total: number }) => void): () => void {
    let kkdPending = 0;
    let nearMissOpen = 0;

    const qKkd = query(collection(db, 'isg_kkd_requests'));
    const qNearMiss = query(collection(db, 'isg_near_miss'));

    const unsubKkd = onSnapshot(qKkd, (snap) => {
      kkdPending = snap.docs.filter(d => (d.data() as any).status === 'PENDING').length;
      callback({ kkdPending, nearMissOpen, total: kkdPending + nearMissOpen });
    }, (err) => console.error('[IsgService] KKD Alerts error:', err));

    const unsubNearMiss = onSnapshot(qNearMiss, (snap) => {
      nearMissOpen = snap.docs.filter(d => ['REPORTED', 'INVESTIGATING'].includes((d.data() as any).status)).length;
      callback({ kkdPending, nearMissOpen, total: kkdPending + nearMissOpen });
    }, (err) => console.error('[IsgService] NearMiss Alerts error:', err));

    return () => {
      unsubKkd();
      unsubNearMiss();
    };
  }
}

export const isgService = new IsgService();
