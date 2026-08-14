/* =========================================
   FRADPAIX CRM — crm.js
========================================= */

const CRM_STORE_KEY = 'fradpaix-crm-leads';

function getCrmLeads() {
  try { return JSON.parse(localStorage.getItem(CRM_STORE_KEY)) || []; } catch { return []; }
}
function saveCrmLeads(leads) {
  localStorage.setItem(CRM_STORE_KEY, JSON.stringify(leads));
}

function esc(v) {
  return String(v || '').replace(/[&<>'"]/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[c]);
}

/* ---- Status badge colours ---- */
const STATUS_COLORS = {
  'New':       '#2c4fc4',
  'Contacted': '#b88a00',
  'Qualified': '#7aaef5',
  'Confirmed': '#2e7d32',
  'Closed':    '#555'
};

/* ---- Render stat cards ---- */
function renderStats(leads) {
  const total     = leads.length;
  const newCount  = leads.filter(l => l.status === 'New').length;
  const contacted = leads.filter(l => l.status === 'Contacted').length;
  const confirmed = leads.filter(l => l.status === 'Confirmed').length;
  const rate      = total ? Math.round((confirmed / total) * 100) : 0;

  document.getElementById('crm-total')?.setAttribute('data-val', total);
  document.getElementById('crm-new')?.setAttribute('data-val', newCount);
  document.getElementById('crm-contacted')?.setAttribute('data-val', contacted);
  document.getElementById('crm-confirmed')?.setAttribute('data-val', confirmed);
  document.getElementById('crm-rate')?.setAttribute('data-val', rate + '%');

  ['crm-total','crm-new','crm-contacted','crm-confirmed','crm-rate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = el.dataset.val;
  });
}

/* ---- Build a detail chip ---- */
function chip(icon, label, value) {
  if (!value) return '';
  return `<span class="crm-detail-chip">${icon} ${esc(label)}: ${esc(value)}</span>`;
}

/* ---- Render lead cards ---- */
function renderLeads(leads) {
  const list = document.getElementById('crm-list');
  if (!list) return;

  if (!leads.length) {
    list.innerHTML = `
      <div class="crm-empty">
        <svg viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <h3>No leads found</h3>
        <p>Enquiries from booking and contact forms will appear here.</p>
      </div>`;
    return;
  }

  const isAdmin = CRM_AUTH.getRole() === 'admin';

  list.innerHTML = leads.map(lead => {
    const locationStr = [lead.location, lead.country].filter(Boolean).join(', ');
    const statusColor = STATUS_COLORS[lead.status] || '#2c4fc4';

    // Build chips from all available fields
    const chips = [
      locationStr   ? `<span class="crm-detail-chip">📍 ${esc(locationStr)}</span>` : '',
      chip('🌐', 'Region',     lead.region),
      chip('👥', 'Group',      lead.people),
      chip('🎂', 'Age',        lead.age),
      chip('🏔️', 'Experience', lead.experience),
      chip('💪', 'Fitness',    lead.fitness),
      chip('💰', 'Price',      lead.price),
      chip('💰', 'Budget',     lead.budget),
      chip('🎒', 'Add-ons',    lead.addons),
      chip('📌', 'Subject',    lead.subject),
      chip('🏥', 'Medical',    lead.medical),
    ].filter(Boolean).join('');

    const hasExtra = lead.message || lead.medical || lead.addons;

    return `
    <div class="crm-lead-card status--${esc(lead.status)}" id="lead-${esc(lead.id)}">
      <div class="crm-lead-card__top">
        <div class="crm-lead-card__stripe" style="background:${statusColor}"></div>
        <div class="crm-lead-card__main">

          <!-- Identity -->
          <div class="crm-lead-card__identity">
            <div class="crm-lead-card__name">${esc(lead.name)}</div>
            <div class="crm-lead-card__source">${esc(lead.source)} · ${esc(lead.createdAt)}</div>
            <div class="crm-lead-card__trip">
              ${esc(lead.trip || 'General enquiry')}
              ${lead.dates ? `<span class="crm-lead-card__date"> · ${esc(lead.dates)}</span>` : ''}
            </div>
            ${hasExtra ? `<button class="crm-expand-btn" data-expand="${esc(lead.id)}">
              show more ▾
            </button>` : ''}
          </div>

          <!-- Contact -->
          <div class="crm-lead-card__contact">
            ${lead.phone ? `<a href="tel:${esc(lead.phone)}">📞 ${esc(lead.phone)}</a>` : ''}
            ${lead.email ? `<a href="mailto:${esc(lead.email)}">✉ ${esc(lead.email)}</a>` : ''}
          </div>

          <!-- Detail chips -->
          <div class="crm-lead-card__details">${chips || '<span class="crm-detail-chip" style="color:#3d5066">No extra details</span>'}</div>

        </div>

        <!-- Actions -->
        <div class="crm-lead-card__actions">
          <select class="crm-status-select" data-id="${esc(lead.id)}" aria-label="Status">
            ${['New','Contacted','Qualified','Confirmed','Closed'].map(s =>
              `<option value="${s}" ${lead.status === s ? 'selected' : ''}>${s}</option>`
            ).join('')}
          </select>
          ${isAdmin ? `<button class="crm-delete-btn" data-delete="${esc(lead.id)}">🗑 Delete</button>` : ''}
        </div>
      </div>

      <!-- Expandable extra info -->
      ${hasExtra ? `
      <div class="crm-lead-card__message">
        ${lead.message ? `<p>💬 "${esc(lead.message)}"</p>` : ''}
        ${lead.medical ? `<p style="margin-top:6px">🏥 Medical: ${esc(lead.medical)}</p>` : ''}
        ${lead.addons  ? `<p style="margin-top:6px">🎒 Add-ons: ${esc(lead.addons)}</p>`  : ''}
      </div>` : ''}
    </div>`;
  }).join('');
}

/* ---- Main render ---- */
let sortOrder = 'newest';

function renderCrm() {
  const query       = (document.getElementById('crm-search')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('crm-filter')?.value || 'all';
  const sourceFilter = document.getElementById('crm-source-filter')?.value || 'all';

  let leads = getCrmLeads();

  // Filter
  leads = leads.filter(lead => {
    const text = `${lead.name} ${lead.trip} ${lead.phone} ${lead.email} ${lead.location||''} ${lead.country||''} ${lead.subject||''} ${lead.experience||''}`.toLowerCase();
    const matchText   = text.includes(query);
    const matchStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchSource = sourceFilter === 'all' || (lead.source || '').toLowerCase().includes(sourceFilter.toLowerCase());
    return matchText && matchStatus && matchSource;
  });

  // Sort
  if (sortOrder === 'oldest') {
    leads = leads.slice().reverse();
  }

  renderStats(getCrmLeads()); // stats always on full set
  renderLeads(leads);
}

/* ---- Init dashboard ---- */
function initCrmDashboard() {
  if (!document.getElementById('crm-list')) return;

  // Search + filters
  document.getElementById('crm-search')?.addEventListener('input', renderCrm);
  document.getElementById('crm-filter')?.addEventListener('change', renderCrm);
  document.getElementById('crm-source-filter')?.addEventListener('change', renderCrm);

  // Sort buttons
  document.getElementById('sort-newest')?.addEventListener('click', function() {
    sortOrder = 'newest';
    document.getElementById('sort-newest')?.classList.add('active');
    document.getElementById('sort-oldest')?.classList.remove('active');
    renderCrm();
  });
  document.getElementById('sort-oldest')?.addEventListener('click', function() {
    sortOrder = 'oldest';
    document.getElementById('sort-oldest')?.classList.add('active');
    document.getElementById('sort-newest')?.classList.remove('active');
    renderCrm();
  });

  // Manual add form
  document.getElementById('crm-manual-form')?.addEventListener('submit', function(event) {
    event.preventDefault();
    const name = document.getElementById('crm-manual-name').value.trim();
    if (!name) { document.getElementById('crm-manual-name').focus(); return; }
    const leads = getCrmLeads();
    leads.unshift({
      id:        `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      status:    'New',
      createdAt: new Date().toLocaleString('en-IN'),
      source:    document.getElementById('crm-manual-source').value,
      name,
      phone:     document.getElementById('crm-manual-phone').value.trim(),
      location:  document.getElementById('crm-manual-location').value.trim(),
      trip:      document.getElementById('crm-manual-trip').value.trim()
    });
    saveCrmLeads(leads);
    this.reset();
    renderCrm();
  });

  // Status change + delete + expand (event delegation)
  document.getElementById('crm-list')?.addEventListener('change', function(event) {
    if (!event.target.matches('.crm-status-select')) return;
    const id = event.target.dataset.id;
    const leads = getCrmLeads().map(l => l.id === id ? { ...l, status: event.target.value } : l);
    saveCrmLeads(leads);
    renderCrm();
  });

  document.getElementById('crm-list')?.addEventListener('click', function(event) {
    // Delete
    const delId = event.target.closest('[data-delete]')?.dataset.delete;
    if (delId) {
      if (!confirm('Delete this lead permanently?')) return;
      saveCrmLeads(getCrmLeads().filter(l => l.id !== delId));
      renderCrm();
      return;
    }
    // Expand / collapse message
    const expId = event.target.closest('[data-expand]')?.dataset.expand;
    if (expId) {
      const card = document.getElementById('lead-' + expId);
      const expanded = card?.classList.toggle('expanded');
      event.target.textContent = expanded ? 'show less ▴' : 'show more ▾';
    }
  });

  // Export
  document.getElementById('crm-export')?.addEventListener('click', function() {
    const blob = new Blob([JSON.stringify(getCrmLeads(), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href     = URL.createObjectURL(blob);
    link.download = `fradpaix-leads-${new Date().toISOString().slice(0,10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  // Clear all (admin only)
  document.getElementById('crm-clear')?.addEventListener('click', function() {
    if (CRM_AUTH.getRole() !== 'admin') return;
    if (!confirm('Permanently delete ALL leads? This cannot be undone.')) return;
    saveCrmLeads([]);
    renderCrm();
  });

  renderCrm();
}

initCrmDashboard();
