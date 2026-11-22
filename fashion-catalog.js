'use strict';
/* Curated fashion places for the "Shops for this day / Near me" list.
   One entry per shop or shopping street. `chain` groups branches of the same company, so only the
   nearest branch is recommended. `trip` = id of a place already in the example trip (never suggested twice).
   Pins are approximate (street / building level); Directions and Google Maps search by the Japanese name.
   Sources: public guides (GO TOKYO, LIVE JAPAN, bring-you, MATCHA) and Xiaohongshu-style shopping posts
   reposted on the open web. Opening hours and New Year opening days are NOT checked. */

// City centres used to decide which city a day (or your GPS position) is in.
const RECO_CITIES = {
  Tokyo:     { ll: [35.681, 139.767], zh: '東京', words: /tokyo|東京|haneda|羽田|shinjuku|shibuya|harajuku|ikebukuro|sumida|asakusa|akihabara|nakano|machida|ginza|ueno/i },
  Osaka:     { ll: [34.690, 135.500], zh: '大阪', words: /osaka|大阪|umeda|梅田|namba|難波|shinsaibashi|心斎橋|kix|關西|関西/i },
  Kyoto:     { ll: [35.004, 135.765], zh: '京都', words: /kyoto|京都/i },
  Kobe:      { ll: [34.692, 135.192], zh: '神戶', words: /kobe|神戸|神戶|sannomiya|三宮/i },
  Himeji:    { ll: [34.826, 134.692], zh: '姬路', words: /himeji|姫路|姬路/i },
  Okayama:   { ll: [34.665, 133.918], zh: '岡山', words: /okayama|岡山/i },
  Takamatsu: { ll: [34.344, 134.050], zh: '高松', words: /takamatsu|高松/i },
  Tottori:   { ll: [35.494, 134.226], zh: '鳥取', words: /tottori|鳥取/i }
};

// F(id, city, area, name, jp, [lat, lon], subs, note, zhName, zhNote, extra)
const F = (id, city, area, name, jp, ll, subs, note, zn, zt, x = {}) => ({ id, city, area, name, jp, lat: ll[0], lon: ll[1], subs, note, zh: { name: zn, note: zt }, chain: x.chain || id, trip: x.trip || '' });

