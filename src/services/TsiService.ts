import { db, storage } from '../firebase';
import { collection, doc, getDocs, addDoc, deleteDoc, query, orderBy, serverTimestamp, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';

export interface TsiCategory {
  id: string;
  name: string;
  createdAt: any;
}

export interface TsiDocument {
  id: string;
  title: string;
  categoryId: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  storagePath: string;
  uploadedBy: string; // email or name
  createdAt: any;
}

class TsiService {
  // --- CATEGORIES ---
  async getCategories(): Promise<TsiCategory[]> {
    const q = query(collection(db, 'tsi_categories'), orderBy('name', 'asc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TsiCategory));
  }

  subscribeCategories(callback: (categories: TsiCategory[]) => void): () => void {
    const q = query(collection(db, 'tsi_categories'), orderBy('name', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TsiCategory));
      callback(categories);
    });
  }

  async addCategory(name: string): Promise<string> {
    const docRef = await addDoc(collection(db, 'tsi_categories'), {
      name,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  }

  async deleteCategory(id: string): Promise<void> {
    await deleteDoc(doc(db, 'tsi_categories', id));
  }

  // --- DOCUMENTS ---
  async getDocuments(): Promise<TsiDocument[]> {
    const q = query(collection(db, 'tsi_documents'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TsiDocument));
  }

  subscribeDocuments(callback: (docs: TsiDocument[]) => void): () => void {
    const q = query(collection(db, 'tsi_documents'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TsiDocument));
      callback(docs);
    });
  }

  async uploadDocument(file: File, title: string, categoryId: string, uploadedBy: string, onProgress?: (progress: number) => void): Promise<void> {
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-]/g, '_');
    const storagePath = `tsi_files/${categoryId}/${Date.now()}_${safeName}`;
    const storageRef = ref(storage, storagePath);
    
    let simulatedProgress = 10;
    if (onProgress) onProgress(simulatedProgress);
    
    // Simulate progress every 500ms up to 90%
    const progressInterval = setInterval(() => {
      if (simulatedProgress < 90) {
        simulatedProgress += Math.floor(Math.random() * 5) + 1;
        if (simulatedProgress > 90) simulatedProgress = 90;
        if (onProgress) onProgress(simulatedProgress);
      }
    }, 500);
    
    try {
      await uploadBytes(storageRef, file);
      if (onProgress) onProgress(95);
      
      const downloadUrl = await getDownloadURL(storageRef);
      
      await addDoc(collection(db, 'tsi_documents'), {
        title,
        categoryId,
        fileUrl: downloadUrl,
        fileName: file.name,
        fileSize: file.size,
        storagePath: storagePath,
        uploadedBy,
        createdAt: serverTimestamp()
      });
      
      clearInterval(progressInterval);
      if (onProgress) onProgress(100);
    } catch (e) {
      clearInterval(progressInterval);
      console.error("Upload Error: ", e);
      throw e;
    }
  }

  async deleteDocument(id: string, storagePath: string): Promise<void> {
    try {
      if (storagePath) {
        const fileRef = ref(storage, storagePath);
        await deleteObject(fileRef);
      }
    } catch (err) {
      console.warn("Storage file delete error (maybe already deleted):", err);
    }
    await deleteDoc(doc(db, 'tsi_documents', id));
  }
}

export const tsiService = new TsiService();
