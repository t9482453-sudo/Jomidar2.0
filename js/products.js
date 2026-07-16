import { auth, db, getRef } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { get, set, remove, push, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { renderNavbar, renderFooter, initOfflineDetection, initTheme, showToast, formatPrice, formatDate, renderStars, lazyLoadImages, initMobileDrawer } from './utils.js';

initTheme();
renderNavbar('');
renderFooter();
initOfflineDetection();

const params = new URLSearchParams(location.search);
const productId = params.get('id');
const PLACEHOLDER = 'https://placehold.co/600x600/e2e8f0/64748b?text=No+Image';

if (!productId) {
  document.getElementById('productSkeleton').innerHTML = '<p style="padding:2rem;color:var(--text-muted)">No product specified. <a href="./index.html">Go back</a></p>';
} else {
  loadProduct();
}

async function loadProduct() {
  try {
    const snap = await get(getRef(`products/${productId}`));
    if (!snap.exists()) {
      document.getElementById('productSkeleton').innerHTML = '<p style="padding:2rem;color:var(--text-muted)">Product not found. <a href="./index.html">Go back</a></p>';
      return;
    }
    const product = snap.val();
    document.title = `${product.name} | Jomidar 2.0`;
    document.getElementById('breadcrumbCat').textContent = product.category || 'Product';
    document.getElementById('breadcrumbName').textContent = product.name;
    renderProductDetail(product);
    loadReviews();
    loadRelatedProducts(product.category);
  } catch(e) {
    console.error(e);
    document.getElementById('productSkeleton').innerHTML = '<p style="padding:2rem;color:var(--text-muted)">Failed to load product. <a href="./index.html">Go back</a></p>';
  }
}

function renderProductDetail(product) {
  const images = product.images?.length ? product.images : [PLACEHOLDER];
  const discount = product.originalPrice && product.originalPrice > product.price
    ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;
  const sizes  = product.sizes  ? JSON.parse(product.sizes)  : [];
  const colors = product.colors ? JSON.parse(product.colors) : [];

  const skeletonEl = document.getElementById('productSkeleton');
  const container  = document.getElementById('productContent');
  if (!container) return;

  let html = `
    <div class="product-detail-grid">
      <!-- Gallery -->
      <div class="product-gallery">
        <div class="product-main-img">
          <img id="mainImg" src="${images[0]}" alt="${product.name}">
        </div>
        ${images.length > 1 ? `
          <div class="product-thumbnails">
            ${images.map((img, i) => `
              <div class="product-thumb ${i===0?'active':''}" data-idx="${i}" role="button" tabindex="0" aria-label="View image ${i+1}">
                <img src="${img}" alt="Image ${i+1}">
              </div>`).join('')}
          </div>` : ''}
      </div>
      <!-- Info -->
      <div class="product-detail-info">
        <div class="product-detail-cat">${product.category || 'Product'}</div>
        <h1 class="product-detail-title">${product.name}</h1>
        ${product.brand ? `<div class="product-detail-brand">Brand: <span>${product.brand}</span></div>` : ''}
        <div class="product-detail-rating">
          ${renderStars(Math.round(product.avgRating || 0))}
          <span>${(product.avgRating||0).toFixed(1)} (${product.reviewCount||0} reviews)</span>
        </div>
        <div class="product-detail-price">
          <span class="detail-price-current">${formatPrice(product.price)}</span>
          ${product.originalPrice && product.originalPrice > product.price ? `
            <span class="detail-price-old">${formatPrice(product.originalPrice)}</span>
            <span class="detail-price-discount">-${discount}%</span>` : ''}
        </div>
        <div class="product-divider"></div>
        <div class="product-stock">
          <div class="stock-dot ${product.stock === 0 ? 'out' : ''}"></div>
          ${product.stock === 0 ? 'Out of Stock' : product.stock < 10 ? `Only ${product.stock} left!` : 'In Stock'}
        </div>
        ${sizes.length ? `
          <div class="variant-group">
            <div class="variant-label">Size</div>
            <div class="variant-options" id="sizeOptions">
              ${sizes.map(s => `<button class="variant-btn" data-size="${s}">${s}</button>`).join('')}
            </div>
          </div>` : ''}
        ${colors.length ? `
          <div class="variant-group">
            <div class="variant-label">Color</div>
            <div class="variant-options" id="colorOptions">
              ${colors.map(c => `<button class="color-btn" data-color="${c}" style="background:${c}" title="${c}"></button>`).join('')}
            </div>
          </div>` : ''}
        <div class="form-group">
          <div class="variant-label" style="margin-bottom:0.5rem">Quantity</div>
          <div class="qty-wrap">
            <button class="qty-btn" id="qtyDec" aria-label="Decrease">−</button>
            <div class="qty-display" id="qtyDisplay">1</div>
            <button class="qty-btn" id="qtyInc" aria-label="Increase">+</button>
          </div>
        </div>
        <div class="product-actions">
          <button class="btn-primary" id="addToCartBtn" ${product.stock === 0 ? 'disabled' : ''}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
          </button>
          <button class="btn-wishlist" id="wishlistBtn" aria-label="Add to wishlist">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </button>
        </div>
        <div class="product-features">
          <div class="feature-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
            Free Delivery on ৳999+
          </div>
          <div class="feature-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            7-Day Returns
          </div>
          <div class="feature-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Authenticity Guaranteed
          </div>
        </div>
      </div>
    </div>

    <!-- Tabs -->
    <div style="margin-top:2.5rem">
      <div class="product-tabs">
        <button class="product-tab-btn active" data-tab="description">Description</button>
        <button class="product-tab-btn" data-tab="reviews">Reviews (${product.reviewCount||0})</button>
        <button class="product-tab-btn" data-tab="shipping">Shipping</button>
      </div>
      <div class="tab-content active" id="tab-description">
        <p style="line-height:1.8;color:var(--text-muted)">${product.description || 'No description available.'}</p>
        ${product.specs ? `<div style="margin-top:1rem"><h4 style="font-weight:700;margin-bottom:0.5rem">Specifications</h4><div style="font-size:0.9rem;color:var(--text-muted)">${product.specs}</div></div>` : ''}
      </div>
      <div class="tab-content" id="tab-reviews">
        <div id="reviewsList"></div>
        <div id="reviewFormWrap"></div>
      </div>
      <div class="tab-content" id="tab-shipping">
        <ul style="color:var(--text-muted);line-height:2;padding-left:1.25rem">
          <li>Free delivery on orders above ৳999</li>
          <li>Standard delivery: 3-5 business days (৳80)</li>
          <li>Express delivery: 1-2 business days (৳150)</li>
          <li>7-day hassle-free returns</li>
          <li>Cash on Delivery available</li>
        </ul>
      </div>
    </div>`;

  container.innerHTML = html;
  if (skeletonEl && skeletonEl !== container) skeletonEl.remove();

  // Thumbnails
  document.querySelectorAll('.product-thumb').forEach(thumb => {
    thumb.addEventListener('click', () => {
      document.querySelectorAll('.product-thumb').forEach(t => t.classList.remove('active'));
      thumb.classList.add('active');
      document.getElementById('mainImg').src = images[+thumb.dataset.idx];
    });
    thumb.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') thumb.click(); });
  });

  // Quantity
  let qty = 1;
  document.getElementById('qtyDec').addEventListener('click', () => { if (qty > 1) { qty--; document.getElementById('qtyDisplay').textContent = qty; } });
  document.getElementById('qtyInc').addEventListener('click', () => {
    const maxQ = product.stock || 99;
    if (qty < maxQ) { qty++; document.getElementById('qtyDisplay').textContent = qty; }
  });

  // Variants
  document.querySelectorAll('.variant-btn').forEach(btn => btn.addEventListener('click', () => {
    const group = btn.closest('.variant-options');
    group.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }));
  document.querySelectorAll('.color-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  }));

  // Tabs
  document.querySelectorAll('.product-tab-btn').forEach(btn => btn.addEventListener('click', () => {
    document.querySelectorAll('.product-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
  }));

  // Add to cart
  document.getElementById('addToCartBtn')?.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) { showToast('Please sign in', 'warning'); setTimeout(() => location.href='./login.html', 1200); return; }
    try {
      const cartRef = getRef(`cart/${user.uid}/${productId}`);
      const snap = await get(cartRef);
      const cur = snap.exists() ? (snap.val().qty||0) : 0;
      const size = document.querySelector('.variant-btn.active')?.dataset.size || '';
      const color = document.querySelector('.color-btn.active')?.dataset.color || '';
      await set(cartRef, { productId, qty: cur + qty, size, color, addedAt: Date.now() });
      showToast(`${product.name.slice(0,30)} added to cart!`);
    } catch(e) { showToast('Failed to add to cart', 'error'); }
  });

  // Wishlist
  const wishBtn = document.getElementById('wishlistBtn');
  if (wishBtn) {
    onAuthStateChanged(auth, async user => {
      if (!user) return;
      const snap = await get(getRef(`wishlist/${user.uid}/${productId}`));
      wishBtn.classList.toggle('active', snap.exists());
    });
    wishBtn.addEventListener('click', async () => {
      const user = auth.currentUser;
      if (!user) { showToast('Please sign in', 'warning'); return; }
      const wishRef = getRef(`wishlist/${user.uid}/${productId}`);
      const snap = await get(wishRef);
      if (snap.exists()) {
        await remove(wishRef);
        wishBtn.classList.remove('active');
        showToast('Removed from wishlist', 'info');
      } else {
        await set(wishRef, { productId, addedAt: Date.now() });
        wishBtn.classList.add('active');
        showToast('Added to wishlist ❤️');
      }
    });
  }
}

