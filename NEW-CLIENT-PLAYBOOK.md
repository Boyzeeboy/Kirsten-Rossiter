# New Client Site Playbook

Token-first sequence for starting a client site from scratch. Based on the KR pipeline (Style Dictionary v4 / DTCG → Figma variables → static site → Cloudflare Pages), with every retrofit lesson from the Kirsten Rossiter build baked in as a day-one rule so none of it has to be fixed retrospectively.

**The one governing rule:** no CSS value is ever hand-written. Every colour, size, family, space, radius, and shadow enters the project as a token in JSON first, and reaches the site only through the build. If a value isn't worth a token, it isn't worth shipping.

---

## Phase 0 — Discovery (no tools, no repos)

Collect before touching anything technical:

- **Brand inputs:** logo, colour references, typefaces (confirm exact families *and which weights actually exist* — check Google Fonts axes now, not later; KR lost time because Libre Baskerville has no 300/500 and Figma's hosted fonts diverged from local installs).
- **Content inventory:** every page, its purpose, its content owner. Rough sitemap.
- **Functional scope:** commerce (Stripe)? transactional email (Resend)? file delivery (R2)? blog/build step? dark mode? Decide dark mode support NOW — it determines whether the site consumes the semantic layer (yes if dark mode ever ships) and whether you author `tokens.dark.json` from day one.
- **Assign the three font roles up front:** `family/display` (headlines), `family/serif-body` (prose), `family/base` (UI/sans — labels, buttons, nav). Name tokens by *role*, never by legacy or arbitrary names. KR's `family-annotation` misnaming caused a real rendering bug.

## Phase 1 — Repos and infrastructure

Two repos per client, created empty before any code:

1. `{client}-token-pipeline` — clone/fork your KR pipeline as the template (it is now the IDEM successor). Strip client-specific values immediately; don't carry stale descriptions, palettes, or Storybook data into the new client (the teal-leftover problem).
2. `{client}-site` — static site, sibling directory (`~/Documents/Claude/Projects/{Client} Site`), so `sync-tokens.sh` relative paths work. Set `KR_SITE_DIR`-style override if the layout differs.

Rules from day one:

- **SSH remotes only.** Never embed a PAT in a remote URL.
- Secrets (`CHROMATIC_PROJECT_TOKEN`, Stripe, Resend keys) go straight into GitHub repo secrets / Cloudflare env vars — never committed, never in the project folder.
- Connect the site repo to **Cloudflare Pages** now, deploying `main`. Deploys are boring from commit one; you're never setting up hosting under launch pressure.
- New Chromatic project per client; wire the workflow token before the first component exists.
- Keep the client's SETUP/runbook doc *outside* the site repo (same pattern as KR's SETUP.md).

## Phase 2 — Token architecture (the actual start of design)

Author `tokens.light.json` (+ `tokens.dark.json` if in scope) in DTCG format. Three layers, built bottom-up:

1. **Primitives** — raw palette ramps (`gold/500`), font families, size steps. Not for direct use by the site, ever.
2. **Semantic** — meaning-named: `colour/text/default`, `colour/text/link`, `colour/background/default`, `colour/border/divider`. **This is the only layer the site consumes.** (KR drifted: styles.css aliased primitives while the ebook page used semantic. Pick semantic, enforce it from the first page.)
3. **Components** — `button/primary/bg`, `input/border-focus`, etc. Only create these when a component actually exists; don't speculate.

