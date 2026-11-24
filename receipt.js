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
const RC_FIRST = ['en', 'ja', 'zh-Hant', 'zh-Hans'];                  // data already loaded in the first (Auto) pass
const RC_SCRIPTS = 'eng+kor+tha+rus+ara+hin+heb+ell';                    // last-resort pass when Auto found nothing
const RC_MAX_BATCH = 20;
const RC_AUTO = 'eng+chi_sim+chi_tra+jpn';   // first pass when language is "Auto": English, Chinese (simpl. + trad.), Japanese
const RC_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const RC_PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
let rcPdfLib;

function receiptScanHtml() {
  return `<div class="scan-box">
    <div class="scan-row">
      <label class="btn scan-btn">📷 <span>Scan receipt(s)</span><input id="rc-file" type="file" accept="image/*,application/pdf,.pdf" multiple></label>
      <select id="rc-lang" aria-label="Receipt language"><option value="auto">Auto-detect language</option>${Object.entries(RC_LANG).map(([k, v]) => `<option value="${k}">${v[0]}</option>`).join('')}</select>
    </div>
    <div id="rc-bar"><i></i></div>
    <p id="rc-status" class="muted" role="status"></p>
    <div id="rc-view" class="rc-view" hidden>
      <div class="rc-zoom" id="rc-zoom-box"><div class="rc-stage" id="rc-stage"><img id="rc-img" alt="${t('Receipt photo')}" draggable="false"><div class="rc-marks" id="rc-marks"></div></div></div>
      <div class="rc-tools"><p id="rc-picked" class="rc-picked"></p><button type="button" id="rc-zoom" class="rc-zoom-btn" aria-pressed="false">${t('Zoom')}</button></div>
    </div>
  </div>`;
}

function rcLoadPdf() {
  return rcPdfLib ||= new Promise((res, rej) => {
    if (window.pdfjsLib) return res(window.pdfjsLib);
    const s = document.createElement('script');
    s.src = RC_PDF; s.onload = () => { const lib = window.pdfjsLib; if (!lib) { rcPdfLib = null; return rej(new Error('pdf')); } lib.GlobalWorkerOptions.workerSrc = RC_PDF_WORKER; res(lib); };
    s.onerror = () => { rcPdfLib = null; rej(new Error('offline')); };
    document.head.appendChild(s);
  });
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
// Returns the OCR canvas plus a colour preview of exactly the same size, so OCR boxes line up with the picture the person taps.
async function rcPrepare(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { bmp = await createImageBitmap(file); }
  const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  const preview = await rcBlobUrl(c);
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = Math.max(0, Math.min(255, (y - 128) * 1.5 + 128 + 10));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  g.putImageData(img, 0, 0);
  return { canvas: c, preview, w: c.width, h: c.height, lines: null };
}
const rcBlobUrl = c => new Promise(res => c.toBlob(b => res(b ? URL.createObjectURL(b) : c.toDataURL('image/jpeg', .85)), 'image/jpeg', .85));

// PDF receipts / invoices: use the PDF's own text with its positions when it has any (exact, no OCR), otherwise OCR the rendered page.
// The page with the strongest total wins (totals are often on the last page).
async function rcPreparePdf(file) {
  const lib = await rcLoadPdf();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  try {
    let best = null;
    for (let n = 1; n <= Math.min(doc.numPages, 6); n++) {
      const page = await doc.getPage(n), v0 = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(3, 1800 / Math.max(v0.width, v0.height)) });
      const tc = await page.getTextContent(), items = [];
      for (const it of tc.items) {
        if (!it.str || !it.str.trim()) continue;
        const m = lib.Util.transform(vp.transform, it.transform), hgt = Math.hypot(m[2], m[3]) || 10;
        items.push({ text: it.str, bbox: { x0: m[4], y0: m[5] - hgt, x1: m[4] + (it.width || 0) * vp.scale, y1: m[5] + hgt * .2 } });
      }
      const lines = rcGroupLines(items), top = lines.length ? rcParseLines(lines)[0] : null;
      const score = top ? top.score : -99;
      if (!best || score > best.score || (score === best.score && n === 1 && !items.length)) best = { n, vp, page, lines: items.length ? lines : null, score };
    }
    const c = document.createElement('canvas'); c.width = Math.round(best.vp.width); c.height = Math.round(best.vp.height);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await best.page.render({ canvasContext: g, viewport: best.vp }).promise;
    return { canvas: c, preview: await rcBlobUrl(c), w: c.width, h: c.height, lines: best.lines, page: best.n, pages: doc.numPages };
  } finally { doc.destroy(); }
}
// PDF text pieces -> reading lines (same baseline, left to right)
function rcGroupLines(items) {
  items.sort((a, b) => a.bbox.y1 - b.bbox.y1 || a.bbox.x0 - b.bbox.x0);
  const lines = [];
  for (const it of items) {
    const h = it.bbox.y1 - it.bbox.y0, ln = lines.find(l => Math.abs(l.base - it.bbox.y1) < h * .5);
    if (ln) ln.words.push(it); else lines.push({ base: it.bbox.y1, words: [it] });
  }
  return lines.map(l => { l.words.sort((a, b) => a.bbox.x0 - b.bbox.x0); return { text: l.words.map(w => w.text).join(' '), words: l.words, bbox: rcUnion(l.words.map(w => w.bbox)) }; })
    .sort((a, b) => a.bbox.y0 - b.bbox.y0);
}
const rcUnion = bs => bs.length ? { x0: Math.min(...bs.map(b => b.x0)), y0: Math.min(...bs.map(b => b.y0)), x1: Math.max(...bs.map(b => b.x1)), y1: Math.max(...bs.map(b => b.y1)) } : null;

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

