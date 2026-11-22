'use strict';
/* Receipt scan: photo -> on-device OCR (Tesseract.js) -> detects the receipt's LANGUAGE and CURRENCY -> suggested total.
   The photo never leaves the phone. OCR engine + language data download once from a CDN, then are cached.
   Detection: script/keyword analysis of the OCR text (kana -> Japanese, hangul -> Korean, Han -> Chinese, Thai, Cyrillic, Arabic,
   plus keywords for French/German/Spanish/Italian/Portuguese/Dutch/Indonesian/Vietnamese/Turkish). Currency comes from symbols / ISO codes /
   words on the receipt, falling back to the language's usual currency. The person can always override both.
   v18: 31 languages (adds Hindi, Hebrew, Greek, Polish, Czech, Swedish, Danish, Finnish, Hungarian, Malay, Ukrainian, Khmer, Bengali, Persian),
   re-reads Latin-script receipts with the right language data, understands local digits (٣٤٥ ๓๔๕ ३४५ ０１２), tries other scripts when nothing
   was found, and can queue several photos: each becomes its own expense, one after another. */

const RC_LIB = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const RC_LANGS = 'https://tessdata.projectnaptha.com/4.0.0_fast';
let rcLib;

// code -> [label, tesseract data, usual currency]
const RC_LANG = {
  en: ['English', 'eng', null], ja: ['日本語', 'jpn', 'JPY'], 'zh-Hant': ['中文（繁）', 'chi_tra', null], 'zh-Hans': ['中文（简）', 'chi_sim', 'CNY'],
  ko: ['한국어', 'kor', 'KRW'], th: ['ไทย', 'tha', 'THB'], vi: ['Tiếng Việt', 'vie', 'VND'], ru: ['Русский', 'rus', null], ar: ['العربية', 'ara', 'AED'],
  fr: ['Français', 'fra', 'EUR'], de: ['Deutsch', 'deu', 'EUR'], es: ['Español', 'spa', 'EUR'], it: ['Italiano', 'ita', 'EUR'],
  pt: ['Português', 'por', 'EUR'], nl: ['Nederlands', 'nld', 'EUR'], id: ['Bahasa Indonesia', 'ind', 'IDR'], tr: ['Türkçe', 'tur', 'TRY'],
  ms: ['Bahasa Melayu', 'msa', 'MYR'], pl: ['Polski', 'pol', 'PLN'], cs: ['Čeština', 'ces', 'CZK'], sv: ['Svenska', 'swe', 'SEK'],
  da: ['Dansk', 'dan', 'DKK'], fi: ['Suomi', 'fin', 'EUR'], hu: ['Magyar', 'hun', 'HUF'], el: ['Ελληνικά', 'ell', 'EUR'],
  uk: ['Українська', 'ukr', 'UAH'], he: ['עברית', 'heb', 'ILS'], fa: ['فارسی', 'fas', null], hi: ['हिन्दी', 'hin', 'INR'],
  bn: ['বাংলা', 'ben', 'BDT'], km: ['ភាសាខ្មែរ', 'khm', 'KHR']
};
const RC_FIRST = ['en', 'ja', 'zh-Hant', 'ko'];                       // data already loaded in the first (Auto) pass
const RC_SCRIPTS = 'eng+tha+rus+ara+hin+heb+ell';                    // last-resort pass when Auto found nothing
const RC_MAX_BATCH = 20;
const RC_AUTO = 'eng+jpn+chi_tra+kor';   // first pass when language is "Auto": covers English, Japanese, Chinese (trad.), Korean

function receiptScanHtml() {
  return `<div class="scan-box">
    <div class="scan-row">
      <label class="btn scan-btn">📷 <span>Scan receipt(s)</span><input id="rc-file" type="file" accept="image/*" multiple></label>
      <select id="rc-lang" aria-label="Receipt language"><option value="auto">Auto-detect language</option>${Object.entries(RC_LANG).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select>
    </div>
    <div id="rc-bar"><i></i></div>
    <p id="rc-status" class="muted" role="status"></p>
    <div id="rc-chips" class="rc-chips"></div>
  </div>`;
}

function rcLoad() {
  return rcLib ||= new Promise((res, rej) => {
    if (window.Tesseract) return res(window.Tesseract);
    const s = document.createElement('script');
    s.src = RC_LIB; s.onload = () => res(window.Tesseract);
    s.onerror = () => { rcLib = null; rej(new Error('offline')); };
    document.head.appendChild(s);
  });
}

