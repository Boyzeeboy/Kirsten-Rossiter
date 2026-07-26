# DNS baseline — kirstenrossiter.com (captured 23 July 2026)

Recorded from Xneelo Manage DNS (Standard view) before the apex→www redirect.
Purpose: prove the mail records are byte-identical afterwards.

## MUST NOT CHANGE — mail records

| Type | TTL | Host | Value |
|---|---|---|---|
| MX | 7200 | @ | mail |
| MX | 1200 | send.send | feedback-smtp.eu-west-1.amazonses.com. |
| TXT | 1200 | @ | `v=spf1 mx a include:spf.host-h.net ?all`  ← **root SPF** |
| TXT | 1200 | send.send | `v=spf1 include:amazonses.com ~all` |
| TXT | 7200 | xneelo._domainkey | `v=DKIM1; k=rsa; p=MIIBIjANBgkqhki...` (Xneelo DKIM) |
| TXT | 1200 | resend._domainkey.send | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADC...` (Resend DKIM) |
| TXT | 1200 | _dmarc | `v=DMARC1; p=none;` |
| CNAME | 7200 | autoconfig | mailconfig.konsoleh.co.za. |
| CNAME | 7200 | imap | mail |
| CNAME | 7200 | pop | mail |
| CNAME | 7200 | smtp | mail |
| CNAME | 7200 | relay | mail |
| A | 7200 | mail | 129.232.138.188 |

The two records `LAUNCH-DAY.md` says to guard are the **MX @ → mail** and the
**root SPF TXT @ → `v=spf1 mx a include:spf.host-h.net ?all`**. Both present and
recorded above.

## The redirect works on these — leave in place, do not repoint

| Type | TTL | Host | Value |
|---|---|---|---|
| A | 7200 | @ | 129.232.138.188  ← apex points at Xneelo hosting (this serves the old site + will issue the 301) |
| CNAME | 1200 | www | kirsten-rossiter.pages.dev.  ← www already on Cloudflare Pages, correct |

## Other records (for completeness)

| Type | TTL | Host | Value |
|---|---|---|---|
| CNAME | 7200 | ftp | www |
| CNAME | 601 | control | clientcontrol.your-server.co.za. |
| CNAME | 601 | de.control | de.clientcontrol.your-server.co.za. |
| CNAME | 601 | jhb.control | jhb.clientcontrol.your-server.co.za. |
| CNAME | 7200 | mailpoet1._domainkey | dkim1.sendingservice.net |
| CNAME | 7200 | mailpoet2._domainkey | dkim2.sendingservice.net |
| SRV | 7200 | _autodiscover._tcp | 0 100 443 mailconfig.konsoleh.co.za. |
| TXT | 1200 | @ | `google-site-verification=6KAVVu3HWc5IBffAy9GGdAuBphCCt-lg...` |
| TXT | 1200 | @ | `t1j4fvdnu2sbtujgrvp95dilkm` |
| TXT | 7200 | _mailpoet.kirstenrossiter.com | `6643933ed77e3839dd8776be7758e8e2` |

## Key facts confirmed from this baseline

1. **Apex `A` → 129.232.138.188 is Xneelo shared hosting.** That IP serves the
   old site today, which is exactly the machine that must issue the 301. The
   redirect is configured on the **hosting package**, not in DNS — so this DNS
   screen is *not* where we make the change.
2. **`www` already points at `kirsten-rossiter.pages.dev`.** Correct. Leave it.
3. **The redirect touches no DNS record at all.** Nothing on this screen should
   change. The MX/SPF check afterwards is a safety confirmation, not because the
   redirect goes near them.