async function loadReviews() {
  const list = document.getElementById('reviewsList');
  if (!list) return;
  try {
    const snap = await get(getRef(`reviews/${productId}`));
    if (!snap.exists()) { list.innerHTML = '<p style="color:var(--text-muted);padding:1rem 0">No reviews yet. Be the first!</p>'; }
    else {
      const reviews = Object.entries(snap.val()).sort((a,b) => (b[1].createdAt||0)-(a[1].createdAt||0));
      list.innerHTML = reviews.map(([, r]) => `
        <div class="review-card">
          <div class="review-header">
            <div class="reviewer-info">
              <div class="reviewer-avatar" style="background:var(--primary-light);color:var(--primary)">${r.userName?.[0]?.toUpperCase()||'U'}</div>
              <div>
                <div class="reviewer-name">${r.userName || 'Anonymous'}</div>
                <div class="review-date">${formatDate(r.createdAt)}</div>
              </div>
            </div>
            ${renderStars(r.rating)}
          </div>
          <p class="review-text">${r.comment || ''}</p>
        </div>`).join('');
    }
    renderReviewForm();
  } catch(e) { console.error(e); }
}

function renderReviewForm() {
  const wrap = document.getElementById('reviewFormWrap');
  if (!wrap) return;
  const user = auth.currentUser;
  if (!user) {
    wrap.innerHTML = `<div class="review-form"><p>Please <a href="./login.html">sign in</a> to leave a review.</p></div>`;
    return;
  }
  wrap.innerHTML = `
    <div class="review-form">
      <h4>Write a Review</h4>
      <div class="form-group">
        <label class="form-label">Rating</label>
        <div class="star-picker" id="starPicker" style="display:flex;gap:0.25rem;cursor:pointer"></div>
        <input type="hidden" id="reviewRating" value="0">
      </div>
      <div class="form-group">
        <label class="form-label">Your Review</label>
        <textarea id="reviewComment" rows="3" placeholder="Share your experience…" style="width:100%"></textarea>
      </div>
      <button class="btn-primary btn-sm" id="submitReviewBtn">Submit Review</button>
    </div>`;
  let selectedRating = 0;
  const picker = document.getElementById('starPicker');
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement('svg');
    star.setAttribute('viewBox', '0 0 24 24');
    star.setAttribute('width', '28'); star.setAttribute('height', '28');
    star.style.transition = 'fill 0.1s, transform 0.1s';
    star.innerHTML = '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>';
    star.dataset.val = i;
    picker.appendChild(star);
    star.addEventListener('click', () => {
      selectedRating = i;
      document.getElementById('reviewRating').value = i;
      picker.querySelectorAll('svg').forEach((s, j) => {
        s.style.fill = j < i ? '#f59e0b' : 'none';
        s.style.stroke = '#f59e0b';
      });
    });
  }
  picker.querySelectorAll('svg').forEach(s => { s.style.fill='none'; s.style.stroke='#d1d5db'; });
  document.getElementById('submitReviewBtn').addEventListener('click', async () => {
    const comment = document.getElementById('reviewComment').value.trim();
    const rating  = +document.getElementById('reviewRating').value;
    if (!rating) { showToast('Please select a rating', 'warning'); return; }
    if (!comment) { showToast('Please write a comment', 'warning'); return; }
    try {
      const reviewRef = getRef(`reviews/${productId}/${user.uid}`);
      await set(reviewRef, { userId: user.uid, userName: user.displayName||'User', rating, comment, createdAt: Date.now(), approved: true });
      // Update product avg rating
      const allSnap = await get(getRef(`reviews/${productId}`));
      if (allSnap.exists()) {
        const reviews = Object.values(allSnap.val());
        const avg = reviews.reduce((s, r) => s + (r.rating||0), 0) / reviews.length;
        await update(getRef(`products/${productId}`), { avgRating: Math.round(avg*10)/10, reviewCount: reviews.length });
      }
      showToast('Review submitted! Thank you.');
      loadReviews();
    } catch(e) { showToast('Failed to submit review', 'error'); }
  });
}

