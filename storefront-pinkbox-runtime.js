/* Pink-box campaign renderer: shows discounted products only. */
(function () {
  'use strict';

  if (!window.StorefrontHome || !window.StorefrontHome.registry) return;

  function asArray(value) { return Array.isArray(value) ? value : []; }

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function isDiscounted(product) {
    const discount = safeNumber(product && (product.discountPercent || product.discount));
    const price = safeNumber(product && product.price);
    const salePrice = safeNumber(product && product.salePrice);
    return discount > 0 || (salePrice > 0 && price > salePrice);
  }

  function productByIds(ids, products) {
    const map = new Map(asArray(products).map(function (product) { return [Number(product.id), product]; }));
    return asArray(ids).map(Number).map(function (id) { return map.get(id); }).filter(Boolean);
  }

  function categoryName(product) {
    return product && product.category && product.category.name ? String(product.category.name) : 'محصول تخفیف‌دار';
  }

  function availability(product) {
    const stock = safeNumber(product && product.stockQty);
    const low = safeNumber(product && product.lowStockAt);
    if (stock <= 0) return { label: 'ناموجود', cls: 'is-out' };
    if (low > 0 && stock <= low) return { label: 'رو به اتمام', cls: 'is-low' };
    return { label: 'موجود', cls: 'is-in' };
  }

  function oldPriceLabel(product) {
    const price = safeNumber(product && product.price);
    const salePrice = safeNumber(product && product.salePrice);
    if (!(price > 0 && salePrice > 0 && price > salePrice)) return '';
    return price.toLocaleString('fa-IR') + ' تومان';
  }

  function discountLabel(product) {
    let discount = safeNumber(product && (product.discountPercent || product.discount));
    const price = safeNumber(product && product.price);
    const salePrice = safeNumber(product && product.salePrice);
    if (!(discount > 0) && price > 0 && salePrice > 0 && price > salePrice) {
      discount = Math.round(((price - salePrice) / price) * 100);
    }
    return discount > 0 ? discount.toLocaleString('fa-IR') + '٪' : 'تخفیف';
  }

  function card(product) {
    const image = typeof getProductImageUrl === 'function' ? getProductImageUrl(product) : '';
    const stock = availability(product);
    const oldPrice = oldPriceLabel(product);
    const finalPrice = typeof getProductPriceLabel === 'function' ? getProductPriceLabel(product) : '';
    return '<a class="sf-product-card sf-pink-product-card" href="product-detail.html?id=' + encodeURIComponent(product.id) + '">' +
      '<div class="sf-product-media">' +
        (image ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(product.name) + '" loading="lazy" decoding="async">' : '<span class="sf-product-placeholder">✦</span>') +
        '<span class="sf-stock-badge ' + stock.cls + '">' + stock.label + '</span>' +
        '<span class="sf-extra-badge">' + escapeHtml(discountLabel(product)) + '</span>' +
      '</div>' +
      '<div class="sf-product-body">' +
        '<span class="sf-product-category">' + escapeHtml(categoryName(product)) + '</span>' +
        '<h3>' + escapeHtml(product.name) + '</h3>' +
        (oldPrice ? '<span class="sf-pink-old-price">' + escapeHtml(oldPrice) + '</span>' : '') +
        '<div class="sf-product-price">' + escapeHtml(finalPrice) + '</div>' +
      '</div>' +
    '</a>';
  }

  function countdown(endValue) {
    if (!endValue) return '<div class="sf-countdown sf-countdown-placeholder"><span>تا پایان پیشنهاد</span><strong>--:--:--</strong></div>';
    const end = new Date(endValue);
    if (Number.isNaN(end.getTime())) return '<div class="sf-countdown sf-countdown-placeholder"><span>تا پایان پیشنهاد</span><strong>--:--:--</strong></div>';
    return '<div class="sf-countdown" data-end-at="' + escapeHtml(end.toISOString()) + '"><span>تا پایان پیشنهاد</span><strong>--:--:--</strong></div>';
  }

  window.StorefrontHome.registry.campaign = function (block, ctx) {
    const settings = block.settings || {};
    const selected = productByIds(settings.productIds, ctx.products).filter(isDiscounted);
    let products = selected.length ? selected : asArray(ctx.products).filter(isDiscounted);
    products = products.slice(0, Math.max(1, Math.min(10, safeNumber(settings.limit) || 8)));

    const timer = countdown(settings.endsAt);
    const head = '<div class="sf-section-head">' +
      '<div><h2>جعبه صورتی</h2><p>تخفیف‌های ویژه و محدود</p></div>' +
      timer +
      '<a href="products.html">مشاهده همه <span>‹</span></a>' +
    '</div>';

    return '<section class="sf-section sf-container sf-campaign-section sf-pink-box" data-section-role="pink-box"><div class="sf-campaign">' +
      head +
      (products.length ? '<div class="sf-product-scroll">' + products.map(card).join('') + '</div>' : '<div class="sf-section-empty">هنوز محصول تخفیف‌دار برای جعبه صورتی ثبت نشده است.</div>') +
    '</div></section>';
  };
})();
