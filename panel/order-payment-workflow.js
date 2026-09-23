/* Enhancements for website order payment review in the seller panel. */
(function () {
  if (typeof paymentRowHTML !== 'function') return;

  var style = document.createElement('style');
  style.textContent = `
    .payments-today-panel {
      height: clamp(310px, 46dvh, 420px) !important;
      min-height: 0 !important;
      max-height: 420px !important;
      overflow: hidden !important;
      padding: 10px !important;
    }
    .payments-today-panel__head {
      margin-bottom: 8px !important;
      gap: 7px !important;
    }
    .payments-today-panel__actions { gap: 6px !important; }
    .payments-today-panel__actions .btn {
      min-height: 34px;
      padding: 6px 10px !important;
      font-size: 11.5px !important;
      border-radius: 10px;
    }
    .payments-today-list,
    .payment-review-scroll {
      overflow-y: auto !important;
      overflow-x: hidden !important;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      touch-action: pan-y;
      min-height: 0 !important;
      padding-inline-end: 2px;
      scrollbar-gutter: stable;
    }
    .payments-today-list {
      flex: 1 1 auto !important;
      max-height: none !important;
      gap: 6px !important;
      padding-bottom: 6px;
    }
    .payment-review-scroll {
      max-height: calc(100dvh - var(--top-h, 56px) - var(--nav-h, 70px) - 84px) !important;
    }
    .payment-review-card {
      margin-bottom: 0 !important;
      flex: 0 0 auto;
    }
    .payment-review-card .rec-card__body { padding: 8px 9px !important; }
    .payment-review-card .rec-card__top { margin-bottom: 2px; gap: 6px; }
    .payment-review-card .rec-card__title { font-size: 13.5px !important; }
    .payment-review-card .badge { font-size: 10.5px !important; padding: 3px 7px !important; }
    .payment-review-card .rec-card__id,
    .payment-review-card .rec-card__meta,
    .payment-review-card .rec-card__desc {
      font-size: 11px !important;
      line-height: 1.6;
    }
    .payment-review-card .rec-card__meta {
      display: flex;
      flex-wrap: wrap;
      gap: 3px 9px;
      margin-top: 4px;
    }
    .payment-review-core {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 68px;
      gap: 8px;
      align-items: start;
      margin-top: 3px;
    }
    .payment-review-core.no-receipt { grid-template-columns: 1fr; }
    .payment-review-amount {
      display: flex;
      align-items: baseline;
      gap: 5px;
      flex-wrap: wrap;
      margin: 4px 0 1px;
    }
    .payment-review-amount__label { font-size: 11px; color: var(--ink-soft, #666); }
    .payment-review-amount__value {
      font-size: 15.5px;
      font-weight: 900;
      line-height: 1.35;
      color: var(--success, #16844b);
    }
    .payment-review-original {
      font-size: 10.5px;
      opacity: .48;
      margin-top: 0;
      line-height: 1.55;
    }
    .payment-review-discount {
      font-size: 10.5px;
      color: var(--success, #16844b);
      margin-top: 0;
      line-height: 1.55;
    }
    .payment-receipt-quick {
      display: block;
      width: 68px;
      text-align: center;
      text-decoration: none;
      color: var(--primary, #0f5257);
    }
    .payment-receipt-thumb {
      display: block;
      width: 68px;
      height: 68px;
      object-fit: cover;
      border-radius: 9px;
      border: 1px solid var(--border, #ddd);
      background: var(--surface-2, #f5f5f5);
    }
    .payment-receipt-quick span {
      display: block;
      margin-top: 2px;
      font-size: 9.5px;
      font-weight: 700;
      line-height: 1.4;
    }
    .payment-review-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 6px;
    }
    .payment-review-actions .btn {
      min-height: 34px;
      padding: 6px 7px !important;
      border-radius: 9px;
      font-size: 11px !important;
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
    .payment-review-details {
      margin-top: 6px;
      border: 1px solid var(--line, rgba(127,127,127,.18));
      border-radius: 9px;
      background: var(--surface-soft, rgba(127,127,127,.05));
      overflow: hidden;
    }
    .payment-review-details summary {
      cursor: pointer;
      padding: 6px 8px;
      font-size: 11px;
      font-weight: 700;
      user-select: none;
    }
    .payment-review-details__body {
      padding: 0 8px 7px;
      font-size: 11px;
      line-height: 1.75;
    }
    .payment-review-details__receipt {
      display: block;
      width: min(100%, 240px);
      max-height: 300px;
      object-fit: contain;
      margin-top: 6px;
      border-radius: 9px;
      border: 1px solid var(--border, #ddd);
      background: var(--surface, #fff);
    }
    @media (max-width: 520px) {
      .payments-today-panel {
        height: clamp(300px, 44dvh, 380px) !important;
        max-height: 380px !important;
        padding: 9px !important;
      }
      .payment-review-card .rec-card__body { padding: 7px 8px !important; }
      .payment-review-amount__value { font-size: 14.5px; }
      .payment-review-core { grid-template-columns: minmax(0, 1fr) 62px; gap: 7px; }
      .payment-receipt-quick, .payment-receipt-thumb { width: 62px; }
      .payment-receipt-thumb { height: 62px; }
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
            ${registeredAt ? ` · ثبت: ${esc(registeredAt)}` : ''}
            ${submittedAt ? ` · رسید: ${esc(submittedAt)}` : ''}
            ${p.order ? ` · سفارش #${faDigits(p.order.id)}` : ` · ${fmtId('P', p.id)} · دستی`}
          </div>

          <div class="payment-review-core${receiptUrl ? '' : ' no-receipt'}">
            <div>
              <div class="payment-review-amount">
                <span class="payment-review-amount__label">مبلغ واریزی:</span>
                <span class="payment-review-amount__value">${fmtPrice(payableAmount)}</span>
              </div>
              ${originalAmount > 0 ? `<div class="payment-review-original">مبلغ اصلی سفارش: ${fmtPrice(originalAmount)}</div>` : ''}
              ${discountAmount > 0 ? `<div class="payment-review-discount">تخفیف اختصاصی: ${fmtPrice(discountAmount)}</div>` : ''}
              <div class="rec-card__meta">
                ${tracking ? `<span>پیگیری: <b dir="ltr" style="unicode-bidi:isolate;">${esc(tracking)}</b></span>` : '<span>پیگیری وارد نشده</span>'}
              </div>
            </div>
            ${receiptUrl ? `
              <a class="payment-receipt-quick" href="${esc(receiptUrl)}" target="_blank" rel="noopener" aria-label="مشاهده تصویر کامل رسید">
                <img class="payment-receipt-thumb" src="${esc(receiptUrl)}" alt="تصویر رسید پرداخت" loading="lazy">
                <span>مشاهده رسید</span>
              </a>
            ` : ''}
          </div>

          ${isPending ? `
            <div class="payment-review-actions">
              <button type="button" class="btn payment-action-approve" data-confirm="${p.id}">${ic('check')}تایید و ثبت</button>
              <button type="button" class="btn payment-action-reject" data-reject="${p.id}">${ic('x')}رد سفارش</button>
            </div>
          ` : ''}

          ${p.order ? `
            <details class="payment-review-details">
              <summary>جزئیات سفارش و مشتری</summary>
              <div class="payment-review-details__body">
                <div><strong>نام مشتری:</strong> ${esc(name || 'ثبت نشده')}</div>
                ${customer.phone ? `<div><strong>موبایل:</strong> <span dir="ltr" style="unicode-bidi:isolate;user-select:all;">${esc(customer.phone)}</span></div>` : ''}
                ${customer.email ? `<div><strong>ایمیل:</strong> <span dir="ltr" style="unicode-bidi:isolate;user-select:all;">${esc(customer.email)}</span></div>` : ''}
                ${p.order.shippingAddress ? `<div><strong>آدرس ارسال:</strong> ${esc(p.order.shippingAddress)}</div>` : ''}
                ${itemsLine ? `<div><strong>کالاها:</strong> ${esc(itemsLine)}</div>` : ''}
                ${receiptUrl ? `<a href="${esc(receiptUrl)}" target="_blank" rel="noopener"><img class="payment-review-details__receipt" src="${esc(receiptUrl)}" alt="رسید پرداخت" loading="lazy"></a>` : ''}
              </div>
            </details>
          ` : ''}
        </div>
      </div>`;
  };

  if (typeof paymentsTodayPanelHTML === 'function') {
    paymentsTodayPanelHTML = function () {
      const list = state.payments.filter((p) => p.status === 'pending');
      const hint = list.length ? `${faDigits(list.length)} واریزی نیاز به بررسی دارد` : 'همه‌ی واریزی‌ها بررسی شده‌اند';
      return `
        <div class="section-title">${ic('wallet')} واریزی‌ها<span class="cnt">${faDigits(list.length)}</span></div>
        <div class="payments-today-panel">
          <div class="payments-today-panel__head">
            <div class="payments-today-panel__hint">${esc(hint)}</div>
            <div class="payments-today-panel__actions">
              <button type="button" class="btn secondary" id="paymentsHistoryBtn">${ic('clock')}تاریخچه</button>
              <button type="button" class="btn primary" id="paymentAddBtn">${ic('plus')}واریزی دستی</button>
            </div>
          </div>
          <div class="payments-today-list${list.length ? '' : ' is-empty'}">
            ${list.length ? list.map((p) => paymentRowHTML(p)).join('') : `<div class="empty-state" style="padding:22px;">${ic('wallet')}<div class="empty-state__desc">واریزی در انتظاری نیست</div></div>`}
          </div>
        </div>`;
    };
  }

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
