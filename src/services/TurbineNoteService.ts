import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  getDocs, 
  onSnapshot,
  query, 
  where, 
  deleteDoc, 
  doc, 
  updateDoc 
} from 'firebase/firestore';

export interface TurbineNote {
  id: string;
  turbineId: string;
  content: string;
  isCompleted: boolean;
  imageUrl?: string;
  createdAt: any;
  createdBy: string;
}

class TurbineNoteService {
  private collectionName = 'turbineNotes';

  async getNotes(turbineId: string): Promise<TurbineNote[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('turbineId', '==', turbineId)
      );
      const snapshot = await getDocs(q);
      const notes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TurbineNote[];
      
      // Sort locally to avoid index build latency
      return notes.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });
    } catch (error) {
      console.error("Error fetching notes:", error);
      return [];
    }
  }

  subscribeNotes(turbineId: string, callback: (notes: TurbineNote[]) => void) {
    const q = query(
      collection(db, this.collectionName),
      where('turbineId', '==', turbineId)
    );
    
    return onSnapshot(q, (snapshot) => {
      const notes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TurbineNote[];

      // Sort locally
      const sorted = notes.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : Date.now();
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : Date.now();
        return timeB - timeA;
      });
      
      callback(sorted);
    }, (error) => {
      console.error("Firestore Subscription Error Details:", error);
      alert(`HATA DETAYI: ${error.message}\nKod: ${error.code}\nKoleksiyon: ${this.collectionName}\nTürbin: ${turbineId}`);
    });
  }

  async addNote(turbineId: string, content: string, createdBy: string, imageUrl?: string) {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        turbineId,
        content,
        isCompleted: false,
        imageUrl: imageUrl || null,
        createdAt: serverTimestamp(),
        createdBy
      });

      // Log creation
      await this.logAction({
        action: 'CREATE',
        turbineId,
        content,
        user: createdBy,
        timestamp: serverTimestamp()
      });

      return docRef.id;
    } catch (error) {
      console.error("Error adding note:", error);
      throw error;
    }
  }

  async toggleNote(noteId: string, isCompleted: boolean) {
    try {
      const docRef = doc(db, this.collectionName, noteId);
      await updateDoc(docRef, { isCompleted });
    } catch (error) {
      console.error("Error toggling note:", error);
    }
  }

  async deleteNote(noteId: string, deletedBy: string) {
    try {
      // Get note info before deleting for log
      const noteRef = doc(db, this.collectionName, noteId);
      const noteSnap = await getDocs(query(collection(db, this.collectionName), where('__name__', '==', noteId)));
      const noteData = noteSnap.docs[0]?.data();

      await deleteDoc(noteRef);

      // Log deletion
      await this.logAction({
        action: 'DELETE',
        turbineId: noteData?.turbineId || 'Unknown',
        content: noteData?.content || '',
        user: deletedBy,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  }

  private async logAction(logData: any) {
    try {
      await addDoc(collection(db, 'turbineNoteLogs'), logData);
    } catch (error) {
      console.error("Error logging action:", error);
    }
  }
}

export const turbineNoteService = new TurbineNoteService();
