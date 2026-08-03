/* =====================================================
   LẠI HÚP FILE — main.js
   ⚠️ QUAN TRỌNG: nếu deploy frontend này lên GitHub Pages (hoặc bất kỳ
   host tĩnh nào tách rời backend), BẮT BUỘC phải sửa API_BASE_URL bên dưới
   thành domain backend thật (VPS) đã deploy, có HTTPS.
   Ví dụ: const API_BASE_URL = 'https://api.laihupfile.com';
   Nếu để trống '', code sẽ gọi API cùng domain đang mở trang này —
   chỉ đúng khi backend Node.js tự serve luôn file frontend (app.use(express.static(...))
   trong server.js), tức là chạy trên CHÍNH VPS đó, không phải GitHub Pages.
   ===================================================== */
const API_BASE_URL = 'http://adr.io.vn:12479';


const state = {
  accessToken: sessionStorage.getItem('lhf_access_token') || null,
  user: null,
  categories: [],
  currentCategory: null,
  currentTab: 'newest',
  currentSort: '',
  searchQuery: '',
  page: 1,
  currentFile: null, // file đang mở ở modal chi tiết
};

/* ===================== API HELPER ===================== */
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include', // gửi cookie nếu cùng domain (refresh token flow)
  });

  let data = null;
  try { data = await res.json(); } catch (_) { /* no body */ }

  if (!res.ok) {
    const message = data?.message || `Lỗi ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.code = data?.code;
    err.payload = data;
    throw err;
  }
  return data;
}

/* ===================== TOAST ===================== */
function toast(message, type = 'default', ms = 3200) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 250);
  }, ms);
}

/* ===================== DARK MODE ===================== */
function initTheme() {
  const saved = localStorage.getItem('lhf_theme');
  const preferDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (preferDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('lhf_theme', next);
  updateThemeIcon(next);
}
function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  btn.innerHTML = theme === 'dark'
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>';
}

/* ===================== MODAL HELPERS ===================== */
function openModal(id) { document.getElementById(id).classList.add('open'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.remove('open'); document.body.style.overflow = ''; }
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

/* ===================== AUTH ===================== */
async function restoreSession() {
  if (!state.accessToken) return;
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
    renderAuthArea();
  } catch (err) {
    // Access token hết hạn/không hợp lệ -> thử refresh (chỉ hoạt động nếu cookie cùng domain)
    try {
      const refreshed = await api('/api/auth/refresh', { method: 'POST' });
      state.accessToken = refreshed.accessToken;
      sessionStorage.setItem('lhf_access_token', state.accessToken);
      const me = await api('/api/auth/me');
      state.user = me.user;
      renderAuthArea();
    } catch (_) {
      clearSession();
    }
  }
}

function clearSession() {
  state.accessToken = null;
  state.user = null;
  sessionStorage.removeItem('lhf_access_token');
  renderAuthArea();
}

function renderAuthArea() {
  const el = document.getElementById('authArea');
  if (state.user) {
    el.innerHTML = `
      <div class="user-chip" id="userChipBtn" style="cursor:pointer">
        <img src="${resolveAvatar(state.user.avatar)}" alt="">
        <span>${escapeHtml(state.user.username)}</span>
        <span class="pts">${formatNumber(state.user.points || 0)}đ</span>
      </div>`;
    document.getElementById('userChipBtn').addEventListener('click', () => {
      if (confirm('Đăng xuất khỏi Lại Húp File?')) doLogout();
    });
  } else {
    el.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="loginBtn">Đăng nhập</button>
      <button class="btn btn-primary btn-sm" id="registerBtn">Đăng ký</button>`;
    document.getElementById('loginBtn').addEventListener('click', () => openModal('loginModal'));
    document.getElementById('registerBtn').addEventListener('click', () => openModal('registerModal'));
  }
}

async function doLogin(e) {
  e.preventDefault();
  const form = e.target;
  const errorEl = form.querySelector('.form-error');
  errorEl.style.display = 'none';
  const btn = form.querySelector('button[type="submit"]');
  setLoading(btn, true);
  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: form.email.value.trim(),
        password: form.password.value,
        remember: form.remember.checked,
      }),
    });
    state.accessToken = data.accessToken;
    state.user = data.user;
    sessionStorage.setItem('lhf_access_token', state.accessToken);
    renderAuthArea();
    closeModal('loginModal');
    form.reset();
    toast(`Chào mừng trở lại, ${data.user.username}!`, 'success');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    setLoading(btn, false);
  }
}

