'use strict';
/* Days tab: CSV / Excel import (with preview), CSV export and the Excel sample / template.
   ONE column layout is used for the Excel export, the blank template, the sample and the CSV, so a file that was exported can be
   edited and imported again, and a template looks exactly like an export:
     Day, Date, Time, Type, Stop, Location, Location link, Coordinates, Notes, Day title, Area, Hours, Website
   (Excel files add Tag 1-3 after Notes; in CSV the tags stay inside Notes as [Book ahead].)
   - Day        day number, 1 = first day of the trip. Left empty = same day as the row above.
   - Date       YYYY-MM-DD (also YYYY/M/D). Fills itself from Day in the Excel files. Wins over Day when both are given.
   - Time       free text; 9:00, 9am and 9:30pm are normalised to 09:00 / 09:00 / 21:30.
   - Type       Flight, Train, Transfer, Hotel & stay, Food & drink, Sights & culture, Activity & tour, Shopping, Fashion & cosmetics,
                Hobby & collectibles, Special interest, Free time, Other (label, key or a common word). Empty = guessed from the Stop name.
   - Stop       what you do (the stop's name). Falls back to Location when empty.
   - Location   where: the pin on the map. Reused if a place with that name exists, otherwise created.
   - Location link / Coordinates   optional Google Maps link and "lat, lon" for a new Location.
   - Notes      free text. Predefined tags are written as [Book ahead].
   - Day title, Area   optional; fill in a day's title / area when the day has none yet.
   - Hours, Website    optional; fill in a place's opening hours / link when the place has none yet.
   A day with no stops is exported as a row with only Day, Date (and Day title / Area), so the day survives a round trip.
   Import flow: choose file -> preview every row (new / already there / error) -> confirm. Nothing is saved before confirming.
   Older files (Category, Title, Map place, Lat, Lon, Link) are still understood. */

const CSV_COLS = ['Day', 'Date', 'Time', 'Type', 'Stop', 'Location', 'Location link', 'Coordinates', 'Notes', 'Day title', 'Area', 'Hours', 'Website'];
// What import works with internally (CSV_COLS and the older names are both turned into this by csvNormalize).
const CSV_IN = ['Date', 'Time', 'Category', 'Day', 'Title', 'Map place', 'Notes', 'Lat', 'Lon', 'Day title', 'Area', 'Hours', 'Link', 'Gmaps'];
const CSV_TIME_TAGS = [['Morning', '09:00'], ['Lunch', '12:00'], ['Afternoon', '15:00'], ['Dinner', '18:30'], ['Evening', '20:00']];
const CSV_NOTE_TAGS = ['Book ahead', 'Cash only', 'Check hours', 'Closed Mon', 'Queue early', 'Photo spot', 'Rain plan', 'Tax-free'];
const CSV_ALIASES = {
  date: 'Date', time: 'Time', type: 'Category', category: 'Category', cat: 'Category', day: 'Day', 'day no': 'Day', 'day #': 'Day', 'day number': 'Day',
  stop: 'Title', title: 'Title', name: 'Title', activity: 'Title', location: 'Map place', 'map place': 'Map place', mapplace: 'Map place', place: 'Map place',
  'location link': 'Gmaps', 'maps link': 'Gmaps', 'google maps': 'Gmaps', gmaps: 'Gmaps', coordinates: 'Coords', coords: 'Coords', 'lat, lon': 'Coords',
  notes: 'Notes', note: 'Notes', memo: 'Notes', lat: 'Lat', latitude: 'Lat', lon: 'Lon', lng: 'Lon', long: 'Lon', longitude: 'Lon',
  'day title': 'Day title', daytitle: 'Day title', 'day name': 'Day title', area: 'Area', district: 'Area', 'day area': 'Area',
  hours: 'Hours', 'opening hours': 'Hours', website: 'Link', link: 'Link', url: 'Link', 'tag 1': 'Tag1', 'tag 2': 'Tag2', 'tag 3': 'Tag3'
};
const csvHeadOf = v => CSV_ALIASES[String(v ?? '').trim().toLowerCase()] || '';
const CSV_MAX_BYTES = 2e6, CSV_PREVIEW_ROWS = 150;

