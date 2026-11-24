# Trip companion

An offline-first, installable trip planner that runs as a static site (no build step, no backend required).
Itinerary by day, a map, food and shopping discovery, expense splitting with currency conversion, and and a CSV import/export for the Days tab.
Optional: Google sign-in with per-trip sync, and Gemini-powered shop-list import through a Cloud Function. There is no AI itinerary feature and no timezone clock.

## Run it
Serve the folder over http(s); phones will not run it straight from a zip.

- Local: `npx serve .` (or any static server), then open the printed address.
- GitHub Pages / Netlify / Firebase Hosting: publish the folder as-is (`.nojekyll` is included for GitHub Pages).
- Phone: open the address, then Share → Add to Home Screen (iPhone Safari) or ⋮ → Install app (Android Chrome).

Data is stored on the device (`localStorage`, key `trip-companion-v3`). A different address (origin) has separate storage.

## Using it
**My trips** → tap a trip (tap the name to rename) → **Overview** (map) · **Days** · **Expenses**.

- **Overview**: category chips filter the map and the grouped details under Search. Under the map: All days, Week 1, Week 2 … side by side (no arrow), then a day slider for the chosen tab. In All days the slider covers the whole trip and scrolls sideways, with an arrow column (→ W2) marking where each new week starts. Map is **Light** (muted OpenStreetMap) or **Normal** (full colour); the choice is remembered. Numbered route mode: tap pins in order, pick Drive / Walk / Bike, and open the route in Google Maps (max 11 points).
- **Days**: expand a day to edit stops. The toolbar has separate **Import CSV** and **Export CSV** buttons (see below). Tap a stop to edit, swipe right to remove (Undo is offered). Delete day is on each day card. There is no Find nearby on the Days tab; use Find Nearby on the Overview.
- **Expenses**: split costs, members, settle up, CSV export. Each expense has a bill currency; a live rate is fetched (frankfurter.dev), editable, and cached for offline. The amount is stored in the trip currency with the original amount and rate kept. Receipt scan (photos or PDFs; OCR, 31 languages) detects language and currency, shows the receipt, and picks the total by itself using a dictionary of total / amount-due wording (Chinese, Japanese and English first, then the other languages; fapiao 大写 and 領収書 kanji amounts too). To change it, tap the right number on the picture: tapping the label or anywhere on that row also works, and Zoom enlarges the picture for small print. PDFs with a text layer are read directly, without OCR.

### Days CSV (`csv.js`)
Two toolbar buttons on the Days tab. **Export CSV** downloads the whole itinerary in one tap. **Import CSV** opens a sheet to choose a file, download a sample file, or use quick entry. Sample, export and import share one layout, so an exported file can be edited and imported again:

| Column | Meaning |
|---|---|
| Date | `YYYY-MM-DD` (`YYYY/M/D` also works). Wins over Day when both are filled |
| Time | Free text. `9:00`, `9am`, `9:30pm` are normalised to `09:00`, `09:00`, `21:30` |
| Category | `base`, `sights`, `food`, `fashion`, `shopping`, `pokemon`, `slowpoke` (the label also works) |
| Day | Day number, 1 = first day |
| Title | Stop name (falls back to Map place when empty) |
| Map place | Name of the pin. An existing place with that name is reused, otherwise a new one is created |
| Notes | Free text. Predefined tags are written as `[Book ahead]`, `[Cash only]`, `[Check hours]`, `[Closed Mon]`, `[Queue early]`, `[Photo spot]`, `[Rain plan]`, `[Tax-free]` |
| Lat, Lon | Optional; give a new place a map pin (must be a valid coordinate) |
| Day title, Area | Optional; fill a day's title / area when it has none yet |
| Hours, Link | Optional; fill a place's opening hours / `http(s)` link when it has none yet |

- **Import** is preview-first: the chosen file is checked on a copy of the trip and every row is listed as *New*, *Already there*, *New day* or *Error*, with counts. Nothing is saved until you press *Import N stops*; Undo is offered afterwards.
- Import only adds. A stop with the same day, time, title and place as one already in the trip is skipped, so re-importing an export changes nothing; two identical lines inside one file both come in. New dates create new days. Existing day titles, areas, place hours and links are never overwritten.
- Bad rows (invalid date, Day outside 1-90) are reported and skipped; unknown categories fall back to `sights` and invalid coordinates add no pin, both with a warning.
- Files are read as UTF-8; a non-UTF-8 file (e.g. Excel Big5) is read as Big5 with a warning. Comma, semicolon and tab separators are detected.
- **Export** writes the same columns (UTF-8 with BOM, opens in Excel). A day with no stops becomes a row with only Date, Day, Day title and Area. Text starting with `=`, `+`, `-` or `@` gets a leading `'` so spreadsheets do not run it as a formula; import strips it again.
- **Quick entry** (inside the Import sheet) has tap-to-fill chips for time, category and note tags. Press *Add row*, then download the rows or preview and add them to the trip.
- Not in the CSV: expenses, place photos and other place details. Use *Export trip backup* for a full copy.


