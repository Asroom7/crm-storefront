(function () {
  'use strict';

  var root = document.documentElement;

  function syncViewportHeight() {
    var height = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    if (!height || !isFinite(height)) return;
    root.style.setProperty('--panel-vvh', Math.max(320, Math.round(height)) + 'px');
  }

  function getActiveModal() {
    var wrap = document.getElementById('modalWrap');
    if (!wrap) return null;
    return wrap.querySelector('.modal');
  }

  function resetModalToTop(modal) {
    if (!modal || modal.dataset.scrollPrepared === '1') return;
    modal.dataset.scrollPrepared = '1';

    var reset = function () {
      modal.scrollTop = 0;
      if (typeof modal.scrollTo === 'function') {
        try { modal.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch (e) { modal.scrollTo(0, 0); }
      }
    };

    requestAnimationFrame(reset);
    setTimeout(reset, 60);
  }

  function syncModalState() {
    var modal = getActiveModal();
    var isOpen = !!modal;
    root.classList.toggle('modal-open', isOpen);
    document.body.classList.toggle('modal-open', isOpen);
    if (modal) resetModalToTop(modal);
  }

  var observer = new MutationObserver(function () {
    syncModalState();
  });

  observer.observe(document.body, { childList: true });

  document.addEventListener('focusin', function (event) {
    var target = event.target;
    if (!target || !target.closest) return;
    var modal = target.closest('.modal');
    if (!modal) return;

    setTimeout(function () {
      try {
        target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
      } catch (e) {
        target.scrollIntoView(false);
      }
    }, 120);
  });

  syncViewportHeight();
  syncModalState();
  window.addEventListener('resize', syncViewportHeight, { passive: true });
  window.addEventListener('orientationchange', syncViewportHeight, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', syncViewportHeight, { passive: true });
    window.visualViewport.addEventListener('scroll', syncViewportHeight, { passive: true });
  }
})();
