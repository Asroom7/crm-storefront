/* panel/app.js — پنل مدیریت یکپارچه (داشبرد + مشتریان + واریزی‌ها + فروش‌ها)
   بر پایه‌ی وب‌اپ CRM قبلی، با این تفاوت که همه‌ی داده‌ها از بک‌اند واقعی (نه IndexedDB) می‌آید.
   توابع تاریخ جلالی / آیکون‌ها / مودال‌ها عیناً از وب‌اپ اصلی حفظ شده‌اند. */

/* ========================================================================
   ۱) تقویم جلالی
   ======================================================================== */
const J = (() => {
  function div(a, b) { return ~~(a / b); }
  function mod(a, b) { return a - ~~(a / b) * b; }
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  function jalCal(jy) {
    const bl = breaks.length;
    let gy = jy + 621, leapJ = -14, jp = breaks[0], jump = 0, jm;
    if (jy < jp || jy >= breaks[bl - 1]) jy = 1404;
    for (let i = 1; i < bl; i += 1) {
      jm = breaks[i]; jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    let n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
    let leap = mod(mod(n + 1, 33) - 1, 4);
    if (leap === -1) leap = 4;
    return { leap: leap === 0, gy, march };
  }
  function g2d(gy, gm, gd) {
    let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) + div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }
  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    const gd = div(mod(i, 153), 5) + 1;
    const gm = mod(div(i, 153), 12) + 1;
    const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
    return { gy, gm, gd };
  }
  function j2d(jy, jm, jd) {
    const r = jalCal(jy);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }
  function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy);
    const jdn1f = g2d(gy, 3, r.march);
    let k = jdn - jdn1f, jm, jd;
    if (k >= 0) {
      if (k <= 185) { jm = 1 + div(k, 31); jd = mod(k, 31) + 1; return { jy, jm, jd }; }
      k -= 186;
    } else { jy -= 1; k += 179; if (r.leap) k += 1; }
    jm = 7 + div(k, 30);
    jd = mod(k, 30) + 1;
    return { jy, jm, jd };
  }
  function toJalaali(gy, gm, gd) { return d2j(g2d(gy, gm, gd)); }
  function toGregorian(jy, jm, jd) { return d2g(j2d(jy, jm, jd)); }
  function isLeapJYear(jy) { return jalCal(jy).leap; }
  function daysInJMonth(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isLeapJYear(jy) ? 30 : 29;
  }
  return { toJalaali, toGregorian, isLeapJYear, daysInJMonth };
})();

const MONTHS_FA = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const DOW_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isoToJalali(iso) {
  if (!iso) return null;
  const [gy, gm, gd] = iso.split('-').map(Number);
  return J.toJalaali(gy, gm, gd);
}
function jalaliToISO(jy, jm, jd) {
  const g = J.toGregorian(jy, jm, jd);
  return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
}
function faDigits(v) {
  const map = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹' };
  return String(v).replace(/[0-9]/g, (d) => map[d]);
}
function formatJalaliDisplay(iso) {
  if (!iso) return '';
  const j = isoToJalali(iso);
  return `${faDigits(j.jd)} ${MONTHS_FA[j.jm - 1]} ${faDigits(j.jy)}`;
}
function isoAddDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function weekRangeISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const offset = (dt.getDay() + 1) % 7;
  const start = isoAddDays(iso, -offset);
  const end = isoAddDays(start, 6);
  return { start, end };
}
function monthRangeISO(iso) {
  const j = isoToJalali(iso);
  const start = jalaliToISO(j.jy, j.jm, 1);
  const end = jalaliToISO(j.jy, j.jm, J.daysInJMonth(j.jy, j.jm));
  return { start, end };
}

/* ========================================================================
   ۲) آیکن‌ها
   ======================================================================== */
