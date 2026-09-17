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
