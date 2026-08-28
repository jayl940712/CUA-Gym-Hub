#!/usr/bin/env bash
# Deploy the WebArena mocks with nginx serving static files and Vite preview
# processes handling the state API, hardened sessions, and file uploads.
#
# Prerequisites: Node.js (npm), nginx, tmux
# Usage: ./deploy-webarena-nginx.sh [--skip-install] [--skip-build] [--no-attach]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBSITES_DIR="$SCRIPT_DIR/websites"
RUNTIME_DIR="$SCRIPT_DIR/.webarena-nginx"
NGINX_CONFIG="$RUNTIME_DIR/nginx.conf"

BASE_PORT="${BASE_PORT:-8000}"
BACKEND_BASE_PORT="${BACKEND_BASE_PORT:-18000}"
TMUX_SESSION="${TMUX_SESSION:-cua-gym-hub-nginx}"
SKIP_INSTALL=false
SKIP_BUILD=false
NO_ATTACH=false

usage() {
    cat <<'EOF'
Usage: ./deploy-webarena-nginx.sh [options]

Options:
  --skip-install  Skip npm install
  --skip-build    Use existing dist/ directories
  --no-attach     Start in the background without attaching to tmux
  -h, --help      Show this help

Environment:
  BASE_PORT          First public nginx port (default: 8000)
  BACKEND_BASE_PORT  First loopback Vite API port (default: 18000)
  TMUX_SESSION       tmux session name (default: cua-gym-hub-nginx)
EOF
}

for arg in "$@"; do
    case "$arg" in
        --skip-install) SKIP_INSTALL=true ;;
        --skip-build) SKIP_BUILD=true ;;
        --no-attach) NO_ATTACH=true ;;
        -h|--help) usage; exit 0 ;;
        *) echo "Error: unknown option: $arg" >&2; usage >&2; exit 2 ;;
    esac
done

