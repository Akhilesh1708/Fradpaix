/* =========================================
   FRADPAIX CRM — crm-analytics.js
   Renders both Lead Analytics and Visitor
   Intelligence tabs.
========================================= */

/* ---- Helpers ---- */
function esc(v) {
  return String(v || '').replace(/[&<>'"]/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[c]);
}

function getLeads() {
  try { return JSON.parse(localStorage.getItem('fradpaix-crm-leads')) || []; } catch { return []; }
}

function getVisitors() {
  try { return JSON.parse(localStorage.getItem('fradpaix-analytics')) || []; } catch { return []; }
}

function parsePrice(p) {
  return Number(String(p || '').replace(/[^0-9.]/g, '')) || 0;
}

function countBy(arr, getter) {
  return arr.reduce((acc, item) => {
    const k = getter(item) || 'Unspecified';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

/* ---- Render a bar list ---- */
const BAR_COLORS = [
  '#2c4fc4','#2980b9','#27ae60','#8e44ad',
  '#c0392b','#d35400','#16a085','#2c3e50'
];

function renderBarList(id, counts, colorOverride) {
  const el = document.getElementById(id);
  if (!el) return;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = entries[0]?.[1] || 1;
  if (!entries.length) {
    el.innerHTML = '<p class="an-empty">No data yet.</p>';
    return;
  }
  el.innerHTML = entries.map(([label, count], i) => {
    const color = colorOverride || BAR_COLORS[i % BAR_COLORS.length];
    const pct   = Math.max(4, (count / max) * 100);
    return `
      <div class="an-bar-row">
        <span class="an-bar-row__label" title="${esc(label)}">${esc(label)}</span>
        <span class="an-bar-row__count">${count}</span>
        <div class="an-bar-track">
          <div class="an-bar-fill" style="width:${pct}%;--bar-color:${color}"></div>
        </div>
      </div>`;
  }).join('');
}

/* =========================================
   LEAD ANALYTICS
========================================= */
function renderLeadAnalytics() {
  const leads     = getLeads();
  const confirmed = leads.filter(l => l.status === 'Confirmed');
  const total     = leads.length;
  const rate      = total ? Math.round((confirmed.length / total) * 100) : 0;
  const value     = confirmed.reduce((s, l) => s + parsePrice(l.price), 0);

  // KPI cards
  document.getElementById('kpi-total').textContent     = total;
  document.getElementById('kpi-new').textContent       = leads.filter(l => l.status === 'New').length;
  document.getElementById('kpi-confirmed').textContent = confirmed.length;
  document.getElementById('kpi-rate').textContent      = rate + '%';
  document.getElementById('kpi-value').textContent     = value
    ? '₹' + value.toLocaleString('en-IN')
    : '₹0';

  // Bar lists
  renderBarList('an-sources',    countBy(leads, l => l.source),     '#2c4fc4');
  renderBarList('an-trips',      countBy(leads.filter(l => l.trip), l => l.trip), '#27ae60');
  renderBarList('an-locations',  countBy(leads.filter(l => l.location || l.country), l => [l.location, l.country].filter(Boolean).join(', ')), '#8e44ad');
  renderBarList('an-experience', countBy(leads.filter(l => l.experience), l => l.experience), '#d35400');
  renderBarList('an-groupsize',  countBy(leads.filter(l => l.people), l => l.people + ' person' + (Number(l.people) !== 1 ? 's' : '')), '#16a085');

  // Pipeline funnel
  const STATUSES = [
    { key: 'New',       label: 'New',       bg: 'rgba(44,79,196,.18)',  color: '#7aaef5' },
    { key: 'Contacted', label: 'Contacted', bg: 'rgba(184,138,0,.18)', color: '#e6c84a' },
    { key: 'Qualified', label: 'Qualified', bg: 'rgba(47,125,246,.15)',color: '#7aaef5' },
    { key: 'Confirmed', label: 'Confirmed', bg: 'rgba(46,125,50,.18)', color: '#7ed67e' },
    { key: 'Closed',    label: 'Closed',    bg: 'rgba(80,80,80,.15)',  color: '#888'    },
  ];
  const funnelEl = document.getElementById('an-funnel');
  if (funnelEl) {
    funnelEl.innerHTML = STATUSES.map(s => {
      const cnt = leads.filter(l => l.status === s.key).length;
      const pct = total ? ((cnt / total) * 100).toFixed(1) : '0';
      return `<div class="an-funnel-row" style="background:${s.bg}">
        <span class="an-funnel-row__label" style="color:${s.color}">${s.label}</span>
        <span class="an-funnel-row__count" style="color:${s.color}">${cnt} <small style="font-size:.7rem;font-weight:400;color:${s.color};opacity:.7">(${pct}%)</small></span>
      </div>`;
    }).join('');
  }

  // Recent leads table
  const tbody  = document.getElementById('an-leads-tbody');
  const empty  = document.getElementById('an-leads-empty');
  const countEl = document.getElementById('an-leads-count');
  if (countEl) countEl.textContent = `${total} total`;

  if (!tbody) return;
  if (!leads.length) {
    document.getElementById('an-leads-table').style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  const recent = leads.slice(0, 30); // show latest 30
  tbody.innerHTML = recent.map(l => {
    const location = [l.location, l.country].filter(Boolean).join(', ') || '—';
    const statusCls = 'sp--' + (l.status || 'New').replace(/\s/g, '');
    return `<tr>
      <td><strong style="color:#fff">${esc(l.name)}</strong></td>
      <td>${esc(l.trip || '—')}</td>
      <td>
        ${l.phone ? `<a href="tel:${esc(l.phone)}" style="color:#7aaef5">${esc(l.phone)}</a><br>` : ''}
        ${l.email ? `<a href="mailto:${esc(l.email)}" style="color:#7aaef5;font-size:.78rem">${esc(l.email)}</a>` : ''}
      </td>
      <td class="muted">${esc(location)}</td>
      <td class="muted">${esc(l.createdAt || '—')}</td>
      <td class="muted">${esc(l.source || '—')}</td>
      <td><span class="status-pill ${statusCls}">${esc(l.status || 'New')}</span></td>
    </tr>`;
  }).join('');

  // Export leads as CSV
  document.getElementById('an-export-leads')?.addEventListener('click', () => {
    const headers = ['Name','Phone','Email','Trip','Dates','People','Location','Country','Source','Status','Price','Experience','Age','Created'];
    const rows = leads.map(l => [
      l.name, l.phone, l.email, l.trip, l.dates, l.people,
      l.location, l.country, l.source, l.status, l.price,
      l.experience, l.age, l.createdAt
    ].map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(','));
    const csv  = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href     = URL.createObjectURL(blob);
    link.download = `fradpaix-leads-${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

/* =========================================
   VISITOR INTELLIGENCE
========================================= */
function renderVisitorAnalytics() {
  const visitors = getVisitors();
  const total    = visitors.length;
  const views    = visitors.reduce((s, v) => s + (v.pageViews || 0), 0);
  const countries= new Set(visitors.map(v => v.country).filter(Boolean)).size;
  const mobile   = visitors.filter(v => ['Mobile','Tablet'].includes(v.device?.device)).length;
  const avg      = total ? (views / total).toFixed(1) : '0';

  // KPIs
  document.getElementById('v-kpi-total').textContent     = total;
  document.getElementById('v-kpi-views').textContent     = views;
  document.getElementById('v-kpi-countries').textContent = countries;
  document.getElementById('v-kpi-mobile').textContent    = mobile;
  document.getElementById('v-kpi-avg').textContent       = avg;

  // Bar lists
  renderBarList('v-countries', countBy(visitors, v => v.country),         '#2c4fc4');
  renderBarList('v-browsers',  countBy(visitors, v => v.device?.browser), '#27ae60');
  renderBarList('v-devices',   countBy(visitors, v => v.device?.device),  '#8e44ad');
  renderBarList('v-os',        countBy(visitors, v => v.device?.os),      '#d35400');

  // Top pages — flatten all pagesVisited arrays
  const allPages = visitors.flatMap(v =>
    Array.isArray(v.pagesVisited) ? v.pagesVisited.map(p => p.page || '—') : []
  );
  renderBarList('v-pages', countBy(allPages, p => p), '#16a085');

  // Visitor table
  const tbody = document.getElementById('v-tbody');
  const empty = document.getElementById('v-empty');
  if (!tbody) return;

  if (!visitors.length) {
    document.getElementById('v-table').style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }

  tbody.innerHTML = visitors.map(v => {
    const location  = [v.city, v.region, v.country].filter(Boolean).join(', ') || '—';
    const browserOs = [v.device?.browser, v.device?.os].filter(Boolean).join(' / ') || '—';
    const device    = v.device?.device || '—';
    const pages     = Array.isArray(v.pagesVisited)
      ? [...new Set(v.pagesVisited.map(p => p.page))].join(', ')
      : '—';
    return `<tr>
      <td class="mono">${esc(v.ip)}</td>
      <td>${esc(location)}</td>
      <td>${esc(browserOs)}</td>
      <td>${esc(device)}</td>
      <td class="muted" style="max-width:200px;word-break:break-word">${esc(pages)}</td>
      <td class="muted">${esc(v.firstSeen || '—')}</td>
      <td class="muted">${esc(v.lastSeen  || '—')}</td>
    </tr>`;
  }).join('');

  // Export visitors JSON
  document.getElementById('an-export-visitors')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(visitors, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href     = URL.createObjectURL(blob);
    link.download = `fradpaix-visitors-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

/* ---- Boot ---- */
renderLeadAnalytics();
renderVisitorAnalytics();
