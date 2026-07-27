# Next session — 26 July 2026

Items 1 and 2 of `SEO-AUDIT.md` are **done, committed and live**. What follows is
items 3–7, plus three things that surfaced on 26 Jul and need clearing first.

---

## Start here — three blockers, in this order

### 0A. The repo's build output is stale — rebuild and commit

`blog/posts/we-are-fighting-a-territorial-spirit.md` was committed in `6cb203e`
but **nothing was rebuilt**. Running `npm run build` on a clean checkout of HEAD
produces three changes:

```
new:      blog/we-are-fighting-a-territorial-spirit.html   (never existed in git)
changed:  blog/index.html    — missing the post row
changed:  index.html         — missing the post's insight card
```

The diffs are purely the missing post; no hand-edits get clobbered. Verified in a
scratch checkout on 26 Jul.

**Do this first**, before items 3–7, so build drift doesn't get tangled into
those diffs.

```bash
npm run build && git diff --stat
```

### 0B. Palette regression — the whole site's background shifted

`c98ccc6` upgraded tokens `v0.2.0 → v1.0.0`. That commit touched
`vendor/tokens.css`, `package.json`, `package-lock.json` and
`building-the-nations.html` — **it did not touch `styles.css`**.

v1.0.0 renumbered the neutral ramp down two steps:

| primitive | v0.2.0 | v1.0.0 |
|---|---|---|
| `neutral-50` | `#faf7f2` | `#ede6d8` |
| `neutral-100` | `#f5f0e8` | `#e2d9c8` |
| `neutral-200` | `#ede6d8` | `#d4c9b4` |
| `neutral-300` | `#e2d9c8` | `#b8a990` |
| `neutral-900` | `#3d3830` | `#221c14` |
| `gold-200` | `#e8d9bc` | `#d4bf94` |
| `gold-400` | `#c4a264` | `#b28a50` |

`styles.css` aliases point at **primitives**, so they moved with the ramp:

- `--cream: var(--kr-primitives-neutral-100)` → body background site-wide went
  `#f5f0e8` → `#e2d9c8`. Noticeably darker and tanner. **This is live.**
- `--cream-mid`, `--cream-deep`, `--ink-warm`, `--ink-mid`, `--ink-soft`,
  `--gold-light`, `--gold-pale` all shifted too.
- But `--cream-overlay` through `--cream-faint` (`styles.css:30–36`) are
  hardcoded `rgba(245, 240, 232, …)` — the **old** cream. So solid creams moved
  and translucent creams didn't. The family is now internally inconsistent.

**Decision needed:** was the darker background intended?

- **If no** (most likely — the alias layer was never reviewed): repoint the
  aliases at **semantic** tokens rather than primitives. `--kr-colour-background-
  default` is still `#f5f0e8`, so `--cream: var(--kr-colour-background-default)`
  restores the original *and* is the more correct use of the pipeline.
- **If yes**: update the six hardcoded `rgba(245, 240, 232, …)` values to the new
  cream so the family is consistent again.

Either way, add a note to `SETUP.md` that a token version bump requires
re-reviewing the `styles.css` alias block — that's the trap that caused this.

**This also reframes audit item 11.** `contact.html` and `thank-you.html` carry
hardcoded literals on the **old** palette (`#F5F0E8`, `#1C1814`, `#A07840`,
`rgba(28,24,20,…)`, `rgba(160,120,64,.32)`). Worse: `thank-you.html` links
**neither** `styles.css` nor `vendor/tokens.css` — it is fully standalone, and is
now the only page still rendering the original cream. `contact.html` does link
both but overrides `--paper`, `--navy`, `--ink-60`, `--ink-40` and `--gold-soft`
locally. So item 11 is no longer "pipeline hygiene, low urgency" — it's a visible
inconsistency. Fold it into the 0B fix.

### 0C. Verify whether Cloudflare Pages runs a build command

The live site serves `/blog/we-are-fighting-a-territorial-spirit` (200), and both
`/blog/` and the homepage list it — content that **exists nowhere in git**. That
means Pages is building, which contradicts `SETUP.md` and the premise of audit
finding #3, breakage-risk #1 ("Cloudflare runs no build command… so the build
must rewrite files committed to git").

**Check Cloudflare Pages → Settings → Builds & deployments for the build command
before designing item 3.** If a build genuinely runs there, the marker-comment
approach (`NAV:START/END`) is unnecessary and item 3 gets considerably simpler.
Correct `SETUP.md` either way.

---

## Item 3 — inline nav and footer at build time

Audit finding #3. Highest-value remaining SEO item. `contact.html` currently
ships **zero** internal links in raw HTML; blog posts ship one.

Confirmed state on 26 Jul:

- 10 pages use `data-include` for `partials/nav.html` + `partials/footer.html`.
- `terms.html` is the outlier — it already has a hardcoded nav.
- `initNav()` is bound inside `Promise.all(jobs).then(initNav)`
  (`includes.js:72`). Remove the includes and **the hamburger silently stops
  binding**. Rewire it to run on `DOMContentLoaded` independently, and test at
  mobile width before pushing.
- The Cloudflare Web Analytics beacon lives in `includes.js:20–31` and must
  survive. Keep `includes.js` (fetch logic stripped) or move the beacon into the
  inlined footer — it must be a real `<script>` element, not injected via
  `innerHTML`.
- `build-blog.js` generates blog pages only. `index.html`, `contact.html`,
  `building-the-nations.html` and `terms.html` are hand-authored, so the inlining
  step has to walk those too.

