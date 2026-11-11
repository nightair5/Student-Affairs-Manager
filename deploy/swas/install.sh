#!/usr/bin/env bash
# Build the site and, when run as root, install the loopback API service and Nginx site.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20 or newer is required." >&2
  exit 1
fi

major="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "$major" -lt 20 ]]; then
  echo "Node.js 20 or newer is required. Current: $(node -v)" >&2
  exit 1
fi

npm ci
npm run build

if [[ "$(id -u)" -ne 0 ]]; then
  cat <<EOF
Build finished: ${ROOT}/dist

Run as root on the server to install Nginx and systemd:
  sudo bash deploy/swas/install.sh
EOF
  exit 0
fi

if [[ ! -f /etc/student-affairs.env ]]; then
  sed "s#/opt/student-affairs#${ROOT}#g" deploy/swas/student-affairs.env.example > /etc/student-affairs.env
  chmod 600 /etc/student-affairs.env
  echo "Created /etc/student-affairs.env. Set DEEPSEEK_API_KEY on the server before expecting DeepSeek to connect."
else
  echo "Kept existing /etc/student-affairs.env."
fi

if ! id -u student-affairs >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin --user-group student-affairs
fi
chmod -R a+rX "${ROOT}/dist" "${ROOT}/server" "${ROOT}/cloudflare" "${ROOT}/node_modules" "${ROOT}/package.json"

node_bin=""
for candidate in ${SAM_NODE_BIN:-} /usr/local/bin/node /usr/bin/node "$(command -v node || true)"; do
  [[ -n "$candidate" && -x "$candidate" ]] || continue
  if su -s /bin/sh student-affairs -c "$(printf '%q' "$candidate") -e 'process.exit(Number(process.versions.node.split(\".\")[0])>=20?0:1)'" >/dev/null 2>&1; then
    node_bin="$candidate"
    break
  fi
done
if [[ -z "$node_bin" ]]; then
  echo "The student-affairs service user cannot execute Node.js 20 or newer. Install Node 20+ in /usr/local/bin or /usr/bin, or set SAM_NODE_BIN to a path that account can run." >&2
  exit 1
fi
sed -e "s#/opt/student-affairs#${ROOT}#g" -e "s#/usr/bin/node#${node_bin}#g" \
  deploy/swas/student-affairs-api.service > /etc/systemd/system/student-affairs-api.service
systemctl daemon-reload
systemctl enable student-affairs-api.service
systemctl restart student-affairs-api.service

if ! command -v nginx >/dev/null 2>&1; then
  echo "nginx is not installed. Install it, then re-run this script. Ubuntu: apt-get install -y nginx" >&2
  exit 1
fi

nginx_site="/etc/nginx/conf.d/student-affairs.conf"
if [[ -d /etc/nginx/sites-available ]]; then
  nginx_site="/etc/nginx/sites-available/student-affairs.conf"
fi
sed "s#/opt/student-affairs#${ROOT}#g" deploy/swas/nginx.conf > "$nginx_site"
mkdir -p /etc/nginx/snippets/student-affairs-extra
if [[ -d /etc/nginx/sites-enabled ]]; then
  ln -sfn "$nginx_site" /etc/nginx/sites-enabled/student-affairs.conf
  rm -f /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl enable nginx
systemctl reload-or-restart nginx
echo "Student Affairs is configured for HTTP on port 80. API listens on 127.0.0.1:8788."
