# Build Brief — Blog CMS bolt-on for kirstenrossiter.com

## Goal
Add a lightweight authoring workflow to the existing hand-coded blog so non-technical edits no longer require writing raw HTML or manually maintaining the post index. Do this as a **bolt-on** to the current static site — no framework migration, no new database, no monthly-cost services. Keep the live visual output byte-for-byte equivalent to today's posts.

Deliver three pieces:
1. **Markdown content** — posts authored as Markdown + frontmatter.
2. **A build script** — converts Markdown → styled post HTML using the existing template, and auto-regenerates the blog index.
3. **Sveltia CMS** — a `/admin` page giving a clean editor that commits Markdown to GitHub.

Work on a branch (`feature/blog-cms`). Do not touch the live site until reviewed.

## Current setup (already in the repo — read these first)
- Pure static site deployed via GitHub (`Boyzeeboy/Kirsten-Rossiter`) → Cloudflare Pages auto-deploy. **No build step currently.**
- `includes.js` injects `partials/nav.html` and `partials/footer.html` client-side via `fetch()`, then wires the mobile nav. It also loads GA4 (`G-QVNK5XS5R8`). All shared chrome lives in these partials — do not duplicate it.
- Blog lives in `/blog/`:
  - `blog/index.html` — hand-maintained list of `<a class="post-row">` cards (newest first). Each card has `.post-meta-col` (`.post-type`, `.post-date`), `.post-title`, `.post-excerpt`, and a `.post-arrow`.
  - `blog/_template.html` — the canonical post template.
  - Existing posts to migrate: `its-time-to-align-your-perspective.html`, `you-are-turning-the-corner.html`, `the-swelling-of-the-tsunami-wave.html`, `the-seven-mountains.html`.
- Post pages use these classes from `styles.css`: `article-head`, `back-link`, `article-type`, `article-title`, `article-date`, `article-rule`, `article-body`, `lead`, `blockquote`, `h2`, `ul/li`, `article-foot`. Reuse them exactly — do not add new CSS unless unavoidable.
- Post HTML structure (must be reproduced exactly by the build):
  - Standalone `<!doctype html>` document.
  - `<head>`: charset, viewport, `<title>{title} — Kirsten Rossiter</title>`, `<meta name="description">`, the Google Fonts preconnect/stylesheet block, and `<link rel="stylesheet" href="../styles.css" />`.
  - `<body>`: `<div data-include="../partials/nav.html"></div>`, then `<header class="article-head">` (with `.back-link` → `/blog/`, `.article-type`, `.article-title`, `.article-date`, `.article-rule`), then `<article class="article-body">` (the rendered post body), then `<div class="article-foot">` linking back to `/blog/`, then `<div data-include="../partials/footer.html"></div>`, then `<script src="../includes.js"></script>`.
- Cloudflare Pages Functions already exist under `functions/` (Stripe, contact, subscribe). Don't disturb them.

## Content model
Author posts as Markdown in `blog/posts/<slug>.md`. Frontmatter schema:

```yaml
---
title: It's time to align your perspective
type: Prophetic Insight        # shown as .post-type / .article-type
date: 2026-06-22               # ISO; render as "22 June 2026" for display
excerpt: A new season requires new eyes...   # used on the index card
description: A short summary for SEO/link previews   # <meta name="description">
draft: false                   # if true, skip from build + index
---
Markdown body here...
```

- Slug = filename (lowercase, hyphenated) → output path `/blog/<slug>.html`. Preserve existing slugs exactly when migrating so live URLs don't change.
- Date display format must match existing posts: `D MMMM YYYY` (e.g. `22 June 2026`), no leading zero on the day.

## Build script (`build-blog.js`, Node, no heavy deps)
- Use a small, well-known Markdown library (e.g. `marked`) and a frontmatter parser (e.g. `gray-matter`). Add a minimal `package.json` with these as the only runtime deps. Keep it simple — no bundler.
- For each non-draft `blog/posts/*.md`:
  - Render the Markdown body to HTML. Map output to the existing classes: the first paragraph should get `class="lead"` (match current posts), `##` → `<h2>`, blockquotes → `<blockquote>`, lists → `<ul><li>`.
  - Inject into the post template structure described above and write `blog/<slug>.html`.
- Regenerate `blog/index.html` automatically: sort non-draft posts by date descending and emit one `<a class="post-row">` card per post using `type`, formatted `date`, `title`, `excerpt`, and `href="/blog/<slug>.html"`. Keep the existing `blog-hero` header and surrounding markup intact — only the post-row list inside `<main class="blog-list"><div class="container">` is generated.
- The script must be idempotent and produce output identical to the current hand-written files for the migrated posts (verify with a diff — see acceptance criteria).
- Treat generated `blog/*.html` as build artifacts. Decide and document one of: (a) commit generated HTML so the site works even if the build is skipped, or (b) gitignore them and rely on the Cloudflare build. Prefer (a) for safety given the current zero-build deploy. State the choice in the README.

## Sveltia CMS (`/admin`)
- Add `admin/index.html` loading Sveltia CMS, and `admin/config.yml`.
- Backend: GitHub, repo `Boyzeeboy/Kirsten-Rossiter`, branch `main` (or `production` if that's the deploy branch — confirm). Use Sveltia's GitHub OAuth.
- Collection `blog` → folder `blog/posts`, format frontmatter+Markdown, fields matching the schema above: `title` (string), `type` (select: Prophetic Insight, Teaching, Reflection), `date` (datetime), `excerpt` (text), `description` (text), `draft` (boolean), `body` (markdown).
- Configure the media/preview so the editor experience is clean; image uploads (if any) should land somewhere sensible under the repo and resolve correctly on the live site.
- Document the OAuth setup step (Sveltia supports a Cloudflare-hosted OAuth handler or GitHub App) in the README — this is a one-time config the site owner does in Cloudflare/GitHub; the code should be ready for it.

## Cloudflare Pages
- Set build command to `npm install && node build-blog.js` and output directory to the repo root (or document the exact settings to enter in the dashboard).
- Confirm this does not break the existing Functions deploy.

## Constraints
- No change to look/feel. Reuse `styles.css`; add CSS only if strictly required and call it out.
- Keep `includes.js` partial-injection working — every generated page must include the nav/footer `data-include` divs and load `../includes.js`.
- Don't change existing post URLs.
- Keep dependencies minimal and pinned.

## Deliverables
1. `blog/posts/*.md` — the four existing posts migrated to Markdown (identical rendered output).
2. `build-blog.js` + `package.json`.
3. `admin/index.html` + `admin/config.yml`.
4. A short `BLOG.md` README: how to write a post, how to run the build locally (`node build-blog.js`), the Cloudflare build settings, and the one-time Sveltia OAuth setup.
5. Everything on branch `feature/blog-cms` with a clear PR description.

## Acceptance criteria
- Running `node build-blog.js` on the migrated Markdown produces `blog/*.html` whose rendered output matches the current live posts (diff the meaningful HTML; whitespace-only differences are acceptable). Verify at least one migrated post against its current file.
- `blog/index.html` is regenerated with all non-draft posts in date-descending order, cards identical in structure to the current ones.
- A new test post added as Markdown appears correctly both as its own page and on the index after a build — with no hand-editing of HTML.
- Nav/footer inject correctly and the mobile menu works on generated pages (served over http, not file://).
- No regressions to `functions/`, contact/subscribe/Stripe flows, or GA4.
