/**
 * Apex Title Studio — Google Doc generator (Google Apps Script Web App)
 * ---------------------------------------------------------------------------
 * Receives the verified report data from Apex_Title_Studio.html, copies your
 * branded Google-Doc template, fills its {{PLACEHOLDERS}}, colors any
 * "[TO VERIFY]" text red, and returns the new Doc's URL for leadership review.
 *
 * Runs as YOU (the Drive owner) — no service account, no server, free.
 * Deploy steps are in README.md.
 */

var CONFIG = {
  // Optional: paste your own template Doc ID here to use a hand-styled template.
  // Leave '' and the script will create + reuse one automatically (run setup()).
  TEMPLATE_ID: '',
  // Optional: Drive folder ID to drop generated docs into (e.g. a "Title Reports" folder).
  OUTPUT_FOLDER_ID: ''
};

/** POST handler — the app calls this with {title, tokens:{...}} as a text/plain body. */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents || '{}');
    var tokens  = payload.tokens || {};
    var title   = payload.title || ('Apex Title Report — ' + isoDate_());

    var templateId = ensureTemplate_(false);
    var copy = DriveApp.getFileById(templateId).makeCopy(title);
    if (CONFIG.OUTPUT_FOLDER_ID) {
      try {
        var folder = DriveApp.getFolderById(CONFIG.OUTPUT_FOLDER_ID);
        folder.addFile(copy);
        DriveApp.getRootFolder().removeFile(copy);
      } catch (moveErr) { /* leave in My Drive if folder id is wrong */ }
    }

    var doc  = DocumentApp.openById(copy.getId());
    var body = doc.getBody();

    Object.keys(tokens).forEach(function (k) {
      body.replaceText('\\{\\{' + k + '\\}\\}', sanitize_(tokens[k]));
    });
    body.replaceText('\\{\\{[A-Z0-9_]+\\}\\}', '');   // clear any unmatched tokens
    colorVerifyFlags_(body);

    doc.saveAndClose();
    return json_({ ok: true, url: doc.getUrl(), id: doc.getId() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

/** GET handler — a quick health check you can open in a browser. */
function doGet() {
  return json_({ ok: true, service: 'Apex Title Studio — Google Doc generator', templateId: ensureTemplate_(false) });
}

/* ----------------------------- helpers ----------------------------- */

function sanitize_(v) { return (v === null || v === undefined) ? '' : String(v); }
function isoDate_()   { return new Date().toISOString().slice(0, 10); }
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Paint every "[TO VERIFY]" flag (and the DRAFT banner) red + bold. */
function colorVerifyFlags_(body) {
  var hit = body.findText('\\[TO VERIFY\\]');
  while (hit) {
    var t = hit.getElement().asText();
    t.setForegroundColor(hit.getStartOffset(), hit.getEndOffsetInclusive(), '#cc0000');
    t.setBold(hit.getStartOffset(), hit.getEndOffsetInclusive(), true);
    hit = body.findText('\\[TO VERIFY\\]', hit);
  }
  var banner = body.findText('DRAFT — NOT A COMPLETED SEARCH');
  if (banner) {
    var bt = banner.getElement().asText();
    bt.setForegroundColor('#cc0000').setBold(true);
  }
}

/**
 * Run ONCE from the Apps Script editor to create the branded template Doc.
 * It logs the new template's ID; you can then restyle that Doc freely — the
 * {{PLACEHOLDERS}} are what matter. The ID is cached so it's only made once.
 */
function setup() {
  var id = ensureTemplate_(true);
  Logger.log('Apex template ready: https://docs.google.com/document/d/' + id + '/edit');
  return id;
}

function ensureTemplate_(force) {
  var props = PropertiesService.getScriptProperties();
  var id = CONFIG.TEMPLATE_ID || props.getProperty('APEX_TEMPLATE_ID');
  if (id && !force) {
    try { DriveApp.getFileById(id); return id; } catch (e) { /* recreate if deleted */ }
  }
  var newId = buildDefaultTemplate_();
  props.setProperty('APEX_TEMPLATE_ID', newId);
  return newId;
}

/** Builds a North-Star-structured template Doc with {{PLACEHOLDERS}}. */
function buildDefaultTemplate_() {
  var doc = DocumentApp.create('Apex Abstracts — Title Report TEMPLATE');
  var b = doc.getBody();
  b.clear();

  b.appendParagraph('APEX ABSTRACTS')
    .setHeading(DocumentApp.ParagraphHeading.TITLE)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  b.appendParagraph('A Title Abstracting Company · New Castle · Kent · Sussex, Delaware')
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER)
    .editAsText().setFontSize(9).setForegroundColor('#6b6557');
  b.appendParagraph('TITLE SEARCH REPORT')
    .setHeading(DocumentApp.ParagraphHeading.HEADING1)
    .setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  b.appendParagraph('{{DRAFT_BANNER}}');

  function kv(label, token) { b.appendParagraph(label + ': {{' + token + '}}'); }
  kv('Search Date', 'SEARCH_DATE');
  kv('Index Date', 'INDEX_DATE');
  kv('Property', 'PROPERTY');
  kv('Condo / Subdivision', 'CONDO_SUBDIVISION');
  kv('Hundred', 'HUNDRED');
  kv('Parcel Number', 'PARCEL_NUMBER');
  kv('Unit / Lot', 'UNIT_LOT');
  kv('Block', 'BLOCK');
  kv('Section', 'SECTION');
  kv('Sellers / Owners', 'SELLERS_OWNERS');
  kv('Buyers / Borrowers', 'BUYERS_BORROWERS');
  kv('Deed Record', 'DEED_RECORD');

  function sec(title, token) {
    b.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    b.appendParagraph('{{' + token + '}}');
  }
  sec('LEGAL DESCRIPTION', 'LEGAL_DESCRIPTION');
  sec('CHAIN OF TITLE / DIRECT CONVEYANCES', 'CHAIN');
  sec('MORTGAGES / DEEDS OF TRUST', 'MORTGAGES');
  sec('ASSIGNMENTS', 'ASSIGNMENTS');
  sec('SATISFACTIONS / RELEASES', 'SATISFACTIONS');
  sec('JUDGMENTS', 'JUDGMENTS');
  sec('FEDERAL TAX LIEN', 'FEDERAL_LIEN');
  sec('OTHER LIENS / MECHANICS / UCC / NOTICES', 'OTHER_LIENS');
  kv('Property Taxes', 'TAX_STATUS');

  b.appendParagraph('NOTICE: This form does not constitute title insurance. Liability is assumed by the Company solely in its capacity as Abstractor for its negligence, mistakes or omissions in a sum not exceeding Five Hundred Dollars unless used in conjunction with a title insurance policy written through this company.')
    .editAsText().setFontSize(8).setForegroundColor('#5a5446');

  doc.saveAndClose();
  return doc.getId();
}
