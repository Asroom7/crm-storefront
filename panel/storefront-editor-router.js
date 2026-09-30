/* Bridge the legacy hash router without rewriting panel/app.js. */
(function () {
  'use strict';
  if (typeof router !== 'function' || typeof window.renderStorefrontEditor !== 'function') return;
  const baseRouter = router;
  router = async function () {
    const routeName = location.hash.replace(/^#\/?/, '').split('/')[0];
    if (routeName === 'storefront-editor') {
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
})();
