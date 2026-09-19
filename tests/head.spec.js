// tests/head.spec.js
//
// WHY THIS EXISTS
//
// The canonical, Open Graph, Twitter Card and JSON-LD tags (SEO-AUDIT.md #4,
// #5, #6) render nothing, so nothing visible tells you they are wrong. The
// blog gets them from build-blog.js; the hand-authored pages carry copies.
// This keeps the two in step and catches the failure modes that are silent
// in a browser: a canonical that disagrees with og:url, a JSON-LD block that
// is not JSON, a page that should be noindex advertising a canonical.
//
// It reads the served HTML, not the DOM, so a scraper's view is what is
// checked.

// @ts-check
import { test, expect } from '@playwright/test';

const ORIGIN = 'https://www.kirstenrossiter.com';

const INDEXED = [
  { path: '/', canonical: `${ORIGIN}/`, ld: 'Person' },
  { path: '/building-the-nations', canonical: `${ORIGIN}/building-the-nations`, ld: 'Book' },
  { path: '/contact', canonical: `${ORIGIN}/contact` },
  { path: '/terms', canonical: `${ORIGIN}/terms` },
  { path: '/blog/', canonical: `${ORIGIN}/blog/` },
  { path: '/blog/keep-moving-forward', canonical: `${ORIGIN}/blog/keep-moving-forward`, ld: 'BlogPosting' },
];

// noindex pages must not carry a canonical or share tags: that would be
// asking to be indexed and asking not to be in the same <head>.
const NOINDEX = ['/thank-you', '/404.html'];

const attr = (html, re) => (html.match(re) || [])[1];

// These read HTTP responses, not a viewport. Once is enough.
test.skip(({ isMobile }) => !!isMobile, 'served HTML does not vary by width');

test.describe('indexed pages', () => {
  for (const { path, canonical, ld } of INDEXED) {
    test(path, async ({ request }) => {
      const html = await (await request.get(path)).text();

      expect(attr(html, /<link rel="canonical" href="([^"]+)" \/>/)).toBe(canonical);
      expect(attr(html, /property="og:url" content="([^"]+)"/)).toBe(canonical);
      expect(attr(html, /property="og:image" content="([^"]+)"/)).toMatch(/^https:\/\/www\.kirstenrossiter\.com\/.+\.jpg$/);
      expect(attr(html, /name="twitter:card" content="([^"]+)"/)).toBe('summary');
      expect(html).not.toContain('name="robots" content="noindex"');

      const blocks = [...html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/g)].map((m) => JSON.parse(m[1]));
      if (ld) {
        expect(blocks.map((b) => b['@type'])).toEqual([ld]);
        expect(blocks[0]['@context']).toBe('https://schema.org');
      } else {
        expect(blocks).toEqual([]);
      }
    });
  }
});

test.describe('noindex pages', () => {
  for (const path of NOINDEX) {
    test(path, async ({ request }) => {
      const html = await (await request.get(path)).text();
      expect(html).toContain('name="robots" content="noindex"');
      expect(html).not.toContain('rel="canonical"');
      expect(html).not.toContain('property="og:');
    });
  }
});

test('blog index links posts extensionless, like the homepage and sitemap', async ({ request }) => {
  const html = await (await request.get('/blog/')).text();
  const hrefs = [...html.matchAll(/class="post-row" href="([^"]+)"/g)].map((m) => m[1]);
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) expect(href).not.toMatch(/\.html$/);
});
