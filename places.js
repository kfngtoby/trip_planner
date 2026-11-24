'use strict';
/* Overview map (Leaflet + OpenStreetMap tiles), place details & editor, Xiaohongshu import. */

let lmap = null, markers = new Map(), mapDay = 'all', placeQuery = '', pendingFocus = null, pickCallback = null, activeSpotId = null;
let routeMode = false, routeSeq = [], routeTravel = 'driving'; // numbered-route tool: ids of places in the order they were tapped
const activeSubs = new Set(); // fashion styles switched on (empty = no style filter)
const activeCats = new Set(); // categories switched on in the Overview legend (empty = show every category)

// store.js has a text helper called L(), which hides Leaflet's global L in every later script. That broke the map in v25.
// Always reach Leaflet through window.L.
const leaflet = () => (window.L && typeof window.L.map === 'function' ? window.L : null);
function destroyMap() { if (lmap) { lmap.remove(); lmap = null; markers.clear(); } if (typeof reco !== 'undefined') reco.layer = null; locate.dot = null; pickCallback = null; activeSpotId = null; routeMode = false; routeSeq = []; }

/* ---------- weeks: Week 1 = trip days 1–7, Week 2 = days 8–14, Week 3 = days 15–21 ... ---------- */
const weekCount = tr => Math.ceil(tr.days.length / 7);
const weekDays = (tr, w) => tr.days.slice(w * 7, w * 7 + 7);
const weekOfDay = (tr, id) => { const i = tr.days.findIndex(d => d.id === id); return i < 0 ? -1 : Math.floor(i / 7); };
const activeWeek = tr => /^w\d+$/.test(mapDay) ? +mapDay.slice(1) : weekOfDay(tr, mapDay);
function dayFilter(tr) {
  if (mapDay === 'all') return () => true;
  if (mapDay === 'none') return s => !s.days.length;
  if (/^w\d+$/.test(mapDay)) { const ids = new Set(weekDays(tr, +mapDay.slice(1)).map(d => d.id)); return s => s.days.some(id => ids.has(id)); }
  return s => s.days.includes(mapDay);
}

function filteredSpots(tr, ignoreCats = false) {
  const q = placeQuery.trim().toLowerCase(), dayOk = dayFilter(tr);
  return tr.spots.filter(s =>
    dayOk(s) &&
    (ignoreCats || (activeSubs.size ? (s.subs || []).some(x => activeSubs.has(x)) : (!activeCats.size || activeCats.has(s.cat)))) &&
    (!q || `${s.name} ${s.jp} ${s.city} ${s.note}`.toLowerCase().includes(q)));
}

// Big tap-to-toggle category chips: "+" adds a category, "−" removes it.
function renderLegend() {
  const tr = trip(), el = $('#cat-legend'); if (!el) return;
  const base = filteredSpots(tr, true), present = Object.keys(CATS).filter(k => base.some(s => s.cat === k));
  [...activeCats].forEach(k => { if (!present.includes(k)) activeCats.delete(k); });
  el.innerHTML = present.map(k => {
    const on = activeCats.has(k);
    return `<button type="button" class="cat-chip" data-cat="${k}" aria-pressed="${on}" style="--c:${CATS[k].color}">
      <b class="cat-badge">${catIcon(k, 14)}</b><span class="cat-name">${esc(CATS[k].label)}</span><small>${base.filter(s => s.cat === k).length}</small></button>`;
  }).join('') + `<button type="button" class="cat-act" data-find="shop">${discoveryLabel('Find Nearby', '搜尋附近')}</button>${present.length ? `<button type="button" class="cat-act ghost" data-cat-none ${activeCats.size ? '' : 'disabled'}>${discoveryLabel('Clear', '清除')}</button>` : ''}`;
}

const spotDayTags = (tr, s) => s.days.map(did => { const i = tr.days.findIndex(d => d.id === did); return i < 0 ? '' : `<span class="tag" style="--c:${dayColor(tr, did)}">Day ${i + 1}</span>`; }).join('');

// Compact row (no category selected) and full detail card (category selected)
function placeRow(tr, s) {
  return `<li><button class="place-row" data-open-place="${esc(s.id)}">
      <span class="cat-badge" style="--c:${spotColor(tr, s)}">${catIcon(s.cat, 18)}</span>
      <span class="place-text"><strong class="user-text">${esc(L(s, 'name'))}</strong>
        <small><span class="user-text">${esc(s.city)}</span>${s.city ? ' · ' : ''}<span>${esc(CATS[s.cat]?.label || '')}</span>${hasCoords(s) ? '' : ` · <em>${t('No location yet')}</em>`}</small></span>
      <span class="chev-r" aria-hidden="true">›</span></button></li>`;
}
function placeDetail(tr, s) {
  const tags = spotDayTags(tr, s);
  return `<li class="place-item">
    <strong class="pi-name user-text">${esc(L(s, 'name'))}</strong>
    ${s.jp && s.jp !== s.name ? `<span class="pi-jp user-text">${esc(s.jp)}</span>` : ''}
    <span class="pi-meta">${s.city ? `<span class="user-text">${esc(s.city)}</span>` : ''}${s.city && !hasCoords(s) ? ' · ' : ''}${hasCoords(s) ? '' : `<em>${t('No location yet')}</em>`}</span>
    ${tags ? `<div class="tags">${tags}</div>` : ''}
    ${(s.subs || []).length ? `<div class="tags subs">${s.subs.map(k => `<span class="tag sub">${esc(subLabel(k))}</span>`).join('')}</div>` : ''}
    ${s.note ? `<p class="pi-note user-text">${esc(L(s, 'note')).replace(/\n/g, '<br>')}</p>` : ''}
    ${s.hours ? `<p class="pi-hours"><span>${t('Hours')}</span>: <span class="user-text">${esc(L(s, 'hours'))}</span></p>` : ''}
    <div class="pi-actions">
      ${hasCoords(s) ? `<button type="button" data-open-place="${esc(s.id)}">${t('On map')}</button>` : ''}
      <a class="btn" target="_blank" rel="noopener" href="${esc(gmapsDirectionsUrl(s))}">${t('Directions')}</a>
      <button type="button" data-place-more="${esc(s.id)}">${t('Details')}</button>
    </div></li>`;
}