/* ---------- CSV text <-> rows ---------- */
function csvParse(text) {
  text = String(text).replace(/^\ufeff/, '');
  const first = text.split(/\r?\n/, 1)[0], count = ch => first.split(ch).length - 1;
  const sep = count('\t') > count(',') && count('\t') > count(';') ? '\t' : count(';') > count(',') ? ';' : ',';
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"' && !cell) q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
// Spreadsheet apps run cells that start with = + - @ as formulas, so text cells get a leading ' on export and lose it on import.
const csvGuard = v => { const x = String(v ?? ''); return /^[=+\-@]/.test(x) ? "'" + x : x; };
const csvUnguard = x => /^'[=+\-@]/.test(x) ? x.slice(1) : x;
const csvField = v => { const x = String(v ?? ''); return /[",\r\n]/.test(x) || x !== x.trim() ? `"${x.replace(/"/g, '""')}"` : x; };
const csvText = rows => '\ufeff' + [CSV_COLS, ...rows].map(r => r.map(csvField).join(',')).join('\r\n') + '\r\n';

/* ---------- trip -> records -> rows (shared with the Excel export in xlsx.js) ---------- */
const csvHhmm = v => { const x = String(v || '').trim(), m = x.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i); if (!m) return x;
  let h = +m[1]; const mm = m[2] || '00', ap = m[3]?.toLowerCase(); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; return h < 24 && +mm < 60 ? `${String(h).padStart(2, '0')}:${mm}` : x; };
// A place's coordinates: its pin, else decoded from its pasted Google Maps link, else null.
function csvCoords(spot) {
  if (!spot) return null;
  if (hasCoords(spot)) return { lat: spot.lat, lon: spot.lon };
  if (spot.gmaps) { const p = parseGmapsLink(spot.gmaps); if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) return { lat: p.lat, lon: p.lon }; }
  return null;
}
// One record per stop, in trip order. A day with no stops gets one record of its own so the day is not lost.
// Day title / Area are written on the first stop of each day only.
function csvRecords(tr) {
  const recs = [];
  tr.days.forEach((d, i) => {
    if (!d.items.length) { recs.push({ day: i + 1, date: d.date, dayTitle: d.title || '', area: d.place || '', empty: true }); return; }
    d.items.forEach((it, k) => {
      const s = it.spotId && tr.spots.find(x => x.id === it.spotId) || null, c = csvCoords(s);
      recs.push({ day: i + 1, date: d.date, time: csvHhmm(it.time), cat: stopCat(tr, it), title: it.title || '', place: s ? s.name : '',
        gUrl: s ? (s.gmaps || (c ? `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lon}` : gmapsPlaceUrl(s))) : '', coords: c,
        note: (it.note || '').trim(), dayTitle: k ? '' : d.title || '', area: k ? '' : d.place || '', hours: s ? s.hours || '' : '', link: s ? s.link || '' : '', first: k === 0 });
    });
  });
  return recs;
}
const csvCoordText = c => c ? `${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}` : '';
function csvRowsFromTrip(tr) {
  const rows = [], g = csvGuard;
  // One block per day with an empty line between days. Import ignores empty lines and repeats, so the file round-trips.
  csvRecords(tr).forEach((r, i, all) => {
    if (r.first || r.empty) { if (i) rows.push(CSV_COLS.map(() => '')); }
    rows.push([r.day, r.date, g(r.time || ''), r.cat ? CATS[r.cat].label : '', g(r.title || ''), g(r.place || ''), r.gUrl || '', g(csvCoordText(r.coords)), g(r.note || ''), g(r.dayTitle), g(r.area), g(r.hours || ''), g(r.link || '')]);
  });
  return rows;
}
/* The sample: a small made-up trip that uses every Type once or twice, so the sample file looks like a real export.
   Returns records like csvRecords(). Dates come from the sheet's Day column, so only Day is needed here. */
const CSV_SAMPLE = [
  [1, '09:10', 'flight', 'Land at Narita (flight JL740)', 'Narita Airport Terminal 2', '35.764700, 140.386400', 'Passport + visit-Japan QR ready', [], 'Arrival day', 'Narita → Asakusa', '', ''],
  [1, '11:00', 'train', 'Narita Express to Tokyo', 'Tokyo Station', '35.681200, 139.767100', 'Reserved seat, about 55 min', [], '', '', '', ''],
  [1, '14:00', 'base', 'Hotel check-in', 'Asakusa Hotel', '', 'Leave bags if the room is not ready', ['Check hours'], '', '', 'Check-in from 15:00', ''],
  [1, '16:00', 'sights', 'Senso-ji Temple walk', 'Senso-ji', '35.714800, 139.796700', 'Nakamise street snacks on the way', ['Photo spot'], '', '', '', 'https://www.senso-ji.jp/'],
  [1, '19:00', 'food', 'Tempura dinner', 'Daikokuya Tempura', '35.712700, 139.795400', '', ['Cash only', 'Queue early'], '', '', '11:00-20:30', ''],
  [2, '10:00', 'transfer', 'Metro to Shibuya', 'Shibuya Station', '35.658000, 139.701600', 'Ginza Line, about 30 min', [], 'Shopping day', 'Shibuya', '', ''],
  [2, '11:00', 'fashion', 'Fashion browsing', 'Shibuya 109', '35.659500, 139.698600', 'Ask about tax-free at the counter', ['Tax-free'], '', '', '10:00-21:00', ''],
  [2, '13:00', 'food', 'Ramen lunch', '', '', 'Order at the ticket machine', ['Queue early'], '', '', '', ''],
  [2, '15:00', 'pokemon', 'Card shop stop', '', '', 'Singles and sealed boxes', [], '', '', '', ''],
  [2, '17:30', 'activity', 'teamLab Planets', 'teamLab Planets', '35.649100, 139.789800', 'Barefoot, bring shorts', ['Book ahead'], '', '', '', ''],
  [2, '21:00', 'free', 'Free time at the hotel', '', '', '', [], '', '', '', ''],
  [3, '08:00', 'base', 'Hotel check-out', 'Asakusa Hotel', '', 'Leave the key at the desk', [], 'Departure day', 'Tokyo → Narita', '', ''],
  [3, '09:30', 'transfer', 'Airport limousine bus', '', '', '', ['Rain plan'], '', '', '', ''],
  [3, '12:30', 'flight', 'Flight home', 'Narita Airport Terminal 2', '35.764700, 140.386400', 'Be at the airport 2 h early', [], '', '', '', ''],
  [3, '', 'other', 'Return pocket Wi-Fi', '', '', 'Drop it in the box at the airport', [], '', '', '', '']
];
function csvSampleRecords() {
  return CSV_SAMPLE.map(([day, time, cat, title, place, coords, note, tags, dayTitle, area, hours, link]) => {
    const m = /^(-?[\d.]+),\s*(-?[\d.]+)$/.exec(coords);
    return { day, time, cat, title, place, coords: m ? { lat: +m[1], lon: +m[2] } : null, gUrl: '', note, tags, dayTitle, area, hours, link };
  });
}
const csvFilename = (tr, kind) => `${slug(tr.name)}-itinerary${kind ? '-' + kind : ''}.csv`;

/* ---------- any file layout -> the internal grid (CSV_IN) ----------
   Accepts this app's CSV / Excel layout, older CSVs (Category, Title, Map place, Lat, Lon, Link) and the first Excel export layout
   (Type, Location, Location link, Coordinates, Notes). Coordinates "35.68, 139.69" are split into Lat / Lon, a Google Maps link in
   Location link gives coordinates when it carries them, and Tag 1-3 become [Tag] in the note. */
function csvNormalize(grid) {
  const head = grid[0].map(csvHeadOf), at = n => head.indexOf(n);
  // First Excel export: no Stop column, so Location was the stop's name and only places with a pin were real places.
  const oldExport = at('Title') < 0 && at('Map place') >= 0 && (at('Gmaps') >= 0 || at('Coords') >= 0);
  const out = [CSV_IN.slice()];
  grid.slice(1).forEach(r => {
    const get = n => at(n) < 0 ? '' : String(r[at(n)] ?? '').trim(), o = Object.fromEntries(CSV_IN.map(c => [c, get(c)]));
    if (!o.Lat && !o.Lon && at('Coords') >= 0) { const m = /(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/.exec(csvUnguard(get('Coords'))); if (m) { o.Lat = m[1]; o.Lon = m[2]; } }
    if (o.Gmaps) { o.Gmaps = csvUnguard(o.Gmaps); if (!/^https?:\/\//i.test(o.Gmaps)) o.Gmaps = '';
      else if (!o.Lat && !o.Lon) { const p = parseGmapsLink(o.Gmaps); if (Number.isFinite(p.lat) && Number.isFinite(p.lon)) { o.Lat = String(p.lat); o.Lon = String(p.lon); } } }
    const tags = ['Tag1', 'Tag2', 'Tag3'].map(get).filter(Boolean).map(x => /^\[.*\]$/.test(x) ? x : `[${x}]`).filter(x => !o.Notes.includes(x));
    if (tags.length) o.Notes = [o.Notes, ...new Set(tags)].filter(Boolean).join(' ');
    if (oldExport && !o.Lat && !o.Lon && o['Map place']) { o.Title = o['Map place']; o['Map place'] = ''; }
    out.push(CSV_IN.map(c => o[c]));
  });
  return out;
}

/* ---------- rows -> trip ---------- */
// The Type cell -> a type key. Empty or unknown: guessed from the stop's words (an unknown word is also reported).
const csvCategory = (raw, title, spot, note) => {
  const text = String(raw || '').trim(), hit = catFromText(text);
  if (hit) return { cat: hit };
  return { cat: guessStopCat(title, spot, note), bad: text };
};
const csvDate = raw => {
  const m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(String(raw || '').trim()); if (!m) return '';
  const iso = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`, d = new Date(iso + 'T00:00:00');
  return isNaN(d) || addDays(iso, 0) !== iso ? '' : iso;
};
// 9:00 -> 09:00, 9am -> 09:00, 9:30pm -> 21:30. Anything else ("Late lunch") is kept as typed.
const csvTime = raw => {
  const s = String(raw || '').trim(), m = /^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i.exec(s); if (!m) return s.slice(0, 40);
  let h = +m[1]; const min = m[2] ?? '00', ap = (m[3] || '').toLowerCase();
  if (!ap && m[2] === undefined) return s.slice(0, 40); // a bare number is not a time
  if (ap) { if (h < 1 || h > 12) return s.slice(0, 40); h = h % 12 + (ap[0] === 'p' ? 12 : 0); }
  return h > 23 || +min > 59 ? s.slice(0, 40) : `${String(h).padStart(2, '0')}:${min}`;
};
/* Adds to the trip (never removes). Returns { added, skipped, newDays, dayInfo, problems: [], rows: [] }.
   rows has one entry per CSV line that did something or failed: { line, status: new|skip|day|error, date, time, text, detail }.
   A stop is "already there" when the day, time, title and place match one that was in the trip before the import,
   so re-importing an export changes nothing, while two identical lines inside one file both come in. */
function csvImportRows(tr, grid) {
  if (!grid[0].some(h => ['Date', 'Day', 'Title', 'Map place'].includes(csvHeadOf(h)))) throw Error('Header row not recognised. Use the template columns.');
  grid = csvNormalize(grid);
  const head = grid[0], col = n => head.indexOf(n);
  const out = { added: 0, skipped: 0, newDays: 0, dayInfo: 0, problems: [], rows: [] }, base = tr.days.slice(), pool = new Map();
  const poolOf = d => { if (!pool.has(d.id)) pool.set(d.id, d.items.slice()); return pool.get(d.id); };
  const newDay = date => { const d = { id: uid('d'), date, title: '', place: '', items: [] }; tr.days.push(d); out.newDays++; return d; };
  const byNumber = n => { while (base.length < n) { const last = base[base.length - 1]; base.push(newDay(last ? addDays(last.date, 1) : todayIso())); } return base[n - 1]; };
  let prev = null;
  grid.slice(1).forEach((r, k) => {
    const v = n => (col(n) < 0 ? '' : csvUnguard(String(r[col(n)] ?? '').trim())), line = k + 2;
    const log = (status, d, text, detail = '') => out.rows.push({ line, status, date: d ? d.date : '', time: v('Time'), text, detail });
    const fail = msg => { out.problems.push(`Row ${line}: ${msg}`); log('error', null, v('Title') || v('Map place') || v('Date') || v('Day'), msg); };
    const daysBefore = out.newDays, infoBefore = out.dayInfo;
    let d = null;
    if (v('Date')) { const iso = csvDate(v('Date')); if (!iso) return fail(`date “${v('Date')}” is not YYYY-MM-DD`); d = tr.days.find(x => x.date === iso) || newDay(iso); }
    else if (v('Day')) { const n = parseInt(v('Day'), 10); if (!(n >= 1 && n <= 90)) return fail(`Day “${v('Day')}” is not a number from 1 to 90`); d = byNumber(n); }
    else d = prev || byNumber(1);
    prev = d;
    if (v('Day title') && !d.title) { d.title = v('Day title').slice(0, 80); out.dayInfo++; }
    if (v('Area') && !d.place) { d.place = v('Area').slice(0, 80); out.dayInfo++; }
    const title = (v('Title') || v('Map place')).slice(0, 160);
    if (!title) { // a day-only row
      if (out.newDays > daysBefore || out.dayInfo > infoBefore) log('day', d, `Day ${tr.days.indexOf(d) + 1}`, [d.title, d.place].filter(Boolean).join(' · '));
      return;
    }
    const note = csvUnguard(String(r[col('Notes')] ?? '').trim()).slice(0, 1500);
    const known = v('Map place') ? tr.spots.find(s => s.name.trim().toLowerCase() === v('Map place').toLowerCase()) : null;
    const { cat, bad } = csvCategory(v('Category'), title, known || (v('Map place') ? { name: v('Map place') } : null), note);
    if (bad) out.problems.push(`Row ${line}: type “${bad}” is not a known type, used ${CATS[cat].label}`);
    const warn = [bad ? `type “${bad}” → ${CATS[cat].label}` : ''];
    let spot = null;
    if (v('Map place')) {
      const key = v('Map place').toLowerCase(), hasPin = v('Lat') !== '' || v('Lon') !== '', lat = parseFloat(v('Lat')), lon = parseFloat(v('Lon'));
      const pinOk = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
      if (hasPin && !pinOk) { out.problems.push(`Row ${line}: Lat/Lon “${v('Lat')}, ${v('Lon')}” is not a valid coordinate, no pin added`); warn.push('invalid Lat/Lon'); }
      spot = known;
      if (!spot) { spot = { id: uid('p'), name: v('Map place').slice(0, 160), jp: '', city: '', cat, note: '', hours: '', link: '', gmaps: '', days: [] }; tr.spots.push(spot); }
      if (!hasCoords(spot) && pinOk) { spot.lat = lat; spot.lon = lon; }
      if (v('Gmaps') && !spot.gmaps && !/\/maps\/search\/\?api=1&query=/.test(v('Gmaps'))) spot.gmaps = v('Gmaps').slice(0, 800);
      if (v('Hours') && !spot.hours) spot.hours = v('Hours').slice(0, 120);
      if (v('Link') && !spot.link) spot.link = /^https?:\/\//i.test(v('Link')) ? v('Link').slice(0, 500) : '';
      if (!spot.days.includes(d.id)) spot.days.push(d.id);
    }
    const time = csvTime(v('Time')), spotId = spot ? spot.id : '';
    const live = poolOf(d), hit = live.findIndex(it => it.time === time && it.title === title && (it.spotId || '') === spotId);
    const detail = [CATS[cat].label, spot && spot.name !== title ? spot.name : '', ...warn].filter(Boolean).join(' · ');
    if (hit >= 0) { live.splice(hit, 1); out.skipped++; return log('skip', d, title, detail); }
    d.items.push({ id: uid('i'), time, title, note, spotId, cat }); out.added++; log('new', d, title, detail);
  });
  tr.days.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/* ---------- UI ---------- */
function csvPickFile() {
  return new Promise(res => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.xlsx,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv,text/tab-separated-values,text/plain';
    inp.onchange = () => res(inp.files[0] || null); inp.oncancel = () => res(null); inp.click();
  });
}
// UTF-8 first (what Export writes). Excel in some locales saves Big5 instead, so fall back to it rather than show garbage.
async function csvReadFile(f) {
  if (f.size > CSV_MAX_BYTES) throw Error('File is too large.');
  const buf = await f.arrayBuffer();
  try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), fallback: false }; }
  catch { try { return { text: new TextDecoder('big5').decode(buf), fallback: true }; } catch { return { text: new TextDecoder('utf-8').decode(buf), fallback: true }; } }
}
// Dry run on a copy of the trip: nothing is saved until the person confirms.
function csvPreview(tr, grid) {
  const trial = { days: structuredClone(tr.days), spots: structuredClone(tr.spots) };
  return csvImportRows(trial, grid);
}
function csvApply(tr, grid) {
  const snap = snapshot(tr);
  let r; try { r = csvImportRows(tr, grid); } catch (e) { Object.assign(tr, structuredClone(snap)); throw e; }
  if (!r.added && !r.newDays && !r.dayInfo) { Object.assign(tr, structuredClone(snap)); throw Error(r.skipped ? 'Nothing new: those stops are already in the trip.' : (r.problems[0] || 'No stops found in the file.')); }
  saveDb();
  const open = openSet(); tr.days.forEach(d => { if (d.items.length && r.added) open.add(d.id); });
  closeSheet(); renderDaysTab();
  undoToast(`${t('Imported')} ${r.added} ${t('stops')}${r.newDays ? ` · ${r.newDays} ${t('new days')}` : ''}${r.skipped ? ` · ${r.skipped} ${t('skipped')}` : ''}${r.problems.length ? ` · ${r.problems.length} ${t('warnings')}` : ''}`, snap);
}

