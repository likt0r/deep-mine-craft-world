# Deep Mine Craft World

Unser Minecraft-Bedrock-Server für die Familie. Admins verwalten ihn über BSM, die Kinder steuern das Spiel über Deep Mine Control.

## Language

**Deep Mine Control**:
Die Tablet-Oberfläche ohne Anmeldung, mit der Kinder im LAN Spiel und Welten steuern.
_Avoid_: Spielplatz, Kinder-UI, Dashboard

**BSM**:
Bedrock Server Manager, die Admin-Oberfläche mit Anmeldung, die den Bedrock-Server betreibt.
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
Laden, Anlegen oder Löschen einer Welt. Es läuft immer höchstens einer gleichzeitig.

**Welttyp**:
Normal oder flach. Wird beim Anlegen festgelegt und ändert sich nie.

**Spielregel**:
Ein Schalter, der zur Welt gehört, z. B. „Sachen beim Sterben behalten“ oder „Zeit anhalten“.
_Avoid_: Gamerule, Einstellung
