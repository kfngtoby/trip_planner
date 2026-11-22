'use strict';
/* Research gathered from Xiaohongshu (小红书) posts, merged into the example trip.
   Each patch runs once per trip (tracked in trip.patches), so it also reaches phones that
   already have the trip saved, and it never overwrites anything the user typed:
   new places are added only if their id is missing, and notes are appended, not replaced.
   Everything here is what posters reported at the time; none of it is an officially
   confirmed schedule for Dec 2026. */

const XHS = '小红书';
const gq = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const noLoc = { lat: NaN, lon: NaN };
// Compact spot builder for the Tokyo patch: o.ll = [lat, lon] when known, else a Google Maps search (o.q or the Japanese name).
const T = (id, name, jp, city, cat, days, note, o = {}) => ({ id, name, jp, city, cat, days, note,
  ...(o.ll ? { lat: o.ll[0], lon: o.ll[1] } : { ...noLoc, gmaps: gq(o.q || jp) }), ...(o.hours ? { hours: o.hours } : {}) });

const SEED_PATCHES = [{
  id: 'xhs-research-1',
  trip: 'trip-setouchi',

  addSpots: [
    // ---- Takamatsu & Kagawa Slowpoke manholes (coordinates from the manhole-hunt post) ----
    { id: 'mh_takamatsu_city', name: 'Slowpoke manhole · city centre', jp: '南新町 8-30 春風堂前', city: 'Takamatsu', cat: 'slowpoke',
      lat: 34.338889, lon: 134.049056, days: ['d26'],
      note: `${XHS}: In front of 春風堂, Minami-Shinmachi 8-30. Posters say it is reasonably close to both Pokémon Center Kagawa and the Slowpoke postbox, so it fits the afternoon loop.` },
    { id: 'mh_shodoshima_ouji', name: 'Slowpoke & Ditto manhole · Ouji Shrine', jp: '王子神社 土庄町甲222-1', city: 'Shodoshima', cat: 'slowpoke',
      lat: 34.482694, lon: 134.1875, days: [],
      note: `${XHS}: Tonosho 甲222-1 — navigate to 王子神社. About 25 min walk from Tonosho Port (one poster: ~50 min round trip). Yokai Art Museum nearby. Optional: needs the ferry.` },
    { id: 'mh_shodoshima_furusato', name: 'Slowpoke manhole · Furusato Village', jp: '小豆島ふるさと村', city: 'Shodoshima', cat: 'slowpoke',
      lat: 34.470861, lon: 134.235861, days: [],
      note: `${XHS}: Beside the souvenir shop. Cafés along the route; staff recommended the somen restaurant next door. Optional island trip.` },
    { id: 'mh_naoshima', name: 'Slowpoke & Magikarp manhole · Naoshima', jp: '香川県直島町宮浦3771-2', city: 'Naoshima', cat: 'slowpoke',
      ...noLoc, gmaps: gq('香川県香川郡直島町宮浦3771-2'), days: [],
      note: `${XHS}: Miyanoura 3771-2, near the openwork art installation at the port. Location not pinned yet — tap Edit place → Find place.` },
    { id: 'mh_sakaide', name: 'Slowpoke manhole · Sakaide Station', jp: '坂出駅', city: 'Sakaide', cat: 'slowpoke',
      lat: 34.313, lon: 133.856306, days: [],
      note: `${XHS}: Suggested as a quick stop while changing trains towards Shikoku Aquarium.` },
    { id: 'mh_aquarium', name: 'Quagsire manhole · Shikoku Aquarium', jp: '四国水族館', city: 'Utazu', cat: 'slowpoke',
      lat: 34.313417, lon: 133.807528, days: [],
      note: `${XHS}: In the seaside park behind the aquarium, by a small wooden building. The design is Quagsire (沼王), not Slowbro. Recommended for sunset photos.` },
    { id: 'mh_tadotsu', name: 'Slowpoke manhole · Tadotsu Station', jp: '多度津駅', city: 'Tadotsu', cat: 'slowpoke',
      lat: 34.27225, lon: 133.75725, days: [],
      note: `${XHS}: Beside the locomotive model at the station.` },
    { id: 'mh_marugame', name: 'Slowpoke manhole · Marugame Station', jp: '丸亀駅', city: 'Marugame', cat: 'slowpoke',
      lat: 34.292028, lon: 133.793944, days: [],
      note: `${XHS}: Beside the station. 一鶴 本店 (bone-in chicken) is nearby.` },
    { id: 'slowpoke_ferry', name: 'Slowpoke ferry · Takamatsu → Tonosho', jp: '高松港 → 土庄港', city: 'Takamatsu', cat: 'slowpoke',
      lat: 34.3517, lon: 134.0475, days: [],
      note: `${XHS}: Five themed sailings a day reported, about 1 hour each way, with themed deck seating. Slowpoke kitsune udon on board (¥660 reported). The Slowpoke booklet is available on board, and Tonosho Port has a Slowpoke photo-sticker booth (¥600). Pin is approximate (Takamatsu Port); check the current timetable before planning around it.` },

    // ---- Tottori Sandshrew manholes (addresses only) ----
    ...[
      ['hokuei', 'Hokuei', '鳥取県北栄町田井488-1'], ['yazu', 'Yazu', '鳥取県八頭町徳丸625'],
      ['hoki', 'Hoki', '鳥取県伯耆町大原997-12'], ['kurayoshi', 'Kurayoshi', '鳥取県倉吉市上井195'],
      ['daisen', 'Daisen', '鳥取県大山町名和951-6'], ['kofu', 'Kofu', '鳥取県江府町佐川908-3'],
      ['sakaiminato', 'Sakaiminato', '鳥取県境港市竹内団地252-2'], ['yonago', 'Yonago', '鳥取県米子市皆生温泉3丁目1番1号'],
      ['nanbu', 'Nanbu', '鳥取県南部町鶴田110']
    ].map(([k, city, addr]) => ({ id: `sandshrew_${k}`, name: `Sandshrew manhole · ${city}`, jp: addr, city, cat: 'pokemon',
      ...noLoc, gmaps: gq(addr), days: [],
      note: `${XHS}: ${addr}. Outside Tottori city — only practical with a car or a separate trip. Not pinned yet; “Open in Google Maps” searches the address.` })),

    // ---- Restaurants from the Takamatsu “every one tested” review ----
    { id: 'kitajima', name: 'Sakanaya-san no Izakaya (Kitajima Shoten)', jp: 'さかな屋さんの居酒屋 北島商店', city: 'Takamatsu', cat: 'food',
      ...noLoc, gmaps: gq('さかな屋さんの居酒屋 北島商店 高松'), days: [],
      note: `${XHS}: Old-style izakaya in the Hyogomachi arcade; can be noisy with groups. Praised for very fresh fish (mixed sashimi over lettuce, mackerel, whale sashimi). Fried udon and pork with bean sprouts were very salty. Seafood-focused — not suitable for a seafood allergy.` },
    { id: 'tosa_okyaku', name: 'Tosa no Okyaku', jp: '土佐のおきゃく', city: 'Takamatsu', cat: 'food',
      ...noLoc, gmaps: gq('土佐のおきゃく 高松'), days: [],
      note: `${XHS}: Tosa cuisine, known for straw-grilled bonito (katsuo). One of the reviewer’s favourites of the trip. Bonito-based — not suitable for a seafood allergy.` }
  ],

  appendNotes: {
    chikko: `${XHS} (reported, not confirmed for Dec): Slowpoke train from here to Kotoden-Kotohira at 09:00, 12:00, 15:00; returns from Kotohira 10:12 and 13:12. Kotoden day ticket ¥1,400. Themed station signs at Kawaramachi, Busshozan and Ayagawa.\nStamp rally (from 12 Sep 2026): 8 Kotoden stations + Takamatsu Airport + Pokémon Center Kagawa. Station hours reported — weekday: Takamatsu-Chikko 05:41–23:30, Kawaramachi 05:36–23:26, Busshozan 05:30–23:22, Kotoden-Kotohira 05:32–23:22, Kotoden-Shido 05:24–23:14, Ritsurin-Koen / Nagao 07:10–18:50, Ayagawa 07:10–17:50; holidays: Ritsurin-Koen / Nagao 09:10–15:50, Ayagawa 09:10–17:50. Dec 26–27 is a weekend, so expect the holiday hours.`,
    pokecen_kagawa: `${XHS}: Also a stamp-rally stop. One poster found none of the limited-edition items they wanted — buy what you see at the airport or Ritsurin-an.`,
    slowpoke_park: `${XHS}: Kotoden Ayagawa Station has a stamp (holiday hours 09:10–17:50) and a themed station sign. Manhole is beside the road below the park entrance (34°14'50.6"N 133°55'58.0"E).`,
    tak_airport: `${XHS}: Also carries the Slowpoke booklet.`,
    kindo: `${XHS} review: reserve ahead — a walk-in only worked after talking to staff. ¥17,000 for three. Recommended: thick-cut tongue, the grilled assortment, raw shredded beef with egg; beef sushi and mixed rice were skippable. ⚠ The standout salad contains marinated kombu (seaweed) — not seafood-free.`,
    yotteya: `${XHS} review: handwritten menus that phone translation struggles with. Young chicken = tender and juicy; older chicken = chewier, more flavour; both come spicy or not. Oden (especially tofu) praised; liver with bean sprouts salty.`,
    matsushita: `${XHS} review: chewy udon and good broth; the chikuwa and fish-cake toppings were ordinary (and are fish — skip them for the allergy).`,
    sandshrew_lid: `${XHS}: Tottori has 10 Sandshrew manholes in total; the other nine are saved as unassigned places (Hokuei, Yazu, Hoki, Kurayoshi, Daisen, Kofu, Sakaiminato, Yonago, Nanbu).`
  },

  appendItemNotes: {
    'i26-3': 'Slowpoke train reportedly leaves Takamatsu-Chikko at 12:00 (check). Day ticket ¥1,400.',
    'i26-4': 'Stamp-rally stop. Limited items may be sold out — the airport had the biggest range.',
    'i27-2': 'Ritsurin-Koen station stamp: holiday hours 09:10–15:50.'
  }
},{
  id: 'cards-fashion-2',
  trip: 'trip-setouchi',
  // Added Nov 2026: thrift/card stops (Book Off, Hobby Off, Aeon malls) and low-to-mid-budget women's fashion.
  // Locations are not pinned: tap Edit place → Find place, or "Open in Google Maps" (searches the address).
  // Store lists come from public store directories; stock, hours and Dec 2026 opening days are NOT confirmed.
  addSpots: [
    // ---- Cards: Book Off / Hobby Off ----
    { id: 'bookoff_sannomiya', name: 'Book Off Sannomiya Center-gai (cards, figures, games)', jp: 'BOOKOFF 三宮センター街店', city: 'Kobe', cat: 'pokemon',
      ...noLoc, gmaps: gq('兵庫県神戸市中央区三宮町2丁目10−7 グレースコウベビル 5F'), days: ['d23'],
      note: 'Grace Kobe Building 5F. Store directories list trading cards, figures, games and plastic models. Not a Super Bazaar, so expect modern cards and binders more than a deep vintage case. Walk-in from Hareruya2.' },
    { id: 'bookoff_komagabayashi', name: 'Book Off Super Bazaar · Agro Garden Komagabayashi', jp: 'BOOKOFF SUPER BAZAAR アグロガーデン神戸駒ヶ林店', city: 'Kobe', cat: 'pokemon',
      ...noLoc, gmaps: gq('兵庫県神戸市長田区南駒栄町1−7'), days: ['d23'], hours: '09:30–20:00 (per store directory)',
      note: 'The only Super Bazaar confirmed on the route. Nagata Ward, west of Sannomiya, near JR Komagabayashi. Optional: only if you have an hour to spare before heading back to Himeji (check local train times first).' },
    { id: 'bookoff_himeji_miyake', name: 'Book Off Himeji Miyake', jp: 'BOOKOFF 姫路三宅店', city: 'Himeji', cat: 'pokemon',
      ...noLoc, gmaps: gq('BOOKOFF 姫路三宅店'), days: ['d25'],
      note: 'Listed as a card shop in a store directory. Size of the card section and whether it is a Super Bazaar not confirmed. Likely outside the station area (bus/taxi). Optional evening stop.' },
    { id: 'hobbyoff_tottori_cainz', name: 'Hobby Off · Tottori Cainz Mall', jp: 'ホビーオフ 鳥取カインズモール店', city: 'Tottori', cat: 'pokemon',
      ...noLoc, gmaps: gq('ホビーオフ 鳥取カインズモール店'), days: ['d24'],
      note: 'Hobby Off outlet in Tottori. A second one, Hobby Off Tottori Koyama-higashi, has posted about buying rare cards. Both are outside the station area: bus or taxi. Only if time allows after Card Kingdom.' },

    // ---- Aeon malls ----
    { id: 'aeon_himeji_ohtsu', name: 'Aeon Mall Himeji Ohtsu', jp: 'イオンモール姫路大津', city: 'Himeji', cat: 'fashion',
      ...noLoc, gmaps: gq('兵庫県姫路市大津区大津町2-5 イオンモール姫路大津'), days: ['d25'],
      note: 'Big suburban Aeon in Ohtsu, about 800 m from Harima-Katsuhara station: bus/taxi from Himeji. Usual Aeon fashion mix; I could not confirm a card shop inside, so check the floor guide.' },
    { id: 'aeon_tottori_kita', name: 'Aeon Mall Tottori Kita', jp: 'イオンモール鳥取北', city: 'Tottori', cat: 'fashion',
      ...noLoc, gmaps: gq('鳥取県鳥取市晩稲348 イオンモール鳥取北'), days: ['d24'],
      note: 'North of the city centre: bus/taxi from Tottori Station. Usual Aeon fashion mix; I could not confirm a card shop inside, so check the floor guide. Swap-in only if the dunes and Card Kingdom leave time.' },
    { id: 'aeon_okayama_mall', name: 'Aeon Mall Okayama · fashion floors', jp: 'イオンモール岡山', city: 'Okayama', cat: 'fashion',
      lat: 34.66202, lon: 133.91735, days: ['d25'], hours: 'Specialty stores 10:00–21:00',
      note: 'About 5 min walk from Okayama Station. ZARA, H&M, Uniqlo, Muji, ABC Mart, plus a local select shop (Haremachi Tokku 365). Easy low-to-mid-budget stop, with the Pokémon Store and Furuichi in the same building.' },
    { id: 'furuichi_aeon_okayama', name: 'Furuichi · Aeon Mall Okayama 5F (cards)', jp: 'ふるいち イオンモール岡山店', city: 'Okayama', cat: 'pokemon',
      lat: 34.66226, lon: 133.91774, days: ['d25'], hours: '10:00–21:00',
      note: 'Card shop on 5F of Aeon Mall Okayama. Store directory lists One Piece, Dragon Ball and Duel Masters events; Pokémon stock not confirmed, so ask staff. Pair with the Pokémon Store (3F).' },
    { id: 'aeon_takamatsu', name: 'Aeon Mall Takamatsu · Trecaider', jp: 'イオンモール高松 トレカイダー', city: 'Takamatsu', cat: 'pokemon',
      ...noLoc, gmaps: gq('香川県高松市香西本町1−1 イオンモール高松'), days: ['d26'],
      note: 'Trecaider card shop is listed inside the mall (Kozai). West of the city centre: check the JR/bus time from Takamatsu first. Optional.' },

    // ---- Women\u2019s fashion, Kobe shopping day (low-to-mid budget, cute, jewellery, hats) ----
    { id: 'daimaru_kobe', name: 'Daimaru Kobe', jp: '大丸神戸店', city: 'Kobe', cat: 'fashion',
      ...noLoc, gmaps: gq('大丸神戸店'), days: ['d23'],
      note: 'Department store on the old-settlement side of Motomachi. Ladies\u2019 floors mix mid-priced Japanese brands; check the sale racks in the Christmas/winter sale period.' },
    { id: 'kobe_marui', name: 'Kobe Marui', jp: '神戸マルイ', city: 'Kobe', cat: 'fashion',
      ...noLoc, gmaps: gq('神戸マルイ'), days: ['d23'],
      note: 'Fashion-building format, usually strong on cute/girly mid-budget brands, accessories and bags. 5F has a #C-pla capsule-toy shop. Brand list not verified; check the floor guide.' },
    { id: 'jewelry_shobi', name: 'Jewelry Shobi', jp: 'ジュエリーショービ', city: 'Kobe', cat: 'fashion',
      ...noLoc, gmaps: gq('ジュエリーショービ 神戸 北長狭通2丁目4-1'), days: ['d23'], hours: '11:00–20:00 (older travel-guide listing: confirm)',
      note: 'Kita-Nagasa-dori 2-4-1, right by JR Sannomiya. A travel guide describes it as overseas-style designs at lower prices, no discount games. Confirm it is still open.' },
    { id: 'maxine_hats', name: 'Maxine (hats) · Toa Road', jp: 'マキシン トアロード', city: 'Kobe', cat: 'fashion',
      ...noLoc, gmaps: gq('マキシン 帽子 トアロード 神戸'), days: ['d23'],
      note: 'Long-running hat shop on Toa Road, casual to elegant own-brand hats. Older travel-guide listing: confirm it is still open. Toa Road is a short walk toward Kitano.' }
  ],

  addItems: [
    { day: 'd23', after: 'i23-3', item: { id: 'x23-1', time: 'Afternoon', title: 'Department store & fashion building', note: 'Daimaru Kobe · Kobe Marui\nCute/mid-budget brands, bags, accessories', spotId: 'daimaru_kobe' } },
    { day: 'd23', after: 'i23-4', item: { id: 'x23-2', time: 'Afternoon', title: 'Cards at Book Off', note: 'Book Off Sannomiya Center-gai · 5F\nAfter Hareruya2', spotId: 'bookoff_sannomiya' } },
    { day: 'd23', after: 'x23-2', item: { id: 'x23-3', time: 'Afternoon', title: 'Jewellery & hats', note: 'Jewelry Shobi near JR Sannomiya\nMaxine hats · Toa Road (toward Kitano)', spotId: 'jewelry_shobi' } },
    { day: 'd23', after: 'x23-3', item: { id: 'x23-4', time: 'Optional', title: 'Book Off Super Bazaar · Komagabayashi', note: 'Only if time. West of Sannomiya, on the way toward Himeji\nOpen to 20:00', spotId: 'bookoff_komagabayashi' } },
    { day: 'd24', after: 'i24-5', item: { id: 'x24-1', time: 'Optional', title: 'Hobby Off · Cainz Mall', note: 'Outside the station area: bus/taxi\nSkip if the train back is tight', spotId: 'hobbyoff_tottori_cainz' } },
    { day: 'd24', after: 'x24-1', item: { id: 'x24-2', time: 'Optional', title: 'Aeon Mall Tottori Kita', note: 'Aeon fashion mix; swap-in for a rainy/cold hour', spotId: 'aeon_tottori_kita' } },
    { day: 'd25', after: 'i25-3', item: { id: 'x25-1', time: 'Afternoon', title: 'Furuichi card shop', note: 'Aeon Mall Okayama 5F\nThen Pokémon Store 3F', spotId: 'furuichi_aeon_okayama' } },
    { day: 'd25', after: 'i25-5', item: { id: 'x25-2', time: 'After dinner · optional', title: 'Book Off Himeji Miyake', note: 'Likely bus/taxi from the station\nCheck closing time', spotId: 'bookoff_himeji_miyake' } },
    { day: 'd25', after: 'x25-2', item: { id: 'x25-3', time: 'Optional', title: 'Aeon Mall Himeji Ohtsu', note: 'Alternative to Miyake, not both\nBus/taxi from Himeji', spotId: 'aeon_himeji_ohtsu' } },
    { day: 'd26', after: 'i26-5', item: { id: 'x26-1', time: 'Optional', title: 'Aeon Mall Takamatsu · Trecaider', note: 'Kozai area, west of the centre\nCheck the train/bus time first', spotId: 'aeon_takamatsu' } }
  ],

  appendNotes: {
    aeon_okayama: 'Same building as Aeon Mall Okayama\u2019s fashion floors and Furuichi (5F cards). All three are saved as separate places on Dec 25.',
    piole: 'Piole Himeji has had a UNITED ARROWS green label relaxing shop (from an older job posting; confirm it is still there). Good low-to-mid-budget United Arrows option without leaving Himeji.',
    sannomiya: 'Fashion shops cluster here and in the old-settlement area. Cute/jirai-style and cosplay-adjacent brands are most likely found in fashion buildings like Kobe Marui. I could not verify any dedicated Lolita or cosplay shop in Kobe.',
    motomachi: 'Arcade stroll: bags, hats and accessories shops. Hat shop Maxine is a short walk away on Toa Road.'
  },
  appendItemNotes: {
    'i25-3': 'Aeon Mall Okayama: ZARA, H&M, Uniqlo, Muji. Card shop Furuichi is on 5F.'
  }
},{
  id: 'fashion-subs-3',
  trip: 'trip-setouchi',
  addSpots: [], appendNotes: {}, appendItemNotes: {},
  // Style tags are "likely" for each building type, not verified per shop.
  setSubs: {
    piole: ['basics', 'girly', 'select', 'shoes', 'bags', 'jewels'],
    grand_festa: ['jewels', 'bags'],
    donki_himeji: ['cosplay', 'jewels'],
    donki_takamatsu: ['cosplay', 'jewels'],
    sannomiya: ['basics', 'girly', 'jirai', 'shoes', 'bags', 'jewels', 'hats'],
    kobe_hankyu: ['girly', 'jirai', 'select', 'office', 'shoes', 'bags', 'jewels'],
    daimaru_kobe: ['girly', 'select', 'office', 'shoes', 'bags', 'jewels'],
    kobe_marui: ['girly', 'jirai', 'shoes', 'bags', 'jewels'],
    motomachi: ['girly', 'shoes', 'bags', 'hats', 'jewels'],
    harborland: ['basics', 'girly', 'select', 'shoes', 'bags', 'jewels'],
    jewelry_shobi: ['jewels'],
    maxine_hats: ['hats'],
    mitsukoshi: ['select', 'office', 'shoes', 'bags', 'jewels'],
    aeon_okayama_mall: ['basics', 'denim', 'girly', 'shoes', 'bags', 'hats', 'jewels'],
    aeon_himeji_ohtsu: ['basics', 'denim', 'shoes', 'bags', 'hats', 'jewels'],
    aeon_tottori_kita: ['basics', 'denim', 'shoes', 'bags', 'hats', 'jewels'],
    bookoff_komagabayashi: ['thrift', 'bags']
  }
},{
  id: 'tokyo-leg-4',
  trip: 'trip-setouchi',
  // Added Nov 2026: Tokyo leg Dec 27 - Jan 3 (Airbnb in Sumida City, Shinkansen to Shin-Osaka Jan 3 14:09).
  // Sources: public web guides (New Year closures, card-shop and Book Off guides). Hours and New Year opening
  // days for 2026-27 are NOT confirmed by the shops: check each shop page/Google Maps the day before.
  // Pins marked "Not pinned" open a Google Maps search; the Airbnb needs its exact address (Edit place).
  addDays: [
    { id: 'd28', date: '2026-12-28', title: 'Card day: Akihabara & Nakano', place: 'Akihabara / Nakano', items: [
      { id: 'i28-1', time: '10:00–11:30', title: 'Book Off Akihabara Ekimae', note: 'Six floors by the station. Games and cards on the lower floors. Opens about 10:00', spotId: 'bookoff_akiba' },
      { id: 'i28-2', time: '11:30–13:30', title: 'Akihabara card shops', note: 'Card Rush · Mandarake Complex (vintage Base Set and promos reported)\nCompare prices across shops before buying', spotId: 'cardrush_akiba' },
      { id: 'i28-3', time: '14:00–18:00', title: 'Nakano Broadway vintage cards', note: 'Mandarake 2F (opens 12:00) · Tri Attack B1F · FUN! Fare 1F (graded / old-back)\nMany small shops are cash only. Year-end hours may be shorter', spotId: 'mandarake_nakano' },
      { id: 'i28-4', time: 'Evening', title: 'Dinner & back to Sumida', note: 'Last normal shopping days before the New Year closures', spotId: '' }
    ] },
    { id: 'd29', date: '2026-12-29', title: 'Harajuku & Shibuya fashion', place: 'Harajuku / Shibuya', items: [
      { id: 'i29-1', time: '10:30', title: 'Takeshita Street', note: 'Cute, jirai, Lolita, cosplay, hats, hair accessories and jewellery in one lane\nGo early: crowded by noon', spotId: 'harajuku_takeshita' },
      { id: 'i29-2', time: 'Afternoon', title: 'SHIBUYA109 · gyaru & girly', note: 'Mid-budget trend brands, shoes, bags', spotId: 'shibuya109' },
      { id: 'i29-3', time: 'Afternoon', title: 'Shibuya PARCO · Pokémon Center', note: 'Pokémon Center Shibuya 6F (reported 10:00–21:00)\nDesign Lab can have long waits: go there first', spotId: 'pokecen_shibuya' },
      { id: 'i29-4', time: 'Evening', title: 'Back to Sumida', note: 'Buy food for the holiday: many supermarkets close Jan 1–3', spotId: '' }
    ] },
    { id: 'd30', date: '2026-12-30', title: 'Machida Super Bazaar & Shimokitazawa', place: 'Machida / Shimokitazawa', items: [
      { id: 'i30-1', time: '09:00', title: 'To Machida', note: 'About 35 min from Shinjuku by Odakyu rapid express', spotId: '' },
      { id: 'i30-2', time: '10:00–13:30', title: 'Book Off Super Bazaar Machida', note: 'Biggest books-and-hobby floor inside Tokyo (2,360 m²), cards and toys included\nReported hours 10:00–21:30: confirm year-end hours', spotId: 'bookoff_machida' },
      { id: 'i30-3', time: 'Afternoon', title: 'Shimokitazawa vintage', note: 'On the Odakyu line back toward Shinjuku\nFurugi shops, hats, bags, jewellery. Some small shops close from Dec 30', spotId: 'shimokita' },
      { id: 'i30-4', time: 'Evening', title: 'Dinner · restaurants start closing', note: 'Many independent restaurants close Dec 30 or 31 until Jan 3–5', spotId: '' }
    ] },
    { id: 'd31', date: '2026-12-31', title: "New Year's Eve in Sumida", place: 'Sumida / Asakusa', items: [
      { id: 'i31-1', time: 'Morning', title: 'Pokémon Center Skytree Town', note: 'Skytree Town Solamachi East Yard 4F, walkable from Sumida\nNew Year Eve hours are often shortened: check before going', spotId: 'pokecen_skytree' },
      { id: 'i31-2', time: 'Afternoon', title: 'Kinshicho shopping', note: 'Kinshicho Marui · Book Off Lotte City Kinshicho\nDepartment stores often close early today', spotId: 'kinshicho_marui' },
      { id: 'i31-3', time: 'Evening', title: 'Toshikoshi soba & temple bells', note: 'Asakusa / Sensoji area is very crowded after dark\nKonbini are the reliable fallback for food', spotId: 'asakusa_sensoji' }
    ] },
    { id: 'd32', date: '2027-01-01', title: 'New Year’s Day · hatsumode', place: 'Tokyo', items: [
      { id: 'i32-1', time: 'Morning', title: 'Hatsumode (first shrine visit)', note: 'Meiji Shrine or Sensoji: both extremely crowded. A local Sumida shrine is calmer\nShrines and temples are open; most shops, department stores, banks and post offices are closed', spotId: 'meiji_shrine' },
      { id: 'i32-2', time: 'Afternoon', title: 'Quiet day / Skytree', note: 'Tokyo Skytree is reported open on Jan 1\nTokyo National Museum reportedly reopens Jan 1, 2027: check the hours\nBook one big dinner for Jan 3 or 4, not today', spotId: 'tokyo_skytree' }
    ] },
    { id: 'd33', date: '2027-01-02', title: 'Lucky bags & Ikebukuro', place: 'Ikebukuro', items: [
      { id: 'i33-1', time: 'Morning', title: 'Lucky bags (fukubukuro)', note: 'Stores split: discount chains open Jan 1, Isetan / Mitsukoshi camp Jan 2, Takashimaya / Hankyu about Jan 3\nIkebukuro PARCO opened 10:00 on Jan 2 last year: confirm', spotId: 'ikebukuro_parco' },
      { id: 'i33-2', time: 'Midday', title: 'Pokémon Center Mega Tokyo', note: 'Closed after a March 2026 incident and planned to reopen in September: confirm it is open\nBook Off Ikebukuro Sunshine 60-dori on the way', spotId: 'pokecen_mega' },
      { id: 'i33-3', time: 'Afternoon', title: 'animate & Otome Road', note: 'Cosplay and anime goods', spotId: 'animate_ikebukuro' },
      { id: 'i33-4', time: 'Optional', title: 'Imperial Palace New Year greeting', note: 'Usually held Jan 2: check the Imperial Household Agency site. Big queues', spotId: '' }
    ] },
    { id: 'd34', date: '2027-01-03', title: 'Tokyo Station → Shin-Osaka', place: 'Tokyo → Osaka', items: [
      { id: 'i34-1', time: 'By 10:00', title: 'Airbnb checkout', note: 'Large suitcase? Shinkansen needs an oversize-baggage seat reservation if the three sides add up to more than 160 cm. Check before buying more bags', spotId: 'tokyo_airbnb' },
      { id: 'i34-2', time: '11:00–13:15', title: 'Pokémon Store Tokyo Station', note: 'Inside Tokyo Station · Character Street. Last cards and gifts\nHoliday return-travel peak is Jan 2–4: stations are packed, allow extra time', spotId: 'pokestore_tokyo_stn' },
      { id: 'i34-3', time: '14:09–16:36', title: 'Shinkansen Tokyo → Shin-Osaka', note: 'Reserved seats on Jan 3 sell out early: confirm your reservation\nOsaka leg starts on arrival', spotId: 'tokyo_station' }
    ] }
  ],

  addSpots: [
    T('tokyo_airbnb', 'Tokyo Airbnb · Sumida City', '墨田区', 'Tokyo', 'base', ['d27', 'd34'], 'Your base Dec 27 – Jan 3. Check-in from 16:00. Exact pin not set: tap Edit place and paste the Airbnb address.', { q: '墨田区', hours: 'Check-in from 16:00' }),
    T('tokyo_station', 'Tokyo Station (Shinkansen)', '東京駅', 'Tokyo', 'base', ['d34'], 'Jan 3 Shinkansen to Shin-Osaka departs 14:09, arrives 16:36. Reserved seats on this day sell out early.', { ll: [35.6812, 139.7671] }),
    T('bookoff_akiba', 'Book Off Akihabara Ekimae', 'ブックオフ 秋葉原駅前店', 'Tokyo', 'pokemon', ['d28'], 'Six floors outside the station (1-6-4 Kanda-Sakumacho), refurbished late 2025, so follow the floor board. Games, cards, manga. Tax-free branch. Since 1 Nov 2026 tax-free means paying in full and claiming the refund before departure. Standard branch, not a Super Bazaar.', { q: 'ブックオフ 秋葉原駅前店 千代田区神田佐久間町1-6-4' }),
    T('cardrush_akiba', 'Card Rush Akihabara', 'カードラッシュ 秋葉原', 'Tokyo', 'pokemon', ['d28'], 'Reported as strong on high-value singles and PSA slabs. Several other card shops are within a ten-minute walk, so compare prices. Stock not confirmed.', { q: 'カードラッシュ 秋葉原 外神田1丁目18-18' }),
    T('mandarake_akiba', 'Mandarake Complex Akihabara', 'まんだらけ 秋葉原 コンプレックス', 'Tokyo', 'pokemon', ['d28'], 'Eight-storey Mandarake. Reported to carry vintage Pokémon (1st edition Base Set, early promos). Reported 12:00–20:00; confirm.', { q: 'まんだらけ 秋葉原' }),
    T('mandarake_nakano', 'Nakano Broadway · Mandarake & card shops', '中野ブロードウェイ まんだらけ カード館', 'Tokyo', 'pokemon', ['d28'], 'Best district for vintage and old-back cards. Mandarake card dept 2F (reported 12:00–20:00), Tri Attack B1F (bulk bins, buy-back), FUN! Fare 1F (PSA slabs, old-back), Kaikai Kiki Card Station 3F. Many shops cash only.', { ll: [35.7083, 139.6656], hours: '12:00–20:00 (Mandarake)' }),
    T('bookoff_machida', 'Book Off Super Bazaar Machida Chuo-dori', 'ブックオフスーパーバザー 町田中央通り店', 'Tokyo', 'pokemon', ['d30'], 'Largest Book Off inside Tokyo: 2,360 m² Books and Hobby building (clothing is in a separate building), 4-4-8 Haramachida, 3–7 min from Machida Station. Reported 10:00–21:30. Card section size not confirmed, but a Super Bazaar hobby floor is the best Book Off bet for loose packs and old cards. Allow 3 hours.', { q: 'ブックオフスーパーバザー 町田中央通り店', hours: '10:00–21:30 (reported)' }),
    T('bookoff_kawasaki', 'Book Off Super Bazaar 409 Kawasaki Minatocho', 'ブックオフスーパーバザー409号川崎港町店', 'Kawasaki', 'pokemon', [], 'Largest near Tokyo (4,740 m², about 500,000 items) but in Kanagawa, about 40 min from Shinagawa with a transfer, and much of the floor is clothing and household goods. Optional. Not assigned to a day.', { q: 'ブックオフスーパーバザー409号川崎港町店', hours: '10:00–21:00 (reported)' }),
    T('bookoff_kinshicho', 'Book Off Lotte City Kinshicho', 'ブックオフ ロッテシティ錦糸町店', 'Tokyo', 'pokemon', ['d31'], 'Closest Book Off to a Sumida Airbnb. Reported for foreign-language books; card section size not confirmed. Quick look only.', { q: 'ブックオフ ロッテシティ錦糸町店' }),
    T('bookoff_ikebukuro', 'Book Off Ikebukuro Sunshine 60-dori', 'ブックオフ 池袋サンシャイン60通り店', 'Tokyo', 'pokemon', ['d33'], 'Fast stock turnover and busy. Tax-free branch. Card section not confirmed.', { q: 'ブックオフ 池袋サンシャイン60通り店' }),
    T('japan_tcg_kichijoji', 'Japan TCG Center · Kichijoji (Book Off card store)', 'Japan TCG Center 吉祥寺駅北口店', 'Tokyo', 'pokemon', [], 'Book Off group trading-card-only store (opened Nov 2021 per company report). Confirm it is still open. Optional, not assigned to a day.', { q: 'Japan TCG Center 吉祥寺駅北口店' }),
    T('hobbyoff_search', 'Hobby Off / Hard Off · search near Sumida', 'ホビーオフ 錦糸町', 'Tokyo', 'pokemon', [], 'I could not verify a specific Hobby Off, Hard Off or Treasure Factory branch in Tokyo with a large Pokémon section. Hard Off has cards only sometimes, and Treasure Factory is mainly clothes and goods. This pin searches Google Maps: check branch reviews for the word Pokémon first.', { q: 'ホビーオフ 墨田区 江東区' }),
    T('pokecen_skytree', 'Pokémon Center Skytree Town', 'ポケモンセンタースカイツリータウン', 'Tokyo', 'pokemon', ['d31'], 'Solamachi East Yard 4F, Sumida: the closest Pokémon Center to your Airbnb. Official cards and merchandise (Skytree exclusives).', { ll: [35.7100, 139.8107] }),
    T('pokecen_shibuya', 'Pokémon Center Shibuya', 'ポケモンセンターシブヤ', 'Tokyo', 'pokemon', ['d29'], 'Shibuya PARCO 6F. Reported 10:00–21:00. Design Lab waits can be an hour or more.', { ll: [35.6618, 139.6985] }),
    T('pokecen_mega', 'Pokémon Center Mega Tokyo', 'ポケモンセンターメガトウキョー', 'Tokyo', 'pokemon', ['d33'], 'Sunshine City ALPA 2F, Ikebukuro. It closed after a March 2026 incident and was planned to reopen in September: confirm it is open before you go. Normally 10:00–20:00.', { ll: [35.7295, 139.7185] }),
    T('pokestore_tokyo_stn', 'Pokémon Store Tokyo Station', 'ポケモンストア 東京駅店', 'Tokyo', 'pokemon', ['d34'], 'Inside Tokyo Station (Character Street area). Good last-hour stop before the 14:09 Shinkansen.', { ll: [35.6812, 139.7671] }),
    T('harajuku_takeshita', 'Takeshita Street · Harajuku', '竹下通り', 'Tokyo', 'fashion', ['d29'], 'Cute, jirai, Lolita, cosplay, hats, hair accessories and cheap jewellery packed into one lane. Quiet before 11:00, packed after.', { ll: [35.6716, 139.7030] }),
    T('shibuya109', 'SHIBUYA109', 'SHIBUYA109 渋谷', 'Tokyo', 'fashion', ['d29'], 'Gyaru and girly trend brands, shoes, bags and accessories. Closes Jan 1.', { ll: [35.6595, 139.6986] }),
    T('shibuya_parco', 'Shibuya PARCO', '渋谷パルコ', 'Tokyo', 'fashion', ['d29'], 'Select shops, accessories and bags. In the 2025-26 holiday it was closed Jan 1 and 2.', { ll: [35.6618, 139.6985] }),
    T('shimokita', 'Shimokitazawa vintage streets', '下北沢 古着', 'Tokyo', 'fashion', ['d30'], 'Dozens of furugi (vintage) shops, plus hats, bags, jewellery and denim. Browse slowly: stock is one-off.', { ll: [35.6613, 139.6680] }),
    T('kinshicho_marui', 'Kinshicho Marui', '錦糸町マルイ', 'Tokyo', 'fashion', ['d31'], 'Fashion building near Sumida: girly mid-budget brands, bags, accessories. Floor guide not checked.', { q: '錦糸町マルイ' }),
    T('ikebukuro_parco', 'Ikebukuro PARCO', '池袋パルコ', 'Tokyo', 'fashion', ['d33'], 'Fashion building. Opened 10:00–20:00 on Jan 2 last year; confirm for 2027.', { ll: [35.7302, 139.7114] }),
    T('isetan_shinjuku', 'Isetan Shinjuku', '伊勢丹新宿本店', 'Tokyo', 'fashion', [], 'Department store: closed Jan 1, reopens Jan 2 with fukubukuro. Optional swap for a Jan 2 morning. Not assigned.', { ll: [35.6917, 139.7040] }),
    T('animate_ikebukuro', 'animate Ikebukuro · Otome Road', 'アニメイト池袋本店', 'Tokyo', 'fashion', ['d33'], 'Anime shop with costume and cosplay-adjacent goods.', { q: 'アニメイト池袋本店' }),
    T('asakusa_sensoji', 'Sensoji · Asakusa', '浅草寺', 'Tokyo', 'sights', ['d31'], 'Temple open over New Year, with very large crowds from NYE night to Jan 3. Kimono rental shops nearby may be closed Jan 1.', { ll: [35.7148, 139.7967] }),
    T('meiji_shrine', 'Meiji Shrine · hatsumode', '明治神宮', 'Tokyo', 'sights', ['d32'], 'Among the most crowded hatsumode sites in Japan. Go early or pick a smaller local shrine.', { ll: [35.6764, 139.6993] }),
    T('tokyo_skytree', 'Tokyo Skytree', '東京スカイツリー', 'Tokyo', 'sights', ['d32'], 'Reported open Jan 1 in past years. Check the 2027 hours and ticket status.', { ll: [35.7101, 139.8107] })
  ],

  addItems: [
    { day: 'd27', after: 'i27-5', item: { id: 'x27-1', time: 'From 16:00 · arrive ~19:30', title: 'Tokyo Airbnb check-in · Sumida City', note: 'Haneda T1 → Sumida by train (check the Airbnb nearest station)\nBuy food tonight: many supermarkets close Dec 31 – Jan 3', spotId: 'tokyo_airbnb' } }
  ],

  appendNotes: {}, appendItemNotes: {},
  setSubs: {
    harajuku_takeshita: ['girly', 'jirai', 'lolita', 'gyaru', 'cosplay', 'furugi', 'shoes', 'hats', 'jewels', 'hair'],
    shibuya109: ['gyaru', 'girly', 'jirai', 'shoes', 'bags', 'jewels', 'hair'],
    shibuya_parco: ['select', 'girly', 'shoes', 'bags', 'jewels'],
    shimokita: ['furugi', 'thrift', 'denim', 'shoes', 'bags', 'hats', 'jewels'],
    kinshicho_marui: ['basics', 'girly', 'jirai', 'bags', 'jewels', 'hair'],
    ikebukuro_parco: ['girly', 'select', 'jirai', 'bags', 'jewels'],
    isetan_shinjuku: ['select', 'office', 'girly', 'shoes', 'bags', 'jewels'],
    animate_ikebukuro: ['cosplay'],
    asakusa_sensoji: ['wafuku', 'hair'],
    bookoff_machida: ['thrift'], bookoff_kawasaki: ['thrift', 'bags', 'denim', 'shoes']
  }
}];