const FASHION_CATALOG = [
  // ---------------- Tokyo · Harajuku / Omotesando ----------------
  F('t_takeshita', 'Tokyo', 'Harajuku', 'Takeshita Street', '竹下通り', [35.6716, 139.7031], ['girly', 'jirai', 'lolita', 'cosplay', 'hats', 'jewels', 'hair'],
    'Cheap cute clothes, jirai, accessories and hair pieces in one lane. Go before 11:00.', '竹下通', '平價可愛服、地雷系、配飾、髮飾集中一條街。11:00 前去。', { trip: 'harajuku_takeshita' }),
  F('t_laforet', 'Tokyo', 'Harajuku', 'Laforet Harajuku', 'ラフォーレ原宿', [35.6690, 139.7053], ['girly', 'jirai', 'lolita', 'select', 'furugi', 'jewels'],
    'Fashion building of small Japanese labels; the gothic / Lolita floor has been on B1.5F (check the floor guide).', 'Laforet 原宿', '日本小眾品牌時裝大樓；哥德／洛麗塔一向在 B1.5 樓（請看樓層指南）。'),
  F('t_catstreet', 'Tokyo', 'Harajuku', 'Cat Street', 'キャットストリート', [35.6670, 139.7068], ['furugi', 'select', 'shoes'],
    'Quiet back street from Harajuku to Shibuya: vintage, sneaker and select shops.', '貓街', '原宿通往澀谷的小街：古著、球鞋及選物店。'),
  F('t_omohills', 'Tokyo', 'Harajuku', 'Omotesando Hills', '表参道ヒルズ', [35.6672, 139.7088], ['select', 'bags', 'jewels'],
    'Calm mall on Omotesando: mid-to-high price accessories and bags.', '表參道之丘', '表參道商場：中高價配飾及手袋。'),
  F('t_ragtag_harajuku', 'Tokyo', 'Harajuku', 'RAGTAG Harajuku', 'ラグタグ 原宿店', [35.6700, 139.7043], ['thrift', 'bags'],
    'Second-hand designer and Japanese brands, sorted by brand. Pin approximate.', 'RAGTAG 原宿店', '二手設計師及日本品牌，按品牌分類。圖釘位置約略。', { chain: 'ragtag' }),
  F('t_kinji', 'Tokyo', 'Harajuku', 'KINJI Harajuku (budget vintage)', '古着屋KINJI 原宿店', [35.6697, 139.7049], ['furugi', 'thrift'],
    'Huge basement vintage store, many items under ¥2,000. Pin approximate.', 'KINJI 原宿店（平價古著）', '大型地庫古著店，不少 ¥2,000 以下。圖釘位置約略。', { chain: 'kinji' }),
  F('t_chicago', 'Tokyo', 'Harajuku', 'Chicago Harajuku (vintage & kimono)', 'シカゴ 原宿表参道店', [35.6683, 139.7045], ['furugi', 'wafuku'],
    'Vintage clothes plus a large used kimono and yukata corner. Pin approximate.', 'Chicago 原宿表參道店（古著・和服）', '古著連大型二手和服、浴衣區。圖釘位置約略。', { chain: 'chicago' }),

  // ---------------- Tokyo · Shibuya / Daikanyama / Nakameguro ----------------
  F('t_109', 'Tokyo', 'Shibuya', 'SHIBUYA109', 'SHIBUYA109 渋谷', [35.6595, 139.6987], ['gyaru', 'girly', 'jirai', 'shoes', 'bags', 'jewels', 'hair'],
    'Gyaru and girly trend brands on many floors. Closed Jan 1.', 'SHIBUYA109', '辣妹及少女系潮流品牌。1 月 1 日休息。', { trip: 'shibuya109' }),
  F('t_parco_shibuya', 'Tokyo', 'Shibuya', 'Shibuya PARCO', '渋谷パルコ', [35.6620, 139.6987], ['select', 'girly', 'shoes', 'bags', 'jewels'],
    'Designer and select shops; Pokémon Center on 6F.', '澀谷 PARCO', '設計師及選物店；6 樓有寶可夢中心。', { chain: 'parco', trip: 'shibuya_parco' }),
  F('t_miyashita', 'Tokyo', 'Shibuya', 'MIYASHITA PARK', 'MIYASHITA PARK', [35.6618, 139.7020], ['select', 'shoes'],
    'Rooftop-park mall: select shops and sneakers.', 'MIYASHITA PARK', '天台公園商場：選物店及球鞋。'),
  F('t_scramble', 'Tokyo', 'Shibuya', 'Shibuya Scramble Square', '渋谷スクランブルスクエア', [35.6584, 139.7022], ['select', 'office', 'jewels'],
    'Station tower with polished womenswear and accessories.', '澀谷 Scramble Square', '車站大樓，精緻女裝及配飾。'),
  F('t_hikarie', 'Tokyo', 'Shibuya', 'Shibuya Hikarie ShinQs', '渋谷ヒカリエ ShinQs', [35.6590, 139.7037], ['office', 'select', 'shoes', 'bags'],
    'Aimed at women in their 20s–30s: office-casual, shoes, bags.', '澀谷 Hikarie ShinQs', '針對 20–30 歲女性：OL 休閒、鞋、手袋。'),
  F('t_daikanyama', 'Tokyo', 'Daikanyama', 'Daikanyama select shops', '代官山 セレクトショップ', [35.6488, 139.7030], ['select', 'furugi'],
    'Relaxed streets of independent select shops and cafés.', '代官山選物店', '悠閒小街，獨立選物店與咖啡店。'),
  F('t_nakameguro', 'Tokyo', 'Nakameguro', 'Nakameguro (Meguro River shops)', '中目黒', [35.6440, 139.6988], ['select', 'furugi'],
    'Small select and vintage shops along the river.', '中目黑（目黑川沿岸）', '河邊的小型選物店及古著店。'),

  // ---------------- Tokyo · Shimokitazawa ----------------
  F('t_shimokita', 'Tokyo', 'Shimokitazawa', 'Shimokitazawa vintage streets', '下北沢 古着', [35.6613, 139.6680], ['furugi', 'thrift', 'denim', 'hats', 'jewels'],
    'Dozens of vintage shops on both sides of the station.', '下北澤古著街', '車站兩邊數十間古著店。', { trip: 'shimokita' }),
  F('t_flamingo', 'Tokyo', 'Shimokitazawa', 'Flamingo Shimokitazawa', 'フラミンゴ 下北沢店', [35.6627, 139.6681], ['furugi'],
    'Classic US vintage, all eras; easy first stop. Pin approximate.', 'Flamingo 下北澤店', '經典美式古著，各年代都有，適合第一站。圖釘位置約略。', { chain: 'flamingo' }),
  F('t_nyjoe', 'Tokyo', 'Shimokitazawa', 'New York Joe Exchange', 'ニューヨークジョーエクスチェンジ 下北沢', [35.6633, 139.6688], ['thrift', 'furugi'],
    'Exchange-style used clothes in an old bathhouse; many pieces ¥500–3,000. Pin approximate.', 'New York Joe Exchange', '舊澡堂改建的二手衣交換店，不少 ¥500–3,000。圖釘位置約略。'),
  F('t_haight', 'Tokyo', 'Shimokitazawa', 'Haight & Ashbury', 'ヘイト&アシュベリー 下北沢', [35.6620, 139.6678], ['furugi', 'jewels'],
    'Curated vintage dresses and accessories. Pin approximate.', 'Haight & Ashbury', '精選古著連身裙及配飾。圖釘位置約略。'),
  F('t_reload', 'Tokyo', 'Shimokitazawa', 'reload (Shimokitazawa)', 'reload 下北沢', [35.6636, 139.6700], ['select', 'furugi'],
    'Low-rise strip of small shops and cafés along the old railway line.', 'reload 下北澤', '舊鐵路線上的低層小店及咖啡店。'),

  // ---------------- Tokyo · Koenji / Nakano / Kichijoji ----------------
  F('t_koenji', 'Tokyo', 'Koenji', 'Koenji vintage (Pal & Look streets)', '高円寺 古着 (PAL・ルック商店街)', [35.7035, 139.6497], ['furugi', 'thrift', 'wafuku'],
    'More relaxed than Shimokitazawa; vintage and used kimono along the south-side arcades.', '高圓寺古著（PAL・Look 商店街）', '比下北澤悠閒；南口商店街有古著及二手和服。'),
  F('t_kitakore', 'Tokyo', 'Koenji', 'Kita-Kore Building', 'キタコレビル', [35.7062, 139.6494], ['furugi'],
    'Avant-garde vintage and designer remakes in a tiny old building. Opens late (around 13:00).', 'Kita-Kore 大樓', '前衛古著及改造設計，舊樓小店。較遲開門（約 13:00）。'),
  F('t_nakano', 'Tokyo', 'Nakano', 'Nakano Broadway (costume & second-hand)', '中野ブロードウェイ', [35.7083, 139.6656], ['cosplay', 'thrift', 'jewels'],
    'Mandarake costume floor, second-hand brand bags and watches. Shops open around 12:00.', '中野 Broadway（Cosplay・二手）', 'Mandarake 服裝部、二手名牌手袋及手錶。約 12:00 開門。'),
  F('t_kichijoji', 'Tokyo', 'Kichijoji', 'Kichijoji Sun Road & side streets', '吉祥寺サンロード', [35.7046, 139.5800], ['basics', 'girly', 'hair', 'jewels'],
    'Covered arcade with cheap cute clothes and accessories.', '吉祥寺 Sun Road', '有蓋商店街，平價可愛服飾及配飾。'),
  F('t_nakamichi', 'Tokyo', 'Kichijoji', 'Kichijoji Nakamichi-dori', '吉祥寺 中道通り', [35.7054, 139.5765], ['select', 'furugi', 'hair'],
    'Small boutiques and vintage shops towards Inokashira Park.', '吉祥寺中道通', '往井之頭公園方向的小店及古著店。'),
  F('t_parco_kichijoji', 'Tokyo', 'Kichijoji', 'Kichijoji PARCO', '吉祥寺パルコ', [35.7040, 139.5786], ['girly', 'select'],
    'Fashion building by the station.', '吉祥寺 PARCO', '車站旁時裝大樓。', { chain: 'parco' }),

  // ---------------- Tokyo · Shinjuku ----------------
  F('t_lumine_shinjuku', 'Tokyo', 'Shinjuku', 'LUMINE EST · LUMINE 1 & 2', 'ルミネエスト・ルミネ新宿', [35.6898, 139.7003], ['girly', 'gyaru', 'jirai', 'basics', 'jewels', 'hair', 'office'],
    'EST (east exit) has many 109-style brands for teens–20s; LUMINE 1 & 2 (south exit) suit 20s–30s.', 'LUMINE EST・LUMINE 1、2', 'EST（東口）有很多 109 系品牌；LUMINE 1、2（南口）適合 20–30 歲。', { chain: 'lumine' }),
  F('t_newoman', 'Tokyo', 'Shinjuku', 'NEWoMan Shinjuku', 'ニュウマン新宿', [35.6880, 139.7016], ['select', 'office', 'jewels'],
    'Grown-up select brands and accessories above the bus terminal.', 'NEWoMan 新宿', '巴士總站上的成熟選物品牌及配飾。'),
  F('t_marui_shinjuku', 'Tokyo', 'Shinjuku', 'Shinjuku Marui Main', '新宿マルイ 本館', [35.6915, 139.7050], ['girly', 'jirai', 'select', 'shoes'],
    'Fashion building; Marui buildings often carry jirai / girly brands.', '新宿丸井本館', '時裝大樓，常有地雷系／少女系品牌。', { chain: 'marui' }),
  F('t_isetan', 'Tokyo', 'Shinjuku', 'Isetan Shinjuku', '伊勢丹新宿店', [35.6917, 139.7040], ['select', 'office', 'girly', 'shoes', 'bags', 'jewels'],
    'Top department store for womenswear and cosmetics. Closed Jan 1.', '伊勢丹新宿店', '女裝及化妝品最強的百貨公司。1 月 1 日休息。', { trip: 'isetan_shinjuku' }),
  F('t_takashimaya_ts', 'Tokyo', 'Shinjuku', 'Takashimaya Times Square', '新宿髙島屋 タイムズスクエア', [35.6874, 139.7024], ['office', 'select', 'bags'],
    'Department store with a wide brand range.', '新宿高島屋 Times Square', '品牌齊全的百貨公司。', { chain: 'takashimaya' }),
  F('t_subnade', 'Tokyo', 'Shinjuku', 'Shinjuku Subnade (underground)', '新宿サブナード', [35.6933, 139.7022], ['basics', 'jewels', 'hair', 'shoes'],
    'Underground mall with cheap accessories and shoes; good on rainy days.', '新宿 Subnade 地下街', '地下商場，平價配飾和鞋，下雨天好去處。'),

  // ---------------- Tokyo · Ikebukuro ----------------
  F('t_alpa', 'Tokyo', 'Ikebukuro', 'Sunshine City ALPA', 'サンシャインシティ アルパ', [35.7292, 139.7187], ['basics', 'girly', 'jirai', 'cosplay'],
    'Big mall with teen-to-20s brands; Pokémon Center Mega Tokyo is here.', '太陽城 ALPA', '大型商場，年輕品牌多；寶可夢中心 Mega Tokyo 在此。'),
  F('t_parco_ikebukuro', 'Tokyo', 'Ikebukuro', 'Ikebukuro PARCO', '池袋パルコ', [35.7302, 139.7114], ['girly', 'select', 'jirai', 'bags', 'jewels'],
    'Fashion building at the east exit.', '池袋 PARCO', '東口時裝大樓。', { chain: 'parco', trip: 'ikebukuro_parco' }),
  F('t_lumine_ikebukuro', 'Tokyo', 'Ikebukuro', 'LUMINE Ikebukuro', 'ルミネ池袋', [35.7284, 139.7104], ['girly', 'select', 'office'],
    'Station building with 20s–30s womenswear.', 'LUMINE 池袋', '車站大樓，20–30 歲女裝。', { chain: 'lumine' }),
  F('t_otome', 'Tokyo', 'Ikebukuro', 'animate Ikebukuro · Otome Road', 'アニメイト池袋本店', [35.7313, 139.7166], ['cosplay'],
    'Anime goods and cosplay-adjacent items.', 'animate 池袋本店・乙女路', '動漫商品及 Cosplay 相關用品。', { trip: 'animate_ikebukuro' }),

  // ---------------- Tokyo · Ginza / Ueno / Akihabara / Asakusa ----------------
  F('t_ginza_six', 'Tokyo', 'Ginza', 'GINZA SIX', 'GINZA SIX', [35.6698, 139.7640], ['select', 'office', 'bags'],
    'Luxury and designer mall; window shopping and tax-free.', 'GINZA SIX', '高級及設計師商場，可辦免稅。'),
  F('t_uniqlo_ginza', 'Tokyo', 'Ginza', 'Uniqlo Ginza (12-floor flagship)', 'ユニクロ 銀座店', [35.6706, 139.7646], ['basics', 'lounge', 'outdoor'],
    'Biggest Uniqlo range in one place; GU is next door area.', 'Uniqlo 銀座旗艦店', '款式最齊全的 Uniqlo。', { chain: 'uniqlo' }),
  F('t_tokyu_ginza', 'Tokyo', 'Ginza', 'Tokyu Plaza Ginza', '東急プラザ銀座', [35.6713, 139.7627], ['select', 'jewels'],
    'Select brands and accessories at Sukiyabashi.', '東急 Plaza 銀座', '數寄屋橋的選物品牌及配飾。'),
  F('t_ameyoko', 'Tokyo', 'Ueno', 'Ameyoko market', 'アメ横', [35.7108, 139.7746], ['basics', 'shoes', 'bags', 'outdoor'],
    'Street market with cheap shoes, bags and jackets; very busy before New Year.', '阿美橫丁', '街市，平價鞋、手袋及外套；新年前極擠。'),
  F('t_marui_ueno', 'Tokyo', 'Ueno', 'Ueno Marui', '上野マルイ', [35.7105, 139.7737], ['girly', 'shoes'],
    'Fashion building by Ueno station.', '上野丸井', '上野站旁時裝大樓。', { chain: 'marui' }),
  F('t_donki_akiba', 'Tokyo', 'Akihabara', 'Don Quijote Akihabara (costumes)', 'ドン・キホーテ 秋葉原店', [35.7012, 139.7714], ['cosplay'],
    'Cheapest costume and wig floor in central Tokyo.', '唐吉訶德秋葉原店（Cosplay）', '市中心最平的服裝及假髮樓層。', { chain: 'donki' }),
  F('t_asakusa_kimono', 'Tokyo', 'Asakusa', 'Asakusa kimono rental streets', '浅草 着物レンタル', [35.7125, 139.7955], ['wafuku', 'hair'],
    'Many rental shops near Sensoji; book ahead in the New Year period.', '淺草和服租借', '淺草寺附近大量租借店；新年期間要預約。'),

  // ---------------- Tokyo · east & south ----------------
  F('t_parco_kinshicho', 'Tokyo', 'Kinshicho', 'Kinshicho PARCO', '錦糸町パルコ', [35.6963, 139.8152], ['basics', 'girly'],
    'Everyday fashion mall near Sumida.', '錦糸町 PARCO', '墨田附近的日常時裝商場。', { chain: 'parco' }),
  F('t_marui_kinshicho', 'Tokyo', 'Kinshicho', 'Kinshicho Marui', '錦糸町マルイ', [35.6967, 139.8137], ['basics', 'girly', 'jirai', 'bags', 'jewels', 'hair'],
    'Fashion building near Sumida.', '錦糸町丸井', '墨田附近的時裝大樓。', { chain: 'marui', trip: 'kinshicho_marui' }),
  F('t_solamachi', 'Tokyo', 'Oshiage', 'Tokyo Solamachi (Skytree)', '東京ソラマチ', [35.7101, 139.8107], ['girly', 'hair', 'jewels'],
    'Small accessory and souvenir-fashion shops under Skytree; open over New Year.', '東京晴空街道', '晴空塔下的配飾及小店，新年照常營業。'),
  F('t_divercity', 'Tokyo', 'Odaiba', 'DiverCity Tokyo Plaza', 'ダイバーシティ東京 プラザ', [35.6252, 139.7757], ['basics', 'girly'],
    'Big mall with fast-fashion flagships.', 'DiverCity 東京', '大型商場，快時尚旗艦店。'),
  F('t_jiyugaoka', 'Tokyo', 'Jiyugaoka', 'Jiyugaoka boutiques', '自由が丘', [35.6076, 139.6688], ['girly', 'select', 'hair'],
    'Pretty streets of girly boutiques and accessory shops.', '自由之丘小店', '少女系小店及配飾店林立。'),
  F('t_machida', 'Tokyo', 'Machida', 'Machida second-hand (Book Off Super Bazaar clothing)', '町田 古着・リサイクル', [35.5421, 139.4455], ['thrift', 'bags'],
    'Super Bazaar clothing is in a separate building from the books/hobby one. Pin is the station area.', '町田二手（Book Off Super Bazaar 服飾館）', 'Super Bazaar 服飾在另一幢大樓。圖釘為車站一帶。'),

  // ---------------- Osaka ----------------
  F('o_shinsaibashi', 'Osaka', 'Shinsaibashi', 'Shinsaibashi-suji arcade', '心斎橋筋商店街', [34.6740, 135.5014], ['basics', 'girly', 'shoes'],
    'Long covered street of chains and drugstores.', '心齋橋筋商店街', '長長的有蓋商店街，連鎖店及藥妝。'),
  F('o_parco', 'Osaka', 'Shinsaibashi', 'Shinsaibashi PARCO', '心斎橋PARCO', [34.6733, 135.5012], ['girly', 'select', 'jirai'],
    'Fashion building with subculture floors.', '心齋橋 PARCO', '有次文化樓層的時裝大樓。', { chain: 'parco' }),
  F('o_amemura', 'Osaka', 'Amerikamura', 'Amerikamura (America-mura)', 'アメリカ村', [34.6720, 135.4983], ['furugi', 'gyaru', 'jirai', 'hats'],
    "Osaka's youth and vintage district.", '美國村', '大阪年輕人及古著區。'),
  F('o_horie', 'Osaka', 'Horie', 'Horie (Orange Street)', '堀江 オレンジストリート', [34.6730, 135.4930], ['select', 'furugi'],
    'Calmer select and interior shops.', '堀江（橘通）', '較悠閒的選物及家品店。'),
  F('o_nambaparks', 'Osaka', 'Namba', 'Namba Parks', 'なんばパークス', [34.6619, 135.5016], ['select', 'basics'],
    'Terraced mall by Namba station.', 'Namba Parks', '難波站旁的梯田式商場。'),
  F('o_marui', 'Osaka', 'Namba', 'Namba Marui', 'なんばマルイ', [34.6652, 135.5011], ['girly', 'jirai'],
    'Fashion building.', '難波丸井', '時裝大樓。', { chain: 'marui' }),
  F('o_hepfive', 'Osaka', 'Umeda', 'HEP FIVE', 'HEP FIVE', [34.7039, 135.5006], ['girly', 'gyaru', 'jirai', 'hair'],
    'Teen and 20s trend brands under the red Ferris wheel.', 'HEP FIVE', '紅色摩天輪下的年輕潮流品牌。'),
  F('o_lucua', 'Osaka', 'Umeda', 'LUCUA Osaka', 'ルクア大阪', [34.7047, 135.4958], ['select', 'office', 'girly'],
    'Station building for 20s–30s womenswear.', 'LUCUA 大阪', '車站大樓，20–30 歲女裝。'),
  F('o_hankyu', 'Osaka', 'Umeda', 'Hankyu Umeda Main Store', '阪急うめだ本店', [34.7032, 135.4986], ['office', 'select', 'bags'],
    'Top department store for womenswear.', '阪急梅田本店', '女裝最強的百貨公司。', { chain: 'hankyu' }),
  F('o_nakazaki', 'Osaka', 'Nakazakicho', 'Nakazakicho vintage alleys', '中崎町', [34.7075, 135.5050], ['furugi', 'select'],
    'Old houses turned into vintage shops and cafés.', '中崎町古著小巷', '舊民房改建的古著店及咖啡店。'),
  F('o_tenjinbashi', 'Osaka', 'Tenma', 'Tenjinbashisuji arcade', '天神橋筋商店街', [34.7010, 135.5117], ['basics', 'shoes'],
    "Japan's longest arcade; cheap everyday clothes.", '天神橋筋商店街', '日本最長商店街；平價日常衣物。'),
  F('o_denden', 'Osaka', 'Nipponbashi', 'Den Den Town (cosplay)', '日本橋 オタロード', [34.6595, 135.5063], ['cosplay'],
    "Osaka's anime and cosplay street.", '日本橋電電城（Cosplay）', '大阪動漫及 Cosplay 街。'),

  // ---------------- Kyoto ----------------
  F('k_kawaramachi', 'Kyoto', 'Kawaramachi', 'Shijo Kawaramachi (Takashimaya, Marui)', '四条河原町', [35.0035, 135.7690], ['girly', 'office', 'select'],
    'Main shopping crossing with department stores.', '四條河原町', '百貨公司集中的購物中心。'),
  F('k_shinkyogoku', 'Kyoto', 'Kawaramachi', 'Shinkyogoku & Teramachi arcades', '新京極・寺町商店街', [35.0065, 135.7680], ['basics', 'hair', 'furugi'],
    'Covered streets with cheap clothes, vintage and hair accessories.', '新京極・寺町商店街', '有蓋商店街，平價衣物、古著及髮飾。'),
  F('k_kimono', 'Kyoto', 'Higashiyama', 'Kiyomizu kimono rental', '清水寺周辺 着物レンタル', [34.9965, 135.7790], ['wafuku', 'hair'],
    'Rental shops on the slopes to Kiyomizu-dera.', '清水寺一帶和服租借', '清水寺坡道上的租借店。'),

  // ---------------- Kobe / Himeji / Okayama / Takamatsu (mostly already in the example trip) ----------------
  F('b_sannomiya', 'Kobe', 'Sannomiya', 'Sannomiya Center-gai', '三宮センター街', [34.6941, 135.1952], ['basics', 'girly', 'shoes'], 'Main covered shopping street.', '三宮中心街', '主要有蓋商店街。', { trip: 'sannomiya' }),
  F('b_motomachi', 'Kobe', 'Motomachi', 'Motomachi Shopping Street', '元町商店街', [34.6886, 135.1898], ['girly', 'shoes', 'bags'], 'Older arcade west of Sannomiya.', '元町商店街', '三宮以西的老商店街。', { trip: 'motomachi' }),
  F('b_umie', 'Kobe', 'Harborland', 'Kobe Harborland umie', '神戸ハーバーランド umie', [34.6815, 135.1820], ['basics', 'girly', 'select'], 'Waterfront mall.', '神戶 umie', '海濱商場。', { trip: 'harborland' }),
  F('b_marui', 'Kobe', 'Sannomiya', 'Kobe Marui', '神戸マルイ', [34.6922, 135.1957], ['girly', 'jirai'], 'Fashion building.', '神戶丸井', '時裝大樓。', { chain: 'marui', trip: 'kobe_marui' }),
  F('h_piole', 'Himeji', 'Station', 'Piole Himeji', 'ピオレ姫路', [34.8273, 134.6911], ['basics', 'girly'], 'Station mall.', 'Piole 姬路', '車站商場。', { trip: 'piole' }),
  F('h_miyuki', 'Himeji', 'Station', 'Miyuki-dori arcade', 'みゆき通り商店街', [34.8305, 134.6908], ['basics', 'shoes'], 'Covered street from the station to the castle.', '御幸通商店街', '車站往姬路城的有蓋商店街。'),
  F('y_ichibangai', 'Okayama', 'Station', 'Okayama Ichibangai (underground)', '岡山一番街', [34.6662, 133.9185], ['girly', 'jewels', 'hair'], 'Underground mall under the station.', '岡山一番街', '車站地下商場。'),
  F('y_omotecho', 'Okayama', 'Omotecho', 'Omotecho arcade', '表町商店街', [34.6610, 133.9300], ['basics', 'furugi'], 'Long arcade with local and vintage shops.', '表町商店街', '長商店街，本地及古著小店。'),
  F('m_mitsukoshi', 'Takamatsu', 'Center', 'Takamatsu Mitsukoshi', '高松三越', [34.3445, 134.0510], ['office', 'select'], 'Department store.', '高松三越', '百貨公司。', { trip: 'mitsukoshi' }),
  F('m_tamachi', 'Takamatsu', 'Center', 'Tamachi & Minamishinmachi arcades', '田町・南新町商店街', [34.3385, 134.0510], ['basics', 'girly'], 'Covered arcades south of Marugamemachi.', '田町・南新町商店街', '丸龜町以南的有蓋商店街。')
];
