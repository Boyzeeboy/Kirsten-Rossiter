# DNS baseline: kirstenrossiter.com (captured 14 September 2026, 15:12 UTC)

Read from the authoritative Xneelo nameserver (`ns1.host-h.net`) immediately
before the zone moves to Cloudflare DNS (ORIN-45, phase 1). This is the
rollback reference: if anything is wrong after the nameserver change, the
Xneelo zone below is still intact and switching the nameservers back restores
it. Supersedes `DNS-BASELINE-2026-07-23.md` as the current picture; that file
stays as the July record.

Why the move: the apex certificate Xneelo issues expired on 25 August and
cannot be re-issued while `www` points at Cloudflare (ORIN-44). Moving DNS
puts the apex on a Cloudflare certificate and retires the `.htaccess` redirect.

## Nameservers, before

`ns1.host-h.net`, `ns2.host-h.net`, `ns1.dns-h.com`, `ns2.dns-h.com`

## Mail: carried to Cloudflare byte-identical (phase 1), replaced by Google in phase 2

| Type | Host | Value |
|---|---|---|
| MX | `@` | `10 mail.kirstenrossiter.com.` |
| A | `mail` | `129.232.138.188` |
| CNAME | `imap` | `mail.kirstenrossiter.com.` |
| CNAME | `smtp` | `mail.kirstenrossiter.com.` |
| CNAME | `pop` | `mail.kirstenrossiter.com.` |
| CNAME | `autoconfig` | `mailconfig.konsoleh.co.za.` |
| SRV | `_autodiscover._tcp` | `0 100 443 mailconfig.konsoleh.co.za.` |
| TXT | `@` | `v=spf1 mx a include:spf.host-h.net ?all` |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |
| TXT | `xneelo._domainkey` | `v=DKIM1;k=rsa;p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4T9g4GDJP2psVg0dzt2HeeyHrU3jHL5Geee/nrFnFOxBQwHPd+hpdmiAVzlipSIFT8Cl6wnUccO9SHzOu0g0Ggi2BjnEYn2wQLVcCgPaNGbrCdaHzSfr8N+2JfqoOth3N0yduOtPNE5R4DgaPTftOXoKkvI1lEH8UKgmmcFPKEJvbIBq4dOeXsvKi1zUansgo4W0nwCUER/wSPfgtOU4tTw0LxEW9+lixu/yYLhnoOAHCdAgPQJjbL4csA0EKF/vYU6W8ijeH0fnqblyHUSr6//ZpwOLIAb/sefo6Pt62z+ciHrZ0QKrcI41dIOJ1z08ULvkSsQ+4t/fYw+LOMnJEQIDAQAB;` |

## Transactional mail (Resend), carried unchanged in both phases

Note the host: Resend's bounce records sit at `send.send`, one level under
the `send.` sending subdomain. Not `send`.

| Type | Host | Value |
|---|---|---|
| MX | `send.send` | `10 feedback-smtp.eu-west-1.amazonses.com.` |
| TXT | `send.send` | `v=spf1 include:amazonses.com ~all` |
| TXT | `resend._domainkey.send` | `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDD5XyfeVchdE5nHykOVH88t3NeS7d/5n65uRyXzmINoE6aZsmVRb1BS/AjsGmEpvYUvbMmVh8/ySrwM8gZGdnMH/wyCsdwJcCPFYWPJsy6Mlda3fHojrbv+VhUM4m1b6gPhZyqDcejKi6fwuE1BZFZBPbSE1qQb1ISZN08LeUVlwIDAQAB` |

## Site

| Type | Host | Value | After the move |
|---|---|---|---|
| A | `@` | `129.232.138.188` | **not recreated**; becomes CNAME to `kirsten-rossiter.pages.dev` via CNAME flattening, with a Cloudflare redirect rule to www |
| CNAME | `www` | `kirsten-rossiter.pages.dev.` | unchanged |

## Other, carried

