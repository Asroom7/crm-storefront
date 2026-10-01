/* Deterministic boot/preview bridge for the approved complete storefront editor.
   Panel-only: never mutates storefront source files. */
(function () {
  'use strict';

  var ROUTE = 'storefront-editor';
  var BUILD = '20261001-complete-v6';
  var view = document.getElementById('view');
  var editorUi = {
    lastChangeCount: null,
    lastEditAt: null,
    timer: 0
  };

  function routeName() {
    return location.hash.replace(/^#\/?/, '').split('/')[0];
  }

  function ensureControlLabelsCSS() {
    if (document.querySelector('link[data-storefront-editor-labels]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'storefront-editor-labels.css?v=20261001-v1';
    link.dataset.storefrontEditorLabels = '1';
    document.head.appendChild(link);
  }

  function ensureLastEditCSS() {
    if (document.querySelector('style[data-storefront-editor-last-edit]')) return;
    var style = document.createElement('style');
    style.dataset.storefrontEditorLastEdit = '1';
    style.textContent = [
      '.store-editor-complete .ec-statusbar{display:none!important}',
      '.store-editor-complete .ec-actions .ec-last-edit-state{display:inline-flex!important;align-items:center;justify-content:center;min-width:auto!important;max-width:220px;height:36px;margin:0;padding:0 10px;border:1px solid rgba(255,255,255,.86);border-radius:13px;background:var(--surface);box-shadow:0 5px 14px rgba(73,78,98,.08);font-size:9.5px;font-weight:800;color:var(--ink-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:0 0 auto}',
      '@media(max-width:640px){.store-editor-complete .ec-actions .ec-last-edit-state{height:34px;max-width:190px;padding-inline:9px;border-radius:11px;font-size:9px}}'
    ].join('');
    document.head.appendChild(style);
  }

  function completeEditor() {
    return window.StorefrontEditorComplete && typeof window.StorefrontEditorComplete.render === 'function'
      ? window.StorefrontEditorComplete
      : null;
  }

  function relativeEditTime(value) {
    if (!value) return 'ثبت نشده';
    var date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'ثبت نشده';
    var seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (seconds < 20) return 'همین الان';
    if (seconds < 60) return 'کمتر از یک دقیقه پیش';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes.toLocaleString('fa-IR') + ' دقیقه پیش';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours.toLocaleString('fa-IR') + ' ساعت پیش';
    var days = Math.floor(hours / 24);
    return days.toLocaleString('fa-IR') + ' روز پیش';
  }

  function syncEditClock(complete) {
    if (!complete || !complete.state) return;
    var state = complete.state;
    var count = Number(state.changeCount || 0);

    if (editorUi.lastChangeCount === null) {
      editorUi.lastChangeCount = count;
      if (state.lastSavedAt) editorUi.lastEditAt = new Date(state.lastSavedAt);
      return;
    }

    if (count > editorUi.lastChangeCount) editorUi.lastEditAt = new Date();
    editorUi.lastChangeCount = count;

    if (!editorUi.lastEditAt && state.lastSavedAt) {
      editorUi.lastEditAt = new Date(state.lastSavedAt);
    }
  }

  function placeTopEditStatus(root, complete) {
    if (!root) return;
    syncEditClock(complete);

    var bottomStatus = root.querySelector('.ec-statusbar');
    if (bottomStatus) bottomStatus.remove();

    var actions = root.querySelector('.ec-actions');
    var publish = actions && actions.querySelector('[data-publish]');
    var status = root.querySelector('.ec-save-state');
    if (!actions || !publish || !status) return;

    if (status.parentNode !== actions || status.nextSibling !== publish) {
      actions.insertBefore(status, publish);
    }

    status.classList.add('ec-last-edit-state');
    var label = 'آخرین ویرایش: ' + relativeEditTime(editorUi.lastEditAt);
    if (status.textContent !== label) status.textContent = label;
  }

  function ensurePinkBoxInPreview(frame) {
    window.setTimeout(function () {
      try {
        var doc = frame.contentDocument;
        if (!doc || doc.querySelector('.sf-campaign-section')) return;
        if (doc.querySelector('script[data-panel-pinkbox-fallback]')) return;

        var script = doc.createElement('script');
        script.src = 'storefront-pinkbox-runtime.js?panelPreviewFix=' + encodeURIComponent(BUILD);
        script.dataset.panelPinkboxFallback = '1';
        script.onload = function () {
          try {
            frame.contentWindow.dispatchEvent(new Event('storefront:home-ready'));
          } catch (error) {}
        };
        (doc.body || doc.documentElement).appendChild(script);
      } catch (error) {}
    }, 2300);
  }

  function freshenPreview(root) {
    if (!root) return;
    var frame = root.querySelector('[data-preview-frame]');
    if (!frame || frame.dataset.completePreviewBuild === BUILD) return;
    frame.dataset.completePreviewBuild = BUILD;

    frame.addEventListener('load', function () {
      ensurePinkBoxInPreview(frame);
    });

    try {
      var current = new URL(frame.getAttribute('src') || '../index.html?editorPreview=1', location.href);
      if (current.searchParams.get('panelPreviewBuild') !== BUILD) {
        current.searchParams.set('panelPreviewBuild', BUILD);
        frame.src = current.href;
      } else {
        ensurePinkBoxInPreview(frame);
      }
    } catch (error) {
      ensurePinkBoxInPreview(frame);
    }
  }

  function enforceCompleteEditor() {
    if (routeName() !== ROUTE) return;
    ensureControlLabelsCSS();
    ensureLastEditCSS();
    var complete = completeEditor();
    if (!complete || !view) return;

    /* The legacy renderer can still be present for compatibility, but this route
       must always resolve to the approved complete renderer. */
    window.renderStorefrontEditor = complete.render;

    var root = view.querySelector('.store-editor-complete');
    if (!root) {
      complete.render(view);
      return;
    }

    placeTopEditStatus(root, complete);
    freshenPreview(root);
  }

  function schedule() {
    [0, 60, 240, 800].forEach(function (delay) {
      window.setTimeout(enforceCompleteEditor, delay);
    });
  }

  window.addEventListener('hashchange', schedule, true);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) schedule();
  });

  if (view && typeof MutationObserver !== 'undefined') {
    new MutationObserver(function () {
      if (routeName() === ROUTE) enforceCompleteEditor();
    }).observe(view, { childList: true, subtree: true });
  }

  if (!editorUi.timer) {
    editorUi.timer = window.setInterval(function () {
      if (routeName() === ROUTE) enforceCompleteEditor();
    }, 30000);
  }

  schedule();
}());
