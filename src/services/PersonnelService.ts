import { db } from '../firebase';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import personnelData from '../data/personnel.json';
import personnelDetails from '../data/personnel_details.json';

class PersonnelService {
  private personnel: string[] = personnelData;
  private ids: { [name: string]: string } = {};
  private details: { id: string, name: string, company?: string, baseSites?: string[], team?: string }[] = [];

  constructor() {
    this.initListener();
  }

  private initListener() {
    try {
      const q = query(collection(db, 'personnel'));
      onSnapshot(q, (snapshot) => {
        const list: string[] = [];
        const newIds: { [name: string]: string } = {};
        const newDetails: any[] = [];

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.name) {
            list.push(data.name);
            newIds[data.name] = docSnap.id;
            newDetails.push({
              id: docSnap.id,
              name: data.name,
              company: data.company || '',
              baseSites: data.baseSites || [],
              team: data.team || ''
            });
          }
        });
        
        // Merge static fallback personnel list with Firestore documents to ensure none vanish
        const uniqueNames = new Set([...personnelData, ...list]);
        const sortedList = Array.from(uniqueNames).sort((a, b) => a.localeCompare(b, 'tr-TR'));

        this.personnel = sortedList;
        this.ids = newIds;
        this.details = newDetails;

        // Trigger dynamic UI re-render if active in the Admin page
        if (typeof (window as any).renderPersonnelManagementList === 'function') {
          (window as any).renderPersonnelManagementList();
        }
        if (typeof (window as any).updateDashboardUserBadge === 'function') {
          (window as any).updateDashboardUserBadge();
        }
      }, (err) => {
        console.debug("Personnel real-time listener failed:", err);
      });
    } catch (e) {
      console.debug("Failed to initialize personnel listener:", e);
    }
  }

  getPersonnelList(): string[] {
    return this.personnel;
  }

  getPersonnelId(name: string): string | undefined {
    return this.ids[name];
  }

  getPersonnelDetailsList() {
    const list = this.personnel;
    return list.map(name => {
      // Find loaded firestore details first
      const loaded = this.details.find(d => d.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'));
      if (loaded && (loaded.company || (loaded.baseSites && loaded.baseSites.length > 0) || loaded.team)) {
        return {
          id: loaded.id,
          name: loaded.name,
          company: loaded.company || '',
          baseSites: loaded.baseSites || [],
          team: loaded.team || ''
        };
      }
      // Fallback to static JSON file details
      const match = personnelDetails.find(d => d.name.toLocaleLowerCase('tr-TR') === name.toLocaleLowerCase('tr-TR'));
      return {
        id: this.ids[name] || '',
        name,
        company: match?.company || '',
        baseSites: match?.baseSiteId && match.baseSiteId !== 'GENEL' ? [match.baseSiteId] : [],
        team: ''
      };
    });
  }

  searchPersonnel(queryText: string): string[] {
    if (!queryText) return this.personnel;
    const lowerQuery = queryText.toLocaleLowerCase('tr-TR');
    return this.personnel.filter(p => p.toLocaleLowerCase('tr-TR').includes(lowerQuery));
  }

  async addPersonnel(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("İsim boş olamaz");
    
    if (this.personnel.some(p => p.toLocaleLowerCase('tr-TR') === trimmed.toLocaleLowerCase('tr-TR'))) {
      throw new Error("Bu personel zaten kayıtlı");
    }

    const match = personnelDetails.find(d => d.name.toLocaleLowerCase('tr-TR') === trimmed.toLocaleLowerCase('tr-TR'));
    await addDoc(collection(db, 'personnel'), {
      name: trimmed,
      company: match?.company || '',
      baseSites: match?.baseSiteId && match.baseSiteId !== 'GENEL' ? [match.baseSiteId] : [],
      createdAt: new Date().toISOString()
    });
  }

  async updatePersonnelDetails(name: string, company: string, baseSites: string[], team: string): Promise<void> {
    const id = this.ids[name];
    if (!id) {
      // Create new document in firestore with name, company, baseSites, team
      await addDoc(collection(db, 'personnel'), {
        name,
        company,
        baseSites,
        team,
        createdAt: new Date().toISOString()
      });
    } else {
      // Update existing document
      const docRef = doc(db, 'personnel', id);
      await updateDoc(docRef, {
        company,
        baseSites,
        team
      });
    }
  }

  async deletePersonnelByName(name: string): Promise<void> {
    const id = this.ids[name];
    if (!id) throw new Error("Personel bulunamadı");
    await deleteDoc(doc(db, 'personnel', id));
  }
}

export const personnelService = new PersonnelService();
