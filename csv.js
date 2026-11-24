'use strict';
/* Days tab: CSV import (with preview), CSV export and a sample / quick-entry template.
   One column layout is used everywhere (sample, export, import), so an exported file can be edited and imported again:
     Date, Time, Category, Day, Title, Map place, Notes, Lat, Lon, Day title, Area, Hours, Link
   - Date       YYYY-MM-DD (also YYYY/M/D). Wins over Day when both are given.
   - Day        day number, 1 = first day of the trip.
   - Time       free text; 9:00, 9am and 9:30pm are normalised to 09:00 / 09:00 / 21:30.
   - Category   one tag: base, sights, food, fashion, shopping, pokemon, slowpoke (the label also works).
   - Map place  name of the pin on the map. Reused if a place with that name exists, otherwise created.
   - Notes      free text. Predefined tags are written as [Book ahead].
   - Lat, Lon   optional; give a new place a pin.
   - Day title, Area   optional; fill in a day's title / area when the day has none yet.
   - Hours, Link       optional; fill in a place's opening hours / link when the place has none yet.
   A day with no stops is exported as a row with only Date, Day (and Day title / Area), so the day survives a round trip.
   Import flow: choose file -> preview every row (new / already there / error) -> confirm. Nothing is saved before confirming. */

const CSV_COLS = ['Date', 'Time', 'Category', 'Day', 'Title', 'Map place', 'Notes', 'Lat', 'Lon', 'Day title', 'Area', 'Hours', 'Link'];
const CSV_TEXT_COLS = ['Time', 'Title', 'Map place', 'Notes', 'Day title', 'Area', 'Hours', 'Link'];
const CSV_TIME_TAGS = [['Morning', '09:00'], ['Lunch', '12:00'], ['Afternoon', '15:00'], ['Dinner', '18:30'], ['Evening', '20:00']];
const CSV_NOTE_TAGS = ['Book ahead', 'Cash only', 'Check hours', 'Closed Mon', 'Queue early', 'Photo spot', 'Rain plan', 'Tax-free'];
const CSV_ALIASES = {
  date: 'Date', time: 'Time', category: 'Category', cat: 'Category', day: 'Day', 'day no': 'Day', 'day #': 'Day', 'day number': 'Day',
  title: 'Title', stop: 'Title', name: 'Title', 'map place': 'Map place', mapplace: 'Map place', place: 'Map place', location: 'Map place',
  notes: 'Notes', note: 'Notes', memo: 'Notes', lat: 'Lat', latitude: 'Lat', lon: 'Lon', lng: 'Lon', long: 'Lon', longitude: 'Lon',
  'day title': 'Day title', daytitle: 'Day title', 'day name': 'Day title', area: 'Area', district: 'Area', 'day area': 'Area',
  hours: 'Hours', 'opening hours': 'Hours', link: 'Link', url: 'Link', website: 'Link'
};
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

/* ---------- trip -> rows ---------- */
function csvRowsFromTrip(tr) {
  const rows = [], g = csvGuard;
  // Tidy layout: one block per day, an empty line between days, day title / area only on the day's first row,
  // times as 24h HH:MM, coordinates to 6 decimals. Import ignores empty lines and repeats, so the file round-trips.
  const hhmm = v => { const x = String(v || '').trim(), m = x.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i); if (!m) return x;
    let h = +m[1]; const mm = m[2] || '00', ap = m[3]?.toLowerCase(); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; return h < 24 && +mm < 60 ? `${String(h).padStart(2, '0')}:${mm}` : x; };
  const deg = v => Number.isFinite(+v) && v !== '' ? (+v).toFixed(6) : '';
  tr.days.forEach((d, i) => {
    const dm = [g(d.title), g(d.place)], none = ['', ''];
    if (i) rows.push(CSV_COLS.map(() => ''));
    if (!d.items.length) rows.push([d.date, '', '', i + 1, '', '', '', '', '', ...dm, '', '']);
    d.items.forEach((it, k) => {
      const s = it.spotId && tr.spots.find(x => x.id === it.spotId), pin = s && hasCoords(s);
      rows.push([d.date, g(hhmm(it.time)), s ? s.cat : '', i + 1, g(it.title), s ? g(s.name) : '', g(it.note), pin ? deg(s.lat) : '', pin ? deg(s.lon) : '', ...(k ? none : dm), s ? g(s.hours) : '', s ? g(s.link) : '']);
    });
  });
  return rows;
}
const csvTemplateRows = tr => {
  const d1 = tr.days[0]?.date || todayIso(), d2 = tr.days[1]?.date || addDays(d1, 1), e = ['', ''];
  return [[d1, '09:00', 'base', 1, 'Hotel check-in', 'Hotel name', 'Leave bags if early [Check hours]', '', '', 'Arrival day', 'Station area', '', ''],
    [d1, '12:00', 'food', 1, 'Lunch', 'Restaurant name', '[Book ahead] [Cash only]', '', '', ...e, '11:00-14:00', ''],
    [d2, '15:00', 'sights', 2, 'Walk around the old town', '', '[Photo spot]', '', '', 'Old town', '', '', ''],
    [addDays(d2, 1), '', '', 3, '', '', '', '', '', 'Free day', '', '', '']];
};
// Blank template: the header row and one empty row per trip day with only Date and Day filled in, ready to type into.
const csvBlankRows = tr => (tr.days.length ? tr.days : [{ date: todayIso() }]).map((d, i) => [d.date, '', '', i + 1, '', '', '', '', '', '', '', '', '']);
const csvFilename = (tr, kind) => `${slug(tr.name)}-itinerary${kind ? '-' + kind : ''}.csv`;

