/* Data layer: constants, records from the online database, input memory and report math. */
(function (global) {
  'use strict';
  var E = global.Esra = global.Esra || {};


  E.MATERIAL_GROUPS = [
    { label: 'Paper & board', items: ['Duplex', 'Kaki', 'White top', 'Black', 'Food grade', 'Art paper', 'Kamsur', 'Gemed', 'Cola'] },
    { label: 'Lacquer', items: ['Laker water base', 'Laker solvent base'] },
    { label: 'Frames', items: ['Frame A3', 'Frame A4', 'Frame A5'] },
    { label: 'Packages', items: ['Full package', 'Print package'] },
    { label: 'Training', items: ['Full training', 'Print training', 'Paper bag training'] },
    { label: 'Rims', items: ['Duplex rim', 'Kaki local rim', 'White top local rim', 'Black rim', 'Kaki rim', 'Food grade rim', 'Art paper rim'] }
  ];
  E.SIZES = ['XS', 'S', 'M', 'L', 'XL'];
  E.PRINT_TYPES = ['Full', 'One side', 'Two side', 'Digital UV', 'Offset'];

  // ---------- state (filled live from the online database) ----------
  function emptyMemory() {
    return {
      history: {},                       // field -> most-recent-first list of values
      lastByMaterial: { income: {}, payment: {} },
      customMaterials: [],
      priceMode: 'unit'
    };
  }
  var state = {
    recent: { income: [], payments: [] },   // what the Income / Payments tabs show
    report: { income: [], payments: [] },   // owner's selected period
    memory: emptyMemory(),
    // Saved on this device but not yet confirmed by the server (e.g. no internet).
    pending: { income: {}, payments: {} }
  };

  function setRecent(data) {
    state.recent = data;
    dropConfirmed();
  }
  function setReport(data) { state.report = data; }
  function setMemory(m) {
    var mem = emptyMemory();
    if (m) {
      mem.history = m.history || {};
      mem.lastByMaterial = m.lastByMaterial || mem.lastByMaterial;
      mem.lastByMaterial.income = mem.lastByMaterial.income || {};
      mem.lastByMaterial.payment = mem.lastByMaterial.payment || {};
      mem.customMaterials = m.customMaterials || [];
      mem.priceMode = m.priceMode || 'unit';
    }
    state.memory = mem;
  }
  function dropConfirmed() {
    ['income', 'payments'].forEach(function (k) {
      state.recent[k].forEach(function (r) { delete state.pending[k][r.id]; });
    });
  }
  function withPending(kind) {
    var list = state.recent[kind].slice();
    var have = {};
    list.forEach(function (r) { have[r.id] = 1; });
    Object.keys(state.pending[kind]).forEach(function (id) { if (!have[id]) list.push(state.pending[kind][id]); });
    return list;
  }
  function findRecord(kind, id) {
    var lists = [state.recent[kind], state.report[kind]];
    for (var i = 0; i < lists.length; i++) {
      var r = lists[i].find(function (x) { return x.id === id; });
      if (r) return r;
    }
    return state.pending[kind][id] || null;
  }

  // ---------- helpers ----------
  function num(v) {
    var n = parseFloat(v);
    return isFinite(n) ? n : 0;
  }
  function round2(n) { return Math.round(n * 100) / 100; }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s) {
    var p = String(s).split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function addDays(s, n) { var d = parseISO(s); d.setDate(d.getDate() + n); return isoDate(d); }
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }

  var birrFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var shortFmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1, notation: 'compact' });
  function birr(n) { return birrFmt.format(num(n)) + ' Br'; }
  function birrShort(n) { return shortFmt.format(num(n)); }
  function pct(n) { return isFinite(n) ? (Math.round(n * 10) / 10) + '%' : '—'; }
  function prettyDate(s) {
    if (!s) return '';
    return parseISO(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  // createdAt / updatedAt arrive as full ISO timestamps, so they are read with
  // new Date() and shown in the phone's own time zone, not the stored UTC.
  function stampDate(s) {
    var d = s ? new Date(s) : null;
    return d && !isNaN(d.getTime()) ? d : null;
  }
  // Short form for the table cell: "16 Oct, 2:45 pm".
  function prettyStamp(s) {
    var d = stampDate(s);
    if (!d) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' +
      d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  // Long form for the hover tooltip, including the year and the seconds.
  function fullStamp(s) {
    var d = stampDate(s);
    if (!d) return '';
    return d.toLocaleString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
    });
  }

  // ---------- memory ("remember my inputs") ----------
  var MAX_HISTORY = 30;
  function remember(field, value) {
    if (value === undefined || value === null) return;
    var v = String(value).trim();
    if (!v) return;
    var list = state.memory.history[field] || [];
    list = list.filter(function (x) { return x.toLowerCase() !== v.toLowerCase(); });
    list.unshift(v);
    state.memory.history[field] = list.slice(0, MAX_HISTORY);
  }
  function suggestions(field) { return (state.memory.history[field] || []).slice(); }

  function setLastFor(kind, material, values) {
    if (!material) return;
    state.memory.lastByMaterial[kind][material.toLowerCase()] = values;
  }
  function lastFor(kind, material) {
    if (!material) return null;
    return state.memory.lastByMaterial[kind][material.toLowerCase()] || null;
  }
  function addCustomMaterial(name) {
    var all = allMaterials().map(function (m) { return m.toLowerCase(); });
    if (name && all.indexOf(name.toLowerCase()) === -1) state.memory.customMaterials.push(name);
  }
  function allMaterials() {
    var out = [];
    E.MATERIAL_GROUPS.forEach(function (g) { out = out.concat(g.items); });
    return out.concat(state.memory.customMaterials);
  }

  // ---------- record math ----------
  // Turns raw form values into a stored income record with all totals computed.
  function buildIncome(v, priceMode) {
    var qty = num(v.qty);
    var cost = num(v.initialCost);
    var price = num(v.sellingPrice);
    var perUnit = priceMode !== 'order';
    var autoTotal = perUnit ? qty * price : price;
    var total = v.total !== '' && v.total !== undefined && v.total !== null ? num(v.total) : autoTotal;
    var totalCost = perUnit ? qty * cost : cost;
    var paid = num(v.paid);
    return {
      date: v.date,
      material: v.material,
      gsm: v.gsm ? String(v.gsm) : '',
      size: v.size || '',
      printType: v.printType || '',
      qty: qty,
      initialCost: cost,
      sellingPrice: price,
      priceMode: perUnit ? 'unit' : 'order',
      total: round2(total),
      totalCost: round2(totalCost),
      profit: round2(total - totalCost),
      paid: round2(paid),
      remaining: round2(Math.max(0, total - paid)),
      phone: (v.phone || '').trim(),
      notes: (v.notes || '').trim()
    };
  }

  function buildPayment(v) {
    return {
      date: v.date,
      material: v.material,
      gsm: v.gsm ? String(v.gsm) : '',
      size: v.size || '',
      type: v.type || '',
      qty: num(v.qty),
      amount: round2(num(v.amount)),
      phone: (v.phone || '').trim(),
      notes: (v.notes || '').trim()
    };
  }

  function cloudErr(err) {
    if (E.onCloudError) E.onCloudError(err);
  }

  // Returns the record right away; the server write continues in the background.
  function saveIncome(values, priceMode, id) {
    var rec = buildIncome(values, priceMode);
    learn('income', rec);
    if (id) {
      var existing = findRecord('income', id) || {};
      // keep payments received later in step with the edited total
      rec.receipts = existing.receipts || [];
      E.cloud.update('income', id, rec).catch(cloudErr);
      rec.id = id;
    } else {
      rec.receipts = [];
      var res = E.cloud.add('income', rec);
      rec.id = res.id;
      rec.createdAt = new Date().toISOString();
      rec.pending = true;
      state.pending.income[rec.id] = rec;
      res.done.catch(function (err) { delete state.pending.income[rec.id]; cloudErr(err); });
    }
    saveMemory();
    return rec;
  }

  function savePayment(values, id) {
    var rec = buildPayment(values);
    learn('payment', rec);
    if (id) {
      E.cloud.update('payments', id, rec).catch(cloudErr);
      rec.id = id;
    } else {
      var res = E.cloud.add('payments', rec);
      rec.id = res.id;
      rec.createdAt = new Date().toISOString();
      rec.pending = true;
      state.pending.payments[rec.id] = rec;
      res.done.catch(function (err) { delete state.pending.payments[rec.id]; cloudErr(err); });
    }
    saveMemory();
    return rec;
  }

  function saveMemory() {
    E.cloud.saveMemory(JSON.parse(JSON.stringify(state.memory))).catch(cloudErr);
  }

  // Records what was typed so the next entry can be suggested / pre-filled.
  function learn(kind, rec) {
    addCustomMaterial(rec.material);
    remember('gsm', rec.gsm);
    remember('phone', rec.phone);
    remember('notes', rec.notes);
    if (rec.qty) remember('qty', rec.qty);
    if (kind === 'income') {
      state.memory.priceMode = rec.priceMode;
      if (rec.initialCost) remember('cost', rec.initialCost);
      if (rec.sellingPrice) remember('price', rec.sellingPrice);
      setLastFor('income', rec.material, {
        gsm: rec.gsm, size: rec.size, printType: rec.printType,
        initialCost: rec.initialCost, sellingPrice: rec.sellingPrice, priceMode: rec.priceMode
      });
    } else {
      if (rec.amount) remember('pay', rec.amount);
      setLastFor('payment', rec.material, {
        gsm: rec.gsm, size: rec.size, type: rec.type, amount: rec.amount, qty: rec.qty, phone: rec.phone
      });
    }
  }

  function receivePayment(id, amount, date) {
    var rec = findRecord('income', id);
    if (!rec) return null;
    amount = round2(num(amount));
    if (amount <= 0) return rec;
    var receipts = (rec.receipts || []).concat([{ date: date || isoDate(new Date()), amount: amount }]);
    var paid = round2(num(rec.paid) + amount);
    var fields = { receipts: receipts, paid: paid, remaining: round2(Math.max(0, num(rec.total) - paid)) };
    Object.assign(rec, fields);
    E.cloud.update('income', id, fields).catch(cloudErr);
    return rec;
  }

  function remove(kind, id) {
    var key = kind === 'income' ? 'income' : 'payments';
    E.cloud.remove(key, id).catch(cloudErr);
  }

  // ---------- reporting ----------
  function inRange(rec, from, to) {
    return (!from || rec.date >= from) && (!to || rec.date <= to);
  }
  function filter(from, to) {
    return {
      income: state.report.income.filter(function (r) { return inRange(r, from, to); }),
      payments: state.report.payments.filter(function (r) { return inRange(r, from, to); })
    };
  }

  function summarize(income, payments) {
    var s = { sales: 0, collected: 0, outstanding: 0, initialCost: 0, expenses: 0, orders: income.length, paymentsCount: payments.length, qty: 0 };
    income.forEach(function (r) {
      s.sales += num(r.total);
      s.collected += num(r.paid);
      s.outstanding += num(r.remaining);
      s.initialCost += num(r.totalCost);
      s.qty += num(r.qty);
    });
    payments.forEach(function (r) { s.expenses += num(r.amount); });
    s.grossProfit = s.sales - s.initialCost;
    s.pureProfit = s.grossProfit - s.expenses;
    s.totalCost = s.initialCost + s.expenses;
    s.margin = s.sales ? (s.pureProfit / s.sales) * 100 : NaN;
    s.grossMargin = s.sales ? (s.grossProfit / s.sales) * 100 : NaN;
    s.cashFlow = s.collected - s.expenses;
    Object.keys(s).forEach(function (k) { if (typeof s[k] === 'number' && isFinite(s[k]) && k.indexOf('Count') === -1) s[k] = round2(s[k]); });
    return s;
  }

  function groupBy(list, keyFn, valFns) {
    var map = {};
    list.forEach(function (r) {
      var k = keyFn(r) || 'Unspecified';
      if (!map[k]) { map[k] = { key: k, count: 0 }; Object.keys(valFns).forEach(function (f) { map[k][f] = 0; }); }
      map[k].count++;
      Object.keys(valFns).forEach(function (f) { map[k][f] += num(valFns[f](r)); });
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  // Buckets income/cost/profit by day or month across the whole range.
  function timeSeries(income, payments, from, to) {
    var dates = income.concat(payments).map(function (r) { return r.date; }).sort();
    var start = from || dates[0];
    var end = to || dates[dates.length - 1];
    if (!start || !end) return { grain: 'day', buckets: [] };
    var span = daysBetween(start, end);
    var grain = span > 62 ? 'month' : 'day';
    var keyOf = grain === 'month' ? function (s) { return s.slice(0, 7); } : function (s) { return s; };
    var buckets = [];
    var index = {};
    if (grain === 'day') {
      for (var d = start; d <= end; d = addDays(d, 1)) { index[d] = buckets.length; buckets.push({ key: d }); }
    } else {
      var cur = parseISO(start.slice(0, 7) + '-01');
      var last = end.slice(0, 7);
      while (isoDate(cur).slice(0, 7) <= last) {
        var k = isoDate(cur).slice(0, 7);
        index[k] = buckets.length; buckets.push({ key: k });
        cur.setMonth(cur.getMonth() + 1);
      }
    }
    buckets.forEach(function (b) { b.income = 0; b.cost = 0; b.profit = 0; });
    income.forEach(function (r) {
      var b = buckets[index[keyOf(r.date)]];
      if (b) { b.income += num(r.total); b.cost += num(r.totalCost); }
    });
    payments.forEach(function (r) {
      var b = buckets[index[keyOf(r.date)]];
      if (b) b.cost += num(r.amount);
    });
    buckets.forEach(function (b) {
      b.income = round2(b.income); b.cost = round2(b.cost); b.profit = round2(b.income - b.cost);
      if (grain === 'month') {
        b.label = parseISO(b.key + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
      } else {
        b.label = parseISO(b.key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      }
    });
    return { grain: grain, buckets: buckets };
  }

  E.store = {
    get state() { return state; },
    setRecent: setRecent,
    setReport: setReport,
    setMemory: setMemory,
    recentIncome: function () { return withPending('income'); },
    recentPayments: function () { return withPending('payments'); },
    findRecord: findRecord,
    suggestions: suggestions,
    lastFor: lastFor,
    allMaterials: allMaterials,
    buildIncome: buildIncome,
    saveIncome: saveIncome,
    savePayment: savePayment,
    receivePayment: receivePayment,
    remove: remove,
    filter: filter,
    summarize: summarize,
    groupBy: groupBy,
    timeSeries: timeSeries
  };
  E.util = {
    num: num, round2: round2, isoDate: isoDate, parseISO: parseISO, addDays: addDays, daysBetween: daysBetween,
    birr: birr, birrShort: birrShort, pct: pct, prettyDate: prettyDate,
    prettyStamp: prettyStamp, fullStamp: fullStamp
  };
})(window);
