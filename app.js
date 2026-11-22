'use strict';
/* Router + Home + Trip shell + Days tab.
   Routes:  #/                    home (all trips)
            #/trip/<id>/map       overview map
            #/trip/<id>/days      day-by-day details
            #/trip/<id>/expenses  expenses & split */

let current = { tripId: null, tab: 'map' };
const openDays = new Map(); // tripId -> Set of expanded day ids (kept per session)

function go(hash) { if (location.hash === hash) route(); else location.hash = hash; }

function route() {
  closeSheet();
  destroyMap?.();
  const [, view, id, tab] = location.hash.split('/');
  const trip = view === 'trip' && getTrip(id);
  if (trip) { current = { tripId: id, tab: ['map', 'days', 'expenses'].includes(tab) ? tab : 'map' }; renderTrip(); }
  else { current = { tripId: null, tab: 'map' }; renderHome(); }
  window.scrollTo(0, 0);
}

const langToggle = () => `<div class="language" role="group" aria-label="Language"><span class="lang-globe" aria-hidden="true">🌐</span><button type="button" data-lang="en">EN</button><button type="button" data-lang="zh">中文</button></div>`;

/* ================= HOME ================= */
function tripDates(trip) {
  if (!trip.days.length) return t('No stops yet');
  const a = trip.days[0].date, b = trip.days[trip.days.length - 1].date;
  return a === b ? fmtDate(a) : `${fmtDate(a, { day: 'numeric', month: 'short' })} – ${fmtDate(b, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
function renderHome() {
  document.title = t('My trips');
  const trips = [...db.trips].sort((a, b) => (a.days[0]?.date || '9').localeCompare(b.days[0]?.date || '9'));
  $('#app').innerHTML = `
    <header class="bar"><h1 class="bar-title">My trips</h1>${langToggle()}</header>
    <main class="home">
      <div id="account-slot"></div>
      ${trips.length ? `<ul class="trip-list">${trips.map(tr => `
        <li class="trip-row">
          <a class="trip-link" href="#/trip/${esc(tr.id)}/map">
            <span class="trip-name user-text">${esc(tr.name)}</span>
            <span class="trip-meta"><span>${esc(tripDates(tr))}</span><span>${tr.days.length} <span>${t('Days')}</span></span><span>${esc(tr.currency)} ${money(tripTotal(tr))}</span></span>
            <span class="trip-strip">${tr.days.map((d, i) => `<i style="--c:${DAY_COLORS[i % DAY_COLORS.length]}"></i>`).join('')}</span>
          </a>
          <button class="icon-btn" data-trip-menu="${esc(tr.id)}" aria-label="Trip options">⋯</button>
        </li>`).join('')}</ul>`
      : `<p class="empty">No trips yet. Create one to start planning.</p>`}
      <div class="home-tools"><button id="import-trip" class="text-btn">Import trip backup</button><input id="import-file" type="file" accept=".json,application/json" hidden></div>
    </main>
    <div class="bottom-action"><button class="primary wide" id="new-trip">New trip</button></div>`;
  $('#new-trip').onclick = () => tripForm();
  $('#import-trip').onclick = () => $('#import-file').click();
  $('#import-file').onchange = importTrip;
  if (typeof renderAccount === 'function') renderAccount();
}

// Timezone pickers: presets + any IANA name (datalist), so every zone in the world is possible.
function tzFields(trip) {
  const opts = TZ_PRESETS.map(([z, n]) => `<option value="${esc(z)}">${esc(n)}</option>`).join('');
  const dest = trip ? tripTz(trip) : 'Asia/Tokyo', home = trip ? homeTz(trip) : deviceTz();
  return `<div class="pair"><label>Destination timezone<input name="tz" list="tz-list" value="${esc(dest)}" autocapitalize="off" spellcheck="false"></label>
    <label>Home timezone<input name="homeTz" list="tz-list" value="${esc(home)}" autocapitalize="off" spellcheck="false"></label></div>
    <datalist id="tz-list">${opts}</datalist>`;
}

function tripForm(trip) {
  const editing = !!trip;
  openSheet({
    title: editing ? 'Rename trip' : 'New trip',
    submit: editing ? 'Save' : 'Create trip',
    body: `
      <label>Trip name<input name="name" required maxlength="80" value="${esc(trip?.name || '')}" placeholder="e.g. Tokyo with friends"></label>
      ${tzFields(trip)}
      ${editing ? `<label>Currency<input name="currency" maxlength="5" value="${esc(trip.currency)}"></label>` : `
      <div class="pair"><label>Start date<input name="start" type="date" required value="${todayIso()}"></label>
      <label>Number of days<input name="count" type="number" min="1" max="60" value="3" required inputmode="numeric"></label></div>
      <label>Currency<input name="currency" maxlength="5" value="HKD"></label>`}`,
    onOpen: root => root.querySelector('[name=name]').focus(),
    onSubmit: f => {
      const name = f.get('name').trim(); if (!name) return sheetError('A name is required.');
      const currency = (f.get('currency') || 'HKD').trim().toUpperCase() || 'HKD';
      const tz = f.get('tz') || deviceTz(), home = f.get('homeTz') || deviceTz();
      if (!tzValid(tz) || !tzValid(home)) return sheetError('Enter a valid timezone, e.g. Asia/Tokyo.');
      if (editing) { Object.assign(trip, { name, currency, tz, homeTz: home }); saveDb(); route(); return; }
      const count = Math.min(60, Math.max(1, parseInt(f.get('count'), 10) || 1));
      const start = f.get('start') || todayIn(tz);
      const nt = { id: uid('trip'), name, currency, tz, homeTz: home, members: [{ id: uid('m'), name: 'You' }], spots: [], expenses: [],
        days: Array.from({ length: count }, (_, i) => ({ id: uid('d'), date: addDays(start, i), title: '', place: '', items: [] })) };
      db.trips.push(nt); saveDb(); closeSheet(); go(`#/trip/${nt.id}/days`);
    }
  });
}

