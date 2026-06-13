// POST /contact
// Receives a contact-form submission and emails it via Resend.
//
// Required environment variables (set in Cloudflare → Pages → Settings →
// Variables and Bindings):
//   RESEND_API_KEY  (secret)  same key used for book delivery
//   FROM_EMAIL      (text)    same verified sender
//                              dev:    "Kirsten Rossiter <onboarding@resend.dev>"
//                              launch: "Kirsten Rossiter <hello@send.kirstenrossiter.com>"
//   CONTACT_TO      (text)    where enquiries are delivered
//                              dev:    your own Resend-account email (so you can test)
//                              launch: "webmaster@kirstenrossiter.com"

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid submission." }, 400);
  }

  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim();
  const subject = String(data.subject || "").trim();
  const message = String(data.message || "").trim();
  const honeypot = String(data.company || "").trim(); // hidden anti-spam field

  // Bots fill the hidden field; accept silently and drop so they get no signal.
  if (honeypot) return json({ ok: true });

  if (!name || !email || !message) {
    return json(
      { ok: false, error: "Please fill in your name, email, and message." },
      400
    );
  }
  if (!isEmail(email)) {
    return json({ ok: false, error: "Please enter a valid email address." }, 400);
  }
  if (message.length > 5000) {
    return json({ ok: false, error: "That message is a little too long." }, 400);
  }

  const to = env.CONTACT_TO || "webmaster@kirstenrossiter.com";
  const subjectLine = subject
    ? `Website enquiry: ${subject}`
    : `Website enquiry from ${name}`;

  const html = `
    <div style="font-family:Georgia,'Times New Roman',serif;max-width:560px;color:#1C1814;line-height:1.6">
      <p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#A07840;margin:0 0 18px">New website enquiry</p>
      <p style="margin:0 0 6px"><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
      ${subject ? `<p style="margin:0 0 6px"><strong>Subject:</strong> ${escapeHtml(subject)}</p>` : ""}
      <hr style="border:none;border-top:1px solid #e6ddcd;margin:18px 0" />
      <p style="white-space:pre-wrap;margin:0">${escapeHtml(message)}</p>
      <hr style="border:none;border-top:1px solid #e6ddcd;margin:18px 0" />
      <p style="font-size:12px;color:#9a938a;margin:0">Sent from the contact form on kirstenrossiter.com. Reply to this email to respond directly to ${escapeHtml(name)}.</p>
    </div>`;

  const text =
    `New website enquiry\n\n` +
    `From: ${name} <${email}>\n` +
    (subject ? `Subject: ${subject}\n` : "") +
    `\n${message}\n`;

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
        reply_to: email, // replying in your inbox goes straight to the enquirer
        subject: subjectLine,
        html,
        text,
      }),
    });
    if (!res.ok) {
      return json(
        { ok: false, error: "Couldn't send right now — please try again shortly." },
        502
      );
    }
    return json({ ok: true });
  } catch {
    return json(
      { ok: false, error: "Couldn't send right now — please try again shortly." },
      502
    );
  }
}
