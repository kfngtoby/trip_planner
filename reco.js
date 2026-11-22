'use strict';
/* "Shops for this day" inside the Fashion guide.
   1. Works out which day is active (day picked on the slider → today on the trip → first day of the picked week).
   2. Works out where that day is (the day's stops on the map → city; falls back to the day's Area text).
   3. Lists curated shops in that city only, nearest first, one branch per chain, skipping places already in the trip
      and 100-yen shops. "Near me" does the same from the phone's GPS.
   4. "More nearby" asks OpenStreetMap (Overpass) live for every fashion shop around the point, with the same rules. */

const reco = { mode: 'day', gps: null, gpsAt: 0, live: null, liveKey: '', liveBusy: false, showAll: false, layer: null };
const EXTRA_KEY = 'trip-fashion-extra';
const NO_FASHION = /daiso|ダイソー|大創|seria|セリア|can ?do|キャンドゥ|watts|ワッツ|100円|100均|3coins|スリーコインズ|uniform|ユニフォーム|学生服|制服|作業服|workman|ワークマン|school/i;
const CITY_XHS = { Tokyo: '东京', Osaka: '大阪', Kyoto: '京都', Kobe: '神户', Himeji: '姬路', Okayama: '冈山', Takamatsu: '高松', Tottori: '鸟取' };
const AREA_ZH = { Harajuku: '原宿', Shibuya: '涩谷', Daikanyama: '代官山', Nakameguro: '中目黑', Shimokitazawa: '下北泽', Koenji: '高圆寺', Nakano: '中野', Kichijoji: '吉祥寺',
  Shinjuku: '新宿', Ikebukuro: '池袋', Ginza: '银座', Ueno: '上野', Akihabara: '秋叶原', Asakusa: '浅草', Kinshicho: '锦糸町', Oshiage: '押上 晴空塔', Odaiba: '台场',
  Jiyugaoka: '自由之丘', Machida: '町田', Shinsaibashi: '心斋桥', Amerikamura: '美国村', Horie: '堀江', Namba: '难波', Umeda: '梅田', Nakazakicho: '中崎町',
  Tenma: '天神桥筋', Nipponbashi: '日本桥', Kawaramachi: '河原町', Higashiyama: '清水寺', Sannomiya: '三宫', Motomachi: '元町', Harborland: '神户港', Station: '站前', Omotecho: '表町', Center: '市中心' };

/* ---------- geography ---------- */
function cityOfPoint(lat, lon) {
  let best = null, bd = 60;
  for (const [k, c] of Object.entries(RECO_CITIES)) { const d = kmBetween({ lat, lon }, { lat: c.ll[0], lon: c.ll[1] }); if (d < bd) { bd = d; best = k; } }
  return best;
}
function cityOfText(text) {
  let best = null, at = Infinity;
  for (const [k, c] of Object.entries(RECO_CITIES)) { const m = (text || '').search(c.words); if (m >= 0 && m < at) { at = m; best = k; } }
  return best;
}
// Points for a day: places linked to its stops (in order), then places tagged with the day.
function dayPoints(tr, d) {
  const out = [], seen = new Set();
  const add = s => { if (s && hasCoords(s) && !seen.has(s.id)) { seen.add(s.id); out.push(s); } };
  d.items.forEach(it => add(it.spotId && tr.spots.find(x => x.id === it.spotId)));
  tr.spots.filter(s => s.days.includes(d.id)).forEach(add);
  return out;
}
function dayWhere(tr, d) {
  const pts = dayPoints(tr, d), counts = {};
  pts.forEach((p, i) => { const c = cityOfPoint(p.lat, p.lon); if (c) counts[c] = (counts[c] || 0) + 1 + i / 1000; }); // ties go to the later stop
  let city = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || cityOfText(`${d.place} ${d.title} ${d.zh?.place || ''}`);
  if (!city) { const i = tr.days.indexOf(d); for (let j = i - 1; j >= 0 && !city; j--) city = dayWhere(tr, tr.days[j]).city; } // carry over from the day before
  const inCity = pts.filter(p => cityOfPoint(p.lat, p.lon) === city);
  const use = inCity.length ? inCity : [];
  const center = use.length ? { lat: use.reduce((n, p) => n + p.lat, 0) / use.length, lon: use.reduce((n, p) => n + p.lon, 0) / use.length }
    : city ? { lat: RECO_CITIES[city].ll[0], lon: RECO_CITIES[city].ll[1] } : null;
  return { city, center };
}
// The day the recommendations are for.
function recoDay(tr) {
  const picked = tr.days.find(d => d.id === mapDay); if (picked) return picked;
  const today = todayDay(tr), wk = /^w\d+$/.test(mapDay) ? weekDays(tr, +mapDay.slice(1)) : null;
  if (today && (!wk || wk.includes(today))) return today;
  return (wk && wk[0]) || today || tr.days[0] || null;
}

