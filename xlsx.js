'use strict';
/* Excel files for the Days tab: Export Excel, the blank template and the sample are ONE workbook layout built by xlsxBuild(),
   so a template looks exactly like an export, and any of them can be edited and imported again.
   Itinerary sheet columns (the same as the CSV, see csv.js, with Tag 1-3 after Notes):
     Day, Date, Time, Type, Stop, Location, Location link, Coordinates, Notes, Tag 1, Tag 2, Tag 3, Day title, Area, Hours, Website
   - Day            number, 1 = first day. Empty = same day as the row above. Dropdown.
   - Date           a formula: Trip Info start date + Day - 1 (or a lookup of the trip's own dates when they are not consecutive).
   - Time           a real Excel time for 09:00-style entries; anything else ("Late lunch") stays text. Dropdown.
   - Type           dropdown fed by the Lists sheet = the app's types (CATS in store.js). Empty = guessed from the Stop name on import.
   - Stop / Location  what you do / where (the map pin). Location is a dropdown of saved places, or type a new one.
   - Location link  the place's Google Maps link; Coordinates "lat, lon" linked to OpenStreetMap (a pasted "35.68, 139.69" works too).
   - Tags           up to three predefined tags per stop, written back into the note as [Tag] on import.
   Header colours: green = fill these (Day, Time, Type, Stop), light green = fills itself (Date), dark = optional.
   Other sheets: Trip Info (name, dates, travelers, confirmations), How to fill, Lists (dropdown sources). */

const XLSX_LIB = 'vendor/exceljs.min.js';
const XL = { dark: 'FF06291B', green: 'FF099250', auto: 'FF5E9B7A', band: 'FFF5F8F4', line: 'FFDEE6E0', ink: 'FF06291B', mute: 'FF6B7A70', lime: 'FFD7F36B', link: 'FF1155CC' };
const XLSX_TAG_COLS = ['Tag 1', 'Tag 2', 'Tag 3'];
const XLSX_COLS = ['Day', 'Date', 'Time', 'Type', 'Stop', 'Location', 'Location link', 'Coordinates', 'Notes', ...XLSX_TAG_COLS, 'Day title', 'Area', 'Hours', 'Website'];
const XLSX_FILL = ['Day', 'Time', 'Type', 'Stop'];                                   // green headers: the ones worth typing
const XLSX_W = { Day: 6, Date: 13, Time: 9, Type: 20, Stop: 30, Location: 26, 'Location link': 20, Coordinates: 20, Notes: 38, 'Tag 1': 13, 'Tag 2': 13, 'Tag 3': 13, 'Day title': 20, Area: 16, Hours: 16, Website: 26 };
const XLSX_HEAD_ROW = 5, XLSX_SPARE = 20;                                             // header on row 5; spare formatted rows to keep typing

const xlsxOsmUrl = c => `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=17/${c.lat}/${c.lon}`;
const xlsxIso = iso => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
const xlsxDate = iso => { const { y, m, d } = xlsxIso(iso); return new Date(Date.UTC(y, m - 1, d)); };
const xlsxSerial = iso => { const { y, m, d } = xlsxIso(iso); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5; };
const xlsxTime = raw => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(raw || '').trim()); return m && +m[1] < 24 && +m[2] < 60 ? (+m[1] * 60 + +m[2]) / 1440 : null; };
// [Tag] in a note -> Tag 1-3 columns (only the app's predefined tags, at most three); everything else stays in the note.
function xlsxSplitTags(note) {
  const tags = []; let rest = String(note || '');
  CSV_NOTE_TAGS.forEach(tg => { const re = new RegExp(`\\s*\\[${tg}\\]`, 'g'); if (tags.length < XLSX_TAG_COLS.length && re.test(rest)) { tags.push(tg); rest = rest.replace(re, ''); } });
  return { tags, note: rest.trim() };
}

/* ExcelJS styling helpers */
const xlBorder = () => { const s = { style: 'thin', color: { argb: XL.line } }; return { top: s, left: s, bottom: s, right: s }; };
const xlFill = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const xlFont = (o = {}) => ({ name: 'Arial', size: 10, color: { argb: XL.ink }, ...o });

