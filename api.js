// تنظیمات مرکزی اتصال به بک‌اند
const API_BASE = window.CRM_API_BASE || 'https://crm-backend-apj4.onrender.com/api';
const SELLER_ID = Number(window.CRM_SELLER_ID || 1);

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
  if (prices.length) return Math.min.apply(null, prices);
  return Number(product && product.costPrice || 0);
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

function requireCustomerAuth() {
  var session = getCustomerSession();
  if (!session) window.location.href = 'login.html';
  return session;
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

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(productId, quantity) {
  var qty = Math.max(1, Number(quantity) || 1);
  var cart = getCart();
  var existing = cart.find(function (i) { return i.productId === productId; });
  if (existing) existing.quantity += qty;
  else cart.push({ productId: productId, quantity: qty });
  saveCart(cart);
}

function updateCartQuantity(productId, quantity) {
  var cart = getCart();
  if (quantity <= 0) {
    cart = cart.filter(function (i) { return i.productId !== productId; });
  } else {
    var item = cart.find(function (i) { return i.productId === productId; });
    if (item) item.quantity = quantity;
  }
  saveCart(cart);
}

function removeFromCart(productId) {
  saveCart(getCart().filter(function (i) { return i.productId !== productId; }));
}

function clearCart() {
  localStorage.removeItem('cart');
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
