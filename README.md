# deep-mine-craft-world

Unser Minecraft-Server für PlayStation, Switch und iOS: der offizielle
Bedrock Dedicated Server von Mojang, verwaltet über
[Bedrock Server Manager (BSM)](https://github.com/DMedina559/bedrock-server-manager).

## Überblick

| Was | Wo |
|---|---|
| Server | Ubuntu 26.04 auf `192.168.0.110` |
| Weboberfläche | https://192.168.0.110 (Caddy, selbst ausgestelltes Zertifikat) |
| BSM | Dienst `bsm`, Benutzer `bsm`, Programm in `/opt/bsm/.venv`, lauscht nur auf `127.0.0.1:11325` |
| Daten | `/var/lib/bsm/config` (Datenbank, Konten), `/var/lib/bsm/data` (Server, Welten, Backups) |
| Bedrock-Server | in BSM `Bedrock`, Ordner `/var/lib/bsm/data/servers/Bedrock` |

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

## Neu installieren (z. B. auf neuer Festplatte)

1. Ubuntu Server installieren, dieses Repo auf den Server holen.
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
