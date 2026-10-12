/* Firebase connection: login, live data and writes.
   Uses the Firebase "compat" scripts loaded in index.html. */
(function (global) {
  'use strict';
  var E = global.Esra = global.Esra || {};
  var CFG = global.ESRA_CONFIG || {};
  var RECENT_DAYS = 2; // the rules allow 3; asking for 2 leaves room for phone clock errors

  var configured = !!(CFG.firebase && CFG.firebase.apiKey && CFG.firebase.apiKey.indexOf('PASTE_') !== 0 &&
    CFG.ownerEmail && CFG.ownerEmail !== 'OWNER_EMAIL_HERE' && global.firebase);
  var useEmulator = /[?&]emulator\b/.test(location.search);

  var app, auth, fs, FieldValue, Timestamp;
  var ownerEmail = String(CFG.ownerEmail || '').trim().toLowerCase();

  function init() {
    if (!configured) return false;
    app = firebase.initializeApp(CFG.firebase);
    auth = app.auth();
    fs = app.firestore();
    if (useEmulator) {
      auth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true });
      fs.useEmulator('127.0.0.1', 8080);
    } else {
      // Keep working on weak internet: changes are stored on the device and sent when online.
      fs.enablePersistence({ synchronizeTabs: true }).catch(function () { /* not supported here */ });
    }
    FieldValue = firebase.firestore.FieldValue;
    Timestamp = firebase.firestore.Timestamp;
    return true;
  }

  function myEmail() { return auth && auth.currentUser ? String(auth.currentUser.email || '').toLowerCase() : ''; }

  // ---------- auth ----------
  function onAuth(cb) {
    return auth.onAuthStateChanged(function (user) {
      if (!user) return cb(null, null);
      var email = String(user.email || '').toLowerCase();
      if (email === ownerEmail) return cb(user, 'owner');
      fs.collection('staff').doc(email).get().then(function (snap) {
        cb(user, snap.exists && snap.data().uid === user.uid ? 'manager' : 'pending');
      }).catch(function () { cb(user, 'pending'); });
    });
  }
  function signIn(email, password) { return auth.signInWithEmailAndPassword(String(email).trim(), password); }
  function signOut() { return auth.signOut(); }
  function resetPassword(email) { return auth.sendPasswordResetEmail(String(email).trim()); }
  // Checks the password with Google's servers before the Owner tab opens.
  function reauth(password) {
    var user = auth.currentUser;
    var cred = firebase.auth.EmailAuthProvider.credential(user.email, password);
    return user.reauthenticateWithCredential(cred);
  }

  // ---------- reading ----------
  function toRecord(doc) {
    var d = doc.data({ serverTimestamps: 'estimate' });
    d.id = doc.id;
    ['createdAt', 'updatedAt'].forEach(function (k) {
      if (d[k] && d[k].toDate) d[k] = d[k].toDate().toISOString();
    });
    d.pending = doc.metadata.hasPendingWrites;
    return d;
  }
  function list(snap) { return snap.docs.map(toRecord); }

  // What the daily work needs: unpaid income + the last few days of income and payments.
  function watchRecent(cb, onError) {
    var since = Timestamp.fromDate(new Date(Date.now() - RECENT_DAYS * 86400000));
    var parts = { unpaid: [], recentIncome: [], recentPayments: [] };
    var ready = {};
    function emit(key) {
      return function (snap) {
        parts[key] = list(snap);
        ready[key] = true;
        if (!ready.unpaid || !ready.recentIncome || !ready.recentPayments) return;
        var seen = {}, income = [];
        parts.recentIncome.concat(parts.unpaid).forEach(function (r) { if (!seen[r.id]) { seen[r.id] = 1; income.push(r); } });
        cb({ income: income, payments: parts.recentPayments });
      };
    }
    var subs = [
      fs.collection('income').where('remaining', '>', 0).onSnapshot({ includeMetadataChanges: true }, emit('unpaid'), onError),
      fs.collection('income').where('createdAt', '>', since).onSnapshot({ includeMetadataChanges: true }, emit('recentIncome'), onError),
      fs.collection('payments').where('createdAt', '>', since).onSnapshot({ includeMetadataChanges: true }, emit('recentPayments'), onError)
    ];
    return function () { subs.forEach(function (u) { u(); }); };
  }

  // Owner only: every record between two dates ('' = no limit).
  function watchRange(from, to, cb, onError) {
    function q(name) {
      var ref = fs.collection(name);
      if (from) ref = ref.where('date', '>=', from);
      if (to) ref = ref.where('date', '<=', to);
      return ref;
    }
    var got = {};
    function emit(key) {
      return function (snap) {
        got[key] = list(snap);
        if (got.income && got.payments) cb({ income: got.income, payments: got.payments });
      };
    }
    var subs = [
      q('income').onSnapshot({ includeMetadataChanges: true }, emit('income'), onError),
      q('payments').onSnapshot({ includeMetadataChanges: true }, emit('payments'), onError)
    ];
    return function () { subs.forEach(function (u) { u(); }); };
  }

  function watchMemory(cb) {
    return fs.collection('memory').doc('shared').onSnapshot(function (snap) {
      cb(snap.exists ? snap.data() : null);
    }, function () { /* no access yet */ });
  }

  // ---------- writing ----------
  // Writes resolve when the server confirms; with no internet they wait and
  // sync later, so callers show "saved" straight away and only report errors.
  function add(kind, rec) {
    var ref = fs.collection(kind === 'income' ? 'income' : 'payments').doc();
    var data = Object.assign({}, rec, {
      createdBy: myEmail(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    delete data.id;
    return { id: ref.id, done: ref.set(data) };
  }
  function update(kind, id, fields) {
    var data = Object.assign({}, fields, { updatedAt: FieldValue.serverTimestamp(), updatedBy: myEmail() });
    ['id', 'createdAt', 'createdBy', 'pending'].forEach(function (k) { delete data[k]; });
    return fs.collection(kind === 'income' ? 'income' : 'payments').doc(id).update(data);
  }
  function remove(kind, id) {
    return fs.collection(kind === 'income' ? 'income' : 'payments').doc(id).delete();
  }
  function saveMemory(memory) {
    return fs.collection('memory').doc('shared').set(memory);
  }

  // ---------- staff (owner) ----------
  function watchStaff(cb, onError) {
    return fs.collection('staff').onSnapshot(function (snap) {
      cb(snap.docs.map(function (d) { var x = d.data(); x.id = d.id; return x; }));
    }, onError);
  }

  // Creates the manager's login without signing the owner out, then allows that exact account.
  async function addStaff(email, password, name) {
    email = String(email).trim().toLowerCase();
    var helper = firebase.apps.filter(function (a) { return a.name === 'staff-helper'; })[0] ||
      firebase.initializeApp(CFG.firebase, 'staff-helper');
    var hAuth = helper.auth();
    if (useEmulator && !hAuth._esraEmu) { hAuth.useEmulator('http://127.0.0.1:9099', { disableWarnings: true }); hAuth._esraEmu = true; }
    await hAuth.setPersistence(firebase.auth.Auth.Persistence.NONE);
    var cred = await hAuth.createUserWithEmailAndPassword(email, password);
    var uid = cred.user.uid;
    await hAuth.signOut();
    await fs.collection('staff').doc(email).set({
      email: email, uid: uid, name: String(name || '').trim(), role: 'manager',
      addedBy: myEmail(), addedAt: FieldValue.serverTimestamp()
    });
    return { email: email, uid: uid };
  }
  function removeStaff(email) { return fs.collection('staff').doc(email).delete(); }

  // ---------- backup (owner) ----------
  async function exportAll() {
    var res = await Promise.all([fs.collection('income').get(), fs.collection('payments').get(), fs.collection('memory').doc('shared').get()]);
    return { version: 2, exportedAt: new Date().toISOString(), income: list(res[0]), payments: list(res[1]), memory: res[2].exists ? res[2].data() : null };
  }

  async function importAll(data) {
    if (!data || !Array.isArray(data.income) || !Array.isArray(data.payments)) throw new Error('This file is not a Free Esra backup.');
    var writes = [];
    function prep(kind, r) {
      var d = Object.assign({}, r);
      var id = String(d.id || '').replace(/[\/.#$\[\]]/g, '_') || fs.collection(kind).doc().id;
      ['id', 'pending'].forEach(function (k) { delete d[k]; });
      d.createdAt = d.createdAt ? Timestamp.fromDate(new Date(d.createdAt)) : FieldValue.serverTimestamp();
      d.updatedAt = FieldValue.serverTimestamp();
      d.createdBy = d.createdBy || myEmail();
      writes.push([fs.collection(kind).doc(id), d]);
    }
    data.income.forEach(function (r) { prep('income', r); });
    data.payments.forEach(function (r) { prep('payments', r); });
    for (var i = 0; i < writes.length; i += 400) {
      var batch = fs.batch();
      writes.slice(i, i + 400).forEach(function (w) { batch.set(w[0], w[1]); });
      await batch.commit();
    }
    return writes.length;
  }

  E.cloud = {
    get configured() { return configured; },
    get emulator() { return useEmulator; },
    ownerEmail: ownerEmail,
    init: init,
    myEmail: myEmail,
    onAuth: onAuth, signIn: signIn, signOut: signOut, resetPassword: resetPassword, reauth: reauth,
    watchRecent: watchRecent, watchRange: watchRange, watchMemory: watchMemory,
    add: add, update: update, remove: remove, saveMemory: saveMemory,
    watchStaff: watchStaff, addStaff: addStaff, removeStaff: removeStaff,
    exportAll: exportAll, importAll: importAll
  };
})(window);