const ICONS = {
  home: '<path d="M3 11.5l9-8 9 8"/><path d="M5.5 10v10h13V10"/><path d="M9.5 20v-6h5v6"/>',
  users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20c0-3.6 2.9-6.2 6.5-6.2s6.5 2.6 6.5 6.2"/><circle cx="17.5" cy="9" r="2.4"/><path d="M15.3 14c2.7.4 4.7 2.7 4.7 6"/>',
  cart: '<circle cx="9.5" cy="20.2" r="1.3"/><circle cx="17" cy="20.2" r="1.3"/><path d="M2.2 3h2.3l2.3 12.2a2 2 0 002 1.6h8.6a2 2 0 002-1.6L21 7.2H6.2"/>',
  chat: '<path d="M4 4.5h16v11.2H8.3L4.5 19V4.5z"/>',
  box: '<path d="M3 7.2l9-4 9 4-9 4-9-4z"/><path d="M3 7.2v9.8l9 4 9-4V7.2"/><path d="M12 11.2v9.8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 000-3l1.8-1.5-2-3.4-2.2.7a7.6 7.6 0 00-2.6-1.5L14 2.5h-4l-.4 2.3a7.6 7.6 0 00-2.6 1.5l-2.2-.7-2 3.4L4.6 10.5a7.6 7.6 0 000 3L2.8 15l2 3.4 2.2-.7c.8.7 1.7 1.2 2.6 1.5l.4 2.3h4l.4-2.3a7.6 7.6 0 002.6-1.5l2.2.7 2-3.4z"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  filter: '<path d="M3.5 5h17M6.5 12h11M10 19h4"/>',
  dots: '<circle cx="12" cy="5.2" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="18.8" r="1.4"/>',
  edit: '<path d="M11.5 20.5h9"/><path d="M16 3.5a2.1 2.1 0 013 3L7.5 18l-4 1 1-4L16 3.5z"/>',
  trash: '<path d="M3.5 6.5h17"/><path d="M8.5 6.5V4h7v2.5"/><path d="M18.5 6.5L17.6 20H6.4L5.5 6.5"/><path d="M10 11v6M14 11v6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  phone: '<path d="M5 4.2l3.6-.9 1.7 4.3-1.9 1.9c.9 2.7 2.6 4.4 5.3 5.3l1.9-1.9 4.3 1.7-.9 3.6c-7 .9-13.9-6-13-13z"/>',
  pin: '<path d="M12 21s7-6.6 7-11.2A7 7 0 105 9.8C5 14.4 12 21 12 21z"/><circle cx="12" cy="9.6" r="2.3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.3v5l3.3 3"/>',
  wipe: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.9 18a2 2 0 001.7 3h17a2 2 0 001.7-3L12.9 3.9a2 2 0 00-2.6 0z"/>',
  star: '<path d="M12 2.5l3 6.4 6.9.7-5.1 4.8 1.4 6.9-6.2-3.5-6.2 3.5 1.4-6.9-5.1-4.8 6.9-.7z"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r=".8"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
  check: '<path d="M5 13l4 4L19 7"/>',
  bell: '<path d="M12 3.5a5.5 5.5 0 00-5.5 5.5v3.5L4.5 16h15L17.5 12.5V9A5.5 5.5 0 0012 3.5z"/><path d="M9.7 19a2.4 2.4 0 004.6 0"/>',
  chevDown: '<path d="M6 9l6 6 6-6"/>',
  wallet: '<path d="M4 7.5A2.5 2.5 0 016.5 5H17a1 1 0 011 1v2"/><rect x="3" y="7.5" width="18" height="12" rx="2.3"/><circle cx="16.3" cy="13.5" r="1.3"/>',
  user: '<circle cx="12" cy="8.2" r="3.6"/><path d="M4.5 20c0-4.1 3.4-7 7.5-7s7.5 2.9 7.5 7"/>',
  logout: '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
};
function ic(name, cls) { return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`; }

/* ========================================================================
   ۳) وضعیت برنامه
   ======================================================================== */
const STATUS_LIST = ['جدید', 'تماس گرفته شده', 'نیاز به پیگیری', 'خرید کرده', 'منصرف شده'];
const STATUS_BADGE = { 'جدید': 'st-new', 'تماس گرفته شده': 'st-called', 'نیاز به پیگیری': 'st-followup', 'خرید کرده': 'st-bought', 'منصرف شده': 'st-lost' };

const state = {
  customers: [], products: [], sales: [], payments: [], conversations: [],
  filters: { customers: { status: '', q: '', due: '', sort: '', created: '', tag: '' } },
};

/* ========================================================================
   ۴) ابزارهای عمومی
   ======================================================================== */
function byId(list, id) { return list.find((x) => x.id === id); }
function fmtId(prefix, id) { return `${prefix}-${faDigits(String(id).padStart(4, '0'))}`; }
function fmtPrice(n) { return `${faDigits(Number(n || 0).toLocaleString('en-US'))} تومان`; }
function fmtProductPrice(p) { return fmtPrice(p.costPrice); }
function slug(s) { return String(s || '').replace(/ /g, '_'); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function moneyDigitsOnly(str) { return faToEnDigits(String(str || '')).replace(/[^\d]/g, ''); }
function formatThousandsStr(digitsStr) { return digitsStr ? Number(digitsStr).toLocaleString('en-US') : ''; }
function wireMoneyInput(input) {
  if (!input) return;
  input.setAttribute('inputmode', 'numeric');
  const applyFormat = () => {
    const caretFromEnd = input.value.length - (input.selectionEnd ?? input.value.length);
    const digits = moneyDigitsOnly(input.value);
    const formatted = formatThousandsStr(digits);
    input.value = formatted;
    const pos = Math.max(0, formatted.length - caretFromEnd);
    if (document.activeElement === input) input.setSelectionRange(pos, pos);
  };
  input.addEventListener('input', applyFormat);
}
function getMoneyValue(input) { return Number(moneyDigitsOnly(input ? input.value : '')) || 0; }
function faToEnDigits(s) {
  const map = { '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
  return String(s).replace(/[۰-۹]/g, (d) => map[d]);
}
function normalizePhoneForMatch(phone) { return faToEnDigits(String(phone || '')).replace(/[^\d]/g, ''); }
function isValidIranPhone(phone) { return /^09\d{9}$/.test(normalizePhoneForMatch(phone)); }

/* ========================================================================
   ۵) توست، مودال، منوی کشویی
   ======================================================================== */
function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}
function openModal(html) {
  closeModal();
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.id = 'modalWrap';
  wrap.innerHTML = `<div class="scrim" data-close-modal></div><div class="modal">${html}</div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', (e) => { if (e.target.hasAttribute('data-close-modal')) closeModal(); });
  return wrap;
}
function closeModal() {
  const el = document.getElementById('modalWrap');
  if (el) el.remove();
  Object.keys(JCalState).forEach((k) => delete JCalState[k]);
}
function openMenu(anchorEl, items) {
  closeMenu();
  const rect = anchorEl.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.className = 'dropdown-menu';
  menu.id = 'dropMenu';
  menu.innerHTML = items.map((it) => (it.sep ? '<hr/>' : `<button data-act="${it.key}" class="${it.danger ? 'danger' : ''}">${ic(it.icon)}<span>${it.label}</span></button>`)).join('');
  document.body.appendChild(menu);
  const top = Math.min(rect.bottom + 6, window.innerHeight - 220);
  const menuW = 178;
  let left = rect.left - menuW + rect.width;
  if (left < 8) left = 8;
  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.id = 'menuScrim';
  scrim.style.background = 'transparent';
  scrim.addEventListener('click', closeMenu);
  document.body.appendChild(scrim);
  items.forEach((it) => {
    if (it.sep) return;
    menu.querySelector(`[data-act="${it.key}"]`).addEventListener('click', () => { closeMenu(); it.onClick(); });
  });
}
function closeMenu() {
  const m = document.getElementById('dropMenu'); if (m) m.remove();
  const s = document.getElementById('menuScrim'); if (s) s.remove();
}
function confirmDialog(title, desc, onYes) {
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">${esc(title)}</h3>
    <p style="font-size:13px;color:var(--ink-soft);line-height:1.8;margin-bottom:6px;">${esc(desc)}</p>
    <div class="modal__actions">
      <button class="btn secondary block" data-close-modal>انصراف</button>
      <button class="btn danger block" id="confirmYesBtn">${ic('trash')}تایید حذف</button>
    </div>`;
  const wrap = openModal(html);
  wrap.querySelector('#confirmYesBtn').addEventListener('click', () => { closeModal(); onYes(); });
}

/* ========================================================================
   ۶) تقویم جلالی برای فرم‌ها
   ======================================================================== */
const JCalState = {};
function parseJalaliText(text) {
  const t = faToEnDigits(text).trim().replace(/[.\\]/g, '/').replace(/-/g, '/').replace(/\s+/g, '/');
  const m = t.match(/^(\d{3,4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const jy = Number(m[1]), jm = Number(m[2]), jd = Number(m[3]);
  if (jm < 1 || jm > 12) return null;
  if (jd < 1 || jd > J.daysInJMonth(jy, jm)) return null;
  return jalaliToISO(jy, jm, jd);
}
function dateFieldHTML(fieldKey, isoValue, label, required) {
  return `
    <div class="field date-field" data-field="${fieldKey}">
      <label>${esc(label)}${required ? ' *' : ''}</label>
      <div class="date-input">
        <input type="text" id="disp-${fieldKey}" placeholder="۱۴۰۴/۰۶/۰۱" inputmode="numeric" value="${esc(formatJalaliDisplay(isoValue))}" data-field="${fieldKey}">
        <button type="button" class="date-input__cal" data-role="date-toggle" data-field="${fieldKey}">${ic('calendar')}</button>
      </div>
      <div class="jcal-slot" id="jcal-${fieldKey}"></div>
    </div>`;
}
function buildJCalHTML(fieldKey, jy, jm, selectedIso) {
  const gStart = J.toGregorian(jy, jm, 1);
  const startDow = (new Date(gStart.gy, gStart.gm - 1, gStart.gd).getDay() + 1) % 7;
  const daysCount = J.daysInJMonth(jy, jm);
  const today = todayISO();
  let cells = '';
  for (let i = 0; i < startDow; i += 1) cells += '<button class="jcal__day" disabled></button>';
  for (let d = 1; d <= daysCount; d += 1) {
    const iso = jalaliToISO(jy, jm, d);
    const cls = ['jcal__day'];
    if (iso === today) cls.push('today');
    if (iso === selectedIso) cls.push('selected');
    cells += `<button type="button" class="${cls.join(' ')}" onclick="pickJCal('${fieldKey}','${iso}')">${faDigits(d)}</button>`;
  }
  const monthOptions = MONTHS_FA.map((mName, idx) => `<option value="${idx + 1}" ${idx + 1 === jm ? 'selected' : ''}>${mName}</option>`).join('');
  return `
    <div class="jcal__head">
      <button type="button" class="jcal__navbtn" onclick="navJCal('${fieldKey}',1)">${ic('chevR')}</button>
      <div class="jcal__headctrls">
        <select class="jcal__monthsel" onchange="jcalMonthChange('${fieldKey}', this.value)">${monthOptions}</select>
        <input type="number" class="jcal__yearinput" value="${jy}" onchange="jcalYearChange('${fieldKey}', this.value)">
      </div>
      <button type="button" class="jcal__navbtn" onclick="navJCal('${fieldKey}',-1)">${ic('chevL')}</button>
    </div>
    <div class="jcal__grid">
      ${DOW_FA.map((d) => `<div class="jcal__dow">${d}</div>`).join('')}
      ${cells}
    </div>
    <div style="display:flex;gap:8px;margin-top:8px;">
      <button type="button" class="btn secondary block" style="padding:8px;font-size:12px;" onclick="pickJCal('${fieldKey}','${today}')">امروز</button>
      <button type="button" class="btn secondary block" style="padding:8px;font-size:12px;" onclick="clearJCal('${fieldKey}')">پاک کردن</button>
    </div>`;
}
window.pickJCal = function (fieldKey, iso) {
  const st = JCalState[fieldKey]; if (!st) return;
  st.formData[fieldKey] = iso;
  const disp = document.getElementById(`disp-${fieldKey}`);
  if (disp) disp.value = formatJalaliDisplay(iso);
  const slot = document.getElementById(`jcal-${fieldKey}`);
  if (slot) { slot.classList.remove('open'); slot.innerHTML = ''; }
  if (st.onChange) st.onChange(fieldKey);
};
window.clearJCal = function (fieldKey) {
  const st = JCalState[fieldKey]; if (!st) return;
  st.formData[fieldKey] = null;
  const disp = document.getElementById(`disp-${fieldKey}`);
  if (disp) disp.value = '';
  const slot = document.getElementById(`jcal-${fieldKey}`);
  if (slot) { slot.classList.remove('open'); slot.innerHTML = ''; }
  if (st.onChange) st.onChange(fieldKey);
};
window.navJCal = function (fieldKey, dir) {
  const st = JCalState[fieldKey]; if (!st) return;
  st.jm += dir;
  if (st.jm < 1) { st.jm = 12; st.jy -= 1; }
  if (st.jm > 12) { st.jm = 1; st.jy += 1; }
  const slot = document.getElementById(`jcal-${fieldKey}`);
  if (slot) slot.innerHTML = buildJCalHTML(fieldKey, st.jy, st.jm, st.formData[fieldKey]);
};
window.jcalMonthChange = function (fieldKey, val) {
  const st = JCalState[fieldKey]; if (!st) return;
  st.jm = Number(val);
  const slot = document.getElementById(`jcal-${fieldKey}`);
  if (slot) slot.innerHTML = buildJCalHTML(fieldKey, st.jy, st.jm, st.formData[fieldKey]);
};
window.jcalYearChange = function (fieldKey, val) {
  const st = JCalState[fieldKey]; if (!st) return;
  const y = Number(val);
  if (!y || y < 1200 || y > 1600) return;
  st.jy = y;
  const slot = document.getElementById(`jcal-${fieldKey}`);
  if (slot) slot.innerHTML = buildJCalHTML(fieldKey, st.jy, st.jm, st.formData[fieldKey]);
};
function initDateFields(container, formData, onChange) {
  container.querySelectorAll('[data-role="date-toggle"]').forEach((elm) => {
    elm.addEventListener('click', () => {
      const fieldKey = elm.dataset.field;
      const slot = document.getElementById(`jcal-${fieldKey}`);
      const isOpen = slot.classList.contains('open');
      container.querySelectorAll('.jcal-slot.open').forEach((s) => { s.classList.remove('open'); s.innerHTML = ''; });
      if (isOpen) return;
      const base = formData[fieldKey] ? isoToJalali(formData[fieldKey]) : isoToJalali(todayISO());
      JCalState[fieldKey] = { jy: base.jy, jm: base.jm, formData, onChange };
      slot.classList.add('open');
      slot.innerHTML = buildJCalHTML(fieldKey, base.jy, base.jm, formData[fieldKey]);
    });
  });
  container.querySelectorAll('.date-field input[type="text"]').forEach((inp) => {
    inp.addEventListener('change', () => {
      const fieldKey = inp.dataset.field;
      const val = inp.value.trim();
      if (!val) { formData[fieldKey] = null; if (onChange) onChange(fieldKey); return; }
      const iso = parseJalaliText(val);
      if (!iso) { toast('تاریخ نامعتبر است — مثال: ۱۴۰۴/۰۶/۰۱'); inp.value = formatJalaliDisplay(formData[fieldKey]); return; }
      formData[fieldKey] = iso;
      inp.value = formatJalaliDisplay(iso);
      const slot = document.getElementById(`jcal-${fieldKey}`);
      if (slot) { slot.classList.remove('open'); slot.innerHTML = ''; }
      if (onChange) onChange(fieldKey);
    });
  });
}

/* ========================================================================
   ۷) مسیریابی
   ======================================================================== */
const NAV_ITEMS = [
  { key: 'dashboard', label: 'داشبرد', icon: 'home' },
  { key: 'customers', label: 'مشتریان', icon: 'users' },
  { key: 'sales', label: 'فروش‌ها', icon: 'cart' },
  { key: 'conversations', label: 'گفتگوها', icon: 'chat' },
  { key: 'products', label: 'محصولات', icon: 'box' },
  { key: 'settings', label: 'تنظیمات', icon: 'gear' },
];
function parseRoute() {
  const h = location.hash.replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  if (parts.length === 0) return { name: 'dashboard' };
  if (parts[0] === 'customer-detail') return { name: 'customer-detail', id: Number(parts[1]), tab: parts[2] || 'sales' };
  return { name: parts[0] };
}
function computeCustomersNavDot() {
  const today = todayISO();
  return state.customers.some((c) => c.nextFollowUp && c.nextFollowUp <= today) ? 'static' : 'none';
}
function renderNav(active) {
  const nav = document.getElementById('bottomNav');
  const custDot = computeCustomersNavDot();
  nav.innerHTML = NAV_ITEMS.map((it) => `
    <button class="nav-item ${active === it.key ? 'active' : ''}" data-nav="${it.key}">
      <span class="nav-item__icon">
        ${ic(it.icon)}
        ${it.key === 'customers' && custDot !== 'none' ? '<span class="nav-dot"></span>' : ''}
      </span>
      <span>${it.label}</span>
    </button>`).join('');
  nav.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.nav === 'products') { window.location.href = '../admin-products.html'; return; }
      location.hash = `#/${btn.dataset.nav}`;
    });
  });
}

