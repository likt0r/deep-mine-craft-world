# Deep Mine Craft World

Unser Minecraft-Bedrock-Server für die Familie. Deep Mine Control steuert Spiel, Welten und Spieler. Admins nutzen bei Bedarf noch BSM.

## Language

**Deep Mine Control**:
Die Oberfläche, mit der Spiel, Welten und Spieler gesteuert werden. Im Heimnetz ohne Anmeldung.
_Avoid_: Spielplatz, Kinder-UI, Dashboard

**BSM**:
Bedrock Server Manager, der Dienst im Hintergrund, der den Bedrock-Server betreibt. Für den Alltag nicht mehr nötig.
_Avoid_: Manager, Admin-Panel

**Platz**:
Einer von genau 10 festen, nummerierten Orten, auf dem höchstens eine Welt liegt.
_Avoid_: Slot, Speicherplatz

**Welt**:
Ein Minecraft-Spielstand mit eigenem Namen, Welttyp, Spielmodus und eigener Schwierigkeit, der auf einem Platz liegt.
_Avoid_: Level, Map, Spielstand

**Aktive Welt**:
Die Welt, die der Server gerade geladen hat. Es gibt immer genau eine.
_Avoid_: aktuelle Welt, laufende Welt

**Laden**:
Eine andere Welt zur aktiven Welt machen. Dafür startet der Server neu, und alle Spieler werden kurz getrennt.
_Avoid_: wechseln, öffnen, aktivieren

**Löschen**:
Eine Welt endgültig entfernen, samt ihrer Backups. Die aktive Welt kann nicht gelöscht werden.
_Avoid_: zurücksetzen, entfernen

**Weltvorgang**:
Alles, was die aktive Welt anhält oder Welten verändert: Laden, Anlegen, Löschen, Zurückspielen und Minecraft-Update. Es läuft immer höchstens einer gleichzeitig.

**Welttyp**:
Normal oder flach. Wird beim Anlegen festgelegt und ändert sich nie.

**Spielregel**:
Ein Schalter, der zur Welt gehört, z. B. „Sachen beim Sterben behalten“ oder „Zeit anhalten“.
_Avoid_: Gamerule, Einstellung

**Version**:
Der Stand von Deep Mine Control oder vom Minecraft-Server, z. B. „1.26.52.3“.

**Update**:
Eine neuere Version installieren. Das Verb dazu ist „aktualisieren“.
_Avoid_: Upgrade, Deploy

**Autoupdate**:
Installiert ein Update von selbst, sobald niemand spielt.

**Spieler**:
Ein Xbox-Konto mit Gamertag, das auf dem Server war oder eingetragen ist.
_Avoid_: User, Account

**Zugang**:
Offen (jeder außer gesperrten Spielern kann beitreten) oder geschlossen (nur Spieler auf der Whitelist).
_Avoid_: Modus, Offline-Modus

**Whitelist**:
Spieler, die bei geschlossenem Zugang beitreten dürfen.
_Avoid_: Allowlist, Freigabeliste

**Sperren**:
Ein gesperrter Spieler wird sofort und bei jedem Beitreten gekickt.
_Avoid_: Bann, Blacklist

**Kicken**:
Einen Online-Spieler einmal rauswerfen. Er kann wieder beitreten.

**Recht**:
Besucher (nur schauen), Mitglied (normal spielen) oder Operator (Befehle).
_Avoid_: Rolle, Permission
