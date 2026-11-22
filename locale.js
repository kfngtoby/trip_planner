'use strict';
let language=(()=>{try{return localStorage.getItem('trip-lang')||'en'}catch{return 'en'}})();
const ZH={
  'Details':'詳情','Categories':'分類','Close place':'關閉地點',
  'Setouchi':'瀨戶內','Map':'地圖','Itinerary':'行程','Expenses':'開支','Places':'地點','Add spot':'新增地點','Search':'搜尋','Search spots':'搜尋地點','This day':'當天','Fit map':'顯示全部','Drop a pin':'放置圖釘','Cancel pin drop':'取消圖釘','Current day':'日期','Language':'語言','Trip views':'旅程分頁','Map categories':'地圖分類','Interactive trip map':'互動旅程地圖','Places list':'地點清單','Zoom in':'放大','Zoom out':'縮小','Map':'地圖','Toggle attribution':'顯示地圖版權','Close popup':'關閉地點',
  'Slowpoke':'呆呆獸','Fashion & cosmetics':'時裝・美妝','Restaurants':'餐廳','Pokémon & cards':'寶可夢・卡牌','Photos & Christmas':'攝影・聖誕','Hotels & transport':'住宿・交通',
  'Google Maps':'Google 地圖','Directions':'路線','Research source':'資料連結','View on map':'查看地圖','Remove my spot':'移除地點','Research suggestion':'備選地點','Added by you':'自行新增','No places match. Clear search or filters.':'沒有符合的地點',
  'Export':'匯出','Export Google My Maps KML':'匯出 KML','Export places CSV':'匯出 CSV','Download backup':'下載備份','Import backup':'匯入備份','Connected':'已連線','Database unavailable · Saving disabled':'未能連線・暫停儲存',
  'Members':'成員','Add expense':'新增開支','Split expense':'分攤開支','Save item':'儲存','Save':'儲存','Close':'關閉','Amount · HKD':'金額・港元','Title':'項目','Paid by':'付款人','Multiple':'多人付款','Split between':'分攤成員','Equal':'均分','Exact':'自訂','Paid amount':'付款金額','Share amount':'分攤金額','Unassigned':'未分攤','Settlement':'結算','Transfers':'轉賬','All settled':'已結清','Balances and settlement':'餘額與結算','Remove expense':'移除開支','No expenses':'尚無開支','Expenses unavailable':'未能載入開支','You':'你','Partner':'伴侶','Member name':'成員名稱','New member':'新成員','Add member':'新增成員',
  'Accommodation':'住宿','Flights':'機票','Transport':'交通','Food':'餐飲','Shopping':'購物','Attractions':'景點','Other':'其他','Category':'分類','Trip day':'日期','Add a spot':'新增地點','Place name':'地點名稱','City':'城市','Latitude':'緯度','Longitude':'經度','Notes':'備註','Add actual expense':'新增開支','Item name':'項目名稱','Actual amount · HKD':'金額・港元','Payment / receipt note':'付款備註',
  'Enter a positive actual HKD amount.':'請輸入有效港元金額','Select at least one member.':'請至少選擇一位成員','Member amounts must match the expense total.':'成員金額總和須等於開支金額','Enter a member name (1–40 characters).':'請輸入成員名稱（1–40 字）','Enter an amount with up to two decimals.':'金額最多兩位小數','Invalid member amounts.':'成員金額無效','Maximum 30 members.':'最多 30 位成員','A name is required.':'請輸入名稱','Select a trip day.':'請選擇日期','Enter valid latitude and longitude.':'請輸入有效經緯度','Invalid category.':'分類無效','Could not save.':'未能儲存','Item removed.':'已移除','Saved to the trip database.':'已儲存','Connection unavailable. Please retry before adding an item.':'未能連線，請稍後再試','Tap the map where you want to add a spot.':'點選地圖新增地點','Some map tiles are unavailable. The places list and Google Maps links still work.':'部分地圖未能載入，仍可使用地點清單及 Google 地圖','Map unavailable. Use the places list and Google Maps directions.':'未能載入地圖，可使用地點清單及 Google 路線',
  'Saved data is unavailable; backup not created.':'未能載入資料，無法備份','Backup file is too large.':'備份檔案過大','Not a trip backup.':'並非旅程備份','Backup exceeds 500 items.':'備份超過 500 個項目','Backup imported. Existing IDs were not duplicated.':'已匯入備份，沒有重複項目',
  'Himeji':'姬路','Kobe':'神戶','Tottori':'鳥取','Okayama':'岡山','Takamatsu':'高松','Haneda':'羽田','KIX':'關西機場','Hong Kong':'香港','Tokyo':'東京','Ayagawa':'綾川','Sumida City':'墨田區','Takamatsu-Chikko':'高松築港','Shin-Kobe':'新神戶','Shin-Osaka':'新大阪',
  'Arrive in Himeji':'抵達姬路','Kansai Airport arrival':'抵達關西機場','Kansai Airport':'關西機場','Kansai-airport':'關西機場','Hotel check-in':'酒店入住','Haruka':'HARUKA 遙號','Sanyo Shinkansen':'山陽新幹線','JR pass exchange':'兌換 JR 周遊券','Kansai-airport Station':'關西機場站','Comfort Hotel Himeji':'姬路康福特酒店','Dinner near Himeji Station':'姬路站附近晚餐','Himeji Station':'姬路站',
  'Kobe shopping & harbour':'神戶購物與海港','Kitano photo walk':'北野散步攝影','Kitano Ijinkan-gai':'北野異人館街','Nunobiki Herb Garden':'布引香草園','Kobe beef & shopping':'神戶牛與購物','Mouriya or Ishida Honten':'Mouriya 或 Ishida 本店','Sannomiya Center-gai':'三宮中心街','Daimaru':'大丸百貨','Fashion & cosmetics':'時裝・美妝','Pokémon cards':'寶可夢卡牌','Hareruya2 Sannomiya':'晴れる屋2 三宮店','Harbour photos':'海港攝影','Meriken Park':'美利堅公園','Waterfront night views':'海濱夜景','Return to Himeji before 21:00':'21:00 前返回姬路',
  'Tottori sand dunes':'鳥取砂丘','Super Hakuto limited express':'超級白兔號特急','Sand Dunes photos':'砂丘攝影','Tottori Station':'鳥取站','Tottori Sand Dunes':'鳥取砂丘','Gyukotsu ramen':'牛骨拉麵','Hinma or Gottsuo':'Hinma 或 Gottsuo','Museum & Pokémon stop':'美術館與寶可夢','Sand Museum':'砂之美術館','Sandshrew manhole':'穿山鼠渠蓋','Hamasaka':'濱坂','Cards & return to Himeji':'卡牌購物後返回姬路','Card Kingdom':'卡牌王國','Tottori Station area':'鳥取站周邊','Super Hakuto':'超級白兔號',
  'Christmas in Okayama & Himeji':'岡山與姬路聖誕遊','Korakuen Garden':'後樂園','Garden walk & photos':'庭園散步攝影','Okayama Station shops':'岡山站商店','Fashion, cosmetics & cards':'時裝、美妝與卡牌','Aeon Mall Okayama':'岡山 AEON MALL','Card shopping near Okayama Station':'岡山站附近購買卡牌','Return to Himeji':'返回姬路','Himeji Castle exterior photos':'姬路城外觀攝影','Christmas dinner':'聖誕晚餐','Himeji Station area':'姬路站周邊',
  'Slowpoke day':'呆呆獸之旅','Check out & travel to Takamatsu':'退房後前往高松','Marine Liner':'Marine Liner 快速列車','Luggage drop & lunch':'寄存行李與午餐','APA Takamatsu Kawaramachi':'APA 高松瓦町酒店','Room check-in from 15:00':'15:00 起入住','Kotoden & Slowpoke Park':'琴電與呆呆獸公園','Kotoden Kotohira Line':'琴電琴平線','Slowpoke Park':'呆呆獸公園','1 hour + manhole':'1 小時＋渠蓋拍照','Pokémon Center Kagawa':'寶可夢中心香川','Slowpoke merchandise':'呆呆獸商品','Photos':'攝影','Cards':'卡牌','City-centre Slowpoke manhole':'市中心呆呆獸渠蓋','Dinner & shopping':'晚餐與購物','Olive-beef yakiniku':'橄欖牛燒肉','Niku no Kindo':'肉の近どう','Marugamemachi arcade':'丸龜町商店街','Cosmetics':'美妝',
  'Takamatsu morning · Tokyo evening':'高松早晨・東京夜晚','Hotel checkout':'酒店退房','Checkout deadline: 10:00':'10:00 前退房','Ritsurin Garden':'栗林公園','Garden photos':'庭園攝影','Ritsurin-an':'栗林庵','Slowpoke booklet & stamps':'呆呆獸小冊子與印章','Postbox, lunch & shopping':'郵筒、午餐與購物','Slowpoke postbox':'呆呆獸郵筒','Takamatsu Central Post Office':'高松中央郵便局','Takamatsu Airport':'高松機場','Airport bus':'機場巴士','JR Takamatsu Station':'JR 高松站','Airport':'機場','Slowpoke merchandise & stamp':'呆呆獸商品與印章','JAL JL484 to Haneda':'JAL JL484 前往羽田','Tokyo Haneda':'東京羽田','Terminal 1':'第一客運大樓','Tokyo accommodation':'東京住宿',
  'Evening':'傍晚','Morning':'上午','Lunch / afternoon':'午餐／下午','Afternoon':'下午','Late morning':'上午稍後','Lunch':'午餐','Early afternoon':'下午較早','Late afternoon':'下午稍後','Before sunset':'日落前','Bus':'巴士','Alternative:':'另一選擇：','Optional:':'可選：','Station':'站',
  'Comfort Hotel Himeji · 4 nights':'姬路康福特酒店・4 晚','APA Takamatsu Kawaramachi · 1 night':'APA 高松瓦町酒店・1 晚','JAL Takamatsu → Haneda · 2 adults':'JAL 高松 → 羽田・2 位成人'
};
Object.assign(ZH,{
  'Himeji Castle (view from afar)':'姬路城（遠眺）','Hitotoki Christmas Market · Otemae Park':'大手前公園・聖誕市集','Piole Himeji (station mall)':'Piole 姬路商場','Grand Festa Himeji':'姬路 Grand Festa','Don Quijote Himeji RIOS':'唐吉訶德姬路 RIOS 店','Kappa-tei (kaiseki, budget)':'河童亭（懷石料理）','Card Labo Himeji':'卡牌實驗室姬路店','Toreca ST@RT Himeji':'Toreca ST@RT 姬路店',
  'Kobe Hankyu / Daimaru / Marui / OPA':'神戶阪急／大丸／丸井／OPA','Motomachi Shopping Street':'元町商店街','Kobe Harborland umie':'神戶臨海樂園 umie','Kobe Beef Ishida Honten':'神戶牛 Ishida 本店','Mouriya Sannomiya':'Mouriya 三宮店','Meriken Park Christmas Market':'美利堅公園聖誕市集','Nunobiki Herb Garden Illumination':'布引香草園燈飾',
  'Hakuto Shrine (White Rabbit)':'白兔神社','Ramen Gottsuo (gyukotsu)':'Gottsuo 牛骨拉麵','Ramen Hinma':'Hinma 拉麵','Card Kingdom Tottori Ekimae':'卡牌王國鳥取站前店','Sandshrew Manhole · Hamasaka':'濱坂・穿山鼠渠蓋','Okayama Station':'岡山站','Aeon Mall Okayama · Pokémon Store':'岡山 AEON MALL・寶可夢商店','Card Labo Okayama West Exit':'卡牌實驗室岡山西口店',
  'APA Hotel Takamatsu Kawaramachi':'APA 高松瓦町酒店','Kotoden Takamatsu-Chikko Station':'琴電高松築港站','Marugamemachi Arcade · Slowpoke spots':'丸龜町商店街・呆呆獸景點','animate Takamatsu':'animate 高松店','Don Quijote Takamatsu Marugamemachi':'唐吉訶德高松丸龜町店','Takamatsu Mitsukoshi':'高松三越','Udon Baka Ichidai':'手打十段烏冬 Baka 一代','Merikenya Takamatsu Ekimae':'Merikenya 高松站前店','Niku no Kindo · olive beef yakiniku':'肉の近どう・橄欖牛燒肉','Yotteya · honetsukidori yatai':'Yotteya・骨付鳥屋台','Matsushita Seimenjo':'松下製麵所','Ritsurin Garden · Slowpoke stamps':'栗林公園・呆呆獸印章','Takamatsu Airport · Slowpoke corner':'高松機場・呆呆獸專區','Slowpoke Postbox · Central Post Office':'中央郵便局・呆呆獸郵筒','Slowpoke Park Ayagawa':'綾川呆呆獸公園','Takinomiya Michi-no-Eki':'道之驛瀧宮','Yamagoe Udon':'山越烏冬','Kotohira-gu Shrine':'金刀比羅宮','Nakano Udon School':'中野烏冬學校',
  'No allocated expenses':'尚無已分攤開支','No transfers':'無需轉賬','Full screen':'全螢幕','Reset bearing to north':'重設為北方'
});
Object.assign(ZH,{'Destination timezone':'目的地時區','Home timezone':'居住地時區','Time is in':'時間所屬時區','trip':'旅程','home':'本地','days to go':'天後出發','Trip ended':'旅程已結束','days ago':'天前','Between days':'行程期間','Home time':'本地時間','Timezone':'時區','Enter a valid timezone, e.g. Asia/Tokyo.':'請輸入有效時區，例如 Asia/Tokyo'});
function t(value){
  if(language!=='zh')return value;
  const text=String(value),trim=text.trim();
  if(ZH[trim])return text.replace(trim,ZH[trim]);
  let out=trim.replace(/^Day (\d+).*$/,'第 $1 天').replace(/^(?:Tue|Wed|Thu|Fri|Sat|Sun) (\d+) Dec$/, '12月$1日').replace(/^By (\d+:\d+)$/,'$1 前').replace(/^(\d+) Dec$/,'12月$1日');
  if(out!==trim)return text.replace(trim,out);
  if(trim.includes('\n'))return text.split('\n').map(t).join('\n');
  for(const separator of [' · ',' → ',' / ',' & ',' + '])if(trim.includes(separator))return text.replace(trim,trim.split(separator).map(t).join(separator));
  if(trim.startsWith('Alternative: '))return '另一選擇：'+t(trim.slice(13));
  if(trim.startsWith('Optional: '))return '可選：'+t(trim.slice(10));
  return text;
}