// Downscale, greyscale and boost contrast: faster OCR and better digits on thermal paper.
async function rcPrepare(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bmp = await createImageBitmap(file); }
  const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, c.width, c.height);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.max(0, Math.min(255, (y - 128) * 1.5 + 128 + 10));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
  return c;
}

/* ---------- digits ---------- */
// Local digit systems -> ASCII, so amounts on Arabic / Persian / Thai / Hindi / Bengali / Khmer / full-width receipts can be parsed.
const RC_DIGIT_BASES = [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0e50, 0x17e0, 0xff10];
function rcDigits(text) {
  return text
    .replace(/[\u0660-\u0669\u06f0-\u06f9\u0966-\u096f\u09e6-\u09ef\u0e50-\u0e59\u17e0-\u17e9\uff10-\uff19]/g, ch => {
      const c = ch.charCodeAt(0), b = RC_DIGIT_BASES.find(x => c >= x && c < x + 10);
      return String(c - b);
    })
    .replace(/\u066b/g, '.').replace(/\u066c/g, ',');                 // Arabic decimal / thousands separators
}

/* ---------- language ---------- */
function rcLanguage(text) {
  const n = re => (text.match(re) || []).length;
  const kana = n(/[\u3040-\u30ff]/g), hangul = n(/[\uac00-\ud7af]/g), han = n(/[\u4e00-\u9fff]/g), thai = n(/[\u0e00-\u0e7f]/g),
        cyr = n(/[\u0400-\u04ff]/g), arab = n(/[\u0600-\u06ff]/g), heb = n(/[\u0590-\u05ff]/g), greek = n(/[\u0370-\u03ff]/g),
        deva = n(/[\u0900-\u097f]/g), beng = n(/[\u0980-\u09ff]/g), khmer = n(/[\u1780-\u17ff]/g);
  if (kana >= 3) return 'ja';
  if (hangul >= 3) return 'ko';
  if (thai >= 3) return 'th';
  if (deva >= 4) return 'hi';
  if (beng >= 4) return 'bn';
  if (khmer >= 4) return 'km';
  if (heb >= 4) return 'he';
  if (greek >= 4) return 'el';
  if (cyr >= 4) return n(/[іїєґІЇЄҐ]/g) ? 'uk' : 'ru';
  if (arab >= 4) return n(/[پچگژ]/g) ? 'fa' : 'ar';
  if (han >= 3) {
    const simp = n(/[发这个后门买单税额总计钱现银应实说时对会]/g), trad = n(/[發這個後門買單稅額總計錢現銀應實說時對會]/g);
    return simp > trad ? 'zh-Hans' : 'zh-Hant';
  }
  const low = text.toLowerCase();
  const kw = {
    vi: /[ăơưđ]|tổng|thanh toán|hóa đơn|cảm ơn|tiền/g,
    fr: /\b(tva|merci|sous-total|à payer|espèces|montant|carte bancaire)\b|[çœ]/g,
    de: /\b(mwst|summe|gesamt|zwischensumme|rückgeld|vielen dank|bar|betrag)\b|ß/g,
    es: /\b(iva|gracias|importe|efectivo|propina|cambio)\b|[ñ¿¡]/g,
    it: /\b(iva|totale|grazie|contanti|scontrino|resto|coperto)\b/g,
    pt: /\b(obrigado|troco|valor|dinheiro|imposto)\b|[ãõ]/g,
    nl: /\b(totaal|btw|bedankt|contant|subtotaal)\b/g,
    id: /\b(jumlah|terima kasih|pajak|tunai|kembali|harga|struk)\b/g,
    tr: /\b(toplam|teşekkürler|kdv|nakit|fiş)\b|[ğış]/g,
    pl: /\b(razem|suma|paragon|dziękujemy|gotówka|reszta|ptu)\b|[ąęłśźż]/g,
    cs: /\b(celkem|dph|děkujeme|hotovost|účtenka|k úhradě)\b|[ěřů]/g,
    sv: /\b(summa|totalt|moms|tack|kontant|kvitto|växel)\b/g,
    da: /\b(i alt|kvittering|byttepenge|mange tak)\b|[æø]/g,
    fi: /\b(yhteensä|alv|kiitos|käteinen|kuitti|vaihtoraha)\b/g,
    hu: /\b(összesen|áfa|köszönjük|készpénz|nyugta|fizetendő)\b|[őű]/g,
    ms: /\b(jumlah|terima kasih|tunai|baki|cukai|resit)\b/g
  };
  let best = 'en', top = 1;
  for (const [k, r] of Object.entries(kw)) { const cc = (low.match(r) || []).length; if (cc > top) { top = cc; best = k; } }
  return best;
}

