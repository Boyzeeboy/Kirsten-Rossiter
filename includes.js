/* ============================================================
   Shared-partial loader.
   Any element with data-include="path/to/file.html" has that
   file's contents fetched and injected. After all includes load,
   the mobile-nav hamburger is wired up.

   Note: because this uses fetch(), pages must be served over
   http(s) (your live site or a local server) — opening the HTML
   file directly from disk (file://) will block the fetch.
   ============================================================ */
(function () {
  /* ----------------------------------------------------------
     Google Analytics (GA4)
     Loads gtag.js and initialises tracking on every page that
     includes this script. To change properties, edit GA_ID below.
     ---------------------------------------------------------- */
  var GA_ID = 'G-QVNK5XS5R8';

  function loadAnalytics() {
    if (!GA_ID || window.__gaLoaded) return;
    window.__gaLoaded = true;

    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', GA_ID);
  }

  function initNav() {
    var hamburger = document.getElementById('hamburger');
    var drawer = document.getElementById('navDrawer');
    if (!hamburger || !drawer) return;

    function openMenu() {
      hamburger.classList.add('open');
      drawer.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      drawer.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
    function closeMenu() {
      hamburger.classList.remove('open');
      drawer.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
    hamburger.addEventListener('click', function () {
      hamburger.classList.contains('open') ? closeMenu() : openMenu();
    });
    drawer.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
  }

  function loadIncludes() {
    var nodes = Array.prototype.slice.call(document.querySelectorAll('[data-include]'));
    var jobs = nodes.map(function (el) {
      var url = el.getAttribute('data-include');
      return fetch(url)
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to load ' + url + ' (' + res.status + ')');
          return res.text();
        })
        .then(function (html) { el.innerHTML = html; })
        .catch(function (err) { console.error(err); });
    });
    Promise.all(jobs).then(initNav);
  }

  loadAnalytics();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadIncludes);
  } else {
    loadIncludes();
  }
})();
