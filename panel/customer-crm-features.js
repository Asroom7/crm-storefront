/* Customer CRM foundation: timeline, SMS consent/history, metrics and duplicate-safe UX. */
(function () {
  if (typeof state === 'undefined' || typeof sellerApiFetch !== 'function') return;

  function customerById(id) {
    return (state.customers || []).find((customer) => Number(customer.id) === Number(id)) || null;
  }

  function customerSales(customerId) {
    return (state.sales || []).filter((sale) => Number(sale.customerId) === Number(customerId));
  }

  function customerMetricsLocal(customerId) {
    const rows = customerSales(customerId);
    const keys = new Set();
    let totalSpent = 0;
    let last = null;
    rows.forEach((sale) => {
      keys.add(sale.orderId ? `order:${sale.orderId}` : `sale:${sale.id}`);
      totalSpent += Number(sale.price || 0);
      const at = sale.createdAt || (sale.date ? `${sale.date}T00:00:00` : null);
      if (at && (!last || new Date(at) > new Date(last))) last = at;
    });
    const purchaseCount = keys.size;
    return {
      purchaseCount,
      totalSpent,
      averageOrderValue: purchaseCount ? Math.round(totalSpent / purchaseCount) : 0,
      lastPurchaseAt: last,
      daysSinceLastPurchase: last ? Math.max(0, Math.floor((Date.now() - new Date(last).getTime()) / 86400000)) : null,
    };
  }

  function formatDateTimeFa(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return esc(String(value));
    return date.toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function smsConsentBadge(customer) {
    return `<span class="sms-consent-badge ${customer && customer.smsOptIn ? 'is-on' : 'is-off'}">${customer && customer.smsOptIn ? 'پیامک مجاز' : 'پیامک غیرفعال'}</span>`;
  }

  function decorateCustomerContexts(root) {
    if (!root) return;
    root.querySelectorAll('[data-customer-context]').forEach((card) => {
      if (card.querySelector('.sms-consent-badge')) return;
      const customer = customerById(Number(card.dataset.customerContext));
      const head = card.querySelector('.customer-connected-card__head > div');
      if (customer && head) head.insertAdjacentHTML('beforeend', smsConsentBadge(customer));
    });
    root.querySelectorAll('[data-conversation-customer]').forEach((card) => {
      if (card.querySelector('.sms-consent-badge')) return;
      const customer = customerById(Number(card.dataset.conversationCustomer));
      const top = card.querySelector('.rec-card__top');
      if (customer && top) top.insertAdjacentHTML('beforeend', smsConsentBadge(customer));
    });
  }

  const styles = document.createElement('style');
  styles.textContent = `
    .sms-consent-badge{display:inline-flex;align-items:center;border-radius:999px;padding:2px 7px;font-size:10.5px;font-weight:800;white-space:nowrap}
    .sms-consent-badge.is-on{background:var(--success-tint);color:var(--success)}
    .sms-consent-badge.is-off{background:var(--surface);color:var(--ink-faint);border:1px solid var(--border)}
    .customer-metrics-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin:10px 0 12px}
    .customer-metric{background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:9px;text-align:center}
    .customer-metric strong{display:block;font-size:13px;color:var(--ink);margin-bottom:3px}
    .customer-metric span{font-size:10.5px;color:var(--ink-soft)}
    .customer-timeline{display:flex;flex-direction:column;gap:0;margin-top:8px}
    .customer-timeline-row{display:grid;grid-template-columns:22px 1fr;gap:8px;position:relative;padding:0 0 14px}
    .customer-timeline-row:not(:last-child)::before{content:'';position:absolute;right:10px;top:22px;bottom:0;width:2px;background:var(--border)}
    .customer-timeline-dot{width:20px;height:20px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:9px;z-index:1}
    .customer-timeline-body{background:var(--surface);border:1px solid var(--border);border-radius:11px;padding:9px 10px}
    .customer-timeline-title{font-size:12.5px;font-weight:850;color:var(--ink)}
    .customer-timeline-time{font-size:10.5px;color:var(--ink-faint);margin-top:2px}
    .customer-timeline-desc{font-size:11.5px;color:var(--ink-soft);line-height:1.8;margin-top:5px}
    .customer-timeline-meta{display:flex;flex-wrap:wrap;gap:5px 10px;margin-top:5px;font-size:11px;color:var(--primary)}
    .sms-control-card{border:1px solid var(--border);border-radius:12px;padding:10px;background:var(--surface);margin-bottom:10px}
    .sms-control-head{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
    .sms-history-row{border:1px solid var(--border);border-radius:11px;background:var(--surface);padding:10px;margin-bottom:8px}
    .sms-history-row__top{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}
    .sms-history-row__text{margin-top:7px;line-height:1.9;font-size:12px;color:var(--ink)}
    .sms-history-row__meta{display:flex;flex-wrap:wrap;gap:5px 10px;margin-top:7px;color:var(--ink-soft);font-size:10.8px}
    .sms-history-note{font-size:11px;color:var(--ink-soft);line-height:1.8;margin-top:6px}
    @media(max-width:600px){.customer-metrics-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;
  document.head.appendChild(styles);

  function metricsHTML(metrics) {
    return `<div class="customer-metrics-grid">
      <div class="customer-metric"><strong>${faDigits(metrics.purchaseCount || 0)}</strong><span>تعداد خرید</span></div>
      <div class="customer-metric"><strong>${fmtPrice(metrics.totalSpent || 0)}</strong><span>مجموع خرید</span></div>
      <div class="customer-metric"><strong>${fmtPrice(metrics.averageOrderValue || 0)}</strong><span>میانگین سفارش</span></div>
      <div class="customer-metric"><strong>${metrics.daysSinceLastPurchase == null ? '—' : faDigits(metrics.daysSinceLastPurchase) + ' روز'}</strong><span>از آخرین خرید</span></div>
    </div>`;
  }

  function timelineEventHTML(event) {
    const meta = [];
    if (event.amount) meta.push(fmtPrice(event.amount));
    if (event.orderId) meta.push(`سفارش #${faDigits(event.orderId)}`);
    if (event.trackingNumber) meta.push(`پیگیری: ${esc(event.trackingNumber)}`);
    if (event.campaign) meta.push(`کمپین: ${esc(event.campaign)}`);
    return `<div class="customer-timeline-row">
      <div class="customer-timeline-dot">●</div>
      <div class="customer-timeline-body">
        <div class="customer-timeline-title">${esc(event.label || event.type || 'رویداد')}</div>
        <div class="customer-timeline-time">${formatDateTimeFa(event.at)}</div>
        ${event.description ? `<div class="customer-timeline-desc">${esc(event.description)}</div>` : ''}
        ${meta.length ? `<div class="customer-timeline-meta">${meta.map((item) => `<span>${item}</span>`).join('')}</div>` : ''}
        ${event.receiptUrl ? `<div class="customer-timeline-meta"><a href="${esc(event.receiptUrl)}" target="_blank" rel="noopener">مشاهده رسید</a></div>` : ''}
      </div>
    </div>`;
  }

  async function renderTimelineTab(listEl, customerId) {
    listEl.innerHTML = '<div class="empty-state"><div class="empty-state__desc">در حال دریافت خط زمانی...</div></div>';
    try {
      const data = await sellerApiFetch(`/customers/${customerId}/timeline`);
      listEl.innerHTML = `${metricsHTML(data.metrics || customerMetricsLocal(customerId))}
        <div class="section-title">خط زمانی مشتری</div>
        <div class="customer-timeline">${(data.timeline || []).length ? data.timeline.map(timelineEventHTML).join('') : '<div class="empty-state"><div class="empty-state__desc">هنوز رویدادی ثبت نشده است.</div></div>'}</div>`;
    } catch (error) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state__desc">${esc(error.message || 'خطا در دریافت خط زمانی')}</div></div>`;
    }
  }

  function smsStatusLabel(status) {
    const labels = { draft: 'پیش‌نویس', pending: 'در انتظار', sent: 'ارسال شده', delivered: 'تحویل شده', failed: 'ناموفق' };
    return labels[status] || status;
  }

  function smsHistoryHTML(row) {
    return `<div class="sms-history-row">
      <div class="sms-history-row__top">
        <strong>${row.campaign ? esc(row.campaign) : 'بدون کمپین'}</strong>
        <span class="badge ${row.status === 'failed' ? 'st-lost' : (row.status === 'delivered' ? 'st-bought' : 'st-followup')}">${esc(smsStatusLabel(row.status))}</span>
      </div>
      <div class="sms-history-row__text">${esc(row.text || '')}</div>
      <div class="sms-history-row__meta">
        <span>زمان: ${formatDateTimeFa(row.sentAt || row.createdAt)}</span>
        ${row.deliveredAt ? `<span>تحویل: ${formatDateTimeFa(row.deliveredAt)}</span>` : ''}
        ${row.providerMessageId ? `<span>شناسه سرویس: ${esc(row.providerMessageId)}</span>` : ''}
        ${row.failureReason ? `<span>خطا: ${esc(row.failureReason)}</span>` : ''}
      </div>
    </div>`;
  }

  function openSmsLogForm(customerId, afterSave) {
    const customer = customerById(customerId);
    if (!customer) return;
    const html = `
      <div class="modal__handle"></div>
      <h3 class="modal__title">ثبت سابقه پیامک</h3>
      <div class="sms-history-note">این فرم فعلاً پیامک ارسال نمی‌کند؛ فقط سابقه را ثبت می‌کند. وقتی سرویس پیامکی وصل شود، ارسال و وضعیت تحویل خودکار در همین تاریخچه ثبت خواهد شد.</div>
      <form id="smsLogForm">
        <div class="field"><label>کمپین (اختیاری)</label><input name="campaign" maxlength="200" placeholder="مثلاً پیگیری مشتریان VIP"></div>
        <div class="field"><label>متن پیامک *</label><textarea name="text" required maxlength="4000" placeholder="متن پیامک..."></textarea></div>
        <div class="field"><label>وضعیت</label><select name="status"><option value="draft">پیش‌نویس</option><option value="pending">در انتظار</option><option value="sent">ارسال شده</option><option value="delivered">تحویل شده</option><option value="failed">ناموفق</option></select></div>
        <div class="modal__actions"><button type="button" class="btn secondary block" data-close-modal>انصراف</button><button type="submit" class="btn primary block">${ic('check')}ثبت سابقه</button></div>
      </form>`;
    const wrap = openModal(html);
    wrap.querySelector('#smsLogForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const text = form.elements.text.value.trim();
      if (!text) return toast('متن پیامک را وارد کنید');
      try {
        await sellerApiFetch('/communications/sms', {
          method: 'POST',
          body: JSON.stringify({ customerId, text, campaign: form.elements.campaign.value.trim() || null, status: form.elements.status.value }),
        });
        closeModal();
        toast('سابقه پیامک ثبت شد');
        if (afterSave) afterSave();
      } catch (error) { toast(error.message); }
    });
  }

  async function renderSmsTab(listEl, customerId) {
    const customer = customerById(customerId);
    if (!customer) return;
    listEl.innerHTML = '<div class="empty-state"><div class="empty-state__desc">در حال دریافت تاریخچه پیامک...</div></div>';
    try {
      const rows = await sellerApiFetch(`/communications/sms?customerId=${encodeURIComponent(customerId)}`);
      listEl.innerHTML = `
        <div class="sms-control-card">
          <div class="sms-control-head">
            <div><strong>وضعیت دریافت پیامک</strong><div class="sms-history-note">${customer.smsOptIn ? 'مشتری دریافت پیامک را مجاز کرده است.' : 'دریافت پیامک برای این مشتری غیرفعال است.'}</div></div>
            <button type="button" class="btn ${customer.smsOptIn ? 'danger' : 'primary'}" id="toggleSmsConsent">${customer.smsOptIn ? 'غیرفعال کردن' : 'فعال کردن'}</button>
          </div>
          <div style="margin-top:9px;"><button type="button" class="btn secondary" id="addSmsHistory">ثبت سابقه پیامک</button></div>
        </div>
        <div class="section-title">تاریخچه پیامک‌ها<span class="cnt">${faDigits(rows.length)}</span></div>
        <div id="smsHistoryList">${rows.length ? rows.map(smsHistoryHTML).join('') : '<div class="empty-state"><div class="empty-state__desc">هنوز پیامکی برای این مشتری ثبت نشده است.</div></div>'}</div>`;

      listEl.querySelector('#toggleSmsConsent').addEventListener('click', () => {
        const nextValue = !customer.smsOptIn;
        confirmDialog('تغییر وضعیت پیامک', nextValue ? 'دریافت پیامک برای این مشتری فعال شود؟' : 'دریافت پیامک برای این مشتری غیرفعال شود؟', async () => {
          try {
            await sellerApiFetch(`/customers/${customerId}`, { method: 'PATCH', body: JSON.stringify({ smsOptIn: nextValue }) });
            await loadAll();
            toast('وضعیت پیامک به‌روزرسانی شد');
            router();
          } catch (error) { toast(error.message); }
        });
      });
      listEl.querySelector('#addSmsHistory').addEventListener('click', () => openSmsLogForm(customerId, () => renderSmsTab(listEl, customerId)));
    } catch (error) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state__desc">${esc(error.message || 'خطا در دریافت پیامک‌ها')}</div></div>`;
    }
  }

  const previousCustomerDetail = typeof renderCustomerDetail === 'function' ? renderCustomerDetail : null;
  if (previousCustomerDetail) {
    renderCustomerDetail = function (view, id, tab) {
      const requestedTab = ['sales', 'payments', 'conversations', 'timeline', 'sms'].includes(tab) ? tab : 'sales';
      previousCustomerDetail(view, id, ['timeline', 'sms'].includes(requestedTab) ? 'sales' : requestedTab);
      const customer = customerById(id);
      const tabs = view.querySelector('.tabs');
      const listEl = view.querySelector('#detailList');
      if (!customer || !tabs || !listEl) return;

      tabs.querySelectorAll('button').forEach((button) => button.classList.remove('active'));
      const originalActive = tabs.querySelector(`[data-tab="${requestedTab}"]`);
      if (originalActive) originalActive.classList.add('active');
      tabs.insertAdjacentHTML('beforeend', `<button data-crm-tab="timeline" class="${requestedTab === 'timeline' ? 'active' : ''}">Timeline</button><button data-crm-tab="sms" class="${requestedTab === 'sms' ? 'active' : ''}">پیامک‌ها</button>`);
      tabs.querySelectorAll('[data-crm-tab]').forEach((button) => button.addEventListener('click', () => { location.hash = `#/customer-detail/${id}/${button.dataset.crmTab}`; }));

      const master = view.querySelector('.customer-master-card');
      if (master && !view.querySelector('.customer-metrics-grid')) master.insertAdjacentHTML('afterend', metricsHTML(customerMetricsLocal(id)));
      decorateCustomerContexts(view);
      if (requestedTab === 'timeline') renderTimelineTab(listEl, id);
      if (requestedTab === 'sms') renderSmsTab(listEl, id);
    };
  }

  ['renderCustomers', 'renderSales', 'renderConversations'].forEach((name) => {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function () {
      const result = original.apply(this, arguments);
      const root = arguments[0] && arguments[0].querySelectorAll ? arguments[0] : document;
      decorateCustomerContexts(root);
      return result;
    };
  });

  openCustomerForm = function (id) {
    const rec = id ? customerById(id) : null;
    const formData = rec ? { ...rec } : { firstName: '', lastName: '', phone: '', email: '', address: '', nextFollowUp: null, status: 'جدید', tags: [], smsOptIn: false };
    const html = `
      <div class="modal__handle"></div>
      <h3 class="modal__title">${rec ? 'ویرایش مشتری' : 'مشتری جدید'}</h3>
      <form id="crmCustomerForm">
        <div class="field-row"><div class="field"><label>نام *</label><input name="firstName" required value="${esc(formData.firstName || '')}"></div><div class="field"><label>نام خانوادگی *</label><input name="lastName" required value="${esc(formData.lastName || '')}"></div></div>
        <div class="field"><label>شماره تماس *</label><input name="phone" inputmode="tel" required value="${esc(formData.phone || '')}"></div>
        <div class="field"><label>ایمیل</label><input name="email" type="email" maxlength="320" value="${esc(formData.email || '')}" placeholder="اختیاری"></div>
        <div class="field"><label>آدرس</label><textarea name="address">${esc(formData.address || '')}</textarea></div>
        ${dateFieldHTML('nextFollowUp', formData.nextFollowUp, 'پیگیری بعدی')}
        <div class="field"><label>وضعیت</label><select name="status">${STATUS_LIST.map((status) => `<option value="${esc(status)}" ${formData.status === status ? 'selected' : ''}>${esc(status)}</option>`).join('')}</select></div>
        <label style="display:flex;align-items:flex-start;gap:8px;margin:12px 0;line-height:1.8;"><input id="crmCustomerSmsOptIn" type="checkbox" style="width:auto;margin-top:5px;" ${formData.smsOptIn ? 'checked' : ''}><span><strong>مجاز به دریافت پیامک</strong><br><small style="color:var(--ink-soft);">این وضعیت در Timeline ثبت می‌شود و بعداً سرویس پیامکی از آن استفاده می‌کند.</small></span></label>
        <div class="field"><label>برچسب‌ها</label><div class="tag-input" id="crmTagInput"><div class="tag-input__chips" id="crmTagChips"></div><input type="text" id="crmTagText" placeholder="برچسب را بنویسید و Enter بزنید"></div></div>
        <div class="modal__actions"><button type="button" class="btn secondary block" data-close-modal>انصراف</button><button type="submit" class="btn primary block">${ic('check')}ذخیره</button></div>
      </form>`;
    const wrap = openModal(html);
    const form = wrap.querySelector('#crmCustomerForm');
    initDateFields(wrap, formData);
    const tags = Array.isArray(formData.tags) ? [...formData.tags] : [];
    const chipsEl = wrap.querySelector('#crmTagChips');
    const tagInput = wrap.querySelector('#crmTagText');
    function renderTags() {
      chipsEl.innerHTML = tags.map((tag, index) => `<span class="tag-chip">${esc(tag)}<button type="button" data-rm-tag="${index}">${ic('x')}</button></span>`).join('');
      chipsEl.querySelectorAll('[data-rm-tag]').forEach((button) => button.addEventListener('click', () => { tags.splice(Number(button.dataset.rmTag), 1); renderTags(); }));
    }
    renderTags();
    tagInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ',') return;
      event.preventDefault();
      const value = tagInput.value.trim().replace(/,$/, '');
      if (value && !tags.includes(value)) tags.push(value);
      tagInput.value = '';
      renderTags();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const fd = new FormData(form);
      const phone = fd.get('phone').trim();
      if (!isValidIranPhone(phone)) return toast('شماره تماس معتبر نیست — باید با ۰۹ شروع شود و ۱۱ رقم باشد');
      const pendingTag = tagInput.value.trim();
      if (pendingTag && !tags.includes(pendingTag)) tags.push(pendingTag);
      const payload = {
        firstName: fd.get('firstName').trim(),
        lastName: fd.get('lastName').trim(),
        phone,
        email: fd.get('email').trim(),
        address: fd.get('address').trim(),
        status: fd.get('status'),
        nextFollowUp: formData.nextFollowUp || null,
        tags,
        smsOptIn: wrap.querySelector('#crmCustomerSmsOptIn').checked,
      };
      try {
        let result;
        if (rec) result = await sellerApiFetch(`/customers/${rec.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        else result = await sellerApiFetch('/customers', { method: 'POST', body: JSON.stringify(payload) });
        await loadAll();
        closeModal();
        toast(!rec && result && result.mergedExisting ? 'این شماره از قبل وجود داشت؛ اطلاعات به همان پروفایل متصل شد' : (rec ? 'مشتری ویرایش شد' : 'مشتری اضافه شد'));
        router();
      } catch (error) { toast(error.message); }
    });
  };

  window.addEventListener('load', async () => {
    const key = 'crm-customer-dedupe-v1';
    if (sessionStorage.getItem(key) === 'done') return;
    try {
      const result = await sellerApiFetch('/customers/dedupe', { method: 'POST' });
      sessionStorage.setItem(key, 'done');
      if (result && result.mergedRecords > 0) {
        await loadAll();
        toast(`${faDigits(result.mergedRecords)} مخاطب تکراری به پروفایل اصلی متصل شد`);
        router();
      }
    } catch (error) {
      console.warn('Customer dedupe skipped:', error && error.message ? error.message : error);
    }
  });
})();
