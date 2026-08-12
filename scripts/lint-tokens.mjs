#!/usr/bin/env node
/**
 * lint-tokens.mjs
 *
 * WHY THIS EXISTS
 *
 * The site is supposed to consume the token pipeline's *semantic* layer only —
 * `colour/background/default`, not `primitives/neutral/0`. That rule is written
 * down in NEW-CLIENT-PLAYBOOK.md (lines 5, 37-38, 77) and was retrofitted onto
 * this repo in two deliberate passes (4492c64, c54e599). Nothing enforced it,
 * so it could drift back silently — and drift here is expensive:
 *
 *   - c98ccc6 bumped tokens v0.2.0 → v1.0.0, which renumbered the neutral ramp
 *     two steps. `styles.css` aliased *primitives*, so every alias silently
 *     moved with it. The site's body background went #f5f0e8 → #e2d9c8 and
 *     stayed that way, live, until someone noticed by eye.
 *   - The same bump renamed semantic tokens. A renamed token leaves a `var()`
 *     pointing at nothing, which CSS resolves to *nothing* rather than erroring.
 *   - The pin in package.json does not reach the deployed site on its own.
 *     Cloudflare runs `npm install && node build-blog.js`, which installs the
 *     tokens package and then never reads it; the pages link the *committed*
 *     vendor/tokens.css. Bump the pin without running `npm run sync-tokens` and
 *     everything stays green while the site serves the old tokens.
 *
 * So this checks four things, in rough order of how badly each one bites:
 *
 *   1. ERROR   No site file consumes a primitive directly.
 *   2. ERROR   Every var(--kr-*) reference resolves to a token that exists.
 *   3. ERROR   vendor/tokens.css matches the pinned package (skipped if the
 *              package is not installed — see below).
 *   4. RATCHET Hand-written values in custom-property declarations may not
 *              increase — any file, colours and dimensions alike.
 *
 * Run: npm run lint:tokens
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const TOKENS = join(ROOT, 'vendor', 'tokens.css');
const STYLES = join(ROOT, 'styles.css');
const PKG = join(ROOT, 'node_modules', 'kirsten-rossiter-tokens');
const PKG_TOKENS = join(PKG, 'dist', 'light', 'variables.css');

/**
 * Hand-written values still sitting in custom-property declarations.
 *
 * WHAT COUNTS. A declaration is flagged when its value contains a colour
 * (`#hex`, `rgb()/rgba()`, `hsl()/hsla()`) or a dimension (`px`, `rem`, `em`).
 * Deliberately NOT flagged, because the pipeline has nothing to offer them:
 *
 *   `%`, `vw`, `vh`, `fr`     viewport- and container-relative, not token material
 *   bare numbers (`1.4`)      unitless ratios; `--meta-lh` is one
 *   `cubic-bezier(…)`         motion; the pipeline carries no easing tokens
 *   `0` / `0px`               zero is zero in every design system
 *   var() with a fallback     `var(--kr-fonts-family-base), sans-serif` is correct
 *
 * WHY THESE SURVIVE. Two separate reasons, and they have different fixes:
 *
 *   The colours are rgba() alpha variants — `rgba(245, 240, 232, 0.35)` and
 *   friends. The pipeline carries no alpha channel at all, so these cannot be
 *   sourced upstream today. A gap in the token set, not drift in the site.
 *
 *   The dimensions are the remaining half of the spacing gap. Five of the
 *   original thirteen `--space-*` steps were connected to semantic tokens on
 *   12 Aug; these eight could not be, because five exist only on the raw
 *   spacing/scale/* ramp (a primitive by nature — NEW-CLIENT-PLAYBOOK.md:37)
 *   and three (28, 60, 120px) have no token at any layer. `--meta`/`--meta-ls`
 *   are a genuine site-only role: 12px coincides with fonts/size/label-large
 *   but the tracking differs 3.5x, so borrowing that token would couple two
 *   unrelated roles. Full reasoning in SPACING-GAP.md.
 *
 * Keyed by file as well as name, so that moving a literal from styles.css into
 * a page-local <style> block is caught rather than laundered. Held by *name*
 * rather than as a count, so that swapping one literal for another is caught
 * too. This is a ratchet: delete a name when you convert it to a token. When a
 * file's set empties, drop the file. When the whole map empties, promote this
 * to a hard error.
 */
const LITERAL_BASELINE = {
  'styles.css': new Set([
    // Colour — alpha variants, no upstream equivalent.
    '--ink-deep',
    '--cream-overlay',
    '--cream-strong',
    '--cream-medium',
    '--cream-soft',
    '--cream-muted',
    '--cream-ghost',
    '--cream-faint',
    '--gold-medium',
    '--gold-muted',
    '--gold-faint',
    '--gold-ghost',
    '--rule',
    '--shadow-heavy',
    '--shadow-medium',
    '--shadow-soft',
    '--white-faint',
    '--error',
    // Dimension — the unmapped half of the spacing scale.
    '--space-md',
    '--space-xl',
    '--space-3xl',
    '--space-4xl',
    '--space-6xl',
    '--space-7xl',
    '--space-8xl',
    '--space-section',
    '--meta',
    '--meta-ls',
  ]),
  // Page-local <style> blocks. These were invisible to this check until 12 Aug
  // 2026, when it only ever read the styles.css :root block.
  'contact.html': new Set(['--ink-40', '--ink-60']),
  'thank-you.html': new Set(['--ink-60']),
  'building-the-nations.html': new Set(['--measure', '--rule-w']),
};

