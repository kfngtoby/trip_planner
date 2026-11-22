/* Stage 3: Gemini features. The browser never sees the Gemini key: it calls the signed-in Cloud Function `ai`. */
const aiAvailable = () => syncEnabled() && !!SYNC.user && !!SYNC.fb;
async function aiCall(task, payload) {
  if (!aiAvailable()) throw Error(t('Sign in to use AI features.'));
  try { return (await SYNC.fb.fn.httpsCallable('ai', { timeout: 90000 })({ task, ...payload })).data; }
  catch (e) { throw Error(e.code === 'functions/resource-exhausted' ? t('Daily AI limit reached. Try tomorrow.') : (e.message || 'AI request failed')); }
}
const aiBlob = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(f); });
async function aiShrinkFile(f, max = 1280) { // keep requests small: long edge ≤ max, JPEG
  const img = await createImageBitmap(f), k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
}
/* Pull shop names (+ address, note) out of pasted note text and/or screenshots. */
async function aiExtractPlaces(text, files) {
  const images = [];
  for (const f of [...files].slice(0, 6)) images.push(await aiBlob(await aiShrinkFile(f)));
  return (await aiCall('extract_places', { text: String(text || '').slice(0, 12000), images })).places || [];
}
/* Ask a question about one trip. Sends a compact summary of the trip, not the whole backup. */
function tripBrief(trip) {
  const spot = id => trip.spots?.find(s => s.id === id);
  return { name: trip.name, tz: trip.tz, currency: trip.currency, days: trip.days.map((d, i) => ({ n: i + 1, date: d.date, title: d.title || '', items: (d.items || []).map(it => { const s = spot(it.spotId); return [it.time, s ? `${s.name}${s.city ? ', ' + s.city : ''}` : '', it.note].filter(Boolean).join(' · '); }).filter(Boolean) })) };
}
function askAiSheet(trip) {
  openSheet({ title: t('Ask AI about this trip'), submit: null, body: `
    <label>${t('Your question')}<textarea id="ai-q" rows="3" placeholder="${esc(t('e.g. Is day 3 too packed? What can I swap for rain?'))}"></textarea></label>
    <button type="button" class="primary wide" id="ai-go">${t('Ask')}</button>
    <p class="hint" id="ai-st" aria-live="polite"></p><div id="ai-out" class="ai-out"></div>`,
  onOpen: root => {
    root.querySelector('#ai-go').onclick = async () => {
      const q = root.querySelector('#ai-q').value.trim(), st = root.querySelector('#ai-st'), out = root.querySelector('#ai-out'); if (!q) return;
      st.textContent = t('Thinking…'); out.textContent = '';
      try { out.textContent = (await aiCall('ask', { question: q.slice(0, 1000), trip: tripBrief(trip), lang: typeof language !== 'undefined' ? language : 'en' })).answer || ''; st.textContent = ''; }
      catch (e) { st.textContent = e.message; }
    };
  } });
}