### Excel export (`xlsx.js`)
**Export Excel** sits next to Export CSV on the Days tab and downloads an `.xlsx` styled like the Voyana itinerary template (Itinerary + Trip Info sheets). It is a report only: there is no Excel import, and the CSV export is unchanged.

Columns: Day · Date · Time · Type · Location · Location link · Coordinates · Notes.

- Date is a formula off the Trip Info start date when the trip's days are consecutive, otherwise plain dates.
- Type comes from the place's category (`XLSX_TYPE_BY_CAT` in `xlsx.js`: base → Hotel, food → Meal, everything else → Activity). Stops with no place, or at a Hotels & transport place, are sorted by words in the title (`XLSX_TYPE_WORDS`: Flight, Train, Transfer, Hotel, Meal, Free time). The dropdown list lives on Trip Info.
- Coordinates come from the place's pin, or are decoded from a long Google Maps link, and link to OpenStreetMap. Short `maps.app.goo.gl` links cannot be decoded in the browser; give the place a pin instead.
- ExcelJS is vendored in `vendor/` (MIT), loaded on the first export, and cached by the service worker for offline use.

### Find food (Tabelog search builder)
Nothing is fetched from Tabelog and no server is needed. **Find food** opens a small form that builds the search for you:

- **Area**: a station or district, prefilled from the day's place. "Himeji" or 姬路 is converted to 姫路 with a Nominatim lookup, and the form shows what it will search as.
- **Search key** (optional): any extra word, such as tsukemen or private room.
- **Food type**: Any, Ramen, Sushi, Udon, Yakiniku, Izakaya, Okonomiyaki, Italian, or Café & sweets. The type is added to the search as its Japanese keyword.
- **Minimum rating**: Any, 3.0+, 3.5+, or 4.0+.
- **Open on Tabelog**: opens tabelog.com in a new tab with the search sorted by rating, highest first.

Example: area `Himeji station`, type Ramen, rating 3.5+ opens the Tabelog results for 姫路駅 + ラーメン, best rated first.

Limit: I could not confirm a Tabelog URL setting that filters by score, so the minimum rating is a reminder, not a filter. Results arrive highest first, so stop reading where scores fall below your minimum.


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
| `csv.js` | Days tab CSV import, export and quick-entry template |
| `discovery.js` | Find food (Tabelog search builder) / Find shopping (OpenStreetMap) |
| `reco.js`, `fashion-catalog.js` | Fashion suggestions and curated catalog |
| `locate.js` | Find a place from title, hint and photos (OCR, optional Google Vision, Nominatim + Overpass) |
| `receipt.js`, `fx.js`, `splitter.js` | Receipt OCR, currency conversion, expenses and settlement |
| `locale.js` | EN / 中文 strings |
| `seed.js`, `seed-research.js` | Example trip on first run; research merged in once without overwriting edits |
| `slowpoke.js` | The draggable mascot in the top bar |
| `sync.js`, `ai.js`, `firebase-config.js` | Optional sign-in, sync and shop-list AI client (inactive while `FIREBASE_CONFIG` is `null`) |
| `functions/index.js`, `firebase.json`, `firestore.rules` | Firebase backend (shop-list import only) and hosting config |

## Deploying changes
Bump the version in **both** places, using one value: `V` in `sw.js` and every `?v=` in `index.html`.
```
sed -i 's/36-clean/NEW/g' sw.js index.html
```
`sw.js` builds its cache list from `V`, so only the `?v=` ids in `index.html` need to match it. The page loads network-first and reloads once when a new service worker takes over.

## Optional: accounts, sync and Gemini shop-list import
Off until `firebase-config.js` has your Firebase web config (values are not secrets; access is controlled by `firestore.rules`). With it left as `null` the app is fully local.

- **Sync**: Google sign-in; each trip is one Firestore doc `users/{uid}/trips/{tripId}`. Newest edit of a trip wins (no field-level merge); deletes sync via tombstones; other phones update live; offline edits push when back online. On a second phone's first sign-in the example trip is replaced by the synced copy.
- **AI** (callable `ai` in `functions/index.js`): Import shop list → Read with AI. The Gemini key lives only in the function as a secret. Default 60 requests per user per day (`AI_DAILY_LIMIT`), optional `ALLOWED_EMAILS`, `GEMINI_MODEL` defaults to `gemini-2.5-flash`. Text and screenshots (shrunk to 1280 px) are sent to Google's Gemini API when used.

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
