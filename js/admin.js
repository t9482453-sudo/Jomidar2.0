import { auth, db, getRef } from './firebase.js';
import { signOut } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { get, set, update, remove, push, onValue, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { initTheme, toggleTheme, requireAdmin, showToast, formatPrice, formatDate, confirmDialog, initOfflineDetection } from './utils.js';

initTheme();
initOfflineDetection();

let adminUser = null;
let currentTab = 'dashboard';

// Require admin before anything
requireAdmin().then(user => {
  adminUser = user;
  document.getElementById('adminUserName').textContent = user.displayName || user.email || 'Admin';
  initAdmin();
}).catch(() => {});

function initAdmin() {
  // Theme
  document.getElementById('adminThemeBtn').addEventListener('click', toggleTheme);
  // Logout
  document.getElementById('adminLogoutBtn').addEventListener('click', async () => {
    await signOut(auth);
    window.location.href = './login.html';
  });
  // Sidebar nav
  document.querySelectorAll('.admin-nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  // Mobile sidebar
  const menuBtn = document.getElementById('adminMenuBtn');
  const sidebar = document.getElementById('adminSidebar');
  const backdrop = document.getElementById('adminBackdrop');
  menuBtn?.addEventListener('click', () => { sidebar.classList.toggle('open'); backdrop.style.display = sidebar.classList.contains('open') ? 'block' : 'none'; });
  backdrop?.addEventListener('click', () => { sidebar.classList.remove('open'); backdrop.style.display = 'none'; });
  // Modal close
  document.getElementById('adminModal').addEventListener('click', e => { if (e.target === document.getElementById('adminModal')) closeModal(); });
  document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
  // Load pending orders badge
  watchPendingOrders();
  switchTab('dashboard');
}

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.admin-nav-item[data-tab]').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  const titles = { dashboard:'Dashboard', products:'Products', categories:'Categories', inventory:'Inventory', orders:'Orders', coupons:'Coupons', banners:'Banners', flashsale:'Flash Sale', customers:'Customers', reviews:'Reviews', settings:'Settings' };
  document.getElementById('adminPageTitle').textContent = titles[tab] || tab;
  const content = document.getElementById('adminContent');
  content.innerHTML = '<div class="skeleton" style="height:200px;border-radius:var(--radius);margin-bottom:1rem"></div>'.repeat(2);
  const fns = { dashboard: renderDashboard, products: renderProducts, categories: renderCategories, inventory: renderInventory, orders: renderOrders, coupons: renderCoupons, banners: renderBanners, flashsale: renderFlashSale, customers: renderCustomers, reviews: renderReviews, settings: renderSettings };
  (fns[tab] || (() => { content.innerHTML = `<p style="padding:2rem;color:var(--text-muted)">${titles[tab]} — coming soon.</p>`; }))();
}

// ==== DASHBOARD ====
async function renderDashboard() {
  const content = document.getElementById('adminContent');
  try {
    const [ordersSnap, productsSnap, usersSnap] = await Promise.all([
      get(getRef('orders')), get(getRef('products')), get(getRef('users'))
    ]);
    const orders   = ordersSnap.exists()   ? Object.values(ordersSnap.val())   : [];
    const products = productsSnap.exists() ? Object.values(productsSnap.val()) : [];
    const users    = usersSnap.exists()    ? Object.values(usersSnap.val())    : [];
    const revenue  = orders.filter(o=>o.status!=='cancelled').reduce((s,o)=>s+(o.total||0),0);
    const pending  = orders.filter(o=>o.status==='pending').length;
    const outOfStock = products.filter(p=>!p.stock||p.stock<=0).length;
    content.innerHTML = `
      <div class="admin-stats-grid">
        ${statCard('Total Revenue', formatPrice(revenue), '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>', '#2563eb')}
        ${statCard('Total Orders', orders.length, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>', '#7c3aed')}
        ${statCard('Pending Orders', pending, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>', '#f59e0b')}
        ${statCard('Total Customers', users.length, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', '#10b981')}
        ${statCard('Total Products', products.length, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>', '#0ea5e9')}
        ${statCard('Out of Stock', outOfStock, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', '#ef4444')}
      </div>
      <div class="admin-table-wrap">
        <div class="admin-toolbar"><h3>Recent Orders</h3><button class="btn-primary btn-sm" onclick="adminSwitchTab('orders')">View All</button></div>
        <div class="admin-table-container">${renderOrdersTable(orders.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).slice(0,8))}</div>
      </div>`;
  } catch(e) { content.innerHTML = `<p style="color:var(--danger);padding:1rem">Error loading dashboard: ${e.message}</p>`; }
}
window.adminSwitchTab = switchTab;

function statCard(label, val, icon, color) {
  return `<div class="admin-stat-card">
    <div class="admin-stat-icon" style="background:${color}1a;color:${color}">${icon}</div>
    <div class="admin-stat-label">${label}</div>
    <div class="admin-stat-val">${val}</div>
  </div>`;
}

// ==== PRODUCTS ====
async function renderProducts() {
  const content = document.getElementById('adminContent');
  try {
    const [snap, catSnap] = await Promise.all([get(getRef('products')), get(getRef('categories'))]);
    const products = snap.exists() ? Object.entries(snap.val()) : [];
    const categories = catSnap.exists() ? Object.values(catSnap.val()).map(c=>c.name) : [];
    const PLACEHOLDER = 'https://placehold.co/48x48/e2e8f0/64748b?text=?';
    content.innerHTML = `
      <div class="admin-table-wrap">
        <div class="admin-toolbar">
          <h3>Products (${products.length})</h3>
          <div class="toolbar-right">
            <div class="admin-search">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" id="productSearch" placeholder="Search products…">
            </div>
            <button class="btn-primary btn-sm" id="addProductBtn">+ Add Product</button>
          </div>
        </div>
        <div class="admin-table-container">
          <table id="productsTable">
            <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody id="productsTableBody"></tbody>
          </table>
        </div>
      </div>`;
    function renderBody(data) {
      document.getElementById('productsTableBody').innerHTML = data.map(([id, p]) => `
        <tr>
          <td><div class="table-product-info">
            <img class="table-product-img" src="${p.images?.[0]||PLACEHOLDER}" alt="${p.name}" loading="lazy">
            <div><div class="table-product-name">${p.name}</div><div style="font-size:0.75rem;color:var(--text-muted)">${p.brand||''}</div></div>
          </div></td>
          <td>${p.category||'—'}</td>
          <td>${formatPrice(p.price)}</td>
          <td><span style="font-weight:600;color:${!p.stock||p.stock<=0?'var(--danger)':p.stock<10?'var(--warning)':'var(--success)'}">${p.stock??'—'}</span></td>
          <td><label class="toggle-switch"><input type="checkbox" ${p.active!==false?'checked':''} onchange="toggleProductActive('${id}', this.checked)"><div class="toggle-slider"></div></label></td>
          <td><div class="action-btns">
            <button class="action-btn primary" onclick="openProductModal('${id}')">Edit</button>
            <button class="action-btn danger" onclick="deleteProduct('${id}')">Delete</button>
          </div></td>
        </tr>`).join('');
    }
    renderBody(products);
    document.getElementById('productSearch').addEventListener('input', e => {
      const q = e.target.value.toLowerCase();
      renderBody(products.filter(([,p])=>p.name?.toLowerCase().includes(q)||p.category?.toLowerCase().includes(q)));
    });
    document.getElementById('addProductBtn').addEventListener('click', () => openProductModal());
    window._adminCategories = categories;
  } catch(e) { document.getElementById('adminContent').innerHTML = `<p style="color:var(--danger)">Error: ${e.message}</p>`; }
}

window.toggleProductActive = async (id, active) => {
  await update(getRef(`products/${id}`), { active });
  showToast(`Product ${active ? 'activated' : 'deactivated'}`);
};
window.deleteProduct = async (id) => {
  const ok = await confirmDialog('Delete this product permanently?', 'Delete Product');
  if (!ok) return;
  await remove(getRef(`products/${id}`));
  showToast('Product deleted', 'info');
  renderProducts();
};
window.openProductModal = async (productId) => {
  const cats = window._adminCategories || [];
  let product = {};
  if (productId) {
    const snap = await get(getRef(`products/${productId}`));
    if (snap.exists()) product = snap.val();
  }
  document.getElementById('modalTitle').textContent = productId ? 'Edit Product' : 'Add Product';
  document.getElementById('modalBody').innerHTML = `
    <div class="modal-form-grid">
      <div class="form-group"><label class="form-label">Name *</label><input id="pName" value="${escHtml(product.name||'')}" placeholder="Product name"></div>
      <div class="form-group"><label class="form-label">Category</label>
        <select id="pCategory"><option value="">Select Category</option>${cats.map(c=>`<option ${product.category===c?'selected':''}>${c}</option>`).join('')}<option ${!cats.includes(product.category||'')?'selected':''} value="${escHtml(product.category||'')}">Other</option></select>
      </div>
      <div class="form-group"><label class="form-label">Price (৳) *</label><input id="pPrice" type="number" min="0" value="${product.price||''}" placeholder="0"></div>
      <div class="form-group"><label class="form-label">Original Price (৳)</label><input id="pOriginalPrice" type="number" min="0" value="${product.originalPrice||''}" placeholder="0"></div>
      <div class="form-group"><label class="form-label">Stock *</label><input id="pStock" type="number" min="0" value="${product.stock??''}" placeholder="0"></div>
      <div class="form-group"><label class="form-label">Brand</label><input id="pBrand" value="${escHtml(product.brand||'')}" placeholder="Brand name"></div>
      <div class="form-group col-span-2"><label class="form-label">Description</label><textarea id="pDesc" rows="3">${escHtml(product.description||'')}</textarea></div>
      <div class="form-group"><label class="form-label">Sizes (comma separated)</label><input id="pSizes" value="${escHtml(product.sizes||'')}" placeholder="S, M, L, XL"></div>
      <div class="form-group"><label class="form-label">Colors (comma separated hex)</label><input id="pColors" value="${escHtml(product.colors||'')}" placeholder="#ff0000,#00ff00"></div>
      <div class="form-group"><label class="form-label">Specifications</label><textarea id="pSpecs" rows="2">${escHtml(product.specs||'')}</textarea></div>
      <div class="form-group">
        <label class="toggle-switch" style="margin-top:0.75rem"><input type="checkbox" id="pFeatured" ${product.featured?'checked':''}><div class="toggle-slider"></div>Featured</label>
        <label class="toggle-switch" style="margin-top:0.5rem"><input type="checkbox" id="pFlashSale" ${product.flashSale?'checked':''}><div class="toggle-slider"></div>Flash Sale</label>
        <label class="toggle-switch" style="margin-top:0.5rem"><input type="checkbox" id="pIsNew" ${product.isNew?'checked':''}><div class="toggle-slider"></div>New Arrival</label>
      </div>
      <div class="form-group col-span-2">
        <label class="form-label">Images</label>
        <div class="img-upload-area" id="imgUploadArea">
          <input type="file" id="imgFileInput" multiple accept="image/*">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" style="margin-bottom:0.5rem"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <div style="color:var(--text-muted);font-size:0.875rem">Click to upload images or drag & drop</div>
        </div>
        <div class="img-preview-grid" id="imgPreviewGrid">
          ${(product.images||[]).map((url,i)=>`<div class="img-preview-item" data-url="${url}"><img src="${url}" alt=""><div class="remove-img" onclick="removeProductImage('${url}')">✕</div></div>`).join('')}
        </div>
        <input type="hidden" id="pImages" value="${(product.images||[]).join(',')}">
      </div>
    </div>`;
  document.getElementById('imgUploadArea').addEventListener('click', () => document.getElementById('imgFileInput').click());
  document.getElementById('imgFileInput').addEventListener('change', async e => {
    const files = Array.from(e.target.files);
    const storage = getStorage();
    for (const file of files) {
      try {
        const sRef = storageRef(storage, `products/${Date.now()}_${file.name}`);
        await uploadBytes(sRef, file);
        const url = await getDownloadURL(sRef);
        const cur = document.getElementById('pImages').value;
        document.getElementById('pImages').value = cur ? cur+','+url : url;
        const grid = document.getElementById('imgPreviewGrid');
        grid.insertAdjacentHTML('beforeend', `<div class="img-preview-item" data-url="${url}"><img src="${url}" alt=""><div class="remove-img" onclick="removeProductImage('${url}')">✕</div></div>`);
      } catch { showToast('Image upload failed', 'error'); }
    }
  });
  window.removeProductImage = (url) => {
    const cur = document.getElementById('pImages').value.split(',').filter(u=>u&&u!==url);
    document.getElementById('pImages').value = cur.join(',');
    document.querySelector(`.img-preview-item[data-url="${url}"]`)?.remove();
  };
  openModal(async () => {
    const name  = document.getElementById('pName')?.value.trim();
    const price = parseFloat(document.getElementById('pPrice')?.value);
    const stock = parseInt(document.getElementById('pStock')?.value);
    if (!name || isNaN(price)) { showToast('Name and price are required', 'warning'); return false; }
    const data = {
      name,
      category:      document.getElementById('pCategory')?.value || '',
      price,
      originalPrice: parseFloat(document.getElementById('pOriginalPrice')?.value) || 0,
      stock:         isNaN(stock) ? 0 : stock,
      brand:         document.getElementById('pBrand')?.value.trim() || '',
      description:   document.getElementById('pDesc')?.value.trim() || '',
      sizes:         document.getElementById('pSizes')?.value.trim() || '',
      colors:        document.getElementById('pColors')?.value.trim() || '',
      specs:         document.getElementById('pSpecs')?.value.trim() || '',
      featured:      document.getElementById('pFeatured')?.checked || false,
      flashSale:     document.getElementById('pFlashSale')?.checked || false,
      isNew:         document.getElementById('pIsNew')?.checked || false,
      images:        document.getElementById('pImages')?.value.split(',').filter(Boolean) || [],
      active:        true,
      updatedAt:     Date.now(),
    };
    if (!productId) data.createdAt = Date.now();
    if (productId) await update(getRef(`products/${productId}`), data);
    else await push(getRef('products'), data);
    showToast(productId ? 'Product updated!' : 'Product added!');
    renderProducts();
    return true;
  });
};

// ==== ORDERS ====
async function renderOrders() {
  const content = document.getElementById('adminContent');
  try {
    const snap = await get(getRef('orders'));
    let orders = snap.exists() ? Object.entries(snap.val()).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0)) : [];
    const statuses = ['all','pending','processing','shipped','delivered','cancelled'];
    let filter = 'all';
    function renderTable(data) {
      const filtered = filter === 'all' ? data : data.filter(([,o])=>o.status===filter);
      document.getElementById('ordersTableBody').innerHTML = filtered.map(([id,o])=>`
        <tr>
          <td><strong>#${id.slice(-8).toUpperCase()}</strong></td>
          <td>${o.userName||'—'}<div style="font-size:0.75rem;color:var(--text-muted)">${o.userEmail||''}</div></td>
          <td>${formatDate(o.createdAt)}</td>
          <td>${formatPrice(o.total)}</td>
          <td><select class="status-select" data-oid="${id}" onchange="updateOrderStatus('${id}',this.value)">
            ${['pending','processing','shipped','delivered','cancelled'].map(s=>`<option ${o.status===s?'selected':''}>${s}</option>`).join('')}
          </select></td>
          <td>${o.paymentMethod==='cod'?'COD':'Online'}</td>
          <td><div class="action-btns">
            <button class="action-btn primary" onclick="viewOrderDetail('${id}')">View</button>
            ${['pending','processing'].includes(o.status)?`<button class="action-btn danger" onclick="cancelOrderAdmin('${id}')">Cancel</button>`:''}
          </div></td>
        </tr>`).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">No orders</td></tr>';
    }
    content.innerHTML = `
      <div class="admin-table-wrap">
        <div class="admin-toolbar">
          <h3>Orders (${orders.length})</h3>
          <div class="toolbar-right">
            <div style="display:flex;gap:0.375rem;flex-wrap:wrap">
              ${statuses.map(s=>`<button class="filter-chip ${s==='all'?'active':''}" data-s="${s}" style="font-size:0.75rem;padding:0.3rem 0.75rem">${s.charAt(0).toUpperCase()+s.slice(1)}</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="admin-table-container">
          <table><thead><tr><th>Order ID</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th>Payment</th><th>Actions</th></tr></thead>
          <tbody id="ordersTableBody"></tbody></table>
        </div>
      </div>`;
    renderTable(orders);
    content.querySelectorAll('.filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        content.querySelectorAll('.filter-chip').forEach(b=>b.classList.remove('active'));
        btn.classList.add('active');
        filter = btn.dataset.s;
        renderTable(orders);
      });
    });
  } catch(e) { console.error(e); }
}
window.updateOrderStatus = async (id, status) => {
  await update(getRef(`orders/${id}`), { status, updatedAt: Date.now() });
  showToast(`Order status updated to ${status}`);
  // Send notification to user
  try {
    const snap = await get(getRef(`orders/${id}`));
    if (snap.exists()) {
      const o = snap.val();
      await push(getRef(`notifications/${o.userId}`), { title: 'Order Update', message: `Your order #${id.slice(-8).toUpperCase()} is now ${status}.`, createdAt: Date.now(), read: false });
    }
  } catch {}
};
window.cancelOrderAdmin = async (id) => {
  const ok = await confirmDialog('Cancel this order?', 'Cancel Order');
  if (!ok) return;
  await update(getRef(`orders/${id}`), { status: 'cancelled', updatedAt: Date.now() });
  showToast('Order cancelled', 'info');
  renderOrders();
};
window.viewOrderDetail = async (id) => {
  const snap = await get(getRef(`orders/${id}`));
  if (!snap.exists()) return;
  const o = snap.val();
  const items = Array.isArray(o.items) ? o.items : Object.values(o.items||{});
  const PLACEHOLDER = 'https://placehold.co/50x50/e2e8f0/64748b?text=?';
  document.getElementById('modalTitle').textContent = `Order #${id.slice(-8).toUpperCase()}`;
  document.getElementById('modalBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
      <div><b>Customer:</b> ${o.userName||'—'}<br><b>Email:</b> ${o.userEmail||'—'}<br><b>Phone:</b> ${o.phone||'—'}</div>
      <div><b>Address:</b> ${o.address||'—'}<br><b>Payment:</b> ${o.paymentMethod||'—'}<br><b>Status:</b> ${o.status}</div>
    </div>
    <table style="width:100%"><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
    <tbody>${items.map(item=>`<tr><td><div style="display:flex;align-items:center;gap:0.5rem"><img src="${item.image||PLACEHOLDER}" style="width:36px;height:36px;object-fit:cover;border-radius:6px">${item.name}</div></td><td>${item.qty}</td><td>${formatPrice(item.price*item.qty)}</td></tr>`).join('')}</tbody></table>
    <div style="text-align:right;margin-top:1rem;font-size:0.9375rem">Subtotal: ${formatPrice(o.subtotal||0)}<br>Delivery: ${formatPrice(o.delivery||0)}<br>${o.discount?`Discount: -${formatPrice(o.discount)}<br>`:''}
    <strong>Total: ${formatPrice(o.total||0)}</strong></div>
    ${o.notes?`<div style="margin-top:0.75rem;background:var(--bg);padding:0.75rem;border-radius:var(--radius-sm)"><b>Notes:</b> ${o.notes}</div>`:''}`;
  document.getElementById('modalSaveBtn').style.display = 'none';
  openModal();
};

// ==== CATEGORIES ====
async function renderCategories() {
  const content = document.getElementById('adminContent');
  const snap = await get(getRef('categories'));
  const cats = snap.exists() ? Object.entries(snap.val()) : [];
  content.innerHTML = `
    <div class="admin-table-wrap">
      <div class="admin-toolbar"><h3>Categories (${cats.length})</h3><button class="btn-primary btn-sm" id="addCatBtn">+ Add Category</button></div>
      <div class="admin-table-container">
        <table><thead><tr><th>Name</th><th>Emoji</th><th>Color</th><th>Products</th><th>Actions</th></tr></thead>
        <tbody>${cats.map(([id,c])=>`<tr>
          <td><strong>${c.name}</strong></td>
          <td>${c.emoji||'📦'}</td>
          <td><div style="width:24px;height:24px;border-radius:50%;background:${c.color||'#e2e8f0'};display:inline-block"></div> ${c.color||'—'}</td>
          <td>${c.productCount||0}</td>
          <td><div class="action-btns">
            <button class="action-btn primary" onclick="openCategoryModal('${id}')">Edit</button>
            <button class="action-btn danger" onclick="deleteCat('${id}')">Delete</button>
          </div></td>
        </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">No categories yet</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
  document.getElementById('addCatBtn').addEventListener('click', () => openCategoryModal());
}
window.deleteCat = async (id) => {
  const ok = await confirmDialog('Delete this category?');
  if (!ok) return;
  await remove(getRef(`categories/${id}`));
  showToast('Category deleted', 'info');
  renderCategories();
};
window.openCategoryModal = async (catId) => {
  let cat = {};
  if (catId) { const s = await get(getRef(`categories/${catId}`)); if(s.exists()) cat = s.val(); }
  document.getElementById('modalTitle').textContent = catId ? 'Edit Category' : 'Add Category';
  document.getElementById('modalBody').innerHTML = `
    <div class="modal-form-grid">
      <div class="form-group col-span-2"><label class="form-label">Name *</label><input id="cName" value="${escHtml(cat.name||'')}" placeholder="Category name"></div>
      <div class="form-group"><label class="form-label">Emoji</label><input id="cEmoji" value="${cat.emoji||'📦'}" placeholder="📦"></div>
      <div class="form-group"><label class="form-label">Color</label>
        <div class="color-picker-wrap"><input type="color" id="cColor" value="${cat.color||'#2563eb'}"><span id="cColorHex">${cat.color||'#2563eb'}</span></div>
      </div>
    </div>`;
  document.getElementById('cColor').addEventListener('input', e => { document.getElementById('cColorHex').textContent = e.target.value; });
  openModal(async () => {
    const name = document.getElementById('cName')?.value.trim();
    if (!name) { showToast('Name is required', 'warning'); return false; }
    const data = { name, emoji: document.getElementById('cEmoji')?.value||'📦', color: document.getElementById('cColor')?.value||'#2563eb' };
    if (catId) await update(getRef(`categories/${catId}`), data);
    else await push(getRef('categories'), data);
    showToast(catId ? 'Category updated!' : 'Category added!');
    renderCategories();
    return true;
  });
};

// ==== BANNERS ====
async function renderBanners() {
  const content = document.getElementById('adminContent');
  const snap = await get(getRef('banners'));
  const banners = snap.exists() ? Object.entries(snap.val()) : [];
  content.innerHTML = `
    <div class="admin-table-wrap">
      <div class="admin-toolbar"><h3>Banners (${banners.length})</h3><button class="btn-primary btn-sm" id="addBannerBtn">+ Add Banner</button></div>
      <div class="admin-table-container">
        <table><thead><tr><th>Title</th><th>Subtitle</th><th>CTA</th><th>Active</th><th>Actions</th></tr></thead>
        <tbody>${banners.map(([id,b])=>`<tr>
          <td><strong>${b.title||'—'}</strong></td>
          <td>${b.subtitle||'—'}</td>
          <td>${b.cta||'Shop Now'}</td>
          <td><label class="toggle-switch"><input type="checkbox" ${b.active!==false?'checked':''} onchange="toggleBanner('${id}',this.checked)"><div class="toggle-slider"></div></label></td>
          <td><div class="action-btns"><button class="action-btn primary" onclick="openBannerModal('${id}')">Edit</button><button class="action-btn danger" onclick="deleteBanner('${id}')">Delete</button></div></td>
        </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:2rem">No banners yet</td></tr>'}</tbody></table>
      </div>
    </div>`;
  document.getElementById('addBannerBtn').addEventListener('click', () => openBannerModal());
}
window.toggleBanner = async (id, active) => { await update(getRef(`banners/${id}`), { active }); showToast(`Banner ${active?'enabled':'disabled'}`); };
window.deleteBanner = async (id) => { const ok=await confirmDialog('Delete banner?'); if(!ok)return; await remove(getRef(`banners/${id}`)); showToast('Banner deleted','info'); renderBanners(); };
window.openBannerModal = async (bannerId) => {
  let b = {};
  if (bannerId) { const s=await get(getRef(`banners/${bannerId}`)); if(s.exists())b=s.val(); }
  document.getElementById('modalTitle').textContent = bannerId ? 'Edit Banner' : 'Add Banner';
  document.getElementById('modalBody').innerHTML = `
    <div class="modal-form-grid">
      <div class="form-group col-span-2"><label class="form-label">Title *</label><input id="bTitle" value="${escHtml(b.title||'')}" placeholder="Banner title"></div>
      <div class="form-group col-span-2"><label class="form-label">Subtitle</label><input id="bSubtitle" value="${escHtml(b.subtitle||'')}" placeholder="Subtitle text"></div>
      <div class="form-group"><label class="form-label">CTA Text</label><input id="bCta" value="${escHtml(b.cta||'Shop Now')}" placeholder="Shop Now"></div>
      <div class="form-group"><label class="form-label">Link</label><input id="bLink" value="${escHtml(b.link||'#')}" placeholder="https://…"></div>
      <div class="form-group col-span-2"><label class="form-label">Background Color/Gradient</label><input id="bBgColor" value="${escHtml(b.bgColor||'linear-gradient(135deg,#1e3a8a,#7c3aed)')}" placeholder="CSS background value"></div>
      <div class="form-group col-span-2"><label class="form-label">Image URL (overrides background)</label><input id="bImage" value="${escHtml(b.image||'')}" placeholder="https://…"></div>
    </div>`;
  openModal(async () => {
    const title = document.getElementById('bTitle')?.value.trim();
    if (!title) { showToast('Title is required', 'warning'); return false; }
    const data = { title, subtitle: document.getElementById('bSubtitle')?.value.trim()||'', cta: document.getElementById('bCta')?.value.trim()||'Shop Now', link: document.getElementById('bLink')?.value.trim()||'#', bgColor: document.getElementById('bBgColor')?.value.trim()||'', image: document.getElementById('bImage')?.value.trim()||'', active: true };
    if (bannerId) await update(getRef(`banners/${bannerId}`), data);
    else await push(getRef('banners'), data);
    showToast(bannerId?'Banner updated!':'Banner added!');
    renderBanners();
    return true;
  });
};

// ==== FLASH SALE ====
async function renderFlashSale() {
  const content = document.getElementById('adminContent');
  const snap = await get(getRef('flashSale'));
  const fs = snap.exists() ? snap.val() : {};
  content.innerHTML = `
    <div class="flash-config">
      <h3>Flash Sale Settings</h3>
      <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
        <div class="form-group">
          <label class="toggle-switch"><input type="checkbox" id="fsActive" ${fs.active?'checked':''}><div class="toggle-slider"></div>Enable Flash Sale</label>
        </div>
        <div class="form-group"><label class="form-label">End Date & Time</label>
          <input type="datetime-local" id="fsEndTime" value="${fs.endTime ? new Date(fs.endTime).toISOString().slice(0,16) : ''}">
        </div>
      </div>
      <button class="btn-primary" id="saveFlashSaleBtn" style="margin-top:1rem">Save Flash Sale Settings</button>
    </div>
    <div class="admin-table-wrap" style="margin-top:1.25rem">
      <div class="admin-toolbar"><h3>Flash Sale Products</h3><small style="color:var(--text-muted)">Toggle "Flash Sale" on any product to include it here</small></div>
      <div class="admin-table-container" id="flashSaleProducts"></div>
    </div>`;
  document.getElementById('saveFlashSaleBtn').addEventListener('click', async () => {
    const active  = document.getElementById('fsActive')?.checked;
    const endTime = new Date(document.getElementById('fsEndTime')?.value).getTime() || 0;
    await set(getRef('flashSale'), { active, endTime });
    showToast('Flash Sale settings saved!');
  });
  const pSnap = await get(getRef('products'));
  if (pSnap.exists()) {
    const flashProds = Object.entries(pSnap.val()).filter(([,p])=>p.flashSale);
    const PLACEHOLDER = 'https://placehold.co/48x48/e2e8f0/64748b?text=?';
    document.getElementById('flashSaleProducts').innerHTML = flashProds.length
      ? `<table><thead><tr><th>Product</th><th>Price</th><th>Stock</th><th>Remove from Sale</th></tr></thead>
         <tbody>${flashProds.map(([id,p])=>`<tr>
           <td><div class="table-product-info"><img class="table-product-img" src="${p.images?.[0]||PLACEHOLDER}" loading="lazy">${p.name}</div></td>
           <td>${formatPrice(p.price)}</td><td>${p.stock??'—'}</td>
           <td><button class="action-btn danger" onclick="removeFromFlashSale('${id}')">Remove</button></td>
         </tr>`).join('')}</tbody></table>`
      : '<p style="padding:1.5rem;color:var(--text-muted);text-align:center">No flash sale products. Edit products to add them.</p>';
  }
}
window.removeFromFlashSale = async (id) => { await update(getRef(`products/${id}`), { flashSale: false }); showToast('Removed from flash sale','info'); renderFlashSale(); };

// ==== COUPONS ====
async function renderCoupons() {
  const content = document.getElementById('adminContent');
  const snap = await get(getRef('coupons'));
  const coupons = snap.exists() ? Object.entries(snap.val()) : [];
  content.innerHTML = `
    <div class="admin-table-wrap">
      <div class="admin-toolbar"><h3>Coupons (${coupons.length})</h3><button class="btn-primary btn-sm" id="addCouponBtn">+ Add Coupon</button></div>
      <div class="admin-table-container">
        <table><thead><tr><th>Code</th><th>Type</th><th>Value</th><th>Min Order</th><th>Active</th><th>Actions</th></tr></thead>
        <tbody>${coupons.map(([id,c])=>`<tr>
          <td><strong>${id}</strong></td>
          <td>${c.type==='percent'?'Percentage':'Fixed'}</td>
          <td>${c.type==='percent'?c.value+'%':formatPrice(c.value)}</td>
          <td>${c.minOrder?formatPrice(c.minOrder):'—'}</td>
          <td><label class="toggle-switch"><input type="checkbox" ${c.active?'checked':''} onchange="toggleCoupon('${id}',this.checked)"><div class="toggle-slider"></div></label></td>
          <td><div class="action-btns"><button class="action-btn primary" onclick="openCouponModal('${id}')">Edit</button><button class="action-btn danger" onclick="deleteCoupon('${id}')">Delete</button></div></td>
        </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">No coupons yet</td></tr>'}</tbody></table>
      </div>
    </div>`;
  document.getElementById('addCouponBtn').addEventListener('click', () => openCouponModal());
}
window.toggleCoupon   = async (id, active) => { await update(getRef(`coupons/${id}`), { active }); showToast(`Coupon ${active?'enabled':'disabled'}`); };
window.deleteCoupon   = async (id) => { const ok=await confirmDialog('Delete coupon '+id+'?'); if(!ok)return; await remove(getRef(`coupons/${id}`)); showToast('Coupon deleted','info'); renderCoupons(); };
window.openCouponModal = async (couponId) => {
  let c = {};
  if (couponId) { const s=await get(getRef(`coupons/${couponId}`)); if(s.exists())c=s.val(); }
  document.getElementById('modalTitle').textContent = couponId ? 'Edit Coupon' : 'Add Coupon';
  document.getElementById('modalBody').innerHTML = `
    <div class="modal-form-grid">
      <div class="form-group"><label class="form-label">Code *</label><input id="cpCode" value="${escHtml(couponId||'')}" placeholder="SUMMER20" style="text-transform:uppercase" ${couponId?'disabled':''}></div>
      <div class="form-group"><label class="form-label">Type</label>
        <select id="cpType"><option value="percent" ${c.type==='percent'?'selected':''}>Percentage (%)</option><option value="fixed" ${c.type==='fixed'?'selected':''}>Fixed (৳)</option></select>
      </div>
      <div class="form-group"><label class="form-label">Value *</label><input id="cpValue" type="number" value="${c.value||''}" placeholder="e.g. 20 for 20%"></div>
      <div class="form-group"><label class="form-label">Max Discount (৳, for %)</label><input id="cpMaxDiscount" type="number" value="${c.maxDiscount||''}" placeholder="Optional cap"></div>
      <div class="form-group"><label class="form-label">Min Order (৳)</label><input id="cpMinOrder" type="number" value="${c.minOrder||''}" placeholder="Minimum cart value"></div>
      <div class="form-group"><label class="toggle-switch" style="margin-top:0.75rem"><input type="checkbox" id="cpActive" ${c.active!==false?'checked':''}><div class="toggle-slider"></div>Active</label></div>
    </div>`;
  openModal(async () => {
    const code  = (document.getElementById('cpCode')?.value.trim()||'').toUpperCase();
    const value = parseFloat(document.getElementById('cpValue')?.value);
    if (!code || isNaN(value)) { showToast('Code and value are required', 'warning'); return false; }
    const data = { type: document.getElementById('cpType')?.value||'percent', value, maxDiscount: parseFloat(document.getElementById('cpMaxDiscount')?.value)||0, minOrder: parseFloat(document.getElementById('cpMinOrder')?.value)||0, active: document.getElementById('cpActive')?.checked??true };
    await set(getRef(`coupons/${code}`), data);
    showToast(couponId?'Coupon updated!':'Coupon added!');
    renderCoupons();
    return true;
  });
};

// ==== CUSTOMERS ====
async function renderCustomers() {
  const content = document.getElementById('adminContent');
  const snap = await get(getRef('users'));
  const users = snap.exists() ? Object.entries(snap.val()) : [];
  content.innerHTML = `
    <div class="admin-table-wrap">
      <div class="admin-toolbar">
        <h3>Customers (${users.length})</h3>
        <div class="admin-search"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="search" id="custSearch" placeholder="Search customers…"></div>
      </div>
      <div class="admin-table-container">
        <table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th><th>Admin</th><th>Actions</th></tr></thead>
        <tbody id="custTableBody"></tbody></table>
      </div>
    </div>`;
  function renderBody(data) {
    document.getElementById('custTableBody').innerHTML = data.map(([id,u])=>`<tr>
      <td>${u.name||u.displayName||'—'}</td>
      <td>${u.email||'—'}</td>
      <td>${u.phone||'—'}</td>
      <td>${formatDate(u.createdAt)}</td>
      <td><label class="toggle-switch"><input type="checkbox" ${u.isAdmin?'checked':''} onchange="toggleAdmin('${id}',this.checked)"><div class="toggle-slider"></div></label></td>
      <td><div class="action-btns"><button class="action-btn danger" onclick="deleteCustomer('${id}')">Delete</button></div></td>
    </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">No customers</td></tr>';
  }
  renderBody(users);
  document.getElementById('custSearch').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderBody(users.filter(([,u])=>(u.name||'').toLowerCase().includes(q)||(u.email||'').toLowerCase().includes(q)));
  });
}
window.toggleAdmin = async (id, isAdmin) => { await update(getRef(`users/${id}`), { isAdmin }); showToast(`Admin access ${isAdmin?'granted':'revoked'}`); };
window.deleteCustomer = async (id) => {
  const ok = await confirmDialog('Delete this customer? This cannot be undone.');
  if (!ok) return;
  await remove(getRef(`users/${id}`));
  showToast('Customer deleted', 'info');
  renderCustomers();
};

// ==== REVIEWS ====
async function renderReviews() {
  const content = document.getElementById('adminContent');
  const snap = await get(getRef('reviews'));
  const allReviews = [];
  if (snap.exists()) {
    Object.entries(snap.val()).forEach(([pid, reviews]) => {
      Object.entries(reviews).forEach(([uid, r]) => allReviews.push({ pid, uid, ...r }));
    });
  }
  allReviews.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  content.innerHTML = `
    <div class="admin-table-wrap">
      <div class="admin-toolbar"><h3>Reviews (${allReviews.length})</h3></div>
      <div class="admin-table-container">
        <table><thead><tr><th>Product ID</th><th>User</th><th>Rating</th><th>Comment</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>${allReviews.map(r=>`<tr>
          <td><a href="./product.html?id=${r.pid}" target="_blank" style="color:var(--primary)">${r.pid.slice(-8)}</a></td>
          <td>${r.userName||'—'}</td>
          <td>${'★'.repeat(r.rating||0)}${'☆'.repeat(5-(r.rating||0))}</td>
          <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.comment||'—'}</td>
          <td>${formatDate(r.createdAt)}</td>
          <td><button class="action-btn danger" onclick="deleteReview('${r.pid}','${r.uid}')">Delete</button></td>
        </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">No reviews yet</td></tr>'}</tbody></table>
      </div>
    </div>`;
}
window.deleteReview = async (pid, uid) => {
  const ok = await confirmDialog('Delete this review?');
  if (!ok) return;
  await remove(getRef(`reviews/${pid}/${uid}`));
  showToast('Review deleted', 'info');
  renderReviews();
};

// ==== INVENTORY ====
async function renderInventory() {
  const content = document.getElementById('adminContent');
  const snap = await get(getRef('products'));
  const products = snap.exists() ? Object.entries(snap.val()) : [];
  const lowStock  = products.filter(([,p])=>p.stock>0&&p.stock<=10);
  const outOfStock= products.filter(([,p])=>!p.stock||p.stock<=0);
  const PLACEHOLDER = 'https://placehold.co/48x48/e2e8f0/64748b?text=?';
  function stockTable(list, emptyMsg) {
    if (!list.length) return `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:1.5rem">${emptyMsg}</td></tr>`;
    return list.map(([id,p])=>`<tr>
      <td><div class="table-product-info"><img class="table-product-img" src="${p.images?.[0]||PLACEHOLDER}" loading="lazy">${p.name}</div></td>
      <td>${p.category||'—'}</td>
      <td><span style="font-weight:700;color:${!p.stock||p.stock<=0?'var(--danger)':'var(--warning)'}">${p.stock??0}</span></td>
      <td><div style="display:flex;align-items:center;gap:0.375rem">
        <input type="number" min="0" id="stock_${id}" value="${p.stock||0}" style="width:80px" class="form-control">
        <button class="action-btn primary" onclick="updateStock('${id}')">Update</button>
      </div></td>
    </tr>`).join('');
  }
  content.innerHTML = `
    <div class="admin-stats-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:1.25rem">
      ${statCard('Total Products', products.length, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>', '#2563eb')}
      ${statCard('Low Stock (≤10)', lowStock.length, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>', '#f59e0b')}
      ${statCard('Out of Stock', outOfStock.length, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>', '#ef4444')}
    </div>
    <div class="admin-table-wrap">
      <div class="admin-toolbar"><h3>Out of Stock</h3></div>
      <div class="admin-table-container"><table><thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Update</th></tr></thead><tbody>${stockTable(outOfStock, 'All products are in stock! 🎉')}</tbody></table></div>
    </div>
    <div class="admin-table-wrap" style="margin-top:1.25rem">
      <div class="admin-toolbar"><h3>Low Stock</h3></div>
      <div class="admin-table-container"><table><thead><tr><th>Product</th><th>Category</th><th>Stock</th><th>Update</th></tr></thead><tbody>${stockTable(lowStock, 'No low stock products')}</tbody></table></div>
    </div>`;
}
window.updateStock = async (id) => {
  const val = parseInt(document.getElementById(`stock_${id}`)?.value);
  if (isNaN(val)||val<0) { showToast('Invalid stock value','warning'); return; }
  await update(getRef(`products/${id}`), { stock: val });
  showToast('Stock updated!');
};