/* ---------- amounts ----------
   A dictionary of what receipts, invoices and handwritten slips call the amount to pay, tuned first for Chinese, Japanese and English,
   then the other supported languages. Every number is labelled by the words just before it (or by its line, or by a label alone on the
   line above), scored, and the best one is chosen automatically. The person corrects it by tapping the right number on the picture. */
const RC_KW = {
  // the final amount to pay: strongest
  due: ['grand total', 'amount due', 'balance due', 'total due', 'amount payable', 'total payable', 'total to pay', 'to pay', 'please pay', 'pay this amount', 'net payable', 'total amount due',
    '应付', '應付', '应付金额', '應付金額', '应收', '應收', '应收金额', '應收金額', '实付', '實付', '实付金额', '實付金額', '需付', '需付款', '待付', '价税合计', '價稅合計',
    '总金额', '總金額', '支付金额', '支付金額', '付款金额', '付款金額', '消费金额', '消費金額', '交易金额', '交易金額', '应付总额', '應付總額', '合共', '埋单', '埋單', '總數', '共计', '共計',
    'お支払金額', 'お支払い金額', 'お支払合計', 'お支払い合計', 'お支払額', 'ご請求金額', 'ご請求額', '御請求額', '請求金額', 'お会計', 'お買上合計', 'お買上げ合計', 'お買い上げ合計', 'お買上計',
    '税込合計', '税込計', '総合計', '総計', '領収金額', '合計金額', '合計額',
    'à payer', 'net à payer', 'total ttc', 'montant ttc', 'zu zahlen', 'endbetrag', 'zahlbetrag', 'gesamtbetrag', 'te betalen', 'totale da pagare', 'totale complessivo', 'total a pagar', 'importe total',
    'valor total', 'do zapłaty', 'k úhradě', 'k zaplacení', 'att betala', 'at betale', 'maksettava', 'fizetendő', 'к оплате', 'до сплати', 'לתשלום', 'المبلغ المستحق', 'total bayar', 'jumlah bayar',
    'jumlah besar', 'tổng thanh toán', 'cần thanh toán', 'tổng cộng', 'ยอดชำระ', 'ยอดสุทธิ', 'รวมทั้งสิ้น', '결제금액', '받을금액', '청구금액', '합계금액', 'genel toplam', 'kokonaissumma'],
  // money handed over, change, points, phone / order / card numbers: never the total
  skip: ['cash', 'tendered', 'tender', 'change', 'rendu', 'monnaie', 'rückgeld', 'gegeben', 'resto', 'cambio', 'vuelto', 'troco', 'wisselgeld', 'kembali', 'kembalian', 'tiền thừa', 'khách đưa',
    'tiền khách', 'espèces', 'especes', 'efectivo', 'contanti', 'bargeld', 'dinheiro', 'contant', 'tunai', 'nakit', 'gotówka', 'hotovost', 'kontant', 'käteinen', 'készpénz', 'para üstü', 'сдача', 'получено', 'наличные', 'reszta', 'vráceno', 'växel', 'byttepenge', 'vaihtoraha', 'visszajáró', 'ρέστα', 'עודף', 'الباقي', 'वापसी', 'เงินทอน', 'รับเงิน',
    'お預り', 'お預かり', '預り', '預かり', 'お釣', 'おつり', 'お釣り', '釣銭', '釣り銭', '現金', '找續', '找续', '找零', '找赎', '找贖', '收现', '收現', '实收', '實收', '收款', '付现', '付現',
    '받은금액', '받은 금액', '거스름', '거스름돈', 'point', 'points', 'ポイント', '积分', '積分', '포인트', 'tel', 'fax', 'phone', '電話', '电话', '登録番号', '登録', 'no.', '番号', '單號', '单号',
    '订单号', '訂單號', 'invoice no', 'receipt no', 'order no', 'table', '台号', '桌号', '人数', '客数', 'date', 'time', 'datum', 'fecha', '日時', '时间', '時間', 'card no', '卡号', '卡號',
    'auth', '承認', 'approval', 'terminal', '端末', 'batch', 'ref', '流水', '会員', '會員', 'member', '餘額', '余额', '残高', 'remaining',
    'balance:', 'saldo', '剩余', '剩餘', 'deposit', '押金', '订金', '訂金'],
  sub: ['subtotal', 'sub total', 'sub-total', 'sous-total', 'sous total', 'zwischensumme', 'subtotaal', 'subtotale', 'tạm tính', 'ara toplam', 'промежуточный итог', 'mezisoučet', 'delsumma',
    'välisumma', 'részösszeg', 'total ht', 'hors taxe', 'excl. vat', 'excl vat', 'excluding tax', 'before tax', 'pre-tax', '小計', '小计', '소계', '税抜', '稅前', '税前', '未税', '未稅', '本体価格', '商品合計', '値引前', 'ยอดก่อน'],
  // parts of the bill that are not the bill: tax lines, service, tips, discounts, rounding
  minor: ['tax', 'vat', 'gst', 'hst', 'pst', 'mwst', 'ust', 'tva', 'iva', 'btw', 'kdv', 'ндс', 'ppn', 'pajak', 'thuế', 'ภาษี', '부가세', '세액', '消費税', '消费税', '税額', '稅額', '内税', '外税',
    '税金', '增值税', '税额', 'service charge', 'service', 'tip', 'tips', 'gratuity', 'rounding', 'discount', 'coupon', '服務費', '服务费', 'サービス料', 'チップ', '端数', '割引', '値引', '折扣',
    '优惠', '優惠', '減免', '减免', '抹零', '税', '稅'],
  total: ['total', 'totals', 'tota1', 'totai', 'tctal', 'tot', 'ttl', 'sum', 'summe', 'summa', 'gesamt', 'totaal', 'totale', 'jumlah', 'tổng', 'tổng tiền', 'toplam', 'итого', 'всего', 'разом',
    'всього', 'razem', 'suma', 'celkem', 'totalt', 'i alt', 'yhteensä', 'összesen', 'σύνολο', 'συνολο', 'סה"כ', 'סה״כ', 'סך הכל', 'المجموع', 'الإجمالي', 'الاجمالي', 'कुल', 'মোট', 'សរុប', 'جمع',
    '합계', '총액', '총합계', 'รวม', 'ยอดรวม', '合計', '合计', '總計', '总计', '總額', '总额', '合汁', '合讣', '总汁', '合言十', '金額合計', '合计金额', '计费', '總共', '总共', '小結'],
  // money words with no "total" meaning on their own: a hint only
  weak: ['amount', 'amt', 'montant', 'betrag', 'importe', 'importo', 'valor', 'bedrag', 'thành tiền', 'charge', 'payment', 'payable', 'price', '金額', '金额', '價錢', '价钱', '料金', '代金', '御代',
    '金', '금액', 'ราคา', 'сумма', 'kwota', 'částka', 'belopp', 'beløp', 'összeg'],
  // payment methods: the amount on such a line is usually the total itself, so it backs up a candidate
  pay: ['visa', 'master', 'mastercard', 'amex', 'jcb', 'unionpay', '银联', '銀聯', 'credit', 'クレジット', 'カード', 'card', 'debit', '電子マネー', 'suica', 'pasmo', 'icoca', 'paypay', '楽天ペイ',
    'd払い', 'au pay', 'alipay', '支付宝', '支付寶', 'wechat', '微信', 'octopus', '八達通', '八达通', 'apple pay', 'google pay', '刷卡', '信用卡', '银行卡', '銀行卡', 'eftpos', 'contactless']
};
const RC_KS = { due: 6, total: 5, weak: 2.5, sub: 1, minor: -2, skip: -6 };
const rcEsc = x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// CJK words also match when OCR puts spaces between the characters ("合 計"); Latin words need word edges ("total" is not "subtotal")
const rcRe = list => new RegExp(list.map(w => /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/.test(w)
  ? [...w].map(rcEsc).join('\\s*') : `(?<![\\p{L}])${rcEsc(w)}(?![\\p{L}])`).join('|'), 'iu');
