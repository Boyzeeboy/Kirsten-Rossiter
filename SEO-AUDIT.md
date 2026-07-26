# On-Page SEO Audit — Kirsten Rossiter

**Date:** 22 July 2026 (rewritten — supersedes the earlier draft in full)
**Scope:** 10 HTML pages in the repo, the build pipeline (`build-blog.js`,
`includes.js`, `scripts/sync-tokens.sh`), `robots.txt`, `sitemap.xml`, and live
checks against `www.kirstenrossiter.com` and `kirstenrossiter.com`.

**Why this was rewritten:** the first version of this audit never checked
`www.kirstenrossiter.com`. It checked the apex and the `pages.dev` URL only,
concluded the site was not live, and built its central recommendation on that
error — including advice that would have moved the domain's nameservers to
Cloudflare, which puts Kirsten's email at risk, and advice to canonicalise on a
hostname that serves a different, older site. Both are corrected below.

---

## The two constraints this audit works within

Every recommendation here has been checked against these. Anything that
violates them has been removed, not softened.

**1. Email must not move.** `kirsten@kirstenrossiter.com` and
`webmaster@kirstenrossiter.com` live at Xneelo. The domain's nameservers stay at
Xneelo, and the **MX records** and **root SPF `TXT`** are never touched. This is
the governing rule in `LAUNCH-DAY.md`. Consequence for SEO: Cloudflare Pages
cannot serve the bare apex (Pages only serves an apex if the domain is a
Cloudflare zone), so **`www.kirstenrossiter.com` is the canonical host** and the
apex redirects to it. Every canonical, OG URL and sitemap entry in this document
uses `www`.

**2. The token pipeline is the source of truth for design values.**
`vendor/tokens.css` is synced from a git-tag-pinned package
(`kirsten-rossiter-tokens#v0.2.0`) and committed. Nothing in this audit changes
a colour, size or family, and nothing here goes near `vendor/tokens.css`. Where
a recommendation touches the build, it says explicitly what must not break.

---

## What is actually live (verified 22 July 2026)

| URL | What it serves | Status |
|---|---|---|
| `https://www.kirstenrossiter.com` | **The current site.** Correct hero, correct copy, all five blog posts including *We are fighting a territorial spirit*. | Correct |
| `https://kirstenrossiter.com` (apex) | **The old site.** "Latest videos from Kirsten Rossiter", old cookie notice, old hero copy. Still served by the Xneelo hosting package. | Broken |
| `https://kirsten-rossiter.pages.dev` | Current site. Not verified in this pass — confirm before acting on finding #2. | Check |

So the launch largely worked. `www` is live and correct. What did not happen is
the last step of the cutover.

---

## CRITICAL

### 1. The apex still serves the old site — the redirect was never set up

This is **Step 3c of `LAUNCH-DAY.md`**, and it is the only genuinely critical
item. The apex keeps resolving to the Xneelo web server, which is exactly the
intended architecture — but that server was never configured to issue the 301 to
`https://www.kirstenrossiter.com`. So it carries on serving the old website.

Consequences:

- Anyone typing `kirstenrossiter.com` gets the 2022 site.
- Google may index both hostnames, splitting authority between your current site
  and your own obsolete one.
