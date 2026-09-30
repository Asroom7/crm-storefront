/* Dynamic, backend-configurable storefront home runtime. */
(function () {
  'use strict';

  const root = document.getElementById('storefront-home-root');
  if (!root) return;

  const DEFAULT_CONFIG = {
    sections: [
      { id: 'search', type: 'search', enabled: true, content: {}, settings: {} },
      { id: 'hero', type: 'hero', enabled: true, content: { eyebrow: 'BEAUTY · CARE · YOU', title: 'روتین زیبایی، ساده‌تر و انتخاب‌شده‌تر', text: 'محصولات مراقبتی و زیبایی را مرتب، سریع و با اطلاعات روشن پیدا کن.' }, settings: {} },
      { id: 'categories', type: 'categories', enabled: true, content: { title: 'دسته‌بندی‌ها', subtitle: 'شروع سریع از چیزی که لازم داری' }, settings: { limit: 6 } },
      { id: 'best-sellers', type: 'best-sellers', enabled: true, content: { title: 'پرفروش‌ترین‌ها', subtitle: 'انتخاب‌های محبوب مشتریان' }, settings: { mode: 'auto', limit: 8, productIds: [] } },
      { id: 'campaign', type: 'campaign', enabled: false, content: { title: 'پیشنهاد ویژه', subtitle: 'فرصت محدود برای خرید با قیمت بهتر', ctaText: 'مشاهده همه' }, settings: { startsAt: null, endsAt: null, productIds: [] } },
      { id: 'featured', type: 'product-collection', enabled: true, content: { title: 'تازه‌های فروشگاه', subtitle: 'محصولات جدیدی که به فروشگاه اضافه شده‌اند' }, settings: { limit: 8, productIds: [] } },
      { id: 'videos', type: 'videos', enabled: true, content: { title: 'جعبه جادویی', subtitle: 'ویدئوهای آموزشی و معرفی محصولات' }, settings: { limit: 3 } },
      { id: 'promo', type: 'banner', enabled: false, content: { title: 'ما را در شبکه‌های اجتماعی دنبال کنید', text: '', ctaText: 'مشاهده', ctaUrl: '', imageUrl: '' }, settings: {} },
      { id: 'support', type: 'support-banner', enabled: true, content: {}, settings: {} },
      { id: 'trust', type: 'trust', enabled: true, content: {}, settings: {} },
      { id: 'footer', type: 'footer', enabled: true, content: { about: 'فروشگاه آنلاین محصولات مراقبتی و زیبایی با مسیر ساده از انتخاب تا پیگیری سفارش.' }, settings: {} },
    ],
  };

  const DEFAULT_THEME = {
    primaryColor: '#cf4772', accentColor: '#452b45', backgroundColor: '#fffdfc',
    surfaceColor: '#ffffff', textColor: '#211b1e', mutedColor: '#746b70',
    fontFamily: 'Tahoma, Arial, sans-serif', buttonRadius: 999, cardRadius: 20,
    containerWidth: 1180, sectionSpacing: 64, globalPadding: 18, shadowPreset: 'soft',
  };

  const registry = Object.create(null);
  const categoryGlyphs = ['✦', '◌', '◇', '○', '✧', '◈'];
  let lastContext = null;
  let countdownTimer = 0;

  function registerSection(type, renderer) { registry[type] = renderer; }
  function asArray(value) { return Array.isArray(value) ? value : []; }
  function int(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min == null ? -Infinity : min, Math.min(max == null ? Infinity : max, Math.floor(number)));
  }
  function validDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function safeExternalUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(String(value), window.location.href);
      return ['http:', 'https:', 'tel:', 'mailto:'].includes(url.protocol) ? url.href : '';
    } catch (error) { return ''; }
  }
  function safeImageUrl(value) {
    if (!value) return '';
    if (typeof safeMediaUrl === 'function') return safeMediaUrl(value) || '';
    return safeExternalUrl(value);
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
  function productsByIds(ids, products) {
    const map = new Map(asArray(products).map(function (product) { return [Number(product.id), product]; }));
    return asArray(ids).map(Number).map(function (id) { return map.get(id); }).filter(Boolean);
  }
  function chooseProducts(block, ctx) {
    const settings = block.settings || {};
    const limit = int(settings.limit, 8, 1, 20);
    const chosen = productsByIds(settings.productIds, ctx.products);
    return (chosen.length ? chosen : asArray(ctx.products)).slice(0, limit);
  }
  function firstCategoryProductImage(categoryId, products) {
    const product = asArray(products).find(function (item) {
      return Number(item.categoryId || (item.category && item.category.id)) === Number(categoryId) && getProductImageUrl(item);
    });
    return product ? getProductImageUrl(product) : '';
  }
  function productCard(product, extraBadge) {
    const imageUrl = getProductImageUrl(product);
    const availability = productAvailability(product);
    return '<a class="sf-product-card" href="product-detail.html?id=' + encodeURIComponent(product.id) + '">' +
      '<div class="sf-product-media">' +
        (imageUrl ? '<img src="' + escapeHtml(imageUrl) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" decoding="async">' : '<span class="sf-product-placeholder" aria-hidden="true">✦</span>') +
        '<span class="sf-stock-badge ' + availability.cls + '">' + availability.label + '</span>' +
        (extraBadge ? '<span class="sf-extra-badge">' + escapeHtml(extraBadge) + '</span>' : '') +
      '</div><div class="sf-product-body"><span class="sf-product-category">' + escapeHtml(productCategoryName(product)) + '</span>' +
      '<h3>' + escapeHtml(product.name) + '</h3><div class="sf-product-price">' + escapeHtml(getProductPriceLabel(product)) + '</div></div></a>';
  }
  function sectionHead(title, subtitle, href, linkText, extra) {
    return '<div class="sf-section-head"><div><h2>' + escapeHtml(title || '') + '</h2>' + (subtitle ? '<p>' + escapeHtml(subtitle) + '</p>' : '') + '</div>' +
      (extra || '') + (href ? '<a href="' + escapeHtml(href) + '">' + escapeHtml(linkText || 'مشاهده همه') + '<span aria-hidden="true">‹</span></a>' : '') + '</div>';
  }
  function serverNowMs(ctx) { return Date.now() + Number(ctx.clockSkewMs || 0); }
  function campaignIsActive(block, ctx) {
    const settings = block.settings || {};
    const start = validDate(settings.startsAt);
    const end = validDate(settings.endsAt);
    const now = serverNowMs(ctx);
    if (start && now < start.getTime()) return false;
    if (end && now >= end.getTime()) return false;
    return true;
  }

  function applyTheme(theme) {
    const t = { ...DEFAULT_THEME, ...(theme || {}) };
    const style = document.documentElement.style;
    style.setProperty('--sf-bg', String(t.backgroundColor));
    style.setProperty('--sf-surface', String(t.surfaceColor));
    style.setProperty('--sf-ink', String(t.textColor));
    style.setProperty('--sf-muted', String(t.mutedColor));
    style.setProperty('--sf-rose', String(t.primaryColor));
    style.setProperty('--sf-rose-dark', String(t.primaryColor));
    style.setProperty('--sf-plum', String(t.accentColor));
    style.setProperty('--sf-card-radius', int(t.cardRadius, 20, 0, 80) + 'px');
    style.setProperty('--sf-container', int(t.containerWidth, 1180, 720, 1600) + 'px');
    style.setProperty('--sf-section-space', int(t.sectionSpacing, 64, 16, 160) + 'px');
    style.setProperty('--sf-global-pad', int(t.globalPadding, 18, 8, 64) + 'px');
    document.body.style.fontFamily = String(t.fontFamily || DEFAULT_THEME.fontFamily);
  }

  registerSection('search', function (block, ctx) {
    const chips = ['<a class="sf-nav-chip is-primary" href="products.html">همه محصولات</a>'].concat(asArray(ctx.categories).slice(0, 8).map(function (category) {
      return '<a class="sf-nav-chip" href="products.html?category=' + encodeURIComponent(category.id) + '">' + escapeHtml(category.name) + '</a>';
    })).join('');
    return '<section class="sf-search-block sf-container" aria-label="جستجو و دسته‌بندی"><form class="sf-search-form" action="products.html" method="get" role="search">' +
      '<button type="submit" aria-label="جستجو"><span aria-hidden="true">⌕</span></button><input type="search" name="q" placeholder="دنبال چه محصولی می‌گردی؟" autocomplete="off" aria-label="جستجوی محصولات"></form>' +
      '<div class="sf-chip-strip">' + chips + '</div></section>';
  });

  registerSection('hero', function (block, ctx) {
    const content = block.content || {};
    const heroProduct = asArray(ctx.products).find(function (product) { return getProductImageUrl(product); }) || asArray(ctx.products)[0];
    const configuredImage = safeImageUrl(content.imageUrl);
    const imageUrl = configuredImage || (heroProduct ? getProductImageUrl(heroProduct) : '');
    const ctaUrl = safeExternalUrl(content.ctaUrl) || 'products.html';
    return '<section class="sf-hero sf-container"><div class="sf-hero-panel"><div class="sf-hero-copy">' +
      '<span class="sf-eyebrow">' + escapeHtml(content.eyebrow || 'BEAUTY · CARE · YOU') + '</span><h1>' + escapeHtml(content.title || 'روتین زیبایی، ساده‌تر و انتخاب‌شده‌تر') + '</h1>' +
      '<p>' + escapeHtml(content.text || 'محصولات مراقبتی و زیبایی را مرتب، سریع و با اطلاعات روشن پیدا کن.') + '</p><div class="sf-hero-actions">' +
      '<a class="sf-btn sf-btn-primary" href="' + escapeHtml(ctaUrl) + '">' + escapeHtml(content.ctaText || 'مشاهده محصولات') + '</a><a class="sf-btn sf-btn-ghost" href="#sf-categories">دسته‌بندی‌ها</a></div></div>' +
      '<div class="sf-hero-art" aria-hidden="true"><span class="sf-hero-orb orb-one"></span><span class="sf-hero-orb orb-two"></span>' +
      (imageUrl ? '<div class="sf-hero-product-frame"><img src="' + escapeHtml(imageUrl) + '" alt="" fetchpriority="high" decoding="async"></div>' : '<div class="sf-hero-monogram">L</div>') + '</div></div></section>';
  });

  registerSection('categories', function (block, ctx) {
    const content = block.content || {};
    const categories = asArray(ctx.categories).slice(0, int(block.settings && block.settings.limit, 6, 1, 12));
    if (!categories.length) return '';
    return '<section class="sf-section sf-container" id="sf-categories">' + sectionHead(content.title || 'دسته‌بندی‌ها', content.subtitle || 'شروع سریع از چیزی که لازم داری', 'products.html', 'همه دسته‌ها') +
      '<div class="sf-category-grid">' + categories.map(function (category, index) {
        const image = firstCategoryProductImage(category.id, ctx.products);
        return '<a class="sf-category-card tone-' + ((index % 6) + 1) + '" href="products.html?category=' + encodeURIComponent(category.id) + '"><div class="sf-category-visual">' +
          (image ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy" decoding="async">' : '<span>' + categoryGlyphs[index % categoryGlyphs.length] + '</span>') +
          '</div><div class="sf-category-copy"><strong>' + escapeHtml(category.name) + '</strong><span>مشاهده محصولات</span></div></a>';
      }).join('') + '</div></section>';
  });

  registerSection('product-collection', function (block, ctx) {
    const products = chooseProducts(block, ctx);
    if (!products.length) return '';
    const content = block.content || {};
    return '<section class="sf-section sf-container">' + sectionHead(content.title || 'محصولات', content.subtitle || '', 'products.html', 'مشاهده همه') + '<div class="sf-product-scroll">' + products.map(function (p) { return productCard(p); }).join('') + '</div></section>';
  });

  registerSection('best-sellers', function (block, ctx) {
    const settings = block.settings || {};
    const limit = int(settings.limit, 8, 1, 20);
    const ids = settings.mode === 'manual' ? asArray(settings.productIds) : asArray(ctx.bestSellerIds);
    const products = (productsByIds(ids, ctx.products).length ? productsByIds(ids, ctx.products) : asArray(ctx.products)).slice(0, limit);
    if (!products.length) return '';
    const content = block.content || {};
    return '<section class="sf-section sf-container sf-best-sellers">' + sectionHead(content.title || 'پرفروش‌ترین‌ها', content.subtitle || 'انتخاب‌های محبوب مشتریان', 'products.html', 'مشاهده همه') + '<div class="sf-product-scroll">' + products.map(function (p) { return productCard(p, 'پرفروش'); }).join('') + '</div></section>';
  });

  registerSection('campaign', function (block, ctx) {
    if (!campaignIsActive(block, ctx)) return '';
    const settings = block.settings || {};
    const products = productsByIds(settings.productIds, ctx.products).slice(0, 8);
    if (!products.length) return '';
    const content = block.content || {};
    const end = validDate(settings.endsAt);
    const timer = end ? '<div class="sf-countdown" data-end-at="' + escapeHtml(end.toISOString()) + '"><span>تا پایان پیشنهاد</span><strong>--:--:--</strong></div>' : '';
    return '<section class="sf-section sf-container"><div class="sf-campaign">' + sectionHead(content.title || 'پیشنهاد ویژه', content.subtitle || '', 'products.html', content.ctaText || 'مشاهده همه', timer) +
      '<div class="sf-product-scroll">' + products.map(function (p) { return productCard(p, content.badge || 'پیشنهاد ویژه'); }).join('') + '</div></div></section>';
  });

  registerSection('videos', function (block, ctx) {
    const limit = int(block.settings && block.settings.limit, 3, 1, 8);
    const rows = [];
    asArray(ctx.products).forEach(function (product) {
      asArray(product.media).filter(function (media) { return media && media.kind === 'video' && safeImageUrl(media.url); }).forEach(function (media) {
        if (rows.length < limit) rows.push({ product: product, media: media });
      });
    });
    if (!rows.length) return '';
    const content = block.content || {};
    return '<section class="sf-section sf-video-section sf-container">' + sectionHead(content.title || 'جعبه جادویی', content.subtitle || 'ویدئوهای آموزشی و معرفی محصولات') + '<div class="sf-video-grid">' + rows.map(function (row) {
      const poster = getProductImageUrl(row.product);
      return '<article class="sf-video-card"><div class="sf-video-media"><video controls muted playsinline preload="none"' + (poster ? ' poster="' + escapeHtml(poster) + '"' : '') + '><source src="' + escapeHtml(safeImageUrl(row.media.url)) + '"></video></div><div class="sf-video-copy"><span>محتوای آموزشی</span><h3>' + escapeHtml(row.product.name) + '</h3><a href="product-detail.html?id=' + encodeURIComponent(row.product.id) + '">محصول مرتبط <b>‹</b></a></div></article>';
    }).join('') + '</div></section>';
  });

  registerSection('banner', function (block) {
    const content = block.content || {};
    if (!content.title && !content.imageUrl) return '';
    const image = safeImageUrl(content.imageUrl);
    const href = safeExternalUrl(content.ctaUrl) || 'products.html';
    return '<section class="sf-section sf-container"><div class="sf-promo-banner">' + (image ? '<img src="' + escapeHtml(image) + '" alt="" loading="lazy" decoding="async">' : '') + '<div class="sf-promo-copy"><h2>' + escapeHtml(content.title || '') + '</h2>' + (content.text ? '<p>' + escapeHtml(content.text) + '</p>' : '') + '<a class="sf-btn sf-btn-primary" href="' + escapeHtml(href) + '">' + escapeHtml(content.ctaText || 'مشاهده') + '</a></div></div></section>';
  });

  registerSection('support-banner', function (block, ctx) {
    const seller = ctx.store && ctx.store.seller ? ctx.store.seller : {};
    const rubika = safeExternalUrl(seller.supportRubikaUrl);
    const phone = seller.supportPhone ? String(seller.supportPhone) : '';
    if (!rubika && !phone) return '';
    const href = rubika || ('tel:' + phone.replace(/[^+\d]/g, ''));
    return '<section class="sf-support-wrap sf-container"><div class="sf-support-banner"><div class="sf-support-icon">♡</div><div><span>برای انتخاب مطمئن‌تر</span><h2>پشتیبانی فروشگاه کنار توست</h2><p>برای سؤال درباره محصول، سفارش یا روند خرید با ما در ارتباط باش.</p></div><a href="' + escapeHtml(href) + '"' + (rubika ? ' target="_blank" rel="noopener"' : '') + '>ارتباط با پشتیبانی <span>‹</span></a></div></section>';
  });

  registerSection('trust', function () {
    const items = [['◎','پیگیری سفارش','وضعیت سفارش از حساب کاربری قابل مشاهده است'],['◇','پرداخت شفاف','اطلاعات پرداخت داخل سفارش ثبت و بررسی می‌شود'],['✦','انتخاب مرتب','جستجو و دسته‌بندی برای رسیدن سریع‌تر به محصول']];
    return '<section class="sf-trust sf-container">' + items.map(function (item) { return '<div class="sf-trust-item"><span>' + item[0] + '</span><div><strong>' + item[1] + '</strong><p>' + item[2] + '</p></div></div>'; }).join('') + '</section>';
  });

  registerSection('footer', function (block, ctx) {
    const seller = ctx.store && ctx.store.seller ? ctx.store.seller : {};
    const content = block.content || {};
    const brand = seller.brandName || seller.name || 'فروشگاه زیبایی';
    const phone = seller.supportPhone ? String(seller.supportPhone) : '';
    const rubika = safeExternalUrl(seller.supportRubikaUrl);
    return '<footer class="sf-footer"><div class="sf-footer-inner sf-container"><div class="sf-footer-brand"><div class="logo">' + escapeHtml(brand) + '</div><p>' + escapeHtml(content.about || 'فروشگاه آنلاین محصولات مراقبتی و زیبایی.') + '</p><div class="sf-footer-contact">' +
      (phone ? '<a href="tel:' + escapeHtml(phone.replace(/[^+\d]/g, '')) + '"><span>تلفن پشتیبانی</span><b dir="ltr">' + escapeHtml(phone) + '</b></a>' : '') +
      (rubika ? '<a href="' + escapeHtml(rubika) + '" target="_blank" rel="noopener"><span>پشتیبانی آنلاین</span><b>باز کردن گفتگو</b></a>' : '') + '</div></div><div class="sf-footer-links">' +
      '<details open><summary>راهنمای خرید</summary><a href="products.html">محصولات</a><a href="cart.html">سبد خرید</a><a href="profile.html">پیگیری سفارش</a></details>' +
      '<details open><summary>حساب کاربری</summary><a href="login.html">ورود</a><a href="register.html">ثبت‌نام</a><a href="profile.html">حساب من</a></details>' +
      '<details open><summary>فروشگاه</summary><a href="index.html">صفحه نخست</a>' + (rubika ? '<a href="' + escapeHtml(rubika) + '" target="_blank" rel="noopener">پشتیبانی</a>' : '') + '</details></div><div class="sf-footer-bottom"><span>© ' + new Date().getFullYear() + ' ' + escapeHtml(brand) + '</span><a href="#storefront-home-root">بازگشت به بالا ↑</a></div></div></footer>';
  });

  function renderLoading() { root.innerHTML = '<div class="sf-home-loading sf-container" aria-live="polite"><div class="sf-skeleton sf-skeleton-search"></div><div class="sf-skeleton sf-skeleton-hero"></div><div class="sf-skeleton-row"><span></span><span></span><span></span></div></div>'; }
  function renderFallback(message) { root.innerHTML = '<section class="sf-load-error sf-container"><div><strong>فروشگاه در حالت ساده باز شده است.</strong><p>' + escapeHtml(message || 'بخشی از اطلاعات موقتاً در دسترس نیست.') + '</p><a class="sf-btn sf-btn-primary" href="products.html">مشاهده محصولات</a></div></section>'; }
  function bindCountdowns(ctx) {
    window.clearInterval(countdownTimer);
    function update() {
      root.querySelectorAll('[data-end-at]').forEach(function (node) {
        const end = validDate(node.dataset.endAt);
        if (!end) return;
        let seconds = Math.max(0, Math.floor((end.getTime() - serverNowMs(ctx)) / 1000));
        const hours = Math.floor(seconds / 3600); seconds -= hours * 3600;
        const minutes = Math.floor(seconds / 60); const secs = seconds - minutes * 60;
        const value = [hours, minutes, secs].map(function (v) { return String(v).padStart(2, '0'); }).join(':');
        const strong = node.querySelector('strong'); if (strong) strong.textContent = value;
      });
    }
    update(); countdownTimer = window.setInterval(update, 1000);
  }
  function renderLayout(sections, context) {
    const html = asArray(sections).filter(function (block) { return block && block.enabled !== false; }).map(function (block) {
      const renderer = registry[block.type]; if (!renderer) return '';
      try { return renderer(block, context) || ''; } catch (error) { console.error('Storefront section failed:', block.type, error); return ''; }
    }).join('');
    if (!html.trim()) throw new Error('هیچ بخشی برای نمایش آماده نشد');
    root.innerHTML = html; bindCountdowns(context);
  }
  function bindMenu() {
    const toggle = document.querySelector('.menu-toggle'), closeBtn = document.querySelector('.close-menu'), overlay = document.querySelector('.side-menu-overlay'), menu = document.querySelector('.side-menu');
    if (!menu) return;
    function openMenu() { menu.classList.add('open'); if (overlay) overlay.classList.add('open'); }
    function closeMenu() { menu.classList.remove('open'); if (overlay) overlay.classList.remove('open'); }
    if (toggle) { toggle.addEventListener('click', openMenu); toggle.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') openMenu(); }); }
    if (closeBtn) closeBtn.addEventListener('click', closeMenu); if (overlay) overlay.addEventListener('click', closeMenu);
  }
  function safePromise(promise, fallback) { return promise.then(function (value) { return value; }).catch(function () { return fallback; }); }

  async function bootHome() {
    renderLoading(); bindMenu();
    try {
      const results = await Promise.all([
        safePromise(fetchStoreConfig(), null),
        safePromise(fetchPublicCategories(), []),
        safePromise(apiFetch('/products/public/' + SELLER_ID), []),
        safePromise(apiFetch('/storefront/public/' + SELLER_ID + '/home'), null),
        safePromise(apiFetch('/storefront-insights/public/' + SELLER_ID + '/best-sellers?limit=20'), { productIds: [] }),
      ]);
      const page = results[3];
      const serverNow = page && page.serverNow ? new Date(page.serverNow) : new Date();
      const context = { store: results[0], categories: results[1] || [], products: results[2] || [], bestSellerIds: results[4] && results[4].productIds || [], clockSkewMs: serverNow.getTime() - Date.now() };
      lastContext = context;
      applyTheme(page && page.theme);
      renderLayout(page && page.config && page.config.sections ? page.config.sections : DEFAULT_CONFIG.sections, context);
      if (context.store) applyStoreBrand(context.store);
      window.dispatchEvent(new CustomEvent('storefront:home-ready', { detail: { source: page && page.source || 'fallback' } }));
    } catch (error) { console.error('Storefront home failed:', error); renderFallback(error && error.message); }
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin || !event.data || event.data.type !== 'storefront-preview-config' || !lastContext) return;
    const config = event.data.config && event.data.config.sections ? event.data.config : DEFAULT_CONFIG;
    applyTheme(event.data.theme || DEFAULT_THEME);
    renderLayout(config.sections, lastContext);
  });

  window.StorefrontHome = { registry: registry, defaultConfig: DEFAULT_CONFIG, defaultTheme: DEFAULT_THEME, registerSection: registerSection, renderLayout: renderLayout, applyTheme: applyTheme };
  bootHome();
})();
