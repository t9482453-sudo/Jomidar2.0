import { auth, db, getRef } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { get, set, remove, push, update } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { renderNavbar, renderFooter, initOfflineDetection, initTheme, showToast, formatPrice, showSpinner, hideSpinner } from './utils.js';

initTheme();
renderNavbar('');
renderFooter();
initOfflineDetection();

const DELIVERY_FEE = 80;
const FREE_DELIVERY_THRESHOLD = 999;

let cartItems = [];
let productsCache = {};
let appliedCoupon = null;
let currentUser = null;

onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = './login.html'; return; }
  currentUser = user;
  loadCheckoutData(user.uid);
  prefillFromProfile(user);
});

async function loadCheckoutData(uid) {
  try {
    const cartSnap = await get(getRef(`cart/${uid}`));
    if (!cartSnap.exists() || !Object.keys(cartSnap.val()).length) {
      showToast('Your cart is empty', 'warning');
      setTimeout(() => window.location.href = './cart.html', 1200);
      return;
    }
    cartItems = Object.entries(cartSnap.val());
    await loadProducts();
    renderCheckoutItems();
    updateSummary();
  } catch(e) { console.error(e); showToast('Failed to load cart', 'error'); }
}

async function loadProducts() {
  await Promise.all(cartItems.map(async ([pid]) => {
    try {
      const snap = await get(getRef(`products/${pid}`));
      if (snap.exists()) productsCache[pid] = snap.val();
    } catch {}
  }));
}

function renderCheckoutItems() {
  const list = document.getElementById('checkoutItemsList');
  if (!list) return;
  const PLACEHOLDER = 'https://placehold.co/60x60/e2e8f0/64748b?text=?';
  list.innerHTML = cartItems.map(([pid, item]) => {
    const p = productsCache[pid];
    if (!p) return '';
    return `
      <div style="display:flex;align-items:center;gap:0.75rem;padding:0.5rem 0;border-bottom:1px solid var(--border)">
        <img src="${p.images?.[0]||PLACEHOLDER}" style="width:50px;height:50px;object-fit:cover;border-radius:var(--radius-sm);border:1px solid var(--border)" alt="${p.name}">
        <div style="flex:1;min-width:0">
          <div style="font-size:0.8125rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
          <div style="font-size:0.75rem;color:var(--text-muted)">Qty: ${item.qty}</div>
        </div>
        <div style="font-weight:700;font-size:0.875rem;white-space:nowrap">${formatPrice(p.price * item.qty)}</div>
      </div>`;
  }).join('');
}

function calcSubtotal() {
  return cartItems.reduce((sum, [pid, item]) => {
    const p = productsCache[pid];
    return sum + (p ? p.price * item.qty : 0);
  }, 0);
}
function calcDiscount(coupon, subtotal) {
  if (!coupon) return 0;
  if (coupon.type === 'percent') return Math.min(subtotal * coupon.value / 100, coupon.maxDiscount || Infinity);
  return Math.min(coupon.value, subtotal);
}

function updateSummary() {
  const subtotal = calcSubtotal();
  const delivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  const discount = calcDiscount(appliedCoupon, subtotal);
  const total = subtotal + delivery - discount;
  const sub = document.getElementById('subtotalDisplay');
  const del = document.getElementById('deliveryDisplay');
  const tot = document.getElementById('totalDisplay');
  const discRow = document.getElementById('discountRow');
  const discDisp = document.getElementById('discountDisplay');
  if (sub) sub.textContent = formatPrice(subtotal);
  if (del) del.textContent = delivery === 0 ? 'Free' : formatPrice(delivery);
  if (tot) tot.textContent = formatPrice(total);
  if (discRow) discRow.style.display = discount > 0 ? 'flex' : 'none';
  if (discDisp) discDisp.textContent = `-${formatPrice(discount)}`;
}

// Payment method selection
document.querySelectorAll('input[name="payment"]').forEach(radio => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.payment-option').forEach(el => el.classList.remove('selected'));
    radio.closest('.payment-option').classList.add('selected');
  });
});

