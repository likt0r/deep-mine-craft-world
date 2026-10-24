#!/usr/bin/env bash
# Baut das Paket dist/deep-mine-control_<Version>_amd64.deb und die Prüfsumme dazu (.deb.sha256).
#
#   packaging/build-deb.sh [--no-build] [VERSION]
#
# VERSION hat die Form X.Y.Z (auch als Umgebungsvariable, Standard 0.0.0 für Probe-Pakete), der Commit kommt aus git.
# Ohne --no-build wird die App vorher gebaut (`npm run build`, Abhängigkeiten vorher mit `npm ci` in control/).
# nfpm wird als festes Release geladen und per SHA-256 geprüft (build/tools/).
set -euo pipefail

NFPM_VERSION=2.47.0
NFPM_SHA256=0660ca602b2d2d2ae4781a06c692b3eeb9d437ffea05b831d76e41f4a3188783

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD=1
if [ "${1:-}" = --no-build ]; then BUILD=0; shift; fi
VERSION="${1:-${VERSION:-0.0.0}}"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "Version muss X.Y.Z sein: $VERSION" >&2; exit 1; }
COMMIT="$(git -C "$ROOT" rev-parse HEAD)"

if [ "$BUILD" = 1 ]; then (cd "$ROOT/control" && npm run build); fi
[ -f "$ROOT/control/.output/server/index.mjs" ] || { echo "Kein Build in control/.output" >&2; exit 1; }

# nfpm laden (einmal, dann aus build/tools)
NFPM="$ROOT/build/tools/nfpm-$NFPM_VERSION"
if [ ! -x "$NFPM" ]; then
  mkdir -p "$ROOT/build/tools"
  tmp="$(mktemp -d)"
  trap 'rm -rf "$tmp"' EXIT
  curl -fsSL -o "$tmp/nfpm.tar.gz" \
    "https://github.com/goreleaser/nfpm/releases/download/v$NFPM_VERSION/nfpm_${NFPM_VERSION}_Linux_x86_64.tar.gz"
  echo "$NFPM_SHA256  $tmp/nfpm.tar.gz" | sha256sum -c --quiet -
  tar -xzf "$tmp/nfpm.tar.gz" -C "$tmp" nfpm
  install -m 755 "$tmp/nfpm" "$NFPM"
fi

# App mit Versionsdatei bereitlegen
rm -rf "$ROOT/build/deb"
mkdir -p "$ROOT/build/deb" "$ROOT/dist"
cp -r "$ROOT/control/.output" "$ROOT/build/deb/app"
printf '{ "version": "%s", "commit": "%s" }\n' "$VERSION" "$COMMIT" > "$ROOT/build/deb/app/version.json"

DEB="deep-mine-control_${VERSION}_amd64.deb"
rm -f "$ROOT/dist/$DEB" "$ROOT/dist/$DEB.sha256"
(cd "$ROOT" && VERSION="$VERSION" "$NFPM" package -p deb -f packaging/nfpm.yaml -t "dist/$DEB")
(cd "$ROOT/dist" && sha256sum "$DEB" > "$DEB.sha256")
echo "Fertig: dist/$DEB"
