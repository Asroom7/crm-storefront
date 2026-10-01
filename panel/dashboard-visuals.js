/* Dashboard featured-product visual renderer.
   Reuses existing dashboard data and navigation; only the presentation of the featured product changes. */
(function () {
  'use strict';

  function firstUsableImage(product) {
    if (!product) return '';
    try {
      if (typeof getProductImageUrl === 'function') {
        const resolved = getProductImageUrl(product);
        if (resolved) return resolved;
      }
    } catch (error) { /* fall through to local candidates */ }

    const media = Array.isArray(product.media) ? product.media : [];
    const mediaImage = media.find(function (item) {
      return item && (!item.kind || item.kind === 'image') && item.url;
    });
    const candidates = [
      mediaImage && mediaImage.url,
      product.imageUrl,
      product.image,
      product.thumbnailUrl,
      product.coverUrl,
      product.photoUrl,
    ];
    for (let i = 0; i < candidates.length; i += 1) {
      const value = candidates[i];
      if (!value) continue;
      try {
        if (typeof safeMediaUrl === 'function') {
          const safe = safeMediaUrl(value);
          if (safe) return safe;
        }
      } catch (error) { /* use protocol fallback */ }
      try {
        const url = new URL(String(value), window.location.href);
        if (['http:', 'https:', 'blob:', 'data:'].includes(url.protocol)) return url.href;
      } catch (error) { /* ignore malformed values */ }
    }
    return '';
  }

  function buildFeaturedProduct(top) {
    if (!top || !top.product) {
      return '<div class="hero-product hero-product--empty">' +
        (typeof ic === 'function' ? ic('box') : '') +
        '<span>هنوز فروشی برای انتخاب محصول منتخب ثبت نشده است</span></div>';
    }

    const p = top.product;
    const image = firstUsableImage(p);
    const productName = typeof esc === 'function' ? esc(p.name || 'محصول') : String(p.name || 'محصول');
    const price = typeof fmtProductPrice === 'function' ? fmtProductPrice(p) : '';
    const count = typeof faDigits === 'function' ? faDigits(top.count || 0) : String(top.count || 0);
    const imageMarkup = image
      ? '<img class="hero-product__bg" src="' + (typeof esc === 'function' ? esc(image) : image) + '" alt="' + productName + '" loading="lazy" decoding="async">'
      : '<div class="hero-product__fallback">' + (typeof ic === 'function' ? ic('box') : '') + '</div>';

    return '<button class="hero-product hero-product--visual" data-product="' + p.id + '" type="button" aria-label="مشاهده ' + productName + '">' +
      imageMarkup +
      '<span class="hero-product__scrim" aria-hidden="true"></span>' +
      '<div class="hero-product__top">' +
        '<div class="hero-product__title-wrap">' +
          '<span class="hero-product__eyebrow">' + (typeof ic === 'function' ? ic('star') : '') + ' محصول منتخب</span>' +
          '<div class="hero-product__visual-name">' + productName + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="hero-product__bottom">' +
        '<div class="hero-product__visual-price"><small>قیمت محصول</small><strong>' + price + '</strong></div>' +
        '<span class="hero-product__sales-count">' + count + ' فروش</span>' +
      '</div>' +
    '</button>';
  }

  /* app.js uses a global function binding, so replacing the window property updates future dashboard renders. */
  window.featuredProductHTML = buildFeaturedProduct;
  try { featuredProductHTML = buildFeaturedProduct; } catch (error) { /* global binding unavailable */ }

  /* If the dashboard was already rendered before this late visual layer loaded, render it once again. */
  setTimeout(function () {
    try {
      if (typeof parseRoute === 'function' && typeof router === 'function' && parseRoute().name === 'dashboard') router();
    } catch (error) { /* boot() will render normally */ }
  }, 0);
}());
