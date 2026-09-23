/* Unified customer identity + purchase-based conversation segmentation. */
(function () {
  if (typeof state === 'undefined' || typeof customerFullName !== 'function') return;

  function purchaseKeys(customerId) {
    const keys = new Set();
    (state.sales || []).forEach((sale) => {
      if (Number(sale.customerId) !== Number(customerId)) return;
      keys.add(sale.orderId ? `order:${sale.orderId}` : `sale:${sale.id}`);
    });
    return keys;
  }

  function customerPurchaseCount(customerId) {
    return purchaseKeys(customerId).size;
  }

  function customerPurchaseTotal(customerId) {
    return (state.sales || [])
      .filter((sale) => Number(sale.customerId) === Number(customerId))
      .reduce((sum, sale) => sum + Number(sale.price || 0), 0);
  }

  function customerLastSale(customerId) {
    return (state.sales || [])
      .filter((sale) => Number(sale.customerId) === Number(customerId))
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0] || null;
  }

  function customerSegment(customerId) {
    const count = customerPurchaseCount(customerId);
    if (count === 1) return 'new';
    if (count >= 2 && count <= 3) return 'loyal';
    if (count >= 4) return 'vip';
    return 'none';
  }

  function segmentLabel(segment) {
    if (segment === 'new') return 'مشتری جدید';
    if (segment === 'loyal') return 'مشتری وفادار';
    if (segment === 'vip') return 'VIP';
    return 'بدون خرید';
  }

  function segmentClass(segment) {
    if (segment === 'vip') return 'customer-segment--vip';
    if (segment === 'loyal') return 'customer-segment--loyal';
    if (segment === 'new') return 'customer-segment--new';
    return 'customer-segment--none';
  }

  function customerById(id) {
    return (state.customers || []).find((customer) => Number(customer.id) === Number(id)) || null;
  }

  function customerForRecord(record) {
    if (record && record.customer) return record.customer;
    return record && record.customerId ? customerById(record.customerId) : null;
  }

  function safePhoneHref(phone) {
    return String(phone || '').replace(/[^+\d]/g, '');
  }

  function customerIdentityHTML(customer, options) {
    options = options || {};
    if (!customer) return '';
    const count = customerPurchaseCount(customer.id);
    const segment = customerSegment(customer.id);
    const lastSale = customerLastSale(customer.id);
    const total = customerPurchaseTotal(customer.id);
    const tags = Array.isArray(customer.tags) ? customer.tags.filter(Boolean) : [];
    return `
      <div class="customer-connected-card ${options.compact ? 'is-compact' : ''}" data-customer-context="${customer.id}">
        <div class="customer-connected-card__head">
          <div>
            <strong>${esc(customerFullName(customer) || 'بدون نام')}</strong>
            <span class="customer-segment ${segmentClass(segment)}">${segmentLabel(segment)}</span>
          </div>
          ${options.profileButton === false ? '' : `<button type="button" class="customer-profile-link" data-open-customer="${customer.id}">${ic('users')}پروفایل مشتری</button>`}
        </div>
        <div class="customer-connected-card__meta">
          ${customer.phone ? `<a href="tel:${esc(safePhoneHref(customer.phone))}" data-customer-contact onclick="event.stopPropagation()">${ic('phone')}${esc(customer.phone)}</a>` : '<span>شماره تماس ثبت نشده</span>'}
          ${customer.email ? `<a href="mailto:${esc(customer.email)}" data-customer-contact onclick="event.stopPropagation()">${esc(customer.email)}</a>` : ''}
          <span>${ic('cart')}${faDigits(count)} خرید</span>
          ${total > 0 ? `<span>${ic('wallet')}${fmtPrice(total)}</span>` : ''}
          ${lastSale ? `<span>${ic('calendar')}آخرین خرید: ${formatJalaliDisplay(lastSale.date)}</span>` : ''}
        </div>
        ${!options.compact && customer.address ? `<div class="customer-connected-card__address">${ic('pin')}${esc(customer.address)}</div>` : ''}
        ${!options.compact && tags.length ? `<div class="customer-connected-card__tags">${tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>` : ''}
      </div>`;
  }

  function bindCustomerProfileLinks(root) {
    if (!root) return;
    root.querySelectorAll('[data-open-customer]').forEach((button) => {
      if (button.dataset.customerBound === '1') return;
      button.dataset.customerBound = '1';
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        location.hash = `#/customer-detail/${button.dataset.openCustomer}/sales`;
      });
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .customer-connected-card {
      margin-top: 8px;
      padding: 9px 10px;
      border: 1px solid var(--border);
      border-radius: 11px;
      background: var(--surface-2);
    }
    .customer-connected-card.is-compact { padding: 7px 9px; }
    .customer-connected-card__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      flex-wrap: wrap;
    }
    .customer-connected-card__head > div {
      display: flex;
      align-items: center;
      gap: 7px;
      flex-wrap: wrap;
    }
    .customer-connected-card__head strong { font-size: 12.5px; }
    .customer-segment {
      display: inline-flex;
      align-items: center;
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 10.5px;
      font-weight: 800;
      white-space: nowrap;
    }
    .customer-segment--new { background: var(--info-tint); color: var(--info); }
    .customer-segment--loyal { background: var(--success-tint); color: var(--success); }
    .customer-segment--vip { background: var(--accent-tint); color: var(--accent); }
    .customer-segment--none { background: var(--surface); color: var(--ink-faint); }
    .customer-profile-link {
      border: 0;
      background: transparent;
      color: var(--primary);
      font: inherit;
      font-size: 11.5px;
      font-weight: 800;
      padding: 3px 0;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
    }
    .customer-profile-link svg,
    .customer-connected-card__meta svg,
    .customer-connected-card__address svg { width: 14px; height: 14px; flex-shrink: 0; }
    .customer-connected-card__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 5px 11px;
      margin-top: 6px;
      font-size: 11.5px;
      color: var(--ink-soft);
    }
    .customer-connected-card__meta span,
    .customer-connected-card__meta a {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .customer-connected-card__address {
      display: flex;
      gap: 5px;
      margin-top: 6px;
      font-size: 11.5px;
      line-height: 1.8;
      color: var(--ink-soft);
    }
    .customer-connected-card__tags {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 6px;
    }
    .customer-connected-card__tags span {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 2px 7px;
      font-size: 10.5px;
      color: var(--ink-soft);
    }
    .customer-master-card { margin-bottom: 12px; }
    .conversation-customer-card { cursor: default; }
    .conversation-customer-card__latest {
      margin-top: 8px;
      padding-top: 7px;
      border-top: 1px solid var(--border);
      font-size: 11.5px;
      color: var(--ink-soft);
      line-height: 1.8;
    }
    .conversation-customer-card__actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
      margin-top: 8px;
    }
    .conversation-customer-card__actions .btn {
      min-height: 36px;
      padding: 7px 8px;
      font-size: 11.5px;
    }
    @media (max-width: 520px) {
      .customer-connected-card { padding: 8px; }
      .customer-connected-card__meta { gap: 4px 8px; }
      .conversation-customer-card__actions { grid-template-columns: 1fr; }
    }
  `;
  document.head.appendChild(style);

  const originalRenderCustomers = typeof renderCustomers === 'function' ? renderCustomers : null;
  if (originalRenderCustomers) {
    renderCustomers = function (view) {
      originalRenderCustomers(view);
      view.querySelectorAll('#custList [data-id]').forEach((row) => {
        const customer = customerById(Number(row.dataset.id));
        if (!customer || row.querySelector('.customer-segment')) return;
        const top = row.querySelector('.rec-card__top');
        if (!top) return;
        const segment = customerSegment(customer.id);
        const badge = document.createElement('span');
        badge.className = `customer-segment ${segmentClass(segment)}`;
        badge.textContent = `${segmentLabel(segment)} · ${faDigits(customerPurchaseCount(customer.id))} خرید`;
        top.appendChild(badge);
      });
    };
  }

  const originalRenderCustomerDetail = typeof renderCustomerDetail === 'function' ? renderCustomerDetail : null;
  if (originalRenderCustomerDetail) {
    renderCustomerDetail = function (view, id, tab) {
      originalRenderCustomerDetail(view, id, tab);
      const customer = customerById(id);
      const header = view.querySelector('.detail-header');
      if (customer && header && !view.querySelector('.customer-master-card')) {
        const wrap = document.createElement('div');
        wrap.className = 'customer-master-card';
        wrap.innerHTML = customerIdentityHTML(customer, { profileButton: false });
        header.insertAdjacentElement('afterend', wrap);
      }
      bindCustomerProfileLinks(view);
    };
  }

  const originalRenderSales = typeof renderSales === 'function' ? renderSales : null;
  if (originalRenderSales) {
    renderSales = function (view) {
      originalRenderSales(view);
      view.querySelectorAll('#salesList [data-sale]').forEach((row) => {
        const sale = (state.sales || []).find((item) => Number(item.id) === Number(row.dataset.sale));
        const customer = customerForRecord(sale);
        const body = row.querySelector('.rec-card__body');
        if (!customer || !body || body.querySelector('[data-customer-context]')) return;
        body.insertAdjacentHTML('beforeend', customerIdentityHTML(customer, { compact: true }));
      });
      bindCustomerProfileLinks(view);
    };
  }

  if (typeof paymentRowHTML === 'function') {
    const originalPaymentRowHTML = paymentRowHTML;
    paymentRowHTML = function (payment) {
      let html = originalPaymentRowHTML(payment);
      const customer = customerForRecord(payment);
      if (!customer) return html;
      const identity = customerIdentityHTML(customer, { compact: true });
      const detailsMarker = '<details class="payment-review-details">';
      if (html.includes(detailsMarker)) {
        html = html.replace(detailsMarker, `${identity}${detailsMarker}`);
      } else {
        html = html.replace('<div class="payment-review-actions">', `${identity}<div class="payment-review-actions">`);
      }
      return html;
    };
  }

  function latestConversation(customerId) {
    return (state.conversations || [])
      .filter((conversation) => Number(conversation.customerId) === Number(customerId))
      .slice()
      .sort((a, b) => {
        const dateCmp = String(b.date || '').localeCompare(String(a.date || ''));
        if (dateCmp) return dateCmp;
        return Number(b.id || 0) - Number(a.id || 0);
      })[0] || null;
  }

  function conversationCount(customerId) {
    return (state.conversations || []).filter((conversation) => Number(conversation.customerId) === Number(customerId)).length;
  }

  function conversationCustomerHTML(customer) {
    const latest = latestConversation(customer.id);
    const count = conversationCount(customer.id);
    const purchaseCount = customerPurchaseCount(customer.id);
    const segment = customerSegment(customer.id);
    return `
      <div class="rec-card conversation-customer-card" style="border-right-color:var(--info);" data-conversation-customer="${customer.id}">
        <div class="rec-card__body">
          <div class="rec-card__top">
            <span class="rec-card__title">${esc(customerFullName(customer) || 'بدون نام')}</span>
            <span class="customer-segment ${segmentClass(segment)}">${segmentLabel(segment)}</span>
          </div>
          <div class="rec-card__id">${fmtId('C', customer.id)} · ${faDigits(purchaseCount)} خرید · ${faDigits(count)} گفتگو</div>
          ${customerIdentityHTML(customer, { compact: false, profileButton: false })}
          ${latest ? `<div class="conversation-customer-card__latest"><strong>آخرین گفتگو:</strong> ${latest.notes ? esc(latest.notes) : 'بدون یادداشت'} · ${formatJalaliDisplay(latest.date)}</div>` : '<div class="conversation-customer-card__latest">هنوز گفتگویی برای این مشتری ثبت نشده است.</div>'}
          <div class="conversation-customer-card__actions">
            <button type="button" class="btn secondary" data-open-customer="${customer.id}">${ic('users')}پروفایل و سوابق</button>
            <button type="button" class="btn primary" data-add-conversation="${customer.id}">${ic('chat')}ثبت گفتگو</button>
          </div>
        </div>
      </div>`;
  }

  renderConversations = function (view) {
    const filters = state.filters.conversations || (state.filters.conversations = {});
    if (!['new', 'loyal', 'vip'].includes(filters.segment)) filters.segment = 'new';

    const eligible = (state.customers || []).filter((customer) => customerPurchaseCount(customer.id) >= 1);
    const counts = {
      new: eligible.filter((customer) => customerSegment(customer.id) === 'new').length,
      loyal: eligible.filter((customer) => customerSegment(customer.id) === 'loyal').length,
      vip: eligible.filter((customer) => customerSegment(customer.id) === 'vip').length,
    };
    const list = eligible
      .filter((customer) => customerSegment(customer.id) === filters.segment)
      .sort((a, b) => {
        const aSale = customerLastSale(a.id);
        const bSale = customerLastSale(b.id);
        return String(bSale && bSale.date || '').localeCompare(String(aSale && aSale.date || ''));
      });

    const options = [
      ['new', `مشتریان جدید (${faDigits(counts.new)})`],
      ['loyal', `مشتریان وفادار (${faDigits(counts.loyal)})`],
      ['vip', `مشتریان VIP (${faDigits(counts.vip)})`],
    ];

    view.innerHTML = `
      <div class="section-title">${ic('chat')} گفتگوها<span class="cnt">${faDigits(list.length)}</span></div>
      <div class="filter-chips" id="conversationCustomerSegments">
        ${options.map(([value, label]) => `<button class="chip ${filters.segment === value ? 'active' : ''}" data-segment="${value}">${label}</button>`).join('')}
      </div>
      <div class="list" id="convList">
        ${list.length ? list.map(conversationCustomerHTML).join('') : `<div class="empty-state">${ic('users')}<div class="empty-state__title">مشتری‌ای در این گروه نیست</div><div class="empty-state__desc">گروه‌بندی بر اساس تعداد خریدهای ثبت‌شده انجام می‌شود.</div></div>`}
      </div>`;

    view.querySelectorAll('#conversationCustomerSegments [data-segment]').forEach((chip) => {
      chip.addEventListener('click', () => {
        filters.segment = chip.dataset.segment;
        renderConversations(view);
      });
    });
    view.querySelectorAll('[data-add-conversation]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        openConversationForm(Number(button.dataset.addConversation));
      });
    });
    bindCustomerProfileLinks(view);
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest && event.target.closest('[data-open-customer]');
    if (!button || button.dataset.customerBound === '1') return;
    event.preventDefault();
    event.stopPropagation();
    location.hash = `#/customer-detail/${button.dataset.openCustomer}/sales`;
  });
})();
