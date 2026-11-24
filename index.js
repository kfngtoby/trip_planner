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

  throw new HttpsError('invalid-argument', 'Unknown task.');
});
