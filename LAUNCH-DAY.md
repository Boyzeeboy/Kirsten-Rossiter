# Launch day — going live with *Building the Nations from the Ground Up*

This is the go-live runbook. It takes the checkout you already built and tested
on your `pages.dev` URL in Stripe **test mode** (see `SETUP.md`, Phase 1) and
flips the whole thing to the real domain in **live mode**.

> **The one rule that matters:** *don't break email.* The mailboxes
> `kirsten@kirstenrossiter.com` and `webmaster@kirstenrossiter.com` live at
> Xneelo and forward to Gmail. Their mail records — the **MX** records and the
> **root SPF** `TXT` record — must be left **exactly as they are** throughout
> this process. Everything below either adds *new* records (on the `www` and
> `send.` names) or repoints the *website*. You never touch the mail records,
> and you never move the domain's nameservers off Xneelo.

## Before you start — pre-flight

Do these checks first. They take five minutes and save you from launching blind.

1. **Confirm Phase 1 still works.** On your `pages.dev` URL, run through a test
   purchase and a contact-form submission one more time. If the dev flow is
   broken, fix it *before* touching DNS — launch day is not the time to debug
   the webhook.
2. **Record your current DNS, so you can prove nothing changed.** In Xneelo's
   DNS tool, note down (screenshot is fine) the existing records for
   `kirstenrossiter.com`, especially:
   - the **MX** records (your mail servers),
   - the **root SPF** record (a `TXT` on the bare domain starting `v=spf1 …`),
   - any existing `www` record,
   - any existing `A` / `CNAME` on the bare domain.
3. **Know which records you must not touch:** the MX records and the root SPF
   `TXT`. Anything you add today goes on `www`, on `send.`, or is a website
   redirect on the bare domain — never on the mail records.

> **Why the `send.` subdomain keeps email safe:** a domain may only have **one**
> SPF policy, and a policy on the root domain does *not* cover a subdomain.
> Putting Resend's sending records on `send.kirstenrossiter.com` means Resend
> gets its own SPF/DKIM on `send.` while your Xneelo mailboxes keep their
> untouched root SPF. The two never collide. (It also isolates reputation: if
> the transactional sending ever gets flagged, the root domain is unaffected.)

---

## Step 1 — Claim the custom domains in Cloudflare Pages *(do this before DNS)*

Cloudflare Pages will not serve a custom hostname until you've added it inside
the project, even if the DNS record exists. Add the hostname **first**, then
create the DNS record.

1. Cloudflare → **Pages** → your project → **Custom domains** → **Set up a
   custom domain**.