async function loadAll() {
  const [customers, products, sales, payments] = await Promise.all([
    sellerApiFetch('/customers'),
    sellerApiFetch('/products'),
    sellerApiFetch('/sales'),
    sellerApiFetch('/payments'),
  ]);
  state.customers = customers;
  state.products = products;
  state.sales = sales;
  state.payments = payments;
}

async function router() {
  closeMenu();
  const route = parseRoute();
  const topActive = route.name === 'customer-detail' ? 'customers' : route.name === 'payments-history' ? 'dashboard' : route.name;
  renderNav(topActive);
  const view = document.getElementById('view');
  view.scrollTop = 0;
  if (route.name === 'dashboard') return renderDashboard(view);
  if (route.name === 'customers') return renderCustomers(view);
  if (route.name === 'customer-detail') return renderCustomerDetail(view, route.id, route.tab);
  if (route.name === 'sales') return renderSales(view);
  if (route.name === 'conversations') return renderConversations(view);
  if (route.name === 'settings') return renderSettings(view);
  if (route.name === 'payments-history') return renderPaymentsHistory(view);
  return renderDashboard(view);
}
window.addEventListener('hashchange', router);

/* ========================================================================
   ۸) داشبرد
   ======================================================================== */
function last7DaysISO() {
  const today = todayISO();
  const out = [];
  for (let i = 6; i >= 0; i -= 1) out.push(isoAddDays(today, -i));
  return out;
}
function weekdayShortFa(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const names = ['ی', 'د', 'س', 'چ', 'پ', 'ج', 'ش'];
  return names[new Date(y, m - 1, d).getDay()];
}
function smoothPathD(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6, cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6, cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}
function salesChartSVG() {
  const days = last7DaysISO();
  const counts = days.map((iso) => state.sales.filter((s) => s.date === iso).length);
  const max = Math.max(1, ...counts);
  const w = 300, h = 110, padT = 20, padB = 20, barGap = 8;
  const barW = (w - barGap * (days.length - 1)) / days.length;
  const chartH = h - padT - padB;
  const points = days.map((iso, i) => ({ x: i * (barW + barGap) + barW / 2, y: padT + (chartH - (counts[i] / max) * chartH) }));
  const lineD = smoothPathD(points);
  const areaD = `${lineD} L ${points[points.length - 1].x.toFixed(1)} ${h - padB} L ${points[0].x.toFixed(1)} ${h - padB} Z`;
  let bars = '';
  days.forEach((iso, i) => {
    const x = i * (barW + barGap);
    const barH = counts[i] === 0 ? 2 : Math.max(4, (counts[i] / max) * (chartH - 6));
    const y = h - padB - barH;
    const isToday = iso === todayISO();
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${isToday ? 'var(--accent)' : 'var(--primary)'}" opacity="${isToday ? 0.9 : 0.45}"/>`;
    bars += `<text x="${x + barW / 2}" y="${h - 4}" text-anchor="middle" font-size="9" fill="var(--ink-faint)">${weekdayShortFa(iso)}</text>`;
  });
  let dots = '';
  points.forEach((p, i) => {
    if (counts[i] > 0) dots += `<text x="${p.x}" y="${p.y - 8}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--ink-soft)">${faDigits(counts[i])}</text>`;
    dots += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--surface)" stroke="var(--accent)" stroke-width="2"/>`;
  });
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:112px;">
    <defs><linearGradient id="areaFade" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.28"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${bars}<path d="${areaD}" fill="url(#areaFade)"/><path d="${lineD}" fill="none" stroke="var(--accent)" stroke-width="2.25" stroke-linecap="round"/>${dots}</svg>`;
}
function featuredProductHTML(top) {
  if (!top) return `<div class="hero-product hero-product--empty">هنوز فروشی برای انتخاب محصول منتخب ثبت نشده است</div>`;
  const p = top.product;
  return `
    <button class="hero-product" data-product="${p.id}" style="border:none;padding:0;cursor:pointer;align-items:center;justify-content:center;">
      <div class="hero-product__body" style="position:static;color:var(--ink);text-align:center;">
        <span class="hero-product__tag" style="background:var(--accent-tint);color:var(--accent);">${ic('star')} پرفروش‌ترین</span>
        <div class="hero-product__name">${esc(p.name)}</div>
        <div class="hero-product__meta" style="color:var(--ink-soft);opacity:1;">${faDigits(top.count)} فروش · ${fmtProductPrice(p)}</div>
      </div>
    </button>`;
}
function todayRemindersHTML() {
  const today = todayISO();
  const custRows = state.customers.filter((c) => c.nextFollowUp === today);
  if (!custRows.length) {
    return `<div class="today-panel"><div class="today-empty">${ic('check')} امروز هیچ پیگیری‌ای ثبت نشده</div></div>`;
  }
  return `<div class="today-panel">${custRows.map((c) => `
    <button class="today-row" data-cust="${c.id}">
      <div class="today-row__icon tp-cust">${ic('users')}</div>
      <div class="today-row__body">
        <div class="today-row__title">${esc(customerFullName(c))}</div>
        <div class="today-row__sub">پیگیری مشتری ${c.phone ? '· ' + esc(c.phone) : ''}</div>
      </div>
      <div class="today-row__chev">${ic('chevL')}</div>
    </button>`).join('')}</div>`;
}
function renderDashboard(view) {
  const today = todayISO();
  const week = weekRangeISO(today);
  const month = monthRangeISO(today);
  const followupCustomersToday = state.customers.filter((c) => c.nextFollowUp === today);
  const followupsWeek = state.customers.filter((c) => c.nextFollowUp && c.nextFollowUp >= week.start && c.nextFollowUp <= week.end).length;
  const newCustomersMonth = state.customers.filter((c) => c.createdAt && c.createdAt.slice(0, 10) >= month.start && c.createdAt.slice(0, 10) <= month.end).length;
  const salesWeekOk = state.sales.filter((s) => s.date >= week.start && s.date <= week.end).length;
  const last7Total = state.sales.filter((s) => last7DaysISO().includes(s.date)).length;

  const salesByProduct = {};
  state.sales.forEach((s) => { if (s.productId) salesByProduct[s.productId] = (salesByProduct[s.productId] || 0) + 1; });
  const topProducts = Object.entries(salesByProduct)
    .sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([pid, count]) => ({ product: byId(state.products, Number(pid)), count }))
    .filter((x) => x.product);

  view.innerHTML = `
    ${paymentsTodayPanelHTML()}
    <div class="section-title">${ic('spark')} نمای کلی</div>
    <div class="dash-grid">
      <div class="dash-card c-amber" data-go="followup-today" role="button" tabindex="0">
        <div class="dash-card__icon">${ic('clock')}${followupCustomersToday.length ? '<span class="dash-card__dot"></span>' : ''}</div>
        <div><div class="dash-card__value">${faDigits(followupCustomersToday.length)}</div><div class="dash-card__label">پیگیری‌های امروز</div></div>
      </div>
      <div class="dash-card c-amber" data-go="followup-week" role="button" tabindex="0">
        <div class="dash-card__icon">${ic('calendar')}</div>
        <div><div class="dash-card__value">${faDigits(followupsWeek)}</div><div class="dash-card__label">پیگیری‌های این هفته</div></div>
      </div>
      <div class="dash-card c-teal" data-go="new-month" role="button" tabindex="0">
        <div class="dash-card__icon">${ic('users')}</div>
        <div><div class="dash-card__value">${faDigits(newCustomersMonth)}</div><div class="dash-card__label">مشتری جدید این ماه</div></div>
      </div>
      <div class="dash-card c-green" data-go="sales-week" role="button" tabindex="0">
        <div class="dash-card__icon">${ic('target')}</div>
        <div><div class="dash-card__value">${faDigits(salesWeekOk)}</div><div class="dash-card__label">فروش این هفته</div></div>
      </div>
    </div>

    <div class="section-title">${ic('clock')} یادآوری‌های امروز<span class="cnt">${faDigits(followupCustomersToday.length)}</span></div>
    ${todayRemindersHTML()}

    <div class="section-title">${ic('spark')} روند فروش ۷ روز اخیر</div>
    <div class="chart-card">
      <div class="chart-card__head"><span class="chart-card__total">${faDigits(last7Total)} فروش در ۷ روز اخیر</span></div>
      ${salesChartSVG()}
    </div>

    <div class="section-title">${ic('star')} محصول منتخب</div>
    ${featuredProductHTML(topProducts[0])}

    ${topProducts.length ? `
    <div class="section-title">${ic('star')} محصولات پرفروش</div>
    <div class="top-products">
      ${topProducts.map((tp, i) => `
        <button class="top-product-row" data-product="${tp.product.id}">
          <span class="top-product-row__rank">${faDigits(i + 1)}</span>
          <span class="top-product-row__name">${esc(tp.product.name)}</span>
          <span class="top-product-row__count">${faDigits(tp.count)} فروش</span>
        </button>`).join('')}
    </div>` : ''}
    <div style="height:6px;"></div>
  `;
  view.querySelectorAll('[data-go]').forEach((card) => card.addEventListener('click', () => goDashboardShortcut(card.dataset.go)));
  view.querySelectorAll('[data-cust]').forEach((row) => row.addEventListener('click', () => { location.hash = `#/customer-detail/${row.dataset.cust}/sales`; }));
  view.querySelectorAll('[data-product]').forEach((row) => { row.style.cursor = 'default'; });
  wirePaymentsTodayPanel(view);
}
function goDashboardShortcut(key) {
  const f = state.filters.customers;
  if (key === 'followup-today') Object.assign(f, { status: '', q: '', due: 'today', sort: 'followup' });
  if (key === 'followup-week') Object.assign(f, { status: '', q: '', due: 'week', sort: 'followup' });
  if (key === 'new-month') Object.assign(f, { status: '', q: '', due: '', sort: '', created: 'month' });
  if (key === 'sales-week') { location.hash = '#/sales'; return; }
  location.hash = '#/customers';
}

