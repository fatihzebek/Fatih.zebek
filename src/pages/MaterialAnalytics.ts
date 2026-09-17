import { serviceReportService } from '../services/ServiceReportService';
import { priceService, type MaterialPriceEntry } from '../services/PriceService';
import { dataService } from '../services/DataService';
import { authService } from '../services/AuthService';
import XLSX from 'xlsx-js-style';

export const MaterialAnalyticsPage = async (userProfile?: any) => {
  const currentPeriod = localStorage.getItem('material_analytics_period') || 'this-year';
  const currentSite = localStorage.getItem('material_analytics_site') || 'all';
  const activeTab = localStorage.getItem('material_analytics_tab') || 'sites';
  const siteSortBy = localStorage.getItem('material_analytics_site_sort') || 'density';

  // 🔒 0. STRICT DEFAULT-DENY ROLE AUTHORIZATION
  const currentUser = userProfile || (window as any).appState?.userProfile || (window as any).currentUserProfile || (window as any).currentUser || authService.getCurrentUser();
  const userRole = (currentUser?.role || (window as any).appState?.userProfile?.role || '').toUpperCase().trim();
  const userEmail = (currentUser?.email || '').toLowerCase().trim();

  const isAdmin = userRole === 'ADMIN' || userRole === 'YONETICI' || userEmail.includes('fatih.zebek') || userEmail.includes('fatihzebek');
  const isMaterialManager = userRole === 'MALZEME_YONETIMI' || 
    userEmail === 'hursit.akter@demirerholding.com' ||
    userEmail === 'emir.unver@demirerholding.com';

  const canViewPrices = Boolean(isAdmin || isMaterialManager);

  // 1. Fetch Prices & Build Lookup Map (ONLY if authorized!)
  let allPrices: MaterialPriceEntry[] = [];
  if (canViewPrices) {
    try {
      allPrices = await priceService.getAllPrices();
    } catch (e) {
      console.warn('[MaterialAnalytics] Error fetching prices:', e);
    }
  }

  const priceMapByWarehouse = new Map<string, Map<string, { price: number; currency: string }>>();
  const priceMapGeneral = new Map<string, { price: number; currency: string }>();

  if (canViewPrices) {
    allPrices.forEach(p => {
      if (!p.sapNo) return;
      const cleanSap = p.sapNo.trim().toUpperCase();
      const numSap = cleanSap.replace(/^0+/, '');
      const wId = (p.warehouseId || 'GENEL').toUpperCase();
      const priceVal = { price: p.price, currency: p.currency || 'EUR' };

      if (!priceMapByWarehouse.has(wId)) {
        priceMapByWarehouse.set(wId, new Map());
      }
      const wMap = priceMapByWarehouse.get(wId)!;
      if (!wMap.has(cleanSap)) wMap.set(cleanSap, priceVal);
      if (numSap && !wMap.has(numSap)) wMap.set(numSap, priceVal);

      if (wId === 'GENEL' || wId === 'ALL') {
        if (!priceMapGeneral.has(cleanSap)) priceMapGeneral.set(cleanSap, priceVal);
        if (numSap && !priceMapGeneral.has(numSap)) priceMapGeneral.set(numSap, priceVal);
      }
    });
  }

  const getPriceInfo = (sapNo: string, siteName?: string) => {
    if (!canViewPrices || !sapNo || sapNo === '-' || sapNo === '---') return null;
    const clean = sapNo.trim().toUpperCase();
    
    // R ve T ile başlayan malzemelerin birim fiyatı 0 EUR
    if (clean.startsWith('R') || clean.startsWith('T')) {
      return { price: 0, currency: 'EUR' };
    }

    const num = clean.replace(/^0+/, '');
    const siteClean = (siteName || '').toLowerCase().trim();

    // 1. Check matching warehouse for site
    // Anemon check (id: 2688 or name 'anemon', 'intepe')
    if (siteClean.includes('anemon') || siteClean.includes('2688') || siteClean.includes('intepe') || siteClean.includes('i̇ntepe')) {
      const anemonMap = priceMapByWarehouse.get('2688') || priceMapByWarehouse.get('ANEMON');
      if (anemonMap) {
        const p = anemonMap.get(clean) || anemonMap.get(num);
        if (p) return p;
      }
    }

    // Alize Sarıkaya check (id: 3439 or name 'sarıkaya', 'sarikaya')
    if (siteClean.includes('sarıkaya') || siteClean.includes('sarikaya') || siteClean.includes('3439')) {
      const sarikayaMap = priceMapByWarehouse.get('3439') || priceMapByWarehouse.get('SARIKAYA');
      if (sarikayaMap) {
        const p = sarikayaMap.get(clean) || sarikayaMap.get(num);
        if (p) return p;
      }
    }

    // Generic site warehouse check
    for (const [wId, wMap] of priceMapByWarehouse.entries()) {
      if (wId !== 'GENEL' && wId !== 'ALL') {
        if (siteClean.includes(wId.toLowerCase())) {
          const p = wMap.get(clean) || wMap.get(num);
          if (p) return p;
        }
      }
    }

    // 2. Fallback to General price map (if exists)
    return priceMapGeneral.get(clean) || priceMapGeneral.get(num) || null;
  };

  // Master SAP Dictionary (54,340 items) for descriptions
  let sapDict: Record<string, string> = (window as any).sapDictionaryCache || {};
  if (Object.keys(sapDict).length === 0) {
    try {
      const resp = await fetch('/sap_dictionary.json');
      if (resp.ok) {
        sapDict = await resp.json();
        (window as any).sapDictionaryCache = sapDict;
      }
    } catch (e) {
      console.warn('[MaterialAnalytics] Error loading sap dictionary:', e);
    }
  }

  const resolveMaterialDescription = (sapNo: string, currentDesc?: string): string => {
    const cleanDesc = (currentDesc || '').trim();
    const cleanSap = (sapNo || '').trim().toUpperCase();
    const numSap = cleanSap.replace(/^0+/, '');

    // 1. If currentDesc is valid and meaningful, keep it
    if (
      cleanDesc && 
      cleanDesc !== '-' && 
      cleanDesc !== '---' && 
      cleanDesc.toLowerCase() !== 'tanımsız malzeme' && 
      cleanDesc.toLowerCase() !== 'tanimsiz malzeme' && 
      cleanDesc !== cleanSap && 
      cleanDesc !== numSap
    ) {
      return cleanDesc;
    }

    // 2. Check Price Service lookup for a known description
    if (cleanSap) {
      const priceEntry = allPrices.find(p => {
        if (!p.sapNo) return false;
        const pSap = p.sapNo.trim().toUpperCase();
        return (pSap === cleanSap || pSap.replace(/^0+/, '') === numSap) && p.description && p.description.trim() !== '';
      });
      if (priceEntry?.description?.trim()) {
        return priceEntry.description.trim();
      }
    }

    // 3. Check official SAP Dictionary (54,340 items)
    if (cleanSap && sapDict) {
      const dictDesc = sapDict[cleanSap] || (numSap ? sapDict[numSap] : '') || sapDict[cleanSap.toLowerCase()] || (numSap ? sapDict[numSap.toLowerCase()] : '');
      if (dictDesc && typeof dictDesc === 'string' && dictDesc.trim()) {
        return dictDesc.trim();
      }
    }

    // 4. Fallback
    if (cleanDesc && cleanDesc !== '-' && cleanDesc !== '---') return cleanDesc;
    if (cleanSap) return `SAP ${cleanSap}`;
    return 'Genel Sarf Malzeme';
  };

  // 2. Fetch Sites & Map Turbine Counts
  const officialSites = dataService.getSites();
  const siteTurbineCounts: Record<string, number> = {};
  officialSites.forEach(s => {
    siteTurbineCounts[s.name.toLowerCase().trim()] = s.turbineCount;
  });

  const getSiteTurbineCount = (siteName: string): number => {
    const clean = (siteName || '').toLowerCase().trim();
    for (const [key, count] of Object.entries(siteTurbineCounts)) {
      if (clean.includes(key) || key.includes(clean)) return count;
    }
    return 1;
  };

  // 3. Fetch All Service Reports
  const allReports = await serviceReportService.getAllReports();
  const validReports = allReports.filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return !isNaN(d.getTime());
  });

  // 4. Date & Period Filtering
  const now = new Date();
  const filteredReports = validReports.filter(r => {
    const rDate = new Date(r.date);

    if (currentPeriod === 'this-week') {
      const monday = new Date(now);
      monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
      monday.setHours(0, 0, 0, 0);
      return rDate >= monday;
    } else if (currentPeriod === 'this-month') {
      return rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
    } else if (currentPeriod === 'last-month') {
      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return rDate.getMonth() === lastMonth.getMonth() && rDate.getFullYear() === lastMonth.getFullYear();
    } else if (currentPeriod === 'this-year') {
      return rDate.getFullYear() === now.getFullYear();
    } else if (currentPeriod === 'last-year') {
      return rDate.getFullYear() === now.getFullYear() - 1;
    } else if (currentPeriod === 'custom') {
      const startStr = localStorage.getItem('material_analytics_start');
      const endStr = localStorage.getItem('material_analytics_end');
      if (startStr && endStr) {
        const start = new Date(startStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endStr);
        end.setHours(23, 59, 59, 999);
        return rDate >= start && rDate <= end;
      }
      return true;
    }
    return true; // 'all'
  });

  // Apply Site Filter if selected
  const siteFilteredReports = filteredReports.filter(r => {
    if (currentSite === 'all') return true;
    const siteName = r.siteName || (r.turbineSerial ? dataService.findTurbineBySerial(r.turbineSerial)?.siteName : '') || '';
    return siteName.toLowerCase().includes(currentSite.toLowerCase()) || (r.siteId && r.siteId === currentSite);
  });

  // 5. Aggregations & Metrics Calculation
  let totalPartsUsed = 0;
  let totalCostEUR = 0;
  let totalCostUSD = 0;
  let totalCostTRY = 0;
  let priceFoundCount = 0;

  // Data Structures
  interface ReportMaterialItem {
    reportId: string;
    reportNo: string;
    date: string;
    matFormNo: string;
    sapNo: string;
    description: string;
    type: string;
    used: number;
    unitPrice: number;
    currency: string;
    lineCost: number;
  }

  interface TurbineEntry {
    turbineKey: string;
    siteName: string;
    turbineNo: string;
    totalUsed: number;
    totalCostEUR: number;
    totalCostUSD: number;
    totalCostTRY: number;
    reportCount: number;
    items: ReportMaterialItem[];
  }

  interface SiteEntry {
    siteName: string;
    turbineCount: number;
    totalUsed: number;
    totalCostEUR: number;
    totalCostUSD: number;
    totalCostTRY: number;
    reportCount: number;
    avgUsedPerTurbine: number;
    avgCostPerTurbineEUR: number;
    avgCostPerTurbineTRY: number;
    turbines: Record<string, TurbineEntry>;
  }

  interface MaterialEntry {
    sapNo: string;
    description: string;
    type: string;
    totalUsed: number;
    unitPrice: number;
    currency: string;
    totalCost: number;
    sites: Record<string, number>;
    turbines: Record<string, number>;
  }

  interface SubsystemEntry {
    id: string;
    name: string;
    icon: string;
    color: string;
    totalUsed: number;
    totalCostEUR: number;
    materials: Record<string, { sapNo: string; description: string; used: number; totalCost: number }>;
    sites: Record<string, number>;
  }

  interface MaintenanceTypeEntry {
    id: string;
    name: string;
    icon: string;
    color: string;
    totalUsed: number;
    totalCostEUR: number;
    reportCount: number;
    sites: Record<string, number>;
    materials: Record<string, { sapNo: string; description: string; used: number; totalCost: number }>;
  }

  interface RepeatFailureEntry {
    turbineKey: string;
    siteName: string;
    turbineNo: string;
    sapNo: string;
    description: string;
    changeCount: number;
    distinctReportsCount: number;
    totalCostEUR: number;
    reports: { reportNo: string; date: string; matFormNo: string; used: number; cost: number }[];
  }

  // 🧩 Alt Sistem Sınıflandırıcısı
  const classifySubsystem = (desc: string, sapNo: string, faultDesc?: string) => {
    const text = `${desc || ''} ${sapNo || ''} ${faultDesc || ''}`.toLowerCase();

    if (text.includes('pitch') || text.includes('akü') || text.includes('batarya') || text.includes('blade') || text.includes('servo') || text.includes('enkoder pitch') || text.includes('kanat')) {
      return { id: 'pitch', name: 'Pitch & Kanat Kontrol', icon: 'fa-angles-up', color: '#00f3ff' };
    }
    if (text.includes('gearbox') || text.includes('dişli') || text.includes('rulman') || text.includes('bearing') || text.includes('kaplin') || text.includes('coupling') || text.includes('şaft') || text.includes('tahrik')) {
      return { id: 'gearbox', name: 'Dişli Kutusu (Gearbox) & Tahrik', icon: 'fa-gears', color: '#f59e0b' };
    }
    if (text.includes('jeneratör') || text.includes('generator') || text.includes('kömür') || text.includes('fırça') || text.includes('slip ring') || text.includes('slipring') || text.includes('stator') || text.includes('rotor')) {
      return { id: 'generator', name: 'Jeneratör & Güç Üretimi', icon: 'fa-bolt-lightning', color: '#eab308' };
    }
    if (text.includes('yaw') || text.includes('kule') || text.includes('fren balata') || text.includes('kaliper') || text.includes('pinyon')) {
      return { id: 'yaw', name: 'Yaw (Kule Döndürme) & Fren', icon: 'fa-compass', color: '#a855f7' };
    }
    if (text.includes('konvertör') || text.includes('converter') || text.includes('igbt') || text.includes('kontaktör') || text.includes('sigorta') || text.includes('röle') || text.includes('trafo') || text.includes('ups') || text.includes('kablo') || text.includes('invertör') || text.includes('breaker') || text.includes('güç modül')) {
      return { id: 'electrical', name: 'Konvertör & Güç Elektroniği', icon: 'fa-plug-circle-bolt', color: '#38bdf8' };
    }
    if (text.includes('hidrolik') || text.includes('hydraulic') || text.includes('akümülatör') || text.includes('valf') || text.includes('selonoid') || text.includes('solenoid') || text.includes('hortum') || text.includes('basınç') || text.includes('silindir')) {
      return { id: 'hydraulic', name: 'Hidrolik & Pnömatik Ünitesi', icon: 'fa-droplet', color: '#06b6d4' };
    }
    if (text.includes('sensör') || text.includes('sensor') || text.includes('anemometre') || text.includes('rüzgar gülü') || text.includes('plc') || text.includes('modül') || text.includes('optik') || text.includes('encoder') || text.includes('pt100') || text.includes('titreşim')) {
      return { id: 'control', name: 'Sensör, Enkoder & SCADA', icon: 'fa-satellite-dish', color: '#10b981' };
    }
    return { id: 'mechanical', name: 'Genel Mekanik & Sarf Malzeme', icon: 'fa-wrench', color: '#94a3b8' };
  };

  // 🛠️ Bakım Türü Sınıflandırıcısı
  const classifyMaintenanceType = (reportType?: string, faultDesc?: string) => {
    const text = `${reportType || ''} ${faultDesc || ''}`.toLowerCase();
    if (text.includes('arıza') || text.includes('ariza') || text.includes('duruş') || text.includes('durus') || text.includes('trip') || text.includes('acil')) {
      return { id: 'unplanned', name: 'Acil Arıza Duruşları (Plansız)', icon: 'fa-triangle-exclamation', color: '#ef4444' };
    }
    if (text.includes('revizyon') || text.includes('değişim') || text.includes('degisim') || text.includes('major') || text.includes('retrofit') || text.includes('ağır bakım')) {
      return { id: 'overhaul', name: 'Ağır Revizyon & Retrofit', icon: 'fa-hammer', color: '#f59e0b' };
    }
    return { id: 'planned', name: 'Planlı & Periyodik Bakım (Önleyici)', icon: 'fa-calendar-check', color: '#10b981' };
  };

  const siteMap: Record<string, SiteEntry> = {};
  const allTurbinesMap: Record<string, TurbineEntry> = {};
  const materialMap: Record<string, MaterialEntry> = {};
  const subsystemMap: Record<string, SubsystemEntry> = {};
  const maintTypeMap: Record<string, MaintenanceTypeEntry> = {};

  const defaultSubsystems = [
    { id: 'pitch', name: 'Pitch & Kanat Kontrol', icon: 'fa-angles-up', color: '#00f3ff' },
    { id: 'gearbox', name: 'Dişli Kutusu (Gearbox) & Tahrik', icon: 'fa-gears', color: '#f59e0b' },
    { id: 'generator', name: 'Jeneratör & Güç Üretimi', icon: 'fa-bolt-lightning', color: '#eab308' },
    { id: 'yaw', name: 'Yaw (Kule Döndürme) & Fren', icon: 'fa-compass', color: '#a855f7' },
    { id: 'electrical', name: 'Konvertör & Güç Elektroniği', icon: 'fa-plug-circle-bolt', color: '#38bdf8' },
    { id: 'hydraulic', name: 'Hidrolik & Pnömatik Ünitesi', icon: 'fa-droplet', color: '#06b6d4' },
    { id: 'control', name: 'Sensör, Enkoder & SCADA', icon: 'fa-satellite-dish', color: '#10b981' },
    { id: 'mechanical', name: 'Genel Mekanik & Sarf Malzeme', icon: 'fa-wrench', color: '#94a3b8' }
  ];

  defaultSubsystems.forEach(s => {
    subsystemMap[s.id] = { ...s, totalUsed: 0, totalCostEUR: 0, materials: {}, sites: {} };
  });

  const defaultMaintTypes = [
    { id: 'planned', name: 'Planlı & Periyodik Bakım (Önleyici)', icon: 'fa-calendar-check', color: '#10b981' },
    { id: 'unplanned', name: 'Acil Arıza Duruşları (Plansız)', icon: 'fa-triangle-exclamation', color: '#ef4444' },
    { id: 'overhaul', name: 'Ağır Revizyon & Retrofit', icon: 'fa-hammer', color: '#f59e0b' }
  ];

  defaultMaintTypes.forEach(m => {
    maintTypeMap[m.id] = { ...m, totalUsed: 0, totalCostEUR: 0, reportCount: 0, sites: {}, materials: {} };
  });

  // Initialize official sites in siteMap so zero-consumption sites are also tracked accurately
  officialSites.forEach(s => {
    siteMap[s.name] = {
      siteName: s.name,
      turbineCount: s.turbineCount,
      totalUsed: 0,
      totalCostEUR: 0,
      totalCostUSD: 0,
      totalCostTRY: 0,
      reportCount: 0,
      avgUsedPerTurbine: 0,
      avgCostPerTurbineEUR: 0,
      avgCostPerTurbineTRY: 0,
      turbines: {}
    };
  });

  siteFilteredReports.forEach(report => {
    if (!report.materials || !Array.isArray(report.materials) || report.materials.length === 0) return;

    let rawSite = report.siteName || (report.turbineSerial ? dataService.findTurbineBySerial(report.turbineSerial)?.siteName : '') || 'Genel Santral';
    // Match official name if possible
    const matchedOfficial = officialSites.find(s => rawSite.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(rawSite.toLowerCase()));
    const site = matchedOfficial ? matchedOfficial.name : rawSite;
    const tCount = matchedOfficial ? matchedOfficial.turbineCount : getSiteTurbineCount(site);

    const tNo = report.turbineNo || (report.turbineSerial ? dataService.findTurbineBySerial(report.turbineSerial)?.turbineNo : '') || report.turbineSerial || 'Genel';
    const turbineKey = `${site} - ${tNo}`;

    if (!siteMap[site]) {
      siteMap[site] = {
        siteName: site,
        turbineCount: tCount,
        totalUsed: 0,
        totalCostEUR: 0,
        totalCostUSD: 0,
        totalCostTRY: 0,
        reportCount: 0,
        avgUsedPerTurbine: 0,
        avgCostPerTurbineEUR: 0,
        avgCostPerTurbineTRY: 0,
        turbines: {}
      };
    }
    siteMap[site].reportCount++;

    if (!siteMap[site].turbines[tNo]) {
      siteMap[site].turbines[tNo] = {
        turbineKey,
        siteName: site,
        turbineNo: tNo,
        totalUsed: 0,
        totalCostEUR: 0,
        totalCostUSD: 0,
        totalCostTRY: 0,
        reportCount: 0,
        items: []
      };
    }
    siteMap[site].turbines[tNo].reportCount++;

    if (!allTurbinesMap[turbineKey]) {
      allTurbinesMap[turbineKey] = {
        turbineKey,
        siteName: site,
        turbineNo: tNo,
        totalUsed: 0,
        totalCostEUR: 0,
        totalCostUSD: 0,
        totalCostTRY: 0,
        reportCount: 0,
        items: []
      };
    }
    allTurbinesMap[turbineKey].reportCount++;

    report.materials.forEach((mat: any) => {
      const sapNo = (mat.sapNo || '').trim();
      const desc = resolveMaterialDescription(sapNo, mat.description);
      const type = mat.type || 'Sarf';
      const used = Number(mat.used) || Math.max(0, (Number(mat.received) || 0) - (Number(mat.returned) || 0));

      if (used <= 0) return; // Sadece harcanan/takılan malzemeler

      totalPartsUsed += used;

      // Price Lookup (Sadece yetkili ise hesaplanır)
      let unitPrice = 0;
      let currency = 'EUR';
      let lineCost = 0;

      if (canViewPrices) {
        const pInfo = getPriceInfo(sapNo, site);
        if (pInfo && pInfo.price > 0) {
          unitPrice = pInfo.price;
          currency = pInfo.currency || 'EUR';
          lineCost = unitPrice * used;
          priceFoundCount++;

          if (currency === 'USD') {
            totalCostUSD += lineCost;
            siteMap[site].totalCostUSD += lineCost;
            siteMap[site].turbines[tNo].totalCostUSD += lineCost;
            allTurbinesMap[turbineKey].totalCostUSD += lineCost;
          } else if (currency === 'TRY') {
            totalCostTRY += lineCost;
            siteMap[site].totalCostTRY += lineCost;
            siteMap[site].turbines[tNo].totalCostTRY += lineCost;
            allTurbinesMap[turbineKey].totalCostTRY += lineCost;
          } else {
            totalCostEUR += lineCost;
            siteMap[site].totalCostEUR += lineCost;
            siteMap[site].turbines[tNo].totalCostEUR += lineCost;
            allTurbinesMap[turbineKey].totalCostEUR += lineCost;
          }
        }
      }

      siteMap[site].totalUsed += used;
      siteMap[site].turbines[tNo].totalUsed += used;
      allTurbinesMap[turbineKey].totalUsed += used;

      const itemRecord: ReportMaterialItem = {
        reportId: report.id || '',
        reportNo: report.reportNo || '-',
        date: report.date,
        matFormNo: report.matFormNo || '-',
        sapNo,
        description: desc,
        type,
        used,
        unitPrice,
        currency,
        lineCost
      };

      siteMap[site].turbines[tNo].items.push(itemRecord);
      allTurbinesMap[turbineKey].items.push(itemRecord);

      // Material Level Map
      const matKey = sapNo || desc;
      if (!materialMap[matKey]) {
        materialMap[matKey] = {
          sapNo,
          description: desc,
          type,
          totalUsed: 0,
          unitPrice,
          currency,
          totalCost: 0,
          sites: {},
          turbines: {}
        };
      }
      materialMap[matKey].totalUsed += used;
      materialMap[matKey].totalCost += lineCost;
      materialMap[matKey].sites[site] = (materialMap[matKey].sites[site] || 0) + used;
      materialMap[matKey].turbines[tNo] = (materialMap[matKey].turbines[tNo] || 0) + used;

      // 🧩 Subsystem accumulation
      const sub = classifySubsystem(desc, sapNo, report.faultDesc);
      if (!subsystemMap[sub.id]) {
        subsystemMap[sub.id] = { ...sub, totalUsed: 0, totalCostEUR: 0, materials: {}, sites: {} };
      }
      subsystemMap[sub.id].totalUsed += used;
      subsystemMap[sub.id].totalCostEUR += lineCost;
      subsystemMap[sub.id].sites[site] = (subsystemMap[sub.id].sites[site] || 0) + used;
      if (!subsystemMap[sub.id].materials[matKey]) {
        subsystemMap[sub.id].materials[matKey] = { sapNo, description: desc, used: 0, totalCost: 0 };
      }
      subsystemMap[sub.id].materials[matKey].used += used;
      subsystemMap[sub.id].materials[matKey].totalCost += lineCost;

      // 🛠️ Maintenance Type accumulation
      const mType = classifyMaintenanceType(report.type, report.faultDesc);
      if (!maintTypeMap[mType.id]) {
        maintTypeMap[mType.id] = { ...mType, totalUsed: 0, totalCostEUR: 0, reportCount: 0, sites: {}, materials: {} };
      }
      maintTypeMap[mType.id].totalUsed += used;
      maintTypeMap[mType.id].totalCostEUR += lineCost;
      maintTypeMap[mType.id].sites[site] = (maintTypeMap[mType.id].sites[site] || 0) + used;
      if (!maintTypeMap[mType.id].materials[matKey]) {
        maintTypeMap[mType.id].materials[matKey] = { sapNo, description: desc, used: 0, totalCost: 0 };
      }
      maintTypeMap[mType.id].materials[matKey].used += used;
      maintTypeMap[mType.id].materials[matKey].totalCost += lineCost;
    });
  });

  // Calculate Repeat Failures (Chronically replaced parts per turbine)
  const repeatFailures: RepeatFailureEntry[] = [];
  Object.values(allTurbinesMap).forEach(t => {
    const matGroups: Record<string, { sapNo: string; description: string; totalUsed: number; reports: Map<string, any> }> = {};
    t.items.forEach(it => {
      const k = it.sapNo || it.description;
      if (!matGroups[k]) {
        matGroups[k] = {
          sapNo: it.sapNo,
          description: it.description,
          totalUsed: 0,
          reports: new Map()
        };
      }
      matGroups[k].totalUsed += it.used;
      if (!matGroups[k].reports.has(it.reportNo)) {
        matGroups[k].reports.set(it.reportNo, {
          reportNo: it.reportNo,
          date: it.date,
          matFormNo: it.matFormNo,
          used: it.used,
          cost: it.lineCost
        });
      } else {
        const existing = matGroups[k].reports.get(it.reportNo);
        existing.used += it.used;
        existing.cost += it.lineCost;
      }
    });

    Object.values(matGroups).forEach(g => {
      if (g.reports.size >= 2 || (g.totalUsed >= 2 && g.reports.size >= 1)) {
        const repList = Array.from(g.reports.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const totalCost = repList.reduce((sum, r) => sum + (r.cost || 0), 0);
        repeatFailures.push({
          turbineKey: t.turbineKey,
          siteName: t.siteName,
          turbineNo: t.turbineNo,
          sapNo: g.sapNo,
          description: g.description,
          changeCount: g.totalUsed,
          distinctReportsCount: g.reports.size,
          totalCostEUR: totalCost,
          reports: repList
        });
      }
    });
  });

  repeatFailures.sort((a, b) => {
    if (b.distinctReportsCount !== a.distinctReportsCount) return b.distinctReportsCount - a.distinctReportsCount;
    return b.changeCount - a.changeCount;
  });

  const sortedSubsystems = Object.values(subsystemMap).sort((a, b) => b.totalUsed - a.totalUsed);
  const sortedMaintTypes = Object.values(maintTypeMap).sort((a, b) => b.totalUsed - a.totalUsed);

  // Calculate Averages per turbine for each site
  Object.values(siteMap).forEach(s => {
    const tCount = Math.max(1, s.turbineCount || 1);
    s.avgUsedPerTurbine = parseFloat((s.totalUsed / tCount).toFixed(1));
    s.avgCostPerTurbineEUR = parseFloat((s.totalCostEUR / tCount).toFixed(1));
    s.avgCostPerTurbineTRY = parseFloat((s.totalCostTRY / tCount).toFixed(1));
  });

  // Sort Sites based on chosen criteria
  const sortedSites = Object.values(siteMap)
    .filter(s => currentSite === 'all' || s.siteName.toLowerCase().includes(currentSite.toLowerCase()))
    .sort((a, b) => {
      if (siteSortBy === 'quantity') return b.totalUsed - a.totalUsed;
      if (canViewPrices && siteSortBy === 'totalCost') return b.totalCostEUR - a.totalCostEUR;
      if (canViewPrices && siteSortBy === 'costPerTurbine') return b.avgCostPerTurbineEUR - a.avgCostPerTurbineEUR;
      if (siteSortBy === 'name') return a.siteName.localeCompare(b.siteName, 'tr');
      // Default: 'density' (Adil Tüketim Yoğunluğu)
      return b.avgUsedPerTurbine - a.avgUsedPerTurbine;
    });

  const sortedTurbines = Object.values(allTurbinesMap)
    .sort((a, b) => b.totalUsed - a.totalUsed);

  const sortedMaterials = Object.values(materialMap)
    .sort((a, b) => b.totalUsed - a.totalUsed);

  const totalMaterialsCostEUR = sortedMaterials.filter(m => m.currency === 'EUR' || !m.currency).reduce((sum, m) => sum + (m.totalCost || 0), 0);
  const totalMaterialsCostTRY = sortedMaterials.filter(m => m.currency === 'TRY').reduce((sum, m) => sum + (m.totalCost || 0), 0);
  const totalMaterialsCostUSD = sortedMaterials.filter(m => m.currency === 'USD').reduce((sum, m) => sum + (m.totalCost || 0), 0);
  const totalMaterialsUsedCount = sortedMaterials.reduce((sum, m) => sum + (m.totalUsed || 0), 0);
  const pricedMaterialsCount = sortedMaterials.filter(m => m.totalCost > 0).length;

  const uniqueSapCount = sortedMaterials.length;
  const topSiteByDensity = sortedSites[0];
  const topTurbine = sortedTurbines[0];

  const totalAllTurbines = officialSites.reduce((sum, s) => sum + s.turbineCount, 0);
  const overallAvgPerTurbine = totalAllTurbines > 0 ? (totalPartsUsed / totalAllTurbines).toFixed(1) : '0';

  // Helper formatting
  const formatCostBadge = (eur: number, tryVal: number, usd: number) => {
    if (!canViewPrices) return '-';
    const parts = [];
    if (eur > 0) parts.push(`${eur.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`);
    if (usd > 0) parts.push(`${usd.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} $`);
    if (tryVal > 0) parts.push(`${tryVal.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₺`);
    return parts.length > 0 ? parts.join(' | ') : '-';
  };

  // Global window functions for UI
  (window as any).setMaterialAnalyticsPeriod = (period: string) => {
    localStorage.setItem('material_analytics_period', period);
    (window as any).navigate('material-analytics');
  };

  (window as any).setMaterialAnalyticsSite = (site: string) => {
    localStorage.setItem('material_analytics_site', site);
    (window as any).navigate('material-analytics');
  };

  (window as any).setMaterialAnalyticsTab = (tab: string) => {
    localStorage.setItem('material_analytics_tab', tab);
    (window as any).navigate('material-analytics');
  };

  (window as any).setMaterialSiteSort = (sort: string) => {
    localStorage.setItem('material_analytics_site_sort', sort);
    (window as any).navigate('material-analytics');
  };

  (window as any).setCustomMaterialAnalyticsPeriod = () => {
    const start = (document.getElementById('mat-analytics-start') as HTMLInputElement)?.value;
    const end = (document.getElementById('mat-analytics-end') as HTMLInputElement)?.value;
    if (start && end) {
      localStorage.setItem('material_analytics_start', start);
      localStorage.setItem('material_analytics_end', end);
      (window as any).setMaterialAnalyticsPeriod('custom');
    } else {
      alert('Lütfen başlangıç ve bitiş tarihlerini seçiniz.');
    }
  };

  (window as any).toggleAccordion = (id: string) => {
    const content = document.getElementById(id);
    const icon = document.getElementById(id + '-icon');
    if (content && icon) {
      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.style.transform = 'rotate(90deg)';
      } else {
        content.style.display = 'none';
        icon.style.transform = 'rotate(0deg)';
      }
    }
  };

  (window as any).filterMaterialAnalyticsTable = (query: string) => {
    const term = (query || '').trim().toLowerCase();
    const rows = document.querySelectorAll('.mat-search-row');
    rows.forEach((row: any) => {
      const text = (row.innerText || '').toLowerCase();
      row.style.display = (!term || text.includes(term)) ? '' : 'none';
    });
  };

  (window as any).exportMaterialAnalyticsExcel = () => {
    // 1. Period Text
    let periodText = 'Bu Yıl (2026)';
    if (currentPeriod === 'this-month') periodText = 'Bu Ay';
    else if (currentPeriod === 'last-month') periodText = 'Önceki Ay';
    else if (currentPeriod === 'this-year') periodText = 'Bu Yıl (2026)';
    else if (currentPeriod === 'last-year') periodText = 'Geçen Yıl (2025)';
    else if (currentPeriod === 'this-week') periodText = 'Bu Hafta';
    else if (currentPeriod === 'custom') {
      const s = localStorage.getItem('material_analytics_start') || '';
      const e = localStorage.getItem('material_analytics_end') || '';
      periodText = `Özel Tarih Aralığı (${s} - ${e})`;
    } else if (currentPeriod === 'all') periodText = 'Tüm Zamanlar';

    const siteText = currentSite === 'all' ? 'Tüm Santraller (10 Santral)' : currentSite;
    const reportDateStr = new Date().toLocaleString('tr-TR');

    // Styling helpers for xlsx-js-style
    const stTitle = {
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '0F172A' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const stSubTitle = {
      font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: '38BDF8' } },
      fill: { fgColor: { rgb: '1E293B' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
    const stKpiLabel = {
      font: { name: 'Calibri', sz: 9, bold: true, color: { rgb: '94A3B8' } },
      fill: { fgColor: { rgb: '1E293B' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin', color: { rgb: '334155' } }, left: { style: 'thin', color: { rgb: '334155' } }, right: { style: 'thin', color: { rgb: '334155' } } }
    };
    const stKpiValue = {
      font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: '38BDF8' } },
      fill: { fgColor: { rgb: '0F172A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { bottom: { style: 'thin', color: { rgb: '334155' } }, left: { style: 'thin', color: { rgb: '334155' } }, right: { style: 'thin', color: { rgb: '334155' } } }
    };
    const stKpiValueCost = {
      font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: '10B981' } },
      fill: { fgColor: { rgb: '0F172A' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { bottom: { style: 'thin', color: { rgb: '334155' } }, left: { style: 'thin', color: { rgb: '334155' } }, right: { style: 'thin', color: { rgb: '334155' } } }
    };
    const stSection = {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '0284C7' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
    const stHeader = {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '0F172A' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: { top: { style: 'thin', color: { rgb: '475569' } }, bottom: { style: 'thin', color: { rgb: '475569' } }, left: { style: 'thin', color: { rgb: '475569' } }, right: { style: 'thin', color: { rgb: '475569' } } }
    };
    const stTotal = {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: 'CBD5E1' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin', color: { rgb: '0F172A' } }, bottom: { style: 'double', color: { rgb: '0F172A' } } }
    };
    const stTotalMoney = {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: 'CBD5E1' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: { top: { style: 'thin', color: { rgb: '0F172A' } }, bottom: { style: 'double', color: { rgb: '0F172A' } } },
      numFmt: '#,##0.00 "€"'
    };
    const stTotalPerT = {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0F172A' } },
      fill: { fgColor: { rgb: 'CBD5E1' } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin', color: { rgb: '0F172A' } }, bottom: { style: 'double', color: { rgb: '0F172A' } } },
      numFmt: '#,##0.00 "€/Türbin"'
    };
    const stCellLeft = {
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } }
    };
    const stCellLeftWrap = {
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } }
    };
    const stCellCenter = {
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } }
    };
    const stCellCenterPerT = {
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      numFmt: '#,##0.00 "€/Türbin"'
    };
    const stCellRight = {
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } }
    };
    const stCellUnitPrice = {
      font: { name: 'Calibri', sz: 10 },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      numFmt: '#,##0.00 "€"'
    };
    const stCellBoldNum = {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '0284C7' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      numFmt: '#,##0'
    };
    const stCellMoney = {
      font: { name: 'Calibri', sz: 10, color: { rgb: '059669' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      numFmt: '#,##0.00 "€"'
    };
    const stCellBoldMoney = {
      font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: '059669' } },
      alignment: { horizontal: 'right', vertical: 'center' },
      border: { bottom: { style: 'thin', color: { rgb: 'E2E8F0' } } },
      numFmt: '#,##0.00 "€"'
    };

    // Cell helper creators for pristine numbers & currency symbols
    const createMoneyCell = (val: number, isBold = false) => {
      if (!canViewPrices || !val || isNaN(val) || val <= 0) {
        return { v: '-', t: 's', s: stCellCenter };
      }
      const rounded = Math.round(val * 100) / 100;
      return {
        v: rounded,
        t: 'n',
        z: '#,##0.00 "€"',
        s: isBold ? stCellBoldMoney : stCellMoney
      };
    };

    const createTotalMoneyCell = (val: number) => {
      if (!canViewPrices || !val || isNaN(val) || val <= 0) {
        return { v: '-', t: 's', s: stTotal };
      }
      const rounded = Math.round(val * 100) / 100;
      return {
        v: rounded,
        t: 'n',
        z: '#,##0.00 "€"',
        s: stTotalMoney
      };
    };

    const createUnitPriceCell = (val: number) => {
      if (!canViewPrices || !val || isNaN(val) || val <= 0) {
        return { v: '-', t: 's', s: stCellCenter };
      }
      const rounded = Math.round(val * 100) / 100;
      return {
        v: rounded,
        t: 'n',
        z: '#,##0.00 "€"',
        s: stCellUnitPrice
      };
    };

    const createQtyCell = (val: number, isBold = true) => {
      if (!val || isNaN(val) || val <= 0) {
        return { v: '-', t: 's', s: stCellCenter };
      }
      return {
        v: val,
        t: 'n',
        z: '#,##0',
        s: isBold ? stCellBoldNum : stCellRight
      };
    };

    const createTotalQtyCell = (val: number) => {
      if (!val || isNaN(val) || val <= 0) {
        return { v: '-', t: 's', s: stTotal };
      }
      return {
        v: val,
        t: 'n',
        z: '#,##0',
        s: stTotal
      };
    };

    const createDensityCell = (totalUsed: number, turbineCount: number) => {
      if (!totalUsed || !turbineCount || turbineCount <= 0) {
        return { v: '-', t: 's', s: stCellCenter };
      }
      const dens = (totalUsed / turbineCount).toFixed(1);
      return { v: `${dens} Ad/Türbin`, t: 's', s: stCellCenter };
    };

    const createCostPerTurbineCell = (totalCost: number, turbineCount: number) => {
      if (!canViewPrices || !totalCost || !turbineCount || turbineCount <= 0 || totalCost <= 0) {
        return { v: '-', t: 's', s: stCellCenter };
      }
      const rounded = Math.round((totalCost / turbineCount) * 100) / 100;
      return {
        v: rounded,
        t: 'n',
        z: '#,##0.00 "€/Türbin"',
        s: stCellCenterPerT
      };
    };

    const createTotalCostPerTurbineCell = (totalCost: number, turbineCount: number) => {
      if (!canViewPrices || !totalCost || !turbineCount || turbineCount <= 0 || totalCost <= 0) {
        return { v: '-', t: 's', s: stTotal };
      }
      const rounded = Math.round((totalCost / turbineCount) * 100) / 100;
      return {
        v: rounded,
        t: 'n',
        z: '#,##0.00 "€/Türbin"',
        s: stTotalPerT
      };
    };

    const wb = XLSX.utils.book_new();

    // =========================================================================
    // 📊 SHEET 1: YÖNETİCİ ÖZETİ & KPI DASHBOARD
    // =========================================================================
    const s1Aoa: any[][] = [];
    s1Aoa.push([{ v: 'DEMİRER HOLDİNG - MALZEME TÜKETİM VE MALİYET YÖNETİCİ RAPORU', s: stTitle }]);
    s1Aoa.push([{ v: `Dönem: ${periodText}  |  Santral: ${siteText}  |  Rapor Oluşturma: ${reportDateStr}`, s: stSubTitle }]);
    s1Aoa.push([]); // empty

    // 4 KPI Cards
    s1Aoa.push([
      { v: 'TOPLAM HARCANAN MALZEME', s: stKpiLabel },
      '',
      { v: 'TOPLAM MALİYET TUTARI', s: stKpiLabel },
      '',
      { v: 'TÜRBİN BAŞINA ORTALAMA', s: stKpiLabel },
      '',
      { v: 'EN YÜKSEK TÜKETİM YOĞUNLUĞU', s: stKpiLabel },
      ''
    ]);
    const topDensitySite = sortedSites[0];
    const formattedKpiCost = canViewPrices && totalCostEUR > 0 
      ? `${(Math.round(totalCostEUR * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` 
      : (canViewPrices ? '-' : 'Yetki Gerekli');

    s1Aoa.push([
      { v: `${totalPartsUsed.toLocaleString('tr-TR')} Adet`, s: stKpiValue },
      '',
      { v: formattedKpiCost, s: stKpiValueCost },
      '',
      { v: `${overallAvgPerTurbine} Adet / Türbin`, s: stKpiValue },
      '',
      { v: topDensitySite ? `${topDensitySite.siteName} (${topDensitySite.avgUsedPerTurbine} Ad/Türbin)` : '-', s: stKpiValue },
      ''
    ]);
    s1Aoa.push([]); // empty

    // Section 1: Top 10 Turbines
    s1Aoa.push([{ v: '🚨 EN ÇOK MALZEME TÜKETEN İLK 10 KRİTİK TÜRBİN', s: stSection }]);
    s1Aoa.push([
      { v: 'Sıra', s: stHeader },
      { v: 'Santral Adı', s: stHeader },
      { v: 'Türbin No', s: stHeader },
      { v: 'Toplam Sarfiyat (Adet)', s: stHeader },
      { v: 'Toplam Maliyet (€)', s: stHeader },
      { v: 'Servis Rapor Sayısı', s: stHeader },
      { v: 'Farklı Parça Çeşidi', s: stHeader },
      { v: 'En Çok Değişen Parçalar (Top 3)', s: stHeader }
    ]);

    const top10Turbines = sortedTurbines.slice(0, 10).map((t, idx) => {
      const matFreq: Record<string, number> = {};
      t.items.forEach(it => {
        const k = it.description || it.sapNo || 'Parça';
        matFreq[k] = (matFreq[k] || 0) + it.used;
      });
      const topMats = Object.entries(matFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', ');
      return { ...t, topMats, distinctCount: Object.keys(matFreq).length, rank: idx + 1 };
    });

    top10Turbines.forEach(t => {
      s1Aoa.push([
        { v: t.rank, s: stCellCenter },
        { v: t.siteName, s: stCellLeft },
        { v: t.turbineNo, s: stCellCenter },
        createQtyCell(t.totalUsed, true),
        createMoneyCell(t.totalCostEUR, true),
        { v: t.reportCount, s: stCellCenter },
        { v: t.distinctCount, s: stCellCenter },
        { v: t.topMats || '-', s: stCellLeftWrap }
      ]);
    });

    s1Aoa.push([]); // empty

    // Section 2: Top 10 SAP Materials
    s1Aoa.push([{ v: '⭐ EN ÇOK TÜKETİLEN İLK 10 SAP MALZEMESİ', s: stSection }]);
    s1Aoa.push([
      { v: 'Sıra', s: stHeader },
      { v: 'SAP Kodu', s: stHeader },
      { v: 'Malzeme Tanımı', s: stHeader },
      { v: 'Türü', s: stHeader },
      { v: 'Toplam Tüketim (Adet)', s: stHeader },
      { v: 'Birim Fiyat (€)', s: stHeader },
      { v: 'Toplam Tutar (€)', s: stHeader },
      { v: 'Kullanılan Santraller', s: stHeader }
    ]);

    const top10Mats = sortedMaterials.slice(0, 10);
    top10Mats.forEach((m, idx) => {
      const siteSummary = Object.entries(m.sites).map(([s, c]) => `${s} (${c})`).join(', ');
      s1Aoa.push([
        { v: idx + 1, s: stCellCenter },
        { v: m.sapNo || '-', s: stCellCenter },
        { v: m.description, s: stCellLeftWrap },
        { v: m.type, s: stCellCenter },
        createQtyCell(m.totalUsed, true),
        createUnitPriceCell(m.unitPrice),
        createMoneyCell(m.totalCost, true),
        { v: siteSummary, s: stCellLeftWrap }
      ]);
    });

    const ws1 = XLSX.utils.aoa_to_sheet(s1Aoa);
    const top10TurbinesOffset = top10Turbines.length;
    ws1['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
      { s: { r: 4, c: 0 }, e: { r: 4, c: 1 } },
      { s: { r: 3, c: 2 }, e: { r: 3, c: 3 } },
      { s: { r: 4, c: 2 }, e: { r: 4, c: 3 } },
      { s: { r: 3, c: 4 }, e: { r: 3, c: 5 } },
      { s: { r: 4, c: 4 }, e: { r: 4, c: 5 } },
      { s: { r: 3, c: 6 }, e: { r: 3, c: 7 } },
      { s: { r: 4, c: 6 }, e: { r: 4, c: 7 } },
      { s: { r: 6, c: 0 }, e: { r: 6, c: 7 } },
      { s: { r: 6 + top10TurbinesOffset + 2, c: 0 }, e: { r: 6 + top10TurbinesOffset + 2, c: 7 } }
    ];
    ws1['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws1, "📊 Yönetici Özeti");

    // =========================================================================
    // 📅 SHEET 2: SAHALARIN AYLIK TÜKETİM MATRİSİ (12 AY TRENDİ)
    // =========================================================================
    const s2Aoa: any[][] = [];
    s2Aoa.push([{ v: `SAHALARIN AYLIK MALZEME TÜKETİM ADETLERİ (12 AY TRENDİ - ${periodText})`, s: stTitle }]);
    s2Aoa.push([{ v: `Rapor Tarihi: ${reportDateStr} | Tüm Değerler Sarf Edilen Parça Adedidir`, s: stSubTitle }]);
    s2Aoa.push([]);

    const monthHeaders = ['Santral Adı', 'Türbin Sayısı', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık', 'TOPLAM SARFİYAT', 'TÜRBİN BAŞI YOĞUNLUK'];
    s2Aoa.push(monthHeaders.map(h => ({ v: h, s: stHeader })));

    const monthTotalsQty = new Array(12).fill(0);
    const monthTotalsCost = new Array(12).fill(0);
    let totalSiteTurbines = 0;
    let grandTotalUsed = 0;
    let grandTotalCost = 0;

    const monthlySiteData: Record<string, { qty: number[]; cost: number[]; totalQty: number; totalCost: number; turbineCount: number }> = {};
    
    officialSites.forEach(s => {
      monthlySiteData[s.name] = {
        qty: new Array(12).fill(0),
        cost: new Array(12).fill(0),
        totalQty: 0,
        totalCost: 0,
        turbineCount: s.turbineCount
      };
    });

    siteFilteredReports.forEach(r => {
      if (!r.materials || !Array.isArray(r.materials) || !r.date) return;
      const rDate = new Date(r.date);
      const mIdx = rDate.getMonth();
      if (mIdx < 0 || mIdx > 11) return;

      let rawSite = r.siteName || (r.turbineSerial ? dataService.findTurbineBySerial(r.turbineSerial)?.siteName : '') || 'Genel Santral';
      const matched = officialSites.find(s => rawSite.toLowerCase().includes(s.name.toLowerCase()) || s.name.toLowerCase().includes(rawSite.toLowerCase()));
      const sName = matched ? matched.name : rawSite;

      if (!monthlySiteData[sName]) {
        monthlySiteData[sName] = {
          qty: new Array(12).fill(0),
          cost: new Array(12).fill(0),
          totalQty: 0,
          totalCost: 0,
          turbineCount: getSiteTurbineCount(sName)
        };
      }

      r.materials.forEach((mat: any) => {
        const used = Number(mat.used) || Math.max(0, (Number(mat.received) || 0) - (Number(mat.returned) || 0));
        if (used <= 0) return;

        let lineCost = 0;
        if (canViewPrices) {
          const pInfo = getPriceInfo((mat.sapNo || '').trim(), sName);
          if (pInfo && pInfo.price > 0) lineCost = pInfo.price * used;
        }

        monthlySiteData[sName].qty[mIdx] += used;
        monthlySiteData[sName].cost[mIdx] += lineCost;
        monthlySiteData[sName].totalQty += used;
        monthlySiteData[sName].totalCost += lineCost;
      });
    });

    Object.entries(monthlySiteData).forEach(([sName, data]) => {
      totalSiteTurbines += data.turbineCount;
      grandTotalUsed += data.totalQty;
      grandTotalCost += data.totalCost;
      data.qty.forEach((q, idx) => monthTotalsQty[idx] += q);
      data.cost.forEach((c, idx) => monthTotalsCost[idx] += c);

      const row: any[] = [
        { v: sName, s: stCellLeft },
        { v: data.turbineCount, s: stCellCenter }
      ];
      data.qty.forEach(q => row.push(createQtyCell(q, true)));
      row.push(createQtyCell(data.totalQty, true));
      row.push(createDensityCell(data.totalQty, data.turbineCount));
      s2Aoa.push(row);
    });

    // Grand Total Row for Quantities
    const totalRowQty: any[] = [
      { v: 'GENEL TOPLAM', s: stTotal },
      { v: totalSiteTurbines, s: stTotal }
    ];
    monthTotalsQty.forEach(q => totalRowQty.push(createTotalQtyCell(q)));
    totalRowQty.push(createTotalQtyCell(grandTotalUsed));
    totalRowQty.push(createDensityCell(grandTotalUsed, totalSiteTurbines));
    s2Aoa.push(totalRowQty);

    // Section 2: Monthly Costs (€) if authorized
    if (canViewPrices) {
      s2Aoa.push([]); // empty
      s2Aoa.push([{ v: `SAHALARIN AYLIK MALZEME MALİYETLERİ (€ / EUR - ${periodText})`, s: stTitle }]);
      const costHeaders = ['Santral Adı', 'Türbin Sayısı', 'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık', 'YILLIK TOPLAM TUTAR (€)', 'TÜRBİN BAŞINA MALİYET (€)'];
      s2Aoa.push(costHeaders.map(h => ({ v: h, s: stHeader })));

      Object.entries(monthlySiteData).forEach(([sName, data]) => {
        const row: any[] = [
          { v: sName, s: stCellLeft },
          { v: data.turbineCount, s: stCellCenter }
        ];
        data.cost.forEach(c => row.push(createMoneyCell(c, true)));
        row.push(createMoneyCell(data.totalCost, true));
        row.push(createCostPerTurbineCell(data.totalCost, data.turbineCount));
        s2Aoa.push(row);
      });

      const totalRowCost: any[] = [
        { v: 'GENEL MALİYET TOPLAMI', s: stTotal },
        { v: totalSiteTurbines, s: stTotal }
      ];
      monthTotalsCost.forEach(c => totalRowCost.push(createTotalMoneyCell(c)));
      totalRowCost.push(createTotalMoneyCell(grandTotalCost));
      totalRowCost.push(createTotalCostPerTurbineCell(grandTotalCost, totalSiteTurbines));
      s2Aoa.push(totalRowCost);
    }

    const ws2 = XLSX.utils.aoa_to_sheet(s2Aoa);
    ws2['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 15 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 15 } }
    ];
    ws2['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, ws2, "📅 Aylık Tüketim Matrisi");

    // =========================================================================
    // 🏛️ SHEET 3: SAHALARIN YILLIK ÖZETİ
    // =========================================================================
    const s3Aoa: any[][] = [];
    s3Aoa.push([{ v: `RÜZGAR SANTRALLERİ MALZEME TÜKETİM & MALİYET KARŞILAŞTIRMA RAPORU`, s: stTitle }]);
    s3Aoa.push([{ v: `Dönem: ${periodText} | Sıralama: Tüketim Yoğunluğu (Türbin Başına Sarfiyat)`, s: stSubTitle }]);
    s3Aoa.push([]);

    const siteHeaders = [
      'Sıra', 'Santral Adı', 'Türbin Sayısı', 'Servis Rapor Sayısı',
      'Toplam Sarfiyat (Adet)', 'Türbin Başına Yoğunluk', 'Toplam Maliyet (€)',
      'En Çok Harcayan Türbin', 'En Çok Tüketilen Malzeme'
    ];
    s3Aoa.push(siteHeaders.map(h => ({ v: h, s: stHeader })));

    sortedSites.forEach((s, idx) => {
      const siteTurbines = Object.values(s.turbines).sort((a, b) => b.totalUsed - a.totalUsed);
      const topT = siteTurbines[0] ? `${siteTurbines[0].turbineNo} (${siteTurbines[0].totalUsed} Adet)` : '-';

      const sMatFreq: Record<string, number> = {};
      Object.values(s.turbines).forEach(t => {
        t.items.forEach(it => {
          const k = it.description || it.sapNo || 'Parça';
          sMatFreq[k] = (sMatFreq[k] || 0) + it.used;
        });
      });
      const topMat = Object.entries(sMatFreq).sort((a, b) => b[1] - a[1])[0];
      const topMatStr = topMat ? `${topMat[0]} (${topMat[1]} Adet)` : '-';

      s3Aoa.push([
        { v: idx + 1, s: stCellCenter },
        { v: s.siteName, s: stCellLeft },
        { v: s.turbineCount, s: stCellCenter },
        { v: s.reportCount, s: stCellCenter },
        createQtyCell(s.totalUsed, true),
        createDensityCell(s.totalUsed, s.turbineCount),
        createMoneyCell(s.totalCostEUR, true),
        { v: topT, s: stCellLeft },
        { v: topMatStr, s: stCellLeftWrap }
      ]);
    });

    s3Aoa.push([
      { v: 'TOPLAM', s: stTotal },
      { v: `${sortedSites.length} Santral`, s: stTotal },
      { v: totalSiteTurbines, s: stTotal },
      { v: siteFilteredReports.length, s: stTotal },
      createTotalQtyCell(totalPartsUsed),
      createDensityCell(totalPartsUsed, totalSiteTurbines),
      createTotalMoneyCell(totalCostEUR),
      { v: '—', s: stTotal },
      { v: '—', s: stTotal }
    ]);

    const ws3 = XLSX.utils.aoa_to_sheet(s3Aoa);
    ws3['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }
    ];
    ws3['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 14 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 25 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, ws3, "🏛️ Santral Tüketim Özeti");

    // =========================================================================
    // ⚡ SHEET 4: TÜM TÜRBİNLERİN TÜKETİM SIRALAMASI
    // =========================================================================
    const s4Aoa: any[][] = [];
    s4Aoa.push([{ v: `TÜM TÜRBİNLERİN MALZEME TÜKETİM SIRALAMASI (${periodText})`, s: stTitle }]);
    s4Aoa.push([{ v: `Toplam ${sortedTurbines.length} Türbin | En Çok Sarfiyat Yapan Türbinden En Aza Sıralı`, s: stSubTitle }]);
    s4Aoa.push([]);

    const turbineHeaders = [
      'Genel Sıra', 'Santral Adı', 'Türbin No', 'Toplam Sarfiyat (Adet)',
      'Toplam Maliyet (€)', 'Servis Rapor Sayısı', 'Farklı Parça Çeşidi',
      'En Çok Harcanan Malzemeler'
    ];
    s4Aoa.push(turbineHeaders.map(h => ({ v: h, s: stHeader })));

    sortedTurbines.forEach((t, idx) => {
      const matFreq: Record<string, number> = {};
      t.items.forEach(it => {
        const k = it.description || it.sapNo || 'Parça';
        matFreq[k] = (matFreq[k] || 0) + it.used;
      });
      const topMats = Object.entries(matFreq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} (${v})`).join(', ');

      s4Aoa.push([
        { v: idx + 1, s: stCellCenter },
        { v: t.siteName, s: stCellLeft },
        { v: t.turbineNo, s: stCellCenter },
        createQtyCell(t.totalUsed, true),
        createMoneyCell(t.totalCostEUR, true),
        { v: t.reportCount, s: stCellCenter },
        { v: Object.keys(matFreq).length, s: stCellCenter },
        { v: topMats || '-', s: stCellLeftWrap }
      ]);
    });

    s4Aoa.push([
      { v: 'TOPLAM', s: stTotal },
      { v: '—', s: stTotal },
      { v: `${sortedTurbines.length} Türbin`, s: stTotal },
      createTotalQtyCell(totalPartsUsed),
      createTotalMoneyCell(totalCostEUR),
      { v: siteFilteredReports.length, s: stTotal },
      { v: '—', s: stTotal },
      { v: '—', s: stTotal }
    ]);

    const ws4 = XLSX.utils.aoa_to_sheet(s4Aoa);
    ws4['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }
    ];
    ws4['!cols'] = [{ wch: 10 }, { wch: 22 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws4, "⚡ Türbin Tüketim Sıralaması");

    // =========================================================================
    // 📦 SHEET 5: SAP MALZEME LİSTESİ & SANTRAL DAĞILIMI
    // =========================================================================
    const s5Aoa: any[][] = [];
    s5Aoa.push([{ v: `SAP MALZEME BAZINDA TÜKETİM VE SANTRAL DAĞILIMI (${periodText})`, s: stTitle }]);
    s5Aoa.push([{ v: `Toplam ${sortedMaterials.length} Malzeme Kalemi | En Çok Tüketilen Parçadan En Aza Sıralı`, s: stSubTitle }]);
    s5Aoa.push([]);

    const matHeaders = [
      'Sıra', 'SAP Kodu', 'Malzeme Tanımı', 'Türü', 'Toplam Sarfiyat (Adet)',
      'Birim Fiyat (€)', 'Toplam Maliyet (€)', 'Kullanılan Santraller ve Kullanım Adetleri'
    ];
    s5Aoa.push(matHeaders.map(h => ({ v: h, s: stHeader })));

    sortedMaterials.forEach((m, idx) => {
      const siteSummary = Object.entries(m.sites).map(([s, c]) => `${s} (${c})`).join(', ');
      s5Aoa.push([
        { v: idx + 1, s: stCellCenter },
        { v: m.sapNo || '-', s: stCellCenter },
        { v: m.description, s: stCellLeftWrap },
        { v: m.type, s: stCellCenter },
        createQtyCell(m.totalUsed, true),
        createUnitPriceCell(m.unitPrice),
        createMoneyCell(m.totalCost, true),
        { v: siteSummary, s: stCellLeftWrap }
      ]);
    });

    s5Aoa.push([
      { v: 'TOPLAM', s: stTotal },
      { v: '—', s: stTotal },
      { v: `${sortedMaterials.length} Malzeme Kalemi`, s: stTotal },
      { v: '—', s: stTotal },
      createTotalQtyCell(totalPartsUsed),
      { v: '—', s: stTotal },
      createTotalMoneyCell(totalCostEUR),
      { v: '—', s: stTotal }
    ]);

    const ws5 = XLSX.utils.aoa_to_sheet(s5Aoa);
    ws5['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } }
    ];
    ws5['!cols'] = [{ wch: 8 }, { wch: 16 }, { wch: 50 }, { wch: 10 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws5, "📦 SAP Malzeme Listesi");

    // =========================================================================
    // 📋 SHEET 6: DETAYLI SERVİS RAPORLARI VE MALZEME HAREKETLERİ
    // =========================================================================
    const s6Aoa: any[][] = [];
    s6Aoa.push([{ v: `SERVİS RAPORLARI MALZEME HAREKETLERİ DÖKÜMÜ (${periodText})`, s: stTitle }]);
    s6Aoa.push([{ v: `Seçili Döneme Ait Tüm Servis Raporu ve MÇF Satır Kayıtları`, s: stSubTitle }]);
    s6Aoa.push([]);

    const rawHeaders = [
      'Tarih', 'Rapor No', 'MÇF No', 'Santral', 'Türbin No', 'SAP Kodu',
      'Malzeme Tanımı', 'Türü', 'Harcanan Miktar', 'Birim Fiyat (€)', 'Toplam Tutar (€)'
    ];
    s6Aoa.push(rawHeaders.map(h => ({ v: h, s: stHeader })));

    sortedSites.forEach(s => {
      Object.values(s.turbines).forEach(t => {
        t.items.forEach(item => {
          s6Aoa.push([
            { v: item.date ? new Date(item.date).toLocaleDateString('tr-TR') : '-', s: stCellCenter },
            { v: item.reportNo, s: stCellCenter },
            { v: item.matFormNo, s: stCellCenter },
            { v: s.siteName, s: stCellLeft },
            { v: t.turbineNo, s: stCellCenter },
            { v: item.sapNo || '-', s: stCellCenter },
            { v: item.description, s: stCellLeftWrap },
            { v: item.type, s: stCellCenter },
            createQtyCell(item.used, true),
            createUnitPriceCell(item.unitPrice),
            createMoneyCell(item.lineCost, true)
          ]);
        });
      });
    });

    const ws6 = XLSX.utils.aoa_to_sheet(s6Aoa);
    ws6['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 10 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 10 } }
    ];
    ws6['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 22 }, { wch: 12 }, { wch: 16 }, { wch: 50 }, { wch: 10 }, { wch: 16 }, { wch: 18 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws6, "📋 Detaylı Raporlar");

    // =========================================================================
    // 🧩 SHEET 7: ALT SİSTEM BAZLI MALZEME DAĞILIMI
    // =========================================================================
    const s7Aoa: any[][] = [];
    s7Aoa.push([{ v: `TÜRBİN ALT SİSTEM & BİLEŞEN BAZINDA TÜKETİM DAĞILIMI (${periodText})`, s: stTitle }]);
    s7Aoa.push([{ v: `8 Ana Alt Sisteme Göre Harcama Dağılımı ve Maliyet Ağırlıkları`, s: stSubTitle }]);
    s7Aoa.push([]);

    const subHeaders = [
      'Sıra', 'Alt Sistem Adı', 'Toplam Sarfiyat (Adet)', 'Toplam Maliyet (€)',
      'Tüketim Payı (%)', 'En Çok Harcanan Parçalar', 'Kullanılan Santraller'
    ];
    s7Aoa.push(subHeaders.map(h => ({ v: h, s: stHeader })));

    sortedSubsystems.forEach((sub, idx) => {
      const sharePct = totalPartsUsed > 0 ? ((sub.totalUsed / totalPartsUsed) * 100).toFixed(1) : '0';
      const topSubMats = Object.values(sub.materials).sort((a, b) => b.used - a.used).slice(0, 3).map(m => `${m.description} (${m.used})`).join(', ');
      const siteSummary = Object.entries(sub.sites).map(([s, c]) => `${s} (${c})`).join(', ');

      s7Aoa.push([
        { v: idx + 1, s: stCellCenter },
        { v: sub.name, s: stCellLeft },
        createQtyCell(sub.totalUsed, true),
        createMoneyCell(sub.totalCostEUR, true),
        { v: `%${sharePct}`, s: stCellCenter },
        { v: topSubMats || '-', s: stCellLeftWrap },
        { v: siteSummary || '-', s: stCellLeftWrap }
      ]);
    });

    s7Aoa.push([
      { v: 'TOPLAM', s: stTotal },
      { v: `${sortedSubsystems.length} Alt Sistem`, s: stTotal },
      createTotalQtyCell(totalPartsUsed),
      createTotalMoneyCell(totalCostEUR),
      { v: '%100.0', s: stTotal },
      { v: '—', s: stTotal },
      { v: '—', s: stTotal }
    ]);

    const ws7 = XLSX.utils.aoa_to_sheet(s7Aoa);
    ws7['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } }
    ];
    ws7['!cols'] = [{ wch: 8 }, { wch: 32 }, { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 45 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, ws7, "🧩 Alt Sistem Dağılımı");

    // =========================================================================
    // 🚨 SHEET 8: KRONİK VE TEKRARLAYAN PARÇA DEĞİŞİMLERİ
    // =========================================================================
    const s8Aoa: any[][] = [];
    s8Aoa.push([{ v: `KRONİK & TEKRARLAYAN PARÇA DEĞİŞİM ALARMLARI (${periodText})`, s: stTitle }]);
    s8Aoa.push([{ v: `Aynı Türbinde 2 veya Daha Fazla Kez Değişen Kritik Parçalar (Kök Neden İnceleme)`, s: stSubTitle }]);
    s8Aoa.push([]);

    const repeatHeaders = [
      'Sıra', 'Santral Adı', 'Türbin No', 'SAP Kodu', 'Malzeme Tanımı',
      'Toplam Değişim (Adet)', 'Farklı Servis Rapor Sayısı', 'Toplam Tutar (€)', 'Rapor Kayıtları (Tarih & Rapor No)'
    ];
    s8Aoa.push(repeatHeaders.map(h => ({ v: h, s: stHeader })));

    let totalRepeatCost = 0;
    let totalRepeatQty = 0;

    repeatFailures.forEach((rf, idx) => {
      totalRepeatCost += rf.totalCostEUR;
      totalRepeatQty += rf.changeCount;
      const repDetails = rf.reports.map(r => `${r.date ? new Date(r.date).toLocaleDateString('tr-TR') : ''} (${r.reportNo})`).join(' | ');

      s8Aoa.push([
        { v: idx + 1, s: stCellCenter },
        { v: rf.siteName, s: stCellLeft },
        { v: rf.turbineNo, s: stCellCenter },
        { v: rf.sapNo || '-', s: stCellCenter },
        { v: rf.description, s: stCellLeftWrap },
        createQtyCell(rf.changeCount, true),
        { v: rf.distinctReportsCount, s: stCellCenter },
        createMoneyCell(rf.totalCostEUR, true),
        { v: repDetails, s: stCellLeftWrap }
      ]);
    });

    s8Aoa.push([
      { v: 'TOPLAM', s: stTotal },
      { v: '—', s: stTotal },
      { v: `${repeatFailures.length} Tekrarlayan Olay`, s: stTotal },
      { v: '—', s: stTotal },
      { v: '—', s: stTotal },
      createTotalQtyCell(totalRepeatQty),
      { v: '—', s: stTotal },
      createTotalMoneyCell(totalRepeatCost),
      { v: '—', s: stTotal }
    ]);

    const ws8 = XLSX.utils.aoa_to_sheet(s8Aoa);
    ws8['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }
    ];
    ws8['!cols'] = [{ wch: 8 }, { wch: 22 }, { wch: 14 }, { wch: 16 }, { wch: 45 }, { wch: 22 }, { wch: 24 }, { wch: 20 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, ws8, "🚨 Kronik Parçalar");

    // =========================================================================
    // 🛠️ SHEET 9: BAKIM TÜRÜ MALZEME ANALİZİ
    // =========================================================================
    const s9Aoa: any[][] = [];
    s9Aoa.push([{ v: `BAKIM TÜRÜNE GÖRE MALZEME TÜKETİM & MALİYET ANALİZİ (${periodText})`, s: stTitle }]);
    s9Aoa.push([{ v: `Planlı/Periyodik Bakım vs. Acil Arıza Duruşları Karşılaştırması`, s: stSubTitle }]);
    s9Aoa.push([]);

    const mtHeaders = [
      'Bakım Türü', 'Toplam Sarfiyat (Adet)', 'Toplam Maliyet (€)',
      'Maliyet Payı (%)', 'En Çok Tüketilen Malzemeler', 'Kullanılan Santraller'
    ];
    s9Aoa.push(mtHeaders.map(h => ({ v: h, s: stHeader })));

    sortedMaintTypes.forEach(mt => {
      const costPct = totalCostEUR > 0 ? ((mt.totalCostEUR / totalCostEUR) * 100).toFixed(1) : '0';
      const topMtMats = Object.values(mt.materials).sort((a, b) => b.used - a.used).slice(0, 3).map(m => `${m.description} (${m.used})`).join(', ');
      const siteSummary = Object.entries(mt.sites).map(([s, c]) => `${s} (${c})`).join(', ');

      s9Aoa.push([
        { v: mt.name, s: stCellLeft },
        createQtyCell(mt.totalUsed, true),
        createMoneyCell(mt.totalCostEUR, true),
        { v: `%${costPct}`, s: stCellCenter },
        { v: topMtMats || '-', s: stCellLeftWrap },
        { v: siteSummary || '-', s: stCellLeftWrap }
      ]);
    });

    s9Aoa.push([
      { v: 'GENEL TOPLAM', s: stTotal },
      createTotalQtyCell(totalPartsUsed),
      createTotalMoneyCell(totalCostEUR),
      { v: '%100.0', s: stTotal },
      { v: '—', s: stTotal },
      { v: '—', s: stTotal }
    ]);

    const ws9 = XLSX.utils.aoa_to_sheet(s9Aoa);
    ws9['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } }
    ];
    ws9['!cols'] = [{ wch: 35 }, { wch: 24 }, { wch: 24 }, { wch: 18 }, { wch: 45 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, ws9, "🛠️ Bakım Türü Analizi");

    // File Write
    const dateStamp = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `DH_Servis_Yonetici_Malzeme_Tuketim_Raporu_${dateStamp}.xlsx`);
  };

  return `
    <div class="fade-in-up content-area" style="max-width: 1450px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">
      
      <style>
        .mat-period-btn {
          padding: 6px 12px;
          border-radius: 8px;
          background: transparent;
          border: 1px solid transparent;
          color: #94a3b8;
          font-family: 'Rajdhani', sans-serif;
          font-weight: 800;
          font-size: 0.78rem;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .mat-period-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
        }
        .mat-period-btn.active {
          background: rgba(0, 243, 255, 0.15) !important;
          border-color: #00f3ff !important;
          color: #00f3ff !important;
          box-shadow: 0 0 10px rgba(0, 243, 255, 0.25);
        }
        .mat-sort-btn {
          font-size: 0.75rem;
          padding: 5px 10px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .mat-sort-btn:hover {
          color: #fff;
          border-color: rgba(255, 255, 255, 0.2);
        }
        .mat-sort-btn.active {
          background: rgba(0, 243, 255, 0.12) !important;
          border-color: #00f3ff !important;
          color: #00f3ff !important;
        }
      </style>

      <!-- 🌟 ÜST BAŞLIK VE MODERN FİLTRE KONTROL PANELİ -->
      <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(10, 15, 29, 0.9) 100%); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem; box-shadow: 0 10px 30px rgba(0,0,0,0.3); backdrop-filter: blur(12px);">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(0, 243, 255, 0.12); border: 1px solid rgba(0, 243, 255, 0.3); display: flex; align-items: center; justify-content: center; color: #00f3ff; font-size: 1.2rem; box-shadow: 0 0 12px rgba(0, 243, 255, 0.2);">
              <i class="fa-solid fa-chart-pie"></i>
            </div>
            <div>
              <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 1.7rem; font-weight: 800; color: #fff; margin: 0; letter-spacing: 0.8px; display: flex; align-items: center; gap: 8px;">
                MALZEME TÜKETİM ANALİZİ
              </h2>
              <span style="font-size: 0.8rem; color: #94a3b8;">
                Santral türbin sayılarına göre normalize edilmiş adil tüketim yoğunluğu ve birim maliyet analiz portalı
              </span>
            </div>
          </div>
        </div>

        <!-- Filtre Barı & Aksiyon Butonları -->
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          
          <!-- Santral Seçici -->
          <div style="position: relative;">
            <select style="height: 38px; padding: 0 14px 0 34px; font-size: 0.82rem; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); border-radius: 10px; color: #fff; cursor: pointer; outline: none; font-family: 'Rajdhani', sans-serif; font-weight: 700;" onchange="window.setMaterialAnalyticsSite(this.value)">
              <option value="all" ${currentSite === 'all' ? 'selected' : ''}>🏛️ Tüm Santraller</option>
              ${officialSites.map(s => `<option value="${s.name}" ${currentSite === s.name ? 'selected' : ''}>🏛️ ${s.name} (${s.turbineCount} Türbin)</option>`).join('')}
            </select>
            <i class="fa-solid fa-solar-panel" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #00f3ff; font-size: 0.85rem; pointer-events: none;"></i>
          </div>

          <!-- Dönem Filtresi Kapsülü -->
          <div style="display: flex; align-items: center; background: rgba(0,0,0,0.5); padding: 4px 6px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); gap: 3px;">
            <button class="mat-period-btn ${currentPeriod === 'this-month' ? 'active' : ''}" onclick="window.setMaterialAnalyticsPeriod('this-month')">BU AY</button>
            <button class="mat-period-btn ${currentPeriod === 'last-month' ? 'active' : ''}" onclick="window.setMaterialAnalyticsPeriod('last-month')">ÖNCEKİ AY</button>
            <button class="mat-period-btn ${currentPeriod === 'this-year' ? 'active' : ''}" onclick="window.setMaterialAnalyticsPeriod('this-year')">BU YIL</button>
            <button class="mat-period-btn ${currentPeriod === 'last-year' ? 'active' : ''}" onclick="window.setMaterialAnalyticsPeriod('last-year')">GEÇEN YIL</button>
            <button class="mat-period-btn ${currentPeriod === 'all' ? 'active' : ''}" onclick="window.setMaterialAnalyticsPeriod('all')">TÜMÜ</button>
            
            <div style="width: 1px; height: 18px; background: rgba(255,255,255,0.15); margin: 0 4px;"></div>
            
            <input type="date" id="mat-analytics-start" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; width: 110px; outline: none;" value="${localStorage.getItem('material_analytics_start') || ''}">
            <span style="color: #64748b; font-size: 0.75rem; font-weight: 700;">-</span>
            <input type="date" id="mat-analytics-end" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; width: 110px; outline: none;" value="${localStorage.getItem('material_analytics_end') || ''}">
            <button class="mat-period-btn ${currentPeriod === 'custom' ? 'active' : ''}" onclick="window.setCustomMaterialAnalyticsPeriod()" style="padding: 5px 8px;" title="Tarih aralığını uygula">
              <i class="fa-solid fa-filter" style="font-size: 0.75rem;"></i>
            </button>
          </div>

          <!-- Excel İndir Butonu -->
          <button onclick="window.exportMaterialAnalyticsExcel()" style="height: 38px; padding: 0 14px; font-size: 0.8rem; font-family: 'Rajdhani', sans-serif; font-weight: 800; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%); border: 1px solid #10b981; color: #34d399; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all 0.2s; box-shadow: 0 0 10px rgba(16, 185, 129, 0.15);" onmouseover="this.style.boxShadow='0 0 15px rgba(16, 185, 129, 0.35)'; this.style.transform='translateY(-1px)';" onmouseout="this.style.boxShadow='0 0 10px rgba(16, 185, 129, 0.15)'; this.style.transform='none';">
            <i class="fa-solid fa-file-excel" style="font-size: 1rem;"></i> EXCEL RAPORU
          </button>

          ${canViewPrices ? `
            <!-- SAP Fiyat Listesi Butonu -->
            <button onclick="window.navigate('material-pricing')" style="height: 38px; padding: 0 14px; font-size: 0.8rem; font-family: 'Rajdhani', sans-serif; font-weight: 800; background: linear-gradient(135deg, rgba(0, 243, 255, 0.15) 0%, rgba(2, 132, 199, 0.25) 100%); border: 1px solid #00f3ff; color: #00f3ff; border-radius: 10px; cursor: pointer; display: flex; align-items: center; gap: 7px; transition: all 0.2s; box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);" onmouseover="this.style.boxShadow='0 0 18px rgba(0, 243, 255, 0.4)'; this.style.transform='translateY(-1px)';" onmouseout="this.style.boxShadow='0 0 10px rgba(0, 243, 255, 0.2)'; this.style.transform='none';">
              <i class="fa-solid fa-tags" style="font-size: 1rem;"></i> SAP FİYAT LİSTESİ
            </button>
          ` : ''}
        </div>
      </div>

      <!-- 💰 4 ADET MODERN KPI METRİK KARTI -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem;">
        
        <!-- 1. Toplam Harcanan Malzeme -->
        <div style="background: linear-gradient(135deg, rgba(0, 243, 255, 0.05) 0%, rgba(15, 23, 42, 0.75) 100%); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 16px; padding: 1.35rem; display: flex; align-items: center; gap: 1.1rem; box-shadow: 0 8px 24px rgba(0,0,0,0.25); position: relative; overflow: hidden;">
          <div style="position: absolute; right: -10px; top: -10px; width: 60px; height: 60px; background: rgba(0,243,255,0.08); border-radius: 50%; filter: blur(15px);"></div>
          <div style="width: 52px; height: 52px; border-radius: 12px; background: rgba(0, 243, 255, 0.12); border: 1px solid rgba(0, 243, 255, 0.35); display: flex; align-items: center; justify-content: center; color: #00f3ff; font-size: 1.4rem; box-shadow: 0 0 15px rgba(0,243,255,0.2); flex-shrink: 0;">
            <i class="fa-solid fa-boxes-stacked"></i>
          </div>
          <div style="min-width: 0;">
            <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;">Toplam Harcanan Malzeme</span>
            <div style="font-family: monospace; font-size: 1.7rem; font-weight: 900; color: #fff; margin-top: 2px;">
              ${totalPartsUsed.toLocaleString('tr-TR')} <span style="font-size: 0.85rem; color: #00f3ff; font-weight: 700;">Adet</span>
            </div>
            <div style="font-size: 0.68rem; color: #34d399; font-weight: 600; margin-top: 2px;">
              <i class="fa-solid fa-circle-check" style="font-size: 0.65rem;"></i> Türbinlere takılan net sarfiyat
            </div>
          </div>
        </div>

        <!-- 2. En Yüksek Yoğunluklu Santral -->
        <div style="background: linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(15, 23, 42, 0.75) 100%); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 16px; padding: 1.35rem; display: flex; align-items: center; gap: 1.1rem; box-shadow: 0 8px 24px rgba(0,0,0,0.25); position: relative; overflow: hidden;">
          <div style="position: absolute; right: -10px; top: -10px; width: 60px; height: 60px; background: rgba(245,158,11,0.08); border-radius: 50%; filter: blur(15px);"></div>
          <div style="width: 52px; height: 52px; border-radius: 12px; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); display: flex; align-items: center; justify-content: center; color: #fbbf24; font-size: 1.4rem; box-shadow: 0 0 15px rgba(245,158,11,0.2); flex-shrink: 0;">
            <i class="fa-solid fa-gauge-high"></i>
          </div>
          <div style="min-width: 0;">
            <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;">En Yüksek Tüketim Yoğunluğu</span>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.3rem; font-weight: 800; color: #fff; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${topSiteByDensity?.siteName || '-'}">
              ${topSiteByDensity ? `${topSiteByDensity.siteName}` : '-'}
            </div>
            <div style="font-size: 0.72rem; color: #fbbf24; font-weight: 700; font-family: monospace; margin-top: 2px;">
              ${topSiteByDensity ? `⚡ ${topSiteByDensity.avgUsedPerTurbine} Adet / Türbin (${topSiteByDensity.turbineCount}T • ${topSiteByDensity.totalUsed} Adet)` : '-'}
            </div>
          </div>
        </div>

        <!-- 3. Türbin Başına Genel Ortalama Tüketim -->
        <div style="background: linear-gradient(135deg, rgba(56, 189, 248, 0.05) 0%, rgba(15, 23, 42, 0.75) 100%); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 16px; padding: 1.35rem; display: flex; align-items: center; gap: 1.1rem; box-shadow: 0 8px 24px rgba(0,0,0,0.25); position: relative; overflow: hidden;">
          <div style="position: absolute; right: -10px; top: -10px; width: 60px; height: 60px; background: rgba(56,189,248,0.08); border-radius: 50%; filter: blur(15px);"></div>
          <div style="width: 52px; height: 52px; border-radius: 12px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.35); display: flex; align-items: center; justify-content: center; color: #38bdf8; font-size: 1.4rem; box-shadow: 0 0 15px rgba(56,189,248,0.2); flex-shrink: 0;">
            <i class="fa-solid fa-wind"></i>
          </div>
          <div style="min-width: 0;">
            <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;">Türbin Başına Ortalama</span>
            <div style="font-family: monospace; font-size: 1.7rem; font-weight: 900; color: #38bdf8; margin-top: 2px;">
              ${overallAvgPerTurbine} <span style="font-size: 0.85rem; color: #94a3b8; font-weight: 600;">Adet / Türbin</span>
            </div>
            <div style="font-size: 0.68rem; color: #94a3b8;">Tüm sahaların normalize ortalaması</div>
          </div>
        </div>

        <!-- 4. Kart: Maliyet veya Farklı SKU -->
        ${canViewPrices ? `
          <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(15, 23, 42, 0.8) 100%); border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 16px; padding: 1.35rem; display: flex; align-items: center; gap: 1.1rem; box-shadow: 0 8px 24px rgba(16,185,129,0.1); position: relative; overflow: hidden;">
            <div style="position: absolute; right: -10px; top: -10px; width: 60px; height: 60px; background: rgba(16,185,129,0.12); border-radius: 50%; filter: blur(15px);"></div>
            <div style="width: 52px; height: 52px; border-radius: 12px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); display: flex; align-items: center; justify-content: center; color: #34d399; font-size: 1.4rem; box-shadow: 0 0 15px rgba(16,185,129,0.25); flex-shrink: 0;">
              <i class="fa-solid fa-coins"></i>
            </div>
            <div style="min-width: 0;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;">Toplam Malzeme Maliyeti</span>
                <span style="background: rgba(16,185,129,0.2); color: #34d399; font-size: 0.6rem; padding: 1px 5px; border-radius: 4px; font-weight: 800;">€ AKTİF</span>
              </div>
              <div style="font-family: monospace; font-size: 1.55rem; font-weight: 900; color: #10b981; margin-top: 2px;">
                ${formatCostBadge(totalCostEUR, totalCostTRY, totalCostUSD)}
              </div>
              <div style="font-size: 0.68rem; color: #94a3b8; margin-top: 2px;">
                ${priceFoundCount > 0 ? `<strong style="color: #34d399;">${priceFoundCount}</strong> işlem fiyatlandırıldı` : 'Fiyatlar girildikçe hesaplanır'}
              </div>
            </div>
          </div>
        ` : `
          <div style="background: linear-gradient(135deg, rgba(168, 85, 247, 0.05) 0%, rgba(15, 23, 42, 0.75) 100%); border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 16px; padding: 1.35rem; display: flex; align-items: center; gap: 1.1rem; box-shadow: 0 8px 24px rgba(0,0,0,0.25); position: relative; overflow: hidden;">
            <div style="position: absolute; right: -10px; top: -10px; width: 60px; height: 60px; background: rgba(168,85,247,0.08); border-radius: 50%; filter: blur(15px);"></div>
            <div style="width: 52px; height: 52px; border-radius: 12px; background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.35); display: flex; align-items: center; justify-content: center; color: #c084fc; font-size: 1.4rem; box-shadow: 0 0 15px rgba(168,85,247,0.2); flex-shrink: 0;">
              <i class="fa-solid fa-barcode"></i>
            </div>
            <div style="min-width: 0;">
              <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 700; letter-spacing: 0.6px; text-transform: uppercase;">Farklı SAP Kalemi (SKU)</span>
              <div style="font-family: monospace; font-size: 1.7rem; font-weight: 900; color: #c084fc; margin-top: 2px;">
                ${uniqueSapCount} <span style="font-size: 0.85rem; color: #94a3b8; font-weight: 600;">Kalem</span>
              </div>
              <div style="font-size: 0.68rem; color: #94a3b8;">Kullanılan farklı yedek parça çeşidi</div>
            </div>
          </div>
        `}

      </div>

      <!-- 📑 MODERN SEKME SEÇİCİLERİ VE ARAMA ÇUBUĞU -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; padding: 8px 12px;">
        
        <!-- Sekmeler -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn-filter ${activeTab === 'sites' ? 'active' : ''}" onclick="window.setMaterialAnalyticsTab('sites')" style="font-size: 0.82rem; padding: 8px 14px; font-weight: 800; border-radius: 10px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-solar-panel" style="color: #00f3ff;"></i> 1. Santral (${sortedSites.length})
          </button>
          <button class="btn-filter ${activeTab === 'turbines' ? 'active' : ''}" onclick="window.setMaterialAnalyticsTab('turbines')" style="font-size: 0.82rem; padding: 8px 14px; font-weight: 800; border-radius: 10px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-wind" style="color: #38bdf8;"></i> 2. Türbin (${sortedTurbines.length})
          </button>
          <button class="btn-filter ${activeTab === 'materials' ? 'active' : ''}" onclick="window.setMaterialAnalyticsTab('materials')" style="font-size: 0.82rem; padding: 8px 14px; font-weight: 800; border-radius: 10px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-boxes-stacked" style="color: #fbbf24;"></i> 3. SAP Malzeme (${sortedMaterials.length})
          </button>
          <button class="btn-filter ${activeTab === 'subsystems' ? 'active' : ''}" onclick="window.setMaterialAnalyticsTab('subsystems')" style="font-size: 0.82rem; padding: 8px 14px; font-weight: 800; border-radius: 10px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-cubes-stacked" style="color: #a855f7;"></i> 4. Alt Sistem (${sortedSubsystems.length})
          </button>
          <button class="btn-filter ${activeTab === 'repeat' ? 'active' : ''}" onclick="window.setMaterialAnalyticsTab('repeat')" style="font-size: 0.82rem; padding: 8px 14px; font-weight: 800; border-radius: 10px; display: flex; align-items: center; gap: 6px; position: relative;">
            <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i> 5. Kronik Alarmlar
            ${repeatFailures.length > 0 ? `
              <span style="background: #ef4444; color: #fff; font-size: 0.65rem; padding: 1px 6px; border-radius: 10px; font-weight: 900; margin-left: 2px;">
                ${repeatFailures.length}
              </span>
            ` : ''}
          </button>
          <button class="btn-filter ${activeTab === 'maint-types' ? 'active' : ''}" onclick="window.setMaterialAnalyticsTab('maint-types')" style="font-size: 0.82rem; padding: 8px 14px; font-weight: 800; border-radius: 10px; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-wrench" style="color: #10b981;"></i> 6. Bakım Türü (${sortedMaintTypes.length})
          </button>
        </div>

        <!-- Arama Kutusu -->
        <div style="position: relative; width: 300px;">
          <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #00f3ff; font-size: 0.85rem;"></i>
          <input 
            type="text" 
            class="cyber-input" 
            placeholder="Santral, türbin veya SAP ara..." 
            oninput="window.filterMaterialAnalyticsTable(this.value)"
            style="height: 38px; padding-left: 2.3rem; font-size: 0.82rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 10px; width: 100%; color: #fff;"
          >
        </div>

      </div>

      <!-- ============================================================= -->
      <!-- 🏭 SEKME 1: SANTRAL TÜKETİM & MALİYET DAĞILIMI               -->
      <!-- ============================================================= -->
      ${activeTab === 'sites' ? `
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- Sıralama Kontrolleri & Başlık -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 1rem;">
            <div>
              <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0; font-size: 1.25rem; font-weight: 800; color: #00f3ff; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-chart-column" style="color: #fbbf24;"></i> SANTRAL TÜKETİM VE MALİYET DAĞILIMI
              </h3>
              <span style="font-size: 0.75rem; color: #94a3b8;">Santral türbin sayısına göre normalize edilmiş adil harcama tablosu</span>
            </div>

            <!-- Sıralama Butonları -->
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 0.72rem; color: #64748b; font-weight: 700;">SIRALA:</span>
              <button class="mat-sort-btn ${siteSortBy === 'density' ? 'active' : ''}" onclick="window.setMaterialSiteSort('density')">
                ⚡ Türbin Başına Yoğunluk
              </button>
              <button class="mat-sort-btn ${siteSortBy === 'quantity' ? 'active' : ''}" onclick="window.setMaterialSiteSort('quantity')">
                📦 Toplam Harcanan Adet
              </button>
              ${canViewPrices ? `
                <button class="mat-sort-btn ${siteSortBy === 'costPerTurbine' ? 'active' : ''}" onclick="window.setMaterialSiteSort('costPerTurbine')">
                  💰 Türbin Başına Maliyet
                </button>
                <button class="mat-sort-btn ${siteSortBy === 'totalCost' ? 'active' : ''}" onclick="window.setMaterialSiteSort('totalCost')">
                  🏷️ Toplam Maliyet
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Sıralı Santral Kartları (Akordiyonlu) -->
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            ${sortedSites.length > 0 ? sortedSites.map((site, sIdx) => {
              const rankBadge = sIdx === 0 ? '🥇 1. Sıra' : (sIdx === 1 ? '🥈 2. Sıra' : (sIdx === 2 ? '🥉 3. Sıra' : `#${sIdx + 1}`));
              const rankStyle = sIdx === 0 
                ? 'background: linear-gradient(135deg, rgba(245,158,11,0.2), rgba(217,119,6,0.3)); color: #fbbf24; border: 1px solid rgba(245,158,11,0.5);' 
                : (sIdx === 1 
                  ? 'background: linear-gradient(135deg, rgba(148,163,184,0.2), rgba(100,116,139,0.3)); color: #e2e8f0; border: 1px solid rgba(148,163,184,0.5);' 
                  : (sIdx === 2 
                    ? 'background: linear-gradient(135deg, rgba(180,83,9,0.2), rgba(120,53,15,0.3)); color: #fed7aa; border: 1px solid rgba(180,83,9,0.5);' 
                    : 'background: rgba(255,255,255,0.05); color: #94a3b8; border: 1px solid rgba(255,255,255,0.08);'));
              
              const densityColor = site.avgUsedPerTurbine >= 8.0 ? '#ef4444' : (site.avgUsedPerTurbine >= 4.0 ? '#f59e0b' : '#34d399');
              const turbinesArray = Object.values(site.turbines).sort((a, b) => b.totalUsed - a.totalUsed);

              return `
                <div class="mat-search-row" style="background: linear-gradient(180deg, rgba(20, 28, 48, 0.7) 0%, rgba(13, 20, 36, 0.85) 100%); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; overflow: hidden; transition: all 0.2s; border-left: 4px solid ${densityColor}; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                  
                  <!-- Santral Başlık Kartı (Tıklayınca Açılır) -->
                  <div onclick="window.toggleAccordion('site-acc-${sIdx}')" style="padding: 1.15rem 1.4rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; flex-wrap: wrap; gap: 1rem;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
                    
                    <!-- Sol: Sıra, İsim ve Türbin Sayısı -->
                    <div style="display: flex; align-items: center; gap: 14px;">
                      <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(0,243,255,0.08); border: 1px solid rgba(0,243,255,0.2); display: flex; align-items: center; justify-content: center;">
                        <i class="fa-solid fa-chevron-right" id="site-acc-${sIdx}-icon" style="transition: transform 0.3s; font-size: 0.75rem; color: #00f3ff;"></i>
                      </div>
                      <span style="font-family: monospace; font-size: 0.85rem; font-weight: 800; padding: 4px 10px; border-radius: 8px; ${rankStyle}">${rankBadge}</span>
                      <div>
                        <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; font-weight: 800; color: #fff;">
                          ${site.siteName}
                        </div>
                        <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">
                          ${site.turbineCount} Türbin Kurulu • <span style="color: #38bdf8;">${turbinesArray.length} Türbinde Harcama</span> (${site.reportCount} Servis Raporu)
                        </div>
                      </div>
                    </div>

                    <!-- Sağ: Metrik Rozetleri (Yoğunluk, Toplam Adet, Maliyet) -->
                    <div style="display: flex; align-items: center; gap: 0.85rem; flex-wrap: wrap;">
                      
                      <!-- ⚡ TÜRBİN BAŞINA YOĞUNLUK ROZETİ (ANA METRİK) -->
                      <div style="text-align: right; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); padding: 5px 12px; border-radius: 10px;">
                        <span style="font-size: 0.62rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase;">Türbin Başına</span>
                        <span style="font-family: monospace; font-size: 1.05rem; font-weight: 900; color: ${densityColor};">
                          ⚡ ${site.avgUsedPerTurbine} <span style="font-size: 0.75rem; font-weight: normal; color: #64748b;">Adet</span>
                        </span>
                      </div>

                      <!-- 📦 TOPLAM ADET -->
                      <div style="text-align: right; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); padding: 5px 12px; border-radius: 10px;">
                        <span style="font-size: 0.62rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase;">Toplam Harcanan</span>
                        <span style="font-family: monospace; font-size: 1.05rem; font-weight: 900; color: #fff;">
                          ${site.totalUsed} <span style="font-size: 0.75rem; font-weight: normal; color: #64748b;">Adet</span>
                        </span>
                      </div>

                      <!-- 💰 MALİYET ROZETİ (SADECE YETKİLİLERE) -->
                      ${canViewPrices ? `
                        <div style="text-align: right; background: ${site.totalCostEUR > 0 ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(5,150,105,0.2))' : 'rgba(0,0,0,0.35)'}; border: 1px solid ${site.totalCostEUR > 0 ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.08)'}; padding: 5px 14px; border-radius: 10px; ${site.totalCostEUR > 0 ? 'box-shadow: 0 0 10px rgba(16,185,129,0.15);' : ''}">
                          <span style="font-size: 0.62rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase;">Toplam Maliyet</span>
                          <span style="font-family: monospace; font-size: 1.05rem; font-weight: 900; color: ${site.totalCostEUR > 0 ? '#34d399' : '#64748b'};">
                            ${formatCostBadge(site.totalCostEUR, site.totalCostTRY, site.totalCostUSD)}
                          </span>
                        </div>
                      ` : ''}

                    </div>
                  </div>

                  <!-- Santral Altındaki Türbinler (Akordiyon İçi) -->
                  <div id="site-acc-${sIdx}" style="display: none; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.3); padding: 1.25rem;">
                    
                    <div style="font-size: 0.85rem; font-weight: 800; color: #00f3ff; margin-bottom: 0.85rem; display: flex; align-items: center; gap: 8px;">
                      <i class="fa-solid fa-wind"></i> ${site.siteName} TÜRBİNLERİNİN MALZEME TÜKETİM DÖKÜMÜ
                    </div>

                    ${turbinesArray.length > 0 ? `
                      <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                        ${turbinesArray.map((t, tIdx) => `
                          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden;">
                            
                            <!-- Türbin Başlığı -->
                            <div onclick="window.toggleAccordion('turb-acc-${sIdx}-${tIdx}')" style="padding: 0.85rem 1.1rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,243,255,0.03)'" onmouseout="this.style.background='transparent'">
                              <div style="display: flex; align-items: center; gap: 10px;">
                                <i class="fa-solid fa-chevron-right" id="turb-acc-${sIdx}-${tIdx}-icon" style="transition: transform 0.3s; font-size: 0.75rem; color: #00f3ff;"></i>
                                <span style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.05rem; color: #fff;">${t.turbineKey}</span>
                                <span style="font-size: 0.72rem; color: #64748b;">(${t.reportCount} Servis Raporu)</span>
                              </div>

                              <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-family: monospace; font-weight: 800; font-size: 0.85rem; color: #34d399; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); padding: 3px 10px; border-radius: 6px;">
                                  ${t.totalUsed} Adet Malzeme
                                </span>
                                ${canViewPrices ? `
                                  <span style="font-family: monospace; font-weight: 800; font-size: 0.85rem; color: ${t.totalCostEUR > 0 ? '#34d399' : '#64748b'}; background: ${t.totalCostEUR > 0 ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${t.totalCostEUR > 0 ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}; padding: 3px 10px; border-radius: 6px;">
                                    ${formatCostBadge(t.totalCostEUR, t.totalCostTRY, t.totalCostUSD)}
                                  </span>
                                ` : ''}
                              </div>
                            </div>

                            <!-- Türbin İçindeki Kullanılan Malzemeler Tablosu -->
                            <div id="turb-acc-${sIdx}-${tIdx}" style="display: none; border-top: 1px solid rgba(255,255,255,0.04); background: rgba(0,0,0,0.4); padding: 6px;">
                              <table class="cyber-table" style="font-size: 0.76rem; width: 100%;">
                                <thead>
                                  <tr style="color: #94a3b8; background: rgba(255,255,255,0.02);">
                                    <th>TARİH</th>
                                    <th>RAPOR NO</th>
                                    <th>MÇF NO</th>
                                    <th>SAP KODU</th>
                                    <th>MALZEME AÇIKLAMASI</th>
                                    <th style="text-align: center;">TÜR</th>
                                    <th style="text-align: center; color: #34d399;">HARCANAN</th>
                                    ${canViewPrices ? `
                                      <th style="text-align: center;">BİRİM FİYAT</th>
                                      <th style="text-align: right; color: #34d399;">TOPLAM TUTAR</th>
                                    ` : ''}
                                  </tr>
                                </thead>
                                <tbody>
                                  ${t.items.map(item => `
                                    <tr>
                                      <td style="font-weight: 600; color: #e2e8f0;">${item.date ? new Date(item.date).toLocaleDateString('tr-TR') : '-'}</td>
                                      <td style="font-family: monospace; color: #00f3ff; font-weight: 700;">${item.reportNo}</td>
                                      <td style="font-family: monospace; color: #fbbf24; font-weight: 700;">${item.matFormNo}</td>
                                      <td style="font-family: monospace; color: #38bdf8; font-weight: 800;">${item.sapNo || '-'}</td>
                                      <td style="font-weight: 600; color: #fff;">${item.description}</td>
                                      <td style="text-align: center;"><span class="badge" style="background: rgba(255,255,255,0.06); color: #fff; padding: 2px 6px; font-size: 0.65rem;">${item.type}</span></td>
                                      <td style="text-align: center; font-family: monospace; font-weight: 800; color: #34d399; font-size: 0.9rem;">${item.used} Adet</td>
                                      ${canViewPrices ? `
                                        <td style="text-align: center; font-family: monospace; color: #94a3b8;">${item.unitPrice > 0 ? `${item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${item.currency}` : '<span style="opacity:0.3;">-</span>'}</td>
                                        <td style="text-align: right; font-family: monospace; font-weight: 800; color: #34d399;">${item.lineCost > 0 ? `${item.lineCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${item.currency}` : '<span style="opacity:0.3;">-</span>'}</td>
                                      ` : ''}
                                    </tr>
                                  `).join('')}
                                </tbody>
                              </table>
                            </div>

                          </div>
                        `).join('')}
                      </div>
                    ` : '<div style="color: #64748b; font-size: 0.8rem; padding: 0.5rem 0;">Seçili dönemde bu santralde malzeme harcama kaydı bulunamadı.</div>'}

                  </div>

                </div>
              `;
            }).join('') : '<div style="text-align: center; padding: 3rem; color: #64748b;">Seçili filtrelerde santral kaydı bulunamadı.</div>'}
          </div>

        </div>
      ` : ''}

      <!-- ============================================================= -->
      <!-- 🌬️ SEKME 2: TÜRBİN BAZLI TÜKETİM VE MALİYET (TÜM TÜRBİNLER)    -->
      <!-- ============================================================= -->
      ${activeTab === 'turbines' ? `
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 1rem;">
            <div>
              <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0; font-size: 1.25rem; font-weight: 800; color: #00f3ff; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-wind" style="color: #38bdf8;"></i> TÜRBİN BAZLI TÜKETİM VE MALİYET ANALİZİ
              </h3>
              <span style="font-size: 0.75rem; color: #94a3b8;">En çok malzeme harcayan türbinden en aza doğru sıralı liste</span>
            </div>
            <span style="font-size: 0.8rem; color: #38bdf8; font-family: monospace; font-weight: 700; background: rgba(56,189,248,0.1); padding: 4px 10px; border-radius: 6px;">${sortedTurbines.length} Türbin Kaydı</span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${sortedTurbines.length > 0 ? sortedTurbines.map((turbine, index) => `
              <div class="mat-search-row" style="background: linear-gradient(180deg, rgba(20, 28, 48, 0.6) 0%, rgba(13, 20, 36, 0.75) 100%); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; overflow: hidden; transition: border-color 0.2s;">
                
                <!-- Türbin Akordiyon Başlığı -->
                <div onclick="window.toggleAccordion('turbine-acc-${index}')" style="padding: 1rem 1.3rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,243,255,0.03)'" onmouseout="this.style.background='transparent'">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="fa-solid fa-chevron-right" id="turbine-acc-${index}-icon" style="transition: transform 0.3s; font-size: 0.8rem; color: #00f3ff;"></i>
                    <span style="font-family: monospace; font-weight: 800; color: #94a3b8; font-size: 0.85rem; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 6px;">#${index + 1}</span>
                    <span style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: #fff;">
                      ${turbine.turbineKey}
                    </span>
                    <span style="font-size: 0.72rem; color: #64748b; margin-left: 4px;">
                      (${turbine.reportCount} Servis Raporu)
                    </span>
                  </div>

                  <div style="display: flex; align-items: center; gap: 0.85rem;">
                    <!-- Adet Rozeti -->
                    <span style="background: rgba(0, 243, 255, 0.08); border: 1px solid rgba(0, 243, 255, 0.25); color: #00f3ff; padding: 4px 12px; border-radius: 8px; font-family: monospace; font-size: 0.82rem; font-weight: 800;">
                      <i class="fa-solid fa-box" style="margin-right: 4px;"></i> ${turbine.totalUsed} Adet Malzeme
                    </span>

                    <!-- Maliyet Rozeti (Sadece Yetkiliye) -->
                    ${canViewPrices ? `
                      <span style="background: ${turbine.totalCostEUR > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)'}; border: 1px solid ${turbine.totalCostEUR > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.06)'}; color: ${turbine.totalCostEUR > 0 ? '#34d399' : '#64748b'}; padding: 4px 12px; border-radius: 8px; font-family: monospace; font-size: 0.82rem; font-weight: 800;">
                        <i class="fa-solid fa-tag" style="margin-right: 4px;"></i> ${formatCostBadge(turbine.totalCostEUR, turbine.totalCostTRY, turbine.totalCostUSD)}
                      </span>
                    ` : ''}
                  </div>
                </div>

                <!-- Türbin Detay Tablosu (Akordiyon İçi) -->
                <div id="turbine-acc-${index}" style="display: none; border-top: 1px solid rgba(255,255,255,0.04); background: rgba(0,0,0,0.35); padding: 8px;">
                  <div style="overflow-x: auto;">
                    <table class="cyber-table" style="font-size: 0.76rem; width: 100%;">
                      <thead>
                        <tr style="background: rgba(255,255,255,0.02); color: #94a3b8;">
                          <th>TARİH</th>
                          <th>RAPOR NO</th>
                          <th>MÇF NO</th>
                          <th>SAP KODU</th>
                          <th>MALZEME AÇIKLAMASI</th>
                          <th style="text-align: center;">TÜR</th>
                          <th style="text-align: center; color: #34d399;">HARCANAN (ADET)</th>
                          ${canViewPrices ? `
                            <th style="text-align: center;">BİRİM FİYAT</th>
                            <th style="text-align: right; color: #34d399;">TOPLAM TUTAR</th>
                          ` : ''}
                        </tr>
                      </thead>
                      <tbody>
                        ${turbine.items.map(item => `
                          <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                            <td style="font-weight: 600; color: #e2e8f0;">${item.date ? new Date(item.date).toLocaleDateString('tr-TR') : '-'}</td>
                            <td style="font-family: monospace; color: #00f3ff; font-weight: 700;">${item.reportNo}</td>
                            <td style="font-family: monospace; color: #fbbf24; font-weight: 700;">${item.matFormNo}</td>
                            <td style="font-family: monospace; color: #38bdf8; font-weight: 800;">${item.sapNo || '-'}</td>
                            <td style="font-weight: 600; color: #fff;">${item.description}</td>
                            <td style="text-align: center;"><span class="badge" style="background: rgba(255,255,255,0.06); color: #fff; padding: 2px 6px; font-size: 0.65rem;">${item.type}</span></td>
                            <td style="text-align: center; font-family: monospace; font-weight: 800; color: #34d399; font-size: 0.95rem;">${item.used} Adet</td>
                            ${canViewPrices ? `
                              <td style="text-align: center; font-family: monospace; color: #94a3b8;">${item.unitPrice > 0 ? `${item.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${item.currency}` : '<span style="opacity:0.3;">-</span>'}</td>
                              <td style="text-align: right; font-family: monospace; font-weight: 800; color: #34d399;">${item.lineCost > 0 ? `${item.lineCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${item.currency}` : '<span style="opacity:0.3;">-</span>'}</td>
                            ` : ''}
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            `).join('') : '<div style="text-align: center; padding: 3rem; color: #64748b;">Seçili filtrelerde türbin malzeme kaydı bulunamadı.</div>'}
          </div>
        </div>
      ` : ''}

      <!-- ============================================================= -->
      <!-- 📦 SEKME 3: SAP MALZEME BAZLI TÜKETİM LİSTESİ                  -->
      <!-- ============================================================= -->
      ${activeTab === 'materials' ? `
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0; font-size: 1.25rem; font-weight: 800; color: #00f3ff; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-boxes-stacked" style="color: #fbbf24;"></i> SAP MALZEME BAZINDA TÜKETİM VE MALİYET DÖKÜMÜ
              </h3>
              <span style="font-size: 0.75rem; color: #94a3b8;">Filtrelenen dönemde tüketilen tüm SAP malzemeleri ve genel maliyet toplamları</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span style="font-size: 0.8rem; color: #38bdf8; font-family: monospace; font-weight: 700; background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.25); padding: 5px 10px; border-radius: 8px;">
                📦 ${totalMaterialsUsedCount.toLocaleString('tr-TR')} Adet Sarfiyat
              </span>
              <span style="font-size: 0.8rem; color: #fbbf24; font-family: monospace; font-weight: 700; background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); padding: 5px 10px; border-radius: 8px;">
                ${sortedMaterials.length} Malzeme Kalemi
              </span>
              ${canViewPrices ? `
                <div style="background: linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(5,150,105,0.25) 100%); border: 1px solid rgba(16,185,129,0.4); padding: 5px 14px; border-radius: 8px; display: flex; align-items: center; gap: 8px; box-shadow: 0 0 12px rgba(16,185,129,0.2);">
                  <i class="fa-solid fa-coins" style="color: #34d399; font-size: 1rem;"></i>
                  <div>
                    <span style="font-size: 0.65rem; color: #94a3b8; display: block; font-weight: 700; text-transform: uppercase;">Genel Fiyat Toplamı</span>
                    <span style="font-family: monospace; font-weight: 900; color: #10b981; font-size: 1.05rem;">
                      ${formatCostBadge(totalMaterialsCostEUR, totalMaterialsCostTRY, totalMaterialsCostUSD)}
                    </span>
                  </div>
                </div>
              ` : ''}
            </div>
          </div>

          <div style="overflow-x: auto;">
            <table class="cyber-table" style="width: 100%;">
              <thead>
                <tr>
                  <th>SAP KODU</th>
                  <th>MALZEME TANIMI</th>
                  <th style="text-align: center;">TÜR</th>
                  <th style="text-align: center;">TOPLAM SARFİYAT</th>
                  ${canViewPrices ? `
                    <th style="text-align: center;">BİRİM FİYAT</th>
                    <th style="text-align: center;">TOPLAM MALİYET</th>
                  ` : ''}
                  <th>KULLANILAN SANTRALLER</th>
                </tr>
              </thead>
              <tbody>
                ${sortedMaterials.length > 0 ? sortedMaterials.map(m => {
                  const siteList = Object.entries(m.sites).map(([site, count]) => `<span style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px; font-size: 0.72rem; margin-right: 4px;">${site} (${count})</span>`).join('');
                  return `
                    <tr class="mat-search-row">
                      <td style="font-family: monospace; font-weight: 800; color: #00f3ff; font-size: 0.9rem;">${m.sapNo || '-'}</td>
                      <td style="font-weight: 700; color: #fff;">${m.description}</td>
                      <td style="text-align: center;"><span class="badge" style="background: rgba(255,255,255,0.06); color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem;">${m.type}</span></td>
                      <td style="text-align: center; font-family: monospace; font-weight: 900; color: #34d399; font-size: 0.95rem;">
                        ${m.totalUsed} Adet
                      </td>
                      ${canViewPrices ? `
                        <td style="text-align: center; font-family: monospace; color: #94a3b8; font-weight: 700;">
                          ${m.unitPrice > 0 ? `${m.unitPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${m.currency}` : '<span style="opacity:0.3;" title="Fiyat Bekleniyor">-</span>'}
                        </td>
                        <td style="text-align: center; font-family: monospace; font-weight: 900; color: ${m.totalCost > 0 ? '#34d399' : '#64748b'};">
                          ${m.totalCost > 0 ? `${m.totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${m.currency}` : '<span style="opacity:0.3;">-</span>'}
                        </td>
                      ` : ''}
                      <td style="font-size: 0.8rem; color: #94a3b8;">${siteList}</td>
                    </tr>
                  `;
                }).join('') : '<tr><td colspan="7" style="text-align:center; padding: 2.5rem; color: #64748b;">Seçili dönemde kullanılan malzeme kaydı bulunamadı.</td></tr>'}
              </tbody>
              ${sortedMaterials.length > 0 ? `
                <tfoot style="border-top: 2px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.45); font-weight: 800;">
                  <tr>
                    <td colspan="3" style="padding: 1rem; color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; letter-spacing: 0.5px;">GENEL TOPLAM (${sortedMaterials.length} Kalem)</td>
                    <td style="text-align: center; font-family: monospace; color: #34d399; font-size: 1.05rem; padding: 1rem;">
                      ${totalMaterialsUsedCount.toLocaleString('tr-TR')} Adet
                    </td>
                    ${canViewPrices ? `
                      <td style="text-align: center; color: #94a3b8; font-size: 0.8rem;">—</td>
                      <td style="text-align: center; font-family: monospace; font-size: 1.1rem; color: #10b981; padding: 1rem;">
                        ${formatCostBadge(totalMaterialsCostEUR, totalMaterialsCostTRY, totalMaterialsCostUSD)}
                      </td>
                    ` : ''}
                    <td style="font-size: 0.75rem; color: #64748b; padding: 1rem;">${pricedMaterialsCount} / ${sortedMaterials.length} Kalem Fiyatlandırıldı</td>
                  </tr>
                </tfoot>
              ` : ''}
            </table>
          </div>
        </div>
      ` : ''}

      <!-- ============================================================= -->
      <!-- 🧩 SEKME 4: ALT SİSTEM & BİLEŞEN BAZLI TÜKETİM ANALİZİ        -->
      <!-- ============================================================= -->
      ${activeTab === 'subsystems' ? `
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0; font-size: 1.25rem; font-weight: 800; color: #00f3ff; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-cubes-stacked" style="color: #a855f7;"></i> ALT SİSTEM & BİLEŞEN BAZINDA TÜKETİM VE MALİYET ANALİZİ
              </h3>
              <span style="font-size: 0.75rem; color: #94a3b8;">Türbin ana alt sistemlerine (Pitch, Dişli Kutusu, Jeneratör vb.) göre tüketim ve maliyet ağırlıkları</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 0.8rem; color: #a855f7; font-family: monospace; font-weight: 700; background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.25); padding: 5px 10px; border-radius: 8px;">
                8 Ana Alt Sistem
              </span>
            </div>
          </div>

          <!-- Alt Sistem Kartları -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
            ${sortedSubsystems.map((sub, sIdx) => {
              const sharePct = totalPartsUsed > 0 ? ((sub.totalUsed / totalPartsUsed) * 100).toFixed(1) : '0';
              const topMats = Object.values(sub.materials).sort((a, b) => b.used - a.used).slice(0, 3);
              const sitePills = Object.entries(sub.sites).map(([s, c]) => `<span style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; color: #94a3b8;">${s} (${c})</span>`).join(' ');

              return `
                <div class="mat-search-row" style="background: linear-gradient(180deg, rgba(20, 28, 48, 0.7) 0%, rgba(13, 20, 36, 0.85) 100%); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; border-left: 4px solid ${sub.color}; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                  
                  <!-- Başlık & İkon -->
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                    <div style="display: flex; align-items: center; gap: 10px;">
                      <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; color: ${sub.color}; font-size: 1.1rem;">
                        <i class="fa-solid ${sub.icon}"></i>
                      </div>
                      <div>
                        <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 800; color: #fff;">
                          ${sub.name}
                        </div>
                        <span style="font-size: 0.7rem; color: #94a3b8;">Toplam Tüketim Payı: <strong style="color: ${sub.color};">%${sharePct}</strong></span>
                      </div>
                    </div>

                    <div style="text-align: right;">
                      <span style="font-family: monospace; font-size: 1.1rem; font-weight: 900; color: #fff;">
                        ${sub.totalUsed.toLocaleString('tr-TR')} <span style="font-size: 0.75rem; color: #64748b;">Adet</span>
                      </span>
                      ${canViewPrices && sub.totalCostEUR > 0 ? `
                        <div style="font-family: monospace; font-size: 0.85rem; font-weight: 800; color: #34d399; margin-top: 2px;">
                          ${formatCostBadge(sub.totalCostEUR, 0, 0)}
                        </div>
                      ` : ''}
                    </div>
                  </div>

                  <!-- İlerleme Çubuğu -->
                  <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
                    <div style="width: ${Math.min(100, Math.max(2, parseFloat(sharePct)))}%; height: 100%; background: ${sub.color}; border-radius: 3px;"></div>
                  </div>

                  <!-- En Çok Değişen Parçalar -->
                  <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 8px 10px;">
                    <span style="font-size: 0.65rem; color: #64748b; text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 4px;">En Çok Tüketilen Parçalar:</span>
                    ${topMats.length > 0 ? topMats.map(m => `
                      <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #e2e8f0; margin-bottom: 2px;">
                        <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;" title="${m.description}">• ${m.description}</span>
                        <strong style="color: #00f3ff; font-family: monospace;">${m.used} Adet</strong>
                      </div>
                    `).join('') : '<span style="font-size: 0.7rem; color: #64748b;">Kayıt yok</span>'}
                  </div>

                  <!-- Santraller Dağılımı -->
                  ${sitePills ? `
                    <div style="display: flex; flex-wrap: wrap; gap: 4px; align-items: center;">
                      <span style="font-size: 0.62rem; color: #64748b; font-weight: 700;">SAHALAR:</span>
                      ${sitePills}
                    </div>
                  ` : ''}

                </div>
              `;
            })}
          </div>

        </div>
      ` : ''}

      <!-- ============================================================= -->
      <!-- 🚨 SEKME 5: KRONİK & TEKRARLAYAN PARÇA DEĞİŞİM ALARMLARI       -->
      <!-- ============================================================= -->
      ${activeTab === 'repeat' ? `
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0; font-size: 1.25rem; font-weight: 800; color: #ef4444; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-triangle-exclamation"></i> KRONİK & TEKRARLAYAN PARÇA DEĞİŞİM ALARMLARI
              </h3>
              <span style="font-size: 0.75rem; color: #94a3b8;">Aynı türbinde seçili dönem içinde 2 veya daha fazla kez değişen parçalar (Kök Neden İncelemesi)</span>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 0.8rem; color: #ef4444; font-family: monospace; font-weight: 700; background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); padding: 5px 12px; border-radius: 8px;">
                🚨 ${repeatFailures.length} Kronik Tekrar Olayı
              </span>
            </div>
          </div>

          <!-- Kronik Olay Listesi -->
          <div style="display: flex; flex-direction: column; gap: 0.85rem;">
            ${repeatFailures.length > 0 ? repeatFailures.map((rf, rIdx) => `
              <div class="mat-search-row" style="background: linear-gradient(180deg, rgba(20, 28, 48, 0.7) 0%, rgba(13, 20, 36, 0.85) 100%); border: 1px solid rgba(239,68,68,0.25); border-radius: 14px; overflow: hidden; border-left: 4px solid #ef4444; box-shadow: 0 4px 15px rgba(0,0,0,0.2);">
                
                <!-- Başlık -->
                <div onclick="window.toggleAccordion('repeat-acc-${rIdx}')" style="padding: 1.1rem 1.3rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s; flex-wrap: wrap; gap: 1rem;" onmouseover="this.style.background='rgba(239,68,68,0.03)'" onmouseout="this.style.background='transparent'">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <i class="fa-solid fa-chevron-right" id="repeat-acc-${rIdx}-icon" style="transition: transform 0.3s; font-size: 0.8rem; color: #ef4444;"></i>
                    <span style="background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35); color: #f87171; font-family: monospace; font-size: 0.8rem; font-weight: 900; padding: 3px 8px; border-radius: 6px;">
                      🚨 ${rf.changeCount} KEZ DEĞİŞTİ
                    </span>
                    <div>
                      <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: #fff;">
                        ${rf.turbineKey}
                      </div>
                      <div style="font-size: 0.75rem; color: #cbd5e1; margin-top: 2px;">
                        <strong style="color: #38bdf8;">${rf.sapNo ? `[${rf.sapNo}] ` : ''}</strong> ${rf.description}
                      </div>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 0.72rem; color: #94a3b8; font-family: monospace;">
                      ${rf.distinctReportsCount} Ayrı Servis Raporu
                    </span>
                    ${canViewPrices && rf.totalCostEUR > 0 ? `
                      <span style="font-family: monospace; font-weight: 800; color: #34d399; background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.25); padding: 4px 10px; border-radius: 6px; font-size: 0.82rem;">
                        ${formatCostBadge(rf.totalCostEUR, 0, 0)}
                      </span>
                    ` : ''}
                  </div>
                </div>

                <!-- Detay Tablosu (Raporlar) -->
                <div id="repeat-acc-${rIdx}" style="display: none; border-top: 1px solid rgba(255,255,255,0.04); background: rgba(0,0,0,0.35); padding: 8px;">
                  <table class="cyber-table" style="font-size: 0.76rem; width: 100%;">
                    <thead>
                      <tr style="background: rgba(255,255,255,0.02); color: #94a3b8;">
                        <th>TARİH</th>
                        <th>RAPOR NO</th>
                        <th>MÇF NO</th>
                        <th style="text-align: center; color: #34d399;">DEĞİŞEN ADET</th>
                        ${canViewPrices ? `<th style="text-align: right; color: #34d399;">TUTAR (€)</th>` : ''}
                      </tr>
                    </thead>
                    <tbody>
                      ${rf.reports.map(r => `
                        <tr>
                          <td style="font-weight: 600; color: #e2e8f0;">${r.date ? new Date(r.date).toLocaleDateString('tr-TR') : '-'}</td>
                          <td style="font-family: monospace; color: #00f3ff; font-weight: 700;">${r.reportNo}</td>
                          <td style="font-family: monospace; color: #fbbf24; font-weight: 700;">${r.matFormNo}</td>
                          <td style="text-align: center; font-family: monospace; font-weight: 800; color: #34d399;">${r.used} Adet</td>
                          ${canViewPrices ? `
                            <td style="text-align: right; font-family: monospace; font-weight: 800; color: #34d399;">
                              ${r.cost > 0 ? `${(Math.round(r.cost * 100) / 100).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} €` : '-'}
                            </td>
                          ` : ''}
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>

              </div>
            `).join('') : '<div style="text-align: center; padding: 3rem; color: #34d399; font-weight: 700;"><i class="fa-solid fa-circle-check" style="font-size: 1.5rem; display: block; margin-bottom: 8px;"></i> Seçili dönemde kronik / tekrarlayan parça değişimi tespit edilmedi.</div>'}
          </div>

        </div>
      ` : ''}

      <!-- ============================================================= -->
      <!-- 🛠️ SEKME 6: BAKIM TÜRÜ MALZEME ANALİZİ (PLANLI VS ARIZA)       -->
      <!-- ============================================================= -->
      ${activeTab === 'maint-types' ? `
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0; font-size: 1.25rem; font-weight: 800; color: #00f3ff; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-wrench" style="color: #10b981;"></i> BAKIM TÜRÜNE GÖRE MALZEME TÜKETİM & MALİYET ANALİZİ
              </h3>
              <span style="font-size: 0.75rem; color: #94a3b8;">Planlı & Periyodik Bakım (Önleyici) harcamaları ile Acil Arıza Duruşları harcamalarının karşılaştırması</span>
            </div>
          </div>

          <!-- 3 Büyük Karşılaştırma Kartı -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
            ${sortedMaintTypes.map(mt => {
              const costPct = totalCostEUR > 0 ? ((mt.totalCostEUR / totalCostEUR) * 100).toFixed(1) : '0';
              const qtyPct = totalPartsUsed > 0 ? ((mt.totalUsed / totalPartsUsed) * 100).toFixed(1) : '0';
              const topMats = Object.values(mt.materials).sort((a, b) => b.used - a.used).slice(0, 4);

              return `
                <div style="background: linear-gradient(180deg, rgba(20, 28, 48, 0.75) 0%, rgba(13, 20, 36, 0.9) 100%); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 1.35rem; display: flex; flex-direction: column; gap: 1rem; border-top: 4px solid ${mt.color}; box-shadow: 0 8px 24px rgba(0,0,0,0.25);">
                  
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="width: 42px; height: 42px; border-radius: 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; color: ${mt.color}; font-size: 1.25rem;">
                      <i class="fa-solid ${mt.icon}"></i>
                    </div>
                    <div>
                      <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: #fff;">
                        ${mt.name}
                      </div>
                      <span style="font-size: 0.7rem; color: #94a3b8;">Tüketim Payı: <strong style="color: ${mt.color};">%${qtyPct}</strong></span>
                    </div>
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.35); padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                    <div>
                      <span style="font-size: 0.65rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; display: block;">Toplam Sarfiyat</span>
                      <span style="font-family: monospace; font-size: 1.25rem; font-weight: 900; color: #fff;">
                        ${mt.totalUsed.toLocaleString('tr-TR')} <span style="font-size: 0.75rem; color: #64748b;">Adet</span>
                      </span>
                    </div>
                    ${canViewPrices ? `
                      <div style="text-align: right;">
                        <span style="font-size: 0.65rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; display: block;">Toplam Maliyet</span>
                        <span style="font-family: monospace; font-size: 1.25rem; font-weight: 900; color: #34d399;">
                          ${formatCostBadge(mt.totalCostEUR, 0, 0)}
                        </span>
                      </div>
                    ` : ''}
                  </div>

                  <!-- En Çok Tüketilen Parçalar -->
                  <div>
                    <span style="font-size: 0.68rem; color: #64748b; font-weight: 700; text-transform: uppercase; display: block; margin-bottom: 6px;">Bu Kapsamda En Çok Değişenler:</span>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                      ${topMats.map(m => `
                        <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: #cbd5e1; background: rgba(255,255,255,0.02); padding: 4px 8px; border-radius: 6px;">
                          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px;" title="${m.description}">• ${m.description}</span>
                          <strong style="color: #00f3ff; font-family: monospace;">${m.used} Adet</strong>
                        </div>
                      `).join('')}
                    </div>
                  </div>

                </div>
              `;
            })}
          </div>

        </div>
      ` : ''}

    </div>
  `;
};

