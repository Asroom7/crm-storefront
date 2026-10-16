/* Shared deterministic content/price rules; copied unchanged to the backend. */
(function (root, factory) {
  'use strict';
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  else root.StorefrontContentCore = core;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  const list = (v) => (Array.isArray(v) ? v : []);
  const ids = (v) => [
    ...new Set(
      list(v)
        .map(Number)
        .filter((n) => Number.isSafeInteger(n) && n > 0),
    ),
  ];
  const when = (v) => (v ? Date.parse(v) : null);
  const between = (start, end, now) =>
    (!start || (Number.isFinite(when(start)) && now >= when(start))) &&
    (!end || (Number.isFinite(when(end)) && now < when(end)));
  const basePrices = (p) => list(p?.storefrontOriginalPrices || p?.prices);
  const basePrice = (p) => {
    const values = basePrices(p)
      .map((r) => Number(r.price))
      .filter((v) => Number.isSafeInteger(v) && v > 0);
    return values.length ? Math.min(...values) : 0;
  };
  function discounted(price, offer) {
    if (!Number.isSafeInteger(price) || price <= 0 || !offer) return price;
    const value = Number(offer.value);
    if (!Number.isSafeInteger(value) || value <= 0) return price;
    if (offer.type === 'percent' && value < 100)
      return Math.max(1, price - Math.floor((price * value) / 100));
    if (offer.type === 'fixed' && value < price) return price - value;
    return price;
  }
  function offerFor(config, product, now = Date.now()) {
    const price = basePrice(product);
    let best = null;
    list(config?.sections).forEach((section) => {
      const st = section.settings || {},
        options = st.editorOptionsV1 || {},
        offer = st.offerV1;
      const enabled = typeof options.visible === 'boolean' ? options.visible : section.enabled !== false;
      if (section.type !== 'campaign' || !offer?.enabled || !enabled) return;
      if (!between(st.startsAt, st.endsAt, now) || !ids(st.productIds).includes(Number(product.id))) return;
      const rule = offer.overrides?.[product.id] || offer;
      const unitPrice = discounted(price, rule);
      if (unitPrice >= price || (best && unitPrice >= best.unitPrice)) return;
      best = {
        unitPrice,
        originalPrice: price,
        campaignId: section.id,
        allowCoupons: offer.allowCoupons === true,
        rule,
      };
    });
    return best;
  }
  function decorateProducts(products, config, now = Date.now()) {
    return list(products).map((p) => {
      const original = p.storefrontOriginalPrices ? { ...p, prices: p.storefrontOriginalPrices } : p;
      const offer = offerFor(config, original, now);
      if (!offer) {
        if (!p.storefrontOriginalPrices) return p;
        const {
          storefrontOriginalPrices,
          storefrontOffer,
          originalPrice,
          salePrice,
          discountPercent,
          ...rest
        } = original;
        return { ...rest, prices: storefrontOriginalPrices, price: basePrice(original) };
      }
      return {
        ...original,
        storefrontOriginalPrices: basePrices(original),
        storefrontOffer: {
          campaignId: offer.campaignId,
          allowCoupons: offer.allowCoupons,
        },
        price: offer.originalPrice,
        originalPrice: offer.originalPrice,
        salePrice: offer.unitPrice,
        discountPercent: Math.floor(((offer.originalPrice - offer.unitPrice) * 100) / offer.originalPrice),
        prices: basePrices(original).map((r) => ({ ...r, price: discounted(Number(r.price), offer.rule) })),
      };
    });
  }
  function lessons(theme, now = Date.now(), includeDrafts = false) {
    const library = theme?.educationLibraryV1;
    if (!library?.enabled && !includeDrafts) return [];
    return list(library?.items).filter(
      (r) => includeDrafts || (r.status === 'published' && between(r.publishAt, null, now)),
    );
  }
  function selectLessons(section, theme, now = Date.now()) {
    const st = section.settings || {},
      rows = lessons(theme, now),
      map = new Map(rows.map((r) => [r.id, r]));
    const selected = list(st.lessonIds)
      .map((id) => map.get(id))
      .filter(Boolean);
    const mode = st.educationMode || 'manual';
    const rest = rows.filter((r) => !selected.some((p) => p.id === r.id));
    if (mode === 'newest') rest.push(...selected);
    if (mode !== 'manual') rest.sort((a, b) => (when(b.createdAt) || 0) - (when(a.createdAt) || 0));
    return (mode === 'manual' ? selected : mode === 'newest' ? rest : selected.concat(rest)).slice(
      0,
      Number(st.limit) || 8,
    );
  }
  function selectProducts(section, products, rankedIds = []) {
    const st = section.settings || {},
      o = st.editorOptionsV1 || {};
    const excluded = new Set(ids(st.excludedProductIds));
    const available = list(products).filter(
      (p) =>
        p.isPublished !== false &&
        !excluded.has(Number(p.id)) &&
        (!o.inStockOnly || Number(p.stockQty) > 0) &&
        (!st.categoryId || Number(p.categoryId || p.category?.id) === Number(st.categoryId)),
    );
    const map = new Map(available.map((p) => [Number(p.id), p]));
    const manual = ids(st.productIds)
      .map((id) => map.get(id))
      .filter(Boolean);
    const auto = ids(rankedIds)
      .map((id) => map.get(id))
      .filter(Boolean);
    const mode = o.selectionMode || 'manual';
    let result = ['newest', 'category'].includes(st.collectionMode)
      ? available
      : mode === 'auto'
        ? auto
        : mode === 'hybrid'
          ? manual.concat(auto.filter((p) => !manual.includes(p)))
          : manual;
    if (['auto', 'hybrid'].includes(mode) && st.fallbackMode === 'newest')
      result = result.concat(available.filter((p) => !result.includes(p)));
    return result.slice(0, Math.max(1, Math.min(24, Number(st.limit) || 8)));
  }
  function validateContent(config, theme, strict = false) {
    const errors = [],
      library = theme?.educationLibraryV1;
    const seen = new Set();
    const mediaUrl = (u) => typeof u === 'string' && /^https?:\/\//i.test(u) && !/[<>\s]/.test(u);
    if (library) {
      if (!Array.isArray(library.items) || library.items.length > 300)
        errors.push('کتابخانه حداکثر ۳۰۰ آموزش می‌پذیرد');
      list(library.items).forEach((r) => {
        if (!r || !/^[\w-]{1,100}$/.test(r.id || '') || seen.has(r.id))
          errors.push('شناسه آموزش معتبر و یکتا باشد');
        if (!r) return;
        seen.add(r.id);
        if (!String(r.title || '').trim() || String(r.title).length > 180)
          errors.push('عنوان آموزش بین ۱ تا ۱۸۰ نویسه باشد');
        if (!mediaUrl(r.url)) errors.push('آدرس فیلم آموزشی معتبر نیست');
        if (r.poster && !mediaUrl(r.poster)) errors.push('آدرس کاور آموزش معتبر نیست');
        if (!['draft', 'published', 'archived'].includes(r.status)) errors.push('وضعیت آموزش معتبر نیست');
        if (r.publishAt && !Number.isFinite(when(r.publishAt))) errors.push('زمان انتشار آموزش معتبر نیست');
      });
    }
    list(config?.sections).forEach((s) => {
      const st = s.settings || {},
        offer = st.offerV1;
      if (offer?.enabled) {
        if (s.type !== 'campaign' || !ids(st.productIds).length)
          errors.push('برای پیشنهاد ویژه محصول انتخاب کنید');
        [offer, ...Object.values(offer.overrides || {})].forEach((r) => {
          if (
            !r ||
            !['percent', 'fixed'].includes(r.type) ||
            !Number.isSafeInteger(r.value) ||
            r.value <= 0 ||
            (r.type === 'percent' && r.value >= 100)
          )
            errors.push('تخفیف مبلغ مثبت یا درصد ۱ تا ۹۹ باشد');
        });
        if (
          (st.startsAt && !Number.isFinite(when(st.startsAt))) ||
          (st.endsAt && !Number.isFinite(when(st.endsAt)))
        )
          errors.push('زمان پیشنهاد معتبر نیست');
        if (st.startsAt && st.endsAt && when(st.endsAt) <= when(st.startsAt))
          errors.push('پایان پیشنهاد بعد از شروع باشد');
      }
      if (st.builderV1) {
        const elements = s.content?.elements;
        if (!Array.isArray(elements) || elements.length > 40) errors.push('هر بخش حداکثر ۴۰ جزء می‌پذیرد');
        list(elements).forEach((e) => {
          if (!e || !['heading', 'text', 'image', 'video', 'button', 'divider', 'faq'].includes(e.type)) {
            errors.push('نوع جزء بخش معتبر نیست');
            return;
          }
          if (strict && ['image', 'video'].includes(e.type) && !mediaUrl(e.url))
            errors.push('برای عکس یا ویدیوی بخش جدید فایل معتبر انتخاب کنید');
          if (strict && e.type === 'button' && (!String(e.text || '').trim() || !String(e.url || '').trim()))
            errors.push('متن و مقصد دکمهٔ بخش جدید را کامل کنید');
          if (strict && e.type === 'faq' && (!String(e.text || '').trim() || !String(e.answer || '').trim()))
            errors.push('پرسش و پاسخ بخش جدید را کامل کنید');
        });
      }
    });
    return [...new Set(errors)];
  }
  return {
    list,
    ids,
    between,
    basePrice,
    discounted,
    offerFor,
    decorateProducts,
    lessons,
    selectLessons,
    selectProducts,
    validateContent,
  };
});
