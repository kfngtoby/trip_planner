/* Callable function `ai`: signed-in users only, Gemini key kept as a secret, daily limit per user.
   Deploy: firebase functions:secrets:set GEMINI_API_KEY  then  firebase deploy --only functions,firestore:rules */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
admin.initializeApp();

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'; // change if Google retires this name
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 60);
const ALLOWED = (process.env.ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean); // empty = any signed-in user

async function gemini(parts, { json = false, schema, temperature = 0.2 } = {}) {
  const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature } };
  if (json) { body.generationConfig.responseMimeType = 'application/json'; if (schema) body.generationConfig.responseSchema = schema; }
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY.value() }, body: JSON.stringify(body)
  });
  if (!r.ok) { console.error('gemini', r.status, (await r.text()).slice(0, 300)); throw new HttpsError('unavailable', 'The AI service returned an error.'); }
  const j = await r.json();
  return (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
}

async function countUse(uid) {
  const day = new Date().toISOString().slice(0, 10), ref = admin.firestore().doc(`users/${uid}/usage/${day}`);
  await admin.firestore().runTransaction(async tx => {
    const n = (await tx.get(ref)).data()?.n || 0;
    if (n >= DAILY_LIMIT) throw new HttpsError('resource-exhausted', 'Daily AI limit reached.');
    tx.set(ref, { n: n + 1 });
  });
}

const PLACES_SCHEMA = { type: 'OBJECT', properties: { places: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  name: { type: 'STRING' }, jp: { type: 'STRING' }, address: { type: 'STRING' }, area: { type: 'STRING' }, note: { type: 'STRING' } }, required: ['name'] } } }, required: ['places'] };


const ITIN_SCHEMA = { type: 'OBJECT', properties: { days: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  n: { type: 'INTEGER' }, stops: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    time: { type: 'STRING' }, title: { type: 'STRING' }, jp: { type: 'STRING' }, area: { type: 'STRING' }, cat: { type: 'STRING' }, note: { type: 'STRING' } }, required: ['title'] } } },
  required: ['n', 'stops'] } } }, required: ['days'] };
const PACE_TXT = { relaxed: 'relaxed, about 3 stops a day', balanced: 'balanced, about 5 stops a day', packed: 'packed, about 7 stops a day' };
const CATS = ['base', 'sights', 'food', 'fashion', 'pokemon', 'slowpoke'];

exports.ai = onCall({ secrets: [GEMINI_API_KEY], region: 'us-central1', timeoutSeconds: 90, memory: '512MiB', maxInstances: 5 }, async req => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Sign in first.');
  if (ALLOWED.length && !ALLOWED.includes((req.auth.token.email || '').toLowerCase())) throw new HttpsError('permission-denied', 'This account is not allowed to use AI.');
  const d = req.data || {};
  await countUse(req.auth.uid);

  if (d.task === 'extract_places') {
    const images = (Array.isArray(d.images) ? d.images : []).slice(0, 6).filter(x => typeof x === 'string' && x.length < 3_000_000);
    const text = String(d.text || '').slice(0, 12000);
    if (!text && !images.length) throw new HttpsError('invalid-argument', 'Nothing to read.');
    const parts = [{ text: 'From this social-media note (text and/or screenshots) list every shop, restaurant or place the writer recommends. For each: name as written (name), the Japanese or local-language name if shown (jp), street address if shown (address), neighbourhood/city if shown (area), and a one-line note in the note language (note). Do not invent places or addresses; leave a field empty if it is not in the source. Ignore ads and usernames.\n\n' + text },
      ...images.map(data => ({ inlineData: { mimeType: 'image/jpeg', data } }))];
    const out = await gemini(parts, { json: true, schema: PLACES_SCHEMA });
    let places = []; try { places = JSON.parse(out).places || []; } catch {}
    return { places: places.slice(0, 20).map(p => ({ name: String(p.name || '').slice(0, 80), jp: String(p.jp || '').slice(0, 80), address: String(p.address || '').slice(0, 160), area: String(p.area || '').slice(0, 60), note: String(p.note || '').slice(0, 200) })).filter(p => p.name) };
  }

  if (d.task === 'suggest_itinerary') {
    const nums = (Array.isArray(d.dayNums) ? d.dayNums : []).map(Number).filter(n => Number.isInteger(n) && n > 0 && n <= 60).slice(0, 7);
    if (!nums.length) throw new HttpsError('invalid-argument', 'No days chosen.');
    const lang = d.lang === 'zh' ? 'Traditional Chinese (Hong Kong)' : 'English';
    const wish = String(d.wish || '').slice(0, 400), pace = PACE_TXT[d.pace] || PACE_TXT.balanced;
    const prompt = `You are a practical travel planner. Suggest stops for the days listed in plan_days of the trip below.
Rules:
- Keep each day inside the area or city of that day. Use the day's area/title and its existing stops; if it has none, infer the place from the neighbouring days.
- Order the stops so travel between them is short. Give each a realistic start time in 24-hour HH:MM (destination local time). Pace: ${pace}.
- Only suggest real, well-known places that exist. Never invent a place. If opening hours matter, say "check hours" in the note.
- Do not repeat a stop that is already in the trip.
- Put the local-language name in "jp" when the place is in a country where English is not the everyday language; otherwise leave it empty. Put the neighbourhood or city in "area".
- cat must be one of: base (hotels, stations, airports), sights, food, fashion (shops), pokemon (cards, games), slowpoke.
- Write note in ${lang}, at most 110 characters.
Traveller wishes: ${wish || 'none'}
Return JSON only, in the form {"days":[{"n":<day number>,"stops":[{"time","title","jp","area","cat","note"}]}]}.
plan_days: ${JSON.stringify(nums)}
Trip: ${JSON.stringify(d.trip || {}).slice(0, 20000)}`;
    const out = await gemini([{ text: prompt }], { json: true, schema: ITIN_SCHEMA, temperature: 0.5 });
    let days = []; try { days = JSON.parse(out).days || []; } catch {}
    return { days: days.filter(x => nums.includes(x.n) && Array.isArray(x.stops)).map(x => ({ n: x.n, stops: x.stops.slice(0, 10).map(p => ({
      time: String(p.time || '').slice(0, 5), title: String(p.title || '').slice(0, 100), jp: String(p.jp || '').slice(0, 100), area: String(p.area || '').slice(0, 60),
      cat: CATS.includes(p.cat) ? p.cat : 'sights', note: String(p.note || '').slice(0, 200) })).filter(p => p.title) })) };
  }

  if (d.task === 'ask') {
    const q = String(d.question || '').slice(0, 1000); if (!q) throw new HttpsError('invalid-argument', 'No question.');
    const lang = d.lang === 'zh' ? 'Traditional Chinese (Hong Kong)' : 'English';
    const answer = await gemini([{ text: `You are a concise travel-planning assistant. Answer in ${lang}, in under 180 words, using the itinerary below. Be practical; say when you are unsure about opening hours or prices instead of guessing.\n\nItinerary JSON:\n${JSON.stringify(d.trip || {}).slice(0, 20000)}\n\nQuestion: ${q}` }]);
    return { answer };
  }
  throw new HttpsError('invalid-argument', 'Unknown task.');
});
