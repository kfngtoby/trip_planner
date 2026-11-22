'use strict';
/* Timezone helpers (modelled on TREK's destination clock / timezone widget).
   Everything is pure + uses Intl only, so it works offline and needs no key.
   A trip has: tz (destination IANA zone) and homeTz (where you live). */

const TZ_PRESETS = [
  ['Asia/Tokyo', 'Japan · Tokyo'], ['Asia/Hong_Kong', 'Hong Kong'], ['Asia/Seoul', 'Korea · Seoul'], ['Asia/Taipei', 'Taipei'],
  ['Asia/Shanghai', 'China · Shanghai'], ['Asia/Singapore', 'Singapore'], ['Asia/Bangkok', 'Bangkok'], ['Asia/Dubai', 'Dubai'],
  ['Europe/London', 'London'], ['Europe/Paris', 'Paris / Berlin / Rome'], ['Europe/Istanbul', 'Istanbul'],
  ['America/New_York', 'New York'], ['America/Chicago', 'Chicago'], ['America/Denver', 'Denver'], ['America/Los_Angeles', 'Los Angeles'],
  ['Australia/Sydney', 'Sydney'], ['Pacific/Auckland', 'Auckland'], ['UTC', 'UTC']
];

const tzValid = tz => { try { new Intl.DateTimeFormat('en', { timeZone: tz }); return !!tz; } catch { return false; } };
const deviceTz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };
const tripTz = tr => (tr && tzValid(tr.tz)) ? tr.tz : deviceTz();
const homeTz = tr => (tr && tzValid(tr.homeTz)) ? tr.homeTz : deviceTz();

// Wall-clock parts of an instant in a zone.
function tzParts(tz, date = new Date()) {
  const o = {};
  for (const p of new Intl.DateTimeFormat('en-CA', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(date))
    if (p.type !== 'literal') o[p.type] = Number(p.value);
  return o;
}
// Today's date (YYYY-MM-DD) as seen in a zone. The old todayIso() used UTC, which is wrong for Asia in the morning.
function todayIn(tz, date = new Date()) {
  const p = tzParts(tz, date);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
// Offset of a zone from UTC in minutes at a given instant (DST aware).
function tzOffsetMin(tz, date = new Date()) {
  const p = tzParts(tz, date);
  return Math.round((Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}
// "+1h" / "-8h" / "+5h 30m" / "same time": how far `to` is ahead of `from`.
function tzDiffLabel(from, to, date = new Date()) {
  const d = tzOffsetMin(to, date) - tzOffsetMin(from, date);
  if (!d) return 'same time';
  const a = Math.abs(d), h = Math.floor(a / 60), m = a % 60;
  return `${d > 0 ? '+' : '−'}${h}h${m ? ` ${m}m` : ''}`;
}
const tzClock = (tz, date = new Date()) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(date);
const tzShort = (tz, date = new Date()) => {
  try { return new Intl.DateTimeFormat('en', { timeZone: tz, timeZoneName: 'short' }).formatToParts(date).find(p => p.type === 'timeZoneName')?.value || tz; } catch { return tz; }
};
const tzCity = tz => String(tz || '').split('/').pop().replace(/_/g, ' ');
const tzLabel = tz => (TZ_PRESETS.find(p => p[0] === tz) || [0, tzCity(tz)])[1];

// Whole days from date a to date b (both YYYY-MM-DD), DST-proof.
const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);

// Where "now" falls in the trip, judged by the destination's own calendar.
function tripPhase(tr) {
  if (!tr.days.length) return null;
  const today = todayIn(tripTz(tr)), first = tr.days[0].date, last = tr.days[tr.days.length - 1].date;
  const idx = tr.days.findIndex(d => d.date === today);
  if (idx >= 0) return { kind: 'now', today, dayIndex: idx, dayId: tr.days[idx].id };
  if (today < first) return { kind: 'before', today, days: dayDiff(today, first) };
  if (today > last) return { kind: 'after', today, days: dayDiff(last, today) };
  return { kind: 'between', today };
}
const todayDay = tr => tr.days.find(d => d.date === todayIn(tripTz(tr)));

// Clock-time helpers for stops. A stop time like "09:00" or "21:00–22:00" is read as destination local time.
const timeMins = s => { const m = /(\d{1,2})[:：.](\d{2})/.exec(s || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
// Convert a stop's start time from the stop's zone (default destination) to the home zone on that date.
function homeEquivalent(tr, day, it) {
  const mins = timeMins(it.time); if (mins === null) return null;
  const from = tzValid(it.tz) ? it.tz : tripTz(tr), home = homeTz(tr);
  if (from === home) return null;
  const [y, m, d] = day.date.split('-').map(Number);
  // find the UTC instant whose wall clock in `from` is the requested date/time (two-pass for DST edges)
  let guess = Date.UTC(y, m - 1, d, Math.floor(mins / 60), mins % 60);
  guess -= tzOffsetMin(from, new Date(guess)) * 60000;
  guess = Date.UTC(y, m - 1, d, Math.floor(mins / 60), mins % 60) - tzOffsetMin(from, new Date(guess)) * 60000;
  const inst = new Date(guess), p = tzParts(home, inst);
  const dd = dayDiff(day.date, `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`);
  return { time: `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`, dayShift: dd, abbr: tzShort(home, inst) };
}
// Elapsed time between two stops whose clocks are in different zones (flights): returns minutes or null.
function elapsedMins(tr, day, a, b) {
  const ma = timeMins(a.time), mb = timeMins(b.time); if (ma === null || mb === null) return null;
  const za = tzValid(a.tz) ? a.tz : tripTz(tr), zb = tzValid(b.tz) ? b.tz : tripTz(tr);
  const base = new Date(day.date + 'T12:00:00Z');
  let diff = (mb - tzOffsetMin(zb, base)) - (ma - tzOffsetMin(za, base));
  if (diff < 0) diff += 1440;
  return diff;
}
const fmtMins = n => n < 60 ? `${n}m` : `${Math.floor(n / 60)}h${n % 60 ? ` ${n % 60}m` : ''}`;
