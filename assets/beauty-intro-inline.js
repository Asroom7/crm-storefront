(function () {
  'use strict';

  var parts = [
    'assets/beauty-intro-b64-01.txt',
    'assets/beauty-intro-b64-02.txt',
    'assets/beauty-intro-b64-03.txt',
    'assets/beauty-intro-b64-04.txt',
    'assets/beauty-intro-b64-05.txt',
    'assets/beauty-intro-b64-06.txt',
    'assets/beauty-intro-b64-07.txt',
    'assets/beauty-intro-b64-08.txt'
  ];

  window.CINEMATIC_BEAUTY_VIDEO_PROMISE = Promise.all(parts.map(function (url) {
    return fetch(url, { cache: 'force-cache' }).then(function (response) {
      if (!response.ok) throw new Error('intro chunk failed: ' + response.status);
      return response.text();
    });
  })).then(function (chunks) {
    var base64 = chunks.join('').replace(/\s+/g, '');
    if (base64.slice(0, 16) !== 'AAAAIGZ0eXBpc29t') {
      throw new Error('invalid intro MP4 data');
    }
    return 'data:video/mp4;base64,' + base64;
  });
})();
