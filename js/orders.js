import { auth, db, getRef } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { get, update, onValue } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { renderNavbar, renderFooter, initOfflineDetection, initTheme, showToast, formatPrice, formatDate, confirmDialog } from './utils.js';

initTheme();
renderNavbar('orders');
renderFooter();
initOfflineDetection();

let allOrders = [];
let activeFilter = 'all';

onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = './login.html'; return; }
  loadOrders(user.uid);
});

async function loadOrders(uid) {
  try {
    const snap = await get(getRef('orders'));
    if (!snap.exists()) { renderEmpty(); return; }
    allOrders = Object.entries(snap.val())
      .filter(([, o]) => o.userId === uid)
      .sort((a, b) => (b[1].createdAt||0) - (a[1].createdAt||0));
    renderOrders(allOrders);
  } catch(e) { console.error(e); showToast('Failed to load orders', 'error'); }
}

function renderOrders(orders) {
  const container = document.getElementById('ordersContent');
  if (!container) return;
  const filtered = activeFilter === 'all' ? orders : orders.filter(([, o]) => o.status === activeFilter);
  if (!filtered.length) { container.innerHTML = renderEmpty(); return; }
  container.innerHTML = filtered.map(([id, order]) => renderOrderCard(id, order)).join('');
  document.querySelectorAll('.cancel-order-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const confirmed = await confirmDialog('Cancel this order?', 'Cancel Order');
      if (!confirmed) return;
      const oid = btn.dataset.oid;
      try {
        await update(getRef(`orders/${oid}`), { status: 'cancelled', updatedAt: Date.now() });
        showToast('Order cancelled', 'info');
        const user = auth.currentUser;
        if (user) loadOrders(user.uid);
      } catch { showToast('Failed to cancel order', 'error'); }
    });
  });
}

function renderOrderCard(id, order) {
  const statusColors = {
    pending:    '#f59e0b',
    processing: '#3b82f6',
    shipped:    '#8b5cf6',
    delivered:  '#10b981',
    cancelled:  '#ef4444',
  };
  const PLACEHOLDER = 'https://placehold.co/50x50/e2e8f0/64748b?text=?';
  const items = Array.isArray(order.items) ? order.items : Object.values(order.items || {});
  const canCancel = ['pending', 'processing'].includes(order.status);
  return `
    <div class="order-card">
      <div class="order-header">
        <div>
          <div class="order-id">Order #${id.slice(-8).toUpperCase()}</div>
          <div class="order-date">${formatDate(order.createdAt)}</div>
        </div>
        <span class="badge" style="background:${statusColors[order.status]||'#6b7280'}1a;color:${statusColors[order.status]||'#6b7280'};border:1px solid ${statusColors[order.status]||'#6b7280'}40;font-weight:600;border-radius:999px;padding:0.25rem 0.875rem;font-size:0.8125rem;text-transform:capitalize">
          ${order.status}
        </span>
      </div>
      <div class="order-items-list">
        ${items.slice(0, 3).map(item => `
          <div class="order-item-row">
            <img class="order-item-img" src="${item.image||PLACEHOLDER}" alt="${item.name}" loading="lazy">
            <div class="order-item-name">${item.name} × ${item.qty}</div>
            <div class="order-item-price">${formatPrice(item.price * item.qty)}</div>
          </div>`).join('')}
        ${items.length > 3 ? `<div style="font-size:0.8125rem;color:var(--text-muted);padding:0.5rem 0">+${items.length-3} more items</div>` : ''}
      </div>
      <div class="order-footer">
        <div class="order-total">
          Total: <span style="color:var(--primary);font-size:1.0625rem">${formatPrice(order.total)}</span>
          <span style="font-weight:400;color:var(--text-muted);font-size:0.8125rem;margin-left:0.375rem">${order.paymentMethod === 'cod' ? '(COD)' : ''}</span>
        </div>
        <div class="order-actions">
          ${order.status === 'delivered' ? `<a href="./product.html?id=${items[0]?.productId}" class="btn-secondary btn-sm">Write Review</a>` : ''}
          ${canCancel ? `<button class="btn-secondary btn-sm cancel-order-btn" data-oid="${id}">Cancel Order</button>` : ''}
        </div>
      </div>
    </div>`;
}

function renderEmpty() {
  return `
    <div style="text-align:center;padding:4rem 1rem">
      <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--border)" stroke-width="1.5" style="margin:0 auto 1.5rem;display:block"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
      <h2 style="font-weight:700;margin-bottom:0.5rem">No orders ${activeFilter !== 'all' ? `with status "${activeFilter}"` : 'yet'}</h2>
      <p style="color:var(--text-muted);margin-bottom:1.5rem">Your order history will appear here.</p>
      <a href="./index.html" class="btn-primary">Start Shopping</a>
    </div>`;
}

// Filter tabs
document.querySelectorAll('.filter-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.status;
    renderOrders(allOrders);
  });
});
