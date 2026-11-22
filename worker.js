/* Trip companion: Gemini proxy, single-file Cloudflare Worker (free plan, no card).
   Keeps your Gemini key on Cloudflare so it never reaches the browser.
   Paste ALL of this into Cloudflare's online editor (Workers & Pages > your worker > Edit code), then Deploy.
   1) Set ALLOWED_ORIGIN below to your app's address (no path, no trailing slash).
   2) Worker > Settings > Variables and Secrets > Add > type Secret, name GEMINI_API_KEY, value = your Google AI Studio key.
   POST /ai   body { "prompt": "..." }   -> { "text": "<JSON string from Gemini>" } */
const ALLOWED_ORIGIN = 'https://kfngtoby.github.io';
const MODEL = 'gemini-2.5-flash'; // keep in step with GEMINI_MODEL in plan.js
const MAX_PROMPT = 12000;         // characters; a trip summary + wishes is far smaller

/* The itinerary format is fixed here, so this Worker cannot be used as a general-purpose Gemini proxy. Keep in step with ITIN_SCHEMA in plan.js. */
const SCHEMA = { type: 'OBJECT', properties: { days: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
  n: { type: 'INTEGER' }, stops: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
    time: { type: 'STRING' }, title: { type: 'STRING' }, jp: { type: 'STRING' }, area: { type: 'STRING' }, cat: { type: 'STRING' }, note: { type: 'STRING' } }, required: ['title'] } } },
  required: ['n', 'stops'] } } }, required: ['days'] };

export default {
  async fetch(req, env) {
    const allowed = env.ALLOWED_ORIGIN || ALLOWED_ORIGIN, origin = req.headers.get('Origin') || '';
    const cors = { 'Access-Control-Allow-Origin': allowed || '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin' };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (new URL(req.url).pathname !== '/ai') return json({ error: 'Not found' }, 404);
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (allowed && origin !== allowed) return json({ error: 'Origin not allowed' }, 403); // browsers always send Origin on a cross-site POST
    if (!env.GEMINI_API_KEY) return json({ error: 'Gemini key is not set on the server.' }, 500);
    if (Number(req.headers.get('Content-Length') || 0) > MAX_PROMPT * 4) return json({ error: 'Request too large.' }, 413);

    let prompt;
    try { prompt = (await req.json()).prompt; } catch { return json({ error: 'Bad request.' }, 400); }
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT) return json({ error: 'Bad prompt.' }, 400);

    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.5, maxOutputTokens: 8192, responseMimeType: 'application/json', responseSchema: SCHEMA } }) });
    } catch { return json({ error: 'Could not reach Gemini.' }, 502); }
    if (!r.ok) return json({ error: r.status === 429 ? 'Gemini is busy or its free limit is reached.' : r.status === 400 || r.status === 403 ? 'Gemini rejected the key.' : 'Gemini returned an error.' }, r.status === 429 ? 429 : 502);
    const j = await r.json().catch(() => ({}));
    return json({ text: (j.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('') });
  }
};
