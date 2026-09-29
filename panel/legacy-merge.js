/* Phase 4A: safe legacy capability merge for the unified seller panel.
   No local database is restored here. All views use the current backend-backed state. */
(function () {
  'use strict';

  if (typeof state === 'undefined' || typeof sellerApiFetch !== 'function') return;

  const FOLLOWUP_ROUTE = 'followups';
  const PRODUCT_DETAIL_ROUTE = 'product-detail';
  const ONBOARDING_KEY = 'crm-panel-onboarding-v2';

  function productImage(product) {
    if (typeof getProductImageUrl === 'function') return getProductImageUrl(product);
    const media = Array.isArray(product && product.media) ? product.media : [];
    const image = media.find((item) => item && item.kind === 'image' && item.url);
    return image ? image.url : '';
  }

  function customerForSale(sale) {
    return sale && sale.customer ? sale.customer : byId(state.customers, Number(sale && sale.customerId));
  }

  function customerName(customer) {
    return customer ? customerFullName(customer) : 'بدون مشتری';
  }

  function followupRows() {
    const customerRows = (state.customers || [])
      .filter((customer) => customer.nextFollowUp)
      .map((customer) => ({
        key: `customer-${customer.id}`,
        kind: 'customer',
        date: customer.nextFollowUp,
        customerId: customer.id,
        title: customerFullName(customer) || 'مشتری بدون نام',
        subtitle: customer.phone || 'شماره تماس ثبت نشده',
        status: customer.status || 'جدید',
      }));

    const conversationRows = (state.conversations || [])
      .filter((conversation) => conversation.status === 'open' && conversation.nextFollowUp)
      .map((conversation) => {
        const customer = conversation.customer || byId(state.customers, Number(conversation.customerId));
        return {
          key: `conversation-${conversation.id}`,
          kind: 'conversation',
          date: conversation.nextFollowUp,
          customerId: conversation.customerId,
          conversationId: conversation.id,
          title: customerName(customer),
          subtitle: conversation.notes || 'پیگیری گفتگو',
          status: 'گفتگوی باز',
        };
      });

    return customerRows.concat(conversationRows).sort((a, b) => {
      const dateCompare = String(a.date || '').localeCompare(String(b.date || ''));
      if (dateCompare) return dateCompare;
      return a.kind.localeCompare(b.kind);
    });
  }

  function followupFilterLabel(mode) {
    const labels = { all: 'همه', overdue: 'عقب‌افتاده', today: 'امروز', week: 'این هفته', upcoming: 'آینده' };
    return labels[mode] || labels.all;
  }

  function filterFollowups(rows, mode) {
    const today = todayISO();
    const week = weekRangeISO(today);
    if (mode === 'overdue') return rows.filter((row) => row.date < today);
    if (mode === 'today') return rows.filter((row) => row.date === today);
    if (mode === 'week') return rows.filter((row) => row.date >= week.start && row.date <= week.end);
    if (mode === 'upcoming') return rows.filter((row) => row.date > today);
    return rows;
  }

  function followupDateClass(date) {
    const today = todayISO();
    if (date < today) return 'is-overdue';
    if (date === today) return 'is-today';
    return 'is-upcoming';
  }

  function followupCardHTML(row) {
    const isConversation = row.kind === 'conversation';
    return `
      <article class="legacy-followup-card ${followupDateClass(row.date)}" data-followup-key="${esc(row.key)}">
        <div class="legacy-followup-date">
          <span>${ic(isConversation ? 'chat' : 'users')}</span>
          <strong>${formatJalaliDisplay(row.date)}</strong>
        </div>
        <div class="legacy-followup-main">
          <div class="legacy-followup-title-row">
            <strong>${esc(row.title)}</strong>
            <span class="legacy-followup-kind">${isConversation ? 'گفتگو' : 'مشتری'}</span>
          </div>
          <div class="legacy-followup-sub">${esc(row.subtitle)}</div>
          <div class="legacy-followup-status">${esc(row.status)}</div>
        </div>
        <div class="legacy-followup-actions">
          <button type="button" class="btn secondary" data-followup-profile="${row.customerId}">${ic('users')}پروفایل</button>
          ${isConversation
            ? `<button type="button" class="btn primary" data-followup-done="${row.conversationId}">${ic('check')}انجام شد</button>`
            : `<button type="button" class="btn primary" data-followup-edit="${row.customerId}">${ic('edit')}ویرایش پیگیری</button>`}
        </div>
      </article>`;
  }

  function renderFollowups(view, mode) {
    const normalizedMode = ['all', 'overdue', 'today', 'week', 'upcoming'].includes(mode) ? mode : 'all';
    const allRows = followupRows();
    const rows = filterFollowups(allRows, normalizedMode);
    const today = todayISO();
    const overdueCount = allRows.filter((row) => row.date < today).length;
    const todayCount = allRows.filter((row) => row.date === today).length;

    view.innerHTML = `
      <div class="legacy-page-head">
        <div>
          <h2>${ic('clock')} مرکز پیگیری</h2>
          <p>پیگیری مشتریان و گفتگوها از داده‌های واقعی CRM</p>
        </div>
        <div class="legacy-page-head__stats">
          <span><b>${faDigits(todayCount)}</b> امروز</span>
          <span class="${overdueCount ? 'danger' : ''}"><b>${faDigits(overdueCount)}</b> عقب‌افتاده</span>
        </div>
      </div>
      <div class="legacy-filter-tabs" role="navigation" aria-label="فیلتر پیگیری‌ها">
        ${['all', 'overdue', 'today', 'week', 'upcoming'].map((key) => `<button type="button" class="chip ${normalizedMode === key ? 'active' : ''}" data-followup-filter="${key}">${followupFilterLabel(key)}</button>`).join('')}
      </div>
      <div class="legacy-followup-summary">${faDigits(rows.length)} مورد در «${followupFilterLabel(normalizedMode)}»</div>
      <div class="legacy-followup-list">
        ${rows.length ? rows.map(followupCardHTML).join('') : `<div class="empty-state">${ic('check')}<div class="empty-state__title">پیگیری‌ای در این بخش نیست</div><div class="empty-state__desc">با ثبت تاریخ پیگیری برای مشتری یا گفتگو، مورد جدید اینجا نمایش داده می‌شود.</div></div>`}
      </div>`;

    view.querySelectorAll('[data-followup-filter]').forEach((button) => {
      button.addEventListener('click', () => { location.hash = `#/${FOLLOWUP_ROUTE}/${button.dataset.followupFilter}`; });
    });
    view.querySelectorAll('[data-followup-profile]').forEach((button) => {
      button.addEventListener('click', () => { location.hash = `#/customer-detail/${button.dataset.followupProfile}/conversations`; });
    });
    view.querySelectorAll('[data-followup-edit]').forEach((button) => {
      button.addEventListener('click', () => openCustomerForm(Number(button.dataset.followupEdit)));
    });
    view.querySelectorAll('[data-followup-done]').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          await toggleConversationStatus(Number(button.dataset.followupDone));
        } finally {
          button.disabled = false;
        }
      });
    });
  }

  function productSales(productId) {
    return (state.sales || [])
      .filter((sale) => Number(sale.productId) === Number(productId))
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')) || Number(b.id || 0) - Number(a.id || 0));
  }

  function productRevenue(productId) {
    return productSales(productId).reduce((sum, sale) => sum + Number(sale.price || 0), 0);
  }

  function productMediaHTML(product) {
    const media = Array.isArray(product.media) ? product.media : [];
    if (!media.length) return '<div class="legacy-media-empty">رسانه‌ای برای این محصول ثبت نشده است.</div>';
    return `<div class="legacy-product-media">${media.slice(0, 8).map((item) => {
      const url = esc(item.url || '');
      if (item.kind === 'video') return `<video src="${url}" muted controls playsinline preload="metadata"></video>`;
      return `<img src="${url}" alt="تصویر ${esc(product.name)}" loading="lazy">`;
    }).join('')}</div>`;
  }

  function renderProductDetail(view, productId) {
    const product = byId(state.products, Number(productId));
    if (!product) { location.hash = '#/products'; return; }
    const sales = productSales(product.id);
    const revenue = productRevenue(product.id);
    const average = sales.length ? Math.round(revenue / sales.length) : 0;
    const lastSale = sales[0] || null;
    const status = productStatusInfo(product);
    const imageUrl = productImage(product);

    view.innerHTML = `
      <div class="detail-header legacy-product-detail-head">
        <button class="back-btn" id="legacyProductBackBtn">${ic('chevR')}</button>
        <div class="legacy-product-detail-title">
          ${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(product.name)}">` : `<span class="legacy-product-detail-placeholder">${ic('box')}</span>`}
          <div><h3>${esc(product.name)}</h3><div>${fmtId('PR', product.id)}${product.category ? ` · ${esc(product.category.name)}` : ''}</div></div>
        </div>
        <button type="button" class="btn primary" id="legacyProductEditBtn">${ic('edit')}ویرایش</button>
      </div>
      <div class="legacy-kpi-grid">
        <div class="legacy-kpi"><span>تعداد فروش</span><strong>${faDigits(sales.length)}</strong></div>
        <div class="legacy-kpi"><span>درآمد ثبت‌شده</span><strong>${fmtPrice(revenue)}</strong></div>
        <div class="legacy-kpi"><span>میانگین فروش</span><strong>${fmtPrice(average)}</strong></div>
        <div class="legacy-kpi"><span>موجودی</span><strong>${faDigits(product.stockQty || 0)}</strong></div>
      </div>
      <div class="legacy-product-info-grid">
        <div class="legacy-info-card"><span>وضعیت</span><strong class="badge ${status.cls}">${esc(status.label)}</strong></div>
        <div class="legacy-info-card"><span>قیمت فروش</span><strong>${fmtProductPrice(product)}</strong></div>
        <div class="legacy-info-card"><span>حد هشدار موجودی</span><strong>${faDigits(product.lowStockAt || 0)}</strong></div>
        <div class="legacy-info-card"><span>آخرین فروش</span><strong>${lastSale ? formatJalaliDisplay(lastSale.date) : '—'}</strong></div>
      </div>
      <div class="section-title">${ic('box')} رسانه محصول</div>
      ${productMediaHTML(product)}
      <div class="section-title">${ic('cart')} آخرین فروش‌ها<span class="cnt">${faDigits(sales.length)}</span></div>
      <div class="legacy-product-sales">
        ${sales.length ? sales.slice(0, 12).map((sale) => {
          const customer = customerForSale(sale);
          return `<button type="button" class="legacy-sale-row" ${customer ? `data-sale-customer="${customer.id}"` : ''}><span><strong>${esc(customerName(customer))}</strong><small>${formatJalaliDisplay(sale.date)}</small></span><b>${fmtPrice(sale.price)}</b>${customer ? ic('chevL') : ''}</button>`;
        }).join('') : `<div class="empty-state">${ic('cart')}<div class="empty-state__desc">هنوز فروشی برای این محصول ثبت نشده است.</div></div>`}
      </div>`;

    view.querySelector('#legacyProductBackBtn').addEventListener('click', () => { location.hash = '#/products'; });
    view.querySelector('#legacyProductEditBtn').addEventListener('click', () => openProductForm(product.id));
    view.querySelectorAll('[data-sale-customer]').forEach((row) => {
      row.addEventListener('click', () => { location.hash = `#/customer-detail/${row.dataset.saleCustomer}/sales`; });
    });
  }

  const originalRenderProducts = typeof renderProducts === 'function' ? renderProducts : null;
  if (originalRenderProducts) {
    renderProducts = function (view) {
      const filters = state.filters.products || (state.filters.products = { categoryId: '' });
      view.innerHTML = `
        <div class="toolbar">
          <div class="search-box">${ic('search')}<input id="prodSearch" placeholder="جستجوی نام محصول"></div>
          <button class="tbtn tbtn-add" id="prodAddBtn">${ic('plus')}<span>افزودن</span></button>
        </div>
        ${state.categories.length ? `<div class="filter-chips" id="prodCatChips"><button class="chip ${!filters.categoryId ? 'active' : ''}" data-v="">همه</button>${state.categories.map((category) => `<button class="chip ${Number(filters.categoryId) === Number(category.id) ? 'active' : ''}" data-v="${category.id}">${esc(category.name)}</button>`).join('')}</div>` : ''}
        <div class="list" id="prodList"></div>`;

      function drawProducts() {
        let list = state.products.slice();
        if (filters.categoryId) list = list.filter((product) => Number(product.categoryId) === Number(filters.categoryId));
        const q = view.querySelector('#prodSearch').value.trim();
        if (q) list = list.filter((product) => String(product.name || '').includes(q));
        list.sort((a, b) => Number(b.id) - Number(a.id));
        const listEl = view.querySelector('#prodList');
        listEl.innerHTML = list.length ? list.map((product) => {
          const status = productStatusInfo(product);
          const imageUrl = productImage(product);
          return `<article class="rec-card legacy-product-row" data-prod-detail="${product.id}"><div class="legacy-product-row__media">${imageUrl ? `<img src="${esc(imageUrl)}" alt="${esc(product.name)}" loading="lazy">` : ic('box')}</div><div class="rec-card__body"><div class="rec-card__top"><span class="rec-card__title">${esc(product.name)}</span><span class="badge ${status.cls}">${esc(status.label)}</span></div><div class="rec-card__id">${fmtId('PR', product.id)}${product.category ? ` · ${esc(product.category.name)}` : ''}</div><div class="rec-card__meta"><span>${ic('wallet')}${fmtProductPrice(product)}</span><span>${ic('box')}موجودی: ${faDigits(product.stockQty || 0)}</span></div></div><div class="legacy-product-row__actions"><button type="button" class="btn secondary" data-edit-prod="${product.id}">${ic('edit')}ویرایش</button><button type="button" class="legacy-product-open" aria-label="مشاهده تحلیل محصول">${ic('chevL')}</button></div></article>`;
        }).join('') : `<div class="empty-state">${ic('box')}<div class="empty-state__title">محصولی یافت نشد</div><div class="empty-state__desc">با دکمه + یک محصول جدید اضافه کن</div></div>`;

        listEl.querySelectorAll('[data-prod-detail]').forEach((row) => {
          row.addEventListener('click', (event) => {
            if (event.target.closest('[data-edit-prod]')) return;
            location.hash = `#/${PRODUCT_DETAIL_ROUTE}/${row.dataset.prodDetail}`;
          });
        });
        listEl.querySelectorAll('[data-edit-prod]').forEach((button) => {
          button.addEventListener('click', (event) => {
            event.stopPropagation();
            openProductForm(Number(button.dataset.editProd));
          });
        });
      }

      drawProducts();
      view.querySelector('#prodSearch').addEventListener('input', drawProducts);
      view.querySelector('#prodAddBtn').addEventListener('click', () => openProductForm());
      const chips = view.querySelector('#prodCatChips');
      if (chips) chips.querySelectorAll('.chip').forEach((chip) => chip.addEventListener('click', () => {
        filters.categoryId = chip.dataset.v ? Number(chip.dataset.v) : '';
        renderProducts(view);
      }));
    };
  }

  function jalaliMonthBuckets(count) {
    const todayJ = isoToJalali(todayISO());
    const buckets = [];
    let jy = todayJ.jy;
    let jm = todayJ.jm;
    for (let i = 0; i < count; i += 1) {
      buckets.unshift({ jy, jm, label: MONTHS_FA[jm - 1], total: 0, count: 0 });
      jm -= 1;
      if (jm < 1) { jm = 12; jy -= 1; }
    }
    (state.sales || []).forEach((sale) => {
      if (!sale.date) return;
      const j = isoToJalali(sale.date);
      const bucket = buckets.find((item) => item.jy === j.jy && item.jm === j.jm);
      if (!bucket) return;
      bucket.total += Number(sale.price || 0);
      bucket.count += 1;
    });
    return buckets;
  }

  function reportEnhancementHTML() {
    const months = jalaliMonthBuckets(6);
    const max = Math.max(1, ...months.map((month) => month.total));
    const productMap = new Map();
    (state.sales || []).forEach((sale) => {
      if (!sale.productId) return;
      const current = productMap.get(Number(sale.productId)) || { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += Number(sale.price || 0);
      productMap.set(Number(sale.productId), current);
    });
    const products = Array.from(productMap.entries()).map(([id, metrics]) => ({ product: byId(state.products, id), ...metrics })).filter((item) => item.product).sort((a, b) => b.revenue - a.revenue).slice(0, 8);
    const salesTotal = (state.sales || []).reduce((sum, sale) => sum + Number(sale.price || 0), 0);
    const averageSale = state.sales.length ? Math.round(salesTotal / state.sales.length) : 0;

    return `<section class="legacy-report-section"><div class="section-title">${ic('calendar')} روند درآمد ۶ ماه اخیر</div><div class="legacy-month-chart">${months.map((month) => { const height = month.total ? Math.max(8, Math.round((month.total / max) * 100)) : 3; return `<div class="legacy-month-bar"><div class="legacy-month-bar__track"><span style="height:${height}%"></span></div><strong>${esc(month.label)}</strong><small>${faDigits(month.count)} فروش</small></div>`; }).join('')}</div><div class="legacy-report-inline-kpis"><span><b>${fmtPrice(salesTotal)}</b> فروش ثبت‌شده کل</span><span><b>${fmtPrice(averageSale)}</b> میانگین هر فروش</span></div></section><section class="legacy-report-section"><div class="section-title">${ic('star')} عملکرد محصولات</div><div class="legacy-product-performance">${products.length ? products.map((item, index) => `<button type="button" data-report-product="${item.product.id}"><span class="rank">${faDigits(index + 1)}</span><span class="name">${esc(item.product.name)}<small>${faDigits(item.count)} فروش</small></span><strong>${fmtPrice(item.revenue)}</strong>${ic('chevL')}</button>`).join('') : '<div class="empty-state"><div class="empty-state__desc">هنوز داده فروش محصولی ثبت نشده است.</div></div>'}</div></section>`;
  }

  const originalRenderReports = typeof renderReports === 'function' ? renderReports : null;
  if (originalRenderReports) {
    renderReports = function (view) {
      originalRenderReports(view);
      view.insertAdjacentHTML('beforeend', reportEnhancementHTML());
      view.querySelectorAll('[data-report-product]').forEach((button) => {
        button.addEventListener('click', () => { location.hash = `#/${PRODUCT_DETAIL_ROUTE}/${button.dataset.reportProduct}`; });
      });
    };
  }

  function onboardingSteps() {
    return [
      { icon: 'spark', title: 'مرکز کنترل کسب‌وکار', text: 'داشبورد، واریزی‌ها، فروش و پیگیری‌های روزانه در یک پنل و با داده‌های Backend واقعی مدیریت می‌شوند.' },
      { icon: 'clock', title: 'مرکز پیگیری', text: 'پیگیری مشتری و گفتگوی باز را از یک صفحه ببین و موارد امروز، عقب‌افتاده و آینده را جدا کن.' },
      { icon: 'box', title: 'تحلیل محصول', text: 'روی هر محصول بزن تا فروش، درآمد، موجودی، رسانه و آخرین مشتریان همان محصول را ببینی.' },
      { icon: 'users', title: 'پروفایل یکپارچه مشتری', text: 'خرید، واریزی، گفتگو، پیامک و خط زمانی مشتری در همان پروفایل باقی می‌ماند و چیزی از منطق فعلی حذف نشده است.' },
    ];
  }

  function openLegacyOnboarding(force) {
    if (!force && localStorage.getItem(ONBOARDING_KEY) === 'seen') return;
    const steps = onboardingSteps();
    let index = 0;
    function draw() {
      const step = steps[index];
      const isLast = index === steps.length - 1;
      const html = `<div class="modal__handle"></div><div class="legacy-onboarding"><div class="legacy-onboarding-icon">${ic(step.icon)}</div><div class="legacy-onboarding-step">${faDigits(index + 1)} / ${faDigits(steps.length)}</div><h3>${esc(step.title)}</h3><p>${esc(step.text)}</p><div class="legacy-onboarding-dots">${steps.map((_, i) => `<span class="${i === index ? 'active' : ''}"></span>`).join('')}</div><div class="modal__actions">${index ? '<button type="button" class="btn secondary block" id="legacyGuidePrev">قبلی</button>' : '<button type="button" class="btn secondary block" id="legacyGuideSkip">بستن</button>'}<button type="button" class="btn primary block" id="legacyGuideNext">${isLast ? 'شروع کار' : 'بعدی'}</button></div></div>`;
      const wrap = openModal(html);
      const prev = wrap.querySelector('#legacyGuidePrev');
      if (prev) prev.addEventListener('click', () => { index -= 1; closeModal(); draw(); });
      const skip = wrap.querySelector('#legacyGuideSkip');
      if (skip) skip.addEventListener('click', () => { if (!force) localStorage.setItem(ONBOARDING_KEY, 'seen'); closeModal(); });
      wrap.querySelector('#legacyGuideNext').addEventListener('click', () => {
        if (isLast) { localStorage.setItem(ONBOARDING_KEY, 'seen'); closeModal(); return; }
        index += 1;
        closeModal();
        draw();
      });
    }
    draw();
  }

  const originalRenderSettings = typeof renderSettings === 'function' ? renderSettings : null;
  if (originalRenderSettings) {
    renderSettings = function (view) {
      originalRenderSettings(view);
      const tools = document.createElement('div');
      tools.className = 'settings-group legacy-settings-group';
      tools.innerHTML = `<div class="settings-group__title">ابزارهای CRM</div><a href="#/${FOLLOWUP_ROUTE}/all" class="settings-row"><div class="settings-row__icon">${ic('clock')}</div><div class="settings-row__text"><div class="settings-row__title">مرکز پیگیری</div><div class="settings-row__desc">پیگیری مشتریان و گفتگوهای باز</div></div><div class="settings-row__chev">${ic('chevL')}</div></a><button type="button" class="settings-row settings-action-btn" id="legacyGuideBtn"><div class="settings-row__icon">${ic('spark')}</div><div class="settings-row__text"><div class="settings-row__title">راهنمای پنل</div><div class="settings-row__desc">نمایش دوباره راهنمای قابلیت‌های اصلی</div></div><div class="settings-row__chev">${ic('chevL')}</div></button>`;
      view.appendChild(tools);
      const guide = view.querySelector('#legacyGuideBtn');
      if (guide) guide.addEventListener('click', () => openLegacyOnboarding(true));
    };
  }

  const originalGoDashboardShortcut = typeof goDashboardShortcut === 'function' ? goDashboardShortcut : null;
  if (originalGoDashboardShortcut) {
    goDashboardShortcut = function (key) {
      if (key === 'followup-today') { location.hash = `#/${FOLLOWUP_ROUTE}/today`; return; }
      if (key === 'followup-week') { location.hash = `#/${FOLLOWUP_ROUTE}/week`; return; }
      originalGoDashboardShortcut(key);
    };
  }

  const originalRenderDashboard = typeof renderDashboard === 'function' ? renderDashboard : null;
  if (originalRenderDashboard) {
    renderDashboard = function (view) {
      originalRenderDashboard(view);
      const rows = followupRows();
      const today = todayISO();
      const week = weekRangeISO(today);
      const todayCount = rows.filter((row) => row.date === today).length;
      const weekCount = rows.filter((row) => row.date >= week.start && row.date <= week.end).length;
      const todayCard = view.querySelector('[data-go="followup-today"] .dash-card__value');
      const weekCard = view.querySelector('[data-go="followup-week"] .dash-card__value');
      if (todayCard) todayCard.textContent = faDigits(todayCount);
      if (weekCard) weekCard.textContent = faDigits(weekCount);
      const remindersTitle = Array.from(view.querySelectorAll('.section-title')).find((el) => String(el.textContent || '').includes('یادآوری‌های امروز'));
      if (remindersTitle && !view.querySelector('.legacy-followup-link')) remindersTitle.insertAdjacentHTML('beforeend', `<a class="legacy-followup-link" href="#/${FOLLOWUP_ROUTE}/today">مشاهده مرکز پیگیری</a>`);
      setTimeout(() => openLegacyOnboarding(false), 0);
    };
  }

  const baseRouter = typeof router === 'function' ? router : null;
  if (baseRouter) {
    window.removeEventListener('hashchange', baseRouter);
    router = function () {
      const raw = location.hash.replace(/^#\/?/, '');
      const parts = raw.split('/').filter(Boolean);
      const name = parts[0] || 'dashboard';
      const view = document.getElementById('view');
      if (name === FOLLOWUP_ROUTE) {
        renderNav('dashboard');
        view.scrollTop = 0;
        renderFollowups(view, parts[1] || 'all');
        return;
      }
      if (name === PRODUCT_DETAIL_ROUTE) {
        renderNav('products');
        view.scrollTop = 0;
        renderProductDetail(view, Number(parts[1]));
        return;
      }
      baseRouter();
    };
    window.addEventListener('hashchange', router);
  }
})();
