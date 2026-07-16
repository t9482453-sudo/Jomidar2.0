import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getDatabase, ref, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyBJlMZBBwc_TC6OyYtFqiMJuQD5PrmLJ4g",
  authDomain: "jomidar-2-0.firebaseapp.com",
  databaseURL: "https://jomidar-2-0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jomidar-2-0",
  storageBucket: "jomidar-2-0.firebasestorage.app",
  messagingSenderId: "155854124180",
  appId: "1:155854124180:web:cb6b0d3e0fc2997da07081"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, storage, googleProvider };

export function getRef(pathStr) {
  return ref(db, pathStr);
}

export function serverNow() {
  return serverTimestamp();
}