function tripMenu(id) {
  const trip = getTrip(id); if (!trip) return;
  openSheet({
    title: trip.name, submit: null,
    body: `<div class="menu">
      <button data-act="rename">Rename trip</button>
      <button data-act="duplicate">Duplicate trip</button>
      <button data-act="export">Export trip backup</button>
      <button data-act="kml">Export for Google My Maps (KML)</button>
      ${typeof aiAvailable === 'function' && aiAvailable() ? `<button data-act="ai">${t('Ask AI about this trip')}</button>` : ''}
      <button data-act="delete" class="danger">Delete trip</button></div>`,
    onOpen: root => root.onclick = e => {
      const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
      if (act === 'rename') tripForm(trip);
      if (act === 'duplicate') { const c = structuredClone(trip); c.id = uid('trip'); c.name = trip.name + ' (copy)'; db.trips.push(c); saveDb(); closeSheet(); route(); }
      if (act === 'export') download(`${slug(trip.name)}.json`, JSON.stringify({ version: 3, trip }, null, 2));
      if (act === 'kml') exportKml(trip);
      if (act === 'ai') askAiSheet(trip);
      if (act === 'delete' && confirm(`${t('Delete trip')}: “${trip.name}”?`)) { db.trips = db.trips.filter(x => x.id !== id); if (typeof syncDeleteTrip === 'function') syncDeleteTrip(id); saveDb(); closeSheet(); go('#/'); }
    }
  });
}

async function importTrip(e) {
  const file = e.target.files[0]; if (!file) return;
  try {
    if (file.size > 3e6) throw Error('Backup file is too large.');
    const data = JSON.parse(await file.text());
    const trip = data.trip;
    if (data.version !== 3 || !trip || !Array.isArray(trip.days) || !Array.isArray(trip.spots) || !Array.isArray(trip.expenses) || !Array.isArray(trip.members))
      throw Error('Not a trip backup.');
    if (getTrip(trip.id)) trip.id = uid('trip');
    db.trips.push(trip); saveDb(); toast('Saved'); route();
  } catch (err) { toast(err.message); } finally { e.target.value = ''; }
}

