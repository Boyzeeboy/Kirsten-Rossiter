# The Spacing Gap — Kirsten Rossiter

**Date:** 12 August 2026
**Scope:** `styles.css`, the 14 spacing declarations in its `:root` block, every
hand-written dimension literal in the stylesheet, and the `spacing` and `radius`
collections of `kirsten-rossiter-tokens` v2.3.0.
**Status:** Option A actioned 12 Aug (five `:root` declarations). Everything else
below is finding only. Figures describe the state *before* that change unless
noted.

---

## The gap in one paragraph

The pipeline ships **20 spacing tokens and 14 radius tokens. The site consumed
none of them — zero, in either family** (Option A has since connected five; the
other 29 remain unused). Instead it carries its own hand-written
spacing scale of 13 values in `styles.css :root`, used at 111 call sites, plus a
further 60 raw `px` values written directly into `margin`/`padding`/`gap`
declarations across 25 distinct sizes. The governing rule of
`NEW-CLIENT-PLAYBOOK.md` is *"no CSS value is ever hand-written… every colour,
size, family, space, radius, and shadow enters the project as a token in JSON
first"* (line 5). Spacing has never obeyed it, and — unlike colour — nothing
ever noticed, because the lint gate that enforces the rule was written to match
colour's shape and cannot see a dimension.

This is a larger hole than the alias-layer question that surfaced it. The alias
layer is a naming argument about values that *are* tokenised. This is 171 call
sites of values that are not tokenised at all.

---

## How it happened

Three commits, in this order, explain the whole thing:

| Date | Commit | What it did |
|---|---|---|
| 21 Jun | `bc436c2` | `Added spacing variables` — the `--space-*` scale, hand-authored |
| 29 Jun | `68a45e5` | `Wire KR token pipeline into website using Option A double-mapping` |
| 6 Aug | `180a5d0` | `chore: enforce semantic-only token consumption with a lint gate` |

The spacing scale predates the token pipeline by eight days. When the pipeline
landed, the Option A retrofit mapped **colour and type** onto tokens and left
spacing exactly as it found it. That was a reasonable scoping call at the time.
The problem is that nothing recorded it as unfinished, so six weeks later the
lint gate was written against the retrofit's *actual* scope rather than the
playbook's *stated* scope — and locked the omission in as the baseline.

---

## What is actually in the repo

The site has **three** spacing vocabularies, and consumes tokens from none of
them.

**1. The pipeline's spacing tokens — 20 defined, 0 consumed.**

Seven semantic, each carrying a `$description` from Figma:

| Token | Value | Description from Figma |
|---|---|---|
| `spacing/xs` | 4px | icon gaps, tight internal spacing |
| `spacing/s` | 8px | inline gaps, compact padding |
| `spacing/m` | 16px | standard component padding |
| `spacing/l` | 24px | card padding, section gaps |
| `spacing/xl` | 40px | layout section gaps |
| `spacing/2xl` | 56px | between major layout areas |
| `spacing/page` | 104px | horizontal page padding |

Plus a 13-step raw ramp, `spacing/scale/4` through `spacing/scale/104`.

**2. The site's own scale — 14 declarations in `:root`, 111 call sites.**

`--space-xs` (4px) through `--space-section` (120px), plus `--meta` (12px).

**3. Raw `px` in declarations — 60 occurrences, 25 distinct values.**

In `margin`, `padding`, `gap`, `row-gap` and `column-gap`, outside `:root`:

```
14px×9  22px×5  36px×5  140px×4  1px×3  10px×3  18px×3  30px×3  96px×3
11px×2  28px×2  40px×2  56px×2  90px×2  168px×2  4px  5px  6px  12px
20px  34px  38px  44px  110px  180px
```

Five of those 25 values sit on the pipeline's ramp (`4`, `12`, `20`, `40`, `56`).
The other 20 do not, and 13 of them — `1`, `5`, `6`, `10`, `11`, `14`, `18`,
`22`, `30`, `34`, `38`, `90`, `110` — are not on a 4px grid at all.

**Adjacent, same cause, out of scope for the fix below:** 45 more raw `px` in
`width`/`height`/`max-width` (22 distinct, including container widths like
`1160px` and `680px`), 27 in border widths (`1px`×24, `2px`×2, `3px`×1), and 3
media-query breakpoints (`640px`, `760px`, `900px`). Container widths and
breakpoints are arguably not token material; border widths arguably are, and the
pipeline carries no token for them either.

---

## The trap: the two scales share names and disagree on values

This is the finding to read twice. The site's t-shirt sizes and the pipeline's
t-shirt sizes are **offset by roughly two steps**, so a name-matched migration
silently resizes the layout:

| Name | Site value | Pipeline value | Effect of a naive name-match |
|---|---|---|---|
| `xs` | 4px | 4px | — safe |
| `xl` | 20px | 40px | **doubles** |
| `2xl` | 24px | 56px | **+133%** |