const RC_RE = Object.fromEntries(Object.entries(RC_KW).map(([k, v]) => [k, rcRe(v)]));
const RC_INCL = /incl(?:uding|\.)?\s*(?:vat|tax|gst|mwst)|inkl\.?\s*(?:mwst|ust)|\bttc\b|含税|含稅|(?:消費)?税込み?|稅込/giu;

// Clean one OCR / PDF fragment so the dictionary can match it: full-width -> ASCII, local digits, typical OCR letter/digit swaps inside words.
function rcClean(text) {
  return rcDigits(String(text).normalize('NFKC'))
    .replace(/(?<=[A-Za-z])0|0(?=[a-z])/g, 'o').replace(/(?<=[a-z])[|!1](?=[a-z])/gi, 'l');
}
// Which kind of label is this text?
function rcKind(text) {
  const x = text.toLowerCase();
  if (RC_RE.due.test(x)) return 'due';
  if (RC_RE.skip.test(x)) return 'skip';
  if (RC_RE.sub.test(x)) return 'sub';
  const noIncl = x.replace(RC_INCL, ' ');
  if (RC_RE.minor.test(noIncl) && !/(grand|総|總|总)/.test(x)) return 'minor';
  if (RC_RE.total.test(noIncl)) return 'total';
  if (RC_RE.weak.test(x)) return 'weak';
  return null;
}

