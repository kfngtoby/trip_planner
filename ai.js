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