/* Traditional Chinese (Hong Kong style) for the Tokyo leg. Shown only in 中文 mode, and only while the
   English text is unchanged: if you edit a title or note yourself, your own text is shown instead. */
SEED_PATCHES.push({
  id: 'tokyo-zh-5', trip: 'trip-setouchi', addSpots: [],
  zhDays: {
    d28: { title: '卡牌日：秋葉原與中野', place: '秋葉原／中野' },
    d29: { title: '原宿與澀谷時裝', place: '原宿／澀谷' },
    d30: { title: '町田 Super Bazaar 與下北澤', place: '町田／下北澤' },
    d31: { title: '墨田區跨年', place: '墨田／淺草' },
    d32: { title: '元旦・初詣', place: '東京' },
    d33: { title: '福袋與池袋', place: '池袋' },
    d34: { title: '東京站 → 新大阪', place: '東京 → 大阪' }
  },
  zhItems: {
    'x27-1': { title: '東京 Airbnb 入住・墨田區', note: '由羽田第一客運大樓乘電車前往墨田區（請查看 Airbnb 最近的車站）\n今晚先買好食物：很多超市 12 月 31 日至 1 月 3 日休息' },
    'i28-1': { title: 'Book Off 秋葉原站前店', note: '車站旁六層大樓，低層有遊戲及卡牌，約 10:00 開門' },
    'i28-2': { title: '秋葉原卡牌店巡禮', note: 'Card Rush・Mandarake Complex（據報有初版 Base Set 及早期宣傳卡）\n購買前先比較各店價錢' },
    'i28-3': { title: '中野 Broadway 懷舊卡牌', note: 'Mandarake 2 樓（12:00 開門）・Tri Attack 地下・FUN! Fare 1 樓（鑑定卡／舊裏卡）\n不少小店只收現金，年末營業時間可能縮短' },
    'i28-4': { title: '晚餐後返回墨田', note: '新年休業前最後的正常購物日' },
    'i29-1': { title: '竹下通', note: '可愛系、地雷系、洛麗塔、Cosplay、帽子、髮飾及平價首飾全集中在一條街\n宜早到，中午後人很多' },
    'i29-2': { title: 'SHIBUYA109・辣妹與少女系', note: '中價潮流品牌、鞋及手袋' },
    'i29-3': { title: '澀谷 PARCO・寶可夢中心', note: '寶可夢中心澀谷在 6 樓（據報 10:00–21:00）\nDesign Lab 可能要排很久，建議先去' },
    'i29-4': { title: '返回墨田', note: '買好假期食物：很多超市 1 月 1–3 日休息' },
    'i30-1': { title: '前往町田', note: '由新宿乘小田急快速急行約 35 分鐘' },
    'i30-2': { title: 'Book Off Super Bazaar 町田', note: '東京都內最大的書籍及興趣專門館（2,360 平方米），包括卡牌及玩具\n據報營業時間 10:00–21:30，請確認年末營業時間' },
    'i30-3': { title: '下北澤古著', note: '乘小田急線返回新宿方向途中\n古著店、帽子、手袋、首飾。部分小店 12 月 30 日起休息' },
    'i30-4': { title: '晚餐・餐廳陸續休息', note: '很多獨立餐廳 12 月 30 或 31 日起休息至 1 月 3–5 日' },
    'i31-1': { title: '寶可夢中心 Skytree Town', note: 'Skytree Town Solamachi 東院 4 樓，由墨田步行可達\n除夕營業時間通常縮短，出發前請確認' },
    'i31-2': { title: '錦糸町購物', note: '錦糸町 Marui・Book Off Lotte City 錦糸町\n百貨公司今日多會提早關門' },
    'i31-3': { title: '跨年蕎麥麵與除夜鐘', note: '入夜後淺草寺一帶非常擠擁\n便利店是最穩妥的食物來源' },
    'i32-1': { title: '初詣（新年首次參拜）', note: '明治神宮或淺草寺都極為擠擁，墨田區的小神社較清靜\n神社及寺院照常開放；多數商店、百貨公司、銀行及郵局休息' },
    'i32-2': { title: '悠閒一天／晴空塔', note: '據報晴空塔元旦有開放\n東京國立博物館據報 2027 年 1 月 1 日重開，請確認時間\n豐盛晚餐請安排在 1 月 3 或 4 日，不要在今天' },
    'i33-1': { title: '福袋', note: '各店開業日不同：折扣連鎖店 1 月 1 日已開，伊勢丹／三越系 1 月 2 日開，高島屋／阪急約 1 月 3 日\n池袋 PARCO 去年 1 月 2 日 10:00 開門，請確認今年安排' },
    'i33-2': { title: '寶可夢中心 Mega Tokyo', note: '2026 年 3 月事件後曾關閉，原定 9 月重開，出發前請確認已恢復營業\n途中可順道去 Book Off 池袋 Sunshine 60 通店' },
    'i33-3': { title: 'animate 與乙女路', note: 'Cosplay 及動漫商品' },
    'i33-4': { title: '皇居新年參賀', note: '通常在 1 月 2 日舉行，請查看宮內廳網站。人龍很長' },
    'i34-1': { title: 'Airbnb 退房', note: '行李箱很大？三邊長度合計超過 160 厘米，乘新幹線需預約大件行李座位，買更多行李箱前請先確認' },
    'i34-2': { title: '寶可夢商店 東京站', note: '位於東京站內（Character Street 一帶），適合買最後的卡牌和手信\n1 月 2–4 日是回程高峰，車站非常擠擁，請預留多些時間' },
    'i34-3': { title: '新幹線 東京 → 新大阪', note: '1 月 3 日的指定席很早售罄，請確認已訂位\n到站後展開大阪行程' }
  },
  zhSpots: {
    tokyo_airbnb: { name: '東京 Airbnb・墨田區', hours: '16:00 起入住', note: '12 月 27 日至 1 月 3 日的住處，16:00 起可入住。尚未設定精確位置：請按「編輯地點」貼上 Airbnb 地址。' },
    tokyo_station: { name: '東京站（新幹線）', note: '1 月 3 日前往新大阪的新幹線 14:09 開出，16:36 抵達。當日指定席很早售罄。' },
    bookoff_akiba: { name: 'Book Off 秋葉原站前店', note: '車站外的六層大樓（神田佐久間町 1-6-4），2025 年底翻新，請以樓層指示牌為準。有遊戲、卡牌、漫畫，可辦理免稅。2026 年 11 月 1 日起免稅改為先付全額，離境前再申請退稅。屬一般分店，並非 Super Bazaar。' },
    cardrush_akiba: { name: 'Card Rush 秋葉原', note: '據報擅長高價單卡及 PSA 鑑定卡。步行十分鐘內還有多間卡牌店，請多店比價。庫存未確認。' },
    mandarake_akiba: { name: 'Mandarake Complex 秋葉原', note: '八層樓的 Mandarake，據報有懷舊寶可夢卡（初版 Base Set、早期宣傳卡）。據報營業時間 12:00–20:00，請確認。' },
    mandarake_nakano: { name: '中野 Broadway・Mandarake 與卡牌店', hours: '12:00–20:00（Mandarake）', note: '尋找懷舊及舊裏卡的最佳地區。Mandarake 卡牌部在 2 樓（據報 12:00–20:00）、Tri Attack 在地下（散卡箱、收購）、FUN! Fare 在 1 樓（PSA 鑑定卡、舊裏卡）、Kaikai Kiki Card Station 在 3 樓。不少店只收現金。' },
    bookoff_machida: { name: 'Book Off Super Bazaar 町田中央通店', hours: '10:00–21:30（網上資料）', note: '東京都內最大的 Book Off：書籍及興趣專門館 2,360 平方米（服飾在另一幢大樓），位於原町田 4-4-8，距町田站步行 3–7 分鐘。據報營業至 21:30。卡牌區大小未確認，但 Super Bazaar 的興趣樓層是 Book Off 之中最適合找散包及舊卡的選擇。預留 3 小時。' },
    bookoff_kawasaki: { name: 'Book Off Super Bazaar 409 川崎港町店', hours: '10:00–21:00（網上資料）', note: '東京近郊最大（4,740 平方米、約 50 萬件貨品），但位於神奈川縣，由品川出發約 40 分鐘並需轉車，大部分面積是服飾和家居用品。可選行程，未分配日期。' },
    bookoff_kinshicho: { name: 'Book Off Lotte City 錦糸町店', note: '距離墨田 Airbnb 最近的 Book Off。據報有外文書；卡牌區大小未確認。只作快速一看。' },
    bookoff_ikebukuro: { name: 'Book Off 池袋 Sunshine 60 通店', note: '貨品流轉快，人流多。可辦理免稅。卡牌區未確認。' },
    japan_tcg_kichijoji: { name: 'Japan TCG Center 吉祥寺（Book Off 卡牌專門店）', note: 'Book Off 集團的卡牌專門店（公司報告指 2021 年 11 月開業）。請確認仍在營業。可選行程，未分配日期。' },
    hobbyoff_search: { name: 'Hobby Off／Hard Off・墨田附近搜尋', note: '我未能證實東京有哪一間 Hobby Off、Hard Off 或 Treasure Factory 設有大型寶可夢卡區。Hard Off 只是有時有卡，Treasure Factory 主要賣衣服和雜貨。此圖釘會在 Google 地圖搜尋，出發前請先看分店評論有否提及「Pokémon」。' },
    pokecen_skytree: { name: '寶可夢中心 Skytree Town', note: 'Solamachi 東院 4 樓，墨田區：離你的 Airbnb 最近的寶可夢中心。有官方卡牌及商品（晴空塔限定款）。' },
    pokecen_shibuya: { name: '寶可夢中心 澀谷', note: '澀谷 PARCO 6 樓。據報 10:00–21:00。Design Lab 可能要等一小時或以上。' },
    pokecen_mega: { name: '寶可夢中心 Mega Tokyo', note: '池袋 Sunshine City ALPA 2 樓。2026 年 3 月事件後關閉，原定 9 月重開：出發前請確認已營業。平時 10:00–20:00。' },
    pokestore_tokyo_stn: { name: '寶可夢商店 東京站', note: '位於東京站內（Character Street 一帶），適合 14:09 新幹線前的最後一小時。' },
    harajuku_takeshita: { name: '竹下通・原宿', note: '可愛系、地雷系、洛麗塔、Cosplay、帽子、髮飾及平價首飾全集中在一條街。11:00 前較清靜，之後非常擠擁。' },
    shibuya109: { name: 'SHIBUYA109', note: '辣妹及少女系潮流品牌、鞋、手袋和配飾。1 月 1 日休息。' },
    shibuya_parco: { name: '澀谷 PARCO', note: '選物店、配飾和手袋。2025–26 年新年期間 1 月 1、2 日休息。' },
    shimokita: { name: '下北澤古著街', note: '數十間古著店，還有帽子、手袋、首飾和牛仔褲。慢慢逛：貨品都是獨一無二。' },
    kinshicho_marui: { name: '錦糸町 Marui', note: '墨田附近的時裝大樓：少女系中價品牌、手袋、配飾。未核對樓層指南。' },
    ikebukuro_parco: { name: '池袋 PARCO', note: '時裝大樓。去年 1 月 2 日 10:00–20:00 營業，今年請確認。' },
    isetan_shinjuku: { name: '伊勢丹新宿本店', note: '百貨公司：1 月 1 日休息，1 月 2 日重開並有福袋。可作為 1 月 2 日早上的替代行程。未分配日期。' },
    animate_ikebukuro: { name: 'animate 池袋本店・乙女路', note: '動漫商店，有服裝及 Cosplay 相關商品。' },
    asakusa_sensoji: { name: '淺草寺', note: '新年期間照常開放，除夕夜至 1 月 3 日人潮極多。附近的和服租借店 1 月 1 日可能休息。' },
    meiji_shrine: { name: '明治神宮・初詣', note: '全日本最擠擁的初詣地點之一。宜早去，或選較小的當地神社。' },
    tokyo_skytree: { name: '東京晴空塔', note: '往年元旦有開放。請確認 2027 年營業時間及門票狀況。' }
  }
});

