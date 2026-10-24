#!/usr/bin/env python3
"""Update von Deep Mine Control (System → Updates). Läuft als root.

Deep Mine Control (Benutzer bsm) schreibt nur update-request.json `{id, version}` in seinen Datenordner. Die
systemd-Path-Unit deep-mine-update.path startet dann `deep-mine-update run`. Das prüft die Form der Anfrage und
startet die eigentliche Arbeit (`deep-mine-update work <id> <version>`) als eigene transiente Unit
deep-mine-update-run. apt startet beim Installieren Dienste neu; diese Unit gehört nicht dazu und läuft weiter.

Die Arbeit, Stand jeweils in update-state.json (`phase`):
- downloading: Die Version muss laut GitHub-API die neueste sein und neuer als die installierte (kein Downgrade).
  Paket und Prüfsumme kommen nur von DOWNLOAD_PREFIX, das Paket wird per SHA-256 geprüft. Für den Rückfall muss
  das Paket der installierten Version im Cache liegen. Fehlt es (das erste Update), kommt es vom Release dieser
  Version. Gibt es das nicht, wird nicht aktualisiert. Im Cache bleiben nur das neue und das vorige Paket.
- installing: apt-get installiert, die Ausgabe steht in update.log.
- verifying: Bis zu VERIFY_SECONDS warten, bis der Status von Deep Mine Control die neue Version meldet.
- done; sonst rolled-back (das vorige Paket ist wieder installiert) oder failed, `error` nennt den Grund.

Alles lässt sich für Tests umstellen (test/api/update-helper.test.ts).
"""

import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

DATA_DIR = os.environ.get("DATA_DIR", "/var/lib/bsm/deep-mine-control")
CACHE_DIR = os.environ.get("CACHE_DIR", "/var/cache/deep-mine-control")
# Fest eingetragen: neuestes Release des Repos und die Download-Adresse seiner Anhänge
GITHUB_API = os.environ.get("GITHUB_API", "https://api.github.com/repos/likt0r/deep-mine-craft-world/releases/latest")
DOWNLOAD_PREFIX = os.environ.get(
    "DOWNLOAD_PREFIX", "https://github.com/likt0r/deep-mine-craft-world/releases/download/"
)
APT_GET = os.environ.get("APT_GET", "apt-get")
SYSTEMD_RUN = os.environ.get("SYSTEMD_RUN", "systemd-run")
SYSTEMCTL = os.environ.get("SYSTEMCTL", "systemctl")
STATUS_URL = os.environ.get("STATUS_URL", "http://127.0.0.1:3000/api/status")
VERSION_FILE = os.environ.get("VERSION_FILE", "/usr/lib/deep-mine-control/app/version.json")
VERIFY_SECONDS = float(os.environ.get("VERIFY_SECONDS", "60"))
POLL_SECONDS = float(os.environ.get("POLL_SECONDS", "2"))
SELF = os.environ.get("SELF", "/usr/lib/deep-mine-control/bin/deep-mine-update")

REQUEST = os.path.join(DATA_DIR, "update-request.json")
STATE = os.path.join(DATA_DIR, "update-state.json")
LOG = os.path.join(DATA_DIR, "update.log")
RUN_UNIT = "deep-mine-update-run"
VERSION = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+")
ID = re.compile(r"[A-Za-z0-9-]{1,64}")
SHA256 = re.compile(r"[0-9a-f]{64}")

log_file = None


class UpdateError(Exception):
    """Ein Grund, der so in update-state.json steht."""


def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def create(path):
    """Neue Datei 0644 im Datenordner. Der gehört bsm: keinem Link folgen, der dort liegt."""
    try:
        os.unlink(path)
    except FileNotFoundError:
        pass
    return os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o644), "w")


def write_state(state):
    with create(STATE + ".tmp") as f:
        json.dump(state, f)
    os.replace(STATE + ".tmp", STATE)


def read_json(path):
    try:
        with open(path) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def log(text):
    if log_file:
        log_file.write(f"{text}\n")
        log_file.flush()


def parse(version):
    return tuple(int(part) for part in version.split("."))


def installed_version():
    """Installierte Version aus der Versionsdatei, `None` ohne Paket („dev“) oder ohne Datei."""
    version = (read_json(VERSION_FILE) or {}).get("version")
    return version if isinstance(version, str) and VERSION.fullmatch(version) else None