**Do audit item 13 in the same pass:** the Ahrefs tag is still hardcoded in all
11 HTML files *and* in the `build-blog.js` templates. Cloudflare is the chosen
analytics now, so drop Ahrefs — you're in these exact files anyway.

**Verify:** load a blog post with JavaScript disabled, confirm nav and footer
links are in the HTML. Re-enable, test the hamburger at mobile width.

---

## Items 4, 5, 6, 9 — one `<head>` commit

Do these together. Same block, same build step.

- **4 — Canonicals.** Self-referencing absolute, `www` host, extensionless:
  `<link rel="canonical" href="https://www.kirstenrossiter.com/contact" />`.
  Fix the URL inconsistency in the same commit — **it's live right now**:
  `/blog/` links posts as `.html` (`buildIndex()`), the homepage links them
  extensionless (`buildHomepageInsights()`), and the sitemap uses extensionless.
  Make `buildIndex()` match.
- **5 — OG + Twitter Card.** Use the **JPEG** cover, not the WebP. Absolute `www`
  URLs. Ideal 1200×630; the cover is portrait, so consider a purpose-made
  landscape share image.
- **6 — JSON-LD.** `Person` on the homepage, `Book` on `building-the-nations`,
  `BlogPosting` on each post (author + dates already in frontmatter).
- **9 — Images.** `width`/`height` on all four `<img>` tags (CLS), plus
  `loading="eager"` + `fetchpriority="high"` on the hero cover and
  `loading="lazy"` on the author photo and second cover.

**For blog pages, edit the template strings in `build-blog.js`** (`buildPost()`
at line 44, `buildIndex()` at line 100) — **not** the generated `.html`. The next
build overwrites them, and the script deletes any `.html` in `blog/` with no
matching `.md`.

---

## Item 7 — auto-generate the sitemap in `build-blog.js`

Worth pulling forward to sit right after item 3, rather than leaving it last.
The hand-maintained sitemap is exactly what produced the missing post in the
first place, and it will go stale again on the next one.

Generate from the actual post list: `www` URLs, extensionless, real `lastmod`
from frontmatter, no `<priority>`. Exclude `thank-you` (noindex) and
`blog/_template.html`.

**Item 8 while you're here:** `/blog/_template.html` is live and reachable —
it 308s to `/blog/_template`. Add `noindex`, move it out of `blog/`, or delete
it. Add `Disallow: /blog/_template.html` to `robots.txt` if it stays.

---

## Remaining audit items (not scheduled)

| # | Item | Effort |
|---|---|---|
| 10 | Expand `building-the-nations` — 475 words for a commercial page | 2–3 hrs |
| 12 | Subheadings in `miracles-happen-in-the-valley`; two over-long meta descriptions | 20 min |

---

## Follow-ups with dates

- **~mid-Aug 2026 — Search Console Pages report.** "Crawled – currently not
  indexed" (8) should shrink now Google has recrawled with the redirect and new
  sitemap. Also review the 18 404s and redirect any that are real old blog URLs.
- **Weekly, Mondays ~08:30** — scheduled task `kr-seo-health-check` checks
  redirect, sitemap, robots and indexability on the live site.
- **Orphaned WordPress MySQL database** at Xneelo — harmless, drop when
  convenient.

---

## Verification rules that always apply

- **The deployed site is whatever you committed** (pending 0C). Run
  `npm run build` locally and check the diff before pushing.
- **Never touch MX or root SPF** on `kirstenrossiter.com`. Nameservers stay at
  Xneelo. Baseline in `DNS-BASELINE-2026-07-23.md`.
- **Never edit `vendor/tokens.css`** — it's generated. Change values upstream in
  the token pipeline and re-sync.

---

## Progress log

**23 Jul 2026 — Item 1 DONE (apex → www 301).**
Root cause: `public_html/.htaccess` had a mod_alias `Redirect permanent /` on the
last line, but the WordPress mod_rewrite block above it ran on every request and
suppressed mod_alias, so the redirect never fired — dead since the Xneelo
redirect tool added it on 25 Jun 2026. Fixed with a top-of-file mod_rewrite 301,
path-preserving, `.well-known` excluded for SSL renewal. Replacement in
`xneelo-htaccess-redirect.txt`, original in
`xneelo-htaccess-backup-2026-07-23.txt`. Verified live. DNS untouched; baseline
in `DNS-BASELINE-2026-07-23.md`. WordPress deleted from `public_html`.

**23 Jul 2026 — Item 2 DONE (robots.txt + sitemap.xml).** Committed as `068b3f8`
and live. `www` host, extensionless URLs, missing post added, real `lastmod`
dates, `<priority>` dropped, `thank-you` excluded. Validated with xmllint.

**23 Jul 2026 — Search Console reviewed, monitoring set up.** Verified Domain
property `sc-domain:kirstenrossiter.com`. New sitemap submitted: Success, 10
pages. No manual actions, no security issues. Pre-migration snapshot (10 Jul):
13 indexed / 33 not — 404 (18, old WP URLs), redirect (6, apex→www), noindex (1,
thank-you), crawled-not-indexed (8).

**23 Jul 2026 — Analytics switched (Warren).** GA4 removed; `includes.js` now
injects the Cloudflare Web Analytics beacon. Committed as `c686841`.

**26 Jul 2026 — MailPoet DNS records removed (Warren).** The two
`mailpoet1`/`mailpoet2` `_domainkey` CNAMEs and the `_mailpoet` TXT are gone.
Item 1 fully closed.

**26 Jul 2026 — Three issues found while reviewing (see 0A/0B/0C above):** stale
build output, the v1.0.0 palette regression in the `styles.css` alias layer, and
evidence that Cloudflare Pages is running a build after all.
