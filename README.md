# Trip companion

An offline-first, installable trip planner that runs as a static site (no build step, no backend required).
Itinerary by day, a map, food and shopping discovery, expense splitting with currency conversion, and destination/home timezones.
Optional: Google sign-in with per-trip sync, and Gemini-powered features through a Cloud Function.

## Run it
Serve the folder over http(s); phones will not run it straight from a zip.

- Local: `npx serve .` (or any static server), then open the printed address.
- GitHub Pages / Netlify / Firebase Hosting: publish the folder as-is (`.nojekyll` is included for GitHub Pages).
- Phone: open the address, then Share → Add to Home Screen (iPhone Safari) or ⋮ → Install app (Android Chrome).

Data is stored on the device (`localStorage`, key `trip-companion-v3`). A different address (origin) has separate storage.

## Using it
**My trips** → tap a trip (tap the name to rename) → **Overview** (map) · **Days** · **Expenses**.

- **Overview**: category chips filter the map and the grouped details under Search. Under the map: All days · Week 1 · Week 2 … then a slider for one day. Map is **Light** (muted OpenStreetMap) or **Normal** (full colour); the choice is remembered. Numbered route mode: tap pins in order, pick Drive / Walk / Bike, and open the route in Google Maps (max 11 points).
- **Days**: expand a day to edit stops. Tap a stop to edit, swipe right to remove (Undo is offered). Delete day is on each day card. Find food / Find shopping sits under the toolbar and inside each day.
- **Expenses**: split costs, members, settle up, CSV export. Each expense has a bill currency; a live rate is fetched (frankfurter.dev), editable, and cached for offline. The amount is stored in the trip currency with the original amount and rate kept. Receipt scan (OCR, 31 languages) detects language and currency.
- **Timezones**: each trip has a destination and a home zone (Rename trip → Timezones). Clocks, `Day n/N`, home-time equivalents (`≙`, `+1d`) and flight elapsed time (⏱) are DST-safe.

### Find food (live Tabelog)
Nothing is preloaded. Flow: **Find food** → enter a location (or pick an itinerary stop, or Near me, which only fills in the place name) → choose a type → **Search** → the app reads Tabelog's rating-sorted list for that area → **Not interested · Another batch** shows the next 5.
- Each Tabelog page holds about 20 places, so the next 4 batches come from the page already fetched; a new page is fetched only when those run out (up to 10 pages). A new Search, area or type starts again from page 1.
- Each result shows the shop name, food type (and nearest station), address, Tabelog rating (with review count) and budget (dinner / lunch), and links to its Tabelog page. The list page has no full address, so the app reads it from each shop's own page right after the batch appears ("Loading address…", then the address). Those page reads count toward the daily limit. Add to day creates a linked stop with Undo.
- Browsers cannot read tabelog.com directly, so this goes through the Cloud Function task `tabelog_search`. **It needs the Firebase setup below and a signed-in user.** Otherwise the sheet says so and offers a link that opens the same search on tabelog.com.
- Limits: one page per request, cached 10 minutes on the server, 300 page fetches per user per day (`TABELOG_DAILY_LIMIT`). Tabelog has no public API and its terms restrict automated access, so keep this to light personal use. If Tabelog changes its HTML, results come back empty and the sheet shows the fallback link (parser: `functions/tabelog.js`).
- Place names are matched in Japanese: "Himeji" or 姬路 is converted to 姫路 with a Nominatim lookup before searching.

### Find shopping (`discovery.js`)
Search a station or district, a mapped stop, or use Near me (GPS, opt-in). Live data comes from Nominatim and Overpass (second Overpass server as fallback). Results are cached on the device for 24 hours (up to 10 searches, key `trip-osm-v2`); if both servers fail, older cached results are shown with a notice. Add to day creates a linked stop with Undo. 小红书 and Google links are research links, not live feeds; ratings and prices are never inferred.

### Fashion & cosmetics (`reco.js`, `fashion-catalog.js`)
Curated shops by city and district, nearest first, one branch per chain. **More nearby** queries OpenStreetMap within about 1.5 km. **Import shop list** accepts pasted 小红书 text, screenshots (on-device OCR, or Gemini when signed in) or a JSON array; shops are located, ticked by you, then saved locally (key `trip-fashion-extra`, not synced).
小红书 buttons never open xiaohongshu.com search; they open a panel with the app link (phones) and Bing / Google / 百度 searches limited to 小红书 notes. Nothing in the app contacts 小红书.

