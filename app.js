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

function tripForm(trip) {
  const editing = !!trip;
  openSheet({
    title: editing ? 'Rename trip' : 'New trip',
    submit: editing ? 'Save' : 'Create trip',
    body: `
      <label>Trip name<input name="name" required maxlength="80" value="${esc(trip?.name || '')}" placeholder="e.g. Summer trip"></label>
      ${editing ? `<label>Currency<input name="currency" maxlength="5" value="${esc(trip.currency)}"></label>` : `
      <div class="pair"><label>Start date<input name="start" type="date" required value="${todayIso()}"></label>
      <label>Number of days<input name="count" type="number" min="1" max="60" value="3" required inputmode="numeric"></label></div>
      <label>Currency<input name="currency" maxlength="5" value="HKD"></label>`}`,
    onOpen: root => root.querySelector('[name=name]').focus(),
    onSubmit: f => {
      const name = f.get('name').trim(); if (!name) return sheetError('A name is required.');
      const currency = (f.get('currency') || 'HKD').trim().toUpperCase() || 'HKD';
      if (editing) { Object.assign(trip, { name, currency }); saveDb(); route(); return; }
      const count = Math.min(60, Math.max(1, parseInt(f.get('count'), 10) || 1));
      const start = f.get('start') || todayIso();
      const nt = { id: uid('trip'), name, currency, members: [{ id: uid('m'), name: 'You' }], spots: [], expenses: [],
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
      <button data-act="delete" class="danger">Delete trip</button></div>`,
    onOpen: root => root.onclick = e => {
      const act = e.target.closest('[data-act]')?.dataset.act; if (!act) return;
      if (act === 'rename') tripForm(trip);
      if (act === 'duplicate') { const c = structuredClone(trip); c.id = uid('trip'); c.name = trip.name + ' (copy)'; db.trips.push(c); saveDb(); closeSheet(); route(); }
      if (act === 'export') download(`${slug(trip.name)}.json`, JSON.stringify({ version: 3, trip }, null, 2));
      if (act === 'kml') exportKml(trip);
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
function sortItemsByTime(items) {
  const mins = it => timeMins(it.time);
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
const dayCost = (tr, d) => tr.expenses.reduce((n, e) => e.dayId === d.id ? n + e.amount : n, 0);
function dayStats(tr, d) {
  const pts = d.items.map(it => itemSpot(tr, it)).filter(Boolean), km = pathKm(pts), cost = dayCost(tr, d);
  return (pts.length > 1 ? ` · ≈${fmtKm(km)}` : '') + (cost ? ` · ${esc(tr.currency)} ${money(cost)}` : '');
}
function legHtml(tr, d, ix) {
  const a = ix && itemSpot(tr, d.items[ix - 1]), b = itemSpot(tr, d.items[ix]);
  const dist = a && b ? `≈${fmtKm(kmBetween(a, b))}` : '';
  return dist ? `<li class="leg" aria-hidden="true">↓ ${dist}</li>` : '';
}
function dayAction(act, dayId, extra) {
  const tr = trip(), d = tr.days.find(x => x.id === dayId); if (!d) return;
  const snap = snapshot(tr);
  if (act === 'sort') {
    const next = sortItemsByTime(d.items);
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
      <span class="toolbar-group">${todayDay(tr) ? `<button id="jump-today" class="text-btn">${t('Today')}</button>` : ''}<button id="csv-open" class="text-btn">CSV</button><button id="add-day" class="text-btn">+ ${t('Add day')}</button></span>
    </div>
    ${(() => { const qd = todayDay(tr) || tr.days.find(d => open.has(d.id)) || tr.days[0]; return qd && typeof discoveryButtons === 'function' ? `<div class="discover-quick"><small class="user-text">${discoveryLabel('Near', '附近')} · Day ${tr.days.indexOf(qd) + 1}${qd.place ? ' · ' + esc(qd.place) : ''}</small>${discoveryButtons(qd)}</div>` : ''; })()}
    ${tr.days.some(d => d.items.length) ? `<p class="swipe-hint">${t('Tap a stop to edit · swipe right to remove')}</p>` : ''}
    ${tr.days.length ? tr.days.map((d, i) => dayCard(tr, d, i, open.has(d.id))).join('') : `<p class="empty">No stops yet</p>`}`;
  $('#view').querySelectorAll('[data-discovery]').forEach(b => b.onclick = () => discover(tr, b.dataset.day, b.dataset.discovery));
  $('#expand-all').onclick = () => { tr.days.forEach(d => open.add(d.id)); renderDaysTab(); };
  $('#collapse-all').onclick = () => { open.clear(); renderDaysTab(); $('#view').scrollTo({ top: 0 }); };
  $('#jump-today')?.addEventListener('click', () => { const td = todayDay(tr); open.add(td.id); renderDaysTab(); document.getElementById('day-' + td.id)?.scrollIntoView({ block: 'start' }); });
  $('#csv-open').onclick = () => csvSheet(tr);
  $('#add-day').onclick = () => {
    const last = tr.days[tr.days.length - 1];
    const d = { id: uid('d'), date: last ? addDays(last.date, 1) : todayIso(), title: '', place: '', items: [] };
    tr.days.push(d); open.add(d.id); saveDb(); renderDaysTab();
    document.getElementById('day-' + d.id)?.scrollIntoView({ block: 'center' });
  };
}

function dayCard(tr, d, i, isOpen) {
  const color = DAY_COLORS[i % DAY_COLORS.length], spots = daySpots(tr, d), route = gmapsRouteUrl(spots);
  const isToday = d.date === todayIso();
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
          <div class="stop-in has-reorder" data-edit-item="${esc(d.id)}|${esc(it.id)}" data-stop="${esc(d.id)}|${esc(it.id)}">
          <span class="stop-time user-text">${esc(it.time)}</span>
          <div class="stop-main">
            <button class="stop-title user-text" data-edit-item="${esc(d.id)}|${esc(it.id)}">${s ? `<span class="cat-badge sm" style="--c:${CATS[s.cat]?.color || color}" title="${esc(CATS[s.cat]?.label || '')}">${catIcon(s.cat, 12)}</span>` : ''}<span>${esc(L(it, 'title') || '—')}</span></button>
            ${it.note ? `<p class="user-text">${esc(L(it, 'note')).replace(/\n/g, '<br>')}</p>` : ''}
            ${s ? `<div class="chips-row"><a class="chip" href="#/trip/${esc(tr.id)}/map" data-focus-spot="${esc(s.id)}"><em class="cat-mini" style="--c:${CATS[s.cat]?.color || color}">${catIcon(s.cat, 15)}</em><span class="user-text">${esc(L(s, 'name'))}</span></a>
              <a class="chip" target="_blank" rel="noopener" href="${esc(gmapsDirectionsUrl(s))}">${t('Directions')}</a></div>` : ''}
          </div><span class="reorder"><span class="drag-handle" role="button" tabindex="0" data-drag="${esc(d.id)}|${esc(it.id)}" aria-label="${t('Drag to reorder')}" title="${t('Drag to reorder')}">⠿</span><button type="button" class="stop-del-btn" data-del-item="${esc(d.id)}|${esc(it.id)}" aria-label="${t('Remove')}" title="${t('Remove')}">${TRASH}</button></span></div></li>`; }).join('')}</ol>` : `<p class="muted">No stops yet</p>`}
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
  const tr = trip(), d = tr.days.find(x => x.id === dayId), pending = { spot: null };
  const it = itemId ? d.items.find(x => x.id === itemId) : { time: '', title: '', note: '', spotId: '' };
  openSheet({
    title: itemId ? 'Edit stop' : 'Add stop', submit: 'Save',
    body: `<div class="pair pair-time"><label>Time<input name="time" maxlength="40" value="${esc(it.time)}" placeholder="09:00"></label>
      <label>Title<input name="title" required maxlength="160" value="${esc(it.title)}"></label></div>
      <label>Notes<textarea name="note" rows="3" maxlength="1500">${esc(it.note)}</textarea></label>
      <div class="place-pick" id="place-pick"><label for="pp-q">${t('Map place')}</label>
        <input type="hidden" name="spotId" value="${esc(it.spotId || '')}">
        <div class="pp-chip" id="pp-chip" hidden></div>
        <input id="pp-q" class="pp-q" type="search" autocomplete="off" autocapitalize="off" enterkeyhint="search" placeholder="${esc(t('Search saved places, or type a new one'))}">
        <ul class="pp-list" id="pp-list" role="listbox" hidden></ul>
        <small class="field-hint">${t('Links this stop to a pin on the map. Leave empty for a plain stop.')}</small></div>
      <label>Day<select name="dayId">${tr.days.map((x, i) => `<option value="${esc(x.id)}" ${x.id === dayId ? 'selected' : ''}>Day ${i + 1} · ${esc(fmtDate(x.date))}</option>`).join('')}</select></label>
      <p class="field-hint">${itemId ? t('Reorder: drag the ⠿ handle on the Days tab. Remove: tap the bin or swipe the stop to the right.') : ''}</p>`,
    onOpen: root => { placePicker(root, tr, pending); if (!itemId) root.querySelector('[name=title]').focus(); },
    onSubmit: f => {
      const title = f.get('title').trim(); if (!title) return sheetError('A name is required.');
      if (pending.spot && f.get('spotId') === pending.spot.id) tr.spots.push(pending.spot); // a place created in the picker is only kept when the stop is saved
      Object.assign(it, { time: f.get('time').trim(), title, note: f.get('note').trim(), spotId: f.get('spotId') });
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


/* ================= PLACE PICKER (stop editor) =================
   Replaces the long dropdown. Type to filter saved places; with nothing typed it suggests places named in the stop's
   title or notes, then this day's places. If nothing fits, add the typed name as a new place, or search the map for it
   (OpenStreetMap) and keep the result with its pin. A new place is only saved when the stop is saved. */
function placePicker(root, tr, pending) {
  const box = root.querySelector('#place-pick'), hid = box.querySelector('[name=spotId]'), chip = box.querySelector('#pp-chip'),
    q = box.querySelector('#pp-q'), list = box.querySelector('#pp-list');
  const norm = s => String(s || '').normalize('NFKC').toLowerCase();
  const field = n => root.querySelector(`[name=${n}]`)?.value || '';
  const all = () => (pending.spot ? [pending.spot] : []).concat(tr.spots);
  const byId = id => all().find(x => x.id === id);
  const label = s => `<span class="pp-ico" style="--c:${CATS[s.cat]?.color || '#5b6472'}">${catIcon(s.cat, 16)}</span><span class="pp-txt"><strong class="user-text">${esc(s.name)}</strong><small class="user-text">${esc([s.city, hasCoords(s) ? '' : t('no pin')].filter(Boolean).join(' · '))}</small></span>`;
  let rows = [], act = -1, token = 0, found = null;

  const paintChip = () => {
    const s = byId(hid.value);
    chip.hidden = !s; q.hidden = !!s;
    if (s) chip.innerHTML = `<button type="button" class="pp-main" data-pp="change" aria-label="${esc(t('Change place'))}">${label(s)}</button><button type="button" class="pp-x" data-pp="clear" aria-label="${esc(t('Clear place'))}">✕</button>`;
  };
  const choose = s => { hid.value = s.id; q.value = ''; found = null; hide(); paintChip(); };
  const hide = () => { list.hidden = true; act = -1; };

  const hits = text => { // saved places named in the stop's title / notes, best first
    const hay = norm(text); if (!hay.trim()) return [];
    return tr.spots.map(s => {
      const names = [s.name, s.jp].map(norm).filter(Boolean);
      let score = names.some(n => n.length > 2 && hay.includes(n)) ? 3 : 0;
      score += new Set(names.join(' ').split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 3 && hay.includes(w))).size;
      return { s, score };
    }).filter(x => x.score).sort((a, b) => b.score - a.score).map(x => x.s);
  };
  const dayNow = () => field('dayId') || tr.days[0]?.id;
  const render = () => {
    const query = norm(q.value).trim(), dayId = dayNow(), out = [], seen = new Set(), add = (head, arr) => {
      const fresh = arr.filter(s => !seen.has(s.id)); if (!fresh.length) return;
      out.push({ head }); fresh.forEach(s => { seen.add(s.id); out.push({ s }); });
    };
    if (query) {
      const rank = s => { const n = norm(s.name), j = norm(s.jp), c = norm(s.city); return n.startsWith(query) || j.startsWith(query) ? 0 : n.includes(query) || j.includes(query) ? 1 : c.includes(query) ? 2 : 9; };
      const m = all().filter(s => rank(s) < 9).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)).slice(0, 8);
      m.forEach(s => out.push({ s }));
      if (!m.length) out.push({ note: t('No saved place matches.') });
      out.push({ act: 'new' }, { act: 'find' });
      if (found) out.push(...found);
    } else {
      add(t('Suggested'), hits(`${field('title')} ${field('note')}`).slice(0, 3));
      add(t('This day'), tr.spots.filter(s => s.days.includes(dayId)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 6));
      const rest = tr.spots.filter(s => !seen.has(s.id)).sort((a, b) => a.name.localeCompare(b.name));
      if (rest.length) { out.push({ head: `${t('All places')} (${rest.length})` }); rest.slice(0, 5).forEach(s => out.push({ s })); if (rest.length > 5) out.push({ note: t('Type to search the rest.') }); }
      if (!out.length) out.push({ note: t('No saved places yet. Type a name to add one.') });
    }
    rows = out.filter(r => r.s || r.act || r.hit);
    let n = -1;
    list.innerHTML = out.map(r => {
      if (r.head) return `<li class="pp-head" role="presentation">${esc(r.head)}</li>`;
      if (r.note) return `<li class="pp-note" role="presentation">${esc(r.note)}</li>`;
      n++;
      if (r.s) return `<li role="option"><button type="button" class="pp-row" data-i="${n}">${label(r.s)}</button></li>`;
      if (r.hit) return `<li role="option"><button type="button" class="pp-row" data-i="${n}"><span class="pp-ico">📍</span><span class="pp-txt"><strong>${esc(r.hit.name)}</strong><small>${esc(r.hit.label)}</small></span></button></li>`;
      const text = q.value.trim();
      return `<li role="option"><button type="button" class="pp-row pp-act" data-i="${n}"><span class="pp-ico">${r.act === 'new' ? '＋' : '🔎'}</span><span class="pp-txt"><strong>${r.act === 'new' ? esc(t('Add as a new place')) : esc(t('Find on the map'))}: “${esc(text)}”</strong><small>${r.act === 'new' ? esc(t('No pin yet. You can set it later.')) : esc(t('Searches OpenStreetMap and keeps the pin.'))}</small></span></button></li>`;
    }).join('');
    list.hidden = false; if (act >= rows.length) act = -1;
    mark();
  };
  const mark = () => list.querySelectorAll('.pp-row').forEach((b, i) => b.classList.toggle('on', i === act));
  const guessCat = text => /ramen|拉麵|ラーメン|lunch|dinner|restaurant|cafe|café|sushi|yakiniku|izakaya|beef|food|食/i.test(`${text} ${field('title')}`) ? 'food' : 'sights';
  const create = (name, extra = {}) => {
    pending.spot = { id: uid('p'), name: name.slice(0, 160), jp: '', city: '', cat: guessCat(name), lat: NaN, lon: NaN, note: '', hours: '', link: '', gmaps: '', days: [], ...extra };
    choose(pending.spot);
  };
  const run = async i => {
    const r = rows[i]; if (!r) return;
    if (r.s) return choose(r.s);
    if (r.hit) { const x = r.hit; return create(x.name, { lat: x.lat, lon: x.lon, city: x.label.split(',').map(z => z.trim()).find((z, k) => k > 0 && /[市町村区]|city|ward/i.test(z)) || '' }); }
    if (r.act === 'new') return create(q.value.trim());
    if (r.act === 'find') {
      const my = ++token, text = q.value.trim(); found = [{ note: t('Searching…') }]; render();
      try { const res = await geocode(text); if (my !== token) return; found = res.length ? res.map(hit => ({ hit })) : [{ note: t('No results. Try the Japanese name or add the city.') }]; }
      catch (e) { if (my !== token) return; found = [{ note: t(e.message) }]; }
      render();
    }
  };
  // keep focus in the field while a row is tapped (iOS does not focus buttons), so the list is not hidden before the tap lands
  list.addEventListener('pointerdown', e => e.preventDefault());
  list.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) run(Number(b.dataset.i)); });
  chip.addEventListener('click', e => {
    const b = e.target.closest('[data-pp]'); if (!b) return;
    if (b.dataset.pp === 'clear') { hid.value = ''; paintChip(); }
    else { hid.value = ''; paintChip(); q.focus(); }
  });
  q.addEventListener('focus', () => { render(); setTimeout(() => list.scrollIntoView({ block: 'nearest' }), 0); });
  q.addEventListener('input', () => { token++; found = null; act = -1; render(); });
  q.addEventListener('blur', () => setTimeout(hide, 120));
  q.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (list.hidden) render(); if (rows.length) { act = (act + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length; mark(); list.querySelectorAll('.pp-row')[act]?.scrollIntoView({ block: 'nearest' }); } }
    else if (e.key === 'Enter') { e.preventDefault(); if (act >= 0) run(act); else if (rows.length && q.value.trim()) run(0); } // Enter must not submit the whole stop form
    else if (e.key === 'Escape' && !list.hidden) { e.preventDefault(); e.stopPropagation(); hide(); } // close the list, not the whole sheet
  });
  paintChip();
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

