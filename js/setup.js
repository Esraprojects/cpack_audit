/* First-time setup helper: turns the Firebase config the owner pastes into the
   exact js/config.js text and security rules to copy, so nothing is edited by hand. */
(function () {
  'use strict';
  var form = document.getElementById('setup-form');
  if (!form) return;
  var KEYS = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];

  function parseConfig(text) {
    var out = {};
    var re = /["']?\b(apiKey|authDomain|projectId|storageBucket|messagingSenderId|appId|measurementId)\b["']?\s*:\s*["']([^"']+)["']/g;
    var m;
    while ((m = re.exec(text))) out[m[1]] = m[2].trim();
    return out;
  }

  function q(v) { return "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'"; }

  function configText(cfg, email) {
    var lines = KEYS.filter(function (k) { return cfg[k]; }).map(function (k) { return '    ' + k + ': ' + q(cfg[k]); });
    return [
      '/* Free Esra — online settings (made by the setup helper).',
      '   The Firebase web config is not a secret: access is controlled by the login',
      '   and by firestore.rules on Google\'s servers. */',
      'window.ESRA_CONFIG = {',
      '  firebase: {',
      lines.join(',\n'),
      '  },',
      '',
      '  // The owner\'s login email. Must be the same email written in firestore.rules.',
      '  ownerEmail: ' + q(email) + ',',
      '',
      '  // Ask for the owner password again after this many minutes without activity on the Owner tab.',
      '  ownerLockMinutes: 10',
      '};',
      ''
    ].join('\n');
  }

  function showError(msg) {
    var el = document.getElementById('setup-error');
    el.textContent = msg;
    el.hidden = !msg;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showError('');
    var cfg = parseConfig(document.getElementById('setup-config').value);
    var email = document.getElementById('setup-email').value.trim().toLowerCase();
    var missing = ['apiKey', 'authDomain', 'projectId', 'appId'].filter(function (k) { return !cfg[k]; });
    if (missing.length) return showError('Could not find ' + missing.join(', ') + ' in the pasted text. Copy the whole firebaseConfig block from Firebase and paste it again.');
    if (!/^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/.test(email)) return showError('Enter the owner email, for example esra@gmail.com.');

    document.getElementById('setup-config-out').textContent = configText(cfg, email);
    var rulesOut = document.getElementById('setup-rules-out');
    rulesOut.textContent = 'Loading the rules…';
    document.getElementById('setup-out').hidden = false;

    fetch('firestore.rules', { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.text();
    }).then(function (rules) {
      if (rules.indexOf('OWNER_EMAIL_HERE') === -1) throw new Error('unexpected rules file');
      rulesOut.textContent = rules.split('OWNER_EMAIL_HERE').join(email);
    }).catch(function () {
      rulesOut.textContent = 'Could not load the rules file here. Open firestore.rules from the project, copy all of it, and replace OWNER_EMAIL_HERE with ' + email + ' before publishing.';
    });
  });

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]');
    if (!b) return;
    var pre = document.getElementById(b.dataset.copy);
    var text = pre.textContent;
    var label = b.textContent;
    function done(ok) {
      b.textContent = ok ? 'Copied ✓' : 'Select the text and copy';
      setTimeout(function () { b.textContent = label; }, 2000);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { selectText(pre); done(false); });
    } else { selectText(pre); done(false); }
  });

  function selectText(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
})();
