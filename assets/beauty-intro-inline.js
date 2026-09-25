(function () {
  'use strict';

  window.CINEMATIC_BEAUTY_VIDEO_PROMISE = fetch('assets/intro-mobile-b64.txt', { cache: 'force-cache' })
    .then(function (response) {
      if (!response.ok) throw new Error('intro video payload failed: ' + response.status);
      return response.text();
    })
    .then(function (base64) {
      base64 = base64.replace(/\s+/g, '');
      if (base64.slice(0, 16) !== 'AAAAIGZ0eXBpc29t') {
        throw new Error('invalid intro MP4 data');
      }

      var binary = atob(base64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }

      var blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'video/mp4' }));
      window.CINEMATIC_BEAUTY_VIDEO_BLOB_URL = blobUrl;
      return blobUrl;
    });
})();
