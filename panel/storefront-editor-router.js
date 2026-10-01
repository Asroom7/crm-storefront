/* Bridge the legacy hash router without rewriting panel/app.js. */
(function () {
  'use strict';
  if (typeof router !== 'function' || typeof window.renderStorefrontEditor !== 'function') return;

  const baseRouter = router;
  let bestSellerEnhancerPromise = null;

  function ensureBestSellerEnhancer() {
    if (bestSellerEnhancerPromise) return bestSellerEnhancerPromise;
    if (!document.querySelector('link[data-bestseller-editor-css]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'storefront-bestsellers-editor.css?v=20260930-v1';
      link.dataset.bestsellerEditorCss = '1';
      document.head.appendChild(link);
    }
    bestSellerEnhancerPromise = new Promise(function (resolve) {
      if (document.querySelector('script[data-bestseller-editor-js]')) return resolve();
      const script = document.createElement('script');
      script.src = 'storefront-bestsellers-editor.js?v=20260930-v1';
      script.dataset.bestsellerEditorJs = '1';
      script.onload = resolve;
      script.onerror = resolve;
      document.head.appendChild(script);
    });
    return bestSellerEnhancerPromise;
  }

  router = async function () {
    const routeName = location.hash.replace(/^#\/?/, '').split('/')[0];
    if (routeName === 'storefront-editor') {
      await ensureBestSellerEnhancer();
      if (typeof closeMenu === 'function') closeMenu();
      if (typeof renderNav === 'function') renderNav('settings');
      const view = document.getElementById('view');
      if (view) {
        view.scrollTop = 0;
        return window.renderStorefrontEditor(view);
      }
      return;
    }
    return baseRouter();
  };

  if (location.hash.replace(/^#\/?/, '').split('/')[0] === 'storefront-editor') ensureBestSellerEnhancer();
})();