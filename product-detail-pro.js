/* Phase 2: professional product detail runtime.
   Scope: product-detail.html only. Uses existing public product/cart APIs. */
(function () {
  'use strict';

  var page = document.getElementById('pdp-page');
  if (!page) return;

  var productId = Number(new URLSearchParams(window.location.search).get('id'));
  var currentProduct = null;
  var currentMedia = [];
  var currentMediaIndex = 0;
  var quantity = 1;

  function qs(selector, root) { return (root || document).querySelector(selector); }
  function qsa(selector, root) { return Array.from((root || document).querySelectorAll(selector)); }

  function safe(value) {
    return typeof escapeHtml === 'function'
      ? escapeHtml(value == null ? '' : value)
      : String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
          return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
        });
  }

  function fa(value) {
    return typeof toFaDigits === 'function' ? toFaDigits(value) : String(value == null ? '' : value);
  }

  function mediaList(product) {
    return (Array.isArray(product && product.media) ? product.media : []).filter(function (media) {
      return media && (media.kind === 'image' || media.kind === 'video') && typeof safeMediaUrl === 'function' && safeMediaUrl(media.url);
    }).map(function (media) {
      return { kind: media.kind, url: safeMediaUrl(media.url) };
    });
  }

  function stockInfo(product) {
    var stock = Number(product && product.stockQty || 0);
    var low = Number(product && product.lowStockAt || 0);
    if (stock <= 0) return { cls: 'is-out', label: 'ناموجود', note: 'این محصول فعلاً ناموجود است' };
    if (low > 0 && stock <= low) return { cls: 'is-low', label: 'رو به اتمام', note: 'فقط ' + fa(stock) + ' عدد موجود است' };
    return { cls: 'is-in', label: 'موجود', note: fa(stock) + ' عدد موجود در انبار' };
  }

  function categoryName(product) {
    return product && product.category && product.category.name ? String(product.category.name) : 'بدون دسته‌بندی';
  }

  function priceLabel(product) {
    return typeof getProductPriceLabel === 'function' ? getProductPriceLabel(product) : 'قیمت فروش تنظیم نشده';
  }

  function priceCount(product) {
    return Array.isArray(product && product.prices) ? product.prices.filter(function (row) { return Number(row && row.price) > 0; }).length : 0;
  }

  function renderShell(product) {
    var stock = stockInfo(product);
    var price = typeof getProductMinPrice === 'function' ? getProductMinPrice(product) : 0;
    var description = String(product.description || '').trim();
    var mediaCount = currentMedia.length;
    var prices = priceCount(product);

    page.innerHTML = [
      '<section class="pdp-shell">',
        '<div class="pdp-card pdp-media-card">',
          '<div class="pdp-main-media" id="pdp-main-media"><span class="product-img-placeholder">در حال بارگذاری رسانه...</span></div>',
          '<div class="pdp-thumbs" id="pdp-thumbs" hidden></div>',
        '</div>',
        '<aside class="pdp-card pdp-buy-card">',
          '<div class="pdp-kicker-row">',
            '<span class="pdp-category">' + safe(categoryName(product)) + '</span>',
            '<span class="pdp-stock ' + stock.cls + '">' + safe(stock.label) + '</span>',
          '</div>',
          '<h1 class="pdp-title">' + safe(product.name) + '</h1>',
          '<div class="pdp-price">' + safe(priceLabel(product)) + '</div>',
          description ? '<p class="pdp-summary">' + safe(description) + '</p>' : '',
          '<div class="pdp-divider"></div>',
          '<div class="pdp-qty-line">',
            '<div class="pdp-qty-copy"><strong>تعداد</strong><span id="pdp-stock-note">' + safe(stock.note) + '</span></div>',
            '<div class="pdp-qty"><button type="button" id="pdp-minus" aria-label="کم کردن تعداد">−</button><output id="pdp-qty">۱</output><button type="button" id="pdp-plus" aria-label="زیاد کردن تعداد">+</button></div>',
          '</div>',
          '<button type="button" class="pdp-add" id="pdp-add">' + (stock.cls === 'is-out' ? 'ناموجود' : (price > 0 ? 'افزودن به سبد خرید' : 'قیمت فروش هنوز تنظیم نشده')) + '</button>',
          '<p class="pdp-purchase-note">موجودی و قیمت قبل از ثبت نهایی سفارش دوباره بررسی می‌شود.</p>',
          '<div class="pdp-trust" aria-label="مزایای خرید">',
            '<div class="pdp-trust-item"><b>✓</b><span>موجودی واقعی</span></div>',
            '<div class="pdp-trust-item"><b>◌</b><span>پشتیبانی سفارش</span></div>',
            '<div class="pdp-trust-item"><b>◇</b><span>پیگیری خرید</span></div>',
          '</div>',
        '</aside>',
      '</section>',
      '<div class="pdp-sections">',
        '<section class="pdp-info-card">',
          '<h2>توضیحات محصول</h2>',
          '<p class="pdp-description' + (description ? '' : ' is-empty') + '">' + (description ? safe(description) : 'برای این محصول هنوز توضیحات تکمیلی ثبت نشده است.') + '</p>',
        '</section>',
        '<section class="pdp-info-card">',
          '<h2>اطلاعات خرید</h2>',
          '<div class="pdp-facts">',
            '<div class="pdp-fact"><span>دسته‌بندی</span><strong>' + safe(categoryName(product)) + '</strong></div>',
            '<div class="pdp-fact"><span>وضعیت موجودی</span><strong>' + safe(stock.note) + '</strong></div>',
            '<div class="pdp-fact"><span>رسانه محصول</span><strong>' + fa(mediaCount) + ' مورد' + (prices > 1 ? ' · ' + fa(prices) + ' قیمت ثبت‌شده' : '') + '</strong></div>',
          '</div>',
        '</section>',
        '<section class="pdp-info-card" id="pdp-related-section" hidden>',
          '<div class="pdp-section-head"><div><h2>محصولات مشابه</h2><p>محصولات دیگر از همین دسته‌بندی</p></div></div>',
          '<div class="pdp-related" id="pdp-related"></div>',
        '</section>',
      '</div>',
      '<div class="pdp-mobile-bar" id="pdp-mobile-bar">',
        '<div class="pdp-mobile-price"><span>قیمت محصول</span><strong>' + safe(priceLabel(product)) + '</strong></div>',
        '<button type="button" class="pdp-mobile-add" id="pdp-mobile-add">' + (stock.cls === 'is-out' ? 'ناموجود' : (price > 0 ? 'افزودن به سبد' : 'بدون قیمت')) + '</button>',
      '</div>',
      '<div class="pdp-lightbox" id="pdp-lightbox" hidden aria-hidden="true">',
        '<div class="pdp-lightbox-head"><button type="button" class="pdp-lightbox-close" aria-label="بستن">×</button></div>',
        '<div class="pdp-lightbox-body"></div>',
      '</div>'
    ].join('');

    var unavailable = Number(product.stockQty || 0) <= 0 || !(price > 0);
    qs('#pdp-add').disabled = unavailable;
    qs('#pdp-mobile-add').disabled = unavailable;
    qs('#pdp-minus').disabled = true;
    qs('#pdp-plus').disabled = unavailable || Number(product.stockQty || 0) <= 1;

    bindPurchaseActions();
    renderGallery();
    renderRelated();
  }

  function renderGallery() {
    var main = qs('#pdp-main-media');
    var thumbs = qs('#pdp-thumbs');
    if (!main || !thumbs) return;

    if (!currentMedia.length) {
      main.innerHTML = '<span class="product-img-placeholder">تصویری برای این محصول ثبت نشده است.</span>';
      thumbs.hidden = true;
      return;
    }

    thumbs.hidden = currentMedia.length <= 1;
    thumbs.innerHTML = currentMedia.map(function (item, index) {
      var body = item.kind === 'image'
        ? '<img src="' + safe(item.url) + '" alt="" loading="lazy" decoding="async">'
        : '<span class="pdp-thumb-video"><span>▶</span>ویدیو</span>';
      return '<button type="button" class="pdp-thumb' + (index === currentMediaIndex ? ' active' : '') + '" data-pdp-media="' + index + '" aria-label="رسانه ' + fa(index + 1) + '">' + body + '</button>';
    }).join('');

    qsa('[data-pdp-media]', thumbs).forEach(function (button) {
      button.addEventListener('click', function () {
        selectMedia(Number(button.dataset.pdpMedia));
      });
    });

    selectMedia(currentMediaIndex);
  }

  function selectMedia(index) {
    var main = qs('#pdp-main-media');
    var item = currentMedia[index];
    if (!main || !item) return;
    currentMediaIndex = index;

    if (item.kind === 'video') {
      main.innerHTML = '<video src="' + safe(item.url) + '" controls playsinline preload="metadata"></video>';
    } else {
      main.innerHTML = '<img src="' + safe(item.url) + '" alt="' + safe(currentProduct.name) + '" decoding="async"><button type="button" class="pdp-zoom" id="pdp-zoom">⌕ بزرگ‌نمایی</button>';
      var zoom = qs('#pdp-zoom');
      if (zoom) zoom.addEventListener('click', openLightbox);
      var image = qs('img', main);
      if (image) image.addEventListener('dblclick', openLightbox);
    }

    qsa('[data-pdp-media]').forEach(function (button) {
      button.classList.toggle('active', Number(button.dataset.pdpMedia) === index);
    });
  }

  function openLightbox() {
    var item = currentMedia[currentMediaIndex];
    var lightbox = qs('#pdp-lightbox');
    var body = lightbox && qs('.pdp-lightbox-body', lightbox);
    if (!item || item.kind !== 'image' || !lightbox || !body) return;
    body.innerHTML = '<img src="' + safe(item.url) + '" alt="' + safe(currentProduct.name) + '">';
    lightbox.hidden = false;
    lightbox.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
    qs('.pdp-lightbox-close', lightbox).focus();
  }

  function closeLightbox() {
    var lightbox = qs('#pdp-lightbox');
    if (!lightbox || lightbox.hidden) return;
    lightbox.hidden = true;
    lightbox.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
  }

  function syncQuantity() {
    var stock = Number(currentProduct && currentProduct.stockQty || 0);
    var output = qs('#pdp-qty');
    var minus = qs('#pdp-minus');
    var plus = qs('#pdp-plus');
    if (output) output.textContent = fa(quantity);
    if (minus) minus.disabled = quantity <= 1;
    if (plus) plus.disabled = stock <= 0 || quantity >= stock;
  }

  function addCurrentToCart() {
    if (!currentProduct) return;
    var stock = Number(currentProduct.stockQty || 0);
    var price = typeof getProductMinPrice === 'function' ? getProductMinPrice(currentProduct) : 0;
    if (stock <= 0 || price <= 0) return;
    addToCart(currentProduct.id, Math.min(quantity, stock));
    window.location.href = 'cart.html';
  }

  function bindPurchaseActions() {
    qs('#pdp-minus').addEventListener('click', function () {
      if (quantity > 1) quantity -= 1;
      syncQuantity();
    });
    qs('#pdp-plus').addEventListener('click', function () {
      var stock = Number(currentProduct && currentProduct.stockQty || 0);
      if (quantity < stock) quantity += 1;
      syncQuantity();
    });
    qs('#pdp-add').addEventListener('click', addCurrentToCart);
    qs('#pdp-mobile-add').addEventListener('click', addCurrentToCart);

    var lightbox = qs('#pdp-lightbox');
    if (lightbox) {
      qs('.pdp-lightbox-close', lightbox).addEventListener('click', closeLightbox);
      lightbox.addEventListener('click', function (event) {
        if (event.target === lightbox || event.target.classList.contains('pdp-lightbox-body')) closeLightbox();
      });
    }
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeLightbox();
    }, { once: false });
    syncQuantity();
  }

  function relatedCard(product) {
    var image = typeof getProductImageUrl === 'function' ? getProductImageUrl(product) : '';
    var stock = stockInfo(product);
    return [
      '<a class="pdp-related-card" href="product-detail.html?id=' + encodeURIComponent(product.id) + '">',
        '<div class="pdp-related-media">',
          image ? '<img src="' + safe(image) + '" alt="' + safe(product.name) + '" loading="lazy" decoding="async">' : '<span class="pdp-related-placeholder">✦</span>',
          '<span class="pdp-related-stock">' + safe(stock.label) + '</span>',
        '</div>',
        '<div class="pdp-related-body">',
          '<span>' + safe(categoryName(product)) + '</span>',
          '<h3>' + safe(product.name) + '</h3>',
          '<strong>' + safe(priceLabel(product)) + '</strong>',
        '</div>',
      '</a>'
    ].join('');
  }

  function renderRelated() {
    var section = qs('#pdp-related-section');
    var box = qs('#pdp-related');
    if (!section || !box || !currentProduct) return;

    apiFetch('/products/public/' + SELLER_ID).then(function (products) {
      var currentCategory = Number(currentProduct.categoryId || (currentProduct.category && currentProduct.category.id) || 0);
      var rows = (Array.isArray(products) ? products : []).filter(function (product) {
        if (!product || Number(product.id) === Number(currentProduct.id)) return false;
        var categoryId = Number(product.categoryId || (product.category && product.category.id) || 0);
        return currentCategory > 0 && categoryId === currentCategory;
      }).slice(0, 8);

      if (!rows.length) return;
      box.innerHTML = rows.map(relatedCard).join('');
      section.hidden = false;
    }).catch(function () {
      section.hidden = true;
    });
  }

  function updateBreadcrumb(product) {
    var crumb = qs('#pdp-current-crumb');
    if (crumb) crumb.textContent = product.name || 'محصول';
  }

  function showError(message) {
    page.innerHTML = '<div class="pdp-error"><h1>محصول پیدا نشد</h1><p>' + safe(message || 'این محصول در دسترس نیست.') + '</p><a href="products.html">بازگشت به محصولات</a></div>';
  }

  function bindMenu() {
    var toggle = qs('.menu-toggle');
    var closeBtn = qs('.close-menu');
    var overlay = qs('.side-menu-overlay');
    var menu = qs('.side-menu');
    function openMenu() {
      if (!menu || !overlay) return;
      menu.classList.add('open');
      overlay.classList.add('open');
    }
    function closeMenu() {
      if (!menu || !overlay) return;
      menu.classList.remove('open');
      overlay.classList.remove('open');
    }
    if (toggle) toggle.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);
    if (overlay) overlay.addEventListener('click', closeMenu);
    if (toggle) toggle.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') openMenu(); });
    if (closeBtn) closeBtn.addEventListener('keydown', function (event) { if (event.key === 'Enter' || event.key === ' ') closeMenu(); });
  }

  bindMenu();

  if (!productId || !Number.isInteger(productId) || productId <= 0) {
    showError('شناسه محصول معتبر نیست.');
    return;
  }

  apiFetch('/products/public/' + SELLER_ID + '/' + productId).then(function (product) {
    currentProduct = product;
    currentMedia = mediaList(product);
    currentMediaIndex = 0;
    quantity = 1;
    document.title = product.name + ' | فروشگاه';
    updateBreadcrumb(product);
    renderShell(product);
  }).catch(function (error) {
    showError(error && error.message ? error.message : 'بارگذاری محصول ناموفق بود.');
  });
}());
