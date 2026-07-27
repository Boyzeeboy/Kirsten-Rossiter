# Setup — selling *Building the Nations from the Ground Up*

This is the one-time wiring for the book checkout and the contact form. After
it's done, your day-to-day stays as it is now: edit, push to Git, Cloudflare deploys.
**There is no build step per sale** — the Functions run themselves whenever
Stripe calls them. Adding the `functions/` folder does **not** change the fact
that the pages are served as static files.

> **Correction (27 Jul 2026):** this page originally said the site has no build
> command at all. That was true when it was written; it is not now. The blog
> added one — Cloudflare Pages runs `npm install && node build-blog.js` on every
> deploy to generate the post pages from `blog/posts/*.md`. Nothing on this page
> changes as a result: the Functions still need no build. See `BLOG.md`.

## Checking the site URL and redeploying for testing purposes. 

## How this document is organised

It's split into two phases:

- **Phase 1 — Development (do this now).** Get the whole checkout working and
  tested on your Cloudflare `pages.dev` URL, in Stripe **test mode**, with no
  changes to any real domain or to Kirsten's email.
- **Phase 2 — Launch (do this later).** Point the real domain at the site and
  switch everything to live. The detailed DNS steps live in the separate
  **`LAUNCH-DAY.md`** runbook, because they're tied to your Xneelo + email
  setup; this document just lists what changes.

> **Why the split:** the domain `kirstenrossiter.com` keeps its DNS at Xneelo,
> and your live mailboxes (`kirsten@`, `webmaster@`) and their Gmail forwarding
> stay exactly as they are. Nothing about email changes. We only repoint the
> website and add email-*sending* records on a `send.` subdomain at launch.

## What's in this folder

```
building-the-nations.html   ← the product page (cover is embedded; nothing to host)
contact.html                ← the contact page (its form posts to /contact)
thank-you.html              ← shown after a successful payment
functions/
  _crypto.js                ← shared helper (don't rename — the "_" keeps it un-routed)
  stripe-webhook.js          ← receives the Stripe payment, emails the download link
  download.js                ← validates the link, serves the ePub from storage
  api/
    contact.js               ← contact-form submissions → emailed to you (route /api/contact)
LAUNCH-DAY.md               ← the go-live runbook (DNS cutover)
SETUP.md                    ← this file
```

Drop the HTML pages and the `functions/` folder into your site repo so
`functions/` sits at the **root** (next to your HTML files), then push.
Cloudflare Pages auto-detects the `functions/` folder — the Functions themselves
need no build command.

**But the project does need one, for the blog.** Set it in
Cloudflare Pages → Settings → Builds & deployments:

| Setting | Value |
|---|---|
| Build command | `npm install && node build-blog.js` |
| Output directory | `/` (repo root) |

Without it the Functions still work, but new blog posts will not appear.
`BLOG.md` is the source of truth for this.

---

# Phase 1 — Development (do this now)

### 1. Push the files and note your dev URL
Add the files to your repo and push. In Cloudflare → Pages → your project, note
the auto-assigned dev URL — it looks like `https://<your-project>.pages.dev`.
Everything in Phase 1 uses that URL, not the real domain.

### 2. Upload the ePub to private storage (Cloudflare R2)
1. Cloudflare dashboard → **R2** → **Create bucket** (e.g. `kr-books`).
2. Upload the book file and name it `building-the-nations.epub`.
3. Leave the bucket **private** — the download Function reads from it directly,
   so it never needs to be public.

