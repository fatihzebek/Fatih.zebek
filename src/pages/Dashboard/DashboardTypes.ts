export interface CachedDashboardData {
  tasks?: any[];
  pendingLeaves?: any[];
  reminders?: any[];
  transfers?: any[];
  reports?: any[];
}

export let cachedDashboardData: CachedDashboardData = {};

export const setCachedDashboardData = (newData: Partial<CachedDashboardData>) => {
  cachedDashboardData = { ...cachedDashboardData, ...newData };
};

export const cleanSablonName = (sablonName: string) => {
  return (sablonName || '').replace(/\s*[Tt]alimat[ıi]\s*/g, '').trim().toUpperCase();
};

export const isGenericFault = (code: string) => !code || code.includes('---') || code.toUpperCase().includes('GENEL GÖREV');