/* ---------- catalogue ---------- */
function extraCatalog() { try { return JSON.parse(localStorage.getItem(EXTRA_KEY)) || []; } catch { return []; } }
const allCatalog = () => [...FASHION_CATALOG, ...extraCatalog()];
const normName = s => String(s || '').toLowerCase().replace(/\s*[(（].*?[)）]/g, '').replace(/[\s　·・\-–_.,'’&]/g, '');
// Chain key for a live result: brand tag, else the name without the branch part ("ユニクロ 原宿店" → "ユニクロ").
// Same company written different ways (English / katakana) → one key, so a chain is never suggested twice.
const CHAIN_ALIAS = { 'ユニクロ': 'uniqlo', 'ジーユー': 'gu', 'パルコ': 'parco', 'マルイ': 'marui', '丸井': 'marui', 'ルミネ': 'lumine', 'ドンキホーテ': 'donki', 'ドンキ': 'donki',
  'ラグタグ': 'ragtag', 'セカンドストリート': '2ndstreet', '2ndstreet': '2ndstreet', 'しまむら': 'shimamura', 'ウィゴー': 'wego', 'ザラ': 'zara', 'エイチアンドエム': 'h&m', 'hm': 'h&m',
  '髙島屋': 'takashimaya', '高島屋': 'takashimaya', 'takashimaya': 'takashimaya', '阪急': 'hankyu', 'フラミンゴ': 'flamingo', 'シカゴ': 'chicago', 'キンジ': 'kinji' };
const chainKey = k => CHAIN_ALIAS[k] || k;
const chainOf = g => {
  if (g.brand || g['brand:en']) return chainKey(normName(g.brand || g['brand:en']));
  let n = String(g.name || '').trim().replace(/[\s　]+\S+店$/, '');
  const m = n.match(/^(.{2,}?)[\u4e00-\u9fff]{1,4}店$/); if (m) n = m[1];
  return chainKey(normName(n));
};

function tripChains(tr) {
  const ids = new Set(tr.spots.map(s => s.id)), set = new Set(tr.spots.map(s => s.chain).filter(Boolean));
  for (const c of FASHION_CATALOG) if (c.trip && ids.has(c.trip) && c.chain !== c.id) set.add(c.chain);
  return set;
}
function inTrip(tr, it) {
  if (it.trip && tr.spots.some(s => s.id === it.trip)) return true;
  if (tr.spots.some(s => s.reco === it.id)) return true;
  const n = normName(it.name);
  return tr.spots.some(s => (normName(s.name) === n) || (s.cat === 'fashion' && hasCoords(s) && kmBetween(s, it) < 0.04));
}
const styleOk = it => !activeSubs.size || (it.subs || []).some(k => activeSubs.has(k)) || (it.generic && [...activeSubs].some(k => !['shoes', 'bags', 'hats', 'jewels', 'hair', 'cosplay', 'wafuku'].includes(k)));

function recoList(tr, center, city, pool, radiusKm) {
  const chains = tripChains(tr), used = new Set(), out = [];
  const rows = pool.filter(it => (city ? it.city === city : true) && !NO_FASHION.test(`${it.name} ${it.jp}`) && styleOk(it) && !inTrip(tr, it))
    .map(it => ({ ...it, km: center ? kmBetween(center, it) : 0 }))
    .filter(it => !radiusKm || it.km <= radiusKm)
    .sort((a, b) => a.km - b.km);
  for (const it of rows) {
    const multi = it.chain && it.chain !== it.id;
    if (multi && (chains.has(it.chain) || used.has(it.chain))) continue;
    if (it.chain) used.add(it.chain);
    out.push(it);
  }
  return out;
}

/* ---------- live OpenStreetMap search ---------- */
const OSM_TYPES = { clothes: 'Clothes', boutique: 'Clothes', fashion: 'Clothes', second_hand: 'Second-hand', shoes: 'Shoes', bag: 'Bags', jewelry: 'Jewellery',
  fashion_accessories: 'Accessories', hat: 'Hats', department_store: 'Department store', mall: 'Mall' };
const OSM_SUBS = { second_hand: ['thrift', 'furugi'], shoes: ['shoes'], bag: ['bags'], jewelry: ['jewels'], fashion_accessories: ['jewels', 'hair'], hat: ['hats'],
  department_store: ['select', 'office', 'girly', 'shoes', 'bags'], mall: ['basics', 'girly', 'select'] };
async function liveSearch(center, radiusM) {
  const q = `[out:json][timeout:25];nwr["shop"~"^(${Object.keys(OSM_TYPES).join('|')})$"](around:${radiusM},${center.lat.toFixed(5)},${center.lon.toFixed(5)});out center tags 500;`;
  const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q) });
  if (!res.ok) throw Error('Live shop search is busy. Try again in a minute.');
  const data = await res.json();
  return data.elements.map(e => {
    const g = e.tags || {}, lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon, name = g['name:ja'] || g.name || g['name:en'];
    if (!name || !Number.isFinite(lat) || /^(men|children|baby|school)/.test(g.clothes || '')) return null;
    const type = g.shop, vintage = type === 'second_hand' || /yes|only/.test(g.second_hand || '');
    return { id: `osm_${e.type}${e.id}`, src: 'osm', city: '', area: g['addr:suburb'] || g['addr:quarter'] || g['addr:neighbourhood'] || '',
      name: g['name:en'] && g['name:en'] !== name ? g['name:en'] : name, jp: name, lat, lon, chain: chainOf(g),
      subs: vintage ? ['thrift', 'furugi'] : OSM_SUBS[type] || [], generic: ['clothes', 'boutique', 'fashion'].includes(type) && !vintage,
      note: [t(OSM_TYPES[type] || 'Clothes'), g.opening_hours ? `${t('Hours')}: ${g.opening_hours}` : ''].filter(Boolean).join(' · '), zh: {} };
  }).filter(Boolean);
}

