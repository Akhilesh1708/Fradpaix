/**
 * FRADPAIX — Google Apps Script
 * ============================================================
 * Sheet tabs required:
 *   Leads | Visitors | Inventory | InvHistory
 *
 * Deploy as Web App:
 *   Execute as: Me  |  Who has access: Anyone
 * ============================================================
 */

const LEADS_SHEET    = 'Leads';
const VISITORS_SHEET = 'Visitors';
const INV_SHEET      = 'Inventory';
const INV_HIS_SHEET  = 'InvHistory';

const LEAD_HEADERS = [
  'ID','Created At','Status','Source','Name','Phone','Email',
  'Location','Country','Trip','Dates','People','Region',
  'Price','Budget','Age','Experience','Fitness',
  'Add-ons','Medical','Subject','Message'
];
const VISITOR_HEADERS = [
  'IP','City','Region','Country','ISP',
  'Browser','OS','Device','Screen',
  'Language','Timezone','Page Views','Pages Visited','First Seen','Last Seen'
];
const INV_HEADERS = [
  'ID','Name','Category','SKU','Total','Available','LowAt',
  'Condition','Location','Price','Notes','CreatedAt','UpdatedAt'
];
const INV_HIS_HEADERS = [
  'ID','ItemID','ItemName','Qty','Person','Trek',
  'OutDate','ReturnDate','Notes','Returned','ReturnedAt','ReturnNotes','CreatedAt'
];

/* ============================================================
   POST — write data
============================================================ */
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.getActiveSpreadsheet();

    if      (data.type === 'lead')       appendLead(ss, data.lead);
    else if (data.type === 'visitor')    appendVisitor(ss, data.visitor);
    else if (data.type === 'inv_save')   saveInventoryItem(ss, data.item);
    else if (data.type === 'inv_delete') deleteInventoryItem(ss, data.id);
    else if (data.type === 'inv_checkout') appendInvHistory(ss, data.record);
    else if (data.type === 'inv_return') returnInvHistory(ss, data.id, data.returnData, data.itemId, data.qty);

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* ============================================================
   GET — read data (JSONP supported via ?callback=)
