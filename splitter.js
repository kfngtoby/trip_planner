'use strict';
/* Expenses & cost split. Amounts are integer cents.
   expense = {id, name, amount, category, dayId, paid:{memberId:cents}, owed:{memberId:cents}, mode:'equal'|'exact'|'percent'|'shares', weights:{memberId:number}, created}
   trip.settlements = [{id, from, to, amount, created}]  (a recorded payment: `from` paid `to`) */

// Largest-remainder allocation: shares always sum to exactly `total` cents and nobody is off by more than 1 cent.
// weights are non-negative numbers (1 each = equal split, percentages, or share counts).
function allocate(total, ids, weights) {
  const out = {}; if (!ids.length || !Number.isFinite(total)) return out;
  const w = ids.map(id => Math.max(0, Math.round((Number(weights?.[id] ?? 1) || 0) * 100)));
  const W = w.reduce((a, b) => a + b, 0);
  if (!W) { ids.forEach(id => out[id] = NaN); return out; }
  const parts = ids.map((id, i) => ({ id, i, base: Math.floor(total * w[i] / W), rem: (total * w[i]) % W }));
  let left = total - parts.reduce((n, p) => n + p.base, 0);
  [...parts].sort((a, b) => b.rem - a.rem || a.i - b.i).forEach(p => { if (left > 0 && p.rem > 0) { p.base++; left--; } });
  parts.forEach(p => out[p.id] = p.base);
  return out;
}
const equalShares = (total, ids) => allocate(total, ids);
const MODES = ['equal', 'exact', 'percent', 'shares'];
function balances(tr) {
  const net = Object.fromEntries(tr.members.map(m => [m.id, 0]));
  for (const e of tr.expenses) {
    for (const [id, v] of Object.entries(e.paid || {})) net[id] = (net[id] || 0) + v;
    for (const [id, v] of Object.entries(e.owed || {})) net[id] = (net[id] || 0) - v;
  }
  for (const s of tr.settlements || []) { net[s.from] = (net[s.from] || 0) + s.amount; net[s.to] = (net[s.to] || 0) - s.amount; }
  return net; // cents, + means is owed money
}
function simplifyDebts(net) {
  const debtors = [], creditors = [];
  for (const [id, c] of Object.entries(net)) { if (c < 0) debtors.push({ id, c: -c }); else if (c > 0) creditors.push({ id, c }); }
  const tx = [];
  for (const d of debtors) { // exact one-to-one matches first
    const k = creditors.findIndex(c => c.c === d.c && c.c > 0);
    if (k >= 0 && d.c > 0) { tx.push({ from: d.id, to: creditors[k].id, amount: d.c }); d.c = 0; creditors[k].c = 0; }
  }
  debtors.splice(0, debtors.length, ...debtors.filter(d => d.c > 0)); creditors.splice(0, creditors.length, ...creditors.filter(c => c.c > 0));
  debtors.sort((a, b) => b.c - a.c); creditors.sort((a, b) => b.c - a.c);
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].c, creditors[j].c);
    tx.push({ from: debtors[i].id, to: creditors[j].id, amount: amt });
    debtors[i].c -= amt; creditors[j].c -= amt;
    if (!debtors[i].c) i++; if (!creditors[j].c) j++;
  }
  return tx;
}
const signed = c => `${c > 0 ? '+' : c < 0 ? '−' : ''}${money(Math.abs(c))}`;

