'use strict';
/* Days tab: AI itinerary suggestions (Gemini).
   Weeks are collapsed (Week 1 · Week 2 · Week 3 …). Open one, then slide to a single day, or to "Week" for all its days.
   Three ways to reach Gemini:
   - cloud: signed in (stage 3) → Cloud Function `ai`, task `suggest_itinerary`. The key never reaches the browser.
   - worker: `window.AI_API` (firebase-config.js) → Cloudflare Worker `worker/worker.js` that holds the key. No sign-in needed.
   - local: a Gemini key saved on THIS device (Google AI Studio key) → the browser calls Gemini directly.
   Suggestions are shown for ticking first; nothing is added to the trip until "Add" is pressed. */

const GEMINI_MODEL = 'gemini-2.5-flash'; // keep in step with functions/index.js
const geminiKey = () => { try { return localStorage.getItem('trip-gemini-key') || ''; } catch { return ''; } };
const aiApi = () => String(window.AI_API || '').replace(/\/+$/, '');
const aiMode = () => (typeof aiAvailable === 'function' && aiAvailable()) ? 'cloud' : aiApi() ? 'worker' : geminiKey() ? 'local' : '';
const aiUi = { open: false, w: -1, pos: 1, wish: '', pace: 'balanced', results: null, busy: false, status: '' };

const ITIN_SCHEMA = { type: 'OBJECT', properties: { days: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  n: { type: 'INTEGER' }, stops: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    time: { type: 'STRING' }, title: { type: 'STRING' }, jp: { type: 'STRING' }, area: { type: 'STRING' }, cat: { type: 'STRING' }, note: { type: 'STRING' } }, required: ['title'] } } },
  required: ['n', 'stops'] } } }, required: ['days'] };
const PACE_TXT = { relaxed: 'relaxed, about 3 stops a day', balanced: 'balanced, about 5 stops a day', packed: 'packed, about 7 stops a day' };

