#!/usr/bin/env bash
# Live health check for kirstenrossiter.com. Run weekly by
# .github/workflows/health-check.yml and by hand: scripts/health-check.sh
#
# WHY THIS EXISTS
#
# The apex certificate expired on 25 August 2026 and nothing noticed for twenty
# days (INCIDENTS.md, 2026-09-14). The weekly check at the time asserted on the
# status line and Location header of an http:// fetch, which an expired
# certificate does not change. It was written for the 31 July failure and could
# not see the next one. The 3 August entry records the other failure mode: a
# check that reads through a tool with a cache, and reports stale content as
# live.
#
# So: every request here goes straight at the live hostname with curl, TLS
# validation on (curl's default), a unique cache-buster on every URL, and the
# assertion is on the status line, the Location header, or the body, never on
# a tool's summary of them. Certificates are read with openssl and must have
# more than 14 days left, so an expiry is caught two Mondays before it lands.
#
# Any failure exits non-zero, which fails the workflow, which emails the repo
# owner. Silence means every check passed, not that nothing ran.

set -u

APEX="kirstenrossiter.com"
WWW="www.kirstenrossiter.com"
NOW=$(date +%s)
NOCACHE="nocache=$NOW"
FAIL=0
PASS=0

ok()   { PASS=$((PASS+1)); printf '  ok    %s\n' "$1"; }
fail() { FAIL=$((FAIL+1)); printf '  FAIL  %s\n' "$1"; }

# status + location of a single request, no redirect following
probe() { curl -sS -m 20 -o /dev/null -w '%{http_code} %{redirect_url}' "$1" 2>&1; }

echo "Redirects and TLS"

r=$(probe "https://$APEX/?$NOCACHE")
[[ "$r" == "301 https://$WWW/?$NOCACHE" ]] \
  && ok "https://$APEX/ -> 301 -> https://$WWW/ (certificate valid)" \
  || fail "https://$APEX/ expected '301 https://$WWW/?$NOCACHE', got '$r'"

r=$(probe "https://$APEX/contact?$NOCACHE")
[[ "$r" == "301 https://$WWW/contact?$NOCACHE" ]] \
  && ok "https://$APEX/contact -> 301 with path and query preserved" \
  || fail "https://$APEX/contact expected path-preserving 301, got '$r'"

r=$(probe "http://$APEX/?$NOCACHE")
[[ "$r" == 301\ https://* ]] \
  && ok "http://$APEX/ -> 301 -> https" \
  || fail "http://$APEX/ expected 301 to https, got '$r'"

r=$(probe "https://$WWW/?$NOCACHE")
[[ "$r" == "200 " ]] \
  && ok "https://$WWW/ -> 200, no bounce back to the apex" \
  || fail "https://$WWW/ expected 200, got '$r'"

echo "Certificates (must have more than 14 days left)"
for host in "$APEX" "$WWW"; do
  end=$(echo | openssl s_client -servername "$host" -connect "$host:443" 2>/dev/null \
        | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [[ -z "$end" ]]; then
    fail "$host: could not read certificate"
    continue
  fi
  end_s=$(date -j -f '%b %e %T %Y %Z' "$end" +%s 2>/dev/null || date -d "$end" +%s 2>/dev/null)
  days=$(( (end_s - NOW) / 86400 ))
  (( days > 14 )) \
    && ok "$host certificate: $days days left (expires $end)" \
    || fail "$host certificate: only $days days left (expires $end)"
done

echo "Content"

# Flattened to one line: the page's <title> spans two lines in the source.
body=$(curl -sS -m 20 "https://$WWW/?$NOCACHE" 2>&1 | tr '\n' ' ')
grep -q '<title>[^<]*Kirsten Rossiter' <<<"$body" \
  && ok "homepage title names Kirsten Rossiter" \
  || fail "homepage title missing or wrong"
! grep -qi 'wp-content\|wp-includes\|xmlrpc' <<<"$body" \
  && ok "no WordPress markers on the homepage" \
  || fail "WordPress markers found on the homepage"
! grep -qi '<meta[^>]*name="robots"[^>]*noindex' <<<"$body" \
  && ok "homepage is indexable (no noindex)" \
  || fail "homepage carries noindex"

r=$(probe "https://$WWW/robots.txt?$NOCACHE")
robots=$(curl -sS -m 20 "https://$WWW/robots.txt?$NOCACHE" 2>&1)
[[ "$r" == "200 " ]] && grep -q "Sitemap: https://$WWW/sitemap.xml" <<<"$robots" \
  && ok "robots.txt 200 and names the sitemap" \
  || fail "robots.txt: got '$r', sitemap line $(grep -c Sitemap <<<"$robots")"

sitemap=$(curl -sS -m 20 "https://$WWW/sitemap.xml?$NOCACHE" 2>&1)
n=$(grep -c '<loc>' <<<"$sitemap")
(( n >= 10 )) \
  && ok "sitemap.xml has $n URLs" \
  || fail "sitemap.xml has $n URLs (expected at least 10)"

r=$(probe "https://$WWW/this-page-does-not-exist-$NOW")
[[ "$r" == "404 " ]] \
  && ok "unknown URL returns a real 404" \
  || fail "unknown URL returned '$r' (soft 404: every miss serves the homepage; see PR #26)"

echo "Mail records (Xneelo, by decision; INCIDENTS.md 2026-09-14)"
mx=$(dig +short "$APEX" MX | awk '{print $2}')
[[ "$mx" == "mail.$APEX." ]] \
  && ok "MX -> $mx" \
  || fail "MX expected mail.$APEX., got '$mx'"
mail_a=$(dig +short "mail.$APEX" A)
[[ "$mail_a" == "129.232.138.188" ]] \
  && ok "mail.$APEX -> $mail_a" \
  || fail "mail.$APEX expected 129.232.138.188, got '$mail_a'"
spf=$(dig +short "$APEX" TXT | grep spf1)
grep -q 'include:spf.host-h.net' <<<"$spf" \
  && ok "root SPF includes spf.host-h.net" \
  || fail "root SPF missing spf.host-h.net: '$spf'"
ns=$(dig +short "$APEX" NS | sort | tr '\n' ' ')
grep -q 'cloudflare' <<<"$ns" \
  && ok "nameservers on Cloudflare: $ns" \
  || fail "nameservers not on Cloudflare: '$ns'"

echo
echo "$PASS passed, $FAIL failed"
exit $(( FAIL > 0 ))