// ==== SETTINGS ====
async function renderSettings() {
  const content = document.getElementById('adminContent');
  const snap = await get(getRef('settings'));
  const s = snap.exists() ? snap.val() : {};
  content.innerHTML = `
    <div class="glass-card" style="max-width:640px;margin:0 auto;padding:1.75rem">
      <h3 style="font-weight:700;margin-bottom:1.5rem">Website Settings</h3>
      <div class="form-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem">
        <div class="form-group"><label class="form-label">Site Name</label><input id="sSiteName" value="${escHtml(s.siteName||'Jomidar 2.0')}" placeholder="Jomidar 2.0"></div>
        <div class="form-group"><label class="form-label">Contact Email</label><input id="sEmail" value="${escHtml(s.email||'')}" placeholder="contact@example.com"></div>
        <div class="form-group"><label class="form-label">Contact Phone</label><input id="sPhone" value="${escHtml(s.phone||'')}" placeholder="+880…"></div>
        <div class="form-group"><label class="form-label">Currency Symbol</label><input id="sCurrency" value="${escHtml(s.currency||'৳')}" placeholder="৳"></div>
        <div class="form-group" style="grid-column:span 2"><label class="form-label">Site Address</label><input id="sAddress" value="${escHtml(s.address||'')}" placeholder="Full address…"></div>
        <div class="form-group" style="grid-column:span 2"><label class="form-label">Meta Description</label><textarea id="sMeta" rows="2">${escHtml(s.metaDesc||'')}</textarea></div>
        <div class="form-group" style="grid-column:span 2">
          <label class="toggle-switch"><input type="checkbox" id="sMaintenanceMode" ${s.maintenanceMode?'checked':''}><div class="toggle-slider"></div>Maintenance Mode</label>
        </div>
      </div>
      <button class="btn-primary" id="saveSettingsBtn" style="margin-top:1.5rem">Save Settings</button>
    </div>`;
  document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
    await set(getRef('settings'), {
      siteName: document.getElementById('sSiteName')?.value.trim()||'Jomidar 2.0',
      email:    document.getElementById('sEmail')?.value.trim()||'',
      phone:    document.getElementById('sPhone')?.value.trim()||'',
      currency: document.getElementById('sCurrency')?.value.trim()||'৳',
      address:  document.getElementById('sAddress')?.value.trim()||'',
      metaDesc: document.getElementById('sMeta')?.value.trim()||'',
      maintenanceMode: document.getElementById('sMaintenanceMode')?.checked||false,
    });
    showToast('Settings saved!');
  });
}