A `sed` of `--space-xl` → `--kr-spacing-xl` across the 10 call sites of
`--space-xl` would double every one of them, pass the linter, pass CI, and ship.
That is the same failure shape as `c98ccc6` — the neutral-ramp renumbering that
moved the body background live and went unnoticed by eye for weeks. **Any
migration here must map by value, never by name.**

Mapping by value instead:

| Site alias | Value | Call sites | Pipeline equivalent | Verdict |
|---|---|---|---|---|
| `--space-xs` | 4px | 2 | `spacing/xs` | exact, semantic |
| `--space-sm` | 8px | 7 | `spacing/s` | exact, semantic |
| `--space-lg` | 16px | 12 | `spacing/m` | exact, semantic |
| `--space-2xl` | 24px | 8 | `spacing/l` | exact, semantic |
| `--space-5xl` | 40px | 18 | `spacing/xl` | exact, semantic |
| `--space-md` | 12px | 6 | `spacing/scale/12` | ramp only |
| `--space-xl` | 20px | 10 | `spacing/scale/20` | ramp only |
| `--space-4xl` | 32px | 6 | `spacing/scale/32` | ramp only |
| `--space-6xl` | 48px | 8 | `spacing/scale/48` | ramp only |
| `--space-8xl` | 80px | 8 | `spacing/scale/80` | ramp only |
| `--space-3xl` | 28px | 6 | — | no token at any layer |
| `--space-7xl` | 60px | 3 | — | no token at any layer |
| `--space-section` | 120px | 7 | — | no token (`page` is 104px) |
| `--meta` | 12px | 10 | — | distinct role, do not map — see below |

Which splits the 111 call sites as:

- **47 (42%)** map to a semantic spacing token today, exactly, no upstream work.
- **38 (34%)** exist only on the raw `scale/*` ramp — see the governance note below.
- **26 (23%)** have no usable token; 28px, 60px, 120px and the `--meta` role would
  all need authoring upstream.

### `--meta` is not a mis-filed `label-large`

An earlier draft of this document claimed `--meta` (12px) was a duplicate of
`fonts/size/label-large` (12px) and could be converted for free. That is wrong,
and the existing comment at `styles.css:80` — *"`--meta-*` stays literal: it is a
site-only role with no token counterpart"* — is correct. The sizes coincide; the
roles do not:

| | `--meta-*` | `label-large` |
|---|---|---|
| size | 12px | 12px |
| letter-spacing | 0.04em | 0.1417em |
| line-height | 1.4 | 1.4167 |

The tracking is **3.5× apart**, because meta text is mixed-case Jost Medium and
labels are uppercase Jost SemiBold — uppercase needs the wider tracking. Pointing
`--meta` at `label-large`'s size token would work today and couple two roles that
share nothing but a coincidence, so a future retune of `label-large` would drag
meta text with it on size while leaving its tracking behind.

If `--meta` is to be tokenised it needs its own upstream role — size, line-height
ratio and letter-spacing em — not a borrowed one. Same principle as the spacing
name trap above: match the role, not the number that happens to agree.

---

## Why the linter cannot see any of this

`scripts/lint-tokens.mjs` check 4 is the literal ratchet. It scans the
`styles.css :root` block and flags declarations whose value matches:

```js
/#[0-9a-f]{3,8}\b|rgba?\(/i
```

Hex or `rgba()`. `4px` matches neither, so all 14 spacing declarations sit inside
the scanned block and are read, evaluated, and passed. `LITERAL_BASELINE` holds
18 names — every one of them a colour. The check is doing exactly what it was
written to do; it was simply never widened past colour.

Checks 1–3 don't help either. Check 1 looks for `var(--kr-primitives-…)`, check 2
resolves `var(--kr-…)` references, check 3 diffs `vendor/tokens.css` against the
pin. **None of them fire on a value that never mentions a token at all.** The
enforcement is shaped around *misuse* of the pipeline, and the spacing scale's
failure mode is *non-use* — invisible to all four gates.

Same blind spot upstream: `verify-build.mjs`'s consumer contract checks that
every token the site references exists in the build. It has nothing to say about
the 285 tokens the site references zero times.

### A governance note on `spacing/scale/*`

Check 1 blocks `--kr-primitives-*` because the playbook says primitives are *"not
for direct use by the site, ever"* (line 37). But the raw spacing ramp is filed
under the `spacing` collection as `spacing/scale/4`, **not** under `primitives`.
It is a primitive by nature and semantic by filing.

So `var(--kr-spacing-scale-32)` would violate the playbook's intent and **pass
check 1 cleanly**. That matters directly here: 38 of the 111 call sites can only
be migrated today by consuming the ramp. Doing so would be a governance
regression dressed as a fix — it is precisely the drift that `4492c64` and
`c54e599` were written to undo for colour. If those 38 sites move, they should
move onto semantic tokens authored upstream, not onto the ramp.

---

## Radius is the inverse problem

