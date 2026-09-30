/* Final runtime QA safeguards for accessibility and low-cost media behavior. */
(function () {
  'use strict';

  function setupMenuAccessibility() {
    const toggle = document.querySelector('.menu-toggle');
    const close = document.querySelector('.close-menu');
    const menu = document.querySelector('.side-menu');
    const overlay = document.querySelector('.side-menu-overlay');
    if (!toggle || !menu) return;

    function sync(open) {
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.setAttribute('aria-hidden', open ? 'false' : 'true');
      if (overlay) overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    }

    function isOpen() { return menu.classList.contains('open'); }
    sync(isOpen());

    const observer = new MutationObserver(function () { sync(isOpen()); });
    observer.observe(menu, { attributes: true, attributeFilter: ['class'] });

    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape' || !isOpen()) return;
      menu.classList.remove('open');
      if (overlay) overlay.classList.remove('open');
      sync(false);
      toggle.focus();
    });

    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () { sync(false); });
    });

    if (close) {
      close.addEventListener('click', function () {
        window.setTimeout(function () { sync(false); toggle.focus(); }, 0);
      });
    }
  }

  function setupVideoPerformance() {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        const video = entry.target;
        if (!entry.isIntersecting && !video.paused) video.pause();
      });
    }, { rootMargin: '160px 0px' });

    function observeVideos(root) {
      (root || document).querySelectorAll('.sf-video-card video').forEach(function (video) {
        if (video.dataset.qaObserved === '1') return;
        video.dataset.qaObserved = '1';
        observer.observe(video);
      });
    }

    observeVideos(document);
    window.addEventListener('storefront:home-ready', function () { observeVideos(document); });
    window.addEventListener('message', function (event) {
      if (event.origin === window.location.origin && event.data && event.data.type === 'storefront-preview-config') {
        window.setTimeout(function () { observeVideos(document); }, 0);
      }
    });
  }

  function setupImageFailureFallbacks() {
    document.addEventListener('error', function (event) {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || image.dataset.qaImageFailed === '1') return;
      if (!image.closest('.sf-product-media, .sf-category-visual, .sf-hero-product-frame, .sf-promo-banner')) return;
      image.dataset.qaImageFailed = '1';
      image.style.visibility = 'hidden';
      image.parentElement && image.parentElement.classList.add('is-media-unavailable');
    }, true);
  }

  function setupSkipLink() {
    const skip = document.querySelector('.skip-link');
    const main = document.getElementById('storefront-home-root');
    if (!skip || !main) return;
    skip.addEventListener('click', function () {
      window.setTimeout(function () { main.focus({ preventScroll: true }); }, 0);
    });
  }

  function boot() {
    setupMenuAccessibility();
    setupVideoPerformance();
    setupImageFailureFallbacks();
    setupSkipLink();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