/* ---------- rendering ---------- */
/* 小红书 safety: the app never opens xiaohongshu.com's own search page (login wall + rate limits, a likely cause of 账号异常).
   The buttons open a panel: the 小红书 app (keywords copied) or web searches limited to 小红书 notes via Bing / Google / 百度, which need no 小红书 login. */
const xhsWeb = {
  bing: kw => `https://www.bing.com/search?q=${encodeURIComponent('site:xiaohongshu.com ' + kw)}`,
  google: kw => `https://www.google.com/search?q=${encodeURIComponent('site:xiaohongshu.com ' + kw)}`,
  baidu: kw => `https://www.baidu.com/s?wd=${encodeURIComponent('site:xiaohongshu.com ' + kw)}`
};
function xhsPanel(kw) {
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  openSheet({ title: t('Search 小红书'), submit: null, body: `<div class="xhs-panel">
      <div class="xhs-kw user-text">${esc(kw)}</div>
      ${mobile ? `<button type="button" class="primary" data-xhs-app>${t('Open in the 小红书 app')}</button><p class="hint">${t('The keywords are copied. If the app opens its home page, paste them into its search box.')}</p>` : ''}
      <h4>${t('Search 小红书 notes without logging in')}</h4>
      <a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(xhsWeb.bing(kw))}">Bing</a>
      <a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(xhsWeb.google(kw))}">Google</a>
      <a class="btn" target="_blank" rel="noopener noreferrer" href="${esc(xhsWeb.baidu(kw))}">百度</a>
      <button type="button" data-xhs-copy>${t('Copy keywords')}</button></div>`,
    onOpen(root) {
      const copy = () => { try { return navigator.clipboard.writeText(kw).then(() => true, () => false); } catch { return Promise.resolve(false); } };
      root.onclick = async e => {
        if (e.target.closest('[data-xhs-copy]')) toast(await copy() ? t('Copied') : t('Could not copy'));
        else if (e.target.closest('[data-xhs-app]')) { await copy(); location.href = 'xhsdiscover://search/result?keyword=' + encodeURIComponent(kw); }
      };
    } });
}
const fmtDist = km => km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
const zhMode = () => typeof language !== 'undefined' && language === 'zh';
const recoName = it => zhMode() && it.zh?.name ? it.zh.name : it.name;
const recoNote = it => zhMode() && it.zh?.note ? it.zh.note : it.note;