Object.assign(ZH,{
  'My trips':'我的旅程','New trip':'新增旅程','All trips':'所有旅程','Trip name':'旅程名稱','Start date':'開始日期','Number of days':'日數','Currency':'貨幣','Create trip':'建立旅程',
  'Rename trip':'重新命名','Duplicate trip':'複製旅程','Delete trip':'刪除旅程','Trip options':'旅程選項','Export trip backup':'匯出旅程備份','Import trip backup':'匯入旅程備份','Export for Google My Maps (KML)':'匯出至 Google My Maps（KML）',
  'Days':'每日行程','Overview':'總覽','All days':'全部日子','Expand all':'全部展開','Collapse all':'全部收起','Add day':'新增一天','Edit day':'編輯日子','Delete day':'刪除這天','Add stop':'新增行程','Edit stop':'編輯行程','Delete stop':'刪除行程','Move up':'上移','Move down':'下移',
  'Time':'時間','Date':'日期','Day title':'當日標題','Area':'地區','Place':'地點','No place':'不連結地點','Day':'日子','Unassigned day':'未分配日子','No stops yet':'尚未有行程',
  'Add place':'新增地點','Edit place':'編輯地點','Delete place':'刪除地點','Open in Google Maps':'在 Google 地圖開啟','Route in Google Maps':'在 Google 地圖規劃路線','Google Maps link':'Google 地圖連結','Find place':'搜尋地點','Pick on map':'在地圖上選擇','Tap the map to set the location.':'點擊地圖設定位置','No location yet':'未有位置','Source':'來源','Hours':'營業時間','Japanese name':'日文名稱','Coordinates':'座標','Search results':'搜尋結果','No results. Try the Japanese name or add the city.':'找不到結果，試試日文名稱或加上城市',
  'Import from Xiaohongshu':'從小紅書匯入','Paste note text':'貼上筆記內容','Find places':'找出地點','Area hint':'地區提示','Add selected places':'加入所選地點','No places found in this text. Places are detected from 📍 lines and 地址/店名 labels.':'找不到地點。系統會讀取 📍 及 地址/店名 標示',
  'is a payer or has a fixed share in these expenses. Edit them first, then remove:':'曾付款或在以下開支有自訂分攤，請先修改這些開支再移除：','recalculated':'重新計算',
  'Short links open the exact place in Google Maps, but the map pin needs a location: search the name above or pick on map.':'短連結可直接開啟 Google 地圖地點，但地圖圖釘需要位置：請在上方搜尋名稱或在地圖上選擇。',
  'In 小红书, open a note → Share → Copy link, then also copy the note text (long-press). Paste both below. Places marked with 📍 or 店名/地址 are picked up.':'在小紅書打開筆記 → 分享 → 複製連結，再長按複製筆記內容，一併貼在下方。系統會讀取 📍 或 店名/地址 標示的地點。',
  'Location is not available on this device.':'此裝置無法使用定位','Location permission was denied.':'定位權限被拒絕','Place search is unavailable right now.':'暫時無法搜尋地點','Could not save. Browser storage is full or blocked (private mode?).':'未能儲存，瀏覽器儲存空間已滿或被封鎖',
  'No trips yet. Create one to start planning.':'尚未有旅程，建立一個開始計劃吧','Backup file is too large.':'備份檔案太大','Not a trip backup.':'不是旅程備份檔案','Filter by day':'按日子篩選','More':'更多','Search':'搜尋','Name, address or Japanese name':'名稱、地址或日文名稱','Paste a link from Google Maps → Share':'貼上 Google 地圖「分享」連結','New member':'新成員','Select at least one place.':'請至少選擇一個地點',
  'Settle up':'結算','Delete expense':'刪除開支','Remove':'移除','Spent':'已花費','Balances':'餘額','Edit expense':'編輯開支','paid':'已付','Saved':'已儲存','Deleted':'已刪除',
  'Show my location':'顯示我的位置','Fit all':'顯示全部','places':'個地點','stops':'個行程'
});

