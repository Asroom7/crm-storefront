/* Pure draft operations. No defaults, migration, ordering or network side effects. */
(function (root, factory) {
  'use strict';
  const model = factory(
    typeof module === 'object' && module.exports
      ? require('../storefront-content-core.js')
      : root.StorefrontContentCore,
  );
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.StorefrontEditorModel = model;
})(typeof window === 'undefined' ? globalThis : window, function (StorefrontContentCore) {
  'use strict';
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value);
  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!object(value)) return value;
    return Object.keys(value)
      .sort()
      .reduce((out, key) => {
        out[key] = canonical(value[key]);
        return out;
      }, {});
  }
  const equal = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const snapshot = (config, theme) => ({ config: clone(config), theme: clone(theme) });
  function setPath(target, path, value) {
    const keys = String(path).split('.');
    if (keys.some((key) => ['__proto__', 'prototype', 'constructor'].includes(key)))
      throw new Error('مسیر تنظیمات نامعتبر است');
    let cursor = target;
    keys.slice(0, -1).forEach((key) => {
      if (!object(cursor[key])) cursor[key] = {};
      cursor = cursor[key];
    });
    const key = keys[keys.length - 1];
    if (value === undefined) delete cursor[key];
    else cursor[key] = value;
  }
  function getPath(target, path) {
    return String(path)
      .split('.')
      .reduce((value, key) => (value == null ? undefined : value[key]), target);
  }
  function changedFields(before, after, path = '') {
    if (equal(before, after)) return [];
    if (
      (object(before) && object(after)) ||
      (before === undefined && object(after)) ||
      (after === undefined && object(before))
    ) {
      const previous = before || {},
        next = after || {};
      return [...new Set([...Object.keys(previous), ...Object.keys(next)])].flatMap((key) =>
        changedFields(previous[key], next[key], path ? path + '.' + key : key),
      );
    }
    return [{ path, before, after }];
  }
  function diff(before, after) {
    const oldRows = before.config.sections || [],
      newRows = after.config.sections || [];
    const oldMap = new Map(oldRows.map((row) => [row.id, row]));
    const newMap = new Map(newRows.map((row) => [row.id, row]));
    const changes = [];
    newRows.forEach((row) => {
      const old = oldMap.get(row.id);
      if (!old)
        changes.push({
          kind: 'added',
          id: row.id,
          type: row.type,
          title: row.content && row.content.title,
          fields: [],
        });
      else if (!equal(old, row))
        changes.push({
          kind: 'changed',
          id: row.id,
          type: row.type,
          title: row.content && row.content.title,
          fields: changedFields(old, row),
        });
    });
    oldRows
      .filter((row) => !newMap.has(row.id))
      .forEach((row) =>
        changes.push({
          kind: 'removed',
          id: row.id,
          type: row.type,
          title: row.content && row.content.title,
          fields: [],
        }),
      );
    const commonOld = oldRows.filter((row) => newMap.has(row.id)).map((row) => row.id);
    const commonNew = newRows.filter((row) => oldMap.has(row.id)).map((row) => row.id);
    if (!equal(commonOld, commonNew))
      changes.push({
        kind: 'order',
        id: '__order',
        fields: [{ path: 'order', before: commonOld, after: commonNew }],
      });
    if (!equal(before.theme, after.theme))
      changes.push({ kind: 'theme', id: '__theme', fields: changedFields(before.theme, after.theme) });
    return changes;
  }
  function restoreSection(current, version, id) {
    const next = clone(current);
    const target = next.config.sections.findIndex((row) => row.id === id);
    const source = version.config.sections.find((row) => row.id === id);
    if (target < 0 || !source) throw new Error('این بخش در هر دو نسخه موجود نیست');
    if (source.type !== next.config.sections[target].type) throw new Error('نوع بخش در دو نسخه یکسان نیست');
    next.config.sections[target] = clone(source);
    return next;
  }
  function references(url, snapshots) {
    const found = [];
    function visit(value, path, owner, scope) {
      if (value === url) found.push({ owner, scope, path });
      else if (Array.isArray(value))
        value.forEach((item, index) => visit(item, path + '[' + index + ']', owner, scope));
      else if (object(value))
        Object.keys(value).forEach((key) => {
          if (key === url) found.push({ owner, scope, path: path + '[' + key + ']' });
          visit(value[key], path ? path + '.' + key : key, owner, scope);
        });
    }
    snapshots.forEach((item) => {
      if (!item || !item.data) return;
      (item.data.config.sections || []).forEach((section) => visit(section, '', section.id, item.scope));
      visit(item.data.theme, 'theme', '__theme', item.scope);
    });
    return found;
  }
  function replaceMedia(config, oldUrl, newUrl) {
    function visit(value) {
      if (value === oldUrl) return newUrl;
      if (Array.isArray(value)) return value.map(visit);
      if (object(value))
        return Object.keys(value).reduce((out, key) => {
          out[key === oldUrl ? newUrl : key] = visit(value[key]);
          return out;
        }, {});
      return value;
    }
    return visit(config);
  }
  function validate(data) {
    const errors = [];
    if (!object(data) || !object(data.theme)) return ['تنظیمات صفحه نامعتبر است'];
    const rows = data.config && data.config.sections;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 40)
      return ['صفحه باید بین ۱ تا ۴۰ بخش داشته باشد'];
    const ids = new Set();
    rows.forEach((row) => {
      if (!row || !/^[a-zA-Z0-9_-]{1,100}$/.test(row.id || '') || ids.has(row.id))
        errors.push('شناسه بخش‌ها باید معتبر و یکتا باشد');
      if (row) ids.add(row.id);
      const c = (row && row.content) || {},
        s = (row && row.settings) || {};
      if (c.ctaUrl && !safeUrl(c.ctaUrl)) errors.push('لینک دکمه معتبر نیست');
      if (s.startsAt && s.endsAt && new Date(s.startsAt) >= new Date(s.endsAt))
        errors.push('زمان پایان پیشنهاد باید بعد از زمان شروع باشد');
    });
    if (typeof StorefrontContentCore !== 'undefined')
      errors.push(...StorefrontContentCore.validateContent(data.config, data.theme));
    return [...new Set(errors)];
  }
  function safeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return true;
    if (/^(?:https?:\/\/|tel:|mailto:)/i.test(raw)) return true;
    return !/^[a-z]+:|^\/\/|\\|[<>]/i.test(raw);
  }
  function preflight(data, context = {}) {
    const issues = [
      ...new Set([
        ...validate(data),
        ...(StorefrontContentCore
          ? StorefrontContentCore.validateContent(data.config, data.theme, true)
          : []),
      ]),
    ].map((message) => ({ level: 'error', message }));
    const resources = [],
      seen = new Set();
    const products = new Set((context.products || []).map((p) => Number(p.id)));
    const assets = new Map((context.assets || []).map((a) => [a.url, a.kind]));
    function addResource(row, url, kind, label) {
      if (!url) return;
      url = String(url);
      let parsed;
      try {
        parsed = new URL(url, 'https://editor.invalid/');
      } catch (_) {}
      const allowed = kind === 'image' ? ['http:', 'https:'] : ['http:', 'https:', 'mailto:', 'tel:'];
      const wrongImage =
        kind === 'image' &&
        (assets.get(url) === 'video' || /\.(mp4|webm|mov)(?:$|\/)/i.test(parsed?.pathname || ''));
      if (!safeUrl(url) || !parsed || !allowed.includes(parsed.protocol) || wrongImage) {
        issues.push({
          level: 'error',
          sectionId: row.id,
          message: label + (wrongImage ? ' باید فایل تصویر باشد' : ' نشانی معتبری ندارد'),
        });
        return;
      }
      if (kind === 'link' && !/^[a-z]+:/i.test(url) && parsed.pathname.endsWith('/product-detail.html')) {
        const id = Number(parsed.searchParams.get('id'));
        if (!products.has(id))
          issues.push({
            level: 'warning',
            sectionId: row.id,
            message: 'محصول مقصد دکمه در فهرست فعلی موجود نیست',
          });
      }
      const key = row.id + ':' + kind + ':' + url;
      if (!seen.has(key)) {
        seen.add(key);
        resources.push({ sectionId: row.id, url, kind, label });
      }
    }
    const native = ['search', 'videos', 'best-sellers', 'campaign', 'categories', 'footer'];
    (Array.isArray(data?.config?.sections) ? data.config.sections : []).forEach((row) => {
      if (!row) return;
      const st = row.settings || {},
        c = row.content || {},
        options = st.editorOptionsV1 || {};
      if (options.visible === false || (options.visible === undefined && row.enabled === false)) return;
      if (!native.includes(row.type) && st.editorManagedV1 !== true) return;
      const missing = (
        Array.isArray(st.productIds) && options.selectionMode !== 'auto' ? st.productIds : []
      ).filter((id) => !products.has(Number(id)));
      if (missing.length)
        issues.push({
          level: 'warning',
          sectionId: row.id,
          message: missing.length.toLocaleString('fa-IR') + ' محصول انتخاب‌شده در فهرست فعلی موجود نیست',
        });
      if (['hero', 'banner'].includes(row.type)) {
        const desktop = c.imageDesktopUrl || c.imageUrl;
        addResource(row, desktop, 'image', 'تصویر دسکتاپ');
        addResource(row, c.imageMobileUrl || desktop, 'image', 'تصویر موبایل');
      }
      if (c.ctaText) addResource(row, c.ctaUrl || 'products.html', 'link', 'مقصد دکمه');
      if (row.type === 'videos' && options.videoSource === 'library')
        (Array.isArray(st.videoUrls) ? st.videoUrls : []).forEach((url) =>
          addResource(row, st.videoPosters?.[url], 'image', 'تصویر شروع ویدیو'),
        );
    });
    const lessons = data.theme?.educationLibraryV1?.items || [];
    lessons
      .filter((r) => r.status === 'published')
      .forEach((r) => {
        addResource({ id: '__theme' }, r.poster, 'image', 'کاور آموزش ' + r.title);
        if (!safeUrl(r.url)) issues.push({ level: 'error', message: 'نشانی آموزش معتبر نیست' });
        if ((r.productIds || []).some((id) => !products.has(Number(id))))
          issues.push({ level: 'warning', message: 'محصول مرتبط با آموزش موجود نیست' });
      });
    (data.config.sections || []).forEach((row) => {
      if (row.settings?.builderV1)
        (row.content.elements || []).forEach((e) => {
          if (e.type === 'image') addResource(row, e.url, 'image', 'تصویر بخش جدید');
          if (e.type === 'video') addResource(row, e.poster, 'image', 'کاور ویدیو');
          if (e.type === 'button') addResource(row, e.url, 'link', 'مقصد دکمه');
          if (e.link) addResource(row, e.link, 'link', 'لینک تصویر');
        });
      if (row.settings?.offerV1?.enabled && context.products) {
        (row.settings.productIds || []).forEach((id) => {
          const p = context.products.find((p) => Number(p.id) === Number(id));
          const rule = row.settings.offerV1.overrides?.[id] || row.settings.offerV1;
          if (
            !p ||
            p.isPublished === false ||
            StorefrontContentCore.discounted(StorefrontContentCore.basePrice(p), rule) >=
              StorefrontContentCore.basePrice(p)
          )
            issues.push({
              level: 'error',
              sectionId: row.id,
              message: 'محصول یا قیمت پیشنهاد ویژه معتبر نیست',
            });
        });
      }
      if (row.settings?.editorOptionsV1?.videoSource === 'education') {
        if (!data.theme?.educationLibraryV1?.enabled)
          issues.push({ level: 'warning', sectionId: row.id, message: 'کتابخانهٔ آموزش غیرفعال است' });
        const selected = (row.settings.lessonIds || []).filter(
          (id) => !lessons.some((r) => r.id === id && r.status === 'published'),
        );
        if (selected.length)
          issues.push({
            level: 'warning',
            sectionId: row.id,
            message: 'یک آموزش انتخابی حذف، بایگانی یا پیش‌نویس شده است',
          });
      }
    });
    if (context.published) {
      const finance = (config) =>
        (config.sections || [])
          .filter((s) => s.settings?.offerV1?.enabled)
          .map((s) => ({
            id: s.id,
            productIds: s.settings.productIds,
            offer: s.settings.offerV1,
            startsAt: s.settings.startsAt,
            endsAt: s.settings.endsAt,
            enabled: s.enabled,
            visible: s.settings.editorOptionsV1?.visible,
          }));
      if (!equal(finance(context.published.config), finance(data.config)))
        issues.push({
          level: 'warning',
          message:
            'این انتشار پیشنهاد یا قیمت واقعی محصولات را در کل فروشگاه و سفارش‌ها تغییر می‌دهد؛ مبلغ نهایی و زمان‌ها را بررسی کنید.',
        });
    }
    return { issues, resources };
  }
  function backupKey(sellerId) {
    return 'crm-storefront-draft:v1:' + String(sellerId);
  }
  function readBackup(storage, key, pageId) {
    try {
      const value = JSON.parse(storage.getItem(key) || 'null');
      if (
        !value ||
        value.version !== 1 ||
        value.pageId !== pageId ||
        !value.snapshot ||
        !value.server ||
        validate(value.snapshot).length ||
        validate(value.server).length ||
        !Number.isFinite(value.savedAt) ||
        value.savedAt > Date.now() + 60000 ||
        Date.now() - value.savedAt > 7 * 86400000
      )
        return null;
      return value;
    } catch (_) {
      return null;
    }
  }
  return {
    clone,
    equal,
    snapshot,
    diff,
    changedFields,
    setPath,
    getPath,
    restoreSection,
    references,
    replaceMedia,
    validate,
    safeUrl,
    preflight,
    backupKey,
    readBackup,
  };
});
