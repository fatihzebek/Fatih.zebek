import { taskService } from '../services/TaskService';
import type { Task } from '../services/TaskService';
import { authService } from '../services/AuthService';
import { userService } from '../services/UserService';
import { serviceReportService } from '../services/ServiceReportService';
import { formatTeamName } from '../utils/formatters';
import { dataService, DataService } from '../services/DataService';
import type { ServiceReport } from '../services/ServiceReportService';
import { personnelService } from '../services/PersonnelService';
import { warehouseService } from '../services/WarehouseService';
import { ImageCompressor } from '../utils/imageCompressor';
import { db, auth } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

const cleanSablonName = (sablonName: string) => {
  return (sablonName || '')
    .replace(/\s*[Tt]alimatı\s*/g, '')
    .replace(/\s*[Tt]alimati\s*/g, '')
    .trim();
};

const formatSiteNameTitle = (name: string) => {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => {
      if (!word) return '';
      const first = word.charAt(0).toLocaleUpperCase('tr-TR');
      const rest = word.slice(1).toLocaleLowerCase('tr-TR');
      return first + rest;
    })
    .join(' ');
};

const checkCompleteTaskPermission = (currentUser: any): boolean => {
  if (!currentUser) return false;
  const role = currentUser.role?.toUpperCase();
  if (role === 'ADMIN') return true;
  
  const taskPerms = currentUser.allowedTabs?.tasks;
  // If tasks tab is explicitly enabled as boolean true or in array
  if (taskPerms === true) return true;
  if (Array.isArray(currentUser.allowedTabs) && currentUser.allowedTabs.includes('tasks')) return true;
  
  // If tasks tab is an object with granular sub-permissions
  if (typeof taskPerms === 'object' && taskPerms !== null && !Array.isArray(taskPerms)) {
    if ((taskPerms as any).completeTask === true) return true;
    if ((taskPerms as any).access === true && (taskPerms as any).completeTask !== false) return true;
    if ((taskPerms as any).completeTask === false) return false;
  }
  
  // By default, TECHNICIAN role has task completion permission unless explicitly set to false
  if (role === 'TECHNICIAN' && (taskPerms as any)?.completeTask !== false) return true;
  
  return false;
};

const checkDeleteTaskPermission = (currentUser: any): boolean => {
  if (!currentUser) return false;
  const role = currentUser.role?.toUpperCase();
  if (role === 'ADMIN') return true;
  
  const taskPerms = currentUser.allowedTabs?.tasks;
  if (typeof taskPerms === 'object' && taskPerms !== null && !Array.isArray(taskPerms)) {
    return !!(taskPerms as any).deleteTask;
  }
  return false;
};

const checkTransferTaskPermission = (currentUser: any): boolean => {
  if (!currentUser) return false;
  const role = currentUser.role?.toUpperCase();
  if (role === 'ADMIN') return true;
  
  const taskPerms = currentUser.allowedTabs?.tasks;
  if (typeof taskPerms === 'object' && taskPerms !== null && !Array.isArray(taskPerms)) {
    return !!((taskPerms as any).transferTask || (taskPerms as any).delegateTask);
  }
  return false;
};

const checkCreateTaskPermission = (currentUser: any): boolean => {
  if (!currentUser) return false;
  const role = currentUser.role?.toUpperCase();
  if (role === 'ADMIN') return true;
  if ((role as any) === 'TAMİR' || (role as any) === 'TAMIR') return false;
  if (currentUser.email === 'hursit.akter@demirerholding.com' || role === 'MALZEME_YONETIMI') return false;
  
  const taskPerms = currentUser.allowedTabs?.tasks;
  if (typeof taskPerms === 'object' && taskPerms !== null) {
    if ((taskPerms as any).createTask === false) return false;
    if ((taskPerms as any).createTask === true) return true;
    if ((taskPerms as any).access === true) return true;
  }
  if (taskPerms === true) return true;
  if (Array.isArray(currentUser.allowedTabs) && (currentUser.allowedTabs.includes('tasks') || currentUser.allowedTabs.includes('new-task'))) return true;
  
  if (role === 'TECHNICIAN' || role === 'USER' || !!currentUser.team) return true;
  return false;
};

let activeSiteFilter = 'TÜMÜ';
const storedFilter = localStorage.getItem('tasksActiveSiteFilter');
if (storedFilter) {
  activeSiteFilter = storedFilter;
  localStorage.removeItem('tasksActiveSiteFilter');
}