function renderExpensesTab() {
  const tr = trip(), net = balances(tr);
  const dayIdx = id => tr.days.findIndex(d => d.id === id);
  const list = [...tr.expenses].sort((a, b) => (dayIdx(b.dayId) - dayIdx(a.dayId)) || (b.created || 0) - (a.created || 0));
  $('#view').innerHTML = `
    <section class="spend">
      <div class="spend-top"><span><small>Spent</small><b>${esc(tr.currency)} ${money(tripTotal(tr))}</b></span>
        <button id="settle" ${tr.expenses.length ? '' : 'disabled'}>Settle up</button></div>
      <ul class="bal-list">${tr.members.map(m => `<li><span class="user-text">${esc(m.name)}</span><b class="${net[m.id] > 0 ? 'positive' : net[m.id] < 0 ? 'negative' : ''}">${signed(net[m.id])}</b></li>`).join('')}</ul>
      <button id="members" class="text-btn">${t('Members')} (${tr.members.length})</button>
    </section>
    ${list.length ? `<ul class="exp-list">${list.map(e => {
      const di = dayIdx(e.dayId);
      const payers = Object.entries(e.paid).filter(([, v]) => v > 0).map(([id]) => memberName(tr, id)).join(' + ');
      return `<li><button class="exp-row" data-edit-expense="${esc(e.id)}">
        <i class="dot" style="--c:${di < 0 ? '#9aa0a8' : DAY_COLORS[di % DAY_COLORS.length]}"></i>
        <span class="exp-text"><strong class="user-text">${esc(e.name)}</strong>
          <small><span class="user-text">${esc(payers)}</span> <span>${t('paid')}</span> · <span>${esc(e.category)}</span>${di >= 0 ? ` · ${esc(fmtDate(tr.days[di].date, { day: 'numeric', month: 'short' }))}` : ''}</small></span>
        <b>${money(e.amount)}${e.orig ? `<small class="orig">${esc(e.orig.cur)} ${e.orig.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</small>` : ''}</b></button></li>`; }).join('')}</ul>`
    : `<p class="empty">No expenses</p>`}
    <div class="bottom-action above-tabs"><button class="primary wide" id="add-expense">Add expense</button></div>`;
  $('#add-expense').onclick = () => expenseForm();
  $('#members').onclick = membersSheet;
  $('#settle').onclick = settleSheet;
  $('.exp-list')?.addEventListener('click', e => { const b = e.target.closest('[data-edit-expense]'); if (b) expenseForm(b.dataset.editExpense); });
}

/* ---------- add / edit expense ---------- */
function expenseForm(id) {
  const tr = trip(), e = id && tr.expenses.find(x => x.id === id);
  const payers = e ? Object.keys(e.paid).filter(k => e.paid[k] > 0) : [tr.members[0]?.id];
  const draft = {
    multiple: payers.length > 1, payer: payers[0], payers: new Set(payers),
    paid: Object.fromEntries(Object.entries(e?.paid || {}).map(([k, v]) => [k, (v / 100).toFixed(2)])),
    included: new Set(e ? Object.keys(e.owed) : tr.members.map(m => m.id)),
    mode: e?.mode || 'equal',
    weights: Object.fromEntries(Object.entries(e?.weights || {}).map(([k, v]) => [k, String(v)])),
    owed: Object.fromEntries(Object.entries(e?.owed || {}).map(([k, v]) => [k, (v / 100).toFixed(2)]))
  };
  const today = tr.days.find(d => d.date === todayIso());
  const defDay = e ? e.dayId : (today?.id || '');
  const billCur = e?.orig?.cur || (!e && tr.lastBillCur) || tr.currency;   // new expenses start in the last currency used on this trip

  openSheet({
    title: e ? 'Edit expense' : 'Add expense', submit: 'Save',
    body: `
      ${e ? '' : receiptScanHtml()}
      <div class="amount-row"><label><span>${t('Bill currency')}</span><select name="billCur">${fxOptions(billCur, tr.currency)}</select></label>
        <label><span>${t('Amount')}</span><input name="billAmount" type="number" min="0" max="9999999999" step="${fxDecimals(billCur) === 0 ? 1 : '.01'}" inputmode="decimal" required value="${e ? (e.orig ? e.orig.amount : e.amount / 100) : ''}" placeholder="0.00"></label></div>
      <input type="hidden" name="amount" value="${e ? (e.amount / 100).toFixed(2) : ''}">
      <div class="fx-row" id="fx-row" hidden>
        <div class="fx-grid">
          <label><span>${t('Converted amount')} (<b id="fx-trip">${esc(tr.currency)}</b>)</span><output id="fx-cur" class="fx-out" aria-live="polite">—</output></label>
          <label><span>${t('Using FX rate')} · <b id="fx-label"></b></span><input name="fxRate" type="number" min="0" step="any" inputmode="decimal" aria-label="Exchange rate"></label>
        </div>
        <div class="fx-foot"><small id="fx-note" class="muted" role="status"></small>
          <button type="button" class="text-btn" id="fx-refresh">↻ ${t('Live rate')}</button></div></div>
      <label class="full"><span>${t('Title')}</span><input name="name" required maxlength="160" value="${esc(e?.name || '')}"></label>
      <div class="pair"><label>Category<select name="category">${EXPENSE_CATS.map(c => `<option value="${c}" ${c === (e?.category || 'Food') ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
        <label>Day<select name="dayId"><option value="">—</option>${tr.days.map((d, i) => `<option value="${esc(d.id)}" ${d.id === defDay ? 'selected' : ''}>Day ${i + 1} · ${esc(fmtDate(d.date))}</option>`).join('')}</select></label></div>
      <section class="split"><div class="split-head"><h3>Paid by</h3><label class="switch"><input type="checkbox" id="multi" ${draft.multiple ? 'checked' : ''}><span>Multiple</span></label></div>
        <div id="paid-pills" class="pills"></div><div id="paid-rows"></div><output id="paid-total"></output></section>
      <section class="split"><div class="split-head"><h3>Split between</h3><div class="segment">${MODES.map(m => `<button type="button" data-mode="${m}">${{ equal: 'Equal', exact: 'Exact', percent: 'Percent', shares: 'Shares' }[m]}</button>`).join('')}</div></div>
        <div id="owed-pills" class="pills"></div><div id="owed-rows"></div><output id="owed-total"></output></section>
      ${e ? `<button type="button" class="danger wide" id="del-exp">Delete expense</button>` : ''}`,
    onOpen: root => {
      const total = () => toCents(root.querySelector('[name=amount]').value);
      /* ---- currency: bill amount × rate -> trip-currency amount (hidden [name=amount]) ---- */
      const q = s => root.querySelector(s), curSel = q('[name=billCur]'), billIn = q('[name=billAmount]'), rateIn = q('[name=fxRate]'), hidden = q('[name=amount]');
      let fxDate = e?.orig?.date || '', fxManual = !!e?.orig?.manual, fxSeq = 0;
      const foreign = () => curSel.value !== tr.currency;
      const syncAmount = () => {
        const bill = parseFloat(billIn.value), rate = foreign() ? parseFloat(rateIn.value) : 1, c = fxToCents(bill, rate);
        hidden.value = Number.isFinite(c) ? (c / 100).toFixed(2) : '';
        q('#fx-cur').textContent = foreign() && Number.isFinite(c) ? money(c) : '—';
        outputs();
      };
      const setNote = (txt) => { q('#fx-note').textContent = txt; };
      const loadRate = async (forceLive) => {
        const from = curSel.value, my = ++fxSeq;
        if (from === tr.currency) return;
        const last = fxLast(from, tr.currency);
        if (!forceLive && !fxManual && !rateIn.value && last) { rateIn.value = +last.rate.toPrecision(6); fxDate = last.date; syncAmount(); }
        setNote(fxInfo(from)?.[3] ? 'Fetching today’s rate…' : 'No live rate for this currency, enter it.');
        const live = (forceLive || !fxManual) ? await fxLive(from, tr.currency) : null;
        if (my !== fxSeq) return;                                  // currency changed meanwhile
        if (live) { rateIn.value = +live.rate.toPrecision(6); fxDate = live.date; fxManual = false; setNote(`Live rate · ${live.date}`); }
        else if (rateIn.value) setNote(fxManual ? 'Your rate' : (last ? `Offline · last known rate${last.date ? ' ' + last.date : ''}` : 'Check the rate'));
        else setNote('Enter the exchange rate.');
        syncAmount();
      };
      const onCurrency = () => {
        const f = foreign(), c = curSel.value;
        q('#fx-row').hidden = !f;
        billIn.step = fxDecimals(c) === 0 ? 1 : '.01';
        if (f) {
          q('#fx-label').textContent = `1 ${c} =`;
          const keep = e?.orig && e.orig.cur === c && !rateIn.dataset.touched;
          rateIn.value = keep ? e.orig.rate : (fxLast(c, tr.currency)?.rate ? +fxLast(c, tr.currency).rate.toPrecision(6) : '');
          fxManual = keep ? !!e.orig.manual : false;
          if (keep) { setNote(fxManual ? 'Your rate' : `Rate saved with this expense${e.orig.date ? ' · ' + e.orig.date : ''}`); syncAmount(); }
          else loadRate(false);
        } else { fxSeq++; syncAmount(); }
      };
      curSel.onchange = () => { rateIn.dataset.touched = '1'; onCurrency(); };
      billIn.addEventListener('input', syncAmount);
      rateIn.addEventListener('input', () => { fxManual = true; rateIn.dataset.touched = '1'; const v = parseFloat(rateIn.value); if (v > 0) fxSave(curSel.value, tr.currency, v, fxDate, true); setNote('Your rate'); syncAmount(); });
      q('#fx-refresh').onclick = () => loadRate(true);
      const shares = () => {
        const ids = tr.members.filter(m => draft.included.has(m.id)).map(m => m.id);
        if (draft.mode === 'exact') return Object.fromEntries(ids.map(id => [id, toCents(draft.owed[id] || '0')]));
        if (draft.mode === 'equal') return equalShares(total(), ids);
        return allocate(total(), ids, Object.fromEntries(ids.map(id => [id, draft.weights[id] ?? (draft.mode === 'shares' ? 1 : 0)])));
      };
      const outputs = () => {
        const T = total(), sh = shares();
        root.querySelectorAll('[data-inc] small').forEach(s => { const v = sh[s.parentElement.dataset.inc]; s.textContent = Number.isFinite(v) ? money(v) : '—'; });
        const paidSum = [...draft.payers].reduce((n, id) => n + (toCents(draft.paid[id] || '0') || 0), 0);
        const owedSum = Object.values(sh).reduce((n, v) => n + (v || 0), 0);
        const fmt = (a, warn) => `<span class="${warn ? 'negative' : ''}">${money(a)} / ${Number.isFinite(T) ? money(T) : '0.00'}</span>`;
        root.querySelector('#paid-total').innerHTML = draft.multiple ? fmt(paidSum, paidSum !== T) : '';
        const wsum = [...draft.included].reduce((n, id) => n + (Number(draft.weights[id]) || 0), 0);
        root.querySelector('#owed-total').innerHTML = draft.mode === 'exact' ? fmt(owedSum, owedSum !== T)
          : draft.mode === 'percent' ? `<span class="${Math.abs(wsum - 100) > .005 ? 'negative' : ''}">${+wsum.toFixed(2)}% / 100%</span>` : '';
      };
      const render = () => {
        root.querySelector('#paid-pills').innerHTML = tr.members.map(m => `<button type="button" data-pay="${esc(m.id)}" aria-pressed="${draft.multiple ? draft.payers.has(m.id) : draft.payer === m.id}" class="user-text">${esc(m.name)}</button>`).join('');
        root.querySelector('#paid-rows').innerHTML = draft.multiple ? tr.members.filter(m => draft.payers.has(m.id)).map(m => `<label class="amt-row"><span class="user-text">${esc(m.name)}</span><input data-paid="${esc(m.id)}" type="number" min="0" step=".01" inputmode="decimal" value="${esc(draft.paid[m.id] || '')}" aria-label="Paid amount"></label>`).join('') : '';
        root.querySelector('#owed-pills').innerHTML = tr.members.map(m => `<button type="button" data-inc="${esc(m.id)}" aria-pressed="${draft.included.has(m.id)}"><span class="user-text">${esc(m.name)}</span><small></small></button>`).join('');
        root.querySelector('#owed-rows').innerHTML = draft.mode === 'exact' ? tr.members.filter(m => draft.included.has(m.id)).map(m => `<label class="amt-row"><span class="user-text">${esc(m.name)}</span><input data-owed="${esc(m.id)}" type="number" min="0" step=".01" inputmode="decimal" value="${esc(draft.owed[m.id] || '')}" aria-label="Share amount"></label>`).join('') : '';
        if (draft.mode === 'percent' || draft.mode === 'shares') root.querySelector('#owed-rows').innerHTML = tr.members.filter(m => draft.included.has(m.id)).map(m => `<label class="amt-row"><span class="user-text">${esc(m.name)}</span><input data-weight="${esc(m.id)}" type="number" min="0" step="${draft.mode === 'percent' ? '.01' : '.5'}" inputmode="decimal" value="${esc(draft.weights[m.id] ?? (draft.mode === 'shares' ? '1' : ''))}" aria-label="${draft.mode === 'percent' ? '%' : 'Shares'}"></label>`).join('');
        root.querySelectorAll('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === draft.mode)));
        outputs();
      };
      root.onclick = ev => {
        const pay = ev.target.closest('[data-pay]'), inc = ev.target.closest('[data-inc]'), mode = ev.target.closest('[data-mode]');
        if (pay) { const pid = pay.dataset.pay; if (draft.multiple) draft.payers.has(pid) ? draft.payers.delete(pid) : draft.payers.add(pid); else { draft.payer = pid; draft.payers = new Set([pid]); } render(); }
        if (inc) { const mid = inc.dataset.inc; draft.included.has(mid) ? draft.included.delete(mid) : draft.included.add(mid); render(); }
        if (mode) {
          draft.mode = mode.dataset.mode;
          if (draft.mode === 'percent') { const ids = tr.members.filter(m => draft.included.has(m.id)).map(m => m.id); ids.forEach((id, i) => { if (draft.weights[id] === undefined || draft.mode === 'percent' && Number(draft.weights[id]) > 100) draft.weights[id] = String(+(100 / ids.length).toFixed(2)); }); }
          if (draft.mode === 'exact') { const eq = equalShares(total(), tr.members.filter(m => draft.included.has(m.id)).map(m => m.id)); for (const [k, v] of Object.entries(eq)) if (!draft.owed[k]) draft.owed[k] = (v / 100).toFixed(2); }
          render();
        }
      };
      root.oninput = ev => {
        if (ev.target.dataset.paid) draft.paid[ev.target.dataset.paid] = ev.target.value;
        else if (ev.target.dataset.owed) draft.owed[ev.target.dataset.owed] = ev.target.value;
        else if (ev.target.dataset.weight) draft.weights[ev.target.dataset.weight] = ev.target.value;
        outputs();
      };
      root.querySelector('#multi').onchange = ev => {
        draft.multiple = ev.target.checked;
        if (draft.multiple) { draft.payers.add(draft.payer); if (!Object.keys(draft.paid).length && total() > 0) draft.paid[draft.payer] = (total() / 100).toFixed(2); }
        else draft.payers = new Set([draft.payer]);
        render();
      };
      root.querySelector('#del-exp')?.addEventListener('click', () => {
        if (!confirm(`${t('Delete expense')}: “${e.name}”?`)) return;
        tr.expenses = tr.expenses.filter(x => x !== e); saveDb(); closeSheet(); renderExpensesTab();
      });
      root._shares = shares; root._total = total; root._fxDate = () => fxDate; root._fxManual = () => fxManual;
      if (!e) initReceiptScan(root, tr);
      render();
      onCurrency();
      if (!e) billIn.focus();
    },
    onSubmit: f => {
      const root = $('#sheet-body'), T = root._total(), foreignRate = () => f.get('billCur') !== tr.currency && !(parseFloat(f.get('fxRate')) > 0);
      if (!Number.isFinite(T) || T <= 0) return sheetError(foreignRate() ? 'Enter the exchange rate.' : 'Enter a positive amount.');
      const name = f.get('name').trim(); if (!name) return sheetError('A name is required.');
      const paid = draft.multiple ? Object.fromEntries([...draft.payers].map(id => [id, toCents(draft.paid[id] || '0')])) : { [draft.payer]: T };
      const owed = root._shares();
      if (draft.mode === 'percent') { const ws = [...draft.included].reduce((n, id) => n + (Number(draft.weights[id]) || 0), 0); if (Math.abs(ws - 100) > .005) return sheetError('Percentages must add up to 100.'); }
      if ((draft.mode === 'percent' || draft.mode === 'shares') && Object.values(owed).some(v => !Number.isFinite(v))) return sheetError('Enter a value for at least one member.');
      if (!Object.keys(owed).length || !Object.keys(paid).length || !draft.payer) return sheetError('Select at least one member.');
      for (const v of [paid, owed]) if (Object.values(v).some(x => !Number.isFinite(x) || x < 0) || Object.values(v).reduce((n, x) => n + x, 0) !== T)
        return sheetError('Member amounts must match the expense total.');
      const cur = f.get('billCur'), rec = { name, amount: T, category: f.get('category'), dayId: f.get('dayId'), paid, owed, mode: draft.mode };
      if (cur !== tr.currency) rec.orig = { amount: parseFloat(f.get('billAmount')), cur, rate: parseFloat(f.get('fxRate')), date: root._fxDate(), manual: root._fxManual() };
      else if (e) delete e.orig;
      tr.lastBillCur = cur;
      if (draft.mode === 'percent' || draft.mode === 'shares') rec.weights = Object.fromEntries(Object.keys(owed).map(id => [id, Number(draft.weights[id] ?? 1)])); else delete rec.weights;
      if (e && rec.weights === undefined) delete e.weights;
      if (e) Object.assign(e, rec); else tr.expenses.push({ id: uid('e'), created: Date.now(), ...rec });
      saveDb(); closeSheet(); renderExpensesTab(); toast('Saved');
      if (!e && typeof rcContinue === 'function') rcContinue();   // more receipts queued from a multi-photo scan: open the next one
    }
  });
}

/* ---------- members ---------- */
// What removing a member would do. Equal splits they only share in are recalculated
// among the others; expenses they paid for, or exact splits, must be edited first.
function removalImpact(tr, mid) {
  const blockers = [], resplit = [];
  for (const e of tr.expenses) {
    const inPaid = (e.paid[mid] || 0) > 0, inOwed = mid in e.owed;
    if (!inPaid && !inOwed) continue;
    if (inPaid || (e.mode || 'equal') !== 'equal' || Object.keys(e.owed).length === 1) blockers.push(e); else resplit.push(e);
  }
  for (const st of tr.settlements || []) if (st.from === mid || st.to === mid) blockers.push({ name: t('Payment'), amount: st.amount });
  return { blockers, resplit };
}

function membersSheet() {
  const tr = trip();
  openSheet({
    title: 'Members', submit: null,
    body: `<ul class="member-list">${tr.members.map(m => `<li><input data-member-name="${esc(m.id)}" value="${esc(m.name)}" maxlength="40" aria-label="Member name">
        <button type="button" class="danger" data-remove-member="${esc(m.id)}" ${tr.members.length < 2 ? 'disabled' : ''}>Remove</button></li>`).join('')}</ul>
      <div class="row"><input id="new-member" maxlength="40" placeholder="New member" aria-label="New member"><button type="button" class="primary" id="add-member">Add member</button></div>
      <p id="member-msg" class="hint"></p>`,
    onOpen: root => {
      const add = () => {
        const name = root.querySelector('#new-member').value.trim();
        if (!name) return sheetError('Enter a member name (1–40 characters).');
        if (tr.members.length >= 30) return sheetError('Maximum 30 members.');
        tr.members.push({ id: uid('m'), name }); saveDb(); membersSheet(); renderExpensesTab();
      };
      root.querySelector('#add-member').onclick = add;
      root.querySelector('#new-member').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
      // rename saves as you leave the field
      root.onchange = e => {
        const mid = e.target.dataset.memberName; if (!mid) return;
        const v = e.target.value.trim(); const m = tr.members.find(x => x.id === mid);
        if (!v) { e.target.value = m.name; return sheetError('Enter a member name (1–40 characters).'); }
        m.name = v; saveDb(); renderExpensesTab(); toast('Saved');
      };
      root.onclick = e => {
        const b = e.target.closest('[data-remove-member]'); if (!b) return;
        const mid = b.dataset.removeMember, m = tr.members.find(x => x.id === mid);
        const { blockers, resplit } = removalImpact(tr, mid);
        if (blockers.length) {
          root.querySelector('#member-msg').innerHTML = `<b class="user-text">${esc(m.name)}</b> ${t('is a payer or has a fixed share in these expenses. Edit them first, then remove:')}<br>${blockers.map(x => `• <span class="user-text">${esc(x.name)}</span> (${money(x.amount)})`).join('<br>')}`;
          return;
        }
        if (!confirm(`${t('Remove')} ${m.name}?` + (resplit.length ? `\n${resplit.length} × ${t('Equal')} → ${t('recalculated')}` : ''))) return;
        for (const x of resplit) {
          const ids = Object.keys(x.owed).filter(k => k !== mid);
          x.owed = equalShares(x.amount, tr.members.filter(mm => ids.includes(mm.id)).map(mm => mm.id));
        }
        for (const x of tr.expenses) delete x.paid[mid]; // zero entries only at this point
        tr.members = tr.members.filter(x => x.id !== mid);
        saveDb(); membersSheet(); renderExpensesTab(); toast('Deleted');
      };
    }
  });
}

/* ---------- settle up ---------- */
// Per-person totals: what each member paid, what they consumed, and the resulting balance.
function memberSummary(tr) {
  const net = balances(tr);
  return tr.members.map(m => ({
    id: m.id, name: m.name, net: net[m.id] || 0,
    paid: tr.expenses.reduce((n, e) => n + (e.paid[m.id] || 0), 0),
    share: tr.expenses.reduce((n, e) => n + (e.owed[m.id] || 0), 0)
  }));
}
const csvCell = v => { const x = String(v ?? ''); return /[",\n]/.test(x) || /^[=+\-@]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
function exportCostsCsv() {
  const tr = trip(), dayIdx = id => tr.days.findIndex(d => d.id === id);
  const head = ['Date', 'Title', 'Category', 'Amount', 'Currency', 'Original amount', 'Original currency', 'Rate', 'Split', ...tr.members.map(m => `Paid: ${m.name}`), ...tr.members.map(m => `Share: ${m.name}`)];
  const rows = [...tr.expenses].sort((a, b) => (a.created || 0) - (b.created || 0)).map(e => {
    const di = dayIdx(e.dayId);
    return [di >= 0 ? tr.days[di].date : '', e.name, e.category, (e.amount / 100).toFixed(2), tr.currency, e.orig ? e.orig.amount : '', e.orig ? e.orig.cur : '', e.orig ? e.orig.rate : '', e.mode || 'equal',
      ...tr.members.map(m => ((e.paid[m.id] || 0) / 100).toFixed(2)), ...tr.members.map(m => ((e.owed[m.id] || 0) / 100).toFixed(2))];
  });
  for (const st of tr.settlements || []) rows.push([new Date(st.created).toISOString().slice(0, 10), `Payment: ${memberName(tr, st.from)} → ${memberName(tr, st.to)}`, 'Settlement', (st.amount / 100).toFixed(2), tr.currency, '', '', '', 'payment', ...tr.members.map(() => ''), ...tr.members.map(() => '')]);
  download(`${slug(tr.name)}-costs.csv`, '\ufeff' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
}
function settleSheet() {
  const tr = trip(), net = balances(tr), tx = simplifyDebts(net), sum = memberSummary(tr), log = tr.settlements || [];
  openSheet({
    title: 'Settle up', submit: null,
    body: `<h3>Summary</h3><table class="sum-table"><thead><tr><th></th><th>${t('Paid')}</th><th>${t('Share')}</th><th>${t('Balance')}</th></tr></thead><tbody>${sum.map(r => `<tr><td class="user-text">${esc(r.name)}</td><td>${money(r.paid)}</td><td>${money(r.share)}</td><td><b class="${r.net > 0 ? 'positive' : r.net < 0 ? 'negative' : ''}">${signed(r.net)}</b></td></tr>`).join('')}</tbody></table>
      <h3>Transfers</h3>${tx.length ? `<ul class="bal-list big">${tx.map((x, i) => `<li><span><span class="user-text">${esc(memberName(tr, x.from))}</span> → <span class="user-text">${esc(memberName(tr, x.to))}</span></span>
        <span><b>${esc(tr.currency)} ${money(x.amount)}</b> <button type="button" class="text-btn" data-pay="${i}">${t('Mark paid')}</button></span></li>`).join('')}</ul>` : `<p class="muted">All settled</p>`}
      ${log.length ? `<h3>${t('Payments')}</h3><ul class="bal-list">${[...log].reverse().map(x => `<li><span><span class="user-text">${esc(memberName(tr, x.from))}</span> → <span class="user-text">${esc(memberName(tr, x.to))}</span> · ${esc(fmtDate(new Date(x.created).toISOString().slice(0, 10), { day: 'numeric', month: 'short' }))}</span>
        <span><b>${money(x.amount)}</b> <button type="button" class="text-btn" data-undo="${esc(x.id)}">${t('Undo')}</button></span></li>`).join('')}</ul>` : ''}
      <button type="button" class="text-btn" id="csv" ${tr.expenses.length ? '' : 'disabled'}>${t('Export CSV')}</button>`,
    onOpen: root => {
      root.querySelector('#csv').onclick = exportCostsCsv;
      root.onclick = ev => {
        const p = ev.target.closest('[data-pay]'), u = ev.target.closest('[data-undo]');
        if (p) { const x = tx[Number(p.dataset.pay)]; (tr.settlements ||= []).push({ id: uid('s'), from: x.from, to: x.to, amount: x.amount, created: Date.now() }); }
        else if (u) tr.settlements = (tr.settlements || []).filter(x => x.id !== u.dataset.undo);
        else return;
        saveDb(); settleSheet(); renderExpensesTab(); toast('Saved');
      };
    }
  });
}
