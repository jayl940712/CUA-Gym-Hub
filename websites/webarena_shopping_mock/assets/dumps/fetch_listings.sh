#!/bin/bash
BASE=http://10.186.197.203:7770
while IFS= read -r u; do
  [ -z "$u" ] && continue
  slug=$(echo "$u" | sed 's|[^A-Za-z0-9]|_|g' | cut -c1-90)
  out="/tmp/recon/shopping/listings/$slug.html"
  [ -s "$out" ] && continue
  curl -s --noproxy '*' --max-time 60 -b /tmp/recon/shopping/cookies.txt -c /tmp/recon/shopping/cookies.txt "$BASE$u" -o "$out"
  echo "$(printf '%6d' $(stat -c%s "$out"))  $u"
done
