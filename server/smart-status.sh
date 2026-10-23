#!/usr/bin/env bash
# Schreibt die SMART-Werte der Systemplatte als JSON für den Bereich System von Deep Mine Control.
# Läuft als root (smartctl braucht das), aufgerufen vom Timer deep-mine-smart.
set -euo pipefail

OUT="${1:-/var/lib/bsm/deep-mine-control/smart.json}"

# Die Platte unter / finden, auch wenn / auf LVM oder einer Partition liegt.
disk=$(lsblk -nsro NAME,TYPE "$(findmnt -no SOURCE /)" | awk '$2 == "disk" { print $1; exit }')
[ -n "$disk" ] || { echo "Systemplatte nicht gefunden" >&2; exit 1; }

# smartctl meldet Hinweise über Bits im Exit-Code, das JSON ist trotzdem gültig.
smartctl --json -x "/dev/$disk" > "$OUT.tmp" || true
chmod 644 "$OUT.tmp"
mv "$OUT.tmp" "$OUT"
