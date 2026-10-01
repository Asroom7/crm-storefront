/* Primary storefront flow: legacy fallback order only. Editor-managed layouts keep their saved order. */
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

  function preparePinkBox(campaign) {
    if (!campaign) return;
    campaign.classList.add('sf-pink-box');
    campaign.setAttribute('data-section-role', 'pink-box');

    const heading = campaign.querySelector('.sf-section-head h2');
    if (heading && !heading.textContent.trim()) heading.textContent = 'جعبه صورتی';

    const allLink = campaign.querySelector('.sf-section-head>a');
    if (allLink && !allLink.textContent.trim()) allLink.innerHTML = 'مشاهده همه <span>‹</span>';

    const head = campaign.querySelector('.sf-section-head');
    const campaignSection = campaign.closest('[data-section-id]');
    const wantsTimer = !campaignSection || !campaignSection.dataset.hideTimer;
    if (wantsTimer && head && !head.querySelector('.sf-countdown')) {
      const countdown = document.createElement('div');
      countdown.className = 'sf-countdown sf-countdown-placeholder';
      countdown.setAttribute('aria-label', 'زمان باقی‌مانده پیشنهاد');
      countdown.innerHTML = '<span>تا پایان پیشنهاد</span><strong>--:--:--</strong>';
      const anchor = head.querySelector('a');
      head.insertBefore(countdown, anchor || null);
    }
  }

  function applyPrimaryFlow() {
    queued = false;

    const pinkBox = root.querySelector('.sf-campaign-section');
    preparePinkBox(pinkBox);

    /* Once the visual editor runtime owns the page, saved drag/drop order is authoritative. */
    if (root.dataset.editorManagedOrder === '1' || root.querySelector('[data-section-id]')) return;

    const searchSection = root.querySelector('.sf-search-block');
    const magicBox = root.querySelector('.sf-video-section');
    const bestSellers = root.querySelector('.sf-best-sellers');
    const categories = root.querySelector('#sf-categories');

    if (searchSection && magicBox) placeAfter(magicBox, searchSection);
    if (magicBox && bestSellers) placeAfter(bestSellers, magicBox);
    if (bestSellers && pinkBox) placeAfter(pinkBox, bestSellers);
    if (pinkBox && categories) placeAfter(categories, pinkBox);
  }

  function schedulePrimaryFlow() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(applyPrimaryFlow);
  }

  window.addEventListener('storefront:home-ready', schedulePrimaryFlow);
  new MutationObserver(schedulePrimaryFlow).observe(root, { childList: true });
  schedulePrimaryFlow();
})();