function csvExport(tr) {
  if (!tr.days.length) return toast('Nothing to export yet.');
  const rows = csvRowsFromTrip(tr), n = tr.days.reduce((a, d) => a + d.items.length, 0);
  download(csvFilename(tr), csvText(rows), 'text/csv;charset=utf-8');
  toast(`${t('Exported')} ${n} ${t('stops')} · ${tr.days.length} ${t('days')}`);
}

const CSV_STATUS = { new: 'New', skip: 'Already there', day: 'New day', error: 'Error' };
function csvPreviewHtml(res, fallback) {
  const n = k => res.rows.filter(x => x.status === k).length, errs = n('error'), shown = res.rows.slice(0, CSV_PREVIEW_ROWS);
  const sum = [`<b>${res.added}</b> ${t('new stops')}`, res.newDays ? `<b>${res.newDays}</b> ${t('new days')}` : '', res.skipped ? `<b>${res.skipped}</b> ${t('already there')}` : '', errs ? `<b>${errs}</b> ${t('rows with errors')}` : ''].filter(Boolean).join(' · ');
  const items = shown.map(x => `<li class="csv-row is-${x.status}"><span class="q-t">${esc(x.date)}${x.time ? '<br>' + esc(x.time) : ''}</span><span class="q-m"><b class="user-text">${esc(x.text)}</b>${x.detail ? `<small>${esc(x.detail)}</small>` : ''}</span><span class="csv-st">${t(CSV_STATUS[x.status])}</span></li>`).join('');
  return `<h3 class="csv-h">${t('Preview')}</h3>
    ${fallback ? `<p class="field-hint csv-warn">${t('The file is not UTF-8; it was read as Big5. Check that the text looks right.')}</p>` : ''}
    <p class="csv-sum">${sum || t('No stops found in the file.')}</p>
    ${res.problems.length && !errs ? `<p class="field-hint csv-warn">${res.problems.length} ${t('warnings')}: ${esc(res.problems.slice(0, 3).join(' · '))}${res.problems.length > 3 ? ' …' : ''}</p>` : ''}
    <ol class="csv-queue csv-rows">${items}</ol>
    ${res.rows.length > shown.length ? `<p class="field-hint">… +${res.rows.length - shown.length} ${t('more rows')}</p>` : ''}
    <div class="csv-top"><button type="button" class="primary" data-csv="confirm" ${res.added || res.newDays || res.dayInfo ? '' : 'disabled'}>${t('Import')} ${res.added} ${t('stops')}</button>
      <button type="button" data-csv="import">${t('Choose another file')}</button></div>`;
}

