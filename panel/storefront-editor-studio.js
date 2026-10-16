/* Content tools use the workbench's draft history, recovery and explicit publication. */
(function () {
  'use strict';
  const C = window.StorefrontContentCore;
  if (!C) return;
  let K;
  const uid = (prefix) =>
    prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  const esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const q = (s, b) => (b || K.E.root).querySelector(s),
    all = (s, b) => Array.from((b || K.E.root).querySelectorAll(s));
  const b = (name, text, primary = false, extra = '') =>
    '<button type="button" class="sfe-button' +
    (primary ? ' sfe-primary' : '') +
    '" data-studio="' +
    name +
    '" ' +
    extra +
    '>' +
    text +
    '</button>';
  const input = (label, key, value = '', type = 'text', extra = '') =>
    '<label class="sfe-field"><span>' +
    label +
    '</span><input data-studio-field="' +
    key +
    '" type="' +
    type +
    '" value="' +
    esc(value ?? '') +
    '" ' +
    extra +
    '></label>';
  const textarea = (label, key, value = '') =>
    '<label class="sfe-field"><span>' +
    label +
    '</span><textarea data-studio-field="' +
    key +
    '" rows="4" maxlength="4000">' +
    esc(value) +
    '</textarea></label>';
  const select = (label, key, value, options) =>
    '<label class="sfe-field"><span>' +
    label +
    '</span><select data-studio-field="' +
    key +
    '">' +
    options
      .map(
        ([v, t]) =>
          '<option value="' +
          esc(v) +
          '" ' +
          (String(v) === String(value) ? 'selected' : '') +
          '>' +
          esc(t) +
          '</option>',
      )
      .join('') +
    '</select></label>';
  const help = (t) => '<p class="sfe-help">' + t + '</p>';
  const note = (t) => '<p class="sfe-studio-note" role="status">' + t + '</p>';
  function bind(name, fn) {
    all('[data-studio="' + name + '"]').forEach(
      (el) =>
        (el.onclick = (e) => {
          e.stopPropagation();
          Promise.resolve(fn(el, e)).catch((error) => K.tell(error.message || 'عملیات انجام نشد'));
        }),
    );
  }
  function values(target) {
    all('[data-studio-field]').forEach(
      (el) =>
        (el.oninput = () => {
          target[el.dataset.studioField] =
            el.type === 'checkbox'
              ? el.checked
              : el.type === 'number'
                ? el.value === ''
                  ? null
                  : Number(el.value)
                : el.type === 'datetime-local'
                  ? el.value
                    ? new Date(el.value).toISOString()
                    : null
                  : el.value;
        }),
    );
  }
  function date(v) {
    return v
      ? new Date(Date.parse(v) - new Date(v).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : '';
  }
  function check(label, key, value) {
    return (
      '<label class="sfe-check"><input type="checkbox" data-studio-field="' +
      key +
      '" ' +
      (value ? 'checked' : '') +
      '>' +
      label +
      '</label>'
    );
  }
  function error(message) {
    const el = q('[data-studio-error]');
    if (el) {
      el.textContent = message;
      el.hidden = false;
    } else K.tell(message);
  }
  const errorBox = '<p class="sfe-studio-error" data-studio-error role="alert" hidden></p>';
  function pick({
    title,
    records,
    selected = [],
    apply,
    footer = '',
    allowEmpty = true,
    cancel = null,
    single = false,
  }) {
    selected = selected.slice();
    K.dialog(
      title,
      help(footer) +
        '<label class="sfe-field"><span>جستجو</span><input type="search" data-studio-query></label><div data-studio-picked></div><div data-studio-list></div>' +
        errorBox,
      b('pick-cancel', 'انصراف') + b('pick-apply', 'اعمال انتخاب', true),
    );
    const move = (from, to) => {
      if (to < 0 || to >= selected.length) return;
      selected.splice(to, 0, selected.splice(from, 1)[0]);
      draw();
    };
    function draw() {
      const query = q('[data-studio-query]').value.trim();
      q('[data-studio-picked]').innerHTML =
        '<div class="sfe-label-row"><strong>اولویت نمایش</strong><span>' +
        selected.length.toLocaleString('fa-IR') +
        ' مورد</span></div>' +
        selected
          .map((id, i) => {
            const r = records.find((r) => String(r.id) === String(id));
            return (
              '<div class="sfe-selected-row" draggable="true" data-studio-drag="' +
              i +
              '"><span>' +
              esc(r?.name || 'مورد در دسترس نیست') +
              '</span><label class="sfe-priority"><span class="sfe-sr-only">اولویت</span><input type="number" min="1" max="' +
              selected.length +
              '" data-studio-priority="' +
              i +
              '" value="' +
              (i + 1) +
              '"></label>' +
              b('pick-up', '↑', false, 'data-index="' + i + '" aria-label="بالاتر"') +
              b('pick-down', '↓', false, 'data-index="' + i + '" aria-label="پایین‌تر"') +
              b('pick-remove', '×', false, 'data-index="' + i + '" aria-label="حذف از انتخاب"') +
              '</div>'
            );
          })
          .join('');
      const rows = records.filter((r) => K.matches(r.name + ' ' + (r.hint || ''), query));
      q('[data-studio-list]').innerHTML =
        rows
          .map(
            (r) =>
              '<label class="sfe-product-option">' +
              (r.image ? '<img src="' + esc(r.image) + '" alt="">' : '') +
              '<span><strong>' +
              esc(r.name) +
              '</strong><small>' +
              esc(r.hint || '') +
              '</small></span><input type="checkbox" data-studio-pick="' +
              esc(r.id) +
              '" ' +
              (selected.some((id) => String(id) === String(r.id)) ? 'checked' : '') +
              ' ' +
              (r.disabled ? 'disabled' : '') +
              '></label>',
          )
          .join('') || help('موردی پیدا نشد.');
      all('[data-studio-pick]').forEach(
        (el) =>
          (el.onchange = () => {
            const r = records.find((r) => String(r.id) === el.dataset.studioPick);
            selected = selected.filter((id) => String(id) !== el.dataset.studioPick);
            if (el.checked) selected = single ? [r.id] : selected.concat(r.id);
            draw();
          }),
      );
      bind('pick-up', (el) => move(Number(el.dataset.index), Number(el.dataset.index) - 1));
      bind('pick-down', (el) => move(Number(el.dataset.index), Number(el.dataset.index) + 1));
      bind('pick-remove', (el) => {
        selected.splice(Number(el.dataset.index), 1);
        draw();
      });
      all('[data-studio-priority]').forEach(
        (el) => (el.onchange = () => move(Number(el.dataset.studioPriority), Number(el.value) - 1)),
      );
      let drag = null;
      all('[data-studio-drag]').forEach((el) => {
        el.ondragstart = () => (drag = Number(el.dataset.studioDrag));
        el.ondragover = (e) => e.preventDefault();
        el.ondrop = (e) => {
          e.preventDefault();
          if (drag !== null) move(drag, Number(el.dataset.studioDrag));
          drag = null;
        };
      });
    }
    q('[data-studio-query]').oninput = draw;
    bind('pick-cancel', () => (cancel ? cancel() : K.close()));
    bind('pick-apply', async (el) => {
      if (el.disabled) return;
      if (!allowEmpty && !selected.length) return error('حداقل یک مورد انتخاب کنید');
      el.disabled = true;
      try {
        await apply(selected.slice());
      } catch (e) {
        error(e.message);
      } finally {
        if (el.isConnected) el.disabled = false;
      }
    });
    draw();
  }
  const productRecords = () =>
    K.E.products.map((p) => ({
      id: p.id,
      name: p.name,
      image: K.image(p),
      hint:
        (p.category?.name || 'بدون دسته') +
        ' · موجودی ' +
        (p.stockQty || 0) +
        (p.isPublished === false ? ' · منتشرنشده' : ''),
    }));
  function library() {
    const lib = K.E.theme.educationLibraryV1 || { enabled: false, items: [] };
    K.dialog(
      'ویدیوهای آموزشی',
      note('این کتابخانه مستقل از ویدیوهای محصولات است. تغییرات آن همراه پیش‌نویس فروشگاه منتشر می‌شوند.') +
        check('استفاده از کتابخانه در صفحهٔ آموزش‌ها', 'enabled', lib.enabled) +
        b('lesson-new', 'آموزش جدید', true) +
        '<label class="sfe-field"><span>جستجوی عنوان یا موضوع</span><input type="search" data-lesson-query></label><div data-lesson-list></div>',
    );
    q('[data-studio-field="enabled"]').onchange = (e) =>
      K.mutate(() => {
        K.E.theme.educationLibraryV1 = { ...lib, ...K.E.theme.educationLibraryV1, enabled: e.target.checked };
      });
    function draw() {
      const query = q('[data-lesson-query]').value;
      const items = C.list(K.E.theme.educationLibraryV1?.items);
      q('[data-lesson-list]').innerHTML =
        items
          .map((r, i) => ({ r, i }))
          .filter(({ r }) => K.matches(r.title + ' ' + r.topic, query))
          .map(
            ({ r, i }) =>
              '<article class="sfe-studio-card">' +
              (r.poster
                ? '<img src="' + esc(r.poster) + '" alt="">'
                : '<span class="sfe-studio-placeholder">▶</span>') +
              '<div><strong>' +
              esc(r.title) +
              '</strong><small>' +
              esc(r.topic || 'بدون موضوع') +
              ' · ' +
              ({
                draft: 'پیش‌نویس',
                published: r.publishAt && Date.parse(r.publishAt) > Date.now() ? 'زمان‌بندی‌شده' : 'منتشرشده',
                archived: 'بایگانی',
              }[r.status] || '') +
              '</small><div>' +
              b('lesson-edit', 'ویرایش', false, 'data-id="' + r.id + '"') +
              b('lesson-up', '↑', false, 'data-index="' + i + '" aria-label="بالاتر"') +
              b('lesson-down', '↓', false, 'data-index="' + i + '" aria-label="پایین‌تر"') +
              b('lesson-delete', 'حذف', false, 'data-id="' + r.id + '"') +
              '</div></div></article>',
          )
          .join('') || help('برای شروع یک آموزش اضافه کن.');
      bind('lesson-edit', (el) => lessonEditor(items.find((r) => r.id === el.dataset.id)));
      const move = (i, to) => {
        if (to < 0 || to >= items.length) return;
        K.mutate(() => {
          const rows = K.E.theme.educationLibraryV1.items;
          rows.splice(to, 0, rows.splice(i, 1)[0]);
        });
        draw();
      };
      bind('lesson-up', (el) => move(Number(el.dataset.index), Number(el.dataset.index) - 1));
      bind('lesson-down', (el) => move(Number(el.dataset.index), Number(el.dataset.index) + 1));
      bind('lesson-delete', (el) => {
        const id = el.dataset.id;
        const used = K.E.config.sections.filter((s) => C.list(s.settings?.lessonIds).includes(id));
        K.dialog(
          'حذف آموزش',
          help(
            'آموزش از کتابخانهٔ پیش‌نویس و ' +
              used.length +
              ' انتخاب صفحه حذف می‌شود؛ فایل فیلم در رسانه‌ها می‌ماند.',
          ),
          b('lesson-back', 'انصراف') + b('lesson-confirm-delete', 'حذف از پیش‌نویس', true),
        );
        bind('lesson-back', library);
        bind('lesson-confirm-delete', () => {
          K.mutate(() => {
            K.E.theme.educationLibraryV1.items = items.filter((r) => r.id !== id);
            used.forEach((s) => (s.settings.lessonIds = s.settings.lessonIds.filter((v) => v !== id)));
          });
          library();
        });
      });
    }
    q('[data-lesson-query]').oninput = draw;
    bind('lesson-new', () => lessonEditor());
    draw();
  }
  function lessonEditor(source, temp) {
    const lesson =
      temp ||
      JSON.parse(
        JSON.stringify(
          source || {
            id: uid('lesson'),
            title: '',
            description: '',
            topic: '',
            url: '',
            poster: '',
            status: 'draft',
            productIds: [],
            createdAt: new Date().toISOString(),
          },
        ),
      );
    function draw() {
      K.dialog(
        source ? 'ویرایش آموزش' : 'آموزش جدید',
        errorBox +
          input('عنوان آموزش', 'title', lesson.title, 'text', 'maxlength="180" required') +
          textarea('توضیح آموزش', 'description', lesson.description) +
          input('موضوع / دستهٔ آموزشی', 'topic', lesson.topic, 'text', 'maxlength="100"') +
          '<div class="sfe-studio-media">' +
          (lesson.poster ? '<img src="' + esc(lesson.poster) + '" alt="کاور">' : '') +
          '<strong>' +
          (lesson.url ? 'فیلم انتخاب شده' : 'فیلم انتخاب نشده') +
          '</strong>' +
          b('lesson-video', 'انتخاب یا آپلود فیلم') +
          b('lesson-poster', 'انتخاب کاور') +
          '</div>' +
          select('وضعیت', 'status', lesson.status, [
            ['draft', 'پیش‌نویس'],
            ['published', 'قابل انتشار'],
            ['archived', 'بایگانی'],
          ]) +
          input('انتشار از زمان مشخص (اختیاری)', 'publishAt', date(lesson.publishAt), 'datetime-local') +
          help('ترتیب این کتابخانه مربوط به صفحهٔ آموزش‌هاست؛ ترتیب جعبهٔ جادویی جدا تنظیم می‌شود.') +
          b('lesson-products', 'محصولات مرتبط (' + C.ids(lesson.productIds).length + ')'),
        b('lesson-back', 'بازگشت') + b('lesson-save', 'ذخیره در پیش‌نویس', true),
      );
      values(lesson);
      bind('lesson-back', library);
      bind('lesson-video', () =>
        K.media(
          'video',
          (a) => {
            lesson.url = a.url;
            draw();
          },
          draw,
        ),
      );
      bind('lesson-poster', () =>
        K.media(
          'image',
          (a) => {
            lesson.poster = a.url;
            draw();
          },
          draw,
        ),
      );
      bind('lesson-products', () =>
        pick({
          title: 'محصولات مرتبط با آموزش',
          cancel: draw,
          records: productRecords(),
          selected: lesson.productIds,
          apply: (ids) => {
            lesson.productIds = ids;
            draw();
          },
        }),
      );
      bind('lesson-save', () => {
        if (!q('[data-studio-field="title"]').reportValidity()) return;
        const next = {
          ...K.E.theme.educationLibraryV1,
          enabled: K.E.theme.educationLibraryV1?.enabled ?? true,
          items: [lesson],
        };
        const errors = C.validateContent({ sections: [] }, { educationLibraryV1: next });
        if (errors.length) return error(errors.join(' · '));
        K.mutate(() => {
          const lib = K.E.theme.educationLibraryV1 || { enabled: true, items: [] };
          const items = C.list(lib.items);
          K.E.theme.educationLibraryV1 = {
            ...lib,
            items: source ? items.map((r) => (r.id === source.id ? lesson : r)) : items.concat(lesson),
          };
        });
        library();
      });
    }
    draw();
  }
  function chooseLessons() {
    const s = K.active();
    if (!s) return;
    const id = s.id;
    const rows = C.lessons(K.E.theme, Date.now(), true);
    pick({
      title: 'انتخاب و اولویت آموزش‌های جعبهٔ جادویی',
      records: rows.map((r) => ({
        id: r.id,
        name: r.title,
        image: r.poster,
        hint: (r.topic || '') + ' · ' + (r.status === 'published' ? 'قابل انتشار' : 'پیش‌نویس / بایگانی'),
        disabled: r.status !== 'published',
      })),
      selected: s.settings?.lessonIds || [],
      footer: 'آموزش‌های قابل انتشار را انتخاب کن. آموزش زمان‌بندی‌شده از زمان تعیین‌شده ظاهر می‌شود.',
      apply: (ids) => {
        K.mutate(() => {
          const row = K.E.config.sections.find((s) => s.id === id);
          K.M.setPath(row, 'settings.lessonIds', ids);
          K.M.setPath(row, 'settings.editorOptionsV1.videoSource', 'education');
        });
        K.close();
      },
    });
  }
  function categories() {
    K.dialog(
      'مدیریت دسته‌بندی‌ها',
      note(
        'نام، عکس و محصولات دسته، اطلاعات مشترک فروشگاه هستند. دکمهٔ ذخیرهٔ این پنجره آن‌ها را در کل فروشگاه تغییر می‌دهد.',
      ) +
        b('category-new', 'دستهٔ جدید', true) +
        '<div data-category-list></div>',
    );
    q('[data-category-list]').innerHTML = K.E.categories
      .map(
        (c) =>
          '<article class="sfe-studio-card">' +
          (c.imageUrl
            ? '<img src="' + esc(c.imageUrl) + '" alt="">'
            : '<span class="sfe-studio-placeholder">▦</span>') +
          '<div><strong>' +
          esc(c.name) +
          '</strong><small>' +
          K.E.products
            .filter((p) => Number(p.categoryId || p.category?.id) === Number(c.id))
            .length.toLocaleString('fa-IR') +
          ' محصول</small><div>' +
          b('category-edit', 'نام و عکس', false, 'data-id="' + c.id + '"') +
          b('category-products', 'محصولات دسته', false, 'data-id="' + c.id + '"') +
          b('category-delete', 'حذف دسته', false, 'data-id="' + c.id + '"') +
          '</div></div></article>',
      )
      .join('');
    bind('category-new', () => categoryEditor());
    bind('category-edit', (el) =>
      categoryEditor(K.E.categories.find((c) => Number(c.id) === Number(el.dataset.id))),
    );
    bind('category-products', async (el) => {
      const id = Number(el.dataset.id);
      K.E.products = await sellerApiFetch('/products');
      const selected = K.E.products
        .filter((p) => Number(p.categoryId || p.category?.id) === id)
        .map((p) => p.id);
      pick({
        title: 'محصولات دستهٔ ' + K.E.categories.find((c) => c.id === id)?.name,
        records: productRecords(),
        selected,
        footer:
          'ذخیره، عضویت محصولات را در کل فروشگاه تغییر می‌دهد. محصول انتخابی از دستهٔ قبلی منتقل می‌شود و موارد برداشته‌شده بدون دسته می‌شوند.',
        apply: async (ids) => {
          await sellerApiFetch('/categories/' + id + '/products', {
            method: 'PUT',
            body: JSON.stringify({ productIds: ids, expectedProductIds: selected }),
          });
          await refreshCatalog();
          categories();
        },
      });
    });
    bind('category-delete', (el) => {
      const id = Number(el.dataset.id);
      const count = K.E.products.filter((p) => Number(p.categoryId || p.category?.id) === id).length;
      if (count) return K.tell('این دسته محصول دارد؛ ابتدا محصولات را منتقل کن.');
      K.dialog(
        'حذف دسته‌بندی',
        help('این دسته از کل فروشگاه حذف شود؟'),
        b('category-back', 'انصراف') + b('category-confirm-delete', 'حذف دسته', true),
      );
      bind('category-back', categories);
      bind('category-confirm-delete', async () => {
        await sellerApiFetch('/categories/' + id, { method: 'DELETE' });
        await refreshCatalog();
        categories();
      });
    });
  }
  async function refreshCatalog() {
    const [products, categories] = await Promise.all([
      sellerApiFetch('/products'),
      sellerApiFetch('/categories'),
    ]);
    K.E.products = products;
    K.E.categories = categories;
    K.catalogChanged();
  }
  function categoryEditor(source, temp) {
    const draft = temp || {
      name: source?.name || '',
      description: source?.description || '',
      imageUrl: source?.imageUrl || '',
      sortOrder: source?.sortOrder || 0,
    };
    function draw() {
      K.dialog(
        source ? 'ویرایش دسته' : 'دستهٔ جدید',
        note('ذخیرهٔ این اطلاعات روی دسته‌بندی واقعی فروشگاه اعمال می‌شود.') +
          errorBox +
          input('نام دسته', 'name', draft.name, 'text', 'maxlength="100" required') +
          textarea('توضیح دسته', 'description', draft.description) +
          input(
            'اولویت دسته (عدد کمتر بالاتر)',
            'sortOrder',
            draft.sortOrder,
            'number',
            'min="0" max="10000"',
          ) +
          '<div class="sfe-studio-media">' +
          (draft.imageUrl ? '<img src="' + esc(draft.imageUrl) + '" alt="عکس دسته">' : '') +
          b('category-image', 'انتخاب یا آپلود عکس') +
          (draft.imageUrl ? b('category-no-image', 'استفاده از عکس محصول') : '') +
          '</div>',
        b('category-back', 'انصراف') + b('category-save', 'ذخیره در کل فروشگاه', true),
      );
      values(draft);
      bind('category-back', categories);
      bind('category-image', () =>
        K.media(
          'image',
          (a) => {
            draft.imageUrl = a.url;
            draw();
          },
          draw,
        ),
      );
      bind('category-no-image', () => {
        draft.imageUrl = '';
        draw();
      });
      bind('category-save', async (el) => {
        if (
          !q('[data-studio-field="name"]').reportValidity() ||
          !q('[data-studio-field="sortOrder"]').reportValidity()
        )
          return;
        el.disabled = true;
        try {
          await sellerApiFetch('/categories' + (source ? '/' + source.id : ''), {
            method: source ? 'PATCH' : 'POST',
            body: JSON.stringify({
              ...draft,
              imageUrl: draft.imageUrl || null,
              ...(source?.updatedAt ? { expectedUpdatedAt: source.updatedAt } : {}),
            }),
          });
          await refreshCatalog();
          categories();
        } catch (e) {
          el.disabled = false;
          error(e.message);
        }
      });
    }
    draw();
  }
  function chooseCategories() {
    const s = K.active();
    if (!s) return;
    pick({
      title: 'دسته‌های صفحهٔ اصلی و ترتیب نمایش',
      records: K.E.categories.map((c) => ({ id: c.id, name: c.name, image: c.imageUrl })),
      selected: s.settings?.categoryIds || [],
      footer: 'این انتخاب فقط کارت‌های این بخش را تنظیم می‌کند؛ دسته یا محصولی حذف نمی‌شود.',
      apply: (ids) => {
        K.mutate(() => {
          K.M.setPath(s, 'settings.categoryIds', ids);
          K.M.setPath(s, 'settings.editorOptionsV1.categorySelectionMode', 'manual');
        });
        K.close();
      },
    });
  }
  function exclusions() {
    const s = K.active();
    pick({
      title: 'محصولات کنارگذاشته‌شده از این بخش',
      records: productRecords(),
      selected: s.settings?.excludedProductIds || [],
      apply: (ids) => {
        K.mutate(() => K.M.setPath(s, 'settings.excludedProductIds', ids));
        K.close();
      },
    });
  }
  function offer() {
    const s = K.active();
    if (!s) return;
    const st = s.settings || {},
      draft = JSON.parse(
        JSON.stringify(
          st.offerV1 || { enabled: false, type: 'percent', value: 10, allowCoupons: false, overrides: {} },
        ),
      );
    let startsAt = st.startsAt || null,
      endsAt = st.endsAt || null;
    K.dialog(
      'تخفیف واقعی جعبهٔ صورتی',
      note(
        'این تغییر در پیش‌نویس می‌ماند. پس از انتشار، قیمت محصولات و محاسبهٔ سفارش از همین پیشنهاد استفاده می‌کنند.',
      ) +
        errorBox +
        check('فعال‌بودن پیشنهاد', 'enabled', draft.enabled) +
        select('نوع تخفیف مشترک', 'type', draft.type, [
          ['percent', 'درصدی'],
          ['fixed', 'مبلغ ثابت به تومان'],
        ]) +
        input('مقدار تخفیف مشترک', 'value', draft.value, 'number', 'min="1" max="1000000000" required') +
        input('شروع پیشنهاد', 'startsAt', date(startsAt), 'datetime-local') +
        input('پایان پیشنهاد', 'endsAt', date(endsAt), 'datetime-local') +
        check('امکان تخفیف بیشتر با کد یا کمپین دیگر', 'allowCoupons', draft.allowCoupons) +
        help(
          'مقدار اختصاصی هر محصول اختیاری است؛ خالی یعنی استفاده از مقدار مشترک. تخفیف مبلغ ثابت باید کمتر از قیمت محصول باشد.',
        ) +
        '<div data-offer-products></div>',
      b('offer-cancel', 'انصراف') + b('offer-save', 'اعمال در پیش‌نویس', true),
    );
    const products = C.ids(st.productIds)
      .map((id) => K.E.products.find((p) => Number(p.id) === id))
      .filter(Boolean);
    q('[data-offer-products]').innerHTML =
      products
        .map(
          (p) =>
            '<div class="sfe-studio-offer-row"><strong>' +
            esc(p.name) +
            '</strong><small>قیمت پایه: ' +
            C.basePrice(p).toLocaleString('fa-IR') +
            ' تومان</small><label class="sfe-field"><span>مقدار اختصاصی</span><input type="number" min="1" data-offer-id="' +
            p.id +
            '" value="' +
            esc(draft.overrides?.[p.id]?.value || '') +
            '" placeholder="مشترک"></label><output data-offer-price="' +
            p.id +
            '"></output></div>',
        )
        .join('') || help('ابتدا محصولات جعبهٔ صورتی را انتخاب کن.');
    function drawPrices() {
      products.forEach((p) => {
        const rule = draft.overrides?.[p.id] || draft;
        q('[data-offer-price="' + p.id + '"]').textContent =
          'قیمت نهایی: ' + C.discounted(C.basePrice(p), rule).toLocaleString('fa-IR') + ' تومان';
      });
    }
    all('[data-studio-field]').forEach(
      (el) =>
        (el.oninput = () => {
          const key = el.dataset.studioField;
          let v =
            el.type === 'checkbox'
              ? el.checked
              : el.type === 'number'
                ? Number(el.value)
                : el.type === 'datetime-local'
                  ? el.value
                    ? new Date(el.value).toISOString()
                    : null
                  : el.value;
          if (key === 'startsAt') startsAt = v;
          else if (key === 'endsAt') endsAt = v;
          else draft[key] = v;
          if (key === 'type') Object.values(draft.overrides || {}).forEach((r) => (r.type = v));
          drawPrices();
        }),
    );
    all('[data-offer-id]').forEach(
      (el) =>
        (el.oninput = () => {
          draft.overrides = draft.overrides || {};
          if (el.value) draft.overrides[el.dataset.offerId] = { type: draft.type, value: Number(el.value) };
          else delete draft.overrides[el.dataset.offerId];
          drawPrices();
        }),
    );
    drawPrices();
    bind('offer-cancel', () => K.close());
    bind('offer-save', () => {
      const next = { ...s, settings: { ...st, offerV1: draft, startsAt, endsAt } };
      const errors = C.validateContent({ sections: [next] }, {});
      if (draft.enabled)
        products.forEach((p) => {
          if (C.discounted(C.basePrice(p), draft.overrides?.[p.id] || draft) >= C.basePrice(p))
            errors.push('تخفیف «' + p.name + '» باید کمتر از قیمت و بیشتر از صفر باشد');
        });
      if (errors.length) return error([...new Set(errors)].join(' · '));
      K.mutate(() => {
        K.M.setPath(s, 'settings.offerV1', draft);
        if (draft.enabled) {
          s.enabled = true;
          K.M.setPath(s, 'settings.editorOptionsV1.visible', true);
        }
        K.M.setPath(s, 'settings.startsAt', startsAt);
        K.M.setPath(s, 'settings.endsAt', endsAt);
        K.M.setPath(s, 'settings.editorOptionsV1.scheduleEnabled', !!startsAt);
      });
      K.close();
    });
  }
  const names = {
    heading: 'عنوان',
    text: 'متن',
    image: 'عکس',
    video: 'ویدیو',
    button: 'دکمه / لینک',
    divider: 'جداکننده',
    faq: 'پرسش و پاسخ',
  };
  const presets = {
    text: ['heading', 'text'],
    'image-text': ['image', 'heading', 'text', 'button'],
    gallery: ['image', 'image'],
    video: ['video', 'text'],
    faq: ['faq', 'faq'],
    custom: [],
  };
  const presetNames = {
    text: 'بخش متنی',
    'image-text': 'عکس و متن',
    gallery: 'گالری تصاویر',
    video: 'بخش ویدیو',
    faq: 'پرسش‌های متداول',
    custom: 'بخش دلخواه',
  };
  function templatesHtml() {
    return (
      '<p class="sfe-help">قالب‌های محتوایی جدید</p><div class="sfe-template-grid">' +
      Object.entries(presetNames)
        .map(
          ([id, name]) =>
            '<button type="button" data-action="studio-new" data-template="' +
            id +
            '"><strong>' +
            name +
            '</strong><small>متن، رسانه و طراحی قابل ویرایش</small></button>',
        )
        .join('') +
      '</div>' +
      (C.list(K.E.theme.sectionTemplatesV1).length
        ? '<p class="sfe-help">قالب‌های ذخیره‌شدهٔ من</p><div class="sfe-template-grid">' +
          K.E.theme.sectionTemplatesV1
            .map(
              (t) =>
                '<button type="button" data-action="studio-use-template" data-template="' +
                t.id +
                '"><strong>' +
                esc(t.name) +
                '</strong></button>',
            )
            .join('') +
          '</div>'
        : '')
    );
  }
  function newBlock(preset, saved) {
    if (K.E.config.sections.length >= 40) return K.tell('حداکثر ۴۰ بخش مجاز است');
    const anchor = K.active();
    const section = saved
      ? JSON.parse(JSON.stringify(saved.section))
      : {
          type: 'banner',
          enabled: true,
          content: {
            title: presetNames[preset],
            elements: (presets[preset] || []).map((type) => ({
              id: uid('element'),
              type,
              text: ['heading', 'text', 'faq'].includes(type) ? names[type] : '',
            })),
          },
          settings: {
            editorManagedV1: true,
            builderV1: true,
            builderDesignV1: { layout: preset === 'gallery' ? 'grid' : 'column' },
          },
        };
    section.id = uid('content');
    section.settings.insertAfterId = anchor && anchor.type !== 'footer' ? anchor.id : undefined;
    K.mutate(() => {
      const index =
        anchor && anchor.type !== 'footer'
          ? K.E.config.sections.indexOf(anchor) + 1
          : K.E.config.sections.findIndex((s) => s.type === 'footer');
      K.E.config.sections.splice(index < 0 ? K.E.config.sections.length : index, 0, section);
      K.E.activeSection = section.id;
      K.E.tab = 'content';
    });
    K.close();
    K.pane('settings');
  }
  function builderContent(s) {
    return (
      help('اجزای این بخش را اضافه، مرتب و ویرایش کن. متن از **ضخیم** و خط جدید پشتیبانی می‌کند.') +
      '<div class="sfe-studio-elements">' +
      C.list(s.content?.elements)
        .map(
          (e, i) =>
            '<div class="sfe-selected-row"><span>' +
            esc(names[e.type] || e.type) +
            '<small>' +
            esc((e.text || e.alt || '').slice(0, 45)) +
            '</small></span>' +
            K.btn('studio-element', 'ویرایش', false, 'data-index="' + i + '"') +
            K.btn('studio-element-up', '↑', false, 'data-index="' + i + '" aria-label="بالاتر"') +
            K.btn('studio-element-down', '↓', false, 'data-index="' + i + '" aria-label="پایین‌تر"') +
            K.btn('studio-element-delete', '×', false, 'data-index="' + i + '" aria-label="حذف جزء"') +
            '</div>',
        )
        .join('') +
      '</div><div class="sfe-studio-add-elements">' +
      Object.entries(names)
        .map(([type, name]) => K.btn('studio-element-add', '+ ' + name, false, 'data-kind="' + type + '"'))
        .join('') +
      '</div>' +
      K.btn('studio-position', 'محل نمایش این بخش') +
      K.btn('studio-template-save', 'ذخیره به‌عنوان قالب شخصی')
    );
  }
  function elementEditor(index, temp) {
    const section = K.active();
    const source = section.content.elements[index];
    const item = temp || JSON.parse(JSON.stringify(source));
    function draw() {
      const media = ['image', 'video'].includes(item.type);
      K.dialog(
        'ویرایش ' + names[item.type],
        errorBox +
          (['heading', 'text', 'button', 'faq', 'image', 'video'].includes(item.type)
            ? textarea(
                item.type === 'faq' ? 'پرسش' : media ? 'توضیح / زیرنویس' : 'متن',
                'text',
                item.text || '',
              )
            : '') +
          (item.type === 'faq' ? textarea('پاسخ', 'answer', item.answer || '') : '') +
          (media
            ? '<div class="sfe-studio-media">' +
              (item.type === 'image' && item.url ? '<img src="' + esc(item.url) + '" alt="">' : '') +
              help(item.url ? 'فایل انتخاب شده' : 'فایلی انتخاب نشده') +
              b('element-media', 'انتخاب یا آپلود ' + names[item.type]) +
              (item.type === 'video' ? b('element-poster', 'انتخاب کاور') : '') +
              '</div>'
            : '') +
          (item.type === 'image'
            ? input('متن جایگزین عکس', 'alt', item.alt || '') +
              input('لینک عکس (اختیاری)', 'link', item.link || '')
            : '') +
          (item.type === 'button'
            ? input('مقصد دکمه', 'url', item.url || '') + b('element-link', 'انتخاب محصول، دسته یا صفحه')
            : '') +
          (['heading', 'text'].includes(item.type)
            ? select('تراز متن', 'align', item.align || 'right', [
                ['right', 'راست'],
                ['center', 'وسط'],
                ['left', 'چپ'],
              ]) + input('اندازهٔ متن', 'size', item.size || 16, 'number', 'min="10" max="64"')
            : ''),
        b('element-cancel', 'انصراف') + b('element-save', 'ذخیره جزء', true),
      );
      values(item);
      bind('element-cancel', () => K.close());
      bind('element-media', () =>
        K.media(
          item.type === 'image' ? 'image' : 'video',
          (a) => {
            item.url = a.url;
            draw();
          },
          draw,
        ),
      );
      bind('element-poster', () =>
        K.media(
          'image',
          (a) => {
            item.poster = a.url;
            draw();
          },
          draw,
        ),
      );
      bind('element-link', () => {
        const records = [
          { id: 'products.html', name: 'همه محصولات' },
          { id: 'education.html', name: 'ویدیوهای آموزشی' },
          ...K.E.products.map((p) => ({ id: 'product-detail.html?id=' + p.id, name: p.name })),
          ...K.E.categories.map((c) => ({ id: 'products.html?category=' + c.id, name: 'دسته: ' + c.name })),
        ];
        pick({
          title: 'مقصد دکمه',
          cancel: draw,
          single: true,
          records,
          selected: [],
          allowEmpty: false,
          apply: (ids) => {
            item.url = ids[0];
            draw();
          },
        });
      });
      bind('element-save', () => {
        if ((item.link && !K.M.safeUrl(item.link)) || (item.type === 'button' && !K.M.safeUrl(item.url)))
          return error('نشانی لینک معتبر نیست');
        K.mutate(() => (section.content.elements[index] = item));
        K.close();
      });
    }
    draw();
  }
  function position() {
    const s = K.active();
    const choices = K.E.config.sections.filter((r) => r.id !== s.id && r.type !== 'footer');
    let after = s.settings.insertAfterId || '';
    K.dialog(
      'محل نمایش بخش جدید',
      select('بعد از این بخش', 'after', after, [
        ['', 'پس از بخش‌های اصلی'],
        ...choices.map((r) => [r.id, K.title(r)]),
      ]) + help('ترتیب بخش‌های اصلی حفظ می‌شود؛ این بخش در فاصلهٔ انتخابی قرار می‌گیرد.'),
      b('position-cancel', 'انصراف') + b('position-save', 'اعمال محل', true),
    );
    q('[data-studio-field="after"]').onchange = (e) => (after = e.target.value);
    bind('position-cancel', () => K.close());
    bind('position-save', () => {
      K.mutate(() => {
        const rows = K.E.config.sections.filter((r) => r.id !== s.id);
        let i = after
          ? rows.findIndex((r) => r.id === after) + 1
          : rows.findIndex((r) => r.type === 'footer');
        if (i < 0) i = rows.length;
        rows.splice(i, 0, s);
        K.E.config.sections = rows;
        K.M.setPath(s, 'settings.insertAfterId', after || undefined);
      });
      K.close();
    });
  }
  function saveTemplate() {
    const s = K.active(),
      draft = { name: K.title(s) };
    K.dialog(
      'ذخیرهٔ قالب شخصی',
      input('نام قالب', 'name', draft.name, 'text', 'maxlength="100" required'),
      b('template-cancel', 'انصراف') + b('template-save', 'ذخیره قالب', true),
    );
    values(draft);
    bind('template-cancel', () => K.close());
    bind('template-save', () => {
      if (!q('[data-studio-field="name"]').reportValidity()) return;
      if (C.list(K.E.theme.sectionTemplatesV1).length >= 30) return K.tell('حداکثر ۳۰ قالب شخصی مجاز است');
      K.mutate(() => {
        const copy = JSON.parse(JSON.stringify(s));
        delete copy.id;
        delete copy.settings.insertAfterId;
        K.E.theme.sectionTemplatesV1 = C.list(K.E.theme.sectionTemplatesV1).concat({
          id: uid('template'),
          name: draft.name,
          section: copy,
        });
      });
      K.close();
    });
  }
  function menu() {
    const current = K.E.theme.editorMenuV1;
    const draft = JSON.parse(
      JSON.stringify(
        current || {
          enabled: false,
          items: [
            { id: 'home', label: 'صفحه نخست', url: 'index.html' },
            { id: 'products', label: 'همه محصولات', url: 'products.html' },
            { id: 'education', label: 'ویدیوهای آموزشی', url: 'education.html' },
            { id: 'profile', label: 'حساب کاربری', url: 'profile.html' },
            { id: 'cart', label: 'سبد خرید', url: 'cart.html' },
          ],
        },
      ),
    );
    function draw() {
      K.dialog(
        'ویرایش منوی سه‌خط',
        note('این منو پس از انتشار جای فهرست فعلی را می‌گیرد. برای منوی پیش‌فرض، گزینهٔ زیر را خاموش کن.') +
          check('استفاده از منوی سفارشی', 'enabled', draft.enabled) +
          '<div data-menu-items>' +
          draft.items
            .map(
              (r, i) =>
                '<div class="sfe-studio-menu-item">' +
                input('عنوان', 'label-' + i, r.label, 'text', 'maxlength="100"') +
                input('نشانی مقصد', 'url-' + i, r.url) +
                select('زیرمنوی', 'parent-' + i, r.parentId || '', [
                  ['', 'سطح اصلی'],
                  ...draft.items.filter((p) => p.id !== r.id && !p.parentId).map((p) => [p.id, p.label]),
                ]) +
                '<div>' +
                b('menu-up', '↑', false, 'data-index="' + i + '" aria-label="بالاتر"') +
                b('menu-down', '↓', false, 'data-index="' + i + '" aria-label="پایین‌تر"') +
                b('menu-delete', 'حذف', false, 'data-index="' + i + '"') +
                '</div></div>',
            )
            .join('') +
          '</div>' +
          b('menu-new', 'افزودن لینک') +
          errorBox,
        b('menu-cancel', 'انصراف') + b('menu-save', 'اعمال در پیش‌نویس', true),
      );
      all('[data-studio-field]').forEach(
        (el) =>
          (el.oninput = () => {
            if (el.dataset.studioField === 'enabled') draft.enabled = el.checked;
            else {
              const [key, index] = el.dataset.studioField.split('-');
              draft.items[Number(index)][key === 'parent' ? 'parentId' : key] = el.value;
            }
          }),
      );
      bind('menu-new', () => {
        if (draft.items.length >= 30) return K.tell('حداکثر ۳۰ لینک');
        draft.items.push({ id: uid('link'), label: 'لینک جدید', url: '' });
        draw();
      });
      const move = (i, to) => {
        if (to < 0 || to >= draft.items.length) return;
        draft.items.splice(to, 0, draft.items.splice(i, 1)[0]);
        draw();
      };
      bind('menu-up', (el) => move(Number(el.dataset.index), Number(el.dataset.index) - 1));
      bind('menu-down', (el) => move(Number(el.dataset.index), Number(el.dataset.index) + 1));
      bind('menu-delete', (el) => {
        const [removed] = draft.items.splice(Number(el.dataset.index), 1);
        draft.items.forEach((r) => {
          if (r.parentId === removed.id) r.parentId = '';
        });
        draw();
      });
      bind('menu-cancel', () => K.close());
      bind('menu-save', () => {
        if (draft.items.some((r) => !r.label.trim() || !r.url.trim() || !K.M.safeUrl(r.url)))
          return error('عنوان و مقصد معتبر برای همهٔ لینک‌ها وارد کن');
        if (
          draft.items.some((r) => r.parentId && !draft.items.some((p) => p.id === r.parentId && !p.parentId))
        )
          return error('زیرمنو فقط یک سطح دارد');
        K.mutate(() => (K.E.theme.editorMenuV1 = draft));
        K.close();
      });
    }
    draw();
  }
  function content(s) {
    let html = '';
    if (s.type === 'videos')
      html +=
        K.btn('studio-library', 'مدیریت آموزش‌ها') +
        K.btn('studio-choose-lessons', 'انتخاب آموزش و اولویت') +
        K.select('انتخاب از آموزش‌ها', 'settings.educationMode', s.settings?.educationMode || 'manual', [
          ['manual', 'فقط انتخاب دستی'],
          ['newest', 'جدیدترین آموزش‌ها'],
          ['hybrid', 'منتخب‌ها و سپس جدیدترین‌ها'],
        ]);
    if (s.type === 'categories')
      html +=
        K.btn('studio-categories', 'ساخت و مدیریت دسته‌بندی') +
        K.btn('studio-choose-categories', 'انتخاب و ترتیب کارت‌های این بخش') +
        K.select(
          'منبع کارت‌های دسته‌بندی',
          'settings.editorOptionsV1.categorySelectionMode',
          s.settings?.editorOptionsV1?.categorySelectionMode || 'all',
          [
            ['all', 'همهٔ دسته‌های دارای محصول'],
            ['manual', 'انتخاب دستی'],
          ],
        );
    if (s.type === 'best-sellers' || s.type === 'product-collection')
      html +=
        K.check(
          'فقط محصولات موجود',
          'settings.editorOptionsV1.inStockOnly',
          s.settings?.editorOptionsV1?.inStockOnly === true,
        ) +
        K.btn('studio-exclusions', 'محصولات کنارگذاشته‌شده') +
        (s.type === 'best-sellers'
          ? K.select('بازهٔ فروش واقعی', 'settings.rankingDays', s.settings?.rankingDays || 30, [
              ['7', '۷ روز'],
              ['30', '۳۰ روز'],
              ['90', '۹۰ روز'],
            ]) +
            K.select('در صورت کافی‌نبودن فروش', 'settings.fallbackMode', s.settings?.fallbackMode || 'none', [
              ['none', 'فهرست کوتاه‌تر بماند'],
              ['newest', 'تکمیل با جدیدترین محصولات'],
            ])
          : '');
    if (s.type === 'product-collection')
      html +=
        K.select('منبع مجموعه', 'settings.collectionMode', s.settings?.collectionMode || 'current', [
          ['current', 'انتخاب فعلی'],
          ['manual', 'انتخاب دستی'],
          ['newest', 'جدیدترین محصولات'],
          ['category', 'محصولات یک دسته'],
        ]) +
        K.select('دستهٔ منبع مجموعه', 'settings.categoryId', s.settings?.categoryId || '', [
          ['', 'همه دسته‌ها'],
          ...K.E.categories.map((c) => [String(c.id), c.name]),
        ]);
    if (s.type === 'campaign') html += K.btn('studio-offer', 'تعریف تخفیف واقعی و زمان‌بندی', true);
    if (s.settings?.builderV1) html += builderContent(s);
    return html;
  }
  function layout(s) {
    if (!s.settings?.builderV1) return '';
    const base = s.settings.builderDesignV1 || {},
      d = { ...base, ...base.shared, ...base[K.E.scope] },
      p = 'settings.builderDesignV1.' + K.E.scope + '.';
    return (
      K.select('چیدمان اجزا', p + 'layout', d.layout || 'column', [
        ['column', 'ستونی'],
        ['row', 'دو ستون'],
        ['grid', 'گالری دو ستون'],
      ]) +
      K.select('تراز محتوا', p + 'align', d.align || 'right', [
        ['right', 'راست'],
        ['center', 'وسط'],
        ['left', 'چپ'],
      ]) +
      K.field(
        'رنگ زمینهٔ محتوای بخش',
        p + 'background',
        d.background || '',
        'text',
        'placeholder="#FFFFFF" pattern="#[0-9a-fA-F]{6}"',
      ) +
      K.field(
        'رنگ متن محتوای بخش',
        p + 'color',
        d.color || '',
        'text',
        'placeholder="#452B45" pattern="#[0-9a-fA-F]{6}"',
      ) +
      K.field('فاصلهٔ درونی', p + 'padding', d.padding ?? 24, 'number', 'min="0" max="100"') +
      K.field('فاصلهٔ اجزا', p + 'gap', d.gap ?? 16, 'number', 'min="0" max="64"') +
      K.field('گردی گوشه‌ها', p + 'radius', d.radius ?? 20, 'number', 'min="0" max="80"')
    );
  }
  function handle(button) {
    const action = button.dataset.action;
    if (!action?.startsWith('studio-')) return false;
    const s = K.active();
    const i = Number(button.dataset.index);
    const map = {
      'studio-library': library,
      'studio-categories': categories,
      'studio-menu': menu,
      'studio-choose-lessons': chooseLessons,
      'studio-choose-categories': chooseCategories,
      'studio-exclusions': exclusions,
      'studio-offer': offer,
      'studio-new': () => newBlock(button.dataset.template),
      'studio-use-template': () => {
        const t = C.list(K.E.theme.sectionTemplatesV1).find((t) => t.id === button.dataset.template);
        if (t) newBlock(null, t);
      },
      'studio-element': () => elementEditor(i),
      'studio-element-add': () => {
        if (s.content.elements.length >= 40) return K.tell('حداکثر ۴۰ جزء');
        K.mutate(() => s.content.elements.push({ id: uid('element'), type: button.dataset.kind, text: '' }));
        elementEditor(s.content.elements.length - 1);
      },
      'studio-element-delete': () => K.mutate(() => s.content.elements.splice(i, 1)),
      'studio-element-up': () => {
        if (i > 0) K.mutate(() => s.content.elements.splice(i - 1, 0, s.content.elements.splice(i, 1)[0]));
      },
      'studio-element-down': () => {
        if (i < s.content.elements.length - 1)
          K.mutate(() => s.content.elements.splice(i + 1, 0, s.content.elements.splice(i, 1)[0]));
      },
      'studio-position': position,
      'studio-template-save': saveTemplate,
    };
    if (map[action]) Promise.resolve(map[action]()).catch((e) => K.tell(e.message));
    return true;
  }
  window.StorefrontEditorStudio = { attach: (kit) => (K = kit), content, layout, templatesHtml, handle };
})();