/* ========================================================================
   ۹) واریزی‌ها — محور تایید پرداخت (چه از سایت، چه دستی)
   ======================================================================== */
function paymentCustomerName(p) {
  if (p.customer) return `${p.customer.firstName || ''} ${p.customer.lastName || ''}`.trim();
  return '';
}
function paymentRowHTML(p) {
  const isPending = p.status === 'pending';
  const color = isPending ? 'var(--danger)' : (p.status === 'rejected' ? 'var(--ink-faint)' : 'var(--success)');
  const name = paymentCustomerName(p);
  const itemsLine = p.order ? p.order.items.map((it) => `${it.product.name} × ${faDigits(it.quantity)}`).join('، ') : '';
  const tracking = p.order && p.order.transaction ? p.order.transaction.refId : null;
  return `
    <div class="rec-card" style="border-right-color:${color};" data-id="${p.id}">
      <div class="rec-card__body">
        <div class="rec-card__top">
          <span class="rec-card__title">${name ? esc(name) : fmtId('P', p.id)}</span>
          <span class="badge ${isPending ? 'pay-pending' : 'pay-completed'}">${isPending ? 'در انتظار' : (p.status === 'rejected' ? 'رد شده' : 'تایید شده')}</span>
        </div>
        <div class="rec-card__id">${formatJalaliDisplay(p.date)} · ${fmtId('P', p.id)}${p.order ? ' · از سایت' : ' · دستی'}</div>
        <div class="rec-card__meta">
          <span>${ic('wallet')}${fmtPrice(p.amount)}</span>
          ${tracking ? `<span>${ic('check')}پیگیری: ${esc(tracking)}</span>` : ''}
        </div>
        ${itemsLine ? `<div class="rec-card__desc">${esc(itemsLine)}</div>` : ''}
        ${p.order && p.order.shippingAddress ? `<div class="rec-card__desc">${ic('pin')} ${esc(p.order.shippingAddress)}</div>` : ''}
        ${isPending ? `
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button type="button" class="btn primary" data-confirm="${p.id}" style="padding:9px 14px;font-size:12.5px;">${ic('check')}تایید</button>
          <button type="button" class="btn danger" data-reject="${p.id}" style="padding:9px 14px;font-size:12.5px;">${ic('x')}رد</button>
        </div>` : ''}
      </div>
    </div>`;
}
async function confirmPayment(id) {
  try {
    await sellerApiFetch(`/payments/${id}/confirm`, { method: 'POST' });
    await loadAll();
    toast('واریزی تایید شد');
    router();
  } catch (err) { toast(err.message); }
}
async function rejectPayment(id) {
  confirmDialog('رد واریزی', 'این واریزی رد می‌شود و سفارش مرتبط (اگر باشد) لغو خواهد شد.', async () => {
    try {
      await sellerApiFetch(`/payments/${id}/reject`, { method: 'POST' });
      await loadAll();
      toast('واریزی رد شد');
      router();
    } catch (err) { toast(err.message); }
  });
}
function wirePaymentRows(container) {
  container.querySelectorAll('[data-confirm]').forEach((btn) => btn.addEventListener('click', () => confirmPayment(Number(btn.dataset.confirm))));
  container.querySelectorAll('[data-reject]').forEach((btn) => btn.addEventListener('click', () => rejectPayment(Number(btn.dataset.reject))));
}
function paymentsTodayPanelHTML() {
  const list = state.payments.filter((p) => p.status === 'pending');
  const hint = list.length ? `${faDigits(list.length)} واریزی نیاز به بررسی دارد` : 'همه‌ی واریزی‌ها بررسی شده‌اند';
  return `
    <div class="section-title">${ic('wallet')} واریزی‌ها<span class="cnt">${faDigits(list.length)}</span></div>
    <div class="payments-today-panel" style="height:auto;min-height:auto;">
      <div class="payments-today-panel__head">
        <div class="payments-today-panel__hint">${esc(hint)}</div>
        <div class="payments-today-panel__actions">
          <button type="button" class="btn secondary" id="paymentsHistoryBtn" style="padding:8px 12px;font-size:12px;">${ic('clock')}تاریخچه</button>
          <button type="button" class="btn primary" id="paymentAddBtn" style="padding:8px 12px;font-size:12px;">${ic('plus')}واریزی دستی</button>
        </div>
      </div>
      <div class="payments-today-list${list.length ? '' : ' is-empty'}" style="max-height:420px;">
        ${list.length ? list.map((p) => paymentRowHTML(p)).join('') : `<div class="empty-state" style="padding:22px;">${ic('wallet')}<div class="empty-state__desc">واریزی در انتظاری نیست</div></div>`}
      </div>
    </div>`;
}
function wirePaymentsTodayPanel(view) {
  const addBtn = document.getElementById('paymentAddBtn');
  if (addBtn) addBtn.addEventListener('click', () => openPaymentAddForm());
  const histBtn = document.getElementById('paymentsHistoryBtn');
  if (histBtn) histBtn.addEventListener('click', () => { location.hash = '#/payments-history'; });
  const listEl = view.querySelector('.payments-today-list');
  if (listEl) wirePaymentRows(listEl);
}
function renderPaymentsHistory(view) {
  const list = state.payments.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  view.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="backBtn">${ic('chevR')}</button>
      <h3 style="font-size:15.5px;">تاریخچه‌ی واریزی‌ها</h3>
    </div>
    <div class="list">${list.length ? list.map((p) => paymentRowHTML(p)).join('') : `<div class="empty-state">${ic('wallet')}<div class="empty-state__desc">هنوز واریزی‌ای ثبت نشده</div></div>`}</div>`;
  document.getElementById('backBtn').addEventListener('click', () => { location.hash = '#/dashboard'; });
  wirePaymentRows(view.querySelector('.list'));
}

/* --- افزودن واریزی دستی (فروش حضوری/تلفنی) --- */
function openPaymentAddForm() {
  const formData = { date: todayISO(), customerId: null };
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">افزودن واریزی دستی</h3>
    <form id="paymentAddForm">
      <div class="field">
        <label>مشتری (اختیاری)</label>
        <div class="combo">
          <input type="text" id="custComboInput" placeholder="جستجوی نام یا شماره تماس" autocomplete="off">
          <div class="combo-list" id="custComboList"></div>
        </div>
        <div id="custSelectedBox"></div>
      </div>
      <div class="field"><label>مبلغ (تومان) *</label><input name="amount" type="text" required placeholder="مثلاً ۱,۰۰۰,۰۰۰"></div>
      ${dateFieldHTML('date', formData.date, 'تاریخ واریزی', true)}
      <div class="field"><label>روش</label>
        <select name="method"><option value="manual">کارت‌به‌کارت</option><option value="cash">نقدی</option></select>
      </div>
      <div class="modal__actions">
        <button type="button" class="btn secondary block" data-close-modal>انصراف</button>
        <button type="submit" class="btn primary block">${ic('check')}ثبت واریزی</button>
      </div>
    </form>`;
  const wrap = openModal(html);
  initDateFields(wrap, formData);
  const amountInput = wrap.querySelector('#paymentAddForm input[name="amount"]');
  wireMoneyInput(amountInput);

  const comboInput = wrap.querySelector('#custComboInput');
  const comboList = wrap.querySelector('#custComboList');
  const selectedBox = wrap.querySelector('#custSelectedBox');
  function renderSelected() {
    const c = formData.customerId ? byId(state.customers, formData.customerId) : null;
    selectedBox.innerHTML = c ? `<div class="combo-selected">${ic('user')}${esc(customerFullName(c))}<button type="button" id="custClearBtn">${ic('x')}</button></div>` : '';
    comboInput.parentElement.style.display = c ? 'none' : '';
    if (c) selectedBox.querySelector('#custClearBtn').addEventListener('click', () => { formData.customerId = null; renderSelected(); });
  }
  renderSelected();
  comboInput.addEventListener('input', () => {
    const q = comboInput.value.trim();
    if (!q) { comboList.classList.remove('open'); comboList.innerHTML = ''; return; }
    const matches = state.customers.filter((c) => customerFullName(c).includes(q) || (c.phone || '').includes(q)).slice(0, 8);
    comboList.innerHTML = matches.length
      ? matches.map((c) => `<div class="combo-item" data-id="${c.id}"><span class="combo-item__name">${esc(customerFullName(c))}</span><span class="combo-item__sub">${esc(c.phone || '')}</span></div>`).join('')
      : `<div class="combo-empty">مشتری‌ای پیدا نشد</div>`;
    comboList.classList.add('open');
    comboList.querySelectorAll('[data-id]').forEach((item) => {
      item.addEventListener('click', () => {
        formData.customerId = Number(item.dataset.id);
        comboInput.value = '';
        comboList.classList.remove('open');
        renderSelected();
      });
    });
  });

  wrap.querySelector('#paymentAddForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = getMoneyValue(amountInput);
    if (!amount || amount <= 0) { toast('مبلغ معتبر وارد کنید'); return; }
    if (!formData.date) { toast('تاریخ را وارد کنید'); return; }
    const method = wrap.querySelector('select[name="method"]').value;
    try {
      await sellerApiFetch('/payments', {
        method: 'POST',
        body: JSON.stringify({ customerId: formData.customerId || undefined, amount, date: formData.date, method }),
      });
      await loadAll();
      closeModal();
      toast('واریزی ثبت شد');
      router();
    } catch (err) { toast(err.message); }
  });
}