// Import sheet: download the Excel template (or the filled-in sample), fill it in, pick the file, review the preview, confirm.
function csvImportSheet(tr) {
  let pending = null;
  openSheet({
    title: t('Import from file'), submit: null,
    body: `<ol class="csv-steps">
        <li><b>${t('Download the blank template')}</b><small>${t('An Excel file laid out exactly like Export Excel, with colours, dropdowns and ready-made rows for each trip day. Opens in Excel, Numbers and Google Sheets (File → Import → Upload) with the formatting kept.')}</small>
          <small>${t('Almost nothing to type: Date fills itself from Day, and Time, Type, Location and up to three Tags are dropdowns. Leave Type empty and it is guessed from the Stop name.')}</small>
          <button type="button" class="primary" data-csv="xlsx-blank">${t('Download Excel / Sheets template')}</button></li>
        <li><b>${t('Import the filled-in file')}</b><small>${t('Choose the .xlsx (in Google Sheets: File → Download → Microsoft Excel) or a .csv. You see a preview before anything is saved.')}</small>
          <button type="button" data-csv="import">${t('Choose file')}</button></li></ol>
      <p class="field-hint"><button type="button" class="text-btn" data-csv="xlsx-sample">${t('Download sample Excel / Sheets template')}</button> ${t('shows a filled-in example trip with every type.')}</p>
      <p class="field-hint">${t('Columns')}: ${CSV_COLS.join(' · ')}. ${t('Export Excel, Export CSV, the template and the sample all use these columns, so an exported file can be edited and imported again. Importing only adds; stops already in the trip are skipped. You see a preview before anything is saved.')}</p>
      <div id="csv-preview"></div>`,
    onOpen: root => {
      const g = id => root.querySelector('#' + id);
      const show = (grid, fallback) => {
        try { const res = csvPreview(tr, grid); pending = grid; g('csv-preview').innerHTML = csvPreviewHtml(res, fallback); g('csv-preview').scrollIntoView({ block: 'nearest' }); }
        catch (e) { pending = null; g('csv-preview').innerHTML = `<p class="csv-warn">${esc(t(e.message))}</p>`; }
      };
      root.onclick = async e => {
        const b = e.target.closest('button'); if (!b) return;
        switch (b.dataset.csv) {
          case 'import': {
            const f = await csvPickFile(); if (!f) break;
            try {
              if (/\.xlsx$/i.test(f.name)) { g('csv-preview').innerHTML = `<p class="field-hint">${t('Reading Excel…')}</p>`; show(await xlsxReadFile(f), false); break; }
              const { text, fallback } = await csvReadFile(f), grid = csvParse(text); if (grid.length < 2) throw Error('The file has no rows.'); show(grid, fallback);
            }
            catch (err) { pending = null; g('csv-preview').innerHTML = `<p class="csv-warn">${esc(t(err.message))}</p>`; }
            break;
          }
          case 'confirm': try { csvApply(tr, pending); } catch (err) { toast(err.message); } break;
          case 'xlsx-blank': xlsxTemplateDownload(tr); break;
          case 'xlsx-sample': xlsxTemplateDownload(tr, true); break;
        }
      };
    }
  });
}
