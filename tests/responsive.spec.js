// tests/responsive.spec.js
//
// WHY THIS EXISTS
//
// The homepage scrolled sideways on every phone for as long as it had
// existed. Three two-column grids — .positioning-inner, .about-inner and
// .book-inner — never collapsed to one column, so at 375px the page was
// 600px wide: .book-right sat at x=384-600 and .about-right at x=444-580,
// both off the edge of the screen. The book section rendered a cover and
// nothing else, its headline and buy button reachable only by scrolling
// sideways, on the one section the site exists to sell. (Fixed in #43.)
//
// Every gate we had was green while that shipped. lint:tokens reads CSS
// values. head.spec.js reads tags. And visual.spec.js — the one that looks
// at pictures — was certifying the bug as correct: its mobile baseline was
// 602px wide for a 390px viewport, because the full-page screenshot had been
// capturing the overflow since the day the baseline was made. A screenshot
// test compares a page against its own past, so a fault present at baseline
// time becomes the standard. Green there means "unchanged", never "right".
//
// This asks an absolute question instead, one no baseline can normalise:
// does any page, at any width, extend past its own viewport? It needs no
// stored images, so it cannot be taught to accept a regression.
//
// It also covers width that nothing else does. visual.spec.js screenshots
// 390 and 1280. The whole 641-900 band — where the full nav still shows on a
// narrow screen, and where a tablet sits — had no coverage at all.

// @ts-check
import { test, expect } from '@playwright/test';

const PAGES = [
  '/',
  '/building-the-nations',
  '/contact',
  '/thank-you',
  '/terms',
  '/blog/',
  // The pagination control is widest here: both steps enabled and an
  // ellipsis on each side.
  '/blog/page/7',
  '/blog/keep-moving-forward',
  '/404.html',
];

// Either side of each breakpoint (900, 760, 640), plus the narrowest phone
// still in use and the widths the screenshots already cover.
const WIDTHS = [320, 375, 390, 414, 600, 639, 640, 641, 700, 760, 761, 768, 820, 899, 900, 901, 1024, 1280];

// This sets its own viewport for every width, so running it a second time
// under the mobile project would only repeat the same assertions.
test.skip(({ isMobile }) => !!isMobile, 'this spec drives the viewport itself');

for (const path of PAGES) {
  test(`${path} never scrolls sideways`, async ({ page }) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);

      // Name the widest offender rather than just failing: "something
      // overflows by 225px" costs an afternoon, ".book-right" costs a minute.
      const overflow = await page.evaluate(() => {
        const limit = document.documentElement.clientWidth;
        let worst = null;
        for (const el of document.querySelectorAll('body *')) {
          const box = el.getBoundingClientRect();
          if (box.width === 0 || getComputedStyle(el).visibility === 'hidden') continue;
          // Round: sub-pixel layout regularly lands a fraction over and that
          // is not a horizontal scrollbar.
          const past = Math.round(box.right) - limit;
          if (past > 0 && (!worst || past > worst.past)) {
            worst = { past, selector: el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).trim().split(/\s+/).join('.') : '') };
          }
        }
        return { limit, scrollWidth: document.documentElement.scrollWidth, worst };
      });

      expect(
        overflow.scrollWidth,
        `${path} at ${width}px is ${overflow.scrollWidth}px wide` +
          (overflow.worst ? `; widest offender ${overflow.worst.selector}, ${overflow.worst.past}px past the edge` : ''),
      ).toBeLessThanOrEqual(overflow.limit);
    }
  });
}
