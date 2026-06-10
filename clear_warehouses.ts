(global as any).window = { localStorage: { getItem: () => null, setItem: () => {} } };
import { warehouseService } from './src/services/WarehouseService';
import { dataService } from './src/services/DataService';

async function clearAll() {
  try {
    const warehouses = dataService.getWarehouses();
    for (const w of warehouses) {
      console.log('Clearing inventory for warehouse:', w.name);
      await warehouseService.clearInventory(w.id);
    }
    console.log('Successfully cleared all warehouses!');
    process.exit(0);
  } catch (err) {
    console.error('Error clearing warehouses:', err);
    process.exit(1);
  }
}

clearAll();
