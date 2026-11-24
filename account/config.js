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
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

/** True once there is a project to talk to. */
export function isConfigured() {
  return Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId);
}