// Chinese / Japanese numerals, as written on fapiao (大写) and handwritten 領収書: 伍拾陆元整, 金壱万弐千円也
const RC_CN_D = { 零: 0, 〇: 0, 一: 1, 壹: 1, 壱: 1, 二: 2, 贰: 2, 貳: 2, 弐: 2, 两: 2, 兩: 2, 三: 3, 叁: 3, 參: 3, 参: 3, 四: 4, 肆: 4, 五: 5, 伍: 5, 六: 6, 陆: 6, 陸: 6, 七: 7, 柒: 7, 八: 8, 捌: 8, 九: 9, 玖: 9 };
const RC_CN_U = { 十: 10, 拾: 10, 百: 100, 佰: 100, 千: 1000, 仟: 1000 }, RC_CN_B = { 万: 1e4, 萬: 1e4, 亿: 1e8, 億: 1e8 };
const RC_CN_CH = '零〇一壹壱二贰貳弐两兩三叁參参四肆五伍六陆陸七柒八捌九玖十拾百佰千仟万萬亿億';
function rcCnInt(s) {
  let total = 0, sec = 0, num = 0;
  for (const ch of s) {
    if (ch in RC_CN_D) num = RC_CN_D[ch];
    else if (ch in RC_CN_U) { sec += (num || 1) * RC_CN_U[ch]; num = 0; }
    else if (ch in RC_CN_B) { total = (total + sec + num) * RC_CN_B[ch]; sec = num = 0; }
  }
  return total + sec + num;
}
function rcCnAmounts(text) {
  const out = [], re = new RegExp(`([${RC_CN_CH}]{2,})[元圆圓円](?:([${RC_CN_CH}])角)?(?:([${RC_CN_CH}])分)?`, 'g');
  let m;
  while ((m = re.exec(text))) { const v = rcCnInt(m[1]) + (m[2] ? rcCnInt(m[2]) / 10 : 0) + (m[3] ? rcCnInt(m[3]) / 100 : 0); if (v > 0) out.push({ v, a: m.index, b: m.index + m[0].length }); }
  return out;
}