| Type | Host | Value |
|---|---|---|
| TXT | `@` | `google-site-verification=6KAVVu3HWc5IBffAy9GGdAuBphCCt-IgLwGoMjkLGOk` |
| TXT | `@` | `t1j4fvdnu2sbtujgrvp95dilkm` (owner unknown; kept) |

## Xneelo-specific, not recreated

`ftp` (CNAME www), `relay` (CNAME mail), `control` and the two regional
`control` CNAMEs. The MailPoet records were removed on 26 July and no longer
resolve.

## Raw dig output

```
# dig snapshot, 2026-09-14T15:12:50Z, authoritative ns1.host-h.net
kirstenrossiter.com          NS    ns2.dns-h.com.|ns2.host-h.net.|ns1.host-h.net.|ns1.dns-h.com.|
kirstenrossiter.com          A     129.232.138.188|
kirstenrossiter.com          MX    10 mail.kirstenrossiter.com.|
kirstenrossiter.com          TXT   "google-site-verification=6KAVVu3HWc5IBffAy9GGdAuBphCCt-IgLwGoMjkLGOk"|"v=spf1 mx a include:spf.host-h.net ?all"|"t1j4fvdnu2sbtujgrvp95dilkm"|
www.kirstenrossiter.com      CNAME kirsten-rossiter.pages.dev.|
mail.kirstenrossiter.com     A     129.232.138.188|
imap.kirstenrossiter.com     CNAME mail.kirstenrossiter.com.|
smtp.kirstenrossiter.com     CNAME mail.kirstenrossiter.com.|
pop.kirstenrossiter.com      CNAME mail.kirstenrossiter.com.|
relay.kirstenrossiter.com    CNAME mail.kirstenrossiter.com.|
autoconfig.kirstenrossiter.com CNAME mailconfig.konsoleh.co.za.|
_autodiscover._tcp.kirstenrossiter.com SRV   0 100 443 mailconfig.konsoleh.co.za.|
xneelo._domainkey.kirstenrossiter.com TXT   "v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4T9g4GDJP2psVg0dzt2HeeyHrU3jHL5Geee/nrFnFOxBQwHPd+hpdmiAVzlipSIFT8Cl6wnUccO9SHzOu0g0Ggi2BjnEYn2wQLVcCgPaNGbrCdaHzSfr8N+2JfqoOth3N0yduOtPNE5R4DgaPTftOXoKkvI1lEH8UKgmmcFPKEJvbIBq4dOeXsvKi1zUansgo" "4W0nwCUER/wSPfgtOU4tTw0LxEW9+lixu/yYLhnoOAHCdAgPQJjbL4csA0EKF/vYU6W8ijeH0fnqblyHUSr6//ZpwOLIAb/sefo6Pt62z+ciHrZ0QKrcI41dIOJ1z08ULvkSsQ+4t/fYw+LOMnJEQIDAQAB;"|
_dmarc.kirstenrossiter.com   TXT   "v=DMARC1; p=none;"|
send.kirstenrossiter.com     MX    
send.kirstenrossiter.com     TXT   
resend._domainkey.send.kirstenrossiter.com TXT   "p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDD5XyfeVchdE5nHykOVH88t3NeS7d/5n65uRyXzmINoE6aZsmVRb1BS/AjsGmEpvYUvbMmVh8/ySrwM8gZGdnMH/wyCsdwJcCPFYWPJsy6Mlda3fHojrbv+VhUM4m1b6gPhZyqDcejKi6fwuE1BZFZBPbSE1qQb1ISZN08LeUVlwIDAQAB"|
ftp.kirstenrossiter.com      CNAME www.kirstenrossiter.com.|
control.kirstenrossiter.com  CNAME clientcontrol.your-server.co.za.|
mailpoet1._domainkey.kirstenrossiter.com CNAME 
_mailpoet.kirstenrossiter.com TXT   
_mailpoet.kirstenrossiter.com.kirstenrossiter.com TXT   
send.send.kirstenrossiter.com MX    10 feedback-smtp.eu-west-1.amazonses.com.|
send.send.kirstenrossiter.com TXT   "v=spf1 include:amazonses.com ~all"|
```
