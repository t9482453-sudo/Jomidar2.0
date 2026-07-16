import { auth, db, getRef } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { get, set, remove, onValue, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { renderNavbar, renderFooter, initOfflineDetection, initTheme, showToast, formatPrice } from './utils.js';

initTheme();
renderNavbar('cart');
renderFooter();
initOfflineDetection();

let cartData = {};
let productsCache = {};
let appliedCoupon = null;
const DELIVERY_FEE = 80;
const FREE_DELIVERY_THRESHOLD = 999;

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }
  listenCart(user.uid);
});

function listenCart(uid) {
  onValue(getRef(`cart/${uid}`), async snap => {
    cartData = snap.exists() ? snap.val() : {};
    await loadProductDetails();
    renderCart(uid);
  });
}

async function loadProductDetails() {
  const ids = Object.keys(cartData);
  const missing = ids.filter(id => !productsCache[id]);
  await Promise.all(missing.map(async id => {
    try {
      const snap = await get(getRef(`products/${id}`));
      if (snap.exists()) productsCache[id] = snap.val();
    } catch(e) {}
  }));
}

function renderCart(uid) {
  const itemsCol = document.getElementById('cartItemsCol');
  const summaryPanel = document.getElementById('summaryPanel');
  if (!itemsCol) return;

  const entries = Object.entries(cartData);
  if (entries.length === 0) {
    document.getElementById('cartContent').innerHTML = `
      <div style="text-align:center;padding:4rem 1rem">
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--border)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin:0 auto 1.5rem;display:block"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        <h2 style="font-size:1.5rem;font-weight:700;margin-bottom:0.5rem">Your cart is empty</h2>
        <p style="color:var(--text-muted);margin-bottom:1.5rem">Add some items to get started!</p>
        <a href="./index.html" class="btn-primary">Continue Shopping</a>
      </div>`;
    return;
  }

  // Items
  itemsCol.innerHTML = entries.map(([productId, item]) => {
    const product = productsCache[productId];
    if (!product) return '';
    const PLACEHOLDER = 'https://placehold.co/100x100/e2e8f0/64748b?text=No+Image';
    return `
      <div class="cart-item" data-pid="${productId}">
        <a href="./product.html?id=${productId}">
          <img class="cart-item-img" src="${product.images?.[0]||PLACEHOLDER}" alt="${product.name}" loading="lazy">
        </a>
        <div class="cart-item-details">
          <div class="cart-item-title"><a href="./product.html?id=${productId}">${product.name}</a></div>
          <div class="cart-item-meta">${[item.size, item.color].filter(Boolean).join(' • ')}</div>
          <div class="cart-item-price">${formatPrice(product.price)} × ${item.qty} = ${formatPrice(product.price * item.qty)}</div>
          <div class="cart-item-bottom">
            <div class="cart-qty" role="group" aria-label="Quantity">
              <button class="cart-qty-btn" data-pid="${productId}" data-action="dec" aria-label="Decrease quantity">−</button>
              <div class="cart-qty-num">${item.qty}</div>
              <button class="cart-qty-btn" data-pid="${productId}" data-action="inc" aria-label="Increase quantity">+</button>
            </div>
            <button class="cart-item-remove" data-pid="${productId}" aria-label="Remove from cart">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              Remove
            </button>
          </div>
        </div>
      </div>`;
  }).join('');

  // Events
  document.querySelectorAll('.cart-qty-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.dataset.pid;
      const action = btn.dataset.action;
      const user = auth.currentUser;
      if (!user) return;
      const current = cartData[pid]?.qty || 0;
      const product = productsCache[pid];
      if (action === 'inc') {
        const maxQ = product?.stock ?? 99;
        if (current >= maxQ) { showToast('Maximum stock reached', 'warning'); return; }
        await update(getRef(`cart/${user.uid}/${pid}`), { qty: current + 1 });
      } else {
        if (current <= 1) {
          await remove(getRef(`cart/${user.uid}/${pid}`));
        } else {
          await update(getRef(`cart/${user.uid}/${pid}`), { qty: current - 1 });
        }
      }
    });
  });

  document.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const pid = btn.dataset.pid;
      const user = auth.currentUser;
      if (!user) return;
      await remove(getRef(`cart/${user.uid}/${pid}`));
      showToast('Item removed from cart', 'info');
    });
  });

  // Summary
  updateSummary(uid, summaryPanel);
}