function exportKml(trip) {
  const styles = Object.entries(CATS).map(([k, c]) => { const h = c.color.slice(1); return `<Style id="${k}"><IconStyle><color>ff${h.slice(4)}${h.slice(2, 4)}${h.slice(0, 2)}</color></IconStyle></Style>`; }).join('');
  const folders = [...trip.days.map(d => ({ name: `${fmtDate(d.date)} ${d.title}`, spots: trip.spots.filter(s => s.days[0] === d.id) })),
    { name: 'Other places', spots: trip.spots.filter(s => !trip.days.some(d => d.id === s.days[0])) }]
    .filter(f => f.spots.some(hasCoords))
    .map(f => `<Folder><name>${esc(f.name)}</name>${f.spots.filter(hasCoords).map(s => `<Placemark><name>${esc(s.name)}</name><description>${esc([s.city, s.note, s.link].filter(Boolean).join('\n'))}</description><styleUrl>#${s.cat}</styleUrl><Point><coordinates>${s.lon},${s.lat},0</coordinates></Point></Placemark>`).join('')}</Folder>`).join('');
  download(`${slug(trip.name)}.kml`, `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(trip.name)}</name>${styles}${folders}</Document></kml>`, 'application/vnd.google-earth.kml+xml');
}

/* ================= TRIP SHELL ================= */
const trip = () => getTrip(current.tripId);

function renderTrip() {
  const tr = trip();
  document.title = tr.name;
  $('#app').innerHTML = `
    <header class="bar trip-bar">
      <a class="icon-btn back" href="#/" aria-label="All trips">‹</a>
      <div class="title-wrap" id="title-wrap"><button class="bar-title trip-title user-text" id="trip-title" aria-label="Rename trip">${esc(tr.name)}</button></div>
      <button class="icon-btn" data-trip-menu="${esc(tr.id)}" aria-label="Trip options">⋯</button>
      ${langToggle()}
    </header>
    <main id="view" class="view view-${current.tab}"></main>
    <nav class="tabbar" role="tablist" aria-label="Trip views">
      ${[['map', 'Overview', '◎'], ['days', 'Days', '☰'], ['expenses', 'Expenses', '¥']].map(([k, label, ico]) =>
        `<a role="tab" href="#/trip/${esc(tr.id)}/${k}" aria-selected="${current.tab === k}"><span aria-hidden="true" class="tab-ico">${ico}</span><span>${label}</span></a>`).join('')}
    </nav>`;
  $('#trip-title').onclick = inlineRename;
  if (current.tab === 'map') renderMapTab();
  if (current.tab === 'days') renderDaysTab();
  if (current.tab === 'expenses') renderExpensesTab();
}

function inlineRename() {
  const tr = trip(), wrap = $('#title-wrap');
  wrap.innerHTML = `<input id="title-input" class="title-input" maxlength="80" aria-label="Trip name" value="${esc(tr.name)}">`;
  const input = $('#title-input'); input.focus(); input.select();
  let finished = false;
  const done = save => {
    if (finished) return; finished = true; // Enter triggers blur when the input is removed
    const v = input.value.trim();
    if (save && v && v !== tr.name) { tr.name = v; saveDb(); toast('Saved'); }
    wrap.innerHTML = `<button class="bar-title trip-title user-text" id="trip-title" aria-label="Rename trip">${esc(tr.name)}</button>`;
    $('#trip-title').onclick = inlineRename; document.title = tr.name;
  };
  input.onkeydown = e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); };
  input.onblur = () => done(true);
}

/* ================= TIMEZONE UI ================= */
// Small strip: destination clock vs home clock + where the trip is right now (judged by the destination's calendar).
function tzStrip(tr) {
  const dz = tripTz(tr), hz = homeTz(tr), now = new Date(), same = dz === hz, ph = tripPhase(tr);
  const phase = !ph ? '' : ph.kind === 'now' ? `${t('Day')} ${ph.dayIndex + 1}/${tr.days.length}` : ph.kind === 'before' ? `${ph.days} ${t('days to go')}` : ph.kind === 'after' ? `${t('Trip ended')} ${ph.days} ${t('days ago')}` : t('Between days');
  return `<div class="tz-strip" role="group" aria-label="${t('Timezone')}">
    <span class="tz-clock"><small>${esc(tzLabel(dz))}</small><b>${tzClock(dz, now)}</b><small>${esc(tzShort(dz, now))}</small></span>
    ${same ? '' : `<span class="tz-clock home"><small>${esc(tzLabel(hz))}</small><b>${tzClock(hz, now)}</b><small>${esc(tzShort(hz, now))}</small></span>
    <span class="tz-diff">${esc(tzDiffLabel(hz, dz, now))}</span>`}
    ${phase ? `<span class="tz-phase ${ph.kind}">${esc(phase)}</span>` : ''}</div>`;
}
// Home-time equivalent for a timed stop, e.g. "08:00 HKT" (+1d / −1d when it crosses midnight).
function stopTzHint(tr, d, it) {
  const h = homeEquivalent(tr, d, it); if (!h) return '';
  const shift = h.dayShift ? ` ${h.dayShift > 0 ? '+' : '−'}${Math.abs(h.dayShift)}d` : '';
  const own = it.tz && tzValid(it.tz) && it.tz !== tripTz(tr) ? `<small class="tz-own">${esc(tzShort(it.tz))}</small>` : '';
  return `${own}<small class="tz-home" title="${esc(t('Home time'))}">≙ ${h.time}${shift}</small>`;
}
// Keep the clock ticking while a trip screen is open (once per minute is enough).
setInterval(() => { document.querySelectorAll('.tz-strip').forEach(el => { const tr = current.tripId && getTrip(current.tripId); if (tr) el.outerHTML = tzStrip(tr); }); }, 30000);

