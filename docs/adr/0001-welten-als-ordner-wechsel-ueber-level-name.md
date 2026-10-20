# Welten liegen als Ordner nebeneinander, Laden wechselt `level-name` und startet neu

Bedrock lädt immer den Ordner unter `worlds/`, den `level-name` in `server.properties` nennt. Deep Mine Control legt deshalb jede Welt als eigenen Ordner an und lädt eine Welt, indem es `level-name` umstellt und den Server über BSM neu startet. Welten werden dabei nicht als `.mcworld` exportiert und importiert. Ein Wechsel kostet so nur einen Neustart und keine Kopie. BSM benennt Backups nach dem Weltordner und behält 3 pro Ordner, deshalb verdrängen sich die Backups verschiedener Welten nicht gegenseitig.

## Consequences

- Ordnernamen neuer Welten sind eindeutig und werden nie wiederverwendet, sonst würden alte Backups einer gelöschten Welt einer neuen zugeordnet.
- Den Anzeigenamen einer Welt kennt nur Deep Mine Control. BSM sieht nur den Ordnernamen.
- Spielmodus und Schwierigkeit stehen in `server.properties` und gelten serverweit. Deep Mine Control merkt sie sich pro Welt und setzt sie beim Laden.
