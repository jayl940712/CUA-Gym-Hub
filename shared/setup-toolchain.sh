#!/usr/bin/env bash
# Rebuild the WebArena migration toolchain: node, chromium system libs, playwright.
#
# This host has no system node, no playwright, and no chromium system libraries,
# and `sudo -n` is denied. Everything lives under /tmp and is therefore VOLATILE —
# if /tmp is cleared, every agent loses node, python, and the browser at once.
#
# Idempotent: each stage is skipped if already satisfied. Safe to run every round.
# Usage:  bash shared/setup-toolchain.sh [--check]
#   --check   report status and exit non-zero if anything is missing; build nothing
#
# Procedure recovered from the round-1 recon agent, which built this rig by hand
# (~90s). Recorded here so a fresh site migration does not rediscover it.

set -uo pipefail

NODE_DIR=/tmp/node-v20.18.1-linux-x64
SYSROOT=/tmp/sysroot
DEBS=/tmp/debs
PWVENV=/tmp/pwvenv
LDP="$SYSROOT/usr/lib/x86_64-linux-gnu:$SYSROOT/lib/x86_64-linux-gnu"

CHECK_ONLY=0
[ "${1:-}" = "--check" ] && CHECK_ONLY=1

ok=0
say()  { printf '  %s\n' "$*"; }
fail() { printf '  MISSING: %s\n' "$*"; ok=1; }

# ---------------------------------------------------------------- status
printf '=== toolchain status ===\n'
[ -x "$NODE_DIR/bin/node" ] && say "node    OK  ($("$NODE_DIR/bin/node" -v 2>/dev/null))" || fail "node at $NODE_DIR"
[ -x "$PWVENV/bin/python" ] && say "python  OK  ($PWVENV)"                                 || fail "venv at $PWVENV"
[ -f "$SYSROOT/usr/lib/x86_64-linux-gnu/libatk-1.0.so.0" ] \
  && say "sysroot OK  ($(find "$SYSROOT" -name '*.so*' 2>/dev/null | wc -l) .so files)"    || fail "sysroot at $SYSROOT"

CHROME=$(find "$HOME/.cache/ms-playwright" -maxdepth 3 -name chrome-headless-shell -type f 2>/dev/null | head -1)
[ -n "$CHROME" ] && say "chromium OK ($(basename "$(dirname "$(dirname "$CHROME")")"))"    || fail "chromium in ~/.cache/ms-playwright"

if [ -n "$CHROME" ]; then
  n=$(LD_LIBRARY_PATH="$LDP" ldd "$CHROME" 2>/dev/null | grep -c 'not found')
  [ "$n" -eq 0 ] && say "libs    OK  (0 unresolved with LD_LIBRARY_PATH)" || fail "$n unresolved libs even with sysroot"
fi

if [ "$CHECK_ONLY" = 1 ]; then
  [ "$ok" = 0 ] && printf '\nAll present. Export before use:\n  export PATH="%s/bin:$PATH"\n  export LD_LIBRARY_PATH=%s\n' "$NODE_DIR" "$LDP"
  exit "$ok"
fi
[ "$ok" = 0 ] && { printf '\nNothing to do.\n'; exit 0; }

# ---------------------------------------------------------------- build
printf '\n=== rebuilding what is missing ===\n'

# 1. node — from the tarball if it is still around, else fetch
if [ ! -x "$NODE_DIR/bin/node" ]; then
  say "installing node..."
  if [ -f /tmp/node.tar.xz ]; then
    tar -xJf /tmp/node.tar.xz -C /tmp
  else
    curl -fsSL -o /tmp/node.tar.xz \
      https://nodejs.org/dist/v20.18.1/node-v20.18.1-linux-x64.tar.xz && tar -xJf /tmp/node.tar.xz -C /tmp
  fi
fi
export PATH="$NODE_DIR/bin:$PATH"

# 2. playwright venv + chromium download
if [ ! -x "$PWVENV/bin/python" ]; then
  say "creating venv + installing playwright..."
  python3 -m venv "$PWVENV" && "$PWVENV/bin/pip" install -q playwright
fi
[ -z "$CHROME" ] && { say "downloading chromium..."; "$PWVENV/bin/playwright" install chromium; }

# 3. system libraries — apt-get download the recursive closure, unpack into a sysroot.
#    sudo is denied, so nothing is installed system-wide; we extract and point
#    LD_LIBRARY_PATH at the result.
if [ ! -f "$SYSROOT/usr/lib/x86_64-linux-gnu/libatk-1.0.so.0" ]; then
  say "building sysroot (~90s, ~120 .deb packages)..."
  mkdir -p "$DEBS" "$SYSROOT" && cd "$DEBS" || exit 1
  PKGS=$(apt-cache depends --recurse --no-recommends --no-suggests --no-conflicts \
           --no-breaks --no-replaces --no-enhances \
           libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libcups2t64 \
           libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
           libgbm1 libpango-1.0-0 libcairo2 libasound2t64 libnss3 libnspr4 \
           2>/dev/null | grep '^\w' | sort -u)
  apt-get download $PKGS 2>/dev/null
  for d in *.deb; do dpkg-deb -x "$d" "$SYSROOT" 2>/dev/null; done
  say "extracted $(find "$SYSROOT" -name '*.so*' | wc -l) .so files from $(ls *.deb 2>/dev/null | wc -l) packages"
fi

# ---------------------------------------------------------------- verify
printf '\n=== verifying ===\n'
LD_LIBRARY_PATH="$LDP" "$PWVENV/bin/python" - <<'PY'
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page()
    pg.set_content("<title>toolchain ok</title>")
    print("  browser launches:", pg.title()); b.close()
PY
rc=$?
printf '\nExport these before use:\n  export PATH="%s/bin:$PATH"\n  export LD_LIBRARY_PATH=%s\n' "$NODE_DIR" "$LDP"
exit $rc