// Fashion guide: appears when the Fashion chip is on. Helps people who don't know what to look for.
function renderFashionGuide() {
  const el = $('#fashion-guide'); if (!el) return;
  const tr = trip();
  if (!activeCats.has('fashion') && !activeSubs.size) { el.innerHTML = ''; el.hidden = true; drawRecoMarkers(tr); return; }
  el.hidden = false;
  const zh = typeof language !== 'undefined' && language === 'zh';
  const count = k => tr.spots.filter(s => (s.subs || []).includes(k)).length;
  const chips = SUB_GROUPS.map(g => `<div class="fg-group"><h4>${esc(zh ? g.zh : g.en)}</h4><div class="fg-chips">${g.subs.map(k =>
    `<button type="button" class="fg-chip" data-sub="${k}" aria-pressed="${activeSubs.has(k)}">${esc(subLabel(k))}${count(k) ? `<small>${count(k)}</small>` : ''}</button>`).join('')}</div></div>`).join('');
  const starters = `<div class="fg-group"><h4>${t('Quick start: pick a vibe')}</h4><div class="fg-chips">${FASHION_STARTERS.map((x, i) =>
    `<button type="button" class="fg-chip" data-starter="${i}">${esc(zh ? x.zh : x.en)}</button>`).join('')}</div></div>`;
  const cards = [...activeSubs].map(k => { const v = FASHION_SUBS[k]; if (!v) return '';
    const q = encodeURIComponent(v.jp.split(' / ')[0]);
    return `<div class="fg-card"><strong>${esc(subLabel(k))}</strong>
      <p>${esc(zh ? v.what_zh : v.what)}</p>
      <p><span>${t('Search in Japanese')}</span>: <b class="user-text">${esc(v.jp)}</b></p>
      <p><span>${t('Typical brands')}</span>: ${esc(v.brands)}</p>
      <p><span>${t('Typical price')}</span>: ${esc(v.budget)}</p>
      ${v.tokyo ? `<p><span>${t('In Tokyo')}</span>: ${esc(zh && v.tokyo_zh ? v.tokyo_zh : v.tokyo)}</p>` : ''}
      <p class="fg-tip">${esc(zh && v.tip_zh ? v.tip_zh : v.tip)}</p>
      <a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${q}">${t('Find nearby in Google Maps')}</a></div>`; }).join('');
  el.innerHTML = `${recoHtml(tr)}<h3>${t('Not sure what to look for? Pick a style')}</h3>${starters}${chips}${cards}
    ${activeSubs.size ? `<button type="button" class="fg-clear" data-sub-clear>${t('Clear styles')}</button>` : ''}`;
  drawRecoMarkers(tr);
}

function overviewDay(tr) {
  const byId = tr.days.find(d => d.id === mapDay);
  if (byId) return byId;
  if (/^w\d+$/.test(mapDay)) { const ds = weekDays(tr, +mapDay.slice(1)); if (ds.length) return ds[0]; }
  return todayDay(tr) || tr.days[0] || null;
}
function renderMapTab() {
  const tr = trip();
  if (mapDay !== 'all' && mapDay !== 'none' && !tr.days.some(d => d.id === mapDay) && !(/^w\d+$/.test(mapDay) && +mapDay.slice(1) < weekCount(tr))) mapDay = 'all';
  $('#view').innerHTML = `
    <div class="map-shell">
      <div id="map" aria-label="${t('Interactive trip map')}"></div>
      <div class="map-ctrls"><button id="fit-map" class="map-btn">${t('Fit all')}</button><button id="route-toggle" class="map-btn route-toggle" type="button" role="switch" aria-checked="false" aria-pressed="false" aria-label="${t('Numbered route')}"><span class="rt-ico" aria-hidden="true">1·2·3</span></button><button id="map-style" class="map-btn" type="button"></button><button id="locate" class="map-btn" aria-label="${t('Show my location')}">⌖</button></div>
      <div id="route-panel" class="route-panel" hidden></div>
      <p id="map-status" class="map-status" role="status"></p>
      <div id="spot-card" class="spot-card" role="dialog" aria-label="${t('Place description')}" hidden></div>
    </div>
    <div class="week-bar" id="week-bar" role="group" aria-label="${t('Filter by day')}"></div>
    <div class="cat-toggle" id="cat-legend" role="group" aria-label="${t('Categories')}"></div>
    <label class="search"><span class="sr-only">${t('Search')}</span><input id="place-search" type="search" placeholder="${t('Search')}" value="${esc(placeQuery)}" aria-label="${t('Search spots')}"></label>
    <div class="fashion-guide" id="fashion-guide" hidden></div>
    <div id="place-list" class="place-list"></div>`;

  $('#place-search').oninput = e => { placeQuery = e.target.value; refreshPlaces(); };
  renderWeekBar();
  $('#week-bar').onclick = e => {
    const b = e.target.closest('[data-week],[data-pos]'); if (!b) return;
    if (b.dataset.week) mapDay = b.dataset.week;
    else { const w = activeWeek(tr), pos = +b.dataset.pos; mapDay = pos ? weekDays(tr, w)[pos - 1].id : 'w' + w; }
    reco.showAll = false; renderWeekBar(); refreshPlaces(true);
  };
  $('#week-bar').oninput = e => {
    if (e.target.id !== 'day-range') return;
    const w = activeWeek(tr), pos = +e.target.value; mapDay = pos ? weekDays(tr, w)[pos - 1].id : 'w' + w;
    updateSliderMarks(); refreshPlaces(false);
  };
  $('#week-bar').onchange = e => { if (e.target.id === 'day-range') fitMap(); };
  wireReco($('#fashion-guide'), tr);
  $('#fashion-guide').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.starter) { activeSubs.clear(); FASHION_STARTERS[+b.dataset.starter].subs.forEach(k => activeSubs.add(k)); activeCats.add('fashion'); }
    else if (b.dataset.sub) { activeSubs.has(b.dataset.sub) ? activeSubs.delete(b.dataset.sub) : activeSubs.add(b.dataset.sub); activeCats.add('fashion'); }
    else if (b.hasAttribute('data-sub-clear')) activeSubs.clear();
    else return;
    refreshPlaces(true);
  };
  $('#cat-legend').onclick = e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.cat) { activeCats.has(b.dataset.cat) ? activeCats.delete(b.dataset.cat) : activeCats.add(b.dataset.cat); if (!activeCats.has('fashion')) activeSubs.clear(); }
    else if (b.dataset.find) { const d = overviewDay(tr); if (!d) { toast(t('Add a day first')); return; } discover(tr, d.id, b.dataset.find); return; }
    else if (b.hasAttribute('data-cat-none')) { activeCats.clear(); activeSubs.clear(); }
    else return;
    refreshPlaces(true);
  };
  $('#place-list').onclick = e => {
    const more = e.target.closest('[data-place-more]'); if (more) return placeSheet(more.dataset.placeMore);
    const b = e.target.closest('[data-open-place]'); if (b) openSpot(b.dataset.openPlace);
  };
  $('#fit-map').onclick = () => fitMap();
  $('#locate').onclick = locate;
  $('#route-toggle').onclick = () => { routeMode = !routeMode; if (routeMode) hideSpotCard(); updatePins(); renderRoutePanel(); };
  $('#route-panel').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-rp-clear')) routeSeq = [];
    else if (b.dataset.rpRm) routeSeq = routeSeq.filter(id => id !== b.dataset.rpRm);
    else if (b.dataset.rpMode) routeTravel = b.dataset.rpMode;
    else return;
    updatePins(); renderRoutePanel();
  };

  const lf = leaflet();
  if (!lf) { $('#map-status').textContent = t('Map unavailable. Use the places list and Google Maps directions.'); $('#map-style').hidden = true; }
  else {
    lmap = lf.map('map', { zoomControl: false, attributionControl: true }).setView([34.9, 134.2], 7);
    // CARTO now serves "API KEY REQUIRED" placeholder tiles (they load fine, so no tileerror), so both styles use OpenStreetMap.
    // Default is the same tiles, muted with CSS (.base-muted). "Streets" shows them in full colour.
    const OSM = cls => lf.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: cls, attribution: '© OpenStreetMap contributors' });
    let baseKey='light', base=null;
    try { const k=localStorage.getItem('trips.map'); if (k==='streets'||k==='normal') baseKey='normal'; } catch {}
    const setBase=key=>{
      if (base && baseKey===key) return;
      if (base) lmap.removeLayer(base);
      baseKey=key; base=OSM(key==='light'?'base-muted':'').addTo(lmap);
      $('#map').dataset.base=key;
      try { localStorage.setItem('trips.map',key); } catch {}
      const sb=$('#map-style'), name=key==='light'?t('Light Map'):t('Normal Map');
      sb.textContent=name; sb.setAttribute('aria-label',`${t('Map style')}: ${name}`);
    };
    setBase(baseKey);
    $('#map-style').onclick=()=>setBase(baseKey==='light'?'normal':'light'); // one button, tap to switch
    lf.control.zoom({ position: 'bottomright' }).addTo(lmap);
    lmap.on('click', e => { if (pickCallback) { const cb = pickCallback; pickCallback = null; $('#map-status').textContent = ''; cb(e.latlng); } else hideSpotCard(); });
    lmap.on('move zoom resize', positionSpotCard);
    $('#spot-card').onclick = e => {
      if (e.target.closest('.spot-x')) hideSpotCard();
      else if (e.target.closest('[data-spot-more]')) placeSheet(activeSpotId);
    };
  }
  refreshPlaces(true);
  if (pendingFocus) { const id = pendingFocus; pendingFocus = null; setTimeout(() => openSpot(id), 50); }
}