Naming rules (each one is a KR bug you won't repeat):

- **Never give a token both a `$value` and children.** Style Dictionary silently drops the children (the link-hover bug). Hover/pressed/disabled states are sibling tokens: `link` + `link-hover`, `action/primary-hover`, `input/border-focus`. Adopt the parent-child hyphen convention everywhere from the start.
- **No doubled path segments.** Don't nest a `colour` group inside a `colour` collection — KR shipped 66+ `--kr-colour-colour-*` vars. Check the generated CSS var names before writing any site CSS; fix the name transform first.
- **Dimension tokens carry units.** Configure px/rem transforms before first build so `line-height: 80` can never mean 80×. Never author unitless numbers for sizes.
- **Type scale is a decision, not an archive.** Define a small named scale now (M3-style Display/Headline/Title/Body/Label/Meta × L/M/S worked well for KR) instead of accreting ~25 one-off font sizes you later have to normalize.
- **Translucent colours are derived, never retyped.** No pipeline emits alpha variants, so the first time a design needs "cream at 35%" there is no token to point at and the CSS hand-writes `rgba(245, 240, 232, 0.35)` — the base colour retyped as decimals, permanently disconnected from the token it came from. KR carries sixteen of these. When `--cream` moved during the v1.0.0 regression the solid creams followed and the translucent ones did not, leaving one family split across two palettes. Use `color-mix()` against the token instead:

  ```css
  /* not this — a frozen copy of #f5f0e8 */
  --cream-soft: rgba(245, 240, 232, 0.35);
  /* this — reads the token, follows it forever */
  --cream-soft: color-mix(in srgb, var(--{cl}-colour-background-default) 35%, transparent);
  ```

  Do **not** answer this by authoring `alpha-25/35/50` token sets: seven opacity steps across several colours is a lot of tokens to maintain for something CSS computes for free. `color-mix()` has been broadly supported since 2023.
- **Every background token ships a contrast-checked `on-*` partner.** `background/inverse` + `on-background-inverse`, authored and measured together. Contrast is a property of a *pair*, so it can only be settled where the pair is defined — deferring it to the component means re-deciding it every time, by eye. KR has the `on-*` family but the site never consumed it, so a form's submit button was coloured by judgement and shipped at 3.52:1 against a 4.5:1 requirement.

Deliverable of this phase: the complete visual language of the site exists in JSON, before Figma and before any CSS.

## Phase 3 — Build and guardrails (before any site CSS exists)

Wire the full toolchain now, while there's nothing to break:

- `npm run build` → `dist/{light,dark}/variables.css|tokens.js|tokens.flat.json`, client prefix (`--{cl}-…`).
- `scripts/sync-tokens.sh` → site `vendor/tokens.css`. The site never reads `dist/` directly.
- `verify-build.mjs` — the consumer contract: fails if the site uses any `var(--{cl}-…)` the build doesn't define. Wire it into `npm test` / prepublish. **Do not leave this as local-only protection.** KR relied on "run it before you push"; the v1.0.0 palette regression shipped anyway and stayed live for weeks. A habit is not a gate. Mirror the check in the *site* repo and run it in CI on every pull request (Phase 5).
- **The version pin does not reach the deployed site.** Cloudflare runs `npm install` and then never reads the package — the pages link the *committed* `vendor/tokens.css`. Bumping the pin alone changes nothing on screen, and `npm install` succeeds, the build is green and CI is green while the site serves the old palette. Keep the pin and the vendored file in the same commit, always, and have CI fail when they diverge.
- `npm run report` → `dist/report.html`, chained after build: doubled-segment lint, unitless-font lint, hardcoded-hex scan, fonts-link↔token match, dist↔vendor sync. **Target 8/8 passing from the first build.** On KR these checks were archaeology; on a fresh client they're a tripwire that keeps the repo clean.
- Snapshot + changelog scripts, so every token change is diffable.
- **Visual regression snapshots of the deployed site**, not just of Storybook. This is the one guardrail that catches a token *value* moving under a name that still resolves — the failure no lint can reason about, because nothing in the code changed. Playwright screenshots committed as baselines, or Percy/Chromatic pointed at the preview URL; a handful of full-page shots at two widths is enough. Had this existed, the KR v1.0.0 palette shift would have failed CI on the commit that introduced it instead of living on the site for weeks. Wire it before the first real page, so the baselines grow with the site rather than being backfilled.
- **Accessibility checks in CI on every pull request** — `axe-core` via Playwright, or `pa11y-ci`, against the built pages. Contrast, landmarks, form labels and alt text are all machine-detectable, and leaving them to a Lighthouse run at launch means finding them when they are expensive. Every accessibility defect found on KR — a submit button at 3.52:1, body copy at 4.27:1, an entire page rendering black text from an undefined variable — would have been caught automatically.
- Regenerate Storybook data contracts (`color.json`, `typography.json`, `size.json`, `guidelines.json`, `design.md`) from the client's tokens immediately — these are used by Storybook stories and will render the template's stale palette if skipped.

## Phase 4 — Figma mirror (after JSON, never before)

Figma is a synced *view* of the token JSON, not the origin. Create one `{Client}-Token-Pipeline` Figma file:

- Variable collections mirroring the JSON layers: Fonts, Primitives (Light/Dark), Semantic (Light/Dark), Components (Light/Dark), Spacing, Radius. Names must match token paths exactly — same parent-child hyphen convention, no variable-as-group.
- **Scope variables at creation time**, not as a later pass: text→TEXT_FILL, borders→STROKE_COLOR, backgrounds→FRAME_FILL+SHAPE_FILL, etc. Leave primitives ALL_SCOPES (or zero-scoped to hide from pickers).
- **Text styles:** build the named scale with Default/Emphasis weight pairs. Verify every weight exists in *Figma's hosted* font set before designing with it — Figma's font environment ≠ your local installs ≠ Google Fonts on the web. Note textCase can't live in a text style; uppercase labels are applied per node.
- Write real descriptions on variables at the source, so future syncs never reintroduce stale text.
- Build a specimen frame (type scale, swatches) — it doubles as the client-facing style guide.

Direction of truth for changes after setup: either always edit JSON and push to Figma, or work Figma-first and always run the build from the file — pick one per project and never mix within a change.

## Phase 5 — Site scaffold

Only now does site code exist:

- **No alias layer.** Site CSS consumes semantic vendor tokens **directly** — `color: var(--{cl}-colour-text-primary)`, never `color: var(--ink)`. The only local custom properties in `:root` are non-token layout values (`--measure`, `--ease`). No literal colours, sizes, or families anywhere; there is never a hand-written value to fall back on.

  > **Why.** An alias is a second name for a decision the token already names, and it is the only place where the two can disagree. Every colour bug in the KR build lived in that layer and nowhere else: a ramp mis-mapping, two inks mirrored across the scale, a rename applied to the usages but not the declaration, surfaces pointing at *action* tokens, and names that stopped describing their value (`--ink-soft` is the darkest colour in heavy use; `--ink-60` carries 0.65). Direct consumption is more verbose and makes every one of those impossible, because there is no mapping for anyone to get wrong.
  >
  > **KR's alias layer is not a pattern to copy.** It is a migration artefact from the hardcoded, pre-pipeline site — kept because repointing 7 declarations was cheaper than touching ~170 call sites. A greenfield build has nothing to migrate, so it would inherit the entire cost for none of the benefit.

- **A token lint gate in the site repo, from the first commit**, running in CI on every pull request. It blocks: direct primitive consumption; any `var(--{cl}-…)` the build doesn't define; new hand-written colours in `:root`; and `vendor/tokens.css` diverging from the pinned package. It is an afternoon's work and it is the whole difference between the rule being enforced and being remembered. Hold any unavoidable literals as a **named** baseline that may shrink and never grow — a count-based baseline lets one literal be swapped for another unnoticed.
- **Page-local custom properties get the same discipline as tokens.** An undefined `var()` resolves to *nothing* — no error, no fallback, the declaration silently stops applying. The consumer contract only inspects `--{cl}-*` names, so a page-local typo goes straight through it. KR's `thank-you.html` declared `--ink` while every usage referenced `--ink-soft`, and shipped pure-black body text on the post-purchase page until someone read the CSS.
- **When markup moves into a partial, delete the rules it leaves behind.** KR's `contact.html` still carries `header`, `.bar`, `.mark`, `.back` and `.foot*` rules for a standalone header and footer replaced long ago. Several hold colours, so they read as pipeline drift to anyone auditing — and they are simply dead.
- **One canonical Google Fonts link**, defined in exactly one place (a partial or a build constant) and consumed by every page and any build script (KR's blog builder had its own copy — 5 divergent variants across 12 occurrences). Load only weights the tokens use; the report's fonts-link check enforces the match.
- `partials/` for nav/footer from the first page — shared chrome is edited in one place — but **inline them at build time, never fetch them at runtime.** A `data-include` div filled by `fetch()` after load means the nav and footer do not exist in the served HTML: crawlers see a page with no internal links, and the whole site's link graph disappears. KR shipped exactly this and it is still open as an SEO finding — `contact.html` serves **zero** internal links in raw HTML. Do the inlining in the same build step that generates pages, and remember hand-authored pages need walking too, not just generated ones.
  - If any JS must survive that change (an analytics beacon, a nav toggle), give it its own entry point bound on `DOMContentLoaded`. KR's hamburger was bound inside the include's `.then()`, so removing the fetch would have silently unbound it.
  - **Verify with JavaScript disabled.** Load a page, confirm nav and footer links are in the HTML, then re-enable and test the interactive bits.
- Page-level `<style>` blocks and inline styles follow the same law: tokens only. New token requests go through the JSON + a rebuild, never a local literal.
- First commit = scaffold + vendor tokens + a passing report. Cloudflare deploys it; the pipeline is proven end-to-end before any real page exists.

## Phase 6 — Designing pages

Now — and only now — design. Route by novelty:

- **Novel patterns** (homepage concept, unusual layouts, anything needing side-by-side options): explore in Figma using the variables and text styles, get client sign-off on the direction, then implement in code via Claude. Expect the code to be the higher-fidelity artifact; Figma approves *direction*, not pixels.
- **Everything else** (interior pages, blog templates, standard sections — most of a small site): Claude straight to code, composing existing tokens and patterns. Skipping Figma here isn't a shortcut, it's correct — the system already made the design decisions.
- Client review happens on the **deployed preview URL**, not in Figma. Real fonts, real responsiveness, real content.
- A page needs a value that doesn't exist? That's a *token proposal*: add to JSON → rebuild → sync → use. Never a hex in the page. (KR's rule: no new tokens without explicit approval.)

## Phase 7 — Commerce, email, functions (if in scope)

- Stripe + Resend + R2 per your SETUP.md runbook; all keys as env vars.
- **Email templates (`functions/*.js`) can't use CSS vars** — inline styles only. Don't hardcode hex there either: generate the email templates' style constants from `tokens.flat.json` at build time, or at minimum add them to the report's hex-scan allowlist with a comment mapping each hex to its token. (KR's rejected-navy leak lived in exactly these files.)
- `thank-you.html`-type transactional pages are pages like any other — on-pipeline from day one.

## Phase 8 — Launch

- Verify the sending domain in Resend **on launch day setup, not after** — sandbox mail goes to spam and will embarrass you during client UAT.
- Custom domain on Cloudflare Pages; confirm redirects/SSL.
- Final gates: report 8/8, verify-build clean, token lint green, visual regression baselines accepted, `axe` clean, Chromatic baseline accepted, Lighthouse pass, every page's fonts render from the canonical link.
- **Load every page with JavaScript disabled** and confirm nav, footer and body content are all present in the served HTML.
- Hand the client the specimen page + report.html as the living style guide.

---

## After a token version bump — the one that bites hardest

**A version bump can change what an existing token name resolves to, with no change to any code.** Nothing about it appears in a build log, no tool errors, and the site is simply a different colour. This was the most expensive thing that happened to KR and it deserves its own ritual.

`c98ccc6` upgraded the KR tokens `v0.2.0 → v1.0.0`, which **renumbered the neutral ramp two steps**: `neutral-100` had been `#f5f0e8` and became `#e2d9c8`. The alias block pointed at primitives, so every alias silently followed. The entire site's background went from cream to a darker tan on a commit that never touched `styles.css`, and stayed that way, live, for weeks — until someone noticed by eye.

The same bump also **renamed** the semantic layer wholesale, and a `var()` pointing at a name that no longer exists resolves to nothing at all.

Every time, without exception:

1. **Bump the pin and run the sync in one commit.** Never separately — see Phase 3 on why the pin alone changes nothing.
2. **Run the lint gate.** It catches dangling references, primitives that crept back, new literals, and vendor/pin divergence.
3. **Read the visual regression diff.** This is the check that catches a value moving under a name that still resolves — the case the lint gate is blind to, because nothing in the code changed and every reference is still valid. A bump that was meant to change nothing should produce an empty diff; anything else is either the change you intended or the one you didn't, and both need looking at. Accept baselines deliberately, never in bulk.
4. **Re-read any token whose *meaning* may have shifted**, not just its value — a renamed or repurposed semantic is the case a resolving `var()` cannot reveal.
5. **Read the pipeline's changelog for renames and value moves** before trusting the build. This is what the snapshot/changelog scripts in Phase 3 are for.

The two gates answer different questions and neither substitutes for the other. The lint gate asks *does every name still resolve* — it has no opinion on what it resolves to. Visual regression asks *did the page change* — it has no idea why. A ramp renumbering passes the first and fails the second, which is precisely why KR's went unnoticed: the site had the first check and not the second.

## Why this order kills retrospective work

Every retrofit on KR came from one inversion: **CSS existed before tokens.** That made tokens an extraction job (archaeology, normalization, 33KB of hand-written values to reconcile) instead of a declaration. This sequence makes each layer the *only* possible source for the next: JSON is the only source of Figma variables and vendor CSS; vendor CSS is the only source of site values; the report and verify scripts make violations fail loudly the day they're introduced instead of surfacing in a review a month later.

## Day-one checklist

- [ ] Font weights confirmed available (Google Fonts axes + Figma hosted)
- [ ] Dark mode in/out decided
- [ ] Both repos created, SSH remotes, secrets in GitHub/Cloudflare only
- [ ] Cloudflare Pages connected and deploying
- [ ] tokens.light.json authored: primitives → semantic (→ components as needed)
- [ ] No token has $value + children; no doubled segments; all dimensions unit-ed
- [ ] Build + sync + verify + report wired; report 8/8 on first build
- [ ] Storybook data contracts regenerated for this client
- [ ] Translucent colours via `color-mix()` against a token — no retyped `rgba()` anywhere
- [ ] Every background token has a contrast-checked `on-*` partner
- [ ] Figma file created from JSON; variables scoped at creation; text styles with verified weights
- [ ] No alias layer — site CSS references `var(--{cl}-colour-…)` directly
- [ ] Site scaffold: semantic tokens only, one fonts link, nav/footer inlined at build time, first deploy green
- [ ] Nav and footer present in the served HTML with JavaScript disabled
- [ ] Token lint gate running in the **site** repo's CI on every pull request
- [ ] Visual regression snapshots of the deployed site, baselined before the first real page
- [ ] `axe`/`pa11y` running in CI on every pull request
- [ ] Pin and `vendor/tokens.css` committed together; CI fails when they diverge
