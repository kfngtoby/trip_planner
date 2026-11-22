/* Tabelog list-page helpers (pure functions, no network). Used by the `tabelog_search` task in index.js.
   Tabelog has no public API, so this reads the public search page. If Tabelog changes its HTML, parseList()
   returns no items and the app falls back to a link that opens the same search on tabelog.com. */
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const text = s => String(s || '').replace(/<[^>]*>/g, ' ')
  .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENT[e.toLowerCase()] ?? m))
  .replace(/\s+/g, ' ').trim();

function buildUrl(area, keyword, page) {
  const p = Math.min(Math.max(Number(page) || 1, 1), 10);
  const q = new URLSearchParams({ vs: '1', sa: String(area || '').slice(0, 40), sk: String(keyword || '').slice(0, 40), sw: '', SrtT: 'rt' });
  return `https://tabelog.com/rstLst/${p > 1 ? p + '/' : ''}?${q}`;
}

function parseList(html) {
  const src = String(html || '');
  const starts = [...src.matchAll(/<(?:li|div)\b[^>]*\bclass="(?:[^"]*\s)?list-rst(?:\s[^"]*)?"/g)].map(m => m.index);
  const items = [], seen = new Set();
  starts.forEach((at, i) => {
    const block = src.slice(at, starts[i + 1] ?? at + 20000);
    const a = block.match(/<a\b[^>]*class="[^"]*list-rst__rst-name-target[^"]*"[^>]*>([\s\S]*?)<\/a>/);
    const href = a && (a[0].match(/href="([^"]+)"/) || [])[1];
    const name = a && text(a[1]);
    if (!href || !name || !/^https:\/\/tabelog\.com\//.test(href) || seen.has(href)) return;
    seen.add(href);
    const score = (block.match(/c-rating__val[^>]*>(?:\s|<[^>]+>)*([0-5]\.\d{2})/) || [])[1];
    const reviews = (block.match(/list-rst__rvw-count-num[^>]*>\s*([\d,]+)/) || [])[1];
    const label = text((block.match(/list-rst__area-genre[^>]*>([\s\S]*?)<\/(?:p|div|span)>/) || [])[1]);
    const money = '([￥¥][\\d,]+(?:\\s*[～~〜-]\\s*[￥¥]?[\\d,]+)?)';
    const tagged = ['dinner', 'lunch'].map(k => { const m = block.match(new RegExp('c-rating-v3__time--' + k + '[\\s\\S]{0,300}?>\\s*' + money + '\\s*<')); return m ? [k, m[1].replace(/\s+/g, '')] : null; }).filter(Boolean);
    const loose = [...block.matchAll(new RegExp('>\\s*' + money + '\\s*<', 'g'))].map(m => m[1].replace(/\s+/g, ''));
    const budget = tagged.length ? tagged.map(([k, v]) => (k === 'dinner' ? 'Dinner ' : 'Lunch ') + v).join(' / ') : (loose[0] || '');
    const [areaTxt, ...genreTxt] = label.split('/').map(x => x.trim());
    items.push({ name: name.slice(0, 100), link: href.split('#')[0], score: score ? Number(score) : null,
      reviews: reviews ? Number(reviews.replace(/,/g, '')) : null, label: label.slice(0, 120),
      station: genreTxt.length ? areaTxt.slice(0, 60) : '', genre: (genreTxt.length ? genreTxt.join(' / ') : areaTxt).slice(0, 80), budget });
  });
  return items.slice(0, 25);
}
/* Shop page: the full address (schema.org JSON-LD first, then the info table). */
function parseDetail(html) {
  const src = String(html || '');
  for (const m of src.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const walk = o => Array.isArray(o) ? o.map(walk).find(Boolean) : o && typeof o === 'object' ? (o.address ? o.address : Object.values(o).map(walk).find(Boolean)) : null;
      const a = walk(JSON.parse(m[1]));
      if (a) { const t = typeof a === 'string' ? a : [a.addressRegion, a.addressLocality, a.streetAddress].filter(Boolean).join(''); if (t) return { address: text(t).slice(0, 200) }; }
    } catch {}
  }
  const t = (src.match(/rstinfo-table__address[^>]*>([\s\S]*?)<\/p>/) || [])[1];
  return { address: t ? text(t).slice(0, 200) : '' };
}
const isShopUrl = u => /^https:\/\/tabelog\.com\/(?:en\/)?[a-z_]+\/A\d+\/A\d+\/\d+\/?$/.test(String(u || ''));
module.exports = { buildUrl, parseList, parseDetail, isShopUrl, text };
