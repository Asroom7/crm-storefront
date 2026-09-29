/* Seller-only draft preview. Uses exactly the public storefront renderer. */
(function () {
  'use strict';

  const root = document.getElementById('storefront-home-root');
  const status = document.getElementById('previewStatus');
  if (!root || !window.StorefrontHome) return;

  function showError(error) {
    const message = error && error.message ? error.message : 'پیش‌نمایش در دسترس نیست';
    root.innerHTML = '<div class="preview-error"><strong>پیش‌نمایش بارگذاری نشد</strong><span>' + escapeHtml(message) + '</span></div>';
    if (status) status.textContent = 'خطا';
  }

  function annotateSections(layout) {
    const visible = StorefrontHome.normalizeLayout(layout).filter(function (section) { return section.enabled !== false && StorefrontHome.registry[section.type]; });
    Array.from(root.children).forEach(function (node, index) {
      const section = visible[index];
      if (!section) return;
      node.dataset.previewSectionKey = section.key;
      node.dataset.previewSectionType = section.type;
      node.setAttribute('title', 'برای ویرایش این بخش کلیک کنید');
    });
  }

  function selectSection(key) {
    root.querySelectorAll('[data-preview-section-key]').forEach(function (node) {
      node.classList.toggle('is-preview-selected', node.dataset.previewSectionKey === key);
    });
  }

  root.addEventListener('click', function (event) {
    const section = event.target.closest('[data-preview-section-key]');
    if (!section) return;
    event.preventDefault();
    event.stopPropagation();
    selectSection(section.dataset.previewSectionKey);
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'storefront-preview-select', key: section.dataset.previewSectionKey }, window.location.origin);
    }
  }, true);

  root.addEventListener('submit', function (event) { event.preventDefault(); }, true);

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin || !event.data) return;
    if (event.data.type === 'storefront-editor-select') selectSection(String(event.data.key || ''));
    if (event.data.type === 'storefront-editor-reload') loadPreview();
  });

  async function loadPreview() {
    if (status) status.textContent = 'در حال بارگذاری';
    try {
      const results = await Promise.all([
        StorefrontHome.loadContext(),
        sellerApiFetch('/storefront/preview/home'),
      ]);
      const context = results[0];
      const draft = results[1] || {};
      const layout = draft.page && Array.isArray(draft.sections) && draft.sections.length
        ? draft.sections
        : StorefrontHome.cloneDefaultLayout();
      StorefrontHome.applyTheme(draft.theme || {});
      StorefrontHome.renderLayout(layout, context);
      if (context.store) applyStoreBrand(context.store);
      annotateSections(layout);
      if (status) status.textContent = draft.page ? 'پیش‌نویس ذخیره‌شده' : 'چیدمان پیش‌فرض';
      window.__storefrontPreviewLayout = layout;
    } catch (error) {
      showError(error);
    }
  }

  window.StorefrontPreview = { reload: loadPreview, select: selectSection };
  loadPreview();
})();
