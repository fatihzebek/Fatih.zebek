import { db } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'TECHNICIAN' | 'GUEST' | 'MALZEME_YONETIMI';
  password?: string;
  allowedTabs: Record<string, any>; // Granular permissions: { tabId: { subPermission: boolean } }
  allowedSites: string[]; // Site IDs
  allowedWarehouses: string[]; // Warehouse IDs
  team?: string; // Atanan Ekip (Sadece kendi iş emirlerini görmesi için)
  managedTeams?: string[]; // Yönettiği Ekipler (Takım lideri olarak görebileceği alt ekipler)
  allowedTsiCategories?: string[]; // Servis Teknik Information kategori ID'leri
}

class UserService {
  private collectionRef = collection(db, 'users');

  async getProfile(uid: string): Promise<UserProfile | null> {
    const cacheKey = `currentUserProfile_${uid}`;
    
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
      console.error("Firestore getProfile failed, attempting localStorage backup:", error);
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

  async deleteUser(uid: string) {
    const docRef = doc(this.collectionRef, uid);
    await deleteDoc(docRef);
  }
}

export const userService = new UserService();
