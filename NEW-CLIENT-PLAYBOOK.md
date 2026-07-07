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

Deliverable of this phase: the complete visual language of the site exists in JSON, before Figma and before any CSS.

## Phase 3 — Build and guardrails (before any site CSS exists)

Wire the full toolchain now, while there's nothing to break:

- `npm run build` → `dist/{light,dark}/variables.css|tokens.js|tokens.flat.json`, client prefix (`--{cl}-…`).
- `scripts/sync-tokens.sh` → site `vendor/tokens.css`. The site never reads `dist/` directly.
- `verify-build.mjs` — the consumer contract: fails if the site uses any `var(--{cl}-…)` the build doesn't define. Wire it into `npm test` / prepublish AND remember CI (Chromatic workflow) doesn't run it — protection is local, so run it before every push.
- `npm run report` → `dist/report.html`, chained after build: doubled-segment lint, unitless-font lint, hardcoded-hex scan, fonts-link↔token match, dist↔vendor sync. **Target 8/8 passing from the first build.** On KR these checks were archaeology; on a fresh client they're a tripwire that keeps the repo clean.
- Snapshot + changelog scripts, so every token change is diffable.
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

- `styles.css` `:root` contains **only aliases onto semantic vendor tokens** (`--ink: var(--{cl}-colour-text-default)`) plus purely-local layout vars (`--measure`, `--ease`). No literal colours, sizes, or families anywhere. There is never a hand-written value to fall back on — the "edit the JSON, not the CSS" habit is enforced structurally.
- **One canonical Google Fonts link**, defined in exactly one place (a partial or a build constant) and consumed by every page and any build script (KR's blog builder had its own copy — 5 divergent variants across 12 occurrences). Load only weights the tokens use; the report's fonts-link check enforces the match.
- `partials/` + `includes.js` for nav/footer from the first page — shared chrome is edited in one place.
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
- Final gates: report 8/8, verify-build clean, Chromatic baseline accepted, Lighthouse pass, every page's fonts render from the canonical link.
- Hand the client the specimen page + report.html as the living style guide.

---

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
- [ ] Figma file created from JSON; variables scoped at creation; text styles with verified weights
- [ ] Site scaffold: semantic aliases only, one fonts link, partials/includes, first deploy green
