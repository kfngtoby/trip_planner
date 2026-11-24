/* Firebase web config. Leave FIREBASE_CONFIG as null and the app works exactly as before (data stays on the device).
   Paste the object from Firebase console → Project settings → Your apps → Web app → "firebaseConfig". These values are
   not secrets; access is controlled by firestore.rules and by sign-in. The Gemini key is NOT here: it lives only in the Cloud Function. */
window.FIREBASE_CONFIG = null;
/* e.g.
window.FIREBASE_CONFIG = {
  apiKey: '...', authDomain: 'your-project.firebaseapp.com', projectId: 'your-project',
  storageBucket: 'your-project.appspot.com', messagingSenderId: '...', appId: '...'
};
*/
window.FUNCTIONS_REGION = 'us-central1'; // must match the region in functions/index.js
