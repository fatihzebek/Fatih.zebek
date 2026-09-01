import { db } from '../firebase';
import { collection, onSnapshot, query, addDoc, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import personnelData from '../data/personnel.json';
import personnelDetails from '../data/personnel_details.json';

class PersonnelService {
  private personnel: string[] = personnelData;
  private ids: { [name: string]: string } = {};
  private details: { id: string, name: string, company?: string, baseSites?: string[], team?: string }[] = [];
  private deletedNames: Set<string> = new Set();
  private firestoreList: string[] = [];

  constructor() {
    this.initListener();
  }

  private initListener() {
    try {
      // Listen for deleted personnel
      const qDeleted = query(collection(db, 'deleted_personnel'));
      onSnapshot(qDeleted, (deletedSnap) => {
        const deleted = new Set<string>();
        deletedSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.name) deleted.add(data.name.toLocaleLowerCase('tr-TR').trim());
        });
        this.deletedNames = deleted;
        this.recalculateList();
      });

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

        this.firestoreList = list;
        this.ids = newIds;
        this.details = newDetails;

        this.recalculateList();
      }, (err) => {
        console.debug("Personnel real-time listener failed:", err);
      });
    } catch (e) {
      console.debug("Failed to initialize personnel listener:", e);
    }
  }

  private recalculateList() {
    // Merge static fallback personnel list with Firestore documents excluding deleted ones
    const combined = [...personnelData, ...this.firestoreList].filter(
      name => !this.deletedNames.has(name.toLocaleLowerCase('tr-TR').trim())
    );
    const uniqueNames = new Set(combined);
    const sortedList = Array.from(uniqueNames).sort((a, b) => a.localeCompare(b, 'tr-TR'));

    this.personnel = sortedList;

    // Trigger dynamic UI re-render if active in the Admin page
    if (typeof (window as any).renderPersonnelManagementList === 'function') {
      (window as any).renderPersonnelManagementList();
    }
    if (typeof (window as any).updateDashboardUserBadge === 'function') {
      (window as any).updateDashboardUserBadge();
    }
  }

  getPersonnelList(): string[] {
    return this.personnel;
  }

  getPersonnelId(name: string): string | undefined {
    return this.ids[name];
  }

  normalizeCompanyName(companyName?: string): string {
    if (!companyName) return '';
    const cleanCo = companyName.toLowerCase().trim();
    if (cleanCo.includes('yek')) {
      return 'YEK Demirer Enerji Yatırım Danışmanlık A.Ş.';
    }
    if (cleanCo.includes('har film') || cleanCo.includes('harfilm')) {
      return 'Har Film Yapım Enerji Yatırım Danışmanlık ve Tic. A.Ş.';
    }
    if (cleanCo.includes('demirer')) {
      return 'Demirer Enerji Elektrik Üretim A.Ş.';
    }
    return companyName.trim();
  }

  getPersonnelDetailsList() {
    const norm = (s: string) => {
      return (s || '')
        .toLocaleLowerCase('tr-TR')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/\s+/g, '');
    };
    const list = this.personnel;
    return list.map(name => {
      // Find loaded firestore details first
      const loaded = this.details.find(d => norm(d.name) === norm(name));
      if (loaded && (loaded.company || (loaded.baseSites && loaded.baseSites.length > 0) || loaded.team)) {
        return {
          id: loaded.id,
          name: loaded.name,
          company: this.normalizeCompanyName(loaded.company),
          baseSites: loaded.baseSites || [],
          team: loaded.team || ''
        };
      }
      // Fallback to static JSON file details
      const match = personnelDetails.find(d => norm(d.name) === norm(name));
      return {
        id: this.ids[name] || '',
        name,
        company: this.normalizeCompanyName(match?.company),
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

    // If it was previously marked as deleted, remove from deleted_personnel collection
    const safeId = trimmed.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    try {
      await deleteDoc(doc(db, 'deleted_personnel', safeId));
    } catch {}

    const match = personnelDetails.find(d => d.name.toLocaleLowerCase('tr-TR') === trimmed.toLocaleLowerCase('tr-TR'));
    await addDoc(collection(db, 'personnel'), {
      name: trimmed,
      company: match?.company || '',
      baseSites: match?.baseSiteId && match.baseSiteId !== 'GENEL' ? [match.baseSiteId] : [],
      createdAt: new Date().toISOString()
    });
  }

  async updatePersonnelDetails(originalName: string, company: string, baseSites: string[], team: string, newName?: string): Promise<void> {
    const targetName = (newName && newName.trim()) ? newName.trim() : originalName;
    const id = this.ids[originalName];

    if (targetName !== originalName) {
      // Mark old name as deleted so static json fallback doesn't duplicate it
      await this.deletePersonnelByName(originalName);
    }

    if (!id || targetName !== originalName) {
      // Create new document in firestore with name, company, baseSites, team
      await addDoc(collection(db, 'personnel'), {
        name: targetName,
        company,
        baseSites,
        team,
        createdAt: new Date().toISOString()
      });
    } else {
      // Update existing document
      const docRef = doc(db, 'personnel', id);
      await updateDoc(docRef, {
        name: targetName,
        company,
        baseSites,
        team
      });
    }
  }

  async deletePersonnelByName(name: string): Promise<void> {
    const trimmed = name.trim();
    const id = this.ids[trimmed] || this.ids[name];
    
    if (id) {
      try {
        await deleteDoc(doc(db, 'personnel', id));
      } catch (err) {
        console.warn("Firestore personnel doc delete error:", err);
      }
    }

    // Always add to deleted_personnel so static JSON entries can also be hidden permanently
    const safeId = encodeURIComponent(trimmed.toLowerCase());
    await setDoc(doc(db, 'deleted_personnel', safeId), {
      name: trimmed,
      deletedAt: new Date().toISOString()
    });
  }
}

export const personnelService = new PersonnelService();