/* ---------- rows -> trip ---------- */
const csvCategory = raw => {
  const v = String(raw || '').trim().toLowerCase(); if (!v) return { cat: 'sights' };
  const hit = Object.keys(CATS).find(k => k === v || CATS[k].label.toLowerCase() === v);
  return hit ? { cat: hit } : { cat: 'sights', bad: raw.trim() };
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
  const head = grid[0].map(h => CSV_ALIASES[String(h).trim().toLowerCase()] || ''), col = n => head.indexOf(n);
  if (col('Date') < 0 && col('Day') < 0 && col('Title') < 0) throw Error('Header row not recognised. Use the template columns.');
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
    const { cat, bad } = csvCategory(v('Category')); if (bad) out.problems.push(`Row ${line}: category “${bad}” is unknown, used sights`);
    const warn = [bad ? `category “${bad}” → sights` : ''];
    let spot = null;
    if (v('Map place')) {
      const key = v('Map place').toLowerCase(), hasPin = v('Lat') !== '' || v('Lon') !== '', lat = parseFloat(v('Lat')), lon = parseFloat(v('Lon'));
      const pinOk = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
      if (hasPin && !pinOk) { out.problems.push(`Row ${line}: Lat/Lon “${v('Lat')}, ${v('Lon')}” is not a valid coordinate, no pin added`); warn.push('invalid Lat/Lon'); }
      spot = tr.spots.find(s => s.name.trim().toLowerCase() === key);
      if (!spot) { spot = { id: uid('p'), name: v('Map place').slice(0, 160), jp: '', city: '', cat, note: '', hours: '', link: '', gmaps: '', days: [] }; tr.spots.push(spot); }
      if (!hasCoords(spot) && pinOk) { spot.lat = lat; spot.lon = lon; }
      if (v('Hours') && !spot.hours) spot.hours = v('Hours').slice(0, 120);
      if (v('Link') && !spot.link) spot.link = /^https?:\/\//i.test(v('Link')) ? v('Link').slice(0, 500) : '';
      if (!spot.days.includes(d.id)) spot.days.push(d.id);
    }
    const time = csvTime(v('Time')), note = String(r[col('Notes')] ?? '').trim().slice(0, 1500), spotId = spot ? spot.id : '';
    const live = poolOf(d), hit = live.findIndex(it => it.time === time && it.title === title && (it.spotId || '') === spotId);
    const detail = [spot && spot.name !== title ? spot.name : '', ...warn].filter(Boolean).join(' · ');
    if (hit >= 0) { live.splice(hit, 1); out.skipped++; return log('skip', d, title, detail); }
    d.items.push({ id: uid('i'), time, title, note, spotId }); out.added++; log('new', d, title, detail);
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

// Import sheet: pick a file, review the preview, confirm. Also holds the sample file and a quick-entry form that builds rows.
function csvImportSheet(tr) {
  const queue = []; let cat = 'sights', pending = null;
  const chip = (attr, val, label, extra = '') => `<button type="button" class="tag" ${attr}="${esc(val)}" ${extra}>${esc(label)}</button>`;
  openSheet({
    title: t('Import from file'), submit: null,
    body: `<ol class="csv-steps">
        <li><b>${t('Download the blank template')}</b><small>${t('An Excel file with colours, dropdowns and one row per trip day. Opens in Excel, Numbers and Google Sheets (File → Import → Upload) with the formatting kept.')}</small>
          <button type="button" class="primary" data-csv="xlsx-blank">${t('Download Excel / Sheets template')}</button>
          <button type="button" class="text-btn" data-csv="blank">${t('Plain CSV template instead')}</button></li>
        <li><b>${t('Import the filled-in file')}</b><small>${t('Choose the .xlsx (in Google Sheets: File → Download → Microsoft Excel) or a .csv. You see a preview before anything is saved.')}</small>
          <button type="button" data-csv="import">${t('Choose file')}</button></li></ol>
      <p class="field-hint"><button type="button" class="text-btn" data-csv="sample">${t('Download sample CSV')}</button> ${t('shows filled-in example rows.')}</p>
      <p class="field-hint">${t('Columns')}: ${CSV_COLS.join(' · ')}. ${t('Export and import use the same columns, so an exported file can be edited and imported again. Importing only adds; stops already in the trip are skipped. You see a preview before anything is saved.')}</p>
      <div id="csv-preview"></div>
      <details class="csv-quick"><summary>${t('Quick entry')}</summary>
      <p class="field-hint">${t('Fill in a stop, tap tags, press Add row. Download the rows as a CSV, or add them to this trip now.')}</p>
      <label>${t('Day')}<select id="q-day">${tr.days.map((d, i) => `<option value="${i}">Day ${i + 1} · ${esc(fmtDate(d.date))}</option>`).join('')}<option value="new">+ ${t('New day after the last')}</option></select></label>
      <label>${t('Time')}<input id="q-time" maxlength="40" placeholder="09:00"></label>
      <div class="tags">${CSV_TIME_TAGS.map(([n, v]) => chip('data-time', v, `${n} ${v}`)).join('')}</div>
      <label>${t('Title')}<input id="q-title" maxlength="160"></label>
      <div class="tags" role="group" aria-label="${t('Category')}">${Object.keys(CATS).map(k => chip('data-cat', k, CATS[k].label, `aria-pressed="${k === cat}"`)).join('')}</div>
      <label>${t('Map place')}<input id="q-place" list="q-places" maxlength="160" placeholder="${esc(t('Type, or pick a saved place'))}"></label>
      <datalist id="q-places">${tr.spots.map(s => `<option value="${esc(s.name)}"></option>`).join('')}</datalist>
      <label>${t('Notes')}<textarea id="q-note" rows="2" maxlength="1500"></textarea></label>
      <div class="tags">${CSV_NOTE_TAGS.map(n => chip('data-note', n, n)).join('')}</div>
      <button type="button" class="primary wide" data-csv="add">${t('Add row')}</button>
      <ol class="csv-queue" id="q-list"></ol>
      <div class="csv-top" id="q-actions" hidden>
        <button type="button" data-csv="q-download">${t('Download rows')}</button>
        <button type="button" class="primary" data-csv="q-import">${t('Preview rows')}</button>
        <button type="button" class="text-btn" data-csv="q-clear">${t('Clear')}</button></div></details>`,
    onOpen: root => {
      const g = id => root.querySelector('#' + id);
      const dayOf = () => { const v = g('q-day').value; return v === 'new' ? { date: addDays(tr.days[tr.days.length - 1]?.date || todayIso(), tr.days.length ? 1 : 0), n: tr.days.length + 1 } : { date: tr.days[+v].date, n: +v + 1 }; };
      const paint = () => {
        g('q-list').innerHTML = queue.map((r, i) => `<li><span class="q-t">${esc(r[0])}${r[1] ? ' ' + esc(r[1]) : ''}</span><span class="q-m"><b class="user-text">${esc(r[4] || r[5])}</b><small>${esc([r[2], r[5] && r[4] ? r[5] : '', r[6]].filter(Boolean).join(' · '))}</small></span><button type="button" class="icon-btn" data-csv="q-del" data-i="${i}" aria-label="${t('Remove')}">✕</button></li>`).join('');
        g('q-actions').hidden = !queue.length;
      };
      const show = (grid, fallback) => {
        try { const res = csvPreview(tr, grid); pending = grid; g('csv-preview').innerHTML = csvPreviewHtml(res, fallback); g('csv-preview').scrollIntoView({ block: 'nearest' }); }
        catch (e) { pending = null; g('csv-preview').innerHTML = `<p class="csv-warn">${esc(t(e.message))}</p>`; }
      };
      root.onkeydown = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); if (e.target.id !== 'q-place') root.querySelector('[data-csv=add]').click(); } };
      root.onclick = async e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.time) g('q-time').value = b.dataset.time;
        else if (b.dataset.cat) { cat = b.dataset.cat; root.querySelectorAll('[data-cat]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }
        else if (b.dataset.note) { const n = g('q-note'), tag = `[${b.dataset.note}]`; if (!n.value.includes(tag)) n.value = (n.value.trim() ? n.value.trim() + ' ' : '') + tag; }
        else switch (b.dataset.csv) {
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
          case 'blank': download(csvFilename(tr, 'template'), csvText(csvBlankRows(tr)), 'text/csv;charset=utf-8'); break;
          case 'sample': download(csvFilename(tr, 'sample'), csvText(csvTemplateRows(tr)), 'text/csv;charset=utf-8'); break;
          case 'add': {
            const title = g('q-title').value.trim(), place = g('q-place').value.trim(); if (!title && !place) return toast('Enter a title or a map place.');
            const dd = dayOf(), known = tr.spots.find(s => s.name.toLowerCase() === place.toLowerCase());
            queue.push([dd.date, g('q-time').value.trim(), place ? (known ? known.cat : cat) : '', dd.n, title || place, place, g('q-note').value.trim(), '', '', '', '', '', '']);
            ['q-time', 'q-title', 'q-place', 'q-note'].forEach(id => g(id).value = ''); paint(); g('q-title').focus(); break;
          }
          case 'q-del': queue.splice(+b.dataset.i, 1); paint(); break;
          case 'q-clear': queue.length = 0; paint(); break;
          case 'q-download': download(csvFilename(tr, 'rows'), csvText(queue), 'text/csv;charset=utf-8'); break;
          case 'q-import': show([CSV_COLS, ...queue], false); break;
        }
      };
    }
  });
}