Object.assign(ZH,{'On map':'地圖','All':'全部','Clear':'清除','Slowpoke':'呆呆獸'});

const originalTexts=new WeakMap(),originalAttributes=new WeakMap();
const EN=Object.fromEntries(Object.entries(ZH).map(([en,zh])=>[zh,en]));
function sourceText(value){const trim=value.trim();return EN[trim]?value.replace(trim,EN[trim]):value;}
// User-entered text (inside .user-text) is never machine-translated.
const SKIP='script,style,.leaflet-control-attribution,[data-lang],.user-text,input,textarea';
function localize(){
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()){
    const node=walker.currentNode;if(node.parentElement?.closest(SKIP))continue;
    const saved=originalTexts.get(node);
    const source=saved&&node.nodeValue===saved.last?saved.source:sourceText(node.nodeValue);
    const next=t(source);originalTexts.set(node,{source,last:next});if(next!==node.nodeValue)node.nodeValue=next;
  }
  for(const el of document.querySelectorAll('[aria-label],[placeholder],[title]')){
    if(el.closest('.leaflet-control-attribution,.user-text'))continue;
    const saved=originalAttributes.get(el)||{};
    for(const attr of ['aria-label','placeholder','title']){
      if(!el.hasAttribute(attr))continue;
      const current=el.getAttribute(attr),old=saved[attr],source=old&&old.last===current?old.source:sourceText(current),next=t(source);
      saved[attr]={source,last:next};if(next!==current)el.setAttribute(attr,next);
    }
    originalAttributes.set(el,saved);
  }
}
function setLanguage(lang){
  language=lang;try{localStorage.setItem('trip-lang',lang)}catch{}
  document.documentElement.lang=lang==='zh'?'zh-Hant':'en';
  document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
  window.dispatchEvent(new Event('langchange'));
  localize();
}
document.addEventListener('DOMContentLoaded',()=>{
  // Delegated so the toggle keeps working after each screen re-renders.
  document.addEventListener('click',e=>{const b=e.target.closest('[data-lang]');if(b)setLanguage(b.dataset.lang);});
  document.documentElement.lang=language==='zh'?'zh-Hant':'en';
  let queued=false;
  new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;localize();
    document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===language)));});})
    .observe(document.body,{subtree:true,childList:true,characterData:true});
});

