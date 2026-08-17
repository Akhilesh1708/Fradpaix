/* =========================================
   FRADPAIX CRM — Inventory Management
   Storage: localStorage (fradpaix-inventory, fradpaix-inv-history)
========================================= */

const INV_KEY     = 'fradpaix-inventory';
const HISTORY_KEY = 'fradpaix-inv-history';

/* ---- Storage helpers ---- */
function getItems()   { try { return JSON.parse(localStorage.getItem(INV_KEY))     || []; } catch { return []; } }
function getHistory() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } }
function saveItems(d)   { localStorage.setItem(INV_KEY,     JSON.stringify(d)); }
function saveHistory(d) { localStorage.setItem(HISTORY_KEY, JSON.stringify(d)); }

function genId() { return Date.now() + '-' + Math.random().toString(16).slice(2, 8); }

function esc(v) {
  return String(v || '').replace(/[&<>'"]/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' })[c]);
}

/* ---- Stock status logic ---- */
function stockStatus(item) {
  const av = Number(item.available);
  const lo = Number(item.lowAt) || 2;
  if (av <= 0)      return 'out';
  if (av <= lo)     return 'low';
  return 'ok';
}

/* ---- Render KPI stats ---- */
function renderStats() {
  const items = getItems();
  document.getElementById('stat-total').textContent    = items.length;
  document.getElementById('stat-instock').textContent  = items.reduce((s,i) => s + Math.max(0, Number(i.available)), 0);
  document.getElementById('stat-low').textContent      = items.filter(i => stockStatus(i) === 'low').length;
  document.getElementById('stat-out').textContent      = items.filter(i => stockStatus(i) === 'out').length;

  // In service = items that have open checkout records
  const history = getHistory();
  const open    = history.filter(h => !h.returned).length;
  document.getElementById('stat-service').textContent  = open;
}

/* ---- Render inventory table ---- */
let activeCat    = 'all';
let activeStatus = 'all';
let activeCond   = 'all';
let searchQuery  = '';

