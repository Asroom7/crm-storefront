// تنظیمات مرکزی اتصال به بک‌اند
const API_BASE = window.CRM_API_BASE || 'https://crm-backend-apj4.onrender.com/api';
const SELLER_ID = Number(window.CRM_SELLER_ID || 1);

(function injectSharedPolishStyles() {
  if (document.querySelector('link[data-storefront-polish]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.dataset.storefrontPolish = 'true';
  link.href = window.location.pathname.includes('/panel/') ? '../storefront-polish.css' : 'storefront-polish.css';
  document.head.appendChild(link);
})();

let storeConfigPromise = null;
let publicCategoriesPromise = null;

function authRedirectPath() {
  return window.location.pathname.includes('/panel/') ? '../admin-login.html' : 'admin-login.html';
}

async function parseApiResponse(res) {
  let data = {};
  try { data = await res.json(); } catch (e) { /* پاسخ بدون JSON */ }
  if (!res.ok) {
    const err = new Error(data.error || 'خطایی رخ داد، دوباره تلاش کن');
    err.status = res.status;
    err.details = data.details;
    throw err;
  }
  return data;
}

function apiRequestHeaders(options) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  return Object.assign(
    isFormData ? {} : { 'Content-Type': 'application/json' },
    options.headers || {}
  );
}

function apiFetch(path, options = {}) {
  options.headers = apiRequestHeaders(options);
  const token = localStorage.getItem('customerToken');
  if (token) options.headers.Authorization = 'Bearer ' + token;

  return fetch(API_BASE + path, options)
    .then(parseApiResponse)
    .catch(function (err) {
      if (err.status === 401) logoutCustomer();
      throw err;
    });
}

function saveCustomerSession(token, customer) {
  localStorage.setItem('customerToken', token);
  localStorage.setItem('customerInfo', JSON.stringify(customer));
}

function getCustomerSession() {
  const token = localStorage.getItem('customerToken');
  const infoRaw = localStorage.getItem('customerInfo');
  if (!token || !infoRaw) return null;
  try {
    return { token, customer: JSON.parse(infoRaw) };
  } catch (e) {
    return null;
  }
}

function logoutCustomer() {
  localStorage.removeItem('customerToken');
  localStorage.removeItem('customerInfo');
}

function currentStorePageTarget() {
  const file = window.location.pathname.split('/').filter(Boolean).pop() || 'index.html';
  return file + window.location.search + window.location.hash;
}

function safeNextTarget(value, fallback) {
  const defaultTarget = fallback || 'index.html';
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('//') || raw.includes('..') || /^(?:[a-z]+:)?\/\//i.test(raw)) return defaultTarget;
  if (!/^[\w./?=&%+#-]+$/.test(raw)) return defaultTarget;
  if (raw.includes('admin-') || raw.startsWith('panel/')) return defaultTarget;
  return raw;
}

function getRequestedNext(fallback) {
  const raw = new URLSearchParams(window.location.search).get('next');
  return safeNextTarget(raw, fallback || 'index.html');
}

function requireCustomerAuth() {
  var session = getCustomerSession();
  if (!session) {
    var next = encodeURIComponent(currentStorePageTarget());
    window.location.replace('login.html?next=' + next);
    return null;
  }
  return session;
}

function toFaDigits(str) {
  var map = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹' };
  return String(str).replace(/[0-9]/g, function (d) { return map[d]; });
}

function formatPrice(num) {
  return toFaDigits(Number(num || 0).toLocaleString('en-US'));
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
  });
}

function getProductMinPrice(product) {
  var prices = Array.isArray(product && product.prices)
    ? product.prices.map(function (p) { return Number(p.price); }).filter(function (p) { return Number.isFinite(p) && p > 0; })
    : [];
  return prices.length ? Math.min.apply(null, prices) : 0;
}

function getProductPriceLabel(product) {
  var price = getProductMinPrice(product);
  return price > 0 ? formatPrice(price) + ' تومان' : 'قیمت فروش تنظیم نشده';
}

function safeMediaUrl(url) {
  try {
    var parsed = new URL(String(url || ''), window.location.href);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch (e) {
    return '';
  }
}

function getProductImageUrl(product) {
  if (!product || !Array.isArray(product.media)) return '';
  var image = product.media.find(function (m) { return m && m.kind === 'image' && safeMediaUrl(m.url); });
  return image ? safeMediaUrl(image.url) : '';
}

function saveSellerSession(token, seller) {
  localStorage.setItem('sellerToken', token);
  localStorage.setItem('sellerInfo', JSON.stringify(seller));
}

function getSellerSession() {
  const token = localStorage.getItem('sellerToken');
  const infoRaw = localStorage.getItem('sellerInfo');
  if (!token || !infoRaw) return null;
  try {
    return { token, seller: JSON.parse(infoRaw) };
  } catch (e) {
    return null;
  }
}

function logoutSeller() {
  localStorage.removeItem('sellerToken');
  localStorage.removeItem('sellerInfo');
}

function getCart() {
  try {
    var cart = JSON.parse(localStorage.getItem('cart') || '[]');
    return Array.isArray(cart) ? cart : [];
  } catch (e) {
    return [];
  }
}

function cartQuantity() {
  return getCart().reduce(function (sum, item) {
    var qty = Number(item && item.quantity);
    return sum + (Number.isFinite(qty) && qty > 0 ? qty : 0);
  }, 0);
}

function updateCartBadges() {
  var quantity = cartQuantity();
  document.querySelectorAll('a[href="cart.html"]').forEach(function (link) {
    link.classList.add('cart-link');
    var badge = link.querySelector('.cart-count-badge');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'cart-count-badge';
      link.appendChild(badge);
    }
    badge.textContent = quantity > 99 ? '۹۹+' : toFaDigits(quantity);
    badge.hidden = quantity <= 0;
  });
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartBadges();
}

function addToCart(productId, quantity) {
  var id = Number(productId);
  var qty = Math.max(1, Math.floor(Number(quantity) || 1));
  if (!Number.isInteger(id) || id <= 0) return;
  var cart = getCart();
  var existing = cart.find(function (i) { return Number(i.productId) === id; });
  if (existing) existing.quantity = Math.max(1, Math.floor(Number(existing.quantity) || 0) + qty);
  else cart.push({ productId: id, quantity: qty });
  saveCart(cart);
}

function updateCartQuantity(productId, quantity) {
  var id = Number(productId);
  var cart = getCart();
  if (quantity <= 0) {
    cart = cart.filter(function (i) { return Number(i.productId) !== id; });
  } else {
    var item = cart.find(function (i) { return Number(i.productId) === id; });
    if (item) item.quantity = Math.max(1, Math.floor(Number(quantity) || 1));
  }
  saveCart(cart);
}

function removeFromCart(productId) {
  var id = Number(productId);
  saveCart(getCart().filter(function (i) { return Number(i.productId) !== id; }));
}

function clearCart() {
  localStorage.removeItem('cart');
  updateCartBadges();
}

var ORDER_STATUS_LABELS = {
  pending_payment: 'در انتظار پرداخت',
  pending_review: 'در انتظار تایید',
  paid: 'پرداخت شده',
  confirmed: 'تایید شده',
  shipped: 'ارسال شده',
  rejected: 'رد شده',
  cancelled: 'لغو شده'
};

function getOrderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status;
}

