/* Customer profile address + consistent negative status colors. */
(function () {
  'use strict';

  const NEGATIVE_TEXT_RE = /(?:^|\s)(?:رد(?:\s*شده|\s*سفارش)?|لغو(?:\s*شده)?|ناموفق|منصرف(?:\s*شده)?|غیرفعال)(?:\s|$|:|،|\.)/;
  const TARGET_SELECTOR = '.badge, .status-badge, .chip, .btn, button, .sms-consent-badge, .customer-segment';

  const style = document.createElement('style');
  style.textContent = `
    .customer-profile-address-card {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin: 0 0 12px;
      padding: 11px 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--surface);
      box-shadow: var(--shadow-1);
    }
    .customer-profile-address-card__icon {
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      background: var(--primary-tint);
      color: var(--primary);
    }
    .customer-profile-address-card__icon svg { width: 17px; height: 17px; }
    .customer-profile-address-card__body { min-width: 0; flex: 1; }
    .customer-profile-address-card__label {
      font-size: 11px;
      font-weight: 800;
      color: var(--ink-soft);
      margin-bottom: 3px;
    }
    .customer-profile-address-card__value {
      font-size: 12.5px;
      font-weight: 650;
      color: var(--ink);
      line-height: 1.9;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .customer-profile-address-card__value.is-empty { color: var(--ink-faint); font-weight: 600; }
    .customer-profile-address-card__source {
      margin-top: 3px;
      font-size: 10.5px;
      color: var(--ink-faint);
    }
    .customer-profile-address-card__edit {
      flex: 0 0 auto;
      border: 0;
      background: transparent;
      color: var(--primary);
      padding: 4px 2px;
      font: inherit;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
    }

    .ui-negative-status:not(.btn):not(button) {
      background: var(--danger-tint) !important;
      color: var(--danger) !important;
      border-color: color-mix(in srgb, var(--danger) 35%, transparent) !important;
    }
    button.ui-negative-status,
    .btn.ui-negative-status {
      background: var(--danger) !important;
      color: #fff !important;
      border-color: var(--danger) !important;
      box-shadow: none !important;
    }
    button.ui-negative-status svg,
    .btn.ui-negative-status svg { stroke: currentColor !important; }

    @media (max-width: 520px) {
      .customer-profile-address-card { padding: 10px; gap: 8px; }
      .customer-profile-address-card__icon { width: 31px; height: 31px; flex-basis: 31px; }
      .customer-profile-address-card__edit { font-size: 10.5px; }
    }
  `;
  document.head.appendChild(style);

  function normalizedText(element) {
    return String(element && element.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function isNegativeText(text) {
    if (!text) return false;
    return NEGATIVE_TEXT_RE.test(` ${text} `);
  }

  function decorateNegativeStatuses(root) {
    if (!root || !root.querySelectorAll) return;
    const nodes = [];
    if (root.matches && root.matches(TARGET_SELECTOR)) nodes.push(root);
    root.querySelectorAll(TARGET_SELECTOR).forEach((node) => nodes.push(node));
    nodes.forEach((node) => {
      node.classList.toggle('ui-negative-status', isNegativeText(normalizedText(node)));
    });
  }

  function customerById(id) {
    if (typeof state === 'undefined' || !Array.isArray(state.customers)) return null;
    return state.customers.find((customer) => Number(customer.id) === Number(id)) || null;
  }

  function latestOrderWithAddress(customerId) {
    if (typeof state === 'undefined' || !Array.isArray(state.orders)) return null;
    return state.orders
      .filter((order) => Number(order.customerId) === Number(customerId) && String(order.shippingAddress || '').trim())
      .slice()
      .sort((a, b) => {
        const dateCompare = String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || ''));
        return dateCompare || Number(b.id || 0) - Number(a.id || 0);
      })[0] || null;
  }

  function currentCustomerId() {
    const match = String(location.hash || '').match(/^#\/customer-detail\/(\d+)(?:\/|$)/);
    return match ? Number(match[1]) : null;
  }

  function addressData(customer) {
    const saved = String(customer && customer.address || '').trim();
    if (saved) return { value: saved, source: 'آدرس ثبت‌شده در پروفایل' };
    const order = customer ? latestOrderWithAddress(customer.id) : null;
    const shippingAddress = String(order && order.shippingAddress || '').trim();
    if (shippingAddress) return { value: shippingAddress, source: 'آخرین آدرس ارسال سفارش' };
    return { value: '', source: '' };
  }

  function enhanceCustomerAddress() {
    const id = currentCustomerId();
    const view = document.getElementById('view');
    if (!id || !view) return;
    const customer = customerById(id);
    if (!customer) return;

    const master = view.querySelector('.customer-master-card');
    const header = view.querySelector('.detail-header');
    const anchor = master || header;
    if (!anchor) return;

    if (master) {
      const oldAddress = master.querySelector('.customer-connected-card__address');
      if (oldAddress) oldAddress.style.display = 'none';
    }

    const data = addressData(customer);
    let card = view.querySelector('[data-customer-address-card]');
    if (!card) {
      card = document.createElement('div');
      card.className = 'customer-profile-address-card';
      card.setAttribute('data-customer-address-card', String(id));
      anchor.insertAdjacentElement('afterend', card);
    }

    card.innerHTML = `
      <div class="customer-profile-address-card__icon">${typeof ic === 'function' ? ic('pin') : '📍'}</div>
      <div class="customer-profile-address-card__body">
        <div class="customer-profile-address-card__label">آدرس مشتری</div>
        <div class="customer-profile-address-card__value ${data.value ? '' : 'is-empty'}">${data.value ? (typeof esc === 'function' ? esc(data.value) : data.value) : 'ثبت نشده'}</div>
        ${data.source ? `<div class="customer-profile-address-card__source">${data.source}</div>` : ''}
      </div>
      <button type="button" class="customer-profile-address-card__edit" data-edit-customer-address="${id}">${data.value ? 'ویرایش' : 'افزودن آدرس'}</button>`;

    const editButton = card.querySelector('[data-edit-customer-address]');
    if (editButton && typeof openCustomerForm === 'function') {
      editButton.addEventListener('click', () => openCustomerForm(id));
    }
  }

  let scheduled = false;
  function refreshEnhancements() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      decorateNegativeStatuses(document.getElementById('view') || document.body);
      enhanceCustomerAddress();
    });
  }

  const observer = new MutationObserver((mutations) => {
    let shouldRefresh = false;
    mutations.forEach((mutation) => {
      if (mutation.addedNodes && mutation.addedNodes.length) shouldRefresh = true;
    });
    if (shouldRefresh) refreshEnhancements();
  });

  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', refreshEnhancements);
  window.addEventListener('load', refreshEnhancements);
  refreshEnhancements();
})();
