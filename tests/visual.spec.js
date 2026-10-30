// tests/visual.spec.js
//
// WHY THIS EXISTS
//
// Every other check on this repo reads text. lint:tokens proves that every
// var() resolves and that vendor/tokens.css matches the pin. It cannot see
// what c98ccc6 did: a token *value* moving under a name that still resolves.
// styles.css did not change, every reference was valid, the gate was green,
// and the body background had shifted live for weeks. Only something that
// compares pictures catches that class of change.
//
// It also turns "meant to be visually invisible" into something provable.
// Inlining the nav and footer at build time, adding <head> tags, putting
// width/height on images — each of those should produce an empty diff here,
// and an empty diff is the proof it was done right. That is why this suite
// had to exist before those changes landed, not after.
//
// One page per template. Every blog post is the same template with different
// markdown, so one representative post stands in for all of them.
//
// PINNED CONTENT
//
// Half these pages are made of the newest posts: the homepage's latest-insight
// cards, the blog index and its page 7, the topic pages. Kirsten publishes
// through the CMS straight to main, so every post she published moved those
// pictures and turned this check red on main until someone regenerated the
// baselines by hand (on 30 Oct 2026 ORIN-164 had to carry a regenerated
// home.png for posts it had nothing to do with). A check that goes red because
// Kirsten wrote something trains everyone to wave baselines through, which is
// the one way a real regression gets past this suite.
//
// So these pages are not built from today's posts. `npm run build:visual`
// (scripts/build-visual.sh) builds today's templates and CSS from blog/posts/
// and blog/hubs/ as they were at a pinned commit. A new post, an edited one
// or a reworded hub cannot move a pixel here; a change to build-blog.js,
// styles.css, the tokens or a page's HTML still does. Every card, row and
// pagination state is still photographed in full — nothing is masked.
//
// Masking the post-driven regions was the alternative, and it does not hold:
// a new title that wraps to two lines, or a topic list one post longer,
// changes the page's height, and a full-page capture of a different height
// fails however much of it is masked.
//
// The other specs, which carry no @visual tag, check that the real posts are
// linked, redirected and searchable, so they run against `npm run build`. In
// CI the job builds twice: live content for them, pinned content for this.
// Locally:
//
//   npm run build:visual && npm run test:visual
//   npm run build            # put the real blog back afterwards

// @ts-check
import { test, expect } from '@playwright/test';

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'building-the-nations', path: '/building-the-nations' },
  { name: 'contact', path: '/contact' },
  { name: 'thank-you', path: '/thank-you' },
  { name: 'terms', path: '/terms' },
  { name: 'blog-index', path: '/blog/' },
  // A middle page, because it is the only one that renders every state of the
  // pagination control at once: both steps enabled, a current page, and an
  // ellipsis on each side. Page 1 and the last page each hide half of it.
  { name: 'blog-index-page-7', path: '/blog/page/7' },
  { name: 'blog-post', path: '/blog/keep-moving-forward' },
  // A topic page with a hub file (lead cards, then the list) and one without
  // (the list alone): the two states the topic template has. Revival &
  // Outpouring is the smallest topic, so its full-page capture stays short.
  { name: 'topic-hub', path: '/blog/topics/spiritual-warfare' },
  { name: 'topic-page', path: '/blog/topics/revival-and-outpouring' },
  { name: '404', path: '/404.html' },
];

// Third-party scripts that would otherwise vary the page, or record a
// pageview every time CI runs. Everything else — including Google Fonts —
// is allowed through, because the fonts are part of what a baseline should
// capture.
const BLOCKED_HOSTS = ['analytics.ahrefs.com', 'static.cloudflareinsights.com'];

// thank-you.html writes new Date().getFullYear() into the footer. Pin the
// clock so the baseline does not expire every January.
const FIXED_TIME = new Date('2026-09-19T12:00:00Z');

test.beforeEach(async ({ page, context }) => {
  await context.route(
    (url) => BLOCKED_HOSTS.includes(url.hostname),
    (route) => route.abort(),
  );
  await page.clock.setFixedTime(FIXED_TIME);
});

// What a page is waiting on before it is settled enough to photograph. Until
// 19 Sep 2026 this also awaited the partial fetch in includes.js; the nav and
// footer now ship in the HTML (ORIN-27), and the baselines did not move.
async function settle(page) {
  // A lazy image below the fold is never `complete` in a page that does not
  // scroll, and a full-page capture does not scroll. Flip them to eager so
  // the wait below can finish; the pixels are the same either way.
  await page.evaluate(() => {
    document.querySelectorAll('img[loading="lazy"]').forEach((img) => {
      img.loading = 'eager';
    });
  });
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
  await page.evaluate(() => document.fonts.ready);
}

for (const { name, path } of PAGES) {
  test(name, { tag: '@visual' }, async ({ page }) => {
    await page.goto(path);
    await settle(page);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });
}
