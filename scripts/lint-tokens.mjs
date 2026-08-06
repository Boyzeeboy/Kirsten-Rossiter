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
 *
 * So this checks three things, in rough order of how badly each one bites:
 *
 *   1. ERROR   No site file consumes a primitive directly.
 *   2. ERROR   Every var(--kr-*) reference resolves to a token that exists.
 *   3. RATCHET Literal colours in the styles.css :root block may not increase.
 *
 * Run: npm run lint:tokens
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const TOKENS = join(ROOT, 'vendor', 'tokens.css');
const STYLES = join(ROOT, 'styles.css');

/**
 * Literal colours still sitting in the styles.css :root block.
 *
 * The playbook's governing rule ("no CSS value is ever hand-written") forbids
 * these too, but these 18 predate the rule and most cannot be fixed here: they
 * are rgba() alpha variants — `rgba(245, 240, 232, 0.35)` and friends — and the
 * pipeline carries no alpha tokens at all. That is a gap in the token set, not
 * drift in the site, and closing it means authoring tokens upstream.
 *
 * Held by *name* rather than as a count, so that swapping one literal for
 * another is still caught. This is a ratchet: delete a name when you convert it
 * to a token. When the set empties, promote this to a hard error.
 */
const LITERAL_BASELINE = new Set([
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
]);

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

/** The :root { ... } block of styles.css, by brace counting. */
function rootBlock() {
  const css = readFileSync(STYLES, 'utf8');
  const start = css.indexOf(':root {');
  if (start === -1) throw new Error('styles.css has no :root block — has the file moved?');
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) {
      return { text: css.slice(start, i), lineOffset: css.slice(0, start).split('\n').length };
    }
  }
  throw new Error('styles.css :root block is unterminated.');
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

// ── 3. Literal-colour ratchet ───────────────────────────────────────────────
const { text, lineOffset } = rootBlock();
const literals = text
  .split('\n')
  .map((line, i) => ({ line: line.trim(), no: lineOffset + i }))
  .filter(({ line }) => /^--[a-z0-9-]+\s*:/i.test(line) && /#[0-9a-f]{3,8}\b|rgba?\(/i.test(line))
  .map((entry) => ({ ...entry, name: entry.line.match(/^(--[a-z0-9-]+)/i)[1] }));

const added = literals.filter(({ name }) => !LITERAL_BASELINE.has(name));
const removed = [...LITERAL_BASELINE].filter((name) => !literals.some((l) => l.name === name));

if (added.length) {
  errors.push(
    `styles.css :root  ${added.length} new hand-written colour(s):\n` +
      added.map(({ line, no }) => `      styles.css:${no}  ${line}`).join('\n') +
      `\n    No CSS value is ever hand-written (NEW-CLIENT-PLAYBOOK.md:5).\n` +
      `    Author it as a token upstream and consume it through vendor/tokens.css.`
  );
}

if (removed.length) {
  notes.push(
    `${removed.length} baseline literal(s) are gone: ${removed.join(', ')}.\n` +
      `    Remove them from LITERAL_BASELINE in scripts/lint-tokens.mjs to lock the gain in.`
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
console.log(`  literal colours in :root: ${literals.length}, all known (baseline ${LITERAL_BASELINE.size})`);
for (const n of notes) console.log(`\n  → ${n}`);