/* ================= DAYS TAB ================= */
/* ---- day planning helpers (pure, no DOM) ---- */
const kmBetween = (a, b) => {
  const r = x => x * Math.PI / 180, h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
};
const itemSpot = (tr, it) => { const s = it.spotId && tr.spots.find(x => x.id === it.spotId); return s && hasCoords(s) ? s : null; };
const fmtKm = k => k < 1 ? `${Math.round(k * 1000)} m` : `${k.toFixed(k < 10 ? 1 : 0)} km`;
// Nearest-neighbour start, then 2-opt improvement. The first point is locked (hotel / station you start from).
function optimiseOrder(pts) {
  const n = pts.length; if (n < 3) return pts.map((_, i) => i);
  const d = (i, j) => kmBetween(pts[i], pts[j]);
  const left = new Set(pts.map((_, i) => i)); left.delete(0);
  let order = [0];
  while (left.size) { const last = order[order.length - 1]; let best = -1, bd = Infinity; for (const j of left) { const x = d(last, j); if (x < bd) { bd = x; best = j; } } order.push(best); left.delete(best); }
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < n - 1; i++) for (let j = i + 1; j < n; j++) {
      const before = d(order[i - 1], order[i]) + (j + 1 < n ? d(order[j], order[j + 1]) : 0);
      const after = d(order[i - 1], order[j]) + (j + 1 < n ? d(order[i], order[j + 1]) : 0);
      if (after < before - 1e-9) { order = [...order.slice(0, i), ...order.slice(i, j + 1).reverse(), ...order.slice(j + 1)]; improved = true; }
    }
  }
  return order;
}
const pathKm = pts => pts.reduce((n, p, i) => i ? n + kmBetween(pts[i - 1], p) : 0, 0);
// Stops that carry a clock time are sorted among themselves; untimed stops keep their position.
function sortItemsByTime(items, tr, day) {
  const mins = it => { const m = timeMins(it.time); return m === null ? null : (tr && it.tz && tzValid(it.tz) ? m - tzOffsetMin(it.tz, new Date(day.date + 'T12:00:00Z')) + tzOffsetMin(tripTz(tr), new Date(day.date + 'T12:00:00Z')) : m); };
  const slots = items.map((it, i) => mins(it) === null ? -1 : i).filter(i => i >= 0);
  const sorted = slots.map(i => items[i]).sort((a, b) => mins(a) - mins(b));
  const out = [...items]; slots.forEach((slot, k) => out[slot] = sorted[k]);
  return out;
}
const snapshot = tr => structuredClone({ days: tr.days, spots: tr.spots, expenses: tr.expenses });
function undoToast(msg, snap) {
  const tr = trip(), el = $('#toast'); el.replaceChildren(document.createTextNode(t(msg) + ' '));
  const b = document.createElement('button'); b.type = 'button'; b.className = 'text-btn'; b.style.cssText = 'color:#fff;text-decoration:underline;padding:0 4px';
  b.textContent = t('Undo'); b.onclick = () => { Object.assign(tr, structuredClone(snap)); saveDb(); el.hidden = true; renderDaysTab(); };
  el.append(b); el.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => el.hidden = true, 7000);
}
let reorderMode = false;
const dayCost = (tr, d) => tr.expenses.reduce((n, e) => e.dayId === d.id ? n + e.amount : n, 0);
function dayStats(tr, d) {
  const pts = d.items.map(it => itemSpot(tr, it)).filter(Boolean), km = pathKm(pts), cost = dayCost(tr, d);
  return (pts.length > 1 ? ` · ≈${fmtKm(km)}` : '') + (cost ? ` · ${esc(tr.currency)} ${money(cost)}` : '');
}
function legHtml(tr, d, ix) {
  const a = ix && itemSpot(tr, d.items[ix - 1]), b = itemSpot(tr, d.items[ix]);
  const el = ix && (d.items[ix - 1].tz || d.items[ix].tz) && elapsedMins(tr, d, d.items[ix - 1], d.items[ix]);
  const dist = a && b ? `≈${fmtKm(kmBetween(a, b))}` : '';
  return dist || el ? `<li class="leg" aria-hidden="true">↓ ${[dist, el ? `⏱ ${fmtMins(el)}` : ''].filter(Boolean).join(' · ')}</li>` : '';
}
function dayAction(act, dayId, extra) {
  const tr = trip(), d = tr.days.find(x => x.id === dayId); if (!d) return;
  const snap = snapshot(tr);
  if (act === 'sort') {
    const next = sortItemsByTime(d.items, tr, d);
    if (next.every((it, i) => it === d.items[i])) return toast('Already in time order');
    d.items = next; saveDb(); renderDaysTab(); return undoToast('Sorted by time', snap);
  }
  if (act === 'opt') {
    const idx = d.items.map((it, i) => itemSpot(tr, it) ? i : -1).filter(i => i >= 0);
    if (idx.length < 3) return toast('Need at least 3 stops with map locations.');
    const pts = idx.map(i => itemSpot(tr, d.items[i])), order = optimiseOrder(pts);
    const before = pathKm(pts), after = pathKm(order.map(i => pts[i]));
    if (after >= before - 0.05) return toast('Route is already efficient');
    const moved = order.map(i => d.items[idx[i]]); idx.forEach((slot, k) => d.items[slot] = moved[k]);
    saveDb(); renderDaysTab(); return undoToast(`${t('Route shortened')}: ${fmtKm(before)} → ${fmtKm(after)}`, snap);
  }
}
function moveItem(dayId, itemId, dir) {
  const d = trip().days.find(x => x.id === dayId), i = d?.items.findIndex(x => x.id === itemId);
  if (i < 0 || i + dir < 0 || i + dir >= d.items.length) return;
  [d.items[i], d.items[i + dir]] = [d.items[i + dir], d.items[i]]; saveDb(); renderDaysTab();
}
function dupItem(dayId, itemId) {
  const d = trip().days.find(x => x.id === dayId), i = d?.items.findIndex(x => x.id === itemId); if (i < 0) return;
  d.items.splice(i + 1, 0, { ...d.items[i], id: uid('i') }); saveDb(); renderDaysTab(); toast('Saved');
}