function requireSellerAuth() {
  var session = getSellerSession();
  if (!session) window.location.href = authRedirectPath();
  return session;
}

function sellerApiFetch(path, options = {}) {
  options.headers = apiRequestHeaders(options);
  var session = getSellerSession();
  if (session) options.headers.Authorization = 'Bearer ' + session.token;

  return fetch(API_BASE + path, options)
    .then(parseApiResponse)
    .catch(function (err) {
      if (err.status === 401) {
        logoutSeller();
        window.location.href = authRedirectPath();
      }
      throw err;
    });
}

function fetchStoreConfig() {
  if (!storeConfigPromise) {
    storeConfigPromise = apiFetch('/store/public/' + SELLER_ID).catch(function (err) {
      storeConfigPromise = null;
      throw err;
    });
  }
  return storeConfigPromise;
}

function fetchPublicCategories() {
  if (!publicCategoriesPromise) {
    publicCategoriesPromise = apiFetch('/categories/public/' + SELLER_ID).catch(function (err) {
      publicCategoriesPromise = null;
      throw err;
    });
  }
  return publicCategoriesPromise;
}

function applyStoreBrand(config) {
  var brand = config && config.seller && (config.seller.brandName || config.seller.name);
  if (brand) document.querySelectorAll('.logo, .admin-login-logo').forEach(function (el) { el.textContent = brand; });

  var supportPhone = config && config.seller ? config.seller.supportPhone : null;
  document.querySelectorAll('.footer-links a:first-child').forEach(function (link) {
    if (supportPhone) {
      link.href = 'tel:' + String(supportPhone).replace(/[^+\d]/g, '');
      link.textContent = 'تماس با ما';
    } else {
      link.removeAttribute('href');
      link.setAttribute('aria-disabled', 'true');
    }
  });
  document.querySelectorAll('.footer-links a:nth-child(2)').forEach(function (link) {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
    link.title = 'قوانین بازگشت کالا هنوز در تنظیمات فروشگاه ثبت نشده است';
  });
}

function applyCustomerNavigation() {
  var session = getCustomerSession();
  document.querySelectorAll('a[href="login.html"]').forEach(function (link) {
    if (session) {
      link.href = 'profile.html';
      link.textContent = '👤 حساب کاربری';
    }
  });

  var next = new URLSearchParams(window.location.search).get('next');
  if (next) {
    document.querySelectorAll('.auth-switch a[href="register.html"], .auth-switch a[href="login.html"]').forEach(function (link) {
      var url = new URL(link.getAttribute('href'), window.location.href);
      url.searchParams.set('next', safeNextTarget(next, 'index.html'));
      link.href = url.pathname.split('/').pop() + url.search;
    });
  }
}

function hydrateSideMenuCategories(categories) {
  document.querySelectorAll('.side-menu .side-menu-sep').forEach(function (separator) {
    var node = separator.nextElementSibling;
    while (node) {
      var next = node.nextElementSibling;
      if (node.tagName === 'A') node.remove();
      node = next;
    }
    (categories || []).forEach(function (category) {
      var link = document.createElement('a');
      link.href = 'products.html?category=' + encodeURIComponent(category.id);
      link.textContent = category.name;
      separator.parentElement.appendChild(link);
    });
  });
}

function applyStoreChrome() {
  updateCartBadges();
  applyCustomerNavigation();
  fetchStoreConfig().then(applyStoreBrand).catch(function () { /* صفحه بدون تنظیمات هم قابل استفاده بماند */ });
  if (document.querySelector('.side-menu-sep')) {
    fetchPublicCategories().then(hydrateSideMenuCategories).catch(function () { /* دسته‌ها در بارگذاری بعدی تلاش می‌شوند */ });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyStoreChrome);
} else {
  applyStoreChrome();
}
