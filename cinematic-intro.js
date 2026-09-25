(function () {
  'use strict';

  var INTRO_SESSION_KEY = 'crmBeautyIntroSeenV9';
  var CUE_AT_SECONDS = 3;
  var HANDOFF_MS = 1000;
  var HANDOFF_EASING = 'cubic-bezier(.42,0,.58,1)';
  var VIDEO_RETRY_MS = 2200;
  var MAX_LOAD_RETRIES = 2;
  var NO_VIDEO_CUE_MS = 6000;

  var intro = document.getElementById('cinematic-intro');
  if (!intro) return;

  var video = intro.querySelector('.cinematic-intro-video');
  var shell = document.getElementById('storefront-reveal-shell');
  var leaving = false;
  var ready = false;
  var frameReady = false;
  var loadRetries = 0;
  var retryTimer = 0;
  var noVideoCueTimer = 0;
  var cleanupTimer = 0;
  var cleanupDone = false;
  var startY = 0;
  var lastY = 0;
  var activeAnimations = [];

  function alreadySeen() {
    try { return sessionStorage.getItem(INTRO_SESSION_KEY) === '1'; }
    catch (e) { return false; }
  }

  function markSeen() {
    try { sessionStorage.setItem(INTRO_SESSION_KEY, '1'); }
    catch (e) {}
  }

  function cancelAnimations() {
    activeAnimations.forEach(function (animation) {
      try { animation.cancel(); } catch (e) {}
    });
    activeAnimations = [];
  }

  function cleanupTransition() {
    if (cleanupDone) return;
    cleanupDone = true;

    window.clearTimeout(cleanupTimer);
    window.clearTimeout(retryTimer);
    window.clearTimeout(noVideoCueTimer);

    if (video) {
      try { video.pause(); } catch (e) {}
    }

    if (intro && intro.parentNode) intro.remove();

    /* Remove the staging state first. At this point the storefront animation
       is already at translateY(0) / opacity 1, so returning it to normal flow
       is visually identical and cannot flash. */
    document.body.classList.remove(
      'cinematic-intro-active',
      'cinematic-transition-fallback-run'
    );

    cancelAnimations();
    window.scrollTo(0, 0);
  }

  function removeIntroImmediately() {
    if (intro && intro.parentNode) intro.remove();
    document.body.classList.remove(
      'cinematic-intro-active',
      'cinematic-transition-fallback-run'
    );
    window.scrollTo(0, 0);
  }

  if (alreadySeen()) {
    removeIntroImmediately();
    return;
  }

  /* This class stages the real storefront one viewport below the screen for
     the whole intro, so no layout/setup work is needed when the handoff starts. */
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
    window.clearTimeout(noVideoCueTimer);
  }

  function tryPlay() {
    if (!video || leaving || video.ended || video.readyState < 2) return;
    markFrameReady();

    var promise;
    try { promise = video.play(); } catch (e) { promise = null; }
    if (promise && typeof promise.catch === 'function') {
      promise.catch(function () {});
    }
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
    cleanupTimer = window.setTimeout(cleanupTransition, HANDOFF_MS + 80);
  }

  function runExactHandoff() {
    if (!shell || typeof intro.animate !== 'function' || typeof shell.animate !== 'function') {
      runFallbackTransition();
      return;
    }

    var introAnimation;
    var shellAnimation;

    try {
      /* Intro stays completely stationary. Only its opacity changes. */
      introAnimation = intro.animate([
        { opacity: 1 },
        { opacity: 0 }
      ], {
        duration: HANDOFF_MS,
        easing: HANDOFF_EASING,
        fill: 'forwards'
      });

      /* Storefront starts exactly one viewport below and rises into place while
         becoming visible during the same 1000ms interval. */
      shellAnimation = shell.animate([
        { transform: 'translate3d(0,100%,0)', opacity: 0 },
        { transform: 'translate3d(0,0,0)', opacity: 1 }
      ], {
        duration: HANDOFF_MS,
        easing: HANDOFF_EASING,
        fill: 'forwards'
      });

      /* Give both animations the exact same document-timeline start time so
         their first and last frames are synchronized, not merely similar. */
      var sharedStart = document.timeline && document.timeline.currentTime;
      if (typeof sharedStart === 'number') {
        introAnimation.startTime = sharedStart;
        shellAnimation.startTime = sharedStart;
      }

      activeAnimations = [introAnimation, shellAnimation];
    } catch (e) {
      runFallbackTransition();
      return;
    }

    var finishedCount = 0;
    function animationFinished() {
      finishedCount += 1;
      if (finishedCount === 2) cleanupTransition();
    }

    introAnimation.finished.then(animationFinished).catch(animationFinished);
    shellAnimation.finished.then(animationFinished).catch(animationFinished);

    /* Safety only. Normal cleanup is driven by both 1000ms animations ending. */
    cleanupTimer = window.setTimeout(cleanupTransition, HANDOFF_MS + 120);
  }

  function finishIntro(force) {
    if (leaving || (!ready && !force)) return;

    leaving = true;
    markSeen();
    window.clearTimeout(retryTimer);
    window.clearTimeout(noVideoCueTimer);
    window.scrollTo(0, 0);

    if (video) {
      try { video.pause(); } catch (e) {}
    }

    /* No native scrolling and no staging/layout work occurs here. The
       storefront has already been sitting below the viewport since intro load. */
    runExactHandoff();
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

    /* The automatic handoff begins immediately when the video actually ends. */
    video.addEventListener('ended', function () {
      showCue();
      finishIntro(true);
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

    /* If the browser cannot start the video at all, do not trap the visitor.
       The manual cue is exposed while the existing poster remains visible. */
    noVideoCueTimer = window.setTimeout(function () {
      if (!frameReady && !leaving) showCue();
    }, NO_VIDEO_CUE_MS);
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