2. Add **`www.kirstenrossiter.com`**. Cloudflare will tell you the CNAME target
   to use (it's your `<your-project>.pages.dev` hostname). Note it down — you'll
   add it at Xneelo in Step 3.

> **The apex (`kirstenrossiter.com`) is the awkward one.** Pages can serve a
> bare apex domain *only* if that domain is a Cloudflare zone (i.e. its
> nameservers point at Cloudflare). You're deliberately keeping DNS at Xneelo to
> protect email, so you will **not** serve the apex directly from Pages.
> Instead you make `www` the real site and **redirect the bare domain to
> `www`** — which is exactly why `SITE_URL` is the `www` address. See Step 3c
> for the two ways to do that redirect.

---

## Step 2 — Verify the `send.` subdomain in Resend

In `SETUP.md` you created a Resend account and API key but did **not** verify a
domain. Now you do, on the `send.` subdomain.

1. Resend → **Domains** → **Add Domain** → enter **`send.kirstenrossiter.com`**
   (the subdomain, not the bare domain).
2. Resend shows you a set of DNS records to create. Expect roughly:
   - a **TXT** record for **SPF** (on `send`),
   - one or more **DKIM** records (Resend may give these as `TXT` or `CNAME` —
     use whatever it shows, exactly),
   - an **MX** record on `send` for bounce/complaint handling (this is
     region-specific, e.g. `feedback-smtp.<region>.amazonses.com` — copy the
     exact value Resend gives; don't guess the region),
   - optionally a **DMARC** `TXT` on `_dmarc.send`.
3. **Copy these records verbatim into Xneelo in Step 3** — host names, values,
   and (for the MX) priority. Leave them; don't click Verify in Resend until the
   records are actually live at Xneelo.

> Set the TTL on these new records low (e.g. 300 seconds) if Xneelo lets you, so
> verification picks them up quickly. Resend rechecks for up to ~72 hours, so a
> slow first check isn't fatal — but a low TTL gets you verified sooner.

---

## Step 3 — Add the new DNS records at Xneelo

All of this happens in **Xneelo's DNS tool** for `kirstenrossiter.com`. You are
**adding** records here, plus the one website redirect. **Do not edit or delete
the MX records or the root SPF `TXT`.**

### 3a. The `www` record (points the website at Cloudflare)
Add a **CNAME**:
- **Host / name:** `www`
- **Points to:** the `<your-project>.pages.dev` target from Step 1.

### 3b. The Resend `send.` records (lets the site send email as Kirsten)
Add each record Resend gave you in Step 2, exactly as shown — the `send` SPF
`TXT`, the DKIM record(s), and the `send` bounce **MX**. These all sit on the
`send.` name; none of them touch the root mail records.

### 3c. The bare-domain redirect (`kirstenrossiter.com` → `www`)
Xneelo's DNS tool has **no apex URL-forwarding** feature, so the redirect can't
be done with a DNS record alone — an `A` record only *points* the domain at a
server, it doesn't redirect. The fix is to let your **existing Xneelo hosting
package** do the redirect. That's the "website portion" of the package that
`SETUP.md` tells you to keep but leave unused — here it earns its keep doing one
small job.

The mechanism: the apex keeps resolving to your Xneelo web server, and that
server issues a 301 redirect to `https://www.kirstenrossiter.com`.

1. **Leave the apex (`@`) `A` record pointing at your Xneelo hosting IP.** This
   is almost certainly already the case (it's the current setup). Don't repoint
   it at Cloudflare — Pages won't serve an apex unless the domain is a Cloudflare
   zone, which would mean moving nameservers and is exactly what you're avoiding.
2. **Set up the redirect on the hosting package** using *either*:
   - **Control Panel (simplest, no files):** Web Hosting → click the domain →
     **Web Server Config** → **URL Redirects** tab → **Add URL redirect** →
     redirect the **entire website**, type **Permanent (301)**, destination
     `https://www.kirstenrossiter.com`.
   - **`.htaccess` (if you prefer editing files):** in the site's `public_html`,
     add:
     ```apache
     RewriteEngine On
     RewriteCond %{HTTP_HOST} ^kirstenrossiter\.com$ [NC]
     RewriteRule ^(.*)$ https://www.kirstenrossiter.com/$1 [R=301,L]
     ```
3. **Make sure SSL is enabled for the apex on the Xneelo hosting**, so a visitor
   arriving at `https://kirstenrossiter.com` gets the redirect without a
   certificate warning. Xneelo offers free SSL on hosting packages — enable it
   for the bare domain if it isn't already.

> The Xneelo URL-redirect feature is available on the Basic, Standard, Advanced,
> Master and Multiple-domain packages. If your package is one of these (it almost
> certainly is, since it's hosting your mail), you're covered at no extra cost.
> A third-party URL-forwarding service is a fallback only if this isn't
> available, but you shouldn't need one.

> **Leave the rest alone.** After 3a–3c, the only things that changed are: a new
> `www` CNAME, the new `send.` records, and an apex→`www` redirect. The MX
> records, the root SPF, and your Gmail forwarding are all untouched.

---

## Step 4 — Wait, then verify

1. Give DNS a little time to propagate (often minutes; allow up to a couple of
   hours).
2. In **Resend → Domains**, click **Verify** on `send.kirstenrossiter.com`.
   Wait until every record shows **Verified** / green. If it sticks on
   "pending" or "temporary failure", re-check that the host names at Xneelo
   match Resend exactly (a common slip is Xneelo auto-appending the domain, so
   you end up with `send.send.kirstenrossiter.com`).
3. Check `https://www.kirstenrossiter.com` loads your site (it may show a
   certificate warning for a few minutes while Cloudflare issues the cert —
   that's normal and clears on its own).
4. Check `https://kirstenrossiter.com` redirects to the `www` version.

Don't move on to the live switch until Resend is verified and `www` loads.

---

## Step 5 — Switch the Cloudflare Pages variables to launch values

Cloudflare → **Pages** → your project → **Settings → Variables and Bindings**.
Change these three; **leave the secrets, the R2 binding, and `BOOK_KEY` as they
are.**

| Name | Launch value |
|------|--------------|
| `FROM_EMAIL` | `Kirsten Rossiter <hello@send.kirstenrossiter.com>` |
| `SITE_URL` | `https://www.kirstenrossiter.com` |
| `CONTACT_TO` | `webmaster@kirstenrossiter.com` |

Then **redeploy** (Deployments → re-deploy the latest), so the Functions pick up
the new values.

> `CONTACT_TO` is now `webmaster@kirstenrossiter.com`, which forwards to both
> Gmail inboxes — so from here on, real contact-form enquiries land in your
> normal mail, not the Resend test address.

---

## Step 6 — Switch Stripe to LIVE (redo Phase 1 steps 4 & 6 in live mode)

Everything you did in test mode now gets redone once in **Live mode**. Test-mode
products, links, and webhooks do **not** carry over.

1. Stripe → flip the toggle to **Live mode** (top-right).
2. **Product + Payment Link:** create the **live** product *Building the Nations
   from the Ground Up*, £7.99 GBP one-time, and a **live** Payment Link.
   Set its confirmation redirect to
   `https://www.kirstenrossiter.com/thank-you`.
3. **Update `BUY_URL`:** open `building-the-nations.html`, replace the test
   Payment Link in `BUY_URL` with the live one, and **push** (Cloudflare
   redeploys on push).
4. **Live webhook:** Stripe (Live mode) → **Developers → Webhooks → Add
   endpoint**:
   - **URL:** `https://www.kirstenrossiter.com/stripe-webhook`
   - **Event:** `checkout.session.completed` (just that one).
5. Copy the **live** signing secret (`whsec_…`) into the
   `STRIPE_WEBHOOK_SECRET` variable in Cloudflare (replacing the test value),
   then **redeploy**.

---

## Step 7 — Final checks (the go/no-go list)

Run all of these. If any fails, see Rollback below before customers find it.

- [ ] **`www` loads:** `https://www.kirstenrossiter.com` shows the book page
      over HTTPS, no cert warning.
- [ ] **Bare domain redirects:** `https://kirstenrossiter.com` lands on the
      `www` site.
- [ ] **Contact page loads:** `https://www.kirstenrossiter.com/contact`.
- [ ] **A real purchase works end to end:** buy the book with a **real card**
      (you can refund yourself afterwards in Stripe). You should hit the
      thank-you page and receive the download email *from*
      `hello@send.kirstenrossiter.com`, with a working link that serves the
      ePub from R2. This proves page → Stripe (live) → webhook → Resend
      (verified domain) → signed link → R2.
- [ ] **Contact form delivers:** submit the live contact form; the enquiry
      arrives at `webmaster@kirstenrossiter.com` and hitting reply addresses the
      enquirer.
- [ ] **Email still forwards:** send a test message to both
      `kirsten@kirstenrossiter.com` and `webmaster@kirstenrossiter.com` and
      confirm each still lands in **both** Gmail inboxes. *(This is the one that
      confirms you didn't disturb the mail records.)*

When all six pass, you're live.

---

## If something goes wrong — rollback

- **Website wrong / `www` broken:** the fastest safe rollback is to remove the
  `www` CNAME at Xneelo (the site simply stops resolving on `www` rather than
  serving something broken) and re-check the Pages custom-domain setup. Your
  `pages.dev` URL keeps working the whole time, so you can keep testing there.
- **Emails not sending from the site:** check Resend shows the domain
  **Verified**; an unverified domain silently fails. Confirm `FROM_EMAIL` is the
  `hello@send.…` address and that you redeployed after changing it.
- **Stripe not triggering downloads:** confirm the **live** webhook secret is in
  `STRIPE_WEBHOOK_SECRET` (not the leftover test one) and that you redeployed,
  and that `BUY_URL` is the **live** link.
- **Mail stopped forwarding:** this should not happen if you followed the rule
  about not touching MX / root SPF — compare against the pre-flight screenshots
  from before you started and restore any record that differs.

---

## What changed vs. what stayed the same

**Changed:** a new `www` CNAME (→ Cloudflare Pages); new `send.` records (SPF,
DKIM, bounce MX) for Resend; an apex→`www` redirect; three Cloudflare Pages
variables (`FROM_EMAIL`, `SITE_URL`, `CONTACT_TO`); Stripe moved to live with a
new Payment Link and webhook; `BUY_URL` and `STRIPE_WEBHOOK_SECRET` updated.

**Unchanged:** the domain's nameservers (still Xneelo); the **MX** records and
**root SPF** for the mailboxes; Gmail forwarding for `kirsten@` and
`webmaster@`; the R2 bucket and `BOOK_KEY`; `DOWNLOAD_SIGNING_SECRET`; and the
fact that this is a static site with self-running Functions — there's still no
build step per sale.

---

## Things to confirm before you run this

A few values in this runbook depend on your accounts and on Xneelo's panel, so
check them as you go rather than assuming:

1. **The exact Resend records** (Step 2) — copy them verbatim from the Resend
   dashboard; the DKIM record type and the bounce-MX region are specific to your
   account and aren't safe to guess.
2. **The apex redirect runs on your Xneelo hosting** (Step 3c), not via DNS —
   confirm your hosting package supports the URL-redirect tool (Basic/Standard/
   Advanced/Master/Multiple all do), and that SSL is enabled for the bare domain
   so the redirect works over HTTPS.
3. **Your Cloudflare Pages CNAME target** (Step 1) — use the exact
   `…pages.dev` value Pages shows you for the project.
