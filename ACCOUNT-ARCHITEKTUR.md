# Account-Architektur für Metaverse Reloaded

## Zielbild

Eine Person erstellt einen Account, legt eigene Metaverses an, gestaltet Räume, plant Events und lädt Hosts sowie Besucher:innen ein. Rechte werden nicht mehr im Browser frei gewählt, sondern serverseitig geprüft.

## Empfohlener Aufbau

- Frontend und 3D-Welt bleiben als Web-App auf `host.kuble.com`.
- Supabase übernimmt Auth, PostgreSQL, Row Level Security und Asset-Metadaten.
- Login startet mit E-Mail-Magic-Link und optional Google; Passkeys können später ergänzt werden.
- LiveKit übernimmt in einer späteren Skalierungsstufe Voice, Screenshare und grössere Räume. Der aktuelle Prototyp erlaubt 25 Personen pro Raum; für verlässliche Produktion unter dieser Last sollte das direkte WebRTC-Mesh durch eine SFU ersetzt werden.
- GLB-Modelle, Raumkonfigurationen und Vorschaubilder liegen in Object Storage mit CDN.

## Datenmodell

### `profiles`

- `id` entspricht der Auth-User-ID
- Anzeigename, Avatar, Sprache und Branding

### `metaverses`

- `id`, `owner_id`, Name, Slug, Beschreibung
- Theme, Standardwelt, Kapazität und Veröffentlichungsstatus

### `metaverse_members`

- `metaverse_id`, `user_id`
- Rolle: `owner`, `admin`, `host` oder `member`

### `rooms`

- gehört zu einem Metaverse
- 3D-Szene, Sitzplätze, Spawn-Punkte, Bühne und Raumregeln als versionierte Konfiguration

### `events`

- Raum, Start-/Endzeit, Host-Team, Einladungsmodus und Kapazität
- Sitzplatz-Lock, Screenshare-Status und weitere Live-Raumzustände

### `event_guests`

- optionale Einladung mit E-Mail, Gastcode oder Account
- Eventrolle und Check-in-Status

## Rechte

- Nur `owner` und `admin` dürfen ein Metaverse ändern oder löschen.
- Nur eingetragene `host`-Personen dürfen Seat all, Lock, Voice-Broadcast und Screenshare steuern.
- Besucher:innen dürfen nur den freigegebenen Raumzustand lesen und erlaubte Aktionen senden.
- Row Level Security prüft jede Datenbankoperation serverseitig.
- Host-Kommandos erhalten signierte Session-Rechte; eine im Browser selbst gewählte Host-Rolle reicht nicht mehr.

## Produktfluss

1. Account erstellen oder anmelden.
2. Dashboard öffnen und `Neues Metaverse` wählen.
3. Vorlage auswählen, Name, Slug, Theme und Kapazität festlegen.
4. Raum im Editor konfigurieren und veröffentlichen.
5. Event anlegen, Hosts bestimmen und Einladungslink teilen.
6. Während des Events Voice, Screen, Seat all, Lock und Unlock über die Host-Konsole steuern.

## Umsetzung in Phasen

1. Auth und Dashboard mit Liste eigener Metaverses
2. Metaverse erstellen, umbenennen, duplizieren und veröffentlichen
3. Mitglieder- und Hostrollen mit serverseitiger Rechteprüfung
4. Eventplanung und Einladungen
5. Raumeditor, Branding und Asset-Uploads
6. LiveKit-Umstieg für grössere Events und robustere Moderation

## Wichtige Grenze des aktuellen Hosts

Die öffentlichen JSON-Datenbanken von `host.kuble.com` erlauben keine sichere Benutzer- und Rechteverwaltung. Accounts, Passwörter, Session-Tokens oder Eigentumsrechte dürfen dort nicht als frei beschreibbare öffentliche Daten gespeichert werden. Für die Account-Ebene ist deshalb ein echtes Auth-Backend erforderlich.

## Aktueller Invite-MVP

Der aktuelle Prototyp erzeugt für jeden Raum einen Guest-Code und einen separaten Cohost-Code. Im Browser werden nur SHA-256-Hashes gespeichert; der Creator behält die lesbaren Codes lokal und ist automatisch Haupt-Host. Beim Beitritt leitet der verwendete Code die Rolle `guest` oder `cohost` ab. Cohosts erhalten Voice, Screenshare und Raumkontrolle.

Das ist ein sinnvoller UX-Prototyp, aber noch keine serverautorisierte Zugriffskontrolle: Da die JSON-Datenbank öffentlich lesbar und beschreibbar ist, muss die produktive Account-Version Codeprüfung, Room-Mitgliedschaft und Host-Kommandos in Supabase Edge Functions oder einer eigenen API validieren.