const renderTasksTable = (tasks: Task[], userRole: string) => {
  const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
  const hasDeleteTaskPerm = checkDeleteTaskPermission(currentUser);
  const hasCompleteTaskPerm = checkCompleteTaskPermission(currentUser);
  const hasTransferTaskPerm = checkTransferTaskPermission(currentUser);
  const hasCreateTaskPerm = checkCreateTaskPermission(currentUser);
  if (tasks.length === 0) {
    return `
      <div style="padding: 4rem; text-align: center; color: var(--text-muted);">
        <i class="fa-solid fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.2;"></i>
        <p>Henüz kayıtlı iş emri bulunamadı.</p>
      </div>
    `;
  }

  // Group tasks by site
  const grouped: Record<string, Task[]> = {};
  tasks.forEach(t => {
    const site = t.siteId || 'Bilinmiyor';
    if (!grouped[site]) grouped[site] = [];
    grouped[site].push(t);
  });

  const siteNames = Object.keys(grouped).sort((a, b) => {
    const nameA = dataService.getAllSites().find(s => s.id === a)?.name || a;
    const nameB = dataService.getAllSites().find(s => s.id === b)?.name || b;
    const indexA = DataService.customOrder.findIndex(o => o.toLowerCase() === nameA.toLowerCase());
    const indexB = DataService.customOrder.findIndex(o => o.toLowerCase() === nameB.toLowerCase());
    if (indexA === -1 && indexB === -1) return nameA.localeCompare(nameB);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  
  const poolTasksList = tasks.filter(t => 
    t.status !== 'Tamamlandı' &&
    Boolean(t.isPoolTask === true || t.personnel === 'HAVUZ' || t.status === 'Havuzda' || t.status === 'Açık Görev')
  );

  // Filter tasks based on active selection
  const filteredTasks = activeSiteFilter === 'TÜMÜ' 
    ? tasks 
    : activeSiteFilter === 'BOLGE_GOREVI'
      ? poolTasksList
      : grouped[activeSiteFilter] || [];

  return `
    <div class="tasks-page-container">
      <!-- Top Filter Navigation -->
      <div class="tasks-filter-sidebar">
        <div class="glass-panel" style="padding: 0.6rem 0.8rem; background: rgba(10, 14, 23, 0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; margin-bottom: 0.2rem;">
          <div class="sidebar-nav" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
             <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
               <div class="task-filter-item ${activeSiteFilter === 'TÜMÜ' ? 'active' : ''}" 
                    onclick="window.handleSiteFilter('TÜMÜ')"
                    style="padding: 6px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; font-size: 0.8rem; font-weight: 600;">
                 <i class="fa-solid fa-layer-group" style="font-size: 0.75rem;"></i>
                 <span>TÜMÜ</span>
                 <span style="font-size: 0.65rem; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 6px; color: rgba(255,255,255,0.5);">${tasks.length}</span>
               </div>

               <div class="task-filter-item ${activeSiteFilter === 'BOLGE_GOREVI' ? 'active' : ''}" 
                    onclick="window.handleSiteFilter('BOLGE_GOREVI')"
                    style="padding: 6px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; font-size: 0.8rem; font-weight: 700; ${activeSiteFilter === 'BOLGE_GOREVI' ? 'background: rgba(245, 158, 11, 0.2) !important; border-color: rgba(245, 158, 11, 0.6) !important; color: #fbbf24 !important;' : 'color: #fbbf24;'}">
                 <i class="fa-solid fa-users-viewfinder" style="font-size: 0.75rem; color: #fbbf24;"></i>
                 <span>BÖLGE GÖREVLERİ</span>
                 <span style="font-size: 0.65rem; background: rgba(245, 158, 11, 0.18); padding: 2px 6px; border-radius: 6px; color: #fbbf24; font-weight: 800;">${poolTasksList.length}</span>
               </div>

               ${siteNames.map(id => {
                  const site = dataService.getAllSites().find(s => s.id === id);
                  const displayName = site ? site.name : id;
                  return `
                  <div class="task-filter-item ${activeSiteFilter === id ? 'active' : ''}" 
                       onclick="window.handleSiteFilter('${id}')"
                       style="padding: 6px 12px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; font-size: 0.8rem; font-weight: 600;">
                    <i class="fa-solid fa-wind" style="font-size: 0.75rem;"></i>
                    <span>${displayName}</span>
                    <span style="font-size: 0.65rem; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 6px; color: rgba(255,255,255,0.5);">${grouped[id].length}</span>
                  </div>
               `}).join('')}
             </div>
          </div>
        </div>
      </div>
        
        <style>
          .tasks-page-container {
            display: flex !important;
            flex-direction: column !important;
            gap: 1.2rem !important;
          }
          .tasks-filter-sidebar {
            width: 100% !important;
            position: relative !important;
            top: 0 !important;
            flex-shrink: 0 !important;
          }
          .sidebar-nav {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 8px !important;
          }
          .task-filter-item {
            background: var(--glass-bg) !important;
            border: 1px solid var(--glass-border) !important;
            color: var(--text-muted) !important;
            border-radius: 20px !important;
            padding: 8px 16px !important;
            font-size: 0.8rem !important;
            font-weight: 600 !important;
            letter-spacing: 0.3px;
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
            border-left: none !important;
          }
          .task-filter-item:hover {
            background: rgba(255, 255, 255, 0.07) !important;
            border-color: var(--glass-border) !important;
            color: var(--text-main) !important;
            transform: translateY(-1px);
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.08);
          }
          .task-filter-item.active { 
            background: linear-gradient(135deg, rgba(20, 241, 149, 0.15), rgba(0, 243, 255, 0.1)) !important;
            border-color: rgba(20, 241, 149, 0.4) !important;
            color: #14f195 !important;
            text-shadow: 0 0 8px rgba(20, 241, 149, 0.3);
            font-weight: 700 !important;
            box-shadow: 0 0 15px rgba(20, 241, 149, 0.15), inset 0 0 8px rgba(20, 241, 149, 0.05);
            transform: translateY(-1px);
            border-left: none !important;
          }
          .task-filter-item span:last-child {
            font-size: 0.7rem !important;
            background: rgba(0, 0, 0, 0.1) !important;
            padding: 2px 8px !important;
            border-radius: 20px !important;
            color: var(--text-muted) !important;
            transition: all 0.3s ease;
            border: 1px solid var(--glass-border);
          }
          .task-filter-item.active span:last-child {
            background: rgba(20, 241, 149, 0.2) !important;
            color: #14f195 !important;
            border-color: rgba(20, 241, 149, 0.25);
          }
          
          /* Tasks table premium styling */
          .tasks-table-panel {
            background: var(--glass-bg) !important;
            backdrop-filter: blur(20px) !important;
            border: 1px solid var(--glass-border) !important;
            border-radius: 16px !important;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05), inset 0 1px 0 var(--glass-border);
          }
          .tasks-table-panel table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 0.85rem;
          }
          .tasks-table-panel thead tr {
            background: linear-gradient(90deg, rgba(20, 241, 149, 0.02), rgba(0, 243, 255, 0.02)) !important;
          }
          .tasks-table-panel th {
            padding: 10px 10px !important;
            font-weight: 800;
            color: var(--text-muted);
            border-bottom: 1px solid var(--glass-border) !important;
            vertical-align: middle !important;
            text-transform: uppercase;
            font-size: 0.68rem;
            letter-spacing: 1.2px;
            font-family: 'Rajdhani', sans-serif;
          }
          .tasks-table-panel th i {
            margin-right: 6px;
            font-size: 0.72rem;
            color: #00f3ff;
            opacity: 0.8;
            text-shadow: 0 0 8px rgba(0,243,255,0.4);
          }
          .tasks-table-panel td {
            padding: 10px 10px !important;
            vertical-align: middle !important;
            border-bottom: 1px solid var(--glass-border) !important;
            transition: all 0.3s ease;
          }
          .tasks-table-scroll-container {
            overflow-x: auto;
            width: 100%;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .tasks-table-scroll-container::-webkit-scrollbar {
            display: none;
          }
          .tasks-table-panel tr:last-child td {
            border-bottom: none !important;
          }
          .tasks-table-panel tbody tr {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            background: transparent;
          }
          .tasks-table-panel tbody tr:hover {
            background: rgba(0, 243, 255, 0.02) !important;
            box-shadow: inset 4px 0 0 #00f3ff, 0 4px 20px rgba(0, 243, 255, 0.04) !important;
          }
          
          /* Row entrance animation */
          @keyframes taskRowIn {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .tasks-table-panel tbody tr {
            animation: taskRowIn 0.4s ease-out backwards;
          }
          .tasks-table-panel tbody tr:nth-child(1) { animation-delay: 0.03s; }
          .tasks-table-panel tbody tr:nth-child(2) { animation-delay: 0.06s; }
          .tasks-table-panel tbody tr:nth-child(3) { animation-delay: 0.09s; }
          .tasks-table-panel tbody tr:nth-child(4) { animation-delay: 0.12s; }
          .tasks-table-panel tbody tr:nth-child(5) { animation-delay: 0.15s; }
          .tasks-table-panel tbody tr:nth-child(6) { animation-delay: 0.18s; }
          .tasks-table-panel tbody tr:nth-child(7) { animation-delay: 0.21s; }
          .tasks-table-panel tbody tr:nth-child(8) { animation-delay: 0.24s; }

          /* Status Dot */
          .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            margin-right: 8px;
            display: inline-block;
          }
          .status-dot.green { background: #14f195; box-shadow: 0 0 6px rgba(20, 241, 149, 0.6); }
          .status-dot.orange { background: #ffaa00; box-shadow: 0 0 6px rgba(255, 170, 0, 0.6); }
          .status-dot.purple { background: #d4a0ff; box-shadow: 0 0 6px rgba(212, 160, 255, 0.6); }
          .status-dot.blue { background: #00f3ff; box-shadow: 0 0 6px rgba(0, 243, 255, 0.6); }
          .status-dot.gray { background: rgba(255,255,255,0.45); }

          /* Custom status badge */
          .status-badge {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 0 10px !important;
            border-radius: 4px !important;
            font-size: 0.62rem !important;
            font-weight: 700 !important;
            text-transform: uppercase;
            white-space: nowrap !important;
            letter-spacing: 0.5px;
            height: 24px !important;
            min-height: 24px !important;
            max-height: 24px !important;
            line-height: 24px !important;
            box-sizing: border-box;
            transition: all 0.3s ease;
          }
          .status-badge:hover {
            transform: scale(1.03);
          }
          .status-badge.delivered {
            background: rgba(20, 241, 149, 0.08) !important;
            color: #14f195 !important;
            border: 1px solid rgba(20, 241, 149, 0.25) !important;
            box-shadow: 0 0 12px rgba(20, 241, 149, 0.08) !important;
          }
          .status-badge.hold-weather-badge {
            background: rgba(255, 170, 0, 0.08) !important;
            color: #ffb74d !important;
            border: 1px solid rgba(255, 170, 0, 0.2) !important;
            box-shadow: 0 0 10px rgba(255, 170, 0, 0.05) !important;
          }
          .status-badge.returned-badge {
            background: rgba(155, 89, 182, 0.12) !important;
            color: #d4a0ff !important;
            border: 1px solid rgba(155, 89, 182, 0.25) !important;
            box-shadow: 0 0 12px rgba(155, 89, 182, 0.06) !important;
          }
          .status-badge.created {
            background: rgba(255, 170, 0, 0.06) !important;
            color: #ffb74d !important;
            border: 1px solid rgba(255, 170, 0, 0.2) !important;
          }
          .status-badge.completed {
            background: rgba(255, 255, 255, 0.02) !important;
            color: rgba(255, 255, 255, 0.45) !important;
            border: 1px solid rgba(255, 255, 255, 0.08) !important;
          }

          /* Turbine ID badge */
          .turbine-id-badge {
            font-family: 'Rajdhani', sans-serif;
            font-weight: 800;
            color: #64ffda;
            font-size: 0.82rem;
            letter-spacing: 0.5px;
            background: rgba(100, 255, 218, 0.05);
            border: 1px solid rgba(100, 255, 218, 0.15);
            padding: 2px 8px;
            border-radius: 6px;
            display: inline-block;
            box-shadow: 0 0 8px rgba(100, 255, 218, 0.04);
            transition: all 0.25s ease;
          }
          .turbine-id-badge:hover {
            background: rgba(100, 255, 218, 0.1) !important;
            border-color: rgba(100, 255, 218, 0.35) !important;
            box-shadow: 0 0 10px rgba(100, 255, 218, 0.1) !important;
            transform: scale(1.02);
          }

          /* Custom task type badge */
          .task-type-badge {
            display: inline-flex !important;
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            padding: 6px 12px !important;
            border-radius: 8px !important;
            box-sizing: border-box;
            transition: all 0.3s ease;
            background: rgba(255, 255, 255, 0.01) !important;
            border: 1px solid rgba(255, 255, 255, 0.05) !important;
            max-width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }
          .task-type-badge.maintenance {
            background: linear-gradient(135deg, rgba(0, 243, 255, 0.04), rgba(0, 243, 255, 0.01)) !important;
            border: 1px solid rgba(0, 243, 255, 0.12) !important;
            color: #00f3ff !important;
          }
          .task-type-badge.maintenance:hover {
            border-color: rgba(0, 243, 255, 0.3) !important;
            box-shadow: 0 0 10px rgba(0, 243, 255, 0.08);
          }
          .task-type-badge.fault {
            background: linear-gradient(135deg, rgba(255, 77, 77, 0.04), rgba(255, 77, 77, 0.01)) !important;
            border: 1px solid rgba(255, 77, 77, 0.15) !important;
            color: #ff4d4d !important;
          }
          .task-type-badge.fault:hover {
            border-color: rgba(255, 77, 77, 0.3) !important;
            box-shadow: 0 0 10px rgba(255, 77, 77, 0.08);
          }
          .task-type-badge.returned {
            background: linear-gradient(135deg, rgba(155, 89, 182, 0.05), rgba(155, 89, 182, 0.02)) !important;
            color: #b37feb !important;
            border: 1px solid rgba(155, 89, 182, 0.12) !important;
          }
          .task-type-badge.returned:hover {
            border-color: rgba(155, 89, 182, 0.3) !important;
            box-shadow: 0 0 10px rgba(155, 89, 182, 0.08);
          }

          /* Unify action buttons */
          .action-btn-container {
            display: inline-flex !important;
            gap: 6px !important;
            justify-content: flex-end !important;
            align-items: center !important;
            width: 100%;
          }
          
          .action-btn-main {
            height: 24px !important;
            min-height: 24px !important;
            max-height: 24px !important;
            line-height: 24px !important;
            padding: 0 10px !important;
            font-size: 0.62rem !important;
            font-weight: 700 !important;
            border-radius: 4px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            white-space: nowrap !important;
            border: none !important;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            position: relative;
            overflow: hidden;
            flex-shrink: 0 !important;
          }
          .action-btn-main::after {
            content: '';
            position: absolute;
            top: 0; left: -100%;
            width: 100%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
            transition: left 0.5s ease;
          }
          .action-btn-main:hover::after {
            left: 100%;
          }
          
          .action-btn-main.fill-form {
            background: rgba(20, 241, 149, 0.08) !important;
            color: #14f195 !important;
            border: 1px solid rgba(20, 241, 149, 0.25) !important;
            box-shadow: none !important;
          }
          .action-btn-main.fill-form:hover {
            background: rgba(20, 241, 149, 0.16) !important;
            border-color: rgba(20, 241, 149, 0.45) !important;
            box-shadow: 0 0 12px rgba(20, 241, 149, 0.15) !important;
            transform: translateY(-1px);
          }

          .action-btn-main.edit-returned {
            background: rgba(168, 85, 247, 0.08) !important;
            color: #c084fc !important;
            border: 1px solid rgba(168, 85, 247, 0.25) !important;
            box-shadow: none !important;
          }
          .action-btn-main.edit-returned:hover {
            background: rgba(168, 85, 247, 0.16) !important;
            border-color: rgba(168, 85, 247, 0.45) !important;
            box-shadow: 0 0 12px rgba(168, 85, 247, 0.15) !important;
            transform: translateY(-1px);
          }

          .action-btn-main.detail-btn {
            background: rgba(255, 255, 255, 0.03) !important;
            color: rgba(255,255,255,0.6) !important;
            border: 1px solid rgba(255,255,255,0.08) !important;
          }
          .action-btn-main.detail-btn:hover {
            background: rgba(255, 255, 255, 0.06) !important;
            border-color: rgba(255,255,255,0.15) !important;
            color: #fff !important;
          }

          .action-btn-main.transfer-btn {
            background: rgba(0, 114, 255, 0.06) !important;
            color: #5b9aff !important;
            border: 1px solid rgba(0, 114, 255, 0.18) !important;
          }
          .action-btn-main.transfer-btn:hover {
            background: rgba(0, 114, 255, 0.12) !important;
            border-color: rgba(0, 114, 255, 0.35) !important;
            box-shadow: 0 0 12px rgba(0, 114, 255, 0.1) !important;
            transform: translateY(-1px);
          }

          .action-btn-delete {
            width: 24px !important;
            height: 24px !important;
            min-width: 24px !important;
            min-height: 24px !important;
            max-height: 24px !important;
            line-height: 24px !important;
            padding: 0 !important;
            background: rgba(255, 82, 82, 0.06) !important;
            color: #ff6b6b !important;
            border: 1px solid rgba(255, 82, 82, 0.12) !important;
            border-radius: 4px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer;
            box-sizing: border-box !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            flex-shrink: 0 !important;
          }
          .action-btn-delete:hover {
            background: rgba(255, 82, 82, 0.14) !important;
            border-color: rgba(255, 82, 82, 0.35) !important;
            color: #ff4444 !important;
            transform: translateY(-1px);
            box-shadow: 0 0 10px rgba(255, 82, 82, 0.1) !important;
          }

          .no-permission-badge {
            font-size: 0.62rem !important;
            color: rgba(255,255,255,0.3) !important;
            font-weight: 700 !important;
            height: 24px !important;
            min-height: 24px !important;
            max-height: 24px !important;
            line-height: 24px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }

          /* Date cell styling */
          .task-date-cell {
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .task-date-icon {
            width: 26px; height: 26px;
            background: rgba(100, 255, 218, 0.05);
            border: 1px solid rgba(100, 255, 218, 0.08);
            border-radius: 6px;
            display: flex; align-items: center; justify-content: center;
            font-size: 0.65rem; color: #64ffda;
          }
          .task-date-text {
            font-weight: 700; color: var(--text-main); opacity: 0.85; font-size: 0.76rem;
            font-variant-numeric: tabular-nums;
          }

          /* Team badge */
          .team-badge {
            display: inline-flex; align-items: center; justify-content: center; gap: 6px;
            background: rgba(0, 243, 255, 0.04);
            border: 1px solid rgba(0, 243, 255, 0.1);
            padding: 4px 10px; border-radius: 6px;
            font-weight: 700; font-size: 0.72rem;
            color: rgba(0, 243, 255, 0.85);
            white-space: nowrap;
            transition: all 0.25s ease;
          }
          .team-badge:hover {
            background: rgba(0, 243, 255, 0.08);
            border-color: rgba(0, 243, 255, 0.25);
            transform: translateY(-1px);
          }
          .team-badge i { color: var(--accent-cyan); font-size: 0.6rem; }
        </style>
      </div>

      <!-- Main Content Area -->
      <div class="tasks-table-container">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, rgba(100, 255, 218, 0.12), rgba(0, 114, 255, 0.12)); border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(100, 255, 218, 0.15);">
              <i class="fa-solid fa-clipboard-list" style="color: #64ffda; font-size: 1rem;"></i>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.15rem; color: var(--text-main); font-weight: 800; letter-spacing: 0.3px;">
                ${activeSiteFilter === 'TÜMÜ' ? 'Tüm İş Emirleri' : (activeSiteFilter === 'BOLGE_GOREVI' ? '🌐 Bölge Ortak Görevleri' : (dataService.getAllSites().find(s => s.id === activeSiteFilter)?.name || activeSiteFilter))}
              </h2>
              <p style="margin: 2px 0 0 0; font-size: 0.7rem; color: var(--text-muted); opacity: 0.8; font-weight: 600; letter-spacing: 0.5px;">AKTİF GÖREVLER & İŞ EMİRLERİ</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: #64ffda; font-weight: 800; background: rgba(100, 255, 218, 0.06); padding: 8px 16px; border-radius: 12px; border: 1px solid rgba(100, 255, 218, 0.12); letter-spacing: 0.5px;">
            <i class="fa-solid fa-database" style="font-size: 0.65rem; opacity: 0.7;"></i>
            ${filteredTasks.length} KAYIT
          </div>
        </div>

        <div class="glass-panel tasks-table-panel">
          <div class="tasks-table-scroll-container">
            <table style="table-layout: auto; width: 100%; border-collapse: collapse;">
              <thead>
                <tr>
                  <th style="width: 95px; min-width: 90px; text-align: left;">TARİH</th>
                  <th style="width: 175px; min-width: 165px; text-align: left; white-space: nowrap;">SAHA / TÜRBİN</th>
                  <th style="width: 95px; min-width: 90px; text-align: center; padding-left: 0 !important; padding-right: 0 !important;">EKİP</th>
                  <th style="min-width: 200px; text-align: left;">GÖREV TÜRÜ</th>
                  <th style="width: 155px; min-width: 145px; text-align: center; padding-left: 0 !important; padding-right: 0 !important;">DURUM</th>
                  <th style="width: 125px; min-width: 115px; text-align: center; padding-left: 0 !important; padding-right: 0 !important;">AKSİYON</th>
                </tr>
              </thead>
              <tbody>
                ${filteredTasks.map(task => {
                  const isReturned = (task as any).isReturnedReport;
                  const isHoldWeather = task.status === 'HOLD_WEATHER';
                  const isFault = (task.rawFaultCode && task.rawFaultCode !== '---');
                  const isPool = Boolean(task.isPoolTask || task.personnel === 'Atanmadı' || task.personnel === 'HAVUZ' || task.status === 'Havuzda' || task.status === 'Açık Görev');
                  const statusClass = isReturned ? 'returned-badge' : (task.status === 'Görev Teslim Edildi' ? 'delivered' : isHoldWeather ? 'hold-weather-badge' : (task.status === 'Tamamlandı' ? 'completed' : (isPool ? 'hold-weather-badge' : 'created')));
                  const isTransferable = task.status !== 'Tamamlandı' && hasTransferTaskPerm;
                  
                  let displayDate = '...';
                  if (task.createdAt) {
                    if (task.createdAt.toDate) {
                      displayDate = task.createdAt.toDate().toLocaleDateString('tr-TR');
                    } else if (typeof task.createdAt === 'string') {
                      if (task.createdAt.includes('-')) {
                        const parts = task.createdAt.split('T')[0].split('-');
                        if (parts.length === 3 && parts[0].length === 4) {
                          displayDate = `${parts[2]}.${parts[1]}.${parts[0]}`;
                        } else {
                          displayDate = task.createdAt;
                        }
                      } else {
                        displayDate = task.createdAt;
                      }
                    }
                  }
                  
                  const rawSiteName = dataService.getAllSites().find(s => s.id === task.siteId || s.name === task.siteId)?.name || task.siteId;
                  const siteNameTitle = formatSiteNameTitle(rawSiteName);
                  
                  const turbines = dataService.getTurbinesBySite(task.siteId);
                  const turbine = turbines.find(t => 
                    t.label === task.turbineId || 
                    `T-${t.no}` === task.turbineId || 
                    `T${t.no}` === task.turbineId || 
                    `T${String(t.no).padStart(2, '0')}` === task.turbineId || 
                    `T-${String(t.no).padStart(2, '0')}` === task.turbineId
                  );
                  const serial = turbine ? turbine.id : '';

                  return `
                  <tr style="${isReturned ? 'background: rgba(155, 89, 182, 0.03);' : ''} ${isTransferable ? 'cursor: grab;' : ''}"
                      ${isTransferable ? `draggable="true" ondragstart="window.handleTaskDragStart(event, '${task.id}')" ondragend="window.handleTaskDragEnd(event)"` : ''}>
                    <td>
                      <div class="task-date-cell">
                        <div class="task-date-icon"><i class="fa-regular fa-calendar-check"></i></div>
                        <span class="task-date-text">${displayDate}</span>
                      </div>
                    </td>
                    <td>
                        <div class="site-turbine-cell" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; white-space: nowrap;">
                          <span class="site-name-text" style="font-weight: 700; color: var(--text-main); font-size: 0.8rem; white-space: nowrap;">
                            ${task.taskLocationType === 'WAREHOUSE' ? siteNameTitle.replace(/\s*Depo\s*$/i, '') : siteNameTitle}
                          </span>
                          <div class="turbine-info-col" style="display: inline-flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 2px; width: 52px; flex-shrink: 0; margin-left: auto;">
                            ${task.taskLocationType === 'WAREHOUSE' ? `
                              <span class="turbine-id-badge" style="background: rgba(0, 243, 255, 0.08); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.25); font-size: 0.65rem; padding: 1px 6px; text-align: center; width: 100%; box-sizing: border-box;">
                                <i class="fa-solid fa-warehouse"></i> Depo
                              </span>
                            ` : `
                              <span class="turbine-id-badge" style="margin: 0; font-size: 0.68rem; padding: 1px 6px; flex-shrink: 0; line-height: 1; text-align: center; min-width: 40px; box-sizing: border-box;">${task.turbineId}</span>
                              ${serial ? `<span style="font-size: 0.6rem; color: var(--text-muted); font-family: monospace; font-weight: 600; line-height: 1; opacity: 0.85; text-align: center; width: 100%;">${serial}</span>` : ''}
                            `}
                          </div>
                        </div>
                    </td>
                    <td style="text-align: center; padding-left: 0 !important; padding-right: 0 !important;">
                      <div style="display: flex; justify-content: center; align-items: center; width: 100%;">
                        ${isPool ? `
                          <span class="team-badge" title="Bölge Ortak Görevi (Ekip Atanmamış)" style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.35); color: #fbbf24; font-weight: 800; font-size: 0.7rem; padding: 4px 10px; white-space: nowrap; justify-content: center; margin: 0 auto;">
                            <i class="fa-solid fa-users-viewfinder" style="color: #fbbf24; font-size: 0.65rem;"></i>
                            Bölge Görevi
                          </span>
                        ` : `
                          <span class="team-badge" style="justify-content: center; margin: 0 auto;">
                            <i class="fa-solid fa-user-group"></i>
                            ${formatTeamName(task.personnel)}
                          </span>
                        `}
                      </div>
                    </td>
                    <td>
                        <div class="task-type-badge ${isReturned ? 'returned' : (isFault ? 'fault' : (task.taskLocationType === 'WAREHOUSE' ? 'maintenance' : 'maintenance'))}">
                          ${isFault ? `
                            <div style="display: flex; align-items: center; gap: 8px; white-space: nowrap; min-width: 0; overflow: hidden; text-overflow: ellipsis; width: 100%;">
                              <i class="fa-solid fa-triangle-exclamation" style="color: #ff4d4d; font-size: 0.82rem; text-shadow: 0 0 8px rgba(255,77,77,0.4); flex-shrink: 0;"></i>
                              <span style="font-weight: 900; font-size: 0.76rem; color: #ff6b6b; letter-spacing: 0.3px; flex-shrink: 0;">${task.rawFaultCode}</span>
                              <span style="color: var(--text-muted); opacity: 0.4; font-size: 0.72rem; flex-shrink: 0;">|</span>
                              <span style="font-weight: 700; font-size: 0.74rem; color: var(--text-main); opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px;" title="${task.faultCode.replace(task.rawFaultCode + ' - ', '')}">${task.faultCode.replace(task.rawFaultCode + ' - ', '')}</span>
                            </div>
                          ` : `
                            <div style="display: flex; align-items: center; gap: 8px; white-space: nowrap; min-width: 0; overflow: hidden; text-overflow: ellipsis; width: 100%;">
                              <i class="fa-solid ${isReturned ? 'fa-rotate-left' : 'fa-wrench'}" style="color: ${isReturned ? '#b37feb' : '#00f3ff'}; font-size: 0.82rem; text-shadow: 0 0 8px ${isReturned ? 'rgba(179,127,235,0.4)' : 'rgba(0,243,255,0.4)'}; flex-shrink: 0;"></i>
                              <span style="font-weight: 700; font-size: 0.76rem; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0;">${cleanSablonName(task.secilenSablon || task.faultCode)}</span>
                              ${task.repairedMaterial?.description ? `
                                <span style="color: var(--text-muted); opacity: 0.4; font-size: 0.72rem; flex-shrink: 0;">|</span>
                                <span style="font-weight: 700; font-size: 0.74rem; color: #fff; opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 280px;"><i class="fa-solid fa-cube"></i> ${task.repairedMaterial.description} (${task.repairedMaterial.quantity || 1} Ad.)</span>
                              ` : (task.yoneticiNotu && (!task.yoneticiNotu.startsWith('Sistemden atanan') || task.secilenSablon?.includes('Planlı')) ? `
                                <span style="color: var(--text-muted); opacity: 0.4; font-size: 0.72rem; flex-shrink: 0;">|</span>
                                <span style="font-weight: 700; font-size: 0.74rem; color: var(--text-main); opacity: 0.85; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 320px;" title="${task.yoneticiNotu}">${task.yoneticiNotu}</span>
                              ` : '')}
                            </div>
                          `}
                        </div>
                    </td>
                    <td style="text-align: center; padding: 10px 8px !important;">
                      <span class="status-badge ${statusClass}">
                        ${isReturned 
                          ? '<span class="status-dot purple"></span> DÜZELTME BEKLİYOR' 
                          : isHoldWeather 
                            ? '<span class="status-dot orange"></span> YILDIRIM ENGELLİ' 
                            : isPool
                              ? '<span class="status-dot orange" style="background: #fbbf24; box-shadow: 0 0 6px rgba(251, 191, 36, 0.8);"></span> AÇIK GÖREV'
                              : (task.status === 'Görev Teslim Edildi' 
                                ? '<span class="status-dot green"></span> GÖREV TESLİM EDİLDİ' 
                                : (task.status === 'Tamamlandı' 
                                  ? '<span class="status-dot gray"></span> TAMAMLANDI' 
                                  : `<span class="status-dot orange"></span> ${task.status.toUpperCase()}`))}
                      </span>
                    </td>
                    <td style="text-align: center; padding: 10px 8px !important;">
                       <div class="action-btn-container" style="justify-content: center !important;">
                         ${task.status === 'Tamamlandı' ? `
                           <button class="action-btn-main detail-btn" onclick="alert('Bu görev tamamlanmıştır.')"><i class="fa-solid fa-eye" style="margin-right: 5px; font-size: 0.65rem;"></i> DETAY</button>
                         ` : isPool ? `
                           <button class="action-btn-main claim-task-btn" style="background: linear-gradient(135deg, #f59e0b, #d97706) !important; color: #000 !important; font-weight: 800 !important; border: none !important; box-shadow: 0 0 14px rgba(245, 158, 11, 0.35) !important;" onclick="window.handleClaimTaskInTasks('${task.id}', '${siteNameTitle}', '${task.turbineId}')">
                             <i class="fa-solid fa-hand-holding-hand" style="margin-right: 5px; font-size: 0.75rem;"></i>
                             GÖREVİ ÜSTLEN
                           </button>
                         ` : hasCompleteTaskPerm ? `
                           <button class="action-btn-main ${isReturned ? 'edit-returned' : 'fill-form'}" onclick="${isReturned ? `window.editReturnedReport('${(task as any).originalReportNo}')` : `window.handleStartTask('${task.id}')`}">
                             <i class="fa-solid ${isReturned ? 'fa-pen' : 'fa-file-pen'}" style="margin-right: 5px; font-size: 0.65rem;"></i>
                             ${isReturned ? 'DÜZELTME YAP' : 'FORMU DOLDUR'}
                           </button>
                         ` : `
                           <span class="no-permission-badge"><i class="fa-solid fa-lock" style="margin-right: 4px; font-size: 0.6rem;"></i> YETKİ YOK</span>
                         `}

                         ${hasDeleteTaskPerm ? `
                           <button class="action-btn-delete" onclick="${isReturned ? `window.handleReturnedReportDelete('${task.id}')` : `window.handleTaskDelete('${task.id}')`}" title="Sil">
                             <i class="fa-solid fa-trash-can" style="font-size: 0.7rem;"></i>
                           </button>
                         ` : ''}
                       </div>
                    </td>
                  </tr>
                `}).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `;
};

export const TasksPage = async () => {
  let userRole = 'GUEST';
  let lastTasks: Task[] = [];
  
  try {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      const profile: any = await userService.getProfile(currentUser.uid);
      if (profile) {
        userRole = (profile.role || 'GUEST').toUpperCase();
        (window as any).currentUserTeam = profile.team || currentUser.email?.split('@')[0].toUpperCase();
      }
    }
  } catch (error) {
    console.error("User role fetch error:", error);
  }

  // Window handles for events
  (window as any).handleSiteFilter = (siteName: string) => {
    activeSiteFilter = siteName;
    const container = document.getElementById('tasks-realtime-container');
    if (container && lastTasks.length > 0) {
      container.innerHTML = renderTasksTable(lastTasks, userRole);
    }
  };

  (window as any).handleClaimTaskInTasks = async (taskId: string, siteName: string, turbineId: string) => {
    const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
    let userTeam = (window as any).currentUserTeam || currentUser?.team || '';
    if (userTeam && !userTeam.toLowerCase().startsWith('team')) {
      userTeam = formatTeamName(userTeam);
    }

    const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN' || !userTeam || userTeam === 'Admin';
    if (isAdmin) {
      const selected = prompt(`Bu görevi hangi ekip adına üstlenmek istiyorsunuz? (Örn: Team 15):`, userTeam || 'Team 15');
      if (!selected) return;
      userTeam = selected.trim();
    } else {
      const ok = confirm(`"${siteName} - ${turbineId}" türbinindeki havuz görevini "${userTeam}" adına üstlenmek ve işleme almak istiyor musunuz?`);
      if (!ok) return;
    }

    try {
      const userEmail = currentUser?.email || auth?.currentUser?.email || (window as any).currentUser?.email || 'Bilinmiyor';
      await taskService.claimTask(taskId, userTeam, userEmail);
      try {
        const { notificationService } = await import('../services/NotificationService');
        notificationService.playNotificationSound('celebration');
      } catch (_) {}

      if ((window as any).showToast) {
        (window as any).showToast('GÖREV ÜSTLENİLDİ', `Görev ${userTeam} adına başarıyla üstlenildi.`, 'success');
      } else {
        alert(`Görev ${userTeam} adına başarıyla üstlenildi.`);
      }

      const startNow = confirm(`Görev ${userTeam} adına üstlenildi! Hemen formu doldurmaya başlamak istiyor musunuz?`);
      if (startNow && (window as any).handleStartTask) {
        (window as any).handleStartTask(taskId);
      }
    } catch (err: any) {
      console.error('Görev üstlenme hatası:', err);
      alert('Görev üstlenilirken hata oluştu: ' + (err.message || ''));
    }
  };

  (window as any).handleReleaseTaskToPool = async (taskId: string) => {
    const ok = confirm('Bu görevi kendi ekibinizden çıkarıp tekrar Bölge Ortak Havuzuna bırakmak istediğinize emin misiniz?');
    if (!ok) return;
    try {
      await taskService.releaseTaskToPool(taskId);
      try {
        const { notificationService } = await import('../services/NotificationService');
        notificationService.playNotificationSound('info');
      } catch (_) {}

      if ((window as any).showToast) {
        (window as any).showToast('HAVUZA BIRAKILDI', 'Görev başarıyla tekrar bölge havuzuna bırakıldı.', 'info');
      } else {
        alert('Görev tekrar bölge havuzuna bırakıldı.');
      }
    } catch (err: any) {
      console.error('Havuza bırakma hatası:', err);
      alert('Hata: ' + (err.message || ''));
    }
  };

  (window as any).handleTaskDragStart = (event: DragEvent, taskId: string) => {
    event.dataTransfer?.setData('text/plain', taskId);
    (window as any).draggedTaskId = taskId;

    const tr = event.currentTarget as HTMLElement;
    tr.classList.add('task-dragging');

    let drawer = document.getElementById('quick-transfer-drawer');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'quick-transfer-drawer';
      drawer.className = 'quick-transfer-drawer glass-panel';
      drawer.style.cssText = `
        position: fixed;
        top: 0;
        right: -340px;
        width: 320px;
        height: 100vh;
        background: rgba(10, 14, 23, 0.92);
        border-left: 1px solid rgba(20, 241, 149, 0.25);
        box-shadow: -10px 0 30px rgba(0, 0, 0, 0.6);
        z-index: 999999;
        backdrop-filter: blur(16px);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      `;

      drawer.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.8rem; color: #14f195;">
          <i class="fa-solid fa-people-arrows" style="font-size: 1.4rem; text-shadow: 0 0 10px rgba(20,241,149,0.3);"></i>
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; margin: 0; font-weight: 800; letter-spacing: 1px;">HIZLI GÖREV DEVRETME</h3>
        </div>
        <p style="font-size: 0.72rem; color: var(--text-muted); margin: 0 0 1.25rem 0; line-height: 1.4;">
          İş emrini devretmek istediğiniz ekibin üzerine sürükleyip bırakın.
        </p>
        
        <div class="team-drop-targets-container" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
          ${(() => {
            const normalizeTeamName = (name: string): string => {
              if (!name) return '';
              const match = name.match(/\d+/);
              if (match) {
                const num = String(parseInt(match[0], 10)).padStart(2, '0');
                return `Team ${num}`;
              }
              return name.trim();
            };

            const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
            const normalizedUserTeam = normalizeTeamName((window as any).currentUserTeam || currentUser?.team || '');
            const managedTeams = (currentUser?.managedTeams || []).map((t: string) => normalizeTeamName(t)).filter(Boolean);

            const connectedTeams = new Set<string>();
            if (normalizedUserTeam) connectedTeams.add(normalizedUserTeam);
            managedTeams.forEach((t: string) => connectedTeams.add(t));

            const allTeams = Array.from({length: 15}, (_, i) => `Team ${String(i + 1).padStart(2, '0')}`);
            
            let filteredTeams = allTeams;
            if (userRole !== 'ADMIN' && userRole !== 'USER') {
              if (connectedTeams.size > 0) {
                filteredTeams = allTeams.filter((t: string) => connectedTeams.has(t));
              }
            }

            return filteredTeams.map(teamName => `
              <div class="team-drop-target" 
                   ondragover="event.preventDefault(); this.classList.add('drag-over')" 
                   ondragleave="this.classList.remove('drag-over')"
                   ondrop="window.handleTaskDrop(event, '${teamName}')"
                   style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; font-weight: 800; font-family: 'Rajdhani'; font-size: 0.88rem; text-align: center; color: #fff; cursor: pointer; transition: all 0.2s;">
                <i class="fa-solid fa-users" style="margin-right: 6px; font-size: 0.75rem; color: #5b9aff;"></i> ${teamName} Ekibi
              </div>
            `).join('');
          })()}
        </div>
        
        <style>
          .team-drop-target.drag-over {
            background: rgba(20, 241, 149, 0.08) !important;
            border-color: #14f195 !important;
            border-style: solid !important;
            color: #14f195 !important;
            box-shadow: 0 0 15px rgba(20, 241, 149, 0.2);
            transform: scale(1.02);
          }
          .task-dragging {
            opacity: 0.45;
            background: rgba(20, 241, 149, 0.05) !important;
            border: 1px dashed #14f195 !important;
          }
        </style>
      `;
      document.body.appendChild(drawer);
    }

    setTimeout(() => {
      if (drawer) drawer.style.right = '0';
    }, 10);
  };

  (window as any).handleTaskDragEnd = (event: DragEvent) => {
    const tr = event.currentTarget as HTMLElement;
    tr.classList.remove('task-dragging');

    const drawer = document.getElementById('quick-transfer-drawer');
    if (drawer) {
      drawer.style.right = '-340px';
      setTimeout(() => {
        drawer.remove();
      }, 300);
    }
  };

  (window as any).handleTaskDrop = async (event: DragEvent, targetTeam: string) => {
    event.preventDefault();
    const taskId = (window as any).draggedTaskId || event.dataTransfer?.getData('text/plain');
    if (!taskId) return;

    document.querySelectorAll('.team-drop-target').forEach(el => el.classList.remove('drag-over'));

    const task = (window as any).lastTasksForNavigation?.find((t: any) => t.id === taskId);
    if (!task) return;

    const confirmed = confirm(`${task.turbineId} türbinindeki iş emrini ${targetTeam} ekibine devretmek istediğinizden emin misiniz?`);
    if (!confirmed) return;

    try {
      if (task.isReturnedReport) {
        // Returned reports are in the 'serviceReports' collection
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../firebase');
        const reportRef = doc(db, 'serviceReports', task.id);
        
        let reportTeam = targetTeam;
        if (targetTeam.toLowerCase().startsWith('team')) {
          const num = parseInt(targetTeam.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(num)) {
            reportTeam = `TEAM ${num}`;
          }
        }

        await updateDoc(reportRef, {
          team: reportTeam
        });
        
        (window as any).showToast?.('BAŞARILI', `Rapor ${targetTeam} ekibine devredildi.`, 'success');
      } else {
        const updates: any = { 
          'assignment.assignedTeam': targetTeam,
          personnel: targetTeam 
        };

        if (task.maintenanceData) {
          const mData = { ...task.maintenanceData };
          if (mData.workSessions && Array.isArray(mData.workSessions)) {
            mData.workSessions = mData.workSessions.map((ws: any) => {
              const prevTeam = mData.teamPersonnel && mData.teamPersonnel.length > 0 ? mData.teamPersonnel : [];
              return {
                ...ws,
                personnel: ws.personnel && ws.personnel.length > 0 ? ws.personnel : prevTeam,
                locked: true
              };
            });
          }
          mData.teamPersonnel = [];
          updates.maintenanceData = mData;
        }

        const { taskService } = await import('../services/TaskService');
        await taskService.updateTask(task.id, updates);
        
        (window as any).showToast?.('BAŞARILI', `İş emri ${targetTeam} ekibine devredildi.`, 'success');
      }
    } catch (error: any) {
      console.error("Transfer hatası:", error);
      alert("Görev transfer edilirken bir hata oluştu: " + error.message);
    }
  };

  // Real-time subscription setup
  // Dual Subscription setup
  let allTasks: any[] = [];
  let returnedReports: any[] = [];

  const updateDisplay = () => {
    // Combine and sort
    const combined = [...allTasks, ...returnedReports];
    const finalTasks = combined.filter(t => {
      const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
      
      // Adminler ve Ofis Kullanıcıları her zaman görünür olsun
      if (userRole === 'ADMIN' || userRole === 'USER') return true;

      const userTeam = (window as any).currentUserTeam || '';
      const managedTeams = (currentUser?.managedTeams || []).map((mt: string) => mt.toUpperCase().trim());
      const taskPersonnel = String(t.personnel || '').toUpperCase().trim();
      const searchTeam = userTeam.toUpperCase().trim();

      const taskNum = taskPersonnel.replace(/[^0-9]/g, '');
      const userNum = searchTeam.replace(/[^0-9]/g, '');

      const isDaresShared = taskNum && userNum && (
        (parseInt(taskNum) === 5 && parseInt(userNum) === 10) ||
        (parseInt(taskNum) === 10 && parseInt(userNum) === 5)
      );

      // Kendi ekibi veya yönettiği ekiplerden biri mi?
      const isMyTeamTask = (taskNum && userNum && parseInt(taskNum) === parseInt(userNum)) || 
                           isDaresShared ||
                           taskPersonnel.includes(searchTeam) || 
                           searchTeam.includes(taskPersonnel) || 
                           managedTeams.some((mt: string) => taskPersonnel.includes(mt));

      // 1. Ekibe veya yönetilen alt ekiplere atanmış görevleri her zaman göster
      if (isMyTeamTask) return true;
      
      // 2. Kendi yetkili olduğu sahadaki (allowedSites) TÜM iş emirlerini göster (diğer ekiplerin açtığı görevler görünsün ki mükerrer görev açılmasın)
      const allowedSites = dataService.getSites().map(s => s.id);
      let tSiteId = t.siteId || '';
      if (tSiteId && isNaN(Number(tSiteId))) {
        const siteObj = dataService.getAllSites().find(s => s.name.toLowerCase() === tSiteId.toLowerCase() || s.name.toLowerCase().includes(tSiteId.toLowerCase()));
        if (siteObj) tSiteId = siteObj.id;
      }
      if ((!tSiteId || tSiteId === 'Bilinmiyor') && t.turbinSeriNo) {
        const turbInfo = dataService.findTurbineBySerial(t.turbinSeriNo);
        if (turbInfo) tSiteId = turbInfo.siteId;
      }
      if (allowedSites.includes(tSiteId)) return true;

      if (!userTeam && managedTeams.length === 0) return true;

      return false;
    });

    const sorted = finalTasks.sort((a, b) => {
      const parseDate = (d: any) => {
        if (!d) return 0;
        if (d.toMillis) return d.toMillis();
        if (typeof d === 'string' && d.includes('.')) {
          const parts = d.split('.');
          if (parts.length === 3) return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime();
        }
        return new Date(d).getTime() || 0;
      };
      return parseDate(b.createdAt) - parseDate(a.createdAt);
    });
    
    lastTasks = sorted;
    (window as any).lastTasksForNavigation = sorted;
    const container = document.getElementById('tasks-realtime-container');
    if (container) {
      
      container.innerHTML = renderTasksTable(sorted, userRole);
      
      
    }
  };

  setTimeout(() => {
    if ((window as any).tasksUnsubscribe) (window as any).tasksUnsubscribe();
    if ((window as any).returnedReportsUnsubscribe) (window as any).returnedReportsUnsubscribe();

    (window as any).tasksUnsubscribe = taskService.subscribeTasks((newTasks) => {
      allTasks = newTasks.filter(t => t.status !== 'Tamamlandı').map(t => {
        let sId = t.siteId;
        if (sId && isNaN(Number(sId))) {
          const siteObj = dataService.getAllSites().find(s => s.name === sId || s.name.includes(sId));
          if (siteObj) sId = siteObj.id;
        }
        if ((!sId || sId === 'Bilinmiyor') && t.turbinSeriNo) {
          const turbInfo = dataService.findTurbineBySerial(t.turbinSeriNo);
          if (turbInfo) sId = turbInfo.siteId;
        }
        return { ...t, siteId: sId };
      });
      updateDisplay();
    });

    (window as any).refreshReturnedReports = () => {
      serviceReportService.subscribeReturnedReports((reports) => {
        try {
          const mappedReports: any[] = [];
          for (const r of reports) {
            try {
              let sId = r.siteId;
              if (sId && isNaN(Number(sId))) {
                  const siteObj = dataService.getAllSites().find(s => s.name === sId || s.name.includes(sId));
                  if (siteObj) sId = siteObj.id;
              }

              let teamStr = r.team;
              if (Array.isArray(teamStr)) teamStr = teamStr[0] || 'SİSTEM';
              teamStr = teamStr || 'SİSTEM';

              const fCode = r.faultCode || '';
              const fDesc = r.faultDesc || '';
              const combinedFaultCode = fCode && fDesc ? `${fCode} - ${fDesc}` : (fCode || fDesc || '');

              mappedReports.push({
                id: r.id,
                siteId: sId || 'Bilinmiyor',
                turbineId: r.turbineNo || (r as any).turbineId || 'Bilinmiyor',
                turbinSeriNo: r.turbineSerial || '',
                personnel: formatTeamName(teamStr),
                faultCode: combinedFaultCode,
                rawFaultCode: fCode,
                status: 'Geri Gönderildi',
                createdAt: r.date || new Date().toISOString(),
                secilenSablon: r.templateName || r.type || 'Bilinmiyor',
                isMaintenance: r.type === 'BAKIM',
                isReturnedReport: true,
                originalReportNo: r.reportNo || '',
                type: r.type || 'ARIZA',
                faultDesc: fDesc,
                materials: r.materials || [],
                workSessions: r.workSessions || [],
                notes: r.notes || '',
                matFormNo: r.matFormNo || '',
                checklist: r.checklist || [],
                imageUrls: r.imageUrls || [],
                photos: r.imageUrls || []
              });
            } catch (err: any) {
              console.error("Single report map error:", err, r);
            }
          }
          returnedReports = mappedReports;
        } catch (err: any) {
          console.error("Mapping error in returnedReports:", err);
        }
        updateDisplay();
      });
    };

    (window as any).returnedReportsUnsubscribe = () => {
      // Dummy cleanup as subscribeReturnedReports returns a dummy
    };

    // Run initial fetch
    (window as any).refreshReturnedReports();
  }, 100);

  return `
    <div id="tasks-realtime-container" class="fade-in-up content-area" style="max-width: 100% !important;">
      <div style="padding: 4rem; text-align: center; color: var(--text-muted);">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
        <p>İş emirleri yükleniyor...</p>
      </div>
    </div>
  `;
}

(window as any).showOHSNameSuggestions = (idx: number, query: string) => {
  const container = document.getElementById(`ohs-personnel-dropdown-${idx}`);
  if (!container) return;

  const lowerQuery = (query || '').toLocaleLowerCase('tr-TR').trim();
  if (!lowerQuery) {
      container.style.display = 'none';
      return;
  }

  const matches = personnelService.getPersonnelList().filter(name => name.toLocaleLowerCase('tr-TR').includes(lowerQuery));

  if (matches.length === 0) {
      container.style.display = 'none';
      return;
  }

  container.style.display = 'block';
  container.innerHTML = matches.slice(0, 8).map(name => `
      <div class="search-item" style="padding: 0.5rem 0.75rem; font-size: 0.85rem; color: #ffffff; cursor: pointer; transition: background 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" 
           onmouseover="this.style.background='rgba(0, 242, 254, 0.15)'" 
           onmouseout="this.style.background='transparent'"
           onmousedown="window.selectOHSNameSuggestion(${idx}, '${name.replace(/'/g, "\\'")}')">
          ${name}
      </div>
  `).join('');
};

(window as any).selectOHSNameSuggestion = (idx: number, name: string) => {
  const input = document.getElementById(`ohs-q${idx}-name`) as HTMLInputElement;
  if (input) {
      input.value = name;
  }
  const container = document.getElementById(`ohs-personnel-dropdown-${idx}`);
  if (container) {
      container.style.display = 'none';
  }
};

(window as any).showOHSChecklistModal = (task: any, callback: () => void) => {
    const existingData = task.ohsData || {};

    const questions = [
      "Türbinde yapacağım bakım/arıza çalışması öncesinde kullanmam gereken temel kişisel koruyucu donanımlarımı (Baret, İş ayakkabısı, emniyet kemeri, Lanyard, runner) kontrol ettim.",
      "Bakım/arıza öncesinde yanımda bulundurmam gereken ilave ekipmanları (Göz duşu, koruyucu gözlük, kulak koruyucu, toz maskesi, tam yüz maske, yangın söndürme cihazı, ilkyardım çantası, “Dikkat bakım var” levhası) yanıma aldım.",
      "Adam kurtarma seti kullanıma hazır şekilde türbine çıkarılacaktır.",
      "Bakım/arıza öncesinde Acil duruma yönelik diğer iletişim araçları (telsiz) kontrol ettim, yanıma aldım.",
      "Türbinde yapacağım faaliyet süresince, aldığım İSG eğitimleri ve tarafıma tebliğ edilmiş talimatlarda (DH-TA-005, BA_bl_1001 ve diğer Enercon talimatları) bahsedilen konulara azami dikkat göstererek çalışılması konusunda ekip arkadaşlarımı bilgilendirdim."
    ];

    let questionsHtml = '';
    questions.forEach((q, index) => {
      const i = index + 1;
      const isChecked = existingData[`q${i}`] ? 'checked' : '';
      const nameVal = existingData[`q${i}Name`] || '';
      const hasNote = existingData[`q${i}HasNote`] ? 'checked' : '';
      const noteVal = existingData[`q${i}Note`] || '';
      
      questionsHtml += `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); padding: 0.6rem 0.8rem; border-radius: 8px;">
            <label style="display: flex; align-items: flex-start; gap: 0.75rem; cursor: pointer; margin: 0;">
              <input type="checkbox" id="ohs-q${i}" style="margin-top: 3px; width: 16px; height: 16px; accent-color: #f39c12; flex-shrink: 0;" ${isChecked} onchange="document.getElementById('ohs-q${i}-details').style.display = this.checked ? 'block' : 'none'">
              <span style="font-size: 0.82rem; color: #fff; line-height: 1.4; font-weight: 500;">${i}. ${q}</span>
            </label>
            
            <div id="ohs-q${i}-details" style="margin-top: 0.5rem; margin-left: 26px; display: ${isChecked ? 'block' : 'none'};">
              <div style="position: relative; margin-bottom: 0.4rem;">
                <input type="text" id="ohs-q${i}-name" class="cyber-input" placeholder="Personel adını yazın..." value="${nameVal}" style="width: 100%; border-color: rgba(243, 156, 18, 0.3); height: 28px !important; font-size: 0.75rem; padding: 4px 8px !important;"
                       onfocus="window.showOHSNameSuggestions(${i}, this.value)"
                       oninput="window.showOHSNameSuggestions(${i}, this.value)"
                       onblur="setTimeout(() => { const el = document.getElementById('ohs-personnel-dropdown-${i}'); if (el) el.style.display = 'none'; }, 200);">
                <div id="ohs-personnel-dropdown-${i}" class="search-results-dropdown" style="display: none; position: absolute; top: 100%; left: 0; width: 100%; max-height: 150px; overflow-y: auto; z-index: 100000; margin-top: 4px; background: rgba(10, 20, 30, 0.98); border: 1px solid var(--accent-cyan); border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.8); padding: 2px 0;"></div>
              </div>
              
              <label style="display: flex; align-items: center; gap: 0.4rem; cursor: pointer; margin-bottom: 0.3rem; color: var(--accent-orange); font-size: 0.75rem;">
                <input type="checkbox" id="ohs-q${i}-has-note" ${hasNote} onchange="document.getElementById('ohs-q${i}-note-container').style.display = this.checked ? 'block' : 'none'">
                <i class="fa-solid fa-pen-to-square"></i> Sorun / Not Ekle
              </label>
              
              <div id="ohs-q${i}-note-container" style="display: ${hasNote ? 'block' : 'none'};">
                <textarea id="ohs-q${i}-note" class="cyber-input" placeholder="Notunuzu veya sorunu buraya yazınız..." rows="2" style="width: 100%; border-color: rgba(243, 156, 18, 0.3); resize: vertical; font-size: 0.75rem; padding: 4px 8px !important;">${noteVal}</textarea>
              </div>
            </div>
          </div>
      `;
    });
    
    const modal = document.createElement('div');
    modal.className = 'cyber-modal-overlay fade-in';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); padding: 1rem; box-sizing: border-box;';
    
    modal.innerHTML = `
      <div class="glass-panel" style="width: 100%; max-width: 580px; max-height: 85vh; overflow-y: auto; padding: 1.25rem 1.5rem; position: relative; border-top: 4px solid #f39c12; display: flex; flex-direction: column; background: #0b0f19;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 0.75rem; right: 1rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.3rem;">&times;</button>
        
        <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; color: #f39c12;">
          <i class="fa-solid fa-hard-hat" style="font-size: 1.3rem;"></i>
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; margin: 0; font-weight: 800; letter-spacing: 0.5px;">İSG & SAHA GÜVENLİK KONTROLÜ</h3>
        </div>
        
        <div style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.8rem; line-height: 1.4;">Göreve başlamadan önce lütfen aşağıdaki iş sağlığı ve güvenliği kurallarını teyit ediniz.</div>
  
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${questionsHtml}
        </div>
  
        <div style="margin-top: 1.25rem; display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button onclick="this.closest('.cyber-modal-overlay').remove()" class="btn-cyber-mini" style="background: transparent; color: #f39c12; border: 1px solid rgba(243, 156, 18, 0.5); font-size: 0.7rem; padding: 4px 10px; height: auto;">İPTAL</button>
          <button id="submit-ohs-btn" class="cyber-button primary" style="background: #f39c12; color: #000; border: none; font-size: 0.75rem; padding: 6px 12px; height: auto;"><i class="fa-solid fa-check"></i> ONAYLA VE GÖREVE BAŞLA</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  
    const btn = document.getElementById('submit-ohs-btn');
    if (btn) {
      btn.onclick = async () => {
        const ohsData: any = {};
        for(let i=1; i<=5; i++) {
          const checked = (document.getElementById(`ohs-q${i}`) as HTMLInputElement).checked;
          const name = (document.getElementById(`ohs-q${i}-name`) as HTMLInputElement).value.trim();
          const hasNote = (document.getElementById(`ohs-q${i}-has-note`) as HTMLInputElement).checked;
          const note = (document.getElementById(`ohs-q${i}-note`) as HTMLTextAreaElement).value.trim();
          
          if (!checked) {
            alert('Devam edebilmek için tüm İSG kurallarını onaylamalısınız.');
            return;
          }
          if (!name) {
            alert(`Lütfen ${i}. madde için onaylayan personel adını giriniz.`);
            return;
          }
          if (hasNote && !note) {
            alert(`Lütfen ${i}. madde için notunuzu yazınız veya "Sorun / Not Ekle" işaretini kaldırınız.`);
            return;
          }
          
          ohsData[`q${i}`] = checked;
          ohsData[`q${i}Name`] = name;
          ohsData[`q${i}HasNote`] = hasNote;
          ohsData[`q${i}Note`] = hasNote ? note : '';
        }
  
        try {
          btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> KAYDEDİLİYOR...';
          (btn as HTMLButtonElement).disabled = true;
          
          const todayStr = new Date().toISOString().split('T')[0];
          ohsData.date = todayStr;
          ohsData.team = task.personnel || task.team || '';
          
          let ohsList = Array.isArray(task.ohsData) ? task.ohsData : (task.ohsData?.q1 ? [task.ohsData] : []);
          
          // Eğer bugün ve aynı ekip için zaten bir kayıt varsa (olmamalı ama önlem) onu güncelle, yoksa ekle
          const existingTodayIdx = ohsList.findIndex((o: any) => o.date === todayStr && o.team === ohsData.team);
          if (existingTodayIdx >= 0) {
            ohsList[existingTodayIdx] = ohsData;
          } else {
            ohsList.push(ohsData);
          }

          task.ohsData = ohsList;
          if (task.id) {
            if (task.reportNo) {
                // Bu bir iade edilen rapor (ServiceReport nesnesi)
                const { serviceReportService } = await import('../services/ServiceReportService');
                await serviceReportService.updateReport(task.id, { ohsData: ohsList }, []);
            } else {
                // Bu normal bir iş emri (Task nesnesi)
                const { taskService } = await import('../services/TaskService');
                await taskService.updateTask(task.id, { ohsData: ohsList });
            }
          }
          
          modal.remove();
          callback();
        } catch (err) {
          console.error("OHS kaydetme hatası", err);
          alert('İSG onayı kaydedilirken hata oluştu.');
          btn.innerHTML = '<i class="fa-solid fa-check"></i> ONAYLA VE GÖREVE BAŞLA';
          (btn as HTMLButtonElement).disabled = false;
        }
      };
    }
};

