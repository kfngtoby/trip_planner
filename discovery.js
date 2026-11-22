/* Shared, local-first food and shopping discovery. */
const discoveryLabel = (en, zh) => language === 'zh' ? zh : en;
const discoveryTypes = {
 food:[['any','Any','不限'],['ramen','Ramen','拉麵'],['sushi','Sushi','壽司'],['dessert','Café & dessert','咖啡與甜品'],['local','Local specialties','地道美食'],['italian','Italian','意大利菜']],
 shop:[['any','Any','不限'],['clothes','Fashion','服飾'],['tcg','TCG cards','集換式卡牌'],['budget','Budget stores','平價商店'],['beauty','Beauty & drugstores','美妝藥妝'],['hobby','Hobby & collectibles','興趣與收藏']]
};
const discTerms={ramen:'ramen|ラーメン|拉麵|拉面|中華そば',sushi:'sushi|寿司|鮨|壽司',dessert:'dessert|cafe|café|coffee|スイーツ|喫茶|カフェ|甜品',local:'おでん|郷土料理|姫路グルメ',italian:'italian|pizza|pasta|イタリアン|ピザ|意大利',clothes:'clothes|fashion|boutique|古着|服飾|衣料|streetwear',tcg:'trading.cards|card.shop|トレカ|カードショップ|ポケカ|卡牌|pokemon',budget:'100円|100.yen|daiso|ダイソー|セリア|cando|discount|budget store|ディスカウント|secondhand|中古|平價',beauty:'cosmetics|chemist|drugstore|pharmacy|薬局|ドラッグ|美妝',hobby:'hobby|collectibles|toys|ホビー|中古玩具'};
const discRef = {tcg:[['ポケカ シングル','Pokémon singles'],['ポケカ','Pokémon'],['ワンピースカード','One Piece'],['遊戯王','Yu-Gi-Oh!'],['MTG','MTG'],['シングル','Singles'],['未開封','Sealed']],clothes:[['古着','Vintage / second-hand'],['ストリート','Streetwear'],['ベーシック','Basics']],budget:[['100円','100-yen'],['discount','Discount'],['中古','Second-hand']]};
const discJP={any:'',ramen:'ラーメン',sushi:'寿司',dessert:'カフェ スイーツ',local:'郷土料理',italian:'イタリアン',clothes:'古着 ファッション',tcg:'トレカ カードショップ',budget:'100円ショップ',beauty:'ドラッグストア',hobby:'ホビーショップ'};
const discNorm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const discId=p=>p.osmId || p.id || discNorm(p.name)+'@'+(hasCoords(p)?`${p.lat.toFixed(4)},${p.lon.toFixed(4)}`:discNorm(p.city));
const discSame=(a,b)=>{
 if (discId(a)===discId(b)) return true;
 const names=p=>[p.name,p.jp].map(discNorm).filter(Boolean);
 return names(a).some(n=>names(b).includes(n)) && (hasCoords(a)&&hasCoords(b)?kmBetween(a,b)<.12:discArea(a.city)===discArea(b.city));
};
const discMatch=(p,type,ref='')=>{
 const text=[p.name,p.jp,p.tags,p.note,...(p.subs||[])].join(' ');
 if(type!=='any' && p.type!==type && !new RegExp(discTerms[type]||'(?!)','i').test(text)) return false;
 const aliases={'ポケカ シングル':'(?=.*(?:ポケカ|ポケモン|pok[eé]mon|寶可夢))(?=.*(?:シングル|singles))','ポケカ':'ポケカ|ポケモン|pok[eé]mon|寶可夢','ワンピースカード':'one piece|ワンピース','遊戯王':'遊戯王|yu.gi.oh','シングル':'シングル|singles','未開封':'未開封|sealed','古着':'古着|vintage|thrift|furugi|secondhand','中古':'中古|second.hand|thrift|furugi','discount':'discount|ディスカウント','100円':'100円|100.yen|daiso|ダイソー|セリア','ストリート':'streetwear|ストリート','ベーシック':'basics|ベーシック'};
 return !ref || new RegExp(aliases[ref]||ref,'i').test(text);
};
function discoveryButtons(d){return `<div class="discover-buttons"><button type="button" data-discovery="food" data-day="${esc(d.id)}">${discoveryLabel('Find food','找美食')}</button><button type="button" data-discovery="shop" data-day="${esc(d.id)}">${discoveryLabel('Find shopping','找店舖')}</button></div>`;}
const discBtn=(act,text)=>`<button type="button" data-disc="${act}">${esc(text)}</button>`;
const discOptions=(rows,value)=>rows.map(([id,en,zh])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(zh?discoveryLabel(en,zh):en)}</option>`).join('');
const discStarter=['Himeji Mentetsu','Shinsei Ken','Himeji Tanmen','Men Dokoro Nakayama','Menya 636 Himeji Ten','Ramen Maruju'].map((name,i)=>({id:'himeji-ramen-'+i,name,city:'Himeji',type:'ramen',source:'Himeji starter catalog',link:i===4?'https://tabelog.com/en/hyogo/A2805/A280501/28026033/':i===5?'https://tabelog.com/en/hyogo/A2805/A280501/28031866/':'https://tabelog.com/en/hyogo/A2805/A280501/rstLst/MC/'}));
const discArea=s=>discNorm(s).replaceAll('姫路','himeji').replaceAll('姬路','himeji');
const discImports=()=>{try{return JSON.parse(localStorage.getItem('trip-discovery-v1'))||[]}catch{return []}};
const discLink=(url,text)=>`<a class="btn" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;
/* Overpass search: filter by type on the server (so busy areas don't hit the result cap before the type filter runs),
   fall back to a second public server, and keep recent results so repeat searches are instant and work with no signal. */
