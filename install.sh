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

# --- WLAN, Teil 1: vor der Paketinstallation ---
# NetworkManager darf beim ersten Start nur das WLAN anfassen, Ethernet (SSH!) bleibt bei networkd.
install -d /etc/NetworkManager/conf.d
install -m 644 "$HERE/server/networkmanager-deep-mine.conf" /etc/NetworkManager/conf.d/90-deep-mine.conf
install -m 644 "$HERE/server/10-wlan-unmanaged.network" /etc/systemd/network/10-wlan-unmanaged.network
install -m 644 "$HERE/server/wlan-regdom.conf" /etc/modprobe.d/deep-mine-wlan.conf
networkctl reload

apt-get update -qq
apt-get install -y -qq python3-venv caddy curl nodejs npm smartmontools network-manager dnsmasq-base iw
# Das npm aus Ubuntu ist zu alt für unsere package-lock.json (npm 11).
[ "$(npm -v | cut -d. -f1)" -ge 11 ] || npm install -g -q npm@11
hash -r

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

# Deep Mine Control (bsm) darf den Rechner neu starten und ausschalten (Bereich System)
install -m 644 "$HERE/server/50-deep-mine-control.rules" /etc/polkit-1/rules.d/50-deep-mine-control.rules

# --- WLAN, Teil 2: eigenes WLAN (AP) als Rückfall ---
# Das Profil nur anlegen, wenn es fehlt: Name und Passwort aus Deep Mine Control bleiben erhalten.
iw reg set DE || true
systemctl enable --now NetworkManager
# Läuft NetworkManager schon, die Konfiguration oben neu einlesen (z. B. WireGuard dazugekommen).
nmcli general reload conf || true
if ! nmcli -t -f NAME connection show | grep -qx dmc-ap; then
  nmcli connection add type wifi ifname wlp3s0 con-name dmc-ap ssid MINECRAFT-World \
    802-11-wireless.mode ap 802-11-wireless.band bg ipv4.method shared \
    wifi-sec.key-mgmt wpa-psk wifi-sec.psk deep-mine-craft \
    connection.autoconnect yes connection.autoconnect-priority -100
fi
# Nur WPA2 (CCMP): sicherer als gemischt mit WPA1, und Konsolen kommen damit am besten klar.
nmcli connection modify dmc-ap wifi-sec.proto rsn wifi-sec.pairwise ccmp wifi-sec.group ccmp
install -m 755 "$HERE/server/wifi-check.sh" /usr/local/bin/deep-mine-wifi-check
install -m 644 "$HERE/server/deep-mine-wifi-check.service" /etc/systemd/system/deep-mine-wifi-check.service
install -m 644 "$HERE/server/deep-mine-wifi-check.timer" /etc/systemd/system/deep-mine-wifi-check.timer

# Ethernet-Einstellungen aus Deep Mine Control (System → Netzwerk): root-Helfer, ausgelöst über eine Path-Unit
install -m 755 "$HERE/server/ethernet.py" /usr/local/bin/deep-mine-ethernet
install -m 644 "$HERE/server/deep-mine-ethernet.path" /etc/systemd/system/deep-mine-ethernet.path
install -m 644 "$HERE/server/deep-mine-ethernet.service" /etc/systemd/system/deep-mine-ethernet.service

# Beim Herunterfahren oder Neustarten die aktive Welt sichern
install -m 644 "$HERE/server/deep-mine-backup-on-shutdown.service" /etc/systemd/system/deep-mine-backup-on-shutdown.service

# SMART-Werte der Systemplatte für den Bereich System (smartctl braucht root)
install -m 755 "$HERE/server/smart-status.sh" /usr/local/bin/deep-mine-smart-status
install -m 644 "$HERE/server/deep-mine-smart.service" /etc/systemd/system/deep-mine-smart.service
install -m 644 "$HERE/server/deep-mine-smart.timer" /etc/systemd/system/deep-mine-smart.timer

# --- Caddy ---
sed "s/HOST_IP/${HOST_IP}/g" "$HERE/server/Caddyfile" > /etc/caddy/Caddyfile

# Deep Mine Control schaltet „Vor jedem Start sichern“ (BSM-Plugin backup_on_start). Das darf nur ein BSM-Admin.
# Deep Mine Control selbst bietet weiterhin nur feste Aktionen an.
# BSM hält die Benutzer im Speicher: Ändert sich die Rolle, muss BSM danach neu starten (stoppt Minecraft kurz).
BSM_DB=/var/lib/bsm/config/bedrock-server-manager.db
ROLE_CHANGED=0
if [ -f "$BSM_DB" ]; then
  ROLE_CHANGED=$(sudo -u bsm /opt/bsm/.venv/bin/python - "$BSM_DB" <<'PY'
import sqlite3, sys
db = sqlite3.connect(sys.argv[1])
changed = db.execute("update users set role = 'admin' where username = 'deep-mine-control' and role != 'admin'").rowcount
db.commit()
print(1 if changed else 0)
PY
)
fi

systemctl daemon-reload
systemctl enable --now bsm
[ "$ROLE_CHANGED" = 1 ] && systemctl restart bsm
systemctl enable deep-mine-control
systemctl enable --now deep-mine-smart.timer
systemctl enable --now deep-mine-wifi-check.timer
systemctl enable --now deep-mine-ethernet.path
systemctl enable deep-mine-backup-on-shutdown.service
# Nur starten (ExecStart tut nichts), nicht neu starten: ein Stopp würde sonst schon jetzt sichern.
systemctl start deep-mine-backup-on-shutdown.service
systemctl start deep-mine-smart.service
systemctl restart deep-mine-control
systemctl restart caddy

echo "Fertig: http://${HOST_IP} ist Deep Mine Control, https://${HOST_IP} ist BSM (Zertifikatswarnung bestätigen)."