function calcSubtotal() {
  return Object.entries(cartData).reduce((sum, [pid, item]) => {
    const p = productsCache[pid];
    return sum + (p ? p.price * item.qty : 0);
  }, 0);
}

function updateSummary(uid, panel) {
  if (!panel) return;
  const subtotal = calcSubtotal();
  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const discount = appliedCoupon ? calcDiscount(appliedCoupon, subtotal) : 0;
  const total = subtotal + delivery - discount;

  panel.innerHTML = `
    <div class="glass-card">
      <h3>Order Summary</h3>
      <div class="coupon-section">
        <div class="coupon-form">
          <input type="text" id="couponInput" placeholder="Coupon code" value="${appliedCoupon ? appliedCoupon.code : ''}">
          <button class="btn-primary btn-sm" id="applyCouponBtn">${appliedCoupon ? 'Remove' : 'Apply'}</button>
        </div>
        ${appliedCoupon ? `<div class="coupon-applied"><span>✓ ${appliedCoupon.code} applied (${appliedCoupon.type === 'percent' ? appliedCoupon.value+'%' : '৳'+appliedCoupon.value} off)</span></div>` : ''}
      </div>
      <div class="summary-divider"></div>
      <div class="summary-row"><span>Subtotal (${Object.values(cartData).reduce((s,i)=>s+i.qty,0)} items)</span><span>${formatPrice(subtotal)}</span></div>
      <div class="summary-row"><span>Delivery</span><span>${delivery === 0 ? '<span style="color:var(--success)">Free</span>' : formatPrice(delivery)}</span></div>
      ${discount > 0 ? `<div class="summary-row" style="color:var(--success)"><span>Discount</span><span>-${formatPrice(discount)}</span></div>` : ''}
      ${subtotal < FREE_DELIVERY_THRESHOLD ? `<div class="summary-row" style="font-size:0.8125rem;color:var(--success)"><span>Add ${formatPrice(FREE_DELIVERY_THRESHOLD - subtotal)} more for free delivery</span></div>` : ''}
      <div class="summary-divider"></div>
      <div class="summary-row bold"><span>Total</span><span class="summary-total">${formatPrice(total)}</span></div>
      <a href="./checkout.html" class="btn-primary" style="display:block;text-align:center;width:100%;margin-top:1rem;padding:0.875rem;font-size:1rem">
        Proceed to Checkout
      </a>
      <div class="secure-badge">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        Safe & Secure Payment
      </div>
    </div>`;

  document.getElementById('applyCouponBtn').addEventListener('click', async () => {
    if (appliedCoupon) {
      appliedCoupon = null;
      updateSummary(uid, panel);
      showToast('Coupon removed', 'info');
      return;
    }
    const code = document.getElementById('couponInput').value.trim().toUpperCase();
    if (!code) { showToast('Enter a coupon code', 'warning'); return; }
    await applyCoupon(code, uid, panel);
  });
}

async function applyCoupon(code, uid, panel) {
  try {
    const snap = await get(getRef(`coupons/${code}`));
    if (!snap.exists()) { showToast('Invalid coupon code', 'error'); return; }
    const coupon = snap.val();
    if (!coupon.active) { showToast('This coupon has expired', 'warning'); return; }
    if (coupon.minOrder && calcSubtotal() < coupon.minOrder) {
      showToast(`Minimum order of ${formatPrice(coupon.minOrder)} required`, 'warning'); return;
    }
    appliedCoupon = { ...coupon, code };
    showToast(`Coupon "${code}" applied!`);
    updateSummary(uid, panel);
  } catch(e) { showToast('Failed to apply coupon', 'error'); }
}

function calcDiscount(coupon, subtotal) {
  if (coupon.type === 'percent') return Math.min(subtotal * coupon.value / 100, coupon.maxDiscount || Infinity);
  return Math.min(coupon.value, subtotal);
}