/* ---------- currency ---------- */
// Order matters: specific markers before generic ones.
const RC_CUR = [
  ['HKD', /HK\s?\$|\bHKD\b|港幣|港币/gi], ['TWD', /NT\s?\$|\bNTD\b|\bTWD\b|新台幣|新臺幣/gi], ['SGD', /\bS\s?\$|\bSGD\b/g],
  ['AUD', /\bA\s?\$|\bAU\s?\$|\bAUD\b/g], ['CAD', /\bC\s?\$|\bCA\s?\$|\bCAD\b/g], ['NZD', /\bNZ\s?\$|\bNZD\b/g], ['USD', /\bUS\s?\$|\bUSD\b/g],
  ['EUR', /€|\bEUR\b|\beuros?\b/gi], ['GBP', /£|\bGBP\b/g], ['CHF', /\bCHF\b/g], ['KRW', /₩|\bKRW\b|원/g], ['THB', /฿|\bTHB\b|บาท|\bbaht\b/gi],
  ['MYR', /\bRM\s?\d|\bMYR\b/g], ['IDR', /\bRp\.?\s?\d|\bIDR\b/g], ['VND', /₫|\bVND\b|VNĐ|đồng/gi], ['INR', /₹|\bINR\b|\bRs\.?\s?\d|रु/g],
  ['PHP', /₱|\bPHP\b/g], ['JPY', /円|\bJPY\b|\byen\b/gi], ['CNY', /人民币|人民幣|\bCNY\b|\bRMB\b/gi],
  ['SEK', /\bSEK\b/g], ['NOK', /\bNOK\b/g], ['DKK', /\bDKK\b/g], ['CZK', /\bCZK\b|Kč/g], ['PLN', /\bPLN\b|zł/g], ['TRY', /₺|\bTRY\b/g],
  ['MXN', /\bMXN\b/g], ['BRL', /R\$|\bBRL\b/g], ['ZAR', /\bZAR\b/g], ['MOP', /\bMOP\b|澳門幣|澳门币/g], ['AED', /\bAED\b|د\.إ/g],
  ['ILS', /₪|\bILS\b|ש"ח/g], ['HUF', /\bHUF\b|\d\s?Ft\b/g], ['UAH', /₴|\bUAH\b|грн/gi], ['KHR', /៛|\bKHR\b/g], ['BDT', /৳|\bBDT\b/g]
];
function rcCurrency(text, lang, tripCur) {
  const hits = RC_CUR.map(([code, re]) => [code, (text.match(re) || []).length]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);
  if (hits.length) return { code: hits[0][0], sure: true };
  const n = re => (text.match(re) || []).length;
  if (n(/[¥￥]/g) || (lang === 'zh-Hans' && n(/元/g))) return { code: lang === 'zh-Hans' || (lang.startsWith('zh') && !n(/円/g)) ? 'CNY' : 'JPY', sure: lang === 'ja' };
  if (lang === 'zh-Hant' && n(/元/g)) return { code: 'TWD', sure: false };
  if (n(/\$/g)) return { code: lang === 'zh-Hant' ? 'HKD' : 'USD', sure: false };
  const usual = RC_LANG[lang]?.[2];
  if (usual) return { code: usual, sure: false };
  return null;
}

/* ---------- amounts ---------- */
// "1,234.56" "1.234,56" "12,50" "1 234" -> number
function rcNum(tok) {
  const m = tok.match(/^(.*?)([.,．，])(\d{1,2})$/);
  if (m && !/[.,．，]/.test(m[1].replace(/[.,．，]\d{3}/g, ''))) return parseFloat(m[1].replace(/[.,．，]/g, '') + '.' + m[3]);   // last separator is the decimal point
  return parseFloat(tok.replace(/[.,．，]/g, ''));
}

// Pull candidate totals out of OCR text, best guess first. Works for several languages' "total" wording.
function rcParse(text) {
  const out = new Map();
  const TOTAL = /(grand\s*total|total|amount\s*due|balance\s*due|to\s*pay|à\s*payer|montant|summe|gesamt|totale|totaal|importe|jumlah|tổng|toplam|итого|合計|合计|お会計|会計|お買上|ご請求|請求|税込|稅額合計|總計|总计|應付|应付|合共|합계|총|รวม|ยอดรวม|المجموع|razem|suma|celkem|summa|totalt|i\s+alt|yhteensä|összesen|σύνολο|συνολο|разом|всього|к\s*оплате|סה"כ|סך\s*הכל|कुल|মোট|សរុប|جمع)/i;
  const SUB = /(sub\s*-?\s*total|sous-total|zwischensumme|subtotaal|小計|小计|소계)/i;
  const SKIP = /(cash|change|tender|rendu|rückgeld|resto|monnaie|vuelto|お預|預り|預かり|お釣|おつり|釣銭|現金|找續|找零|거스름|받은|เงินทอน|point|ポイント|tel|電話|电话|登録|no\.|番号|date|time|datum|fecha|reszta|vráceno|växel|byttepenge|vaihtoraha|ρέστα|сдача|наличные|עודף|الباقي|वापसी)/i;
  const lines = rcDigits(text).split(/\n+/).map(l => l.trim()).filter(Boolean);
  let totalLines = 0, flagged = false;
  lines.forEach((line, idx) => {
    if (/\d{4}[\/.\-年]\d{1,2}[\/.\-月]\d{1,2}|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{1,2}:\d{2}/.test(line)) return;   // dates & times
    const re = /([¥￥$€£₩฿₫₹]|HK\$|RM|Rp\.?)?\s?(\d{1,3}(?:[.,．，]\d{3})+(?:[.,．，]\d{1,2})?|\d+(?:[.,．，]\d{1,2})?)\s*(円|원|元|บาท|-)?/g;
    let m;
    while ((m = re.exec(line))) {
      const tok = m[2], digits = tok.replace(/[.,．，]/g, '');
      if (digits.length > 9 || (!/[.,．，]\d{1,2}$/.test(tok) && digits.length > 7)) continue;      // phone / ID numbers
      const val = rcNum(tok);
      if (!(val > 0)) continue;
      let score = 0;
      const above = lines[idx - 1], labelAbove = idx > 0 && above && !/\d/.test(above) && TOTAL.test(above) && !SUB.test(above);   // "TOTAL" and the amount on separate lines
      if (TOTAL.test(line) && !SUB.test(line)) score += 4; else if (labelAbove) score += 3.5; else if (SUB.test(line)) score += 1;
      if (m[1] || m[3]) score += 1;
      if (/[.,．，]\d{1,2}$/.test(tok) || /[.,．，]/.test(tok) || digits.length >= 3) score += 0.5;
      if (SKIP.test(line)) score -= 5;
      if (idx > lines.length * 0.4) score += 0.5;                                                  // totals sit lower down
      if (score >= 3.5 && !flagged) { flagged = true; totalLines++; }
      const prev = out.get(val);
      if (!prev || prev.score < score) out.set(val, { val, score });
    }
    flagged = false;
  });
  const list = [...out.values()].sort((a, b) => b.score - a.score || b.val - a.val).slice(0, 4);
  list.multi = totalLines >= 2 && new Set([...out.values()].filter(c => c.score >= 3.5).map(c => c.val)).size >= 2;   // several "total" lines: maybe several receipts in one photo
  return list;
}

/* ---------- several photos ---------- */
// Photos picked together wait here; saving an expense opens the next one (splitter.js calls rcContinue()).
let rcQueue = [], rcBatch = { i: 0, n: 0 }, rcResuming = false;
function rcContinue() {
  if (!rcQueue.length || typeof expenseForm !== 'function') return false;
  rcResuming = true; expenseForm(); return true;
}

function initReceiptScan(root, tr) {
  const $r = s => root.querySelector(s);
  const file = $r('#rc-file'), status = $r('#rc-status'), bar = $r('#rc-bar'), chips = $r('#rc-chips'), langSel = $r('#rc-lang');
  const billIn = $r('[name=billAmount]'), curSel = $r('[name=billCur]');
  let canvas = null, found = null, picked = null;

  const resume = rcResuming; rcResuming = false;
  if (!resume) { rcQueue = []; rcBatch = { i: 0, n: 0 }; }        // the sheet was opened fresh: forget any unfinished batch

  const tag = () => rcBatch.n > 1 ? `Receipt ${rcBatch.i} of ${rcBatch.n}` : '';
  const say = msg => { status.textContent = tag() ? `${tag()} · ${msg}` : msg; };
  const fmt = v => v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const apply = () => {
    if (picked == null || !found) return;
    if (found.cur && curSel.value !== found.cur) { curSel.value = found.cur; curSel.dispatchEvent(new Event('change', { bubbles: true })); }
    const dec = typeof fxDecimals === 'function' ? fxDecimals(curSel.value) : 2;
    billIn.value = picked.toFixed(dec === 0 ? 0 : 2);
    billIn.dispatchEvent(new Event('input', { bubbles: true }));
    const lang = RC_LANG[found.lang]?.[0] || found.lang;
    say(`Language: ${lang}${found.cur ? ` · Currency: ${found.cur}${found.sure ? '' : ' (guess, please check)'}` : ' · Currency not found, using ' + curSel.value}. Please check the amount against the receipt.`
      + (found.list.multi ? ' Several totals found: this photo may hold more than one receipt, so pick the right one or scan them one at a time.' : '')
      + (rcQueue.length ? ` Save this expense and the next receipt (${rcQueue.length} left) opens.` : ''));
  };
  const showChips = () => {
    chips.innerHTML = found.list.map(c => `<button type="button" data-v="${c.val}" aria-pressed="${c.val === picked}">${found.cur ? found.cur + ' ' : ''}${fmt(c.val)}</button>`).join('');
  };
  chips.onclick = e => { const b = e.target.closest('button[data-v]'); if (!b) return; picked = parseFloat(b.dataset.v); showChips(); apply(); };

  async function ocr(langs, T, log) {
    let worker;
    try { worker = await T.createWorker(langs, 1, { langPath: RC_LANGS, logger: log }); }
    catch { worker = await T.createWorker('eng', 1, { langPath: RC_LANGS, logger: log }); }
    try { const { data } = await worker.recognize(canvas); return data; } finally { await worker.terminate(); }
  }

  async function run() {
    chips.innerHTML = ''; found = picked = null;
    bar.style.display = 'block'; bar.firstElementChild.style.width = '3%';
    try {
      say('Loading text reader (first time only)…');
      const T = await rcLoad();
      const log = m => { if (m.status === 'recognizing text') { say('Reading receipt…'); bar.firstElementChild.style.width = Math.round(10 + m.progress * 90) + '%'; } };
      const chosen = langSel.value, auto = chosen === 'auto';
      const pack = c => c === 'en' ? 'eng' : 'eng+' + RC_LANG[c][1];
      let data = await ocr(auto ? RC_AUTO : pack(chosen), T, log), text = data.text || '';
      let lang = auto ? rcLanguage(text) : chosen;
      // Auto: the first pass only knew English / Japanese / Chinese (trad.) / Korean. Anything else (simplified Chinese, Thai, Russian,
      // Arabic, Vietnamese and every European language) is read again with its own language data, which fixes accents and non-Latin scripts.
      if (auto && !RC_FIRST.includes(lang) && RC_LANG[lang]) {
        say(`Detected ${RC_LANG[lang][0]}, reading again…`);
        data = await ocr(pack(lang), T, log); text = data.text || ''; const l2 = rcLanguage(text); lang = l2 === 'en' ? lang : l2;
      }
      // Auto found no amount at all and nothing identifiable: the receipt may be in a script the first pass lacked. Try the common ones together.
      else if (auto && lang === 'en' && !rcParse(text).length) {
        say('Nothing found, trying other scripts…');
        try {
          const d2 = await ocr(RC_SCRIPTS, T, log), t2 = d2.text || '';
          if (rcParse(t2).length) { text = t2; lang = rcLanguage(t2); }
        } catch { /* keep the first result */ }
      }
      const list = rcParse(text), cur = rcCurrency(rcDigits(text), lang, tr.currency);
      found = { list, lang, cur: cur?.code || null, sure: !!cur?.sure };
      if (auto) langSel.dataset.detected = lang;
      if (!list.length) say(`Language: ${RC_LANG[lang]?.[0] || lang}. Could not find an amount. Pick the receipt language above to retry, use a flatter, brighter photo, or type it in.${rcQueue.length ? ` The next receipt (${rcQueue.length} left) opens after you save or close this one.` : ''}`);
      else { picked = list[0].val; showChips(); apply(); }
    } catch (err) {
      say(navigator.onLine ? 'Could not read that photo. Type the amount instead.' : 'Receipt scan needs internet the first time. Type the amount instead.');
    } finally { bar.style.display = 'none'; }
  }

  async function start(f) {
    bar.style.display = 'block'; bar.firstElementChild.style.width = '3%'; say('Preparing photo…');
    try { canvas = await rcPrepare(f); } catch { say('Could not open that photo.'); bar.style.display = 'none'; return false; }
    run(); return true;
  }

  file.onchange = async () => {
    const files = [...file.files].filter(f => f.type.startsWith('image/') || !f.type).slice(0, RC_MAX_BATCH); file.value = '';
    if (!files.length) return;
    rcQueue = files.slice(1); rcBatch = { i: 1, n: files.length };
    if (files.length > 1) toast(`${files.length} receipts queued: one expense each`);
    start(files[0]);
  };
  langSel.onchange = () => { if (canvas) run(); };   // wrong language guessed? pick it and the same photo is read again

  if (resume && rcQueue.length) { rcBatch.i++; start(rcQueue.shift()); }
}
