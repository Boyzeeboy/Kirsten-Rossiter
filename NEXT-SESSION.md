# Next session — 26 July 2026

Items 1, 2 and 9 of `SEO-AUDIT.md` are **done, committed and live**. What follows
is items 3–8 and 10–12, plus three things that surfaced on 26 Jul — all three now
closed (0A automated 27 Jul, 0C answered 27 Jul, 0B fixed 06 Aug), each leaving
follow-ups noted in place.

> **`SEO-AUDIT.md` owns the item numbers.** This file's cross-references drifted
> from them — both documents were written in `38ae2bc` and the numbering was
> wrong from that day, never renumbered since. Reconciled throughout on
> 07 Aug 2026. If the two ever disagree again, the audit is right.

---

## The three 26 Jul blockers — all closed

Kept for their reasoning and for the loose ends each one left behind. Nothing
here blocks items 3–8 any more; **start at item 3.**

### 0A. The repo's build output is stale — rebuild and commit — ✅ AUTOMATED 27 Jul

**No longer a recurring chore.** `.github/workflows/build-blog.yml` runs the
build on every push to `main` and commits the result, so committed HTML can no
longer fall behind its markdown. See *Automated build* in `BLOG.md`.

It bit again on 27 Jul in a nastier form than described below: a CMS edit and a
local build touch **different files**, so git merged the two sides with no
conflict at all while the HTML stayed built from pre-edit markdown. The rejected
push was the visible symptom; the clean-but-wrong merge was the real hazard.

Original note from 26 Jul, kept for context:

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

**Do this first**, before items 3–8, so build drift doesn't get tangled into
those diffs.

```bash
npm run build && git diff --stat
```

### 0B. Palette regression — ✅ FIXED 06 Aug 2026

**Fixed in #12, #13 and #14.** The `styles.css` alias block now consumes semantic
tokens only, and a lint gate stops it drifting back.

The original note below called this correctly: the aliases pointed at primitives,
the ramp moved under them, and repointing at semantic tokens was the right fix.
It was acted on as written.

| Alias | Was | Now | |
|---|---|---|---|
| `--cream` | `#e2d9c8` | `#f5f0e8` | `background/default` |
| `--cream-mid` | `#d4c9b4` | `#ede6d8` | `background/subtle` |
| `--cream-deep` | `#b8a990` | `#e2d9c8` | `background/muted` |
| `--ink-mid` | `#e2d9c8` | `#3d3830` | `text/secondary` |
| `--ink-warm` | `#ede6d8` | *deleted* | had no consumers |

The `--cream-*` alpha family (`rgba(245, 240, 232, …)`) was never migrated, so it
still held the **original** cream — which means `--cream` now agrees with its own
translucent variants again. The internal inconsistency is gone.

**One correction to the note below.** It lists `--ink-warm` and `--ink-mid` among
the aliases that "shifted too" with the ramp. They didn't — they were a separate,
older defect. `68a45e5` mapped them to `neutral-50` / `neutral-100`, which at
v0.2.0 were `#faf7f2` / `#f5f0e8`, while their originals were `#221c14` /
`#2e2820`. They were mirrored across the scale and had been wrong since the day
they were written. The visible symptom was the `.about-portrait` gradient running
pale cream → near-black instead of staying dark.

**Also resolved, contrary to the note:** `--gold-light` was deliberately
repointed in pass 2 (`c54e599`) with its visible change documented, and
`--gold-pale` no longer exists — it went with dead CSS in `60abd66`. Neither is
outstanding.

**`--ink-soft` is correct as it stands — checked against Figma 06 Aug 2026.**
An earlier version of this note listed it as unfixed v1.0.0 drift, on the
reasoning that its pre-pipeline value was `#3d3830` and it now resolves to
`#221c14`. That reasoning was wrong. `--ink-soft` aliases
`--kr-colour-text-primary`, which is `semantic/text/primary` in Figma — the
correct semantic home for body text. The value arrived by drift; the mapping is
right, and the mapping is what governs. Body text is darker than the July 2026
original **by design**. Nothing to do.

**Still open from this item:**

- ~~The `SETUP.md` note.~~ — **done 06 Aug 2026.** `SETUP.md` → *Design tokens —
  and the one trap in them* now covers the pipeline, the bump hazard with the
  `c98ccc6` worked example, and the three checks to run after any version bump.