### 3. Create a Resend account + API key  *(no domain verification yet)*
1. Create a free account at **resend.com**.
2. Create an **API key** and keep it for step 5.
3. **Do not verify a domain at this stage.** During development you send from
   Resend's shared address `onboarding@resend.dev`, which needs no DNS setup.
   - **Important limitation:** until a domain is verified, Resend will only send
     to **your own Resend-account email address**. That's all you need to test
     the flow yourself. (You can't have other people test-buy until launch.)

> **Where the API key goes — never in the code.** Resend's quick-start shows the
> key pasted straight into `new Resend('re_…')`. Do **not** do that here. The key
> is a password: it goes **only** into Cloudflare's encrypted `RESEND_API_KEY`
> variable (step 5), and the Functions read it at runtime as `env.RESEND_API_KEY`.
> Never paste it into an HTML/JS file or commit it to the repo — anything in the
> repo is public on `pages.dev`. Resend shows the full key once, so copy it now;
> if you lose it, just generate a new one and update the Cloudflare variable.

### 4. Create the product + a TEST Payment Link in Stripe
1. Switch Stripe to **Test mode** (toggle, top-right).
2. **Product catalogue** → add **Building the Nations from the Ground Up**,
   price **£7.99 GBP**, one-time.
3. **Payment Links** → create a test link for that product.
4. Set the link's confirmation page to redirect to
   `https://<your-project>.pages.dev/thank-you`.
5. Copy the test Payment Link, open `building-the-nations.html`, find `BUY_URL`
   near the bottom, and paste it in place of the placeholder. Push.

### 5. Set the environment variables + R2 binding in Cloudflare
Cloudflare → **Pages** → your project → **Settings → Variables and Bindings**.
Add these (mark secrets as *encrypted*). **These are the development values:**

| Name | Type | Development value |
|------|------|-------------------|
| `STRIPE_WEBHOOK_SECRET` | secret | *(filled in at step 6 — from the TEST webhook)* |
| `DOWNLOAD_SIGNING_SECRET` | secret | any long random string you invent (same value used at launch) |
| `RESEND_API_KEY` | secret | the key from step 3 |
| `FROM_EMAIL` | text | `Kirsten Rossiter <onboarding@resend.dev>` |
| `SITE_URL` | text | `https://<your-project>.pages.dev` |
| `BOOK_KEY` | text | `building-the-nations.epub` |
| `CONTACT_TO` | text | your own Resend-account email (so you can test the contact form) |

Then add the **R2 bucket binding**:
- Variable name: `BOOK_BUCKET`
- Bucket: the one from step 2.

### 6. Create the TEST Stripe webhook
In current Stripe, a webhook is called an **event destination**, and Webhooks
lives inside the **Developers / Workbench** panel — not on the Settings page.

1. Make sure you're in **Test mode** before you start. Click **"Developers"** in
   the footer bar (bottom-left) to open the Workbench, then the **Webhooks** tab.
   You'll know you're in test mode when the dark **"Sandbox — you are testing in
   a sandbox"** banner is showing across the top.
   - You may see an existing destination like
     `https://kirstenrossiter.com/?wc-api=wc_stripe` — that's an old WooCommerce
     webhook on the live site. **Leave it alone**; don't edit or delete it.
2. Click **"+ Add destination"** and work through the three-step wizard:
   - **Select events.** Leave the scope on **"Your account"** and the **API
     version** at its default. Under *Events*, use the **"Find event by name…"**
     search box, type `checkout.session.completed`, and tick that **one** event
     only. Do **not** use "Select all." Click **Continue**.
   - **Choose destination type.** Pick **Webhook endpoint** (not Amazon
     EventBridge). Click **Continue**.
   - **Configure your destination.** Confirm the summary reads *Events from →
     Your account* and *Listening to → checkout.session.completed*. Then:
     - **Destination name:** optional — rename the random default (e.g.
       `memorable-finesse`) to something like `book-checkout` so you recognise it.
     - **Endpoint URL:** `https://<your-project>.pages.dev/stripe-webhook`
       — use the **stable** `pages.dev` URL with **no deployment-hash prefix**
       (i.e. `kirsten-rossiter.pages.dev`, *not* `254f96b6.kirsten-rossiter.pages.dev`).
       The hashed preview URLs point at a single frozen build and break on the
       next push. Confirm it matches the main URL shown at the top of your
       Cloudflare Pages project, and use the same value for `SITE_URL`.
     - **Description:** optional (e.g. "Emails download link after book purchase").
   - Click **Create destination**.
3. On the destination's details page, reveal and copy the **Signing secret**
   (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` from step 5, then **redeploy**.

### 7. Test the whole flow end to end
1. Open your `pages.dev` site and click **Buy**.
2. Use Stripe's test card `4242 4242 4242 4242`, any future expiry, any CVC.
3. **Enter your own Resend-account email** as the customer email (remember:
   in dev, Resend only delivers to that address).
4. You should land on the thank-you page and receive the email with a working
   download link. That proves the entire chain — page → Stripe → webhook →
   Resend → signed link → R2 download.

### 8. Test the contact form
1. Open `/contact` on your `pages.dev` site.
2. Fill it in (use your own email) and send.
3. The form should show its "Thank you" panel, and the enquiry should arrive at
   your `CONTACT_TO` address — which in dev must be your own Resend email, for
   the same reason as above. Hitting reply should address your test sender.

When this works, development is done. Leave everything as-is until you're ready
to launch.

---

# Phase 2 — Launch day (do this later)

The full, ordered DNS cutover is in **`LAUNCH-DAY.md`** — follow that for the
domain, the `send.kirstenrossiter.com` subdomain verification, and the redirect,
since those touch Xneelo and must be done in the right order to keep email safe.

Alongside those DNS steps, you switch this checkout from test to live:

**Resend — this is the hard gate for going live.** Until you verify a domain,
Resend only delivers to your own account email, so *no paying customer can
receive their book*. Verifying the sending domain is what flips it from
"works for me" to "works for buyers." Verify the **`send.kirstenrossiter.com`**
subdomain (a subdomain, not the root — this keeps Resend's records clear of the
SPF record your Xneelo mailboxes use). Its DNS records go into **Xneelo's DNS
tool**, per `LAUNCH-DAY.md`. Once it shows **Verified** in Resend, update
`FROM_EMAIL` (below) to send from that domain.

**Cloudflare Pages variables — change these:**
| Name | Launch value |
|------|--------------|
| `FROM_EMAIL` | `Kirsten Rossiter <hello@send.kirstenrossiter.com>` |
| `SITE_URL` | `https://www.kirstenrossiter.com` |
| `CONTACT_TO` | `webmaster@kirstenrossiter.com` |

(Leave the secrets and `BOOK_KEY` as they are. Redeploy after editing.)

**Stripe — redo steps 4 & 6 in LIVE mode:**
- Switch Stripe to **Live mode**.
- Create the **live** Payment Link; redirect → `https://www.kirstenrossiter.com/thank-you`.
- Paste the live link into `BUY_URL`; push.
- Create the **live** webhook → `https://www.kirstenrossiter.com/stripe-webhook`,
  event `checkout.session.completed`. Copy its signing secret into
  `STRIPE_WEBHOOK_SECRET`; redeploy.

Then run the final checks in `LAUNCH-DAY.md` (site loads on both `www` and the
bare domain, a real test purchase works, and email still forwards to both Gmails).

---

## Good to know

- **Cost per sale:** roughly Stripe's 1.5% + 20p on a UK card — about 32p on a
  £7.99 sale. No platform fee, no monthly cost.
- **Keep your Xneelo hosting package.** Your email lives on it, so don't cancel
  it — the website portion simply goes unused once the site is on Cloudflare.
  You do **not** disable mail at Xneelo; the mailboxes keep running there.
- **Link sharing:** the download link is unguessable and expires after 24 hours,
  but isn't locked to one person, so a buyer could in theory forward it within
  that window. For a £7.99 ebook that's a fine trade-off; we can tighten it later
  if it ever matters.
- **VAT on digital sales:** with this direct setup, VAT is your responsibility
  rather than a platform's. Worth a quick word with an accountant about the
  threshold and whether you need to register.
- **Adding the physical book later:** same site, same Stripe account. We add a
  second product/price and a "paperback" option on the page — no re-platforming.
- **Contact form:** the page lives at `/contact` (`contact.html`); its form posts
  to the `/api/contact` function (`functions/api/contact.js`), which emails
  submissions to your `CONTACT_TO` address with reply-to set to the enquirer (so
  you can reply straight from Gmail). The endpoint is under `/api/` so it doesn't
  collide with the `/contact` page. It shares the same Resend setup as the book
  emails, so the only extra variable it needs is `CONTACT_TO` — which at launch
  becomes `webmaster@kirstenrossiter.com`, forwarding to both Gmail inboxes.
