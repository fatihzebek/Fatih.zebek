import { auth } from '../firebase';
import { FaultFormUI } from './FaultForm/FaultFormUI';
import { FaultFormController } from './FaultForm/FaultFormController';

/**
 * FaultFormPage - Main entry point for the Fault & Maintenance reporting form.
 * Modularized version that delegates logic to FaultFormController and UI to FaultFormUI.
 */
export async function FaultFormPage(initialData?: any) {
    // 1. Initialize Controller (registers all window-bound event handlers)
    FaultFormController.init(initialData);

    // 2. Set Page-Level State for backward compatibility and lifecycle management
    (window as any).isEditMode = !!initialData?.isEditMode;
    (window as any).currentEditReportId = initialData?.id || null;
    (window as any).currentTaskContext = initialData;
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
    return FaultFormUI.renderMainLayout(initialData);
}
