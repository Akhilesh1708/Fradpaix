/* =========================================
   FRADPAIX CRM — Inventory (synced via Google Sheets)
========================================= */

const INV_KEY      = 'fradpaix-inventory';
const HISTORY_KEY  = 'fradpaix-inv-history';
const SHEETS_URL   = window._FRADPAIX_SHEETS_URL || '';

/* ---- localStorage helpers ---- */
function getItems()   { try { return JSON.parse(localStorage.getItem(INV_KEY))     || []; } catch { return []; } }
function getHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } }
function saveItems(d)   { localStorage.setItem(INV_KEY,     JSON.stringify(d)); }
function saveHistory(d) { localStorage.setItem(HISTORY_KEY, JSON.stringify(d)); }
function genId() { return Date.now() + '-' + Math.random().toString(16).slice(2,8); }
function esc(v) {
  return String(v||'').replace(/[&<>'"]/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[c]);
}

/* ============================================================
   SHEETS SYNC
============================================================ */
function sheetsPost(type, payload) {
  if (!SHEETS_URL) return;
  fetch(SHEETS_URL, {
    method: 'POST', mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, ...payload })
  }).catch(() => {});
}

function syncFromSheets(callback) {
  if (!SHEETS_URL) { callback && callback(false); return; }
  const cbName = '_invSync_' + Date.now();
  const script = document.createElement('script');
  const timer  = setTimeout(() => {
    script.remove(); delete window[cbName];
    showSyncStatus('timeout'); callback && callback(false);
  }, 12000);

  window[cbName] = function(data) {
    clearTimeout(timer); script.remove(); delete window[cbName];
    if (!data || !data.ok) { showSyncStatus('fail'); callback && callback(false); return; }

    // Merge items: sheet is source of truth for stock levels
    if (Array.isArray(data.items)) {
      const local    = getItems();
      const localMap = {};
      local.forEach(i => { if (i.id) localMap[i.id] = i; });
      data.items.forEach(r => { localMap[r.id] = r; }); // sheet overrides
      saveItems(Object.values(localMap));
    }

    // Merge history
    if (Array.isArray(data.history)) {
      const local    = getHistory();
      const localMap = {};
      local.forEach(h => { if (h.id) localMap[h.id] = h; });
      data.history.forEach(r => { localMap[r.id] = r; });
      saveHistory(Object.values(localMap));
    }

    showSyncStatus('ok');
    callback && callback(true);
  };

  script.onerror = () => {
    clearTimeout(timer); delete window[cbName];
    showSyncStatus('fail'); callback && callback(false);
  };
  script.src = SHEETS_URL + '?type=inventory&callback=' + cbName;
  document.head.appendChild(script);
}

function showSyncStatus(state) {
  const el = document.getElementById('inv-sync-status');
  if (!el) return;
  const map = {
    syncing: { text: '⟳ Syncing…',  color: '#7aaef5' },
    ok:      { text: '✓ Synced',    color: '#7ed67e' },
    fail:    { text: '✗ Sync failed', color: '#e69090' },
    timeout: { text: '✗ Timeout',   color: '#e69090' }
  };
  const s = map[state] || map.ok;
  el.textContent = s.text;
  el.style.color = s.color;
  el.style.display = 'inline';
  if (state !== 'syncing') setTimeout(() => { el.style.display = 'none'; }, 3000);
}

/* ============================================================
   STOCK STATUS
============================================================ */
function stockStatus(item) {
  const av = Number(item.available);
  if (av <= 0) return 'out';
  if (av <= (Number(item.lowAt) || 2)) return 'low';
  return 'ok';
}

/* ============================================================
   RENDER STATS
============================================================ */
function renderStats() {
  const items   = getItems();
  const history = getHistory();
  document.getElementById('stat-total').textContent   = items.length;
  document.getElementById('stat-instock').textContent = items.reduce((s,i) => s + Math.max(0, Number(i.available)), 0);
  document.getElementById('stat-low').textContent     = items.filter(i => stockStatus(i) === 'low').length;
  document.getElementById('stat-out').textContent     = items.filter(i => stockStatus(i) === 'out').length;
  document.getElementById('stat-service').textContent = history.filter(h => !h.returned).length;
}

/* ============================================================
   RENDER TABLE (desktop) + CARDS (mobile)
============================================================ */
let activeCat = 'all', activeStatus = 'all', activeCond = 'all', searchQuery = '';