- `robots.txt` and `sitemap.xml` both advertise apex URLs (finding #2), so
  you are actively pointing crawlers at the old site.
- Any Search Console property registered on the apex is reporting on the old
  site, not this one.

**Action:** set up a 301 redirect from `kirstenrossiter.com` to
`https://www.kirstenrossiter.com` on the **Xneelo hosting package**. This is a
web-server config change (`.htaccess` or Xneelo's redirect tool), not a DNS
change. Leave the apex `A` record pointing at Xneelo. Preserve the path — the
redirect should send `/blog/foo` to `https://www.kirstenrossiter.com/blog/foo`,
not dump everything on the homepage.

**Do not** add `kirstenrossiter.com` to Cloudflare Pages Custom domains. Pages
cannot serve a bare apex unless the domain is a Cloudflare zone, and making it
one means moving nameservers off Xneelo — which moves your MX and root SPF with
them. `www` is already correctly configured in Pages; leave the apex alone.

**Effort:** 15–30 minutes. **Impact:** critical.

---

## HIGH

### 2. `robots.txt` and `sitemap.xml` point crawlers at the old site

Both files use apex URLs. `robots.txt` advertises
`Sitemap: https://kirstenrossiter.com/sitemap.xml`, and all nine sitemap entries
are `https://kirstenrossiter.com/...`.

Until finding #1 is fixed, those URLs resolve to the old website. After #1 is
fixed they will 301, which works but wastes crawl budget and is sloppy. Either
way they should be `www`.

The sitemap has four separate problems:

```
Wrong host:   all 9 URLs use the apex, not www
Missing:      /blog/we-are-fighting-a-territorial-spirit  (live, not listed)
Stale:        every lastmod says 2026-07-04
Mismatched:   lists .html URLs; your internal links are extensionless
Obsolete:     <priority> values (Google has ignored these for years)
```

The fifth post exists at `blog/posts/we-are-fighting-a-territorial-spirit.md`,
is built by `build-blog.js`, and is live — but `sitemap.xml` is hand-maintained
and was never updated. It will fall out of date again on the next post.

**Action, in two parts.** First, a five-minute manual fix to `robots.txt` and
`sitemap.xml` to switch to `www` and add the missing post — do this immediately,
it stops the bleeding. Then, generate `sitemap.xml` inside `build-blog.js` from
the actual post list, with real `lastmod` dates from frontmatter, `www` URLs, and
no `<priority>`. Exclude `thank-you.html` (it is `noindex`) and
`blog/_template.html` (see finding #7).

**Effort:** 5 min + 1 hr. **Impact:** high.

### 3. Nav and footer are invisible to crawlers

`includes.js` injects the nav and footer client-side via `fetch()`. Googlebot
renders JavaScript, but on a delayed second pass and without guarantee; Bing,
AI crawlers, social scrapers and most SEO tools largely do not.

Internal links present in the **raw HTML** (before JavaScript):

| Page | Internal links in HTML |
|---|---|
| `contact.html` | **0** |
| each blog post | 1 |
| `building-the-nations.html` | 1 |
| `index.html` | 5 |
| `terms.html` | full nav (hardcoded — see below) |

Your site architecture — the signal telling Google which pages matter and how
they relate — exists only after JavaScript runs. `contact.html` is an orphan.

Note that `terms.html` already has a **hardcoded** nav rather than the partial.
That inconsistency is a bug in its own right, but it does demonstrate the fix.

**Action:** move the nav and footer into the build step so the links ship in the
HTML, keeping `partials/nav.html` and `partials/footer.html` as the single
source of truth.

**Three things that will break if you do this naively:**

1. **Cloudflare runs no build command.** `SETUP.md` is explicit: Pages
   auto-detects `functions/` and you add no build step. `build-blog.js` runs
   locally and you commit its output. So "inline at build time" means the build
   rewrites files that are committed to git. Use the **marker-comment pattern
   already proven in this repo** for the homepage insights block
   (`<!-- INSIGHTS:START ... -->` / `<!-- INSIGHTS:END -->`) — add
   `NAV:START/END` and `FOOTER:START/END` markers and replace only between them.
   Do not have the build rewrite whole files.
2. **The mobile nav will die silently.** `initNav()` in `includes.js` binds the
   hamburger only inside `Promise.all(jobs).then(initNav)`. If there are no
   `data-include` nodes left, that promise resolves with nothing and — depending
   on how you refactor — the handler may never bind to a nav that is now already
   in the DOM. Rewire `initNav()` to run on `DOMContentLoaded` independently of
   the include loader, and test the hamburger at mobile width before pushing.
3. **Analytics goes with it.** `includes.js` also injects the Cloudflare Web
   Analytics beacon (`static.cloudflareinsights.com/beacon.min.js`; GA4 was
   removed 23 Jul 2026). If you delete the script once the partials are inlined,
   analytics stops. Keep `includes.js` (with the fetch logic removed) or move the
   beacon into the inlined footer. See finding #10.

`build-blog.js` currently generates the blog pages only. `index.html`,
`contact.html`, `building-the-nations.html` and `terms.html` are hand-authored,
so the inlining step needs to walk those too.

**Effort:** 1–2 hrs. **Impact:** high. Highest-value change after #1.

### 4. No canonical tags anywhere

Zero of the 10 pages have `<link rel="canonical">`. Confirmed by grep across all
HTML and the `build-blog.js` templates.

You have duplication risk on four axes simultaneously:

- apex vs `www` (live and real today — the apex serves different content)
- `www.kirstenrossiter.com` vs `kirsten-rossiter.pages.dev`
- `/contact.html` vs `/contact` — Cloudflare Pages serves both, your internal
  links use the extensionless form, and your sitemap lists the `.html` form
- your own build script is inconsistent: `buildIndex()` links posts as
  `/blog/${slug}.html` while `buildHomepageInsights()` links them as
  `/blog/${slug}`

**Action:** add a self-referencing absolute canonical to every page on the `www`
host, using the extensionless form:

```html
<link rel="canonical" href="https://www.kirstenrossiter.com/contact" />
```

And fix the build-script inconsistency in the same commit — make
`buildIndex()` emit extensionless URLs to match `buildHomepageInsights()`.

**Do not canonicalise on the apex.** Until #1 is fixed that points Google at a
different, older site, which is worse than having no canonical at all.

**Effort:** 30 min. **Impact:** high.

### 5. No Open Graph or Twitter Card tags

Zero of the 10 pages have any. Shared to WhatsApp, Facebook, Instagram or X, a
blog post or the book page renders as a bare grey link — no title, no
description, no image.

For a ministry whose distribution is substantially word-of-mouth and social
sharing, this directly suppresses the traffic you are most likely to actually
get. Not a ranking factor; very much a click-through factor.

```html
<meta property="og:type" content="article" />
<meta property="og:title" content="..." />
<meta property="og:description" content="..." />
<meta property="og:image" content="https://www.kirstenrossiter.com/building-the-nations-cover.jpg" />
<meta property="og:url" content="https://www.kirstenrossiter.com/..." />
<meta name="twitter:card" content="summary_large_image" />
```

Use the **JPEG**, not the WebP — some scrapers still do not handle WebP. Absolute
`www` URLs (OG images must be absolute). Ideal size is 1200×630; the current
cover is portrait, so consider a purpose-made landscape share image.

**Effort:** 1 hr. **Impact:** high.

### 6. No structured data

No JSON-LD on any page. Three schema types map almost exactly onto what you
have:

- **`Person`** on the homepage — establishes Kirsten as an entity, feeds the
  Knowledge Graph, links her social profiles. This is how Google learns that the
  query "Kirsten Rossiter" refers to a specific author with a specific book
  rather than a string of text.
- **`Book`** on `building-the-nations` — author, format, price, availability.
- **`BlogPosting`** on each post — author attribution and publish dates, both of
  which you already have in frontmatter.

**Effort:** 1–2 hrs. **Impact:** high.

> **Findings #4, #5, #6 and #8 are all edits to the same `<head>` block.** For
> the four hand-authored pages, edit the files. For the blog pages, **edit the
> template strings inside `build-blog.js`, not the generated `.html` files** —
> the next build overwrites them, and the script also deletes any `.html` in
> `blog/` with no matching `.md`. Do these as one piece of work.

---

## MEDIUM

### 7. `blog/_template.html` is deployed and probably indexable

It sits in `blog/`, carries an H1 and the Ahrefs tag, and `build-blog.js`
explicitly skips it when cleaning up orphaned HTML — so it ships. It is a
scaffold file with no real content, publicly fetchable at
`/blog/_template.html`.

**Action:** either add `<meta name="robots" content="noindex">` to it, move it
out of the deployed directory, or delete it if the build no longer needs it.
Also add `Disallow: /blog/_template.html` to `robots.txt` if it stays.

### 8. Images have no dimensions and no lazy-loading

All four `<img>` tags site-wide (three in `index.html`, one in
`building-the-nations.html`) lack `width`, `height` and `loading`.

Missing dimensions cause **Cumulative Layout Shift** — the page jumps as images
load — a Core Web Vitals ranking factor. Add explicit `width` and `height`;
the browser uses them to reserve space, and your CSS still controls display
size, so **this does not conflict with the token pipeline**.

For `loading`: `loading="eager"` + `fetchpriority="high"` on the hero book
cover; `loading="lazy"` on the below-fold author photo and the second cover.

Alt text is already 100% covered and descriptive. Leave it.

### 9. Two pages bypass the token pipeline

`contact.html` and `thank-you.html` each carry an inline `<style>` block with
hardcoded colour literals — ten and six respectively, including `#FBF8F2`,
`#1A2235`, `#A07840` and several `rgba()` values that duplicate token values
already in `vendor/tokens.css`.

This is not an SEO finding, but it is the kind of drift the pipeline exists to
prevent, and it surfaced while auditing those pages. If the gold or navy ever
change upstream, these two pages silently keep the old values.

**Action:** replace the literals with the corresponding `--kr-*` custom
properties. Low urgency, but log it so it does not get forgotten.

### 10. Two analytics products, one probably unnecessary

Ahrefs analytics is hardcoded into all 11 HTML files including `_template.html`;
Cloudflare Web Analytics loads via `includes.js` (this replaced GA4 on
23 Jul 2026). The Ahrefs tag is `async` so it does not block rendering, but you
are running two analytics products and paying a third-party request for one you
likely no longer read.

**Action:** Cloudflare is now the chosen analytics, so remove the Ahrefs tag from
all pages (and the `build-blog.js` templates) — free performance win, one fewer
third-party request. Sequence this **with** finding #3, since that work is
already in these files and in `includes.js`.

### 11. `building-the-nations.html` is thin for a commercial page

Visible word counts (markup, CSS and JS stripped):

| Page | Words |
|---|---|
| `contact.html` | 69 |
| `blog/index.html` | 230 |
| `blog/miracles-happen-in-the-valley.html` | 450 |
| `building-the-nations.html` | 475 |
| `index.html` | 722 |

`contact.html` at 69 words is thin, but that is fine for a contact page and not
one you need to rank.

`building-the-nations.html` is the meaningful gap. **This is your commercial
page** — the one that needs to rank for "Building the Nations from the Ground
Up" and convert. At 475 words it is light. Worth adding an excerpt or first
chapter, endorsements, a fuller author bio, and an FAQ covering format, delivery
and refunds. All of that serves conversion at least as much as ranking.

### 12. One blog post is a wall of text

`blog/miracles-happen-in-the-valley.html` is 450 words with **zero subheadings**
— just its H1. The other three posts have 6, 8 and 12 `<h2>`s. Add subheadings
to the source markdown.

Two meta descriptions also exceed the ~155-character display limit and will
truncate: `you-are-turning-the-corner` (171) and
`its-time-to-align-your-perspective` (187). Minor.

---

## What is already right

Stating these plainly, because they are the things usually broken:

- **Titles** — all 10 unique, 26–58 characters, all within display limits,
  consistent `— Kirsten Rossiter` branding.
- **Meta descriptions** — present on 9 of 10 and genuinely well written.
- **H1s** — exactly one per page, all 10 pages.
- **Heading hierarchy** — clean `h1 → h2 → h3`, no skipped levels.
- **Alt text** — 100% coverage, descriptive rather than keyword-stuffed.
- **`thank-you.html`** — correctly `noindex`.
- **`robots.txt`** — structurally correct, `/admin/` properly disallowed. Only
  the sitemap hostname is wrong.
- **Semantic HTML** — proper `<nav>`, `<footer>`, `<section>` throughout.
- **Oversized JPEGs are not hurting you.** `building-the-nations-cover.jpg`
  (946 KB) and `kirsten-rossiter.jpeg` (435 KB) sit in the repo unreferenced —
  the pages correctly serve the WebP versions. Keep the JPEG cover, you need it
  for the OG image in #5. `kirsten-rossiter.jpeg` can go.
- **The blog build is sound.** Frontmatter-driven, deletes orphaned HTML,
  auto-populates the homepage insights. Findings #2 and #3 extend it rather than
  replace it.

---

## Priority order

| # | Action | Effort | Impact | Touches |
|---|---|---|---|---|
| 1 | Apex → `www` 301 on **Xneelo hosting** | 30 min | Critical | Web server config. **No DNS, no MX, no SPF.** |
| 2 | Fix `robots.txt` + `sitemap.xml` to `www`, add missing post | 5 min | High | Two static files |
| 3 | Inline nav/footer at build time | 1–2 hrs | High | `build-blog.js`, `includes.js`. See the three breakage risks. |
| 4 | Canonicals (`www`, extensionless) + fix build URL inconsistency | 30 min | High | `<head>` + `build-blog.js` |
| 5 | OG + Twitter Card tags | 1 hr | High | `<head>` + `build-blog.js` |
| 6 | JSON-LD (Person, Book, BlogPosting) | 1–2 hrs | High | `<head>` + `build-blog.js` |
| 7 | Auto-generate sitemap in build | 1 hr | High | `build-blog.js` |
| 8 | `_template.html` noindex or remove | 10 min | Medium | One file |
| 9 | Image `width`/`height` + `loading` | 20 min | Medium | Two files. No token impact. |
| 10 | Expand `building-the-nations` content | 2–3 hrs | Medium | Copy work |
| 11 | Detokenised colours in `contact` / `thank-you` | 30 min | Low | Pipeline hygiene, not SEO |
| 12 | Subheadings in `miracles-happen-in-the-valley` | 20 min | Low | Source markdown |
| 13 | Remove Ahrefs tag (Cloudflare is now the analytics) | 10 min | Low | Do alongside #3 |

Items 4, 5, 6 and 9 are the same `<head>` block and the same build step — do
them as one commit.

---

## Verification after each change

Because Cloudflare runs no build command, **the deployed site is whatever you
committed**. Run `npm run build` locally and check the diff before pushing, or
the generated blog pages and the homepage insights block will drift from source.

After #1: `curl -I https://kirstenrossiter.com/blog/` should return `301` with a
`Location` of `https://www.kirstenrossiter.com/blog/`. Then confirm in Xneelo
that the MX records and root SPF `TXT` are byte-identical to the screenshots
from launch day, and send a test email to both mailboxes.

After #3: load a blog post with JavaScript disabled and confirm the nav and
footer links are in the HTML. Then re-enable and test the hamburger at mobile
width.

---

## A note on measurement

Once the apex redirect is in, **Search Console matters more than Analytics** for
this work. Register the property on `https://www.kirstenrossiter.com` — the
`www` hostname, not the apex, and not the `pages.dev` domain. GA4 tells you what
visitors did after arriving; Search Console tells you which queries you appear
for, your impressions and click-through rate, and whether Google can index the
pages at all. Findings #1, #2, #3 and #6 all show up as Search Console problems
long before they show up in GA4.

If a Search Console property already exists on the apex, it has been reporting
on the old site. Keep it — after the 301 it becomes useful for watching the old
URLs drop out — but treat the `www` property as the real one.
