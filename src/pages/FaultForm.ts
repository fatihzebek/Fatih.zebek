import { auth } from '../firebase';
import { FaultFormUI, resolveBearingDescription } from './FaultForm/FaultFormUI';
import { FaultFormController } from './FaultForm/FaultFormController';

/**
 * FaultFormPage - Main entry point for the Fault & Maintenance reporting form.
 * Modularized version that delegates logic to FaultFormController and UI to FaultFormUI.
 */
export async function FaultFormPage(initialData?: any) {
    let finalData = initialData;
    let isRestored = false;

    if (initialData?.id) {
        try {
            const localDraftStr = localStorage.getItem('activeTaskContext');
            if (localDraftStr) {
                const localDraft = JSON.parse(localDraftStr);
                if (localDraft && localDraft.id === initialData.id) {
                    console.log("Using activeTaskContext draft from localStorage for task:", initialData.id);
                    finalData = {
                        ...localDraft,
                        isEditMode: initialData.isEditMode,
                        reportNo: initialData.reportNo,
                        id: initialData.id
                    };
                    isRestored = true;
                }
            }
        } catch (e) {
            console.error("Error reading activeTaskContext draft:", e);
        }
    }

    const isBearingTask = finalData?.secilenSablon === 'Rulman Analizi' ||
                          finalData?.rawFaultCode === 'Rulman Analizi' ||
                          finalData?.faultCode === 'Rulman Analizi' ||
                          (typeof finalData?.rawFaultCode === 'string' && finalData.rawFaultCode.startsWith('BRG-')) ||
                          (typeof finalData?.statuKodu === 'string' && finalData.statuKodu.startsWith('BRG-')) ||
                          (typeof finalData?.type === 'string' && finalData.type.includes('Rulman'));

    if (isBearingTask && finalData) {
        finalData.rawFaultCode = 'Rulman Analizi';
        finalData.faultCode = 'Rulman Analizi';
        const resolved = resolveBearingDescription(finalData) || resolveBearingDescription(initialData);
        finalData.statuAciklamasi = resolved;
        finalData.faultDesc = resolved;
        finalData.description = resolved;
    }

    (window as any).isRestoredFromDraft = isRestored;

    // 1. Initialize Controller (registers all window-bound event handlers)
    FaultFormController.init(finalData);

    // 2. Set Page-Level State for backward compatibility and lifecycle management
    (window as any).isEditMode = !!finalData?.isEditMode;
    (window as any).currentEditReportId = finalData?.id || null;
    (window as any).currentTaskContext = finalData;
    (window as any).selectedFaultFiles = [];
    (window as any).workSessions = [];
    (window as any).teamPersonnel = [];
    (window as any).smartAuditItems = null;

    // 3. Post-render initialization (must run after main.ts sets innerHTML)
    setTimeout(() => {
        // Apply time masks to inputs
        if (typeof (window as any).applyTimeMasks === 'function') {
            (window as any).applyTimeMasks();
        }
        
        // Initial MCF validation check
        if (typeof (window as any).checkMcfValidation === 'function') {
            (window as any).checkMcfValidation();
        }

        // Render Global Personnel Inputs if function exists
        if (typeof (window as any).renderGlobalPersonnelInputs === 'function') {
            (window as any).renderGlobalPersonnelInputs();
        }

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 150);

    // 4. Return the HTML layout for main.ts to render
    return FaultFormUI.renderMainLayout(finalData);
}