function recoContext(tr) {
  if (reco.mode === 'gps' && reco.gps) {
    const city = cityOfPoint(reco.gps.lat, reco.gps.lon);
    return { kind: 'gps', center: reco.gps, city, day: todayDay(tr) };
  }
  const day = recoDay(tr); if (!day) return null;
  return { kind: 'day', day, ...dayWhere(tr, day) };
}

function recoHtml(tr) {
  const ctx = recoContext(tr);
  const seg = `<div class="reco-mode" role="group"><button type="button" data-reco-mode="day" aria-pressed="${reco.mode === 'day'}">${t('For this day')}</button><button type="button" data-reco-mode="gps" aria-pressed="${reco.mode === 'gps'}">📍 ${t('Near me')}</button></div>`;
  if (!ctx) return `<div class="reco">${seg}<p class="hint">${t('Add days to the trip first.')}</p></div>`;
  const di = ctx.day ? tr.days.indexOf(ctx.day) : -1;
  const cityName = ctx.city ? (zhMode() ? RECO_CITIES[ctx.city].zh : ctx.city) : '';
  const head = ctx.kind === 'gps'
    ? `<strong>${t('Shops near you')}</strong><small>${[cityName ? esc(cityName) : t('Outside saved cities: tap “More nearby”'), reco.gps.acc ? `±${Math.round(reco.gps.acc)} m` : ''].filter(Boolean).join(' · ')}</small>`
    : `<strong><span>Day ${di + 1}</span> · <span>${esc(fmtDate(ctx.day.date))}</span></strong><small>${cityName ? `<span>${esc(cityName)}</span>` : `<em>${t('Location unknown')}</em>`}${ctx.day.place ? ` · <span class="user-text">${esc(L(ctx.day, 'place'))}</span>` : ''}</small>`;
  const pool = allCatalog();
  // Near me: whole city if you are in a known city, else within 5 km. For this day: the whole city.
  const liveOn = !!(reco.live && reco.liveKey === liveKeyOf(ctx));
  // Curated shops (this city only) and live OpenStreetMap shops are ranked together, so each chain appears once (nearest branch).
  const curated = pool.filter(it => ctx.city ? it.city === ctx.city : ctx.center && kmBetween(ctx.center, it) <= 5);
  const both = ctx.center ? recoList(tr, ctx.center, null, [...curated, ...(liveOn ? reco.live : [])], 0) : [];
  const list = both.filter(x => x.src !== 'osm');
  const live = both.filter(x => x.src === 'osm' && !list.some(c => kmBetween(c, x) < 0.06)); // drop tenants of a mall already listed
  const max = reco.showAll ? 99 : 8, shown = list.slice(0, max);
  const near = list[0] || live[0];
  const areaKw = `${ctx.city ? CITY_XHS[ctx.city] : ''} ${near ? (AREA_ZH[near.area] || near.area) : ''} 女生 买衣服`.replace(/\s+/g, ' ').trim();
  const addLabel = ctx.day ? `+ <span>Day ${di + 1}</span>` : `+ ${t('Save')}`;
  const row = it => `<li class="reco-row" data-reco-id="${esc(it.id)}">
      <div class="reco-main"><div class="reco-line"><strong class="user-text">${esc(recoName(it))}</strong>${ctx.center ? `<b class="reco-km">${fmtDist(it.km)}</b>` : ''}</div>
        <small>${[it.jp && it.jp !== it.name ? `<span class="user-text">${esc(it.jp)}</span>` : '', it.area ? `<span>${esc(it.area)}</span>` : '', it.src === 'osm' ? 'OSM' : it.source ? esc(it.source) : ''].filter(Boolean).join(' · ')}</small>
        ${activeSubs.size && (it.subs || []).length ? `<span class="reco-subs">${it.subs.filter(k => activeSubs.has(k)).slice(0, 3).map(k => `<i>${esc(subLabel(k))}</i>`).join('')}</span>` : ''}
        ${recoNote(it) ? `<p class="user-text">${esc(recoNote(it))}</p>` : ''}</div>
      <div class="reco-act"><a class="btn" target="_blank" rel="noopener" href="${esc(gmapsDirectionsUrl({ ...it, name: it.jp || it.name }))}">${t('Directions')}</a>
        <button type="button" data-reco-add="${esc(it.id)}">${addLabel}</button>
        <button type="button" class="btn xhs" data-xhs-kw="${esc(`${it.name} ${CITY_XHS[it.city || ctx.city] || ''}`.trim())}">小红书</button></div></li>`;
  return `<div class="reco">
    <div class="reco-head"><div class="reco-title">${head}</div>${seg}</div>
    ${ctx.kind === 'day' && mapDay === 'all' ? `<p class="hint">${t('Pick a week and slide to a day to change the shops.')}</p>` : ''}
    ${list.length ? `<ol class="reco-list">${shown.map(row).join('')}</ol>${list.length > max ? `<button type="button" class="text-btn" data-reco-more>${t('Show all')} (${list.length})</button>` : ''}`
      : `<p class="hint">${ctx.center ? (curated.length ? t('Your plan already has every saved shop here. Try “More nearby”.') : t('No saved shops here yet. Try “More nearby”.')) : t('This day has no map location yet. Add a place with a location, or set the day’s Area (e.g. Tokyo).')}</p>`}
    ${live.length ? `<h4 class="reco-sub">${t('More nearby · OpenStreetMap')}</h4><ol class="reco-list">${live.slice(0, reco.showAll ? 60 : 12).map(row).join('')}</ol>` : liveOn ? `<p class="hint">${t('No other shops found nearby.')}</p>` : ''}
    <div class="reco-tools">
      ${ctx.center ? `<button type="button" data-reco-live ${reco.liveBusy ? 'disabled' : ''}>${reco.liveBusy ? t('Searching…') : t('More nearby')}</button>` : ''}
      <button type="button" class="btn xhs" data-xhs-kw="${esc(areaKw)}">${t('Search 小红书 for this area')}</button>
      <button type="button" class="text-btn" data-reco-import>${t('Import shop list')}</button><input type="file" id="reco-file" accept=".json,application/json" hidden>
    </div></div>`;
}
const liveKeyOf = ctx => ctx && ctx.center ? `${ctx.center.lat.toFixed(3)},${ctx.center.lon.toFixed(3)}` : '';

