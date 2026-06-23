import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'TECHNICIAN' | 'GUEST' | 'MALZEME_YONETIMI' | 'TAMİR';
  password?: string;
  allowedTabs: Record<string, any>; // Granular permissions: { tabId: { subPermission: boolean } }
  allowedSites: string[]; // Site IDs
  allowedWarehouses: string[]; // Warehouse IDs
  team?: string; // Atanan Ekip (Sadece kendi iş emirlerini görmesi için)
  managedTeams?: string[]; // Yönettiği Ekipler (Takım lideri olarak görebileceği alt ekipler)
  allowedTsiCategories?: string[]; // Servis Teknik Information kategori ID'leri
  isActive?: boolean; // Active state of the user
}

const MOCK_PROFILES: Record<string, UserProfile> = {
  "uQpDmHp0kaeOEqOc5AUmKMyKp5h1": {
    uid: "uQpDmHp0kaeOEqOc5AUmKMyKp5h1",
    email: "fatih.zebek@demirerholding.com",
    displayName: "Fatih Zebek",
    role: "ADMIN",
    allowedTabs: {
      dashboard: true,
      tasks: true,
      inventory: true,
      turbines: true,
      teams: true,
      "new-task": true,
      warehouses: true,
      transfers: true,
      users: true,
      templates: true,
      analytics: true,
      "reports-archive": true,
      "visual-bom": true,
      workshop: true,
      "workshop-stock": true
    },
    allowedSites: ["all"],
    allowedWarehouses: ["all"],
    isActive: true
  },
  "6zUvK7g204Z9qBWKhk3ThTSQ0iR2": {
    uid: "6zUvK7g204Z9qBWKhk3ThTSQ0iR2",
    email: "dh-tm13@demirerholding.com",
    displayName: "TM13 Bakım Teknisyeni",
    role: "TECHNICIAN",
    allowedTabs: {
      dashboard: true,
      tasks: true,
      inventory: true,
      turbines: true,
      "visual-bom": true
    },
    allowedSites: ["all"],
    allowedWarehouses: ["all"],
    isActive: true
  },
  "UNclj0NKXdTVkET9Tp566rouMvh2": {
    uid: "UNclj0NKXdTVkET9Tp566rouMvh2",
    email: "dh-tm15@demirerholding.com",
    displayName: "TM15 Bakım Teknisyeni",
    role: "TECHNICIAN",
    allowedTabs: {
      dashboard: true,
      tasks: true,
      inventory: true,
      turbines: true,
      "visual-bom": true
    },
    allowedSites: ["all"],
    allowedWarehouses: ["all"],
    isActive: true
  },
  "VELpZxAedmh0WLuL8JpZBSUxgCp2": {
    uid: "VELpZxAedmh0WLuL8JpZBSUxgCp2",
    email: "dh-tm04@demirerholding.com",
    displayName: "TM04 Bakım Teknisyeni",
    role: "TECHNICIAN",
    allowedTabs: {
      dashboard: true,
      tasks: true,
      inventory: true,
      turbines: true,
      "visual-bom": true
    },
    allowedSites: ["all"],
    allowedWarehouses: ["all"],
    isActive: true
  }
};

class UserService {
  private collectionRef = collection(db, 'users');

  async getProfile(uid: string): Promise<UserProfile | null> {
    const cacheKey = `currentUserProfile_${uid}`;
    
    // Quick dev mode mock bypass
    if (import.meta.env.DEV && MOCK_PROFILES[uid]) {
      console.log("[UserService] Dev mode: returned mock profile for:", uid);
      return MOCK_PROFILES[uid];
    }
    
    // Quick offline fallback
    if (!navigator.onLine) {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          console.log("Offline mode: loaded user profile from localStorage cache.");
          return JSON.parse(cached) as UserProfile;
        } catch (e) {
          console.error("Error parsing cached profile:", e);
        }
      }
    }

    try {
      const docRef = doc(this.collectionRef, uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const profile = docSnap.data() as UserProfile;
        localStorage.setItem(cacheKey, JSON.stringify(profile));
        return profile;
      }
    } catch (error) {
      console.error("Firestore getProfile failed, attempting mock/localStorage backup:", error);
      const mockProfile = MOCK_PROFILES[uid];
      if (mockProfile) {
        return mockProfile;
      }
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          return JSON.parse(cached) as UserProfile;
        } catch (e) {
          // ignore
        }
      }
    }
    return null;
  }

  async saveProfile(profile: UserProfile) {
    const docRef = doc(this.collectionRef, profile.uid);
    await setDoc(docRef, profile, { merge: true });
    // Keep local cache in sync
    localStorage.setItem(`currentUserProfile_${profile.uid}`, JSON.stringify(profile));
  }

  async getAllUsers(): Promise<UserProfile[]> {
    const querySnapshot = await getDocs(this.collectionRef);
    return querySnapshot.docs.map(doc => doc.data() as UserProfile);
  }

  async updatePermissions(uid: string, data: { allowedTabs?: any, allowedSites?: string[], allowedWarehouses?: string[], password?: string, team?: string, managedTeams?: string[], allowedTsiCategories?: string[] }) {
    const docRef = doc(this.collectionRef, uid);
    await updateDoc(docRef, data);
  }

  async updateActiveStatus(uid: string, isActive: boolean) {
    const docRef = doc(this.collectionRef, uid);
    await updateDoc(docRef, { isActive });
  }

  async deleteUser(uid: string) {
    const docRef = doc(this.collectionRef, uid);
    await deleteDoc(docRef);
  }
}

export const userService = new UserService();