function openSet() {
  const tr = trip();
  if (!openDays.has(tr.id)) {
    const today = todayDay(tr);
    openDays.set(tr.id, new Set([(today || tr.days[0])?.id].filter(Boolean)));
  }
  return openDays.get(tr.id);
}

function renderDaysTab() {
  const tr = trip(), open = openSet(), allOpen = tr.days.length && tr.days.every(d => open.has(d.id));
  $('#view').innerHTML = `
    <div class="toolbar">
      <span class="toolbar-group">
        <button id="expand-all" class="text-btn" ${allOpen ? 'disabled' : ''}>${t('Expand all')}</button>
        <button id="collapse-all" class="text-btn" ${open.size ? '' : 'disabled'}>${t('Collapse all')}</button>
      </span>
      <span class="toolbar-group"><button id="reorder" class="text-btn" aria-pressed="${reorderMode}">${reorderMode ? t('Done') : t('Reorder')}</button>${todayDay(tr) ? `<button id="jump-today" class="text-btn">${t('Today')}</button>` : ''}<button id="add-day" class="text-btn">+ ${t('Add day')}</button></span>
    </div>
    ${(() => { const qd = todayDay(tr) || tr.days.find(d => open.has(d.id)) || tr.days[0]; return qd && typeof discoveryButtons === 'function' ? `<div class="discover-quick"><small class="user-text">${discoveryLabel('Near', '附近')} · Day ${tr.days.indexOf(qd) + 1}${qd.place ? ' · ' + esc(qd.place) : ''}</small>${discoveryButtons(qd)}</div>` : ''; })()}
    ${tzStrip(tr)}
    ${typeof aiPanelHtml === 'function' ? aiPanelHtml(tr) : ''}
    ${tr.days.some(d => d.items.length) ? `<p class="swipe-hint">${t('Tap a stop to edit · swipe right to remove')}</p>` : ''}
    ${tr.days.length ? tr.days.map((d, i) => dayCard(tr, d, i, open.has(d.id))).join('') : `<p class="empty">No stops yet</p>`}`;
  $('#view').querySelectorAll('[data-discovery]').forEach(b => b.onclick = () => discover(tr, b.dataset.day, b.dataset.discovery));
  if (typeof aiWire === 'function') aiWire(tr);
  $('#expand-all').onclick = () => { tr.days.forEach(d => open.add(d.id)); renderDaysTab(); };
  $('#collapse-all').onclick = () => { open.clear(); renderDaysTab(); $('#view').scrollTo({ top: 0 }); };
  $('#reorder').onclick = () => { reorderMode = !reorderMode; renderDaysTab(); };
  $('#jump-today')?.addEventListener('click', () => { const td = todayDay(tr); open.add(td.id); renderDaysTab(); document.getElementById('day-' + td.id)?.scrollIntoView({ block: 'start' }); });
  $('#add-day').onclick = () => {
    const last = tr.days[tr.days.length - 1];
    const d = { id: uid('d'), date: last ? addDays(last.date, 1) : todayIn(tripTz(tr)), title: '', place: '', items: [] };
    tr.days.push(d); open.add(d.id); saveDb(); renderDaysTab();
    document.getElementById('day-' + d.id)?.scrollIntoView({ block: 'center' });
  };
}