function renderTable() {
  const tbody   = document.getElementById('inv-tbody');
  const empty   = document.getElementById('inv-empty');
  const table   = document.getElementById('inv-table');
  let items = getItems();

  // Filters
  if (activeCat    !== 'all') items = items.filter(i => i.category === activeCat);
  if (activeStatus !== 'all') items = items.filter(i => stockStatus(i) === activeStatus);
  if (activeCond   !== 'all') items = items.filter(i => i.condition === activeCond);
  if (searchQuery)            items = items.filter(i =>
    (i.name + i.sku + i.location + i.notes).toLowerCase().includes(searchQuery)
  );

  if (!items.length) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  table.style.display = '';
  empty.style.display = 'none';

  const isAdmin = CRM_AUTH.getRole() === 'admin';

  tbody.innerHTML = items.map(item => {
    const status = stockStatus(item);
    const statusLabel = { ok: 'In Stock', low: 'Low Stock', out: 'Out of Stock' }[status] || status;
    const statusClass = 'stock-badge--' + status;
    const condClass   = { Good:'good', Fair:'fair', 'Needs Repair':'repair', Retired:'retired' }[item.condition] || 'good';

    return `<tr data-id="${esc(item.id)}">
      <td class="item-name">${esc(item.name)}</td>
      <td>${esc(item.category)}</td>
      <td class="mono">${esc(item.sku || '—')}</td>
      <td style="text-align:center">${esc(item.total)}</td>
      <td style="text-align:center"><strong style="color:${status==='out'?'#ffb3bf':status==='low'?'#e6c84a':'#7ed67e'}">${esc(item.available)}</strong></td>
      <td style="text-align:center;color:#7f8ba0">${esc(item.lowAt || '2')}</td>
      <td><span class="cond-badge cond-badge--${condClass}">${esc(item.condition)}</span></td>
      <td style="color:#7f8ba0;font-size:.8rem">${esc(item.location || '—')}</td>
      <td style="color:#7f8ba0;font-size:.78rem;white-space:nowrap">${esc(item.updatedAt || item.createdAt || '—')}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="inv-action-btn inv-action-btn--edit" data-edit="${esc(item.id)}">✏ Edit</button>
          <button class="inv-action-btn inv-action-btn--out"  data-checkout="${esc(item.id)}">📤 Out</button>
          ${isAdmin ? `<button class="inv-action-btn inv-action-btn--del" data-del="${esc(item.id)}">🗑</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ---- Render checkout history ---- */
function renderHistory() {
  const tbody   = document.getElementById('inv-history-tbody');
  const empty   = document.getElementById('inv-history-empty');
  const table   = document.getElementById('inv-history-table');
  const history = getHistory().slice().reverse(); // newest first

  if (!history.length) {
    table.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  table.style.display = '';
  empty.style.display = 'none';

  tbody.innerHTML = history.map(h => {
    const returnedBadge = h.returned
      ? `<span style="color:#7ed67e;font-size:.75rem">✓ ${esc(h.returnedAt)}</span>`
      : `<button class="inv-action-btn inv-action-btn--out" style="font-size:.72rem;padding:3px 10px" data-return="${esc(h.id)}">📥 Return</button>`;

    return `<tr>
      <td style="color:#fff;font-weight:600">${esc(h.itemName)}</td>
      <td style="text-align:center">${esc(h.qty)}</td>
      <td>${esc(h.person)}</td>
      <td style="color:#7f8ba0">${esc(h.trek || '—')}</td>
      <td style="color:#7f8ba0;white-space:nowrap">${esc(h.outDate || '—')}</td>
      <td style="color:#7f8ba0;white-space:nowrap">${esc(h.returnDate || '—')}</td>
      <td>${returnedBadge}</td>
      <td style="color:#7f8ba0;font-size:.78rem">${esc(h.notes || '—')}</td>
    </tr>`;
  }).join('');
}

/* ---- Full re-render ---- */
function renderAll() {
  renderStats();
  renderTable();
  renderHistory();
}

/* ============================================
   ADD / EDIT ITEM MODAL
============================================ */
const itemModal   = document.getElementById('item-modal');
const itemForm    = document.getElementById('item-form');
let editingItemId = null;

function openAddModal() {
  editingItemId = null;
  document.getElementById('item-modal-title').textContent = 'Add New Item';
  itemForm.reset();
  document.getElementById('item-id').value = '';
  itemModal.classList.add('open');
}

function openEditModal(id) {
  const item = getItems().find(i => i.id === id);
  if (!item) return;
  editingItemId = id;
  document.getElementById('item-modal-title').textContent = 'Edit Item';
  document.getElementById('item-id').value        = item.id;
  document.getElementById('item-name').value      = item.name       || '';
  document.getElementById('item-category').value  = item.category   || '';
  document.getElementById('item-sku').value       = item.sku        || '';
  document.getElementById('item-total').value     = item.total      || '';
  document.getElementById('item-available').value = item.available  || '';
  document.getElementById('item-lowat').value     = item.lowAt      || '';
  document.getElementById('item-condition').value = item.condition  || 'Good';
  document.getElementById('item-location').value  = item.location   || '';
  document.getElementById('item-price').value     = item.price      || '';
  document.getElementById('item-notes').value     = item.notes      || '';
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

  if (editingItemId) {
    const idx = items.findIndex(i => i.id === editingItemId);
    if (idx < 0) return;
    items[idx] = {
      ...items[idx],
      name,
      category:  cat,
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
  } else {
    items.unshift({
      id:        genId(),
      name,
      category:  cat,
      sku:       document.getElementById('item-sku').value.trim(),
      total:     Number(total),
      available: Number(avail),
      lowAt:     Number(document.getElementById('item-lowat').value) || 2,
      condition: document.getElementById('item-condition').value,
      location:  document.getElementById('item-location').value.trim(),
      price:     document.getElementById('item-price').value.trim(),
      notes:     document.getElementById('item-notes').value.trim(),
      createdAt: now,
      updatedAt: now
    });
  }

  saveItems(items);
  closeItemModal();
  renderAll();
});

/* ============================================
   CHECKOUT MODAL
============================================ */
const checkoutModal = document.getElementById('checkout-modal');
const checkoutForm  = document.getElementById('checkout-form');

function populateCheckoutSelect(preselectId) {
  const sel   = document.getElementById('co-item');
  const items = getItems().filter(i => Number(i.available) > 0);
  sel.innerHTML = '<option value="">— Select item —</option>' +
    items.map(i => `<option value="${esc(i.id)}">${esc(i.name)} (${i.available} available)</option>`).join('');
  if (preselectId) sel.value = preselectId;
}

function openCheckoutModal(preselectId) {
  checkoutForm.reset();
  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('co-outdate').value = today;
  populateCheckoutSelect(preselectId);
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

  if (qty > Number(items[idx].available)) {
    alert(`Only ${items[idx].available} unit(s) available.`); return;
  }

  // Deduct from available
  items[idx].available  = Number(items[idx].available) - qty;
  items[idx].updatedAt  = new Date().toLocaleString('en-IN');
  saveItems(items);

  // Log to history
  const history = getHistory();
  history.unshift({
    id:         genId(),
    itemId,
    itemName:   items[idx].name,
    qty,
    person,
    trek:       document.getElementById('co-trek').value.trim(),
    outDate:    document.getElementById('co-outdate').value,
    returnDate: document.getElementById('co-returndate').value,
    notes:      document.getElementById('co-notes').value.trim(),
    returned:   false,
    createdAt:  new Date().toLocaleString('en-IN')
  });
  saveHistory(history);

  closeCheckoutModal();
  renderAll();
});

/* ============================================
   RETURN MODAL
============================================ */
const returnModal = document.getElementById('return-modal');
const returnForm  = document.getElementById('return-form');
let returningHistoryId = null;

function openReturnModal(historyId) {
  returningHistoryId = historyId;
  const h = getHistory().find(r => r.id === historyId);
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
  if (!retQty) return;

  const now     = new Date().toLocaleString('en-IN');
  const history = getHistory();
  const hidx    = history.findIndex(r => r.id === returningHistoryId);
  if (hidx < 0) return;

  // Mark history entry as returned
  history[hidx].returned   = true;
  history[hidx].returnedAt = now;
  history[hidx].returnNotes = retNote;
  saveHistory(history);

  // Add back to available inventory
  const items = getItems();
  const iidx  = items.findIndex(i => i.id === history[hidx].itemId);
  if (iidx >= 0) {
    items[iidx].available = Number(items[iidx].available) + retQty;
    items[iidx].condition = retCond;
    items[iidx].updatedAt = now;
    saveItems(items);
  }

  closeReturnModal();
  renderAll();
});

/* ============================================
   TABLE EVENT DELEGATION (edit / delete / checkout / return)
============================================ */
document.getElementById('inv-tbody').addEventListener('click', function(e) {
  const editId     = e.target.closest('[data-edit]')?.dataset.edit;
  const delId      = e.target.closest('[data-del]')?.dataset.del;
  const checkoutId = e.target.closest('[data-checkout]')?.dataset.checkout;

  if (editId)     { openEditModal(editId); return; }
  if (checkoutId) { openCheckoutModal(checkoutId); return; }
  if (delId) {
    if (!confirm('Permanently delete this item?')) return;
    saveItems(getItems().filter(i => i.id !== delId));
    renderAll();
  }
});

document.getElementById('inv-history-tbody').addEventListener('click', function(e) {
  const retId = e.target.closest('[data-return]')?.dataset.return;
  if (retId) openReturnModal(retId);
});

/* ============================================
   FILTERS & SEARCH
============================================ */
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
  activeStatus = this.value;
  renderTable();
});

