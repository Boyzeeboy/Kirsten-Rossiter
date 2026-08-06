# Incidents — kirstenrossiter.com

Operational incident log for the live site. Newest first.
Detected by the weekly `kr-seo-health-check` scheduled task unless noted.

---

## 2026-08-06 — Verification: apex redirect confirmed healthy (ad-hoc, `curl`)

**Severity:** None. Not an incident — a deliberate re-check of the 3 Aug finding,
run by hand rather than by the weekly scheduled task.

**Checked:** Thu 06 Aug 2026. Read-only; nothing changed on site, DNS, or mail.

### Method
Applied the process fix the 3 Aug entry called for: `curl` straight at the live
origin, asserting on the **status line and `Location` header**, with a **unique
cache-buster on every request** rather than comparing page content from a single
fetch. Deliberately not `web_fetch`, which produced the 3 Aug false alarm.

### Results — all pass
| Check | Result |
|---|---|
| `kirstenrossiter.com/?nocache=…` | **301** → `https://www.kirstenrossiter.com/?nocache=…` |
| `/contact?nocache=…` | **301** → `…/contact?nocache=…` — path preserved |
| Final page after following the redirect | **200**, `server: cloudflare`, `cf-ray` present |
| Page identity | `<title>Kirsten Rossiter — Building the Nations from the Ground Up</title>` |
| WordPress markers on final page | **0** |
| `www` direct | **200** from Cloudflare; no bounce back to the apex |
| `/.well-known/acme-challenge/…` | **404 from Apache, not a 301** — exclusion intact, SSL renewal unaffected |

DNS matches `DNS-BASELINE-2026-07-23.md` exactly: `@` → A → `129.232.138.188`,
`www` → CNAME → `kirsten-rossiter.pages.dev`, all four Xneelo nameservers
(`ns1/ns2.host-h.net`, `ns1/ns2.dns-h.com`).

### What this does and does not establish
- **Does:** the redirect `.htaccess` restored on 31 Jul is still in place and
  working five days on, and the apex answers from Apache with a 301 rather than
  rendering WordPress. It also corroborates the 3 Aug false-alarm conclusion — a
  live cache-busted read got a clean 301 immediately, with none of the WordPress
  content the earlier check kept reporting.
- **Does not:** say anything about whether the redirect could fail again. A
  single healthy reading is not evidence against an intermittent fault.

> **Later the same day:** `public_html` was inspected directly and contains only
> `.htaccess` — no WordPress. The "co-located WordPress regenerates `.htaccess`"
> theory is therefore disproven, and the 31 Jul follow-up is **closed as nothing
> to do**. See the correction under that entry's *Root cause*.

### Status
🟢 **Healthy.** Apex redirect confirmed working for real visitors.

---

## 2026-08-03 — False alarm: apex redirect is healthy; monitoring tool served stale reads

**Severity:** None (site was fine throughout). Logged as a **tooling/process**
lesson, not a site incident.

**Detected → resolved:** Mon 03 Aug 2026, during the weekly technical health check.

### What actually happened
The weekly check's `web_fetch` reads reported the apex
`https://kirstenrossiter.com/` (and `/contact`) **serving the old WordPress site
with no 301**, and kept reporting it on repeated fetches through the session. On
that basis this entry originally concluded a server-side docroot/vhost problem
and an Xneelo ticket was drafted. **That conclusion was wrong.**

A clean end-user test proved the apex is fine: in a **private window** with a
**cache-busting query string** (`https://kirstenrossiter.com/?nocache=1`), the
apex correctly **301-redirected to `https://www.kirstenrossiter.com/…`** and
served the live "Building the Nations" Cloudflare Pages site. The moment the
monitoring `web_fetch` was pointed at a URL variant it had **not** already
cached, the WordPress content disappeared too.

### Root cause of the false alarm
`web_fetch` was replaying a **stale/deduplicated copy of its first response**
(and/or resolving via a lagging DNS resolver) rather than reading the origin
live. Every "still broken" reading this session was that cached artefact, not the
real server. The apex redirect was working the whole time.

### Verified healthy this run
- Apex `→` 301 `→` `www` (private window + cache-buster, cache fully bypassed).
- `www` serving the correct Cloudflare Pages site.
- Contact form submits and the notification **email arrives in Gmail** (SES
  `send.*` path working).
- `robots.txt` correct; `/thank-you` still correctly `noindex`.
- DNS confirmed correct & authoritative on Xneelo nameservers
  (`ns1/ns2.host-h.net`, `ns1/ns2.dns-h.com`): `@` → A → `129.232.138.188`,
  `www` → CNAME → `kirsten-rossiter.pages.dev`, all mail records intact.

### Note on the 31 Jul entry
Given this, the 31 Jul incident may also have been partly a stale-read artefact
rather than a real `.htaccess` wipe. Treat its "recurring root cause" (co-located
WordPress regenerating `.htaccess`) as **unconfirmed**.

