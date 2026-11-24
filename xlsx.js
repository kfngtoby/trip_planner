'use strict';
/* Days tab: Excel export (.xlsx). Recreates the look of the Voyana travel-itinerary template with ExcelJS.
   The CSV export is unchanged; this is a separate, read-only report (there is no Excel import).
   Itinerary sheet columns:
     Day, Date, Time, Type, Location, Location link, Coordinates, Notes
   - Date          formula driven by Trip Info start date when the trip's days are consecutive, otherwise the plain date.
   - Time          real Excel time for 09:00-style entries; anything else ("21:00–22:00", "Late lunch") stays text.
   - Type          dropdown fed by the "Activity types" list on Trip Info. Mapped from the stop's category, see XLSX_TYPE_BY_CAT.
   - Location      the map place name; the stop title when the stop has no place. A title that differs from the place goes first in Notes.
   - Location link the place's pasted Google Maps link, else a Google Maps link built from its coordinates / name.
   - Coordinates   "lat, lon" linked to OpenStreetMap. Taken from the place's pin, or decoded from a long Google Maps link
                   (!3d..!4d.., @lat,lon, ?q=lat,lon). Short maps.app.goo.gl links cannot be decoded offline: pin the place instead.
   Trip Info sheet: destination (trip name), dates, nights, days, travelers, an empty Confirmations table, and the Type list. */

const XLSX_LIB = 'vendor/exceljs.min.js';
const XLSX_TYPES = ['Flight', 'Hotel', 'Train', 'Transfer', 'Activity', 'Meal', 'Free time', 'Other'];
// Type for a stop that is linked to a map place, by the place's category. Edit here to change the mapping.
const XLSX_TYPE_BY_CAT = { base: 'Hotel', sights: 'Activity', food: 'Meal', fashion: 'Activity', shopping: 'Activity', pokemon: 'Activity', slowpoke: 'Activity' };
// Stops are sorted by words in the title (and the place name for no-place / "Hotels & transport" stops). First match wins, then the category mapping above.
const XLSX_TYPE_WORDS = [
  ['Flight', /flight|airport|airline|boarding|航班|機場|机场|空港|飛行機|フライト/i],
  ['Train', /train|shinkansen|railway|\brail\b|\bjr\b|新幹線|特急|電車|列車|火車|火车|高鐵/i],
  ['Transfer', /transfer|taxi|\bbus\b|ferry|shuttle|metro|subway|rental car|drive|bus stop|バス|タクシー|フェリー|地下鉄|移動|接駁|巴士|渡輪/i],
  ['Hotel', /check-?in|check-?out|hotel|hostel|ryokan|airbnb|resort|宿|ホテル|旅館|酒店|住宿/i],
  ['Meal', /breakfast|brunch|lunch|dinner|supper|coffee|café|cafe|ramen|izakaya|早餐|午餐|晚餐|ランチ|ディナー|朝食|夕食/i],
  ['Free time', /free (time|day)|自由|空閒|フリー/i]
];
const XL = { dark: 'FF06291B', green: 'FF099250', band: 'FFF5F8F4', line: 'FFDEE6E0', ink: 'FF06291B', mute: 'FF6B7A70', lime: 'FFD7F36B', link: 'FF1155CC' };

function xlsxType(it, spot) {
  // Keywords match the stop title for every category. The place name is also checked only for no-place and "Hotels & transport" stops.
  const title = it.title || '', withName = !spot || spot.cat === 'base';
  const text = withName ? `${title} ${spot ? spot.name : ''}` : title;
  const hit = XLSX_TYPE_WORDS.find(([, re]) => re.test(text));
  if (hit) return hit[0];
  return spot ? (XLSX_TYPE_BY_CAT[spot.cat] || 'Activity') : 'Activity';
}