## Files
| File | Purpose |
|---|---|
| `index.html`, `style.css`, `manifest.webmanifest`, `icons/` | Shell, styles, install metadata |
| `sw.js` | Service worker: offline shell, network-first pages, map-tile cache (`tiles-v2`) |
| `store.js` | Data layer (localStorage), money in integer cents, Google Maps link builders, geocoding |
| `app.js` | Router, home screen, trip header, Days tab |
| `places.js` | Overview map (Leaflet), week bar and day slider, place editor, Add place |
| `plan.js` | AI itinerary suggestions (Gemini via Cloud Function, or a key stored on this device) |
| `discovery.js` | Find food (live Tabelog) / Find shopping (OpenStreetMap) |
| `reco.js`, `fashion-catalog.js` | Fashion suggestions and curated catalog |
| `locate.js` | Find a place from title, hint and photos (OCR, optional Google Vision, Nominatim + Overpass) |
| `receipt.js`, `fx.js`, `splitter.js` | Receipt OCR, currency conversion, expenses and settlement |
| `tz.js`, `locale.js` | Timezones; EN / 中文 strings |
| `seed.js`, `seed-research.js` | Example trip on first run; research merged in once without overwriting edits |
| `slowpoke.js` | The draggable mascot in the top bar |
| `sync.js`, `ai.js`, `firebase-config.js` | Optional sign-in, sync and AI client (inactive while `FIREBASE_CONFIG` is `null`) |
| `functions/` (`index.js`, `tabelog.js`), `firebase.json`, `firestore.rules` | Firebase backend (AI and Tabelog search) and hosting config |

## Deploying changes
Bump the version in **both** places, using one value: `V` in `sw.js` and every `?v=` in `index.html`.
```
sed -i 's/29-food10/NEW/g' sw.js index.html
```
`sw.js` builds its cache list from `V`, so only the `?v=` ids in `index.html` need to match it. The page loads network-first and reloads once when a new service worker takes over.

## Optional: accounts, sync, Gemini and live Tabelog
Off until `firebase-config.js` has your Firebase web config (values are not secrets; access is controlled by `firestore.rules`). With it left as `null` the app is fully local.

- **Sync**: Google sign-in; each trip is one Firestore doc `users/{uid}/trips/{tripId}`. Newest edit of a trip wins (no field-level merge); deletes sync via tombstones; other phones update live; offline edits push when back online. On a second phone's first sign-in the example trip is replaced by the synced copy.
- **AI** (callable `ai` in `functions/index.js`): Import shop list → Read with AI, Trip menu (⋯) → Ask AI, and the Days AI itinerary panel. The Gemini key lives only in the function as a secret. Default 60 requests per user per day (`AI_DAILY_LIMIT`), optional `ALLOWED_EMAILS`, `GEMINI_MODEL` defaults to `gemini-2.5-flash`. Text, screenshots (shrunk to 1280 px) or a trip summary are sent to Google's Gemini API when used.
- **Live Tabelog search** uses the same function and sign-in but no Gemini key.
- **Without Firebase**, the Days AI panel can use a Gemini key pasted on this device (stored in `localStorage`; use a restricted key).

Setup:
1. Firebase console: create a project, upgrade to Blaze (functions need it; set a budget alert).
2. Authentication: enable Google; add your hosting domain to Authorized domains.
3. Firestore: create a database (production mode).
4. Project settings → Web app → paste `firebaseConfig` into `firebase-config.js`.
5. `npm i -g firebase-tools && firebase login && firebase use --add`
6. `firebase functions:secrets:set GEMINI_API_KEY`, then `(cd functions && npm install)`, then `firebase deploy --only functions,firestore:rules`
7. Host on https (`firebase deploy --only hosting`, GitHub Pages or Netlify) and bump the version.

## Known limits
- Not verified end to end: Firebase sign-in, Firestore sync, the Cloud Function and live Gemini calls. Google sign-in inside an iPhone home-screen app can be awkward; test that first.
- Needs device testing: iPhone install, GPS prompts, touch gestures.
- OCR may download language data on first use. Imports and fashion extras are local to the browser.
- The Tabelog parser was tested on a sample page written to match Tabelog's markup, not on the live site; check the first real search after deploying.
