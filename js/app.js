import { auth, db, getRef } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { get, set, remove, ref, push, onValue, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { renderNavbar, renderFooter, initOfflineDetection, initTheme, showToast, formatPrice, lazyLoadImages } from './utils.js';

initTheme();
renderNavbar('home');
renderFooter();
initOfflineDetection();

const PLACEHOLDER = 'https://placehold.co/400x400/e2e8f0/64748b?text=No+Image';

// ===== PRODUCT CARD =====
function productCard(product, id) {
  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100)
    : 0;
  return `
    <article class="product-card" role="listitem">
      <div class="product-img-wrap">
        <a href="./product.html?id=${id}" tabindex="-1" aria-hidden="true">
          <img class="product-img" data-src="${product.images?.[0] || PLACEHOLDER}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="${product.name}" loading="lazy">
        </a>
        ${discount > 0 ? `<span class="product-badge badge-sale">-${discount}%</span>` : ''}
        ${product.isNew ? `<span class="product-badge badge-new">New</span>` : ''}
        <button class="wishlist-quick-btn" data-pid="${id}" onclick="toggleWishlist('${id}')" aria-label="Add to wishlist">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </button>
      </div>
      <div class="product-info">
        <div class="product-category">${product.category || ''}</div>
        <h3 class="product-title"><a href="./product.html?id=${id}">${product.name}</a></h3>
        <div class="product-rating">
          ${renderStarsInline(product.avgRating || 0)}
          <span>(${product.reviewCount || 0})</span>
        </div>
        <div class="product-price">
          <span class="price-current">${formatPrice(product.price)}</span>
          ${product.originalPrice && product.originalPrice > product.price ? `<span class="price-old">${formatPrice(product.originalPrice)}</span>` : ''}
        </div>
        <button class="btn-add-cart" onclick="addToCart('${id}')" ${product.stock === 0 ? 'disabled' : ''}>
          ${product.stock === 0 ? 'Out of Stock' : '+ Add to Cart'}
        </button>
      </div>
    </article>`;
}

