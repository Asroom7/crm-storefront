/* Primary storefront flow: search -> magic box -> best sellers. */
(function () {
  'use strict';

  const root = document.getElementById('storefront-home-root');
  if (!root) return;

  let queued = false;

  function placeAfter(node, anchor) {
    if (!node || !anchor || node === anchor) return;
    if (anchor.nextElementSibling === node) return;
    root.insertBefore(node, anchor.nextElementSibling);
  }

  function applyPrimaryFlow() {
    queued = false;

    const categorySection = root.querySelector('#sf-categories');
    if (categorySection) categorySection.remove();

    const searchSection = root.querySelector('.sf-search-block');
    const magicBox = root.querySelector('.sf-video-section');
    const bestSellers = root.querySelector('.sf-best-sellers');

    if (searchSection && magicBox) placeAfter(magicBox, searchSection);
    if (magicBox && bestSellers) placeAfter(bestSellers, magicBox);
  }

  function schedulePrimaryFlow() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(applyPrimaryFlow);
  }

  window.addEventListener('storefront:home-ready', schedulePrimaryFlow);

  new MutationObserver(function () {
    schedulePrimaryFlow();
  }).observe(root, { childList: true });

  schedulePrimaryFlow();
})();
