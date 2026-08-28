const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const { Marked } = require('marked');

const POSTS_DIR = path.join(__dirname, 'blog', 'posts');
const BLOG_DIR = path.join(__dirname, 'blog');

const marked = new Marked();

const renderer = new marked.Renderer();

let isFirstParagraph = true;

renderer.paragraph = function ({ tokens }) {
  const text = this.parser.parseInline(tokens);
  if (isFirstParagraph) {
    isFirstParagraph = false;
    return `<p class="lead">${text}</p>\n`;
  }
  return `<p>${text}</p>\n`;
};

marked.use({ renderer });

function formatDate(dateVal) {
  const d = new Date(dateVal);
  const day = d.getUTCDate();
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${day} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPost(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const { data, content } = matter(raw);

  if (data.draft) return null;

  const slug = path.basename(filePath, '.md');
  const displayDate = formatDate(data.date);

  isFirstParagraph = true;
  const body = marked.parse(content).trim();

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(data.title)} — Kirsten Rossiter</title>
<meta name="description" content="${escapeHtml(data.description || data.excerpt)}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="../vendor/tokens.css" />
<link rel="stylesheet" href="../styles.css" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Jost:wght@300;400;500&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet" />
<script src="https://analytics.ahrefs.com/analytics.js" data-key="hTpANQEDMnRKBLx81QPYuw" async></script>
</head>
<body>
<div data-include="../partials/nav.html"></div>

<header class="article-head">
<div class="container">
<a href="/blog/" class="back-link">← The Prophetic Blog</a>
<span class="article-type">${escapeHtml(data.type)}</span>
<h1 class="article-title">${escapeHtml(data.title)}</h1>
<p class="article-date">${displayDate}</p>
<div class="article-rule"></div>
</div>
</header>

<article class="article-body">
${body}
</article>

<div class="article-foot">
<a href="/blog/">Read more from the blog</a>
</div>

<div data-include="../partials/footer.html"></div>
<script src="../includes.js"></script>
</body>
</html>
`;

  return { slug, data, displayDate, html };
}

function buildIndex(posts) {
  const cards = posts.map(p => {
    return `<a class="post-row" href="/blog/${p.slug}.html">
<div class="post-meta-col">
<span class="post-type">${escapeHtml(p.data.type)}</span>
<span class="post-date">${p.displayDate}</span>
</div>
<div>
<h2 class="post-title">${escapeHtml(p.data.title)}</h2>
<p class="post-excerpt">${escapeHtml(p.data.excerpt)}</p>
</div>
<span class="post-arrow">→</span>
</a>`;
  }).join('\n\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Prophetic Blog — Kirsten Rossiter</title>
<meta name="description" content="Prophetic revelation, teachings, and reflections for the Bride and the nations — from Kirsten Rossiter." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="stylesheet" href="../vendor/tokens.css" />
<link rel="stylesheet" href="../styles.css" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Jost:wght@300;400;500&family=Lora:ital,wght@0,400;0,500;1,400&display=swap" rel="stylesheet" />
<script src="https://analytics.ahrefs.com/analytics.js" data-key="hTpANQEDMnRKBLx81QPYuw" async></script>
</head>
<body>
<div data-include="../partials/nav.html"></div>

<header class="blog-hero">
<div class="container">
<span class="label"><span class="rule-line"></span>Prophetic Writings</span>
<h1 class="blog-headline">The Prophetic Blog</h1>
<p class="blog-sub">Prophetic revelation, teachings, and reflections for the Bride and the nations. Words to awaken, equip, and mobilise the Ekklesia for this hour.</p>
</div>
</header>

<main class="blog-list">
<div class="container">
${cards}
</div>
</main>

<div data-include="../partials/footer.html"></div>
<script src="../includes.js"></script>
</body>
</html>
`;
}