/* ========================================================================
   ۱۰) مشتریان
   ======================================================================== */
function customerFullName(c) { return `${c.firstName || ''} ${c.lastName || ''}`.trim(); }
function customerLastPurchaseDate(customerId) {
  const sales = state.sales.filter((s) => s.customerId === customerId);
  if (!sales.length) return null;
  return sales.reduce((max, s) => (s.date > max ? s.date : max), sales[0].date);
}
function computeFollowUpDue(c) { return c.nextFollowUp && c.nextFollowUp <= todayISO(); }
function computeCustomerList() {
  const f = state.filters.customers;
  let list = state.customers.slice();
  if (f.status) list = list.filter((c) => c.status === f.status);
  if (f.due === 'today') { const t = todayISO(); list = list.filter((c) => c.nextFollowUp === t); }
  if (f.due === 'week') { const w = weekRangeISO(todayISO()); list = list.filter((c) => c.nextFollowUp && c.nextFollowUp >= w.start && c.nextFollowUp <= w.end); }
  if (f.created === 'month') { const m = monthRangeISO(todayISO()); list = list.filter((c) => c.createdAt && c.createdAt.slice(0, 10) >= m.start && c.createdAt.slice(0, 10) <= m.end); }
  if (f.tag) list = list.filter((c) => Array.isArray(c.tags) && c.tags.includes(f.tag));
  if (f.q && f.q.trim()) {
    const q = f.q.trim();
    list = list.filter((c) => customerFullName(c).includes(q) || (c.phone || '').includes(q));
  }
  if (f.sort === 'followup') {
    list.sort((a, b) => {
      if (!a.nextFollowUp && !b.nextFollowUp) return 0;
      if (!a.nextFollowUp) return 1;
      if (!b.nextFollowUp) return -1;
      return a.nextFollowUp.localeCompare(b.nextFollowUp);
    });
  } else if (f.sort === 'name') {
    list.sort((a, b) => customerFullName(a).localeCompare(customerFullName(b), 'fa'));
  } else {
    list.sort((a, b) => b.id - a.id);
  }
  return list;
}
function renderCustomers(view) {
  const f = state.filters.customers;
  const activeFilterCount = (f.status ? 1 : 0) + (f.due ? 1 : 0) + (f.sort ? 1 : 0) + (f.created ? 1 : 0) + (f.tag ? 1 : 0);
  view.innerHTML = `
    <div class="toolbar">
      <div class="search-box">${ic('search')}<input id="custSearch" placeholder="جستجوی نام یا شماره تماس" value="${esc(f.q)}"></div>
      <button class="tbtn tbtn-filter" id="custFilterBtn">${ic('filter')}<span>فیلتر</span>${activeFilterCount ? '<span class="tbtn__dot"></span>' : ''}</button>
      <button class="tbtn tbtn-add" id="custAddBtn">${ic('plus')}<span>افزودن</span></button>
    </div>
    ${f.created === 'month' ? `<div class="quick-banner"><span>${ic('filter')}مشتری‌های جدید این ماه</span><button id="clearCreatedBtn">${ic('x')}پاک کردن</button></div>` : ''}
    <div class="list" id="custList"></div>
  `;
  renderCustomerList(computeCustomerList());
  document.getElementById('custSearch').addEventListener('input', (e) => { f.q = e.target.value; renderCustomerList(computeCustomerList()); });
  document.getElementById('custAddBtn').addEventListener('click', () => openCustomerForm());
  document.getElementById('custFilterBtn').addEventListener('click', () => openCustomerFilterSheet(view));
  const clearBtn = document.getElementById('clearCreatedBtn');
  if (clearBtn) clearBtn.addEventListener('click', () => { f.created = ''; renderCustomers(view); });
}
function renderCustomerList(list) {
  const el = document.getElementById('custList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `<div class="empty-state">${ic('users')}<div class="empty-state__title">مشتری‌ای یافت نشد</div><div class="empty-state__desc">با دکمه + یک مشتری جدید اضافه کنید</div></div>`;
    return;
  }
  el.innerHTML = list.map((c) => {
    const due = computeFollowUpDue(c);
    const lastPurchase = customerLastPurchaseDate(c.id);
    return `
    <div class="rec-card status-${slug(c.status)} ${due ? 'due-today' : ''}" data-id="${c.id}">
      <div class="rec-card__body">
        <div class="rec-card__top">
          <span class="rec-card__title">${esc(customerFullName(c)) || 'بدون‌نام'}</span>
          <span class="badge ${STATUS_BADGE[c.status] || 'st-new'}">${esc(c.status || 'جدید')}</span>
          ${due ? `<span class="due-glow">${ic('bell')}پیگیری</span>` : ''}
        </div>
        <div class="rec-card__id">${fmtId('C', c.id)}</div>
        <div class="rec-card__meta">
          ${c.phone ? `<a class="tel-link" href="tel:${esc(c.phone)}" onclick="event.stopPropagation()">${ic('phone')}${esc(c.phone)}</a>` : ''}
          ${lastPurchase ? `<span>${ic('cart')}آخرین خرید: ${formatJalaliDisplay(lastPurchase)}</span>` : ''}
          ${c.nextFollowUp ? `<span>${ic('calendar')}پیگیری: ${formatJalaliDisplay(c.nextFollowUp)}</span>` : ''}
        </div>
        ${c.address ? `<div class="rec-card__desc">${ic('pin')} ${esc(c.address)}</div>` : ''}
        ${Array.isArray(c.tags) && c.tags.length ? `<div class="tag-chip-list">${c.tags.map((t) => `<span class="tag-chip-display">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
      <button class="menu-btn" data-menu="${c.id}">${ic('dots')}</button>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-id]').forEach((row) => {
    row.addEventListener('click', (e) => { if (!e.target.closest('.menu-btn, .tel-link')) location.hash = `#/customer-detail/${row.dataset.id}/sales`; });
  });
  el.querySelectorAll('[data-menu]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = Number(btn.dataset.menu);
      openMenu(btn, [
        { key: 'edit', label: 'ویرایش', icon: 'edit', onClick: () => openCustomerForm(id) },
        { key: 'sales', label: 'خریدها و واریزی‌ها', icon: 'cart', onClick: () => { location.hash = `#/customer-detail/${id}/sales`; } },
        { sep: true },
        { key: 'del', label: 'حذف مشتری', icon: 'trash', danger: true, onClick: () => deleteCustomer(id) },
      ]);
    });
  });
}
function openCustomerFilterSheet(view) {
  const f = state.filters.customers;
  const dueOpts = [['', 'همه'], ['today', 'پیگیری امروز'], ['week', 'پیگیری این هفته']];
  const sortOpts = [['', 'جدیدترین'], ['followup', 'نزدیک‌ترین پیگیری'], ['name', 'الفبا']];
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">فیلتر و مرتب‌سازی مشتریان</h3>
    <div class="field"><label>وضعیت</label></div>
    <div class="filter-chips" id="statusChips">
      <button class="chip ${!f.status ? 'active' : ''}" data-v="">همه</button>
      ${STATUS_LIST.map((s) => `<button class="chip ${f.status === s ? 'active' : ''}" data-v="${esc(s)}">${esc(s)}</button>`).join('')}
    </div>
    <div class="field" style="margin-top:14px;"><label>زمان پیگیری</label></div>
    <div class="filter-chips" id="dueChips">${dueOpts.map(([v, l]) => `<button class="chip ${f.due === v ? 'active' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="field" style="margin-top:14px;"><label>مرتب‌سازی</label></div>
    <div class="filter-chips" id="sortChips2">${sortOpts.map(([v, l]) => `<button class="chip ${f.sort === v ? 'active' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="modal__actions"><button class="btn primary block" data-close-modal>اعمال</button></div>`;
  const wrap = openModal(html);
  wrap.querySelectorAll('#statusChips .chip').forEach((chip) => chip.addEventListener('click', () => { f.status = chip.dataset.v; renderCustomers(view); openCustomerFilterSheet(view); }));
  wrap.querySelectorAll('#dueChips .chip').forEach((chip) => chip.addEventListener('click', () => { f.due = chip.dataset.v; renderCustomers(view); openCustomerFilterSheet(view); }));
  wrap.querySelectorAll('#sortChips2 .chip').forEach((chip) => chip.addEventListener('click', () => { f.sort = chip.dataset.v; renderCustomers(view); openCustomerFilterSheet(view); }));
}
function openCustomerForm(id) {
  const rec = id ? byId(state.customers, id) : null;
  const formData = rec ? { ...rec } : { firstName: '', lastName: '', phone: '', address: '', nextFollowUp: null, status: 'جدید', tags: [] };
  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">${rec ? 'ویرایش مشتری' : 'مشتری جدید'}</h3>
    <form id="custForm">
      <div class="field-row">
        <div class="field"><label>نام *</label><input name="firstName" required value="${esc(formData.firstName)}"></div>
        <div class="field"><label>نام خانوادگی *</label><input name="lastName" required value="${esc(formData.lastName)}"></div>
      </div>
      <div class="field"><label>شماره تماس *</label><input name="phone" inputmode="tel" required value="${esc(formData.phone)}"></div>
      <div class="field"><label>آدرس</label><textarea name="address">${esc(formData.address || '')}</textarea></div>
      ${dateFieldHTML('nextFollowUp', formData.nextFollowUp, 'پیگیری بعدی')}
      <div class="field"><label>وضعیت</label>
        <select name="status">${STATUS_LIST.map((s) => `<option value="${esc(s)}" ${formData.status === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>برچسب‌ها</label>
        <div class="tag-input" id="tagInputWrap">
          <div class="tag-input__chips" id="tagChips"></div>
          <input type="text" id="tagTextInput" placeholder="برچسب را بنویسید و Enter بزنید">
        </div>
      </div>
      <div class="modal__actions">
        <button type="button" class="btn secondary block" data-close-modal>انصراف</button>
        <button type="submit" class="btn primary block">${ic('check')}ذخیره</button>
      </div>
    </form>`;
  const wrap = openModal(html);
  const form = wrap.querySelector('#custForm');
  initDateFields(wrap, formData);
  const tags = Array.isArray(formData.tags) ? [...formData.tags] : [];
  function renderTagChips() {
    const chipsEl = wrap.querySelector('#tagChips');
    chipsEl.innerHTML = tags.map((t, i) => `<span class="tag-chip">${esc(t)}<button type="button" data-rm-tag="${i}">${ic('x')}</button></span>`).join('');
    chipsEl.querySelectorAll('[data-rm-tag]').forEach((btn) => btn.addEventListener('click', () => { tags.splice(Number(btn.dataset.rmTag), 1); renderTagChips(); }));
  }
  renderTagChips();
  const tagTextInput = wrap.querySelector('#tagTextInput');
  tagTextInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = tagTextInput.value.trim().replace(/,$/, '');
      if (val && !tags.includes(val)) { tags.push(val); renderTagChips(); }
      tagTextInput.value = '';
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const phoneRaw = fd.get('phone').trim();
    if (!isValidIranPhone(phoneRaw)) { toast('شماره تماس معتبر نیست — باید با ۰۹ شروع شود و ۱۱ رقم باشد'); return; }
    const leftoverTag = tagTextInput.value.trim();
    if (leftoverTag && !tags.includes(leftoverTag)) tags.push(leftoverTag);
    const payload = {
      firstName: fd.get('firstName').trim(), lastName: fd.get('lastName').trim(),
      phone: phoneRaw, address: fd.get('address').trim(),
      status: fd.get('status'), nextFollowUp: formData.nextFollowUp || null, tags,
    };
    try {
      if (rec) await sellerApiFetch(`/customers/${rec.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await sellerApiFetch('/customers', { method: 'POST', body: JSON.stringify(payload) });
      await loadAll();
      closeModal();
      toast(rec ? 'مشتری ویرایش شد' : 'مشتری اضافه شد');
      router();
    } catch (err) { toast(err.message); }
  });
}
function deleteCustomer(id) {
  const c = byId(state.customers, id);
  confirmDialog('حذف مشتری', `«${customerFullName(c)}» حذف خواهد شد. این کار قابل بازگشت نیست.`, async () => {
    try {
      await sellerApiFetch(`/customers/${id}`, { method: 'DELETE' });
      await loadAll();
      toast('مشتری حذف شد');
      location.hash = '#/customers';
      router();
    } catch (err) { toast(err.message); }
  });
}
function saleRowHTML(s, opts) {
  opts = opts || {};
  return `
    <div class="rec-card" style="border-right-color:var(--success);">
      <div class="rec-card__body">
        <div class="rec-card__top">
          <span class="rec-card__title">${s.product ? esc(s.product.name) : 'فروش'}</span>
        </div>
        <div class="rec-card__id">${formatJalaliDisplay(s.date)} · ${fmtId('S', s.id)}</div>
        <div class="rec-card__meta">
          <span>${ic('wallet')}${fmtPrice(s.price)}</span>
          <span>${esc(s.saleType)}</span>
          ${!opts.hideCustomer && s.customer ? `<span>${ic('user')}${esc(`${s.customer.firstName} ${s.customer.lastName}`.trim())}</span>` : ''}
        </div>
      </div>
    </div>`;
}
function paymentMiniRowHTML(p) {
  const color = p.status === 'pending' ? 'var(--danger)' : (p.status === 'rejected' ? 'var(--ink-faint)' : 'var(--success)');
  return `
    <div class="rec-card" style="border-right-color:${color};">
      <div class="rec-card__body">
        <div class="rec-card__top">
          <span class="rec-card__title">${fmtPrice(p.amount)}</span>
          <span class="badge ${p.status === 'pending' ? 'pay-pending' : 'pay-completed'}">${p.status === 'pending' ? 'در انتظار' : (p.status === 'rejected' ? 'رد شده' : 'تایید شده')}</span>
        </div>
        <div class="rec-card__id">${formatJalaliDisplay(p.date)} · ${fmtId('P', p.id)}</div>
      </div>
    </div>`;
}
function renderCustomerDetail(view, id, tab) {
  const c = byId(state.customers, id);
  if (!c) { location.hash = '#/customers'; return; }
  const sales = state.sales.filter((x) => x.customerId === id);
  const payments = state.payments.filter((x) => x.customerId === id);
  view.innerHTML = `
    <div class="detail-header">
      <button class="back-btn" id="backBtn">${ic('chevR')}</button>
      <div>
        <h3 style="font-size:15.5px;">${esc(customerFullName(c))}</h3>
        <div style="font-size:11.5px;color:var(--ink-soft);">${fmtId('C', c.id)} · ${esc(c.phone || 'بدون شماره')}</div>
      </div>
    </div>
    <div class="tabs">
      <button data-tab="sales" class="${tab === 'sales' ? 'active' : ''}">خریدها (${faDigits(sales.length)})</button>
      <button data-tab="payments" class="${tab === 'payments' ? 'active' : ''}">واریزی‌ها (${faDigits(payments.length)})</button>
      <button data-tab="conversations" class="${tab === 'conversations' ? 'active' : ''}">گفتگوها</button>
    </div>
    <div id="detailList" class="list"></div>
  `;
  document.getElementById('backBtn').addEventListener('click', () => { location.hash = '#/customers'; });
  view.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { location.hash = `#/customer-detail/${id}/${b.dataset.tab}`; }));
  const listEl = document.getElementById('detailList');
  if (tab === 'payments') {
    listEl.innerHTML = payments.length ? payments.map(paymentMiniRowHTML).join('') : `<div class="empty-state">${ic('wallet')}<div class="empty-state__desc">واریزی‌ای ثبت نشده</div></div>`;
  } else if (tab === 'conversations') {
    listEl.innerHTML = `<div class="empty-state">${ic('chat')}<div class="empty-state__title">به‌زودی</div><div class="empty-state__desc">ثبت گفتگو و پیگیری در فاز بعدی اضافه می‌شود</div></div>`;
  } else {
    listEl.innerHTML = sales.length ? sales.map((s) => saleRowHTML(s, { hideCustomer: true })).join('') : `<div class="empty-state">${ic('cart')}<div class="empty-state__desc">هنوز خریدی ثبت نشده</div></div>`;
  }
  const editBtn = document.createElement('button');
  editBtn.className = 'fab';
  editBtn.innerHTML = ic('edit');
  editBtn.addEventListener('click', () => openCustomerForm(id));
  view.appendChild(editBtn);
}

/* ========================================================================
   ۱۱) فروش‌ها (فهرست کامل)
   ======================================================================== */
function renderSales(view) {
  const list = state.sales.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  view.innerHTML = `
    <div class="section-title">${ic('cart')} همه‌ی فروش‌ها<span class="cnt">${faDigits(list.length)}</span></div>
    <div class="list">${list.length ? list.map((s) => saleRowHTML(s)).join('') : `<div class="empty-state">${ic('cart')}<div class="empty-state__title">هنوز فروشی ثبت نشده</div><div class="empty-state__desc">فروش‌ها بعد از تایید واریزی این‌جا نشان داده می‌شوند</div></div>`}</div>`;
}

/* ========================================================================
   ۱۲) گفتگوها (فاز بعدی)
   ======================================================================== */
function renderConversations(view) {
  view.innerHTML = `<div class="empty-state" style="padding-top:80px;">${ic('chat')}<div class="empty-state__title">به‌زودی</div><div class="empty-state__desc">این بخش در فاز بعدی اضافه می‌شود — از جمله اتصال به پنل پیامکی</div></div>`;
}

/* ========================================================================
   ۱۳) تنظیمات
   ======================================================================== */
function renderSettings(view) {
  const session = getSellerSession();
  const seller = session ? session.seller : {};
  view.innerHTML = `
    <div class="settings-group">
      <div class="settings-group__title">حساب کاربری</div>
      <div class="settings-row">
        <div class="settings-row__icon">${ic('user')}</div>
        <div class="settings-row__text">
          <div class="settings-row__title">${esc(seller.name || '')}</div>
          <div class="settings-row__desc">${esc(seller.brandName || '')}</div>
        </div>
      </div>
    </div>
    <div class="settings-group">
      <div class="settings-group__title">مدیریت فروشگاه</div>
      <a href="../admin-products.html" class="settings-row" style="text-decoration:none;color:inherit;">
        <div class="settings-row__icon">${ic('box')}</div>
        <div class="settings-row__text"><div class="settings-row__title">مدیریت محصولات</div></div>
        <div class="settings-row__chev">${ic('chevL')}</div>
      </a>
      <a href="../index.html" class="settings-row" style="text-decoration:none;color:inherit;">
        <div class="settings-row__icon">${ic('cart')}</div>
        <div class="settings-row__text"><div class="settings-row__title">مشاهده‌ی سایت فروشگاهی</div></div>
        <div class="settings-row__chev">${ic('chevL')}</div>
      </a>
    </div>
    <div class="settings-group">
      <button type="button" class="settings-row" id="logoutBtn" style="width:100%;border:none;background:none;cursor:pointer;">
        <div class="settings-row__icon" style="background:var(--danger-tint);color:var(--danger);">${ic('logout')}</div>
        <div class="settings-row__text"><div class="settings-row__title" style="color:var(--danger);">خروج از پنل</div></div>
      </button>
    </div>
  `;
  document.getElementById('logoutBtn').addEventListener('click', () => {
    logoutSeller();
    window.location.href = '../admin-login.html';
  });
}

/* ========================================================================
   ۱۴) بوت
   ======================================================================== */
async function boot() {
  const dateEl = document.getElementById('topbarDate');
  const j = isoToJalali(todayISO());
  dateEl.textContent = `${faDigits(j.jd)} ${MONTHS_FA[j.jm - 1]}`;
  try {
    await loadAll();
  } catch (err) {
    document.getElementById('view').innerHTML = `<div class="empty-state">${ic('wipe')}<div class="empty-state__title">خطا در بارگذاری اطلاعات</div><div class="empty-state__desc">${esc(err.message)}</div></div>`;
    renderNav('dashboard');
    return;
  }
  router();
}
boot();
