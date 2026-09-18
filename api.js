// تنظیمات مرکزی اتصال به بک‌اند
// چون فعلاً سایت تک‌فروشگاهیه، sellerId ثابت 1 (همون فروشنده تست/اصلی) است
const API_BASE = 'https://crm-backend-apj4.onrender.com/api';
const SELLER_ID = 1;

function apiFetch(path, options = {}) {
  options.headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {}
  );
  const token = localStorage.getItem('customerToken');
  if (token) {
    options.headers['Authorization'] = 'Bearer ' + token;
  }
  return fetch(API_BASE + path, options).then(async (res) => {
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      throw new Error(data.error || 'خطایی رخ داد، دوباره تلاش کن');
    }
    return data;
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

// قیمت واقعی فروش — چون orders.js فقط از costPrice استفاده می‌کنه (نه آرایه prices)،
// همه‌جا همین رو به‌عنوان «قیمت» نمایش می‌دیم تا با مبلغ واقعی سفارش یکی باشه
function getProductMinPrice(product) {
  return product.costPrice || 0;
}

// صفحاتی مثل پروفایل که فقط برای مشتری واردشده معنی دارن، اول این رو صدا بزنن
function requireCustomerAuth() {
  var session = getCustomerSession();
  if (!session) {
    window.location.href = 'login.html';
  }
  return session;
}

// --- نشست فروشنده (پنل مدیریت) — کاملاً جدا از نشست مشتری ---
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

// --- سبد خرید (سمت مرورگر، تا لحظه ثبت نهایی سفارش) ---
function getCart() {
  try {
    return JSON.parse(localStorage.getItem('cart') || '[]');
  } catch (e) {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem('cart', JSON.stringify(cart));
}

function addToCart(productId, quantity) {
  var cart = getCart();
  var existing = cart.find(function (i) { return i.productId === productId; });
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ productId: productId, quantity: quantity });
  }
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
  pending_review: 'در انتظار تایید',
  confirmed: 'تایید شده',
  shipped: 'ارسال شده',
  rejected: 'رد شده'
};

function getOrderStatusLabel(status) {
  return ORDER_STATUS_LABELS[status] || status;
}

// هر صفحه پنل مدیریت باید اول همین رو صدا بزنه؛ اگه لاگین نباشه می‌فرسته به admin-login
function requireSellerAuth() {
  var session = getSellerSession();
  if (!session) {
    window.location.href = 'admin-login.html';
  }
  return session;
}

function sellerApiFetch(path, options = {}) {
  options.headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {}
  );
  var session = getSellerSession();
  if (session) {
    options.headers['Authorization'] = 'Bearer ' + session.token;
  }
  return fetch(API_BASE + path, options).then(async (res) => {
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (res.status === 401) {
      logoutSeller();
      window.location.href = 'admin-login.html';
      throw new Error('نشست شما منقضی شده، دوباره وارد شو');
    }
    if (!res.ok) {
      throw new Error(data.error || 'خطایی رخ داد، دوباره تلاش کن');
    }
    return data;
  });
}
