/**
 * Where the Arcade's accounts live.
 *
 * Paste the config object from the Firebase console here (Project settings ->
 * Your apps -> the web app). These six values are meant to be public: they
 * name the project, they do not open it. What actually guards the data is the
 * Firestore rules, which are in the README.
 *
 * While apiKey and projectId are blank the Arcade still has accounts, but they
 * are kept in whichever browser made them: good enough to use, no use at all
 * on a second device. Fill these in and the same accounts start following
 * people about, with nothing else to change.
 */
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCugvC94vK_y0BQIA8GEAN-hLK7Ohk0E6Y',
  authDomain: 'the-arcade-977e1.firebaseapp.com',
  projectId: 'the-arcade-977e1',
  storageBucket: 'the-arcade-977e1.firebasestorage.app',
  messagingSenderId: '478799546960',
  appId: '1:478799546960:web:d1b89fea83acc422a45f55',
};

/** True once there is a project to talk to. */
export function isConfigured() {
  // The tests set ARCADE_DEVICE_ONLY to check the in-browser accounts without
  // reaching the real project.
  if (globalThis.ARCADE_DEVICE_ONLY) return false;
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}
