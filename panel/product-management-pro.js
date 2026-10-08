/* Product management Pro layer.
   Scope: panel products route + product form only. Does not mutate storefront/editor/dashboard surfaces. */
(function () {
  'use strict';

  const ROUTE = 'products';
  const MAX_MEDIA = 20;
  const IMAGE_MAX = 8 * 1024 * 1024;
  const VIDEO_MAX = 25 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']);
  const filters = { query: '', categoryId: '', status: 'all', sort: 'newest' };

  function routeName() {
    return location.hash.replace(/^#\/?/, '').split('/')[0] || 'dashboard';
  }

  function html(value) {
    if (typeof esc === 'function') return esc(value == null ? '' : value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  }

  function digits(value) {
    return typeof faDigits === 'function' ? faDigits(value) : String(value == null ? '' : value);
  }

  function money(value) {
    const number = Number(value || 0);
    if (!(number > 0)) return 'ثبت نشده';
    return digits(number.toLocaleString('en-US')) + ' تومان';
  }

  function icon(name) {
    try { return typeof ic === 'function' ? ic(name) : ''; } catch (error) { return ''; }
  }

  function productImage(product) {
    try {
      if (typeof getProductImageUrl === 'function') return getProductImageUrl(product) || '';
    } catch (error) {}
    const media = Array.isArray(product && product.media) ? product.media : [];
    const image = media.find((item) => item && item.kind === 'image' && item.url);
    return image ? String(image.url) : '';
  }

  function salePriceValue(product) {
    const prices = Array.isArray(product && product.prices) ? product.prices : [];
    const valid = prices.map((row) => Number(row && row.price)).filter((value) => Number.isFinite(value) && value > 0);
    return valid.length ? Math.min(...valid) : 0;
  }

  function stockState(product) {
    const stock = Number(product && product.stockQty || 0);
    const low = Number(product && product.lowStockAt || 0);
    if (stock <= 0) return { key: 'out', label: 'ناموجود', cls: 'is-out' };
    if (low > 0 && stock <= low) return { key: 'low', label: 'کم‌موجود', cls: 'is-low' };
    if (product && product.isPublished === false) return { key: 'draft', label: 'پیش‌نویس', cls: 'is-draft' };
    return { key: 'active', label: 'فعال', cls: 'is-active' };
  }

  function statusMatches(product) {
    if (filters.status === 'all') return true;
    if (filters.status === 'published') return product.isPublished !== false;
    if (filters.status === 'draft') return product.isPublished === false;
    const stock = Number(product.stockQty || 0);
    const low = Number(product.lowStockAt || 0);
    if (filters.status === 'out') return stock <= 0;
    if (filters.status === 'low') return stock > 0 && low > 0 && stock <= low;
    return true;
  }

  function summaryHTML(products) {
    const total = products.length;
    const published = products.filter((p) => p.isPublished !== false).length;
    const low = products.filter((p) => Number(p.stockQty || 0) > 0 && Number(p.lowStockAt || 0) > 0 && Number(p.stockQty || 0) <= Number(p.lowStockAt || 0)).length;
    const out = products.filter((p) => Number(p.stockQty || 0) <= 0).length;
    return `
      <div class="pp-summary" aria-label="خلاصه محصولات">
        <button type="button" class="pp-stat ${filters.status === 'all' ? 'active' : ''}" data-pp-status="all"><strong>${digits(total)}</strong><span>همه محصولات</span></button>
        <button type="button" class="pp-stat ${filters.status === 'published' ? 'active' : ''}" data-pp-status="published"><strong>${digits(published)}</strong><span>منتشرشده</span></button>
        <button type="button" class="pp-stat warn ${filters.status === 'low' ? 'active' : ''}" data-pp-status="low"><strong>${digits(low)}</strong><span>کم‌موجود</span></button>
        <button type="button" class="pp-stat danger ${filters.status === 'out' ? 'active' : ''}" data-pp-status="out"><strong>${digits(out)}</strong><span>ناموجود</span></button>
      </div>`;
  }

  function productCard(product) {
    const status = stockState(product);
    const image = productImage(product);
    const sale = salePriceValue(product);
    const mediaCount = Array.isArray(product.media) ? product.media.length : 0;
    const variants = Array.isArray(product.prices) ? product.prices.length : 0;
    return `
      <button type="button" class="pp-product-card" data-prod="${Number(product.id)}">
        <span class="pp-product-media">${image ? `<img src="${html(image)}" alt="" loading="lazy" decoding="async">` : `<span>${icon('box')}</span>`}</span>
        <span class="pp-product-copy">
          <span class="pp-product-head"><strong>${html(product.name)}</strong><span class="pp-badge ${status.cls}">${status.label}</span></span>
          <span class="pp-product-sub">${html(product.category && product.category.name ? product.category.name : 'بدون دسته‌بندی')} · ${typeof fmtId === 'function' ? fmtId('PR', product.id) : '#' + digits(product.id)}</span>
          <span class="pp-product-meta">
            <span>${icon('wallet')} ${sale ? money(sale) : 'قیمت فروش ثبت نشده'}</span>
            <span>${icon('box')} موجودی ${digits(Number(product.stockQty || 0))}</span>
            <span>${digits(mediaCount)} رسانه</span>
            <span>${digits(variants)} قیمت</span>
          </span>
        </span>
        <span class="pp-product-edit">ویرایش ${icon('chevL')}</span>
      </button>`;
  }

  function sortedProducts(list) {
    const rows = list.slice();
    if (filters.sort === 'price-asc') rows.sort((a, b) => salePriceValue(a) - salePriceValue(b));
    else if (filters.sort === 'price-desc') rows.sort((a, b) => salePriceValue(b) - salePriceValue(a));
    else if (filters.sort === 'stock-asc') rows.sort((a, b) => Number(a.stockQty || 0) - Number(b.stockQty || 0));
    else if (filters.sort === 'stock-desc') rows.sort((a, b) => Number(b.stockQty || 0) - Number(a.stockQty || 0));
    else rows.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    return rows;
  }

  function renderProductsPro(view) {
    if (!view || typeof state === 'undefined') return;
    const products = Array.isArray(state.products) ? state.products : [];
    const categories = Array.isArray(state.categories) ? state.categories : [];
    view.classList.add('product-pro-page');
    view.innerHTML = `
      <section class="pp-shell" aria-label="مدیریت محصولات">
        <div class="pp-page-head">
          <div><h1>محصولات</h1><p>قیمت، موجودی، رسانه و وضعیت انتشار را از یک‌جا مدیریت کن.</p></div>
          <button type="button" class="pp-primary" id="ppAddProduct">${icon('plus')} محصول جدید</button>
        </div>
        ${summaryHTML(products)}
        <div class="pp-controls">
          <label class="pp-search">${icon('search')}<input id="ppSearch" type="search" value="${html(filters.query)}" placeholder="جستجوی نام محصول یا دسته‌بندی" autocomplete="off"></label>
          <select id="ppStatus" aria-label="فیلتر وضعیت">
            <option value="all" ${filters.status === 'all' ? 'selected' : ''}>همه وضعیت‌ها</option>
            <option value="published" ${filters.status === 'published' ? 'selected' : ''}>منتشرشده</option>
            <option value="draft" ${filters.status === 'draft' ? 'selected' : ''}>پیش‌نویس</option>
            <option value="low" ${filters.status === 'low' ? 'selected' : ''}>کم‌موجود</option>
            <option value="out" ${filters.status === 'out' ? 'selected' : ''}>ناموجود</option>
          </select>
          <select id="ppSort" aria-label="مرتب‌سازی محصولات">
            <option value="newest" ${filters.sort === 'newest' ? 'selected' : ''}>جدیدترین</option>
            <option value="price-asc" ${filters.sort === 'price-asc' ? 'selected' : ''}>کمترین قیمت</option>
            <option value="price-desc" ${filters.sort === 'price-desc' ? 'selected' : ''}>بیشترین قیمت</option>
            <option value="stock-asc" ${filters.sort === 'stock-asc' ? 'selected' : ''}>کمترین موجودی</option>
            <option value="stock-desc" ${filters.sort === 'stock-desc' ? 'selected' : ''}>بیشترین موجودی</option>
          </select>
        </div>
        ${categories.length ? `<div class="pp-category-rail" id="ppCategories"><button type="button" class="${filters.categoryId ? '' : 'active'}" data-cat="">همه دسته‌ها</button>${categories.map((category) => `<button type="button" class="${Number(filters.categoryId) === Number(category.id) ? 'active' : ''}" data-cat="${Number(category.id)}">${html(category.name)}</button>`).join('')}</div>` : ''}
        <div class="pp-result-head"><strong id="ppResultCount"></strong><span>برای ویرایش روی هر محصول بزن.</span></div>
        <div class="pp-list" id="ppList"></div>
      </section>`;

    const input = view.querySelector('#ppSearch');
    const status = view.querySelector('#ppStatus');
    const sort = view.querySelector('#ppSort');
    const listEl = view.querySelector('#ppList');
    const countEl = view.querySelector('#ppResultCount');

    function paintList() {
      let list = products.slice();
      if (filters.categoryId) list = list.filter((product) => Number(product.categoryId || (product.category && product.category.id)) === Number(filters.categoryId));
      if (filters.query) {
        const q = filters.query.trim().toLocaleLowerCase('fa-IR');
        list = list.filter((product) => {
          const name = String(product.name || '').toLocaleLowerCase('fa-IR');
          const category = String(product.category && product.category.name || '').toLocaleLowerCase('fa-IR');
          return name.includes(q) || category.includes(q);
        });
      }
      list = list.filter(statusMatches);
      list = sortedProducts(list);
      countEl.textContent = digits(list.length) + ' محصول';
      listEl.innerHTML = list.length ? list.map(productCard).join('') : `<div class="pp-empty">${icon('box')}<strong>محصولی با این فیلتر پیدا نشد</strong><span>فیلترها را تغییر بده یا یک محصول جدید اضافه کن.</span></div>`;
      listEl.querySelectorAll('[data-prod]').forEach((row) => row.addEventListener('click', () => openProductFormPro(Number(row.dataset.prod))));
    }

    input.addEventListener('input', () => { filters.query = input.value; paintList(); });
    status.addEventListener('change', () => { filters.status = status.value; renderProductsPro(view); });
    sort.addEventListener('change', () => { filters.sort = sort.value; paintList(); });
    view.querySelectorAll('[data-pp-status]').forEach((button) => button.addEventListener('click', () => { filters.status = button.dataset.ppStatus; renderProductsPro(view); }));
    view.querySelectorAll('[data-cat]').forEach((button) => button.addEventListener('click', () => { filters.categoryId = button.dataset.cat ? Number(button.dataset.cat) : ''; renderProductsPro(view); }));
    view.querySelector('#ppAddProduct').addEventListener('click', () => openProductFormPro());
    paintList();
  }

  function numberValue(value) {
    const normalized = typeof faToEnDigits === 'function' ? faToEnDigits(value) : String(value || '');
    return Number(String(normalized).replace(/[^\d]/g, '')) || 0;
  }

  function categoryOptions(selectedId) {
    const categories = Array.isArray(state.categories) ? state.categories : [];
    return `<option value="">بدون دسته‌بندی</option>${categories.map((category) => `<option value="${Number(category.id)}" ${Number(selectedId) === Number(category.id) ? 'selected' : ''}>${html(category.name)}</option>`).join('')}<option value="__new__">+ دسته‌بندی جدید...</option>`;
  }

  function normalizePrices(product) {
    const rows = Array.isArray(product && product.prices) ? product.prices : [];
    if (rows.length) return rows.map((row) => ({ label: String(row.label || ''), price: Number(row.price || 0), stockQty: Number(row.stockQty || 0) }));
    return [{ label: '', price: '', stockQty: Number(product && product.stockQty || 0) }];
  }

  function normalizeMedia(product) {
    return (Array.isArray(product && product.media) ? product.media : []).filter((item) => item && ['image', 'video'].includes(item.kind) && item.url).map((item) => ({ kind: item.kind, url: String(item.url), isNew: false, publicId: '' }));
  }

  function priceRowsHTML(rows) {
    return rows.map((row, index) => `
      <div class="pp-price-row" data-price-index="${index}">
        <span class="pp-drag" title="جابجایی">⋮⋮</span>
        <label><span>عنوان</span><input data-price-label value="${html(row.label)}" maxlength="80" placeholder="مثلاً قیمت اصلی"></label>
        <label><span>قیمت فروش</span><input data-price-value inputmode="numeric" value="${row.price ? html(Number(row.price).toLocaleString('en-US')) : ''}" placeholder="۰"></label>
        <label><span>موجودی مدل</span><input data-price-stock inputmode="numeric" value="${digits(Number(row.stockQty || 0))}"></label>
        <button type="button" class="pp-icon danger" data-price-remove aria-label="حذف قیمت">×</button>
      </div>`).join('');
  }

  function mediaRowsHTML(rows) {
    return rows.map((row, index) => `
      <div class="pp-media-item" draggable="true" data-media-index="${index}">
        <span class="pp-media-visual">${row.kind === 'video' ? `<video src="${html(row.url)}" muted preload="metadata"></video><span class="pp-media-kind">ویدیو</span>` : `<img src="${html(row.url)}" alt="" loading="lazy"><span class="pp-media-kind">تصویر</span>`}</span>
        <span class="pp-media-copy"><strong>${index === 0 && row.kind === 'image' ? 'تصویر اصلی' : (row.kind === 'image' ? 'تصویر محصول' : 'ویدیوی محصول')}</strong><small>${index === 0 ? 'اولین رسانه در اولویت نمایش است' : 'برای تغییر ترتیب بکش و رها کن'}</small></span>
        <span class="pp-media-actions"><button type="button" class="pp-icon" data-media-up title="بالاتر">↑</button><button type="button" class="pp-icon" data-media-down title="پایین‌تر">↓</button><button type="button" class="pp-icon danger" data-media-remove title="حذف">×</button></span>
      </div>`).join('');
  }

  function openProductFormPro(id) {
    if (typeof state === 'undefined') return;
    const record = id ? state.products.find((product) => Number(product.id) === Number(id)) : null;
    const originalMedia = normalizeMedia(record);
    let media = originalMedia.map((item) => ({ ...item }));
    let prices = normalizePrices(record);
    let committed = false;
    let cleaning = false;

    const formData = record ? { ...record } : { name: '', description: '', costPrice: '', stockQty: 0, lowStockAt: 0, isPublished: false, categoryId: null };
    const modal = openModal(`
      <div class="modal__handle"></div>
      <div class="pp-modal-head">
        <div><h3>${record ? 'ویرایش محصول' : 'محصول جدید'}</h3><p>${record ? html(record.name) : 'اطلاعات محصول را مرحله‌به‌مرحله کامل کن.'}</p></div>
        ${record ? `<span class="pp-product-id">${typeof fmtId === 'function' ? fmtId('PR', record.id) : '#' + digits(record.id)}</span>` : ''}
      </div>
      <form id="ppProductForm" novalidate>
        <div class="pp-tabs" role="tablist">
          <button type="button" class="active" data-pp-tab="general">اطلاعات اصلی</button>
          <button type="button" data-pp-tab="pricing">قیمت‌ها</button>
          <button type="button" data-pp-tab="inventory">موجودی</button>
          <button type="button" data-pp-tab="media">رسانه <span id="ppMediaCount">${digits(media.length)}</span></button>
          <button type="button" data-pp-tab="publish">انتشار</button>
        </div>
        <div class="pp-form-error" id="ppFormError" hidden></div>

        <section class="pp-tab-panel active" data-pp-panel="general">
          <div class="pp-field"><label>نام محصول <b>*</b></label><input name="name" maxlength="180" required value="${html(formData.name || '')}" placeholder="نام کامل محصول"></div>
          <div class="pp-field"><label>دسته‌بندی</label><select id="ppCategory">${categoryOptions(formData.categoryId)}</select><div class="pp-new-category" id="ppNewCategory" hidden><input id="ppNewCategoryName" maxlength="100" placeholder="نام دسته‌بندی جدید"><button type="button" class="pp-secondary" id="ppAddCategory">افزودن</button></div></div>
          <div class="pp-field"><label>توضیحات محصول</label><textarea name="description" maxlength="10000" rows="6" placeholder="ویژگی‌ها، کاربرد و توضیحاتی که مشتری باید بداند">${html(formData.description || '')}</textarea><small>حداکثر ۱۰٬۰۰۰ کاراکتر</small></div>
        </section>

        <section class="pp-tab-panel" data-pp-panel="pricing">
          <div class="pp-help"><strong>قیمت‌های فروش</strong><span>فروشگاه از قیمت‌های ثبت‌شده برای نمایش و خرید استفاده می‌کند. اگر محصول چند مدل یا حجم دارد، برای هرکدام یک قیمت بساز.</span></div>
          <div class="pp-field"><label>قیمت پایه فعلی (تومان)</label><input name="costPrice" inputmode="numeric" value="${formData.costPrice ? html(Number(formData.costPrice).toLocaleString('en-US')) : ''}" placeholder="۰"><small>این مقدار فعلی محصول حفظ می‌شود و مستقل از لیست قیمت‌های فروش است.</small></div>
          <div class="pp-price-list" id="ppPriceList"></div>
          <button type="button" class="pp-secondary wide" id="ppAddPrice">+ افزودن قیمت / مدل</button>
        </section>

        <section class="pp-tab-panel" data-pp-panel="inventory">
          <div class="pp-inventory-grid">
            <div class="pp-field"><label>موجودی کل</label><input name="stockQty" inputmode="numeric" value="${digits(Number(formData.stockQty || 0))}"></div>
            <div class="pp-field"><label>هشدار کم‌موجودی</label><input name="lowStockAt" inputmode="numeric" value="${digits(Number(formData.lowStockAt || 0))}"></div>
          </div>
          <div class="pp-help"><strong>هشدار موجودی</strong><span>وقتی موجودی به حد هشدار برسد، محصول در پنل با وضعیت «کم‌موجود» مشخص می‌شود. موجودی صفر یعنی ناموجود.</span></div>
        </section>

        <section class="pp-tab-panel" data-pp-panel="media">
          <div class="pp-upload-box">
            <div>${icon('box')}<strong>تصویر یا ویدیو محصول</strong><span>JPG / PNG / WebP تا ۸MB · MP4 / WebM / MOV تا ۲۵MB · حداکثر ۲۰ رسانه</span></div>
            <label class="pp-primary small"><input id="ppMediaUpload" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" hidden>انتخاب فایل</label>
          </div>
          <div class="pp-upload-state" id="ppUploadState" hidden></div>
          <div class="pp-media-list" id="ppMediaList"></div>
        </section>

        <section class="pp-tab-panel" data-pp-panel="publish">
          <label class="pp-publish-card"><input id="ppPublished" type="checkbox" ${formData.isPublished ? 'checked' : ''}><span><strong>نمایش محصول در فروشگاه</strong><small>اگر خاموش باشد محصول به‌صورت پیش‌نویس در پنل می‌ماند و در فروشگاه نمایش داده نمی‌شود.</small></span></label>
          <div class="pp-publish-check" id="ppPublishCheck"></div>
        </section>

        <div class="pp-modal-actions">
          ${record ? `<button type="button" class="pp-danger-link" id="ppDeleteProduct">حذف محصول</button>` : '<span></span>'}
          <div><button type="button" class="pp-secondary" data-close-modal>انصراف</button><button type="submit" class="pp-primary" id="ppSaveProduct">${icon('check')} ذخیره محصول</button></div>
        </div>
      </form>`);

    modal.classList.add('product-pro-modal-wrap');
    const modalBox = modal.querySelector('.modal');
    if (modalBox) modalBox.classList.add('product-pro-modal');

    const form = modal.querySelector('#ppProductForm');
    const errorBox = modal.querySelector('#ppFormError');
    const category = modal.querySelector('#ppCategory');
    const newCategory = modal.querySelector('#ppNewCategory');
    const priceList = modal.querySelector('#ppPriceList');
    const mediaList = modal.querySelector('#ppMediaList');
    const mediaCount = modal.querySelector('#ppMediaCount');
    const publishCheck = modal.querySelector('#ppPublishCheck');

    function showError(message, tab) {
      errorBox.hidden = false;
      errorBox.textContent = message;
      if (tab) activateTab(tab);
      errorBox.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }

    function clearError() {
      errorBox.hidden = true;
      errorBox.textContent = '';
    }

    function activateTab(name) {
      modal.querySelectorAll('[data-pp-tab]').forEach((button) => button.classList.toggle('active', button.dataset.ppTab === name));
      modal.querySelectorAll('[data-pp-panel]').forEach((panel) => panel.classList.toggle('active', panel.dataset.ppPanel === name));
    }

    modal.querySelectorAll('[data-pp-tab]').forEach((button) => button.addEventListener('click', () => activateTab(button.dataset.ppTab)));

    category.addEventListener('change', () => { newCategory.hidden = category.value !== '__new__'; });
    modal.querySelector('#ppAddCategory').addEventListener('click', async () => {
      const input = modal.querySelector('#ppNewCategoryName');
      const name = input.value.trim();
      if (!name) { showError('نام دسته‌بندی جدید را وارد کن.', 'general'); return; }
      try {
        const created = await sellerApiFetch('/categories', { method: 'POST', body: JSON.stringify({ name }) });
        state.categories.push(created);
        const option = document.createElement('option');
        option.value = created.id;
        option.textContent = created.name;
        category.insertBefore(option, category.querySelector('option[value="__new__"]'));
        category.value = created.id;
        newCategory.hidden = true;
        input.value = '';
        if (typeof toast === 'function') toast('دسته‌بندی اضافه شد');
      } catch (error) { showError(error.message || 'افزودن دسته‌بندی ناموفق بود.', 'general'); }
    });

    function syncPricesFromDOM() {
      prices = Array.from(priceList.querySelectorAll('[data-price-index]')).map((row) => ({
        label: row.querySelector('[data-price-label]').value.trim(),
        price: numberValue(row.querySelector('[data-price-value]').value),
        stockQty: numberValue(row.querySelector('[data-price-stock]').value),
      }));
    }

    function paintPrices() {
      priceList.innerHTML = priceRowsHTML(prices);
      priceList.querySelectorAll('[data-price-remove]').forEach((button) => button.addEventListener('click', () => {
        syncPricesFromDOM();
        const index = Number(button.closest('[data-price-index]').dataset.priceIndex);
        prices.splice(index, 1);
        if (!prices.length) prices.push({ label: '', price: '', stockQty: 0 });
        paintPrices();
      }));
      priceList.querySelectorAll('[data-price-value]').forEach((input) => {
        if (typeof wireMoneyInput === 'function') wireMoneyInput(input);
      });
    }

    modal.querySelector('#ppAddPrice').addEventListener('click', () => {
      syncPricesFromDOM();
      if (prices.length >= 30) { showError('حداکثر ۳۰ قیمت/مدل برای هر محصول مجاز است.', 'pricing'); return; }
      prices.push({ label: '', price: '', stockQty: 0 });
      paintPrices();
      priceList.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    paintPrices();

    const costInput = form.elements.costPrice;
    if (typeof wireMoneyInput === 'function') wireMoneyInput(costInput);

    function paintMedia() {
      mediaCount.textContent = digits(media.length);
      mediaList.innerHTML = media.length ? mediaRowsHTML(media) : `<div class="pp-media-empty">هنوز رسانه‌ای برای این محصول ثبت نشده است.</div>`;
      mediaList.querySelectorAll('[data-media-remove]').forEach((button) => button.addEventListener('click', async () => {
        const item = button.closest('[data-media-index]');
        const index = Number(item.dataset.mediaIndex);
        const removed = media[index];
        media.splice(index, 1);
        paintMedia();
        if (removed && removed.isNew && removed.publicId) {
          try { await sellerApiFetch('/products/media/delete', { method: 'POST', body: JSON.stringify({ publicId: removed.publicId, kind: removed.kind }) }); } catch (error) {}
        }
      }));
      mediaList.querySelectorAll('[data-media-up]').forEach((button) => button.addEventListener('click', () => moveMedia(Number(button.closest('[data-media-index]').dataset.mediaIndex), -1)));
      mediaList.querySelectorAll('[data-media-down]').forEach((button) => button.addEventListener('click', () => moveMedia(Number(button.closest('[data-media-index]').dataset.mediaIndex), 1)));
      let dragging = -1;
      mediaList.querySelectorAll('[data-media-index]').forEach((item) => {
        item.addEventListener('dragstart', () => { dragging = Number(item.dataset.mediaIndex); item.classList.add('dragging'); });
        item.addEventListener('dragend', () => { dragging = -1; item.classList.remove('dragging'); });
        item.addEventListener('dragover', (event) => event.preventDefault());
        item.addEventListener('drop', (event) => {
          event.preventDefault();
          const target = Number(item.dataset.mediaIndex);
          if (dragging < 0 || dragging === target) return;
          const [moved] = media.splice(dragging, 1);
          media.splice(target, 0, moved);
          paintMedia();
        });
      });
      updatePublishCheck();
    }

    function moveMedia(index, delta) {
      const next = index + delta;
      if (next < 0 || next >= media.length) return;
      [media[index], media[next]] = [media[next], media[index]];
      paintMedia();
    }

    const upload = modal.querySelector('#ppMediaUpload');
    const uploadState = modal.querySelector('#ppUploadState');
    upload.addEventListener('change', async () => {
      const file = upload.files && upload.files[0];
      upload.value = '';
      if (!file) return;
      clearError();
      if (media.length >= MAX_MEDIA) { showError('حداکثر ۲۰ رسانه برای هر محصول مجاز است.', 'media'); return; }
      if (!ALLOWED_TYPES.has(file.type)) { showError('فرمت فایل پشتیبانی نمی‌شود. از JPG، PNG، WebP، MP4، WebM یا MOV استفاده کن.', 'media'); return; }
      const isVideo = file.type.startsWith('video/');
      if ((!isVideo && file.size > IMAGE_MAX) || (isVideo && file.size > VIDEO_MAX)) { showError(isVideo ? 'حجم ویدیو باید حداکثر ۲۵ مگابایت باشد.' : 'حجم تصویر باید حداکثر ۸ مگابایت باشد.', 'media'); return; }
      uploadState.hidden = false;
      uploadState.textContent = 'در حال آپلود «' + file.name + '»...';
      try {
        const body = new FormData();
        body.append('file', file);
        const asset = await sellerApiFetch('/products/media/upload', { method: 'POST', body });
        media.push({ kind: asset.kind, url: asset.url, publicId: asset.publicId || '', isNew: true });
        uploadState.textContent = 'آپلود انجام شد.';
        paintMedia();
        window.setTimeout(() => { uploadState.hidden = true; }, 1200);
      } catch (error) {
        uploadState.hidden = true;
        showError(error.message || 'آپلود فایل ناموفق بود.', 'media');
      }
    });

    function currentPriceRows() {
      syncPricesFromDOM();
      return prices.filter((row) => row.label || row.price).map((row) => ({ label: row.label, price: Number(row.price || 0), stockQty: Number(row.stockQty || 0) }));
    }

    function updatePublishCheck() {
      const published = modal.querySelector('#ppPublished').checked;
      const priceRows = currentPriceRows().filter((row) => row.label && row.price > 0);
      const notes = [];
      notes.push(media.some((item) => item.kind === 'image') ? '✓ تصویر محصول دارد' : '• هنوز تصویر محصول ثبت نشده');
      notes.push(priceRows.length ? '✓ قیمت فروش ثبت شده' : '• قیمت فروش ثبت نشده');
      notes.push(Number(numberValue(form.elements.stockQty.value)) > 0 ? '✓ موجودی دارد' : '• محصول ناموجود است');
      publishCheck.innerHTML = `<strong>${published ? 'آماده‌سازی برای انتشار' : 'محصول به‌صورت پیش‌نویس ذخیره می‌شود'}</strong>${notes.map((note) => `<span>${note}</span>`).join('')}`;
    }
    modal.querySelector('#ppPublished').addEventListener('change', updatePublishCheck);
    form.elements.stockQty.addEventListener('input', updatePublishCheck);
    priceList.addEventListener('input', updatePublishCheck);
    paintMedia();

    async function cleanupNewUploads() {
      if (committed || cleaning) return;
      cleaning = true;
      const pending = media.filter((item) => item.isNew && item.publicId);
      await Promise.allSettled(pending.map((item) => sellerApiFetch('/products/media/delete', { method: 'POST', body: JSON.stringify({ publicId: item.publicId, kind: item.kind }) })));
      cleaning = false;
    }

    modal.addEventListener('click', (event) => {
      if (event.target && event.target.hasAttribute('data-close-modal')) cleanupNewUploads();
    }, true);

    if (record) {
      modal.querySelector('#ppDeleteProduct').addEventListener('click', () => {
        confirmDialog('حذف محصول', `«${record.name}» حذف خواهد شد. اگر سابقه فروش داشته باشد، سرور برای حفظ سوابق اجازه حذف نمی‌دهد.`, async () => {
          try {
            await sellerApiFetch(`/products/${record.id}`, { method: 'DELETE' });
            committed = true;
            await loadAll();
            closeModal();
            if (typeof toast === 'function') toast('محصول حذف شد');
            renderProductsPro(document.getElementById('view'));
          } catch (error) { showError(error.message || 'حذف محصول ناموفق بود.'); }
        });
      });
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearError();
      syncPricesFromDOM();
      const name = form.elements.name.value.trim();
      const description = form.elements.description.value.trim();
      const costPrice = numberValue(costInput.value);
      const stockQty = numberValue(form.elements.stockQty.value);
      const lowStockAt = numberValue(form.elements.lowStockAt.value);
      const categoryValue = category.value;
      const isPublished = modal.querySelector('#ppPublished').checked;
      const priceRows = currentPriceRows();

      if (!name) { showError('نام محصول را وارد کن.', 'general'); return; }
      for (const row of priceRows) {
        if (!row.label) { showError('برای هر قیمت/مدل یک عنوان وارد کن.', 'pricing'); return; }
        if (!(row.price > 0)) { showError('قیمت فروش باید بیشتر از صفر باشد.', 'pricing'); return; }
      }
      if (isPublished && !priceRows.length) { showError('برای انتشار محصول حداقل یک قیمت فروش ثبت کن.', 'pricing'); return; }
      if (media.length > MAX_MEDIA) { showError('حداکثر ۲۰ رسانه برای هر محصول مجاز است.', 'media'); return; }

      const payload = {
        name,
        description,
        categoryId: categoryValue && categoryValue !== '__new__' ? Number(categoryValue) : null,
        costPrice: costPrice || null,
        stockQty,
        lowStockAt,
        isPublished,
        prices: priceRows,
        media: media.map((item) => ({ kind: item.kind, url: item.url })),
      };

      const saveButton = modal.querySelector('#ppSaveProduct');
      saveButton.disabled = true;
      saveButton.textContent = 'در حال ذخیره...';
      try {
        if (record) await sellerApiFetch(`/products/${record.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        else await sellerApiFetch('/products', { method: 'POST', body: JSON.stringify(payload) });
        committed = true;
        await loadAll();
        closeModal();
        if (typeof toast === 'function') toast(record ? 'محصول ویرایش شد' : 'محصول اضافه شد');
        renderProductsPro(document.getElementById('view'));
      } catch (error) {
        saveButton.disabled = false;
        saveButton.innerHTML = icon('check') + ' ذخیره محصول';
        showError(error.message || 'ذخیره محصول ناموفق بود.');
      }
    });
  }

  const legacyRenderProducts = typeof renderProducts === 'function' ? renderProducts : null;
  const legacyOpenProductForm = typeof openProductForm === 'function' ? openProductForm : null;
  window.__legacyRenderProducts = window.__legacyRenderProducts || legacyRenderProducts;
  window.__legacyOpenProductForm = window.__legacyOpenProductForm || legacyOpenProductForm;

  try { renderProducts = renderProductsPro; } catch (error) { window.renderProducts = renderProductsPro; }
  try { openProductForm = openProductFormPro; } catch (error) { window.openProductForm = openProductFormPro; }
  window.ProductManagementPro = { render: renderProductsPro, open: openProductFormPro };

  function enforce() {
    const view = document.getElementById('view');
    if (!view) return;
    if (routeName() !== ROUTE) { view.classList.remove('product-pro-page'); return; }
    if (!view.querySelector('.pp-shell')) renderProductsPro(view);
  }

  window.addEventListener('hashchange', () => window.setTimeout(enforce, 0));
  window.addEventListener('pageshow', enforce);
  window.setTimeout(enforce, 0);
}());
