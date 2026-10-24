#!/usr/bin/env python3
"""Ethernet-Einstellungen für Deep Mine Control (System → Netzwerk). Läuft als root.

Deep Mine Control (Benutzer bsm) schreibt nur Anfragen in seinen Datenordner. Die systemd-Path-Unit
deep-mine-ethernet.path startet dann `deep-mine-ethernet run`:

- ethernet-request.json: neue Einstellung (DHCP oder feste IPv4). Wird hier noch einmal streng geprüft,
  als /etc/netplan/60-deep-mine-ethernet.yaml geschrieben (überlagert 00-installer-config.yaml; DHCP heißt:
  Datei weg) und mit `netplan apply` angewendet. Dann läuft ein Rücknahme-Timer.
- ethernet-confirm.json: Bestätigung unter der neuen Adresse. Stoppt den Timer.
- Ohne Bestätigung stellt `deep-mine-ethernet rollback` nach ROLLBACK_SECONDS die alte Datei wieder her.

Den Stand liest Deep Mine Control aus ethernet-state.json. Alles lässt sich für Tests umstellen
(test/api/ethernet-helper.test.ts).
"""

import ipaddress
import json
import os
import shutil
import subprocess
import sys
import time

DATA_DIR = os.environ.get("DATA_DIR", "/var/lib/bsm/deep-mine-control")
NETPLAN_DIR = os.environ.get("NETPLAN_DIR", "/etc/netplan")
DEVICE = os.environ.get("DEVICE", "enp1s0")
NETPLAN = os.environ.get("NETPLAN", "netplan")
SYSTEMD_RUN = os.environ.get("SYSTEMD_RUN", "systemd-run")
SYSTEMCTL = os.environ.get("SYSTEMCTL", "systemctl")
IP = os.environ.get("IP", "ip")
ROLLBACK_SECONDS = int(os.environ.get("ROLLBACK_SECONDS", "120"))
SELF = os.environ.get("SELF", "/usr/lib/deep-mine-control/bin/deep-mine-ethernet")

REQUEST = os.path.join(DATA_DIR, "ethernet-request.json")
CONFIRM = os.path.join(DATA_DIR, "ethernet-confirm.json")
STATE = os.path.join(DATA_DIR, "ethernet-state.json")
PREVIOUS = os.path.join(DATA_DIR, "ethernet-previous.yaml")
OURS = os.path.join(NETPLAN_DIR, "60-deep-mine-ethernet.yaml")
ROLLBACK_UNIT = "deep-mine-ethernet-rollback"


def write_state(state):
    tmp = STATE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.chmod(tmp, 0o644)
    os.replace(tmp, STATE)


def read_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def validate(request):
    """Gibt die geprüfte Einstellung zurück oder wirft ValueError."""
    if not isinstance(request, dict) or not isinstance(request.get("id"), str) or len(request["id"]) > 64:
        raise ValueError("Anfrage ohne gültige id")
    if request.get("mode") == "dhcp":
        return {"mode": "dhcp"}
    if request.get("mode") != "static":
        raise ValueError("mode muss dhcp oder static sein")
    prefix = request.get("prefix")
    if not isinstance(prefix, int) or not 8 <= prefix <= 30:
        raise ValueError("Präfix muss 8 bis 30 sein")
    interface = ipaddress.IPv4Interface(f"{request.get('address')}/{prefix}")
    gateway = ipaddress.IPv4Address(request.get("gateway"))
    if gateway not in interface.network or gateway == interface.ip:
        raise ValueError("Gateway liegt nicht im Netz der Adresse")
    if interface.ip in (interface.network.network_address, interface.network.broadcast_address):
        raise ValueError("Adresse ist Netz- oder Broadcast-Adresse")
    dns = request.get("dns", [])
    if not isinstance(dns, list) or len(dns) > 3:
        raise ValueError("Höchstens 3 DNS-Server")
    return {
        "mode": "static",
        "address": str(interface.ip),
        "prefix": prefix,
        "gateway": str(gateway),
        "dns": [str(ipaddress.IPv4Address(d)) for d in dns],
    }


