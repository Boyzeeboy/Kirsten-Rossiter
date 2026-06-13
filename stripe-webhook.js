// POST /stripe-webhook
// Stripe calls this after a successful payment. We verify the call really
// came from Stripe, then email the buyer a signed, 24-hour download link.
//
// Required environment variables / bindings (set in Cloudflare → Pages →
// Settings → Variables and Bindings — see SETUP.md):
//   STRIPE_WEBHOOK_SECRET    (secret)  from the Stripe webhook you create
//   DOWNLOAD_SIGNING_SECRET  (secret)  any long random string you invent
//   RESEND_API_KEY           (secret)  from resend.com
//   FROM_EMAIL               (text)    dev:    "Kirsten Rossiter <onboarding@resend.dev>"
//                                       launch: "Kirsten Rossiter <hello@send.kirstenrossiter.com>"
//   SITE_URL                 (text)    dev:    "https://<your-project>.pages.dev"
//                                       launch: "https://www.kirstenrossiter.com"

import { hmacHex, timingSafeEqual } from "./_crypto.js";

const DOWNLOAD_TTL_MS = 24 * 60 * 60 * 1000; // link valid for 24 hours

export async function onRequestPost(context) {
  const { request, env } = context;

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text(); // raw text is required for verification

  // 1 — Confirm the event genuinely came from Stripe.
  const verified = await verifyStripeSignature(
    rawBody,
    signature,
    env.STRIPE_WEBHOOK_SECRET
  );
  if (!verified) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Invalid payload", { status: 400 });
  }

  // 2 — Only act on a completed, paid checkout. Acknowledge everything else
  //     with 200 so Stripe doesn't keep retrying.
  if (event.type !== "checkout.session.completed") {
    return new Response("Ignored", { status: 200 });
  }

  const session = event.data.object || {};
  if (session.payment_status && session.payment_status !== "paid") {
    return new Response("Not paid", { status: 200 });
  }

  const email =
    (session.customer_details && session.customer_details.email) ||
    session.customer_email;
  if (!email) {
    return new Response("No customer email", { status: 200 });
  }

  // 3 — Build a tamper-proof, time-limited download link.
  const expiry = Date.now() + DOWNLOAD_TTL_MS;
  const token = await hmacHex(env.DOWNLOAD_SIGNING_SECRET, String(expiry));
  const base = String(env.SITE_URL || "").replace(/\/$/, "");
  const link = `${base}/download?e=${expiry}&t=${token}`;

  // 4 — Email the link. Returning 500 on failure makes Stripe retry later.
  const sent = await sendDownloadEmail(env, email, link);
  if (!sent) {
    return new Response("Email send failed", { status: 500 });
  }

  return new Response("ok", { status: 200 });
}

// --- Stripe signature verification (no SDK needed) ---------------------
async function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;

  let timestamp;
  let v1;
  for (const part of header.split(",")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i);
    const val = part.slice(i + 1);
    if (k === "t") timestamp = val;
    else if (k === "v1") v1 = val;
  }
  if (!timestamp || !v1) return false;

  // Reject events too far from now (replay protection).
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > toleranceSec) return false;

  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return timingSafeEqual(expected, v1);
}

// --- Email via Resend ---------------------------------------------------
async function sendDownloadEmail(env, to, link) {
  const html = `
  <div style="font-family:Georgia,'Times New Roman',serif;max-width:520px;margin:0 auto;color:#1C1814;line-height:1.6">
    <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#A07840;margin:0 0 18px">Kirsten Rossiter</p>
    <h1 style="font-size:26px;font-weight:500;margin:0 0 16px">Thank you — your book is ready.</h1>
    <p style="margin:0 0 14px">Thank you for your order of <em>Building the Nations from the Ground Up</em>. Your download is ready below.</p>
    <p style="margin:24px 0">
      <a href="${link}" style="display:inline-block;background:#1A2235;color:#F5F0E8;text-decoration:none;padding:14px 28px;letter-spacing:.1em;font-size:14px;font-family:Helvetica,Arial,sans-serif">DOWNLOAD THE EBOOK (ePub)</a>
    </p>
    <p style="font-size:13px;color:#6b645c;margin:0 0 6px">This link is valid for 24 hours. If it expires before you've saved the file, just reply to this email and we'll send a fresh one.</p>
    <hr style="border:none;border-top:1px solid #e6ddcd;margin:28px 0" />
    <p style="font-size:12px;color:#9a938a;margin:0">Kirsten Rossiter Prophetic Ministries</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.FROM_EMAIL,
        to,
        subject: "Your download — Building the Nations from the Ground Up",
        html,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
