/* Full Persian date for the management-panel top bar. */
(function () {
  'use strict';

  function updatePanelDate() {
    var el = document.getElementById('topbarDate');
    if (!el) return;

    try {
      var text = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date());
      el.textContent = text;
      el.setAttribute('aria-label', 'تاریخ امروز: ' + text);
      el.setAttribute('title', 'تاریخ امروز: ' + text);
    } catch (error) {
      /* Keep the date already rendered by app.js as a safe fallback. */
    }
  }

  function init() {
    updatePanelDate();
    window.setTimeout(updatePanelDate, 250);
    window.setTimeout(updatePanelDate, 900);
    window.setInterval(updatePanelDate, 60 * 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
