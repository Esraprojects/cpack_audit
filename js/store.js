/* Data layer: constants, saved records, input memory and report math. */
(function (global) {
  'use strict';
  var E = global.Esra = global.Esra || {};

  var DATA_KEY = 'freeEsra.data.v1';

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

  // ---------- storage ----------
  function emptyDB() {
    return {
      version: 1,
      income: [],
      payments: [],
      memory: {
        history: {},                       // field -> most-recent-first list of values
        lastByMaterial: { income: {}, payment: {} },
        customMaterials: [],
        priceMode: 'unit'
      }
    };
  }

  function load() {
    var db = emptyDB();
    try {
      var raw = localStorage.getItem(DATA_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        db.income = Array.isArray(parsed.income) ? parsed.income : [];
        db.payments = Array.isArray(parsed.payments) ? parsed.payments : [];
        if (parsed.memory) {
          db.memory.history = parsed.memory.history || {};
          db.memory.lastByMaterial = parsed.memory.lastByMaterial || db.memory.lastByMaterial;
          db.memory.lastByMaterial.income = db.memory.lastByMaterial.income || {};
          db.memory.lastByMaterial.payment = db.memory.lastByMaterial.payment || {};
          db.memory.customMaterials = parsed.memory.customMaterials || [];
          db.memory.priceMode = parsed.memory.priceMode || 'unit';
        }
      }
    } catch (e) { /* storage unavailable or corrupt: start empty */ }
    return db;
  }

  var db = load();
  var storageOk = true;

  function save() {
    try {
      localStorage.setItem(DATA_KEY, JSON.stringify(db));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
    return storageOk;
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
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

  // ---------- memory ("remember my inputs") ----------
  var MAX_HISTORY = 30;
  function remember(field, value) {
    if (value === undefined || value === null) return;
    var v = String(value).trim();
    if (!v) return;
    var list = db.memory.history[field] || [];
    list = list.filter(function (x) { return x.toLowerCase() !== v.toLowerCase(); });
    list.unshift(v);
    db.memory.history[field] = list.slice(0, MAX_HISTORY);
  }
  function suggestions(field) { return (db.memory.history[field] || []).slice(); }

  function setLastFor(kind, material, values) {
    if (!material) return;
    db.memory.lastByMaterial[kind][material.toLowerCase()] = values;
  }
  function lastFor(kind, material) {
    if (!material) return null;
    return db.memory.lastByMaterial[kind][material.toLowerCase()] || null;
  }
  function addCustomMaterial(name) {
    var all = allMaterials().map(function (m) { return m.toLowerCase(); });
    if (name && all.indexOf(name.toLowerCase()) === -1) db.memory.customMaterials.push(name);
  }
  function allMaterials() {
    var out = [];
    E.MATERIAL_GROUPS.forEach(function (g) { out = out.concat(g.items); });
    return out.concat(db.memory.customMaterials);
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

  function stamp(rec, existing) {
    var now = new Date().toISOString();
    rec.id = existing ? existing.id : uid();
    rec.createdAt = existing ? existing.createdAt : now;
    rec.updatedAt = now;
    if (existing && existing.receipts) rec.receipts = existing.receipts;
    return rec;
  }

  function upsert(list, rec) {
    var i = list.findIndex(function (r) { return r.id === rec.id; });
    if (i === -1) list.push(rec); else list[i] = rec;
  }

  function saveIncome(values, priceMode, id) {
    var existing = id ? db.income.find(function (r) { return r.id === id; }) : null;
    var rec = stamp(buildIncome(values, priceMode), existing);
    upsert(db.income, rec);
    db.memory.priceMode = rec.priceMode;
    learn('income', rec);
    save();
    return rec;
  }

  function savePayment(values, id) {
    var existing = id ? db.payments.find(function (r) { return r.id === id; }) : null;
    var rec = stamp(buildPayment(values), existing);
    upsert(db.payments, rec);
    learn('payment', rec);
    save();
    return rec;
  }

  // Records what was typed so the next entry can be suggested / pre-filled.
  function learn(kind, rec) {
    addCustomMaterial(rec.material);
    remember('gsm', rec.gsm);
    remember('phone', rec.phone);
    remember('notes', rec.notes);
    if (rec.qty) remember('qty', rec.qty);
    if (kind === 'income') {
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
    var rec = db.income.find(function (r) { return r.id === id; });
    if (!rec) return null;
    amount = round2(num(amount));
    if (amount <= 0) return rec;
    rec.receipts = rec.receipts || [];
    rec.receipts.push({ date: date || isoDate(new Date()), amount: amount });
    rec.paid = round2(rec.paid + amount);
    rec.remaining = round2(Math.max(0, rec.total - rec.paid));
    rec.updatedAt = new Date().toISOString();
    save();
    return rec;
  }

  function remove(kind, id) {
    var list = kind === 'income' ? db.income : db.payments;
    var i = list.findIndex(function (r) { return r.id === id; });
    if (i !== -1) { list.splice(i, 1); save(); }
  }

  // ---------- reporting ----------
  function inRange(rec, from, to) {
    return (!from || rec.date >= from) && (!to || rec.date <= to);
  }
  function filter(from, to) {
    return {
      income: db.income.filter(function (r) { return inRange(r, from, to); }),
      payments: db.payments.filter(function (r) { return inRange(r, from, to); })
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

  // ---------- backup ----------
  function exportJSON() { return JSON.stringify(db, null, 2); }
  function importJSON(text) {
    var parsed = JSON.parse(text);
    if (!parsed || !Array.isArray(parsed.income) || !Array.isArray(parsed.payments)) {
      throw new Error('This file is not a Free Esra backup.');
    }
    try { localStorage.setItem(DATA_KEY, JSON.stringify(parsed)); } catch (e) { throw new Error('Could not save to this browser.'); }
    db = load();
  }

  E.store = {
    get db() { return db; },
    save: save,
    get storageOk() { return storageOk; },
    remember: remember,
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
    timeSeries: timeSeries,
    exportJSON: exportJSON,
    importJSON: importJSON
  };
  E.util = {
    num: num, round2: round2, isoDate: isoDate, parseISO: parseISO, addDays: addDays, daysBetween: daysBetween,
    birr: birr, birrShort: birrShort, pct: pct, prettyDate: prettyDate
  };
})(window);
