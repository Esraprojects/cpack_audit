/* Lightweight SVG charts with hover tooltips (no external libraries). */
(function (global) {
  'use strict';
  var E = global.Esra = global.Esra || {};
  var NS = 'http://www.w3.org/2000/svg';

  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(n);
    return n;
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }

  // ---------- tooltip ----------
  var tip;
  function showTip(evt, html) {
    tip = tip || document.getElementById('tooltip');
    tip.innerHTML = html;
    tip.hidden = false;
    var x = evt.clientX, y = evt.clientY;
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var left = x + 14, top = y - h - 10;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (left < 8) left = 8;
    if (top < 8) top = y + 16;
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }
  function hideTip() { if (tip) tip.hidden = true; }

  function niceStep(range, ticks) {
    var raw = range / ticks;
    var mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    var n = raw / mag;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * mag;
  }
  function scaleDomain(min, max) {
    min = Math.min(0, min); max = Math.max(0, max);
    if (min === max) max = 1;
    var step = niceStep(max - min, 4);
    var lo = Math.floor(min / step) * step;
    var hi = Math.ceil(max / step) * step;
    var ticks = [];
    for (var t = lo; t <= hi + step / 2; t += step) ticks.push(Math.round(t * 1e6) / 1e6);
    return { lo: lo, hi: hi, ticks: ticks };
  }

  function emptyState(container, msg) {
    container.innerHTML = '<p class="empty">' + esc(msg || 'No data in this period yet.') + '</p>';
  }

  function legend(container, series) {
    var div = document.createElement('div');
    div.className = 'legend';
    div.innerHTML = series.map(function (s) {
      return '<span><i style="background:var(' + s.color + ')"></i>' + esc(s.name) + '</span>';
    }).join('');
    container.appendChild(div);
  }

  // Grouped columns: one group per time bucket, one column per series.
  function columns(container, opts) {
    container.innerHTML = '';
    var cats = opts.categories;
    var series = opts.series;
    var fmt = opts.format || String;
    var any = series.some(function (s) { return s.values.some(function (v) { return v !== 0; }); });
    if (!cats.length || !any) return emptyState(container);
    legend(container, series);

    var W = Math.max(320, container.clientWidth || 600);
    var H = Math.round(Math.min(340, Math.max(220, W * 0.42)));
    var m = { t: 10, r: 8, b: 30, l: 48 };
    var iw = W - m.l - m.r, ih = H - m.t - m.b;
    var all = [];
    series.forEach(function (s) { all = all.concat(s.values); });
    var dom = scaleDomain(Math.min.apply(null, all), Math.max.apply(null, all));
    function y(v) { return m.t + ih - ((v - dom.lo) / (dom.hi - dom.lo)) * ih; }

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label || 'chart' }, container);
    dom.ticks.forEach(function (t) {
      el('line', { x1: m.l, x2: W - m.r, y1: y(t), y2: y(t), class: t === 0 ? 'axis-line' : 'grid-line' }, svg);
      var tx = el('text', { x: m.l - 6, y: y(t) + 4, 'text-anchor': 'end' }, svg);
      tx.textContent = E.util.birrShort(t);
    });

    var band = iw / cats.length;
    var groupPad = Math.min(band * 0.2, 14);
    var gap = band > 30 ? 2 : 1;
    var colW = Math.max(1, (band - groupPad - gap * (series.length - 1)) / series.length);
    var labelEvery = Math.ceil(cats.length / Math.max(1, Math.floor(iw / 56)));

    cats.forEach(function (cat, i) {
      var gx = m.l + i * band;
      var hover = el('rect', { x: gx, y: m.t, width: band, height: ih, class: 'hover-band' }, svg);
      series.forEach(function (s, j) {
        var v = s.values[i];
        if (!v) return;
        var x = gx + groupPad / 2 + j * (colW + gap);
        var y0 = y(0), y1 = y(v);
        var top = Math.min(y0, y1), h = Math.max(1, Math.abs(y1 - y0));
        var r = Math.min(4, colW / 2, h);
        el('path', { d: roundedBar(x, top, colW, h, r, v >= 0), fill: 'var(' + s.color + ')' }, svg);
      });
      if (i % labelEvery === 0) {
        var lx = el('text', { x: gx + band / 2, y: H - 10, 'text-anchor': 'middle' }, svg);
        lx.textContent = cat;
      }
      var hit = el('rect', { x: gx, y: m.t, width: band, height: ih, class: 'hit' }, svg);
      var html = '<div class="tt-title">' + esc(cat) + '</div>' + series.map(function (s) {
        return '<div class="tt-row"><span><i style="background:var(' + s.color + ')"></i>' + esc(s.name) + '</span><b>' + esc(fmt(s.values[i])) + '</b></div>';
      }).join('');
      hit.addEventListener('pointermove', function (e) { hover.classList.add('on'); showTip(e, html); });
      hit.addEventListener('pointerleave', function () { hover.classList.remove('on'); hideTip(); });
    });
  }

  // Path for a bar with rounded corners only on its data end.
  function roundedBar(x, y, w, h, r, up) {
    if (up) {
      return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y +
        'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
    }
    return 'M' + x + ',' + y + 'V' + (y + h - r) + 'Q' + x + ',' + (y + h) + ' ' + (x + r) + ',' + (y + h) +
      'H' + (x + w - r) + 'Q' + (x + w) + ',' + (y + h) + ' ' + (x + w) + ',' + (y + h - r) + 'V' + y + 'Z';
  }
  function roundedHBar(x, y, w, h, r, right) {
    if (right) {
      return 'M' + x + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) +
        'V' + (y + h - r) + 'Q' + (x + w) + ',' + (y + h) + ' ' + (x + w - r) + ',' + (y + h) + 'H' + x + 'Z';
    }
    return 'M' + (x + w) + ',' + y + 'H' + (x + r) + 'Q' + x + ',' + y + ' ' + x + ',' + (y + r) +
      'V' + (y + h - r) + 'Q' + x + ',' + (y + h) + ' ' + (x + r) + ',' + (y + h) + 'H' + (x + w) + 'Z';
  }

  // Horizontal ranked bars for one measure (supports negatives).
  function hbars(container, opts) {
    container.innerHTML = '';
    var items = opts.items.filter(function (d) { return d.value !== 0; });
    if (!items.length) return emptyState(container);
    var max = opts.max || 8;
    if (items.length > max) {
      var rest = items.slice(max - 1);
      items = items.slice(0, max - 1);
      items.push({
        label: 'Other (' + rest.length + ')',
        value: rest.reduce(function (a, d) { return a + d.value; }, 0),
        rows: [['Items', rest.map(function (d) { return d.label; }).join(', ')]]
      });
    }
    var fmt = opts.format || String;
    var W = Math.max(300, container.clientWidth || 400);
    var rowH = 30;
    var labelW = Math.min(150, W * 0.36);
    var valueW = 70;
    var H = items.length * rowH + 6;
    var x0 = labelW + 8, x1 = W - valueW;
    var lo = Math.min(0, Math.min.apply(null, items.map(function (d) { return d.value; })));
    var hi = Math.max(0, Math.max.apply(null, items.map(function (d) { return d.value; })));
    if (lo === hi) hi = 1;
    function x(v) { return x0 + ((v - lo) / (hi - lo)) * (x1 - x0); }

    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': opts.label || 'chart' }, container);
    if (lo < 0) el('line', { x1: x(0), x2: x(0), y1: 0, y2: H, class: 'axis-line' }, svg);
    items.forEach(function (d, i) {
      var yTop = i * rowH + 4;
      var bh = rowH - 10;
      var hover = el('rect', { x: 0, y: yTop - 3, width: W, height: rowH - 4, class: 'hover-band', rx: 6 }, svg);
      var lbl = el('text', { x: labelW, y: yTop + bh / 2 + 4, 'text-anchor': 'end' }, svg);
      lbl.textContent = d.label.length > 22 ? d.label.slice(0, 21) + '…' : d.label;
      var xa = x(Math.min(0, d.value)), xb = x(Math.max(0, d.value));
      var w = Math.max(1, xb - xa);
      el('path', { d: roundedHBar(xa, yTop, w, bh, Math.min(4, w / 2), d.value >= 0), fill: 'var(' + (opts.color || '--series-1') + ')' }, svg);
      var val = el('text', { x: d.value >= 0 ? xb + 6 : x(0) + 6, y: yTop + bh / 2 + 4 }, svg);
      val.textContent = E.util.birrShort(d.value);
      var hit = el('rect', { x: 0, y: yTop - 3, width: W, height: rowH - 4, class: 'hit' }, svg);
      var html = '<div class="tt-title">' + esc(d.label) + '</div>' +
        '<div class="tt-row"><span>' + esc(opts.valueName || 'Value') + '</span><b>' + esc(fmt(d.value)) + '</b></div>' +
        (d.rows || []).map(function (r) { return '<div class="tt-row"><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></div>'; }).join('');
      hit.addEventListener('pointermove', function (e) { hover.classList.add('on'); showTip(e, html); });
      hit.addEventListener('pointerleave', function () { hover.classList.remove('on'); hideTip(); });
    });
  }

  window.addEventListener('scroll', hideTip, { passive: true });

  E.charts = { columns: columns, hbars: hbars, esc: esc };
})(window);