function renderStarsInline(r) {
  let h = '';
  for (let i = 1; i <= 5; i++) h += `<svg viewBox="0 0 24 24" class="star ${i <= r ? '' : 'empty'}" width="14" height="14"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  return h;
}

// ===== BANNERS =====
let bannerInterval;
let bannerCurrent = 0;
let bannerTotal = 0;
async function loadBanners() {
  const slider = document.getElementById('bannerSlider');
  if (!slider) return;
  try {
    const snap = await get(getRef('banners'));
    const banners = snap.exists() ? Object.values(snap.val()).filter(b => b.active !== false) : [];
    if (banners.length === 0) {
      // Default banner
      banners.push({
        title: 'Discover Amazing Deals', subtitle: 'Flash sales on top brands', cta: 'Shop Now',
        bgColor: 'linear-gradient(135deg,#1e3a8a,#7c3aed)', link: '#'
      });
    }
    bannerTotal = banners.length;
    let slidesHtml = '';
    banners.forEach((b, i) => {
      slidesHtml += `<div class="banner-slide ${i===0?'active':''}" style="background:${b.image?'none':b.bgColor||'linear-gradient(135deg,#1e3a8a,#7c3aed)'}">
        ${b.image ? `<img src="${b.image}" alt="${b.title}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0">` : ''}
        <div class="banner-content" style="position:relative;z-index:1">
          ${b.subtitle ? `<div class="banner-subtitle">${b.subtitle}</div>` : ''}
          <h2 class="banner-title">${b.title}</h2>
          <a href="${b.link||'#'}" class="banner-cta">${b.cta||'Shop Now'}</a>
        </div>
      </div>`;
    });
    if (banners.length > 1) {
      let dotsHtml = '<div class="slider-dots">' + banners.map((_, i) => `<button class="dot ${i===0?'active':''}" data-i="${i}" aria-label="Slide ${i+1}"></button>`).join('') + '</div>';
      slidesHtml += `
        <button class="slider-arrow prev" id="bannerPrev" aria-label="Previous slide">‹</button>
        <button class="slider-arrow next" id="bannerNext" aria-label="Next slide">›</button>
        ${dotsHtml}`;
    }
    slider.innerHTML = slidesHtml;

    if (banners.length > 1) {
      document.getElementById('bannerPrev').onclick = () => moveBanner(-1);
      document.getElementById('bannerNext').onclick = () => moveBanner(1);
      slider.querySelectorAll('.dot').forEach(d => d.onclick = () => goBanner(+d.dataset.i));
      bannerInterval = setInterval(() => moveBanner(1), 5000);
      slider.addEventListener('mouseenter', () => clearInterval(bannerInterval));
      slider.addEventListener('mouseleave', () => { bannerInterval = setInterval(() => moveBanner(1), 5000); });
    }
  } catch(e) { console.error('loadBanners', e); }
}
function moveBanner(dir) { goBanner((bannerCurrent + dir + bannerTotal) % bannerTotal); }
function goBanner(idx) {
  const slider = document.getElementById('bannerSlider');
  if (!slider) return;
  slider.querySelectorAll('.banner-slide').forEach((s,i) => s.classList.toggle('active', i===idx));
  slider.querySelectorAll('.dot').forEach((d,i) => d.classList.toggle('active', i===idx));
  bannerCurrent = idx;
}

// ===== CATEGORIES =====
async function loadCategories() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="skeleton" style="width:90px;height:110px;border-radius:var(--radius-lg)"></div>'.repeat(8);
  try {
    const snap = await get(getRef('categories'));
    if (!snap.exists()) { grid.innerHTML = '<p style="color:var(--text-muted);padding:1rem">No categories yet.</p>'; return; }
    const cats = Object.entries(snap.val());
    grid.innerHTML = cats.map(([id, c]) => `
      <a href="./index.html?category=${encodeURIComponent(c.name)}" class="category-card" role="listitem">
        <div class="category-icon-wrap" style="background:${c.color||'var(--primary-light)'}">
          ${c.image ? `<img src="${c.image}" alt="${c.name}" style="width:44px;height:44px;object-fit:contain">` : `<span style="font-size:1.5rem">${c.emoji||'📦'}</span>`}
        </div>
        <div class="category-name">${c.name}</div>
        <div class="category-count">${c.productCount||0}</div>
      </a>`).join('');
  } catch(e) { grid.innerHTML = ''; console.error(e); }
}

// ===== FLASH SALE =====
async function loadFlashSale() {
  const section = document.getElementById('flashSale');
  const grid = document.getElementById('flashSaleGrid');
  if (!section || !grid) return;
  try {
    const snap = await get(getRef('flashSale'));
    if (!snap.exists()) return;
    const fs = snap.val();
    if (!fs.active) return;
    section.style.display = '';
    // Countdown
    if (fs.endTime) startCountdown(fs.endTime);
    // Products
    const prodSnap = await get(getRef('products'));
    if (!prodSnap.exists()) return;
    const prods = Object.entries(prodSnap.val()).filter(([, p]) => p.flashSale && p.active !== false);
    grid.innerHTML = prods.slice(0, 8).map(([id, p]) => productCard(p, id)).join('');
    lazyLoadImages();
  } catch(e) { console.error(e); }
}
function startCountdown(endTime) {
  function tick() {
    const diff = endTime - Date.now();
    if (diff <= 0) { document.getElementById('flashSale').style.display = 'none'; return; }
    const h = Math.floor(diff/3600000), m = Math.floor((diff%3600000)/60000), s = Math.floor((diff%60000)/1000);
    const pad = n => String(n).padStart(2,'0');
    const hEl = document.getElementById('cdHours'), mEl = document.getElementById('cdMinutes'), sEl = document.getElementById('cdSeconds');
    if (hEl) hEl.textContent = pad(h);
    if (mEl) mEl.textContent = pad(m);
    if (sEl) sEl.textContent = pad(s);
  }
  tick();
  setInterval(tick, 1000);
}

// ===== PRODUCTS =====
let allProductsData = [];
let shownCount = 12;
const PAGE_SIZE = 12;
async function loadAllProducts() {
  const grid = document.getElementById('allProductsGrid');
  const newGrid = document.getElementById('newArrivalsGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="skeleton" style="height:280px;border-radius:var(--radius-lg)"></div>'.repeat(8);
  if (newGrid) newGrid.innerHTML = grid.innerHTML;
  try {
    const snap = await get(getRef('products'));
    if (!snap.exists()) { grid.innerHTML = '<p style="color:var(--text-muted);padding:2rem;text-align:center">No products yet.</p>'; return; }
    const all = Object.entries(snap.val()).filter(([, p]) => p.active !== false);
    allProductsData = all;
    // New Arrivals
    const sorted = [...all].sort((a,b) => (b[1].createdAt||0)-(a[1].createdAt||0));
    if (newGrid) {
      newGrid.innerHTML = sorted.slice(0, 8).map(([id, p]) => productCard(p, id)).join('');
      lazyLoadImages();
    }
    // All products
    renderProductsGrid(all, grid, 'all');
    initFilters();
    updateWishlistBtns();
  } catch(e) { console.error(e); grid.innerHTML = '<p style="color:var(--text-muted);padding:2rem;text-align:center">Failed to load products.</p>'; }
}

function renderProductsGrid(products, grid, filter) {
  let filtered = products;
  if (filter === 'featured') filtered = products.filter(([, p]) => p.featured);
  else if (filter === 'popular') filtered = products.filter(([, p]) => (p.reviewCount||0) > 0 || p.popular);
  shownCount = PAGE_SIZE;
  grid.innerHTML = filtered.slice(0, shownCount).map(([id, p]) => productCard(p, id)).join('');
  lazyLoadImages();
  const loadMoreBtn = document.getElementById('loadMoreBtn');
  if (loadMoreBtn) {
    loadMoreBtn.style.display = filtered.length > shownCount ? 'inline-flex' : 'none';
    loadMoreBtn.onclick = () => {
      shownCount += PAGE_SIZE;
      grid.innerHTML = filtered.slice(0, shownCount).map(([id, p]) => productCard(p, id)).join('');
      lazyLoadImages();
      loadMoreBtn.style.display = filtered.length > shownCount ? 'inline-flex' : 'none';
      updateWishlistBtns();
    };
  }
}

function initFilters() {
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProductsGrid(allProductsData, document.getElementById('allProductsGrid'), btn.dataset.filter);
      updateWishlistBtns();
    });
  });
}

// ===== SEARCH =====
const params = new URLSearchParams(location.search);
const searchQ = params.get('search');
const categoryQ = params.get('category');
if (searchQ || categoryQ) {
  setTimeout(async () => {
    try {
      const snap = await get(getRef('products'));
      if (!snap.exists()) return;
      const all = Object.entries(snap.val()).filter(([, p]) => p.active !== false);
      const filtered = all.filter(([, p]) => {
        if (searchQ) return p.name?.toLowerCase().includes(searchQ.toLowerCase()) || p.description?.toLowerCase().includes(searchQ.toLowerCase());
        if (categoryQ) return p.category?.toLowerCase() === categoryQ.toLowerCase();
        return true;
      });
      allProductsData = filtered;
      const grid = document.getElementById('allProductsGrid');
      const heading = document.querySelector('.products-section h2');
      if (heading) heading.textContent = searchQ ? `Search: "${searchQ}" (${filtered.length})` : `Category: "${categoryQ}" (${filtered.length})`;
      if (grid) renderProductsGrid(filtered, grid, 'all');
      lazyLoadImages();
    } catch(e) { console.error(e); }
  }, 200);
}

// ===== ADD TO CART =====
window.addToCart = async function(productId) {
  const user = auth.currentUser;
  if (!user) { showToast('Please sign in to add to cart', 'warning'); setTimeout(() => window.location.href='./login.html', 1500); return; }
  try {
    const snap = await get(getRef(`products/${productId}`));
    if (!snap.exists()) { showToast('Product not found', 'error'); return; }
    const product = snap.val();
    const cartRef = getRef(`cart/${user.uid}/${productId}`);
    const cartSnap = await get(cartRef);
    const currentQty = cartSnap.exists() ? (cartSnap.val().qty||0) : 0;
    if (product.stock !== undefined && currentQty + 1 > product.stock) { showToast('Not enough stock', 'warning'); return; }
    await set(cartRef, { productId, qty: currentQty + 1, addedAt: Date.now() });
    showToast(`${product.name.slice(0,30)} added to cart!`);
    // Animate badge
    const badge = document.getElementById('cartBadge');
    if (badge) { badge.style.transform = 'scale(1.4)'; setTimeout(() => badge.style.transform = '', 200); }
  } catch(e) { showToast('Failed to add to cart', 'error'); console.error(e); }
};

// ===== TOGGLE WISHLIST =====
window.toggleWishlist = async function(productId) {
  const user = auth.currentUser;
  if (!user) { showToast('Please sign in to save to wishlist', 'warning'); setTimeout(() => window.location.href='./login.html', 1500); return; }
  try {
    const wishRef = getRef(`wishlist/${user.uid}/${productId}`);
    const snap = await get(wishRef);
    if (snap.exists()) {
      await remove(wishRef);
      showToast('Removed from wishlist', 'info');
    } else {
      await set(wishRef, { productId, addedAt: Date.now() });
      showToast('Added to wishlist ❤️');
    }
    updateWishlistBtns();
  } catch(e) { showToast('Failed to update wishlist', 'error'); }
};

function updateWishlistBtns() {
  const user = auth.currentUser;
  if (!user) return;
  get(getRef(`wishlist/${user.uid}`)).then(snap => {
    const ids = snap.exists() ? Object.keys(snap.val()) : [];
    document.querySelectorAll('.wishlist-quick-btn').forEach(btn => {
      const pid = btn.dataset.pid;
      btn.classList.toggle('active', ids.includes(pid));
    });
  });
}

onAuthStateChanged(auth, user => { if (user) updateWishlistBtns(); });

// ===== INIT =====
loadBanners();
loadCategories();
loadFlashSale();
loadAllProducts();