def netplan_yaml(setting):
    """Nur geprüfte Werte, deshalb reicht Text statt YAML-Bibliothek."""
    dns = ", ".join(setting["dns"])
    lines = [
        "# Geschrieben von Deep Mine Control (System → Netzwerk). Löschen heißt: wieder DHCP aus 00-installer-config.yaml.",
        "network:",
        "  version: 2",
        "  ethernets:",
        f"    {DEVICE}:",
        "      dhcp4: false",
        f"      addresses: [{setting['address']}/{setting['prefix']}]",
        "      routes:",
        "        - to: default",
        f"          via: {setting['gateway']}",
    ]
    if setting["dns"]:
        lines += ["      nameservers:", f"        addresses: [{dns}]"]
    return "\n".join(lines) + "\n"


def run(*command):
    subprocess.run(command, check=True, capture_output=True, text=True)


def current_address():
    """IPv4-Adresse nach dem Anwenden (DHCP braucht einen Moment), sonst None."""
    for _ in range(10):
        try:
            out = subprocess.run([IP, "-j", "-4", "addr", "show", "dev", DEVICE], capture_output=True, text=True)
            for link in json.loads(out.stdout or "[]"):
                for info in link.get("addr_info", []):
                    if info.get("family") == "inet":
                        return info["local"]
        except (OSError, ValueError):
            pass
        time.sleep(1)
    return None


def put_back_previous():
    if os.path.exists(PREVIOUS):
        shutil.copyfile(PREVIOUS, OURS)
        os.chmod(OURS, 0o600)
    elif os.path.exists(OURS):
        os.remove(OURS)


def apply_request():
    request = read_json(REQUEST)
    os.remove(REQUEST)
    state = read_json(STATE) or {}
    if state.get("phase") == "pending":
        return  # Erst bestätigen oder zurücknehmen lassen.
    try:
        setting = validate(request)
    except (ValueError, TypeError) as error:
        write_state({"id": (request or {}).get("id"), "phase": "failed", "error": str(error)})
        return

    # Den jetzigen Stand für die Rücknahme merken.
    if os.path.exists(OURS):
        shutil.copyfile(OURS, PREVIOUS)
    elif os.path.exists(PREVIOUS):
        os.remove(PREVIOUS)

    if setting["mode"] == "dhcp":
        if os.path.exists(OURS):
            os.remove(OURS)
    else:
        with open(OURS + ".tmp", "w") as f:
            f.write(netplan_yaml(setting))
        os.chmod(OURS + ".tmp", 0o600)
        os.replace(OURS + ".tmp", OURS)

    try:
        run(NETPLAN, "generate")
    except subprocess.CalledProcessError as error:
        put_back_previous()
        write_state({"id": request["id"], "phase": "failed", "error": (error.stderr or "netplan generate").strip()})
        return

    subprocess.run([SYSTEMCTL, "stop", f"{ROLLBACK_UNIT}.timer"], capture_output=True)
    run(SYSTEMD_RUN, f"--unit={ROLLBACK_UNIT}", f"--on-active={ROLLBACK_SECONDS}", SELF, "rollback")
    write_state(
        {
            "id": request["id"],
            "phase": "pending",
            "deadline": int(time.time()) + ROLLBACK_SECONDS,
            "setting": setting,
        }
    )
    run(NETPLAN, "apply")
    state = read_json(STATE) or {}
    state["newAddress"] = current_address()
    write_state(state)


def confirm():
    request = read_json(CONFIRM) or {}
    os.remove(CONFIRM)
    state = read_json(STATE) or {}
    if state.get("phase") != "pending" or state.get("id") != request.get("id"):
        return
    subprocess.run([SYSTEMCTL, "stop", f"{ROLLBACK_UNIT}.timer"], capture_output=True)
    if os.path.exists(PREVIOUS):
        os.remove(PREVIOUS)
    state["phase"] = "confirmed"
    write_state(state)


def rollback():
    state = read_json(STATE) or {}
    if state.get("phase") != "pending":
        return
    put_back_previous()
    run(NETPLAN, "apply")
    state["phase"] = "rolled-back"
    write_state(state)


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "run"
    if command == "rollback":
        rollback()
    elif command == "run":
        if os.path.exists(CONFIRM):
            confirm()
        if os.path.exists(REQUEST):
            apply_request()
    else:
        sys.exit(f"Unbekannter Befehl: {command}")


if __name__ == "__main__":
    main()