Object.assign(ZH,{'Percent':'百分比','Shares':'份數','Share':'分攤','Paid':'已付','Balance':'結餘','Summary':'摘要','Transfers':'轉賬','Payments':'已付款記錄','Payment':'付款','Mark paid':'標記已付','Undo':'撤銷','Export CSV':'匯出 CSV','Percentages must add up to 100.':'百分比總和須為 100','Enter a value for at least one member.':'請至少為一位成員輸入數值'});
Object.assign(ZH,{'Optimise route':'優化路線','Sort by time':'按時間排序','Reorder':'調整順序','Done':'完成','Today':'今天','Duplicate':'複製','Undo':'撤銷','Route shortened':'路線已縮短','Route is already efficient':'路線已是最短','Already in time order':'已按時間排序','Sorted by time':'已按時間排序','Day deleted':'已刪除當天','Stop deleted':'已刪除行程','Need at least 3 stops with map locations.':'需至少 3 個有地圖位置的行程'});
Object.assign(ZH,{'Bill currency':'賬單貨幣','Amount':'金額','Live rate':'即時匯率','Converted amount':'換算金額','Using FX rate':'使用匯率','Auto-detect language':'自動偵測語言','Scan receipt':'掃描收據'});

Object.assign(ZH,{'Streets':'街道圖','Simple map':'簡潔地圖','Search 小红书':'搜尋小紅書','Open in the 小红书 app':'在小紅書 App 打開','The keywords are copied. If the app opens its home page, paste them into its search box.':'關鍵字已複製。若 App 只打開首頁，請貼到搜尋框。','Search 小红书 notes without logging in':'不登入小紅書，改用搜尋引擎找筆記','Copy keywords':'複製關鍵字','Copied':'已複製','Could not copy':'無法複製','Simple':'簡易','Detailed':'詳細','manual':'手動','Paste a link':'貼上連結','Google Maps or Xiaohongshu link':'Google 地圖或小紅書連結','Paste a Google Maps share link or a 小红书 share (link with its text). Name, label and location are filled in for you.':'貼上 Google 地圖分享連結，或小紅書分享（連結連同文字）。名稱、分類及位置會自動填入。','Identifying…':'辨識中…','Could not identify a place. Check the link, or use the Detailed tab.':'無法辨識地點。請檢查連結，或使用「詳細」分頁。','Category':'分類'});

