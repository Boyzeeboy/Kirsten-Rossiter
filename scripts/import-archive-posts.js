#!/usr/bin/env node
/**
 * import-archive-posts.js
 *
 * One-off: turns WORDPRESS-POSTS-EXPORT.md (the 279 published posts and 14
 * drafts recovered from the old WordPress site's Duplicator backup) into one
 * blog/posts/<slug>.md per post, in the same frontmatter shape the six live
 * posts use, so the CMS and build-blog.js can read them.
 *
 * EVERY FILE IS WRITTEN AS draft: true. Which historic posts go back on the
 * site has not been decided; build-blog.js skips drafts, so nothing written
 * here is published until someone flips draft: false on a post by hand.
 *
 * Each post recovered from the *published* side of the export also gets a
 * `legacy_path` — the root-level URL it was indexed at, since the old
 * permalink structure was /%postname%/. build-blog.js turns that into a 301
 * for every such post that is published. The 14 recovered WordPress drafts
 * never had a public URL, so they get no `legacy_path`.
 *
 * It never overwrites a file. If blog/posts/<slug>.md already exists with
 * different content (one of the live posts, or an imported post someone has
 * since edited), the post is skipped and listed. Re-running is safe: files
 * that already match what it would write are reported as unchanged.
 *
 * Run: node scripts/import-archive-posts.js
 */

const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const ROOT = path.join(__dirname, '..');
const EXPORT_PATH = path.join(ROOT, 'WORDPRESS-POSTS-EXPORT.md');
const POSTS_DIR = path.join(ROOT, 'blog', 'posts');

// Old WordPress category -> the site's `type` field. A post takes the type of
// its first category (in the order WordPress listed them) that appears here.
//
//   Prophetic Revelation, Prophetic Words for the Bride,
//   Prophetic Words for South Africa, Prophetic Words for the Nations,
//   Understanding the New Era                       -> Prophetic Insight
//   Spiritual Resources                             -> Teaching
//   Poetry, Music, Prophetic Worship, Audio/Video,
//   Video, Media                                    -> Reflection
//   My Testimony, Personal, Government,
//   Uncategorized (and the "Uncategorised" spelling) -> Reflection
//
// "Featured Revelation" is never assigned; that is an editorial choice.
const TYPE_BY_CATEGORY = {
  'Prophetic Revelation': 'Prophetic Insight',
  'Prophetic Words for the Bride': 'Prophetic Insight',
  'Prophetic Words for South Africa': 'Prophetic Insight',
  'Prophetic Words for the Nations': 'Prophetic Insight',
  'Understanding the New Era': 'Prophetic Insight',
  'Poetry': 'Reflection',
  'Music': 'Reflection',
  'Prophetic Worship': 'Reflection',
  'Audio/Video': 'Reflection',
  'Video': 'Reflection',
  'Media': 'Reflection',
  'Spiritual Resources': 'Teaching',
  'My Testimony': 'Reflection',
  'Personal': 'Reflection',
  'Government': 'Reflection',
  'Uncategorized': 'Reflection',
  'Uncategorised': 'Reflection',
};
const DEFAULT_TYPE = 'Reflection';

const EXCERPT_LIMIT = 200;

// ---- Parsing the export -----------------------------------------------------
//
// A post starts at a "## Title" line whose metadata list follows after one
// blank line. Checking for the "- **Date:**" bullet is what tells a post apart
// from an ordinary "## " heading inside a post body (one draft has one).

function parseExport(text) {
  const lines = text.split('\n');
  const isPostStart = i =>
    lines[i].startsWith('## ') && lines[i + 1] === '' && /^- \*\*Date:\*\*/.test(lines[i + 2] || '');

  let section = null; // 'published' | 'drafts'
  const posts = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '# Published posts' || line === '# Drafts') {
      if (current) posts.push(current);
      current = null;
      section = line === '# Drafts' ? 'drafts' : 'published';
      continue;
    }
    if (!section) continue;
    if (isPostStart(i)) {
      if (current) posts.push(current);
      current = { section, title: line.slice(3).trim(), lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) posts.push(current);

  return posts.map(parsePost);
}

