/* Dashboard best-seller visual layer.
   Merges the old featured-product and best-sellers dashboard blocks into one compact top-three row. */
(function () {
  'use strict';

  let productsCache = null;
  let processing = false;

  function safeText(value) {
    if (typeof esc === 'function') return esc(value == null ? '' : value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  function firstUsableImage(product) {
    if (!product) return '';
    try {
      if (typeof getProductImageUrl === 'function') {
        const resolved = getProductImageUrl(product);
        if (resolved) return resolved;
      }
    } catch (error) { /* fall through */ }

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
      } catch (error) { /* continue */ }
      try {
        const url = new URL(String(value), window.location.href);
        if (['http:', 'https:', 'blob:', 'data:'].includes(url.protocol)) return url.href;
      } catch (error) { /* malformed */ }
    }
    return '';
  }

  async function getProducts() {
    if (productsCache) return productsCache;
    try {
      if (typeof sellerApiFetch === 'function') {
        productsCache = await sellerApiFetch('/products');
        if (!Array.isArray(productsCache)) productsCache = [];
        return productsCache;
      }
    } catch (error) { /* keep UI usable */ }
    productsCache = [];
    return productsCache;
  }

  function priceLabel(product) {
    try {
      if (typeof fmtProductPrice === 'function') return fmtProductPrice(product);
    } catch (error) { /* fall through */ }
    const raw = Number(product && (product.salePrice || product.costPrice || product.price) || 0);
    return raw ? raw.toLocaleString('fa-IR') + ' تومان' : 'بدون قیمت';
  }

  function buildCard(product, rank, countText) {
    const name = safeText(product && product.name ? product.name : 'محصول');
    const image = firstUsableImage(product);
    const imageMarkup = image
      ? '<img class="top-three-card__image" src="' + safeText(image) + '" alt="' + name + '" loading="lazy" decoding="async">'
      : '<div class="top-three-card__fallback">' + (typeof ic === 'function' ? ic('box') : '◆') + '</div>';

    return '<button class="top-three-card" type="button" data-product="' + Number(product.id) + '" aria-label="مشاهده ' + name + '">' +
      imageMarkup +
      '<span class="top-three-card__scrim" aria-hidden="true"></span>' +
      '<span class="top-three-card__rank">' + (typeof faDigits === 'function' ? faDigits(rank) : rank) + '</span>' +
      '<div class="top-three-card__name">' + name + '</div>' +
      '<div class="top-three-card__footer">' +
        '<strong>' + safeText(priceLabel(product)) + '</strong>' +
        '<small>' + safeText(countText || '') + '</small>' +
      '</div>' +
    '</button>';
  }

  async function mergeDashboardBestSellers() {
    if (processing) return;
    const view = document.getElementById('view');
    if (!view || view.querySelector('[data-top-products-merged="1"]')) return;

    const titles = Array.from(view.querySelectorAll('.section-title'));
    const featuredTitle = titles.find(function (el) { return el.textContent.indexOf('محصول منتخب') !== -1; });
    const bestTitle = titles.find(function (el) { return el.textContent.indexOf('محصولات پرفروش') !== -1; });
    if (!featuredTitle) return;

    const hero = featuredTitle.nextElementSibling;
    const bestList = bestTitle && bestTitle.nextElementSibling && bestTitle.nextElementSibling.classList.contains('top-products')
      ? bestTitle.nextElementSibling
      : null;

    if (!bestList) {
      featuredTitle.innerHTML = (typeof ic === 'function' ? ic('star') : '') + ' محصولات پرفروش';
      featuredTitle.dataset.topProductsMerged = '1';
      return;
    }

    const rows = Array.from(bestList.querySelectorAll('.top-product-row')).slice(0, 3);
    if (!rows.length) return;

    processing = true;
    try {
      const products = await getProducts();
      const productMap = new Map(products.map(function (product) { return [Number(product.id), product]; }));
      const cards = rows.map(function (row, index) {
        const id = Number(row.dataset.product);
        const product = productMap.get(id);
        const count = row.querySelector('.top-product-row__count');
        return product ? buildCard(product, index + 1, count ? count.textContent.trim() : '') : '';
      }).filter(Boolean);

      if (!cards.length) return;

      const grid = document.createElement('div');
      grid.className = 'dashboard-top-three-products';
      grid.dataset.topProductsMerged = '1';
      grid.innerHTML = cards.join('');

      featuredTitle.innerHTML = (typeof ic === 'function' ? ic('star') : '') + ' محصولات پرفروش';
      featuredTitle.dataset.topProductsMerged = '1';
      if (hero && hero.parentNode) hero.parentNode.replaceChild(grid, hero);
      if (bestTitle && bestTitle.parentNode) bestTitle.parentNode.removeChild(bestTitle);
      if (bestList && bestList.parentNode) bestList.parentNode.removeChild(bestList);

      grid.querySelectorAll('[data-product]').forEach(function (card) {
        card.addEventListener('click', function () {
          const id = Number(card.dataset.product);
          if (typeof openProductForm === 'function') openProductForm(id);
        });
      });
    } finally {
      processing = false;
    }
  }

  function scheduleMerge() {
    Promise.resolve().then(mergeDashboardBestSellers);
  }

  const view = document.getElementById('view');
  if (view && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(scheduleMerge);
    observer.observe(view, { childList: true, subtree: true });
  }

  window.addEventListener('hashchange', scheduleMerge);
  setTimeout(scheduleMerge, 0);
}());