// Coordinates for a place: its pin, else decoded from its Google Maps link, else null.
function xlsxCoords(spot) {
  if (!spot) return null;
  if (hasCoords(spot)) return { lat: spot.lat, lon: spot.lon, from: 'pin' };
  if (spot.gmaps) { const p = parseGmapsLink(spot.gmaps); if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) return { lat: p.lat, lon: p.lon, from: 'link' }; }
  return null;
}
const xlsxOsmUrl = c => `https://www.openstreetmap.org/?mlat=${c.lat}&mlon=${c.lon}#map=17/${c.lat}/${c.lon}`;
function xlsxGoogleUrl(spot, c) {
  if (!spot) return '';
  if (spot.gmaps) return spot.gmaps;
  return c ? `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lon}` : gmapsPlaceUrl(spot);
}
const xlsxIso = iso => { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; };
const xlsxDate = iso => { const { y, m, d } = xlsxIso(iso); return new Date(Date.UTC(y, m - 1, d)); };
const xlsxSerial = iso => { const { y, m, d } = xlsxIso(iso); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5; };
const xlsxTime = raw => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(raw || '').trim()); return m && +m[1] < 24 && +m[2] < 60 ? (+m[1] * 60 + +m[2]) / 1440 : null; };

/* trip -> one object per Itinerary row. A day with no stops still gets a row so the day is not lost. */
function xlsxRows(tr) {
  const rows = [];
  tr.days.forEach((d, i) => {
    const dayNote = [d.title, d.place].filter(Boolean).join(' · ');
    if (!d.items.length) { rows.push({ day: i + 1, date: d.date, time: '', type: '', location: '', gUrl: '', coords: null, notes: dayNote }); return; }
    d.items.forEach(it => {
      const spot = it.spotId && tr.spots.find(x => x.id === it.spotId) || null, c = xlsxCoords(spot);
      const title = (it.title || '').trim(), loc = spot ? spot.name : title, note = (it.note || '').trim();
      const notes = spot && title && title !== spot.name ? (note ? `${title} — ${note}` : title) : note;
      rows.push({ day: i + 1, date: d.date, time: it.time || '', type: xlsxType(it, spot), location: loc, gUrl: xlsxGoogleUrl(spot, c), coords: c, notes });
    });
  });
  return rows;
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
function xlsxHeadRow(ws, row, labels, firstCol = 1) {
  ws.getRow(row).height = 20;
  labels.forEach((l, i) => {
    if (l == null) return;
    const c = ws.getCell(row, firstCol + i); c.value = l; c.font = xlFont({ bold: true, color: { argb: 'FFFFFFFF' } });
    c.fill = xlFill(XL.green); c.alignment = { horizontal: 'center', vertical: 'middle' }; c.border = xlBorder();
  });
}

function xlsxBuild(ExcelJS, tr, now = new Date()) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Trips'; wb.created = now;
  const it = wb.addWorksheet('Itinerary', { properties: { tabColor: { argb: XL.green } }, views: [{ state: 'frozen', ySplit: 5 }] });
  const ti = wb.addWorksheet('Trip Info', { views: [{ state: 'frozen', ySplit: 1 }] });
  const stamp = now.toISOString().slice(0, 10), rows = xlsxRows(tr);

  /* ----- Itinerary ----- */
  it.columns = [6, 12, 10, 11, 30, 22, 22, 38].map(width => ({ width }));
  xlsxTitleBar(it, 8, `${tr.name || 'Trip'} · Itinerary`, `Exported from Trips · ${stamp}`);
  it.getCell('A3').value = 'Itinerary'; it.getCell('A3').font = xlFont({ size: 14, bold: true });
  it.getCell('A4').value = 'Type the day number and the date fills in from Trip Info. Pick a Type from the dropdown.';
  it.getCell('A4').font = xlFont({ color: { argb: XL.mute } });
  xlsxHeadRow(it, 5, ['Day', 'Date', 'Time', 'Type', 'Location', 'Location link', 'Coordinates', 'Notes']);

  // The Date formula counts from the start date, so it is only right when the trip's days follow each other.
  const consecutive = tr.days.every((d, i) => d.date === addDays(tr.days[0].date, i));
  const total = rows.length + 5, last = 5 + total; // five spare formatted rows to keep typing in Excel
  for (let r = 6; r <= last; r++) {
    const row = rows[r - 6], band = (r - 6) % 2 === 1;
    for (let c = 1; c <= 8; c++) {
      const cell = it.getCell(r, c); cell.font = xlFont(); cell.border = xlBorder(); if (band) cell.fill = xlFill(XL.band);
      cell.alignment = { vertical: 'top', wrapText: c === 5 || c === 8 };
    }
    it.getCell(r, 1).numFmt = '0'; it.getCell(r, 3).numFmt = 'h:mm AM/PM'; it.getCell(r, 2).numFmt = 'ddd, mmm d';
    if (row) it.getCell(r, 1).value = row.day;
    if (consecutive) it.getCell(r, 2).value = { formula: `IF($A${r}="","",'Trip Info'!$B$6+$A${r}-1)`, result: row ? xlsxSerial(row.date) : '' };
    else if (row) it.getCell(r, 2).value = xlsxDate(row.date);
    if (!row) continue;
    const t = xlsxTime(row.time); if (row.time) it.getCell(r, 3).value = t == null ? row.time : t;
    if (row.time && t == null) it.getCell(r, 3).alignment = { vertical: 'top', wrapText: true };
    if (row.type) it.getCell(r, 4).value = row.type;
    if (row.location) it.getCell(r, 5).value = row.location;
    if (row.gUrl) { const c = it.getCell(r, 6); c.value = { text: 'Open in Google Maps', hyperlink: row.gUrl }; c.font = xlFont({ color: { argb: XL.link }, underline: true }); }
    if (row.coords) { const c = it.getCell(r, 7); c.value = { text: `${row.coords.lat.toFixed(5)}, ${row.coords.lon.toFixed(5)}`, hyperlink: xlsxOsmUrl(row.coords) }; c.font = xlFont({ color: { argb: XL.link }, underline: true }); }
    if (row.notes) it.getCell(r, 8).value = row.notes;
  }
  it.dataValidations.add(`D6:D${last}`, { type: 'list', allowBlank: true, formulae: [`'Trip Info'!$F$14:$F$${13 + XLSX_TYPES.length}`] });

  /* ----- Trip Info ----- */
  ti.columns = [16, 20, 18, 24, 3, 14].map(width => ({ width }));
  xlsxTitleBar(ti, 6, `${tr.name || 'Trip'} · Itinerary`, `Exported from Trips · ${stamp}`);
  ti.getCell('A3').value = 'Trip details'; ti.getCell('A3').font = xlFont({ size: 14, bold: true });
  ti.getCell('A4').value = 'Dates here drive the dates on the Itinerary tab.'; ti.getCell('A4').font = xlFont({ color: { argb: XL.mute } });
  const start = tr.days.length ? tr.days[0].date : todayIso(), end = tr.days.length ? tr.days[tr.days.length - 1].date : start;
  const info = [
    ['Destination', tr.name || '', null], ['Start date', xlsxDate(start), 'yyyy-mm-dd'], ['End date', xlsxDate(end), 'yyyy-mm-dd'],
    ['Nights', { formula: 'B7-B6', result: xlsxSerial(end) - xlsxSerial(start) }, '0'],
    ['Days', { formula: 'B7-B6+1', result: xlsxSerial(end) - xlsxSerial(start) + 1 }, '0'],
    ['Travelers', Math.max(1, (tr.members || []).length), '0']
  ];
  info.forEach(([label, value, fmt], i) => {
    const r = 5 + i, a = ti.getCell(r, 1), b = ti.getCell(r, 2);
    a.value = label; a.font = xlFont({ bold: true }); b.value = value; b.font = xlFont({ bold: true }); b.border = xlBorder();
    b.alignment = { horizontal: 'left' }; if (fmt) b.numFmt = fmt;
  });
  ti.getCell('A12').value = 'Confirmations'; ti.getCell('A12').font = xlFont({ size: 11, bold: true });
  xlsxHeadRow(ti, 13, ['Item', 'Provider', 'Confirmation #', 'Notes']);
  xlsxHeadRow(ti, 13, ['Activity types'], 6);
  const n = Math.max(4, XLSX_TYPES.length);
  for (let i = 0; i < n; i++) {
    const r = 14 + i, band = i % 2 === 1;
    for (const c of [1, 2, 3, 4, 6]) {
      if (c !== 6 && i >= 4) continue; if (c === 6 && i >= XLSX_TYPES.length) continue;
      const cell = ti.getCell(r, c); cell.font = xlFont(); cell.border = xlBorder(); if (band) cell.fill = xlFill(XL.band);
    }
    if (i < XLSX_TYPES.length) ti.getCell(r, 6).value = XLSX_TYPES[i];
  }
  ti.getCell(`A${14 + n + 1}`).value = 'Add rows for trains, cars or tickets — anything with a confirmation code.'; ti.getCell(`A${14 + n + 1}`).font = xlFont({ color: { argb: XL.mute } });
  return wb;
}

