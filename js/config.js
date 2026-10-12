/* Free Esra — online settings.
   Fill these in once (see SETUP.md). The Firebase web config is not a secret:
   access is controlled by the login and by firestore.rules on Google's servers. */
window.ESRA_CONFIG = {
  // Firebase console → Project settings → General → Your apps → Web app → "firebaseConfig"
  firebase: {
    apiKey: 'PASTE_API_KEY',
    authDomain: 'PASTE_PROJECT_ID.firebaseapp.com',
    projectId: 'PASTE_PROJECT_ID',
    storageBucket: 'PASTE_PROJECT_ID.firebasestorage.app',
    messagingSenderId: 'PASTE_SENDER_ID',
    appId: 'PASTE_APP_ID'
  },

  // The owner's login email. Must be the same email written in firestore.rules.
  ownerEmail: 'OWNER_EMAIL_HERE',

  // Ask for the owner password again after this many minutes without activity on the Owner tab.
  ownerLockMinutes: 10
};
