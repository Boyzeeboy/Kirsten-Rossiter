// GET /download?e=<expiry>&t=<token>
// Validates the signed link emailed to the buyer, then streams the ePub
// from private R2 storage. The file is never publicly reachable otherwise.
//
// Required:
//   DOWNLOAD_SIGNING_SECRET  (secret)  must match the webhook's value
//   BOOK_BUCKET              (R2 binding) the bucket holding the ePub
//   BOOK_KEY                 (text, optional) object name in the bucket;
//                            defaults to "building-the-nations.epub"

import { hmacHex, timingSafeEqual } from "./_crypto.js";

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const expiry = url.searchParams.get("e");
  const token = url.searchParams.get("t");

  if (!expiry || !token) {
    return new Response("This download link is incomplete.", { status: 400 });
  }

  // 1 — Expiry check.
  if (Date.now() > Number(expiry)) {
    return new Response(
      "This download link has expired. Please contact us and we'll send a fresh one.",
      { status: 410 }
    );
  }

  // 2 — Signature check (proves the link was issued by us, unaltered).
  // Guard the secret before signing: if DOWNLOAD_SIGNING_SECRET is missing or
  // misnamed in Cloudflare, the HMAC key would be the string "undefined" and
  // anyone could forge a working link. Refuse rather than validate weakly.
  if (!env.DOWNLOAD_SIGNING_SECRET) {
    console.error("download: DOWNLOAD_SIGNING_SECRET is not configured");
    return new Response(
      "The download is temporarily unavailable. Please contact us and we'll send your book.",
      { status: 500 }
    );
  }
  const expected = await hmacHex(env.DOWNLOAD_SIGNING_SECRET, String(expiry));
  if (!timingSafeEqual(expected, token)) {
    return new Response("This download link is not valid.", { status: 403 });
  }

  // 3 — Stream the file straight from R2.
  // Guard the binding itself: if BOOK_BUCKET isn't configured in Cloudflare,
  // `env.BOOK_BUCKET.get(...)` throws an uncaught TypeError, which Cloudflare
  // surfaces to the buyer as a raw "Error 1101 — Worker threw exception" page.
  // Catch it here and return a readable error instead.
  if (!env.BOOK_BUCKET) {
    console.error("download: BOOK_BUCKET R2 binding is not configured");
    return new Response(
      "The download is temporarily unavailable. Please contact us and we'll send your book.",
      { status: 500 }
    );
  }
  const key = env.BOOK_KEY || "building-the-nations.epub";
  const object = await env.BOOK_BUCKET.get(key);
  if (!object) {
    return new Response("The file could not be found.", { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      "Content-Type": "application/epub+zip",
      "Content-Disposition":
        'attachment; filename="Building the Nations from the Ground Up.epub"',
      "Cache-Control": "no-store",
    },
  });
}
