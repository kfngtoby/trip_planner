'use strict';
/* Map double-tap zoom/dezoom, planned-vs-backup spot separation,
   Find Nearby backup surfacing, and one-click unused spot cleanup. */

/* 1. Keep seed-research.js spots strictly as Backup spots (never inject optional items/days into Days tab). */
(function sanitizeResearchPatches() {
  if (typeof SEED_PATCHES !== 'undefined' && Array.isArray(SEED_PATCHES)) {
    SEED_PATCHES.forEach(p => {
      if (Array.isArray(p.addItems)) p.addItems = [];
      if (Array.isArray(p.addDays)) p.addDays = [];
      if (Array.isArray(p.addSpots)) {
        p.addSpots.forEach(s => { s.days = []; s.backup = true; });
      }
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

/* 2. Hide backup spots from the main Overview map & list (they live in Find Nearby). */
if (typeof filteredSpots === 'function') {
  const origFilteredSpots = filteredSpots;
  window.filteredSpots = function(tr, ignoreCats = false) {
    return origFilteredSpots(tr, ignoreCats).filter(s => !s.backup);
  };
}

/* 3. Surface all trip backup spots inside Find Nearby (discovery.js calls allCatalog()). */
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
      : s.cat === 'food' ? 'any'
      : 'any';
    const backups = tr.spots.filter(s => s.backup).map(s => ({
      ...s,
      source: label,
      type: typeOf(s),
      tags: [s.cat, s.city, s.note, 'backup'].filter(Boolean).join(' ')
    }));
    return [...backups, ...base];
  };
}

/* 4. Add double-tap zoom / two-finger tap dezoom on Overview map + "Clean unused" button. */
function attachMapDoubleTapZoom(map) {
  const el = map && map.getContainer ? map.getContainer() : null;
  if (!el || el.dataset.dtZoomWired) return;
  el.dataset.dtZoomWired = '1';
  if (map.doubleClickZoom) map.doubleClickZoom.disable();

  const isUiTarget = target => !!target.closest('.map-ctrls,.leaflet-control,.spot-card,.route-panel,.pin,button,a');

  el.addEventListener('dblclick', e => {
    if (isUiTarget(e.target)) return;
    e.preventDefault();
    const pt = map.mouseEventToContainerPoint(e);
    const ll = map.containerPointToLatLng(pt);
    if (e.shiftKey) {
      map.setZoomAround(ll, Math.max(map.getMinZoom(), map.getZoom() - 1));
    } else if (map.getZoom() >= 17) {
      map.setZoomAround(ll, Math.max(map.getMinZoom(), map.getZoom() - 2));
    } else {
      map.setZoomAround(ll, Math.min(map.getMaxZoom(), map.getZoom() + 1));
    }
  });

  let lastTapTime = 0, lastTapX = 0, lastTapY = 0;
  let twoFingerStart = 0, twoFingerMoved = false;

  el.addEventListener('touchstart', e => {
    if (isUiTarget(e.target)) return;
    if (e.touches.length === 2) {
      twoFingerStart = Date.now();
      twoFingerMoved = false;
    } else if (e.touches.length === 1) {
      twoFingerStart = 0;
    }
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (e.touches.length >= 2) twoFingerMoved = true;
  }, { passive: true });

  el.addEventListener('touchend', e => {
    if (isUiTarget(e.target)) return;
    const now = Date.now();
    if (twoFingerStart && !twoFingerMoved && e.touches.length === 0 && (now - twoFingerStart) < 300) {
      twoFingerStart = 0;
      map.setZoom(Math.max(map.getMinZoom(), map.getZoom() - 1));
      return;
    }
    if (e.changedTouches.length === 1 && e.touches.length === 0) {
      const t = e.changedTouches[0];
      const dt = now - lastTapTime;
      const dist = Math.hypot(t.clientX - lastTapX, t.clientY - lastTapY);
      if (dt > 40 && dt < 320 && dist < 42) {
        lastTapTime = 0;
        const rect = el.getBoundingClientRect();
        const ll = map.containerPointToLatLng([t.clientX - rect.left, t.clientY - rect.top]);
        if (map.getZoom() >= 17) map.setZoomAround(ll, Math.max(map.getMinZoom(), map.getZoom() - 2));
        else map.setZoomAround(ll, Math.min(map.getMaxZoom(), map.getZoom() + 1));
      } else {
        lastTapTime = now; lastTapX = t.clientX; lastTapY = t.clientY;
      }
    }
  }, { passive: true });
}

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

if (typeof renderMapTab === 'function') {
  const origRenderMapTab = renderMapTab;
  window.renderMapTab = function() {
    origRenderMapTab();
    if (typeof lmap !== 'undefined' && lmap) attachMapDoubleTapZoom(lmap);
  };
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
