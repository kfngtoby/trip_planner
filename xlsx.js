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
