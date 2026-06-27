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
<link rel="stylesheet" href="../styles.css" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet" />
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
<link rel="stylesheet" href="../styles.css" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet" />
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

// Main
const files = fs.readdirSync(POSTS_DIR).filter(f => f.endsWith('.md'));
const posts = [];

for (const file of files) {
  const result = buildPost(path.join(POSTS_DIR, file));
  if (result) posts.push(result);
}

posts.sort((a, b) => new Date(b.data.date) - new Date(a.data.date));

for (const post of posts) {
  const outPath = path.join(BLOG_DIR, `${post.slug}.html`);
  fs.writeFileSync(outPath, post.html);
  console.log(`  built  ${post.slug}.html`);
}

const indexHtml = buildIndex(posts);
fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), indexHtml);
console.log(`  built  index.html (${posts.length} posts)`);
