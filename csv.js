'use strict';
/* Days tab: CSV import, export and a quick-entry template.
   One column layout is used everywhere (template, export, import), so an exported file can be edited and imported again:
     Date, Time, Category, Day, Title, Map place, Notes, Lat, Lon
   - Date      YYYY-MM-DD (also YYYY/M/D). Wins over Day when both are given.
   - Day       day number, 1 = first day of the trip.
   - Category  one tag: base, sights, food, fashion, shopping, pokemon, slowpoke (the label also works).
   - Map place name of the pin on the map. Reused if a place with that name exists, otherwise created.
   - Notes     free text. Predefined tags are written as [Book ahead].
   - Lat, Lon  optional; give a new place a pin.
   A day with no stops is exported as a row with only Date and Day, so the day survives a round trip. */

const CSV_COLS = ['Date', 'Time', 'Category', 'Day', 'Title', 'Map place', 'Notes', 'Lat', 'Lon'];
const CSV_TIME_TAGS = [['Morning', '09:00'], ['Lunch', '12:00'], ['Afternoon', '15:00'], ['Dinner', '18:30'], ['Evening', '20:00']];
const CSV_NOTE_TAGS = ['Book ahead', 'Cash only', 'Check hours', 'Closed Mon', 'Queue early', 'Photo spot', 'Rain plan', 'Tax-free'];
const CSV_ALIASES = {
  date: 'Date', time: 'Time', category: 'Category', cat: 'Category', day: 'Day', 'day no': 'Day', 'day #': 'Day', 'day number': 'Day',
  title: 'Title', stop: 'Title', name: 'Title', 'map place': 'Map place', mapplace: 'Map place', place: 'Map place', location: 'Map place',
  notes: 'Notes', note: 'Notes', memo: 'Notes', lat: 'Lat', latitude: 'Lat', lon: 'Lon', lng: 'Lon', long: 'Lon', longitude: 'Lon'
};

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
const csvField = v => { const x = String(v ?? ''); return /[",\r\n]/.test(x) || x !== x.trim() ? `"${x.replace(/"/g, '""')}"` : x; };
const csvText = rows => '\ufeff' + [CSV_COLS, ...rows].map(r => r.map(csvField).join(',')).join('\r\n') + '\r\n';

/* ---------- trip -> rows ---------- */
function csvRowsFromTrip(tr) {
  const rows = [];
  tr.days.forEach((d, i) => {
    if (!d.items.length) rows.push([d.date, '', '', i + 1, '', '', '', '', '']);
    d.items.forEach(it => {
      const s = it.spotId && tr.spots.find(x => x.id === it.spotId), pin = s && hasCoords(s);
      rows.push([d.date, it.time || '', s ? s.cat : '', i + 1, it.title || '', s ? s.name : '', it.note || '', pin ? s.lat : '', pin ? s.lon : '']);
    });
  });
  return rows;
}
const csvTemplateRows = tr => {
  const d1 = tr.days[0]?.date || todayIso(), d2 = tr.days[1]?.date || addDays(d1, 1);
  return [[d1, '09:00', 'base', 1, 'Hotel check-in', 'Hotel name', 'Leave bags if early [Check hours]', '', ''],
    [d1, '12:00', 'food', 1, 'Lunch', 'Restaurant name', '[Book ahead] [Cash only]', '', ''],
    [d2, '15:00', 'sights', 2, 'Walk around the old town', '', '[Photo spot]', '', '']];
};
const csvFilename = (tr, kind) => `${slug(tr.name)}-days${kind ? '-' + kind : ''}.csv`;

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
// Returns { added, skipped, newDays, problems: [] }. Adds to the trip; never removes anything.
function csvImportRows(tr, grid) {
  const head = grid[0].map(h => CSV_ALIASES[String(h).trim().toLowerCase()] || ''), col = n => head.indexOf(n);
  if (col('Date') < 0 && col('Day') < 0 && col('Title') < 0) throw Error('Header row not recognised. Use the template columns.');
  const out = { added: 0, skipped: 0, newDays: 0, problems: [] }, base = tr.days.slice();
  const newDay = date => { const d = { id: uid('d'), date, title: '', place: '', items: [] }; tr.days.push(d); out.newDays++; return d; };
  const byNumber = n => { while (base.length < n) { const last = base[base.length - 1]; base.push(newDay(last ? addDays(last.date, 1) : todayIso())); } return base[n - 1]; };
  let prev = null;
  grid.slice(1).forEach((r, k) => {
    const v = n => (col(n) < 0 ? '' : String(r[col(n)] ?? '').trim()), line = k + 2;
    let d = null;
    if (v('Date')) { const iso = csvDate(v('Date')); if (!iso) return out.problems.push(`Row ${line}: date “${v('Date')}” is not YYYY-MM-DD`); d = tr.days.find(x => x.date === iso) || newDay(iso); }
    else if (v('Day')) { const n = parseInt(v('Day'), 10); if (!(n >= 1 && n <= 90)) return out.problems.push(`Row ${line}: Day “${v('Day')}” is not a number from 1 to 90`); d = byNumber(n); }
    else d = prev || byNumber(1);
    prev = d;
    const title = v('Title') || v('Map place'); if (!title) return; // a day-only row
    const { cat, bad } = csvCategory(v('Category')); if (bad) out.problems.push(`Row ${line}: category “${bad}” is unknown, used sights`);
    let spot = null;
    if (v('Map place')) {
      const key = v('Map place').toLowerCase(), lat = parseFloat(v('Lat')), lon = parseFloat(v('Lon'));
      spot = tr.spots.find(s => s.name.trim().toLowerCase() === key);
      if (!spot) { spot = { id: uid('p'), name: v('Map place'), jp: '', city: '', cat, note: '', hours: '', link: '', gmaps: '', days: [] }; tr.spots.push(spot); }
      if (!hasCoords(spot) && Number.isFinite(lat) && Number.isFinite(lon)) { spot.lat = lat; spot.lon = lon; }
      if (!spot.days.includes(d.id)) spot.days.push(d.id);
    }
    const time = v('Time'), note = String(r[col('Notes')] ?? '').trim(), spotId = spot ? spot.id : '';
    if (d.items.some(it => it.time === time && it.title === title && (it.spotId || '') === spotId)) return out.skipped++; // already there: safe to re-import an export
    d.items.push({ id: uid('i'), time, title, note, spotId }); out.added++;
  });
  tr.days.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/* ---------- UI ---------- */
function csvPickFile() {
  return new Promise(res => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.csv,text/csv,text/plain';
    inp.onchange = () => res(inp.files[0] || null); inp.oncancel = () => res(null); inp.click();
  });
}
async function csvImportFile(tr) {
  const f = await csvPickFile(); if (!f) return;
  try {
    if (f.size > 2e6) throw Error('File is too large.');
    const grid = csvParse(await f.text()); if (grid.length < 2) throw Error('The file has no rows.');
    csvApply(tr, grid);
  } catch (e) { toast(e.message); }
}
function csvApply(tr, grid) {
  const snap = snapshot(tr);
  let r; try { r = csvImportRows(tr, grid); } catch (e) { Object.assign(tr, structuredClone(snap)); throw e; }
  if (!r.added && !r.newDays) { Object.assign(tr, structuredClone(snap)); throw Error(r.skipped ? 'Nothing new: those stops are already in the trip.' : (r.problems[0] || 'No stops found in the file.')); }
  saveDb();
  const open = openSet(); tr.days.forEach(d => { if (d.items.length && r.added) open.add(d.id); });
  closeSheet(); renderDaysTab();
  undoToast(`${t('Imported')} ${r.added} ${t('stops')}${r.newDays ? ` · ${r.newDays} ${t('new days')}` : ''}${r.skipped ? ` · ${r.skipped} ${t('skipped')}` : ''}${r.problems.length ? ` · ${r.problems.length} ${t('warnings')}` : ''}`, snap);
  if (r.problems.length) setTimeout(() => alert(r.problems.slice(0, 12).join('\n') + (r.problems.length > 12 ? `\n… +${r.problems.length - 12}` : '')), 300);
}

// Sheet: import / export / template, plus a quick-entry form with clickable tags that builds rows for the template.
function csvSheet(tr) {
  const queue = []; let cat = 'sights';
  const chip = (attr, val, label, extra = '') => `<button type="button" class="tag" ${attr}="${esc(val)}" ${extra}>${esc(label)}</button>`;
  openSheet({
    title: t('Days CSV'), submit: null,
    body: `<div class="csv-top">
        <button type="button" class="primary" data-csv="import">${t('Import CSV')}</button>
        <button type="button" data-csv="export" ${tr.days.length ? '' : 'disabled'}>${t('Export CSV')}</button>
        <button type="button" data-csv="template">${t('Blank template')}</button></div>
      <p class="field-hint">${t('Columns')}: ${CSV_COLS.join(' · ')}. ${t('Export and import use the same columns, so an exported file can be edited and imported again. Importing only adds; stops already in the trip are skipped.')}</p>
      <h3 class="csv-h">${t('Quick entry')}</h3>
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
        <button type="button" class="primary" data-csv="q-import">${t('Add to this trip')}</button>
        <button type="button" class="text-btn" data-csv="q-clear">${t('Clear')}</button></div>`,
    onOpen: root => {
      const g = id => root.querySelector('#' + id);
      const dayOf = () => { const v = g('q-day').value; return v === 'new' ? { date: addDays(tr.days[tr.days.length - 1]?.date || todayIso(), tr.days.length ? 1 : 0), n: tr.days.length + 1 } : { date: tr.days[+v].date, n: +v + 1 }; };
      const paint = () => {
        g('q-list').innerHTML = queue.map((r, i) => `<li><span class="q-t">${esc(r[0])}${r[1] ? ' ' + esc(r[1]) : ''}</span><span class="q-m"><b class="user-text">${esc(r[4] || r[5])}</b><small>${esc([r[2], r[5] && r[4] ? r[5] : '', r[6]].filter(Boolean).join(' · '))}</small></span><button type="button" class="icon-btn" data-csv="q-del" data-i="${i}" aria-label="${t('Remove')}">✕</button></li>`).join('');
        g('q-actions').hidden = !queue.length;
      };
      root.onkeydown = e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); if (e.target.id !== 'q-place') root.querySelector('[data-csv=add]').click(); } };
      root.onclick = e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.time) g('q-time').value = b.dataset.time;
        else if (b.dataset.cat) { cat = b.dataset.cat; root.querySelectorAll('[data-cat]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); }
        else if (b.dataset.note) { const n = g('q-note'), tag = `[${b.dataset.note}]`; if (!n.value.includes(tag)) n.value = (n.value.trim() ? n.value.trim() + ' ' : '') + tag; }
        else switch (b.dataset.csv) {
          case 'import': csvImportFile(tr); break;
          case 'export': download(csvFilename(tr), csvText(csvRowsFromTrip(tr)), 'text/csv'); break;
          case 'template': download(csvFilename(tr, 'template'), csvText(csvTemplateRows(tr)), 'text/csv'); break;
          case 'add': {
            const title = g('q-title').value.trim(), place = g('q-place').value.trim(); if (!title && !place) return toast('Enter a title or a map place.');
            const dd = dayOf(), known = tr.spots.find(s => s.name.toLowerCase() === place.toLowerCase());
            queue.push([dd.date, g('q-time').value.trim(), place ? (known ? known.cat : cat) : '', dd.n, title || place, place, g('q-note').value.trim(), '', '']);
            ['q-time', 'q-title', 'q-place', 'q-note'].forEach(id => g(id).value = ''); paint(); g('q-title').focus(); break;
          }
          case 'q-del': queue.splice(+b.dataset.i, 1); paint(); break;
          case 'q-clear': queue.length = 0; paint(); break;
          case 'q-download': download(csvFilename(tr, 'rows'), csvText(queue), 'text/csv'); break;
          case 'q-import': try { csvApply(tr, [CSV_COLS, ...queue]); } catch (err) { toast(err.message); } break;
        }
      };
    }
  });
}
