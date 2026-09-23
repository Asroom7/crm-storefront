/* Show a consistent address row on every customer card in the main Customers list. */
(function () {
  'use strict';

  const style = document.createElement('style');
  style.textContent = `
    .customer-list-address-row {
      display: flex;
      align-items: flex-start;
      gap: 5px;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px dashed color-mix(in srgb, var(--border) 75%, transparent);
      font-size: 11.5px;
      line-height: 1.75;
      color: var(--ink-soft);
      min-width: 0;
    }
    .customer-list-address-row svg {
      width: 14px;
      height: 14px;
      flex: 0 0 14px;
      margin-top: 3px;
    }
    .customer-list-address-row__body { min-width: 0; flex: 1; }
    .customer-list-address-row__label { font-weight: 800; color: var(--ink); }
    .customer-list-address-row__value {
      overflow-wrap: anywhere;
      white-space: normal;
    }
    .customer-list-address-row__value.is-empty { color: var(--ink-faint); }
    .customer-list-address-row__source {
      display: block;
      margin-top: 1px;
      font-size: 10px;
      color: var(--ink-faint);
    }
    @media (max-width: 520px) {
      .customer-list-address-row { font-size: 11px; margin-top: 5px; padding-top: 5px; }
    }
  `;
  document.head.appendChild(style);

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

  function addressData(customer) {
    const saved = String(customer && customer.address || '').trim();
    if (saved) return { value: saved, source: '' };
    const order = customer ? latestOrderWithAddress(customer.id) : null;
    const shipping = String(order && order.shippingAddress || '').trim();
    if (shipping) return { value: shipping, source: 'آخرین آدرس ارسال سفارش' };
    return { value: '', source: '' };
  }

  function decorateCustomerListAddresses() {
    const list = document.getElementById('custList');
    if (!list) return;

    list.querySelectorAll('.rec-card[data-id]').forEach((card) => {
      const customer = customerById(Number(card.dataset.id));
      if (!customer) return;

      const data = addressData(customer);
      const body = card.querySelector('.rec-card__body');
      if (!body) return;

      // app.js already renders customer.address as a generic description. Hide that copy
      // so the standardized labelled row below is the single source shown to the seller.
      if (String(customer.address || '').trim()) {
        body.querySelectorAll('.rec-card__desc').forEach((row) => {
          if (String(row.textContent || '').includes(String(customer.address).trim())) row.style.display = 'none';
        });
      }

      let row = body.querySelector('.customer-list-address-row');
      if (!row) {
        row = document.createElement('div');
        row.className = 'customer-list-address-row';
        const tags = body.querySelector('.tag-chip-list');
        if (tags) body.insertBefore(row, tags);
        else body.appendChild(row);
      }

      const safe = typeof esc === 'function' ? esc : (value) => String(value || '');
      const pin = typeof ic === 'function' ? ic('pin') : '📍';
      row.innerHTML = `
        ${pin}
        <div class="customer-list-address-row__body">
          <span class="customer-list-address-row__label">آدرس: </span>
          <span class="customer-list-address-row__value ${data.value ? '' : 'is-empty'}">${data.value ? safe(data.value) : 'ثبت نشده'}</span>
          ${data.source ? `<span class="customer-list-address-row__source">${safe(data.source)}</span>` : ''}
        </div>`;
    });
  }

  let queued = false;
  function refresh() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      decorateCustomerListAddresses();
    });
  }

  const observer = new MutationObserver((mutations) => {
    if (mutations.some((mutation) => mutation.addedNodes && mutation.addedNodes.length)) refresh();
  });
  if (document.body) observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener('hashchange', refresh);
  window.addEventListener('load', refresh);
  refresh();
})();
