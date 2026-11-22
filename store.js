'use strict';
/* Data layer. Everything the user edits lives in one object saved to localStorage.
   To sync between phones later, replace loadDb()/saveDb() with calls to your backend
   (Supabase, Firebase, your own API) — nothing else in the app touches storage. */

const STORE_KEY = 'trip-companion-v3';

const CATS = {
  base:    { label: 'Hotels & transport', color: '#5b6472', icon: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>' },
  sights:  { label: 'Photos & Christmas', color: '#2f8a5b', icon: '<path d="M4 8h3l1.5-2.5h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>' },
  food:    { label: 'Restaurants',        color: '#d9692b', icon: '<path d="M5 3v5a3 3 0 0 0 6 0V3M8 3v18M17 21V3c-2.7 1.5-3.5 5-3.5 8H17"/>' },
  fashion: { label: 'Fashion & cosmetics',color: '#8a57c9', icon: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>' },
  shopping:{ label: 'Shopping', color: '#397f85', icon: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>' },
  pokemon: { label: 'Pokémon & cards',    color: '#c99a06', icon: '<circle cx="12" cy="12" r="9"/><path d="M3 12h5.5M15.5 12H21"/><circle cx="12" cy="12" r="3"/>' },
  slowpoke:{ label: 'Slowpoke',           color: '#e0528f', icon: '<path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z"/>' }
};
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
  // trips made before timezone support: give them a destination/home zone (editable via Rename trip → Timezones)
  db.trips.forEach(tr => { if (!tzValid(tr.homeTz)) tr.homeTz = deviceTz(); if (!tzValid(tr.tz)) tr.tz = tr.id === 'trip-setouchi' ? 'Asia/Tokyo' : tr.homeTz; });
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
// Device-local date (the old version used UTC, which gave the wrong day for Asia mornings). Trip screens use todayIn(tripTz(trip)).
const todayIso = () => todayIn(deviceTz());

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
function download(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