function dayCard(tr, d, i, isOpen) {
  const color = DAY_COLORS[i % DAY_COLORS.length], spots = daySpots(tr, d), route = gmapsRouteUrl(spots);
  const isToday = d.date === todayIn(tripTz(tr));
  return `<section class="day ${isOpen ? 'open' : ''}" id="day-${esc(d.id)}" style="--c:${color}">
    <button class="day-head" data-toggle-day="${esc(d.id)}" aria-expanded="${isOpen}" aria-controls="body-${esc(d.id)}">
      <span class="day-num"><span>Day ${i + 1}</span><small>${esc(fmtDate(d.date))}</small></span>
      <span class="day-sum"><strong class="user-text">${esc(L(d, 'title') || L(d, 'place') || '—')}</strong>
        <small>${d.place && d.title ? `<span class="user-text">${esc(L(d, 'place'))}</span> · ` : ''}${d.items.length} <span>${t('stops')}</span>${dayStats(tr, d)}${isToday ? ' · <b class="today">●</b>' : ''}</small></span>
      <span class="chev" aria-hidden="true"></span>
    </button>
    <div class="day-body" id="body-${esc(d.id)}" ${isOpen ? '' : 'hidden'}>
      ${discoveryButtons(d)}
      ${d.items.length ? `<ol class="stops">${d.items.map((it, ix) => {
        const s = it.spotId && tr.spots.find(x => x.id === it.spotId);
        return `${legHtml(tr, d, ix)}<li class="stop">
          <span class="stop-del" aria-hidden="true"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>${t('Remove')}</span>
          <div class="stop-in ${reorderMode ? 'has-reorder' : ''}" data-edit-item="${esc(d.id)}|${esc(it.id)}" data-stop="${esc(d.id)}|${esc(it.id)}">
          <span class="stop-time user-text">${esc(it.time)}${stopTzHint(tr, d, it)}</span>
          <div class="stop-main">
            <button class="stop-title user-text" data-edit-item="${esc(d.id)}|${esc(it.id)}">${s ? `<span class="cat-badge sm" style="--c:${CATS[s.cat]?.color || color}" title="${esc(CATS[s.cat]?.label || '')}">${catIcon(s.cat, 12)}</span>` : ''}<span>${esc(L(it, 'title') || '—')}</span></button>
            ${it.note ? `<p class="user-text">${esc(L(it, 'note')).replace(/\n/g, '<br>')}</p>` : ''}
            ${s ? `<div class="chips-row"><a class="chip" href="#/trip/${esc(tr.id)}/map" data-focus-spot="${esc(s.id)}"><em class="cat-mini" style="--c:${CATS[s.cat]?.color || color}">${catIcon(s.cat, 15)}</em><span class="user-text">${esc(L(s, 'name'))}</span></a>
              <a class="chip" target="_blank" rel="noopener" href="${esc(gmapsDirectionsUrl(s))}">${t('Directions')}</a></div>` : ''}
          </div>${reorderMode ? `<span class="reorder"><button type="button" data-mv="${esc(d.id)}|${esc(it.id)}|-1" aria-label="${t('Move up')}" ${ix === 0 ? 'disabled' : ''}>↑</button><button type="button" data-mv="${esc(d.id)}|${esc(it.id)}|1" aria-label="${t('Move down')}" ${ix === d.items.length - 1 ? 'disabled' : ''}>↓</button><button type="button" data-dup="${esc(d.id)}|${esc(it.id)}" aria-label="${t('Duplicate')}">⧉</button></span>` : ''}</div></li>`; }).join('')}</ol>` : `<p class="muted">No stops yet</p>`}
      <div class="day-actions">
        <button data-add-item="${esc(d.id)}" class="primary">+ ${t('Add stop')}</button>
        ${route ? `<a class="btn" target="_blank" rel="noopener" href="${esc(route)}">${t('Route in Google Maps')}</a>` : ''}
        <button data-edit-day="${esc(d.id)}">${t('Edit day')}</button>
        <button type="button" class="danger" data-del-day="${esc(d.id)}">${TRASH} ${t('Delete day')}</button>
        ${d.items.length > 2 ? `<button data-opt="${esc(d.id)}">${t('Optimise route')}</button>` : ''}${d.items.length > 1 ? `<button data-sort="${esc(d.id)}">${t('Sort by time')}</button>` : ''}
      </div>
    </div></section>`;
}

const TRASH = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
// Delete a whole day. Days with stops ask first; Undo stays on screen for a few seconds either way.
function deleteDay(dayId) {
  const tr = trip(), d = tr.days.find(x => x.id === dayId); if (!d) return;
  if (d.items.length && !confirm(`${t('Delete day')}? (${d.items.length} ${t('stops')})`)) return;
  const snap = snapshot(tr);
  tr.days = tr.days.filter(x => x.id !== dayId);
  tr.spots.forEach(s => s.days = s.days.filter(x => x !== dayId));
  tr.expenses.forEach(e => { if (e.dayId === dayId) e.dayId = ''; });
  openSet().delete(dayId); saveDb(); closeSheet(); renderDaysTab(); undoToast('Day deleted', snap);
}
// Swipe-to-remove / quick remove for one stop (Undo restores it).
function removeItem(dayId, itemId) {
  const tr = trip(), d = tr.days.find(x => x.id === dayId); if (!d || !d.items.some(x => x.id === itemId)) return;
  const snap = snapshot(tr), view = $('#view'), top = view ? view.scrollTop : 0;
  d.items = d.items.filter(x => x.id !== itemId); saveDb(); renderDaysTab();
  if (view) view.scrollTop = top; undoToast('Stop removed', snap);
}

