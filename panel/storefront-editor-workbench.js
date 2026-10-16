/* Read-only on opening. Explicit edits save drafts; publishing requires review. */
(function () {
  'use strict';
  const M = window.StorefrontEditorModel;
  if (!M || typeof sellerApiFetch !== 'function') return;
  const N = {
    header: 'هدر فروشگاه',
    search: 'جستجو و ناوبری',
    videos: 'جعبه جادویی',
    'best-sellers': 'پرفروش‌ترین‌ها',
    campaign: 'جعبه صورتی',
    categories: 'دسته‌بندی محصولات',
    footer: 'فوتر',
    hero: 'بنر اصلی',
    banner: 'بنر تبلیغاتی',
    'product-collection': 'مجموعه محصولات',
    'support-banner': 'بنر پشتیبانی',
    trust: 'مزایای فروشگاه',
  };
  const FIXED = ['search', 'videos', 'best-sellers', 'campaign', 'categories', 'footer'];
  const EXTRA = ['hero', 'banner', 'product-collection', 'support-banner', 'trust'];
  const PREVIEW_SELECTORS = {
    search: '.sf-search-block',
    videos: '.sf-video-section',
    'best-sellers': '.sf-best-sellers',
    campaign: '.sf-campaign-section',
    categories: '#sf-categories',
    footer: '.sf-footer',
  };
  const E = {
    root: null,
    page: null,
    config: null,
    theme: null,
    server: null,
    published: null,
    products: [],
    categories: [],
    assets: [],
    activeSection: null,
    tab: 'content',
    device: 'desktop',
    scope: 'shared',
    pane: 'preview',
    undo: [],
    redo: [],
    group: null,
    loading: false,
    saving: false,
    publishing: false,
    conflict: false,
    error: '',
    iframe: null,
    timer: 0,
    previewTimer: 0,
    previewVersion: null,
    mediaQuery: '',
    mediaKind: 'all',
    modalEpoch: 0,
    previewSections: null,
    hiddenSectionsOpen: false,
    sectionQuery: '',
  };
  const $ = (s, b) => (b || E.root).querySelector(s),
    $$ = (s, b) => Array.from((b || E.root).querySelectorAll(s));
  const esc = (v) =>
    String(v == null ? '' : v).replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const fa = (n) => Number(n).toLocaleString('fa-IR'),
    snap = () => M.snapshot(E.config, E.theme),
    rows = () => E.config?.sections || [],
    active = () => rows().find((s) => s.id === E.activeSection);
  const title = (s) => s?.content?.title || N[s?.type] || s?.type || '',
    endpoint = '/storefront/editor/home';
  const btn = (a, t, p = false, attr = '') =>
    `<button type="button" class="sfe-button${p ? ' sfe-primary' : ''}" data-action="${a}" ${attr}>${t}</button>`;
  const ico = (n) => (typeof ic === 'function' ? ic(n) : '');
  const tell = (t) => {
    if (typeof toast === 'function') toast(t);
  };
  const image = (p) => p?.media?.find((m) => m.kind === 'image')?.url || p?.imageUrl || '';
  const price = (p) =>
    typeof getProductPriceLabel === 'function' ? getProductPriceLabel(p) : fa(p.price || 0) + ' تومان';
  function storageKey() {
    let id = 'seller';
    try {
      id = getSellerSession()?.seller?.id || id;
    } catch (_) {}
    return M.backupKey(id);
  }
  const dirty = () => E.server && !M.equal(E.server, snap());
  const unpublished = () => (E.published ? M.diff(E.published, snap()) : []);
  function backup() {
    try {
      if (!dirty()) return localStorage.removeItem(storageKey());
      localStorage.setItem(
        storageKey(),
        JSON.stringify({
          version: 1,
          pageId: E.page.id,
          savedAt: Date.now(),
          server: E.server,
          snapshot: snap(),
        }),
      );
    } catch (_) {}
  }
  function history(group) {
    if (group && E.group?.key === group && Date.now() - E.group.at < 1200) {
      E.group.at = Date.now();
      return;
    }
    E.undo.push(snap());
    if (E.undo.length > 60) E.undo.shift();
    E.redo = [];
    E.group = group ? { key: group, at: Date.now() } : null;
  }
  function changed() {
    E.previewVersion = null;
    if ($('[data-version-bar]')) $('[data-version-bar]').hidden = true;
    E.error = '';
    backup();
    status();
    outline();
    preview();
    clearTimeout(E.timer);
    if (!E.conflict) E.timer = setTimeout(() => save(false), 1000);
  }
  function mutate(fn) {
    history();
    fn();
    changed();
    inspector();
  }
  function undo(redo = false) {
    const from = redo ? E.redo : E.undo,
      to = redo ? E.undo : E.redo;
    if (!from.length) return;
    to.push(snap());
    const s = from.pop();
    E.config = s.config;
    E.theme = s.theme;
    E.group = null;
    changed();
    inspector();
  }
  function field(text, path, value, type = 'text', attr = '') {
    return `<label class="sfe-field"><span>${esc(text)}</span><input data-field="${esc(path)}" type="${type}" value="${esc(value === undefined ? '' : value)}" ${attr}><small data-field-error role="alert"></small></label>`;
  }
  function area(text, path, value) {
    return `<label class="sfe-field"><span>${esc(text)}</span><textarea data-field="${esc(path)}" rows="3" maxlength="2000">${esc(value || '')}</textarea><small data-field-error role="alert"></small></label>`;
  }
  function select(text, path, value, options) {
    return `<label class="sfe-field"><span>${esc(text)}</span><select data-field="${esc(path)}">${options.map(([k, t]) => `<option value="${esc(k)}" ${String(value) === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select><small data-field-error role="alert"></small></label>`;
  }
  function check(text, path, value) {
    return `<label class="sfe-check"><input type="checkbox" data-field="${esc(path)}" ${value ? 'checked' : ''}><span>${esc(text)}</span></label>`;
  }
  function owner() {
    return E.activeSection?.startsWith('__') || active()?.type === 'footer' ? E.theme : active();
  }
  function applyField(el) {
    if (el.dataset.field === '__note') return;
    const target = owner();
    if (!target) return;
    const error = el.closest('.sfe-field')?.querySelector('[data-field-error]');
    if (!el.checkValidity() || (el.dataset.field.endsWith('ctaUrl') && !M.safeUrl(el.value))) {
      if (error) error.textContent = 'مقدار معتبر وارد کنید';
      el.setAttribute('aria-invalid', 'true');
      return;
    }
    if (error) error.textContent = '';
    el.removeAttribute('aria-invalid');
    let value =
      el.type === 'checkbox'
        ? el.checked
        : ['number', 'range'].includes(el.type)
          ? el.value === ''
            ? undefined
            : Number(el.value)
          : el.value;
    if (el.type === 'datetime-local') value = value ? new Date(value).toISOString() : null;
    if (M.equal(M.getPath(target, el.dataset.field), value)) return;
    history(E.activeSection + ':' + el.dataset.field);
    M.setPath(target, el.dataset.field, value);
    if (active()?.type === 'campaign' && el.dataset.field === 'settings.startsAt') {
      M.setPath(target, 'settings.editorOptionsV1.scheduleEnabled', true);
      const toggle = $('[data-field="settings.editorOptionsV1.scheduleEnabled"]');
      if (toggle) toggle.checked = true;
    }
    if (
      E.activeSection === '__theme' &&
      ['buttonRadius', 'cardRadius', 'fontFamily', 'sectionSpacing', 'globalPadding'].includes(
        el.dataset.field,
      )
    )
      M.setPath(E.theme, 'editorThemeV1.' + el.dataset.field, value);
    const output = el.parentElement.querySelector('output');
    if (output) output.textContent = fa(value);
    changed();
  }
  function mount(view) {
    E.previewObserver?.disconnect();
    E.lastPreviewSection = null;
    E.previewSections = null;
    E.root = view;
    view.classList.add('sfe-host');
    view.innerHTML = `<div class="sfe-workbench" data-storefront-workbench>
    <header class="sfe-topbar"><div class="sfe-heading">${btn('back', ico('chevR'), false, 'aria-label="بازگشت به تنظیمات"')}<div><h2>ویرایش فروشگاه</h2><span>صفحه اصلی</span></div><span class="sfe-badge">پیش‌نویس</span></div><div class="sfe-actions">${btn('undo', '↶', false, 'aria-label="برگشت تغییر"')}${btn('redo', '↷', false, 'aria-label="تکرار تغییر"')}${btn('media', 'رسانه‌ها')}${btn('versions', 'نسخه‌ها')}${btn('save', 'ذخیره پیش‌نویس')}${btn('review', 'مرور و انتشار', true)}</div></header>
    <div class="sfe-notice" data-notice role="alert" hidden></div><nav class="sfe-mobile-nav" aria-label="قسمت‌های ویرایشگر">${['sections', 'preview', 'settings'].map((k, i) => `<button type="button" data-pane="${k}" aria-pressed="${k === E.pane}">${['بخش‌ها', 'پیش‌نمایش', 'تنظیمات بخش'][i]}</button>`).join('')}</nav>
    <div class="sfe-workspace"><aside class="sfe-outline"><div class="sfe-pane-head"><strong>ساختار صفحه</strong><span>ترتیب فعلی فروشگاه</span></div><div data-outline></div><div class="sfe-outline-foot">${btn('add', 'افزودن بخش', true)}${btn('theme', 'هویت بصری فروشگاه')}</div></aside><main class="sfe-canvas"><div class="sfe-canvas-bar"><strong>پیش‌نمایش زنده</strong><div class="sfe-devices">${['desktop', 'tablet', 'mobile'].map((k, i) => `<button type="button" data-device="${k}" aria-pressed="${k === E.device}">${['دسکتاپ', 'تبلت', 'موبایل'][i]}</button>`).join('')}</div></div><div data-version-bar class="sfe-version-preview" hidden></div><div class="sfe-preview-stage"><div class="sfe-frame-wrap" data-frame-wrap data-device="${E.device}"><iframe data-preview-frame title="پیش‌نمایش فروشگاه" src="../index.html?editorPreview=1&editorBuild=20261016-studio"></iframe></div></div></main><aside class="sfe-inspector"><div class="sfe-sheet-handle" aria-hidden="true"></div><div data-inspector></div></aside></div>
    <footer class="sfe-statusbar"><span data-save-status aria-live="polite"></span><span data-publish-status aria-live="polite"></span></footer><div class="sfe-dialog-overlay" data-overlay hidden><section class="sfe-dialog" role="dialog" aria-modal="true" aria-labelledby="sfe-dialog-title"><header><h3 id="sfe-dialog-title"></h3>${btn('close', '×', false, 'aria-label="بستن"')}</header><div data-dialog-body></div><footer data-dialog-footer></footer></section></div></div>`;
    E.iframe = $('[data-preview-frame]');
    $('.sfe-outline .sfe-pane-head').insertAdjacentHTML(
      'afterend',
      '<label class="sfe-outline-search"><span>جستجوی بخش‌ها</span><input type="search" data-section-query placeholder="نام بخش یا نوع آن" aria-label="جستجوی بخش‌ها"></label>',
    );
    $('[data-section-query]').value = E.sectionQuery;
    $('.sfe-actions').insertAdjacentHTML(
      'afterbegin',
      btn('search-settings', 'جستجو', false, 'aria-label="جستجوی تنظیمات" aria-keyshortcuts="Control+K"'),
    );
    $('.sfe-actions').insertAdjacentHTML(
      'afterbegin',
      btn('studio-library', 'آموزش‌ها') + btn('studio-categories', 'دسته‌ها') + btn('studio-menu', 'منو'),
    );
    E.iframe.addEventListener('load', bridge);
    view.onclick = click;
    view.oninput = (e) => {
      if (routeActive() && e.target.matches('[data-section-query]')) {
        E.sectionQuery = e.target.value;
        outline();
        return;
      }
      if (routeActive() && e.target.matches('[data-field]')) applyField(e.target);
    };
    view.onchange = (e) => {
      if (routeActive() && e.target.matches('[data-field]')) applyField(e.target);
    };
    view.onfocusout = (e) => {
      if (e.target.matches('[data-field]')) E.group = null;
    };
    outline();
    inspector();
    status();
    pane(E.pane);
  }
  function outline() {
    if (!E.root || !$('[data-outline]')) return;
    const current = structure();
    const match = (s, reason = '') =>
      matchesQuery(title(s) + ' ' + (N[s.type] || '') + ' ' + reason, E.sectionQuery);
    const visible = current.visible.filter((s) => match(s)),
      hidden = current.hidden.filter((s) => match(s, hiddenLabel(s)));
    const row = (s, reason = '') =>
      `<button type="button" class="sfe-outline-row ${E.activeSection === s.id ? 'is-selected' : ''}" data-select="${esc(s.id)}" aria-pressed="${E.activeSection === s.id}"><span class="sfe-section-mark">${ico(s.type === 'videos' ? 'play' : s.type === 'best-sellers' ? 'star' : 'box')}</span><span><strong>${esc(title(s))}</strong><small>${esc(reason || (s.template ? 'نمایش توسط قالب' : FIXED.includes(s.type) || s.type === 'header' ? 'جایگاه ثابت' : N[s.type] || s.type))}</small></span></button>`;
    const html =
      `<div class="sfe-outline-label"><span>در پیش‌نمایش ${E.device === 'mobile' ? 'موبایل' : E.device === 'tablet' ? 'تبلت' : 'دسکتاپ'}</span><span>${fa(visible.length)}</span></div><div data-visible-sections>${visible.map((s) => row(s)).join('')}</div>` +
      (hidden.length
        ? `<details class="sfe-hidden-sections" data-hidden-sections><summary><span>بخش‌های پنهان</span><span>${fa(hidden.length)}</span></summary><p>در پیش‌نمایش فعلی دیده نمی‌شوند. برای بررسی، یک بخش را انتخاب کنید.</p>${hidden.map((s) => row(s, hiddenLabel(s))).join('')}</details>`
        : '') +
      (!visible.length && !hidden.length
        ? '<p class="sfe-help" role="status">بخشی با این عبارت پیدا نشد.</p>'
        : '');
    const target = $('[data-outline]');
    if (target.dataset.markup !== html) {
      const focused = target.contains(document.activeElement) ? document.activeElement.dataset.select : null;
      target.innerHTML = html;
      target.dataset.markup = html;
      const group = $('[data-hidden-sections]');
      if (group) {
        group.open = !!E.sectionQuery || E.hiddenSectionsOpen;
        group.ontoggle = () => {
          if (!E.sectionQuery) E.hiddenSectionsOpen = group.open;
        };
      }
      if (focused)
        target.querySelector('[data-select="' + CSS.escape(focused) + '"]')?.focus({ preventScroll: true });
    }
    sectionNotice();
  }
  function hiddenKind(s) {
    if (EXTRA.includes(s.type) && s.settings?.editorManagedV1 !== true) return 'legacy';
    if (!FIXED.includes(s.type) && !EXTRA.includes(s.type)) return 'unsupported';
    const visible = s.settings?.editorOptionsV1?.visible;
    if (s.type !== 'footer' && (visible === false || (visible === undefined && s.enabled === false)))
      return 'disabled';
    const start =
      s.type === 'campaign' && s.settings?.editorOptionsV1?.scheduleEnabled === true && s.settings?.startsAt;
    const skew = E.iframe?.contentWindow?.StorefrontHome?.__editorContext?.clockSkewMs || 0;
    if (start && new Date(start).getTime() > Date.now() + skew) return 'scheduled';
    return 'absent';
  }
  function matchesQuery(text, query) {
    const normalize = (value) =>
      String(value || '')
        .normalize('NFKC')
        .replace(/[يى]/g, 'ی')
        .replace(/ك/g, 'ک')
        .replace(/\u200c/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    return normalize(text).includes(normalize(query));
  }
  function searchSettings() {
    const index = [];
    const collect = (id, name, tab, html) => {
      const template = document.createElement('template');
      template.innerHTML = html;
      template.content.querySelectorAll('[data-field]').forEach((el) => {
        const span = el.closest('label')?.querySelector('span'),
          label = span?.firstChild?.textContent || span?.textContent;
        if (!label || el.dataset.field === '__note') return;
        const scoped = el.dataset.field.includes('.' + E.scope + '.');
        (scoped ? ['shared', 'mobile', 'desktop'] : ['']).forEach((scope) => {
          const field = scoped
            ? el.dataset.field.replace('.' + E.scope + '.', '.' + scope + '.')
            : el.dataset.field;
          const suffix = { shared: 'مشترک', mobile: 'موبایل', desktop: 'دسکتاپ' }[scope] || '';
          index.push({ id, name, tab, field, scope, label: label + (suffix ? ' · ' + suffix : '') });
        });
      });
    };
    collect('__header', N.header, 'content', chrome('header'));
    collect(rows().find((s) => s.type === 'footer')?.id || '__footer', N.footer, 'content', chrome('footer'));
    collect('__theme', 'هویت بصری فروشگاه', 'content', theme());
    rows()
      .filter((s) => s.type !== 'footer')
      .forEach((s) => {
        collect(s.id, title(s), 'content', content(s));
        collect(s.id, title(s), 'layout', layout(s));
        collect(s.id, title(s), 'visibility', visibility(s));
      });
    dialog(
      'جستجوی تنظیمات',
      '<label class="sfe-field"><span>نام تنظیم یا بخش</span><input type="search" data-settings-query placeholder="مثلاً فاصله کارت‌ها، لوگو یا شماره پشتیبانی"></label><div data-settings-results></div>',
    );
    const draw = () => {
      const q = $('[data-settings-query]').value,
        matches = index.filter((item) => matchesQuery(item.name + ' ' + item.label, q));
      $('[data-settings-results]').innerHTML =
        `<p class="sfe-search-count" role="status">${fa(matches.length)} نتیجه${matches.length > 40 ? '؛ برای یافتن سریع‌تر، عبارت دقیق‌تری بنویسید' : ''}</p>` +
        matches
          .slice(0, 40)
          .map(
            (item) =>
              `<button type="button" class="sfe-search-result" data-find-section="${esc(item.id)}" data-find-tab="${item.tab}" data-find-field="${esc(item.field)}" data-find-scope="${item.scope}"><strong>${esc(item.label)}</strong><small>${esc(item.name)}</small></button>`,
          )
          .join('');
    };
    $('[data-settings-query]').oninput = draw;
    draw();
    $('[data-settings-query]').focus({ preventScroll: true });
  }
  function hiddenLabel(s) {
    return {
      legacy: 'قدیمی؛ هنوز فعال نشده',
      disabled: 'نمایش خاموش است',
      unsupported: 'در قالب فعلی پشتیبانی نمی‌شود',
      absent: 'در پیش‌نمایش نمایش ندارد',
      scheduled: 'در انتظار زمان شروع',
    }[hiddenKind(s)];
  }
  function structure() {
    const all = [{ id: '__header', type: 'header' }, ...rows()];
    if (!rows().some((s) => s.type === 'footer')) all.push({ id: '__footer', type: 'footer' });
    const lookup = new Map(all.map((s) => [s.id, s]));
    // DOM order is a view of the draft. Never sort or normalize the stored rows.
    const order = E.previewSections || [
      { id: '__header' },
      ...FIXED.filter((type) => type !== 'footer').flatMap((type) => rows().filter((s) => s.type === type)),
      ...rows().filter((s) => EXTRA.includes(s.type) && s.settings?.editorManagedV1 === true),
      all.find((s) => s.type === 'footer'),
    ];
    const visible = order
      .filter(Boolean)
      .filter((entry) => entry.visible !== false)
      .map((entry) => {
        return (
          lookup.get(entry.id) || (entry.type ? { id: entry.id, type: entry.type, template: true } : null)
        );
      })
      .filter(
        (s) =>
          s &&
          (s.type === 'header' ||
            s.type === 'footer' ||
            s.template ||
            !['legacy', 'disabled', 'unsupported'].includes(hiddenKind(s))),
      );
    const ids = new Set(visible.map((s) => s.id));
    return { visible, hidden: rows().filter((s) => !ids.has(s.id)) };
  }
  function sectionNotice() {
    const node = E.root?.querySelector('[data-section-notice]'),
      s = active();
    if (!node || !s) return;
    const hidden = structure().hidden.some((row) => row.id === s.id);
    let html = '';
    if (hidden) {
      const kind = hiddenKind(s);
      const text = {
        legacy:
          'این بخش از تنظیمات قدیمی مانده و در فروشگاه نمایش داده نمی‌شود. می‌توانید محتوایش را آماده کنید و سپس آن را در پیش‌نویس فعال کنید.',
        disabled: 'نمایش این بخش خاموش است. از تنظیمات نمایش می‌توانید آن را دوباره در پیش‌نویس نشان دهید.',
        unsupported: 'قالب فعلی این نوع بخش را نمایش نمی‌دهد. محتوای ذخیره‌شده آن حفظ شده است.',
        absent: 'این بخش در پیش‌نمایش فعلی نمایش ندارد. محتوا و تنظیمات نمایش آن را بررسی کنید.',
        scheduled: 'این بخش در انتظار زمان شروع پیشنهاد است و پس از رسیدن آن زمان نمایش داده می‌شود.',
      }[kind];
      html =
        `<strong>${esc(hiddenLabel(s))}</strong><p>${text}</p>` +
        (kind === 'legacy'
          ? btn('activate-section', 'فعال‌سازی در پیش‌نویس')
          : ['disabled', 'scheduled'].includes(kind)
            ? btn('section-visibility', 'تنظیمات نمایش')
            : '');
    }
    node.hidden = !html;
    if (node.innerHTML !== html) node.innerHTML = html;
  }
  function choose(id) {
    const wasVersion = !!E.previewVersion;
    if (structure().hidden.some((s) => s.id === id)) E.hiddenSectionsOpen = true;
    E.lastPreviewSection = null;
    E.activeSection = id;
    E.previewVersion = null;
    $('[data-version-bar]').hidden = true;
    if (wasVersion) preview();
    E.tab = 'content';
    outline();
    inspector();
    pane('settings');
    highlight();
    status();
  }
  function fit() {
    if (!E.iframe || !E.root) return;
    const stage = $('.sfe-preview-stage');
    if (!stage || stage.clientWidth < 30) return;
    const width = { desktop: 1180, tablet: 768, mobile: 390 }[E.device],
      scale = Math.min(1, (stage.clientWidth - 24) / width),
      small = matchMedia('(max-width:850px)').matches && E.pane === 'settings',
      height = (small ? 220 : 590) / scale;
    const wrap = $('[data-frame-wrap]');
    wrap.style.width = width * scale + 'px';
    wrap.style.height = height * scale + 'px';
    E.iframe.style.width = width + 'px';
    E.iframe.style.height = height + 'px';
    E.iframe.style.transform = 'scale(' + scale + ')';
    E.iframe.style.transformOrigin = 'top right';
  }
  function pane(value) {
    E.pane = value;
    if (!E.root) return;
    $('[data-storefront-workbench]').dataset.pane = value;
    $$('[data-pane]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pane === value)));
    requestAnimationFrame(fit);
  }
  function chrome(kind) {
    const p = kind === 'header' ? 'editorHeaderV1' : 'editorFooterV1',
      v = E.theme[p] || {};
    return kind === 'header'
      ? field('لوگوی متنی', p + '.logoText', v.logoText, 'text', 'placeholder="نام فعلی فروشگاه"') +
          field('متن اطلاع‌رسانی', p + '.announcement', v.announcement, 'text', 'maxlength="180"') +
          check('نمایش منو', p + '.showMenu', v.showMenu !== false) +
          check('نمایش سبد خرید', p + '.showCart', v.showCart !== false)
      : area('توضیح فروشگاه', p + '.about', v.about) +
          field('شماره پشتیبانی', p + '.phone', v.phone, 'tel') +
          field('ایمیل پشتیبانی', p + '.email', v.email, 'email');
  }
  function imageField(text, path, url) {
    return `<div class="sfe-image-field">${url ? `<img src="${esc(url)}" alt="${esc(text)}">` : '<span>تصویر انتخاب نشده</span>'}<strong>${text}</strong>${btn('choose-image', 'انتخاب از کتابخانه', false, `data-path="${path}"`)}${url ? btn('crop', 'برش تصویر', false, `data-path="${path}" data-url="${esc(url)}"`) : ''}</div>`;
  }
  function productSummary(s) {
    const ids = s.settings?.productIds || [];
    return ids.length
      ? '<div class="sfe-selected-list">' +
          ids
            .slice(0, 8)
            .map((id) => {
              const p = E.products.find((p) => Number(p.id) === Number(id));
              return `<div>${image(p) ? `<img src="${esc(image(p))}" alt="">` : ico('box')}<span>${esc(p?.name || 'محصول ' + id)}<small>${p ? esc(price(p)) : 'در فهرست محصولات موجود نیست'}</small></span></div>`;
            })
            .join('') +
          '</div>'
      : '<div class="sfe-help">محصولی به‌صورت دستی انتخاب نشده است.</div>';
  }
  function content(s) {
    const c = s.content || {},
      st = s.settings || {};
    if (s.settings?.builderV1)
      return (
        field('عنوان بخش', 'content.title', c.title, 'text', 'maxlength="180"') +
        (window.StorefrontEditorStudio?.content(s) || '')
      );
    if (s.type === 'search')
      return '<div class="sfe-help">جستجو از محصولات و دسته‌بندی‌های فعلی استفاده می‌کند.</div>';
    if (s.type === 'footer') return chrome('footer');
    let html =
      s.type === 'campaign'
        ? '<div class="sfe-help">نام و ظاهر جعبه صورتی مطابق قالب فعلی است. محصولات این بخش باید تخفیف واقعی داشته باشند.</div>'
        : field('عنوان بخش', 'content.title', c.title, 'text', 'maxlength="180"');
    if (!['categories', 'campaign'].includes(s.type))
      html += area('توضیح کوتاه', 'content.subtitle', c.subtitle);
    if (['hero', 'banner', 'support-banner', 'trust'].includes(s.type))
      html += area('متن', 'content.text', c.text);
    if (['hero', 'banner', 'support-banner'].includes(s.type))
      html +=
        field('متن دکمه', 'content.ctaText', c.ctaText) +
        field('مقصد دکمه', 'content.ctaUrl', c.ctaUrl, 'text', 'placeholder="products.html"') +
        btn('links', 'انتخاب محصول یا دسته‌بندی مقصد');
    if (['hero', 'banner'].includes(s.type))
      html +=
        imageField('تصویر دسکتاپ', 'content.imageDesktopUrl', c.imageDesktopUrl || c.imageUrl) +
        imageField('تصویر موبایل', 'content.imageMobileUrl', c.imageMobileUrl);
    if (['best-sellers', 'campaign', 'product-collection'].includes(s.type)) {
      if (s.type === 'best-sellers')
        html += select(
          'روش انتخاب محصولات',
          'settings.editorOptionsV1.selectionMode',
          st.editorOptionsV1?.selectionMode || 'current',
          [
            ['current', 'انتخاب فعلی'],
            ['manual', 'انتخاب دستی'],
            ['auto', 'خودکار از فروش واقعی'],
            ['hybrid', 'منتخب‌ها و سپس فروش واقعی'],
          ],
        );
      html += productSummary(s) + btn('products', 'انتخاب و ترتیب محصولات');
      if (s.type === 'best-sellers') html += btn('promotions', 'برچسب تخفیف نمایشی');
    }
    if (s.type === 'videos')
      html +=
        select(
          'منبع ویدیوها',
          'settings.editorOptionsV1.videoSource',
          st.editorOptionsV1?.videoSource || 'products',
          [
            ['products', 'ویدیوهای محصولات'],
            ['library', 'ویدیوهای کتابخانه'],
            ['education', 'کتابخانهٔ آموزش‌های مستقل'],
          ],
        ) +
        `<div class="sfe-help">${fa((st.videoUrls || []).length)} ویدیو در فهرست انتخابی</div>` +
        btn('videos', 'انتخاب، ترتیب و تصویر شروع');
    if (['videos', 'best-sellers', 'categories', 'campaign', 'product-collection'].includes(s.type))
      html += field(
        'حداکثر تعداد آیتم',
        'settings.limit',
        st.limit,
        'number',
        `min="1" max="${s.type === 'categories' ? 8 : s.type === 'videos' ? 12 : 20}" placeholder="طبق قالب"`,
      );
    return html + (window.StorefrontEditorStudio?.content(s) || '');
  }
  function layout(s) {
    const v = s.settings?.editorOptionsV1?.[E.scope] || {},
      p = 'settings.editorOptionsV1.' + E.scope + '.',
      cards = ['videos', 'best-sellers', 'categories', 'campaign', 'product-collection'].includes(s.type);
    const range = (text, key, min, max, fallback) =>
      `<label class="sfe-field"><span>${text}<output>${fa(v[key] ?? fallback)}</output></span><input type="range" min="${min}" max="${max}" value="${v[key] ?? fallback}" data-field="${p + key}"><small>با حرکت کنترل، مقدار اختصاصی ثبت می‌شود.</small></label>`;
    return (
      `<div class="sfe-scope-label">محدوده تنظیم: <strong>${{ shared: 'هر دو دستگاه', mobile: 'فقط موبایل', desktop: 'فقط دسکتاپ' }[E.scope]}</strong></div><div class="sfe-scope-switch">${['shared', 'mobile', 'desktop'].map((k) => `<button type="button" data-scope="${k}" aria-pressed="${E.scope === k}">${{ shared: 'مشترک', mobile: 'موبایل', desktop: 'دسکتاپ' }[k]}</button>`).join('')}</div>` +
      field(
        'رنگ پس‌زمینه',
        p + 'backgroundColor',
        v.backgroundColor,
        'text',
        'placeholder="رنگ فعلی / #FFFFFF" pattern="#[0-9a-fA-F]{6}"',
      ) +
      field(
        'رنگ متن',
        p + 'textColor',
        v.textColor,
        'text',
        'placeholder="رنگ فعلی / #452B45" pattern="#[0-9a-fA-F]{6}"',
      ) +
      range('فاصله بالا', 'paddingTop', 0, 160, 24) +
      range('فاصله پایین', 'paddingBottom', 0, 160, 24) +
      (cards
        ? range('فاصله کارت‌ها', 'gap', 0, 64, 12) +
          range('گردی کارت‌ها', 'cardRadius', 0, 80, 20) +
          field(
            'تعداد کارت در ردیف',
            p + 'visibleCards',
            v.visibleCards,
            'number',
            'min="1" max="6" placeholder="طبق قالب"',
          )
        : '') +
      btn('reset-scope', 'استفاده از تنظیمات مشترک / قالب') +
      (window.StorefrontEditorStudio?.layout(s) || '')
    );
  }
  function visibility(s) {
    if (hiddenKind(s) === 'legacy')
      return '<div class="sfe-help">برای نمایش این بخش، ابتدا از دکمه «فعال‌سازی در پیش‌نویس» در بالای تنظیمات استفاده کنید.</div>';
    const o = s.settings?.editorOptionsV1 || {};
    let html = check(
      'نمایش این بخش',
      'settings.editorOptionsV1.visible',
      o.visible === undefined ? s.enabled !== false : o.visible,
    );
    if (['videos', 'best-sellers', 'campaign', ...EXTRA].includes(s.type))
      html += check('نمایش توضیح کوتاه', 'settings.editorOptionsV1.showSubtitle', o.showSubtitle !== false);
    if (['videos', 'best-sellers', 'campaign', 'categories'].includes(s.type))
      html += check('نمایش «مشاهده همه»', 'settings.editorOptionsV1.showAll', o.showAll !== false);
    if (['best-sellers', 'campaign', 'product-collection'].includes(s.type))
      html += check('نمایش قیمت', 'settings.editorOptionsV1.showPrice', o.showPrice !== false);
    if (s.type === 'campaign') {
      const date = (v) =>
        v
          ? new Date(new Date(v).getTime() - new Date(v).getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16)
          : '';
      html +=
        check('اعمال زمان شروع', 'settings.editorOptionsV1.scheduleEnabled', o.scheduleEnabled === true) +
        field('شروع پیشنهاد', 'settings.startsAt', date(s.settings?.startsAt), 'datetime-local') +
        field('پایان پیشنهاد', 'settings.endsAt', date(s.settings?.endsAt), 'datetime-local') +
        check('نمایش تایمر', 'settings.editorOptionsV1.showTimer', o.showTimer !== false);
    }
    return html;
  }
  function theme() {
    const t = E.theme;
    return (
      '<div class="sfe-scope-label">محدوده تنظیم: کل فروشگاه</div>' +
      [
        ['primaryColor', 'رنگ اصلی'],
        ['accentColor', 'رنگ مکمل'],
        ['backgroundColor', 'پس‌زمینه'],
        ['surfaceColor', 'کارت‌ها'],
        ['textColor', 'متن'],
        ['mutedColor', 'متن فرعی'],
      ]
        .map(([k, text]) => field(text, k, t[k], 'color'))
        .join('') +
      select('فونت فارسی', 'fontFamily', t.fontFamily, [
        ['Tahoma, Arial, sans-serif', 'Tahoma'],
        ["'Vazirmatn', Tahoma, sans-serif", 'وزیرمتن'],
        ['Arial, Tahoma, sans-serif', 'Arial'],
      ]) +
      `<details class="sfe-details"><summary>تنظیمات بیشتر</summary>${field('گردی کارت‌ها', 'cardRadius', t.cardRadius, 'number', 'min="0" max="80"')}${field('گردی دکمه‌ها', 'buttonRadius', t.buttonRadius, 'number', 'min="0" max="999"')}${field('عرض محتوا', 'containerWidth', t.containerWidth, 'number', 'min="720" max="1600"')}${field('فاصله بخش‌ها', 'sectionSpacing', t.sectionSpacing, 'number', 'min="16" max="160"')}${field('فاصله کناره‌ها', 'globalPadding', t.globalPadding, 'number', 'min="8" max="64"')}</details>`
    );
  }
  function inspector() {
    if (!E.root || !$('[data-inspector]')) return;
    const s = active();
    let name = '',
      html = '';
    if (E.activeSection === '__theme') {
      name = 'هویت بصری فروشگاه';
      html = theme();
    } else if (E.activeSection === '__header') {
      name = N.header;
      html = chrome('header');
    } else if (E.activeSection === '__footer' || s?.type === 'footer') {
      name = N.footer;
      html = chrome('footer');
    } else if (E.activeSection?.startsWith('__template-')) {
      const type = E.activeSection.slice('__template-'.length);
      name = N[type] || 'بخش قالب';
      html =
        '<div class="sfe-help">این بخش از قالب فعلی استفاده می‌کند. تنظیمات اختصاصی آن در این پیش‌نویس در دسترس نیست. برای تنظیم ظاهر کلی، هویت بصری فروشگاه را باز کنید.</div>' +
        btn('theme', 'هویت بصری فروشگاه');
    } else if (s) {
      name = s.settings?.builderV1 ? 'بخش دلخواه' : N[s.type] || s.type;
      html =
        `<div class="sfe-property-tabs" role="tablist" aria-label="گروه تنظیمات">${['content', 'layout', 'visibility'].map((k, i) => `<button type="button" role="tab" data-tab="${k}" aria-selected="${E.tab === k}">${['محتوا', 'چیدمان', 'نمایش'][i]}</button>`).join('')}</div>` +
        (E.tab === 'content' ? content(s) : E.tab === 'layout' ? layout(s) : visibility(s));
      if (!FIXED.includes(s.type))
        html += `<details class="sfe-details"><summary>عملیات بخش</summary>${btn('duplicate', 'کپی بخش')}${btn('up', 'بالاتر')}${btn('down', 'پایین‌تر')}${btn('delete', 'حذف بخش')}</details>`;
    } else {
      name = 'انتخاب بخش';
      html = '<div class="sfe-help">یک بخش را از فهرست یا پیش‌نمایش انتخاب کنید.</div>';
    }
    $('[data-inspector]').innerHTML =
      `<div class="sfe-pane-head"><strong>${esc(name)}</strong><span>تنظیمات بخش انتخاب‌شده</span></div>${s ? '<div class="sfe-section-notice" data-section-notice role="status" hidden></div>' : ''}${html}`;
    sectionNotice();
  }
  function status() {
    if (!E.root || !$('[data-save-status]')) return;
    const errors = M.validate(snap());
    $('[data-save-status]').textContent = E.saving
      ? 'در حال ذخیره پیش‌نویس…'
      : E.conflict
        ? 'نسخه سرور تغییر کرده؛ کار شما محفوظ است'
        : E.error
          ? 'ذخیره انجام نشد؛ نسخه محلی محفوظ است'
          : !navigator.onLine && dirty()
            ? 'آفلاین؛ تغییرات در این دستگاه محفوظ است'
            : dirty()
              ? 'تغییرات هنوز روی سرور ذخیره نشده‌اند'
              : 'پیش‌نویس ذخیره شده';
    const changes = unpublished();
    $('[data-publish-status]').textContent = changes.length
      ? fa(changes.length) + ' مورد منتشرنشده'
      : 'هماهنگ با نسخه زنده';
    $('[data-action=undo]').disabled = !E.undo.length;
    $('[data-action=redo]').disabled = !E.redo.length;
    ['save', 'review'].forEach(
      (a) =>
        ($('[data-action=' + a + ']').disabled = E.saving || E.publishing || E.conflict || !!errors.length),
    );
    const notice = $('[data-notice]');
    notice.hidden = !(E.error || E.conflict || errors.length);
    notice.innerHTML = E.conflict
      ? 'این پیش‌نویس در جای دیگری تغییر کرده است. ' + btn('conflict', 'بررسی نسخه سرور')
      : esc(E.error || errors.join(' · ')) + (E.error ? btn('retry', 'تلاش دوباره') : '');
    if ($('[data-action=publish]')) reviewButton();
  }
  async function save(manual = true) {
    if (!E.config || E.saving || E.publishing || E.conflict) return false;
    if (!dirty()) {
      if (manual) tell('پیش‌نویس ذخیره شده است');
      return true;
    }
    if (M.validate(snap()).length) {
      status();
      return false;
    }
    if (!navigator.onLine) {
      backup();
      status();
      return false;
    }
    clearTimeout(E.timer);
    const sent = snap();
    E.saving = true;
    status();
    try {
      const remote = await sellerApiFetch(endpoint);
      if (!M.equal(M.snapshot(remote.config, remote.theme), E.server)) {
        E.conflict = true;
        return false;
      }
      const p = await sellerApiFetch(endpoint, {
        method: 'PUT',
        body: JSON.stringify({
          config: sent.config,
          theme: sent.theme,
          expectedUpdatedAt: remote.updatedAt,
        }),
      });
      E.page = p;
      E.server = M.snapshot(p.config, p.theme);
      E.error = '';
      if (M.equal(sent, snap())) {
        E.config = M.clone(p.config);
        E.theme = M.clone(p.theme);
      }
      backup();
      if (manual) tell('پیش‌نویس ذخیره شد');
      return true;
    } catch (error) {
      if (error.status === 409) E.conflict = true;
      else E.error = error.message || 'ذخیره ناموفق بود';
      backup();
      return false;
    } finally {
      E.saving = false;
      status();
      if (dirty() && !E.error && !E.conflict) E.timer = setTimeout(() => save(false), 1000);
    }
  }
  function dialog(name, html, footer = '') {
    E.modalEpoch++;
    E.modalBack = null;
    E.focus = document.activeElement;
    $('#sfe-dialog-title').textContent = name;
    $('[data-dialog-body]').innerHTML = html;
    $('[data-dialog-footer]').innerHTML = footer || btn('close', 'بستن');
    $('[data-overlay]').hidden = false;
    $('[data-overlay]').querySelector('button,input,select,textarea')?.focus();
  }
  function close() {
    if (E.modalBack) {
      const back = E.modalBack;
      E.modalBack = null;
      back();
      return;
    }
    E.modalEpoch++;
    const overlay = E.root?.querySelector('[data-overlay]');
    if (overlay) overlay.hidden = true;
    if (E.focus?.isConnected) E.focus.focus({ preventScroll: true });
  }
  function differences(changes) {
    const names = {
        added: 'بخش افزوده‌شده',
        removed: 'بخش حذف‌شده',
        changed: 'تنظیمات تغییر کرده',
        order: 'ترتیب بخش‌ها',
        theme: 'هویت بصری',
      },
      labels = {
        title: 'عنوان',
        subtitle: 'توضیح کوتاه',
        productIds: 'انتخاب و ترتیب محصولات',
        videoUrls: 'انتخاب و ترتیب ویدیوها',
        enabled: 'نمایش بخش',
        gap: 'فاصله کارت‌ها',
        paddingTop: 'فاصله بالا',
        paddingBottom: 'فاصله پایین',
        primaryColor: 'رنگ اصلی',
        accentColor: 'رنگ مکمل',
        backgroundColor: 'رنگ پس‌زمینه',
        surfaceColor: 'رنگ کارت‌ها',
        textColor: 'رنگ متن',
        mutedColor: 'رنگ متن فرعی',
        fontFamily: 'فونت',
        buttonRadius: 'گردی دکمه‌ها',
        cardRadius: 'گردی کارت‌ها',
        containerWidth: 'عرض محتوا',
        sectionSpacing: 'فاصله بخش‌ها',
        globalPadding: 'فاصله کناره‌ها',
        visible: 'نمایش بخش',
        showSubtitle: 'نمایش توضیح کوتاه',
        showAll: 'نمایش مشاهده همه',
        showPrice: 'نمایش قیمت',
        showTimer: 'نمایش تایمر',
        selectionMode: 'روش انتخاب محصولات',
        videoSource: 'منبع ویدیوها',
        videoPosters: 'تصویر شروع ویدیوها',
        limit: 'تعداد آیتم‌ها',
        visibleCards: 'تعداد کارت در ردیف',
        logoText: 'نام در هدر',
        announcement: 'اطلاع‌رسانی',
        showMenu: 'نمایش منو',
        showCart: 'نمایش سبد خرید',
        about: 'توضیح فروشگاه',
        phone: 'شماره پشتیبانی',
        email: 'ایمیل پشتیبانی',
        ctaText: 'متن دکمه',
        ctaUrl: 'مقصد دکمه',
        imageUrl: 'تصویر',
        imageDesktopUrl: 'تصویر دسکتاپ',
        imageMobileUrl: 'تصویر موبایل',
        text: 'متن',
        eyebrow: 'عنوان کوتاه',
        startsAt: 'شروع پیشنهاد',
        scheduleEnabled: 'اعمال زمان شروع',
        editorManagedV1: 'فعال‌سازی بخش',
        endsAt: 'پایان پیشنهاد',
        oldPrice: 'قیمت قبلی',
        discountLabel: 'برچسب تخفیف',
        educationLibraryV1: 'کتابخانهٔ آموزش',
        lessonIds: 'انتخاب و ترتیب آموزش‌ها',
        educationMode: 'روش انتخاب آموزش‌ها',
        categoryIds: 'انتخاب و ترتیب دسته‌ها',
        categorySelectionMode: 'منبع دسته‌ها',
        offerV1: 'پیشنهاد و قیمت واقعی',
        value: 'مقدار تخفیف',
        allowCoupons: 'ترکیب با تخفیف دیگر',
        overrides: 'تخفیف اختصاصی محصولات',
        elements: 'اجزای بخش دلخواه',
        sectionTemplatesV1: 'قالب‌های شخصی',
        editorMenuV1: 'منوی سفارشی',
        insertAfterId: 'محل نمایش بخش',
        rankingDays: 'بازهٔ فروش واقعی',
        fallbackMode: 'تکمیل محصولات',
        excludedProductIds: 'محصولات کنارگذاشته‌شده',
        inStockOnly: 'فقط موجود',
        collectionMode: 'منبع مجموعه',
        builderV1: 'بخش‌ساز',
        background: 'زمینهٔ محتوا',
        align: 'تراز',
        padding: 'فاصلهٔ درونی',
        radius: 'گردی گوشه‌ها',
      };
    const label = (path) =>
      (path.startsWith('educationLibraryV1.')
        ? 'کتابخانهٔ آموزش'
        : path.startsWith('editorMenuV1.')
          ? 'منوی سفارشی'
          : labels[path.split('.').pop()] || 'تنظیم بخش') +
      (path.includes('.mobile.') ? ' · موبایل' : path.includes('.desktop.') ? ' · دسکتاپ' : '');
    const v = (value, path) =>
      Array.isArray(value) && ['elements', 'sectionTemplatesV1', 'items'].some((k) => path?.endsWith(k))
        ? value
            .map(
              (r) =>
                r.title ||
                r.name ||
                r.label ||
                r.text ||
                {
                  image: 'عکس',
                  video: 'ویدیو',
                  button: 'دکمه',
                  text: 'متن',
                  heading: 'عنوان',
                  faq: 'پرسش و پاسخ',
                }[r.type] ||
                'مورد',
            )
            .join('، ')
            .slice(0, 180) || 'خالی'
        : path?.endsWith('lessonIds') && Array.isArray(value)
          ? value
              .map(
                (id) => E.theme.educationLibraryV1?.items?.find((r) => r.id === id)?.title || 'آموزش حذف‌شده',
              )
              .join('، ') || 'بدون آموزش'
          : path?.endsWith('categoryIds') && Array.isArray(value)
            ? value
                .map((id) => E.categories.find((r) => Number(r.id) === Number(id))?.name || 'دسته حذف‌شده')
                .join('، ') || 'بدون دسته'
            : path?.endsWith('productIds') && Array.isArray(value)
              ? value.length
                ? value
                    .map((id) => E.products.find((p) => Number(p.id) === Number(id))?.name || 'محصول حذف‌شده')
                    .join('، ')
                    .slice(0, 180)
                : 'بدون محصول منتخب'
              : value === undefined
                ? 'طبق قالب'
                : value === null
                  ? 'خالی'
                  : typeof value === 'object'
                    ? JSON.stringify(value).slice(0, 180)
                    : (
                        {
                          auto: 'خودکار',
                          manual: 'دستی',
                          current: 'انتخاب فعلی',
                          products: 'ویدیوهای محصولات',
                          library: 'کتابخانه',
                          true: 'فعال',
                          false: 'غیرفعال',
                        }[String(value)] || String(value)
                      ).slice(0, 180);
    return changes.length
      ? changes
          .map(
            (c) =>
              `<article class="sfe-change"><strong>${esc(c.title || N[c.type] || names[c.kind])}</strong><small>${names[c.kind]}</small>${c.fields.map((f) => `<div><span>${esc(label(f.path))}</span><del>${esc(v(f.before, f.path))}</del><ins>${esc(v(f.after, f.path))}</ins></div>`).join('')}</article>`,
          )
          .join('')
      : '<div class="sfe-help">تفاوتی وجود ندارد.</div>';
  }
  function reviewButton() {
    const blocked =
      !E.reviewReady ||
      E.reviewIssues?.some((issue) => issue.level === 'error') ||
      (E.reviewIssues?.some((issue) => issue.level === 'warning') && !$('[data-preflight-ack]')?.checked);
    $$('[data-action=publish]').forEach((b) => {
      b.disabled = blocked || E.publishing || E.saving || E.conflict;
    });
  }
  function renderPreflight() {
    const node = E.root?.querySelector('[data-preflight]');
    if (!node) return;
    const issues = E.reviewIssues || [];
    node.innerHTML = issues.length
      ? `<div class="sfe-preflight-list">${issues.map((issue) => `<div class="sfe-preflight-item ${issue.level}" role="${issue.level === 'error' ? 'alert' : 'status'}"><span>${esc(issue.message)}</span>${issue.sectionId ? btn('preflight-section', 'بررسی بخش', false, `data-section-id="${esc(issue.sectionId)}"`) : ''}</div>`).join('')}</div>` +
        (issues.some((issue) => issue.level === 'warning')
          ? '<label class="sfe-check"><input type="checkbox" data-preflight-ack><span>هشدارها را بررسی کردم</span></label>'
          : '')
      : '<div class="sfe-preflight-ok" role="status">بررسی اولیه انجام شد؛ موردی پیدا نشد.</div>';
    const ack = $('[data-preflight-ack]');
    if (ack) ack.onchange = reviewButton;
    reviewButton();
  }
  async function checkResource(resource) {
    const base = new URL('../index.html', location.href),
      url = new URL(resource.url, base);
    if (resource.kind === 'image') {
      return new Promise((resolve) => {
        const img = new Image();
        const finish = (message) => {
          clearTimeout(timer);
          img.onload = img.onerror = null;
          resolve(message);
        };
        const timer = setTimeout(
          () => finish(resource.label + ' در زمان بررسی بارگذاری نشد؛ دوباره آن را بررسی کنید'),
          4500,
        );
        img.onload = () => finish(img.naturalWidth ? '' : resource.label + ' قابل نمایش نیست');
        img.onerror = () => finish(resource.label + ' بارگذاری نشد؛ فایل یا نشانی آن را بررسی کنید');
        img.referrerPolicy = 'no-referrer';
        img.src = url.href;
      });
    }
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (url.origin !== base.origin) return 'دسترسی مقصد خارجی دکمه را پیش از انتشار بررسی کنید';
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
      return response.ok ? '' : 'مقصد دکمه در دسترس نیست؛ نشانی آن را بررسی کنید';
    } catch (_) {
      return 'امکان بررسی مقصد دکمه نبود؛ آن را دوباره بررسی کنید';
    } finally {
      clearTimeout(timer);
    }
  }
  async function review() {
    E.review = snap();
    E.reviewReady = false;
    E.reviewIssues = [];
    dialog(
      'مرور تغییرات پیش از انتشار',
      '<div data-preflight class="sfe-preflight"><strong>بررسی پیش از انتشار</strong><p role="status">در حال بررسی تصاویر، مقصد دکمه‌ها و محصولات…</p></div>' +
        differences(unpublished()) +
        area('یادداشت انتشار', '__note', '').replace('maxlength="2000"', 'maxlength="500"'),
      btn('close', 'ادامه ویرایش') + btn('publish', 'انتشار همین پیش‌نویس', true),
    );
    const epoch = E.modalEpoch,
      reviewed = M.clone(E.review);
    reviewButton();
    const issues = [];
    let products = E.products;
    try {
      products = await sellerApiFetch('/products');
      E.products = products;
    } catch (_) {
      issues.push({
        level: 'warning',
        message: 'فهرست تازه محصولات دریافت نشد؛ انتخاب‌های خود را دوباره بررسی کنید',
      });
    }
    if (epoch !== E.modalEpoch || !routeActive()) return;
    const result = M.preflight(reviewed, { products, assets: E.assets, published: E.published });
    issues.push(...result.issues);
    const cache = new Map(),
      queue = result.resources.slice();
    await Promise.all(
      Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (queue.length && epoch === E.modalEpoch && routeActive()) {
          const resource = queue.shift(),
            key = resource.kind + ':' + resource.url;
          if (!cache.has(key)) cache.set(key, checkResource(resource));
          const message = await cache.get(key);
          if (message) issues.push({ level: 'warning', sectionId: resource.sectionId, message });
        }
      }),
    );
    if (epoch !== E.modalEpoch || !routeActive()) return;
    if (!M.equal(reviewed, snap())) {
      $('[data-preflight]').innerHTML =
        '<p role="status">پیش‌نویس تغییر کرده است؛ تغییرات تازه را دوباره مرور کنید.</p>' +
        btn('review', 'مرور دوباره');
      return;
    }
    E.reviewIssues = issues;
    E.reviewReady = true;
    renderPreflight();
  }
  async function publish() {
    if (E.publishing || E.saving || E.conflict) return;
    if (!M.equal(E.review, snap())) return review();
    if (
      !E.reviewReady ||
      E.reviewIssues?.some((issue) => issue.level === 'error') ||
      (E.reviewIssues?.some((issue) => issue.level === 'warning') && !$('[data-preflight-ack]')?.checked)
    )
      return;
    const reviewed = M.clone(E.review),
      epoch = E.modalEpoch;
    const note = $('[data-field="__note"]')?.value || '';
    if (!(await save(false))) return;
    // Edits or closing review during the save require a fresh review.
    if (epoch !== E.modalEpoch || !routeActive()) return;
    if (!M.equal(reviewed, snap())) return review();
    E.publishing = true;
    status();
    $$('[data-action=publish]').forEach((b) => (b.disabled = true));
    try {
      const p = await sellerApiFetch(endpoint + '/publish', {
        method: 'POST',
        body: JSON.stringify({ note, expectedUpdatedAt: E.page.updatedAt }),
      });
      E.page = p;
      E.server = M.snapshot(p.config, p.theme);
      E.published = M.snapshot(p.publishedConfig || p.config, p.publishedTheme || p.theme);
      if (M.equal(reviewed, snap())) {
        E.config = M.clone(p.config);
        E.theme = M.clone(p.theme);
      }
      backup();
      if (epoch === E.modalEpoch && routeActive()) close();
      tell('نسخه جدید منتشر شد');
    } catch (error) {
      if (error.status === 409) {
        E.conflict = true;
        if (epoch === E.modalEpoch && routeActive()) close();
        tell('پیش‌نویس بعد از مرور تغییر کرده است؛ نسخه سرور را بررسی کنید');
      } else {
        E.error = error.message || 'انتشار ناموفق بود';
        tell(E.error);
      }
    } finally {
      E.publishing = false;
      status();
      $$('[data-action=publish]').forEach((b) => (b.disabled = false));
      reviewButton();
      if (dirty() && !E.error && !E.conflict) {
        clearTimeout(E.timer);
        E.timer = setTimeout(() => save(false), 1000);
      }
    }
  }
  function preview() {
    clearTimeout(E.previewTimer);
    E.previewTimer = setTimeout(() => {
      try {
        const s = E.previewVersion || snap();
        E.iframe?.contentWindow?.postMessage(
          {
            type: 'storefront-preview-config',
            config: s.config,
            theme: s.theme,
            ...(E.catalogPreview ? { catalog: E.catalogPreview } : {}),
          },
          location.origin,
        );
      } catch (_) {}
    }, 120);
  }
  function bridge() {
    const frame = E.iframe;
    let attempts = 0;
    const run = () => {
      if (!frame?.isConnected || frame !== E.iframe) return;
      try {
        const doc = E.iframe.contentDocument,
          win = E.iframe.contentWindow,
          root = doc.getElementById('storefront-home-root');
        if (!root || !win.StorefrontHome?.__editorContext) {
          if (++attempts < 30) setTimeout(run, 200);
          return;
        }
        if (!doc.getElementById('sfe-inspector-style')) {
          const style = doc.createElement('style');
          style.id = 'sfe-inspector-style';
          style.textContent =
            '[data-sfe-section]{scroll-margin-top:80px!important}[data-sfe-selected]{outline:2px solid #7354c9!important;outline-offset:-2px}';
          doc.head.appendChild(style);
        }
        let outlineFrame = 0;
        const sync = () => {
          cancelAnimationFrame(outlineFrame);
          outlineFrame = requestAnimationFrame(() => {
            if (frame !== E.iframe || !frame.isConnected || !routeActive() || E.previewVersion) return;
            E.previewSections = Array.from(doc.querySelectorAll('[data-sfe-section]')).map((node) => ({
              id: node.dataset.sfeSection,
              type: node.dataset.sfeType,
              visible: node.getClientRects().length > 0 && win.getComputedStyle(node).visibility !== 'hidden',
            }));
            outline();
            highlight();
          });
        };
        const bind = () => {
          if (frame !== E.iframe || !frame.isConnected) return;
          Object.entries(PREVIEW_SELECTORS).forEach(([type, selector]) => {
            const candidates = rows().filter((s) => s.type === type && hiddenKind(s) !== 'disabled');
            doc.querySelectorAll(selector).forEach((node, index) => {
              node.dataset.sfeSection =
                candidates[index]?.id || (type === 'footer' ? '__footer' : '__template-' + type);
              node.dataset.sfeType = type;
            });
          });
          doc.querySelectorAll('[data-editor-section]').forEach((node) => {
            node.dataset.sfeSection = node.dataset.editorSection;
            node.dataset.sfeType = rows().find((s) => s.id === node.dataset.editorSection)?.type || '';
          });
          const header = doc.querySelector('.site-header');
          if (header) {
            header.dataset.sfeSection = '__header';
            header.dataset.sfeType = 'header';
          }
          // Only section boundaries affect the outline. Card/countdown updates do not.
          E.previewObserver?.disconnect();
          E.previewObserver?.observe(root, { childList: true });
          doc.querySelectorAll('[data-sfe-section]').forEach((node) => {
            E.previewObserver?.observe(node, {
              attributes: true,
              attributeFilter: ['style', 'hidden', 'class'],
            });
          });
          sync();
        };
        if (!root.dataset.sfeBridge) {
          root.dataset.sfeBridge = '1';
          doc.addEventListener(
            'click',
            (e) => {
              const node = e.target.closest('[data-sfe-section]');
              if (node) {
                e.preventDefault();
                e.stopPropagation();
                choose(node.dataset.sfeSection);
              }
            },
            true,
          );
          E.previewObserver = new MutationObserver(bind);
          win.addEventListener('storefront:home-ready', bind);
          win.addEventListener('resize', sync);
        }
        bind();
        preview();
      } catch (_) {}
    };
    run();
  }
  function highlight() {
    try {
      const doc = E.iframe?.contentDocument;
      if (!doc) return;
      const node = doc.querySelector('[data-sfe-section="' + CSS.escape(E.activeSection || '') + '"]');
      doc.querySelectorAll('[data-sfe-selected]').forEach((n) => {
        if (n !== node) n.removeAttribute('data-sfe-selected');
      });
      if (node) {
        if (!node.hasAttribute('data-sfe-selected')) node.setAttribute('data-sfe-selected', '');
        if (E.lastPreviewSection !== E.activeSection && E.pendingPreviewFocus !== E.activeSection) {
          const id = E.activeSection,
            frame = E.iframe,
            win = frame.contentWindow;
          E.pendingPreviewFocus = id;
          // Wait for native order and the explicit insertion point to settle.
          win.requestAnimationFrame(() =>
            win.requestAnimationFrame(() => {
              if (frame !== E.iframe || id !== E.activeSection || E.pendingPreviewFocus !== id) return;
              const selected = frame.contentDocument.querySelector(
                '[data-sfe-section="' + CSS.escape(id) + '"]',
              );
              if (selected) {
                const top = selected.getBoundingClientRect().top + win.scrollY - 80;
                win.scrollTo({ top: Math.max(0, top), behavior: 'instant' });
                E.lastPreviewSection = id;
              }
              E.pendingPreviewFocus = null;
            }),
          );
        }
      }
    } catch (_) {}
  }
  async function versions() {
    dialog('نسخه‌های منتشرشده', '<div class="sfe-help">در حال دریافت نسخه‌ها…</div>');
    const epoch = E.modalEpoch;
    try {
      const list = await sellerApiFetch(endpoint + '/versions');
      if (epoch !== E.modalEpoch || !routeActive()) return;
      $('[data-dialog-body]').innerHTML = list.length
        ? list
            .map(
              (v) =>
                `<div class="sfe-version-row"><div><strong>نسخه ${fa(v.revision)}</strong><small>${esc(new Date(v.publishedAt).toLocaleString('fa-IR'))}</small><span>${esc(v.note || '')}</span></div>${btn('version', 'مقایسه و بازیابی', false, `data-id="${v.id}"`)}</div>`,
            )
            .join('')
        : '<div class="sfe-help">هنوز نسخه‌ای منتشر نشده است.</div>';
    } catch (error) {
      if (epoch !== E.modalEpoch || !routeActive()) return;
      $('[data-dialog-body]').innerHTML =
        `<div role="alert">${esc(error.message)}</div>` + btn('versions', 'تلاش دوباره');
    }
  }
  async function version(id) {
    const epoch = E.modalEpoch;
    try {
      const v = await sellerApiFetch(endpoint + '/versions/' + id);
      if (epoch !== E.modalEpoch || !routeActive()) return;
      E.version = M.snapshot(v.config, v.theme);
      dialog(
        'نسخه ' + fa(v.revision),
        differences(M.diff(snap(), E.version)),
        btn('version-preview', 'پیش‌نمایش نسخه') +
          btn('restore-section', 'بازیابی بخش انتخاب‌شده') +
          btn('restore-all', 'بازیابی کل نسخه به پیش‌نویس', true),
      );
    } catch (error) {
      tell(error.message);
    }
  }
  function restore(single) {
    try {
      mutate(() => {
        const s = single ? M.restoreSection(snap(), E.version, E.activeSection) : M.clone(E.version);
        E.config = s.config;
        E.theme = s.theme;
      });
      close();
      tell('نسخه در پیش‌نویس بازیابی شد');
    } catch (error) {
      tell(error.message);
    }
  }
  function links() {
    const list = [
      ['products.html', 'همه محصولات'],
      ['education.html', 'ویدیوهای آموزشی'],
      ...E.categories.map((c) => ['products.html?category=' + c.id, 'دسته: ' + c.name]),
      ...E.products.map((p) => ['product-detail.html?id=' + p.id, 'محصول: ' + p.name]),
    ];
    dialog(
      'انتخاب مقصد دکمه',
      `<label class="sfe-field">جستجوی مقصد<input data-link-search type="search"></label><div class="sfe-link-list">${list.map(([u, t]) => `<button type="button" class="sfe-link-option" data-link="${esc(u)}">${esc(t)}</button>`).join('')}</div>`,
    );
    $('[data-link-search]').oninput = (e) =>
      $$('[data-link]').forEach((b) => (b.hidden = !b.textContent.includes(e.target.value)));
  }
  function products() {
    const s = active();
    if (!s) return;
    E.selectedProducts = (s.settings?.productIds || []).slice();
    dialog(
      'انتخاب و ترتیب محصولات',
      `<div class="sfe-picker-tools"><input type="search" data-product-query placeholder="جستجوی محصول"><select data-category><option value="">همه دسته‌ها</option>${E.categories.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select><label class="sfe-check"><input type="checkbox" data-stock>فقط موجود</label></div><div data-picked></div><div data-products></div>`,
      btn('close', 'انصراف') + btn('apply-products', 'اعمال انتخاب', true),
    );
    const draw = () => {
      const q = $('[data-product-query]').value.trim().toLowerCase(),
        cat = $('[data-category]').value,
        stock = $('[data-stock]').checked;
      $('[data-picked]').innerHTML =
        `<div class="sfe-label-row"><strong>ترتیب محصولات منتخب</strong><span>${fa(E.selectedProducts.length)} محصول</span></div>` +
        E.selectedProducts
          .map(
            (id, i) =>
              `<div class="sfe-selected-row" draggable="true" data-product-drag="${i}"><span>${esc(E.products.find((p) => Number(p.id) === Number(id))?.name || 'محصول ' + id)}</span><label class="sfe-priority"><span class="sfe-sr-only">اولویت</span><input type="number" min="1" max="${E.selectedProducts.length}" data-product-priority="${i}" value="${i + 1}"></label><button type="button" data-product-move="${i}" data-direction="-1" aria-label="بالاتر">↑</button><button type="button" data-product-move="${i}" data-direction="1" aria-label="پایین‌تر">↓</button><button type="button" data-product-remove="${id}" aria-label="حذف از انتخاب">×</button></div>`,
          )
          .join('');
      const list = E.products.filter(
        (p) =>
          (!q || String(p.name).toLowerCase().includes(q)) &&
          (!cat || Number(p.categoryId || p.category?.id) === Number(cat)) &&
          (!stock || Number(p.stockQty) > 0),
      );
      $('[data-products]').innerHTML = list.length
        ? list
            .map(
              (p) =>
                `<label class="sfe-product-option">${image(p) ? `<img src="${esc(image(p))}" alt="">` : ico('box')}<span><strong>${esc(p.name)}</strong><small>${esc(price(p))} · موجودی ${fa(p.stockQty || 0)}${p.isPublished === false ? ' · منتشرنشده' : ''}</small></span><input type="checkbox" data-product-id="${p.id}" ${E.selectedProducts.map(Number).includes(Number(p.id)) ? 'checked' : ''}></label>`,
            )
            .join('')
        : '<div class="sfe-help">محصولی با این فیلتر پیدا نشد.</div>';
      $$('[data-product-id]').forEach(
        (el) =>
          (el.onchange = () => {
            const id = Number(el.dataset.productId);
            E.selectedProducts = E.selectedProducts.filter((v) => Number(v) !== id);
            if (el.checked) E.selectedProducts.push(id);
            draw();
          }),
      );
      $$('[data-product-move]').forEach(
        (b) =>
          (b.onclick = () => {
            const i = Number(b.dataset.productMove),
              to = i + Number(b.dataset.direction);
            if (to < 0 || to >= E.selectedProducts.length) return;
            const v = E.selectedProducts.splice(i, 1)[0];
            E.selectedProducts.splice(to, 0, v);
            draw();
          }),
      );
      $$('[data-product-remove]').forEach(
        (b) =>
          (b.onclick = () => {
            E.selectedProducts = E.selectedProducts.filter((id) => String(id) !== b.dataset.productRemove);
            draw();
          }),
      );
    };
    $('[data-picked]').onchange = (event) => {
      const index = Number(event.target.dataset.productPriority),
        to = Number(event.target.value) - 1;
      if (
        !event.target.hasAttribute('data-product-priority') ||
        !Number.isInteger(to) ||
        to < 0 ||
        to >= E.selectedProducts.length
      )
        return;
      E.selectedProducts.splice(to, 0, E.selectedProducts.splice(index, 1)[0]);
      draw();
    };
    let dragProduct = null;
    $('[data-picked]').ondragstart = (event) => {
      const row = event.target.closest('[data-product-drag]');
      if (row) dragProduct = Number(row.dataset.productDrag);
    };
    $('[data-picked]').ondragover = (event) => event.preventDefault();
    $('[data-picked]').ondrop = (event) => {
      event.preventDefault();
      const row = event.target.closest('[data-product-drag]');
      if (row && dragProduct !== null) {
        E.selectedProducts.splice(
          Number(row.dataset.productDrag),
          0,
          E.selectedProducts.splice(dragProduct, 1)[0],
        );
        draw();
      }
      dragProduct = null;
    };
    $('[data-product-query]').oninput = draw;
    $('[data-category]').onchange = draw;
    $('[data-stock]').onchange = draw;
    draw();
  }
  function promotions() {
    const s = active(),
      st = s.settings || {},
      p = st.promotions || {};
    dialog(
      'برچسب تخفیف نمایشی',
      (st.productIds || [])
        .map(
          (id) =>
            `<div class="sfe-promotion" data-promo="${id}"><strong>${esc(E.products.find((p) => Number(p.id) === Number(id))?.name || 'محصول ' + id)}</strong><label class="sfe-check"><input type="checkbox" data-promo-enabled ${p[id]?.enabled ? 'checked' : ''}>نمایش برچسب</label><label class="sfe-field">قیمت قبلی<input data-promo-old value="${esc(p[id]?.oldPrice || '')}"></label><label class="sfe-field">متن برچسب<input data-promo-label value="${esc(p[id]?.discountLabel || '')}"></label></div>`,
        )
        .join('') || '<div class="sfe-help">ابتدا محصول انتخاب کنید.</div>',
      btn('close', 'انصراف') + btn('apply-promotions', 'اعمال در پیش‌نویس', true),
    );
  }
  function add() {
    dialog(
      'افزودن بخش',
      `<div class="sfe-template-grid">${['hero', 'banner', 'product-collection', 'support-banner', 'trust'].map((t) => `<button type="button" data-add="${t}"><span class="sfe-template-preview ${t}"><i></i><b></b><i></i></span><strong>${N[t]}</strong><small>پیش‌نمایش چیدمان</small></button>`).join('')}</div>` +
        (window.StorefrontEditorStudio?.templatesHtml() || ''),
    );
  }
  function addType(type) {
    if (rows().length >= 40) return tell('حداکثر ۴۰ بخش قابل ثبت است');
    const s = {
      id: type + '-' + Date.now().toString(36),
      type,
      enabled: true,
      content: { title: N[type] },
      settings: { editorManagedV1: true },
    };
    mutate(() => {
      const i = rows().findIndex((s) => s.type === 'footer');
      E.config.sections.splice(i < 0 ? rows().length : i, 0, s);
      E.activeSection = s.id;
      E.tab = 'content';
    });
    close();
    pane('settings');
  }
  function move(direction) {
    const s = active();
    if (!s || FIXED.includes(s.type)) return;
    const i = rows().indexOf(s),
      to = i + direction;
    if (to < 0 || to >= rows().length || FIXED.includes(rows()[to].type))
      return tell('جایگاه بخش‌های اصلی ثابت است');
    mutate(() => {
      const value = E.config.sections.splice(i, 1)[0];
      E.config.sections.splice(to, 0, value);
    });
  }
  function refs(asset) {
    return M.references(asset.url, [
      { scope: 'draft', data: snap() },
      { scope: 'live', data: E.published },
    ]).concat(
      E.categories
        .filter((c) => c.imageUrl === asset.url)
        .map((c) => ({ owner: 'دسته: ' + c.name, scope: 'catalog', path: 'imageUrl' })),
    );
  }
  async function upload(file) {
    const types = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (!types.includes(file.type)) throw new Error('فرمت فایل پشتیبانی نمی‌شود');
    if (file.size > (file.type.startsWith('video/') ? 25 : 8) * 1024 * 1024)
      throw new Error('حداکثر حجم فیلم ۲۵ و تصویر ۸ مگابایت است');
    const form = new FormData();
    form.append('file', file);
    return sellerApiFetch('/storefront/media/upload', { method: 'POST', body: form });
  }
  async function media(kind = 'all', chooseMedia = null, onCancel = null) {
    E.mediaKind = kind;
    E.mediaChoose = chooseMedia;
    E.mediaPickKind = chooseMedia && kind !== 'all' ? kind : null;
    E.mediaQuery = '';
    dialog(
      'کتابخانه رسانه',
      `<div class="sfe-picker-tools"><input type="search" data-media-query placeholder="جستجوی نام یا توضیح"><select data-media-kind><option value="all">همه رسانه‌ها</option><option value="image">تصاویر</option><option value="video">ویدیوها</option></select></div><label class="sfe-upload">انتخاب فایل برای آپلود<input type="file" data-media-file accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"></label><p class="sfe-help">تصویر JPG/PNG/WebP تا ۸ مگابایت؛ فیلم MP4/WebM/MOV تا ۲۵ مگابایت.</p><div data-upload-status aria-live="polite"></div><div class="sfe-media-grid" data-media-grid>در حال دریافت رسانه‌ها…</div>`,
    );
    E.modalBack = onCancel;
    const epoch = E.modalEpoch;
    $('[data-media-kind]').value = kind;
    $('[data-media-kind]').onchange = () => {
      E.mediaKind = $('[data-media-kind]').value;
      drawMedia();
    };
    $('[data-media-query]').oninput = () => {
      E.mediaQuery = $('[data-media-query]').value;
      drawMedia();
    };
    $('[data-media-file]').onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (E.mediaPickKind && !file.type.startsWith(E.mediaPickKind + '/'))
        return tell(
          E.mediaPickKind === 'image' ? 'برای این قسمت یک تصویر انتخاب کنید' : 'یک ویدیو انتخاب کنید',
        );
      e.target.disabled = true;
      try {
        $('[data-upload-status]').textContent = 'در حال آپلود…';
        await upload(file);
        E.assets = await sellerApiFetch('/storefront/media');
        if (epoch !== E.modalEpoch || !routeActive()) return;
        drawMedia();
        $('[data-upload-status]').textContent = 'فایل آپلود شد';
      } catch (error) {
        if (epoch === E.modalEpoch && $('[data-upload-status]'))
          $('[data-upload-status]').textContent = error.message;
      } finally {
        e.target.disabled = false;
        e.target.value = '';
      }
    };
    try {
      E.assets = await sellerApiFetch('/storefront/media');
      if (epoch !== E.modalEpoch || !routeActive()) return;
      drawMedia();
    } catch (error) {
      if (epoch !== E.modalEpoch || !routeActive()) return;
      $('[data-media-grid]').innerHTML =
        `<div role="alert">${esc(error.message)}</div>` + btn('media', 'تلاش دوباره');
    }
  }
  function drawMedia() {
    if (!$('[data-media-grid]')) return;
    const list = E.assets.filter(
      (a) =>
        (E.mediaKind === 'all' || a.kind === E.mediaKind) &&
        (!E.mediaQuery || String(a.altText || a.publicId || a.kind).includes(E.mediaQuery)),
    );
    $('[data-media-grid]').innerHTML = list.length
      ? list
          .map((a) => {
            const use = refs(a);
            const wrongKind = E.mediaPickKind && a.kind !== E.mediaPickKind;
            return `<article class="sfe-media-card"><div class="sfe-media-visual">${a.kind === 'video' ? `<video src="${esc(a.url)}" muted playsinline preload="metadata"></video>` : `<img src="${esc(a.url)}" alt="${esc(a.altText || '')}">`}</div><strong>${esc(a.altText || (a.kind === 'video' ? 'ویدیو' : 'تصویر'))}</strong><small>${fa(Math.round((a.bytes || 0) / 1024))} KB · ${a.width && a.height ? esc(a.width + '×' + a.height) : ''}${a.duration ? ' · ' + fa(Math.round(a.duration)) + ' ثانیه' : ''}</small><small>${use.length ? 'استفاده در ' + fa(new Set(use.map((r) => r.owner)).size) + ' بخش' : 'بدون استفاده در نسخه فعلی'}</small><div>${E.mediaChoose ? btn('use-media', wrongKind ? 'نوع فایل مناسب نیست' : 'انتخاب', true, `data-id="${a.id}" ${wrongKind ? 'disabled' : ''}`) : ''}${btn('asset', 'جزئیات و استفاده‌ها', false, `data-id="${a.id}"`)}${btn('replace-media', 'جایگزین', false, `data-id="${a.id}"`)}${btn('delete-media', 'حذف', false, `data-id="${a.id}" ${use.length ? 'disabled' : ''}`)}</div></article>`;
          })
          .join('')
      : '<div class="sfe-help">رسانه‌ای پیدا نشد.</div>';
  }
  function assetDetails(a) {
    dialog(
      'جزئیات رسانه',
      `<label class="sfe-field">توضیح فایل<input data-asset-alt maxlength="300" value="${esc(a.altText || '')}"></label><div class="sfe-help">${
        refs(a)
          .map(
            (r) =>
              esc(title(rows().find((s) => s.id === r.owner)) || r.owner) +
              ' · ' +
              (r.scope === 'live' ? 'نسخه زنده' : 'پیش‌نویس'),
          )
          .join('<br>') || 'در نسخه فعلی استفاده نشده است.'
      }</div>`,
      btn('close', 'بستن') + btn('save-alt', 'ذخیره توضیح', true, `data-id="${a.id}"`),
    );
  }
  function replace(a) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept =
      a.kind === 'video' ? 'video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp';
    input.onchange = async () => {
      if (!input.files?.[0]) return;
      if (!input.files[0].type.startsWith(a.kind + '/'))
        return tell('نوع رسانه جایگزین باید با فایل قبلی یکسان باشد');
      try {
        const next = await upload(input.files[0]);
        mutate(() => {
          E.config = M.replaceMedia(E.config, a.url, next.url);
          E.theme = M.replaceMedia(E.theme, a.url, next.url);
        });
        E.assets = await sellerApiFetch('/storefront/media');
        drawMedia();
        tell('فایل جدید در پیش‌نویس جایگزین شد؛ فایل نسخه زنده محفوظ است');
      } catch (error) {
        tell(error.message);
      }
    };
    input.click();
  }
  async function videos(resume = false) {
    const sectionId = E.activeSection,
      epoch = E.modalEpoch;
    if (!resume) {
      E.selectedVideos = (active()?.settings?.videoUrls || []).slice();
      E.selectedPosters = M.clone(active()?.settings?.videoPosters || {});
    }
    try {
      E.assets = await sellerApiFetch('/storefront/media');
      if (sectionId !== E.activeSection || epoch !== E.modalEpoch || !routeActive()) return;
    } catch (error) {
      return tell(error.message);
    }
    dialog(
      'انتخاب و ترتیب ویدیوها',
      `<div data-video-order></div><div class="sfe-media-grid">${
        E.assets
          .filter((a) => a.kind === 'video')
          .map(
            (a) =>
              `<label class="sfe-video-option"><video src="${esc(a.url)}" muted playsinline preload="metadata"></video><span>${esc(a.altText || 'ویدیو')} · ${fa(Math.round(a.duration || 0))} ثانیه</span><input type="checkbox" data-video-url="${esc(a.url)}" ${E.selectedVideos.includes(a.url) ? 'checked' : ''}></label>`,
          )
          .join('') || '<div class="sfe-help">ابتدا ویدیو در کتابخانه آپلود کنید.</div>'
      }</div>`,
      btn('close', 'انصراف') + btn('apply-videos', 'اعمال انتخاب', true),
    );
    const draw = () => {
      $('[data-video-order]').innerHTML = E.selectedVideos
        .map(
          (u, i) =>
            `<div class="sfe-selected-row"><span>ویدیو ${fa(i + 1)}</span><button type="button" data-video-move="${i}" data-direction="-1" aria-label="بالاتر">↑</button><button type="button" data-video-move="${i}" data-direction="1" aria-label="پایین‌تر">↓</button>${btn('poster', 'تصویر شروع', false, `data-url="${esc(u)}"`)}</div>`,
        )
        .join('');
      $$('[data-video-move]').forEach(
        (b) =>
          (b.onclick = () => {
            const i = Number(b.dataset.videoMove),
              to = i + Number(b.dataset.direction);
            if (to < 0 || to >= E.selectedVideos.length) return;
            const v = E.selectedVideos.splice(i, 1)[0];
            E.selectedVideos.splice(to, 0, v);
            draw();
          }),
      );
    };
    $$('[data-video-url]').forEach(
      (el) =>
        (el.onchange = () => {
          E.selectedVideos = E.selectedVideos.filter((u) => u !== el.dataset.videoUrl);
          if (el.checked) E.selectedVideos.push(el.dataset.videoUrl);
          draw();
        }),
    );
    draw();
  }
  function crop(url, path) {
    E.crop = { url, path };
    dialog(
      'برش تصویر',
      `<div class="sfe-crop-stage"><img data-crop-img alt="تصویر برای برش"><div data-crop-frame></div></div><label class="sfe-field">قالب<select data-crop-ratio><option value="1.7777777778">دسکتاپ ۱۶:۹</option><option value="0.8">موبایل ۴:۵</option><option value="1">مربع ۱:۱</option></select></label><label class="sfe-field">بزرگ‌نمایی<input data-crop-zoom type="range" min="1" max="3" step="0.01" value="1"></label><label class="sfe-field">افقی<input data-crop-x type="range" min="-100" max="100" value="0"></label><label class="sfe-field">عمودی<input data-crop-y type="range" min="-100" max="100" value="0"></label>`,
      btn('close', 'انصراف') + btn('crop-save', 'ساخت و انتخاب تصویر', true),
    );
    const img = $('[data-crop-img]');
    img.crossOrigin = 'anonymous';
    const draw = () => {
      const r = Number($('[data-crop-ratio]').value),
        z = Number($('[data-crop-zoom]').value),
        w = Math.min($('.sfe-crop-stage').clientWidth * 0.85, 260),
        h = Math.min(w / r, 220),
        frame = $('[data-crop-frame]');
      frame.style.width = h * r + 'px';
      frame.style.height = h + 'px';
      const scale = Math.max((h * r) / (img.naturalWidth || 1), h / (img.naturalHeight || 1)) * z;
      img.style.width = img.naturalWidth * scale + 'px';
      img.style.height = img.naturalHeight * scale + 'px';
      img.style.transform = `translate(${(Number($('[data-crop-x]').value) / 100) * Math.max(0, (img.naturalWidth * scale - h * r) / 2)}px,${(Number($('[data-crop-y]').value) / 100) * Math.max(0, (img.naturalHeight * scale - h) / 2)}px)`;
    };
    img.onload = draw;
    img.src = url;
    $$('[data-crop-ratio],[data-crop-zoom],[data-crop-x],[data-crop-y]').forEach((el) => (el.oninput = draw));
  }
  async function saveCrop() {
    const img = $('[data-crop-img]');
    if (!img.naturalWidth) return tell('تصویر هنوز آماده نیست');
    const r = Number($('[data-crop-ratio]').value),
      z = Number($('[data-crop-zoom]').value),
      h = Math.min(img.naturalHeight, img.naturalWidth / r) / z,
      w = h * r,
      x = ((img.naturalWidth - w) / 2) * (1 - Number($('[data-crop-x]').value) / 100),
      y = ((img.naturalHeight - h) / 2) * (1 - Number($('[data-crop-y]').value) / 100),
      canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = Math.round(1080 / r);
    $('[data-action=crop-save]').disabled = true;
    try {
      canvas.getContext('2d').drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
      if (!blob) throw new Error('برش ناموفق بود');
      const a = await upload(new File([blob], 'crop-' + Date.now() + '.webp', { type: 'image/webp' }));
      mutate(() => M.setPath(owner(), E.crop.path, a.url));
      close();
    } catch (error) {
      tell(error.message || 'این تصویر قابل برش نیست');
    } finally {
      $$('[data-action=crop-save]').forEach((b) => (b.disabled = false));
    }
  }
  async function conflict() {
    try {
      const remote = await sellerApiFetch(endpoint);
      E.remote = remote;
      dialog(
        'مقایسه با نسخه سرور',
        differences(M.diff(M.snapshot(remote.config, remote.theme), snap())),
        btn('close', 'حفظ کار من') + btn('load-remote', 'استفاده از نسخه سرور', true),
      );
    } catch (error) {
      tell(error.message);
    }
  }
  function click(event) {
    if (!routeActive() || !E.root?.querySelector('[data-storefront-workbench]')) return;
    const b = event.target.closest('button');
    if (!b || !E.root.contains(b)) return;
    if (window.StorefrontEditorStudio?.handle(b)) return;
    if (b.dataset.findSection) {
      close();
      if (b.dataset.findScope) E.scope = b.dataset.findScope;
      choose(b.dataset.findSection);
      E.tab = b.dataset.findTab;
      inspector();
      const field = E.root.querySelector('[data-field="' + CSS.escape(b.dataset.findField) + '"]');
      if (field) {
        field.closest('details')?.setAttribute('open', '');
        field.focus({ preventScroll: true });
        field.closest('label')?.scrollIntoView({ block: 'center', behavior: 'instant' });
      }
      return;
    }
    if (b.dataset.select) return choose(b.dataset.select);
    if (b.dataset.pane) return pane(b.dataset.pane);
    if (b.dataset.tab) {
      E.tab = b.dataset.tab;
      return inspector();
    }
    if (b.dataset.scope) {
      E.scope = b.dataset.scope;
      return inspector();
    }
    if (b.dataset.device) {
      E.device = b.dataset.device;
      $('[data-frame-wrap]').dataset.device = E.device;
      $$('[data-device]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      fit();
      outline();
      return;
    }
    if (b.dataset.add) return addType(b.dataset.add);
    if (b.dataset.link) {
      mutate(() => M.setPath(active(), 'content.ctaUrl', b.dataset.link));
      return close();
    }
    const a = E.assets.find((a) => Number(a.id) === Number(b.dataset.id));
    const actions = {
      back: () => {
        location.hash = '#/settings';
      },
      undo: () => undo(),
      redo: () => undo(true),
      save: () => save(),
      retry: () => {
        E.error = '';
        save();
      },
      review,
      publish,
      close,
      theme: () => choose('__theme'),
      products,
      promotions,
      add,
      versions,
      media: () => media(),
      videos,
      links,
      'search-settings': searchSettings,
      'preflight-section': () => {
        close();
        choose(b.dataset.sectionId);
      },
      'section-visibility': () => {
        E.tab = 'visibility';
        inspector();
      },
      'activate-section': () => {
        const s = active();
        if (!s || hiddenKind(s) !== 'legacy') return;
        dialog(
          'فعال‌سازی بخش قدیمی',
          `<p>«${esc(title(s))}» با محتوای ذخیره‌شده‌اش در پیش‌نویس نمایش داده شود؟</p><p>بخش‌های اصلی در جایگاه فعلی می‌مانند. فروشگاه زنده فقط پس از مرور و انتشار تغییر می‌کند.</p>`,
          btn('close', 'انصراف') +
            btn('confirm-activate-section', 'فعال‌سازی در پیش‌نویس', true, `data-section-id="${esc(s.id)}"`),
        );
      },
      'confirm-activate-section': () => {
        const s = rows().find((s) => s.id === b.dataset.sectionId);
        if (!s || hiddenKind(s) !== 'legacy') return;
        mutate(() => {
          s.enabled = true;
          M.setPath(s, 'settings.editorManagedV1', true);
          if (s.settings?.editorOptionsV1?.visible === false)
            M.setPath(s, 'settings.editorOptionsV1.visible', true);
        });
        close();
      },
      up: () => move(-1),
      down: () => move(1),
      'reset-scope': () =>
        mutate(() => {
          if (active()?.settings?.editorOptionsV1) delete active().settings.editorOptionsV1[E.scope];
        }),
      'apply-products': () => {
        mutate(() => {
          M.setPath(active(), 'settings.productIds', E.selectedProducts.slice());
          if (active().type === 'product-collection')
            M.setPath(active(), 'settings.collectionMode', 'manual');
          if (active().settings?.editorOptionsV1?.selectionMode !== 'hybrid')
            M.setPath(active(), 'settings.editorOptionsV1.selectionMode', 'manual');
        });
        close();
      },
      'apply-promotions': () => {
        const p = {};
        $$('[data-promo]').forEach(
          (row) =>
            (p[row.dataset.promo] = {
              enabled: row.querySelector('[data-promo-enabled]').checked,
              oldPrice: row.querySelector('[data-promo-old]').value,
              discountLabel: row.querySelector('[data-promo-label]').value,
            }),
        );
        mutate(() => M.setPath(active(), 'settings.promotions', p));
        close();
      },
      duplicate: () => {
        const s = active();
        if (!s || FIXED.includes(s.type) || rows().length >= 40) return;
        const copy = M.clone(s);
        copy.id = s.type + '-' + Date.now().toString(36);
        mutate(() => {
          E.config.sections.splice(rows().indexOf(s) + 1, 0, copy);
          E.activeSection = copy.id;
        });
      },
      delete: () => {
        const s = active();
        if (!s || FIXED.includes(s.type)) return;
        dialog(
          'حذف بخش',
          `<p>«${esc(title(s))}» از پیش‌نویس حذف شود؟</p>`,
          btn('close', 'انصراف') + btn('confirm-delete', 'حذف از پیش‌نویس'),
        );
      },
      'confirm-delete': () => {
        mutate(() => {
          E.config.sections = rows().filter((s) => s.id !== E.activeSection);
          E.activeSection = rows()[0]?.id;
        });
        close();
      },
      'choose-image': () =>
        media('image', (a) => {
          mutate(() => M.setPath(owner(), b.dataset.path, a.url));
          close();
        }),
      crop: () => crop(b.dataset.url, b.dataset.path),
      'crop-save': saveCrop,
      'use-media': () => {
        if (a && E.mediaChoose && (!E.mediaPickKind || a.kind === E.mediaPickKind)) E.mediaChoose(a);
      },
      'replace-media': () => a && replace(a),
      asset: () => a && assetDetails(a),
      'delete-media': () => {
        if (!a || refs(a).length) return;
        dialog(
          'حذف رسانه',
          'این فایل در پیش‌نویس و نسخه زنده استفاده نشده است.',
          btn('close', 'انصراف') + btn('confirm-delete-media', 'حذف فایل', false, `data-id="${a.id}"`),
        );
      },
      'confirm-delete-media': async () => {
        if (!a || refs(a).length) return;
        try {
          await sellerApiFetch('/storefront/media/' + a.id, { method: 'DELETE' });
          media();
        } catch (error) {
          tell(error.message);
        }
      },
      'save-alt': async () => {
        try {
          await sellerApiFetch('/storefront/media/' + a.id, {
            method: 'PATCH',
            body: JSON.stringify({ altText: $('[data-asset-alt]').value }),
          });
          media();
        } catch (error) {
          tell(error.message);
        }
      },
      'apply-videos': () => {
        mutate(() => {
          M.setPath(active(), 'settings.videoUrls', E.selectedVideos.slice());
          M.setPath(active(), 'settings.videoPosters', M.clone(E.selectedPosters));
          M.setPath(active(), 'settings.editorOptionsV1.videoSource', 'library');
        });
        close();
      },
      poster: () =>
        media('image', (a) => {
          E.selectedPosters[b.dataset.url] = a.url;
          videos(true);
        }),
      version: () => version(b.dataset.id),
      'restore-section': () => restore(true),
      'restore-all': () =>
        dialog(
          'بازیابی کل نسخه',
          'محتوا و تنظیمات این نسخه در پیش‌نویس جایگزین شوند؟',
          btn('close', 'انصراف') + btn('confirm-restore', 'بازیابی به پیش‌نویس', true),
        ),
      'confirm-restore': () => restore(false),
      'version-preview': () => {
        E.previewVersion = M.clone(E.version);
        close();
        $('[data-version-bar]').hidden = false;
        $('[data-version-bar]').innerHTML = 'پیش‌نمایش نسخه قبلی ' + btn('end-version', 'بازگشت به پیش‌نویس');
        preview();
        pane('preview');
      },
      'end-version': () => {
        E.previewVersion = null;
        $('[data-version-bar]').hidden = true;
        preview();
      },
      conflict,
      'load-remote': () => {
        const local = snap();
        backup();
        E.page = E.remote;
        E.server = M.snapshot(E.remote.config, E.remote.theme);
        E.config = M.clone(E.remote.config);
        E.theme = M.clone(E.remote.theme);
        E.conflict = false;
        E.error = '';
        E.undo = [local];
        E.redo = [];
        backup();
        close();
        outline();
        inspector();
        preview();
        status();
      },
      recover: () => {
        if (!M.equal(E.recovery.server, E.server)) {
          E.conflict = true;
          E.server = M.clone(E.recovery.server);
        }
        mutate(() => {
          E.config = M.clone(E.recovery.snapshot.config);
          E.theme = M.clone(E.recovery.snapshot.theme);
        });
        close();
      },
      discard: () => {
        localStorage.removeItem(storageKey());
        close();
      },
    };
    if (actions[b.dataset.action]) actions[b.dataset.action]();
  }
  async function render(view) {
    if (E.loading) return E.promise;
    if (E.config && E.root === view && view.querySelector('[data-storefront-workbench]')) return;
    if (E.config) {
      mount(view);
      return;
    }
    E.loading = true;
    E.root = view;
    view.innerHTML = '<div class="sfe-loading" role="status">در حال آماده‌سازی ویرایشگر…</div>';
    E.promise = (async () => {
      try {
        const [page, products, categories] = await Promise.all([
          sellerApiFetch(endpoint),
          sellerApiFetch('/products'),
          sellerApiFetch('/categories'),
        ]);
        E.page = page;
        E.config = M.clone(page.config);
        E.theme = M.clone(page.theme);
        E.server = snap();
        E.products = products || [];
        E.categories = categories || [];
        if (page.publishedConfig)
          E.published = M.snapshot(page.publishedConfig, page.publishedTheme || page.theme);
        else {
          try {
            const p = await apiFetch('/storefront/public/' + SELLER_ID + '/home');
            E.published = M.snapshot(p.config, p.theme);
          } catch (_) {
            E.published = M.clone(E.server);
          }
        }
        E.device = matchMedia('(max-width:850px)').matches ? 'mobile' : 'desktop';
        E.activeSection = rows().find((s) => s.type === 'best-sellers')?.id || rows()[0]?.id || '__header';
        mount(view);
        E.recovery = M.readBackup(localStorage, storageKey(), page.id);
        if (E.recovery && !M.equal(E.recovery.snapshot, E.server))
          dialog(
            'بازیابی کار نیمه‌تمام',
            'یک پیش‌نویس ذخیره‌نشده در این دستگاه پیدا شد.' +
              (!M.equal(E.recovery.server, E.server)
                ? '<p>نسخه سرور هم تغییر کرده است؛ کار محلی برای مقایسه بازیابی می‌شود و خودکار ذخیره نخواهد شد.</p>'
                : ''),
            btn('discard', 'ادامه با نسخه سرور') + btn('recover', 'بازیابی پیش‌نویس', true),
          );
      } catch (error) {
        view.innerHTML = `<div class="sfe-loading" role="alert">${esc(error.message)}<button data-editor-retry type="button">تلاش دوباره</button></div>`;
        view.querySelector('[data-editor-retry]').onclick = () => render(view);
      } finally {
        E.loading = false;
      }
    })();
    return E.promise;
  }
  window.addEventListener('resize', () => {
    if (E.config && routeActive()) fit();
  });
  window.addEventListener('hashchange', () => {
    if (!routeActive() && E.root) E.root.classList.remove('sfe-host');
  });
  window.addEventListener('beforeunload', (event) => {
    if (E.config && dirty()) {
      backup();
      event.preventDefault();
      event.returnValue = '';
    }
  });
  window.addEventListener('offline', () => {
    if (E.config) {
      backup();
      status();
    }
  });
  window.addEventListener('online', () => {
    if (E.config) {
      E.error = '';
      status();
      if (dirty()) save(false);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (!E.config || !routeActive() || !$('[data-overlay]')) return;
    if (event.key === 'Escape' && !$('[data-overlay]').hidden) return close();
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      return searchSettings();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      save();
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === 'z' &&
      !event.target.matches('input,textarea')
    ) {
      event.preventDefault();
      undo(event.shiftKey);
    }
    if (event.key === 'Tab' && !$('[data-overlay]').hidden) {
      const list = $$(
          '[data-overlay] button:not([disabled]),[data-overlay] input,[data-overlay] select,[data-overlay] textarea',
        ).filter((el) => el.offsetParent !== null),
        first = list[0],
        last = list[list.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  function routeActive() {
    return location.hash.replace(/^#\/?/, '').split('/')[0] === 'storefront-editor';
  }
  window.StorefrontEditorStudio?.attach({
    E,
    M,
    active,
    mutate,
    dialog,
    close,
    media,
    btn,
    field,
    check,
    select,
    title,
    pane,
    image,
    tell,
    matches: matchesQuery,
    catalogChanged() {
      const products = E.products.filter((p) => p.isPublished !== false);
      E.catalogPreview = {
        products,
        categories: E.categories.filter((c) =>
          products.some((p) => Number(p.categoryId || p.category?.id) === Number(c.id)),
        ),
      };
      preview();
      inspector();
    },
  });
  window.StorefrontEditorComplete = { version: 'workbench-1', render, state: E };
  window.renderStorefrontEditor = render;
})();