(window as any).showTaskIntentModal = (task: any, onCloseOnly: () => void, onFieldWork: () => void) => {
  const ohsList = Array.isArray(task.ohsData) ? task.ohsData : (task.ohsData?.q1 ? [task.ohsData] : []);
  const lastOhs = ohsList.length > 0 ? ohsList[ohsList.length - 1] : null;
  const lastDateStr = lastOhs?.date ? new Date(lastOhs.date).toLocaleDateString('tr-TR') : 'Önceki gün';

  const modal = document.createElement('div');
  modal.className = 'cyber-modal-overlay fade-in';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); padding: 1rem; box-sizing: border-box;';

  const siteTurbine = `${task.siteName || ''} • ${task.turbinSeriNo || task.turbineId || ''}`.trim();
  const taskTitle = task.taskNo ? `İş Emri: ${task.taskNo}` : (task.secilenSablon || 'Görev Formu');

  modal.innerHTML = `
    <div class="glass-panel" style="width: 100%; max-width: 520px; padding: 1.5rem; position: relative; border-top: 4px solid #3b82f6; display: flex; flex-direction: column; background: #0b0f19; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.85);">
      <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 0.75rem; right: 1rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.3rem;">&times;</button>
      
      <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.85rem; color: #3b82f6;">
        <div style="width: 40px; height: 40px; border-radius: 8px; background: rgba(59, 130, 246, 0.15); display: flex; align-items: center; justify-content: center; font-size: 1.3rem; border: 1px solid rgba(59, 130, 246, 0.3);">
          🛡️
        </div>
        <div>
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; margin: 0; font-weight: 800; letter-spacing: 0.5px; color: #fff;">
            GÖREV FORMU GİRİŞİ
          </h3>
          <div style="font-size: 0.78rem; color: var(--text-muted);">
            ${siteTurbine ? `${siteTurbine} • ` : ''}${taskTitle}
          </div>
        </div>
      </div>

      <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; font-size: 0.8rem; color: #93c5fd; line-height: 1.45;">
        ℹ️ Bu görev için <strong>${lastDateStr}</strong> tarihinde İSG Saha Güvenlik Kontrolü onaylanmıştır.<br>
        Lütfen bugünkü işlem amacınızı seçiniz:
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <!-- SEÇENEK 1: SADECE RAPORU KAPAT / DÜZENLE -->
        <button id="intent-close-report-btn" style="text-align: left; background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 1rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: flex-start; gap: 0.85rem;"
                onmouseover="this.style.background='rgba(16, 185, 129, 0.18)'; this.style.borderColor='#10b981';"
                onmouseout="this.style.background='rgba(16, 185, 129, 0.08)'; this.style.borderColor='rgba(16, 185, 129, 0.3)';">
          <div style="font-size: 1.4rem; line-height: 1; margin-top: 2px;">🟢</div>
          <div>
            <div style="color: #10b981; font-weight: 800; font-size: 0.95rem; margin-bottom: 4px;">
              SADECE RAPORU KAPATACAĞIM / DÜZENLEYECEĞİM
            </div>
            <div style="color: #94a3b8; font-size: 0.75rem; line-height: 1.35;">
              Bugün türbine çıkılmadı. Dün yapılan çalışmanın raporunu masada kontrol edip göndereceğim/kapatacağım. <em style="color: #10b981;">(İSG kontrol listesi atlanır)</em>
            </div>
          </div>
        </button>

        <!-- SEÇENEK 2: BUGÜN DE TÜRBİNDE ÇALIŞMA YAPILACAK -->
        <button id="intent-field-work-btn" style="text-align: left; background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 1rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: flex-start; gap: 0.85rem;"
                onmouseover="this.style.background='rgba(245, 158, 11, 0.18)'; this.style.borderColor='#f59e0b';"
                onmouseout="this.style.background='rgba(245, 158, 11, 0.08)'; this.style.borderColor='rgba(245, 158, 11, 0.3)';">
          <div style="font-size: 1.4rem; line-height: 1; margin-top: 2px;">🟠</div>
          <div>
            <div style="color: #f59e0b; font-weight: 800; font-size: 0.95rem; margin-bottom: 4px;">
              BUGÜN DE TÜRBİNDE ÇALIŞMA YAPILACAK
            </div>
            <div style="color: #94a3b8; font-size: 0.75rem; line-height: 1.35;">
              Bugün sahada / türbinde fiziksel çalışma devam edecek. Bugüne ait yeni İSG Saha Güvenlik Kontrolünü onaylayarak başlamak istiyorum.
            </div>
          </div>
        </button>
      </div>

      <div style="margin-top: 1.25rem; display: flex; justify-content: flex-end;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" class="btn-cyber-mini" style="background: transparent; color: var(--text-muted); border: 1px solid rgba(255,255,255,0.1); font-size: 0.75rem; padding: 5px 12px; cursor: pointer;">
          İPTAL
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const closeBtn = document.getElementById('intent-close-report-btn');
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.remove();
      onCloseOnly();
    };
  }

  const fieldBtn = document.getElementById('intent-field-work-btn');
  if (fieldBtn) {
    fieldBtn.onclick = () => {
      modal.remove();
      onFieldWork();
    };
  }
};

(window as any).showWarehouseTaskCompletionModal = (task: any) => {
  const existing = document.getElementById('wh-task-modal');
  if (existing) existing.remove();

  const currentUser = (window as any).currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
  const userDisplayName = currentUser?.displayName || currentUser?.name || currentUser?.email?.split('@')[0] || '';
  
  const siteName = task.turbineId || task.siteId || 'Depo';
  
  let matSap = task.repairedMaterial?.sapNo || '';
  let matDesc = task.repairedMaterial?.description || '';
  let matQty = task.repairedMaterial?.quantity || 1;

  // Fallback parser: Extract from yoneticiNotu if repairedMaterial was not populated
  if (!matSap && task.yoneticiNotu) {
    const match = task.yoneticiNotu.match(/([0-9]{4,8})\s*-\s*([^|(]+)/);
    if (match) {
      matSap = match[1].trim();
      matDesc = match[2].trim();
    }
  }

  if (!matDesc) {
    matDesc = task.secilenSablon ? task.secilenSablon.replace('Depo İşi: ', '').trim() : 'Onarılacak Parça';
  }

  const hasMaterial = !!matSap || (!!matDesc && !matDesc.includes('Saha İçi Malzeme') && !matDesc.includes('Defect Malzeme'));

  let selectedPhotoBase64: string = '';

  const modal = document.createElement('div');
  modal.id = 'wh-task-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.75); 
    backdrop-filter: blur(6px); z-index: 999999; display: flex; 
    align-items: center; justify-content: center; opacity: 0; transition: opacity 0.25s ease;
    padding: 1rem;
  `;

  modal.innerHTML = `
    <div onclick="event.stopPropagation()" style="background: #0A0E17; border: 1px solid rgba(16, 185, 129, 0.35); border-radius: 16px; width: 100%; max-width: 520px; padding: 1.75rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.85); transform: scale(0.95); transition: transform 0.25s ease; color: #fff; font-family: 'Inter', sans-serif; position: relative;">
      
      <!-- Close Button -->
      <button onclick="document.getElementById('wh-task-modal')?.remove()" style="position: absolute; right: 18px; top: 18px; background: transparent; border: none; color: var(--text-muted); font-size: 1.1rem; cursor: pointer;">
        <i class="fa-solid fa-xmark"></i>
      </button>

      <!-- Header -->
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 1.25rem;">
        <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          <i class="fa-solid fa-warehouse" style="color: #10B981; font-size: 1.1rem;"></i>
        </div>
        <div>
          <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #fff; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
            SAHA İÇİ PARÇA REVİZYON & ONARIM FORMU
          </h3>
          <p style="margin: 2px 0 0 0; font-size: 0.78rem; color: #94A3B8;">
            ${siteName} • Ekip: <strong style="color: #00f3ff;">${formatTeamName(task.personnel)}</strong>
          </p>
        </div>
      </div>

      <!-- Preloaded Material Card (DEFECT -> REVISED) -->
      ${hasMaterial ? `
        <div style="background: rgba(16, 185, 129, 0.04); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 1rem; margin-bottom: 1.25rem;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-size: 0.68rem; font-weight: 800; color: #10B981; letter-spacing: 1px; text-transform: uppercase;">
              <i class="fa-solid fa-box-open" style="margin-right: 4px;"></i> ONARILACAK DEFECT PARÇA
            </span>
            <span style="background: #EF4444; color: #000; font-weight: 900; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px;">
              🔴 DEFECT
            </span>
          </div>

          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            ${matSap ? `
              <span style="font-family: monospace; font-size: 0.95rem; font-weight: 800; color: #00f3ff; background: rgba(0, 243, 255, 0.1); padding: 2px 6px; border-radius: 4px;">
                ${matSap}
              </span>
            ` : ''}
            <span style="font-size: 0.85rem; font-weight: 700; color: #F1F5F9; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${matDesc}
            </span>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.75rem; color: #94A3B8; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 8px;">
            <span>Onarım Adedi: <strong style="color: #fff;">${matQty} Adet</strong></span>
            <span style="color: #10B981; font-weight: 700;">➔ Hedef: REVISED (0 TL Stoğa Giriş)</span>
          </div>
        </div>
      ` : `
        <div style="background: rgba(0, 243, 255, 0.04); border: 1px solid rgba(0, 243, 255, 0.2); border-radius: 12px; padding: 0.85rem 1rem; margin-bottom: 1.25rem;">
          <span style="font-size: 0.72rem; font-weight: 800; color: #00f3ff; text-transform: uppercase;">GÖREV KAPSAMI</span>
          <div style="font-size: 0.88rem; font-weight: 700; color: #fff; margin-top: 2px;">${cleanSablonName(task.secilenSablon)}</div>
        </div>
      `}

      <!-- Form Inputs -->
      <div style="display: flex; flex-direction: column; gap: 0.85rem; margin-bottom: 1.25rem;">
        
        <!-- Duration & Technicians in 2 columns -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.85rem;">
          <div>
            <label style="display: block; font-size: 0.7rem; color: #F59E0B; font-weight: 800; margin-bottom: 4px; text-transform: uppercase;">
              <i class="fa-regular fa-clock"></i> Harcanan Süre
            </label>
            <input type="text" id="wh-task-duration" placeholder="Örn: 2 Saat veya 09:30-11:30" 
                   value="${task.repairedMaterial?.repairDuration || ''}" 
                   style="width: 100%; height: 38px; background: rgba(0,0,0,0.5); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; box-sizing: border-box;">
          </div>
          <div>
            <label style="display: block; font-size: 0.7rem; color: #F59E0B; font-weight: 800; margin-bottom: 4px; text-transform: uppercase;">
              <i class="fa-solid fa-user-gear"></i> Onaran Personel
            </label>
            <input type="text" id="wh-task-technician" placeholder="Örn: Fatih ZEBEK & Ekip" 
                   value="${task.repairedMaterial?.repairedBy || userDisplayName}" 
                   style="width: 100%; height: 38px; background: rgba(0,0,0,0.5); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 8px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; box-sizing: border-box;">
          </div>
        </div>

        <!-- Notes / Repair Actions -->
        <div>
          <label style="display: block; font-size: 0.7rem; color: #94A3B8; font-weight: 800; margin-bottom: 4px; text-transform: uppercase;">
            <i class="fa-solid fa-pen-to-square"></i> Yapılan Onarım & Revizyon İşlemleri (Açıklama)
          </label>
          <textarea id="wh-task-notes" placeholder="Parça sökülüp temizlendi, contalar yenilendi, test edildi ve tamir edildi..." 
                    style="width: 100%; height: 70px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; color: #fff; padding: 8px 10px; font-size: 0.85rem; outline: none; resize: none; font-family: 'Inter', sans-serif; box-sizing: border-box;"></textarea>
        </div>

        <!-- Photo Upload -->
        <div>
          <label style="display: block; font-size: 0.7rem; color: #94A3B8; font-weight: 800; margin-bottom: 4px; text-transform: uppercase;">
            <i class="fa-solid fa-camera"></i> Onarım Fotoğrafı (Opsiyonel)
          </label>
          <div style="display: flex; align-items: center; gap: 10px;">
            <label style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: #CBD5E1; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s;">
              <i class="fa-solid fa-cloud-arrow-up" style="color: #00f3ff;"></i> Fotoğraf Seç / Çek
              <input type="file" id="wh-task-photo-input" accept="image/*" style="display: none;">
            </label>
            <span id="wh-photo-filename" style="font-size: 0.75rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px;">Dosya seçilmedi</span>
          </div>
          <div id="wh-photo-preview-container" style="display: none; margin-top: 8px;">
            <img id="wh-photo-preview-img" src="" alt="Önizleme" style="max-height: 90px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.4);">
          </div>
        </div>
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; gap: 0.75rem; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 1rem;">
        <button onclick="document.getElementById('wh-task-modal')?.remove()" 
                style="background: rgba(255,255,255,0.05); color: #94A3B8; border: 1px solid rgba(255,255,255,0.1); padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 700;">
          İptal
        </button>
        <button id="wh-task-submit-btn" 
                style="background: #10B981; color: #000; border: none; padding: 9px 20px; border-radius: 8px; cursor: pointer; font-size: 0.88rem; font-weight: 900; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 0 15px rgba(16, 185, 129, 0.4);">
          <i class="fa-solid fa-boxes-packing"></i> ONARIMI TAMAMLA VE STOĞA AL
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);
  setTimeout(() => {
    modal.style.opacity = '1';
    (modal.firstElementChild as HTMLElement).style.transform = 'scale(1)';
  }, 10);

  // Bind Photo input change
  const photoInput = document.getElementById('wh-task-photo-input') as HTMLInputElement;
  const photoName = document.getElementById('wh-photo-filename');
  const previewContainer = document.getElementById('wh-photo-preview-container');
  const previewImg = document.getElementById('wh-photo-preview-img') as HTMLImageElement;

  photoInput?.addEventListener('change', async (e: any) => {
    const file = e.target?.files?.[0];
    if (file) {
      if (photoName) photoName.textContent = file.name;
      try {
        const compressed = await ImageCompressor.compressImage(file, 1200, 1200, 0.8);
        const reader = new FileReader();
        reader.onload = (evt) => {
          selectedPhotoBase64 = evt.target?.result as string || '';
          if (previewImg && previewContainer) {
            previewImg.src = selectedPhotoBase64;
            previewContainer.style.display = 'block';
          }
        };
        reader.readAsDataURL(compressed);
      } catch (err) {
        console.error("Fotoğraf sıkıştırma hatası:", err);
      }
    }
  });

  // Bind Submit Button
  const submitBtn = document.getElementById('wh-task-submit-btn') as HTMLButtonElement;
  submitBtn?.addEventListener('click', async () => {
    const duration = (document.getElementById('wh-task-duration') as HTMLInputElement)?.value.trim() || '';
    const technician = (document.getElementById('wh-task-technician') as HTMLInputElement)?.value.trim() || userDisplayName;
    const notes = (document.getElementById('wh-task-notes') as HTMLTextAreaElement)?.value.trim() || 'Saha içi parça revizyonu tamamlandı.';

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> STOĞA ALINIYOR...';

    try {
      const email = currentUser?.email || 'Sistem';
      const targetWarehouseId = task.warehouseId || task.siteId;

      if (hasMaterial && targetWarehouseId) {
        // Return Defect to Revised stock
        if (task.repairedMaterial?.itemId) {
          await warehouseService.returnDefectToInventory(
            targetWarehouseId,
            task.repairedMaterial.itemId,
            'REVISED',
            email,
            task.repairedMaterial.serialNo || '',
            `Saha İçi Onarım: ${notes} | Süre: ${duration} | Onaran: ${technician}`,
            task.repairedMaterial.sapNo,
            task.repairedMaterial.description
          );
        } else if (task.repairedMaterial?.sapNo) {
          // Fallback if no specific itemId: update stock via SAP
          await warehouseService.updateStockBySap(
            targetWarehouseId,
            task.repairedMaterial.sapNo,
            -matQty,
            { user: email, reason: 'Saha İçi Revizyona Alındı' },
            'DEFECT'
          ).catch(console.warn);

          await warehouseService.updateStockBySap(
            targetWarehouseId,
            task.repairedMaterial.sapNo,
            matQty,
            { user: email, reason: `Saha İçi Revizyon Tamamlandı (${technician}): ${notes}` },
            'REVISED'
          );
        }
      }

      // Update Task in Firestore
      await taskService.updateTaskStatus(task.id, 'Tamamlandı');
      
      // Update completion details in task document
      const taskDocRef = doc(db, 'tasks', task.id);
      await updateDoc(taskDocRef, {
        status: 'Tamamlandı',
        completedAt: serverTimestamp(),
        completionData: {
          duration: duration,
          technician: technician,
          notes: notes,
          photoUrl: selectedPhotoBase64 ? selectedPhotoBase64.substring(0, 500000) : null,
          completedAt: new Date().toISOString()
        }
      }).catch(console.warn);

      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 250);

      alert(`✅ Başarılı!\n\n${hasMaterial ? `"${matDesc}" parçası başarıyla onarıldı ve ${siteName} Tamirli (REVISED) stoğuna 0 TL maliyetle eklendi.` : 'Depo görevi başarıyla tamamlandı.'}`);

      // Refresh task list
      if ((window as any).refreshTasks) {
        (window as any).refreshTasks();
      }

    } catch (err: any) {
      console.error("Revizyon tamamlama hatası:", err);
      alert(`İşlem sırasında hata oluştu:\n${err.message}`);
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-boxes-packing"></i> ONARIMI TAMAMLA VE STOĞA AL';
    }
  });
};

(window as any).handleStartTask = async (taskId: string) => {
  const currentUser = (window as any).currentUser;
  const hasCompleteTaskPerm = checkCompleteTaskPermission(currentUser);

  if (!hasCompleteTaskPerm) {
    alert("Bu işlem için yetkiniz bulunmamaktadır. (Görev Formu Doldurma yetkisi)");
    return;
  }

  try {
    // Find task in current list and check status
    const task = (window as any).lastTasksForNavigation?.find((t: any) => t.id === taskId);
    
    // Eğer görev YILDIRIM ENGELLİ durumundaysa onay isteyelim
    if (task && task.status === 'HOLD_WEATHER') {
      const confirmStart = confirm("⚠️ DİKKAT: Bu sahada şu anda aktif YILDIRIM RİSKİ (hava muhalefeti engeli) bulunmaktadır!\n\nHer şeye rağmen sorumluluk alarak göreve başlamak ve formu doldurmak istiyor musunuz?");
      if (!confirmStart) {
        return;
      }
    }

    // 1. Show OHS Checklist First (Skip for Warehouse / Facility tasks)
    if (task) {
      const isWarehouseTask = task.taskLocationType === 'WAREHOUSE' || task.turbinSeriNo === 'DEPO' || (task.secilenSablon && task.secilenSablon.startsWith('Depo İşi'));

      if (isWarehouseTask) {
        // Depo ve Tesis görevlerinde kule içi İSG kontrolünü atla, doğrudan tam ekran ana forma (form-ariza) git
        taskService.updateTaskStatus(taskId, 'Görev Teslim Edildi').catch(console.error);
        (window as any).navigate('form-ariza', { ...task, status: 'Görev Teslim Edildi' });
        return;
      }

      if (task.isReturnedReport) {
        // İade edilen raporlar için İSG formunu atla, direkt düzenlemeye geç
        (window as any).navigate('form-ariza', { ...task, status: 'Geri Gönderildi', isEditMode: true });
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const ohsList = Array.isArray(task.ohsData) ? task.ohsData : (task.ohsData?.q1 ? [task.ohsData] : []);
      const hasToday = ohsList.some((o: any) => o.date === todayStr && o.team === task.personnel);

      if (hasToday) {
        // Bugün ve bu ekip için zaten İSG kontrolü tamamlanmış, doğrudan forma geç
        taskService.updateTaskStatus(taskId, 'Görev Teslim Edildi').catch(console.error);
        (window as any).navigate('form-ariza', { ...task, status: 'Görev Teslim Edildi' });
      } else if (ohsList.length > 0) {
        // Daha önce bu görev için İSG doldurulmuş (Ertesi gün rapor kapatma veya devam etme senaryosu)
        (window as any).showTaskIntentModal(task, () => {
          // 1. Sadece dünkü raporu kapatacak / düzenleyecek -> İSG'siz doğrudan forma geç
          taskService.updateTaskStatus(taskId, 'Görev Teslim Edildi').catch(console.error);
          (window as any).navigate('form-ariza', { ...task, status: 'Görev Teslim Edildi', isCloseOnlyMode: true });
        }, () => {
          // 2. Bugün de sahada/türbinde aktif çalışma var -> Bugüne ait İSG kontrolünü doldurt
          (window as any).showOHSChecklistModal(task, () => {
            taskService.updateTaskStatus(taskId, 'Görev Teslim Edildi').catch(console.error);
            (window as any).navigate('form-ariza', { ...task, status: 'Görev Teslim Edildi' });
          });
        });
      } else {
        // Göreve ilk defa başlanıyor (hiç İSG kaydı yok) -> Zorunlu İSG kontrolü
        (window as any).showOHSChecklistModal(task, () => {
          // Proceed after OHS is confirmed
          taskService.updateTaskStatus(taskId, 'Görev Teslim Edildi').catch(console.error);
          (window as any).navigate('form-ariza', { ...task, status: 'Görev Teslim Edildi' });
        });
      }
    }
  } catch (error: any) {
    console.error("Görev başlatma hatası:", error);
    alert(`Görev başlatılırken bir hata oluştu.\nDetay: ${error.message}`);
  }
};

(window as any).handleTransferTask = async (taskId: string) => {
  const currentUser = (window as any).currentUser;
  const hasTransferTaskPerm = checkTransferTaskPermission(currentUser);

  if (!hasTransferTaskPerm) {
    alert("Bu işlem için yetkiniz bulunmamaktadır. (Görev Transfer Etme yetkisi)");
    return;
  }

  const task = (window as any).lastTasksForNavigation?.find((t: any) => t.id === taskId);
  if (!task) {
    alert("Görev bulunamadı.");
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'cyber-modal-overlay fade-in';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); padding: 1rem; box-sizing: border-box;';
  
  modal.innerHTML = `
    <div class="glass-panel" style="width: 100%; max-width: 500px; padding: 2rem; position: relative; border-top: 4px solid var(--accent-blue); display: flex; flex-direction: column;">
      <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
      
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; color: var(--accent-blue);">
        <i class="fa-solid fa-people-arrows" style="font-size: 2rem;"></i>
        <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; margin: 0; font-weight: 800;">GÖREVİ TRANSFER ET</h3>
      </div>
      
      <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.5;">
        Bu işlemi yaptığınızda mevcut görev, önceki ekibin girdiği veriler (saatler, malzemeler, kontrol maddeleri vb.) korunarak yeni ekibe devredilecektir. Önceki ekibin çalışma saatleri kilitlenecektir.
      </div>

      <div style="margin-bottom: 1.5rem; position: relative;">
        <label style="display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; font-weight: 700;">GÖREVLENDİRİLECEK EKİP</label>
        <select id="transfer-team-input" class="cyber-input" style="width: 100%; font-weight: 700;">
          <option value="">Ekip Seçiniz...</option>
          ${Array.from({length: 15}, (_, i) => { 
            const num = String(i + 1).padStart(2, '0'); 
            return '<option value="Team ' + num + '">Team ' + num + '</option>';
          }).join('')}
        </select>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 1rem;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" class="btn-cyber-mini" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: var(--text-muted);">İPTAL</button>
        <button id="transfer-confirm-btn" class="cyber-button primary" style="background: var(--accent-blue); color: #fff; border: none;">
          <i class="fa-solid fa-check"></i> TRANSFERİ ONAYLA
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const confirmBtn = document.getElementById('transfer-confirm-btn');
  const inputEl = document.getElementById('transfer-team-input') as HTMLInputElement;

  if (confirmBtn && inputEl) {
    confirmBtn.onclick = async () => {
      const newTeam = inputEl.value.trim();
      if (!newTeam) {
        alert("Lütfen yeni ekip veya personel adını giriniz.");
        return;
      }

      try {
        confirmBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> TRANSFER EDİLİYOR...';
        (confirmBtn as HTMLButtonElement).disabled = true;

        const updates: any = { 
          'assignment.assignedTeam': newTeam,
          personnel: newTeam 
        };

        // Lock existing work sessions and clear active team personnel in the draft
        if (task.maintenanceData) {
          const mData = { ...task.maintenanceData };
          if (mData.workSessions && Array.isArray(mData.workSessions)) {
                        mData.workSessions = mData.workSessions.map((ws: any) => {
              const prevTeam = mData.teamPersonnel && mData.teamPersonnel.length > 0 ? mData.teamPersonnel : [];
              return {
                ...ws,
                personnel: ws.personnel && ws.personnel.length > 0 ? ws.personnel : prevTeam,
                locked: true // Lock the existing session so the new team can't edit it
              };
            });
          }
          mData.teamPersonnel = []; // Clear current active team list so new team can start fresh
          updates.maintenanceData = mData;
        }

        const { taskService } = await import('../services/TaskService');
        await taskService.updateTask(task.id, updates);
        
        alert(`Görev başarıyla ${newTeam} ekibine transfer edildi.`);
        modal.remove();
      } catch (error: any) {
        console.error("Transfer hatası:", error);
        alert("Görev transfer edilirken bir hata oluştu: " + error.message);
        confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> TRANSFERİ ONAYLA';
        (confirmBtn as HTMLButtonElement).disabled = false;
      }
    };
  }
};

