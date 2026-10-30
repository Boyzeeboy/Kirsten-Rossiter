// tests/topics.spec.js
//
// WHY THIS EXISTS
//
// Topic pages (ORIN-164) are generated from each post's `topics`, and their
// whole job is links: hub to post, post to hub, blog index to hub. A link that
// goes missing renders nothing, so nothing in a browser says it has gone. This
// reads the served HTML and checks the links are there for every post, and
// that the pages are held out of search, or let in, as TOPIC_PAGES_INDEXED says.
//
// The hub rules (a lead post that is a draft, missing or off-topic fails the
// build) are checked against build-blog.js directly, with made-up posts, so
// they need no broken file in the repo to prove.

// @ts-check
import { test, expect } from '@playwright/test';
// build-blog.js only runs the build when it is the entry point; required here
// it just hands over the topic rules and the post reader.
import build from '../build-blog.js';

const ORIGIN = 'https://www.kirstenrossiter.com';
const { posts } = build.readPosts();
const hubs = build.readHubs();
const topics = [...new Set(posts.flatMap((p) => p.data.topics || []))].sort();

// These read HTTP responses, not a viewport. Once is enough.
test.skip(({ isMobile }) => !!isMobile, 'served HTML does not vary by width');

const get = async (request, path) => {
  const res = await request.get(path);
  expect(res.status(), `${path} should be served`).toBe(200);
  return res.text();
};

test('every topic a published post carries has a page listing all its posts', async ({ request }) => {
  expect(topics.length).toBeGreaterThan(0);
  for (const topic of topics) {
    const path = build.topicPath(topic);
    const html = await get(request, path);
    const linked = new Set([...html.matchAll(/href="\/blog\/([a-z0-9-]+)"/g)].map((m) => m[1]));
    const expected = posts.filter((p) => p.data.topics.includes(topic)).map((p) => p.slug);
    for (const slug of expected) expect(linked.has(slug), `${path} should link /blog/${slug}`).toBe(true);
    expect(html).toContain(`>${expected.length} post${expected.length === 1 ? '' : 's'}<`);
  }
});

test('every published post links to the pages for its topics', async ({ request }) => {
  for (const p of posts) {
    const html = await get(request, `/blog/${p.slug}`);
    for (const topic of p.data.topics) {
      expect(html, `${p.slug} should link ${topic}`).toContain(`href="${build.topicPath(topic)}"`);
    }
  }
});

test('the blog index links every hub, and only hubs', async ({ request }) => {
  const html = await get(request, '/blog/');
  const nav = (html.match(/<nav class="topic-links"[\s\S]*?<\/nav>/) || [''])[0];
  const hrefs = [...nav.matchAll(/href="([^"]+)"/g)].map((m) => m[1]).sort();
  expect(hrefs).toEqual(hubs.map((h) => build.topicPath(h.topic)).sort());
});

test('a hub shows its lead posts first, and lists them only once', async ({ request }) => {
  const hub = hubs.find((h) => h.leads.length);
  test.skip(!hub, 'no hub has lead posts');
  const html = await get(request, build.topicPath(hub.topic));
  // From the lead cards to the next heading, or the end of the list if none.
  const leadBlock = (html.split('<div class="topic-leads">')[1] || '').split(/<h2 class="topic-section-title"|<\/main>/)[0];
  for (const slug of hub.leads) {
    expect(leadBlock).toContain(`class="post-row" href="/blog/${slug}"`);
    expect(html.split(`href="/blog/${slug}"`).length - 1, `${slug} should appear once`).toBe(1);
  }
});

test('topic pages are held out of search, or indexed, as TOPIC_PAGES_INDEXED says', async ({ request }) => {
  const sitemap = await get(request, '/sitemap.xml');
  for (const topic of topics) {
    const path = build.topicPath(topic);
    const html = await get(request, path);
    if (build.TOPIC_PAGES_INDEXED) {
      expect(html).toContain(`<link rel="canonical" href="${ORIGIN}${path}" />`);
      expect(html).not.toContain('name="robots" content="noindex"');
      expect(html).toContain('"@type": "CollectionPage"');
      expect(sitemap).toContain(`<loc>${ORIGIN}${path}</loc>`);
    } else {
      // Same rule as the other noindex pages: no canonical, no share tags.
      expect(html).toContain('name="robots" content="noindex"');
      expect(html).not.toContain('rel="canonical"');
      expect(html).not.toContain('property="og:');
      expect(sitemap).not.toContain('/blog/topics/');
    }
  }
});

test('topic page assets are version-stamped', async ({ request }) => {
  const html = await get(request, build.topicPath(topics[0]));
  const refs = [...html.matchAll(/(?:href|src)="([^"]*(?:styles\.css|tokens\.css|site\.js)[^"]*)"/g)].map((m) => m[1]);
  expect(refs.length).toBeGreaterThan(0);
  for (const ref of refs) expect(ref).toMatch(/\?v=[0-9a-f]{8}$/);
});

test.describe('hub rules', () => {
  const post = (slug, topics) => ({ slug, data: { topics } });
  const sample = [post('a', ['Faith in Hard Times']), post('b', ['Spiritual Warfare'])];
  const hub = (fields) => ({ file: 'test.md', topic: 'Faith in Hard Times', leads: [], ...fields });
  const check = (h, drafts = []) => () => build.validateHubs([h], sample, new Set(drafts));

  test('a valid hub passes', () => {
    expect(check(hub({ leads: ['a'] }))).not.toThrow();
  });
  test('a draft lead post fails the build', () => {
    expect(check(hub({ leads: ['c'] }), ['c'])).toThrow(/lead post "c" is a draft/);
  });
  test('a missing lead post fails the build', () => {
    expect(check(hub({ leads: ['nope'] }))).toThrow(/lead post "nope" does not exist/);
  });
  test('an off-topic lead post fails the build', () => {
    expect(check(hub({ leads: ['b'] }))).toThrow(/is not tagged "Faith in Hard Times"/);
  });
  test('a topic no post carries fails the build', () => {
    expect(check(hub({ topic: 'Revival & Outpouring' }))).toThrow(/no published post carries/);
  });
  test('more than 15 lead posts fails the build', () => {
    expect(check(hub({ leads: Array(16).fill('a') }))).toThrow(/at most 15/);
  });
  test('two hubs for one topic fail the build', () => {
    expect(() => build.validateHubs([hub({}), hub({ file: 'other.md' })], sample)).toThrow(/already has a hub/);
  });
});

test('topic slugs read the ampersand as "and"', () => {
  expect(build.topicSlug('The Nations & World Events')).toBe('the-nations-and-world-events');
  expect(build.topicSlug('Seasons & a New Era')).toBe('seasons-and-a-new-era');
});
