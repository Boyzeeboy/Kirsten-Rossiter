// tests/chrome.spec.js
//
// WHY THIS EXISTS
//
// The nav and footer used to arrive by fetch() after load, so the served HTML
// carried no internal links: contact.html was an orphan to every crawler that
// does not run JavaScript (SEO-AUDIT.md #3). Since 19 Sep 2026 build-blog.js
// copies both partials into every page between NAV/FOOTER markers. The two
// checks here are the ticket's own verification list, kept so that the
// regression it warned about — "the mobile nav will die silently" — cannot
// come back green.
//
//   1. With JavaScript off, every page still has the full nav and footer.
//   2. With JavaScript on, the hamburger opens and closes the drawer at
//      phone width. It used to be bound inside the include loader's .then();
//      it is now bound in site.js on its own.
//   3. The Cloudflare Web Analytics beacon is still requested. It lived in
//      includes.js next to the fetch logic, and deleting that file would have
//      silently ended analytics.
//
// terms.html and 404.html carry their own older nav with no drawer, so they
// are checked for links only.

// @ts-check
import { test, expect } from '@playwright/test';

const PARTIAL_PAGES = ['/', '/building-the-nations', '/contact', '/blog/', '/blog/keep-moving-forward', '/blog/_template.html'];
const OWN_NAV_PAGES = ['/terms', '/404.html'];

test.describe('nav and footer ship in the HTML', () => {
  test.use({ javaScriptEnabled: false });

  for (const path of PARTIAL_PAGES) {
    test(`${path} with JavaScript off`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('nav.site-nav .nav-links a')).toHaveCount(5);
      await expect(page.locator('#navDrawer')).toHaveCount(1);
      await expect(page.locator('footer.site-footer .footer-nav a')).toHaveCount(5);
      await expect(page.locator('[data-include]')).toHaveCount(0);
    });
  }

  for (const path of OWN_NAV_PAGES) {
    test(`${path} with JavaScript off`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator('nav.site-nav a[href^="/"]').first()).toBeAttached();
      await expect(page.locator('footer a[href^="/"]').first()).toBeAttached();
    });
  }
});

test('analytics beacon is requested', async ({ page }) => {
  const beacon = page.waitForRequest((req) => req.url().startsWith('https://static.cloudflareinsights.com/beacon.min.js'));
  // Intercepted and dropped: the test needs the request, not the pageview.
  await page.route('https://static.cloudflareinsights.com/**', (route) => route.abort());
  await page.goto('/');
  await beacon;
});

test.describe('hamburger', () => {
  // The drawer only exists below the breakpoint; the desktop project has no
  // hamburger to press.
  test.skip(({ viewport }) => !viewport || viewport.width > 768, 'phone width only');

  test('opens and closes the drawer', async ({ page }) => {
    await page.goto('/contact');
    const hamburger = page.locator('#hamburger');
    const drawer = page.locator('#navDrawer');

    await expect(hamburger).toBeVisible();
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');

    await hamburger.click();
    await expect(drawer).toHaveClass(/open/);
    await expect(drawer).toHaveAttribute('aria-hidden', 'false');
    await expect(hamburger).toHaveAttribute('aria-expanded', 'true');

    await hamburger.click();
    await expect(drawer).not.toHaveClass(/open/);
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
  });
});