async function doRegister(e) {
  e.preventDefault();
  const form = e.target;
  const errorEl = form.querySelector('.form-error');
  errorEl.style.display = 'none';

  if (form.password.value !== form.confirmPassword.value) {
    errorEl.textContent = 'Mật khẩu nhập lại không khớp.';
    errorEl.style.display = 'block';
    return;
  }
  if (!form.captcha.checked) {
    errorEl.textContent = 'Vui lòng xác nhận captcha.';
    errorEl.style.display = 'block';
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  setLoading(btn, true);
  try {
    const data = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        fullName: form.fullName.value.trim(),
        username: form.username.value.trim(),
        email: form.email.value.trim(),
        password: form.password.value,
        confirmPassword: form.confirmPassword.value,
        captchaToken: 'demo-captcha-token', // TODO: thay bằng token hCaptcha/reCAPTCHA thật
      }),
    });
    state.accessToken = data.accessToken;
    state.user = data.user;
    sessionStorage.setItem('lhf_access_token', state.accessToken);
    renderAuthArea();
    closeModal('registerModal');
    form.reset();
    toast('Đăng ký thành công! Chào mừng bạn tới Lại Húp File 🎉', 'success');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    setLoading(btn, false);
  }
}

async function doLogout() {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) { /* ignore */ }
  clearSession();
  toast('Đã đăng xuất.');
}

function setLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.dataset.label = btn.dataset.label || btn.innerHTML;
  btn.innerHTML = loading ? '<span class="spinner"></span>' : btn.dataset.label;
}

/* ===================== CATEGORIES ===================== */
async function loadCategories() {
  try {
    const data = await api('/api/categories');
    state.categories = data.categories || [];
    renderCategories();
  } catch (_) {
    // Không chặn trang nếu categories lỗi — chỉ ẩn thanh chip
  }
}

function renderCategories() {
  const rail = document.getElementById('chipRail');
  const chips = [`<button class="chip ${!state.currentCategory ? 'active' : ''}" data-cat="">Tất cả</button>`]
    .concat(state.categories.map((c) => `<button class="chip ${state.currentCategory == c.id ? 'active' : ''}" data-cat="${c.id}">${escapeHtml(c.name)}</button>`));
  rail.innerHTML = chips.join('');
  rail.querySelectorAll('.chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.currentCategory = btn.dataset.cat || null;
      state.page = 1;
      renderCategories();
      loadFiles();
    });
  });
}

/* ===================== FILES ===================== */
function buildQuery() {
  const params = new URLSearchParams();
  if (state.searchQuery) params.set('q', state.searchQuery);
  if (state.currentCategory) params.set('categoryId', state.currentCategory);
  if (state.currentSort) params.set('sort', state.currentSort);
  if (state.currentTab === 'free') params.set('freeOnly', 'true');
  if (state.currentTab === 'paid') params.set('paidOnly', 'true');
  if (state.currentTab === 'popular') params.set('sort', 'popular');
  if (state.currentTab === 'most_purchased') params.set('sort', 'most_purchased');
  if (state.currentTab === 'top_rated') params.set('sort', 'top_rated');
  params.set('page', state.page);
  params.set('limit', 20);
  return params.toString();
}

