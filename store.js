'use strict';
/* Data layer. Everything the user edits lives in one object saved to localStorage.
   To sync between phones later, replace loadDb()/saveDb() with calls to your backend
   (Supabase, Firebase, your own API) — nothing else in the app touches storage. */

const STORE_KEY = 'trip-companion-v3';

/* Stop / place types. One list is used everywhere: the stop badge, map chips, the Type dropdown in Excel and the importers.
   Built from the plan types that trip planners such as TripIt and Travefy use (flight, rail, ground transport, lodging, restaurant,
   activity / tour / show) plus sightseeing, shopping and free time. Keys never change (they are stored in saved trips);
   only labels may. `base` keeps its old key but now means "Hotel & stay"; stations and airports have their own types. */
const CATS = {
  flight:  { label: 'Flight',              color: '#4b5fd1', hint: 'Flights, airport arrival / departure', icon: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>' },
  train:   { label: 'Train',               color: '#2a7ab8', hint: 'Trains, shinkansen, rail stations', icon: '<path d="M7 3h10a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zM4 11h16M8 21l2-4M16 21l-2-4"/><circle cx="8.5" cy="14" r=".6"/><circle cx="15.5" cy="14" r=".6"/>' },
  transfer:{ label: 'Transfer',            color: '#8b6f47', hint: 'Bus, taxi, ferry, metro, rental car, walking transfer', icon: '<path d="M5 17V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v11M3 17h18M5 17v2M19 17v2M5 11h14"/><circle cx="8.5" cy="14" r=".6"/><circle cx="15.5" cy="14" r=".6"/>' },
  base:    { label: 'Hotel & stay',        color: '#5b6472', hint: 'Hotel, ryokan, Airbnb, check-in / check-out, luggage drop', icon: '<path d="M3 19V6M3 14h18v5M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/>' },
  food:    { label: 'Food & drink',        color: '#d9692b', hint: 'Meals, cafés, bars, street food, food tours', icon: '<path d="M5 3v5a3 3 0 0 0 6 0V3M8 3v18M17 21V3c-2.7 1.5-3.5 5-3.5 8H17"/>' },
  sights:  { label: 'Sights & culture',    color: '#2f8a5b', hint: 'Temples, museums, parks, viewpoints, photo spots, festivals, markets', icon: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>' },
  activity:{ label: 'Activity & tour',     color: '#b5483a', hint: 'Tours, classes, shows, onsen / spa, theme parks, hikes, tickets, events', icon: '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/>' },
  shopping:{ label: 'Shopping',            color: '#397f85', hint: 'Malls, markets, souvenirs, department stores', icon: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>' },
  fashion: { label: 'Fashion & cosmetics', color: '#8a57c9', hint: 'Clothes, thrift, beauty, drugstores', icon: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>' },
  pokemon: { label: 'Hobby & collectibles',color: '#c99a06', hint: 'Trading cards, anime, games, figures, hobby shops', icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h5.5M15.5 12H21"/><circle cx="12" cy="12" r="3"/>' },
  slowpoke:{ label: 'Special interest',    color: '#e0528f', hint: 'A theme you are chasing (stamp rally, manholes, mascots)', icon: '<path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z"/>' },
  free:    { label: 'Free time',           color: '#8d99a6', hint: 'Rest, buffer, free morning / day', icon: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>' },
  other:   { label: 'Other',               color: '#9aa0a8', hint: 'Anything else (errands, admin, reminders)', icon: '<circle cx="6" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18" cy="12" r="1.3"/>' }
};
// Words people (and older files) use for a type -> key. Labels and keys are matched first; this list covers the rest.
const CAT_ALIASES = {
  flight: 'flight|flights|plane|air|airport|航班|飛機|飞机|飛行機|フライト', train: 'train|rail|railway|shinkansen|jr|火車|火车|電車|新幹線',
  transfer: 'transfer|transport|transit|bus|taxi|ferry|boat|car|metro|subway|ground transport|ground transportation|移動|接駁|巴士',
  base: 'hotel|hotels|stay|lodging|accommodation|hostel|ryokan|airbnb|hotels & transport|酒店|住宿|ホテル', food: 'meal|meals|restaurant|restaurants|eat|dining|drink|cafe|café|bar|餐廳|餐厅|食|ごはん',
  sights: 'sight|sights|sightseeing|attraction|attractions|culture|photos & christmas|photo|景點|景点|観光', activity: 'activity|activities|tour|tours|event|show|experience|ticket|活動|活动|体験',
  shopping: 'shop|shops|shopping|購物|购物|買い物', fashion: 'fashion|cosmetics|beauty|時裝|美妝', pokemon: 'hobby|hobbies|collectibles|cards|pokémon & cards|pokemon & cards|pokemon|pokémon|寶可夢',
  slowpoke: 'special|special interest|theme|themed|slowpoke|呆呆獸', free: 'free|free time|rest|break|buffer|自由|休息', other: 'other|misc|miscellaneous|note|其他'
};
// Text -> type key ('' when it names no type).
function catFromText(raw) {
  const v = String(raw ?? '').trim().toLowerCase(); if (!v) return '';
  const hit = Object.keys(CATS).find(k => k === v || CATS[k].label.toLowerCase() === v);
  return hit || Object.keys(CAT_ALIASES).find(k => CAT_ALIASES[k].split('|').includes(v)) || '';
}

/* Guess a stop's type from its words, so nobody has to pick one. First match wins.
   "strong" words (flight, train, transfer, check-in/out, travel phrases, free time) beat the place's own type: a ride that
   ends at a shopping mall is still a train ride. Otherwise a linked place keeps its own type. */
const CW = {
  flightNo: /\b(?!(?:AM|PM|JR|NO|ID|TV)\b)[A-Z][A-Z0-9]\s?\d{3,4}\b/,
  flight: /flight|boarding|take-?off|airline|\bplane\b|航班|飛行機|フライト|登機|登机/i,
  train: /train|shinkansen|bullet|railway|\brail\b|\bjr\b|limited express|\bexpress\b|\brapid\b|haruka|marine liner|\bmonorail\b|新幹線|特急|電車|列車|火車|火车|高鐵|高铁|鐵路/i,
  transfer: /transfer|taxi|\bcab\b|\buber\b|\bbus\b|coach|ferry|\bboat\b|cruise|shuttle|metro|subway|\btram\b|rental car|car rental|\bdrive\b|driving|limousine|バス|タクシー|フェリー|地下鉄|移動|接駁|巴士|渡輪|的士|搭車|地鐵/i,
  travel: /→|⇒|->|\b(?:travel|head|go|return|ride|depart|leave|arrive)\b|\barriv(?:e|al)\b|\bdeparture\b|\bcommute\b|前往|返回|出發|抵達|到達/i,
  stayIO: /check-?\s?in|check-?\s?out|checkout|luggage (?:drop|deposit|storage)|drop (?:off )?(?:bags|luggage)|入住|退房|チェックイン|チェックアウト/i,
  free: /free (?:time|day|morning|afternoon|evening)|\brest\b|relax|\bnap\b|buffer|downtime|spare time|自由|空閒|休息|フリー/i,
  airport: /airport|空港|機場|机场/i,
  meal: /breakfast|brunch|lunch|dinner|supper|coffee|caf[eé]|ramen|udon|soba|sushi|izakaya|yakiniku|yakitori|tempura|restaurant|bistro|bakery|dessert|snack|street food|food court|buffet|bbq|\bbar\b|\bpub\b|drinks?\b|\btea\b|noodle|pizza|burger|\beat(?:ing)?\b|beef|brewery|cocktail|\bsake\b|早餐|午餐|晚餐|宵夜|餐廳|餐厅|咖啡|拉麵|拉面|ランチ|ディナー|朝食|夕食|居酒屋|カフェ|食堂|美食/i,
  stayHotel: /hotel|hostel|ryokan|airbnb|lodging|accommodation|guest ?house|宿|ホテル|旅館|酒店|住宿/i,
  fashion: /parco|marui|\b109\b|uniqlo|\bgu\b|zara|h&m|beams|lumine|fashion|cosmetic|boutique|clothes|clothing|apparel|thrift|vintage|second-?hand|drugstore|beauty|時裝|服飾|美妝|コスメ|古着/i,
  hobby: /pok[eé]mon|trading cards?|\bcards\b|card (?:shop|store|game)|figure|anime|manga|hobby|collectible|gashapon|トレカ|ポケモン|動漫|公仔|扭蛋/i,
  fest: /christmas market|night market|flea market|festival|illumination|hatsumode|初詣|祭|夜景/i,
  activity: /\btours?\b|class|workshop|lesson|experience|onsen|\bspa\b|hot spring|sauna|massage|\bshow\b|concert|theat(?:er|re)|musical|live music|theme park|amusement|aquarium|\bzoo\b|ropeway|cable car|gondola|ticket|karaoke|cooking|\bhike\b|\btrek|\bski\b|snorkel|diving|kayak|surf|cycling|rafting|tasting|stadium|ceremony|体験|体验|温泉|ツアー|遊園地|水族館|演唱會|表演/i,
  sights: /\bviews?\b|photo|garden|castle|shrine|temple|museum|gallery|\bparks?\b|tower|bridge|\blights?\b|viewpoint|observatory|sunset|sunrise|\bwalk\b|stroll|trail|beach|dunes?|mount|\blake\b|waterfall|old town|historic|monument|palace|cathedral|church|mosque|ruins|market|景點|景点|神社|寺|城|公園|美術館|博物館|庭園|散步|観光/i,
  shop: /don quijote|donki|aeon|daimaru|takashimaya|isetan|mitsukoshi|hankyu|seibu|center-?gai|shotengai|arcade|\bshop|mall|department store|outlet|souvenir|\bgifts?\b|\bstore\b|\bbuy\b|購物|购物|買い物|ショッピング|百貨|商店街|お土産|伴手禮/i,
  station: /\bstation\b|駅|站|terminal/i
};
function strongCat(text, ctx = '') {
  const T = String(text || ''), C = `${T} ${ctx}`;
  if (CW.flightNo.test(T) || CW.flight.test(T)) return 'flight';
  if (CW.train.test(T)) return 'train';
  if (CW.transfer.test(T)) return 'transfer';
  if (CW.travel.test(T)) {                       // "Himeji → Kobe", "Return to the hotel": look for the vehicle in the place name and note
    if (CW.flightNo.test(C) || CW.flight.test(C)) return 'flight';
    if (CW.train.test(C)) return 'train';
    if (CW.transfer.test(C)) return 'transfer';
    if (/→|⇒|->/.test(T) || /\b(?:travel|head|go|return|ride|depart|leave)\b/i.test(T)) return 'transfer';
  }
  if (CW.stayIO.test(T)) return 'base';
  if (CW.free.test(T)) return 'free';
  if (CW.airport.test(T)) return 'flight';
  return '';
}
function softCat(text) {
  const T = String(text || '');
  if (CW.meal.test(T)) return 'food';
  if (CW.stayHotel.test(T)) return 'base';
  if (CW.fashion.test(T)) return 'fashion';
  if (CW.hobby.test(T)) return 'pokemon';
  if (CW.fest.test(T)) return 'sights';
  if (CW.activity.test(T)) return 'activity';
  if (CW.sights.test(T)) return 'sights';
  if (CW.shop.test(T)) return 'shopping';
  return '';
}
// title: the stop's name. spot: its linked place (or { name } for one about to be created). note: only read to spot the vehicle of a trip leg.
function guessStopCat(title, spot, note) {
  const ctx = [spot && spot.name, note].filter(Boolean).join(' · '), own = spot && CATS[spot.cat] ? spot.cat : '';
  let c = strongCat(title, ctx); if (c) return c;
  if (own && own !== 'base') return own;
  c = softCat(title); if (c) return c;
  if (spot && spot.name) {                      // a hotel / station place with an unhelpful stop title: the place name decides
    if (own === 'base' || !own) { c = strongCat(spot.name) || softCat(spot.name); if (c) return c; if (CW.station.test(spot.name)) return 'train'; }
  }
  return own || (spot && spot.name ? 'sights' : 'activity');
}
// The type shown for a stop: the one the person set, else a guess.
const stopCat = (tr, it) => CATS[it.cat] ? it.cat : guessStopCat(it.title, it.spotId && tr.spots.find(x => x.id === it.spotId) || null, it.note);

// Fashion sub-categories ("styles") so someone with no idea what to look for can browse by type.
// brands/prices are typical ranges, not a guarantee that a given stop stocks them.
const SUB_GROUPS = [
  { id: 'everyday', en: 'Everyday & budget', zh: '日常・平價', subs: ['basics', 'select', 'thrift', 'furugi', 'outdoor'] },
  { id: 'cute',     en: 'Cute & subculture', zh: '可愛・次文化', subs: ['girly', 'gyaru', 'jirai', 'lolita', 'cosplay'] },
  { id: 'dressy',   en: 'Dressy & traditional', zh: '正式・和服', subs: ['office', 'wafuku'] },
  { id: 'items',    en: 'By item', zh: '按單品', subs: ['denim', 'shoes', 'bags', 'hats', 'jewels', 'hair', 'lounge'] }
];
// "I have no idea" shortcuts: one tap selects several styles that fit a mood or goal.
const FASHION_STARTERS = [
  { en: 'Cheap & cute', zh: '平價可愛', subs: ['basics', 'girly', 'jewels', 'hair'] },
  { en: 'Harajuku street style', zh: '原宿街頭風', subs: ['jirai', 'lolita', 'gyaru', 'cosplay', 'hats', 'shoes'] },
  { en: 'Second-hand finds', zh: '二手・古着尋寶', subs: ['thrift', 'furugi', 'bags'] },
  { en: 'Smart / nice dinner', zh: '正式晚餐', subs: ['office', 'select', 'shoes', 'bags'] },
  { en: 'Warm & practical', zh: '保暖實用', subs: ['outdoor', 'lounge', 'hats', 'denim'] },
  { en: 'Small gifts', zh: '小禮物', subs: ['hair', 'jewels', 'hats', 'bags'] }
];
const FASHION_SUBS = {
  basics: { en: 'Fast fashion basics', zh: '快時尚基本款', jp: 'プチプラ',
    what: 'Tees, knits, jeans and coats at the lowest prices. A good first stop to see what fits.',
    what_zh: 'T恤、針織、牛仔褲、外套，價錢最平，適合先逛一圈。',
    brands: 'GU, Uniqlo, H&M, ZARA, Shimamura (しまむら), Avail, Right-on', budget: '¥1,000–6,000',
    tip: 'Try GU and Shimamura first for the cheapest cute pieces.' },
  select: { en: 'Select shops (United Arrows style)', zh: '選物店', jp: 'セレクトショップ',
    what: 'Neat smart-casual pieces from curated labels. Nicer fabrics, plain but polished.',
    what_zh: '精緻的簡約休閒服，質料較好。',
    brands: 'United Arrows (Green Label Relaxing, Beauty & Youth), Beams, Nano Universe, Urban Research, SHIPS, coca', budget: '¥5,000–20,000',
    tip: 'coca and Green Label Relaxing are the lower-priced end. Check sale racks.' },
  thrift: { en: 'Thrift & second-hand', zh: '二手・古著', jp: '古着 / リサイクル',
    what: 'Used clothes and brand-name bags at big discounts. Stock is random, so browse slowly.',
    what_zh: '二手衣物和名牌包，折扣大，貨品隨機。',
    brands: '2nd Street, Treasure Factory, Off House, Book Off Super Bazaar apparel floors', budget: '¥500–5,000',
    tip: 'Book Off Super Bazaar stores also carry clothing and brand bags.' },
  girly: { en: 'Cute & girly', zh: '可愛少女系', jp: 'ガーリー / フェミニン',
    what: 'Ribbons, lace, florals, skirts and blouses: the everyday kawaii look.',
    what_zh: '蝴蝶結、蕾絲、碎花、裙子和襯衫，日常可愛風。',
    brands: 'Liz Lisa, Rirandture, Lily Brown, Honey Mi Honey, earth music & ecology, Lowrys Farm, Samansa Mos2', budget: '¥3,000–10,000',
    tip: 'Fashion buildings (Marui, Piole) are more likely to have these than department stores.' },
  jirai: { en: 'Jirai / ryousangata (dark-cute)', zh: '地雷系・量產型', jp: '地雷系 / 量産型',
    what: 'Black and pink, frills, ribbons, platform shoes and bold accessories. A youth street style.',
    what_zh: '黑粉配色、荷葉邊、蝴蝶結、厚底鞋和大膽配飾。',
    brands: 'Ank Rouge, Rojita, Secret Honey, LAFARY', budget: '¥3,000–9,000',
    tip: 'Mostly Harajuku/Osaka brands. Smaller cities may only have a corner of a fashion building.' },
  lolita: { en: 'Lolita & gothic', zh: '洛麗塔・哥德', jp: 'ロリータ / ゴスロリ',
    what: 'Knee-length frilly skirts and a vintage, romantic look. Mostly specialist shops.',
    what_zh: '及膝蓬裙、復古浪漫風，多為專門店。',
    brands: 'Baby, The Stars Shine Bright, Angelic Pretty, Metamorphose, Innocent World', budget: '¥8,000–30,000+',
    tip: 'I found no verified Lolita shop on this route; the nearest hubs are in Osaka.' },
  cosplay: { en: 'Cosplay & costumes', zh: 'Cosplay・服裝', jp: 'コスプレ / コスプレ衣装',
    what: 'Costumes, wigs and party outfits, plus anime-shop goods.',
    what_zh: '服裝、假髮和派對衣物，也有動漫商品。',
    brands: 'Don Quijote costume corner, animate, anime/hobby shops', budget: '¥2,000–10,000',
    tip: 'Don Quijote is the easiest cheap option on this route.' },
  office: { en: 'Office & proper (suits, formal)', zh: 'OL・正裝', jp: 'オフィスカジュアル / レディーススーツ',
    what: 'Blazers, slacks, blouses and dresses for work, ceremonies or a nice dinner.',
    what_zh: '西裝外套、長褲、襯衫、連身裙，適合上班或正式場合。',
    brands: 'Aoyama, AOKI, Konaka, Natural Beauty Basic, Untitled', budget: '¥6,000–25,000',
    tip: 'Department stores (Daimaru, Mitsukoshi) have the widest range.' },
  denim: { en: 'Jeans & trousers', zh: '牛仔褲・長褲', jp: 'デニム / パンツ',
    what: 'Jeans, wide-leg pants and slacks. Sizes run small and lengths are often short.',
    what_zh: '牛仔褲、闊腿褲、西褲。尺碼偏小，褲長常偏短。',
    brands: "Levi's, Edwin, Uniqlo, GU, Right-on, Beams", budget: '¥2,000–12,000',
    tip: 'Ask about hemming (裾上げ): many shops do it quickly for a small fee.' },
  shoes: { en: 'Shoes & boots', zh: '鞋・靴', jp: '靴 / パンプス / ブーツ',
    what: 'Flats, loafers, pumps and boots. Sizes are in cm.',
    what_zh: '平底鞋、樂福鞋、高跟鞋、靴子。尺碼以厘米計。',
    brands: 'Chausser, ORiental TRAFFIC, Regal, Ginza Kanematsu', budget: '¥3,000–15,000',
    tip: 'ABC-Mart is mostly sneakers (sports brands); skip it if you want to avoid those.' },
  bags: { en: 'Bags', zh: '手袋', jp: 'バッグ',
    what: 'Totes, shoulder bags and backpacks, from cheap to mid-range.',
    what_zh: '托特包、斜孭袋和背包，由平價到中價。',
    brands: 'Samantha Thavasa, Samantha Vega, anello, 3COINS', budget: '¥1,500–20,000',
    tip: 'Book Off Super Bazaar often has second-hand brand bags.' },
  hats: { en: 'Hats & caps', zh: '帽子', jp: '帽子 / ベレー帽 / ニット帽',
    what: 'Berets, bucket hats, beanies and caps.',
    what_zh: '貝雷帽、漁夫帽、毛帽和鴨舌帽。',
    brands: 'CA4LA, Maxine, GU, Uniqlo, 3COINS', budget: '¥1,500–8,000',
    tip: 'CA4LA is the main Japanese hat chain; try fashion buildings and arcades.' },
  jewels: { en: 'Jewellery & chains', zh: '首飾・鏈', jp: 'アクセサリー / チェーン ネックレス',
    what: 'Necklaces, chains, earrings and rings from ¥500 pieces to fine jewellery.',
    what_zh: '項鏈、鏈、耳環、戒指，由¥500到精品首飾都有。',
    brands: '4℃, Agete, Studio Clip, 3COINS, Daiso, Q-pot', budget: '¥500–15,000',
    tip: 'Look in station malls and underground malls for cheap accessories.' }
};

// Refinements (Nov 2026): Tokyo notes on every style, a clearer thrift vs vintage split, and new styles.
const _R = (k, o) => Object.assign(FASHION_SUBS[k], o);
_R('basics',  { tokyo: 'Uniqlo and GU flagships in Harajuku, Shibuya and Ginza; Shimamura and Right-on in suburban malls.', tip: 'Try GU and Shimamura first for the cheapest cute pieces. Uniqlo Heattech is the cheap winter layer.' });
_R('select',  { tokyo: 'Shibuya PARCO, Ikebukuro PARCO, Shinjuku (Lumine, Isetan), Ginza.' });
_R('thrift',  { en: 'Second-hand brands (recycle shops)', zh: '二手名牌・回收店', jp: 'リサイクルショップ / ブランド古着',
  what: 'Used everyday clothes and brand-name bags in shop-sorted racks, good value. Different from curated vintage.', what_zh: '店方分類的二手衣物與名牌包，抵買。與精選古著不同。',
  tokyo: 'Book Off Super Bazaar Machida (clothing is in a separate building), Kawasaki Minatocho, 2nd Street and Treasure Factory branches in the city.', tip: 'Treasure Factory and 2nd Street are mainly clothes; Book Off is more hit-and-miss. Check size labels (M/L runs small).' });
_R('jirai',   { tokyo: 'Takeshita Street and Harajuku side streets; SHIBUYA109; Ikebukuro PARCO; Marui buildings (Shinjuku, Kinshicho).' });
_R('lolita',  { tip: 'Harajuku has the specialist shops (Baby, Angelic Pretty). Check opening days: small shops often close Dec 30 – Jan 3.', tokyo: 'Harajuku (Laforet side streets and Takeshita area). Reported by guides: confirm each shop before going.' });
_R('cosplay', { tokyo: 'animate Ikebukuro and Otome Road, Akihabara, Mandarake (Nakano Broadway has a costume department), Don Quijote.' });
_R('office',  { tokyo: 'Isetan Shinjuku, Ginza and Nihonbashi department stores; Shinjuku and Marunouchi office-wear shops.' });
_R('denim',   { tip: 'Ask about hemming (裾上げ): many shops do it quickly for a small fee. Take your own waist/length numbers in cm.' });
_R('shoes',   { tip: 'Sizes run small: 23.5 cm is a common women\u2019s M. ABC-Mart is mostly sneakers; skip it for flats and heels.' });
_R('jewels',  { tokyo: 'Harajuku and Shibuya accessory shops, Daiso and 3COINS, Q-pot in Omotesando.' });
_R('hats',    { tokyo: 'CA4LA (Harajuku, Shibuya), Shimokitazawa vintage hats.' });
_R('bags',    { tokyo: 'Second-hand brand bags at Komehyo Shibuya and Book Off Super Bazaar; Samantha Thavasa in department stores.' });
Object.assign(FASHION_SUBS, {
  gyaru: { en: 'Gyaru & trend (SHIBUYA109 style)', zh: '辣妹・潮流（109）', jp: 'ギャル / 109系',
    what: 'Bold, trendy and sexy-cute: short skirts, tight knits, big accessories, platform boots. Lots of choice in one building.', what_zh: '大膽潮流風：短裙、貼身針織、大型配飾、厚底靴，一座大樓搜羅齊。',
    brands: 'EGOIST, RESEXXY, SLY, MURUA, rienda, Rady', budget: '¥4,000–15,000', tip: 'Staff are friendly and will bring your size. Closed Jan 1.', tokyo: 'SHIBUYA109 (floors 2–6) and Harajuku.' },
  furugi: { en: 'Vintage (curated furugi)', zh: '精選古著', jp: '古着',
    what: 'Hand-picked vintage clothes, Y2K and retro pieces. One-off items, so buy it if you like it.', what_zh: '精挑細選的古著、Y2K及復古單品，一件一款。',
    brands: 'Flamingo, Ragtag, Chicago, Santa Monica, Berlin (Harajuku and Shimokitazawa)', budget: '¥2,000–12,000', tip: 'Prices are on the tag; bargaining is not normal. Fitting rooms can be small or shared.', tokyo: 'Shimokitazawa and Koenji; Harajuku Cat Street area.' },
  outdoor: { en: 'Outdoor & practical (winter)', zh: '戶外・實用保暖', jp: 'アウトドア / 防寒',
    what: 'Fleece, down jackets, warm boots and rain gear, worn as everyday fashion. Good for cold Tokyo and Osaka days.', what_zh: '搖粒絨、羽絨外套、保暖靴和雨具，日常穿搭也合適。',
    brands: 'Montbell, Workman (Workman Plus), Uniqlo, GU, Snow Peak, Gramicci', budget: '¥2,000–25,000', tip: 'Workman is a surprising bargain for warm basics.', tokyo: 'Workman Plus and Montbell stores around Shibuya, Shinjuku and Ueno.' },
  wafuku: { en: 'Kimono & Japanese-style', zh: '和服・和風', jp: '着物 / 浴衣 / 和装',
    what: 'Kimono, haori jackets and hair pieces: rent for photos, or buy vintage pieces and accessories.', what_zh: '和服、羽織和髮飾：可租借拍照，亦可買古著和服及配飾。',
    brands: 'Asakusa rental shops, Kimono vintage shops, Tsumami hair ornament makers', budget: '¥3,000–10,000 (rental) / ¥3,000+ (vintage)', tip: 'Rentals book up around New Year: reserve ahead and check opening days.', tokyo: 'Asakusa (many rental shops), Harajuku vintage.' },
  hair: { en: 'Hair accessories', zh: '髮飾', jp: 'ヘアアクセサリー / リボン / バンスクリップ',
    what: 'Scrunchies, ribbons, claw clips and barrettes in cute designs for ¥300–2,000. Easy souvenirs.', what_zh: '髮圈、蝴蝶結、鯊魚夾和髮夾，¥300–2,000，易送禮。',
    brands: 'Daiso, 3COINS, Studio Clip, Claire\u2019s, Takeshita Street shops', budget: '¥300–2,500', tip: 'Search 髪飾り or ヘアクリップ in Maps. Daiso has a surprisingly good range.', tokyo: 'Takeshita Street, Harajuku, SHIBUYA109.' },
  lounge: { en: 'Loungewear & underwear', zh: '家居服・內衣', jp: 'ルームウェア / ランジェリー',
    what: 'Soft fleece pyjamas, matching sets and basics: popular Japanese gifts.', what_zh: '柔軟搖粒絨睡衣、套裝和基本款：熱門日本手信。',
    brands: 'gelato pique, Peach John, Uniqlo, GU, Tutuanna, Wacoal', budget: '¥2,000–10,000', tip: 'Fitting rooms are usually off-limits for underwear. Size charts are in cm.', tokyo: 'Shinjuku (Lumine), Shibuya, Ikebukuro PARCO.' }
});

// Traditional Chinese for the tip and "In Tokyo" lines on each style card.
const _Z = {
  basics:  ['先去 GU 和 Shimamura 找最平的可愛單品。Uniqlo 的 Heattech 是便宜的冬季內層。', '原宿、澀谷、銀座有 Uniqlo 及 GU 旗艦店；郊外商場有 Shimamura 和 Right-on。'],
  select:  ['coca 和 Green Label Relaxing 價錢較低，記得看減價架。', '澀谷 PARCO、池袋 PARCO、新宿（Lumine、伊勢丹）、銀座。'],
  thrift:  ['Treasure Factory 和 2nd Street 以衣服為主；Book Off 則較看運氣。留意尺碼標籤（M／L 偏小）。', 'Book Off Super Bazaar 町田（服飾在另一幢大樓）、川崎港町，以及市內的 2nd Street 和 Treasure Factory。'],
  furugi:  ['價錢已標明，一般不議價。試身室可能很細或共用。', '下北澤、高圓寺；原宿貓街一帶。'],
  outdoor: ['Workman 的保暖基本款非常抵買。', '澀谷、新宿、上野一帶的 Workman Plus 及 Montbell。'],
  girly:   ['時裝大樓（Marui、Piole）比百貨公司更容易找到這類風格。', ''],
  gyaru:   ['店員很友善，會幫你拿合適尺碼。1 月 1 日休息。', 'SHIBUYA109（2–6 樓）及原宿。'],
  jirai:   ['多為原宿／大阪品牌，小城市可能只有時裝大樓的一個角落。', '竹下通及原宿小巷；SHIBUYA109；池袋 PARCO；Marui 大樓（新宿、錦糸町）。'],
  lolita:  ['專門店集中在原宿（Baby、Angelic Pretty）。留意營業日：小店常在 12 月 30 日至 1 月 3 日休息。', '原宿（Laforet 旁的小巷及竹下通一帶）。為旅遊指南資料，出發前請逐間確認。'],
  cosplay: ['唐吉訶德是最容易找到的平價選擇。', '池袋 animate 及乙女路、秋葉原、Mandarake（中野 Broadway 設有服裝部）、唐吉訶德。'],
  office:  ['百貨公司（大丸、三越）選擇最多。', '伊勢丹新宿、銀座及日本橋的百貨公司；新宿和丸之內的OL服飾店。'],
  wafuku:  ['新年期間租借很快額滿：請提早預約並確認營業日。', '淺草（大量租借店）、原宿古著店。'],
  denim:   ['可詢問改褲腳（裾上げ）：很多店收少許費用即可快速完成。請帶備自己的腰圍及褲長（厘米）。', ''],
  shoes:   ['尺碼偏小：23.5 厘米是常見的女裝 M 碼。ABC-Mart 主要賣波鞋，想買平底鞋或高跟鞋可略過。', ''],
  bags:    ['Book Off Super Bazaar 常有二手名牌手袋。', '澀谷 Komehyo 及 Book Off Super Bazaar 有二手名牌手袋；百貨公司有 Samantha Thavasa。'],
  hats:    ['CA4LA 是日本主要的帽子連鎖店，可到時裝大樓和商店街找。', 'CA4LA（原宿、澀谷）、下北澤古著帽子。'],
  jewels:  ['車站商場和地下街常有平價配飾。', '原宿及澀谷的配飾店、Daiso 與 3COINS、表參道的 Q-pot。'],
  hair:    ['在地圖搜尋「髪飾り」或「ヘアクリップ」。Daiso 的選擇出奇地好。', '竹下通、原宿、SHIBUYA109。'],
  lounge:  ['內衣褲一般不可試穿。尺碼表以厘米計。', '新宿（Lumine）、澀谷、池袋 PARCO。']
};
for (const [k, [tip, tk]] of Object.entries(_Z)) { FASHION_SUBS[k].tip_zh = tip; if (tk) FASHION_SUBS[k].tokyo_zh = tk; }
const subLabel = k => { const v = FASHION_SUBS[k]; return v ? (typeof language !== 'undefined' && language === 'zh' ? v.zh : v.en) : k; };
// One small line icon per category so places can be told apart at a glance (map pins, lists, day stops).
const catIcon = (cat, size = 16) => `<svg class="cat-ico" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${(CATS[cat] || CATS.sights).icon}</svg>`;
const EXPENSE_CATS = ['Accommodation','Flights','Transport','Food','Shopping','Attractions','Other'];
// One colour per day, used for map pins and the day cards so they read as one system.
// 21 distinct colours so a three-week trip never repeats a day colour.
const DAY_COLORS = ['#c8423b','#d9822b','#2f8a5b','#2a7fb8','#6a4fc2','#c2408f','#138a8a',
  '#7a6a2f','#4a5d8f','#b0503a','#3d8f3a','#b8860b','#5c6bc0','#8e3b8e',
  '#00838f','#a0522d','#6d8b1e','#d0457a','#3f6fa6','#946f00','#7b4fa0'];

let db = null;

const uid = p => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

function loadDb() {
  try { db = JSON.parse(localStorage.getItem(STORE_KEY)); } catch { db = null; }
  if (!db || db.version !== 3 || !Array.isArray(db.trips)) {
    db = { version: 3, trips: [structuredClone(SEED_TRIP)] };
    saveDb();
  }
  // Older trips filed stations and airports under "Hotels & transport" (base). Give those places their own type once; hotels stay put.
  let moved = false;
  db.trips.forEach(tr => (tr.spots || []).forEach(sp => { if (sp.cat === 'base') { const c = guessStopCat('', { name: sp.name, cat: 'base' }); if (c && c !== 'base') { sp.cat = c; moved = true; } } }));
  if (moved) saveDb();
  // merge researched places/notes into the example trip (once per trip, never overwrites user edits)
  if (typeof applySeedPatches === 'function' && db.trips.map(applySeedPatches).some(Boolean)) saveDb();
}
function saveDb() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); if (typeof syncHook === 'function') syncHook(); return true; }
  catch { toast('Could not save. Browser storage is full or blocked (private mode?).'); return false; }
}
const getTrip = id => db.trips.find(t => t.id === id);

/* ---------- money (all amounts stored as integer cents) ---------- */
const toCents = value => {
  const text = String(value ?? '').trim();
  return /^\d+(\.\d{1,2})?$/.test(text) ? Math.round(Number(text) * 100) : NaN;
};
const money = c => (Number(c) / 100).toLocaleString('en-HK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- dates ---------- */
const dateLocale = () => (typeof language !== 'undefined' && language === 'zh') ? 'zh-HK' : 'en-GB';
function fmtDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return isNaN(d) ? iso : d.toLocaleDateString(dateLocale(), opts);
}
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Device-local date as YYYY-MM-DD.
const todayIso = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const todayDay = tr => tr.days.find(d => d.date === todayIso());
// Clock minutes from a stop time such as "09:00" or "21:00–22:00" (start time), or null.
const timeMins = s => { const m = /(\d{1,2})[:：.](\d{2})/.exec(s || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };

/* ---------- trip helpers ---------- */
function dayColor(trip, dayId) {
  const i = trip.days.findIndex(d => d.id === dayId);
  return i < 0 ? '#9aa0a8' : DAY_COLORS[i % DAY_COLORS.length];
}
function spotColor(trip, spot, mode) {
  return mode === 'category' ? (CATS[spot.cat]?.color || '#9aa0a8') : dayColor(trip, spot.days[0]);
}
// Text for the current language: the Chinese version while it still matches the English it was written for.
const L = (o, f) => { const z = o && o.zh; return (typeof language !== 'undefined' && language === 'zh' && z && z[f] && z['_' + f] === (o[f] ?? '')) ? z[f] : o[f]; };
const hasCoords = s => Number.isFinite(s.lat) && Number.isFinite(s.lon);
const memberName = (trip, id) => trip.members.find(m => m.id === id)?.name || '(removed)';
const tripTotal = trip => trip.expenses.reduce((n, e) => n + e.amount, 0);

/* ---------- Google Maps links ---------- */
// Opens the place listing (reviews, hours, photos), not just a bare pin.
function gmapsPlaceUrl(s) {
  if (s.gmaps) return s.gmaps;
  const q = [s.jp || s.name, s.city].filter(Boolean).join(' ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q || `${s.lat},${s.lon}`)}`;
}
function gmapsDirectionsUrl(s) {
  const dest = hasCoords(s) ? `${s.lat},${s.lon}` : [s.jp || s.name, s.city].join(' ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=transit`;
}
// Google allows up to 9 waypoints in a shared link; transit mode does not support waypoints.
function gmapsRouteUrl(spots) {
  const pts = spots.filter(hasCoords).map(s => `${s.lat},${s.lon}`);
  if (!pts.length) return '';
  if (pts.length === 1) return `https://www.google.com/maps/dir/?api=1&destination=${pts[0]}`;
  const mid = pts.slice(1, -1).slice(0, 9);
  return `https://www.google.com/maps/dir/?api=1&origin=${pts[0]}&destination=${pts[pts.length - 1]}` +
    (mid.length ? `&waypoints=${encodeURIComponent(mid.join('|'))}` : '');
}
// Numbered route from the map: first point = start, last = end, the rest = stops in the order they were tapped.
// Google allows up to 9 waypoints (11 points in all); transit mode ignores waypoints, so only drive / walk / bike are offered.
const ROUTE_MAX = 11;
function gmapsSeqUrl(spots, mode = 'driving') {
  const pts = spots.filter(hasCoords).map(s => `${s.lat},${s.lon}`);
  if (pts.length < 2) return '';
  const mid = pts.slice(1, -1).slice(0, ROUTE_MAX - 2);
  return `https://www.google.com/maps/dir/?api=1&origin=${pts[0]}&destination=${pts[pts.length - 1]}&travelmode=${mode}` +
    (mid.length ? `&waypoints=${encodeURIComponent(mid.join('|'))}` : '');
}
// Pull coordinates / name out of a pasted Google Maps URL.
function parseGmapsLink(url) {
  const out = { url: url.trim() };
  let m = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
          url.match(/[?&](?:q|query|ll|destination|center)=(-?\d+\.\d+)(?:,|%2C)\s*(-?\d+\.\d+)/i);
  if (m) { out.lat = Number(m[1]); out.lon = Number(m[2]); }
  const p = url.match(/\/place\/([^/@?]+)/);
  if (p) { try { out.name = decodeURIComponent(p[1].replace(/\+/g, ' ')); } catch {} }
  out.isShort = /maps\.app\.goo\.gl|goo\.gl\/maps/.test(url);
  return out;
}
// The trip's ordered stops for one day that are linked to a place.
function daySpots(trip, day) {
  const ids = []; for (const it of day.items) if (it.spotId && !ids.includes(it.spotId)) ids.push(it.spotId);
  return ids.map(id => trip.spots.find(s => s.id === id)).filter(Boolean);
}

/* ---------- geocoding (OpenStreetMap Nominatim, no key needed) ---------- */
async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=${language === 'zh' ? 'zh,ja,en' : 'en,ja'}&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw Error('Place search is unavailable right now.');
  return (await res.json()).map(r => ({ name: r.name || r.display_name.split(',')[0], label: r.display_name, lat: Number(r.lat), lon: Number(r.lon) }));
}

/* ---------- small UI helpers shared by all screens ---------- */
function toast(msg) {
  const el = $('#toast'); el.textContent = typeof t === 'function' ? t(msg) : msg; el.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.hidden = true, 3500);
}
function download(name, text, type = 'application/json') { saveFile(name, text instanceof Blob ? text : new Blob([text], { type })); }
// iPhone / iPad (above all the Home Screen app) often saves a downloaded blob as "Unknown" with no file type.
// There the share sheet is used instead (Save to Files, AirDrop, Mail…), which keeps the name and the format.
const isIOS = () => /iP(hone|ad|od)/.test(navigator.platform) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) || /iP(hone|ad|od)/.test(navigator.userAgent);
async function saveFile(name, blob) {
  const type = blob.type.split(';')[0] || 'application/octet-stream';
  if (isIOS() && typeof File === 'function' && navigator.canShare) {
    const file = new File([blob], name, { type });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return; }
      catch (e) {
        if (e?.name === 'AbortError') return;                                   // the person closed the share sheet
        if (e?.name === 'NotAllowedError') return saveFileSheet(name, file);  // too long after the tap: ask for one more tap
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
function saveFileSheet(name, file) {
  openSheet({ title: t('File ready'), submit: null,
    body: `<p class="user-text"><b>${esc(name)}</b></p><button type="button" class="primary wide" id="save-file">${t('Save or share file')}</button>`,
    onOpen: root => { root.querySelector('#save-file').onclick = async () => { try { await navigator.share({ files: [file], title: name }); closeSheet(); } catch (e) { if (e?.name !== 'AbortError') toast(t('Could not open the share sheet.')); } }; } });
}
const slug = s => (s || 'trip').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-').replace(/^-|-$/g, '') || 'trip';

/* Bottom sheet: one dialog reused for every form.
   opts: {title, body (html), submit (label) | null, onSubmit(formData, form) -> false to keep open, onOpen(root)} */
let sheetHandlers = null;
function openSheet(opts) {
  const dlg = $('#sheet');
  sheetHandlers = opts;
  $('#sheet-title').textContent = opts.title;
  const body = $('#sheet-body');
  body.onclick = body.oninput = body.onchange = null; // drop handlers left by the previous sheet
  body.innerHTML = opts.body;
  $('#sheet-error').textContent = '';
  const submit = $('#sheet-submit');
  submit.hidden = !opts.submit; submit.textContent = opts.submit || '';
  if (!dlg.open) dlg.showModal();
  $('#sheet-body').scrollTop = 0;
  opts.onOpen?.($('#sheet-body'));
}
function closeSheet() { const d = $('#sheet'); if (d.open) d.close(); sheetHandlers = null; }
function sheetError(msg) { $('#sheet-error').textContent = t(msg); }
