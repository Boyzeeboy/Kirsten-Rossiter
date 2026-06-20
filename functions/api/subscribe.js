const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid submission." }, 400);
  }

  const email = String(data.email || "").trim().toLowerCase();

  if (!email || !isEmail(email)) {
    return json({ ok: false, error: "Please enter a valid email address." }, 400);
  }

  const server = env.MAILCHIMP_SERVER;
  const listId = env.MAILCHIMP_LIST_ID;
  const apiKey = env.MAILCHIMP_API_KEY;

  if (!server || !listId || !apiKey) {
    console.error("Missing Mailchimp env vars");
    return json({ ok: false, error: "Subscription is temporarily unavailable." }, 503);
  }

  const url = `https://${server}.api.mailchimp.com/3.0/lists/${listId}/members`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`anystring:${apiKey}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email_address: email,
        status: "subscribed",
      }),
    });

    const body = await res.json().catch(() => ({}));

    if (res.ok) {
      return json({ ok: true });
    }

    if (body.title === "Member Exists") {
      return json({ ok: true, already: true });
    }

    if (body.title === "Invalid Resource") {
      return json({ ok: false, error: "Please enter a valid email address." }, 400);
    }

    console.error(`Mailchimp error (${res.status}): ${JSON.stringify(body)}`);
    return json({ ok: false, error: "Couldn't subscribe right now — please try again shortly." }, 502);
  } catch (err) {
    console.error("Mailchimp request threw:", err && err.stack ? err.stack : err);
    return json({ ok: false, error: "Couldn't subscribe right now — please try again shortly." }, 502);
  }
}