Object.assign(ZH,{'Find from photos':'用相片／標題找地點','Post title':'帖子標題','Hint: area, station or shop name':'提示：地區、車站或店名','Photos':'相片','Vision key':'Vision 金鑰','Reading photos…':'讀取相片中…','Searching map…':'搜尋地圖中…','High':'高','Medium':'中','Low':'低','matched':'吻合','area only':'僅地區吻合','Google Maps search':'Google 地圖搜尋','Google search':'Google 搜尋','Google Lens (upload a photo)':'Google Lens（上傳相片）','No candidates. Add a hint such as the area or shop name.':'找不到候選地點。請加入地區或店名等提示。','Google Cloud Vision API key (saved on this device only; leave empty to remove)':'Google Cloud Vision 金鑰（只儲存在此裝置；留空即移除）'});

Object.assign(ZH,{'Not sure what to look for? Pick a style':'不知道買什麼？選一個風格','Search in Japanese':'日文搜尋字','Typical brands':'常見品牌','Typical price':'一般價錢','Find nearby in Google Maps':'在 Google 地圖搜尋附近','Clear styles':'清除風格','Fashion styles':'時裝風格'});

Object.assign(ZH,{'Quick start: pick a vibe':'快速選擇：揀個風格','In Tokyo':'東京','Tokyo Airbnb · Sumida City':'東京 Airbnb・墨田區','Card day: Akihabara & Nakano':'卡牌日：秋葉原與中野','Harajuku & Shibuya fashion':'原宿與澀谷時裝','Machida Super Bazaar & Shimokitazawa':'町田 Super Bazaar 與下北澤','New Year’s Day · hatsumode':'元旦・初詣','Lucky bags & Ikebukuro':'福袋與池袋','Tokyo Station → Shin-Osaka':'東京站 → 新大阪',"New Year's Eve in Sumida":'墨田區跨年'});