/* ---------- Fill-in template (.xlsx, works in Excel and Google Sheets) + .xlsx import ----------
   The template keeps the same columns as the CSV (CSV_COLS) so one importer serves both. Formatting, dropdowns, frozen header
   and the instruction sheet survive in Excel, Numbers and Google Sheets (File → Import → Upload), which a CSV cannot do.
   Import reads the filled-in .xlsx (also a Google Sheets "Download → Microsoft Excel" file, and this app's own Export Excel). */
const XLSX_TPL_ROWS = 80;                                   // formatted, ready-to-type rows (at least one per trip day)
const XLSX_TAG_COLS = ['Tag 1', 'Tag 2', 'Tag 3'];                  // pick up to three predefined tags per stop; import adds them to the note as [Tag]
const XLSX_TPL_COLS = CSV_COLS.flatMap(c => c === 'Notes' ? [c, ...XLSX_TAG_COLS] : [c]);
const XLSX_CORE = ['Date', 'Day', 'Time', 'Title', 'Category', 'Map place', 'Notes', ...XLSX_TAG_COLS];   // green headers; the rest are optional extras
const XLSX_COL_W = { 'Tag 1': 14, 'Tag 2': 14, 'Tag 3': 14, Date: 12, Time: 9, Category: 20, Day: 6, Title: 28, 'Map place': 24, Notes: 36, Lat: 11, Lon: 11, 'Day title': 20, Area: 16, Hours: 14, Link: 28 };

