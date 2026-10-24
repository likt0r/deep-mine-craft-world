# Deep Mine Control wird in der Pipeline gebaut und als .deb am GitHub-Release ausgeliefert, ohne apt-Repository

Bisher hat `install.sh` Deep Mine Control auf dem Server selbst gebaut (npm, Nuxt-Build) und dafür die feste IP des Servers gebraucht. Jetzt baut die GitHub-Pipeline aus dem fertigen Build ein Paket `deep-mine-control` (amd64, nfpm). Dessen Maintainer-Skripte übernehmen alle Einrichtungsschritte. Das Paket hängt mit SHA-256-Prüfsumme am GitHub-Release, und der Server installiert es mit apt aus einer Datei. Ein apt-Repository gibt es bewusst nicht: unattended-upgrades würde Pakete daraus von selbst einspielen, auch wenn gerade jemand spielt. Ein Update von Deep Mine Control darf aber nur kommen, wenn niemand spielt (Autoupdate) oder wenn es jemand per Knopf auslöst. Kommt die neue Version danach nicht hoch, installiert der Server von selbst das vorige Paket wieder. Ohne Anmeldung in der Oberfläche soll ein kaputtes Update die Kinder nicht ohne Oberfläche zurücklassen.

## Consequences

- Der Server braucht kein npm und keinen Build mehr, und die Caddy-Konfiguration kommt ohne feste IP aus (BSM per `tls internal` mit Zertifikaten „on demand“).
- Paketinhalt, Abhängigkeiten und Maintainer-Skripte sind der Vertrag mit dem Server. CI prüft Dateiliste und Abhängigkeiten. Die Maintainer-Skripte zeigen sich erst beim echten Ausrollen, deshalb müssen sie idempotent sein.
- Alle Dateien liegen unter `/usr`, ohne conffiles. Lokale Änderungen gehen über gleichnamige Dateien in `/etc`. Daten (`/var/lib/bsm`) und das Passwort (`/etc/deep-mine-control.env`) gehören nicht zum Paket und bleiben beim Entfernen liegen.
- Updates holt Deep Mine Control selbst ab (GitHub-API, Download mit Prüfsumme). Dafür braucht es einen root-Helfer und für den Rückfall einen Cache mit dem vorigen Paket.
- Auch BSM ändert sich nur mit einem Release: Die Version steht fest im postinst.
