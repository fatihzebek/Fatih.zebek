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

export interface TurbineReminder {
  id: string;
  turbineId: string;
  siteId: string;
  siteName: string;
  content: string;
  reminderDate: string; // "YYYY-MM-DD"
  isCompleted: boolean;
  priority: 'LOW' | 'MEDIUM' | 'CRITICAL';
  imageUrl?: string;
  resolutionNote?: string;
  completedBy?: string;
  completedAt?: any;
  createdAt: any;
  createdBy: string;
}

class TurbineReminderService {
  private collectionName = 'turbineReminders';

  async getPendingReminders(): Promise<TurbineReminder[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('isCompleted', '==', false)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TurbineReminder[];
    } catch (error) {
      console.error("Error fetching pending reminders:", error);
      return [];
    }
  }

  subscribeRemindersForTurbine(turbineId: string, callback: (reminders: TurbineReminder[]) => void) {
    const q = query(
      collection(db, this.collectionName),
      where('turbineId', '==', turbineId)
    );
    
    return onSnapshot(q, (snapshot) => {
      const reminders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TurbineReminder[];

      // Sort locally by reminderDate ascending (earlier reminders first)
      const sorted = reminders.sort((a, b) => {
        return a.reminderDate.localeCompare(b.reminderDate);
      });
      
      callback(sorted);
    }, (error) => {
      console.error("Firestore Subscription Error Details:", error);
    });
  }

  subscribeActiveReminders(callback: (reminders: TurbineReminder[]) => void) {
    // Only subscribe to non-completed reminders
    const q = query(
      collection(db, this.collectionName),
      where('isCompleted', '==', false)
    );
    
    return onSnapshot(q, (snapshot) => {
      const reminders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TurbineReminder[];
      
      callback(reminders);
    }, (error) => {
      console.error("Firestore Subscription Error Details:", error);
    });
  }

  async addReminder(turbineId: string, siteId: string, siteName: string, content: string, reminderDate: string, createdBy: string, priority: 'LOW' | 'MEDIUM' | 'CRITICAL', imageUrl?: string) {
    try {
      const docRef = await addDoc(collection(db, this.collectionName), {
        turbineId,
        siteId,
        siteName,
        content,
        reminderDate,
        isCompleted: false,
        priority,
        imageUrl: imageUrl || null,
        createdAt: serverTimestamp(),
        createdBy
      });

      return docRef.id;
    } catch (error) {
      console.error("Error adding reminder:", error);
      throw error;
    }
  }

  async toggleReminder(reminderId: string, isCompleted: boolean, resolutionNote?: string, completedBy?: string) {
    try {
      const docRef = doc(db, this.collectionName, reminderId);
      const updateData: any = { isCompleted };
      
      if (isCompleted) {
        updateData.resolutionNote = resolutionNote || null;
        updateData.completedBy = completedBy || null;
        updateData.completedAt = serverTimestamp();
      } else {
        updateData.resolutionNote = null;
        updateData.completedBy = null;
        updateData.completedAt = null;
      }
      
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error("Error toggling reminder:", error);
      throw error;
    }
  }

  async deleteReminder(reminderId: string) {
    try {
      const docRef = doc(db, this.collectionName, reminderId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting reminder:", error);
      throw error;
    }
  }
}

export const turbineReminderService = new TurbineReminderService();