function renderWeekBar() {
  const tr = trip(), el = $('#week-bar'); if (!el) return;
  const n = weekCount(tr), w = activeWeek(tr), today = todayIso(), zh = typeof language !== 'undefined' && language === 'zh';
  const range = days => {
    if (!days.length) return '';
    const a = days[0].date, z = days[days.length - 1].date;
    if (zh) return `${fmtDate(a, { day: 'numeric', month: 'numeric' })}–${fmtDate(z, { day: 'numeric', month: 'numeric' })}`;
    return a.slice(0, 7) === z.slice(0, 7) ? `${+a.slice(8)}–${fmtDate(z, { day: 'numeric', month: 'short' })}` : `${fmtDate(a, { day: 'numeric', month: 'short' })}–${fmtDate(z, { day: 'numeric', month: 'short' })}`;
  };
  const tabs = [`<button type="button" data-week="all" aria-pressed="${mapDay === 'all'}">${t('All days')}</button>`,
    ...Array.from({ length: n }, (_, i) => { const ds = weekDays(tr, i), hasToday = ds.some(d => d.date === today);
      return `<button type="button" data-week="w${i}" aria-pressed="${w === i}"><b>${zh ? `第 ${i + 1} 週` : `Week ${i + 1}`}</b><small>${esc(range(ds))}</small>${hasToday ? '<i class="today-dot" aria-label="Today"></i>' : ''}</button>`; }),
    tr.spots.some(s => !s.days.length) ? `<button type="button" data-week="none" aria-pressed="${mapDay === 'none'}">${t('Unassigned day')}</button>` : ''].join('');
  let slider = '';
  if (w >= 0) {
    const ds = weekDays(tr, w), pos = /^w\d+$/.test(mapDay) ? 0 : ds.findIndex(d => d.id === mapDay) + 1;
    slider = `<div class="day-slider" style="--n:${ds.length}">
      <input type="range" id="day-range" min="0" max="${ds.length}" step="1" value="${pos}" aria-label="${t('Day in this week')}">
      <div class="ticks">${[`<button type="button" data-pos="0" aria-pressed="${pos === 0}"><b>${t('Week')}</b><small>${t('all')}</small></button>`,
        ...ds.map((d, k) => { const i = w * 7 + k; return `<button type="button" data-pos="${k + 1}" aria-pressed="${pos === k + 1}" style="--c:${DAY_COLORS[i % DAY_COLORS.length]}"><b>${i + 1}</b><small>${esc(fmtDate(d.date, { weekday: 'short' }))}</small>${d.date === today ? '<i class="today-dot" aria-label="Today"></i>' : ''}</button>`; })].join('')}</div>
      <p class="slider-label" id="slider-label"></p></div>`;
  }
  el.innerHTML = `<div class="week-tabs">${tabs}</div>${slider}`;
  updateSliderMarks();
}
function updateSliderMarks() {
  const tr = trip(), w = activeWeek(tr), lab = $('#slider-label'); if (w < 0 || !lab) return;
  const ds = weekDays(tr, w), pos = /^w\d+$/.test(mapDay) ? 0 : ds.findIndex(d => d.id === mapDay) + 1;
  $$('#week-bar [data-pos]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.pos === pos)));
  const r = $('#day-range'); if (r && +r.value !== pos) r.value = pos;
  r?.style.setProperty('--c', pos ? DAY_COLORS[(w * 7 + pos - 1) % DAY_COLORS.length] : 'var(--accent)');
  if (!pos) { lab.innerHTML = `<span>${t('Whole week')}</span> · ${ds.length} <span>${t('Days')}</span>`; return; }
  const d = ds[pos - 1];
  lab.innerHTML = `<b>Day ${w * 7 + pos}</b> · <span>${esc(fmtDate(d.date))}</span>${L(d, 'title') || L(d, 'place') ? ` · <span class="user-text">${esc(L(d, 'place') || L(d, 'title'))}</span>` : ''}`;
}

function refreshPlaces(refit = false) {
  const tr = trip(), spots = filteredSpots(tr);

  renderLegend();
  renderFashionGuide();
  const detail = activeCats.size > 0;
  const groups = Object.keys(CATS).map(k => [k, spots.filter(s => s.cat === k)]).filter(([, a]) => a.length);
  $('#place-list').innerHTML = groups.length ? groups.map(([k, arr]) => `
    <section class="cat-group ${detail ? 'detailed' : ''}" style="--c:${CATS[k].color}">
      <h3 class="cat-group-head"><b class="cat-badge">${catIcon(k, 20)}</b><span>${esc(CATS[k].label)}</span><small>${arr.length}</small></h3>
      <ul>${arr.map(s => detail ? placeDetail(tr, s) : placeRow(tr, s)).join('')}</ul></section>`).join('')
    : `<p class="empty">${t('No places match. Clear search or filters.')}</p>`;

  if (!lmap) return;
  const ids = new Set(spots.map(s => s.id));
  for (const [id, m] of markers) if (!ids.has(id) || !tr.spots.some(s => s.id === id)) { m.remove(); markers.delete(id); }
  for (const s of spots) {
    if (!hasCoords(s)) continue;
    const icon = pinIcon(tr, s);
    if (markers.has(s.id)) { markers.get(s.id).setLatLng([s.lat, s.lon]).setIcon(icon); continue; }
    const m = leaflet().marker([s.lat, s.lon], { icon, title: s.name, keyboard: true }).addTo(lmap);
    m.on('click', () => routeMode ? routeTap(s.id) : focusSpot(s.id));
    markers.set(s.id, m);
  }
  updatePins(); renderRoutePanel();
  if (activeSpotId && !ids.has(activeSpotId)) hideSpotCard();
  else if (activeSpotId) { showSpotCard(activeSpotId); }
  if (refit) fitMap();
}

/* ---------- numbered route: turn the switch on, tap pins in order (1 = start, last = end), open in Google Maps ---------- */
function pinIcon(tr, s) {
  const n = routeMode ? routeSeq.indexOf(s.id) + 1 : 0;
  if (n) {
    const role = n === 1 ? 'start' : n === routeSeq.length ? 'end' : 'mid';
    return leaflet().divIcon({ className: `pin seq ${role}`, html: `<span><b>${n}</b></span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
  }
  return leaflet().divIcon({ className: 'pin', html: `<span style="--c:${spotColor(tr, s)}">${catIcon(s.cat, 14)}</span>`, iconSize: [34, 34], iconAnchor: [17, 17] });
}
function updatePins() {
  if (!lmap) return;
  const tr = trip();
  for (const [id, m] of markers) { const s = tr.spots.find(x => x.id === id); if (!s) continue; m.setIcon(pinIcon(tr, s)); m.setZIndexOffset(routeMode && routeSeq.includes(id) ? 1000 : 0); }
}
// Tap a pin: add it as the next number; tap a numbered pin again to take it out (later numbers move up).
function routeTap(id) {
  const i = routeSeq.indexOf(id);
  if (i >= 0) routeSeq.splice(i, 1);
  else if (routeSeq.length >= ROUTE_MAX) return toast('Google Maps allows up to 11 points: a start, 9 stops and an end.');
  else routeSeq.push(id);
  updatePins(); renderRoutePanel();
}
function renderRoutePanel() {
  const tr = trip(), el = $('#route-panel'), tg = $('#route-toggle'); if (!el || !tg) return;
  tg.setAttribute('aria-pressed', String(routeMode)); tg.setAttribute('aria-checked', String(routeMode));
  $('#map')?.classList.toggle('routing', routeMode);
  el.hidden = !routeMode; if (!routeMode) return;
  routeSeq = routeSeq.filter(id => tr.spots.some(s => s.id === id && hasCoords(s)));
  const spots = routeSeq.map(id => tr.spots.find(s => s.id === id));
  const url = spots.length > 1 ? gmapsSeqUrl(spots, routeTravel) : '';
  const modes = [['driving', '🚗', 'Drive'], ['walking', '🚶', 'Walk'], ['bicycling', '🚲', 'Bike']];
  el.innerHTML = `
    <div class="rp-chips">${spots.length ? spots.map((s, i) => `<span class="rp-chip ${i === 0 ? 'start' : i === spots.length - 1 && spots.length > 1 ? 'end' : ''}"><b>${i + 1}</b><span class="user-text">${esc(L(s, 'name'))}</span><button type="button" data-rp-rm="${esc(s.id)}" aria-label="${t('Remove')}">✕</button></span>`).join('')
      : `<span class="rp-hint">${t('Tap places on the map in order. 1 = start, the last one = end.')}</span>`}</div>
    <div class="rp-foot">
      <div class="rp-modes" role="group" aria-label="${t('Travel mode')}">${modes.map(([k, e, l]) => `<button type="button" data-rp-mode="${k}" aria-pressed="${routeTravel === k}" aria-label="${t(l)}">${e}</button>`).join('')}</div>
      ${url ? `<a class="btn primary rp-go" target="_blank" rel="noopener" href="${esc(url)}" title="${t('Open in Google Maps')}">${t('Get directions')} ↗</a>` : `<button type="button" class="primary rp-go" disabled>${spots.length ? t('Pick one more place') : t('Get directions')}</button>`}
      ${spots.length ? `<button type="button" class="rp-clear" data-rp-clear>${t('Clear')}</button>` : ''}
    </div>`;
}

function fitMap() {
  if (!lmap) return;
  const pts = filteredSpots(trip()).filter(hasCoords).map(s => [s.lat, s.lon]);
  if (pts.length === 1) lmap.setView(pts[0], 15);
  else if (pts.length) lmap.fitBounds(pts, { padding: [36, 36], maxZoom: 15 });
}
function focusSpot(id, move = true) {
  const s = trip().spots.find(x => x.id === id);
  if (!lmap || !s || !hasCoords(s)) return;
  if (move) lmap.setView([s.lat, s.lon], Math.max(lmap.getZoom(), 15));
  showSpotCard(id);
  $('#map')?.scrollIntoView({ block: 'nearest' });
}
// Tap a place (list, day chip, pin): show its description on the map, or the sheet if it has no location yet.
function openSpot(id) {
  const s = trip().spots.find(x => x.id === id);
  if (s && lmap && hasCoords(s)) focusSpot(id); else placeSheet(id);
}

/* ---------- description box that sits on top of the pin (no popup) ---------- */
function showSpotCard(id) {
  const tr = trip(), s = tr.spots.find(x => x.id === id), card = $('#spot-card');
  if (!s || !card || !lmap || !hasCoords(s)) return;
  activeSpotId = id;
  const tags = s.days.map(did => { const i = tr.days.findIndex(d => d.id === did); return i < 0 ? '' : `<span class="tag" style="--c:${dayColor(tr, did)}">Day ${i + 1}</span>`; }).join('');
  card.innerHTML = `
    <button type="button" class="spot-x" aria-label="${t('Close place')}">✕</button>
    <div class="spot-head"><span class="cat-badge" style="--c:${spotColor(tr, s)}">${catIcon(s.cat, 18)}</span>
      <div><strong class="user-text">${esc(L(s, 'name'))}</strong></div></div>
    ${s.note ? `<p class="spot-note user-text">${esc(L(s, 'note'))}</p>` : ''}
    ${tags ? `<div class="tags">${tags}</div>` : ''}
    <div class="spot-actions"><a class="btn" target="_blank" rel="noopener" href="${esc(gmapsDirectionsUrl(s))}">Directions</a><button type="button" data-spot-more>${t('Details')}</button></div>`;
  card.hidden = false;
  $$('.pin.active').forEach(p => p.classList.remove('active'));
  markers.get(id)?.getElement()?.classList.add('active');
  positionSpotCard();
}
function hideSpotCard() {
  activeSpotId = null;
  const card = $('#spot-card'); if (card) card.hidden = true;
  $$('.pin.active').forEach(p => p.classList.remove('active'));
}
function positionSpotCard() {
  const card = $('#spot-card'); if (!card || card.hidden || !lmap || !activeSpotId) return;
  const s = trip().spots.find(x => x.id === activeSpotId); if (!s || !hasCoords(s)) return hideSpotCard();
  const pt = lmap.latLngToContainerPoint([s.lat, s.lon]), size = lmap.getSize();
  const cw = card.offsetWidth, ch = card.offsetHeight, gap = 22;
  const below = pt.y - gap - ch < 8; // not enough room above the pin → sit just under it
  const left = Math.min(Math.max(pt.x - cw / 2, 8), Math.max(8, size.x - cw - 8));
  card.style.left = left + 'px';
  card.style.top = (below ? pt.y + gap : pt.y - gap - ch) + 'px';
  card.style.setProperty('--ax', Math.min(Math.max(pt.x - left, 20), cw - 20) + 'px');
  card.classList.toggle('below', below);
  card.style.visibility = pt.x < 0 || pt.y < 0 || pt.x > size.x || pt.y > size.y ? 'hidden' : 'visible';
}
function locate() {
  const lf = leaflet();
  if (!navigator.geolocation || !lmap || !lf) return toast('Location is not available on this device.');
  navigator.geolocation.getCurrentPosition(p => {
    const ll = [p.coords.latitude, p.coords.longitude];
    if (locate.dot) locate.dot.setLatLng(ll); else locate.dot = lf.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#2a7fb8', fillOpacity: 1 }).addTo(lmap);
    lmap.setView(ll, 15);
  }, () => toast('Location permission was denied.'), { enableHighAccuracy: true, timeout: 10000 });
}

/* ---------- place details ---------- */
function placeSheet(id) {
  const tr = trip(), s = tr.spots.find(x => x.id === id); if (!s) return;
  const dayLabels = s.days.map(did => { const i = tr.days.findIndex(d => d.id === did); return i < 0 ? '' : `<span class="tag" style="--c:${dayColor(tr, did)}">Day ${i + 1}</span>`; }).join('');
  openSheet({
    title: s.name, submit: null,
    body: `<div class="place-detail">
      ${s.jp && s.jp !== s.name ? `<p class="jp user-text">${esc(s.jp)}</p>` : ''}
      <p class="muted"><span class="user-text">${esc(s.city)}</span>${s.city ? ' · ' : ''}<span>${esc(CATS[s.cat]?.label || '')}</span></p>
      ${dayLabels ? `<div class="tags">${dayLabels}</div>` : ''}
      ${s.note ? `<p class="user-text">${esc(L(s, 'note')).replace(/\n/g, '<br>')}</p>` : ''}
      ${s.hours ? `<p class="muted"><span>${t('Hours')}</span>: <span class="user-text">${esc(L(s, 'hours'))}</span></p>` : ''}
      <div class="link-grid">
        <a class="btn primary" target="_blank" rel="noopener" href="${esc(gmapsPlaceUrl(s))}">Open in Google Maps</a>
        <a class="btn" target="_blank" rel="noopener" href="${esc(gmapsDirectionsUrl(s))}">Directions</a>
        ${/^https?:\/\//.test(s.link) ? `<a class="btn" target="_blank" rel="noopener" href="${esc(s.link)}">${/xiaohongshu|xhslink/.test(s.link) ? '小红书' : t('Source')}</a>` : ''}
        <button type="button" id="edit-place">Edit place</button>
      </div></div>`,
    onOpen: root => root.querySelector('#edit-place').onclick = () => placeForm(id)
  });
}

/* ---------- place editor ---------- */
function placeForm(id, draft) {
  const tr = trip(), existing = id && tr.spots.find(x => x.id === id);
  const s = draft || (existing ? structuredClone(existing) : { name: '', jp: '', city: '', cat: 'sights', lat: NaN, lon: NaN, note: '', hours: '', link: '', gmaps: '', days: tr.days.some(d => d.id === mapDay) ? [mapDay] : [] });
  const coordText = () => hasCoords(s) ? `${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}` : t('No location yet');

  openSheet({
    title: id ? 'Edit place' : 'Add place', submit: 'Save',
    body: `
      ${id ? '' : addHeader('detailed', 'gmaps')}
      <label>Place name<input name="name" required maxlength="160" value="${esc(s.name)}"></label>
      <div class="finder">
        <label>Find place<span class="row"><input id="find-q" type="search" placeholder="Name, address or Japanese name" value="${esc(s.jp || s.name)}"><button type="button" id="find-go">${t('Search')}</button></span></label>
        <ul id="find-results" class="find-results"></ul>
      </div>
      <label>Google Maps link<input name="gmaps" type="url" inputmode="url" placeholder="Paste a link from Google Maps → Share" value="${esc(s.gmaps)}"></label>
      <p id="gmaps-hint" class="hint"></p>
      <div class="coord-row"><span><small>${t('Coordinates')}</small><b id="coord-text">${coordText()}</b></span><button type="button" id="pick-map">Pick on map</button></div>
      <div class="pair"><label>City<input name="city" maxlength="100" value="${esc(s.city)}"></label>
        <label>Category<select name="cat">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${k === s.cat ? 'selected' : ''}>${c.label}</option>`).join('')}</select></label></div>
      <fieldset class="day-pick"><legend>Days</legend>${tr.days.map((d, i) => `<label class="pill" style="--c:${DAY_COLORS[i % DAY_COLORS.length]}"><input type="checkbox" name="days" value="${esc(d.id)}" ${s.days.includes(d.id) ? 'checked' : ''}><span>Day ${i + 1}</span></label>`).join('')}</fieldset>
      <fieldset class="day-pick sub-pick" ${s.cat === 'fashion' || (s.subs || []).length ? '' : 'hidden'}><legend>${t('Fashion styles')}</legend>${Object.keys(FASHION_SUBS).map(k => `<label class="pill"><input type="checkbox" name="subs" value="${k}" ${(s.subs || []).includes(k) ? 'checked' : ''}><span>${esc(subLabel(k))}</span></label>`).join('')}</fieldset>
      <label>Notes<textarea name="note" rows="3" maxlength="1500">${esc(s.note)}</textarea></label>
      <details class="more"><summary>More</summary>
        <label>Japanese name<input name="jp" maxlength="160" value="${esc(s.jp)}"></label>
        <label>Hours<input name="hours" maxlength="160" value="${esc(s.hours)}"></label>
        <label>Source<input name="link" type="url" maxlength="500" value="${esc(s.link)}" placeholder="https://www.xiaohongshu.com/…"></label>
      </details>
      ${id ? `<button type="button" class="danger wide" id="del-place">Delete place</button>` : ''}`,
    onOpen: root => {
      wireAddHeader(root);
      const readForm = () => {
        const f = new FormData($('#sheet-form'));
        Object.assign(s, { name: f.get('name').trim(), jp: f.get('jp').trim(), city: f.get('city').trim(), cat: f.get('cat'),
          note: f.get('note').trim(), hours: f.get('hours').trim(), link: f.get('link').trim(), gmaps: f.get('gmaps').trim(), days: f.getAll('days'), subs: f.getAll('subs') });
      };
      const setCoords = (lat, lon) => { s.lat = lat; s.lon = lon; root.querySelector('#coord-text').textContent = coordText(); };
      root._read = readForm; root._s = s;
      root.querySelector('[name=cat]').addEventListener('change', e => { root.querySelector('.sub-pick').hidden = e.target.value !== 'fashion'; });

      const gm = root.querySelector('[name=gmaps]');
      const onLink = () => {
        const v = gm.value.trim(), hint = root.querySelector('#gmaps-hint'); if (!v) { hint.textContent = ''; return; }
        const p = parseGmapsLink(v);
        if (Number.isFinite(p.lat)) { setCoords(p.lat, p.lon); hint.textContent = '✓'; }
        else hint.textContent = p.isShort ? t('Short links open the exact place in Google Maps, but the map pin needs a location: search the name above or pick on map.') : '';
        if (p.name && !root.querySelector('[name=name]').value.trim()) root.querySelector('[name=name]').value = p.name;
      };
      gm.addEventListener('change', onLink); gm.addEventListener('paste', () => setTimeout(onLink));

      const runFind = async () => {
        const q = root.querySelector('#find-q').value.trim() || root.querySelector('[name=name]').value.trim(), list = root.querySelector('#find-results');
        if (!q) return;
        list.innerHTML = `<li class="muted">…</li>`;
        try {
          const r = await geocode(q);
          list.innerHTML = r.length ? r.map((x, i) => `<li><button type="button" data-hit="${i}"><strong>${esc(x.name)}</strong><small>${esc(x.label)}</small></button></li>`).join('')
            : `<li class="muted">${t('No results. Try the Japanese name or add the city.')}</li>`;
          list.onclick = e => {
            const b = e.target.closest('[data-hit]'); if (!b) return; const x = r[b.dataset.hit];
            setCoords(x.lat, x.lon);
            const nm = root.querySelector('[name=name]'); if (!nm.value.trim()) nm.value = x.name;
            const city = root.querySelector('[name=city]'); if (!city.value.trim()) city.value = x.label.split(',').map(z => z.trim()).find((z, i) => i > 0 && /[市町村区]|city|ward/i.test(z)) || '';
            list.innerHTML = `<li class="ok">✓ ${esc(x.label)}</li>`;
          };
        } catch (err) { list.innerHTML = `<li class="muted">${esc(err.message)}</li>`; }
      };
      root.querySelector('#find-go').onclick = runFind;
      root.querySelector('#find-q').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); runFind(); } };

      root.querySelector('#pick-map').onclick = () => {
        readForm(); closeSheet();
        if (!lmap) return toast('Map unavailable. Use the places list and Google Maps directions.');
        $('#map-status').textContent = t('Tap the map to set the location.');
        $('#map').scrollIntoView({ block: 'nearest' });
        pickCallback = ll => { s.lat = ll.lat; s.lon = ll.lng; placeForm(id, s); };
      };
      root.querySelector('#del-place')?.addEventListener('click', () => {
        if (!confirm(`${t('Delete place')}: “${existing.name}”?`)) return;
        tr.spots = tr.spots.filter(x => x.id !== id);
        tr.days.forEach(d => d.items.forEach(it => { if (it.spotId === id) it.spotId = ''; }));
        saveDb(); closeSheet(); refreshPlaces();
      });
    },
    onSubmit: () => {
      $('#sheet-body')._read();
      if (!s.name) return sheetError('A name is required.');
      if (existing) Object.assign(existing, s);
      else tr.spots.push({ ...s, id: uid('p') });
      saveDb(); closeSheet(); refreshPlaces(); if (existing || hasCoords(s)) setTimeout(() => focusSpot(existing?.id || tr.spots[tr.spots.length - 1].id), 50);
      toast('Saved');
    }
  });
}