function applySeedPatches(trip) {
  trip.patches = trip.patches || [];
  let changed = false;
  for (const p of SEED_PATCHES) {
    if (p.trip !== trip.id || trip.patches.includes(p.id)) continue;
    for (const d of (p.addDays || [])) {
      if (trip.days.some(x => x.id === d.id)) continue;
      trip.days.push({ place: '', title: '', ...d, items: d.items.map(i => ({ time: '', note: '', spotId: '', ...i })) });
    }
    for (const s of p.addSpots) {
      if (trip.spots.some(x => x.id === s.id)) continue;
      trip.spots.push({ jp: '', city: '', note: '', hours: '', link: '', gmaps: '', ...s,
        days: s.days.filter(d => trip.days.some(x => x.id === d)) });
    }
    for (const [id, text] of Object.entries(p.appendNotes || {})) {
      const s = trip.spots.find(x => x.id === id);
      if (s) s.note = s.note ? `${s.note}\n\n${text}` : text;
    }
    for (const [id, text] of Object.entries(p.appendItemNotes || {})) {
      for (const d of trip.days) { const it = d.items.find(x => x.id === id); if (it) it.note = it.note ? `${it.note}\n${text}` : text; }
    }
    for (const a of (p.addItems || [])) {
      const d = trip.days.find(x => x.id === a.day);
      if (!d || trip.days.some(x => x.items.some(i => i.id === a.item.id))) continue;
      const at = d.items.findIndex(i => i.id === a.after);
      d.items.splice(at < 0 ? d.items.length : at + 1, 0, { time: '', note: '', spotId: '', ...a.item });
    }
    for (const [id, subs] of Object.entries(p.setSubs || {})) {
      const s = trip.spots.find(x => x.id === id);
      if (s && !(s.subs || []).length) s.subs = subs;
    }
    // Traditional Chinese text: kept next to the English it translates, used only while the English is unchanged.
    for (const [id, z] of Object.entries(p.zhSpots || {})) { const x = trip.spots.find(q => q.id === id); if (x) x.zh = { ...z, _name: x.name, _note: x.note, _hours: x.hours }; }
    for (const [id, z] of Object.entries(p.zhDays || {})) { const x = trip.days.find(q => q.id === id); if (x) x.zh = { ...z, _title: x.title, _place: x.place }; }
    for (const [id, z] of Object.entries(p.zhItems || {})) for (const d of trip.days) { const x = d.items.find(q => q.id === id); if (x) x.zh = { ...z, _title: x.title, _note: x.note }; }
    trip.patches.push(p.id); changed = true;
  }
  return changed;
}
