/**
 * DashboardFeed.ts
 * Module for handling Dashboard stats counter animations, agent monitoring widget, and activity feeds.
 */

import { agentHealthService } from '../../services/AgentHealthService';

export class DashboardFeed {
  public static initCounterAnimations() {
    document.querySelectorAll('.dash-stat-card .value[data-count]').forEach(el => {
      const target = parseInt(el.getAttribute('data-count') || '0');
      if (target === 0) { el.textContent = '0'; return; }
      let current = 0;
      const increment = Math.max(1, Math.ceil(target / 25));
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) { current = target; clearInterval(timer); el.classList.add('counted'); }
        el.textContent = String(current);
      }, 30);
    });
  }

  public static initAgentMonitoring(currentUserRole?: string) {
    if (currentUserRole === 'ADMIN') {
      const agentGrid = document.getElementById('dash-agent-grid');
      if (agentGrid) {
        agentHealthService.subscribeToAgents((agents) => {
          agentGrid.innerHTML = agents.slice(0, 4).map(agent => `
            <div class="agent-mini-tag ${agent.status}">
              <span class="pulse-dot"></span>
              <span class="agent-name">${agent.name.split(' ')[0]}</span>
            </div>
          `).join('');
        });
      }
    }
  }

  public static updateStatValues(activeCount: number, emCount: number) {
    const activeStatVal = document.getElementById('dash-stat-active-val');
    if (activeStatVal) {
      activeStatVal.setAttribute('data-count', String(activeCount));
      activeStatVal.textContent = String(activeCount);
    }
    const emStatVal = document.getElementById('dash-stat-em-val');
    if (emStatVal) {
      emStatVal.setAttribute('data-count', String(emCount));
      emStatVal.textContent = String(emCount);
    }
  }
}