// Small hollow markers for the suggestions, so you can see where they are next to your own places.
function drawRecoMarkers(tr) {
  const lf = leaflet(); if (!lmap || !lf) return;
  if (!reco.layer) reco.layer = lf.layerGroup().addTo(lmap);
  reco.layer.clearLayers();
  const box = $('#fashion-guide'); if (!box || box.hidden) return;
  box.querySelectorAll('[data-reco-id]').forEach(li => {
    const it = recoFind(li.dataset.recoId); if (!it || !hasCoords(it)) return;
    lf.circleMarker([it.lat, it.lon], { radius: 7, color: '#8a57c9', weight: 2.5, fillColor: '#fff', fillOpacity: 0.95, dashArray: '3 2' })
      .bindTooltip(recoName(it), { direction: 'top', offset: [0, -6] })
      .on('click', () => { li.scrollIntoView({ block: 'center', behavior: 'smooth' }); li.classList.add('flash'); setTimeout(() => li.classList.remove('flash'), 1200); })
      .addTo(reco.layer);
  });
}
function recoFind(id) { return allCatalog().find(x => x.id === id) || (reco.live || []).find(x => x.id === id); }

function wireReco(box, tr) {
  box.addEventListener('click', async e => {
    const b = e.target.closest('[data-reco-mode],[data-reco-add],[data-reco-live],[data-reco-more],[data-reco-import],[data-xhs-kw]'); if (!b) return;
    e.stopPropagation();
    if (b.dataset.xhsKw) return xhsPanel(b.dataset.xhsKw);
    if (b.dataset.recoMode === 'day') { reco.mode = 'day'; renderFashionGuide(); }
    else if (b.dataset.recoMode === 'gps') {
      if (!navigator.geolocation) return toast('Location is not available on this device.');
      b.textContent = t('Locating…');
      navigator.geolocation.getCurrentPosition(p => {
        reco.mode = 'gps'; reco.gps = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy }; reco.gpsAt = Date.now(); reco.showAll = false;
        const lf = leaflet();
        if (lmap && lf) { const ll = [reco.gps.lat, reco.gps.lon]; if (locate.dot) locate.dot.setLatLng(ll); else locate.dot = lf.circleMarker(ll, { radius: 8, color: '#fff', weight: 3, fillColor: '#2a7fb8', fillOpacity: 1 }).addTo(lmap); lmap.setView(ll, 14); }
        renderFashionGuide();
      }, () => { toast('Location permission was denied.'); renderFashionGuide(); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
    }
    else if (b.dataset.recoAdd) addReco(tr, b.dataset.recoAdd);
    else if (b.hasAttribute('data-reco-more')) { reco.showAll = true; renderFashionGuide(); }
    else if (b.hasAttribute('data-reco-live')) {
      const ctx = recoContext(tr); if (!ctx?.center) return;
      reco.liveBusy = true; renderFashionGuide();
      try { reco.live = await liveSearch(ctx.center, ctx.kind === 'gps' ? 1200 : 1500); reco.liveKey = liveKeyOf(ctx); }
      catch (err) { toast(err.message || 'Live shop search is busy. Try again in a minute.'); }
      reco.liveBusy = false; renderFashionGuide();
    }
    else if (b.hasAttribute('data-reco-import')) importSheet();
  });
  box.addEventListener('change', e => { if (e.target.id === 'reco-file') importShopList(e.target); });
}

function addReco(tr, id) {
  const it = recoFind(id); if (!it) return;
  const ctx = recoContext(tr), day = ctx?.day;
  tr.spots.push({ id: uid('p'), name: it.name, jp: it.jp || '', city: it.city || ctx?.city || '', cat: 'fashion', lat: it.lat, lon: it.lon,
    note: it.note || '', hours: '', link: '', gmaps: '', days: day ? [day.id] : [], subs: it.subs || [], reco: it.id, chain: it.chain && it.chain !== it.id ? it.chain : '' });
  saveDb(); refreshPlaces(); toast(day ? `Saved · Day ${tr.days.indexOf(day) + 1}` : 'Saved');
}

// Shops are added to the suggestions on this phone. Accepts rows like [{name, lat, lon, city, area, subs, note, zh_name, zh_note, chain, source}].
function addShops(list) {
  const old = extraCatalog(), keep = new Map(old.map(x => [x.id, x]));
  let added = 0;
  for (const r of list) {
    const lat = Number(r.lat), lon = Number(r.lon), name = String(r.name || '').trim().slice(0, 120);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const city = RECO_CITIES[r.city] ? r.city : cityOfPoint(lat, lon); if (!city) continue;
    const id = 'x_' + normName(name).slice(0, 40) + '_' + lat.toFixed(3);
    keep.set(id, { id, city, area: String(r.area || '').slice(0, 40), name, jp: String(r.jp || '').slice(0, 120), lat, lon,
      subs: (r.subs || []).filter(k => FASHION_SUBS[k]), note: String(r.note || '').slice(0, 300), zh: { name: String(r.zh_name || '').slice(0, 120), note: String(r.zh_note || '').slice(0, 300) },
      chain: r.chain ? normName(r.chain) : id, source: String(r.source || '小红书').slice(0, 20) });
    added++;
  }
  try { localStorage.setItem(EXTRA_KEY, JSON.stringify([...keep.values()].slice(0, 2000))); }
  catch { toast('Could not save. Browser storage is full or blocked (private mode?).'); return 0; }
  return added;
}
async function importShopList(input) {
  const file = input.files[0]; if (!file) return;
  try {
    const rows = JSON.parse(await file.text()), list = Array.isArray(rows) ? rows : rows.shops;
    if (!Array.isArray(list)) throw Error('Not a shop list.');
    toast(`${addShops(list)} ${t('places')} ✓`); renderFashionGuide();
  } catch (err) { toast(err.message || 'Not a shop list.'); } finally { input.value = ''; }
}

// Import from pasted 小红书 text, screenshots (read on this phone with OCR) or a JSON list. Nothing is sent to 小红书.
function importSheet() {
  let found = [];
  openSheet({ title: 'Import shop list', submit: null, body: `
    <label>${t('Paste note text or a JSON list')}<textarea id="im-text" rows="6" placeholder="📍 店名｜…&#10;地址：东京都…"></textarea></label>
    <label>${t('Or add screenshots of the note')}<input id="im-shots" type="file" accept="image/*" multiple></label>
    ${typeof aiAvailable === 'function' && aiAvailable() ? `<label class="check"><input type="checkbox" id="im-ai" checked> ${t('Read with AI (Gemini): text and screenshots are sent to Google')}</label>` : ''}
    <label>${t('Area hint')}<input id="im-area" placeholder="e.g. Tokyo / Koenji"></label>
    <button type="button" class="primary wide" id="im-go">${t('Find shops')}</button>
    <button type="button" class="text-btn" id="im-json">${t('Choose a .json file')}</button>
    <p id="im-status" class="hint" aria-live="polite"></p><div id="im-out"></div>`,
  onOpen: root => {
    const $q = s => root.querySelector(s), st = $q('#im-status');
    $q('#im-json').onclick = () => document.getElementById('reco-file')?.click();
    $q('#im-go').onclick = async () => {
      const btn = $q('#im-go'); btn.disabled = true; found = [];
      try {
        let text = $q('#im-text').value.trim();
        if (/^[\[{]/.test(text)) { // JSON pasted
          const rows = JSON.parse(text), list = Array.isArray(rows) ? rows : rows.shops;
          toast(`${addShops(list)} ${t('places')} ✓`); renderFashionGuide(); closeSheet(); return;
        }
        const useAi = !!$q('#im-ai')?.checked; let aiPlaces = null;
        if (useAi) { st.textContent = t('Thinking…'); aiPlaces = await aiExtractPlaces(text, $q('#im-shots').files); }
        else for (const f of [...$q('#im-shots').files]) {
          st.textContent = t('Reading screenshot…') + ' ' + f.name;
          const T = await lcLoadT(), res = await T.recognize(await lcShrink(f, 1800), 'chi_sim+chi_tra+jpn+eng');
          text += '\n' + (res.data.text || '').replace(/(?<=[\u3000-\u9fff]) (?=[\u3000-\u9fff])/g, '');
        }
        if (!useAi && !text.trim()) { st.textContent = t('Paste text or add a screenshot first.'); return; }
        const area = $q('#im-area').value.trim(), places = (aiPlaces ? aiPlaces.map(p => ({ name: p.name, address: p.address, note: p.note })) : parseXhs(text).places).slice(0, 12);
        if (!places.length) { st.textContent = t('No shops found. Lines like “📍 name｜note” and “地址：…” work best.'); return; }
        for (const [n, p] of places.entries()) {
          st.textContent = `${t('Locating…')} ${n + 1}/${places.length}`;
          for (const q of [[p.address, area].filter(Boolean).join(' '), [p.name, area].filter(Boolean).join(' ')].filter(Boolean)) {
            let hit = null; try { hit = (await geocode(q))[0]; } catch {}
            if (hit) { p.lat = hit.lat; p.lon = hit.lon; break; }
            await new Promise(r => setTimeout(r, 1100));
          }
        }
        found = places; st.textContent = '';
        $q('#im-out').innerHTML = `<ul class="xhs-list">${places.map((p, i) => `<li><label class="xhs-row"><input type="checkbox" data-im="${i}" ${Number.isFinite(p.lat) ? 'checked' : 'disabled'}>
          <span><b>${esc(p.name)}</b><small>${Number.isFinite(p.lat) ? '📍 ' + p.lat.toFixed(4) + ', ' + p.lon.toFixed(4) : t('No location yet')}</small>${p.note ? `<small>${esc(p.note.slice(0, 100))}</small>` : ''}</span></label></li>`).join('')}</ul>
          <button type="button" class="primary wide" id="im-add">${t('Add selected places')}</button>`;
        $q('#im-add').onclick = () => {
          const picks = found.filter((p, i) => $q(`[data-im="${i}"]`).checked).map(p => ({ name: p.name, lat: p.lat, lon: p.lon, area, note: p.note, source: '小红书' }));
          toast(`${addShops(picks)} ${t('places')} ✓`); renderFashionGuide(); closeSheet();
        };
      } catch (e) { st.textContent = e.message || String(e); } finally { btn.disabled = false; }
    };
  } });
}
