#!/usr/bin/env bash
# Ersteinrichtung eines Ubuntu-Servers: lädt das neueste Paket deep-mine-control von GitHub, prüft die
# SHA-256-Prüfsumme und installiert es mit apt. Alles Weitere (BSM, Dienste, WLAN, Caddy) macht das Paket.
# Aufruf auf dem Server:
#   curl -fsSLO https://raw.githubusercontent.com/likt0r/deep-mine-craft-world/main/install.sh && sudo bash install.sh
set -euo pipefail

REPO=likt0r/deep-mine-craft-world

[ "$(id -u)" -eq 0 ] || { echo "Bitte mit sudo ausführen." >&2; exit 1; }
export DEBIAN_FRONTEND=noninteractive

apt-get update -qq
apt-get install -y -qq curl ca-certificates python3

# Adressen von Paket und Prüfsumme aus dem neuesten Release
release="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest")"
read -r deb_url sha_url < <(python3 -c '
import json, sys
assets = {a["name"]: a["browser_download_url"] for a in json.load(sys.stdin)["assets"]}
deb = next(n for n in assets if n.startswith("deep-mine-control_") and n.endswith("_amd64.deb"))
print(assets[deb], assets[deb + ".sha256"])
' <<<"$release") || { echo "Im neuesten Release fehlt das Paket oder seine Prüfsumme." >&2; exit 1; }

dir="$(mktemp -d)"
trap 'rm -rf "$dir"' EXIT
deb="$dir/$(basename "$deb_url")"
curl -fsSL -o "$deb" "$deb_url"
expected="$(curl -fsSL "$sha_url" | cut -d' ' -f1)"
echo "$expected  $deb" | sha256sum -c --quiet - || { echo "Prüfsumme stimmt nicht, Abbruch." >&2; exit 1; }

# apt liest das Paket als Benutzer _apt
chmod 755 "$dir"
chmod 644 "$deb"
apt-get install -y "$deb"

ip="$(hostname -I | cut -d' ' -f1)"
echo "Fertig: http://$ip ist Deep Mine Control, https://$ip ist BSM (Zertifikatswarnung bestätigen)."
