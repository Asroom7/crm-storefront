/* Enhancements for website order payment review in the seller panel. */
(function () {
  if (typeof paymentRowHTML !== 'function') return;

  var style = document.createElement('style');
  style.textContent = `
    .payments-today-list,
    .payment-review-scroll {
      max-height: min(58vh, 520px);
      overflow-y: auto;
      overscroll-behavior: contain;
      padding-inline-end: 3px;
      scrollbar-gutter: stable;
    }
    .payment-review-card { margin-bottom: 8px !important; }
    .payment-review-card .rec-card__body { padding: 10px 11px !important; }
    .payment-review-card .rec-card__top { margin-bottom: 3px; }
    .payment-review-card .rec-card__id,
    .payment-review-card .rec-card__meta,
    .payment-review-card .rec-card__desc {
      font-size: 12px !important;
      line-height: 1.75;
    }
    .payment-review-card .rec-card__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 5px 12px;
      margin-top: 5px;
    }
    .payment-review-amount {
      display: flex;
      align-items: baseline;
      gap: 7px;
      flex-wrap: wrap;
      margin: 7px 0 3px;
    }
    .payment-review-amount__value {
      font-size: 17px;
      font-weight: 900;
      color: var(--success, #16844b);
    }
    .payment-review-original {
      font-size: 11.5px;
      opacity: .52;
      margin-top: 1px;
    }
    .payment-review-discount {
      font-size: 11.5px;
      color: var(--success, #16844b);
      margin-top: 1px;
    }
    .payment-review-details {
      margin-top: 7px;
      border: 1px solid var(--line, rgba(127,127,127,.18));
      border-radius: 10px;
      background: var(--surface-soft, rgba(127,127,127,.05));
      overflow: hidden;
    }
    .payment-review-details summary {
      cursor: pointer;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 700;
      user-select: none;
    }
    .payment-review-details__body {
      padding: 0 10px 9px;
      font-size: 12px;
      line-height: 1.9;
    }
    .payment-review-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 7px;
      margin-top: 9px;
    }
    .payment-review-actions .btn {
      min-height: 38px;
      padding: 8px 9px !important;
      border-radius: 10px;
      font-size: 12px !important;
      font-weight: 800;
    }
    .payment-action-approve {
      background: #16844b !important;
      border-color: #16844b !important;
      color: #fff !important;
    }
    .payment-action-reject {
      background: #c83b3b !important;
      border-color: #c83b3b !important;
      color: #fff !important;
    }
    .payment-receipt-thumb {
      width: 84px;
      height: 84px;
      object-fit: cover;
      border-radius: 10px;
      border: 1px solid var(--border, #ddd);
    }
    @media (max-width: 520px) {
      .payments-today-list,
      .payment-review-scroll { max-height: 55vh; }
      .payment-review-card .rec-card__body { padding: 9px !important; }
      .payment-review-amount__value { font-size: 16px; }
    }
  `;
  document.head.appendChild(style);

  function formatClock(raw) {
    if (!raw) return '';
    var date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
    } catch (e) {
      return String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
    }
  }

  paymentRowHTML = function (p) {
    const isPending = p.status === 'pending';
    const isRejected = p.status === 'rejected';
    const color = isPending ? 'var(--warning, #b7791f)' : (isRejected ? 'var(--danger)' : 'var(--success)');
    const name = paymentCustomerName(p);
    const customer = p.customer || {};
    const itemsLine = p.order && Array.isArray(p.order.items)
      ? p.order.items.map((it) => `${it.product ? it.product.name : 'محصول'} × ${faDigits(it.quantity)}`).join('، ')
      : '';
    const tracking = p.order && p.order.transaction ? p.order.transaction.refId : null;
    const rawResponse = p.order && p.order.transaction && p.order.transaction.rawResponse
      ? p.order.transaction.rawResponse
      : {};
    const receiptUrl = rawResponse.receiptUrl ? safeMediaUrl(rawResponse.receiptUrl) : '';
    const originalAmount = Number(rawResponse.originalAmount || 0);
    const discountAmount = Number(rawResponse.discountAmount || 0);
    const payableAmount = Number(p.amount || rawResponse.payableAmount || 0);
    const statusText = isPending ? 'در انتظار تایید' : (isRejected ? 'رد شده' : 'تایید شده');
    const badgeClass = isPending ? 'pay-pending' : 'pay-completed';
    const registeredAt = formatClock(p.order && p.order.createdAt ? p.order.createdAt : p.createdAt);
    const submittedAt = formatClock(rawResponse.submittedAt);

    return `
      <div class="rec-card payment-review-card" style="border-right-color:${color};" data-id="${p.id}">
        <div class="rec-card__body">
          <div class="rec-card__top">
            <span class="rec-card__title">${name ? esc(name) : fmtId('P', p.id)}</span>
            <span class="badge ${badgeClass}">${statusText}</span>
          </div>
          <div class="rec-card__id">
            ${formatJalaliDisplay(p.date)}
            ${registeredAt ? ` · ساعت ثبت سفارش: ${esc(registeredAt)}` : ''}
            ${submittedAt ? ` · ارسال رسید: ${esc(submittedAt)}` : ''}
            ${p.order ? ` · سفارش #${faDigits(p.order.id)}` : ` · ${fmtId('P', p.id)} · ثبت دستی`}
          </div>

          <div class="payment-review-amount">
            <span style="font-size:12px;">مبلغ واریزی مورد انتظار:</span>
            <span class="payment-review-amount__value">${fmtPrice(payableAmount)}</span>
          </div>
          ${originalAmount > 0 && originalAmount !== payableAmount ? `<div class="payment-review-original">مبلغ اصلی سفارش: ${fmtPrice(originalAmount)}</div>` : ''}
          ${discountAmount > 0 ? `<div class="payment-review-discount">تخفیف اختصاصی پرداخت: ${fmtPrice(discountAmount)}</div>` : ''}

          <div class="rec-card__meta">
            ${tracking ? `<span>${ic('check')}پیگیری: <b dir="ltr" style="unicode-bidi:isolate;">${esc(tracking)}</b></span>` : '<span>شماره پیگیری وارد نشده</span>'}
            ${receiptUrl ? '<span>🧾 رسید تصویری ثبت شده</span>' : '<span>⚠️ رسید تصویری موجود نیست</span>'}
          </div>

          ${p.order ? `
            <details class="payment-review-details">
              <summary>جزئیات سفارش و مشتری</summary>
              <div class="payment-review-details__body">
                <div><strong>نام مشتری:</strong> ${esc(name || 'ثبت نشده')}</div>
                ${customer.phone ? `<div><strong>موبایل:</strong> <span dir="ltr" style="unicode-bidi:isolate;user-select:all;">${esc(customer.phone)}</span></div>` : ''}
                ${customer.email ? `<div><strong>ایمیل:</strong> <span dir="ltr" style="unicode-bidi:isolate;user-select:all;">${esc(customer.email)}</span></div>` : ''}
                ${p.order.shippingAddress ? `<div><strong>آدرس ارسال:</strong> ${esc(p.order.shippingAddress)}</div>` : ''}
                ${itemsLine ? `<div><strong>کالاها:</strong> ${esc(itemsLine)}</div>` : ''}
                ${receiptUrl ? `
                  <div style="margin-top:8px;">
                    <strong style="display:block;margin-bottom:5px;">تصویر رسید:</strong>
                    <a href="${esc(receiptUrl)}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;">
                      <img class="payment-receipt-thumb" src="${esc(receiptUrl)}" alt="رسید پرداخت">
                      <span style="display:block;margin-top:4px;font-size:11px;">مشاهده کامل</span>
                    </a>
                  </div>
                ` : ''}
              </div>
            </details>
          ` : ''}

          ${isPending ? `
            <div class="payment-review-actions">
              <button type="button" class="btn payment-action-approve" data-confirm="${p.id}">${ic('check')}ثبت / تایید سفارش</button>
              <button type="button" class="btn payment-action-reject" data-reject="${p.id}">${ic('x')}رد سفارش</button>
            </div>
          ` : ''}
        </div>
      </div>`;
  };

  if (typeof renderPaymentsHistory === 'function') {
    renderPaymentsHistory = function (view) {
      const list = state.payments.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      view.innerHTML = `
        <div class="detail-header">
          <button class="back-btn" id="backBtn">${ic('chevR')}</button>
          <h3 style="font-size:15.5px;">تاریخچه‌ی واریزی‌ها</h3>
        </div>
        <div class="list payment-review-scroll">${list.length ? list.map((p) => paymentRowHTML(p)).join('') : `<div class="empty-state">${ic('wallet')}<div class="empty-state__desc">هنوز واریزی‌ای ثبت نشده</div></div>`}</div>`;
      document.getElementById('backBtn').addEventListener('click', () => { location.hash = '#/dashboard'; });
      wirePaymentRows(view.querySelector('.payment-review-scroll'));
    };
  }
})();
