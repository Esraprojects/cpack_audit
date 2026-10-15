/* CPack Audit — online settings.
   Fill these in once (see SETUP.md). The Firebase web config is not a secret:
   access is controlled by the login and by firestore.rules on Google's servers. */
window.ESRA_CONFIG = {
  // Firebase console → Project settings → General → Your apps → Web app → "firebaseConfig"
  firebase: {
    apiKey: 'AIzaSyBMVwsed896gU4DkplEGyMbovOd0TEj__8',
    authDomain: 'cpack-audit-ade44.firebaseapp.com',
    projectId: 'cpack-audit-ade44',
    storageBucket: 'cpack-audit-ade44.firebasestorage.app',
    messagingSenderId: '788937379276',
    appId: '1:788937379276:web:b24cf6fcd48e310bebe169'
  },

  // The owner's login email. Must be the same email written in firestore.rules.
  ownerEmail: 'owners.cpack@gmail.com',

  // Ask for the owner password again after this many minutes without activity on the Owner tab.
  ownerLockMinutes: 10
};