const OVERPASS_URLS=['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
const discOsmSpec={
 ramen:{re:'ramen|ラーメン|らーめん|拉麵|拉面|中華そば|つけ麺|らぁ麺',tags:['[amenity~"^(restaurant|fast_food)$"][cuisine~"ramen|noodle",i]']},
 sushi:{re:'sushi|寿司|鮨|すし|壽司',tags:['[cuisine~"sushi|sashimi",i]']},
 dessert:{re:'dessert|cafe|café|coffee|スイーツ|喫茶|カフェ|甜品',tags:['[amenity~"^(cafe|ice_cream)$"]','[shop~"^(pastry|confectionery|bakery|chocolate)$"]']},
 italian:{re:'italian|pizza|pasta|イタリアン|ピザ|パスタ|意大利',tags:['[cuisine~"italian|pizza|pasta",i]']},
 clothes:{re:'clothes|fashion|boutique|古着|服飾|衣料|streetwear',tags:['[shop~"^(clothes|fashion|boutique|second_hand|fashion_accessories)$"]']},
 tcg:{re:'trading.cards|card.shop|トレカ|カードショップ|ポケカ|卡牌|pokemon|ポケモン|遊戯王|TCG',tags:['[shop~"^(trading_cards|collector|games|toys|hobby|anime)$"]']},
 budget:{re:'100円|100.yen|daiso|ダイソー|セリア|cando|キャンドゥ|discount|ディスカウント|ドン・キホーテ|donki|中古',tags:['[shop~"^(variety_store|discount|second_hand|department_store)$"]']},
 beauty:{re:'cosmetics|chemist|drugstore|pharmacy|薬局|ドラッグ|美妝',tags:['[shop~"^(chemist|cosmetics|beauty|perfumery)$"]']},
 hobby:{re:'hobby|collectibles|toys|ホビー|中古玩具',tags:['[shop~"^(hobby|toys|collector|games|anime|model)$"]']}
};
function discOverpassQuery(food,type,km,p){
 const base=food?'[amenity~"^(restaurant|cafe|fast_food|ice_cream)$"]':'[shop]', around=`(around:${km*1000},${p.lat},${p.lon})`, spec=discOsmSpec[type];
 const sel=spec?[...spec.tags,...['name','name:ja','name:en'].map(k=>`${base}["${k}"~"${spec.re}",i]`)]
  :[food?base:'[shop~"^(clothes|fashion|boutique|second_hand|variety_store|discount|chemist|cosmetics|games|toys|hobby|trading_cards|collector|department_store)$"]'];
 return `[out:json][timeout:10];(${sel.map(x=>`nwr${x}${around};`).join('')});out center 400;`;
}
async function discOverpassFetch(q,signal){
 let last;
 for(const u of OVERPASS_URLS){
  try{
   const r=await fetch(u,{method:'POST',body:new URLSearchParams({data:q}),signal});if(!r.ok)throw Error('overpass '+r.status);
   const j=await r.json();if(j.remark&&!(j.elements||[]).length)throw Error('overpass remark');return j;
  }catch(e){if(signal.aborted)throw e;last=e;}
 }
 throw last;
}
const discOsmRows=j=>(j.elements||[]).flatMap(e=>{const t=e.tags||{},name=t['name:en']||t.name||t['name:ja'],lat=e.lat??e.center?.lat,lon=e.lon??e.center?.lon;if(!name||!Number.isFinite(lat)||!Number.isFinite(lon))return [];return [{osmId:`osm:${e.type}:${e.id}`,name,jp:t['name:ja']||t.name,lat,lon,source:'OpenStreetMap',tags:[t.shop,t.shop==='variety_store'?'budget store':'',t.amenity,t.cuisine,t.description,t['name:ja'],t.second_hand].join(' ').replaceAll('_',' ')}];});
const DISC_CACHE='trip-osm-v1', DISC_TTL=864e5, DISC_MAX=10;
const discCacheKey=(mode,type,km,p)=>[mode,type,km,p.lat.toFixed(3),p.lon.toFixed(3)].join('|');
const discCacheAll=()=>{try{return JSON.parse(localStorage.getItem(DISC_CACHE))||{}}catch{return {}}};
const discCacheGet=k=>discCacheAll()[k]||null;
function discCachePut(k,rows){
 const c=discCacheAll();c[k]={t:Date.now(),rows};
 Object.keys(c).sort((a,b)=>c[b].t-c[a].t).slice(DISC_MAX).forEach(x=>delete c[x]);
 try{localStorage.setItem(DISC_CACHE,JSON.stringify(c));}catch{try{localStorage.setItem(DISC_CACHE,JSON.stringify({[k]:c[k]}));}catch{}}
}
function discover(tr, dayId, mode){
 const d=tr.days.find(x=>x.id===dayId);if(!d)return;
 const z=discoveryLabel, food=mode==='food', title=food?z('Find food','找美食'):z('Find shopping','找店舖');
 const anchorSpots=daySpots(tr,d).filter(hasCoords), first=anchorSpots[0];
 let area=first?.city||((d.place||'').match(/(?:→|➜)\s*(.+)$/)?.[1])||d.place||'', point=first||null, anchor=first?.name||area, type='', ref='', radius=2, sort='match', rating='prefer', budget='', pool=[], batch=[], seen=[], seq=0, status='', controller=null;
 const sheet=$('#sheet'), body=$('#sheet-body');
 const local=()=>[...discImports().filter(p=>p.mode===mode&&!p.bookmark),...tr.spots.filter(p=>food?p.cat==='food':['fashion','pokemon','shopping'].includes(p.cat)).map(p=>({...p,source:z('Trip','行程'),type:p.cat==='pokemon'?'tcg':p.cat==='fashion'?'clothes':p.type})),...(!food?allCatalog().map(p=>({...p,source:p.source||z('Fashion catalog','服飾目錄'),type:'clothes'})):discStarter)];
 function ranked(){
  const source=[...pool];const unique=[];
  for(const p of source){if(!discMatch(p,type||'any',ref))continue;const km=point&&hasCoords(p)?kmBetween(point,p):null;
   if(km!==null&&km>radius)continue;
   if(km===null&&(anchor===z('Near me','我的位置')||!area||!p.city||!discArea(area).includes(discArea(p.city))))continue;
   if(food&&rating!=='prefer'&&rating!==''&&!(Number(p.score)>=Number(rating)))continue;
   if(food&&budget&&p.budget!==budget)continue;
   const row={...p,km}; if(!unique.some(q=>discSame(row,q)))unique.push(row);
  }
  const bonus=p=>(food&&rating==='prefer'&&p.score>=3.5?2:0)+(p.type===type?1:0);
  return unique.sort((a,b)=>(sort==='match'?bonus(b)-bonus(a):0)||(a.km??Infinity)-(b.km??Infinity));
 }
 function next(reset=false){if(reset)seen=[];batch=ranked().filter(p=>!seen.some(q=>discSame(p,q))).slice(0,5);seen.push(...batch);}
 const web=(q)=>'https://www.google.com/search?q='+encodeURIComponent(q);
 function render(){
  const query=`${area||anchor} ${discJP[type]||''} ${ref}`.trim();
  body.innerHTML=`<div class="discover"><label>${z('Search area or query','地區或搜尋詞')}<input id="disc-area" value="${esc(area)}" placeholder="Himeji ramen / 姫路駅"></label>
   <div class="disc-row">${discBtn('gps',z('Near me / refresh','我的位置／重新定位'))}${discBtn('find',z('Search','搜尋'))}${discBtn('widen',z('Widen area','擴大範圍'))}</div>
   ${anchorSpots.length?`<label>${z('Itinerary stop','行程地點')}<select id="disc-stop"><option value="">—</option>${discOptions(anchorSpots.map(s=>[s.id,s.name]),point?.id)}</select></label>`:''}
   <div>${esc(anchor)} · ${radius} km</div>
   <label>${z('Type','類型')}<select id="disc-type"><option value="">${z('Choose type','選擇類型')}</option>${discOptions(discoveryTypes[mode],type)}</select></label>
   ${discRef[type]?`<label>${z('Refine','細分')}<select id="disc-ref"><option value="">${z('Any','不限')}</option>${discOptions(discRef[type],ref)}</select></label>`:''}
   <label>${z('Sort','排序')}<select id="disc-sort">${discOptions([['match','Best match','最相關'],['near','Nearest','最近']],sort)}</select></label>
   ${food?`<label>${z('Tabelog rating','食べログ評分')}<select id="disc-rating">${discOptions([['prefer','Prefer 3.5+','優先 3.5+'],['','Any','不限'],...['3.0','3.5','3.8','4.0','4.2'].map(x=>[x,'Only '+x+'+','只顯示 '+x+'+'])],rating)}</select></label>
   <label>${z('Budget per person','每人預算')}<select id="disc-budget">${discOptions([['','Any / unknown','不限／未知'],['low','Low: under ¥1,500','低：少於 ¥1,500'],['mid','Mid: ¥1,500–2,999','中：¥1,500–2,999'],['high','High: ¥3,000+','高：¥3,000 或以上']],budget)}</select></label>`:''}
   <div class="disc-row">${food?discLink(web('site:tabelog.com '+query),z('Check Tabelog','查閱食べログ')):discLink(web(query),z('Search web','網頁搜尋'))} ${discBtn('xhs',z('Search 小紅書','搜尋小紅書'))} ${discBtn('copy',z('Copy search','複製搜尋詞'))} ${discBtn('import',z('Import a place','匯入地點'))}</div>
   <p role="status">${esc(status)}</p>${discImports().some(p=>p.mode===mode&&p.bookmark)?`<details><summary>${z('Saved source links','已儲存來源連結')}</summary>${discImports().filter(p=>p.mode===mode&&p.bookmark).map(p=>discLink(p.link,p.link)).join('')}</details>`:''}
   ${batch.map((p,i)=>`<article><strong>${esc(p.name)}</strong>${p.jp&&p.jp!==p.name?`<small>${esc(p.jp)}</small>`:''}<small>${esc(p.source||'')} ${p.km!=null?' · '+p.km.toFixed(1)+' km '+z('straight-line','直線'):''}${p.score?' · Tabelog '+Number(p.score).toFixed(1)+' ('+z('user-entered','用戶輸入')+')':''}</small><div class="disc-row">${discBtn('pick:'+i,z('Add to day','加入行程'))} ${discLink(gmapsDirectionsUrl(p),z('Maps','地圖'))} ${p.link?discLink(p.link,z('Source','來源')):food?discLink(web('site:tabelog.com '+(p.jp||p.name)+' '+area),'Tabelog'):''}</div></article>`).join('')}
   ${discBtn('more',z('Not interested · Another batch','不感興趣・下一批'))}</div>`;
 }
 async function search(resolve=false){
  if(!type){status=z('Choose a type to begin.','請先選擇類型。');render();return;}
  controller?.abort();controller=new AbortController();const signal=controller.signal,n=++seq;
  pool=local();next(true);status=z('Looking for nearby places…','搜尋附近地點…');render();
  const valid=()=>n===seq&&sheet.open&&sheetHandlers===handlers;
  const activeController=controller;const timer=setTimeout(()=>activeController.abort(),22000);
  try{
   if(resolve||!point){if(!area)throw Error('missing');const r=await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=jp&q='+encodeURIComponent(area),{signal});if(!r.ok)throw Error('lookup');const [hit]=await r.json();if(!hit){if(valid()){status=z('Area not found. Try a station or district name.','找不到地區，請試用車站或地區名稱。');render();}return;}if(!valid())return;point={lat:Number(hit.lat),lon:Number(hit.lon)};anchor=hit.name||area;}
   const key=discCacheKey(mode,type,radius,point),hit=discCacheGet(key);let rows,stale=false;
   if(hit&&Date.now()-hit.t<DISC_TTL)rows=hit.rows;
   else{
    try{const j=await discOverpassFetch(discOverpassQuery(food,type,radius,point),signal);if(!valid())return;rows=discOsmRows(j);if(rows.length||!hit)discCachePut(key,rows);}
    catch(err){if(!hit||!valid())throw err;rows=hit.rows;stale=true;}
   }
   rows=rows.map(r=>({...r,city:area}));
   pool=[...local(),...rows];next(true);status=batch.length?(stale?z('Offline or busy: showing results saved earlier + saved places','離線或伺服器忙碌：顯示較早儲存的結果＋已儲存地點'):z('OpenStreetMap + saved places','OpenStreetMap ＋ 已儲存地點')):z('No matches. Try a wider area or import a place.','沒有結果，可擴大範圍或匯入地點。');render();
  }catch(e){if(!valid())return;status=!area&&!point?z('Enter an area or use Near me.','請輸入地區或使用我的位置。'):z('Live search unavailable. Showing local matches only.','即時搜尋暫不可用，只顯示本機結果。');render();}finally{clearTimeout(timer);}
 }
 const handlers={title,body:'',submit:null,onOpen:()=>{render();body.onchange=e=>{
   const v=e.target.value;switch(e.target.id){case 'disc-stop':{const s=anchorSpots.find(p=>p.id===v);if(!s)return;point=s;anchor=s.name;area=s.city||d.place||'';search();return;}case 'disc-type':type=v;ref='';if(!pool.length||status===z('Looking for nearby places…','搜尋附近地點…')){search();return;}break;case 'disc-ref':ref=v;break;case 'disc-sort':sort=v;break;case 'disc-rating':rating=v;break;case 'disc-budget':budget=v;break;default:return;}
   next(true);status=batch.length?'':z('No matches for these filters.','沒有符合篩選條件的地點。');render();
  };body.onclick=e=>{const b=e.target.closest('[data-disc]');if(!b)return;const action=b.dataset.disc;
   if(action==='find'){const q=body.querySelector('#disc-area').value.trim();const found=discoveryTypes[mode].slice(1).find(([id])=>new RegExp(discTerms[id],'i').test(q));const clean=found?q.replace(new RegExp(discTerms[found[0]],'ig'),'').trim():q.replace(/\b(food|shopping)\b/ig,'').trim();if(found)type=found[0];const changed=clean!==area;if(changed){area=clean;point=null;anchor=area;}search(changed);}
   if(action==='widen'){radius=Math.min(12,radius+2);search();}
   if(action==='more'){next();status=batch.length?'':z('No unseen matches. Widen the area or import a place.','沒有新結果，可擴大範圍或匯入地點。');render();}
   if(action==='gps'){if(!navigator.geolocation){status=z('Location unavailable. Enter a station instead.','無法定位，請輸入車站。');render();return;}const n=++seq;controller?.abort();status=z('Getting your location…','正在定位…');render();navigator.geolocation.getCurrentPosition(p=>{if(n!==seq||!sheet.open||sheetHandlers!==handlers)return;point={lat:p.coords.latitude,lon:p.coords.longitude};anchor=z('Near me','我的位置');area=cityOfPoint(point.lat,point.lon)||'';search();},err=>{if(n!==seq||!sheet.open||sheetHandlers!==handlers)return;status=({1:z('Location denied. Choose a station or stop.','定位權限遭拒，請選擇車站或行程地點。'),3:z('Location timed out. Try again or choose a station.','定位逾時，請重試或選擇車站。')})[err.code]||z('Location unavailable. Choose a station.','無法定位，請選擇車站。');render();},{timeout:10000,maximumAge:0});}
   if(action==='xhs'||action==='xhsapp'){const kw=`${area||anchor} ${discJP[type]||''} ${ref}`.trim();
    if(action==='xhsapp'){try{navigator.clipboard?.writeText(kw);}catch{}location.href='xhsdiscover://search/result?keyword='+encodeURIComponent(kw);return;}
    const row=b.closest('.disc-row'),old=row.nextElementSibling;if(old?.dataset.xhsRow){old.remove();return;}
    const mobile=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent),W=typeof xhsWeb!=='undefined'?xhsWeb:{google:k=>web('site:xiaohongshu.com '+k)};
    row.insertAdjacentHTML('afterend',`<div class="disc-row" data-xhs-row="1">${mobile?discBtn('xhsapp',z('Open in 小紅書 app','在小紅書 App 打開')):''}${Object.entries({bing:'Bing',google:'Google',baidu:'百度'}).filter(([k])=>W[k]).map(([k,n])=>discLink(W[k](kw),n)).join('')}</div>`);}if(action==='copy'){const q=`${area||anchor} ${discJP[type]||''} ${ref}`.trim();navigator.clipboard?.writeText(q).then(()=>toast(z('Query copied','已複製搜尋詞'))).catch(()=>toast(q));}
   if(action==='import'){controller?.abort();discImport(tr,dayId,mode,area,type);}
   if(action.startsWith('pick:')){const p=batch[Number(action.split(':')[1])];if(p){controller?.abort();discPick(tr,dayId,mode,{...p,type:p.type||(type==='any'?'':type)});}}
  };}};
 openSheet(handlers);
}
function discPick(tr,dayId,mode,p){
 const z=discoveryLabel;
 openSheet({title:p.name,submit:z('Add to day','加入行程'),body:`<div class="discover"><label>${z('Itinerary day','行程日期')}<select name="day">${discOptions(tr.days.map((d,i)=>[d.id,`Day ${i+1} · ${d.date} · ${d.place||d.title||''}`]),dayId)}</select></label><small>${esc(p.city||'')} ${z('Check that the place fits the selected day.','請確認地點適合所選日期。')}</small></div>`,onSubmit:f=>{
  const d=tr.days.find(x=>x.id===f.get('day'));if(!d)return false;
  let existing=tr.spots.find(q=>discSame(p,q));if(existing&&d.items.some(it=>it.spotId===existing.id))return sheetError(z('Already on this day.','已在當天行程中。'));
  const snap=snapshot(tr);let s=existing;
  if(!s){s={id:uid('p'),osmId:p.osmId||'',name:p.name,jp:p.jp||'',city:p.city||'',cat:mode==='food'?'food':(p.type==='tcg'||discMatch(p,'tcg'))?'pokemon':(p.type==='clothes'||discMatch(p,'clothes'))?'fashion':'shopping',lat:hasCoords(p)?p.lat:null,lon:hasCoords(p)?p.lon:null,note:p.note||'',hours:'',link:p.link||'',gmaps:'',days:[],score:p.score||null,budget:p.budget||'',type:p.type||'',source:p.source||''};tr.spots.push(s);}
  if(!s.days.includes(d.id))s.days.push(d.id);
  d.items.push({id:uid('i'),title:p.name,spotId:s.id,time:'',tz:'',note:''});
  openSet().add(d.id);saveDb();closeSheet();renderDaysTab();undoToast(z('Place added','已加入地點'),snap);
 }});
}
function discImport(tr,dayId,mode,area,type){
 const z=discoveryLabel,title=z('Import a place','匯入地點');
 const h={title,submit:z('Review and save','確認並儲存'),body:`<div class="discover"><label>${z('Name','名稱')}<input name="name" maxlength="120"></label><label>${z('City','城市')}<input name="city" value="${esc(area)}" maxlength="100"></label><label>${z('Source link (optional)','來源連結（選填）')}<input name="link" type="url"></label><label>${z('Paste notes or keywords','貼上筆記或關鍵詞')}<textarea name="note" maxlength="800"></textarea></label><label>${z('Read a screenshot (optional)','讀取截圖（選填）')}<input id="disc-shot" type="file" accept="image/*"></label><p id="disc-ocr" role="status"></p>${mode==='food'?`<label>${z('Tabelog score you checked','自行查閱的食べログ評分')}<input name="score" type="number" min="0" max="5" step="0.1"></label><label>${z('Budget','預算')}<select name="budget">${discOptions([['','Unknown','未知'],['low','Under ¥1,500'],['mid','¥1,500–2,999'],['high','¥3,000+']],'')}</select></label>`:''}</div>`,onOpen:body=>{body.querySelector('#disc-shot').onchange=async e=>{const file=e.target.files[0],p=body.querySelector('#disc-ocr');if(!file)return;p.textContent=z('Reading screenshot…','讀取截圖…');try{const T=await lcLoadT();const result=await T.recognize(await lcShrink(file,1500),'chi_tra+jpn+eng');body.querySelector('[name=note]').value=result.data.text.slice(0,800);p.textContent=z('Check the extracted text and enter the shop name.','請檢查文字並輸入店名。');}catch{p.textContent=z('Could not read screenshot. Enter details manually.','無法讀取截圖，請手動輸入。');}};},onSubmit:f=>{
  const name=f.get('name').trim(),city=f.get('city').trim(),raw=f.get('link').trim();if(!name&&!raw)return sheetError(z('Enter a name or source link.','請輸入名稱或來源連結。'));
  let link='';if(raw){try{const u=new URL(raw);if(!['https:','http:'].includes(u.protocol))throw Error();link=u.href;}catch{return sheetError(z('Enter a valid web link.','請輸入有效網址。'));}}
  const score=f.get('score');if(score&&!(Number(score)>0&&Number(score)<=5))return sheetError(z('Use a score above 0 and at most 5.','分數須大於 0，最高為 5。'));
  const p={id:uid('disc'),name:name||link,bookmark:!name,city,link,mode,type:type||'any',note:f.get('note').trim(),score:score?Number(score):null,budget:f.get('budget')||'',source:z('User import','用戶匯入')};
  const prev=discImports().filter(x=>!discSame(x,p));try{localStorage.setItem('trip-discovery-v1',JSON.stringify([p,...prev]));}catch{return sheetError(z('Could not save to this device.','無法儲存到本機。'));}closeSheet();if(name)discPick(tr,dayId,mode,p);else discover(tr,dayId,mode);
 }};openSheet(h);
}