Object.assign(ZH,{'For this day':'按當天','Near me':'我附近','Add days to the trip first.':'請先加入日子','Shops near you':'你附近的店','Location unknown':'未知地點',
  'Pick a week and slide to a day to change the shops.':'揀一週再拉到某一天，就會換成那天附近的店','Show all':'顯示全部','No saved shops here yet. Try “More nearby”.':'這裡未有收錄的店，試試「更多附近」',
  'This day has no map location yet. Add a place with a location, or set the day’s Area (e.g. Tokyo).':'這天未有地圖位置。加入有位置的地點，或在「編輯日子」填地區（例如 Tokyo）',
  'More nearby':'更多附近','OpenStreetMap':'OpenStreetMap 即時資料','No other shops found nearby.':'附近找不到其他店','Searching…':'搜尋中…','Search 小红书 for this area':'在小紅書搜尋這一區',
  'Import shop list':'匯入店舖清單','Locating…':'定位中…','Live shop search is busy. Try again in a minute.':'即時搜尋繁忙，請稍後再試','Not a shop list.':'不是店舖清單檔案',
  'Day in this week':'這週的哪一天','Week':'全週','all':'全部','Whole week':'整週',
  'Clothes':'服裝','Second-hand':'二手','Shoes':'鞋','Bags':'手袋','Jewellery':'首飾','Accessories':'配飾','Hats':'帽子','Department store':'百貨公司','Mall':'商場','Your plan already has every saved shop here. Try “More nearby”.':'已收錄的店都已在你的行程內，試試「更多附近」','Outside saved cities: tap “More nearby”':'不在已收錄城市：請按「更多附近」'});