[[ "$BASE_PORT" =~ ^[0-9]+$ ]] || { echo "Error: BASE_PORT must be an integer" >&2; exit 2; }
[[ "$BACKEND_BASE_PORT" =~ ^[0-9]+$ ]] || { echo "Error: BACKEND_BASE_PORT must be an integer" >&2; exit 2; }
BASE_PORT=$((10#$BASE_PORT))
BACKEND_BASE_PORT=$((10#$BACKEND_BASE_PORT))

[ -s "$HOME/.nvm/nvm.sh" ] && \. "$HOME/.nvm/nvm.sh"
command -v npm >/dev/null 2>&1 || { echo "Error: npm not found. Install Node.js first." >&2; exit 1; }
command -v nginx >/dev/null 2>&1 || { echo "Error: nginx not found. Run: apt install nginx" >&2; exit 1; }
command -v tmux >/dev/null 2>&1 || { echo "Error: tmux not found. Run: apt install tmux" >&2; exit 1; }
NPM_BIN="$(command -v npm)"
NGINX_BIN="$(command -v nginx)"

shopt -s nullglob
MOCK_DIRS=("$WEBSITES_DIR"/webarena*_mock)
shopt -u nullglob

MOCKS=()
for dir in "${MOCK_DIRS[@]}"; do
    MOCKS+=("$(basename "$dir")")
done
TOTAL=${#MOCKS[@]}

if [ "$TOTAL" -eq 0 ]; then
    echo "Error: no WebArena mock apps found under $WEBSITES_DIR" >&2
    exit 1
fi
if (( BASE_PORT < 1 || BACKEND_BASE_PORT < 1
      || BASE_PORT + TOTAL - 1 > 65535
      || BACKEND_BASE_PORT + TOTAL - 1 > 65535 )); then
    echo "Error: configured ports must be between 1 and 65535" >&2
    exit 2
fi
if (( BASE_PORT <= BACKEND_BASE_PORT + TOTAL - 1
      && BACKEND_BASE_PORT <= BASE_PORT + TOTAL - 1 )); then
    echo "Error: public and private port ranges overlap" >&2
    exit 2
fi

echo "Found $TOTAL mock apps"
echo "  Public nginx ports: $BASE_PORT-$((BASE_PORT + TOTAL - 1))"
echo "  Private API ports:  $BACKEND_BASE_PORT-$((BACKEND_BASE_PORT + TOTAL - 1))"

if [ "$SKIP_INSTALL" = false ]; then
    echo "Installing dependencies..."
    for MOCK in "${MOCKS[@]}"; do
        echo "  $MOCK"
        (cd "$WEBSITES_DIR/$MOCK" && npm install --silent)
    done
fi

if [ "$SKIP_BUILD" = false ]; then
    echo "Building all mocks in parallel..."
    BUILD_LOG_DIR="$(mktemp -d)"
    BUILD_PIDS=()
    for MOCK in "${MOCKS[@]}"; do
        (
            cd "$WEBSITES_DIR/$MOCK"
            npm run build --silent >"$BUILD_LOG_DIR/$MOCK.log" 2>&1
        ) &
        BUILD_PIDS+=("$!")
    done

    BUILD_FAILED=false
    for i in "${!BUILD_PIDS[@]}"; do
        if wait "${BUILD_PIDS[$i]}"; then
            echo "  [OK]  ${MOCKS[$i]}"
        else
            echo "  [ERR] ${MOCKS[$i]} (see $BUILD_LOG_DIR/${MOCKS[$i]}.log)" >&2
            BUILD_FAILED=true
        fi
    done
    if [ "$BUILD_FAILED" = true ]; then
        echo "Error: one or more builds failed; logs retained in $BUILD_LOG_DIR" >&2
        exit 1
    fi
    rm -rf -- "$BUILD_LOG_DIR"
else
    for MOCK in "${MOCKS[@]}"; do
        if [ ! -f "$WEBSITES_DIR/$MOCK/dist/index.html" ]; then
            echo "Error: $MOCK/dist/index.html is missing; run without --skip-build" >&2
            exit 1
        fi
    done
fi

mkdir -p "$RUNTIME_DIR/logs" "$RUNTIME_DIR/temp/client" "$RUNTIME_DIR/temp/proxy"

# Escape a filesystem path for an nginx double-quoted string.
nginx_path() {
    local value="$1"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    value="${value//\$/\\\$}"
    printf '%s' "$value"
}

RUNTIME_ESCAPED="$(nginx_path "$RUNTIME_DIR")"
cat >"$NGINX_CONFIG" <<EOF
worker_processes 4;
pid "$RUNTIME_ESCAPED/nginx.pid";
error_log "$RUNTIME_ESCAPED/logs/error.log" warn;

events {
    worker_connections 512;
}

http {
    types {
        text/html                             html htm;
        text/css                              css;
        text/plain                            txt;
        application/javascript                js mjs;
        application/json                      json map;
        application/pdf                       pdf;
        application/wasm                      wasm;
        image/avif                            avif;
        image/gif                             gif;
        image/jpeg                            jpeg jpg;
        image/png                             png;
        image/svg+xml                         svg svgz;
        image/webp                            webp;
        image/x-icon                          ico;
        audio/mpeg                            mp3;
        audio/ogg                             ogg;
        video/mp4                             mp4;
        video/webm                            webm;
        font/ttf                              ttf;
        font/otf                              otf;
        font/woff                             woff;
        font/woff2                            woff2;
    }
    default_type application/octet-stream;
    access_log "$RUNTIME_ESCAPED/logs/access.log";
    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    client_max_body_size 128m;
    client_body_temp_path "$RUNTIME_ESCAPED/temp/client";
    proxy_temp_path "$RUNTIME_ESCAPED/temp/proxy";

    gzip on;
    gzip_comp_level 4;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_vary on;
    gzip_types text/css text/plain application/javascript application/json application/wasm image/svg+xml;
EOF

for i in "${!MOCKS[@]}"; do
    MOCK="${MOCKS[$i]}"
    PUBLIC_PORT=$((BASE_PORT + i))
    BACKEND_PORT=$((BACKEND_BASE_PORT + i))
    DIST_ESCAPED="$(nginx_path "$WEBSITES_DIR/$MOCK/dist")"

    cat >>"$NGINX_CONFIG" <<EOF

    server {
        listen $PUBLIC_PORT;
        server_name _;
        root "$DIST_ESCAPED";
        index index.html;

        # Keep dynamic behavior in Node. This preserves SID-isolated state,
        # uploads/downloads, /go diffs, and optional hardened session cookies.
        location ~ ^/(?:post|state|go|upload|state-inspector|_cua_session|files(?:/.*)?)\$ {
            proxy_pass http://127.0.0.1:$BACKEND_PORT;
            proxy_http_version 1.1;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            proxy_set_header Connection "";
            proxy_request_buffering off;
            proxy_buffering off;
            proxy_read_timeout 300s;
            proxy_send_timeout 300s;
        }
EOF

    # The shopping mock emulates Magento's generated image-cache URLs. Its Vite
    # middleware rewrites these in preview mode, so reproduce that rule when
    # nginx owns static serving.
    if [ "$MOCK" = "webarena_shopping_mock" ]; then
        cat >>"$NGINX_CONFIG" <<'EOF'

        location ^~ /media/catalog/product/cache/ {
            rewrite ^/media/catalog/product/cache/[0-9a-f]+/(.*)$ /media/catalog/product/$1 last;
            try_files $uri =404;
        }

        location ^~ /media/ {
            try_files $uri =404;
            expires 30d;
            add_header Cache-Control "public";
        }
EOF
    fi

    cat >>"$NGINX_CONFIG" <<'EOF'

        location ^~ /assets/ {
            try_files $uri =404;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        location / {
            try_files $uri $uri/ /index.html;
        }
    }
EOF
done

cat >>"$NGINX_CONFIG" <<'EOF'
}
EOF

"$NGINX_BIN" -t -p "$RUNTIME_DIR/" -c "$NGINX_CONFIG"

if tmux has-session -t "$TMUX_SESSION" 2>/dev/null; then
    echo "Stopping existing tmux session: $TMUX_SESSION"
    tmux kill-session -t "$TMUX_SESSION"
fi
if [ -s "$RUNTIME_DIR/nginx.pid" ]; then
    OLD_NGINX_PID="$(<"$RUNTIME_DIR/nginx.pid")"
    if kill -0 "$OLD_NGINX_PID" 2>/dev/null; then
        echo "Stopping existing nginx master: $OLD_NGINX_PID"
        "$NGINX_BIN" -p "$RUNTIME_DIR/" -c "$NGINX_CONFIG" -s quit 2>/dev/null || true
        for _ in {1..50}; do
            kill -0 "$OLD_NGINX_PID" 2>/dev/null || break
            sleep 0.1
        done
    fi
    rm -f "$RUNTIME_DIR/nginx.pid"
fi

for i in "${!MOCKS[@]}"; do
    MOCK="${MOCKS[$i]}"
    BACKEND_PORT=$((BACKEND_BASE_PORT + i))
    printf -v BACKEND_COMMAND \
        'cd %q && exec %q run preview -- --host 127.0.0.1 --port %q --strictPort' \
        "$WEBSITES_DIR/$MOCK" "$NPM_BIN" "$BACKEND_PORT"

    if [ "$i" -eq 0 ]; then
        tmux new-session -d -s "$TMUX_SESSION" -n "${MOCK}-api" "$BACKEND_COMMAND"
    else
        tmux new-window -t "$TMUX_SESSION:" -n "${MOCK}-api" "$BACKEND_COMMAND"
    fi
done

# nginx is designed to daemonize and manage its own master/worker lifecycle.
# Starting it directly also avoids stale tmux PATH and shell-command parsing.
"$NGINX_BIN" -p "$RUNTIME_DIR/" -c "$NGINX_CONFIG"
tmux select-window -t "$TMUX_SESSION:0"

NGINX_READY=false
for _ in {1..50}; do
    if [ -s "$RUNTIME_DIR/nginx.pid" ]; then
        NGINX_PID="$(<"$RUNTIME_DIR/nginx.pid")"
        if kill -0 "$NGINX_PID" 2>/dev/null; then
            NGINX_READY=true
            break
        fi
    fi
    sleep 0.1
done
if [ "$NGINX_READY" = false ]; then
    echo "Error: nginx failed to start; inspect $RUNTIME_DIR/logs/error.log" >&2
    tmux kill-session -t "$TMUX_SESSION" 2>/dev/null || true
    exit 1
fi

SERVER_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
[ -z "$SERVER_IP" ] && SERVER_IP="<server-ip>"

echo
echo "=========================================="
echo "WebArena mocks started: $TMUX_SESSION"
echo "=========================================="
for i in "${!MOCKS[@]}"; do
    printf "  %-35s http://%s:%d\n" "${MOCKS[$i]}:" "$SERVER_IP" "$((BASE_PORT + i))"
done
echo
echo "nginx serves dist/; loopback Vite processes serve state and upload APIs."
echo "Generated config: $NGINX_CONFIG"
echo
echo "Manage session:"
echo "  Attach:   tmux attach -t $TMUX_SESSION"
echo "  Stop API: tmux kill-session -t $TMUX_SESSION"
echo "  Stop web: $NGINX_BIN -p '$RUNTIME_DIR/' -c '$NGINX_CONFIG' -s quit"

if [ "$NO_ATTACH" = false ]; then
    sleep 1
    exec tmux attach -t "$TMUX_SESSION"
fi