document.getElementById('inv-filter-condition').addEventListener('change', function() {
  activeCond = this.value;
  renderTable();
});

/* ============================================
   EXPORT CSV
============================================ */
document.getElementById('inv-export-btn').addEventListener('click', function() {
  const items = getItems();
  const headers = ['ID','Name','Category','SKU','Total Qty','Available','Low Stock At','Condition','Location','Price','Notes','Created At','Updated At'];
  const rows = items.map(i => [
    i.id, i.name, i.category, i.sku, i.total, i.available, i.lowAt,
    i.condition, i.location, i.price, i.notes, i.createdAt, i.updatedAt
  ].map(v => '"' + String(v || '').replace(/"/g, '""') + '"').join(','));
  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href     = URL.createObjectURL(blob);
  link.download = `fradpaix-inventory-${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

/* ============================================
   CLEAR HISTORY
============================================ */
document.getElementById('inv-clear-history').addEventListener('click', function() {
  if (!confirm('Clear all checkout history? This cannot be undone.')) return;
  saveHistory([]);
  renderHistory();
  renderStats();
});

/* ============================================
   SEED DEMO DATA (only if inventory is empty)
============================================ */
function seedDemoData() {
  if (getItems().length > 0) return;
  const now = new Date().toLocaleString('en-IN');
  const demo = [
    { name:'Ice Axe — Black Diamond Raven', category:'Climbing', sku:'CLIMB-ICE-001', total:8, available:6, lowAt:2, condition:'Good', location:'Store A, Shelf 1', price:'3500', notes:'Black Diamond Raven 60cm' },
    { name:'Crampons — 12-Point Steel',     category:'Climbing', sku:'CLIMB-CRP-001', total:10, available:8, lowAt:2, condition:'Good', location:'Store A, Shelf 1', price:'2800', notes:'Grivel G12 compatible' },
    { name:'Climbing Harness',              category:'Climbing', sku:'CLIMB-HAR-001', total:12, available:10, lowAt:3, condition:'Good', location:'Store A, Shelf 2', price:'1800', notes:'Petzl Corax' },
    { name:'Helmet — Climbing',             category:'Climbing', sku:'CLIMB-HEL-001', total:10, available:9, lowAt:2, condition:'Good', location:'Store A, Shelf 2', price:'2200', notes:'Black Diamond Half Dome' },
    { name:'Tent — 3-Season 2P',            category:'Camping',  sku:'CAMP-TNT-001', total:6, available:4, lowAt:1, condition:'Good', location:'Store B, Rack 1', price:'12000', notes:'Mountain Hardwear Strato' },
    { name:'Tent — High Altitude 2P',       category:'Camping',  sku:'CAMP-TNT-002', total:4, available:2, lowAt:1, condition:'Fair', location:'Store B, Rack 1', price:'22000', notes:'The North Face VE 25' },
    { name:'Sleeping Bag — -20°C Down',     category:'Camping',  sku:'CAMP-SLB-001', total:15, available:12, lowAt:3, condition:'Good', location:'Store B, Rack 2', price:'8500', notes:'Western Mountaineering' },
    { name:'Trekking Poles — Adjustable',   category:'Trekking', sku:'TREK-POL-001', total:20, available:16, lowAt:4, condition:'Good', location:'Store C', price:'1200', notes:'Leki Cressida pair' },
    { name:'Headlamp — 350 Lumen',          category:'Safety',   sku:'SAFE-LMP-001', total:15, available:2, lowAt:3, condition:'Good', location:'Store D', price:'900', notes:'Petzl Actik Core' },
    { name:'First Aid Kit — Expedition',    category:'Medical',  sku:'MED-FAK-001', total:5, available:3, lowAt:1, condition:'Good', location:'Medical Cabinet', price:'2500', notes:'Includes Diamox, AMS meds' },
  ];
  saveItems(demo.map((d,i) => ({ id: genId(), ...d, createdAt: now, updatedAt: now })));
}

/* ---- Boot ---- */
seedDemoData();
renderAll();
