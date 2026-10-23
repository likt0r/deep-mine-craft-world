# deep-mine-craft-world

Unser Minecraft-Server für PlayStation, Switch und iOS: der offizielle
Bedrock Dedicated Server von Mojang, verwaltet über
[Bedrock Server Manager (BSM)](https://github.com/DMedina559/bedrock-server-manager).
Die Kinder steuern das Spiel über **Deep Mine Control**, eine Tablet-Oberfläche ohne Anmeldung.

## Überblick

| Was | Wo |
|---|---|
| Server | Ubuntu 26.04 auf `192.168.0.110` |
| Deep Mine Control | http://192.168.0.110 (ohne Anmeldung, nur im LAN) |
| BSM-Weboberfläche | https://192.168.0.110 (Caddy, selbst ausgestelltes Zertifikat) |
| BSM | Dienst `bsm`, Benutzer `bsm`, Programm in `/opt/bsm/.venv`, lauscht nur auf `127.0.0.1:11325` |
| Daten | `/var/lib/bsm/config` (Datenbank, Konten), `/var/lib/bsm/data` (Server, Welten, Backups) |
| Bedrock-Server | in BSM `Bedrock`, Ordner `/var/lib/bsm/data/servers/Bedrock` |
| Deep Mine Control | Dienst `deep-mine-control`, Benutzer `bsm`, Programm in `/opt/deep-mine-control`, lauscht nur auf `127.0.0.1:3000`, Daten in `/var/lib/bsm/deep-mine-control`, Passwort in `/etc/deep-mine-control.env` |

Passwörter stehen nicht in diesem Repo.

## Ports

Der Bedrock-Server nutzt seit 2026 standardmäßig das Protokoll **NetherNet**
(`transport=nethernet`) statt des alten RakNet:

- **TCP 19132**: Verbindungsaufbau
- **UDP 7551**: LAN-Suche (Konsolen finden den Server unter Freunde → LAN-Spiele)
- danach UDP auf zufälligen hohen Ports; mit `server-udp-ports` festlegbar, falls eine Firewall dazwischen ist

Ein klassischer Bedrock-Ping auf UDP 19132 bekommt deshalb keine Antwort. Das ist kein Fehler.

## Einstellungen, die wir geändert haben

In BSM beim Server `Bedrock`:

- `gamemode=creative`, `force-gamemode=true` (alle spielen kreativ, fliegen per Doppelsprung)
- Autostart und Auto-Update an (Konsolen und Handys aktualisieren sich selbst, der Server muss mitziehen)
- Seit BDS 26.30 ist `allow-list=true` voreingestellt: Spieler unter „Access Control“ → „Allowlist“ eintragen

BSM behält 3 Backups und 3 heruntergeladene Bedrock-Versionen, vor jedem Start wird gesichert.

## Deep Mine Control

Die Tablet-Oberfläche unter http://192.168.0.110 hat vier Bereiche (Handy: Tabs unten, Tablet: Leiste links):

- **Spielen:** aktive Welt mit Status, Spieler („Alle hierher“), Spielmodus, Schwierigkeit, Zeit und Wetter
- **Welten:** 10 Plätze für Welten (anlegen, laden, umbenennen, löschen durch 3 s Halten)
- **Regeln:** die Spielregeln der aktiven Welt
- **System:** CPU-Temperatur und -Last, Arbeitsspeicher, Platte, SSD-Zustand, Laufzeiten, letzte Sicherung;
  Minecraft neu starten oder stoppen, Rechner neu starten oder ausschalten (jeweils 3 s halten).
  Unter **System → Netzwerk**: Ethernet (DHCP oder feste IP), hinterlegte WLANs, das eigene WLAN (AP) mit Passwort
  und QR-Code, Offline-Modus

Rechner neu starten und ausschalten darf Deep Mine Control (Benutzer `bsm`) über die polkit-Regel
`/etc/polkit-1/rules.d/50-deep-mine-control.rules`, sonst nichts. Ausgeschaltet geht der Rechner nur am Gerät wieder an.

## Ethernet

Deep Mine Control (`bsm`) darf netplan nicht ändern. Es schreibt nur eine Anfrage
(`/var/lib/bsm/deep-mine-control/ethernet-request.json`); die Path-Unit `deep-mine-ethernet.path` startet den
root-Helfer `/usr/local/bin/deep-mine-ethernet` (`server/ethernet.py`). Der prüft die Werte noch einmal, schreibt
`/etc/netplan/60-deep-mine-ethernet.yaml` (feste IP; für DHCP wird die Datei gelöscht, dann gilt wieder
`00-installer-config.yaml`), führt `netplan apply` aus und startet den Timer `deep-mine-ethernet-rollback`:
**Ohne Bestätigung in der Oberfläche gilt nach 2 Minuten wieder die alte Einstellung.** Notfalls von Hand:
`sudo rm /etc/netplan/60-deep-mine-ethernet.yaml && sudo netplan apply`.

Caddy liefert Deep Mine Control unter jeder Adresse aus (`:80`), also auch im eigenen WLAN unter
`http://10.42.0.1` und nach einem IP-Wechsel.

## WLAN

NetworkManager verwaltet **nur das WLAN** (`wlp3s0`, Atheros AR9287, 2,4 GHz); Ethernet bleibt bei
systemd-networkd/netplan (`/etc/NetworkManager/conf.d/90-deep-mine.conf`, `/etc/systemd/network/10-wlan-unmanaged.network`).

- Hinterlegte WLANs heißen in NetworkManager `dmc-wlan-N` (Priorität 10), das eigene WLAN `dmc-ap`
  (Standard `MINECRAFT-World` / `deep-mine-craft`, Priorität −100). Ohne hinterlegtes WLAN in Reichweite geht
  der AP an; hängt ein Kabel am Router, gibt er das Internet weiter (Server unter `10.42.0.1`).
- Der Timer `deep-mine-wifi-check` (jede Minute) nimmt den AP alle 5 Minuten kurz herunter, wenn niemand daran
  hängt, damit der Server zurück ins hinterlegte WLAN findet.
- Das WLAN lässt sich ausschalten (`/var/lib/bsm/deep-mine-control/wifi.json`), und aus bleibt aus. **Rettungsmodus:**
  Hat der Server 3 Minuten lang keine Netzwerkverbindung außer über das WLAN, schaltet der Timer es ein
  (`/run/deep-mine-wifi-rescue`). Ist das Kabel zurück und niemand mehr am eigenen WLAN, geht es wieder aus.
- Ohne Internet müssen sich Spieler normalerweise bei Xbox Live anmelden; der **Offline-Modus** schaltet
  `online-mode` aus. Ob Konsolen ganz ohne Internet beitreten können, hängt vom Gerät ab.

Die SMART-Werte der Systemplatte braucht root: Der Timer `deep-mine-smart` schreibt sie alle 30 Minuten
nach `/var/lib/bsm/deep-mine-control/smart.json` (`install.sh` richtet ihn ein).
Begriffe stehen in [CONTEXT.md](CONTEXT.md), entwickelt wird in `control/` (siehe [AGENTS.md](AGENTS.md)).

Deep Mine Control spricht mit BSM über ein eigenes BSM-Konto `deep-mine-control` (Rolle moderator reicht).
Das Passwort steht nur in `/etc/deep-mine-control.env` als `NUXT_BSM_PASSWORD=…`.
Konto neu anlegen: in BSM unter Benutzer einen Registrierungslink erzeugen, damit `deep-mine-control`
registrieren, Passwort in die Datei schreiben, `sudo systemctl restart deep-mine-control`.

## Aktualisieren

Auf dem Laptop, nachdem die Änderungen auf GitHub sind:

```sh
./deploy.sh
```

Das holt auf dem Server den neuen Stand (`~/deep-mine-craft-world`, `git pull`) und führt `install.sh` aus.

## Neu installieren (z. B. auf neuer Festplatte)

1. Ubuntu Server installieren, dieses Repo nach `~/deep-mine-craft-world` klonen.
2. `sudo ./install.sh 192.168.0.110`
3. Daten vom alten Server übernehmen. Damit bleiben Welten, Backups und die BSM-Konten erhalten:
   ```sh
   # auf dem alten Server
   sudo systemctl stop bsm
   sudo tar -C /var/lib/bsm -czf bsm-daten.tar.gz config data
   # auf dem neuen Server
   sudo systemctl stop bsm
   sudo tar -C /var/lib/bsm -xzf bsm-daten.tar.gz
   sudo chown -R bsm:bsm /var/lib/bsm
   sudo systemctl start bsm
   ```
   Ohne alte Daten: https://192.168.0.110 öffnen, Admin-Konto anlegen, Server `Bedrock` installieren
   und eine gesicherte Welt (`.mcworld`) unter „Content“ importieren.
   Die Plätze von Deep Mine Control liegen in `/var/lib/bsm/deep-mine-control` und gehören mit ins Archiv:
   `sudo tar -C /var/lib/bsm -czf bsm-daten.tar.gz config data deep-mine-control`.
4. BSM-Konto für Deep Mine Control anlegen (siehe oben), falls `config` nicht übernommen wurde.

## Nützliche Konsolenbefehle (BSM → Konsole, ohne `/`)

```
allowlist add Gamertag        # Spieler reinlassen
op Gamertag                   # Spieler zum Operator machen
time set day                  # Tag
gamerule dodaylightcycle false  # Zeit anhalten
gamerule keepinventory true   # Sachen beim Sterben behalten
difficulty peaceful           # keine Monster
kill @e[type=panda]           # alle Pandas entfernen
```

## Leistung (gemessen)

Mit 1 Spieler und ~460 Pandas: etwa 1 CPU-Kern, 560 MB RAM, Welt 4,4 MB.
Bei vielen Tieren auf einem Fleck ruckeln zuerst die Geräte der Spieler, nicht der Server.
