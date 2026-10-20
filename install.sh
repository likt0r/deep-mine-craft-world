#!/usr/bin/env bash
# Richtet BSM + Caddy auf einem frischen Ubuntu-Server ein.
# Aufruf auf dem Server:  sudo ./install.sh 192.168.0.110
set -euo pipefail

HOST_IP="${1:?Aufruf: sudo ./install.sh <IP-des-Servers>}"
BSM_VERSION="4.0.1"
HERE="$(cd "$(dirname "$0")" && pwd)"

[ "$(id -u)" -eq 0 ] || { echo "Bitte mit sudo ausführen." >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq python3-venv caddy curl

id bsm >/dev/null 2>&1 || useradd --system --shell /usr/sbin/nologin --home-dir /var/lib/bsm --create-home bsm
install -d -o bsm -g bsm /opt/bsm /var/lib/bsm/config /var/lib/bsm/data

sudo -u bsm python3 -m venv /opt/bsm/.venv
sudo -u bsm /opt/bsm/.venv/bin/pip install -q --upgrade pip
sudo -u bsm /opt/bsm/.venv/bin/pip install -q "bedrock-server-manager==${BSM_VERSION}"

install -m 644 "$HERE/server/bsm.service" /etc/systemd/system/bsm.service
sed "s/HOST_IP/${HOST_IP}/g" "$HERE/server/Caddyfile" > /etc/caddy/Caddyfile

systemctl daemon-reload
systemctl enable --now bsm
systemctl restart caddy

echo "Fertig: https://${HOST_IP} öffnen (Zertifikatswarnung bestätigen)."
