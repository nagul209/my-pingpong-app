import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { getDatabase, onValue, push, ref, remove, set } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyDjzeueCblNOUmNdETDEOhRAkhQC3Tflw8',
  authDomain: 'my-pingpong.firebaseapp.com',
  databaseURL: 'https://my-pingpong-default-rtdb.firebaseio.com/',
  projectId: 'my-pingpong',
  storageBucket: 'my-pingpong.firebasestorage.app',
  messagingSenderId: '512202176301',
  appId: '1:512202176301:web:70abc887e90d130f87c5a4',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

export async function getCurrentUser() {
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

function createRealtimeListRef(path) {
  const databaseRef = ref(database, path);

  return {
    ref: databaseRef,
    onValue(callback, errorCallback) {
      return onValue(databaseRef, callback, errorCallback);
    },
  };
}

export const membersRef = createRealtimeListRef('simple_members');
export const matchesRef = createRealtimeListRef('simple_matches');

export function pushValue(databaseRef, value) {
  return push(databaseRef, value);
}

export function setValue(path, value) {
  return set(ref(database, path), value);
}

export function removeValue(path) {
  return remove(ref(database, path));
}