function xlsxTitleBar(ws, cols, title, right) {
  ws.getRow(1).height = 26;
  for (let c = 1; c <= cols; c++) { const cell = ws.getCell(1, c); cell.fill = xlFill(XL.dark); cell.alignment = { vertical: 'middle' }; }
  const a = ws.getCell(1, 1); a.value = title; a.font = xlFont({ size: 11, bold: true, color: { argb: 'FFFFFFFF' } }); a.alignment = { horizontal: 'left', vertical: 'middle' };
  const z = ws.getCell(1, cols); z.value = right; z.font = xlFont({ size: 9, color: { argb: XL.lime } }); z.alignment = { horizontal: 'right', vertical: 'middle' };
}
function xlsxHeadRow(ws, row, labels, firstCol = 1, fillOf = () => XL.green) {
  ws.getRow(row).height = 20;
  labels.forEach((l, i) => {
    if (l == null) return;
    const c = ws.getCell(row, firstCol + i); c.value = l; c.font = xlFont({ bold: true, color: { argb: 'FFFFFFFF' } });
    c.fill = xlFill(fillOf(l)); c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = xlBorder();
  });
}

/* mode: 'export' (the trip's own stops), 'blank' (ready-made empty rows for each trip day) or 'sample' (a made-up trip using every type).
   All three share this code, so they cannot drift apart. */
