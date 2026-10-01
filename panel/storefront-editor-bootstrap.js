/* Deterministic boot/preview bridge for the approved complete storefront editor.
   Panel-only: never mutates storefront source files. */
(function () {
  'use strict';

  var ROUTE = 'storefront-editor';
  var BUILD = '20261001-complete-v5';
  var view = document.getElementById('view');

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

  function completeEditor() {
    return window.StorefrontEditorComplete && typeof window.StorefrontEditorComplete.render === 'function'
      ? window.StorefrontEditorComplete
      : null;
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

  schedule();
}());
