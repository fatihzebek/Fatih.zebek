import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit, QueryConstraint } from 'firebase/firestore';

export interface SearchFilters {
  serialNo?: string;
  statusCode?: string;
  teamId?: string;
  dateRange?: { start: number; end: number };
}

class SearchService {
  async advancedSearch(collectionName: string, filters: SearchFilters, maxResults: number = 50) {
    const constraints: QueryConstraint[] = [];

    if (filters.serialNo) {
      constraints.push(where('serialNo', '==', filters.serialNo));
    }

    if (filters.statusCode) {
      constraints.push(where('statusCode', '==', filters.statusCode));
    }

    if (filters.teamId) {
      constraints.push(where('teamId', '==', filters.teamId));
    }

    if (filters.dateRange) {
      constraints.push(where('timestamp', '>=', filters.dateRange.start));
      constraints.push(where('timestamp', '<=', filters.dateRange.end));
    }

    constraints.push(orderBy('timestamp', 'desc'));
    constraints.push(limit(maxResults));

    const q = query(collection(db, collectionName), ...constraints);
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async getTasksByStatusCode(statusCode: string) {
    return this.advancedSearch('tasks', { statusCode });
  }
}

export const searchService = new SearchService();
