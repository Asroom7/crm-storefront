/* Block-based storefront runtime shared by the public Home and seller Preview. */
(function () {
  'use strict';

  const root = document.getElementById('storefront-home-root');
  if (!root) return;

  const DEFAULT_HOME_LAYOUT = [
    { key: 'search', type: 'search', enabled: true, content: { placeholder: 'دنبال چه محصولی می‌گردی؟' }, settings: {} },
    { key: 'hero', type: 'hero', enabled: true, content: { eyebrow: 'BEAUTY · CARE · YOU', title: 'روتین زیبایی، ساده‌تر و انتخاب‌شده‌تر', description: 'محصولات مراقبتی و زیبایی را مرتب، سریع و با اطلاعات روشن پیدا کن و سفارش را از همین فروشگاه پیگیری کن.', primaryLabel: 'مشاهده محصولات', primaryUrl: 'products.html', secondaryLabel: 'دسته‌بندی‌ها', secondaryUrl: '#sf-categories' }, settings: {} },
    { key: 'categories', type: 'categories', enabled: true, content: { title: 'دسته‌بندی‌ها', subtitle: 'شروع سریع از چیزی که لازم داری' }, settings: { limit: 6 } },
    { key: 'featured', type: 'product-collection', enabled: true, content: { title: 'تازه‌های فروشگاه', subtitle: 'محصولات جدیدی که به فروشگاه اضافه شده‌اند' }, settings: { limit: 8 } },
    { key: 'videos', type: 'videos', enabled: true, content: { title: 'جعبه جادویی', subtitle: 'ویدئوهای واقعی محصولات و مسیر سریع برای دیدن جزئیات' }, settings: { limit: 3 } },
    { key: 'support', type: 'support-banner', enabled: true, content: { eyebrow: 'برای انتخاب مطمئن‌تر', title: 'پشتیبانی فروشگاه کنار توست', description: 'برای سؤال درباره محصول، سفارش یا روند خرید از راه ارتباطی فعال فروشگاه استفاده کن.', ctaLabel: 'ارتباط با پشتیبانی' }, settings: {} },
    { key: 'trust', type: 'trust', enabled: true, content: {}, settings: {} },
    { key: 'footer', type: 'footer', enabled: true, content: { description: 'فروشگاه آنلاین محصولات مراقبتی و زیبایی با مسیر ساده از انتخاب تا پیگیری سفارش.' }, settings: {} },
  ];

  const HOME_SECTION_REGISTRY = Object.create(null);
  const categoryGlyphs = ['✦', '◌', '◇', '○', '✧', '◈'];

  function registerSection(type, renderer) { HOME_SECTION_REGISTRY[type] = renderer; }
  function cloneDefaultLayout() { return JSON.parse(JSON.stringify(DEFAULT_HOME_LAYOUT)); }

  function safeExternalUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(String(value), window.location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (error) { return ''; }
  }

  function safeInternalUrl(value, fallback) {
    const raw = String(value || '').trim();
    if (!raw) return fallback || 'products.html';
    if (raw.startsWith('#')) return raw;
    if (raw.startsWith('//') || raw.includes('..') || /^(?:[a-z]+:)?\/\//i.test(raw)) return fallback || 'products.html';
    return /^[\w./?=&%+#-]+$/.test(raw) ? raw : (fallback || 'products.html');
  }

  function productCategoryName(product) {
    return product && product.category && product.category.name ? String(product.category.name) : 'بدون دسته‌بندی';
  }

  function productAvailability(product) {
    const stock = Number(product && product.stockQty || 0);
    const low = Number(product && product.lowStockAt || 0);
    if (stock <= 0) return { label: 'ناموجود', cls: 'is-out' };
    if (low > 0 && stock <= low) return { label: 'رو به اتمام', cls: 'is-low' };
    return { label: 'موجود', cls: 'is-in' };
  }

  function firstCategoryProductImage(categoryId, products) {
    const product = (products || []).find(function (item) {
      return Number(item.categoryId || (item.category && item.category.id)) === Number(categoryId) && getProductImageUrl(item);
    });
    return product ? getProductImageUrl(product) : '';
  }

  function productCard(product) {
    const imageUrl = getProductImageUrl(product);
    const availability = productAvailability(product);
    return '<a class="sf-product-card" href="product-detail.html?id=' + encodeURIComponent(product.id) + '">' +
      '<div class="sf-product-media">' +
        (imageUrl ? '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" decoding="async">' : '<span class="sf-product-placeholder" aria-hidden="true">✦</span>') +
        '<span class="sf-stock-badge ' + availability.cls + '">' + availability.label + '</span>' +
      '</div><div class="sf-product-body"><span class="sf-product-category">' + escapeHtml(productCategoryName(product)) + '</span><h3>' + escapeHtml(product.name) + '</h3><div class="sf-product-price">' + escapeHtml(getProductPriceLabel(product)) + '</div></div></a>';
  }

  function sectionHead(title, subtitle, href, linkText) {
    return '<div class="sf-section-head"><div><h2>' + escapeHtml(title) + '</h2>' + (subtitle ? '<p>' + escapeHtml(subtitle) + '</p>' : '') + '</div>' +
      (href ? '<a href="' + escapeHtml(href) + '">' + escapeHtml(linkText || 'مشاهده همه') + '<span aria-hidden="true">‹</span></a>' : '') + '</div>';
  }

  registerSection('search', function (block, ctx) {
    const content = block.content || {};
    const chips = ['<a class="sf-nav-chip is-primary" href="products.html">همه محصولات</a>'].concat((ctx.categories || []).slice(0, 8).map(function (category) {
      return '<a class="sf-nav-chip" href="products.html?category=' + encodeURIComponent(category.id) + '">' + escapeHtml(category.name) + '</a>';
    })).join('');
    return '<section class="sf-search-block sf-container" aria-label="جستجو و دسته‌بندی"><form class="sf-search-form" action="products.html" method="get" role="search"><button type="submit" aria-label="جستجو"><span aria-hidden="true">⌕</span></button><input type="search" name="q" placeholder="' + escapeHtml(content.placeholder || 'دنبال چه محصولی می‌گردی؟') + '" autocomplete="off" aria-label="جستجوی محصولات"></form><div class="sf-chip-strip" aria-label="دسترسی سریع به دسته‌بندی‌ها">' + chips + '</div></section>';
  });

  registerSection('hero', function (block, ctx) {
    const content = block.content || {};
    const heroProduct = (ctx.products || []).find(function (product) { return getProductImageUrl(product); }) || (ctx.products || [])[0];
    const imageUrl = heroProduct ? getProductImageUrl(heroProduct) : '';
    const primaryUrl = safeInternalUrl(content.primaryUrl, 'products.html');
    const secondaryUrl = safeInternalUrl(content.secondaryUrl, '#sf-categories');
    return '<section class="sf-hero sf-container" aria-label="معرفی فروشگاه"><div class="sf-hero-panel"><div class="sf-hero-copy"><span class="sf-eyebrow">' + escapeHtml(content.eyebrow || 'BEAUTY · CARE · YOU') + '</span><h1>' + escapeHtml(content.title || 'روتین زیبایی، ساده‌تر و انتخاب‌شده‌تر') + '</h1><p>' + escapeHtml(content.description || '') + '</p><div class="sf-hero-actions"><a class="sf-btn sf-btn-primary" href="' + escapeHtml(primaryUrl) + '">' + escapeHtml(content.primaryLabel || 'مشاهده محصولات') + '</a><a class="sf-btn sf-btn-ghost" href="' + escapeHtml(secondaryUrl) + '">' + escapeHtml(content.secondaryLabel || 'دسته‌بندی‌ها') + '</a></div></div><div class="sf-hero-art" aria-hidden="true"><span class="sf-hero-orb orb-one"></span><span class="sf-hero-orb orb-two"></span>' +
      (imageUrl ? '<div class="sf-hero-product-frame"><img src="' + escapeHtml(imageUrl) + '" alt="" fetchpriority="high" decoding="async"></div>' : '<div class="sf-hero-monogram">L</div>') + '</div></div></section>';
  });

  registerSection('categories', function (block, ctx) {
    const content = block.content || {};
    const limit = Number(block.settings && block.settings.limit) || 6;
    const categories = (ctx.categories || []).slice(0, Math.min(12, Math.max(1, limit)));
    if (!categories.length) return '';
    return '<section class="sf-section sf-container" id="sf-categories" aria-label="دسته‌بندی محصولات">' + sectionHead(content.title || 'دسته‌بندی‌ها', content.subtitle || '', 'products.html', 'همه دسته‌ها') + '<div class="sf-category-grid">' + categories.map(function (category, index) {
      const image = firstCategoryProductImage(category.id, ctx.products);
      return '<a class="sf-category-card tone-' + ((index % 6) + 1) + '" href="products.html?category=' + encodeURIComponent(category.id) + '"><div class="sf-category-visual">' + (image ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy" decoding="async">' : '<span>' + categoryGlyphs[index % categoryGlyphs.length] + '</span>') + '</div><div class="sf-category-copy"><strong>' + escapeHtml(category.name) + '</strong><span>مشاهده محصولات</span></div></a>';
    }).join('') + '</div></section>';
  });

  registerSection('product-collection', function (block, ctx) {
    const limit = Number(block.settings && block.settings.limit) || 8;
    const products = (ctx.products || []).slice(0, Math.min(20, Math.max(1, limit)));
    if (!products.length) return '';
    const content = block.content || {};
    return '<section class="sf-section sf-container" aria-label="' + escapeHtml(content.title || 'محصولات') + '">' + sectionHead(content.title || 'محصولات', content.subtitle || '', 'products.html', 'مشاهده همه') + '<div class="sf-product-scroll">' + products.map(productCard).join('') + '</div></section>';
  });

  registerSection('videos', function (block, ctx) {
    const limit = Number(block.settings && block.settings.limit) || 3;
    const rows = [];
    (ctx.products || []).forEach(function (product) {
      if (rows.length >= limit) return;
      const videos = Array.isArray(product.media) ? product.media.filter(function (media) { return media && media.kind === 'video' && safeMediaUrl(media.url); }) : [];
      videos.forEach(function (media) { if (rows.length < limit) rows.push({ product: product, media: media }); });
    });
    if (!rows.length) return '';
    const content = block.content || {};
    return '<section class="sf-section sf-video-section sf-container" aria-label="ویدئوهای محصولات">' + sectionHead(content.title || 'جعبه جادویی', content.subtitle || '') + '<div class="sf-video-grid">' + rows.map(function (row) {
      const poster = getProductImageUrl(row.product);
      return '<article class="sf-video-card"><div class="sf-video-media"><video controls muted playsinline preload="none"' + (poster ? ' poster="' + escapeHtml(poster) + '"' : '') + '><source src="' + escapeHtml(safeMediaUrl(row.media.url)) + '"></video></div><div class="sf-video-copy"><span>معرفی محصول</span><h3>' + escapeHtml(row.product.name) + '</h3><a href="product-detail.html?id=' + encodeURIComponent(row.product.id) + '">مشاهده محصول <b aria-hidden="true">‹</b></a></div></article>';
    }).join('') + '</div></section>';
  });

  registerSection('support-banner', function (block, ctx) {
    const content = block.content || {};
    const rubika = safeExternalUrl(ctx.store && ctx.store.seller && ctx.store.seller.supportRubikaUrl);
    const phone = ctx.store && ctx.store.seller && ctx.store.seller.supportPhone ? String(ctx.store.seller.supportPhone) : '';
    if (!rubika && !phone) return '';
    const href = rubika || ('tel:' + phone.replace(/[^+\d]/g, ''));
    const external = rubika ? ' target="_blank" rel="noopener"' : '';
    return '<section class="sf-support-wrap sf-container"><div class="sf-support-banner"><div class="sf-support-icon" aria-hidden="true">♡</div><div><span>' + escapeHtml(content.eyebrow || 'برای انتخاب مطمئن‌تر') + '</span><h2>' + escapeHtml(content.title || 'پشتیبانی فروشگاه کنار توست') + '</h2><p>' + escapeHtml(content.description || '') + '</p></div><a href="' + escapeHtml(href) + '"' + external + '>' + escapeHtml(content.ctaLabel || 'ارتباط با پشتیبانی') + ' <span aria-hidden="true">‹</span></a></div></section>';
  });

  registerSection('trust', function () {
    const items = [['◎', 'پیگیری سفارش', 'وضعیت سفارش از حساب کاربری قابل مشاهده است'], ['◇', 'پرداخت شفاف', 'اطلاعات پرداخت داخل سفارش ثبت و بررسی می‌شود'], ['✦', 'انتخاب مرتب', 'جستجو و دسته‌بندی برای رسیدن سریع‌تر به محصول']];
    return '<section class="sf-trust sf-container" aria-label="مزایای فروشگاه">' + items.map(function (item) { return '<div class="sf-trust-item"><span aria-hidden="true">' + item[0] + '</span><div><strong>' + item[1] + '</strong><p>' + item[2] + '</p></div></div>'; }).join('') + '</section>';
  });

  registerSection('footer', function (block, ctx) {
    const content = block.content || {};
    const seller = ctx.store && ctx.store.seller ? ctx.store.seller : {};
    const brand = seller.brandName || seller.name || 'فروشگاه زیبایی';
    const phone = seller.supportPhone ? String(seller.supportPhone) : '';
    const rubika = safeExternalUrl(seller.supportRubikaUrl);
    return '<footer class="sf-footer"><div class="sf-footer-inner sf-container"><div class="sf-footer-brand"><div class="logo">' + escapeHtml(brand) + '</div><p>' + escapeHtml(content.description || 'فروشگاه آنلاین محصولات مراقبتی و زیبایی با مسیر ساده از انتخاب تا پیگیری سفارش.') + '</p><div class="sf-footer-contact">' +
      (phone ? '<a href="tel:' + escapeHtml(phone.replace(/[^+\d]/g, '')) + '"><span>تلفن پشتیبانی</span><b dir="ltr">' + escapeHtml(phone) + '</b></a>' : '') +
      (rubika ? '<a href="' + escapeHtml(rubika) + '" target="_blank" rel="noopener"><span>پشتیبانی آنلاین</span><b>باز کردن گفتگو</b></a>' : '') +
      '</div></div><div class="sf-footer-links"><details open><summary>خرید و محصولات</summary><a href="products.html">همه محصولات</a><a href="cart.html">سبد خرید</a><a href="profile.html">پیگیری سفارش</a></details><details open><summary>حساب کاربری</summary><a href="login.html">ورود</a><a href="register.html">ثبت‌نام</a><a href="profile.html">حساب من</a></details><details open><summary>فروشگاه</summary><a href="index.html">صفحه نخست</a>' + (rubika ? '<a href="' + escapeHtml(rubika) + '" target="_blank" rel="noopener">پشتیبانی</a>' : '') + '</details></div><div class="sf-footer-bottom"><span>© ' + new Date().getFullYear() + ' ' + escapeHtml(brand) + '</span><a href="#storefront-home-root">بازگشت به بالا ↑</a></div></div></footer>';
  });

  function renderLoading() { root.innerHTML = '<div class="sf-home-loading sf-container" aria-live="polite"><div class="sf-skeleton sf-skeleton-search"></div><div class="sf-skeleton sf-skeleton-hero"></div><div class="sf-skeleton-row"><span></span><span></span><span></span></div></div>'; }
  function renderFallback(message) { root.innerHTML = '<section class="sf-load-error sf-container"><div><strong>فروشگاه در حال حاضر با حالت ساده باز شده است.</strong><p>' + escapeHtml(message || 'بخشی از اطلاعات موقتاً در دسترس نیست.') + '</p><a class="sf-btn sf-btn-primary" href="products.html">مشاهده محصولات</a></div></section>'; }

  function normalizeLayout(sections) {
    return (sections || []).slice().sort(function (a, b) { return Number(a.position || 0) - Number(b.position || 0); }).map(function (section, index) {
      return { key: section.key || section.sectionKey || ('section-' + index), type: section.type, enabled: section.enabled !== false, content: section.content || {}, settings: section.settings || {}, position: Number(section.position == null ? index : section.position) };
    });
  }

  function renderLayout(layout, context) {
    const normalized = normalizeLayout(layout);
    const html = normalized.filter(function (block) { return block && block.enabled !== false; }).map(function (block) {
      const renderer = HOME_SECTION_REGISTRY[block.type];
      if (!renderer) return '';
      try { return renderer(block, context) || ''; } catch (error) { console.error('Storefront section failed:', block.type, error); return ''; }
    }).join('');
    if (!html.trim()) throw new Error('هیچ بخشی برای نمایش آماده نشد');
    root.innerHTML = html;
  }

  function applyTheme(theme) {
    const config = theme && typeof theme === 'object' ? theme : {};
    const style = document.documentElement.style;
    if (config.primaryColor) style.setProperty('--sf-rose', config.primaryColor);
    if (config.accentColor) style.setProperty('--sf-plum', config.accentColor);
    if (config.backgroundColor) style.setProperty('--sf-bg', config.backgroundColor);
    if (config.textColor) style.setProperty('--sf-ink', config.textColor);
    if (Number.isFinite(Number(config.cardRadius))) style.setProperty('--sf-card-radius', Math.max(0, Math.min(48, Number(config.cardRadius))) + 'px');
    if (Number.isFinite(Number(config.borderRadius))) style.setProperty('--sf-radius', Math.max(0, Math.min(40, Number(config.borderRadius))) + 'px');
    if (Number.isFinite(Number(config.containerWidth))) style.setProperty('--sf-container', Math.max(880, Math.min(1600, Number(config.containerWidth))) + 'px');
    if (Number.isFinite(Number(config.sectionSpacing))) style.setProperty('--sf-section-spacing', Math.max(12, Math.min(120, Number(config.sectionSpacing))) + 'px');
    if (Number.isFinite(Number(config.globalPadding))) style.setProperty('--sf-page-padding', Math.max(8, Math.min(64, Number(config.globalPadding))) + 'px');
    document.documentElement.dataset.sfButtonStyle = config.buttonStyle || 'rounded';
    document.documentElement.dataset.sfShadowStyle = config.shadowStyle || 'soft';
  }

  function bindMenu() {
    const toggle = document.querySelector('.menu-toggle'); const closeBtn = document.querySelector('.close-menu'); const overlay = document.querySelector('.side-menu-overlay'); const menu = document.querySelector('.side-menu');
    if (!menu) return;
    function openMenu() { menu.classList.add('open'); if (overlay) overlay.classList.add('open'); }
    function closeMenu() { menu.classList.remove('open'); if (overlay) overlay.classList.remove('open'); }
    if (toggle) { toggle.addEventListener('click', openMenu); toggle.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') openMenu(); }); }
    if (closeBtn) closeBtn.addEventListener('click', closeMenu); if (overlay) overlay.addEventListener('click', closeMenu);
  }

  function safePromise(promise, fallback) { return promise.then(function (value) { return value; }).catch(function () { return fallback; }); }
  async function loadContext() {
    const results = await Promise.all([safePromise(fetchStoreConfig(), null), safePromise(fetchPublicCategories(), []), safePromise(apiFetch('/products/public/' + SELLER_ID), [])]);
    return { store: results[0], categories: results[1] || [], products: results[2] || [] };
  }

  async function bootHome() {
    renderLoading(); bindMenu();
    try {
      const results = await Promise.all([loadContext(), safePromise(apiFetch('/storefront/public/' + SELLER_ID + '/home'), null)]);
      const context = results[0]; const published = results[1];
      const layout = published && Array.isArray(published.sections) && published.sections.length ? published.sections : cloneDefaultLayout();
      applyTheme(published && published.theme ? published.theme : {});
      renderLayout(layout, context);
      if (context.store) applyStoreBrand(context.store);
      window.dispatchEvent(new CustomEvent('storefront:home-ready', { detail: { blocks: layout.length, published: Boolean(published && published.version) } }));
    } catch (error) { console.error('Storefront home failed:', error); renderFallback(error && error.message); }
  }

  window.StorefrontHome = { registry: HOME_SECTION_REGISTRY, defaultLayout: DEFAULT_HOME_LAYOUT, cloneDefaultLayout: cloneDefaultLayout, registerSection: registerSection, normalizeLayout: normalizeLayout, renderLayout: renderLayout, applyTheme: applyTheme, loadContext: loadContext, bootHome: bootHome };
  if (root.dataset.storefrontMode !== 'preview') bootHome();
})();
