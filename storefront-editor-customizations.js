/* Opt-in editor controls. An unedited published configuration renders exactly as before. */
(function () {
  'use strict';
  const home = window.StorefrontHome;
  const C = window.StorefrontContentCore,
    RT = window.StorefrontContentRuntime;
  const rankings = new Map();
  let contentTimer = 0;
  const root = document.getElementById('storefront-home-root');
  if (!home || !root) return;
  let current = null;
  const safe = (value) =>
    typeof escapeHtml === 'function'
      ? escapeHtml(value)
      : String(value == null ? '' : value).replace(
          /[&<>"']/g,
          (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
        );
  const url = (value) => {
    if (!String(value || '').trim()) return '';
    try {
      const parsed = new URL(value, location.href);
      return ['http:', 'https:', 'tel:', 'mailto:'].includes(parsed.protocol) ? parsed.href : '';
    } catch (_) {
      return '';
    }
  };
  const number = (value, min, max) =>
    Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : null;
  const mode = () => (matchMedia('(max-width:700px)').matches ? 'mobile' : 'desktop');
  const originalRender = home.renderLayout;
  const hiddenDisplay = new WeakMap();
  function setHidden(node, hidden) {
    if (!node) return;
    if (hidden) {
      if (!hiddenDisplay.has(node))
        hiddenDisplay.set(node, {
          value: node.style.getPropertyValue('display'),
          priority: node.style.getPropertyPriority('display'),
        });
      if (
        node.style.getPropertyValue('display') !== 'none' ||
        node.style.getPropertyPriority('display') !== 'important'
      )
        node.style.setProperty('display', 'none', 'important');
    } else if (hiddenDisplay.has(node)) {
      const previous = hiddenDisplay.get(node);
      if (previous.value) node.style.setProperty('display', previous.value, previous.priority);
      else node.style.removeProperty('display');
      hiddenDisplay.delete(node);
    }
    if (node.hidden !== hidden) node.hidden = hidden;
  }
  function blockHtml(block, ctx) {
    if (block.settings?.builderV1 && RT) return RT.blockHtml(block, ctx);
    const c = block.content || {};
    const subtitle = c.subtitle ? '<p data-editor-subtitle>' + safe(c.subtitle) + '</p>' : '';
    const image = url(
      mode() === 'mobile'
        ? c.imageMobileUrl || c.imageDesktopUrl || c.imageUrl || ''
        : c.imageDesktopUrl || c.imageUrl || '',
    );
    const button =
      c.ctaText && url(c.ctaUrl || 'products.html')
        ? '<a class="sf-btn sf-btn-primary" href="' +
          safe(url(c.ctaUrl || 'products.html')) +
          '">' +
          safe(c.ctaText) +
          '</a>'
        : '';
    if (block.type === 'product-collection') {
      const ids = (block.settings || {}).productIds || [];
      const products =
        C &&
        (block.settings?.editorOptionsV1?.inStockOnly ||
          block.settings?.excludedProductIds ||
          block.settings?.collectionMode)
          ? C.selectProducts(block, ctx.products)
          : ids.length
            ? ids.map((id) => (ctx.products || []).find((p) => Number(p.id) === Number(id))).filter(Boolean)
            : (ctx.products || []).slice(0, 8);
      return (
        '<section class="sf-section sf-container sf-editor-block" data-editor-section="' +
        safe(block.id) +
        '"><div class="sf-section-head"><div><h2>' +
        safe(c.title || '') +
        '</h2><p>' +
        safe(c.subtitle || '') +
        '</p></div></div><div class="sf-product-scroll">' +
        products
          .slice(
            0,
            block.settings?.limit == null
              ? products.length
              : (number(block.settings.limit, 1, 24) ?? products.length),
          )
          .map(
            (p) =>
              '<a class="sf-product-card" href="product-detail.html?id=' +
              encodeURIComponent(p.id) +
              '"><div class="sf-product-media">' +
              (typeof getProductImageUrl === 'function' && getProductImageUrl(p)
                ? '<img src="' + safe(getProductImageUrl(p)) + '" alt="' + safe(p.name) + '">'
                : '') +
              '</div><div class="sf-product-body"><h3>' +
              safe(p.name) +
              '</h3><div class="sf-product-price">' +
              safe(typeof getProductPriceLabel === 'function' ? getProductPriceLabel(p) : '') +
              '</div></div></a>',
          )
          .join('') +
        '</div></section>'
      );
    }
    if (block.type === 'trust')
      return (
        '<section class="sf-trust sf-container sf-editor-block" data-editor-section="' +
        safe(block.id) +
        '"><div class="sf-trust-item"><div><strong>' +
        safe(c.title || 'مزایای فروشگاه') +
        '</strong>' +
        subtitle +
        '<p>' +
        safe(c.text || '') +
        '</p></div></div></section>'
      );
    if (block.type === 'support-banner')
      return (
        '<section class="sf-support-wrap sf-container sf-editor-block" data-editor-section="' +
        safe(block.id) +
        '"><div class="sf-support-banner"><div></div><div><h2>' +
        safe(c.title || '') +
        '</h2>' +
        subtitle +
        '<p>' +
        safe(c.text || '') +
        '</p></div>' +
        button +
        '</div></section>'
      );
    return (
      '<section class="sf-hero sf-container sf-editor-block" style="display:block!important" data-editor-section="' +
      safe(block.id) +
      '"><div class="sf-hero-panel"><div><span>' +
      safe(c.eyebrow || '') +
      '</span><h1>' +
      safe(c.title || '') +
      '</h1>' +
      subtitle +
      '<p>' +
      safe(c.text || '') +
      '</p><div class="sf-hero-actions">' +
      button +
      '</div></div>' +
      (image
        ? '<div class="sf-hero-art"><img src="' +
          safe(image) +
          '" alt="' +
          safe(c.title || '') +
          '" style="width:100%;max-height:320px;object-fit:contain"></div>'
        : '') +
      '</div></section>'
    );
  }
  const extraTypes = ['hero', 'banner', 'product-collection', 'support-banner', 'trust'];
  const originalRegistry = Object.fromEntries(extraTypes.map((type) => [type, home.registry[type]]));
  function updateRegistry(sections) {
    extraTypes.forEach((type) => {
      if (sections.some((block) => block.type === type && (block.settings || {}).editorManagedV1 === true)) {
        home.registry[type] = (block, ctx) =>
          (block.settings || {}).editorManagedV1 === true
            ? blockHtml(block, ctx)
            : originalRegistry[type]
              ? originalRegistry[type](block, ctx)
              : '';
      } else if (originalRegistry[type]) home.registry[type] = originalRegistry[type];
      else delete home.registry[type];
    });
  }
  const originalBestSellers = home.registry['best-sellers'];
  home.registry['best-sellers'] = (block, ctx) => {
    const st = block.settings || {},
      o = st.editorOptionsV1 || {},
      selection = o.selectionMode;
    if (!C || (!['auto', 'hybrid'].includes(selection) && !o.inStockOnly && !st.excludedProductIds))
      return originalBestSellers(block, ctx);
    const days = Number(st.rankingDays) || 30;
    const ranked = rankings.get(days)?.ids || ctx.bestSellerIds || [];
    const products = C.selectProducts(block, ctx.products, ranked);
    const adjusted = { ...block, settings: { ...st, productIds: products.map((p) => p.id) } };
    return originalBestSellers(adjusted, { ...ctx, products });
  };
  const originalCategories = home.registry.categories;
  home.registry.categories = (block, ctx) => {
    if (block.settings?.editorOptionsV1?.categorySelectionMode !== 'manual')
      return originalCategories(block, ctx);
    const categories = C.ids(block.settings.categoryIds)
      .map((id) => ctx.categories.find((c) => Number(c.id) === id))
      .filter(Boolean);
    return originalCategories(block, { ...ctx, categories });
  };
  const originalVideos = home.registry.videos;
  home.registry.videos = (block, ctx) => {
    if (block.settings?.editorOptionsV1?.videoSource !== 'education' || !C || !RT)
      return originalVideos(block, ctx);
    const shell = document.createElement('template');
    shell.innerHTML = originalVideos(block, { ...ctx, products: [] });
    const rail = shell.content.querySelector('.sf-video-demo,.sf-video-grid');
    if (rail) {
      rail.className = 'sf-video-grid';
      rail.innerHTML =
        C.selectLessons(block, current?.theme, Date.now() + (ctx.clockSkewMs || 0))
          .map((row) => RT.videoHtml(row, ctx.products || []))
          .join('') || '<p class="sf-section-empty">آموزشی برای این بخش انتخاب نشده است.</p>';
    }
    return shell.innerHTML;
  };
  function contentFeatures() {
    return (
      current &&
      (current.theme?.educationLibraryV1 ||
        current.theme?.editorMenuV1 ||
        current.sections.some(
          (s) =>
            s.settings?.offerV1 ||
            s.settings?.builderV1 ||
            ['auto', 'hybrid'].includes(s.settings?.editorOptionsV1?.selectionMode),
        ))
    );
  }
  function refreshContent() {
    if (!current || !C) return;
    clearTimeout(contentTimer);
    const now = Date.now() + (current.ctx?.clockSkewMs || 0),
      times = [];
    current.sections.forEach((s) => {
      if (s.settings?.offerV1?.enabled) times.push(s.settings.startsAt, s.settings.endsAt);
    });
    C.list(current.theme?.educationLibraryV1?.items).forEach((r) => times.push(r.publishAt));
    const next = times
      .map(Date.parse)
      .filter((t) => Number.isFinite(t) && t > now)
      .sort((a, b) => a - b)[0];
    if (next)
      contentTimer = setTimeout(
        () => {
          home.renderLayout(current.sections, current.ctx);
          window.dispatchEvent(new CustomEvent('storefront:home-ready'));
        },
        Math.min(next - now + 40, 2147483647),
      );
    current.sections
      .filter(
        (s) =>
          s.type === 'best-sellers' &&
          ['auto', 'hybrid'].includes(s.settings?.editorOptionsV1?.selectionMode),
      )
      .forEach((s) => {
        const days = Number(s.settings.rankingDays) || 30;
        if (rankings.has(days)) return;
        const state = { ids: null };
        rankings.set(days, state);
        apiFetch('/storefront-insights/public/' + SELLER_ID + '/best-sellers?limit=20&days=' + days)
          .then((data) => {
            state.ids = data.productIds || [];
            if (!current) return;
            home.renderLayout(current.sections, current.ctx);
            window.dispatchEvent(new CustomEvent('storefront:home-ready'));
          })
          .catch(() => {
            state.ids = current?.ctx?.bestSellerIds || [];
          });
      });
  }
  function render(config, theme) {
    home.applyTheme(theme || home.defaultTheme);
    home.renderLayout(config.sections, home.__editorContext || {});
  }
  home.renderLayout = function (sections, ctx) {
    const theme = current && current.theme;
    current = { sections, ctx, theme };
    home.__editorContext = ctx;
    updateRegistry(sections);
    const effective = sections.map((block) =>
      typeof (block.settings || {}).editorOptionsV1?.visible === 'boolean'
        ? { ...block, enabled: block.settings.editorOptionsV1.visible }
        : block,
    );
    const renderedContext =
      C && sections.some((s) => s.settings?.offerV1?.enabled)
        ? {
            ...ctx,
            products: C.decorateProducts(ctx.products, { sections }, Date.now() + (ctx.clockSkewMs || 0)),
          }
        : C && ctx.products?.some((p) => p.storefrontOriginalPrices)
          ? { ...ctx, products: C.decorateProducts(ctx.products, { sections }) }
          : ctx;
    const result = originalRender(effective, renderedContext);
    if (contentFeatures()) refreshContent();
    return result;
  };
  /* Initial boot calls its lexical renderer. Capture the same public context without
     mutating the page, then reuse it for later inspector messages. */
  async function capture() {
    if (current) return;
    try {
      const [page, store, categories, products, insights] = await Promise.all([
        apiFetch('/storefront/public/' + SELLER_ID + '/home'),
        fetchStoreConfig(),
        fetchPublicCategories(),
        apiFetch('/products/public/' + SELLER_ID),
        apiFetch('/storefront-insights/public/' + SELLER_ID + '/best-sellers?limit=20').catch(() => ({
          productIds: [],
        })),
      ]);
      if (!current)
        current = {
          sections: page.config.sections,
          theme: page.theme,
          ctx: {
            store,
            categories,
            products,
            bestSellerIds: insights.productIds || [],
            clockSkewMs: new Date(page.serverNow).getTime() - Date.now(),
          },
        };
      home.__editorContext = current.ctx;
      if (
        current.sections.some(
          (block) => block.settings?.editorManagedV1 || block.settings?.editorOptionsV1,
        ) ||
        contentFeatures()
      ) {
        home.renderLayout(current.sections, current.ctx);
        window.dispatchEvent(new CustomEvent('storefront:home-ready'));
      }
      apply();
    } catch (_) {
      /* The existing storefront owns its loading/error screen. */
    }
  }
  function selector(type) {
    return {
      search: '.sf-search-block',
      videos: '.sf-video-section',
      'best-sellers': '.sf-best-sellers',
      campaign: '.sf-campaign-section',
      categories: '#sf-categories',
      footer: '.sf-footer',
    }[type];
  }
  function applyStyles(node, values) {
    const map = {
      backgroundColor: 'backgroundColor',
      textColor: 'color',
      paddingTop: 'paddingTop',
      paddingBottom: 'paddingBottom',
      fontSize: 'fontSize',
    };
    Object.keys(map).forEach((key) => {
      if (values[key] == null || values[key] === '') return;
      if (key === 'backgroundColor' || key === 'textColor') {
        if (/^#[0-9a-f]{6}$/i.test(values[key])) {
          node.style.setProperty(
            key === 'backgroundColor' ? 'background' : 'color',
            values[key],
            'important',
          );
          if (key === 'textColor')
            node
              .querySelectorAll('h1,h2,h3,p,strong,.sf-section-head>a,.sf-category-showcase-head>a')
              .forEach((child) => child.style.setProperty('color', values[key], 'important'));
        }
      } else {
        const n = number(values[key], key === 'fontSize' ? 11 : 0, 160);
        if (n != null)
          node.style.setProperty(
            map[key].replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()),
            n + 'px',
            'important',
          );
      }
    });
    const grid = node.querySelector(
      '.sf-product-scroll,.sf-video-grid,.sf-video-demo,.sf-category-showcase-grid,.sf-category-grid',
    );
    if (grid && values.gap != null)
      grid.style.setProperty('gap', number(values.gap, 0, 64) + 'px', 'important');
    if (grid && values.visibleCards != null) {
      const cards = number(values.visibleCards, 1, 6);
      grid.style.setProperty('display', 'grid', 'important');
      grid.style.setProperty('grid-auto-flow', 'row', 'important');
      grid.style.setProperty('grid-template-columns', 'repeat(' + cards + ',minmax(0,1fr))', 'important');
    }
    if (values.cardRadius != null)
      node.querySelectorAll('.sf-product-card,.sf-video-card,.sf-category-showcase-card').forEach((card) => {
        card.style.setProperty('border-radius', number(values.cardRadius, 0, 80) + 'px', 'important');
      });
  }
  let scheduleTimer = 0;
  function apply() {
    if (!current) return;
    clearTimeout(scheduleTimer);
    let nextStart = Infinity;
    applyChrome();
    if (RT) RT.menu(current.theme);
    if (current.sections.some((s) => s.settings?.editorOptionsV1?.videoSource === 'education') && RT)
      RT.bindVideos(root);
    // Explicit insertion points may sit between fixed native sections.
    const anchors = new Map();
    current.sections.forEach((block) => {
      if (!block.settings?.insertAfterId || !block.settings?.editorManagedV1) return;
      const node = root.querySelector('[data-editor-section="' + CSS.escape(block.id) + '"]');
      const id = block.settings.insertAfterId,
        target = current.sections.find((s) => s.id === id);
      const anchor =
        anchors.get(id) ||
        root.querySelector('[data-editor-section="' + CSS.escape(id) + '"]') ||
        (target && selector(target.type) && root.querySelector(selector(target.type)));
      if (!node || !anchor || node === anchor || anchor.contains(node)) return;
      if (anchor.nextElementSibling !== node) root.insertBefore(node, anchor.nextElementSibling);
      anchors.set(id, node);
    });
    const rows = (current.sections || []).filter((s) => s && home.registry[s.type]);
    const primarySeen = new Set();
    rows.forEach((block) => {
      const st = block.settings || {},
        options = st.editorOptionsV1;
      let node = selector(block.type)
        ? root.querySelector(selector(block.type))
        : root.querySelector('[data-editor-section="' + CSS.escape(block.id) + '"]');
      if (!node || primarySeen.has(node)) return;
      primarySeen.add(node);
      if (!options) return;
      const start =
        block.type === 'campaign' && options.scheduleEnabled === true && st.startsAt
          ? new Date(st.startsAt).getTime()
          : NaN;
      const now = Date.now() + (current.ctx?.clockSkewMs || 0);
      const waiting = Number.isFinite(start) && start > now;
      if (waiting && options.visible !== false) nextStart = Math.min(nextStart, start - now);
      if (typeof options.visible === 'boolean' || options.scheduleEnabled === true)
        setHidden(
          node,
          options.visible === false || (options.visible === undefined && block.enabled === false) || waiting,
        );
      const values = Object.assign({}, options.shared || {}, options[mode()] || {});
      applyStyles(node, values);
      if (typeof options.showSubtitle === 'boolean')
        node
          .querySelectorAll('.sf-section-head>div>p,[data-editor-subtitle]')
          .forEach((p) => setHidden(p, !options.showSubtitle));
      if (typeof options.showPrice === 'boolean')
        node
          .querySelectorAll('.sf-product-price,.sf-pink-old-price,.sf-bestseller-old-price')
          .forEach((p) => setHidden(p, !options.showPrice));
      if (typeof options.showAll === 'boolean')
        node
          .querySelectorAll('.sf-section-head>a,.sf-category-showcase-head>a')
          .forEach((a) => setHidden(a, !options.showAll));
      if (block.type === 'campaign' && typeof options.showTimer === 'boolean') {
        node.querySelectorAll('.sf-countdown').forEach((timer) => {
          setHidden(timer, !options.showTimer);
        });
      }
    });
    if (Number.isFinite(nextStart)) scheduleTimer = setTimeout(apply, Math.min(nextStart + 25, 2147483647));
    const videoBlock = rows.find(
      (s) =>
        s.type === 'videos' &&
        (s.settings || {}).editorOptionsV1?.videoSource === 'library' &&
        Array.isArray(s.settings.videoUrls),
    );
    if (videoBlock) {
      const section = root.querySelector('.sf-video-section'),
        rail = section && section.querySelector('.sf-video-grid,.sf-video-demo');
      if (rail) {
        rail.className = 'sf-video-grid';
        rail.innerHTML = videoBlock.settings.videoUrls
          .slice(0, Number(videoBlock.settings.limit) || 8)
          .map(
            (source, index) =>
              '<article class="sf-video-card"><div class="sf-video-media"><video controls muted playsinline preload="metadata"' +
              ((videoBlock.settings.videoPosters || {})[source]
                ? ' poster="' + safe(url(videoBlock.settings.videoPosters[source])) + '"'
                : '') +
              '><source src="' +
              safe(url(source)) +
              '"></video></div><div class="sf-video-copy"><span>محتوای آموزشی</span><h3>' +
              safe((videoBlock.settings.videoTitles || {})[source] || 'ویدیو ' + (index + 1)) +
              '</h3></div></article>',
          )
          .join('');
        rail.querySelectorAll('video').forEach((video) =>
          video.addEventListener('play', () =>
            rail.querySelectorAll('video').forEach((other) => {
              if (other !== video) other.pause();
            }),
          ),
        );
        applyStyles(
          section,
          Object.assign(
            {},
            videoBlock.settings.editorOptionsV1.shared || {},
            videoBlock.settings.editorOptionsV1[mode()] || {},
          ),
        );
      }
    }
  }
  let originalHeader = null;
  function applyChrome() {
    const theme = current.theme || {},
      header = document.querySelector('.site-header'),
      logo = header && header.querySelector('.logo');
    if (!originalHeader && logo)
      originalHeader = {
        logo: logo.textContent,
        menu: header.querySelector('.menu-toggle')?.hidden || false,
        cart: header.querySelector('a[href="cart.html"]')?.hidden || false,
      };
    const h = theme.editorHeaderV1;
    if (h && logo) {
      logo.textContent = h.logoText || originalHeader.logo;
      const menu = header.querySelector('.menu-toggle'),
        cart = header.querySelector('a[href="cart.html"]');
      setHidden(menu, h.showMenu === undefined ? originalHeader.menu : !h.showMenu);
      setHidden(cart, h.showCart === undefined ? originalHeader.cart : !h.showCart);
      let announcement = header.querySelector('[data-editor-announcement]');
      if (h.announcement) {
        if (!announcement) {
          announcement = document.createElement('div');
          announcement.dataset.editorAnnouncement = '1';
          announcement.style.cssText = 'padding:8px 16px;text-align:center;font-size:12px';
          header.appendChild(announcement);
        }
        announcement.textContent = h.announcement;
      } else if (announcement) announcement.remove();
    } else if (originalHeader && logo && header.dataset.editorChromeApplied) {
      logo.textContent = originalHeader.logo;
      const menu = header.querySelector('.menu-toggle'),
        cart = header.querySelector('a[href="cart.html"]');
      setHidden(menu, originalHeader.menu);
      setHidden(cart, originalHeader.cart);
      header.querySelector('[data-editor-announcement]')?.remove();
    }
    if (h && header) header.dataset.editorChromeApplied = '1';
    const f = theme.editorFooterV1,
      footer = root.querySelector('.sf-footer');
    if (f && footer) {
      const about = footer.querySelector('.sf-footer-brand>p');
      if (about && f.about !== undefined) about.textContent = f.about;
      const contacts = footer.querySelector('.sf-footer-contact');
      if (contacts && f.phone !== undefined) {
        let item = contacts.querySelector('a[href^="tel:"]');
        if (!item && f.phone) {
          item = document.createElement('a');
          item.innerHTML = '<span>شماره تماس پشتیبانی</span><b></b>';
          contacts.appendChild(item);
        }
        if (item) {
          item.href = 'tel:' + f.phone;
          item.querySelector('b').textContent = f.phone;
          setHidden(item, !f.phone);
        }
      }
      if (contacts && f.email !== undefined) {
        let item = contacts.querySelector('a[href^="mailto:"]');
        if (!item && f.email) {
          item = document.createElement('a');
          item.innerHTML = '<span>ایمیل</span><b></b>';
          contacts.appendChild(item);
        }
        if (item) {
          item.href = 'mailto:' + f.email;
          item.querySelector('b').textContent = f.email;
          setHidden(item, !f.email);
        }
      }
    }
    if (theme.editorThemeV1?.buttonRadius !== undefined)
      root
        .querySelectorAll('.sf-btn')
        .forEach((node) =>
          node.style.setProperty(
            'border-radius',
            number(theme.editorThemeV1.buttonRadius, 0, 999) + 'px',
            'important',
          ),
        );
    if (theme.editorThemeV1?.cardRadius !== undefined)
      root
        .querySelectorAll('.sf-product-card,.sf-video-card,.sf-category-showcase-card')
        .forEach((node) =>
          node.style.setProperty(
            'border-radius',
            number(theme.editorThemeV1.cardRadius, 0, 80) + 'px',
            'important',
          ),
        );
    if (theme.editorThemeV1?.sectionSpacing !== undefined)
      root
        .querySelectorAll('.sf-section')
        .forEach((node) =>
          node.style.setProperty(
            'padding-top',
            number(theme.editorThemeV1.sectionSpacing, 16, 160) + 'px',
            'important',
          ),
        );
    if (theme.editorThemeV1?.globalPadding !== undefined)
      root
        .querySelectorAll('.sf-container')
        .forEach((node) =>
          node.style.setProperty(
            'width',
            'min(calc(100% - ' +
              2 * number(theme.editorThemeV1.globalPadding, 8, 64) +
              'px),var(--sf-container))',
            'important',
          ),
        );
    if (
      theme.editorThemeV1?.fontFamily?.includes('Vazirmatn') &&
      !document.querySelector('[data-editor-font]')
    ) {
      const style = document.createElement('style');
      style.dataset.editorFont = '1';
      style.textContent =
        "@font-face{font-family:Vazirmatn;src:url('https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/fonts/webfonts/Vazirmatn-Regular.woff2') format('woff2');font-weight:100 900;font-display:swap}";
      document.head.appendChild(style);
    }
  }
  window.addEventListener('storefront:home-ready', () => {
    capture();
    setTimeout(apply, 50);
  });
  let applyFrame = 0;
  new MutationObserver(() => {
    if (
      !current ||
      !current.sections.some((block) => block.settings?.editorOptionsV1 || block.settings?.editorManagedV1)
    )
      return;
    cancelAnimationFrame(applyFrame);
    applyFrame = requestAnimationFrame(apply);
  }).observe(root, { childList: true });
  window.addEventListener('message', (event) => {
    if (
      event.source !== parent ||
      event.origin !== location.origin ||
      !event.data ||
      event.data.type !== 'storefront-preview-config' ||
      !new URLSearchParams(location.search).has('editorPreview')
    )
      return;
    if (!home.__editorContext) return;
    const ctx = event.data.catalog
      ? {
          ...home.__editorContext,
          products: event.data.catalog.products,
          categories: event.data.catalog.categories,
        }
      : home.__editorContext;
    current = { sections: event.data.config.sections, ctx, theme: event.data.theme };
    home.__editorContext = ctx;
    render(event.data.config, event.data.theme);
    window.dispatchEvent(new CustomEvent('storefront:home-ready'));
    setTimeout(apply, 50);
  });
  const media = matchMedia('(max-width:700px)');
  media.addEventListener('change', () => {
    if (
      current &&
      current.sections.some((s) => (s.settings || {}).editorOptionsV1 || (s.settings || {}).editorManagedV1)
    ) {
      home.renderLayout(current.sections, current.ctx);
      window.dispatchEvent(new CustomEvent('storefront:home-ready'));
    }
  });
  home.editorCustomizations = { apply, selector };
  // A slow script download may finish after the initial home-ready event.
  if (root.querySelector('.sf-footer')) capture();
})();
