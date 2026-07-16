import { auth, db, getRef } from './firebase.js';
import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider,
  updateProfile, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { set, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { initTheme, showToast, showSpinner, hideSpinner, initOfflineDetection } from './utils.js';

initTheme();
initOfflineDetection();

const REDIRECT = './index.html';

// Already signed in — redirect
onAuthStateChanged(auth, user => {
  if (user) {
    const page = location.pathname;
    if (page.includes('login') || page.includes('signup') || page.includes('forgot-password')) {
      window.location.href = REDIRECT;
    }
  }
});

// ==== TOGGLE PASSWORD VISIBILITY ====
document.querySelectorAll('.toggle-pw').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.previousElementSibling || btn.parentElement.querySelector('input');
    if (!input) return;
    const isVisible = input.type === 'text';
    input.type = isVisible ? 'password' : 'text';
    btn.querySelector('svg').style.opacity = isVisible ? '1' : '0.4';
  });
});

// ==== PASSWORD STRENGTH ====
const pwInput = document.getElementById('password');
if (pwInput) {
  pwInput.addEventListener('input', () => {
    const val = pwInput.value;
    const bar = document.getElementById('strengthBar');
    const txt = document.getElementById('strengthText');
    if (!bar || !txt) return;
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong'];
    const colors = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'];
    bar.style.width = `${score * 20}%`;
    bar.style.background = colors[score];
    txt.textContent = val ? labels[score] || '' : '';
    txt.style.color = colors[score];
  });
}

// ==== LOGIN ====
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;
    if (!email || !password) { showToast('Please fill in all fields', 'warning'); return; }
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'Signing in…';
    showSpinner();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('Welcome back!');
      setTimeout(() => window.location.href = REDIRECT, 800);
    } catch(err) {
      hideSpinner();
      btn.disabled = false; btn.textContent = 'Sign In';
      showToast(friendlyError(err.code), 'error');
    }
  });
}

// ==== SIGNUP ====
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', async e => {
    e.preventDefault();
    const name = signupForm.name?.value.trim() || '';
    const email = signupForm.email.value.trim();
    const phone = signupForm.phone?.value.trim() || '';
    const password = signupForm.password.value;
    const confirm = signupForm.confirmPassword?.value;
    if (!name || !email || !password) { showToast('Please fill all required fields', 'warning'); return; }
    if (password !== confirm) { showToast('Passwords do not match', 'error'); return; }
    if (password.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    const btn = document.getElementById('signupBtn');
    btn.disabled = true; btn.textContent = 'Creating account…';
    showSpinner();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      await set(getRef(`users/${cred.user.uid}`), {
        uid: cred.user.uid, name, email, phone,
        isAdmin: false, createdAt: Date.now()
      });
      showToast('Account created! Welcome to Jomidar 2.0 🎉');
      setTimeout(() => window.location.href = REDIRECT, 900);
    } catch(err) {
      hideSpinner();
      btn.disabled = false; btn.textContent = 'Create Account';
      showToast(friendlyError(err.code), 'error');
    }
  });
}

// ==== FORGOT PASSWORD ====
const forgotForm = document.getElementById('forgotForm');
if (forgotForm) {
  forgotForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('email')?.value.trim();
    if (!email) { showToast('Please enter your email', 'warning'); return; }
    showSpinner();
    try {
      await sendPasswordResetEmail(auth, email);
      hideSpinner();
      showToast('Reset link sent! Check your inbox.', 'info');
      forgotForm.reset();
    } catch(err) {
      hideSpinner();
      showToast(friendlyError(err.code), 'error');
    }
  });
}

// ==== GOOGLE AUTH ====
async function handleGoogle() {
  const provider = new GoogleAuthProvider();
  showSpinner();
  try {
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;
    const snap = await get(getRef(`users/${user.uid}`));
    if (!snap.exists()) {
      await set(getRef(`users/${user.uid}`), {
        uid: user.uid, name: user.displayName, email: user.email,
        avatar: user.photoURL || '', isAdmin: false, createdAt: Date.now()
      });
    }
    showToast('Signed in with Google!');
    setTimeout(() => window.location.href = REDIRECT, 700);
  } catch(err) {
    hideSpinner();
    if (err.code !== 'auth/popup-closed-by-user') showToast(friendlyError(err.code), 'error');
  }
}
document.getElementById('googleLoginBtn')?.addEventListener('click', handleGoogle);
document.getElementById('googleSignupBtn')?.addEventListener('click', handleGoogle);

// ==== ERROR MESSAGES ====
function friendlyError(code) {
  const map = {
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password. Please try again.',
    'auth/invalid-credential':   'Invalid email or password.',
    'auth/email-already-in-use': 'An account with this email already exists.',
    'auth/weak-password':        'Password is too weak (min 6 characters).',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/too-many-requests':    'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  };
  return map[code] || 'Something went wrong. Please try again.';
}
