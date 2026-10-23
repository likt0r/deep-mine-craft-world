#!/usr/bin/env bash
# WLAN-Wächter. Läuft als root jede Minute (Timer deep-mine-wifi-check).
#
# WLAN eingeschaltet (Einstellung aus Deep Mine Control):
#   NetworkManager nimmt beim Verbinden das beste sichtbare hinterlegte WLAN (dmc-wlan-*), sonst das eigene
#   WLAN (dmc-ap, niedrigste Priorität). Vom eigenen WLAN wechselt er aber nicht von selbst zurück, wenn ein
#   hinterlegtes wieder auftaucht. Deshalb: Hängt niemand am eigenen WLAN, alle 5 Minuten kurz herunternehmen.
#
# WLAN ausgeschaltet:
#   Es bleibt aus, solange der Server über Kabel (oder etwas anderes als das WLAN) im Netz ist. Kommt 3 Minuten
#   lang keine Verbindung zustande, schaltet der Rettungsmodus das WLAN ein. Ist das Kabel zurück und hängt
#   niemand mehr am eigenen WLAN, geht es wieder aus.
#
# Alle Befehle und Pfade lassen sich für Tests umstellen (test/api/wifi-check.test.ts).
set -euo pipefail

DEV="${WIFI_DEVICE:-wlp3s0}"
NMCLI="${NMCLI:-nmcli}"
IW="${IW:-iw}"
IP="${IP:-ip}"
SETTINGS="${WIFI_SETTINGS:-/var/lib/bsm/deep-mine-control/wifi.json}"
RUN_DIR="${RUN_DIR:-/run}"
RESCUE_AFTER="${RESCUE_AFTER:-180}"
RETRY_SECONDS="${RETRY_SECONDS:-300}"
SETTLE_SECONDS="${SETTLE_SECONDS:-25}"

AP=dmc-ap
RESCUE="$RUN_DIR/deep-mine-wifi-rescue"
OFFLINE_SINCE="$RUN_DIR/deep-mine-wifi-offline-since"
RETRY_STAMP="$RUN_DIR/deep-mine-wifi-check.last"
now=$(date +%s)

active() {
  local name
  name=$("$NMCLI" -g GENERAL.CONNECTION device show "$DEV" 2>/dev/null || true)
  [ "$name" = "--" ] && name=""
  echo "$name"
}

radio_on() { [ "$("$NMCLI" -t radio wifi)" = "enabled" ]; }
stations() { "$IW" dev "$DEV" station dump 2>/dev/null | grep -c '^Station' || true; }
# Netz über etwas anderes als das WLAN (sonst zählte die WLAN-Verbindung aus dem Rettungsmodus selbst).
wired_network() { "$IP" -4 route show default | grep -v "dev $DEV" | grep -q .; }

wanted=on
grep -Eq '"enabled"[[:space:]]*:[[:space:]]*false' "$SETTINGS" 2>/dev/null && wanted=off

if [ "$wanted" = off ]; then
  if wired_network; then
    rm -f "$OFFLINE_SINCE"
    # Rettungsmodus vorbei, sobald niemand mehr am eigenen WLAN hängt.
    if [ -e "$RESCUE" ] && [ "$(active)" = "$AP" ] && [ "$(stations)" -gt 0 ]; then exit 0; fi
    rm -f "$RESCUE"
    if radio_on; then "$NMCLI" radio wifi off; fi
    exit 0
  fi
  if [ ! -e "$RESCUE" ]; then
    [ -e "$OFFLINE_SINCE" ] || echo "$now" > "$OFFLINE_SINCE"
    since=$(cat "$OFFLINE_SINCE")
    [ $((now - since)) -ge "$RESCUE_AFTER" ] || exit 0
    # 3 Minuten ohne Netz: Rettungsmodus. NetworkManager verbindet von selbst (hinterlegtes WLAN oder AP).
    touch "$RESCUE"
    "$NMCLI" radio wifi on
    exit 0
  fi
  # Rettungsmodus läuft: weiter wie bei eingeschaltetem WLAN.
else
  rm -f "$RESCUE" "$OFFLINE_SINCE"
  if ! radio_on; then
    "$NMCLI" radio wifi on
    exit 0
  fi
fi

current=$(active)

# Nichts verbunden (z. B. WLAN weg und NetworkManager hat aufgegeben): eigenes WLAN auf.
if [ -z "$current" ]; then
  "$NMCLI" connection up "$AP" >/dev/null || true
  exit 0
fi

# Mit einem hinterlegten WLAN verbunden: alles gut.
[ "$current" = "$AP" ] || exit 0

# Eigenes WLAN läuft. Zurückwechseln lohnt nur, wenn es hinterlegte WLANs gibt und niemand daran hängt.
"$NMCLI" -t -f NAME connection show | grep -q '^dmc-wlan-' || exit 0
[ "$(stations)" -eq 0 ] || exit 0

last=$(cat "$RETRY_STAMP" 2>/dev/null || echo 0)
[ $((now - last)) -ge "$RETRY_SECONDS" ] || exit 0
echo "$now" > "$RETRY_STAMP"

# Eigenes WLAN herunter: NetworkManager verbindet sich mit einem sichtbaren hinterlegten WLAN.
# Nach einem manuellen „down“ startet er den AP aber nicht von selbst wieder, also notfalls hier.
"$NMCLI" connection down "$AP" >/dev/null || true
sleep "$SETTLE_SECONDS"
[ -n "$(active)" ] || "$NMCLI" connection up "$AP" >/dev/null || true
