# Next session — 23 July 2026

Picking up **items 1 and 2** from `SEO-AUDIT.md`.

## Progress log

**23 Jul 2026 — Item 1 DONE (apex redirect).**
- Root cause: `public_html/.htaccess` had a mod_alias `Redirect permanent /`
  on the last line, but the WordPress mod_rewrite block above it ran on every
  request and suppressed mod_alias, so the redirect never fired. Dead since the
  Xneelo redirect tool added it on 25 Jun 2026.
- Fix: replaced `.htaccess` with a top-of-file mod_rewrite 301 to
  `https://www.kirstenrossiter.com`, path-preserving, `.well-known` excluded for
  SSL renewal. Full replacement saved in `xneelo-htaccess-redirect.txt`;
  original preserved in `xneelo-htaccess-backup-2026-07-23.txt`.
- Verified: apex `/contact` now redirects to `www` and serves the new site
  (confirmed in an incognito window; old WordPress content gone from all paths).
- DNS untouched — MX and root SPF unchanged. Baseline in
  `DNS-BASELINE-2026-07-23.md`.
- Cleanup: WordPress fully deleted from `public_html` (only `.htaccess` remains);
  redirect re-verified working afterwards. WordPress MySQL database still exists
  (orphaned, harmless — drop later if desired). Removing the three unused
  MailPoet DNS records (`mailpoet1`/`mailpoet2` `_domainkey` CNAMEs + `_mailpoet`
  TXT) is the final sub-step.

**23 Jul 2026 — Item 2 DONE (robots.txt + sitemap.xml).**
- `robots.txt`: Sitemap line → `https://www.kirstenrossiter.com/sitemap.xml`.
- `sitemap.xml`: rewritten — www host, extensionless URLs (matches internal
  links + planned canonicals), added the missing `we-are-fighting-a-territorial-
  spirit` post, real `lastmod` dates from post frontmatter, dropped `<priority>`.
  Excludes `thank-you` (noindex). Validated with xmllint; all 10 URLs confirmed
  live on www.
- Open question resolved: went extensionless (not `.html`).
- NOT yet committed/pushed. Cloudflare Pages deploys from GitHub
  (Boyzeeboy/Kirsten-Rossiter), so these go live only after commit + push.

**23 Jul 2026 — Search Console reviewed + monitoring set up.**
- Property is a verified Domain property (`sc-domain:kirstenrossiter.com`),
  under Warren's Google account. New sitemap submitted: Success, 10 pages found.
- Health: Manual actions + Security = no issues. Indexing snapshot (dated
  10 Jul, pre-migration): 13 indexed / 33 not. Not-indexed reasons all expected
  for a retired old site — 404 (18, old WP URLs), redirect (6, apex→www),
  noindex (1, thank-you), crawled-not-indexed (8, watch this one).
- Weekly scheduled task `kr-seo-health-check` (Mon ~08:30) checks redirect,
  sitemap, robots, indexability on the live site. Managed under Scheduled.
- FOLLOW-UP ~mid-Aug 2026: recheck GSC Pages report — "crawled - currently not
  indexed" should shrink after Google recrawls with the new redirect + sitemap.
  Also glance at the 18 404s; redirect any that are real old blog-post URLs.

**23 Jul 2026 — Analytics changed (Warren).** GA4 removed; `includes.js` now
injects the Cloudflare Web Analytics beacon (`static.cloudflareinsights.com/
beacon.min.js`) instead of gtag. Committed. Impact on item 3: the "preserve GA4"
gotcha is now "preserve the Cloudflare beacon" — keep `includes.js` for analytics
+ nav wiring, strip only the fetch-includes logic. Also: Ahrefs is STILL
hardcoded in every HTML page, so two analytics run again — drop the Ahrefs tag
when we're in those files (audit item 10).

**Still to do:** items 3-7 (inline nav/footer, canonicals, OG, JSON-LD,
auto-generate sitemap in build).

## Before starting — have these to hand

**Launch-day DNS screenshots.** Needed to confirm the **MX records** and the
**root SPF `TXT`** on `kirstenrossiter.com` are byte-identical after the apex
redirect goes in. `LAUNCH-DAY.md` (pre-flight, step 2) says these were captured
from Xneelo's DNS tool at launch. If they can't be found, take fresh
screenshots *before* touching anything — that becomes the baseline.

The redirect is a web-server config change, not a DNS change, so in principle
nothing should move. The check is to prove it.

## Item 1 — apex → www 301 (Xneelo hosting)

- Redirect `kirstenrossiter.com` → `https://www.kirstenrossiter.com`
- Preserve the path (`/blog/foo` → `https://www.kirstenrossiter.com/blog/foo`)
- Leave the apex `A` record pointing at Xneelo
- Do **not** add the apex to Cloudflare Pages, do **not** move nameservers

Verify: `curl -I https://kirstenrossiter.com/blog/` returns `301` with the
correct `Location`. Then re-check MX + root SPF against the screenshots, and
send a test email to both mailboxes.

## Item 2 — robots.txt + sitemap.xml

- Switch all URLs from apex to `www`
- Add the missing post: `/blog/we-are-fighting-a-territorial-spirit`
- (Auto-generating the sitemap in `build-blog.js` is item 7 — later.)

## Open question to chat through

Whether to fix the extensionless vs `.html` inconsistency at the same time, or
leave it until the canonicals work (item 4). Doing both at once means one
sitemap rewrite instead of two.
