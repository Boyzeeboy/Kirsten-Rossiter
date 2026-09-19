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

// @ts-check
import { test, expect } from '@playwright/test';

const PAGES = [
  { name: 'home', path: '/' },
  { name: 'building-the-nations', path: '/building-the-nations' },
  { name: 'contact', path: '/contact' },
  { name: 'thank-you', path: '/thank-you' },
  { name: 'terms', path: '/terms' },
  { name: 'blog-index', path: '/blog/' },
  { name: 'blog-post', path: '/blog/keep-moving-forward' },
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
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete));
  await page.evaluate(() => document.fonts.ready);
}

for (const { name, path } of PAGES) {
  test(name, async ({ page }) => {
    await page.goto(path);
    await settle(page);
    await expect(page).toHaveScreenshot(`${name}.png`, { fullPage: true });
  });
}
