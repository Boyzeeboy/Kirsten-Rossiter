// Shared helpers for the payment Functions.
// Files beginning with "_" are NOT routed by Cloudflare Pages — they are
// just modules the routed functions import. Don't rename this file.

const enc = (s) => new TextEncoder().encode(s);
const toHex = (buf) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

// HMAC-SHA256(message) keyed by `secret`, returned as a hex string.
export async function hmacHex(secret, message) {
  // Fail closed. Without this, a missing secret is coerced by TextEncoder to
  // the literal string "undefined", so every signature becomes computable by
  // anyone. Callers guard first and return a readable error; this is the
  // backstop for any caller that forgets.
  if (!secret) {
    throw new Error("hmacHex: signing secret is missing");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    enc(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc(message));
  return toHex(sig);
}

// Constant-time string compare (avoids leaking match position via timing).
export function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