// "1,234.56" "1.234,56" "12,50" "1'234.50" -> number
function rcNum(tok) {
  tok = tok.replace(/['’ ]/g, '');
  const m = tok.match(/^(.*?)([.,])(\d{1,2})$/);
  if (m && !/[.,]/.test(m[1].replace(/[.,]\d{3}/g, ''))) return parseFloat(m[1].replace(/[.,]/g, '') + '.' + m[3]);   // last separator is the decimal point
  return parseFloat(tok.replace(/[.,]/g, ''));
}

// Lines from Tesseract (with word boxes), from a PDF's text layer, or plain text -> one shape: { text, words:[{text,bbox,a,b}], bbox }
function rcLinesOf(data) {
  const src = data.lines?.length ? data.lines : (data.text || '').split(/\n+/).map(text => ({ text, words: null, bbox: null }));
  return src.map(l => {
    if (!l.words?.length) return { text: rcClean(l.text || ''), words: [], bbox: l.bbox || null };
    let text = '';
    const words = l.words.map(w => { const t = rcClean(w.text); const a = text ? text.length + 1 : 0; text += (text ? ' ' : '') + t; return { text: t, bbox: w.bbox, a, b: a + t.length }; });
    return { text, words, bbox: l.bbox || rcUnion(words.map(w => w.bbox)) };
  }).filter(l => l.text.trim());
}

const RC_AMT = /([¥$€£₩฿₫₹₱₺₪₴៛৳]|HK\$|NT\$|US\$|S\$|A\$|MOP\$?|RMB|CNY|JPY|HKD|TWD|USD|EUR|RM|Rp\.?|金)?\s?(\d{1,3}(?: \d{3})+[.,]\d{2}(?!\d)|\d{1,3}(?:[.,'’]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(\s?(?:円|元|圓|圆|块|塊|원|บาท|₫|đ|€|zł|kč|ft|kr|\/-|-|也|整)(?![\p{L}\d]))?/giu;
// item counts: "合計点数 3", "Items: 3" are not money
const RC_COUNTW = /点数|點數|件数|件數|数量|數量|個数|品数|商品数|item\s*count|\bqty\b|\bitems?\b|\bpcs\b|\bpax\b/giu;
const RC_COUNT_AFTER = /^\s?(?:%|点|點|個|个|件|枚|本|杯|人|名|位|号|號|番|pcs|pc|items?|x(?![\p{L}])|×|g(?![\p{L}])|kg|ml|cm|mm|折)/iu;
// Dates, times and phone numbers become '#' so their digits are not read as money (same length keeps word positions).
const rcMask = s => s.replace(/\d{4}\s?[\/.\-年]\s?\d{1,2}\s?[\/.\-月]\s?\d{1,2}日?|\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}|\d{1,2}月\d{1,2}日|\d{1,2}:\d{2}(?::\d{2})?|\(?\d{2,4}\)?[\-\s]\d{3,4}[\-\s]\d{3,4}/g, x => '#'.repeat(x.length));

// Every amount on the receipt, scored. Returns the candidates (best first) with .tokens = every amount with its box (for tapping).
function rcParseLines(lines) {
  const tokens = [], n = lines.length;
  lines.forEach((line, li) => {
    const masked = rcMask(line.text), kindOf = x => rcKind(x.replace(RC_COUNTW, ' ')), lineKind = kindOf(line.text);
    const above = lines[li - 1], aboveLabel = above && !/\d/.test(rcMask(above.text)) ? kindOf(above.text) : null;
    let m, prevEnd = 0; const mine = [];
    RC_AMT.lastIndex = 0;
    while ((m = RC_AMT.exec(masked))) {
      const num = m[2], digits = num.replace(/\D/g, ''), a = m.index, b = m.index + m[0].length;
      const label = masked.slice(prevEnd, a);
      if (digits.length > 9 || (!/[.,]\d{1,2}$/.test(num) && digits.length > 7)) continue;          // card, phone and ID numbers
      const val = rcNum(num); if (!(val > 0)) continue;
      const after = masked.slice(b), plain = !m[1] && !(m[3] && m[3].trim() !== '-') && !/[.,]\d{1,2}$/.test(num) && digits.length <= 3;
      const count = RC_COUNT_AFTER.test(after) || /[#№]\s?$/.test(label) || (plain && new RegExp(RC_COUNTW.source + '[\\s:：]*$', 'iu').test(label));
      if (!count) prevEnd = b;                                               // a count doesn't end the label: "合計 3点 ¥1,234"
      const labKind = kindOf(label);
      const kind = count ? 'count' : (labKind || lineKind || (aboveLabel && aboveLabel !== 'skip' ? aboveLabel : null));
      let score = count ? -8 : (RC_KS[kind] ?? 0);
      if (!labKind && !lineKind && aboveLabel && aboveLabel !== 'skip') score -= 0.3;               // label alone on the line above
      if (m[1] || (m[3] && m[3].trim() !== '-')) score += 1;                                             // currency sign or unit
      if (/[.,]\d{1,2}$/.test(num) || digits.length >= 3) score += 0.4;
      if (/[@x×]\s?$/i.test(label)) score -= 1;                                                          // unit price "@ 120"
      score += 0.6 * (n > 1 ? li / (n - 1) : 1);                                                         // totals sit lower down
      const ws = line.words.filter(w => w.b > a && w.a < b);
      const t = { val, score, kind, li, a, b, text: m[0].trim(), label: line.text.trim(), pay: RC_RE.pay.test(line.text.toLowerCase()),
        bbox: ws.length ? rcUnion(ws.map(w => w.bbox)) : line.bbox };
      mine.push(t); tokens.push(t);
    }
    if (mine.length > 1) mine[mine.length - 1].score += 0.3;                                             // the amount is usually at the right
    for (const c of rcCnAmounts(line.text)) tokens.push({ val: c.v, score: (RC_KS[lineKind] ?? 1) + 1, kind: lineKind, li, a: c.a, b: c.b, text: line.text.slice(c.a, c.b), label: line.text.trim(), cn: true, bbox: line.bbox });
  });

  // whole-receipt checks
  const real = tokens.filter(t => t.kind !== 'skip' && t.kind !== 'count');
  const maxVal = Math.max(0, ...real.filter(t => t.kind !== 'minor').map(t => t.val));
  const payVals = new Set(tokens.filter(t => t.pay && t.kind !== 'count').map(t => t.val));
  const cnVals = new Set(tokens.filter(t => t.cn).map(t => t.val));
  const subs = tokens.filter(t => t.kind === 'sub').map(t => t.val), taxes = tokens.filter(t => t.kind === 'minor').map(t => t.val);
  const seen = new Map(); real.forEach(t => seen.set(t.val, (seen.get(t.val) || 0) + 1));
  const near = (x, y) => Math.abs(x - y) < 0.011;
  const best = new Map();
  for (const t of tokens) {
    let s = t.score;
    if (t.kind !== 'skip' && t.kind !== 'count') {
      if (t.val === maxVal) s += 0.8;
      if (payVals.has(t.val) && !t.pay) s += 1;
      if ((seen.get(t.val) || 0) >= 2) s += 0.5;
      if (!t.cn && [...cnVals].some(v => near(v, t.val))) s += 2;                                      // matches the amount written in words
      if (subs.some(a => taxes.some(b => near(a + b, t.val)))) s += 1.5;                                 // subtotal + tax = this
    }
    t.final = s;
    const prev = best.get(t.val);
    if (!prev || prev.final < s) best.set(t.val, t);
  }
  const list = [...best.values()].filter(t => t.kind !== 'count').sort((a, b) => b.final - a.final || b.val - a.val).map(t => ({ ...t, score: t.final }));
  const strong = new Set(tokens.filter(t => t.kind === 'due' || t.kind === 'total').map(t => t.val));
  list.multi = new Set(tokens.filter(t => (t.kind === 'due' || t.kind === 'total') && !t.cn).map(t => t.li)).size >= 2 && strong.size >= 2 && ![...strong].every(v => payVals.has(v));
  list.tokens = tokens.filter(t => t.bbox && t.kind !== 'count');
  return list;
}
// plain text version (kept for callers that only have text)
const rcParse = text => rcParseLines(rcLinesOf({ text }));

/* ---------- several photos ---------- */
// Photos picked together wait here; saving an expense opens the next one (splitter.js calls rcContinue()).
let rcQueue = [], rcBatch = { i: 0, n: 0 }, rcResuming = false;
function rcContinue() {
  if (!rcQueue.length || typeof expenseForm !== 'function') return false;
  rcResuming = true; expenseForm(); return true;
}

function initReceiptScan(root, tr) {
  const $r = s => root.querySelector(s);
  const file = $r('#rc-file'), status = $r('#rc-status'), bar = $r('#rc-bar'), langSel = $r('#rc-lang');
  const view = $r('#rc-view'), box = $r('#rc-zoom-box'), img = $r('#rc-img'), marks = $r('#rc-marks'), pickedEl = $r('#rc-picked'), zoomBtn = $r('#rc-zoom');
  const billIn = $r('[name=billAmount]'), curSel = $r('[name=billCur]');
  let shot = null, found = null, picked = null, tapAt = null;

  const resume = rcResuming; rcResuming = false;
  if (!resume) { rcQueue = []; rcBatch = { i: 0, n: 0 }; }        // the sheet was opened fresh: forget any unfinished batch

  const tag = () => rcBatch.n > 1 ? `Receipt ${rcBatch.i} of ${rcBatch.n}` : '';
  const say = msg => { status.textContent = tag() ? `${tag()} · ${msg}` : msg; };
  const fmt = v => v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const apply = (byTap = false) => {
    if (!picked || !found) return;
    if (found.cur && curSel.value !== found.cur) { curSel.value = found.cur; curSel.dispatchEvent(new Event('change', { bubbles: true })); }
    const dec = typeof fxDecimals === 'function' ? fxDecimals(curSel.value) : 2;
    billIn.value = picked.val.toFixed(dec === 0 ? 0 : 2);
    billIn.dispatchEvent(new Event('input', { bubbles: true }));
    const lang = RC_LANG[found.lang]?.[0] || found.lang;
    pickedEl.innerHTML = `<b>${esc(t('Receipt total'))}: ${esc(curSel.value)} ${esc(fmt(picked.val))}</b><small>${esc(byTap ? t('Picked by you') : t('Found on the receipt'))}${picked.label ? ` · <span class="user-text">${esc(picked.label.slice(0, 60))}</span>` : ''}</small>`;
    say(`Language: ${lang}${found.cur ? ` · Currency: ${found.cur}${found.sure ? '' : ' (guess, please check)'}` : ' · Currency not found, using ' + curSel.value}. ${t('Tap the total on the receipt to change it')}.`
      + (found.list.multi && !byTap ? ' Several totals found: this photo may hold more than one receipt. Tap the right one, or scan them one at a time.' : '')
      + (rcQueue.length ? ` Save this expense and the next receipt (${rcQueue.length} left) opens.` : ''));
  };

  /* ----- the receipt picture: boxes in image pixels, drawn as percentages so they follow any zoom ----- */
  const pct = (v, of) => (v / of * 100).toFixed(3) + '%';
  function drawMarks() {
    if (!shot) return;
    const W = shot.w, H = shot.h, toks = found?.list.tokens || [];
    marks.innerHTML = toks.map((tk, k) => { const b = tk.bbox, on = picked && tk.val === picked.val && tk.li === picked.li && tk.a === picked.a;
      return `<button type="button" class="rc-mark${on ? ' on' : ''}" data-k="${k}" tabindex="${on || (!picked && !k) ? 0 : -1}" aria-label="${esc(tk.text)}" style="left:${pct(b.x0 - 3, W)};top:${pct(b.y0 - 3, H)};width:${pct(b.x1 - b.x0 + 6, W)};height:${pct(b.y1 - b.y0 + 6, H)}"></button>`; }).join('')
      + (tapAt ? `<i class="rc-tap" style="left:${pct(tapAt.x, W)};top:${pct(tapAt.y, H)}"></i>` : '');
  }
  function scrollToPick() {
    const el = marks.querySelector('.rc-mark.on'); if (!el) return;
    const br = box.getBoundingClientRect(), er = el.getBoundingClientRect();
    box.scrollTo({ top: box.scrollTop + er.top - br.top - (box.clientHeight - er.height) / 2, left: box.scrollLeft + er.left - br.left - (box.clientWidth - er.width) / 2, behavior: 'smooth' });
  }
  function choose(tk, byTap) { picked = tk; drawMarks(); apply(byTap); }

  // Tap -> image pixel. Uses the image's live on-screen box, so it stays exact with zoom, scrolling, iOS page zoom and any screen density.
  function pickAt(cx, cy) {
    if (!shot || !found) return;
    const r = img.getBoundingClientRect(); if (!r.width || cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return;
    const sx = shot.w / r.width, sy = shot.h / r.height, x = (cx - r.left) * sx, y = (cy - r.top) * sy;
    tapAt = { x, y };
    const toks = found.list.tokens, slop = 16 * sx;                                                        // about a fingertip, in image pixels
    const dist = b => Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1) * sx / sy);
    let tk = toks.filter(t => dist(t.bbox) <= slop).sort((a, b) => dist(a.bbox) - dist(b.bbox))[0];
    if (!tk) {   // tapped the label ("合計", "TOTAL") or empty space on the total's row: take the amount on that row, else the row below
      const rowOf = l => found.lines[l]?.bbox, inRow = l => { const b = rowOf(l); return b && y >= b.y0 - 6 * sy && y <= b.y1 + 6 * sy; };
      const li = found.lines.findIndex((_, i) => inRow(i));
      if (li >= 0) { const row = toks.filter(t => t.li === li); tk = row[row.length - 1] || toks.filter(t => t.li === li + 1).slice(-1)[0]; }
    }
    if (!tk) tk = toks.filter(t => dist(t.bbox) <= 44 * sx).sort((a, b) => dist(a.bbox) - dist(b.bbox))[0];
    if (!tk) { drawMarks(); say(t('No amount there. Tap the number itself, or zoom in.')); return; }
    choose(tk, true);
  }
  let down = null;
  box.addEventListener('pointerdown', e => { if (e.isPrimary) down = { x: e.clientX, y: e.clientY, id: e.pointerId, sl: box.scrollLeft, st: box.scrollTop }; });
  box.addEventListener('pointerup', e => {
    if (!down || e.pointerId !== down.id) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) + Math.abs(box.scrollLeft - down.sl) + Math.abs(box.scrollTop - down.st); down = null;
    if (moved > 10) return;                                                                                // that was a scroll, not a tap
    e.preventDefault(); pickAt(e.clientX, e.clientY);
  });
  box.addEventListener('pointercancel', () => { down = null; });
  marks.addEventListener('click', e => {                                                                  // keyboard: Enter / Space on a box
    if (e.detail !== 0) return; const b = e.target.closest('.rc-mark'); if (b) choose(found.list.tokens[+b.dataset.k], true);
  });
  marks.addEventListener('keydown', e => {                                                                // arrows move between amounts
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key) || !found) return;
    e.preventDefault(); const toks = found.list.tokens, i = Math.max(0, toks.findIndex(t => t === picked || (picked && t.val === picked.val && t.li === picked.li && t.a === picked.a)));
    const tk = toks[Math.min(toks.length - 1, Math.max(0, i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1)))];
    if (tk) { choose(tk, true); marks.querySelector('.rc-mark.on')?.focus(); scrollToPick(); }
  });
  zoomBtn.onclick = () => {
    const on = !view.classList.contains('zoomed'), r = img.getBoundingClientRect(), br = box.getBoundingClientRect();
    const fx = (box.scrollLeft + br.width / 2) / (r.width || 1), fy = (box.scrollTop + br.height / 2) / (r.height || 1);   // keep the middle in view
    view.classList.toggle('zoomed', on); zoomBtn.setAttribute('aria-pressed', String(on));
    requestAnimationFrame(() => { const r2 = img.getBoundingClientRect(); box.scrollTo({ left: fx * r2.width - br.width / 2, top: fy * r2.height - br.height / 2 }); });
  };

  function showShot() {
    if (!shot) { view.hidden = true; return; }
    img.src = shot.preview; view.hidden = false; view.classList.remove('zoomed'); zoomBtn.setAttribute('aria-pressed', 'false');
    pickedEl.textContent = ''; tapAt = null; marks.innerHTML = ''; box.scrollTo({ top: 0, left: 0 });
  }

  async function ocr(langs, T, log) {
    let worker;
    try { worker = await T.createWorker(langs, 1, { langPath: RC_LANGS, logger: log }); }
    catch { worker = await T.createWorker('eng', 1, { langPath: RC_LANGS, logger: log }); }
    try { const { data } = await worker.recognize(shot.canvas); return data; } finally { await worker.terminate(); }
  }

  async function run() {
    found = picked = null; tapAt = null; marks.innerHTML = ''; pickedEl.textContent = '';
    try {
      let lines, lang, text;
      const chosen = langSel.value, auto = chosen === 'auto';
      if (shot.lines) {                                                                                    // PDF with real text: no OCR needed
        lines = shot.lines; text = lines.map(l => l.text).join('\n'); lang = auto ? rcLanguage(text) : chosen;
      } else {
        bar.style.display = 'block'; bar.firstElementChild.style.width = '3%';
        say('Loading text reader (first time only)…');
        const T = await rcLoad();
        const log = m => { if (m.status === 'recognizing text') { say('Reading receipt…'); bar.firstElementChild.style.width = Math.round(10 + m.progress * 90) + '%'; } };
        const pack = c => c === 'en' ? 'eng' : 'eng+' + RC_LANG[c][1];
        let data = await ocr(auto ? RC_AUTO : pack(chosen), T, log); text = data.text || '';
        lang = auto ? rcLanguage(text) : chosen;
        // Auto: the first pass knew English / Chinese (both) / Japanese. Anything else is read again with its own language data.
        if (auto && !RC_FIRST.includes(lang) && RC_LANG[lang]) {
          say(`Detected ${RC_LANG[lang][0]}, reading again…`);
          data = await ocr(pack(lang), T, log); text = data.text || ''; const l2 = rcLanguage(text); lang = l2 === 'en' ? lang : l2;
        }
        // Simplified vs traditional Chinese: re-read with only the right one, which fixes look-alike characters.
        else if (auto && lang.startsWith('zh') && !rcParseLines(rcLinesOf(data)).some(c => c.kind === 'due' || c.kind === 'total')) {
          try { const d2 = await ocr(pack(lang), T, log); if (rcParseLines(rcLinesOf(d2)).some(c => c.kind === 'due' || c.kind === 'total')) { data = d2; text = d2.text || ''; } } catch { /* keep */ }
        }
        // Nothing found and nothing identifiable: the receipt may be in a script the first pass lacked. Try the common ones together.
        else if (auto && lang === 'en' && !rcParseLines(rcLinesOf(data)).length) {
          say('Nothing found, trying other scripts…');
          try { const d2 = await ocr(RC_SCRIPTS, T, log); if (rcParseLines(rcLinesOf(d2)).length) { data = d2; text = d2.text || ''; lang = rcLanguage(text); } } catch { /* keep the first result */ }
        }
        lines = rcLinesOf(data);
      }
      const list = rcParseLines(lines), cur = rcCurrency(rcDigits(text.normalize('NFKC')), lang, tr.currency);
      found = { list, lines, lang, cur: cur?.code || null, sure: !!cur?.sure };
      if (auto) langSel.dataset.detected = lang;
      if (!list.length) { drawMarks(); say(`Language: ${RC_LANG[lang]?.[0] || lang}. ${t('No total found. Tap the total on the receipt.')} You can also pick the receipt language above to read it again, or type the amount.${rcQueue.length ? ` The next receipt (${rcQueue.length} left) opens after you save or close this one.` : ''}`); }
      else { choose(list[0], false); setTimeout(scrollToPick, 60); }
    } catch (err) {
      say(navigator.onLine ? 'Could not read that receipt. Tap the total if it shows, or type the amount.' : 'Receipt scan needs internet the first time. Type the amount instead.');
    } finally { bar.style.display = 'none'; }
  }

  async function start(f) {
    bar.style.display = 'block'; bar.firstElementChild.style.width = '3%'; say('Preparing receipt…');
    if (shot?.preview?.startsWith('blob:')) URL.revokeObjectURL(shot.preview);
    shot = null;
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name || '');
    try { shot = isPdf ? await rcPreparePdf(f) : await rcPrepare(f); }
    catch { say(isPdf ? (navigator.onLine ? 'Could not open that PDF.' : 'Reading PDFs needs internet the first time.') : 'Could not open that photo.'); bar.style.display = 'none'; showShot(); return false; }
    showShot();
    if (shot.pages > 1) toast(`PDF page ${shot.page} of ${shot.pages}`);
    run(); return true;
  }

  file.onchange = async () => {
    const files = [...file.files].filter(f => f.type.startsWith('image/') || f.type === 'application/pdf' || /\.pdf$/i.test(f.name) || !f.type).slice(0, RC_MAX_BATCH); file.value = '';
    if (!files.length) return;
    rcQueue = files.slice(1); rcBatch = { i: 1, n: files.length };
    if (files.length > 1) toast(`${files.length} receipts queued: one expense each`);
    start(files[0]);
  };
  langSel.onchange = () => { if (shot) run(); };   // wrong language guessed? pick it and the same receipt is read again

  if (resume && rcQueue.length) { rcBatch.i++; start(rcQueue.shift()); }
}
