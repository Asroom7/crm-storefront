/* Independent educational library, with the original product-video page as a fallback. */
(function () {
  'use strict';
  const C = window.StorefrontContentCore,
    R = window.StorefrontContentRuntime;
  let root = document.getElementById('education-list'),
    library = null,
    products = [],
    visible = 12,
    timer = 0;
  const safe = (value) => {
    try {
      const u = new URL(String(value || ''), location.href);
      return ['http:', 'https:'].includes(u.protocol) && value ? u.href : '';
    } catch (_) {
      return '';
    }
  };
  function legacyCard(row, index) {
    const card = document.createElement('article');
    card.className = 'edu-card';
    const media = document.createElement('div');
    media.className = 'edu-media';
    const video = document.createElement('video');
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-label', 'ویدیوی آموزشی ' + (index + 1));
    const source = document.createElement('source');
    source.src = row.url;
    video.appendChild(source);
    media.appendChild(video);
    const copy = document.createElement('div');
    copy.className = 'edu-copy';
    const badge = document.createElement('span');
    badge.className = 'edu-badge';
    badge.textContent = 'محتوای آموزشی';
    const title = document.createElement('h2');
    title.textContent = row.product.name || 'آموزش محصول';
    const description = document.createElement('p');
    description.textContent = 'نکات و روش استفاده از محصول';
    const link = document.createElement('a');
    link.className = 'edu-product-link';
    link.href = 'product-detail.html?id=' + encodeURIComponent(row.product.id);
    link.textContent = 'مشاهده محصول مرتبط ‹';
    copy.append(badge, title, description, link);
    card.append(media, copy);
    return card;
  }
  function grid() {
    const node = document.createElement('section');
    node.className = 'edu-grid';
    node.setAttribute('aria-label', 'همه ویدیوهای آموزشی');
    root.replaceWith(node);
    root = node;
    return node;
  }
  function render() {
    clearTimeout(timer);
    const query =
        document.querySelector('[data-education-query]')?.value.trim().toLocaleLowerCase('fa') || '',
      topic = document.querySelector('[data-education-topic]')?.value || '';
    const rows = C.lessons({ educationLibraryV1: library }).filter(
      (row) =>
        (!topic || row.topic === topic) &&
        (!query ||
          (row.title + ' ' + (row.description || '') + ' ' + (row.topic || ''))
            .toLocaleLowerCase('fa')
            .includes(query)),
    );
    root.innerHTML =
      rows
        .slice(0, visible)
        .map((row) => R.videoHtml(row, products, true))
        .join('') || '<p class="edu-empty">آموزشی با این مشخصات پیدا نشد.</p>';
    R.bindVideos(root);
    const more = document.querySelector('[data-education-more]');
    more.hidden = rows.length <= visible;
    const next = C.list(library.items)
      .map((r) => Date.parse(r.publishAt))
      .filter((t) => t > Date.now())
      .sort((a, b) => a - b)[0];
    if (next) timer = setTimeout(render, Math.min(next - Date.now() + 40, 2147483647));
  }
  async function load() {
    try {
      products = await apiFetch('/products/public/' + SELLER_ID);
      const page = await apiFetch('/storefront/public/' + SELLER_ID + '/home').catch(() => null);
      library = page?.theme?.educationLibraryV1;
      if (library?.enabled && C && R) {
        const controls = document.createElement('div');
        controls.className = 'edu-library-controls';
        const topics = [
          ...new Set(
            C.list(library.items)
              .map((r) => r.topic)
              .filter(Boolean),
          ),
        ];
        controls.innerHTML =
          '<label>جستجوی آموزش<input type="search" data-education-query placeholder="عنوان، موضوع یا توضیح"></label><label>موضوع<select data-education-topic><option value="">همهٔ موضوع‌ها</option>' +
          topics.map((t) => '<option value="' + R.esc(t) + '">' + R.esc(t) + '</option>').join('') +
          '</select></label>';
        root.before(controls);
        grid();
        const more = document.createElement('button');
        more.type = 'button';
        more.className = 'sf-btn sf-btn-primary edu-library-more';
        more.dataset.educationMore = '1';
        more.textContent = 'نمایش آموزش‌های بیشتر';
        root.after(more);
        more.onclick = () => {
          visible += 12;
          render();
        };
        controls.oninput = () => {
          visible = 12;
          render();
        };
        render();
        return;
      }
      const rows = [];
      C.list(products).forEach((product) =>
        C.list(product?.media).forEach((media) => {
          const url = media?.kind === 'video' ? safe(media.url) : '';
          if (url) rows.push({ product, url });
        }),
      );
      if (!rows.length) {
        root.className = 'edu-empty';
        root.textContent = 'هنوز ویدیوی آموزشی برای نمایش ثبت نشده است.';
        return;
      }
      grid();
      rows.forEach((row, i) => root.appendChild(legacyCard(row, i)));
      R.bindVideos(root);
    } catch (error) {
      console.error(error);
      root.className = 'edu-error';
      root.textContent = 'در دریافت ویدیوهای آموزشی مشکلی پیش آمد. لطفاً صفحه را دوباره بارگذاری کنید.';
    }
  }
  load();
})();