function dayForm(dayId) {
  const tr = trip(), d = tr.days.find(x => x.id === dayId);
  openSheet({
    title: 'Edit day', submit: 'Save',
    body: `<label>Date<input type="date" name="date" required value="${esc(d.date)}"></label>
      <label>Day title<input name="title" maxlength="120" value="${esc(d.title)}"></label>
      <label>Area<input name="place" maxlength="120" value="${esc(d.place)}" placeholder="e.g. Kobe"></label>
      <button type="button" class="danger wide del-big" id="del-day">${TRASH} ${t('Delete day')}${d.items.length ? ` · ${d.items.length} ${t('stops')}` : ''}</button>`,
    onOpen: root => root.querySelector('#del-day').onclick = () => deleteDay(dayId),
    onSubmit: f => {
      d.date = f.get('date') || d.date; d.title = f.get('title').trim(); d.place = f.get('place').trim();
      tr.days.sort((a, b) => a.date.localeCompare(b.date));
      saveDb(); closeSheet(); renderDaysTab();
    }
  });
}

function itemForm(dayId, itemId) {
  const tr = trip(), d = tr.days.find(x => x.id === dayId);
  const it = itemId ? d.items.find(x => x.id === itemId) : { time: '', title: '', note: '', spotId: '' };
  const idx = itemId ? d.items.indexOf(it) : -1;
  openSheet({
    title: itemId ? 'Edit stop' : 'Add stop', submit: 'Save',
    body: `<div class="pair pair-time"><label>Time<input name="time" maxlength="40" value="${esc(it.time)}" placeholder="09:00"></label>
      <label>Title<input name="title" required maxlength="160" value="${esc(it.title)}"></label></div>
      <label>Time is in<select name="tz"><option value="">${esc(tzLabel(tripTz(tr)))} (${t('trip')})</option>${[...new Set([homeTz(tr), ...TZ_PRESETS.map(p => p[0])])].filter(z => z !== tripTz(tr)).map(z => `<option value="${esc(z)}" ${z === it.tz ? 'selected' : ''}>${esc(tzLabel(z))}${z === homeTz(tr) ? ` (${t('home')})` : ''}</option>`).join('')}</select></label>
      <label>Notes<textarea name="note" rows="3" maxlength="1500">${esc(it.note)}</textarea></label>
      <label>Place<select name="spotId"><option value="">${t('No place')}</option>${[...tr.spots].sort((a, b) => a.name.localeCompare(b.name)).map(s => `<option value="${esc(s.id)}" ${s.id === it.spotId ? 'selected' : ''}>${esc(s.name)}${s.city ? ' — ' + esc(s.city) : ''}</option>`).join('')}</select></label>
      <label>Day<select name="dayId">${tr.days.map((x, i) => `<option value="${esc(x.id)}" ${x.id === dayId ? 'selected' : ''}>Day ${i + 1} · ${esc(fmtDate(x.date))}</option>`).join('')}</select></label>
      ${itemId ? `<div class="pair"><button type="button" id="mv-up" ${idx === 0 ? 'disabled' : ''}>↑ ${t('Move up')}</button><button type="button" id="mv-down" ${idx === d.items.length - 1 ? 'disabled' : ''}>↓ ${t('Move down')}</button></div>
      <button type="button" class="danger wide" id="del-item">Delete stop</button>` : ''}`,
    onOpen: root => {
      if (!itemId) { root.querySelector('[name=title]').focus(); return; }
      const move = dir => { d.items.splice(idx, 1); d.items.splice(idx + dir, 0, it); saveDb(); closeSheet(); renderDaysTab(); };
      root.querySelector('#mv-up').onclick = () => move(-1);
      root.querySelector('#mv-down').onclick = () => move(1);
      root.querySelector('#del-item').onclick = () => { const snap = snapshot(tr); d.items = d.items.filter(x => x !== it); saveDb(); closeSheet(); renderDaysTab(); undoToast('Stop deleted', snap); };
    },
    onSubmit: f => {
      const title = f.get('title').trim(); if (!title) return sheetError('A name is required.');
      Object.assign(it, { time: f.get('time').trim(), tz: f.get('tz') || '', title, note: f.get('note').trim(), spotId: f.get('spotId') });
      const target = tr.days.find(x => x.id === f.get('dayId')) || d;
      if (!itemId) { it.id = uid('i'); target.items.push(it); }
      else if (target !== d) { d.items = d.items.filter(x => x !== it); target.items.push(it); }
      // keep the place's day tag in sync so it shows up under that day on the map
      const s = tr.spots.find(x => x.id === it.spotId);
      if (s && !s.days.includes(target.id)) s.days.push(target.id);
      openSet().add(target.id); saveDb(); closeSheet(); renderDaysTab();
    }
  });
}