// Coupon
document.getElementById('applyCouponBtn')?.addEventListener('click', async () => {
  const input = document.getElementById('couponInput');
  const msg   = document.getElementById('couponMsg');
  const code  = input?.value.trim().toUpperCase();
  if (!code) { showToast('Enter a coupon code', 'warning'); return; }
  try {
    const snap = await get(getRef(`coupons/${code}`));
    if (!snap.exists()) { if(msg) msg.innerHTML = '<span style="color:var(--danger);font-size:0.8125rem">Invalid coupon code</span>'; return; }
    const coupon = snap.val();
    if (!coupon.active) { if(msg) msg.innerHTML = '<span style="color:var(--danger);font-size:0.8125rem">This coupon has expired</span>'; return; }
    if (coupon.minOrder && calcSubtotal() < coupon.minOrder) {
      if(msg) msg.innerHTML = `<span style="color:var(--warning);font-size:0.8125rem">Min. order ${formatPrice(coupon.minOrder)} required</span>`;
      return;
    }
    appliedCoupon = { ...coupon, code };
    if(msg) msg.innerHTML = `<span style="color:var(--success);font-size:0.8125rem">✓ Coupon applied!</span>`;
    updateSummary();
    showToast(`Coupon "${code}" applied!`);
  } catch { showToast('Failed to apply coupon', 'error'); }
});

async function prefillFromProfile(user) {
  try {
    const snap = await get(getRef(`users/${user.uid}`));
    if (!snap.exists()) return;
    const data = snap.val();
    if (document.getElementById('email')) document.getElementById('email').value = user.email || '';
    if (data.name && document.getElementById('firstName')) {
      const parts = data.name.split(' ');
      document.getElementById('firstName').value = parts[0] || '';
      if (parts.length > 1) document.getElementById('lastName').value = parts.slice(1).join(' ');
    }
    if (data.phone && document.getElementById('phone')) document.getElementById('phone').value = data.phone;
    if (data.defaultAddress) {
      const addr = data.defaultAddress;
      if (document.getElementById('address')) document.getElementById('address').value = addr.line || '';
      if (document.getElementById('city'))    document.getElementById('city').value    = addr.city || '';
    }
  } catch {}
}

// Place Order
document.getElementById('placeOrderBtn')?.addEventListener('click', async () => {
  if (!currentUser) return;
  const firstName = document.getElementById('firstName')?.value.trim();
  const lastName  = document.getElementById('lastName')?.value.trim();
  const email     = document.getElementById('email')?.value.trim();
  const phone     = document.getElementById('phone')?.value.trim();
  const address   = document.getElementById('address')?.value.trim();
  const city      = document.getElementById('city')?.value.trim();
  const district  = document.getElementById('district')?.value.trim();
  const notes     = document.getElementById('notes')?.value.trim();
  const payment   = document.querySelector('input[name="payment"]:checked')?.value || 'cod';

  if (!firstName || !email || !phone || !address || !city) {
    showToast('Please fill in all required fields', 'warning'); return;
  }
  if (['sslcommerz', 'stripe'].includes(payment)) {
    showToast('This payment method is coming soon. Please use COD.', 'info'); return;
  }

  showSpinner();
  try {
    const subtotal = calcSubtotal();
    const delivery = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
    const discount = calcDiscount(appliedCoupon, subtotal);
    const total    = subtotal + delivery - discount;
    const orderItems = cartItems.map(([pid, item]) => ({
      productId: pid,
      name:  productsCache[pid]?.name   || 'Unknown',
      price: productsCache[pid]?.price  || 0,
      image: productsCache[pid]?.images?.[0] || '',
      qty:   item.qty,
      size:  item.size  || '',
      color: item.color || '',
    }));

    const orderRef = push(getRef('orders'));
    const orderId  = orderRef.key;
    const orderData = {
      orderId,
      userId: currentUser.uid,
      userName: `${firstName} ${lastName}`.trim(),
      userEmail: email,
      phone,
      address: `${address}, ${city}${district ? ', '+district : ''}`,
      notes,
      items: orderItems,
      subtotal, delivery, discount, total,
      coupon: appliedCoupon?.code || '',
      paymentMethod: payment,
      paymentStatus: 'pending',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await set(orderRef, orderData);
    // Also save to user orders index
    await set(getRef(`userOrders/${currentUser.uid}/${orderId}`), { orderId, createdAt: Date.now(), total, status: 'pending' });
    // Update stock
    await Promise.all(orderItems.map(async item => {
      try {
        const pSnap = await get(getRef(`products/${item.productId}`));
        if (pSnap.exists()) {
          const curStock = pSnap.val().stock || 0;
          await update(getRef(`products/${item.productId}`), { stock: Math.max(0, curStock - item.qty) });
        }
      } catch {}
    }));
    // Clear cart
    await set(getRef(`cart/${currentUser.uid}`), null);
    hideSpinner();
    showToast(`Order placed! Order #${orderId.slice(-8).toUpperCase()} confirmed.`);
    setTimeout(() => window.location.href = `./orders.html`, 1200);
  } catch(e) {
    hideSpinner();
    console.error(e);
    showToast('Failed to place order. Please try again.', 'error');
  }
});
