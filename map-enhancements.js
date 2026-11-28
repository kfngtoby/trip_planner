'use strict';
/* Low-CPU WebGL MapLibre GL JS + OpenFreeMap vector Overview engine,
   GPU Retina category-icon sprites, centered automatic Slowpoke preloader overlay,
   zero-lag Day slider, dirty-flagged persistent tab panels, lazy Leaflet loader,
   one-handed GPU zoom, and touch speedups. */

const GL_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  normal: 'https://tiles.openfreemap.org/styles/liberty'
};

const PRELOAD_SLOWPOKE_URI = 'data:image/png;base64,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';

/* 1. Keep seed-research.js spots strictly as Backup spots. */
(function sanitizeResearchPatches() {
  if (typeof SEED_PATCHES !== 'undefined' && Array.isArray(SEED_PATCHES)) {
    SEED_PATCHES.forEach(p => {
      if (Array.isArray(p.addItems)) p.addItems = [];
      if (Array.isArray(p.addDays)) p.addDays = [];
      if (Array.isArray(p.addSpots)) p.addSpots.forEach(s => { s.days = []; s.backup = true; });
    });
  }
  if (typeof applySeedPatches === 'function') {
    const origApply = applySeedPatches;
    window.applySeedPatches = function(tr) {
      let changed = origApply(tr);
      if (tr && !tr.backupCleanedV1) {
        const legacyIds = new Set(['x23-1','x23-2','x23-3','x23-4','x24-1','x24-2','x25-1','x25-2','x25-3','x26-1']);
        (tr.days || []).forEach(d => {
          const before = d.items.length;
          d.items = (d.items || []).filter(it => !legacyIds.has(it.id));
          if (d.items.length !== before) changed = true;
        });
        const used = getUsedSpotIds(tr);
        (tr.spots || []).forEach(s => {
          if (!used.has(s.id) && !s.backup) { s.backup = true; s.days = []; changed = true; }
        });
        tr.backupCleanedV1 = true;
        changed = true;
      }
      return changed;
    };
  }
})();

function getUsedSpotIds(tr) {
  const used = new Set();
  (tr?.days || []).forEach(d => (d.items || []).forEach(it => { if (it.spotId) used.add(it.spotId); }));
  return used;
}

function getUnusedPlannedSpots(tr) {
  const used = getUsedSpotIds(tr);
  return (tr?.spots || []).filter(s => !s.backup && !used.has(s.id));
}

/* 2. Hide backup spots from Overview map & list (surfaced in Find Nearby). */
if (typeof filteredSpots === 'function') {
  const origFilteredSpots = filteredSpots;
  window.filteredSpots = function(tr, ignoreCats = false) {
    return origFilteredSpots(tr, ignoreCats).filter(s => !s.backup);
  };
}

if (typeof allCatalog === 'function') {
  const origAllCatalog = allCatalog;
  window.allCatalog = function() {
    const base = origAllCatalog();
    const tr = typeof trip === 'function' ? trip() : null;
    if (!tr || !Array.isArray(tr.spots)) return base;
    const label = typeof discoveryLabel === 'function' ? discoveryLabel('Backup spot', '備用地點') : 'Backup spot';
    const typeOf = s => s.cat === 'pokemon' || s.cat === 'slowpoke' ? 'tcg'
      : s.cat === 'fashion' ? 'clothes'
      : s.cat === 'shopping' ? 'budget'
      : 'any';
    const backups = tr.spots.filter(s => s.backup).map(s => ({
      ...s, source: label, type: typeOf(s),
      tags: [s.cat, s.city, s.note, 'backup'].filter(Boolean).join(' ')
    }));
    return [...backups, ...base];
  };
}

/* 3. Lazy-load Leaflet ONLY if the user opens Find Nearby (saves 150KB parse on cold start). */
let leafletLoading = null;
function ensureLeaflet() {
  if (window.L && typeof window.L.map === 'function') return Promise.resolve();
  if (leafletLoading) return leafletLoading;
  leafletLoading = new Promise(resolve => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    js.onload = resolve;
    js.onerror = resolve;
    document.head.appendChild(js);
  });
  return leafletLoading;
}
if (typeof discover === 'function') {
  const origDiscover = discover;
  window.discover = function(tr, dayId, mode) {
    ensureLeaflet().then(() => origDiscover(tr, dayId, mode));
  };
}

