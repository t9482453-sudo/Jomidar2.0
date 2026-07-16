import { auth, db, getRef } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { onValue, get } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';

/* ===== THEME ===== */
export function initTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.classList.toggle('dark', saved === 'dark');
}
export function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

/* ===== TOAST ===== */
export function showToast(message, type = 'success') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = {
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
    error:   '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
    warning: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
    info:    '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `${icons[type] || ''}<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease-in forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/* ===== SPINNER ===== */
export function showSpinner() {
  const el = document.getElementById('spinnerOverlay');
  if (el) el.classList.add('active');
}
export function hideSpinner() {
  const el = document.getElementById('spinnerOverlay');
  if (el) el.classList.remove('active');
}

/* ===== SKELETON ===== */
export function showSkeleton(container, count = 8, height = '280px') {
  if (!container) return;
  container.innerHTML = Array.from({ length: count }, () => `<div class="skeleton" style="height:${height};border-radius:var(--radius-lg)"></div>`).join('');
}
export function hideSkeleton(container) {
  if (container) container.innerHTML = '';
}

/* ===== FORMAT ===== */
export function formatPrice(n) {
  const num = Number(n) || 0;
  return '৳' + num.toLocaleString('en-IN');
}
export function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
export function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600)  return Math.floor(s/60) + 'm ago';
  if (s < 86400) return Math.floor(s/3600) + 'h ago';
  return Math.floor(s/86400) + 'd ago';
}
export function renderStars(rating, max = 5) {
  let html = '<div class="stars">';
  for (let i = 1; i <= max; i++) {
    html += `<svg viewBox="0 0 24 24" class="${i <= rating ? '' : 'empty'}"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  }
  html += '</div>';
  return html;
}

/* ===== LAZY LOAD IMAGES ===== */
export function lazyLoadImages() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('img[data-src]').forEach(img => { img.src = img.dataset.src; });
    return;
  }
  const obs = new IntersectionObserver((entries, self) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const img = entry.target;
      img.src = img.dataset.src;
      img.removeAttribute('data-src');
      self.unobserve(img);
    });
  }, { rootMargin: '100px' });
  document.querySelectorAll('img[data-src]').forEach(img => obs.observe(img));
}

/* ===== CONFIRM DIALOG ===== */
export function confirmDialog(msg, title = 'Confirm') {
  return new Promise(resolve => {
    let overlay = document.getElementById('confirmModal');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'confirmModal';
      overlay.className = 'modal-overlay';
      document.body.appendChild(overlay);
    }
    overlay.innerHTML = `
      <div class="modal-card" style="max-width:400px">
        <h3>${title}</h3><p>${msg}</p>
        <div class="modal-actions">
          <button class="btn-secondary btn-sm" id="cfCancel">Cancel</button>
          <button class="btn-danger btn-sm" id="cfOk">Confirm</button>
        </div>
      </div>`;
    overlay.classList.add('active');
    overlay.querySelector('#cfCancel').onclick = () => { overlay.classList.remove('active'); resolve(false); };
    overlay.querySelector('#cfOk').onclick    = () => { overlay.classList.remove('active'); resolve(true); };
    overlay.onclick = e => { if (e.target === overlay) { overlay.classList.remove('active'); resolve(false); } };
  });
}

/* ===== OFFLINE DETECTION ===== */
export function initOfflineDetection() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;
  function update() { banner.classList.toggle('visible', !navigator.onLine); }
  update();
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
}

/* ===== REQUIRE ADMIN ===== */
export async function requireAdmin() {
  return new Promise(resolve => {
    onAuthStateChanged(auth, async user => {
      if (!user) { window.location.href = './login.html'; return; }
      try {
        const snap = await get(getRef(`users/${user.uid}`));
        const data = snap.exists() ? snap.val() : {};
        if (!data.isAdmin) { window.location.href = './index.html'; return; }
        resolve(user);
      } catch {
        window.location.href = './index.html';
      }
    });
  });
}

/* ===== MOBILE DRAWER ===== */
export function initMobileDrawer() {
  const drawer = document.getElementById('mobileDrawer');
  const backdrop = document.getElementById('drawerBackdrop');
  const openBtn = document.getElementById('hamburgerBtn');
  const closeBtn = document.getElementById('drawerCloseBtn');
  if (!drawer) return;
  function open()  { drawer.classList.add('open');  document.body.style.overflow = 'hidden'; }
  function close() { drawer.classList.remove('open'); document.body.style.overflow = ''; }
  if (openBtn)  openBtn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (backdrop) backdrop.addEventListener('click', close);
  // Close on nav link click
  drawer.querySelectorAll('.drawer-link').forEach(el => el.addEventListener('click', close));
}

/* ===== NAVBAR / FOOTER ===== */
let _cartUnsub = null;
let _wishUnsub = null;

export function renderNavbar(activePage = 'home') {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  const base = './';
  nav.innerHTML = `
    <div class="navbar-inner">
      <button class="hamburger-btn" id="hamburgerBtn" aria-label="Open menu">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>
      <a href="${base}index.html" class="nav-logo" aria-label="Jomidar 2.0 Home">
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
        Jomidar 2.0
      </a>
      <div class="nav-search" role="search">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="search" id="navSearchInput" placeholder="Search products…" aria-label="Search products">
      </div>
      <nav class="nav-actions" role="navigation" aria-label="Main navigation">
        <a href="${base}wishlist.html" class="${activePage==='wishlist'?'active':''}" aria-label="Wishlist" style="position:relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
          <span class="nav-label">Wishlist</span>
          <span class="nav-badge" id="wishlistBadge" style="display:none">0</span>
        </a>
        <a href="${base}cart.html" class="${activePage==='cart'?'active':''}" aria-label="Cart" style="position:relative">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
          <span class="nav-label">Cart</span>
          <span class="nav-badge" id="cartBadge" style="display:none">0</span>
        </a>
        <span id="navAuthArea">
          <a href="${base}login.html">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <span class="nav-label">Sign In</span>
          </a>
        </span>
        <button id="themeToggleBtn" class="btn-icon" aria-label="Toggle theme">
          <svg id="themeIcon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        </button>
      </nav>
    </div>`;

  // Theme toggle
  const themeBtn = nav.querySelector('#themeToggleBtn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Search
  const searchInput = nav.querySelector('#navSearchInput');
  if (searchInput) {
    let debounce;
    searchInput.addEventListener('input', e => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        const q = e.target.value.trim();
        if (q) window.location.href = `${base}index.html?search=${encodeURIComponent(q)}`;
      }, 500);
      searchInput.addEventListener('keydown', e2 => {
        if (e2.key === 'Enter' && searchInput.value.trim()) {
          window.location.href = `${base}index.html?search=${encodeURIComponent(searchInput.value.trim())}`;
        }
      });
    });
  }

  // Mobile search input sync
  const mobileInput = document.getElementById('mobileSearchInput');
  if (mobileInput) {
    mobileInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && mobileInput.value.trim()) {
        window.location.href = `${base}index.html?search=${encodeURIComponent(mobileInput.value.trim())}`;
      }
    });
  }

  // Auth state
  onAuthStateChanged(auth, async user => {
    const authArea = document.getElementById('navAuthArea');
    if (!authArea) return;
    if (user) {
      const snap = await get(getRef(`users/${user.uid}`)).catch(() => null);
      const isAdmin = snap && snap.exists() ? snap.val().isAdmin : false;
      authArea.innerHTML = `
        <a href="${base}profile.html" class="${activePage==='profile'?'active':''}">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          <span class="nav-label">${user.displayName ? user.displayName.split(' ')[0] : 'Profile'}</span>
        </a>
        ${isAdmin ? `<a href="${base}admin.html" style="color:var(--primary)">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          <span class="nav-label">Admin</span>
        </a>` : ''}`;
      subscribeCartBadge(user.uid);
      subscribeWishlistBadge(user.uid);
    } else {
      authArea.innerHTML = `<a href="${base}login.html"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg><span class="nav-label">Sign In</span></a>`;
    }
  });

  initMobileDrawerFromNav(base, activePage);
}

function subscribeCartBadge(uid) {
  if (_cartUnsub) _cartUnsub();
  _cartUnsub = onValue(getRef(`cart/${uid}`), snap => {
    const badge = document.getElementById('cartBadge');
    if (!badge) return;
    if (snap.exists()) {
      const count = Object.keys(snap.val()).length;
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    } else {
      badge.style.display = 'none';
    }
  });
}

function subscribeWishlistBadge(uid) {
  if (_wishUnsub) _wishUnsub();
  _wishUnsub = onValue(getRef(`wishlist/${uid}`), snap => {
    const badge = document.getElementById('wishlistBadge');
    if (!badge) return;
    if (snap.exists()) {
      const count = Object.keys(snap.val()).length;
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    } else {
      badge.style.display = 'none';
    }
  });
}

function initMobileDrawerFromNav(base, activePage) {
  const drawer = document.getElementById('mobileDrawer');
  if (!drawer) return;
  const panel = drawer.querySelector('.drawer-panel');
  if (!panel) return;
  panel.innerHTML = `
    <div class="drawer-header">
      <a href="${base}index.html" class="nav-logo" style="font-size:1.125rem">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
        Jomidar 2.0
      </a>
      <button class="btn-icon" id="drawerCloseBtn" aria-label="Close menu">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <div class="drawer-links">
      <a href="${base}index.html" class="drawer-link ${activePage==='home'?'active':''}">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        Home
      </a>
      <a href="${base}wishlist.html" class="drawer-link ${activePage==='wishlist'?'active':''}">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        Wishlist
      </a>
      <a href="${base}cart.html" class="drawer-link ${activePage==='cart'?'active':''}">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
        Cart
      </a>
      <a href="${base}orders.html" class="drawer-link ${activePage==='orders'?'active':''}">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        Orders
      </a>
      <a href="${base}profile.html" class="drawer-link ${activePage==='profile'?'active':''}">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        Profile
      </a>
      <div class="drawer-divider"></div>
      <button class="drawer-link" onclick="import('./utils.js').then(m=>m.toggleTheme())">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
        Toggle Theme
      </button>
    </div>`;
  initMobileDrawer();
}

export function renderFooter() {
  const footer = document.getElementById('footer');
  if (!footer) return;
  footer.innerHTML = `
    <div class="footer-container">
      <div class="footer-col">
        <a href="./index.html" class="footer-logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path><line x1="3" y1="6" x2="21" y2="6"></line><path d="M16 10a4 4 0 0 1-8 0"></path></svg>
          Jomidar 2.0
        </a>
        <p>Your one-stop destination for everything you need. Experience seamless shopping today.</p>
        <div class="footer-socials">
          <a href="#" aria-label="Facebook"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>
          <a href="#" aria-label="Twitter"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg></a>
          <a href="#" aria-label="Instagram"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Shop</h4>
        <div class="footer-links">
          <a href="./index.html">New Arrivals</a>
          <a href="./index.html">Flash Sale</a>
          <a href="./index.html">Popular Products</a>
          <a href="./index.html">All Categories</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Account</h4>
        <div class="footer-links">
          <a href="./profile.html">My Profile</a>
          <a href="./orders.html">My Orders</a>
          <a href="./wishlist.html">Wishlist</a>
          <a href="./cart.html">Cart</a>
        </div>
      </div>
      <div class="footer-col">
        <h4>Support</h4>
        <div class="footer-links">
          <a href="#">Help Center</a>
          <a href="#">Privacy Policy</a>
          <a href="#">Terms of Service</a>
          <a href="#">Contact Us</a>
        </div>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; ${new Date().getFullYear()} Jomidar 2.0. All rights reserved.</span>
      <div class="footer-payments">
        <span>COD</span><span>SSLCommerz</span><span>Stripe</span>
      </div>
    </div>`;
}
