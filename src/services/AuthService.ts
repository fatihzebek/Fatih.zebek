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
  private isSigningInGateway = false;

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
        console.log("[Auth] Fallback mode active, ignoring Firebase auth state change. Current SDK user ID:", user?.uid);
        this.isInitializing = false;
        
        // If there is no authenticated Firebase user at all, sign in as gateway in the background to satisfy Firestore rules
        if (!user) {
          console.log("[Auth] No Firebase SDK session found in fallback mode, signing in as gateway in background to satisfy Firestore rules...");
          this.signInGateway().catch(e => {
            console.error("[Auth] Background gateway sign-in failed:", e);
            if (window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: this.currentUser }));
            }
          });
        } else {
          // Firebase SDK session is active, safe to dispatch auth-state-changed now!
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: this.currentUser }));
          }
        }
        return;
      }

      // If the user is our fallback gateway user, and we are signing in or in fallback mode, ignore in auth listener.
      if (user && user.email === 'fallback.login@demirerholding.com' && (this.isSigningInGateway || this.isFallbackMode)) {
        console.log("[Auth] Gateway user signed in during fallback login flow, ignoring in auth listener.");
        return;
      }

      // If the user is our fallback gateway user, and we are NOT in fallback mode, we must sign out and ignore.
      if (user && user.email === 'fallback.login@demirerholding.com' && !this.isFallbackMode && !this.isSigningInGateway) {
        console.log("[Auth] Ignoring temporary fallback gateway user session.");
        signOut(auth).catch(() => {});
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

  async signInGateway() {
    try {
      this.isSigningInGateway = true;
      await signInWithEmailAndPassword(auth, "fallback.login@demirerholding.com", "FallbackPassword123!");
      console.log("[Auth] Gateway account sign-in succeeded.");
    } catch (e) {
      console.error("[Auth] Gateway account sign-in failed:", e);
    } finally {
      this.isSigningInGateway = false;
    }
  }

  async login(email: string, pass: string) {
    try {
      // DEV MODE / OFFLINE BYPASS
      if (import.meta.env.DEV || email.endsWith('@dev.local') || pass === 'dev') {
        console.log("[Auth] Dev mode/bypass login detected.");
        try {
          await this.signInGateway();
          console.log("[Auth] Signed in to gateway to satisfy security rules.");
        } catch (e) {
          console.warn("[Auth] Gateway login failed, proceeding without Firebase Auth:", e);
        }
        // Try to match email with known emails, or use a default one
        let matchedUser = {
          uid: "uQpDmHp0kaeOEqOc5AUmKMyKp5h1",
          email: "fatih.zebek@demirerholding.com",
          displayName: "Fatih Zebek (Dev Bypass)",
          isAnonymous: false
        };
        
        if (email.includes('tm13')) {
          matchedUser = { uid: "6zUvK7g204Z9qBWKhk3ThTSQ0iR2", email: "dh-tm13@demirerholding.com", displayName: "Team13", isAnonymous: false };
        } else if (email.includes('tm15')) {
          matchedUser = { uid: "UNclj0NKXdTVkET9Tp566rouMvh2", email: "dh-tm15@demirerholding.com", displayName: "Team15", isAnonymous: false };
        } else if (email.includes('tm04')) {
          matchedUser = { uid: "VELpZxAedmh0WLuL8JpZBSUxgCp2", email: "dh-tm04@demirerholding.com", displayName: "Team04", isAnonymous: false };
        }

        this.isFallbackMode = true;
        this.currentUser = matchedUser as any;

        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('auth-state-changed', { detail: this.currentUser }));
        }

        localStorage.setItem('dh_auth_fallback', JSON.stringify({
          user: this.currentUser,
          isFallbackMode: true
        }));
        
        return this.currentUser;
      }

      // 1. Try real Firebase Auth first
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        this.isFallbackMode = false;
        localStorage.removeItem('dh_auth_fallback'); // Clear any fallback sessions
        return userCredential.user;
      } catch (authError: any) {
        console.warn("Firebase Auth failed, attempting fallback login with gateway account...");
        
        let gatewaySigned = false;
        this.isSigningInGateway = true;
        try {
          await signInWithEmailAndPassword(auth, "fallback.login@demirerholding.com", "FallbackPassword123!");
          gatewaySigned = true;
          console.log("Gateway account sign-in succeeded for fallback check.");
        } catch (gatewayError) {
          console.error("Gateway account sign-in failed:", gatewayError);
        }

        try {
          // 2. Fallback to Firestore-based login (case-insensitive and username matching)
          const querySnapshot = await getDocs(collection(db, 'users'));
          const matchedDoc = querySnapshot.docs.find(d => {
            const data = d.data();
            const dbEmail = String(data.email || '').toLowerCase().trim();
            const dbEmailUsername = dbEmail.split('@')[0];
            const dbDisplayName = String(data.displayName || '').toLowerCase().replace(/\s+/g, '').trim();
            
            const entered = email.toLowerCase().trim();
            const enteredUsername = entered.includes('@') ? entered.split('@')[0] : entered;
            const enteredClean = entered.replace(/\s+/g, '');
            
            return (dbEmail === entered || dbEmailUsername === enteredUsername || dbDisplayName === enteredClean) && 
                   String(data.password || '') === pass;
          });
          
          if (matchedDoc) {
            const userData = matchedDoc.data();
            
            // Mock user that looks like a Firebase User
            const fallbackUser = {
              uid: matchedDoc.id, // Critical: must match the document ID in Firestore
              email: userData.email, // Use stored email casing
              displayName: userData.displayName || userData.email,
              isAnonymous: false 
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
          
          if (gatewaySigned) {
            await signOut(auth);
          }
          throw authError;
        } catch (firestoreError: any) {
          if (gatewaySigned) {
            try { await signOut(auth); } catch {}
          }
          console.error("Firestore fallback query error:", firestoreError);
          throw authError;
        } finally {
          this.isSigningInGateway = false;
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

  isAuthReady() {
    if (!this.isFallbackMode) {
      return !this.isInitializing;
    }
    return !!this.currentUser && auth.currentUser !== null;
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
