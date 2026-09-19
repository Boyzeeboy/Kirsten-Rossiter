// static-server.mjs
//
// Serves the repo root the way Cloudflare Pages does, for the Playwright
// runs. The behaviour that matters, and that a generic file server does not
// give you, is extensionless URLs: the nav and footer link to /contact, /blog
// and /building-the-nations, and Pages resolves those to the .html file.
// Without it the pages still render, but every internal link 404s and any
// test that follows one breaks.
//
// No dependency: it is forty lines of node:http, which is cheaper to own than
// a package that also brings directory listings and CORS opinions.
//
// Usage: node scripts/static-server.mjs [port]   (default 4173)

import { createServer } from 'node:http';
import { stat, readFile } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PORT = Number(process.argv[2] || process.env.PORT || 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

async function isFile(p) {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
}

// Mirrors Pages' resolution order: exact file, then <path>.html, then
// <path>/index.html. Anything else is the site's own 404 page.
async function resolve(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, '');
  const base = join(ROOT, clean);
  for (const candidate of [base, `${base}.html`, join(base, 'index.html')]) {
    if (candidate.startsWith(ROOT) && (await isFile(candidate))) return { file: candidate, status: 200 };
  }
  return { file: join(ROOT, '404.html'), status: 404 };
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const { file, status } = await resolve(pathname);
  try {
    const body = await readFile(file);
    res.writeHead(status, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end('server error');
  }
}).listen(PORT, () => {
  console.log(`static-server: serving ${ROOT} at http://localhost:${PORT}`);
});