function xlsxBuild(ExcelJS, tr, now = new Date(), mode = 'export') {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Trips'; wb.created = now;
  const it = wb.addWorksheet('Itinerary', { properties: { tabColor: { argb: XL.green } }, views: [{ state: 'frozen', ySplit: XLSX_HEAD_ROW }] });
  const ti = wb.addWorksheet('Trip Info', { views: [{ state: 'frozen', ySplit: 1 }] });
  const help = wb.addWorksheet('How to fill', { properties: { tabColor: { argb: XL.lime } } });
  const ls = wb.addWorksheet('Lists');
  it.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };   // prints on one page width
  const stamp = now.toISOString().slice(0, 10), n = XLSX_COLS.length, col = name => XLSX_COLS.indexOf(name) + 1;
  const sample = mode === 'sample', blank = mode === 'blank';
  const days = tr.days.length ? tr.days : [{ date: todayIso(), items: [] }];
  const start = days[0].date, end = days[days.length - 1].date;
  // Dates are a formula off the start date, which is only right when the days follow each other.
  const consecutive = sample || days.every((d, i) => d.date === addDays(start, i));

  /* ----- records for the Itinerary rows ----- */
  let recs;
  if (sample) recs = csvSampleRecords();
  else if (blank) recs = days.flatMap((d, i) => Array.from({ length: 5 }, () => ({ day: i + 1, blank: true })));
  else recs = csvRecords(tr);
  const serialOf = r => consecutive ? xlsxSerial(start) + r.day - 1 : xlsxSerial(r.date || days[r.day - 1]?.date || start);

  /* ----- Lists (dropdown sources) ----- */
  const times = []; for (let h = 6; h <= 23; h++) for (const m of ['00', '30']) times.push(`${String(h).padStart(2, '0')}:${m}`);
  const quick = CSV_TIME_TAGS.map(([, v]) => v), timeList = [...quick, ...times.filter(x => !quick.includes(x))];
  const typeList = Object.keys(CATS).map(k => CATS[k].label), tagList = CSV_NOTE_TAGS.slice();
  const places = [...new Set((sample ? [] : tr.spots).map(s => s.name).filter(Boolean))];
  const dayNums = Array.from({ length: Math.min(90, Math.max(days.length + 7, 14)) }, (_, i) => i + 1);
  const dates = days.map(d => d.date);
  const colLists = [['Type', typeList, 22], ['Time', timeList, 10], ['Tags', tagList, 16], ['Saved places', places, 32], ['Day', dayNums, 8], ['Trip dates', dates, 14]];
  xlsxHeadRow(ls, 1, colLists.map(c => c[0])); ls.columns = colLists.map(c => ({ width: c[2] }));
  colLists.forEach(([name, vals], ci) => vals.forEach((v, i) => {
    const cell = ls.getCell(i + 2, ci + 1);
    if (name === 'Trip dates') { cell.value = xlsxDate(v); cell.numFmt = 'yyyy-mm-dd'; } else { cell.value = v; if (name !== 'Day') cell.numFmt = '@'; }
    cell.font = xlFont(); cell.border = xlBorder();
  }));
  const listRef = (ci, len) => `Lists!$${String.fromCharCode(65 + ci)}$2:$${String.fromCharCode(65 + ci)}$${1 + Math.max(1, len)}`;

  /* ----- Itinerary ----- */
  it.columns = XLSX_COLS.map(c => ({ width: XLSX_W[c] }));
  const label = mode === 'export' ? `Exported from Trips · ${stamp}` : blank ? 'Blank template · fill in, then Import in Trips' : 'Sample · same layout as an export';
  xlsxTitleBar(it, n, `${tr.name || 'Trip'} · Itinerary${sample ? ' (sample)' : ''}`, label);
  it.getCell('A3').value = 'Itinerary'; it.getCell('A3').font = xlFont({ size: 14, bold: true });
  it.getCell('A4').value = 'Fill the green columns: Day, Time, Type, Stop. Date fills itself. Dark columns are optional. Leave Type empty and it is guessed from the Stop. Day empty = same day as the row above.';
  it.getCell('A4').font = xlFont({ color: { argb: XL.mute } });
  xlsxHeadRow(it, XLSX_HEAD_ROW, XLSX_COLS, 1, l => XLSX_FILL.includes(l) ? XL.green : l === 'Date' ? XL.auto : XL.dark);

  const total = recs.length + (blank || sample ? XLSX_SPARE : 5), last = XLSX_HEAD_ROW + total;
  let bandDay = 0;
  for (let r = XLSX_HEAD_ROW + 1; r <= last; r++) {
    const rec = recs[r - XLSX_HEAD_ROW - 1];
    if (rec && rec.day) bandDay = rec.day;
    const band = bandDay % 2 === 0 && bandDay > 0;
    for (let c = 1; c <= n; c++) {
      const cell = it.getCell(r, c); cell.font = xlFont(); cell.border = xlBorder(); if (band) cell.fill = xlFill(XL.band);
      cell.alignment = { vertical: 'top', wrapText: [col('Stop'), col('Location'), col('Notes')].includes(c), horizontal: c === 1 ? 'center' : 'left' };
    }
    it.getCell(r, 1).numFmt = '0'; it.getCell(r, col('Time')).numFmt = 'hh:mm'; it.getCell(r, col('Date')).numFmt = 'ddd, mmm d';
    const formula = consecutive ? `IF($A${r}="","",'Trip Info'!$B$6+$A${r}-1)` : `IF($A${r}="","",IFERROR(INDEX(${listRef(5, dates.length)},$A${r}),""))`;
    it.getCell(r, col('Date')).value = { formula, result: rec && rec.day ? serialOf(rec) : '' };
    if (!rec) continue;
    if (rec.day) it.getCell(r, 1).value = rec.day;
    if (rec.blank || rec.empty && !rec.title) { if (rec.dayTitle) it.getCell(r, col('Day title')).value = rec.dayTitle; if (rec.area) it.getCell(r, col('Area')).value = rec.area; if (rec.blank) continue; }
    const t = xlsxTime(rec.time); if (rec.time) it.getCell(r, col('Time')).value = t == null ? rec.time : t;
    if (rec.cat) it.getCell(r, col('Type')).value = CATS[rec.cat].label;
    if (rec.title) it.getCell(r, col('Stop')).value = rec.title;
    if (rec.place) it.getCell(r, col('Location')).value = rec.place;
    const c = rec.coords;
    if (rec.place && (rec.gUrl || c)) { const g = rec.gUrl || `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lon}`; const cell = it.getCell(r, col('Location link')); cell.value = { text: 'Open in Google Maps', hyperlink: g }; cell.font = xlFont({ color: { argb: XL.link }, underline: true }); }
    if (c) { const cell = it.getCell(r, col('Coordinates')); cell.value = { text: `${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}`, hyperlink: xlsxOsmUrl(c) }; cell.font = xlFont({ color: { argb: XL.link }, underline: true }); }
    const sp = rec.tags ? { tags: rec.tags, note: rec.note } : xlsxSplitTags(rec.note);
    if (sp.note) it.getCell(r, col('Notes')).value = sp.note;
    sp.tags.forEach((tg, i) => { it.getCell(r, col(XLSX_TAG_COLS[i])).value = tg; });
    if (rec.dayTitle) it.getCell(r, col('Day title')).value = rec.dayTitle;
    if (rec.area) it.getCell(r, col('Area')).value = rec.area;
    if (rec.hours) it.getCell(r, col('Hours')).value = rec.hours;
    if (rec.link) it.getCell(r, col('Website')).value = rec.link;
  }
  const rng = name => `${String.fromCharCode(64 + col(name))}${XLSX_HEAD_ROW + 1}:${String.fromCharCode(64 + col(name))}${last}`;
  const pick = (name, ci, len, prompt, strict = false) => it.dataValidations.add(rng(name), { type: 'list', allowBlank: true, formulae: [listRef(ci, len)], showErrorMessage: false, showInputMessage: true, promptTitle: name, prompt });
  pick('Day', 4, dayNums.length, 'Day number (1 = first day). Leave empty for the same day as the row above. Any number up to 90 works.');
  pick('Time', 1, timeList.length, 'Pick a time or type your own: 9:00, 9am, Late lunch.');
  pick('Type', 0, typeList.length, 'Pick a type, or leave empty: it is guessed from the Stop name when you import.');
  if (places.length) pick('Location', 3, places.length, 'Pick a saved place, or type a new name.');
  XLSX_TAG_COLS.forEach(tc => pick(tc, 2, tagList.length, 'Pick a tag (or type your own). It is added to the stop\'s note as [Tag].'));
  it.autoFilter = { from: { row: XLSX_HEAD_ROW, column: 1 }, to: { row: last, column: n } };

  /* ----- Trip Info ----- */
  ti.columns = [16, 20, 18, 24].map(width => ({ width }));
  xlsxTitleBar(ti, 4, `${tr.name || 'Trip'} · Itinerary${sample ? ' (sample)' : ''}`, label.replace(/ · fill in.*$/, ''));
  ti.getCell('A3').value = 'Trip details'; ti.getCell('A3').font = xlFont({ size: 14, bold: true });
  ti.getCell('A4').value = 'The start date drives every Date on the Itinerary sheet.'; ti.getCell('A4').font = xlFont({ color: { argb: XL.mute } });
  const endIso = sample ? addDays(start, 2) : end, span = xlsxSerial(endIso) - xlsxSerial(start);
  const info = [
    ['Destination', tr.name || '', null], ['Start date', xlsxDate(start), 'yyyy-mm-dd'], ['End date', xlsxDate(endIso), 'yyyy-mm-dd'],
    ['Nights', { formula: 'B7-B6', result: span }, '0'], ['Days', { formula: 'B7-B6+1', result: span + 1 }, '0'], ['Travelers', Math.max(1, (tr.members || []).length), '0']
  ];
  info.forEach(([lab, value, fmt], i) => {
    const r = 5 + i, a = ti.getCell(r, 1), b = ti.getCell(r, 2);
    a.value = lab; a.font = xlFont({ bold: true }); b.value = value; b.font = xlFont({ bold: true }); b.border = xlBorder();
    b.alignment = { horizontal: 'left' }; if (fmt) b.numFmt = fmt;
  });
  ti.getCell('A12').value = 'Confirmations'; ti.getCell('A12').font = xlFont({ size: 11, bold: true });
  xlsxHeadRow(ti, 13, ['Item', 'Provider', 'Confirmation #', 'Notes'], 1, () => XL.dark);
  for (let i = 0; i < 4; i++) for (let c = 1; c <= 4; c++) { const cell = ti.getCell(14 + i, c); cell.font = xlFont(); cell.border = xlBorder(); if (i % 2) cell.fill = xlFill(XL.band); }
  ti.getCell('A19').value = 'Add rows for trains, cars or tickets — anything with a confirmation code. (Not imported.)'; ti.getCell('A19').font = xlFont({ color: { argb: XL.mute } });

  /* ----- How to fill ----- */
  help.columns = [18, 58, 36].map(width => ({ width }));
  xlsxTitleBar(help, 3, 'How to fill the Itinerary sheet', 'Trips');
  help.getCell('A3').value = 'Works the same in Excel, Numbers and Google Sheets. This sheet is not imported.'; help.getCell('A3').font = xlFont({ color: { argb: XL.mute } });
  xlsxHeadRow(help, 5, ['Column', 'What to put', 'Example'], 1, () => XL.green);
  const doc = [
    ['Day', 'Day number, 1 = first day. Pick it from the dropdown. Leave it empty to stay on the same day as the row above. A number beyond the trip adds new days.', '1'],
    ['Date', 'Fills itself from Day and the start date on Trip Info. Nothing to type. (A typed YYYY-MM-DD also works and wins over Day.)', 'Tue, Dec 22'],
    ['Time', 'Pick from the dropdown (Morning 09:00, Lunch 12:00, Afternoon 15:00, Dinner 18:30, Evening 20:00 come first) or type your own. 9:00, 9am, 9:30pm all work, and so does text like Late lunch.', '09:00'],
    ['Type', 'Pick from the dropdown (see the Types table below). Empty is fine: it is guessed from the Stop name, and the preview shows what was chosen before anything is saved.', 'Train'],
    ['Stop', 'What you do: the stop\'s name. Falls back to Location when empty.', 'Narita Express to Tokyo'],
    ['Location', 'Where: pick a saved place or type a new name. It becomes a pin on the map (an existing place with the same name is reused).', 'Tokyo Station'],
    ['Location link', 'Optional Google Maps link. A long link also gives the pin; a short maps.app.goo.gl link is stored but cannot give coordinates.', 'https://www.google.com/maps/…'],
    ['Coordinates', 'Optional pin for a new Location as "lat, lon". Paste what Google Maps shows when you right-click a spot.', '35.6812, 139.7671'],
    ['Notes', 'Free text.', 'Reserved seat, about 55 min'],
    ['Tag 1, 2, 3', 'Up to three predefined tags per stop, each from its own dropdown. On import they are added to the note as [Tag]; a tag you type yourself works too.', 'Book ahead'],
    ['Day title, Area', 'Optional, on the first row of a day. Used only when the day has none yet.', 'Arrival day / Narita → Asakusa'],
    ['Hours, Website', 'Optional opening hours, and a link starting with http(s). Used only when the place has none yet.', '11:00-20:30']
  ];
  const row = (r, vals, i) => vals.forEach((v, c) => { const cell = help.getCell(r, c + 1); cell.value = v; cell.font = xlFont({ bold: c === 0 }); cell.border = xlBorder(); cell.alignment = { vertical: 'top', wrapText: true }; if (i % 2) cell.fill = xlFill(XL.band); });
  doc.forEach((v, i) => row(6 + i, v, i));
  const tRow = 7 + doc.length;
  help.getCell(tRow, 1).value = 'Types'; help.getCell(tRow, 1).font = xlFont({ size: 11, bold: true });
  xlsxHeadRow(help, tRow + 1, ['Type', 'Use it for', 'Example stop'], 1, () => XL.green);
  const eg = { flight: 'Land at Narita (flight JL740)', train: 'Narita Express to Tokyo', transfer: 'Metro to Shibuya', base: 'Hotel check-in', food: 'Ramen lunch', sights: 'Senso-ji Temple walk', activity: 'teamLab Planets',
    shopping: 'Souvenir shopping', fashion: 'Fashion browsing', pokemon: 'Card shop stop', slowpoke: 'Stamp rally stop', free: 'Free time at the hotel', other: 'Return pocket Wi-Fi' };
  Object.keys(CATS).forEach((k, i) => row(tRow + 2 + i, [CATS[k].label, CATS[k].hint, eg[k] || ''], i));
  const sRow = tRow + 3 + Object.keys(CATS).length;
  help.getCell(sRow, 1).value = 'Steps'; help.getCell(sRow, 1).font = xlFont({ size: 11, bold: true });
  ['Fill in the Itinerary sheet (keep the header row as it is).',
    'Excel / Numbers: save as .xlsx.   Google Sheets: File → Download → Microsoft Excel (.xlsx).',
    'In Trips: Days → Import → Choose file, and pick the .xlsx. You see a preview before anything is saved.',
    'Google Sheets users: to start, open sheets.google.com → File → Import → Upload this file → Replace spreadsheet. Dropdowns and colours come with it.'
  ].forEach((x, i) => { const cell = help.getCell(sRow + 1 + i, 1); cell.value = `${i + 1}. ${x}`; cell.font = xlFont(); });
  return wb;
}