// ==== PENDING BADGE ====
function watchPendingOrders() {
  onValue(getRef('orders'), snap => {
    if (!snap.exists()) return;
    const count = Object.values(snap.val()).filter(o=>o.status==='pending').length;
    const badge = document.getElementById('pendingOrdersBadge');
    if (badge) { badge.textContent = count; badge.style.display = count > 0 ? 'flex' : 'none'; }
  });
}

// ==== HELPERS ====
let _modalSaveFn = null;
function openModal(saveFn) {
  _modalSaveFn = saveFn || null;
  const m = document.getElementById('adminModal');
  m.classList.add('active');
  const saveBtn = document.getElementById('modalSaveBtn');
  saveBtn.style.display = '';
  saveBtn.onclick = async () => {
    if (_modalSaveFn) {
      const ok = await _modalSaveFn();
      if (ok !== false) closeModal();
    } else closeModal();
  };
}
function closeModal() {
  const m = document.getElementById('adminModal');
  m.classList.remove('active');
  document.getElementById('modalSaveBtn').style.display = '';
  _modalSaveFn = null;
}

function renderOrdersTable(orders) {
  const PLACEHOLDER = 'https://placehold.co/40x40/e2e8f0/64748b?text=?';
  if (!orders.length) return '<p style="padding:1.5rem;text-align:center;color:var(--text-muted)">No orders yet.</p>';
  return `<table><thead><tr><th>Order ID</th><th>Customer</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
  <tbody>${orders.map(o=>`<tr>
    <td>#${(o.orderId||'').slice(-8).toUpperCase()}</td>
    <td>${o.userName||'—'}</td>
    <td>${formatPrice(o.total||0)}</td>
    <td><span style="text-transform:capitalize;font-weight:600">${o.status||'—'}</span></td>
    <td>${formatDate(o.createdAt)}</td>
  </tr>`).join('')}</tbody></table>`;
}

function escHtml(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
