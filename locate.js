'use strict';
/* Find a place from a post's title + a hint + photos. Runs on the device, no server:
   1 read photos (Tesseract OCR; Google Vision text/landmark/web if the user saved a key)
   2 anchor the area (hint or city in the title)  3 candidates: Nominatim + Overpass name search near the anchor
   4 rank by name match + distance + landmark  5 the user confirms in the normal Add place list. */

const LC_CJK = /[\u3040-\u30ff\u3400-\u9fff]/;
const lcSleep = ms => new Promise(r => setTimeout(r, ms));
const lcUniq = a => [...new Set(a.filter(Boolean))];
const lcNorm = s => (s || '').toLowerCase().replace(/\s+/g, '');
const lcCity = s => ((s.match(/[（(]([^）)]{1,10}?)篇[）)]/) || [])[1]) || ((s.match(/([\u4e00-\u9fff]{2,4}[市町区])/) || [])[1]) || '';
const lcKm = (a, b) => { const r = x => x * Math.PI / 180, h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };

// Sign / menu text -> short name-like tokens.
function lcTokens(text) {
  const out = [];
  for (const raw of text.split(/[\n\r|｜/、，,。:：()（）\[\]【】]+/)) {
    const s = raw.trim(), l = s.replace(/\s+/g, '');
    if (l.length < 2 || l.length > 24) continue;
    if (LC_CJK.test(l) && (l.match(new RegExp(LC_CJK.source, 'g')) || []).length >= 2) out.push(l);
    else if (/^[A-Za-z][A-Za-z' &.-]{3,}$/.test(s)) out.push(s);
  }
  return lcUniq(out).sort((a, b) => b.length - a.length).slice(0, 8);
}

const lcLoadT = () => new Promise((res, rej) => {
  if (window.Tesseract) return res(window.Tesseract);
  const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  s.onload = () => res(window.Tesseract); s.onerror = () => rej(Error('OCR needs a connection the first time.')); document.head.appendChild(s);
});

async function lcShrink(file, max = 1400) {
  const bm = await createImageBitmap(file), k = Math.min(1, max / Math.max(bm.width, bm.height)), c = document.createElement('canvas');
  c.width = Math.round(bm.width * k); c.height = Math.round(bm.height * k); c.getContext('2d').drawImage(bm, 0, 0, c.width, c.height); return c;
}

// Optional: Google Cloud Vision (text + landmark + web). Key is saved on this device only.
async function lcVision(canvas, key) {
  const body = { requests: [{ image: { content: canvas.toDataURL('image/jpeg', 0.8).split(',')[1] },
    features: [{ type: 'TEXT_DETECTION' }, { type: 'LANDMARK_DETECTION', maxResults: 3 }, { type: 'WEB_DETECTION', maxResults: 5 }] }] };
  const res = await fetch('https://vision.googleapis.com/v1/images:annotate?key=' + encodeURIComponent(key), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = (await res.json()).responses?.[0] || {};
  return { text: j.fullTextAnnotation?.text || '',
    landmarks: (j.landmarkAnnotations || []).map(l => ({ name: l.description, lat: l.locations?.[0]?.latLng?.latitude, lon: l.locations?.[0]?.latLng?.longitude })),
    web: [...(j.webDetection?.bestGuessLabels || []).map(x => x.label), ...(j.webDetection?.webEntities || []).map(x => x.description)].filter(Boolean).slice(0, 3) };
}

async function locatePlace({ title, hint, files, onStatus = () => {} }) {
  const key = (() => { try { return localStorage.getItem('trip-vision-key') || ''; } catch { return ''; } })();
  const tt = (title || '').split(/\s+[-|｜]\s+/)[0].replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim();
  let text = '', cands = [], web = [];

  // 1 photos
  if (files.length) {
    onStatus('Reading photos…'); let T, w;
    for (const f of files.slice(0, 3)) {
      let got = ''; const c = await lcShrink(f);
      if (key) try { const v = await lcVision(c, key); got = v.text; web.push(...v.web); v.landmarks.forEach(l => Number.isFinite(l.lat) && cands.push({ name: l.name, label: l.name, lat: l.lat, lon: l.lon, src: 'landmark' })); } catch {}
      if (!got.trim()) try { T = T || await lcLoadT(); w = w || await T.createWorker('jpn+chi_sim+eng', 1, typeof RC_LANGS !== 'undefined' ? { langPath: RC_LANGS } : {}); got = (await w.recognize(c)).data.text; } catch {}
      text += '\n' + got;
    }
    if (w) await w.terminate();
  }
  const ocr = lcTokens(text), hintToks = hint ? lcUniq([hint, ...hint.split(/[\s,，、]+/)]).filter(x => x.length >= 2) : [];
  const toks = lcUniq([...hintToks, ...ocr, ...web]);

  // 2 anchor
  onStatus('Searching map…');
  const gc = async q => { let r = []; try { r = await geocode(q); } catch {} await lcSleep(1100); return r; };
  const city = lcCity(tt) || hint; let anchor = (city ? (await gc(city))[0] : null) || null;
  if (!anchor) { const sp = trip().spots.filter(hasCoords); if (sp.length) anchor = { lat: sp.reduce((a, s) => a + s.lat, 0) / sp.length, lon: sp.reduce((a, s) => a + s.lon, 0) / sp.length }; }

  // 3 candidates
  for (const q of lcUniq([hint, ...ocr.slice(0, 3).map(x => `${x} ${lcCity(tt) || ''}`.trim()), web[0]]).slice(0, 4))
    for (const r of await gc(q)) cands.push({ ...r, src: 'nominatim' });
  if (anchor && toks.length) try {
    const rx = toks.slice(0, 8).map(x => x.replace(/[.*+?^${}()|[\]\\"]/g, '\\$&')).join('|'), ctl = new AbortController(); setTimeout(() => ctl.abort(), 20000);
    const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'data=' + encodeURIComponent(`[out:json][timeout:15];nwr["name"~"${rx}",i](around:8000,${anchor.lat},${anchor.lon});out center 12;`) });
    for (const e of (await res.json()).elements || []) {
      const lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon, g = e.tags || {};
      cands.push({ name: g.name, label: g['addr:full'] || [g['addr:province'], g['addr:city'], g['addr:suburb'], g['addr:housenumber']].filter(Boolean).join(' '), lat, lon, src: 'overpass' });
    }
  } catch {}

  // 4 rank
  const seen = new Map();
  for (const c of cands) {
    if (!c.name || !Number.isFinite(c.lat) || (anchor && lcKm(c, anchor) < 0.15 && c.src === 'nominatim' && hint === city)) continue;
    const hay = lcNorm(c.name + c.label), hits = toks.filter(x => lcNorm(x).length >= 2 && hay.includes(lcNorm(x)));
    let s = hits.reduce((a, x) => a + (lcNorm(x).length >= 4 ? 3 : 2), 0) + (c.src === 'landmark' ? 3 : c.src === 'overpass' ? 1 : 0);
    if (anchor) { const d = lcKm(c, anchor); s += d < 3 ? 2 : d < 15 ? 1 : -2; }
    const k = c.lat.toFixed(3) + ',' + c.lon.toFixed(3);
    if (!seen.has(k) || seen.get(k).s < s) seen.set(k, { ...c, s, hits });
  }
  const conf = s => s >= 6 ? 'High' : s >= 3 ? 'Medium' : 'Low';
  const places = [...seen.values()].sort((a, b) => b.s - a.s).slice(0, 4).map((c, i) => ({
    name: c.name, address: c.label, note: '', lat: c.lat, lon: c.lon, cat: guessCat(`${c.name} ${c.label}`), city: cityOf(c.label), unpick: i > 0,
    why: `${t(conf(c.s))} · ${c.hits.length ? t('matched') + ': ' + c.hits.slice(0, 3).join(', ') : t('area only')}` }));

  // 5 hand-offs for the Google steps that need a person (no key / no public API)
  const q = encodeURIComponent([hint || toks[0] || '', lcCity(tt)].join(' ').trim()), links = [];
  if (decodeURIComponent(q)) links.push(['Google Maps search', 'https://www.google.com/maps/search/?api=1&query=' + q]);
  if (tt || hint) links.push(['Google search', 'https://www.google.com/search?q=' + encodeURIComponent(`${tt} ${hint}`.trim())]);
  links.push(['Google Lens (upload a photo)', 'https://lens.google.com/']);
  return { places, links };
}

function wireLocate(root, show) {
  const $q = s => root.querySelector(s), st = $q('#lc-status');
  $q('#lc-key').onclick = () => {
    const k = prompt(t('Google Cloud Vision API key (saved on this device only; leave empty to remove)'), (() => { try { return localStorage.getItem('trip-vision-key') || ''; } catch { return ''; } })());
    if (k === null) return; try { k.trim() ? localStorage.setItem('trip-vision-key', k.trim()) : localStorage.removeItem('trip-vision-key'); } catch {}
  };
  $q('#lc-go').onclick = async () => {
    const btn = $q('#lc-go'); btn.disabled = true;
    try {
      const r = await locatePlace({ title: $q('#lc-title').value.trim(), hint: $q('#lc-hint').value.trim(), files: [...$q('#lc-photos').files], onStatus: m => st.textContent = t(m) });
      $q('#lc-links').innerHTML = r.links.map(l => `<a class="btn" target="_blank" rel="noopener" href="${esc(l[1])}">${t(l[0])}</a>`).join(' ');
      if (!r.places.length) { st.textContent = t('No candidates. Add a hint such as the area or shop name.'); return; }
      st.textContent = ''; show({ places: r.places, link: '', gmaps: '' });
    } catch (e) { st.textContent = e.message; } finally { btn.disabled = false; }
  };
}
