'use strict';
/* Map double-tap-hold-drag GPU zoom/dezoom (Leaflet _animateZoom pipeline),
   planned-vs-backup spot separation, Find Nearby backup surfacing,
   unused spot cleanup, and touch/render speedups. */

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

/* 4. One-handed double-tap + hold + drag zoom/dezoom using Leaflet's native GPU _animateZoom pipeline.
      Tiles and marker pins scale smoothly together without going blank; final tiles load once on release. */
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
    } else {
      map.setZoomAround(ll, Math.min(map.getMaxZoom(), map.getZoom() + 1));
    }
  });

  let firstTapStart = 0, firstTapEnd = 0, firstTapX = 0, firstTapY = 0, firstTapMoved = false;
  let holdZoom = false, holdDragged = false, zoomStarted = false;
  let holdStartY = 0, holdStartZoom = 0, holdStartCenter = null, holdPoint = null, holdAnchor = null;
  let lastCenter = null, lastZoom = null, pendingZoom = null, rafId = 0;
  let twoFingerStart = 0, twoFingerMoved = false;

  const computeCenter = zoom => {
    const scale = map.getZoomScale(zoom, holdStartZoom);
    const viewHalf = map.getSize().divideBy(2);
    const offset = holdPoint.subtract(viewHalf).multiplyBy(1 - 1 / scale);
    const px = map.project(holdStartCenter, holdStartZoom).add(offset);
    return map.unproject(px, holdStartZoom);
  };

  const applyFrame = () => {
    rafId = 0;
    if (!holdZoom || pendingZoom === null || !holdStartCenter || !holdPoint) return;
    const targetZoom = pendingZoom;
    const targetCenter = computeCenter(targetZoom);
    lastCenter = targetCenter;
    lastZoom = targetZoom;
    if (typeof map._animateZoom === 'function') {
      if (!zoomStarted) {
        zoomStarted = true;
        if (typeof map._stop === 'function') map._stop();
        if (typeof map._moveStart === 'function') map._moveStart(true, false);
      }
      map._animateZoom(targetCenter, targetZoom, false, true);
    } else {
      map.setView(targetCenter, targetZoom, { animate: false });
    }
  };

  const onHoldMove = e => {
    if (!holdZoom || e.touches.length !== 1) return;
    const dy = e.touches[0].clientY - holdStartY;
    if (Math.abs(dy) > 8) {
      holdDragged = true;
      e.preventDefault();
      pendingZoom = Math.max(map.getMinZoom(), Math.min(map.getMaxZoom(), holdStartZoom + dy / 80));
      if (!rafId) rafId = requestAnimationFrame(applyFrame);
    }
  };

  const endHoldZoom = doQuickZoom => {
    if (!holdZoom) return;
    el.removeEventListener('touchmove', onHoldMove);
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    const anchor = holdAnchor;
    const wasStarted = zoomStarted;
    const wasDragged = holdDragged;
    const commitCenter = lastCenter;
    const commitZoom = lastZoom;
    holdZoom = false;
    zoomStarted = false;
    holdDragged = false;
    pendingZoom = null;
    holdAnchor = null;
    holdStartCenter = null;
    holdPoint = null;
    lastCenter = null;
    lastZoom = null;
    if (map.dragging && !map.dragging.enabled()) map.dragging.enable();

    if (wasStarted && commitCenter && commitZoom !== null && typeof map._animateZoom === 'function') {
      const finalZoom = typeof map._limitZoom === 'function' ? map._limitZoom(commitZoom) : Math.round(commitZoom);
      map._animateZoom(commitCenter, finalZoom, true, map.options.zoomSnap);
    } else if (doQuickZoom && !wasDragged && anchor) {
      map.setZoomAround(anchor, Math.min(map.getMaxZoom(), map.getZoom() + 1));
    }
  };

  el.addEventListener('touchstart', e => {
    if (isUiTarget(e.target)) return;
    const now = Date.now();
    if (e.touches.length === 2) {
      if (holdZoom) endHoldZoom(false);
      twoFingerStart = now;
      twoFingerMoved = false;
      firstTapEnd = 0;
      return;
    }
    if (e.touches.length !== 1) return;
    twoFingerStart = 0;
    const t = e.touches[0];
    const dt = now - firstTapEnd;
    const dist = Math.hypot(t.clientX - firstTapX, t.clientY - firstTapY);

    if (firstTapEnd && dt > 20 && dt < 340 && dist < 44) {
      firstTapEnd = 0;
      holdZoom = true;
      holdDragged = false;
      zoomStarted = false;
      holdStartY = t.clientY;
      holdStartZoom = map.getZoom();
      holdStartCenter = map.getCenter();
      const rect = el.getBoundingClientRect();
      const lf = window.L;
      holdPoint = lf ? lf.point(t.clientX - rect.left, t.clientY - rect.top) : null;
      holdAnchor = map.containerPointToLatLng([t.clientX - rect.left, t.clientY - rect.top]);
      if (map.dragging && map.dragging.enabled()) map.dragging.disable();
      el.addEventListener('touchmove', onHoldMove, { passive: false });
    } else {
      firstTapStart = now;
      firstTapX = t.clientX;
      firstTapY = t.clientY;
      firstTapMoved = false;
    }
  }, { passive: true });

  el.addEventListener('touchmove', e => {
    if (e.touches.length >= 2) { twoFingerMoved = true; return; }
    if (!holdZoom && e.touches.length === 1 && firstTapStart) {
      const t = e.touches[0];
      if (Math.hypot(t.clientX - firstTapX, t.clientY - firstTapY) > 14) firstTapMoved = true;
    }
  }, { passive: true });

  el.addEventListener('touchend', e => {
    if (isUiTarget(e.target)) return;
    const now = Date.now();
    if (holdZoom && e.touches.length === 0) {
      endHoldZoom(true);
      return;
    }
    if (twoFingerStart && !twoFingerMoved && e.touches.length === 0 && (now - twoFingerStart) < 300) {
      twoFingerStart = 0;
      map.setZoom(Math.max(map.getMinZoom(), map.getZoom() - 1));
      return;
    }
    if (e.changedTouches.length === 1 && e.touches.length === 0 && firstTapStart) {
      if (!firstTapMoved && (now - firstTapStart) < 280) firstTapEnd = now;
      else firstTapEnd = 0;
      firstTapStart = 0;
    }
  }, { passive: true });

  el.addEventListener('touchcancel', () => {
    endHoldZoom(false);
    firstTapStart = 0;
    firstTapEnd = 0;
    twoFingerStart = 0;
  }, { passive: true });
}

/* 5. Instant day accordion toggle (avoids full #view innerHTML rebuild on every tap)
      + instant tab-bar highlight on touchstart. */
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
    const inp = $('#place-search');
    if (inp) {
      let timer = 0;
      inp.oninput = e => {
        placeQuery = e.target.value;
        clearTimeout(timer);
        timer = setTimeout(() => refreshPlaces(false), 120);
      };
    }
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
