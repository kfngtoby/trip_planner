# Trip companion

Open `index.html` (or serve the folder with any static server, e.g. `npx serve .`).

Overview: tap the big category chips (+ adds, − removes) to filter the map and show grouped details under Search. Under the map: **All days · Week 1 · Week 2 · Week 3** (days 1–7, 8–14, 15–21…), then slide to one day of that week.

Flow: **My trips** → tap a trip (tap the name to rename) → **Overview** map · **Days** (tap a day to expand/collapse) · **Expenses** (split, members, settle up).

| File | What it does |
|---|---|
| `store.js` | All data + saving (localStorage), Google Maps link builders, geocoding |
| `app.js` | Router, home screen, trip header, Days tab |
| `places.js` | Overview map (Leaflet; OpenStreetMap tiles, muted with CSS by default; “Streets” shows full colour), week bar + day slider, place details/editor, Add place (Simple link paste / Detailed Google Maps + Xiaohongshu) |
| `fashion-catalog.js` | Curated fashion shops by city and district (Tokyo, Osaka, Kyoto, Kobe, Himeji, Okayama, Takamatsu), with chain names |
| `reco.js` | Fashion suggestions for the active day or GPS position: same city only, nearest first, one branch per chain, no 100-yen shops, live OpenStreetMap search, 小红书 search panel (app link + Bing/Google/百度 searches limited to 小红书 notes; never opens xiaohongshu.com search), JSON shop-list import |
| `fx.js` | Currency conversion: rate list, live rates (frankfurter.dev), offline cache, `fxToCents()` |
| `locate.js` | Find a place from post title + hint + photos: OCR (and optional Google Vision), Nominatim + Overpass candidates, ranking; results go to the Add place list for confirmation |
| `receipt.js` | Receipt scan: OCR in 31 languages, language + currency detection, local-digit parsing, total suggestions, multi-photo queue |
| `splitter.js` | Expenses, cost split, members, settlement |
| `tz.js` | Timezones (from TREK's destination clock idea): trip + home zone, DST-safe offsets, "today" by the destination's calendar, home-time equivalents, flight elapsed time |
| `locale.js` | EN / 中文 strings |
| `seed.js` | Example trip loaded on first run (from the old spots.json + itinerary) |
| `seed-research.js` | 小红书 research merged into the example trip once, without overwriting edits |
| `slowpoke.js` | The wandering, draggable Slowpoke in the top bar |
| `sw.js`, `manifest.webmanifest`, `icons/` | Home-screen install and offline use |

Data is saved on the device. To share a trip between phones, swap `loadDb()` / `saveDb()` in `store.js` for your backend.

## Putting it on a phone
The app must be served from a web address; phones won't run it straight from the zip.
Quickest: unzip, drag the folder onto https://app.netlify.com/drop, open the link on the phone,
then Share → Add to Home Screen (iPhone, Safari) or ⋮ → Add to Home screen / Install app (Android, Chrome).
When you deploy changes, bump `VERSION` in `sw.js` (and the `?v=` numbers in `index.html`).

## Timezones
Each trip has a destination and a home timezone (Rename trip → set both). Overview and Days show both clocks, the offset and `Day n/N` or days-to-go. Stop times are destination-local; each shows its home equivalent (`≙ 08:00`, `+1d` across midnight). A stop can be set to another zone (e.g. a flight departing in HKT) and the gap between stops shows real elapsed time (⏱). Sort-by-time compares true instants.

## Currencies
Each expense has a **Bill currency** next to the amount. If it differs from the trip currency, a rate box appears (live rate fetched, editable, cached for offline). The expense is stored in the trip currency (so balances and settle-up stay consistent) and keeps the original amount, currency and rate (shown under the amount in the list and in the CSV). Scan receipt detects the receipt's language and currency and fills both; pick a language manually to re-read the same photo.

## Fashion suggestions (v26)
Turn on **Fashion & cosmetics**. The box at the top lists shops for the day picked on the slider (or today during the trip), only in that day's city, nearest first.
- **Near me** uses the phone's GPS (needs https and location permission).
- **More nearby** asks OpenStreetMap live for every fashion shop within ~1.5 km; chains are merged so each appears once.
- **小红书** buttons open a Xiaohongshu search. The app cannot read Xiaohongshu itself (login wall, no public API).
- **Import shop list**: a JSON array like `[{"name":"…","jp":"…","city":"Tokyo","area":"Koenji","lat":35.70,"lon":139.65,"subs":["furugi"],"note":"…","zh_name":"…","zh_note":"…","source":"小红书"}]` adds shops on this phone.

## v27 (stage 2: Add place)
- **Simple add** has three sources: **Google Maps link**, **Photo** (find from photos, plus an *Open Google Lens* button: `lens.google.com`, untested on phones; type what Lens finds into the hint box) and **小红书 text** (paste the note's text; nothing is sent to 小红书). **Detailed** is unchanged.
- **Import shop list** (fashion box) now takes pasted 小红书 text, screenshots (read on the phone with OCR, needs a connection the first time) or JSON. Shops are located with OpenStreetMap search, shown for you to tick, then saved.
- Accounts, sync and Gemini are stage 3 (below).

## v27 (stage 1)
- **小红书 safety:** no button opens xiaohongshu.com's search page any more (login wall + rate limits, a likely cause of 账号异常). They open a panel: 小红书 app link on phones (keywords copied; `xhsdiscover://` is untested), plus Bing / Google / 百度 searches limited to 小红书 notes. Nothing in the app contacts 小红书.
- **Language switch:** top-right on every screen, larger, 🌐 with a blue outline; Slowpoke stays clear of it.
- **Map:** muted light default, “Streets” button for full OpenStreetMap (choice remembered). Not visually checked here (tiles are blocked in the build sandbox).
- **Categories:** chips with 0 places for the selected day are hidden; fashion style chips hide a 0 count.

## v27 (stage 3: accounts, sync, Gemini)
Everything here is **off until `firebase-config.js` has your Firebase web config**. With it left as `null` the app behaves exactly like stage 2.

**What it does**
- **Sign in with Google** (strip at the top of My trips). Trips sync per user: each trip is one Firestore doc, `users/{uid}/trips/{tripId}`. The newest edit of a trip wins; deletes sync too. Other phones update live. Offline edits are pushed when you are back online.
- **AI via a Cloud Function** (`functions/index.js`, callable `ai`). The Gemini key lives only there as a secret, never in the app. Signed-in users only, default 60 requests per user per day (`AI_DAILY_LIMIT`), optional email allow-list (`ALLOWED_EMAILS`).
  - *Import shop list → Read with AI*: Gemini reads pasted text and screenshots (replaces on-phone OCR) and lists shops, which are then located and ticked as before.
  - *Trip menu (⋯) → Ask AI about this trip*: a question answered from a compact summary of that trip.
- When AI is used, the text, screenshots (shrunk to 1280 px) or trip summary are sent to Google's Gemini API. Nothing else is.

**Setup (once)**
1. Firebase console → create a project → upgrade to **Blaze** (Cloud Functions need it; light use is normally within the free quota, but set a budget alert).
2. Build → **Authentication** → Sign-in method → enable **Google**. Authentication → Settings → Authorized domains → add the domain you host the app on.
3. Build → **Firestore Database** → create (production mode).
4. Project settings → Your apps → add a **Web app** → copy `firebaseConfig` into `firebase-config.js`.
5. Get a Gemini API key from Google AI Studio, then in this folder:
   `npm i -g firebase-tools && firebase login && firebase use --add`
   `firebase functions:secrets:set GEMINI_API_KEY`
   `(cd functions && npm install)`
   `firebase deploy --only functions,firestore:rules`
6. Host the app on an https address that is in the authorized domains (`firebase deploy --only hosting` works, or keep Netlify). Bump `VERSION` in `sw.js` when you deploy.

**Not verified (no network or Firebase project in the build sandbox)**
- Sign-in, Firestore sync, the Cloud Function and Gemini calls have not been run end to end. Sign-in uses a popup with a redirect fallback; Google sign-in inside an iPhone home-screen app can be awkward, so test that first.
- Conflicts: if the same trip is edited on two phones before they sync, the later edit replaces the earlier one for that whole trip (no field-level merge).
- First sign-in on a second phone: the example trip is replaced by the synced copy; other trips are merged by id.
- `GEMINI_MODEL` defaults to `gemini-2.5-flash`; change it (`firebase functions:config` or an env var) if Google retires the name.
- Fashion shops added with Import shop list are stored in a separate local list and are not synced yet.

## v27d (map fix)
CARTO basemaps began returning "API KEY REQUIRED" placeholder tiles. Both map styles now use OpenStreetMap tiles (muted via `.base-muted` CSS for the default). The service worker tile cache was renamed to `tiles-v2` so the cached placeholder tiles are dropped on the next launch.

## v27e
**Map**
- Three base styles, one button (bottom of the map controls cycles **Simple → Streets → Dark map**; the choice is remembered). Simple is OpenStreetMap run through a calm, low-saturation filter (cream land, dusty-blue water, soft roads); Dark is a slate version. Both sit on a matching background colour so loading tiles never flash grey.
- **Numbered route** (switch in the middle left of the map, “1·2·3 Route”): turn it on, then tap pins in order. Each tapped pin becomes 1, 2, 3 … (green = start, red = last/end). Tap a numbered pin again to take it out; the rest renumber. The panel at the bottom of the map lists the order, lets you pick Drive / Walk / Bike, and **Get directions** opens Google Maps with #1 as the start, the last number as the destination and the rest as waypoints. Limit: 11 points (Google allows 9 waypoints). Transit is not offered because Google ignores waypoints in transit mode. Switching the tool off hides the numbers but keeps the sequence until you press Clear.

**Days tab**
- **AI itinerary** panel (collapsed by default, under the clocks). Weeks are collapsed too (Week 1, Week 2, Week 3 …). Open a week, then use the slider to pick one day, or “Week” for all of its days. Add optional wishes and a pace, press **Suggest stops**. Suggestions are listed with tick boxes; **Add** puts the ticked ones into the days. With “Also pin them on the map” on, each new place is looked up (OpenStreetMap, about one per second) so it can be routed; a place already in the trip is reused, not duplicated. Undo is offered after adding.
- Two ways to reach Gemini:
  1. **Signed in (stage 3):** goes through the Cloud Function, new task `suggest_itinerary`. Redeploy with `firebase deploy --only functions`. The key stays on the server.
  2. **Key on this device:** press **Gemini key** in the panel and paste a Google AI Studio key. It is stored in this browser only (`localStorage`) and the browser calls Gemini directly. Convenient, but anyone with access to the device’s browser can read it; use a restricted key. Without Firebase configured this is the only route.
- **Delete day:** a red **Delete day** button now sits on every day card next to Edit day, and the Edit day sheet has a full-width Delete button showing the stop count. A day with stops asks first; Undo appears either way.
- **Stops:** tap or left-click anywhere on a stop (not just its title) to edit it. **Swipe right** to remove it (past about a third of the width; shorter swipes snap back). Undo appears. Links and chips inside a stop still work. The editor still has a Delete stop button for keyboard use.

Files: new `plan.js`; changes in `places.js`, `app.js`, `store.js` (`gmapsSeqUrl`), `style.css`, `locale.js`, `functions/index.js`. `VERSION` is `trips-v27e`.

**Not verified:** run in headless Chromium with a stand-in for Leaflet and mocked Gemini/Nominatim replies (the real tile servers, Gemini and Firebase are not reachable from the build sandbox), so: the map colours were checked on a swatch of OpenStreetMap’s standard colours, not on live tiles; the Gemini calls, key handling in the browser and the Cloud Function task have not been run against the real service; Google Maps links follow Google’s documented URL format but were not opened; swipe was tested with Chromium touch and mouse input, not on an iPhone.


## v28: Food and Shopping discovery

Run on localhost or host the complete extracted folder over HTTPS. In Days, expand a day and tap Find food or Find shopping. Enter a Japanese/English station or district, use a mapped itinerary stop, or opt into Near me. Choose a type, then filter the loaded results. Add to day creates a linked itinerary stop and offers Undo. No billing, Gemini, Firebase or API key is needed. The original storage key and optional Firebase configuration are unchanged. Updating the same deployment origin preserves local data; a different origin has separate storage.

Live discovery uses Nominatim and Overpass; failures fall back to saved/imported places and the bundled catalogs. Tabelog and Xiaohongshu are external research links, not live rating or inventory feeds. The Himeji ramen starter records intentionally have no assigned coordinates, ratings or prices; use their Maps or source links to verify them. Tabelog references: https://tabelog.com/en/hyogo/A2805/A280501/rstLst/MC/ , https://tabelog.com/en/hyogo/A2805/A280501/28026033/ and https://tabelog.com/en/hyogo/A2805/A280501/28031866/ . User-entered ratings and budget filters do not infer missing values. Imports are local to this browser. OCR may require an initial network download. The Light map is a muted OSM style, not a separate tile provider. The supplied mascot is a JPEG converted to PNG, so its background remains.

Testing: JavaScript parse checks, local package path checks, and Node tests for discovery helpers and a mocked itinerary add. Live providers, iPhone Safari/Home Screen installation, GPS prompts, and physical-device touch/keyboard layout still need device testing. Optional Firebase Functions code is included but was not deployed.

## Map update (map1/map2)
Overview tab: Light/Normal map toggle, city focus bar, more Chinese labels. `sw.js` now fetches index.html network-first and reloads once when a new version takes over, so deploys show on the next load. Bump `VERSION` in `sw.js` and the `?v=` ids in `index.html` together on every deploy.

## Discovery update (map3)
- Find food / Find shopping: the OpenStreetMap (Overpass) query now filters by the chosen type on the server, so busy areas no longer hit the 400-result cap before the type filter runs. It tries a second public Overpass server if the first fails.
- Results are kept on the device for 24 hours (up to 10 searches, key `trip-osm-v1`). Repeat searches are instant; if both servers fail, older saved results are shown with a notice.
- "Search 小紅書" now opens Bing / Google / 百度 (and the app on phones) in a row inside the sheet, so the search sheet and its settings stay open.

- map4: the Days tab now has an always-visible Find food / Find shopping row under the toolbar (uses today, else the first open day, else Day 1). The same buttons are still inside each expanded day.

- map5: Overview tab: removed the city bar, "+ Add place" and the "Route in Google Maps" link; the search box now sits directly under the category row; "All" is replaced by Find food / Find shopping (they use the selected day, else today, else the first day). icons/slowpoke.png now has a transparent background.