function parsePost({ section, title, lines }) {
  const meta = {};
  let i = 0;
  while (i < lines.length && lines[i] === '') i++;
  for (; i < lines.length; i++) {
    const m = lines[i].match(/^- \*\*([^*]+):\*\* ?(.*)$/);
    if (!m) break;
    meta[m[1]] = m[2].trim();
  }
  while (i < lines.length && lines[i] === '') i++;

  let excerpt = null;
  if (i < lines.length && lines[i].startsWith('> **Excerpt:**')) {
    excerpt = lines[i].slice('> **Excerpt:**'.length).trim();
    i++;
  }

  const bodyLines = lines.slice(i);
  // Drop the trailing "---" that separates one post from the next.
  while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop();
  if (bodyLines.length && bodyLines[bodyLines.length - 1] === '---') bodyLines.pop();
  while (bodyLines.length && bodyLines[bodyLines.length - 1].trim() === '') bodyLines.pop();
  while (bodyLines.length && bodyLines[0].trim() === '') bodyLines.shift();

  // The export links the recovered images as blog/media/..., relative to the
  // repo root. A post is served at /blog/<slug>, where that would resolve to
  // /blog/blog/media/..., so make them root-absolute.
  const body = bodyLines.join('\n').replace(/\]\(blog\/media\//g, '](/blog/media/');

  return {
    section,
    title,
    date: (meta['Date'] || '').slice(0, 10),
    slug: (meta['Slug'] || '').replace(/`/g, '').trim(),
    categories: (meta['Categories'] || '').split(',').map(s => s.trim()).filter(Boolean),
    excerpt,
    body,
  };
}

// ---- Deriving fields ---------------------------------------------------------

function typeFor(categories) {
  for (const c of categories) {
    if (TYPE_BY_CATEGORY[c]) return TYPE_BY_CATEGORY[c];
  }
  return DEFAULT_TYPE;
}

// Most drafts never had a slug assigned; WordPress only fixes one on publish.
function slugify(title) {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’‘]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// A recovered post keeps the slug WordPress gave it, because that slug *is* its
// old URL. Where the site already has an unrelated post under that slug, the
// file moves to a date-qualified slug, while `legacy_path` keeps pointing at the
// original — so the 301 still lands on the right post.
//
// This bites exactly once today: WordPress's "Keep Moving Forward" (2016-10-26)
// against the 2026 post at blog/posts/keep-moving-forward.md. Previously the
// older post was silently skipped at write time, which left the slug looking
// free when in fact /keep-moving-forward/ belonged to the 2016 post — publish
// the draft under that slug and its redirect would have shadowed the newer post.
function slugTakenByAnotherPost(slug, date) {
  const file = path.join(POSTS_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return false;
  const { data } = matter(fs.readFileSync(file, 'utf8'));
  const existing = data.date instanceof Date
    ? data.date.toISOString().slice(0, 10)
    : String(data.date).slice(0, 10);
  return existing !== date;
}

// The excerpt is shown escaped, as plain text, on the blog index, so inline
// Markdown would show up as literal asterisks.
function plainText(md) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/\*+/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// First prose paragraphs of the body: no headings, quotes, images, lists of
// links, tables or rules.
function leadText(body) {
  const paragraphs = body.split(/\n\s*\n/);
  let text = '';
  for (const p of paragraphs) {
    const t = p.trim();
    if (!t || /^(#|>|\||<|---|\* \* \*|- |\d+\. )/.test(t)) continue;
    const plain = plainText(t);
    if (plain.length < 20) continue;
    text = text ? `${text} ${plain}` : plain;
    if (text.length >= EXCERPT_LIMIT) break;
  }
  return text;
}

function trimToSentences(text, limit) {
  if (text.length <= limit) return text;
  const sentences = text.match(/[^.!?…]+(?:[.!?…]+['"’”)]*|$)\s*/g) || [text];
  let out = '';
  for (const s of sentences) {
    if ((out + s).trim().length > limit) break;
    out += s;
  }
  out = out.trim();
  if (out) return out;
  // A single sentence longer than the limit: cut on a word boundary.
  const cut = text.slice(0, limit - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[\s,;:–—-]+$/, '')}…`;
}

function excerptFor(post) {
  if (post.excerpt) {
    const e = plainText(post.excerpt);
    if (e) return { text: e, source: 'excerpt' };
  }
  const lead = leadText(post.body);
  if (lead) return { text: trimToSentences(lead, EXCERPT_LIMIT), source: 'body' };
  return { text: post.title, source: 'title' };
}

// ---- Writing YAML ----------------------------------------------------------
//
// Same style as the live posts: plain scalars where YAML reads them back
// unchanged, single quotes (with '' for an apostrophe) where it would not.
// Every file is parsed back through gray-matter before it is written.

function yamlString(value) {
  const needsQuotes =
    value === '' ||
    /^[\s\-?:,\[\]{}#&*!|>'"%@`]/.test(value) ||
    /\s$/.test(value) ||
    /: |:$| #/.test(value) ||
    /^(true|false|yes|no|on|off|null|~)$/i.test(value) ||
    /^[-+]?(\d[\d_]*)?\.?\d+([eE][-+]?\d+)?$/.test(value) ||
    /^\d{4}-\d\d-\d\d/.test(value);
  return needsQuotes ? `'${value.replace(/'/g, "''")}'` : value;
}

function render(post) {
  const fm = [
    '---',
    `title: ${yamlString(post.title)}`,
    `type: ${post.type}`,
    `date: ${post.date}`,
    ...(post.legacyPath ? [`legacy_path: ${yamlString(post.legacyPath)}`] : []),
    `excerpt: ${yamlString(post.excerptText)}`,
    `description: ${yamlString(post.excerptText)}`,
    'draft: true',
    '---',
  ].join('\n');
  return `${fm}\n\n${post.body}\n`;
}

function check(post, file) {
  const { data, content } = matter(file);
  const problems = [];
  if (data.title !== post.title) problems.push('title');
  if (data.type !== post.type) problems.push('type');
  if (!(data.date instanceof Date) || data.date.toISOString().slice(0, 10) !== post.date) problems.push('date');
  if ((data.legacy_path || null) !== (post.legacyPath || null)) problems.push('legacy_path');
  if (data.excerpt !== post.excerptText) problems.push('excerpt');
  if (data.description !== post.excerptText) problems.push('description');
  if (data.draft !== true) problems.push('draft');
  if (content.trim() !== post.body.trim()) problems.push('body');
  if (problems.length) {
    throw new Error(`${post.slug}: frontmatter does not round-trip (${problems.join(', ')})`);
  }
}

// ---- Main --------------------------------------------------------------------

const posts = parseExport(fs.readFileSync(EXPORT_PATH, 'utf8'));
const counts = { published: 0, drafts: 0 };
for (const p of posts) counts[p.section]++;
console.log(`Parsed ${posts.length} posts (${counts.published} published, ${counts.drafts} drafts)`);

const taken = new Set(posts.map(p => p.slug).filter(Boolean));
const derived = [];
const requalified = [];
for (const p of posts) {
  if (!/^\d{4}-\d\d-\d\d$/.test(p.date)) throw new Error(`"${p.title}": bad date "${p.date}"`);
  if (!p.slug) {
    let slug = slugify(p.title);
    if (taken.has(slug)) slug = `${slug}-${p.date}`;
    if (!slug || taken.has(slug)) throw new Error(`"${p.title}": cannot derive a unique slug`);
    taken.add(slug);
    p.slug = slug;
    derived.push(p);
  } else if (p.section === 'published') {
    // The slug from the export is the URL Google indexed, whatever the file
    // ends up being called.
    p.legacyPath = `/${p.slug}/`;
    if (slugTakenByAnotherPost(p.slug, p.date)) {
      const qualified = `${p.slug}-${p.date}`;
      if (taken.has(qualified)) throw new Error(`"${p.title}": cannot date-qualify "${p.slug}"`);
      taken.add(qualified);
      requalified.push({ from: p.slug, to: qualified, title: p.title });
      p.slug = qualified;
    }
  }
  p.type = typeFor(p.categories);
  const ex = excerptFor(p);
  p.excerptText = ex.text;
  p.excerptSource = ex.source;
}

const written = [];
const unchanged = [];
const skipped = [];

for (const p of posts) {
  const out = render(p);
  check(p, out);
  const target = path.join(POSTS_DIR, `${p.slug}.md`);
  if (fs.existsSync(target)) {
    if (fs.readFileSync(target, 'utf8') === out) unchanged.push(p);
    else skipped.push(p);
    continue;
  }
  fs.writeFileSync(target, out);
  written.push(p);
}

const byType = {};
for (const p of posts) byType[p.type] = (byType[p.type] || 0) + 1;
const bySource = {};
for (const p of posts) bySource[p.excerptSource] = (bySource[p.excerptSource] || 0) + 1;

console.log(`  written    ${written.length}`);
console.log(`  unchanged  ${unchanged.length}`);
console.log(`  skipped    ${skipped.length} (file already exists with different content — not overwritten)`);
for (const p of skipped) console.log(`             ${p.slug}.md  ← "${p.title}" (${p.date})`);
console.log(`  types      ${Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
console.log(`  excerpts   ${Object.entries(bySource).map(([k, v]) => `from ${k}: ${v}`).join(', ')}`);
if (requalified.length) {
  console.log(`  slugs date-qualified (an unrelated post already holds the slug): ${requalified.length}`);
  for (const r of requalified) console.log(`             ${r.to}.md  ← "${r.title}" (legacy_path stays /${r.from}/)`);
}
if (derived.length) {
  console.log(`  slugs derived from the title (none in the export): ${derived.length}`);
  for (const p of derived) console.log(`             ${p.slug}.md  ← "${p.title}"`);
}
console.log('All imported posts are draft: true. Nothing here is published.');
