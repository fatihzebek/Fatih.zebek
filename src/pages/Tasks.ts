import { taskService } from '../services/TaskService';
import type { Task } from '../services/TaskService';
import { authService } from '../services/AuthService';
import { userService } from '../services/UserService';
import { serviceReportService } from '../services/ServiceReportService';
import { formatTeamName } from '../utils/formatters';
import { dataService, DataService } from '../services/DataService';
import type { ServiceReport } from '../services/ServiceReportService';
import personnelList from '../data/personnel.json';

const cleanSablonName = (sablonName: string) => {
  return (sablonName || '')
    .replace(/\s*[Tt]alimatı\s*/g, '')
    .replace(/\s*[Tt]alimati\s*/g, '')
    .trim();
};

let activeSiteFilter = 'TÜMÜ';

const renderTasksTable = (tasks: Task[], userRole: string) => {
  const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const taskPerms = currentUser?.allowedTabs?.tasks || {};
  const hasDeleteTaskPerm = isAdmin || (typeof taskPerms === 'object' && !!(taskPerms as any).deleteTask);
  const hasCompleteTaskPerm = isAdmin || (typeof taskPerms === 'object' && !!(taskPerms as any).completeTask);
  const hasTransferTaskPerm = isAdmin || (typeof taskPerms === 'object' && !!(taskPerms as any).transferTask);
  if (tasks.length === 0) {
    return `
      <div style="padding: 4rem; text-align: center; color: var(--text-muted);">
        <i class="fa-solid fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.2;"></i>
        <p>Henüz kayıtlı iş emri bulunamadı.</p>
      </div>
    `;
  }

  // Group tasks by site ID for consistent sidebar
  const grouped = tasks.reduce((acc, task) => {
    let sId = task.siteId || 'Bilinmiyor';
    
    // Normalize siteId to ID if it's a name
    if (sId !== 'Bilinmiyor' && isNaN(Number(sId))) {
      const siteObj = dataService.getSites().find(s => s.name === sId || s.name.includes(sId));
      if (siteObj) sId = siteObj.id;
    }

    if (!acc[sId]) acc[sId] = [];
    acc[sId].push(task);
    return acc;
  }, {} as Record<string, Task[]>);

  const siteNames = Object.keys(grouped).sort((a, b) => {
    const siteA = dataService.getSites().find(s => s.id === a);
    const siteB = dataService.getSites().find(s => s.id === b);
    const nameA = siteA ? siteA.name : a;
    const nameB = siteB ? siteB.name : b;
    const indexA = DataService.customOrder.findIndex(o => o.toLowerCase() === nameA.toLowerCase());
    const indexB = DataService.customOrder.findIndex(o => o.toLowerCase() === nameB.toLowerCase());
    if (indexA === -1 && indexB === -1) return nameA.localeCompare(nameB);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
  
  // Filter tasks based on active selection
  const filteredTasks = activeSiteFilter === 'TÜMÜ' 
    ? tasks 
    : grouped[activeSiteFilter] || [];

  return `
    <div class="tasks-page-container">
      <!-- Sidebar / Top Filter Navigation -->
      <div class="tasks-filter-sidebar">
        <div class="glass-panel" style="padding: 1rem; border-top: 2px solid var(--accent-blue);">
          <h3 style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem; letter-spacing: 1px; padding-left: 0.5rem;">SANTRALLER</h3>
          
          <div class="sidebar-nav">
             <div class="nav-item ${activeSiteFilter === 'TÜMÜ' ? 'active' : ''}" 
                  onclick="window.handleSiteFilter('TÜMÜ')"
                  style="padding: 0.8rem 1rem; border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; transition: all 0.2s;">
               <span><i class="fa-solid fa-layer-group" style="margin-right: 10px; width: 16px;"></i> TÜMÜ</span>
               <span style="font-size: 0.7rem; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 10px;">${tasks.length}</span>
             </div>

             ${siteNames.map(id => {
                const site = dataService.getSites().find(s => s.id === id);
                const displayName = site ? site.name : id;
                return `
                <div class="nav-item ${activeSiteFilter === id ? 'active' : ''}" 
                     onclick="window.handleSiteFilter('${id}')"
                     style="padding: 0.8rem 1rem; border-radius: 8px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; transition: all 0.2s;">
                  <span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; font-size: 0.85rem; flex: 1;">
                    <i class="fa-solid fa-wind" style="margin-right: 10px; width: 16px;"></i> ${displayName}
                  </span>
                  <span style="font-size: 0.7rem; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 10px;">${grouped[id].length}</span>
                </div>
             `}).join('')}
          </div>
        </div>
        
        <style>
          .nav-item:hover { background: rgba(255,255,255,0.04); }
          .nav-item.active { 
            background: linear-gradient(90deg, rgba(100, 255, 218, 0.08), transparent); 
            color: #64ffda; 
            border-left: 3px solid #64ffda;
            font-weight: 700;
          }
          
          /* Tasks table premium styling */
          .tasks-table-panel {
            border: 1px solid rgba(255,255,255,0.06) !important;
            border-radius: 16px !important;
            overflow: hidden;
          }
          .tasks-table-panel table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 0.85rem;
          }
          .tasks-table-panel thead tr {
            background: linear-gradient(135deg, rgba(100, 255, 218, 0.04), rgba(0, 114, 255, 0.04)) !important;
          }
          .tasks-table-panel th {
            padding: 16px 20px !important;
            font-weight: 800;
            color: rgba(255,255,255,0.5);
            border-bottom: 1px solid rgba(100, 255, 218, 0.08) !important;
            vertical-align: middle !important;
            text-transform: uppercase;
            font-size: 0.68rem;
            letter-spacing: 1.5px;
          }
          .tasks-table-panel th i {
            margin-right: 6px;
            font-size: 0.6rem;
            opacity: 0.6;
          }
          .tasks-table-panel td {
            padding: 18px 20px !important;
            vertical-align: middle !important;
            border-bottom: 1px solid rgba(255,255,255,0.03) !important;
          }
          .tasks-table-panel tr:last-child td {
            border-bottom: none !important;
          }
          .tasks-table-panel tbody tr {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
          }
          .tasks-table-panel tbody tr:hover {
            background: rgba(100, 255, 218, 0.03) !important;
            box-shadow: inset 3px 0 0 #64ffda;
          }
          
          /* Row entrance animation */
          @keyframes taskRowIn {
            from { opacity: 0; transform: translateX(-8px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .tasks-table-panel tbody tr {
            animation: taskRowIn 0.4s ease-out backwards;
          }
          .tasks-table-panel tbody tr:nth-child(1) { animation-delay: 0.03s; }
          .tasks-table-panel tbody tr:nth-child(2) { animation-delay: 0.06s; }
          .tasks-table-panel tbody tr:nth-child(3) { animation-delay: 0.09s; }
          .tasks-table-panel tbody tr:nth-child(4) { animation-delay: 0.12s; }
          .tasks-table-panel tbody tr:nth-child(5) { animation-delay: 0.15s; }
          
          /* Custom status badge */
          .status-badge {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 6px 14px !important;
            border-radius: 20px !important;
            font-size: 0.68rem !important;
            font-weight: 800 !important;
            text-transform: uppercase;
            white-space: nowrap !important;
            letter-spacing: 0.8px;
            height: 28px;
            box-sizing: border-box;
            transition: all 0.3s ease;
          }
          .status-badge:hover {
            transform: scale(1.05);
          }
          .status-badge.delivered {
            background: rgba(100, 255, 218, 0.1) !important;
            color: #64ffda !important;
            border: 1px solid rgba(100, 255, 218, 0.25) !important;
            box-shadow: 0 0 12px rgba(100, 255, 218, 0.08) !important;
          }
          .status-badge.hold-weather-badge {
            background: rgba(255, 170, 0, 0.12) !important;
            color: #ffb74d !important;
            border: 1px solid rgba(255, 170, 0, 0.3) !important;
            box-shadow: 0 0 12px rgba(255, 170, 0, 0.1) !important;
            animation: weather-pulse 2s infinite alternate;
          }
          @keyframes weather-pulse {
            0% { box-shadow: 0 0 8px rgba(255, 170, 0, 0.1); }
            100% { box-shadow: 0 0 18px rgba(255, 170, 0, 0.3); }
          }

          /* Custom task type badge */
          .task-type-badge {
            display: flex !important;
            flex-direction: column;
            justify-content: center;
            background: linear-gradient(135deg, rgba(0, 114, 255, 0.06), rgba(100, 255, 218, 0.03));
            color: var(--accent-blue);
            padding: 10px 16px !important;
            border-radius: 10px !important;
            border: 1px solid rgba(0, 114, 255, 0.1) !important;
            box-sizing: border-box;
            min-height: 48px;
            transition: all 0.3s ease;
          }
          .task-type-badge:hover {
            border-color: rgba(0, 114, 255, 0.25) !important;
            box-shadow: 0 2px 12px rgba(0, 114, 255, 0.08);
          }
          .task-type-badge.returned {
            background: linear-gradient(135deg, rgba(155, 89, 182, 0.08), rgba(155, 89, 182, 0.03)) !important;
            color: #b37feb !important;
            border: 1px solid rgba(155, 89, 182, 0.18) !important;
          }

          /* Unify action buttons */
          .action-btn-container {
            display: inline-flex !important;
            gap: 8px !important;
            justify-content: flex-end !important;
            align-items: center !important;
            width: 100%;
          }
          
          .action-btn-main {
            height: 34px !important;
            min-height: 34px !important;
            padding: 0 18px !important;
            font-size: 0.7rem !important;
            font-weight: 800 !important;
            border-radius: 8px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-sizing: border-box !important;
            white-space: nowrap !important;
            border: none !important;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            position: relative;
            overflow: hidden;
          }
          .action-btn-main::after {
            content: '';
            position: absolute;
            top: 0; left: -100%;
            width: 100%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
            transition: left 0.5s ease;
          }
          .action-btn-main:hover::after {
            left: 100%;
          }
          
          .action-btn-main.fill-form {
            background: linear-gradient(135deg, #00ff88, #00cc6a) !important;
            color: #060912 !important;
            box-shadow: 0 2px 12px rgba(0, 255, 136, 0.25) !important;
          }
          .action-btn-main.fill-form:hover {
            box-shadow: 0 4px 20px rgba(0, 255, 136, 0.4) !important;
            transform: translateY(-2px);
          }

          .action-btn-main.edit-returned {
            background: linear-gradient(135deg, #b37feb, #9b59b6) !important;
            color: #ffffff !important;
            box-shadow: 0 2px 12px rgba(155, 89, 182, 0.25) !important;
          }
          .action-btn-main.edit-returned:hover {
            box-shadow: 0 4px 20px rgba(155, 89, 182, 0.45) !important;
            transform: translateY(-2px);
          }

          .action-btn-main.detail-btn {
            background: rgba(255, 255, 255, 0.04) !important;
            color: rgba(255,255,255,0.7) !important;
            border: 1px solid rgba(255,255,255,0.1) !important;
          }
          .action-btn-main.detail-btn:hover {
            background: rgba(255, 255, 255, 0.08) !important;
            border-color: rgba(255,255,255,0.2) !important;
            color: #fff !important;
          }

          .action-btn-main.transfer-btn {
            background: rgba(0, 114, 255, 0.08) !important;
            color: #5b9aff !important;
            border: 1px solid rgba(0, 114, 255, 0.2) !important;
          }
          .action-btn-main.transfer-btn:hover {
            background: rgba(0, 114, 255, 0.15) !important;
            box-shadow: 0 2px 14px rgba(0, 114, 255, 0.2) !important;
            transform: translateY(-2px);
          }

          .action-btn-delete {
            width: 34px !important;
            height: 34px !important;
            min-width: 34px !important;
            min-height: 34px !important;
            padding: 0 !important;
            background: rgba(255, 82, 82, 0.08) !important;
            color: #ff6b6b !important;
            border: 1px solid rgba(255, 82, 82, 0.15) !important;
            border-radius: 8px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            cursor: pointer;
            box-sizing: border-box !important;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
          }
          .action-btn-delete:hover {
            background: rgba(255, 82, 82, 0.2) !important;
            border-color: rgba(255, 82, 82, 0.4) !important;
            color: #ff4444 !important;
            transform: translateY(-2px) scale(1.05);
            box-shadow: 0 4px 14px rgba(255, 82, 82, 0.2) !important;
          }

          .no-permission-badge {
            font-size: 0.7rem !important;
            color: rgba(255,255,255,0.3) !important;
            font-weight: 700 !important;
            height: 34px;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            letter-spacing: 0.8px;
            text-transform: uppercase;
          }

          /* Date cell styling */
          .task-date-cell {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .task-date-icon {
            width: 32px; height: 32px;
            background: rgba(100, 255, 218, 0.06);
            border: 1px solid rgba(100, 255, 218, 0.1);
            border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            font-size: 0.7rem; color: #64ffda;
          }
          .task-date-text {
            font-weight: 700; color: rgba(255,255,255,0.6); font-size: 0.82rem;
            font-variant-numeric: tabular-nums;
          }

          /* Team badge */
          .team-badge {
            display: inline-flex; align-items: center; gap: 6px;
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255,255,255,0.08);
            padding: 5px 12px; border-radius: 8px;
            font-weight: 700; font-size: 0.78rem;
            color: rgba(255,255,255,0.7);
            transition: all 0.2s;
          }
          .team-badge i { color: #5b9aff; font-size: 0.65rem; }
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
              <h2 style="margin: 0; font-size: 1.15rem; color: #fff; font-weight: 800; letter-spacing: 0.3px;">
                ${activeSiteFilter === 'TÜMÜ' ? 'Tüm İş Emirleri' : (dataService.getSites().find(s => s.id === activeSiteFilter)?.name || activeSiteFilter)}
              </h2>
              <p style="margin: 2px 0 0 0; font-size: 0.7rem; color: rgba(255,255,255,0.35); font-weight: 600; letter-spacing: 0.5px;">AKTİF GÖREVLER & İŞ EMİRLERİ</p>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; font-size: 0.75rem; color: #64ffda; font-weight: 800; background: rgba(100, 255, 218, 0.06); padding: 8px 16px; border-radius: 12px; border: 1px solid rgba(100, 255, 218, 0.12); letter-spacing: 0.5px;">
            <i class="fa-solid fa-database" style="font-size: 0.65rem; opacity: 0.7;"></i>
            ${filteredTasks.length} KAYIT
          </div>
        </div>

        <div class="glass-panel tasks-table-panel">
          <div style="overflow-x: auto;">
            <table>
              <thead>
                <tr>
                  <th><i class="fa-regular fa-calendar"></i> TARİH</th>
                  <th><i class="fa-solid fa-wind"></i> SAHA / TÜRBİN</th>
                  <th><i class="fa-solid fa-users"></i> EKİP</th>
                  <th><i class="fa-solid fa-wrench"></i> GÖREV TÜRÜ</th>
                  <th><i class="fa-solid fa-signal"></i> DURUM</th>
                  <th style="text-align: right;"><i class="fa-solid fa-bolt"></i> AKSİYON</th>
                </tr>
              </thead>
              <tbody>
                ${filteredTasks.map(task => {
                  const isReturned = (task as any).isReturnedReport;
                  const isHoldWeather = task.status === 'HOLD_WEATHER';
                  const statusClass = task.status === 'Görev Teslim Edildi' ? 'delivered' : isHoldWeather ? 'hold-weather-badge' : '';
                  return `
                  <tr style="${isReturned ? 'background: rgba(155, 89, 182, 0.03);' : ''}">
                    <td>
                      <div class="task-date-cell">
                        <div class="task-date-icon"><i class="fa-regular fa-calendar-check"></i></div>
                        <span class="task-date-text">${task.createdAt?.toDate ? task.createdAt.toDate().toLocaleDateString('tr-TR') : (task.createdAt || '...')}</span>
                      </div>
                    </td>
                    <td>
                       <div style="font-weight: 700; color: rgba(255,255,255,0.45); font-size: 0.7rem; line-height: 1.2; margin-bottom: 3px; letter-spacing: 0.5px; text-transform: uppercase;">
                         ${dataService.getSites().find(s => s.id === task.siteId)?.name || task.siteId}
                       </div>
                       <div style="font-weight: 900; color: #64ffda; font-size: 0.95rem; line-height: 1.2; letter-spacing: 0.3px;">${task.turbineId}</div>
                    </td>
                    <td>
                      <span class="team-badge">
                        <i class="fa-solid fa-user-group"></i>
                        ${formatTeamName(task.personnel)}
                      </span>
                    </td>
                    <td>
                        <div class="task-type-badge ${isReturned ? 'returned' : ''}">
                          ${(task.rawFaultCode && task.rawFaultCode !== '---') ? `
                            <div style="font-weight: 900; font-size: 0.78rem; line-height: 1.2; color: #ff6b6b; margin-bottom: 3px; letter-spacing: 0.3px;">${task.rawFaultCode}</div>
                            <div style="font-weight: 700; font-size: 0.73rem; color: rgba(255,255,255,0.7); line-height: 1.3; white-space: normal;">${task.faultCode.replace(task.rawFaultCode + ' - ', '')}</div>
                            <div style="font-size: 0.58rem; color: rgba(255,255,255,0.35); font-weight: 700; margin-top: 5px; line-height: 1.2; letter-spacing: 0.3px;">${cleanSablonName(task.secilenSablon) || 'Standart Form'}</div>
                          ` : `
                            <div style="font-weight: 800; font-size: 0.8rem; line-height: 1.2;">${cleanSablonName(task.secilenSablon) || 'Genel Görev'}</div>
                          `}
                        </div>
                    </td>
                    <td>
                      <span class="status-badge ${statusClass}" style="${!statusClass ? `background: ${isReturned ? 'rgba(155, 89, 182, 0.15)' : 'rgba(255, 170, 0, 0.08)'}; color: ${isReturned ? '#d4a0ff' : '#ffb74d'}; border: 1px solid ${isReturned ? 'rgba(155, 89, 182, 0.3)' : 'rgba(255, 170, 0, 0.15)'};` : ''}">
                        ${isReturned ? '<i class="fa-solid fa-rotate-left" style="margin-right: 5px; font-size: 0.6rem;"></i> DÜZELTME BEKLİYOR' : isHoldWeather ? '<i class="fa-solid fa-cloud-bolt fa-fade" style="margin-right: 6px;"></i> YILDIRIM ENGELLİ' : (task.status === 'Görev Teslim Edildi' ? '<i class="fa-solid fa-circle-check" style="margin-right: 5px; font-size: 0.6rem;"></i> ' + task.status : task.status)}
                      </span>
                    </td>
                    <td>
                       <div class="action-btn-container">
                         ${task.status === 'Tamamlandı' ? `
                           <button class="action-btn-main detail-btn" onclick="alert('Bu görev tamamlanmıştır.')"><i class="fa-solid fa-eye" style="margin-right: 5px; font-size: 0.65rem;"></i> DETAY</button>
                         ` : hasCompleteTaskPerm ? `
                           <button class="action-btn-main ${isReturned ? 'edit-returned' : 'fill-form'}" onclick="${isReturned ? `window.editReturnedReport('${(task as any).originalReportNo}')` : `window.handleStartTask('${task.id}')`}">
                             <i class="fa-solid ${isReturned ? 'fa-pen' : 'fa-file-pen'}" style="margin-right: 5px; font-size: 0.65rem;"></i>
                             ${isReturned ? 'DÜZELTME YAP' : 'FORMU DOLDUR'}
                           </button>
                         ` : `
                           <span class="no-permission-badge"><i class="fa-solid fa-lock" style="margin-right: 4px; font-size: 0.6rem;"></i> YETKİ YOK</span>
                         `}

                         ${task.status !== 'Tamamlandı' && !isReturned && hasTransferTaskPerm ? `
                           <button class="action-btn-main transfer-btn" onclick="window.handleTransferTask('${task.id}')" title="Görevi Transfer Et">
                             <i class="fa-solid fa-people-arrows" style="margin-right: 5px; font-size: 0.65rem;"></i> TRANSFER
                           </button>
                         ` : ''}

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

  // Real-time subscription setup
  // Dual Subscription setup
  let allTasks: any[] = [];
  let returnedReports: any[] = [];

  const updateDisplay = () => {
    // Combine and sort
    const combined = [...allTasks, ...returnedReports];
    const finalTasks = combined.filter(t => {
      const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
      
      // Adminler her zaman görünür olsun
      if (userRole === 'ADMIN') return true;
      
      const allowedSites = currentUser?.allowedSites || [];
      if (allowedSites.length > 0 && !allowedSites.includes(t.siteId)) return false;

      const userTeam = (window as any).currentUserTeam || '';
      const managedTeams = (currentUser?.managedTeams || []).map((mt: string) => mt.toUpperCase().trim());
      
      if (!userTeam && managedTeams.length === 0) return true;

      const taskPersonnel = String(t.personnel || '').toUpperCase().trim();
      const searchTeam = userTeam.toUpperCase().trim();
      
      // "SİSTEM" veya boş olanları herkese göster
      if (taskPersonnel === 'SİSTEM' || !taskPersonnel || taskPersonnel === 'ATANMADI') return true;
      
      const taskNum = taskPersonnel.replace(/[^0-9]/g, '');
      const userNum = searchTeam.replace(/[^0-9]/g, '');
      
      if (taskNum && userNum && parseInt(taskNum) === parseInt(userNum)) return true;
      
      // Kendi ekibi veya yönettiği ekiplerden biri mi?
      if (taskPersonnel.includes(searchTeam) || searchTeam.includes(taskPersonnel) || managedTeams.some((mt: string) => taskPersonnel.includes(mt))) return true;

      // İade durumu varsa göster
      if ((t as any).isReturnedReport) return true;

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
          const siteObj = dataService.getSites().find(s => s.name === sId || s.name.includes(sId));
          if (siteObj) sId = siteObj.id;
        }
        return { ...t, siteId: sId };
      });
      updateDisplay();
    });

    (window as any).returnedReportsUnsubscribe = serviceReportService.subscribeReturnedReports((reports) => {
      try {
        const mappedReports: any[] = [];
        for (const r of reports) {
          try {
            let sId = r.siteId;
            if (sId && isNaN(Number(sId))) {
                const siteObj = dataService.getSites().find(s => s.name === sId || s.name.includes(sId));
                if (siteObj) sId = siteObj.id;
            }

            let teamStr = r.team;
            if (Array.isArray(teamStr)) teamStr = teamStr[0] || 'SİSTEM';
            teamStr = teamStr || 'SİSTEM';

            mappedReports.push({
              id: r.id,
              siteId: sId || 'Bilinmiyor',
              turbineId: r.turbineNo || (r as any).turbineId || 'Bilinmiyor',
              turbinSeriNo: r.turbineSerial || '',
              personnel: formatTeamName(teamStr),
              faultCode: r.faultCode || '',
              rawFaultCode: r.faultCode || '',
              status: 'Geri Gönderildi',
              createdAt: r.date || new Date().toISOString(),
              secilenSablon: r.templateName || r.type || 'Bilinmiyor',
              isMaintenance: r.type === 'BAKIM',
              isReturnedReport: true,
              originalReportNo: r.reportNo || ''
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

  const matches = (personnelList as string[]).filter(name => name.toLocaleLowerCase('tr-TR').includes(lowerQuery));

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
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px;">
            <label style="display: flex; align-items: flex-start; gap: 1rem; cursor: pointer;">
              <input type="checkbox" id="ohs-q${i}" style="margin-top: 4px; width: 18px; height: 18px; accent-color: #f39c12;" ${isChecked} onchange="document.getElementById('ohs-q${i}-details').style.display = this.checked ? 'block' : 'none'">
              <span style="font-size: 0.95rem; color: #fff; line-height: 1.4;">${i}. ${q}</span>
            </label>
            
            <div id="ohs-q${i}-details" style="margin-top: 1rem; margin-left: 34px; display: ${isChecked ? 'block' : 'none'};">
              
              <div style="position: relative; margin-bottom: 0.8rem;">
                <input type="text" id="ohs-q${i}-name" class="cyber-input" placeholder="Personel adını yazın ve seçin..." value="${nameVal}" style="width: 100%; border-color: rgba(243, 156, 18, 0.3);"
                       onfocus="window.showOHSNameSuggestions(${i}, this.value)"
                       oninput="window.showOHSNameSuggestions(${i}, this.value)"
                       onblur="setTimeout(() => { const el = document.getElementById('ohs-personnel-dropdown-${i}'); if (el) el.style.display = 'none'; }, 200);">
                
                <div id="ohs-personnel-dropdown-${i}" class="search-results-dropdown" style="display: none; position: absolute; top: 100%; left: 0; width: 100%; max-height: 180px; overflow-y: auto; z-index: 100000; margin-top: 4px; background: rgba(10, 20, 30, 0.98); border: 1px solid var(--accent-cyan); border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.8); padding: 2px 0;"></div>
              </div>
              
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer; margin-bottom: 0.5rem; color: var(--accent-orange); font-size: 0.85rem;">
                <input type="checkbox" id="ohs-q${i}-has-note" ${hasNote} onchange="document.getElementById('ohs-q${i}-note-container').style.display = this.checked ? 'block' : 'none'">
                <i class="fa-solid fa-pen-to-square"></i> Sorun / Not Ekle
              </label>
              
              <div id="ohs-q${i}-note-container" style="display: ${hasNote ? 'block' : 'none'};">
                <textarea id="ohs-q${i}-note" class="cyber-input" placeholder="Notunuzu veya sorunu buraya yazınız..." rows="2" style="width: 100%; border-color: rgba(243, 156, 18, 0.3); resize: vertical;">${noteVal}</textarea>
              </div>
            </div>
          </div>
      `;
    });
    
    const modal = document.createElement('div');
    modal.className = 'cyber-modal-overlay fade-in';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px); padding: 1rem; box-sizing: border-box;';
    
    modal.innerHTML = `
      <div class="glass-panel" style="width: 100%; max-width: 650px; max-height: 90vh; overflow-y: auto; padding: 2rem; position: relative; border-top: 4px solid #f39c12; display: flex; flex-direction: column;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
        
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; color: #f39c12;">
          <i class="fa-solid fa-hard-hat" style="font-size: 2rem;"></i>
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; margin: 0; font-weight: 800;">İSG & SAHA GÜVENLİK KONTROLÜ</h3>
        </div>
        
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 2rem; line-height: 1.5;">Göreve başlamadan önce lütfen aşağıdaki iş sağlığı ve güvenliği kurallarını teyit ediniz.</div>
  
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          ${questionsHtml}
        </div>
  
        <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 1rem;">
          <button onclick="this.closest('.cyber-modal-overlay').remove()" class="btn-cyber-mini" style="background: transparent; color: #f39c12; border: 1px solid rgba(243, 156, 18, 0.5);">İPTAL</button>
          <button id="submit-ohs-btn" class="cyber-button primary" style="background: #f39c12; color: #000; border: none;"><i class="fa-solid fa-check"></i> ONAYLA VE GÖREVE BAŞLA</button>
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

(window as any).handleStartTask = async (taskId: string) => {
  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const taskPerms = currentUser?.allowedTabs?.tasks || {};
  const hasCompleteTaskPerm = isAdmin || (typeof taskPerms === 'object' && !!(taskPerms as any).completeTask);

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

    // 1. Show OHS Checklist First
    if (task) {
      if (task.isReturnedReport) {
        // İade edilen raporlar için İSG formunu atla, direkt düzenlemeye geç
        (window as any).navigate('form-ariza', { ...task, status: 'Geri Gönderildi' });
        return;
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const ohsList = Array.isArray(task.ohsData) ? task.ohsData : (task.ohsData?.q1 ? [task.ohsData] : []);
      const hasToday = ohsList.some((o: any) => o.date === todayStr && o.team === task.personnel);

      if (hasToday) {
        taskService.updateTaskStatus(taskId, 'Görev Teslim Edildi').catch(console.error);
        (window as any).navigate('form-ariza', { ...task, status: 'Görev Teslim Edildi' });
      } else {
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
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const taskPerms = currentUser?.allowedTabs?.tasks || {};
  const hasTransferTaskPerm = isAdmin || (typeof taskPerms === 'object' && !!(taskPerms as any).transferTask);

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
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const taskPerms = currentUser?.allowedTabs?.tasks || {};
  const hasDeleteTaskPerm = isAdmin || (typeof taskPerms === 'object' && !!(taskPerms as any).deleteTask);

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
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const taskPerms = currentUser?.allowedTabs?.tasks || {};
  const hasDeleteTaskPerm = isAdmin || (typeof taskPerms === 'object' && !!(taskPerms as any).deleteTask);

  if (!hasDeleteTaskPerm) {
    alert("Bu işlem için yetkiniz bulunmamaktadır. (Görev Silme yetkisi)");
    return;
  }

  if (!confirm('Bu geri dönen raporu kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
  
  try {
    const { serviceReportService } = await import('../services/ServiceReportService');
    await serviceReportService.deleteReport(reportId);
  } catch (error) {
    console.error("Rapor silme hatası:", error);
    alert('Rapor silinirken bir hata oluştu.');
  }
};

(window as any).editReturnedReport = async (reportNo: string) => {
    const currentUser = (window as any).currentUser;
    const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
    const taskPerms = currentUser?.allowedTabs?.tasks || {};
    const hasCompleteTaskPerm = isAdmin || (typeof taskPerms === 'object' && !!(taskPerms as any).completeTask);

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