function xlsxTemplateBuild(ExcelJS, tr, now = new Date(), sample = false) {
  const wb = new ExcelJS.Workbook(); wb.creator = 'Trips'; wb.created = now;
  const st = wb.addWorksheet('Stops', { properties: { tabColor: { argb: XL.green } }, views: [{ state: 'frozen', ySplit: 3 }] });
  const help = wb.addWorksheet('How to fill', { properties: { tabColor: { argb: XL.lime } } });
  const lists = wb.addWorksheet('Lists');
  const n = XLSX_TPL_COLS.length, labels = Object.keys(CATS).map(k => CATS[k].label);

  /* Lists (dropdown sources): these power the quick-entry dropdowns on the Stops tab */
  const times = []; for (let h = 6; h <= 23; h++) for (const m of ['00', '30']) times.push(`${String(h).padStart(2, '0')}:${m}`);
  const quick = CSV_TIME_TAGS.map(([, v]) => v), timeList = [...quick, ...times.filter(x => !quick.includes(x))];   // Morning / Lunch / Afternoon / Dinner / Evening first
  const tags = CSV_NOTE_TAGS.slice(), places = [...new Set(tr.spots.map(s => s.name).filter(Boolean))], dates = tr.days.map(d => d.date);
  const colLists = [['Category', labels, 24], ['Time', timeList, 10], ['Tags', tags, 16], ['Saved places', places, 30], ['Trip dates', dates, 14]];
  xlsxHeadRow(lists, 1, colLists.map(c => c[0])); lists.columns = colLists.map(c => ({ width: c[2] }));
  colLists.forEach(([name, vals], ci) => vals.forEach((v, i) => {
    const cell = lists.getCell(i + 2, ci + 1);
    if (name === 'Trip dates') { cell.value = xlsxDate(v); cell.numFmt = 'yyyy-mm-dd'; } else { cell.value = v; cell.numFmt = '@'; }
    cell.font = xlFont(); cell.border = xlBorder();
  }));
  const listRef = (ci, len) => `Lists!$${String.fromCharCode(65 + ci)}$2:$${String.fromCharCode(65 + ci)}$${1 + Math.max(1, len)}`;

  /* Stops */
  st.columns = XLSX_TPL_COLS.map(c => ({ width: XLSX_COL_W[c] || 14 }));
  xlsxTitleBar(st, n, `${tr.name || 'Trip'} · Stops ${sample ? 'sample' : 'template'}`, 'Fill in, then Import in Trips');
  st.getCell('A2').value = 'One row per stop. Date or Day is enough to place a stop; Title is the stop name. Green columns are the usual ones, the rest are optional. See the “How to fill” tab.';
  st.getCell('A2').font = xlFont({ color: { argb: XL.mute } });
  xlsxHeadRow(st, 3, XLSX_TPL_COLS);
  XLSX_TPL_COLS.forEach((c, i) => { if (!XLSX_CORE.includes(c)) st.getCell(3, i + 1).fill = xlFill(XL.dark); });
  const days = tr.days.length ? tr.days : [{ date: todayIso() }], total = Math.max(XLSX_TPL_ROWS, days.length + 20);
  const col = name => XLSX_TPL_COLS.indexOf(name) + 1;
  for (let k = 0; k < total; k++) {
    const r = 4 + k, band = k % 2 === 1, d = days[k];
    XLSX_TPL_COLS.forEach((name, i) => {
      const cell = st.getCell(r, i + 1); cell.font = xlFont(); cell.border = xlBorder(); if (band) cell.fill = xlFill(XL.band);
      cell.alignment = { vertical: 'top', wrapText: name === 'Title' || name === 'Notes' || name === 'Map place', horizontal: ['Day', 'Lat', 'Lon'].includes(name) ? 'center' : 'left' };
      if (CSV_TEXT_COLS.includes(name) || XLSX_TAG_COLS.includes(name)) cell.numFmt = '@';       // text, so 9:00 and “=...” stay exactly as typed
    });
    st.getCell(r, col('Date')).numFmt = 'yyyy-mm-dd'; st.getCell(r, col('Day')).numFmt = '0'; st.getCell(r, col('Lat')).numFmt = '0.000000'; st.getCell(r, col('Lon')).numFmt = '0.000000';
    if (d && !sample) { st.getCell(r, col('Date')).value = xlsxDate(d.date); st.getCell(r, col('Day')).value = k + 1; }
    // quick entry: pick from a dropdown, or just type something else
    if (dates.length) st.getCell(r, col('Date')).dataValidation = { type: 'list', allowBlank: true, formulae: [listRef(4, dates.length)], showErrorMessage: false, showInputMessage: true, promptTitle: 'Date', prompt: 'Pick a trip day, or type a date (YYYY-MM-DD).' };
    st.getCell(r, col('Time')).dataValidation = { type: 'list', allowBlank: true, formulae: [listRef(1, timeList.length)], showErrorMessage: false, showInputMessage: true, promptTitle: 'Time', prompt: 'Pick a time, or type your own (9:00, 9am, Late lunch).' };
    if (places.length) st.getCell(r, col('Map place')).dataValidation = { type: 'list', allowBlank: true, formulae: [listRef(3, places.length)], showErrorMessage: false, showInputMessage: true, promptTitle: 'Map place', prompt: 'Pick a saved place, or type a new name.' };
    XLSX_TAG_COLS.forEach(tc => { st.getCell(r, col(tc)).dataValidation = { type: 'list', allowBlank: true, formulae: [listRef(2, tags.length)], showErrorMessage: false, showInputMessage: true, promptTitle: tc, prompt: 'Pick a tag from the list (or type your own). It is added to the stop\'s note on import.' }; });
    st.getCell(r, col('Category')).dataValidation = { type: 'list', allowBlank: true, formulae: [`Lists!$A$2:$A$${1 + labels.length}`], showErrorMessage: true, errorTitle: 'Category', error: 'Pick a category from the list.' };
    st.getCell(r, col('Day')).dataValidation = { type: 'whole', operator: 'between', allowBlank: true, formulae: [1, 90], showErrorMessage: true, errorTitle: 'Day', error: 'Day is a number from 1 to 90.' };
    st.getCell(r, col('Lat')).dataValidation = { type: 'decimal', operator: 'between', allowBlank: true, formulae: [-90, 90], showErrorMessage: true, errorTitle: 'Lat', error: 'Latitude is between -90 and 90.' };
    st.getCell(r, col('Lon')).dataValidation = { type: 'decimal', operator: 'between', allowBlank: true, formulae: [-180, 180], showErrorMessage: true, errorTitle: 'Lon', error: 'Longitude is between -180 and 180.' };
  }
  if (sample) csvTemplateRows(tr).forEach((row, k) => row.forEach((v, i) => {       // filled-in example rows
    if (v === '' || v == null) return;
    const name = CSV_COLS[i], cell = st.getCell(4 + k, col(name));
    if (name === 'Notes') {                                                          // [Tags] in a note go to the Tag columns
      const found = [...String(v).matchAll(/\[([^\]]+)\]/g)].map(m => m[1]), text = String(v).replace(/\s*\[[^\]]+\]/g, '').trim();
      if (text) cell.value = text;
      found.slice(0, XLSX_TAG_COLS.length).forEach((tg, ti) => { st.getCell(4 + k, col(XLSX_TAG_COLS[ti])).value = tg; });
      return;
    }
    cell.value = name === 'Date' ? xlsxDate(v) : name === 'Day' ? +v : name === 'Category' ? (CATS[v]?.label || v) : v;
  }));
  st.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + total, column: n } };

  /* How to fill */
  help.columns = [16, 52, 34].map(width => ({ width }));
  xlsxTitleBar(help, 3, 'How to fill the Stops tab', 'Trips');
  help.getCell('A3').value = 'Works the same in Excel, Numbers and Google Sheets.'; help.getCell('A3').font = xlFont({ color: { argb: XL.mute } });
  xlsxHeadRow(help, 5, ['Column', 'What to put', 'Example']);
  const first = days[0].date;
  const doc = [
    ['Date', 'The day, as YYYY-MM-DD. Wins over Day when both are filled.', first], ['Day', 'Day number, 1 = first day of the trip.', '1'],
    ['Time', 'Pick from the dropdown (Morning 09:00, Lunch 12:00, Afternoon 15:00, Dinner 18:30, Evening 20:00 come first) or type your own. 9:00, 9am, 9:30pm become 09:00, 09:00, 21:30.', '09:00'], ['Title', 'Stop name. Falls back to Map place when empty.', 'Hotel check-in'],
    ['Category', 'Pick from the dropdown (see the Lists tab).', labels[0]], ['Map place', 'Pick a saved place from the dropdown, or type a new name. An existing place with that name is reused, otherwise a new one is made.', 'Hotel name'],
    ['Notes', 'Free text.', 'Leave bags if early'], ['Tag 1, 2, 3', 'Up to three predefined tags per stop. Pick each from its own dropdown (Excel cannot put several picks in one cell). On import they are added to the note as [Tag]; a tag you type yourself works too.', 'Check hours / Cash only'], ['Lat, Lon', 'Optional pin for a new Map place, e.g. 35.689487 and 139.691711.', '35.689487 / 139.691711'],
    ['Day title, Area', 'Optional. Filled in only when the day has none yet.', 'Arrival day / Station area'], ['Hours, Link', 'Optional. Opening hours, and a link starting with http(s).', '11:00-14:00']
  ];
  doc.forEach((row, i) => row.forEach((v, c) => { const cell = help.getCell(6 + i, c + 1); cell.value = v; cell.font = xlFont({ bold: c === 0 }); cell.border = xlBorder(); cell.alignment = { vertical: 'top', wrapText: true }; if (i % 2) cell.fill = xlFill(XL.band); }));
  const steps = ['Fill in the Stops tab (keep the header row as it is).',
    'Excel / Numbers: save as .xlsx.   Google Sheets: File → Download → Microsoft Excel (.xlsx).',
    'In Trips: Days → Import → Choose file, and pick the .xlsx. You see a preview before anything is saved.',
    'Google Sheets users: to start, open sheets.google.com → File → Import → Upload this file → Replace spreadsheet. Dropdowns and colours come with it.'];
  help.getCell(7 + doc.length, 1).value = 'Steps'; help.getCell(7 + doc.length, 1).font = xlFont({ size: 11, bold: true });
  steps.forEach((x, i) => { const cell = help.getCell(8 + doc.length + i, 1); cell.value = `${i + 1}. ${x}`; cell.font = xlFont(); });
  return wb;
}

