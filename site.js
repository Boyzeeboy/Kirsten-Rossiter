/* ============================================================
   Page behaviour. Two jobs, each bound on its own:

     1. the Cloudflare Web Analytics beacon
     2. the mobile-nav hamburger

   This file replaced includes.js on 19 Sep 2026. That script also
   fetched partials/nav.html and partials/footer.html into the page
   after load, and bound the hamburger only once those fetches had
   resolved. The nav and footer now ship in the HTML — build-blog.js
   copies them in between NAV/FOOTER marker comments — so there is
   nothing to fetch, and the hamburger is bound directly against
   markup that is already in the DOM.
   ============================================================ */
(function () {
  /* ----------------------------------------------------------
     Analytics: Cloudflare Web Analytics (cookieless).
     Loads the beacon on every page that includes this script.
     The beacon must be created as a real <script> element — a
     tag injected via innerHTML would not execute — which is why
     it lives here rather than in the footer partial.
     Google Analytics (GA4) was removed 24 Jul 2026.
     Ahrefs analytics was removed 19 Sep 2026.
     ---------------------------------------------------------- */
  var CF_BEACON_TOKEN = 'b8dabd9848f044ecab21204759922b13';

  function loadAnalytics() {
    if (!CF_BEACON_TOKEN || window.__cfBeaconLoaded) return;
    window.__cfBeaconLoaded = true;

    var s = document.createElement('script');
    s.defer = true;
    s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
    s.setAttribute('data-cf-beacon', '{"token": "' + CF_BEACON_TOKEN + '"}');
    document.head.appendChild(s);
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

  loadAnalytics();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNav);
  } else {
    initNav();
  }
})();