/* 4. Instant day accordion toggle + instant tab-bar highlight on touchstart. */
(function installTouchSpeedups() {
  document.addEventListener('touchstart', e => {
    const tab = e.target.closest?.('.tabbar a');
    if (!tab) return;
    const bar = tab.closest('.tabbar');
    bar?.querySelectorAll('a[aria-selected="true"]').forEach(a => a.setAttribute('aria-selected', 'false'));
    tab.setAttribute('aria-selected', 'true');
  }, { passive: true });

  document.addEventListener('click', e => {
    const btn = e.target.closest?.('[data-toggle-day]');
    if (!btn || typeof openSet !== 'function' || typeof trip !== 'function') return;
    const id = btn.dataset.toggleDay;
    const sec = document.getElementById('day-' + id);
    const body = document.getElementById('body-' + id);
    if (!sec || !body) return;
    e.stopImmediatePropagation();
    const open = openSet();
    const willOpen = !open.has(id);
    if (willOpen) open.add(id); else open.delete(id);
    sec.classList.toggle('open', willOpen);
    btn.setAttribute('aria-expanded', String(willOpen));
    body.hidden = !willOpen;
    const tr = trip();
    const exp = document.getElementById('expand-all');
    const col = document.getElementById('collapse-all');
    if (exp) exp.disabled = tr.days.length > 0 && tr.days.every(d => open.has(d.id));
    if (col) col.disabled = open.size === 0;
  }, true);
})();

/* 5. Track data mutations so tab switches skip redundant DOM rebuilds (0% CPU spike). */
const tabDirty = { map: true, days: true, expenses: true };
if (typeof saveDb === 'function') {
  const origSaveDb = saveDb;
  window.saveDb = function(...args) {
    tabDirty.map = tabDirty.days = tabDirty.expenses = true;
    return origSaveDb.apply(this, args);
  };
}

/* 6. Centered Automatic Slowpoke Map Tile Preloader (appears while loading, disappears when done). */
let preloadingMap = false, autoPreloadedTripId = null;
function lonLatToTile(lon, lat, z) {
  const n = 1 << z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return [x, y];
}

function hidePreloadOverlay(ov, delay = 280) {
  if (!ov) return;
  setTimeout(() => {
    ov.classList.add('fading');
    setTimeout(() => { ov.hidden = true; ov.classList.remove('fading', 'done'); }, 290);
  }, delay);
}

async function preloadTripTiles() {
  if (preloadingMap) return;
  const ov = $('#preload-overlay'), fill = ov?.querySelector('.pl-fill');
  const tr = trip();
  if (!tr || !ov || !fill) return;
  const spots = (tr.spots || []).filter(s => !s.backup && hasCoords(s));
  if (!spots.length) { ov.hidden = true; return; }

  preloadingMap = true;
  ov.hidden = false;
  ov.classList.remove('done', 'fading');
  fill.style.width = '10%';

  try {
    const styleSrc = glMap?.getStyle?.()?.sources?.openmaptiles?.url || 'https://tiles.openfreemap.org/planet';
    const tjRes = await fetch(styleSrc);
    if (!tjRes.ok) throw Error('tilejson');
    const tj = await tjRes.json();
    const tmpl = tj?.tiles?.[0];
    if (!tmpl) throw Error('no-tiles');

    const keys = new Set();
    for (const s of spots) {
      for (const z of [11, 12, 13, 14]) {
        const [x, y] = lonLatToTile(s.lon, s.lat, z);
        keys.add(`${z}/${x}/${y}`);
      }
    }
    const urls = [...keys].map(k => {
      const [z, x, y] = k.split('/');
      return tmpl.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    });

    const cache = 'caches' in window ? await caches.open('tiles-gl-v1').catch(() => null) : null;
    let done = 0;
    const total = urls.length || 1;
    let idx = 0;
    const worker = async () => {
      while (idx < urls.length) {
        const u = urls[idx++];
        try {
          const hit = cache ? await cache.match(u) : null;
          if (!hit) {
            const res = await fetch(u);
            if (res.ok && cache) await cache.put(u, res.clone());
          }
        } catch {}
        done++;
        fill.style.width = Math.max(12, Math.round((done / total) * 100)) + '%';
      }
    };
    await Promise.all([worker(), worker(), worker(), worker()]);
    fill.style.width = '100%';
    ov.classList.add('done');
    hidePreloadOverlay(ov, 320);
  } catch {
    hidePreloadOverlay(ov, 100);
  } finally {
    preloadingMap = false;
  }
}

/* 7. Low-CPU WebGL MapLibre GL JS Overview Map Engine + GPU Retina Category Icon Sprites. */
let glMap = null, glReady = false, glStyleKey = 'light', glUserPos = null;
const glSpriteCache = new Map();
const origRenderMapTab = typeof renderMapTab === 'function' ? renderMapTab : null;
const origRefreshPlaces = typeof refreshPlaces === 'function' ? refreshPlaces : null;
const origDestroyMap = typeof destroyMap === 'function' ? destroyMap : null;
const origFitMap = typeof fitMap === 'function' ? fitMap : null;
const origUpdatePins = typeof updatePins === 'function' ? updatePins : null;
const origFocusSpot = typeof focusSpot === 'function' ? focusSpot : null;
const origOpenSpot = typeof openSpot === 'function' ? openSpot : null;
const origShowSpotCard = typeof showSpotCard === 'function' ? showSpotCard : null;
const origHideSpotCard = typeof hideSpotCard === 'function' ? hideSpotCard : null;

