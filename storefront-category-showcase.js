/* Category showcase — visual 2x2 category grid placed after the pink box. */
(function () {
  'use strict';

  const root = document.getElementById('storefront-home-root');
  if (!root) return;

  function asArray(value) { return Array.isArray(value) ? value : []; }

  function safeUrl(value) {
    if (!value) return '';
    if (typeof safeMediaUrl === 'function') return safeMediaUrl(value) || '';
    try {
      const url = new URL(String(value), location.href);
      return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
    } catch (error) {
      return '';
    }
  }

  function categoryImage(category, products) {
    const direct = safeUrl(category && (category.imageUrl || category.image || category.coverUrl || category.thumbnail));
    if (direct) return direct;

    const match = asArray(products).find(function (product) {
      const categoryId = product && (product.categoryId || (product.category && product.category.id));
      return Number(categoryId) === Number(category && category.id) && typeof getProductImageUrl === 'function' && getProductImageUrl(product);
    });
    return match && typeof getProductImageUrl === 'function' ? getProductImageUrl(match) : '';
  }

  function renderCard(category, products, index) {
    const image = categoryImage(category, products);
    const name = category && category.name ? String(category.name) : 'دسته‌بندی';
    const href = 'products.html?category=' + encodeURIComponent(category.id);
    const media = image
      ? '<img src="' + escapeHtml(image) + '" alt="' + escapeHtml(name) + '" loading="lazy" decoding="async">'
      : '<div class="sf-category-showcase-placeholder" aria-hidden="true"><span>✦</span></div>';

    return '<a class="sf-category-showcase-card tone-' + ((index % 4) + 1) + '" href="' + href + '">' +
      '<div class="sf-category-showcase-media">' + media + '</div>' +
      '<div class="sf-category-showcase-label"><strong>' + escapeHtml(name) + '</strong><span>مشاهده ‹</span></div>' +
    '</a>';
  }

  function sectionHtml(categories, products, block) {
    const settings = block && block.settings || {};
    const limit = Math.max(1, Math.min(8, Number(settings.limit) || 4));
    const rows = asArray(categories).slice(0, limit);
    const title = block && block.content && block.content.title ? String(block.content.title) : 'دسته‌بندی محصولات';

    return '<section class="sf-section sf-container sf-category-showcase" id="sf-categories" data-section-role="categories">' +
      '<div class="sf-category-showcase-head"><h2>' + escapeHtml(title) + '</h2><a href="products.html">همه دسته‌ها <span>‹</span></a></div>' +
      (rows.length
        ? '<div class="sf-category-showcase-grid">' + rows.map(function (category, index) { return renderCard(category, products, index); }).join('') + '</div>'
        : '<div class="sf-category-showcase-empty">هنوز دسته‌بندی ثبت نشده است.</div>') +
    '</section>';
  }

  if (window.StorefrontHome && window.StorefrontHome.registry) {
    window.StorefrontHome.registry.categories = function (block, ctx) {
      return sectionHtml(ctx.categories, ctx.products, block);
    };
  }

  async function ensureCategorySection() {
    if (root.querySelector('#sf-categories')) return;
    if (typeof fetchPublicCategories !== 'function' || typeof apiFetch !== 'function' || typeof SELLER_ID === 'undefined') return;

    try {
      const result = await Promise.all([
        fetchPublicCategories().catch(function () { return []; }),
        apiFetch('/products/public/' + SELLER_ID).catch(function () { return []; })
      ]);
      if (root.querySelector('#sf-categories')) return;

      const wrapper = document.createElement('div');
      wrapper.innerHTML = sectionHtml(result[0] || [], result[1] || [], { content: { title: 'دسته‌بندی محصولات' }, settings: { limit: 4 } });
      const section = wrapper.firstElementChild;
      if (!section) return;

      const pinkBox = root.querySelector('.sf-campaign-section');
      const bestSellers = root.querySelector('.sf-best-sellers');
      const anchor = pinkBox || bestSellers || root.lastElementChild;
      if (anchor && anchor.parentElement === root) root.insertBefore(section, anchor.nextElementSibling);
      else root.appendChild(section);
    } catch (error) {
      console.error('Category showcase failed:', error);
    }
  }

  window.addEventListener('storefront:home-ready', ensureCategorySection);
})();
