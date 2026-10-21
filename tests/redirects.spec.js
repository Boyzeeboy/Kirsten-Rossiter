// tests/redirects.spec.js
//
// WHY THIS EXISTS
//
// The old WordPress permalink structure was /%postname%/, so every recovered
// post was indexed at a root-level slug. Republished at /blog/<slug> with no
// 301 from that old URL, the post looks to Google like a brand-new page while
// the indexed URL stays dead — the content comes back, the equity does not
// (SEO-REVIEW-2026-10-21.md §1). That failure is completely invisible: the new
// page renders perfectly.
//
// build-blog.js generates the rules from the published posts that carry a
// `legacy_path`, so the risk is not a wrong rule but a missing one — a post
// flipped to draft: false whose redirect never appeared, or a rule left behind
// pointing at a post that went back to draft. Both are checked here against
// blog/posts/, not against a hand-kept list.
//
// This reads the files, not the site: _redirects is interpreted by Cloudflare,
// so there is nothing to fetch locally. First-hop curl against the deployed
// site is the other half of the check.

// @ts-check
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { test, expect } from '@playwright/test';

// Playwright transpiles these specs to CJS (package.json has no "type":
// "module"), so __dirname is what resolves here, not import.meta.url.
const ROOT = path.join(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'blog', 'posts');

const posts = fs.readdirSync(POSTS_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({
    slug: f.replace(/\.md$/, ''),
    data: matter(fs.readFileSync(path.join(POSTS_DIR, f), 'utf8')).data,
  }));

const redirects = fs.readFileSync(path.join(ROOT, '_redirects'), 'utf8');

// Only the generated block. The rules above it are hand-written editorial
// calls and are not derived from anything.
function generatedBlock() {
  const m = redirects.match(/# ARCHIVE-REDIRECTS:START[^\n]*\n([\s\S]*?)# ARCHIVE-REDIRECTS:END/);
  if (!m) throw new Error('_redirects: ARCHIVE-REDIRECTS markers not found');
  return m[1].split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [from, to, status] = l.split(/\s+/);
      return { from, to, status };
    });
}

const rules = generatedBlock();

// These read files, not a viewport. Once is enough.
test.skip(({ isMobile }) => !!isMobile, '_redirects does not vary by width');

test('every published post with an old URL has both forms of its 301', () => {
  const expected = posts.filter((p) => !p.data.draft && p.data.legacy_path);
  expect(expected.length).toBeGreaterThan(0);

  for (const p of expected) {
    const bare = p.data.legacy_path.replace(/\/$/, '');
    // Cloudflare matches the source exactly and does not normalise the
    // trailing slash, so a link to either form has to be covered.
    for (const from of [p.data.legacy_path, bare]) {
      const rule = rules.find((r) => r.from === from);
      expect(rule, `no rule for ${from} (${p.slug})`).toBeTruthy();
      expect(rule.to).toBe(`/blog/${p.slug}`);
      expect(rule.status).toBe('301');
    }
  }
});

test('no rule points at a post that is not published', () => {
  const live = new Set(posts.filter((p) => !p.data.draft).map((p) => `/blog/${p.slug}`));
  for (const rule of rules) {
    // A 301 to a URL that 404s is worse than the 404 it replaced.
    expect(live.has(rule.to), `${rule.from} → ${rule.to}, which is not a published post`).toBe(true);
  }
});

test('a draft never carries a redirect, and no source is claimed twice', () => {
  const drafts = new Set(posts.filter((p) => p.data.draft).map((p) => `/blog/${p.slug}`));
  const sources = new Set();
  for (const rule of rules) {
    expect(drafts.has(rule.to), `${rule.from} → ${rule.to}, which is a draft`).toBe(false);
    expect(sources.has(rule.from), `${rule.from} appears twice`).toBe(false);
    sources.add(rule.from);
  }
});

// /keep-moving-forward/ was the 2016 post. The 2026 post of the same slug is a
// different piece of writing, so that URL must not land on it: the old post is
// held at keep-moving-forward-2016-10-26 and owns the legacy path.
test('the keep-moving-forward collision stays resolved', () => {
  const current = posts.find((p) => p.slug === 'keep-moving-forward');
  expect(current, 'the 2026 keep-moving-forward post is gone').toBeTruthy();
  expect(current.data.legacy_path).toBeUndefined();

  const archived = posts.find((p) => p.slug === 'keep-moving-forward-2016-10-26');
  expect(archived, 'the 2016 keep-moving-forward post is gone').toBeTruthy();
  expect(archived.data.legacy_path).toBe('/keep-moving-forward/');

  for (const rule of rules) {
    expect(rule.to).not.toBe('/blog/keep-moving-forward');
  }
});

// Cloudflare Pages caps _redirects at 2,000 static redirects. All 279
// recovered WordPress posts published at once is 558 generated rules plus the
// hand-written ones, so this has room — but it is cheap to notice if that ever
// stops being true.
test('the file stays inside the Cloudflare static-redirect cap', () => {
  const all = redirects.split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
  const withLegacy = posts.filter((p) => p.data.legacy_path).length;
  const ifAllPublished = all.length - rules.length + withLegacy * 2;
  expect(ifAllPublished).toBeLessThanOrEqual(2000);
});