/** Directories never worth walking. vendor/ is the token source itself. */
const SKIP_DIRS = new Set(['node_modules', '.git', 'vendor', '.github']);

/** Only these can consume a token. */
const SCAN_EXT = /\.(css|html|js)$/;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXT.test(entry)) out.push(full);
  }
  return out;
}

/** Every --kr-* custom property the pipeline actually defines. */
function definedTokens() {
  const css = readFileSync(TOKENS, 'utf8');
  return new Set([...css.matchAll(/^\s*(--kr-[a-z0-9-]+)\s*:/gim)].map((m) => m[1]));
}

const COLOUR_VALUE = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?)\(/i;
const DIMENSION_VALUE = /(?<![\w.-])\d*\.?\d+(?:px|rem|em)\b/i;
const DECLARATION = /(--[a-z0-9-]+)\s*:\s*([^;{}]+?)\s*[;}]/gi;

/**
 * Custom-property declarations carrying a hand-written value, anywhere.
 *
 * Comments are blanked rather than stripped so that reported line numbers stay
 * true — a commented-out declaration must not be flagged, but the lines it
 * occupies still have to count.
 */
function scanBlock(text, file, lineOffset, out) {
  const clean = text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
  for (const m of clean.matchAll(DECLARATION)) {
    const [, name, value] = m;
    if (!COLOUR_VALUE.test(value) && !DIMENSION_VALUE.test(value)) continue;
    if (/^0(?:px|rem|em)?$/.test(value)) continue;
    out.push({
      file,
      name,
      value,
      line: lineOffset + clean.slice(0, m.index).split('\n').length - 1,
      kind: COLOUR_VALUE.test(value) ? 'colour' : 'dimension',
    });
  }
}

/**
 * Every hand-written declaration in the site: whole-file for CSS, and the
 * contents of each <style> block for HTML.
 *
 * The HTML half is the part that was missing. Three pages carry their own
 * :root blocks — contact.html and thank-you.html hold alpha colours there, and
 * building-the-nations.html holds layout dimensions — and none of it was ever
 * read while this check looked only at the styles.css :root block.
 */
function literalDeclarations(files) {
  const out = [];
  for (const abs of files) {
    const file = relative(ROOT, abs).split(sep).join('/');
    const text = readFileSync(abs, 'utf8');
    if (file.endsWith('.css')) {
      scanBlock(text, file, 1, out);
    } else if (file.endsWith('.html')) {
      for (const m of text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
        const contentStart = m.index + m[0].indexOf('>') + 1;
        scanBlock(m[1], file, text.slice(0, contentStart).split('\n').length, out);
      }
    }
  }
  return out;
}

const errors = [];
const notes = [];

// ── 1. No direct primitive consumption ──────────────────────────────────────
// The whole point of the semantic layer: a surface reading --cream should
// follow a *decision* (background/default), not a *value* (neutral/0). A
// primitive reference bypasses that and reattaches the site to the raw ramp,
// which is exactly what let c98ccc6 move the site's colours without warning.
const files = walk(ROOT);
const defined = definedTokens();

for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/');
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const m of line.matchAll(/var\(\s*(--kr-primitives-[a-z0-9-]+)/gi)) {
        errors.push(
          `${rel}:${i + 1}  consumes a primitive directly: ${m[1]}\n` +
            `    Primitives are not for direct use by the site (NEW-CLIENT-PLAYBOOK.md:37).\n` +
            `    Use the semantic token that carries this decision, or add one upstream if none does.`
        );
      }
    });
}

// ── 2. No dangling token references ─────────────────────────────────────────
// A var() pointing at a token that no longer exists resolves to nothing at all
// — no error, no fallback, just a property that silently stops applying. Token
// renames (v1.0.0 renamed the semantic layer wholesale) make this a live risk
// on every `npm run sync-tokens`.
for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/');
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const m of line.matchAll(/var\(\s*(--kr-[a-z0-9-]+)/gi)) {
        if (!defined.has(m[1])) {
          errors.push(
            `${rel}:${i + 1}  references a token that does not exist: ${m[1]}\n` +
              `    Not defined in vendor/tokens.css. Renamed or removed by a token bump?\n` +
              `    CSS resolves this to nothing — the declaration silently stops applying.`
          );
        }
      }
    });
}