async function loadFiles() {
  const grid = document.getElementById('fileGrid');
  renderSkeletons(grid, 8);
  try {
    const data = await api(`/api/files?${buildQuery()}`);
    renderFiles(grid, data.rows || []);
  } catch (err) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>Không tải được danh sách file</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderSkeletons(grid, count) {
  grid.innerHTML = Array.from({ length: count }).map(() => `
    <div class="file-card sk-card">
      <div class="file-thumb skeleton"></div>
      <div class="file-body">
        <div class="sk-line skeleton"></div>
        <div class="sk-line skeleton"></div>
        <div class="sk-line skeleton"></div>
      </div>
    </div>
  `).join('');
}

function renderFiles(grid, files) {
  if (!files.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
      <h3>Chưa có file nào ở đây</h3>
      <p>Thử đổi bộ lọc hoặc quay lại sau nhé.</p>
    </div>`;
    return;
  }

  grid.innerHTML = files.map((f) => `
    <article class="file-card" data-slug="${f.slug}">
      <div class="file-thumb">
        <span class="stamp-badge ${f.file_type}">${f.file_type === 'free' ? 'MIỄN PHÍ' : 'TRẢ PHÍ'}</span>
        ${f.thumbnail ? `<img src="${resolveThumb(f.thumbnail)}" alt="${escapeHtml(f.title)}" loading="lazy">` : `<div class="no-img">Lại Húp File</div>`}
      </div>
      <div class="file-body">
        <div class="file-cat">${escapeHtml(f.category_name || 'Chưa phân loại')}</div>
        <h3 class="file-title">${escapeHtml(f.title)}</h3>
        <div class="file-meta">
          <span>⬇ ${formatNumber(f.downloads)}</span>
          <span>★ ${Number(f.rating_avg || 0).toFixed(1)}</span>
          <span>👁 ${formatNumber(f.views)}</span>
        </div>
        <div class="file-footer">
          <div class="file-price">
            ${f.file_type === 'paid' ? formatCurrency(f.price_money) : 'Miễn phí'}
            ${f.price_points > 0 ? `<span class="points">hoặc ${formatNumber(f.price_points)} điểm</span>` : ''}
          </div>
          <button class="btn btn-primary btn-sm" data-quick-slug="${f.slug}">Xem</button>
        </div>
      </div>
    </article>
  `).join('');

  grid.querySelectorAll('.file-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      openFileDetail(card.dataset.slug);
    });
  });
  grid.querySelectorAll('[data-quick-slug]').forEach((btn) => {
    btn.addEventListener('click', () => openFileDetail(btn.dataset.quickSlug));
  });
}

/* ===================== FILE DETAIL + MUA/TẢI ===================== */
async function openFileDetail(slug) {
  const body = document.getElementById('detailBody');
  body.innerHTML = `<div class="empty-state"><span class="spinner" style="border-top-color:var(--accent);border-color:var(--border)"></span></div>`;
  openModal('detailModal');
  try {
    const data = await api(`/api/files/${slug}`);
    state.currentFile = data.file;
    renderFileDetail(data.file, data.owned);
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><h3>Không tải được file</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function renderFileDetail(f, owned) {
  const body = document.getElementById('detailBody');
  const priceLine = f.file_type === 'paid'
    ? `${formatCurrency(f.price_money)}${f.price_points > 0 ? ` &nbsp;|&nbsp; ${formatNumber(f.price_points)} điểm` : ''}`
    : 'Miễn phí';

  let actionsHtml = '';
  if (f.file_type === 'free') {
    actionsHtml = `<button class="btn btn-primary btn-block" id="detailDownloadBtn">Tải xuống</button>`;
  } else if (owned) {
    actionsHtml = `<button class="btn btn-primary btn-block" id="detailDownloadBtn">Tải xuống (đã sở hữu)</button>`;
  } else {
    actionsHtml = `
      <button class="btn btn-primary btn-block" id="detailBuyBtn">Mua — ${formatCurrency(f.price_money)}</button>
      ${f.price_points > 0 ? `<button class="btn btn-ghost btn-block" id="detailBuyPointsBtn">Mua bằng ${formatNumber(f.price_points)} điểm</button>` : ''}
    `;
  }

  body.innerHTML = `
    <div class="detail-grid">
      <div>
        <div class="detail-thumb">
          ${f.thumbnail ? `<img src="${resolveThumb(f.thumbnail)}" alt="">` : `<div class="no-img" style="height:100%;display:flex;align-items:center;justify-content:center">Lại Húp File</div>`}
        </div>
        <div class="detail-tags">
          <span>${escapeHtml(f.category_name || 'Chưa phân loại')}</span>
          <span>v${escapeHtml(f.version || '1.0')}</span>
        </div>
      </div>
      <div>
        <h2 style="font-family:var(--font-display);margin:0 0 6px">${escapeHtml(f.title)}</h2>
        <div class="detail-stats">
          <div><strong>${formatNumber(f.downloads)}</strong>Lượt tải</div>
          <div><strong>${formatNumber(f.purchases)}</strong>Lượt mua</div>
          <div><strong>${Number(f.rating_avg || 0).toFixed(1)} ★</strong>${f.rating_count || 0} đánh giá</div>
          <div><strong>${formatNumber(f.views)}</strong>Lượt xem</div>
        </div>
        <p class="detail-desc">${escapeHtml(f.description || 'Chưa có mô tả.')}</p>
        <div style="font-family:var(--font-mono);font-weight:700;font-size:18px;margin:14px 0">${priceLine}</div>
        <div class="detail-actions" style="flex-direction:column">${actionsHtml}</div>
      </div>
    </div>
  `;

  document.getElementById('detailDownloadBtn')?.addEventListener('click', () => handleDownload(f.id));
  document.getElementById('detailBuyBtn')?.addEventListener('click', () => handleBuy(f.id));
  document.getElementById('detailBuyPointsBtn')?.addEventListener('click', () => handleBuyWithPoints(f.id));
}

async function handleDownload(fileId) {
  if (!state.user && state.currentFile?.file_type === 'paid') {
    closeModal('detailModal');
    openModal('loginModal');
    toast('Vui lòng đăng nhập để tải file.', 'error');
    return;
  }
  try {
    const data = await api(`/api/files/${fileId}/download`, { method: 'POST' });
    if (data.redirectUrl) {
      window.open(data.redirectUrl, '_blank', 'noopener');
    } else if (data.downloadUrl) {
      toast(`Link tải có hiệu lực ${data.expiresInMinutes} phút, dùng 1 lần.`, 'success');
      window.location.href = `${API_BASE_URL}${data.downloadUrl}`;
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function handleBuy(fileId) {
  if (!state.user) { openModal('loginModal'); return; }
  try {
    const data = await api(`/api/files/${fileId}/buy`, { method: 'POST' });
    renderPaymentInfo(data.order, data.payment);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderPaymentInfo(order, payment) {
  const body = document.getElementById('detailBody');
  body.innerHTML = `
    <div style="text-align:center;max-width:360px;margin:0 auto">
      <h2 style="font-family:var(--font-display)">Quét mã để thanh toán</h2>
      <p style="color:var(--text-muted);font-size:13.5px">Mã đơn <strong style="color:var(--text)">${order.orderCode}</strong> — hiệu lực 7 ngày</p>
      <img src="${payment.qrCodeUrl}" alt="QR thanh toán" style="width:100%;border-radius:var(--radius-md);border:1px solid var(--border);margin:16px 0">
      <div style="text-align:left;font-size:13.5px;background:var(--surface);border-radius:var(--radius-md);padding:14px;border:1px solid var(--border)">
        <p style="margin:4px 0"><strong>Ngân hàng:</strong> ${escapeHtml(payment.bankName)}</p>
        <p style="margin:4px 0"><strong>Chủ TK:</strong> ${escapeHtml(payment.accountName)}</p>
        <p style="margin:4px 0"><strong>Số TK:</strong> ${escapeHtml(payment.accountNumber)}</p>
        <p style="margin:4px 0"><strong>Nội dung CK:</strong> ${escapeHtml(payment.transferContent)}</p>
      </div>
      <p style="color:var(--text-muted);font-size:12.5px;margin-top:14px">Sau khi admin xác nhận thanh toán, vào mục "Đơn hàng của tôi" để tải file.</p>
      <button class="btn btn-ghost btn-block" style="margin-top:14px" onclick="closeModal('detailModal')">Đóng</button>
    </div>
  `;
}

async function handleBuyWithPoints(fileId) {
  if (!state.user) { openModal('loginModal'); return; }
  if (!confirm('Xác nhận dùng điểm để mua file này?')) return;
  try {
    await api(`/api/files/${fileId}/buy-with-points`, { method: 'POST' });
    toast('Mua file thành công bằng điểm!', 'success');
    const me = await api('/api/auth/me');
    state.user = me.user;
    renderAuthArea();
    openFileDetail(state.currentFile.slug);
  } catch (err) {
    if (err.payload?.missingPoints) {
      toast(`Bạn còn thiếu ${formatNumber(err.payload.missingPoints)} điểm.`, 'error');
    } else {
      toast(err.message, 'error');
    }
  }
}

/* ===================== UTILS ===================== */
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatNumber(n) { return new Intl.NumberFormat('vi-VN').format(n || 0); }
function formatCurrency(n) { return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0); }
function resolveThumb(path) { return path?.startsWith('http') ? path : `${API_BASE_URL}${path}`; }
function resolveAvatar(path) {
  if (!path) return 'assets/img/default-avatar.svg';
  return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
}
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  renderAuthArea();
  restoreSession();
  loadCategories();
  loadFiles();

  // Search
  const searchInput = document.getElementById('searchInput');
  searchInput?.addEventListener('input', debounce((e) => {
    state.searchQuery = e.target.value.trim();
    state.page = 1;
    loadFiles();
  }, 400));

  // Tabs
  document.querySelectorAll('.tab-pill').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab-pill').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      state.currentTab = tab.dataset.tab;
      state.page = 1;
      loadFiles();
    });
  });

  // Sort
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    state.currentSort = e.target.value;
    loadFiles();
  });

  // Modal close buttons
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });

  // Forms
  document.getElementById('loginForm')?.addEventListener('submit', doLogin);
  document.getElementById('registerForm')?.addEventListener('submit', doRegister);

  // Switch between login/register modals
  document.getElementById('switchToRegister')?.addEventListener('click', () => { closeModal('loginModal'); openModal('registerModal'); });
  document.getElementById('switchToLogin')?.addEventListener('click', () => { closeModal('registerModal'); openModal('loginModal'); });

  // Logo click -> reset filters
  document.getElementById('logoLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    state.searchQuery = ''; state.currentCategory = null; state.currentTab = 'newest'; state.currentSort = ''; state.page = 1;
    searchInput.value = '';
    document.querySelectorAll('.tab-pill').forEach((t) => t.classList.toggle('active', t.dataset.tab === 'newest'));
    renderCategories();
    loadFiles();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});