// Cell value -> plain text, whatever ExcelJS hands back (rich text, hyperlinks, formula results, dates, numbers).
function xlsxCellText(v, kind) {
  if (v == null) return '';
  if (v instanceof Date) { const p = n => String(n).padStart(2, '0'); return kind === 'Time' ? `${p(v.getUTCHours())}:${p(v.getUTCMinutes())}` : `${v.getUTCFullYear()}-${p(v.getUTCMonth() + 1)}-${p(v.getUTCDate())}`; }
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
const XLSX_HEAD_ALIAS = { 'tag 1': 'Tag1', 'tag 2': 'Tag2', 'tag 3': 'Tag3', ...CSV_ALIASES, coordinates: 'Coords', type: 'Type', 'location link': 'LocLink' };
const xlsxHeadOf = v => XLSX_HEAD_ALIAS[String(xlsxCellText(v)).trim().toLowerCase()] || '';

/* .xlsx -> the same grid csvParse() makes (CSV_COLS header + rows), so csvPreview / csvApply work unchanged.
   Finds the header row (the template has a title bar above it), and also reads this app's own Export Excel layout. */
async function xlsxReadGrid(ExcelJS, buf) {
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buf);
  let pick = null;
  for (const ws of wb.worksheets) {
    for (let r = 1; r <= Math.min(15, ws.rowCount); r++) {
      const heads = []; ws.getRow(r).eachCell({ includeEmpty: false }, (c, ci) => { const h = xlsxHeadOf(c.value); if (h) heads[ci] = h; });
      const known = heads.filter(Boolean).length;
      if (known >= 3 && (!pick || ws.name === 'Stops' || ws.name === 'Itinerary' && pick.ws.name !== 'Stops')) { pick = { ws, r, heads }; if (ws.name === 'Stops') break; }
      if (known >= 3) break;
    }
    if (pick?.ws.name === 'Stops') break;
  }
  if (!pick) throw Error('Header row not recognised. Use the template columns.');
  const { ws, r: hr, heads } = pick, exportLayout = heads.includes('LocLink');
  const at = n => heads.indexOf(n), grid = [CSV_COLS.slice()];
  for (let r = hr + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r), get = n => at(n) > 0 ? xlsxCellText(row.getCell(at(n)).value, n).trim() : '';
    if (!heads.some((h, ci) => h && xlsxCellText(row.getCell(ci).value).trim())) continue;
    const o = Object.fromEntries(CSV_COLS.map(c => [c, get(c)]));
    if (at('Coords') > 0 && !o.Lat && !o.Lon) { const m = /(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)/.exec(get('Coords')); if (m) { o.Lat = m[1]; o.Lon = m[2]; } }
    const tagged = ['Tag1', 'Tag2', 'Tag3'].map(get).filter(Boolean).map(x => /^\[.*\]$/.test(x) ? x : `[${x}]`).filter(x => !o.Notes.includes(x));
    if (tagged.length) o.Notes = [o.Notes, ...new Set(tagged)].filter(Boolean).join(' ');   // Tag 1-3 dropdowns become [Tag] in the note
    if (!o.Category && at('Type') > 0) o.Category = { hotel: 'base', meal: 'food' }[get('Type').toLowerCase()] || '';
    if (exportLayout && !o.Lat && !o.Lon && o['Map place']) { o.Title = o.Title || o['Map place']; o['Map place'] = ''; }   // a stop without a pin was only a title
    grid.push(CSV_COLS.map(c => o[c]));
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
    const buf = await xlsxTemplateBuild(window.ExcelJS, tr, new Date(), sample).xlsx.writeBuffer();
    await saveFile(`${slug(tr.name)}-itinerary-${sample ? 'sample' : 'template'}.xlsx`, new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  } catch (e) { toast(e.message || 'Export failed.'); }
}
async function xlsxReadFile(f) {
  if (f.size > 8e6) throw Error('File is too large.');
  await xlsxLoad();
  return xlsxReadGrid(window.ExcelJS, await f.arrayBuffer());
}
