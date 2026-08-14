/**
 * FRADPAIX — Google Apps Script
 * ============================================================
 * SETUP INSTRUCTIONS (do this once):
 *
 * 1. Go to https://sheets.google.com → create a new spreadsheet
 *    named "Fradpaix CRM Leads"
 *
 * 2. Rename the first sheet tab to:  Leads
 *    Add a second sheet tab named:   Visitors
 *
 * 3. In the spreadsheet, go to Extensions → Apps Script
 *
 * 4. Delete the default code and paste ALL of this file's content
 *
 * 5. Click Save (floppy disk icon), name the project "Fradpaix CRM"
 *
 * 6. Click Deploy → New Deployment
 *    - Type: Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    Click Deploy → copy the Web App URL
 *
 * 7. Open  script.js  in your website folder
 *    Find the line:  const SHEETS_URL = '...';
 *    Replace the placeholder with your copied Web App URL
 *
 * 8. Every form submission now writes a row into the spreadsheet
 *    automatically. Open the Leads sheet to see live data.
 * ============================================================
 */

const LEADS_SHEET    = 'Leads';
const VISITORS_SHEET = 'Visitors';

// Column headers — must match the order in appendLead() and appendVisitor()
const LEAD_HEADERS = [
  'ID', 'Created At', 'Status', 'Source', 'Name', 'Phone', 'Email',
  'Location', 'Country', 'Trip', 'Dates', 'People', 'Region',
  'Price', 'Budget', 'Age', 'Experience', 'Fitness',
  'Add-ons', 'Medical', 'Subject', 'Message'
];

const VISITOR_HEADERS = [
  'IP', 'City', 'Region', 'Country', 'ISP',
  'Browser', 'OS', 'Device', 'Screen',
  'Language', 'Timezone', 'Page Views',
  'Pages Visited', 'First Seen', 'Last Seen'
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss   = SpreadsheetApp.getActiveSpreadsheet();

    if (data.type === 'lead') {
      appendLead(ss, data.lead);
    } else if (data.type === 'visitor') {
      appendVisitor(ss, data.visitor);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
// Handle GET (health check / CORS preflight / data fetch)
function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const type = e && e.parameter && e.parameter.type;

  if (type === 'leads') {
    const sheet = ss.getSheetByName(LEADS_SHEET);
    if (!sheet || sheet.getLastRow() < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ ok: true, leads: [] }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, LEAD_HEADERS.length).getValues();
    const leads = rows.map(row => ({
      id:         row[0],
      createdAt:  row[1],
      status:     row[2],
      source:     row[3],
      name:       row[4],
      phone:      row[5],
      email:      row[6],
      location:   row[7],
      country:    row[8],
      trip:       row[9],
      dates:      row[10],
      people:     row[11],
      region:     row[12],
      price:      row[13],
      budget:     row[14],
      age:        row[15],
      experience: row[16],
      fitness:    row[17],
      addons:     row[18],
      medical:    row[19],
      subject:    row[20],
      message:    row[21]
    }));
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, leads }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, service: 'Fradpaix CRM' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  // Write headers if the sheet is empty
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#1a2b47')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendLead(ss, lead) {
  const sheet = getOrCreateSheet(ss, LEADS_SHEET, LEAD_HEADERS);
  sheet.appendRow([
    lead.id         || '',
    lead.createdAt  || new Date().toLocaleString('en-IN'),
    lead.status     || 'New',
    lead.source     || '',
    lead.name       || '',
    lead.phone      || '',
    lead.email      || '',
    lead.location   || '',
    lead.country    || '',
    lead.trip       || '',
    lead.dates      || '',
    lead.people     || '',
    lead.region     || '',
    lead.price      || '',
    lead.budget     || '',
    lead.age        || '',
    lead.experience || '',
    lead.fitness    || '',
    lead.addons     || '',
    lead.medical    || '',
    lead.subject    || '',
    lead.message    || ''
  ]);
}

function appendVisitor(ss, v) {
  const sheet = getOrCreateSheet(ss, VISITORS_SHEET, VISITOR_HEADERS);
  sheet.appendRow([
    v.ip         || '',
    v.city       || '',
    v.region     || '',
    v.country    || '',
    v.isp        || '',
    v.device?.browser   || '',
    v.device?.os        || '',
    v.device?.device    || '',
    v.device?.screen    || '',
    v.device?.language  || '',
    v.device?.timezone  || '',
    v.pageViews  || 0,
    Array.isArray(v.pagesVisited)
      ? v.pagesVisited.map(p => p.page).join(', ')
      : '',
    v.firstSeen  || '',
    v.lastSeen   || ''
  ]);
}