/* ================= SWIPE RIGHT TO REMOVE A STOP =================
   Drag a stop to the right: a red "Remove" layer shows behind it; let go past about a third of the width and it is removed
   (Undo appears). Vertical scrolling is untouched (touch-action: pan-y). A tap or left-click on the row opens the editor. */
let lastSwipe = 0;
function wireSwipe() {
  let st = null;
  const reset = (row, instant) => { row.style.transition = instant ? 'none' : 'transform .18s ease-out'; row.style.transform = ''; row.parentElement.classList.remove('swiping', 'armed'); };
  document.addEventListener('click', e => { if (Date.now() - lastSwipe < 350) { e.stopPropagation(); e.preventDefault(); } }, true); // a drag must not count as a tap
  document.body.addEventListener('pointerdown', e => {
    const row = e.target.closest('.stop-in'); if (!row || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target.closest('a,input,select,textarea,.reorder')) return;
    st = { row, id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, on: false, w: row.offsetWidth };
  });
  document.body.addEventListener('pointermove', e => {
    if (!st || e.pointerId !== st.id) return;
    const dx = e.clientX - st.x, dy = e.clientY - st.y;
    if (!st.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { st = null; return; }          // it is a scroll
      if (dx < -12) { st = null; return; }                                                   // leftwards: not ours
      if (dx > 10 && dx > Math.abs(dy) * 1.2) { st.on = true; try { st.row.setPointerCapture(e.pointerId); } catch {} st.row.style.transition = 'none'; st.row.parentElement.classList.add('swiping'); }
      else return;
    }
    st.dx = Math.max(0, dx); st.row.style.transform = `translateX(${st.dx}px)`;
    st.row.parentElement.classList.toggle('armed', st.dx > st.w * 0.35);
  });
  const end = e => {
    if (!st || e.pointerId !== st.id) return;
    const { row, dx, on, w } = st; st = null; if (!on) return;
    lastSwipe = Date.now();
    if (e.type !== 'pointercancel' && dx > w * 0.35) {
      row.style.transition = 'transform .16s ease-in'; row.style.transform = `translateX(${w}px)`;
      const [dId, iId] = row.dataset.stop.split('|'); setTimeout(() => removeItem(dId, iId), 160);
    } else reset(row);
  };
  document.body.addEventListener('pointerup', end);
  document.body.addEventListener('pointercancel', end);
}

/* ================= GLOBAL WIRING ================= */
document.addEventListener('DOMContentLoaded', () => {
  loadDb();
  document.body.addEventListener('click', e => {
    const el = e.target.closest('[data-trip-menu],[data-toggle-day],[data-edit-day],[data-add-item],[data-edit-item],[data-focus-spot],[data-mv],[data-dup],[data-opt],[data-sort],[data-del-day]');
    if (!el) return;
    const ds = el.dataset;
    if (ds.tripMenu) tripMenu(ds.tripMenu);
    else if (ds.toggleDay) { const s = openSet(); s.has(ds.toggleDay) ? s.delete(ds.toggleDay) : s.add(ds.toggleDay); renderDaysTab(); }
    else if (ds.editDay) dayForm(ds.editDay);
    else if (ds.addItem) itemForm(ds.addItem);
    else if (ds.delDay) deleteDay(ds.delDay);
    else if (ds.editItem) { if (e.target.closest('a')) return; const [dId, iId] = ds.editItem.split('|'); itemForm(dId, iId); } // anywhere on the row opens the editor, except links
    else if (ds.mv) { const [a, b, c] = ds.mv.split('|'); moveItem(a, b, Number(c)); }
    else if (ds.dup) { const [a, b] = ds.dup.split('|'); dupItem(a, b); }
    else if (ds.opt) dayAction('opt', ds.opt);
    else if (ds.sort) dayAction('sort', ds.sort);
    else if (ds.focusSpot) { e.preventDefault(); pendingFocus = ds.focusSpot; go(`#/trip/${current.tripId}/map`); }
  });
  $('#sheet-form').onsubmit = e => {
    e.preventDefault();
    if (!sheetHandlers?.onSubmit) return closeSheet();
    $('#sheet-error').textContent = '';
    sheetHandlers.onSubmit(new FormData(e.target), e.target);
  };
  $('#sheet-close').onclick = closeSheet;
  $('#sheet').addEventListener('click', e => { if (e.target === $('#sheet')) closeSheet(); }); // tap backdrop
  wireSwipe();
  window.addEventListener('hashchange', route);
  window.addEventListener('langchange', () => { if (!$('#sheet').open) route(); });
  route();
  if (typeof syncInit === 'function') syncInit();
});