- ~~**Audit item 9** — the two pages bypassing the token pipeline.~~ — **done
  06 Aug 2026.** `thank-you.html` now links `vendor/tokens.css` and both pages
  alias semantic tokens instead of carrying old-palette literals. It also fixed
  a live bug: `thank-you.html` declared `--ink` but every usage referenced
  `--ink-soft`, which it never defined and could not inherit, so its body text,
  logo and return link rendered **pure black**. The off-palette `--navy`
  (`#1A2235`) became `background/inverse`. See the PR for the contrast working.

  > **Numbering correction.** This item is **9** in `SEO-AUDIT.md` ("Two pages
  > bypass the token pipeline"), not 11 — item 11 is "building-the-nations.html
  > is thin for a commercial page". This file called it 11 from the day both
  > documents were written in `38ae2bc`; the audit was never renumbered.
  >
  > It was not the only one. The whole file was reconciled against the audit on
  > 07 Aug 2026: the images item was filed as 9 (it is **8**), the Ahrefs item as
  > 13 (it is **10**, and there is no 13), sitemap automation as item 7 (it is
  > **not a numbered item** — item 7 is `blog/_template.html`), and
  > `building-the-nations` as 10 (it is **11**). The 26 Jul note preserved below
  > still says "item 11"; it means 9, and is left as written.

**What #14 does and does not catch.** The lint gate (`npm run lint:tokens`, and
on every PR) blocks direct primitive consumption, dangling `var(--kr-*)`
references, and new hand-written colours in `:root`. It **cannot** catch what
happened here: `neutral-100` never stopped existing, its *value* moved. Catching
that needs a resolved-value snapshot diffed across bumps — not built.

Original note from 26 Jul, kept for context:

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

**This also reframes audit item 11** [*means item 9 — see the numbering
correction above*]**.** `contact.html` and `thank-you.html` carry
hardcoded literals on the **old** palette (`#F5F0E8`, `#1C1814`, `#A07840`,
`rgba(28,24,20,…)`, `rgba(160,120,64,.32)`). Worse: `thank-you.html` links
**neither** `styles.css` nor `vendor/tokens.css` — it is fully standalone, and is
now the only page still rendering the original cream. `contact.html` does link
both but overrides `--paper`, `--navy`, `--ink-60`, `--ink-40` and `--gold-soft`
locally. So item 11 is no longer "pipeline hygiene, low urgency" — it's a visible
inconsistency. Fold it into the 0B fix.

### 0C. Verify whether Cloudflare Pages runs a build command — ✅ ANSWERED 27 Jul

**Yes, it builds.** `BLOG.md` → *Cloudflare Pages build settings* records the
command as `npm install && node build-blog.js`, which matches the observed
behaviour below (the live site serving a post absent from git). `SETUP.md` and
audit finding #3 are the things that are wrong, not the deploy.

So item 3's marker-comment approach is unnecessary — the simpler design applies.
`SETUP.md` still needs correcting.

Consequence worth noting: because Pages rebuilds from markdown on every deploy,
the committed post pages are belt-and-braces rather than load-bearing.

Gitignoring `blog/*.html` was considered as a simplification and **rejected** —
the build also rewrites the root `index.html` in place (the insights block
between its markers), which cannot leave git, so the divergence would remain and
the Action would still be needed. Reasoning in `BLOG.md`.

`SETUP.md` corrected 27 Jul.

Original note:

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

**Do audit item 10 in the same pass** (written here as "item 13" until 06 Aug —
there is no item 13; see the numbering correction under 0B): the Ahrefs tag is
still hardcoded in all 11 HTML files *and* in the `build-blog.js` templates.
Cloudflare is the chosen analytics now, so drop Ahrefs — you're in these exact
files anyway.

**Verify:** load a blog post with JavaScript disabled, confirm nav and footer
links are in the HTML. Re-enable, test the hamburger at mobile width.

---

## Items 4, 5, 6, 8 — one `<head>` commit

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
- **8 — Images.** `width`/`height` on all four `<img>` tags (CLS), plus
  `loading="eager"` + `fetchpriority="high"` on the hero cover and
  `loading="lazy"` on the author photo and second cover.

**For blog pages, edit the template strings in `build-blog.js`** (`buildPost()`
at line 44, `buildIndex()` at line 100) — **not** the generated `.html`. The next
build overwrites them, and the script deletes any `.html` in `blog/` with no
matching `.md`.

---

## Sitemap automation, and item 7 — `blog/_template.html`

**The sitemap work is not a numbered audit item** — it is follow-on from item 2,
which fixed the sitemap by hand. This file previously filed it as "item 7", which
is actually `blog/_template.html`, covered below.

Worth pulling forward to sit right after item 3, rather than leaving it last.
The hand-maintained sitemap is exactly what produced the missing post in the
first place, and it will go stale again on the next one.

Generate from the actual post list: `www` URLs, extensionless, real `lastmod`
from frontmatter, no `<priority>`. Exclude `thank-you` (noindex) and
`blog/_template.html`.

**Item 7 while you're here:** `/blog/_template.html` is live and reachable —
it 308s to `/blog/_template`. Add `noindex`, move it out of `blog/`, or delete
it. Add `Disallow: /blog/_template.html` to `robots.txt` if it stays.

---

## Remaining audit items (not scheduled)

| # | Item | Effort |
|---|---|---|
| 11 | Expand `building-the-nations` — 475 words for a commercial page | 2–3 hrs |
| 12 | Subheadings in `miracles-happen-in-the-valley`; two over-long meta descriptions | 20 min |

---

## Follow-ups with dates

- **~mid-Aug 2026 — Search Console Pages report.** "Crawled – currently not
  indexed" (8) should shrink now Google has recrawled with the redirect and new
  sitemap. Also review the 18 404s and redirect any that are real old blog URLs.
- **Weekly, Mondays ~08:30** — scheduled task `kr-seo-health-check` checks
  redirect, sitemap, robots and indexability on the live site.
