/* Storefront Visual Editor: constraint-based sections + real backend draft/publish workflow. */
(function () {
  'use strict';

  if (typeof sellerApiFetch !== 'function' || typeof renderSettings !== 'function' || typeof router !== 'function') return;

  const ROUTE = 'storefront-editor';
  const PAGE_SLUG = 'home';
  const SUPPORTED_TYPES = ['search', 'hero', 'categories', 'product-collection', 'videos', 'support-banner', 'trust', 'footer'];
  const TYPE_META = {
    search: { label: 'جستجو', icon: 'search' },
    hero: { label: 'بنر اصلی', icon: 'spark' },
    categories: { label: 'دسته‌بندی‌ها', icon: 'box' },
    'product-collection': { label: 'کالکشن محصولات', icon: 'cart' },
    videos: { label: 'ویدئوهای آموزشی', icon: 'star' },
    'support-banner': { label: 'بنر پشتیبانی', icon: 'chat' },
    trust: { label: 'مزایای فروشگاه', icon: 'check' },
    footer: { label: 'فوتر', icon: 'gear' },
  };

  let keyCounter = 0;
  let editorState = null;
  let currentView = null;
  let messageBound = false;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function nextKey(type) { keyCounter += 1; return `${type}-${Date.now().toString(36)}-${keyCounter}`; }

  function defaultSections() {
    return [
      { key: 'search', type: 'search', enabled: true, content: { placeholder: 'دنبال چه محصولی می‌گردی؟' }, settings: {} },
      { key: 'hero', type: 'hero', enabled: true, content: { eyebrow: 'BEAUTY · CARE · YOU', title: 'روتین زیبایی، ساده‌تر و انتخاب‌شده‌تر', description: 'محصولات مراقبتی و زیبایی را مرتب، سریع و با اطلاعات روشن پیدا کن و سفارش را از همین فروشگاه پیگیری کن.', primaryLabel: 'مشاهده محصولات', primaryUrl: 'products.html', secondaryLabel: 'دسته‌بندی‌ها', secondaryUrl: '#sf-categories' }, settings: {} },
      { key: 'categories', type: 'categories', enabled: true, content: { title: 'دسته‌بندی‌ها', subtitle: 'شروع سریع از چیزی که لازم داری' }, settings: { limit: 6 } },
      { key: 'featured', type: 'product-collection', enabled: true, content: { title: 'تازه‌های فروشگاه', subtitle: 'محصولات جدیدی که به فروشگاه اضافه شده‌اند' }, settings: { limit: 8 } },
      { key: 'videos', type: 'videos', enabled: true, content: { title: 'جعبه جادویی', subtitle: 'ویدئوهای واقعی محصولات و مسیر سریع برای دیدن جزئیات' }, settings: { limit: 3 } },
      { key: 'support', type: 'support-banner', enabled: true, content: { eyebrow: 'برای انتخاب مطمئن‌تر', title: 'پشتیبانی فروشگاه کنار توست', description: 'برای سؤال درباره محصول، سفارش یا روند خرید از راه ارتباطی فعال فروشگاه استفاده کن.', ctaLabel: 'ارتباط با پشتیبانی' }, settings: {} },
      { key: 'trust', type: 'trust', enabled: true, content: {}, settings: {} },
      { key: 'footer', type: 'footer', enabled: true, content: { description: 'فروشگاه آنلاین محصولات مراقبتی و زیبایی با مسیر ساده از انتخاب تا پیگیری سفارش.' }, settings: {} },
    ];
  }

  function defaultTheme() {
    return {
      primaryColor: '#cf4772', accentColor: '#452b45', backgroundColor: '#fffdfc', textColor: '#211b1e',
      fontFamily: 'Tahoma', headingStyle: 'soft', buttonStyle: 'rounded', borderRadius: 24, cardRadius: 20,
      shadowStyle: 'soft', containerWidth: 1180, sectionSpacing: 52, globalPadding: 16,
    };
  }

  function templateFor(type) {
    const base = defaultSections().find((item) => item.type === type);
    const item = base ? clone(base) : { type, enabled: true, content: {}, settings: {} };
    item.key = nextKey(type);
    return item;
  }

  function normalizeDraft(data) {
    const hasPage = Boolean(data && data.page);
    const sections = hasPage && Array.isArray(data.sections) && data.sections.length
      ? data.sections.filter((section) => SUPPORTED_TYPES.includes(section.type)).map((section, index) => ({
          key: section.key || section.sectionKey || nextKey(section.type), type: section.type, enabled: section.enabled !== false,
          content: clone(section.content || {}), settings: clone(section.settings || {}), position: index,
        }))
      : defaultSections();
    return {
      page: {
        title: hasPage ? (data.page.title || 'صفحه اصلی فروشگاه') : 'صفحه اصلی فروشگاه',
        seoTitle: hasPage ? (data.page.seoTitle || '') : '',
        seoDescription: hasPage ? (data.page.seoDescription || '') : '',
      },
      theme: Object.assign(defaultTheme(), clone(data && data.theme || {})),
      sections,
      published: data && data.published ? data.published : null,
      versions: [],
      selectedKey: sections[0] ? sections[0].key : null,
      activeTab: 'block',
      device: 'desktop',
      dirty: !hasPage,
      connected: true,
      loading: false,
      lastError: null,
    };
  }

  function editorToast(text) {
    const old = document.querySelector('.store-editor__toast');
    if (old) old.remove();
    const node = document.createElement('div');
    node.className = 'store-editor__toast';
    node.textContent = text;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 2400);
  }

  function statusText() {
    if (!editorState) return 'در حال بارگذاری';
    if (!editorState.connected) return 'Backend در دسترس نیست';
    if (editorState.loading) return 'در حال ذخیره';
    if (editorState.lastError) return 'خطا';
    if (editorState.dirty) return 'تغییرات ذخیره‌نشده';
    return 'پیش‌نویس ذخیره شده';
  }

  function statusClass() {
    if (!editorState || !editorState.connected || editorState.lastError) return 'is-error';
    if (editorState.dirty) return 'is-dirty';
    return 'is-saved';
  }

  function selectedSection() {
    return editorState && editorState.sections.find((section) => section.key === editorState.selectedKey) || null;
  }

  function blockTitle(section) {
    const meta = TYPE_META[section.type] || { label: section.type };
    const custom = section.content && section.content.title;
    return custom || meta.label;
  }

  function markDirty() {
    if (!editorState) return;
    editorState.dirty = true;
    editorState.lastError = null;
    updateToolbarState();
  }

  function updateToolbarState() {
    if (!currentView || !editorState) return;
    const status = currentView.querySelector('#storeEditorStatus');
    if (status) { status.className = `store-editor__status ${statusClass()}`; status.textContent = statusText(); }
    const save = currentView.querySelector('#storeEditorSave');
    const publish = currentView.querySelector('#storeEditorPublish');
    if (save) save.disabled = editorState.loading || !editorState.connected;
    if (publish) publish.disabled = editorState.loading || !editorState.connected;
  }

  function formatVersionTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    try { return date.toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }); }
    catch (error) { return String(value); }
  }

  function renderEditorShell(view) {
    currentView = view;
    view.innerHTML = `
      <div class="store-editor">
        <div class="store-editor__topbar">
          <button type="button" class="back-btn" id="storeEditorBack" aria-label="بازگشت">${ic('chevR')}</button>
          <div class="store-editor__title">${ic('edit')}<div><strong>ویرایش سایت فروشگاهی</strong><span>Draft → Preview → Publish</span></div></div>
          <div class="store-editor__status ${statusClass()}" id="storeEditorStatus">${statusText()}</div>
          <div class="store-editor__actions">
            <button type="button" class="btn secondary" id="storeEditorSave">${ic('check')}ذخیره پیش‌نویس</button>
            <button type="button" class="btn secondary" id="storeEditorPreview">${ic('spark')}تازه‌سازی پیش‌نمایش</button>
            <button type="button" class="btn primary" id="storeEditorPublish">انتشار</button>
          </div>
        </div>
        <div class="store-editor__workspace">
          <aside class="store-editor__panel store-editor__sidebar">
            <div class="store-editor__panel-head"><div><strong>بخش‌های صفحه</strong><small>ترتیب و نمایش</small></div><span>${faDigits(editorState.sections.length)}</span></div>
            <div class="store-editor__panel-body"><div id="storeEditorBlocks"></div><button type="button" class="store-editor__add" id="storeEditorAdd">${ic('plus')} افزودن بخش</button></div>
          </aside>
          <section class="store-editor__panel store-editor__canvas">
            <div class="store-editor__viewport-toolbar"><div class="store-editor__device-tabs" id="storeEditorDevices"><button type="button" data-device="desktop">دسکتاپ</button><button type="button" data-device="tablet">تبلت</button><button type="button" data-device="mobile">موبایل</button></div><span class="store-editor__preview-note">روی هر بخش پیش‌نمایش کلیک کن تا تنظیماتش باز شود.</span></div>
            <div class="store-editor__iframe-stage"><div class="store-editor__iframe-wrap" id="storeEditorFrameWrap" data-device="${editorState.device}"><iframe id="storeEditorFrame" src="../storefront-preview.html" title="پیش‌نمایش فروشگاه"></iframe></div></div>
          </section>
          <aside class="store-editor__panel store-editor__properties">
            <div class="store-editor__panel-head"><div><strong>تنظیمات</strong><small id="storeEditorPropertyHint">بخش انتخاب‌شده</small></div></div>
            <div class="store-editor__panel-body"><div class="store-editor__prop-tabs" id="storeEditorTabs"><button type="button" data-tab="block">بخش</button><button type="button" data-tab="theme">هویت بصری</button><button type="button" data-tab="versions">نسخه‌ها</button></div><div id="storeEditorProperties"></div></div>
          </aside>
        </div>
      </div>`;
    bindShellEvents();
    renderBlockList();
    renderProperties();
    updateDeviceButtons();
    updateToolbarState();
  }

  function renderBlocked(view, error) {
    currentView = view;
    view.innerHTML = `<div class="store-editor__blocked"><div class="store-editor__blocked-card">${ic('wipe')}<h3>زیرساخت Storefront Editor هنوز روی Backend فعال نشده است</h3><p>پنل عمداً تغییرات را به‌صورت محلی یا جعلی ذخیره نمی‌کند. برای ادامه باید API و جداول Draft / Publish روی Backend واقعی فعال باشند.${error && error.message ? `<br><small>${esc(error.message)}</small>` : ''}</p><div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"><button type="button" class="btn secondary" id="storeEditorBackBlocked">بازگشت</button><button type="button" class="btn primary" id="storeEditorRetry">تلاش دوباره</button></div></div></div>`;
    view.querySelector('#storeEditorBackBlocked').addEventListener('click', () => { location.hash = '#/settings'; });
    view.querySelector('#storeEditorRetry').addEventListener('click', () => loadEditor(view));
  }

  function bindShellEvents() {
    currentView.querySelector('#storeEditorBack').addEventListener('click', () => { location.hash = '#/settings'; });
    currentView.querySelector('#storeEditorSave').addEventListener('click', () => saveDraft(false));
    currentView.querySelector('#storeEditorPreview').addEventListener('click', () => refreshPreview());
    currentView.querySelector('#storeEditorPublish').addEventListener('click', publishDraft);
    currentView.querySelector('#storeEditorAdd').addEventListener('click', openAddBlock);
    currentView.querySelectorAll('#storeEditorDevices [data-device]').forEach((button) => button.addEventListener('click', () => {
      editorState.device = button.dataset.device;
      updateDeviceButtons();
    }));
    currentView.querySelectorAll('#storeEditorTabs [data-tab]').forEach((button) => button.addEventListener('click', () => {
      editorState.activeTab = button.dataset.tab;
      renderProperties();
    }));
    const iframe = currentView.querySelector('#storeEditorFrame');
    iframe.addEventListener('load', () => sendSelectedToPreview());
    if (!messageBound) {
      window.addEventListener('message', handlePreviewMessage);
      messageBound = true;
    }
  }

  function updateDeviceButtons() {
    if (!currentView || !editorState) return;
    currentView.querySelectorAll('#storeEditorDevices [data-device]').forEach((button) => button.classList.toggle('active', button.dataset.device === editorState.device));
    const wrap = currentView.querySelector('#storeEditorFrameWrap');
    if (wrap) wrap.dataset.device = editorState.device;
  }

  function handlePreviewMessage(event) {
    if (event.origin !== window.location.origin || !event.data || event.data.type !== 'storefront-preview-select') return;
    if (!editorState || !editorState.sections.some((section) => section.key === event.data.key)) return;
    editorState.selectedKey = event.data.key;
    editorState.activeTab = 'block';
    renderBlockList();
    renderProperties();
  }

  function sendSelectedToPreview() {
    if (!currentView || !editorState || !editorState.selectedKey) return;
    const iframe = currentView.querySelector('#storeEditorFrame');
    if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: 'storefront-editor-select', key: editorState.selectedKey }, window.location.origin);
  }

  function renderBlockList() {
    if (!currentView || !editorState) return;
    const holder = currentView.querySelector('#storeEditorBlocks');
    holder.innerHTML = `<div class="store-editor__block-list">${editorState.sections.map((section) => {
      const meta = TYPE_META[section.type] || { label: section.type, icon: 'box' };
      return `<div class="store-editor__block ${section.key === editorState.selectedKey ? 'is-selected' : ''} ${section.enabled ? '' : 'is-disabled'}" draggable="true" data-block-key="${esc(section.key)}"><span class="store-editor__drag" title="برای جابه‌جایی بکشید">⋮⋮</span><div class="store-editor__block-copy"><strong>${esc(blockTitle(section))}</strong><span>${esc(meta.label)} · ${esc(section.key)}</span></div><div class="store-editor__block-actions"><button type="button" class="store-editor__icon-btn" data-move-up="${esc(section.key)}" aria-label="بالا">${ic('chevR')}</button><button type="button" class="store-editor__icon-btn" data-move-down="${esc(section.key)}" aria-label="پایین">${ic('chevL')}</button></div></div>`;
    }).join('')}</div>`;

    holder.querySelectorAll('[data-block-key]').forEach((row) => {
      row.addEventListener('click', (event) => {
        if (event.target.closest('[data-move-up],[data-move-down]')) return;
        editorState.selectedKey = row.dataset.blockKey;
        editorState.activeTab = 'block';
        renderBlockList(); renderProperties(); sendSelectedToPreview();
      });
      row.addEventListener('dragstart', (event) => { row.classList.add('is-dragging'); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', row.dataset.blockKey); });
      row.addEventListener('dragend', () => { row.classList.remove('is-dragging'); holder.querySelectorAll('.is-drag-over').forEach((node) => node.classList.remove('is-drag-over')); });
      row.addEventListener('dragover', (event) => { event.preventDefault(); row.classList.add('is-drag-over'); event.dataTransfer.dropEffect = 'move'; });
      row.addEventListener('dragleave', () => row.classList.remove('is-drag-over'));
      row.addEventListener('drop', (event) => {
        event.preventDefault(); row.classList.remove('is-drag-over');
        const from = event.dataTransfer.getData('text/plain'); const to = row.dataset.blockKey;
        if (from && to && from !== to) reorderByKey(from, to);
      });
    });
    holder.querySelectorAll('[data-move-up]').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); moveSection(button.dataset.moveUp, -1); }));
    holder.querySelectorAll('[data-move-down]').forEach((button) => button.addEventListener('click', (event) => { event.stopPropagation(); moveSection(button.dataset.moveDown, 1); }));
    const count = currentView.querySelector('.store-editor__sidebar .store-editor__panel-head>span');
    if (count) count.textContent = faDigits(editorState.sections.length);
  }

  function reorderByKey(fromKey, toKey) {
    const fromIndex = editorState.sections.findIndex((section) => section.key === fromKey);
    const toIndex = editorState.sections.findIndex((section) => section.key === toKey);
    if (fromIndex < 0 || toIndex < 0) return;
    const [section] = editorState.sections.splice(fromIndex, 1);
    editorState.sections.splice(toIndex, 0, section);
    markDirty(); renderBlockList();
  }

  function moveSection(key, delta) {
    const index = editorState.sections.findIndex((section) => section.key === key);
    const next = index + delta;
    if (index < 0 || next < 0 || next >= editorState.sections.length) return;
    const [section] = editorState.sections.splice(index, 1);
    editorState.sections.splice(next, 0, section);
    markDirty(); renderBlockList();
  }

  function openAddBlock() {
    const html = `<div class="modal__handle"></div><h3 class="modal__title">افزودن بخش به صفحه</h3><div class="store-editor__modal-grid">${SUPPORTED_TYPES.map((type) => {
      const meta = TYPE_META[type]; return `<button type="button" class="store-editor__type-btn" data-add-type="${type}">${ic(meta.icon)}<span>${esc(meta.label)}</span></button>`;
    }).join('')}</div>`;
    const wrap = openModal(html);
    wrap.querySelectorAll('[data-add-type]').forEach((button) => button.addEventListener('click', () => {
      const section = templateFor(button.dataset.addType);
      editorState.sections.push(section); editorState.selectedKey = section.key; editorState.activeTab = 'block';
      closeModal(); markDirty(); renderBlockList(); renderProperties(); sendSelectedToPreview();
    }));
  }

  function field(label, path, value, options) {
    const opts = options || {};
    const inputType = opts.type || 'text';
    if (inputType === 'textarea') return `<div class="store-editor__field"><label>${esc(label)}</label><textarea data-editor-path="${esc(path)}" ${opts.max ? `maxlength="${opts.max}"` : ''}>${esc(value || '')}</textarea></div>`;
    if (inputType === 'select') return `<div class="store-editor__field"><label>${esc(label)}</label><select data-editor-path="${esc(path)}">${opts.options.map((item) => `<option value="${esc(item[0])}" ${String(value) === String(item[0]) ? 'selected' : ''}>${esc(item[1])}</option>`).join('')}</select></div>`;
    return `<div class="store-editor__field"><label>${esc(label)}</label><input data-editor-path="${esc(path)}" type="${esc(inputType)}" value="${esc(value == null ? '' : value)}" ${opts.min != null ? `min="${opts.min}"` : ''} ${opts.max != null ? `max="${opts.max}"` : ''} ${opts.step != null ? `step="${opts.step}"` : ''}></div>`;
  }

  function blockFields(section) {
    const c = section.content || {}; const s = section.settings || {};
    if (section.type === 'search') return field('متن راهنمای جستجو', 'content.placeholder', c.placeholder || '', { max: 120 });
    if (section.type === 'hero') return field('برچسب بالای عنوان', 'content.eyebrow', c.eyebrow || '', { max: 80 }) + field('عنوان اصلی', 'content.title', c.title || '', { max: 180 }) + field('توضیح', 'content.description', c.description || '', { type: 'textarea', max: 500 }) + '<div class="store-editor__field-row">' + field('متن دکمه اصلی', 'content.primaryLabel', c.primaryLabel || '', { max: 80 }) + field('لینک دکمه اصلی', 'content.primaryUrl', c.primaryUrl || '', { max: 220 }) + '</div><div class="store-editor__field-row">' + field('متن دکمه دوم', 'content.secondaryLabel', c.secondaryLabel || '', { max: 80 }) + field('لینک دکمه دوم', 'content.secondaryUrl', c.secondaryUrl || '', { max: 220 }) + '</div>';
    if (section.type === 'categories') return field('عنوان', 'content.title', c.title || '', { max: 120 }) + field('زیرعنوان', 'content.subtitle', c.subtitle || '', { max: 220 }) + field('تعداد دسته‌ها', 'settings.limit', s.limit || 6, { type: 'number', min: 1, max: 12 });
    if (section.type === 'product-collection') return field('عنوان', 'content.title', c.title || '', { max: 120 }) + field('زیرعنوان', 'content.subtitle', c.subtitle || '', { max: 220 }) + field('تعداد محصول', 'settings.limit', s.limit || 8, { type: 'number', min: 1, max: 20 });
    if (section.type === 'videos') return field('عنوان', 'content.title', c.title || '', { max: 120 }) + field('زیرعنوان', 'content.subtitle', c.subtitle || '', { max: 220 }) + field('تعداد ویدئو', 'settings.limit', s.limit || 3, { type: 'number', min: 1, max: 8 });
    if (section.type === 'support-banner') return field('برچسب', 'content.eyebrow', c.eyebrow || '', { max: 100 }) + field('عنوان', 'content.title', c.title || '', { max: 160 }) + field('توضیح', 'content.description', c.description || '', { type: 'textarea', max: 500 }) + field('متن دکمه', 'content.ctaLabel', c.ctaLabel || '', { max: 80 });
    if (section.type === 'footer') return field('توضیح کوتاه فروشگاه', 'content.description', c.description || '', { type: 'textarea', max: 500 });
    return '<div class="store-editor__empty">این بخش در نسخه فعلی محتوای ثابت و کنترل‌شده دارد. می‌توانی آن را فعال/غیرفعال، جابه‌جا، تکثیر یا حذف کنی.</div>';
  }

  function renderProperties() {
    if (!currentView || !editorState) return;
    currentView.querySelectorAll('#storeEditorTabs [data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === editorState.activeTab));
    const holder = currentView.querySelector('#storeEditorProperties');
    const hint = currentView.querySelector('#storeEditorPropertyHint');
    if (editorState.activeTab === 'theme') { if (hint) hint.textContent = 'تنظیمات سراسری فروشگاه'; renderThemeProperties(holder); return; }
    if (editorState.activeTab === 'versions') { if (hint) hint.textContent = 'تاریخچه انتشار'; renderVersions(holder); return; }
    const section = selectedSection();
    if (!section) { holder.innerHTML = '<div class="store-editor__empty">یک بخش را از لیست یا پیش‌نمایش انتخاب کن.</div>'; return; }
    const meta = TYPE_META[section.type] || { label: section.type };
    if (hint) hint.textContent = meta.label;
    holder.innerHTML = `<div class="store-editor__toggle-row"><span>نمایش این بخش</span><input id="storeEditorEnabled" type="checkbox" ${section.enabled ? 'checked' : ''}></div>${blockFields(section)}<div class="store-editor__property-actions"><button type="button" class="btn secondary" id="storeEditorDuplicate">تکثیر</button><button type="button" class="btn danger" id="storeEditorDelete">${ic('trash')}حذف</button></div>`;
    holder.querySelector('#storeEditorEnabled').addEventListener('change', (event) => { section.enabled = event.target.checked; markDirty(); renderBlockList(); });
    holder.querySelectorAll('[data-editor-path]').forEach((input) => input.addEventListener('input', () => {
      setObjectPath(section, input.dataset.editorPath, input.type === 'number' ? Number(input.value) : input.value); markDirty(); renderBlockList();
    }));
    holder.querySelector('#storeEditorDuplicate').addEventListener('click', () => duplicateSection(section.key));
    holder.querySelector('#storeEditorDelete').addEventListener('click', () => deleteSection(section.key));
  }

  function setObjectPath(target, path, value) {
    const parts = path.split('.'); let cursor = target;
    while (parts.length > 1) { const key = parts.shift(); if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {}; cursor = cursor[key]; }
    cursor[parts[0]] = value;
  }

  function duplicateSection(key) {
    const index = editorState.sections.findIndex((section) => section.key === key); if (index < 0) return;
    const copy = clone(editorState.sections[index]); copy.key = nextKey(copy.type); editorState.sections.splice(index + 1, 0, copy); editorState.selectedKey = copy.key;
    markDirty(); renderBlockList(); renderProperties(); sendSelectedToPreview();
  }

  function deleteSection(key) {
    const index = editorState.sections.findIndex((section) => section.key === key); if (index < 0) return;
    if (!window.confirm('این بخش از پیش‌نویس حذف شود؟ تا قبل از انتشار روی سایت زنده اثری ندارد.')) return;
    editorState.sections.splice(index, 1); editorState.selectedKey = editorState.sections[index] ? editorState.sections[index].key : (editorState.sections[index - 1] ? editorState.sections[index - 1].key : null);
    markDirty(); renderBlockList(); renderProperties(); sendSelectedToPreview();
  }

  function renderThemeProperties(holder) {
    const t = editorState.theme; const p = editorState.page;
    holder.innerHTML = `<div class="store-editor__field"><label>عنوان صفحه در پنل</label><input data-page-field="title" value="${esc(p.title || '')}"></div><div class="store-editor__field"><label>SEO Title</label><input data-page-field="seoTitle" maxlength="180" value="${esc(p.seoTitle || '')}"></div><div class="store-editor__field"><label>SEO Description</label><textarea data-page-field="seoDescription" maxlength="500">${esc(p.seoDescription || '')}</textarea></div><div class="section-title">هویت بصری</div><div class="store-editor__theme-grid">${themeColor('رنگ اصلی','primaryColor',t.primaryColor)}${themeColor('رنگ Accent','accentColor',t.accentColor)}${themeColor('پس‌زمینه','backgroundColor',t.backgroundColor)}${themeColor('رنگ متن','textColor',t.textColor)}</div>` +
      field('فونت', 'theme.fontFamily', t.fontFamily, { type: 'select', options: [['Tahoma','Tahoma'],['system','System'],['Vazirmatn','Vazirmatn']] }) + field('استایل تیتر', 'theme.headingStyle', t.headingStyle, { type: 'select', options: [['soft','Soft'],['editorial','Editorial'],['compact','Compact']] }) + field('استایل دکمه', 'theme.buttonStyle', t.buttonStyle, { type: 'select', options: [['rounded','Rounded'],['pill','Pill'],['square','Square']] }) + field('سایه', 'theme.shadowStyle', t.shadowStyle, { type: 'select', options: [['soft','Soft'],['none','None'],['medium','Medium']] }) + '<div class="store-editor__field-row">' + field('Border Radius', 'theme.borderRadius', t.borderRadius, { type:'number',min:0,max:40 }) + field('Card Radius', 'theme.cardRadius', t.cardRadius, { type:'number',min:0,max:48 }) + '</div><div class="store-editor__field-row">' + field('عرض Container', 'theme.containerWidth', t.containerWidth, { type:'number',min:880,max:1600 }) + field('فاصله Sectionها', 'theme.sectionSpacing', t.sectionSpacing, { type:'number',min:12,max:120 }) + '</div>' + field('Padding سراسری', 'theme.globalPadding', t.globalPadding, { type:'number',min:8,max:64 });
    holder.querySelectorAll('[data-page-field]').forEach((input) => input.addEventListener('input', () => { editorState.page[input.dataset.pageField] = input.value; markDirty(); }));
    holder.querySelectorAll('[data-theme-key]').forEach((input) => input.addEventListener('input', () => { editorState.theme[input.dataset.themeKey] = input.value; markDirty(); }));
    holder.querySelectorAll('[data-editor-path^="theme."]').forEach((input) => input.addEventListener('input', () => { const key = input.dataset.editorPath.split('.')[1]; editorState.theme[key] = input.type === 'number' ? Number(input.value) : input.value; markDirty(); }));
  }

  function themeColor(label, key, value) {
    const safe = /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : '#ffffff';
    return `<div class="store-editor__field"><label>${esc(label)}</label><div class="store-editor__color"><input type="color" data-theme-key="${key}" value="${esc(safe)}"><input type="text" value="${esc(safe)}" readonly tabindex="-1"></div></div>`;
  }

  function renderVersions(holder) {
    if (!editorState.versions.length) { holder.innerHTML = '<div class="store-editor__empty">هنوز نسخه‌ای منتشر نشده است. بعد از اولین Publish تاریخچه اینجا نمایش داده می‌شود.</div>'; return; }
    holder.innerHTML = `<div class="store-editor__versions">${editorState.versions.map((version) => `<div class="store-editor__version"><div><strong>نسخه ${faDigits(version.version)}</strong><span>${esc(formatVersionTime(version.publishedAt))}</span>${version.isPublished ? '<span class="store-editor__published-badge">نسخه زنده</span>' : ''}</div>${version.isPublished ? '' : `<button type="button" class="btn secondary" data-restore-version="${version.id}">بازیابی</button>`}</div>`).join('')}</div>`;
    holder.querySelectorAll('[data-restore-version]').forEach((button) => button.addEventListener('click', () => restoreVersion(Number(button.dataset.restoreVersion))));
  }

  function payload() {
    return {
      title: String(editorState.page.title || 'صفحه اصلی فروشگاه').trim() || 'صفحه اصلی فروشگاه',
      seoTitle: String(editorState.page.seoTitle || '').trim() || null,
      seoDescription: String(editorState.page.seoDescription || '').trim() || null,
      theme: clone(editorState.theme),
      sections: editorState.sections.map((section) => ({ key: section.key, type: section.type, enabled: section.enabled !== false, content: clone(section.content || {}), settings: clone(section.settings || {}) })),
    };
  }

  async function saveDraft(reloadPreview) {
    if (!editorState || !editorState.connected || editorState.loading) return false;
    editorState.loading = true; editorState.lastError = null; updateToolbarState();
    try {
      const data = await sellerApiFetch(`/storefront/pages/${PAGE_SLUG}/draft`, { method: 'PUT', body: JSON.stringify(payload()) });
      editorState = Object.assign(editorState, normalizeDraft(data), { versions: editorState.versions, selectedKey: editorState.selectedKey, activeTab: editorState.activeTab, device: editorState.device, dirty: false, connected: true, loading: false });
      updateToolbarState(); renderBlockList(); renderProperties(); editorToast('پیش‌نویس ذخیره شد');
      if (reloadPreview) reloadPreviewFrame();
      await loadVersions();
      return true;
    } catch (error) {
      editorState.loading = false; editorState.lastError = error.message || 'خطا در ذخیره'; updateToolbarState(); editorToast(editorState.lastError); return false;
    }
  }

  async function refreshPreview() {
    const ok = editorState.dirty ? await saveDraft(false) : true;
    if (ok) { reloadPreviewFrame(); editorToast('پیش‌نمایش تازه شد'); }
  }

  function reloadPreviewFrame() {
    if (!currentView) return;
    const iframe = currentView.querySelector('#storeEditorFrame');
    if (iframe) iframe.src = '../storefront-preview.html?t=' + Date.now();
  }

  async function publishDraft() {
    if (!editorState || editorState.loading || !editorState.connected) return;
    if (!window.confirm('پیش‌نویس فعلی پس از ذخیره روی سایت زنده منتشر شود؟')) return;
    if (editorState.dirty) { const saved = await saveDraft(false); if (!saved) return; }
    editorState.loading = true; updateToolbarState();
    try {
      const result = await sellerApiFetch(`/storefront/pages/${PAGE_SLUG}/publish`, { method: 'POST', body: '{}' });
      editorState.loading = false; editorState.dirty = false; editorState.lastError = null; updateToolbarState();
      await loadVersions(); editorToast(`نسخه ${result && result.version ? faDigits(result.version.number) : ''} منتشر شد`);
    } catch (error) { editorState.loading = false; editorState.lastError = error.message || 'انتشار ناموفق بود'; updateToolbarState(); editorToast(editorState.lastError); }
  }

  async function loadVersions() {
    if (!editorState || !editorState.connected) return;
    try { editorState.versions = await sellerApiFetch(`/storefront/pages/${PAGE_SLUG}/versions`); }
    catch (error) { editorState.versions = []; }
    if (editorState.activeTab === 'versions') renderProperties();
  }

  async function restoreVersion(versionId) {
    if (!window.confirm('این نسخه به پیش‌نویس برگردانده شود؟ سایت زنده تغییر نمی‌کند تا دوباره Publish کنی.')) return;
    try {
      const data = await sellerApiFetch(`/storefront/pages/${PAGE_SLUG}/restore/${versionId}`, { method: 'POST', body: '{}' });
      const next = normalizeDraft(data); next.versions = editorState.versions; next.activeTab = 'versions'; next.device = editorState.device; next.dirty = false;
      editorState = next; renderBlockList(); renderProperties(); updateToolbarState(); reloadPreviewFrame(); editorToast('نسخه به پیش‌نویس بازیابی شد');
    } catch (error) { editorToast(error.message || 'بازیابی نسخه ناموفق بود'); }
  }

  async function loadEditor(view) {
    currentView = view;
    view.innerHTML = '<div class="empty-state" style="padding:60px 20px"><div class="empty-state__desc">در حال دریافت تنظیمات فروشگاه...</div></div>';
    try {
      const data = await sellerApiFetch(`/storefront/pages/${PAGE_SLUG}`);
      editorState = normalizeDraft(data); renderEditorShell(view); await loadVersions();
    } catch (error) {
      editorState = { connected: false, lastError: error.message || 'API Storefront Editor در دسترس نیست' };
      renderBlocked(view, error);
    }
  }

  const previousRenderSettings = renderSettings;
  renderSettings = function (view) {
    previousRenderSettings(view);
    if (view.querySelector('[data-storefront-editor-link]')) return;
    const group = document.createElement('div');
    group.className = 'settings-group';
    group.innerHTML = `<div class="settings-group__title">فروشگاه اینترنتی</div><a href="#/${ROUTE}" class="settings-row" data-storefront-editor-link style="text-decoration:none;color:inherit"><div class="settings-row__icon">${ic('edit')}</div><div class="settings-row__text"><div class="settings-row__title">ویرایش سایت فروشگاهی</div><div class="settings-row__desc">چیدمان بخش‌ها، محتوای صفحه، هویت بصری، پیش‌نمایش و انتشار</div></div><div class="settings-row__chev">${ic('chevL')}</div></a>`;
    view.appendChild(group);
  };

  const previousRouter = router;
  window.removeEventListener('hashchange', previousRouter);
  router = function () {
    const raw = location.hash.replace(/^#\/?/, '');
    const parts = raw.split('/').filter(Boolean);
    if (parts[0] === ROUTE) {
      renderNav('settings');
      const view = document.getElementById('view');
      view.scrollTop = 0;
      loadEditor(view);
      return;
    }
    previousRouter();
  };
  window.addEventListener('hashchange', router);
})();