function buildHomepageInsights(posts) {
  const INDEX_PATH = path.join(__dirname, 'index.html');

  if (!fs.existsSync(INDEX_PATH)) {
    console.log('  skipped  index.html (not found)');
    return;
  }

  const latest = posts.slice(0, 3);
  if (latest.length === 0) return;

  const ind = ' '.repeat(20); // match indentation inside .insights-featured

  const cards = latest.map((p, i) => {
    const url = `/blog/${p.slug}`;
    const label = escapeHtml(p.data.type || 'Prophetic Insight');
    const title = escapeHtml(p.data.title);

    if (i === 0) {
      return [
        `${ind}<div class="insight-card featured">`,
        `${ind}    <div class="insight-type">${label}</div>`,
        `${ind}    <h3 class="insight-title">${title}</h3>`,
        `${ind}    <p class="insight-excerpt">${escapeHtml(p.data.excerpt)}</p>`,
        `${ind}    <a href="${url}" class="insight-link">Read the revelation →</a>`,
        `${ind}</div>`,
      ].join('\n');
    }

    return [
      `${ind}<div class="insight-card">`,
      `${ind}    <div class="insight-type">${label}</div>`,
      `${ind}    <h3 class="insight-title">${title}</h3>`,
      `${ind}    <a href="${url}" class="insight-link">Read →</a>`,
      `${ind}</div>`,
    ].join('\n');
  }).join('\n');

  const startMarker = '<!-- INSIGHTS:START (auto-generated by build-blog.js — do not edit by hand) -->';
  const endMarker = '<!-- INSIGHTS:END -->';
  const block = `${startMarker}\n${cards}\n${ind}${endMarker}`;

  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const re = /<!-- INSIGHTS:START[\s\S]*?<!-- INSIGHTS:END -->/;

  if (!re.test(html)) {
    console.log('  skipped  index.html (INSIGHTS markers not found)');
    return;
  }

  fs.writeFileSync(INDEX_PATH, html.replace(re, block));
  console.log(`  built  index.html insights (${latest.length} cards)`);
}

const SITE_ORIGIN = 'https://www.kirstenrossiter.com';

// Pages with no .md source. Their lastmod is maintained by hand — bump the
// date here when you meaningfully change the page.
const STATIC_PAGES = [
  { path: '/building-the-nations', lastmod: '2026-07-04' },
  { path: '/contact', lastmod: '2026-07-04' },
  { path: '/terms', lastmod: '2026-07-04' },
];

function isoDate(dateVal) {
  const d = new Date(dateVal);
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}-${day}`;
}

// sitemap.xml is generated, never hand-edited — editing it by hand is how it
// went stale. The homepage and blog index both change whenever a post is
// published, so their lastmod tracks the newest post.
function buildSitemap(posts) {
  const newest = posts.length ? isoDate(posts[0].data.date) : isoDate(Date.now());

  const urls = [
    { path: '/', lastmod: newest },
    { path: '/blog/', lastmod: newest },
    ...posts.map(p => ({ path: `/blog/${p.slug}`, lastmod: isoDate(p.data.date) })),
    ...STATIC_PAGES,
  ];

  const body = urls.map(u => [
    '  <url>',
    `    <loc>${SITE_ORIGIN}${u.path}</loc>`,
    `    <lastmod>${u.lastmod}</lastmod>`,
    '  </url>',
  ].join('\n')).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

  fs.writeFileSync(path.join(__dirname, 'sitemap.xml'), xml);
  console.log(`  built  sitemap.xml (${urls.length} urls)`);
}

// Main
const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
const posts = [];

for (const file of files) {
  const result = buildPost(path.join(POSTS_DIR, file));
  if (result) posts.push(result);
}

posts.sort((a, b) => new Date(b.data.date) - new Date(a.data.date));

const activeSlugs = new Set(posts.map(p => p.slug));
const existingHtml = fs.readdirSync(BLOG_DIR).filter(f =>
  f.endsWith('.html') && f !== 'index.html' && f !== '_template.html'
);
for (const file of existingHtml) {
  const slug = file.replace(/\.html$/, '');
  if (!activeSlugs.has(slug)) {
    fs.unlinkSync(path.join(BLOG_DIR, file));
    console.log(`  removed  ${file} (no matching .md source)`);
  }
}

for (const post of posts) {
  const outPath = path.join(BLOG_DIR, `${post.slug}.html`);
  fs.writeFileSync(outPath, post.html);
  console.log(`  built  ${post.slug}.html`);
}

const indexHtml = buildIndex(posts);
fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), indexHtml);
console.log(`  built  index.html (${posts.length} posts)`);

buildHomepageInsights(posts);
buildSitemap(posts);