============================================================ */
function doGet(e) {
  const type   = e && e.parameter && e.parameter.type;
  const cbName = e && e.parameter && e.parameter.callback;
  const ss     = SpreadsheetApp.getActiveSpreadsheet();
  var result;

  if (type === 'leads') {
    result = { ok: true, leads: readLeads(ss) };

  } else if (type === 'inventory') {
    result = { ok: true, items: readInventory(ss), history: readInvHistory(ss) };

  } else {
    result = { ok: true, service: 'Fradpaix CRM' };
  }

  const json = JSON.stringify(result);
  if (cbName) {
    return ContentService
      .createTextOutput(cbName + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

/* ============================================================
   SHEET HELPERS
============================================================ */
function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold').setBackground('#1a2b47').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function findRowById(sheet, id, colIndex) {
  colIndex = colIndex || 1;
  if (sheet.getLastRow() < 2) return -1;
  const ids = sheet.getRange(2, colIndex, sheet.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // 1-indexed sheet row
  }
  return -1;
}

/* ============================================================
   LEADS
============================================================ */
function readLeads(ss) {
  const sheet = ss.getSheetByName(LEADS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, LEAD_HEADERS.length)
    .getValues()
    .filter(r => r[0] || r[4])
    .map(r => ({
      id: String(r[0]||''), createdAt: String(r[1]||''), status: String(r[2]||'New'),
      source: String(r[3]||''), name: String(r[4]||''), phone: String(r[5]||''),
      email: String(r[6]||''), location: String(r[7]||''), country: String(r[8]||''),
      trip: String(r[9]||''), dates: String(r[10]||''), people: String(r[11]||''),
      region: String(r[12]||''), price: String(r[13]||''), budget: String(r[14]||''),
      age: String(r[15]||''), experience: String(r[16]||''), fitness: String(r[17]||''),
      addons: String(r[18]||''), medical: String(r[19]||''), subject: String(r[20]||''),
      message: String(r[21]||'')
    }));
}

function appendLead(ss, lead) {
  const sheet = getOrCreateSheet(ss, LEADS_SHEET, LEAD_HEADERS);
  sheet.appendRow([
    lead.id||'', lead.createdAt||new Date().toLocaleString('en-IN'), lead.status||'New',
    lead.source||'', lead.name||'', lead.phone||'', lead.email||'',
    lead.location||'', lead.country||'', lead.trip||'', lead.dates||'',
    lead.people||'', lead.region||'', lead.price||'', lead.budget||'',
    lead.age||'', lead.experience||'', lead.fitness||'',
    lead.addons||'', lead.medical||'', lead.subject||'', lead.message||''
  ]);
}

/* ============================================================
   VISITORS
============================================================ */
function appendVisitor(ss, v) {
  const sheet = getOrCreateSheet(ss, VISITORS_SHEET, VISITOR_HEADERS);
  sheet.appendRow([
    v.ip||'', v.city||'', v.region||'', v.country||'', v.isp||'',
    (v.device&&v.device.browser)||'', (v.device&&v.device.os)||'',
    (v.device&&v.device.device)||'', (v.device&&v.device.screen)||'',
    (v.device&&v.device.language)||'', (v.device&&v.device.timezone)||'',
    v.pageViews||0,
    Array.isArray(v.pagesVisited) ? v.pagesVisited.map(function(p){return p.page;}).join(', ') : '',
    v.firstSeen||'', v.lastSeen||''
  ]);
}

/* ============================================================
   INVENTORY ITEMS
============================================================ */
function readInventory(ss) {
  const sheet = ss.getSheetByName(INV_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, INV_HEADERS.length)
    .getValues()
    .filter(r => r[0] || r[1])
    .map(r => ({
      id: String(r[0]||''), name: String(r[1]||''), category: String(r[2]||''),
      sku: String(r[3]||''), total: Number(r[4])||0, available: Number(r[5])||0,
      lowAt: Number(r[6])||2, condition: String(r[7]||'Good'),
      location: String(r[8]||''), price: String(r[9]||''),
      notes: String(r[10]||''), createdAt: String(r[11]||''), updatedAt: String(r[12]||'')
    }));
}

function saveInventoryItem(ss, item) {
  const sheet = getOrCreateSheet(ss, INV_SHEET, INV_HEADERS);
  const row   = findRowById(sheet, item.id);
  const vals  = [
    item.id||'', item.name||'', item.category||'', item.sku||'',
    Number(item.total)||0, Number(item.available)||0, Number(item.lowAt)||2,
    item.condition||'Good', item.location||'', item.price||'',
    item.notes||'', item.createdAt||new Date().toLocaleString('en-IN'),
    item.updatedAt||new Date().toLocaleString('en-IN')
  ];
  if (row > 0) {
    sheet.getRange(row, 1, 1, INV_HEADERS.length).setValues([vals]);
  } else {
    sheet.appendRow(vals);
  }
}

function deleteInventoryItem(ss, id) {
  const sheet = ss.getSheetByName(INV_SHEET);
  if (!sheet) return;
  const row = findRowById(sheet, id);
  if (row > 0) sheet.deleteRow(row);
}

/* ============================================================
   INVENTORY CHECKOUT HISTORY
============================================================ */
function readInvHistory(ss) {
  const sheet = ss.getSheetByName(INV_HIS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, INV_HIS_HEADERS.length)
    .getValues()
    .filter(r => r[0])
    .map(r => ({
      id: String(r[0]||''), itemId: String(r[1]||''), itemName: String(r[2]||''),
      qty: Number(r[3])||0, person: String(r[4]||''), trek: String(r[5]||''),
      outDate: String(r[6]||''), returnDate: String(r[7]||''), notes: String(r[8]||''),
      returned: r[9] === true || r[9] === 'TRUE',
      returnedAt: String(r[10]||''), returnNotes: String(r[11]||''),
      createdAt: String(r[12]||'')
    }));
}

function appendInvHistory(ss, rec) {
  const sheet = getOrCreateSheet(ss, INV_HIS_SHEET, INV_HIS_HEADERS);
  sheet.appendRow([
    rec.id||'', rec.itemId||'', rec.itemName||'', Number(rec.qty)||0,
    rec.person||'', rec.trek||'', rec.outDate||'', rec.returnDate||'',
    rec.notes||'', false, '', '', rec.createdAt||new Date().toLocaleString('en-IN')
  ]);
  // Also update available qty in Inventory sheet
  updateInvAvailable(ss, rec.itemId, -Number(rec.qty));
}

function returnInvHistory(ss, histId, returnData, itemId, qty) {
  const sheet = ss.getSheetByName(INV_HIS_SHEET);
  if (sheet) {
    const row = findRowById(sheet, histId);
    if (row > 0) {
      sheet.getRange(row, 10).setValue(true);
      sheet.getRange(row, 11).setValue(returnData.returnedAt||'');
      sheet.getRange(row, 12).setValue(returnData.returnNotes||'');
    }
  }
  // Update condition and add back qty in Inventory sheet
  const invSheet = ss.getSheetByName(INV_SHEET);
  if (invSheet) {
    const row = findRowById(invSheet, itemId);
    if (row > 0) {
      // Update available qty (col 6) and condition (col 8)
      const cur = Number(invSheet.getRange(row, 6).getValue()) || 0;
      invSheet.getRange(row, 6).setValue(cur + Number(qty));
      if (returnData.condition) invSheet.getRange(row, 8).setValue(returnData.condition);
      invSheet.getRange(row, 13).setValue(returnData.returnedAt||new Date().toLocaleString('en-IN'));
    }
  }
}

function updateInvAvailable(ss, itemId, delta) {
  const sheet = ss.getSheetByName(INV_SHEET);
  if (!sheet) return;
  const row = findRowById(sheet, itemId);
  if (row > 0) {
    const cur = Number(sheet.getRange(row, 6).getValue()) || 0;
    sheet.getRange(row, 6).setValue(Math.max(0, cur + delta));
    sheet.getRange(row, 13).setValue(new Date().toLocaleString('en-IN'));
  }
}
