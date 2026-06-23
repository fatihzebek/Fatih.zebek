import { dataService } from '../services/DataService';

interface ReportEntry {
  file: string;
  name: string;
  date: string;
  timestamp: number;
  reportUrl: string;
}

let reportsIndex: ReportEntry[] = [];
let selectedReportFile: string | null = null;

const renderMarkdown = (md: string): string => {
  if (!md) return '';
  
  let html = md;
  
  // Escape HTML entities to prevent XSS but allow markdown tags
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
    
  // Handle code blocks (```language ... ```)
  html = html.replace(/```([a-zA-Z0-9+#-]*)\n([\s\S]*?)```/g, (match, lang, codeContent) => {
    const language = lang ? lang.trim().toUpperCase() : 'CODE';
    return `<div class="cyber-code-container"><div class="code-header">${language}</div><pre class="cyber-code-block"><code>${codeContent.trim()}</code></pre></div>`;
  });
  
  // Handle inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code class="cyber-inline-code">$1</code>');
  
  // Handle headers
  html = html.replace(/^### (.*$)/gim, '<h4 class="md-h3">$1</h4>');
  html = html.replace(/^## (.*$)/gim, '<h3 class="md-h2">$1</h3>');
  html = html.replace(/^# (.*$)/gim, '<h2 class="md-h1">$1</h2>');
  
  // Handle GitHub-style alerts: > [!NOTE] or > [!WARNING]
  html = html.replace(/^\s*&gt;\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*?)(?=\n\n|\n[^\s&gt;]|$)/gim, (match, type, content) => {
    let icon = 'fa-circle-info';
    if (type === 'WARNING' || type === 'CAUTION') icon = 'fa-triangle-exclamation';
    if (type === 'TIP') icon = 'fa-lightbulb';
    if (type === 'IMPORTANT') icon = 'fa-circle-exclamation';
    
    return `<div class="md-alert ${type.toLowerCase()}"><div class="alert-title"><i class="fa-solid ${icon}"></i> ${type}</div><div class="alert-content">${content.trim()}</div></div>`;
  });
  
  // Handle simple blockquotes
  html = html.replace(/^\s*&gt;\s*(.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');
  
  // Handle lists (bullets)
  html = html.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="md-li">$1</li>');
  
  // Wrap li groups in ul
  html = html.replace(/(<li class="md-li">[\s\S]*?<\/li>)/gi, (match) => {
    return `<ul class="md-ul">${match}</ul>`;
  });
  // Clean up adjacent <ul> tags
  html = html.replace(/<\/ul>\s*<ul class="md-ul">/g, '');
  
  // Handle bold text (**text**)
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  
  // Handle horizontal rules
  html = html.replace(/^\s*---\s*$/gim, '<hr class="md-hr">');
  
  // Replace single newlines with break, double with paragraph
  const blocks = html.split(/(<div class="cyber-code-container">[\s\S]*?<\/div>)/g);
  for (let i = 0; i < blocks.length; i++) {
    if (!blocks[i].startsWith('<div class="cyber-code-container">')) {
      blocks[i] = blocks[i].replace(/\n\n/g, '</p><p class="md-p">');
      blocks[i] = blocks[i].replace(/\n/g, '<br>');
    }
  }
  html = blocks.join('');
  
  return `<p class="md-p">${html}</p>`;
};

export const CodeAdvisorAgentPage = async () => {
  return `
    <div class="code-advisor-page-wrapper">
      <div style="display: flex; gap: 1.5rem; flex-direction: column;">
        
        <!-- Header -->
        <div class="glass-panel" style="padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; border-color: rgba(20, 241, 149, 0.25);">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; background: rgba(20, 241, 149, 0.08); border-radius: 12px; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(20, 241, 149, 0.25);">
              <i class="fa-solid fa-code" style="color: #14f195; font-size: 1.25rem;"></i>
            </div>
            <div>
              <h2 style="margin: 0; font-size: 1.25rem; color: #fff; font-weight: 800; letter-spacing: 0.5px;">AI KOD DANIŞMANI VE QA AJANI</h2>
              <p style="margin: 2px 0 0 0; font-size: 0.72rem; color: #14f195; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;">
                <span class="status-indicator-dot"></span> AJAN YEREL ORTAMDA AKTİF
              </p>
            </div>
          </div>
          <button class="cyber-button secondary" onclick="window.showCodeAdvisorGuide()" style="padding: 6px 14px; font-size: 0.75rem; font-weight: bold;">
            <i class="fa-solid fa-circle-question"></i> NASIL ÇALIŞIR?
          </button>
        </div>

        <!-- Main Workspace -->
        <div class="advisor-columns-container">
          
          <!-- Left Column: File List -->
          <div class="advisor-files-sidebar glass-panel">
            <h3 class="panel-section-title"><i class="fa-solid fa-folder-open"></i> ANALİZ EDİLEN DOSYALAR</h3>
            <div id="advisor-files-list" class="advisor-files-list-scroller">
              <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
                <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem; color: #14f195;"></i>
                <p style="font-size: 0.8rem;">Dizin okunuyor...</p>
              </div>
            </div>
          </div>
          
          <!-- Right Column: Report Viewer -->
          <div class="advisor-report-viewer glass-panel">
            <div id="advisor-report-content" class="advisor-report-content-scroller">
              <div class="report-empty-state">
                <i class="fa-solid fa-terminal" style="font-size: 3.5rem; margin-bottom: 1.5rem; opacity: 0.15; color: #14f195;"></i>
                <h3 style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 1.2rem; color: var(--text-main); margin-bottom: 0.5rem;">Analiz Raporu Seçilmedi</h3>
                <p style="color: var(--text-muted); font-size: 0.85rem; max-width: 320px; line-height: 1.4;">Soldaki menüden analiz edilmiş bir kod dosyasını seçerek yapay zeka raporunu görüntüleyebilirsiniz.</p>
              </div>
            </div>
          </div>

        </div>

      </div>

      <!-- Markdown & Custom Styling -->
      <style>
        .code-advisor-page-wrapper {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          height: 100%;
          min-height: calc(100vh - 120px);
        }
        .status-indicator-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          background-color: #14f195;
          border-radius: 50%;
          margin-right: 4px;
          box-shadow: 0 0 8px #14f195;
          animation: status-pulse 1.8s infinite alternate;
        }
        @keyframes status-pulse {
          0% { opacity: 0.5; transform: scale(0.9); }
          100% { opacity: 1; transform: scale(1.1); }
        }
        .advisor-columns-container {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 1.5rem;
          height: calc(100vh - 220px);
          min-height: 500px;
        }
        @media (max-width: 992px) {
          .advisor-columns-container {
            grid-template-columns: 1fr;
            height: auto;
          }
          .advisor-files-sidebar {
            height: 250px !important;
          }
          .advisor-report-viewer {
            height: 500px !important;
          }
        }
        .panel-section-title {
          font-family: 'Rajdhani', sans-serif;
          font-size: 0.85rem;
          font-weight: 800;
          letter-spacing: 1px;
          color: rgba(255,255,255,0.4);
          margin: 0 0 1rem 0;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .advisor-files-sidebar {
          padding: 1.25rem !important;
          display: flex;
          flex-direction: column;
          height: 100%;
          box-sizing: border-box;
        }
        .advisor-files-list-scroller {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 4px;
        }
        .advisor-report-viewer {
          padding: 1.5rem !important;
          display: flex;
          flex-direction: column;
          height: 100%;
          box-sizing: border-box;
          border-color: rgba(255, 255, 255, 0.06);
          background: rgba(10, 14, 23, 0.45);
        }
        .advisor-report-content-scroller {
          flex: 1;
          overflow-y: auto;
          padding-right: 8px;
        }
        
        /* File Card Styling */
        .file-entry-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 10px 14px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          text-align: left;
        }
        .file-entry-card:hover {
          background: rgba(20, 241, 149, 0.03);
          border-color: rgba(20, 241, 149, 0.2);
          transform: translateX(3px);
        }
        .file-entry-card.active {
          background: rgba(20, 241, 149, 0.06) !important;
          border-color: rgba(20, 241, 149, 0.35) !important;
          box-shadow: inset 3px 0 0 #14f195;
        }
        .file-card-title {
          font-weight: 800;
          color: #fff;
          font-size: 0.85rem;
          margin-bottom: 4px;
          font-family: 'Rajdhani', sans-serif;
          letter-spacing: 0.3px;
        }
        .file-card-subtitle {
          color: var(--text-muted);
          font-size: 0.68rem;
          font-family: monospace;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .file-card-date {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.6rem;
          color: rgba(255,255,255,0.3);
          margin-top: 6px;
          font-weight: 600;
        }

        /* Empty state styling */
        .report-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: var(--text-muted);
          padding: 3rem 0;
        }

        /* Markdown Rendering Custom Styles */
        .markdown-report-container {
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.88rem;
          line-height: 1.6;
          text-align: left;
        }
        .md-h1 {
          font-family: 'Rajdhani', sans-serif;
          font-size: 1.4rem;
          color: #fff;
          border-bottom: 2px solid rgba(20, 241, 149, 0.3);
          padding-bottom: 8px;
          margin: 1.5rem 0 1rem 0;
          font-weight: 800;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .md-h2 {
          font-family: 'Rajdhani', sans-serif;
          font-size: 1.15rem;
          color: #14f195;
          margin: 1.6rem 0 0.8rem 0;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .md-h3 {
          font-family: 'Rajdhani', sans-serif;
          font-size: 0.95rem;
          color: #60a5fa;
          margin: 1.2rem 0 0.6rem 0;
          font-weight: 700;
        }
        .md-p {
          margin: 0 0 1rem 0;
        }
        .md-ul {
          margin: 0 0 1rem 1rem;
          padding-left: 0.5rem;
        }
        .md-li {
          margin-bottom: 6px;
          list-style-type: square;
          color: rgba(255, 255, 255, 0.8);
        }
        .md-li strong {
          color: #fff;
        }
        .md-quote {
          border-left: 3px solid rgba(255,255,255,0.2);
          margin: 0 0 1rem 0;
          padding: 4px 0 4px 12px;
          color: var(--text-muted);
          font-style: italic;
          background: rgba(255,255,255,0.01);
        }
        .md-hr {
          border: none;
          height: 1px;
          background: rgba(255,255,255,0.08);
          margin: 1.5rem 0;
        }
        
        /* Inline code style */
        .cyber-inline-code {
          background: rgba(20, 241, 149, 0.08);
          color: #14f195;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.78rem;
          font-family: monospace;
          border: 1px solid rgba(20, 241, 149, 0.15);
        }
        
        /* Code Block container */
        .cyber-code-container {
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 8px;
          overflow: hidden;
          margin: 1rem 0;
          background: #06090e;
        }
        .code-header {
          background: rgba(255,255,255,0.02);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 6px 12px;
          font-size: 0.62rem;
          font-weight: 800;
          color: rgba(255,255,255,0.4);
          font-family: 'Rajdhani', sans-serif;
          letter-spacing: 1px;
        }
        .cyber-code-block {
          margin: 0;
          padding: 12px;
          overflow-x: auto;
        }
        .cyber-code-block code {
          font-family: monospace;
          font-size: 0.78rem;
          color: #e2e8f0;
          line-height: 1.4;
        }

        /* Alert Callouts */
        .md-alert {
          border-radius: 8px;
          padding: 12px 16px;
          margin: 1rem 0;
          border-left: 4px solid;
          text-align: left;
        }
        .md-alert.note {
          background: rgba(59, 130, 246, 0.05);
          border-color: #3b82f6;
          color: #93c5fd;
        }
        .md-alert.note .alert-title { color: #3b82f6; }
        
        .md-alert.tip {
          background: rgba(20, 241, 149, 0.05);
          border-color: #14f195;
          color: #a7f3d0;
        }
        .md-alert.tip .alert-title { color: #14f195; }
        
        .md-alert.important {
          background: rgba(139, 92, 246, 0.05);
          border-color: #8b5cf6;
          color: #c084fc;
        }
        .md-alert.important .alert-title { color: #8b5cf6; }
        
        .md-alert.warning {
          background: rgba(245, 158, 11, 0.05);
          border-color: #f59e0b;
          color: #fde047;
        }
        .md-alert.warning .alert-title { color: #f59e0b; }
        
        .md-alert.caution {
          background: rgba(239, 68, 68, 0.05);
          border-color: #ef4444;
          color: #fca5a5;
        }
        .md-alert.caution .alert-title { color: #ef4444; }
        
        .alert-title {
          font-family: 'Rajdhani', sans-serif;
          font-weight: 800;
          font-size: 0.75rem;
          margin-bottom: 6px;
          letter-spacing: 0.5px;
        }
        .alert-content {
          font-size: 0.82rem;
          line-height: 1.5;
        }
      </style>
    </div>
  `;
};

// Global hook for initialization
(window as any).initCodeAdvisorPage = async () => {
  const listContainer = document.getElementById('advisor-files-list');
  if (!listContainer) return;

  try {
    const response = await fetch('/reports/index.json');
    if (!response.ok) {
      throw new Error("Dizin bulunamadı");
    }
    
    const data = await response.json();
    reportsIndex = Array.isArray(data) ? data : [];
    
    // Sort reports by newest timestamp
    reportsIndex.sort((a, b) => b.timestamp - a.timestamp);
    
    if (reportsIndex.length === 0) {
      listContainer.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
          <i class="fa-solid fa-folder-minus" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
          <p style="font-size: 0.8rem;">Henüz bir kod analizi yapılmamış.</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = reportsIndex.map(item => `
      <div id="file-card-${item.timestamp}" class="file-entry-card ${selectedReportFile === item.reportUrl ? 'active' : ''}" onclick="window.selectReportFile('${item.reportUrl}', ${item.timestamp})">
        <div class="file-card-title">${item.name}</div>
        <div class="file-card-subtitle" title="${item.file}">${item.file}</div>
        <div class="file-card-date">
          <i class="fa-regular fa-clock"></i> Analiz: ${item.date}
        </div>
      </div>
    `).join('');

    // Auto-select first report if none is selected
    if (!selectedReportFile && reportsIndex.length > 0) {
      (window as any).selectReportFile(reportsIndex[0].reportUrl, reportsIndex[0].timestamp);
    } else if (selectedReportFile) {
      // Find matching report in index to update active styling
      const match = reportsIndex.find(r => r.reportUrl === selectedReportFile);
      if (match) {
        (window as any).selectReportFile(match.reportUrl, match.timestamp);
      }
    }

  } catch (error) {
    console.warn("Index load failed, listing fallback:", error);
    listContainer.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--text-muted);">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; margin-bottom: 0.5rem; color: var(--accent-red); opacity: 0.7;"></i>
        <p style="font-size: 0.8rem; margin-bottom: 8px;">Dizin yüklenemedi.</p>
        <button class="cyber-button secondary" onclick="window.initCodeAdvisorPage()" style="padding: 4px 10px; font-size: 0.65rem;"><i class="fa-solid fa-rotate"></i> YENİDEN DENE</button>
      </div>
    `;
  }
};

(window as any).selectReportFile = async (reportUrl: string, timestamp: number) => {
  selectedReportFile = reportUrl;
  
  // Update selected class
  document.querySelectorAll('.file-entry-card').forEach(el => el.classList.remove('active'));
  const card = document.getElementById(`file-card-${timestamp}`);
  if (card) card.classList.add('active');

  const viewer = document.getElementById('advisor-report-content');
  if (!viewer) return;

  viewer.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--text-muted);">
      <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="margin-bottom: 1rem; color: #14f195;"></i>
      <p style="font-size: 0.85rem;">Analiz raporu sunucudan indiriliyor...</p>
    </div>
  `;

  try {
    const response = await fetch(reportUrl);
    if (!response.ok) {
      throw new Error("Rapor dosyası okunamadı.");
    }
    const mdContent = await response.text();
    const renderedHtml = renderMarkdown(mdContent);
    viewer.innerHTML = `
      <div class="markdown-report-container fade-in">
        ${renderedHtml}
      </div>
    `;
  } catch (err: any) {
    console.error(err);
    viewer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; color: var(--accent-red); padding: 2rem;">
        <i class="fa-solid fa-circle-xmark fa-3x" style="margin-bottom: 1rem;"></i>
        <h4 style="font-family: 'Rajdhani'; font-weight: 700; margin-bottom: 8px;">Rapor Yüklenemedi</h4>
        <p style="color: var(--text-muted); font-size: 0.8rem; max-width: 300px; line-height: 1.4; margin-bottom: 1.5rem;">İlgili analiz raporu dosyası bulunamadı veya hosting senkronizasyonu tamamlanmadı.</p>
        <button class="cyber-button secondary" onclick="window.selectReportFile('${reportUrl}', ${timestamp})" style="font-size: 0.7rem; padding: 6px 14px;"><i class="fa-solid fa-rotate"></i> RAPORU TEKRAR YÜKLE</button>
      </div>
    `;
  }
};

(window as any).showCodeAdvisorGuide = () => {
  const modal = document.createElement('div');
  modal.className = 'cyber-modal-overlay fade-in';
  modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); padding: 1rem; box-sizing: border-box;';
  
  modal.innerHTML = `
    <div class="glass-panel" style="width: 100%; max-width: 550px; padding: 2rem; position: relative; border-top: 4px solid #14f195; display: flex; flex-direction: column; box-sizing: border-box;">
      <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
      
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; color: #14f195;">
        <i class="fa-solid fa-circle-info" style="font-size: 2rem;"></i>
        <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; margin: 0; font-weight: 800; letter-spacing: 0.5px;">YAPAY ZEKA AJANI KULLANIM KILAVUZU</h3>
      </div>
      
      <div style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; display: flex; flex-direction: column; gap: 12px;">
        <p>AI Kod Danışmanı ve QA Ajanı, projenizdeki dosyaların kalitesini, mimarisini ve mantıksal güvenliğini inceleyen bir yardımcıdır.</p>
        
        <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 8px;">
          <strong style="color: #fff; font-size: 0.78rem; display: block; margin-bottom: 6px;">YENİ ANALİZ BAŞLATMA ADIMLARI:</strong>
          <ol style="margin: 0; padding-left: 1.25rem; font-size: 0.8rem; color: rgba(255,255,255,0.75);">
            <li style="margin-bottom: 4px;">Yerel bilgisayarınızda bir terminal / komut satırı açın.</li>
            <li style="margin-bottom: 4px;">Projenin ana dizininde <code style="color:#14f195; font-family:monospace; background:rgba(20,241,149,0.08); padding:1px 4px; border-radius:3px;">npm run advise</code> komutunu çalıştırın.</li>
            <li style="margin-bottom: 4px;">Karşınıza gelen listeden analiz etmek istediğiniz dosyanın numarasını seçip Enter'a basın.</li>
            <li style="margin-bottom: 4px;">Analiz tamamlandıktan sonra, web arayüzünü yenileyerek veya yeniden deploy ederek raporları burada listeleyin.</li>
          </ol>
        </div>

        <div style="font-size: 0.78rem; border-left: 2px dashed rgba(20, 241, 149, 0.4); padding-left: 10px; color: rgba(20, 241, 149, 0.8);">
          💡 <strong>İpucu:</strong> Analiz aracımız arka planda en güncel <code style="color:#fff;">gemini-2.5-flash</code> yapay zeka modelini kullanır ve raporları statik olarak <code style="color:#fff;">public/reports</code> altına kaydeder.
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" class="cyber-button primary" style="background:#14f195; color:#000; border:none; font-weight:bold; letter-spacing:0.5px; padding: 6px 16px; font-size: 0.8rem;">ANLAŞILDI</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};
