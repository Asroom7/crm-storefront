/* Enhancements for website order payment review in the seller panel. */
(function () {
  if (typeof paymentRowHTML !== 'function') return;

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
      : null;
    const receiptUrl = rawResponse && rawResponse.receiptUrl ? safeMediaUrl(rawResponse.receiptUrl) : '';
    const statusText = isPending ? 'در انتظار تایید' : (isRejected ? 'رد شده' : 'تایید شده');
    const badgeClass = isPending ? 'pay-pending' : 'pay-completed';

    return `
      <div class="rec-card" style="border-right-color:${color};" data-id="${p.id}">
        <div class="rec-card__body">
          <div class="rec-card__top">
            <span class="rec-card__title">${name ? esc(name) : fmtId('P', p.id)}</span>
            <span class="badge ${badgeClass}">${statusText}</span>
          </div>
          <div class="rec-card__id">
            ${formatJalaliDisplay(p.date)} · ${fmtId('P', p.id)}
            ${p.order ? ` · سفارش #${faDigits(p.order.id)}` : ' · ثبت دستی'}
          </div>

          <div class="rec-card__meta">
            <span>${ic('wallet')}${fmtPrice(p.amount)}</span>
            ${tracking ? `<span>${ic('check')}پیگیری: <b dir="ltr" style="unicode-bidi:isolate;">${esc(tracking)}</b></span>` : ''}
          </div>

          ${p.order ? `
            <div style="margin-top:10px;padding:10px;border-radius:12px;background:var(--surface-soft, rgba(127,127,127,.06));font-size:12.5px;line-height:2;">
              <div><strong>نام مشتری:</strong> ${esc(name || 'ثبت نشده')}</div>
              ${customer.phone ? `<div><strong>موبایل:</strong> <span dir="ltr" style="unicode-bidi:isolate;user-select:all;">${esc(customer.phone)}</span></div>` : ''}
              ${customer.email ? `<div><strong>ایمیل:</strong> <span dir="ltr" style="unicode-bidi:isolate;user-select:all;">${esc(customer.email)}</span></div>` : ''}
              ${p.order.shippingAddress ? `<div><strong>آدرس ارسال:</strong> ${esc(p.order.shippingAddress)}</div>` : ''}
              ${itemsLine ? `<div><strong>کالاها:</strong> ${esc(itemsLine)}</div>` : ''}
            </div>
          ` : ''}

          ${receiptUrl ? `
            <div style="margin-top:10px;">
              <div style="font-size:12.5px;font-weight:700;margin-bottom:7px;">تصویر رسید پرداخت</div>
              <a href="${esc(receiptUrl)}" target="_blank" rel="noopener" style="display:inline-block;text-decoration:none;">
                <img src="${esc(receiptUrl)}" alt="رسید پرداخت" style="display:block;width:120px;height:120px;object-fit:cover;border-radius:12px;border:1px solid var(--border, #ddd);">
                <span style="display:block;margin-top:5px;font-size:12px;">مشاهده در اندازه کامل</span>
              </a>
            </div>
          ` : ''}

          ${isPending ? `
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
              <button type="button" class="btn primary" data-confirm="${p.id}" style="padding:9px 14px;font-size:12.5px;">${ic('check')}تایید و ثبت فروش</button>
              <button type="button" class="btn danger" data-reject="${p.id}" style="padding:9px 14px;font-size:12.5px;">${ic('x')}رد پرداخت</button>
            </div>
          ` : ''}
        </div>
      </div>`;
  };
})();
