/* Stage 3: Google sign-in + per-trip sync (Firebase Auth + Firestore).
   - Off unless firebase-config.js has a config. Local storage stays the source the UI reads; sync copies it.
   - Each trip is one Firestore doc: users/{uid}/trips/{tripId} = { json, updatedAt, deleted }. Newest updatedAt wins per trip.
   - Deleted trips leave a tombstone (db.deleted) so a delete on one phone is not undone by another. */
const FB_VER = '10.12.2';
const SYNC = { user: null, ready: false, status: '', fb: null, unsub: null, timer: null, hashes: {}, applying: false };
const syncEnabled = () => !!window.FIREBASE_CONFIG;
const loadScript = src => new Promise((res, rej) => {
  if ([...document.scripts].some(s => s.src === src)) return res();
  const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(Error('Could not load ' + src)); document.head.appendChild(s);
});
async function fbLoad() {
  if (SYNC.fb) return SYNC.fb;
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}/firebase-`;
  await loadScript(base + 'app-compat.js');
  await Promise.all(['auth', 'firestore', 'functions'].map(m => loadScript(`${base}${m}-compat.js`)));
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.FIREBASE_CONFIG);
  SYNC.fb = { app, auth: firebase.auth(), fs: firebase.firestore(), fn: app.functions(window.FUNCTIONS_REGION || 'us-central1') };
  return SYNC.fb;
}
const tripHash = tr => { const { updatedAt, ...rest } = tr; return JSON.stringify(rest); };
const syncSet = (status) => { SYNC.status = status; document.querySelectorAll('[data-sync-status]').forEach(el => el.textContent = syncLabel()); };
const syncLabel = () => !syncEnabled() ? '' : !SYNC.user ? t('Not signed in') : ({ syncing: t('Syncing…'), ok: t('Synced'), offline: t('Offline: will sync later'), error: t('Sync problem') }[SYNC.status] || t('Synced'));

/* Called by saveDb() after every local save. Stamps changed trips and schedules a push. */
function syncHook() {
  if (SYNC.applying || !syncEnabled()) return;
  let changed = false;
  for (const tr of db.trips) {
    const h = tripHash(tr);
    if (SYNC.hashes[tr.id] !== h) { tr.updatedAt = Date.now(); SYNC.hashes[tr.id] = h; changed = true; }
  }
  if (changed) try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch {}
  if (SYNC.user && SYNC.ready) { clearTimeout(SYNC.timer); SYNC.timer = setTimeout(syncPush, 1500); }
}
function syncDeleteTrip(id) { db.deleted = db.deleted || {}; db.deleted[id] = Date.now(); delete SYNC.hashes[id]; }

const tripRef = id => SYNC.fb.fs.collection('users').doc(SYNC.user.uid).collection('trips').doc(id);
async function syncPush() {
  if (!SYNC.user || !SYNC.ready) return;
  if (!navigator.onLine) return syncSet('offline');
  try {
    syncSet('syncing');
    const batch = SYNC.fb.fs.batch();
    for (const tr of db.trips) if (tr.updatedAt && tr.updatedAt > (SYNC.pushed?.[tr.id] || 0)) batch.set(tripRef(tr.id), { json: JSON.stringify(tr), updatedAt: tr.updatedAt, deleted: false });
    for (const [id, ts] of Object.entries(db.deleted || {})) if (ts > (SYNC.pushed?.[id] || 0)) batch.set(tripRef(id), { json: '', updatedAt: ts, deleted: true });
    await batch.commit();
    SYNC.pushed = Object.fromEntries([...db.trips.map(t => [t.id, t.updatedAt || 0]), ...Object.entries(db.deleted || {})]);
    syncSet('ok');
  } catch (e) { console.warn('sync push', e); syncSet(navigator.onLine ? 'error' : 'offline'); }
}
/* Apply remote docs to the local db. Returns true if anything local changed. */
function syncApply(docs, first) {
  let changed = false; db.deleted = db.deleted || {}; SYNC.applying = true;
  for (const d of docs) {
    const id = d.id, r = d.data, local = getTrip(id), lt = local?.updatedAt || 0, tomb = db.deleted[id] || 0;
    if (r.deleted) {
      if (local && r.updatedAt > lt) { db.trips = db.trips.filter(x => x.id !== id); changed = true; }
      if (r.updatedAt > tomb) db.deleted[id] = r.updatedAt;
      continue;
    }
    if (tomb > r.updatedAt) continue; // deleted here more recently; the push will tell the cloud
    // A brand-new phone starts with the example trip; never let that overwrite a synced copy.
    const remoteWins = r.updatedAt > lt || (first && id === 'trip-setouchi' && !SYNC.hadMeta);
    if (remoteWins && r.updatedAt !== lt) {
      try { const tr = JSON.parse(r.json); tr.updatedAt = r.updatedAt; if (local) Object.assign(local, tr); else db.trips.push(tr); delete db.deleted[id]; SYNC.hashes[id] = tripHash(tr); changed = true; } catch {}
    }
  }
  SYNC.applying = false;
  if (changed) try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch {}
  return changed;
}
async function syncStart(user) {
  SYNC.user = user; SYNC.ready = false; syncSet('syncing');
  SYNC.hadMeta = !!db.syncMeta;
  db.trips.forEach(tr => { SYNC.hashes[tr.id] = tripHash(tr); if (!tr.updatedAt) tr.updatedAt = 1; });
  try {
    const snap = await SYNC.fb.fs.collection('users').doc(user.uid).collection('trips').get();
    const changed = syncApply(snap.docs.map(d => ({ id: d.id, data: d.data() })), true);
    db.syncMeta = { uid: user.uid, at: Date.now() }; try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch {}
    SYNC.ready = true; SYNC.pushed = {}; snap.docs.forEach(d => SYNC.pushed[d.id] = d.data().updatedAt);
    await syncPush();
    if (changed) route();
    // live updates from other devices
    SYNC.unsub?.(); SYNC.unsub = SYNC.fb.fs.collection('users').doc(user.uid).collection('trips').onSnapshot(s => {
      if (s.metadata.hasPendingWrites) return;
      const docs = s.docChanges().map(c => ({ id: c.doc.id, data: c.doc.data() }));
      if (syncApply(docs, false) && !document.getElementById('sheet')?.open) route();
    }, e => { console.warn('sync listen', e); syncSet('error'); });
  } catch (e) { console.warn('sync start', e); syncSet(navigator.onLine ? 'error' : 'offline'); }
}
async function syncInit() {
  if (!syncEnabled()) return;
  db.trips.forEach(tr => SYNC.hashes[tr.id] = tripHash(tr)); // so edits made before sign-in are noticed
  try {
    await fbLoad();
    SYNC.fb.auth.onAuthStateChanged(u => { if (u) syncStart(u).then(renderAccount); else { SYNC.unsub?.(); SYNC.user = null; SYNC.ready = false; renderAccount(); } });
    SYNC.fb.auth.getRedirectResult().catch(e => toast(e.message || 'Sign-in failed'));
    window.addEventListener('online', () => SYNC.user && syncPush());
  } catch (e) { console.warn('firebase load', e); syncSet('offline'); }
}
async function signIn() {
  try {
    await fbLoad();
    const p = new firebase.auth.GoogleAuthProvider();
    try { await SYNC.fb.auth.signInWithPopup(p); }
    catch (e) { if (/popup|operation-not-supported|web-storage/.test(e.code || '')) await SYNC.fb.auth.signInWithRedirect(p); else throw e; }
  } catch (e) { toast(e.message || 'Sign-in failed'); }
}
async function signOutNow() { try { await SYNC.fb.auth.signOut(); toast(t('Signed out. Trips stay on this phone.')); } catch {} }

/* Small account strip on the home screen. */
function accountHtml() {
  if (!syncEnabled()) return '';
  return SYNC.user
    ? `<div class="account"><span>${esc(SYNC.user.email || SYNC.user.displayName || '')}</span><small data-sync-status>${esc(syncLabel())}</small><button class="text-btn" id="acct-sync">${t('Sync now')}</button><button class="text-btn" id="acct-out">${t('Sign out')}</button></div>`
    : `<div class="account"><span>${t('Sync trips between your phones')}</span><button class="text-btn" id="acct-in">${t('Sign in with Google')}</button></div>`;
}
function renderAccount() {
  const el = document.getElementById('account-slot'); if (!el) return;
  el.innerHTML = accountHtml();
  el.querySelector('#acct-in')?.addEventListener('click', signIn);
  el.querySelector('#acct-out')?.addEventListener('click', signOutNow);
  el.querySelector('#acct-sync')?.addEventListener('click', syncPush);
}