### Actions
- **Xneelo ticket NOT sent.** The draft `xneelo-support-ticket-2026-08-03.md` was
  written on the false-alarm premise and has since been **deleted** — there was
  nothing to fix. It was never committed, so no copy survives in git; the
  `.htaccess` it quoted is in `xneelo-htaccess-redirect.txt`. Nothing changed on
  site, DNS, or mail this session (read-only check).
- **Process fix for the weekly check:** a single `web_fetch` is not a reliable
  redirect test — it can serve cached/deduplicated results. Confirm the apex with
  a **cache-busted URL** (unique query string) and, where possible, treat a
  clean private-window / fresh-resolver read as the source of truth before
  declaring the redirect broken. Consider asserting on the **301 status/`Location`
  header** with a cache-buster rather than comparing page content.

### Status
🟢 **Resolved — no site issue.** Apex redirect confirmed working for real
visitors. Root cause was a stale monitoring read.

---

## 2026-07-31 — Apex redirect lost; both hostnames served old WordPress

**Severity:** High (canonical site not reachable on the apex; duplicate old
content live and indexable).

**Detected:** Fri 31 Jul 2026, by the weekly technical health check.

### Symptoms observed
- `https://kirstenrossiter.com/` and `.../contact` served the **old WordPress
  site** (light "Prophetic Ministries" hero, cookie-consent banner, "Latest
  videos", "Subscribe to my email list") instead of 301-redirecting to `www`.
- A mid-check server fetch of `https://www.kirstenrossiter.com/` briefly
  **301-redirected to the bare apex** and also returned WordPress — the classic
  WordPress "non-www canonical" behaviour, indicating WordPress was answering.
- `robots.txt` and `sitemap.xml` on `www` continued to return the correct
  Cloudflare content throughout, i.e. the fault was isolated to request routing,
  not the Pages deployment.

### Root cause

> **Correction, 06 Aug 2026 — the root cause below is wrong.** It assumed a
> WordPress install still sitting in the apex `public_html`. There isn't one, and
> there hasn't been since **23 Jul**, when WordPress was deleted from that
> directory as part of the original redirect fix (see the 23 Jul progress log in
> `NEXT-SESSION.md`). Confirmed twice since by direct inspection of `public_html`
> in the Xneelo File Manager — on 3 Aug and again on 6 Aug, both times finding
> only `.htaccess`. So nothing co-located could have regenerated `.htaccess` on
> 31 Jul, and **what actually made the redirect fail that day is unexplained**.
> Given the 3 Aug false alarm, a stale monitoring read is the leading candidate;
> whether the `.htaccess` was ever really wiped was not verified before it was
> rewritten. Kept below as originally written.

The apex box (`129.232.138.188`, Xneelo shared hosting) still hosts the old
WordPress install in the same `public_html` as the redirect `.htaccess`. The
redirect `.htaccess` had been **wiped/overwritten** (WordPress or a plugin/core
update regenerates its own `.htaccess`), so apex requests fell through to
WordPress instead of redirecting to the Cloudflare Pages site on `www`. This is
exactly the failure mode the weekly check was written to catch.

### DNS confirmed correct (not the cause)
- `www` → CNAME → `kirsten-rossiter.pages.dev` (Cloudflare Pages canonical site)
- `@` (apex) → A → `129.232.138.188` (Xneelo redirect box)
- All mail records intact and untouched (`A mail`, `MX @ → mail`,
  `autoconfig`/`imap`/`pop`/`smtp`/`relay` CNAMEs, SPF, DKIM, DMARC, SES `send.*`).
  See `DNS-BASELINE-2026-07-23.md`.

### Fix applied
Restored the known-good redirect `.htaccess` into Xneelo `public_html` via the
Xneelo File Manager (Home Directory / public_html / .htaccess). Content matches
`xneelo-htaccess-redirect.txt` in this project (path-preserving 301 to www,
`/.well-known/` excluded so SSL renewal keeps working). No DNS or mail changes.

### Verified
- `www.kirstenrossiter.com` confirmed serving the correct dark "Building the
  Nations from the Ground Up" Cloudflare Pages site (private/incognito window,
  cache bypassed).
- Earlier WordPress responses were cache/propagation lag clearing during the fix.
- Cosmetic only: the browser tab still shows a stale WordPress "W" favicon — no
  SEO/redirect impact; swap the favicon reference on the Pages site when convenient.

### Follow-up / prevention
- ~~**Recurring root cause:** the co-located WordPress in the apex `public_html`
  keeps regenerating `.htaccess` and wiping the redirect. The durable fix is to
  **retire the old WordPress files** from that directory (move/rename them out of
  `public_html`) so nothing can overwrite the redirect again.~~ — **closed
  06 Aug 2026, nothing to do.** There are no WordPress files in the apex
  `public_html` and have not been since 23 Jul — see the correction under *Root
  cause* above. Nothing was moved or deleted to close this.
- Consider tightening the weekly check to also confirm the apex actually issues a
  301 (not just that content differs), to catch a silent regression sooner.
