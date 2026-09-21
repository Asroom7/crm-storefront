/*
  قابلیت‌های تکمیلی پنل یکپارچه.
  app.js همچنان بیس اصلی «امور مشتریان» است؛ این فایل فقط بخش‌هایی را که برای
  فروشگاه مرکزی لازم است ارتقا می‌دهد تا دو پنل موازی نداشته باشیم.
*/

function panelProductSalePrice(product) {
  const list = Array.isArray(product && product.prices)
    ? product.prices.map((row) => Number(row.price)).filter((value) => Number.isFinite(value) && value > 0)
    : [];
  if (list.length) return Math.min(...list);
  return Number(product && product.costPrice || 0);
}

fmtProductPrice = function (product) {
  return fmtPrice(panelProductSalePrice(product));
};

function downloadPanelFile(filename, content, type) {
  const blob = new Blob([content], { type: type || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(value) {
  const text = String(value == null ? '' : value).replace(/"/g, '""');
  return `"${text}"`;
}

function exportUnifiedJson() {
  const payload = {
    schema: 'crm-unified-export-v1',
    exportedAt: new Date().toISOString(),
    customers: state.customers,
    products: state.products,
    sales: state.sales,
    payments: state.payments,
    orders: state.orders,
    conversations: state.conversations,
    categories: state.categories,
  };
  downloadPanelFile(`crm-backup-${todayISO()}.json`, JSON.stringify(payload, null, 2), 'application/json;charset=utf-8');
  toast('نسخه پشتیبان آماده شد');
}

function exportCustomersCsv() {
  const header = ['شناسه', 'نام', 'نام خانوادگی', 'شماره تماس', 'وضعیت', 'منبع', 'پیگیری بعدی', 'برچسب‌ها'];
  const rows = state.customers.map((customer) => [
    customer.id,
    customer.firstName,
    customer.lastName,
    customer.phone,
    customer.status,
    customer.source,
    customer.nextFollowUp,
    Array.isArray(customer.tags) ? customer.tags.join(' | ') : '',
  ]);
  const csv = '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  downloadPanelFile(`customers-${todayISO()}.csv`, csv, 'text/csv;charset=utf-8');
  toast('فایل مشتریان آماده شد');
}

function mediaLines(product, kind) {
  return (Array.isArray(product && product.media) ? product.media : [])
    .filter((media) => media.kind === kind)
    .map((media) => media.url)
    .filter(Boolean)
    .join('\n');
}

function validMediaLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      try {
        const parsed = new URL(line);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
      } catch (e) {
        return false;
      }
    });
}

openProductForm = function (id) {
  const rec = id ? byId(state.products, id) : null;
  const formData = rec ? { ...rec } : {
    name: '', description: '', costPrice: '', stockQty: 0, lowStockAt: 0,
    isPublished: true, categoryId: null, prices: [], media: [],
  };
  const currentSalePrice = panelProductSalePrice(formData);

  const categoryOptions = state.categories.map((category) =>
    `<option value="${category.id}" ${formData.categoryId === category.id ? 'selected' : ''}>${esc(category.name)}</option>`
  ).join('');

  const html = `
    <div class="modal__handle"></div>
    <h3 class="modal__title">${rec ? 'ویرایش محصول' : 'محصول جدید'}</h3>
    <form id="modernProductForm">
      <p id="modernProductError" style="color:var(--danger);display:none;font-size:12.5px;"></p>

      <div class="field"><label>نام محصول *</label><input name="name" required value="${esc(formData.name)}"></div>
      <div class="field"><label>دسته‌بندی</label>
        <select id="modernCategorySelect">
          <option value="">بدون دسته‌بندی</option>
          ${categoryOptions}
          <option value="__new__">+ دسته‌بندی جدید...</option>
        </select>
      </div>
      <div class="field" id="modernNewCategoryBox" style="display:none;">
        <label>نام دسته‌بندی جدید</label>
        <div style="display:flex;gap:8px;">
          <input id="modernNewCategoryInput" style="flex:1;" placeholder="مثلاً مراقبت پوست">
          <button type="button" class="btn secondary" id="modernAddCategoryBtn">افزودن</button>
        </div>
      </div>

      <div class="field"><label>قیمت فروش *</label><input name="salePrice" type="text" required value="${currentSalePrice || ''}" placeholder="مثلاً ۲۸۰,۰۰۰"></div>
      <div class="field"><label>قیمت خرید / تمام‌شده</label><input name="costPrice" type="text" value="${formData.costPrice || ''}" placeholder="فقط برای گزارش سود؛ به مشتری نمایش داده نمی‌شود"></div>
      <div class="field-row">
        <div class="field"><label>موجودی</label><input name="stockQty" inputmode="numeric" value="${faDigits(formData.stockQty ?? 0)}"></div>
        <div class="field"><label>حد هشدار کم‌موجودی</label><input name="lowStockAt" inputmode="numeric" value="${faDigits(formData.lowStockAt ?? 0)}"></div>
      </div>

      <div class="field"><label>توضیحات</label><textarea name="description">${esc(formData.description || '')}</textarea></div>
      <div class="field">
        <label>آدرس تصاویر محصول</label>
        <textarea name="imageUrls" placeholder="هر آدرس تصویر در یک خط">${esc(mediaLines(formData, 'image'))}</textarea>
        <div class="field__hint">فعلاً رسانه روی فضای ذخیره‌سازی خارجی نگهداری می‌شود؛ هر URL را در یک خط وارد کن.</div>
      </div>
      <div class="field">
        <label>آدرس ویدیوها (اختیاری)</label>
        <textarea name="videoUrls" placeholder="هر آدرس ویدیو در یک خط">${esc(mediaLines(formData, 'video'))}</textarea>
      </div>

      <label style="display:flex;align-items:center;gap:8px;margin:14px 0;">
        <input type="checkbox" id="modernProductPublished" style="width:auto;" ${formData.isPublished ? 'checked' : ''}>
        <span>در فروشگاه نمایش داده شود</span>
      </label>

      <div class="modal__actions">
        <button type="button" class="btn secondary block" data-close-modal>انصراف</button>
        <button type="submit" class="btn primary block">${ic('check')}ذخیره</button>
      </div>
      ${rec ? `<button type="button" class="btn danger block" id="modernProductDeleteBtn" style="margin-top:10px;">${ic('trash')}حذف محصول</button>` : ''}
    </form>`;

  const wrap = openModal(html);
  const form = wrap.querySelector('#modernProductForm');
  const saleInput = form.querySelector('input[name="salePrice"]');
  const costInput = form.querySelector('input[name="costPrice"]');
  wireMoneyInput(saleInput);
  wireMoneyInput(costInput);
  if (currentSalePrice) saleInput.value = formatThousandsStr(String(currentSalePrice));
  if (formData.costPrice) costInput.value = formatThousandsStr(String(formData.costPrice));

  const categorySelect = wrap.querySelector('#modernCategorySelect');
  const newCategoryBox = wrap.querySelector('#modernNewCategoryBox');
  categorySelect.addEventListener('change', () => {
    newCategoryBox.style.display = categorySelect.value === '__new__' ? '' : 'none';
  });
  wrap.querySelector('#modernAddCategoryBtn').addEventListener('click', async () => {
    const input = wrap.querySelector('#modernNewCategoryInput');
    const name = input.value.trim();
    if (!name) { toast('نام دسته‌بندی را وارد کن'); return; }
    try {
      const category = await sellerApiFetch('/categories', { method: 'POST', body: JSON.stringify({ name }) });
      state.categories.push(category);
      const option = document.createElement('option');
      option.value = category.id;
      option.textContent = category.name;
      categorySelect.insertBefore(option, categorySelect.lastElementChild);
      categorySelect.value = String(category.id);
      newCategoryBox.style.display = 'none';
      input.value = '';
      toast('دسته‌بندی اضافه شد');
    } catch (err) { toast(err.message); }
  });

  if (rec) {
    wrap.querySelector('#modernProductDeleteBtn').addEventListener('click', () => {
      confirmDialog('حذف محصول', `«${rec.name}» حذف خواهد شد. اگر سابقه سفارش داشته باشد، برای حفظ تاریخچه حذف نمی‌شود.`, async () => {
        try {
          await sellerApiFetch(`/products/${rec.id}`, { method: 'DELETE' });
          await loadAll();
          closeModal();
          toast('محصول حذف شد');
          router();
        } catch (err) { toast(err.message); }
      });
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const fd = new FormData(form);
    const name = fd.get('name').trim();
    const salePrice = getMoneyValue(saleInput);
    const costPrice = getMoneyValue(costInput);
    const stockQty = Math.max(0, Number(faToEnDigits(fd.get('stockQty'))) || 0);
    const lowStockAt = Math.max(0, Number(faToEnDigits(fd.get('lowStockAt'))) || 0);
    const categoryValue = categorySelect.value;
    const errorBox = wrap.querySelector('#modernProductError');

    if (!name) { errorBox.textContent = 'نام محصول را وارد کن'; errorBox.style.display = 'block'; return; }
    if (!salePrice || salePrice <= 0) { errorBox.textContent = 'قیمت فروش معتبر وارد کن'; errorBox.style.display = 'block'; return; }
    if (categoryValue === '__new__') { errorBox.textContent = 'ابتدا دسته‌بندی جدید را اضافه کن'; errorBox.style.display = 'block'; return; }

    const images = validMediaLines(fd.get('imageUrls'));
    const videos = validMediaLines(fd.get('videoUrls'));
    const payload = {
      name,
      description: fd.get('description').trim(),
      categoryId: categoryValue ? Number(categoryValue) : null,
      costPrice: costPrice || null,
      stockQty,
      lowStockAt,
      isPublished: wrap.querySelector('#modernProductPublished').checked,
      prices: [{ label: 'قیمت فروش', price: salePrice, stockQty }],
      media: [
        ...images.map((url) => ({ kind: 'image', url })),
        ...videos.map((url) => ({ kind: 'video', url })),
      ],
    };

    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      if (rec) await sellerApiFetch(`/products/${rec.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await sellerApiFetch('/products', { method: 'POST', body: JSON.stringify(payload) });
      await loadAll();
      closeModal();
      toast(rec ? 'محصول ویرایش شد' : 'محصول اضافه شد');
      router();
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
      submit.disabled = false;
    }
  });
};

renderSettings = function (view) {
  const session = getSellerSession();
  const seller = session ? session.seller : {};
  const theme = document.documentElement.getAttribute('data-theme') || 'light';
  view.innerHTML = `
    <div class="panel-note">
      این پنل نسخه‌ی اصلی و یکپارچه‌ی CRM است. مدیریت مشتری، گفتگو، فروش، واریزی، سفارش و محصول همگی از یک دیتابیس مرکزی استفاده می‌کنند.
    </div>
    <div class="settings-group">
      <div class="settings-group__title">حساب کاربری</div>
      <div class="settings-row">
        <div class="settings-row__icon">${ic('user')}</div>
        <div class="settings-row__text"><div class="settings-row__title">${esc(seller.name || '')}</div><div class="settings-row__desc">${esc(seller.brandName || '')}</div></div>
      </div>
    </div>
    <div class="settings-group">
      <div class="settings-group__title">ابزارها و گزارش‌ها</div>
      <a href="#/reports" class="settings-row" style="text-decoration:none;color:inherit;">
        <div class="settings-row__icon">${ic('spark')}</div><div class="settings-row__text"><div class="settings-row__title">گزارش‌ها</div></div><div class="settings-row__chev">${ic('chevL')}</div>
      </a>
      <button class="settings-row settings-action-btn" id="exportJsonBtn">
        <div class="settings-row__icon">${ic('box')}</div><div class="settings-row__text"><div class="settings-row__title">نسخه پشتیبان JSON</div><div class="settings-row__desc">خروجی کامل داده‌های قابل مشاهده در پنل</div></div>
      </button>
      <button class="settings-row settings-action-btn" id="exportCsvBtn">
        <div class="settings-row__icon">${ic('users')}</div><div class="settings-row__text"><div class="settings-row__title">خروجی مشتریان CSV</div><div class="settings-row__desc">مناسب Excel و آرشیو</div></div>
      </button>
      <button class="settings-row settings-action-btn" id="themeToggleBtn">
        <div class="settings-row__icon">${ic('spark')}</div><div class="settings-row__text"><div class="settings-row__title">حالت نمایش</div><div class="settings-row__desc">${theme === 'dark' ? 'تیره' : 'روشن'}</div></div>
      </button>
    </div>
    <div class="settings-group">
      <div class="settings-group__title">فروشگاه</div>
      <a href="../index.html" class="settings-row" style="text-decoration:none;color:inherit;">
        <div class="settings-row__icon">${ic('cart')}</div><div class="settings-row__text"><div class="settings-row__title">مشاهده سایت فروشگاهی</div></div><div class="settings-row__chev">${ic('chevL')}</div>
      </a>
    </div>
    <div class="settings-group">
      <button type="button" class="settings-row settings-action-btn" id="logoutBtn">
        <div class="settings-row__icon" style="background:var(--danger-tint);color:var(--danger);">${ic('logout')}</div><div class="settings-row__text"><div class="settings-row__title" style="color:var(--danger);">خروج از پنل</div></div>
      </button>
    </div>`;

  document.getElementById('exportJsonBtn').addEventListener('click', exportUnifiedJson);
  document.getElementById('exportCsvBtn').addEventListener('click', exportCustomersCsv);
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    const next = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark' ? 'light' : 'dark';
    localStorage.setItem('crm-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    renderSettings(view);
  });
  document.getElementById('logoutBtn').addEventListener('click', () => {
    logoutSeller();
    window.location.href = '../admin-login.html';
  });
};
