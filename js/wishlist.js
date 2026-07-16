import { auth, db, getRef } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { get, set, remove, onValue } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { renderNavbar, renderFooter, initOfflineDetection, initTheme, showToast, formatPrice } from './utils.js';

initTheme();
renderNavbar('wishlist');
renderFooter();
initOfflineDetection();

const PLACEHOLDER = 'https://placehold.co/400x400/e2e8f0/64748b?text=No+Image';

onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = './login.html'; return; }
  listenWishlist(user.uid);
});

function listenWishlist(uid) {
  onValue(getRef(`wishlist/${uid}`), async snap => {
    const wishData = snap.exists() ? snap.val() : {};
    const ids = Object.keys(wishData);
    const countEl = document.getElementById('wishlistCount');
    if (countEl) countEl.textContent = `(${ids.length} items)`;
    if (ids.length === 0) {
      document.getElementById('wishlistGrid').innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:4rem 1rem">
          <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--border)" stroke-width="1.5" style="margin:0 auto 1.5rem;display:block"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <h2 style="font-weight:700;margin-bottom:0.5rem">Your wishlist is empty</h2>
          <p style="color:var(--text-muted);margin-bottom:1.5rem">Save items you love to buy later.</p>
          <a href="./index.html" class="btn-primary">Explore Products</a>
        </div>`;
      return;
    }
    // Load product details
    const products = await Promise.all(ids.map(async id => {
      try {
        const pSnap = await get(getRef(`products/${id}`));
        return pSnap.exists() ? { id, ...pSnap.val() } : null;
      } catch { return null; }
    }));
    const valid = products.filter(Boolean);
    const grid = document.getElementById('wishlistGrid');
    if (!grid) return;
    grid.innerHTML = valid.map(p => `
      <div class="wishlist-card" data-pid="${p.id}">
        <div class="wishlist-img">
          <a href="./product.html?id=${p.id}">
            <img src="${p.images?.[0]||PLACEHOLDER}" alt="${p.name}" loading="lazy">
          </a>
        </div>
        <div class="wishlist-info">
          <h3 class="wishlist-title"><a href="./product.html?id=${p.id}">${p.name}</a></h3>
          <div class="wishlist-price">${formatPrice(p.price)}</div>
          <div class="wishlist-actions">
            <button class="btn-primary btn-add-to-cart" data-pid="${p.id}">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
              Add to Cart
            </button>
            <button class="btn-remove-wish" data-pid="${p.id}" aria-label="Remove from wishlist">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          </div>
        </div>
      </div>`).join('');

    // Add to Cart
    grid.querySelectorAll('.btn-add-to-cart').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.pid;
        const user = auth.currentUser;
        if (!user) return;
        try {
          const cartRef = getRef(`cart/${user.uid}/${pid}`);
          const cSnap = await get(cartRef);
          const cur = cSnap.exists() ? (cSnap.val().qty||0) : 0;
          await set(cartRef, { productId: pid, qty: cur + 1, addedAt: Date.now() });
          showToast('Added to cart!');
        } catch { showToast('Failed to add to cart', 'error'); }
      });
    });

    // Remove from Wishlist
    grid.querySelectorAll('.btn-remove-wish').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pid = btn.dataset.pid;
        const user = auth.currentUser;
        if (!user) return;
        await remove(getRef(`wishlist/${user.uid}/${pid}`));
        showToast('Removed from wishlist', 'info');
      });
    });
  });
}
