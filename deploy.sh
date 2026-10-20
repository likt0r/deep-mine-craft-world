#!/usr/bin/env bash
# Bringt den Server auf den Stand von GitHub. Aufruf auf dem Laptop:  ./deploy.sh
# Fragt einmal nach dem sudo-Passwort auf dem Server.
set -euo pipefail

HOST="${1:-192.168.0.110}"
ssh -t "bewr@${HOST}" "cd ~/deep-mine-craft-world && git pull --ff-only && sudo ./install.sh ${HOST}"
