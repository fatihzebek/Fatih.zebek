import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  signInAnonymously,
  createUserWithEmailAndPassword,
  updatePassword as firebaseUpdatePassword
} from 'firebase/auth';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { presenceService } from './PresenceService';

class AuthService {
  private currentUser: User | null = null;
  private isInitializing: boolean = true;

  private isFallbackMode = false;

  constructor() {
    // Restore fallback session if exists
    const storedFallback = localStorage.getItem('dh_auth_fallback');
    if (storedFallback) {
      try {
        const data = JSON.parse(storedFallback);
        this.currentUser = data.user;
        this.isFallbackMode = true;
        console.log("[Auth] Restored fallback session for:", this.currentUser?.email);
        
        // Start heartbeat for restored fallback session
        if (this.currentUser) {
          setTimeout(() => {
            presenceService.startHeartbeat(this.currentUser!.uid);
          }, 1000); // Small delay to ensure DB connection
        }
      } catch (e) {
        localStorage.removeItem('dh_auth_fallback');
      }
    }

    onAuthStateChanged(auth, (user) => {
      // If we are in fallback mode, don't let the anonymous sign-in overwrite our mock user
      if (this.isFallbackMode && this.currentUser) {
        console.log("[Auth] Fallback mode active, ignoring Firebase auth state change.");
        this.isInitializing = false;
        return;
      }

      // CRITICAL FIX: If the user is anonymous, and we are NOT in fallback mode, we must IGNORE this user.
      // This is a temporary anonymous session used to query Firestore rules for fallback login.
      // Letting it pass would cause main.ts to treat it as logged in, fetch its nonexistent profile, and log out.
      if (user && user.isAnonymous && !this.isFallbackMode) {
        console.log("[Auth] Ignoring temporary anonymous user session.");
        this.isInitializing = false;
        return;
      }

      this.currentUser = user;
      this.isInitializing = false;
      
      if (user) {
        // Start presence heartbeat for real users
        presenceService.startHeartbeat(user.uid);
      }
      
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: user }));
      }
    });
  }

  async login(email: string, pass: string) {
    try {
      // 1. Try real Firebase Auth first
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        this.isFallbackMode = false;
        localStorage.removeItem('dh_auth_fallback'); // Clear any fallback sessions
        return userCredential.user;
      } catch (authError: any) {
        console.warn("Firebase Auth failed, attempting anonymous sign-in for Firestore fallback...");
        
        let anonymousSigned = false;
        try {
          await signInAnonymously(auth);
          anonymousSigned = true;
          console.log("Anonymous sign-in succeeded for fallback check.");
        } catch (anonError) {
          console.error("Anonymous sign-in failed before fallback check:", anonError);
        }

        try {
          // 2. Fallback to Firestore-based login
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', email), where('password', '==', pass));

          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const userDoc = querySnapshot.docs[0];
            const userData = userDoc.data();
            
            // Mock user that looks like a Firebase User
            const fallbackUser = {
              uid: userDoc.id, // Critical: must match the document ID in Firestore
              email: email,
              displayName: userData.displayName || email.split('@')[0],
              isAnonymous: true 
            } as any;

            this.isFallbackMode = true;
            this.currentUser = fallbackUser;

            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: this.currentUser }));
            }

            // Persist fallback session
            localStorage.setItem('dh_auth_fallback', JSON.stringify({
              user: this.currentUser,
              isFallbackMode: true
            }));
            
            // Presence System: Start Heartbeat and set status
            if (this.currentUser) {
              await presenceService.updateStatus(this.currentUser.uid, 'online');
              presenceService.startHeartbeat(this.currentUser.uid);
            }
            
            return this.currentUser;
          }
          
          if (anonymousSigned) {
            await signOut(auth);
          }
          throw authError;
        } catch (firestoreError: any) {
          if (anonymousSigned) {
            try { await signOut(auth); } catch {}
          }
          // If the Firestore query failed with a permission error or similar, throw the original authError instead of the rules error to not leak information or cause confusion
          console.error("Firestore fallback query error:", firestoreError);
          throw authError;
        }
      }
    } catch (error: any) {
      console.error("Login failed:", error);
      throw error;
    }
  }

  async logout() {
    // Presence System: Stop Heartbeat and set status offline
    if (this.currentUser) {
      await presenceService.updateStatus(this.currentUser.uid, 'offline');
    }
    presenceService.stopHeartbeat();

    this.isFallbackMode = false;
    this.currentUser = null;
    localStorage.removeItem('dh_auth_fallback');
    await signOut(auth);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  isAuthenticated() {
    return !!this.currentUser;
  }

  isReady() {
    return !this.isInitializing;
  }

  /**
   * Firebase config'i runtime'da al (import.meta.env'den)
   */
  private getFirebaseConfig() {
    return {
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID
    };
  }

  /**
   * Yeni kullanıcı oluştur (Firebase Authentication'da).
   * İkincil bir Firebase uygulaması kullanarak mevcut admin oturumunu bozmadan çalışır.
   * @returns Firebase Auth tarafından oluşturulan uid
   */
  async createAuthUser(email: string, password: string): Promise<string> {
    const config = this.getFirebaseConfig();
    const secondaryApp = initializeApp(config, 'secondaryAuthApp_' + Date.now());
    
    try {
      const secondaryAuth = getAuth(secondaryApp);
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = userCredential.user.uid;
      
      // İkincil uygulamadan çıkış yap (ana oturumu etkilemez)
      await signOut(secondaryAuth);
      
      return uid;
    } finally {
      // İkincil uygulamayı temizle
      try { await deleteApp(secondaryApp); } catch {}
    }
  }

  /**
   * Mevcut bir kullanıcının Firebase Auth şifresini güncelle.
   * Bu işlem Firebase Auth REST API üzerinden yapılır.
   */
  async updateAuthPassword(email: string, oldPassword: string, newPassword: string): Promise<void> {
    const config = this.getFirebaseConfig();
    const tempApp = initializeApp(config, 'tempPasswordUpdate_' + Date.now());
    
    try {
      const tempAuth = getAuth(tempApp);
      // Geçici olarak kullanıcının oturumunu aç
      const credential = await signInWithEmailAndPassword(tempAuth, email, oldPassword);
      // Şifreyi güncelle
      await firebaseUpdatePassword(credential.user, newPassword);
      // Geçici oturumu kapat
      await signOut(tempAuth);
    } finally {
      try { await deleteApp(tempApp); } catch {}
    }
  }
}

export const authService = new AuthService();
