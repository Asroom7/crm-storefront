(function () {
  'use strict';

  var INTRO_SESSION_KEY = 'crmBeautyIntroSeenV8';
  var CUE_AT_SECONDS = 3;
  var EXIT_MS = 1080;
  var VIDEO_RETRY_MS = 2200;
  var MAX_LOAD_RETRIES = 2;

  var intro = document.getElementById('cinematic-intro');
  if (!intro) return;

  var video = intro.querySelector('.cinematic-intro-video');
  var shell = document.getElementById('storefront-reveal-shell');
  var leaving = false;
  var ready = false;
  var frameReady = false;
  var loadRetries = 0;
  var retryTimer = 0;
  var startY = 0;
  var lastY = 0;
  var cleanupTimer = 0;

  function alreadySeen() {
    try { return sessionStorage.getItem(INTRO_SESSION_KEY) === '1'; }
    catch (e) { return false; }
  }

  function markSeen() {
    try { sessionStorage.setItem(INTRO_SESSION_KEY, '1'); }
    catch (e) {}
  }

  function cleanupTransition() {
    window.clearTimeout(cleanupTimer);
    window.clearTimeout(retryTimer);
    if (video) {
      try { video.pause(); } catch (e) {}
    }
    if (intro && intro.parentNode) intro.remove();
    document.body.classList.remove('cinematic-intro-active', 'cinematic-transition-stage', 'cinematic-transition-fallback-run');
    window.scrollTo(0, 0);
  }

  function removeIntroImmediately() {
    if (intro && intro.parentNode) intro.remove();
    document.body.classList.remove('cinematic-intro-active', 'cinematic-transition-stage', 'cinematic-transition-fallback-run');
  }

  if (alreadySeen()) {
    removeIntroImmediately();
    return;
  }

  document.body.classList.add('cinematic-intro-active');
  window.scrollTo(0, 0);

  function showCue() {
    if (ready || leaving) return;
    ready = true;
    intro.classList.add('ready');
  }

  function markFrameReady() {
    if (frameReady || leaving) return;
    frameReady = true;
    intro.classList.add('video-frame-ready');
  }

  function tryPlay() {
    if (!video || leaving || video.ended || video.readyState < 2) return;
    markFrameReady();
    var promise;
    try { promise = video.play(); } catch (e) { promise = null; }
    if (promise && typeof promise.catch === 'function') promise.catch(function () {});
  }

  function scheduleLoadRetry() {
    window.clearTimeout(retryTimer);
    retryTimer = window.setTimeout(function () {
      if (!video || leaving || frameReady || loadRetries >= MAX_LOAD_RETRIES) return;
      loadRetries += 1;
      try { video.load(); } catch (e) {}
      window.setTimeout(tryPlay, 80);
    }, VIDEO_RETRY_MS);
  }

  function runFallbackTransition() {
    document.body.classList.add('cinematic-transition-fallback-run');
    cleanupTimer = window.setTimeout(cleanupTransition, EXIT_MS + 120);
  }

  function runCompositorTransition() {
    if (!shell || typeof intro.animate !== 'function' || typeof shell.animate !== 'function') {
      runFallbackTransition();
      return;
    }

    var timing = {
      duration: EXIT_MS,
      easing: 'cubic-bezier(.22,1,.36,1)',
      fill: 'forwards'
    };

    var introAnimation;
    var shellAnimation;
    try {
      introAnimation = intro.animate([
        { transform: 'translate3d(0,0,0)', opacity: 1 },
        { transform: 'translate3d(0,-100%,0)', opacity: 0 }
      ], timing);

      shellAnimation = shell.animate([
        { transform: 'translate3d(0,100%,0)', opacity: 0.22 },
        { transform: 'translate3d(0,0,0)', opacity: 1 }
      ], timing);
    } catch (e) {
      runFallbackTransition();
      return;
    }

    var finished = 0;
    function oneFinished() {
      finished += 1;
      if (finished >= 2) cleanupTransition();
    }

    if (introAnimation && introAnimation.finished) introAnimation.finished.then(oneFinished).catch(oneFinished);
    else oneFinished();
    if (shellAnimation && shellAnimation.finished) shellAnimation.finished.then(oneFinished).catch(oneFinished);
    else oneFinished();

    cleanupTimer = window.setTimeout(cleanupTransition, EXIT_MS + 180);
  }

  function finishIntro(force) {
    if (leaving || (!ready && !force)) return;
    leaving = true;
    markSeen();
    window.clearTimeout(retryTimer);
    window.scrollTo(0, 0);

    /* Stage the storefront below the viewport with no transition attached.
       Force that start state to layout, then move both layers together on the
       compositor. This fixes the previous reversed staging animation. */
    document.body.classList.add('cinematic-transition-stage');
    if (shell) {
      shell.getBoundingClientRect();
      window.getComputedStyle(shell).transform;
    }
    intro.getBoundingClientRect();

    requestAnimationFrame(function () {
      requestAnimationFrame(runCompositorTransition);
    });
  }

  function prepareVideo() {
    if (!video) {
      showCue();
      return;
    }

    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    video.addEventListener('loadeddata', function () {
      markFrameReady();
      tryPlay();
    });
    video.addEventListener('canplay', tryPlay);
    video.addEventListener('playing', markFrameReady);
    video.addEventListener('timeupdate', function () {
      if (!ready && video.currentTime >= CUE_AT_SECONDS) showCue();
    });
    video.addEventListener('ended', function () {
      showCue();
      window.setTimeout(function () { finishIntro(true); }, 50);
    }, { once: true });

    video.addEventListener('waiting', function () {
      if (video.readyState >= 2) markFrameReady();
    });
    video.addEventListener('stalled', function () {
      if (video.readyState >= 2) markFrameReady();
      if (!frameReady) scheduleLoadRetry();
    });
    video.addEventListener('error', function () {
      if (!frameReady) scheduleLoadRetry();
    });

    if (video.readyState >= 2) markFrameReady();
    tryPlay();
    scheduleLoadRetry();
  }

  function scrollIntent(delta) {
    if (!ready || leaving) return;
    if (delta > 10) finishIntro(false);
  }

  intro.addEventListener('wheel', function (event) {
    if (!ready) {
      event.preventDefault();
      return;
    }
    if (event.deltaY > 0) {
      event.preventDefault();
      scrollIntent(event.deltaY);
    }
  }, { passive: false });

  intro.addEventListener('touchstart', function (event) {
    if (!event.touches || !event.touches.length) return;
    startY = event.touches[0].clientY;
    lastY = startY;
  }, { passive: true });

  intro.addEventListener('touchmove', function (event) {
    if (!event.touches || !event.touches.length) return;
    lastY = event.touches[0].clientY;
    if (ready && startY - lastY > 18) {
      event.preventDefault();
      finishIntro(false);
    }
  }, { passive: false });

  intro.addEventListener('touchend', function () {
    if (ready && startY - lastY > 40) finishIntro(false);
    startY = 0;
    lastY = 0;
  }, { passive: true });

  intro.addEventListener('click', function (event) {
    var cue = event.target.closest('.cinematic-intro-scroll');
    if (cue && ready) finishIntro(false);
  });

  intro.addEventListener('keydown', function (event) {
    if (!ready) return;
    if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      finishIntro(false);
    }
  });

  window.addEventListener('online', function () {
    if (!leaving) {
      if (!frameReady && video) {
        try { video.load(); } catch (e) {}
      }
      window.setTimeout(tryPlay, 80);
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !leaving) window.setTimeout(tryPlay, 60);
  });

  prepareVideo();
})();
