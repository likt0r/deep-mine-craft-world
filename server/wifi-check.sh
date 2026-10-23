#!/usr/bin/env bash
# Rückfall aufs eigene WLAN (AP) und zurück. Läuft als root jede Minute (Timer deep-mine-wifi-check).
#
# NetworkManager nimmt beim Verbinden das beste sichtbare hinterlegte WLAN (dmc-wlan-*), sonst den AP
# (dmc-ap, niedrigste Priorität). Vom AP wechselt er aber nicht von selbst zurück, wenn ein hinterlegtes
# WLAN wieder auftaucht. Deshalb hier: Hängt niemand am AP, alle 5 Minuten den AP kurz herunternehmen.
set -euo pipefail

DEV="${WIFI_DEVICE:-wlp3s0}"
AP=dmc-ap
STAMP=/run/deep-mine-wifi-check.last
RETRY_SECONDS=300

active() {
  local name
  name=$(nmcli -g GENERAL.CONNECTION device show "$DEV" 2>/dev/null || true)
  [ "$name" = "--" ] && name=""
  echo "$name"
}

current=$(active)

# Nichts verbunden (z. B. WLAN weg und NetworkManager hat aufgegeben): eigenes WLAN auf.
if [ -z "$current" ]; then
  nmcli connection up "$AP" >/dev/null || true
  exit 0
fi

# Mit einem hinterlegten WLAN verbunden: alles gut.
[ "$current" = "$AP" ] || exit 0

# AP läuft. Zurückwechseln lohnt nur, wenn es hinterlegte WLANs gibt und niemand am AP hängt.
nmcli -t -f NAME connection show | grep -q '^dmc-wlan-' || exit 0
[ -z "$(iw dev "$DEV" station dump)" ] || exit 0

now=$(date +%s)
last=$(cat "$STAMP" 2>/dev/null || echo 0)
[ $((now - last)) -ge "$RETRY_SECONDS" ] || exit 0
echo "$now" > "$STAMP"

# AP herunter: NetworkManager verbindet sich mit einem sichtbaren hinterlegten WLAN.
# Nach einem manuellen „down“ startet er den AP aber nicht von selbst wieder, also notfalls hier.
nmcli connection down "$AP" >/dev/null || true
sleep 25
[ -n "$(active)" ] || nmcli connection up "$AP" >/dev/null || true
