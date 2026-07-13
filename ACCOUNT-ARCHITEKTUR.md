# Account-Architektur für Metaverse Reloaded

## Zielbild

Eine Person erstellt einen Account, legt eigene Metaverses an, gestaltet Räume, plant Events und lädt Hosts sowie Besucher:innen ein. Rechte werden nicht mehr im Browser frei gewählt, sondern serverseitig geprüft.

## Umgesetzter Account-MVP

- Supabase Auth meldet Personen passwortlos per E-Mail-Magic-Link an.
- `spaces` und `space_invites` liegen in PostgreSQL und sind durch Row Level Security geschützt.
- Neue Spaces werden über eine authentifizierte `SECURITY DEFINER`-RPC erstellt und gehören eindeutig zur Auth-User-ID.
- `spaces.html` zeigt angemeldeten Personen nur ihre eigenen Spaces zur Bearbeitung und zum Löschen.
- Invite-Codes können owner-only erneuert werden. Supabase speichert ausschliesslich SHA-256-Hashes.
- Öffentliche Deep Links, die öffentliche Space-Liste und der Beitritt per Guest- oder Cohost-Code funktionieren ohne Account.
- Die 14 Räume aus der bisherigen Host-Datenbank wurden mit unveränderten Deep Links und Invite-Hashes importiert. Sie bleiben ohne Account-Owner, bis ein späterer Claim-Flow ergänzt wird.

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

## Aufteilung zwischen Supabase und aktuellem Host

Supabase ist die Quelle der Wahrheit für Accounts, Ownership, Space-Metadaten und Invite-Hashes. Die öffentlichen JSON-Datenbanken von `host.kuble.com` bleiben vorerst für Presence, Chat, Signaling, Portale, Avatarprofile und die Legacy-Kompatibilität zuständig. Diese Realtime-Daten enthalten keine Supabase-Session-Tokens oder Account-Rechte.

## Aktueller Invite- und Rollen-MVP

Der aktuelle Prototyp erzeugt für jeden Raum einen Guest-Code und einen separaten Cohost-Code. Im Browser werden nur SHA-256-Hashes gespeichert; der Creator behält die lesbaren Codes lokal und ist automatisch Haupt-Host. Beim Beitritt leitet der verwendete Code die Rolle `guest` oder `cohost` ab. Cohosts erhalten Voice, Screenshare und Raumkontrolle.

Die Invite-Auflösung und die Verwaltung eigener Spaces werden serverseitig in Supabase geprüft. Die Live-Host-Kommandos laufen im aktuellen Prototyp weiterhin über den browserbasierten Realtime-Layer. Für eine produktive Moderationsschicht müssen Host-Kommandos später über Supabase Edge Functions, eine eigene autoritative API oder LiveKit-Serverrechte validiert werden.