(window as any).handleTaskDelete = async (taskId: string) => {
  const currentUser = (window as any).currentUser;
  const hasDeleteTaskPerm = checkDeleteTaskPermission(currentUser);

  if (!hasDeleteTaskPerm) {
    alert("Bu işlem için yetkiniz bulunmamaktadır. (Görev Silme yetkisi)");
    return;
  }

  if (!confirm('Bu iş emrini kalıcı olarak silmek istediğinize emin misiniz?')) return;
  
  try {
    await taskService.deleteTask(taskId);
  } catch (error) {
    console.error("Silme hatası:", error);
    alert('Görev silinirken bir hata oluştu.');
  }
};

(window as any).handleReturnedReportDelete = async (reportId: string) => {
  const currentUser = (window as any).currentUser;
  const hasDeleteTaskPerm = checkDeleteTaskPermission(currentUser);

  if (!hasDeleteTaskPerm) {
    alert("Bu işlem için yetkiniz bulunmamaktadır. (Görev Silme yetkisi)");
    return;
  }

  if (!confirm('Bu geri dönen raporu kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
  
  try {
    const { serviceReportService } = await import('../services/ServiceReportService');
    await serviceReportService.deleteReport(reportId);
    
    // Refresh the list immediately!
    if (typeof (window as any).refreshReturnedReports === 'function') {
      (window as any).refreshReturnedReports();
    }
  } catch (error) {
    console.error("Rapor silme hatası:", error);
    alert('Rapor silinirken bir hata oluştu.');
  }
};

(window as any).editReturnedReport = async (reportNo: string) => {
    const currentUser = (window as any).currentUser;
    const hasCompleteTaskPerm = checkCompleteTaskPermission(currentUser);

    if (!hasCompleteTaskPerm) {
        alert("Bu işlem için yetkiniz bulunmamaktadır. (Görev Formu Doldurma yetkisi)");
        return;
    }

    if (!reportNo) {
        alert("Rapor numarası bulunamadı.");
        return;
    }
    try {
        const report = await serviceReportService.getReportByNo(reportNo);
        if (report) {
            const isBakim = report.type === 'BAKIM';
            // Filter out team names from personnel - only keep actual person names
            const cleanPersonnel = (report.personnel || []).filter((p: string) => 
                p && !p.toLowerCase().startsWith('team') && !p.match(/^team\s*\d+$/i)
            );
            
            // Düzeltme yapıldığında geçmiş tarihli olsa bile İSG atlanır (sadece doküman düzenlemesi olduğu için)
            (window as any).navigate('form-ariza', { 
                ...report, 
                isEditMode: true, 
                isMaintenance: isBakim,
                secilenSablon: report.templateName || report.type,
                turbinSeriNo: report.turbineSerial || '',
                turbineId: report.turbineNo || '',
                personnel: cleanPersonnel.length > 0 ? cleanPersonnel : (report.personnel || [])
            });
        } else {
            console.warn("Report not found by No:", reportNo);
            // Fallback to searching in all reports if needed
            const all = await serviceReportService.getAllReports();
            const found = all.find(r => r.reportNo === reportNo);
            if (found) {
                const isBakim = found.type === 'BAKIM';
                const cleanPersonnel = (found.personnel || []).filter((p: string) => 
                    p && !p.toLowerCase().startsWith('team') && !p.match(/^team\s*\d+$/i)
                );
                
                (window as any).navigate('form-ariza', { 
                    ...found, 
                    isEditMode: true,
                    isMaintenance: isBakim,
                    secilenSablon: found.templateName || found.type,
                    turbinSeriNo: found.turbineSerial || '',
                    turbineId: found.turbineNo || '',
                    personnel: cleanPersonnel.length > 0 ? cleanPersonnel : (found.personnel || [])
                });
            } else {
                alert("Rapor bulunamadı.");
            }
        }
    } catch (error) {
        console.error("Report load error details:", error);
        alert("Rapor yüklenirken hata oluştu. Lütfen tekrar deneyiniz.");
    }
};



