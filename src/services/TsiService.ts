import { db } from '../firebase';
import { collection, doc, getDocs, addDoc, deleteDoc, query, orderBy, serverTimestamp, onSnapshot, writeBatch, where } from 'firebase/firestore';

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
  isChunked?: boolean;
  chunkCount?: number;
  isFirestoreBase64?: boolean;
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
    const CHUNK_SIZE = 800 * 1024; // 800KB characters to stay safe under Firestore 1MB limit per document
    
    try {
      // 1. Read file as Base64
      const base64String = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Strip data url prefix (e.g. data:application/pdf;base64,)
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
      });

      // 2. Split into chunks
      const chunkCount = Math.ceil(base64String.length / CHUNK_SIZE);
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      // 3. Upload chunks to Firestore in batches
      const batchSize = 10;
      for (let i = 0; i < chunkCount; i += batchSize) {
        const batch = writeBatch(db);
        const maxJ = Math.min(i + batchSize, chunkCount);
        
        for (let j = i; j < maxJ; j++) {
          const start = j * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE, base64String.length);
          const chunkData = base64String.substring(start, end);
          
          const chunkRef = doc(collection(db, 'tsi_chunks'));
          batch.set(chunkRef, {
            documentId: documentId,
            index: j,
            data: chunkData
          });
        }
        await batch.commit();

        if (onProgress) {
          const progress = Math.round(((i + batchSize) / chunkCount) * 95);
          onProgress(Math.min(progress, 95));
        }
      }

      // 4. Save metadata
      await addDoc(collection(db, 'tsi_documents'), {
        title,
        categoryId,
        fileUrl: 'firestore-base64', // Magic string to indicate custom handling
        fileName: file.name,
        fileSize: file.size,
        storagePath: documentId, // Reusing storagePath to hold our custom ID
        uploadedBy,
        createdAt: serverTimestamp(),
        isChunked: true,
        chunkCount: chunkCount,
        isFirestoreBase64: true
      });
      
      if (onProgress) onProgress(100);

    } catch (e) {
      console.error("[Upload] Error: ", e);
      throw e;
    }
  }

  async getChunkedFileUrl(docData: TsiDocument, onProgress?: (progress: number) => void): Promise<string> {
    if (!docData.isFirestoreBase64) {
      return docData.fileUrl; // Fallback for old links
    }

    // 1. Fetch chunks from Firestore
    const documentId = docData.storagePath;
    const q = query(collection(db, 'tsi_chunks'), where('documentId', '==', documentId));
    const snapshot = await getDocs(q);

    // 2. Sort chunks by index
    const chunks = snapshot.docs.map(d => d.data());
    chunks.sort((a, b) => a.index - b.index);

    if (onProgress) onProgress(50);

    // 3. Rebuild Base64 string
    const fullBase64 = chunks.map(c => c.data).join('');

    // 4. Convert Base64 to Blob
    const byteCharacters = atob(fullBase64);
    const byteArrays = [];
    const sliceSize = 512;

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      const slice = byteCharacters.slice(offset, offset + sliceSize);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);

      if (onProgress && offset % (sliceSize * 100) === 0) {
        onProgress(50 + Math.round((offset / byteCharacters.length) * 50));
      }
    }

    const blob = new Blob(byteArrays, { type: 'application/pdf' });
    if (onProgress) onProgress(100);

    return URL.createObjectURL(blob);
  }

  async deleteDocument(id: string, docData: TsiDocument): Promise<void> {
    try {
      if (docData.isFirestoreBase64) {
        // Delete all chunks
        const documentId = docData.storagePath;
        const q = query(collection(db, 'tsi_chunks'), where('documentId', '==', documentId));
        const snapshot = await getDocs(q);
        
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }
    } catch (err) {
      console.warn("Chunk delete error:", err);
    }
    
    // Delete metadata
    await deleteDoc(doc(db, 'tsi_documents', id));
  }
}

export const tsiService = new TsiService();

