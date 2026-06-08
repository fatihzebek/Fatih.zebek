import { warehouseService } from '../services/WarehouseService';
import { dataService } from '../services/DataService';
import { InventoryItem, InventoryLog } from '../services/WarehouseService';

// Global state variables matching the minified bundle's cache
(window as any).lastSortBy = (window as any).lastSortBy || 'sapNo';
(window as any).lastSortDir = (window as any).lastSortDir || 'asc';
(window as any).currentWarehouseId = (window as any).currentWarehouseId || null;
(window as any).pendingMaterialImage = null;
(window as any).cachedWarehouseId = null;
(window as any).cachedInventory = null;
(window as any).cachedReservations = null;
(window as any).cachedTrends = null;
(window as any).cachedOccupancy = null;
(window as any).cachedLogs = null;
(window as any).cachedAudits = null;

(window as any).invalidateWarehouseCache = () => {
  console.log('[Warehouse Cache] Invalidating client-side warehouse cache...');
  (window as any).cachedWarehouseId = null;
  (window as any).cachedInventory = null;
  (window as any).cachedReservations = null;
  (window as any).cachedTrends = null;
  (window as any).cachedOccupancy = null;
  (window as any).cachedLogs = null;
  (window as any).cachedAudits = null;
};

// ... updateWarehouseUI to be implemented later

export const WarehousePage = async (
  warehouseId?: string | null,
  userProfile?: any,
  sortKey: string = 'sapNo',
  sortDir: 'asc' | 'desc' = 'asc',
  searchQuery: string = '',
  tab: 'inventory' | 'history' | 'audit' | 'analytics' | 'audit_history' = 'inventory'
) => {
  if (warehouseId) {
    (window as any).currentWarehouseId = warehouseId;
  }

  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';
  const allowedTabs = userProfile?.allowedTabs?.warehouses || {};
  const hasAddMaterial = isAdmin || (typeof allowedTabs === 'object' && !!allowedTabs.addMaterial);
  const hasEditMaterial = isAdmin || (typeof allowedTabs === 'object' && !!allowedTabs.editMaterial);
  const hasDeleteMaterial = isAdmin || (typeof allowedTabs === 'object' && !!allowedTabs.deleteMaterial);
  const hasUploadImage = isAdmin || (typeof allowedTabs === 'object' && !!allowedTabs.uploadImage);
  const hasCountStock = isAdmin || (typeof allowedTabs === 'object' && !!allowedTabs.countStock);
  const hasUploadExcel = isAdmin || (typeof allowedTabs === 'object' && !!allowedTabs.uploadExcel);

  const allWarehouses = dataService.getWarehouses() || [];
  const accessibleWarehouses = isAdmin 
    ? allWarehouses 
    : allWarehouses.filter(w => userProfile?.allowedWarehouses?.includes(w.id));

  // Sort warehouses naturally or by custom order (like in original code)
  accessibleWarehouses.sort((a, b) => a.name.localeCompare(b.name));

  let inventory: InventoryItem[] = [];
  let logs: InventoryLog[] = [];
  let reservations: any = { bySap: {}, details: [] };
  let trends: any = {};
  let occupancy: any = {};
  let audits: any[] = [];

  const wnd = window as any;

  if (wnd.cachedWarehouseId === warehouseId && wnd.cachedInventory) {
    inventory = wnd.cachedInventory;
    reservations = wnd.cachedReservations || { bySap: {}, details: [] };
    trends = wnd.cachedTrends || {};
    occupancy = wnd.cachedOccupancy || {};
    logs = wnd.cachedLogs || [];
    
    if (warehouseId && tab === 'audit_history') {
      if (wnd.cachedAudits) {
        audits = wnd.cachedAudits;
      } else {
        try {
          audits = await warehouseService.getAuditHistory(warehouseId);
          wnd.cachedAudits = audits;
        } catch(e) {
          console.error(e);
        }
      }
    }
    console.log('[WarehousePage] Serving all data from client-side local cache.');
  } else {
    console.log('[WarehousePage] Cache missing or stale. Fetching fresh data from Firestore.');
    if (warehouseId) {
      try {
        inventory = await warehouseService.getInventory(warehouseId);
        if (wnd.deletedItemIds) {
          inventory = inventory.filter(e => !wnd.deletedItemIds.includes(e.id));
        }
        wnd.cachedWarehouseId = warehouseId;
        wnd.cachedInventory = inventory;
        
        occupancy = await warehouseService.getShelfOccupancy(warehouseId, inventory);
        wnd.cachedOccupancy = occupancy;
        
        reservations = wnd.cachedReservations || { bySap: {}, details: [] };
        logs = wnd.cachedLogs || [];
        trends = wnd.cachedTrends || {};
        
        // Background load logs & reservations
        if (!wnd.bgLoadStartedFor || wnd.bgLoadStartedFor !== warehouseId) {
          wnd.bgLoadStartedFor = warehouseId;
          Promise.all([
            warehouseService.getReservationsFromDrafts(warehouseId),
            warehouseService.getLogs(warehouseId)
          ]).then(async ([res, logData]) => {
            wnd.cachedReservations = res;
            wnd.cachedLogs = logData;
            const tr = await warehouseService.calculateConsumptionTrends(warehouseId, inventory, logData);
            wnd.cachedTrends = tr;
            if (wnd.currentWarehouseId === warehouseId) {
              if (wnd.updateWarehouseUI) wnd.updateWarehouseUI(warehouseId);
            }
          }).catch(console.error);
        }
        
        if (tab === 'audit_history') {
          audits = await warehouseService.getAuditHistory(warehouseId);
          wnd.cachedAudits = audits;
        }
      } catch(e) {
        console.error(e);
      }
    }
  }

  wnd.currentTrends = trends;
  wnd.currentOccupancy = occupancy;
  wnd.currentInventoryData = inventory;
  wnd.currentUser = userProfile;

  // Render logic will go here
  return `<div class="fade-in-up content-area" style="padding: 2rem; color: white;">
    <h1>Depo Sayfası Yeniden İnşa Ediliyor...</h1>
    <p>Aşama 1 tamamlandı. State ve veri çekme kurgulandı.</p>
  </div>`;
};