async function loadRelatedProducts(category) {
  if (!category) return;
  const section = document.getElementById('relatedSection');
  const grid = document.getElementById('relatedGrid');
  if (!section || !grid) return;
  try {
    const snap = await get(getRef('products'));
    if (!snap.exists()) return;
    const related = Object.entries(snap.val())
      .filter(([id, p]) => p.category === category && id !== productId && p.active !== false)
      .slice(0, 8);
    if (!related.length) return;
    section.style.display = '';
    const PLACEHOLDER2 = 'https://placehold.co/400x400/e2e8f0/64748b?text=No+Image';
    grid.innerHTML = related.map(([id, p]) => {
      const disc = p.originalPrice && p.originalPrice > p.price ? Math.round((1 - p.price/p.originalPrice)*100) : 0;
      return `
        <article class="product-card" role="listitem">
          <div class="product-img-wrap">
            <a href="./product.html?id=${id}" tabindex="-1">
              <img class="product-img" data-src="${p.images?.[0]||PLACEHOLDER2}" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="${p.name}" loading="lazy">
            </a>
            ${disc ? `<span class="product-badge badge-sale">-${disc}%</span>` : ''}
          </div>
          <div class="product-info">
            <h3 class="product-title"><a href="./product.html?id=${id}">${p.name}</a></h3>
            <div class="product-price"><span class="price-current">${formatPrice(p.price)}</span></div>
            <button class="btn-add-cart" onclick="window.addToCartGlobal('${id}')">+ Add to Cart</button>
          </div>
        </article>`;
    }).join('');
    lazyLoadImages();
  } catch(e) { console.error(e); }
}

window.addToCartGlobal = async function(pid) {
  const user = auth.currentUser;
  if (!user) { showToast('Please sign in', 'warning'); return; }
  try {
    const snap = await get(getRef(`products/${pid}`));
    if (!snap.exists()) return;
    const cartRef = getRef(`cart/${user.uid}/${pid}`);
    const cartSnap = await get(cartRef);
    const cur = cartSnap.exists() ? (cartSnap.val().qty||0) : 0;
    await set(cartRef, { productId: pid, qty: cur + 1, addedAt: Date.now() });
    showToast('Added to cart!');
  } catch(e) { showToast('Failed to add to cart', 'error'); }
};
