(function () {
  'use strict';

  var INTRO_SESSION_KEY = 'crmBeautyIntroSeenV5';
  var CUE_AT_SECONDS = 3;
  var EXIT_MS = 920;
  var POSTER_FALLBACK_MS = 3500;
  var intro = document.getElementById('cinematic-intro');
  if (!intro) return;

  var video = intro.querySelector('.cinematic-intro-video');
  var source = video && video.querySelector('source');
  var shell = document.getElementById('storefront-reveal-shell');
  var leaving = false;
  var ready = false;
  var videoStarted = false;
  var startY = 0;
  var lastY = 0;
  var fallbackTimer = 0;

  function alreadySeen() {
    try { return sessionStorage.getItem(INTRO_SESSION_KEY) === '1'; }
    catch (e) { return false; }
  }

  function markSeen() {
    try { sessionStorage.setItem(INTRO_SESSION_KEY, '1'); }
    catch (e) {}
  }

  function removeIntroImmediately() {
    intro.hidden = true;
    intro.remove();
    document.body.classList.remove('cinematic-intro-active');
  }

  if (alreadySeen()) {
    removeIntroImmediately();
    return;
  }

  document.body.classList.add('cinematic-intro-active');

  function showCue() {
    if (ready || leaving) return;
    ready = true;
    intro.classList.add('ready');
  }

  function schedulePosterFallback() {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = window.setTimeout(function () {
      if (!videoStarted) showCue();
    }, POSTER_FALLBACK_MS);
  }

  function finishIntro(force) {
    if (leaving || (!ready && !force)) return;
    leaving = true;
    markSeen();
    window.clearTimeout(fallbackTimer);

    if (video) {
      try { video.pause(); } catch (e) {}
    }

    intro.classList.add('is-leaving');
    document.body.classList.remove('cinematic-intro-active');
    if (shell) shell.classList.add('cinematic-revealing');

    window.setTimeout(function () {
      if (intro && intro.parentNode) intro.remove();
      if (shell) shell.classList.remove('cinematic-revealing');
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, EXIT_MS + 40);
  }

  function startVideo() {
    if (!video || !source) {
      schedulePosterFallback();
      return;
    }

    var baseSrc = source.getAttribute('src');
    if (!baseSrc) {
      schedulePosterFallback();
      return;
    }

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';
    video.src = baseSrc + '?v=20260925-2240';
    video.load();

    function tryPlay() {
      if (videoStarted || video.readyState < 2) return;
      var playPromise = video.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(function () {
          videoStarted = true;
          window.clearTimeout(fallbackTimer);
          intro.classList.add('has-video');
        }).catch(function () {
          videoStarted = false;
          intro.classList.remove('has-video');
          schedulePosterFallback();
        });
      } else {
        videoStarted = true;
        window.clearTimeout(fallbackTimer);
        intro.classList.add('has-video');
      }
    }

    video.addEventListener('loadeddata', tryPlay, { once: true });
    video.addEventListener('canplay', tryPlay, { once: true });
    video.addEventListener('playing', function () {
      videoStarted = true;
      window.clearTimeout(fallbackTimer);
      intro.classList.add('has-video');
    });
    video.addEventListener('timeupdate', function () {
      if (!ready && video.currentTime >= CUE_AT_SECONDS) showCue();
    });
    video.addEventListener('ended', function () {
      showCue();
      window.setTimeout(function () { finishIntro(true); }, 60);
    }, { once: true });
    video.addEventListener('error', function () {
      videoStarted = false;
      intro.classList.remove('has-video');
      schedulePosterFallback();
    }, { once: true });

    window.setTimeout(tryPlay, 120);
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

  schedulePosterFallback();
  startVideo();
})();
