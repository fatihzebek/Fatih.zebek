/**
 * DashboardAgenda.ts
 * Module for handling Dashboard Agenda calendar, timeline, and turbine maintenance reminders.
 */

export interface AgendaEvent {
  date: Date;
  title: string;
  subtitle: string;
  type: 'task' | 'maintenance' | 'overdue';
  icon: string;
}

export class DashboardAgenda {
  private static agendaDate = new Date();
  private static trMonths = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  private static trDays = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];
  private static agendaEvents: AgendaEvent[] = [];

  public static init(openTasks: any[], maintenancePlan: any[], cleanSablonName: (s: string) => string) {
    this.agendaDate = new Date();
    this.agendaEvents = [];

    // Add tasks
    openTasks.forEach(t => {
      const d = t.createdAt?.toDate ? t.createdAt.toDate() : null;
      if (d) {
        const isEmergency = t.secilenSablon?.toLowerCase().includes('arıza');
        this.agendaEvents.push({
          date: d,
          title: `${t.siteId} / ${t.turbineId}`,
          subtitle: `${t.personnel || 'Atanmadı'} • ${cleanSablonName(t.secilenSablon)}`,
          type: isEmergency ? 'overdue' : 'task',
          icon: isEmergency ? 'fa-bolt-lightning' : 'fa-wrench'
        });
      }
    });

    // Add maintenance plans
    maintenancePlan.forEach(p => {
      this.agendaEvents.push({
        date: p.nextDate,
        title: `${p.siteName} / T${p.turbineNo}`,
        subtitle: p.nextType,
        type: p.status === 'overdue' ? 'overdue' : 'maintenance',
        icon: p.status === 'overdue' ? 'fa-triangle-exclamation' : 'fa-calendar-check'
      });
    });

    this.agendaEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Register global window handlers
    (window as any).selectAgendaDay = (day: number) => this.selectAgendaDay(day);
    (window as any).clearAgendaSelection = () => this.clearAgendaSelection();
    (window as any).agendaPrevMonth = () => this.agendaPrevMonth();
    (window as any).agendaNextMonth = () => this.agendaNextMonth();

    this.renderAgendaCalendar();
    this.renderAgendaTimeline();
  }

  public static selectAgendaDay(day: number) {
    const year = this.agendaDate.getFullYear();
    const month = this.agendaDate.getMonth();
    const clickedDate = new Date(year, month, day);
    
    const prevSelected = (window as any).selectedAgendaDate;
    if (prevSelected && 
        prevSelected.getFullYear() === year && 
        prevSelected.getMonth() === month && 
        prevSelected.getDate() === day) {
      (window as any).selectedAgendaDate = null;
    } else {
      (window as any).selectedAgendaDate = clickedDate;
    }
    
    this.renderAgendaCalendar();
    this.renderAgendaTimeline();
  }

  public static clearAgendaSelection() {
    (window as any).selectedAgendaDate = null;
    this.renderAgendaCalendar();
    this.renderAgendaTimeline();
  }

  public static agendaPrevMonth() {
    this.agendaDate.setMonth(this.agendaDate.getMonth() - 1);
    (window as any).selectedAgendaDate = null;
    this.renderAgendaCalendar();
    this.renderAgendaTimeline();
  }

  public static agendaNextMonth() {
    this.agendaDate.setMonth(this.agendaDate.getMonth() + 1);
    (window as any).selectedAgendaDate = null;
    this.renderAgendaCalendar();
    this.renderAgendaTimeline();
  }

  public static renderAgendaCalendar() {
    const cal = document.getElementById('agenda-mini-calendar');
    const label = document.getElementById('agenda-month-label');
    if (!cal || !label) return;

    const year = this.agendaDate.getFullYear();
    const month = this.agendaDate.getMonth();
    label.textContent = `${this.trMonths[month]} ${year}`;

    const firstDay = new Date(year, month, 1);
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    const eventDates = new Map<number, string>();
    this.agendaEvents.forEach(e => {
      if (e.date.getFullYear() === year && e.date.getMonth() === month) {
        const day = e.date.getDate();
        if (!eventDates.has(day) || e.type === 'overdue') {
          eventDates.set(day, e.type);
        }
      }
    });

    let html = '<div class="cal-header-row">';
    this.trDays.forEach(d => { html += `<span class="cal-day-name">${d}</span>`; });
    html += '</div><div class="cal-grid">';

    for (let i = 0; i < startDow; i++) {
      html += '<span class="cal-day empty"></span>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
      const isSelected = (window as any).selectedAgendaDate && 
                        (window as any).selectedAgendaDate.getFullYear() === year && 
                        (window as any).selectedAgendaDate.getMonth() === month && 
                        (window as any).selectedAgendaDate.getDate() === d;
      const evType = eventDates.get(d) || '';
      const classes = ['cal-day'];
      if (isToday) classes.push('today');
      if (isSelected) classes.push('selected');
      if (evType) classes.push('has-event', evType);
      html += `<span class="${classes.join(' ')}" onclick="window.selectAgendaDay(${d})">${d}</span>`;
    }

    html += '</div>';
    cal.innerHTML = html;
  }

  public static renderAgendaTimeline() {
    const timeline = document.getElementById('agenda-timeline');
    if (!timeline) return;

    const now = new Date();
    let filteredEvents = this.agendaEvents;
    const selectedDate = (window as any).selectedAgendaDate;

    if (selectedDate) {
      filteredEvents = this.agendaEvents.filter(e => 
        e.date.getFullYear() === selectedDate.getFullYear() &&
        e.date.getMonth() === selectedDate.getMonth() &&
        e.date.getDate() === selectedDate.getDate()
      );
    } else {
      filteredEvents = this.agendaEvents.filter(e => e.date >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));
    }

    const finalEvents = selectedDate ? filteredEvents : filteredEvents.slice(0, 8);

    if (finalEvents.length === 0) {
      if (selectedDate) {
        const selectedDayStr = selectedDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
        timeline.innerHTML = `
          <div style="text-align: center; padding: 2rem 1rem; color: var(--text-dim); font-size: 0.8rem;">
            <i class="fa-solid fa-calendar-xmark" style="font-size: 1.5rem; opacity: 0.2; margin-bottom: 0.5rem; display: block;"></i>
            <strong>${selectedDayStr}</strong> tarihinde planlanmış bir görev bulunmamaktadır.
            <button onclick="window.clearAgendaSelection()" class="btn-cyber-mini" style="margin-top: 10px; padding: 4px 10px; background: rgba(167, 139, 250, 0.08); border-color: rgba(167, 139, 250, 0.3); color: #a78bfa; font-size: 0.7rem; font-weight: 700; width: 100%; border-radius: 6px; cursor: pointer; transition: all 0.2s;">Tümünü Göster</button>
          </div>
        `;
      } else {
        timeline.innerHTML = '<div style="text-align: center; padding: 2rem 1rem; color: var(--text-dim); font-size: 0.8rem;"><i class="fa-solid fa-calendar-xmark" style="font-size: 1.5rem; opacity: 0.2; margin-bottom: 0.5rem; display: block;"></i>Yaklaşan olay bulunmuyor.</div>';
      }
      return;
    }

    let timelineHtml = '';
    if (selectedDate) {
      const selectedDayStr = selectedDate.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
      timelineHtml += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.25rem 0.5rem; margin-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.72rem; color: var(--accent-cyan); font-weight: 800; font-family: 'Rajdhani', sans-serif; text-transform: uppercase; letter-spacing: 0.5px;">
          <span>${selectedDayStr} GÖREVLERİ</span>
          <button onclick="window.clearAgendaSelection()" style="background: transparent; border: none; color: #ef4444; cursor: pointer; font-size: 0.7rem; font-weight: 800; display: flex; align-items: center; gap: 4px;" title="Tümünü Göster"><i class="fa-solid fa-xmark"></i> Filtreyi Kaldır</button>
        </div>
      `;
    }

    timelineHtml += finalEvents.map(e => {
      const dayStr = e.date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
      const isPast = e.date < now;
      const colorMap: Record<string, string> = { task: '#f59e0b', overdue: '#ef4444', maintenance: '#a78bfa' };
      const color = colorMap[e.type] || '#a78bfa';

      return `
        <div class="agenda-event-item ${isPast ? 'past' : ''}" style="--ev-color: ${color}">
          <div class="agenda-event-date">${dayStr}</div>
          <div class="agenda-event-line"><span class="agenda-event-dot"></span></div>
          <div class="agenda-event-body">
            <div class="agenda-event-title"><i class="fa-solid ${e.icon}" style="color: ${color}; margin-right: 6px; font-size: 0.65rem;"></i>${e.title}</div>
            <div class="agenda-event-sub">${e.subtitle}</div>
          </div>
        </div>
      `;
    }).join('');

    timeline.innerHTML = timelineHtml;
  }
}