Object.assign(ZH,{"Google Maps link": "Google 地圖連結", "Photo": "照片", "小红书 text": "小紅書文字", "Paste 小红书 note text": "貼上小紅書筆記文字", "Copy the note’s text in the 小红书 app and paste it here. Nothing is sent to 小红书.": "在小紅書 App 複製筆記文字後貼到這裡。不會向小紅書傳送任何資料。", "Paste a Google Maps share link (or its share text). Name, label and location are filled in for you.": "貼上 Google 地圖分享連結（或分享文字）。名稱、分類及位置會自動填入。", "Not sure what the place is? Send the photo to Google Lens, then type what it finds in the hint box below.": "不確定是哪裡？先把照片交給 Google Lens，再把結果填入下方提示欄。", "Open Google Lens": "打開 Google Lens", "Import shop list": "匯入店舖清單", "Paste note text or a JSON list": "貼上筆記文字或 JSON 清單", "Or add screenshots of the note": "或加入筆記截圖", "Area hint": "地區提示", "Find shops": "尋找店舖", "Choose a .json file": "選擇 .json 檔案", "Reading screenshot…": "正在讀取截圖…", "Paste text or add a screenshot first.": "請先貼上文字或加入截圖。", "No shops found. Lines like “📍 name｜note” and “地址：…” work best.": "找不到店舖。「📍 店名｜備註」及「地址：…」格式最適合。", "Locating…": "定位中…", "Add selected places": "加入所選地點", "No location yet": "未有位置"});

Object.assign(ZH,{
  'Not signed in':'未登入','Syncing…':'同步中…','Synced':'已同步','Offline: will sync later':'離線：稍後同步','Sync problem':'同步出錯',
  'Sync now':'立即同步','Sign out':'登出','Sign in with Google':'用 Google 登入','Sync trips between your phones':'在你的手機之間同步行程',
  'Signed out. Trips stay on this phone.':'已登出。行程仍保留在這部手機。',
  'Sign in to use AI features.':'請先登入才能使用 AI 功能。','Daily AI limit reached. Try tomorrow.':'今日 AI 用量已達上限，請明天再試。',
  'Ask AI about this trip':'向 AI 查詢這個行程','Your question':'你的問題','Ask':'提問','Thinking…':'思考中…',
  'e.g. Is day 3 too packed? What can I swap for rain?':'例如：第 3 天是否太趕？下雨可以換成什麼？',
  'Read with AI (Gemini): text and screenshots are sent to Google':'用 AI（Gemini）讀取：文字和截圖會傳送到 Google'
});