function itinBrief(tr) {
  const spot = id => tr.spots.find(s => s.id === id);
  return { name: tr.name, tz: tripTz(tr), days: tr.days.map((d, i) => ({ n: i + 1, date: d.date, title: d.title || '', area: d.place || '',
    stops: d.items.map(it => [it.time, it.title || spot(it.spotId)?.name].filter(Boolean).join(' ')).filter(Boolean).slice(0, 12) })) };
}
function itinPrompt({ brief, dayNums, wish, pace, lang }) {
  return `You are a practical travel planner. Suggest stops for the days listed in plan_days of the trip below.
Rules:
- Keep each day inside the area or city of that day. Use the day's area/title and its existing stops; if it has none, infer the place from the neighbouring days.
- Order the stops so travel between them is short. Give each a realistic start time in 24-hour HH:MM (destination local time). Pace: ${PACE_TXT[pace] || PACE_TXT.balanced}.
- Only suggest real, well-known places that exist. Never invent a place. If opening hours matter, say "check hours" in the note.
- Do not repeat a stop that is already in the trip.
- Put the local-language name in "jp" when the place is in a country where English is not the everyday language; otherwise leave it empty. Put the neighbourhood or city in "area".
- cat must be one of: base (hotels, stations, airports), sights, food, fashion (shops), pokemon (cards, games), slowpoke.
- Write note in ${lang === 'zh' ? 'Traditional Chinese (Hong Kong)' : 'English'}, at most 110 characters.
Traveller wishes: ${String(wish || '').slice(0, 400) || 'none'}
Return JSON only, in the form {"days":[{"n":<day number>,"stops":[{"time","title","jp","area","cat","note"}]}]}.
plan_days: ${JSON.stringify(dayNums)}
Trip: ${JSON.stringify(brief).slice(0, 9000)}`;
}
// Same checks for both routes: only the days asked for, known categories, tidy times, short strings.
function cleanItin(raw, dayNums) {
  let data = raw; if (typeof raw === 'string') { try { data = JSON.parse(raw.replace(/^```(?:json)?|```$/g, '').trim()); } catch { data = null; } }
  const want = new Set(dayNums), out = [];
  for (const d of (data?.days || [])) {
    if (!want.has(d.n) || !Array.isArray(d.stops)) continue;
    const stops = d.stops.slice(0, 10).map(s => ({
      time: /^\d{1,2}:\d{2}$/.test(String(s.time || '').trim()) ? String(s.time).trim().padStart(5, '0') : '',
      title: String(s.title || '').slice(0, 100).trim(), jp: String(s.jp || '').slice(0, 100).trim(), area: String(s.area || '').slice(0, 60).trim(),
      cat: CATS[s.cat] ? s.cat : 'sights', note: String(s.note || '').slice(0, 200).trim() })).filter(s => s.title);
    if (stops.length) out.push({ n: d.n, stops });
  }
  return out;
}
async function geminiLocal(prompt) {
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey() },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, responseMimeType: 'application/json', responseSchema: ITIN_SCHEMA } }) });
  } catch { throw Error(t('Could not reach Gemini. Check the connection.')); }
  if (!r.ok) throw Error(r.status === 400 || r.status === 403 ? t('Gemini rejected the key. Check it and try again.') : r.status === 429 ? t('Gemini is busy or its free limit is reached. Try again later.') : t('The AI service returned an error.'));
  const j = await r.json();
  return (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
}
async function geminiWorker(prompt) { // Cloudflare Worker holds the key (worker/worker.js)
  let r;
  try { r = await fetch(aiApi() + '/ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) }); }
  catch { throw Error(t('Could not reach Gemini. Check the connection.')); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(r.status === 429 ? t('Gemini is busy or its free limit is reached. Try again later.') : j.error ? `${t('The AI service returned an error.')} (${r.status}: ${j.error})` : t('The AI service returned an error.'));
  return j.text || '';
}
async function aiItinerary(args) {
  const mode = aiMode(), lang = typeof language !== 'undefined' ? language : 'en';
  if (mode === 'cloud') return cleanItin(await aiCall('suggest_itinerary', { trip: args.brief, dayNums: args.dayNums, wish: args.wish, pace: args.pace, lang }), args.dayNums);
  if (mode === 'worker') return cleanItin(await geminiWorker(itinPrompt({ ...args, lang })), args.dayNums);
  if (mode === 'local') return cleanItin(await geminiLocal(itinPrompt({ ...args, lang })), args.dayNums);
  throw Error(t('Sign in or save a Gemini key on this device to use AI.'));
}

/* ---------- panel ---------- */
const aiTargets = tr => { // trip-day indexes chosen by the slider
  if (aiUi.w < 0 || aiUi.w >= weekCount(tr)) return [];
  const first = aiUi.w * 7, len = weekDays(tr, aiUi.w).length;
  return aiUi.pos === 0 ? Array.from({ length: len }, (_, k) => first + k) : [first + aiUi.pos - 1];
};
function aiRangeText(tr, ds) {
  if (!ds.length) return '';
  const a = ds[0].date, z = ds[ds.length - 1].date, f = x => fmtDate(x, { day: 'numeric', month: 'short' });
  return a === z ? f(a) : `${f(a)} – ${f(z)}`;
}
function aiSliderHtml(tr, w) {
  const ds = weekDays(tr, w), pos = aiUi.pos, today = todayIn(tripTz(tr));
  return `<div class="day-slider" style="--n:${ds.length}">
    <input type="range" id="ai-range" min="0" max="${ds.length}" step="1" value="${pos}" aria-label="${t('Day in this week')}">
    <div class="ticks">${[`<button type="button" data-pos="0" data-ai-pos="0" aria-pressed="${pos === 0}"><b>${t('Week')}</b><small>${t('all')}</small></button>`,
      ...ds.map((d, k) => { const i = w * 7 + k; return `<button type="button" data-pos="${k + 1}" data-ai-pos="${k + 1}" aria-pressed="${pos === k + 1}" style="--c:${DAY_COLORS[i % DAY_COLORS.length]}"><b>${i + 1}</b><small>${esc(fmtDate(d.date, { weekday: 'short' }))}</small>${d.date === today ? '<i class="today-dot" aria-label="Today"></i>' : ''}</button>`; })].join('')}</div></div>`;
}
function aiSelText(tr) {
  const idx = aiTargets(tr); if (!idx.length) return t('Open a week, then slide to a day.');
  if (aiUi.pos === 0) return `${t('Whole week')} · ${idx.length} ${t('Days')}`;
  const d = tr.days[idx[0]]; return `Day ${idx[0] + 1} · ${fmtDate(d.date)}`;
}
function aiPanelHtml(tr) {
  if (!tr.days.length) return '';
  const zh = typeof language !== 'undefined' && language === 'zh', mode = aiMode(), n = weekCount(tr);
  if (aiUi.w >= n) { aiUi.w = -1; aiUi.results = null; }
  const weeks = Array.from({ length: n }, (_, i) => {
    const ds = weekDays(tr, i), open = aiUi.w === i, first = i * 7 + 1, last = i * 7 + ds.length;
    return `<section class="ai-week ${open ? 'open' : ''}">
      <button type="button" class="ai-week-head" data-ai-week="${i}" aria-expanded="${open}">
        <span class="ai-wk"><b>${zh ? `第 ${i + 1} 週` : `Week ${i + 1}`}</b><small>${zh ? `第 ${first}–${last} 天` : `Days ${first}–${last}`} · ${esc(aiRangeText(tr, ds))}</small></span><span class="chev" aria-hidden="true"></span></button>
      ${open ? `<div class="ai-week-body">${aiSliderHtml(tr, i)}</div>` : ''}</section>`;
  }).join('');
  const paces = [['relaxed', 'Relaxed'], ['balanced', 'Balanced'], ['packed', 'Packed']];
  return `<details class="ai-panel" id="ai-panel" ${aiUi.open ? 'open' : ''}>
    <summary><span class="ai-spark" aria-hidden="true">✨</span><b>${t('AI itinerary')}</b><small>Gemini</small></summary>
    <div class="ai-body">
      <div class="ai-weeks">${weeks}</div>
      <p class="ai-sel" id="ai-sel" aria-live="polite">${esc(aiSelText(tr))}</p>
      <label>${t('Your wishes (optional)')}<textarea id="ai-wish" rows="2" maxlength="400" placeholder="${esc(t('e.g. vintage shops, ramen, not too much walking'))}">${esc(aiUi.wish)}</textarea></label>
      <div class="pills" role="group" aria-label="${t('Pace')}">${paces.map(([k, l]) => `<button type="button" data-ai-pace="${k}" aria-pressed="${aiUi.pace === k}">${t(l)}</button>`).join('')}</div>
      <div class="row ai-actions"><button type="button" class="primary" id="ai-go" ${aiUi.w < 0 || aiUi.busy ? 'disabled' : ''}>✨ ${t('Suggest stops')}</button>${mode === 'cloud' || mode === 'worker' ? '' : `<button type="button" id="ai-key">${t('Gemini key')}${mode === 'local' ? ' ✓' : ''}</button>`}</div>
      <p class="hint" id="ai-st" aria-live="polite">${esc(aiUi.status)}</p>
      <p class="hint">${t('Your trip summary and wishes are sent to Google Gemini. Check opening hours before you go.')}</p>
      <div id="ai-results">${aiResultsHtml(tr)}</div>
    </div></details>`;
}
function aiResultsHtml(tr) {
  if (!aiUi.results) return '';
  if (!aiUi.results.length) return `<p class="hint">${t('No suggestions came back. Try again or change the wishes.')}</p>`;
  const total = aiUi.results.reduce((n, r) => n + r.stops.filter(s => s.on).length, 0);
  return aiUi.results.map((r, di) => `<div class="ai-day" style="--c:${dayColor(tr, r.dayId)}"><h4>Day ${r.n} · ${esc(fmtDate(tr.days[r.n - 1]?.date))}</h4>
    <ul class="ai-stops">${r.stops.map((s, si) => `<li><label class="ai-stop"><input type="checkbox" data-ai-stop="${di}|${si}" ${s.on ? 'checked' : ''}>
      <span class="ai-st-time">${esc(s.time)}</span>
      <span class="ai-st-main"><strong class="user-text">${esc(s.title)}</strong>${s.jp && s.jp !== s.title ? `<small class="user-text">${esc(s.jp)}</small>` : ''}${s.area ? `<small class="user-text">${esc(s.area)}</small>` : ''}${s.note ? `<small class="user-text">${esc(s.note)}</small>` : ''}</span></label></li>`).join('')}</ul></div>`).join('') +
    `<label class="check ai-pin"><input type="checkbox" id="ai-pin" ${aiUi.pin === false ? '' : 'checked'}><span>${t('Also pin them on the map (looks up locations)')}</span></label>
     <button type="button" class="primary wide" id="ai-add" ${total ? '' : 'disabled'}>${t('Add')} ${total} ${t('stops')}</button>`;
}

function aiSyncSlider(tr) { // while dragging: update marks and text only, so the thumb stays smooth
  const pos = aiUi.pos, w = aiUi.w, r = $('#ai-range');
  $$('#ai-panel [data-ai-pos]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.aiPos === pos)));
  if (r) { if (+r.value !== pos) r.value = pos; r.style.setProperty('--c', pos ? DAY_COLORS[(w * 7 + pos - 1) % DAY_COLORS.length] : 'var(--accent)'); }
  const sel = $('#ai-sel'); if (sel) sel.textContent = aiSelText(tr);
}
function aiRefresh(tr) { const el = $('#ai-panel'); if (!el) return; el.outerHTML = aiPanelHtml(tr); aiWire(tr); }

function aiWire(tr) {
  const el = $('#ai-panel'); if (!el) return;
  aiSyncSlider(tr);
  el.addEventListener('toggle', () => { aiUi.open = el.open; });
  el.addEventListener('input', e => {
    if (e.target.id === 'ai-range') { aiUi.pos = +e.target.value; aiSyncSlider(tr); }
    else if (e.target.id === 'ai-wish') aiUi.wish = e.target.value;
    else if (e.target.dataset.aiStop) { const [di, si] = e.target.dataset.aiStop.split('|'); aiUi.results[di].stops[si].on = e.target.checked; const b = $('#ai-add'); if (b) { const n = aiUi.results.reduce((a, r) => a + r.stops.filter(s => s.on).length, 0); b.textContent = `${t('Add')} ${n} ${t('stops')}`; b.disabled = !n; } }
    else if (e.target.id === 'ai-pin') aiUi.pin = e.target.checked;
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.aiWeek !== undefined) { // open this week (and close the others); tap it again to collapse
      const w = +b.dataset.aiWeek; aiUi.w = aiUi.w === w ? -1 : w; aiUi.pos = 1; aiUi.results = null; aiUi.status = ''; aiRefresh(tr);
    } else if (b.dataset.aiPos !== undefined) { aiUi.pos = +b.dataset.aiPos; aiSyncSlider(tr); }
    else if (b.dataset.aiPace) { aiUi.pace = b.dataset.aiPace; $$('#ai-panel [data-ai-pace]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.aiPace === aiUi.pace))); }
    else if (b.id === 'ai-go') aiSuggest(tr);
    else if (b.id === 'ai-add') aiAdd(tr);
    else if (b.id === 'ai-key') {
      const k = prompt(t('Gemini API key from Google AI Studio (saved on this device only; leave empty to remove)'), geminiKey());
      if (k === null) return; try { k.trim() ? localStorage.setItem('trip-gemini-key', k.trim()) : localStorage.removeItem('trip-gemini-key'); } catch {}
      aiUi.status = ''; aiRefresh(tr);
    }
  });
}

async function aiSuggest(tr) {
  const idx = aiTargets(tr); if (!idx.length || aiUi.busy) return;
  const st = $('#ai-st'), go = $('#ai-go');
  if (!aiMode()) { aiUi.status = t('Sign in or save a Gemini key on this device to use AI.'); if (st) st.textContent = aiUi.status; return; }
  aiUi.busy = true; aiUi.results = null; aiUi.status = t('Thinking…'); if (st) st.textContent = aiUi.status; if (go) go.disabled = true; const box = $('#ai-results'); if (box) box.innerHTML = '';
  try {
    const nums = idx.map(i => i + 1), days = await aiItinerary({ brief: itinBrief(tr), dayNums: nums, wish: aiUi.wish, pace: aiUi.pace });
    aiUi.results = days.map(d => ({ n: d.n, dayId: tr.days[d.n - 1].id, stops: d.stops.map(s => ({ ...s, on: true })) }));
    aiUi.status = '';
  } catch (e) { aiUi.status = e.message || t('The AI service returned an error.'); }
  aiUi.busy = false;
  if (current.tab === 'days' && $('#ai-panel')) aiRefresh(trip());
}

// Put the ticked suggestions into the days (and, if asked, find each place on the map so it can be routed).
async function aiAdd(tr) {
  if (!aiUi.results) return;
  const pin = $('#ai-pin') ? $('#ai-pin').checked : true, btn = $('#ai-add'), snap = snapshot(tr);
  if (btn) btn.disabled = true;
  const picks = aiUi.results.flatMap(r => r.stops.filter(s => s.on).map(s => ({ r, s }))); let n = 0;
  for (const { r, s } of picks) {
    const d = tr.days.find(x => x.id === r.dayId); if (!d) continue;
    n++; if (btn) btn.textContent = `${n} / ${picks.length}…`;
    let spot = tr.spots.find(x => x.name.toLowerCase() === s.title.toLowerCase() || (s.jp && x.jp === s.jp));
    if (!spot && pin) {
      const area = s.area || d.place || '';
      for (const q of [...new Set([s.jp && `${s.jp} ${area}`, `${s.title} ${area}`].filter(Boolean))]) {
        let hit = null; try { hit = (await geocode(q.trim()))[0]; } catch {}
        await new Promise(res => setTimeout(res, 1100)); // Nominatim: about one request per second
        if (hit) { spot = { id: uid('p'), name: s.title, jp: s.jp, city: area, cat: s.cat, lat: hit.lat, lon: hit.lon, note: s.note, hours: '', link: '', gmaps: '', days: [] }; tr.spots.push(spot); break; }
      }
    }
    if (spot && !spot.days.includes(d.id)) spot.days.push(d.id);
    d.items.push({ id: uid('i'), time: s.time, title: s.title, note: s.note, spotId: spot ? spot.id : '' });
    openSet().add(d.id);
  }
  aiUi.results = null; aiUi.status = '';
  saveDb(); renderDaysTab(); undoToast('AI stops added', snap);
}
