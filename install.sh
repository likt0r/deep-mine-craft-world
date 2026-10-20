#!/usr/bin/env bash
# Richtet BSM, Deep Mine Control und Caddy auf einem Ubuntu-Server ein. Mehrfach ausführbar (auch für Updates).
# Aufruf auf dem Server:  sudo ./install.sh 192.168.0.110
set -euo pipefail

HOST_IP="${1:?Aufruf: sudo ./install.sh <IP-des-Servers>}"
BSM_VERSION="4.0.1"
HERE="$(cd "$(dirname "$0")" && pwd)"
# Deep Mine Control wird als aufrufender Benutzer gebaut, damit im Repo keine root-Dateien entstehen.
BUILD_USER="${SUDO_USER:-root}"

[ "$(id -u)" -eq 0 ] || { echo "Bitte mit sudo ausführen." >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3-venv caddy curl nodejs npm

# --- BSM ---
id bsm >/dev/null 2>&1 || useradd --system --shell /usr/sbin/nologin --home-dir /var/lib/bsm --create-home bsm
install -d -o bsm -g bsm /opt/bsm /var/lib/bsm/config /var/lib/bsm/data

sudo -u bsm python3 -m venv /opt/bsm/.venv
sudo -u bsm /opt/bsm/.venv/bin/pip install -q --upgrade pip
sudo -u bsm /opt/bsm/.venv/bin/pip install -q "bedrock-server-manager==${BSM_VERSION}"

install -m 644 "$HERE/server/bsm.service" /etc/systemd/system/bsm.service

# --- Deep Mine Control ---
(cd "$HERE/control" && sudo -u "$BUILD_USER" npm ci --no-audit --no-fund && sudo -u "$BUILD_USER" npm run build)
rm -rf /opt/deep-mine-control
cp -r "$HERE/control/.output" /opt/deep-mine-control
install -d -o bsm -g bsm /var/lib/bsm/deep-mine-control
if [ ! -f /etc/deep-mine-control.env ]; then
  install -m 600 /dev/null /etc/deep-mine-control.env
  echo "NUXT_BSM_PASSWORD=" > /etc/deep-mine-control.env
  echo "Hinweis: Passwort des BSM-Kontos deep-mine-control in /etc/deep-mine-control.env eintragen (siehe README)."
fi
install -m 644 "$HERE/server/deep-mine-control.service" /etc/systemd/system/deep-mine-control.service

# --- Caddy ---
sed "s/HOST_IP/${HOST_IP}/g" "$HERE/server/Caddyfile" > /etc/caddy/Caddyfile

systemctl daemon-reload
systemctl enable --now bsm
systemctl enable deep-mine-control
systemctl restart deep-mine-control
systemctl restart caddy

echo "Fertig: http://${HOST_IP} ist Deep Mine Control, https://${HOST_IP} ist BSM (Zertifikatswarnung bestätigen)."