function filteredItems() {
  let items = getItems();
  if (activeCat    !== 'all') items = items.filter(i => i.category === activeCat);
  if (activeStatus !== 'all') items = items.filter(i => stockStatus(i) === activeStatus);
  if (activeCond   !== 'all') items = items.filter(i => i.condition === activeCond);
  if (searchQuery)             items = items.filter(i =>
    (i.name + i.sku + i.location + i.notes).toLowerCase().includes(searchQuery));
  return items;
}

function renderTable() {
  const tbody  = document.getElementById('inv-tbody');
  const cards  = document.getElementById('inv-cards');
  const empty  = document.getElementById('inv-empty');
  const table  = document.getElementById('inv-table');
  const items  = filteredItems();
  const isAdmin = CRM_AUTH.getRole() === 'admin';

  if (!items.length) {
    if (table)  table.style.display = 'none';
    if (cards)  cards.style.display = 'none';
    if (empty)  empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  const statusLabel = { ok:'In Stock', low:'Low Stock', out:'Out of Stock' };
  const condClass   = { Good:'good', Fair:'fair', 'Needs Repair':'repair', Retired:'retired' };
  const stockColor  = { ok:'#7ed67e', low:'#e6c84a', out:'#ffb3bf' };

  // Desktop table
  if (table && tbody) {
    table.style.display = '';
    tbody.innerHTML = items.map(item => {
      const st = stockStatus(item);
      return `<tr data-id="${esc(item.id)}">
        <td class="item-name">${esc(item.name)}</td>
        <td><span class="inv-cat-chip">${esc(item.category)}</span></td>
        <td class="mono">${esc(item.sku||'—')}</td>
        <td style="text-align:center">${item.total}</td>
        <td style="text-align:center"><strong style="color:${stockColor[st]}">${item.available}</strong></td>
        <td style="text-align:center;color:#7f8ba0">${item.lowAt||2}</td>
        <td><span class="cond-badge cond-badge--${condClass[item.condition]||'good'}">${esc(item.condition||'Good')}</span></td>
        <td style="color:#7f8ba0;font-size:.8rem">${esc(item.location||'—')}</td>
        <td>
          <div class="inv-row-actions">
            <button class="inv-action-btn inv-action-btn--edit" data-edit="${esc(item.id)}">✏</button>
            <button class="inv-action-btn inv-action-btn--out"  data-checkout="${esc(item.id)}">📤</button>
            ${isAdmin ? `<button class="inv-action-btn inv-action-btn--del" data-del="${esc(item.id)}">🗑</button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // Mobile cards
  if (cards) {
    cards.style.display = '';
    cards.innerHTML = items.map(item => {
      const st = stockStatus(item);
      return `<div class="inv-card" data-id="${esc(item.id)}">
        <div class="inv-card__header">
          <div>
            <div class="inv-card__name">${esc(item.name)}</div>
            <div class="inv-card__meta">
              <span class="inv-cat-chip">${esc(item.category)}</span>
              ${item.sku ? `<span class="mono" style="font-size:.7rem;color:#4a6280">${esc(item.sku)}</span>` : ''}
            </div>
          </div>
          <span class="stock-badge stock-badge--${st}">${statusLabel[st]}</span>
        </div>
        <div class="inv-card__stats">
          <div class="inv-card__stat">
            <span class="inv-card__stat-label">Available</span>
            <span class="inv-card__stat-val" style="color:${stockColor[st]}">${item.available}</span>
          </div>
          <div class="inv-card__stat">
            <span class="inv-card__stat-label">Total</span>
            <span class="inv-card__stat-val">${item.total}</span>
          </div>
          <div class="inv-card__stat">
            <span class="inv-card__stat-label">Condition</span>
            <span class="inv-card__stat-val"><span class="cond-badge cond-badge--${condClass[item.condition]||'good'}">${esc(item.condition||'Good')}</span></span>
          </div>
          ${item.location ? `<div class="inv-card__stat">
            <span class="inv-card__stat-label">Location</span>
            <span class="inv-card__stat-val" style="color:#7f8ba0;font-size:.8rem">${esc(item.location)}</span>
          </div>` : ''}
        </div>
        <div class="inv-card__actions">
          <button class="inv-action-btn inv-action-btn--edit" data-edit="${esc(item.id)}">✏ Edit</button>
          <button class="inv-action-btn inv-action-btn--out"  data-checkout="${esc(item.id)}">📤 Check Out</button>
          ${isAdmin ? `<button class="inv-action-btn inv-action-btn--del" data-del="${esc(item.id)}">🗑 Delete</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }
}

/* ============================================================
   RENDER HISTORY
============================================================ */
function renderHistory() {
  const tbody = document.getElementById('inv-history-tbody');
  const cards = document.getElementById('inv-history-cards');
  const empty = document.getElementById('inv-history-empty');
  const table = document.getElementById('inv-history-table');
  const history = getHistory().slice().sort((a,b) =>
    new Date(b.createdAt||0) - new Date(a.createdAt||0));

  if (!history.length) {
    if (table) table.style.display = 'none';
    if (cards) cards.style.display = 'none';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  const retBtn = h => h.returned
    ? `<span style="color:#7ed67e;font-size:.75rem">✓ ${esc(h.returnedAt||'')}</span>`
    : `<button class="inv-action-btn inv-action-btn--out" style="font-size:.72rem;padding:3px 10px" data-return="${esc(h.id)}">📥 Return</button>`;

  // Desktop table
  if (table && tbody) {
    table.style.display = '';
    tbody.innerHTML = history.map(h => `<tr>
      <td style="color:#fff;font-weight:600">${esc(h.itemName)}</td>
      <td style="text-align:center">${h.qty}</td>
      <td>${esc(h.person)}</td>
      <td style="color:#7f8ba0">${esc(h.trek||'—')}</td>
      <td style="color:#7f8ba0;white-space:nowrap">${esc(h.outDate||'—')}</td>
      <td style="color:#7f8ba0;white-space:nowrap">${esc(h.returnDate||'—')}</td>
      <td>${retBtn(h)}</td>
      <td style="color:#7f8ba0;font-size:.78rem">${esc(h.notes||'—')}</td>
    </tr>`).join('');
  }

  // Mobile cards
  if (cards) {
    cards.style.display = '';
    cards.innerHTML = history.map(h => `
      <div class="inv-hist-card ${h.returned ? 'inv-hist-card--returned' : ''}">
        <div class="inv-hist-card__top">
          <div>
            <div class="inv-hist-card__name">${esc(h.itemName)}</div>
            <div class="inv-hist-card__sub">${esc(h.person)}${h.trek ? ' · ' + esc(h.trek) : ''}</div>
          </div>
          <span class="inv-hist-card__qty">×${h.qty}</span>
        </div>
        <div class="inv-hist-card__dates">
          <span>Out: ${esc(h.outDate||'—')}</span>
          <span>Return: ${esc(h.returnDate||'—')}</span>
        </div>
        ${h.notes ? `<div class="inv-hist-card__note">${esc(h.notes)}</div>` : ''}
        <div style="margin-top:10px">${retBtn(h)}</div>
      </div>`).join('');
  }
}

function renderAll() {
  renderStats();
  renderTable();
  renderHistory();
}

/* ============================================================
   ADD / EDIT ITEM MODAL
============================================================ */
const itemModal = document.getElementById('item-modal');
const itemForm  = document.getElementById('item-form');
let editingId   = null;

function openAddModal() {
  editingId = null;
  document.getElementById('item-modal-title').textContent = 'Add New Item';
  itemForm.reset();
  itemModal.classList.add('open');
}

function openEditModal(id) {
  const item = getItems().find(i => i.id === id);
  if (!item) return;
  editingId = id;
  document.getElementById('item-modal-title').textContent = 'Edit Item';
  document.getElementById('item-id').value        = id;
  document.getElementById('item-name').value      = item.name      || '';
  document.getElementById('item-category').value  = item.category  || '';
  document.getElementById('item-sku').value       = item.sku       || '';
  document.getElementById('item-total').value     = item.total     || '';
  document.getElementById('item-available').value = item.available || '';
  document.getElementById('item-lowat').value     = item.lowAt     || '';
  document.getElementById('item-condition').value = item.condition || 'Good';
  document.getElementById('item-location').value  = item.location  || '';
  document.getElementById('item-price').value     = item.price     || '';
  document.getElementById('item-notes').value     = item.notes     || '';
  itemModal.classList.add('open');
}

function closeItemModal() { itemModal.classList.remove('open'); }

document.getElementById('inv-add-btn').addEventListener('click', openAddModal);
document.getElementById('item-modal-close').addEventListener('click', closeItemModal);
document.getElementById('item-modal-cancel').addEventListener('click', closeItemModal);
itemModal.addEventListener('click', e => { if (e.target === itemModal) closeItemModal(); });

itemForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const name  = document.getElementById('item-name').value.trim();
  const cat   = document.getElementById('item-category').value;
  const total = document.getElementById('item-total').value;
  const avail = document.getElementById('item-available').value;
  if (!name || !cat || total === '' || avail === '') {
    alert('Please fill in Name, Category, Total Qty, and Available Qty.'); return;
  }

  const now   = new Date().toLocaleString('en-IN');
  const items = getItems();
  const item  = {
    id:        editingId || genId(),
    name, category: cat,
    sku:       document.getElementById('item-sku').value.trim(),
    total:     Number(total),
    available: Number(avail),
    lowAt:     Number(document.getElementById('item-lowat').value) || 2,
    condition: document.getElementById('item-condition').value,
    location:  document.getElementById('item-location').value.trim(),
    price:     document.getElementById('item-price').value.trim(),
    notes:     document.getElementById('item-notes').value.trim(),
    updatedAt: now
  };

  if (editingId) {
    const idx = items.findIndex(i => i.id === editingId);
    item.createdAt = items[idx]?.createdAt || now;
    if (idx >= 0) items[idx] = item; else items.unshift(item);
  } else {
    item.createdAt = now;
    items.unshift(item);
  }

  saveItems(items);
  sheetsPost('inv_save', { item });
  closeItemModal();
  renderAll();
});

/* ============================================================
   CHECKOUT MODAL
============================================================ */
const checkoutModal = document.getElementById('checkout-modal');
const checkoutForm  = document.getElementById('checkout-form');

function openCheckoutModal(preselectId) {
  checkoutForm.reset();
  document.getElementById('co-outdate').value = new Date().toISOString().split('T')[0];
  const sel   = document.getElementById('co-item');
  const items = getItems().filter(i => Number(i.available) > 0);
  sel.innerHTML = '<option value="">— Select item —</option>' +
    items.map(i => `<option value="${esc(i.id)}">${esc(i.name)} (${i.available} avail.)</option>`).join('');
  if (preselectId) sel.value = preselectId;
  checkoutModal.classList.add('open');
}

function closeCheckoutModal() { checkoutModal.classList.remove('open'); }

document.getElementById('inv-checkout-btn').addEventListener('click', () => openCheckoutModal(null));
document.getElementById('checkout-modal-close').addEventListener('click', closeCheckoutModal);
document.getElementById('checkout-modal-cancel').addEventListener('click', closeCheckoutModal);
checkoutModal.addEventListener('click', e => { if (e.target === checkoutModal) closeCheckoutModal(); });

checkoutForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const itemId = document.getElementById('co-item').value;
  const qty    = Number(document.getElementById('co-qty').value);
  const person = document.getElementById('co-person').value.trim();
  if (!itemId || !qty || !person) { alert('Please fill in Item, Quantity, and Checked Out To.'); return; }

  const items = getItems();
  const idx   = items.findIndex(i => i.id === itemId);
  if (idx < 0) return;
  if (qty > Number(items[idx].available)) { alert(`Only ${items[idx].available} available.`); return; }

  const now = new Date().toLocaleString('en-IN');
  items[idx].available = Number(items[idx].available) - qty;
  items[idx].updatedAt = now;
  saveItems(items);

  const record = {
    id: genId(), itemId, itemName: items[idx].name, qty, person,
    trek:       document.getElementById('co-trek').value.trim(),
    outDate:    document.getElementById('co-outdate').value,
    returnDate: document.getElementById('co-returndate').value,
    notes:      document.getElementById('co-notes').value.trim(),
    returned:   false, createdAt: now
  };

  const history = getHistory();
  history.unshift(record);
  saveHistory(history);

  // Push both to Sheets
  sheetsPost('inv_save',     { item: items[idx] });
  sheetsPost('inv_checkout', { record });

  closeCheckoutModal();
  renderAll();
});

/* ============================================================
   RETURN MODAL
============================================================ */
const returnModal = document.getElementById('return-modal');
const returnForm  = document.getElementById('return-form');
let returningId   = null;

function openReturnModal(histId) {
  returningId = histId;
  const h = getHistory().find(r => r.id === histId);
  if (!h) return;
  document.getElementById('ret-qty').value       = h.qty;
  document.getElementById('ret-qty').max         = h.qty;
  document.getElementById('ret-notes').value     = '';
  document.getElementById('ret-condition').value = 'Good';
  returnModal.classList.add('open');
}

function closeReturnModal() { returnModal.classList.remove('open'); }

document.getElementById('return-modal-close').addEventListener('click', closeReturnModal);
document.getElementById('return-modal-cancel').addEventListener('click', closeReturnModal);
returnModal.addEventListener('click', e => { if (e.target === returnModal) closeReturnModal(); });

returnForm.addEventListener('submit', function(e) {
  e.preventDefault();
  const retQty  = Number(document.getElementById('ret-qty').value);
  const retCond = document.getElementById('ret-condition').value;
  const retNote = document.getElementById('ret-notes').value.trim();
  if (!retQty || !returningId) return;

  const now     = new Date().toLocaleString('en-IN');
  const history = getHistory();
  const hidx    = history.findIndex(r => r.id === returningId);
  if (hidx < 0) return;

  history[hidx].returned    = true;
  history[hidx].returnedAt  = now;
  history[hidx].returnNotes = retNote;
  saveHistory(history);

  const items = getItems();
  const iidx  = items.findIndex(i => i.id === history[hidx].itemId);
  if (iidx >= 0) {
    items[iidx].available = Number(items[iidx].available) + retQty;
    items[iidx].condition = retCond;
    items[iidx].updatedAt = now;
    saveItems(items);
    sheetsPost('inv_save', { item: items[iidx] });
  }

  sheetsPost('inv_return', {
    id: returningId,
    returnData: { returnedAt: now, returnNotes: retNote, condition: retCond },
    itemId: history[hidx].itemId,
    qty: retQty
  });

  closeReturnModal();
  renderAll();
});

/* ============================================================
   EVENT DELEGATION
============================================================ */
['inv-tbody','inv-cards'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', function(e) {
    const editId     = e.target.closest('[data-edit]')?.dataset.edit;
    const delId      = e.target.closest('[data-del]')?.dataset.del;
    const checkoutId = e.target.closest('[data-checkout]')?.dataset.checkout;
    if (editId)     { openEditModal(editId); return; }
    if (checkoutId) { openCheckoutModal(checkoutId); return; }
    if (delId) {
      if (!confirm('Permanently delete this item?')) return;
      const items = getItems().filter(i => i.id !== delId);
      saveItems(items);
      sheetsPost('inv_delete', { id: delId });
      renderAll();
    }
  });
});

