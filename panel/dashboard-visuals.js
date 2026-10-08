/* Dashboard best-seller visual layer.
   Merges the old featured-product and best-sellers dashboard blocks into one compact top-three row. */
(function () {
  'use strict';

  let productsCache = null;
  let processing = false;
  let decisionCache = null;
  let decisionRequest = null;

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


  function dashboardRouteActive() {
    const route = location.hash.replace(/^#\/?/, '').split('/')[0];
    return !route || route === 'dashboard';
  }

  function moneyLabel(value) {
    const amount = Number(value || 0);
    if (typeof fmtPrice === 'function') return fmtPrice(amount);
    return amount.toLocaleString('fa-IR') + ' تومان';
  }

  function numberLabel(value) {
    const number = Number(value || 0);
    return typeof faDigits === 'function' ? faDigits(number) : String(number);
  }

  function changeLabel(metric, kind) {
    const current = Number(metric.today && metric.today[kind] || 0);
    const previous = Number(metric.yesterday && metric.yesterday[kind] || 0);
    const percent = metric[kind === 'amount' ? 'amountChangePercent' : 'countChangePercent'];
    if (previous === 0 && current > 0) return { text: 'شروع فروش نسبت به دیروز', tone: 'up' };
    if (current === previous) return { text: 'بدون تغییر نسبت به دیروز', tone: 'flat' };
    const direction = current > previous ? 'up' : 'down';
    const sign = current > previous ? '+' : '';
    const value = percent == null
      ? (kind === 'amount' ? moneyLabel(current - previous) : numberLabel(current - previous))
      : sign + numberLabel(percent) + '٪';
    return {
      text: value + ' نسبت به دیروز',
      tone: direction,
    };
  }

  async function getDecisionMetrics() {
    if (decisionCache) return decisionCache;
    if (decisionRequest) return decisionRequest;
    if (typeof sellerApiFetch !== 'function') return null;
    decisionRequest = sellerApiFetch('/dashboard/summary')
      .then(function (data) {
        decisionCache = data || null;
        return decisionCache;
      })
      .catch(function () { return null; })
      .finally(function () { decisionRequest = null; });
    return decisionRequest;
  }

  function metricCard(label, value, note, tone) {
    return '<div class="decision-metric ' + safeText(tone || '') + '">' +
      '<span class="decision-metric__label">' + safeText(label) + '</span>' +
      '<strong class="decision-metric__value">' + safeText(value) + '</strong>' +
      '<small class="decision-metric__note">' + safeText(note || '') + '</small>' +
    '</div>';
  }

  function productRows(items, type) {
    const rows = Array.isArray(items) ? items : [];
    if (!rows.length) {
      return '<div class="decision-empty">' + (type === 'low' ? 'هشدار موجودی فعالی نیست' : 'همه محصولات منتشرشده سابقه فروش دارند') + '</div>';
    }
    return rows.slice(0, 5).map(function (product) {
      const stock = Number(product.stockQty || 0);
      const meta = type === 'low'
        ? 'موجودی ' + numberLabel(stock) + ' · حد هشدار ' + numberLabel(product.lowStockAt || 0)
        : 'بدون فروش ثبت‌شده';
      return '<button type="button" class="decision-product-row" data-decision-product="' + Number(product.id) + '">' +
        '<span>' + safeText(product.name || 'محصول') + '</span><small>' + safeText(meta) + '</small>' +
      '</button>';
    }).join('');
  }

  function orderStatusHTML(statuses) {
    const rows = [
      ['در انتظار پرداخت', statuses.pendingPayment || 0],
      ['بررسی پرداخت', statuses.pendingReview || 0],
      ['آماده ارسال', statuses.readyToShip || 0],
      ['ارسال‌شده', statuses.shipped || 0],
      ['لغو / رد', statuses.cancelledOrRejected || 0],
    ];
    return rows.map(function (row) {
      return '<div class="decision-status"><strong>' + numberLabel(row[1]) + '</strong><span>' + row[0] + '</span></div>';
    }).join('');
  }

  async function injectDecisionMetrics() {
    if (!dashboardRouteActive()) return;
    const view = document.getElementById('view');
    if (!view || view.querySelector('[data-dashboard-decision="1"]')) return;
    const grid = view.querySelector('.dash-grid');
    if (!grid) return;

    const data = await getDecisionMetrics();
    if (!data || !data.decisionMetrics || !dashboardRouteActive()) return;
    const liveView = document.getElementById('view');
    if (!liveView || liveView.querySelector('[data-dashboard-decision="1"]')) return;
    const liveGrid = liveView.querySelector('.dash-grid');
    if (!liveGrid) return;

    const decision = data.decisionMetrics;
    const comparison = decision.dailyComparison || {};
    const amountChange = changeLabel(comparison, 'amount');
    const aov = decision.averageOrderValue30d || {};
    const repeat = decision.repeatPurchase || {};
    const statuses = decision.orderStatuses || {};

    const section = document.createElement('section');
    section.className = 'dashboard-decision-layer';
    section.dataset.dashboardDecision = '1';
    section.innerHTML =
      '<div class="section-title decision-section-title">' +
        (typeof ic === 'function' ? ic('target') : '') +
        ' شاخص‌های تصمیم‌گیری' +
      '</div>' +
      '<div class="decision-metrics-grid">' +
        metricCard('فروش امروز', moneyLabel(comparison.today && comparison.today.amount || 0), amountChange.text, amountChange.tone) +
        metricCard('میانگین سفارش ۳۰ روز', moneyLabel(aov.amount || 0), numberLabel(aov.orderCount || 0) + ' سفارش تکمیل‌شده', 'neutral') +
        metricCard('خرید تکراری', numberLabel(repeat.rate || 0) + '٪', numberLabel(repeat.repeatBuyers || 0) + ' مشتری تکراری از ' + numberLabel(repeat.buyers || 0) + ' خریدار', 'neutral') +
        metricCard('نیاز به توجه', numberLabel((statuses.pendingReview || 0) + (statuses.readyToShip || 0) + (decision.lowStockCount || 0)), 'پرداخت، ارسال و موجودی', 'attention') +
      '</div>' +
      '<div class="decision-statuses">' + orderStatusHTML(statuses) + '</div>' +
      '<div class="decision-lists">' +
        '<div class="decision-list-card"><div class="decision-list-head"><strong>هشدار موجودی</strong><span>' + numberLabel(decision.lowStockCount || 0) + '</span></div>' + productRows(data.lowStock, 'low') + '</div>' +
        '<div class="decision-list-card"><div class="decision-list-head"><strong>محصولات بدون فروش</strong><span>' + numberLabel(decision.noSaleProductCount || 0) + '</span></div>' + productRows(decision.noSaleProducts, 'no-sale') + '</div>' +
      '</div>';

    liveGrid.insertAdjacentElement('afterend', section);
    section.querySelectorAll('[data-decision-product]').forEach(function (row) {
      row.addEventListener('click', function () {
        const id = Number(row.dataset.decisionProduct);
        if (typeof openProductForm === 'function') openProductForm(id);
      });
    });
  }

  function scheduleMerge() {
    Promise.resolve().then(mergeDashboardBestSellers);
    Promise.resolve().then(injectDecisionMetrics);
  }

  const view = document.getElementById('view');
  if (view && typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(scheduleMerge);
    observer.observe(view, { childList: true, subtree: true });
  }

  window.addEventListener('hashchange', function () {
    if (dashboardRouteActive()) decisionCache = null;
    scheduleMerge();
  });
  setTimeout(scheduleMerge, 0);
}());