- **Visual regression testing — considered 07 Aug 2026, deferred. The timing
  argument is the part worth keeping.**

  It is the only check that catches what `c98ccc6` did: a token *value* moving
  under a name that still resolves. Nothing in `styles.css` changed and every
  reference was valid, so the lint gate would have passed it. Only something
  comparing pictures can see it.

  **The best moment to baseline is before item 3**, and that window closes when
  item 3 lands. Items 3, 4, 5, 6 and 8 are all *meant to be visually invisible* —
  inlining nav/footer changes delivery not markup, `<head>` tags render nothing,
  and image `width`/`height` should not shift layout. So for each of them **an
  empty diff is the proof you did it right**, which is otherwise an eyeball job.
  Baseline afterwards and you have simply lost that.

  Scope is small: seven templates (`index`, `building-the-nations`, `contact`,
  `thank-you`, `terms`, `blog/index`, one representative post) × two widths = 14
  screenshots. Playwright, self-hosted, baselines committed, in the existing
  Actions setup. Roughly half a day.

  Two things that will bite if skipped: baselines must be generated **inside the
  CI container** (macOS and Linux render fonts differently, so local baselines
  fail every run), and the 28 transition/animation declarations plus the three
  keyframe animations need suppressing in-test or every screenshot is flaky.

- **Automating the token pin bump — considered 07 Aug 2026, deferred; lower
  value, and it has a prerequisite.**

  A bot bumping the pin is precisely how `c98ccc6` lands again — with green CI,
  because every name still resolves. **Do not do this before visual regression
  exists.** After that it is genuinely good: the PR arrives carrying a picture of
  what the new token version does to the site.

  Renovate/Dependabot fit badly here. The dependency is a git tag, and more to
  the point **bumping the pin alone is a no-op** — the deployed site reads the
  committed `vendor/tokens.css`, so the bot must also run `npm run sync-tokens`
  and commit the result, or the #18 check correctly fails it for divergence. A
  scheduled GitHub Action (~30 lines) fits better than a third-party app because
  it handles that coupling natively.

  Honest value: saves minutes a few times a year on a project where you own both
  repos. Worth an hour once the pipeline changes often enough that you forget to
  check. Not before.
- ~~**Orphaned WordPress MySQL database** at Xneelo — harmless, drop when
  convenient.~~ — **done 06 Aug 2026.** Dropped via Manage MySQL; the panel now
  reports **0 of 3 databases, none listed** for `kirstenrossiter.com`.

---

## Verification rules that always apply

- **The deployed site is whatever you committed** (pending 0C). Run
  `npm run build` locally and check the diff before pushing.
- **Never touch MX or root SPF** on `kirstenrossiter.com`. Nameservers stay at
  Xneelo. Baseline in `DNS-BASELINE-2026-07-23.md`.
- **Never edit `vendor/tokens.css`** — it's generated. Change values upstream in
  the token pipeline and re-sync.
- **The site consumes semantic tokens only** — never primitives, never
  hand-written values (`NEW-CLIENT-PLAYBOOK.md:5, 37-38, 77`). `npm run
  lint:tokens` enforces it and runs on every PR; it is also chained onto `npm run
  sync-tokens`, so a token bump is checked at the moment it lands. If no semantic
  token carries a value you need, author one upstream — do not reach past the
  layer.

---

## Progress log

**06 Aug 2026 — 0B closed: palette regression fixed and gated.**
Three PRs. **#12** repointed the `--cream` ramp at `background/default` /
`subtle` / `muted`, restoring the original `#f5f0e8` body background and
reuniting `--cream` with its own `rgba(245, 240, 232, …)` alpha family. **#13**
deleted the unused `--ink-warm` and put `--ink-mid` back on a dark token, fixing
the `.about-portrait` gradient that ran pale cream → near-black. **#14** added
`scripts/lint-tokens.mjs` and a CI workflow so the rule is enforced rather than
remembered.

Contrast improved everywhere `--cream` is a foreground (9.76:1 → 12.05:1 on the
inverse band). Verified by reading computed styles off the running site rather
than by eye — the browser preview would not follow programmatic scrolling, so
only the hero was confirmed visually. **Warren completed the manual pass down the
homepage on 06 Aug and confirmed it renders correctly.** 0B is closed on both
counts: measured, and seen.

Two things worth carrying forward. The `--ink-warm` / `--ink-mid` defect was
*not* the v1.0.0 drift — it predated it, and only surfaced because the drift sent
someone looking. And the lint gate cannot catch a repeat of 0B itself: the token
existed, only its value moved.

**06 Aug 2026 — last WordPress remnant gone.**
Orphaned WordPress MySQL database dropped at Xneelo; Manage MySQL now shows
0 of 3 databases for `kirstenrossiter.com`. With the files deleted from
`public_html` back on 23 Jul, **nothing of the old WordPress install remains** —
no files, no database. Same day: the apex redirect was re-verified healthy with
`curl` and cache-busters, and the 31 Jul "co-located WordPress regenerates
`.htaccess`" follow-up was closed as disproven. See `INCIDENTS.md`.

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
