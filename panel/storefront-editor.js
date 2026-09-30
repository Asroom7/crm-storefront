/* Storefront Visual Editor. Loaded after the existing panel enhancements so it
   can extend Settings without replacing CRM/business logic. */
(function () {
  'use strict';

  if (typeof sellerApiFetch !== 'function') return;

  const TYPE_LABELS = {
    search: 'جستجو و ناوبری',
    hero: 'بنر اصلی',
    categories: 'دسته‌بندی تصویری',
    'product-collection': 'کالکشن محصولات',
    'best-sellers': 'پرفروش‌ترین‌ها',
    campaign: 'پیشنهاد ویژه',
    videos: 'ویدئوهای آموزشی',
    banner: 'بنر تبلیغاتی',
    'support-banner': 'بنر پشتیبانی',
    trust: 'مزایای فروشگاه',
    footer: 'فوتر',
  };

  const ADDABLE_TYPES = ['hero', 'categories', 'product-collection', 'best-sellers', 'campaign', 'videos', 'banner', 'support-banner', 'trust'];
  const stateEditor = {
    page: null,
    config: null,
    theme: null,
    versions: [],
    dirty: false,
    device: 'desktop',
    loading: false,
    root: null,
    iframe: null,
    dragId: null,
  };

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function uid(type) { return `${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`; }
  function safeText(value) { return typeof esc === 'function' ? esc(value) : String(value == null ? '' : value); }
  function sectionTitle(section) {
    const content = section.content || {};
    return content.title || TYPE_LABELS[section.type] || section.type;
  }
  function markDirty() {
    stateEditor.dirty = true;
    refreshStatus();
    sendPreview();
  }
  function refreshStatus() {
    const node = stateEditor.root && stateEditor.root.querySelector('[data-editor-dirty]');
    if (!node) return;
    node.classList.toggle('is-dirty', stateEditor.dirty);
    node.textContent = stateEditor.dirty ? 'تغییرات ذخیره‌نشده' : 'پیش‌نویس ذخیره شده';
  }
  function toastSafe(message) { if (typeof toast === 'function') toast(message); }
  function formatDate(value) {
    if (!value) return 'هنوز منتشر نشده';
    try { return new Date(value).toLocaleString('fa-IR', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch (e) { return String(value); }
  }

  function defaultSection(type) {
    const base = { id: uid(type), type, enabled: true, content: {}, settings: {} };
    if (type === 'hero') base.content = { eyebrow: 'BEAUTY · CARE · YOU', title: 'عنوان بنر اصلی', text: 'توضیح کوتاه و واضح برای مشتری', ctaText: 'مشاهده محصولات', ctaUrl: 'products.html', imageUrl: '' };
    if (type === 'categories') { base.content = { title: 'دسته‌بندی‌ها', subtitle: 'شروع سریع از چیزی که لازم داری' }; base.settings = { limit: 6 }; }
    if (type === 'product-collection') { base.content = { title: 'محصولات منتخب', subtitle: '' }; base.settings = { limit: 8, productIds: [] }; }
    if (type === 'best-sellers') { base.content = { title: 'پرفروش‌ترین‌ها', subtitle: 'انتخاب‌های محبوب مشتریان' }; base.settings = { mode: 'auto', limit: 8, productIds: [] }; }
    if (type === 'campaign') { base.enabled = false; base.content = { title: 'پیشنهاد ویژه', subtitle: 'فرصت محدود برای خرید با قیمت بهتر', ctaText: 'مشاهده همه', badge: 'پیشنهاد ویژه' }; base.settings = { startsAt: null, endsAt: null, productIds: [] }; }
    if (type === 'videos') { base.content = { title: 'جعبه جادویی', subtitle: 'ویدئوهای آموزشی و معرفی محصولات' }; base.settings = { limit: 3 }; }
    if (type === 'banner') { base.enabled = false; base.content = { title: 'عنوان بنر', text: '', ctaText: 'مشاهده', ctaUrl: 'products.html', imageUrl: '' }; }
    if (type === 'footer') base.content = { about: 'فروشگاه آنلاین محصولات مراقبتی و زیبایی.' };
    return base;
  }

  function appendSettingsEntry() {
    if (typeof renderSettings !== 'function' || renderSettings.__storefrontEditorWrapped) return;
    const previous = renderSettings;
    const wrapped = function (view) {
      previous(view);
      if (view.querySelector('[data-storefront-editor-link]')) return;
      const groups = view.querySelectorAll('.settings-group');
      const target = Array.from(groups).find(function (group) {
        return String(group.textContent || '').includes('مدیریت فروشگاه');
      }) || groups[groups.length - 1];
      if (!target) return;
      const link = document.createElement('a');
      link.href = '#/storefront-editor';
      link.className = 'settings-row';
      link.dataset.storefrontEditorLink = '1';
      link.style.cssText = 'text-decoration:none;color:inherit;';
      link.innerHTML = `<div class="settings-row__icon">${ic('edit')}</div><div class="settings-row__text"><div class="settings-row__title">ویرایش سایت فروشگاهی</div><div class="settings-row__desc">چیدمان، محتوا، رنگ‌ها، رسانه و انتشار</div></div><div class="settings-row__chev">${ic('chevL')}</div>`;
      target.appendChild(link);
    };
    wrapped.__storefrontEditorWrapped = true;
    renderSettings = wrapped;
  }

  function renderError(view, error) {
    view.innerHTML = `<div class="detail-header"><button class="back-btn" data-editor-back>${ic('chevR')}</button><div><h3 style="font-size:15.5px;">ویرایش سایت فروشگاهی</h3></div></div><div class="store-editor-error">${safeText(error && error.message || 'اتصال به تنظیمات فروشگاه ناموفق بود.')}</div><div style="margin-top:10px;"><button class="btn primary" data-editor-retry>تلاش دوباره</button></div>`;
    view.querySelector('[data-editor-back]').addEventListener('click', function () { location.hash = '#/settings'; });
    view.querySelector('[data-editor-retry]').addEventListener('click', function () { renderStorefrontEditor(view); });
  }

  function sectionRowsHTML() {
    const sections = stateEditor.config && Array.isArray(stateEditor.config.sections) ? stateEditor.config.sections : [];
    return sections.map(function (section, index) {
      return `<div class="store-section-row ${section.enabled === false ? 'is-disabled' : ''}" draggable="true" data-section-id="${safeText(section.id)}">
        <div class="store-section-grip" title="جابجایی">⋮⋮</div>
        <div class="store-section-main"><strong>${safeText(sectionTitle(section))}</strong><span>${safeText(section.type)}</span></div>
        <div class="store-section-actions">
          <button type="button" class="store-section-toggle ${section.enabled === false ? '' : 'on'}" data-section-toggle="${safeText(section.id)}" aria-label="فعال یا غیرفعال"></button>
          <button type="button" class="store-section-action" data-section-up="${safeText(section.id)}" aria-label="بالا" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="store-section-action" data-section-down="${safeText(section.id)}" aria-label="پایین" ${index === sections.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" class="store-section-action" data-section-edit="${safeText(section.id)}" aria-label="ویرایش">${ic('edit')}</button>
          <button type="button" class="store-section-action" data-section-duplicate="${safeText(section.id)}" aria-label="کپی">⧉</button>
          <button type="button" class="store-section-action danger" data-section-delete="${safeText(section.id)}" aria-label="حذف">${ic('trash')}</button>
        </div>
      </div>`;
    }).join('') || '<div class="store-editor-empty">هیچ سکشنی در صفحه نیست.</div>';
  }

  function themeHTML() {
    const t = stateEditor.theme || {};
    return `<div class="store-theme-grid">
      <div class="store-theme-field"><label>رنگ اصلی</label><input type="color" data-theme="primaryColor" value="${safeText(t.primaryColor || '#cf4772')}"></div>
      <div class="store-theme-field"><label>رنگ Accent</label><input type="color" data-theme="accentColor" value="${safeText(t.accentColor || '#452b45')}"></div>
      <div class="store-theme-field"><label>پس‌زمینه</label><input type="color" data-theme="backgroundColor" value="${safeText(t.backgroundColor || '#fffdfc')}"></div>
      <div class="store-theme-field"><label>سطح کارت</label><input type="color" data-theme="surfaceColor" value="${safeText(t.surfaceColor || '#ffffff')}"></div>
      <div class="store-theme-field"><label>رنگ متن</label><input type="color" data-theme="textColor" value="${safeText(t.textColor || '#211b1e')}"></div>
      <div class="store-theme-field"><label>متن ثانویه</label><input type="color" data-theme="mutedColor" value="${safeText(t.mutedColor || '#746b70')}"></div>
      <div class="store-theme-field"><label>گردی کارت</label><input type="number" min="0" max="80" data-theme-number="cardRadius" value="${Number(t.cardRadius || 20)}"></div>
      <div class="store-theme-field"><label>عرض کانتینر</label><input type="number" min="720" max="1600" data-theme-number="containerWidth" value="${Number(t.containerWidth || 1180)}"></div>
      <div class="store-theme-field"><label>فاصله سکشن‌ها</label><input type="number" min="16" max="160" data-theme-number="sectionSpacing" value="${Number(t.sectionSpacing || 64)}"></div>
      <div class="store-theme-field"><label>Padding عمومی</label><input type="number" min="8" max="64" data-theme-number="globalPadding" value="${Number(t.globalPadding || 18)}"></div>
      <div class="store-theme-field full"><label>فونت</label><input type="text" data-theme="fontFamily" value="${safeText(t.fontFamily || 'Tahoma, Arial, sans-serif')}"></div>
      <div class="store-theme-field full"><label>سایه</label><select data-theme="shadowPreset"><option value="none" ${t.shadowPreset === 'none' ? 'selected' : ''}>بدون سایه</option><option value="soft" ${t.shadowPreset !== 'none' && t.shadowPreset !== 'medium' ? 'selected' : ''}>نرم</option><option value="medium" ${t.shadowPreset === 'medium' ? 'selected' : ''}>متوسط</option></select></div>
    </div>`;
  }

  function versionsHTML() {
    if (!stateEditor.versions.length) return '<div class="store-editor-empty">هنوز نسخه منتشرشده‌ای وجود ندارد.</div>';
    return `<div class="store-version-list">${stateEditor.versions.map(function (version) {
      return `<div class="store-version-row"><div><strong>نسخه ${faDigits(version.revision)}</strong><span>${safeText(formatDate(version.publishedAt))}${version.note ? ' · ' + safeText(version.note) : ''}</span></div><button class="btn secondary" data-restore-version="${version.id}">بازگردانی به پیش‌نویس</button></div>`;
    }).join('')}</div>`;
  }

  function renderShell(view) {
    stateEditor.root = view;
    const revision = stateEditor.page ? Number(stateEditor.page.revision || 0) : 0;
    view.innerHTML = `<div class="store-editor">
      <div class="store-editor-head"><div><h2>ویرایش سایت فروشگاهی</h2><p>تغییرات ابتدا پیش‌نویس هستند. فقط با «انتشار» روی سایت واقعی اعمال می‌شوند.</p></div><div class="store-editor-status"><span class="store-editor-pill is-live">نسخه زنده: ${faDigits(revision)}</span><span class="store-editor-pill" data-editor-dirty>پیش‌نویس ذخیره شده</span></div></div>
      <div class="store-editor-actions"><button class="btn secondary" data-editor-back>${ic('chevR')} تنظیمات</button><button class="btn secondary" data-editor-save>${ic('check')} ذخیره پیش‌نویس</button><button class="btn secondary" data-editor-media>${ic('box')} رسانه‌ها</button><div class="store-editor-actions__spacer"></div><button class="btn primary" data-editor-publish>${ic('spark')} انتشار روی سایت</button></div>
      <div class="store-editor-layout">
        <aside class="store-editor-sidebar">
          <section class="store-editor-card"><div class="store-editor-card__head"><strong>سکشن‌های صفحه</strong><span>Drag & Drop یا ↑ ↓</span></div><div class="store-section-list" data-section-list>${sectionRowsHTML()}</div><div class="store-editor-add"><select data-add-type>${ADDABLE_TYPES.map(function (type) { return `<option value="${type}">${safeText(TYPE_LABELS[type])}</option>`; }).join('')}</select><button class="btn primary" data-add-section>${ic('plus')} افزودن</button></div></section>
          <section class="store-editor-card"><div class="store-editor-card__head"><strong>هویت بصری</strong><span>Global Design</span></div>${themeHTML()}</section>
          <section class="store-editor-card"><div class="store-editor-card__head"><strong>تاریخچه انتشار</strong><button class="btn secondary" style="padding:5px 8px;font-size:9px;" data-refresh-versions>به‌روزرسانی</button></div><div data-version-list>${versionsHTML()}</div></section>
        </aside>
        <section class="store-preview-card"><div class="store-preview-toolbar"><strong>پیش‌نمایش زنده</strong><div class="store-preview-devices"><button class="store-preview-device ${stateEditor.device === 'desktop' ? 'active' : ''}" data-device="desktop">Desktop</button><button class="store-preview-device ${stateEditor.device === 'tablet' ? 'active' : ''}" data-device="tablet">Tablet</button><button class="store-preview-device ${stateEditor.device === 'mobile' ? 'active' : ''}" data-device="mobile">Mobile</button></div></div><div class="store-preview-stage"><div class="store-preview-frame-wrap" data-preview-wrap data-device="${stateEditor.device}"><iframe class="store-preview-frame" data-preview-frame title="پیش‌نمایش فروشگاه" src="../index.html?editorPreview=1"></iframe></div></div></section>
      </div>
    </div>`;
    stateEditor.iframe = view.querySelector('[data-preview-frame]');
    bindEditorEvents();
    refreshStatus();
  }

  function sendPreview() {
    if (!stateEditor.iframe || !stateEditor.iframe.contentWindow || !stateEditor.config) return;
    try {
      stateEditor.iframe.contentWindow.postMessage({ type: 'storefront-preview-config', config: clone(stateEditor.config), theme: clone(stateEditor.theme || {}) }, window.location.origin);
    } catch (e) {}
  }

  function rerenderSectionList() {
    const list = stateEditor.root && stateEditor.root.querySelector('[data-section-list]');
    if (!list) return;
    list.innerHTML = sectionRowsHTML();
    bindSectionEvents(list);
  }

  function moveSection(id, delta) {
    const sections = stateEditor.config.sections;
    const index = sections.findIndex(function (section) { return section.id === id; });
    const target = index + delta;
    if (index < 0 || target < 0 || target >= sections.length) return;
    const row = sections.splice(index, 1)[0]; sections.splice(target, 0, row); markDirty(); rerenderSectionList();
  }

  function deleteSection(id) {
    const section = stateEditor.config.sections.find(function (item) { return item.id === id; });
    if (!section) return;
    const perform = function () {
      stateEditor.config.sections = stateEditor.config.sections.filter(function (item) { return item.id !== id; });
      markDirty(); rerenderSectionList();
    };
    if (typeof confirmDialog === 'function') confirmDialog('حذف سکشن', `«${sectionTitle(section)}» از پیش‌نویس حذف شود؟`, perform);
    else if (window.confirm('این سکشن حذف شود؟')) perform();
  }

  function duplicateSection(id) {
    const sections = stateEditor.config.sections;
    const index = sections.findIndex(function (section) { return section.id === id; });
    if (index < 0) return;
    const copy = clone(sections[index]); copy.id = uid(copy.type); if (copy.content && copy.content.title) copy.content.title += ' - کپی';
    sections.splice(index + 1, 0, copy); markDirty(); rerenderSectionList();
  }

  function bindSectionEvents(scope) {
    scope.querySelectorAll('[data-section-toggle]').forEach(function (button) {
      button.addEventListener('click', function () { const section = stateEditor.config.sections.find(function (x) { return x.id === button.dataset.sectionToggle; }); if (!section) return; section.enabled = section.enabled === false; markDirty(); rerenderSectionList(); });
    });
    scope.querySelectorAll('[data-section-up]').forEach(function (button) { button.addEventListener('click', function () { moveSection(button.dataset.sectionUp, -1); }); });
    scope.querySelectorAll('[data-section-down]').forEach(function (button) { button.addEventListener('click', function () { moveSection(button.dataset.sectionDown, 1); }); });
    scope.querySelectorAll('[data-section-edit]').forEach(function (button) { button.addEventListener('click', function () { openSectionEditor(button.dataset.sectionEdit); }); });
    scope.querySelectorAll('[data-section-duplicate]').forEach(function (button) { button.addEventListener('click', function () { duplicateSection(button.dataset.sectionDuplicate); }); });
    scope.querySelectorAll('[data-section-delete]').forEach(function (button) { button.addEventListener('click', function () { deleteSection(button.dataset.sectionDelete); }); });
    scope.querySelectorAll('.store-section-row').forEach(function (row) {
      row.addEventListener('dragstart', function () { stateEditor.dragId = row.dataset.sectionId; row.classList.add('is-dragging'); });
      row.addEventListener('dragend', function () { stateEditor.dragId = null; row.classList.remove('is-dragging'); scope.querySelectorAll('.is-drop-target').forEach(function (x) { x.classList.remove('is-drop-target'); }); });
      row.addEventListener('dragover', function (event) { event.preventDefault(); if (stateEditor.dragId && stateEditor.dragId !== row.dataset.sectionId) row.classList.add('is-drop-target'); });
      row.addEventListener('dragleave', function () { row.classList.remove('is-drop-target'); });
      row.addEventListener('drop', function (event) {
        event.preventDefault(); row.classList.remove('is-drop-target');
        const fromId = stateEditor.dragId, toId = row.dataset.sectionId; if (!fromId || fromId === toId) return;
        const sections = stateEditor.config.sections; const from = sections.findIndex(function (x) { return x.id === fromId; }); const to = sections.findIndex(function (x) { return x.id === toId; });
        if (from < 0 || to < 0) return; const moved = sections.splice(from, 1)[0]; sections.splice(to, 0, moved); markDirty(); rerenderSectionList();
      });
    });
  }

  function bindEditorEvents() {
    const root = stateEditor.root;
    root.querySelector('[data-editor-back]').addEventListener('click', function () { location.hash = '#/settings'; });
    root.querySelector('[data-editor-save]').addEventListener('click', saveDraft);
    root.querySelector('[data-editor-publish]').addEventListener('click', publishDraft);
    root.querySelector('[data-editor-media]').addEventListener('click', function () { openMediaManager(); });
    root.querySelector('[data-add-section]').addEventListener('click', function () { const type = root.querySelector('[data-add-type]').value; stateEditor.config.sections.push(defaultSection(type)); markDirty(); rerenderSectionList(); });
    root.querySelectorAll('[data-theme]').forEach(function (input) { input.addEventListener('input', function () { stateEditor.theme[input.dataset.theme] = input.value; markDirty(); }); });
    root.querySelectorAll('[data-theme-number]').forEach(function (input) { input.addEventListener('input', function () { stateEditor.theme[input.dataset.themeNumber] = Number(input.value); markDirty(); }); });
    root.querySelectorAll('[data-device]').forEach(function (button) { button.addEventListener('click', function () { stateEditor.device = button.dataset.device; root.querySelectorAll('[data-device]').forEach(function (x) { x.classList.toggle('active', x.dataset.device === stateEditor.device); }); root.querySelector('[data-preview-wrap]').dataset.device = stateEditor.device; }); });
    root.querySelector('[data-refresh-versions]').addEventListener('click', refreshVersions);
    bindSectionEvents(root.querySelector('[data-section-list]'));
    bindVersionEvents();
    stateEditor.iframe.addEventListener('load', function () { window.setTimeout(sendPreview, 150); window.setTimeout(sendPreview, 700); });
  }

  function bindVersionEvents() {
    const root = stateEditor.root; if (!root) return;
    root.querySelectorAll('[data-restore-version]').forEach(function (button) { button.addEventListener('click', function () { restoreVersion(Number(button.dataset.restoreVersion)); }); });
  }

  async function saveDraft() {
    if (!stateEditor.config || !stateEditor.theme) return false;
    const button = stateEditor.root && stateEditor.root.querySelector('[data-editor-save]');
    if (button) button.disabled = true;
    try {
      const page = await sellerApiFetch('/storefront/editor/home', { method: 'PUT', body: JSON.stringify({ config: stateEditor.config, theme: stateEditor.theme }) });
      stateEditor.page = page; stateEditor.config = clone(page.config); stateEditor.theme = clone(page.theme); stateEditor.dirty = false; refreshStatus(); toastSafe('پیش‌نویس ذخیره شد'); return true;
    } catch (error) { toastSafe(error.message || 'ذخیره پیش‌نویس ناموفق بود'); return false; }
    finally { if (button) button.disabled = false; }
  }

  async function publishDraft() {
    const button = stateEditor.root && stateEditor.root.querySelector('[data-editor-publish]');
    if (button) button.disabled = true;
    try {
      if (stateEditor.dirty && !(await saveDraft())) return;
      const page = await sellerApiFetch('/storefront/editor/home/publish', { method: 'POST', body: JSON.stringify({ note: 'انتشار از Visual Editor' }) });
      stateEditor.page = page; stateEditor.config = clone(page.config); stateEditor.theme = clone(page.theme); stateEditor.dirty = false; await refreshVersions(false); renderShell(stateEditor.root); toastSafe('نسخه جدید روی فروشگاه منتشر شد');
    } catch (error) { toastSafe(error.message || 'انتشار ناموفق بود'); }
    finally { if (button && button.isConnected) button.disabled = false; }
  }

  async function refreshVersions(render) {
    try { stateEditor.versions = await sellerApiFetch('/storefront/editor/home/versions'); }
    catch (error) { stateEditor.versions = []; if (render !== false) toastSafe(error.message); }
    if (render !== false && stateEditor.root) { const box = stateEditor.root.querySelector('[data-version-list]'); if (box) { box.innerHTML = versionsHTML(); bindVersionEvents(); } }
  }

  async function restoreVersion(id) {
    const perform = async function () {
      try {
        const page = await sellerApiFetch(`/storefront/editor/home/versions/${id}/restore`, { method: 'POST', body: JSON.stringify({}) });
        stateEditor.page = page; stateEditor.config = clone(page.config); stateEditor.theme = clone(page.theme); stateEditor.dirty = false; renderShell(stateEditor.root); toastSafe('نسخه انتخابی به پیش‌نویس بازگردانده شد. برای Live شدن باید انتشار بزنی.');
      } catch (error) { toastSafe(error.message); }
    };
    if (typeof confirmDialog === 'function') confirmDialog('بازگردانی نسخه', 'این نسخه جای پیش‌نویس فعلی را می‌گیرد ولی خودکار منتشر نمی‌شود.', perform); else perform();
  }

  function field(name, label, value, type, extra) {
    return `<div class="field ${extra || ''}"><label>${safeText(label)}</label><input name="${safeText(name)}" type="${type || 'text'}" value="${safeText(value == null ? '' : value)}"></div>`;
  }
  function textArea(name, label, value, extra) { return `<div class="field ${extra || ''}"><label>${safeText(label)}</label><textarea name="${safeText(name)}">${safeText(value || '')}</textarea></div>`; }
  function dateLocalValue(value) { if (!value) return ''; const d = new Date(value); if (Number.isNaN(d.getTime())) return ''; const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
  function selectedProductIds(section) { return Array.isArray(section.settings && section.settings.productIds) ? section.settings.productIds.map(Number) : []; }
  function productPickerHTML(section) {
    const selected = new Set(selectedProductIds(section));
    if (!state.products.length) return '<div class="store-editor-empty">محصولی برای انتخاب وجود ندارد.</div>';
    return `<div class="store-editor-product-picker">${state.products.map(function (product) { return `<label class="store-editor-product-option"><input type="checkbox" name="productIds" value="${product.id}" ${selected.has(Number(product.id)) ? 'checked' : ''}><span>${safeText(product.name)}</span></label>`; }).join('')}</div>`;
  }

  function sectionFieldsHTML(section) {
    const c = section.content || {}, s = section.settings || {};
    let html = '<div class="store-editor-modal-grid">';
    if (['hero','categories','product-collection','best-sellers','campaign','videos','banner'].includes(section.type)) html += field('title','عنوان',c.title || '','text','full');
    if (['categories','product-collection','best-sellers','campaign','videos'].includes(section.type)) html += field('subtitle','زیرعنوان',c.subtitle || '','text','full');
    if (section.type === 'hero') { html += field('eyebrow','متن کوچک بالای عنوان',c.eyebrow || '','text','full') + textArea('text','توضیح',c.text || '','full') + field('ctaText','متن دکمه',c.ctaText || '','text') + field('ctaUrl','لینک دکمه',c.ctaUrl || '','text') + imagePickerField('imageUrl','تصویر بنر',c.imageUrl || ''); }
    if (section.type === 'categories') html += field('limit','تعداد دسته‌ها',s.limit || 6,'number');
    if (section.type === 'product-collection') html += field('limit','تعداد محصول',s.limit || 8,'number');
    if (section.type === 'best-sellers') html += `<div class="field"><label>حالت انتخاب</label><select name="mode"><option value="auto" ${s.mode !== 'manual' ? 'selected' : ''}>خودکار از فروش واقعی</option><option value="manual" ${s.mode === 'manual' ? 'selected' : ''}>انتخاب دستی</option></select></div>` + field('limit','تعداد محصول',s.limit || 8,'number');
    if (section.type === 'campaign') html += field('badge','متن Badge',c.badge || 'پیشنهاد ویژه','text') + field('ctaText','متن مشاهده همه',c.ctaText || 'مشاهده همه','text') + field('startsAt','شروع کمپین',dateLocalValue(s.startsAt),'datetime-local') + field('endsAt','پایان کمپین',dateLocalValue(s.endsAt),'datetime-local');
    if (section.type === 'videos') html += field('limit','تعداد ویدئو',s.limit || 3,'number');
    if (section.type === 'banner') html += textArea('text','توضیح',c.text || '','full') + field('ctaText','متن دکمه',c.ctaText || '','text') + field('ctaUrl','لینک',c.ctaUrl || '','text') + imagePickerField('imageUrl','تصویر بنر',c.imageUrl || '');
    if (section.type === 'footer') html += textArea('about','توضیح کوتاه فروشگاه',c.about || '','full');
    html += '</div>';
    if (['product-collection','best-sellers','campaign'].includes(section.type)) html += `<div class="field"><label>محصولات مرتبط ${section.type === 'best-sellers' ? '(در حالت دستی)' : ''}</label>${productPickerHTML(section)}</div>`;
    if (['search','support-banner','trust'].includes(section.type)) html += '<div class="store-editor-empty">این سکشن فعلاً از داده‌های زنده فروشگاه استفاده می‌کند و تنظیم محتوایی جداگانه لازم ندارد.</div>';
    return html;
  }

  function imagePickerField(name, label, value) {
    return `<div class="field full"><label>${safeText(label)}</label><div class="store-editor-image-pick"><input name="${name}" value="${safeText(value || '')}" placeholder="https://..."><button type="button" class="btn secondary" data-pick-media-for="${name}">انتخاب رسانه</button></div></div>`;
  }

  function openSectionEditor(id) {
    const section = stateEditor.config.sections.find(function (item) { return item.id === id; }); if (!section) return;
    const html = `<div class="modal__handle"></div><h3 class="modal__title">ویرایش ${safeText(TYPE_LABELS[section.type] || section.type)}</h3><form data-section-form>${sectionFieldsHTML(section)}<div class="modal__actions"><button type="button" class="btn secondary block" data-close-modal>انصراف</button><button type="submit" class="btn primary block">${ic('check')} اعمال در پیش‌نویس</button></div></form>`;
    const wrap = openModal(html); const form = wrap.querySelector('[data-section-form]');
    wrap.querySelectorAll('[data-pick-media-for]').forEach(function (button) { button.addEventListener('click', function () { openMediaManager(function (asset) { const input = form.elements[button.dataset.pickMediaFor]; if (input) input.value = asset.url; }); }); });
    form.addEventListener('submit', function (event) {
      event.preventDefault(); const data = new FormData(form); section.content = section.content || {}; section.settings = section.settings || {};
      ['title','subtitle','eyebrow','text','ctaText','ctaUrl','imageUrl','badge','about'].forEach(function (key) { if (form.elements[key]) section.content[key] = String(data.get(key) || '').trim(); });
      if (form.elements.limit) section.settings.limit = Math.max(1, Math.min(20, Number(data.get('limit')) || 1));
      if (form.elements.mode) section.settings.mode = data.get('mode') === 'manual' ? 'manual' : 'auto';
      if (form.elements.startsAt) section.settings.startsAt = data.get('startsAt') ? new Date(data.get('startsAt')).toISOString() : null;
      if (form.elements.endsAt) section.settings.endsAt = data.get('endsAt') ? new Date(data.get('endsAt')).toISOString() : null;
      if (form.querySelector('[name=productIds]')) section.settings.productIds = Array.from(form.querySelectorAll('[name=productIds]:checked')).map(function (input) { return Number(input.value); });
      closeModal(); markDirty(); rerenderSectionList();
    });
  }

  async function openMediaManager(onChoose) {
    const html = `<div class="modal__handle"></div><h3 class="modal__title">مدیریت رسانه</h3><div class="store-media-upload"><div><strong style="font-size:11px;">آپلود تصویر یا ویدئو</strong><div style="font-size:9.5px;color:var(--ink-soft);margin-top:3px;">تصویر تا ۸MB، ویدئو تا ۲۵MB</div></div><input type="file" data-media-file accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"><button class="btn primary" data-media-upload>آپلود</button></div><div data-media-message class="store-editor-empty">در حال دریافت رسانه‌ها...</div><div class="store-media-grid" data-media-grid></div>`;
    const wrap = openModal(html); const grid = wrap.querySelector('[data-media-grid]'), message = wrap.querySelector('[data-media-message]');
    async function load() {
      try {
        const rows = await sellerApiFetch('/storefront/media'); message.style.display = rows.length ? 'none' : ''; message.textContent = rows.length ? '' : 'هنوز رسانه‌ای آپلود نشده است.';
        grid.innerHTML = rows.map(function (asset) { const visual = asset.kind === 'video' ? `<video src="${safeText(asset.url)}" muted playsinline preload="metadata"></video>` : `<img src="${safeText(asset.url)}" alt="${safeText(asset.altText || '')}" loading="lazy">`; return `<div class="store-media-item"><div class="store-media-visual">${visual}</div><div class="store-media-meta">${safeText(asset.altText || asset.kind)}</div><div class="store-media-actions">${onChoose ? `<button class="btn primary" data-use-media="${asset.id}">انتخاب</button>` : `<button class="btn secondary" data-copy-media="${asset.id}">کپی لینک</button>`}<button class="btn danger" data-delete-media="${asset.id}">حذف</button></div></div>`; }).join('');
        grid.querySelectorAll('[data-use-media]').forEach(function (button) { button.addEventListener('click', function () { const asset = rows.find(function (x) { return Number(x.id) === Number(button.dataset.useMedia); }); if (asset) { onChoose(asset); closeModal(); } }); });
        grid.querySelectorAll('[data-copy-media]').forEach(function (button) { button.addEventListener('click', async function () { const asset = rows.find(function (x) { return Number(x.id) === Number(button.dataset.copyMedia); }); if (!asset) return; try { await navigator.clipboard.writeText(asset.url); toastSafe('لینک کپی شد'); } catch (e) { toastSafe(asset.url); } }); });
        grid.querySelectorAll('[data-delete-media]').forEach(function (button) { button.addEventListener('click', function () { const id = Number(button.dataset.deleteMedia); const remove = async function () { try { await sellerApiFetch(`/storefront/media/${id}`, { method: 'DELETE' }); toastSafe('رسانه حذف شد'); load(); } catch (error) { toastSafe(error.message); } }; if (typeof confirmDialog === 'function') confirmDialog('حذف رسانه','فایل از Media Manager و فضای ذخیره‌سازی حذف شود؟',remove); else remove(); }); });
      } catch (error) { message.style.display = ''; message.textContent = error.message || 'دریافت رسانه‌ها ناموفق بود.'; }
    }
    wrap.querySelector('[data-media-upload]').addEventListener('click', async function () {
      const input = wrap.querySelector('[data-media-file]'); if (!input.files || !input.files[0]) return toastSafe('یک فایل انتخاب کن');
      const form = new FormData(); form.append('file', input.files[0]); const button = wrap.querySelector('[data-media-upload]'); button.disabled = true;
      try { await sellerApiFetch('/storefront/media/upload', { method: 'POST', body: form }); input.value = ''; toastSafe('رسانه آپلود شد'); await load(); } catch (error) { toastSafe(error.message); } finally { button.disabled = false; }
    });
    load();
  }

  async function renderStorefrontEditor(view) {
    if (stateEditor.loading) return;
    stateEditor.loading = true; stateEditor.root = view;
    if (typeof renderNav === 'function') renderNav('settings');
    view.innerHTML = '<div class="store-editor-loading">در حال دریافت تنظیمات فروشگاه...</div>';
    try {
      const results = await Promise.all([sellerApiFetch('/storefront/editor/home'), sellerApiFetch('/storefront/editor/home/versions').catch(function () { return []; })]);
      stateEditor.page = results[0]; stateEditor.config = clone(results[0].config); stateEditor.theme = clone(results[0].theme); stateEditor.versions = results[1] || []; stateEditor.dirty = false; renderShell(view);
    } catch (error) { renderError(view, error); }
    finally { stateEditor.loading = false; }
  }

  window.renderStorefrontEditor = renderStorefrontEditor;
  appendSettingsEntry();

  function routeExtension() {
    const routeName = location.hash.replace(/^#\/?/, '').split('/')[0];
    if (routeName !== 'storefront-editor') return;
    const view = document.getElementById('view'); if (view) renderStorefrontEditor(view);
  }
  window.addEventListener('hashchange', function () { window.setTimeout(routeExtension, 0); });
  if (location.hash.replace(/^#\/?/, '').split('/')[0] === 'storefront-editor') window.setTimeout(routeExtension, 0);
})();