/* ================= DRAG TO REORDER =================
   Days tab → Reorder: hold the ⠿ handle and drag a stop up or down within its day; the others slide out of the way and
   the order is saved on release. Arrow Up / Down on a focused handle does the same for keyboard users. */
function wireDrag() {
  let g = null;
  document.addEventListener('click', e => { if (e.target.closest('.drag-handle')) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.body.addEventListener('keydown', e => {
    const h = e.target.closest?.('.drag-handle'); if (!h || !['ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault(); const [a, b] = h.dataset.drag.split('|'); moveItem(a, b, e.key === 'ArrowUp' ? -1 : 1);
    document.querySelector(`[data-drag="${h.dataset.drag}"]`)?.focus();
  });
  const update = () => {
    const dy = (g.y - g.y0) + ((g.sc ? g.sc.scrollTop : 0) - g.s0);
    g.li.style.transform = `translateY(${dy}px)`;
    const c = g.rects[g.from].top + g.rects[g.from].h / 2 + dy; let to = g.from;
    g.rects.forEach((r, i) => { const m = r.top + r.h / 2; if (i < g.from && c < m) to = Math.min(to, i); if (i > g.from && c > m) to = Math.max(to, i); });
    g.to = to;
    g.lis.forEach((x, i) => { if (x !== g.li) x.style.transform = to > g.from && i > g.from && i <= to ? `translateY(${-g.shift}px)` : to < g.from && i >= to && i < g.from ? `translateY(${g.shift}px)` : ''; });
  };
  const tick = () => {
    if (!g) return;
    if (g.sc) { const r = g.sc.getBoundingClientRect(); if (g.y < r.top + 70) g.sc.scrollTop -= 12; else if (g.y > r.bottom - 70) g.sc.scrollTop += 12; }
    update(); g.raf = requestAnimationFrame(tick);
  };
  document.body.addEventListener('pointerdown', e => {
    const h = e.target.closest('.drag-handle'); if (!h || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const li = h.closest('li.stop'), ol = li && li.parentElement; if (!li || !ol) return;
    const lis = [...ol.children].filter(x => x.classList.contains('stop')), from = lis.indexOf(li), sc = $('#view'), s0 = sc ? sc.scrollTop : 0;
    const rects = lis.map(x => { const r = x.getBoundingClientRect(); return { top: r.top + s0, h: r.height }; });
    const gap = lis.length < 2 ? 0 : from < lis.length - 1 ? rects[from + 1].top - rects[from].top - rects[from].h : rects[from].top - rects[from - 1].top - rects[from - 1].h;
    g = { id: e.pointerId, h, li, ol, lis, rects, from, to: from, y0: e.clientY, y: e.clientY, s0, sc, shift: rects[from].h + gap, raf: 0 };
    try { h.setPointerCapture(e.pointerId); } catch {}
    li.classList.add('dragging'); ol.classList.add('drag-on'); g.raf = requestAnimationFrame(tick);
  });
  document.body.addEventListener('pointermove', e => { if (g && e.pointerId === g.id) g.y = e.clientY; });
  const end = e => {
    if (!g || e.pointerId !== g.id) return;
    const { h, li, ol, lis, from, to, sc } = g; cancelAnimationFrame(g.raf); g = null; lastSwipe = Date.now();
    li.classList.remove('dragging'); ol.classList.remove('drag-on'); lis.forEach(x => { x.style.transform = ''; });
    if (e.type === 'pointercancel' || to === from) return;
    const [dId] = h.dataset.drag.split('|'), d = trip().days.find(x => x.id === dId); if (!d) return;
    const top = sc ? sc.scrollTop : 0, [it] = d.items.splice(from, 1); d.items.splice(to, 0, it);
    saveDb(); renderDaysTab(); if (sc) sc.scrollTop = top;
    document.querySelector(`[data-drag="${h.dataset.drag}"]`)?.focus({ preventScroll: true });
  };
  document.body.addEventListener('pointerup', end);
  document.body.addEventListener('pointercancel', end);
}

/* ================= GLOBAL WIRING ================= */
document.addEventListener('DOMContentLoaded', () => {
  loadDb();
  document.body.addEventListener('click', e => {
    const el = e.target.closest('[data-trip-menu],[data-toggle-day],[data-edit-day],[data-add-item],[data-edit-item],[data-focus-spot],[data-mv],[data-del-item],[data-opt],[data-sort],[data-del-day]');
    if (!el) return;
    const ds = el.dataset;
    if (ds.tripMenu) tripMenu(ds.tripMenu);
    else if (ds.toggleDay) { const s = openSet(); s.has(ds.toggleDay) ? s.delete(ds.toggleDay) : s.add(ds.toggleDay); renderDaysTab(); }
    else if (ds.editDay) dayForm(ds.editDay);
    else if (ds.addItem) itemForm(ds.addItem);
    else if (ds.delDay) deleteDay(ds.delDay);
    else if (ds.editItem) { if (e.target.closest('a')) return; const [dId, iId] = ds.editItem.split('|'); itemForm(dId, iId); } // anywhere on the row opens the editor, except links
    else if (ds.mv) { const [a, b, c] = ds.mv.split('|'); moveItem(a, b, Number(c)); }
    else if (ds.delItem) { const [a, b] = ds.delItem.split('|'); removeItem(a, b); }
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
  wireDrag();
  window.addEventListener('hashchange', route);
  window.addEventListener('langchange', () => { if (!$('#sheet').open) route(); });
  route();
  if (typeof syncInit === 'function') syncInit();
});