The pipeline ships 14 radius tokens (7 semantic: `none`, `xs`, `s`, `m`, `l`,
`xl`, `full`; 7 ramp). The site's stylesheet contains exactly **three**
`border-radius` declarations, all of them `50%`, all of them the small gold dots:

```
styles.css:377   background: var(--gold); border-radius: 50%;
styles.css:491   width: 5px; height: 5px; background: var(--gold); border-radius: 50%;
styles.css:646   width: 5px; height: 5px; background: var(--gold); border-radius: 50%;
```

The design has no rounded corners. `50%` on a square is a circle and is not
expressible as a radius token anyway — `radius/full` (9999px) is the idiom, and
would work here, but three call sites is not a gap worth a migration.

So radius is not under-consumed by the site; it is **over-authored upstream**. 14
tokens exist for a design that uses none. That is a smaller and cheaper problem
than spacing, and the honest fix is upstream pruning rather than downstream
adoption — but it is worth recording that the same "0 consumed" statistic has
opposite causes in the two families, and only one of them is the site's fault.

---

## What it would take to close

**Option A — map the 47, stop there. ✅ DONE 12 Aug.** Convert only the five
aliases with exact semantic equivalents (`xs`, `sm`, `lg`, `2xl`, `5xl` →
`spacing/xs`, `s`, `m`, `l`, `xl`). 47 call sites, no upstream work, no visual
change. Leaves eight aliases and all 60 raw `px` untouched, and leaves the site
with a scale that is half tokenised — arguably worse to read than either
endpoint, which is why the `:root` block now carries a comment saying so.

**Option B — author the missing tokens, then migrate the scale.** Add semantic
spacing for 12, 20, 28, 32, 48, 60, 80 and 120px upstream, sync, then convert all
111 call sites by value. Closes the `:root` scale completely and legitimately.
Costs a Figma edit, a MINOR pipeline release, a pin bump and a re-sync — and it
enshrines a 13-step scale, which is a lot of semantic spacing tokens for a
five-page site. Still leaves the 60 raw `px`.

**Option C — normalise the design onto the existing ramp, then migrate.** Round
the 25 raw values and the 13 scale steps onto the pipeline's seven semantics.
This is the only option that ends with the playbook rule actually true. It is
also the only one that **changes what the site looks like** — 22px→24px, 36px→40px,
90px→104px and so on, across 171 call sites. It needs a visual review and Kirsten's
sign-off, and per `NEXT-SESSION.md` the visual-regression gate is currently
deferred, so there is nothing automated to catch a mistake.

### Recommendation

**Option A now, as a standalone commit, then decide between B and C separately.**

A is 47 call sites, provably zero visual change (every mapping is value-exact),
and it converts the loudest 42% of the problem. It can ship this week without a
design conversation. *Done 12 Aug — five declarations in `styles.css :root`, all
14 spacing customs verified to resolve to their previous values in-browser.*

B versus C is a real fork and should not be smuggled into a cleanup commit. C is
the correct answer to "make the playbook true"; B is the correct answer to "keep
the current design pixel-identical". My read is that C is right in principle and
badly timed — with visual regression deferred, a 171-site restyle has no safety
net. Revisit it when that gate exists.

Whichever way that goes, do these two regardless:

1. ~~**Widen the ratchet.**~~ — **done 12 Aug 2026.** Check 4 now flags
   dimensions (`px`/`rem`/`em`) as well as colours, and reads **every**
   custom-property declaration rather than only the `styles.css :root` block —
   including the page-local `<style>` blocks in `contact.html`, `thank-you.html`
   and `building-the-nations.html`, which it had never seen. `LITERAL_BASELINE`
   became a per-file map and grew 18 → 33, the 15 additions being the 10
   surviving `styles.css` dimensions and the 5 page-local values that were
   invisible before. Verified by fault injection: a new dimension in
   `styles.css`, and a new colour in `contact.html`'s local `:root`, both fail
   the gate; converting a baseline entry to a token reports a note rather than
   an error.

   **Still uncovered:** literals written directly into rule bodies —
   `padding: 22px`, not `--space-foo: 22px`. That is the 60-occurrence half of
   the gap and it needs a *different* check, not a wider regex, because check 4
   is built around custom-property declarations. Worth adding as check 5 if
   Option B or C goes ahead; until then the values are at least inventoried
   above.
2. **Move `spacing/scale/*` and `radius/scale/*` under `primitives`,** or widen
   check 1 to match `*-scale-*`. Right now the ramp is consumable without
   tripping any gate, which makes the semantic-only rule unenforceable for
   dimensions in exactly the way it is enforceable for colour. Still open —
   it is an upstream change, not a site one.

---

## What not to do

- **Do not name-match.** `--space-xl` is 20px; `spacing/xl` is 40px. Map by value.
- **Do not migrate onto `spacing/scale/*`** to close the 38 ramp-only call sites.
  It passes the linter and defeats its purpose.
- **Do not fold this into the colour de-aliasing change.** That one is
  provably no-op; this one is not, and mixing them makes the diff unreviewable.
