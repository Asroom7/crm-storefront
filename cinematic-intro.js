(function () {
  'use strict';

  var INTRO_SESSION_KEY = 'crmBeautyIntroSeenV7';
  var CUE_AT_SECONDS = 3;
  var EXIT_MS = 1120;
  var FINAL_FALLBACK_MS = 12000;
  var MEDIA_VERSION = '20260925-v7b';

  var intro = document.getElementById('cinematic-intro');
  if (!intro) return;

  var video = intro.querySelector('.cinematic-intro-video');
  var source = video && video.querySelector('source');
  var shell = document.getElementById('storefront-reveal-shell');
  var leaving = false;
  var ready = false;
  var videoStarted = false;
  var frameReady = false;
  var startY = 0;
  var lastY = 0;
  var finalFallbackTimer = 0;
  var blobFallbackStarted = false;
  var objectUrl = '';
  var nativeUrl = '';

  function alreadySeen() {
    try { return sessionStorage.getItem(INTRO_SESSION_KEY) === '1'; }
    catch (e) { return false; }
  }

  function markSeen() {
    try { sessionStorage.setItem(INTRO_SESSION_KEY, '1'); }
    catch (e) {}
  }

  function revokeObjectUrl() {
    if (!objectUrl) return;
    try { URL.revokeObjectURL(objectUrl); } catch (e) {}
    objectUrl = '';
  }

  function removeIntroImmediately() {
    intro.hidden = true;
    intro.remove();
    document.body.classList.remove('cinematic-intro-active', 'cinematic-transition-stage', 'cinematic-transition-run');
    revokeObjectUrl();
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

  function markVideoPlaying() {
    if (leaving) return;
    videoStarted = true;
    markFrameReady();
    window.clearTimeout(finalFallbackTimer);
    intro.classList.add('has-video');
  }

  function attemptPlay() {
    if (!video || leaving || video.ended) return;
    if (video.readyState >= 2) markFrameReady();
    if (videoStarted && !video.paused) return;
    if (video.readyState < 2) return;

    var playPromise;
    try { playPromise = video.play(); } catch (e) { playPromise = null; }

    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(markVideoPlaying).catch(function () {
        if (!blobFallbackStarted) startBlobFallback();
      });
    } else if (!video.paused) {
      markVideoPlaying();
    }
  }

  function loadBlobAttempt(url, attempt) {
    if (leaving || (videoStarted && !video.paused)) return;

    var requestUrl = url + (url.indexOf('?') === -1 ? '?' : '&') + 'blobtry=' + attempt;
    fetch(requestUrl, {
      cache: attempt === 1 ? 'force-cache' : 'reload',
      credentials: 'same-origin'
    }).then(function (response) {
      if (!response.ok) throw new Error('video fetch failed');
      return response.blob();
    }).then(function (blob) {
      if (leaving || (videoStarted && !video.paused)) return;
      revokeObjectUrl();
      objectUrl = URL.createObjectURL(blob);
      video.src = objectUrl;
      video.preload = 'auto';
      video.load();
      window.setTimeout(attemptPlay, 40);
    }).catch(function () {
      if (attempt < 3 && !leaving && !videoStarted) {
        window.setTimeout(function () { loadBlobAttempt(url, attempt + 1); }, attempt === 1 ? 500 : 1200);
      }
    });
  }

  function startBlobFallback() {
    if (blobFallbackStarted || leaving || !source) return;
    blobFallbackStarted = true;
    var baseSrc = source.getAttribute('src');
    if (!baseSrc) return;
    var url = baseSrc + (baseSrc.indexOf('?') === -1 ? '?' : '&') + 'v=' + MEDIA_VERSION;
    loadBlobAttempt(url, 1);
  }

  function retryNativeAfterNetworkReturn() {
    if (!video || leaving || video.ended || (videoStarted && !video.paused)) return;
    if (objectUrl) {
      attemptPlay();
      return;
    }
    if (!nativeUrl) return;
    try {
      video.src = nativeUrl;
      video.preload = 'auto';
      video.load();
    } catch (e) {}
    window.setTimeout(attemptPlay, 100);
    window.setTimeout(attemptPlay, 500);
  }

  function finishIntro(force) {
    if (leaving || (!ready && !force)) return;
    leaving = true;
    markSeen();
    window.clearTimeout(finalFallbackTimer);

    if (video) {
      try { video.pause(); } catch (e) {}
    }

    window.scrollTo(0, 0);

    /* First stage the real storefront one viewport below. Waiting two RAFs
       guarantees the browser paints that starting position before both layers
       move. The intro then fades while travelling upward and the storefront
       rises from below at the same time. */
    document.body.classList.add('cinematic-transition-stage');

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        document.body.classList.add('cinematic-transition-run');
      });
    });

    window.setTimeout(function () {
      window.scrollTo(0, 0);
      if (intro && intro.parentNode) intro.remove();
      document.body.classList.remove('cinematic-transition-run', 'cinematic-transition-stage', 'cinematic-intro-active');
      revokeObjectUrl();
    }, EXIT_MS + 90);
  }

  function startVideo() {
    if (!video || !source) {
      finalFallbackTimer = window.setTimeout(showCue, FINAL_FALLBACK_MS);
      return;
    }

    var baseSrc = source.getAttribute('src');
    if (!baseSrc) {
      finalFallbackTimer = window.setTimeout(showCue, FINAL_FALLBACK_MS);
      return;
    }

    nativeUrl = baseSrc + (baseSrc.indexOf('?') === -1 ? '?' : '&') + 'v=' + MEDIA_VERSION;

    video.muted = true;
    video.defaultMuted = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('autoplay', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';

    video.addEventListener('loadeddata', function () {
      markFrameReady();
      attemptPlay();
    });
    video.addEventListener('canplay', function () {
      markFrameReady();
      attemptPlay();
    });
    video.addEventListener('playing', markVideoPlaying);
    video.addEventListener('timeupdate', function () {
      if (!ready && video.currentTime >= CUE_AT_SECONDS) showCue();
    });
    video.addEventListener('ended', function () {
      showCue();
      window.setTimeout(function () { finishIntro(true); }, 50);
    }, { once: true });

    /* Never drop back to the poster on waiting/stalled. The last decoded frame
       remains visible. A Blob retry is only started when native loading is not
       producing playable frames. */
    video.addEventListener('waiting', function () {
      if (video.readyState >= 2) markFrameReady();
    });
    video.addEventListener('stalled', function () {
      if (video.readyState >= 2) markFrameReady();
      if (!videoStarted) window.setTimeout(startBlobFallback, 450);
    });
    video.addEventListener('error', function () {
      if (!leaving) startBlobFallback();
    });

    video.src = nativeUrl;
    video.load();

    window.setTimeout(attemptPlay, 40);
    window.setTimeout(attemptPlay, 180);
    window.setTimeout(attemptPlay, 600);
    window.setTimeout(function () {
      if (!videoStarted && !leaving) startBlobFallback();
    }, 1800);

    finalFallbackTimer = window.setTimeout(function () {
      if (!videoStarted && !leaving) showCue();
    }, FINAL_FALLBACK_MS);
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
    if (ready && startY - lastY > 20) {
      event.preventDefault();
      finishIntro(false);
    }
  }, { passive: false });

  intro.addEventListener('touchend', function () {
    if (ready && startY - lastY > 42) finishIntro(false);
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

  window.addEventListener('online', retryNativeAfterNetworkReturn);
  window.addEventListener('pageshow', function () {
    if (!leaving) window.setTimeout(attemptPlay, 30);
  });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && !leaving) window.setTimeout(attemptPlay, 30);
  });

  startVideo();
})();