/* ---------- Add place: Simple / Detailed ----------
   Simple  = paste one link (Google Maps or Xiaohongshu, or the app's share text). Name, category and
             location are detected; the day defaults to the day chip that is active in Overview.
   Detailed = the full forms: Google Maps / manual editor, and the Xiaohongshu note-text import. */
const GMAPS_RE = /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+)[^\s，。！!）)"'】]*/i;
const XHS_RE = /https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.com)\/[^\s，。！!）)"'】]+/i;

function addHeader(tab, src) {
  const tabs = [['simple', 'Simple'], ['detailed', 'Detailed']], srcs = [['gmaps', 'Google Maps / manual'], ['xhs', 'Xiaohongshu']];
  const simple = [['link', 'Google Maps link'], ['photo', 'Photo'], ['text', '小红书 text']];
  return `<div class="add-head"><div class="segment" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-add-tab="${k}" aria-pressed="${tab === k}">${t(l)}</button>`).join('')}</div>
    ${tab === 'simple' ? `<div class="pills" role="group">${simple.map(([k, l]) => `<button type="button" data-sa-src="${k}" aria-pressed="${src === k}">${t(l)}</button>`).join('')}</div>` : ''}
    ${tab === 'detailed' ? `<div class="pills" role="group">${srcs.map(([k, l]) => `<button type="button" data-add-src="${k}" aria-pressed="${src === k}">${t(l)}</button>`).join('')}</div>` : ''}</div>`;
}
function wireAddHeader(root) {
  root.querySelectorAll('[data-add-tab]').forEach(b => b.onclick = () => b.dataset.addTab === 'simple' ? simpleAdd() : placeForm());
  root.querySelectorAll('[data-add-src]').forEach(b => b.onclick = () => b.dataset.addSrc === 'xhs' ? xhsImport() : placeForm());
  root.querySelectorAll('[data-sa-src]').forEach(b => b.onclick = () => simpleAdd(b.dataset.saSrc));
}

// Best-guess category label from the name / text.
function guessCat(text) {
  const x = text.toLowerCase();
  if (/ヤドン|呆呆獸|呆呆兽|slowpoke|yadon/.test(x)) return 'slowpoke';
  if (/ポケモン|ポケカ|pok[eé]mon|寶可夢|宝可梦|卡牌|カード|card/.test(x)) return 'pokemon';
  if (/hotel|ホテル|酒店|旅館|旅馆|宿|駅|站|station|空港|機場|机场|airport|港|ferry|渡輪|渡轮/.test(x)) return 'base';
  if (/餐|食|麵|面|拉麵|拉面|烏冬|乌冬|うどん|鳥|鸟|咖啡|甜|カフェ|寿司|壽司|焼|居酒屋|屋台|cafe|coffee|restaurant|ramen|udon|sushi|bakery|ケーキ|パン/.test(x)) return 'food';
  if (/服|百貨|百货|商店街|mall|shop|uniqlo|beams|cosme|コスメ|ドラッグ|藥妝|药妆|アパレル|ファッション/.test(x)) return 'fashion';
  return 'sights';
}
const cityOf = label => (label || '').split(',').map(z => z.trim()).find((z, i) => i > 0 && /[市町村区]|city|ward/i.test(z)) || '';

// Turn whatever was pasted into a list of candidate places (name, category, location).
async function identifyPlaces(text, onStep) {
  const gm = text.match(GMAPS_RE), xh = text.match(XHS_RE);
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !/^https?:/i.test(l));
  let places = [], link = '', gmaps = '';
  if (gm) {
    gmaps = gm[0];
    const g = parseGmapsLink(gmaps);
    // Google's share text is "Name / address / link", so use the lines above the link when the URL has no name.
    const before = text.slice(0, text.indexOf(gmaps)).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    places = [{ name: g.name || before[0] || '', address: !g.name && before[1] ? before[1] : '', note: '', lat: g.lat ?? NaN, lon: g.lon ?? NaN }];
  } else if (xh || /[📍📌]|地址|店名/.test(text)) {
    link = xh ? xh[0] : '';
    const parsed = parseXhs(text);
    if (parsed.places.length) places = parsed.places.map(p => ({ name: p.name, address: p.address, note: p.note, lat: NaN, lon: NaN }));
    else {
      const title = (text.match(/【([^】]+)】/) || [])[1] || lines[0] || '';
      const name = title.split(/\s+-\s+|\s*[|｜]\s*小红书|\s*小红书/)[0].replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').trim().slice(0, 60);
      places = [{ name, address: '', note: '', lat: NaN, lon: NaN }];
    }
  } else if (lines.length) {
    places = [{ name: lines[0].slice(0, 60), address: lines[1] || '', note: '', lat: NaN, lon: NaN }];
  }
  for (const [n, p] of places.entries()) {
    p.cat = guessCat(`${p.name} ${p.address} ${p.note}`); p.city = '';
    if (Number.isFinite(p.lat)) continue;
    for (const q of [p.address, p.name].filter(Boolean)) {
      if (onStep) onStep(n);
      let hit = null;
      try { hit = (await geocode(q))[0]; } catch {}
      if (hit) { p.lat = hit.lat; p.lon = hit.lon; p.city = cityOf(hit.label); break; }
      await new Promise(r => setTimeout(r, 1100)); // Nominatim: ~1 request per second
    }
  }
  return { places: places.filter(p => p.name || Number.isFinite(p.lat) || gmaps || link), link, gmaps };
}

function simpleAdd(src = 'link') {
  const tr = trip();
  const defDay = tr.days.some(d => d.id === mapDay) ? mapDay : ''; // the day chip that is active in Overview
  let result = null, run = 0, timer = null;
  openSheet({
    title: 'Add place', submit: null,
    body: `
      ${addHeader('simple', src)}
      ${src === 'photo' ? '' : src === 'text' ? `<label>${t('Paste 小红书 note text')}<textarea id="sa-text" rows="6" placeholder="📍 一鶴 高松店｜骨付鳥&#10;地址：香川県高松市…"></textarea></label>
      <p class="hint">${t('Copy the note’s text in the 小红书 app and paste it here. Nothing is sent to 小红书.')}</p>` : `<label>${t('Paste a link')}<textarea id="sa-text" rows="3" inputmode="url" placeholder="${t('Google Maps link')}"></textarea></label>
      <p class="hint">${t('Paste a Google Maps share link (or its share text). Name, label and location are filled in for you.')}</p>`}
      <label>Day<select id="sa-day"><option value="">${t('Unassigned day')}</option>${tr.days.map((d, i) => `<option value="${esc(d.id)}" ${defDay === d.id ? 'selected' : ''}>Day ${i + 1} · ${esc(fmtDate(d.date))}</option>`).join('')}</select></label>
      ${src !== 'photo' ? '' : `<div class="lens-box"><p class="hint">${t('Not sure what the place is? Send the photo to Google Lens, then type what it finds in the hint box below.')}</p><a class="btn" id="lc-lens" target="_blank" rel="noopener" href="https://lens.google.com/">${t('Open Google Lens')}</a></div>
        <label>${t('Post title')}<input id="lc-title" maxlength="200"></label>
        <label>${t('Hint: area, station or shop name')}<input id="lc-hint" maxlength="100"></label>
        <label>${t('Photos')}<input id="lc-photos" type="file" accept="image/*" multiple></label>
        <div class="row"><button type="button" class="primary" id="lc-go">${t('Find place')}</button><button type="button" id="lc-key">${t('Vision key')}</button></div>
        <p id="lc-status" class="hint" aria-live="polite"></p><p id="lc-links"></p>
      `}
      <div id="sa-out" aria-live="polite"></div>`,
    onOpen: root => {
      wireAddHeader(root);
      const out = root.querySelector('#sa-out'), ta = root.querySelector('#sa-text') || document.createElement('textarea');
      const show = r => {
        result = r;
        if (!r.places.length) { out.innerHTML = `<p class="hint">${t('Could not identify a place. Check the link, or use the Detailed tab.')}</p>`; return; }
        out.innerHTML = `<ul class="xhs-list">${r.places.map((p, i) => `
          <li><label class="xhs-row"><input type="checkbox" data-sa="${i}" ${p.unpick ? '' : 'checked'}>
            <span><input data-sa-name="${i}" value="${esc(p.name)}" placeholder="${t('Place name')}" aria-label="${t('Place name')}">
            <small>${Number.isFinite(p.lat) ? '📍 ' + p.lat.toFixed(4) + ', ' + p.lon.toFixed(4) : t('No location yet')}${p.city ? ' · ' + esc(p.city) : ''}</small>
            ${p.why ? `<small>${esc(p.why)}</small>` : ''}${p.address ? `<small>${esc(p.address)}</small>` : ''}${p.note ? `<small>${esc(p.note.slice(0, 120))}</small>` : ''}</span></label>
            <select data-sa-cat="${i}" aria-label="${t('Category')}">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${k === p.cat ? 'selected' : ''}>${c.label}</option>`).join('')}</select></li>`).join('')}</ul>
          <button type="button" class="primary wide" id="sa-add">${t('Add place')}</button>`;
        out.querySelector('#sa-add').onclick = add;
      };
      const identify = async () => {
        const text = ta.value.trim(), my = ++run; result = null;
        if (!text) { out.innerHTML = ''; return; }
        out.innerHTML = `<p class="hint">${t('Identifying…')}</p>`;
        const r = await identifyPlaces(text, () => {});
        if (my !== run) return; // a newer paste replaced this one
        show(r);
      };
      const schedule = (delay) => { clearTimeout(timer); timer = setTimeout(identify, delay); };
      ta.addEventListener('paste', () => schedule(50));
      ta.addEventListener('input', () => schedule(900));
      const add = () => {
        const dayId = root.querySelector('#sa-day').value;
        const picks = result.places.map((p, i) => ({ p, i })).filter(({ i }) => root.querySelector(`[data-sa="${i}"]`).checked);
        if (!picks.length) return sheetError('Select at least one place.');
        for (const { p, i } of picks) {
          const name = root.querySelector(`[data-sa-name="${i}"]`).value.trim();
          if (!name) return sheetError('A name is required.');
          tr.spots.push({ id: uid('p'), name, jp: '', city: p.city, cat: root.querySelector(`[data-sa-cat="${i}"]`).value,
            lat: p.lat, lon: p.lon, note: [p.address, p.note].filter(Boolean).join(' — '), hours: '',
            link: result.link, gmaps: result.gmaps, days: dayId ? [dayId] : [] });
        }
        const last = tr.spots[tr.spots.length - 1];
        saveDb(); closeSheet(); refreshPlaces(true);
        if (picks.length === 1 && hasCoords(last)) setTimeout(() => focusSpot(last.id), 50);
        toast(`${picks.length} ${t('places')} ✓`);
      };
      if (src === 'photo') wireLocate(root, show); else ta.focus();
    }
  });
}