// Cell value -> plain text, whatever ExcelJS hands back (rich text, hyperlinks, formula results, dates, numbers).
function xlsxCellText(v, kind) {
  if (v == null) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') { const p = n => String(n).padStart(2, '0'); return kind === 'Time' ? `${p(v.getUTCHours())}:${p(v.getUTCMinutes())}` : `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`; }
  if (typeof v === 'number') {
    if (kind === 'Time' && v >= 0 && v < 1) { const m = Math.round(v * 1440); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
    if (kind === 'Date' && v > 20000) return xlsxCellText(new Date(Math.round((v - 25569) * 864e5)), 'Date');   // Excel serial date
    return String(v);
  }
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map(x => x.text).join('');
    if ('result' in v) return xlsxCellText(v.result, kind);
    if (v.text != null) return xlsxCellText(v.text, kind);
    if (v.error) return '';
    return '';
  }
  return String(v).trim();
}
/* .xlsx -> a grid of header labels + rows, which csvImportRows() normalises (csvNormalize), so csvPreview / csvApply work unchanged.
   Finds the header row (the file has a title bar above it) and reads this app's Export Excel, the template and the sample alike,
   including the first Excel export layout. A "Location link" cell gives its hyperlink address, not the words "Open in Google Maps". */
async function xlsxReadGrid(ExcelJS, buf) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
  let pick = null;
  for (const ws of [...wb.worksheets].sort((a, b) => (b.name === 'Itinerary') - (a.name === 'Itinerary'))) {
    for (let r = 1; r <= Math.min(15, ws.rowCount) && !pick; r++) {
      const heads = []; ws.getRow(r).eachCell({ includeEmpty: false }, (c, ci) => { const h = csvHeadOf(xlsxCellText(c.value)); if (h) heads[ci] = xlsxCellText(c.value).trim(); });
      if (heads.filter(Boolean).length >= 3) pick = { ws, r, heads };
    }
    if (pick) break;
  }
  if (!pick) throw Error('Header row not recognised. Use the template columns.');
  const { ws, r: hr, heads } = pick, cols = heads.map((h, ci) => h ? ci : 0).filter(Boolean), grid = [cols.map(ci => heads[ci])];
  for (let r = hr + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r), vals = cols.map(ci => {
      const h = csvHeadOf(heads[ci]), v = row.getCell(ci).value;
      if (h === 'Gmaps' && v && typeof v === 'object' && v.hyperlink) return String(v.hyperlink);
      return xlsxCellText(v, h === 'Time' ? 'Time' : h === 'Date' ? 'Date' : '').trim();
    });
    if (vals.some(x => x)) grid.push(vals);
  }
  if (grid.length < 2) throw Error('The file has no rows.');
  return grid;
}