function glGetStyleKey() {
  try { const k = localStorage.getItem('trips.map'); return (k === 'streets' || k === 'normal') ? 'normal' : 'light'; }
  catch { return 'light'; }
}

function glDrawCircleBase(ctx, color, selected) {
  ctx.clearRect(0, 0, 64, 64);
  ctx.save();
  if (selected) {
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10, 122, 92, 0.25)';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(32, 32, selected ? 23 : 21, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = selected ? 5 : 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();
}

function glEnsureRouteSprite(num) {
  const id = 'rt-' + num;
  if (!glMap || glMap.hasImage(id)) return id;
  let imgData = glSpriteCache.get(id);
  if (!imgData) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    glDrawCircleBase(ctx, '#0a7a5c', false);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 26px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(num), 32, 33);
    imgData = ctx.getImageData(0, 0, 64, 64);
    glSpriteCache.set(id, imgData);
  }
  glMap.addImage(id, imgData, { pixelRatio: 2 });
  return id;
}

function glEnsurePinSprite(cat, color, selected) {
  const id = `pin-${cat}-${color}-${selected ? 1 : 0}`;
  if (!glMap) return id;
  if (glMap.hasImage(id)) return id;
  const cached = glSpriteCache.get(id);
  if (cached) {
    glMap.addImage(id, cached, { pixelRatio: 2 });
    return id;
  }
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  glDrawCircleBase(ctx, color, selected);
  const baseData = ctx.getImageData(0, 0, 64, 64);
  glMap.addImage(id, baseData, { pixelRatio: 2 });

  if (typeof catIcon === 'function') {
    const rawSvg = catIcon(cat, 24);
    if (rawSvg && rawSvg.includes('<svg')) {
      const svg = rawSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg" style="color:#fff"');
      const img = new Image();
      img.onload = () => {
        glDrawCircleBase(ctx, color, selected);
        ctx.drawImage(img, 18, 18, 28, 28);
        const finalData = ctx.getImageData(0, 0, 64, 64);
        glSpriteCache.set(id, finalData);
        if (glMap && glMap.hasImage(id)) glMap.updateImage(id, finalData);
      };
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    }
  }
  return id;
}

function glSpotsGeoJSON(tr) {
  const list = filteredSpots(tr).filter(hasCoords);
  return {
    type: 'FeatureCollection',
    features: list.map(s => {
      const rIdx = routeMode ? routeSeq.indexOf(s.id) : -1;
      const color = spotColor(tr, s) || '#0a7a5c';
      const selected = s.id === activeSpotId;
      const icon = rIdx >= 0 ? glEnsureRouteSprite(rIdx + 1) : glEnsurePinSprite(s.cat || 'other', color, selected);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
        properties: {
          id: s.id,
          icon,
          sortKey: selected ? 3 : rIdx >= 0 ? 2 : 1
        }
      };
    })
  };
}

function glRouteGeoJSON(tr) {
  const pts = routeMode ? routeSeq.map(id => tr.spots.find(s => s.id === id)).filter(s => s && hasCoords(s)).map(s => [s.lon, s.lat]) : [];
  return {
    type: 'FeatureCollection',
    features: pts.length >= 2 ? [{ type: 'Feature', geometry: { type: 'LineString', coordinates: pts }, properties: {} }] : []
  };
}

function glUserGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: glUserPos ? [{ type: 'Feature', geometry: { type: 'Point', coordinates: [glUserPos.lon, glUserPos.lat] }, properties: {} }] : []
  };
}

function glEnsureLayers() {
  if (!glMap || !glMap.isStyleLoaded()) return;
  const tr = trip();
  if (!tr) return;
  if (!glMap.getSource('trip-route')) {
    glMap.addSource('trip-route', { type: 'geojson', data: glRouteGeoJSON(tr) });
    glMap.addLayer({
      id: 'trip-route-line', type: 'line', source: 'trip-route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#0a7a5c', 'line-width': 3.5, 'line-dasharray': [2, 1.5], 'line-opacity': 0.9 }
    });
  }
  if (!glMap.getSource('trip-user')) {
    glMap.addSource('trip-user', { type: 'geojson', data: glUserGeoJSON() });
    glMap.addLayer({
      id: 'trip-user-halo', type: 'circle', source: 'trip-user',
      paint: { 'circle-radius': 15, 'circle-color': '#2563eb', 'circle-opacity': 0.2 }
    });
    glMap.addLayer({
      id: 'trip-user-dot', type: 'circle', source: 'trip-user',
      paint: { 'circle-radius': 6, 'circle-color': '#2563eb', 'circle-stroke-width': 2.5, 'circle-stroke-color': '#ffffff' }
    });
  }
  if (!glMap.getSource('trip-spots')) {
    glMap.addSource('trip-spots', { type: 'geojson', data: glSpotsGeoJSON(tr) });
    glMap.addLayer({
      id: 'trip-spots-icons', type: 'symbol', source: 'trip-spots',
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'symbol-sort-key': ['get', 'sortKey']
      }
    });
  }
  glReady = true;
}