['inv-history-tbody','inv-history-cards'].forEach(id => {
  document.getElementById(id)?.addEventListener('click', function(e) {
    const retId = e.target.closest('[data-return]')?.dataset.return;
    if (retId) openReturnModal(retId);
  });
});

/* ============================================================
   FILTERS
============================================================ */
document.getElementById('inv-cat-tabs').addEventListener('click', function(e) {
  const tab = e.target.closest('.inv-cat-tab');
  if (!tab) return;
  document.querySelectorAll('.inv-cat-tab').forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  activeCat = tab.dataset.cat;
  renderTable();
});

document.getElementById('inv-search').addEventListener('input', function() {
  searchQuery = this.value.trim().toLowerCase();
  renderTable();
});

document.getElementById('inv-filter-status').addEventListener('change', function() {
  activeStatus = this.value; renderTable();
});

document.getElementById('inv-filter-condition').addEventListener('change', function() {
  activeCond = this.value; renderTable();
});

/* ============================================================
   REFRESH BUTTON
============================================================ */
document.getElementById('inv-refresh-btn')?.addEventListener('click', function() {
  this.disabled = true;
  this.textContent = '⟳ Syncing…';
  showSyncStatus('syncing');
  syncFromSheets(() => {
    renderAll();
    this.disabled = false;
    this.textContent = '⟳ Refresh';
  });
});

/* ============================================================
   EXPORT CSV
============================================================ */
document.getElementById('inv-export-btn')?.addEventListener('click', function() {
  const items   = getItems();
  const headers = ['ID','Name','Category','SKU','Total','Available','LowAt','Condition','Location','Price','Notes','Created','Updated'];
  const rows    = items.map(i => [
    i.id,i.name,i.category,i.sku,i.total,i.available,i.lowAt,
    i.condition,i.location,i.price,i.notes,i.createdAt,i.updatedAt
  ].map(v => '"'+String(v||'').replace(/"/g,'""')+'"').join(','));
  const blob = new Blob([[headers.join(','),...rows].join('\n')], {type:'text/csv'});
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `fradpaix-inventory-${new Date().toISOString().slice(0,10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
});

/* ============================================================
   CLEAR HISTORY
============================================================ */
document.getElementById('inv-clear-history')?.addEventListener('click', function() {
  if (!confirm('Clear all checkout history? This cannot be undone.')) return;
  saveHistory([]); renderHistory(); renderStats();
});

/* ============================================================
   BOOT — sync then render
============================================================ */
renderAll(); // show local data instantly
showSyncStatus('syncing');
syncFromSheets(() => renderAll()); // then pull from Sheets
