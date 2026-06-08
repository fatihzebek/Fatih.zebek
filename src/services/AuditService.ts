import { db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export interface AuditItem {
    id?: string;
    text: string;
    status: 'OK' | 'NOT_OK' | 'NA' | '';
    comment?: string;
    category?: string;
}

class AuditService {
    async saveMaintenanceDraft(currentTask: any, data: {
        checklist: AuditItem[],
        workSessions: any[],
        teamPersonnel: any[],
        materials: any[],
        notes: string,
        matFormNo: string
    }, isSilent = false) {
        if (!currentTask?.id) return;
        
        try {
            // Update context locally and save to localStorage immediately for instant offline durability
            currentTask.maintenanceData = currentTask.maintenanceData || {};
            currentTask.maintenanceData.checklist = data.checklist;
            currentTask.maintenanceData.workSessions = data.workSessions;
            currentTask.maintenanceData.teamPersonnel = data.teamPersonnel;
            currentTask.maintenanceData.materials = data.materials;
            currentTask.maintenanceData.notes = data.notes;
            currentTask.maintenanceData.matFormNo = data.matFormNo;
            localStorage.setItem('activeTaskContext', JSON.stringify(currentTask));

            const docRef = doc(db, 'tasks', currentTask.id);
            const safeData = JSON.parse(JSON.stringify(data));
            const updatePromise = updateDoc(docRef, {
                'maintenanceData.checklist': safeData.checklist || [],
                'maintenanceData.workSessions': safeData.workSessions || [],
                'maintenanceData.teamPersonnel': safeData.teamPersonnel || [],
                'maintenanceData.materials': safeData.materials || [],
                'maintenanceData.notes': safeData.notes || '',
                'maintenanceData.matFormNo': safeData.matFormNo || '',
                'workflow.guncellenmeTarihi': serverTimestamp()
            });

            // Race the Firestore write with a 1.5s timeout.
            // If the user is offline or connection is slow, we still count it as a successful local save
            // and let Firestore's internal offline sync engine upload it once connection resumes.
            const timeoutPromise = new Promise<void>((_, reject) => 
                setTimeout(() => reject(new Error("OFFLINE_TIMEOUT")), 1500)
            );

            try {
                await Promise.race([updatePromise, timeoutPromise]);
            } catch (raceErr: any) {
                if (raceErr?.message === "OFFLINE_TIMEOUT") {
                    console.warn("Firestore save timed out (likely offline). Saved locally.");
                } else {
                    throw raceErr;
                }
            }
            
            return true;
        } catch (err) {
            console.error("Draft Save Error:", err);
            throw err;
        }
    }

    getStatusColor(s: string) {
        if (s === 'OK') return '#00e676';
        if (s === 'NOT_OK') return '#ff3366';
        if (s === 'NA') return '#94a3b8';
        return '#475569';
    }
}

export const auditService = new AuditService();
