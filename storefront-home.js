/* Dynamic, backend-configurable storefront home runtime. */
(function () {
  'use strict';

  const root = document.getElementById('storefront-home-root');
  if (!root) return;

  const REQUESTED = [
    { id: 'search', type: 'search', enabled: true, content: {}, settings: {} },
    { id: 'videos', type: 'videos', enabled: true, content: { title: 'ویدیوهای آموزشی', subtitle: 'نکات، آموزش و معرفی محصولات' }, settings: { limit: 8 } },
    { id: 'best-sellers', type: 'best-sellers', enabled: true, content: { title: 'پرفروش‌ترین‌ها', subtitle: 'انتخاب‌های محبوب مشتریان' }, settings: { mode: 'manual', limit: 8, productIds: [], promotions: {} } },
    { id: 'campaign', type: 'campaign', enabled: true, content: { title: 'تخفیف‌ها', subtitle: 'پیشنهادهای ویژه و محدود' }, settings: { productIds: [] } },
    { id: 'categories', type: 'categories', enabled: true, content: { title: 'دسته‌بندی محصولات', subtitle: 'انتخاب سریع‌تر با دسته‌بندی تصویری' }, settings: { limit: 8 } },
  ];

  const DEFAULT_CONFIG = { sections: REQUESTED };
  const DEFAULT_THEME = { primaryColor: '#cf4772', accentColor: '#452b45', backgroundColor: '#fffdfc', surfaceColor: '#fff', textColor: '#211b1e', mutedColor: '#746b70', fontFamily: 'Tahoma, Arial, sans-serif', buttonRadius: 999, cardRadius: 20, containerWidth: 1180, sectionSpacing: 64, globalPadding: 18, shadowPreset: 'soft' };
  const registry = Object.create(null);
  const categoryGlyphs = ['✦', '◌', '◇', '○', '✧', '◈'];
  let lastContext = null;
  let countdownTimer = 0;

  function registerSection(type, renderer) { registry[type] = renderer; }
  function asArray(value) { return Array.isArray(value) ? value : []; }
  function int(value, fallback, min, max) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(min == null ? -Infinity : min, Math.min(max == null ? Infinity : max, Math.floor(number))) : fallback;
  }
  function validDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  function safeExternalUrl(value) {
    if (!value) return '';
    try {
      const url = new URL(String(value), location.href);
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
  function firstCategoryProductImage(id, products) {
    const product = asArray(products).find(function (item) {
      return Number(item.categoryId || (item.category && item.category.id)) === Number(id) && getProductImageUrl(item);
    });
    return product ? getProductImageUrl(product) : '';
  }
  function productCard(product, badge) {
    const image = getProductImageUrl(product);
    const availability = productAvailability(product);
    return '<a class="sf-product-card" href="product-detail.html?id=' + encodeURIComponent(product.id) + '">' +
      '<div class="sf-product-media">' +
        (image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" decoding="async">' : '<span class="sf-product-placeholder">✦</span>') +
        '<span class="sf-stock-badge ' + availability.cls + '">' + availability.label + '</span>' +
        (badge ? '<span class="sf-extra-badge">' + escapeHtml(badge) + '</span>' : '') +
      '</div>' +
      '<div class="sf-product-body"><span class="sf-product-category">' + escapeHtml(productCategoryName(product)) + '</span><h3>' + escapeHtml(product.name) + '</h3><div class="sf-product-price">' + escapeHtml(getProductPriceLabel(product)) + '</div></div>' +
    '</a>';
  }
  function bestSellerCard(product, promotion) {
    const image = getProductImageUrl(product);
    const availability = productAvailability(product);
    const promo = promotion && promotion.enabled === true ? promotion : null;
    const oldPrice = promo && promo.oldPrice ? String(promo.oldPrice) : '';
    const discountLabel = promo && promo.discountLabel ? String(promo.discountLabel) : '';
    return '<a class="sf-product-card sf-bestseller-card" data-product-id="' + encodeURIComponent(product.id) + '" href="product-detail.html?id=' + encodeURIComponent(product.id) + '">' +
      '<div class="sf-product-media">' +
        (image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" decoding="async">' : '<span class="sf-product-placeholder">✦</span>') +
        '<span class="sf-stock-badge ' + availability.cls + '">' + availability.label + '</span>' +
        '<span class="sf-extra-badge">پرفروش</span>' +
      '</div>' +
      '<div class="sf-product-body">' +
        '<span class="sf-product-category">' + escapeHtml(productCategoryName(product)) + '</span>' +
        '<h3>' + escapeHtml(product.name) + '</h3>' +
        '<div class="sf-product-price-wrap"><div>' +
          (oldPrice ? '<span class="sf-bestseller-old-price">' + escapeHtml(oldPrice) + '</span>' : '') +
          '<div class="sf-product-price">' + escapeHtml(getProductPriceLabel(product)) + '</div>' +
        '</div>' +
        (discountLabel ? '<span class="sf-bestseller-discount">' + escapeHtml(discountLabel) + '</span>' : '') +
        '</div>' +
      '</div>' +
    '</a>';
  }
  function sectionHead(title, subtitle, href, linkText, extra) {
    return '<div class="sf-section-head"><div><h2>' + escapeHtml(title || '') + '</h2>' + (subtitle ? '<p>' + escapeHtml(subtitle) + '</p>' : '') + '</div>' + (extra || '') + (href ? '<a href="' + escapeHtml(href) + '">' + escapeHtml(linkText || 'مشاهده همه') + ' <span>‹</span></a>' : '') + '</div>';
  }
  function applyTheme(theme) {
    const value = { ...DEFAULT_THEME, ...(theme || {}) };
    const style = document.documentElement.style;
    style.setProperty('--sf-bg', value.backgroundColor);
    style.setProperty('--sf-surface', value.surfaceColor);
    style.setProperty('--sf-ink', value.textColor);
    style.setProperty('--sf-muted', value.mutedColor);
    style.setProperty('--sf-rose', value.primaryColor);
    style.setProperty('--sf-rose-dark', value.primaryColor);
    style.setProperty('--sf-plum', value.accentColor);
    style.setProperty('--sf-card-radius', int(value.cardRadius, 20, 0, 80) + 'px');
    style.setProperty('--sf-container', int(value.containerWidth, 1180, 720, 1600) + 'px');
    style.setProperty('--sf-section-space', int(value.sectionSpacing, 64, 16, 160) + 'px');
    style.setProperty('--sf-global-pad', int(value.globalPadding, 18, 8, 64) + 'px');
    document.body.style.fontFamily = value.fontFamily || DEFAULT_THEME.fontFamily;
  }
  function normalizeSections(server) {
    const incoming = asArray(server).filter(function (section) { return section && registry[section.type]; });
    if (!incoming.length) return REQUESTED.map(function (section) { return { ...section, content: { ...(section.content || {}) }, settings: { ...(section.settings || {}) } }; });
    return incoming.map(function (saved, index) {
      const base = REQUESTED.find(function (item) { return item.type === saved.type; }) || { id: saved.type + '-' + index, type: saved.type, enabled: true, content: {}, settings: {} };
      return {
        ...base,
        ...saved,
        id: saved.id || base.id,
        type: saved.type,
        enabled: saved.enabled !== false,
        content: { ...(base.content || {}), ...(saved.content || {}) },
        settings: { ...(base.settings || {}), ...(saved.settings || {}) },
      };
    });
  }

  registerSection('search', function (block, ctx) {
    const chips = ['<a class="sf-nav-chip is-primary" href="products.html">همه محصولات</a>'].concat(asArray(ctx.categories).slice(0, 8).map(function (category) {
      return '<a class="sf-nav-chip" href="products.html?category=' + encodeURIComponent(category.id) + '">' + escapeHtml(category.name) + '</a>';
    })).join('');
    return '<section class="sf-search-block sf-container"><form class="sf-search-form" action="products.html" method="get" role="search"><button type="submit" aria-label="جستجو"><span>⌕</span></button><input type="search" name="q" placeholder="دنبال چه محصولی می‌گردی؟" autocomplete="off"></form><div class="sf-chip-strip">' + chips + '</div></section>';
  });

  registerSection('videos', function (block, ctx) {
    const rows = [];
    asArray(ctx.products).forEach(function (product) {
      asArray(product.media).filter(function (media) { return media && media.kind === 'video' && safeImageUrl(media.url); }).forEach(function (media) {
        if (rows.length < int(block.settings && block.settings.limit, 8, 1, 12)) rows.push({ product: product, media: media });
      });
    });
    const head = sectionHead((block.content || {}).title || 'ویدیوهای آموزشی', (block.content || {}).subtitle || 'نکات، آموزش و معرفی محصولات', 'products.html', 'مشاهده همه');
    if (!rows.length) return '<section class="sf-section sf-video-section sf-container">' + head + '<div class="sf-video-demo">' + [1, 2, 3].map(function () { return '<div class="sf-video-demo-card"><span class="sf-play">▶</span></div>'; }).join('') + '</div></section>';
    return '<section class="sf-section sf-video-section sf-container">' + head + '<div class="sf-video-grid">' + rows.map(function (row) {
      return '<article class="sf-video-card"><div class="sf-video-media"><video controls muted playsinline preload="metadata"><source src="' + escapeHtml(safeImageUrl(row.media.url)) + '"></video></div><div class="sf-video-copy"><span>محتوای آموزشی</span><h3>' + escapeHtml(row.product.name) + '</h3><a href="product-detail.html?id=' + encodeURIComponent(row.product.id) + '">محصول مرتبط <b>‹</b></a></div></article>';
    }).join('') + '</div></section>';
  });

  registerSection('best-sellers', function (block, ctx) {
    const settings = block.settings || {};
    const products = productsByIds(settings.productIds, ctx.products).slice(0, int(settings.limit, 8, 1, 20));
    const promotions = settings.promotions && typeof settings.promotions === 'object' ? settings.promotions : {};
    const head = sectionHead((block.content || {}).title || 'پرفروش‌ترین‌ها', (block.content || {}).subtitle || 'انتخاب‌های محبوب مشتریان', 'products.html', 'مشاهده همه');
    return '<section class="sf-section sf-container sf-best-sellers">' + head + (products.length ? '<div class="sf-product-scroll">' + products.map(function (product) { return bestSellerCard(product, promotions[String(product.id)] || promotions[product.id]); }).join('') + '</div>' : '<div class="sf-section-empty">محصولات پرفروش به‌زودی اضافه می‌شوند.</div>') + '</section>';
  });

  registerSection('campaign', function (block, ctx) {
    const chosen = productsByIds((block.settings || {}).productIds, ctx.products);
    let products = chosen.length ? chosen : asArray(ctx.products).filter(function (product) {
      return Number(product.discountPercent || product.discount || 0) > 0 || Number(product.salePrice || 0) > 0 && Number(product.price || 0) > Number(product.salePrice || 0);
    });
    if (!products.length) products = asArray(ctx.products).slice(0, 8);
    products = products.slice(0, 8);
    const end = validDate(block.settings && block.settings.endsAt);
    const timer = end ? '<div class="sf-countdown" data-end-at="' + escapeHtml(end.toISOString()) + '"><span>تا پایان پیشنهاد</span><strong>--:--:--</strong></div>' : '';
    return '<section class="sf-section sf-container sf-campaign-section"><div class="sf-campaign">' + sectionHead((block.content || {}).title || 'تخفیف‌ها', (block.content || {}).subtitle || 'پیشنهادهای ویژه و محدود', 'products.html', (block.content || {}).ctaText || 'مشاهده همه', timer) + (products.length ? '<div class="sf-product-scroll">' + products.map(function (product) { return productCard(product, 'تخفیف'); }).join('') + '</div>' : '<div class="sf-section-empty">هنوز محصول تخفیف‌دار ثبت نشده است.</div>') + '</div></section>';
  });

  registerSection('categories', function (block, ctx) {
    const categories = asArray(ctx.categories).slice(0, int(block.settings && block.settings.limit, 8, 1, 12));
    const head = sectionHead((block.content || {}).title || 'دسته‌بندی محصولات', (block.content || {}).subtitle || 'انتخاب سریع‌تر با دسته‌بندی تصویری', 'products.html', 'همه دسته‌ها');
    return '<section class="sf-section sf-container" id="sf-categories">' + head + (categories.length ? '<div class="sf-category-grid">' + categories.map(function (category, index) {
      const image = firstCategoryProductImage(category.id, ctx.products);
      return '<a class="sf-category-card tone-' + ((index % 6) + 1) + '" href="products.html?category=' + encodeURIComponent(category.id) + '"><div class="sf-category-visual">' + (image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(category.name) + '" loading="lazy">' : '<span>' + categoryGlyphs[index % categoryGlyphs.length] + '</span>') + '</div><div class="sf-category-copy"><strong>' + escapeHtml(category.name) + '</strong><span>مشاهده ‹</span></div></a>';
    }).join('') + '</div>' : '<div class="sf-section-empty">هنوز دسته‌بندی ثبت نشده است.</div>') + '</section>';
  });

  function footer(ctx) {
    const store = ctx.store || {};
    const phone = store.phone || store.supportPhone || '';
    const email = store.email || store.supportEmail || '';
    return '<footer class="sf-footer"><div class="sf-footer-inner sf-container"><div class="sf-footer-brand"><div class="logo">Lumière</div><p>فروشگاه محصولات آرایشی، بهداشتی و مراقبتی</p><div class="sf-footer-contact">' + (phone ? '<a href="tel:' + escapeHtml(phone) + '"><span>شماره تماس پشتیبانی</span><b>' + escapeHtml(phone) + '</b></a>' : '') + (email ? '<a href="mailto:' + escapeHtml(email) + '"><span>ایمیل</span><b>' + escapeHtml(email) + '</b></a>' : '') + '</div></div><div class="sf-footer-links"><div><strong>راهنمای خرید</strong><a href="products.html">محصولات</a><a href="cart.html">سبد خرید</a></div><div><strong>حساب کاربری شما</strong><a href="login.html">ورود / ثبت‌نام</a><a href="profile.html">سفارش‌های من</a></div><div><strong>درباره فروشگاه</strong><a href="index.html">صفحه نخست</a><span>پشتیبانی و ارتباط با ما</span></div></div></div><div class="sf-footer-bottom sf-container">Lumière · Beauty · Care</div></footer>';
  }

  function bindCountdowns(ctx) {
    clearInterval(countdownTimer);
    function update() {
      root.querySelectorAll('[data-end-at]').forEach(function (node) {
        const end = validDate(node.dataset.endAt);
        if (!end) return;
        let seconds = Math.max(0, Math.floor((end.getTime() - (Date.now() + Number(ctx.clockSkewMs || 0))) / 1000));
        const hours = Math.floor(seconds / 3600);
        seconds -= hours * 3600;
        const minutes = Math.floor(seconds / 60);
        const secs = seconds - minutes * 60;
        const strong = node.querySelector('strong');
        if (strong) strong.textContent = [hours, minutes, secs].map(function (value) { return String(value).padStart(2, '0'); }).join(':');
      });
    }
    update();
    countdownTimer = setInterval(update, 1000);
  }

  function renderLayout(sections, ctx) {
    const normalized = normalizeSections(sections);
    const html = normalized.filter(function (block) { return block.enabled !== false; }).map(function (block) {
      try { return registry[block.type](block, ctx) || ''; }
      catch (error) { console.error(error); return ''; }
    }).join('') + footer(ctx);
    root.innerHTML = html;
    bindCountdowns(ctx);
  }

  function bindMenu() {
    const toggle = document.querySelector('.menu-toggle');
    const closeButton = document.querySelector('.close-menu');
    const overlay = document.querySelector('.side-menu-overlay');
    const menu = document.querySelector('.side-menu');
    if (!menu) return;
    const open = function () { menu.classList.add('open'); if (overlay) overlay.classList.add('open'); };
    const close = function () { menu.classList.remove('open'); if (overlay) overlay.classList.remove('open'); };
    if (toggle) toggle.addEventListener('click', open);
    if (closeButton) closeButton.addEventListener('click', close);
    if (overlay) overlay.addEventListener('click', close);
  }

  function safePromise(promise, fallback) { return promise.then(function (value) { return value; }).catch(function () { return fallback; }); }

  async function bootHome() {
    bindMenu();
    try {
      const result = await Promise.all([
        safePromise(fetchStoreConfig(), null),
        safePromise(fetchPublicCategories(), []),
        safePromise(apiFetch('/products/public/' + SELLER_ID), []),
        safePromise(apiFetch('/storefront/public/' + SELLER_ID + '/home'), null),
        safePromise(apiFetch('/storefront-insights/public/' + SELLER_ID + '/best-sellers?limit=20'), { productIds: [] }),
      ]);
      const page = result[3];
      const now = page && page.serverNow ? new Date(page.serverNow) : new Date();
      const ctx = { store: result[0], categories: result[1] || [], products: result[2] || [], bestSellerIds: result[4] && result[4].productIds || [], clockSkewMs: now.getTime() - Date.now() };
      lastContext = ctx;
      applyTheme(page && page.theme);
      renderLayout(page && page.config && page.config.sections ? page.config.sections : REQUESTED, ctx);
      if (ctx.store) applyStoreBrand(ctx.store);
      window.dispatchEvent(new CustomEvent('storefront:home-ready'));
    } catch (error) {
      console.error(error);
      root.innerHTML = '<section class="sf-load-error sf-container"><strong>خطا در دریافت اطلاعات فروشگاه</strong><p>صفحه را دوباره بارگذاری کنید.</p></section>';
    }
  }

  window.addEventListener('message', function (event) {
    if (event.origin !== location.origin || !event.data || event.data.type !== 'storefront-preview-config' || !lastContext) return;
    applyTheme(event.data.theme || DEFAULT_THEME);
    renderLayout(event.data.config && event.data.config.sections ? event.data.config.sections : REQUESTED, lastContext);
  });

  window.StorefrontHome = { registry: registry, defaultConfig: DEFAULT_CONFIG, defaultTheme: DEFAULT_THEME, registerSection: registerSection, renderLayout: renderLayout, applyTheme: applyTheme };
  bootHome();
})();
