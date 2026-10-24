#!/usr/bin/env bash
# Prüft Inhalt und Abhängigkeiten eines gebauten Pakets (packaging/build-deb.sh).
#
#   packaging/check-deb.sh dist/deep-mine-control_X.Y.Z_amd64.deb
#
# Braucht dpkg-deb (Ubuntu/Debian, auf Fedora im Paket dpkg).
set -euo pipefail

DEB="${1:?Aufruf: packaging/check-deb.sh <Paket.deb>}"
ERRORS=0
fail() { echo "FEHLER: $*" >&2; ERRORS=$((ERRORS + 1)); }

# Dateiliste als „Rechte Pfad“, Pfade ohne führendes „.“
LIST="$(dpkg-deb -c "$DEB" | awk '{ sub(/^\./, "", $6); print $1, $6 }')"

has() { grep -q " $1\$" <<<"$LIST" || fail "Datei fehlt: $1"; }
executable() { grep -q "^-rwxr-xr-x $1\$" <<<"$LIST" || fail "nicht ausführbar (755): $1"; }

APP=/usr/lib/deep-mine-control/app
has "$APP/version.json"
has "$APP/server/index.mjs"
has "$APP/nitro.json"
grep -q " $APP/public/_nuxt/" <<<"$LIST" || fail "Seiten fehlen: $APP/public/_nuxt/"

for helper in deep-mine-ethernet deep-mine-wifi-check deep-mine-smart-status; do
  executable "/usr/lib/deep-mine-control/bin/$helper"
done

for unit in bsm.service deep-mine-control.service deep-mine-backup-on-shutdown.service deep-mine-ethernet.path \
  deep-mine-ethernet.service deep-mine-smart.service deep-mine-smart.timer deep-mine-wifi-check.service \
  deep-mine-wifi-check.timer deep-mine-update-check.service deep-mine-update-check.timer \
  caddy.service.d/deep-mine-control.conf; do
  has "/usr/lib/systemd/system/$unit"
done

has /usr/lib/deep-mine-control/Caddyfile
has /usr/share/polkit-1/rules.d/50-deep-mine-control.rules
has /usr/lib/NetworkManager/conf.d/90-deep-mine.conf
has /usr/lib/systemd/network/10-wlan-unmanaged.network
has /usr/lib/modprobe.d/deep-mine-wlan.conf

# Nichts unter /etc (keine conffiles), nichts mehr an den alten Orten von install.sh
grep -Eq " /(etc|opt|usr/local)/" <<<"$LIST" && fail "Dateien unter /etc, /opt oder /usr/local"

# Steuerdaten
[ "$(dpkg-deb -f "$DEB" Package)" = deep-mine-control ] || fail "Package ist nicht deep-mine-control"
[ "$(dpkg-deb -f "$DEB" Architecture)" = amd64 ] || fail "Architecture ist nicht amd64"
DEPENDS="$(dpkg-deb -f "$DEB" Depends | tr ',' '\n' | sed 's/^ *//')"
for dep in "nodejs (>= 22)" caddy python3 python3-venv curl smartmontools network-manager dnsmasq-base iw; do
  grep -qxF "$dep" <<<"$DEPENDS" || fail "Abhängigkeit fehlt: $dep"
done

# Maintainer-Skripte
CONTROL="$(mktemp -d)"
trap 'rm -rf "$CONTROL"' EXIT
dpkg-deb -e "$DEB" "$CONTROL"
for script in postinst prerm postrm; do
  [ -x "$CONTROL/$script" ] || fail "Maintainer-Skript fehlt: $script"
done

# Versionsdatei passt zur Paketversion
VERSION="$(dpkg-deb -f "$DEB" Version)"
dpkg-deb --fsys-tarfile "$DEB" | tar -xO ".$APP/version.json" |
  python3 -c 'import json, sys; v = json.load(sys.stdin); sys.exit(not (v["version"] == sys.argv[1] and len(v["commit"]) == 40))' "$VERSION" ||
  fail "version.json passt nicht zu Version $VERSION"

[ "$ERRORS" = 0 ] || { echo "$ERRORS Fehler in $DEB" >&2; exit 1; }
echo "Paket in Ordnung: $DEB ($VERSION)"