/* ---------- Xiaohongshu import (Detailed tab) ----------
   Xiaohongshu has no public API and blocks scrapers (signed requests, login walls),
   so instead of scraping we parse the note text the user copies from the app. */
function parseXhs(text) {
  const links = [...text.matchAll(/https?:\/\/(?:www\.)?(?:xiaohongshu\.com|xhslink\.com)\/[^\s，。！!）)"'】]+/g)].map(m => m[0]);
  const clean = s => s.replace(/#[^#\s]+?(?:\[话题\])?#/g, '').replace(/\[[^\]]{1,6}R\]/g, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '').replace(/^[\s\-–·•:：、.。\d️⃣]+/, '').trim();
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const out = []; let last = null;
  const NAME = /^(?:🏠|🍴|🍜)?\s*(?:店名|名称|名稱|地点|地點|景点|景點|酒店|餐厅|餐廳|店铺|店舖|推荐|推薦)\s*[:：]\s*(.+)/;
  const ADDR = /^(?:📍|📌)?\s*(?:地址|位置|address)\s*[:：]\s*(.+)/i;
  lines.forEach(line => {
    let m;
    if ((m = line.match(ADDR))) {
      const addr = clean(m[1]);
      if (last && last.lineNo >= out.length - 1 && !last.address) last.address = addr;
      else out.push(last = { name: addr, address: addr, note: '' });
      return;
    }
    if ((m = line.match(NAME)) || (m = line.match(/(?:📍|📌)\s*(.+)/u))) {
      const raw = clean(m[1]); if (!raw) return;
      const [name, ...rest] = raw.split(/\s*[｜|丨]\s*|\s+-\s+/);
      out.push(last = { name: name.slice(0, 60), address: '', note: rest.join(' · '), lineNo: out.length });
      return;
    }
    // plain lines right after a place become its note
    const extra = /^(#|https?:)/.test(line) ? '' : clean(line);
    if (last && extra && last.note.length < 200) last.note = (last.note ? last.note + ' ' : '') + extra;
  });
  const seen = new Set();
  return { link: links[0] || '', places: out.filter(p => p.name && !seen.has(p.name) && seen.add(p.name)) };
}

function xhsImport() {
  const tr = trip();
  let parsed = { link: '', places: [] };
  openSheet({
    title: 'Add place', submit: null,
    body: `
      ${addHeader('detailed', 'xhs')}
      <p class="hint">${t('In 小红书, open a note → Share → Copy link, then also copy the note text (long-press). Paste both below. Places marked with 📍 or 店名/地址 are picked up.')}</p>
      <label>Paste note text<textarea id="xhs-text" rows="7" placeholder="📍 一鶴 高松店｜骨付鳥&#10;地址：香川県高松市…&#10;https://www.xiaohongshu.com/explore/…"></textarea></label>
      <div class="pair"><label>Area hint<input id="xhs-area" placeholder="e.g. 高松 / Takamatsu"></label>
        <label>Day<select id="xhs-day"><option value="">${t('Unassigned day')}</option>${tr.days.map((d, i) => `<option value="${esc(d.id)}" ${mapDay === d.id ? 'selected' : ''}>Day ${i + 1} · ${esc(fmtDate(d.date))}</option>`).join('')}</select></label></div>
      <button type="button" class="wide" id="xhs-parse">Find places</button>
      <div id="xhs-out"></div>`,
    onOpen: root => {
      wireAddHeader(root);
      root.querySelector('#xhs-parse').onclick = () => {
        parsed = parseXhs(root.querySelector('#xhs-text').value);
        const out = root.querySelector('#xhs-out');
        if (!parsed.places.length) { out.innerHTML = `<p class="hint">${t('No places found in this text. Places are detected from 📍 lines and 地址/店名 labels.')}</p>`; return; }
        out.innerHTML = `<ul class="xhs-list">${parsed.places.map((p, i) => `
          <li><label class="xhs-row"><input type="checkbox" data-xhs="${i}" checked>
            <span><input data-xhs-name="${i}" value="${esc(p.name)}" aria-label="Place name">
            ${p.address ? `<small>${esc(p.address)}</small>` : ''}${p.note ? `<small>${esc(p.note.slice(0, 120))}</small>` : ''}</span></label>
            <select data-xhs-cat="${i}" aria-label="Category">${Object.entries(CATS).map(([k, c]) => `<option value="${k}" ${k === (/[餐食麵面拉麵拉面烏冬乌冬鳥鸟咖啡甜]/.test(p.name + p.note) ? 'food' : 'sights') ? 'selected' : ''}>${c.label}</option>`).join('')}</select></li>`).join('')}</ul>
          ${parsed.link ? `<p class="hint">${t('Source')}: ${esc(parsed.link)}</p>` : ''}
          <button type="button" class="primary wide" id="xhs-add">Add selected places</button>`;
        out.querySelector('#xhs-add').onclick = () => addXhsPlaces(root, parsed);
      };
    }
  });
}

async function addXhsPlaces(root, parsed) {
  const tr = trip(), area = root.querySelector('#xhs-area').value.trim(), dayId = root.querySelector('#xhs-day').value;
  const picks = parsed.places.map((p, i) => ({ ...p, i })).filter(p => root.querySelector(`[data-xhs="${p.i}"]`).checked);
  if (!picks.length) return sheetError('Select at least one place.');
  const btn = root.querySelector('#xhs-add'); btn.disabled = true;
  let located = 0;
  for (const [n, p] of picks.entries()) {
    btn.textContent = `${n + 1} / ${picks.length}…`;
    const name = root.querySelector(`[data-xhs-name="${p.i}"]`).value.trim() || p.name;
    let hit = null;
    // Nominatim allows ~1 request per second; try address first, then name + area, then name alone.
    for (const q of [p.address && `${p.address}`, area && `${name} ${area}`, name].filter(Boolean)) {
      try { hit = (await geocode(q))[0]; } catch {}
      await new Promise(r => setTimeout(r, 1100));
      if (hit) break;
    }
    if (hit) located++;
    tr.spots.push({ id: uid('p'), name, jp: '', city: area, cat: root.querySelector(`[data-xhs-cat="${p.i}"]`).value,
      lat: hit ? hit.lat : NaN, lon: hit ? hit.lon : NaN, note: [p.address, p.note].filter(Boolean).join(' — '),
      hours: '', link: parsed.link, gmaps: '', days: dayId ? [dayId] : [] });
  }
  saveDb(); closeSheet(); refreshPlaces(true);
  toast(`${picks.length} ${t('places')} ✓` + (picks.length - located ? ` · ${picks.length - located} × ${t('No location yet')}` : ''));
}
