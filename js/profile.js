import { auth, db, getRef } from './firebase.js';
import { onAuthStateChanged, updatePassword, EmailAuthProvider, reauthenticateWithCredential, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { get, set, update, remove, push, onValue } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';
import { renderNavbar, renderFooter, initOfflineDetection, initTheme, showToast, formatPrice, formatDate, confirmDialog } from './utils.js';

initTheme();
renderNavbar('profile');
renderFooter();
initOfflineDetection();

let currentUser = null;
let userData = {};

onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = './login.html'; return; }
  currentUser = user;
  loadUserData(user);
});

async function loadUserData(user) {
  try {
    const snap = await get(getRef(`users/${user.uid}`));
    userData = snap.exists() ? snap.val() : {};
    renderSidebar(user, userData);
    renderSection('overview');
  } catch(e) { console.error(e); }
}

function renderSidebar(user, data) {
  const nameEl  = document.getElementById('profileName');
  const emailEl = document.getElementById('profileEmail');
  const avatarEl= document.getElementById('avatarImg');
  if (nameEl)  nameEl.textContent  = data.name  || user.displayName || 'User';
  if (emailEl) emailEl.textContent = data.email || user.email || '';
  if (avatarEl) {
    if (data.avatar || user.photoURL) avatarEl.src = data.avatar || user.photoURL;
    else avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name||'User')}&background=2563eb&color=fff`;
  }
  // Avatar upload
  avatarEl?.addEventListener('click', () => document.getElementById('avatarInput').click());
  document.getElementById('avatarInput')?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast('Uploading photo…', 'info');
      const storage = getStorage();
      const sRef = storageRef(storage, `avatars/${currentUser.uid}`);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      await updateProfile(currentUser, { photoURL: url });
      await update(getRef(`users/${currentUser.uid}`), { avatar: url });
      avatarEl.src = url;
      showToast('Profile photo updated!');
    } catch { showToast('Failed to upload photo', 'error'); }
  });
}

// Nav switching
document.querySelectorAll('.profile-nav-item[data-section]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.profile-nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderSection(btn.dataset.section);
  });
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await auth.signOut();
  window.location.href = './login.html';
});

async function renderSection(sectionId) {
  document.querySelectorAll('.profile-section').forEach(s => s.classList.remove('active'));
  const section = document.getElementById(`section-${sectionId}`);
  if (!section) return;
  section.classList.add('active');
  if (sectionId === 'overview')    renderOverview();
  if (sectionId === 'editProfile') renderEditProfile();
  if (sectionId === 'addresses')   renderAddresses();
  if (sectionId === 'orders')      renderOrders();
  if (sectionId === 'notifications') renderNotifications();
}

async function renderOverview() {
  try {
    const ordersSnap = await get(getRef('orders'));
    let orders = [];
    if (ordersSnap.exists()) {
      orders = Object.entries(ordersSnap.val()).filter(([, o]) => o.userId === currentUser.uid);
    }
    const totalSpent = orders.reduce((s, [, o]) => s + (o.total||0), 0);
    const delivered  = orders.filter(([, o]) => o.status === 'delivered').length;
    const wishSnap   = await get(getRef(`wishlist/${currentUser.uid}`));
    const wishCount  = wishSnap.exists() ? Object.keys(wishSnap.val()).length : 0;
    document.getElementById('profileStats').innerHTML = `
      <div class="stat-card"><div class="stat-value">${orders.length}</div><div class="stat-label">Total Orders</div></div>
      <div class="stat-card"><div class="stat-value">${delivered}</div><div class="stat-label">Delivered</div></div>
      <div class="stat-card"><div class="stat-value">${wishCount}</div><div class="stat-label">Wishlist</div></div>
      <div class="stat-card"><div class="stat-value">${formatPrice(totalSpent)}</div><div class="stat-label">Total Spent</div></div>`;
    const recent = orders.sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0)).slice(0,3);
    const recentEl = document.getElementById('recentOrdersOverview');
    if (recentEl) {
      if (!recent.length) { recentEl.innerHTML = '<p style="color:var(--text-muted)">No orders yet.</p>'; }
      else recentEl.innerHTML = recent.map(([id, o]) => `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0.625rem 0;border-bottom:1px solid var(--border);font-size:0.875rem">
          <div><div style="font-weight:600">#${id.slice(-8).toUpperCase()}</div><div style="color:var(--text-muted)">${formatDate(o.createdAt)}</div></div>
          <div style="text-align:right"><div style="font-weight:700;color:var(--primary)">${formatPrice(o.total)}</div><div style="color:var(--text-muted);text-transform:capitalize">${o.status}</div></div>
        </div>`).join('');
    }
  } catch(e) { console.error(e); }
}

function renderEditProfile() {
  const nameEl  = document.getElementById('editName');
  const phoneEl = document.getElementById('editPhone');
  const emailEl = document.getElementById('editEmail');
  const bioEl   = document.getElementById('editBio');
  if (nameEl)  nameEl.value  = userData.name  || currentUser.displayName || '';
  if (phoneEl) phoneEl.value = userData.phone || '';
  if (emailEl) emailEl.value = userData.email || currentUser.email || '';
  if (bioEl)   bioEl.value   = userData.bio   || '';

  document.getElementById('saveProfileBtn')?.addEventListener('click', async () => {
    const name  = nameEl?.value.trim();
    const phone = phoneEl?.value.trim();
    const bio   = bioEl?.value.trim();
    if (!name) { showToast('Name is required', 'warning'); return; }
    try {
      await updateProfile(currentUser, { displayName: name });
      await update(getRef(`users/${currentUser.uid}`), { name, phone, bio });
      userData = { ...userData, name, phone, bio };
      document.getElementById('profileName').textContent = name;
      showToast('Profile updated successfully!');
    } catch { showToast('Failed to update profile', 'error'); }
  });

  document.getElementById('changePasswordBtn')?.addEventListener('click', async () => {
    const pw1 = document.getElementById('newPassword')?.value;
    const pw2 = document.getElementById('confirmNewPassword')?.value;
    if (!pw1 || pw1.length < 6) { showToast('Password must be at least 6 characters', 'warning'); return; }
    if (pw1 !== pw2) { showToast('Passwords do not match', 'error'); return; }
    try {
      await updatePassword(currentUser, pw1);
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmNewPassword').value = '';
      showToast('Password updated!');
    } catch(e) {
      if (e.code === 'auth/requires-recent-login') showToast('Please sign out and sign in again before changing password', 'warning');
      else showToast('Failed to update password', 'error');
    }
  });
}

async function renderAddresses() {
  const list = document.getElementById('addressesList');
  if (!list) return;
  try {
    const snap = await get(getRef(`users/${currentUser.uid}/addresses`));
    const addrs = snap.exists() ? Object.entries(snap.val()) : [];
    if (!addrs.length) { list.innerHTML = '<p style="color:var(--text-muted)">No addresses saved yet.</p>'; }
    else list.innerHTML = addrs.map(([id, a]) => `
      <div class="address-card ${a.isDefault?'default':''}">
        ${a.isDefault ? '<div class="default-label">✓ Default</div>' : ''}
        <h4>${a.name || userData.name || 'User'}</h4>
        <p>${a.line}, ${a.city}${a.district ? ', '+a.district : ''}</p>
        <p>${a.phone || ''}</p>
        <div class="address-actions">
          ${!a.isDefault ? `<button class="btn-secondary btn-sm set-default-btn" data-id="${id}">Set Default</button>` : ''}
          <button class="btn-secondary btn-sm edit-addr-btn" data-id="${id}">Edit</button>
          <button class="btn-secondary btn-sm" style="color:var(--danger)" data-id="${id}" onclick="deleteAddress('${id}')">Delete</button>
        </div>
      </div>`).join('');
    list.querySelectorAll('.set-default-btn').forEach(btn => btn.addEventListener('click', () => setDefaultAddress(btn.dataset.id)));
    list.querySelectorAll('.edit-addr-btn').forEach(btn => btn.addEventListener('click', () => openAddressModal(btn.dataset.id)));
  } catch(e) { console.error(e); }
}

document.getElementById('addAddressBtn')?.addEventListener('click', () => openAddressModal());
function openAddressModal(addrId) {
  const modal = document.getElementById('addressModal');
  if (!modal) return;
  document.getElementById('addressModalTitle').textContent = addrId ? 'Edit Address' : 'Add Address';
  if (addrId) {
    get(getRef(`users/${currentUser.uid}/addresses/${addrId}`)).then(snap => {
      if (!snap.exists()) return;
      const a = snap.val();
      document.getElementById('addrName').value = a.name||'';
      document.getElementById('addrPhone').value = a.phone||'';
      document.getElementById('addrLine').value = a.line||'';
      document.getElementById('addrCity').value = a.city||'';
      document.getElementById('addrDistrict').value = a.district||'';
      document.getElementById('addrDefault').checked = a.isDefault||false;
    });
  } else {
    ['addrName','addrPhone','addrLine','addrCity'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  }
  modal.classList.add('active');
  document.getElementById('saveAddressBtn').onclick = () => saveAddress(addrId);
}

async function saveAddress(addrId) {
  const name     = document.getElementById('addrName')?.value.trim();
  const phone    = document.getElementById('addrPhone')?.value.trim();
  const line     = document.getElementById('addrLine')?.value.trim();
  const city     = document.getElementById('addrCity')?.value.trim();
  const district = document.getElementById('addrDistrict')?.value;
  const isDefault= document.getElementById('addrDefault')?.checked;
  if (!line || !city) { showToast('Address and city are required', 'warning'); return; }
  try {
    const addrData = { name, phone, line, city, district, isDefault };
    if (addrId) {
      await update(getRef(`users/${currentUser.uid}/addresses/${addrId}`), addrData);
    } else {
      await push(getRef(`users/${currentUser.uid}/addresses`), addrData);
    }
    if (isDefault) await setDefaultAddress(addrId, addrData);
    document.getElementById('addressModal').classList.remove('active');
    showToast('Address saved!');
    renderAddresses();
  } catch { showToast('Failed to save address', 'error'); }
}

async function setDefaultAddress(addrId, addrData) {
  try {
    // Remove default from all, set on this one
    const snap = await get(getRef(`users/${currentUser.uid}/addresses`));
    if (snap.exists()) {
      const updates = {};
      Object.keys(snap.val()).forEach(id => { updates[`users/${currentUser.uid}/addresses/${id}/isDefault`] = id === addrId; });
      await update(getRef(''), updates);
    }
    await update(getRef(`users/${currentUser.uid}`), { defaultAddress: addrData || null });
    showToast('Default address updated');
    renderAddresses();
  } catch { showToast('Failed to update default', 'error'); }
}

window.deleteAddress = async (addrId) => {
  const confirmed = await confirmDialog('Delete this address?');
  if (!confirmed) return;
  await remove(getRef(`users/${currentUser.uid}/addresses/${addrId}`));
  showToast('Address deleted', 'info');
  renderAddresses();
};

async function renderOrders() {
  const list = document.getElementById('profileOrdersList');
  if (!list) return;
  list.innerHTML = '<div class="skeleton" style="height:120px;border-radius:var(--radius)"></div>';
  try {
    const snap = await get(getRef('orders'));
    if (!snap.exists()) { list.innerHTML = '<p style="color:var(--text-muted)">No orders yet.</p>'; return; }
    const orders = Object.entries(snap.val())
      .filter(([, o]) => o.userId === currentUser.uid)
      .sort((a,b) => (b[1].createdAt||0)-(a[1].createdAt||0));
    if (!orders.length) { list.innerHTML = '<p style="color:var(--text-muted)">No orders yet.</p>'; return; }
    const PLACEHOLDER = 'https://placehold.co/50x50/e2e8f0/64748b?text=?';
    list.innerHTML = orders.map(([id, o]) => {
      const items = Array.isArray(o.items) ? o.items : Object.values(o.items||{});
      return `
        <div class="order-card" style="margin-bottom:0.875rem">
          <div class="order-header">
            <div><div class="order-id">#${id.slice(-8).toUpperCase()}</div><div class="order-date">${formatDate(o.createdAt)}</div></div>
            <span class="badge" style="text-transform:capitalize;border-radius:999px;padding:0.25rem 0.875rem;font-size:0.8125rem;font-weight:600;border:1px solid">${o.status}</span>
          </div>
          <div class="order-items-list">
            ${items.slice(0,2).map(item=>`
              <div class="order-item-row">
                <img class="order-item-img" src="${item.image||PLACEHOLDER}" alt="${item.name}" loading="lazy">
                <div class="order-item-name">${item.name} × ${item.qty}</div>
                <div class="order-item-price">${formatPrice(item.price*item.qty)}</div>
              </div>`).join('')}
            ${items.length > 2 ? `<div style="font-size:0.8125rem;color:var(--text-muted);padding:0.25rem 0">+${items.length-2} more</div>` : ''}
          </div>
          <div class="order-footer">
            <div class="order-total">Total: <span style="color:var(--primary);font-weight:700">${formatPrice(o.total)}</span></div>
          </div>
        </div>`;
    }).join('');
  } catch(e) { console.error(e); }
}

async function renderNotifications() {
  const list = document.getElementById('notificationsList');
  if (!list) return;
  try {
    const snap = await get(getRef(`notifications/${currentUser.uid}`));
    if (!snap.exists()) {
      list.innerHTML = '<div class="profile-card"><p style="color:var(--text-muted);text-align:center;padding:1rem">No notifications yet.</p></div>';
      return;
    }
    const notifs = Object.entries(snap.val()).sort((a,b)=>(b[1].createdAt||0)-(a[1].createdAt||0));
    list.innerHTML = `<div class="profile-card">${notifs.map(([id, n]) => `
      <div class="notif-item ${n.read?'':'unread'}">
        <div class="notif-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </div>
        <div class="notif-content">
          <div class="notif-title">${n.title||'Notification'}</div>
          <div class="notif-text">${n.message||''}</div>
        </div>
        <div class="notif-time">${formatDate(n.createdAt)}</div>
      </div>`).join('')}</div>`;
    // Mark all as read
    const updates = {};
    notifs.filter(([,n])=>!n.read).forEach(([id])=>{updates[`notifications/${currentUser.uid}/${id}/read`]=true;});
    if (Object.keys(updates).length) await update(getRef(''), updates);
  } catch(e) { console.error(e); }
}