function glSyncSources(fit = false) {
  const tr = trip();
  if (!glMap || !tr) return;
  if (!glMap.isStyleLoaded()) { glMap.once('style.load', () => { glEnsureLayers(); glSyncSources(fit); }); return; }
  glEnsureLayers();
  const data = glSpotsGeoJSON(tr);
  glMap.getSource('trip-spots')?.setData(data);
  glMap.getSource('trip-route')?.setData(glRouteGeoJSON(tr));
  glMap.getSource('trip-user')?.setData(glUserGeoJSON());
  if (fit && data.features.length) {
    if (data.features.length === 1) {
      glMap.easeTo({ center: data.features[0].geometry.coordinates, zoom: 14.5, duration: 200 });
    } else {
      const b = new maplibregl.LngLatBounds();
      data.features.forEach(f => b.extend(f.geometry.coordinates));
      glMap.fitBounds(b, { padding: 44, maxZoom: 15, duration: 200 });
    }
  }
}

/* One-handed double-tap + hold + drag zoom directly on MapLibre GPU canvas. */
function attachGLDoubleTapZoom(map) {
  const canvas = map.getCanvas();
  if (!canvas || canvas.dataset.glDtWired) return;
  canvas.dataset.glDtWired = '1';
  map.doubleClickZoom.disable();

  let firstTapStart = 0, firstTapEnd = 0, firstTapX = 0, firstTapY = 0, firstTapMoved = false;
  let holdZoom = false, holdDragged = false, holdStartY = 0, holdStartZoom = 0, holdAnchor = null;
  let pendingZoom = null, rafId = 0, twoFingerStart = 0, twoFingerMoved = false;

  const applyFrame = () => {
    rafId = 0;
    if (!holdZoom || pendingZoom === null || !holdAnchor) return;
    map.jumpTo({ zoom: pendingZoom, around: holdAnchor });
  };

  const onHoldMove = e => {
    if (!holdZoom || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - holdStartY;
    if (Math.abs(dy) > 8) {
      holdDragged = true;
      e.preventDefault();
      pendingZoom = Math.max(2, Math.min(19, holdStartZoom + dy / 80));
      if (!rafId) rafId = requestAnimationFrame(applyFrame);
    }
  };

  const endHold = doQuick => {
    if (!holdZoom) return;
    canvas.removeEventListener('touchmove', onHoldMove);
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    const anchor = holdAnchor, dragged = holdDragged;
    holdZoom = false; holdDragged = false; pendingZoom = null; holdAnchor = null;
    map.dragPan.enable();
    if (doQuick && !dragged && anchor) {
      map.zoomTo(Math.min(19, map.getZoom() + 1), { around: anchor, duration: 180 });
    }
  };

  canvas.addEventListener('touchstart', e => {
    const now = Date.now();
    if (e.touches.length === 2) {
      if (holdZoom) endHold(false);
      twoFingerStart = now; twoFingerMoved = false; firstTapEnd = 0;
      return;
    }
    if (e.touches.length !== 1) return;
    twoFingerStart = 0;
    const t = e.touches[0], dt = now - firstTapEnd;
    const dist = Math.hypot(t.clientX - firstTapX, t.clientY - firstTapY);
    if (firstTapEnd && dt > 20 && dt < 340 && dist < 44) {
      firstTapEnd = 0; holdZoom = true; holdDragged = false;
      holdStartY = t.clientY; holdStartZoom = map.getZoom();
      const rect = canvas.getBoundingClientRect();
      holdAnchor = map.unproject([t.clientX - rect.left, t.clientY - rect.top]);
      map.dragPan.disable();
      canvas.addEventListener('touchmove', onHoldMove, { passive: false });
    } else {
      firstTapStart = now; firstTapX = t.clientX; firstTapY = t.clientY; firstTapMoved = false;
    }
  }, { passive: true });

  canvas.addEventListener('touchmove', e => {
    if (e.touches.length >= 2) { twoFingerMoved = true; return; }
    if (!holdZoom && e.touches.length === 1 && firstTapStart) {
      const t = e.touches[0];
      if (Math.hypot(t.clientX - firstTapX, t.clientY - firstTapY) > 14) firstTapMoved = true;
    }
  }, { passive: true });

  canvas.addEventListener('touchend', e => {
    const now = Date.now();
    if (holdZoom && e.touches.length === 0) { endHold(true); return; }
    if (twoFingerStart && !twoFingerMoved && e.touches.length === 0 && (now - twoFingerStart) < 300) {
      twoFingerStart = 0;
      map.zoomTo(Math.max(2, map.getZoom() - 1), { duration: 180 });
      return;
    }
    if (e.changedTouches.length === 1 && e.touches.length === 0 && firstTapStart) {
      if (!firstTapMoved && (now - firstTapStart) < 280) firstTapEnd = now;
      else firstTapEnd = 0;
      firstTapStart = 0;
    }
  }, { passive: true });

  canvas.addEventListener('touchcancel', () => {
    endHold(false); firstTapStart = 0; firstTapEnd = 0; twoFingerStart = 0;
  }, { passive: true });
}

function glShowSpotCard(id) {
  const tr = trip(), s = tr?.spots.find(x => x.id === id), card = $('#spot-card');
  if (!s || !card || !hasCoords(s)) return;
  activeSpotId = id;
  glSyncSources(false);
  const tags = (s.days || []).map(did => {
    const i = tr.days.findIndex(d => d.id === did);
    return i < 0 ? '' : `<span class="tag" style="--c:${dayColor(tr, did)}">Day ${i + 1}</span>`;
  }).join('');
  card.className = 'spot-card gl-dock-card';
  card.innerHTML = `
    <button type="button" class="spot-x" aria-label="${t('Close place')}">✕</button>
    <div class="spot-head"><span class="cat-badge" style="--c:${spotColor(tr, s)}">${catIcon(s.cat, 18)}</span>
      <div><strong class="user-text">${esc(L(s, 'name'))}</strong></div></div>
    ${s.note ? `<p class="spot-note user-text">${esc(L(s, 'note'))}</p>` : ''}
    ${tags ? `<div class="tags">${tags}</div>` : ''}
    <div class="spot-actions"><a class="btn" target="_blank" rel="noopener" href="${esc(gmapsDirectionsUrl(s))}">${t('Directions')}</a><button type="button" data-spot-more>${t('Details')}</button></div>`;
  card.hidden = false;
}

function glHideSpotCard() {
  activeSpotId = null;
  const card = $('#spot-card');
  if (card) card.hidden = true;
  if (glMap && glReady) glSyncSources(false);
}

window.showSpotCard = function(id) {
  if (glMap) return glShowSpotCard(id);
  if (origShowSpotCard) origShowSpotCard(id);
};

window.hideSpotCard = function() {
  if (glMap) return glHideSpotCard();
  if (origHideSpotCard) origHideSpotCard();
};

window.focusSpot = function(id, move = true) {
  if (glMap) {
    const s = trip()?.spots.find(x => x.id === id);
    if (!s || !hasCoords(s)) return;
    if (move) {
      const z = glMap.getZoom();
      glMap.easeTo({ center: [s.lon, s.lat], zoom: z < 13.5 ? 14.5 : z, duration: 220 });
    }
    glShowSpotCard(id);
    return;
  }
  if (origFocusSpot) origFocusSpot(id, move);
};

window.openSpot = function(id) {
  if (glMap) {
    const s = trip()?.spots.find(x => x.id === id);
    if (s && hasCoords(s)) window.focusSpot(id, true);
    else placeSheet(id);
    return;
  }
  if (origOpenSpot) origOpenSpot(id);
};

window.fitMap = function() {
  if (glMap) return glSyncSources(true);
  if (origFitMap) origFitMap();
};

window.updatePins = function() {
  if (glMap) return glSyncSources(false);
  if (origUpdatePins) origUpdatePins();
};

window.refreshPlaces = function(refit = false) {
  if (!glMap) { if (origRefreshPlaces) origRefreshPlaces(refit); return; }
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
  glSyncSources(refit);
  renderRoutePanel();
  const ids = new Set(spots.map(s => s.id));
  if (activeSpotId && !ids.has(activeSpotId)) glHideSpotCard();
  else if (activeSpotId) glShowSpotCard(activeSpotId);
  tabDirty.map = false;
};

window.renderMapTab = function() {
  const tr = trip();
  if (!tr || typeof maplibregl === 'undefined') {
    if (origRenderMapTab) ensureLeaflet().then(() => origRenderMapTab());
    return;
  }
  if (mapDay !== 'all' && mapDay !== 'none' && !tr.days.some(d => d.id === mapDay) && !(/^w\d+$/.test(mapDay) && +mapDay.slice(1) < weekCount(tr))) mapDay = 'all';
  if (glMap) { try { glMap.remove(); } catch {} glMap = null; glReady = false; }

  const showInitOverlay = autoPreloadedTripId !== tr.id;
  $('#view').innerHTML = `
    <div class="map-shell">
      <div id="map" aria-label="${t('Interactive trip map')}"></div>
      <div class="map-ctrls">
        <button id="fit-map" class="map-btn">${t('Fit all')}</button>
        <button id="route-toggle" class="map-btn route-toggle" type="button" role="switch" aria-checked="false" aria-pressed="false" aria-label="${t('Numbered route')}"><span class="rt-ico" aria-hidden="true">1·2·3</span></button>
        <button id="map-style" class="map-btn" type="button"></button>
        <button id="locate" class="map-btn" aria-label="${t('Show my location')}">⌖</button>
      </div>
      <div id="preload-overlay" class="preload-overlay" role="status" aria-live="polite" ${showInitOverlay ? '' : 'hidden'}>
        <img src="${PRELOAD_SLOWPOKE_URI}" alt="Preloading map" width="108" height="94">
        <span class="pl-track" aria-hidden="true"><i class="pl-fill" style="width:${showInitOverlay ? '6%' : '0%'}"></i></span>
      </div>
      <div id="route-panel" class="route-panel" hidden></div>
      <p id="map-status" class="map-status" role="status"></p>
      <div id="spot-card" class="spot-card gl-dock-card" role="dialog" aria-label="${t('Place description')}" hidden></div>
    </div>
    <div class="week-bar" id="week-bar" role="group" aria-label="${t('Filter by day')}"></div>
    <div class="cat-toggle" id="cat-legend" role="group" aria-label="${t('Categories')}"></div>
    <label class="search"><span class="sr-only">${t('Search')}</span><input id="place-search" type="search" placeholder="${t('Search')}" value="${esc(placeQuery)}" aria-label="${t('Search spots')}"></label>
    <div class="fashion-guide" id="fashion-guide" hidden></div>
    <div id="place-list" class="place-list"></div>`;

  let sTimer = 0;
  $('#place-search').oninput = e => {
    placeQuery = e.target.value;
    clearTimeout(sTimer);
    sTimer = setTimeout(() => refreshPlaces(false), 120);
  };
  renderWeekBar();
  $('#week-bar').onclick = e => {
    const b = e.target.closest('[data-week],[data-pos]'); if (!b) return;
    if (b.dataset.week) { if (mapDay === b.dataset.week) return; mapDay = b.dataset.week; reco.showAll = false; renderWeekBar(); refreshPlaces(true); return; }
    mapDay = sliderDayAt(tr, +b.dataset.pos); reco.showAll = false; updateSliderMarks(); refreshPlaces(true);
  };
  /* Zero-lag Day slider: only update label + GPU pins during drag; rebuild list + fit map on release. */
  $('#week-bar').oninput = e => {
    if (e.target.id !== 'day-range') return;
    const pos = snapPos(tr, +e.target.value); mapDay = sliderDayAt(tr, pos);
    updateSliderMarks();
    glSyncSources(false);
  };
  $('#week-bar').onchange = e => {
    if (e.target.id === 'day-range') refreshPlaces(true);
  };
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
  $('#locate').onclick = () => {
    if (!navigator.geolocation) { toast(t('Location unavailable')); return; }
    navigator.geolocation.getCurrentPosition(pos => {
      glUserPos = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      glSyncSources(false);
      glMap?.easeTo({ center: [glUserPos.lon, glUserPos.lat], zoom: Math.max(glMap.getZoom(), 14.5), duration: 280 });
    }, () => toast(t('Location permission denied')), { enableHighAccuracy: true, timeout: 10000 });
  };
  $('#route-toggle').onclick = () => { routeMode = !routeMode; if (routeMode) glHideSpotCard(); updatePins(); renderRoutePanel(); };
  $('#route-panel').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-rp-clear')) routeSeq = [];
    else if (b.dataset.rpRm) routeSeq = routeSeq.filter(id => id !== b.dataset.rpRm);
    else if (b.dataset.rpMode) routeTravel = b.dataset.rpMode;
    else return;
    updatePins(); renderRoutePanel();
  };
  $('#spot-card').onclick = e => {
    if (e.target.closest('.spot-x')) glHideSpotCard();
    else if (e.target.closest('[data-spot-more]')) placeSheet(activeSpotId);
  };

  glStyleKey = glGetStyleKey();
  const updateStyleBtn = () => {
    const sb = $('#map-style'), name = glStyleKey === 'light' ? t('Light Map') : t('Normal Map');
    if (sb) { sb.textContent = name; sb.setAttribute('aria-label', `${t('Map style')}: ${name}`); }
  };
  updateStyleBtn();

  const initSpots = filteredSpots(tr).filter(hasCoords);
  const initCenter = initSpots.length ? [initSpots[0].lon, initSpots[0].lat] : [134.2, 34.9];

  /* Low-CPU / Low-GPU mobile WebGL config: cap pixelRatio at 2, no MSAA, no fade loop, lean tile cache. */
  glMap = new maplibregl.Map({
    container: 'map',
    style: GL_STYLES[glStyleKey],
    center: initCenter,
    zoom: 9,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    antialias: false,
    fadeDuration: 0,
    maxTileCacheSize: 40,
    dragRotate: false,
    touchPitch: false,
    pitchWithRotate: false,
    attributionControl: { compact: true }
  });
  glMap.touchZoomRotate.disableRotation();
  glMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

  glMap.on('style.load', () => {
    glEnsureLayers();
    glSyncSources(true);
    if (autoPreloadedTripId !== tr.id) {
      autoPreloadedTripId = tr.id;
      preloadTripTiles();
    }
  });

  attachGLDoubleTapZoom(glMap);

  glMap.on('click', e => {
    if (pickCallback) {
      const cb = pickCallback; pickCallback = null;
      $('#map-status').textContent = '';
      cb({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      return;
    }
    if (!glReady || !glMap.getLayer('trip-spots-icons')) return;
    const pad = 22;
    const hits = glMap.queryRenderedFeatures([[e.point.x - pad, e.point.y - pad], [e.point.x + pad, e.point.y + pad]], { layers: ['trip-spots-icons'] });
    if (!hits.length) { glHideSpotCard(); return; }
    let best = hits[0], bestD = Infinity;
    for (const h of hits) {
      const p = glMap.project(h.geometry.coordinates);
      const d = Math.hypot(p.x - e.point.x, p.y - e.point.y);
      if (d < bestD) { bestD = d; best = h; }
    }
    const id = best.properties?.id;
    if (!id) return;
    if (routeMode) routeTap(id);
    else window.focusSpot(id, true);
  });

  $('#map-style').onclick = () => {
    glStyleKey = glStyleKey === 'light' ? 'normal' : 'light';
    try { localStorage.setItem('trips.map', glStyleKey); } catch {}
    updateStyleBtn();
    glReady = false;
    glMap?.setStyle(GL_STYLES[glStyleKey]);
  };

  refreshPlaces(false);
  if (pendingFocus) { const id = pendingFocus; pendingFocus = null; setTimeout(() => openSpot(id), 200); }
};

/* 8. Dirty-flagged persistent tab panels: zero DOM rebuilds when switching unchanged tabs. */
let mountedTripId = null, mountedTabs = { map: false, days: false, expenses: false };
window.destroyMap = function(force = false) {
  if (!force && mountedTripId && $('#trip-panels')) {
    const [, view, id] = location.hash.split('/');
    if (view === 'trip' && id === mountedTripId) return;
  }
  mountedTripId = null;
  mountedTabs = { map: false, days: false, expenses: false };
  tabDirty.map = tabDirty.days = tabDirty.expenses = true;
  if (glMap) { try { glMap.remove(); } catch {} glMap = null; glReady = false; }
  if (origDestroyMap) origDestroyMap();
};

window.addEventListener('DOMContentLoaded', () => {
  if (typeof renderTrip !== 'function') return;

  const activatePanel = tab => {
    const wrap = $('#trip-panels');
    if (!wrap) return null;
    let active = null;
    wrap.querySelectorAll('[data-panel]').forEach(p => {
      const on = p.dataset.panel === tab;
      p.hidden = !on;
      if (on) { p.id = 'view'; active = p; }
      else if (p.id === 'view') p.removeAttribute('id');
    });
    $$('.tabbar a').forEach(a => {
      const k = a.getAttribute('href')?.split('/').pop();
      a.setAttribute('aria-selected', String(k === tab));
    });
    return active;
  };

  window.renderTrip = function() {
    const tr = trip();
    if (!tr) return;
    document.title = tr.name;
    const needShell = mountedTripId !== tr.id || !$('#trip-panels');
    if (needShell) {
      window.destroyMap(true);
      mountedTripId = tr.id;
      mountedTabs = { map: false, days: false, expenses: false };
      tabDirty.map = tabDirty.days = tabDirty.expenses = true;
      $('#app').innerHTML = `
        <header class="bar trip-bar">
          <a class="icon-btn back" href="#/" aria-label="All trips">‹</a>
          <div class="title-wrap" id="title-wrap"><button class="bar-title trip-title user-text" id="trip-title" aria-label="Rename trip">${esc(tr.name)}</button></div>
          <button class="icon-btn" data-trip-menu="${esc(tr.id)}" aria-label="Trip options">⋯</button>
          ${typeof langToggle === 'function' ? langToggle() : ''}
        </header>
        <div id="trip-panels">
          <main data-panel="map" class="view view-map" hidden></main>
          <main data-panel="days" class="view view-days" hidden></main>
          <main data-panel="expenses" class="view view-expenses" hidden></main>
        </div>
        <nav class="tabbar" role="tablist" aria-label="Trip views">
          ${[['map', 'Overview', '◎'], ['days', 'Days', '☰'], ['expenses', 'Expenses', '¥']].map(([k, label, ico]) =>
            `<a role="tab" href="#/trip/${esc(tr.id)}/${k}" aria-selected="${current.tab === k}"><span aria-hidden="true" class="tab-ico">${ico}</span><span>${label}</span></a>`).join('')}
        </nav>`;
      $('#trip-title').onclick = inlineRename;
    }

    activatePanel(current.tab);

    if (current.tab === 'map') {
      if (mountedTabs.map && glMap) {
        requestAnimationFrame(() => {
          glMap?.resize();
          if (tabDirty.map) refreshPlaces(false);
          if (pendingFocus) { const id = pendingFocus; pendingFocus = null; openSpot(id); }
        });
      } else {
        renderMapTab();
        mountedTabs.map = true;
        tabDirty.map = false;
      }
    } else if (current.tab === 'days') {
      if (!mountedTabs.days || tabDirty.days) {
        renderDaysTab();
        mountedTabs.days = true;
        tabDirty.days = false;
      }
    } else if (current.tab === 'expenses') {
      if (!mountedTabs.expenses || tabDirty.expenses) {
        renderExpensesTab();
        mountedTabs.expenses = true;
        tabDirty.expenses = false;
      }
    }
  };
});

/* 9. Clean unused places sheet & legend button. */
function cleanUnusedSheet() {
  const tr = trip();
  const unused = getUnusedPlannedSpots(tr);
  const backups = (tr.spots || []).filter(s => s.backup);
  openSheet({
    title: typeof discoveryLabel === 'function' ? discoveryLabel('Clean unused places', '清理未排入行程的地點') : 'Clean unused places',
    submit: null,
    body: `${unused.length
      ? `<p class="field-hint">${unused.length} place(s) on your map are not linked to any day in your itinerary.</p>
         <ul class="csv-queue">${unused.map(s => `<li class="csv-row"><span class="q-m"><b class="user-text">${esc(s.name)}</b><small>${esc(s.city || '')}</small></span></li>`).join('')}</ul>
         <div class="csv-top">
           <button type="button" class="primary" id="cu-backup">Move to Backups (Find Nearby)</button>
           <button type="button" class="danger" id="cu-delete">Delete permanently</button>
         </div>`
      : `<p class="field-hint">All places on your Overview map are linked to your planned itinerary.</p>`}
      <p class="field-hint">${backups.length} backup place(s) are stored for Find Nearby and hidden from Days &amp; Overview.</p>`,
    onOpen: root => {
      const run = del => {
        const snap = snapshot(tr);
        const ids = new Set(unused.map(s => s.id));
        if (del) tr.spots = tr.spots.filter(s => !ids.has(s.id));
        else tr.spots.forEach(s => { if (ids.has(s.id)) { s.backup = true; s.days = []; } });
        saveDb(); closeSheet(); refreshPlaces(true);
        const el = $('#toast'); el.replaceChildren(document.createTextNode(`${del ? 'Deleted' : 'Moved to Backups'}: ${ids.size} place(s) `));
        const b = document.createElement('button'); b.type = 'button'; b.className = 'text-btn'; b.style.cssText = 'color:#fff;text-decoration:underline;padding:0 4px';
        b.textContent = t('Undo'); b.onclick = () => { Object.assign(tr, structuredClone(snap)); saveDb(); el.hidden = true; refreshPlaces(true); };
        el.append(b); el.hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => el.hidden = true, 7000);
      };
      root.querySelector('#cu-backup')?.addEventListener('click', () => run(false));
      root.querySelector('#cu-delete')?.addEventListener('click', () => { if (confirm(`Delete ${unused.length} unused place(s)?`)) run(true); });
    }
  });
}

if (typeof renderLegend === 'function') {
  const origRenderLegend = renderLegend;
  window.renderLegend = function() {
    origRenderLegend();
    const el = $('#cat-legend'), tr = typeof trip === 'function' ? trip() : null;
    if (!el || !tr) return;
    const unused = getUnusedPlannedSpots(tr);
    if (!unused.length) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cat-act ghost';
    btn.textContent = `🧹 ${typeof discoveryLabel === 'function' ? discoveryLabel('Clean unused', '清理未使用') : 'Clean unused'} (${unused.length})`;
    btn.onclick = ev => { ev.stopPropagation(); cleanUnusedSheet(); };
    el.appendChild(btn);
  };
}
