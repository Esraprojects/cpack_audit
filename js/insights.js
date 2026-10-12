/* Built-in strategy engine: reads the report and suggests actions.
   Works offline; Claude AI advice (ai.js) is an optional extra on top. */
(function (global) {
  'use strict';
  var E = global.Esra = global.Esra || {};
  var U, S;

  function analyze(ctx) {
    U = E.util; S = E.store;
    var s = ctx.summary, prev = ctx.prevSummary;
    var income = ctx.income, payments = ctx.payments;
    var out = [];
    function add(level, tag, text) { out.push({ level: level, tag: tag, text: text }); }

    if (!income.length && !payments.length) {
      add('info', 'Getting started', 'No records in this period. Enter income and payments with the “Done” button and the report and suggestions will appear here.');
      return out;
    }

    // 1. Overall profitability
    if (s.sales > 0) {
      if (s.pureProfit < 0) {
        add('bad', 'Loss', 'This period is running at a loss of ' + U.birr(-s.pureProfit) + '. Costs (' + U.birr(s.totalCost) + ') are higher than sales (' + U.birr(s.sales) + '). Raise prices on low-margin items and pause non-essential purchases until sales recover.');
      } else if (s.margin < 15) {
        add('warn', 'Thin margin', 'Pure profit margin is only ' + U.pct(s.margin) + '. A healthy target for printing and packaging work is 25–35%. A 10% price increase on your best sellers would add about ' + U.birr(s.sales * 0.1) + ' at the same volume.');
      } else if (s.margin >= 30) {
        add('good', 'Strong margin', 'Pure profit margin is ' + U.pct(s.margin) + ' (' + U.birr(s.pureProfit) + '). Pricing is healthy — focus on bringing in more orders rather than discounting.');
      } else {
        add('good', 'Healthy', 'Pure profit margin is ' + U.pct(s.margin) + ' (' + U.birr(s.pureProfit) + '). Push it above 30% by trimming material waste and favouring your highest-margin products below.');
      }
    } else if (payments.length) {
      add('warn', 'No sales', 'There are payments of ' + U.birr(s.expenses) + ' but no income recorded in this period. Make sure every sale is entered.');
    }

    // 2. Comparison with the previous period of the same length
    if (prev && prev.sales > 0 && s.sales > 0) {
      var growth = ((s.sales - prev.sales) / prev.sales) * 100;
      var pg = prev.pureProfit !== 0 ? ((s.pureProfit - prev.pureProfit) / Math.abs(prev.pureProfit)) * 100 : NaN;
      var lvl = growth >= 5 ? 'good' : growth <= -5 ? 'warn' : 'info';
      add(lvl, 'Trend', 'Sales are ' + (growth >= 0 ? 'up ' : 'down ') + U.pct(Math.abs(growth)) + ' compared with the previous period (' + U.birr(prev.sales) + ')' +
        (isFinite(pg) ? ', and pure profit is ' + (pg >= 0 ? 'up ' : 'down ') + U.pct(Math.abs(pg)) + '.' : '.') +
        (growth <= -5 ? ' Call past customers, post new samples on social media and offer a small bulk-order deal to win volume back.' : ''));
    }

    // 3. Product mix
    var byMat = S.groupBy(income, function (r) { return r.material; }, {
      sales: function (r) { return r.total; }, cost: function (r) { return r.totalCost; }, profit: function (r) { return r.profit; }, qty: function (r) { return r.qty; }
    }).filter(function (m) { return m.sales > 0; });
    byMat.forEach(function (m) { m.margin = m.sales ? (m.profit / m.sales) * 100 : 0; });
    if (byMat.length) {
      var top = byMat.slice().sort(function (a, b) { return b.profit - a.profit; }).slice(0, 3).filter(function (m) { return m.profit > 0; });
      if (top.length) {
        add('good', 'Best earners', 'Most profit comes from ' + listNames(top.map(function (m) { return m.key + ' (' + U.birr(m.profit) + ', ' + U.pct(m.margin) + ' margin)'; })) +
          '. Keep these materials in stock, show them first to customers and consider buying them in rims for a better price.');
      }
      var weak = byMat.filter(function (m) { return m.margin < 12 && m.sales > s.sales * 0.03; }).sort(function (a, b) { return a.margin - b.margin; }).slice(0, 3);
      weak.forEach(function (m) {
        var unit = m.qty ? m.cost / m.qty : 0;
        var target = unit ? unit / (1 - 0.25) : 0;
        add(m.margin < 0 ? 'bad' : 'warn', 'Reprice', m.key + ' earns only ' + U.pct(m.margin) + ' margin on ' + U.birr(m.sales) + ' of sales.' +
          (target ? ' At an average cost of ' + U.birr(unit) + ' per unit, sell at about ' + U.birr(target) + ' per unit for a 25% margin.' : ' Review its selling price or material cost.'));
      });
      if (byMat.length >= 2) {
        var share = byMat.slice().sort(function (a, b) { return b.sales - a.sales; })[0];
        if (share.sales / s.sales > 0.6) {
          add('info', 'Diversify', share.key + ' is ' + U.pct((share.sales / s.sales) * 100) + ' of all sales. Depending on one material is risky — promote one or two other products to spread the risk.');
        }
      }
    }

    // 4. Print type
    var byPrint = S.groupBy(income.filter(function (r) { return r.printType; }), function (r) { return r.printType; }, {
      sales: function (r) { return r.total; }, profit: function (r) { return r.profit; }
    }).filter(function (p) { return p.sales > 0; });
    if (byPrint.length >= 2) {
      byPrint.forEach(function (p) { p.margin = (p.profit / p.sales) * 100; });
      byPrint.sort(function (a, b) { return b.margin - a.margin; });
      var bestP = byPrint[0], worstP = byPrint[byPrint.length - 1];
      if (bestP.margin - worstP.margin > 8) {
        add('info', 'Print type', bestP.key + ' printing has the best margin (' + U.pct(bestP.margin) + ') while ' + worstP.key + ' has the lowest (' + U.pct(worstP.margin) + '). Recommend ' + bestP.key + ' when customers are undecided, and check ink/plate costs on ' + worstP.key + '.');
      }
    }

    // 5. Money still owed
    if (s.sales > 0 && s.outstanding > 0) {
      var ratio = (s.outstanding / s.sales) * 100;
      var debtors = S.groupBy(income.filter(function (r) { return r.remaining > 0; }), function (r) { return r.phone || 'No phone'; }, { owed: function (r) { return r.remaining; } })
        .sort(function (a, b) { return b.owed - a.owed; });
      var names = debtors.slice(0, 3).map(function (d) { return d.key + ' (' + U.birr(d.owed) + ')'; });
      add(ratio > 25 ? 'bad' : ratio > 10 ? 'warn' : 'info', 'Collect money',
        U.birr(s.outstanding) + ' (' + U.pct(ratio) + ' of sales) is still unpaid by ' + debtors.length + ' customer' + (debtors.length > 1 ? 's' : '') + '. Follow up with ' + listNames(names) + '.' +
        (ratio > 25 ? ' Ask for at least 50% deposit before starting new orders.' : ''));
    }

    // 6. Costs paid out
    if (s.expenses > 0) {
      var byExp = S.groupBy(payments, function (r) { return r.material; }, { amount: function (r) { return r.amount; } })
        .sort(function (a, b) { return b.amount - a.amount; });
      var e0 = byExp[0];
      var expRatio = s.sales ? (s.expenses / s.sales) * 100 : NaN;
      add(expRatio > 60 ? 'warn' : 'info', 'Spending',
        'Payments total ' + U.birr(s.expenses) + (isFinite(expRatio) ? ' (' + U.pct(expRatio) + ' of sales)' : '') + '. The largest is ' + e0.key + ' at ' + U.birr(e0.amount) + '.' +
        (expRatio > 60 ? ' Compare at least two suppliers before the next purchase and buy only what upcoming orders need.' : ' Negotiate a bulk price with the supplier for this item.'));
    }
    if (s.cashFlow < 0) {
      add('warn', 'Cash', 'More cash went out (' + U.birr(s.expenses) + ') than came in (' + U.birr(s.collected) + '). Collect outstanding balances before making large purchases.');
    }

    // 7. Repeat customers
    var cust = S.groupBy(income.filter(function (r) { return r.phone; }), function (r) { return r.phone; }, { sales: function (r) { return r.total; } });
    var repeat = cust.filter(function (c) { return c.count >= 2; }).sort(function (a, b) { return b.sales - a.sales; });
    if (repeat.length) {
      add('good', 'Loyal customers', repeat.length + ' customer' + (repeat.length > 1 ? 's' : '') + ' ordered more than once. The top one (' + repeat[0].key + ') bought ' + U.birr(repeat[0].sales) +
        '. Reward repeat buyers with a small discount or priority service to keep them coming back.');
    } else if (cust.length >= 3) {
      add('info', 'Repeat business', 'No customer ordered twice in this period. Save every phone number and send a message when new designs or offers are ready.');
    }

    // 8. Training & packages
    var training = income.filter(function (r) { return /training/i.test(r.material); });
    if (training.length) {
      var tSales = training.reduce(function (a, r) { return a + r.total; }, 0);
      add('info', 'Training', 'Training brought in ' + U.birr(tSales) + ' from ' + training.length + ' sale' + (training.length > 1 ? 's' : '') + '. Offer trainees a starter material pack or printing package after the course.');
    }

    // 9. Busiest weekday
    if (income.length >= 7) {
      var days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      var byDay = S.groupBy(income, function (r) { return days[U.parseISO(r.date).getDay()]; }, { sales: function (r) { return r.total; } })
        .sort(function (a, b) { return b.sales - a.sales; });
      add('info', 'Timing', byDay[0].key + ' is your strongest sales day. Make sure materials and staff are ready then, and post promotions the day before.');
    }

    return out;
  }

  function listNames(arr) {
    if (arr.length <= 1) return arr.join('');
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  }

  E.insights = { analyze: analyze };
})(window);
