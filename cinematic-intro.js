(function () {
  'use strict';

  var INTRO_SESSION_KEY = 'crmBeautyIntroSeenV1';
  var INTRO_MIN_MS = 3000;
  var INTRO_READY_FALLBACK_MS = 3200;
  var intro = document.getElementById('cinematic-intro');
  if (!intro) return;

  var video = intro.querySelector('.cinematic-intro-video');
  var shell = document.getElementById('storefront-reveal-shell');
  var leaving = false;
  var ready = false;
  var startY = 0;
  var lastY = 0;
  var introStartedAt = performance.now();

  function alreadySeen() {
    try { return sessionStorage.getItem(INTRO_SESSION_KEY) === '1'; }
    catch (e) { return false; }
  }

  function markSeen() {
    try { sessionStorage.setItem(INTRO_SESSION_KEY, '1'); }
    catch (e) { /* sessionStorage can be unavailable in strict privacy modes */ }
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

  function tryVideo() {
    if (!video) return;
    var source = video.querySelector('source');
    if (!source || !source.getAttribute('src')) return;

    function showVideo() {
      intro.classList.add('has-video');
      var playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(function () {
          intro.classList.remove('has-video');
        });
      }
    }

    video.addEventListener('loadeddata', showVideo, { once: true });
    video.addEventListener('ended', setReady, { once: true });
    video.addEventListener('error', function () {
      intro.classList.remove('has-video');
    }, { once: true });

    window.setTimeout(function () {
      if (video.readyState >= 2) showVideo();
    }, 180);
  }

  function finishIntro() {
    if (!ready || leaving) return;
    leaving = true;
    markSeen();
    intro.classList.add('is-leaving');
    document.body.classList.remove('cinematic-intro-active');
    if (shell) shell.classList.add('cinematic-revealing');

    window.setTimeout(function () {
      if (intro && intro.parentNode) intro.remove();
      if (shell) {
        window.setTimeout(function () { shell.classList.remove('cinematic-revealing'); }, 120);
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    }, 850);
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

  window.setTimeout(setReady, INTRO_READY_FALLBACK_MS);
  tryVideo();
})();