def package(version):
    return f"deep-mine-control_{version}_amd64.deb"


class HttpsOnly(urllib.request.HTTPRedirectHandler):
    """GitHub leitet Downloads weiter, aber nie von HTTPS weg."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if req.full_url.startswith("https://") and not newurl.startswith("https://"):
            raise UpdateError(f"Weiterleitung ohne HTTPS abgelehnt: {newurl}")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


opener = urllib.request.build_opener(HttpsOnly)


def fetch(url, timeout, accept="*/*"):
    request = urllib.request.Request(url, headers={"User-Agent": "deep-mine-update", "Accept": accept})
    try:
        return opener.open(request, timeout=timeout)
    except (urllib.error.URLError, OSError) as error:
        raise UpdateError(f"Laden von {url} fehlgeschlagen: {error}") from error


def check_release(version, installed):
    """Die Version muss das neueste Release mit Paket sein und neuer als die installierte."""
    with fetch(GITHUB_API, 30, "application/vnd.github+json") as response:
        release = json.load(response)
    latest = release.get("tag_name")
    if latest != f"v{version}":
        raise UpdateError(f"Version {version} ist nicht die neueste (neueste: {latest}).")
    if installed and parse(version) <= parse(installed):
        raise UpdateError(f"Version {version} ist nicht neuer als die installierte ({installed}).")
    urls = {a.get("name"): a.get("browser_download_url") for a in release.get("assets", [])}
    for name in (package(version), package(version) + ".sha256"):
        if name not in urls:
            raise UpdateError(f"Am Release v{version} fehlt {name}.")
        if urls[name] != f"{DOWNLOAD_PREFIX}v{version}/{name}":
            raise UpdateError(f"Download-Adresse nicht erlaubt: {urls[name]}")


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 16), b""):
            digest.update(chunk)
    return digest.hexdigest()


def download(version):
    """Lädt das Paket von der Release-Adresse in den Cache und prüft es. Liegt es schon dort, reicht die Prüfung."""
    name = package(version)
    base = f"{DOWNLOAD_PREFIX}v{version}/"
    with fetch(base + name + ".sha256", 30) as response:
        words = response.read(4096).decode("utf-8", "replace").split()
    expected = words[0].lower() if words else ""
    if not SHA256.fullmatch(expected):
        raise UpdateError(f"Prüfsummendatei von {name} ist unlesbar.")

    target = os.path.join(CACHE_DIR, name)
    if os.path.exists(target) and sha256(target) == expected:
        log(f"{name} liegt schon im Cache.")
        return target
    log(f"Lade {base}{name}")
    part = target + ".part"
    digest = hashlib.sha256()
    with fetch(base + name, 600) as response, open(part, "wb") as f:
        for chunk in iter(lambda: response.read(1 << 16), b""):
            digest.update(chunk)
            f.write(chunk)
    if digest.hexdigest() != expected:
        os.remove(part)
        raise UpdateError(f"Prüfsumme von {name} stimmt nicht.")
    os.chmod(part, 0o644)
    os.replace(part, target)
    return target


def previous_package(installed):
    """Paket der installierten Version für den Rückfall: aus dem Cache, beim ersten Update vom Release."""
    if not installed:
        raise UpdateError("Installierte Version unbekannt: Ohne voriges Paket gibt es keinen Rückfall.")
    target = os.path.join(CACHE_DIR, package(installed))
    if os.path.exists(target):
        return target
    try:
        return download(installed)
    except (UpdateError, OSError) as error:
        raise UpdateError(
            f"Kein Paket der installierten Version {installed} für den Rückfall ({error}) "
            "Ohne Rückfall wird nicht aktualisiert."
        ) from error


def keep_only(paths):
    for name in os.listdir(CACHE_DIR):
        path = os.path.join(CACHE_DIR, name)
        if path not in paths:
            os.remove(path)


def install(path, downgrade=False):
    command = [APT_GET, "install", "-y", "-o", "DPkg::Lock::Timeout=300"]
    if downgrade:
        command.append("--allow-downgrades")
    command.append(path)
    log(f"$ {' '.join(command)}")
    try:
        result = subprocess.run(
            command,
            stdin=subprocess.DEVNULL,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            # needrestart soll keine Dienste neu starten, schon gar nicht diese Unit.
            env={**os.environ, "DEBIAN_FRONTEND": "noninteractive", "NEEDRESTART_SUSPEND": "1"},
        )
    except OSError as error:
        log(str(error))
        return False
    return result.returncode == 0


def status_version():
    """Version laut Status. Auch die 503-Antwort (BSM antwortet nicht) nennt sie in `data`."""
    try:
        with urllib.request.urlopen(STATUS_URL, timeout=5) as response:
            body = json.load(response)
    except urllib.error.HTTPError as error:
        try:
            body = json.load(error)
        except ValueError:
            return None
    except (OSError, ValueError):
        return None
    if not isinstance(body, dict):
        return None
    return body.get("version") or (body.get("data") or {}).get("version")


def answers_with(version):
    deadline = time.monotonic() + VERIFY_SECONDS
    while True:
        if status_version() == version:
            return True
        if time.monotonic() >= deadline:
            return False
        time.sleep(POLL_SECONDS)


def work(request_id, version):
    global log_file
    state = {"id": request_id, "version": version, "phase": "downloading", "error": None,
             "startedAt": now(), "finishedAt": None}

    def phase(name, error=None):
        state["phase"] = name
        if name in ("done", "failed", "rolled-back"):
            state["error"] = error
            state["finishedAt"] = now()
            log(f"Ende: {name}" + (f" – {error}" if error else ""))
        write_state(state)

    write_state(state)
    log_file = create(LOG)
    log(f"{state['startedAt']} Update auf {version}")
    installed = installed_version()
    try:
        if not VERSION.fullmatch(version):
            raise UpdateError(f"Ungültige Version: {version}")
        os.makedirs(CACHE_DIR, mode=0o755, exist_ok=True)
        check_release(version, installed)
        new = download(version)
        previous = previous_package(installed)
        keep_only({new, previous})
    except UpdateError as error:
        return phase("failed", str(error))
    except Exception as error:  # noqa: BLE001 – jeder Fehler soll in der Oberfläche stehen
        return phase("failed", f"Unerwarteter Fehler: {error}")

    phase("installing")
    if install(new):
        phase("verifying")
        if answers_with(version):
            return phase("done")
        reason = f"Version {version} hat sich nach {VERIFY_SECONDS:g} s nicht gemeldet."
    else:
        reason = f"Installieren von {version} ist fehlgeschlagen (siehe update.log)."
    if install(previous, downgrade=True):
        phase("rolled-back", f"{reason} Version {installed} ist wieder installiert.")
    else:
        phase("failed", f"{reason} Auch Version {installed} ließ sich nicht wieder installieren (siehe update.log).")


def start():
    """Anfrage lesen und löschen, prüfen und die Arbeit als transiente Unit starten."""
    request = read_json(REQUEST)
    if os.path.lexists(REQUEST):
        os.remove(REQUEST)
    if request is None:
        return
    # Läuft schon ein Update, wird die Anfrage verworfen. Sein Stand bleibt.
    if subprocess.run([SYSTEMCTL, "is-active", "--quiet", f"{RUN_UNIT}.service"]).returncode == 0:
        return
    request_id = request.get("id") if isinstance(request, dict) else None
    version = request.get("version") if isinstance(request, dict) else None
    failed = {"id": None, "version": None, "phase": "failed", "startedAt": now(), "finishedAt": now()}
    if not isinstance(request_id, str) or not ID.fullmatch(request_id):
        return write_state({**failed, "error": "Anfrage ohne gültige id"})
    if not isinstance(version, str) or not VERSION.fullmatch(version):
        return write_state({**failed, "id": request_id, "error": "Version muss die Form X.Y.Z haben"})

    # Gleich melden, dass es losgeht; `work` schreibt den Stand dann selbst weiter.
    write_state({"id": request_id, "version": version, "phase": "downloading", "error": None,
                 "startedAt": now(), "finishedAt": None})
    result = subprocess.run(
        [SYSTEMD_RUN, f"--unit={RUN_UNIT}", "--collect", "--quiet",
         f"--description=Deep Mine Control auf {version} aktualisieren", SELF, "work", request_id, version],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        write_state({**failed, "id": request_id, "version": version,
                     "error": f"Update ließ sich nicht starten: {result.stderr.strip()}"})


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else "run"
    if command == "run":
        start()
    elif command == "work" and len(sys.argv) == 4:
        work(sys.argv[2], sys.argv[3])
    else:
        sys.exit(f"Aufruf: {sys.argv[0]} run | work <id> <version>")


if __name__ == "__main__":
    main()
