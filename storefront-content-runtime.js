/* Render only content explicitly created in the editor. No legacy DOM/style defaults. */
(function () {
  'use strict';
  const C = window.StorefrontContentCore;
  if (!C) return;
  const esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const url = (v, media = false) => {
    try {
      const u = new URL(String(v || ''), location.href);
      return (media ? ['http:', 'https:'] : ['http:', 'https:', 'tel:', 'mailto:']).includes(u.protocol) && v
        ? u.href
        : '';
    } catch (_) {
      return '';
    }
  };
  const color = (v) => (/^#[\da-f]{6}$/i.test(v || '') ? v : '');
  const n = (v, min, max, fallback) =>
    Number.isFinite(Number(v)) ? Math.max(min, Math.min(max, Number(v))) : fallback;
  function text(v) {
    return esc(v)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');
  }
  function blockHtml(block, ctx) {
    const s = block.settings || {},
      c = block.content || {},
      base = s.builderDesignV1 || {},
      device = matchMedia('(max-width:700px)').matches ? 'mobile' : 'desktop',
      design = { ...base, ...base.shared, ...base[device] };
    const styles = [
      color(design.background) ? 'background:' + color(design.background) : '',
      color(design.color) ? 'color:' + color(design.color) : '',
      'padding:' + n(design.padding, 0, 100, 24) + 'px',
      'border-radius:' + n(design.radius, 0, 80, 20) + 'px',
      'gap:' + n(design.gap, 0, 64, 16) + 'px',
      'text-align:' + (['right', 'center', 'left'].includes(design.align) ? design.align : 'right'),
    ]
      .filter(Boolean)
      .join(';');
    const elements = C.list(c.elements)
      .map((e) => {
        const align = ['right', 'center', 'left'].includes(e.align) ? e.align : '';
        const style =
          (align ? 'text-align:' + align + ';' : '') +
          (e.size ? 'font-size:' + n(e.size, 10, 64, 16) + 'px;' : '');
        if (e.type === 'heading') return '<h3 style="' + style + '">' + text(e.text) + '</h3>';
        if (e.type === 'text')
          return '<div class="sf-built-text" style="' + style + '">' + text(e.text) + '</div>';
        if (e.type === 'image') {
          const src = url(e.url, true);
          if (!src) return '';
          const img =
            '<img src="' + esc(src) + '" alt="' + esc(e.alt || '') + '" loading="lazy" decoding="async">';
          return (
            '<figure>' +
            (url(e.link) ? '<a href="' + esc(url(e.link)) + '">' + img + '</a>' : img) +
            (e.text ? '<figcaption>' + text(e.text) + '</figcaption>' : '') +
            '</figure>'
          );
        }
        if (e.type === 'video')
          return url(e.url, true)
            ? '<figure><video controls playsinline preload="metadata"' +
                (url(e.poster, true) ? ' poster="' + esc(url(e.poster, true)) + '"' : '') +
                ' src="' +
                esc(url(e.url, true)) +
                '"></video>' +
                (e.text ? '<figcaption>' + text(e.text) + '</figcaption>' : '') +
                '</figure>'
            : '';
        if (e.type === 'button')
          return url(e.url)
            ? '<div><a class="sf-btn sf-btn-primary" href="' +
                esc(url(e.url)) +
                '">' +
                esc(e.text || 'مشاهده') +
                '</a></div>'
            : '';
        if (e.type === 'divider') return '<hr>';
        if (e.type === 'faq')
          return (
            '<details><summary>' + esc(e.text || 'پرسش') + '</summary><p>' + text(e.answer) + '</p></details>'
          );
        return '';
      })
      .join('');
    return (
      '<section class="sf-section sf-container sf-editor-block sf-built-section" data-editor-section="' +
      esc(block.id) +
      '"' +
      (s.insertAfterId ? ' data-editor-anchor="' + esc(s.insertAfterId) + '"' : '') +
      '><div class="sf-built-content sf-built-' +
      (['column', 'grid', 'row'].includes(design.layout) ? design.layout : 'column') +
      '" style="' +
      styles +
      '">' +
      (c.title ? '<h2 class="sf-built-title">' + esc(c.title) + '</h2>' : '') +
      elements +
      '</div></section>'
    );
  }
  function videoHtml(lesson, products, page = false) {
    const links = C.ids(lesson.productIds)
      .map((id) => products.find((p) => Number(p.id) === id))
      .filter(Boolean);
    const tag = page ? 'h2' : 'h3';
    return (
      '<article class="' +
      (page ? 'edu-card' : 'sf-video-card') +
      '" data-lesson-id="' +
      esc(lesson.id) +
      '"><div class="' +
      (page ? 'edu-media' : 'sf-video-media') +
      '"><video controls playsinline preload="metadata" aria-label="' +
      esc(lesson.title) +
      '"' +
      (url(lesson.poster, true) ? ' poster="' + esc(url(lesson.poster, true)) + '"' : '') +
      ' src="' +
      esc(url(lesson.url, true)) +
      '"></video></div><div class="' +
      (page ? 'edu-copy' : 'sf-video-copy') +
      '"><span class="' +
      (page ? 'edu-badge' : '') +
      '">' +
      esc(lesson.topic || 'محتوای آموزشی') +
      '</span><' +
      tag +
      '>' +
      esc(lesson.title) +
      '</' +
      tag +
      '>' +
      (lesson.description ? '<p>' + text(lesson.description) + '</p>' : '') +
      links
        .map(
          (p) =>
            '<a class="' +
            (page ? 'edu-product-link' : '') +
            '" href="product-detail.html?id=' +
            encodeURIComponent(p.id) +
            '">' +
            esc(p.name) +
            ' ‹</a>',
        )
        .join('') +
      '</div></article>'
    );
  }
  const boundVideos = new WeakSet();
  function bindVideos(node) {
    const videos = Array.from(node.querySelectorAll('video'));
    videos.forEach((v) => {
      if (boundVideos.has(v)) return;
      boundVideos.add(v);
      v.addEventListener('play', () =>
        Array.from(node.querySelectorAll('video')).forEach((other) => {
          if (other !== v) other.pause();
        }),
      );
    });
  }
  let originalMenu = null;
  function menu(theme) {
    const config = theme?.editorMenuV1,
      nav = document.querySelector('.side-menu');
    if (!nav) return;
    let educationLink = nav.querySelector('[data-education-nav]');
    if (!config?.enabled && theme?.educationLibraryV1?.enabled) {
      if (!educationLink) {
        educationLink = document.createElement('a');
        educationLink.dataset.educationNav = '1';
        educationLink.href = 'education.html';
        educationLink.textContent = 'ویدیوهای آموزشی';
        nav.insertBefore(educationLink, nav.querySelector('.side-menu-sep'));
      }
    } else educationLink?.remove();
    const previous = nav.querySelector('[data-editor-menu]');
    if (!config?.enabled) {
      if (previous) previous.remove();
      if (originalMenu)
        originalMenu.forEach((r) => {
          r.node.hidden = r.hidden;
          if (r.display) r.node.style.setProperty('display', r.display, r.priority);
          else r.node.style.removeProperty('display');
        });
      return;
    }
    if (!originalMenu)
      originalMenu = Array.from(nav.querySelectorAll(':scope>a:not([data-education-nav])')).map((node) => ({
        node,
        hidden: node.hidden,
        display: node.style.getPropertyValue('display'),
        priority: node.style.getPropertyPriority('display'),
      }));
    originalMenu.forEach(({ node }) => {
      node.hidden = true;
      node.style.setProperty('display', 'none', 'important');
    });
    const items = C.list(config.items).filter((i) => i.visible !== false);
    const link = (i) => (url(i.url) ? '<a href="' + esc(url(i.url)) + '">' + esc(i.label) + '</a>' : '');
    const html = items
      .filter((i) => !i.parentId)
      .map((i) => {
        const children = items.filter((child) => child.parentId === i.id);
        return children.length
          ? '<details><summary>' +
              esc(i.label) +
              '</summary>' +
              link(i) +
              children.map(link).join('') +
              '</details>'
          : link(i);
      })
      .join('');
    if (previous?.dataset.markup === html) return;
    const wrap = previous || document.createElement('div');
    wrap.dataset.editorMenu = '1';
    wrap.dataset.markup = html;
    wrap.innerHTML = html;
    if (!previous) nav.insertBefore(wrap, nav.querySelector('.side-menu-sep'));
  }
  window.StorefrontContentRuntime = { blockHtml, videoHtml, bindVideos, menu, url, esc };
})();
