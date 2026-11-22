'use strict';
/* Currency conversion. This is the ONE place conversion lives.
   - Every expense stores `amount` in the TRIP currency (integer cents), so balances, split and settle-up never mix currencies.
   - An expense paid in another currency also stores `orig = {amount, cur, rate, date, manual}` (what the bill actually said).
   - Live rates: frankfurter.app (ECB data, no key). Last good rate is cached so it still works offline; the rate box is always editable.
   - Currencies the ECB doesn't publish (TWD, VND, MOP, AED…) need the rate typed in once; it is remembered. */

const FX_KEY = 'trip-companion-fx';
const FX_API = 'https://api.frankfurter.dev/v1/latest';
// [code, name, decimals, hasLiveRate]
const FX_LIST = [
  ['HKD', 'Hong Kong dollar', 2, 1], ['JPY', 'Japanese yen', 0, 1], ['CNY', 'Chinese yuan', 2, 1], ['TWD', 'New Taiwan dollar', 2, 0],
  ['KRW', 'South Korean won', 0, 1], ['USD', 'US dollar', 2, 1], ['EUR', 'Euro', 2, 1], ['GBP', 'British pound', 2, 1],
  ['SGD', 'Singapore dollar', 2, 1], ['THB', 'Thai baht', 2, 1], ['MYR', 'Malaysian ringgit', 2, 1], ['IDR', 'Indonesian rupiah', 0, 1],
  ['VND', 'Vietnamese dong', 0, 0], ['PHP', 'Philippine peso', 2, 1], ['INR', 'Indian rupee', 2, 1], ['AUD', 'Australian dollar', 2, 1],
  ['NZD', 'New Zealand dollar', 2, 1], ['CAD', 'Canadian dollar', 2, 1], ['CHF', 'Swiss franc', 2, 1], ['SEK', 'Swedish krona', 2, 1],
  ['NOK', 'Norwegian krone', 2, 1], ['DKK', 'Danish krone', 2, 1], ['CZK', 'Czech koruna', 2, 1], ['PLN', 'Polish zloty', 2, 1],
  ['TRY', 'Turkish lira', 2, 1], ['MXN', 'Mexican peso', 2, 1], ['BRL', 'Brazilian real', 2, 1], ['ZAR', 'South African rand', 2, 1],
  ['MOP', 'Macanese pataca', 2, 0], ['AED', 'UAE dirham', 2, 0]
];
const fxInfo = code => FX_LIST.find(c => c[0] === code);
const fxDecimals = code => fxInfo(code)?.[2] ?? 2;
const fxOptions = (selected, tripCur) => {
  const list = FX_LIST.slice();
  if (tripCur && !fxInfo(tripCur)) list.unshift([tripCur, tripCur, 2, 0]);
  if (selected && !list.some(c => c[0] === selected)) list.unshift([selected, selected, 2, 0]);
  return list.map(c => `<option value="${c[0]}" ${c[0] === selected ? 'selected' : ''}>${c[0]} · ${c[1]}</option>`).join('');
};

// THE conversion: bill amount (major units, e.g. 1200 yen) × rate (trip units per 1 bill unit) → trip-currency cents.
const fxToCents = (amount, rate) => (amount > 0 && rate > 0) ? Math.round(amount * rate * 100) : NaN;

const fxCache = () => { try { return JSON.parse(localStorage.getItem(FX_KEY) || '{}'); } catch { return {}; } };
const fxSave = (from, to, rate, date, manual) => {
  try { const c = fxCache(); c[from + '>' + to] = { rate, date, manual: !!manual }; localStorage.setItem(FX_KEY, JSON.stringify(c)); } catch {}
};
const fxLast = (from, to) => fxCache()[from + '>' + to] || null;

// Fetch today's rate. Resolves {rate, date, live:true} or null. Never throws.
async function fxLive(from, to) {
  if (from === to) return { rate: 1, date: '', live: true };
  if (!fxInfo(from)?.[3] || !fxInfo(to)?.[3]) return null;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(`${FX_API}?base=${from}&symbols=${to}`, { signal: ctl.signal });
    if (!res.ok) return null;
    const j = await res.json(), rate = j?.rates?.[to];
    if (!(rate > 0)) return null;
    fxSave(from, to, rate, j.date, false);
    return { rate, date: j.date, live: true };
  } catch { return null; } finally { clearTimeout(timer); }
}
