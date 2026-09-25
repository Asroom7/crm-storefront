(function () {
  'use strict';

  var INTRO_SESSION_KEY = 'crmBeautyIntroSeenV4';
  var INTRO_MIN_MS = 3000;
  var POSTER_FALLBACK_MS = 10000;
  var intro = document.getElementById('cinematic-intro');
  if (!intro) return;

  var video = intro.querySelector('.cinematic-intro-video');
  var shell = document.getElementById('storefront-reveal-shell');
  var leaving = false;
  var ready = false;
  var videoStarted = false;
  var startY = 0;
  var lastY = 0;
  var introStartedAt = performance.now();
  var fallbackTimer = 0;

  function alreadySeen() {
    try { return sessionStorage.getItem(INTRO_SESSION_KEY) === '1'; }
    catch (e) { return false; }
  }

  function markSeen() {
    try { sessionStorage.setItem(INTRO_SESSION_KEY, '1'); }
    catch (e) {}
  }

  function revokeVideoBlob() {
    var blobUrl = window.CINEMATIC_BEAUTY_VIDEO_BLOB_URL;
    if (!blobUrl) return;
    try { URL.revokeObjectURL(blobUrl); } catch (e) {}
    window.CINEMATIC_BEAUTY_VIDEO_BLOB_URL = '';
  }

  function removeIntroImmediately() {
    intro.hidden = true;
    intro.remove();
    document.body.classList.remove('cinematic-intro-active');
    if (window.CINEMATIC_BEAUTY_VIDEO_PROMISE) {
      window.CINEMATIC_BEAUTY_VIDEO_PROMISE.then(function () {
        revokeVideoBlob();
      }).catch(function () {});
    }
  }

  if (alreadySeen()) {
    removeIntroImmediately();
    return;
  }

  document.body.classList.add('cinematic-intro-active');

  function setReady() {
    if (ready) return;
    var elapsed = performance.now() - introStartedAt;
    if (elapsed < INTRO_MIN_MS) {
      window.setTimeout(setReady, INTRO_MIN_MS - elapsed);
      return;
    }
    ready = true;
    intro.classList.add('ready');
  }

  function schedulePosterFallback() {
    window.clearTimeout(fallbackTimer);
    fallbackTimer = window.setTimeout(function () {
      if (!videoStarted) setReady();
    }, POSTER_FALLBACK_MS);
  }

  function startVideo(src) {
    if (!video || !src) {
      schedulePosterFallback();
      return;
    }

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.src = src;
    video.preload = 'auto';
    video.load();

    function showVideo() {
      if (videoStarted || video.readyState < 2) return;
      videoStarted = true;
      window.clearTimeout(fallbackTimer);

      var playPromise = video.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(function () {
          intro.classList.add('has-video');
        }).catch(function () {
          videoStarted = false;
          intro.classList.remove('has-video');
          schedulePosterFallback();
        });
      } else {
        intro.classList.add('has-video');
      }
    }

    video.addEventListener('loadeddata', showVideo, { once: true });
    video.addEventListener('canplay', showVideo, { once: true });
    video.addEventListener('playing', function () {
      intro.classList.add('has-video');
    }, { once: true });
    video.addEventListener('ended', function () {
      window.clearTimeout(fallbackTimer);
      setReady();
    }, { once: true });
    video.addEventListener('error', function () {
      videoStarted = false;
      intro.classList.remove('has-video');
      schedulePosterFallback();
    }, { once: true });

    window.setTimeout(showVideo, 180);
  }

  function tryVideo() {
    if (window.CINEMATIC_BEAUTY_VIDEO_PROMISE) {
      window.CINEMATIC_BEAUTY_VIDEO_PROMISE.then(startVideo).catch(function () {
        schedulePosterFallback();
      });
      return;
    }
    schedulePosterFallback();
  }

  function finishIntro() {
    if (!ready || leaving) return;
    leaving = true;
    markSeen();

    if (video) {
      try { video.pause(); } catch (e) {}
    }

    intro.classList.add('is-leaving');
    document.body.classList.remove('cinematic-intro-active');
    if (shell) shell.classList.add('cinematic-revealing');

    window.setTimeout(function () {
      if (intro && intro.parentNode) intro.remove();
      if (shell) shell.classList.remove('cinematic-revealing');
      window.scrollTo(0, 0);
      revokeVideoBlob();
    }, 520);
  }

  function scrollIntent(delta) {
    if (!ready || leaving) return;
    if (delta > 12) finishIntro();
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
      finishIntro();
    }
  }, { passive: false });

  intro.addEventListener('touchend', function () {
    if (ready && startY - lastY > 42) finishIntro();
    startY = 0;
    lastY = 0;
  }, { passive: true });

  intro.addEventListener('click', function (event) {
    var cue = event.target.closest('.cinematic-intro-scroll');
    if (cue && ready) finishIntro();
  });

  intro.addEventListener('keydown', function (event) {
    if (!ready) return;
    if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      finishIntro();
    }
  });

  schedulePosterFallback();
  tryVideo();
})();
