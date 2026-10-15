/* Pure draft operations. No defaults, migration, ordering or network side effects. */
(function (root, factory) {
  'use strict';
  const model = factory();
  if (typeof module === 'object' && module.exports) module.exports = model;
  else root.StorefrontEditorModel = model;
})(typeof window === 'undefined' ? globalThis : window, function () {
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
    return [...new Set(errors)];
  }
  function safeUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return true;
    if (/^(?:https?:\/\/|tel:|mailto:)/i.test(raw)) return true;
    return !/^[a-z]+:|^\/\/|\\|[<>]/i.test(raw);
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
    backupKey,
    readBackup,
  };
});