/* ---------- UI ---------- */
// ExcelJS is ~0.9 MB, so it loads on the first export and is kept in the offline cache (sw.js).
// Tries the copy shipped with the app first, then two CDNs (a host that skipped the vendor/ folder, a stale cache or a
// blocked file no longer breaks the export). Each try checks that ExcelJS really arrived.
const XLSX_SOURCES = [XLSX_LIB, 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js', 'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js'];
let xlsxLoading = null;
function xlsxLoad() {
  if (window.ExcelJS?.Workbook) return Promise.resolve();
  return xlsxLoading ||= (async () => {
    for (const src of XLSX_SOURCES) {
      const ok = await new Promise(res => {
        const s = document.createElement('script'); s.src = src; s.async = true;
        const timer = setTimeout(() => { s.remove(); res(false); }, 20000);
        s.onload = () => { clearTimeout(timer); res(!!window.ExcelJS?.Workbook); };
        s.onerror = () => { clearTimeout(timer); s.remove(); res(false); };
        document.head.appendChild(s);
      });
      if (ok) return;
    }
    xlsxLoading = null;
    throw Error(navigator.onLine ? 'Could not load the Excel library. Try again in a moment.' : 'Could not load the Excel library. Connect once, then try again.');
  })();
}
async function xlsxExport(tr) {
  if (!tr.days.length) return toast('Nothing to export yet.');
  toast('Building Excel…');
  try {
    await xlsxLoad();
    const wb = xlsxBuild(window.ExcelJS, tr), buf = await wb.xlsx.writeBuffer(), n = tr.days.reduce((a, d) => a + d.items.length, 0);
    await saveFile(`${slug(tr.name)}-itinerary.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    toast(`${t('Exported')} ${n} ${t('stops')} · ${tr.days.length} ${t('days')}`);
  } catch (e) { toast(e.message || 'Export failed.'); }
}

async function xlsxTemplateDownload(tr, sample = false) {
  toast('Building Excel…');
  try {
    await xlsxLoad();
    const buf = await xlsxBuild(window.ExcelJS, tr, new Date(), sample ? 'sample' : 'blank').xlsx.writeBuffer();
    await saveFile(`${slug(tr.name)}-itinerary-${sample ? 'sample' : 'template'}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  } catch (e) { toast(e.message || 'Export failed.'); }
}
async function xlsxReadFile(f) {
  if (f.size > 8e6) throw Error('File is too large.');
  await xlsxLoad();
  return xlsxReadGrid(window.ExcelJS, await f.arrayBuffer());
}
