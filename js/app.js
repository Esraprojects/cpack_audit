/* Free Esra ledger — UI wiring. */
(function () {
  'use strict';
  var E = window.Esra;
  var S = E.store, U = E.util, esc = E.charts.esc;
  var OWNER_HASH = '61005123c3157ff8408968cf031c7df12c056cb5da93da32c4f7cb89360e0277';
  var OWNER_FLAG = 'freeEsra.owner';
  var OTHER = '__other';

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function today() { return U.isoDate(new Date()); }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }
  function saved(msg) {
    toast(S.storageOk ? msg : 'Could not save in this browser — download a backup now!');
  }

  // ---------------- tabs ----------------
  var current = 'income';
  function showTab(name) {
    if (['income', 'payment', 'owner'].indexOf(name) === -1) name = 'income';
    current = name;
    $all('.tab').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === name)); });
    $all('.panel').forEach(function (p) { p.hidden = p.id !== 'tab-' + name; });
    if (name === 'owner') initOwner();
    if (location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  }
  $all('.tab').forEach(function (b) { b.addEventListener('click', function () { showTab(b.dataset.tab); }); });
  window.addEventListener('hashchange', function () { showTab(location.hash.slice(1)); });

  // ---------------- shared inputs ----------------
  function fillMaterialSelects() {
    var custom = S.db.memory.customMaterials;
    $all('select[data-material-select]').forEach(function (sel) {
      var val = sel.value;
      var html = '<option value="">Choose material…</option>';
      E.MATERIAL_GROUPS.forEach(function (g) {
        html += '<optgroup label="' + esc(g.label) + '">' + g.items.map(function (m) {
          return '<option value="' + esc(m) + '">' + esc(m) + '</option>';
        }).join('') + '</optgroup>';
      });
      if (custom.length) {
        html += '<optgroup label="Added by you">' + custom.map(function (m) {
          return '<option value="' + esc(m) + '">' + esc(m) + '</option>';
        }).join('') + '</optgroup>';
      }
      html += '<option value="' + OTHER + '">+ Other (type new)…</option>';
      sel.innerHTML = html;
      sel.value = val;
    });
  }

  function fillDatalists() {
    var map = { 'dl-gsm': 'gsm', 'dl-qty': 'qty', 'dl-cost': 'cost', 'dl-price': 'price', 'dl-pay': 'pay', 'dl-phone': 'phone', 'dl-notes': 'notes' };
    Object.keys(map).forEach(function (id) {
      $('#' + id).innerHTML = S.suggestions(map[id]).map(function (v) { return '<option value="' + esc(v) + '"></option>'; }).join('');
    });
  }

  function buildChips(form) {
    $all('[data-chip-group]', form).forEach(function (box) {
      var group = box.dataset.chipGroup;
      var values = group === 'size' ? E.SIZES : E.PRINT_TYPES;
      box.innerHTML = values.map(function (v) {
        return '<button type="button" class="chip" aria-pressed="false" data-value="' + esc(v) + '">' + esc(v) + '</button>';
      }).join('');
      box.addEventListener('click', function (e) {
        var btn = e.target.closest('.chip');
        if (!btn) return;
        var on = btn.getAttribute('aria-pressed') !== 'true';
        setChip(form, group, on ? btn.dataset.value : '');
        form.dispatchEvent(new Event('input'));
      });
    });
  }
  function getChip(form, group) {
    var b = $('[data-chip-group="' + group + '"] .chip[aria-pressed="true"]', form);
    return b ? b.dataset.value : '';
  }
  function setChip(form, group, value) {
    $all('[data-chip-group="' + group + '"] .chip', form).forEach(function (b) {
      b.setAttribute('aria-pressed', String(!!value && b.dataset.value.toLowerCase() === String(value).toLowerCase()));
    });
  }

  function materialValue(form) {
    var sel = form.elements.material;
    if (sel.value === OTHER) return form.elements.materialOther.value.trim();
    return sel.value;
  }
  function setMaterial(form, value) {
    var sel = form.elements.material;
    var exists = $all('option', sel).some(function (o) { return o.value === value; });
    if (!exists && value) {
      sel.value = OTHER;
      form.elements.materialOther.hidden = false;
      form.elements.materialOther.value = value;
    } else {
      sel.value = value || '';
      form.elements.materialOther.hidden = true;
      form.elements.materialOther.value = '';
    }
  }

  // Fill a field from memory; only touches empty or previously auto-filled fields.
  function autofill(input, value, force) {
    if (value === undefined || value === null || value === '' || value === 0) return;
    if (!force && input.value !== '' && input.dataset.auto !== '1') return;
    input.value = value;
    input.dataset.auto = '1';
    input.classList.add('autofilled');
    setTimeout(function () { input.classList.remove('autofilled'); }, 1200);
  }
  function markManual(form) {
    form.addEventListener('input', function (e) {
      if (e.target && e.target.dataset) e.target.dataset.auto = '';
    });
  }

  // ---------------- income form ----------------
  var inc = $('#income-form');
  var priceMode = S.db.memory.priceMode || 'unit';
  var editingIncome = null;

  function setPriceMode(mode) {
    priceMode = mode;
    $all('[data-price-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.priceMode === mode)); });
    var per = mode === 'unit' ? 'Birr per unit' : 'Birr for whole order';
    $('[data-label-cost]').textContent = 'Initial cost (' + per + ')';
    $('[data-label-price]').textContent = 'Selling price (' + per + ')';
    recalcIncome();
  }
  $all('[data-price-mode]').forEach(function (b) { b.addEventListener('click', function () { setPriceMode(b.dataset.priceMode); }); });

  function incomeValues() {
    var f = inc.elements;
    return {
      date: f.date.value,
      material: materialValue(inc),
      gsm: f.gsm.value,
      size: getChip(inc, 'size'),
      printType: getChip(inc, 'printType'),
      qty: f.qty.value,
      initialCost: f.initialCost.value,
      sellingPrice: f.sellingPrice.value,
      total: f.total.dataset.manual === '1' ? f.total.value : '',
      paid: f.paid.value,
      phone: f.phone.value,
      notes: f.notes.value
    };
  }

  function recalcIncome() {
    var f = inc.elements;
    var rec = S.buildIncome(incomeValues(), priceMode);
    if (f.total.dataset.manual !== '1') f.total.value = rec.total ? rec.total : '';
    f.remaining.value = U.birr(rec.remaining);
    var pv = $('#income-preview');
    if (!rec.total && !rec.totalCost) { pv.innerHTML = ''; return; }
    var margin = rec.total ? (rec.profit / rec.total) * 100 : NaN;
    pv.innerHTML =
      '<span>Total cost: <b>' + U.birr(rec.totalCost) + '</b></span>' +
      '<span>Total to pay: <b>' + U.birr(rec.total) + '</b></span>' +
      '<span>Profit: <b class="' + (rec.profit < 0 ? 'neg' : 'pos') + '">' + U.birr(rec.profit) + '</b>' + (isFinite(margin) ? ' (' + U.pct(margin) + ')' : '') + '</span>' +
      (num(f.paid.value) > rec.total && rec.total ? '<span class="neg">Paid is more than the total.</span>' : '');
  }
  function num(v) { return U.num(v); }

  inc.elements.total.addEventListener('input', function () {
    this.dataset.manual = this.value === '' ? '' : '1';
    $('#total-hint').textContent = this.dataset.manual ? 'Typed by hand. Clear it to calculate again.' : 'Calculated automatically — you can type over it.';
  });
  inc.addEventListener('input', recalcIncome);

  inc.elements.material.addEventListener('change', function () {
    var other = this.value === OTHER;
    inc.elements.materialOther.hidden = !other;
    if (other) { inc.elements.materialOther.focus(); return; }
    if (editingIncome) return;
    applyIncomeMemory(S.lastFor('income', this.value));
  });

  function applyIncomeMemory(last, force) {
    if (!last) return;
    var f = inc.elements;
    autofill(f.gsm, last.gsm, force);
    if (last.size && (force || !getChip(inc, 'size'))) setChip(inc, 'size', last.size);
    if (last.printType && (force || !getChip(inc, 'printType'))) setChip(inc, 'printType', last.printType);
    if (last.priceMode && last.priceMode !== priceMode) setPriceMode(last.priceMode);
    autofill(f.initialCost, last.initialCost, force);
    autofill(f.sellingPrice, last.sellingPrice, force);
    recalcIncome();
  }

  function resetIncome() {
    var keepDate = inc.elements.date.value || today();
    inc.reset();
    editingIncome = null;
    inc.elements.id.value = '';
    inc.elements.date.value = keepDate;
    inc.elements.total.dataset.manual = '';
    $all('input', inc).forEach(function (i) { i.dataset.auto = ''; });
    setMaterial(inc, '');
    setChip(inc, 'size', '');
    setChip(inc, 'printType', '');
    $('#income-form-title').textContent = 'New income';
    $('#income-done').textContent = 'Done';
    $('#income-cancel').hidden = true;
    $('#total-hint').textContent = 'Calculated automatically — you can type over it.';
    recalcIncome();
  }

  function loadIncome(rec) {
    resetIncome();
    editingIncome = rec;
    var f = inc.elements;
    f.id.value = rec.id;
    f.date.value = rec.date;
    setMaterial(inc, rec.material);
    f.gsm.value = rec.gsm;
    setChip(inc, 'size', rec.size);
    setChip(inc, 'printType', rec.printType);
    f.qty.value = rec.qty || '';
    setPriceMode(rec.priceMode || 'unit');
    f.initialCost.value = rec.initialCost || '';
    f.sellingPrice.value = rec.sellingPrice || '';
    var auto = S.buildIncome(Object.assign({}, rec, { total: '' }), rec.priceMode).total;
    if (Math.abs(auto - rec.total) > 0.005) { f.total.dataset.manual = '1'; f.total.value = rec.total; }
    f.paid.value = rec.paid || '';
    f.phone.value = rec.phone;
    f.notes.value = rec.notes;
    $('#income-form-title').textContent = 'Edit income from ' + U.prettyDate(rec.date);
    $('#income-done').textContent = 'Update';
    $('#income-cancel').hidden = false;
    recalcIncome();
    showTab('income');
    inc.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  inc.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = incomeValues();
    if (!v.date) return toast('Choose a date.');
    if (!v.material) return toast('Choose a material.');
    var rec = S.buildIncome(v, priceMode);
    if (!rec.total) return toast('Enter the amount and selling price (or the total).');
    if (rec.paid > rec.total) return toast('Paid cannot be more than the total.');
    var isEdit = !!editingIncome;
    S.saveIncome(v, priceMode, inc.elements.id.value || null);
    saved(isEdit ? 'Income updated ✓' : 'Income saved ✓  ' + U.birr(rec.total));
    resetIncome();
    refreshAll();
  });
  $('#income-clear').addEventListener('click', resetIncome);
  $('#income-cancel').addEventListener('click', resetIncome);
  markManual(inc);

  // ---------------- payment form ----------------
  var pay = $('#payment-form');
  var editingPayment = null;

  function paymentValues() {
    var f = pay.elements;
    return {
      date: f.date.value,
      material: materialValue(pay),
      gsm: f.gsm.value,
      size: getChip(pay, 'size'),
      type: getChip(pay, 'type'),
      qty: f.qty.value,
      amount: f.amount.value,
      phone: f.phone.value,
      notes: f.notes.value
    };
  }

  pay.elements.material.addEventListener('change', function () {
    var other = this.value === OTHER;
    pay.elements.materialOther.hidden = !other;
    if (other) { pay.elements.materialOther.focus(); return; }
    if (editingPayment) return;
    applyPaymentMemory(S.lastFor('payment', this.value));
  });

  function applyPaymentMemory(last, force) {
    if (!last) return;
    var f = pay.elements;
    autofill(f.gsm, last.gsm, force);
    if (last.size && (force || !getChip(pay, 'size'))) setChip(pay, 'size', last.size);
    if (last.type && (force || !getChip(pay, 'type'))) setChip(pay, 'type', last.type);
    autofill(f.qty, last.qty, force);
    autofill(f.amount, last.amount, force);
    autofill(f.phone, last.phone, force);
  }

  function resetPayment() {
    var keepDate = pay.elements.date.value || today();
    pay.reset();
    editingPayment = null;
    pay.elements.id.value = '';
    pay.elements.date.value = keepDate;
    $all('input', pay).forEach(function (i) { i.dataset.auto = ''; });
    setMaterial(pay, '');
    setChip(pay, 'size', '');
    setChip(pay, 'type', '');
    $('#payment-form-title').textContent = 'New payment (cost)';
    $('#payment-done').textContent = 'Done';
    $('#payment-cancel').hidden = true;
  }

  function loadPayment(rec) {
    resetPayment();
    editingPayment = rec;
    var f = pay.elements;
    f.id.value = rec.id;
    f.date.value = rec.date;
    setMaterial(pay, rec.material);
    f.gsm.value = rec.gsm;
    setChip(pay, 'size', rec.size);
    setChip(pay, 'type', rec.type);
    f.qty.value = rec.qty || '';
    f.amount.value = rec.amount;
    f.phone.value = rec.phone;
    f.notes.value = rec.notes;
    $('#payment-form-title').textContent = 'Edit payment from ' + U.prettyDate(rec.date);
    $('#payment-done').textContent = 'Update';
    $('#payment-cancel').hidden = false;
    showTab('payment');
    pay.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  pay.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = paymentValues();
    if (!v.date) return toast('Choose a date.');
    if (!v.material) return toast('Choose a material or item.');
    if (!(num(v.amount) > 0)) return toast('Enter the amount paid.');
    var isEdit = !!editingPayment;
    S.savePayment(v, pay.elements.id.value || null);
    saved(isEdit ? 'Payment updated ✓' : 'Payment saved ✓  ' + U.birr(v.amount));
    resetPayment();
    refreshAll();
  });
  $('#payment-clear').addEventListener('click', resetPayment);
  $('#payment-cancel').addEventListener('click', resetPayment);
  markManual(pay);

  // ---------------- quick fill (repeat recent entries) ----------------
  function renderQuickFill(kind) {
    var list = (kind === 'income' ? S.db.income : S.db.payments).slice()
      .sort(function (a, b) { return (b.updatedAt || '').localeCompare(a.updatedAt || ''); });
    var seen = {}, picks = [];
    list.forEach(function (r) {
      var key = [r.material, r.gsm, r.size, kind === 'income' ? r.printType : r.type].join('|').toLowerCase();
      if (seen[key] || picks.length >= 6) return;
      seen[key] = true; picks.push(r);
    });
    var wrap = $('#' + kind + '-quickfill');
    var box = $('#' + kind + '-quickfill-chips');
    wrap.hidden = !picks.length;
    box.innerHTML = picks.map(function (r, i) {
      var bits = [r.material, r.gsm ? r.gsm + 'gsm' : '', r.size, kind === 'income' ? r.printType : r.type].filter(Boolean).join(' · ');
      return '<button type="button" class="chip qf" data-i="' + i + '">' + esc(bits) + '</button>';
    }).join('');
    box.onclick = function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      var r = picks[+b.dataset.i];
      if (kind === 'income') {
        if (editingIncome) resetIncome();
        setMaterial(inc, r.material);
        setChip(inc, 'size', ''); setChip(inc, 'printType', '');
        applyIncomeMemory({ gsm: r.gsm, size: r.size, printType: r.printType, initialCost: r.initialCost, sellingPrice: r.sellingPrice, priceMode: r.priceMode }, true);
        inc.elements.qty.focus();
      } else {
        if (editingPayment) resetPayment();
        setMaterial(pay, r.material);
        setChip(pay, 'size', ''); setChip(pay, 'type', '');
        applyPaymentMemory({ gsm: r.gsm, size: r.size, type: r.type, qty: r.qty, amount: r.amount, phone: r.phone }, true);
        pay.elements.amount.focus();
      }
    };
  }

  // ---------------- tables ----------------
  function td(v, cls) { return '<td' + (cls ? ' class="' + cls + '"' : '') + '>' + esc(v === undefined || v === null ? '' : v) + '</td>'; }
  function money(v) { return U.birr(v).replace(' Br', ''); }

  function incomeTable(rows, opts) {
    if (!rows.length) return '<p class="empty">No income records yet.</p>';
    var t = { qty: 0, totalCost: 0, total: 0, paid: 0, remaining: 0, profit: 0 };
    var body = rows.map(function (r) {
      Object.keys(t).forEach(function (k) { t[k] += num(r[k]); });
      return '<tr>' + incomeActions(r, opts) + td(U.prettyDate(r.date)) + td(r.material) + td(r.gsm) + td(r.size) + td(r.printType) +
        td(r.qty, 'num') + td(money(r.totalCost), 'num') + td(money(r.total), 'num') + td(money(r.paid), 'num') +
        td(money(r.remaining), 'num' + (r.remaining > 0 ? ' neg' : '')) +
        (opts.owner ? td(money(r.profit), 'num' + (r.profit < 0 ? ' neg' : '')) : '') +
        td(r.phone) + td(r.notes) + '</tr>';
    }).join('');
    var foot = opts.totals ? '<tfoot><tr><td class="tbl-actions"></td><td colspan="5">Total (' + rows.length + ')</td>' + td(U.round2(t.qty), 'num') + td(money(t.totalCost), 'num') +
      td(money(t.total), 'num') + td(money(t.paid), 'num') + td(money(t.remaining), 'num') + (opts.owner ? td(money(t.profit), 'num') : '') +
      '<td colspan="2"></td></tr></tfoot>' : '';
    return '<table><thead><tr><th class="tbl-actions"></th><th>Date</th><th>Material</th><th>GSM</th><th>Size</th><th>Print</th><th class="num">Amount</th><th class="num">Initial cost</th>' +
      '<th class="num">Total Br</th><th class="num">Paid</th><th class="num">Remaining</th>' + (opts.owner ? '<th class="num">Profit</th>' : '') +
      '<th>Phone</th><th>Other reasons</th></tr></thead><tbody>' + body + '</tbody>' + foot + '</table>';
  }

  function incomeActions(r, opts) {
    return '<td class="tbl-actions">' +
      (r.remaining > 0 ? '<button class="tbl-btn" data-act="collect" data-id="' + r.id + '">Receive</button> ' : '') +
      '<button class="tbl-btn" data-act="edit-income" data-id="' + r.id + '">Edit</button>' +
      (opts.owner ? ' <button class="tbl-btn danger" data-act="del-income" data-id="' + r.id + '">Delete</button>' : '') +
      '</td>';
  }

  function paymentTable(rows, opts) {
    if (!rows.length) return '<p class="empty">No payment records yet.</p>';
    var total = 0;
    var body = rows.map(function (r) {
      total += num(r.amount);
      return '<tr><td class="tbl-actions"><button class="tbl-btn" data-act="edit-payment" data-id="' + r.id + '">Edit</button>' +
        (opts.owner ? ' <button class="tbl-btn danger" data-act="del-payment" data-id="' + r.id + '">Delete</button>' : '') + '</td>' +
        td(U.prettyDate(r.date)) + td(r.material) + td(r.gsm) + td(r.size) + td(r.type) +
        td(r.qty || '', 'num') + td(money(r.amount), 'num') + td(r.phone) + td(r.notes) + '</tr>';
    }).join('');
    var foot = opts.totals ? '<tfoot><tr><td class="tbl-actions"></td><td colspan="6">Total (' + rows.length + ')</td>' + td(money(total), 'num') + '<td colspan="2"></td></tr></tfoot>' : '';
    return '<table><thead><tr><th class="tbl-actions"></th><th>Date</th><th>Material</th><th>GSM</th><th>Size</th><th>Type</th><th class="num">Qty</th><th class="num">Amount Br</th>' +
      '<th>Phone</th><th>Other reasons</th></tr></thead><tbody>' + body + '</tbody>' + foot + '</table>';
  }

  function byNewest(a, b) { return b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''); }

  function renderRecent() {
    var inRows = S.db.income.slice().sort(byNewest).slice(0, 15);
    var payRows = S.db.payments.slice().sort(byNewest).slice(0, 15);
    $('#income-recent').innerHTML = incomeTable(inRows, {});
    $('#payment-recent').innerHTML = paymentTable(payRows, {});
    $('#income-recent-note').textContent = S.db.income.length > 15 ? 'Showing latest 15 of ' + S.db.income.length : '';
    $('#payment-recent-note').textContent = S.db.payments.length > 15 ? 'Showing latest 15 of ' + S.db.payments.length : '';
  }

  // table buttons (event delegation for every table)
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b) return;
    var id = b.dataset.id;
    var act = b.dataset.act;
    if (act === 'edit-income') loadIncome(S.db.income.find(function (r) { return r.id === id; }));
    else if (act === 'edit-payment') loadPayment(S.db.payments.find(function (r) { return r.id === id; }));
    else if (act === 'collect') openCollect(id);
    else if (act === 'del-income' && confirm('Delete this income record? This cannot be undone.')) { S.remove('income', id); saved('Deleted'); refreshAll(); }
    else if (act === 'del-payment' && confirm('Delete this payment record? This cannot be undone.')) { S.remove('payment', id); saved('Deleted'); refreshAll(); }
  });

  // ---------------- receive payment dialog ----------------
  var dlg = $('#collect-dialog');
  var collectId = null;
  function openCollect(id) {
    var r = S.db.income.find(function (x) { return x.id === id; });
    if (!r) return;
    collectId = id;
    $('#collect-info').textContent = r.material + ' · ' + U.prettyDate(r.date) + (r.phone ? ' · ' + r.phone : '') + ' — remaining ' + U.birr(r.remaining);
    var f = $('#collect-form');
    f.elements.amount.value = r.remaining;
    f.elements.amount.max = r.remaining;
    dlg.returnValue = '';
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  dlg.addEventListener('close', function () {
    if (dlg.returnValue === 'ok' && collectId) {
      var amt = num($('#collect-form').elements.amount.value);
      var r = S.db.income.find(function (x) { return x.id === collectId; });
      if (r && amt > 0) {
        var received = Math.min(amt, r.remaining);
        S.receivePayment(collectId, received, today());
        saved('Payment received ✓  ' + U.birr(received));
        refreshAll();
      }
    }
    collectId = null;
  });

  // ---------------- owner ----------------
  function isOwner() { try { return sessionStorage.getItem(OWNER_FLAG) === '1'; } catch (e) { return ownerMem; } }
  var ownerMem = false;
  function setOwner(on) {
    ownerMem = on;
    try { if (on) sessionStorage.setItem(OWNER_FLAG, '1'); else sessionStorage.removeItem(OWNER_FLAG); } catch (e) { /* memory only */ }
  }

  var ownerReady = false;
  function initOwner() {
    var on = isOwner();
    $('#owner-login').hidden = on;
    $('#owner-area').hidden = !on;
    if (!on) { setTimeout(function () { $('#owner-pass').focus(); }, 50); return; }
    if (!ownerReady) { ownerReady = true; applyPreset('month'); }
    renderReport();
  }

  $('#login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = $('#owner-pass');
    if (window.sha256Hex(input.value) === OWNER_HASH) {
      setOwner(true);
      input.value = '';
      $('#login-error').hidden = true;
      initOwner();
    } else {
      $('#login-error').hidden = false;
      input.select();
    }
  });
  $('#btn-lock').addEventListener('click', function () { setOwner(false); initOwner(); });
  $('#btn-print').addEventListener('click', function () { window.print(); });

  // date range
  var rangeFrom = $('#range-from'), rangeTo = $('#range-to');
  function applyPreset(p) {
    var d = new Date(), from, to = today();
    if (p === 'today') from = to;
    else if (p === 'week') { var dow = (d.getDay() + 6) % 7; from = U.addDays(to, -dow); }
    else if (p === 'month') from = to.slice(0, 8) + '01';
    else if (p === 'lastmonth') {
      var lm = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      from = U.isoDate(lm);
      to = U.isoDate(new Date(d.getFullYear(), d.getMonth(), 0));
    } else if (p === 'year') from = to.slice(0, 4) + '-01-01';
    else if (p === 'all') { from = ''; to = ''; }
    rangeFrom.value = from; rangeTo.value = to;
    $all('#range-presets .chip').forEach(function (c) { c.setAttribute('aria-pressed', String(c.dataset.preset === p)); });
    renderReport();
  }
  $('#range-presets').addEventListener('click', function (e) {
    var c = e.target.closest('[data-preset]');
    if (c) applyPreset(c.dataset.preset);
  });
  [rangeFrom, rangeTo].forEach(function (i) {
    i.addEventListener('change', function () {
      $all('#range-presets .chip').forEach(function (c) { c.setAttribute('aria-pressed', 'false'); });
      renderReport();
    });
  });

  function currentRange() {
    var from = rangeFrom.value, to = rangeTo.value;
    if (from && to && from > to) { var t = from; from = to; to = t; }
    return { from: from, to: to };
  }

  var lastReport = null;
  function renderReport() {
    if (current !== 'owner' || !isOwner()) return;
    var r = currentRange();
    var data = S.filter(r.from, r.to);
    var s = S.summarize(data.income, data.payments);
    var prevSummary = null;
    if (r.from && r.to) {
      var len = U.daysBetween(r.from, r.to) + 1;
      var pTo = U.addDays(r.from, -1), pFrom = U.addDays(r.from, -len);
      var pd = S.filter(pFrom, pTo);
      if (pd.income.length || pd.payments.length) prevSummary = S.summarize(pd.income, pd.payments);
    }

    $('#range-label').textContent = (r.from ? U.prettyDate(r.from) : 'First record') + ' → ' + (r.to ? U.prettyDate(r.to) : 'latest record') +
      ' · ' + data.income.length + ' income and ' + data.payments.length + ' payment records';

    // KPI tiles
    var tiles = [
      ['Total income (sales)', U.birr(s.sales), s.orders + ' order' + (s.orders === 1 ? '' : 's')],
      ['Collected', U.birr(s.collected), 'Remaining ' + U.birr(s.outstanding)],
      ['Initial cost', U.birr(s.initialCost), 'Cost of goods sold'],
      ['Payments (costs)', U.birr(s.expenses), s.paymentsCount + ' payment' + (s.paymentsCount === 1 ? '' : 's')],
      ['Total cost', U.birr(s.totalCost), 'Initial cost + payments'],
      ['Gross profit', U.birr(s.grossProfit), 'Margin ' + U.pct(s.grossMargin)],
      ['Pure profit', U.birr(s.pureProfit), 'Margin ' + U.pct(s.margin), true],
      ['Net cash flow', U.birr(s.cashFlow), 'Collected − payments']
    ];
    $('#kpis').innerHTML = tiles.map(function (t) {
      var neg = /^-/.test(t[1]);
      return '<div class="kpi' + (t[3] ? ' hero' : '') + '"><div class="k-label">' + esc(t[0]) + '</div><div class="k-value' + (neg ? ' neg' : '') + '">' + esc(t[1]) + '</div><div class="k-sub">' + esc(t[2]) + '</div></div>';
    }).join('');

    // trend
    var ts = S.timeSeries(data.income, data.payments, r.from, r.to);
    $('#trend-grain').textContent = ts.buckets.length ? (ts.grain === 'month' ? 'Monthly' : 'Daily') + ' totals' : '';
    E.charts.columns($('#chart-trend'), {
      label: 'Income, total cost and pure profit over time',
      categories: ts.buckets.map(function (b) { return b.label; }),
      series: [
        { name: 'Income', color: '--series-1', values: ts.buckets.map(function (b) { return b.income; }) },
        { name: 'Total cost', color: '--series-2', values: ts.buckets.map(function (b) { return b.cost; }) },
        { name: 'Pure profit', color: '--series-3', values: ts.buckets.map(function (b) { return b.profit; }) }
      ],
      format: U.birr
    });

    var byMat = S.groupBy(data.income, function (x) { return x.material; }, {
      sales: function (x) { return x.total; }, cost: function (x) { return x.totalCost; }, profit: function (x) { return x.profit; }, qty: function (x) { return x.qty; }
    }).sort(function (a, b) { return b.profit - a.profit; });
    E.charts.hbars($('#chart-material'), {
      label: 'Profit by material', valueName: 'Profit', format: U.birr, color: '--series-3',
      items: byMat.map(function (m) {
        return { label: m.key, value: U.round2(m.profit), rows: [['Sales', U.birr(m.sales)], ['Initial cost', U.birr(m.cost)], ['Margin', U.pct(m.sales ? m.profit / m.sales * 100 : NaN)], ['Amount', String(U.round2(m.qty))]] };
      })
    });

    var byExp = S.groupBy(data.payments, function (x) { return x.material; }, { amount: function (x) { return x.amount; } })
      .sort(function (a, b) { return b.amount - a.amount; });
    E.charts.hbars($('#chart-expense'), {
      label: 'Payments by material', valueName: 'Paid', format: U.birr, color: '--series-2',
      items: byExp.map(function (m) { return { label: m.key, value: U.round2(m.amount), rows: [['Payments', String(m.count)]] }; })
    });

    var byPrint = S.groupBy(data.income, function (x) { return x.printType || 'Not set'; }, { sales: function (x) { return x.total; }, profit: function (x) { return x.profit; } })
      .sort(function (a, b) { return b.sales - a.sales; });
    E.charts.hbars($('#chart-print'), {
      label: 'Sales by print type', valueName: 'Sales', format: U.birr, color: '--series-1',
      items: byPrint.map(function (p) { return { label: p.key, value: U.round2(p.sales), rows: [['Profit', U.birr(p.profit)], ['Orders', String(p.count)]] }; })
    });

    // debtors
    var debt = S.groupBy(data.income.filter(function (x) { return x.remaining > 0; }), function (x) { return x.phone || 'No phone'; }, { owed: function (x) { return x.remaining; } })
      .sort(function (a, b) { return b.owed - a.owed; });
    $('#debtors').innerHTML = debt.length ? '<table><thead><tr><th>Phone</th><th class="num">Orders</th><th class="num">Owes (Br)</th></tr></thead><tbody>' +
      debt.map(function (d) { return '<tr>' + td(d.key) + td(d.count, 'num') + td(money(d.owed), 'num neg') + '</tr>'; }).join('') + '</tbody></table>'
      : '<p class="empty">Everyone has paid in full for this period.</p>';

    // strategies
    var ins = E.insights.analyze({ summary: s, prevSummary: prevSummary, income: data.income, payments: data.payments });
    $('#insights').innerHTML = ins.map(function (i) {
      return '<div class="insight ' + i.level + '"><div><div class="tag">' + esc(i.tag) + '</div><p>' + esc(i.text) + '</p></div></div>';
    }).join('');

    // records
    $('#owner-income').innerHTML = incomeTable(data.income.slice().sort(byNewest), { owner: true, totals: true });
    $('#owner-payment').innerHTML = paymentTable(data.payments.slice().sort(byNewest), { owner: true, totals: true });

    lastReport = { range: r, data: data, summary: s, prevSummary: prevSummary, byMat: byMat, byExp: byExp, byPrint: byPrint, series: ts };
    $('#key-status').textContent = E.ai.getKey() ? 'A key is saved on this device.' : 'No key saved — the built-in suggestions above still work.';
  }

  // ---------------- CSV / backup ----------------
  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function csv(rows, cols) {
    function cell(v) { v = v === undefined || v === null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    return '﻿' + [cols.map(function (c) { return cell(c[0]); }).join(',')].concat(rows.map(function (r) {
      return cols.map(function (c) { return cell(r[c[1]]); }).join(',');
    })).join('\n');
  }
  function rangeTag() { var r = currentRange(); return (r.from || 'start') + '_to_' + (r.to || 'latest'); }
  $('#btn-csv-income').addEventListener('click', function () {
    if (!lastReport) return;
    download('free-esra-income_' + rangeTag() + '.csv', csv(lastReport.data.income.slice().sort(byNewest), [
      ['Date', 'date'], ['Material', 'material'], ['GSM', 'gsm'], ['Size', 'size'], ['Print type', 'printType'], ['Amount', 'qty'],
      ['Initial cost', 'initialCost'], ['Selling price', 'sellingPrice'], ['Prices per', 'priceMode'], ['Total initial cost', 'totalCost'],
      ['Total birr', 'total'], ['Paid', 'paid'], ['Remaining', 'remaining'], ['Profit', 'profit'], ['Phone', 'phone'], ['Other reasons', 'notes']
    ]), 'text/csv;charset=utf-8');
  });
  $('#btn-csv-payment').addEventListener('click', function () {
    if (!lastReport) return;
    download('free-esra-payments_' + rangeTag() + '.csv', csv(lastReport.data.payments.slice().sort(byNewest), [
      ['Date', 'date'], ['Material', 'material'], ['GSM', 'gsm'], ['Size', 'size'], ['Type', 'type'], ['Quantity', 'qty'],
      ['Amount', 'amount'], ['Phone', 'phone'], ['Other reasons', 'notes']
    ]), 'text/csv;charset=utf-8');
  });
  $('#btn-backup').addEventListener('click', function () {
    download('free-esra-backup_' + today() + '.json', S.exportJSON(), 'application/json');
  });
  $('#restore-file').addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    if (!confirm('Restoring replaces ALL records on this device with the backup. Continue?')) { this.value = ''; return; }
    var reader = new FileReader();
    var input = this;
    reader.onload = function () {
      try { S.importJSON(reader.result); toast('Backup restored ✓'); refreshAll(); }
      catch (err) { toast(err.message); }
      input.value = '';
    };
    reader.readAsText(file);
  });

  // ---------------- Claude AI ----------------
  $('#key-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var k = $('#api-key').value.trim();
    if (!k) return toast('Paste the API key first.');
    E.ai.setKey(k);
    $('#api-key').value = '';
    toast('API key saved on this device');
    renderReport();
  });
  $('#btn-key-clear').addEventListener('click', function () { E.ai.setKey(''); toast('API key removed'); renderReport(); });

  function aiPayload() {
    var R = lastReport, s = R.summary;
    function pick(o) { var c = {}; ['sales', 'collected', 'outstanding', 'initialCost', 'expenses', 'grossProfit', 'pureProfit', 'margin', 'cashFlow', 'orders', 'paymentsCount'].forEach(function (k) { c[k] = o[k]; }); return c; }
    var sizes = S.groupBy(R.data.income, function (x) { return x.size || 'Not set'; }, { sales: function (x) { return x.total; } });
    var repeatCustomers = S.groupBy(R.data.income.filter(function (x) { return x.phone; }), function (x) { return x.phone; }, { sales: function (x) { return x.total; } })
      .filter(function (c) { return c.count > 1; }).length;
    return {
      currency: 'ETB (Birr)',
      period: { from: R.range.from || 'first record', to: R.range.to || 'latest record' },
      totals: pick(s),
      previousPeriodTotals: R.prevSummary ? pick(R.prevSummary) : null,
      incomeByMaterial: R.byMat.map(function (m) { return { material: m.key, orders: m.count, quantity: U.round2(m.qty), sales: U.round2(m.sales), initialCost: U.round2(m.cost), profit: U.round2(m.profit) }; }),
      paymentsByMaterial: R.byExp.map(function (m) { return { item: m.key, payments: m.count, amount: U.round2(m.amount) }; }),
      salesByPrintType: R.byPrint.map(function (p) { return { printType: p.key, orders: p.count, sales: U.round2(p.sales), profit: U.round2(p.profit) }; }),
      salesBySize: sizes.map(function (z) { return { size: z.key, orders: z.count, sales: U.round2(z.sales) }; }),
      customersWithUnpaidBalance: S.groupBy(R.data.income.filter(function (x) { return x.remaining > 0; }), function (x) { return x.phone || 'none'; }, {}).length,
      repeatCustomers: repeatCustomers,
      timeline: { grain: R.series.grain, buckets: R.series.buckets.slice(-60).map(function (b) { return { period: b.key, income: b.income, cost: b.cost, profit: b.profit }; }) }
    };
  }

  $('#btn-ai').addEventListener('click', async function () {
    if (!lastReport) return;
    var out = $('#ai-output');
    var btn = this;
    if (!E.ai.getKey()) {
      out.hidden = false;
      out.innerHTML = '<p>To get written advice from Claude, add an Anthropic API key under <b>Data &amp; settings</b> below. The suggestions above are always available without a key.</p>';
      return;
    }
    btn.disabled = true;
    btn.textContent = 'Claude is thinking…';
    out.hidden = false;
    out.innerHTML = '<p class="muted">Analysing the report…</p>';
    var text = '';
    try {
      await E.ai.ask(aiPayload(), function (chunk) { text += chunk; out.innerHTML = E.ai.renderMarkdown(text); });
      if (!text.trim()) out.innerHTML = '<p class="muted">Claude returned no text. Try again.</p>';
    } catch (err) {
      out.innerHTML = '<p class="error">' + esc(err.message || String(err)) + '</p>';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Ask Claude AI';
    }
  });

  // ---------------- boot ----------------
  function refreshAll() {
    fillMaterialSelects();
    fillDatalists();
    renderQuickFill('income');
    renderQuickFill('payment');
    renderRecent();
    renderReport();
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (current === 'owner') renderReport(); }, 200);
  });

  buildChips(inc);
  buildChips(pay);
  inc.elements.date.value = today();
  pay.elements.date.value = today();
  setPriceMode(priceMode);
  refreshAll();
  resetIncome();
  resetPayment();
  showTab((location.hash || '#income').slice(1));
})();