// ── 3. vendor/tokens.css matches the pinned package ─────────────────────────
// The pin is not what the live site consumes — the committed vendor/tokens.css
// is. Nothing else notices when those two disagree: `npm install` succeeds, the
// build is green, and the site serves whatever was last committed. This is the
// only place that disagreement surfaces.
//
// Skipped rather than failed when the package is absent, so the linter stays
// runnable without `npm ci` (a git-tag dependency is slow to fetch). CI installs
// first, so there the check is real.
let syncState;

if (!existsSync(PKG_TOKENS)) {
  syncState = 'skipped — kirsten-rossiter-tokens not installed (run npm ci to include this check)';
  notes.push(
    `Token sync check skipped: ${relative(ROOT, PKG)} is not installed.\n` +
      `    Run \`npm ci\` to verify vendor/tokens.css matches the pinned package.`
  );
} else {
  const vendored = readFileSync(TOKENS, 'utf8');
  const packaged = readFileSync(PKG_TOKENS, 'utf8');
  const version = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8')).version;

  if (vendored === packaged) {
    syncState = `in sync with kirsten-rossiter-tokens v${version}`;
  } else {
    syncState = `OUT OF SYNC with v${version}`;
    const vLines = vendored.split('\n');
    const pLines = packaged.split('\n');
    const sample = [];
    for (let i = 0; i < Math.max(vLines.length, pLines.length) && sample.length < 5; i++) {
      if (vLines[i] !== pLines[i]) {
        sample.push(`      vendor:  ${(vLines[i] ?? '(missing)').trim()}`);
        sample.push(`      package: ${(pLines[i] ?? '(missing)').trim()}`);
      }
    }
    errors.push(
      `vendor/tokens.css does not match the pinned package (v${version}).\n` +
        `    The pin was bumped without re-syncing, or vendor/tokens.css was hand-edited.\n` +
        `    The live site serves the committed file, so it is still on the old tokens.\n` +
        `    Fix with: npm run sync-tokens\n` +
        `    First differences:\n` +
        sample.join('\n')
    );
  }
}

// ── 4. Hand-written-value ratchet ───────────────────────────────────────────
const literals = literalDeclarations(files);

const present = new Map(); // file -> Set(names)
for (const d of literals) {
  if (!present.has(d.file)) present.set(d.file, new Set());
  present.get(d.file).add(d.name);
}

const added = literals.filter((d) => !LITERAL_BASELINE[d.file]?.has(d.name));
const removed = Object.entries(LITERAL_BASELINE).flatMap(([file, names]) =>
  [...names].filter((name) => !present.get(file)?.has(name)).map((name) => `${file} ${name}`)
);

if (added.length) {
  const colours = added.filter((d) => d.kind === 'colour').length;
  const dims = added.length - colours;
  errors.push(
    `${added.length} new hand-written value(s) ` +
      `(${colours} colour, ${dims} dimension):\n` +
      added.map((d) => `      ${d.file}:${d.line}  ${d.name}: ${d.value}`).join('\n') +
      `\n    No CSS value is ever hand-written (NEW-CLIENT-PLAYBOOK.md:5).\n` +
      `    Author it as a token upstream and consume it through vendor/tokens.css.\n` +
      `    If it genuinely cannot be tokenised, say why in LITERAL_BASELINE and add it there.`
  );
}

if (removed.length) {
  notes.push(
    `${removed.length} baseline literal(s) are gone:\n` +
      removed.map((r) => `      ${r}`).join('\n') +
      `\n    Remove them from LITERAL_BASELINE in scripts/lint-tokens.mjs to lock the gain in.`
  );
}

// ── Report ──────────────────────────────────────────────────────────────────
const scanned = `${files.length} files, ${defined.size} tokens defined`;

if (errors.length) {
  console.error(`\n✗ Token lint failed — ${errors.length} problem(s)\n`);
  for (const e of errors) console.error(`  ${e}\n`);
  console.error(`Scanned ${scanned}.\n`);
  process.exit(1);
}

console.log(`✓ Token lint passed (${scanned})`);
console.log(`  no primitives consumed directly`);
console.log(`  all var(--kr-*) references resolve`);
console.log(`  vendor/tokens.css ${syncState}`);
// Counted by distinct file+name, matching how the baseline is held: a property
// declared twice (building-the-nations.html re-declares --rule-w per section)
// is one entry to ratchet down, not two.
const baselineSize = Object.values(LITERAL_BASELINE).reduce((n, s) => n + s.size, 0);
const distinct = new Set(literals.map((d) => `${d.file} ${d.name}`));
const kinds = new Map(literals.map((d) => [`${d.file} ${d.name}`, d.kind]));
const byKind = (k) => [...kinds.values()].filter((v) => v === k).length;
console.log(
  `  hand-written values: ${distinct.size} (${byKind('colour')} colour, ` +
    `${byKind('dimension')} dimension) across ${present.size} file(s), ` +
    `all known (baseline ${baselineSize})` +
    (literals.length === distinct.size ? '' : `, ${literals.length} declaration sites`)
);
for (const n of notes) console.log(`\n  → ${n}`);