Object.assign(ZH,{
  'Route':'路線','Numbered route':'編號路線','Tap places on the map in order. 1 = start, the last one = end.':'按次序點選地圖上的地點。1 = 起點，最後一個 = 終點。','Open in Google Maps':'在 Google 地圖開啟','Pick one more place':'再選一個地點','Get directions':'取得路線','Travel mode':'交通方式','Drive':'駕車','Walk':'步行','Bike':'單車',
  'Google Maps allows up to 11 points: a start, 9 stops and an end.':'Google 地圖最多 11 個點：起點、9 個中途點和終點。','Dark map':'深色地圖',
  'Stop removed':'已移除行程','Tap a stop to edit · swipe right to remove':'點一下行程即可編輯 · 向右滑動即可移除',
  'AI itinerary':'AI 行程建議','Suggest stops':'建議行程','Your wishes (optional)':'你的願望（可選）','e.g. vintage shops, ramen, not too much walking':'例如：古著店、拉麵、不要走太多路','Pace':'節奏','Relaxed':'悠閒','Balanced':'均衡','Packed':'緊湊',
  'Open a week, then slide to a day.':'展開一週，再拉到某一天。','Gemini key':'Gemini 金鑰','Gemini API key from Google AI Studio (saved on this device only; leave empty to remove)':'Google AI Studio 的 Gemini API 金鑰（只儲存在此裝置；留空即移除）',
  'Sign in or save a Gemini key on this device to use AI.':'請先登入，或在此裝置儲存 Gemini 金鑰才能使用 AI。','Your trip summary and wishes are sent to Google Gemini. Check opening hours before you go.':'行程摘要和你的願望會傳送到 Google Gemini。出發前請確認營業時間。',
  'No suggestions came back. Try again or change the wishes.':'沒有收到建議，請重試或修改願望。','Also pin them on the map (looks up locations)':'同時在地圖加上圖釘（會查找位置）','Add':'加入','AI stops added':'已加入 AI 建議行程',
  'Could not reach Gemini. Check the connection.':'無法連線到 Gemini，請檢查網絡。','Gemini rejected the key. Check it and try again.':'Gemini 拒絕了金鑰，請檢查後重試。','Gemini is busy or its free limit is reached. Try again later.':'Gemini 繁忙或已達免費用量，請稍後再試。','The AI service returned an error.':'AI 服務出錯。'
});

Object.assign(ZH, {'Search saved places, or type a new one':'搜尋已儲存地點，或輸入新地點','Links this stop to a pin on the map. Leave empty for a plain stop.':'將此行程連結到地圖上的地點。留空則為一般行程。','no pin':'未設定位置','Change place':'更換地點','Clear place':'清除地點','No saved place matches.':'沒有符合的已儲存地點。','Add as a new place':'新增為新地點','Find on the map':'在地圖上搜尋','No pin yet. You can set it later.':'尚無位置，之後可再設定。','Searches OpenStreetMap and keeps the pin.':'搜尋 OpenStreetMap 並保留位置。','Suggested':'建議','This day':'本日','All places':'所有地點','Type to search the rest.':'輸入文字搜尋其餘地點。','No saved places yet. Type a name to add one.':'尚無已儲存地點，輸入名稱即可新增。','Searching…':'搜尋中…'});
Object.assign(ZH, {'Drag to reorder':'拖曳排序','Map place':'地圖地點',"This day's places":'本日地點','Other saved places':'其他已儲存地點','Links this stop to a pin on the map. Pick a saved place, or leave empty.':'將此行程連結到地圖上的地點。可選擇已儲存的地點，或留空。','Reorder: Days tab → Reorder, then drag the handle. Remove: swipe the stop to the right.':'排序：在「每日行程」按「排序」，再拖曳把手。移除：將行程向右滑動。'});
Object.assign(ZH, {'Light Map':'淺色地圖','Normal Map':'一般地圖','Map style':'地圖樣式','Focus city':'聚焦城市','All cities':'所有城市','Fit all':'顯示全部地點','Show my location':'顯示我的位置','Place description':'地點詳情','Filter by day':'按日期篩選','No visible pins. Clear the filters.':'沒有符合篩選條件的圖釘，請清除篩選後再試。','Route in Google Maps':'在 Google 地圖查看路線','No places match. Clear search or filters.':'找不到符合條件的地點，請清除搜尋或篩選。','Edit day':'編輯當日行程','Delete day':'刪除當日行程','Add stop':'新增一站','Directions':'路線指引','Shopping':'購物'});

Object.assign(ZH, {'Add a day first':'請先新增一天'});
