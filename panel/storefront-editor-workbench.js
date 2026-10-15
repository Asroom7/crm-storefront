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
    E.lastPreviewSection = null;
    E.root = view;
    view.classList.add('sfe-host');
    view.innerHTML = `<div class="sfe-workbench" data-storefront-workbench>
    <header class="sfe-topbar"><div class="sfe-heading">${btn('back', ico('chevR'), false, 'aria-label="بازگشت به تنظیمات"')}<div><h2>ویرایش فروشگاه</h2><span>صفحه اصلی</span></div><span class="sfe-badge">پیش‌نویس</span></div><div class="sfe-actions">${btn('undo', '↶', false, 'aria-label="برگشت تغییر"')}${btn('redo', '↷', false, 'aria-label="تکرار تغییر"')}${btn('media', 'رسانه‌ها')}${btn('versions', 'نسخه‌ها')}${btn('save', 'ذخیره پیش‌نویس')}${btn('review', 'مرور و انتشار', true)}</div></header>
    <div class="sfe-notice" data-notice role="alert" hidden></div><nav class="sfe-mobile-nav" aria-label="قسمت‌های ویرایشگر">${['sections', 'preview', 'settings'].map((k, i) => `<button type="button" data-pane="${k}" aria-pressed="${k === E.pane}">${['بخش‌ها', 'پیش‌نمایش', 'تنظیمات بخش'][i]}</button>`).join('')}</nav>
    <div class="sfe-workspace"><aside class="sfe-outline"><div class="sfe-pane-head"><strong>ساختار صفحه</strong><span>ترتیب فعلی فروشگاه</span></div><div data-outline></div><div class="sfe-outline-foot">${btn('add', 'افزودن بخش', true)}${btn('theme', 'هویت بصری فروشگاه')}</div></aside><main class="sfe-canvas"><div class="sfe-canvas-bar"><strong>پیش‌نمایش زنده</strong><div class="sfe-devices">${['desktop', 'tablet', 'mobile'].map((k, i) => `<button type="button" data-device="${k}" aria-pressed="${k === E.device}">${['دسکتاپ', 'تبلت', 'موبایل'][i]}</button>`).join('')}</div></div><div data-version-bar class="sfe-version-preview" hidden></div><div class="sfe-preview-stage"><div class="sfe-frame-wrap" data-frame-wrap data-device="${E.device}"><iframe data-preview-frame title="پیش‌نمایش فروشگاه" src="../index.html?editorPreview=1&editorBuild=20261015-workbench"></iframe></div></div></main><aside class="sfe-inspector"><div class="sfe-sheet-handle" aria-hidden="true"></div><div data-inspector></div></aside></div>
    <footer class="sfe-statusbar"><span data-save-status aria-live="polite"></span><span data-publish-status aria-live="polite"></span></footer><div class="sfe-dialog-overlay" data-overlay hidden><section class="sfe-dialog" role="dialog" aria-modal="true" aria-labelledby="sfe-dialog-title"><header><h3 id="sfe-dialog-title"></h3>${btn('close', '×', false, 'aria-label="بستن"')}</header><div data-dialog-body></div><footer data-dialog-footer></footer></section></div></div>`;
    E.iframe = $('[data-preview-frame]');
    E.iframe.addEventListener('load', bridge);
    view.onclick = click;
    view.oninput = (e) => {
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
    const row = (id, text, type, fixed) =>
      `<button type="button" class="sfe-outline-row ${E.activeSection === id ? 'is-selected' : ''}" data-select="${esc(id)}" aria-pressed="${E.activeSection === id}"><span class="sfe-section-mark">${ico(type === 'videos' ? 'play' : type === 'best-sellers' ? 'star' : 'box')}</span><span><strong>${esc(text)}</strong><small>${fixed ? 'جایگاه ثابت' : esc(N[type] || type)}</small></span></button>`;
    $('[data-outline]').innerHTML =
      row('__header', N.header, 'header', true) +
      rows()
        .map((s) => row(s.id, title(s), s.type, FIXED.includes(s.type)))
        .join('') +
      (!rows().some((s) => s.type === 'footer') ? row('__footer', N.footer, 'footer', true) : '');
  }
  function choose(id) {
    const wasVersion = !!E.previewVersion;
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
    return html;
  }
  function layout(s) {
    const v = s.settings?.editorOptionsV1?.[E.scope] || {},
      p = 'settings.editorOptionsV1.' + E.scope + '.';
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
      range('فاصله کارت‌ها', 'gap', 0, 64, 12) +
      range('گردی کارت‌ها', 'cardRadius', 0, 80, 20) +
      field(
        'تعداد کارت در ردیف',
        p + 'visibleCards',
        v.visibleCards,
        'number',
        'min="1" max="6" placeholder="طبق قالب"',
      ) +
      btn('reset-scope', 'استفاده از تنظیمات مشترک / قالب')
    );
  }
  function visibility(s) {
    const o = s.settings?.editorOptionsV1 || {};
    let html =
      check(
        'نمایش این بخش',
        'settings.editorOptionsV1.visible',
        o.visible === undefined ? s.enabled !== false : o.visible,
      ) +
      check('نمایش توضیح کوتاه', 'settings.editorOptionsV1.showSubtitle', o.showSubtitle !== false) +
      check('نمایش «مشاهده همه»', 'settings.editorOptionsV1.showAll', o.showAll !== false);
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
    } else if (s) {
      name = N[s.type] || s.type;
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
      `<div class="sfe-pane-head"><strong>${esc(name)}</strong><span>تنظیمات بخش انتخاب‌شده</span></div>${html}`;
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
        body: JSON.stringify({ config: sent.config, theme: sent.theme, expectedUpdatedAt: remote.updatedAt }),
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
    E.focus = document.activeElement;
    $('#sfe-dialog-title').textContent = name;
    $('[data-dialog-body]').innerHTML = html;
    $('[data-dialog-footer]').innerHTML = footer || btn('close', 'بستن');
    $('[data-overlay]').hidden = false;
    $('[data-overlay]').querySelector('button,input,select,textarea')?.focus();
  }
  function close() {
    E.modalEpoch++;
    $('[data-overlay]').hidden = true;
    if (E.focus?.isConnected) E.focus.focus();
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
        endsAt: 'پایان پیشنهاد',
        oldPrice: 'قیمت قبلی',
        discountLabel: 'برچسب تخفیف',
      };
    const label = (path) =>
      (labels[path.split('.').pop()] || 'تنظیم بخش') +
      (path.includes('.mobile.') ? ' · موبایل' : path.includes('.desktop.') ? ' · دسکتاپ' : '');
    const v = (value) =>
      value === undefined
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
              `<article class="sfe-change"><strong>${esc(c.title || N[c.type] || names[c.kind])}</strong><small>${names[c.kind]}</small>${c.fields.map((f) => `<div><span>${esc(label(f.path))}</span><del>${esc(v(f.before))}</del><ins>${esc(v(f.after))}</ins></div>`).join('')}</article>`,
          )
          .join('')
      : '<div class="sfe-help">تفاوتی وجود ندارد.</div>';
  }
  function review() {
    E.review = snap();
    dialog(
      'مرور تغییرات پیش از انتشار',
      differences(unpublished()) +
        area('یادداشت انتشار', '__note', '').replace('maxlength="2000"', 'maxlength="500"'),
      btn('close', 'ادامه ویرایش') + btn('publish', 'انتشار همین پیش‌نویس', true),
    );
  }
  async function publish() {
    if (E.publishing || E.saving || E.conflict) return;
    if (!M.equal(E.review, snap())) return review();
    const note = $('[data-field="__note"]')?.value || '';
    if (!(await save(false))) return;
    E.publishing = true;
    status();
    $('[data-action=publish]').disabled = true;
    try {
      const p = await sellerApiFetch(endpoint + '/publish', {
        method: 'POST',
        body: JSON.stringify({ note, expectedUpdatedAt: E.page.updatedAt }),
      });
      E.page = p;
      E.server = M.snapshot(p.config, p.theme);
      E.published = M.snapshot(p.publishedConfig || p.config, p.publishedTheme || p.theme);
      E.config = M.clone(p.config);
      E.theme = M.clone(p.theme);
      backup();
      close();
      tell('نسخه جدید منتشر شد');
    } catch (error) {
      if (error.status === 409) {
        E.conflict = true;
        close();
        tell('پیش‌نویس بعد از مرور تغییر کرده است؛ نسخه سرور را بررسی کنید');
      } else {
        E.error = error.message || 'انتشار ناموفق بود';
        tell(E.error);
      }
    } finally {
      E.publishing = false;
      status();
      $$('[data-action=publish]').forEach((b) => (b.disabled = false));
    }
  }
  function preview() {
    clearTimeout(E.previewTimer);
    E.previewTimer = setTimeout(() => {
      try {
        const s = E.previewVersion || snap();
        E.iframe?.contentWindow?.postMessage(
          { type: 'storefront-preview-config', config: s.config, theme: s.theme },
          location.origin,
        );
      } catch (_) {}
    }, 120);
  }
  function bridge() {
    let attempts = 0;
    const run = () => {
      if (!E.iframe?.isConnected) return;
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
          style.textContent = '[data-sfe-selected]{outline:2px solid #7354c9!important;outline-offset:-2px}';
          doc.head.appendChild(style);
        }
        const bind = () => {
          const map = {
            search: '.sf-search-block',
            videos: '.sf-video-section',
            'best-sellers': '.sf-best-sellers',
            campaign: '.sf-campaign-section',
            categories: '#sf-categories',
            footer: '.sf-footer',
          };
          rows().forEach((s) => {
            const node = map[s.type] && doc.querySelector(map[s.type]);
            if (node) node.dataset.sfeSection = s.id;
          });
          doc.querySelectorAll('[data-editor-section]').forEach((node) => {
            node.dataset.sfeSection = node.dataset.editorSection;
          });
          const header = doc.querySelector('.site-header');
          if (header) header.dataset.sfeSection = '__header';
          const footer = doc.querySelector('.sf-footer');
          if (footer && !footer.dataset.sfeSection) footer.dataset.sfeSection = '__footer';
          highlight();
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
          new MutationObserver(bind).observe(root, { childList: true });
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
      doc.querySelectorAll('[data-sfe-selected]').forEach((n) => n.removeAttribute('data-sfe-selected'));
      const node = doc.querySelector('[data-sfe-section="' + CSS.escape(E.activeSection || '') + '"]');
      if (node) {
        node.setAttribute('data-sfe-selected', '');
        if (E.lastPreviewSection !== E.activeSection) {
          node.scrollIntoView({ block: 'start', behavior: 'auto' });
          E.lastPreviewSection = E.activeSection;
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
              `<div class="sfe-selected-row"><span>${esc(E.products.find((p) => Number(p.id) === Number(id))?.name || 'محصول ' + id)}</span><button type="button" data-product-move="${i}" data-direction="-1" aria-label="بالاتر">↑</button><button type="button" data-product-move="${i}" data-direction="1" aria-label="پایین‌تر">↓</button><button type="button" data-product-remove="${id}" aria-label="حذف از انتخاب">×</button></div>`,
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
                `<label class="sfe-product-option">${image(p) ? `<img src="${esc(image(p))}" alt="">` : ico('box')}<span><strong>${esc(p.name)}</strong><small>${esc(price(p))} · موجودی ${fa(p.stockQty || 0)}</small></span><input type="checkbox" data-product-id="${p.id}" ${E.selectedProducts.map(Number).includes(Number(p.id)) ? 'checked' : ''}></label>`,
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
      `<div class="sfe-template-grid">${['hero', 'banner', 'product-collection', 'support-banner', 'trust'].map((t) => `<button type="button" data-add="${t}"><span class="sfe-template-preview ${t}"><i></i><b></b><i></i></span><strong>${N[t]}</strong><small>پیش‌نمایش چیدمان</small></button>`).join('')}</div>`,
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
    ]);
  }
  async function upload(file) {
    const types = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (!types.includes(file.type)) throw new Error('فرمت فایل پشتیبانی نمی‌شود');
    if (file.size > (file.type.startsWith('video/') ? 25 : 8) * 1024 * 1024)
      throw new Error('حجم فایل بیشتر از حد مجاز است');
    const form = new FormData();
    form.append('file', file);
    return sellerApiFetch('/storefront/media/upload', { method: 'POST', body: form });
  }
  async function media(kind = 'all', chooseMedia = null) {
    E.mediaKind = kind;
    E.mediaChoose = chooseMedia;
    E.mediaQuery = '';
    dialog(
      'کتابخانه رسانه',
      `<div class="sfe-picker-tools"><input type="search" data-media-query placeholder="جستجوی نام یا توضیح"><select data-media-kind><option value="all">همه رسانه‌ها</option><option value="image">تصاویر</option><option value="video">ویدیوها</option></select></div><label class="sfe-upload">انتخاب فایل برای آپلود<input type="file" data-media-file accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"></label><div data-upload-status aria-live="polite"></div><div class="sfe-media-grid" data-media-grid>در حال دریافت رسانه‌ها…</div>`,
    );
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
            return `<article class="sfe-media-card"><div class="sfe-media-visual">${a.kind === 'video' ? `<video src="${esc(a.url)}" muted playsinline preload="metadata"></video>` : `<img src="${esc(a.url)}" alt="${esc(a.altText || '')}">`}</div><strong>${esc(a.altText || (a.kind === 'video' ? 'ویدیو' : 'تصویر'))}</strong><small>${fa(Math.round((a.bytes || 0) / 1024))} KB · ${a.width && a.height ? esc(a.width + '×' + a.height) : ''}${a.duration ? ' · ' + fa(Math.round(a.duration)) + ' ثانیه' : ''}</small><small>${use.length ? 'استفاده در ' + fa(new Set(use.map((r) => r.owner)).size) + ' بخش' : 'بدون استفاده در نسخه فعلی'}</small><div>${E.mediaChoose ? btn('use-media', 'انتخاب', true, `data-id="${a.id}"`) : ''}${btn('asset', 'جزئیات و استفاده‌ها', false, `data-id="${a.id}"`)}${btn('replace-media', 'جایگزین', false, `data-id="${a.id}"`)}${btn('delete-media', 'حذف', false, `data-id="${a.id}" ${use.length ? 'disabled' : ''}`)}</div></article>`;
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
      up: () => move(-1),
      down: () => move(1),
      'reset-scope': () =>
        mutate(() => {
          if (active()?.settings?.editorOptionsV1) delete active().settings.editorOptionsV1[E.scope];
        }),
      'apply-products': () => {
        mutate(() => {
          M.setPath(active(), 'settings.productIds', E.selectedProducts.slice());
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
        if (a && E.mediaChoose) E.mediaChoose(a);
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
  window.StorefrontEditorComplete = { version: 'workbench-1', render, state: E };
  window.renderStorefrontEditor = render;
})();
